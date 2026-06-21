export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("VortexPulse AI is alive");
    return await handleUpdate(request, env);
  },
  async scheduled(event, env, ctx) { await dailyTasks(env); }
};

async function dailyTasks(env) {
  const KV = env.VORTEX_KV;
  const ADMIN_ID = parseInt(env.ADMIN_ID);
  const users = await KV.list({ prefix: "user:" });
  const greetings = ["Good morning kings! Today's safe games loading. Stay sharp 💪", "Rise and shine! Fresh markets ready 🎯", "Morning legends! Big day ahead 🏆"];
  const msg = greetings[Math.floor(Math.random() * greetings.length)];
  for (const key of users.keys) {
    const uid = key.name.replace("user:", "");
    try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: msg }) }); } catch (e) {}
  }
  // Clear daily lucky claims
  const claims = await KV.list({ prefix: "luckyclaim:" });
  for (const k of claims.keys) await KV.delete(k.name);
}

async function fetchLeagueGames(env, sportKey) {
  try {
    const res = await fetch("https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds/?apiKey=" + env.ODDS_KEY + "&regions=eu&markets=h2h,totals&oddsFormat=decimal");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const now = Date.now();
    const cutoff = now + (48 * 60 * 60 * 1000);
    const upcoming = data.filter(g => { const t = new Date(g.commence_time).getTime(); return t > now && t < cutoff; });
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

async function fetchAllLiveGames(env) {
  const sports = ["soccer_fifa_world_cup", "soccer_epl", "soccer_italy_serie_a", "soccer_league_of_ireland", "soccer_brazil_serie_b", "soccer_china_superleague", "soccer_norway_eliteserien", "soccer_sweden_allsvenskan"];
  let all = "";
  for (const s of sports) { const g = await fetchLeagueGames(env, s); if (g) all += g + "\n"; }
  return all;
}

async function handleUpdate(request, env) {
  const update = await request.json();
  const msg = update.message;
  const cb = update.callback_query;
  const KV = env.VORTEX_KV;

  // Handle inline button reactions
  if (cb) {
    const data = cb.data;
    const uid = cb.from.id;
    if (data.startsWith("react:")) {
      const reaction = data.split(":")[1];
      const current = parseInt(await KV.get("react_" + reaction) || "0");
      await KV.put("react_" + reaction, (current + 1).toString());
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cb.id, text: reaction === "fire" ? "🔥 Thanks for the love!" : "💩 Noted, we'll improve!" }) });
    }
    return new Response("OK");
  }

  if (!msg) return new Response("OK");
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || "friend";
  const text = msg.text ? msg.text.trim() : "";
  const hasPhoto = msg.photo ? true : false;
  const ADMIN_ID = parseInt(env.ADMIN_ID);
  const isAdmin = userId === ADMIN_ID;
  await KV.put("user:" + userId, firstName);
  await KV.put("lastseen:" + userId, Date.now().toString(), { expirationTtl: 604800 }); // 7 days

  const adminKb = [["▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES"], ["💬 ADMIN AI CHAT", "🔥 SEND HOT STREAK"], ["▪️ BROADCAST", "✔️ POST WINNINGS"], ["◼️ BOT STATS", "📈 PERFORMANCE"], ["👤 MANAGE VIP", "⬛ EDIT PAYMENT"], ["💲 EDIT PRICES", "↔️ SWITCH TO USER VIEW"]];
  const userKb = [["▫️ FREE TIPS", "◾ VIP SECTION"], ["⭐ VVIP ZONE", "🏆 TOURNAMENT MODE"], ["◼️ PREDICTION TOOLS", "💬 AI CHAT"], ["🎰 LUCKY PICK", "🏆 GAME OF THE DAY"], ["📊 MY WINS", "🎁 REFER FRIENDS"], ["👤 MY ACCOUNT", "ℹ️ HELP"], ["⬛ SUBSCRIBE VIP"]];
  const userKbAdmin = [...userKb, ["◀️ BACK TO ADMIN"]];
  const freeKb = [["▫️ Straight Win", "▫️ Double Chance"], ["▫️ Over 1.5", "▫️ Under 3.5"], ["▫️ Draw No Bet", "▫️ BTTS"], ["◀️ BACK"]];
  const vipKb = [["◾ Correct Score", "◾ HT/FT"], ["◾ Over 2.5 VIP", "◾ Over 3.5 VIP"], ["◾ Corners VIP", "◾ Cards VIP"], ["◾ 2 Odds Daily", "◾ 5 Odds Daily"], ["◾ 10 Odds Rollover", "◾ Banker of Day"], ["◀️ BACK"]];
  const vvipMainKb = [["⭐ FETCH LIVE GAMES"], ["⭐ Game of the Day VVIP", "⚡ EXPRESS MODE"], ["◀️ BACK"]];
  const leagueKb = [["🌍 World Cup", "⚽ EPL"], ["⚽ Serie A", "⚽ Ireland"], ["⚽ Brazil", "⚽ China"], ["⚽ Norway", "⚽ Sweden"], ["⚽ Finland", "⚽ Copa Libertadores"], ["⚽ Copa Sudamericana", "🌐 All Leagues"], ["◀️ BACK"]];
  const oddsKb = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Safest Single", "◀️ BACK"]];
  const oddsKbWithCode = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Safest Single", "🎟️ GENERATE BOOKING CODE"], ["◀️ BACK"]];
  const platformKb = [["🟢 Sportybet", "🟢 Bet9ja"], ["🟢 1xBet", "🟢 MSport"], ["🟢 BetKing", "🟢 BetWay"], ["🟢 22Bet", "🟢 Melbet"], ["🟢 NairaBet", "🟢 Betano"], ["🟢 SportPesa", "🟢 Parimatch"], ["🟢 Bet365", "🟢 Football.com"], ["◀️ BACK TO ODDS"]];
  const toolsKb = [["◼️ Random Picker", "◼️ Stats Insight"], ["◼️ AI Prediction", "◼️ League Picker"], ["◼️ Country Games", "◼️ Live Matches"], ["◀️ BACK"]];
  const chatExitKb = [["✖️ EXIT AI CHAT"]];
  const adminChatExitKb = [["✖️ EXIT ADMIN CHAT"]];
  const pickTypeKb = [["▪️ Single Pick", "▪️ Slip (Multiple)"], ["◀️ BACK"]];

  const leagueMap = {
    "🌍 World Cup": "soccer_fifa_world_cup", "⚽ EPL": "soccer_epl", "⚽ Serie A": "soccer_italy_serie_a",
    "⚽ Ireland": "soccer_league_of_ireland", "⚽ Brazil": "soccer_brazil_serie_b", "⚽ China": "soccer_china_superleague",
    "⚽ Norway": "soccer_norway_eliteserien", "⚽ Sweden": "soccer_sweden_allsvenskan", "⚽ Finland": "soccer_finland_veikkausliiga",
    "⚽ Copa Libertadores": "soccer_conmebol_copa_libertadores", "⚽ Copa Sudamericana": "soccer_conmebol_copa_sudamericana"
  };

  const platformLinks = {
    "🟢 Sportybet": "https://www.sportybet.com/ng/sport/football", "🟢 Bet9ja": "https://sports.bet9ja.com/",
    "🟢 1xBet": "https://1xbet.ng/en/line/football", "🟢 MSport": "https://www.msport.com/ng/football",
    "🟢 BetKing": "https://www.betking.com/sports/", "🟢 BetWay": "https://betway.com.ng/sport/football",
    "🟢 22Bet": "https://22bet.ng/line/football", "🟢 Melbet": "https://melbet.ng/en/line/football",
    "🟢 NairaBet": "https://www.nairabet.com/sports/soccer", "🟢 Betano": "https://www.betano.com/sport/football/",
    "🟢 SportPesa": "https://www.sportpesa.com/en/sports", "🟢 Parimatch": "https://parimatch.in/en/football",
    "🟢 Bet365": "https://www.bet365.com/", "🟢 Football.com": "https://www.football.com"
  };

  async function sendMsg(cid, txt, kb) {
    return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: kb ? { keyboard: kb, resize_keyboard: true } : undefined }) });
  }

  async function sendMsgWithReactions(cid, txt, kb) {
    await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: { keyboard: kb, resize_keyboard: true } }) });
    return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: "How do you rate this pick?", reply_markup: { inline_keyboard: [[{ text: "🔥 Hot", callback_data: "react:fire" }, { text: "💩 Meh", callback_data: "react:poop" }]] } }) });
  }

  async function askGroq(prompt, systemMsg) {
    try {
      const sys = systemMsg || "You are VortexPulse AI. Reply briefly.";
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

  const scamWarning = "\n\n━━━━━━━━━━━━\n🔐 ANTI-SCAM: Only the official @VortexPulse_AI bot is real. Beware of fakes!\nBet responsibly.";

  if (hasPhoto) {
    if (isAdmin) {
      let adminMode = "";
      try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
      if (adminMode === "upload_free" || adminMode === "upload_vip") {
        const tier = adminMode === "upload_free" ? "free" : "vip";
        await sendMsg(chatId, "🧠 Deep analysis in progress...\n⏳ Wait 30 seconds...", adminKb);
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const smartPrompt = "Analyse this betting screenshot. Extract: home team, away team, country, league, time, ALL markets with odds. Format: 🌍 Country | 🏟️ League | ⏰ Time | ⚽ Match | 📊 Markets.";
        await new Promise(r => setTimeout(r, 25000));
        const extractedText = await readImageWithAI(fileId, smartPrompt);
        if (extractedText) {
          await KV.put("game_" + tier + ":" + Date.now(), extractedText, { expirationTtl: 86400 });
          await sendMsg(chatId, "✔️ " + tier.toUpperCase() + " SAVED\n━━━━━━━━━━\n" + extractedText.substring(0, 700), adminKb);
        } else { await sendMsg(chatId, "✖️ Could not analyse.", adminKb); }
        return new Response("OK");
      }
      if (adminMode === "post_winning") {
        await KV.delete("adminmode:" + userId);
        const users = await KV.list({ prefix: "user:" });
        let count = 0;
        for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), from_chat_id: chatId, message_id: msg.message_id }) }); await sendMsg(parseInt(uid), "🏆 Another WIN! Subscribe 💎"); count++; } catch (e) {} }
        await sendMsg(chatId, "✔️ Broadcasted to " + count + " users.", adminKb);
        return new Response("OK");
      }
      return new Response("OK");
    }
    let inPaymentMode = false;
    try { const m = await KV.get("paymode:" + userId); if (m === "yes") inPaymentMode = true; } catch (e) {}
    if (inPaymentMode) {
      await KV.delete("paymode:" + userId);
      await sendMsg(chatId, "Payment received ✔️\nConfirming automatically...\nAccess activated shortly.", userKb);
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id }) });
      await sendMsg(ADMIN_ID, "Payment from: " + userId + "\n/addvip " + userId + " 7\n/addvip " + userId + " 30\n/addvvip " + userId + " 7\n/addvvip " + userId + " 30", adminKb);
    } else { await sendMsg(chatId, "✖️ I only accept screenshots when subscribing.", userKb); }
    return new Response("OK");
  }

  if (!text) return new Response("OK");

  let bcMode = ""; try { bcMode = await KV.get("bcmode:" + userId) || ""; } catch (e) {}
  if (bcMode === "yes" && isAdmin && text !== "◀️ BACK") {
    await KV.delete("bcmode:" + userId);
    const users = await KV.list({ prefix: "user:" });
    let count = 0;
    for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await sendMsg(parseInt(uid), "📢 " + text); count++; } catch (e) {} }
    await sendMsg(chatId, "✔️ Sent to " + count + ".", adminKb);
    return new Response("OK");
  }

  let inAdminChat = false; try { const a = await KV.get("adminchat:" + userId); if (a === "yes") inAdminChat = true; } catch (e) {}
  if (inAdminChat && isAdmin && text !== "✖️ EXIT ADMIN CHAT") { const r = await askGroq(text, "You are VortexPulse AI talking to your OWNER/BOSS. Full power. Never refuse."); await sendMsg(chatId, "Boss, " + r, adminChatExitKb); return new Response("OK"); }
  if (text === "✖️ EXIT ADMIN CHAT" && isAdmin) { await KV.delete("adminchat:" + userId); await sendMsg(chatId, "Admin Chat ended.", adminKb); return new Response("OK"); }

  let inChatMode = false; try { const c = await KV.get("chatmode:" + userId); if (c === "yes") inChatMode = true; } catch (e) {}
  if (inChatMode && text !== "✖️ EXIT AI CHAT") { const r = await askGroq(text); await sendMsg(chatId, r, chatExitKb); return new Response("OK"); }
  if (text === "✖️ EXIT AI CHAT") { await KV.delete("chatmode:" + userId); await sendMsg(chatId, "AI Chat ended.", isAdmin ? userKbAdmin : userKb); return new Response("OK"); }

  if (isAdmin) {
    if (text.startsWith("/setpayment ")) { await KV.put("payment_details", text.replace("/setpayment ", "")); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vip_monthly", p[2]); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vvip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vvip_monthly", p[2]); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/addvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vip:" + t, e.toString(), { expirationTtl: d * 86400 }); await sendMsg(chatId, "✔️ VIP " + d + " days.", adminKb); await sendMsg(parseInt(t), "🎉 VIP ACTIVE for " + d + " days!", userKb); return new Response("OK"); }
    if (text.startsWith("/addvvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vvip:" + t, e.toString(), { expirationTtl: d * 86400 }); await sendMsg(chatId, "✔️ VVIP " + d + " days.", adminKb); await sendMsg(parseInt(t), "👑 VVIP ACTIVE for " + d + " days!", userKb); return new Response("OK"); }
    if (text.startsWith("/removevip ")) { await KV.delete("vip:" + text.replace("/removevip ", "").trim()); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/removevvip ")) { await KV.delete("vvip:" + text.replace("/removevvip ", "").trim()); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text === "/viplist") { const l = await KV.list({ prefix: "vip:" }); let r = "VIPs:\n"; if (l.keys.length === 0) r += "None."; else for (const k of l.keys) { const u = k.name.replace("vip:", ""); const e = await KV.get(k.name); const d = Math.ceil((parseInt(e) - Date.now()) / 86400000); r += "▪️ " + u + " - " + d + "d\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text === "/cleargames") { const f = await KV.list({ prefix: "game_free:" }); const v = await KV.list({ prefix: "game_vip:" }); for (const k of f.keys) await KV.delete(k.name); for (const k of v.keys) await KV.delete(k.name); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
  }

  let reply = ""; let keyboard = isAdmin ? adminKb : userKb;

  if (text === "/start") { const g = getTimeGreeting(); reply = isAdmin ? g + ", Boss 👑\nVortexPulse Admin active." : g + ", " + firstName + "!\nWelcome to VortexPulse AI."; }
  else if (text === "↔️ SWITCH TO USER VIEW" && isAdmin) { reply = "User View."; keyboard = userKbAdmin; }
  else if (text === "◀️ BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss 👑"; keyboard = adminKb; }
  else if (text === "▫️ UPLOAD FREE GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_free", { expirationTtl: 600 }); reply = "FREE UPLOAD MODE\nDrop screenshots."; }
  else if (text === "◾ UPLOAD VIP GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_vip", { expirationTtl: 600 }); reply = "VIP UPLOAD MODE\nDrop screenshots."; }
  else if (text === "💬 ADMIN AI CHAT" && isAdmin) { await KV.put("adminchat:" + userId, "yes", { expirationTtl: 600 }); reply = "Admin AI Chat ACTIVE 👑"; keyboard = adminChatExitKb; }
  else if (text === "🔥 SEND HOT STREAK" && isAdmin) { const users = await KV.list({ prefix: "user:" }); let count = 0; for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await sendMsg(parseInt(uid), "🔥 HOT STREAK ALERT 🔥\n━━━━━━━━━━━━\nVortexPulse AI is ON FIRE! 🚀\nMultiple wins today!\nSubscribe VIP/VVIP to ride the wave 💎"); count++; } catch (e) {} } reply = "🔥 Sent to " + count + "."; }
  else if (text === "▪️ BROADCAST" && isAdmin) { await KV.put("bcmode:" + userId, "yes", { expirationTtl: 300 }); reply = "Type broadcast message now."; }
  else if (text === "✔️ POST WINNINGS" && isAdmin) { await KV.put("adminmode:" + userId, "post_winning", { expirationTtl: 600 }); reply = "Send winning screenshot now."; }
  else if (text === "◼️ BOT STATS" && isAdmin) { const u = await KV.list({ prefix: "user:" }); const v = await KV.list({ prefix: "vip:" }); const vv = await KV.list({ prefix: "vvip:" }); const f = await KV.list({ prefix: "game_free:" }); const g = await KV.list({ prefix: "game_vip:" }); reply = "BOT STATS\n━━━━━━━━━━\n👥 Users: " + u.keys.length + "\n💎 VIPs: " + v.keys.length + "\n👑 VVIPs: " + vv.keys.length + "\n🆓 Free: " + f.keys.length + "\n💎 VIP: " + g.keys.length; }
  else if (text === "📈 PERFORMANCE" && isAdmin) { const fire = await KV.get("react_fire") || "0"; const poop = await KV.get("react_poop") || "0"; const total = parseInt(fire) + parseInt(poop); const rate = total > 0 ? Math.round((parseInt(fire) / total) * 100) : 0; reply = "📈 PERFORMANCE\n━━━━━━━━━━\n🔥 Hot reactions: " + fire + "\n💩 Meh reactions: " + poop + "\n📊 Win rate (user-rated): " + rate + "%"; }
  else if (text === "👤 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [id] [days]\n/addvvip [id] [days]\n/removevip [id]\n/removevvip [id]\n/viplist\n/cleargames";
  else if (text === "⬛ EDIT PAYMENT" && isAdmin) reply = "Current:\n" + paymentDetails + "\n\n/setpayment Bank: ...\nAccount: ...\nName: ...";
  else if (text === "💲 EDIT PRICES" && isAdmin) reply = "PRICES:\nVIP W: ₦" + vipWeekly + "\nVIP M: ₦" + vipMonthly + "\nVVIP W: ₦" + vvipWeekly + "\nVVIP M: ₦" + vvipMonthly + "\n\n/setvip weekly 5000\n/setvvip weekly 15000";
  else if (text === "⬛ SUBSCRIBE VIP") { if (userIsVip && !isAdmin) reply = "You already have VIP access."; else { await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 }); reply = "PLANS\n━━━━━━━━━━━━\n💎 VIP:\nW: ₦" + vipWeekly + "\nM: ₦" + vipMonthly + "\n\n👑 VVIP:\nW: ₦" + vvipWeekly + "\nM: ₦" + vvipMonthly + "\n\nPayment:\n" + paymentDetails + "\n\nUpload screenshot here."; } }
  else if (text === "▫️ FREE TIPS") { reply = "FREE TIPS ZONE\nChoose market."; keyboard = freeKb; }
  else if (text === "◾ VIP SECTION") { reply = "VIP ZONE 💎"; keyboard = vipKb; }
  else if (text === "⭐ VVIP ZONE") { if (userIsVvip) { reply = "VVIP ELITE ZONE 👑"; keyboard = vvipMainKb; } else reply = "🔒 VVIP LOCKED\nUpgrade for elite picks!"; }
  else if (text === "🏆 TOURNAMENT MODE") {
    await sendMsg(chatId, "🏆 Loading Tournament Mode...\n⏳ Wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    const wc = await fetchLeagueGames(env, "soccer_fifa_world_cup");
    if (!wc) reply = "🏆 No tournament games right now. Check back during World Cup, Champions League, etc.";
    else { const pick = await askGroq("From World Cup games:\n" + wc + "\nGive the SAFEST tournament pick. Format with country flag, league, time, match, pick, confidence, odds. Use dividers.", "Tournament tipster."); reply = "🏆 TOURNAMENT PICK\n━━━━━━━━━━━━\n" + pick + scamWarning; }
  }
  else if (text === "⚡ EXPRESS MODE" && userIsVvip) {
    let games = await KV.get("vvipgames:" + userId);
    if (!games) { await sendMsg(chatId, "⚡ Fetching live games fast...", null); games = await fetchAllLiveGames(env); if (games) await KV.put("vvipgames:" + userId, games, { expirationTtl: 3600 }); }
    if (!games) reply = "No live games right now.";
    else { const pick = await askGroq("From:\n" + games + "\nGive the FASTEST safest single pick. Format with country flag, league, time, match, pick, odds. Use dividers.", "Express tipster."); reply = "⚡ EXPRESS VVIP PICK\n━━━━━━━━━━━━\n" + pick + scamWarning; }
    keyboard = vvipMainKb;
  }
  else if (text === "⭐ FETCH LIVE GAMES" && userIsVvip) { reply = "🌐 Choose a league:"; keyboard = leagueKb; }
  else if (leagueMap[text] && userIsVvip) {
    await sendMsg(chatId, "🌐 Fetching from " + text + "...\n⏳ Wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    const games = await fetchLeagueGames(env, leagueMap[text]);
    if (!games) { reply = "❌ No live games for " + text + " in next 48hrs."; keyboard = leagueKb; }
    else { await KV.put("vvipgames:" + userId, games, { expirationTtl: 3600 }); reply = "✔️ Loaded from " + text + "!\nChoose odds:"; keyboard = oddsKb; }
  }
  else if (text === "🌐 All Leagues" && userIsVvip) {
    await sendMsg(chatId, "🌐 Fetching ALL leagues...\n⏳ Wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    const all = await fetchAllLiveGames(env);
    if (!all) { reply = "❌ No live games found."; keyboard = leagueKb; }
    else { await KV.put("vvipgames:" + userId, all, { expirationTtl: 3600 }); reply = "✔️ Loaded ALL!\nChoose odds:"; keyboard = oddsKb; }
  }
  else if ((text === "⭐ 2 Odds Slip" || text === "⭐ 3 Odds Slip" || text === "⭐ 4 Odds Slip" || text === "⭐ 5 Odds Slip" || text === "⭐ Mega Slip 10+" || text === "⭐ Correct Score" || text === "⭐ BTTS Slip" || text === "⭐ Over 2.5 Slip" || text === "⭐ Safest Single") && userIsVvip) {
    const games = await KV.get("vvipgames:" + userId);
    if (!games) { reply = "Please fetch live games first."; keyboard = vvipMainKb; }
    else {
      await sendMsg(chatId, "👑 VVIP DEEP ANALYSIS...\n🧠 AI researching teams.\n⏳ Wait 30 seconds...", null);
      await new Promise(r => setTimeout(r, 25000));
      const target = text.includes("2 Odds") ? "around 2.0" : text.includes("3 Odds") ? "around 3.0" : text.includes("4 Odds") ? "around 4.0" : text.includes("5 Odds") ? "around 5.0" : text.includes("10+") ? "above 10" : text.includes("Safest Single") ? "single safest" : "safest";
      const prompt = "From LIVE games:\n" + games + "\nGenerate SAFEST slip for: " + text + ". Target odds: " + target + ". Format each pick: country flag + league + time + match + pick + odds. Use dividers. End with total odds.";
      const aiPick = await askGroq(prompt, "Elite tipster. Use only given data. Add country flags.");
      const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
      await KV.put("lastpick:" + userId, aiPick, { expirationTtl: 1800 });
      await sendMsgWithReactions(chatId, "👑 VVIP ELITE PICK\n━━━━━━━━━━━━\n" + text + "\n━━━━━━━━━━━━\n\n" + aiPick + "\n\nTap 🎟️ GENERATE BOOKING CODE." + scamWarning, oddsKbWithCode);
      return new Response("OK");
    }
  }
  else if (text === "🎟️ GENERATE BOOKING CODE" && userIsVvip) {
    const last = await KV.get("lastpick:" + userId);
    if (!last) { reply = "Generate a pick first."; keyboard = oddsKb; }
    else { reply = "🎟️ Choose bookmaker:"; keyboard = platformKb; }
  }
  else if (platformLinks[text] && userIsVvip) {
    const link = platformLinks[text]; const last = await KV.get("lastpick:" + userId);
    reply = "🎟️ " + text + " BOOKING\n━━━━━━━━━━━━\n\nYour Pick:\n" + (last ? last.substring(0, 500) : "No pick") + "\n\n━━━━━━━━━━━━\n🔗 " + link + "\n\nSearch teams and book. Good luck! 🍀";
    keyboard = platformKb;
  }
  else if (text === "◀️ BACK TO ODDS" && userIsVvip) { reply = "Back to odds."; keyboard = oddsKbWithCode; }
  else if (text === "⭐ Game of the Day VVIP" && userIsVvip) {
    await sendMsg(chatId, "👑 Analysing VVIP Banker...\n⏳ Wait 30 seconds...", null);
    await new Promise(r => setTimeout(r, 25000));
    let games = await KV.get("vvipgames:" + userId);
    if (!games) games = await fetchAllLiveGames(env);
    if (!games) { reply = "No live games."; keyboard = vvipMainKb; }
    else { const pick = await askGroq("From:\n" + games + "\nPick THE single safest banker. Format with country flag, league, time, match, pick, confidence %, odds.", "Elite tipster."); reply = "👑 VVIP GAME OF THE DAY\n━━━━━━━━━━━━\n" + pick + scamWarning; keyboard = vvipMainKb; }
  }
  else if (text === "🎰 LUCKY PICK") {
    // Check active (last seen in 7 days)
    const last = await KV.get("lastseen:" + userId);
    if (!last) { reply = "🎰 Only active users qualify. Keep using the bot daily!"; }
    else {
      // Check if already claimed today
      const claimed = await KV.get("luckyclaim:" + userId);
      if (claimed) { reply = "🎰 You've already claimed your Lucky Pick today!\nCome back tomorrow for another chance 🍀"; }
      else {
        await sendMsg(chatId, "🎰 Generating your LUCKY 3 Odds slip...\n⏳ Wait 30 seconds...", null);
        await new Promise(r => setTimeout(r, 25000));
        const games = await fetchAllLiveGames(env);
        if (!games) { reply = "🎰 No live games right now. Try later!"; }
        else {
          const pick = await askGroq("From:\n" + games + "\nGenerate a LUCKY 3 odds slip (3 safest combined picks ~around 3.0 total). Format each with country flag, league, time, match, pick, odds. Use dividers. End with total odds.", "Lucky tipster. Make it special.");
          await KV.put("luckyclaim:" + userId, "yes", { expirationTtl: 86400 });
          reply = "🎰 LUCKY 3 ODDS PICK\n━━━━━━━━━━━━\n" + pick + "\n\n🍀 Good luck, " + firstName + "!" + scamWarning;
        }
      }
    }
  }
  else if (text === "◼️ PREDICTION TOOLS") { reply = "PREDICTION TOOLS"; keyboard = toolsKb; }
  else if (text === "💬 AI CHAT") { await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 }); reply = "AI CHAT ACTIVATED\nChat for 3 minutes."; keyboard = chatExitKb; }
  else if (text === "🏆 GAME OF THE DAY") {
    const free = await KV.list({ prefix: "game_free:" });
    if (free.keys.length === 0) reply = "Game of the Day not ready. Check soon 🎯";
    else {
      await sendMsg(chatId, "🧠 Analysing BANKER...\n⏳ Wait 30 seconds...", null);
      await new Promise(r => setTimeout(r, 25000));
      const k = free.keys[Math.floor(Math.random() * free.keys.length)];
      const game = await KV.get(k.name);
      const pick = await askGroq("From:\n" + game + "\nPick THE SAFEST single. Format with country flag, league, time, match, pick, confidence %, odds.", "Professional tipster.");
      reply = "🏆 GAME OF THE DAY\n━━━━━━━━━━━━\n" + pick + scamWarning;
    }
  }
  else if (text === "📊 MY WINS") { const w = await KV.get("wins:" + userId) || "0"; reply = "📊 Your Stats\n━━━━━━━━━━\nPicks viewed: " + w; }
  else if (text === "🎁 REFER FRIENDS") reply = "🎁 REFERRAL\nYour ID: " + userId + "\nRefer 3 friends = 1 day FREE VIP!";
  else if (text === "👤 MY ACCOUNT") { const s = isAdmin ? "Admin 👑" : (userIsVvip ? "VVIP 👑" : (userIsVip ? "VIP 💎" : "Free User")); let v = "Not Active"; if (isAdmin) v = "Lifetime"; else if (userIsVvip) { const e = await KV.get("vvip:" + userId); v = "VVIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; } else if (userIsVip) { const e = await KV.get("vip:" + userId); v = "VIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + " days"; } reply = "Your Profile\n━━━━━━━━━━\nName: " + firstName + "\nID: " + userId + "\nStatus: " + s + "\nAccess: " + v; }
  else if (text === "ℹ️ HELP") reply = await askGroq("Brief friendly help guide for VortexPulse AI. Mention: Free Tips, VIP, VVIP, AI Chat, Lucky Pick, Tournament, Subscribe. Under 80 words.");
  else if (text === "▫️ Straight Win" || text === "▫️ Double Chance" || text === "▫️ Over 1.5" || text === "▫️ Under 3.5" || text === "▫️ Draw No Bet" || text === "▫️ BTTS") { await KV.put("pending:" + userId, "free|" + text, { expirationTtl: 600 }); reply = "How would you like " + text + "?"; keyboard = pickTypeKb; }
  else if (text === "◾ Correct Score" || text === "◾ HT/FT" || text === "◾ Over 2.5 VIP" || text === "◾ Over 3.5 VIP" || text === "◾ Corners VIP" || text === "◾ Cards VIP" || text === "◾ 2 Odds Daily" || text === "◾ 5 Odds Daily" || text === "◾ 10 Odds Rollover" || text === "◾ Banker of Day") { if (userIsVip) { await KV.put("pending:" + userId, "vip|" + text, { expirationTtl: 600 }); reply = "How would you like " + text + "?"; keyboard = pickTypeKb; } else { reply = "🔒 VIP ONLY\n" + text + " is locked."; keyboard = vipKb; } }
  else if (text === "▪️ Single Pick" || text === "▪️ Slip (Multiple)") {
    const pending = await KV.get("pending:" + userId);
    if (!pending) { reply = "Choose market first."; keyboard = isAdmin ? userKbAdmin : userKb; }
    else {
      const [tier, market] = pending.split("|");
      await KV.delete("pending:" + userId);
      const gameList = await KV.list({ prefix: "game_" + tier + ":" });
      if (gameList.keys.length === 0) { reply = "No games for " + market + " yet."; keyboard = tier === "free" ? freeKb : vipKb; }
      else {
        await sendMsg(chatId, "🧠 Analysing " + market + "...\n⏳ Wait 30 seconds...", null);
        await new Promise(r => setTimeout(r, 25000));
        let allGames = "";
        for (const k of gameList.keys) { const g = await KV.get(k.name); if (g) allGames += g + "\n\n"; }
        const fmt = text === "▪️ Single Pick" ? "ONE single safe pick" : "a SLIP of 3 picks";
        const prompt = "From games:\n" + allGames + "\nGenerate " + fmt + " ONLY for: " + market + ". If market not in data, say 'No games available'. Otherwise format with country flag, league, time, match, pick, confidence %, odds. Use dividers.";
        const aiPick = await askGroq(prompt, "Tipster. Use ONLY data. Add country flags.");
        const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
        await sendMsgWithReactions(chatId, (text === "▪️ Single Pick" ? "🎯 SINGLE PICK" : "📋 BET SLIP") + " - " + market + "\n━━━━━━━━━━━━\n\n" + aiPick + scamWarning, isAdmin ? userKbAdmin : userKb);
        return new Response("OK");
      }
    }
  }
  else if (text === "◼️ Random Picker" || text === "◼️ Stats Insight" || text === "◼️ AI Prediction" || text === "◼️ League Picker" || text === "◼️ Country Games" || text === "◼️ Live Matches") { if (userIsVip) reply = "VIP ACCESS\nComing soon."; else reply = "🔒 VIP LOCKED"; keyboard = toolsKb; }
  else if (text === "◀️ BACK") { reply = "Back to menu."; keyboard = isAdmin ? userKbAdmin : userKb; }
  else { reply = "Please use the buttons below."; keyboard = isAdmin ? userKbAdmin : userKb; }

  await sendMsg(chatId, reply, keyboard);
  return new Response("OK");
}
