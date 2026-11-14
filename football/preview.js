/* 賽前前瞻：主隊前瞻、客隊前瞻、整場比賽前瞻。把頁面上的各種資料（近況、預測、球星、缺陣、教練、角球、故事、場地天氣）整理成主播能直接講的內容。 */

function pvPois(l, k) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i += 1) p *= l / i;
  return p;
}

function pvGrid(lh, la) {
  const g = [];
  for (let i = 0; i <= 7; i += 1) for (let j = 0; j <= 7; j += 1) g.push({ i, j, p: pvPois(lh, i) * pvPois(la, j) });
  return g;
}

function pvPred(model) {
  const d = state.pred?.id === model.id ? state.pred.data : null;
  const saved = loadPrediction(model.id);
  const lh = d?.lh ?? saved?.lh;
  const la = d?.la ?? saved?.la;
  if (lh == null || la == null) return null;
  const g = pvGrid(lh, la);
  const sum = (f) => g.filter(f).reduce((a, x) => a + x.p, 0);
  return {
    lh, la,
    win: sum((x) => x.i > x.j), draw: sum((x) => x.i === x.j), lose: sum((x) => x.i < x.j),
    o25: sum((x) => x.i + x.j > 2.5), btts: sum((x) => x.i > 0 && x.j > 0),
    csH: sum((x) => x.j === 0), csA: sum((x) => x.i === 0),
    scores: g.slice().sort((a, b) => b.p - a.p).slice(0, 3).map((x) => ({ s: `${x.i}-${x.j}`, p: x.p }))
  };
}

function pvForm(model, side) {
  const f = (model.form || []).find((x) => x.id === model[side].id);
  const games = f?.games || [];
  if (!games.length) return null;
  const zh = { W: "勝", D: "和", L: "負" };
  const w = games.filter((g) => g.result === "W").length;
  const d = games.filter((g) => g.result === "D").length;
  const l = games.filter((g) => g.result === "L").length;
  let streak = 0;
  for (const g of games) { if (g.result === games[0].result) streak += 1; else break; }
  return {
    n: games.length, w, d, l,
    seq: games.slice().reverse().map((g) => zh[g.result] || "–").join(""),
    last: games[0],
    streak: streak >= 2 ? `${streak} 連${zh[games[0].result] || ""}` : "",
    mood: w >= 4 ? "手感火燙" : w >= 3 ? "狀態不錯" : l >= 3 ? "陷入低潮" : "起伏不定"
  };
}

function pvCoach(model, side) {
  const st = coachStore.get(`${model.home.id}-${model.away.id}`);
  const c = st?.[side];
  const cur = st?.cur?.[side];
  const prof = typeof coachProfile === "function" ? coachProfile(model, side, c?.since) : null;
  return { name: cur?.name || c?.name || "", hook: cur?.hook || "", style: cur?.style?.[0] || "", watch: cur?.watch?.[0] || "", prof, tenure: c?.tenure };
}

function pvStars(model, side) {
  const ti = typeof teamInfo === "function" ? teamInfo(model) : null;
  if (!ti || ti.status !== "ok") return { stars: [], out: [] };
  const stars = starList(model, side, ti).filter((x) => !x.rosterOnly).slice(0, 2);
  const out = absenceList(model, side, ti).filter((x) => x.kind !== "risk").slice(0, 3);
  return { stars, out, ti };
}

/* 勝利關鍵：依雙方風格、預期進球、缺陣自動給 2–3 點 */
function pvKeys(model, side, pred, coach, opp) {
  const keys = [];
  const me = model[side].name;
  const p = coach.prof;
  const op = opp.prof;
  const myXg = pred ? (side === "home" ? pred.lh : pred.la) : null;
  const opXg = pred ? (side === "home" ? pred.la : pred.lh) : null;
  if (p?.poss != null && p.poss <= 45) keys.push("守住陣型、別急著壓上，靠反擊與定位球找機會。");
  else if (p?.poss != null && p.poss >= 56) keys.push("用控球把對手壓在半場，耐心找空檔，小心被打身後。");
  if (myXg != null && opXg != null) {
    if (myXg > opXg + 0.5) keys.push(`模型看好${me}製造更多機會（預期進球 ${fx(myXg)} 對 ${fx(opXg)}），關鍵在把握率。`);
    else if (opXg > myXg + 0.5) keys.push(`${me}預期被壓著打（預期進球 ${fx(myXg)} 對 ${fx(opXg)}），門將和後防要撐住前 30 分鐘。`);
    else keys.push("雙方預期進球接近，先進球的一方會掌握主動權。");
  }
  if (op?.ga != null && op.ga >= 1.4) keys.push(`對手近期場均失 ${trimNum(op.ga)} 球，防線有漏洞可打。`);
  if (p?.ga != null && p.ga <= 0.8) keys.push(`自家防守是本錢：近期場均只失 ${trimNum(p.ga)} 球。`);
  return keys.slice(0, 3);
}

function pvTeamSection(model, side) {
  const id = side === "home" ? "preview-home" : "preview-away";
  const name = model[side].name;
  const oppSide = side === "home" ? "away" : "home";
  const block = h("section", { class: "block", id }, h("h2", null, ui(`${side === "home" ? "🏠 主隊前瞻" : "✈️ 客隊前瞻"}：${name}`)));
  const pred = pvPred(model);
  const form = pvForm(model, side);
  const coach = pvCoach(model, side);
  const opp = pvCoach(model, oppSide);
  const sx = pvStars(model, side);
  const rows = [];
  const say = [];
  if (form) {
    rows.push(["📈 近況", `近 ${form.n} 場 ${form.w} 勝 ${form.d} 和 ${form.l} 負（${form.seq}，由舊到新）${form.streak ? `，目前 ${form.streak}` : ""}；${form.mood}`]);
    say.push(`${name}近 ${form.n} 場 ${form.w} 勝 ${form.d} 和 ${form.l} 負，${form.mood}${form.last ? `，上一場 ${form.last.score || ""} 對 ${form.last.opponent}` : ""}。`);
  }
  if (pred) {
    const pw = side === "home" ? pred.win : pred.lose;
    const xg = side === "home" ? pred.lh : pred.la;
    const cs = side === "home" ? pred.csH : pred.csA;
    rows.push(["🎯 本場預估", `勝率 ${pct(pw)}、和局 ${pct(pred.draw)}；預期進球 ${fx(xg)}；零封對手機率 ${pct(cs)}`]);
    say.push(`模型給${name}的勝率是 ${pct(pw)}，預期進 ${fx(xg)} 球。`);
  }
  if (coach.name) {
    const tags = coach.prof?.tags?.slice(0, 2).join("；") || "";
    rows.push(["👔 教練", `${coach.name}${coach.tenure ? `（任內 ${coach.tenure.w} 勝 ${coach.tenure.d} 和 ${coach.tenure.l} 負）` : ""}${coach.style ? `：${coach.style}` : ""}`]);
    if (tags) rows.push(["🧠 打法", tags]);
    if (coach.prof?.form) rows.push(["🧩 預計陣型", coach.prof.form]);
  }
  if (sx.stars.length) {
    rows.push(["⭐ 關鍵球員", sx.stars.map((s) => `${s.name}（${[s.p?.hasStats ? `本季 ${s.p.goals} 球 ${s.p.assists} 助` : "", s.u ? `近況 ${s.u.min} 分鐘` : ""].filter(Boolean).join("、")}）`).join("；")]);
    say.push(`${name}要看的是 ${sx.stars.map((s) => s.name).join("和")}。`);
  }
  rows.push(["🩹 缺陣", sx.out.length ? sx.out.map((x) => `${x.name}（${x.status}）`).join("、") : (sx.ti ? "目前沒有查到主力缺陣" : "讀取中…")]);
  if (sx.out.length) say.push(`${name}這邊 ${sx.out.map((x) => x.name).join("、")}可能缺陣。`);
  const cm = chStore.get(model.id)?.cm;
  if (cm) rows.push(["⛳ 角球", `預估本場 ${trimNum(side === "home" ? cm.muH : cm.muA)} 角`]);
  const story = (typeof storyOf === "function" ? storyOf(model) : null)?.[side]?.stories?.[0];
  const keys = pvKeys(model, side, pred, coach, opp);
  block.append(h("table", { class: "fact-table kv" }, h("tbody", null, rows.map(([k, v]) => h("tr", null, h("th", null, ui(k)), h("td", null, ui(v)))))));
  if (keys.length) {
    block.append(h("div", { class: "st-label" }, ui("🔑 勝利關鍵")), h("ul", { class: "st-bullets" }, keys.map((k) => h("li", null, ui(k)))));
    say.push(`${name}今天的勝利關鍵：${keys[0]}`);
  }
  if (coach.watch) block.append(h("div", { class: "st-label" }, ui("👀 場邊看點")), h("p", null, ui(coach.watch)));
  if (story) block.append(h("div", { class: "st-label" }, ui("📖 一句故事")), h("p", null, ui(story)));
  if (say.length) block.append(scriptBlock(say, `口播：${side === "home" ? "主隊" : "客隊"}前瞻`));
  return block;
}

function previewBlock(model) {
  /* 叫醒各區資料載入，前瞻會在資料到齊後自動補齊 */
  if (typeof teamInfo === "function") teamInfo(model);
  if (typeof cornerHist === "function") cornerHist(model);
  if (typeof storyOf === "function") storyOf(model);
  if (typeof ensureCoaches === "function" && !coachStore.has(`${model.home.id}-${model.away.id}`)) ensureCoaches(model);
  if (typeof ensureVenue === "function" && !venueStore.has(model.id)) ensureVenue(model);
  const H = model.home.name;
  const A = model.away.name;
  const block = h("section", { class: "block", id: "preview" }, h("h2", null, ui(`🔭 整場前瞻：${H} vs ${A}`)));
  const pred = pvPred(model);
  const ch = pvCoach(model, "home");
  const ca = pvCoach(model, "away");
  const sh = pvStars(model, "home");
  const sa = pvStars(model, "away");
  const fh = pvForm(model, "home");
  const fa = pvForm(model, "away");
  const ven = venueStore.get(model.id);
  const cm = chStore.get(model.id)?.cm;
  const say = [];
  /* 比賽資訊 */
  const info = [
    ["🏆 賽事", model.leagueName || ""],
    ["🕒 開賽", `${shortDate(model.kickoff)} ${taipeiHM(model.kickoff)}（台北）`],
    ["🏟️ 場地", [model.venue, model.city].filter(Boolean).join("，")]
  ];
  if (ven?.weather?.temp != null) info.push(["🌦️ 天氣", `${ven.weather.desc || WMO_ZH[ven.weather.code] || ""} ${Math.round(ven.weather.temp)}°C${ven.weather.pop != null ? `、降雨 ${ven.weather.pop}%` : ""}`]);
  block.append(h("table", { class: "fact-table kv" }, h("tbody", null, info.filter(([, v]) => v).map(([k, v]) => h("tr", null, h("th", null, ui(k)), h("td", null, ui(v)))))));
  /* 實力對比 */
  if (pred) {
    block.append(h("div", { class: "st-label" }, ui("⚖️ 實力對比（模型）")),
      h("div", { class: "pv-bar" },
        h("span", { class: "pv-h", style: `flex:${Math.max(0.05, pred.win)}` }, `${H} ${pct(pred.win)}`),
        h("span", { class: "pv-d", style: `flex:${Math.max(0.05, pred.draw)}` }, ui(`和 ${pct(pred.draw)}`)),
        h("span", { class: "pv-a", style: `flex:${Math.max(0.05, pred.lose)}` }, `${A} ${pct(pred.lose)}`)),
      h("table", { class: "fact-table" }, h("tbody", null,
        h("tr", null, h("th", null, ui("預期進球")), h("td", null, `${fx(pred.lh)} : ${fx(pred.la)}`)),
        h("tr", null, h("th", null, ui("最可能比分")), h("td", null, pred.scores.map((x) => `${x.s}（${pct(x.p)}）`).join("、"))),
        h("tr", null, h("th", null, ui("大 2.5 球")), h("td", null, pct(pred.o25))),
        h("tr", null, h("th", null, ui("兩隊都進球")), h("td", null, pct(pred.btts))),
        cm ? h("tr", null, h("th", null, ui("預估角球")), h("td", null, ui(`全場 ${trimNum(cm.mu)}（上半 ${trimNum(cm.h1)}、下半 ${trimNum(cm.h2)}）`))) : null)));
    const fav = pred.win > pred.lose + 0.1 ? H : pred.lose > pred.win + 0.1 ? A : null;
    say.push(fav ? `賽前模型看好${fav}，勝率 ${pct(Math.max(pred.win, pred.lose))}，最可能的比分是 ${pred.scores[0].s}。` : `兩隊實力接近，和局機率 ${pct(pred.draw)}，最可能的比分是 ${pred.scores[0].s}。`);
  } else {
    block.append(h("p", { class: "muted" }, ui("賽前預測載入後會出現實力對比。")));
  }
  /* 三大看點 */
  const points = [];
  if (ch.prof?.poss != null && ca.prof?.poss != null) {
    points.push(Math.abs(ch.prof.poss - ca.prof.poss) >= 8
      ? `戰術對決：${ch.prof.poss > ca.prof.poss ? H : A}愛控球、${ch.prof.poss > ca.prof.poss ? A : H}擅長反擊，看誰先失去耐心。`
      : "戰術對決：雙方控球習慣接近，中場搶二點會決定節奏。");
  }
  if (sh.stars[0] && sa.stars[0]) points.push(`關鍵對位：${H}的 ${sh.stars[0].name} 對上 ${A}的 ${sa.stars[0].name}，誰先開火誰就帶動全隊。`);
  if (fh && fa) {
    const desc = (n, f) => `${n}近 ${f.n} 場 ${f.w} 勝 ${f.d} 和 ${f.l} 負（${f.mood}）`;
    const hot = fh.w >= 3 && fh.w > fa.w ? H : fa.w >= 3 && fa.w > fh.w ? A : null;
    points.push(`氣勢：${desc(H, fh)}；${desc(A, fa)}${hot ? `，${hot}帶著好手感進場` : fh.l >= 3 && fa.l >= 3 ? "，兩隊都急需一場勝利" : ""}。`);
  }
  const outs = [...sh.out.map((x) => `${H} ${x.name}`), ...sa.out.map((x) => `${A} ${x.name}`)];
  if (outs.length) points.push(`缺陣影響：${outs.slice(0, 3).join("、")}，輪換深度會被考驗。`);
  if (ch.name && ca.name) points.push(`場邊鬥智：${ch.name} 對 ${ca.name}${ch.tenure && ca.tenure ? `（任內勝率 ${pct(ch.tenure.w / ch.tenure.n)} vs ${pct(ca.tenure.w / ca.tenure.n)}）` : ""}。`);
  if (ven?.weather) {
    const imp = weatherImpact(ven.weather)[0];
    if (!/正常/.test(imp)) points.push(`天氣變數：${imp}`);
  }
  const st = typeof storyOf === "function" ? storyOf(model) : null;
  const crossLine = st?.cross?.[0] || (typeof h2hLines === "function" ? h2hLines(model)[0] : "");
  if (crossLine) points.push(`兩隊淵源：${crossLine}`);
  if (points.length) {
    block.append(h("div", { class: "st-label" }, ui("👀 本場看點")), h("ol", { class: "st-bullets" }, points.slice(0, 5).map((x) => h("li", null, ui(x)))));
    say.push(`今天有幾個看點：${points.slice(0, 3).map((x) => x.replace(/^[^：]+：/, "")).join("")}`);
  }
  /* 萊恩預測 */
  if (pred) {
    const lean = pred.o25 >= 0.55 ? "進球偏多" : pred.o25 <= 0.42 ? "進球偏少、比較悶" : "進球數中等";
    const verdict = `${pred.scores[0].s}，${lean}${pred.btts >= 0.55 ? "，兩隊都有機會破門" : ""}`;
    block.append(h("div", { class: "st-label" }, ui("🎙️ 萊恩的預測")), h("p", { class: "lean" }, ui(verdict)));
    say.push(`我的預測是 ${verdict}。你們怎麼看？留言押比分，賽後一起對答案！`);
  }
  block.append(scriptBlock(say, "口播：整場前瞻（開場用）"));
  block.append(h("p", { class: "faint" }, ui("前瞻會隨各區資料（傷兵、教練、角球、天氣）載入自動補齊；開賽前一小時名單公布後再看一次最準。")));
  return block;
}

function previewHomeBlock(model) { return pvTeamSection(model, "home"); }
function previewAwayBlock(model) { return pvTeamSection(model, "away"); }
