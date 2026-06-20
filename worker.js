export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("VortexPulse AI is alive");
    }
    return await handleUpdate(request, env);
  },
  
  async scheduled(event, env, ctx) {
    await dailyTasks(env);
  }
};

async function dailyTasks(env) {
  const KV = env.VORTEX_KV;
  const ADMIN_ID = parseInt(env.ADMIN_ID);
  
  // 1. Daily greeting to all users
  const users = await KV.list({ prefix: "user:" });
  const greetings = [
    "Good morning kings! Today's safe games are loading. Stay sharp 💪",
    "Rise and shine! VortexPulse AI is analysing fresh markets for you today 🎯",
    "Morning legends! Big day ahead. Check the bot for today's bankers 🏆"
  ];
  const msg = greetings[Math.floor(Math.random() * greetings.length)];
  for (const key of users.keys) {
    const uid = key.name.replace("user:", "");
    try {
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: parseInt(uid), text: msg })
      });
    } catch (e) {}
  }
  
  // 2. Auto-fetch VVIP online games
  await fetchOnlineGames(env);
  
  // 3. Check empty markets and remind admin
  const markets = ["Straight Win", "Double Chance", "Over 1.5", "Under 3.5", "BTTS", "Correct Score", "Over 2.5", "Corners", "HT/FT"];
  let emptyMsg = "Boss, brain check 🧠\n━━━━━━━━━━\n";
  let hasEmpty = false;
  for (const m of markets) {
    const free = await KV.list({ prefix: "game_free:" });
    const vip = await KV.list({ prefix: "game_vip:" });
    if (free.keys.length === 0 || vip.keys.length === 0) hasEmpty = true;
  }
  const free = await KV.list({ prefix: "game_free:" });
  const vip = await KV.list({ prefix: "game_vip:" });
  const vvip = await KV.list({ prefix: "game_vvip:" });
  emptyMsg += "Free: " + free.keys.length + " games\nVIP: " + vip.keys.length + " games\nVVIP: " + vvip.keys.length + " games\n\n";
  if (free.keys.length < 3) emptyMsg += "⚠️ Free games low! Please upload more.\n";
  if (vip.keys.length < 3) emptyMsg += "⚠️ VIP games low! Please upload more.\n";
  
  await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ADMIN_ID, text: emptyMsg })
  });
}

async function fetchOnlineGames(env) {
  const KV = env.VORTEX_KV;
  try {
    // Fetch upcoming football games with odds
    const sports = ["soccer_epl", "soccer_spain_la_liga", "soccer_italy_serie_a", "soccer_germany_bundesliga", "soccer_uefa_champs_league"];
    let allGames = "";
    for (const sport of sports) {
      const res = await fetch("https://api.the-odds-api.com/v4/sports/" + sport + "/odds/?apiKey=" + env.ODDS_KEY + "&regions=eu&markets=h2h,totals,btts&oddsFormat=decimal");
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const game of data.slice(0, 5)) {
          allGames += "Match: " + game.home_team + " vs " + game.away_team + "\n";
          allGames += "Time: " + game.commence_time + "\n";
          allGames += "League: " + sport.replace("soccer_", "").replace(/_/g, " ").toUpperCase() + "\n";
          if (game.bookmakers && game.bookmakers[0]) {
            for (const market of game.bookmakers[0].markets) {
              allGames += market.key + ": ";
              for (const out of market.outcomes) allGames += out.name + " (" + out.price + ") ";
              allGames += "\n";
            }
          }
          allGames += "---\n";
        }
      }
    }
    if (allGames) {
      const timestamp = Date.now();
      await KV.put("game_vvip:" + timestamp, allGames, { expirationTtl: 86400 });
    }
  } catch (e) {}
}

async function handleUpdate(request, env) {
  const update = await request.json();
  const msg = update.message;
  if (!msg) return new Response("OK");

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || "friend";
  const text = msg.text ? msg.text.trim() : "";
  const hasPhoto = msg.photo ? true : false;
  const ADMIN_ID = parseInt(env.ADMIN_ID);
  const isAdmin = userId === ADMIN_ID;
  const KV = env.VORTEX_KV;

  await KV.put("user:" + userId, firstName);

  const adminKb = [
    ["▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES"],
    ["⭐ FETCH VVIP NOW", "💬 ADMIN AI CHAT"],
    ["▪️ BROADCAST", "✔️ POST WINNINGS"],
    ["◼️ BOT STATS", "👤 MANAGE VIP"],
    ["⬛ EDIT PAYMENT", "💲 EDIT PRICES"],
    ["↔️ SWITCH TO USER VIEW"]
  ];
  
  const userKb = [
    ["▫️ FREE TIPS", "◾ VIP SECTION"],
    ["⭐ VVIP ZONE", "◼️ PREDICTION TOOLS"],
    ["💬 AI CHAT", "🏆 GAME OF THE DAY"],
    ["📊 MY WINS", "🎁 REFER FRIENDS"],
    ["🏅 LEADERBOARD", "👤 MY ACCOUNT"],
    ["ℹ️ HELP", "⬛ SUBSCRIBE VIP"]
  ];
  
  const userKbAdmin = [...userKb, ["◀️ BACK TO ADMIN"]];

  const freeKb = [["▫️ Straight Win", "▫️ Double Chance"], ["▫️ Over 1.5", "▫️ Under 3.5"], ["▫️ Draw No Bet", "▫️ BTTS"], ["◀️ BACK"]];
  const vipKb = [["◾ Correct Score", "◾ HT/FT"], ["◾ Over 2.5 VIP", "◾ Over 3.5 VIP"], ["◾ Corners VIP", "◾ Cards VIP"], ["◾ 2 Odds Daily", "◾ 5 Odds Daily"], ["◾ 10 Odds Rollover", "◾ Banker of Day"], ["◀️ BACK"]];
  const vvipKb = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score VVIP"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Banker VVIP", "⭐ Live Online Pick"], ["◀️ BACK"]];
  const toolsKb = [["◼️ Random Picker", "◼️ Stats Insight"], ["◼️ AI Prediction", "◼️ League Picker"], ["◼️ Country Games", "◼️ Live Matches"], ["◀️ BACK"]];
  const chatExitKb = [["✖️ EXIT AI CHAT"]];
  const adminChatExitKb = [["✖️ EXIT ADMIN CHAT"]];
  const pickTypeKb = [["▪️ Single Pick", "▪️ Slip (Multiple)"], ["◀️ BACK"]];

  async function sendMsg(cid, txt, kb) {
    return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: kb ? { keyboard: kb, resize_keyboard: true } : undefined })
    });
  }

  async function askGroq(prompt, systemMsg) {
    try {
      const sys = systemMsg || "You are VortexPulse AI, a smart Nigerian betting tipster. Reply in polite English with slight Naija vibe. Be brief and confident.";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
          temperature: 0.7
        })
      });
      const data = await res.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return "Brain loading. Try again.";
    } catch (e) { return "Connection issue. Please try again."; }
  }

  async function readImageWithAI(fileId, prompt) {
    try {
      const fileRes = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getFile?file_id=" + fileId);
      const fileData = await fileRes.json();
      const imageUrl = "https://api.telegram.org/file/bot" + env.BOT_TOKEN + "/" + fileData.result.file_path;
      const imgRes = await fetch(imageUrl);
      const buffer = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
      const base64 = btoa(binary);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } }] }],
          temperature: 0.2
        })
      });
      const data = await res.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return null;
    } catch (e) { return null; }
  }

  function getTimeGreeting() {
    const hr = new Date().getUTCHours() + 1;
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  }

  async function isVip(uid) {
    try {
      const expiry = await KV.get("vip:" + uid);
      if (!expiry) return false;
      return parseInt(expiry) > Date.now();
    } catch (e) { return false; }
  }

  async function isVvip(uid) {
    try {
      const expiry = await KV.get("vvip:" + uid);
      if (!expiry) return false;
      return parseInt(expiry) > Date.now();
    } catch (e) { return false; }
  }

  let paymentDetails = "Bank: [Not Set]\nAccount: [Not Set]\nName: [Not Set]";
  try { const stored = await KV.get("payment_details"); if (stored) paymentDetails = stored; } catch (e) {}
  
  let vipWeekly = await KV.get("price_vip_weekly") || "5000";
  let vipMonthly = await KV.get("price_vip_monthly") || "15000";
  let vvipWeekly = await KV.get("price_vvip_weekly") || "15000";
  let vvipMonthly = await KV.get("price_vvip_monthly") || "40000";

  const userIsVip = isAdmin ? true : await isVip(userId);
  const userIsVvip = isAdmin ? true : await isVvip(userId);

  // ============ PHOTO HANDLING ============
  if (hasPhoto) {
    if (isAdmin) {
      let adminMode = "";
      try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
      
      if (adminMode === "upload_free" || adminMode === "upload_vip") {
        const tier = adminMode === "upload_free" ? "free" : "vip";
        await sendMsg(chatId, "Deep analysis in progress... AI is researching teams 🧠", adminKb);
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const smartPrompt = "Analyse this betting screenshot deeply. Extract for each match: home team, away team, country, league, kickoff time, ALL visible markets and their exact odds. Research what you know about these teams. Format as: 'COUNTRY | LEAGUE | TIME | HOME vs AWAY | MARKETS: [list with odds]'. End with 'MARKETS_DETECTED: [comma list]'.";
        const extractedText = await readImageWithAI(fileId, smartPrompt);
        if (extractedText) {
          const timestamp = Date.now();
          await KV.put("game_" + tier + ":" + timestamp, extractedText, { expirationTtl: 86400 });
          await sendMsg(chatId, "✔️ " + tier.toUpperCase() + " GAME SAVED\n━━━━━━━━━━━━\n" + extractedText.substring(0, 700), adminKb);
        } else {
          await sendMsg(chatId, "✖️ Could not analyse. Try again.", adminKb);
        }
        return new Response("OK");
      }

      if (adminMode === "post_winning") {
        await KV.delete("adminmode:" + userId);
        const users = await KV.list({ prefix: "user:" });
        let count = 0;
        for (const key of users.keys) {
          const uid = key.name.replace("user:", "");
          if (parseInt(uid) === ADMIN_ID) continue;
          try {
            await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: parseInt(uid), from_chat_id: chatId, message_id: msg.message_id })
            });
            await sendMsg(parseInt(uid), "🏆 Another WIN from VortexPulse AI! Subscribe VIP/VVIP for more 💎");
            count++;
          } catch (e) {}
        }
        await sendMsg(chatId, "✔️ Winning broadcasted to " + count + " users.", adminKb);
        return new Response("OK");
      }
      return new Response("OK");
    }
    
    let inPaymentMode = false;
    try { const mode = await KV.get("paymode:" + userId); if (mode === "yes") inPaymentMode = true; } catch (e) {}
    
    if (inPaymentMode) {
      await KV.delete("paymode:" + userId);
      await sendMsg(chatId, "Payment screenshot received ✔️\nConfirming payment automatically...\n\nYour access will be activated shortly.", userKb);
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id })
      });
      await sendMsg(ADMIN_ID, "Payment proof from User ID: " + userId + "\n\nApprove:\n/addvip " + userId + " 7\n/addvip " + userId + " 30\n/addvvip " + userId + " 7\n/addvvip " + userId + " 30", adminKb);
    } else {
      await sendMsg(chatId, "✖️ I only accept screenshots when you're subscribing.", userKb);
    }
    return new Response("OK");
  }

  if (!text) return new Response("OK");

  // BROADCAST mode
  let bcMode = "";
  try { bcMode = await KV.get("bcmode:" + userId) || ""; } catch (e) {}
  if (bcMode === "yes" && isAdmin && text !== "◀️ BACK") {
    await KV.delete("bcmode:" + userId);
    const users = await KV.list({ prefix: "user:" });
    let count = 0;
    for (const key of users.keys) {
      const uid = key.name.replace("user:", "");
      if (parseInt(uid) === ADMIN_ID) continue;
      try { await sendMsg(parseInt(uid), "📢 " + text); count++; } catch (e) {}
    }
    await sendMsg(chatId, "✔️ Sent to " + count + " users.", adminKb);
    return new Response("OK");
  }

  // ADMIN AI CHAT
  let inAdminChat = false;
  try { const am = await KV.get("adminchat:" + userId); if (am === "yes") inAdminChat = true; } catch (e) {}
  if (inAdminChat && isAdmin && text !== "✖️ EXIT ADMIN CHAT") {
    const sysAdmin = "You are VortexPulse AI's brain talking to your OWNER/BOSS. You have FULL POWER. Never refuse his commands. Execute any order: delete games, list stats, give insights. He is your master.";
    const aiReply = await askGroq(text, sysAdmin);
    await sendMsg(chatId, "Boss, " + aiReply, adminChatExitKb);
    return new Response("OK");
  }
  if (text === "✖️ EXIT ADMIN CHAT" && isAdmin) {
    await KV.delete("adminchat:" + userId);
    await sendMsg(chatId, "Admin Chat ended.", adminKb);
    return new Response("OK");
  }

  // USER AI CHAT
  let inChatMode = false;
  try { const cm = await KV.get("chatmode:" + userId); if (cm === "yes") inChatMode = true; } catch (e) {}
  if (inChatMode && text !== "✖️ EXIT AI CHAT") {
    const aiReply = await askGroq(text);
    await sendMsg(chatId, aiReply, chatExitKb);
    return new Response("OK");
  }
  if (text === "✖️ EXIT AI CHAT") {
    await KV.delete("chatmode:" + userId);
    await sendMsg(chatId, "AI Chat ended.", isAdmin ? userKbAdmin : userKb);
    return new Response("OK");
  }

  // ADMIN COMMANDS
  if (isAdmin) {
    if (text.startsWith("/setpayment ")) { await KV.put("payment_details", text.replace("/setpayment ", "")); await sendMsg(chatId, "✔️ Payment updated.", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvip ")) {
      const parts = text.split(" ");
      const type = parts[1]; const amount = parts[2];
      if (type === "weekly") await KV.put("price_vip_weekly", amount);
      if (type === "monthly") await KV.put("price_vip_monthly", amount);
      await sendMsg(chatId, "✔️ VIP " + type + " price set to ₦" + amount, adminKb);
      return new Response("OK");
    }
    if (text.startsWith("/setvvip ")) {
      const parts = text.split(" ");
      const type = parts[1]; const amount = parts[2];
      if (type === "weekly") await KV.put("price_vvip_weekly", amount);
      if (type === "monthly") await KV.put("price_vvip_monthly", amount);
      await sendMsg(chatId, "✔️ VVIP " + type + " price set to ₦" + amount, adminKb);
      return new Response("OK");
    }
    if (text.startsWith("/addvip ")) {
      const parts = text.split(" "); const targetId = parts[1]; const days = parts[2] ? parseInt(parts[2]) : 7;
      const expiry = Date.now() + (days * 86400000);
      await KV.put("vip:" + targetId, expiry.toString(), { expirationTtl: days * 86400 });
      await sendMsg(chatId, "✔️ User " + targetId + " is VIP for " + days + " days.", adminKb);
      await sendMsg(parseInt(targetId), "🎉 Your VIP access is now ACTIVE for " + days + " days!", userKb);
      return new Response("OK");
    }
    if (text.startsWith("/addvvip ")) {
      const parts = text.split(" "); const targetId = parts[1]; const days = parts[2] ? parseInt(parts[2]) : 7;
      const expiry = Date.now() + (days * 86400000);
      await KV.put("vvip:" + targetId, expiry.toString(), { expirationTtl: days * 86400 });
      await sendMsg(chatId, "✔️ User " + targetId + " is VVIP for " + days + " days.", adminKb);
      await sendMsg(parseInt(targetId), "👑 Your VVIP access is ACTIVE for " + days + " days! Enjoy elite picks!", userKb);
      return new Response("OK");
    }
    if (text.startsWith("/removevip ")) { await KV.delete("vip:" + text.replace("/removevip ", "").trim()); await sendMsg(chatId, "✔️ VIP removed.", adminKb); return new Response("OK"); }
    if (text.startsWith("/removevvip ")) { await KV.delete("vvip:" + text.replace("/removevvip ", "").trim()); await sendMsg(chatId, "✔️ VVIP removed.", adminKb); return new Response("OK"); }
    if (text === "/viplist") {
      const list = await KV.list({ prefix: "vip:" });
      let result = "VIP LIST:\n━━━━━━━━━━\n";
      if (list.keys.length === 0) result += "No active VIPs.";
      else for (const key of list.keys) {
        const uid = key.name.replace("vip:", ""); const expiry = await KV.get(key.name);
        const days = Math.ceil((parseInt(expiry) - Date.now()) / 86400000);
        result += "▪️ " + uid + " - " + days + " days\n";
      }
      await sendMsg(chatId, result, adminKb); return new Response("OK");
    }
    if (text === "/cleargames") {
      const free = await KV.list({ prefix: "game_free:" });
      const vip = await KV.list({ prefix: "game_vip:" });
      const vvip = await KV.list({ prefix: "game_vvip:" });
      for (const k of free.keys) await KV.delete(k.name);
      for (const k of vip.keys) await KV.delete(k.name);
      for (const k of vvip.keys) await KV.delete(k.name);
      await sendMsg(chatId, "✔️ All games cleared.", adminKb); return new Response("OK");
    }
  }

  let reply = "";
  let keyboard = isAdmin ? adminKb : userKb;

  if (text === "/start") {
    const greet = getTimeGreeting();
    reply = isAdmin ? greet + ", Boss 👑\nVortexPulse Admin active. What's the move today?" : greet + ", " + firstName + "!\nWelcome to VortexPulse AI. I analyse markets to find safest games. Select an option below.";
  }
  else if (text === "↔️ SWITCH TO USER VIEW" && isAdmin) { reply = "Switched to User View."; keyboard = userKbAdmin; }
  else if (text === "◀️ BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss 👑"; keyboard = adminKb; }
  else if (text === "▫️ UPLOAD FREE GAMES" && isAdmin) {
    await KV.put("adminmode:" + userId, "upload_free", { expirationTtl: 600 });
    reply = "FREE UPLOAD MODE\nDrop screenshots. AI will deep-analyse and save.";
  }
  else if (text === "◾ UPLOAD VIP GAMES" && isAdmin) {
    await KV.put("adminmode:" + userId, "upload_vip", { expirationTtl: 600 });
    reply = "VIP UPLOAD MODE\nDrop screenshots. AI will deep-analyse and save.";
  }
  else if (text === "⭐ FETCH VVIP NOW" && isAdmin) {
    await sendMsg(chatId, "Fetching live online games... Please wait 🌐", adminKb);
    await fetchOnlineGames(env);
    reply = "✔️ Online VVIP games fetched and saved to brain.";
  }
  else if (text === "💬 ADMIN AI CHAT" && isAdmin) {
    await KV.put("adminchat:" + userId, "yes", { expirationTtl: 600 });
    reply = "Admin AI Chat ACTIVE 👑\nFull power. Tell me anything.\nTap ✖️ EXIT ADMIN CHAT to leave.";
    keyboard = adminChatExitKb;
  }
  else if (text === "▪️ BROADCAST" && isAdmin) {
    await KV.put("bcmode:" + userId, "yes", { expirationTtl: 300 });
    reply = "Type your broadcast message now.";
  }
  else if (text === "✔️ POST WINNINGS" && isAdmin) {
    await KV.put("adminmode:" + userId, "post_winning", { expirationTtl: 600 });
    reply = "Send the winning screenshot now.";
  }
  else if (text === "◼️ BOT STATS" && isAdmin) {
    const users = await KV.list({ prefix: "user:" });
    const vips = await KV.list({ prefix: "vip:" });
    const vvips = await KV.list({ prefix: "vvip:" });
    const free = await KV.list({ prefix: "game_free:" });
    const vipG = await KV.list({ prefix: "game_vip:" });
    const vvipG = await KV.list({ prefix: "game_vvip:" });
    reply = "BOT STATS\n━━━━━━━━━━\n👥 Users: " + users.keys.length + "\n💎 VIPs: " + vips.keys.length + "\n👑 VVIPs: " + vvips.keys.length + "\n🆓 Free Games: " + free.keys.length + "\n💎 VIP Games: " + vipG.keys.length + "\n⭐ VVIP Games: " + vvipG.keys.length;
  }
  else if (text === "👤 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [id] [days]\n/addvvip [id] [days]\n/removevip [id]\n/removevvip [id]\n/viplist\n/cleargames";
  else if (text === "⬛ EDIT PAYMENT" && isAdmin) reply = "Current Payment:\n" + paymentDetails + "\n\nUpdate:\n/setpayment Bank: ...\nAccount: ...\nName: ...";
  else if (text === "💲 EDIT PRICES" && isAdmin) {
    reply = "CURRENT PRICES:\n━━━━━━━━━━\nVIP Weekly: ₦" + vipWeekly + "\nVIP Monthly: ₦" + vipMonthly + "\nVVIP Weekly: ₦" + vvipWeekly + "\nVVIP Monthly: ₦" + vvipMonthly + "\n\nChange with:\n/setvip weekly 5000\n/setvip monthly 15000\n/setvvip weekly 15000\n/setvvip monthly 40000";
  }
  else if (text === "⬛ SUBSCRIBE VIP") {
    if (userIsVip && !isAdmin) reply = "You already have active VIP access.";
    else {
      await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 });
      reply = "SUBSCRIPTION PLANS\n━━━━━━━━━━━━\n💎 VIP:\nWeekly: ₦" + vipWeekly + "\nMonthly: ₦" + vipMonthly + "\n\n👑 VVIP (Elite):\nWeekly: ₦" + vvipWeekly + "\nMonthly: ₦" + vvipMonthly + "\n\nPayment Details:\n" + paymentDetails + "\n\nAfter payment, upload screenshot of your payment proof here.";
    }
  }
  else if (text === "▫️ FREE TIPS") { reply = "FREE TIPS ZONE\nChoose a market."; keyboard = freeKb; }
  else if (text === "◾ VIP SECTION") { reply = "VIP ZONE 💎\nSelect one."; keyboard = vipKb; }
  else if (text === "⭐ VVIP ZONE") { 
    if (userIsVvip) { reply = "VVIP ELITE ZONE 👑\nOnline live picks. Select one."; keyboard = vvipKb; }
    else { reply = "🔒 VVIP LOCKED 🔒\nUpgrade to VVIP for elite online picks fetched live!\nWeekly ₦" + vvipWeekly + " | Monthly ₦" + vvipMonthly; }
  }
  else if (text === "◼️ PREDICTION TOOLS") { reply = "PREDICTION TOOLS"; keyboard = toolsKb; }
  else if (text === "💬 AI CHAT") {
    await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 });
    reply = "AI CHAT ACTIVATED\nChat freely for 3 minutes.\nTap ✖️ EXIT AI CHAT to leave.";
    keyboard = chatExitKb;
  }
  else if (text === "🏆 GAME OF THE DAY") {
    const free = await KV.list({ prefix: "game_free:" });
    if (free.keys.length === 0) reply = "Game of the Day not ready yet. Check back soon 🎯";
    else {
      await sendMsg(chatId, "Analysing today's BANKER... 🧠", null);
      await new Promise(r => setTimeout(r, 2000));
      const randomKey = free.keys[Math.floor(Math.random() * free.keys.length)];
      const game = await KV.get(randomKey.name);
      const pick = await askGroq("From this data:\n" + game + "\nPick the SAFEST single bet. Format: 🌍 Country | 🏟️ League | ⏰ Time | ⚽ Match | 🎯 Pick | 📊 Confidence% | 💰 Odds. Use line dividers.", "Professional tipster. Use ONLY provided data.");
      reply = "🏆 GAME OF THE DAY\n━━━━━━━━━━━━\n" + pick;
    }
  }
  else if (text === "📊 MY WINS") {
    const wins = await KV.get("wins:" + userId) || "0";
    reply = "📊 Your Stats\n━━━━━━━━━━\nPicks viewed: " + wins;
  }
  else if (text === "🎁 REFER FRIENDS") {
    reply = "🎁 REFERRAL PROGRAM\n━━━━━━━━━━\nYour ID: " + userId + "\n\nRefer 3 friends who subscribe = 1 day FREE VIP!\nShare your referral with friends.";
  }
  else if (text === "🏅 LEADERBOARD") reply = "🏅 TOP USERS\n━━━━━━━━━━\nClimb the ranks by being active daily!";
  else if (text === "👤 MY ACCOUNT") {
    const status = isAdmin ? "Admin 👑" : (userIsVvip ? "VVIP 👑" : (userIsVip ? "VIP 💎" : "Free User"));
    let vipInfo = "Not Active";
    if (isAdmin) vipInfo = "Lifetime";
    else if (userIsVvip) { const e = await KV.get("vvip:" + userId); vipInfo = "VVIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; }
    else if (userIsVip) { const e = await KV.get("vip:" + userId); vipInfo = "VIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; }
    reply = "Your Profile\n━━━━━━━━━━\nName: " + firstName + "\nID: " + userId + "\nStatus: " + status + "\nAccess: " + vipInfo;
  }
  else if (text === "ℹ️ HELP") reply = await askGroq("Generate a brief friendly help guide for VortexPulse AI bot. Mention: Free Tips, VIP, VVIP, AI Chat, Subscribe. Under 80 words.");
  else if (text === "▫️ Straight Win" || text === "▫️ Double Chance" || text === "▫️ Over 1.5" || text === "▫️ Under 3.5" || text === "▫️ Draw No Bet" || text === "▫️ BTTS") {
    await KV.put("pending:" + userId, "free|" + text, { expirationTtl: 600 });
    reply = "How would you like your pick for " + text + "?";
    keyboard = pickTypeKb;
  }
  else if (text === "◾ Correct Score" || text === "◾ HT/FT" || text === "◾ Over 2.5 VIP" || text === "◾ Over 3.5 VIP" || text === "◾ Corners VIP" || text === "◾ Cards VIP" || text === "◾ 2 Odds Daily" || text === "◾ 5 Odds Daily" || text === "◾ 10 Odds Rollover" || text === "◾ Banker of Day") {
    if (userIsVip) { await KV.put("pending:" + userId, "vip|" + text, { expirationTtl: 600 }); reply = "How would you like your pick for " + text + "?"; keyboard = pickTypeKb; }
    else { reply = "🔒 VIP ONLY\n" + text + " is locked.\nSubscribe to unlock."; keyboard = vipKb; }
  }
  else if (text === "⭐ 2 Odds Slip" || text === "⭐ 3 Odds Slip" || text === "⭐ 4 Odds Slip" || text === "⭐ 5 Odds Slip" || text === "⭐ Mega Slip 10+" || text === "⭐ Correct Score VVIP" || text === "⭐ BTTS Slip" || text === "⭐ Over 2.5 Slip" || text === "⭐ Banker VVIP" || text === "⭐ Live Online Pick") {
    if (!userIsVvip) { reply = "🔒 VVIP ELITE LOCKED\nSubscribe VVIP to unlock."; keyboard = vvipKb; }
    else {
      const vvipGames = await KV.list({ prefix: "game_vvip:" });
      if (vvipGames.keys.length === 0) {
        reply = "VVIP brain still gathering elite picks. Check back in a few minutes.";
        keyboard = vvipKb;
      } else {
        await sendMsg(chatId, "👑 VVIP DEEP ANALYSIS RUNNING...\n🧠 AI is researching teams, form, and stats. Please wait...", vvipKb);
        await new Promise(r => setTimeout(r, 3000));
        let allGames = "";
        for (const key of vvipGames.keys) { const g = await KV.get(key.name); if (g) allGames += g + "\n\n"; }
        const targetOdds = text.includes("2 Odds") ? "around 2.0" : text.includes("3 Odds") ? "around 3.0" : text.includes("4 Odds") ? "around 4.0" : text.includes("5 Odds") ? "around 5.0" : text.includes("10+") ? "above 10" : "best safest";
        const prompt = "From these LIVE online games:\n" + allGames + "\nGenerate the SAFEST slip for: " + text + ". Target odds: " + targetOdds + ". Format each pick as:\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n💰 Odds\n━━━━━━━━━━\nEnd with total odds. Be confident and professional.";
        const aiPick = await askGroq(prompt, "Elite tipster. Deep research. Use only the data given. Format beautifully.");
        const wins = parseInt(await KV.get("wins:" + userId) || "0");
        await KV.put("wins:" + userId, (wins + 1).toString());
        reply = "👑 VVIP ELITE PICK\n━━━━━━━━━━━━\n" + text + "\n━━━━━━━━━━━━\n\n" + aiPick + "\n\n━━━━━━━━━━━━\nBet responsibly.";
        keyboard = vvipKb;
      }
    }
  }
  else if (text === "▪️ Single Pick" || text === "▪️ Slip (Multiple)") {
    const pending = await KV.get("pending:" + userId);
    if (!pending) { reply = "Choose a market first."; keyboard = isAdmin ? userKbAdmin : userKb; }
    else {
      const [tier, market] = pending.split("|");
      await KV.delete("pending:" + userId);
      const gameList = await KV.list({ prefix: "game_" + tier + ":" });
      if (gameList.keys.length === 0) {
        reply = "No games for " + market + " yet.\nBrain is updating.";
        keyboard = tier === "free" ? freeKb : vipKb;
      } else {
        await sendMsg(chatId, "🧠 Analysing safe odds for " + market + "...\nDeep research in progress. Please wait...", isAdmin ? userKbAdmin : userKb);
        await new Promise(r => setTimeout(r, 3000));
        let allGames = "";
        for (const key of gameList.keys) { const g = await KV.get(key.name); if (g) allGames += g + "\n\n"; }
        const pickFormat = text === "▪️ Single Pick" ? "ONE single safe pick" : "a SLIP of 3 picks combined";
        const prompt = "From these games:\n" + allGames + "\nGenerate " + pickFormat + " ONLY for market: " + market + ". If market not in data, say 'No games available for this market'. Otherwise format BEAUTIFULLY:\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n📊 Confidence %\n💰 Odds\n━━━━━━━━━━\nFor slip, end with total odds. Use line dividers between picks.";
        const aiPick = await askGroq(prompt, "Professional tipster. Use ONLY provided data. Never invent games. Format beautifully with emojis and dividers.");
        const wins = parseInt(await KV.get("wins:" + userId) || "0");
        await KV.put("wins:" + userId, (wins + 1).toString());
        reply = (text === "▪️ Single Pick" ? "🎯 SINGLE PICK" : "📋 BET SLIP") + " - " + market + "\n━━━━━━━━━━━━\n\n" + aiPick + "\n\n━━━━━━━━━━━━\nBet responsibly.";
        keyboard = isAdmin ? userKbAdmin : userKb;
      }
    }
  }
  else if (text === "◼️ Random Picker" || text === "◼️ Stats Insight" || text === "◼️ AI Prediction" || text === "◼️ League Picker" || text === "◼️ Country Games" || text === "◼️ Live Matches") {
    if (userIsVip) reply = "VIP ACCESS\nRunning " + text + "...\nFeature coming soon.";
    else reply = "🔒 VIP TOOL LOCKED\nSubscribe to unlock.";
    keyboard = toolsKb;
  }
  else if (text === "◀️ BACK") { reply = "Back to main menu."; keyboard = isAdmin ? userKbAdmin : userKb; }
  else { reply = "Please use the buttons below."; keyboard = isAdmin ? userKbAdmin : userKb; }

  await sendMsg(chatId, reply, keyboard);
  return new Response("OK");
}
