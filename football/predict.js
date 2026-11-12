/* 賽前盤口預測（Poisson 數據模型 + 市場隱含）與分段／半場／全場復盤。
   只用 ESPN 回傳的數字；所有機率都是模型估計，不是保證。 */
const ALL_API = "https://site.api.espn.com/apis/site/v2/sports/soccer/all";

const LEAGUE_GOALS = {
  "eng.1": 2.85, "esp.1": 2.6, "ita.1": 2.65, "ger.1": 3.1, "fra.1": 2.75,
  "uefa.champions": 3.0, "uefa.europa": 2.8, "usa.1": 3.0, "jpn.1": 2.6, "fifa.world": 2.5
};
const NEUTRAL_LEAGUES = new Set(["fifa.world"]);
const MARKET_WEIGHT = 0.65;
const EDGE_MIN = 0.02;
const EDGE_WILD = 0.12;
const RHO = -0.08;
const MAXG = 10;

/* ---------- 機率工具 ---------- */

function pmfList(l, max) {
  const out = [];
  let p = Math.exp(-l);
  for (let k = 0; k <= max; k += 1) {
    out.push(p);
    p = p * l / (k + 1);
  }
  return out;
}

function matrixOf(lh, la, rho = RHO) {
  const ph = pmfList(lh, MAXG);
  const pa = pmfList(la, MAXG);
  const m = [];
  let sum = 0;
  for (let i = 0; i <= MAXG; i += 1) {
    m.push([]);
    for (let j = 0; j <= MAXG; j += 1) {
      let v = ph[i] * pa[j];
      if (i === 0 && j === 0) v *= 1 - lh * la * rho;
      else if (i === 0 && j === 1) v *= 1 + lh * rho;
      else if (i === 1 && j === 0) v *= 1 + la * rho;
      else if (i === 1 && j === 1) v *= 1 - rho;
      v = Math.max(v, 0);
      m[i].push(v);
      sum += v;
    }
  }
  for (const row of m) for (let j = 0; j < row.length; j += 1) row[j] /= sum;
  return m;
}

function oneXTwo(m) {
  let h = 0; let d = 0; let a = 0;
  m.forEach((row, i) => row.forEach((p, j) => {
    if (i > j) h += p; else if (i === j) d += p; else a += p;
  }));
  return { home: h, draw: d, away: a };
}

function isQuarter(line) {
  return Math.abs(Math.round(line * 4)) % 2 === 1;
}

/* fn(i, j, L) > 0 贏、= 0 走水、< 0 輸。四分之一盤拆成兩半。 */
function lineDist(m, fn, line) {
  const halves = isQuarter(line) ? [line - 0.25, line + 0.25] : [line, line];
  const d = { win: 0, halfWin: 0, push: 0, halfLose: 0, lose: 0 };
  const sg = (v) => (v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0);
  m.forEach((row, i) => row.forEach((p, j) => {
    const s = sg(fn(i, j, halves[0])) + sg(fn(i, j, halves[1]));
    if (s === 2) d.win += p;
    else if (s === 1) d.halfWin += p;
    else if (s === 0) d.push += p;
    else if (s === -1) d.halfLose += p;
    else d.lose += p;
  }));
  return d;
}

function distEv(d, dec) {
  return d.win * (dec - 1) + d.halfWin * (dec - 1) / 2 - d.halfLose / 2 - d.lose;
}

function distFair(d) {
  const w = d.win + d.halfWin / 2;
  const l = d.lose + d.halfLose / 2;
  if (w <= 0) return null;
  return 1 + l / w;
}

function distEff(d) {
  const w = d.win + d.halfWin / 2;
  const l = d.lose + d.halfLose / 2;
  return w + l > 0 ? w / (w + l) : 0.5;
}

const FN = {
  homeAH: (i, j, L) => i - j + L,
  awayAH: (i, j, L) => j - i + L,
  over: (i, j, L) => i + j - L,
  under: (i, j, L) => L - (i + j)
};

function nbPmf(mu, max, ratio) {
  /* 負二項：var = mu * (1 + ratio)，ratio=0 退回 Poisson */
  if (ratio <= 0.01) return pmfList(mu, max);
  const r = mu / ratio;
  const p = r / (r + mu);
  const out = [];
  let v = Math.pow(p, r);
  for (let k = 0; k <= max; k += 1) {
    out.push(v);
    v = v * (k + r) / (k + 1) * (1 - p);
  }
  return out;
}

function countOver(pmf, line) {
  let over = 0;
  pmf.forEach((p, k) => { if (k > line) over += p; });
  return over;
}

function fairOf(p) {
  return p > 0.001 ? 1 / p : null;
}

function fmtOdd(dec) {
  return dec == null ? "–" : (Math.round(dec * 100) / 100).toFixed(2);
}

function pct(p) {
  return `${Math.round(p * 1000) / 10}%`;
}

function evText(ev) {
  const v = Math.round(ev * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

function num2(n) {
  return String(Math.round(Number(n) * 100) / 100);
}

function lineLabel(line) {
  const a = Math.abs(line);
  if (!isQuarter(line)) return num2(a);
  const lo = Math.floor(a * 2) / 2;
  return `${num2(a)}（${num2(lo)}/${num2(lo + 0.5)}）`;
}

function ahWords(side, line) {
  const who = side === "home" ? "主隊" : "客隊";
  if (Math.abs(line) < 1e-9) return `${who}平手盤`;
  return line < 0 ? `${who}讓 ${lineLabel(line)}` : `${who}受讓 ${lineLabel(line)}`;
}

/* ---------- 近 5 場比賽資料（每場抓一次，完賽後永久快取） ---------- */

const G5_PREFIX = "fb-g5-v2:";

function readSlim(id) {
  try {
    const raw = localStorage.getItem(G5_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSlim(id, slim) {
  try {
    localStorage.setItem(G5_PREFIX + id, JSON.stringify(slim));
  } catch {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(G5_PREFIX)).slice(0, 60).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}

function slimFromSummary(data) {
  const comp = data?.header?.competitions?.[0];
  if (!comp) return null;
  const done = comp.status?.type?.state === "post";
  const box = data.boxscore?.teams || [];
  const side = (c) => {
    const id = String(c.id || c.team?.id || "");
    const row = box.find((t) => String(t.team?.id) === id) || {};
    const st = readNumbers(row.statistics, true);
    const ls = c.linescores || [];
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      id,
      g: num(c.score),
      ht: num(ls[0]?.displayValue ?? ls[0]?.value),
      c: st.wonCorners ?? null,
      y: st.yellowCards ?? null,
      r: st.redCards ?? null,
      f: st.foulsCommitted ?? null,
      s: st.totalShots ?? null,
      sot: st.shotsOnTarget ?? null,
      pos: st.possessionPct ?? null
    };
  };
  const cs = comp.competitors || [];
  const hc = cs.find((c) => c.homeAway === "home") || cs[0];
  const ac = cs.find((c) => c.homeAway === "away") || cs[1];
  if (!hc || !ac) return null;
  const h = side(hc);
  const a = side(ac);
  const comm = data.commentary || [];
  if (comm.length > 20) {
    const hn = String(hc.team?.displayName || "").toLowerCase();
    const an = String(ac.team?.displayName || "").toLowerCase();
    h.xg = 0; a.xg = 0;
    for (const c of comm) {
      const type = c.play?.type?.type || "";
      const x = xgOf(c.text || "", type);
      if (!x) continue;
      const tn = String(c.play?.team?.displayName || "").toLowerCase();
      if (tn && tn === hn) h.xg += x;
      else if (tn && tn === an) a.xg += x;
    }
  }
  return { done, date: comp.date, h, a };
}

async function fetchSlim(eventId, signal) {
  const cached = readSlim(eventId);
  if (cached?.done) return cached;
  const res = await fetch(`${ALL_API}/summary?event=${encodeURIComponent(eventId)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const slim = slimFromSummary(await res.json());
  if (slim?.done) writeSlim(eventId, slim);
  return slim;
}

function profileOf(teamId, games) {
  const acc = { n: 0, gf: 0, ga: 0, htN: 0, gf1: 0, ga1: 0, cN: 0, cf: 0, ca: 0, yN: 0, y: 0, oy: 0, r: 0, or: 0,
    fN: 0, f: 0, xgN: 0, xgf: 0, xga: 0, sN: 0, s: 0, sa: 0, sot: 0, sota: 0, btts: 0, o25: 0, cs: 0, fts: 0, w: 0, d: 0, l: 0 };
  for (const g of games) {
    if (!g || g.h?.g == null || g.a?.g == null) continue;
    const mine = g.h.id === teamId ? g.h : g.a.id === teamId ? g.a : null;
    if (!mine) continue;
    const opp = mine === g.h ? g.a : g.h;
    acc.n += 1;
    acc.gf += mine.g; acc.ga += opp.g;
    if (mine.g > 0 && opp.g > 0) acc.btts += 1;
    if (mine.g + opp.g > 2.5) acc.o25 += 1;
    if (opp.g === 0) acc.cs += 1;
    if (mine.g === 0) acc.fts += 1;
    if (mine.g > opp.g) acc.w += 1; else if (mine.g === opp.g) acc.d += 1; else acc.l += 1;
    if (mine.ht != null && opp.ht != null) { acc.htN += 1; acc.gf1 += mine.ht; acc.ga1 += opp.ht; }
    if (mine.c != null && opp.c != null) { acc.cN += 1; acc.cf += mine.c; acc.ca += opp.c; }
    if (mine.y != null && opp.y != null) { acc.yN += 1; acc.y += mine.y; acc.oy += opp.y; acc.r += mine.r || 0; acc.or += opp.r || 0; }
    if (mine.f != null) { acc.fN += 1; acc.f += mine.f; }
    if (mine.xg != null && opp.xg != null) { acc.xgN += 1; acc.xgf += mine.xg; acc.xga += opp.xg; }
    if (mine.s != null && opp.s != null) { acc.sN += 1; acc.s += mine.s; acc.sa += opp.s; acc.sot += mine.sot || 0; acc.sota += opp.sot || 0; }
  }
  const avg = (sum, n) => (n ? sum / n : null);
  const gfpg = avg(acc.gf, acc.n);
  const gapg = avg(acc.ga, acc.n);
  const xgfpg = avg(acc.xgf, acc.xgN);
  const xgapg = avg(acc.xga, acc.xgN);
  const useXg = acc.xgN >= 2;
  return {
    ...acc,
    gfpg, gapg, xgfpg, xgapg,
    gfAdj: useXg ? 0.55 * gfpg + 0.45 * xgfpg : gfpg,
    gaAdj: useXg ? 0.55 * gapg + 0.45 * xgapg : gapg,
    gf1pg: avg(acc.gf1, acc.htN), ga1pg: avg(acc.ga1, acc.htN),
    cfpg: avg(acc.cf, acc.cN), capg: avg(acc.ca, acc.cN),
    ypg: avg(acc.y, acc.yN), oypg: avg(acc.oy, acc.yN), rpg: avg(acc.r + acc.or, acc.yN),
    fpg: avg(acc.f, acc.fN), spg: avg(acc.s, acc.sN), sapg: avg(acc.sa, acc.sN),
    sotpg: avg(acc.sot, acc.sN), sotapg: avg(acc.sota, acc.sN)
  };
}

function seasonOf(model, side) {
  if (model.stats?.mode !== "season") return null;
  const id = model[side].id;
  const row = model.table?.[id];
  const gp = Number(row?.gamesPlayed);
  const gf = Number(model.stats[side]?.totalGoals);
  const ga = Number(model.stats[side]?.goalsConceded);
  if (!Number.isFinite(gp) || gp < 2 || !Number.isFinite(gf) || !Number.isFinite(ga)) return null;
  return { gp, gf, ga, gfpg: gf / gp, gapg: ga / gp, rank: Number(row?.rank) || null, points: Number(row?.points) || null };
}

/* ---------- 市場隱含 ---------- */

function devig(list) {
  const sum = list.reduce((s, q) => s + q.implied, 0);
  return list.map((q) => q.implied / sum);
}

function marketView(book) {
  if (!book) return null;
  const pre = (g) => g?.pre || g?.close || g?.open || null;
  const out = {};
  const mh = pre(book.moneyline.home); const md = pre(book.moneyline.draw); const ma = pre(book.moneyline.away);
  if (mh && md && ma) {
    const [h, d, a] = devig([mh, md, ma]);
    out.ml = { home: mh, draw: md, away: ma, p: { home: h, draw: d, away: a } };
  }
  const sh = pre(book.spread.home); const sa = pre(book.spread.away);
  if (sh && sa && sh.line != null) {
    const [ph, pa] = devig([sh, sa]);
    out.ah = { line: sh.line, home: sh, away: sa, p: { home: ph, away: pa } };
  }
  const ov = pre(book.total.over); const un = pre(book.total.under);
  const tl = ov?.line ?? un?.line;
  if (ov && un && tl != null) {
    const [po, pu] = devig([ov, un]);
    out.ou = { line: tl, over: ov, under: un, p: { over: po, under: pu } };
  }
  return Object.keys(out).length ? out : null;
}

function fitMarket(mv) {
  if (!mv || (!mv.ml && !mv.ou)) return null;
  let best = null;
  for (let lh = 0.2; lh <= 3.8; lh += 0.05) {
    for (let la = 0.15; la <= 3.4; la += 0.05) {
      const m = matrixOf(lh, la);
      let err = 0;
      if (mv.ml) {
        const r = oneXTwo(m);
        err += (r.home - mv.ml.p.home) ** 2 + (r.away - mv.ml.p.away) ** 2 + (r.draw - mv.ml.p.draw) ** 2;
      }
      if (mv.ou) err += (distEff(lineDist(m, FN.over, mv.ou.line)) - mv.ou.p.over) ** 2;
      if (mv.ah) err += 0.5 * (distEff(lineDist(m, FN.homeAH, mv.ah.line)) - mv.ah.p.home) ** 2;
      if (!best || err < best.err) best = { lh, la, err };
    }
  }
  return best;
}

/* ---------- 盤口異動（參考 Odds Movement Monitor 的訊號定義） ---------- */

const ODDS_PREFIX = "fb-odds-v1:";

function curQ(g) {
  return g?.live || g?.close || null;
}

function oddsMovement(model) {
  const b = model?.odds;
  if (!b) return null;
  const hn = model.home.name;
  const an = model.away.name;
  const items = [];
  const signal = { side: null, total: null };
  const d2 = (q) => fmtOdd(q?.decimal);
  for (const [k, label] of [["home", `主勝 ${hn}`], ["draw", "和局"], ["away", `客勝 ${an}`]]) {
    const o = b.moneyline[k]?.open; const c = curQ(b.moneyline[k]);
    if (!o || !c) continue;
    const diff = c.decimal - o.decimal;
    if (Math.abs(diff) >= 0.1 || Math.abs(c.implied - o.implied) >= 0.03) {
      items.push({ market: "獨贏", text: `${label} ${d2(o)} → ${d2(c)}（隱含 ${pct(o.implied)} → ${pct(c.implied)}）`, read: diff < 0 ? "賠率下降，資金流向這一邊" : "賠率上升，市場看淡這一邊", strong: Math.abs(c.implied - o.implied) >= 0.05 });
      if (k !== "draw" && diff < 0 && Math.abs(c.implied - o.implied) >= 0.03) signal.side = signal.side && signal.side !== k ? "mixed" : k;
    }
  }
  const oh = b.spread.home?.open; const ch = curQ(b.spread.home);
  if (oh && ch && oh.line != null && ch.line != null) {
    const dl = ch.line - oh.line;
    const dp = ch.decimal - oh.decimal;
    if (Math.abs(dl) >= 0.24) {
      const towardHome = dl < 0;
      const water = dp <= -0.04 ? "降水" : dp >= 0.04 ? "升水" : "水位持平";
      const reverse = (towardHome && dp >= 0.04);
      items.push({
        market: "讓球",
        text: `${ahWords("home", oh.line)} → ${ahWords("home", ch.line)}（主隊水位 ${d2(oh)} → ${d2(ch)}，${water}）`,
        read: reverse ? `升盤卻升水，屬逆向變盤，要小心是誘盤` : `盤口往${towardHome ? hn : an}移動 ${num2(Math.abs(dl))} 球，市場看好${towardHome ? hn : an}`,
        strong: Math.abs(dl) >= 0.5 || reverse
      });
      if (!reverse) signal.side = towardHome ? "home" : "away";
    } else if (Math.abs(dp) >= 0.08) {
      items.push({ market: "讓球", text: `盤口不變（${ahWords("home", ch.line)}），主隊水位 ${d2(oh)} → ${d2(ch)}`, read: dp < 0 ? `主隊降水，資金偏${hn}` : `主隊升水，資金偏${an}`, strong: Math.abs(dp) >= 0.15 });
      if (!signal.side) signal.side = dp < 0 ? "home" : "away";
    }
  }
  const oo = b.total.over?.open; const co = curQ(b.total.over);
  if (oo && co && oo.line != null && co.line != null) {
    const dl = co.line - oo.line;
    const dp = co.decimal - oo.decimal;
    if (Math.abs(dl) >= 0.24) {
      const up = dl > 0;
      const reverse = up && dp >= 0.04;
      items.push({ market: "大小", text: `大小 ${num2(oo.line)} → ${num2(co.line)}（大分水位 ${d2(oo)} → ${d2(co)}）`, read: reverse ? "升盤卻升水，逆向變盤" : up ? "大小升盤，市場預期進球變多" : "大小降盤，市場預期進球變少", strong: Math.abs(dl) >= 0.5 || reverse });
      if (!reverse) signal.total = up ? "over" : "under";
    } else if (Math.abs(dp) >= 0.08) {
      items.push({ market: "大小", text: `大小 ${num2(co.line)} 不變，大分水位 ${d2(oo)} → ${d2(co)}`, read: dp < 0 ? "大分降水，資金偏大" : "大分升水，資金偏小", strong: Math.abs(dp) >= 0.15 });
      signal.total = dp < 0 ? "over" : "under";
    }
  }
  return { items, signal, hasOpen: !!(oh || oo || b.moneyline.home?.open) };
}

function oddsSnapshot(model) {
  const b = model?.odds;
  if (!b) return null;
  const q = (g) => curQ(g) || g?.pre || null;
  const snap = {
    t: Date.now(),
    m: model.minute.phase === "pre" ? "賽前" : model.minute.label,
    ml: [q(b.moneyline.home)?.decimal, q(b.moneyline.draw)?.decimal, q(b.moneyline.away)?.decimal],
    ah: [q(b.spread.home)?.line, q(b.spread.home)?.decimal, q(b.spread.away)?.decimal],
    ou: [q(b.total.over)?.line, q(b.total.over)?.decimal, q(b.total.under)?.decimal]
  };
  return snap;
}

function recordOdds(model) {
  const snap = oddsSnapshot(model);
  if (!snap) return [];
  let list = [];
  try { list = JSON.parse(localStorage.getItem(ODDS_PREFIX + model.id) || "[]"); } catch { list = []; }
  const sig = (x) => JSON.stringify([x.ml, x.ah, x.ou]);
  if (!list.length || sig(list[list.length - 1]) !== sig(snap)) {
    list.push(snap);
    if (list.length > 40) list = list.slice(-40);
    try { localStorage.setItem(ODDS_PREFIX + model.id, JSON.stringify(list)); } catch { /* ignore */ }
  }
  return list;
}

function movementBlock(model) {
  const mv = oddsMovement(model);
  const hist = recordOdds(model);
  const block = h("section", { class: "block", id: "movement" }, h("h2", null, ui("盤口異動")));
  block.append(h("p", { class: "faint" }, ui("比較 ESPN（DraftKings）初盤與目前盤口：升降盤 ≥ 0.25 球、水位變動、逆向變盤（升盤卻升水）。下方走勢表是這個瀏覽器開著頁面時記下的變化。")));
  if (!mv) {
    block.append(h("p", null, ui("本場沒有盤口資料。")));
    return block;
  }
  if (mv.items.length) {
    block.append(h("ul", { class: "bullets" }, mv.items.map((it) => h("li", { class: it.strong ? "move-strong" : null },
      h("b", null, ui(`${it.market}：`)), ui(it.text), h("br"), h("span", { class: it.strong ? "warn" : "faint" }, ui((it.strong ? "⚠ 明顯異動：" : "") + it.read))
    ))));
  } else {
    block.append(h("p", null, ui(mv.hasOpen ? "初盤到現在沒有明顯異動（盤口沒升降、水位變動不到 0.1）。" : "ESPN 沒有提供初盤，只能從下方走勢表看這個瀏覽器記下的變化。")));
  }
  if (hist.length >= 1) {
    block.append(h("p", { class: "faint" }, ui(`本機走勢紀錄（${hist.length} 筆，最新在上）：`)));
    block.append(predTable(["時間", "主/和/客", "讓球（主）", "大小"], [...hist].reverse().slice(0, 10).map((x) => ({
      cells: [`${taipeiClock(new Date(x.t)).slice(0, 5)} ${x.m}`, x.ml.map(fmtOdd).join(" / "), x.ah[0] != null ? `${fmtHandicap(x.ah[0])} @ ${fmtOdd(x.ah[1])}/${fmtOdd(x.ah[2])}` : "–", x.ou[0] != null ? `${num2(x.ou[0])} @ ${fmtOdd(x.ou[1])}/${fmtOdd(x.ou[2])}` : "–"]
    }))));
  }
  return block;
}

/* ---------- 主預測 ---------- */

function statsLambdas(model, profH, profA, seasonH, seasonA) {
  const avg = LEAGUE_GOALS[model.leagueSlug] || 2.7;
  const neutral = NEUTRAL_LEAGUES.has(model.leagueSlug);
  const share = neutral ? 0.5 : 0.545;
  const per = avg / 2;
  const rate = (season, prof, key) => {
    let w = 4; let sum = 4;
    const adj = key === "gfpg" ? "gfAdj" : "gaAdj";
    if (season) { const ws = Math.min(season.gp, 15); w += ws; sum += ws * (season[key] / per); }
    if (prof?.n) { const wf = prof.n * 1.2; w += wf; sum += wf * ((prof[adj] ?? prof[key]) / per); }
    return sum / w;
  };
  const attH = rate(seasonH, profH, "gfpg");
  const defH = rate(seasonH, profH, "gapg");
  const attA = rate(seasonA, profA, "gfpg");
  const defA = rate(seasonA, profA, "gapg");
  const lh = Math.max(0.15, attH * defA * avg * share);
  const la = Math.max(0.15, attA * defH * avg * (1 - share));
  return { lh, la, attH, defH, attA, defA, avg, share, neutral };
}

function buildPrediction(model, gamesH, gamesA) {
  const profH = profileOf(model.home.id, gamesH);
  const profA = profileOf(model.away.id, gamesA);
  const seasonH = seasonOf(model, "home");
  const seasonA = seasonOf(model, "away");
  const st = statsLambdas(model, profH, profA, seasonH, seasonA);
  const mv = marketView(model.odds);
  const fit = fitMarket(mv);
  const lh = fit ? MARKET_WEIGHT * fit.lh + (1 - MARKET_WEIGHT) * st.lh : st.lh;
  const la = fit ? MARKET_WEIGHT * fit.la + (1 - MARKET_WEIGHT) * st.la : st.la;
  const m = matrixOf(lh, la);
  const hn = model.home.name;
  const an = model.away.name;

  const htShare = (() => {
    const tot = (profH.gf + profH.ga) + (profA.gf + profA.ga);
    const first = (profH.gf1 + profH.ga1) + (profA.gf1 + profA.ga1);
    const n = profH.htN + profA.htN;
    if (n < 4 || tot < 4) return 0.44;
    return Math.max(0.38, Math.min(0.5, (first / tot) * 0.6 + 0.44 * 0.4));
  })();
  const m1 = matrixOf(lh * htShare, la * htShare, RHO / 2);

  /* 依據（共用） */
  const basis = [];
  const formLine = (name, p) => (p.n ? `${name}近 ${p.n} 場 ${p.w}勝${p.d}和${p.l}負，場均進 ${trimNum(p.gfpg)}、失 ${trimNum(p.gapg)}${p.xgN >= 2 ? `；場均 xG ${fx(p.xgfpg)}、被 xG ${fx(p.xgapg)}（${p.xgN} 場有文字轉播）` : ""}` : "");
  const seasonLine = (name, s) => (s ? `${name}本季 ${s.gp} 場進 ${s.gf} 失 ${s.ga}（場均 ${trimNum(s.gfpg)} / ${trimNum(s.gapg)}）${s.rank ? `，排名第 ${s.rank}` : ""}` : "");
  [seasonLine(hn, seasonH), seasonLine(an, seasonA), formLine(hn, profH), formLine(an, profA)].filter(Boolean).forEach((s) => basis.push(s + "。"));
  basis.push(`數據模型預期進球：${hn} ${trimNum(st.lh)}、${an} ${trimNum(st.la)}（聯賽場均 ${st.avg} 球${st.neutral ? "，中立場" : "，含主場優勢"}）。`);
  if (fit) basis.push(`盤口反推預期進球：${hn} ${trimNum(fit.lh)}、${an} ${trimNum(fit.la)}。最終採市場 ${Math.round(MARKET_WEIGHT * 100)}%＋數據 ${Math.round((1 - MARKET_WEIGHT) * 100)}%：${hn} ${trimNum(lh)}、${an} ${trimNum(la)}。`);
  else basis.push("本場 ESPN 沒有盤口，以下全用數據模型。");
  const h2h = model.h2h;
  const h2hN = (h2h?.hw || 0) + (h2h?.dr || 0) + (h2h?.aw || 0);
  if (h2hN) basis.push(`本季交手 ${h2hN} 場：${hn} ${h2h.hw} 勝、和 ${h2h.dr}、${an} ${h2h.aw} 勝（樣本小，只做參考）。`);

  const move = oddsMovement(model);
  if (move?.items.length) basis.push(`盤口異動：${move.items.map((it) => `${it.market} ${it.text}（${it.read}）`).join("；")}。`);
  const markets = [];
  const picks = [];
  const addPick = (p) => picks.push(p);

  /* 1. 獨贏 */
  const r = oneXTwo(m);
  {
    const rows = [["home", `主勝 ${hn}`, r.home], ["draw", "和局", r.draw], ["away", `客勝 ${an}`, r.away]].map(([k, label, p]) => {
      const q = mv?.ml?.[k];
      const ev = q ? p * q.decimal - 1 : null;
      return { k, label, p, fair: fairOf(p), dec: q?.decimal ?? null, ev };
    });
    const top = [...rows].sort((a, b) => b.p - a.p)[0];
    const val = rows.filter((x) => x.ev != null).sort((a, b) => b.ev - a.ev)[0];
    const reasons = [`模型：主勝 ${pct(r.home)}、和 ${pct(r.draw)}、客勝 ${pct(r.away)}。`];
    if (mv?.ml) reasons.push(`盤口去水後：主 ${pct(mv.ml.p.home)}、和 ${pct(mv.ml.p.draw)}、客 ${pct(mv.ml.p.away)}。`);
    if (st.lh - st.la > 0.4) reasons.push(`${hn}數據預期進球多 ${trimNum(st.lh - st.la)} 球。`);
    else if (st.la - st.lh > 0.4) reasons.push(`${an}數據預期進球多 ${trimNum(st.la - st.lh)} 球。`);
    markets.push({ id: "ml", title: "獨贏（勝平負）", rows, lean: `最可能：${top.label}（${pct(top.p)}）`, reasons });
    rows.forEach((x) => addPick({ market: "獨贏", label: x.label, p: x.p, dec: x.dec, ev: x.ev, fair: x.fair, why: reasons[0], key: `ml.${x.k}` }));
    if (val) markets[markets.length - 1].value = val;
  }

  /* 2. 讓球（亞洲盤） */
  {
    const fairLine = (() => {
      let bestL = 0; let bestGap = 9;
      for (let L = -3; L <= 3.001; L += 0.25) {
        const gap = Math.abs(distEff(lineDist(m, FN.homeAH, L)) - 0.5);
        if (gap < bestGap) { bestGap = gap; bestL = Math.round(L * 100) / 100; }
      }
      return bestL;
    })();
    const lines = new Set([fairLine - 0.25, fairLine, fairLine + 0.25]);
    if (mv?.ah) lines.add(mv.ah.line);
    const rows = [...lines].sort((a, b) => a - b).map((L) => {
      const dh = lineDist(m, FN.homeAH, L);
      const da = lineDist(m, FN.awayAH, -L);
      const isMarket = mv?.ah && Math.abs(mv.ah.line - L) < 1e-9;
      return {
        L, isMarket,
        home: { label: ahWords("home", L), d: dh, eff: distEff(dh), fair: distFair(dh), dec: isMarket ? mv.ah.home.decimal : null, ev: isMarket ? distEv(dh, mv.ah.home.decimal) : null },
        away: { label: ahWords("away", -L), d: da, eff: distEff(da), fair: distFair(da), dec: isMarket ? mv.ah.away.decimal : null, ev: isMarket ? distEv(da, mv.ah.away.decimal) : null }
      };
    });
    const sup = lh - la;
    const reasons = [`模型預期淨勝球：${hn} ${sup >= 0 ? "+" : ""}${trimNum(sup)}，合理讓球線約「${ahWords("home", fairLine)}」。`];
    const mk = rows.find((x) => x.isMarket);
    if (mk) {
      reasons.push(`ESPN 盤「${mk.home.label}」：主隊贏盤 ${pct(mk.home.eff)}、賠率 ${fmtOdd(mk.home.dec)} 期望值 ${evText(mk.home.ev)}；客隊贏盤 ${pct(mk.away.eff)}、賠率 ${fmtOdd(mk.away.dec)} 期望值 ${evText(mk.away.ev)}。`);
      addPick({ market: "讓球", label: mk.home.label, p: mk.home.eff, dec: mk.home.dec, ev: mk.home.ev, fair: mk.home.fair, why: reasons[1], key: "ah.home" });
      addPick({ market: "讓球", label: mk.away.label, p: mk.away.eff, dec: mk.away.dec, ev: mk.away.ev, fair: mk.away.fair, why: reasons[1], key: "ah.away" });
    } else {
      const fr = rows.find((x) => Math.abs(x.L - fairLine) < 1e-9);
      const side = fr.home.eff >= fr.away.eff ? fr.home : fr.away;
      addPick({ market: "讓球", label: side.label, p: side.eff, dec: null, ev: null, fair: side.fair, why: reasons[0] });
    }
    if (profH.n && profA.n) reasons.push(`近況淨勝球：${hn} 場均 ${signed(profH.gfpg - profH.gapg)}、${an} 場均 ${signed(profA.gfpg - profA.gapg)}。`);
    const mvAh = move?.items.filter((it) => it.market === "讓球" || it.market === "獨贏") || [];
    if (mvAh.length) reasons.push(`盤口異動：${mvAh.map((it) => it.read).join("；")}。`);
    const leanSide = sup >= 0 ? "主隊" : "客隊";
    markets.push({ id: "ah", title: "讓球（亞洲讓球）", ahRows: rows, lean: `合理線：${ahWords("home", fairLine)}；強勢方 ${leanSide}`, reasons });
  }

  /* 3. 大小球 */
  {
    const exp = lh + la;
    const lines = new Set([1.5, 2.5, 3.5]);
    if (mv?.ou) lines.add(mv.ou.line);
    const rows = [...lines].sort((a, b) => a - b).map((L) => {
      const dov = lineDist(m, FN.over, L);
      const dun = lineDist(m, FN.under, L);
      const isMarket = mv?.ou && Math.abs(mv.ou.line - L) < 1e-9;
      return {
        L, isMarket,
        over: { label: `大 ${lineLabel(L)}`, eff: distEff(dov), fair: distFair(dov), dec: isMarket ? mv.ou.over.decimal : null, ev: isMarket ? distEv(dov, mv.ou.over.decimal) : null },
        under: { label: `小 ${lineLabel(L)}`, eff: distEff(dun), fair: distFair(dun), dec: isMarket ? mv.ou.under.decimal : null, ev: isMarket ? distEv(dun, mv.ou.under.decimal) : null }
      };
    });
    const reasons = [`模型預期總進球 ${trimNum(exp)} 球。`];
    if (profH.n && profA.n) reasons.push(`近 ${profH.n}/${profA.n} 場大 2.5 的比例：${hn} ${profH.o25}/${profH.n}、${an} ${profA.o25}/${profA.n}；射門場均 ${trimNum(profH.spg ?? 0)} vs ${trimNum(profA.spg ?? 0)}。`);
    const mk = rows.find((x) => x.isMarket);
    if (mk) {
      reasons.push(`ESPN 盤 ${lineLabel(mk.L)}：大 ${pct(mk.over.eff)}（賠 ${fmtOdd(mk.over.dec)}，期望值 ${evText(mk.over.ev)}），小 ${pct(mk.under.eff)}（賠 ${fmtOdd(mk.under.dec)}，期望值 ${evText(mk.under.ev)}）。`);
      addPick({ market: "大小球", label: mk.over.label, p: mk.over.eff, dec: mk.over.dec, ev: mk.over.ev, fair: mk.over.fair, why: reasons[reasons.length - 1], key: "ou.over" });
      addPick({ market: "大小球", label: mk.under.label, p: mk.under.eff, dec: mk.under.dec, ev: mk.under.ev, fair: mk.under.fair, why: reasons[reasons.length - 1], key: "ou.under" });
    }
    rows.filter((x) => !x.isMarket).forEach((x) => {
      const side = x.over.eff >= x.under.eff ? x.over : x.under;
      addPick({ market: "大小球", label: side.label, p: side.eff, dec: null, ev: null, fair: side.fair, why: reasons[0] });
    });
    const mvOu = move?.items.filter((it) => it.market === "大小") || [];
    if (mvOu.length) reasons.push(`盤口異動：${mvOu.map((it) => `${it.text}，${it.read}`).join("；")}。`);
    const main = rows.find((x) => Math.abs(x.L - 2.5) < 1e-9);
    markets.push({ id: "ou", title: "大小球（全場進球）", ouRows: rows, lean: `預期 ${trimNum(exp)} 球；2.5 ${main.over.eff >= 0.5 ? "偏大" : "偏小"}（大 ${pct(main.over.eff)}）`, reasons });
  }

  /* 4. 雙方進球、總進球數、正確比分 */
  {
    let btts = 0;
    const totals = [0, 0, 0, 0];
    const scores = [];
    m.forEach((row, i) => row.forEach((p, j) => {
      if (i > 0 && j > 0) btts += p;
      const t = i + j;
      totals[t <= 1 ? 0 : t <= 3 ? 1 : t <= 6 ? 2 : 3] += p;
      scores.push({ s: `${i}-${j}`, p });
    }));
    scores.sort((a, b) => b.p - a.p);
    const reasons = [];
    if (profH.n && profA.n) reasons.push(`近況雙方都進球：${hn} ${profH.btts}/${profH.n} 場、${an} ${profA.btts}/${profA.n} 場；零封 ${profH.cs} / ${profA.cs} 場，未進球 ${profH.fts} / ${profA.fts} 場。`);
    reasons.push(`${hn}至少進 1 球 ${pct(1 - Math.exp(-lh))}，${an}至少進 1 球 ${pct(1 - Math.exp(-la))}。`);
    markets.push({
      id: "btts", title: "雙方進球／總進球數／正確比分",
      btts, totals, scores: scores.slice(0, 6),
      lean: `雙方進球：${btts >= 0.5 ? "是" : "否"}（是 ${pct(btts)}）；最可能比分 ${scores[0].s}`,
      reasons
    });
    addPick({ market: "雙方進球", label: btts >= 0.5 ? "雙方進球：是" : "雙方進球：否", p: Math.max(btts, 1 - btts), dec: null, ev: null, fair: fairOf(Math.max(btts, 1 - btts)), why: reasons[0] || reasons[1] });
    const dc = [["主或和（主不敗）", r.home + r.draw], ["客或和（客不敗）", r.away + r.draw]].sort((a, b) => b[1] - a[1])[0];
    addPick({ market: "雙重機會", label: dc[0], p: dc[1], dec: null, ev: null, fair: fairOf(dc[1]), why: `模型：主勝 ${pct(r.home)}、和 ${pct(r.draw)}、客勝 ${pct(r.away)}。` });
  }

  /* 5. 上半場 */
  {
    const r1 = oneXTwo(m1);
    const o05 = distEff(lineDist(m1, FN.over, 0.5));
    const o15 = distEff(lineDist(m1, FN.over, 1.5));
    const reasons = [`上半場進球占全場比例取 ${pct(htShare)}（依兩隊近況半場比分），上半場預期 ${trimNum((lh + la) * htShare)} 球。`];
    if (profH.htN && profA.htN) reasons.push(`近況上半場：${hn} 場均進 ${trimNum(profH.gf1pg)} 失 ${trimNum(profH.ga1pg)}；${an} 場均進 ${trimNum(profA.gf1pg)} 失 ${trimNum(profA.ga1pg)}。`);
    markets.push({ id: "ht", title: "上半場", r1, o05, o15, lean: `半場最可能：${r1.draw >= Math.max(r1.home, r1.away) ? "和局" : r1.home > r1.away ? "主隊領先" : "客隊領先"}；半場大 0.5 ${pct(o05)}`, reasons });
    addPick({ market: "上半場大小", label: o05 >= 0.5 ? "半場大 0.5" : "半場小 0.5", p: Math.max(o05, 1 - o05), dec: null, ev: null, fair: fairOf(Math.max(o05, 1 - o05)), why: reasons[0] });
  }

  /* 6. 角球 */
  if (profH.cN >= 2 && profA.cN >= 2) {
    const neutral = st.neutral;
    const muH = (profH.cfpg + profA.capg) / 2 * (neutral ? 1 : 1.05);
    const muA = (profA.cfpg + profH.capg) / 2 * (neutral ? 1 : 0.95);
    const mu = muH + muA;
    const pmf = nbPmf(mu, 30, 0.3);
    const base = Math.floor(mu) + 0.5;
    const rows = [base - 1, base, base + 1].map((L) => {
      const ov = countOver(pmf, L);
      return { L, over: ov, under: 1 - ov };
    });
    const reasons = [
      `${hn}近 ${profH.cN} 場場均角球 ${trimNum(profH.cfpg)}、被對手 ${trimNum(profH.capg)}；${an}近 ${profA.cN} 場場均 ${trimNum(profA.cfpg)}、被對手 ${trimNum(profA.capg)}。`,
      `預估本場角球 ${hn} ${trimNum(muH)}、${an} ${trimNum(muA)}，合計 ${trimNum(mu)}（角球波動大，模型用比 Poisson 更寬的分布）。`
    ];
    const strong = rows.map((x) => (x.over >= x.under ? { L: x.L, side: "大", p: x.over } : { L: x.L, side: "小", p: x.under })).sort((a, b) => b.p - a.p)[0];
    markets.push({ id: "corners", title: "角球大小", rows, mu, muH, muA, lean: `預估 ${trimNum(mu)} 角（${hn} ${trimNum(muH)}、${an} ${trimNum(muA)}）；最有把握：${strong.side} ${num2(strong.L)}（${pct(strong.p)}）`, reasons });
    addPick({ market: "角球", label: `角球${strong.side} ${num2(strong.L)}`, p: strong.p, dec: null, ev: null, fair: fairOf(strong.p), why: reasons[1] });
  }

  /* 7. 罰牌 */
  if (profH.yN >= 2 && profA.yN >= 2) {
    const muH = (profH.ypg + profA.oypg) / 2;
    const muA = (profA.ypg + profH.oypg) / 2;
    const mu = muH + muA;
    const pmf = nbPmf(mu, 20, 0.35);
    const base = Math.floor(mu) + 0.5;
    const rows = [base - 1, base, base + 1].filter((L) => L > 0).map((L) => {
      const ov = countOver(pmf, L);
      return { L, over: ov, under: 1 - ov };
    });
    const redRate = (((profH.r + profH.or) + (profA.r + profA.or)) / 2 + 0.12 * 4) / ((profH.yN + profA.yN) / 2 + 4);
    const pRed = 1 - Math.exp(-redRate);
    const reasons = [
      `${hn}近 ${profH.yN} 場場均黃牌 ${trimNum(profH.ypg)}、對手 ${trimNum(profH.oypg)}；${an}場均 ${trimNum(profA.ypg)}、對手 ${trimNum(profA.oypg)}。`,
      `預估本場黃牌 ${hn} ${trimNum(muH)}、${an} ${trimNum(muA)}，合計 ${trimNum(mu)}；出現紅牌機率約 ${pct(pRed)}。`,
      "裁判尺度 ESPN 沒有提供，罰牌計分方式（黃 1 紅 2 或只算張數）請以下注平台規則為準。"
    ];
    const strong = rows.map((x) => (x.over >= x.under ? { L: x.L, side: "大", p: x.over } : { L: x.L, side: "小", p: x.under })).sort((a, b) => b.p - a.p)[0];
    markets.push({ id: "cards", title: "罰牌（黃牌數）大小", rows, mu, muH, muA, pRed, lean: `預估黃牌 ${trimNum(mu)} 張；${muH > muA ? hn : an}較容易吃牌`, reasons });
    addPick({ market: "罰牌", label: `黃牌${strong.side} ${num2(strong.L)}`, p: strong.p, dec: null, ev: null, fair: fairOf(strong.p), why: reasons[1] });
  }

  /* 推薦：有賠率的看期望值，沒賠率的看機率與合理賠率 */
  for (const p of picks) {
    const side = /\.home$/.test(p.key || "") ? "home" : /\.away$/.test(p.key || "") ? "away" : null;
    const tot = /\.over$/.test(p.key || "") ? "over" : /\.under$/.test(p.key || "") ? "under" : null;
    if (side && move?.signal.side && move.signal.side !== "mixed" && move.signal.side !== side) p.against = "盤口資金正往另一邊走";
    if (tot && move?.signal.total && move.signal.total !== tot) p.against = "大小盤口正往另一邊走";
  }
  const valued = picks.filter((p) => p.ev != null && p.ev >= EDGE_MIN && p.ev <= EDGE_WILD && p.p >= 0.35).sort((a, b) => b.ev - a.ev);
  const wild = picks.filter((p) => p.ev != null && p.ev > EDGE_WILD && p.p >= 0.3).sort((a, b) => b.ev - a.ev)
    .map((p) => ({ ...p, wild: true }));
  const strongP = picks.filter((p) => p.ev == null && p.p >= 0.6 && p.p <= 0.88).sort((a, b) => b.p - a.p);
  const best = [...valued.slice(0, 3), ...strongP.slice(0, 3), ...wild.slice(0, 1)].slice(0, 6);
  if (fit) {
    const gap = Math.abs((st.lh - st.la) - (fit.lh - fit.la));
    if (gap >= 0.5) basis.push(`注意：數據模型和盤口對強弱的看法差 ${trimNum(gap)} 球。盤口通常已反映傷兵、輪換、陣容等模型看不到的資訊，所以最終以盤口為主（${Math.round(MARKET_WEIGHT * 100)}%）。`);
  }

  return {
    at: Date.now(), lh, la, st, fit, mv, htShare, profH, profA, seasonH, seasonA,
    basis, markets, best, top: oneXTwo(m), noValue: !valued.length && !wild.length && !!mv
  };
}

/* 賽前存檔，完賽後拿來對答案 */
const PRED_PREFIX = "fb-pred-v1:";

function pickSide(a, b) {
  /* 有正期望值就挑期望值高的，否則挑機率高的；回傳 true 代表選 a */
  if (a.ev != null && b.ev != null && Math.max(a.ev, b.ev) > 0) return a.ev >= b.ev;
  return a.eff >= b.eff;
}

function savePrediction(model, pred) {
  const ah = pred.markets.find((x) => x.id === "ah");
  const ou = pred.markets.find((x) => x.id === "ou");
  const bt = pred.markets.find((x) => x.id === "btts");
  const co = pred.markets.find((x) => x.id === "corners");
  const ca = pred.markets.find((x) => x.id === "cards");
  const mkAh = ah?.ahRows?.find((x) => x.isMarket);
  const mkOu = ou?.ouRows?.find((x) => x.isMarket) || ou?.ouRows?.find((x) => Math.abs(x.L - 2.5) < 1e-9);
  const keep = {
    at: Date.now(),
    lh: pred.lh, la: pred.la,
    top: pred.top,
    ah: mkAh ? { L: mkAh.L, side: pickSide(mkAh.home, mkAh.away) ? "home" : "away" } : null,
    ou: mkOu ? { L: mkOu.L, side: pickSide(mkOu.over, mkOu.under) ? "over" : "under" } : null,
    btts: bt ? bt.btts : null,
    score: bt?.scores?.[0]?.s || null,
    corners: co ? { mu: co.mu } : null,
    cards: ca ? { mu: ca.mu } : null,
    best: pred.best.map((p) => ({ market: p.market, label: p.label, p: p.p, dec: p.dec ?? null, key: p.key || null }))
  };
  const prev = loadPrediction(model.id);
  keep.first = prev?.first || { at: keep.at, best: keep.best.filter((b) => b.dec != null && b.key) };
  try { localStorage.setItem(PRED_PREFIX + model.id, JSON.stringify(keep)); } catch { /* ignore */ }
  return keep;
}

function loadPrediction(id) {
  try {
    const raw = localStorage.getItem(PRED_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function runPrediction(model, signal) {
  const ids = (side) => (model.formIds || []).find((b) => b.id === model[side].id)?.events || [];
  const lim = pLimit(4);
  const grab = (list) => Promise.all(list.slice(0, 5).map((ev) => lim(async () => {
    try {
      const slim = await fetchSlim(ev.id, signal);
      if (slim && (slim.h.g == null || slim.a.g == null) && Number.isFinite(ev.hs)) {
        slim.h.g = ev.hs; slim.a.g = ev.as;
      }
      return slim;
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (!Number.isFinite(ev.hs) || !Number.isFinite(ev.as)) return null;
      return { done: true, h: { id: ev.home, g: ev.hs }, a: { id: ev.away, g: ev.as } };
    }
  })));
  const [gh, ga] = await Promise.all([grab(ids("home")), grab(ids("away"))]);
  return buildPrediction(model, gh.filter(Boolean), ga.filter(Boolean));
}

/* ---------- 文字轉播（commentary）解析 ---------- */

const SHOT_TYPES = new Set(["shot-off-target", "shot-blocked", "shot-on-target", "shot-hit-woodwork", "goal", "penalty-scored", "penalty-saved", "penalty-missed"]);
const SOT_TYPES = new Set(["shot-on-target", "goal", "penalty-scored", "penalty-saved"]);

/* 簡易 xG：依文字轉播的射門位置、頭球、點球、快攻等估算（參考 Understat 的概念，非官方數據） */
function xgOf(text, type) {
  if (!SHOT_TYPES.has(type) || /own goal/i.test(text)) return 0;
  const t = String(text || "").toLowerCase();
  if (/penalt/.test(t) || /^penalty/.test(type)) return 0.76;
  const header = /header|headed/.test(t);
  let x;
  if (/six yard box|very close range/.test(t)) x = header ? 0.28 : 0.42;
  else if (/centre of the box|center of the box/.test(t)) x = header ? 0.1 : 0.16;
  else if (/difficult angle/.test(t)) x = 0.05;
  else if (/(left|right) side of the box/.test(t)) x = header ? 0.05 : 0.08;
  else if (/outside the box|long range|\d+ yards/.test(t)) x = 0.035;
  else x = header ? 0.08 : 0.09;
  if (/direct free kick/.test(t)) x = Math.max(x, 0.06);
  if (/fast break/.test(t)) x *= 1.35;
  if (/through ball/.test(t)) x *= 1.2;
  if (/following a corner|set piece situation/.test(t)) x *= 0.9;
  return Math.min(0.9, x);
}

function sideOfName(name, home, away) {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return "";
  const eq = (t) => t.rawName && (t.rawName.toLowerCase() === n || n.includes(t.rawName.toLowerCase()) || t.rawName.toLowerCase().includes(n));
  if (eq(home)) return "home";
  if (eq(away)) return "away";
  return "";
}

function parseCommentary(raw, home, away) {
  const out = [];
  (raw || []).forEach((c, idx) => {
    const play = c.play;
    if (!play) return;
    const type = play.type?.type || "";
    const text = c.text || play.text || "";
    const clock = play.clock?.displayValue || c.time?.displayValue || "";
    const parsed = parseClock(clock);
    let period = Number(play.period?.number || 0);
    const base = parsed?.base || 0;
    if (!period) period = base > 45 ? 2 : 1;
    let side = sideOfName(play.team?.displayName, home, away);
    if (String(play.team?.id || "") === home.id) side = "home";
    else if (String(play.team?.id || "") === away.id) side = "away";
    let player = "";
    let m = /^Offside, [^.]+\.\s*(.+?) is caught offside/i.exec(text);
    if (m) player = m[1];
    if (!player) {
      m = /^(?:Goal!|Own Goal)[^.]*\.\s*(.+?)\s\(/i.exec(text) || /^(?:Attempt \w+|Foul by|Handball by|Penalty \w+)\.?\s*(.+?)\s\(/i.exec(text) || /^(.+?)\s\([^)]+\) is shown the/i.exec(text) || /^(.+?)\s\([^)]+\) hits the/i.exec(text);
      if (m) player = m[1].replace(/^by\s+/i, "");
    }
    const am = /Assisted by (.+?)(?:\swith\b|\sfollowing\b|\.|$)/i.exec(text);
    const isFoulTaker = /wins a free kick/i.test(text);
    out.push({
      i: idx, type, text, period, base, extra: parsed?.extra || 0, clock, side,
      player: playerZh(player.trim()), assist: am ? playerZh(am[1].trim()) : "",
      xg: xgOf(text, type),
      foul: (type === "foul" && !isFoulTaker && /^Foul by/i.test(text)) || type === "handball",
      shot: SHOT_TYPES.has(type) && !/own goal/i.test(text),
      sot: SOT_TYPES.has(type) && !/own goal/i.test(text),
      corner: type === "corner-awarded",
      offside: type === "offside",
      yellow: type === "yellow-card",
      red: type === "red-card" || type === "yellow-red-card" || /second yellow/i.test(text)
    });
  });
  return out;
}

/* ---------- 復盤 ---------- */

/* 文字轉播要夠完整（射門、犯規、角球都有記錄）才拿來算數據；友誼賽常常只有幾筆 */
function commRich(model) {
  const c = model.commentary || [];
  return c.length >= 25 && c.some((it) => it.foul) && c.some((it) => it.shot);
}

const SEGMENTS = [
  { id: "s1", p: 1, from: -1, to: 15, title: "開賽–15 分鐘" },
  { id: "s2", p: 1, from: 15, to: 30, title: "15–30 分鐘" },
  { id: "s3", p: 1, from: 30, to: 999, title: "30 分鐘–半場" },
  { id: "s4", p: 2, from: -1, to: 60, title: "下半場開始–60 分鐘" },
  { id: "s5", p: 2, from: 60, to: 75, title: "60–75 分鐘" },
  { id: "s6", p: 2, from: 75, to: 999, title: "75 分鐘–終場" }
];

function inSeg(item, seg) {
  return item.period === seg.p && item.base > seg.from && item.base <= seg.to;
}

function segState(seg, minute) {
  if (minute.phase === "pre") return "todo";
  if (minute.phase === "ft" || minute.state === "post") return "done";
  if (minute.period > seg.p) return "done";
  if (minute.phase === "ht") return seg.p === 1 ? "done" : "todo";
  if (minute.period === seg.p) {
    if (minute.base > seg.to) return "done";
    if (minute.base > seg.from) return "live";
  }
  return "todo";
}

function halfState(p, minute) {
  if (minute.phase === "pre") return "todo";
  if (minute.phase === "ft" || minute.state === "post") return "done";
  if (p === 1) return minute.phase === "ht" || minute.period >= 2 ? "done" : "live";
  if (minute.period > 2) return "done";
  return minute.period === 2 && minute.phase !== "ht" ? "live" : "todo";
}

function blankTally() {
  return { shots: 0, sot: 0, corners: 0, fouls: 0, yellow: 0, red: 0, offsides: 0, goals: 0, xg: 0 };
}

function tallyOf(items, goals) {
  const t = { home: blankTally(), away: blankTally() };
  for (const it of items) {
    if (!it.side) continue;
    const s = t[it.side];
    if (it.shot) s.shots += 1;
    if (it.sot) s.sot += 1;
    s.xg += it.xg || 0;
    if (it.corner) s.corners += 1;
    if (it.foul) s.fouls += 1;
    if (it.yellow) s.yellow += 1;
    if (it.red) s.red += 1;
    if (it.offside) s.offsides += 1;
  }
  for (const g of goals) {
    if (g.side) t[g.side].goals += 1;
  }
  return t;
}

function playersOf(items, side) {
  const map = new Map();
  const get = (name) => {
    if (!map.has(name)) map.set(name, { name, goals: 0, assists: 0, shots: 0, sot: 0, fouls: 0, yellow: 0, red: 0, offsides: 0, xg: 0 });
    return map.get(name);
  };
  for (const it of items) {
    if (it.side !== side) continue;
    if (it.player) {
      const p = get(it.player);
      if (it.type === "goal" || it.type === "penalty-scored") p.goals += 1;
      if (it.shot) p.shots += 1;
      if (it.sot) p.sot += 1;
      p.xg += it.xg || 0;
      if (it.foul) p.fouls += 1;
      if (it.yellow) p.yellow += 1;
      if (it.red) p.red += 1;
      if (it.offside) p.offsides += 1;
    }
    if (it.assist && (it.type === "goal" || it.type === "penalty-scored")) get(it.assist).assists += 1;
  }
  const score = (p) => p.goals * 3 + p.assists * 2 + p.sot * 1 + (p.shots - p.sot) * 0.35 + p.xg * 1.5 - p.yellow * 0.6 - p.red * 2 - p.fouls * 0.1;
  return [...map.values()].map((p) => ({ ...p, score: score(p) })).sort((a, b) => b.score - a.score);
}

function playerLine(p) {
  const bits = [];
  if (p.goals) bits.push(`${p.goals} 球`);
  if (p.assists) bits.push(`${p.assists} 助攻`);
  if (p.shots) bits.push(`${p.shots} 射${p.sot ? `（${p.sot} 正）` : ""}`);
  if (p.xg >= 0.25) bits.push(`xG ${fx(p.xg)}`);
  if (p.yellow) bits.push("黃牌");
  if (p.red) bits.push("紅牌");
  if (p.fouls >= 2) bits.push(`${p.fouls} 犯規`);
  return `${p.name}：${bits.join("、") || "有參與"}`;
}

function goalSide(ev, model) {
  if (ev.teamId === model.home.id) return "home";
  if (ev.teamId === model.away.id) return "away";
  return "";
}

function goalsIn(model, pred) {
  return (model.events || []).filter((ev) => ev.kind === "goal" && pred(ev)).map((ev) => ({ ...ev, side: goalSide(ev, model) }));
}

function fx(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function pressure(t) {
  return t.shots + t.sot * 1.5 + t.corners * 0.5 + (t.xg || 0) * 4;
}

function xgRead(name, s) {
  const d = s.goals - s.xg;
  if (s.shots === 0) return "";
  if (d >= 1) return `${name}進 ${s.goals} 球、xG 只有 ${fx(s.xg)}，把握度很高（也有運氣成分）`;
  if (d <= -1) return `${name}xG ${fx(s.xg)} 卻只進 ${s.goals} 球，浪費了好機會`;
  if (s.xg >= 1.5) return `${name}製造了大量高質量機會（xG ${fx(s.xg)}）`;
  return "";
}

function dominance(t, hn, an) {
  const ph = pressure(t.home);
  const pa = pressure(t.away);
  const diff = ph - pa;
  if (Math.abs(diff) < 2.5) return { side: "", text: "兩隊攻勢接近，互有來回" };
  const who = diff > 0 ? hn : an;
  const lot = Math.abs(diff) >= 7 ? "明顯壓著打" : "較主動";
  return { side: diff > 0 ? "home" : "away", text: `${who}${lot}` };
}

function tallyBits(t, hn, an) {
  const row = (lbl, k) => `${lbl} ${t.home[k]}:${t.away[k]}`;
  return `${hn} vs ${an}｜${[row("射門", "shots"), row("射正", "sot"), `xG ${fx(t.home.xg)}:${fx(t.away.xg)}`, row("角球", "corners"), row("犯規", "fouls"), row("黃牌", "yellow")].join("、")}${t.home.red + t.away.red ? `、紅牌 ${t.home.red}:${t.away.red}` : ""}${t.home.offsides + t.away.offsides ? `、越位 ${t.home.offsides}:${t.away.offsides}` : ""}`;
}

function cumScore(model, sortMax) {
  const s = { home: 0, away: 0 };
  for (const g of goalsIn(model, (ev) => eventSort(ev) <= sortMax)) if (g.side) s[g.side] += 1;
  return s;
}

function segmentRecap(model, seg, status) {
  const items = (model.commentary || []).filter((it) => inSeg(it, seg));
  const goals = goalsIn(model, (ev) => inSeg(ev, seg));
  const t = tallyOf(items, goals);
  const hn = model.home.name;
  const an = model.away.name;
  const dom = dominance(t, hn, an);
  const endSort = seg.p * 100000 + Math.min(seg.to, 200) * 100 + 99;
  const score = cumScore(model, endSort);
  const cards = (model.events || []).filter((ev) => (ev.kind === "yellow" || ev.kind === "red" || ev.kind === "sub") && inSeg(ev, seg));
  const lines = [];
  if (goals.length) lines.push(`進球：${goals.map((g) => `${g.minuteLabel} ${g.teamName}${g.scorer ? " " + g.scorer : ""}${g.style ? `（${g.style}）` : ""}`).join("；")}。`);
  else lines.push("這段沒有進球。");
  if (commRich(model)) lines.push(`${dom.text}。`);
  const keyEv = cards.filter((ev) => ev.kind !== "sub").map((ev) => `${ev.minuteLabel} ${ev.fact}`);
  const subs = cards.filter((ev) => ev.kind === "sub").map((ev) => `${ev.minuteLabel} ${ev.teamName} ${ev.subOn || ""}↔${ev.subOff || ""}`);
  if (keyEv.length) lines.push(`牌：${keyEv.join("；")}。`);
  if (subs.length) lines.push(`換人：${subs.join("；")}。`);
  const ph = playersOf(items, "home").filter((p) => p.score > 0.3)[0];
  const pa = playersOf(items, "away").filter((p) => p.score > 0.3)[0];
  const stars = [ph && `${hn} ${playerLine(ph)}`, pa && `${an} ${playerLine(pa)}`].filter(Boolean);
  if (stars.length) lines.push(`亮點球員：${stars.join("；")}。`);
  const scoreText = `比分 ${hn} ${score.home} 比 ${an} ${score.away}`;
  const spoken = [
    `${seg.title}${status === "live" ? "目前" : "結束"}，${scoreText}。`,
    `這段射門 ${t.home.shots} 比 ${t.away.shots}，射正 ${t.home.sot} 比 ${t.away.sot}，角球 ${t.home.corners} 比 ${t.away.corners}，${dom.text}。`
  ];
  if (goals.length) spoken.push(`進球來自 ${goals.map((g) => g.scorer || g.teamName).join("、")}。`);
  else if (stars[0]) spoken.push(`值得注意的是 ${stars[0]}。`);
  return { id: seg.id, title: seg.title, status, tally: t, scoreText, bits: tallyBits(t, hn, an), lines, spoken: spoken.slice(0, 3), hasData: items.length > 0 && commRich(model) };
}

function halfRecap(model, p, status) {
  const items = (model.commentary || []).filter((it) => it.period === p);
  const goals = goalsIn(model, (ev) => (ev.period || 1) === p);
  const t = tallyOf(items, goals);
  const hn = model.home.name;
  const an = model.away.name;
  const lsH = Number(model.home.linescores?.[p - 1]?.displayValue ?? model.home.linescores?.[p - 1]?.value);
  const lsA = Number(model.away.linescores?.[p - 1]?.displayValue ?? model.away.linescores?.[p - 1]?.value);
  const halfGoals = Number.isFinite(lsH) && Number.isFinite(lsA) ? { home: lsH, away: lsA } : { home: t.home.goals, away: t.away.goals };
  const cum = p === 1 ? halfGoals : cumScore(model, 299999);
  if (p === 2 && (model.minute.phase === "ft" || model.minute.state === "post")) {
    const fh = Number(model.home.score); const fa = Number(model.away.score);
    if (Number.isFinite(fh) && Number.isFinite(fa)) { cum.home = fh; cum.away = fa; }
  }
  const dom = dominance(t, hn, an);
  const title = p === 1 ? "上半場復盤" : "下半場復盤";
  const lines = [];
  lines.push(`本半場比分 ${hn} ${halfGoals.home} : ${halfGoals.away} ${an}${p === 2 ? `，累計 ${cum.home} : ${cum.away}` : ""}。`);
  const rich = commRich(model);
  if (rich) lines.push(`數據：${tallyBits(t, hn, an)}。`);
  const conv = (s) => (s.shots ? `${s.goals}/${s.shots}` : "0/0");
  if (rich) lines.push(`${dom.text}。射門轉換 ${hn} ${conv(t.home)}、${an} ${conv(t.away)}${t.home.sot + t.away.sot ? `；射正率 ${t.home.shots ? Math.round(t.home.sot / t.home.shots * 100) : 0}% vs ${t.away.shots ? Math.round(t.away.sot / t.away.shots * 100) : 0}%` : ""}。`);
  /* 兩隊表現 */
  const teamRead = (side, name) => {
    const s = t[side];
    const o = t[side === "home" ? "away" : "home"];
    const bits = [];
    if (s.goals > 0 && s.sot <= s.goals) bits.push("效率極高，射正幾乎都變成進球");
    else if (s.sot >= 4 && s.goals === 0) bits.push("射正不少但沒有收穫，需要把握度");
    else if (s.shots >= o.shots + 4) bits.push("進攻次數明顯多");
    else if (s.shots <= 2) bits.push("進攻威脅很少");
    if (s.corners >= 4) bits.push(`定位球機會多（${s.corners} 角球）`);
    if (s.fouls >= 8 || s.yellow >= 2) bits.push(`犯規偏多（${s.fouls} 次、${s.yellow} 黃）`);
    if (s.offsides >= 3) bits.push(`越位 ${s.offsides} 次，打身後球被抓`);
    if (o.sot === 0 && o.shots > 0) bits.push("防守把對手射門都擋在門框外");
    return `${name}：${bits.join("；") || "表現平穩，沒有特別突出的數據"}。`;
  };
  if (rich) lines.push(teamRead("home", hn), teamRead("away", an));
  const xr = rich ? [xgRead(hn, t.home), xgRead(an, t.away)].filter(Boolean) : [];
  if (xr.length) lines.push(`xG 解讀：${xr.join("；")}。`);
  if (!rich) {
    const gl = goalsIn(model, (ev) => (ev.period || 1) === p);
    lines.push(gl.length ? `進球：${gl.map(goalLine).join("；")}。` : "這個半場沒有進球。");
    lines.push("ESPN 這場沒有完整的射門、角球等細部數據，所以只整理比分與事件。");
  }
  /* 和上半場比較 */
  if (p === 2 && rich) {
    const first = tallyOf((model.commentary || []).filter((it) => it.period === 1), goalsIn(model, (ev) => (ev.period || 1) === 1));
    const shift = (pressure(t.home) - pressure(t.away)) - (pressure(first.home) - pressure(first.away));
    const shots = `射門比 上半場 ${first.home.shots}:${first.away.shots} → 下半場${status === "live" ? "目前" : ""} ${t.home.shots}:${t.away.shots}`;
    if (Math.abs(shift) >= 4) lines.push(`走勢變化：${shift > 0 ? hn : an}下半場明顯加強（${shots}）。`);
    else lines.push(`走勢變化：上下半場攻守比重差不多（${shots}）。`);
  }
  const ph = playersOf(items, "home").filter((x) => x.score > 0.3).slice(0, 2);
  const pa = playersOf(items, "away").filter((x) => x.score > 0.3).slice(0, 2);
  const players = [];
  if (ph.length) players.push(`${hn}：${ph.map(playerLine).join("；")}`);
  if (pa.length) players.push(`${an}：${pa.map(playerLine).join("；")}`);
  const spoken = [
    `${p === 1 ? "上半場" : "下半場"}${status === "live" ? "打到現在" : "結束"}，${hn} ${cum.home} 比 ${cum.away} ${an}。`,
    `這個半場射門 ${t.home.shots} 比 ${t.away.shots}、射正 ${t.home.sot} 比 ${t.away.sot}，預期進球 xG ${fx(t.home.xg)} 比 ${fx(t.away.xg)}，${dom.text}。`
  ];
  const star = [...ph, ...pa].sort((a, b) => b.score - a.score)[0];
  if (star) spoken.push(`最亮眼的是 ${playerLine(star)}。`);
  return { id: "h" + p, title, status, lines, players, spoken, tally: t, hasData: items.length > 0 };
}

function ratePlayers(model) {
  const out = [];
  const final = { home: Number(model.home.score), away: Number(model.away.score) };
  for (const side of ["home", "away"]) {
    const opp = side === "home" ? "away" : "home";
    const res = final[side] > final[opp] ? 0.3 : final[side] < final[opp] ? -0.2 : 0;
    const cleanSheet = final[opp] === 0;
    for (const p of model.roster?.[side]?.players || []) {
      const played = p.starter || p.subOn;
      if (!played) continue;
      const s = p.stats || {};
      const gk = /^G/.test(p.posAbbr || "");
      const def = /B|CD|CB|WB|^D$/.test(p.posAbbr || "");
      let score = 6.0 + res;
      score += (s.totalGoals || 0) * 1.1 + (s.goalAssists || 0) * 0.75;
      score += (s.shotsOnTarget || 0) * 0.25 + Math.max(0, (s.totalShots || 0) - (s.shotsOnTarget || 0)) * 0.07;
      score += (s.foulsSuffered || 0) * 0.06 - (s.foulsCommitted || 0) * 0.07;
      score -= (s.yellowCards || 0) * 0.35 + (s.redCards || 0) * 1.6 + (s.ownGoals || 0) * 1.2 + (s.offsides || 0) * 0.05;
      if (gk) score += (s.saves || 0) * 0.3 - (s.goalsConceded || 0) * 0.25 + (cleanSheet ? 0.6 : 0);
      if ((gk || def) && cleanSheet && p.starter) score += 0.4;
      if (!p.starter) score = 6 + (score - 6) * 0.8;
      if (p.subOff) score -= 0.05;
      score = Math.max(3, Math.min(10, score));
      const bits = [];
      if (s.totalGoals) bits.push(`${s.totalGoals} 球`);
      if (s.goalAssists) bits.push(`${s.goalAssists} 助攻`);
      if (s.totalShots) bits.push(`${s.totalShots} 射 ${s.shotsOnTarget || 0} 正`);
      if (gk && s.saves) bits.push(`${s.saves} 撲救`);
      if (s.foulsSuffered >= 2) bits.push(`被犯 ${s.foulsSuffered}`);
      if (s.yellowCards) bits.push("黃牌");
      if (s.redCards) bits.push("紅牌");
      out.push({ side, name: p.name, pos: p.posZh || p.posAbbr, score: Math.round(score * 10) / 10, bits: bits.join("、"), hasStats: Object.keys(s).length > 0 });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function predictionReview(model, saved) {
  if (!saved) return null;
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  const rows = [];
  const res = hs > as ? "home" : hs < as ? "away" : "draw";
  const fav = Object.entries(saved.top || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  const nm = { home: "主勝", draw: "和局", away: "客勝" };
  if (fav) rows.push({ label: "獨贏最可能", pick: nm[fav], actual: nm[res], hit: fav === res });
  if (saved.ah) {
    const fn = saved.ah.side === "home" ? FN.homeAH : FN.awayAH;
    const L = saved.ah.side === "home" ? saved.ah.L : -saved.ah.L;
    const exact = Array.from({ length: hs + 1 }, (_, i) => Array.from({ length: as + 1 }, (_, j) => (i === hs && j === as ? 1 : 0)));
    const d = lineDist(exact, fn, L);
    const hit = d.win + d.halfWin > 0.5 ? true : d.lose + d.halfLose > 0.5 ? false : null;
    rows.push({ label: "讓球", pick: ahWords(saved.ah.side, L), actual: `${hs}-${as}`, hit, push: hit === null });
  }
  if (saved.ou) {
    const tot = hs + as;
    const over = tot > saved.ou.L ? true : tot < saved.ou.L ? false : null;
    const hit = over === null ? null : (saved.ou.side === "over") === over;
    rows.push({ label: "大小球", pick: `${saved.ou.side === "over" ? "大" : "小"} ${trimNum(saved.ou.L)}`, actual: `${tot} 球`, hit, push: hit === null });
  }
  if (saved.btts != null) {
    const yes = hs > 0 && as > 0;
    rows.push({ label: "雙方進球", pick: saved.btts >= 0.5 ? "是" : "否", actual: yes ? "是" : "否", hit: (saved.btts >= 0.5) === yes });
  }
  if (saved.score) rows.push({ label: "最可能比分", pick: saved.score, actual: `${hs}-${as}`, hit: saved.score === `${hs}-${as}` });
  const st = model.stats?.mode === "match" ? model.stats : null;
  if (saved.corners && st && st.home.wonCorners != null) {
    const c = st.home.wonCorners + st.away.wonCorners;
    rows.push({ label: "角球", pick: `預估 ${trimNum(saved.corners.mu)}`, actual: `${c} 角`, hit: Math.abs(c - saved.corners.mu) <= 2 ? true : false, note: "誤差 ±2 內算準" });
  }
  if (saved.cards && st && st.home.yellowCards != null) {
    const c = st.home.yellowCards + st.away.yellowCards;
    rows.push({ label: "黃牌", pick: `預估 ${trimNum(saved.cards.mu)}`, actual: `${c} 張`, hit: Math.abs(c - saved.cards.mu) <= 1.5 ? true : false, note: "誤差 ±1.5 內算準" });
  }
  /* CLV：首次存檔的價格 vs 收盤價（參考 TheRundown 的收盤賠率價值） */
  const clv = [];
  const b = model.odds;
  for (const p of saved.first?.best || []) {
    const [grp, side] = String(p.key || "").split(".");
    const g = grp === "ml" ? b?.moneyline?.[side] : grp === "ah" ? b?.spread?.[side] : grp === "ou" ? b?.total?.[side] : null;
    const close = g?.close || g?.pre;
    if (!close || !p.dec) continue;
    clv.push({ label: `${p.market}｜${p.label}`, took: p.dec, close: close.decimal, v: p.dec / close.decimal - 1 });
  }
  const hits = rows.filter((r) => r.hit === true).length;
  const judged = rows.filter((r) => r.hit !== null).length;
  return { rows, hits, judged, clv, xg: `賽前預期進球 ${trimNum(saved.lh)} : ${trimNum(saved.la)}，實際 ${hs} : ${as}` };
}

function fullRecap(model) {
  const hn = model.home.name;
  const an = model.away.name;
  const st = model.stats?.mode === "match" ? model.stats : null;
  const lines = [];
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const ht = [model.home.linescores?.[0]?.displayValue, model.away.linescores?.[0]?.displayValue];
  lines.push(`終場 ${hn} ${hs} : ${as} ${an}${ht[0] != null && ht[1] != null ? `（半場 ${ht[0]}:${ht[1]}）` : ""}。${hs === as ? "雙方握手言和。" : `${hs > as ? hn : an}拿下勝利。`}`);
  const v = (side, key) => (st ? st[side][key] : null);
  if (st) {
    const k = (key, lbl, f = (x) => trimNum(x)) => (v("home", key) != null && v("away", key) != null ? `${lbl} ${f(v("home", key))}:${f(v("away", key))}` : "");
    lines.push(`全場數據：${[k("possessionPct", "控球", (x) => trimNum(x) + "%"), k("totalShots", "射門"), k("shotsOnTarget", "射正"), k("wonCorners", "角球"), k("totalPasses", "傳球"), k("passPct", "傳球成功率", (x) => trimNum(x) + "%"), k("foulsCommitted", "犯規"), k("yellowCards", "黃牌"), k("saves", "撲救")].filter(Boolean).join("、")}。`);
    const read = (side, name, g, og) => {
      const opp = side === "home" ? "away" : "home";
      const bits = [];
      const sh = v(side, "totalShots"); const so = v(side, "shotsOnTarget"); const pos = v(side, "possessionPct");
      if (pos != null) bits.push(pos >= 58 ? `控球主導（${trimNum(pos)}%）` : pos <= 42 ? `讓出球權打反擊（控球 ${trimNum(pos)}%）` : "控球五五波");
      if (sh != null && so != null) {
        if (g >= 2 && so <= g + 1) bits.push("把握度極高");
        else if (so >= 5 && g <= 1) bits.push(`射正 ${so} 次只進 ${g} 球，終結能力不足`);
        else if (sh <= 6) bits.push(`全場只有 ${sh} 次射門，進攻偏弱`);
        else bits.push(`射門 ${sh}、射正 ${so}`);
      }
      const saves = v(side, "saves");
      if (saves >= 4) bits.push(`門將撲救 ${saves} 次是關鍵`);
      if (og === 0) bits.push("零封對手");
      const tk = v(side, "effectiveTackles"); const it = v(side, "interceptions");
      if (tk != null && it != null && tk + it >= v(opp, "effectiveTackles") + v(opp, "interceptions") + 8) bits.push(`防守端搶斷＋攔截 ${tk + it} 次，壓迫積極`);
      if ((v(side, "redCards") || 0) > 0) bits.push("吃到紅牌影響戰局");
      return `${name}：${bits.join("；")}。`;
    };
    lines.push(read("home", hn, hs, as), read("away", an, as, hs));
  } else {
    lines.push("ESPN 這場沒有完整技術統計，數據以文字轉播計數為主。");
  }
  const h1 = tallyOf((model.commentary || []).filter((it) => it.period === 1), []);
  const h2 = tallyOf((model.commentary || []).filter((it) => it.period === 2), []);
  if (commRich(model)) {
    const all = tallyOf(model.commentary || [], []);
    all.home.goals = Number.isFinite(hs) ? hs : 0;
    all.away.goals = Number.isFinite(as) ? as : 0;
    lines.push(`預期進球 xG（看板依射門位置估算）：${hn} ${fx(all.home.xg)} : ${fx(all.away.xg)} ${an}。${all.home.xg - all.away.xg >= 0.8 ? `從機會質量看${hn}更該贏。` : all.away.xg - all.home.xg >= 0.8 ? `從機會質量看${an}更該贏。` : "雙方機會質量接近。"}`);
    const xr = [xgRead(hn, all.home), xgRead(an, all.away)].filter(Boolean);
    if (xr.length) lines.push(`xG 解讀：${xr.join("；")}。`);
    const shift = (pressure(h2.home) - pressure(h2.away)) - (pressure(h1.home) - pressure(h1.away));
    lines.push(`上下半場對比：射門上半 ${h1.home.shots}:${h1.away.shots}、下半 ${h2.home.shots}:${h2.away.shots}。${Math.abs(shift) >= 4 ? `${shift > 0 ? hn : an}下半場扭轉攻勢。` : "整場節奏一致。"}`);
  }
  const rated = ratePlayers(model).filter((p) => p.hasStats);
  let mvp = null;
  let players = [];
  if (rated.length) {
    mvp = rated[0];
    const top = (side) => rated.filter((p) => p.side === side).slice(0, 3);
    const low = rated.filter((p) => p.score < 5.6).slice(-2);
    players = [
      ...top("home").map((p) => ({ team: hn, ...p })),
      ...top("away").map((p) => ({ team: an, ...p }))
    ];
    if (low.length) lines.push(`表現偏低：${low.map((p) => `${p.name}（${p.side === "home" ? hn : an}，${p.score}${p.bits ? "，" + p.bits : ""}）`).join("；")}。`);
  } else {
    const ph = playersOf(model.commentary || [], "home").slice(0, 3);
    const pa = playersOf(model.commentary || [], "away").slice(0, 3);
    players = [...ph.map((p) => ({ team: hn, name: p.name, score: null, bits: playerLine(p).split("：")[1] })), ...pa.map((p) => ({ team: an, name: p.name, score: null, bits: playerLine(p).split("：")[1] }))];
  }
  const review = predictionReview(model, loadPrediction(model.id));
  const spoken = [
    `全場結束，${hn} ${hs} 比 ${as} ${an}。`,
    st ? `控球 ${trimNum(v("home", "possessionPct") ?? 0)} 比 ${trimNum(v("away", "possessionPct") ?? 0)}，射門 ${trimNum(v("home", "totalShots") ?? 0)} 比 ${trimNum(v("away", "totalShots") ?? 0)}，射正 ${trimNum(v("home", "shotsOnTarget") ?? 0)} 比 ${trimNum(v("away", "shotsOnTarget") ?? 0)}。` : "",
    mvp ? `本場看板評分最高的是 ${mvp.name}（${mvp.side === "home" ? hn : an}），${mvp.score} 分${mvp.bits ? "，" + mvp.bits : ""}。` : ""
  ].filter(Boolean);
  return { lines, players, mvp, review, spoken };
}

/* ---------- 畫面 ---------- */

function predTable(head, rows) {
  return h("div", { class: "ptable-wrap" }, h("table", { class: "ptable" },
    h("tr", null, head.map((x) => h("th", null, ui(x)))),
    rows.map((r) => h("tr", { class: r.cls || null }, r.cells.map((c) => h("td", { class: c?.cls || null }, c?.node ?? ui(String(c ?? "–"))))))
  ));
}

function evCell(ev) {
  if (ev == null) return { node: "–" };
  return { node: evText(ev), cls: ev >= 0.02 ? "pos" : ev <= -0.04 ? "neg" : "" };
}

function marketCard(mk, model) {
  const card = h("article", { class: "cp pmk" }, h("h3", null, ui(mk.title)), h("p", { class: "lean" }, ui(mk.lean)));
  if (mk.id === "ml") {
    card.append(predTable(["選項", "模型機率", "合理賠率", "ESPN 賠率", "期望值"], mk.rows.map((r) => ({
      cells: [r.label, pct(r.p), fmtOdd(r.fair), fmtOdd(r.dec), evCell(r.ev)]
    }))));
  } else if (mk.id === "ah") {
    const rows = [];
    for (const r of mk.ahRows) {
      for (const s of [r.home, r.away]) rows.push({ cls: r.isMarket ? "mk" : null, cells: [s.label + (r.isMarket ? "（ESPN 盤）" : ""), pct(s.eff), fmtOdd(s.fair), fmtOdd(s.dec), evCell(s.ev)] });
    }
    card.append(predTable(["讓球", "贏盤機率", "合理賠率", "ESPN 賠率", "期望值"], rows));
  } else if (mk.id === "ou") {
    const rows = [];
    for (const r of mk.ouRows) for (const s of [r.over, r.under]) rows.push({ cls: r.isMarket ? "mk" : null, cells: [s.label + (r.isMarket ? "（ESPN 盤）" : ""), pct(s.eff), fmtOdd(s.fair), fmtOdd(s.dec), evCell(s.ev)] });
    card.append(predTable(["大小", "機率", "合理賠率", "ESPN 賠率", "期望值"], rows));
  } else if (mk.id === "btts") {
    card.append(predTable(["項目", "機率", "合理賠率"], [
      { cells: ["雙方進球：是", pct(mk.btts), fmtOdd(fairOf(mk.btts))] },
      { cells: ["雙方進球：否", pct(1 - mk.btts), fmtOdd(fairOf(1 - mk.btts))] },
      ...["0–1 球", "2–3 球", "4–6 球", "7 球以上"].map((lbl, i) => ({ cells: [`總進球 ${lbl}`, pct(mk.totals[i]), fmtOdd(fairOf(mk.totals[i]))] }))
    ]));
    card.append(h("p", { class: "faint" }, ui("正確比分前 6：")), h("div", { class: "score-chips" }, mk.scores.map((s) => h("span", { class: "pill" }, `${s.s} · ${pct(s.p)}`))));
  } else if (mk.id === "ht") {
    card.append(predTable(["上半場", "機率", "合理賠率"], [
      { cells: ["半場主隊領先", pct(mk.r1.home), fmtOdd(fairOf(mk.r1.home))] },
      { cells: ["半場和局", pct(mk.r1.draw), fmtOdd(fairOf(mk.r1.draw))] },
      { cells: ["半場客隊領先", pct(mk.r1.away), fmtOdd(fairOf(mk.r1.away))] },
      { cells: ["半場大 0.5", pct(mk.o05), fmtOdd(fairOf(mk.o05))] },
      { cells: ["半場大 1.5", pct(mk.o15), fmtOdd(fairOf(mk.o15))] }
    ]));
  } else if (mk.id === "corners" || mk.id === "cards") {
    const rows = [];
    for (const r of mk.rows) {
      rows.push({ cells: [`大 ${trimNum(r.L)}`, pct(r.over), fmtOdd(fairOf(r.over))] });
      rows.push({ cells: [`小 ${trimNum(r.L)}`, pct(r.under), fmtOdd(fairOf(r.under))] });
    }
    card.append(predTable([mk.id === "corners" ? "角球" : "黃牌", "機率", "合理賠率"], rows));
  }
  card.append(h("p", { class: "faint" }, ui("預測依據：")), h("ul", { class: "bullets" }, mk.reasons.map((x) => h("li", null, ui(x)))));
  void model;
  return card;
}

function predictionBlock(model, pred, opts = {}) {
  const block = h("section", { class: "block pred", id: opts.id || "prediction" },
    h("h2", null, ui(opts.title || "賽前盤口預測")),
    h("p", { class: "odds-note" }, ui("機率由 Poisson 進球模型（兩隊本季與近 5 場攻守）結合 ESPN 盤口反推得出。「合理賠率」= 1 ÷ 機率，平台賠率高於它才對買方有利；「期望值」為每 100 元的長期平均盈虧。只是統計估計，不保證結果；在台灣請透過台灣運彩理性投注。"))
  );
  if (opts.note) block.append(h("p", { class: "faint" }, ui(opts.note)));
  if (!pred) {
    block.append(h("p", { class: "muted" }, ui(opts.loading ? "正在抓兩隊近 5 場的角球、牌、射門與半場比分…" : "預測資料暫時無法取得。")));
    return block;
  }
  const bestBox = h("div", { class: "best" }, h("h3", null, ui("對買方較有利的選項")));
  if (pred.best.length) {
    bestBox.append(h("ol", { class: "best-list" }, pred.best.map((p) => h("li", { class: p.wild ? "wild" : null },
      h("b", null, ui(`${p.market}｜${p.label}`), p.wild ? h("span", { class: "tag-live" }, ui("分歧大・保守")) : p.ev != null ? h("span", { class: "tag-val" }, ui("有價值")) : h("span", { class: "tag-done" }, ui("高機率"))),
      h("span", { class: "best-num" }, ui(p.ev != null
        ? `模型機率 ${pct(p.p)}・ESPN 賠率 ${fmtOdd(p.dec)}・期望值 ${evText(p.ev)}`
        : `模型機率 ${pct(p.p)}・平台賠率需高於 ${fmtOdd(p.fair ? p.fair * 1.03 : null)} 才划算`)),
      h("span", { class: "faint" }, ui("原因：" + p.why)),
      p.against ? h("span", { class: "faint warn" }, ui(`⚠ 與盤口異動方向相反（${p.against}），可以等臨場盤口再決定。`)) : null,
      p.wild ? h("span", { class: "faint warn" }, ui("期望值這麼高通常代表盤口知道模型不知道的事（傷兵、輪換、戰意），建議小注或只做參考。")) : null
    ))));
  } else {
    bestBox.append(h("p", null, ui("目前沒有找到明顯對買方有利的選項，建議觀望。")));
  }
  if (pred.noValue) bestBox.append(h("p", { class: "faint" }, ui("ESPN 三個主盤（獨贏、讓球、大小）以模型計算都沒有正期望值，代表盤口定得很準；上方列出的是機率高、但要自己比對平台賠率的項目。")));
  block.append(bestBox);
  block.append(h("details", { class: "basis", open: true }, h("summary", null, ui("模型依據")), h("ul", { class: "bullets" }, pred.basis.map((x) => h("li", null, ui(x))))));
  for (const mk of pred.markets) block.append(marketCard(mk, model));
  const top = pred.top;
  block.append(scriptBlock([
    `賽前數據模型看，${model.home.name}勝 ${pct(top.home)}、和局 ${pct(top.draw)}、${model.away.name}勝 ${pct(top.away)}。`,
    `預期進球 ${trimNum(pred.lh)} 比 ${trimNum(pred.la)}，總進球大約 ${trimNum(pred.lh + pred.la)} 球。`,
    pred.best[0] ? `如果要挑一個，數據比較支持「${pred.best[0].market} ${pred.best[0].label}」。` : "盤口定得很準，數據沒有明顯的價值選項。"
  ]));
  return block;
}

function recapStatus(status) {
  if (status === "live") return h("span", { class: "tag-live" }, ui("進行中・暫時數據"));
  return h("span", { class: "tag-done" }, ui("已結束"));
}

function recapBlock(model) {
  const block = h("section", { class: "block script-panel", id: "recap" }, h("h2", null, ui("比賽復盤")));
  const minute = model.minute;
  if (minute.phase === "pre") {
    block.append(h("p", null, ui("開賽後，每 15 分鐘、上半場、下半場與全場結束都會自動產生復盤（數據、兩隊表現、球員表現）。")));
    return block;
  }
  const hasComm = commRich(model);
  if (!hasComm) block.append(h("p", { class: "faint" }, ui("這場 ESPN 沒有完整文字轉播，分段數據只能用進球、牌與換人；全場數據等終場技術統計。")));
  const nav = h("div", { class: "chips recap-nav" });
  block.append(nav);
  const ft = minute.phase === "ft" || minute.state === "post";
  if (ft) {
    const full = fullRecap(model);
    const card = h("article", { class: "cp recap-card full", id: "recap-ft" }, h("h3", null, ui("全場整體復盤"), " ", recapStatus("done")));
    card.append(h("ul", { class: "bullets" }, full.lines.map((x) => h("li", null, ui(x)))));
    if (full.players.length) {
      card.append(h("p", { class: "faint" }, ui("球員表現（看板依 ESPN 球員數據自算，滿分 10，非官方評分）：")));
      const byTeam = [model.home.name, model.away.name].map((team) => ({ team, list: full.players.filter((p) => p.team === team) })).filter((g) => g.list.length);
      for (const g of byTeam) {
        card.append(h("p", { class: "rate-team" }, ui(g.team)));
        card.append(h("ul", { class: "rating-list" }, g.list.map((p) => h("li", { class: full.mvp && p.name === full.mvp.name ? "mvp" : null },
          h("span", { class: "rate" }, p.score == null ? "–" : String(p.score)),
          h("span", { class: "who" }, h("b", null, p.name), full.mvp && p.name === full.mvp.name ? h("span", { class: "tag-val" }, "MVP") : null, p.pos ? h("span", { class: "faint" }, ` ${ui(p.pos)}`) : null),
          h("span", { class: "faint stat-line" }, ui(p.bits || "–"))
        ))));
      }
    }
    if (full.review) {
      card.append(h("p", { class: "faint" }, ui(`賽前預測對照：${full.review.xg}。命中 ${full.review.hits}/${full.review.judged}。`)));
      card.append(predTable(["項目", "賽前預測", "實際", "結果"], full.review.rows.map((r) => ({
        cells: [r.label, r.pick, r.actual, { node: r.push ? "走水" : r.hit ? "✓ 命中" : "✗ 未中", cls: r.push ? "" : r.hit ? "pos" : "neg" }]
      }))));
      if (full.review.clv.length) {
        card.append(h("p", { class: "faint" }, ui("收盤賠率價值 CLV（首次存檔時的賠率 ÷ 收盤賠率 − 1；長期為正代表你比市場早一步拿到好價格）：")));
        card.append(predTable(["選項", "存檔賠率", "收盤賠率", "CLV"], full.review.clv.map((c) => ({
          cells: [c.label, fmtOdd(c.took), fmtOdd(c.close), { node: evText(c.v), cls: c.v > 0.005 ? "pos" : c.v < -0.005 ? "neg" : "" }]
        }))));
      }
    } else {
      card.append(h("p", { class: "faint" }, ui("這個瀏覽器沒有這場的賽前預測存檔（要在開賽前打開過這場），所以不做預測對照。")));
    }
    card.append(anchorBlocks(anchorFull(model, full)));
    {
      const hs = Number(model.home.score) || 0;
      const as = Number(model.away.score) || 0;
      const h1 = [Number(model.home.linescores?.[0]?.displayValue), Number(model.away.linescores?.[0]?.displayValue)];
      const flip = Number.isFinite(h1[0]) && Number.isFinite(h1[1]) && h1[0] !== h1[1] && Math.sign(h1[0] - h1[1]) !== Math.sign(hs - as);
      const allT = tallyOf(model.commentary || [], []);
      allT.home.goals = hs; allT.away.goals = as;
      card.append(banterBlock(banter(model, {
        kind: "full", salt: "ft", t: allT, rich: commRich(model),
        goals: [], cards: (model.events || []).filter((ev) => ev.kind === "red"),
        subs: [], score: { home: hs, away: as }, late: false,
        comeback: flip ? `半場 ${h1[0]}:${h1[1]}，終場 ${hs}:${as}。` : ""
      })));
    }
    block.append(card);
    nav.append(h("a", { class: "chip", href: "#recap-ft" }, ui("全場")));
  }
  const halves = [2, 1].map((p) => ({ p, status: halfState(p, minute) })).filter((x) => x.status !== "todo");
  for (const { p, status } of halves) {
    const r = halfRecap(model, p, status);
    const card = h("article", { class: "cp recap-card", id: "recap-h" + p }, h("h3", null, ui(r.title), " ", recapStatus(status)));
    card.append(h("ul", { class: "bullets" }, r.lines.map((x) => h("li", null, ui(x)))));
    if (r.players.length) card.append(h("p", { class: "faint" }, ui("球員表現：")), h("ul", { class: "bullets" }, r.players.map((x) => h("li", null, ui(x)))));
    card.append(anchorBlocks(anchorHalf(model, p, status, r.tally)));
    card.append(banterBlock(banter(model, {
      kind: "half", salt: "h" + p, t: r.tally, rich: commRich(model),
      goals: goalsIn(model, (ev) => (ev.period || 1) === p),
      cards: (model.events || []).filter((ev) => (ev.kind === "yellow" || ev.kind === "red") && (ev.period || 1) === p),
      subs: (model.events || []).filter((ev) => ev.kind === "sub" && ev.subOn && (ev.period || 1) === p),
      score: p === 1 ? cumScore(model, 199999) : { home: Number(model.home.score) || 0, away: Number(model.away.score) || 0 },
      late: p === 2
    })));
    block.append(card);
    nav.append(h("a", { class: "chip", href: "#recap-h" + p }, ui(p === 1 ? "上半場" : "下半場")));
  }
  const segs = SEGMENTS.map((seg) => ({ seg, status: segState(seg, minute) })).filter((x) => x.status !== "todo").reverse();
  if (segs.length) {
    const wrap = h("details", { class: "segs", id: "recap-segs", open: !ft });
    wrap.append(h("summary", null, ui(`每 15 分鐘小復盤（${segs.length} 段）`)));
    for (const { seg, status } of segs) {
      const r = segmentRecap(model, seg, status);
      const card = h("article", { class: "cp recap-card seg" }, h("h3", null, ui(r.title), " ", recapStatus(status)));
      card.append(h("p", { class: "fact" }, ui(r.scoreText)));
      if (hasComm) card.append(h("p", { class: "faint" }, ui(r.bits)));
      card.append(h("ul", { class: "bullets" }, r.lines.map((x) => h("li", null, ui(x)))));
      card.append(anchorBlocks(anchorSegment(model, seg, status, r)));
      card.append(banterBlock(banter(model, {
        kind: "seg", salt: seg.id, t: r.tally, rich: r.hasData,
        goals: goalsIn(model, (ev) => inSeg(ev, seg)),
        cards: (model.events || []).filter((ev) => (ev.kind === "yellow" || ev.kind === "red") && inSeg(ev, seg)),
        subs: (model.events || []).filter((ev) => ev.kind === "sub" && ev.subOn && inSeg(ev, seg)),
        score: cumScore(model, seg.p * 100000 + Math.min(seg.to, 200) * 100 + 99),
        late: seg.id === "s5" || seg.id === "s6"
      })));
      wrap.append(card);
    }
    block.append(wrap);
    nav.append(h("a", { class: "chip", href: "#recap-segs" }, ui("15 分鐘")));
  }
  return block;
}

/* ---------- 外部資料站（這些網站不開放資料給其他網頁讀取，所以用搜尋連結直達） ---------- */

function linksBlock(model) {
  const en = `${model.home.rawName} vs ${model.away.rawName}`;
  const zh = `${model.home.name} ${model.away.name}`;
  const g = (q) => "https://www.google.com/search?q=" + encodeURIComponent(q);
  const big5 = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1"].includes(model.leagueSlug);
  const groups = [
    ["亞洲盤口", [
      ["球探體育", "百家歐亞賠率即時比較、盤口歷史變化", g(`球探體育 ${zh} 亞盤`)],
      ["捷報比分", "比分＋亞盤歐賠＋資料庫", g(`捷報比分 ${zh}`)]
    ]],
    ["歐美賠率比較", [
      ["Oddschecker", "各家博彩公司同一盤口報價", g(`site:oddschecker.com ${en}`)],
      ["Action Network", "免費比價與最佳盤口", g(`site:actionnetwork.com ${en} odds`)]
    ]],
    ["球隊與球員分析", [
      ["Sofascore", "即時視圖、熱圖、球員評分", g(`site:sofascore.com ${en}`)],
      ["FotMob", "輕量比分、陣容、隊訊", g(`site:fotmob.com ${en}`)],
      ["WhoScored", "球員評分、位置熱圖", g(`site:whoscored.com ${en}`)],
      ["FootyStats", "角球、牌數等細節統計", g(`site:footystats.org ${en}`)],
      ...(big5 ? [["Understat", "五大聯賽 xG", g(`site:understat.com ${model.home.rawName}`)]] : []),
      ["FBref", "歷史賽季與基礎數據", g(`site:fbref.com ${model.home.rawName}`)]
    ]]
  ];
  const block = h("section", { class: "block", id: "links" }, h("h2", null, ui("外部資料站")));
  block.append(h("p", { class: "faint" }, ui("這些網站不開放資料給其他網頁直接讀取，看板沒辦法把它們的數字抓進來；點下去會用 Google 搜尋直達本場頁面，方便交叉比對。")));
  for (const [title, list] of groups) {
    block.append(h("p", { class: "rate-team" }, ui(title)));
    block.append(h("div", { class: "link-grid" }, list.map(([name, desc, href]) => h("a", { class: "ext", href, target: "_blank", rel: "noopener noreferrer" },
      h("b", null, name), h("span", { class: "faint" }, ui(desc))
    ))));
  }
  return block;
}

/* ---------- 主播口播稿：短版（約 30 秒）＋長版（約 60–90 秒） ---------- */

function pickVar(model, salt, list) {
  let n = 0;
  for (const ch of String(model.id) + salt) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return list[n % list.length];
}

function goalLine(g) {
  const who = g.scorer || g.teamName;
  const how = g.style ? `，${g.style}` : "";
  const ast = g.assist ? `，${g.assist} 助攻` : "";
  return `${g.minuteLabel} ${who}${g.scorer ? `（${g.teamName}）` : ""}破門${how}${ast}`;
}

function scoreSay(model, s) {
  const hn = model.home.name;
  const an = model.away.name;
  if (s.home === s.away) return `${hn} ${s.home} 比 ${s.away} 和 ${an}`;
  return s.home > s.away ? `${hn} ${s.home} 比 ${s.away} 領先 ${an}` : `${an} ${s.away} 比 ${s.home} 領先 ${hn}`;
}

function cardsOn(model, pred) {
  return (model.events || []).filter((ev) => ev.kind === "yellow" && pred(ev)).map((ev) => `${ev.playerNames[0] || ""}（${ev.teamName}）`).filter((x) => !x.startsWith("（"));
}

function lookAhead(model, score, phase) {
  const hn = model.home.name;
  const an = model.away.name;
  const diff = score.home - score.away;
  const trail = diff > 0 ? an : diff < 0 ? hn : "";
  const lead = diff > 0 ? hn : diff < 0 ? an : "";
  if (phase === "ht") {
    if (!diff) return pickVar(model, "ht0", [`下半場關鍵在誰先打破僵局，第一個進球很可能決定走勢。`, `半場還是平手，下半場換人調整會是勝負手，請留意兩隊教練的第一張換人牌。`]);
    if (Math.abs(diff) === 1) return `${trail}下半場勢必壓上找扳平球，${lead}可以利用對手身後空檔打反擊，這段攻守轉換會很精彩。`;
    return `${lead}已經握有 ${Math.abs(diff)} 球優勢，下半場看${trail}能不能先追回一球把比賽拉回懸念。`;
  }
  if (phase === "late") {
    if (!diff) return `比賽進入最後階段還是平手，任何一次定位球都可能是致勝機會。`;
    return `${trail}剩下時間不多，接下來會把人往前場堆，${lead}要守住這個比分。`;
  }
  if (!diff) return `下一段看哪一隊先把握機會，比分還在原點。`;
  return `${trail}需要回應，下一段的壓迫強度值得注意。`;
}

function anchorSegment(model, seg, status, r) {
  const hn = model.home.name;
  const an = model.away.name;
  const t = r.tally;
  const hasComm = r.hasData;
  const endSort = seg.p * 100000 + Math.min(seg.to, 200) * 100 + 99;
  const score = cumScore(model, endSort);
  const goals = goalsIn(model, (ev) => inSeg(ev, seg));
  const idx = SEGMENTS.indexOf(seg);
  const prev = idx > 0 && SEGMENTS[idx - 1].p === seg.p ? tallyOf((model.commentary || []).filter((it) => inSeg(it, SEGMENTS[idx - 1])), []) : null;
  const dom = dominance(t, hn, an);
  const open = status === "live"
    ? `${seg.title}打到現在，${scoreSay(model, score)}。`
    : pickVar(model, seg.id, [`${seg.title}結束，${scoreSay(model, score)}。`, `來看${seg.title}這一段，打完${scoreSay(model, score)}。`, `${seg.title}告一段落，目前${scoreSay(model, score)}。`]);
  const long = [open];
  if (goals.length) long.push(`這段的進球：${goals.map(goalLine).join("；")}。`);
  if (hasComm) {
    long.push(`數據上，射門 ${t.home.shots} 比 ${t.away.shots}，射正 ${t.home.sot} 比 ${t.away.sot}，角球 ${t.home.corners} 比 ${t.away.corners}，預期進球 xG ${fx(t.home.xg)} 比 ${fx(t.away.xg)}。`);
    long.push(`${dom.text}${prev ? (pressure(t.home) + pressure(t.away) > pressure(prev.home) + pressure(prev.away) + 3 ? "，節奏比上一段明顯加快" : pressure(t.home) + pressure(t.away) + 3 < pressure(prev.home) + pressure(prev.away) ? "，節奏比上一段慢下來" : "") : ""}。`);
    if (!goals.length && Math.max(t.home.xg, t.away.xg) >= 0.5) long.push(`${t.home.xg > t.away.xg ? hn : an}這段製造了不錯的機會但沒能破門，進球可能只是時間問題。`);
  }
  const cards = (model.events || []).filter((ev) => (ev.kind === "yellow" || ev.kind === "red") && inSeg(ev, seg));
  if (cards.length) long.push(`紀律方面，${cards.map((ev) => `${ev.minuteLabel} ${ev.playerNames[0] || ev.teamName}${ev.kind === "red" ? "被直接罰下" : "吃到黃牌"}`).join("、")}。`);
  const subs = (model.events || []).filter((ev) => ev.kind === "sub" && ev.subOn && inSeg(ev, seg));
  if (subs.length) long.push(`換人調整：${subs.map((ev) => `${ev.teamName}換上 ${ev.subOn}、換下 ${ev.subOff}`).join("；")}。`);
  const items = (model.commentary || []).filter((it) => inSeg(it, seg));
  const star = [...playersOf(items, "home"), ...playersOf(items, "away")].filter((p) => p.score > 0.5).sort((a, b) => b.score - a.score)[0];
  if (star) long.push(`這段最搶眼的是 ${star.name}，${playerLine(star).split("：")[1]}。`);
  if (!hasComm && !goals.length && !cards.length) long.push("這段 ESPN 沒有細部數據，場面上沒有進球或紅黃牌。");
  long.push(lookAhead(model, score, seg.id === "s6" || seg.id === "s5" ? "late" : seg.id === "s3" ? "ht" : "mid"));
  const short = [open, goals.length ? `關鍵是${goals.map(goalLine).join("、")}。` : hasComm ? `射門 ${t.home.shots} 比 ${t.away.shots}，${dom.text}。` : "", long[long.length - 1]].filter(Boolean);
  return { short, long };
}

function anchorHalf(model, p, status, t) {
  const hn = model.home.name;
  const an = model.away.name;
  const hasComm = commRich(model);
  const ft = model.minute.phase === "ft" || model.minute.state === "post";
  const cum = p === 1
    ? { home: Number(model.home.linescores?.[0]?.displayValue ?? 0) || cumScore(model, 199999).home, away: Number(model.away.linescores?.[0]?.displayValue ?? 0) || cumScore(model, 199999).away }
    : (ft ? { home: Number(model.home.score) || 0, away: Number(model.away.score) || 0 } : cumScore(model, 299999));
  const goals = goalsIn(model, (ev) => (ev.period || 1) === p);
  const long = [];
  long.push(status === "live"
    ? `${p === 1 ? "上半場" : "下半場"}打到現在，${scoreSay(model, cum)}。`
    : p === 1 ? pickVar(model, "h1", [`半場哨音響起，${scoreSay(model, cum)}。`, `上半場結束，${scoreSay(model, cum)}，我們來整理這 45 分鐘。`]) : `${ft ? "下半場打完" : "下半場"}，${scoreSay(model, cum)}。`);
  if (goals.length) long.push(`進球回顧：${goals.map(goalLine).join("；")}。`);
  else long.push(`這個半場沒有進球。`);
  if (hasComm) {
    long.push(`技術統計，射門 ${t.home.shots} 比 ${t.away.shots}，射正 ${t.home.sot} 比 ${t.away.sot}，角球 ${t.home.corners} 比 ${t.away.corners}，預期進球 xG ${fx(t.home.xg)} 比 ${fx(t.away.xg)}。`);
    const st = model.stats?.mode === "match" ? model.stats : null;
    if (p === 1 && st && st.home.possessionPct != null && status !== "live") long.push(`控球率 ${trimNum(st.home.possessionPct)}% 對 ${trimNum(st.away.possessionPct)}%${st.home.passPct != null ? `，傳球成功率 ${trimNum(st.home.passPct)}% 對 ${trimNum(st.away.passPct)}%` : ""}。`);
    const xr = [xgRead(hn, t.home), xgRead(an, t.away)].filter(Boolean);
    if (xr.length) long.push(`${xr.join("；")}。`);
    long.push(`${dominance(t, hn, an).text}。`);
  }
  const items = (model.commentary || []).filter((it) => it.period === p);
  const tops = [...playersOf(items, "home").slice(0, 1).map((x) => ({ ...x, team: hn })), ...playersOf(items, "away").slice(0, 1).map((x) => ({ ...x, team: an }))].filter((x) => x.score > 0.5);
  if (tops.length) long.push(`球員方面，${tops.map((x) => `${x.team}的 ${x.name}（${playerLine(x).split("：")[1]}）`).join("，")}表現最突出。`);
  const yel = cardsOn(model, (ev) => (ev.period || 1) <= p);
  if (p === 1 && yel.length) long.push(`要注意已經背著黃牌的球員：${yel.join("、")}，下半場防守動作會比較保守。`);
  const saved = loadPrediction(model.id);
  if (saved && p === 1) {
    const pace = (cum.home + cum.away) * 2;
    long.push(`對照賽前預測，模型預估全場約 ${trimNum(saved.lh + saved.la)} 球，目前半場進球的步調換算全場大約 ${pace} 球，${pace > saved.lh + saved.la + 0.8 ? "比預期更開放" : pace < saved.lh + saved.la - 0.8 ? "比預期更保守" : "大致符合預期"}。`);
  }
  if (p === 1) long.push(lookAhead(model, cum, "ht"));
  else if (!ft) long.push(lookAhead(model, cum, "late"));
  const short = [long[0], goals.length ? `進球：${goals.map(goalLine).join("、")}。` : "", hasComm ? `射門 ${t.home.shots} 比 ${t.away.shots}，xG ${fx(t.home.xg)} 比 ${fx(t.away.xg)}。` : "", p === 1 ? lookAhead(model, cum, "ht") : ""].filter(Boolean);
  return { short, long };
}

function settleLine(model) {
  const b = model.odds;
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  if (!b || !Number.isFinite(hs) || !Number.isFinite(as)) return [];
  const out = [];
  const q = (g) => g?.close || g?.pre || g?.open || null;
  const ah = q(b.spread.home);
  if (ah?.line != null) {
    const exact = Array.from({ length: hs + 1 }, (_, i) => Array.from({ length: as + 1 }, (_, j) => (i === hs && j === as ? 1 : 0)));
    const d = lineDist(exact, FN.homeAH, ah.line);
    const res = d.win ? "主隊贏盤" : d.halfWin ? "主隊贏半" : d.push ? "走水" : d.halfLose ? "主隊輸半" : "客隊贏盤";
    out.push(`讓球盤（${ahWords("home", ah.line)}）結果：${res}`);
  }
  const ou = q(b.total.over);
  if (ou?.line != null) {
    const tot = hs + as;
    out.push(`大小 ${num2(ou.line)}：全場 ${tot} 球，${tot > ou.line ? "開大" : tot < ou.line ? "開小" : "走水"}`);
  }
  out.push(`雙方進球：${hs > 0 && as > 0 ? "是" : "否"}`);
  return out;
}

function anchorFull(model, full) {
  const hn = model.home.name;
  const an = model.away.name;
  const hs = Number(model.home.score) || 0;
  const as = Number(model.away.score) || 0;
  const st = model.stats?.mode === "match" ? model.stats : null;
  const winner = hs > as ? hn : as > hs ? an : "";
  const loser = hs > as ? an : as > hs ? hn : "";
  const long = [];
  long.push(winner
    ? pickVar(model, "ft", [`全場比賽結束，${winner} ${Math.max(hs, as)} 比 ${Math.min(hs, as)} 擊敗 ${loser}！`, `終場哨響，${winner}以 ${Math.max(hs, as)} 比 ${Math.min(hs, as)} 拿下 ${loser}。`])
    : `全場比賽結束，${hn} 和 ${an} ${hs} 比 ${as} 握手言和。`);
  const goals = goalsIn(model, () => true);
  if (goals.length) long.push(`進球回顧：${goals.map(goalLine).join("；")}。`);
  const ht = [model.home.linescores?.[0]?.displayValue, model.away.linescores?.[0]?.displayValue];
  if (ht[0] != null && ht[1] != null) {
    const h1 = Number(ht[0]) - Number(ht[1]);
    const fin = hs - as;
    if (h1 === 0 && fin !== 0) long.push(`半場還是 ${ht[0]} 比 ${ht[1]} 平手，${winner}下半場打破僵局，這是本場的勝負關鍵。`);
    else if (h1 !== 0 && Math.sign(h1) !== Math.sign(fin)) long.push(`半場 ${ht[0]} 比 ${ht[1]}，下半場比賽被${fin === 0 ? "追平" : "逆轉"}，這是本場最大的轉折。`);
    else long.push(`半場 ${ht[0]} 比 ${ht[1]}，${winner ? `${winner}一路把優勢保持到終場` : "雙方下半場都沒能打破平衡"}。`);
  }
  if (st) {
    long.push(`全場控球 ${trimNum(st.home.possessionPct ?? 0)}% 對 ${trimNum(st.away.possessionPct ?? 0)}%，射門 ${trimNum(st.home.totalShots ?? 0)} 比 ${trimNum(st.away.totalShots ?? 0)}，射正 ${trimNum(st.home.shotsOnTarget ?? 0)} 比 ${trimNum(st.away.shotsOnTarget ?? 0)}，角球 ${trimNum(st.home.wonCorners ?? 0)} 比 ${trimNum(st.away.wonCorners ?? 0)}。`);
  }
  if (commRich(model)) {
    const all = tallyOf(model.commentary, []);
    long.push(`從預期進球看，xG ${fx(all.home.xg)} 比 ${fx(all.away.xg)}，${all.home.xg - all.away.xg >= 0.8 ? `${hn}的機會質量明顯較好` : all.away.xg - all.home.xg >= 0.8 ? `${an}的機會質量明顯較好` : "兩隊機會質量差不多"}${winner && ((winner === hn && all.away.xg > all.home.xg + 0.5) || (winner === an && all.home.xg > all.away.xg + 0.5)) ? `，${winner}贏在把握度` : ""}。`);
  }
  if (full.mvp) long.push(`本場 MVP 給 ${full.mvp.name}，看板評分 ${full.mvp.score} 分${full.mvp.bits ? `，${full.mvp.bits}` : ""}。`);
  const others = full.players.filter((p) => !full.mvp || p.name !== full.mvp.name).slice(0, 2);
  if (others.length) long.push(`另外 ${others.map((p) => `${p.team}的 ${p.name}${p.bits ? `（${p.bits}）` : ""}`).join("、")}也有亮眼表現。`);
  const reds = (model.events || []).filter((ev) => ev.kind === "red");
  if (reds.length) long.push(`紅牌影響：${reds.map((ev) => `${ev.minuteLabel} ${ev.playerNames[0] || ""}（${ev.teamName}）`).join("、")}被罰下，讓比賽形勢改變。`);
  const settle = settleLine(model);
  if (settle.length) long.push(`盤口結算：${settle.join("；")}。`);
  if (full.review) long.push(`賽前預測對照：命中 ${full.review.hits}/${full.review.judged} 項，${full.review.xg}。`);
  long.push(pickVar(model, "bye", ["以上就是這場比賽的完整復盤，感謝收看，我們下一場見。", "這場比賽就為大家整理到這裡，謝謝收看，下一場再會。"]));
  const short = [long[0], goals.length ? `進球：${goals.map(goalLine).join("、")}。` : "", full.mvp ? `MVP 是 ${full.mvp.name}。` : "", settle.length ? `${settle.slice(0, 2).join("，")}。` : ""].filter(Boolean);
  return { short, long };
}

function anchorBlocks(script) {
  return h("div", { class: "anchor" },
    scriptBlock(script.short, "口播短版（約 30 秒）"),
    h("details", { class: "anchor-long", open: true }, h("summary", null, ui("口播長版（約 60–90 秒）")), scriptBlock(script.long, "完整稿"))
  );
}

/* ---------- 口語補充：專業資訊／輕鬆幽默／嗆辣幹話（依實際數據挑句子） ---------- */

function pickN(model, salt, list, n) {
  const pool = list.filter(Boolean);
  const out = [];
  let k = 0;
  for (const ch of String(model.id) + salt) k = (k * 33 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < pool.length && out.length < n; i += 1) {
    const line = pool[(k + i * 7) % pool.length];
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

function banter(model, ctx) {
  const hn = model.home.name;
  const an = model.away.name;
  const t = ctx.t;
  const rich = ctx.rich && t;
  const goals = ctx.goals || [];
  const cards = ctx.cards || [];
  const subs = ctx.subs || [];
  const s = ctx.score || { home: 0, away: 0 };
  const diff = s.home - s.away;
  const lead = diff > 0 ? hn : diff < 0 ? an : "";
  const trail = diff > 0 ? an : diff < 0 ? hn : "";
  const pro = [];
  const fun = [];
  const spicy = [];
  if (rich) {
    const ph = pressure(t.home);
    const pa = pressure(t.away);
    const top = ph >= pa ? { n: hn, s: t.home, o: t.away } : { n: an, s: t.away, o: t.home };
    if (Math.abs(ph - pa) >= 3) pro.push(`${top.n}射門 ${top.s.shots} 比 ${top.o.shots}、角球 ${top.s.corners} 比 ${top.o.corners}，把比賽重心壓在對方半場，這段主動權很明確。`);
    else pro.push(`兩隊射門 ${t.home.shots} 比 ${t.away.shots}，差距不大，中場拉鋸、陣型間距很緊，誰先出錯誰吃虧。`);
    const bigXg = t.home.xg >= t.away.xg ? { n: hn, x: t.home.xg, g: t.home.goals } : { n: an, x: t.away.xg, g: t.away.goals };
    if (bigXg.x >= 0.3) pro.push(`小科普：xG 是「預期進球」，衡量機會品質。${bigXg.n}這段累積 xG ${fx(bigXg.x)}，意思是同樣的機會平均能換到約 ${fx(bigXg.x)} 球${bigXg.g ? `，實際進了 ${bigXg.g} 球` : "，但還沒兌現"}。`);
    if (t.home.corners + t.away.corners >= 4) pro.push(`角球已經 ${t.home.corners + t.away.corners} 次，定位球是打破僵局最常見的方式之一，接下來的角球值得留意。`);
    if (t.home.offsides + t.away.offsides >= 3) pro.push(`越位 ${t.home.offsides + t.away.offsides} 次，代表有一方一直在打防線身後，後衛線壓得很高。`);
    const misser = t.home.shots - t.home.goals >= 6 ? { n: hn, s: t.home } : t.away.shots - t.away.goals >= 6 ? { n: an, s: t.away } : null;
    if (misser) {
      fun.push(`${misser.n}已經射了 ${misser.s.shots} 腳，球門像是開了結界。`);
      spicy.push(`${misser.n}射 ${misser.s.shots} 腳才進 ${misser.s.goals} 球，這準度靠北到連守門員都想幫他們進。`);
    }
    if (t.home.shots + t.away.shots <= 2 && !goals.length) {
      fun.push("這段射門少到我差點以為在看圍棋直播。");
      spicy.push("這 15 分鐘的節奏慢到我泡麵都泡爛了，雙方能不能有人先射一腳？");
    }
  }
  for (const g of goals.slice(0, 2)) {
    const conceded = g.side === "home" ? an : hn;
    pro.push(`${g.minuteLabel} ${g.scorer || g.teamName}破門${g.assist ? `，${g.assist}助攻` : ""}${g.style ? `（${g.style}）` : ""}，${conceded}這次的防守站位值得賽後檢討。`);
    fun.push(`${g.scorer || g.teamName}這球進得漂亮，今晚宵夜可以點大份的。`);
    spicy.push(`${conceded}的後防剛剛在幹嘛？集體去排隊上廁所嗎？`);
  }
  for (const c of cards.slice(0, 1)) {
    const who = c.playerNames?.[0] || c.teamName;
    if (c.kind === "red") {
      pro.push(`${who}被紅牌罰下，${c.teamName}接下來要以少打多，通常會先犧牲一名攻擊球員補防。`);
      fun.push(`${who}提早下班，今晚可以在休息室吹冷氣看隊友加班。`);
      spicy.push(`${who}這腳下去不吃紅牌才有鬼，鏟人鏟到像在田裡犁地。`);
    } else {
      pro.push(`${who}吃到黃牌，後面的防守動作會比較保守，對手會刻意往他那一側突破。`);
      fun.push(`${who}收到裁判的黃色小卡片，不是生日卡。`);
      spicy.push(`${who}這腳有點衝，再來一張就要直接去洗澡了。`);
    }
  }
  if (subs.length) {
    const sb = subs[0];
    pro.push(`${sb.teamName}換上 ${sb.subOn || "替補"}、換下 ${sb.subOff || "球員"}，這種時間點的換人多半是為了體能或改變進攻節奏。`);
    fun.push(`${sb.subOn || "替補"}熱身熱了半天終於上場，腿應該都熱到可以煎蛋了。`);
  }
  if (lead) {
    if (Math.abs(diff) >= 3) {
      fun.push(`${lead}領先 ${Math.abs(diff)} 球，${trail}的球迷可以先轉台看綜藝了。`);
      spicy.push(`${trail}現在唯一的希望是比賽提早結束，或是球門突然變大。`);
    } else {
      fun.push(`${lead}暫時領先，支持他們的朋友可以先把飲料打開，但不要喝太快。`);
      spicy.push(`${trail}再不醒過來，休息室的吹風機就要被教練拿來吹人了。`);
    }
    if (ctx.late) pro.push(`領先方在最後階段常見的做法是換上防守型球員、放慢節奏、多在角落控球消耗時間，${trail}要更早壓上。`);
  } else if (ctx.kind !== "pre") {
    fun.push("目前平手，兩隊都很有禮貌，誰也不好意思先進球。");
    spicy.push("平手平到我都想下去踢，至少我會射門。");
  }
  if (ctx.comeback) {
    pro.push(`這是一場逆轉，關鍵在下半場的調整：${ctx.comeback}`);
    fun.push("被逆轉的心情，就像外送到門口才發現被別人簽收。");
    spicy.push("前面領先有多爽，現在被翻盤就有多幹。");
  }
  return {
    pro: pickN(model, (ctx.salt || "") + "p", pro, 3),
    fun: pickN(model, (ctx.salt || "") + "f", fun, 3),
    spicy: pickN(model, (ctx.salt || "") + "s", spicy, 2)
  };
}

function banterBlock(b) {
  if (!b || (!b.pro.length && !b.fun.length && !b.spicy.length)) return document.createDocumentFragment();
  const sec = (title, list) => (list.length ? [h("h4", null, ui(title)), ...list.map((x) => h("p", null, ui(x)))] : []);
  const all = [...b.pro, ...b.fun, ...b.spicy].map((x) => speak(x));
  const btn = h("button", { class: "copy" }, ui("全部複製"));
  btn.addEventListener("click", () => copyText(all.join("\n"), btn));
  return h("details", { class: "banter", open: true },
    h("summary", null, ui("口語補充：專業／輕鬆／嗆辣")),
    ...sec("專業資訊（可當分析）", b.pro),
    ...sec("輕鬆幽默", b.fun),
    ...sec("嗆辣幹話（成人時段，自行斟酌）", b.spicy),
    btn
  );
}
