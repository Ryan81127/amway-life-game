/* predictionHistory：預測歷史查詢頁（賽程頁 ?view=history）。
   原始預測（ledger 快照）一律不改；這裡只讀快照、補抓 ESPN 終場資料來對帳，
   對帳結果另存一份（fb-hist-v1:），完賽後就不再變動。資料只在這台裝置。 */

const HIST_PREFIX = "fb-hist-v1:";
const HIST_META = "fb-ledger-meta-v1";
const OUTCOME = {
  hit: "命中", miss: "未命中", push: "走盤", halfwin: "半贏", halflose: "半輸", na: "無法判定", pend: "未完賽"
};
const KIND_ZH = {
  "1x2": "勝平負", ht: "半場勝平負", ou: "大小球", "ht-ou": "半場大小", ah: "讓球", "ah-rest": "滾球讓球",
  btts: "雙方進球", score: "比分", next: "下一球", "corners-ou": "角球", "cards-ou": "黃牌"
};
const CAT_ZH = { pre: "賽前", live: "滾球", corner: "角球" };
const histState = { status: "idle", rows: [], matches: [], filters: { league: "all", kind: "all", cat: "all", range: "30" }, loaded: 0, total: 0 };

/* 比賽頁開著的時候順手記下比賽資料（聯賽、隊名、開賽時間），歷史頁才能分類。 */
function histRemember(model) {
  if (!model?.id || !ledgerRead(model.id)) return;
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(HIST_META) || "{}"); } catch { meta = {}; }
  if (meta[model.id]) return;
  meta[model.id] = { league: model.leagueSlug, leagueName: model.leagueName, home: model.home.name, away: model.away.name, kickoff: model.kickoff };
  try { localStorage.setItem(HIST_META, JSON.stringify(meta)); } catch { /* 略過 */ }
}

function histIds() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LEDGER_PREFIX)) ids.push(k.slice(LEDGER_PREFIX.length));
  }
  return ids;
}

/* 亞洲讓球細分：四分之一盤會出現半贏、半輸 */
function ahDetail(margin, line) {
  const parts = lineParts(line).map((L) => margin + L);
  const w = parts.filter((x) => x > 1e-9).length;
  const l = parts.filter((x) => x < -1e-9).length;
  if (parts.length === 2 && w === 1 && l === 0) return "halfwin";
  if (parts.length === 2 && l === 1 && w === 0) return "halflose";
  if (w && !l) return "hit";
  if (l && !w) return "miss";
  return "push";
}

function histOutcome(item, model, snap) {
  const g = gradeOne(item, model, snap);
  let code = g.hit === true ? "hit" : g.hit === false ? "miss" : g.hit === "push" ? "push" : g.hit === "na" ? "na" : "pend";
  if ((item.kind === "ah" || item.kind === "ah-rest") && code !== "na" && code !== "pend") {
    const A = ledgerActual(model);
    const hs = item.kind === "ah-rest" ? A.hs - (snap?.hs || 0) : A.hs;
    const as = item.kind === "ah-rest" ? A.as - (snap?.as || 0) : A.as;
    code = ahDetail(item.side === "home" ? hs - as : as - hs, item.line);
  }
  return { ...g, code };
}

function histGrade(model, bag) {
  const out = [];
  const add = (item, snap, cat, minute) => {
    const g = histOutcome(item, model, snap);
    out.push({ cat, kind: item.kind, minute: minute || "", pick: item.text, actual: g.actual, gap: g.gap, code: g.code });
  };
  for (const it of bag.pre?.items || []) add(it, null, "pre");
  if (bag.corners?.item) add(bag.corners.item, null, "corner");
  for (const s of bag.cornerLive || []) add(s.item, s, "corner", s.minute);
  for (const s of bag.live || []) for (const it of s.items || []) add(it, s, "live", s.minute);
  return out;
}

/* 完賽前後的偏差說明：只用數字對照，不推測原因以外的事 */
function histDeviation(model, saved) {
  const notes = [];
  const A = ledgerActual(model);
  if (!saved || !A.scoresOk) return notes;
  const exp = saved.lh + saved.la;
  const act = A.hs + A.as;
  if (Number.isFinite(exp)) {
    const d = act - exp;
    notes.push(`總進球：預期 ${fx(exp)}，實際 ${act}（${d >= 0 ? "+" : ""}${trimNum(Math.round(d * 10) / 10)}）。${Math.abs(d) >= 2 ? "偏差大，建議看是否有早段紅牌、點球或輪換。" : "在合理範圍內。"}`);
    const md = (A.hs - A.as) - (saved.lh - saved.la);
    if (Math.abs(md) >= 2) notes.push(`淨勝球偏差 ${md >= 0 ? "+" : ""}${trimNum(Math.round(md * 10) / 10)}：模型低估了${md > 0 ? model.home.name : model.away.name}。`);
  }
  const reds = (model.events || []).filter((e) => e.kind === "red").length;
  if (reds) notes.push(`比賽中出現 ${reds} 張紅牌，賽前模型沒有考慮這種情況。`);
  return notes;
}

async function histLoad(force) {
  if (histState.status === "loading") return;
  histState.status = "loading";
  const ids = histIds();
  histState.total = ids.length;
  histState.loaded = 0;
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(HIST_META) || "{}"); } catch { meta = {}; }
  const matches = [];
  const lim = pLimit(3);
  await Promise.all(ids.map((id) => lim(async () => {
    const bag = ledgerRead(id);
    if (!bag) return;
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(HIST_PREFIX + id) || "null"); } catch { rec = null; }
    if (!rec || (!rec.final && (force || Date.now() - (rec.at || 0) > 10 * 60000))) {
      try {
        const m = meta[id] || {};
        const data = await fetchJson(`${m.league ? `${API}/${m.league}` : ALL_API}/summary?event=${encodeURIComponent(id)}`);
        const model = buildModel(data, m.league || "all");
        const saved = typeof loadPrediction === "function" ? loadPrediction(id) : null;
        rec = {
          at: Date.now(), final: ledgerFinal(model),
          league: m.league || model.leagueSlug, leagueName: m.leagueName || model.leagueName,
          home: m.home || model.home.name, away: m.away || model.away.name, kickoff: m.kickoff || model.kickoff,
          score: `${model.home.score}:${model.away.score}`,
          predAt: bag.pre?.at || saved?.at || null,
          xg: saved ? [saved.lh, saved.la] : null,
          rows: histGrade(model, bag),
          deviation: ledgerFinal(model) ? histDeviation(model, saved) : []
        };
        if (rec.final) localStorage.setItem(HIST_PREFIX + id, JSON.stringify(rec));
      } catch {
        rec = rec || { at: Date.now(), final: false, error: true, rows: [], home: meta[id]?.home || id, away: meta[id]?.away || "", kickoff: meta[id]?.kickoff || "", leagueName: meta[id]?.leagueName || "", league: meta[id]?.league || "" };
      }
    }
    matches.push({ id, ...rec });
    histState.loaded += 1;
    if (histState.loaded % 5 === 0) maybeRender({ soft: true });
  })));
  matches.sort((a, b) => new Date(b.kickoff || 0) - new Date(a.kickoff || 0));
  histState.matches = matches;
  histState.status = "ok";
  histState.at = Date.now();
  maybeRender({ soft: true });
}

function histFiltered() {
  const f = histState.filters;
  const since = f.range === "all" ? 0 : Date.now() - Number(f.range) * 86400000;
  const out = [];
  for (const m of histState.matches) {
    if (f.league !== "all" && m.league !== f.league) continue;
    if (since && new Date(m.kickoff || 0).getTime() < since) continue;
    for (const r of m.rows || []) {
      if (f.kind !== "all" && r.kind !== f.kind) continue;
      if (f.cat !== "all" && r.cat !== f.cat) continue;
      out.push({ ...r, match: m });
    }
  }
  return out;
}

function histSummary(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.kind;
    if (!by.has(k)) by.set(k, { hit: 0, miss: 0, push: 0, halfwin: 0, halflose: 0, na: 0, pend: 0 });
    by.get(k)[r.code] += 1;
  }
  return by;
}

function histRate(s) {
  /* 半贏算半個命中、半輸算半個未中；走盤、無法判定、未完賽不計入分母 */
  const win = s.hit + s.halfwin * 0.5;
  const den = s.hit + s.miss + s.halfwin + s.halflose;
  return den ? { p: win / den, n: den } : null;
}

function historyView() {
  if (histState.status === "idle") histLoad(false);
  const f = histState.filters;
  const set = (k, v) => { f[k] = v; maybeRender({ soft: true }); };
  const block = h("section", { class: "block", id: "history-page" }, h("h2", null, ui("預測歷史查詢")));
  block.append(h("p", { class: "faint" }, ui("每場比賽開賽前與比賽中存下的預測快照，完賽後自動對 ESPN 終場數據。原始預測不會被改寫；資料只存在這台裝置，換手機或清除瀏覽器資料就會消失。")));
  if (histState.status === "loading") block.append(h("p", { class: "muted" }, ui(`對帳中…（${histState.loaded}/${histState.total} 場）`)));
  if (histState.status === "ok" && !histState.matches.length) {
    block.append(h("p", { class: "muted" }, ui("這台裝置還沒有預測紀錄。比賽開賽前打開該場的看板，就會自動存下賽前預測；比賽中開著看板，每 5 分鐘存一次滾球預測。")));
    return block;
  }
  const leagues = [...new Map(histState.matches.map((m) => [m.league, m.leagueName || m.league])).entries()].filter(([k]) => k);
  const sel = (label, key, opts) => h("label", { class: "hist-sel" }, h("span", null, ui(label)),
    h("select", { onchange: (e) => set(key, e.target.value) }, opts.map(([v, t]) => h("option", { value: v, selected: f[key] === v }, ui(t)))));
  block.append(h("div", { class: "hist-filters" },
    sel("聯賽", "league", [["all", "全部"], ...leagues]),
    sel("盤口", "kind", [["all", "全部"], ...Object.entries(KIND_ZH)]),
    sel("類型", "cat", [["all", "全部"], ...Object.entries(CAT_ZH)]),
    sel("時間", "range", [["7", "近 7 天"], ["30", "近 30 天"], ["90", "近 90 天"], ["all", "全部"]]),
    h("button", { class: "chip", onclick: () => { histState.status = "idle"; histLoad(true); maybeRender({ soft: true }); } }, ui("🔄 重新對帳"))));
  const rows = histFiltered();
  const sum = histSummary(rows);
  const total = [...sum.values()].reduce((a, s) => { for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {});
  const tr = histRate(total);
  block.append(h("div", { class: "sv-rings" },
    svRing("整體命中（不含走盤）", Math.round((total.hit || 0) + (total.halfwin || 0) * 0.5), tr?.n || 0, true),
    h("div", { class: "hist-kpi" }, h("b", null, String(new Set(rows.map((r) => r.match.id)).size)), h("span", null, ui("場比賽"))),
    h("div", { class: "hist-kpi" }, h("b", null, String(rows.length)), h("span", null, ui("筆預測")))));
  if (sum.size) {
    block.append(h("h3", null, ui("依盤口統計")), predTable(["盤口", "命中", "未命中", "走盤", "半贏", "半輸", "無法判定", "未完賽", "命中率"],
      [...sum.entries()].sort((a, b) => (KIND_ZH[a[0]] || a[0]).localeCompare(KIND_ZH[b[0]] || b[0], "zh-Hant")).map(([k, s]) => {
        const r = histRate(s);
        return { cells: [KIND_ZH[k] || k, String(s.hit), String(s.miss), String(s.push), String(s.halfwin), String(s.halflose), String(s.na), String(s.pend), r ? `${pct(r.p)}（${r.n}）` : "–"] };
      })),
    h("p", { class: "faint" }, ui("命中率＝（命中＋半贏×0.5）÷（命中＋未命中＋半贏＋半輸）；走盤、無法判定、未完賽不計入。樣本少於 30 筆時只能當參考。")));
  }
  /* 逐場 */
  const byMatch = new Map();
  for (const r of rows) { if (!byMatch.has(r.match.id)) byMatch.set(r.match.id, []); byMatch.get(r.match.id).push(r); }
  if (byMatch.size) block.append(h("h3", null, ui("逐場紀錄")));
  for (const [id, list] of byMatch) {
    const m = list[0].match;
    const s = histSummary(list);
    const t = [...s.values()].reduce((a, x) => { for (const k of Object.keys(x)) a[k] = (a[k] || 0) + x[k]; return a; }, {});
    const r = histRate(t);
    const href = m.league ? `?league=${encodeURIComponent(m.league)}&event=${encodeURIComponent(id)}` : "";
    block.append(h("details", { class: "fold hist-match", "data-k": "hist-" + id },
      h("summary", null,
        h("span", null, ui(`${m.kickoff ? shortDate(m.kickoff) + " " : ""}${m.home} ${m.final ? m.score : "vs"} ${m.away}`)),
        h("span", { class: `v2-comp ${r ? (r.p >= 0.6 ? "hi" : r.p >= 0.4 ? "mid" : "lo") : ""}` }, ui(r ? `${pct(r.p)}（${r.n}）` : m.error ? "讀取失敗" : "未完賽"))),
      h("p", { class: "faint" }, ui(`${m.leagueName || ""}${m.predAt ? `｜賽前預測建立於 ${shortDate(new Date(m.predAt).toISOString())} ${taipeiClock(new Date(m.predAt))}` : ""}${m.xg ? `｜賽前預期進球 ${fx(m.xg[0])}:${fx(m.xg[1])}` : ""}`)),
      m.deviation?.length ? h("ul", { class: "v2-list" }, m.deviation.map((x) => h("li", null, ui(x)))) : null,
      predTable(["類型", "盤口", "預測", "實際", "結果"], list.map((x) => ({
        cls: x.code === "hit" || x.code === "halfwin" ? "best" : "",
        cells: [`${CAT_ZH[x.cat] || x.cat}${x.minute ? " " + ledgerMinuteLabel(x.minute) : ""}`, KIND_ZH[x.kind] || x.kind, x.pick, x.actual, OUTCOME[x.code]]
      }))),
      href ? h("a", { class: "chip", href }, ui("打開這場的看板")) : null));
  }
  if (histState.at) block.append(h("p", { class: "faint" }, ui(`對帳時間 ${taipeiClock(new Date(histState.at))}；已完賽的結果會固定保存，不會再改。`)));
  return block;
}
