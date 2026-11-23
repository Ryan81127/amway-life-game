/* 三平台跟播：Flashscore、Sofascore、FotMob（足球、籃球共用）
   這三個平台沒有公開 API，也擋其他網站讀取資料，看板不能自動抓它們的數字（硬抓等於繞過對方的存取限制）。
   能合法做到的：
   1. 一鍵打開本場：第一次用搜尋找到本場，把網址貼回來，之後按鈕直接開本場頁。
   2. Sofascore 官方小工具（免費、可嵌入）：在 Sofascore 本場頁按「嵌入／Embed」複製 iframe 代碼貼回來，
      看板就直接顯示它的即時畫面（球員評分、攻勢圖等，依你複製的小工具而定）。
   網址只存在這台裝置。 */
const EXT_KEY = "ext-live-v1:";
const EXT_SITES = [
  { id: "flashscore", name: "Flashscore", hosts: ["flashscore."], tip: "多場比分秒更、射門控球 xG、賠率" },
  { id: "sofascore", name: "Sofascore", hosts: ["sofascore.com"], tip: "球員即時評分、攻勢圖" },
  { id: "fotmob", name: "FotMob", hosts: ["fotmob.com"], tip: "陣容、身價、事件時間軸" }
];
function extRead(id) {
  try { return JSON.parse(localStorage.getItem(EXT_KEY + id) || "{}"); } catch { return {}; }
}
function extWrite(id, data) {
  try { localStorage.setItem(EXT_KEY + id, JSON.stringify(data)); } catch { /* 空間不足就略過 */ }
}

/* 解析貼上的內容：網址或 Sofascore 的 iframe 代碼 */
function extParse(text) {
  const raw = String(text || "").trim();
  const iframe = raw.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  const candidate = iframe ? iframe[1] : raw;
  let u;
  try { u = new URL(candidate); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.hostname === "widgets.sofascore.com") return { site: "sofascore", widget: u.href };
  const site = EXT_SITES.find((s) => s.hosts.some((h) => u.hostname.includes(h)));
  return site ? { site: site.id, url: u.href } : null;
}

function extSearch(site, model, sport) {
  const day = typeof taipeiYmd === "function" ? taipeiYmd(model.kickoff || model.date) : "";
  const en = `${model.home.rawName || model.home.name} ${model.away.rawName || model.away.name}`;
  const host = { flashscore: "flashscore.com", sofascore: "sofascore.com", fotmob: "fotmob.com" }[site];
  return "https://www.google.com/search?q=" + encodeURIComponent(`site:${host} ${en} ${day}`);
}

const extUi = new Map();
function extPanel(model, sport = "football") {
  if (!model?.id) return null;
  const saved = extRead(model.id);
  const ui2 = (t) => (typeof ui === "function" ? ui(t) : t);
  const st = extUi.get(model.id) || { open: false, msg: "" };
  extUi.set(model.id, st);
  const btns = EXT_SITES.map((s) => {
    const direct = saved[s.id];
    return h("a", { class: `chip ext-btn${direct ? " direct" : ""}`, href: direct || extSearch(s.id, model, sport), target: "_blank", rel: "noopener noreferrer", title: s.tip },
      h("b", null, s.name), h("span", { class: "faint" }, ui2(direct ? " 本場" : " 搜尋")));
  });
  const input = h("input", { type: "text", class: "ext-input", placeholder: ui2("貼上本場網址，或 Sofascore 嵌入代碼") });
  const save = h("button", { class: "chip", onclick: () => {
    const r = extParse(input.value);
    if (!r) { st.msg = "看不懂這段，請貼 Flashscore／Sofascore／FotMob 的本場網址，或 Sofascore 的 iframe 代碼。"; }
    else {
      const next = { ...extRead(model.id) };
      if (r.widget) { next.widgets = [...new Set([...(next.widgets || []), r.widget])].slice(-3); st.msg = "已加入 Sofascore 官方小工具。"; }
      else { next[r.site] = r.url; st.msg = `已存 ${EXT_SITES.find((s) => s.id === r.site).name} 本場網址，按鈕會直接開本場。`; }
      extWrite(model.id, next);
    }
    st.open = true;
    if (typeof maybeRender === "function") maybeRender({ soft: true });
  } }, ui2("存"));
  const clear = h("button", { class: "chip", onclick: () => { extWrite(model.id, {}); st.msg = "已清除這場的連結與小工具。"; if (typeof maybeRender === "function") maybeRender({ soft: true }); } }, ui2("清除"));
  const box = h("details", { class: "ext-live", "data-k": "ext-live" }, h("summary", null, ui2("📡 三平台跟播（Flashscore／Sofascore／FotMob）")),
    h("div", { class: "ext-btns" }, ...btns),
    h("div", { class: "ext-row" }, input, save, clear),
    st.msg ? h("p", { class: "faint" }, ui2(st.msg)) : null,
    h("p", { class: "faint" }, ui2("按鈕先用搜尋找本場；打開後把本場網址貼回來，之後就直接開。Sofascore 本場頁右上角有「嵌入（Embed）」，複製 iframe 代碼貼上，就能在這裡看它的即時球員評分。三個平台沒有公開資料介面，看板不會自動讀它們的數字。")));
  if (st.open) box.open = true;
  box.addEventListener("toggle", () => { st.open = box.open; });
  for (const src of saved.widgets || []) {
    box.append(h("iframe", { class: "ext-widget", src, loading: "lazy", referrerpolicy: "no-referrer", title: "Sofascore widget", frameborder: "0", scrolling: "auto" }));
  }
  return box;
}
