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
  const now = Date.now();
  const today = new Date();
  
  // Reset daily user limits
  const limits = await KV.list({ prefix: "daily_limit:" });
  for (const k of limits.keys) await KV.delete(k.name);
  
  // Auto-fetch all tiers
  await autoFetchFree(env);
  await autoFetchVip(env);
  await autoFetchVvip(env);
  
  // Greetings
  const users = await KV.list({ prefix: "user:" });
  const greetings = ["Good morning kings! Today's safe games loaded 💪", "Rise and shine! Fresh markets ready 🎯", "Morning legends! Today's bankers are live 🏆"];
  const msg = greetings[Math.floor(Math.random() * greetings.length)];
  for (const key of users.keys) {
    const uid = key.name.replace("user:", "");
    try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: msg }) }); } catch (e) {}
  }
  
  const claims = await KV.list({ prefix: "luckyclaim:" });
  for (const k of claims.keys) await KV.delete(k.name);
  const quizClaims = await KV.list({ prefix: "quizclaim:" });
  for (const k of quizClaims.keys) await KV.delete(k.name);
  
  // VIP reminders
  const vips = await KV.list({ prefix: "vip:" });
  for (const k of vips.keys) {
    const uid = k.name.replace("vip:", "");
    const expiry = await KV.get(k.name);
    const hrsLeft = (parseInt(expiry) - now) / 3600000;
    if (hrsLeft > 20 && hrsLeft < 28) { try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: "⏰ Your VIP expires in ~24 hours. Renew to stay 💎" }) }); } catch (e) {} }
  }
  const vvips = await KV.list({ prefix: "vvip:" });
  for (const k of vvips.keys) {
    const uid = k.name.replace("vvip:", "");
    const expiry = await KV.get(k.name);
    const hrsLeft = (parseInt(expiry) - now) / 3600000;
    if (hrsLeft > 20 && hrsLeft < 28) { try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: "⏰ Your VVIP expires in ~24 hours. Renew 👑" }) }); } catch (e) {} }
  }
  
  // Auto-clean
  const supports = await KV.list({ prefix: "support:" });
  for (const k of supports.keys) { const d = await KV.get(k.name); if (d) { try { const p = JSON.parse(d); if (now - p.time > 604800000) await KV.delete(k.name); } catch (e) { await KV.delete(k.name); } } }
  const spams = await KV.list({ prefix: "spam:" });
  for (const k of spams.keys) await KV.delete(k.name);
  const warns = await KV.list({ prefix: "warn:" });
  for (const k of warns.keys) await KV.delete(k.name);
  const vvipCached = await KV.list({ prefix: "vvipgames:" });
  for (const k of vvipCached.keys) await KV.delete(k.name);
  const cooldowns = await KV.list({ prefix: "cooldown:" });
  for (const k of cooldowns.keys) await KV.delete(k.name);
  
  // Match reminders
  const followers = await KV.list({ prefix: "favteam:" });
  if (followers.keys.length > 0) {
    const all = await KV.get("cached_vvip_games");
    if (all) {
      for (const k of followers.keys) {
        const uid = k.name.replace("favteam:", "");
        const team = await KV.get(k.name);
        if (team && all.toLowerCase().includes(team.toLowerCase())) {
          try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: "🔔 MATCH ALERT\n━━━━━━━━━━━━\nYour team " + team + " plays in next 48 hours!\nCheck VVIP zone for picks 👑" }) }); } catch (e) {} }
      }
    }
  }
  
  // Weekly report (Saturday)
  if (today.getUTCDay() === 6) {
    for (const key of users.keys) {
      const uid = key.name.replace("user:", "");
      if (parseInt(uid) === ADMIN_ID) continue;
      const won = parseInt(await KV.get("user_wins:" + uid) || "0");
      const lost = parseInt(await KV.get("user_loss:" + uid) || "0");
      const total = won + lost;
      const rate = total > 0 ? Math.round((won / total) * 100) : 0;
      const points = await KV.get("points:" + uid) || "0";
      const streakData = await KV.get("streak:" + uid);
      const streak = streakData ? JSON.parse(streakData).streak : 0;
      try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: "📊 WEEKLY REPORT\n━━━━━━━━━━━━\n✅ Wins: " + won + "\n❌ Losses: " + lost + "\n📈 Win rate: " + rate + "%\n🔥 Streak: " + streak + "d\n🎯 Points: " + points + "\n\nKeep grinding! 💪" }) }); } catch (e) {}
    }
  }
}

// Football-Data.org for FREE tier
async function autoFetchFree(env) {
  const KV = env.VORTEX_KV;
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?status=TIMED,SCHEDULED", { headers: { "X-Auth-Token": env.FOOTBALL_KEY } });
    const data = await res.json();
    if (!data.matches) return;
    const now = Date.now();
    const cutoff = now + (48 * 3600000);
    const upcoming = data.matches.filter(m => { const t = new Date(m.utcDate).getTime(); return t > now && t < cutoff && (m.status === "SCHEDULED" || m.status === "TIMED"); }).slice(0, 15);
    if (upcoming.length === 0) return;
    let games = "";
    for (const m of upcoming) {
      games += "🏟️ " + m.competition.name + "\n";
      games += "⚽ " + m.homeTeam.name + " vs " + m.awayTeam.name + "\n";
      games += "⏰ " + m.utcDate + "\n";
      games += "━━━━━━━━━━\n";
    }
    // Clear old free games first
    const oldFree = await KV.list({ prefix: "game_free:" });
    for (const k of oldFree.keys) await KV.delete(k.name);
    await KV.put("game_free:" + Date.now(), games, { expirationTtl: 86400 });
  } catch (e) {}
}

// API-Football for VIP tier
async function autoFetchVip(env) {
  const KV = env.VORTEX_KV;
  try {
    const date = new Date().toISOString().split('T')[0];
    const res = await fetch("https://v3.football.api-sports.io/fixtures?date=" + date, { headers: { "x-apisports-key": env.APIFOOTBALL_KEY } });
    const data = await res.json();
    if (!data.response) return;
    const now = Date.now();
    const cutoff = now + (48 * 3600000);
    const upcoming = data.response.filter(f => { const t = new Date(f.fixture.date).getTime(); return t > now && t < cutoff; }).slice(0, 15);
    if (upcoming.length === 0) return;
    let games = "";
    for (const f of upcoming) {
      games += "🏟️ " + f.league.name + " (" + f.league.country + ")\n";
      games += "⚽ " + f.teams.home.name + " vs " + f.teams.away.name + "\n";
      games += "⏰ " + f.fixture.date + "\n";
      games += "━━━━━━━━━━\n";
    }
    const oldVip = await KV.list({ prefix: "game_vip:" });
    for (const k of oldVip.keys) await KV.delete(k.name);
    await KV.put("game_vip:" + Date.now(), games, { expirationTtl: 86400 });
  } catch (e) {}
}

// Cache VVIP games once daily
async function autoFetchVvip(env) {
  const KV = env.VORTEX_KV;
  const all = await fetchAllLiveGames(env);
  if (all) await KV.put("cached_vvip_games", all, { expirationTtl: 86400 });
}

async function fetchLeagueGames(env, sportKey) {
  try {
    const res = await fetch("https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds/?apiKey=" + env.ODDS_KEY + "&regions=eu&markets=h2h,totals&oddsFormat=decimal");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const now = Date.now();
    const cutoff = now + (48 * 3600000);
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

const knownButtons = ["▫️ FREE TIPS", "◾ VIP SECTION", "⭐ VVIP ZONE", "🏆 TOURNAMENT MODE", "◼️ PREDICTION TOOLS", "💬 AI CHAT", "🎰 LUCKY PICK", "🎲 DAILY QUIZ", "🏆 GAME OF THE DAY", "🔔 FOLLOW TEAM", "📊 MY WINS", "🎯 MY STREAK", "🏅 LEADERBOARD", "🎁 REDEEM CODE", "📩 CONTACT ADMIN", "🎁 REFER FRIENDS", "👤 MY ACCOUNT", "ℹ️ HELP", "⬛ SUBSCRIBE VIP", "▫️ Straight Win", "▫️ Double Chance", "▫️ Over 1.5", "▫️ Under 3.5", "▫️ Draw No Bet", "▫️ BTTS", "◾ Correct Score", "◾ HT/FT", "◾ Over 2.5 VIP", "◾ Over 3.5 VIP", "◾ Corners VIP", "◾ Cards VIP", "◾ 2 Odds Daily", "◾ 5 Odds Daily", "◾ 10 Odds Rollover", "◾ Banker of Day", "⭐ FETCH LIVE GAMES", "⭐ Game of the Day VVIP", "⚡ EXPRESS MODE", "🏆 BRACKETS", "📊 DEEP ANALYSIS", "🌍 World Cup", "⚽ EPL", "⚽ Serie A", "⚽ Ireland", "⚽ Brazil", "⚽ China", "⚽ Norway", "⚽ Sweden", "⚽ Finland", "⚽ Copa Libertadores", "⚽ Copa Sudamericana", "🌐 All Leagues", "⭐ 2 Odds Slip", "⭐ 3 Odds Slip", "⭐ 4 Odds Slip", "⭐ 5 Odds Slip", "⭐ Mega Slip 10+", "⭐ Correct Score", "⭐ BTTS Slip", "⭐ Over 2.5 Slip", "⭐ Safest Single", "🎟️ GENERATE BOOKING CODE", "🟢 Sportybet", "🟢 Bet9ja", "🟢 1xBet", "🟢 MSport", "🟢 BetKing", "🟢 BetWay", "🟢 22Bet", "🟢 Melbet", "🟢 NairaBet", "🟢 Betano", "🟢 SportPesa", "🟢 Parimatch", "🟢 Bet365", "🟢 Football.com", "◼️ Random Picker", "◼️ Stats Insight", "◼️ AI Prediction", "◼️ League Picker", "◼️ Country Games", "◼️ Live Matches", "◀️ BACK", "◀️ BACK TO ADMIN", "◀️ BACK TO ODDS", "✖️ EXIT AI CHAT", "✖️ EXIT ADMIN CHAT", "✖️ CANCEL", "▪️ Single Pick", "▪️ Slip (Multiple)", "▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES", "💬 ADMIN AI CHAT", "🔥 SEND HOT STREAK", "▪️ BROADCAST", "✔️ POST WINNINGS", "📩 USER MESSAGES", "💰 REVENUE", "◼️ BOT STATS", "📈 PERFORMANCE", "👤 MANAGE VIP", "🛡️ MANAGE BANS", "🎁 MANAGE CODES", "⬛ EDIT PAYMENT", "💲 EDIT PRICES", "↔️ SWITCH TO USER VIEW", "🔄 FETCH ALL NOW", "/start"];

function detectAbuse(text) {
  if (knownButtons.includes(text)) return null;
  const t = text.toLowerCase();
  const badWords = ["fuck", "fck", "shit", "bitch", "bastard", "idiot", "mumu", "olosho", "ashawo", "werey", "scammer", "fraud", "419", "hacker", "bypass vip", "kill yourself", "kys", "fuck you", "fk you", "stupid bot", "stfu"];
  const scamPatterns = ["free money", "make money fast", "earn $", "earn ₦", "investment", "click here", "guaranteed win", "100% sure", "hack account"];
  const linkPatterns = ["http://", "https://", "t.me/", "www.", ".net", ".org", "telegram.me", "bit.ly", "tinyurl"];
  for (const w of badWords) if (t.includes(w)) return "abuse";
  for (const p of scamPatterns) if (t.includes(p)) return "scam";
  for (const l of linkPatterns) if (t.includes(l)) return "link";
  return null;
}

async function checkSpam(uid, KV) {
  const now = Date.now();
  const data = await KV.get("spam:" + uid);
  let count = 1; let firstTime = now;
  if (data) { const parsed = JSON.parse(data); if (now - parsed.firstTime < 60000) { count = parsed.count + 1; firstTime = parsed.firstTime; } }
  await KV.put("spam:" + uid, JSON.stringify({ count, firstTime }), { expirationTtl: 120 });
  return count >= 15;
}

async function banUser(uid, hours, reason, KV, env) {
  const expiry = Date.now() + (hours * 3600000);
  await KV.put("banned:" + uid, JSON.stringify({ expiry, reason }), { expirationTtl: hours * 3600 });
  await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), text: "🚫 RESTRICTED\nReason: " + reason + "\nDuration: " + hours + "hr" }) });
}

async function isBanned(uid, KV) {
  try { const data = await KV.get("banned:" + uid); if (!data) return null; const parsed = JSON.parse(data); if (parsed.expiry > Date.now()) return parsed; await KV.delete("banned:" + uid); return null; } catch (e) { return null; }
}

// Check daily limit
async function checkLimit(uid, tier, KV, isAdmin) {
  if (isAdmin) return { allowed: true };
  const unlimited = await KV.get("unlimited:" + uid);
  if (unlimited) return { allowed: true };
  const limits = { free: parseInt(await KV.get("limit_free") || "5"), vip: parseInt(await KV.get("limit_vip") || "10"), vvip: parseInt(await KV.get("limit_vvip") || "20") };
  const usage = parseInt(await KV.get("daily_limit:" + uid) || "0");
  const max = limits[tier];
  if (usage >= max) return { allowed: false, max, current: usage };
  return { allowed: true, current: usage, max };
}

async function incrementLimit(uid, KV) {
  const current = parseInt(await KV.get("daily_limit:" + uid) || "0");
  await KV.put("daily_limit:" + uid, (current + 1).toString(), { expirationTtl: 86400 });
}

// Cooldown - 30s between picks
async function checkCooldown(uid, KV) {
  const last = await KV.get("cooldown:" + uid);
  if (last) { const elapsed = Date.now() - parseInt(last); if (elapsed < 30000) return Math.ceil((30000 - elapsed) / 1000); }
  await KV.put("cooldown:" + uid, Date.now().toString(), { expirationTtl: 60 });
  return 0;
}

async function handleUpdate(request, env) {
  const update = await request.json();
  const msg = update.message;
  const cb = update.callback_query;
  const KV = env.VORTEX_KV;
  const ADMIN_ID = parseInt(env.ADMIN_ID);

  if (cb) {
    const data = cb.data;
    const uid = cb.from.id;
    if (data.startsWith("react:")) { const reaction = data.split(":")[1]; const current = parseInt(await KV.get("react_" + reaction) || "0"); await KV.put("react_" + reaction, (current + 1).toString()); await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cb.id, text: reaction === "fire" ? "🔥 Thanks!" : "💩 Noted!" }) }); }
    if (data.startsWith("track:")) { const result = data.split(":")[1]; const key = result === "won" ? "user_wins:" + uid : "user_loss:" + uid; const current = parseInt(await KV.get(key) || "0"); await KV.put(key, (current + 1).toString()); await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cb.id, text: result === "won" ? "✅ Win!" : "❌ Loss" }) }); }
    return new Response("OK");
  }

  if (!msg) return new Response("OK");
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || "friend";
  const text = msg.text ? msg.text.trim() : "";
  const hasPhoto = msg.photo ? true : false;
  const isAdmin = userId === ADMIN_ID;

  let codeMode = ""; try { codeMode = await KV.get("codemode:" + userId) || ""; } catch (e) {}
  let supportMode = ""; try { supportMode = await KV.get("supportmode:" + userId) || ""; } catch (e) {}
  let teamMode = ""; try { teamMode = await KV.get("teammode:" + userId) || ""; } catch (e) {}
  let quizMode = ""; try { quizMode = await KV.get("quizmode:" + userId) || ""; } catch (e) {}
  let analysisMode = ""; try { analysisMode = await KV.get("analysismode:" + userId) || ""; } catch (e) {}
  let inChat = false; try { const c = await KV.get("chatmode:" + userId); if (c === "yes") inChat = true; } catch (e) {}
  let inAdminChatM = false; try { const a = await KV.get("adminchat:" + userId); if (a === "yes") inAdminChatM = true; } catch (e) {}
  let bcModeCheck = ""; try { bcModeCheck = await KV.get("bcmode:" + userId) || ""; } catch (e) {}
  const inSpecialMode = (codeMode === "yes") || (supportMode === "yes") || (teamMode === "yes") || (quizMode === "yes") || (analysisMode === "yes") || inChat || inAdminChatM || (bcModeCheck === "yes");

  if (!isAdmin) {
    const banInfo = await isBanned(userId, KV);
    if (banInfo) { const minsLeft = Math.ceil((banInfo.expiry - Date.now()) / 60000); await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "🚫 Restricted.\nReason: " + banInfo.reason + "\nTime left: " + minsLeft + " mins" }) }); return new Response("OK"); }
    if (!inSpecialMode) {
      if (text || hasPhoto) { const spammer = await checkSpam(userId, KV); if (spammer) { await banUser(userId, 1, "Spam flooding", KV, env); return new Response("OK"); } }
      if (text) {
        const abuseType = detectAbuse(text);
        if (abuseType) {
          const warned = await KV.get("warn:" + userId);
          if (warned) { let reason = "Abuse"; if (abuseType === "scam") reason = "Scam attempt"; else if (abuseType === "link") reason = "External link"; await banUser(userId, 1, reason, KV, env); await KV.delete("warn:" + userId); return new Response("OK"); }
          else { await KV.put("warn:" + userId, "1", { expirationTtl: 3600 }); await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "⚠️ WARNING\nNext violation = 1 hour ban." }) }); return new Response("OK"); }
        }
      }
    }
  }

  await KV.put("user:" + userId, firstName);
  await KV.put("lastseen:" + userId, Date.now().toString(), { expirationTtl: 604800 });

  if (!isAdmin && text === "/start") {
    const today = new Date().toISOString().split('T')[0];
    const data = await KV.get("streak:" + userId);
    let streak = 1; let rewarded = [];
    if (data) { const p = JSON.parse(data); rewarded = p.rewarded || []; const last = new Date(p.lastDay); const now = new Date(today); const diff = Math.floor((now - last) / 86400000); if (diff === 0) { streak = p.streak; } else if (diff === 1) streak = p.streak + 1; else streak = 1; }
    let reward = null;
    if (streak === 3 && !rewarded.includes(3)) { reward = "3-day"; rewarded.push(3); }
    if (streak === 7 && !rewarded.includes(7)) { reward = "7-day-vip"; rewarded.push(7); const e = Date.now() + 86400000; await KV.put("vip:" + userId, e.toString(), { expirationTtl: 86400 }); }
    if (streak === 14 && !rewarded.includes(14)) { reward = "14-day-vvip"; rewarded.push(14); const e = Date.now() + 86400000; await KV.put("vvip:" + userId, e.toString(), { expirationTtl: 86400 }); }
    await KV.put("streak:" + userId, JSON.stringify({ streak, lastDay: today, rewarded }));
    if (reward) { let m = ""; if (reward === "3-day") m = "🔥 3-DAY STREAK!"; if (reward === "7-day-vip") m = "🎉 7-DAY STREAK! 1-day VIP added 💎"; if (reward === "14-day-vvip") m = "👑 14-DAY STREAK! 1-day VVIP added!"; await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: m }) }); }
  }

  const adminKb = [["▫️ UPLOAD FREE GAMES", "◾ UPLOAD VIP GAMES"], ["🔄 FETCH ALL NOW", "💬 ADMIN AI CHAT"], ["🔥 SEND HOT STREAK", "▪️ BROADCAST"], ["✔️ POST WINNINGS", "📩 USER MESSAGES"], ["💰 REVENUE", "◼️ BOT STATS"], ["📈 PERFORMANCE", "👤 MANAGE VIP"], ["🛡️ MANAGE BANS", "🎁 MANAGE CODES"], ["⬛ EDIT PAYMENT", "💲 EDIT PRICES"], ["↔️ SWITCH TO USER VIEW"]];
  const userKb = [["▫️ FREE TIPS", "◾ VIP SECTION"], ["⭐ VVIP ZONE", "🏆 TOURNAMENT MODE"], ["◼️ PREDICTION TOOLS", "💬 AI CHAT"], ["🎰 LUCKY PICK", "🎲 DAILY QUIZ"], ["🏆 GAME OF THE DAY", "🔔 FOLLOW TEAM"], ["📊 MY WINS", "🎯 MY STREAK"], ["🏅 LEADERBOARD", "🎁 REDEEM CODE"], ["📩 CONTACT ADMIN", "🎁 REFER FRIENDS"], ["👤 MY ACCOUNT", "ℹ️ HELP"], ["⬛ SUBSCRIBE VIP"]];
  const userKbAdmin = [...userKb, ["◀️ BACK TO ADMIN"]];
  const freeKb = [["▫️ Straight Win", "▫️ Double Chance"], ["▫️ Over 1.5", "▫️ Under 3.5"], ["▫️ Draw No Bet", "▫️ BTTS"], ["◀️ BACK"]];
  const vipKb = [["◾ Correct Score", "◾ HT/FT"], ["◾ Over 2.5 VIP", "◾ Over 3.5 VIP"], ["◾ Corners VIP", "◾ Cards VIP"], ["◾ 2 Odds Daily", "◾ 5 Odds Daily"], ["◾ 10 Odds Rollover", "◾ Banker of Day"], ["◀️ BACK"]];
  const vvipMainKb = [["⭐ FETCH LIVE GAMES"], ["⭐ Game of the Day VVIP", "⚡ EXPRESS MODE"], ["🏆 BRACKETS", "📊 DEEP ANALYSIS"], ["◀️ BACK"]];
  const leagueKb = [["🌍 World Cup", "⚽ EPL"], ["⚽ Serie A", "⚽ Ireland"], ["⚽ Brazil", "⚽ China"], ["⚽ Norway", "⚽ Sweden"], ["⚽ Finland", "⚽ Copa Libertadores"], ["⚽ Copa Sudamericana", "🌐 All Leagues"], ["◀️ BACK"]];
  const oddsKb = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Safest Single", "◀️ BACK"]];
  const oddsKbWithCode = [["⭐ 2 Odds Slip", "⭐ 3 Odds Slip"], ["⭐ 4 Odds Slip", "⭐ 5 Odds Slip"], ["⭐ Mega Slip 10+", "⭐ Correct Score"], ["⭐ BTTS Slip", "⭐ Over 2.5 Slip"], ["⭐ Safest Single", "🎟️ GENERATE BOOKING CODE"], ["◀️ BACK"]];
  const platformKb = [["🟢 Sportybet", "🟢 Bet9ja"], ["🟢 1xBet", "🟢 MSport"], ["🟢 BetKing", "🟢 BetWay"], ["🟢 22Bet", "🟢 Melbet"], ["🟢 NairaBet", "🟢 Betano"], ["🟢 SportPesa", "🟢 Parimatch"], ["🟢 Bet365", "🟢 Football.com"], ["◀️ BACK TO ODDS"]];
  const toolsKb = [["◼️ Random Picker", "◼️ Stats Insight"], ["◼️ AI Prediction", "◼️ League Picker"], ["◼️ Country Games", "◼️ Live Matches"], ["◀️ BACK"]];
  const chatExitKb = [["✖️ EXIT AI CHAT"]];
  const adminChatExitKb = [["✖️ EXIT ADMIN CHAT"]];
  const pickTypeKb = [["▪️ Single Pick", "▪️ Slip (Multiple)"], ["◀️ BACK"]];
  const cancelKb = [["✖️ CANCEL"]];

  const leagueMap = { "🌍 World Cup": "soccer_fifa_world_cup", "⚽ EPL": "soccer_epl", "⚽ Serie A": "soccer_italy_serie_a", "⚽ Ireland": "soccer_league_of_ireland", "⚽ Brazil": "soccer_brazil_serie_b", "⚽ China": "soccer_china_superleague", "⚽ Norway": "soccer_norway_eliteserien", "⚽ Sweden": "soccer_sweden_allsvenskan", "⚽ Finland": "soccer_finland_veikkausliiga", "⚽ Copa Libertadores": "soccer_conmebol_copa_libertadores", "⚽ Copa Sudamericana": "soccer_conmebol_copa_sudamericana" };
  const platformLinks = { "🟢 Sportybet": "https://www.sportybet.com/ng/sport/football", "🟢 Bet9ja": "https://sports.bet9ja.com/", "🟢 1xBet": "https://1xbet.ng/en/line/football", "🟢 MSport": "https://www.msport.com/ng/football", "🟢 BetKing": "https://www.betking.com/sports/", "🟢 BetWay": "https://betway.com.ng/sport/football", "🟢 22Bet": "https://22bet.ng/line/football", "🟢 Melbet": "https://melbet.ng/en/line/football", "🟢 NairaBet": "https://www.nairabet.com/sports/soccer", "🟢 Betano": "https://www.betano.com/sport/football/", "🟢 SportPesa": "https://www.sportpesa.com/en/sports", "🟢 Parimatch": "https://parimatch.in/en/football", "🟢 Bet365": "https://www.bet365.com/", "🟢 Football.com": "https://www.football.com" };

  async function sendMsg(cid, txt, kb) { return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: txt, reply_markup: kb ? { keyboard: kb, resize_keyboard: true } : undefined }) }); }
  async function sendPickWithButtons(cid, txt, kb) { await sendMsg(cid, txt, kb); return fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cid, text: "Rate & Track:", reply_markup: { inline_keyboard: [[{ text: "🔥 Hot", callback_data: "react:fire" }, { text: "💩 Meh", callback_data: "react:poop" }], [{ text: "✅ Won", callback_data: "track:won" }, { text: "❌ Lost", callback_data: "track:lost" }]] } }) }); }

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
  const scamWarning = "\n\n━━━━━━━━━━━━\n🔐 ANTI-SCAM: Only the official bot is real.\nBet responsibly.";

  if (text === "✖️ CANCEL") { await KV.delete("codemode:" + userId); await KV.delete("supportmode:" + userId); await KV.delete("teammode:" + userId); await KV.delete("quizmode:" + userId); await KV.delete("analysismode:" + userId); await sendMsg(chatId, "Cancelled.", isAdmin ? adminKb : userKb); return new Response("OK"); }

  if (codeMode === "yes" && !isAdmin && text) {
    await KV.delete("codemode:" + userId);
    const code = text.toUpperCase().trim();
    const codeData = await KV.get("code:" + code);
    if (!codeData) { await sendMsg(chatId, "❌ Invalid code.", userKb); return new Response("OK"); }
    const parsed = JSON.parse(codeData);
    const usedBy = await KV.get("codeused:" + code + ":" + userId);
    if (usedBy) { await sendMsg(chatId, "❌ Already used.", userKb); return new Response("OK"); }
    const expiry = Date.now() + (parsed.days * 86400000);
    const key = parsed.type === "vvip" ? "vvip:" + userId : "vip:" + userId;
    await KV.put(key, expiry.toString(), { expirationTtl: parsed.days * 86400 });
    await KV.put("codeused:" + code + ":" + userId, "1", { expirationTtl: 31536000 });
    await sendMsg(chatId, "🎉 REDEEMED!\n" + parsed.days + "d " + parsed.type.toUpperCase() + " access!", userKb);
    return new Response("OK");
  }

  if (supportMode === "yes" && !isAdmin && text) {
    await KV.delete("supportmode:" + userId);
    await sendMsg(ADMIN_ID, "📩 SUPPORT\nFrom: " + firstName + " (" + userId + ")\n\n" + text + "\n\nReply: /reply " + userId + " msg");
    await KV.put("support:" + Date.now() + ":" + userId, JSON.stringify({ name: firstName, uid: userId, text, time: Date.now() }), { expirationTtl: 604800 });
    await sendMsg(chatId, "✔️ Sent to admin.", userKb);
    return new Response("OK");
  }

  if (teamMode === "yes" && !isAdmin && text) {
    await KV.delete("teammode:" + userId);
    await KV.put("favteam:" + userId, text.trim(), { expirationTtl: 31536000 });
    await sendMsg(chatId, "✔️ Following: " + text + "\nYou'll be alerted 🔔", userKb);
    return new Response("OK");
  }

  if (quizMode === "yes" && !isAdmin && text) {
    await KV.delete("quizmode:" + userId);
    await KV.put("quizclaim:" + userId, text.trim(), { expirationTtl: 86400 });
    const points = parseInt(await KV.get("points:" + userId) || "0");
    await KV.put("points:" + userId, (points + 10).toString());
    await sendMsg(chatId, "✔️ Answer: " + text + "\n🎯 +10 points!", userKb);
    return new Response("OK");
  }

  if (analysisMode === "yes" && userIsVvip && text) {
    await KV.delete("analysismode:" + userId);
    await sendMsg(chatId, "📊 Analysing: " + text + "\n⏳ Wait 30s...", null);
    await new Promise(r => setTimeout(r, 25000));
    const analysis = await askGroq("Deep betting analysis for: " + text + "\nInclude: recent form, head-to-head, key players, prediction with confidence, recommended bet. Be brief.", "Elite betting analyst.");
    await sendMsg(chatId, "📊 DEEP ANALYSIS\n━━━━━━━━━━━━\n🎯 " + text + "\n━━━━━━━━━━━━\n\n" + analysis + scamWarning, vvipMainKb);
    return new Response("OK");
  }

  if (hasPhoto) {
    if (isAdmin) {
      let adminMode = "";
      try { adminMode = await KV.get("adminmode:" + userId) || ""; } catch (e) {}
      if (adminMode === "upload_free" || adminMode === "upload_vip") {
        const tier = adminMode === "upload_free" ? "free" : "vip";
        await sendMsg(chatId, "🧠 Analysis...\n⏳ 30s...", adminKb);
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        await new Promise(r => setTimeout(r, 25000));
        const extracted = await readImageWithAI(fileId, "Analyse betting screenshot. Extract: home, away, country, league, time, ALL markets with odds.");
        if (extracted) { await KV.put("game_" + tier + ":" + Date.now(), extracted, { expirationTtl: 86400 }); await sendMsg(chatId, "✔️ SAVED\n" + extracted.substring(0, 700), adminKb); }
        else await sendMsg(chatId, "✖️ Failed.", adminKb);
        return new Response("OK");
      }
      if (adminMode === "post_winning") {
        await KV.delete("adminmode:" + userId);
        const users = await KV.list({ prefix: "user:" });
        let count = 0;
        for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: parseInt(uid), from_chat_id: chatId, message_id: msg.message_id }) }); await sendMsg(parseInt(uid), "🏆 Another WIN! Subscribe 💎"); count++; } catch (e) {} }
        await sendMsg(chatId, "✔️ Sent to " + count + ".", adminKb);
        return new Response("OK");
      }
      return new Response("OK");
    }
    let inPaymentMode = false;
    try { const m = await KV.get("paymode:" + userId); if (m === "yes") inPaymentMode = true; } catch (e) {}
    if (inPaymentMode) {
      await KV.delete("paymode:" + userId);
      const totalRev = parseInt(await KV.get("total_revenue_claims") || "0");
      await KV.put("total_revenue_claims", (totalRev + 1).toString());
      await sendMsg(chatId, "Payment received ✔️\nConfirming...", userKb);
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/forwardMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_ID, from_chat_id: chatId, message_id: msg.message_id }) });
      await sendMsg(ADMIN_ID, "Payment from: " + userId + "\n/addvip " + userId + " 7\n/addvvip " + userId + " 7", adminKb);
    } else await sendMsg(chatId, "✖️ Only screenshots when subscribing.", userKb);
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
  if (inAdminChat && isAdmin && text !== "✖️ EXIT ADMIN CHAT") { const r = await askGroq(text, "You are talking to OWNER. Full power."); await sendMsg(chatId, "Boss, " + r, adminChatExitKb); return new Response("OK"); }
  if (text === "✖️ EXIT ADMIN CHAT" && isAdmin) { await KV.delete("adminchat:" + userId); await sendMsg(chatId, "Admin Chat ended.", adminKb); return new Response("OK"); }

  let inChatMode = false; try { const c = await KV.get("chatmode:" + userId); if (c === "yes") inChatMode = true; } catch (e) {}
  if (inChatMode && text !== "✖️ EXIT AI CHAT") { const r = await askGroq(text); await sendMsg(chatId, r, chatExitKb); return new Response("OK"); }
  if (text === "✖️ EXIT AI CHAT") { await KV.delete("chatmode:" + userId); await sendMsg(chatId, "AI Chat ended.", isAdmin ? userKbAdmin : userKb); return new Response("OK"); }

  if (isAdmin) {
    if (text.startsWith("/setpayment ")) { await KV.put("payment_details", text.replace("/setpayment ", "")); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vip_monthly", p[2]); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setvvip ")) { const p = text.split(" "); if (p[1] === "weekly") await KV.put("price_vvip_weekly", p[2]); if (p[1] === "monthly") await KV.put("price_vvip_monthly", p[2]); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setlimit ")) { const p = text.split(" "); await KV.put("limit_" + p[1], p[2]); await sendMsg(chatId, "✔️ " + p[1] + " limit = " + p[2], adminKb); return new Response("OK"); }
    if (text.startsWith("/unlimit ")) { const t = text.replace("/unlimit ", "").trim(); await KV.put("unlimited:" + t, "yes"); await sendMsg(chatId, "✔️ " + t + " is UNLIMITED.", adminKb); await sendMsg(parseInt(t), "🌟 You got UNLIMITED access!", userKb); return new Response("OK"); }
    if (text.startsWith("/relimit ")) { const t = text.replace("/relimit ", "").trim(); await KV.delete("unlimited:" + t); await sendMsg(chatId, "✔️ Unlimited removed for " + t, adminKb); return new Response("OK"); }
    if (text === "/unlimitlist") { const l = await KV.list({ prefix: "unlimited:" }); let r = "🌟 UNLIMITED USERS:\n"; if (l.keys.length === 0) r += "None."; else for (const k of l.keys) { r += "▪️ " + k.name.replace("unlimited:", "") + "\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text.startsWith("/addvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vip:" + t, e.toString(), { expirationTtl: d * 86400 }); const rc = parseInt(await KV.get("paid_vip_count") || "0"); await KV.put("paid_vip_count", (rc + 1).toString()); await sendMsg(chatId, "✔️ VIP " + d + "d.", adminKb); await sendMsg(parseInt(t), "🎉 VIP ACTIVE " + d + "d!", userKb); return new Response("OK"); }
    if (text.startsWith("/addvvip ")) { const p = text.split(" "); const t = p[1]; const d = p[2] ? parseInt(p[2]) : 7; const e = Date.now() + (d * 86400000); await KV.put("vvip:" + t, e.toString(), { expirationTtl: d * 86400 }); const rc = parseInt(await KV.get("paid_vvip_count") || "0"); await KV.put("paid_vvip_count", (rc + 1).toString()); await sendMsg(chatId, "✔️ VVIP " + d + "d.", adminKb); await sendMsg(parseInt(t), "👑 VVIP ACTIVE " + d + "d!", userKb); return new Response("OK"); }
    if (text.startsWith("/removevip ")) { await KV.delete("vip:" + text.replace("/removevip ", "").trim()); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/removevvip ")) { await KV.delete("vvip:" + text.replace("/removevvip ", "").trim()); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text === "/viplist") { const l = await KV.list({ prefix: "vip:" }); let r = "VIPs:\n"; if (l.keys.length === 0) r += "None."; else for (const k of l.keys) { const u = k.name.replace("vip:", ""); const e = await KV.get(k.name); const d = Math.ceil((parseInt(e) - Date.now()) / 86400000); r += "▪️ " + u + " - " + d + "d\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text === "/cleargames") { const f = await KV.list({ prefix: "game_free:" }); const v = await KV.list({ prefix: "game_vip:" }); for (const k of f.keys) await KV.delete(k.name); for (const k of v.keys) await KV.delete(k.name); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/ban ")) { const p = text.split(" "); const t = p[1]; const h = p[2] ? parseInt(p[2]) : 1; await banUser(t, h, "Banned by admin", KV, env); await sendMsg(chatId, "🚫 " + t + " banned " + h + "hr.", adminKb); return new Response("OK"); }
    if (text.startsWith("/unban ")) { const t = text.replace("/unban ", "").trim(); await KV.delete("banned:" + t); await KV.delete("warn:" + t); await sendMsg(chatId, "✔️", adminKb); await sendMsg(parseInt(t), "✅ Unbanned!", null); return new Response("OK"); }
    if (text === "/banlist") { const l = await KV.list({ prefix: "banned:" }); let r = "🚫 BANNED:\n"; if (l.keys.length === 0) r += "None."; else for (const k of l.keys) { const u = k.name.replace("banned:", ""); const d = JSON.parse(await KV.get(k.name)); const m = Math.ceil((d.expiry - Date.now()) / 60000); r += "▪️ " + u + " - " + m + "m\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text.startsWith("/createcode ")) { const p = text.split(" "); const code = p[1].toUpperCase(); const type = p[2]; const days = parseInt(p[3]); await KV.put("code:" + code, JSON.stringify({ type, days })); await sendMsg(chatId, "✔️ " + code + " | " + type.toUpperCase() + " " + days + "d", adminKb); return new Response("OK"); }
    if (text.startsWith("/deletecode ")) { const code = text.replace("/deletecode ", "").trim().toUpperCase(); await KV.delete("code:" + code); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text === "/codelist") { const l = await KV.list({ prefix: "code:" }); let r = "🎁 CODES:\n"; if (l.keys.length === 0) r += "None."; else for (const k of l.keys) { const c = k.name.replace("code:", ""); const d = JSON.parse(await KV.get(k.name)); r += "▪️ " + c + " → " + d.type.toUpperCase() + " " + d.days + "d\n"; } await sendMsg(chatId, r, adminKb); return new Response("OK"); }
    if (text.startsWith("/reply ")) { const p = text.split(" "); const t = p[1]; const m = text.replace("/reply " + t + " ", ""); await sendMsg(parseInt(t), "📩 ADMIN REPLY\n" + m); await sendMsg(chatId, "✔️", adminKb); return new Response("OK"); }
    if (text.startsWith("/setquiz ")) { const q = text.replace("/setquiz ", ""); await KV.put("dailyquiz", JSON.stringify({ q, time: Date.now() }), { expirationTtl: 86400 }); await sendMsg(chatId, "✔️ Quiz set!", adminKb); return new Response("OK"); }
  }

  let reply = ""; let keyboard = isAdmin ? adminKb : userKb;

  if (text === "/start") { const g = getTimeGreeting(); reply = isAdmin ? g + ", Boss 👑" : g + ", " + firstName + "!\nWelcome to VortexPulse AI."; }
  else if (text === "↔️ SWITCH TO USER VIEW" && isAdmin) { reply = "User View."; keyboard = userKbAdmin; }
  else if (text === "◀️ BACK TO ADMIN" && isAdmin) { reply = "Welcome back, Boss 👑"; keyboard = adminKb; }
  else if (text === "▫️ UPLOAD FREE GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_free", { expirationTtl: 600 }); reply = "FREE UPLOAD\nDrop screenshots."; }
  else if (text === "◾ UPLOAD VIP GAMES" && isAdmin) { await KV.put("adminmode:" + userId, "upload_vip", { expirationTtl: 600 }); reply = "VIP UPLOAD\nDrop screenshots."; }
  else if (text === "🔄 FETCH ALL NOW" && isAdmin) { await sendMsg(chatId, "🔄 Fetching ALL tiers...\n⏳ Wait 60s...", adminKb); await autoFetchFree(env); await autoFetchVip(env); await autoFetchVvip(env); reply = "✔️ All tiers fetched!\nCheck the games."; }
  else if (text === "💬 ADMIN AI CHAT" && isAdmin) { await KV.put("adminchat:" + userId, "yes", { expirationTtl: 600 }); reply = "Admin AI Chat ACTIVE 👑"; keyboard = adminChatExitKb; }
  else if (text === "🔥 SEND HOT STREAK" && isAdmin) { const users = await KV.list({ prefix: "user:" }); let count = 0; for (const key of users.keys) { const uid = key.name.replace("user:", ""); if (parseInt(uid) === ADMIN_ID) continue; try { await sendMsg(parseInt(uid), "🔥 HOT STREAK 🔥"); count++; } catch (e) {} } reply = "🔥 Sent to " + count + "."; }
  else if (text === "▪️ BROADCAST" && isAdmin) { await KV.put("bcmode:" + userId, "yes", { expirationTtl: 300 }); reply = "Type broadcast now."; }
  else if (text === "✔️ POST WINNINGS" && isAdmin) { await KV.put("adminmode:" + userId, "post_winning", { expirationTtl: 600 }); reply = "Send winning screenshot."; }
  else if (text === "📩 USER MESSAGES" && isAdmin) { const messages = await KV.list({ prefix: "support:" }); let r = "📩 INBOX\n"; if (messages.keys.length === 0) r += "No messages."; else { const sorted = messages.keys.slice(-10).reverse(); for (const k of sorted) { const d = JSON.parse(await KV.get(k.name)); const ago = Math.floor((Date.now() - d.time) / 60000); r += "👤 " + d.name + " (" + d.uid + ") - " + ago + "m\n💬 " + d.text.substring(0, 100) + "\n/reply " + d.uid + " msg\n━━━━━━━━━━\n"; } } reply = r; }
  else if (text === "💰 REVENUE" && isAdmin) { const vc = parseInt(await KV.get("paid_vip_count") || "0"); const vvc = parseInt(await KV.get("paid_vvip_count") || "0"); const vr = vc * parseInt(vipWeekly); const vvr = vvc * parseInt(vvipWeekly); reply = "💰 REVENUE\n━━━━━━━━━━━━\n💎 VIP: " + vc + " (₦" + vr.toLocaleString() + ")\n👑 VVIP: " + vvc + " (₦" + vvr.toLocaleString() + ")\n💰 TOTAL: ₦" + (vr + vvr).toLocaleString(); }
  else if (text === "◼️ BOT STATS" && isAdmin) { const u = await KV.list({ prefix: "user:" }); const v = await KV.list({ prefix: "vip:" }); const vv = await KV.list({ prefix: "vvip:" }); const f = await KV.list({ prefix: "game_free:" }); const g = await KV.list({ prefix: "game_vip:" }); const b = await KV.list({ prefix: "banned:" }); const c = await KV.list({ prefix: "code:" }); const ul = await KV.list({ prefix: "unlimited:" }); reply = "BOT STATS\n━━━━━━━━━━\n👥 Users: " + u.keys.length + "\n💎 VIPs: " + v.keys.length + "\n👑 VVIPs: " + vv.keys.length + "\n🌟 Unlimited: " + ul.keys.length + "\n🆓 Free: " + f.keys.length + "\n💎 VIP: " + g.keys.length + "\n🚫 Banned: " + b.keys.length + "\n🎁 Codes: " + c.keys.length; }
  else if (text === "📈 PERFORMANCE" && isAdmin) { const fire = await KV.get("react_fire") || "0"; const poop = await KV.get("react_poop") || "0"; const total = parseInt(fire) + parseInt(poop); const rate = total > 0 ? Math.round((parseInt(fire) / total) * 100) : 0; reply = "📈 PERFORMANCE\n🔥 Hot: " + fire + "\n💩 Meh: " + poop + "\n📊 Rate: " + rate + "%"; }
  else if (text === "👤 MANAGE VIP" && isAdmin) reply = "Commands:\n/addvip [id] [days]\n/addvvip [id] [days]\n/removevip [id]\n/removevvip [id]\n/viplist\n\nLIMITS:\n/setlimit free 5\n/setlimit vip 10\n/setlimit vvip 20\n/unlimit [id]\n/relimit [id]\n/unlimitlist";
  else if (text === "🛡️ MANAGE BANS" && isAdmin) reply = "🛡️ BANS:\n/ban [id] [hours]\n/unban [id]\n/banlist";
  else if (text === "🎁 MANAGE CODES" && isAdmin) reply = "🎁 CODES:\n/createcode CODE type days\n/deletecode CODE\n/codelist\n\nQUIZ:\n/setquiz Your question";
  else if (text === "⬛ EDIT PAYMENT" && isAdmin) reply = "Current:\n" + paymentDetails + "\n\n/setpayment Bank: ...";
  else if (text === "💲 EDIT PRICES" && isAdmin) reply = "PRICES:\nVIP W: ₦" + vipWeekly + "\nVIP M: ₦" + vipMonthly + "\nVVIP W: ₦" + vvipWeekly + "\nVVIP M: ₦" + vvipMonthly + "\n\n/setvip weekly 5000";
  else if (text === "⬛ SUBSCRIBE VIP") { if (userIsVip && !isAdmin) reply = "You already have VIP."; else { await KV.put("paymode:" + userId, "yes", { expirationTtl: 1800 }); reply = "PLANS\n━━━━━━━━━━━━\n💎 VIP:\nW: ₦" + vipWeekly + "\nM: ₦" + vipMonthly + "\n\n👑 VVIP:\nW: ₦" + vvipWeekly + "\nM: ₦" + vvipMonthly + "\n\nPayment:\n" + paymentDetails + "\n\nUpload screenshot here."; } }
  else if (text === "▫️ FREE TIPS") { reply = "FREE TIPS ZONE"; keyboard = freeKb; }
  else if (text === "◾ VIP SECTION") { reply = "VIP ZONE 💎"; keyboard = vipKb; }
  else if (text === "⭐ VVIP ZONE") { if (userIsVvip) { reply = "VVIP ELITE ZONE 👑"; keyboard = vvipMainKb; } else reply = "🔒 VVIP LOCKED"; }
  else if (text === "🏆 BRACKETS" && userIsVvip) { await sendMsg(chatId, "🏆 Loading...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); const wc = await fetchLeagueGames(env, "soccer_fifa_world_cup"); if (!wc) reply = "🏆 No tournament brackets now."; else { const brackets = await askGroq("From tournament:\n" + wc + "\nGenerate bracket summary.", "Tournament expert."); reply = "🏆 BRACKETS\n━━━━━━━━━━━━\n" + brackets + scamWarning; } keyboard = vvipMainKb; }
  else if (text === "📊 DEEP ANALYSIS" && userIsVvip) { await KV.put("analysismode:" + userId, "yes", { expirationTtl: 600 }); reply = "📊 DEEP ANALYSIS\nType the match:\n(e.g., Chelsea vs Arsenal)"; keyboard = cancelKb; }
  else if (text === "🎯 MY STREAK") { const data = await KV.get("streak:" + userId); if (!data) reply = "🎯 No streak. Use bot daily!"; else { const p = JSON.parse(data); const next = p.streak < 3 ? "3 days = bonus" : p.streak < 7 ? "7 days = 1d VIP" : p.streak < 14 ? "14 days = 1d VVIP" : "Legend!"; reply = "🎯 STREAK\n🔥 Current: " + p.streak + "\n🎁 Next: " + next; } }
  else if (text === "🏅 LEADERBOARD") { const streaks = await KV.list({ prefix: "streak:" }); const list = []; for (const k of streaks.keys) { const uid = k.name.replace("streak:", ""); const d = JSON.parse(await KV.get(k.name)); const name = await KV.get("user:" + uid) || "User"; list.push({ name, streak: d.streak }); } list.sort((a, b) => b.streak - a.streak); let r = "🏅 TOP 10\n━━━━━━━━━━━━\n"; if (list.length === 0) r += "Be first!"; else for (let i = 0; i < Math.min(10, list.length); i++) r += (i + 1) + ". " + list[i].name + " - 🔥 " + list[i].streak + "d\n"; reply = r; }
  else if (text === "🎁 REDEEM CODE") { await KV.put("codemode:" + userId, "yes", { expirationTtl: 300 }); reply = "🎁 Enter promo code:"; keyboard = cancelKb; }
  else if (text === "📩 CONTACT ADMIN") { await KV.put("supportmode:" + userId, "yes", { expirationTtl: 600 }); reply = "📩 Type your message:"; keyboard = cancelKb; }
  else if (text === "🔔 FOLLOW TEAM") { const fav = await KV.get("favteam:" + userId); await KV.put("teammode:" + userId, "yes", { expirationTtl: 300 }); reply = "🔔 Type team name:\n\n" + (fav ? "Following: " + fav : "None."); keyboard = cancelKb; }
  else if (text === "🎲 DAILY QUIZ") { const quizData = await KV.get("dailyquiz"); if (!quizData) reply = "🎲 No quiz today."; else { const claimed = await KV.get("quizclaim:" + userId); if (claimed) reply = "🎲 Already answered!\n" + claimed; else { const q = JSON.parse(quizData); await KV.put("quizmode:" + userId, "yes", { expirationTtl: 600 }); reply = "🎲 QUIZ\n" + q.q + "\n\nType answer (10 pts)"; keyboard = cancelKb; } } }
  else if (text === "🏆 TOURNAMENT MODE") { const cd = await checkCooldown(userId, KV); if (cd > 0) { reply = "⏱️ Wait " + cd + "s before another request."; } else { const lim = await checkLimit(userId, userIsVvip ? "vvip" : (userIsVip ? "vip" : "free"), KV, isAdmin); if (!lim.allowed) reply = "📊 Daily limit reached (" + lim.max + "/day).\nUpgrade for more!"; else { await sendMsg(chatId, "🏆 Loading...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); const wc = await fetchLeagueGames(env, "soccer_fifa_world_cup"); if (!wc) reply = "🏆 No tournament games."; else { const pick = await askGroq("From WC:\n" + wc + "\nSafest pick.", "Tournament tipster."); await incrementLimit(userId, KV); reply = "🏆 TOURNAMENT\n━━━━━━━━━━━━\n" + pick + scamWarning; } } } }
  else if (text === "⚡ EXPRESS MODE" && userIsVvip) { const lim = await checkLimit(userId, "vvip", KV, isAdmin); if (!lim.allowed) reply = "📊 Daily limit reached."; else { let games = await KV.get("cached_vvip_games"); if (!games) { await sendMsg(chatId, "⚡ Fetching...", null); games = await fetchAllLiveGames(env); if (games) await KV.put("cached_vvip_games", games, { expirationTtl: 86400 }); } if (!games) reply = "No live games."; else { const pick = await askGroq("From:\n" + games + "\nFastest safest single.", "Express tipster."); await incrementLimit(userId, KV); reply = "⚡ EXPRESS VVIP\n━━━━━━━━━━━━\n" + pick + scamWarning; } } keyboard = vvipMainKb; }
  else if (text === "⭐ FETCH LIVE GAMES" && userIsVvip) { reply = "🌐 Choose league:"; keyboard = leagueKb; }
  else if (leagueMap[text] && userIsVvip) { await sendMsg(chatId, "🌐 Fetching " + text + "...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); const games = await fetchLeagueGames(env, leagueMap[text]); if (!games) { reply = "❌ No live games."; keyboard = leagueKb; } else { await KV.put("vvipgames:" + userId, games, { expirationTtl: 3600 }); reply = "✔️ Loaded!"; keyboard = oddsKb; } }
  else if (text === "🌐 All Leagues" && userIsVvip) { let games = await KV.get("cached_vvip_games"); if (!games) { await sendMsg(chatId, "🌐 Fetching ALL...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); games = await fetchAllLiveGames(env); if (games) await KV.put("cached_vvip_games", games, { expirationTtl: 86400 }); } if (!games) { reply = "❌ None."; keyboard = leagueKb; } else { await KV.put("vvipgames:" + userId, games, { expirationTtl: 3600 }); reply = "✔️ Loaded!"; keyboard = oddsKb; } }
  else if ((text === "⭐ 2 Odds Slip" || text === "⭐ 3 Odds Slip" || text === "⭐ 4 Odds Slip" || text === "⭐ 5 Odds Slip" || text === "⭐ Mega Slip 10+" || text === "⭐ Correct Score" || text === "⭐ BTTS Slip" || text === "⭐ Over 2.5 Slip" || text === "⭐ Safest Single") && userIsVvip) {
    const lim = await checkLimit(userId, "vvip", KV, isAdmin);
    if (!lim.allowed) { reply = "📊 Daily limit reached (" + lim.max + "/day)."; keyboard = oddsKb; }
    else {
      const games = await KV.get("vvipgames:" + userId);
      if (!games) { reply = "Fetch live games first."; keyboard = vvipMainKb; }
      else {
        await sendMsg(chatId, "👑 ANALYSIS...\n⏳ 30s...", null);
        await new Promise(r => setTimeout(r, 25000));
        const target = text.includes("2 Odds") ? "around 2.0" : text.includes("3 Odds") ? "around 3.0" : text.includes("4 Odds") ? "around 4.0" : text.includes("5 Odds") ? "around 5.0" : text.includes("10+") ? "above 10" : "safest";
        const aiPick = await askGroq("From:\n" + games + "\nSafest " + text + ". Target " + target + ".", "Elite tipster.");
        await incrementLimit(userId, KV);
        const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
        await KV.put("lastpick:" + userId, aiPick, { expirationTtl: 1800 });
        await sendPickWithButtons(chatId, "👑 VVIP\n━━━━━━━━━━━━\n" + text + "\n━━━━━━━━━━━━\n" + aiPick + scamWarning, oddsKbWithCode);
        return new Response("OK");
      }
    }
  }
  else if (text === "🎟️ GENERATE BOOKING CODE" && userIsVvip) { const last = await KV.get("lastpick:" + userId); if (!last) { reply = "Generate pick first."; keyboard = oddsKb; } else { reply = "🎟️ Choose bookmaker:"; keyboard = platformKb; } }
  else if (platformLinks[text] && userIsVvip) { const link = platformLinks[text]; const last = await KV.get("lastpick:" + userId); reply = "🎟️ " + text + "\nPick:\n" + (last ? last.substring(0, 500) : "") + "\n\n🔗 " + link; keyboard = platformKb; }
  else if (text === "◀️ BACK TO ODDS" && userIsVvip) { reply = "Back."; keyboard = oddsKbWithCode; }
  else if (text === "⭐ Game of the Day VVIP" && userIsVvip) { const lim = await checkLimit(userId, "vvip", KV, isAdmin); if (!lim.allowed) reply = "📊 Daily limit reached."; else { await sendMsg(chatId, "👑 Analysing...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); let games = await KV.get("cached_vvip_games"); if (!games) games = await fetchAllLiveGames(env); if (!games) { reply = "No games."; } else { const pick = await askGroq("From:\n" + games + "\nSafest banker.", "Elite tipster."); await incrementLimit(userId, KV); reply = "👑 VVIP GAME OF DAY\n━━━━━━━━━━━━\n" + pick + scamWarning; } } keyboard = vvipMainKb; }
  else if (text === "🎰 LUCKY PICK") { const last = await KV.get("lastseen:" + userId); if (!last) reply = "🎰 Only active users."; else { const claimed = await KV.get("luckyclaim:" + userId); if (claimed) reply = "🎰 Already claimed today!\nBack tomorrow 🍀"; else { await sendMsg(chatId, "🎰 Generating LUCKY 3 Odds...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); const games = await fetchAllLiveGames(env); if (!games) reply = "🎰 No games."; else { const pick = await askGroq("From:\n" + games + "\nLUCKY 3 odds slip.", "Lucky tipster."); await KV.put("luckyclaim:" + userId, "yes", { expirationTtl: 86400 }); reply = "🎰 LUCKY 3 ODDS\n━━━━━━━━━━━━\n" + pick + "\n🍀 Good luck!" + scamWarning; } } } }
  else if (text === "◼️ PREDICTION TOOLS") { reply = "PREDICTION TOOLS"; keyboard = toolsKb; }
  else if (text === "💬 AI CHAT") { await KV.put("chatmode:" + userId, "yes", { expirationTtl: 180 }); reply = "AI CHAT ACTIVATED\n3 mins."; keyboard = chatExitKb; }
  else if (text === "🏆 GAME OF THE DAY") { const lim = await checkLimit(userId, userIsVvip ? "vvip" : (userIsVip ? "vip" : "free"), KV, isAdmin); if (!lim.allowed) reply = "📊 Daily limit reached."; else { const free = await KV.list({ prefix: "game_free:" }); if (free.keys.length === 0) reply = "Not ready 🎯"; else { await sendMsg(chatId, "🧠 Analysing...\n⏳ 30s...", null); await new Promise(r => setTimeout(r, 25000)); const k = free.keys[Math.floor(Math.random() * free.keys.length)]; const game = await KV.get(k.name); const pick = await askGroq("From:\n" + game + "\nSafest single.", "Pro tipster."); await incrementLimit(userId, KV); reply = "🏆 GAME OF DAY\n━━━━━━━━━━━━\n" + pick + scamWarning; } } }
  else if (text === "📊 MY WINS") { const w = await KV.get("wins:" + userId) || "0"; const won = parseInt(await KV.get("user_wins:" + userId) || "0"); const lost = parseInt(await KV.get("user_loss:" + userId) || "0"); const total = won + lost; const winRate = total > 0 ? Math.round((won / total) * 100) : 0; const points = await KV.get("points:" + userId) || "0"; const usage = await KV.get("daily_limit:" + userId) || "0"; const ulim = await KV.get("unlimited:" + userId); reply = "📊 STATS\n━━━━━━━━━━\n👀 Picks: " + w + "\n✅ Wins: " + won + "\n❌ Losses: " + lost + "\n📈 Rate: " + winRate + "%\n🎯 Points: " + points + "\n📋 Today: " + usage + (ulim ? " (UNLIMITED 🌟)" : ""); }
  else if (text === "🎁 REFER FRIENDS") reply = "🎁 REFERRAL\nYour ID: " + userId + "\nRefer 3 friends = 1d FREE VIP!";
  else if (text === "👤 MY ACCOUNT") { const s = isAdmin ? "Admin 👑" : (userIsVvip ? "VVIP 👑" : (userIsVip ? "VIP 💎" : "Free User")); let v = "Not Active"; if (isAdmin) v = "Lifetime"; else if (userIsVvip) { const e = await KV.get("vvip:" + userId); v = "VVIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + "d"; } else if (userIsVip) { const e = await KV.get("vip:" + userId); v = "VIP " + Math.ceil((parseInt(e) - Date.now()) / 86400000) + "d"; } const fav = await KV.get("favteam:" + userId) || "None"; const ulim = await KV.get("unlimited:" + userId); reply = "Profile\n━━━━━━━━━━\nName: " + firstName + "\nID: " + userId + "\nStatus: " + s + "\nAccess: " + v + "\n🔔 Team: " + fav + (ulim ? "\n🌟 UNLIMITED" : ""); }
  else if (text === "ℹ️ HELP") reply = await askGroq("Brief help for VortexPulse AI. Mention: Free Tips, VIP, VVIP, AI Chat, Lucky Pick, Quiz, Streak, Codes, Daily Limits. Under 80 words.");
  else if (text === "▫️ Straight Win" || text === "▫️ Double Chance" || text === "▫️ Over 1.5" || text === "▫️ Under 3.5" || text === "▫️ Draw No Bet" || text === "▫️ BTTS") { await KV.put("pending:" + userId, "free|" + text, { expirationTtl: 600 }); reply = "How would you like " + text + "?"; keyboard = pickTypeKb; }
  else if (text === "◾ Correct Score" || text === "◾ HT/FT" || text === "◾ Over 2.5 VIP" || text === "◾ Over 3.5 VIP" || text === "◾ Corners VIP" || text === "◾ Cards VIP" || text === "◾ 2 Odds Daily" || text === "◾ 5 Odds Daily" || text === "◾ 10 Odds Rollover" || text === "◾ Banker of Day") { if (userIsVip) { await KV.put("pending:" + userId, "vip|" + text, { expirationTtl: 600 }); reply = "How?"; keyboard = pickTypeKb; } else { reply = "🔒 VIP ONLY"; keyboard = vipKb; } }
  else if (text === "▪️ Single Pick" || text === "▪️ Slip (Multiple)") {
    const pending = await KV.get("pending:" + userId);
    if (!pending) { reply = "Choose market first."; keyboard = isAdmin ? userKbAdmin : userKb; }
    else {
      const [tier, market] = pending.split("|");
      const lim = await checkLimit(userId, tier === "free" ? "free" : "vip", KV, isAdmin);
      if (!lim.allowed) { reply = "📊 Daily limit reached (" + lim.max + "/day).\nUpgrade for more!"; keyboard = tier === "free" ? freeKb : vipKb; await KV.delete("pending:" + userId); }
      else {
        await KV.delete("pending:" + userId);
        const gameList = await KV.list({ prefix: "game_" + tier + ":" });
        if (gameList.keys.length === 0) { reply = "No games for " + market + ". Auto-fetch will run soon."; keyboard = tier === "free" ? freeKb : vipKb; }
        else {
          await sendMsg(chatId, "🧠 Analysing " + market + "...\n⏳ 30s...", null);
          await new Promise(r => setTimeout(r, 25000));
          let allGames = "";
          for (const k of gameList.keys) { const g = await KV.get(k.name); if (g) allGames += g + "\n\n"; }
          const fmt = text === "▪️ Single Pick" ? "ONE safe pick" : "SLIP of 3";
          const aiPick = await askGroq("From:\n" + allGames + "\n" + fmt + " ONLY for: " + market + ".", "Tipster.");
          await incrementLimit(userId, KV);
          const w = parseInt(await KV.get("wins:" + userId) || "0"); await KV.put("wins:" + userId, (w + 1).toString());
          await sendPickWithButtons(chatId, (text === "▪️ Single Pick" ? "🎯 SINGLE" : "📋 SLIP") + " - " + market + "\n━━━━━━━━━━━━\n" + aiPick + scamWarning, isAdmin ? userKbAdmin : userKb);
          return new Response("OK");
        }
      }
    }
  }
  else if (text === "◼️ Random Picker" || text === "◼️ Stats Insight" || text === "◼️ AI Prediction" || text === "◼️ League Picker" || text === "◼️ Country Games" || text === "◼️ Live Matches") { if (userIsVip) reply = "VIP ACCESS\nComing soon."; else reply = "🔒 VIP LOCKED"; keyboard = toolsKb; }
  else if (text === "◀️ BACK") { reply = "Back to menu."; keyboard = isAdmin ? userKbAdmin : userKb; }
  else { reply = "Please use the buttons below."; keyboard = isAdmin ? userKbAdmin : userKb; }

  await sendMsg(chatId, reply, keyboard);
  return new Response("OK");
}
