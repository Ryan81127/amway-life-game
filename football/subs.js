/* 輪換：每次換人「幾號誰 → 換成幾號誰」、是不是主力、位置、換人後場上可能的變數。
   名單與換人來自 ESPN；主力判斷看近 5 場先發次數（球星區同一份資料）；變數是規則式推測。 */

const subPick = new Map();
const SUB_GROUP_ZH = { gk: "門將", def: "後衛", mid: "中場", fwd: "前鋒" };

function subName(p) {
  if (!p) return { zh: "未列名", en: "", phon: false };
  const info = typeof nameInfo === "function" ? nameInfo(p.en) : { zh: p.name, source: "dict" };
  const zh = /[㐀-鿿]/.test(p.name || "") ? p.name : info.zh || p.name || p.en;
  return { zh, en: p.en && p.en !== zh ? p.en : "", phon: info.source === "phon" && !/[㐀-鿿]/.test(p.name || "") };
}

/* 主力程度：近 5 場先發次數；沒有資料就看今天是否先發 */
function subRole(model, side, p, ti) {
  const u = ti?.[side]?.recent?.usage?.get(p.id);
  const games = ti?.[side]?.recent?.games || 0;
  if (u && games) {
    const ratio = u.starts / games;
    if (ratio < 0.6 && p.starter) return { label: "今日獲先發", detail: `近 ${games} 場先發 ${u.starts} 次，平常不是固定先發`, level: 1 };
    const label = ratio >= 0.6 ? "主力" : u.starts >= 1 ? "輪換球員" : "替補";
    return { label, detail: `近 ${games} 場先發 ${u.starts} 次`, level: ratio >= 0.6 ? 2 : u.starts >= 1 ? 1 : 0 };
  }
  if (games) return p.starter ? { label: "今日獲先發", detail: `近 ${games} 場沒有出場紀錄`, level: 1 } : { label: "替補", detail: `近 ${games} 場沒有出場紀錄`, level: 0 };
  return { label: p.starter ? "今日先發" : "今日替補", detail: "近期出場資料讀取中或不足", level: p.starter ? 2 : 0 };
}

function subScoreAt(model, side, base) {
  let me = 0, opp = 0;
  for (const ev of model.events || []) {
    if (ev.kind !== "goal" || (ev.base || 0) > base) continue;
    const own = /own goal|烏龍/i.test(ev.style || "");
    const forMe = ev.teamId === model[side].id ? !own : own;
    if (forMe) me += 1; else opp += 1;
  }
  return { me, opp };
}

function subList(model) {
  const out = [];
  const byId = new Map();
  for (const side of ["home", "away"]) for (const p of model.roster?.[side]?.players || []) byId.set(p.id, { p, side });
  const seen = new Set();
  for (const ev of model.events || []) {
    if (ev.kind !== "sub") continue;
    const [inId, outId] = ev.playerIds || [];
    const pin = byId.get(inId);
    const pout = byId.get(outId);
    const side = pin?.side || pout?.side || (ev.teamId === model.home.id ? "home" : "away");
    out.push({ side, min: ev.minuteLabel || "", base: ev.base || 0, pin: pin?.p || null, pout: pout?.p || null, injury: /injur/i.test(ev.text || ev.raw || ""), names: ev.playerNames || [] });
    if (inId) seen.add(inId);
  }
  /* 事件沒有的換人，用名單上的「替換誰」補 */
  for (const side of ["home", "away"]) {
    for (const p of model.roster?.[side]?.players || []) {
      if (!p.inFor || seen.has(p.id)) continue;
      const off = byId.get(p.inFor)?.p || null;
      const min = off?.outMin || p.outMin || "";
      out.push({ side, min, base: parseInt(min, 10) || 0, pin: p, pout: off, injury: false, names: [] });
    }
  }
  return out.sort((a, b) => a.base - b.base);
}

/* ESPN 給替補的位置常是 SUB；換上後的站位以被換下的人為準 */
function subPos(s) {
  const raw = String(s.pin?.posAbbr || "").toUpperCase();
  if (s.pin && raw && raw !== "SUB" && !/替補/.test(s.pin.posZh || "")) return { abbr: s.pin.posAbbr, zh: s.pin.posZh, inherit: false };
  return { abbr: s.pout?.posAbbr || "", zh: s.pout?.posZh || "", inherit: true };
}

function subVariables(model, s, ti) {
  const notes = [];
  const pos = subPos(s);
  const gIn = s.pin ? ltGroup(pos.abbr) : null;
  const gOut = s.pout ? ltGroup(s.pout.posAbbr) : null;
  const rIn = s.pin ? subRole(model, s.side, s.pin, ti) : null;
  const rOut = s.pout ? subRole(model, s.side, s.pout, ti) : null;
  const sc = subScoreAt(model, s.side, s.base);
  const team = model[s.side].name;
  const rank = { gk: 0, def: 1, mid: 2, fwd: 3 };
  if (s.injury) notes.push(`${subName(s.pout).phon ? subName(s.pout).en : subName(s.pout).zh} 因傷退場，屬於被迫換人，不是戰術選擇。`);
  if (gIn && gOut) {
    if (gIn === gOut) notes.push(`${SUB_GROUP_ZH[gOut]}換${SUB_GROUP_ZH[gIn]}，位置對位置，陣型與打法大致不變。`);
    else if (rank[gIn] > rank[gOut]) notes.push(`換下${SUB_GROUP_ZH[gOut]}、換上${SUB_GROUP_ZH[gIn]}，進攻人數增加，${team}要加強進攻。`);
    else notes.push(`換下${SUB_GROUP_ZH[gOut]}、換上${SUB_GROUP_ZH[gIn]}，防守人數增加，${team}偏向守住局面。`);
  }
  if (sc.me < sc.opp && gIn && gOut && rank[gIn] >= rank[gOut]) notes.push(`換人時比分 ${sc.me}:${sc.opp} 落後，這是追分的換人，接下來可能壓上、後防空檔變大。`);
  else if (sc.me > sc.opp && gIn && gOut && rank[gIn] < rank[gOut]) notes.push(`換人時 ${sc.me}:${sc.opp} 領先，這是守成的換人，節奏可能放慢。`);
  else if (sc.me > sc.opp && s.base >= 75) notes.push(`${sc.me}:${sc.opp} 領先下的換人，也有拖延時間、打斷對手節奏的作用。`);
  if (rOut && rIn && rOut.level === 2 && rIn.level === 0) notes.push("主力換替補，個人能力有落差，對手可能針對這個位置施壓。");
  if (rOut && rOut.level === 2 && s.pout?.yellowMins?.length) notes.push(`${subName(s.pout).phon ? subName(s.pout).en : subName(s.pout).zh} 身上已有黃牌，換下也是為了避免吃第二張黃牌。`);
  if (s.pout && (s.pout.goalMins?.length || s.pout.assistMins?.length)) notes.push(`換下的是本場有${s.pout.goalMins?.length ? "進球" : "助攻"}的球員，進攻少了一個已經找到手感的人。`);
  if (s.base >= 60 && gIn && (gIn === "fwd" || gIn === "mid")) notes.push("比賽後段換上新鮮的腿，對手防線體力下滑時，反擊與衝刺會更有威脅。");
  if (!notes.length) notes.push("資料不足以判斷這次換人的意圖，可以觀察接下來 5 分鐘站位有沒有改變。");
  return { notes, rIn, rOut, gIn, gOut, sc };
}

function subCard(model, s, ti) {
  const v = subVariables(model, s, ti);
  const nIn = subName(s.pin);
  const nOut = subName(s.pout);
  const pos = subPos(s);
  const person = (p, n, role, g, cls, arrow, posZh, inherit) => h("div", { class: `sub-p ${cls}` },
    h("div", { class: "sub-arrow" }, arrow),
    h("div", null,
      h("div", { class: "sub-name" }, p?.jersey ? h("span", { class: "sub-no" }, `${p.jersey}`) : null, n.phon ? n.en : ui(n.zh)),
      n.phon ? h("div", { class: "faint" }, ui(`音譯：${n.zh}（未查證）`)) : n.en ? h("div", { class: "faint" }, n.en) : null,
      h("div", { class: "sub-meta" }, ui([g ? SUB_GROUP_ZH[g] : "", posZh && posZh !== SUB_GROUP_ZH[g] ? posZh : ""].filter(Boolean).join("・") + (inherit ? "（接替原位置）" : "") || "位置不明"),
        role ? h("span", { class: `sub-role lv${role.level}` }, ui(role.label)) : null),
      role ? h("div", { class: "faint" }, ui(role.detail)) : null));
  const spk = (n) => (n.phon ? n.en : n.zh);
  const say = `${s.min ? s.min + " " : ""}${model[s.side].name}換人：${s.pout?.jersey ? s.pout.jersey + " 號" : ""}${spk(nOut)}${v.rOut ? `（${v.rOut.label}${v.gOut ? "、" + SUB_GROUP_ZH[v.gOut] : ""}）` : ""}下場，換上 ${s.pin?.jersey ? s.pin.jersey + " 號" : ""}${spk(nIn)}${v.rIn ? `（${v.rIn.label}${v.gIn ? "、" + SUB_GROUP_ZH[v.gIn] : ""}）` : ""}。${v.notes[0] || ""}`;
  const copy = h("button", { class: "copy" }, ui("複製口播"));
  copy.addEventListener("click", () => copyText(speak(say), copy));
  return h("div", { class: "sub-card" },
    h("div", { class: "sub-head" }, h("b", null, s.min || "–"), h("span", null, ui(model[s.side].name)), h("span", { class: "faint" }, ui(`比分 ${v.sc.me}:${v.sc.opp}`))),
    h("div", { class: "sub-pair" }, person(s.pout, nOut, v.rOut, v.gOut, "out", "⬇", s.pout?.posZh, false), person(s.pin, nIn, v.rIn, v.gIn, "in", "⬆", pos.zh, pos.inherit)),
    h("div", { class: "sub-var" }, h("div", { class: "st-label" }, ui("對場上的影響（推測）")), h("ul", null, v.notes.map((x) => h("li", null, ui(x))))),
    h("p", { class: "say" }, ui(say)), copy);
}

function subsBlock(model) {
  const block = h("section", { class: "block", id: "subs" }, h("h2", null, ui("🔄 輪換")));
  const phase = model.minute?.phase;
  if (phase === "pre") {
    block.append(h("p", { class: "muted" }, ui("比賽開始後，每次換人會在這裡列出：誰換誰、是不是主力、站什麼位置，以及對場上的影響。")));
    return block;
  }
  const list = subList(model);
  if (!list.length) {
    const snap = typeof dataSource === "function" && dataSource(model).snapshot;
    block.append(snap
      ? h("p", { class: "muted" }, typeof stTag === "function" ? stTag("missing") : "", ui(" 換人紀錄未收錄：這個聯賽只有賽程快照，沒有換人資料。"))
      : h("p", { class: "muted" }, typeof stTag === "function" ? stTag("zero") : "", ui(" 目前兩隊都還沒有換人（ESPN 即時資料）。")));
    return block;
  }
  const ti = typeof teamInfo === "function" ? teamInfo(model) : null;
  const tiOk = ti?.status === "ok" ? ti : null;
  const live = phase !== "ft";
  const pick = subPick.get(model.id) || "home";
  const count = (side) => list.filter((s) => s.side === side).length;
  const sel = h("select", { class: "sub-select", "aria-label": "選擇球隊", onchange: (e) => { subPick.set(model.id, e.target.value); e.target.blur(); maybeRender({ soft: true }); } },
    [["home", `🏠 主隊 ${model.home.name}（已換 ${count("home")} 人）`], ["away", `✈️ 客隊 ${model.away.name}（已換 ${count("away")} 人）`], ["all", `兩隊全部（共 ${list.length} 次）`]]
      .map(([v, t]) => h("option", { value: v, selected: pick === v }, ui(t))));
  block.append(h("div", { class: "sub-bar" }, sel,
    h("span", { class: `sub-live ${live ? "on" : ""}` }, ui(live ? "● 即時更新中" : "完賽紀錄"))));
  if (live) block.append(h("p", { class: "faint" }, ui("比賽中跟著看板每 20 秒自動更新；ESPN 本身約比電視慢 30–90 秒。最新的換人排在最上面。")));
  /* 口播重點：最新兩次換人（兩隊合併），分鐘、誰下誰上、位置變化；影響是推測，另外標示 */
  {
    const latest = list.slice(-2).reverse();
    const nm = (p) => { const n = subName(p); return `${p?.jersey ? p.jersey + " 號" : ""}${n.phon ? n.en : n.zh}`; };
    const lines = latest.map((x) => {
      const pos = subPos(x);
      const posOut = x.pout?.posZh || "";
      const change = posOut && pos.zh && posOut !== pos.zh ? `位置由${posOut}換成${pos.zh}` : pos.zh ? `同位置換人（${pos.zh}）` : "";
      return `${x.min || "–"} ${model[x.side].name}：${nm(x.pout)}下，${nm(x.pin)}上${change ? `，${change}` : ""}。`;
    });
    const v = latest[0] ? subVariables(model, latest[0], tiOk) : null;
    if (v?.notes?.[0]) lines.push(`（推測）${v.notes[0]}`);
    const sb = scriptBlock(lines, "最新換人");
    if (sb) { sb.classList.add("lead"); block.append(sb); }
  }
  const sides = pick === "all" ? ["home", "away"] : [pick];
  for (const side of sides) {
    let mine = list.filter((s) => s.side === side);
    if (live) mine = mine.slice().reverse();
    if (pick === "all") block.append(h("h3", null, ui(`${side === "home" ? "🏠" : "✈️"} ${model[side].name}　已換 ${mine.length} 人`)));
    if (!mine.length) { block.append(h("p", { class: "faint" }, ui(`${model[side].name}還沒有換人。`))); continue; }
    for (const s of mine) block.append(subCard(model, s, tiOk));
  }
  block.append(h("p", { class: "faint" }, ui(`主力判斷看近 5 場先發次數（先發 ≥ 6 成為主力）${tiOk ? "" : "，近期資料讀取中，暫以今天是否先發判斷"}。查不到中文譯名的球員先顯示英文原名，下方附系統音譯（未查證）。影響分析是依位置、比分、時間的推測。`)));
  return block;
}
