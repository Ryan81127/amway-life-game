/* 完賽對帳：開賽前與滾球當下各存一份快照，完賽後只拿快照對 ESPN 的實際數字。
   沒有快照就不補算，避免用賽後資料假裝是當時的預測。快照只存在這台裝置。 */

const LEDGER_PREFIX = "fb-ledger-v1:";

function ledgerRead(id) {
  try {
    const raw = JSON.parse(localStorage.getItem(LEDGER_PREFIX + id) || "null");
    if (!raw || typeof raw !== "object") return null;
    raw.live = Array.isArray(raw.live) ? raw.live : [];
    raw.cornerLive = Array.isArray(raw.cornerLive) ? raw.cornerLive : [];
    return raw;
  } catch {
    return null;
  }
}

function ledgerWrite(id, bag) {
  try { localStorage.setItem(LEDGER_PREFIX + id, JSON.stringify(bag)); } catch { /* 空間不足就算了 */ }
}

function ledgerBag(id) {
  return ledgerRead(id) || { pre: null, live: [], corners: null, cornerLive: [] };
}

function ledgerFinal(model) {
  const m = model.minute || {};
  return m.phase === "ft" || m.state === "post";
}

function ledgerMinuteKey(model) {
  const m = model.minute || {};
  if (m.phase === "ht") return "ht";
  return String(Math.round(m.base || 0));
}

function ledgerMinuteLabel(key) {
  return key === "ht" ? "中場" : `${key}'`;
}

function resultName(code) {
  return { home: "主勝", draw: "和局", away: "客勝" }[code] || "";
}

function cornerPick(cm) {
  const base = Math.floor(cm.mu) + 0.5;
  const opts = [];
  for (const L of [base - 1, base, base + 1]) {
    if (L <= 0 || typeof nbOver !== "function") continue;
    const over = nbOver(cm.mu, L);
    opts.push(over >= 1 - over ? { side: "over", line: L, p: over } : { side: "under", line: L, p: 1 - over });
  }
  opts.sort((a, b) => b.p - a.p);
  return opts[0] || null;
}

function cornerItem(cm, pick, cat) {
  const word = pick.side === "over" ? "大於" : "小於";
  return {
    cat: cat || "corner",
    kind: "corners-ou",
    side: pick.side,
    line: pick.line,
    mu: cm.mu,
    text: `角球${word} ${trimNum(pick.line)}（預估 ${trimNum(cm.mu)}）`
  };
}

function marketCornerItem(mk) {
  if (!mk?.rows?.length) return null;
  const opts = mk.rows.map((x) => (x.over >= x.under ? { side: "over", line: x.L, p: x.over } : { side: "under", line: x.L, p: x.under }));
  opts.sort((a, b) => b.p - a.p);
  const pick = opts[0];
  if (!pick) return null;
  const word = pick.side === "over" ? "大於" : "小於";
  return { cat: "corner", kind: "corners-ou", side: pick.side, line: pick.line, mu: mk.mu, text: `角球${word} ${trimNum(pick.line)}（預估 ${trimNum(mk.mu)}）`, src: "pred" };
}

function marketCardItem(mk) {
  if (!mk?.rows?.length) return null;
  const opts = mk.rows.map((x) => (x.over >= x.under ? { side: "over", line: x.L, p: x.over } : { side: "under", line: x.L, p: x.under }));
  opts.sort((a, b) => b.p - a.p);
  const pick = opts[0];
  if (!pick) return null;
  const word = pick.side === "over" ? "大於" : "小於";
  return { cat: "corner", kind: "cards-ou", side: pick.side, line: pick.line, mu: mk.mu, text: `黃牌${word} ${trimNum(pick.line)}（預估 ${trimNum(mk.mu)}）` };
}

function preItemsFromPred(pred) {
  const items = [];
  const top = pred.top || {};
  const fav = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
  if (fav) items.push({ cat: "pre", kind: "1x2", pick: fav[0], text: resultName(fav[0]) });
  const ah = pred.markets?.find((x) => x.id === "ah");
  const mkAh = ah?.ahRows?.find((x) => x.isMarket) || ah?.ahRows?.[0];
  if (mkAh && typeof pickSide === "function") {
    const side = pickSide(mkAh.home, mkAh.away) ? "home" : "away";
    const line = side === "home" ? mkAh.L : -mkAh.L;
    items.push({ cat: "pre", kind: "ah", side, line, text: ahWords(side, line) });
  }
  const ou = pred.markets?.find((x) => x.id === "ou");
  const mkOu = ou?.ouRows?.find((x) => x.isMarket) || ou?.ouRows?.find((x) => Math.abs(x.L - 2.5) < 1e-9);
  if (mkOu && typeof pickSide === "function") {
    const side = pickSide(mkOu.over, mkOu.under) ? "over" : "under";
    items.push({ cat: "pre", kind: "ou", side, line: mkOu.L, text: `全場${side === "over" ? "大於" : "小於"} ${trimNum(mkOu.L)}` });
  }
  const bt = pred.markets?.find((x) => x.id === "btts");
  if (bt) {
    items.push({ cat: "pre", kind: "btts", yes: bt.btts >= 0.5, text: bt.btts >= 0.5 ? "雙方進球" : "不會雙方進球" });
    if (bt.scores?.[0]?.s) items.push({ cat: "pre", kind: "score", score: bt.scores[0].s, text: String(bt.scores[0].s).replace("-", ":") });
  }
  const ht = pred.markets?.find((x) => x.id === "ht");
  if (ht?.r1) {
    const r = ht.r1;
    const pick = r.draw >= Math.max(r.home, r.away) ? "draw" : r.home >= r.away ? "home" : "away";
    items.push({ cat: "pre", kind: "ht", pick, text: pick === "draw" ? "半場和局" : pick === "home" ? "半場主勝" : "半場客勝" });
    items.push({ cat: "pre", kind: "ht-ou", side: ht.o05 >= 0.5 ? "over" : "under", line: 0.5, text: ht.o05 >= 0.5 ? "半場大於 0.5" : "半場小於 0.5" });
  }
  const co = marketCornerItem(pred.markets?.find((x) => x.id === "corners"));
  if (co) items.push(co);
  const ca = marketCardItem(pred.markets?.find((x) => x.id === "cards"));
  if (ca) items.push(ca);
  return items;
}

function liveItemsFrom(model, st, mk) {
  const H = model.home.name;
  const A = model.away.name;
  const items = [];
  const fav = [["home", mk.win], ["draw", mk.draw], ["away", mk.lose]].sort((a, b) => b[1] - a[1])[0];
  items.push({ cat: "live", kind: "1x2", pick: fav[0], text: resultName(fav[0]) });
  const next = [["home", mk.nextH, `${H}進下一球`], ["none", mk.p0, "不會再進球"], ["away", mk.nextA, `${A}進下一球`]].sort((a, b) => b[1] - a[1])[0];
  items.push({ cat: "live", kind: "next", pick: next[0], text: next[2] });
  const ou = mk.ou.map((x) => (x.over >= x.under ? { side: "over", line: x.L, p: x.over } : { side: "under", line: x.L, p: x.under })).sort((a, b) => b.p - a.p)[0];
  if (ou) items.push({ cat: "live", kind: "ou", side: ou.side, line: ou.line, text: `全場${ou.side === "over" ? "大於" : "小於"} ${trimNum(ou.line)}` });
  let ah = null;
  for (const x of mk.ah || []) {
    if (!ah || x.home > ah.p) ah = { side: "home", line: x.L, p: x.home };
    if (x.away > ah.p) ah = { side: "away", line: -x.L, p: x.away };
  }
  if (ah) items.push({ cat: "live", kind: "ah-rest", side: ah.side, line: ah.line, text: `${ahWords(ah.side, ah.line)}（只算這之後的進球）` });
  if (mk.scores?.[0]) items.push({ cat: "live", kind: "score", score: mk.scores[0].s, text: String(mk.scores[0].s).replace("-", ":") });
  if (mk.btts != null) items.push({ cat: "live", kind: "btts", yes: mk.btts >= 0.5, text: mk.btts >= 0.5 ? "雙方進球" : "不會雙方進球" });
  return items;
}

function ledgerCapture(model) {
  if (!model?.id || ledgerFinal(model)) return;
  const bag = ledgerBag(model.id);
  let dirty = false;
  const phase = model.minute?.phase;
  if (phase === "pre") {
    const pred = state.pred?.id === model.id && state.pred.status === "ok" ? state.pred.data : null;
    if (pred && !bag.pre) {
      const items = preItemsFromPred(pred);
      if (items.length) {
        bag.pre = { at: Date.now(), items };
        dirty = true;
      }
    }
    const cm = typeof chStore !== "undefined" ? chStore.get(model.id)?.cm : null;
    if (cm && !bag.corners) {
      const pick = cornerPick(cm);
      if (pick) {
        bag.corners = { at: Date.now(), mu: cm.mu, h1: cm.h1, h2: cm.h2, item: cornerItem(cm, pick) };
        dirty = true;
      }
    }
  } else if (model.minute?.state === "in" || phase === "ht") {
    const minute = ledgerMinuteKey(model);
    const n = Number(minute);
    const slotOk = minute === "ht" || !bag.live.length || (Number.isFinite(n) && n % 5 === 0);
    const cornerSlot = minute === "ht" || !bag.cornerLive.length || (Number.isFinite(n) && n % 5 === 0);
    if (slotOk && !bag.live.some((x) => x.minute === minute) && typeof inplayState === "function") {
      const st = inplayState(model);
      if (st) {
        const mk = inplayMarkets(st);
        bag.live.push({ at: Date.now(), minute, hs: st.hs, as: st.as, items: liveItemsFrom(model, st, mk) });
        dirty = true;
      }
    }
    if (cornerSlot && typeof cornerLiveProjection === "function" && !bag.cornerLive.some((x) => x.minute === minute)) {
      const d = typeof cornerData === "function" ? cornerData(model) : null;
      const tot = d?.totals ? d.totals.home + d.totals.away : null;
      const lp = tot != null ? cornerLiveProjection(model, tot) : null;
      if (lp?.cm) {
        const played = phase === "ht" ? 45 : Math.min(90, n > 45 ? Math.max(45, n) : n);
        const remain = Math.max(0, 90 - played);
        const rate = played >= 10 && tot != null ? tot / played : null;
        const rest = rate != null ? lp.rest * 0.7 + rate * remain * 0.3 : lp.rest;
        const proj = (tot || 0) + rest;
        const fake = { mu: proj, h1: lp.cm.h1, h2: lp.cm.h2 };
        const pick = cornerPick(fake);
        if (pick) {
          bag.cornerLive.push({ at: Date.now(), minute, item: cornerItem(fake, pick) });
          dirty = true;
        }
      }
    }
  }
  if (dirty) ledgerWrite(model.id, bag);
}

function scorePair(hs, as) {
  return `${hs}:${as}`;
}

function lineParts(line) {
  const frac = Math.abs(line % 1);
  const q = Math.abs(frac - 0.25) < 0.02 || Math.abs(frac - 0.75) < 0.02;
  if (!q) return [line];
  const sign = line < 0 ? -1 : 1;
  return [line - 0.25 * sign, line + 0.25 * sign];
}

function ahSettle(margin, line) {
  const parts = lineParts(line).map((L) => margin + L);
  const wins = parts.filter((x) => x > 1e-9).length;
  const losses = parts.filter((x) => x < -1e-9).length;
  if (wins && !losses) return true;
  if (losses && !wins) return false;
  if (!wins && !losses) return "push";
  return false;
}

function signedGap(n) {
  const t = trimNum(n);
  return (n > 0 ? "+" : "") + t;
}

function ouSettle(total, side, line, final) {
  if (total == null || !Number.isFinite(total)) return { hit: "na" };
  if (side === "over" && total > line) return { hit: true };
  if (side === "under" && total > line) return { hit: false };
  if (!final) return { hit: "pend" };
  if (total === line) return { hit: "push" };
  if (side === "over") return { hit: total > line };
  return { hit: total < line };
}

function ledgerActual(model) {
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const scoresOk = Number.isFinite(hs) && Number.isFinite(as);
  const empty = typeof espnStatsEmpty === "function" ? espnStatsEmpty(model) : true;
  const st = !empty && model.stats?.mode === "match" ? model.stats : null;
  const corners = st && st.home.wonCorners != null && st.away.wonCorners != null ? Number(st.home.wonCorners) + Number(st.away.wonCorners) : null;
  const yellow = st && st.home.yellowCards != null && st.away.yellowCards != null ? Number(st.home.yellowCards) + Number(st.away.yellowCards) : null;
  const reds = st ? (Number(st.home.redCards) || 0) + (Number(st.away.redCards) || 0) : null;
  const htH = Number(model.home.linescores?.[0]?.value ?? model.home.linescores?.[0]?.displayValue);
  const htA = Number(model.away.linescores?.[0]?.value ?? model.away.linescores?.[0]?.displayValue);
  const htOk = Number.isFinite(htH) && Number.isFinite(htA);
  const phase = model.minute?.phase;
  const pastHt = htOk && (phase === "ht" || phase === "ft" || (model.minute?.period || 0) >= 2 || model.minute?.state === "post");
  return { hs, as, scoresOk, corners, yellow, reds, htH, htA, htOk: pastHt, final: ledgerFinal(model) };
}

function nextGoalSide(model, minuteKey) {
  const lim = minuteKey === "ht"
    ? 1 * 100000 + 45 * 100 + 99
    : ((Number(minuteKey) > 45 ? 2 : 1) * 100000 + (Number(minuteKey) || 0) * 100 + 99);
  const goals = (model.events || []).filter((ev) => ev.kind === "goal" && eventSort(ev) > lim);
  if (!goals.length) return "";
  return goalSide(goals[0], model);
}

function gradeOne(item, model, snap) {
  const A = ledgerActual(model);
  const label = item.kind === "1x2" ? "勝平負" : item.kind === "ht" ? "半場勝平負" : item.kind === "ou" ? "大小球" : item.kind === "ht-ou" ? "半場大小" : item.kind === "ah" ? "讓球" : item.kind === "ah-rest" ? "滾球讓球" : item.kind === "btts" ? "雙方進球" : item.kind === "score" ? "比分" : item.kind === "next" ? "下一球" : item.kind === "corners-ou" ? "角球" : item.kind === "cards-ou" ? "黃牌" : "項目";
  const base = { cat: item.cat, kind: item.kind, label, pick: item.text, actual: "–", gap: "–", hit: "pend" };
  if (!A.scoresOk) return { ...base, hit: "na", actual: "比分未列" };
  const cur = scorePair(A.hs, A.as);
  const res = A.hs > A.as ? "home" : A.hs < A.as ? "away" : "draw";
  if (item.kind === "1x2" || item.kind === "ht") {
    if (item.kind === "ht") {
      if (!A.htOk) return { ...base, actual: "半場比分還沒有", hit: "pend" };
      const hr = A.htH > A.htA ? "home" : A.htH < A.htA ? "away" : "draw";
      return { ...base, actual: `${resultName(hr)}（${scorePair(A.htH, A.htA)}）`, gap: `預測${item.text}，實際${resultName(hr)} ${scorePair(A.htH, A.htA)}`, hit: item.pick === hr };
    }
    if (!A.final) return { ...base, actual: `目前 ${cur}`, gap: `預測${item.text}，目前 ${cur}`, hit: "pend" };
    return { ...base, actual: `${resultName(res)}（${cur}）`, gap: `預測${item.text}，實際${resultName(res)} ${cur}`, hit: item.pick === res };
  }
  if (item.kind === "ou" || item.kind === "ht-ou") {
    const total = item.kind === "ht" || item.kind === "ht-ou" ? (A.htOk ? A.htH + A.htA : null) : A.hs + A.as;
    if (item.kind === "ht-ou" && !A.htOk) return { ...base, actual: "半場比分還沒有", hit: "pend" };
    const settled = ouSettle(total, item.side, item.line, item.kind === "ht-ou" ? true : A.final);
    const word = item.side === "over" ? "大於" : "小於";
    return { ...base, actual: `${total} 球`, gap: `預測${word} ${trimNum(item.line)}，實際 ${total}，差 ${signedGap(total - item.line)}`, hit: settled.hit };
  }
  if (item.kind === "ah" || item.kind === "ah-rest") {
    if (item.kind === "ah-rest" && !A.final) return { ...base, actual: `目前 ${cur}`, hit: "pend", gap: "完賽後才對讓球" };
    const hs = item.kind === "ah-rest" ? A.hs - (snap?.hs || 0) : A.hs;
    const as = item.kind === "ah-rest" ? A.as - (snap?.as || 0) : A.as;
    const margin = item.side === "home" ? hs - as : as - hs;
    const hit = ahSettle(margin, item.line);
    return { ...base, actual: item.kind === "ah-rest" ? `之後 ${scorePair(hs, as)}` : cur, gap: `預測${item.text}，實際 ${cur}`, hit };
  }
  if (item.kind === "btts") {
    const yes = A.hs > 0 && A.as > 0;
    if (!A.final && !yes && item.yes) return { ...base, actual: `目前 ${cur}`, hit: "pend", gap: "還沒有雙方都進球" };
    if (!A.final && !yes && !item.yes) return { ...base, actual: `目前 ${cur}`, hit: "pend", gap: "還可能再進球" };
    if (!A.final && yes && !item.yes) return { ...base, actual: `目前 ${cur}`, gap: `預測不會雙方進球，實際 ${cur}`, hit: false };
    return { ...base, actual: yes ? `是（${cur}）` : `否（${cur}）`, gap: `預測${item.text}，實際${yes ? "雙方都有進球" : "有一方沒進球"} ${cur}`, hit: item.yes === yes };
  }
  if (item.kind === "score") {
    const [ph, pa] = String(item.score || "0-0").split("-").map((n) => Number(n));
    const actualText = cur;
    if (!A.final && (A.hs > ph || A.as > pa)) return { ...base, actual: actualText, gap: `比分預測 ${item.text}，實際 ${actualText}`, hit: false };
    if (!A.final) return { ...base, actual: `目前 ${actualText}`, gap: `比分預測 ${item.text}，目前 ${actualText}`, hit: "pend" };
    return { ...base, actual: actualText, gap: `比分預測 ${item.text}，實際 ${actualText}`, hit: item.score === `${A.hs}-${A.as}` };
  }
  if (item.kind === "next") {
    const side = nextGoalSide(model, snap?.minute);
    if (!side && !A.final) return { ...base, actual: "還沒有下一球", hit: "pend", gap: "這之後還沒進球" };
    const got = side || "none";
    const actual = got === "home" ? `${model.home.name}先進` : got === "away" ? `${model.away.name}先進` : "沒有再進球";
    return { ...base, actual, gap: `預測${item.text}，實際${actual}`, hit: item.pick === got };
  }
  if (item.kind === "corners-ou" || item.kind === "cards-ou") {
    const total = item.kind === "corners-ou" ? A.corners : A.yellow;
    if (total == null) return { ...base, actual: item.kind === "corners-ou" ? "ESPN 沒有角球數" : "ESPN 沒有黃牌數", hit: "na", gap: "沒有實際數字" };
    const settled = ouSettle(total, item.side, item.line, A.final);
    const word = item.side === "over" ? "大於" : "小於";
    const unit = item.kind === "corners-ou" ? "" : " 張";
    const extra = item.kind === "cards-ou" && A.reds ? `、紅牌 ${A.reds}` : "";
    return { ...base, actual: `${total}${unit}${extra}`, gap: `${item.kind === "corners-ou" ? "角球" : "黃牌"}預測${word} ${trimNum(item.line)}，實際 ${total}，差 ${signedGap(total - item.line)}`, hit: settled.hit };
  }
  return base;
}

function gradeLedger(model) {
  const bag = ledgerRead(model.id);
  const rows = [];
  if (bag?.pre?.items) for (const item of bag.pre.items) rows.push(gradeOne(item, model, null));
  if (bag?.corners?.item) {
    const row = gradeOne(bag.corners.item, model, null);
    row.cat = "corner";
    rows.push(row);
  }
  for (const snap of bag?.cornerLive || []) {
    const row = gradeOne(snap.item, model, snap);
    row.cat = "corner";
    row.label = `${ledgerMinuteLabel(snap.minute)} ${row.label}`;
    rows.push(row);
  }
  for (const snap of bag?.live || []) {
    for (const item of snap.items || []) {
      const row = gradeOne(item, model, snap);
      row.cat = "live";
      row.label = `${ledgerMinuteLabel(snap.minute)} ${row.label}`;
      rows.push(row);
    }
  }
  return { bag, rows };
}

function ledgerGroup(cat) {
  if (cat === "live") return "live";
  if (cat === "corner") return "corner";
  return "pre";
}

function rateText(hits, judged) {
  if (!judged) return "–";
  return `${Math.round(hits / judged * 100)}%`;
}

function markText(hit) {
  if (hit === true) return "✅達成";
  if (hit === false) return "❌未中";
  if (hit === "push") return "走水";
  if (hit === "na") return "沒有實際數";
  return "進行中";
}

function markClass(hit) {
  if (hit === true) return "settle-hit";
  if (hit === false) return "settle-miss";
  return "";
}

function settleBlock(model) {
  const live = model.minute?.state === "in" || model.minute?.phase === "ht";
  const done = ledgerFinal(model);
  if (!live && !done) return null;
  ledgerCapture(model);
  const { bag, rows } = gradeLedger(model);
  const block = h("section", { class: "block", id: "settle" }, h("h2", null, ui(done ? "完賽對帳（預測 vs 實際）" : "即時對帳（預測 vs 目前）")));
  const judged = rows.filter((r) => r.hit === true || r.hit === false);
  const hits = judged.filter((r) => r.hit === true).length;
  const pending = rows.filter((r) => r.hit === "pend").length;
  const pushes = rows.filter((r) => r.hit === "push").length;
  const by = { pre: { h: 0, n: 0 }, live: { h: 0, n: 0 }, corner: { h: 0, n: 0 } };
  for (const r of judged) {
    const b = by[ledgerGroup(r.cat)] || by.pre;
    b.n += 1;
    if (r.hit === true) b.h += 1;
  }
  const head = judged.length
    ? `共 ${judged.length} 項，達成 ${hits} 項，命中率 ${rateText(hits, judged.length)}。`
    : "已定案 0 項。";
  const tail = [
    pending ? `另有 ${pending} 項還沒定案` : "",
    pushes ? `走水 ${pushes} 項` : ""
  ].filter(Boolean).join("，");
  block.append(h("p", { class: "settle-sum" }, ui(head + (tail ? tail + "。" : ""))));
  block.append(h("p", null, ui(`賽前 ${by.pre.h}/${by.pre.n}，滾球 ${by.live.h}/${by.live.n}，角球 ${by.corner.h}/${by.corner.n}。`)));
  if (!bag?.pre) block.append(h("p", { class: "muted" }, ui("沒有賽前快照，無法對帳。")));
  if (!bag?.live?.length) block.append(h("p", { class: "muted" }, ui("沒有滾球快照，無法對帳。")));
  if (!bag?.corners && !(bag?.cornerLive || []).length && !bag?.pre?.items?.some((x) => x.kind === "corners-ou" || x.kind === "cards-ou")) {
    block.append(h("p", { class: "muted" }, ui("沒有角球快照，無法對帳。")));
  }
  if (rows.length) {
    const catName = { pre: "賽前", live: "滾球", corner: "角球" };
    block.append(predTable(["分類", "項目", "預測值", "實際結果", "對帳", "差距"], rows.map((r) => ({
      cells: [
        catName[ledgerGroup(r.cat)] || "賽前",
        r.label,
        r.pick,
        r.actual,
        { node: h("span", { class: markClass(r.hit) }, ui(markText(r.hit))) },
        r.gap
      ]
    }))));
  }
  const told = (name, key, has) => {
    const b = by[key];
    if (!has) return `${name}沒有快照`;
    if (!b.n) return `${name}已記下，還沒定案`;
    return `${name} ${b.n} 項達成 ${b.h} 項`;
  };
  const bits = [head.replace(/。$/, "")];
  bits.push(`${told("賽前", "pre", !!bag?.pre)}，${told("滾球", "live", !!bag?.live?.length)}，${told("角球", "corner", !!(bag?.corners || bag?.cornerLive?.length || bag?.pre?.items?.some((x) => x.kind === "corners-ou" || x.kind === "cards-ou")))}。`);
  const show = rows.find((r) => r.kind === "score" && r.hit !== "pend") || rows.find((r) => r.hit === false) || rows.find((r) => r.hit === true);
  if (show) bits.push(`${show.gap}。`);
  if (done && ledgerActual(model).scoresOk) bits.push(`終場 ${model.home.score} 比 ${model.away.score}。`);
  bits.push("理性購彩、未成年人不得購彩。");
  block.append(scriptBlock(bits, done ? "口播：完賽對帳" : "口播：即時對帳"));
  block.append(h("p", { class: "faint" }, ui("快照存在這台裝置：開賽前打開過，才有賽前對帳；比賽進行中每 5 分鐘記一次滾球，記下來就不再改。沒有快照的項目不補算。實際比分、角球、黃牌用 ESPN 這場的技術統計。理性購彩、未成年人不得購彩。")));
  return block;
}
