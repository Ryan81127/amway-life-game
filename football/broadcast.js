/* 直播操作（依《足球轉播看板優化建議》第一版）
   1. 資料狀態：頂部固定比分列，寫清楚來源與更新時間；缺資料分四種狀態。
   2. 即時口播卡：5 秒即讀、15 秒延伸、下一眼看點。
   3. 播報節點：開場、上半場特一／特二、中場、下半場特一／特二、終場；特一特二分鐘可設定。
   4. 手動場景按鈕：帶球、抄截、反擊、二點球、射門、進球、VAR，資料延遲時也能用。
   原則：只用畫面上的資料；觀察點是提示，不是預測；缺資料就明說。 */

/* ---------- 資料狀態 ---------- */
const ST_KIND = {
  ok: { t: "已確認", c: "st-ok" },
  zero: { t: "已確認為零", c: "st-zero" },
  missing: { t: "來源未提供", c: "st-missing" },
  pending: { t: "待核對", c: "st-pending" },
  na: { t: "不適用", c: "st-na" }
};
function stTag(kind, text) {
  const k = ST_KIND[kind] || ST_KIND.pending;
  return h("span", { class: `st-tag ${k.c}` }, ui(text || k.t));
}

function dataSource(model) {
  const L = typeof snapLeagueOf === "function" ? snapLeagueOf(model?.leagueSlug) || snapLeagueOf(model?.id) : null;
  if (L) {
    const pack = typeof snapPacks !== "undefined" ? snapPacks[L.slug] : null;
    return { snapshot: true, league: L.zh, name: `${L.zh}賽程快照`, at: pack?.fetched || "", source: pack?.source || "" };
  }
  return { snapshot: false, name: "ESPN", at: state.pulseAt || state.summaryLoadedAt || 0 };
}

/* 先發名單缺漏時的說法（取代原本一律「等待公布」） */
function lineupMissingText(model) {
  const src = dataSource(model);
  if (src.snapshot) return "來源未提供先發名單（快照聯賽只有賽程與比分）。";
  if (model?.minute?.phase === "pre") return "先發名單待公布（通常開賽前約 1 小時）。";
  return "ESPN 這場沒有提供先發名單。";
}

function fmtAgo(at) {
  if (!at) return "";
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  return sec < 60 ? `${sec} 秒前` : `${Math.round(sec / 60)} 分鐘前`;
}

/* 頂部固定比分列：切區時比分、時間、來源一直都在 */
function stickyBar(model) {
  const src = dataSource(model);
  const pre = model.minute.phase === "pre";
  const score = pre ? `${taipeiHM(model.kickoff)} 開賽` : `${model.home.score ?? "–"} : ${model.away.score ?? "–"}`;
  const clock = pre ? "" : model.minute.label || phaseText(model.minute);
  const srcText = src.snapshot
    ? `來源：${src.name}${src.at ? `（${src.at}）` : ""}・沒有即時比分`
    : `來源：ESPN・${fmtAgo(src.at) || "讀取中"}更新・約比電視慢 30–90 秒`;
  return h("div", { class: "sticky-bar", id: "sticky-bar" },
    h("div", { class: "sb-main" },
      h("span", { class: "sb-team" }, model.home.name),
      h("b", { class: "sb-score" }, score),
      h("span", { class: "sb-team" }, model.away.name),
      clock ? h("span", { class: `sb-clock${model.minute.state === "in" ? " live" : ""}` }, ui(clock)) : null),
    h("div", { class: `sb-src${src.snapshot ? " snap" : ""}` }, ui(srcText)));
}

/* ---------- 共用：比分與事件 ---------- */
const bcGoals = (model) => (model.events || []).filter((e) => e.kind === "goal").sort((a, b) => eventSort(a) - eventSort(b));
function bcScoreAt(model, minute) {
  let hs = 0, as = 0;
  for (const g of bcGoals(model)) {
    if ((g.base || 0) > minute) continue;
    const side = goalSide(g, model);
    if (side === "home") hs += 1; else if (side === "away") as += 1;
  }
  return [hs, as];
}
const bcScoreText = (model, hs, as) => (hs === as ? `${hs} 比 ${as} 平手` : `${hs > as ? model.home.name : model.away.name} ${Math.max(hs, as)} 比 ${Math.min(hs, as)} 領先`);
const bcNum = (n) => ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] ?? String(n);
function bcGoalLine(model, g) {
  const team = g.teamName || (goalSide(g, model) === "home" ? model.home.name : model.away.name);
  const how = g.style === "頭槌" ? "頭球破門" : g.style === "點球" ? "點球命中" : g.style === "烏龍" ? "對手烏龍球" : "破門";
  const who = g.scorer ? `${team}的${g.scorer}` : team;
  return `第 ${g.base || "?"} 分鐘，${who}${how}`;
}
const bcMin = (model) => (model.minute.phase === "pre" ? 0 : model.minute.phase === "ht" ? 45 : model.minute.phase === "ft" || model.minute.state === "post" ? 90 : model.minute.base || 0);

/* ---------- 即時口播：5 秒／15 秒／下一眼 ---------- */
function bcLines(model) {
  const H = model.home.name, A = model.away.name;
  const ph = model.minute.phase;
  const done = ph === "ft" || model.minute.state === "post";
  const hs = Number(model.home.score) || 0, as = Number(model.away.score) || 0;
  const now = bcMin(model);
  const goals = bcGoals(model);
  const last = goals[goals.length - 1];
  const reds = (model.events || []).filter((e) => e.kind === "red");
  const recentRed = reds.find((e) => now - (e.base || 0) <= 10);
  const scoreNow = `現在 ${bcNum(hs)} 比 ${bcNum(as)}`;
  const src = dataSource(model);
  let quick, longer, next;
  if (ph === "pre") {
    quick = `台北時間 ${taipeiHM(model.kickoff)}，${H} 主場迎戰 ${A}。`;
    longer = `${quick}${model.venue ? `比賽在${model.venue}。` : ""}開賽前先看雙方先發名單，確認主力有沒有輪換。`;
    next = "開場前 15 分鐘看誰能先把球帶進對方禁區，誰先站穩節奏。";
  } else if (done) {
    quick = `終場，${hs === as ? `${H} 和 ${A} ${hs} 比 ${as} 握手言和` : `${hs > as ? H : A} ${Math.max(hs, as)} 比 ${Math.min(hs, as)} 擊敗 ${hs > as ? A : H}`}。`;
    const how = goals.length ? goals.map((g) => bcGoalLine(model, g)).join("；") + "。" : hs + as === 0 ? "全場沒有進球。" : src.snapshot ? "進球者與分鐘：來源未提供。" : "";
    longer = `${quick}${how}`;
    next = "復盤重點：比分是在哪一段被拉開的，落後方換人之後有沒有改變場面。";
  } else if (ph === "ht") {
    quick = `中場休息，${bcScoreText(model, hs, as)}。`;
    const how = goals.length ? `比分怎麼來：${goals.map((g) => bcGoalLine(model, g)).join("；")}。` : hs + as === 0 ? "上半場雙方都沒有破門。" : "";
    longer = `${quick}${how}${hs !== as ? `${hs > as ? H : A}帶著領先進中場，下半場看${hs > as ? A : H}會不會把進攻往前推。` : "下半場誰先換上進攻球員，誰就先表態。"}`;
    next = hs !== as ? `下半場開始留意${hs > as ? A : H}的邊路站位：邊路壓上，身後空間會不會給對手反擊？` : "下半場開始看哪一隊先提高壓迫位置。";
  } else {
    if (last && now - (last.base || 0) <= 5) quick = `${bcGoalLine(model, last)}！${scoreNow}。`;
    else if (recentRed) quick = `第 ${recentRed.base} 分鐘，${recentRed.teamName || ""}${recentRed.playerNames?.[0] ? `的${recentRed.playerNames[0]}` : ""}吃到紅牌！${scoreNow}。`;
    else quick = `第 ${now} 分鐘，${hs === as ? `雙方 ${hs} 比 ${as}` : bcScoreText(model, hs, as)}。`;
    const how = goals.length ? `比分怎麼來：${goals.map((g) => bcGoalLine(model, g)).join("；")}。` : "";
    const stat = typeof gapLines === "function" ? gapLines(model)[0] || "" : "";
    longer = `${quick}${how}${stat ? `數據上，${stat}` : ""}`;
    if (recentRed) next = `少一人的${recentRed.teamName || "那一隊"}會不會退回去守？看對手有沒有把邊後衛壓上來。`;
    else if (hs !== as && now >= 70) next = `最後 ${Math.max(5, 90 - now)} 分鐘，看落後的${hs > as ? A : H}有沒有換上第二名前鋒、把中衛推上去。`;
    else if (hs !== as) next = `留意落後的${hs > as ? A : H}邊路站位：如果邊路壓上，身後空間會不會給${hs > as ? H : A}反擊？`;
    else if (now >= 70) next = "比分還是平手，最後階段看哪一隊先換上進攻球員。";
    else next = "看哪一隊能連續兩次把球帶進禁區，誰在中場搶到第二點。";
  }
  return { quick, longer, next };
}

/* ---------- 播報節點 ---------- */
const BC_NODE_KEY = "fb-nodes-v1";
function bcNodeCfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(BC_NODE_KEY) || "{}"); } catch { /* 預設 */ }
  return { h1a: c.h1a || 15, h1b: c.h1b || 30, h2a: c.h2a || 60, h2b: c.h2b || 75 };
}
function bcNodes() {
  const c = bcNodeCfg();
  return [
    { id: "ko", label: "開場", from: 0, to: 0 },
    { id: "h1a", label: `上半特一 ${c.h1a}'`, from: 0, to: c.h1a },
    { id: "h1b", label: `上半特二 ${c.h1b}'`, from: c.h1a, to: c.h1b },
    { id: "ht", label: "中場", from: 0, to: 45 },
    { id: "h2a", label: `下半特一 ${c.h2a}'`, from: 45, to: c.h2a },
    { id: "h2b", label: `下半特二 ${c.h2b}'`, from: c.h2a, to: c.h2b },
    { id: "ft", label: "終場", from: 0, to: 90 }
  ];
}
const bcUi = new Map();
function bcUiOf(model) {
  if (!bcUi.has(model.id)) bcUi.set(model.id, { node: null, scene: null, side: "home", cfg: false });
  return bcUi.get(model.id);
}

function bcNodeCard(model, node) {
  const now = bcMin(model);
  const reached = model.minute.phase !== "pre" && (node.id === "ko" || now >= node.to || model.minute.phase === "ft" || model.minute.state === "post");
  const H = model.home.name, A = model.away.name;
  const card = h("div", { class: "bc-node-card" }, h("h4", null, ui(node.label)));
  if (!reached) {
    card.append(h("p", { class: "faint" }, ui(model.minute.phase === "pre" ? "比賽還沒開始，到這個時間點會自動整理這一段。" : `還沒到第 ${node.to} 分鐘，到了會自動整理這一段。`)));
    return card;
  }
  if (node.id === "ko") {
    card.append(h("p", { class: "say" }, ui(`${H} 對 ${A}，比賽開始！`)), h("p", { class: "faint" }, ui("開場觀察：誰先把球帶進對方三十米區、誰的壓迫位置比較高。")));
    return card;
  }
  const [hs, as] = bcScoreAt(model, node.to);
  const [ps, pa] = bcScoreAt(model, node.from);
  const seg = (model.events || []).filter((e) => ["goal", "red", "yellow", "sub"].includes(e.kind) && (e.base || 0) > node.from && (e.base || 0) <= node.to);
  const src = dataSource(model);
  const lines = [`到第 ${node.to} 分鐘：${bcScoreText(model, hs, as)}。`];
  if (seg.length) lines.push(`這段關鍵事件：${seg.slice(0, 4).map((e) => e.kind === "goal" ? bcGoalLine(model, e) : e.kind === "sub" ? `${e.base}' ${e.teamName}換人${e.subOn ? `（${e.subOn} 上）` : ""}` : `${e.base}' ${e.teamName}${e.kind === "red" ? "紅牌" : "黃牌"}`).join("；")}。`);
  else if (src.snapshot) lines.push("這段的事件：來源只記錄進球，其他事件未收錄。");
  else lines.push("這段沒有進球、紅牌或換人。");
  lines.push(hs === ps && as === pa ? "上一段判斷：比分沒有變化，場面要看誰先改變節奏。" : `上一段判斷：比分從 ${ps} 比 ${pa} 變成 ${hs} 比 ${as}，場面已經改變。`);
  if (node.id === "ft") lines.push("終場復盤：從比分怎麼形成講起，再講落後方的調整有沒有奏效。");
  else lines.push(hs !== as ? `下一段觀察：落後的${hs > as ? A : H}會不會壓上、換上進攻球員。` : "下一段觀察：誰先在中場搶到第二點、誰先換人。");
  card.append(...lines.map((x) => h("p", { class: "say" }, ui(x))));
  const b = h("button", { class: "copy" }, ui("複製這一段"));
  b.addEventListener("click", () => copyText(lines.map((x) => speak(x)).join("\n"), b));
  card.append(b);
  return card;
}

function bcNodeBar(model) {
  const u = bcUiOf(model);
  const now = bcMin(model);
  const live = model.minute.phase !== "pre";
  const done = model.minute.phase === "ft" || model.minute.state === "post";
  const nodes = bcNodes();
  const bar = h("div", { class: "bc-nodes" });
  for (const n of nodes) {
    const reached = live && (n.id === "ko" || now >= n.to || done);
    bar.append(h("button", { class: `chip bc-node${reached ? " done" : ""}${u.node === n.id ? " on" : ""}`, onclick: () => { u.node = u.node === n.id ? null : n.id; maybeRender({ soft: true }); } }, ui(n.label)));
  }
  bar.append(h("button", { class: "chip bc-node bc-cfg", title: "設定特一、特二分鐘", onclick: () => { u.cfg = !u.cfg; maybeRender({ soft: true }); } }, "⚙️"));
  const out = h("div", { class: "bc-nodes-wrap" }, bar);
  if (u.cfg) {
    const c = bcNodeCfg();
    const field = (k, label) => h("label", null, ui(label), h("input", { type: "number", min: "1", max: "90", value: String(c[k]), onchange: (e) => {
      const v = Math.max(1, Math.min(90, Number(e.target.value) || c[k]));
      const next = { ...bcNodeCfg(), [k]: v };
      try { localStorage.setItem(BC_NODE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      maybeRender({ soft: true });
    } }));
    out.append(h("div", { class: "bc-cfg-box" }, field("h1a", "上半特一"), field("h1b", "上半特二"), field("h2a", "下半特一"), field("h2b", "下半特二"), h("p", { class: "faint" }, ui("分鐘數存在這台裝置，之後每場都會用。"))));
  }
  const pick = nodes.find((n) => n.id === u.node);
  if (pick) out.append(bcNodeCard(model, pick));
  return out;
}

/* ---------- 手動場景按鈕 ---------- */
const BC_SCENES = [
  ["dribble", "帶球"], ["steal", "抄截"], ["counter", "反擊"], ["second", "二點球"], ["shot", "射門"], ["goal", "進球"], ["var", "VAR"]
];
function bcScene(model, key, side) {
  const T = model[side].name;
  const O = model[side === "home" ? "away" : "home"].name;
  const hs = Number(model.home.score) || 0, as = Number(model.away.score) || 0;
  const nh = side === "home" ? hs + 1 : hs, na = side === "away" ? as + 1 : as;
  const S = {
    dribble: [`${T}帶球推進，還在往前！`, "看中路有沒有人跟上接應。"],
    steal: [`${T}把球斷下來了！`, `球權換邊，看${T}第一腳能不能直接打到前場。`],
    counter: [`${T}打反擊！人數夠不夠？`, `看${O}的後衛能不能及時回追，邊路有沒有人插上。`],
    second: [`二點球被${T}拿到！`, `禁區外有沒有人準備起腳？${O}要趕快把防線往前推。`],
    shot: [`${T}起腳！`, "看重播，這腳是怎麼找到起腳空間的。"],
    goal: [`起腳！球進了！${T}進球！`, `比分待確認：${model.home.name} ${nh} 比 ${na} ${model.away.name}。看重播，這球是哪個環節打開的。`],
    var: ["球進了，裁判還在等 VAR 確認。", "比分先等裁判確認，我們一起看重播。"]
  };
  return S[key];
}

function bcSceneBox(model) {
  const u = bcUiOf(model);
  const box = h("div", { class: "bc-scenes" },
    h("div", { class: "bc-scene-head" },
      h("span", { class: "faint" }, ui("手動場景（看畫面就按，不用等資料）")),
      h("span", { class: "bc-side" },
        ...["home", "away"].map((s) => h("button", { class: `chip${u.side === s ? " on" : ""}`, onclick: () => { u.side = s; maybeRender({ soft: true }); } }, ui(model[s].name))))),
    h("div", { class: "bc-scene-btns" }, BC_SCENES.map(([k, label]) => h("button", { class: `chip bc-scene${u.scene === k ? " on" : ""}`, onclick: () => { u.scene = u.scene === k ? null : k; maybeRender({ soft: true }); } }, ui(label)))));
  if (u.scene) {
    const [now, later] = bcScene(model, u.scene, u.side);
    const b = h("button", { class: "copy" }, ui("複製"));
    b.addEventListener("click", () => copyText(`${speak(now)}\n${speak(later)}`, b));
    box.append(h("div", { class: "bc-scene-out" },
      h("p", null, h("span", { class: "bc-k" }, ui("立即播")), h("b", null, ui(now))),
      h("p", null, h("span", { class: "bc-k" }, ui("有空再接")), ui(later)), b));
  }
  return box;
}

/* ---------- 首屏卡 ---------- */
function liveCard(model) {
  const { quick, longer, next } = bcLines(model);
  const row = (k, text, strong) => {
    const b = h("button", { class: "copy mini" }, ui("複製"));
    b.addEventListener("click", () => copyText(speak(text), b));
    return h("div", { class: "bc-row" }, h("span", { class: "bc-k" }, ui(k)), h("p", { class: strong ? "bc-quick" : "" }, ui(text)), b);
  };
  const card = h("section", { class: "bc-card", id: "bc-card" },
    h("div", { class: "bc-title" }, ui("🎙️ 即時口播")),
    bcNodeBar(model),
    row("5 秒即讀", quick, true),
    row("15 秒延伸", longer),
    row("下一眼看點", next));
  const done = model.minute.phase === "ft" || model.minute.state === "post";
  if (model.minute.phase !== "pre" && !done) card.append(bcSceneBox(model));
  const src = dataSource(model);
  if (src.snapshot) {
    const goalsKnown = bcGoals(model).length > 0 || (Number(model.home.score) || 0) + (Number(model.away.score) || 0) === 0;
    card.append(h("div", { class: "bc-status" },
      h("span", null, ui("比分 "), model.minute.phase === "pre" ? stTag("na", "未開賽") : stTag("ok")),
      h("span", null, ui("進球者 "), done ? (goalsKnown ? stTag("ok") : stTag("missing")) : stTag("missing")),
      h("span", null, ui("換人、牌 "), stTag("missing")),
      h("span", null, ui("技術統計 "), stTag("missing"))));
  }
  return card;
}
