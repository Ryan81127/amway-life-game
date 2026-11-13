/* 球隊資料：傷兵／缺陣名單、知名球員（本季數據＋近 5 場出場時間）、球隊歷史（維基百科）。 */

const TI_PREFIX = "fb-ti-v1:";
const WIKI_PREFIX = "fb-wiki-v1:";
const NATIONAL_LEAGUES = /^(fifa|uefa\.nations|uefa\.euro|afc\.|caf\.|concacaf\.|conmebol\.)/;

const COUNTRY_ZH = {
  England: "英格蘭", Scotland: "蘇格蘭", Wales: "威爾斯", "Northern Ireland": "北愛爾蘭", Ireland: "愛爾蘭", "Republic of Ireland": "愛爾蘭",
  France: "法國", Germany: "德國", Spain: "西班牙", Italy: "義大利", Portugal: "葡萄牙", Netherlands: "荷蘭", Belgium: "比利時",
  Brazil: "巴西", Argentina: "阿根廷", Uruguay: "烏拉圭", Colombia: "哥倫比亞", Chile: "智利", Ecuador: "厄瓜多", Paraguay: "巴拉圭", Peru: "秘魯", Venezuela: "委內瑞拉", Mexico: "墨西哥",
  "United States": "美國", USA: "美國", Canada: "加拿大", Japan: "日本", "South Korea": "南韓", "Korea Republic": "南韓", China: "中國", "China PR": "中國", "Chinese Taipei": "中華台北", Taiwan: "台灣",
  Australia: "澳洲", Croatia: "克羅埃西亞", Serbia: "塞爾維亞", Denmark: "丹麥", Sweden: "瑞典", Norway: "挪威", Finland: "芬蘭", Iceland: "冰島", Poland: "波蘭",
  Switzerland: "瑞士", Austria: "奧地利", "Czech Republic": "捷克", Czechia: "捷克", Slovakia: "斯洛伐克", Slovenia: "斯洛維尼亞", Hungary: "匈牙利", Romania: "羅馬尼亞", Greece: "希臘", Turkey: "土耳其", Türkiye: "土耳其", Ukraine: "烏克蘭", Georgia: "喬治亞",
  Morocco: "摩洛哥", Senegal: "塞內加爾", Nigeria: "奈及利亞", Ghana: "迦納", "Ivory Coast": "象牙海岸", "Côte d'Ivoire": "象牙海岸", Cameroon: "喀麥隆", Egypt: "埃及", Algeria: "阿爾及利亞", Tunisia: "突尼西亞", Mali: "馬利", Guinea: "幾內亞",
  "Saudi Arabia": "沙烏地阿拉伯", Iran: "伊朗", Qatar: "卡達", Iraq: "伊拉克", Uzbekistan: "烏茲別克", Kyrgyzstan: "吉爾吉斯", "Kyrgyz Republic": "吉爾吉斯", Thailand: "泰國", Vietnam: "越南", Indonesia: "印尼", Malaysia: "馬來西亞", Singapore: "新加坡", Philippines: "菲律賓", India: "印度",
  Jamaica: "牙買加", "Bosnia-Herzegovina": "波士尼亞", "Bosnia and Herzegovina": "波士尼亞", Albania: "阿爾巴尼亞", Kosovo: "科索沃", "North Macedonia": "北馬其頓", Montenegro: "蒙特內哥羅", Israel: "以色列", "New Zealand": "紐西蘭"
};

const INJ_STATUS_ZH = { Out: "確定缺陣", Doubtful: "不太可能出賽", Questionable: "出賽成疑", "Day-To-Day": "每日觀察", Suspended: "停賽", Suspension: "停賽", Injured: "受傷" };
const INJ_PART_ZH = { Ankle: "腳踝", Knee: "膝蓋", Foot: "腳掌", Hamstring: "大腿後側", Groin: "鼠蹊", Thigh: "大腿", Calf: "小腿", Back: "背部", Hip: "髖部", Shoulder: "肩膀", Achilles: "阿基里斯腱", Head: "頭部", Concussion: "腦震盪", Illness: "生病", Muscle: "肌肉", Leg: "腿部", Toe: "腳趾", Wrist: "手腕", Hand: "手部", Knock: "碰撞傷" };
function injZh(text, map) {
  return String(text || "").split(" ").map((w) => map[w] || w).join(" ");
}

const tiStore = new Map();
const S2T = {};
for (const [tw, cn] of Object.entries(typeof HAN === "object" ? HAN : {})) if (!S2T[cn]) S2T[cn] = tw;
function toTw(text) {
  return String(text || "").replace(/[\u3400-\u9fff]/g, (ch) => S2T[ch] || ch);
}

function tiKey(model) {
  return model.leagueSlug + ":" + model.id;
}

function statMap(athlete) {
  const out = {};
  for (const cat of athlete.statistics?.splits?.categories || []) {
    for (const s of cat.stats || []) out[s.name] = Number(s.value) || 0;
  }
  return out;
}

async function fetchRoster(league, teamId, national) {
  const tries = [league];
  if (national) tries.push("fifa.friendly", "fifa.worldq.afc", "fifa.worldq.uefa", "fifa.worldq.conmebol", "fifa.worldq.concacaf", "fifa.worldq.caf", "afc.asian.cup");
  let fallback = null;
  for (const lg of [...new Set(tries)]) {
    try {
      const data = await fetchJson(`${API}/${lg}/teams/${teamId}/roster`);
      const list = data.athletes || [];
      if (!list.length) continue;
      const parsed = {
        league: lg,
        season: data.season?.displayName || "",
        players: list.map((a) => {
          const en = a.displayName || a.fullName || "";
          const st = statMap(a);
          return {
            id: String(a.id || ""),
            en,
            name: playerZh(en),
            jersey: a.jersey || "",
            pos: a.position?.abbreviation || "",
            posName: a.position?.displayName || "",
            age: a.age || null,
            cm: heightCm(a.displayHeight, a.height),
            born: birthYear(a),
            slug: a.slug || "",
            headshot: a.headshot?.href || "",
            espn: playerCardUrl(a),
            nat: COUNTRY_ZH[a.citizenship] || a.citizenship || "",
            active: !a.status || a.status.type === "active",
            statusText: a.status?.name || "",
            injuries: (a.injuries || []).map((i) => ({
              status: injZh(i.status || i.type?.description || "", INJ_STATUS_ZH),
              detail: injZh([i.details?.type, i.details?.detail].filter(Boolean).join(" "), INJ_PART_ZH),
              ret: i.details?.returnDate || "",
              date: i.date || ""
            })),
            apps: st.appearances || 0,
            subIns: st.subIns || 0,
            goals: st.totalGoals || 0,
            assists: st.goalAssists || 0,
            shots: st.totalShots || 0,
            sot: st.shotsOnTarget || 0,
            yc: st.yellowCards || 0,
            rc: st.redCards || 0,
            saves: st.saves || 0,
            conceded: st.goalsConceded || 0,
            hasStats: Object.keys(st).length > 0
          };
        })
      };
      if (parsed.players.some((p) => p.apps > 0)) return parsed;
      if (!fallback) fallback = parsed;
    } catch { /* 換下一個聯賽再試 */ }
  }
  return fallback || { league, season: "", players: [] };
}

/* 近 5 場：每位球員出場數、先發數、分鐘、進球、助攻，以及最近一場是否在名單 */
async function recentUsage(model, side, signal) {
  const teamId = model[side].id;
  const kick = new Date(model.kickoff || Date.now()).getTime();
  const list = ((model.formIds || []).find((b) => b.id === teamId)?.events || [])
    .filter((ev) => ev.id !== model.id && (!ev.date || new Date(ev.date).getTime() < kick)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
  const lim = pLimit(3);
  const slims = await Promise.all(list.map((ev) => lim(async () => {
    try { return { ev, slim: await fetchSlim(ev.id, signal) }; } catch { return { ev, slim: null }; }
  })));
  const usage = new Map();
  let games = 0;
  let lastSquad = null;
  let lastReds = new Set();
  slims.forEach(({ ev, slim }, i) => {
    const rows = slim?.pm?.[teamId];
    if (!rows || !rows.length) return;
    games += 1;
    if (!lastSquad) {
      lastSquad = new Set(rows.map((r) => r.id));
      lastReds = new Set(rows.filter((r) => r.r).map((r) => r.id));
    }
    for (const r of rows) {
      const u = usage.get(r.id) || { id: r.id, en: r.en, apps: 0, starts: 0, min: 0, g: 0, a: 0, y: 0, squads: 0, idx: [], log: [] };
      u.squads += 1;
      u.log.push({ date: String(ev?.date || "").slice(0, 10), min: r.m || 0, g: r.g || 0, a: r.a || 0, st: r.st ? 1 : 0 });
      if (r.m > 0) { u.apps += 1; u.min += r.m; u.idx.push(i); }
      if (r.st) u.starts += 1;
      u.g += r.g; u.a += r.a; u.y += r.y;
      usage.set(r.id, u);
    }
  });
  return { games, usage, lastSquad, lastReds, lastDate: list[0]?.date || "" };
}

function wikiCacheGet(id) {
  try {
    const raw = JSON.parse(localStorage.getItem(WIKI_PREFIX + id) || "null");
    if (raw && Date.now() - raw.t < 30 * 86400000) return raw.v;
  } catch { /* 略過 */ }
  return undefined;
}

function wikiCacheSet(id, v) {
  try { localStorage.setItem(WIKI_PREFIX + id, JSON.stringify({ t: Date.now(), v })); } catch { /* 略過 */ }
}

async function wikiHistory(team, national) {
  const cached = wikiCacheGet(team.id);
  if (cached !== undefined) return cached;
  const q = national ? `${team.rawName} national football team` : `${team.rawName} football club`;
  let out = null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=langlinks%7Cextracts&lllang=zh&exintro=1&explaintext=1&exsentences=5`;
    const en = await fetch(url).then((r) => r.json());
    const page = en.query?.pages?.[0];
    if (page) {
      const zhTitle = page.langlinks?.[0]?.title;
      if (zhTitle) {
        const zh = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(zhTitle)}`, { headers: { "Accept-Language": "zh-tw" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (zh?.extract) out = { lang: "zh", title: toTw(zh.title || zhTitle), text: zh.extract, url: zh.content_urls?.desktop?.page || `https://zh.wikipedia.org/wiki/${encodeURIComponent(zhTitle)}` };
      }
      if (!out && page.extract) out = { lang: "en", title: page.title, text: page.extract, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
    }
  } catch { out = null; }
  wikiCacheSet(team.id, out);
  return out;
}

async function teamFile(model, side) {
  try {
    const idx = await cardIndex();
    const file = idx.teams?.[model[side].id];
    return file ? await cardJson(file) : null;
  } catch {
    return null;
  }
}

async function manualInjuries(model, side) {
  return (await teamFile(model, side))?.injuries || [];
}

async function squadValues(model, side) {
  return (await teamFile(model, side))?.squad || null;
}

function fmtEuro(v) {
  if (!Number.isFinite(v)) return "–";
  if (v >= 1e8) return `€${trimNum(v / 1e8)} 億`;
  if (v >= 1e4) return `€${trimNum(Math.round(v / 1e4))} 萬`;
  return `€${v}`;
}

function squadValueBlock(model, side, sq) {
  const players = (sq.players || []).filter((p) => Number.isFinite(p.value)).sort((a, b) => b.value - a.value);
  if (!players.length) return null;
  const total = sq.total || players.reduce((a, p) => a + p.value, 0);
  const avg = total / (sq.count || players.length);
  return h("details", { class: "fold", "data-k": "sq-" + side, open: true },
    h("summary", null, ui(`💰 ${model[side].name} 身價：總值 ${fmtEuro(total)}、平均 ${fmtEuro(avg)}（${sq.count || players.length} 人）`)),
    predTable(["球員", "位置", "身價"], players.map((p) => ({ cells: [playerZh(p.name) + (playerZh(p.name) !== p.name ? ` ${p.name}` : ""), p.pos ? posZh(p.pos) || p.pos : "", fmtEuro(p.value)] }))),
    h("p", { class: "faint" }, ui(`來源：${sq.source?.name || "Transfermarkt"}（查證 ${sq.checked || "–"}）`), sq.source?.url ? [" · ", h("a", { href: sq.source.url, target: "_blank", rel: "noopener" }, ui("原始頁面"))] : null));
}

async function ensureTeamInfo(model) {
  const key = tiKey(model);
  if (tiStore.has(key)) return;
  tiStore.set(key, { status: "loading" });
  const national = NATIONAL_LEAGUES.test(model.leagueSlug || "");
  const ctl = new AbortController();
  try {
    const sides = await Promise.all(["home", "away"].map(async (side) => {
      const [roster, recent, manual, squad] = await Promise.all([
        fetchRoster(model.leagueSlug, model[side].id, national),
        recentUsage(model, side, ctl.signal),
        manualInjuries(model, side),
        squadValues(model, side)
      ]);
      return [side, { roster, recent, manual, squad }];
    }));
    const pack = { status: "ok", at: Date.now(), national, bios: {}, biosStatus: "loading", ...Object.fromEntries(sides) };
    tiStore.set(key, pack);
    if (state.model?.id === model.id) maybeRender({ soft: true });
    const bios = await loadStarBios(model, pack);
    if (tiStore.get(key) !== pack) return;
    pack.bios = bios;
    pack.biosStatus = "ok";
  } catch (err) {
    if (err?.name === "AbortError") {
      if (tiStore.get(key)?.status === "loading") tiStore.delete(key);
      return;
    }
    console.error(err);
    const cur = tiStore.get(key);
    if (!cur || cur.status === "loading") tiStore.set(key, { status: "error" });
  }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function teamInfo(model) {
  const ti = tiStore.get(tiKey(model));
  if (!ti) { ensureTeamInfo(model); return null; }
  return ti;
}

/* ---------- 知名球員 ---------- */

function starList(model, side, ti) {
  const info = ti[side];
  const usage = info.recent.usage;
  const byId = new Map(info.roster.players.map((p) => [p.id, p]));
  const ids = new Set([...byId.keys(), ...usage.keys()]);
  const list = [];
  for (const id of ids) {
    const p = byId.get(id);
    const u = usage.get(id);
    const en = p?.en || u?.en || "";
    if (!en) continue;
    const score = (p ? p.goals * 3 + p.assists * 2 + p.apps * 0.5 : 0) + (u ? u.min / 90 * 1.4 + (u.g * 2 + u.a) : 0);
    list.push({ id, en, name: typeof shownZh === "function" ? shownZh(en) : playerZh(en), p, u, score });
  }
  const scored = list.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  if (scored.length) return scored;
  /* 沒有任何數據時，至少列出名單上的攻擊球員 */
  const rank = { F: 0, M: 1, D: 2, G: 3 };
  return list.filter((x) => x.p).sort((a, b) => (rank[a.p.pos] ?? 4) - (rank[b.p.pos] ?? 4)).slice(0, 4).map((x) => ({ ...x, rosterOnly: true }));
}

function todayStatus(model, side, id) {
  const players = model.roster?.[side]?.players || [];
  if (!players.length) return "";
  const p = players.find((x) => x.id === id);
  if (!p) return "今日未進大名單";
  return p.starter ? "今日先發" : "今日替補";
}

function starLine(model, side, s, ti) {
  const p = s.p;
  const u = s.u;
  const g = ti[side].recent.games;
  const bits = [];
  if (p?.hasStats) {
    bits.push(`本季（${ti[side].roster.season || "ESPN"}）出場 ${p.apps} 次${p.subIns ? `（替補 ${p.subIns}）` : ""}`);
    bits.push(`${p.goals} 球 ${p.assists} 助攻`);
    if (p.shots) bits.push(`射門 ${p.shots}（射正 ${p.sot}）`);
    if (p.pos === "G" && p.saves) bits.push(`撲救 ${p.saves}、失球 ${p.conceded}`);
    if (p.yc || p.rc) bits.push(`黃牌 ${p.yc}${p.rc ? `、紅牌 ${p.rc}` : ""}`);
  }
  if (u && g) bits.push(`近 ${g} 場上場 ${u.apps} 場（先發 ${u.starts}）共 ${u.min} 分鐘${u.g || u.a ? `、${u.g} 球 ${u.a} 助` : ""}`);
  const trend = trendPack(s, ti[side]).lines[1];
  if (trend) bits.push(trend.replace(/。$/, ""));
  return bits.join("；");
}

const CLUB_ZH = {
  "Al Sadd": "薩德", "Benfica": "本菲卡", "SL Benfica": "本菲卡",
  "Sporting CP": "葡萄牙體育", "Sporting": "葡萄牙體育",
  "Melbourne City": "墨爾本城", "Melbourne City FC": "墨爾本城",
  "Leicester City": "萊斯特城", "Parma": "帕爾馬"
};

const ROLE_LINE = {
  G: "門將。先聽出球，再看禁區裡的第一下反應。",
  GK: "門將。先聽出球，再看禁區裡的第一下反應。",
  D: "後衛。先看他穩不穩，球到了中線再看他敢不敢跟上。",
  M: "中場。節奏在他腳上，進球或助攻都會從這裡起算。",
  F: "前鋒。對方的中衛，今晚第一個要對上的就是他。"
};

function heightCm(display, inches) {
  const m = String(display || "").match(/(\d+)\s*'\s*(\d+)/);
  if (m) return Math.round(Number(m[1]) * 30.48 + Number(m[2]) * 2.54);
  const n = Number(inches);
  return Number.isFinite(n) && n > 40 && n < 90 ? Math.round(n * 2.54) : 0;
}

function birthYear(a) {
  const iso = String(a?.dateOfBirth || "");
  if (/^\d{4}/.test(iso)) return iso.slice(0, 4);
  const m = String(a?.displayDOB || "").match(/(\d{4})/);
  return m ? m[1] : "";
}

function playerCardUrl(a) {
  const link = (a?.links || []).find((l) => (l.rel || []).includes("playercard") && String(l.href || "").startsWith("http"));
  return link?.href || "";
}

function clubZh(name) {
  return CLUB_ZH[name] || name || "";
}

function clubPhrase(name) {
  const zh = clubZh(name);
  if (!zh) return "";
  return /^[\u3400-\u9fff]/.test(zh) ? `效力${zh}` : `效力 ${zh}`;
}

function espnPlayerUrl(id, slug, en) {
  const s = slug || plainKey(en).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://www.espn.com/soccer/player/_/id/${encodeURIComponent(id)}${s ? "/" + s : ""}`;
}

function tmSearchUrl(en) {
  return `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(en || "")}`;
}

function zhWikiSearch(en) {
  return `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(en || "")}`;
}

const WIKI_MEMO = new Map();
const WIKI_QUEUE = [];
let wikiRunning = 0;
let starPaintTimer = 0;

function queueWiki(task) {
  if (task) WIKI_QUEUE.push(task);
  while (wikiRunning < 2 && WIKI_QUEUE.length) {
    const next = WIKI_QUEUE.shift();
    wikiRunning += 1;
    next().finally(() => {
      wikiRunning -= 1;
      queueWiki(null);
    });
  }
}

function scheduleStarPaint() {
  if (starPaintTimer) return;
  starPaintTimer = setTimeout(() => {
    starPaintTimer = 0;
    if (state.model) maybeRender({ soft: true });
  }, 80);
}

function wikiNameClose(en, title) {
  const words = starNameKey(en).split(" ").filter((w) => w.length > 2);
  const page = starNameKey(title);
  if (!words.length || !page) return false;
  const hits = words.filter((w) => page.includes(w));
  return hits.length >= Math.min(2, words.length);
}

function wikiLink(en) {
  const key = plainKey(en);
  if (!key) return { href: zhWikiSearch(en), kind: "search" };
  let hit = WIKI_MEMO.get(key);
  if (!hit) {
    hit = { href: zhWikiSearch(en), kind: "search", status: "loading" };
    WIKI_MEMO.set(key, hit);
    queueWiki(() => resolveWiki(en, key));
  }
  return hit;
}

async function resolveWiki(en, key) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrsearch=${encodeURIComponent(en + " footballer")}&gsrlimit=1&prop=info|langlinks&inprop=url&lllang=zh`;
    let res = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      res = await fetch(url);
      if (res.status !== 429 && res.status !== 503) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!res || !res.ok) throw new Error("wiki");
    const data = await res.json();
    const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
    const hit = WIKI_MEMO.get(key);
    if (!hit) return;
    if (!page || page.missing || !wikiNameClose(en, page.title)) {
      hit.status = "done";
      return;
    }
    const zh = page.langlinks?.[0]?.["*"];
    const href = zh
      ? `https://zh.wikipedia.org/wiki/${encodeURIComponent(String(zh).replace(/ /g, "_"))}`
      : (page.fullurl || hit.href);
    const kind = zh ? "zh" : (page.fullurl ? "en" : "search");
    hit.status = "done";
    if (href !== hit.href || kind !== hit.kind) {
      hit.href = href;
      hit.kind = kind;
      scheduleStarPaint();
    }
  } catch {
    const hit = WIKI_MEMO.get(key);
    if (hit) hit.status = "done";
  }
}

async function fetchAthleteCard(id, league) {
  const urls = [
    `${ATHLETE}/${league}/athletes/${id}`,
    `https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${id}`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const a = data?.athlete;
      if (!a || (!a.displayName && !a.id)) continue;
      return {
        club: a.team?.displayName || "",
        headshot: a.headshot?.href || "",
        espn: playerCardUrl(a),
        pos: a.position?.abbreviation || "",
        age: a.age || null,
        cm: heightCm(a.displayHeight, a.height),
        born: birthYear(a)
      };
    } catch { /* 換下一個位址 */ }
  }
  return null;
}

async function loadStarBios(model, ti) {
  const ids = [];
  for (const side of ["home", "away"]) {
    if (!ti[side]) continue;
    for (const s of starList(model, side, ti)) {
      if (s.id && !ids.includes(s.id)) ids.push(s.id);
    }
  }
  const lim = pLimit(4);
  const pairs = await Promise.all(ids.map((id) => lim(async () => [id, await fetchAthleteCard(id, model.leagueSlug)])));
  const bios = {};
  for (const [id, bio] of pairs) if (bio) bios[id] = bio;
  return bios;
}

function trendPack(s, info) {
  const tags = [];
  const extra = [];
  const u = s.u;
  const games = info?.recent?.games || 0;
  if (!u || !games) return { tags, lines: [] };
  const log = u.log || [];
  const played = log.filter((g) => g.min > 0);
  const prod = (u.g || u.a) ? `${u.g} 球 ${u.a} 助攻` : "";
  let summary;
  if (!u.apps) summary = `近 ${games} 場都沒有上場。`;
  else if (games === 1) summary = `近 1 場踢了 ${u.min} 分鐘${prod ? "，" + prod : ""}。`;
  else if (u.apps === games && u.starts === games) summary = `近 ${games} 場全部先發，合計 ${u.min} 分鐘${prod ? "，" + prod : ""}。`;
  else summary = `近 ${games} 場上場 ${u.apps} 場、先發 ${u.starts} 場，合計 ${u.min} 分鐘${prod ? "，" + prod : ""}。`;
  if (played.length >= 2) {
    const streak = (pred) => {
      let n = 0;
      for (const g of played) {
        if (pred(g)) n += 1;
        else break;
      }
      return n;
    };
    const gs = streak((g) => g.g > 0);
    const as = streak((g) => g.a > 0);
    const both = streak((g) => g.g + g.a > 0);
    const blank = streak((g) => g.g + g.a === 0);
    if (gs >= 2) extra.push(`連續 ${gs} 場上場都有進球。`);
    else if (as >= 2) extra.push(`連續 ${as} 場上場都有助攻。`);
    else if (both >= 3) extra.push(`近 ${both} 場上場都有進球或助攻。`);
    else if (blank >= 3 && (s.p?.pos === "F" || s.p?.pos === "M")) extra.push(`近 ${blank} 場上場沒有進球，也沒有助攻。`);
    const mins = played.reduce((n, g) => n + g.min, 0);
    const goals = played.reduce((n, g) => n + g.g, 0);
    if (mins >= 120 && goals > 0) extra.push(`這段每 90 分鐘 ${trimNum(goals * 90 / mins)} 球。`);
    if (played.length >= 4) {
      const mid = Math.ceil(played.length / 2);
      const older = played.slice(mid);
      const recent = played.slice(0, mid);
      if (older.length) {
        const avg = (arr, pick) => arr.reduce((n, g) => n + pick(g), 0) / arr.length;
        const rP = avg(recent, (g) => g.g + g.a);
        const oP = avg(older, (g) => g.g + g.a);
        if (rP - oP >= 0.5) {
          tags.push("進攻上升");
          extra.push("進球加助攻的頻率在往上走。");
        } else if (oP - rP >= 0.5) {
          tags.push("進攻下滑");
          extra.push("進球加助攻的頻率在往下走。");
        }
      }
    }
  }
  /* 上場時間要把 0 分鐘的替補算進去。只看有上場的場次，會把最近兩場坐板凳的人說成時間變多。 */
  if (log.length >= 3) {
    const mid = Math.ceil(log.length / 2);
    const recent = log.slice(0, mid);
    const older = log.slice(mid);
    if (older.length) {
      const avgMin = (arr) => arr.reduce((n, g) => n + g.min, 0) / arr.length;
      const rMin = avgMin(recent);
      const oMin = avgMin(older);
      if (rMin - oMin >= 12) {
        tags.push("上場變多");
        extra.push(`上場時間在往上走，近段場均 ${Math.round(rMin)} 分鐘，再之前 ${Math.round(oMin)} 分鐘。`);
      } else if (oMin - rMin >= 12) {
        tags.push("上場變少");
        extra.push(`上場時間在往下走，近段場均 ${Math.round(rMin)} 分鐘，再之前 ${Math.round(oMin)} 分鐘。`);
      }
    }
  }
  return { tags, lines: [summary, ...extra].slice(0, 3) };
}

function starBio(s, ti) {
  return (ti.bios || {})[s.id] || {};
}

function identityBits(s, bio) {
  const p = s.p || {};
  const bits = [];
  const age = p.age || bio.age;
  const year = p.born || bio.born;
  if (age) bits.push(`${age} 歲`);
  else if (year) bits.push(`${year} 年生`);
  const pos = p.pos || bio.pos;
  if (pos && posZh(pos)) bits.push(posZh(pos));
  const cm = p.cm || bio.cm;
  if (cm) bits.push(`${cm} 公分`);
  if (bio.club) bits.push(clubPhrase(bio.club));
  return bits;
}

function askLine(name, pos) {
  if (pos === "G" || pos === "GK") return `你覺得 ${name} 今天守得住零封嗎？守得住的扣 1！`;
  if (pos === "D") return `你覺得 ${name} 今天會不會送出關鍵解圍或助攻？會的扣 1！`;
  if (pos === "M") return `你覺得 ${name} 今天是先送助攻，還是自己破門？留言選一個！`;
  if (pos === "F") return `你覺得 ${name} 今天碰得進球門嗎？會的扣 1！`;
  return `今天的鏡頭，你會給 ${name} 嗎？會的扣 1！`;
}

function anchorLines(model, side, s, ti) {
  const p = s.p;
  const bio = starBio(s, ti);
  const prof = typeof starProfile === "function" ? starProfile(s.id, s.en) : null;
  const lines = [];
  const season = [];
  if (p?.hasStats) {
    let apps = `本季出場 ${trimNum(p.apps)} 次、${trimNum(p.goals)} 球 ${trimNum(p.assists)} 助攻`;
    if (p.subIns && p.apps && Number(p.subIns) === Number(p.apps)) apps += `，這 ${trimNum(p.apps)} 次都是替補`;
    else if (p.subIns) apps += `，替補 ${trimNum(p.subIns)} 次`;
    season.push(apps);
    if (p.shots >= 4) season.push(`射門 ${trimNum(p.shots)}、射正 ${trimNum(p.sot)}`);
    if ((p.pos === "G" || p.pos === "GK") && (p.saves || p.conceded)) season.push(`撲救 ${trimNum(p.saves)}、失球 ${trimNum(p.conceded)}`);
  }
  const today = todayStatus(model, side, s.id);
  const head = [s.name, today].filter(Boolean).join("，");
  if (season.length) lines.push(`${head}。${season.join("，")}。`);
  else lines.push(`${head}。`);
  const trend = trendPack(s, ti[side]);
  lines.push(...trend.lines);
  const who = identityBits(s, bio);
  if (who.length) lines.push(who.join("，") + "。");
  if (prof?.say) lines.push(prof.say.endsWith("。") ? prof.say : `${prof.say}。`);
  else if (ROLE_LINE[p?.pos || bio.pos || ""]) lines.push(ROLE_LINE[p?.pos || bio.pos]);
  if (!p?.hasStats && !trend.lines.length) lines.push("ESPN 目前沒有足夠的出場數字。");
  lines.push(askLine(s.name, p?.pos || bio.pos));
  return { lines, trend, prof };
}

function minuteBars(log) {
  const rows = (log || []).slice().reverse();
  if (!rows.length) return null;
  return h("div", { class: "min-bars", title: ui("上場分鐘，由舊到新") }, rows.map((g) => {
    const cls = g.g > 0 ? "goal" : g.a > 0 ? "ast" : "";
    const pct = Math.max(8, Math.min(100, Math.round((g.min || 0) / 90 * 100)));
    const tip = `${g.date || ""} ${g.min} 分鐘${g.g ? ` ${g.g} 球` : ""}${g.a ? ` ${g.a} 助` : ""}`.trim();
    return h("span", { class: `min-bar ${cls}`, title: ui(tip) },
      h("i", { style: `height:${pct}%` }),
      h("b", null, String(g.min || 0)));
  }));
}

function starShot(model, side, s, ti) {
  const match = (model.roster?.[side]?.players || []).find((p) => p.id === s.id);
  return s.p?.headshot || match?.headshot || starBio(s, ti).headshot || "";
}

function starCard(model, side, s, ti, index) {
  const p = s.p || {};
  const bio = starBio(s, ti);
  const shot = starShot(model, side, s, ti);
  const espn = p.espn || bio.espn || (s.id ? espnPlayerUrl(s.id, p.slug, s.en) : "");
  const wiki = s.en ? wikiLink(s.en) : { href: zhWikiSearch(""), kind: "search" };
  const pack = anchorLines(model, side, s, ti);
  const card = h("article", { class: "star-card" + (shot ? " has-photo" : "") });
  if (shot) {
    const img = h("img", { class: "star-photo", src: shot, alt: s.name, loading: "lazy" });
    img.addEventListener("error", () => {
      img.remove();
      card.classList.remove("has-photo");
    });
    card.append(img);
  }
  const today = todayStatus(model, side, s.id);
  const meta = [
    p.pos ? posZh(p.pos) || p.pos : (bio.pos ? posZh(bio.pos) || bio.pos : ""),
    p.age || bio.age ? `${p.age || bio.age} 歲` : "",
    p.cm || bio.cm ? `${p.cm || bio.cm} 公分` : "",
    p.nat || "",
    bio.club ? clubPhrase(bio.club) : ""
  ].filter(Boolean).join(" · ");
  const shirt = String((model.roster?.[side]?.players || []).find((x) => x.id === s.id)?.jersey || p.jersey || "").trim();
  const body = h("div", { class: "star-body" },
    h("div", { class: "kc-head" },
      typeof nameHead === "function" ? nameHead(s.en, shirt) : h("strong", null, s.name),
      today ? h("span", { class: today.includes("未進") ? "tag-bad" : "tag-val" }, ui(today)) : null,
      ...pack.trend.tags.map((tag) => h("span", { class: tag.includes("少") || tag.includes("下滑") ? "tag-bad" : "tag-val" }, ui(tag)))
    ),
    meta ? h("p", { class: "faint" }, ui(meta)) : null,
    h("div", { class: "star-links" },
      h("a", {
        href: wiki.href, target: "_blank", rel: "noopener noreferrer",
        title: ui(wiki.kind === "zh" ? "中文維基" : wiki.kind === "en" ? "英文維基" : "用名字搜尋維基")
      }, ui(wiki.kind === "search" ? "維基搜尋" : "維基")),
      espn ? h("a", { href: espn, target: "_blank", rel: "noopener noreferrer" }, "ESPN") : null,
      s.en ? h("a", { href: tmSearchUrl(s.en), target: "_blank", rel: "noopener noreferrer" }, "Transfermarkt") : null
    ),
    h("p", { class: "star-k" }, h("span", { class: "tag-src" }, "ESPN"), ti[side]?.roster?.season ? h("span", { class: "faint" }, " " + ti[side].roster.season) : null),
    minuteBars(s.u?.log),
    s.u?.log?.length ? h("p", { class: "faint" }, ui("上場分鐘，由舊到新。金色是有進球，綠色是有助攻。")) : null
  );
  const espnText = [p.hasStats ? starLine(model, side, s, ti).split("；").slice(0, 2).join("，") : "", pack.trend.lines[0] || ""].filter(Boolean);
  if (espnText.length) espnText.forEach((line) => body.append(h("p", { class: "star-fact" }, ui(line.endsWith("。") || line.endsWith("；") ? line : line + "。"))));
  else body.append(h("p", { class: "star-fact" }, ui("ESPN 只有名單，沒有這位球員的出場數字。")));
  if (pack.trend.lines.length > 1) pack.trend.lines.slice(1).forEach((line) => body.append(h("p", { class: "star-fact" }, ui(line))));
  if (pack.prof) {
    body.append(h("p", { class: "star-k" },
      h("span", { class: "tag-src cur" }, ui("資料庫")),
      h("span", { class: "faint" }, ` ${ui("查證")} ${pack.prof.checked || ""}`)));
    const posLabel = posZh(p.pos || bio.pos || "");
    const styleBits = (pack.prof.style || []).filter((item) => item && item !== posLabel);
    if (styleBits.length) body.append(h("p", { class: "star-fact" }, ui(styleBits.join("，") + "。")));
    if (pack.prof.honours?.length) body.append(h("ul", { class: "bullets" }, pack.prof.honours.map((item) => h("li", null, ui(item)))));
    if (pack.prof.story) body.append(h("p", { class: "star-fact" }, ui(pack.prof.story)));
    if (pack.prof.sources?.length) {
      body.append(h("p", { class: "faint star-src" }, ui("來源："), ...pack.prof.sources.flatMap((src, i) => [
        i ? " · " : null,
        h("a", { href: src.url, target: "_blank", rel: "noopener noreferrer" }, ui(src.name))
      ])));
    }
  } else body.append(h("p", { class: "faint" }, ui("這位還沒進資料庫，只念 ESPN 的數字跟近況，不另編故事。")));
  body.append(scriptBlock(pack.lines, index === 0 ? "口播：這位先念" : "口播"));
  card.append(body);
  return card;
}

function starsBlock(model) {
  const block = h("section", { class: "block", id: "stars" }, h("h2", null, ui("知名球員介紹")));
  const ti = teamInfo(model);
  if (!ti || ti.status === "loading") { block.append(h("p", { class: "muted" }, ui("讀取球員名單與近 5 場出場紀錄中…"))); return block; }
  if (ti.status !== "ok") { block.append(h("p", { class: "muted" }, ui("球員資料暫時無法取得。"))); return block; }
  block.append(h("p", { class: "faint" }, ui("每位旁邊都有維基、ESPN、Transfermarkt。標 ESPN 的是自動算的，標資料庫的是事先查證的生涯事實。這一段只談球員，不談盤口。")));
  const tops = [];
  for (const side of ["home", "away"]) {
    const stars = starList(model, side, ti);
    if (typeof warmNames === "function") warmNames(stars.map((s) => s.en));
    block.append(h("h3", null, ui(model[side].name)));
    if (!stars.length) { block.append(h("p", { class: "muted" }, ui("ESPN 沒有這隊的名單與出場資料。"))); continue; }
    stars.forEach((s, index) => block.append(starCard(model, side, s, ti, index)));
    const sq = ti[side].squad;
    if (sq) block.append(squadValueBlock(model, side, sq));
    else block.append(h("p", { class: "faint" }, ui(`💰 ${model[side].name}的球員身價還沒建檔：按「兩隊故事」區的「📋 複製故事卡請求」，Claude 製作故事卡時會一併查 Transfermarkt 身價。`)));
    if (stars[0]) tops.push(`${model[side].name}先看 ${stars[0].name}`);
  }
  if (tops.length) block.append(scriptBlock([`${tops.join("，")}。`, "你覺得今天誰會是場上最亮的那個人？留言說名字！"], "口播：點名"));
  block.append(h("p", { class: "faint" }, ui("本季出場、進球、助攻、年齡、身高、頭像與俱樂部來自 ESPN。分鐘與趨勢是看板把近 5 場賽後名單加總（先發算到被換下、替補從上場算起，傷停補時不計）。資料庫只收附了來源的句子，沒有收錄的人不另編故事。")));
  return block;
}

/* ---------- 傷兵／缺陣 ---------- */

function absenceList(model, side, ti) {
  const info = ti[side];
  const out = [];
  const seen = new Set();
  const push = (x) => {
    const k = x.id || x.name;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  };
  for (const m of info.manual) push({ name: playerZh(m.name) || m.name, status: m.status || "傷停", detail: m.detail || "", src: m.source || "知識卡", checked: m.checked || "", kind: "manual" });
  for (const p of info.roster.players) {
    if (p.injuries.length) {
      const i = p.injuries[0];
      push({ id: p.id, name: p.name, status: i.status || "傷停", detail: i.detail, ret: i.ret, src: "ESPN", kind: "espn" });
    } else if (!p.active) push({ id: p.id, name: p.name, status: p.statusText || "非可出賽狀態", src: "ESPN", kind: "espn" });
  }
  const { usage, lastSquad, lastReds, games } = info.recent;
  const today = model.roster?.[side]?.players || [];
  const todaySet = new Set(today.map((p) => p.id));
  const byId = new Map(info.roster.players.map((p) => [p.id, p]));
  const regulars = [...usage.values()].filter((u) => u.starts >= 2 || u.min >= 180);
  for (const u of regulars) {
    const name = playerZh(u.en);
    if (today.length && !todaySet.has(u.id)) push({ id: u.id, name, status: "今日未進大名單", detail: `近 ${games} 場先發 ${u.starts} 次、${u.min} 分鐘的主力`, src: "ESPN 今日名單比對", kind: "infer" });
    else if (!today.length && lastSquad && !lastSquad.has(u.id) && u.idx[0] !== 0) push({ id: u.id, name, status: "上一場未進大名單", detail: `近 ${games} 場先發 ${u.starts} 次；可能傷停、停賽或輪休`, src: "ESPN 近 5 場名單推測", kind: "infer" });
  }
  for (const id of lastReds) {
    const u = usage.get(id);
    push({ id, name: playerZh(u?.en || byId.get(id)?.en || ""), status: "上一場被罰下", detail: "紅牌通常至少停賽一場，請確認聯賽紀律公告", src: "ESPN 上一場紀錄", kind: "infer" });
  }
  for (const p of info.roster.players) {
    if (p.yc >= 4) push({ id: p.id + "-yc", name: p.name, status: `黃牌累積 ${p.yc} 張`, detail: "接近停賽門檻（各聯賽門檻不同）", src: "ESPN 本季數據", kind: "risk" });
  }
  return out;
}

function injuryBlock(model) {
  const block = h("section", { class: "block", id: "injuries" }, h("h2", null, ui("傷兵／缺陣名單")));
  const ti = teamInfo(model);
  if (!ti || ti.status === "loading") { block.append(h("p", { class: "muted" }, ui("比對名單中…"))); return block; }
  if (ti.status !== "ok") { block.append(h("p", { class: "muted" }, ui("名單資料暫時無法取得。"))); return block; }
  const say = [];
  for (const side of ["home", "away"]) {
    const list = absenceList(model, side, ti);
    block.append(h("h3", null, ui(model[side].name)));
    if (!list.length) { block.append(h("p", { class: "faint" }, ui("目前沒有查到缺陣或停賽風險。"))); continue; }
    block.append(predTable(["球員", "狀態", "說明", "來源"], list.map((x) => ({
      cls: x.kind === "infer" || x.kind === "risk" ? "" : "best",
      cells: [x.name, x.status, [x.detail, x.ret ? `預計 ${x.ret.slice(5, 10).replace("-", "/")} 回歸` : ""].filter(Boolean).join("，") || "–", x.src + (x.checked ? ` ${x.checked}` : "")]
    }))));
    const main = list.filter((x) => x.kind !== "risk").slice(0, 3);
    if (main.length) say.push(`${model[side].name}這邊，${main.map((x) => `${x.name}${x.status}`).join("、")}，這會影響今天的輪換。`);
  }
  if (say.length) block.append(scriptBlock([...say, "名單少了人，看的就是板凳深度。你覺得誰影響最大？"], "口播：傷兵與缺陣"));
  block.append(h("p", { class: "faint" }, ui("ESPN 足球多數聯賽不提供傷兵資料，所以這裡分三種：ESPN 有標示的傷停、看板用近 5 場與今日名單比對推測的缺陣（需再確認），以及你在知識卡檔案裡手動補的傷兵。開賽前請用下方連結交叉確認。")));
  const q = `${model.home.rawName} ${model.away.rawName}`;
  block.append(h("div", { class: "link-grid" },
    h("a", { href: `https://www.google.com/search?q=${encodeURIComponent(q + " injuries site:transfermarkt.com")}`, target: "_blank", rel: "noopener" }, "Transfermarkt 傷兵"),
    h("a", { href: `https://www.google.com/search?q=${encodeURIComponent(q + " team news injury")}`, target: "_blank", rel: "noopener" }, ui("賽前隊伍消息")),
    h("a", { href: `https://www.google.com/search?q=${encodeURIComponent(q + " 傷停 懂球帝")}`, target: "_blank", rel: "noopener" }, ui("懂球帝傷停"))
  ));
  return block;
}

/* ---------- 轉成知識卡 ---------- */

function teamInfoCards(model) {
  const ti = tiStore.get(tiKey(model));
  if (!ti || ti.status !== "ok") return [];
  const today = taipeiYmd(new Date());
  const cards = [];
  for (const side of ["home", "away"]) {
    const team = model[side];
    for (const s of starList(model, side, ti).filter((x) => !x.rosterOnly).slice(0, 3)) {
      const line = starLine(model, side, s, ti);
      if (!line) continue;
      const prof = typeof starProfile === "function" ? starProfile(s.id, s.en) : null;
      cards.push({
        id: `star-${s.id}`, topic: "球員", owner: team.name, auto: true,
        title: `${s.name}：${team.name}關鍵人物`, fact: `${s.name}（${s.en}）${line}。`,
        sources: [
          { name: "ESPN 球隊名單", url: `https://www.espn.com/soccer/team/squad/_/id/${team.id}` },
          ...(prof?.sources || [])
        ], checked: prof?.checked || today,
        say: prof?.say
          ? `${team.name}這邊，${s.name}。${line}。${prof.say}`
          : `${team.name}這邊要盯緊 ${s.name}。${line}。他狀態好不好，直接決定${team.name}的上限。`,
        humor: { light: `${s.name}在隊上的地位，大概跟我家的 Wi-Fi 一樣：沒有他什麼都不順。`, spicy: `對手今天的防守計畫，第一頁應該只寫了 ${s.name} 三個字。` },
        ask: `${s.name}今天會進球嗎？會的扣 1！`,
        when: ["開場", "暫停", "中場"],
        eff: { status: "已查證", why: "ESPN 即時資料" }
      });
    }
  }
  return cards;
}
