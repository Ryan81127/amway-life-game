/* 阿聯酋職業足球聯賽（ADNOC Pro League）：ESPN 沒有這個聯賽，官方網站又不讓其他網站讀，
   所以用官方賽程快照 data/uae.json。這裡把快照轉成 ESPN 的資料格式，看板其他功能就能照常運作；
   ESPN 獨有的資料（陣容、技術統計、盤口）會顯示資料不足。比分不會即時更新，要請 Claude 重抓快照。 */

const UAE_SLUG = "uae.1";
let uaePack = null;

async function uaeLoad() {
  if (uaePack) return uaePack;
  const res = await fetch("data/uae.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("UAE 賽程檔讀不到");
  const data = await res.json();
  for (const [code, t] of Object.entries(data.teams)) TEAM_ZH["uae-" + code] = t.zh;
  uaePack = data;
  return data;
}

function uaeState(g) {
  if (g.hs != null && g.as != null) return "post";
  const t = new Date(g.date).getTime();
  if (Date.now() >= t && Date.now() < t + 2 * 3600 * 1000) return "in";
  if (Date.now() >= t) return "post";
  return "pre";
}

/* 依快照算到這場開賽前的戰績 */
function uaeRecord(data, code, before) {
  let w = 0, d = 0, l = 0;
  for (const g of data.games) {
    if (g.hs == null || new Date(g.date) >= before || (g.home !== code && g.away !== code)) continue;
    const f = g.home === code ? g.hs : g.as;
    const a = g.home === code ? g.as : g.hs;
    if (f > a) w += 1; else if (f === a) d += 1; else l += 1;
  }
  return `${w}-${d}-${l}`;
}

function uaeComp(data, g) {
  const st = uaeState(g);
  const done = g.hs != null;
  const side = (code, ha, score) => {
    const t = data.teams[code];
    return {
      id: "uae-" + code, homeAway: ha,
      team: { id: "uae-" + code, displayName: t.en, shortDisplayName: t.en, abbreviation: code, logo: t.logo },
      score: st === "pre" || score == null ? undefined : String(score),
      records: [{ type: "total", summary: uaeRecord(data, code, new Date(g.date)) }]
    };
  };
  const name = done ? "STATUS_FULL_TIME" : st === "in" ? "STATUS_IN_PROGRESS" : st === "post" ? "STATUS_FULL_TIME" : "STATUS_SCHEDULED";
  return {
    id: g.id, date: g.date,
    status: { period: done ? 2 : st === "in" ? 1 : 0, displayClock: "", type: { name, state: st, completed: done, shortDetail: done ? "FT" : st === "post" ? "快照未更新比分" : "" } },
    venue: { fullName: g.venue, address: { city: "", country: "United Arab Emirates" } },
    competitors: [side(g.home, "home", g.hs), side(g.away, "away", g.as)]
  };
}

function uaeEvent(data, g) {
  return { id: g.id, date: g.date, name: `${data.teams[g.away].en} at ${data.teams[g.home].en}`, league: { slug: UAE_SLUG, name: "UAE Pro League" }, season: { year: 2027 }, competitions: [uaeComp(data, g)] };
}

function uaeStandings(data) {
  const rows = new Map(Object.keys(data.teams).map((c) => [c, { c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }]));
  for (const g of data.games) {
    if (g.hs == null) continue;
    for (const [c, f, a] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) {
      const r = rows.get(c);
      r.p += 1; r.gf += f; r.ga += a;
      if (f > a) r.w += 1; else if (f === a) r.d += 1; else r.l += 1;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, pts: r.w * 3 + r.d, gd: r.gf - r.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  return {
    season: { year: 2027, displayName: "2026/27" },
    children: [{
      name: "ADNOC Pro League",
      standings: {
        season: 2027, seasonDisplayName: "2026/27",
        entries: list.map((r, i) => ({
          team: { id: "uae-" + r.c, displayName: data.teams[r.c].en, logos: [{ href: data.teams[r.c].logo }] },
          stats: [["rank", i + 1], ["gamesPlayed", r.p], ["wins", r.w], ["ties", r.d], ["losses", r.l], ["pointsFor", r.gf], ["pointsAgainst", r.ga], ["pointDifferential", r.gd], ["points", r.pts]].map(([name, value]) => ({ name, value })),
          note: i === 0 ? { description: "冠軍" } : i >= list.length - 2 ? { description: "降級區" } : undefined
        }))
      }
    }]
  };
}

/* 攔截 ESPN 網址：只處理阿聯酋聯賽，其他回傳 null 照常走 ESPN */
async function uaeIntercept(url) {
  const u = String(url);
  const isUae = u.includes(`/${UAE_SLUG}/`) || /[?&]event=uae\d/.test(u) || /\/teams\/uae-/.test(u);
  if (!isUae) return null;
  const data = await uaeLoad();
  if (u.includes("/standings")) return uaeStandings(data);
  const team = u.match(/\/teams\/uae-([A-Z]+)\/schedule/);
  if (team) {
    const fixtures = /fixture=true/.test(u);
    const events = data.games.filter((g) => (g.home === team[1] || g.away === team[1]) && (fixtures ? g.hs == null : g.hs != null)).map((g) => uaeEvent(data, g));
    return { events, team: { id: "uae-" + team[1], displayName: data.teams[team[1]].en } };
  }
  const ev = u.match(/[?&]event=(uae[^&]+)/);
  if (ev) {
    const g = data.games.find((x) => x.id === decodeURIComponent(ev[1]));
    if (!g) throw new Error("找不到這場");
    const comp = uaeComp(data, g);
    const lastFive = (code) => ({
      team: { id: "uae-" + code, displayName: data.teams[code].en },
      events: data.games.filter((x) => x.hs != null && (x.home === code || x.away === code) && new Date(x.date) < new Date(g.date))
        .slice(-5).reverse().map((x) => {
          const me = x.home === code;
          const f = me ? x.hs : x.as;
          const a = me ? x.as : x.hs;
          const opp = me ? x.away : x.home;
          return { id: x.id, gameDate: x.date, gameResult: f > a ? "W" : f === a ? "D" : "L", score: `${x.hs}-${x.as}`, opponent: { id: "uae-" + opp, displayName: data.teams[opp].en }, competitionName: "UAE Pro League", homeTeamId: "uae-" + x.home, awayTeamId: "uae-" + x.away, homeTeamScore: String(x.hs), awayTeamScore: String(x.as), atVs: me ? "vs" : "@" };
        })
    });
    const meet = data.games.filter((x) => x.hs != null && new Date(x.date) < new Date(g.date) && ((x.home === g.home && x.away === g.away) || (x.home === g.away && x.away === g.home)));
    return {
      lastFiveGames: [lastFive(g.home), lastFive(g.away)],
      seasonseries: meet.length ? [{ events: meet.map((x) => ({ id: x.id, date: x.date, competitors: [{ id: "uae-" + x.home, homeAway: "home", score: String(x.hs), team: { id: "uae-" + x.home, displayName: data.teams[x.home].en } }, { id: "uae-" + x.away, homeAway: "away", score: String(x.as), team: { id: "uae-" + x.away, displayName: data.teams[x.away].en } }] })) }] : [],
      header: { id: g.id, competitions: [comp], league: { slug: UAE_SLUG, name: "UAE Pro League" }, season: { year: 2027 } },
      gameInfo: { venue: comp.venue },
      boxscore: { teams: [], players: [] },
      rosters: [], keyEvents: [], commentary: [], news: { articles: [] },
      standings: { groups: [] },
      meta: { source: "uae-snapshot", fetched: data.fetched, week: g.week }
    };
  }
  if (u.includes("/scoreboard")) {
    const m = u.match(/dates=(\d{8})(?:-(\d{8}))?/);
    const iso = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    let from = -Infinity, to = Infinity;
    if (m) { from = new Date(iso(m[1]) + "T00:00:00Z").getTime() - 86400000; to = new Date(iso(m[2] || m[1]) + "T23:59:59Z").getTime() + 86400000; }
    const events = data.games.filter((g) => { const t = new Date(g.date).getTime(); return t >= from && t <= to; }).map((g) => uaeEvent(data, g));
    return { events, leagues: [{ slug: UAE_SLUG, name: "UAE Pro League" }] };
  }
  return { events: [] };
}

/* 包住 fetch：任何模組要阿聯酋資料都由快照回答，不會打到 ESPN 拿 400 */
(() => {
  if (typeof window === "undefined" || !window.fetch || window.__uaeFetch) return;
  const real = window.fetch.bind(window);
  window.__uaeFetch = true;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (/espn\.com/.test(url)) {
      const fake = await uaeIntercept(url).catch((err) => ({ __err: String(err.message || err) }));
      if (fake) {
        if (fake.__err) return new Response(JSON.stringify({ message: fake.__err }), { status: 404, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify(fake), { status: 200, headers: { "content-type": "application/json" } });
      }
    }
    return real(input, init);
  };
})();
