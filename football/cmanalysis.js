/* 主播解說：條列式賽前分析（約 200 字）。
   每一條都標明來源：事實（ESPN 資料）、計算（用資料算出）、推測（從盤口變化推論）、資料不足。
   ESPN 不提供各場歷史盤口與投注量，所以「贏盤率」用本場盤口回套近 10 場來算，「資金走勢」只能從水位推測。 */

function caTeamTen(model, side) {
  const sch = typeof mvSched !== "undefined" ? mvSched.get(model.id) : null;
  if (!sch || sch.status === "loading") return { loading: true };
  const id = String(model[side].id);
  const list = (sch[side]?.past10 || []).filter((m) => Number.isFinite(m.hs) && Number.isFinite(m.as) && (m.home === id || m.away === id));
  return { games: list.map((m) => { const me = m.home === id; return { gf: me ? m.hs : m.as, ga: me ? m.as : m.hs }; }) };
}

function caLines(model) {
  const b = model.odds;
  if (!b) return {};
  const q = (g) => (typeof curQ === "function" ? curQ(g) : null) || g?.pre || null;
  const ah = q(b.spread?.home)?.line;
  const ou = q(b.total?.over)?.line;
  return { ah: Number.isFinite(ah) ? ah : null, ou: Number.isFinite(ou) ? ou : null };
}

function cmAnalysis(model) {
  const hn = model.home.name;
  const an = model.away.name;
  const H = caTeamTen(model, "home");
  const A = caTeamTen(model, "away");
  const out = [];
  const add = (k, tag, text) => out.push({ k, tag, text });
  if (H.loading || A.loading) {
    add("近10場", "讀取中", "讀取兩隊近期賽程中…");
  } else {
    const sum = (t, key) => t.games.reduce((a, g) => a + g[key], 0);
    const line = (name, t, key, word) => (t.games.length ? `${name}${t.games.length}場${word}${sum(t, key)}（場均${trimNum(Math.round(sum(t, key) / t.games.length * 10) / 10)}）` : `${name}資料不足`);
    const tagOf = H.games.length || A.games.length ? "事實" : "資料不足";
    add("近10場進球", tagOf, `${line(hn, H, "gf", "進")}；${line(an, A, "gf", "進")}`);
    add("近10場丟球", tagOf, `${line(hn, H, "ga", "失")}；${line(an, A, "ga", "失")}`);
  }
  const hh = model.h2h || { games: [] };
  const n = hh.hw + hh.aw + hh.dr;
  add("歷史交手", n ? "事實" : "資料不足", n ? `ESPN 列出 ${n} 次：${hn}${hh.hw}勝、和${hh.dr}、${an}${hh.aw}勝` : "ESPN 沒有提供兩隊交手紀錄");
  const mv = typeof oddsMovement === "function" ? oddsMovement(model) : null;
  const L = caLines(model);
  if (!model.odds) add("盤口走勢", "資料不足", "本場沒有盤口資料");
  else if (mv?.items?.length) add("盤口走勢", "事實", mv.items.slice(0, 2).map((x) => `${x.market} ${x.text}`).join("；"));
  else add("盤口走勢", "事實", mv?.hasOpen ? "初盤到現在沒有明顯升降盤" : "ESPN 沒給初盤，無法比較走勢");
  if (L.ah == null || H.loading || (!H.games?.length && !A.games?.length)) {
    add("贏盤率", "資料不足", L.ah == null ? "沒有讓球盤，無法計算" : "近期賽程不足，無法計算");
  } else {
    const rate = (t, line) => {
      let w = 0; let d = 0;
      for (const g of t.games) { const c = typeof ahDetail === "function" ? ahDetail(g.gf - g.ga, line) : null; if (c === "hit") w += 1; else if (c === "halfwin") w += 0.5; if (c === "push") d += 1; }
      const den = t.games.length - d;
      return den ? `${Math.round((w / den) * 100)}%` : "–";
    };
    add("贏盤率", "計算", `用本場盤口 ${hn}${L.ah > 0 ? "+" : ""}${trimNum(L.ah)} 回套近10場：${hn}${rate(H, L.ah)}、${an}${rate(A, -L.ah)}（非當時實際盤口）`);
  }
  if (L.ou == null || H.loading || (!H.games?.length && !A.games?.length)) {
    add("大小分", "資料不足", L.ou == null ? "沒有大小盤，無法比較" : "近期賽程不足");
  } else {
    const all = [...(H.games || []), ...(A.games || [])];
    const over = all.filter((g) => g.gf + g.ga > L.ou).length;
    const p = over / all.length;
    add("大小分", "計算", `兩隊近期 ${all.length} 場有 ${over} 場總進球大於 ${trimNum(L.ou)}，${p >= 0.6 ? "走勢偏大" : p <= 0.4 ? "走勢偏小" : "大小接近"}`);
  }
  const sig = mv?.signal;
  if (!model.odds || !mv?.hasOpen) add("資金走勢", "資料不足", "沒有投注量資料，也沒有初盤可比較");
  else if (sig?.side || sig?.total) {
    const side = sig.side === "home" ? hn : sig.side === "away" ? an : sig.side === "mixed" ? "兩邊拉鋸" : "";
    const tot = sig.total === "over" ? "偏大分" : sig.total === "under" ? "偏小分" : "";
    add("資金走勢", "推測", `從賠率水位變化看，資金${[side ? `偏向${side}` : "", tot].filter(Boolean).join("、")}（非實際投注量）`);
  } else add("資金走勢", "推測", "水位變化不大，看不出明顯資金方向（非實際投注量）");
  return out;
}

function cmAnalysisBlock(model) {
  if (typeof ensureTeamSchedule === "function" && typeof mvSched !== "undefined" && !mvSched.has(model.id)) ensureTeamSchedule(model);
  const items = cmAnalysis(model);
  const text = items.map((x) => `・${x.k}：${x.text}`).join("\n");
  const say = speak(text);
  const copy = h("button", { class: "copy" }, ui("複製分析"));
  copy.addEventListener("click", () => copyText(say, copy));
  const tagCls = { 事實: "fact", 計算: "calc", 推測: "guess", 資料不足: "none", 讀取中: "none" };
  return h("div", { class: "script ca" },
    h("div", { class: "script-k" }, ui(`賽前條列分析｜約 ${say.replace(/\n/g, "").length} 字`)),
    h("ul", { class: "ca-list" }, items.map((x) => h("li", null,
      h("b", null, ui(x.k + "：")), speak(x.text), " ", h("span", { class: `ca-tag ${tagCls[x.tag] || ""}` }, ui(x.tag))))),
    h("div", { class: "chips" }, copy));
}
