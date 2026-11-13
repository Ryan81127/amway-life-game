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
  slims.forEach(({ slim }, i) => {
    const rows = slim?.pm?.[teamId];
    if (!rows || !rows.length) return;
    games += 1;
    if (!lastSquad) {
      lastSquad = new Set(rows.map((r) => r.id));
      lastReds = new Set(rows.filter((r) => r.r).map((r) => r.id));
    }
    for (const r of rows) {
      const u = usage.get(r.id) || { id: r.id, en: r.en, apps: 0, starts: 0, min: 0, g: 0, a: 0, y: 0, squads: 0, idx: [] };
      u.squads += 1;
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
    tiStore.set(key, { status: "ok", at: Date.now(), national, ...Object.fromEntries(sides) });
  } catch (err) {
    console.error(err);
    tiStore.set(key, { status: "error" });
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
    list.push({ id, en, name: playerZh(en), p, u, score });
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
  return bits.join("；");
}

function starsBlock(model) {
  const block = h("section", { class: "block", id: "stars" }, h("h2", null, ui("知名球員介紹")));
  const ti = teamInfo(model);
  if (!ti || ti.status === "loading") { block.append(h("p", { class: "muted" }, ui("讀取球員名單與近 5 場出場紀錄中…"))); return block; }
  if (ti.status !== "ok") { block.append(h("p", { class: "muted" }, ui("球員資料暫時無法取得。"))); return block; }
  const lines = [];
  for (const side of ["home", "away"]) {
    const stars = starList(model, side, ti);
    block.append(h("h3", null, ui(model[side].name)));
    if (!stars.length) { block.append(h("p", { class: "muted" }, ui("ESPN 沒有這隊的名單與出場資料。"))); continue; }
    const rows = stars.map((s) => {
      const p = s.p;
      const meta = [p?.pos ? posZh(p.pos) || p.pos : "", p?.age ? `${p.age} 歲` : "", p?.nat || "", p?.jersey ? `#${p.jersey}` : ""].filter(Boolean).join(" · ");
      const today = todayStatus(model, side, s.id);
      return h("div", { class: "cp" },
        h("div", { class: "kc-head" }, h("strong", null, s.name), s.name !== s.en ? h("span", { class: "faint" }, s.en) : null, today ? h("span", { class: today.includes("未進") ? "tag-bad" : "tag-val" }, ui(today)) : null),
        meta ? h("p", { class: "faint" }, ui(meta)) : null,
        h("p", null, ui(starLine(model, side, s, ti) || "ESPN 只有名單，沒有這位球員的出場數據。")));
    });
    block.append(...rows);
    const sq = ti[side].squad;
    if (sq) block.append(squadValueBlock(model, side, sq));
    else block.append(h("p", { class: "faint" }, ui(`💰 ${model[side].name}的球員身價還沒建檔：按「兩隊故事」區的「📋 複製故事卡請求」，Claude 製作故事卡時會一併查 Transfermarkt 身價。`)));
    const top = stars[0];
    if (top) {
      const p = top.p;
      const u = top.u;
      lines.push(`${model[side].name}最值得注意的是 ${top.name}${p?.hasStats ? `，本季出場 ${p.apps} 次、${p.goals} 球 ${p.assists} 助攻` : ""}${u ? `，近 ${ti[side].recent.games} 場踢了 ${u.min} 分鐘` : ""}。`);
    }
  }
  if (lines.length) block.append(scriptBlock([...lines, "你覺得今天誰會是場上最亮的那個人？留言說名字！"], "口播：球星介紹"));
  block.append(h("p", { class: "faint" }, ui("本季數據來自 ESPN 球隊名單（ESPN 不提供本季出場分鐘）；分鐘數是看板從近 5 場賽後名單逐場加總（先發算到被換下、替補從上場算起，傷停補時不計）。")));
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
      cards.push({
        id: `star-${s.id}`, topic: "球員", owner: team.name, auto: true,
        title: `${s.name}：${team.name}關鍵人物`, fact: `${s.name}（${s.en}）${line}。`,
        sources: [{ name: "ESPN 球隊名單", url: `https://www.espn.com/soccer/team/squad/_/id/${team.id}` }], checked: today,
        say: `${team.name}這邊要盯緊 ${s.name}。${line}。他狀態好不好，直接決定${team.name}的上限。`,
        humor: { light: `${s.name}在隊上的地位，大概跟我家的 Wi-Fi 一樣：沒有他什麼都不順。`, spicy: `對手今天的防守計畫，第一頁應該只寫了 ${s.name} 三個字。` },
        ask: `${s.name}今天會進球嗎？會的扣 1！`,
        when: ["開場", "暫停", "中場"],
        eff: { status: "已查證", why: "ESPN 即時資料" }
      });
    }
  }
  return cards;
}
