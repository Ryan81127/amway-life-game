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
    add("近10場", "讀取中", "讀取賽程中…");
  } else {
    const sum = (t, key) => t.games.reduce((a, g) => a + g[key], 0);
    const line = (name, t, key) => (t.games.length ? `${name}${sum(t, key)}球${t.games.length < 10 ? `（${t.games.length}場）` : ""}，場均${trimNum(Math.round(sum(t, key) / t.games.length * 10) / 10)}` : `${name}資料不足`);
    const tagOf = H.games.length || A.games.length ? "事實" : "資料不足";
    add("近10場進球", tagOf, `${line(hn, H, "gf")}；${line(an, A, "gf")}`);
    add("近10場丟球", tagOf, `${line(hn, H, "ga")}；${line(an, A, "ga")}`);
  }
  const deep = typeof h2hSummary === "function" ? h2hSummary(model, 10) : null;
  const hh = model.h2h || { games: [] };
  const n = hh.hw + hh.aw + hh.dr;
  if (deep?.status === "ok" && deep.n >= Math.max(1, n)) add("歷史交手", "事實", `近${deep.n}次${hn}${deep.w}勝${deep.d}和${deep.l}負，進${deep.gf}失${deep.ga}${deep.since ? `（${new Date(deep.since).getFullYear()}起）` : ""}`);
  else if (deep?.status === "loading" && !n) add("歷史交手", "讀取中", "查詢多賽季交手中…");
  else add("歷史交手", n ? "事實" : "資料不足", n ? `近${n}次${hn}${hh.hw}勝${hh.dr}和${hh.aw}負` : "ESPN 近 9 季無交手紀錄");
  const mv = typeof oddsMovement === "function" ? oddsMovement(model) : null;
  const L = caLines(model);
  if (!model.odds) add("盤口走勢", "資料不足", "本場沒有盤口資料");
  else if (mv?.items?.length) add("盤口走勢", "事實", (() => { const x = mv.items.find((i) => i.market !== "獨贏") || mv.items[0]; return `${x.market}${x.text.replace(/（.*?）/g, "")}`; })());
  else add("盤口走勢", mv?.hasOpen ? "事實" : "資料不足", mv?.hasOpen ? "初盤至今無明顯升降" : "無初盤可比較");
  if (L.ah == null || H.loading || (!H.games?.length && !A.games?.length)) {
    add("贏盤率", "資料不足", L.ah == null ? "沒有讓球盤，無法計算" : "近期賽程不足，無法計算");
  } else {
    const rate = (t, line) => {
      let w = 0; let d = 0;
      for (const g of t.games) { const c = typeof ahDetail === "function" ? ahDetail(g.gf - g.ga, line) : null; if (c === "hit") w += 1; else if (c === "halfwin") w += 0.5; if (c === "push") d += 1; }
      const den = t.games.length - d;
      return den ? `${Math.round((w / den) * 100)}%` : "–";
    };
    add("贏盤率", "計算", `以本場${L.ah > 0 ? "+" : ""}${Math.round(L.ah * 100) / 100}回套近況：${hn}${rate(H, L.ah)}、${an}${rate(A, -L.ah)}（非實際盤口）`);
  }
  if (L.ou == null || H.loading || (!H.games?.length && !A.games?.length)) {
    add("大小分", "資料不足", L.ou == null ? "沒有大小盤，無法比較" : "近期賽程不足");
  } else {
    const all = [...(H.games || []), ...(A.games || [])];
    const over = all.filter((g) => g.gf + g.ga > L.ou).length;
    const p = over / all.length;
    add("大小分", "計算", `近${all.length}場${over}場大於${Math.round(L.ou * 100) / 100}，${p >= 0.6 ? "偏大" : p <= 0.4 ? "偏小" : "大小接近"}`);
  }
  const sig = mv?.signal;
  if (!model.odds || !mv?.hasOpen) add("資金走勢", "資料不足", "無投注量與初盤資料");
  else if (sig?.side || sig?.total) {
    const side = sig.side === "home" ? hn : sig.side === "away" ? an : sig.side === "mixed" ? "兩邊拉鋸" : "";
    const tot = sig.total === "over" ? "偏大分" : sig.total === "under" ? "偏小分" : "";
    add("資金走勢", "推測", `水位顯示${[side ? `偏${side}` : "", tot].filter(Boolean).join("、")}（非投注量）`);
  } else add("資金走勢", "推測", "水位平穩，看不出方向（非投注量）");
  return out;
}

function cmAnalysisBlock(model) {
  if (typeof ensureDeepH2H === "function") ensureDeepH2H(model);
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
