/* 兩隊故事與看點：從維基百科（繁體）整理出有梗的歷史、特色、紀錄、戰績，以及兩隊之間的交集與恩怨。 */

const STORY_PREFIX = "fb-story-v2:";
const storyStore = new Map();

const STORY_SECTIONS = /歷史|簡史|發展|沿革|榮譽|成就|戰績|成績|特色|球迷|文化|德比|宿敵|對手|恩怨|綽號|名稱|傳統|紀錄|經典|風格|爭議|事件/;
const STORY_SKIP = /參考|注釋|註釋|外部連結|資料來源|延伸閱讀|球員名單|球衣|贊助|歷任|教練|陣容|名單/;
const STORY_WORDS = [
  [/冠軍|奪冠|奪得|稱霸|封王/, 3], [/爆冷|奇蹟|逆轉|神蹟/, 4], [/首次|首度|第一次|歷史性/, 3], [/最[多大高低佳長早]|紀錄|史上/, 2],
  [/德比|宿敵|死敵|恩怨|世仇|對手/, 4], [/衝突|打架|鬥毆|騷亂|爭議|醜聞|停賽|罰款|假球|抗議|暴動/, 4],
  [/世界盃|亞洲盃|歐洲盃|美洲盃|奧運|決賽|晉級|出線/, 2], [/擊敗|大勝|慘敗|大比分|\d+[–-]\d+/, 2],
  [/綽號|暱稱|稱為|之稱|外號/, 3], [/傳奇|名宿|球王|巨星/, 2], [/球迷|主場|氣氛/, 1], [/\d{4}年/, 1]
];

function storyClean(text) {
  return String(text || "").replace(/\[\d+\]|\[註 ?\d+\]|\[來源請求\]/g, "").replace(/\s+/g, " ").replace(/（英語：[^）]*）/g, "").trim();
}

function storySentences(text) {
  return storyClean(text).split(/(?<=[。！？])/).map((s) => s.trim())
    .filter((s) => s.length >= 14 && s.length <= 160 && !/^[令而但並且其此這該同後於在因由及與、，；：（]/.test(s) && !/^(之後|此後|其後|同年|隨後|然而|不過|另外|此外)/.test(s));
}

function storyScore(s) {
  let n = 0;
  for (const [re, w] of STORY_WORDS) if (re.test(s)) n += w;
  if (s.length > 110) n -= 1;
  return n;
}

async function storyZhTitle(team, national) {
  const q = national ? `${team.rawName} national football team` : `${team.rawName} football club`;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=langlinks&lllang=zh`;
    const page = (await fetch(url).then((r) => r.json())).query?.pages?.[0];
    return page ? { zh: page.langlinks?.[0]?.title || "", en: page.title } : null;
  } catch {
    return null;
  }
}

async function storyDoc(zhTitle) {
  const res = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(zhTitle)}`, { headers: { "Accept-Language": "zh-tw" } });
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  doc.querySelectorAll("style, sup.reference, .reference, .references, .reflist, .mw-references-wrap, .navbox, .metadata, table.ambox").forEach((n) => n.remove());
  return doc;
}

function storyInfobox(doc) {
  const box = doc.querySelector("table.infobox");
  const facts = [];
  if (!box) return facts;
  let group = "";
  for (const tr of box.querySelectorAll("tr")) {
    const cells = [...tr.children];
    const txt = (n) => storyClean(n.textContent).slice(0, 80);
    if (cells.length === 1) {
      const t = txt(cells[0]);
      if (t && t.length <= 12 && !/\d/.test(t)) group = t;
      else if (t && group && /[–-]/.test(t) && /\d/.test(t)) facts.push({ k: group, v: t });
      continue;
    }
    if (cells.length < 2) continue;
    cells[1].querySelectorAll("br").forEach((br) => br.replaceWith("、"));
    const k = txt(cells[0]);
    const v = txt(cells[1]).replace(/、\s*$/, "").replace(/、{2,}/g, "、");
    if (!k || !v || v.length > 70) continue;
    facts.push({ k: group && /參賽次數|最佳成績|當前排名|最高排名|最低排名/.test(k) ? `${group}${k}` : k, v });
  }
  return facts;
}

const INFO_PICK = [
  [/綽號|暱稱|別稱/, (v) => `綽號叫「${v}」`],
  [/^成立|成立時間|創立/, (v) => `成立於 ${v}`],
  [/出場最多/, (v) => `隊史出場王：${v}`],
  [/入球最多|進球最多|射手王/, (v) => `隊史射手王：${v}`],
  [/首場國際比賽/, (v) => `隊史第一場國際賽：${v}`],
  [/最大比分勝利|最大勝利/, (v) => `隊史最大勝仗：${v}`],
  [/最大比分失利|最大失利|最大落敗/, (v) => `隊史最慘一敗：${v}`],
  [/FIFA排名最高排名|^最高排名/, (v) => `FIFA 排名最高曾到第 ${v}`],
  [/FIFA排名當前排名|^當前排名/, (v) => `目前 FIFA 排名第 ${v}`],
  [/世界盃參賽次數/, (v) => `世界盃參賽次數：${v}`],
  [/世界盃最佳成績/, (v) => `世界盃最佳成績：${v}`],
  [/亞洲[盃杯].*參賽次數/, (v) => `亞洲盃參賽：${v}`],
  [/亞洲[盃杯].*最佳成績/, (v) => `亞洲盃最佳：${v}`],
  [/^球場|^主場/, (v) => `主場：${v}`],
  [/^聯賽/, (v) => `目前聯賽：${v}`]
];

function infoLines(facts) {
  const out = [];
  const used = new Set();
  for (const [re, fmt] of INFO_PICK) {
    const f = facts.find((x) => re.test(x.k) && !used.has(x));
    if (!f || f.v === "-" ) continue;
    used.add(f);
    out.push(fmt(f.v.replace(/▲|▼/g, (m) => (m === "▲" ? "↑" : "↓"))));
  }
  return out;
}

function docSections(doc) {
  const out = [];
  const intro = doc.querySelector("section");
  for (const sec of doc.querySelectorAll("section")) {
    const head = storyClean(sec.querySelector(":scope > h2, :scope > h3, :scope > h4")?.textContent || "");
    const own = [...sec.querySelectorAll(":scope > p, :scope > ul > li, :scope > ol > li, :scope > dl > dd")].map((n) => n.textContent).join("\n");
    out.push({ head: sec === intro ? "簡介" : head, text: own });
  }
  return out;
}

function honorLines(doc) {
  for (const sec of doc.querySelectorAll("section")) {
    const head = sec.querySelector(":scope > h2, :scope > h3")?.textContent || "";
    if (!/榮譽|成就|冠軍/.test(head)) continue;
    const items = [...sec.querySelectorAll("li, p")].map((n) => storyClean(n.textContent)).filter((t) => t.length >= 4 && t.length <= 90 && !/^↑/.test(t));
    if (items.length) return items.slice(0, 6);
  }
  return [];
}

function oppNames(team, zhTitle) {
  const names = new Set([team.name, team.rawName]);
  if (zhTitle) names.add(toTw(zhTitle).replace(/(男子)?(國家)?足球(代表)?隊|足球俱樂部|足球會|足球隊/g, ""));
  if (/中華台北|台北/.test(team.name)) ["中華民國", "台灣", "臺灣", "中華台北"].forEach((n) => names.add(n));
  if (/南韓|韓國/.test(team.name)) ["韓國", "南韓", "大韓民國"].forEach((n) => names.add(n));
  if (/中國/.test(team.name)) names.add("中國");
  return [...names].filter((n) => n && n.length >= 2);
}

async function teamStory(team, national) {
  const t = await storyZhTitle(team, national);
  if (!t?.zh) return t ? { title: t.en, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.en)}`, lang: "en", info: [], honors: [], stories: [], all: [] } : null;
  const doc = await storyDoc(t.zh);
  if (!doc) return null;
  const sections = docSections(doc);
  const all = [];
  for (const s of sections) {
    if (STORY_SKIP.test(s.head)) continue;
    for (const sentence of storySentences(s.text)) all.push({ s: sentence, head: s.head, score: storyScore(sentence) + (STORY_SECTIONS.test(s.head) ? 1 : 0) });
  }
  const stories = all.filter((x) => x.score >= 4 && !/是.*的(男子)?(國家)?足球(代表)?隊[，。]/.test(x.s)).sort((a, b) => b.score - a.score).slice(0, 6);
  return {
    title: toTw(t.zh), url: `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(t.zh)}`, lang: "zh", zhTitle: t.zh,
    info: infoLines(storyInfobox(doc)), honors: honorLines(doc), stories, all
  };
}

async function rivalryStory(model) {
  const a = model.home.rawName.split(" ")[0];
  const b = model.away.rawName.split(" ")[0];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrsearch=${encodeURIComponent(`${model.home.rawName} ${model.away.rawName} football rivalry`)}&gsrlimit=5&prop=langlinks%7Cextracts&lllang=zh&exintro=1&explaintext=1&exsentences=4`;
    const pages = (await fetch(url).then((r) => r.json())).query?.pages || [];
    const hit = pages.find((p) => p.title.includes(a) && p.title.includes(b) && /rivalry|derby|clásico|classic/i.test(p.title));
    if (!hit) return null;
    const zh = hit.langlinks?.[0]?.title;
    if (zh) {
      const sum = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(zh)}`, { headers: { "Accept-Language": "zh-tw" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (sum?.extract) return { title: toTw(sum.title || zh), text: sum.extract, url: sum.content_urls?.desktop?.page, lang: "zh" };
    }
    return { title: hit.title, text: hit.extract, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`, lang: "en" };
  } catch {
    return null;
  }
}

function crossLines(model, home, away) {
  const out = [];
  const seen = new Set();
  const scan = (story, opp, oppTitle) => {
    if (!story?.all) return;
    const names = oppNames(opp, oppTitle);
    for (const x of story.all) {
      if (!names.some((n) => x.s.includes(n)) || seen.has(x.s)) continue;
      seen.add(x.s);
      out.push({ s: x.s, score: x.score + 3 });
    }
    for (const line of story.info) {
      if (names.some((n) => line.includes(n)) && !seen.has(line)) { seen.add(line); out.push({ s: line + "。", score: 6 }); }
    }
  };
  scan(home, model.away, away?.zhTitle);
  scan(away, model.home, home?.zhTitle);
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

async function ensureStory(model) {
  const key = `${model.home.id}-${model.away.id}`;
  if (storyStore.has(key)) return;
  try {
    const cached = JSON.parse(localStorage.getItem(STORY_PREFIX + key) || "null");
    if (cached && Date.now() - cached.t < 7 * 86400000) { storyStore.set(key, { status: "ok", ...cached.v }); return; }
  } catch { /* 略過 */ }
  storyStore.set(key, { status: "loading" });
  const national = NATIONAL_LEAGUES.test(model.leagueSlug || "");
  const [home, away, rivalry] = await Promise.all([
    teamStory(model.home, national).catch(() => null),
    teamStory(model.away, national).catch(() => null),
    rivalryStory(model)
  ]);
  const cross = crossLines(model, home, away);
  const slim = (s) => s && { title: s.title, url: s.url, lang: s.lang, info: s.info, honors: s.honors, stories: s.stories.map((x) => x.s) };
  const v = { home: slim(home), away: slim(away), rivalry, cross: cross.map((x) => x.s) };
  storyStore.set(key, { status: "ok", ...v });
  try { localStorage.setItem(STORY_PREFIX + key, JSON.stringify({ t: Date.now(), v })); } catch { /* 略過 */ }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function storyOf(model) {
  const st = storyStore.get(`${model.home.id}-${model.away.id}`);
  if (!st) { ensureStory(model); return null; }
  return st.status === "ok" ? st : null;
}

function h2hLines(model) {
  const g = model.h2h?.games || [];
  if (!g.length) return [];
  const H = model.home.name;
  const A = model.away.name;
  const out = [`近期交手 ${g.length} 場：${H} ${model.h2h.hw} 勝、和 ${model.h2h.dr}、${A} ${model.h2h.aw} 勝。`];
  let big = null;
  for (const game of g) {
    const [x, y] = game.teams;
    const diff = Math.abs(Number(x.score) - Number(y.score));
    if (!big || diff > big.diff) big = { diff, game, x, y };
  }
  if (big && big.diff >= 2) out.push(`最懸殊的一場：${shortDate(big.game.date)} ${big.x.name} ${big.x.score}:${big.y.score} ${big.y.name}。`);
  return out;
}

function numFrom(lines, re) {
  const l = (lines || []).find((x) => re.test(x));
  const m = l && /第\s*(\d+)|：\s*(\d+)/.exec(l);
  return m ? Number(m[1] || m[2]) : null;
}

function contrastLines(model, st) {
  const out = [];
  const H = model.home.name;
  const A = model.away.name;
  const hi = st.home?.info || [];
  const ai = st.away?.info || [];
  const hr = numFrom(hi, /目前 FIFA 排名/);
  const ar = numFrom(ai, /目前 FIFA 排名/);
  if (hr && ar && Math.abs(hr - ar) >= 20) {
    const [up, down] = hr < ar ? [H, A] : [A, H];
    out.push(`FIFA 排名：${H} 第 ${hr}、${A} 第 ${ar}，差了 ${Math.abs(hr - ar)} 名——${down}挑戰${up}，標準的以小搏大。`);
  } else if (hr && ar) out.push(`FIFA 排名：${H} 第 ${hr}、${A} 第 ${ar}，實力接近，細節決定勝負。`);
  const hw = numFrom(hi, /世界盃參賽次數/);
  const aw = numFrom(ai, /世界盃參賽次數/);
  if (hw != null && aw != null && hw !== aw) out.push(`世界盃經驗：${H} ${hw} 次、${A} ${aw} 次${Math.min(hw, aw) === 0 ? `，${hw === 0 ? H : A}還在等第一次` : ""}。`);
  const nick = (info) => ((info || []).find((x) => /綽號/.test(x)) || "").replace(/綽號叫「|」/g, "").split("、")[0];
  const hn = nick(hi);
  const an = nick(ai);
  if (hn && an) out.push(`綽號對決：「${hn}」對上「${an}」。`);
  return out;
}

function curatedCards(model) {
  const cards = state.cards && state.cards.id === model.id && state.cards.data ? state.cards.data.cards : [];
  return cards.filter((c) => !c.auto && c.eff?.status !== "不可當成事實播報");
}

/* ---------- 查證故事卡排程：Claude 定時查證、寫進 cards/，網頁按「重新整理故事」就讀到 ---------- */

const STORY_REPO = "Ryan81127/amway-life-game";
const STORY_RUNS_DEFAULT = ["08:40", "13:40", "17:40", "21:10"];
const STORY_RUN_MINUTES = 45;
let storyQueue = null;
let storyQueueAt = 0;
let storyQueueBusy = false;

async function loadStoryQueue(force) {
  if (storyQueueBusy) return;
  if (!force && storyQueue && Date.now() - storyQueueAt < 5 * 60000) return;
  storyQueueBusy = true;
  try {
    const res = await fetch(`cards/queue.json?t=${Date.now()}`, { cache: "no-store" });
    storyQueue = res.ok ? await res.json() : { runs: STORY_RUNS_DEFAULT, done: {}, queued: {} };
  } catch {
    storyQueue = storyQueue || { runs: STORY_RUNS_DEFAULT, done: {}, queued: {} };
  }
  storyQueueAt = Date.now();
  storyQueueBusy = false;
  if (state.model) maybeRender({ soft: true });
}

/* 下一次 Claude 排程執行（台北時間）與預計完成時間 */
function nextStoryRun(runs) {
  const now = new Date();
  const ymd = taipeiYmd(now);
  const list = (runs && runs.length ? runs : STORY_RUNS_DEFAULT).slice().sort();
  for (let add = 0; add < 2; add += 1) {
    const day = add ? addDays(ymd, 1) : ymd;
    for (const hm of list) {
      const at = new Date(`${day}T${hm}:00+08:00`);
      if (at > now) return { start: at, ready: new Date(at.getTime() + STORY_RUN_MINUTES * 60000) };
    }
  }
  return null;
}

function hm(d) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function storyRequestUrl(model) {
  const title = `故事卡：${model.home.rawName} vs ${model.away.rawName}（${model.home.name} 對 ${model.away.name}）`;
  const body = [
    "請幫這場比賽做查證過的故事卡。",
    "",
    `- event: ${model.id}`,
    `- league: ${model.leagueSlug}`,
    `- home: ${model.home.id} ${model.home.rawName}（${model.home.name}）`,
    `- away: ${model.away.id} ${model.away.rawName}（${model.away.name}）`,
    `- kickoff: ${model.kickoff}`,
    `- page: ${location.href.split("#")[0]}`
  ].join("\n");
  return `https://github.com/${STORY_REPO}/issues/new?labels=story-request&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

async function refreshStory(model) {
  cardStore.files.clear();
  cardStore.index = null;
  state.cards = null;
  const key = `${model.home.id}-${model.away.id}`;
  storyStore.delete(key);
  try { localStorage.removeItem(STORY_PREFIX + key); } catch { /* 略過 */ }
  await loadStoryQueue(true);
  if (typeof ensureCards === "function") ensureCards(model);
  maybeRender({ soft: true });
}

function storyQueueBlock(model) {
  loadStoryQueue(false);
  const q = storyQueue || { runs: STORY_RUNS_DEFAULT, done: {}, queued: {} };
  const done = q.done?.[model.id];
  const queued = q.queued?.[model.id];
  const teamsDone = [model.home.id, model.away.id].filter((id) => q.teams?.[id]);
  const next = nextStoryRun(q.runs);
  const box = h("div", { class: "story-queue" });
  let msg;
  let cls = "";
  if (done) {
    msg = `✅ 查證故事卡已產生（${done.at ? hm(new Date(done.at)) : ""}，${done.count || "數"} 張），已放進下方「兩隊之間」與知識卡。`;
    cls = "ok";
  } else if (queued) {
    msg = `⏳ 已排入，預計 ${next ? hm(next.ready) : "下一輪"} 前完成（Claude 每天 ${q.runs.join("、")} 開始查證，約 ${STORY_RUN_MINUTES} 分鐘）。時間到按「重新整理故事」。`;
    cls = "wait";
  } else {
    msg = `尚未排入。${teamsDone.length ? `（${teamsDone.map((id) => (id === model.home.id ? model.home.name : model.away.name)).join("、")}已有舊故事卡，可重複使用）` : ""}按「排入故事卡」送出請求，下一輪 ${next ? hm(next.start) : ""} 開始查證，預計 ${next ? hm(next.ready) : ""} 前可用。`;
  }
  box.className = `story-queue ${cls}`;
  box.append(h("p", null, ui(msg)));
  const kick = new Date(model.kickoff);
  if (!done && next && next.ready > kick && model.minute?.phase === "pre") box.append(h("p", { class: "warn" }, ui(`⚠️ 開賽時間 ${hm(kick)} 早於預計完成時間，這場可能來不及，先用下方自動整理的內容。`)));
  const actions = h("div", { class: "chips" },
    h("button", { class: "chip", onclick: () => refreshStory(model) }, ui("🔄 重新整理故事")),
    done ? null : h("a", { class: "chip", href: storyRequestUrl(model), target: "_blank", rel: "noopener" }, ui(queued ? "補充需求" : "📝 排入故事卡")));
  box.append(actions);
  if (!done && !queued) box.append(h("p", { class: "faint" }, ui("按「排入故事卡」會開啟 GitHub 已填好的請求，按 Submit 送出即可。另外，國際賽與五大聯賽的焦點戰，Claude 每輪也會主動挑幾場先做。")));
  if (q.updated) box.append(h("p", { class: "faint" }, ui(`排程最後更新：${hm(new Date(q.updated))}`)));
  return box;
}

function historyBlock(model) {
  const block = h("section", { class: "block", id: "history" }, h("h2", null, ui("兩隊故事與看點")));
  block.append(storyQueueBlock(model));
  const st = storyOf(model);
  if (!st) { block.append(h("p", { class: "muted" }, ui("整理兩隊的歷史、紀錄與恩怨中…"))); return block; }
  const say = [];
  /* 兩隊交集放最前面：觀眾最愛聽 */
  const cur = curatedCards(model);
  const rivalCards = cur.filter((c) => String(c.owner || "").includes(" vs "));
  const cross = [
    ...rivalCards.map((c) => `${c.title}：${c.fact}`),
    ...(st.rivalry ? [`${st.rivalry.title}：${String(st.rivalry.text).split(/(?<=[。.])/).slice(0, 2).join("")}`] : []),
    ...st.cross, ...h2hLines(model), ...contrastLines(model, st)
  ];
  block.append(h("h3", null, ui("⚔️ 兩隊之間")));
  if (cross.length) {
    block.append(h("ul", { class: "reasons" }, cross.map((x) => h("li", null, ui(x)))));
    say.push(rivalCards[0]?.say || `說到這兩隊之間：${cross.slice(0, 2).join("")}`);
  } else {
    block.append(h("p", { class: "faint" }, ui("維基百科和 ESPN 都沒有兩隊直接交手的故事，這種「初次見面」反而好聊：誰先適應對方，誰就拿下主動權。")));
  }
  for (const side of ["home", "away"]) {
    const s = st[side];
    const name = model[side].name;
    block.append(h("h3", null, ui(`${side === "home" ? "🏠" : "✈️"} ${name}`)));
    if (!s) { block.append(h("p", { class: "muted" }, ui("維基百科沒有找到這支球隊。"))); continue; }
    const picks = cur.filter((c) => c.owner === name && c.topic !== "球員");
    if (picks.length) block.append(h("ul", { class: "reasons" }, picks.map((c) => h("li", null, h("b", null, ui(c.title + "：")), ui(c.fact)))));
    if (s.info.length) block.append(h("div", { class: "chips" }, s.info.map((x) => h("span", { class: "pill" }, ui(x)))));
    if (s.stories.length) block.append(h("ul", { class: "reasons" }, s.stories.map((x) => h("li", null, ui(x)))));
    if (s.honors.length) block.append(h("p", { class: "faint" }, ui("🏆 榮譽：" + s.honors.join("；"))));
    if (!s.info.length && !s.stories.length) block.append(h("p", { class: "faint" }, ui("條目內容太少，整理不出亮點。")));
    block.append(h("p", { class: "faint kc-src" }, ui(`來源：維基百科「${s.title}」 · `), h("a", { href: s.url, target: "_blank", rel: "noopener" }, ui("看完整條目"))));
    const hook = s.info.find((x) => /綽號/.test(x));
    const hit = picks[0]?.say || s.stories.find((x) => x.length <= 95) || "";
    const worst = s.info.find((x) => /最慘一敗/.test(x));
    const best = s.info.find((x) => /最大勝仗/.test(x));
    const line = [hook ? `${name}${hook.split("、")[0]}${hook.includes("、") ? "」" : ""}` : "", hit || "", worst ? `${worst}，那一場大概是隊史不能提的傷疤` : best || ""].filter(Boolean).join("；");
    if (line) say.push(`${name}有什麼故事？${line}。`);
  }
  if (say.length) block.append(scriptBlock([...say, "這兩隊你比較想看誰寫下新故事？主隊扣 1、客隊扣 2！"], "口播：兩隊故事"));
  block.append(h("p", { class: "faint" }, ui("自動從維基百科繁體版挑出含「冠軍、首次、紀錄、德比、爆冷、衝突、綽號」等有梗的句子，以及兩隊條目中提到對方的段落。維基百科可公開編輯，數字播前請點連結確認。")));
  return block;
}

function storyCards(model) {
  const st = storyOf(model);
  if (!st) return [];
  const today = taipeiYmd(new Date());
  const cards = [];
  const cross = [...st.cross];
  if (st.rivalry) cross.unshift(`${st.rivalry.title}：${String(st.rivalry.text).split(/(?<=[。.])/).slice(0, 2).join("")}`);
  cross.slice(0, 3).forEach((x, i) => cards.push({
    id: `cross-${model.home.id}-${model.away.id}-${i}`, topic: "球隊", owner: `${model.home.name} vs ${model.away.name}`, auto: true,
    title: "兩隊之間的故事", fact: x.slice(0, 140), sources: [{ name: "維基百科", url: st.home?.url || st.away?.url || "" }], checked: today,
    say: `來點兩隊之間的故事：${x}今天這一頁要怎麼寫，就看九十分鐘。`,
    humor: { light: "兩隊這段緣分，比偶像劇還有梗。", spicy: "這種舊帳，今天場上一定會有人想討回來。" },
    ask: "你覺得這段歷史會影響今天的氣勢嗎？", when: ["開場", "中場"],
    eff: { status: "需更新", why: "維基百科內容，播前請確認" }
  }));
  for (const side of ["home", "away"]) {
    const s = st[side];
    if (!s) continue;
    const name = model[side].name;
    [...s.info.filter((x) => /綽號|最慘一敗|最大勝仗|射手王|出場王|第一場/.test(x)).map((x) => `${name}${x}。`), ...s.stories].slice(0, 3).forEach((x, i) => cards.push({
      id: `story-${model[side].id}-${i}`, topic: /綽號/.test(x) ? "文化" : "球隊", owner: name, auto: true,
      title: `${name}冷知識`, fact: x.slice(0, 140), sources: [{ name: `維基百科：${s.title}`, url: s.url }], checked: today,
      say: `你知道嗎？${x}`,
      humor: { light: `${name}的故事，比我的人生還精彩。`, spicy: `歷史再精彩，今天踢不好一樣被罵。` },
      ask: `這段${name}的故事你聽過嗎？聽過的扣 1！`, when: i ? ["冷場", "暫停"] : ["開場", "冷場"],
      eff: { status: "需更新", why: "維基百科內容，播前請確認" }
    }));
  }
  return cards;
}
