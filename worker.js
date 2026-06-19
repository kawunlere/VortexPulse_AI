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

    // KEYBOARDS
    const adminKb = [
      ["📤 BROADCAST", "✅ POST WINNINGS"],
      ["🖼️ UPLOAD GAMES", "📊 BOT STATS"],
      ["👥 MANAGE VIP", "🔄 SWITCH TO USER VIEW"]
    ];
    
    const userKb = [
      ["🆓 FREE TIPS", "💎 VIP SECTION"],
      ["📈 PREDICTION TOOLS", "🧠 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"]
    ];
    
    const userKbAdmin = [
      ["🆓 FREE TIPS", "💎 VIP SECTION"],
      ["📈 PREDICTION TOOLS", "🧠 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"],
      ["🔙 BACK TO ADMIN"]
    ];

    const freeKb = [
      ["⚽ Straight Win", "🎯 Double Chance"],
      ["🔥 Over 1.5", "💧 Under 3.5"],
      ["🤝 Draw No Bet", "🎪 BTTS"],
      ["⬅️ BACK"]
    ];

    const vipKb = [
      ["🎯 Correct Score", "🏆 HT/FT"],
      ["💥 Over 2.5 VIP", "🔥 Over 3.5 VIP"],
      ["📐 Corners VIP", "🟨 Cards VIP"],
      ["💰 2 Odds Daily", "💎 5 Odds Daily"],
      ["🚀 10 Odds Rollover", "🏅 Banker of Day"],
      ["💳 Subscribe VIP", "⬅️ BACK"]
    ];

    const toolsKb = [
      ["🎲 Random Picker", "📊 Stats Insight"],
      ["🔮 AI Prediction", "🏟️ League Picker"],
      ["🌍 Country Games", "⏰ Live Matches"],
      ["⬅️ BACK"]
    ];

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    // ============ START ============
    if (text === "/start") {
      reply = isAdmin
        ? "Welcome Boss 👑\nVortexPulse Admin active. Wetin we dey do today?"
        : "VortexPulse AI 🚀\nWelcome my Oga! I dey scan market for safe games. Pick option below 👇";
    }
    // ============ ADMIN ============
    else if (text === "🔄 SWITCH TO USER VIEW" && isAdmin) {
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
      reply = "📊 VortexPulse Stats:\n👥 Users: 1\n💎 VIPs: 0\n🎯 Games: 0\n📈 Win Rate: 0%";
    } else if (text === "👥 MANAGE VIP" && isAdmin) {
      reply = "Use these commands:\n/addvip [user_id] - Add VIP\n/removevip [user_id] - Remove VIP\n/viplist - See all VIPs";
    }
    // ============ MAIN MENU ============
    else if (text === "🆓 FREE TIPS") {
      reply = "🆓 FREE TIPS ZONE\nChoose your market 👇";
      keyboard = freeKb;
    } else if (text === "💎 VIP SECTION") {
      reply = "💎 VIP ZONE 💎\nBig odds only for VIPs! Subscribe to unlock all 👇";
      keyboard = vipKb;
    } else if (text === "📈 PREDICTION TOOLS") {
      reply = "📈 PREDICTION TOOLS\nAI-powered tools below 👇";
      keyboard = toolsKb;
    } else if (text === "🧠 AI CHAT") {
      reply = "🧠 AI CHAT ACTIVATED\nOya talk to me my Oga! Ask anything about betting, football, or life. You get 3 minutes 💬\n\n(Coming soon: Real AI brain)";
    } else if (text === "👤 MY ACCOUNT") {
      reply = "👤 Your Profile\n━━━━━━━━━━\nID: " + userId + "\nStatus: Free User\nVIP: ❌ Not Active\nJoined: Today";
    } else if (text === "ℹ️ HELP") {
      reply = "ℹ️ HELP CENTER\n\n🆓 Free Tips - Simple safe games\n💎 VIP - Big odds (paid)\n📈 Tools - AI predictions\n🧠 AI Chat - Talk to bot\n\nAny issue? Message the Boss.";
    }
    // ============ FREE TIPS ============
    else if (text === "⚽ Straight Win" || text === "🎯 Double Chance" || text === "🔥 Over 1.5" || text === "💧 Under 3.5" || text === "🤝 Draw No Bet" || text === "🎪 BTTS") {
      reply = "🧠 Analysing safe odds for " + text + "...\n⏳ Abeg hold on 3 minutes, my AI brain dey scan all bookmakers!\n\n(Come back shortly for your sure pick 🎯)";
      keyboard = freeKb;
    }
    // ============ VIP TIPS ============
    else if (text === "🎯 Correct Score" || text === "🏆 HT/FT" || text === "💥 Over 2.5 VIP" || text === "🔥 Over 3.5 VIP" || text === "📐 Corners VIP" || text === "🟨 Cards VIP" || text === "💰 2 Odds Daily" || text === "💎 5 Odds Daily" || text === "🚀 10 Odds Rollover" || text === "🏅 Banker of Day") {
      reply = "🔒 VIP ONLY 🔒\n" + text + " is locked.\n\nSubscribe to unlock big big odds! 💎\nClick 💳 Subscribe VIP below.";
      keyboard = vipKb;
    } else if (text === "💳 Subscribe VIP") {
      reply = "💳 VIP SUBSCRIPTION\n━━━━━━━━━━\n💰 Weekly: ₦5,000\n💎 Monthly: ₦15,000\n\n💳 Pay to:\nBank: [Your Bank]\nAccount: [Your Account]\nName: [Your Name]\n\n📸 After payment, send screenshot to Boss for approval.";
    }
    // ============ TOOLS ============
    else if (text === "🎲 Random Picker") {
      reply = "🎲 Random Game Picker\n🧠 Generating random safe pick...\n⏳ Wait 3 mins for result.";
    } else if (text === "📊 Stats Insight") {
      reply = "📊 Stats Insight\n🧠 Analysing head-to-head data...\n⏳ Wait 3 mins.";
    } else if (text === "🔮 AI Prediction") {
      reply = "🔮 AI Prediction\n🧠 Deep AI analysis running...\n⏳ Wait 3 mins for your prediction.";
    } else if (text === "🏟️ League Picker") {
      reply = "🏟️ Choose your league:\n• Premier League\n• La Liga\n• Serie A\n• Bundesliga\n• Champions League\n\n(Type the league name)";
    } else if (text === "🌍 Country Games") {
      reply = "🌍 Choose country:\n• England 🏴\n• Spain 🇪🇸\n• Italy 🇮🇹\n• Germany 🇩🇪\n• Nigeria 🇳🇬\n\n(Type the country name)";
    } else if (text === "⏰ Live Matches") {
      reply = "⏰ Live Matches\n🧠 Scanning live games now...\n⏳ Wait 3 mins.";
    }
    // ============ BACK ============
    else if (text === "⬅️ BACK") {
      reply = "Back to main menu 🏠";
      keyboard = isAdmin ? userKbAdmin : userKb;
    }
    else {
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
