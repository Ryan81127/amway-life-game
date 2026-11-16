/* competitionRules：各賽事、各賽季的積分與排名規則。
   這裡只放「確定性的規則」，不放任何即時資料。每條規則都標來源與確認狀態；
   查不到規則的賽事回傳 null，前端顯示「資料不足」，不得套用別的賽事的規則。

   tiebreak 可用的比較項：
     gd 總淨勝球、gf 總進球、wins 勝場、awaygf 客場進球
     h2h_pts／h2h_gd／h2h_gf／h2h_awaygf 同分球隊之間的對戰成績
     fairplay 公平競賽分、lots 抽籤、ranking 排名表（這三項沒有資料，遇到就標「無法由資料判定」） */

const RULES_VERSION = "rules-2026.11";

const UEFA_H2H = ["h2h_pts", "h2h_gd", "h2h_gf", "gd", "gf", "awaygf", "wins", "fairplay", "ranking"];

const RULESETS = [
  {
    slugs: ["eng.1"], name: "英超", type: "league", legs: 2,
    tiebreak: ["gd", "gf", "h2h_pts", "h2h_awaygf"],
    targets: [{ k: 1, label: "奪冠" }, { k: 4, label: "歐冠資格" }, { k: -3, label: "保級" }],
    confirmed: true, source: "Premier League Handbook（同分先比淨勝球、進球數，再比對戰）"
  },
  {
    slugs: ["esp.1"], name: "西甲", type: "league", legs: 2, h2hNeedsComplete: true,
    tiebreak: ["h2h_pts", "h2h_gd", "gd", "gf", "fairplay"],
    targets: [{ k: 1, label: "奪冠" }, { k: 4, label: "歐冠資格" }, { k: -3, label: "保級" }],
    confirmed: true, source: "RFEF 競賽規章（雙方兩回合都踢完才比對戰成績）"
  },
  {
    slugs: ["ita.1"], name: "義甲", type: "league", legs: 2, h2hNeedsComplete: true,
    tiebreak: ["h2h_pts", "h2h_gd", "gd", "gf", "lots"],
    targets: [{ k: 1, label: "奪冠" }, { k: 4, label: "歐冠資格" }, { k: -3, label: "保級" }],
    confirmed: true, source: "Lega Serie A 規章（冠軍與降級名額同分時另踢附加賽）",
    notes: ["冠軍或最後一個保級名額同分時，要加踢一場附加賽決定，不直接用同分比較。"]
  },
  {
    slugs: ["ger.1"], name: "德甲", type: "league", legs: 2,
    tiebreak: ["gd", "gf", "h2h_pts", "h2h_awaygf", "awaygf"],
    targets: [{ k: 1, label: "奪冠" }, { k: 4, label: "歐冠資格" }, { k: -3, label: "避開降級區與附加賽" }],
    confirmed: true, source: "DFL 競賽規則（第 16 名踢升降級附加賽）",
    notes: ["倒數第三名（第 16 名）要和德乙第三名踢升降級附加賽。"]
  },
  {
    slugs: ["fra.1"], name: "法甲", type: "league", legs: 2,
    tiebreak: ["gd", "h2h_pts", "h2h_gd", "gf", "awaygf", "fairplay"],
    targets: [{ k: 1, label: "奪冠" }, { k: 3, label: "歐冠資格" }, { k: -3, label: "避開降級區與附加賽" }],
    confirmed: false, source: "LFP 規章（同分順序待再核對）",
    notes: ["法甲 18 隊，倒數兩名降級、倒數第三名踢附加賽。"]
  },
  {
    slugs: ["jpn.1", "usa.1"], name: "聯賽", type: "league", legs: 2,
    tiebreak: ["gd", "gf"], targets: [{ k: 1, label: "榜首" }],
    confirmed: false, source: "未逐條核對，僅用淨勝球與進球數排序"
  },
  {
    slugs: ["uefa.champions", "uefa.europa"], name: "歐洲賽聯賽階段", type: "leaguephase", legs: 1, totalGames: 8,
    tiebreak: ["gd", "gf", "awaygf", "wins", "ranking"],
    targets: [{ k: 8, label: "直接晉級 16 強" }, { k: 24, label: "晉級（含附加賽）" }],
    confirmed: true, source: "UEFA 2024/25 起聯賽階段規則（前 8 直接晉級、9–24 附加賽、25 名後淘汰）",
    knockout: { legs: 2, awayGoals: false, extraTime: true, shootout: true }
  },
  {
    slugs: ["uefa.nations"], name: "歐國聯", type: "groups", legs: 2,
    tiebreak: UEFA_H2H, h2hReapply: true,
    targets: [{ k: 1, label: "小組第一" }, { k: 2, label: "小組前二" }, { k: 3, label: "避開最後一名" }],
    confirmed: true, source: "UEFA Nations League 2026/27 規章第 15 條（同分先比對戰成績）",
    knockout: { legs: 2, awayGoals: false, extraTime: true, shootout: true },
    notes: ["A 級前二晉級八強，第三名踢保級附加賽，第四名降級；各級的升降級規則不同，以積分榜上的區域說明為準。"]
  },
  {
    slugs: ["fifa.world"], name: "世界盃小組賽", type: "groups", legs: 1, fromSeason: 2026,
    tiebreak: ["h2h_pts", "h2h_gd", "h2h_gf", "gd", "gf", "fairplay", "ranking"], h2hReapply: true,
    targets: [{ k: 2, label: "小組前二直接晉級" }],
    bestThird: { take: 8, of: 12 },
    confirmed: true, source: "FIFA 2026 世界盃規章第 13 條（同分先比對戰成績；8 個最佳第三名晉級）",
    knockout: { legs: 1, awayGoals: false, extraTime: true, shootout: true },
    notes: ["小組第三名還要和其他組的第三名比較，12 組取 8 隊，需要全部小組的資料才能判定。"]
  },
  {
    slugs: ["fifa.world"], name: "世界盃小組賽", type: "groups", legs: 1, toSeason: 2022,
    tiebreak: ["gd", "gf", "h2h_pts", "h2h_gd", "h2h_gf", "fairplay", "lots"],
    targets: [{ k: 2, label: "小組前二晉級" }],
    confirmed: true, source: "FIFA 2022 世界盃規章（同分先比總淨勝球、總進球，再比對戰）",
    knockout: { legs: 1, awayGoals: false, extraTime: true, shootout: true }
  }
];

function rulesFor(slug, seasonYear) {
  const y = Number(seasonYear) || new Date().getFullYear();
  const hit = RULESETS.find((r) => r.slugs.includes(slug) && (r.fromSeason == null || y >= r.fromSeason) && (r.toSeason == null || y <= r.toSeason));
  return hit ? { ...hit, points: hit.points || [3, 1, 0], version: RULES_VERSION } : null;
}

const TIEBREAK_ZH = {
  gd: "總淨勝球", gf: "總進球", wins: "勝場數", awaygf: "客場進球",
  h2h_pts: "對戰積分", h2h_gd: "對戰淨勝球", h2h_gf: "對戰進球", h2h_awaygf: "對戰客場進球",
  fairplay: "公平競賽分", lots: "抽籤", ranking: "賽前排名"
};

function tiebreakText(rules) {
  return rules ? rules.tiebreak.map((k) => TIEBREAK_ZH[k] || k).join(" → ") : "";
}

/* 把 ESPN 積分榜上的區域說明轉成類型。歐國聯的說明依級別不同（"A: …; B-D: …"），要依小組所屬級別取對應那段。 */
function zoneFromNote(desc, groupName) {
  let text = String(desc || "").trim();
  if (!text) return null;
  const letter = (/Group\s+([A-D])\d/i.exec(groupName || "") || [])[1];
  if (letter && /[A-D](?:\s*[-,]\s*[A-D])*\s*:/.test(text)) {
    const parts = text.split(";").map((x) => x.trim());
    const mine = parts.find((p) => {
      const m = /^([A-D](?:\s*[-,]\s*[A-D])*)\s*:/.exec(p);
      if (!m) return false;
      const spec = m[1].replace(/\s/g, "");
      if (spec.includes("-")) { const [a, b] = spec.split("-"); return letter >= a && letter <= b; }
      return spec.split(",").includes(letter);
    });
    if (!mine) return null;
    text = mine.replace(/^[^:]+:\s*/, "");
  }
  const t = text.toLowerCase();
  let type = "other";
  if (/eliminat/.test(t)) type = "out";
  else if (/relegation.*playoff|relegation or playoff/.test(t)) type = "relplayoff";
  else if (/relegat/.test(t)) type = "relegation";
  else if (/promotion playoff|playoff/.test(t)) type = "playoff";
  else if (/qualif|champions league|advance|round of|promotion|finals/.test(t)) type = "advance";
  else if (/europa|conference/.test(t)) type = "europe";
  const zh = text
    .replace(/Qualifies for QFs/i, "晉級八強").replace(/Qualifies for round of 16/i, "直接晉級 16 強")
    .replace(/Knockout phase playoffs - seeded/i, "附加賽（種子）").replace(/Knockout phase playoffs - unseeded/i, "附加賽（非種子）")
    .replace(/Promotion playoffs/i, "升級附加賽").replace(/Relegation playoffs/i, "保級附加賽")
    .replace(/Relegation or playoffs/i, "降級或附加賽").replace(/Promotion/i, "升級").replace(/Relegation/i, "降級")
    .replace(/Champions League qualifying/i, "歐冠資格賽").replace(/Champions League/i, "歐冠區").replace(/Europa League/i, "歐霸區")
    .replace(/Conference League qualifying|Conference League/i, "歐協聯區").replace(/Eliminated/i, "淘汰").replace(/Advance.*/i, "晉級");
  return { type, label: zh, raw: text };
}

/* 兩回合淘汰賽：回傳晉級方，或說明還需要延長賽／點球。legs 為 [{home, away, hs, as, shootout?: {home, away}}]，第二回合主客互換。 */
function aggregateResult(leg1, leg2, opt = {}) {
  const a = leg1.home;
  const b = leg1.away;
  const aGoals = leg1.hs + leg2.as;
  const bGoals = leg1.as + leg2.hs;
  const out = { agg: { [a]: aGoals, [b]: bGoals }, winner: null, decidedBy: "", pending: false };
  if (aGoals !== bGoals) { out.winner = aGoals > bGoals ? a : b; out.decidedBy = "總比分"; return out; }
  if (opt.awayGoals) {
    const aAway = leg2.as;
    const bAway = leg1.as;
    if (aAway !== bAway) { out.winner = aAway > bAway ? a : b; out.decidedBy = "客場進球"; return out; }
  }
  const so = leg2.shootout;
  if (so && so.home !== so.away) { out.winner = so.home > so.away ? leg2.home : leg2.away; out.decidedBy = "點球大戰"; return out; }
  out.pending = true;
  out.decidedBy = "總比分打平，需延長賽或點球";
  return out;
}

/* 單場淘汰賽：90 分鐘（含延長）分出勝負就用比分，否則看點球。 */
function knockoutWinner(m) {
  if (m.hs !== m.as) return { winner: m.hs > m.as ? m.home : m.away, decidedBy: m.extraTime ? "延長賽" : "正規時間" };
  if (m.shootout && m.shootout.home !== m.shootout.away) return { winner: m.shootout.home > m.shootout.away ? m.home : m.away, decidedBy: "點球大戰" };
  return { winner: null, decidedBy: "尚未分出勝負" };
}

if (typeof module !== "undefined") module.exports = { RULES_VERSION, RULESETS, rulesFor, tiebreakText, TIEBREAK_ZH, zoneFromNote, aggregateResult, knockoutWinner };
