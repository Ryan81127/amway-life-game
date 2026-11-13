/* 兩隊教練：維基百科（球隊條目找出現任教練 → 教練條目的執教經歷與執教戰績表）＋ ESPN 任內戰績。 */

const COACH_PREFIX = "fb-coach-v1:";
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
  const intro = doc ? [...doc.querySelectorAll("section:first-of-type > p")].map(cleanTxt).filter((x) => x.length > 40).slice(0, 1).join(" ") : "";
  const zh = await zhSummaryFor(link.title);
  const cur = record.find((r) => /present/i.test(r.to)) || record.find((r) => r.team && team.rawName && r.team.includes(team.rawName.split(" ")[0]));
  const managedCur = info.managed.slice().reverse().find((m) => /–\s*$|present|–$/.test(m.years) || m.team.includes(team.rawName.split(" ")[0]));
  const since = cur?.from || (managedCur ? managedCur.years.replace(/[–-].*/, "").trim() : "");
  const tenure = since ? await tenureRecord(team.id, /^\d{4}$/.test(since) ? `${since}-01-01` : since, kickoff) : null;
  const v = {
    name: zh?.name || link.name, en: link.name, url: zh?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title)}`,
    zhText: zh?.text || "", enText: intro, born: info.born, managed: info.managed.slice(-8), record: record.slice(-10), since, tenure
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
  coachStore.set(key, { status: "ok", home, away });
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function coachBlock(model) {
  const key = `${model.home.id}-${model.away.id}`;
  const st = coachStore.get(key);
  if (!st) ensureCoaches(model);
  const block = h("section", { class: "block", id: "coaches" }, h("h2", null, ui("兩隊教練")));
  if (!st || st.status === "loading") { block.append(h("p", { class: "muted" }, ui("從維基百科找兩隊現任教練與執教戰績中…"))); return block; }
  const say = [];
  for (const side of ["home", "away"]) {
    const c = st[side];
    const team = model[side].name;
    block.append(h("h3", null, ui(`${side === "home" ? "🏠" : "✈️"} ${team}`)));
    if (!c) { block.append(h("p", { class: "muted" }, ui("維基百科找不到這隊的現任教練資料。"))); continue; }
    block.append(h("p", null, h("b", null, ui(c.name)), c.name !== c.en ? h("span", { class: "faint" }, ` ${c.en}`) : null, c.born ? h("span", { class: "faint" }, ui(` · 出生 ${c.born}`)) : null));
    if (c.zhText) block.append(h("p", null, ui(c.zhText)));
    else if (c.enText) block.append(h("p", { class: "faint" }, c.enText));
    if (c.tenure) {
      const t = c.tenure;
      block.append(h("p", { class: "lean" }, ui(`任內戰績（${c.since} 起，ESPN 有紀錄的比賽）：${t.n} 場 ${t.w} 勝 ${t.d} 和 ${t.l} 負，勝率 ${pct(t.w / t.n)}，進 ${t.gf} 失 ${t.ga}。`)));
    }
    if (c.record.length) {
      block.append(h("details", { class: "fold", "data-k": "coach-rec-" + side, open: true }, h("summary", null, ui("執教生涯戰績（維基百科）")),
        predTable(["球隊", "期間", "場", "勝", "和", "負", "勝率"], c.record.map((r) => ({
          cls: /present/i.test(r.to) ? "best" : "",
          cells: [r.team, `${r.from}–${r.to.replace(/present/i, "至今")}`, String(r.p), String(r.w), String(r.d), String(r.l), `${trimNum(r.pct)}%`]
        })))));
    } else if (c.managed.length) {
      block.append(h("p", { class: "faint" }, ui("執教經歷：" + c.managed.map((m) => `${m.years} ${m.team}`).join("；"))));
    }
    block.append(h("p", { class: "faint kc-src" }, ui("來源：維基百科 · "), h("a", { href: c.url, target: "_blank", rel: "noopener" }, ui("看教練條目"))));
    const best = c.record.slice().sort((a, b) => b.pct - a.pct)[0];
    say.push(`${team}的教練是${c.name}${c.tenure ? `，上任以來 ${c.tenure.n} 場 ${c.tenure.w} 勝 ${c.tenure.d} 和 ${c.tenure.l} 負` : ""}${best && best.p >= 10 ? `；他執教生涯勝率最高的是在${best.team}，勝率 ${trimNum(best.pct)}%` : ""}。`);
  }
  if (say.length) block.append(scriptBlock([...say, "今天是教練之間的鬥智：誰的臨場調度會先見效？留言押一個！"], "口播：教練對決"));
  block.append(h("p", { class: "faint" }, ui("任內戰績用 ESPN 賽程從接任日起計算；生涯戰績表取自英文維基百科的執教統計，球隊名保留原文。")));
  return block;
}
