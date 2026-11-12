/* NBA 轉播看板：賽程、比賽頁、即時偵測。 */
let pending = false;

function maybeRender(options) {
  const soft = !!options?.soft;
  const sel = document.getSelection?.();
  const app = document.getElementById("app");
  const selecting = sel && !sel.isCollapsed && app && app.contains(sel.anchorNode);
  if (soft && selecting) {
    pending = true;
    return;
  }
  pending = false;
  const y = soft ? window.scrollY : 0;
  const openDetails = [...document.querySelectorAll("details[data-k][open]")].map((d) => d.dataset.k);
  render();
  for (const k of openDetails) document.querySelector(`details[data-k="${k}"]`)?.setAttribute("open", "");
  window.scrollTo(0, y);
}

function render() {
  const route = readRoute();
  if (!route.event) {
    state.day = route.day || "";
    state.tab = ["live", "pre", "post"].includes(route.tab) ? route.tab : "all";
  }
  const app = document.getElementById("app");
  app.replaceChildren();
  try {
    if (route.event) renderMatch(app, route);
    else renderSchedule(app);
  } catch (err) {
    console.error(err);
    app.append(h("div", { class: "wrap" }, errorBox(() => location.reload())), footer());
  }
  const strip = document.querySelector(".datestrip");
  const btn = strip?.querySelector('[aria-pressed="true"]');
  if (strip && btn) strip.scrollLeft = btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2;
  showFlash();
}

function headerBar(title, sub, actions, extra) {
  return h("header", { class: extra ? "top compact" : "top" },
    h("div", { class: "top-row" },
      h("div", { class: "brand" }, h("h1", null, ui(title)), sub ? h("p", { class: "sub", id: "updated" }, ui(sub)) : null),
      h("div", { class: "top-actions" }, actions)
    ),
    extra || langToggle()
  );
}

function sportSwitch() {
  return h("nav", { class: "sport-switch" },
    h("a", { href: "../football/" }, "⚽ ", ui("足球")),
    h("a", { href: "./", "aria-current": "page" }, "🏀 NBA")
  );
}

/* ---------- 賽程 ---------- */

function bucketOf(m) {
  return m.state === "in" ? "live" : m.state === "pre" ? "pre" : "post";
}

function dayMatches(day, today) {
  return state.matches.filter((m) => taipeiYmd(m.date) === day || (day === today && m.state === "in"));
}

function setScheduleParams(next) {
  const url = new URL(location.href);
  url.search = "";
  const day = next.day ?? state.day;
  const tab = next.tab ?? state.tab;
  if (day && day !== taipeiYmd(new Date())) url.searchParams.set("day", day);
  if (tab && tab !== "all") url.searchParams.set("tab", tab);
  history.replaceState({}, "", url);
  maybeRender({ soft: false });
}

function dateStrip(bounds, day) {
  const strip = h("div", { class: "datestrip", role: "tablist", "aria-label": "選擇日期" });
  for (const ymd of eachYmd(bounds.start, bounds.end)) {
    const meta = ymdMeta(ymd);
    const list = dayMatches(ymd, bounds.today);
    const live = list.some((m) => m.state === "in");
    let rel = meta.wd;
    if (ymd === bounds.today) rel = "今天";
    else if (ymd === addDays(bounds.today, 1)) rel = "明天";
    else if (ymd === addDays(bounds.today, -1)) rel = "昨天";
    strip.append(h("button", {
      class: ymd === bounds.today ? "day-btn today" : "day-btn",
      role: "tab",
      "aria-pressed": String(ymd === day),
      onclick: () => setScheduleParams({ day: ymd, tab: "all" })
    },
    h("span", { class: "d-rel" }, ui(rel)),
    h("span", { class: "d-num" }, `${meta.m}/${meta.d}`),
    h("span", { class: "d-cnt" }, live ? [h("span", { class: "live-dot" }), String(list.length)] : (list.length ? `${list.length} 場` : "–"))));
  }
  return strip;
}

function statusTabs(groups) {
  const tabs = [
    ["all", "全部", groups.live.length + groups.pre.length + groups.post.length],
    ["live", "進行中", groups.live.length],
    ["pre", "未開賽", groups.pre.length],
    ["post", "已完賽", groups.post.length]
  ];
  return h("div", { class: "status-tabs", role: "toolbar" }, tabs.map(([id, label, n]) => h("button", {
    class: `stab ${id}`,
    "aria-pressed": String(state.tab === id),
    onclick: () => { setScheduleParams({ tab: id }); window.scrollTo(0, 0); }
  }, id === "live" && n ? h("span", { class: "live-dot" }) : null, ui(label), h("b", null, String(n)))));
}

function renderSchedule(app) {
  const bounds = windowBounds();
  const day = state.day && state.day >= bounds.start && state.day <= bounds.end ? state.day : bounds.today;
  state.day = day;
  const list = dayMatches(day, bounds.today);
  const byTime = (a, b) => new Date(a.date) - new Date(b.date);
  const groups = {
    live: list.filter((m) => bucketOf(m) === "live").sort(byTime),
    pre: list.filter((m) => bucketOf(m) === "pre").sort(byTime),
    post: list.filter((m) => bucketOf(m) === "post").sort(byTime)
  };
  const sub = state.scheduleLoadedAt ? `更新於 ${taipeiClock(new Date(state.scheduleLoadedAt))}` : "台北時間";
  const refresh = h("button", { class: "icon-btn", onclick: () => manualRefresh() }, ui("重新整理"));
  app.append(headerBar("NBA 轉播看板", sub, [refresh], [dateStrip(bounds, day), statusTabs(groups)]));
  const wrap = h("div", { class: "wrap" });
  wrap.append(sportSwitch());
  if (!state.scheduleReady && !state.matches.length) {
    wrap.append(h("p", { class: "muted", id: "progress" }, ui("載入賽程中…")));
    app.append(wrap, footer());
    return;
  }
  if (state.scheduleError && !state.matches.length) {
    wrap.append(errorBox(() => loadSchedule("full")));
    app.append(wrap, footer());
    return;
  }
  wrap.append(h("div", { class: "day-h" }, dayTitle(day, bounds.today), h("span", { class: "faint" }, ui(" · 台北時間 · 比賽中每 5 秒偵測比分"))));
  const sections = [["live", "進行中", "目前沒有進行中的比賽"], ["pre", "未開賽", "這天沒有還沒開始的比賽"], ["post", "已完賽", "這天還沒有完賽的比賽"]]
    .filter(([id]) => state.tab === "all" || state.tab === id);
  let shown = 0;
  for (const [id, title, empty] of sections) {
    const items = groups[id];
    if (state.tab === "all" && !items.length) continue;
    wrap.append(h("div", { class: "section-h" },
      h("h2", null, id === "live" && items.length ? [h("span", { class: "live-dot" }), " ", ui(title)] : ui(title)),
      h("span", { class: "faint" }, items.length ? `${items.length} 場` : ui(empty))));
    items.forEach((m) => wrap.append(matchCard(m)));
    shown += items.length;
  }
  if (!shown) {
    const next = eachYmd(addDays(day, 1), bounds.end).find((ymd) => dayMatches(ymd, bounds.today).length);
    wrap.append(h("div", { class: "empty" }, ui(state.tab === "all" ? "這天沒有 NBA 比賽" : "這個分類沒有比賽"),
      next ? h("button", { class: "retry", onclick: () => setScheduleParams({ day: next, tab: "all" }) }, ui(`看 ${dayTitle(next, bounds.today)}`)) : null));
  }
  if (state.news?.length) wrap.append(leagueNews());
  wrap.append(linksBlock());
  wrap.append(langToggle());
  app.append(wrap, footer());
  app.dataset.view = "schedule";
  app.dataset.ready = state.scheduleReady ? "1" : "0";
  document.title = ui("NBA 轉播看板");
}

function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "即將開賽";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} 分鐘後開賽`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} 小時 ${mins % 60} 分後開賽`;
  return "";
}

function matchCard(m) {
  const live = m.state === "in";
  const pre = m.state === "pre";
  const card = h("a", { class: live ? "match-card live" : pre ? "match-card pre" : "match-card post", href: `?event=${m.id}` });
  card.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openMatch(m.id);
  });
  card.append(
    h("div", { class: "card-top" },
      h("span", { class: "pill" }, "NBA"),
      h("span", null, `${taipeiYmd(m.date) !== state.day ? shortDate(m.date) + " " : ""}${taipeiHM(m.date)} 台北`),
      h("span", { class: "pill" }, live ? [h("span", { class: "live-dot" }), ui(m.clock)] : ui(m.clock))
    ),
    teamLine(m.away, pre, "客"),
    teamLine(m.home, pre, "主")
  );
  if (m.odds?.details || m.odds?.total) card.append(h("p", { class: "odds-mini" }, ui(`盤口 ${m.odds.details || ""}${m.odds.total ? ` · 大小 ${m.odds.total}` : ""}`)));
  const cd = pre ? countdown(m.date) : "";
  card.append(h("p", { class: "card-foot" }, cd ? h("span", { class: "faint" }, ui(cd)) : null,
    h("span", { class: "go" }, ui(pre ? "看盤口預測 →" : live ? "看即時覆盤 →" : "看全場覆盤 →"))));
  return card;
}

function teamLine(t, pre, tag) {
  return h("div", { class: "team-row" },
    h("div", { class: "team-id" }, logoNode(t.logo, t.abbr), h("strong", null, ui(t.name)), h("span", { class: "faint" }, ` ${tag}${t.record ? " · " + t.record : ""}`)),
    h("span", { class: "score-side" }, pre ? "–" : (t.score ?? "–")));
}

function leagueNews() {
  return h("section", { class: "panel" },
    h("h2", null, ui("NBA 最新消息（ESPN，英文原文）")),
    h("ul", { class: "news" }, state.news.slice(0, 8).map((a) => h("li", null,
      h("a", { href: a.url, target: "_blank", rel: "noopener" }, a.title),
      h("span", { class: "faint" }, a.at ? ` · ${shortDate(a.at)} ${taipeiHM(a.at)}` : "")))));
}

function linksBlock(model) {
  const q = model ? `${model.away.rawName} vs ${model.home.rawName}` : "NBA";
  const g = (site, extra) => `https://www.google.com/search?q=${encodeURIComponent(`${q} ${extra || ""} site:${site}`)}`;
  const items = [
    ["NBA 官網", model ? `https://www.nba.com/search?filters=&q=${encodeURIComponent(q)}` : "https://www.nba.com/games"],
    ["ESPN", model ? `https://www.espn.com/nba/game/_/gameId/${model.id}` : "https://www.espn.com/nba/scoreboard"],
    ["Basketball Reference", g("basketball-reference.com")],
    ["傷兵（Rotowire）", "https://www.rotowire.com/basketball/nba-lineups.php"],
    ["Covers 盤口", g("covers.com", "odds")],
    ["Action Network", g("actionnetwork.com", "odds")],
    ["虎撲 NBA", "https://nba.hupu.com/"],
    ["Yahoo 奇摩運動", "https://tw.sports.yahoo.com/nba/"]
  ];
  return h("details", { class: "fold", "data-k": "links" }, h("summary", null, ui("外部資訊站（交叉確認先發、傷兵、盤口）")),
    h("div", { class: "link-grid" }, items.map(([n, u]) => h("a", { href: u, target: "_blank", rel: "noopener" }, ui(n)))));
}

/* ---------- 比賽頁 ---------- */

function openMatch(id) {
  history.pushState({}, "", `?event=${id}`);
  state.model = null;
  state.pred = null;
  state.cards = null;
  state.cardFilter = null;
  state.lastPulseSig = null;
  window.scrollTo(0, 0);
  render();
  loadMatch(id).finally(() => armTimer());
}

function goSchedule() {
  const url = new URL(location.href);
  url.search = "";
  if (state.day && state.day !== taipeiYmd(new Date())) url.searchParams.set("day", state.day);
  history.pushState({}, "", url);
  state.model = null;
  render();
  if (!state.matches.length) loadSchedule("full");
  armTimer();
}

function renderMatch(app, route) {
  const m = state.model;
  const back = h("button", { class: "icon-btn", onclick: goSchedule }, ui("← 賽程"));
  const refresh = h("button", { class: "icon-btn", onclick: () => manualRefresh() }, ui("重新整理"));
  const sub = state.summaryLoadedAt ? `更新於 ${taipeiClock(new Date(state.summaryLoadedAt))}` : "";
  if (!m || m.id !== route.event) {
    app.append(headerBar("NBA 轉播看板", sub, [back, refresh]));
    app.append(h("div", { class: "wrap" }, state.summaryError ? errorBox(() => loadMatch(route.event)) : h("p", { class: "muted" }, ui("載入比賽資料中…"))), footer());
    return;
  }
  document.title = ui(`${m.away.name} @ ${m.home.name}｜NBA 轉播看板`);
  app.append(headerBar(`${m.away.name} @ ${m.home.name}`, sub, [back, refresh], matchNav(m)));
  const wrap = h("div", { class: "wrap" });
  const phase = m.status.phase;
  const pre = phase === "pre";
  const live = m.status.state === "in";
  let blocks;
  if (pre) {
    ensurePrediction(m);
    blocks = [scoreboard(m), predSection(m), movementBlock(m), injuryBlock(m), formBlock(m), cardsBlock(m), newsBlock(m), linksBlock(m)];
  } else if (live) {
    blocks = [scoreboard(m), momentBlock(m), liveQuarterBlock(m), recapBlock(m), teamStatsBlock(m), boxBlock(m), playsBlock(m), cardsBlock(m), injuryBlock(m), savedPredBlock(m), linksBlock(m)];
  } else {
    blocks = [scoreboard(m), fullRecapBlock(m), recapBlock(m), teamStatsBlock(m), boxBlock(m), playsBlock(m), cardsBlock(m), savedPredBlock(m), linksBlock(m)];
  }
  wrap.append(...blocks.filter(Boolean), langToggle());
  app.append(wrap, footer());
  app.dataset.view = "match";
  app.dataset.phase = phase;
  if (!state.cards) loadMatchCards(m).then((c) => { state.cards = c; if (c.length) maybeRender({ soft: true }); });
}

function matchNav(m) {
  const pre = m.status.phase === "pre";
  const live = m.status.state === "in";
  const items = pre
    ? [["pred", "盤口預測"], ["moves", "盤口走勢"], ["inj", "傷兵"], ["form", "近況"], ["cards", "知識卡"]]
    : live
      ? [["moments", "即時話術"], ["recap", "節次覆盤"], ["tstats", "數據"], ["box", "球員"], ["plays", "逐球"], ["cards", "知識卡"]]
      : [["full", "全場覆盤"], ["recap", "節次覆盤"], ["tstats", "數據"], ["box", "球員"], ["cards", "知識卡"]];
  return h("nav", { class: "chips matchnav" }, items.map(([id, label]) => h("a", { class: "chip", href: `#${id}` }, ui(label))), langToggle());
}

function scoreboard(m) {
  const pre = m.status.phase === "pre";
  const live = m.status.state === "in";
  const board = h("section", { class: "board", id: "board" });
  board.append(h("p", { class: "faint" }, [m.venue, m.city, m.attendance ? `觀眾 ${m.attendance.toLocaleString()}` : ""].filter(Boolean).join(" · ")));
  const center = h("div", { class: "scoreline" });
  if (pre) {
    center.append(h("div", { class: "clock" }, taipeiHM(m.kickoff)), h("div", { class: "faint" }, `${shortDate(m.kickoff)} ${ui("台北 · 未開賽")}`), h("div", { class: "faint" }, ui(countdown(m.kickoff))));
  } else {
    center.append(
      h("div", { class: "nums" }, m.away.score, h("span", null, "-"), m.home.score),
      h("div", { class: live ? "clock live" : "clock", id: "live-clock" }, ui(m.status.label))
    );
  }
  board.append(h("div", { class: "board-grid" }, teamCol(m.away, "客"), center, teamCol(m.home, "主")));
  const qs = quarterList(m);
  if (!pre && qs.length) {
    board.append(predTable(["", ...qs.map((q) => q <= 4 ? `Q${q}` : `OT${q - 4}`), "總分"], ["away", "home"].map((side) => ({
      cells: [m[side].name, ...qs.map((q) => m[side].linescores[q - 1] ?? "–"), { node: String(m[side].score), cls: "best" }]
    }))));
  }
  if (live) board.append(h("p", { class: "fresh", id: "fresh" }, ui(freshText())));
  return board;
}

function teamCol(t, tag) {
  const col = h("div", { class: "side" });
  const color = safeColor(t.color);
  if (color) col.style.borderTop = `3px solid ${color}`;
  col.append(h("span", { class: "tag" }, ui(tag)), logoNode(t.logo, t.abbr), h("div", { class: "name" }, ui(t.name)), h("div", { class: "faint" }, [t.record, t.split ? `${tag === "主" ? "主場" : "客場"} ${t.split}` : ""].filter(Boolean).join(" · ")));
  return col;
}

/* ---------- 賽前 ---------- */

function ensurePrediction(m) {
  if (state.pred && state.pred.id === m.id) return;
  state.pred = buildPrediction(m);
  if (state.pred) savePrediction(m, state.pred);
}

function predSection(m) {
  const p = state.pred;
  const sec = h("section", { class: "panel", id: "pred" }, h("h2", null, ui("盤口預測")));
  if (!p) {
    sec.append(h("p", { class: "muted" }, ui("ESPN 還沒開出盤口、也沒有足夠的本季數據，暫時無法預測。開賽前 1–2 天通常會出現。")));
    return sec;
  }
  const H = m.home.name;
  const A = m.away.name;
  const fav = p.mu >= 0 ? H : A;
  sec.append(h("div", { class: "pred-head" },
    h("div", null, h("b", null, ui("預估比分")), h("span", { class: "big" }, `${A} ${Math.round(p.awayPts)} : ${Math.round(p.homePts)} ${H}`)),
    h("div", null, h("b", null, ui("模型分差")), h("span", { class: "big" }, ui(`${fav} 贏 ${trimNum(Math.abs(p.mu))}`))),
    h("div", null, h("b", null, ui("模型總分")), h("span", { class: "big" }, trimNum(p.muT))),
    h("div", null, h("b", null, ui(`${H} 勝率`)), h("span", { class: "big" }, pct(p.pHome)))
  ));
  if (p.value.length) {
    sec.append(h("h3", null, ui("對買方有利的選項（期望值為正）")));
    sec.append(h("ul", { class: "value-list" }, p.value.slice(0, 5).map((v) => h("li", { class: v.wild ? "wild" : "" },
      h("b", null, ui(`${v.group}｜${v.label} @${fmtOdd(v.dec)}`)),
      ui(` 模型機率 ${pct(v.p)}、公平賠率 ${fmtOdd(1 / v.p)}、期望值 ${evText(v.ev)}`),
      v.wild ? h("div", { class: "warn" }, ui("優勢超過 10%，通常代表模型漏掉了某些消息（傷兵、輪休），請先查最新先發名單。")) : null,
      v.warn ? h("div", { class: "warn" }, ui(v.warn)) : null))));
  } else {
    sec.append(h("p", { class: "muted" }, ui("目前主要盤口都沒有超過 2% 的優勢，盤口開得很準；想下注建議等先發名單出爐再看。")));
  }
  sec.append(h("h3", null, ui("預測依據")), h("ul", { class: "reasons" }, p.reasons.map((r) => h("li", null, ui(r)))));
  const groups = [...new Set(p.picks.map((x) => x.group))];
  for (const g of groups) {
    const rows = p.picks.filter((x) => x.group === g);
    sec.append(h("details", { class: "fold", "data-k": "pg-" + g, open: ["獨贏", "讓分", "大小分"].includes(g) }, h("summary", null, ui(g)),
      predTable(["選項", "模型機率", "公平賠率", "盤口賠率", "期望值"], rows.map((r) => ({
        cls: r.ev != null && r.ev >= EDGE_MIN ? "best" : "",
        cells: [r.label, pct(r.p), r.p > 0 ? fmtOdd(1 / r.p) : "–", r.dec ? fmtOdd(r.dec) : "無盤", evCell(r.ev)]
      })))));
  }
  if (p.props.length) {
    sec.append(h("details", { class: "fold", "data-k": "props" }, h("summary", null, ui("球員得分預估")),
      predTable(["球員", "本季場均", "今晚預估", "參考線"], p.props.map((x) => ({ cells: [`${m[x.side].name} ${x.name}`, trimNum(x.avg), x.out ? "缺陣" : trimNum(x.proj), x.out ? "–" : `${trimNum(x.line)}`] }))),
      h("p", { class: "faint" }, ui("依本季場均、今晚預估節奏（總分）調整；沒有球員盤口賠率，只提供參考線。"))));
  }
  sec.append(h("p", { class: "faint" }, ui(`模型：分差 = 市場 60% + 本季／近況數據 25% + ESPN BPI 15%（標準差 ${SIG_MARGIN} 分）；總分 = 市場 70% + 數據 30%（標準差 ${SIG_TOTAL} 分）。僅供參考，不構成投注建議。`)));
  const lines = [
    `今晚 ${A} 作客 ${H}，盤口 ${H} ${fmtHandicap(p.line)}、大小分 ${trimNum(p.total)}。`,
    `我的模型看 ${fav} 贏 ${trimNum(Math.abs(p.mu))} 分左右，總分落在 ${Math.round(p.muT)} 附近。`,
    p.value[0] ? `如果要找價值，${p.value[0].label} 是模型覺得市場低估的選項。` : "盤口開得很準，今晚看球比看盤有趣。",
    "你們押哪一邊？留言說，賽後我們一起對答案！"
  ];
  sec.append(scriptBlock(lines, "賽前口播"));
  return sec;
}

function movementBlock(m) {
  const moves = state.pred?.moves || oddsMovement(m);
  const rec = loadOdds(m.id);
  const sec = h("section", { class: "panel", id: "moves" }, h("h2", null, ui("盤口走勢")));
  const b = m.odds;
  if (!b) { sec.append(h("p", { class: "muted" }, ui("尚未開盤。"))); return sec; }
  sec.append(predTable(["盤口", "開盤", "現在", "賠率"], [
    { cells: [`${m.home.name} 讓分`, fmtHandicap(b.spread.home.open?.line ?? rec?.first?.spread), fmtHandicap(b.spread.home.pre?.line), `${fmtOdd(b.spread.home.pre?.decimal)} / ${fmtOdd(b.spread.away.pre?.decimal)}`] },
    { cells: ["大小分", trimNum(b.total.over.open?.line ?? rec?.first?.total ?? "–"), trimNum(b.total.over.pre?.line ?? "–"), `${fmtOdd(b.total.over.pre?.decimal)} / ${fmtOdd(b.total.under.pre?.decimal)}`] },
    { cells: ["獨贏（主／客）", rec?.first ? `${fmtOdd(rec.first.mlH)} / ${fmtOdd(rec.first.mlA)}` : "–", `${fmtOdd(b.moneyline.home.pre?.decimal)} / ${fmtOdd(b.moneyline.away.pre?.decimal)}`, m.oddsProvider || ""] }
  ]));
  if (moves.length) sec.append(h("ul", { class: "reasons" }, moves.map((x) => h("li", null, h("b", null, ui(x.text)), " ", ui(x.why)))));
  else sec.append(h("p", { class: "faint" }, ui("目前沒有明顯變動。「開盤」若沒有官方資料，是這台裝置第一次看到的盤口。")));
  return sec;
}

function injuryBlock(m) {
  const any = m.injuries.home.length || m.injuries.away.length;
  if (!any) return null;
  return h("section", { class: "panel", id: "inj" }, h("h2", null, ui("傷兵名單（ESPN 即時）")),
    ...["away", "home"].map((side) => m.injuries[side].length ? h("div", null,
      h("h3", null, ui(m[side].name)),
      predTable(["球員", "狀態", "部位", "預計回歸"], m.injuries[side].map((i) => ({ cls: /Out/i.test(i.status) ? "neg" : "", cells: [i.name, i.statusZh, i.part || "–", i.ret ? i.ret.slice(5).replace("-", "/") : "–"] })))) : null));
}

function formBlock(m) {
  const blocks = ["away", "home"].map((side) => {
    const f = formOf(m, side);
    if (!f) return null;
    return h("div", null, h("h3", null, ui(`${m[side].name} 近 ${f.n} 場`)),
      h("div", { class: "form-row" }, f.games.map((g) => h("span", { class: `form-pill ${g.result === "W" ? "w" : "l"}`, title: `${shortDate(g.date)} ${g.home ? "vs" : "@"} ${g.opp} ${g.pf}-${g.pa}` }, ui(g.result === "W" ? "勝" : "負")))),
      h("p", { class: "faint" }, f.games.map((g) => `${shortDate(g.date)} ${g.home ? "主" : "客"} ${g.opp} ${g.pf}-${g.pa}`).join("｜")));
  }).filter(Boolean);
  const season = ["away", "home"].map((side) => teamAvg(m, side) ? { side, a: teamAvg(m, side) } : null).filter(Boolean);
  if (!blocks.length && !season.length) return null;
  const sec = h("section", { class: "panel", id: "form" }, h("h2", null, ui("近況與本季數據")), ...blocks);
  if (season.length === 2) {
    const s = (side, k) => m.season[side][k] ?? "–";
    sec.append(predTable(["項目", m.away.name, m.home.name], [
      ["場均得分", "avgPoints"], ["場均失分", "avgPointsAgainst"], ["投籃%", "fieldGoalPct"], ["三分%", "threePointFieldGoalPct"],
      ["場均籃板", "avgRebounds"], ["場均助攻", "avgAssists"], ["場均失誤", "avgTotalTurnovers"], ["近十場", "Last Ten Games"], ["連勝／敗", "streak"]
    ].map(([l, k]) => ({ cells: [l, String(s("away", k)), String(s("home", k))] }))));
  }
  if (m.series?.summary) sec.append(h("p", null, ui(`本季交手：${m.series.summary.replace(/leads series/i, "系列賽領先").replace(/series tied/i, "系列賽打平")}`)));
  return sec;
}

function newsBlock(m) {
  if (!m.news.length) return null;
  return h("section", { class: "panel" }, h("h2", null, ui("賽前新聞（ESPN，英文原文）")),
    h("ul", { class: "news" }, m.news.map((a) => h("li", null, h("a", { href: a.url, target: "_blank", rel: "noopener" }, a.title), a.at ? h("span", { class: "faint" }, ` · ${shortDate(a.at)}`) : null))));
}

/* ---------- 比賽中／賽後 ---------- */

function momentBlock(m) {
  const ms = detectMoments(m);
  const sec = h("section", { class: "panel moment", id: "moments" }, h("h2", null, ui("即時話術（即時賽況 → 情緒反應 → 幽默比喻 → 觀眾互動）")));
  if (!ms.length) { sec.append(h("p", { class: "muted" }, ui("還在累積事件，等等就有。"))); return sec; }
  for (const x of ms) {
    const fs = fourStep(m, x);
    if (!fs) continue;
    sec.append(h("div", { class: "formula" }, h("span", { class: "pill" }, ui(MOMENT_ZH[x.kind] || x.kind)),
      h("ol", null, fs.steps.map(([k, v]) => h("li", null, h("b", null, ui(k) + "："), speak(v)))),
      scriptBlock([fs.steps.map(([, v]) => v).join(" ")], "一鍵複製這段")));
  }
  const cur = sliceRecap(m, [m.status.period || 1], periodLabel(m.status.period || 1));
  const mood = moodLines(m, cur);
  if (mood.length) sec.append(h("h3", null, ui("觀眾心聲（說觀眾心裡想說的話）")), h("ul", { class: "banter" }, mood.map(([k, v]) => h("li", null, h("span", { class: "pill" }, ui(k)), " ", speak(v)))));
  sec.append(h("p", { class: "slogan" }, ui(pick(SLOGANS, m.id + Math.floor(Date.now() / 60000)))));
  return sec;
}

function liveQuarterBlock(m) {
  const q = m.status.period || 1;
  const rec = sliceRecap(m, [q], `${periodLabel(q)}（進行中）`);
  if (rec.empty) return null;
  return h("section", { class: "panel" }, h("h2", null, ui(`${periodLabel(q)}即時數據`)), recapTable(m, rec), h("ul", { class: "reasons" }, rec.lines.map((l) => h("li", null, ui(l)))));
}

function recapTable(m, rec) {
  return predTable(["項目", m.away.name, m.home.name], rec.rows.map(([l, hv, av]) => ({ cells: [l, String(av), String(hv)] })));
}

function recapBlock(m) {
  const done = finishedPeriods(m);
  if (!done.length) return null;
  const sec = h("section", { class: "panel", id: "recap" }, h("h2", null, ui("節次覆盤")));
  const items = [];
  for (const q of done) items.push({ key: "q" + q, periods: [q], label: periodLabel(q), kind: "q" });
  if (done.includes(2)) items.push({ key: "h1", periods: [1, 2], label: "上半場", kind: "half" });
  if (done.includes(4)) items.push({ key: "h2", periods: done.filter((q) => q >= 3), label: done.length > 4 ? "下半場＋延長" : "下半場", kind: "half" });
  for (const it of items.reverse()) {
    const rec = sliceRecap(m, it.periods, it.label);
    if (rec.empty) continue;
    const anchor = anchorSlice(m, rec, it.kind);
    const mood = moodLines(m, rec);
    sec.append(h("details", { class: "fold recap", "data-k": "rc-" + it.key, open: it === items[0] },
      h("summary", null, ui(`${it.label}覆盤 · ${m.away.name} ${rec.s.away.pts}：${rec.s.home.pts} ${m.home.name}`)),
      h("ul", { class: "reasons" }, rec.lines.map((l) => h("li", null, ui(l)))),
      recapTable(m, rec),
      scriptBlock(anchor.short, "口播（短版 15 秒）"),
      scriptBlock(anchor.long, "口播（長版 40 秒）"),
      mood.length ? h("div", null, h("h3", null, ui("幹話／吐槽／共鳴")), h("ul", { class: "banter" }, mood.map(([k, v]) => h("li", null, h("span", { class: "pill" }, ui(k)), " ", speak(v))))) : null));
  }
  return sec;
}

function fullRecapBlock(m) {
  const all = quarterList(m);
  const rec = sliceRecap(m, all, "全場");
  const ratings = ratePlayers(m);
  const review = predictionReview(m);
  const sec = h("section", { class: "panel", id: "full" }, h("h2", null, ui("全場覆盤")));
  sec.append(h("ul", { class: "reasons" }, rec.lines.map((l) => h("li", null, ui(l)))));
  const pro = proStats(m);
  if (pro.length) sec.append(predTable(["進階數據", m.away.name, m.home.name], pro.map((x) => ({ cells: [x.label, String(x.away), String(x.home)] }))));
  if (ratings.length) {
    sec.append(h("h3", null, ui("球員評分（Game Score 換算 10 分制）")));
    sec.append(h("ol", { class: "rating-list" }, ratings.slice(0, 8).map((r) => h("li", null,
      h("b", null, ui(`${r.rating.toFixed(1)}　${r.team} ${r.name}`)),
      ui(` ${r.min} 分鐘 ${r.pts} 分 ${r.reb} 板 ${r.ast} 助 · 投籃 ${r.fg.m}/${r.fg.a} 三分 ${r.tp.m}/${r.tp.a} · 正負 ${signed(r.pm)}`),
      r.tags.length ? h("span", { class: "faint" }, ui(` · ${r.tags.join("、")}`)) : null))));
    const worst = [...ratings].filter((r) => r.min >= 20).sort((a, b) => a.gs - b.gs)[0];
    if (worst) sec.append(h("p", { class: "faint" }, ui(`今晚最想忘記的人：${worst.team} ${worst.name}（${worst.pts} 分、投籃 ${worst.fg.m}/${worst.fg.a}、失誤 ${worst.tov}）`)));
  }
  if (review) sec.append(h("h3", null, ui("賽前預測檢討")), h("ul", { class: "reasons" }, review.map((l) => h("li", null, ui(l)))));
  sec.append(scriptBlock(anchorFull(m, ratings), "賽後口播"));
  const mood = moodLines(m, rec);
  if (mood.length) sec.append(h("ul", { class: "banter" }, mood.map(([k, v]) => h("li", null, h("span", { class: "pill" }, ui(k)), " ", speak(v)))));
  return sec;
}

function teamStatsBlock(m) {
  const bt = m.box.teams;
  if (!Object.keys(bt.home).length) return null;
  const rows = [
    ["投籃", (s) => `${s.fieldGoalsMade}/${s.fieldGoalsAttempted}（${s.fieldGoalPct}%）`],
    ["三分", (s) => `${s.threePointFieldGoalsMade}/${s.threePointFieldGoalsAttempted}（${s.threePointFieldGoalPct}%）`],
    ["罰球", (s) => `${s.freeThrowsMade}/${s.freeThrowsAttempted}（${s.freeThrowPct}%）`],
    ["籃板（進攻）", (s) => `${s.totalRebounds}（${s.offensiveRebounds}）`],
    ["助攻", (s) => s.assists], ["抄截", (s) => s.steals], ["火鍋", (s) => s.blocks],
    ["失誤", (s) => s.totalTurnovers ?? s.turnovers], ["犯規", (s) => s.fouls],
    ["禁區得分", (s) => s.pointsInPaint], ["快攻得分", (s) => s.fastBreakPoints], ["失誤轉換得分", (s) => s.turnoverPoints], ["最大領先", (s) => s.largestLead]
  ];
  return h("section", { class: "panel", id: "tstats" }, h("h2", null, ui("全隊數據")),
    predTable(["項目", m.away.name, m.home.name], rows.map(([l, f]) => ({ cells: [l, String(f(bt.away) ?? "–"), String(f(bt.home) ?? "–")] }))));
}

function boxBlock(m) {
  const any = m.box.players.home.length;
  if (!any) return null;
  return h("section", { class: "panel", id: "box" }, h("h2", null, ui("球員數據")),
    ...["away", "home"].map((side) => h("details", { class: "fold", "data-k": "box-" + side, open: true }, h("summary", null, ui(m[side].name)),
      predTable(["球員", "時間", "得分", "籃板", "助攻", "投籃", "三分", "罰球", "抄", "帽", "失誤", "犯規", "+/-"],
        m.box.players[side].filter((p) => !p.dnp).map((p) => ({
          cls: p.starter ? "starter" : "",
          cells: [`${p.starter ? "★ " : ""}${p.name}${p.pos ? " " + p.pos : ""}`, p.min, { node: String(p.pts), cls: p.pts >= 20 ? "pos" : "" }, p.reb, p.ast, `${p.fg.m}/${p.fg.a}`, `${p.tp.m}/${p.tp.a}`, `${p.ft.m}/${p.ft.a}`, p.stl, p.blk, p.tov, { node: String(p.pf), cls: p.pf >= 5 ? "neg" : "" }, signed(p.pm)]
        }))),
      m.box.players[side].some((p) => p.dnp) ? h("p", { class: "faint" }, ui("未上場：" + m.box.players[side].filter((p) => p.dnp).map((p) => p.name + (p.reason ? `（${p.reason}）` : "")).join("、"))) : null)));
}

function playsBlock(m) {
  const list = m.plays.filter((p) => p.score || p.timeout || p.review || p.blk || p.stl).slice(-40).reverse();
  if (!list.length) return null;
  return h("section", { class: "panel", id: "plays" }, h("h2", null, ui("關鍵逐球（最新 40 筆）")),
    h("ul", { class: "plays" }, list.map((p) => h("li", { class: p.side || "" },
      h("span", { class: "faint" }, `${p.period <= 4 ? "Q" + p.period : "OT" + (p.period - 4)} ${p.clock}`), " ",
      h("b", null, p.side ? ui(m[p.side].name) : ""), " ",
      ui(playText(p)),
      p.score ? h("span", { class: "faint" }, ` ${m.away.name} ${p.as}:${p.hs} ${m.home.name}`) : null))),
    h("p", { class: "faint" }, ui("球員中文名依名單對照，原文保留未翻譯部分。")));
}

function playText(p) {
  const who = p.player || "";
  if (p.score && p.shot?.ft) return `${who} 罰球進`;
  if (p.score && p.shot?.three) return `${who} ${p.shot.dist ? p.shot.dist + " 呎" : ""}三分球進${p.assist ? `（${p.assist} 助攻）` : ""}`;
  if (p.score && /dunk/i.test(p.type + p.text)) return `${who} 灌籃${p.assist ? `（${p.assist} 助攻）` : ""}`;
  if (p.score && /layup/i.test(p.type)) return `${who} 上籃得分${p.assist ? `（${p.assist} 助攻）` : ""}`;
  if (p.score) return `${who} 兩分球進${p.assist ? `（${p.assist} 助攻）` : ""}`;
  if (p.timeout) return "暫停";
  if (p.blk) {
    const m = /^(.+?) blocks (.+?)\s?'s (\d+)-foot/.exec(p.text) || /^(.+?) blocks (.+?)\s?'s/.exec(p.text);
    return m ? `${playerZh(m[1])} 送給 ${playerZh(m[2])} 一記火鍋${m[3] ? `（${m[3]} 呎出手）` : ""}` : `火鍋（${p.text}）`;
  }
  if (p.stl) {
    const who = (/^([A-Z][\w.'-]*(?: [A-Z][\w.'-]*)*)/.exec(p.text) || [])[1];
    const thief = (/\((.+?) steals\)/.exec(p.text) || [])[1];
    return thief ? `${playerZh(thief)} 抄截${who ? " " + playerZh(who) : ""}` : `抄截（${p.text}）`;
  }
  return p.text;
}

function savedPredBlock(m) {
  const p = loadPrediction(m.id);
  if (!p) return null;
  const H = m.home.name;
  const A = m.away.name;
  return h("details", { class: "fold panel", "data-k": "savedpred" }, h("summary", null, ui("賽前預測（這台裝置存下的）")),
    h("p", null, ui(`模型：${p.mu >= 0 ? H : A} 贏 ${trimNum(Math.abs(p.mu))}、總分 ${trimNum(p.muT)}、${H} 勝率 ${pct(p.pHome)}；盤口 ${H} ${fmtHandicap(p.line)}、大小 ${trimNum(p.total)}。`)),
    p.value?.length ? h("ul", null, p.value.map((v) => h("li", null, ui(`${v.group} ${v.label} @${fmtOdd(v.dec)}（期望值 ${evText(v.ev)}）`)))) : null);
}

/* ---------- 載入 ---------- */

async function loadSchedule(mode) {
  state.abort?.abort();
  state.abort = new AbortController();
  const days = wantedDays(mode === "full" ? "full" : "near");
  try {
    const results = await Promise.allSettled(days.map((d) => limit(() => fetchDay(d))));
    const ok = results.filter((r) => r.status === "fulfilled");
    if (!ok.length) throw new Error("schedule");
    const map = new Map(state.matches.map((m) => [m.id, m]));
    for (const r of ok) for (const ev of r.value) map.set(String(ev.id), normalizeEvent(ev));
    state.matches = [...map.values()];
    state.scheduleReady = true;
    state.scheduleError = false;
    state.scheduleLoadedAt = Date.now();
    if (mode === "full") { state.fullLoaded = true; state.fullAt = Date.now(); }
  } catch (err) {
    if (err.name === "AbortError") return;
    state.scheduleError = true;
  }
  if (!readRoute().event) maybeRender({ soft: true });
}

async function loadNews() {
  try {
    const data = await fetchJson(`${API}/news?limit=12`, new AbortController().signal);
    state.news = (data.articles || []).map((a) => ({ title: a.headline, url: a.links?.web?.href || "", at: a.published })).filter((a) => a.title);
    if (!readRoute().event) maybeRender({ soft: true });
  } catch { /* 新聞抓不到就算了 */ }
}

async function loadMatch(id) {
  if (state.summaryLoading) return;
  state.summaryLoading = true;
  try {
    const ctl = new AbortController();
    const data = await fetchJson(`${API}/summary?event=${id}&_=${Date.now()}`, ctl.signal);
    const model = buildModel(data);
    if (readRoute().event !== id) return;
    if (model.status.phase === "pre") state.pred = null;
    state.model = model;
    state.summaryError = false;
    state.summaryLoadedAt = Date.now();
  } catch (err) {
    if (!state.model) state.summaryError = true;
  } finally {
    state.summaryLoading = false;
  }
  if (readRoute().event === id) maybeRender({ soft: true });
}

async function loadRoute() {
  const route = readRoute();
  if (route.event) {
    render();
    await loadMatch(route.event);
    if (!state.matches.length) loadSchedule("near");
  } else {
    render();
    await loadSchedule("near");
    loadSchedule("full");
    loadNews();
  }
}

async function manualRefresh() {
  const route = readRoute();
  if (route.event) await loadMatch(route.event);
  else await loadSchedule("near");
  armTimer();
}

/* ---------- 即時偵測：每 5 秒打比分端點，有變化立刻抓完整資料 ---------- */

function freshText() {
  const at = state.pulseAt || state.summaryLoadedAt;
  if (!at) return "";
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  return `● 即時偵測中・${sec} 秒前確認・ESPN 資料本身約比電視慢 15–60 秒`;
}

function sigOf(ev) {
  const c = ev.competitions?.[0] || {};
  return [c.status?.period, c.status?.displayClock, ...(c.competitors || []).map((x) => x.score)].join("|");
}

async function pulse() {
  if (document.hidden || state.pulseBusy) return;
  const route = readRoute();
  const m = state.model;
  const watching = route.event ? m && m.status.state === "in" : anyLive();
  if (!watching) return;
  state.pulseBusy = true;
  try {
    const base = route.event ? taipeiYmd(m.kickoff) : taipeiYmd(new Date());
    const days = [addDays(base, -1), base];
    const evs = [];
    for (const d of days) {
      const res = await fetch(`${API}/scoreboard?dates=${etDate(d)}&_=${Date.now()}`, { cache: "no-store" });
      if (res.ok) evs.push(...((await res.json()).events || []));
    }
    state.pulseAt = Date.now();
    if (route.event) {
      const ev = evs.find((e) => String(e.id) === route.event);
      if (!ev) return;
      const n = normalizeEvent(ev);
      const el = document.getElementById("live-clock");
      if (el) el.textContent = ui(n.clock);
      const changed = Number(n.home.score) !== Number(m.home.score) || Number(n.away.score) !== Number(m.away.score) || n.status.period !== m.status.period;
      if (changed) {
        scoreAlert(m, n);
        await loadMatch(route.event);
      }
    } else {
      let changed = false;
      const map = new Map(state.matches.map((x) => [x.id, x]));
      for (const ev of evs) {
        const n = normalizeEvent(ev);
        const old = map.get(n.id);
        if (!old || old.home.score !== n.home.score || old.away.score !== n.away.score || old.clock !== n.clock) changed = true;
        map.set(n.id, n);
      }
      state.matches = [...map.values()];
      if (changed) { state.scheduleLoadedAt = Date.now(); maybeRender({ soft: true }); }
    }
  } catch { /* 下一輪再試 */ } finally {
    state.pulseBusy = false;
    const f = document.getElementById("fresh");
    if (f) f.textContent = ui(freshText());
  }
}

function scoreAlert(m, n) {
  const before = Math.sign(Number(m.home.score) - Number(m.away.score));
  const after = Math.sign(Number(n.home.score) - Number(n.away.score));
  const H = m.home.name;
  const A = m.away.name;
  let text = "";
  if (before && after && before !== after) text = `🔄 逆轉！${after > 0 ? H : A} 反超｜${A} ${n.away.score} : ${n.home.score} ${H}`;
  else if (n.status.period !== m.status.period) text = `⏱ ${n.clock}｜${A} ${n.away.score} : ${n.home.score} ${H}`;
  else if (n.status.period >= 4 && Math.abs(Number(n.home.score) - Number(n.away.score)) <= 3) text = `🔥 決勝膠著｜${A} ${n.away.score} : ${n.home.score} ${H}`;
  if (!text) return;
  state.flash = { text, until: Date.now() + 15000 };
  showFlash();
  try { navigator.vibrate?.([150, 80, 150]); } catch { /* 略過 */ }
}

function showFlash() {
  document.getElementById("goal-flash")?.remove();
  const g = state.flash;
  if (!g || Date.now() > g.until) return;
  const node = h("div", { class: "goal-flash", id: "goal-flash", role: "alert", onclick: () => { state.flash = null; node.remove(); } }, ui(g.text));
  document.body.append(node);
  setTimeout(() => node.remove(), g.until - Date.now());
}

function armTimer() {
  clearTimeout(state.timer);
  const route = readRoute();
  const live = route.event ? state.model?.status.state === "in" : anyLive();
  const soon = route.event && state.model?.status.phase === "pre" && new Date(state.model.kickoff) - Date.now() < 90 * 60000;
  state.timer = setTimeout(async () => {
    try {
      if (!document.hidden) {
        if (route.event) await loadMatch(route.event);
        else await loadSchedule(Date.now() - (state.fullAt || 0) > 30 * 60000 ? "full" : "near");
      }
    } finally { armTimer(); }
  }, live ? (route.event ? 30000 : 20000) : soon ? 60000 : 180000);
}

function boot() {
  clearInterval(state.pulseTimer);
  state.pulseTimer = setInterval(() => {
    pulse();
    const f = document.getElementById("fresh");
    if (f) f.textContent = ui(freshText());
  }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - Math.max(state.scheduleLoadedAt || 0, state.summaryLoadedAt || 0) > 20000) manualRefresh();
  });
  window.addEventListener("popstate", () => loadRoute());
  document.addEventListener("selectionchange", () => {
    if (pending && document.getSelection()?.isCollapsed) maybeRender({ soft: true });
  });
  loadRoute().finally(() => armTimer());
}

boot();
