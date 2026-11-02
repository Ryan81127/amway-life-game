let pending = false;

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (key === "disabled" || key === "hidden" || key === "open") node[key] = Boolean(value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (tag === "button" && !node.hasAttribute("type")) node.type = "button";
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

async function copyText(text, button) {
  const old = button.textContent;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else throw new Error("clipboard");
  } catch {
    const area = h("textarea", { class: "sr" });
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "已複製";
  setTimeout(() => {
    button.textContent = old;
  }, 1400);
}

function scriptBlock(lines) {
  if (!lines?.length) return null;
  const shown = lines.map((line) => speak(line));
  const button = h("button", { class: "copy" }, ui("複製口播"));
  button.addEventListener("click", () => copyText(shown.join("\n"), button));
  return h("div", { class: "script" },
    h("div", { class: "script-k" }, ui("口播")),
    shown.map((line) => h("p", { class: "say" }, line)),
    button
  );
}

function logoNode(src, abbr) {
  const wrap = h("span", { class: "logo" });
  if (!src) {
    wrap.append(h("span", { class: "abbr" }, abbr || "隊"));
    return wrap;
  }
  const img = h("img", { alt: "", src });
  img.addEventListener("error", () => {
    wrap.replaceChildren(h("span", { class: "abbr" }, abbr || "隊"));
  });
  wrap.append(img);
  return wrap;
}

function footer() {
  return h("footer", { class: "foot" }, ui("資料來源：ESPN。時間為台北時間。口播只依畫面上的數據，預測句會標明「以目前數據來看」。"));
}

function errorBox(retry) {
  return h("div", { class: "error-box" },
    h("p", null, "資料暫時無法取得"),
    h("button", { class: "retry", onclick: retry }, "重試")
  );
}

function setProgress(text) {
  const node = document.getElementById("progress");
  if (node) node.textContent = text;
}

function maybeRender(options) {
  const soft = !!options?.soft;
  const sel = document.getSelection?.();
  const app = document.getElementById("app");
  const selecting = sel && !sel.isCollapsed && app && app.contains(sel.anchorNode);
  const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (soft && (selecting || typing)) {
    pending = true;
    const stamp = document.getElementById("updated");
    const when = state.model ? state.summaryLoadedAt : state.scheduleLoadedAt;
    if (stamp && when) stamp.textContent = "更新於 " + taipeiClock(new Date(when));
    return;
  }
  pending = false;
  const y = soft ? window.scrollY : 0;
  render();
  window.scrollTo(0, y);
}

function render() {
  const route = readRoute();
  if (!route.event) state.filter = route.filter || "all";
  const app = document.getElementById("app");
  app.replaceChildren();
  try {
    if (route.event && route.league) renderMatch(app, route);
    else renderSchedule(app);
  } catch (err) {
    console.error(err);
    app.append(h("div", { class: "wrap" }, errorBox(() => location.reload())), footer());
  }
}

function langToggle() {
  const go = (next) => {
    if (locale() === next) return;
    setLocale(next);
    relabelNames();
    maybeRender({ soft: true });
  };
  return h("div", { class: "langbar", role: "group", "aria-label": "用語" },
    h("button", { class: "chip", "aria-pressed": String(locale() === "tw"), onclick: () => go("tw") }, "台灣用語"),
    h("button", { class: "chip", "aria-pressed": String(locale() === "cn"), onclick: () => go("cn") }, "大陆用语")
  );
}

function headerBar(title, sub, actions) {
  return h("header", { class: "top" },
    h("div", { class: "top-row" },
      h("div", { class: "brand" }, h("h1", null, ui(title)), sub ? h("p", { class: "sub", id: "updated" }, ui(sub)) : null),
      h("div", { class: "top-actions" }, actions)
    ),
    langToggle()
  );
}

function renderSchedule(app) {
  const bounds = windowBounds();
  const sub = state.scheduleLoadedAt ? `更新於 ${taipeiClock(new Date(state.scheduleLoadedAt))}` : "台北時間";
  const refresh = h("button", { class: "icon-btn", id: "refresh", onclick: () => manualRefresh() }, ui("重新整理"));
  app.append(headerBar("足球轉播看板", sub, [refresh]));
  const wrap = h("div", { class: "wrap" });
  wrap.append(h("p", { class: "faint" }, "昨天到未來 7 天 · 台北時間 · 比賽中每 20 秒更新，其他每 3 分鐘"));
  if (!state.matches.length && !state.scheduleError && !state.scheduleReady) {
    wrap.append(h("p", { class: "muted", id: "progress" }, "載入賽程中…"));
    app.append(wrap, footer());
    app.dataset.view = "schedule";
    return;
  }
  if (state.scheduleError && !state.matches.length) {
    wrap.append(errorBox(() => loadSchedule("full")));
    app.append(wrap, footer());
    return;
  }
  if (state.leagueErrors.length) {
    wrap.append(h("div", { class: "banner" }, `部分聯賽暫時無法取得：${state.leagueErrors.join("、")}。`));
  }
  wrap.append(chipRow());
  const filtered = state.matches.filter((match) => state.filter === "all" || match.league === state.filter);
  const live = filtered.filter((match) => match.state === "in").sort(sortMatch);
  wrap.append(h("div", { class: "section-h", id: "live-section" },
    h("h2", null, "進行中"),
    h("span", { class: "faint" }, live.length ? `${live.length} 場` : "目前沒有進行中的比賽")
  ));
  if (live.length) {
    const dot = h("span", { class: "live-dot" });
    live.forEach((match) => wrap.append(matchCard(match, dot)));
  }
  const days = eachYmd(bounds.start, bounds.end);
  let any = false;
  for (const ymd of days) {
    const list = filtered.filter((match) => taipeiYmd(match.date) === ymd).sort(sortMatch);
    if (!list.length) continue;
    any = true;
    wrap.append(h("div", { class: "day-h" }, dayTitle(ymd, bounds.today)));
    list.forEach((match) => wrap.append(matchCard(match)));
  }
  if (!any) wrap.append(h("div", { class: "empty" }, "這段期間沒有比賽"));
  app.append(wrap, footer());
  app.dataset.ready = state.scheduleReady ? "1" : "0";
  app.dataset.view = "schedule";
  document.title = "足球轉播看板";
}

function chipRow() {
  const row = h("div", { class: "chips", role: "toolbar", "aria-label": "聯賽篩選" });
  const all = [{ slug: "all", name: "全部" }, ...LEAGUES];
  for (const league of all) {
    row.append(h("button", {
      class: "chip",
      "aria-pressed": String(state.filter === league.slug),
      onclick: () => setFilter(league.slug)
    }, league.name));
  }
  return row;
}

function setFilter(slug) {
  state.filter = slug;
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (slug && slug !== "all") url.searchParams.set("filter", slug);
  history.replaceState({}, "", url);
  maybeRender({ soft: false });
}

function sortMatch(a, b) {
  const t = new Date(a.date) - new Date(b.date);
  if (t) return t;
  return LEAGUES.findIndex((l) => l.slug === a.league) - LEAGUES.findIndex((l) => l.slug === b.league);
}

function matchCard(match) {
  const live = match.state === "in";
  const pre = match.state === "pre" || match.clock === "未開賽";
  const card = h("a", {
    class: live ? "match-card live" : "match-card",
    href: `?league=${encodeURIComponent(match.league)}&event=${encodeURIComponent(match.id)}`
  });
  card.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openMatch(match.league, match.id);
  });
  const status = h("span", { class: "pill" }, live ? [h("span", { class: "live-dot" }), ui(match.clock)] : ui(match.clock));
  card.append(
    h("div", { class: "card-top" },
      h("span", { class: "pill" }, match.leagueName),
      h("span", null, `${taipeiHM(match.date)} 台北`),
      status
    ),
    teamLine(match.home, pre),
    teamLine(match.away, pre)
  );
  const oddsLine = scheduleOddsLine(match);
  if (oddsLine) card.append(h("p", { class: "odds-mini" }, ui(oddsLine.includes("獨贏") ? `盤口 ${oddsLine}（主/和/客）` : `盤口 ${oddsLine}`)));
  if (match.venue) card.append(h("p", { class: "faint" }, match.venue));
  return card;
}

function teamLine(team, pre) {
  return h("div", { class: "team-row" },
    h("div", { class: "team-id" }, logoNode(team.logo, team.abbr), h("strong", null, team.name)),
    h("span", { class: "score-side" }, pre ? "–" : (team.score ?? "–"))
  );
}

function renderMatch(app, route) {
  const model = state.model;
  const refresh = h("button", {
    class: state.summaryLoading ? "icon-btn busy" : "icon-btn",
    id: "refresh",
    onclick: () => manualRefresh()
  }, ui("重新整理"));
  const sub = state.summaryLoadedAt ? `更新於 ${taipeiClock(new Date(state.summaryLoadedAt))}` : "讀取比賽";
  app.append(headerBar(
    model ? `${model.home.name} 對 ${model.away.name}` : "比賽",
    sub,
    [h("button", { class: "back", onclick: () => goSchedule() }, ui("← 賽程")), refresh]
  ));
  const wrap = h("div", { class: "wrap" });
  if (!model && state.summaryLoading) {
    wrap.append(h("p", { class: "muted", id: "progress" }, "載入比賽資料…"));
    app.append(wrap, footer());
    app.dataset.view = "match";
    return;
  }
  if (!model) {
    wrap.append(errorBox(() => loadMatch(route.league, route.event)));
    app.append(wrap, footer());
    app.dataset.view = "match";
    return;
  }
  if (state.summaryStaleError) {
    wrap.append(h("div", { class: "banner" }, "資料暫時無法取得，畫面上是上一次成功的內容。",
      h("button", { class: "retry", onclick: () => loadMatch(route.league, route.event) }, "重試")));
  }
  document.title = `${model.home.name} 對 ${model.away.name}｜足球轉播看板`;
  wrap.append(scoreboard(model), grokButton(model), formationBlock(model), oddsBlock(model), analysisBlock(model), cheatBlock(model), checkpointBlock(), timeline(model), statsBlock(model), glossaryBlock(model), lineupBlock(model), formBlock(model), h2hBlock(model));
  app.append(wrap, footer());
  app.dataset.ready = "1";
  app.dataset.view = "match";
}

function goSchedule() {
  if (state.enteredFromSchedule) {
    state.enteredFromSchedule = false;
    history.back();
    return;
  }
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (state.filter && state.filter !== "all") url.searchParams.set("filter", state.filter);
  history.replaceState({}, "", url);
  loadRoute();
}

function openMatch(league, id) {
  state.enteredFromSchedule = true;
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("league", league);
  url.searchParams.set("event", id);
  history.pushState({}, "", url);
  loadRoute();
}

function scoreboard(model) {
  const pre = model.minute.phase === "pre";
  const live = model.minute.state === "in";
  const halfH = model.home.linescores?.[0]?.displayValue;
  const halfA = model.away.linescores?.[0]?.displayValue;
  const phase = phaseText(model.minute);
  const board = h("section", { class: "board", id: "board" });
  board.append(h("p", { class: "faint" }, [model.leagueName, model.venue, model.city].filter(Boolean).join(" · ")));
  const center = h("div", { class: "scoreline" });
  if (pre) {
    center.append(h("div", { class: "clock" }, taipeiHM(model.kickoff)), h("div", { class: "faint" }, "未開賽 · 台北"));
  } else {
    center.append(
      h("div", { class: "nums" }, model.home.score, h("span", null, "-"), model.away.score),
      h("div", { class: live ? "clock live" : "clock" }, model.minute.label),
      phase && phase !== model.minute.label ? h("div", { class: "faint" }, phase) : null,
      halfH != null && halfA != null ? h("div", { class: "faint" }, `上半場 ${halfH}-${halfA}`) : null
    );
  }
  board.append(h("div", { class: "board-grid" }, teamCol(model.home, "主"), center, teamCol(model.away, "客")));
  return board;
}

function teamCol(team, tag) {
  const col = h("div", { class: "side" });
  const color = safeColor(team.color);
  if (color) col.style.borderTop = `3px solid ${color}`;
  col.append(h("span", { class: "tag" }, tag), logoNode(team.logo, team.abbr), h("div", { class: "name" }, team.name));
  return col;
}

function grokButton(model) {
  const button = h("button", { class: "grok" }, "複製賽況給 Grok Bot");
  button.addEventListener("click", () => copyText(grokText(model), button));
  return h("div", { class: "row-actions" }, button);
}

function oddsBlock(model) {
  const report = oddsReport(model);
  const seenAt = state.memory?.oddsStamp?.at || state.summaryLoadedAt;
  const block = h("section", { class: "block", id: "odds" }, h("h2", null, ui("盤口參考與數據傾向")));
  block.append(h("p", { class: "odds-note" }, ui("賠率來源：ESPN（DraftKings 美式盤），可能與台灣運彩不同；僅供分析參考，不構成投注建議。在台灣僅台灣運彩為合法管道，請理性投注。")));
  if (!report) {
    block.append(h("p", null, "本場暫無盤口資料"));
    return block;
  }
  const stamp = seenAt ? `數字抓於 ${taipeiClock(new Date(seenAt))}（台北）` : "";
  block.append(h("p", { class: "faint" }, report.hasLive ? `有開賽盤，也有目前盤。${stamp}` : `以下是開賽盤。${stamp}`));
  for (const market of report.markets) block.append(oddsMarket(market));
  return block;
}

function oddsMarket(market) {
  const conf = market.confidence === "高" ? "conf-high" : market.confidence === "中" ? "conf-mid" : "conf-low";
  return h("article", { class: "cp" },
    h("h3", null, ui(market.title)),
    h("div", { class: market.rows.length > 2 ? "price-grid" : "price-grid two" }, market.rows.map((row) => h("div", { class: "price" },
      h("span", { class: "lbl" }, row.label),
      h("b", null, row.use ? fmtDecimal(row.use.decimal) : "–"),
      h("span", { class: "faint" }, row.use ? `隱含 ${fmtPct(row.use.implied)} · 美式 ${fmtAmerican(row.use.american)}` : "")
    ))),
    h("p", { class: "faint" }, market.rows.map((row) => `${row.label}：${row.line}`).join(" ")),
    h("p", { class: "lean" }, ui(market.lean), " · ", h("span", { class: `tag ${conf}` }, ui(`信心${market.confidence}`))),
    h("ul", { class: "bullets" }, market.reasons.map((reason) => h("li", null, ui(reason)))),
    scriptBlock(market.spoken)
  );
}

function analysisBlock(model) {
  const read = state.memory?.liveRead;
  const block = h("section", { class: "block script-panel", id: "live-analysis" }, h("h2", null, "即時賽況分析"));
  if (!read || model.minute.phase === "pre") {
    block.append(h("p", null, "比賽尚未開始。開賽後這裡會比較射門、角球、控球和牌的變化。"));
    block.append(scriptBlock(read?.spoken || ["比賽還沒開始，我先不講走勢，等有射門和控球再更新。"]));
    return block;
  }
  if (!read.since) block.append(h("p", { class: "faint" }, "這是這個瀏覽器第一次留下切片，還沒有上一次可以相減。約 15 分鐘的走勢，要等頁面多留一段時間。"));
  else block.append(h("p", { class: "faint" }, `跟上次切片比（${read.since.fromLabel} → ${read.since.toLabel}）。`));
  if (read.quarter) block.append(h("p", { class: "faint" }, `另一段約 ${read.quarter.mins} 分鐘（${read.quarter.fromLabel} → ${read.quarter.toLabel}）。`));
  else block.append(h("p", { class: "faint" }, "還沒有落在 10 到 25 分鐘前的切片，先不把任何變化說成最近 15 分鐘。"));
  const items = [];
  if (read.since?.sentence) items.push(read.since.sentence);
  if (read.quarter?.sentence) items.push(`約 ${read.quarter.mins} 分鐘這段：${read.quarter.sentence}`);
  if (read.newEvents?.length) items.push(`這次更新新增 ${read.newEvents.length} 筆事件。`);
  if (read.discipline?.fact) items.push(read.discipline.fact);
  if (read.gaps?.length) items.push("全場累積（不是最近 15 分鐘）：" + read.gaps.join(""));
  if (items.length) block.append(h("ul", { class: "bullets" }, items.map((item) => h("li", null, item))));
  if (read.since?.bits?.length) block.append(deltaTable(read.since, model));
  block.append(scriptBlock(read.spoken));
  return block;
}

function deltaTable(delta, model) {
  const labels = Object.fromEntries(MATCH_STATS);
  const keys = DELTA_KEYS.filter((key) => delta.home[key] || delta.away[key]);
  if (!keys.length) return null;
  const table = h("table", { class: "delta-table" },
    h("tr", null, h("th", null, "變化"), h("th", null, model.home.name), h("th", null, model.away.name))
  );
  for (const key of keys) {
    const hRow = delta.home[key];
    const aRow = delta.away[key];
    if ((hRow?.d || 0) === 0 && (aRow?.d || 0) === 0) continue;
    table.append(h("tr", null,
      h("td", null, labels[key] || key),
      h("td", null, hRow ? signed(hRow.d) : "–"),
      h("td", null, aRow ? signed(aRow.d) : "–")
    ));
  }
  return table;
}

function cheatBlock(model) {
  const lines = cheatLines(model);
  return h("section", { class: "block", id: "cheat" },
    h("h2", null, "主播小抄"),
    lines.length ? h("ul", { class: "bullets" }, lines.map((line) => h("li", null, line))) : h("p", null, "目前沒有足夠的背景資料。"),
    scriptBlock(cheatSpoken(lines))
  );
}

function checkpointBlock() {
  const list = [...(state.memory?.checkpoints || [])].sort((a, b) => a.sort - b.sort);
  const block = h("section", { class: "block", id: "checkpoints" },
    h("h2", null, "節點覆盤"),
    h("p", { class: "faint" }, "15 分、30 分、半場、60 分、75 分、全場，以及每一次進球。區間數字只在這個瀏覽器真的有前後兩次切片時才算。")
  );
  if (!list.length) {
    block.append(h("p", null, "開賽後會在這些時間點自動留下覆盤。"));
    return block;
  }
  for (const cp of list) block.append(checkpointCard(cp));
  return block;
}

function checkpointCard(cp) {
  const card = h("article", { class: "cp" },
    h("h3", null, cp.title),
    h("p", { class: "fact" }, cp.scorePhrase),
    cp.eventFacts?.length
      ? h("ul", { class: "bullets" }, cp.eventFacts.map((line) => h("li", null, line)))
      : h("p", null, "這段沒有進球、紅黃牌或換人。"),
    h("p", { class: "fact" }, cp.verdict || "")
  );
  if (cp.delta?.bits?.length) {
    card.append(h("p", { class: "faint" }, `技術統計變化（${cp.delta.fromLabel} → ${cp.delta.toLabel}），這是兩次抓資料的差。`));
    card.append(h("ul", { class: "bullets" }, cp.delta.bits.map((bit) => h("li", null, bit))));
  } else {
    card.append(h("p", { class: "faint" }, "這個節點沒有前後兩次技術統計切片，所以不算區間增減。"));
  }
  card.append(scriptBlock(cp.spoken));
  return card;
}

function timeline(model) {
  const fresh = new Set((state.memory?.liveRead?.newEvents || []).map((ev) => ev.id));
  const block = h("section", { class: "block", id: "timeline" }, h("h2", null, "事件時間軸"));
  const list = model.events.filter((ev) => ev.kind !== "other" || ev.playerNames.length);
  if (!list.length) {
    block.append(h("p", null, "目前沒有事件時間軸。"));
    return block;
  }
  const ul = h("ul", { class: "tl" });
  for (const ev of list) {
    const row = h("li", { class: `ev ${ev.kind}` },
      h("div", { class: "ev-top" },
        h("span", { class: "min" }, ev.minuteLabel || "–"),
        h("span", null, eventTitle(ev)),
        fresh.has(ev.id) ? h("span", { class: "new" }, "新") : null
      ),
      h("div", { class: "fact" }, eventBody(ev)),
      scriptBlock(ev.spoken)
    );
    ul.append(row);
  }
  block.append(ul);
  return block;
}

function eventTitle(ev) {
  if (ev.kind === "goal") return ev.style ? `${ev.style}進球` : "進球";
  if (ev.kind === "yellow") return "黃牌";
  if (ev.kind === "red") return "紅牌";
  if (ev.kind === "sub") return "換人";
  if (ev.kind === "miss") return "點球沒進";
  return ev.fact || "比賽進程";
}

function eventBody(ev) {
  const bits = [];
  if (ev.teamName) bits.push(ev.teamName);
  if (ev.kind === "goal") {
    bits.push(playerButton(ev.playerIds[0], ev.scorer || "未列名"));
    if (ev.assist) bits.push(document.createTextNode(" 助攻 "), playerButton(ev.playerIds[1], ev.assist));
    if (ev.score) bits.push(document.createTextNode(" · 比分 " + ev.score));
    return bits;
  }
  if (ev.kind === "sub" && ev.subOn) {
    bits.push(document.createTextNode("上場 "), playerButton(ev.playerIds[0], ev.subOn), document.createTextNode("，下場 "), playerButton(ev.playerIds[1], ev.subOff));
    return bits;
  }
  if (ev.playerNames[0]) bits.push(playerButton(ev.playerIds[0], ev.playerNames[0]));
  return bits.length ? bits : ev.fact;
}

function playerButton(id, label) {
  if (!id) return document.createTextNode(label || "");
  return h("button", { class: "player-link", onclick: () => openPlayer(id) }, label || "球員");
}

function statsBlock(model) {
  const mode = model.stats.mode;
  const rows = mode === "season" ? SEASON_TEAM_STATS : MATCH_STATS;
  const title = mode === "season" ? "本季球隊數據" : "技術統計";
  const block = h("section", { class: "block", id: "stats" }, h("h2", null, title));
  if (mode === "none") {
    block.append(h("p", null, "技術統計尚未公布。"));
    return block;
  }
  if (mode === "season") block.append(h("p", { class: "faint" }, "開賽前 ESPN 給的是球隊累積，不是本場技術統計。"));
  let any = false;
  for (const [key, label] of rows) {
    const hv = model.stats.home[key];
    const av = model.stats.away[key];
    if (hv == null && av == null) continue;
    any = true;
    const hNum = Number(hv) || 0;
    const aNum = Number(av) || 0;
    let hw;
    let aw;
    if (key === "possessionPct" || key === "passPct") {
      hw = Math.max(0, Math.min(100, hNum));
      aw = Math.max(0, Math.min(100, aNum));
    } else {
      const max = Math.max(hNum, aNum, 1);
      hw = hNum / max * 100;
      aw = aNum / max * 100;
    }
    const homeBar = h("i");
    homeBar.style.width = hw + "%";
    const awayBar = h("i");
    awayBar.style.width = aw + "%";
    block.append(h("div", { class: "stat" },
      h("b", { class: "home-n" }, fmtStat(key, hv)),
      h("div", null,
        h("span", { class: "lbl" }, ui(label)),
        h("div", { class: "tracks" }, h("span", { class: "track home" }, homeBar), h("span", { class: "track away" }, awayBar))
      ),
      h("b", null, fmtStat(key, av))
    ));
  }
  if (!any) block.append(h("p", null, "技術統計尚未公布。"));
  return block;
}

const PITCH_BAND = {
  G: ["gk", 0], GK: ["gk", 0],
  LB: ["def", 0], LWB: ["def", 0],
  "CD-L": ["def", 1], LCB: ["def", 1],
  CB: ["def", 2], CD: ["def", 2], SW: ["def", 2],
  "CD-R": ["def", 3], RCB: ["def", 3],
  RB: ["def", 4], RWB: ["def", 4],
  LDM: ["dm", 0],
  CDM: ["dm", 1], DM: ["dm", 1],
  RDM: ["dm", 2],
  LM: ["mid", 0],
  LCM: ["mid", 1],
  CM: ["mid", 2],
  RCM: ["mid", 3],
  RM: ["mid", 4],
  LW: ["am", 0], "AM-L": ["am", 0], LAM: ["am", 0],
  AM: ["am", 2], CAM: ["am", 2],
  RW: ["am", 4], "AM-R": ["am", 4], RAM: ["am", 4],
  LF: ["fwd", 0],
  SS: ["fwd", 1],
  F: ["fwd", 2], CF: ["fwd", 2], ST: ["fwd", 2],
  RF: ["fwd", 4]
};
const BAND_TOP = { gk: 84, def: 68, dm: 54, mid: 40, am: 26, fwd: 12 };

function pitchPlayers(block, events, teamId) {
  const starters = block.players.filter((player) => player.starter);
  const replaced = new Map();
  for (const ev of events || []) {
    if (ev.kind === "sub" && ev.teamId === teamId && ev.playerIds?.[1]) {
      replaced.set(ev.playerIds[1], { name: ev.subOn, minute: ev.minuteLabel });
    }
  }
  const pack = (player) => ({
    player,
    sub: replaced.get(player.id) || null,
    sent: (player.redMins || []).length > 0 || (player.stats?.redCards || 0) > 0
  });
  const gk = starters.find((player) => player.posAbbr === "G" || player.posAbbr === "GK") || starters.find((player) => player.formationPlace === 1);
  const rest = starters.filter((player) => player !== gk);
  const depthOf = (player) => {
    const role = PITCH_BAND[player.posAbbr];
    const band = role ? role[0] : "mid";
    return { d: { gk: 0, def: 1, dm: 2, mid: 3, am: 4, fwd: 5 }[band], x: role ? role[1] : 2 };
  };
  rest.sort((a, b) => depthOf(a).d - depthOf(b).d || depthOf(a).x - depthOf(b).x || a.formationPlace - b.formationPlace);
  const counts = String(block.formation || "").split("-").map(Number).filter((n) => n > 0);
  const rows = [];
  if (counts.length && counts.reduce((sum, n) => sum + n, 0) === rest.length) {
    let index = 0;
    for (const count of counts) {
      rows.push(rest.slice(index, index + count));
      index += count;
    }
  } else {
    const bands = ["def", "dm", "mid", "am", "fwd"];
    for (const band of bands) {
      const row = rest.filter((player) => (PITCH_BAND[player.posAbbr]?.[0] || "mid") === band);
      if (row.length) rows.push(row);
    }
  }
  const placed = [];
  if (gk) placed.push({ ...pack(gk), x: 50, y: 88 });
  rows.forEach((row, index) => {
    const y = rows.length === 1 ? 40 : 76 - (index * 58) / (rows.length - 1);
    row.forEach((player, col) => {
      placed.push({ ...pack(player), x: ((col + 1) / (row.length + 1)) * 100, y });
    });
  });
  return placed;
}

function formationBlock(model) {
  const block = h("section", { class: "block", id: "formation" }, h("h2", null, ui("即時陣型")));
  const home = model.roster?.home;
  const away = model.roster?.away;
  const ready = (home?.players || []).some((player) => player.starter) || (away?.players || []).some((player) => player.starter);
  if (!ready) {
    block.append(h("p", null, ui("首發名單通常賽前 1 小時公布")));
    return block;
  }
  block.append(h("p", { class: "faint" }, ui("依首發陣型，換人後會標示")));
  block.append(h("div", { class: "pitches" },
    pitchCard(model, "home"),
    pitchCard(model, "away")
  ));
  return block;
}

function pitchCard(model, side) {
  const team = model[side];
  const roster = model.roster[side];
  const shape = roster.formation || "";
  const note = formationNote(shape);
  const card = h("div", { class: "pitch-card" },
    h("h3", null, `${team.name}${shape ? " · " + shape : ""}`),
    note ? h("p", { class: "faint" }, ui(note)) : null
  );
  const pitch = h("div", { class: "pitch", "aria-label": ui("陣型圖") });
  for (const spot of pitchPlayers(roster, model.events, team.id)) {
    const short = (spot.sub?.name || "").split(" ").slice(-1)[0];
    pitch.append(h("button", {
      class: `dot${spot.sent ? " sent" : ""}${spot.sub ? " off" : ""}`,
      style: `left:${spot.x}%;top:${spot.y}%`,
      onclick: () => openPlayer(spot.player.id)
    },
      h("span", { class: "num" }, spot.player.jersey || "–"),
      h("span", { class: "pname" }, spot.player.name.split(" ").slice(-1)[0]),
      spot.sub ? h("span", { class: "came" }, `↑${short}`) : null,
      spot.sent ? h("span", { class: "redtag" }, ui("紅牌")) : null
    ));
  }
  card.append(pitch);
  return card;
}

function glossaryBlock(model) {
  const block = h("section", { class: "block", id: "glossary" }, h("h2", null, ui("術語小幫手")));
  const input = h("input", { class: "search", id: "gloss-search", type: "search", placeholder: ui("搜尋術語"), autocomplete: "off" });
  const live = h("div", { id: "gloss-live" });
  const tableWrap = h("div", { id: "gloss-table" });
  const paint = () => {
    const q = input.value.trim().toLowerCase();
    live.replaceChildren();
    if (!q) {
      const terms = matchTerms(model);
      if (terms.length) {
        live.append(h("h3", null, ui("本場用得到")));
        for (const term of terms) {
          live.append(h("article", { class: "term-card" },
            h("p", { class: "fact" }, `${term.tw} / ${term.cn} / ${term.en}`),
            h("p", { class: "say" }, speak(term.line))
          ));
        }
      }
    }
    tableWrap.replaceChildren();
    for (const [id, label] of GLOSS_GROUPS) {
      const rows = GLOSSARY.filter((item) => item.group === id && (!q || `${item.tw} ${item.cn} ${item.en}`.toLowerCase().includes(q)));
      if (!rows.length) continue;
      const table = h("table", { class: "gloss" },
        h("caption", null, ui(label)),
        h("tr", null, h("th", null, "台灣說法"), h("th", null, "大陆说法"), h("th", null, "English"))
      );
      for (const row of rows) {
        table.append(h("tr", null, h("td", null, row.tw), h("td", null, row.cn), h("td", null, row.en)));
      }
      tableWrap.append(table);
    }
    if (!tableWrap.childNodes.length) tableWrap.append(h("p", null, ui("沒有符合的術語")));
  };
  input.addEventListener("input", paint);
  paint();
  block.append(input, live, tableWrap);
  return block;
}

function lineupBlock(model) {
  const block = h("section", { class: "block", id: "lineups" }, h("h2", null, "陣容"));
  const input = h("input", { class: "search", id: "player-search", type: "search", placeholder: "搜尋本場球員", autocomplete: "off" });
  const results = h("div", { class: "search-results" });
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (!q) return;
    const hits = allPlayers(model).filter((item) => playerHit(item.player, q));
    if (!hits.length) {
      results.append(h("p", { class: "muted" }, "沒有符合的球員"));
      return;
    }
    for (const hit of hits.slice(0, 12)) {
      results.append(h("button", { class: "hit", onclick: () => openPlayer(hit.player.id) },
        h("span", null, `${hit.player.jersey ? hit.player.jersey + " " : ""}${hit.player.name}`),
        h("span", { class: "faint" }, `${hit.team.name} · ${hit.player.posZh || ""}`)
      ));
    }
  });
  block.append(input, results, h("div", { class: "squads" }, squad(model.roster.home, model.home), squad(model.roster.away, model.away)));
  return block;
}

function allPlayers(model) {
  return [
    ...model.roster.home.players.map((player) => ({ player, team: model.home })),
    ...model.roster.away.players.map((player) => ({ player, team: model.away }))
  ];
}

function playerHit(player, q) {
  return [player.name, player.shortName, player.lastName, player.jersey].some((value) => String(value || "").toLowerCase().includes(q));
}

function squad(block, team) {
  const box = h("div", null, h("h3", null, `${team.name}${block.formation ? " · " + block.formation : ""}`));
  const starters = block.players.filter((p) => p.starter).sort((a, b) => a.formationPlace - b.formationPlace);
  const bench = block.players.filter((p) => !p.starter);
  if (!block.players.length) {
    box.append(h("p", null, "陣容尚未公布"));
    return box;
  }
  box.append(h("p", { class: "faint" }, starters.length ? "先發" : "名單"));
  (starters.length ? starters : block.players).forEach((player) => box.append(playerRow(player)));
  if (starters.length && bench.length) {
    box.append(h("p", { class: "faint" }, "替補"));
    bench.forEach((player) => box.append(playerRow(player)));
  }
  return box;
}

function playerRow(player) {
  const bits = [];
  if ((player.stats.totalGoals || 0) > 0) bits.push(`${trimNum(player.stats.totalGoals)} 球`);
  if ((player.stats.goalAssists || 0) > 0) bits.push(`${trimNum(player.stats.goalAssists)} 助攻`);
  if ((player.stats.yellowCards || 0) > 0 || player.yellowMins.length) bits.push("黃牌");
  if ((player.stats.redCards || 0) > 0 || player.redMins.length) bits.push("紅牌");
  if (player.subOn) bits.push(`${player.subOn} 上`);
  if (player.subOff) bits.push(`${player.subOff} 下`);
  return h("button", { class: "xi", onclick: () => openPlayer(player.id) },
    h("span", { class: "no" }, player.jersey || "–"),
    h("span", { class: "who" },
      h("span", { class: "nm" }, player.name),
      h("span", { class: "pos" }, [player.posZh, bits.join(" · ")].filter(Boolean).join(" · "))
    )
  );
}

function formBlock(model) {
  const block = h("section", { class: "block" }, h("h2", null, "近況"));
  if (!model.form.length) {
    block.append(h("p", null, "沒有近況資料。"));
    return block;
  }
  for (const side of model.form) {
    block.append(h("h3", null, side.name));
    if (!side.games.length) {
      block.append(h("p", null, "沒有近 5 場資料。"));
      continue;
    }
    for (const game of side.games) {
      const label = game.result === "W" ? "勝" : game.result === "D" ? "和" : game.result === "L" ? "負" : "–";
      block.append(h("div", { class: "form-row" },
        h("span", { class: `result ${game.result || ""}` }, label),
        h("span", null, `${shortDate(game.date)} ${game.score || ""} ${game.opponent}`),
        h("span", { class: "faint" }, game.comp)
      ));
    }
  }
  return block;
}

function h2hBlock(model) {
  const block = h("section", { class: "block" }, h("h2", null, "對戰往績"));
  if (!model.h2h.games.length) {
    block.append(h("p", null, "沒有對戰往績。"));
    return block;
  }
  const decided = model.h2h.hw + model.h2h.aw + model.h2h.dr;
  if (decided) block.append(h("p", null, `${model.home.name} ${model.h2h.hw} 勝，和局 ${model.h2h.dr}，${model.away.name} ${model.h2h.aw} 勝。`));
  for (const game of model.h2h.games) {
    const homeSide = game.teams.find((t) => t.homeAway === "home") || game.teams[0];
    const awaySide = game.teams.find((t) => t !== homeSide);
    block.append(h("div", { class: "h2h" }, `${shortDate(game.date)} ${homeSide?.name || ""} ${homeSide?.score ?? ""} - ${awaySide?.score ?? ""} ${awaySide?.name || ""}`));
  }
  return block;
}

function findPlayer(model, id) {
  for (const item of allPlayers(model)) {
    if (item.player.id === String(id)) return item;
  }
  return null;
}

function ensureDialog() {
  let dialog = document.getElementById("player-dialog");
  if (dialog) return dialog;
  dialog = h("dialog", { id: "player-dialog", class: "player" });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (pending) {
      pending = false;
      maybeRender({ soft: true });
    }
  });
  document.body.append(dialog);
  return dialog;
}

function openPlayer(id) {
  const model = state.model;
  if (!model) return;
  const found = findPlayer(model, id);
  if (!found) return;
  const dialog = ensureDialog();
  dialog.dataset.id = found.player.id;
  fillDialog(dialog, found, { loading: true });
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  loadSeason(model.leagueSlug, found.player.id).then((splits) => {
    if (dialog.dataset.id !== found.player.id) return;
    fillDialog(dialog, found, { splits });
  }).catch(() => {
    if (dialog.dataset.id !== found.player.id) return;
    fillDialog(dialog, found, { error: true });
  });
}

function seasonBlock(extra) {
  const season = h("div");
  season.append(h("h3", null, "賽季數據"));
  if (extra.loading) season.append(h("p", { class: "muted" }, "讀取賽季數據…"));
  else if (extra.error) season.append(h("p", null, "賽季數據暫時無法取得"));
  else if (!extra.splits?.length) season.append(h("p", null, "這份賽季數據沒有可顯示的項目。"));
  else {
    for (const split of extra.splits) {
      season.append(h("p", { class: "faint" }, split.title));
      season.append(h("div", { class: "grid-stats" }, split.rows.slice(0, 8).map((row) => h("div", { class: "cell" }, h("b", null, String(row.value)), h("span", null, row.label)))));
    }
  }
  return season;
}

function fillDialog(dialog, found, extra) {
  const player = found.player;
  const lines = outlookLines(player);
  const spoken = playerSpoken(player, found.team.name, lines);
  dialog.replaceChildren(h("div", { class: "sheet" },
    h("div", { class: "sheet-top" },
      h("div", null,
        h("p", { class: "faint" }, found.team.name),
        h("h2", null, player.name)
      ),
      h("button", { class: "icon-btn", onclick: () => dialog.close() }, "關閉")
    ),
    h("p", null, `${player.jersey ? player.jersey + " 號 · " : ""}${player.posZh || "位置未列"} · ${player.starter ? "先發" : "替補"}`),
    h("h3", null, "本場"),
    statGrid(player),
    minuteLine(player),
    seasonBlock(extra),
    h("h3", null, "判斷"),
    h("ul", { class: "bullets" }, lines.map((line) => h("li", null, line))),
    scriptBlock(spoken)
  ));
}

function statGrid(player) {
  const rows = [
    ["totalGoals", "進球"],
    ["goalAssists", "助攻"],
    ["totalShots", "射門"],
    ["shotsOnTarget", "射正"],
    ["yellowCards", "黃牌"],
    ["redCards", "紅牌"],
    ["saves", "撲救"],
    ["foulsCommitted", "犯規"],
    ["goalsConceded", "失球"]
  ];
  const cells = [];
  for (const [key, label] of rows) {
    const value = player.stats[key];
    if (value == null) continue;
    if (["saves", "foulsCommitted", "goalsConceded", "shotsOnTarget"].includes(key) && value === 0 && key !== "shotsOnTarget") continue;
    cells.push(h("div", { class: "cell" }, h("b", null, trimNum(value)), h("span", null, label)));
  }
  if (!cells.length) return h("p", null, "本場數據還沒有。");
  return h("div", { class: "grid-stats" }, cells);
}

function minuteLine(player) {
  const bits = [];
  if (player.goalMins.length) bits.push(`進球 ${player.goalMins.join("、")}`);
  if (player.assistMins.length) bits.push(`助攻 ${player.assistMins.join("、")}`);
  if (player.yellowMins.length) bits.push(`黃牌 ${player.yellowMins.join("、")}`);
  if (player.redMins.length) bits.push(`紅牌 ${player.redMins.join("、")}`);
  if (player.subOn) bits.push(`上場 ${player.subOn}`);
  if (player.subOff) bits.push(`下場 ${player.subOff}`);
  if (!bits.length) return null;
  return h("p", null, bits.join(" · "));
}

async function loadSchedule(mode) {
  state.abort?.abort();
  state.abort = new AbortController();
  const token = ++state.token;
  const plan = wantedDays(mode);
  const showSpinner = !state.matches.length;
  state.scheduleError = false;
  if (showSpinner) render();
  try {
    await probeRange(plan.days);
    if (token !== state.token) return;
    const seen = new Map();
    const ok = new Set();
    const errors = [];
    let done = 0;
    await Promise.all(LEAGUES.map(async (league) => {
      try {
        const events = await fetchLeague(league.slug, plan.days);
        if (token !== state.token) return;
        ok.add(league.slug);
        for (const ev of events) {
          const match = normalizeEvent(ev, league);
          if (!match || !match.date || !inWindow(match.date, plan.start, plan.end)) continue;
          seen.set(match.id, match);
        }
      } catch (err) {
        if (err.name === "AbortError") throw err;
        errors.push(league.name);
      } finally {
        done += 1;
        setProgress(`載入賽程中… ${done}/${LEAGUES.length}`);
      }
    }));
    if (token !== state.token) return;
    if (plan.full) {
      const kept = state.matches.filter((match) => !ok.has(match.league));
      state.matches = [...kept, ...seen.values()];
    } else {
      const map = new Map(state.matches.map((match) => [match.id, match]));
      for (const match of seen.values()) map.set(match.id, match);
      state.matches = [...map.values()];
    }
    state.leagueErrors = errors;
    state.scheduleReady = state.matches.length > 0 || errors.length < LEAGUES.length;
    state.scheduleLoadedAt = Date.now();
    state.scheduleError = !state.matches.length && errors.length === LEAGUES.length;
    state.scheduleStaleError = false;
    maybeRender({ soft: !showSpinner });
  } catch (err) {
    if (err.name === "AbortError" || token !== state.token) return;
    if (!state.matches.length) state.scheduleError = true;
    else state.scheduleStaleError = true;
    maybeRender({ soft: state.matches.length > 0 });
  }
}

async function loadMatch(league, id) {
  state.abort?.abort();
  state.abort = new AbortController();
  const token = ++state.token;
  const same = state.model && state.model.id === String(id);
  state.summaryLoading = true;
  state.summaryError = false;
  if (!same) {
    state.summaryStaleError = false;
    state.model = null;
    state.memory = null;
    render();
  } else {
    document.getElementById("refresh")?.classList.add("busy");
  }
  try {
    const data = await fetchJson(`${API}/${league}/summary?event=${encodeURIComponent(id)}`);
    if (token !== state.token) return;
    const model = buildModel(data, league);
    state.model = model;
    state.memory = updateMemory(model);
    state.summaryLoadedAt = Date.now();
    state.summaryLoading = false;
    state.summaryError = false;
    maybeRender({ soft: !!same });
  } catch (err) {
    if (err.name === "AbortError" || token !== state.token) return;
    state.summaryLoading = false;
    if (same && state.model) state.summaryStaleError = true;
    else state.summaryError = true;
    maybeRender({ soft: !!same });
  }
}

async function loadRoute() {
  const route = readRoute();
  if (!(route.event && route.league)) document.getElementById("player-dialog")?.close();
  if (route.event && route.league) {
    await loadMatch(route.league, route.event);
    return;
  }
  if (!state.matches.length) await loadSchedule("full");
  else {
    maybeRender({ soft: false });
    const age = Date.now() - state.scheduleLoadedAt;
    if (age > 20000) await loadSchedule(anyLive() ? "live" : "full");
  }
}

async function manualRefresh() {
  clearTimeout(state.timer);
  const route = readRoute();
  if (route.event && route.league) await loadMatch(route.league, route.event);
  else await loadSchedule(anyLive() ? "live" : "full");
  armTimer();
}

function armTimer() {
  clearTimeout(state.timer);
  const route = readRoute();
  const live = route.event ? state.model?.minute?.state === "in" : state.matches.some((match) => match.state === "in");
  state.timer = setTimeout(() => {
    autoRefresh();
  }, live ? 20000 : 180000);
}

async function autoRefresh() {
  try {
    const route = readRoute();
    if (route.event && route.league) await loadMatch(route.league, route.event);
    else await loadSchedule(state.matches.some((match) => match.state === "in") ? "live" : "full");
  } finally {
    armTimer();
  }
}

function boot() {
  window.addEventListener("popstate", () => {
    loadRoute();
  });
  document.addEventListener("selectionchange", () => {
    if (pending && document.getSelection()?.isCollapsed) {
      pending = false;
      maybeRender({ soft: true });
    }
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (pending && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        pending = false;
        maybeRender({ soft: true });
      }
    }, 0);
  });
  loadRoute().finally(() => armTimer());
}

boot();
