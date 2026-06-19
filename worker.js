export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("VortexPulse AI is alive 🚀");
    }

    const update = await request.json();
    const msg = update.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || "";
    const ADMIN_ID = parseInt(env.ADMIN_ID);

    let reply = "";
    let keyboard = [];

    if (text === "/start") {
      if (userId === ADMIN_ID) {
        reply = "Welcome Boss 👑\nVortexPulse Admin active. Wetin we dey do today?";
        keyboard = [['📤 BROADCAST', '✅ POST WINNINGS'], ['🖼️ UPLOAD GAMES', '📊 BOT STATS']];
      } else {
        reply = "VortexPulse AI 🚀\nAbeg wait, I dey scan market for safe games!";
        keyboard = [['🆓 FREE TIPS', '💎 VIP SECTION'], ['📈 PREDICTION TOOLS', '👤 MY ACCOUNT']];
      }
    }

    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
        reply_markup: { keyboard: keyboard, resize_keyboard: true }
      })
    });

    return new Response("OK");
  }
};
