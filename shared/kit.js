/* 今日球衣：足球開賽後自動帶入 ESPN 當場球衣顏色；沒有資料時可手動選（足球看板共用）。資料只存在這台裝置。 */

const KIT_COLORS = [
  ["白", "#f5f5f5"], ["黑", "#1a1a1a"], ["紅", "#d62828"], ["酒紅", "#7a1f2b"], ["橘", "#f77f00"], ["黃", "#ffd60a"],
  ["綠", "#2a9d4b"], ["淺藍", "#5bc0eb"], ["藍", "#1d4ed8"], ["深藍", "#13235b"], ["紫", "#7b2cbf"], ["粉", "#ff70a6"], ["灰", "#8d99ae"], ["金", "#c9a227"]
];

function kitKey(sport, model) {
  return `kit-v1:${sport}:${model.id}`;
}
function kitRead(sport, model) {
  try { return JSON.parse(localStorage.getItem(kitKey(sport, model)) || "{}"); } catch { return {}; }
}
function kitWrite(sport, model, patch) {
  const cur = { ...kitRead(sport, model), ...patch, at: Date.now() };
  try { localStorage.setItem(kitKey(sport, model), JSON.stringify(cur)); } catch { /* 略過 */ }
  return cur;
}
function kitName(hex) {
  const exact = KIT_COLORS.find(([, v]) => v === hex);
  if (exact) return exact[0];
  /* ESPN 給的色碼找最接近的顏色名稱 */
  const rgb = (x) => { const n = parseInt(String(x).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r, g, b] = rgb(hex);
  let best = "自訂";
  let d = Infinity;
  for (const [n, v] of KIT_COLORS) { const [r2, g2, b2] = rgb(v); const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (dd < d) { d = dd; best = n; } }
  return best;
}
function kitText(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  return lum > 150 ? "#111" : "#fff";
}

/* 沒有手動設定時，用 ESPN 當場球衣資料（足球開賽後才有） */
function kitAuto(model, side) {
  const c = model[side]?.kit?.color;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null;
}

function kitPanel(sport, model) {
  const saved = kitRead(sport, model);
  const auto = { home: kitAuto(model, "home"), away: kitAuto(model, "away") };
  const k = { home: saved.home || auto.home, away: saved.away || auto.away };
  const src = (side) => (saved[side] ? "手動" : auto[side] ? "ESPN 當場資料" : "");
  const set = (patch) => { kitWrite(sport, model, patch); maybeRender({ soft: true }); };
  /* 上衣：ESPN 當場資料或手動；球褲：ESPN 沒有提供，只能手動或畫面確認 */
  const shorts = (side) => saved[side + "Shorts"] || "";
  const card = (side) => {
    const c = k[side];
    const sc = shorts(side);
    return h("div", { class: "kit-card", style: c ? `background:${c};color:${kitText(c)}` : "" },
      h("div", { class: "kit-who" }, ui(`${side === "home" ? "主隊" : "客隊"} ${model[side].name}`)),
      h("div", { class: "kit-color" }, ui(c ? `上衣 ${kitName(c)}色` : "上衣 尚未公布")),
      h("div", { class: "kit-src" }, ui(c ? `來源：${src(side)}${saved[side] ? "（畫面確認）" : ""}` : sport === "football" ? "開賽後自動更新" : "來源沒有球衣資料")),
      h("div", { class: "kit-shorts" }, sc ? h("span", { class: "kit-dot", style: `background:${sc}` }) : null, ui(sc ? `球褲 ${kitName(sc)}色（畫面確認）` : "球褲：來源未提供，可手動設定")));
  };
  const swatches = (side, part = "") => h("div", { class: "kit-row" },
    h("span", { class: "kit-label" }, ui(`${side === "home" ? "主" : "客"} ${model[side].name}${part ? " 球褲" : " 上衣"}`)),
    ...KIT_COLORS.map(([n, v]) => {
      const key = side + part;
      return h("button", {
        class: "kit-sw" + (saved[key] === v ? " on" : ""), title: n, "aria-label": n,
        style: `background:${v};color:${kitText(v)}`, onclick: () => set({ [key]: saved[key] === v ? undefined : v })
      }, saved[key] === v ? "✓" : "");
    }));
  const note = sport === "football"
    ? "ESPN 開賽後才公布兩隊當場穿的球衣，看板會自動帶入；開賽前顯示「尚未公布」，開賽後重新整理即可。"
    : "這個聯賽的來源沒有球衣資料。";
  return h("section", { class: "panel kit-panel", id: "kit" },
    h("h2", null, ui("🎽 今日球衣")),
    h("div", { class: "kit-cards" }, card("away"), card("home")),
    h("p", { class: "faint" }, ui(note)),
    h("details", { class: "fold", "data-k": "kit-edit" }, h("summary", null, ui("手動修改顏色（看畫面確認）")), swatches("away"), swatches("away", "Shorts"), swatches("home"), swatches("home", "Shorts"),
      h("p", { class: "faint" }, ui("再點一次同一色塊可取消手動設定，改回自動。只存在這台裝置；上衣顏色會同步到陣型圖的球員圓點。"))));
}

/* 陣型圖用：目前上衣顏色（手動優先） */
function kitShirt(sport, model, side) {
  const saved = kitRead(sport, model);
  return saved[side] || kitAuto(model, side) || "";
}
