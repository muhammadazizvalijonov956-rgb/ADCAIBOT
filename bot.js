const { Telegraf, Markup, session } = require("telegraf");
const geminiService = require("./services/gemini");
const dbService = require("./services/database");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Initialize Database
dbService.initDb().catch(err => {
  console.error("Failed to initialize database:", err);
});

// Load knowledge base
const knowledgeBasePath = path.join(__dirname, "knowledge", "adc_data.txt");
let knowledgeBase = "";

try {
  knowledgeBase = fs.readFileSync(knowledgeBasePath, "utf8");
  console.log(`✅ Knowledge base loaded from ${knowledgeBasePath}`);
} catch (error) {
  console.error(`❌ Failed to load knowledge base: ${error.message}`);
  knowledgeBase = "Knowledge base not available. Please contact administrator.";
}

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Use session for registration flow
bot.use(session());

// Conversation memory (in production, use Redis or database)
const conversationMemory = new Map();

// Anti-spam cooldown (basic)
const userCooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds

// Helper function to get or create user conversation history
function getUserConversation(userId) {
  if (!conversationMemory.has(userId)) {
    conversationMemory.set(userId, {
      history: [],
      lastInteraction: Date.now()
    });
  }

  // Clean old conversations (older than 1 hour)
  const userData = conversationMemory.get(userId);
  if (Date.now() - userData.lastInteraction > 3600000) { // 1 hour
    userData.history = [];
  }

  return userData;
}

// Helper function to add message to conversation history
function addToConversation(userId, role, content) {
  const userData = getUserConversation(userId);
  userData.history.push({ role, content });
  userData.lastInteraction = Date.now();

  // Keep only last 10 messages (5 exchanges)
  if (userData.history.length > 10) {
    userData.history = userData.history.slice(-10);
  }
}

// Middleware for typing indicator and cooldown
bot.use(async (ctx, next) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!userId) return next();

  // Only apply cooldown to regular text messages, not button clicks
  if (ctx.message && ctx.message.text) {
    // Check cooldown
    if (userCooldowns.has(userId)) {
      const lastMessageTime = userCooldowns.get(userId);
      if (Date.now() - lastMessageTime < COOLDOWN_TIME) {
        return ctx.reply(
          "Please wait a moment before sending another message. I'm still thinking about your last question... 😊"
        );
      }
    }
    // Set cooldown
    userCooldowns.set(userId, Date.now());
  }

  // Show typing indicator
  if (ctx.message) {
    try {
      await ctx.telegram.sendChatAction(ctx.chat.id, "typing");
    } catch (e) {
      // Ignore if we can't send chat action
    }

    // Add user message to conversation
    if (ctx.message.text) {
      addToConversation(userId, "user", ctx.message.text);
    }
  }

  await next();
});

// Main Menu Keyboard
const mainMenu = Markup.keyboard([
  ["📝 Ro'yxatdan o'tish (Register)", "🎓 IELTS Registration"],
  ["ℹ️ Ma'lumot (Info)", "📞 Aloqa (Contact)"]
]).resize();

// Start command
bot.start((ctx) => {
  const msg = "Iltimos, tilni tanlang:\nПожалуйста, выберите язык:\nPlease select a language:";
  const langKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz")],
    [Markup.button.callback("🇷🇺 Русский", "lang_ru")],
    [Markup.button.callback("🇬🇧 English", "lang_en")]
  ]);
  ctx.reply(msg, langKeyboard);
});

// Language command
bot.command("language", (ctx) => {
  const msg = "Iltimos, tilni tanlang:\nПожалуйста, выберите язык:\nPlease select a language:";
  const langKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz")],
    [Markup.button.callback("🇷🇺 Русский", "lang_ru")],
    [Markup.button.callback("🇬🇧 English", "lang_en")]
  ]);
  ctx.reply(msg, langKeyboard);
});

// Language action
bot.action(/lang_(uz|ru|en)/, async (ctx) => {
  const lang = ctx.match[1];
  try {
    ctx.session = ctx.session || {};
    await dbService.updateUserLanguage(ctx.from.id, lang);
    ctx.session.language = lang;
    await ctx.answerCbQuery();

    let welcomeMessage = "";
    if (lang === "uz") {
      welcomeMessage = "🇺🇿 ADC yordamchi botiga xush kelibsiz! Men sizga kurslarimiz, narxlar va ro'yxatdan o'tish haqida ma'lumot berishga tayyorman. Qanday yordam bera olaman?";
    } else if (lang === "ru") {
      welcomeMessage = "🇷🇺 Добро пожаловать в бот-помощник ADC! Я готов помочь вам с информацией о наших курсах, ценах и регистрации. Чем могу помочь?";
    } else {
      welcomeMessage = "🇬🇧 Welcome to the ADC assistant bot! I'm ready to help you with information about our courses, prices, and registration. How can I help you today?";
    }
    await ctx.reply(welcomeMessage, mainMenu);
  } catch (err) {
    console.error("Language set error:", err);
    await ctx.answerCbQuery("Error saving language");
  }
});

// Registration Command/Button
bot.hears(["📝 Ro'yxatdan o'tish (Register)", "/register"], async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.registrationStep = "AWAITING_NAME";

  await ctx.reply(
    "To'liq ism-sharifingizni kiriting:\n(Please enter your full name:)",
    Markup.inlineKeyboard([Markup.button.callback("❌ Cancel", "cancel_registration")])
  );
});

// Cancel Registration
bot.action("cancel_registration", async (ctx) => {
  ctx.session.registrationStep = null;
  await ctx.answerCbQuery();
  await ctx.reply("Ro'yxatdan o'tish bekor qilindi.", mainMenu);
});

// Handle Info and Contact directly
bot.hears("ℹ️ Ma'lumot (Info)", (ctx) => ctx.reply("Andijan Development Center (ADC) - Zamonaviy ta'lim markazi. Kurslarimiz haqida so'rang!"));
bot.hears("📞 Aloqa (Contact)", (ctx) => ctx.reply("📞 Tel: +998 74 226-10-78\n📍 Manzil: Mashrab ko'chasi 19A\nTG: @admofadc"));

bot.hears(["🎓 IELTS Registration"], async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.registrationStep = "IELTS_AWAITING_NAME";
  await ctx.reply("🎓 IELTS imtihoniga ro'yxatdan o'tish.\n\nIltimos, to'liq ism-sharifingizni kiriting:",
    Markup.inlineKeyboard([Markup.button.callback("❌ Cancel", "cancel_registration")]));
});

// Help command
bot.help((ctx) => {
  const helpMessage = `
📚 How I can help you:

I can provide information about:
• Courses and their details
• Prices
• Course duration and schedules
• Our branches and locations
• Registration process
• Certificates
• Contact information
• And much more...

Just type your question naturally and I'll respond in the same language you used.

For complex inquiries, I may suggest contacting our administrator for exact details.

Let's get started! What would you like to know? 😊
  `;

  ctx.reply(helpMessage);
});

// Handle all text messages
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  ctx.session = ctx.session || {};

  // Handle Registration Flow
  if (ctx.session.registrationStep) {
    if (ctx.session.registrationStep === "AWAITING_NAME") {
      ctx.session.regData = { fullName: userMessage };
      ctx.session.registrationStep = "AWAITING_PHONE";
      return ctx.reply("Telefon raqamingizni kiriting (masalan: +998901234567):");
    }

    if (ctx.session.registrationStep === "AWAITING_PHONE") {
      // Basic phone validation (+998XXXXXXXXX)
      const phoneRegex = /^\+998\d{9}$/;
      if (!phoneRegex.test(userMessage.replace(/\s+/g, ''))) {
        return ctx.reply("Iltimos, telefon raqamni to'g'ri formatda kiriting (masalan: +998901234567):");
      }

      ctx.session.regData.phoneNumber = userMessage;
      ctx.session.registrationStep = "AWAITING_COURSE";
      return ctx.reply(
        "Qaysi kursga yozilmoqchisiz?",
        Markup.keyboard([
          ["IELTS", "General English"],
          ["Web Development", "Graphic Design"],
          ["❌ Cancel"]
        ]).oneTime().resize()
      );
    }

    if (ctx.session.registrationStep === "AWAITING_COURSE") {
      if (userMessage === "❌ Cancel") {
        ctx.session.registrationStep = null;
        return ctx.reply("Bekor qilindi.", mainMenu);
      }

      ctx.session.regData.course = userMessage;
      ctx.session.registrationStep = "AWAITING_DAYS";

      return ctx.reply(
        "Siz xohlagan vaqt va kunda kelishingiz mumkin! 🌟\n\nQaysi kunlari kelmoqchisiz?\n(Which days do you prefer?)",
        Markup.keyboard([
          ["Du/Chor/Juma (M/W/F)", "Sesh/Pay/Shanba (T/T/S)"],
          ["❌ Cancel"]
        ]).oneTime().resize()
      );
    }

    if (ctx.session.registrationStep === "AWAITING_DAYS") {
      if (userMessage === "❌ Cancel") {
        ctx.session.registrationStep = null;
        return ctx.reply("Bekor qilindi.", mainMenu);
      }

      ctx.session.regData.preferredDays = userMessage;
      ctx.session.registrationStep = "AWAITING_TIME";

      return ctx.reply(
        "Qaysi vaqtda?\n(Morning or Afternoon?)",
        Markup.keyboard([
          ["Ertalab (Morning)", "Tushdan keyin (Afternoon)"],
          ["❌ Cancel"]
        ]).oneTime().resize()
      );
    }

    if (ctx.session.registrationStep === "AWAITING_TIME") {
      if (userMessage === "❌ Cancel") {
        ctx.session.registrationStep = null;
        return ctx.reply("Bekor qilindi.", mainMenu);
      }

      ctx.session.regData.preferredTime = userMessage;
      ctx.session.registrationStep = null;

      try {
        await dbService.registerUser(userId, {
          username: ctx.from.username || "n/a",
          ...ctx.session.regData
        });

        await ctx.reply(
          `✅ Rahmat! Siz muvaffaqiyatli ro'yxatdan o'tdingiz.\n\n👤 Ism: ${ctx.session.regData.fullName}\n📞 Tel: ${ctx.session.regData.phoneNumber}\n📚 Kurs: ${ctx.session.regData.course}\n📅 Kunlar: ${ctx.session.regData.preferredDays}\n⏰ Vaqt: ${ctx.session.regData.preferredTime}\n\nTez orada menejerimiz siz bilan bog'lanadi.`,
          mainMenu
        );
      } catch (err) {
        console.error("Registration DB error:", err);
        ctx.reply("Kechirasiz, bazaga saqlashda xatolik yuz berdi. Iltimos keyinroq harakat qilib ko'ring.", mainMenu);
      }
      return;
    }

    // --- IELTS Registration Steps ---
    if (ctx.session.registrationStep === "IELTS_AWAITING_NAME") {
      ctx.session.ieltsData = { fullName: userMessage };
      ctx.session.registrationStep = "IELTS_AWAITING_PHONE";
      return ctx.reply("Telefon raqamingizni kiriting:");
    }

    if (ctx.session.registrationStep === "IELTS_AWAITING_PHONE") {
      // Basic phone validation (+998XXXXXXXXX)
      const phoneRegex = /^\+998\d{9}$/;
      if (!phoneRegex.test(userMessage.replace(/\s+/g, ''))) {
        return ctx.reply("Iltimos, telefon raqamni to'g'ri formatda kiriting (masalan: +998901234567):");
      }
      ctx.session.ieltsData.phoneNumber = userMessage;
      ctx.session.registrationStep = "IELTS_AWAITING_GMAIL";
      return ctx.reply("Gmail manzilingizni kiriting:");
    }

    if (ctx.session.registrationStep === "IELTS_AWAITING_GMAIL") {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userMessage)) {
        return ctx.reply("Iltimos, to'g'ri elektron pochta manzilini kiriting (masalan: example@gmail.com):");
      }
      ctx.session.ieltsData.gmail = userMessage;
      ctx.session.registrationStep = "IELTS_AWAITING_PASSPORT";
      return ctx.reply("Passportingizni (rasm yoki PDF) yuboring:");
    }

    if (ctx.session.registrationStep === "IELTS_AWAITING_EXAM_TYPE") {
      ctx.session.ieltsData.examType = userMessage;
      ctx.session.registrationStep = null;

      try {
        // Save to Database
        await dbService.registerIELTS({
          telegramId: ctx.from.id,
          ...ctx.session.ieltsData
        });

        // Confirmation to Student
        await ctx.reply("✅ Sizning IELTS ro'yxatdan o'tish so'rovingiz qabul qilindi!\n\nMenejerimiz hujjatlarni tekshirib, tez orada siz bilan bog'lanadi.", mainMenu);

        // Notification to Admin
        const adminId = process.env.ADMIN_CHAT_ID;
        if (adminId) {
          const notifyMsg = `🔔 <b>Yangi IELTS Ro'yxatdan o'tish!</b>\n\n👤 Ism: ${ctx.session.ieltsData.fullName}\n📞 Tel: ${ctx.session.ieltsData.phoneNumber}\n📧 Gmail: ${ctx.session.ieltsData.gmail}\n🏢 Markaz: ${ctx.session.ieltsData.examType}\n\nIltimos, admin paneldan tekshiring.`;
          ctx.telegram.sendMessage(adminId, notifyMsg, { parse_mode: "HTML" });
        }
      } catch (err) {
        console.error("IELTS Registration Error:", err);
        ctx.reply("Kechirasiz, saqlashda xatolik yuz berdi.", mainMenu);
      }
      return;
    }
  }

  try {
    // Get conversation history for context
    const userData = getUserConversation(userId);
    const conversationHistory = userData.history.slice(0, -1); // Exclude current message

    // Get user language
    let userLanguage = ctx.session.language;
    if (!userLanguage) {
      try {
        const user = await dbService.getUser(userId);
        if (user && user.language) {
          userLanguage = user.language;
          ctx.session.language = userLanguage;
        } else {
          userLanguage = "uz";
        }
      } catch (e) {
        userLanguage = "uz";
      }
    }

    // Generate response using Gemini
    const aiResponse = await geminiService.generateResponse(
      userMessage,
      knowledgeBase,
      conversationHistory,
      userLanguage
    );

    // Add AI response to conversation history
    addToConversation(userId, "assistant", aiResponse);

    // Filter out Markdown and convert to HTML
    let formattedResponse = aiResponse
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Restore allowed tags and convert unsupported ones
    formattedResponse = formattedResponse
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, "<b>$1</b>")
      .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, "<i>$1</i>")
      .replace(/&lt;li&gt;/g, "• ")
      .replace(/&lt;\/li&gt;/g, "\n")
      .replace(/&lt;ul&gt;|&lt;\/ul&gt;/g, "")
      .replace(/&lt;br&gt;/g, "\n")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>");

    // Send response
    try {
      await ctx.reply(formattedResponse, {
        parse_mode: "HTML",
        ...mainMenu
      });
    } catch (sendError) {
      console.error("Telegram Send Error:", sendError.message);
      console.error("Failed Response Text:", formattedResponse);
      // Fallback to plain text if HTML fails
      await ctx.reply(aiResponse, mainMenu);
    }
  } catch (error) {
    console.error("Error processing message:", error);

    // Fallback response
    const fallbackMessage = `
😔 I apologize, but I'm experiencing some technical difficulties right now.

Please try again in a moment, or if you need urgent assistance, you can:
• Call us at: +998 74 226-10-78
• Visit our main branch: Mashrab Street 19A, Andijan
• Telegram: @admofadc

Thank you for your patience!
    `;

    ctx.reply(fallbackMessage);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);

  ctx.reply(
    "😢 Something went wrong on our end. Please try again later or contact ADC administrator for assistance."
  );
});

// Graceful shutdown
process.once("SIGINT", () => {
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});

// Start the bot
// Handle Passport uploads for IELTS
bot.on(["photo", "document"], async (ctx) => {
  ctx.session = ctx.session || {};
  if (ctx.session.registrationStep === "IELTS_AWAITING_PASSPORT") {
    const fileId = ctx.message.photo
      ? ctx.message.photo[ctx.message.photo.length - 1].file_id
      : ctx.message.document.file_id;

    ctx.session.ieltsData.passportFileId = fileId;
    ctx.session.registrationStep = "IELTS_AWAITING_EXAM_TYPE";

    return ctx.reply(
      "Qaysi test markazida topshirmoqchisiz?\n(Which test center do you prefer?)",
      Markup.keyboard([
        ["British Council", "IDP"]
      ]).oneTime().resize()
    );
  }
});
const startBot = async () => {
  try {
    await bot.launch();
    console.log("🚀 ADC AI Bot is running!");
    console.log("📱 Bot is ready to receive messages on Telegram");
    console.log("🔑 Make sure your BOT_TOKEN and GEMINI_API_KEY are set in .env");
    console.log("💡 Press Ctrl+C to stop the bot");
  } catch (err) {
    console.error("❌ Failed to start bot:", err.message);
    if (err.code === 409) {
      console.log("🔄 Bot instance conflict. Retrying in 3 seconds...");
      setTimeout(startBot, 3000);
    } else {
      process.exit(1);
    }
  }
};
startBot();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

module.exports = bot;