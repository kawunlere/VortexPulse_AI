import os
from dotenv import load_dotenv
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes

load_dotenv()
ADMIN_ID = int(os.getenv("ADMIN_ID"))

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
    if user_id == ADMIN_ID:
        msg = "VortexPulse Admin active. Wetin we dey do today, Boss? 👑"
        # Admin special buttons
        kb = [['📤 BROADCAST', '✅ POST WINNINGS'], ['🖼️ UPLOAD GAMES', '📊 BOT STATS']]
    else:
        msg = "VortexPulse AI 🚀\nAbeg wait, I dey scan market for safe games!"
        # Normal user buttons
        kb = [['🆓 FREE TIPS', '💎 VIP SECTION'], ['📈 PREDICTION TOOLS', '👤 MY ACCOUNT']]

    reply_markup = ReplyKeyboardMarkup(kb, resize_keyboard=True)
    await update.message.reply_text(msg, reply_markup=reply_markup)

def main():
    token = os.getenv("BOT_TOKEN")
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    print("VortexPulse_AI standing by...")
    app.run_polling()

if __name__ == "__main__":
    main()
