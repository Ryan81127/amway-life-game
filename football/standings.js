/* standingsService：ESPN 積分榜、同組賽程與即時比分；加上手動修正比分（模擬模式）。
   這裡只負責「拿資料、整理成固定格式、標來源與時間」，排名與出線判定交給 qualify.js。 */

const ST_API = "https://site.api.espn.com/apis/v2/sports/soccer";
const SIM_PREFIX = "fb-sim-v1:";
const STBASE_PREFIX = "fb-stbase-v1:";
const stCache = new Map();
const v2Store = new Map();

function stFetch(url, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal, cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).finally(() => clearTimeout(t));
}

async function stCached(url, ttl) {
  const hit = stCache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await stFetch(url);
  stCache.set(url, { t: Date.now(), v });
  return v;
}

function parseStandings(json) {
  const groups = [];
  const walk = (node) => {
    if (node?.standings?.entries?.length) {
      groups.push({
        name: node.name || "",
        rows: node.standings.entries.map((e) => {
          const st = Object.fromEntries((e.stats || []).map((s) => [s.name, s.value]));
          const id = String(e.team?.id || "");
          const zone = typeof zoneFromNote === "function" ? zoneFromNote(e.note?.description, node.name) : null;
          return {
            id, rawName: e.team?.displayName || "", name: typeof teamZh === "function" ? teamZh(id, e.team?.displayName || "") : e.team?.displayName || "",
            logo: e.team?.logos?.[0]?.href || "",
            rank: Number(st.rank) || 0, p: Number(st.gamesPlayed) || 0, w: Number(st.wins) || 0, d: Number(st.ties) || 0, l: Number(st.losses) || 0,
            gf: Number(st.pointsFor) || 0, ga: Number(st.pointsAgainst) || 0, gd: Number(st.pointDifferential) || 0, pts: Number(st.points) || 0,
            deduct: Number(st.deductions) || 0, zone
          };
        }).sort((a, b) => a.rank - b.rank)
      });
    }
    for (const ch of node?.children || []) walk(ch);
  };
  walk(json);
  const seasonYear = Number(json?.season?.year ?? json?.children?.[0]?.standings?.season ?? json?.seasons?.[0]?.year) || null;
  return { seasonYear, seasonName: json?.season?.displayName || json?.children?.[0]?.standings?.seasonDisplayName || "", groups };
}

function simRead(key) {
  try { return JSON.parse(localStorage.getItem(SIM_PREFIX + key) || "{}"); } catch { return {}; }
}
function simWrite(key, v) {
  try { if (Object.keys(v).length) localStorage.setItem(SIM_PREFIX + key, JSON.stringify(v)); else localStorage.removeItem(SIM_PREFIX + key); } catch { /* 略過 */ }
}

function evToMatch(e) {
  const c = e.competitions?.[0];
  if (!c) return null;
  const hc = c.competitors?.find((x) => x.homeAway === "home");
  const ac = c.competitors?.find((x) => x.homeAway === "away");
  if (!hc || !ac) return null;
  const num = (x) => { const v = Number(x?.score?.value ?? x?.score?.displayValue ?? x?.score); return Number.isFinite(v) ? v : NaN; };
  const stt = c.status?.type || e.status?.type || {};
  return { id: String(e.id), date: e.date || c.date, home: String(hc.id || hc.team?.id), away: String(ac.id || ac.team?.id), hs: num(hc), as: num(ac), state: stt.state || "pre", clock: c.status?.displayClock || "", detail: stt.shortDetail || "" };
}

/* 同組所有比賽（已賽、進行中、未賽）。只在小組（6 隊以內）才逐隊抓賽程。 */
async function groupMatches(slug, ids, live) {
  const set = new Set(ids);
  const map = new Map();
  const lim = pLimit(4);
  await Promise.all(ids.flatMap((id) => ["", "?fixture=true"].map((q) => lim(async () => {
    try {
      const j = await stCached(`${API}/${slug}/teams/${id}/schedule${q}`, live ? 60000 : 300000);
      for (const e of j.events || []) {
        const m = evToMatch(e);
        if (m && set.has(m.home) && set.has(m.away)) map.set(m.id, m);
      }
    } catch { /* 單隊失敗時由下方完整性檢查處理 */ }
  }))));
  /* 即時比分以賽程表（scoreboard）為準，比球隊賽程更新得快 */
  try {
    const sb = await stCached(`${API}/${slug}/scoreboard`, 8000);
    for (const e of sb.events || []) {
      const m = evToMatch(e);
      if (m && set.has(m.home) && set.has(m.away)) map.set(m.id, { ...(map.get(m.id) || {}), ...m });
    }
  } catch { /* 沒有即時比分就用賽程資料 */ }
  return [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function loadV2(model, force) {
  const key = model.id;
  const prev = v2Store.get(key);
  const live = model.minute?.state === "in";
  if (!force && prev && (prev.status === "loading" || Date.now() - (prev.at || 0) < (live ? 20000 : 120000))) return;
  if (!prev) v2Store.set(key, { status: "loading" });
  else prev.refreshing = true;
  const slug = model.leagueSlug;
  const out = { status: "ok", at: Date.now(), slug, source: "ESPN 積分榜", errors: [] };
  try {
    const raw = await stCached(`${ST_API}/${slug}/standings`, live ? 20000 : 120000);
    const parsed = parseStandings(raw);
    out.seasonYear = parsed.seasonYear || new Date(model.kickoff).getFullYear();
    out.seasonName = parsed.seasonName;
    out.rules = typeof rulesFor === "function" ? rulesFor(slug, out.seasonYear) : null;
    const gh = parsed.groups.find((g) => g.rows.some((r) => r.id === model.home.id));
    const ga = parsed.groups.find((g) => g.rows.some((r) => r.id === model.away.id));
    out.group = gh || ga || null;
    out.sameGroup = !!gh && gh === ga;
    out.otherGroup = gh && ga && gh !== ga ? ga : null;
    if (!out.group) out.status = "none";
    if (out.group && out.rules && out.group.rows.length <= 6) {
      const ids = out.group.rows.map((r) => r.id);
      out.matches = await groupMatches(slug, ids, live);
      out.matchLevel = out.matches.length > 0;
    }
    /* 聯賽：開賽前先存一份積分榜當基準，比賽中才能確定「這場還沒被算進去」 */
    if (out.group && !out.matchLevel && model.minute?.phase === "pre") {
      try { localStorage.setItem(STBASE_PREFIX + model.id, JSON.stringify({ at: Date.now(), rows: out.group.rows.map((r) => ({ id: r.id, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts })) })); } catch { /* 略過 */ }
    }
  } catch (err) {
    out.status = prev?.status === "ok" ? "stale" : "error";
    out.errors.push(String(err.message || err));
    if (prev?.status === "ok") Object.assign(out, { ...prev, status: "stale", staleAt: Date.now(), errors: out.errors });
  }
  v2Store.set(key, out);
  if (state.model?.id === model.id && typeof maybeRender === "function") maybeRender({ soft: true });
}

function v2Ctx(model) {
  const c = v2Store.get(model.id);
  if (!c) { loadV2(model); return null; }
  const live = model.minute?.state === "in";
  if (c.status !== "loading" && Date.now() - (c.at || 0) > (live ? 25000 : 180000) && !c.refreshing) loadV2(model);
  return c;
}

function simKey(ctx) {
  return `${ctx.slug}:${ctx.group?.name || ""}`;
}

/* 把資料整理成出線分析要用的局面（確定性計算）。 */
function situation(model, ctx) {
  if (!ctx || ctx.status === "loading") return { state: "loading" };
  if (ctx.status === "error") return { state: "error", why: "積分榜讀取失敗（ESPN 沒有回應）" };
  if (!ctx.group) return { state: "none", why: "這項賽事沒有積分榜（例如友誼賽或淘汰賽階段）" };
  const rules = ctx.rules;
  const rows = ctx.group.rows;
  const n = rows.length;
  const nameOf = (id) => rows.find((r) => r.id === id)?.name || id;
  const zoneByRank = new Map(rows.filter((r) => r.zone).map((r) => [r.rank, r.zone]));
  const advRanks = rows.filter((r) => r.zone?.type === "advance").map((r) => r.rank);
  const out = { state: "ok", rules, rows, n, nameOf, zoneByRank, groupName: ctx.group.name, stale: ctx.status === "stale", at: ctx.at, notes: [], sim: {}, sameGroup: ctx.sameGroup };
  if (!rules) { out.notes.push("這項賽事的排名規則尚未建檔，只顯示 ESPN 官方積分榜，不做出線判定。"); out.table = rows.map((r) => ({ ...r, tied: [], why: "" })); out.official = true; return out; }
  const targets = (rules.targets || []).map((t) => ({ ...t, k: targetK(t.k, n) }));
  if (advRanks.length && rules.type === "groups") {
    const k = Math.max(...advRanks);
    if (!targets.some((t) => t.k === k)) targets.unshift({ k, label: zoneByRank.get(k)?.label || "晉級" });
  }
  out.targets = targets;
  out.mainK = rules.type === "groups" && advRanks.length ? Math.max(...advRanks) : targets[targets.length > 1 && rules.type === "league" ? 1 : 0]?.k || 1;

  if (ctx.matchLevel) {
    const sim = simRead(simKey(ctx));
    out.sim = sim;
    const ids = rows.map((r) => r.id);
    const all = ctx.matches.map((m) => {
      let x = { ...m };
      if (m.id === model.id) {
        const hs = Number(model.home.score);
        const as = Number(model.away.score);
        const st = model.minute?.phase === "pre" ? "pre" : (model.minute?.phase === "ft" || model.minute?.state === "post") ? "post" : "in";
        x = { ...x, state: st, hs: st === "pre" ? NaN : hs, as: st === "pre" ? NaN : as };
      }
      if (sim[m.id]) x = { ...x, hs: sim[m.id].hs, as: sim[m.id].as, state: x.state === "post" ? "post" : "in", simulated: true };
      return x;
    });
    const played = all.filter((m) => m.state === "post" && Number.isFinite(m.hs));
    const live = all.filter((m) => m.state === "in" && Number.isFinite(m.hs));
    const remaining = all.filter((m) => m.state === "pre");
    out.matches = all; out.played = played; out.live = live; out.remaining = remaining;
    const base = played.concat(live);
    const t = rankTable(ids, base, rules);
    out.table = t.rows.map((r) => ({ ...rows.find((x) => x.id === r.id), ...r, zone: zoneByRank.get(r.rank) || null }));
    out.unresolved = t.unresolved;
    out.isLive = live.length > 0;
    /* 與 ESPN 官方積分核對（只在沒有進行中比賽、也沒有手動修正時） */
    if (!live.length && !Object.keys(sim).length) {
      const bad = t.rows.filter((r) => { const o = rows.find((x) => x.id === r.id); return o && (o.pts !== r.pts || o.p !== r.p); });
      if (bad.length) { out.mismatch = true; out.notes.push(`自行計算的積分與 ESPN 官方積分榜不一致（${bad.map((r) => nameOf(r.id)).join("、")}），可能是賽程資料不完整或有扣分；出線判定改列「資料不足」。`); }
    }
    const open = remaining.concat(live.map((m) => ({ ...m, hs: NaN, as: NaN })));
    out.openCount = open.length;
    out.status = new Map();
    if (out.mismatch) {
      for (const tg of targets) out.status.set(tg.k, new Map(ids.map((id) => [id, { code: "unknown", notes: [] }])));
    } else if (open.length <= 9) {
      for (const tg of targets) {
        const o = outlook(ids, played, open, rules, tg.k, model.id);
        const mm = new Map();
        for (const id of ids) {
          const s = statusOf(o.get(id));
          /* 全部踢完時，同分的名次以排名表為準 */
          if (!open.length) {
            const row = t.rows.find((r) => r.id === id);
            const span = row.rank + row.tied.length;
            if (row.rank <= tg.k && span <= tg.k) s.code = "clinched";
            else if (row.rank > tg.k) s.code = "out";
            else { s.code = "unknown"; s.notes = ["積分與可比較的項目都相同，要靠公平競賽分或抽籤等決定，資料不足。"]; }
          }
          mm.set(id, { ...s, raw: o.get(id) });
        }
        out.status.set(tg.k, mm);
      }
    } else {
      out.notes.push("未賽場次太多，改用積分上下界判定。");
    }
    if (live.length) out.nextGoal = nextGoalEffects(ids, base, live, rules, out.mainK);
    out.goalsNeeded = (id) => goalsNeeded(ids, base, live, rules, out.mainK, id);
    /* 本場三種結果後的排名（其他進行中比賽照目前比分、未賽的不計） */
    const me = all.find((m) => m.id === model.id);
    if (me && me.state !== "post") {
      const others = base.filter((m) => m.id !== me.id);
      const cur = me.state === "in" ? [me.hs, me.as] : null;
      const variants = cur
        ? [["主隊再進 1 球", cur[0] + 1, cur[1]], ["維持目前比分", cur[0], cur[1]], ["客隊再進 1 球", cur[0], cur[1] + 1]]
        : [["主勝（以 1:0 計）", 1, 0], ["平局（以 0:0 計）", 0, 0], ["客勝（以 0:1 計）", 0, 1]];
      out.scenarios = variants.map(([label, hs, as]) => ({ label, hs, as, rows: rankTable(ids, others.concat([{ ...me, hs, as }]), rules).rows }));
    }
  } else {
    /* 大型聯賽：以 ESPN 官方積分榜為準 */
    out.official = true;
    out.table = rows.map((r) => ({ ...r, tied: [], why: "" }));
    const total = rules.totalGames || (n - 1) * (rules.legs || 2);
    out.totalGames = total;
    out.status = new Map();
    for (const tg of targets) {
      const b = boundsOutlook(rows, total, tg.k, rules.points);
      out.status.set(tg.k, new Map(rows.map((r) => [r.id, { code: b.get(r.id).clinched ? "clinched" : !b.get(r.id).possible ? "out" : "alive", notes: [], left: b.get(r.id).left, maxPts: b.get(r.id).maxPts }])));
    }
    /* 本場勝平負後的名次：用開賽前存下的基準（沒有基準時，比賽中無法確定官方榜是否已含本場） */
    let baseRows = null;
    if (model.minute?.phase === "pre") baseRows = rows;
    else { try { baseRows = JSON.parse(localStorage.getItem(STBASE_PREFIX + model.id) || "null")?.rows || null; } catch { baseRows = null; } }
    if (baseRows && baseRows.some((r) => r.id === model.home.id) && baseRows.some((r) => r.id === model.away.id)) {
      const [W, D, L] = rules.points;
      const apply = (hs, as) => baseRows.map((r) => {
        if (r.id !== model.home.id && r.id !== model.away.id) return { ...r };
        const mine = r.id === model.home.id ? hs : as;
        const opp = r.id === model.home.id ? as : hs;
        return { ...r, p: r.p + 1, gf: r.gf + mine, ga: r.ga + opp, gd: r.gd + mine - opp, pts: r.pts + (mine > opp ? W : mine === opp ? D : L) };
      }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf).map((r, i) => ({ ...r, rank: i + 1 }));
      const liveNow = model.minute?.phase !== "pre";
      const cur = liveNow ? [Number(model.home.score) || 0, Number(model.away.score) || 0] : null;
      const variants = cur
        ? [["主隊再進 1 球", cur[0] + 1, cur[1]], ["維持目前比分", cur[0], cur[1]], ["客隊再進 1 球", cur[0], cur[1] + 1]]
        : [["主勝（以 1:0 計）", 1, 0], ["平局（以 0:0 計）", 0, 0], ["客勝（以 0:1 計）", 0, 1]];
      out.scenarios = variants.map(([label, hs, as]) => ({ label, hs, as, rows: apply(hs, as) }));
      out.baseRank = new Map(baseRows.slice().sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf).map((r, i) => [r.id, i + 1]));
      out.notes.push("聯賽的「本場結果後名次」只用積分、淨勝球、進球數排序，沒有納入對戰成績；同輪其他比賽也還沒算進去。");
    } else if (model.minute?.phase !== "pre") {
      out.notes.push("這台裝置沒有開賽前的積分榜基準，無法確定 ESPN 官方榜是否已含本場，所以不計算即時名次。");
    }
  }
  return out;
}

if (typeof module !== "undefined") module.exports = { parseStandings, evToMatch };
