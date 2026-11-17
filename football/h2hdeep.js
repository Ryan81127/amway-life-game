/* 兩隊歷史交手（多賽季）：ESPN 單場資料的交手紀錄常常只有本季一兩場，
   這裡改抓主隊在各賽事、近 9 個賽季的賽程，挑出對上客隊的已完賽比賽。
   再合併對話查證過的交手（cards/h2h/{小id}-{大id}.json）。結果存在這台裝置 3 天。 */

const H2H_PREFIX = "fb-h2h-v1:";
const h2hDeep = new Map();

function h2hKey(model) {
  return [model.home.id, model.away.id].map(String).sort().join("-");
}

function h2hRead(model) {
  const mem = h2hDeep.get(h2hKey(model));
  if (mem) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(H2H_PREFIX + h2hKey(model)) || "null");
    if (raw && Date.now() - raw.at < 3 * 86400000) { h2hDeep.set(h2hKey(model), raw); return raw; }
  } catch { /* 略過 */ }
  return null;
}

async function ensureDeepH2H(model) {
  const key = h2hKey(model);
  if (h2hRead(model)) return;
  h2hDeep.set(key, { status: "loading" });
  const hid = String(model.home.id);
  const aid = String(model.away.id);
  const kick = new Date(model.kickoff).getTime();
  const found = new Map();
  const slugs = new Set(model.leagueSlug && model.leagueSlug !== "all" ? [model.leagueSlug] : []);
  const take = (e) => {
    const m = evToMatch(e);
    if (!m || m.state !== "post" || !Number.isFinite(m.hs) || !Number.isFinite(m.as)) return;
    if (!((m.home === hid && m.away === aid) || (m.home === aid && m.away === hid))) return;
    if (new Date(m.date).getTime() > kick - 3600000) return;
    found.set(m.id, { ...m, league: compZh(e.league?.name || e.season?.displayName || "") });
  };
  let ok = false;
  try {
    for (const id of [hid, aid]) {
      const j = await stCached(`${ALL_API}/teams/${id}/schedule`, 600000).catch(() => null);
      if (!j) continue;
      ok = true;
      for (const e of j.events || []) { if (e.league?.slug) slugs.add(e.league.slug); take(e); }
    }
    const year = new Date().getFullYear();
    const lim = pLimit(4);
    const base = ALL_API.replace(/\/all$/, "");
    await Promise.all([...slugs].flatMap((slug) => Array.from({ length: 9 }, (_, i) => year - i).map((y) => lim(async () => {
      const j = await stCached(`${base}/${slug}/teams/${hid}/schedule?season=${y}`, 3600000).catch(() => null);
      if (!j) return;
      ok = true;
      for (const e of j.events || []) take(e);
    }))));
  } catch { /* 下面依 ok 判斷 */ }
  /* 對話查證過的交手（cards/h2h/），補上 ESPN 沒有的年份；同一天的比賽以 ESPN 為準 */
  let curated = null;
  try {
    const idx = typeof cardIndex === "function" ? await cardIndex() : null;
    const path = idx?.h2h?.[key];
    curated = path ? await cardJson(path) : null;
  } catch { curated = null; }
  const days = new Set([...found.values()].map((g) => String(g.date).slice(0, 10)));
  for (const g of curated?.games || []) {
    const d = String(g.date).slice(0, 10);
    if (days.has(d) || !Number.isFinite(Number(g.hs)) || !Number.isFinite(Number(g.as))) continue;
    if (d >= String(model.kickoff || "").slice(0, 10) || new Date(d).getTime() > kick - 3600000) continue;
    found.set("c" + d, { id: "c" + d, date: d, home: String(g.home), away: String(g.away), hs: Number(g.hs), as: Number(g.as), league: g.comp || "", src: "查證" });
    ok = true;
  }
  const games = [...found.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  const rec = { status: ok ? "ok" : "error", at: Date.now(), games, slugs: [...slugs], curated: curated ? { checked: curated.checked, sources: curated.sources || [], notes: curated.notes || [] } : null };
  h2hDeep.set(key, rec);
  if (ok) try { localStorage.setItem(H2H_PREFIX + key, JSON.stringify(rec)); } catch { /* 略過 */ }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

/* 以本場主隊的角度彙整 */
function h2hSummary(model, max) {
  const rec = h2hRead(model);
  if (!rec || rec.status !== "ok") return rec;
  const hid = String(model.home.id);
  const games = rec.games.slice(0, max || 10);
  const s = { status: "ok", n: games.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, over25: 0, games };
  for (const g of games) {
    const me = g.home === hid;
    const f = me ? g.hs : g.as;
    const a = me ? g.as : g.hs;
    s.gf += f; s.ga += a;
    if (f > a) s.w += 1; else if (f === a) s.d += 1; else s.l += 1;
    if (f + a > 2.5) s.over25 += 1;
  }
  s.total = rec.games.length;
  s.curated = rec.curated;
  s.since = games.length ? games[games.length - 1].date : null;
  return s;
}
