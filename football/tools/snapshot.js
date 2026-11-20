/* 雲端快照：在 GitHub Actions 上把看板跑一遍，替快開賽與進行中的比賽存賽前預測與滾球快照。
   用法：
     node football/tools/snapshot.js <輸出資料夾>            挑出要存的比賽，逐場跑
     node football/tools/snapshot.js <輸出資料夾> <league> <event>   只跑一場（內部用）
   規則（跟手機上一樣）：
     - 賽前預測只在開賽前寫；開賽後不再改賽前那一份。
     - 滾球快照記下來就不再改，只會新增。
     - 沒有快照的項目不補算。 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const OUT = path.resolve(process.argv[2] || "snap");
const DIR = path.join(__dirname, "..");
const API = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const AHEAD_H = Number(process.env.SNAP_AHEAD_H || 6);

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

async function listTargets() {
  const lib = fs.readFileSync(path.join(DIR, "lib.js"), "utf8");
  const slugs = [...lib.slice(0, lib.indexOf("];")).matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]).filter((s) => s !== "uae.1");
  const now = Date.now();
  const days = [...new Set([0, AHEAD_H].map((h) => ymd(new Date(now + h * 3600e3))).concat(ymd(new Date(now - 3 * 3600e3))))];
  const out = [];
  for (const slug of slugs) {
    for (const day of days) {
      try {
        const r = await fetch(`${API}/${slug}/scoreboard?dates=${day}`);
        if (!r.ok) continue;
        const j = await r.json();
        for (const ev of j.events || []) {
          const st = ev.competitions?.[0]?.status?.type?.state || ev.status?.type?.state;
          const ko = Date.parse(ev.date);
          const soon = st === "pre" && ko > now && ko - now < AHEAD_H * 3600e3;
          if ((soon || st === "in") && !out.some((x) => x.id === ev.id)) out.push({ slug, id: ev.id, st, ko: ev.date, name: ev.name });
        }
      } catch (err) {
        console.log(`略過 ${slug} ${day}：${err.message}`);
      }
    }
  }
  return out;
}

async function runOne(slug, id) {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { ({ JSDOM } = require(path.join(process.cwd(), "node_modules/jsdom"))); }
  const file = path.join(OUT, `${id}.json`);
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: `https://ryan81127.github.io/amway-life-game/football/?league=${slug}&event=${id}`, pretendToBeVisual: true });
  for (const k of ["window", "document", "localStorage", "location", "history", "navigator", "Node", "DOMParser", "HTMLElement", "Event", "CustomEvent", "getComputedStyle", "URL", "URLSearchParams"]) if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k];
  global.CSS = global.CSS || { escape: (s) => s };
  global.requestAnimationFrame = (f) => setTimeout(f, 0);
  global.cancelAnimationFrame = (t) => clearTimeout(t);
  global.IntersectionObserver = undefined;
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  /* 看板自己的 JSON（知識卡、阿聯酋快照等）直接讀本機檔案 */
  const netFetch = global.fetch;
  global.fetch = async (url, opt) => {
    const u = new URL(String(url), location.href);
    if (u.hostname === location.hostname) {
      const p = path.join(DIR, "..", decodeURIComponent(u.pathname.replace(/^\/amway-life-game\//, "")));
      if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
      const t = fs.readFileSync(p, "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t };
    }
    return netFetch(u.href, { ...opt, signal: undefined });
  };
  /* 先把舊的雲端快照放回去，已記下的不會被覆寫 */
  if (prev?.pred) localStorage.setItem(`fb-pred-v1:${id}`, JSON.stringify(prev.pred));
  if (prev?.ledger) localStorage.setItem(`fb-ledger-v1:${id}`, JSON.stringify(prev.ledger));

  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const files = [...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  const src = files.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n;\n") + "\n;globalThis.__s = { state, loadPrediction, ledgerRead, render };";
  (0, eval)(src);
  const S = globalThis.__s;
  const ready = () => {
    const m = S.state.model;
    if (!m) return false;
    const pre = m.minute?.phase === "pre";
    if (pre) return !!(S.loadPrediction(id) && S.ledgerRead(id)?.pre);
    return S.state.pred?.status === "ok" || S.state.pred?.status === "err" || Date.now() - t0 > 40000;
  };
  const t0 = Date.now();
  while (!ready() && Date.now() - t0 < 120000) {
    await new Promise((r) => setTimeout(r, 2000));
    try { S.render(); } catch { /* 畫面錯誤不影響快照 */ }
  }
  /* 角球預測要多等一下，再渲染一次讓快照記下來 */
  await new Promise((r) => setTimeout(r, 8000));
  try { S.render(); } catch { /* ignore */ }
  const m = S.state.model;
  const ko = Date.parse(m?.kickoff || prev?.kickoff || "");
  const pred = S.loadPrediction(id);
  const ledger = S.ledgerRead(id);
  const out = {
    id, league: slug, kickoff: m?.kickoff || prev?.kickoff || null,
    home: m?.home?.name || prev?.home || "", away: m?.away?.name || prev?.away || "",
    updated: new Date().toISOString(),
    /* 賽前那一份只接受開賽前的時間戳 */
    pred: pred && Number.isFinite(ko) && pred.at < ko ? pred : prev?.pred || null,
    ledger: ledger || prev?.ledger || null
  };
  if (out.ledger?.pre && Number.isFinite(ko) && out.ledger.pre.at >= ko) out.ledger.pre = prev?.ledger?.pre || null;
  if (out.ledger?.corners && Number.isFinite(ko) && out.ledger.corners.at >= ko) out.ledger.corners = prev?.ledger?.corners || null;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`${id} ${out.home} 對 ${out.away}｜賽前預測 ${out.pred ? "有" : "無"}｜賽前對帳 ${out.ledger?.pre ? "有" : "無"}｜角球 ${out.ledger?.corners ? "有" : "無"}｜滾球 ${out.ledger?.live?.length || 0} 筆`);
  process.exit(0);
}

async function main() {
  if (process.argv[3] && process.argv[4]) return runOne(process.argv[3], process.argv[4]);
  const list = await listTargets();
  console.log(`要存的比賽 ${list.length} 場`);
  for (const t of list) {
    try {
      execFileSync(process.execPath, [__filename, OUT, t.slug, t.id], { stdio: "inherit", timeout: 180000 });
    } catch (err) {
      console.log(`失敗 ${t.slug} ${t.id} ${t.name}：${err.message.split("\n")[0]}`);
    }
  }
  /* 索引：看板用來知道有哪些雲端快照（清掉 10 天前的） */
  const idx = {};
  for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
    if (!/^\d+\.json$/.test(f)) continue;
    const j = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    if (Date.now() - Date.parse(j.kickoff || j.updated) > 10 * 86400e3) { fs.unlinkSync(path.join(OUT, f)); continue; }
    idx[j.id] = { kickoff: j.kickoff, league: j.league, home: j.home, away: j.away, updated: j.updated };
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ updated: new Date().toISOString(), matches: idx }));
}

main().catch((err) => { console.error(err); process.exit(1); });
