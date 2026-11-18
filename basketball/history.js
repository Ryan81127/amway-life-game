/* 籃球預測歷史（比照足球）：賽程頁 ?view=history。
   原始預測（nba-pred-v1:）一律不改；完賽後對帳結果另存 nba-hist-v1:，之後不再重算。資料只在這台裝置。 */

const BH_PREFIX = "nba-hist-v1:";
const BH_OUT = { hit: "命中", miss: "未命中", push: "走盤", halfwin: "半贏", halflose: "半輸", na: "無法判定", pend: "未完賽" };
const BH_KIND = { ml: "獨贏", spread: "讓分", total: "大小分", value: "價值推薦" };
const BH_LEAGUE = { nba: "NBA", kbl: "韓籃甲", bj: "日本B聯賽", wnbl: "澳女聯" };
const bhState = { status: "idle", matches: [], filters: { league: "all", kind: "all", range: "30" }, loaded: 0, total: 0 };

function bhIds() {
  const out = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith("nba-pred-v1:")) out.push(k.slice("nba-pred-v1:".length));
  }
  return out;
}

function bhSettle(diff) {
  return diff > 1e-9 ? "hit" : diff < -1e-9 ? "miss" : "push";
}

/* 依賽前存下的預測逐項對帳；預測本身不動 */
function bhGrade(model, p) {
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const done = model.status.phase === "ft" && Number.isFinite(hs) && Number.isFinite(as);
  const H = model.home.name;
  const A = model.away.name;
  const rows = [];
  const add = (kind, pick, code) => rows.push({ kind, pick, code: done ? code : "pend", actual: done ? `${A} ${as} : ${hs} ${H}` : "–" });
  const margin = hs - as;
  const tot = hs + as;
  if (Number.isFinite(p.pHome)) {
    const homePick = p.pHome >= 0.5;
    add("ml", `模型看好 ${homePick ? H : A} 勝（${pct(homePick ? p.pHome : 1 - p.pHome)}）`, homePick ? (margin > 0 ? "hit" : "miss") : (margin < 0 ? "hit" : "miss"));
  }
  if (Number.isFinite(p.line) && Number.isFinite(p.mu)) {
    const homeSide = p.mu + p.line > 0;
    add("spread", `${homeSide ? H : A} ${homeSide ? fmtHandicap(p.line) : fmtHandicap(-p.line)}`, bhSettle((homeSide ? margin + p.line : -margin - p.line)));
  } else add("spread", "沒有讓分盤", "na");
  if (Number.isFinite(p.total) && Number.isFinite(p.muT)) {
    const over = p.muT > p.total;
    add("total", `${over ? "大" : "小"} ${trimNum(p.total)}`, bhSettle(over ? tot - p.total : p.total - tot));
  } else add("total", "沒有大小分盤", "na");
  for (const v of p.value || []) {
    const m = /([+-]?\d+(?:\.\d+)?)$/.exec(v.label);
    const n = m ? Number(m[1]) : null;
    let code = "na";
    if (v.group === "大小分" && n != null) code = bhSettle(v.label.startsWith("大") ? tot - n : n - tot);
    else if (v.group === "讓分" && n != null) code = bhSettle(v.label.startsWith(H) ? margin + n : -margin + n);
    else if (v.group === "獨贏") code = v.label.startsWith(H) ? (margin > 0 ? "hit" : "miss") : (margin < 0 ? "hit" : "miss");
    add("value", `${v.group} ${v.label} @${fmtOdd(v.dec)}`, code);
  }
  const err = done && Number.isFinite(p.mu) ? { margin: margin - p.mu, total: tot - p.muT } : null;
  return { rows, done, err, score: done ? `${as}:${hs}` : "" };
}

async function bhModel(id, league) {
  if (league === "kbl") return loadKblMatch(id);
  if (league === "bj") return loadBjMatch(id);
  if (league === "wnbl") return loadWnblMatch(id);
  return buildModel(await fetchJson(`${API}/summary?event=${encodeURIComponent(id)}`, new AbortController().signal));
}

async function bhLoad(force) {
  if (bhState.status === "loading") return;
  bhState.status = "loading";
  const ids = bhIds();
  bhState.total = ids.length;
  bhState.loaded = 0;
  const out = [];
  const lim = typeof pLimit === "function" ? pLimit(3) : (f) => f();
  await Promise.all(ids.map((id) => lim(async () => {
    const p = loadPrediction(id);
    if (!p) return;
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(BH_PREFIX + id) || "null"); } catch { rec = null; }
    if (!rec || (!rec.final && (force || Date.now() - (rec.at || 0) > 10 * 60000))) {
      const league = p.league || (/^\d{9}$/.test(id) ? "nba" : "");
      try {
        const model = await bhModel(id, league || "nba");
        const g = bhGrade(model, p);
        rec = { at: Date.now(), final: g.done, league: league || "nba", home: model.home.name, away: model.away.name, date: model.kickoff || model.date || p.kickoff || "", predAt: p.at || null, mu: p.mu, muT: p.muT, ...g };
        if (g.done) localStorage.setItem(BH_PREFIX + id, JSON.stringify(rec));
      } catch {
        rec = rec || { at: Date.now(), final: false, error: true, league, home: p.home || id, away: p.away || "", date: p.kickoff || "", rows: [] };
      }
    }
    out.push({ id, ...rec });
    bhState.loaded += 1;
  })));
  out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  bhState.matches = out;
  bhState.status = "ok";
  bhState.at = Date.now();
  maybeRender({ soft: true });
}

function bhRows() {
  const f = bhState.filters;
  const since = f.range === "all" ? 0 : Date.now() - Number(f.range) * 86400000;
  const rows = [];
  for (const m of bhState.matches) {
    if (f.league !== "all" && m.league !== f.league) continue;
    if (since && new Date(m.date || 0).getTime() < since) continue;
    for (const r of m.rows || []) if (f.kind === "all" || r.kind === f.kind) rows.push({ ...r, match: m });
  }
  return rows;
}

function bhSum(rows) {
  const s = { hit: 0, miss: 0, push: 0, halfwin: 0, halflose: 0, na: 0, pend: 0 };
  for (const r of rows) s[r.code] += 1;
  const den = s.hit + s.miss + s.halfwin + s.halflose;
  return { ...s, den, rate: den ? (s.hit + s.halfwin * 0.5) / den : null };
}

function historyView() {
  if (bhState.status === "idle") bhLoad(false);
  const f = bhState.filters;
  const set = (k, v) => { f[k] = v; maybeRender({ soft: true }); };
  const sec = h("section", { class: "panel", id: "history-page" }, h("h2", null, ui("籃球預測歷史")));
  sec.append(h("p", { class: "faint" }, ui("比賽頁開過的賽前模型預測都會存在這台裝置，完賽後自動對帳。原始預測不會被改寫；換手機或清除瀏覽器資料就會消失。")));
  if (bhState.status === "loading") sec.append(h("p", { class: "muted" }, ui(`對帳中…（${bhState.loaded}/${bhState.total} 場）`)));
  if (bhState.status === "ok" && !bhState.matches.length) {
    sec.append(h("p", { class: "muted" }, ui("這台裝置還沒有籃球預測紀錄。開賽前打開比賽頁的「盤口預測」，就會自動存下。")));
    return sec;
  }
  const sel = (label, key, opts) => h("label", { class: "hist-sel" }, h("span", null, ui(label)),
    h("select", { onchange: (e) => { e.target.blur(); set(key, e.target.value); } }, opts.map(([v, t]) => h("option", { value: v, selected: f[key] === v }, ui(t)))));
  sec.append(h("div", { class: "hist-filters" },
    sel("聯賽", "league", [["all", "全部"], ...Object.entries(BH_LEAGUE)]),
    sel("盤口", "kind", [["all", "全部"], ...Object.entries(BH_KIND)]),
    sel("時間", "range", [["7", "近 7 天"], ["30", "近 30 天"], ["90", "近 90 天"], ["all", "全部"]]),
    h("button", { class: "chip", onclick: () => { bhState.status = "idle"; bhLoad(true); maybeRender({ soft: true }); } }, ui("🔄 重新對帳"))));
  const rows = bhRows();
  const all = bhSum(rows);
  const nGames = new Set(rows.map((r) => r.match.id)).size;
  const errs = bhState.matches.filter((m) => m.err && rows.some((r) => r.match.id === m.id));
  sec.append(h("div", { class: "hist-kpis" },
    h("div", { class: "hist-kpi" }, h("b", null, all.rate == null ? "–" : pct(all.rate)), h("span", null, ui(`命中率（${all.den} 筆）`))),
    h("div", { class: "hist-kpi" }, h("b", null, String(nGames)), h("span", null, ui("場比賽"))),
    h("div", { class: "hist-kpi" }, h("b", null, errs.length ? trimNum(errs.reduce((a, m) => a + Math.abs(m.err.margin), 0) / errs.length) : "–"), h("span", null, ui("平均分差誤差"))),
    h("div", { class: "hist-kpi" }, h("b", null, errs.length ? trimNum(errs.reduce((a, m) => a + Math.abs(m.err.total), 0) / errs.length) : "–"), h("span", null, ui("平均總分誤差")))));
  const head = ["盤口", "命中", "未命中", "走盤", "半贏", "半輸", "無法判定", "未完賽", "命中率"];
  const tbl = h("table", { class: "hist-table" }, h("thead", null, h("tr", null, head.map((x) => h("th", null, ui(x))))),
    h("tbody", null, Object.entries(BH_KIND).map(([k, name]) => {
      const s = bhSum(rows.filter((r) => r.kind === k));
      return h("tr", null, [name, s.hit, s.miss, s.push, s.halfwin, s.halflose, s.na, s.pend, s.rate == null ? "–" : `${pct(s.rate)}（${s.den}）`].map((x) => h("td", null, ui(String(x)))));
    })));
  sec.append(h("h3", null, ui("依盤口統計")), h("div", { class: "table-wrap" }, tbl),
    h("p", { class: "faint" }, ui("命中率＝（命中＋半贏×0.5）÷（命中＋未命中＋半贏＋半輸）；走盤、無法判定、未完賽不計入。籃球多為半分盤，半贏半輸很少出現。樣本少於 30 筆只能當參考。")));
  const byMatch = new Map();
  for (const r of rows) { if (!byMatch.has(r.match.id)) byMatch.set(r.match.id, []); byMatch.get(r.match.id).push(r); }
  if (byMatch.size) sec.append(h("h3", null, ui("逐場紀錄")));
  for (const [id, list] of byMatch) {
    const m = list[0].match;
    const s = bhSum(list);
    sec.append(h("details", { class: "fold", "data-k": "bh-" + id },
      h("summary", null, ui(`${m.date ? shortDate(m.date) + " " : ""}${m.away} ${m.final ? m.score : "@"} ${m.home}`), " ", h("span", { class: "faint" }, ui(s.rate == null ? (m.error ? "讀取失敗" : "未完賽") : `${pct(s.rate)}（${s.den}）`))),
      h("p", { class: "faint" }, ui(`${BH_LEAGUE[m.league] || ""}${m.err ? `｜分差誤差 ${trimNum(m.err.margin)}、總分誤差 ${trimNum(m.err.total)}` : ""}`)),
      h("ul", { class: "bx-list" }, list.map((r) => h("li", null, ui(`${BH_KIND[r.kind]}：${r.pick} → `), h("b", { class: r.code === "hit" ? "pos" : r.code === "miss" ? "neg" : "" }, ui(BH_OUT[r.code]))))),
      h("a", { class: "chip", href: `?${m.league && m.league !== "nba" ? `league=${m.league}&` : ""}event=${encodeURIComponent(id)}` }, ui("打開這場"))));
  }
  return sec;
}
