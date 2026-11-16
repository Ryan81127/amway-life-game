/* 韓籃甲（KBL 官方）與日本 B.League PREMIER。
   KBL：https://api.kbl.or.kr 允許瀏覽器直接讀，賽程和比分是即時的。
   B.League：官方賽程和比賽檔不送跨站標頭，瀏覽器讀不到。bleague.json 是 2026-11-16 從官網抓下來的整季賽程；11/13–11/23 另含名單。 */

const KBL_API = "https://api.kbl.or.kr";
const KBL_TEAMS = {
  "55": ["首爾SK騎士", "首尔SK骑士"],
  "10": ["蔚山現代摩比斯太陽神", "蔚山现代摩比斯太阳神"],
  "16": ["原州DB普羅米", "原州DB普罗米"],
  "35": ["首爾三星雷霆", "首尔三星雷霆"],
  "66": ["高陽索諾天空槍手", "高阳索诺天空枪手"],
  "50": ["昌原LG", "昌原LG"],
  "70": ["安養正官莊", "安养正官庄"],
  "60": ["釜山KCC宙斯盾", "釜山KCC宙斯盾"],
  "06": ["水原KT音速彈", "水原KT音速弹"],
  "64": ["大邱韓國燃氣飛馬", "大邱韩国燃气飞马"]
};
const BJ_TEAMS = {
  "群馬": ["群馬鶴雷霆", "群马鹤雷霆"],
  "滋賀": ["滋賀湖泊", "滋贺湖泊"],
  "三遠": ["三遠太陽神", "三远太阳神"],
  "千葉J": ["千葉噴射機", "千叶喷射机"],
  "神戸": ["神戶鸛鳥", "神户鹳鸟"],
  "A東京": ["東京電擊", "东京电击"],
  "川崎": ["川崎勇者雷霆", "川崎勇者雷霆"],
  "横浜BC": ["橫濱海盜", "横滨海盗"],
  "A千葉": ["千葉阿爾蒂里", "千叶阿尔蒂里"],
  "広島": ["廣島蜻蜓", "广岛蜻蜓"],
  "富山": ["富山松雞", "富山松鸡"],
  "琉球": ["琉球黃金帝王", "琉球黄金帝王"],
  "島根": ["島根須佐之男", "岛根须佐之男"],
  "宇都宮": ["宇都宮皇者", "宇都宫皇者"],
  "名古屋D": ["名古屋鑽石海豚", "名古屋钻石海豚"],
  "三河": ["三河海馬", "三河海马"],
  "大阪": ["大阪七福神", "大阪七福神"],
  "仙台": ["仙台八九人", "仙台八九人"],
  "秋田": ["秋田北方幸福", "秋田北方幸福"],
  "北海道": ["北海道雷邦加", "北海道雷邦加"],
  "茨城": ["茨城機器人", "茨城机器人"],
  "長崎": ["長崎維爾卡", "长崎维尔卡"],
  "京都": ["京都萩", "京都萩"],
  "信州": ["信州勇將", "信州勇将"],
  "佐賀": ["佐賀氣球人", "佐贺气球人"],
  "東京SR": ["東京陽光搖滾者", "东京阳光摇滚者"]
};
const KBL_POS = { GD: "控球", GF: "得分", F: "前鋒", FD: "前鋒", FC: "大前", C: "中鋒", G: "後衛" };

if (typeof PHRASES !== "undefined") {
  for (const [tw, cn] of [...Object.values(KBL_TEAMS), ...Object.values(BJ_TEAMS)]) {
    if (tw && cn && tw !== cn) PHRASES.push([tw, cn]);
  }
}

let kblPack = null;
let bjPack = null;
let kblRoster = null;

function currentLeague() {
  return readRoute().league || "nba";
}
function asiaWindow() {
  const today = taipeiYmd(new Date());
  const league = currentLeague();
  if (league !== "kbl" && league !== "bj") return null;
  const season = league === "kbl" ? ["2026-10-03", "2027-04-11"] : ["2026-09-20", "2027-05-15"];
  let start = addDays(today, -14);
  let end = addDays(today, 21);
  const picked = typeof readRoute === "function" ? readRoute().day : "";
  if (picked && picked < start) start = picked;
  if (picked && picked > end) end = picked;
  if (start < season[0]) start = season[0];
  if (end > season[1]) end = season[1];
  return { today, start, end };
}
function leagueTitle() {
  const id = currentLeague();
  if (id === "kbl") return "韓籃甲轉播看板";
  if (id === "bj") return "日本B聯賽轉播看板";
  return "NBA 轉播看板";
}
function leaguePill() {
  const id = currentLeague();
  return id === "kbl" ? "韓籃甲" : id === "bj" ? "日本B聯賽" : "NBA";
}
function kblName(code, fallback) {
  return (KBL_TEAMS[String(code)] || [fallback || String(code)])[0];
}
function bjName(ja) {
  return (BJ_TEAMS[ja] || [ja || ""])[0];
}

async function kblGet(path) {
  const res = await fetch(KBL_API + path, {
    headers: { Channel: "WEB", TeamCode: "XX", Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("KBL " + res.status);
  return res.json();
}
function kblWhen(gameDate, gameStart) {
  const d = String(gameDate || "");
  const t = String(gameStart || "0000").padStart(4, "0");
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:00+09:00`;
}
function kblState(g) {
  if (Number(g.isEnded) === 1) return "post";
  if (Number(g.isStarted) === 1) return "in";
  return "pre";
}
function kblClock(g) {
  const st = kblState(g);
  if (st === "pre") return "未開賽";
  if (st === "post") return "終場";
  const n = Number(String(g.playingQuarter || "").replace(/\D/g, "")) || 0;
  if (!n) return "進行中";
  if (n > 4) return "延長賽";
  return `第${["", "一", "二", "三", "四"][n]}節`;
}

const KBL_ABBR = { "55": "SK", "10": "摩比斯", "16": "DB", "35": "三星", "66": "索諾", "50": "LG", "70": "正官莊", "60": "KCC", "06": "KT", "64": "燃氣" };
function kblSide(code, name, score, logo) {
  return {
    id: String(code || ""),
    name: kblName(code, name),
    rawName: name || "",
    abbr: KBL_ABBR[String(code)] || "",
    logo: logo || "",
    color: "",
    score: score == null || score === "" ? "" : String(score),
    linescores: [],
    record: "",
    split: ""
  };
}
function kblCard(g) {
  const st = kblState(g);
  return {
    id: String(g.gmkey || ""),
    league: "kbl",
    date: kblWhen(g.gameDate, g.gameStart),
    state: st === "in" ? "in" : st === "post" ? "post" : "pre",
    status: { state: st === "in" ? "in" : st === "post" ? "post" : "pre", phase: st === "post" ? "ft" : st === "in" ? "live" : "pre", period: Number(g.playingQuarter) || 0, label: kblClock(g) },
    clock: kblClock(g),
    home: kblSide(g.tcodeH, g.tnameFH || g.tnameH, st === "pre" ? "" : g.scoreH),
    away: kblSide(g.tcodeA, g.tnameFA || g.tnameA, st === "pre" ? "" : g.scoreA),
    venue: g.stadiumnameF || g.stadiumname || "",
    odds: null,
    broadcast: g.tv || ""
  };
}

function attachRecords(cards, ranks) {
  const by = new Map((ranks || []).map((r) => [String(r.tcode), r]));
  for (const m of cards) {
    for (const side of ["home", "away"]) {
      const r = by.get(m[side].id);
      if (!r) continue;
      m[side].record = `${r.win}-${r.loss}`;
      m[side].split = side === "home" ? `${r.hwin}-${r.hloss}` : `${r.awin}-${r.aloss}`;
    }
  }
}

async function loadKblPack() {
  if (kblPack && Date.now() - kblPack.at < 60 * 1000) return kblPack;
  const [list, ranks] = await Promise.all([
    kblGet("/match/list?fromDate=20261001&toDate=20270430&seasonGrade=1"),
    kblGet("/league/rank/team").catch(() => [])
  ]);
  const games = (list || []).filter((g) => ["01", "03", "04"].includes(String(g.gameCode || "")));
  const cards = games.map(kblCard).filter((m) => m.id);
  attachRecords(cards, ranks);
  kblPack = { at: Date.now(), games, cards, ranks: ranks || [] };
  return kblPack;
}

function kblLog(games, code) {
  const id = String(code);
  const rows = games.filter((g) => Number(g.isEnded) === 1 && (String(g.tcodeH) === id || String(g.tcodeA) === id));
  rows.sort((a, b) => (a.gameDate + a.gameStart).localeCompare(b.gameDate + b.gameStart));
  return rows.map((g) => {
    const home = String(g.tcodeH) === id;
    const pf = Number(home ? g.scoreH : g.scoreA);
    const pa = Number(home ? g.scoreA : g.scoreH);
    return {
      id: String(g.gmkey || ""),
      date: kblWhen(g.gameDate, g.gameStart),
      result: pf > pa ? "W" : "L",
      opp: kblName(home ? g.tcodeA : g.tcodeH, home ? g.tnameA : g.tnameH),
      oppId: String(home ? g.tcodeA : g.tcodeH),
      home,
      pf, pa,
      score: `${g.scoreA}-${g.scoreH}`
    };
  });
}
function seasonFromLog(log) {
  if (!log.length) return null;
  const pf = log.reduce((a, g) => a + g.pf, 0) / log.length;
  const pa = log.reduce((a, g) => a + g.pa, 0) / log.length;
  const last = log.slice(-10);
  const wins = last.filter((g) => g.result === "W").length;
  let streak = 0;
  const lastRes = log[log.length - 1].result;
  for (let i = log.length - 1; i >= 0 && log[i].result === lastRes; i -= 1) streak += 1;
  return {
    avgPoints: pf,
    avgPointsAgainst: pa,
    streak: `${lastRes}${streak}`,
    "Last Ten Games": `${wins}-${last.length - wins}`
  };
}

function kblPlayerRow(row) {
  const p = row.player || {};
  const rec = row.records || {};
  const secs = (Number(rec.playMin) || 0) * 60 + (Number(rec.playSec) || 0);
  const played = secs > 0;
  const min = played ? `${Number(rec.playMin) || 0}:${String(Number(rec.playSec) || 0).padStart(2, "0")}` : "DNP";
  return {
    id: String(p.pcode || ""),
    name: p.ename || p.pname || "",
    en: p.ename || "",
    ja: p.pname || "",
    jersey: String(p.backNum || "").trim(),
    pos: KBL_POS[p.pos] || p.pos || "",
    starter: Number(row.startFlag) === 1,
    dnp: !played,
    reason: "",
    min,
    pts: Number(rec.score) || 0,
    fg: { m: Number(rec.fgt) || 0, a: Number(rec.fgtA) || 0 },
    tp: { m: Number(rec.threep) || 0, a: Number(rec.threepA) || 0 },
    ft: { m: Number(rec.ft) || 0, a: Number(rec.ftA) || 0 },
    reb: Number(rec.rb) || 0,
    ast: Number(rec.ast) || 0,
    tov: Number(rec.to) || 0,
    stl: Number(rec.stl) || 0,
    blk: Number(rec.bs) || 0,
    oreb: Number(rec.offr) || 0,
    dreb: Number(rec.defr) || 0,
    pf: Number(rec.foul) || 0,
    pm: Number(rec.marginCn) || 0
  };
}
function rosterRows(list, code) {
  return (list || []).filter((p) => String(p.tcode) === String(code) && String(p.playerLastCareerIf) === "A" && String(p.backNum || "").trim()).map((p) => ({
    id: String(p.pcode || ""),
    name: p.ename || p.pname || "",
    en: p.ename || "",
    ja: p.pname || "",
    jersey: String(p.backNum || "").trim(),
    pos: KBL_POS[p.pos] || "",
    starter: false,
    dnp: true,
    reason: "",
    min: "–",
    pts: 0, fg: { m: 0, a: 0 }, tp: { m: 0, a: 0 }, ft: { m: 0, a: 0 },
    reb: 0, ast: 0, tov: 0, stl: 0, blk: 0, oreb: 0, dreb: 0, pf: 0, pm: 0
  }));
}

function linesOf(block) {
  if (!block) return [];
  const qs = [block.scoreq1, block.scoreq2, block.scoreq3, block.scoreq4].map((n) => Number(n) || 0);
  const extra = Array.isArray(block.scoreeq) ? block.scoreeq.map((n) => Number(n) || 0) : [];
  const all = [...qs, ...extra];
  if (all.every((n) => !n)) return [];
  return all;
}

async function loadKblMatch(id) {
  const pack = kblPack || await loadKblPack();
  const raw = pack.games.find((g) => String(g.gmkey) === String(id));
  if (!raw) throw new Error("找不到這場");
  const detail = await kblGet("/match/" + id).catch(() => null);
  const card = kblCard(raw);
  const game = detail?.game || {};
  const rec = detail?.teamrecords || {};
  card.home.linescores = linesOf(rec.home);
  card.away.linescores = linesOf(rec.away);
  if (game.stadiumnameF) card.venue = game.stadiumnameF;
  const ranks = new Map((pack.ranks || []).map((r) => [String(r.tcode), r]));
  const standings = {};
  for (const side of ["home", "away"]) {
    const r = ranks.get(card[side].id);
    if (!r) continue;
    card[side].record = `${r.win}-${r.loss}`;
    card[side].split = side === "home" ? `${r.hwin}-${r.hloss}` : `${r.awin}-${r.aloss}`;
    standings[side] = {
      conf: "聯賽",
      rank: Number(r.rank) || 0,
      size: (pack.ranks || []).length,
      streak: Number(r.contiWin) ? `W${r.contiWin}` : Number(r.contiLoss) ? `L${r.contiLoss}` : "",
      w: r.win, l: r.loss
    };
  }
  let box = { home: [], away: [] };
  const stat = await kblGet("/match/" + id + "/player-stat").catch(() => null);
  if (Array.isArray(stat) && stat.length) {
    for (const row of stat) {
      const side = String(row.homeAway) === "1" ? "home" : "away";
      box[side].push(kblPlayerRow(row));
    }
  } else {
    if (!kblRoster) kblRoster = await kblGet("/players").catch(() => []);
    box = { home: rosterRows(kblRoster, card.home.id), away: rosterRows(kblRoster, card.away.id) };
  }
  const homeLog = kblLog(pack.games, card.home.id);
  const awayLog = kblLog(pack.games, card.away.id);
  const h2h = homeLog.filter((g) => g.oppId === card.away.id);
  const hw = h2h.filter((g) => g.result === "W").length;
  return finishModel(card, {
    box,
    season: { home: seasonFromLog(homeLog), away: seasonFromLog(awayLog) },
    form: [
      { id: card.home.id, games: homeLog.slice(-5).reverse() },
      { id: card.away.id, games: awayLog.slice(-5).reverse() }
    ],
    standings,
    series: h2h.length ? { summary: `${card.home.name} ${hw} 勝、${card.away.name} ${h2h.length - hw} 勝`, total: h2h.length, games: [] } : null,
    sourceName: "KBL 官方",
    sourceUrl: "https://www.kbl.or.kr/game/record/" + id
  });
}

function bjLogo(src) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return "https://www.bleague.jp" + src;
  return src;
}
function bjState(g) {
  if (g.hs != null && g.as != null) return "post";
  const start = Number(g.ts) * 1000;
  if (start && Date.now() >= start && Date.now() < start + 3 * 3600 * 1000) return "in";
  if (start && Date.now() >= start) return "post";
  return "pre";
}
function bjClock(g) {
  const st = bjState(g);
  if (st === "pre") return "未開賽";
  if (st === "in") return "進行中";
  if (g.hs == null) return "已開賽（這份賽程沒有比分）";
  return "終場";
}
function bjCard(g) {
  const st = bjState(g);
  const date = new Date(Number(g.ts) * 1000).toISOString();
  return {
    id: String(g.id),
    league: "bj",
    date,
    state: st === "in" ? "in" : st === "post" ? "post" : "pre",
    status: { state: st === "in" ? "in" : st === "post" ? "post" : "pre", phase: st === "post" ? "ft" : st === "in" ? "live" : "pre", period: st === "post" ? 4 : st === "in" ? 1 : 0, label: bjClock(g) },
    clock: bjClock(g),
    home: { id: g.homeJa, name: bjName(g.homeJa), rawName: g.homeEn || g.homeJa, abbr: g.homeJa, logo: bjLogo(g.logoH), color: "", score: st === "pre" || g.hs == null ? "" : String(g.hs), linescores: st === "post" ? (g.linesH || []).filter((n) => n != null) : [], record: "", split: "" },
    away: { id: g.awayJa, name: bjName(g.awayJa), rawName: g.awayEn || g.awayJa, abbr: g.awayJa, logo: bjLogo(g.logoA), color: "", score: st === "pre" || g.as == null ? "" : String(g.as), linescores: st === "post" ? (g.linesA || []).filter((n) => n != null) : [], record: "", split: "" },
    venue: g.venue || "",
    odds: null,
    broadcast: ""
  };
}
function bjPlayer(p) {
  const dnp = !p.min || p.min === "DNP";
  const p2m = Number(p.p2m) || 0, p2a = Number(p.p2a) || 0, p3m = Number(p.p3m) || 0, p3a = Number(p.p3a) || 0;
  return {
    id: (p.en || "") + (p.no || ""),
    name: p.en || p.ja || "",
    en: p.en || "",
    ja: p.ja || "",
    jersey: String(p.no || "").trim(),
    pos: "",
    starter: !!p.starter,
    dnp,
    reason: "",
    min: dnp ? "DNP" : p.min,
    pts: Number(p.pts) || 0,
    fg: { m: p2m + p3m, a: p2a + p3a },
    tp: { m: p3m, a: p3a },
    ft: { m: Number(p.ftm) || 0, a: Number(p.fta) || 0 },
    reb: Number(p.reb) || 0, ast: Number(p.ast) || 0, tov: Number(p.tov) || 0,
    stl: Number(p.stl) || 0, blk: Number(p.blk) || 0, oreb: 0, dreb: 0,
    pf: Number(p.pf) || 0, pm: Number(p.pm) || 0
  };
}
async function loadBjPack() {
  if (bjPack) return bjPack;
  const res = await fetch("bleague.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("B.League 賽程檔讀不到");
  const data = await res.json();
  const games = data.games || [];
  const cards = games.map(bjCard);
  const tally = new Map();
  for (const g of games) {
    if (g.hs == null || g.as == null) continue;
    for (const [id, ja, pf, pa, home] of [[g.homeJa, g.homeJa, g.hs, g.as, true], [g.awayJa, g.awayJa, g.as, g.hs, false]]) {
      if (!tally.has(id)) tally.set(id, []);
      tally.get(id).push({
        id: String(g.id), date: new Date(Number(g.ts) * 1000).toISOString(),
        result: pf > pa ? "W" : "L", opp: bjName(home ? g.awayJa : g.homeJa), oppId: home ? g.awayJa : g.homeJa,
        home, pf: Number(pf), pa: Number(pa), score: `${g.as}-${g.hs}`
      });
    }
  }
  for (const m of cards) {
    for (const side of ["home", "away"]) {
      const log = tally.get(m[side].id) || [];
      const w = log.filter((g) => g.result === "W").length;
      if (log.length) m[side].record = `${w}-${log.length - w}`;
    }
  }
  bjPack = { games, cards, tally };
  return bjPack;
}
async function loadBjMatch(id) {
  const pack = await loadBjPack();
  const g = pack.games.find((row) => String(row.id) === String(id));
  if (!g) throw new Error("找不到這場");
  const card = bjCard(g);
  const homeLog = pack.tally.get(card.home.id) || [];
  const awayLog = pack.tally.get(card.away.id) || [];
  for (const side of ["home", "away"]) {
    const log = side === "home" ? homeLog : awayLog;
    const w = log.filter((row) => row.result === "W").length;
    if (log.length) card[side].record = `${w}-${log.length - w}`;
  }
  const h2h = homeLog.filter((row) => row.oppId === card.away.id);
  const hw = h2h.filter((row) => row.result === "W").length;
  return finishModel(card, {
    box: { home: (g.playersH || []).map(bjPlayer), away: (g.playersA || []).map(bjPlayer) },
    season: { home: seasonFromLog(homeLog), away: seasonFromLog(awayLog) },
    form: [
      { id: card.home.id, games: homeLog.slice(-5).reverse() },
      { id: card.away.id, games: awayLog.slice(-5).reverse() }
    ],
    standings: {},
    series: h2h.length ? { summary: `${card.home.name} ${hw} 勝、${card.away.name} ${h2h.length - hw} 勝`, total: h2h.length, games: [] } : null,
    sourceName: "B.League 官方",
    sourceUrl: "https://www.bleague.jp/game_detail/?ScheduleKey=" + id
  });
}

function finishModel(card, extra) {
  const phase = card.status.phase;
  return {
    ...card,
    kickoff: card.date,
    city: "",
    attendance: 0,
    minute: { phase, state: card.status.state, period: card.status.period, label: card.status.label },
    plays: [],
    box: { players: extra.box, teams: { home: {}, away: {} } },
    season: phase === "pre" ? extra.season : extra.season,
    leaders: { home: [], away: [] },
    injuries: { home: [], away: [] },
    form: extra.form,
    series: extra.series,
    news: [],
    odds: null,
    oddsProvider: "",
    predictor: null,
    wp: [],
    standings: extra.standings || {},
    ats: {},
    sourceName: extra.sourceName,
    sourceUrl: extra.sourceUrl
  };
}

async function loadAsiaSchedule() {
  const league = currentLeague();
  const pack = league === "kbl" ? await loadKblPack() : await loadBjPack();
  state.matches = pack.cards;
  state.news = [];
  state.scheduleReady = true;
  state.scheduleError = false;
  state.scheduleLoadedAt = Date.now();
  state.fullLoaded = true;
  state.fullAt = Date.now();
  if (!readRoute().event) maybeRender({ soft: true });
}
async function loadAsiaMatch(id) {
  const league = currentLeague();
  const model = league === "kbl" ? await loadKblMatch(id) : await loadBjMatch(id);
  if (readRoute().event !== String(id)) return;
  if (model.status.phase === "pre") state.pred = null;
  state.model = model;
  state.summaryError = false;
  state.summaryLoadedAt = Date.now();
  if (typeof warmNames === "function") {
    const ens = [];
    for (const side of ["home", "away"]) for (const p of model.box.players[side] || []) if (p.en) ens.push(p.en);
    warmNames(ens);
  }
  if (readRoute().event === String(id)) maybeRender({ soft: true });
}

function rosterBlock(m) {
  if (!m?.league) return null;
  const sides = ["away", "home"].filter((side) => (m.box?.players?.[side] || []).length);
  if (!sides.length) return null;
  return h("section", { class: "panel", id: "roster" },
    h("h2", null, ui("名單與背號")),
    ...sides.map((side) => h("div", null,
      h("h3", null, ui(m[side].name)),
      h("div", { class: "roster-list" }, m.box.players[side].map((p) => h("div", { class: "roster-row" },
        p.starter ? h("span", { class: "star-mark" }, "★") : null,
        nameHead(p.en, p.jersey, p.ja),
        p.pos ? h("span", { class: "faint" }, ui(p.pos)) : null
      )))
    )),
    h("p", { class: "faint" }, ui(m.league === "kbl"
      ? "背號只取 KBL 官方名單上的號碼，沒有就不顯示。中文名先用辭典，沒有就查維基，再不行標成音譯未查證。"
      : "背號只取 B.League 官方名單上的號碼。這份名單是 2026-11-16 抓下來的，官方網站不讓網頁直接更新。"))
  );
}
function asiaLinks(model) {
  if (!model?.league) return null;
  const items = model.league === "kbl"
    ? [["KBL 官方", model.sourceUrl || "https://www.kbl.or.kr/"], ["KBL 賽程", "https://www.kbl.or.kr/schedule"]]
    : [["B.League 官方", model.sourceUrl || "https://www.bleague.jp/schedule/?tab=1&year=2026"], ["B.League 排名", "https://www.bleague.jp/standings/?tab=1&year=2026"]];
  return h("details", { class: "fold", "data-k": "links" }, h("summary", null, ui("官方出處")),
    h("div", { class: "link-grid" }, items.map(([n, u]) => h("a", { href: u, target: "_blank", rel: "noopener" }, n))));
}
