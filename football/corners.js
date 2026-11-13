/* 角球：ESPN 技術統計 → 文字轉播逐筆 → 主播手動計數，三層來源；含每 15 分鐘、上下半場、節奏推估與大小線機率。 */

const CORNER_PREFIX = "fb-corner-v1:";

function cornerManual(id) {
  try { return JSON.parse(localStorage.getItem(CORNER_PREFIX + id) || "[]"); } catch { return []; }
}

function cornerSave(id, list) {
  try { localStorage.setItem(CORNER_PREFIX + id, JSON.stringify(list)); } catch { /* 略過 */ }
}

function cornerAdd(model, side) {
  const m = model.minute || {};
  const list = cornerManual(model.id);
  list.push({ side, period: m.period || (m.base > 45 ? 2 : 1), base: m.base || 0, t: Date.now() });
  cornerSave(model.id, list);
  maybeRender({ soft: true });
}

function cornerUndo(model) {
  const list = cornerManual(model.id);
  list.pop();
  cornerSave(model.id, list);
  maybeRender({ soft: true });
}

/* ESPN 有些賽事（友誼賽常見）技術統計整排都是 0，不能當真 */
function espnStatsEmpty(model) {
  if (model.stats?.mode !== "match") return true;
  const keys = ["possessionPct", "totalShots", "shotsOnTarget", "wonCorners", "foulsCommitted", "totalPasses"];
  return keys.every((k) => !Number(model.stats.home[k]) && !Number(model.stats.away[k]));
}

function cornerData(model) {
  const comm = (model.commentary || []).filter((it) => it.corner && it.side).map((it) => ({ side: it.side, period: it.period, base: it.base }));
  const manual = cornerManual(model.id);
  const espnOk = !espnStatsEmpty(model) && model.stats.home.wonCorners != null;
  const espn = espnOk ? { home: Number(model.stats.home.wonCorners) || 0, away: Number(model.stats.away.wonCorners) || 0 } : null;
  let log = null;
  let totals = null;
  let source = "none";
  if (espn) {
    totals = espn;
    source = "espn";
    if (comm.length && Math.abs(comm.length - (espn.home + espn.away)) <= 2) log = comm;
  } else if (comm.length && commRich(model)) {
    log = comm;
    source = "comm";
  } else if (manual.length) {
    log = manual;
    source = "manual";
  }
  if (log && !totals) totals = { home: log.filter((x) => x.side === "home").length, away: log.filter((x) => x.side === "away").length };
  return { source, totals, log, manual, espn };
}

const CORNER_SRC = { espn: "ESPN 技術統計", comm: "ESPN 文字轉播逐筆", manual: "主播手動計數", none: "尚無資料" };

function poisCdfAbove(lambda, k) {
  /* P(X > k)，X ~ Poisson(lambda) */
  let p = Math.exp(-lambda);
  let cdf = p;
  for (let i = 1; i <= k; i += 1) { p *= lambda / i; cdf += p; }
  return Math.max(0, 1 - cdf);
}

function cornerBlock(model) {
  const m = model.minute || {};
  if (m.phase === "pre") {
    return h("section", { class: "block", id: "corners" }, h("h2", null, ui("角球預測")), cornerHistSection(model));
  }
  const d = cornerData(model);
  const H = model.home.name;
  const A = model.away.name;
  const block = h("section", { class: "block", id: "corners" }, h("h2", null, ui("角球")));
  const live = m.state === "in";
  if (d.totals) {
    const tot = d.totals.home + d.totals.away;
    block.append(h("div", { class: "corner-score" },
      h("span", null, ui(H)), h("b", null, `${d.totals.home} : ${d.totals.away}`), h("span", null, ui(A))),
      h("p", { class: "faint" }, ui(`來源：${CORNER_SRC[d.source]}${d.source === "manual" ? "（這場 ESPN 沒有角球資料）" : ""} · 共 ${tot} 角`)));
    if (d.log && d.log.length) {
      const halves = [1, 2].map((p) => ({ p, h: d.log.filter((x) => x.period === p && x.side === "home").length, a: d.log.filter((x) => x.period === p && x.side === "away").length }));
      const segRows = SEGMENTS.map((seg) => {
        const items = d.log.filter((x) => inSeg(x, seg));
        return { cells: [seg.title, String(items.filter((x) => x.side === "home").length), String(items.filter((x) => x.side === "away").length)] };
      });
      block.append(predTable(["時段", H, A], [
        ...segRows,
        { cls: "best", cells: ["上半場", String(halves[0].h), String(halves[0].a)] },
        { cls: "best", cells: ["下半場", String(halves[1].h), String(halves[1].a)] }
      ]));
    } else if (d.source === "espn") {
      block.append(h("p", { class: "faint" }, ui("ESPN 只給總數，沒有逐筆時間，所以分不出時段。")));
    }
    /* 節奏推估：歷史模型預估剩餘時間 + 本場實際節奏 */
    const played = m.phase === "ft" || m.state === "post" ? 90 : Math.min(90, (m.period === 2 ? Math.max(45, m.base || 45) : Math.min(45, m.base || 0)));
    const lp = cornerLiveProjection(model, tot);
    if (live && lp) {
      const remainMin = Math.max(0, 90 - played);
      const rate = played >= 10 ? tot / played : null;
      const rest = rate != null ? lp.rest * 0.7 + rate * remainMin * 0.3 : lp.rest;
      const proj = tot + rest;
      block.append(h("p", null, ui(`賽前歷史模型：上半場 ${trimNum(lp.cm.h1)}、下半場 ${trimNum(lp.cm.h2)}、全場 ${trimNum(lp.cm.mu)} 角。${rate != null ? `本場目前節奏每 90 分鐘 ${trimNum(rate * 90)} 角，` : ""}綜合預估剩下還有約 ${trimNum(rest)} 角，全場約 ${trimNum(proj)} 角。`)));
      const lines = [];
      for (let L = Math.floor(tot) + 0.5; lines.length < 4 && L < tot + 9; L += 1) lines.push(L);
      block.append(predTable(["全場角球大小線", "大", "小"], lines.map((L) => {
        const p = nbOver(rest, L - tot, 1.4);
        return { cells: [`${trimNum(L)}`, pct(p), pct(1 - p)] };
      })));
      if ((m.period || 1) === 1 && m.phase !== "ht" && d.log) {
        const h1now = d.log.filter((x) => x.period === 1).length;
        const restH1 = lp.cm.h1 * Math.max(0, 45 - (m.base || 0)) / 45;
        block.append(h("p", { class: "faint" }, ui(`上半場目前 ${h1now} 角，預估上半場結束約 ${trimNum(h1now + restH1)} 角。`)));
      }
    } else if ((m.phase === "ft" || m.state === "post") && chStore.get(model.id)?.cm) {
      const cm = chStore.get(model.id).cm;
      const h1 = d.log ? d.log.filter((x) => x.period === 1).length : null;
      block.append(h("p", null, ui(`賽前歷史模型預估：上半場 ${trimNum(cm.h1)}、下半場 ${trimNum(cm.h2)}、全場 ${trimNum(cm.mu)} 角；實際${h1 != null ? `上半場 ${h1}、下半場 ${tot - h1}、` : ""}全場 ${tot} 角（${Math.abs(tot - cm.mu) <= 2 ? "誤差 2 角內，算準" : "差距較大"}）。`)));
    }
    const lead = d.totals.home === d.totals.away ? null : d.totals.home > d.totals.away ? H : A;
    const gap = Math.abs(d.totals.home - d.totals.away);
    const say = [
      `角球目前 ${H} ${d.totals.home}、${A} ${d.totals.away}。`,
      lead && gap >= 3 ? `${lead}角球多了 ${gap} 個，代表一直把球壓在對方禁區附近，定位球是破門的好機會。` : "角球數差不多，雙方都還在找突破口。",
      tot >= 8 && live ? "角球已經這麼多了，下一個角球大家注意看，高球爭頂最容易出事。" : "",
      "下一個角球會不會直接變進球？會的扣 1！"
    ].filter(Boolean);
    block.append(scriptBlock(say, "口播：角球"));
  } else {
    const lp = cornerLiveProjection(model, 0);
    if (lp) block.append(h("p", null, ui(`賽前歷史模型：上半場 ${trimNum(lp.cm.h1)}、下半場 ${trimNum(lp.cm.h2)}、全場 ${trimNum(lp.cm.mu)} 角。`)));
    block.append(h("p", { class: "muted" }, ui(live ? "這場 ESPN 沒有提供角球資料（友誼賽與部分聯賽常見）。看直播時用下面按鈕手動記錄，看板會自動算時段、半場與節奏。" : "這場沒有角球資料。")));
  }
  block.append(h("details", { class: "fold", "data-k": "ch-wrap" }, h("summary", null, ui("📚 賽前角球預測（兩隊歷史資料）")), cornerHistSection(model)));
  if (live || d.manual.length) {
    const controls = h("div", { class: "corner-btns" },
      h("button", { class: "chip", onclick: () => cornerAdd(model, "home") }, ui(`＋1 ${H}`)),
      h("button", { class: "chip", onclick: () => cornerAdd(model, "away") }, ui(`＋1 ${A}`)),
      h("button", { class: "chip", onclick: () => cornerUndo(model), disabled: !d.manual.length }, ui("↩ 復原")));
    if (d.source === "manual" || d.source === "none") block.append(controls, h("p", { class: "faint" }, ui(`手動記錄會記下當下比賽分鐘（${m.base || 0}'），只存在這台裝置。已記 ${d.manual.length} 筆。`)));
    else block.append(h("details", { class: "fold" }, h("summary", null, ui("手動計數（ESPN 有資料時以 ESPN 為準）")), controls));
  }
  return block;
}
