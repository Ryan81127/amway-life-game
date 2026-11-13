/* 左側固定導覽列（跟著捲動）＋ 全頁搜尋（放大鏡）。 */

const NAV_ICON = {
  prediction: "🎯", injuries: "🩹", stars: "⭐", history: "📖", cards: "🗂️", movement: "📈", form: "📊", lineups: "👥", links: "🔗",
  recap: "📝", stats: "📊", timeline: "⏱️", "live-analysis": "⚡", corners: "⛳", mood: "💬", board: "🏟️", inplay: "🎲", coaches: "👔", settle: "📒"
};

function navLabel(text) {
  return String(text).replace(/盤口預測|賽前預測/, "預測").replace("技術統計", "統計").replace("即時分析", "即時").replace("外部資料", "外部").replace("兩隊故事", "故事").replace("滾球預測", "滾球").replace("盤口異動", "盤口").replace("此刻可以說", "話術");
}

function sideRail(items) {
  document.getElementById("side-rail")?.remove();
  document.getElementById("float-search")?.remove();
  const rail = h("nav", { class: "side-rail", id: "side-rail", "aria-label": "快速跳轉" });
  const go = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === "DETAILS") target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  rail.append(
    h("button", { class: "rail-btn rail-search", title: "搜尋", onclick: () => openSearch() }, h("span", { class: "ri" }, "🔍"), h("span", { class: "rl" }, ui("搜尋"))),
    h("button", { class: "rail-btn", title: "回到頂端", onclick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }, h("span", { class: "ri" }, "⬆️"), h("span", { class: "rl" }, ui("頂端")))
  );
  for (const [id, label] of items) {
    rail.append(h("button", { class: "rail-btn", "data-target": id, title: ui(label), onclick: () => go(id) },
      h("span", { class: "ri" }, NAV_ICON[id] || "•"), h("span", { class: "rl" }, ui(navLabel(label)))));
  }
  document.body.append(rail);
  document.body.classList.add("has-rail");
  watchRail(items.map(([id]) => id));
}

let railObserver = null;
function watchRail(ids) {
  railObserver?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  const seen = new Map();
  railObserver = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
    let best = null;
    for (const [id, top] of seen) if (top != null && (best == null || Math.abs(top) < Math.abs(seen.get(best)))) best = id;
    document.querySelectorAll("#side-rail .rail-btn[data-target]").forEach((b) => b.classList.toggle("on", b.dataset.target === best));
  }, { rootMargin: "-10% 0px -60% 0px" });
  requestAnimationFrame(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) railObserver.observe(el); }));
}

function clearRail() {
  document.getElementById("side-rail")?.remove();
  document.body.classList.remove("has-rail");
  railObserver?.disconnect();
}

/* ---------- 搜尋 ---------- */

function floatingSearch() {
  if (document.getElementById("float-search")) return;
  document.body.append(h("button", { class: "float-search", id: "float-search", title: "搜尋", onclick: () => openSearch() }, "🔍"));
}

function openSearch() {
  closeSearch();
  const input = h("input", { type: "search", class: "search-input", placeholder: ui("輸入球員、球隊、角球、口播、盤口…"), "aria-label": "搜尋本頁內容" });
  const results = h("div", { class: "search-results" });
  const panel = h("div", { class: "search-panel", id: "search-panel", role: "dialog", "aria-label": "搜尋" },
    h("div", { class: "search-top" }, h("span", null, "🔍"), input, h("button", { class: "icon-btn", onclick: closeSearch }, ui("關閉"))),
    results);
  const overlay = h("div", { class: "search-overlay", id: "search-overlay", onclick: closeSearch });
  document.body.append(overlay, panel);
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value, results), 120);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
    if (e.key === "Enter") results.querySelector("button")?.click();
  });
  if (state.lastSearch) { input.value = state.lastSearch; runSearch(input.value, results); }
  setTimeout(() => input.focus(), 30);
}

function closeSearch() {
  document.getElementById("search-panel")?.remove();
  document.getElementById("search-overlay")?.remove();
}

function searchVariants(q) {
  const out = new Set([q.toLowerCase()]);
  if (typeof han === "function") out.add(han(q).toLowerCase());
  if (typeof S2T === "object") out.add(q.replace(/[㐀-鿿]/g, (ch) => S2T[ch] || ch).toLowerCase());
  return [...out].filter(Boolean);
}

function sectionTitleOf(el) {
  const sec = el.closest("details, section");
  if (!sec) return "";
  if (sec.tagName === "DETAILS") {
    const outer = sec.parentElement?.closest("section");
    const s = sec.querySelector(":scope > summary")?.textContent || "";
    const o = outer?.querySelector(":scope > h2")?.textContent || "";
    return [o, s].filter(Boolean).join(" › ");
  }
  return sec.querySelector(":scope > h2")?.textContent || "";
}

function runSearch(raw, box) {
  const q = String(raw || "").trim();
  state.lastSearch = q;
  box.replaceChildren();
  if (!q) { box.append(h("p", { class: "faint" }, ui("可以搜：球員名、球隊、角球、黃牌、讓球、大小、口播、知識卡、冷知識…"))); return; }
  const vs = searchVariants(q);
  const app = document.getElementById("app");
  const nodes = [...app.querySelectorAll("h2, h3, p, li, tr, summary, .stat, .kc-head, .pill")];
  const hits = nodes.filter((n) => {
    const t = (n.textContent || "").toLowerCase();
    return vs.some((v) => t.includes(v));
  }).filter((n, _, arr) => !arr.some((o) => o !== n && n.contains(o)));
  if (!hits.length) { box.append(h("p", { class: "muted" }, ui(`找不到「${q}」。試試別的寫法，例如英文名或簡稱。`))); return; }
  box.append(h("p", { class: "faint" }, ui(`找到 ${hits.length} 筆`)));
  for (const n of hits.slice(0, 60)) {
    const text = (n.textContent || "").replace(/\s+/g, " ").trim();
    const low = text.toLowerCase();
    const v = vs.find((x) => low.includes(x)) || "";
    const at = low.indexOf(v);
    const start = Math.max(0, at - 24);
    const snip = (start ? "…" : "") + text.slice(start, at + v.length + 46) + (at + v.length + 46 < text.length ? "…" : "");
    const parts = snip.split(new RegExp(`(${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
    box.append(h("button", { class: "search-hit", onclick: () => jumpTo(n) },
      h("span", { class: "sh-sec" }, sectionTitleOf(n) || ui("本頁")),
      h("span", { class: "sh-txt" }, parts.map((p, i) => (i % 2 ? h("mark", null, p) : p)))));
  }
}

function jumpTo(node) {
  closeSearch();
  let d = node.parentElement?.closest("details");
  while (d) { d.open = true; d = d.parentElement?.closest("details"); }
  if (node.tagName === "SUMMARY") node.parentElement.open = true;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.remove("search-flash");
  void node.offsetWidth;
  node.classList.add("search-flash");
  setTimeout(() => node.classList.remove("search-flash"), 2600);
}

document.addEventListener("keydown", (e) => {
  if ((e.key === "/" || (e.key === "f" && (e.ctrlKey || e.metaKey) && e.shiftKey)) && !/input|textarea/i.test(document.activeElement?.tagName || "")) {
    e.preventDefault();
    openSearch();
  }
});
