export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("VortexPulse AI is alive");
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
      ["▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES"],
      ["▪️ BROADCAST", "✔️ POST WINNINGS"],
      ["◼️ BOT STATS", "👤 MANAGE VIP"],
      ["⬛ EDIT PAYMENT", "↔️ SWITCH TO USER VIEW"]
    ];
    
    const userKb = [
      ["▫️ FREE TIPS", "◾ VIP SECTION"],
      ["◼️ PREDICTION TOOLS", "💬 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"],
      ["⬛ SUBSCRIBE VIP"]
    ];
    
    const userKbAdmin = [
      ["▫️ FREE TIPS", "◾ VIP SECTION"],
      ["◼️ PREDICTION TOOLS", "💬 AI CHAT"],
      ["👤 MY ACCOUNT", "ℹ️ HELP"],
      ["⬛ SUBSCRIBE VIP"],
      ["◀️ BACK TO ADMIN"]
    ];

    const freeKb = [["▫️ Straight Win", "▫️ Double Chance"], ["▫️ Over 1.5", "▫️ Under 3.5"], ["▫️ Draw No Bet", "▫️ BTTS"], ["◀️ BACK"]];
    const vipKb = [["◾ Correct Score", "◾ HT/FT"], ["◾ Over 2.5 VIP", "◾ Over 3.5 VIP"], ["◾ Corners VIP", "◾ Cards VIP"], ["◾ 2 Odds Daily", "◾ 5 Odds Daily"], ["◾ 10 Odds Rollover", "◾ Banker of Day"], ["◀️ BACK"]];
    const toolsKb = [["◼️ Random Picker", "◼️ Stats Insight"], ["◼️ AI Prediction", "◼️ League Picker"], ["◼️ Country Games", "◼️ Live Matches"], ["◀️ BACK"]];
    const chatExitKb = [["✖️ EXIT AI CHAT"]];
    const pickTypeKb = [["▪️ Single Pick", "▪️ Slip (Multiple)"], ["◀️ BACK"]];

    async function sendMsg(cid, txt, kb) {
      return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: { keyboard: kb, resize_keyboard: true } })
      });
    }

    async function askGroq(prompt, systemMsg) {
      try {
        const sys = systemMsg || "You are VortexPulse AI, a smart and friendly Nigerian betting assistant. Reply in mostly polite English with a slight Naija vibe occasionally. Be brief, helpful, and confident.";
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
            temperature: 0.8
          })
        });
        const data = await res.json();
        if (data.choices && data.choices[0]) return data.choices[0].message.content;
        return "My brain is loading. Try again in a moment.";
      } catch (e) { return "Connection issue. Please try again."; }
    }

    // Groq Vision - reads images intelligently with AI
    async function readImageWithAI(fileId) {
      try {
        const fileRes = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getFile?file_id=" + fileId);
        const fileData = await fileRes.json();
        const imageUrl = "https://api.telegram.org/file/bot" + env.BOT_TOKEN + "/" + fileData.result.file_path;
        
        // Download and convert to base64
        const imgRes = await fetch(imageUrl);
        const buffer = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Extract ALL betting data from this screenshot. List every team match-up, league/country, and all visible odds for markets (1X2, Over/Under, BTTS, Correct Score, etc). Be thorough and accurate. Format clearly." },
                { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } }
              ]
            }],
            temperature: 0.2
          })
        });
        const data = await res.json();
        if (data.choices && data.choices[0]) return data.choices[0].message.content;
        return null;
      } catch (e) { return null; }
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

    if (hasPhoto) {
      if (isAdmin) {
        let adminMode = "";
        try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
        
        if (adminMode === "upload_free" || adminMode === "upload_vip") {
          const tier = adminMode === "upload_free" ? "free" : "vip";
          await sendMsg(chatId, "Scanning screenshot with AI Vision... Please wait.", adminKb);
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          const extractedText = await readImageWithAI(fileId);
          if (extractedText) {
            const timestamp = Date.now();
            await KV.put("game_" + tier + ":" + timestamp, extractedText, { expirationTtl: 86400 });
            const preview = extractedText.substring(0, 500);
            await sendMsg(chatId, "✔️ " + tier.toUpperCase() + " game saved.\n\nExtracted:\n" + preview, adminKb);
          } else {
            await sendMsg(chatId, "✖️ Could not analyse the screenshot. Try again.", adminKb);
          }
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
        await sendMsg(chatId, "Payment screenshot received ✔️\nConfirming payment automatically...\n\nYour VIP access will be activated shortly.", userKb);
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id })
        });
        await sendMsg(ADMIN_ID, "Payment proof from User ID: " + userId + "\n\nApprove:\n/addvip " + userId + " 7\n/addvip " + userId + " 30", adminKb);
      } else {
        await sendMsg(chatId, "✖️ I only accept screenshots when you're subscribing.\nPlease use the buttons below.", userKb);
      }
      return new Response("OK");
    }

    if (!text) return new Response("OK");

    let inChatMode = false;
    try {
      const cm = await KV.get("chatmode:" + userId);
      if (cm === "yes") inChatMode = true;
    } catch (e) {}

    if (inChatMode && text !== "✖️ EXIT AI CHAT") {
      const aiReply = await askGroq(text);
      await sendMsg(chatId, aiReply, chatExitKb);
      return new Response("OK");
    }

    if (text === "✖️ EXIT AI CHAT") {
      await KV.delete("chatmode:" + userId);
      await sendMsg(chatId, "AI Chat ended. Welcome back to main menu.", isAdmin ? userKbAdmin : userKb);
      return new Response("OK");
    }

    if (isAdmin) {
      if (text.startsWith("/setpayment ")) {
        await KV.put("payment_details", text.replace("/setpayment ", ""));
        await sendMsg(chatId, "✔️ Payment details updated.", adminKb);
        return new Response("OK");
      }
      if (text.startsWith("/addvip ")) {
        const parts = text.split(" ");
        const targetId = parts[1];
        const days = parts[2] ? parseInt(parts[2]) : 7;
        const expiry = Date.now() + (days * 86400000);
        await KV.put("vip:" + targetId, expiry.toString(), { expirationTtl: days * 86400 });
        await sendMsg(chatId, "✔️ User " + targetId + " is VIP for " + days + " days.", adminKb);
        await sendMsg(parseInt(targetId), "Your VIP access is now ACTIVE for " + days + " days. Enjoy all premium features!", userKb);
        return new Response("OK");
      }
      if (text.startsWith("/removevip ")) {
        await KV.delete("vip:" + text.replace("/removevip ", "").trim());
        await sendMsg(chatId, "✔️ VIP removed.", adminKb);
        return new Response("OK");
      }
      if (text === "/viplist") {
        const list = await KV.list({ prefix: "vip:" });
        let result = "VIP LIST:\n━━━━━━━━━━\n";
        if (list.keys.length === 0) result += "No active VIPs.";
        else for (const key of list.keys) {
          const uid = key.name.replace("vip:", "");
          const expiry = await KV.get(key.name);
          const days = Math.ceil((parseInt(expiry) - Date.now()) / 86400000);
          result += "▪️ " + uid + " - " + days + " days\n";
        }
        await sendMsg(chatId, result, adminKb);
        return new Response("OK");
      }
      if (text === "/cleargames") {
        const free = await KV.list({ prefix: "game_free:" });
        const vip = await KV.list({ prefix: "game_vip:" });
        for (const k of free.keys) await KV.delete(k.name);
        for (const k of vip.keys) await KV.delete(k.name);
        await sendMsg(chatId, "✔️ All games cleared.", adminKb);
        return new Response("OK");
      }
    }

    let reply = "";
    let keyboard = isAdmin ? adminKb : userKb;

    if (text === "/start") {
      reply = isAdmin ? "Welcome Boss.\nVortexPulse Admin active. What would you like to do today?" : "Welcome to VortexPulse AI.\nI analyse the markets to find the safest games for you. Please select an option below.";
    }
    else if (text === "↔️ SWITCH TO USER VIEW" && isAdmin) { reply = "Switched to User View."; keyboard = userKbAdmin; }
    else if (text === "◀️ BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss."; keyboard = adminKb; }
    else if (text === "▫️ UPLOAD FREE GAMES" && isAdmin) {
      await KV.put("adminmode:" + userId, "upload_free", { expirationTtl: 600 });
      reply = "FREE GAMES UPLOAD MODE\nDrop screenshots now. AI Vision will scan and save them.";
    }
    else if (text === "◾ UPLOAD VIP GAMES" && isAdmin) {
      await KV.put("adminmode:" + userId, "upload_vip", { expirationTtl: 600 });
      reply = "VIP GAMES UPLOAD MODE\nDrop screenshots now. AI Vision will scan and save them.";
    }
    else if (text === "▪️ BROADCAST" && isAdmin) reply = "Type /send followed by your message.";
    else if (text === "✔️ POST WINNINGS" && isAdmin) reply = "Send the winning screenshot.";
    else if (text === "◼️ BOT STATS" && isAdmin) {
      const vips = await KV.list({ prefix: "vip:" });
      const free = await KV.list({ prefix: "game_free:" });
      const vipG = await KV.list({ prefix: "game_vip:" });
      reply = "BOT STATS\n━━━━━━━━━━\nVIPs: " + vips.keys.length + "\nFree Games: " + free.keys.length + "\nVIP Games: " + vipG.keys.length;
    }
    else if (text === "👤 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [id] [days]\n/removevip [id]\n/viplist\n/cleargames";
    else if (text === "⬛ EDIT PAYMENT" && isAdmin) reply = "Current Payment:\n" + paymentDetails + "\n\nUpdate:\n/setpayment Bank: ...\nAccount: ...\nName: ...";
    else if (text === "⬛ SUBSCRIBE VIP") {
      if (userIsVip && !isAdmin) reply = "You already have active VIP access.";
      else {
        await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 });
        reply = "VIP SUBSCRIPTION\n━━━━━━━━━━\nWeekly: ₦5,000\nMonthly: ₦15,000\n\nPayment Details:\n" + paymentDetails + "\n\nAfter payment, please upload screenshot of your payment proof here.";
      }
    }
    else if (text === "▫️ FREE TIPS") { reply = "FREE TIPS ZONE\nChoose a market."; keyboard = freeKb; }
    else if (text === "◾ VIP SECTION") { reply = "VIP ZONE\nSelect one."; keyboard = vipKb; }
    else if (text === "◼️ PREDICTION TOOLS") { reply = "PREDICTION TOOLS"; keyboard = toolsKb; }
    else if (text === "💬 AI CHAT") {
      await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 });
      reply = "AI CHAT ACTIVATED\nChat with me for the next 3 minutes.\n\nTap ✖️ EXIT AI CHAT to leave.";
      keyboard = chatExitKb;
    }
    else if (text === "👤 MY ACCOUNT") {
      const status = isAdmin ? "Admin" : (userIsVip ? "VIP" : "Free User");
      let vipInfo = "Not Active";
      if (isAdmin) vipInfo = "Lifetime";
      else if (userIsVip) {
        const expiry = await KV.get("vip:" + userId);
        const days = Math.ceil((parseInt(expiry) - Date.now()) / 86400000);
        vipInfo = "Active (" + days + " days left)";
      }
      reply = "Your Profile\n━━━━━━━━━━\nID: " + userId + "\nStatus: " + status + "\nVIP: " + vipInfo;
    }
    else if (text === "ℹ️ HELP") reply = "HELP CENTER\n\nFree Tips - Simple safe games\nVIP - Premium odds\nTools - AI predictions\nAI Chat - Interactive assistant\nSubscribe VIP - Unlock premium";
    else if (text === "▫️ Straight Win" || text === "▫️ Double Chance" || text === "▫️ Over 1.5" || text === "▫️ Under 3.5" || text === "▫️ Draw No Bet" || text === "▫️ BTTS") {
      await KV.put("pending:" + userId, "free|" + text, { expirationTtl: 600 });
      reply = "How would you like your pick for " + text + "?";
      keyboard = pickTypeKb;
    }
    else if (text === "◾ Correct Score" || text === "◾ HT/FT" || text === "◾ Over 2.5 VIP" || text === "◾ Over 3.5 VIP" || text === "◾ Corners VIP" || text === "◾ Cards VIP" || text === "◾ 2 Odds Daily" || text === "◾ 5 Odds Daily" || text === "◾ 10 Odds Rollover" || text === "◾ Banker of Day") {
      if (userIsVip) {
        await KV.put("pending:" + userId, "vip|" + text, { expirationTtl: 600 });
        reply = "How would you like your pick for " + text + "?";
        keyboard = pickTypeKb;
      } else {
        reply = "VIP ONLY\n" + text + " is locked.\nSubscribe to unlock.";
        keyboard = vipKb;
      }
    }
    else if (text === "▪️ Single Pick" || text === "▪️ Slip (Multiple)") {
      const pending = await KV.get("pending:" + userId);
      if (!pending) {
        reply = "Please choose a market first.";
        keyboard = isAdmin ? userKbAdmin : userKb;
      } else {
        const [tier, market] = pending.split("|");
        await KV.delete("pending:" + userId);
        const gameList = await KV.list({ prefix: "game_" + tier + ":" });
        if (gameList.keys.length === 0) {
          reply = "No games loaded yet for " + market + ".\nPlease check back later — admin is updating the brain.";
          keyboard = tier === "free" ? freeKb : vipKb;
        } else {
          let allGames = "";
          for (const key of gameList.keys) {
            const gameText = await KV.get(key.name);
            if (gameText) allGames += gameText + "\n\n";
          }
          const pickFormat = text === "▪️ Single Pick" ? "ONE single safe pick" : "a SLIP of 3 picks combined";
          const aiPrompt = "From these betting screenshots data:\n\n" + allGames + "\n\nGenerate " + pickFormat + " for the market: " + market + ". Format response cleanly with team names, the specific pick, and a confidence percentage. Be brief and professional. If slip, show total odds estimate.";
          await sendMsg(chatId, "Analysing safe odds for " + market + "...\nPlease wait while my AI scans the games.", isAdmin ? userKbAdmin : userKb);
          const aiPick = await askGroq(aiPrompt, "You are VortexPulse AI, a professional betting tipster. Give concise, confident picks based on the data provided.");
          reply = (text === "▪️ Single Pick" ? "SINGLE PICK" : "BET SLIP") + " - " + market + "\n━━━━━━━━━━\n\n" + aiPick + "\n\nBet responsibly.";
          keyboard = isAdmin ? userKbAdmin : userKb;
        }
      }
    }
    else if (text === "◼️ Random Picker" || text === "◼️ Stats Insight" || text === "◼️ AI Prediction" || text === "◼️ League Picker" || text === "◼️ Country Games" || text === "◼️ Live Matches") {
      if (userIsVip) reply = "VIP ACCESS\nRunning " + text + "...\nPlease wait 3 minutes.";
      else reply = "VIP TOOL LOCKED\n" + text + " is premium.\nSubscribe to unlock.";
      keyboard = toolsKb;
    }
    else if (text === "◀️ BACK") { reply = "Back to main menu."; keyboard = isAdmin ? userKbAdmin : userKb; }
    else { reply = "Please use the buttons below."; keyboard = isAdmin ? userKbAdmin : userKb; }

    await sendMsg(chatId, reply, keyboard);
    return new Response("OK");
  }
};
