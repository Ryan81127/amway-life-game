/* NBA 資料層：ESPN 賽程、比賽摘要（逐球紀錄、數據、傷兵、盤口、勝率）、新聞。 */
const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const TEAM_ZH = {
  1: "老鷹", 2: "塞爾提克", 3: "鵜鶘", 4: "公牛", 5: "騎士", 6: "獨行俠", 7: "金塊", 8: "活塞", 9: "勇士", 10: "火箭",
  11: "溜馬", 12: "快艇", 13: "湖人", 14: "熱火", 15: "公鹿", 16: "灰狼", 17: "籃網", 18: "尼克", 19: "魔術", 20: "76人",
  21: "太陽", 22: "拓荒者", 23: "國王", 24: "馬刺", 25: "雷霆", 26: "爵士", 27: "巫師", 28: "暴龍", 29: "灰熊", 30: "黃蜂"
};

const TEAM_CITY = {
  1: "亞特蘭大", 2: "波士頓", 3: "紐奧良", 4: "芝加哥", 5: "克里夫蘭", 6: "達拉斯", 7: "丹佛", 8: "底特律", 9: "舊金山", 10: "休士頓",
  11: "印第安納波利斯", 12: "洛杉磯", 13: "洛杉磯", 14: "邁阿密", 15: "密爾瓦基", 16: "明尼亞波利斯", 17: "紐約布魯克林", 18: "紐約", 19: "奧蘭多", 20: "費城",
  21: "鳳凰城", 22: "波特蘭", 23: "沙加緬度", 24: "聖安東尼奧", 25: "奧克拉荷馬市", 26: "鹽湖城", 27: "華盛頓", 28: "多倫多", 29: "曼菲斯", 30: "夏洛特"
};

const POS_ZH = { PG: "控球後衛", SG: "得分後衛", SF: "小前鋒", PF: "大前鋒", C: "中鋒", G: "後衛", F: "前鋒", GF: "鋒衛", FC: "前鋒／中鋒" };

const INJ_ZH = { Out: "確定缺陣", "Day-To-Day": "每日觀察", Questionable: "出賽成疑", Doubtful: "不太可能出賽", Probable: "可能出賽", Suspension: "禁賽" };

const state = {
  matches: [],
  scheduleReady: false,
  scheduleError: false,
  scheduleLoadedAt: 0,
  fullLoaded: false,
  fullAt: 0,
  model: null,
  summaryLoadedAt: 0,
  summaryLoading: false,
  summaryError: false,
  summaryStaleError: false,
  day: "",
  tab: "all",
  token: 0,
  abort: null,
  timer: null,
  pulseTimer: null,
  pulseAt: 0,
  pulseBusy: false,
  lastPulseSig: null,
  flash: null,
  pred: null,
  predAbort: null,
  cards: null,
  cardFilter: null,
  news: null
};

function teamZh(id, fallback) {
  return TEAM_ZH[Number(id)] || fallback || "";
}

function relabelNames() { /* 中文隊名固定，切換用語時交給 speak() 轉換 */ }

function windowBounds() {
  const today = taipeiYmd(new Date());
  return { today, start: addDays(today, -3), end: addDays(today, 7) };
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal: signal || state.abort?.signal, cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data && data.code && data.message && !data.events && !data.header) throw new Error(String(data.message));
  return data;
}

/* ESPN 的 dates 參數是美東日期；台北的一天約等於美東前一天晚上到當天 */
function etDate(ymd) {
  return ymd.replaceAll("-", "");
}

function readStatus(status) {
  const t = status?.type || {};
  const period = Number(status?.period || 0);
  const clock = status?.displayClock || "";
  const name = t.name || "";
  let phase = "live";
  if (t.state === "pre") phase = "pre";
  else if (t.state === "post") phase = "ft";
  else if (name === "STATUS_HALFTIME") phase = "ht";
  else if (name === "STATUS_END_PERIOD") phase = "endq";
  const pLabel = period > 4 ? `延長賽${period > 5 ? " " + (period - 4) : ""}` : `第${["", "一", "二", "三", "四"][period] || period}節`;
  let label = "未開賽";
  if (phase === "ft") label = period > 4 ? "終場（延長）" : "終場";
  else if (phase === "ht") label = "中場休息";
  else if (phase === "endq") label = `${pLabel}結束`;
  else if (phase === "live") label = `${pLabel} ${clock}`;
  if (name === "STATUS_POSTPONED") label = "延期";
  if (name === "STATUS_CANCELED") label = "取消";
  return { state: t.state || "pre", phase, period, clock, label, name, secLeft: clockSec(clock) };
}

function clockSec(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  if (t.includes(":")) {
    const [m, s] = t.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/* 比賽已進行秒數（每節 12 分鐘，延長 5 分鐘） */
function elapsedSec(period, secLeft) {
  if (!period) return 0;
  const reg = Math.min(period, 4);
  let e = (reg - 1) * 720 + (period <= 4 ? 720 - secLeft : 720);
  if (period > 4) e = 2880 + (period - 5) * 300 + (300 - secLeft);
  return Math.max(0, e);
}

function sideOf(c) {
  const t = c.team || {};
  const id = String(t.id || c.id || "");
  return {
    id,
    name: teamZh(id, t.shortDisplayName || t.displayName),
    rawName: t.displayName || "",
    abbr: t.abbreviation || "",
    logo: t.logo || t.logos?.[0]?.href || "",
    color: t.color || "",
    score: c.score ?? "",
    linescores: (c.linescores || []).map((x) => Number(x.displayValue ?? x.value)),
    record: (c.records || c.record || []).find((r) => r.type === "total" || r.name === "overall")?.summary || ""
  };
}

function normalizeEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const hc = cs.find((c) => c.homeAway === "home") || cs[0] || {};
  const ac = cs.find((c) => c.homeAway === "away") || cs[1] || {};
  const st = readStatus(comp.status || ev.status);
  const o = (comp.odds || [])[0];
  return {
    id: String(ev.id),
    date: comp.date || ev.date,
    state: st.state,
    status: st,
    clock: st.label,
    home: sideOf(hc),
    away: sideOf(ac),
    venue: comp.venue?.fullName || "",
    odds: o ? { spread: o.spread, details: o.details, total: o.overUnder } : null,
    broadcast: (comp.broadcasts || []).flatMap((b) => b.names || []).join("、")
  };
}

const dayCache = new Map();

function dayTtl(day) {
  const today = taipeiYmd(new Date());
  if (day >= addDays(today, -1) && day <= addDays(today, 1)) return 0;
  if (day < today) return 6 * 3600 * 1000;
  return 20 * 60 * 1000;
}

async function fetchDay(day) {
  const key = day;
  const hit = dayCache.get(key);
  if (hit && Date.now() - hit.t < dayTtl(day)) return hit.events;
  try {
    const data = await fetchJson(`${API}/scoreboard?dates=${etDate(day)}`);
    dayCache.set(key, { t: Date.now(), events: data.events || [] });
    return data.events || [];
  } catch (err) {
    if (hit) return hit.events;
    throw err;
  }
}

/* 台北某一天的 NBA 比賽，幾乎都落在美東「前一天」晚上；回傳要抓的美東日期 */
function wantedDays(mode) {
  const b = windowBounds();
  if (mode === "near") return [addDays(b.today, -2), addDays(b.today, -1), b.today];
  return eachYmd(addDays(b.start, -1), b.end);
}

/* ---------- 比賽摘要 ---------- */

function shotInfo(text, type) {
  const t = String(text || "").toLowerCase();
  const ft = /free throw/.test(t) || /free throw/i.test(type);
  const three = /three point|3-pt|3pt/.test(t);
  const made = /\bmakes\b/.test(t);
  const missed = /\bmisses\b/.test(t);
  const dist = Number((/(\d+)-foot/.exec(t) || [])[1]) || null;
  const rim = /layup|dunk|tip|finger roll|alley oop|putback/.test(t);
  return { ft, three, made, missed, dist, rim, dunk: /dunk/.test(t) };
}

function parsePlays(raw, home, away, nameOf) {
  const out = [];
  for (const p of raw || []) {
    const type = p.type?.text || "";
    const text = p.text || "";
    const period = Number(p.period?.number || 0);
    const secLeft = clockSec(p.clock?.displayValue);
    const teamId = String(p.team?.id || "");
    const side = teamId === home.id ? "home" : teamId === away.id ? "away" : "";
    const ids = (p.participants || []).map((x) => String(x.athlete?.id || ""));
    const shot = p.shootingPlay ? shotInfo(text, type) : null;
    const ast = /\(([^)]+?) assists\)/i.exec(text);
    out.push({
      id: String(p.id || out.length),
      period, secLeft, clock: p.clock?.displayValue || "",
      t: elapsedSec(period, secLeft),
      type, text, side,
      score: !!p.scoringPlay, value: Number(p.scoreValue || 0),
      shot,
      fg: shot && !shot.ft ? shot : null,
      hs: Number(p.homeScore), as: Number(p.awayScore),
      player: ids[0] ? nameOf(ids[0]) || "" : "",
      playerId: ids[0] || "",
      assist: ast ? playerZh(ast[1]) : "",
      reb: /rebound/i.test(type), oreb: /offensive rebound/i.test(type),
      tov: /turnover/i.test(type),
      foul: /foul/i.test(type) && !/free throw/i.test(type),
      stl: /steals\)/i.test(text), blk: /blocks/i.test(text),
      timeout: /timeout/i.test(type),
      review: /challenge|review|technical|flagrant/i.test(type + " " + text),
      wall: p.wallclock || ""
    });
  }
  return out;
}

const BOX_KEYS = ["minutes", "points", "fg", "three", "ft", "rebounds", "assists", "turnovers", "steals", "blocks", "oreb", "dreb", "fouls", "plusMinus"];

function splitMA(v) {
  const [m, a] = String(v || "0-0").split("-").map(Number);
  return { m: m || 0, a: a || 0 };
}

function readBoxPlayers(block) {
  const s = block?.statistics?.[0];
  if (!s) return [];
  const keys = s.keys || [];
  const ix = (k) => keys.indexOf(k);
  return (s.athletes || []).map((a) => {
    const st = a.stats || [];
    const get = (k) => st[ix(k)];
    const fg = splitMA(get("fieldGoalsMade-fieldGoalsAttempted"));
    const tp = splitMA(get("threePointFieldGoalsMade-threePointFieldGoalsAttempted"));
    const ft = splitMA(get("freeThrowsMade-freeThrowsAttempted"));
    const en = a.athlete?.displayName || "";
    return {
      id: String(a.athlete?.id || ""),
      name: playerZh(en),
      en,
      jersey: a.athlete?.jersey || "",
      pos: a.athlete?.position?.abbreviation || "",
      starter: !!a.starter,
      dnp: !!a.didNotPlay || !st.length,
      reason: a.reason || "",
      min: Number(get("minutes")) || 0,
      pts: Number(get("points")) || 0,
      fg, tp, ft,
      reb: Number(get("rebounds")) || 0,
      ast: Number(get("assists")) || 0,
      tov: Number(get("turnovers")) || 0,
      stl: Number(get("steals")) || 0,
      blk: Number(get("blocks")) || 0,
      oreb: Number(get("offensiveRebounds")) || 0,
      dreb: Number(get("defensiveRebounds")) || 0,
      pf: Number(get("fouls")) || 0,
      pm: Number(get("plusMinus")) || 0
    };
  });
}

function readTeamBox(t) {
  const out = {};
  for (const x of t?.statistics || []) {
    if (/-/.test(x.name) && /-/.test(String(x.displayValue))) {
      const ma = splitMA(x.displayValue);
      out[x.name.split("-")[0]] = ma.m;
      out[x.name.split("-")[1]] = ma.a;
    } else {
      const n = parseFloat(String(x.displayValue).replace("%", ""));
      out[x.name] = Number.isFinite(n) ? n : x.displayValue;
    }
  }
  return out;
}

function readInjuries(data, home, away) {
  const out = { home: [], away: [] };
  for (const t of data.injuries || []) {
    const id = String(t.team?.id || "");
    const side = id === home.id ? "home" : id === away.id ? "away" : null;
    if (!side) continue;
    for (const i of t.injuries || []) {
      const d = i.details || {};
      out[side].push({
        name: playerZh(i.athlete?.displayName || ""),
        en: i.athlete?.displayName || "",
        status: i.status || "",
        statusZh: INJ_ZH[i.status] || i.status || "",
        part: [d.side && d.side !== "Not Specified" ? (d.side === "Left" ? "左" : d.side === "Right" ? "右" : "") : "", d.type || ""].join(""),
        detail: d.detail || "",
        ret: d.returnDate || "",
        date: i.date || ""
      });
    }
  }
  return out;
}

function readForm(data) {
  return (data.lastFiveGames || []).map((b) => ({
    id: String(b.team?.id || ""),
    games: (b.events || []).map((e) => {
      const homeId = String(e.homeTeamId || "");
      const mine = String(b.team?.id || "");
      const isHome = homeId === mine;
      const hs = Number(e.homeTeamScore);
      const as = Number(e.awayTeamScore);
      return {
        id: String(e.id || ""),
        date: e.gameDate,
        result: e.gameResult,
        opp: teamZh(e.opponent?.id, e.opponent?.abbreviation),
        oppId: String(e.opponent?.id || ""),
        home: isHome,
        pf: isHome ? hs : as,
        pa: isHome ? as : hs,
        score: e.score
      };
    })
  }));
}

function readSeries(data, home) {
  const s = (data.seasonseries || [])[0];
  if (!s) return null;
  const games = (s.events || []).filter((e) => e.statusType?.completed || e.status === "post" || (e.competitors || []).every((c) => c.score)).map((e) => {
    const cs = e.competitors || [];
    const h = cs.find((c) => String(c.team?.id || c.id) === home.id);
    const o = cs.find((c) => c !== h);
    return { date: e.date, mine: Number(h?.score), opp: Number(o?.score) };
  }).filter((g) => Number.isFinite(g.mine) && Number.isFinite(g.opp) && (g.mine || g.opp));
  return { summary: s.summary || "", total: s.totalCompetitions || 0, games };
}

function readNews(data) {
  const list = data.news?.articles || [];
  return list.slice(0, 6).map((a) => ({
    title: a.headline || "",
    desc: a.description || "",
    url: a.links?.web?.href || "",
    at: a.published || a.lastModified || ""
  })).filter((a) => a.title);
}

function readStandings(raw, home, away) {
  const out = {};
  for (const g of raw?.groups || []) {
    const head = g.header || g.name || "";
    const div = Object.entries({ Atlantic: "大西洋組", Central: "中央組", Southeast: "東南組", Northwest: "西北組", Pacific: "太平洋組", Southwest: "西南組", East: "東區", West: "西區" }).find(([k]) => head.includes(k));
    const conf = div ? div[1] : "";
    (g.standings?.entries || []).forEach((e, i) => {
      const id = String(e.id || "");
      const side = id === home.id ? "home" : id === away.id ? "away" : null;
      if (!side) return;
      const st = Object.fromEntries((e.stats || []).map((x) => [x.name, x.displayValue]));
      out[side] = { conf, rank: i + 1, size: (g.standings?.entries || []).length, gb: st.gamesBehind || "", pct: st.winPercent || "", streak: st.streak || "", w: st.wins, l: st.losses };
    });
  }
  return out;
}

function readAts(raw, home, away) {
  const out = {};
  for (const t of raw || []) {
    const id = String(t.team?.id || "");
    const side = id === home.id ? "home" : id === away.id ? "away" : null;
    if (!side) continue;
    const rec = (t.records || []).find((r) => /overall|ats/i.test(r.type || r.name || "")) || (t.records || [])[0];
    if (rec?.summary) out[side] = rec.summary;
  }
  return out;
}

function buildModel(data) {
  const comp = data.header?.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const hc = cs.find((c) => c.homeAway === "home") || cs[0] || {};
  const ac = cs.find((c) => c.homeAway === "away") || cs[1] || {};
  const home = sideOf(hc);
  const away = sideOf(ac);
  home.record = (hc.record || []).find((r) => r.type === "total")?.summary || home.record;
  away.record = (ac.record || []).find((r) => r.type === "total")?.summary || away.record;
  home.split = (hc.record || []).find((r) => r.type === "home")?.summary || "";
  away.split = (ac.record || []).find((r) => r.type === "road")?.summary || "";
  const status = readStatus(comp.status);
  const boxP = { home: [], away: [] };
  for (const b of data.boxscore?.players || []) {
    const id = String(b.team?.id || "");
    if (id === home.id) boxP.home = readBoxPlayers(b);
    else if (id === away.id) boxP.away = readBoxPlayers(b);
  }
  const boxT = { home: {}, away: {} };
  for (const t of data.boxscore?.teams || []) {
    const id = String(t.team?.id || "");
    if (id === home.id) boxT.home = readTeamBox(t);
    else if (id === away.id) boxT.away = readTeamBox(t);
  }
  const names = new Map();
  for (const p of [...boxP.home, ...boxP.away]) names.set(p.id, p.name);
  const nameOf = (id) => names.get(id) || "";
  const plays = parsePlays(data.plays, home, away, nameOf);
  for (const p of plays) {
    if (!p.player && p.playerId) {
      const m = /^([A-Z][\w.'-]+(?: [A-Z][\w.'-]+)*?) (?:makes|misses|defensive|offensive|shooting|personal|bad pass|lost ball|blocks|steals|turnover|traveling|enters)/.exec(p.text);
      if (m) p.player = playerZh(m[1]);
    }
  }
  const pre = status.phase === "pre";
  const pc = (data.pickcenter || [])[0];
  const leaders = {};
  for (const block of data.leaders || []) {
    const id = String(block.team?.id || "");
    const side = id === home.id ? "home" : id === away.id ? "away" : null;
    if (!side) continue;
    leaders[side] = (block.leaders || []).map((l) => ({
      key: l.name,
      label: l.displayName || l.name,
      name: playerZh(l.leaders?.[0]?.athlete?.displayName || ""),
      en: l.leaders?.[0]?.athlete?.displayName || "",
      value: Number(String(l.leaders?.[0]?.displayValue || "").split(",")[0]) || 0,
      display: l.leaders?.[0]?.displayValue || ""
    }));
  }
  const pr = data.predictor;
  return {
    id: String(data.header?.id || comp.id || ""),
    kickoff: comp.date,
    venue: data.gameInfo?.venue?.fullName || "",
    city: [data.gameInfo?.venue?.address?.city, data.gameInfo?.venue?.address?.state].filter(Boolean).join(", "),
    attendance: data.gameInfo?.attendance || 0,
    status,
    minute: { phase: status.phase, state: status.state, period: status.period, label: status.label },
    home, away,
    plays,
    box: { players: boxP, teams: boxT },
    season: pre ? boxT : null,
    leaders,
    injuries: readInjuries(data, home, away),
    form: readForm(data),
    series: readSeries(data, home),
    news: readNews(data),
    odds: parseBook(pc),
    oddsProvider: pc?.provider?.name || "",
    predictor: pr ? { home: Number(pr.homeTeam?.gameProjection) / 100, away: Number(pr.awayTeam?.gameProjection) / 100 } : null,
    wp: (data.winprobability || []).map((w) => Number(w.homeWinPercentage)),
    standings: readStandings(data.standings, home, away),
    ats: readAts(data.againstTheSpread, home, away)
  };
}

function readRoute() {
  const q = new URLSearchParams(location.search);
  return { event: q.get("event") || "", day: q.get("day") || "", tab: q.get("tab") || "" };
}

function anyLive() {
  return state.matches.some((m) => m.state === "in");
}
