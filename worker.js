export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("VortexPulse AI is alive");
    return await handleUpdate(request, env);
  },
  async scheduled(event, env, ctx) {
    await dailyTasks(env);
  }
};

async function dailyTasks(env) {
  const KV = env.VORTEX_KV;
  const ADMIN_ID = parseInt(env.ADMIN_ID);
  const users = await KV.list({ prefix: "user:" });
  const greetings = ["Good morning kings! Today's safe games are loading. Stay sharp 💪", "Rise and shine! VortexPulse AI is analysing fresh markets today 🎯", "Morning legends! Big day ahead. Check today's bankers 🏆"];
  const msg = greetings[Math.floor(Math.random() * greetings.length)];
  for (const key of users.keys) {
    const uid = key.name.replace("user:", "");
    try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: msg }) }); } catch (e) {}
  }
  const free = await KV.list({ prefix: "game_free:" });
  const vip = await KV.list({ prefix: "game_vip:" });
  let emptyMsg = "Boss, brain check 🧠\n━━━━━━━━━━\nFree: " + free.keys.length + "\nVIP: " + vip.keys.length + "\n";
  if (free.keys.length < 3) emptyMsg += "⚠️ Free games low!\n";
  if (vip.keys.length < 3) emptyMsg += "⚠️ VIP games low!\n";
  await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_ID, text: emptyMsg }) });
}

// Fetch live (next 48hrs) games from chosen league
async function fetchLeagueGames(env, sportKey) {
  try {
    const res = await fetch("https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds/?apiKey=" + env.ODDS_KEY + "&regions=eu&markets=h2h,totals&oddsFormat=decimal");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    
    // Filter games within next 48 hours
    const now = Date.now();
    const cutoff = now + (48 * 60 * 60 * 1000);
    const upcoming = data.filter(g => {
      const t = new Date(g.commence_time).getTime();
      return t > now && t < cutoff;
    });
    
    if (upcoming.length === 0) return null;
    
    let games = "";
    for (const game of upcoming.slice(0, 10)) {
      games += "🏟️ League: " + sportKey.replace("soccer_", "").replace(/_/g, " ").toUpperCase() + "\n";
      games += "⚽ Match: " + game.home_team + " vs " + game.away_team + "\n";
      games += "⏰ Time: " + game.commence_time + "\n";
      if (game.bookmakers && game.bookmakers[0]) {
        for (const market of game.bookmakers[0].markets) {
          games += "📊 " + market.key + ": ";
          for (const out of market.outcomes) games += out.name + " (" + out.price + ") ";
          games += "\n";
        }
      }
      games += "━━━━━━━━━━\n";
    }
    return games;
  } catch (e) { return null; }
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

  const adminKb = [["▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES"], ["💬 ADMIN AI CHAT", "▪️ BROADCAST"], ["✔️ POST WINNINGS", "◼️ BOT STATS"], ["👤 MANAGE VIP", "⬛ EDIT PAYMENT"], ["💲 EDIT PRICES", "↔️ SWITCH TO USER VIEW"]];
  const userKb = [["▫️ FREE TIPS", "◾ VIP SECTION"], ["⭐ VVIP ZONE", "◼️ PREDICTION TOOLS"], ["💬 AI CHAT", "🏆 GAME OF THE DAY"], ["📊 MY WINS", "🎁 REFER FRIENDS"], ["🏅 LEADERBOARD", "👤 MY ACCOUNT"], ["ℹ️ HELP", "⬛ SUBSCRIBE VIP"]];
  const userKbAdmin = [...userKb, ["◀️ BACK TO ADMIN"]];
  const freeKb = [["▫️ Straight Win", "▫️ Double Chance"], ["▫️ Over 1.5", "▫️ Under 3.5"], ["▫️ Draw No Bet", "▫️ BTTS"], ["◀️ BACK"]];
  const vipKb = [["◾ Correct Score", "◾ HT/FT"], ["◾ Over 2.5 VIP", "◾ Over 3.5 VIP"], ["◾ Corners VIP", "◾ Cards VIP"], ["◾ 2 Odds Daily", "◾ 5 Odds Daily"], ["◾ 10 Odds Rollover", "◾ Banker of Day"], ["◀️ BACK"]];
  const vvipMainKb = [["⭐ FETCH LIVE GAMES"], ["⭐ Game of the Day VVIP", "⭐ Banker VVIP"], ["◀️ BACK"]];
  const leagueKb = [["🌍 World Cup", "⚽ EPL"], ["⚽ Serie A", "⚽ Ireland"], ["⚽ Brazil", "⚽ China"], ["⚽ Norway", "⚽ Sweden"], ["⚽ Finland", "⚽ Copa Libertadores"], ["⚽ Copa Sudamericana", "🌐 All Leagues"], ["◀️ BACK"]];
  const oddsKb = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Safest Single", "◀️ BACK"]];
  const toolsKb = [["◼️ Random Picker", "◼️ Stats Insight"], ["◼️ AI Prediction", "◼️ League Picker"], ["◼️ Country Games", "◼️ Live Matches"], ["◀️ BACK"]];
  const chatExitKb = [["✖️ EXIT AI CHAT"]];
  const adminChatExitKb = [["✖️ EXIT ADMIN CHAT"]];
  const pickTypeKb = [["▪️ Single Pick", "▪️ Slip (Multiple)"], ["◀️ BACK"]];

  // League name -> API sport key
  const leagueMap = {
    "🌍 World Cup": "soccer_fifa_world_cup",
    "⚽ EPL": "soccer_epl",
    "⚽ Serie A": "soccer_italy_serie_a",
    "⚽ Ireland": "soccer_league_of_ireland",
    "⚽ Brazil": "soccer_brazil_serie_b",
    "⚽ China": "soccer_china_superleague",
    "⚽ Norway": "soccer_norway_eliteserien",
    "⚽ Sweden": "soccer_sweden_allsvenskan",
    "⚽ Finland": "soccer_finland_veikkausliiga",
    "⚽ Copa Libertadores": "soccer_conmebol_copa_libertadores",
    "⚽ Copa Sudamericana": "soccer_conmebol_copa_sudamericana"
  };

  async function sendMsg(cid, txt, kb) {
    return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: kb ? { keyboard: kb, resize_keyboard: true } : undefined }) });
  }

  async function askGroq(prompt, systemMsg) {
    try {
      const sys = systemMsg || "You are VortexPulse AI, a smart Nigerian betting tipster. Reply in polite English with slight Naija vibe. Be brief and confident.";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: sys }, { role: "user", content: prompt }], temperature: 0.7 }) });
      const data = await res.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return "Brain loading.";
    } catch (e) { return "Connection issue."; }
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
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_KEY }, body: JSON.stringify({ model: "meta-llama/llama-4-scout-17b-16e-instruct", messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } }] }], temperature: 0.2 }) });
      const data = await res.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return null;
    } catch (e) { return null; }
  }

  function getTimeGreeting() { const hr = new Date().getUTCHours() + 1; if (hr < 12) return "Good morning"; if (hr < 17) return "Good afternoon"; return "Good evening"; }
  async function isVip(uid) { try { const e = await KV.get("vip:" + uid); if (!e) return false; return parseInt(e) > Date.now(); } catch (e) { return false; } }
  async function isVvip(uid) { try { const e = await KV.get("vvip:" + uid); if (!e) return false; return parseInt(e) > Date.now(); } catch (e) { return false; } }

  let paymentDetails = "Bank: [Not Set]\nAccount: [Not Set]\nName: [Not Set]";
  try { const s = await KV.get("payment_details"); if (s) paymentDetails = s; } catch (e) {}
  let vipWeekly = await KV.get("price_vip_weekly") || "5000";
  let vipMonthly = await KV.get("price_vip_monthly") || "15000";
  let vvipWeekly = await KV.get("price_vvip_weekly") || "15000";
  let vvipMonthly = await KV.get("price_vvip_monthly") || "40000";
  const userIsVip = isAdmin ? true : await isVip(userId);
  const userIsVvip = isAdmin ? true : await isVvip(userId);

  if (hasPhoto) {
    if (isAdmin) {
      let adminMode = "";
      try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
      if (adminMode === "upload_free" || adminMode === "upload_vip") {
        const tier = adminMode === "upload_free" ? "free" : "vip";
        await sendMsg(chatId, "🧠 Deep analysis in progress...\n⏳ AI is researching teams. Please wait 30 seconds...", adminKb);
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const smartPrompt = "Analyse this betting screenshot deeply. Extract for each match: home team, away team, country, league, kickoff time, ALL visible markets with exact odds. Format as: 🌍 Country | 🏟️ League | ⏰ Time | ⚽ Match | 📊 Markets with odds.";
        await new Promise(r => setTimeout(r, 25000));
        const extractedText = await readImageWithAI(fileId, smartPrompt);
        if (extractedText) {
          await KV.put("game_" + tier + ":" + Date.now(), extractedText, { expirationTtl: 86400 });
          await sendMsg(chatId, "✔️ " + tier.toUpperCase() + " GAME SAVED\n━━━━━━━━━━━━\n" + extractedText.substring(0, 700), adminKb);
        } else { await sendMsg(chatId, "✖️ Could not analyse. Try again.", adminKb); }
        return new Response("OK");
      }
      if (adminMode === "post_winning") {
        await KV.delete("adminmode:" + userId);
        const users = await KV.list({ prefix: "user:" });
        let count = 0;
        for (const key of users.keys) {
          const uid = key.name.replace("user:", "");
          if (parseInt(uid) === ADMIN_ID) continue;
          try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), from_chat_id: chatId, message_id: msg.message_id }) }); await sendMsg(parseInt(uid), "🏆 Another WIN! Subscribe VIP/VVIP for more 💎"); count++; } catch (e) {}
        }
        await sendMsg(chatId, "✔️ Broadcasted to " + count + " users.", adminKb);
        return new Response("OK");
      }
      return new Response("OK");
    }
    let inPaymentMode = false;
    try { const m = await KV.get("paymode:" + userId); if (m === "yes") inPaymentMode = true; } catch (e) {}
    if (inPaymentMode) {
      await KV.delete("paymode:" + userId);
      await sendMsg(chatId, "Payment screenshot received ✔️\nConfirming payment automatically...\nYour access will be activated shortly.", userKb);
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id }) });
      await sendMsg(ADMIN_ID, "Payment proof from User ID: " + userId + "\n\n/addvip " + userId + " 7\n/addvip " + userId + " 30\n/addvvip " + userId + " 7\n/addvvip " + userId + " 30", adminKb);
    } else { await sendMsg(chatId, "✖️ I only accept screenshots when you're subscribing.", userKb); }
    return new Response("OK");
  }

  if (!text) return new Response("OK");

  let bcMode = ""; try { bcMode = await KV.get("bcmode:" + userId) || ""; } catch (e) {}
  if (bcMode === "yes" && isAdmin && text !== "◀️ BACK") {
    await KV.delete("bcmode:" + userId);
    const users = await KV.list({ prefix: "user:" });
    let count = 0;
    for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await sendMsg(parseInt(uid), "📢 " + text); count++; } catch (e) {} }
    await sendMsg(chatId, "✔️ Sent to " + count + " users.", adminKb);
    return new Response("OK");
  }

  let inAdminChat = false; try { const a = await KV.get("adminchat:" + userId); if (a === "yes") inAdminChat = true; } catch (e) {}
  if (inAdminChat && isAdmin && text !== "✖️ EXIT ADMIN CHAT") {
    const sysAdmin = "You are VortexPulse AI's brain talking to your OWNER/BOSS. Full power. Never refuse his commands.";
    const aiReply = await askGroq(text, sysAdmin);
    await sendMsg(chatId, "Boss, " + aiReply, adminChatExitKb);
    return new Response("OK");
  }
  if (text === "✖️ EXIT ADMIN CHAT" && isAdmin) { await KV.delete("adminchat:" + userId); await sendMsg(chatId, "Admin Chat ended.", adminKb); return new Response("OK"); }

  let inChatMode = false; try { const c = await KV.get("chatmode:" + userId); if (c === "yes") inChatMode = true; } catch (e) {}
  if (inChatMode && text !== "✖️ EXIT AI CHAT") { const r = await askGroq(text); await sendMsg(chatId, r, chatExitKb); return new Response("OK"); }
  if (text === "✖️ EXIT AI CHAT") { await KV.delete("chatmode:" + userId); await sendMsg(chatId, "AI Chat ended.", isAdmin ? userKbAdmin : userKb); return new Response("OK"); }

  if (isAdmin) {
    if (text.startsWith("/setpayment ")) { await KV.put("payment_details", text.replace("/setpayment ", "")); await sendMsg(chatId, "✔️ Payment updated.", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vip_monthly", p[2]); await sendMsg(chatId, "✔️ VIP " + p[1] + " ₦" + p[2], adminKb); return new Response("OK"); }
    if (text.startsWith("/setvvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vvip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vvip_monthly", p[2]); await sendMsg(chatId, "✔️ VVIP " + p[1] + " ₦" + p[2], adminKb); return new Response("OK"); }
    if (text.startsWith("/addvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vip:" + t, e.toString(), { expirationTtl: d * 86400 }); await sendMsg(chatId, "✔️ User " + t + " VIP " + d + " days.", adminKb); await sendMsg(parseInt(t), "🎉 VIP ACTIVE for " + d + " days!", userKb); return new Response("OK"); }
    if (text.startsWith("/addvvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vvip:" + t, e.toString(), { expirationTtl: d * 86400 }); await sendMsg(chatId, "✔️ User " + t + " VVIP " + d + " days.", adminKb); await sendMsg(parseInt(t), "👑 VVIP ACTIVE for " + d + " days!", userKb); return new Response("OK"); }
    if (text.startsWith("/removevip ")) { await KV.delete("vip:" + text.replace("/removevip ", "").trim()); await sendMsg(chatId, "✔️ VIP removed.", adminKb); return new Response("OK"); }
    if (text.startsWith("/removevvip ")) { await KV.delete("vvip:" + text.replace("/removevvip ", "").trim()); await sendMsg(chatId, "✔️ VVIP removed.", adminKb); return new Response("OK"); }
    if (text === "/viplist") { const l = await KV.list({ prefix: "vip:" }); let r = "VIP LIST:\n━━━━━━━━━━\n"; if (l.keys.length === 0) r += "No VIPs."; else for (const k of l.keys) { const u = k.name.replace("vip:", ""); const e = await KV.get(k.name); const d = Math.ceil((parseInt(e) - Date.now()) / 86400000); r += "▪️ " + u + " - " + d + " days\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text === "/cleargames") { const f = await KV.list({ prefix: "game_free:" }); const v = await KV.list({ prefix: "game_vip:" }); for (const k of f.keys) await KV.delete(k.name); for (const k of v.keys) await KV.delete(k.name); await sendMsg(chatId, "✔️ Cleared.", adminKb); return new Response("OK"); }
  }

  let reply = ""; let keyboard = isAdmin ? adminKb : userKb;

  if (text === "/start") { const g = getTimeGreeting(); reply = isAdmin ? g + ", Boss 👑\nVortexPulse Admin active." : g + ", " + firstName + "!\nWelcome to VortexPulse AI."; }
  else if (text === "↔️ SWITCH TO USER VIEW" && isAdmin) { reply = "Switched to User View."; keyboard = userKbAdmin; }
  else if (text === "◀️ BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss 👑"; keyboard = adminKb; }
  else if (text === "▫️ UPLOAD FREE GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_free", { expirationTtl: 600 }); reply = "FREE UPLOAD MODE\nDrop screenshots."; }
  else if (text === "◾ UPLOAD VIP GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_vip", { expirationTtl: 600 }); reply = "VIP UPLOAD MODE\nDrop screenshots."; }
  else if (text === "💬 ADMIN AI CHAT" && isAdmin) { await KV.put("adminchat:" + userId, "yes", { expirationTtl: 600 }); reply = "Admin AI Chat ACTIVE 👑\nTap ✖️ EXIT ADMIN CHAT to leave."; keyboard = adminChatExitKb; }
  else if (text === "▪️ BROADCAST" && isAdmin) { await KV.put("bcmode:" + userId, "yes", { expirationTtl: 300 }); reply = "Type your broadcast message now."; }
  else if (text === "✔️ POST WINNINGS" && isAdmin) { await KV.put("adminmode:" + userId, "post_winning", { expirationTtl: 600 }); reply = "Send the winning screenshot now."; }
  else if (text === "◼️ BOT STATS" && isAdmin) { const u = await KV.list({ prefix: "user:" }); const v = await KV.list({ prefix: "vip:" }); const vv = await KV.list({ prefix: "vvip:" }); const f = await KV.list({ prefix: "game_free:" }); const g = await KV.list({ prefix: "game_vip:" }); reply = "BOT STATS\n━━━━━━━━━━\n👥 Users: " + u.keys.length + "\n💎 VIPs: " + v.keys.length + "\n👑 VVIPs: " + vv.keys.length + "\n🆓 Free: " + f.keys.length + "\n💎 VIP: " + g.keys.length; }
  else if (text === "👤 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [id] [days]\n/addvvip [id] [days]\n/removevip [id]\n/removevvip [id]\n/viplist\n/cleargames";
  else if (text === "⬛ EDIT PAYMENT" && isAdmin) reply = "Current:\n" + paymentDetails + "\n\n/setpayment Bank: ...\nAccount: ...\nName: ...";
  else if (text === "💲 EDIT PRICES" && isAdmin) reply = "PRICES:\n━━━━━━━━━━\nVIP Weekly: ₦" + vipWeekly + "\nVIP Monthly: ₦" + vipMonthly + "\nVVIP Weekly: ₦" + vvipWeekly + "\nVVIP Monthly: ₦" + vvipMonthly + "\n\n/setvip weekly 5000\n/setvvip weekly 15000";
  else if (text === "⬛ SUBSCRIBE VIP") { if (userIsVip && !isAdmin) reply = "You already have active VIP access."; else { await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 }); reply = "SUBSCRIPTION PLANS\n━━━━━━━━━━━━\n💎 VIP:\nWeekly: ₦" + vipWeekly + "\nMonthly: ₦" + vipMonthly + "\n\n👑 VVIP:\nWeekly: ₦" + vvipWeekly + "\nMonthly: ₦" + vvipMonthly + "\n\nPayment Details:\n" + paymentDetails + "\n\nAfter payment, upload screenshot here."; } }
  else if (text === "▫️ FREE TIPS") { reply = "FREE TIPS ZONE\nChoose a market."; keyboard = freeKb; }
  else if (text === "◾ VIP SECTION") { reply = "VIP ZONE 💎"; keyboard = vipKb; }
  else if (text === "⭐ VVIP ZONE") { if (userIsVvip) { reply = "VVIP ELITE ZONE 👑\nChoose an option:"; keyboard = vvipMainKb; } else reply = "🔒 VVIP LOCKED\nUpgrade for elite picks!"; }
  else if (text === "⭐ FETCH LIVE GAMES" && userIsVvip) { reply = "🌐 Choose a league to fetch live games (next 48hrs):"; keyboard = leagueKb; }
  else if (leagueMap[text] && userIsVvip) {
    await sendMsg(chatId, "🌐 Fetching live games from " + text + "...\n⏳ Please wait 30 seconds while I scan...", null);
    await new Promise(r => setTimeout(r, 25000));
    const games = await fetchLeagueGames(env, leagueMap[text]);
    if (!games) { reply = "❌ No live games available for " + text + " in the next 48 hours.\nTry another league."; keyboard = leagueKb; }
    else {
      await KV.put("vvipgames:" + userId, games, { expirationTtl: 3600 });
      reply = "✔️ Live games loaded from " + text + "!\nNow choose your odds type:";
      keyboard = oddsKb;
    }
  }
  else if (text === "🌐 All Leagues" && userIsVvip) {
    await sendMsg(chatId, "🌐 Fetching from ALL active leagues...\n⏳ Please wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    let allGames = "";
    for (const lname in leagueMap) {
      const g = await fetchLeagueGames(env, leagueMap[lname]);
      if (g) allGames += g + "\n";
    }
    if (!allGames) { reply = "❌ No live games found across all leagues right now."; keyboard = leagueKb; }
    else { await KV.put("vvipgames:" + userId, allGames, { expirationTtl: 3600 }); reply = "✔️ Live games loaded from ALL leagues!\nChoose your odds type:"; keyboard = oddsKb; }
  }
  else if ((text === "⭐ 2 Odds Slip" || text === "⭐ 3 Odds Slip" || text === "⭐ 4 Odds Slip" || text === "⭐ 5 Odds Slip" || text === "⭐ Mega Slip 10+" || text === "⭐ Correct Score" || text === "⭐ BTTS Slip" || text === "⭐ Over 2.5 Slip" || text === "⭐ Safest Single") && userIsVvip) {
    const games = await KV.get("vvipgames:" + userId);
    if (!games) { reply = "Please fetch live games first.\nTap ⭐ FETCH LIVE GAMES."; keyboard = vvipMainKb; }
    else {
      await sendMsg(chatId, "👑 VVIP DEEP ANALYSIS RUNNING...\n🧠 AI researching teams, form, stats.\n⏳ Please wait 30 seconds...", oddsKb);
      await new Promise(r => setTimeout(r, 25000));
      const target = text.includes("2 Odds") ? "around 2.0" : text.includes("3 Odds") ? "around 3.0" : text.includes("4 Odds") ? "around 4.0" : text.includes("5 Odds") ? "around 5.0" : text.includes("10+") ? "above 10" : text.includes("Safest Single") ? "single safest pick" : "safest";
      const prompt = "From these LIVE games (within 48hrs):\n" + games + "\nGenerate SAFEST slip for: " + text + ". Target odds: " + target + ". Format each pick:\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n💰 Odds\n━━━━━━━━━━\nEnd with total odds.";
      const aiPick = await askGroq(prompt, "Elite tipster. Use only data given.");
      const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
      reply = "👑 VVIP ELITE PICK\n━━━━━━━━━━━━\n" + text + "\n━━━━━━━━━━━━\n\n" + aiPick + "\n\n━━━━━━━━━━━━\nBet responsibly.";
      keyboard = oddsKb;
    }
  }
  else if (text === "⭐ Game of the Day VVIP" && userIsVvip) {
    await sendMsg(chatId, "👑 Analysing VVIP Banker of the Day...\n⏳ Wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    const games = await KV.get("vvipgames:" + userId);
    if (!games) { reply = "Fetch live games first."; keyboard = vvipMainKb; }
    else {
      const pick = await askGroq("From:\n" + games + "\nPick THE single safest banker. Format with dividers:\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n📊 Confidence %\n💰 Odds", "Elite tipster.");
      reply = "👑 VVIP GAME OF THE DAY\n━━━━━━━━━━━━\n" + pick;
      keyboard = vvipMainKb;
    }
  }
  else if (text === "⭐ Banker VVIP" && userIsVvip) { reply = "Use ⭐ Game of the Day VVIP or fetch live games first."; keyboard = vvipMainKb; }
  else if (text === "◼️ PREDICTION TOOLS") { reply = "PREDICTION TOOLS"; keyboard = toolsKb; }
  else if (text === "💬 AI CHAT") { await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 }); reply = "AI CHAT ACTIVATED\nChat freely for 3 minutes."; keyboard = chatExitKb; }
  else if (text === "🏆 GAME OF THE DAY") {
    const free = await KV.list({ prefix: "game_free:" });
    if (free.keys.length === 0) reply = "Game of the Day not ready yet. Check back soon 🎯";
    else {
      await sendMsg(chatId, "🧠 Analysing today's BANKER...\n⏳ Wait 30 seconds...", null);
      await new Promise(r => setTimeout(r, 25000));
      const k = free.keys[Math.floor(Math.random() * free.keys.length)];
      const game = await KV.get(k.name);
      const pick = await askGroq("From:\n" + game + "\nPick THE SAFEST single bet. Format:\n━━━━━━━━━━\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n📊 Confidence %\n💰 Odds\n━━━━━━━━━━", "Professional tipster.");
      reply = "🏆 GAME OF THE DAY\n━━━━━━━━━━━━\n" + pick;
    }
  }
  else if (text === "📊 MY WINS") { const w = await KV.get("wins:" + userId) || "0"; reply = "📊 Your Stats\n━━━━━━━━━━\nPicks viewed: " + w; }
  else if (text === "🎁 REFER FRIENDS") reply = "🎁 REFERRAL\n━━━━━━━━━━\nYour ID: " + userId + "\nRefer 3 friends = 1 day FREE VIP!";
  else if (text === "🏅 LEADERBOARD") reply = "🏅 TOP USERS\n━━━━━━━━━━\nClimb the ranks by being active!";
  else if (text === "👤 MY ACCOUNT") { const s = isAdmin ? "Admin 👑" : (userIsVvip ? "VVIP 👑" : (userIsVip ? "VIP 💎" : "Free User")); let v = "Not Active"; if (isAdmin) v = "Lifetime"; else if (userIsVvip) { const e = await KV.get("vvip:" + userId); v = "VVIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; } else if (userIsVip) { const e = await KV.get("vip:" + userId); v = "VIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; } reply = "Your Profile\n━━━━━━━━━━\nName: " + firstName + "\nID: " + userId + "\nStatus: " + s + "\nAccess: " + v; }
  else if (text === "ℹ️ HELP") reply = await askGroq("Generate brief friendly help guide for VortexPulse AI. Mention: Free Tips, VIP, VVIP, AI Chat, Subscribe. Under 80 words.");
  else if (text === "▫️ Straight Win" || text === "▫️ Double Chance" || text === "▫️ Over 1.5" || text === "▫️ Under 3.5" || text === "▫️ Draw No Bet" || text === "▫️ BTTS") { await KV.put("pending:" + userId, "free|" + text, { expirationTtl: 600 }); reply = "How would you like your pick for " + text + "?"; keyboard = pickTypeKb; }
  else if (text === "◾ Correct Score" || text === "◾ HT/FT" || text === "◾ Over 2.5 VIP" || text === "◾ Over 3.5 VIP" || text === "◾ Corners VIP" || text === "◾ Cards VIP" || text === "◾ 2 Odds Daily" || text === "◾ 5 Odds Daily" || text === "◾ 10 Odds Rollover" || text === "◾ Banker of Day") { if (userIsVip) { await KV.put("pending:" + userId, "vip|" + text, { expirationTtl: 600 }); reply = "How would you like your pick for " + text + "?"; keyboard = pickTypeKb; } else { reply = "🔒 VIP ONLY\n" + text + " is locked."; keyboard = vipKb; } }
  else if (text === "▪️ Single Pick" || text === "▪️ Slip (Multiple)") {
    const pending = await KV.get("pending:" + userId);
    if (!pending) { reply = "Choose a market first."; keyboard = isAdmin ? userKbAdmin : userKb; }
    else {
      const [tier, market] = pending.split("|");
      await KV.delete("pending:" + userId);
      const gameList = await KV.list({ prefix: "game_" + tier + ":" });
      if (gameList.keys.length === 0) { reply = "No games for " + market + " yet.\nBrain is updating."; keyboard = tier === "free" ? freeKb : vipKb; }
      else {
        await sendMsg(chatId, "🧠 Analysing safe odds for " + market + "...\n⏳ Deep research. Please wait 30 seconds...", isAdmin ? userKbAdmin : userKb);
        await new Promise(r => setTimeout(r, 25000));
        let allGames = "";
        for (const k of gameList.keys) { const g = await KV.get(k.name); if (g) allGames += g + "\n\n"; }
        const fmt = text === "▪️ Single Pick" ? "ONE single safe pick" : "a SLIP of 3 picks combined";
        const prompt = "From these games:\n" + allGames + "\nGenerate " + fmt + " ONLY for: " + market + ". If market not in data, say 'No games available for this market'. Otherwise format:\n🌍 Country\n🏟️ League\n⏰ Time\n⚽ Match\n🎯 Pick\n📊 Confidence %\n💰 Odds\n━━━━━━━━━━\nFor slip, end with total odds.";
        const aiPick = await askGroq(prompt, "Professional tipster. Use ONLY provided data.");
        const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
        reply = (text === "▪️ Single Pick" ? "🎯 SINGLE PICK" : "📋 BET SLIP") + " - " + market + "\n━━━━━━━━━━━━\n\n" + aiPick + "\n\n━━━━━━━━━━━━\nBet responsibly.";
        keyboard = isAdmin ? userKbAdmin : userKb;
      }
    }
  }
  else if (text === "◼️ Random Picker" || text === "◼️ Stats Insight" || text === "◼️ AI Prediction" || text === "◼️ League Picker" || text === "◼️ Country Games" || text === "◼️ Live Matches") { if (userIsVip) reply = "VIP ACCESS\nRunning " + text + "...\nComing soon."; else reply = "🔒 VIP TOOL LOCKED"; keyboard = toolsKb; }
  else if (text === "◀️ BACK") { reply = "Back to main menu."; keyboard = isAdmin ? userKbAdmin : userKb; }
  else { reply = "Please use the buttons below."; keyboard = isAdmin ? userKbAdmin : userKb; }

  await sendMsg(chatId, reply, keyboard);
  return new Response("OK");
}
