/* 滾球（比賽進行中）盤口預測：以賽前模型的預期進球為底，依剩餘時間、比分、紅牌、場上壓制程度即時重算。 */

function poisPmf(l, k) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i += 1) p *= l / i;
  return p;
}

function inplayState(model) {
  const m = model.minute || {};
  if (m.state !== "in" && m.phase !== "ht") return null;
  const saved = loadPrediction(model.id);
  const live = state.pred?.id === model.id ? state.pred.data : null;
  const lh0 = saved?.lh ?? live?.lh;
  const la0 = saved?.la ?? live?.la;
  if (lh0 == null || la0 == null) return null;
  const played = m.phase === "ht" ? 45 : m.period >= 2 ? Math.max(45, Math.min(95, m.base || 45)) : Math.min(48, m.base || 0);
  /* 進球在下半場比較多：剩餘時間權重下半場 ×1.1 */
  const remainW = (() => {
    const h1Left = Math.max(0, 45 - Math.min(45, played));
    const h2Left = Math.max(0, 90 - Math.max(45, played));
    return (h1Left * 1 + h2Left * 1.1 + 3) / (45 + 45 * 1.1 + 4);
  })();
  const hs = Number(model.home.score) || 0;
  const as = Number(model.away.score) || 0;
  let lh = lh0 * remainW;
  let la = la0 * remainW;
  const reasons = [];
  reasons.push(`賽前模型預期進球 ${model.home.name} ${fx(lh0)}、${model.away.name} ${fx(la0)}；已踢約 ${Math.round(played)} 分鐘，剩餘時間約佔全場進球機會的 ${pct(remainW)}。`);
  /* 紅牌 */
  const reds = { home: 0, away: 0 };
  for (const ev of model.events || []) if (ev.kind === "red") { const s = goalSide(ev, model); if (s) reds[s] += 1; }
  if (reds.home || reds.away) {
    const diff = reds.home - reds.away;
    if (diff > 0) { lh *= Math.pow(0.7, diff); la *= Math.pow(1.3, diff); }
    if (diff < 0) { la *= Math.pow(0.7, -diff); lh *= Math.pow(1.3, -diff); }
    if (diff) reasons.push(`紅牌：${diff > 0 ? model.home.name : model.away.name}少 ${Math.abs(diff)} 人，進攻預期 ×0.7、對手 ×1.3。`);
  }
  /* 場上壓制程度：有文字轉播用 xG，有技術統計用射正 */
  let press = null;
  if (typeof commRich === "function" && commRich(model)) {
    const t = tallyOf(model.commentary || [], []);
    if (t.home.xg + t.away.xg > 0.3) press = { h: t.home.xg, a: t.away.xg, label: `xG ${fx(t.home.xg)} : ${fx(t.away.xg)}` };
  }
  if (!press && typeof espnStatsEmpty === "function" && !espnStatsEmpty(model)) {
    const sh = Number(model.stats.home.shotsOnTarget) || 0;
    const sa = Number(model.stats.away.shotsOnTarget) || 0;
    if (sh + sa >= 3) press = { h: sh * 0.3, a: sa * 0.3, label: `射正 ${sh} : ${sa}` };
  }
  if (press && played >= 15) {
    const w = Math.min(0.45, played / 90 * 0.5);
    const expH = lh0 * played / 90;
    const expA = la0 * played / 90;
    const fh = Math.max(0.5, Math.min(1.8, (press.h + 0.2) / (expH + 0.2)));
    const fa = Math.max(0.5, Math.min(1.8, (press.a + 0.2) / (expA + 0.2)));
    lh *= 1 + (fh - 1) * w;
    la *= 1 + (fa - 1) * w;
    reasons.push(`場上表現（${press.label}）與賽前預期比較，${model.home.name}進攻 ×${(1 + (fh - 1) * w).toFixed(2)}、${model.away.name} ×${(1 + (fa - 1) * w).toFixed(2)}。`);
  }
  /* 比分狀態：落後方壓上、領先方收縮（下半場更明顯） */
  if (hs !== as && played >= 55) {
    const lead = hs > as ? "home" : "away";
    const k = played >= 75 ? 0.15 : 0.08;
    if (lead === "home") { lh *= 1 - k; la *= 1 + k; } else { la *= 1 - k; lh *= 1 + k; }
    reasons.push(`${lead === "home" ? model.home.name : model.away.name}領先，通常會收縮防守、對手壓上：領先方 ×${(1 - k).toFixed(2)}、落後方 ×${(1 + k).toFixed(2)}。`);
  }
  return { played, hs, as, lh, la, reasons };
}

function inplayMarkets(st) {
  const N = 9;
  const grid = [];
  for (let i = 0; i <= N; i += 1) for (let j = 0; j <= N; j += 1) grid.push({ i, j, p: poisPmf(st.lh, i) * poisPmf(st.la, j) });
  const sum = (f) => grid.filter(f).reduce((a, x) => a + x.p, 0);
  const fh = (x) => st.hs + x.i;
  const fa = (x) => st.as + x.j;
  const win = sum((x) => fh(x) > fa(x));
  const draw = sum((x) => fh(x) === fa(x));
  const lose = 1 - win - draw;
  const p0 = Math.exp(-(st.lh + st.la));
  const nextH = (1 - p0) * st.lh / Math.max(1e-9, st.lh + st.la);
  const nextA = (1 - p0) * st.la / Math.max(1e-9, st.lh + st.la);
  const cur = st.hs + st.as;
  const ou = [0.5, 1.5, 2.5].map((k) => {
    const L = cur + k;
    const over = sum((x) => x.i + x.j > k);
    return { L, over, under: 1 - over };
  });
  /* 滾球亞洲讓球：只算「現在之後」的進球 */
  const ah = [-1, -0.5, 0, 0.5, 1].map((L) => {
    const w = sum((x) => x.i - x.j + L > 0);
    const push = sum((x) => x.i - x.j + L === 0);
    return { L, home: w, push, away: 1 - w - push };
  });
  const btts = st.hs > 0 && st.as > 0 ? null : sum((x) => fh(x) > 0 && fa(x) > 0);
  const scores = grid.map((x) => ({ s: `${fh(x)}-${fa(x)}`, p: x.p })).sort((a, b) => b.p - a.p).slice(0, 5);
  return { win, draw, lose, p0, nextH, nextA, ou, ah, btts, scores };
}

function fairText(p) {
  return p > 0.005 ? fmtOdd(1 / p) : "–";
}

function inplayBlock(model) {
  const m = model.minute || {};
  if (m.phase === "pre") {
    return h("section", { class: "block", id: "inplay" }, h("h2", null, ui("滾球盤口預測")),
      h("p", { class: "muted" }, ui("開賽後這裡會即時重算：勝平負、下一球、剩餘大小球、滾球讓球、兩隊都進球與最可能比分，每次比分或時間更新都會跟著變。")));
  }
  if (m.phase === "ft" || m.state === "post") return null;
  const block = h("section", { class: "block", id: "inplay" }, h("h2", null, ui(`滾球盤口預測（${m.phase === "ht" ? "中場" : `${Math.round(m.base || 0)}'`} 即時）`)));
  const st = inplayState(model);
  if (!st) { block.append(h("p", { class: "muted" }, ui("需要賽前模型才能算滾球：請先讓上方「賽前盤口預測」載入完成。"))); return block; }
  const mk = inplayMarkets(st);
  const H = model.home.name;
  const A = model.away.name;
  block.append(h("p", { class: "lean" }, ui(`剩餘時間預期進球：${H} ${fx(st.lh)}、${A} ${fx(st.la)}；目前比分 ${st.hs}:${st.as}。`)));
  block.append(h("h3", null, ui("勝平負（以目前比分繼續）")), predTable(["選項", "機率", "合理賠率"], [
    { cells: [`${H} 勝`, pct(mk.win), fairText(mk.win)] },
    { cells: ["和局", pct(mk.draw), fairText(mk.draw)] },
    { cells: [`${A} 勝`, pct(mk.lose), fairText(mk.lose)] }
  ]));
  block.append(h("h3", null, ui("下一球")), predTable(["選項", "機率", "合理賠率"], [
    { cells: [`${H} 進下一球`, pct(mk.nextH), fairText(mk.nextH)] },
    { cells: ["不會再進球", pct(mk.p0), fairText(mk.p0)] },
    { cells: [`${A} 進下一球`, pct(mk.nextA), fairText(mk.nextA)] }
  ]));
  block.append(h("h3", null, ui("全場大小（含已進球數）")), predTable(["線", "大", "小", "合理賠率（大／小）"], mk.ou.map((x) => ({
    cells: [trimNum(x.L), pct(x.over), pct(x.under), `${fairText(x.over)}／${fairText(x.under)}`]
  }))));
  block.append(h("h3", null, ui("滾球讓球（只算現在之後的進球）")), predTable(["讓球", `${H}`, "走水", `${A}`], mk.ah.map((x) => ({
    cells: [`${H} ${x.L > 0 ? "+" : ""}${trimNum(x.L)}`, `${pct(x.home)}（${fairText(x.home / Math.max(1e-9, 1 - x.push))}）`, x.push > 0.001 ? pct(x.push) : "–", `${pct(x.away)}（${fairText(x.away / Math.max(1e-9, 1 - x.push))}）`]
  }))));
  if (mk.btts != null) block.append(h("p", null, ui(`兩隊都進球：是 ${pct(mk.btts)}（合理 ${fairText(mk.btts)}）、否 ${pct(1 - mk.btts)}（合理 ${fairText(1 - mk.btts)}）`)));
  block.append(h("p", null, ui(`最可能的終場比分：${mk.scores.map((x) => `${x.s}（${pct(x.p)}）`).join("、")}`)));
  block.append(h("ul", { class: "reasons" }, st.reasons.map((r) => h("li", null, ui(r)))));
  const fav = mk.nextH > mk.nextA ? H : A;
  block.append(scriptBlock([
    `現在 ${st.hs} 比 ${st.as}，照目前的數據，下一球比較可能是 ${fav}（${pct(Math.max(mk.nextH, mk.nextA))}），整場不會再有進球的機率 ${pct(mk.p0)}。`,
    `最後最可能的比分是 ${mk.scores[0].s}。你覺得下一球是誰？${H}扣 1、${A}扣 2、不會再進扣 0！`
  ], "口播：滾球看點"));
  block.append(h("p", { class: "faint" }, ui("用法：盤口給的賠率高於「合理賠率」才有正期望值。模型不知道換人、天氣、場邊消息，滾球盤變動很快，僅供參考，不構成投注建議。")));
  return block;
}
