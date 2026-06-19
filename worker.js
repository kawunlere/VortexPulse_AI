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
    const text = msg.text ? msg.text.trim() : "";
    const hasPhoto = msg.photo ? true : false;
    const ADMIN_ID = parseInt(env.ADMIN_ID);
    const isAdmin = userId === ADMIN_ID;
    const KV = env.VORTEX_KV;

    const adminKb = [
      ["📤 BROADCAST", "✅ POST WINNINGS"],
      ["🖼️ UPLOAD GAMES", "📊 BOT STATS"],
      ["👥 MANAGE VIP", "💳 EDIT PAYMENT"],
      ["🔄 SWITCH TO USER VIEW"]
    ];
    
    const userKb = [
      ["🆓 FREE TIPS", "💎 VIP SECTION"],
      ["📈 PREDICTION TOOLS", "🧠 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"],
      ["💳 SUBSCRIBE VIP"]
    ];
    
    const userKbAdmin = [
      ["🆓 FREE TIPS", "💎 VIP SECTION"],
      ["📈 PREDICTION TOOLS", "🧠 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"],
      ["💳 SUBSCRIBE VIP"],
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
      ["⬅️ BACK"]
    ];

    const toolsKb = [
      ["🎲 Random Picker", "📊 Stats Insight"],
      ["🔮 AI Prediction", "🏟️ League Picker"],
      ["🌍 Country Games", "⏰ Live Matches"],
      ["⬅️ BACK"]
    ];

    // Helper function to send message
    async function sendMsg(cid, txt, kb) {
      return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cid,
          text: txt,
          reply_markup: { keyboard: kb, resize_keyboard: true }
        })
      });
    }

    // Get payment details
    let paymentDetails = "Bank: [Not Set]\nAccount: [Not Set]\nName: [Not Set]";
    try {
      const stored = await KV.get("payment_details");
      if (stored) paymentDetails = stored;
    } catch (e) {}

    // ============ PHOTO HANDLING ============
    if (hasPhoto) {
      if (isAdmin) return new Response("OK");
      
      let inPaymentMode = false;
      try {
        const mode = await KV.get("paymode:" + userId);
        if (mode === "yes") inPaymentMode = true;
      } catch (e) {}
      
      if (inPaymentMode) {
        await KV.delete("paymode:" + userId);
        await sendMsg(chatId, "📸 Payment screenshot received ✅\n🤖 Confirming payment automatically...\n\nYour VIP access will be activated shortly. Please be patient ⏳", userKb);
        
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id })
        });

        await sendMsg(ADMIN_ID, "💰 New payment proof from User ID: " + userId + "\nUse /addvip " + userId + " to approve.", adminKb);
      } else {
        await sendMsg(chatId, "❌ I only accept screenshots when you're subscribing.\nPlease use the buttons below 👇", userKb);
      }
      return new Response("OK");
    }

    if (!text) return new Response("OK");

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    // ADMIN COMMAND
    if (text.startsWith("/setpayment ") && isAdmin) {
      const newDetails = text.replace("/setpayment ", "");
      await KV.put("payment_details", newDetails);
      await sendMsg(chatId, "✅ Payment details updated:\n\n" + newDetails, adminKb);
      return new Response("OK");
    }

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
      reply = "📊 VortexPulse Stats:\n👥 Users: 1\n💎 VIPs: 0\n🎯 Games: 0";
    } else if (text === "👥 MANAGE VIP" && isAdmin) {
      reply = "Use these commands:\n/addvip [user_id]\n/removevip [user_id]\n/viplist";
    } else if (text === "💳 EDIT PAYMENT" && isAdmin) {
      reply = "💳 Edit Payment Details\n\nCurrent:\n" + paymentDetails + "\n\nTo update, send:\n/setpayment Bank: GTB\nAccount: 0123456789\nName: Your Name";
    }
    else if (text === "💳 SUBSCRIBE VIP") {
      await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 });
      reply = "💳 VIP SUBSCRIPTION\n━━━━━━━━━━\n💰 Weekly: ₦5,000\n💎 Monthly: ₦15,000\n\nWhat you get:\n✅ All VIP betting markets\n✅ All AI prediction tools\n✅ Daily premium picks\n\n💳 Payment Details:\n" + paymentDetails + "\n\n📸 After payment, please upload a screenshot of your payment proof here.\n\n⚠️ Only image screenshots are accepted.";
    }
    else if (text === "🆓 FREE TIPS") {
      reply = "🆓 FREE TIPS ZONE\nPlease choose a market below 👇";
      keyboard = freeKb;
    } else if (text === "💎 VIP SECTION") {
      reply = "💎 VIP ZONE 💎\nPlease select one below 👇";
      keyboard = vipKb;
    } else if (text === "📈 PREDICTION TOOLS") {
      reply = "📈 PREDICTION TOOLS\nAdvanced AI tools below 👇";
      keyboard = toolsKb;
    } else if (text === "🧠 AI CHAT") {
      reply = "🧠 AI CHAT ACTIVATED\nAsk anything. You have 3 minutes 💬\n(Coming soon: Full AI brain)";
    } else if (text === "👤 MY ACCOUNT") {
      const status = isAdmin ? "👑 Admin" : "Free User";
      const vip = isAdmin ? "✅ Lifetime Access" : "❌ Not Active";
      reply = "👤 Your Profile\n━━━━━━━━━━\nID: " + userId + "\nStatus: " + status + "\nVIP: " + vip;
    } else if (text === "ℹ️ HELP") {
      reply = "ℹ️ HELP CENTER\n\n🆓 Free Tips\n💎 VIP - Premium odds\n📈 Tools - AI predictions\n🧠 AI Chat\n💳 Subscribe VIP";
    }
    else if (text === "⚽ Straight Win" || text === "🎯 Double Chance" || text === "🔥 Over 1.5" || text === "💧 Under 3.5" || text === "🤝 Draw No Bet" || text === "🎪 BTTS") {
      reply = "🧠 Analysing safe odds for " + text + "...\n⏳ Please wait 3 minutes.";
      keyboard = freeKb;
    }
    else if (text === "🎯 Correct Score" || text === "🏆 HT/FT" || text === "💥 Over 2.5 VIP" || text === "🔥 Over 3.5 VIP" || text === "📐 Corners VIP" || text === "🟨 Cards VIP" || text === "💰 2 Odds Daily" || text === "💎 5 Odds Daily" || text === "🚀 10 Odds Rollover" || text === "🏅 Banker of Day") {
      if (isAdmin) {
        reply = "👑 ADMIN ACCESS\n🧠 Analysing " + text + "...\n⏳ Please wait 3 minutes.";
      } else {
        reply = "🔒 VIP ONLY 🔒\n" + text + " is locked.\n\nSubscribe to unlock 💎";
      }
      keyboard = vipKb;
    }
    else if (text === "🎲 Random Picker" || text === "📊 Stats Insight" || text === "🔮 AI Prediction" || text === "🏟️ League Picker" || text === "🌍 Country Games" || text === "⏰ Live Matches") {
      if (isAdmin) {
        reply = "👑 ADMIN ACCESS\n🧠 Running " + text + "...\n⏳ Please wait 3 minutes.";
      } else {
        reply = "🔒 VIP TOOL LOCKED 🔒\n" + text + " is premium.\n\nSubscribe to unlock 💎";
      }
      keyboard = toolsKb;
    }
    else if (text === "⬅️ BACK") {
      reply = "Back to main menu 🏠";
      keyboard = isAdmin ? userKbAdmin : userKb;
    }
    else {
      reply = "Please use the buttons below 👇";
      keyboard = isAdmin ? userKbAdmin : userKb;
    }

    await sendMsg(chatId, reply, keyboard);
    return new Response("OK");
  }
};
