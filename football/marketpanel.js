/* marketAnalysisEngine：盤口觀察面板。
   機率一律來自現有可解釋的統計模型（predict.js 的進球分布、cornerhist.js 的歷史角球、inplay.js 的滾球重算），
   沒有模型或資料時顯示「資料不足」，不產生任何數字。市場賠率只用來換算隱含機率並標出抽水。 */

const MK_MODEL = "進球：Poisson／Dixon-Coles 混合市場價（predict.js）｜角球：兩隊歷史逐場負二項（cornerhist.js）｜滾球：剩餘時間重算（inplay.js）";
const CALIB_KEY = "fb-calib-v1";

function mkQuote(q) {
  const x = q?.live || q?.pre;
  return x && x.decimal ? { ...x, isLive: !!q.live } : null;
}

function mkDevig(a, b) {
  if (!a?.decimal || !b?.decimal) return null;
  const pa = 1 / a.decimal;
  const pb = 1 / b.decimal;
  return { a: pa / (pa + pb), b: pb / (pa + pb), vig: pa + pb - 1 };
}

/* 完賽後把這場的對帳結果記成校準樣本（只記一次）。 */
function recordCalibration(model) {
  if (typeof gradeLedger !== "function" || !(model.minute?.phase === "ft" || model.minute?.state === "post")) return;
  let all = {};
  try { all = JSON.parse(localStorage.getItem(CALIB_KEY) || "{}"); } catch { all = {}; }
  if (all[model.id]) return;
  const { rows } = gradeLedger(model);
  if (!rows.length) return;
  const sum = {};
  for (const r of rows) {
    const k = r.kind;
    sum[k] = sum[k] || { hit: 0, miss: 0, push: 0, na: 0 };
    if (r.hit === true) sum[k].hit += 1; else if (r.hit === false) sum[k].miss += 1; else if (r.hit === "push") sum[k].push += 1; else sum[k].na += 1;
  }
  all[model.id] = { at: Date.now(), league: model.leagueSlug, sum };
  try { localStorage.setItem(CALIB_KEY, JSON.stringify(all)); } catch { /* 略過 */ }
}

function calibration() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(CALIB_KEY) || "{}"); } catch { all = {}; }
  const total = {};
  const games = Object.keys(all).length;
  for (const g of Object.values(all)) for (const [k, v] of Object.entries(g.sum || {})) {
    total[k] = total[k] || { hit: 0, miss: 0, push: 0, na: 0 };
    for (const f of ["hit", "miss", "push", "na"]) total[k][f] += v[f] || 0;
  }
  return { games, total };
}

function marketPanel(model, sit, mot) {
  const H = model.home.name;
  const A = model.away.name;
  const phase = model.minute?.phase;
  const live = model.minute?.state === "in" || phase === "ht";
  const book = model.odds;
  const saved = typeof loadPrediction === "function" ? loadPrediction(model.id) : null;
  const pred = state.pred?.id === model.id && state.pred.status === "ok" ? state.pred.data : null;
  const lh = pred?.lh ?? saved?.lh;
  const la = pred?.la ?? saved?.la;
  const ip = live && typeof inplayState === "function" ? inplayState(model) : null;
  const ipm = ip ? inplayMarkets(ip) : null;
  const cm = typeof chStore !== "undefined" ? chStore.get(model.id)?.cm : null;
  if (typeof cornerHist === "function") cornerHist(model);
  const statsOk = typeof espnStatsEmpty === "function" && !espnStatsEmpty(model);
  const st = statsOk ? model.stats : null;
  const xg = typeof commRich === "function" && commRich(model) ? tallyOf(model.commentary || [], []) : null;
  const at = state.summaryLoadedAt ? taipeiClock(new Date(state.summaryLoadedAt)) : "";
  const pr = { H: mot?.sides?.home?.pressure, A: mot?.sides?.away?.pressure };
  const motLine = pr.H != null && pr.A != null
    ? (pr.H === pr.A ? "兩隊積分壓力相近，戰意對這個盤口沒有明確方向。" : `${pr.H > pr.A ? H : A}更需要積分（推測），落後或僵持時可能提早壓上；這不代表一定會進球，也可能因此被反擊。`)
    : "缺少積分或規則資料，無法評估戰意的影響。";
  const pitch = [];
  if (st) pitch.push(`射門 ${st.home.totalShots ?? "–"}:${st.away.totalShots ?? "–"}、射正 ${st.home.shotsOnTarget ?? "–"}:${st.away.shotsOnTarget ?? "–"}、控球 ${st.home.possessionPct ?? "–"}%:${st.away.possessionPct ?? "–"}%`);
  if (xg) pitch.push(`文字轉播估計 xG ${fx(xg.home.xg)}:${fx(xg.away.xg)}`);
  const pitchLine = live || phase !== "pre" ? (pitch.length ? pitch.join("；") + "。" : "ESPN 這場沒有技術統計，場上訊號資料不足。") : "尚未開賽，沒有場上訊號。";
  const done = (list) => ({ have: list.filter((x) => x[1]).length, need: list.length, missing: list.filter((x) => !x[1]).map((x) => x[0]) });
  const out = [];

  /* 1. 亞洲讓球 */
  {
    const qh = mkQuote(book?.spread?.home);
    const qa = mkQuote(book?.spread?.away);
    const dv = mkDevig(qh, qa);
    const line = qh?.line;
    let modelText = "資料不足（沒有進球模型）";
    let concl = "資料不足，無法分析。";
    const pros = [];
    const cons = [];
    if (lh != null && la != null) {
      const rowsAh = pred?.markets?.find((x) => x.id === "ah")?.ahRows;
      const preRow = rowsAh?.find((x) => Number.isFinite(line) && Math.abs(x.L - line) < 1e-9) || rowsAh?.find((x) => x.isMarket);
      const liveRow = ipm?.ah?.find((x) => Number.isFinite(line) && Math.abs(x.L - line) < 1e-9);
      /* 比賽中只拿滾球模型對滾球盤；賽前模型不能拿來對滾球賠率 */
      const hit = live ? (liveRow ? { L: liveRow.L, ph: liveRow.home / Math.max(1e-9, 1 - liveRow.push), pa: liveRow.away / Math.max(1e-9, 1 - liveRow.push) } : null) : (preRow ? { L: preRow.L, ph: preRow.home.eff, pa: preRow.away.eff } : null);
      modelText = `賽前預期進球 ${H} ${fx(lh)}、${A} ${fx(la)}（差 ${fx(Math.abs(lh - la))}）` + (hit ? `；${live ? "滾球模型：" : ""}${H} ${hit.L > 0 ? "+" : ""}${trimNum(hit.L)} 過盤 ${pct(hit.ph)}、${A} ${-hit.L > 0 ? "+" : ""}${trimNum(-hit.L)} 過盤 ${pct(hit.pa)}` : "");
      const fav = lh >= la ? H : A;
      pros.push(`賽前模型看${fav}的預期進球較高。`);
      if (dv && hit) {
        const edge = hit.ph - dv.a;
        (Math.abs(edge) >= 0.03 ? pros : cons).push(`市場隱含機率（去抽水）${H} ${pct(dv.a)}，模型 ${pct(hit.ph)}，差 ${edge >= 0 ? "+" : ""}${trimNum(Math.round(edge * 1000) / 10)} 個百分點。`);
        concl = Math.abs(edge) < 0.03 ? "模型與市場價格接近，沒有明顯偏差。" : `模型比市場更看好${edge > 0 ? H : A}這一邊；通常是市場知道更多（陣容、傷停、場上狀況），差距只能當觀察點。`;
      } else concl = Number.isFinite(line) ? "有盤口，但模型沒有這條線的機率，只能參考預期進球差。" : "ESPN 沒有這場的讓球盤，只能參考預期進球差。";
    }
    if (ipm && ip) pros.push(`滾球重算：剩餘時間預期進球 ${H} ${fx(ip.lh)}、${A} ${fx(ip.la)}。`);
    out.push({
      id: "ah", title: "亞洲讓球盤",
      line: Number.isFinite(line) ? `${H} ${line > 0 ? "+" : ""}${trimNum(line)}｜賠率 ${fmtDecimal(qh.decimal)}／${qa ? fmtDecimal(qa.decimal) : "–"}${qh.isLive ? "（滾球）" : ""}` : "沒有盤口資料",
      lineTime: Number.isFinite(line) ? at : "", vig: dv ? dv.vig : null, modelText, pros, cons,
      motivation: motLine, pitch: pitchLine,
      risks: ["早段紅牌或點球會讓盤口基礎完全改變。", "強隊領先後常收力，贏球不等於贏盤。"],
      recheck: ["先發名單公布（主力輪換）", "出現紅牌、傷退", "盤口移動 0.25 以上"],
      comp: done([["盤口與賠率", Number.isFinite(line) && !!dv], ["進球模型", lh != null], ["先發名單", (model.roster?.home?.players || []).filter((p) => p.starter).length >= 11], ["積分與戰意", pr.H != null], ["場上數據", !!st || !!xg || phase === "pre"]]),
      conclusion: concl
    });
  }

  /* 2. 全場大小球 */
  {
    const qo = mkQuote(book?.total?.over);
    const qu = mkQuote(book?.total?.under);
    const dv = mkDevig(qo, qu);
    const line = qo?.line;
    const cur = (Number(model.home.score) || 0) + (Number(model.away.score) || 0);
    let modelText = "資料不足（沒有進球模型）";
    let concl = "資料不足，無法分析。";
    const pros = [];
    const cons = [];
    if (lh != null && la != null) {
      const rowsOu = pred?.markets?.find((x) => x.id === "ou")?.ouRows;
      const preRow = rowsOu?.find((x) => Number.isFinite(line) && Math.abs(x.L - line) < 1e-9) || rowsOu?.find((x) => x.isMarket) || rowsOu?.find((x) => Math.abs(x.L - 2.5) < 1e-9);
      const liveRow = ipm?.ou?.find((x) => Number.isFinite(line) && Math.abs(x.L - line) < 1e-9);
      const hit = live ? (liveRow ? { L: liveRow.L, po: liveRow.over, pu: liveRow.under } : null) : (preRow ? { L: preRow.L, po: preRow.over.eff, pu: preRow.under.eff } : null);
      modelText = `賽前預期總進球 ${fx(lh + la)}` + (ip ? `｜目前 ${cur} 球，剩餘預期 ${fx(ip.lh + ip.la)} 球` : "") + (hit ? `；${live ? "滾球模型：" : ""}大 ${trimNum(hit.L)} 機率 ${pct(hit.po)}、小 ${pct(hit.pu)}` : "");
      (lh + la >= 2.8 ? pros : cons).push(`賽前預期總進球 ${fx(lh + la)}（${lh + la >= 2.8 ? "偏高" : lh + la <= 2.3 ? "偏低" : "中等"}）。`);
      if (dv && hit) {
        const edge = hit.po - dv.a;
        (Math.abs(edge) >= 0.03 ? pros : cons).push(`市場隱含機率（去抽水）大球 ${pct(dv.a)}，模型 ${pct(hit.po)}。`);
        concl = Math.abs(edge) < 0.03 ? "模型與市場接近，沒有明顯偏差。" : `模型比市場${edge > 0 ? "更偏大球" : "更偏小球"}（差 ${trimNum(Math.round(Math.abs(edge) * 1000) / 10)} 個百分點），只能當觀察點。`;
      } else concl = Number.isFinite(line) ? "有盤口，但模型沒有這條線的機率。" : "沒有可對照的市場賠率，只列模型數字。";
    }
    if (xg && live) (xg.home.xg + xg.away.xg > (lh + la) * (ip ? ip.played / 90 : 0.5) ? pros : cons).push(`場上 xG 合計 ${fx(xg.home.xg + xg.away.xg)}，${xg.home.xg + xg.away.xg > (lh ?? 1.3) + (la ?? 1.1) ? "高於" : "未高於"}賽前預期的節奏。`);
    out.push({
      id: "ou", title: "全場大小球",
      line: Number.isFinite(line) ? `${trimNum(line)} 球｜大 ${fmtDecimal(qo.decimal)}／小 ${qu ? fmtDecimal(qu.decimal) : "–"}${qo.isLive ? "（滾球）" : ""}` : "沒有盤口資料",
      lineTime: Number.isFinite(line) ? at : "", vig: dv ? dv.vig : null, modelText, pros, cons,
      motivation: motLine + " 「必須贏球」不等於大球：對手若全力防守，反而可能是小比分。",
      pitch: pitchLine,
      risks: ["早進球會打開比賽，長時間 0:0 則每過 10 分鐘大球機率明顯下降。", "領先方收縮、落後方久攻不下時，射門多但進球少。"],
      recheck: ["進球或紅牌之後", "60 分鐘、75 分鐘各重新評估一次", "天氣轉壞（大雨、強風）"],
      comp: done([["盤口與賠率", Number.isFinite(line) && !!dv], ["進球模型", lh != null], ["場上數據", !!st || !!xg || phase === "pre"], ["積分與戰意", pr.H != null]]),
      conclusion: concl
    });
  }

  /* 3. 半場大小球 */
  {
    const ht = pred?.markets?.find((x) => x.id === "ht");
    const past = phase !== "pre" && (model.minute?.period >= 2 || phase === "ht" || phase === "ft");
    out.push({
      id: "htou", title: "半場大小球", line: "ESPN 沒有半場盤口", lineTime: "", vig: null,
      modelText: past ? "上半場已結束。" : ht ? `半場大 0.5 機率 ${pct(ht.o05)}、大 1.5 機率 ${pct(ht.o15)}；半場主勝 ${pct(ht.r1.home)}、和 ${pct(ht.r1.draw)}、客勝 ${pct(ht.r1.away)}` : "資料不足（需要賽前模型；開賽前打開過這場才有）",
      pros: !past && ht && ht.o05 >= 0.7 ? ["模型預估上半場至少 1 球的機率偏高。"] : [], cons: !past && ht && ht.o05 < 0.6 ? ["模型預估上半場進球機率不高。"] : [],
      motivation: motLine, pitch: pitchLine,
      risks: ["上半場進球數本來就比下半場少，樣本波動大。"], recheck: ["開場 15 分鐘的節奏", "早段進球"],
      comp: done([["半場盤口", false], ["進球模型", !!ht]]),
      conclusion: past ? "已過上半場，不再適用。" : ht ? "只有模型機率，沒有市場價可比較。" : "資料不足，無法分析。"
    });
  }

  /* 4–5. 角球 */
  {
    const d = typeof cornerData === "function" && phase !== "pre" ? cornerData(model) : null;
    const tot = d?.totals ? d.totals.home + d.totals.away : null;
    const lp = tot != null && typeof cornerLiveProjection === "function" ? cornerLiveProjection(model, tot) : null;
    const base = cm ? Math.floor(cm.mu) + 0.5 : null;
    out.push({
      id: "corners", title: "全場角球", line: "ESPN 沒有角球盤口", lineTime: "", vig: null,
      modelText: cm ? `歷史模型預估全場 ${trimNum(Math.round(cm.mu * 10) / 10)} 角（${H} ${trimNum(Math.round(cm.muH * 10) / 10)}、${A} ${trimNum(Math.round(cm.muA * 10) / 10)}）；大 ${base} 機率 ${pct(nbOver(cm.mu, base))}` + (lp ? `｜目前 ${tot} 角，預估全場約 ${trimNum(Math.round(lp.proj * 10) / 10)} 角` : "") : "資料不足（兩隊歷史角球資料還在讀取，或 ESPN 沒有）",
      pros: cm && cm.mu >= 10 ? ["兩隊歷史場均角球合計偏高。"] : [], cons: cm && cm.mu <= 8.5 ? ["兩隊歷史場均角球合計偏低。"] : [],
      motivation: motLine + " 落後方壓上通常會增加傳中與角球，但「必須贏球」本身不足以判斷角球大。",
      pitch: tot != null ? `目前角球 ${d.totals.home}:${d.totals.away}（來源：${CORNER_SRC[d.source]}）。` : pitchLine,
      risks: ["角球波動很大，單場偏離平均 3–4 個很常見。", "早早大比分領先時，雙方角球都會減少。"],
      recheck: ["半場結束時的角球數", "落後方換上邊鋒或改打兩翼"],
      comp: done([["角球盤口", false], ["歷史角球模型", !!cm], ["本場即時角球", tot != null || phase === "pre"]]),
      conclusion: cm ? "只有模型預估，沒有市場價可比較；可拿這個數字對照你平台的角球線。" : "資料不足，無法分析。"
    });
    const h1done = phase !== "pre" && (model.minute?.period >= 2 || phase === "ht" || phase === "ft");
    const hb = cm ? Math.floor(cm.h1) + 0.5 : null;
    out.push({
      id: "htcorners", title: "半場角球", line: "ESPN 沒有半場角球盤口", lineTime: "", vig: null,
      modelText: h1done ? "上半場已結束。" : cm ? `歷史模型預估上半場 ${trimNum(Math.round(cm.h1 * 10) / 10)} 角；大 ${hb} 機率 ${pct(nbOver(cm.h1, hb, 1.4))}${cm.shareKnown ? "" : "（上下半場比例用一般值，非兩隊實測）"}` : "資料不足",
      pros: [], cons: [], motivation: "上半場通常比較保守，戰意的影響多半出現在下半場。", pitch: tot != null ? `目前角球 ${d.totals.home}:${d.totals.away}。` : pitchLine,
      risks: ["半場樣本更小，波動更大。"], recheck: ["開場 20 分鐘的角球數"],
      comp: done([["半場角球盤口", false], ["歷史角球模型", !!cm], ["上下半場實測比例", !!cm?.shareKnown]]),
      conclusion: h1done ? "已過上半場，不再適用。" : cm ? "只有模型預估，沒有市場價可比較。" : "資料不足，無法分析。"
    });
  }

  /* 6. 罰牌 */
  {
    const ca = pred?.markets?.find((x) => x.id === "cards");
    const mu = ca?.mu ?? saved?.cards?.mu;
    const yNow = st ? (Number(st.home.yellowCards) || 0) + (Number(st.away.yellowCards) || 0) : null;
    const fouls = st ? `${st.home.foulsCommitted ?? "–"}:${st.away.foulsCommitted ?? "–"}` : null;
    out.push({
      id: "cards", title: "罰牌大小", line: "ESPN 沒有罰牌盤口", lineTime: "", vig: null,
      modelText: mu != null ? `模型預估黃牌 ${trimNum(Math.round(mu * 10) / 10)} 張（兩隊近況場均吃牌與對手造成的牌數）` + (ca?.pRed != null ? `；出現紅牌機率 ${pct(ca.pRed)}` : "") : "資料不足（兩隊近況的罰牌樣本不夠）",
      pros: [], cons: [], motivation: motLine + " 保級戰、德比、淘汰邊緣的比賽通常火氣較大，但仍以裁判尺度為主。",
      pitch: yNow != null ? `目前黃牌 ${yNow} 張、犯規 ${fouls}。` : pitchLine,
      risks: ["裁判尺度是最大變數，而這裡沒有裁判資料。", "比賽末段戰術犯規與拖延時間會集中吃牌。"],
      recheck: ["主裁判名單與他的場均出牌數（需另查）", "上半場的犯規數與第一張黃牌時間"],
      comp: done([["罰牌盤口", false], ["罰牌模型", mu != null], ["裁判資料", false], ["本場即時犯規", yNow != null || phase === "pre"]]),
      conclusion: mu != null ? "只有模型預估，而且缺裁判資料，可信度偏低。" : "資料不足，無法分析。"
    });
  }

  /* 7. 球隊單邊進球 */
  {
    const p1 = (l) => 1 - Math.exp(-l);
    const p2 = (l) => 1 - Math.exp(-l) * (1 + l);
    out.push({
      id: "team", title: "球隊單邊進球數", line: "ESPN 沒有單邊進球盤口", lineTime: "", vig: null,
      modelText: lh != null ? `${H}：預期 ${fx(lh)} 球，至少 1 球 ${pct(p1(lh))}、至少 2 球 ${pct(p2(lh))}｜${A}：預期 ${fx(la)} 球，至少 1 球 ${pct(p1(la))}、至少 2 球 ${pct(p2(la))}` + (ip ? `｜滾球剩餘預期 ${H} ${fx(ip.lh)}、${A} ${fx(ip.la)}` : "") : "資料不足（沒有進球模型）",
      pros: [], cons: [], motivation: motLine, pitch: pitchLine,
      risks: ["單隊進球數受對手紅牌、點球影響很大。"], recheck: ["進球或紅牌之後", "主力前鋒被換下"],
      comp: done([["單邊盤口", false], ["進球模型", lh != null]]),
      conclusion: lh != null ? "只有模型機率，沒有市場價可比較。" : "資料不足，無法分析。"
    });
  }

  /* 8. 特定時段進球：定義因平台而異，未設定前不分析 */
  out.push({
    id: "slot", title: "特定時段進球（特一／特二）", line: "尚未設定平台的時段定義", lineTime: "", vig: null,
    modelText: "資料不足：不同平台對「特一、特二」的時段定義不同，設定之前不產生任何數字。",
    pros: [], cons: [], motivation: "—", pitch: "—", risks: [], recheck: ["請提供你使用的平台對特一、特二的時段定義"],
    comp: done([["平台時段定義", false]]), conclusion: "資料不足，無法分析。"
  });
  return out;
}
