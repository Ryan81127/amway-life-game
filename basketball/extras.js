/* 籃球看板補齊足球有的區塊：整場／主隊／客隊前瞻、滾球、球星、兩隊故事、教練、體育館、陣容。
   原則跟足球一樣：只用抓得到的資料，每句標明事實／計算／推測；抓不到就寫「資料不足」。 */

const bxRoster = new Map();
const bxWiki = new Map();
const bxVenue = new Map();

const POS_ZH = { G: "後衛", F: "前鋒", C: "中鋒", PG: "控球後衛", SG: "得分後衛", SF: "小前鋒", PF: "大前鋒", "G-F": "後衛／前鋒", "F-C": "前鋒／中鋒", "F-G": "前鋒／後衛", "C-F": "中鋒／前鋒" };
const BX_TAG = { 事實: "fact", 計算: "calc", 推測: "guess", 資料不足: "none" };

function bxTag(t) {
  return h("span", { class: `ca-tag ${BX_TAG[t] || ""}` }, ui(t));
}
function bxList(items) {
  return h("ul", { class: "bx-list" }, items.filter(Boolean).map(([tag, text]) => h("li", null, ui(text), " ", bxTag(tag))));
}
function bxNum(n, d = 1) {
  return Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : "–";
}
function bxQLen(m) {
  return m.league && m.league !== "nba" ? 10 : 12;
}

/* ---------- 資料：ESPN 球隊名單（含教練）、維基百科 ---------- */

async function ensureBxRoster(m) {
  if (m.league) return;
  for (const side of ["home", "away"]) {
    const id = m[side].id;
    if (bxRoster.has(id)) continue;
    bxRoster.set(id, { status: "loading" });
    fetchJson(`${API}/teams/${id}/roster`, new AbortController().signal)
      .then((j) => bxRoster.set(id, { status: "ok", coach: (j.coach || [])[0] || null, athletes: j.athletes || [] }))
      .catch(() => bxRoster.set(id, { status: "error" }))
      .finally(() => maybeRender({ soft: true }));
  }
}

async function wikiZh(enQuery, hint) {
  const key = enQuery + "|" + (hint || "");
  if (bxWiki.has(key)) return bxWiki.get(key);
  const p = (async () => {
    const s = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(enQuery + (hint ? " " + hint : ""))}`)).json();
    const title = s.query?.search?.[0]?.title;
    if (!title) return null;
    const ll = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks|pageprops&lllang=zh&format=json&origin=*&titles=${encodeURIComponent(title)}`)).json();
    const page = Object.values(ll.query?.pages || {})[0] || {};
    const zhTitle = page.langlinks?.[0]?.["*"];
    let sum = null;
    if (zhTitle) {
      try { sum = await (await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(zhTitle)}`, { headers: { "Accept-Language": "zh-tw" } })).json(); } catch { sum = null; }
    }
    const en = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)).json().catch(() => null);
    return { title, zh: sum?.extract ? han(sum.extract) : "", zhUrl: zhTitle ? `https://zh.wikipedia.org/wiki/${encodeURIComponent(zhTitle)}` : "", en: en?.extract || "", enUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, img: en?.thumbnail?.source || "" };
  })().catch(() => null);
  bxWiki.set(key, p);
  return p;
}

function useWiki(key, q, hint) {
  const k = "v:" + key;
  if (!bxWiki.has(k)) {
    bxWiki.set(k, { status: "loading" });
    wikiZh(q, hint).then((r) => { bxWiki.set(k, { status: r ? "ok" : "none", r }); maybeRender({ soft: true }); });
  }
  return bxWiki.get(k);
}

/* ---------- 前瞻 ---------- */

function bxSideFacts(m, side) {
  const t = m[side];
  const oppSide = side === "home" ? "away" : "home";
  const out = [];
  out.push(["事實", `${t.name} 本季戰績 ${t.record || "資料不足"}${t.split ? `，${side === "home" ? "主場" : "客場"} ${t.split}` : ""}。`]);
  if (m.wnblRank) out.push(["計算", `目前排名第 ${m.wnblRank[side]}（依已完賽比分計算）。`]);
  const avg = typeof teamAvg === "function" ? teamAvg(m, side) : null;
  if (avg) out.push(["事實", `場均得 ${bxNum(avg.pf)}、失 ${bxNum(avg.pa)}，淨勝 ${avg.net >= 0 ? "+" : ""}${bxNum(avg.net)}。`]);
  const f = typeof formOf === "function" ? formOf(m, side) : null;
  if (f) out.push(["事實", `近 ${f.n} 場 ${f.w} 勝 ${f.n - f.w} 敗，平均分差 ${f.diff >= 0 ? "+" : ""}${bxNum(f.diff)}：${f.games.map((g) => (g.result === "W" ? "勝" : "負")).join("")}。`]);
  const lead = (m.leaders?.[side] || []).filter((l) => l.name);
  if (lead.length) out.push(["事實", `數據領袖：${lead.slice(0, 3).map((l) => `${l.name} ${l.display}${l.key === "points" ? " 分" : l.key === "rebounds" ? " 籃板" : l.key === "assists" ? " 助攻" : ""}`).join("、")}。`]);
  const inj = (m.injuries?.[side] || []).filter((i) => /Out|Doubtful/i.test(i.status));
  if (inj.length) out.push(["事實", `確定或可能缺陣：${inj.map((i) => `${i.name}（${i.statusZh}）`).join("、")}。`]);
  else if (!m.league) out.push(["事實", "ESPN 傷兵名單沒有確定缺陣的球員。"]);
  const r = bxRoster.get(t.id);
  if (r?.coach) out.push(["事實", `總教練 ${r.coach.firstName} ${r.coach.lastName}，ESPN 記錄執教第 ${Number(r.coach.experience || 0) + 1} 年。`]);
  const p = state.pred && state.pred.id === m.id ? state.pred : loadPrediction(m.id);
  if (p && Number.isFinite(p.mu)) {
    const win = side === "home" ? p.pHome : 1 - p.pHome;
    out.push(["計算", `模型勝率 ${pct(win)}，預估${(side === "home" ? p.mu : -p.mu) >= 0 ? "贏" : "輸"} ${bxNum(Math.abs(p.mu))} 分。`]);
  }
  const o = typeof teamAvg === "function" ? teamAvg(m, oppSide) : null;
  if (avg && o) {
    const edge = (avg.pf - o.pa) - (o.pf - avg.pa);
    out.push(["推測", Math.abs(edge) < 3 ? "攻防數據跟對手接近，關鍵在臨場手感與失誤。" : edge > 0 ? `攻防數據比對手好約 ${bxNum(edge)} 分，打出平常水準就有優勢。` : `攻防數據落後對手約 ${bxNum(-edge)} 分，需要靠外線或防守爆發。`]);
  }
  return out;
}

function bxPreviewBlocks(m) {
  ensureBxRoster(m);
  const p = state.pred && state.pred.id === m.id ? state.pred : loadPrediction(m.id);
  const whole = [];
  whole.push(["事實", `${m.away.name}（${m.away.record || "–"}）作客 ${m.home.name}（${m.home.record || "–"}），地點 ${m.venue || "資料不足"}。`]);
  if (m.series?.summary || m.series?.total) whole.push(["事實", `本季交手：${String(m.series.summary || "").replace(/leads series/i, "系列賽領先").replace(/series tied/i, "系列賽打平") || `${m.series.total} 場`}。`]);
  if (p && Number.isFinite(p.mu)) whole.push(["計算", `模型：${p.mu >= 0 ? m.home.name : m.away.name} 贏約 ${bxNum(Math.abs(p.mu))} 分，總分約 ${bxNum(p.muT, 0)}，主隊勝率 ${pct(p.pHome)}。`]);
  if (m.odds?.details || m.odds?.spread != null) whole.push(["事實", `盤口：${m.odds.details || ""}${m.odds.total ? `，大小 ${m.odds.total}` : ""}。`]);
  else whole.push(["資料不足", "這場沒有公開盤口。"]);
  const ah = typeof teamAvg === "function" ? teamAvg(m, "home") : null;
  const aa = typeof teamAvg === "function" ? teamAvg(m, "away") : null;
  if (ah && aa) {
    const pace = (ah.pf + ah.pa + aa.pf + aa.pa) / 2;
    whole.push(["計算", `兩隊場均合計得失分約 ${bxNum(pace, 0)}，${pace >= (m.league ? 165 : 230) ? "節奏偏快，偏向大分" : pace <= (m.league ? 150 : 215) ? "節奏偏慢，偏向小分" : "節奏中等"}。`]);
  }
  whole.push(["推測", "看點：開賽前 6 分鐘誰先打出小高潮、第三節的調整，以及關鍵時刻誰拿球。"]);
  const sec = (id, title, items) => h("section", { class: "panel", id }, h("h2", null, ui(title)), bxList(items),
    h("p", { class: "faint" }, ui("事實＝來源資料；計算＝用資料算出；推測＝依數據的看法，不是保證。")));
  return [
    sec("preview", "整場前瞻", whole),
    sec("preview-home", `主隊前瞻：${m.home.name}`, bxSideFacts(m, "home")),
    sec("preview-away", `客隊前瞻：${m.away.name}`, bxSideFacts(m, "away"))
  ];
}

/* ---------- 滾球 ---------- */

function bxElapsed(m) {
  const q = bxQLen(m);
  const st = m.status;
  const per = Number(st.period || 0);
  const reg = q * 4;
  const len = per > 4 ? reg + (per - 4) * 5 : reg;
  const plen = per > 4 ? 5 : q;
  const before = per > 4 ? reg + (per - 5) * 5 : (per - 1) * q;
  let el;
  if (st.phase === "ht") el = 2 * q;
  else if (st.phase === "endq") el = before + plen;
  else if (st.phase === "ft") el = len;
  else if (per >= 1) el = before + Math.max(0, plen - (Number(st.secLeft) || 0) / 60);
  else el = 0;
  return { el: Math.min(el, len), len, reg };
}

function bxInplay(m) {
  const p = state.pred && state.pred.id === m.id ? state.pred : loadPrediction(m.id);
  const sec = h("section", { class: "panel", id: "inplay" }, h("h2", null, ui("滾球預測")));
  if (!p || !Number.isFinite(p.mu)) {
    sec.append(h("p", { class: "muted" }, ui("資料不足：這台裝置沒有這場的賽前模型，無法推算滾球。")));
    return sec;
  }
  const hs = Number(m.home.score) || 0;
  const as = Number(m.away.score) || 0;
  const { el, len, reg } = bxElapsed(m);
  if (m.status.phase === "pre" || el <= 0) {
    sec.append(bxList([
      ["計算", `開賽前基準：${p.mu >= 0 ? m.home.name : m.away.name} 贏 ${bxNum(Math.abs(p.mu))} 分、總分 ${bxNum(p.muT, 0)}、主隊勝率 ${pct(p.pHome)}。`],
      ["事實", "開賽後每次更新，會依比分與剩餘時間重新推算終場比分、勝率、讓分和大小分。"]
    ]));
    return sec;
  }
  const rem = Math.max(0, len - el);
  const fr = rem / reg;
  const w = Math.min(1, el / reg);
  const preRate = p.muT / reg;
  const curRate = (hs + as) / Math.max(el, 1);
  const projT = hs + as + rem * (w * curRate + (1 - w) * preRate);
  const projM = (hs - as) + p.mu * fr;
  const sdM = SIG_MARGIN * Math.sqrt(Math.max(fr, 0.0001));
  const sdT = SIG_TOTAL * Math.sqrt(Math.max(fr, 0.0001));
  const done = m.status.phase === "ft";
  const pH = done ? (hs > as ? 1 : 0) : ncdf(projM / sdM);
  const projH = (projT + projM) / 2;
  const projA = (projT - projM) / 2;
  const rows = [
    ["事實", `目前 ${m.away.name} ${as} : ${hs} ${m.home.name}，已打 ${bxNum(el)} 分鐘，剩 ${bxNum(rem)} 分鐘。`],
    ["計算", `預估終場 ${m.away.name} ${Math.round(projA)} : ${Math.round(projH)} ${m.home.name}，總分約 ${Math.round(projT)}。`],
    ["計算", `主隊勝率 ${pct(pH)}（賽前 ${pct(p.pHome)}）。`]
  ];
  if (Number.isFinite(p.line)) {
    const c = done ? (hs - as + p.line > 0 ? 1 : 0) : ncdf((projM + p.line) / sdM);
    rows.push(["計算", `賽前讓分 ${m.home.name} ${p.line > 0 ? "+" : ""}${p.line}：主隊過盤機率 ${pct(c)}。`]);
  }
  if (Number.isFinite(p.total)) {
    const o = done ? (hs + as > p.total ? 1 : 0) : 1 - ncdf((p.total - projT) / sdT);
    rows.push(["計算", `賽前大小 ${p.total}：開大機率 ${pct(o)}。`]);
  }
  rows.push(["推測", Math.abs(curRate * reg - p.muT) > 12 ? `目前節奏${curRate * reg > p.muT ? "比賽前預期快" : "比賽前預期慢"}，換算全場約 ${Math.round(curRate * reg)} 分。` : "目前節奏跟賽前預期差不多。"]);
  sec.append(bxList(rows), h("p", { class: "faint" }, ui("方法：剩餘時間的分差照賽前模型比例分配，節奏依已打時間逐步加重現場數據。沒有即時盤口可比較，只供參考。")));
  return sec;
}

/* ---------- 球星 ---------- */

function bxStars(m) {
  ensureBxRoster(m);
  const sec = h("section", { class: "panel", id: "stars" }, h("h2", null, ui("球星")));
  let any = false;
  for (const side of ["away", "home"]) {
    let list = (m.leaders?.[side] || []).filter((l) => l.name);
    if (!list.length && (m.box?.players?.[side] || []).length) {
      list = [...m.box.players[side]].filter((p) => !p.dnp).sort((a, b) => b.pts - a.pts).slice(0, 3).map((p) => ({ name: p.name, en: p.en, display: `${p.pts} 分 ${p.reb} 籃板 ${p.ast} 助攻`, key: "" }));
    }
    if (!list.length) continue;
    any = true;
    const r = bxRoster.get(m[side].id);
    const seen = new Set();
    const cards = [];
    for (const l of list) {
      if (seen.has(l.en || l.name)) continue;
      seen.add(l.en || l.name);
      const a = (r?.athletes || []).find((x) => x.displayName === l.en);
      const stats = list.filter((x) => (x.en || x.name) === (l.en || l.name)).map((x) => `${x.display}${x.key === "points" ? " 分" : x.key === "rebounds" ? " 籃板" : x.key === "assists" ? " 助攻" : ""}`).join("、");
      cards.push(h("div", { class: "bx-star" },
        a?.headshot?.href ? h("img", { src: a.headshot.href, alt: "", loading: "lazy" }) : null,
        h("div", null,
          h("b", null, ui(l.name)), a?.jersey ? h("span", { class: "faint" }, ` #${a.jersey}`) : null,
          h("div", { class: "faint" }, ui([a?.position?.abbreviation ? POS_ZH[a.position.abbreviation] || a.position.abbreviation : "", a?.displayHeight || "", a?.age ? `${a.age} 歲` : "", a?.experience?.years != null ? `NBA 第 ${a.experience.years + 1} 年` : ""].filter(Boolean).join("｜"))),
          h("div", null, ui(stats)))));
    }
    sec.append(h("h3", null, ui(m[side].name)), ...cards);
  }
  if (!any) sec.append(h("p", { class: "muted" }, ui("資料不足：這個聯賽的來源沒有球員數據領袖。")));
  sec.append(h("p", { class: "faint" }, ui(m.status.phase === "pre" ? "賽前顯示本季數據領袖（ESPN）。" : "顯示本場數據領袖。")));
  return sec;
}

/* ---------- 兩隊故事 ---------- */

function bxStory(m) {
  const sec = h("section", { class: "panel", id: "history" }, h("h2", null, ui("兩隊故事")));
  const items = [];
  if (m.series?.games?.length) {
    const w = m.series.games.filter((g) => g.mine > g.opp).length;
    items.push(["事實", `本季已交手 ${m.series.games.length} 場：${m.home.name} ${w} 勝 ${m.series.games.length - w} 敗。`]);
    for (const g of m.series.games) items.push(["事實", `${shortDate(g.date)} ${m.home.name} ${g.mine} : ${g.opp} ${m.away.name}`]);
  } else items.push(["資料不足", "本季還沒交手，或來源沒有交手紀錄。"]);
  const cards = (state.cards || []).filter((c) => /恩怨|宿敵|交手|對決|rival/i.test(`${c.title || ""}${c.fact || ""}`));
  for (const c of cards.slice(0, 3)) items.push(["事實", `${c.title || ""}：${c.fact || c.say || ""}`]);
  sec.append(bxList(items));
  const req = `幫 ${m.away.name} 對 ${m.home.name}（${typeof leaguePill === "function" ? leaguePill() : "NBA"}，${shortDate(m.date || m.kickoff)}）做籃球故事卡：兩隊歷史交手、恩怨與名場面、球星對位、教練背景。`;
  const btn = h("button", { class: "copy" }, ui("📋 複製故事卡請求"));
  btn.addEventListener("click", () => copyText(req, btn));
  sec.append(h("p", { class: "faint" }, ui("更早的交手、恩怨和名場面需要查證：按下面按鈕複製請求，貼到對話給 Claude，查好會寫進這場的知識卡。")), btn);
  return sec;
}

/* ---------- 教練 ---------- */

function bxCoaches(m) {
  ensureBxRoster(m);
  const sec = h("section", { class: "panel", id: "coaches" }, h("h2", null, ui("兩隊教練")));
  if (m.league) {
    sec.append(h("p", { class: "muted" }, ui("資料不足：這個聯賽的來源沒有教練資料。可以用「兩隊故事」的按鈕請 Claude 查證後補上。")));
    return sec;
  }
  for (const side of ["away", "home"]) {
    const r = bxRoster.get(m[side].id);
    const box = h("div", { class: "coach-card" }, h("h3", null, ui(m[side].name)));
    if (!r || r.status === "loading") box.append(h("p", { class: "faint" }, ui("讀取中…")));
    else if (!r.coach) box.append(h("p", { class: "muted" }, ui("資料不足：ESPN 沒有列出總教練。")));
    else {
      const name = `${r.coach.firstName} ${r.coach.lastName}`;
      const w = useWiki("coach:" + name, name, "basketball coach");
      box.append(bxList([
        ["事實", `總教練 ${name}，ESPN 記錄執教本隊第 ${Number(r.coach.experience || 0) + 1} 年。`],
        ["事實", `本季戰績 ${m[side].record || "–"}。`]
      ]));
      if (w?.status === "ok" && (w.r.zh || w.r.en)) {
        box.append(h("p", null, ui(w.r.zh ? w.r.zh.slice(0, 220) : w.r.en.slice(0, 260))), h("a", { href: w.r.zhUrl || w.r.enUrl, target: "_blank", rel: "noopener", class: "faint" }, ui(w.r.zh ? "維基百科（中文）" : "Wikipedia（英文，沒有中文條目）")));
      } else if (w?.status === "loading") box.append(h("p", { class: "faint" }, ui("查詢維基百科…")));
    }
    sec.append(box);
  }
  return sec;
}

/* ---------- 體育館 ---------- */

async function bxWeather(city, iso) {
  const name = String(city || "").split(",")[0].trim();
  if (!name) return null;
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=${encodeURIComponent(name)}`)).json();
  const loc = g.results?.[0];
  if (!loc) return null;
  const day = String(iso).slice(0, 10);
  const wj = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=temperature_2m,precipitation_probability&timezone=UTC&start_date=${day}&end_date=${day}`)).json();
  const hr = new Date(iso).getUTCHours();
  return { place: loc.name, country: loc.country, temp: wj.hourly?.temperature_2m?.[hr], rain: wj.hourly?.precipitation_probability?.[hr] };
}

function bxVenueBlock(m) {
  const sec = h("section", { class: "panel", id: "venue" }, h("h2", null, ui("體育館")));
  if (!m.venue) { sec.append(h("p", { class: "muted" }, ui("資料不足：來源沒有球館名稱。"))); return sec; }
  const items = [["事實", `比賽地點：${m.venue}${m.city ? `（${m.city}）` : ""}。`]];
  if (m.attendance) items.push(["事實", `本場觀眾 ${Number(m.attendance).toLocaleString()} 人。`]);
  if (m.home.split) items.push(["事實", `${m.home.name} 本季主場 ${m.home.split}。`]);
  sec.append(bxList(items));
  const w = useWiki("venue:" + m.venue, m.venue, "arena");
  if (w?.status === "ok" && (w.r.zh || w.r.en)) {
    sec.append(w.r.img ? h("img", { class: "bx-venue-img", src: w.r.img, alt: "", loading: "lazy" }) : null,
      h("p", null, ui(w.r.zh ? w.r.zh.slice(0, 260) : w.r.en.slice(0, 300))),
      h("a", { href: w.r.zhUrl || w.r.enUrl, target: "_blank", rel: "noopener", class: "faint" }, ui(w.r.zh ? "維基百科（中文）" : "Wikipedia（英文，沒有中文條目）")));
  } else if (w?.status === "loading") sec.append(h("p", { class: "faint" }, ui("查詢球館資料…")));
  const city = m.city || "";
  if (city && m.status.phase === "pre") {
    if (!bxVenue.has(m.id)) {
      bxVenue.set(m.id, { status: "loading" });
      bxWeather(city, m.date || m.kickoff).then((r) => bxVenue.set(m.id, { status: r ? "ok" : "none", r })).catch(() => bxVenue.set(m.id, { status: "none" })).finally(() => maybeRender({ soft: true }));
    }
    const v = bxVenue.get(m.id);
    if (v?.status === "ok" && Number.isFinite(v.r.temp)) sec.append(bxList([["事實", `開賽時 ${v.r.place} 氣溫約 ${Math.round(v.r.temp)}°C、降雨機率 ${v.r.rain ?? "–"}%（Open-Meteo 預報）。室內球館，天氣只影響球迷進場與交通。`]]));
  }
  return sec;
}

/* ---------- 陣容 ---------- */

function bxLineups(m) {
  if (m.league) return null;
  ensureBxRoster(m);
  const sec = h("section", { class: "panel", id: "lineups" }, h("h2", null, ui("陣容")));
  for (const side of ["away", "home"]) {
    const r = bxRoster.get(m[side].id);
    sec.append(h("h3", null, ui(m[side].name)));
    if (!r || r.status === "loading") { sec.append(h("p", { class: "faint" }, ui("讀取中…"))); continue; }
    if (!r.athletes?.length) { sec.append(h("p", { class: "muted" }, ui("資料不足"))); continue; }
    const out = new Set((m.injuries?.[side] || []).filter((i) => /Out/i.test(i.status)).map((i) => i.en));
    sec.append(predTable(["#", "球員", "位置", "身高", "年齡"], r.athletes.map((a) => ({
      cls: out.has(a.displayName) ? "neg" : "",
      cells: [a.jersey || "–", (typeof playerZh === "function" ? playerZh(a.displayName) : a.displayName) + (out.has(a.displayName) ? "（缺陣）" : ""), POS_ZH[a.position?.abbreviation] || a.position?.abbreviation || "–", a.displayHeight || "–", a.age ? String(a.age) : "–"]
    }))));
  }
  sec.append(h("p", { class: "faint" }, ui("ESPN 球隊名單；先發要等開賽前才確定，請以官方公布為準。")));
  return sec;
}

/* ---------- 傷兵（沒有資料時也顯示，避免以為漏了） ---------- */

function bxInjEmpty(m) {
  const sec = h("section", { class: "panel", id: "inj" }, h("h2", null, ui("傷兵名單")));
  if (m.league === "wnbl") sec.append(h("p", { class: "muted" }, ui("資料不足：WNBL 快照沒有傷兵資料。")), h("a", { href: "https://www.basketball.com.au/news/wnbl-injury-report", target: "_blank", rel: "noopener" }, ui("WNBL 傷兵報告（basketball.com.au）")));
  else sec.append(h("p", { class: "muted" }, ui(m.league ? "資料不足：這個聯賽的來源沒有傷兵資料。" : "ESPN 傷兵名單目前沒有任何球員。")));
  return sec;
}
