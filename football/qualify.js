/* qualificationEngine／liveQualificationEngine：純計算，不抓資料、不產生文字推測。
   輸入：球隊 id 清單、已賽比賽、未賽比賽、規則（rules.js）。
   比賽格式：{ id, home, away, hs, as }（home／away 是球隊 id）。 */

const UNKNOWN_CRITERIA = new Set(["fairplay", "lots", "ranking"]);

function qEmpty(id) {
  return { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, awaygf: 0, wins: 0 };
}

function qStats(ids, matches, points) {
  const set = new Set(ids);
  const rows = new Map(ids.map((id) => [id, qEmpty(id)]));
  const [W, D, L] = points || [3, 1, 0];
  for (const m of matches) {
    if (!set.has(m.home) || !set.has(m.away)) continue;
    if (!Number.isFinite(m.hs) || !Number.isFinite(m.as)) continue;
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    h.p += 1; a.p += 1;
    h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs; a.awaygf += m.as;
    if (m.hs > m.as) { h.w += 1; h.wins += 1; a.l += 1; h.pts += W; a.pts += L; }
    else if (m.hs < m.as) { a.w += 1; a.wins += 1; h.l += 1; a.pts += W; h.pts += L; }
    else { h.d += 1; a.d += 1; h.pts += D; a.pts += D; }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  return rows;
}

function qGroupBy(ids, keyOf) {
  const map = new Map();
  for (const id of ids) {
    const k = keyOf(id);
    const sig = k.join("|");
    if (!map.has(sig)) map.set(sig, { k, ids: [] });
    map.get(sig).ids.push(id);
  }
  return [...map.values()].sort((x, y) => {
    for (let i = 0; i < x.k.length; i += 1) if (x.k[i] !== y.k[i]) return y.k[i] - x.k[i];
    return 0;
  });
}

/* 排名表。回傳 rows（含 rank、why＝靠哪一項分出名次、tied＝同名次無法由資料判定的球隊）。 */
function rankTable(teamIds, matches, rules) {
  const overall = qStats(teamIds, matches, rules.points);
  const crit = rules.tiebreak;
  const why = new Map();
  const legs = rules.legs || 1;

  const breakTies = (ids, i) => {
    if (ids.length <= 1 || i >= crit.length) return [ids];
    const key = crit[i];
    if (key.startsWith("h2h_")) {
      let j = i;
      while (j < crit.length && crit[j].startsWith("h2h_")) j += 1;
      const block = crit.slice(i, j).map((k) => k.slice(4));
      const mini = qStats(ids, matches, rules.points);
      if (rules.h2hNeedsComplete) {
        const playedPairs = [...mini.values()].reduce((s, r) => s + r.p, 0) / 2;
        const expected = (ids.length * (ids.length - 1) / 2) * legs;
        if (playedPairs < expected) return breakTies(ids, j);
      }
      const groups = qGroupBy(ids, (id) => block.map((k) => mini.get(id)[k]));
      if (groups.length === 1) return breakTies(ids, j);
      const out = [];
      for (const g of groups) {
        for (const id of g.ids) why.set(id, "對戰成績");
        out.push(...(g.ids.length > 1 ? breakTies(g.ids, rules.h2hReapply ? i : j) : [g.ids]));
      }
      return out;
    }
    if (UNKNOWN_CRITERIA.has(key)) return breakTies(ids, i + 1);
    const groups = qGroupBy(ids, (id) => [overall.get(id)[key]]);
    if (groups.length === 1) return breakTies(ids, i + 1);
    const out = [];
    for (const g of groups) {
      for (const id of g.ids) why.set(id, key);
      out.push(...breakTies(g.ids, i + 1));
    }
    return out;
  };

  const tiers = [];
  for (const g of qGroupBy(teamIds, (id) => [overall.get(id).pts])) {
    if (g.ids.length === 1) tiers.push(g.ids);
    else tiers.push(...breakTies(g.ids, 0));
  }
  const rows = [];
  let rank = 1;
  for (const tier of tiers) {
    for (const id of tier) rows.push({ ...overall.get(id), rank, why: why.get(id) || "", tied: tier.length > 1 ? tier.filter((x) => x !== id) : [] });
    rank += tier.length;
  }
  return { rows, unresolved: tiers.filter((t) => t.length > 1) };
}

function targetK(k, n) {
  return k < 0 ? n + k : k;
}

/* 出線形勢（積分枚舉）：把所有未賽比賽的勝／平／負組合跑一遍。
   同分時一律用最保守的假設（確定晉級要「不靠同分比較也成立」），所以結論在數學上可靠；
   真的要比同分規則的情況會標成「可能要比同分規則」。 */
function outlook(teamIds, played, remaining, rules, k, focus) {
  const n = remaining.length;
  const base = qStats(teamIds, played, rules.points);
  const [W, D, L] = rules.points;
  const res = new Map(teamIds.map((id) => [id, { clinched: true, possible: false, own: null, clinchIf: { W: true, D: true, L: true }, possibleIf: { W: false, D: false, L: false }, seen: { W: false, D: false, L: false } }]));
  const ownIdx = new Map();
  for (const id of teamIds) {
    let idx = focus ? remaining.findIndex((m) => m.id === focus && (m.home === id || m.away === id)) : -1;
    if (idx < 0) idx = remaining.findIndex((m) => m.home === id || m.away === id);
    ownIdx.set(id, idx);
    res.get(id).own = idx >= 0 ? remaining[idx] : null;
  }
  const pts = new Map();
  const total = 3 ** n;
  for (let c = 0; c < total; c += 1) {
    for (const id of teamIds) pts.set(id, base.get(id).pts);
    const outcome = [];
    let x = c;
    for (let i = 0; i < n; i += 1) {
      const o = x % 3; x = (x - o) / 3;
      outcome.push(o);
      const m = remaining[i];
      if (o === 0) { pts.set(m.home, pts.get(m.home) + W); pts.set(m.away, pts.get(m.away) + L); }
      else if (o === 1) { pts.set(m.home, pts.get(m.home) + D); pts.set(m.away, pts.get(m.away) + D); }
      else { pts.set(m.away, pts.get(m.away) + W); pts.set(m.home, pts.get(m.home) + L); }
    }
    for (const id of teamIds) {
      const mine = pts.get(id);
      let ge = 0, gt = 0;
      for (const o of teamIds) { if (o === id) continue; const p = pts.get(o); if (p >= mine) ge += 1; if (p > mine) gt += 1; }
      const safe = 1 + ge <= k;
      const can = 1 + gt <= k;
      const r = res.get(id);
      if (!safe) r.clinched = false;
      if (can) r.possible = true;
      const idx = ownIdx.get(id);
      if (idx >= 0) {
        const o = outcome[idx];
        const m = remaining[idx];
        const mineRes = o === 1 ? "D" : (o === 0) === (m.home === id) ? "W" : "L";
        r.seen[mineRes] = true;
        if (!safe) r.clinchIf[mineRes] = false;
        if (can) r.possibleIf[mineRes] = true;
      }
    }
  }
  return res;
}

/* 大型聯賽（未賽場次太多，不能枚舉）：用「最多還能拿幾分」的上下界判定。 */
function boundsOutlook(rows, totalGames, k, points) {
  const W = (points || [3, 1, 0])[0];
  const max = new Map(rows.map((r) => [r.id, r.pts + Math.max(0, totalGames - r.p) * W]));
  const out = new Map();
  for (const r of rows) {
    const others = rows.filter((o) => o.id !== r.id);
    const clinched = others.filter((o) => max.get(o.id) >= r.pts).length < k;
    const possible = others.filter((o) => o.pts > max.get(r.id)).length < k;
    out.set(r.id, { clinched, possible, left: Math.max(0, totalGames - r.p), maxPts: max.get(r.id) });
  }
  return out;
}

/* 把枚舉結果轉成狀態代碼。status 只會是下列其中之一。 */
const Q_STATUS = {
  clinched: "數學上確定",
  out: "數學上確定無緣",
  drawEnough: "平局即可確定",
  winEnough: "贏球即確定",
  mustWin: "必須取勝",
  needHelp: "需要其他場次配合",
  waiting: "已踢完，等其他場次結果",
  alive: "仍有可能",
  unknown: "資料不足，無法確認"
};

function statusOf(o) {
  if (!o) return { code: "unknown", notes: [] };
  if (o.clinched) return { code: "clinched", notes: [] };
  if (!o.possible) return { code: "out", notes: [] };
  if (!o.own) return { code: "waiting", notes: ["自己的比賽已經踢完，結果取決於其他場次。"] };
  const notes = [];
  const { clinchIf: c, possibleIf: p, seen } = o;
  if (seen.D && c.D && c.W) return { code: "drawEnough", notes: seen.L && !c.L ? ["輸球的話還要看其他場次。"] : [] };
  if (seen.W && c.W) {
    if (!p.D && !p.L) notes.push("平局或輸球就確定無緣。");
    else notes.push("沒贏的話要看其他場次或同分比較。");
    return { code: "winEnough", notes };
  }
  if (p.W && !p.D && !p.L) return { code: "mustWin", notes: ["贏球之後還需要其他場次配合，或要比同分規則。"] };
  if (p.W || p.D || p.L) return { code: "needHelp", notes: ["不管自己踢出什麼結果，都還要看其他場次或同分規則。"] };
  return { code: "alive", notes };
}

/* 假設某場比賽變成指定比分後的排名表（其餘比賽照 base）。 */
function tableWith(teamIds, base, match, hs, as, rules) {
  const rest = base.filter((m) => m.id !== match.id);
  return rankTable(teamIds, rest.concat([{ ...match, hs, as }]), rules);
}

/* 下一球的影響：對每一場進行中的同組比賽，兩隊各進一球，列出名次或晉級區有變化的球隊。 */
function nextGoalEffects(teamIds, base, liveMatches, rules, k) {
  const now = rankTable(teamIds, base, rules).rows;
  const nowRank = new Map(now.map((r) => [r.id, r.rank]));
  const out = [];
  for (const m of liveMatches) {
    for (const side of ["home", "away"]) {
      const t = tableWith(teamIds, base, m, m.hs + (side === "home" ? 1 : 0), m.as + (side === "away" ? 1 : 0), rules).rows;
      const changes = [];
      for (const r of t) {
        const before = nowRank.get(r.id);
        const inBefore = before <= k;
        const inAfter = r.rank <= k;
        if (before !== r.rank || inBefore !== inAfter) changes.push({ id: r.id, from: before, to: r.rank, enters: !inBefore && inAfter, drops: inBefore && !inAfter });
      }
      out.push({ match: m.id, scorer: m[side], score: `${m.hs + (side === "home" ? 1 : 0)}-${m.as + (side === "away" ? 1 : 0)}`, changes });
    }
  }
  return out;
}

/* 目前在晉級線外的球隊，自己再進幾球（其他比賽不變）才能進到前 k 名；3 球內做不到回傳 null。 */
function goalsNeeded(teamIds, base, liveMatches, rules, k, teamId) {
  const m = liveMatches.find((x) => x.home === teamId || x.away === teamId);
  if (!m) return null;
  for (let g = 0; g <= 3; g += 1) {
    const hs = m.hs + (m.home === teamId ? g : 0);
    const as = m.as + (m.away === teamId ? g : 0);
    const row = tableWith(teamIds, base, m, hs, as, rules).rows.find((r) => r.id === teamId);
    if (row.rank <= k && !(row.tied.length && row.rank + row.tied.length > k)) return g;
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { rankTable, outlook, boundsOutlook, statusOf, Q_STATUS, tableWith, nextGoalEffects, goalsNeeded, targetK, qStats };
