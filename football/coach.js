/* 兩隊教練：維基百科（球隊條目找出現任教練 → 教練條目的執教經歷與執教戰績表）＋ ESPN 任內戰績。 */

const COACH_PREFIX = "fb-coach-v2:";
const coachStore = new Map();

async function enHtml(title) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  doc.querySelectorAll("style, sup.reference, .reference, .mw-ref").forEach((n) => n.remove());
  return doc;
}

function cleanTxt(n) {
  return String(n?.textContent || "").replace(/\[\w+\]/g, "").replace(/\s+/g, " ").trim();
}

function findCoachLink(doc) {
  const box = doc?.querySelector("table.infobox");
  if (!box) return null;
  for (const tr of box.querySelectorAll("tr")) {
    const th = cleanTxt(tr.querySelector("th"));
    if (!/^(head coach|manager|coach|head manager)$/i.test(th)) continue;
    const a = tr.querySelector("td a[href^='./']");
    const name = cleanTxt(tr.querySelector("td")).replace(/\(.*?\)/g, "").trim();
    return { name, title: a ? decodeURIComponent(a.getAttribute("href").slice(2)).replace(/_/g, " ") : name };
  }
  return null;
}

function coachInfobox(doc) {
  const box = doc.querySelector("table.infobox");
  const out = { born: "", nat: "", managed: [] };
  if (!box) return out;
  let section = "";
  for (const tr of box.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    const td = tr.querySelector("td");
    const head = cleanTxt(th);
    if (th && !td) { section = head; continue; }
    if (/^born$/i.test(head)) out.born = cleanTxt(td).replace(/\(.*/, "").trim();
    if (/managerial career|teams managed/i.test(section) && th && td && /\d{4}/.test(head)) out.managed.push({ years: head, team: cleanTxt(td) });
  }
  return out;
}

/* 榮譽：Honours 章節裡「Manager」小節的條列；沒有分小節就全拿 */
function coachHonours(doc) {
  const sec = [...doc.querySelectorAll("section")].find((x) => /^honou?rs$/i.test(cleanTxt(x.querySelector(":scope > h2"))));
  if (!sec) return [];
  const subs = [...sec.querySelectorAll("section")];
  const mgr = subs.find((x) => /manag|coach/i.test(cleanTxt(x.querySelector(":scope > h3, :scope > h4"))));
  const scope = mgr || (subs.length ? null : sec);
  if (!scope) return [];
  return [...scope.querySelectorAll("li")].map(cleanTxt).filter((t) => t.length > 3 && t.length < 140).slice(0, 12);
}

function playingCareer(doc) {
  const box = doc.querySelector("table.infobox");
  if (!box) return null;
  let section = "";
  const clubs = [];
  let caps = null;
  for (const tr of box.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    const tds = tr.querySelectorAll("td");
    const head = cleanTxt(th);
    if (th && !tds.length) { section = head; continue; }
    if (/senior career/i.test(section) && tds.length && /\d{4}/.test(head)) clubs.push(cleanTxt(tds[0]).replace(/→\s*/, "").replace(/\(loan\)/i, "（租借）"));
    if (/international career/i.test(section) && tds.length >= 2 && /\d{4}/.test(head) && !/U-?\d|under|olympic/i.test(cleanTxt(tds[0]))) caps = `${cleanTxt(tds[0])} ${cleanTxt(tds[1])}`;
  }
  return clubs.length || caps ? { clubs: [...new Set(clubs)].slice(-6), caps } : null;
}

/* 執教戰績表：找含 Win % 的 wikitable，抓每列的 球隊、起訖、場次、勝、和、負、勝率 */
function coachRecord(doc) {
  const table = [...doc.querySelectorAll("table.wikitable")].find((t) => /win\s*%/i.test(t.textContent) && /\bP\b|\bG\b|Pld|\bM\b/.test(t.textContent));
  if (!table) return [];
  const rows = [];
  for (const tr of table.querySelectorAll("tr")) {
    const cells = [...tr.children].map(cleanTxt);
    if (cells.length < 6) continue;
    const pctIdx = cells.length - 1;
    const last = cells[pctIdx].replace(/\s*%$/, "");
    if (!/^\d{1,3}(\.\d+)?$/.test(last) || Number(last) > 100) continue;
    const nums = [];
    for (let i = pctIdx - 1; i >= 0 && nums.length < 8; i -= 1) {
      const v = cells[i].replace(/[+−–]/g, (m) => (m === "+" ? "" : "-"));
      if (/^-?\d+$/.test(v)) nums.unshift(Number(v)); else break;
    }
    if (nums.length < 4) continue;
    /* P W D L [GF GA GD] */
    let at = -1;
    for (let i = 0; i + 3 < nums.length; i += 1) if (nums[i] > 0 && nums[i + 1] + nums[i + 2] + nums[i + 3] === nums[i]) { at = i; break; }
    if (at < 0) continue;
    const [p, w, d, l] = nums.slice(at, at + 4);
    const team = cells[0];
    const dates = cells.filter((c) => /\d{4}|present/i.test(c) && !/^\d+$/.test(c)).slice(0, 2);
    rows.push({ team, from: dates[0] || "", to: dates[1] || "", p, w, d, l, pct: Number(last) });
  }
  return rows;
}

async function zhSummaryFor(enTitle) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(enTitle)}&prop=langlinks&lllang=zh&redirects=1`;
    const zh = (await fetch(url).then((r) => r.json())).query?.pages?.[0]?.langlinks?.[0]?.title;
    if (!zh) return null;
    const s = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(zh)}`, { headers: { "Accept-Language": "zh-tw" } }).then((r) => (r.ok ? r.json() : null));
    return s?.extract ? { name: toTw(s.title || zh), text: s.extract, url: s.content_urls?.desktop?.page } : null;
  } catch {
    return null;
  }
}

/* 用 ESPN 賽程算現任教練任內（從接任日起）的戰績 */
async function tenureRecord(teamId, fromText, kickoff) {
  const from = Date.parse(fromText);
  if (!Number.isFinite(from)) return null;
  try {
    const j = await fetch(`${ALL_API}/teams/${teamId}/schedule`).then((r) => r.json());
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    for (const e of j.events || []) {
      const c = e.competitions?.[0];
      if (!c?.status?.type?.completed) continue;
      const t = Date.parse(e.date);
      if (t < from || t >= Date.parse(kickoff)) continue;
      const me = c.competitors?.find((x) => String(x.id) === String(teamId));
      const op = c.competitors?.find((x) => String(x.id) !== String(teamId));
      const a = Number(me?.score?.value ?? me?.score?.displayValue ?? me?.score);
      const b = Number(op?.score?.value ?? op?.score?.displayValue ?? op?.score);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      gf += a; ga += b;
      if (a > b) w += 1; else if (a === b) d += 1; else l += 1;
    }
    const n = w + d + l;
    return n ? { n, w, d, l, gf, ga } : null;
  } catch {
    return null;
  }
}

async function teamCoach(team, national, kickoff) {
  const cacheKey = COACH_PREFIX + team.id;
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (c && Date.now() - c.t < 3 * 86400000) return c.v;
  } catch { /* 略過 */ }
  const t = await storyZhTitle(team, national);
  if (!t?.en) return null;
  const teamDoc = await enHtml(t.en);
  const link = findCoachLink(teamDoc);
  if (!link) return null;
  const doc = await enHtml(link.title);
  const info = doc ? coachInfobox(doc) : { managed: [] };
  const record = doc ? coachRecord(doc) : [];
  const honours = doc ? coachHonours(doc) : [];
  const playing = doc ? playingCareer(doc) : null;
  const intro = doc ? [...doc.querySelectorAll("section:first-of-type > p")].map(cleanTxt).filter((x) => x.length > 40).slice(0, 1).join(" ") : "";
  const zh = await zhSummaryFor(link.title);
  const cur = record.find((r) => /present/i.test(r.to)) || record.find((r) => r.team && team.rawName && r.team.includes(team.rawName.split(" ")[0]));
  const managedCur = info.managed.slice().reverse().find((m) => /–\s*$|present|–$/.test(m.years) || m.team.includes(team.rawName.split(" ")[0]));
  const since = cur?.from || (managedCur ? managedCur.years.replace(/[–-].*/, "").trim() : "");
  const tenure = since ? await tenureRecord(team.id, /^\d{4}$/.test(since) ? `${since}-01-01` : since, kickoff) : null;
  const v = {
    name: zh?.name || link.name, en: link.name, url: zh?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title)}`,
    zhText: zh?.text || "", enText: intro, born: info.born, managed: info.managed.slice(-8), record: record.slice(-10), since, tenure, honours, playing
  };
  try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v })); } catch { /* 略過 */ }
  return v;
}

async function ensureCoaches(model) {
  const key = `${model.home.id}-${model.away.id}`;
  if (coachStore.has(key)) return;
  coachStore.set(key, { status: "loading" });
  const national = NATIONAL_LEAGUES.test(model.leagueSlug || "");
  const [home, away] = await Promise.all([
    teamCoach(model.home, national, model.kickoff).catch(() => null),
    teamCoach(model.away, national, model.kickoff).catch(() => null)
  ]);
  const [ch, ca] = await Promise.all([curatedCoach(model, "home"), curatedCoach(model, "away")]);
  coachStore.set(key, { status: "ok", home, away, cur: { home: ch, away: ca } });
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

/* 用 ESPN 近況算教練的「數據畫像」：控球、射門、進失球、零封率、常用陣型 */
function coachProfile(model, side, since) {
  const all = chStore.get(model.id)?.all?.[side] || [];
  const from = Date.parse(since || "");
  const games = all.filter((g) => !Number.isFinite(from) || Date.parse(g.date) >= from);
  const use = games.length >= 4 ? games : all;
  if (!use.length) return null;
  const avg = (f) => { const v = use.map(f).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const forms = {};
  for (const g of use) if (g.form) forms[g.form] = (forms[g.form] || 0) + 1;
  const form = Object.entries(forms).sort((a, b) => b[1] - a[1])[0];
  const gf = avg((g) => g.gf);
  const ga = avg((g) => g.ga);
  const poss = avg((g) => g.poss);
  const shots = avg((g) => g.shots);
  const shotsA = avg((g) => g.shotsA);
  const cs = use.filter((g) => g.ga === 0).length / use.length;
  const tags = [];
  if (poss != null) tags.push(poss >= 56 ? `控球型（平均控球 ${trimNum(poss)}%）` : poss <= 44 ? `讓球給對手、打防守反擊（平均控球 ${trimNum(poss)}%）` : `控球均衡（平均 ${trimNum(poss)}%）`);
  if (ga != null) tags.push(ga <= 0.8 ? `防守嚴密：場均只失 ${trimNum(ga)} 球、零封率 ${pct(cs)}` : ga >= 1.6 ? `防線漏洞多：場均失 ${trimNum(ga)} 球` : `場均失 ${trimNum(ga)} 球、零封率 ${pct(cs)}`);
  if (gf != null) tags.push(gf >= 2 ? `進攻火力強：場均進 ${trimNum(gf)} 球` : gf <= 0.9 ? `進攻偏保守：場均進 ${trimNum(gf)} 球` : `場均進 ${trimNum(gf)} 球`);
  if (shots != null && shotsA != null) tags.push(`場均射門 ${trimNum(shots)}、被射 ${trimNum(shotsA)}`);
  if (form) tags.push(`最常用陣型 ${form[0]}（${form[1]}/${use.length} 場）`);
  return { n: use.length, tenureOnly: use === games, gf, ga, poss, cs, form: form?.[0] || "", tags };
}

async function curatedCoach(model, side) {
  return (await teamFile(model, side))?.coach || null;
}

function coachSay(model, side, c, cur, prof) {
  const team = model[side].name;
  const name = cur?.name || c?.name || "";
  const lines = [];
  if (cur?.hook) lines.push(`${team}的教練${name}，${cur.hook}`);
  else if (name) lines.push(`${team}的教練是${name}${c?.playing?.caps ? `，球員時期也是國腳` : ""}。`);
  const ach = cur?.achievements?.[0] || (c?.honours?.length ? `執教生涯拿過 ${c.honours.length} 項榮譽` : "");
  if (ach) lines.push(`他最亮眼的成績：${ach}。`);
  const sty = cur?.style?.[0] || prof?.tags?.[0];
  if (sty) lines.push(`戰術特色：${sty}。`);
  if (c?.tenure) lines.push(`上任以來 ${c.tenure.n} 場 ${c.tenure.w} 勝 ${c.tenure.d} 和 ${c.tenure.l} 負。`);
  if (cur?.watch?.[0]) lines.push(`今晚看他：${cur.watch[0]}`);
  return lines.join("");
}

function coachBlock(model) {
  const key = `${model.home.id}-${model.away.id}`;
  const st = coachStore.get(key);
  if (!st) ensureCoaches(model);
  cornerHist(model);
  const block = h("section", { class: "block", id: "coaches" }, h("h2", null, ui("兩隊教練：誰在場邊下棋")));
  if (!st || st.status === "loading") { block.append(h("p", { class: "muted" }, ui("整理兩隊教練的戰績、榮譽與戰術特色中…"))); return block; }
  const say = [];
  const profs = {};
  for (const side of ["home", "away"]) {
    const c = st[side];
    const cur = st.cur?.[side];
    const team = model[side].name;
    const name = cur?.name || c?.name;
    const card = h("div", { class: "coach-card" });
    card.append(h("h3", null, ui(`${side === "home" ? "🏠" : "✈️"} ${team}｜${name || "教練資料待補"}`)));
    if (!c && !cur) { card.append(h("p", { class: "muted" }, ui("維基百科找不到這隊的現任教練。按「兩隊故事」的「📋 複製故事卡請求」，Claude 會一併查教練資料。"))); block.append(card); continue; }
    const meta = [c?.en && c.en !== name ? c.en : "", c?.born ? `出生 ${c.born}` : "", c?.since ? `${c.since} 接任` : ""].filter(Boolean).join(" · ");
    if (meta) card.append(h("p", { class: "faint" }, ui(meta)));
    if (cur?.hook) card.append(h("p", { class: "coach-hook" }, ui(cur.hook)));
    /* 豐功偉業 */
    const ach = [...(cur?.achievements || [])];
    if (!ach.length && c?.honours?.length) ach.push(...c.honours.slice(0, 6));
    const best = (c?.record || []).filter((r) => r.p >= 10).sort((a, b) => b.pct - a.pct)[0];
    if (best && !cur?.achievements?.length) ach.push(`生涯最高勝率：${best.team} ${best.p} 場 ${trimNum(best.pct)}%`);
    if (ach.length) card.append(h("h4", null, ui("🏆 豐功偉業")), h("ul", { class: "reasons" }, ach.map((x) => h("li", null, ui(x)))));
    /* 戰術特色 */
    const prof = coachProfile(model, side, c?.since);
    profs[side] = prof;
    const style = [...(cur?.style || [])];
    if (style.length || prof) {
      card.append(h("h4", null, ui("🧠 戰術特色")));
      if (style.length) card.append(h("ul", { class: "reasons" }, style.map((x) => h("li", null, ui(x)))));
      if (prof) card.append(h("p", { class: "faint" }, ui(`數據畫像（ESPN 近 ${prof.n} 場${prof.tenureOnly ? "，皆在他任內" : ""}）：`)), h("div", { class: "chips" }, prof.tags.map((t) => h("span", { class: "pill" }, ui(t)))));
    }
    /* 任內戰績 */
    if (c?.tenure) {
      const t = c.tenure;
      card.append(h("h4", null, ui("📊 任內戰績")), h("p", { class: "lean" }, ui(`${t.n} 場 ${t.w} 勝 ${t.d} 和 ${t.l} 負，勝率 ${pct(t.w / t.n)}，進 ${t.gf} 失 ${t.ga}（${c.since} 起，ESPN 有紀錄的比賽）。`)));
    }
    if (cur?.quote) card.append(h("p", { class: "coach-quote" }, ui(`💬 「${cur.quote}」`)));
    if (cur?.watch?.length) card.append(h("h4", null, ui("👀 今晚看他什麼")), h("ul", { class: "reasons" }, cur.watch.map((x) => h("li", null, ui(x)))));
    if (c?.playing && (c.playing.clubs.length || c.playing.caps)) card.append(h("p", { class: "faint" }, ui(`球員時期：${c.playing.clubs.join("、")}${c.playing.caps ? `；國家隊 ${c.playing.caps}` : ""}`)));
    if (c?.zhText && !cur?.hook) card.append(h("p", { class: "faint" }, ui(c.zhText)));
    if (c?.record?.length) {
      card.append(h("details", { class: "fold", "data-k": "coach-rec-" + side }, h("summary", null, ui("執教生涯戰績表（維基百科）")),
        predTable(["球隊", "期間", "場", "勝", "和", "負", "勝率"], c.record.map((r) => ({
          cls: /present/i.test(r.to) ? "best" : "",
          cells: [r.team, `${r.from}–${r.to.replace(/present/i, "至今")}`, String(r.p), String(r.w), String(r.d), String(r.l), `${trimNum(r.pct)}%`]
        })))));
    }
    const srcs = [...(cur?.sources || []), ...(c ? [{ name: "維基百科", url: c.url }] : [])];
    card.append(h("p", { class: "faint kc-src" }, ui(`來源${cur?.checked ? `（查證 ${cur.checked}）` : ""}：`), ...srcs.flatMap((x, i) => [i ? "、" : "", h("a", { href: x.url, target: "_blank", rel: "noopener" }, ui(x.name))])));
    if (!cur) card.append(h("p", { class: "faint" }, ui("想要更有梗的教練故事（成名戰、戰術招牌、名言、爭議）：按「📋 複製故事卡請求」，Claude 會一併整理。")));
    block.append(card);
    const line = coachSay(model, side, c, cur, prof);
    if (line) say.push(line);
  }
  /* 教練對決 */
  const ph = profs.home;
  const pa = profs.away;
  if (ph?.poss != null && pa?.poss != null) {
    const H = model.home.name;
    const A = model.away.name;
    const dueling = Math.abs(ph.poss - pa.poss) >= 8
      ? `${ph.poss > pa.poss ? H : A}習慣控球、${ph.poss > pa.poss ? A : H}擅長等反擊，今晚是「控球 vs 反擊」的經典對決，看誰先失去耐心。`
      : `兩隊控球習慣接近，中場的爭奪會決定比賽節奏。`;
    block.append(h("p", { class: "lean" }, ui(`⚔️ 戰術對決：${dueling}`)));
    say.push(dueling);
  }
  if (say.length) block.append(scriptBlock([...say, "你覺得今晚哪個教練的臨場調度會先見效？留言押一個！"], "口播：教練對決"));
  return block;
}
