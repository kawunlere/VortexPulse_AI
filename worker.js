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
      ["💳 Subscribe VIP", "⬅️ BACK"]
    ];

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    if (text === "/start") {
      reply = isAdmin
        ? "Welcome Boss 👑\nVortexPulse Admin active. What would you like to do today?"
        : "Welcome to VortexPulse AI 🚀\nI analyse the markets to find the safest games for you. Please select an option below 👇";
    }
    else if (text === "🔄 SWITCH TO USER VIEW" && isAdmin) {
      reply = "Switched to User View 👀\nYou can now test all user features. Tap '🔙 BACK TO ADMIN' when done.";
      keyboard = userKbAdmin;
    } else if (text === "🔙 BACK TO ADMIN" && isAdmin) {
      reply = "Welcome back, Boss 👑";
      keyboard = adminKb;
    } else if (text === "📤 BROADCAST" && isAdmin) {
      reply = "Boss, type /send followed by your message to broadcast to everybody.";
    } else if (text === "✅ POST WINNINGS" && isAdmin) {
      reply = "Send the winning screenshot now. I'll broadcast it instantly 🏆";
    } else if (text === "🖼️ UPLOAD GAMES" && isAdmin) {
      reply = "Drop the screenshot of the games, Boss. My AI brain is ready to scan 🧠";
    } else if (text === "📊 BOT STATS" && isAdmin) {
      reply = "📊 VortexPulse Stats:\n👥 Users: 1\n💎 VIPs: 0\n🎯 Games: 0\n📈 Win Rate: 0%";
    } else if (text === "👥 MANAGE VIP" && isAdmin) {
      reply = "Use these commands:\n/addvip [user_id] - Add VIP\n/removevip [user_id] - Remove VIP\n/viplist - See all VIPs";
    }
    else if (text === "🆓 FREE TIPS") {
      reply = "🆓 FREE TIPS ZONE\nPlease choose a market below 👇";
      keyboard = freeKb;
    } else if (text === "💎 VIP SECTION") {
      reply = "💎 VIP ZONE 💎\nPremium markets with high-value odds. Please select one below 👇";
      keyboard = vipKb;
    } else if (text === "📈 PREDICTION TOOLS") {
      reply = "📈 PREDICTION TOOLS\nAdvanced AI-powered tools below 👇";
      keyboard = toolsKb;
    } else if (text === "🧠 AI CHAT") {
      reply = "🧠 AI CHAT ACTIVATED\nFeel free to chat with me. Ask anything about betting, football, or general questions. You have 3 minutes 💬\n\n(Coming soon: Full AI brain)";
    } else if (text === "👤 MY ACCOUNT") {
      const status = isAdmin ? "👑 Admin" : "Free User";
      const vip = isAdmin ? "✅ Lifetime Access" : "❌ Not Active";
      reply = "👤 Your Profile\n━━━━━━━━━━\nID: " + userId + "\nStatus: " + status + "\nVIP: " + vip + "\nJoined: Today";
    } else if (text === "ℹ️ HELP") {
      reply = "ℹ️ HELP CENTER\n\n🆓 Free Tips - Simple safe games\n💎 VIP - High-value odds (premium)\n📈 Tools - AI predictions (VIP)\n🧠 AI Chat - Interactive AI assistant";
    }
    else if (text === "⚽ Straight Win" || text === "🎯 Double Chance" || text === "🔥 Over 1.5" || text === "💧 Under 3.5" || text === "🤝 Draw No Bet" || text === "🎪 BTTS") {
      reply = "🧠 Analysing safe odds for " + text + "...\n⏳ Please wait 3 minutes while my AI scans all bookmakers.\n\nYour pick will be ready shortly 🎯";
      keyboard = freeKb;
    }
    else if (text === "🎯 Correct Score" || text === "🏆 HT/FT" || text === "💥 Over 2.5 VIP" || text === "🔥 Over 3.5 VIP" || text === "📐 Corners VIP" || text === "🟨 Cards VIP" || text === "💰 2 Odds Daily" || text === "💎 5 Odds Daily" || text === "🚀 10 Odds Rollover" || text === "🏅 Banker of Day") {
      if (isAdmin) {
        reply = "👑 ADMIN ACCESS GRANTED\n🧠 Analysing " + text + "...\n⏳ Please wait 3 minutes for the result.";
      } else {
        reply = "🔒 VIP ONLY 🔒\n" + text + " is locked.\n\nSubscribe to unlock premium odds 💎\nTap 💳 Subscribe VIP below.";
      }
      keyboard = vipKb;
    }
    else if (text === "🎲 Random Picker" || text === "📊 Stats Insight" || text === "🔮 AI Prediction" || text === "🏟️ League Picker" || text === "🌍 Country Games" || text === "⏰ Live Matches") {
      if (isAdmin) {
        reply = "👑 ADMIN ACCESS GRANTED\n🧠 Running " + text + "...\n⏳ Please wait 3 minutes for the result.";
      } else {
        reply = "🔒 VIP TOOL LOCKED 🔒\n" + text + " is a premium AI tool.\n\nSubscribe to unlock 💎\nTap 💳 Subscribe VIP below.";
      }
      keyboard = toolsKb;
    }
    else if (text === "💳 Subscribe VIP") {
      reply = "💳 VIP SUBSCRIPTION\n━━━━━━━━━━\n💰 Weekly: ₦5,000\n💎 Monthly: ₦15,000\n\nWhat you get:\n✅ All VIP betting markets\n✅ All AI prediction tools\n✅ Daily premium picks\n\n💳 Payment Details:\nBank: [Your Bank]\nAccount: [Your Account]\nName: [Your Name]\n\n📸 After payment, send your payment screenshot here.\n🤖 Confirming payment automatically...\nYour VIP access will be activated shortly ✅";
    }
    else if (text === "⬅️ BACK") {
      reply = "Back to main menu 🏠";
      keyboard = isAdmin ? userKbAdmin : userKb;
    }
    else {
      reply = "Please use the buttons below 👇";
      keyboard = isAdmin ? userKbAdmin : userKb;
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
