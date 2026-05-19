const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const ExcelJS = require("exceljs");
const fs = require("fs");
const dbService = require("./services/database");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adcadmin123";

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "adc-secret-key",
  resave: false,
  saveUninitialized: true
}));

// Auth Middleware
const auth = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Login Route
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get all users
app.get("/api/users", auth, async (req, res) => {
  try {
    const users = await dbService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all IELTS registrations
app.get("/api/ielts", auth, async (req, res) => {
  try {
    const records = await dbService.getAllIELTSRegistrations();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update IELTS registration status
app.put("/api/ielts/:id/status", auth, async (req, res) => {
  try {
    await dbService.updateIELTSStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Passport photo link (proxy it or redirect)
app.get("/api/passport/:fileId", auth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const bot = require("./bot"); // Use the already launched bot
    const file = await bot.telegram.getFile(fileId);
    const link = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    res.redirect(link);
  } catch (err) {
    res.status(500).send("Failed to retrieve file: " + err.message);
  }
});

// Update user
app.put("/api/users/:id", auth, async (req, res) => {
  try {
    await dbService.updateUser(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete("/api/users/:id", auth, async (req, res) => {
  try {
    await dbService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export to Excel
app.get("/api/export", auth, async (req, res) => {
  try {
    const users = await dbService.getAllUsers();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Registered Users");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Telegram ID", key: "telegram_id", width: 15 },
      { header: "Username", key: "username", width: 20 },
      { header: "Full Name", key: "full_name", width: 30 },
      { header: "Phone", key: "phone_number", width: 20 },
      { header: "Course", key: "course", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Date", key: "created_at", width: 25 }
    ];

    users.forEach(user => worksheet.addRow(user));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "adc_users.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Knowledge Base
app.get("/api/knowledge", auth, (req, res) => {
  const kbPath = path.join(__dirname, "knowledge", "adc_data.txt");
  fs.readFile(kbPath, "utf8", (err, data) => {
    if (err) res.status(500).send(err.message);
    else res.json({ content: data });
  });
});

// Save Knowledge Base
app.post("/api/knowledge", auth, (req, res) => {
  const { content } = req.body;
  const kbPath = path.join(__dirname, "knowledge", "adc_data.txt");
  fs.writeFile(kbPath, content, "utf8", (err) => {
    if (err) res.status(500).send(err.message);
    else res.json({ success: true });
  });
});

// Direct Message a User
app.post("/api/message/:telegramId", auth, async (req, res) => {
  try {
    const { message } = req.body;
    const { telegramId } = req.params;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const bot = require("./bot");
    await bot.telegram.sendMessage(telegramId, `📩 <b>Admin Message:</b>\n\n${message}`, { parse_mode: "HTML" });
    
    res.json({ success: true });
  } catch (err) {
    console.error("Direct Message Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Broadcast Message
app.post("/api/broadcast", auth, upload.single("file"), async (req, res) => {
  try {
    const { message } = req.body;
    const file = req.file; // From multer
    
    if (!message && !file) return res.status(400).json({ error: "Message or file is required" });

    const bot = require("./bot");
    const dbService = require("./services/database");
    const users = await dbService.getAllUsers();
    
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        if (file) {
          // Determine file type and send accordingly
          const fileOptions = { source: file.buffer, filename: file.originalname };
          if (file.mimetype.startsWith('image/')) {
            await bot.telegram.sendPhoto(user.telegram_id, fileOptions, { caption: message, parse_mode: "HTML" });
          } else if (file.mimetype.startsWith('video/')) {
            await bot.telegram.sendVideo(user.telegram_id, fileOptions, { caption: message, parse_mode: "HTML" });
          } else if (file.mimetype.startsWith('audio/')) {
            await bot.telegram.sendAudio(user.telegram_id, fileOptions, { caption: message, parse_mode: "HTML" });
          } else {
            await bot.telegram.sendDocument(user.telegram_id, fileOptions, { caption: message, parse_mode: "HTML" });
          }
        } else {
          // Text only
          await bot.telegram.sendMessage(user.telegram_id, `📢 <b>E'lon / Announcement:</b>\n\n${message}`, { parse_mode: "HTML" });
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${user.telegram_id}:`, err.message);
        failCount++;
      }
    }
    
    res.json({ success: true, successCount, failCount });
  } catch (err) {
    console.error("Broadcast Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ping route for UptimeRobot (Keep-Alive)
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Start Server
async function startServer() {
  try {
    // Initialize Database
    await dbService.initDb();
    
    app.listen(PORT, () => {
      console.log(`📊 Admin Panel running at http://localhost:${PORT}`);
      console.log(`📡 Keep-alive route: http://localhost:${PORT}/ping`);
    });

    // Start the Telegram Bot alongside the server
    require("./bot");
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
