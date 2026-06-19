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

    const freeKb = [["⚽ Straight Win", "🎯 Double Chance"], ["🔥 Over 1.5", "💧 Under 3.5"], ["🤝 Draw No Bet", "🎪 BTTS"], ["⬅️ BACK"]];
    const vipKb = [["🎯 Correct Score", "🏆 HT/FT"], ["💥 Over 2.5 VIP", "🔥 Over 3.5 VIP"], ["📐 Corners VIP", "🟨 Cards VIP"], ["💰 2 Odds Daily", "💎 5 Odds Daily"], ["🚀 10 Odds Rollover", "🏅 Banker of Day"], ["⬅️ BACK"]];
    const toolsKb = [["🎲 Random Picker", "📊 Stats Insight"], ["🔮 AI Prediction", "🏟️ League Picker"], ["🌍 Country Games", "⏰ Live Matches"], ["⬅️ BACK"]];
    const chatExitKb = [["🚪 EXIT AI CHAT"]];

    async function sendMsg(cid, txt, kb) {
      return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: { keyboard: kb, resize_keyboard: true } })
      });
    }

    // Call Groq AI
    async function askGroq(prompt) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + env.GROQ_KEY
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are VortexPulse AI, a smart and friendly Nigerian betting assistant. Reply in mostly polite English with a slight Naija vibe occasionally. Be brief, helpful, confident, and engaging. Keep responses under 100 words." },
              { role: "user", content: prompt }
            ],
            temperature: 0.8
          })
        });
        const data = await res.json();
        if (data.choices && data.choices[0]) {
          return data.choices[0].message.content;
        }
        return "My brain is loading. Try again in a moment 🧠";
      } catch (e) {
        return "Connection issue. Please try again 🔄";
      }
    }

    async function isVip(uid) {
      try {
        const expiry = await KV.get("vip:" + uid);
        if (!expiry) return false;
        return parseInt(expiry) > Date.now();
      } catch (e) { return false; }
    }

    let paymentDetails = "Bank: [Not Set]\nAccount: [Not Set]\nName: [Not Set]";
    try {
      const stored = await KV.get("payment_details");
      if (stored) paymentDetails = stored;
    } catch (e) {}

    const userIsVip = isAdmin ? true : await isVip(userId);

    // ============ PHOTO HANDLING ============
    if (hasPhoto) {
      if (isAdmin) {
        let adminMode = "";
        try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
        
        if (adminMode === "upload_games") {
          // Save image file_id to KV (we'll process with OCR later)
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          const timestamp = Date.now();
          await KV.put("game:" + timestamp, fileId, { expirationTtl: 86400 });
          await KV.delete("adminmode:" + userId);
          await sendMsg(chatId, "✅ Screenshot saved to brain!\n📸 Game stored successfully.\n\nUpload more or click any button to continue.", adminKb);
          return new Response("OK");
        }
        return new Response("OK");
      }
      
      let inPaymentMode = false;
      try {
        const mode = await KV.get("paymode:" + userId);
        if (mode === "yes") inPaymentMode = true;
      } catch (e) {}
      
      if (inPaymentMode) {
        await KV.delete("paymode:" + userId);
        await sendMsg(chatId, "📸 Payment screenshot received ✅\n🤖 Confirming payment automatically...\n\nYour VIP access will be activated shortly ⏳", userKb);
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id })
        });
        await sendMsg(ADMIN_ID, "💰 Payment proof from User ID: " + userId + "\n\nApprove:\n/addvip " + userId + " 7\n/addvip " + userId + " 30", adminKb);
      } else {
        await sendMsg(chatId, "❌ I only accept screenshots when you're subscribing.\nPlease use the buttons below 👇", userKb);
      }
      return new Response("OK");
    }

    if (!text) return new Response("OK");

    // ============ AI CHAT MODE ============
    let inChatMode = false;
    try {
      const cm = await KV.get("chatmode:" + userId);
      if (cm === "yes") inChatMode = true;
    } catch (e) {}

    if (inChatMode && text !== "🚪 EXIT AI CHAT") {
      const aiReply = await askGroq(text);
      await sendMsg(chatId, "🧠 " + aiReply, chatExitKb);
      return new Response("OK");
    }

    if (text === "🚪 EXIT AI CHAT") {
      await KV.delete("chatmode:" + userId);
      await sendMsg(chatId, "👋 AI Chat ended. Welcome back to main menu.", isAdmin ? userKbAdmin : userKb);
      return new Response("OK");
    }

    // ============ ADMIN COMMANDS ============
    if (isAdmin) {
      if (text.startsWith("/setpayment ")) {
        const newDetails = text.replace("/setpayment ", "");
        await KV.put("payment_details", newDetails);
        await sendMsg(chatId, "✅ Payment details updated:\n\n" + newDetails, adminKb);
        return new Response("OK");
      }
      if (text.startsWith("/addvip ")) {
        const parts = text.split(" ");
        const targetId = parts[1];
        const days = parts[2] ? parseInt(parts[2]) : 7;
        const expiry = Date.now() + (days * 24 * 60 * 60 * 1000);
        await KV.put("vip:" + targetId, expiry.toString(), { expirationTtl: days * 24 * 60 * 60 });
        await sendMsg(chatId, "✅ User " + targetId + " is now VIP for " + days + " days.", adminKb);
        await sendMsg(parseInt(targetId), "🎉 Your VIP access is now ACTIVE for " + days + " days 💎\nEnjoy all premium features!", userKb);
        return new Response("OK");
      }
      if (text.startsWith("/removevip ")) {
        const targetId = text.replace("/removevip ", "").trim();
        await KV.delete("vip:" + targetId);
        await sendMsg(chatId, "✅ VIP removed for user " + targetId, adminKb);
        return new Response("OK");
      }
      if (text === "/viplist") {
        try {
          const list = await KV.list({ prefix: "vip:" });
          let result = "💎 VIP LIST:\n━━━━━━━━━━\n";
          if (list.keys.length === 0) result += "No active VIPs yet.";
          else {
            for (const key of list.keys) {
              const uid = key.name.replace("vip:", "");
              const expiry = await KV.get(key.name);
              const daysLeft = Math.ceil((parseInt(expiry) - Date.now()) / 86400000);
              result += "👤 " + uid + " - " + daysLeft + " days\n";
            }
          }
          await sendMsg(chatId, result, adminKb);
        } catch (e) { await sendMsg(chatId, "Error fetching list.", adminKb); }
        return new Response("OK");
      }
    }

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    if (text === "/start") {
      reply = isAdmin ? "Welcome Boss 👑\nVortexPulse Admin active. What would you like to do today?" : "Welcome to VortexPulse AI 🚀\nI analyse the markets to find the safest games for you. Please select an option below 👇";
    }
    else if (text === "🔄 SWITCH TO USER VIEW" && isAdmin) { reply = "Switched to User View 👀"; keyboard = userKbAdmin; }
    else if (text === "🔙 BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss 👑"; keyboard = adminKb; }
    else if (text === "📤 BROADCAST" && isAdmin) reply = "Boss, type /send followed by your message.";
    else if (text === "✅ POST WINNINGS" && isAdmin) reply = "Send the winning screenshot now 🏆";
    else if (text === "🖼️ UPLOAD GAMES" && isAdmin) {
      await KV.put("adminmode:" + userId, "upload_games", { expirationTtl: 600 });
      reply = "🧠 UPLOAD MODE ACTIVE\nDrop the screenshot of the games now. I will save them to my brain.";
    }
    else if (text === "📊 BOT STATS" && isAdmin) {
      try {
        const vipList = await KV.list({ prefix: "vip:" });
        const gameList = await KV.list({ prefix: "game:" });
        reply = "📊 VortexPulse Stats:\n━━━━━━━━━━\n💎 Active VIPs: " + vipList.keys.length + "\n🎯 Games Stored: " + gameList.keys.length;
      } catch (e) { reply = "📊 Stats unavailable."; }
    }
    else if (text === "👥 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [user_id] [days]\n/removevip [user_id]\n/viplist";
    else if (text === "💳 EDIT PAYMENT" && isAdmin) reply = "💳 Current Payment:\n" + paymentDetails + "\n\nUpdate with:\n/setpayment Bank: ...\nAccount: ...\nName: ...";
    else if (text === "💳 SUBSCRIBE VIP") {
      if (userIsVip && !isAdmin) reply = "💎 You already have active VIP access. Enjoy!";
      else {
        await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 });
        reply = "💳 VIP SUBSCRIPTION\n━━━━━━━━━━\n💰 Weekly: ₦5,000\n💎 Monthly: ₦15,000\n\n💳 Payment Details:\n" + paymentDetails + "\n\n📸 After payment, please upload a screenshot of your payment proof here.";
      }
    }
    else if (text === "🆓 FREE TIPS") { reply = "🆓 FREE TIPS ZONE\nChoose a market below 👇"; keyboard = freeKb; }
    else if (text === "💎 VIP SECTION") { reply = "💎 VIP ZONE 💎\nSelect one below 👇"; keyboard = vipKb; }
    else if (text === "📈 PREDICTION TOOLS") { reply = "📈 PREDICTION TOOLS\nAdvanced AI tools below 👇"; keyboard = toolsKb; }
    else if (text === "🧠 AI CHAT") {
      await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 });
      reply = "🧠 AI CHAT ACTIVATED ✅\nChat with me freely for the next 3 minutes. Ask anything about betting, football, or life!\n\nTap 🚪 EXIT AI CHAT to leave anytime.";
      keyboard = chatExitKb;
    }
    else if (text === "👤 MY ACCOUNT") {
      const status = isAdmin ? "👑 Admin" : (userIsVip ? "💎 VIP Member" : "Free User");
      let vipInfo = "❌ Not Active";
      if (isAdmin) vipInfo = "✅ Lifetime";
      else if (userIsVip) {
        const expiry = await KV.get("vip:" + userId);
        const daysLeft = Math.ceil((parseInt(expiry) - Date.now()) / 86400000);
        vipInfo = "✅ Active (" + daysLeft + " days left)";
      }
      reply = "👤 Your Profile\n━━━━━━━━━━\nID: " + userId + "\nStatus: " + status + "\nVIP: " + vipInfo;
    }
    else if (text === "ℹ️ HELP") reply = "ℹ️ HELP CENTER\n\n🆓 Free Tips\n💎 VIP - Premium odds\n📈 Tools - AI predictions\n🧠 AI Chat\n💳 Subscribe VIP";
    else if (text === "⚽ Straight Win" || text === "🎯 Double Chance" || text === "🔥 Over 1.5" || text === "💧 Under 3.5" || text === "🤝 Draw No Bet" || text === "🎪 BTTS") {
      reply = "🧠 Analysing safe odds for " + text + "...\n⏳ Please wait 3 minutes while my AI scans all bookmakers.";
      keyboard = freeKb;
    }
    else if (text === "🎯 Correct Score" || text === "🏆 HT/FT" || text === "💥 Over 2.5 VIP" || text === "🔥 Over 3.5 VIP" || text === "📐 Corners VIP" || text === "🟨 Cards VIP" || text === "💰 2 Odds Daily" || text === "💎 5 Odds Daily" || text === "🚀 10 Odds Rollover" || text === "🏅 Banker of Day") {
      if (userIsVip) reply = "💎 VIP ACCESS\n🧠 Analysing " + text + "...\n⏳ Please wait 3 minutes.";
      else reply = "🔒 VIP ONLY 🔒\n" + text + " is locked.\nSubscribe to unlock 💎";
      keyboard = vipKb;
    }
    else if (text === "🎲 Random Picker" || text === "📊 Stats Insight" || text === "🔮 AI Prediction" || text === "🏟️ League Picker" || text === "🌍 Country Games" || text === "⏰ Live Matches") {
      if (userIsVip) reply = "💎 VIP ACCESS\n🧠 Running " + text + "...\n⏳ Please wait 3 minutes.";
      else reply = "🔒 VIP TOOL LOCKED 🔒\n" + text + " is premium.\nSubscribe to unlock 💎";
      keyboard = toolsKb;
    }
    else if (text === "⬅️ BACK") { reply = "Back to main menu 🏠"; keyboard = isAdmin ? userKbAdmin : userKb; }
    else { reply = "Please use the buttons below 👇"; keyboard = isAdmin ? userKbAdmin : userKb; }

    await sendMsg(chatId, reply, keyboard);
    return new Response("OK");
  }
};
