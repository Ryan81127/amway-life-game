/* 單區模式：讓看板一目瞭然（足球、籃球共用）
   - 側欄按一下，只顯示那一區；不用在長頁面裡捲著找。側欄最上方「📚 全部」可切回整頁。
   - 每一區最上面是「🎙️ 口播重點」（就是原本的口播稿，搬到最前面、放大），
     下面的表格、數據收進「📊 詳細資料」，要看再點開。
   - 記住你看到哪一區；自動更新畫面後還停在同一區。 */
const FOCUS_KEY = "focus-v1";
/* 球衣、身價固定放在最上方，永遠顯示 */
const FOCUS_PIN = new Set(["kit", "values"]);
const focusState = { on: true, id: null, prev: null, ids: [], open: new Set() };
try {
  const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || "{}");
  if (saved.on === false) focusState.on = false;
} catch { /* 讀不到就用預設 */ }
function focusSave() {
  try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ on: focusState.on })); } catch { /* ignore */ }
}

/* 一區的整理：口播搬到最上面，其餘收進「詳細資料」 */
function focusTidy(el) {
  if (!el || el.dataset.tidy === "1" || el.tagName === "DETAILS") return;
  el.dataset.tidy = "1";
  const scripts = [...el.querySelectorAll(".script")].filter((s) => !s.closest(".say-top") && s.closest("section, .block, .panel") === el);
  if (!scripts.length) return;
  const head = [...el.children].find((c) => /^H[1-3]$/.test(c.tagName));
  const top = document.createElement("div");
  top.className = "say-top";
  const k = document.createElement("div");
  k.className = "say-top-k";
  k.textContent = typeof ui === "function" ? ui("🎙️ 口播重點") : "🎙️ 口播重點";
  top.append(k, ...scripts.slice(0, 2));
  const rest = [...el.children].filter((c) => c !== head && c !== top);
  const hasRest = rest.some((c) => (c.textContent || "").trim() || c.querySelector("table, img, canvas, svg, button, select"));
  if (head) head.after(top); else el.prepend(top);
  if (!hasRest) return;
  const more = document.createElement("details");
  more.className = "focus-more";
  if (focusState.open.has(el.id)) more.open = true;
  more.addEventListener("toggle", () => { if (more.open) focusState.open.add(el.id); else focusState.open.delete(el.id); });
  const sum = document.createElement("summary");
  sum.textContent = typeof ui === "function" ? ui("📊 詳細資料與數據") : "📊 詳細資料與數據";
  more.append(sum, ...rest);
  top.after(more);
}

/* 套用單區模式：只顯示選到的那一區 */
function focusApply(ids) {
  if (ids) focusState.ids = ids.filter((id) => document.getElementById(id));
  const list = focusState.ids;
  document.body.classList.toggle("focus-on", focusState.on);
  for (const id of list) focusTidy(document.getElementById(id));
  if (!list.length) return;
  if (!list.includes(focusState.id) || FOCUS_PIN.has(focusState.id)) focusState.id = list.find((id) => !FOCUS_PIN.has(id)) || list[0];
  const first = document.getElementById(list[0]);
  const wrap = first?.parentElement;
  if (!wrap) return;
  const inRail = new Set(list);
  /* 頂部（比分板、分頁、情勢列）保留；分界是區塊導覽列，沒有的話就是第一個不是球衣／身價的側欄區塊 */
  const kids = [...wrap.children];
  let anchor = kids.findIndex((c) => c.classList.contains("match-nav"));
  if (anchor < 0) anchor = kids.findIndex((c) => inRail.has(c.id) && !["kit", "values"].includes(c.id));
  kids.forEach((child, i) => {
    let show = true;
    if (focusState.on) {
      if (FOCUS_PIN.has(child.id)) show = true;
      else if (inRail.has(child.id)) show = child.id === focusState.id;
      else if (child.classList.contains("langbar") || child.classList.contains("row-actions")) show = true;
      else if (anchor >= 0 && i >= anchor) show = false;
    }
    child.classList.toggle("focus-hide", !show);
  });
  document.querySelectorAll("#side-rail .rail-btn[data-target]").forEach((b) => b.classList.toggle("on", focusState.on && b.dataset.target === focusState.id));
  const all = document.getElementById("focus-toggle");
  if (all) {
    all.classList.toggle("on", !focusState.on);
    /* 顯示目前模式：直播模式（一次一區）／完整資料（整頁） */
    all.querySelector(".rl").textContent = typeof ui === "function" ? ui(focusState.on ? "直播模式" : "完整資料") : focusState.on ? "直播模式" : "完整資料";
    all.querySelector(".ri").textContent = focusState.on ? "🎯" : "📚";
  }
}

/* 側欄按鈕：單區模式下切換區塊，回傳 true 表示已處理 */
function focusGo(id) {
  if (!focusState.on || FOCUS_PIN.has(id) || !document.getElementById(id)) return false;
  if (focusState.id && focusState.id !== id) focusState.prev = focusState.id;
  focusState.id = id;
  focusApply();
  const el = document.getElementById(id);
  const y = el.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  return true;
}

function focusToggleButton() {
  const b = document.createElement("button");
  b.className = "rail-btn rail-focus";
  b.id = "focus-toggle";
  b.title = "目前模式；按一下切換：直播模式（一次一區）／完整資料（整頁）";
  const ri = document.createElement("span"); ri.className = "ri";
  const rl = document.createElement("span"); rl.className = "rl";
  b.append(ri, rl);
  b.addEventListener("click", () => {
    focusState.on = !focusState.on;
    focusSave();
    focusApply();
  });
  return b;
}

/* 回上一段：回到剛剛看的那一區 */
function focusBack() {
  if (focusState.on && focusState.prev && document.getElementById(focusState.prev)) return focusGo(focusState.prev);
  window.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}
