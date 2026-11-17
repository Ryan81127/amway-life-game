/* 2.0 分頁：看板（原本內容）｜積分／出線｜戰意｜主播口播｜盤口觀察。
   原本的比賽頁完全保留在「看板」分頁；其餘分頁各自獨立渲染。 */

const V2_VIEWS = [["board", "看板"], ["table", "積分／出線"], ["motive", "戰意"], ["motive2", "戰意 2"], ["script", "主播口播"], ["market", "盤口觀察"]];
const v2Log = new Map();
const v2Last = new Map();

function v2View() {
  const v = new URLSearchParams(location.search).get("view") || "board";
  return V2_VIEWS.some(([id]) => id === v) ? v : "board";
}

function v2SetView(v) {
  const url = new URL(location.href);
  if (v === "board") url.searchParams.delete("view"); else url.searchParams.set("view", v);
  history.replaceState({}, "", url);
  window.scrollTo(0, 0);
  maybeRender({ soft: false });
}

function viewTabs() {
  const cur = v2View();
  return h("nav", { class: "v2-tabs", role: "tablist", "aria-label": "分頁" }, V2_VIEWS.map(([id, label]) => h("button", { class: "v2-tab", role: "tab", "aria-selected": String(cur === id), onclick: () => v2SetView(id) }, ui(label))));
}

function v2Sit(model) {
  const ctx = v2Ctx(model);
  const sit = situation(model, ctx);
  if (sit.state === "ok") v2Track(model, sit);
  return sit;
}

/* 偵測名次與晉級區變化，記下時間 */
function v2Track(model, sit) {
  if (!sit.matches) return;
  const sig = sit.table.map((r) => `${r.id}:${r.rank}`).join(",");
  const prev = v2Last.get(model.id);
  v2Last.set(model.id, { sig, ranks: new Map(sit.table.map((r) => [r.id, r.rank])) });
  if (!prev || prev.sig === sig) return;
  const log = v2Log.get(model.id) || [];
  for (const r of sit.table) {
    const before = prev.ranks.get(r.id);
    if (before == null || before === r.rank) continue;
    const k = sit.mainK;
    const move = before > k && r.rank <= k ? `升進前 ${k}` : before <= k && r.rank > k ? `掉出前 ${k}` : r.rank < before ? "上升" : "下降";
    log.unshift({ at: Date.now(), text: `${r.name} 第 ${before} → 第 ${r.rank}（${move}）`, key: move.includes("前 ") });
  }
  v2Log.set(model.id, log.slice(0, 20));
}

function v2StatusBadge(sit, k, id) {
  const s = mvStatusText(sit, k, id);
  if (!s) return null;
  const cls = { clinched: "ok", out: "bad", mustWin: "warn", winEnough: "warn", needHelp: "warn", drawEnough: "ok2", unknown: "na" }[s.code] || "";
  return h("span", { class: `v2-badge ${cls}` }, ui(s.text));
}

function v2Meta(sit, ctx) {
  const bits = [];
  if (ctx?.at) bits.push(`更新 ${taipeiClock(new Date(ctx.at))}`);
  bits.push(sit.matches ? "來源：ESPN 賽程與比分，名次由看板依規則計算" : "來源：ESPN 官方積分榜");
  if (sit.matches) bits.push(Object.keys(sit.sim || {}).length ? "含手動修正比分（模擬）" : sit.isLive ? "含進行中比賽的即時比分" : "");
  return h("p", { class: "faint" }, ui(bits.filter(Boolean).join(" · ")));
}

/* 第一屏的形勢快報（所有分頁都顯示） */
function situationStrip(model) {
  const ctx = v2Ctx(model);
  const sit = v2Sit(model);
  const box = h("div", { class: "v2-strip" });
  if (sit.state === "loading") { box.append(h("span", { class: "faint" }, ui("積分形勢讀取中…"))); return box; }
  if (sit.state !== "ok") return null;
  for (const side of ["home", "away"]) {
    const r = sit.table.find((x) => x.id === model[side].id);
    if (!r) continue;
    box.append(h("div", { class: "v2-strip-team" },
      h("b", null, ui(`${model[side].name} 第 ${r.rank}`)), h("span", { class: "faint" }, ui(` ${r.pts} 分`)),
      sit.status ? v2StatusBadge(sit, focusK(sit, r.id), r.id) : null));
  }
  const last = (v2Log.get(model.id) || [])[0];
  if (last && Date.now() - last.at < 10 * 60000) box.append(h("div", { class: last.key ? "v2-alert key" : "v2-alert" }, ui(`${taipeiClock(new Date(last.at))} ${last.text}`)));
  if (ctx?.status === "stale") box.append(h("div", { class: "v2-alert" }, ui("積分資料暫時更新不了，顯示的是上一次成功的內容。")));
  return box;
}

/* ---------- 積分／出線 ---------- */

function standingsView(model) {
  const ctx = v2Ctx(model);
  const sit = v2Sit(model);
  const block = h("section", { class: "block", id: "v2-table" }, h("h2", null, ui("積分與出線形勢")));
  const refresh = h("button", { class: "chip", onclick: () => loadV2(model, true) }, ui("🔄 重新整理積分"));
  if (sit.state === "loading") { block.append(h("p", { class: "muted" }, ui("讀取積分榜與同組賽程中…"))); return block; }
  if (sit.state !== "ok") { block.append(h("p", { class: "muted" }, ui(`資料不足：${sit.why}`)), refresh); return block; }
  const H = model.home;
  const A = model.away;
  block.append(h("p", null, h("b", null, ui(`${model.leagueName}${ctx.seasonName ? "｜" + ctx.seasonName : ""}${sit.groupName && sit.rules?.type !== "league" ? "｜" + sit.groupName.replace(/^Group /, "") + " 組" : ""}`))), v2Meta(sit, ctx));
  if (!ctx.sameGroup && ctx.otherGroup) block.append(h("p", { class: "muted" }, ui(`兩隊不在同一組，以下是${H.name}所在小組；${A.name}在另一組。`)));
  for (const n of sit.notes) block.append(h("p", { class: "v2-note" }, ui("⚠️ " + n)));

  /* 積分榜 */
  const k = sit.mainK;
  const zcls = (z) => (z ? `z-${z.type}` : "");
  block.append(h("div", { class: "table-wrap" }, h("table", { class: "v2-table" },
    h("thead", null, h("tr", null, ["#", "球隊", "賽", "勝", "和", "負", "進", "失", "淨", "分"].map((x) => h("th", null, ui(x))))),
    h("tbody", null, sit.table.map((r) => h("tr", { class: `${r.id === H.id || r.id === A.id ? "me" : ""} ${zcls(r.zone)}` },
      h("td", null, String(r.rank) + (r.tied?.length ? "=" : "")),
      h("td", { class: "tn" }, ui(r.name), r.zone ? h("span", { class: "v2-zone" }, ui(r.zone.label)) : null, sit.status && k ? h("div", null, v2StatusBadge(sit, focusK(sit, r.id), r.id)) : null),
      ...[r.p, r.w, r.d, r.l, r.gf, r.ga, (r.gd > 0 ? "+" : "") + r.gd].map((x) => h("td", null, String(x))),
      h("td", { class: "pts" }, String(r.pts))))))));
  if (sit.unresolved?.length) block.append(h("p", { class: "v2-note" }, ui(`⚠️ ${sit.unresolved.map((t) => t.map(sit.nameOf).join("、")).join("；")} 的積分與可比較項目完全相同（名次標「=」），要靠公平競賽分、抽籤或賽前排名決定，這些資料看板沒有。`)));
  if (sit.rules?.bestThird) block.append(h("p", { class: "v2-note" }, ui(`小組第三名還要跨組比較（${sit.rules.bestThird.of} 組取 ${sit.rules.bestThird.take} 隊），看板目前只算單一小組，第三名能否晉級列為「資料不足」。`)));

  /* 兩隊形勢 */
  if (sit.status) {
    const cards = h("div", { class: "v2-two" });
    for (const t of [H, A]) {
      const r = sit.table.find((x) => x.id === t.id);
      if (!r) continue;
      const card = h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui(`${t.name}｜第 ${r.rank}、${r.pts} 分`)));
      for (const tg of sit.targets) {
        const s = mvStatusText(sit, tg.k, t.id);
        if (!s) continue;
        card.append(h("div", { class: "v2-line" }, h("span", { class: "faint" }, ui(`${tg.label}（前 ${tg.k}）`)), v2StatusBadge(sit, tg.k, t.id)));
        for (const n of s.notes) card.append(h("p", { class: "faint" }, ui(n)));
        const raw = sit.status.get(tg.k)?.get(t.id)?.raw;
        if (raw?.own && !raw.clinched && raw.possible) {
          const txt = (key, zh) => (raw.seen[key] ? `${zh}：${raw.clinchIf[key] ? "確定" : raw.possibleIf[key] ? "要看其他場次／同分比較" : "確定無緣"}` : "");
          card.append(h("p", { class: "v2-if" }, ui([txt("W", "贏"), txt("D", "平"), txt("L", "輸")].filter(Boolean).join("｜"))));
        }
      }
      const fk = focusK(sit, t.id);
      if (sit.goalsNeeded && sit.isLive && r.rank > fk && sit.status.get(fk)?.get(t.id)?.code !== "out") {
        const g = sit.goalsNeeded(t.id, fk);
        card.append(h("p", { class: "lean" }, ui(g ? `其他場次不變的話，再進 ${g} 球可進到前 ${fk}。` : `其他場次不變的話，自己再進 3 球也進不了前 ${fk}，需要別場幫忙。`)));
      }
      cards.append(card);
    }
    block.append(cards);
  }

  /* 本場結果 → 名次 */
  if (sit.scenarios) {
    block.append(h("h3", null, ui("本場結果與名次變化")), h("div", { class: "table-wrap" }, h("table", { class: "v2-table sc" },
      h("thead", null, h("tr", null, [model.minute.phase === "pre" ? "如果" : "接下來", H.name, A.name].map((x) => h("th", null, ui(x))))),
      h("tbody", null, sit.scenarios.map((sc) => h("tr", null, h("th", null, ui(`${sc.label}（${sc.hs}:${sc.as}）`)), ...[H, A].map((t) => {
        const r = sc.rows.find((x) => x.id === t.id);
        const z = sit.zoneByRank.get(r.rank);
        return h("td", { class: zcls(z) }, ui(`第 ${r.rank}${r.tied?.length ? "=" : ""}（${r.pts} 分）${z ? " " + z.label : ""}`));
      })))))),
      h("p", { class: "faint" }, ui(sit.matches ? "其他進行中的同組比賽照目前比分計算，尚未開踢的不計。名次旁的區域說明取自 ESPN 積分榜。" : "只計本場，同輪其他比賽未計。")));
  }

  /* 下一球 */
  if (sit.nextGoal?.length) {
    const items = sit.nextGoal.map((g) => {
      const ch = g.changes.filter((c) => c.enters || c.drops);
      const all = g.changes.map((c) => `${sit.nameOf(c.id)} ${c.from}→${c.to}`).join("、");
      return h("li", { class: ch.length ? "key" : "" }, h("b", null, ui(`${g.match === model.id ? "" : "【隔壁場】"}${sit.nameOf(g.scorer)}進球（${g.score}）：`)),
        ui(ch.length ? ch.map((c) => `${sit.nameOf(c.id)}${c.enters ? "升進" : "掉出"}前 ${k}`).join("、") : all ? `名次變動 ${all}，前 ${k} 不變` : "名次不變"));
    });
    block.append(h("h3", null, ui("下一球的影響")), h("ul", { class: "v2-list" }, items));
  }
  const log = v2Log.get(model.id) || [];
  if (log.length) block.append(h("h3", null, ui("形勢變化紀錄")), h("ul", { class: "v2-list" }, log.map((x) => h("li", { class: x.key ? "key" : "" }, ui(`${taipeiClock(new Date(x.at))}　${x.text}`)))));

  /* 同組比賽、手動修正 */
  if (sit.matches) {
    const key = simKey(ctx);
    const sim = sit.sim || {};
    const setSim = (id, hs, as) => {
      const next = { ...simRead(key) };
      if (hs == null) delete next[id]; else next[id] = { hs, as };
      simWrite(key, next);
      maybeRender({ soft: true });
    };
    const rowsM = sit.matches.map((m) => {
      const stt = m.state === "post" ? "完賽" : m.state === "in" ? (m.simulated ? "模擬中" : `進行中 ${m.clock || ""}`) : `未開賽 ${shortDate(m.date)} ${taipeiHM(m.date)}`;
      const score = Number.isFinite(m.hs) ? `${m.hs} : ${m.as}` : "–";
      const line = h("div", { class: `v2-match ${m.id === model.id ? "me" : ""} ${m.state}` },
        h("span", { class: "v2-mt" }, ui(sit.nameOf(m.home)), h("b", null, ` ${score} `), ui(sit.nameOf(m.away))),
        h("span", { class: "faint" }, ui(stt)));
      if (m.state !== "post" || sim[m.id]) {
        const ih = h("input", { type: "number", min: "0", max: "20", class: "v2-in", value: sim[m.id]?.hs ?? (Number.isFinite(m.hs) ? m.hs : ""), "aria-label": "主隊比分" });
        const ia = h("input", { type: "number", min: "0", max: "20", class: "v2-in", value: sim[m.id]?.as ?? (Number.isFinite(m.as) ? m.as : ""), "aria-label": "客隊比分" });
        line.append(h("span", { class: "v2-sim" }, ih, ":", ia,
          h("button", { class: "chip", onclick: () => { const a = Number(ih.value); const b = Number(ia.value); if (ih.value !== "" && ia.value !== "" && a >= 0 && b >= 0) setSim(m.id, a, b); } }, ui("套用")),
          sim[m.id] ? h("button", { class: "chip", onclick: () => setSim(m.id, null) }, ui("取消")) : null));
      }
      return line;
    });
    block.append(h("details", { class: "fold", "data-k": "v2-matches", open: sit.isLive || Object.keys(sim).length > 0 },
      h("summary", null, ui(`同組比賽（${sit.played.length} 完賽、${sit.live.length} 進行中、${sit.remaining.length} 未賽）與手動修正`)),
      h("p", { class: "faint" }, ui("ESPN 比分延遲或想試算時，在這裡輸入比分按「套用」，整頁的名次、形勢與口播都會改用這個比分，並標示為模擬；按「取消」恢復。只存在這台裝置。")),
      ...rowsM,
      Object.keys(sim).length ? h("button", { class: "chip", onclick: () => { simWrite(key, {}); maybeRender({ soft: true }); } }, ui("全部恢復成 ESPN 比分")) : null));
  }

  /* 規則 */
  const rules = sit.rules;
  block.append(h("details", { class: "fold", "data-k": "v2-rules" }, h("summary", null, ui("本賽事採用的排名規則")),
    rules ? h("ul", { class: "v2-list" },
      h("li", null, ui(`勝 ${rules.points[0]} 分、平 ${rules.points[1]} 分、負 ${rules.points[2]} 分。`)),
      h("li", null, ui(`同分比較順序：${tiebreakText(rules)}。`)),
      rules.h2hNeedsComplete ? h("li", null, ui("同分球隊之間的比賽全部踢完後才比對戰成績，之前先比淨勝球。")) : null,
      ...(rules.notes || []).map((n) => h("li", null, ui(n))),
      h("li", null, ui(`規則來源：${rules.source}｜${rules.confirmed ? "已核對" : "尚未逐條核對，僅供參考"}｜版本 ${rules.version}`)),
      h("li", null, ui("「數學上確定」的判定不依賴同分比較：只有在任何比分組合下都成立才會顯示。")))
      : h("p", { class: "muted" }, ui("這項賽事的規則尚未建檔，不做出線判定。"))));
  block.append(refresh);
  return block;
}

/* ---------- 戰意 ---------- */

function motivationView(model) {
  const sit = v2Sit(model);
  const block = h("section", { class: "block", id: "v2-motive" }, h("h2", null, ui("球隊戰意分析")));
  if (sit.state === "loading") { block.append(h("p", { class: "muted" }, ui("讀取積分形勢中…"))); return block; }
  const mot = motivation(model, sit);
  const tagCls = { 事實: "fact", 計算: "calc", 推測: "guess", 資料不足: "na" };
  const list = (items) => h("ul", { class: "v2-tagged" }, items.map((x) => h("li", null, h("span", { class: `v2-tag ${tagCls[x.tag] || ""}` }, ui(x.tag)), ui(x.text))));
  block.append(h("p", { class: "faint" }, ui("每一句都標示來源性質：事實＝資料直接提供；計算＝依賽事規則算出；推測＝由前兩者推論，可能不成立。")));
  const two = h("div", { class: "v2-two" });
  for (const side of ["home", "away"]) {
    const s = mot.sides[side];
    two.append(h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui(`${side === "home" ? "🏠" : "✈️"} ${s.name}`)), list(s.items)));
  }
  block.append(two,
    h("h3", null, ui("戰意差異")), list(mot.diff),
    mot.tactics.length ? h("h3", null, ui("可能的戰術策略")) : null, mot.tactics.length ? list(mot.tactics) : null,
    h("h3", null, ui("需要持續觀察的訊號")), h("ul", { class: "v2-list" }, mot.signals.map((x) => h("li", null, ui(x)))),
    h("h3", null, ui("反向情境與不確定因素")), h("ul", { class: "v2-list" }, mot.counter.map((x) => h("li", null, ui(x)))),
    h("h3", null, ui("資料完整度")), h("div", { class: "v2-chips" }, mot.completeness.map(([k, ok]) => h("span", { class: ok ? "pill v2-have" : "pill v2-miss" }, ui(`${ok ? "✓" : "✗"} ${k}`)))));
  return block;
}

/* ---------- 主播口播 ---------- */

function commentaryView(model) {
  const sit = v2Sit(model);
  const block = h("section", { class: "block", id: "v2-script" }, h("h2", null, ui("主播口播產生器")));
  if (sit.state === "loading") { block.append(h("p", { class: "muted" }, ui("讀取積分形勢中…"))); return block; }
  const mot = motivation(model, sit);
  state.cm = state.cm || { style: "mix", secs: 30, seed: 1 };
  const cm = state.cm;
  const set = (k, v) => { cm[k] = v; maybeRender({ soft: true }); };
  block.append(
    h("div", { class: "chips" }, Object.entries(CM_STYLES).map(([id, s]) => h("button", { class: "chip", "aria-pressed": String(cm.style === id), onclick: () => set("style", id) }, ui(s.name)))),
    h("div", { class: "chips" }, [15, 30, 60].map((n) => h("button", { class: "chip", "aria-pressed": String(cm.secs === n), onclick: () => set("secs", n) }, ui(`${n} 秒`))),
      h("button", { class: "chip", onclick: () => set("seed", cm.seed + 1) }, ui("🔁 全部重新產生"))));
  const sections = cmFacts(model, sit, mot);
  const phase = model.minute.phase;
  block.append(h("p", { class: "faint" }, ui(`目前階段：${phase === "pre" ? "賽前" : phase === "ft" || model.minute.state === "post" ? "賽後" : "比賽中"}。文案由積分、規則與比賽資料套模板產生，沒有資料的段落不會出現；語言跟著上方「台灣用語／大陸用語」切換。`)));
  if (!sections.length) { block.append(h("p", { class: "muted" }, ui("資料不足：沒有可用的積分或比賽資料，無法產生口播。"))); return block; }
  if (typeof cmAnalysisBlock === "function") block.append(cmAnalysisBlock(model));
  if (typeof aiSettings === "function") block.append(aiSettings());
  for (const sec of sections) {
    cm.per = cm.per || {};
    const seed = `${model.id}-${cm.seed}-${cm.per[sec.id] || 0}`;
    const text = speak(cmCompose(sec, cm.style, cm.secs, seed));
    const copy = h("button", { class: "copy" }, ui("複製口播"));
    copy.addEventListener("click", () => copyText(text, copy));
    block.append(h("div", { class: "script" },
      h("div", { class: "script-k" }, ui(`${sec.title}｜約 ${cm.secs} 秒（${text.length} 字）`)),
      h("p", { class: "say" }, text),
      h("div", { class: "chips" }, copy, h("button", { class: "chip", onclick: () => { cm.per[sec.id] = (cm.per[sec.id] || 0) + 1; maybeRender({ soft: true }); } }, ui("🔁 重新產生"))),
      typeof aiBlock === "function" ? aiBlock(model, sec, cm) : null));
  }
  return block;
}

/* ---------- 盤口觀察 ---------- */

function v2MarketView(model) {
  const sit = v2Sit(model);
  const block = h("section", { class: "block", id: "v2-market" }, h("h2", null, ui("盤口觀察面板")));
  if (typeof recordCalibration === "function") recordCalibration(model);
  const mot = sit.state === "loading" ? null : motivation(model, sit);
  const list = marketPanel(model, sit, mot);
  block.append(h("p", { class: "faint" }, ui("機率只來自可解釋的統計模型；ESPN 只提供讓球、大小球與勝平負的賠率，其他盤口沒有市場價。沒有資料的地方一律寫「資料不足」。理性購彩、未成年人不得購彩。")));
  for (const m of list) {
    const row = (k, v) => (v && (!Array.isArray(v) || v.length) ? h("tr", null, h("th", null, ui(k)), h("td", null, Array.isArray(v) ? h("ul", { class: "v2-mini" }, v.map((x) => h("li", null, ui(x)))) : ui(v))) : null);
    const pctDone = Math.round((m.comp.have / m.comp.need) * 100);
    block.append(h("details", { class: "fold v2-mk", "data-k": "mk-" + m.id, open: m.id === "ah" || m.id === "ou" },
      h("summary", null, ui(m.title), h("span", { class: `v2-comp ${pctDone >= 75 ? "hi" : pctDone >= 40 ? "mid" : "lo"}` }, ui(`資料 ${m.comp.have}/${m.comp.need}`))),
      h("table", { class: "fact-table kv" }, h("tbody", null,
        row("目前盤口", m.line + (m.lineTime ? `（${m.lineTime} 取得）` : "")),
        row("市場抽水", m.vig != null ? `約 ${trimNum(Math.round(m.vig * 1000) / 10)}%（兩邊隱含機率合計超過 100% 的部分）` : ""),
        row("模型（計算）", m.modelText),
        row("有利因素", m.pros), row("不利因素", m.cons),
        row("戰意的可能影響（推測）", m.motivation), row("場上支持訊號", m.pitch),
        row("反向風險", m.risks), row("需要重新評估的條件", m.recheck),
        row("缺少的資料", m.comp.missing.length ? m.comp.missing.join("、") : "無"),
        row("分析結論", m.conclusion)))));
  }
  const cal = calibration();
  const zh = { "1x2": "勝平負", ou: "大小球", ah: "讓球", "ah-rest": "滾球讓球", btts: "雙方進球", score: "比分", next: "下一球", ht: "半場勝平負", "ht-ou": "半場大小", "corners-ou": "角球", "cards-ou": "黃牌" };
  block.append(h("details", { class: "fold", "data-k": "v2-calib" }, h("summary", null, ui(`模型版本與校準表現（本裝置已對帳 ${cal.games} 場）`)),
    h("p", { class: "faint" }, ui(MK_MODEL)),
    cal.games ? predTable(["盤口", "命中", "未中", "走盤", "無法判定", "命中率"], Object.entries(cal.total).map(([k, v]) => ({ cells: [zh[k] || k, String(v.hit), String(v.miss), String(v.push), String(v.na), v.hit + v.miss ? pct(v.hit / (v.hit + v.miss)) : "–"] })))
      : h("p", { class: "muted" }, ui("還沒有完賽對帳的樣本。每場比賽開賽前打開看板、完賽後再打開一次，就會累積一筆。樣本少於 30 場時，命中率只能當參考。")),
    h("p", { class: "faint" }, ui("亞洲讓球的四分之一盤（半贏、半輸）目前併入命中或未中計算，尚未分開統計。"))));
  return block;
}

function v2Render(model, view) {
  if (view === "table") return standingsView(model);
  if (view === "motive") return motivationView(model);
  if (view === "motive2") return motive2View(model);
  if (view === "script") return commentaryView(model);
  if (view === "market") return v2MarketView(model);
  return null;
}
