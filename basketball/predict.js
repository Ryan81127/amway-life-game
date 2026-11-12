/* NBA 預測引擎、覆盤數據、主播口播。 */

const SIG_MARGIN = 12.5;
const SIG_TOTAL = 18;
const HCA = 2.4;
const EDGE_MIN = 0.02;
const EDGE_WILD = 0.1;

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function ncdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
function npdf(z) { return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); }
function ninv(p) {
  let lo = -8, hi = 8;
  for (let i = 0; i < 60; i += 1) { const mid = (lo + hi) / 2; if (ncdf(mid) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/* P(X > line)，X ~ N(mu, sd)；整數盤口時把剛好打平（push）排除 */
function pOver(mu, sd, line) {
  if (Number.isInteger(line)) {
    const pushP = ncdf((line + 0.5 - mu) / sd) - ncdf((line - 0.5 - mu) / sd);
    const win = 1 - ncdf((line + 0.5 - mu) / sd);
    return { win, push: pushP, lose: 1 - win - pushP };
  }
  const win = 1 - ncdf((line - mu) / sd);
  return { win, push: 0, lose: 1 - win };
}
function evOf(p, dec, push) {
  if (!dec || p == null) return null;
  return p.win * dec + (push ? p.push : 0) - 1;
}

function devig(a, b) {
  if (!a || !b) return null;
  const s = a + b;
  return s > 0 ? [a / s, b / s] : null;
}

/* ---------- 盤口記錄與變動 ---------- */

function oddsSnapshot(model) {
  const b = model.odds;
  if (!b) return null;
  return {
    t: Date.now(),
    spread: b.spread.home.pre?.line ?? null,
    spreadH: b.spread.home.pre?.decimal ?? null,
    spreadA: b.spread.away.pre?.decimal ?? null,
    total: b.total.over.pre?.line ?? null,
    over: b.total.over.pre?.decimal ?? null,
    under: b.total.under.pre?.decimal ?? null,
    mlH: b.moneyline.home.pre?.decimal ?? null,
    mlA: b.moneyline.away.pre?.decimal ?? null,
    openSpread: b.spread.home.open?.line ?? null,
    openTotal: b.total.over.open?.line ?? null
  };
}

function recordOdds(model) {
  const snap = oddsSnapshot(model);
  if (!snap || model.status.phase !== "pre") return loadOdds(model.id);
  const key = "nba-odds-v1:" + model.id;
  let rec = loadOdds(model.id);
  if (!rec) rec = { first: snap, last: snap, hist: [snap] };
  const prev = rec.last;
  const moved = ["spread", "total", "mlH", "mlA"].some((k) => prev[k] !== snap[k]);
  rec.last = snap;
  if (moved) rec.hist = [...(rec.hist || []), snap].slice(-30);
  try { localStorage.setItem(key, JSON.stringify(rec)); } catch { /* 空間不足就略過 */ }
  return rec;
}

function loadOdds(id) {
  try { return JSON.parse(localStorage.getItem("nba-odds-v1:" + id) || "null"); } catch { return null; }
}

function oddsMovement(model) {
  const rec = recordOdds(model);
  const now = oddsSnapshot(model) || rec?.last;
  if (!now) return [];
  const out = [];
  const base = {
    spread: now.openSpread ?? rec?.first?.spread,
    total: now.openTotal ?? rec?.first?.total,
    mlH: rec?.first?.mlH, mlA: rec?.first?.mlA
  };
  const H = model.home.name;
  const A = model.away.name;
  if (base.spread != null && now.spread != null && Math.abs(base.spread - now.spread) >= 0.5) {
    const toward = now.spread < base.spread ? H : A;
    out.push({ text: `讓分從 ${H} ${fmtHandicap(base.spread)} 走到 ${fmtHandicap(now.spread)}`, why: `資金往 ${toward} 那邊靠，市場更看好${toward}。`, side: toward === H ? "home" : "away", kind: "spread" });
  }
  if (base.total != null && now.total != null && Math.abs(base.total - now.total) >= 1) {
    const up = now.total > base.total;
    out.push({ text: `大小分從 ${trimNum(base.total)} ${up ? "升" : "降"}到 ${trimNum(now.total)}`, why: up ? "市場預期節奏更快或防守更鬆（常見原因：防守主力缺陣）。" : "市場預期得分變少（常見原因：進攻主力缺陣或背靠背）。", side: up ? "over" : "under", kind: "total" });
  }
  if (base.mlH && now.mlH && Math.abs(base.mlH - now.mlH) >= 0.1) {
    out.push({ text: `${H} 獨贏賠率 ${fmtOdd(base.mlH)} → ${fmtOdd(now.mlH)}`, why: now.mlH < base.mlH ? `${H}獲勝機率被調高。` : `${H}獲勝機率被調低。`, side: now.mlH < base.mlH ? "home" : "away", kind: "ml" });
  }
  return out;
}

/* ---------- 預測 ---------- */

function teamAvg(model, side) {
  const s = model.season?.[side] || {};
  const pf = Number(s.avgPoints);
  const pa = Number(s.avgPointsAgainst);
  return Number.isFinite(pf) && Number.isFinite(pa) && pf > 60 ? { pf, pa, net: pf - pa, s } : null;
}

function formOf(model, side) {
  const id = model[side].id;
  const f = model.form.find((x) => x.id === id);
  const games = f?.games || [];
  if (!games.length) return null;
  const diff = games.reduce((a, g) => a + (g.pf - g.pa), 0) / games.length;
  const pts = games.reduce((a, g) => a + g.pf, 0) / games.length;
  const allow = games.reduce((a, g) => a + g.pa, 0) / games.length;
  const w = games.filter((g) => g.result === "W").length;
  return { diff, pts, allow, w, n: games.length, games };
}

function injuryImpact(model, side) {
  const list = model.injuries[side] || [];
  const lead = (model.leaders[side] || []).map((l) => l.en);
  let pts = 0;
  const out = [];
  for (const i of list) {
    if (!/Out|Doubtful/i.test(i.status)) continue;
    const star = lead.includes(i.en);
    pts += star ? 3 : 0.6;
    out.push({ ...i, star });
  }
  return { pts: Math.min(pts, 7), out };
}

function buildPrediction(model) {
  const H = model.home.name;
  const A = model.away.name;
  const b = model.odds;
  const reasons = [];
  const parts = [];
  /* 市場 */
  const line = b?.spread.home.pre?.line;
  const total = b?.total.over.pre?.line;
  let mktMargin = Number.isFinite(line) ? -line : null;
  const ml = devig(b?.moneyline.home.pre?.implied, b?.moneyline.away.pre?.implied);
  if (mktMargin == null && ml) mktMargin = SIG_MARGIN * ninv(ml[0]);
  /* 數據 */
  const ha = teamAvg(model, "home");
  const aa = teamAvg(model, "away");
  const hf = formOf(model, "home");
  const af = formOf(model, "away");
  const hi = injuryImpact(model, "home");
  const ai = injuryImpact(model, "away");
  let statMargin = null;
  let statTotal = null;
  if (ha && aa) {
    const hExp = (ha.pf + aa.pa) / 2;
    const aExp = (aa.pf + ha.pa) / 2;
    statMargin = hExp - aExp + HCA;
    statTotal = hExp + aExp;
    if (hf && af) {
      statMargin = statMargin * 0.7 + (hf.diff - af.diff + HCA) * 0.3 / 1;
      statTotal = statTotal * 0.75 + (hf.pts + hf.allow + af.pts + af.allow) / 2 * 0.25;
    }
    statMargin += -hi.pts + ai.pts;
  }
  const bpi = model.predictor && Number.isFinite(model.predictor.home) && model.predictor.home > 0 && model.predictor.home < 1
    ? SIG_MARGIN * ninv(model.predictor.home) : null;
  const wM = [[mktMargin, 0.6], [statMargin, 0.25], [bpi, 0.15]].filter(([v]) => v != null && Number.isFinite(v));
  const wT = [[total, 0.7], [statTotal, 0.3]].filter(([v]) => v != null && Number.isFinite(v));
  if (!wM.length || !wT.length) return null;
  const mu = wM.reduce((a, [v, w]) => a + v * w, 0) / wM.reduce((a, [, w]) => a + w, 0);
  const muT = wT.reduce((a, [v, w]) => a + v * w, 0) / wT.reduce((a, [, w]) => a + w, 0);
  parts.push({ k: "市場", margin: mktMargin, total });
  parts.push({ k: "球隊數據", margin: statMargin, total: statTotal });
  parts.push({ k: "ESPN BPI", margin: bpi, total: null });

  const pHome = 1 - ncdf((0 - mu) / SIG_MARGIN);
  const ot = npdf(mu / SIG_MARGIN) / SIG_MARGIN * 1.05;
  const homePts = (muT + mu) / 2;
  const awayPts = (muT - mu) / 2;

  /* 理由 */
  if (mktMargin != null) reasons.push(`盤口開出 ${H} ${fmtHandicap(line ?? -mktMargin)}、大小分 ${trimNum(total)}，等於市場估 ${mktMargin >= 0 ? H : A} 贏 ${trimNum(Math.abs(mktMargin))} 分、總分約 ${trimNum(total)}。`);
  if (ha && aa) reasons.push(`本季場均：${H} 得 ${trimNum(ha.pf)} 失 ${trimNum(ha.pa)}（淨 ${signed(ha.net)}），${A} 得 ${trimNum(aa.pf)} 失 ${trimNum(aa.pa)}（淨 ${signed(aa.net)}）；主場優勢約 ${HCA} 分。`);
  if (hf && af) reasons.push(`近 ${hf.n} 場：${H} ${hf.w} 勝、平均分差 ${signed(hf.diff)}；${A} ${af.w} 勝、平均分差 ${signed(af.diff)}。`);
  if (bpi != null) reasons.push(`ESPN BPI 給 ${H} 勝率 ${pct(model.predictor.home)}，換算約 ${signed(bpi)} 分。`);
  for (const [side, imp] of [["home", hi], ["away", ai]]) {
    const stars = imp.out.filter((x) => x.star);
    if (stars.length) reasons.push(`${model[side].name} 主力 ${stars.map((x) => x.name).join("、")} ${stars.map((x) => x.statusZh).join("／")}，數據模型扣 ${trimNum(imp.pts)} 分。`);
    else if (imp.out.length >= 2) reasons.push(`${model[side].name} 有 ${imp.out.length} 人缺陣或不太可能出賽，輪換變薄。`);
  }
  const hs = model.standings?.home;
  const as = model.standings?.away;
  if (hs && as) reasons.push(`分組排名：${H} ${hs.conf}第 ${hs.rank}（${hs.streak || ""}），${A} ${as.conf}第 ${as.rank}（${as.streak || ""}）。`);

  /* 各盤口 */
  const picks = [];
  const add = (group, label, p, dec, extra) => {
    const ev = dec ? evOf(p, dec, true) : null;
    picks.push({ group, label, p: p.win, push: p.push, fair: p.win > 0 ? 1 / (p.win + (p.push ? 0 : 0)) : null, dec: dec || null, ev, ...extra });
  };
  /* 獨贏 */
  add("獨贏", `${H} 勝`, { win: pHome, push: 0 }, b?.moneyline.home.pre?.decimal);
  add("獨贏", `${A} 勝`, { win: 1 - pHome, push: 0 }, b?.moneyline.away.pre?.decimal);
  /* 讓分 */
  if (Number.isFinite(line)) {
    const pH = pOver(mu, SIG_MARGIN, -line);
    add("讓分", `${H} ${fmtHandicap(line)}`, pH, b.spread.home.pre?.decimal);
    add("讓分", `${A} ${fmtHandicap(-line)}`, { win: pH.lose, push: pH.push, lose: pH.win }, b.spread.away.pre?.decimal);
  }
  /* 大小分 */
  if (Number.isFinite(total)) {
    const pO = pOver(muT, SIG_TOTAL, total);
    add("大小分", `大 ${trimNum(total)}`, pO, b.total.over.pre?.decimal);
    add("大小分", `小 ${trimNum(total)}`, { win: pO.lose, push: pO.push, lose: pO.win }, b.total.under.pre?.decimal);
  }
  /* 上半場、第一節（無盤口時給公平線） */
  const halfMu = mu * 0.5;
  const halfT = muT * 0.485;
  const q1Mu = mu * 0.25;
  const q1T = muT * 0.245;
  const halfLine = Math.round(halfMu * 2) / 2 || 0.5;
  const halfTot = Math.round(halfT) + 0.5;
  const q1Line = Math.round(q1Mu * 2) / 2 || 0.5;
  const q1Tot = Math.round(q1T) + 0.5;
  add("上半場", `${halfMu >= 0 ? H : A} 半場 -${trimNum(Math.abs(halfLine))}`, pOver(Math.abs(halfMu), 8.8, Math.abs(halfLine)), null);
  add("上半場", `半場大 ${trimNum(halfTot)}`, pOver(halfT, 12.5, halfTot), null);
  add("第一節", `${q1Mu >= 0 ? H : A} 首節 -${trimNum(Math.abs(q1Line))}`, pOver(Math.abs(q1Mu), 6.3, Math.abs(q1Line)), null);
  add("第一節", `首節大 ${trimNum(q1Tot)}`, pOver(q1T, 8, q1Tot), null);
  /* 球隊得分 */
  const htLine = Math.round(homePts) + 0.5;
  const atLine = Math.round(awayPts) + 0.5;
  add("球隊得分", `${H} 大 ${trimNum(htLine)}`, pOver(homePts, 11.5, htLine), null);
  add("球隊得分", `${A} 大 ${trimNum(atLine)}`, pOver(awayPts, 11.5, atLine), null);
  /* 勝分差 */
  const band = (lo, hi) => ncdf((hi + 0.5 - mu) / SIG_MARGIN) - ncdf((lo - 0.5 - mu) / SIG_MARGIN);
  const bands = [
    [`${H} 贏 1–5`, band(1, 5)], [`${H} 贏 6–10`, band(6, 10)], [`${H} 贏 11–15`, band(11, 15)], [`${H} 贏 16+`, 1 - ncdf((15.5 - mu) / SIG_MARGIN)],
    [`${A} 贏 1–5`, band(-5, -1)], [`${A} 贏 6–10`, band(-10, -6)], [`${A} 贏 11–15`, band(-15, -11)], [`${A} 贏 16+`, ncdf((-15.5 - mu) / SIG_MARGIN)]
  ];
  bands.forEach(([label, p]) => add("勝分差", label, { win: p, push: 0 }, null));
  add("特殊", "打進延長賽", { win: ot, push: 0 }, null);

  /* 球員得分預估（ESPN 本季場均領先者） */
  const props = [];
  for (const side of ["home", "away"]) {
    for (const l of model.leaders[side] || []) {
      if (!/points/i.test(l.key) || !l.value) continue;
      const out = (model.injuries[side] || []).some((i) => i.en === l.en && /Out/i.test(i.status));
      const adj = l.value * (1 + (muT - 226) / 226 * 0.6);
      props.push({ side, name: l.name, avg: l.value, proj: out ? 0 : adj, out, line: Math.round(adj) + 0.5 });
    }
  }

  const priced = picks.filter((p) => p.ev != null);
  const value = priced.filter((p) => p.ev >= EDGE_MIN).sort((a, b) => b.ev - a.ev);
  const moves = oddsMovement(model);
  for (const v of value) {
    v.wild = v.ev >= EDGE_WILD;
    const against = moves.find((m) => (m.kind === "spread" || m.kind === "ml") && ((m.side === "home" && v.label.startsWith(A)) || (m.side === "away" && v.label.startsWith(H))))
      || moves.find((m) => m.kind === "total" && ((m.side === "over" && v.label.startsWith("小")) || (m.side === "under" && v.label.startsWith("大"))));
    if (against) v.warn = `與盤口走勢相反（${against.text}），市場可能知道你不知道的消息，下注要更保守。`;
  }
  const lean = [...picks].filter((p) => ["讓分", "大小分", "獨贏"].includes(p.group)).sort((a, b) => b.p - a.p)[0];
  return {
    id: model.id, at: Date.now(),
    mu, muT, pHome, ot, homePts, awayPts,
    parts, reasons, picks, value, props, moves,
    line, total,
    lean
  };
}

function savePrediction(model, pred) {
  const key = "nba-pred-v1:" + model.id;
  try {
    const old = JSON.parse(localStorage.getItem(key) || "null");
    const rec = { at: pred.at, mu: pred.mu, muT: pred.muT, pHome: pred.pHome, line: pred.line, total: pred.total, value: pred.value.slice(0, 4).map((v) => ({ group: v.group, label: v.label, dec: v.dec, p: v.p, ev: v.ev })), first: old?.first || { line: pred.line, total: pred.total, at: pred.at } };
    localStorage.setItem(key, JSON.stringify(rec));
  } catch { /* 略過 */ }
}

function loadPrediction(id) {
  try { return JSON.parse(localStorage.getItem("nba-pred-v1:" + id) || "null"); } catch { return null; }
}

/* ---------- 逐球統計 ---------- */

function emptyStat() {
  return { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, oreb: 0, tov: 0, stl: 0, blk: 0, ast: 0, pf: 0, rim: 0, dunk: 0, scorers: {} };
}

function playsIn(model, periods) {
  return model.plays.filter((p) => periods.includes(p.period));
}

function sliceStats(model, periods) {
  const s = { home: emptyStat(), away: emptyStat() };
  const plays = playsIn(model, periods);
  for (const p of plays) {
    if (!p.side) continue;
    const t = s[p.side];
    const other = s[p.side === "home" ? "away" : "home"];
    if (p.shot) {
      if (p.shot.ft) { t.fta += 1; if (p.score) t.ftm += 1; }
      else {
        t.fga += 1;
        if (p.shot.three) t.tpa += 1;
        if (p.score) { t.fgm += 1; if (p.shot.three) t.tpm += 1; if (p.shot.rim || /layup|dunk/i.test(p.type)) t.rim += 1; if (p.shot.dunk || /dunk/i.test(p.type)) t.dunk += 1; if (p.assist) t.ast += 1; }
      }
    }
    if (p.score) {
      t.pts += p.value;
      if (p.player) t.scorers[p.player] = (t.scorers[p.player] || 0) + p.value;
    }
    if (p.reb && !/team/i.test(p.text)) { t.reb += 1; if (p.oreb) t.oreb += 1; }
    if (p.tov) t.tov += 1;
    if (p.stl) other.stl += 1;
    if (p.blk) other.blk += 1;
    if (p.foul) t.pf += 1;
  }
  /* 以官方每節比分校正得分 */
  for (const side of ["home", "away"]) {
    const ls = model[side].linescores || [];
    const sum = periods.reduce((a, q) => a + (Number(ls[q - 1]) || 0), 0);
    if (sum && Math.abs(sum - s[side].pts) <= 6) s[side].pts = sum;
    else if (sum && !plays.length) s[side].pts = sum;
  }
  return { s, plays };
}

function flow(model, periods) {
  const plays = playsIn(model, periods).filter((p) => p.score && Number.isFinite(p.hs) && Number.isFinite(p.as));
  let lc = 0, ties = 0, lastSign = 0, maxH = 0, maxA = 0;
  const runs = [];
  let run = null;
  let prevH = null, prevA = null;
  const first = model.plays.findIndex((p) => p === plays[0]);
  if (first > 0) {
    const before = model.plays.slice(0, first).reverse().find((p) => Number.isFinite(p.hs));
    if (before) { prevH = before.hs; prevA = before.as; }
  }
  if (prevH == null) { prevH = 0; prevA = 0; }
  lastSign = Math.sign(prevH - prevA);
  for (const p of plays) {
    const d = p.hs - p.as;
    const sg = Math.sign(d);
    if (sg === 0 && lastSign !== 0) ties += 1;
    if (sg !== 0 && lastSign !== 0 && sg !== lastSign) lc += 1;
    if (sg !== 0 && lastSign === 0) {
      const prevNon = Math.sign(prevH - prevA);
      if (prevNon !== 0 && prevNon !== sg) lc += 1;
    }
    if (sg !== 0) lastSign = sg; else lastSign = lastSign === 0 ? 0 : lastSign;
    if (sg !== 0) prevH = p.hs, prevA = p.as;
    maxH = Math.max(maxH, d);
    maxA = Math.max(maxA, -d);
    if (run && run.side === p.side) { run.pts += p.value; run.end = p; }
    else {
      if (run && run.pts >= 8) runs.push(run);
      run = { side: p.side, pts: p.value, start: p, end: p };
    }
  }
  if (run && run.pts >= 8) runs.push(run);
  /* 得分荒：同一隊兩次得分之間 ≥ 3 分鐘 */
  const droughts = [];
  for (const side of ["home", "away"]) {
    let last = null;
    for (const p of playsIn(model, periods)) {
      if (p.side === side && p.score) {
        const startT = last ? last.t : (playsIn(model, periods)[0]?.t ?? 0);
        if (p.t - startT >= 180) droughts.push({ side, sec: p.t - startT, from: last, to: p });
        last = p;
      }
    }
  }
  droughts.sort((a, b) => b.sec - a.sec);
  runs.sort((a, b) => b.pts - a.pts);
  return { lc, ties, maxH, maxA, runs, droughts };
}

function periodLabel(q) {
  if (q <= 4) return `第${["", "一", "二", "三", "四"][q]}節`;
  return q === 5 ? "延長賽" : `第 ${q - 4} 個延長`;
}

function pctTxt(m, a) {
  return a ? `${m}/${a}（${Math.round((m / a) * 100)}%）` : "0/0";
}

function topScorer(stat) {
  const e = Object.entries(stat.scorers).sort((a, b) => b[1] - a[1])[0];
  return e ? { name: e[0], pts: e[1] } : null;
}

function mmss(sec) {
  return `${Math.floor(sec / 60)} 分 ${String(Math.round(sec % 60)).padStart(2, "0")} 秒`;
}

/* 一段比賽（單節／半場／全場）的數據與重點 */
function sliceRecap(model, periods, label) {
  const { s, plays } = sliceStats(model, periods);
  const f = flow(model, periods);
  const H = model.home.name;
  const A = model.away.name;
  const win = s.home.pts === s.away.pts ? null : s.home.pts > s.away.pts ? "home" : "away";
  const lines = [];
  const rows = [
    ["得分", s.home.pts, s.away.pts],
    ["投籃", pctTxt(s.home.fgm, s.home.fga), pctTxt(s.away.fgm, s.away.fga)],
    ["三分", pctTxt(s.home.tpm, s.home.tpa), pctTxt(s.away.tpm, s.away.tpa)],
    ["罰球", pctTxt(s.home.ftm, s.home.fta), pctTxt(s.away.ftm, s.away.fta)],
    ["籃板（進攻）", `${s.home.reb}（${s.home.oreb}）`, `${s.away.reb}（${s.away.oreb}）`],
    ["助攻", s.home.ast, s.away.ast],
    ["失誤", s.home.tov, s.away.tov],
    ["抄截／火鍋", `${s.home.stl}／${s.home.blk}`, `${s.away.stl}／${s.away.blk}`],
    ["犯規", s.home.pf, s.away.pf]
  ];
  if (!plays.length) return { label, rows, lines: [], s, f, win, empty: true };
  const W = win ? model[win].name : null;
  const L = win ? model[win === "home" ? "away" : "home"].name : null;
  if (label === "全場") lines.push(win ? `${W} ${Math.max(s.home.pts, s.away.pts)}：${Math.min(s.home.pts, s.away.pts)} 擊敗 ${L}，贏 ${Math.abs(s.home.pts - s.away.pts)} 分。` : "全場打平。");
  else lines.push(win ? `${label} ${W} ${Math.max(s.home.pts, s.away.pts)}：${Math.min(s.home.pts, s.away.pts)} 贏下這段，淨勝 ${Math.abs(s.home.pts - s.away.pts)} 分。` : `${label}雙方 ${s.home.pts}：${s.away.pts} 打平。`);
  const keyDiff = [];
  const d3 = s.home.tpm - s.away.tpm;
  if (Math.abs(d3) >= 3) keyDiff.push(`三分球 ${d3 > 0 ? H : A} 多進 ${Math.abs(d3)} 顆（多 ${Math.abs(d3) * 3} 分）`);
  const dto = s.home.tov - s.away.tov;
  if (Math.abs(dto) >= 3) keyDiff.push(`${dto > 0 ? H : A} 多 ${Math.abs(dto)} 次失誤`);
  const dor = s.home.oreb - s.away.oreb;
  if (Math.abs(dor) >= 3) keyDiff.push(`進攻籃板 ${dor > 0 ? H : A} 多搶 ${Math.abs(dor)} 個`);
  const dft = s.home.fta - s.away.fta;
  if (Math.abs(dft) >= 5) keyDiff.push(`罰球次數 ${dft > 0 ? H : A} 多 ${Math.abs(dft)} 次`);
  const drim = s.home.rim - s.away.rim;
  if (Math.abs(drim) >= 3) keyDiff.push(`禁區上籃／灌籃 ${drim > 0 ? H : A} 多進 ${Math.abs(drim)} 球`);
  if (keyDiff.length) lines.push(`分差關鍵：${keyDiff.join("；")}。`);
  if (f.runs[0]) {
    const r = f.runs[0];
    lines.push(`最大一波攻勢：${model[r.side].name} 打出 ${r.pts}–0（${periodLabel(r.start.period)} ${r.start.clock} 到 ${r.end.clock}）。`);
  }
  if (f.droughts[0] && f.droughts[0].sec >= 180) {
    const d = f.droughts[0];
    lines.push(`得分荒：${model[d.side].name} 有 ${mmss(d.sec)} 沒得分。`);
  }
  if (f.lc || f.ties) lines.push(`領先互換 ${f.lc} 次、平手 ${f.ties} 次${f.lc >= 5 ? "，拉鋸感很重" : ""}。`);
  const th = topScorer(s.home);
  const ta = topScorer(s.away);
  const best = [th && `${H} ${th.name} ${th.pts} 分`, ta && `${A} ${ta.name} ${ta.pts} 分`].filter(Boolean);
  if (best.length) lines.push(`這段得分王：${best.join("；")}。`);
  return { label, rows, lines, s, f, win, W, L, th, ta, empty: false };
}

function quarterList(model) {
  const n = Math.max(model.home.linescores?.length || 0, model.away.linescores?.length || 0, model.status.period || 0, ...model.plays.map((p) => p.period));
  return Array.from({ length: n }, (_, i) => i + 1);
}

function finishedPeriods(model) {
  const all = quarterList(model);
  if (model.status.phase === "ft") return all;
  const cur = model.status.period;
  return all.filter((q) => q < cur || ((model.status.phase === "endq" || model.status.phase === "ht") && q === cur));
}

/* ---------- 球員評分（Hollinger Game Score） ---------- */

function gameScore(p) {
  return p.pts + 0.4 * p.fg.m - 0.7 * p.fg.a - 0.4 * (p.ft.a - p.ft.m) + 0.7 * p.oreb + 0.3 * p.dreb + p.stl + 0.7 * p.ast + 0.7 * p.blk - 0.4 * p.pf - p.tov;
}

function ratePlayers(model) {
  const all = [];
  for (const side of ["home", "away"]) {
    for (const p of model.box.players[side] || []) {
      if (p.dnp || !p.min) continue;
      const gs = gameScore(p);
      const ts = p.fg.a + 0.44 * p.ft.a ? p.pts / (2 * (p.fg.a + 0.44 * p.ft.a)) : 0;
      const rating = Math.max(3, Math.min(10, 5.5 + gs / 6));
      const tags = [];
      if ([p.pts, p.reb, p.ast, p.stl, p.blk].filter((x) => x >= 10).length >= 3) tags.push("大三元");
      else if ([p.pts, p.reb, p.ast, p.stl, p.blk].filter((x) => x >= 10).length >= 2) tags.push("雙十");
      if (p.pts >= 30) tags.push(`${p.pts} 分爆發`);
      if (p.tp.m >= 5) tags.push(`${p.tp.m} 記三分`);
      if (ts >= 0.68 && p.fg.a >= 8) tags.push("超高效率");
      if (p.fg.a >= 12 && ts < 0.45) tags.push("手感冰冷");
      if (p.tov >= 5) tags.push(`${p.tov} 次失誤`);
      if (p.pm >= 15) tags.push(`正負值 ${signed(p.pm)}`);
      if (p.pm <= -15) tags.push(`正負值 ${p.pm}`);
      all.push({ ...p, side, gs, ts, rating, tags, team: model[side].name });
    }
  }
  return all.sort((a, b) => b.gs - a.gs);
}

/* ---------- 預測檢討 ---------- */

function predictionReview(model) {
  const pred = loadPrediction(model.id);
  if (!pred || model.status.phase !== "ft") return null;
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const margin = hs - as;
  const tot = hs + as;
  const H = model.home.name;
  const A = model.away.name;
  const lines = [];
  lines.push(`賽前模型：${pred.mu >= 0 ? H : A} 贏 ${trimNum(Math.abs(pred.mu))} 分、總分 ${trimNum(pred.muT)}；實際 ${margin >= 0 ? H : A} 贏 ${Math.abs(margin)} 分、總分 ${tot}。`);
  lines.push(`分差誤差 ${trimNum(Math.abs(margin - pred.mu))} 分，總分誤差 ${trimNum(Math.abs(tot - pred.muT))} 分。${Math.abs(margin - pred.mu) <= 6 ? "分差抓得不錯。" : Math.abs(margin - pred.mu) >= 15 ? "分差差很遠，屬於爆冷或單邊屠殺局。" : ""}`);
  const hits = [];
  for (const v of pred.value || []) {
    let res = null;
    const m = /([+-]?\d+(?:\.\d+)?)$/.exec(v.label);
    const n = m ? Number(m[1]) : null;
    if (v.group === "大小分" && n != null) res = v.label.startsWith("大") ? tot > n : tot < n;
    else if (v.group === "讓分" && n != null) res = v.label.startsWith(H) ? margin + n > 0 : -margin + n > 0;
    else if (v.group === "獨贏") res = v.label.startsWith(H) ? margin > 0 : margin < 0;
    if (res != null) hits.push(`${v.label} @${fmtOdd(v.dec)}：${res ? "✅ 過關" : "❌ 沒過"}`);
  }
  if (hits.length) lines.push(`價值推薦結果：${hits.join("；")}。`);
  const close = oddsSnapshot(model);
  if (pred.first?.line != null && close?.spread != null) {
    const clv = pred.first.line - close.spread;
    if (clv) lines.push(`收盤讓分 ${fmtHandicap(close.spread)}（存預測時 ${fmtHandicap(pred.first.line)}），盤口往 ${clv > 0 ? H : A} 方向移動 ${trimNum(Math.abs(clv))} 分。`);
  }
  return lines;
}

/* ---------- 主播口播：情緒同步 ---------- */

const QUIPS = {
  dunk: {
    fact: (x) => `${x.team} ${x.player} 一記${x.alley ? "空中接力" : "暴力灌籃"}！`,
    emo: ["這球我直接從椅子上彈起來！", "籃框：我做錯什麼了？", "這不是灌籃，這是拆遷。"],
    joke: ["籃框今晚需要申請工傷。", "這球建議重播三次，第四次收費。", "防守球員剛剛在現場當背景板。"],
    ask: ["這球給幾分？10 分打 10 的扣 1！", "誰是今晚的灌籃王？留言押一個！"]
  },
  three: {
    fact: (x) => `${x.team} ${x.player} 三分球進！${x.dist ? `${x.dist} 呎外` : ""}`,
    emo: ["手感來了擋都擋不住！", "這種球進了，對手只能搖頭。", "唰——連籃框都沒碰到！"],
    joke: ["這投籃姿勢可以直接去拍教學影片。", "他今天是把籃框當成游泳池在投。", "距離？什麼距離？他字典裡沒有。"],
    ask: ["猜他今天會投進幾顆三分？", "覺得他手感會繼續熱的扣 +1！"]
  },
  deep: {
    fact: (x) => `${x.team} ${x.player} ${x.dist} 呎超遠三分！`,
    emo: ["這是從停車場出手的吧！", "這球不合理但它進了！"],
    joke: ["量尺都不夠長。", "他出手的時候我還以為在傳球。"],
    ask: ["這球有沒有 Logo Shot 的感覺？留言說！"]
  },
  brick: {
    fact: (x) => `${x.team} 已經連續 ${x.n} 次出手沒進。`,
    emo: ["這籃框是不是被下封印了？", "兄弟們，我血壓上來了。", "再不進，我要親自下去投了。"],
    joke: ["打鐵聲比現場 DJ 還大聲。", "今天鐵匠鋪開張大吉。", "籃框：你們要不要先去熱個身？"],
    ask: ["覺得下一球會進的扣 1，繼續打鐵的扣 2！"]
  },
  missEasy: {
    fact: (x) => `${x.team} ${x.player} 空檔上籃竟然沒放進！`,
    emo: ["這球我奶奶都放得進……", "我的天，這個比不進還難！", "全場安靜三秒。"],
    joke: ["他可能在想晚餐吃什麼。", "教練的表情已經在寫檢討報告。", "這球放進 NG 合輯穩了。"],
    ask: ["你打球有沒有過這種時刻？老實說！"]
  },
  turnover: {
    fact: (x) => `${x.team} ${x.player || ""}失誤，球權送出去。`,
    emo: ["這球直接送大禮！", "傳給空氣是吧？", "對手：謝謝老闆。"],
    joke: ["今天是 ${x.team} 的回饋客戶日嗎？", "這球傳得很有誠意，只是給錯人。", "快遞送錯地址了。"],
    ask: ["今天失誤最多的會是誰？留言猜！"]
  },
  block: {
    fact: (x) => `${x.team} ${x.player} 一記大火鍋！`,
    emo: ["不准進！今天這裡我說了算！", "這是禁飛區！"],
    joke: ["球被送回原廠。", "這火鍋湯頭很濃，請慢用。", "出手的人今晚要做惡夢了。"],
    ask: ["這火鍋可以排今晚前三嗎？扣 1 同意！"]
  },
  steal: {
    fact: (x) => `${x.team} ${x.player} 抄截！`,
    emo: ["手太快了，我眼睛跟不上！", "偷得光明正大！"],
    joke: ["這是合法搶劫。", "建議對手把球綁在手上。"],
    ask: ["抄截後快攻，最愛看哪個人推進？"]
  },
  drive: {
    fact: (x) => `${x.team} ${x.player} 切入上籃得手！`,
    emo: ["一步過人，乾淨俐落！", "這第一步太快了！"],
    joke: ["防守者還在原地找隱形眼鏡。", "高速公路沒有收費站。"],
    ask: ["你覺得誰是聯盟第一步最快的？"]
  },
  run: {
    fact: (x) => `${x.team} 打出一波 ${x.pts}–0 攻勢！`,
    emo: ["這一波直接打出血性！", "對面教練要趕快叫暫停了！", "氣勢起來了，整個場館在搖！"],
    joke: ["這不是攻勢，是龍捲風過境。", "對手的進攻像是當機了。"],
    ask: ["這波攻勢會打到幾分？留言預測！"]
  },
  burst: {
    fact: (x) => `${x.player} 這節已經拿下 ${x.pts} 分！`,
    emo: ["他今天是開了外掛吧！", "手感熱到燙手！"],
    joke: ["請對手派兩個人去守他，不，三個。", "他現在投籃比我呼吸還自然。"],
    ask: ["今晚他會不會破 40？扣 1 會！"]
  },
  lead: {
    fact: (x) => `${x.team} 反超！${x.score}`,
    emo: ["風向變了！比賽重新開始！", "這就是 NBA，沒有安全的領先！"],
    joke: ["領先的那隊剛剛只是幫忙暖場。", "劇本又被改了，編劇請加薪。"],
    ask: ["反超後誰會贏？留言押一隊！"]
  },
  tight: {
    fact: (x) => `比分 ${x.score}，差距只有 ${x.gap} 分。`,
    emo: ["緊張到我手心都是汗。", "這比賽太難猜了！"],
    joke: ["我心臟需要一個暫停。", "兩隊在玩比賽版的拔河。"],
    ask: ["最後誰贏？留言押寶，賽後對答案！"]
  },
  clutch: {
    fact: (x) => `${x.clock}，比分 ${x.score}，決勝時刻！`,
    emo: ["每一球都是生死球！", "這就是我們熬夜看球的原因！"],
    joke: ["現在誰去上廁所都會後悔一輩子。", "心臟不好的觀眾請先坐穩。"],
    ask: ["最後一擊會交給誰？留言說名字！"]
  },
  review: {
    fact: (x) => `${x.text}`,
    emo: ["這球有爭議，大家看重播！", "裁判，你看清楚啊！"],
    joke: ["裁判今天戴的眼鏡度數可能不對。", "這判決比我的感情還難懂。"],
    ask: ["你覺得這球該怎麼判？留言投票！"]
  },
  timeout: {
    fact: (x) => `${x.team || "場上"}叫暫停。`,
    emo: ["趁暫停，大家喝口水喘口氣！", "暫停時間就是聊天時間！"],
    joke: ["教練的白板快被畫破了。", "球員在聽戰術，我們在聽自己的心跳。"],
    ask: ["暫停回來第一球誰會得分？", "大家今天在哪裡看球？留言打卡！"]
  },
  fatigue: {
    fact: (x) => `第四節，${x.team} 投籃明顯變短。`,
    emo: ["腿開始沉了，這時候拚的是意志。"],
    joke: ["他們的腿現在是租來的。"],
    ask: ["你覺得最後體能誰撐得住？"]
  }
};

const QUIPS_CN = {
  dunk: ["这扣篮太顶了，篮筐直接破防！", "隔扣！这波属于是暴力美学。"],
  three: ["手感火热，这谁顶得住啊！", "三分雨来了兄弟们！"],
  brick: ["打铁匠上线，铁匠铺营业中。", "这手感，属于是凉透了。"],
  missEasy: ["空篮不进，血压拉满！", "这球不进，我人麻了。"],
  turnover: ["送温暖了属于是。", "这传球，对手直呼内行。"],
  clutch: ["关键时刻，大心脏来了！", "绝杀预定？我先说了！"],
  run: ["这一波直接打崩了！", "攻势上来了，这就是统治力！"],
  lead: ["反超了！剧本反转！", "比赛又活了！"]
};

const SLOGANS = ["球可以不進，氣氛不能冷！", "兄弟們，精彩一起看，熱鬧一起喊！", "好球一起叫，爛球一起笑！"];

const EXTRA_ASKS = [
  "今晚你押哪一隊？主隊扣 1、客隊扣 2！",
  "最後總分會過盤口嗎？大分扣 +1、小分扣 -1！",
  "今晚 MVP 你押誰？留言說名字！",
  "你是在哪裡看今晚的比賽？宿舍、公司、還是被窩？",
  "你最喜歡的 NBA 球員是誰？留言講一個理由！",
  "最後五分鐘誰會出手？留言預測！",
  "猜猜今晚三分球總共會進幾顆？",
  "這場會不會打進延長？會的扣 1！",
  "如果你是教練，第四節會派誰上場？",
  "第一次看 NBA 是哪個球星讓你入坑？"
];

function pick(arr, seed) {
  if (!arr || !arr.length) return "";
  let k = 0;
  for (const ch of String(seed)) k = (k * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[k % arr.length];
}

function fill(text, x) {
  return String(text).replace(/\$\{x\.(\w+)\}/g, (_, k) => x[k] ?? "");
}

/* 偵測最近發生的情境（最新的 25 個事件） */
function detectMoments(model) {
  const out = [];
  const plays = model.plays;
  if (!plays.length) return out;
  const recent = plays.slice(-25).reverse();
  const H = model.home.name;
  const A = model.away.name;
  const nm = (side) => model[side]?.name || "";
  const score = (p) => `${H} ${p.hs}：${p.as} ${A}`;
  const seen = new Set();
  const push = (kind, x, p) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    out.push({ kind, x, play: p });
  };
  for (const p of recent) {
    if (!p.side) {
      if (p.review) push("review", { text: p.text }, p);
      continue;
    }
    const x = { team: nm(p.side), player: p.player, dist: p.shot?.dist, clock: `${periodLabel(p.period)} ${p.clock}`, score: score(p) };
    if (p.score && p.shot && !p.shot.ft) {
      if (/dunk|alley/i.test(p.type + p.text)) push("dunk", { ...x, alley: /alley/i.test(p.type + p.text) }, p);
      else if (p.shot.three && p.shot.dist >= 30) push("deep", x, p);
      else if (p.shot.three) push("three", x, p);
      else if (/driving|layup/i.test(p.type)) push("drive", x, p);
    }
    if (p.shot && !p.score && !p.shot.ft && (/layup|dunk/i.test(p.type)) && !/blocks/i.test(p.text)) push("missEasy", x, p);
    if (p.blk) push("block", { ...x, team: nm(p.side === "home" ? "away" : "home"), player: (/([A-Z][\w.'-]+(?: [A-Z][\w.'-]+)+) blocks/.exec(p.text) || [])[1] ? playerZh(/([A-Z][\w.'-]+(?: [A-Z][\w.'-]+)+) blocks/.exec(p.text)[1]) : "" }, p);
    if (p.tov) push("turnover", x, p);
    if (p.stl) push("steal", { ...x, team: nm(p.side === "home" ? "away" : "home"), player: (/\(([^)]+?) steals\)/.exec(p.text) || [])[1] ? playerZh(/\(([^)]+?) steals\)/.exec(p.text)[1]) : "" }, p);
    if (p.timeout) push("timeout", x, p);
    if (p.review) push("review", { ...x, text: p.text }, p);
  }
  /* 連續打鐵 */
  for (const side of ["home", "away"]) {
    let n = 0;
    for (const p of [...plays].reverse()) {
      if (p.side !== side || !p.shot || p.shot.ft) continue;
      if (p.score) break;
      n += 1;
    }
    if (n >= 4) push("brick", { team: nm(side), n }, null);
  }
  /* 攻勢 */
  const f = flow(model, [model.status.period || 1]);
  const lastRun = (() => {
    let run = null;
    for (const p of plays.filter((q) => q.score)) {
      if (run && run.side === p.side) run.pts += p.value;
      else run = { side: p.side, pts: p.value };
    }
    return run;
  })();
  if (lastRun && lastRun.pts >= 8) push("run", { team: nm(lastRun.side), pts: lastRun.pts }, null);
  /* 單節爆發 */
  const cur = sliceStats(model, [model.status.period || 1]).s;
  for (const side of ["home", "away"]) {
    const t = topScorer(cur[side]);
    if (t && t.pts >= 10) push("burst", { player: t.name, pts: t.pts }, null);
  }
  /* 反超、膠著、決勝 */
  const last = [...plays].reverse().find((p) => p.score);
  if (last) {
    const before = [...plays].slice(0, plays.indexOf(last)).reverse().find((p) => p.score);
    const s1 = Math.sign(last.hs - last.as);
    const s0 = before ? Math.sign(before.hs - before.as) : 0;
    if (s1 && s0 && s1 !== s0) push("lead", { team: nm(s1 > 0 ? "home" : "away"), score: score(last) }, last);
    const gap = Math.abs(last.hs - last.as);
    const period = model.status.period;
    const secLeft = model.status.secLeft;
    if (period >= 4 && secLeft <= 150 && gap <= 5 && model.status.state === "in") push("clutch", { clock: `${periodLabel(period)} 剩 ${model.status.clock}`, score: score(last) }, last);
    else if (gap <= 3 && period >= 3) push("tight", { score: score(last), gap }, last);
    if (period >= 4 && f && model.status.state === "in") {
      const q4 = sliceStats(model, [period]).s;
      for (const side of ["home", "away"]) {
        if (q4[side].fga >= 10 && q4[side].fgm / q4[side].fga < 0.32) push("fatigue", { team: nm(side) }, null);
      }
    }
  }
  return out.slice(0, 6);
}

/* 四步公式：即時賽況 → 情緒反應 → 幽默比喻 → 觀眾互動 */
function fourStep(model, m) {
  const q = QUIPS[m.kind];
  if (!q) return null;
  const seed = model.id + m.kind + (m.play?.id || "");
  const joke = locale() === "cn" && QUIPS_CN[m.kind] ? pick([...q.joke, ...QUIPS_CN[m.kind]], seed + "j") : pick(q.joke, seed + "j");
  return {
    kind: m.kind,
    steps: [
      ["即時賽況", fill(q.fact(m.x), m.x)],
      ["情緒反應", pick(q.emo, seed + "e")],
      ["幽默比喻", fill(joke, m.x)],
      ["觀眾互動", pick(q.ask, seed + "a")]
    ]
  };
}

const MOMENT_ZH = { dunk: "灌籃／空接", three: "三分命中", deep: "超遠三分", brick: "連續打鐵", missEasy: "空籃失手", turnover: "失誤", block: "火鍋", steal: "抄截", drive: "切入", run: "攻勢", burst: "個人爆發", lead: "逆轉", tight: "膠著", clutch: "決勝時刻", review: "爭議／重播", timeout: "暫停／冷場", fatigue: "體能下滑" };

/* 觀眾心聲（吐槽、碎碎念、自嘲、閒聊） */
function moodLines(model, rec) {
  const H = model.home.name;
  const A = model.away.name;
  const out = [];
  if (!rec || rec.empty) return out;
  const { s, f, win } = rec;
  const W = win ? model[win].name : null;
  const L = win ? model[win === "home" ? "away" : "home"].name : null;
  const gap = Math.abs(s.home.pts - s.away.pts);
  if (W && gap >= 10) out.push(["吐槽", `${L} 這段打得像在練投籃，${W} 根本在打練習賽。`]);
  if (W && gap <= 3) out.push(["碎碎念", "比分咬這麼緊，我零食都不敢去拿。"]);
  for (const side of ["home", "away"]) {
    const t = s[side];
    if (t.tpa >= 8 && t.tpm / t.tpa < 0.25) out.push(["吐槽", `${model[side].name} 三分 ${t.tpm}/${t.tpa}，這是在投籃還是在幫籃框做耐震測試？`]);
    if (t.tov >= 6) out.push(["碎碎念", `${model[side].name} ${t.tov} 次失誤……球是燙手山芋嗎？`]);
    if (t.tpa >= 6 && t.tpm / t.tpa >= 0.5) out.push(["驚嘆", `${model[side].name} 三分 ${t.tpm}/${t.tpa}，手感好到我懷疑籃框變大了。`]);
    if (t.oreb >= 5) out.push(["閒聊", `${model[side].name} 搶了 ${t.oreb} 個進攻籃板，這籃板是有黏膠嗎？`]);
  }
  if (f.droughts[0]?.sec >= 180) out.push(["自嘲", `${model[f.droughts[0].side].name} ${mmss(f.droughts[0].sec)}沒得分，跟我上班一樣，人在心不在。`]);
  if (f.lc >= 4) out.push(["閒聊", `領先換了 ${f.lc} 次，這比我換手機桌布還勤。`]);
  if (f.runs[0]) out.push(["吐槽", `${model[f.runs[0].side].name} 那波 ${f.runs[0].pts}–0，對面教練暫停喊得比我起床還慢。`]);
  out.push(["口號", pick(SLOGANS, model.id + rec.label)]);
  return out.slice(0, 6);
}

/* 單節口播 */
function anchorSlice(model, rec, kind) {
  if (!rec || rec.empty) return { short: [], long: [] };
  const H = model.home.name;
  const A = model.away.name;
  const { s, f, W, L, th, ta } = rec;
  const total = { h: Number(model.home.score), a: Number(model.away.score) };
  const short = [];
  const long = [];
  short.push(W ? `${rec.label}結束，${W} 這段 ${Math.max(s.home.pts, s.away.pts)} 比 ${Math.min(s.home.pts, s.away.pts)} 贏下來！` : `${rec.label}結束，兩隊這段打成平手，誰都不讓誰！`);
  if (kind !== "full") short.push(`目前總比分 ${H} ${total.h}、${A} ${total.a}。`);
  if (f.runs[0]) short.push(`關鍵是 ${model[f.runs[0].side].name} 那一波 ${f.runs[0].pts} 比 0，直接把節奏搶走。`);
  const star = [th, ta].filter(Boolean).sort((a, b) => b.pts - a.pts)[0];
  if (star) short.push(`這段最燙手的是 ${star.name}，一個人拿 ${star.pts} 分。`);
  long.push(...short);
  for (const side of ["home", "away"]) {
    const t = s[side];
    if (t.fga) long.push(`${model[side].name} 投籃 ${t.fgm}/${t.fga}${t.tpa ? `、三分 ${t.tpm}/${t.tpa}` : ""}${t.tov ? `、失誤 ${t.tov}` : ""}。`);
  }
  for (const l of rec.lines.slice(1, 3)) long.push(l);
  if (kind === "half") long.push(L ? `下半場 ${L} 最需要的，是把失誤和外線手感先調回來。` : "下半場就看誰先穩住防守。");
  if (kind === "q") long.push(pick(EXTRA_ASKS, model.id + rec.label));
  return { short, long };
}

function anchorFull(model, ratings) {
  const H = model.home.name;
  const A = model.away.name;
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const W = hs > as ? H : A;
  const L = hs > as ? A : H;
  const gap = Math.abs(hs - as);
  const mvp = ratings[0];
  const lines = [];
  lines.push(`終場比分 ${H} ${hs}、${A} ${as}，${W} 拿下勝利！`);
  lines.push(gap <= 5 ? "這場一路咬到最後，心臟不夠強的已經先去睡了。" : gap >= 20 ? `${gap} 分的差距，這場基本上是單方面的教學影片。` : `${gap} 分的差距，${W} 掌控了大部分的時間。`);
  if (mvp) lines.push(`今晚的 MVP 給 ${mvp.team} 的 ${mvp.name}：${mvp.pts} 分、${mvp.reb} 籃板、${mvp.ast} 助攻${mvp.tags.length ? "，" + mvp.tags.slice(0, 2).join("、") : ""}。`);
  const loserBest = ratings.find((r) => r.team === L);
  if (loserBest) lines.push(`${L} 這邊 ${loserBest.name} ${loserBest.pts} 分，雖敗猶榮。`);
  const bt = model.box.teams;
  if (bt.home.turnoverPoints != null && bt.away.turnoverPoints != null) lines.push(`失誤轉換得分 ${H} ${bt.home.turnoverPoints}、${A} ${bt.away.turnoverPoints}；禁區得分 ${H} ${bt.home.pointsInPaint ?? "–"}、${A} ${bt.away.pointsInPaint ?? "–"}。`);
  lines.push(pick(SLOGANS, model.id + "full"));
  lines.push("今晚你覺得誰該拿 MVP？留言告訴我！");
  return lines;
}

function proStats(model) {
  const bt = model.box.teams;
  const H = model.home.name;
  const A = model.away.name;
  const pick2 = (k, label) => bt.home[k] != null && bt.away[k] != null ? [label, bt.home[k], bt.away[k]] : null;
  return [
    pick2("pointsInPaint", "禁區得分"),
    pick2("fastBreakPoints", "快攻得分"),
    pick2("turnoverPoints", "失誤轉換得分"),
    pick2("largestLead", "最大領先"),
    pick2("totalTurnovers", "總失誤"),
    pick2("technicalFouls", "技術犯規")
  ].filter(Boolean).map(([l, h, a]) => ({ label: l, home: h, away: a, H, A }));
}
