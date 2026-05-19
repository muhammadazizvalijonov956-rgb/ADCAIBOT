const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

/**
 * Gemini AI Service for ADC Bot
 * Handles all interactions with Google Gemini API
 */
class GeminiService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Using Gemini 2.5 Flash for faster responses
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  /**
   * Generate response from Gemini based on prompt and knowledge base
   * @param {string} userMessage - The user's message
   * @param {string} knowledgeBase - ADC knowledge base content
   * @param {Array} conversationHistory - Recent conversation messages for context
   * @param {string} userLanguage - User's explicitly chosen language preference
   * @returns {Promise<string>} - AI-generated response
   */
  async generateResponse(userMessage, knowledgeBase, conversationHistory = [], userLanguage = 'uz') {
    let lastError;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build the conversation context
        let context = "";

        // Add recent conversation history (last 3 exchanges)
        if (conversationHistory.length > 0) {
          context += "Recent conversation context:\n";
          conversationHistory.slice(-3).forEach((msg, index) => {
            context += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
          });
          context += "\n";
        }

        // Construct the full prompt
        const prompt = `
You are an official AI assistant of Andijan Development Center (ADC).

Your responsibilities:
- Help students professionally
- Speak naturally like a human manager
- Be polite and friendly
- ALWAYS answer in the user's preferred language: ${userLanguage.toUpperCase()}
- If the user explicitly asks a question in another language, you may adapt, but default to ${userLanguage.toUpperCase()}.

Rules:
- NEVER use Markdown like **bold** or __italic__.
- NEVER use complex HTML like <ul>, <li>, <div>, or <p>.
- ONLY use <b>text</b> for bold and <i>text</i> for italic.
- For lists, use simple dashes "-" or bullets "•" as plain text.
- MUST respond in the language: ${userLanguage.toUpperCase()}.
- Keep responses clean and readable.
- Encourage registration politely.
- Only use provided ADC information.

KNOWLEDGE BASE:
${knowledgeBase}

${context}Current user message: ${userMessage}

Please respond as ADC's AI assistant following all the guidelines above.`;

        // Determine which model to use (Fallback to 2.0 on last attempt)
        let modelToUse = this.model;
        if (attempt === maxRetries) {
          console.log("🔄 Switching to fallback model (gemini-2.0-flash)...");
          modelToUse = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        }

        const result = await modelToUse.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        // Check if error is 503 (Service Unavailable) or 429 (Rate Limit)
        const isRetryable = error.message.includes("503") ||
          error.message.includes("Service Unavailable") ||
          error.message.includes("429") ||
          error.message.includes("Too Many Requests");

        if (isRetryable && attempt < maxRetries) {
          const delay = retryDelay * attempt;
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
    }

    // Fallback response if all retries fail
    console.error("All Gemini API attempts failed:", lastError.message);
    return "I apologize, but I'm experiencing technical difficulties due to high demand. Please try again in a moment or contact ADC administrator for assistance.";
  }
}

module.exports = new GeminiService();