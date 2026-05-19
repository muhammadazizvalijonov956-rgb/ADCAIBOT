# ADC AI Bot - Andijan Development Center Telegram Assistant

A production-ready AI-powered Telegram bot for Andijan Development Center (ADC) that acts as a virtual support manager, providing information about courses, prices, schedules, and more in multiple languages.

## Features

- 🤖 **AI-Powered Responses**: Uses Google Gemini API for natural, human-like conversations
- 🌍 **Multilingual Support**: Automatically detects and responds in the user's language (Uzbek, Russian, English, Turkish, Arabic, and more)
- 📚 **Knowledge Base**: Utilizes ADC's internal information for accurate responses
- 💬 **Context Awareness**: Remembers conversation flow for better understanding
- ⚡ **Real-time Typing**: Shows typing indicator before responses
- 🛡️ **Error Handling**: Graceful fallbacks and error recovery
- ⏱️ **Anti-spam Protection**: Basic cooldown to prevent abuse
- 🔐 **Secure**: API keys stored in environment variables
- 📱 **24/7 Availability**: Designed to run continuously

## Tech Stack

- **Node.js** - JavaScript runtime
- **Telegraf** - Telegram Bot API framework
- **Google Gemini API** - AI language model
- **dotenv** - Environment variable management
- **fs** - File system for knowledge base

## Project Structure

```
adc-ai-bot/
│
├── bot.js                 # Main bot file
├── package.json           # Project dependencies and scripts
├── .env.example           # Environment variables template
├── knowledge/
│   └── adc_data.txt       # ADC knowledge base
├── services/
│   └── gemini.js          # Gemini AI service
├── utils/
│   └── systemPrompt.js    # System prompt definition
└── README.md              # This file
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- Telegram Bot Token (from @BotFather)
- Google Gemini API Key (from Google AI Studio)

### Step-by-Step Setup

1. **Clone or create the project directory**
   ```bash
   mkdir adc-ai-bot && cd adc-ai-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Edit `.env` and add your credentials:
     ```
     BOT_TOKEN=your_telegram_bot_token_here
     GEMINI_API_KEY=your_google_ai_studio_key_here
     ```

4. **Verify knowledge base**
   - Ensure `knowledge/adc_data.txt` exists with ADC information
   - You can customize this file with your actual ADC data

## How to Get API Keys

### Telegram Bot Token
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. You'll receive a token like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`
4. Save this token as `BOT_TOKEN` in your `.env` file

### Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key
5. Save this key as `GEMINI_API_KEY` in your `.env` file

## Running the Bot

### Development Mode
```bash
npm run dev
```
*Uses nodemon for automatic restart during development*

### Production Mode
```bash
npm start
```
*Runs the bot directly with Node.js*

### Running as a Service (for VPS deployment)
You can use PM2 to keep the bot running:
```bash
npm install -g pm2
pm2 start bot.js --name adc-ai-bot
pm2 save
pm2 startup
```

## Deployment Options

### VPS Deployment (Recommended for Production)

1. **Upload your files** to your VPS
2. **Install Node.js** if not present:
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # CentOS/RHEL
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   ```

3. **Install dependencies**:
   ```bash
   cd adc-ai-bot
   npm install
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   nano .env  # Add your tokens
   ```

5. **Start with PM2**:
   ```bash
   npm install -g pm2
   pm2 start bot.js --name adc-ai-bot
   pm2 save
   pm2 startup
   ```

6. **Monitor logs**:
   ```bash
   pm2 logs adc-ai-bot
   ```

### Deploy to Render.com

1. **Create a new Web Service**
2. **Connect your GitHub repository**
3. **Set build command**: `npm install`
4. **Set start command**: `npm start`
5. **Add environment variables** in the Render dashboard:
   - `BOT_TOKEN`: your_telegram_bot_token
   - `GEMINI_API_KEY`: your_google_ai_studio_key
6. **Deploy!**

### Deploy to Vercel

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Login**: `vercel login`
3. **Initialize**: `vercel` (in project directory)
4. **Set environment variables** in Vercel dashboard
5. **Deploy**: `vercel --prod`

## Usage

Once the bot is running:
1. Search for your bot on Telegram (by username)
2. Send `/start` to begin
3. Ask any questions about ADC courses, prices, schedules, etc.
4. The bot will respond in the same language you used

## Customization

### Updating Knowledge Base
Edit `knowledge/adc_data.txt` to update course information, prices, schedules, etc.

### Adjusting AI Behavior
Modify `utils/systemPrompt.js` to change the bot's personality or rules.

### Changing AI Model
In `services/gemini.js`, you can switch between Gemini models:
- `gemini-1.5-flash` (faster, cost-effective)
- `gemini-1.5-pro` (more capable, higher cost)

### Language Support
The bot automatically handles language detection through the Gemini API. No additional configuration needed.

## Anti-spam Features

The bot includes basic anti-spam protection:
- 3-second cooldown between messages from the same user
- Conversation history limited to last 10 messages
- Automatic cleanup of conversations older than 1 hour

## Error Handling

- Graceful fallbacks when AI service fails
- Informative error messages for users
- Detailed logging for administrators
- Automatic recovery from transient errors

## Future Improvements

1. **Database Integration**: Replace file-based knowledge with a database for easier updates
2. **Admin Panel**: Web interface to manage courses, prices, and bot responses
3. **Analytics**: Track user interactions and popular queries
4. **Multi-bot Support**: Handle multiple ADC branches with different knowledge bases
5. **Voice Messages**: Add support for voice message transcription and response
6. **Appointment Scheduling**: Allow users to book consultations or trial classes
7. **Payment Integration**: Enable course payments through the bot

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check if `.env` file exists with correct tokens
   - Verify bot is running: `ps aux | grep node`
   - Check logs: `pm2 logs adc-ai-bot` (if using PM2)

2. **AI responses seem off**
   - Verify `knowledge/adc_data.txt` contains correct information
   - Check Gemini API key validity
   - Ensure internet connectivity

3. **Telegram API errors**
   - Verify bot token is correct
   - Check if bot was blocked or deleted
   - Ensure webhook isn't conflicting (if previously set)

### Getting Help

Check the logs for detailed error messages:
```bash
# If running directly
npm start

# If using PM2
pm2 logs adc-ai-bot
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Telegraf](https://telegraf.js.org/) for the excellent Telegram framework
- [Google Gemini API](https://ai.google.dev/) for powerful AI capabilities
- Andijan Development Center for providing the knowledge base and use case

---

**Ready to help ADC students 24/7!** 🎓💬

For support or questions about deployment, please contact the ADC technical team.