/* 角球歷史模型：抓兩隊近兩年（國家隊）或近兩季（俱樂部）每一場的角球（得／失、上下半場），
   用近期加權、主客場、對手失角，預估本場上半場、下半場、全場與兩隊各自的角球數。 */

const CH_PREFIX = "fb-cor-v2:";
const CH_MAX_GAMES = 20;
const chStore = new Map();

function chRead(id) {
  try { return JSON.parse(localStorage.getItem(CH_PREFIX + id) || "null"); } catch { return null; }
}
function chWrite(id, v) {
  try { localStorage.setItem(CH_PREFIX + id, JSON.stringify(v)); } catch { /* 空間不足就算了 */ }
}

/* 一場比賽的角球：總數取 ESPN 技術統計，上下半場由文字轉播逐筆拆分 */
function cornerSlim(data) {
  const comp = data?.header?.competitions?.[0];
  if (!comp || !comp.status?.type?.completed) return null;
  const cs = comp.competitors || [];
  const out = { date: comp.date, teams: {} };
  for (const t of data.boxscore?.teams || []) {
    const id = String(t.team?.id || "");
    const st = Object.fromEntries((t.statistics || []).map((x) => [x.name, Number(x.displayValue)]));
    out.teams[id] = { c: Number.isFinite(st.wonCorners) ? st.wonCorners : null, shots: st.totalShots || 0, poss: st.possessionPct || 0, name: t.team?.displayName || "" };
  }
  for (const c of cs) {
    const id = String(c.id);
    if (!out.teams[id]) out.teams[id] = { c: null, shots: 0, poss: 0, name: c.team?.displayName || "" };
  }
  const ids = Object.keys(out.teams);
  const real = ids.length === 2 && ids.some((id) => out.teams[id].c || out.teams[id].shots || out.teams[id].poss);
  if (!real) {
    for (const c of cs) if (out.teams[String(c.id)]) { out.teams[String(c.id)].home = c.homeAway === "home"; out.teams[String(c.id)].g = Number(c.score?.value ?? c.score); }
    for (const r of data.rosters || []) { const t = out.teams[String(r.team?.id || "")]; if (t && r.formation) t.form = r.formation; }
    return { ...out, none: true };
  }
  for (const c of cs) {
    const t = out.teams[String(c.id)];
    if (!t) continue;
    t.home = c.homeAway === "home";
    t.g = Number(c.score?.value ?? c.score);
  }
  for (const r of data.rosters || []) {
    const t = out.teams[String(r.team?.id || "")];
    if (t && r.formation) t.form = r.formation;
  }
  /* 文字轉播的角球：「Corner, France. Conceded by …」 */
  const halves = {};
  for (const id of ids) halves[id] = [0, 0];
  let n = 0;
  for (const c of data.commentary || []) {
    const m = /^Corner,\s*([^.]+)\./i.exec(c.text || "");
    if (!m) continue;
    const name = m[1].trim().toLowerCase();
    const id = ids.find((x) => out.teams[x].name.toLowerCase() === name) || ids.find((x) => name.includes(out.teams[x].name.toLowerCase().split(" ")[0]));
    if (!id) continue;
    const min = parseInt(String(c.time?.displayValue || ""), 10);
    const per = c.period?.number || (min > 45 ? 2 : 1);
    halves[id][per >= 2 ? 1 : 0] += 1;
    n += 1;
  }
  const tot = ids.reduce((a, id) => a + (out.teams[id].c || 0), 0);
  if (n && Math.abs(n - tot) <= 1) for (const id of ids) out.teams[id].h = halves[id];
  out.comp = data.header?.league?.name || data.header?.season?.name || "";
  return out;
}

async function chSummary(eventId) {
  const hit = chRead(eventId);
  if (hit) return hit;
  const res = await fetch(`${ALL_API}/summary?event=${eventId}`);
  if (!res.ok) return null;
  const slim = cornerSlim(await res.json());
  if (slim) chWrite(eventId, slim);
  return slim;
}

async function chSchedule(teamId, kickoff, national) {
  const urls = [`${ALL_API}/teams/${teamId}/schedule`];
  if (!national) {
    const y = new Date(kickoff).getUTCFullYear();
    urls.push(`${ALL_API}/teams/${teamId}/schedule?season=${y - 1}`, `${ALL_API}/teams/${teamId}/schedule?season=${y - 2}`);
  }
  const seen = new Map();
  for (const url of urls) {
    try {
      const j = await fetch(url).then((r) => r.json());
      for (const e of j.events || []) {
        const done = e.competitions?.[0]?.status?.type?.completed;
        if (done && new Date(e.date) < new Date(kickoff)) seen.set(String(e.id), { id: String(e.id), date: e.date, name: e.name || "" });
      }
    } catch { /* 下一個 */ }
  }
  return [...seen.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function teamCornerHistory(teamId, kickoff, national) {
  const list = (await chSchedule(teamId, kickoff, national)).slice(0, 34);
  const lim = pLimit(4);
  const games = [];
  const allGames = [];
  await Promise.all(list.map((ev) => lim(async () => {
    try {
      const s = await chSummary(ev.id);
      if (!s || !s.teams[teamId]) return;
      const me = s.teams[teamId];
      const oppId = Object.keys(s.teams).find((x) => x !== teamId);
      const op = s.teams[oppId] || {};
      const base = { id: ev.id, date: s.date, comp: s.comp, home: !!me.home, opp: op.name || "", gf: me.g, ga: op.g, form: me.form || "", poss: s.none ? null : me.poss || null, shots: s.none ? null : me.shots, shotsA: s.none ? null : op.shots };
      allGames.push(base);
      if (s.none || me.c == null || op.c == null) return;
      games.push({ ...base, cf: me.c, ca: op.c, h1f: me.h?.[0], h1a: op.h?.[0], h2f: me.h?.[1], h2a: op.h?.[1] });
    } catch { /* 單場失敗不影響 */ }
  })));
  games.sort((a, b) => new Date(b.date) - new Date(a.date));
  allGames.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { games: games.slice(0, CH_MAX_GAMES), all: allGames, scanned: list.length };
}

/* 近期加權平均：越近的比賽權重越高（每往前一場 ×0.92） */
function wavg(games, f) {
  let s = 0;
  let w = 0;
  games.forEach((g, i) => {
    const v = f(g);
    if (v == null || !Number.isFinite(v)) return;
    const k = Math.pow(0.92, i);
    s += v * k;
    w += k;
  });
  return w ? s / w : null;
}

function teamCornerProfile(hist, atHome) {
  const g = hist.games;
  if (!g.length) return null;
  const venue = g.filter((x) => x.home === atHome);
  const useVenue = venue.length >= 5;
  const base = useVenue ? venue : g;
  const forAll = wavg(g, (x) => x.cf);
  const agAll = wavg(g, (x) => x.ca);
  const forV = wavg(base, (x) => x.cf);
  const agV = wavg(base, (x) => x.ca);
  /* 場地樣本少時往整體平均收斂 */
  const k = useVenue ? 0.6 : 0;
  const halves = g.filter((x) => x.h1f != null && x.h1a != null);
  const h1share = halves.length >= 3
    ? halves.reduce((a, x) => a + x.h1f + x.h1a, 0) / Math.max(1, halves.reduce((a, x) => a + x.cf + x.ca, 0))
    : null;
  const h1for = halves.length >= 3 ? halves.reduce((a, x) => a + x.h1f, 0) / Math.max(1, halves.reduce((a, x) => a + x.cf, 0)) : null;
  return {
    n: g.length, venueN: venue.length,
    cf: forV * k + forAll * (1 - k),
    ca: agV * k + agAll * (1 - k),
    cfAll: forAll, caAll: agAll,
    totalAvg: wavg(g, (x) => x.cf + x.ca),
    over95: g.filter((x) => x.cf + x.ca > 9.5).length / g.length,
    maxGame: g.reduce((a, x) => (x.cf + x.ca > a.cf + a.ca ? x : a), g[0]),
    h1share, h1for, halfN: halves.length,
    games: g
  };
}

/* 角球的變異比 Poisson 大，用負二項分布（變異 ≈ 1.5 × 平均） */
function nbPmf(mu, k, ratio = 1.5) {
  const r = mu / Math.max(0.05, ratio - 1);
  const p = r / (r + mu);
  let lg = 0;
  for (let i = 1; i <= k; i += 1) lg += Math.log((r + i - 1) / i);
  return Math.exp(lg + r * Math.log(p) + k * Math.log(1 - p));
}

function nbOver(mu, line, ratio) {
  let c = 0;
  for (let k = 0; k <= Math.floor(line); k += 1) c += nbPmf(mu, k, ratio);
  return Math.max(0, Math.min(1, 1 - c));
}

function cornerModel(model, H, A) {
  if (!H && !A) return null;
  const LEAGUE_TEAM = 4.9;
  const hFor = H ? H.cf : LEAGUE_TEAM;
  const hAg = H ? H.ca : LEAGUE_TEAM;
  const aFor = A ? A.cf : LEAGUE_TEAM;
  const aAg = A ? A.ca : LEAGUE_TEAM;
  /* 主隊角球 = 主隊自己製造角球的能力 與 客隊放角球的傾向 的平均；樣本少時往聯盟平均收斂 */
  const shrink = (n) => Math.min(1, n / 12);
  const hn = H ? shrink(H.n) : 0;
  const an = A ? shrink(A.n) : 0;
  const muH = ((hFor * hn + LEAGUE_TEAM * (1 - hn)) + (aAg * an + LEAGUE_TEAM * (1 - an))) / 2;
  const muA = ((aFor * an + LEAGUE_TEAM * (1 - an)) + (hAg * hn + LEAGUE_TEAM * (1 - hn))) / 2;
  const mu = muH + muA;
  const shares = [H?.h1share, A?.h1share].filter((x) => x != null);
  const share = shares.length ? Math.max(0.36, Math.min(0.54, shares.reduce((a, b) => a + b, 0) / shares.length)) : 0.45;
  const h1 = mu * share;
  const h2 = mu - h1;
  return { muH, muA, mu, h1, h2, share, shareKnown: shares.length > 0 };
}

async function ensureCornerHist(model) {
  if (chStore.has(model.id)) return;
  chStore.set(model.id, { status: "loading" });
  const national = typeof NATIONAL_LEAGUES !== "undefined" && NATIONAL_LEAGUES.test(model.leagueSlug || "");
  try {
    const [hh, ah] = await Promise.all([
      teamCornerHistory(model.home.id, model.kickoff, national),
      teamCornerHistory(model.away.id, model.kickoff, national)
    ]);
    const H = teamCornerProfile(hh, true);
    const A = teamCornerProfile(ah, false);
    chStore.set(model.id, { status: "ok", H, A, all: { home: hh.all, away: ah.all }, scanned: { home: hh.scanned, away: ah.scanned }, cm: cornerModel(model, H, A) });
  } catch (err) {
    console.error(err);
    chStore.set(model.id, { status: "error" });
  }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function cornerHist(model) {
  const st = chStore.get(model.id);
  if (!st) { ensureCornerHist(model); return null; }
  return st;
}

function chLines(cm) {
  const r = (x) => Math.round(x * 10) / 10;
  const L = (mu) => {
    const base = Math.floor(mu) + 0.5;
    return [base - 1, base, base + 1].filter((x) => x > 0);
  };
  return {
    full: L(cm.mu).map((l) => [l, nbOver(cm.mu, l)]),
    h1: L(cm.h1).map((l) => [l, nbOver(cm.h1, l, 1.4)]),
    h2: L(cm.h2).map((l) => [l, nbOver(cm.h2, l, 1.4)]),
    home: L(cm.muH).map((l) => [l, nbOver(cm.muH, l, 1.4)]),
    away: L(cm.muA).map((l) => [l, nbOver(cm.muA, l, 1.4)]),
    r
  };
}

/* 賽前／賽中都能放的「歷史角球預測」區 */
function cornerHistSection(model) {
  const wrap = h("div", { class: "corner-hist" });
  const st = cornerHist(model);
  const Hn = model.home.name;
  const An = model.away.name;
  wrap.append(h("h3", null, ui("📚 用兩隊歷史資料預估本場角球")));
  if (!st || st.status === "loading") { wrap.append(h("p", { class: "muted" }, ui("正在抓兩隊近兩年每場的角球紀錄（第一次約 10–20 秒，之後會快取）…"))); return wrap; }
  if (st.status !== "ok" || !st.cm) { wrap.append(h("p", { class: "muted" }, ui("ESPN 沒有這兩隊的歷史角球資料，無法用歷史預估。"))); return wrap; }
  const { H, A, cm } = st;
  const lines = chLines(cm);
  const r = lines.r;
  wrap.append(h("div", { class: "pred-head" },
    h("div", null, h("b", null, ui("上半場")), h("span", { class: "big" }, `${r(cm.h1)}`)),
    h("div", null, h("b", null, ui("下半場")), h("span", { class: "big" }, `${r(cm.h2)}`)),
    h("div", null, h("b", null, ui("全場")), h("span", { class: "big" }, `${r(cm.mu)}`)),
    h("div", null, h("b", null, ui(`${Hn}／${An}`)), h("span", { class: "big" }, `${r(cm.muH)}／${r(cm.muA)}`))
  ));
  const tbl = (title, rows) => predTable([title, "大", "小", "合理賠率（大／小）"], rows.map(([l, p]) => ({ cells: [`${trimNum(l)}`, pct(p), pct(1 - p), `${fmtOdd(1 / Math.max(p, 0.01))}／${fmtOdd(1 / Math.max(1 - p, 0.01))}`] })));
  wrap.append(
    h("details", { class: "fold", "data-k": "ch-full", open: true }, h("summary", null, ui("全場角球大小")), tbl("全場", lines.full)),
    h("details", { class: "fold", "data-k": "ch-h1" }, h("summary", null, ui("上半場角球大小")), tbl("上半場", lines.h1)),
    h("details", { class: "fold", "data-k": "ch-h2" }, h("summary", null, ui("下半場角球大小")), tbl("下半場", lines.h2)),
    h("details", { class: "fold", "data-k": "ch-team" }, h("summary", null, ui("兩隊各自角球")), tbl(Hn, lines.home), tbl(An, lines.away))
  );
  /* 依據 */
  const why = [];
  const desc = (P, name, venue) => P
    ? `${name}近 ${P.n} 場有角球資料（近期加權）：每場製造 ${r(P.cfAll)} 角、被對手 ${r(P.caAll)} 角，合計 ${r(P.totalAvg)} 角；${P.venueN >= 5 ? `${venue}場 ${P.venueN} 場另外加權；` : ""}全場超過 9.5 角的比例 ${pct(P.over95)}。`
    : `${name}在 ESPN 找不到有角球資料的比賽，用一般平均（每隊約 4.9 角）代替。`;
  why.push(desc(H, Hn, "主"), desc(A, An, "客"));
  why.push(`本場：${Hn} ${r(cm.muH)} 角（自己製造 × 對手失角的平均），${An} ${r(cm.muA)} 角，合計 ${r(cm.mu)} 角。`);
  why.push(cm.shareKnown ? `上半場佔比用兩隊實際紀錄 ${pct(cm.share)}（文字轉播逐筆拆分），所以上半場 ${r(cm.h1)}、下半場 ${r(cm.h2)}。` : `沒有逐筆資料可拆上下半場，用一般比例：上半場約 45%、下半場 55%（下半場體能下降、落後方壓上，角球通常較多）。`);
  if (H?.maxGame) why.push(`${Hn}近期角球最多的一場：${shortDate(H.maxGame.date)} 對 ${H.maxGame.opp} 合計 ${H.maxGame.cf + H.maxGame.ca} 角。`);
  if (A?.maxGame) why.push(`${An}近期角球最多的一場：${shortDate(A.maxGame.date)} 對 ${A.maxGame.opp} 合計 ${A.maxGame.cf + A.maxGame.ca} 角。`);
  if ((H?.n || 0) < 6 || (A?.n || 0) < 6) why.push("⚠️ 有一隊樣本少於 6 場，預估已往一般平均拉近，信心較低。");
  wrap.append(h("ul", { class: "reasons" }, why.map((x) => h("li", null, ui(x)))));
  /* 明細 */
  for (const [P, name] of [[H, Hn], [A, An]]) {
    if (!P) continue;
    wrap.append(h("details", { class: "fold", "data-k": "ch-g-" + name }, h("summary", null, ui(`${name}：近 ${P.n} 場角球明細`)),
      predTable(["日期", "對手", "得角", "失角", "上半場（得／失）"], P.games.map((g) => ({
        cells: [shortDate(g.date), `${g.home ? "主" : "客"} ${g.opp}`, String(g.cf), String(g.ca), g.h1f != null ? `${g.h1f}／${g.h1a}` : "–"]
      })))));
  }
  wrap.append(scriptBlock([
    `賽前角球看點：${Hn}近期每場製造 ${H ? r(H.cfAll) : "約 5"} 個角球，${An} ${A ? r(A.cfAll) : "約 5"} 個。`,
    `用兩隊歷史資料估，今天上半場大約 ${r(cm.h1)} 角、下半場 ${r(cm.h2)} 角，全場 ${r(cm.mu)} 角左右。`,
    "你覺得今天角球會開大還是開小？大扣 1、小扣 2！"
  ], "口播：角球預測"));
  wrap.append(h("p", { class: "faint" }, ui("資料：ESPN 各場技術統計（角球總數）與文字轉播（上下半場拆分）。國家隊抓近兩年所有比賽，俱樂部抓近兩季；ESPN 沒有技術統計的比賽（部分友誼賽）不列入。")));
  return wrap;
}

/* 賽中：用歷史模型預估「剩下的時間」還會有幾個角球 */
function cornerLiveProjection(model, tot) {
  const st = chStore.get(model.id);
  const cm = st?.cm;
  const m = model.minute || {};
  if (!cm || m.state !== "in") return null;
  const base = m.base || 0;
  let rest;
  if (m.phase === "ht") rest = cm.h2;
  else if ((m.period || 1) === 1) rest = cm.h1 * Math.max(0, 45 - base) / 45 + cm.h2;
  else rest = cm.h2 * Math.max(0, 90 - Math.max(45, base)) / 45;
  return { rest, proj: tot + rest, cm };
}
