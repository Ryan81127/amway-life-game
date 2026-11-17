/* 臨場設定：主播賽前手動選兩隊當天球衣顏色、開賽後標記進攻方向（足球、籃球共用）。
   資料只存在這台裝置；方向在下半場（足球第 2 節、籃球第 3 節起）自動對調。 */

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

/* 目前是上半場還是下半場；延長賽回傳 et，提醒重新確認 */
function kitHalf(sport, model) {
  const per = Number(sport === "football" ? model.minute?.period : model.status?.period) || 0;
  const phase = sport === "football" ? model.minute?.phase : model.status?.phase;
  if (phase === "pre" || !per) return "pre";
  if (sport === "football") return per >= 3 ? "et" : per === 2 && phase !== "ht" ? "2" : "1";
  return per >= 3 ? "2" : "1";
}

/* home 這一刻往哪邊攻：L 或 R */
function kitHomeDir(sport, model, k) {
  if (!k.dir) return null;
  const half = kitHalf(sport, model);
  const flip = half === "2" || (half === "et" && k.etFlip);
  return flip ? (k.dir === "L" ? "R" : "L") : k.dir;
}

/* 沒有手動設定時，用 ESPN 當場球衣資料（足球開賽後才有） */
function kitAuto(model, side) {
  const c = model[side]?.kit?.color;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null;
}

function kitPanel(sport, model) {
  const saved = kitRead(sport, model);
  const auto = { home: kitAuto(model, "home"), away: kitAuto(model, "away") };
  const k = { ...saved, home: saved.home || auto.home, away: saved.away || auto.away };
  const autoUsed = (!saved.home && auto.home) || (!saved.away && auto.away);
  const set = (patch) => { kitWrite(sport, model, patch); maybeRender({ soft: true }); };
  const half = kitHalf(sport, model);
  const hd = kitHomeDir(sport, model, k);
  const sideBadge = (side) => {
    const c = k[side];
    return h("span", { class: "kit-badge", style: c ? `background:${c};color:${kitText(c)}` : "" },
      ui(`${side === "home" ? "主" : "客"} ${model[side].name}${c ? `・${kitName(c)}衣` : ""}`));
  };
  /* 場地示意：左右兩半，顯示誰往哪攻 */
  let field = null;
  if (hd) {
    const leftSide = hd === "R" ? "home" : "away";
    const rightSide = leftSide === "home" ? "away" : "home";
    const half1 = (side, arrow) => h("div", { class: "kit-half", style: k[side] ? `background:${k[side]};color:${kitText(k[side])}` : "" },
      ui(`${arrow === "R" ? "" : "← "}${model[side].name} 進攻${arrow === "R" ? " →" : ""}`));
    field = h("div", { class: "kit-field" }, half1(leftSide, "R"), h("div", { class: "kit-mid" }), half1(rightSide, "L"));
  }
  const status = !k.home || !k.away
    ? (sport === "football" ? "ESPN 通常開賽後才公布當場球衣，屆時會自動帶入；賽前也可以先手動選" : "賽前選好兩隊今天的球衣顏色")
    : !hd ? "開賽後點下面的按鈕標記進攻方向"
      : half === "2" ? "已自動換邊（下半場）" : half === "et" ? "延長賽：請重新確認方向" : "上半場方向";
  const swatches = (side) => h("div", { class: "kit-row" },
    h("span", { class: "kit-label" }, ui(`${side === "home" ? "主" : "客"} ${model[side].name}`)),
    ...KIT_COLORS.map(([n, v]) => h("button", {
      class: "kit-sw" + (k[side] === v ? " on" : ""), title: n, "aria-label": n,
      style: `background:${v};color:${kitText(v)}`, onclick: () => set({ [side]: v })
    }, k[side] === v ? "✓" : "")));
  const dirBtns = h("div", { class: "kit-row" },
    h("span", { class: "kit-label" }, ui(sport === "football" ? "上半場主隊進攻" : "上半場主隊進攻")),
    h("button", { class: "chip" + (k.dir === "L" ? " on" : ""), onclick: () => set({ dir: "L" }) }, ui("← 往左")),
    h("button", { class: "chip" + (k.dir === "R" ? " on" : ""), onclick: () => set({ dir: "R" }) }, ui("往右 →")),
    k.dir ? h("button", { class: "chip", onclick: () => set({ dir: k.dir === "L" ? "R" : "L" }) }, ui("⇄ 對調")) : null,
    half === "et" && k.dir ? h("button", { class: "chip", onclick: () => set({ etFlip: !k.etFlip }) }, ui("延長賽換邊")) : null);
  const links = [];
  if (sport === "basketball" && !model.league) links.push(h("a", { href: "https://lockervision.nba.com/", target: "_blank", rel: "noopener", class: "chip" }, ui("NBA 官方球衣排程（LockerVision）")));
  return h("details", { class: "fold kit-panel", id: "kit", "data-k": "kit", open: (!k.home || !k.away || !k.dir) && model[sport === "football" ? "minute" : "status"]?.phase !== "ft" ? true : null },
    h("summary", null, h("span", null, ui("🎽 臨場設定：球衣與進攻方向")), " ", sideBadge("away"), " ", sideBadge("home")),
    field, h("p", { class: "faint" }, ui(status)),
    autoUsed ? h("p", { class: "faint" }, ui("球衣顏色已依 ESPN 當場資料自動帶入；點色塊可以改。")) : null,
    swatches("away"), swatches("home"), dirBtns,
    links.length ? h("div", { class: "chips" }, links) : null,
    h("p", { class: "faint" }, ui(sport === "football"
      ? "球衣要看賽前官方公布；進攻方向開賽擲硬幣才決定，下半場自動對調。延長賽會重新擲硬幣，請再確認。只存在這台裝置。"
      : "球衣看賽前官方公布；跳球後確認上半場進攻方向，第三節起自動對調（延長賽沿用下半場方向）。只存在這台裝置。")));
}
