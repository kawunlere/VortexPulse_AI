export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("VortexPulse AI is alive 🚀");
    }

    const update = await request.json();
    const msg = update.message;
    if (!msg || !msg.text) return new Response("OK");

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    const ADMIN_ID = parseInt(env.ADMIN_ID);
    const isAdmin = userId === ADMIN_ID;

    // Track admin view mode using KV would be ideal, but for now we use simple toggle
    const adminKb = [["📤 BROADCAST", "✅ POST WINNINGS"], ["🖼️ UPLOAD GAMES", "📊 BOT STATS"], ["🔄 SWITCH TO USER VIEW"]];
    const userKb = [["🆓 FREE TIPS", "💎 VIP SECTION"], ["📈 PREDICTION TOOLS", "👤 MY ACCOUNT"]];
    const userKbAdmin = [["🆓 FREE TIPS", "💎 VIP SECTION"], ["📈 PREDICTION TOOLS", "👤 MY ACCOUNT"], ["🔙 BACK TO ADMIN"]];

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    if (text === "/start") {
      reply = isAdmin
        ? "Welcome Boss 👑\nVortexPulse Admin active. Wetin we dey do today?"
        : "VortexPulse AI 🚀\nAbeg wait, I dey scan market for safe games!";
    } else if (text === "🔄 SWITCH TO USER VIEW" && isAdmin) {
      reply = "Boss, you don switch to User View 👀\nTest everything wey users go see.";
      keyboard = userKbAdmin;
    } else if (text === "🔙 BACK TO ADMIN" && isAdmin) {
      reply = "Welcome back Boss 👑";
      keyboard = adminKb;
    } else if (text === "📤 BROADCAST" && isAdmin) {
      reply = "Boss, type /send followed by your message to broadcast to everybody.";
    } else if (text === "✅ POST WINNINGS" && isAdmin) {
      reply = "Send the winning screenshot now, I go broadcast am sharp sharp! 🏆";
    } else if (text === "🖼️ UPLOAD GAMES" && isAdmin) {
      reply = "Boss, drop the screenshot of the games. My AI brain dey ready to scan! 🧠";
    } else if (text === "📊 BOT STATS" && isAdmin) {
      reply = "📊 VortexPulse Stats:\n👥 Users: 1\n💎 VIPs: 0\n🎯 Games: 0";
    } else if (text === "🆓 FREE TIPS") {
      reply = "Choose your free tip category 👇";
      keyboard = [["⚽ Straight Win", "🎯 Double Chance"], ["🔥 Over 1.5", "⬅️ BACK"]];
    } else if (text === "💎 VIP SECTION") {
      reply = "💎 VIP ZONE 💎\nOga, VIP get big big odds! Subscribe to unlock.";
      keyboard = [["💳 Subscribe VIP", "🏆 VIP Games"], ["⬅️ BACK"]];
    } else if (text === "📈 PREDICTION TOOLS") {
      reply = "Pick your tool 👇";
      keyboard = [["🎯 Correct Score", "📐 Corners"], ["💰 2 Odds", "⬅️ BACK"]];
    } else if (text === "👤 MY ACCOUNT") {
      reply = "👤 Your Profile\nID: " + userId + "\nStatus: Free User";
    } else if (text === "⬅️ BACK") {
      reply = "Back to main menu 🏠";
      keyboard = isAdmin ? userKbAdmin : userKb;
    } else if (text === "⚽ Straight Win" || text === "🎯 Double Chance" || text === "🔥 Over 1.5" || text === "🎯 Correct Score" || text === "📐 Corners" || text === "💰 2 Odds") {
      reply = "🧠 Analysing safe odds...\nAbeg hold on 3 minutes, my AI brain dey work! ⏳";
    } else if (text === "💳 Subscribe VIP") {
      reply = "💳 VIP Subscription\n\n💰 Weekly: ₦5,000\n\nPay to:\nBank: [Your Bank]\nAccount: [Your Account]\n\nAfter payment, send screenshot to Boss for approval.";
    } else if (text === "🏆 VIP Games") {
      reply = "🔒 VIP games are locked.\nSubscribe to unlock big big odds! 💎";
    } else {
      reply = "Abeg use the buttons below 👇";
    }

    await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
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
