/* 對帳視覺化：命中率圓環、預測 vs 實際數據對比條、賽前預測卡片（左預測／右實際）、滾球與角球快照命中矩陣。 */

function svRing(label, hit, n, big) {
  const p = n ? hit / n : 0;
  const color = !n ? "rgba(255,255,255,.15)" : p >= 0.6 ? "#4fd18b" : p >= 0.4 ? "#f0c36a" : "#ff7b7b";
  return h("div", { class: big ? "sv-ring big" : "sv-ring" },
    h("div", { class: "sv-dial", style: `background:conic-gradient(${color} ${Math.round(p * 360)}deg, rgba(255,255,255,.08) 0)` },
      h("div", { class: "sv-in" }, h("b", null, n ? `${Math.round(p * 100)}%` : "–"), h("span", null, `${hit}/${n}`))),
    h("div", { class: "sv-rl" }, ui(label)));
}

function svBadge(hit) {
  if (hit === true) return h("span", { class: "sv-b hit" }, "✅");
  if (hit === false) return h("span", { class: "sv-b miss" }, "❌");
  if (hit === "push") return h("span", { class: "sv-b push" }, "↔");
  if (hit === "na") return h("span", { class: "sv-b na" }, "–");
  return h("span", { class: "sv-b pend" }, "⏳");
}

/* 預測 vs 實際：每個數據一列，上條預測、下條實際，同一個比例尺 */
function svMetricRows(model) {
  const saved = loadPrediction(model.id);
  const bag = ledgerRead(model.id);
  const A = ledgerActual(model);
  const rows = [];
  const H = model.home.name;
  const AW = model.away.name;
  const live = (bag?.live || []).slice(-1)[0];
  const liveScore = live?.items?.find((x) => x.kind === "score")?.score;
  const [lsH, lsA] = liveScore ? liveScore.split("-").map(Number) : [null, null];
  if (saved && A.scoresOk) {
    rows.push({ k: `${H} 進球`, pre: saved.lh, live: lsH, act: A.hs });
    rows.push({ k: `${AW} 進球`, pre: saved.la, live: lsA, act: A.as });
    rows.push({ k: "總進球", pre: saved.lh + saved.la, live: lsH != null ? lsH + lsA : null, act: A.hs + A.as });
  }
  const cMu = saved?.corners?.mu ?? bag?.corners?.mu;
  const cLive = (bag?.cornerLive || []).slice(-1)[0]?.item?.mu;
  if (cMu != null || cLive != null) rows.push({ k: "角球", pre: cMu, live: cLive, act: A.corners });
  const yMu = saved?.cards?.mu ?? bag?.pre?.items?.find((x) => x.kind === "cards-ou")?.mu;
  if (yMu != null) rows.push({ k: "黃牌", pre: yMu, live: null, act: A.yellow });
  if (A.htOk && saved?.corners?.h1 != null && typeof cornerData === "function") {
    const d = cornerData(model);
    if (d.log) rows.push({ k: "上半場角球", pre: saved.corners.h1, live: null, act: d.log.filter((x) => x.period === 1).length });
  }
  return rows;
}

function svBars(rows) {
  const wrap = h("div", { class: "sv-bars" });
  wrap.append(h("div", { class: "sv-legend" }, h("span", { class: "lg pre" }, ui("賽前預測")), h("span", { class: "lg live" }, ui("最後一次滾球")), h("span", { class: "lg act" }, ui("實際"))));
  for (const r of rows) {
    const max = Math.max(1, ...[r.pre, r.live, r.act].filter((x) => Number.isFinite(x))) * 1.15;
    const bar = (cls, v) => Number.isFinite(v)
      ? h("div", { class: "sv-line" }, h("div", { class: `sv-fill ${cls}`, style: `width:${Math.max(2, (v / max) * 100)}%` }), h("span", { class: "sv-num" }, trimNum(Math.round(v * 10) / 10)))
      : null;
    const diff = Number.isFinite(r.pre) && Number.isFinite(r.act) ? r.act - r.pre : null;
    wrap.append(h("div", { class: "sv-row" },
      h("div", { class: "sv-k" }, ui(r.k), diff != null ? h("span", { class: Math.abs(diff) <= 0.75 ? "sv-diff ok" : "sv-diff off" }, `${diff > 0 ? "+" : ""}${trimNum(Math.round(diff * 10) / 10)}`) : null),
      h("div", { class: "sv-lines" }, bar("pre", r.pre), bar("live", r.live), Number.isFinite(r.act) ? bar("act", r.act) : h("div", { class: "sv-line faint" }, ui("實際：ESPN 沒有數字")))));
  }
  return wrap;
}

/* 賽前預測卡：左預測、右實際，中間結果 */
function svCards(rows) {
  return h("div", { class: "sv-cards" }, rows.map((r) => h("div", { class: `sv-card ${r.hit === true ? "hit" : r.hit === false ? "miss" : ""}` },
    h("div", { class: "sv-ct" }, ui(r.label)),
    h("div", { class: "sv-cmp" },
      h("div", { class: "sv-side" }, h("small", null, ui("預測")), h("b", null, ui(r.pick))),
      svBadge(r.hit),
      h("div", { class: "sv-side r" }, h("small", null, ui("實際")), h("b", null, ui(r.actual)))))));
}

/* 滾球快照矩陣：列＝盤口，欄＝分鐘 */
function svMatrix(model, bag) {
  const snaps = bag?.live || [];
  if (!snaps.length) return null;
  const kinds = [["1x2", "勝平負"], ["next", "下一球"], ["ou", "大小球"], ["ah-rest", "滾球讓球"], ["btts", "雙方進球"], ["score", "比分"]];
  const graded = snaps.map((snap) => ({ minute: snap.minute, cells: Object.fromEntries((snap.items || []).map((it) => [it.kind, { it, g: gradeOne(it, model, snap) }])) }));
  const table = h("table", { class: "sv-matrix" },
    h("thead", null, h("tr", null, h("th", null, ui("盤口＼時間")), ...graded.map((g) => h("th", null, ledgerMinuteLabel(g.minute))))),
    h("tbody", null, kinds.filter(([k]) => graded.some((g) => g.cells[k])).map(([k, label]) => {
      const row = graded.map((g) => g.cells[k]).filter(Boolean).map((c) => c.g).filter((g) => g.hit === true || g.hit === false);
      const hitN = row.filter((g) => g.hit === true).length;
      return h("tr", null,
        h("th", null, ui(label), h("span", { class: "sv-mrate" }, row.length ? ` ${hitN}/${row.length}` : "")),
        ...graded.map((g) => {
          const c = g.cells[k];
          if (!c) return h("td", null, "");
          const cls = c.g.hit === true ? "hit" : c.g.hit === false ? "miss" : c.g.hit === "push" ? "push" : "pend";
          return h("td", { class: `sv-cell ${cls}`, title: `${c.it.text} → ${c.g.actual}` }, h("div", { class: "sv-cv" }, ui(c.it.text.replace(/（只算這之後的進球）/, "").replace(/^全場/, ""))));
        }));
    })));
  return h("div", { class: "sv-mwrap" }, table);
}

function svCornerStrip(model, bag) {
  const items = [];
  if (bag?.corners?.item) items.push({ minute: "賽前", it: bag.corners.item, g: gradeOne(bag.corners.item, model, null) });
  for (const snap of bag?.cornerLive || []) items.push({ minute: ledgerMinuteLabel(snap.minute), it: snap.item, g: gradeOne(snap.item, model, snap) });
  if (!items.length) return null;
  return h("div", { class: "sv-strip" }, items.map((x) => h("div", { class: `sv-chip ${x.g.hit === true ? "hit" : x.g.hit === false ? "miss" : "pend"}`, title: x.g.gap },
    h("small", null, ui(x.minute)), h("b", null, ui(x.it.text.replace(/（預估.*）/, "").replace("角球", ""))), svBadge(x.g.hit))));
}

function settleVisual(model, rows, by, bag) {
  const wrap = h("div", { class: "sv" });
  const judged = rows.filter((r) => r.hit === true || r.hit === false);
  const hits = judged.filter((r) => r.hit === true).length;
  wrap.append(h("div", { class: "sv-rings" },
    svRing("總命中", hits, judged.length, true),
    svRing("賽前", by.pre.h, by.pre.n),
    svRing("滾球", by.live.h, by.live.n),
    svRing("角球", by.corner.h, by.corner.n)));
  const metrics = svMetricRows(model);
  if (metrics.length) wrap.append(h("h3", null, ui("📊 數據對比：預測 vs 實際")), svBars(metrics));
  const pre = rows.filter((r) => ledgerGroup(r.cat) === "pre");
  if (pre.length) wrap.append(h("h3", null, ui("🎯 賽前預測對帳")), svCards(pre));
  const mx = svMatrix(model, bag);
  if (mx) wrap.append(h("h3", null, ui("🎲 滾球快照命中表（每 5 分鐘一欄）")), mx, h("p", { class: "faint" }, ui("綠＝達成、紅＝未中、灰＝還沒定案；手指按住格子可看「預測 → 實際」。")));
  const cs = svCornerStrip(model, bag);
  if (cs) wrap.append(h("h3", null, ui("⛳ 角球預測時間線")), cs);
  return wrap;
}
