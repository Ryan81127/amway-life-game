/* 籃球雲端快照：在 GitHub Actions 上把籃球看板跑一遍，替快開賽的 NBA 比賽存賽前預測與盤口紀錄。
   用法：
     node basketball/tools/snapshot.js <輸出資料夾>          挑出 6 小時內開賽的比賽，逐場跑
     node basketball/tools/snapshot.js <輸出資料夾> <event>   只跑一場（內部用）
   規則跟手機上一樣：賽前預測只在開賽前寫；開賽後不再改。
   亞洲聯賽（KBL、B 聯賽、澳女聯）資料不是即時 API，先不做。 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const OUT = path.resolve(process.argv[2] || "bsnap");
const DIR = path.join(__dirname, "..");
const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const AHEAD_H = Number(process.env.SNAP_AHEAD_H || 6);
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

async function listTargets() {
  const now = Date.now();
  const days = [...new Set([0, AHEAD_H].map((h) => ymd(new Date(now + h * 3600e3))))];
  const out = [];
  for (const day of days) {
    try {
      const r = await fetch(`${API}/scoreboard?dates=${day}`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const ev of j.events || []) {
        const st = ev.competitions?.[0]?.status?.type?.state;
        const ko = Date.parse(ev.date);
        if (st === "pre" && ko > now && ko - now < AHEAD_H * 3600e3 && !out.some((x) => x.id === ev.id)) out.push({ id: ev.id, name: ev.name });
      }
    } catch (err) {
      console.log(`略過 ${day}：${err.message}`);
    }
  }
  return out;
}

async function runOne(id) {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { ({ JSDOM } = require(path.join(process.cwd(), "node_modules/jsdom"))); }
  const file = path.join(OUT, `${id}.json`);
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: `https://ryan81127.github.io/amway-life-game/basketball/?event=${id}`, pretendToBeVisual: true });
  for (const k of ["window", "document", "localStorage", "location", "history", "navigator", "Node", "DOMParser", "HTMLElement", "Event", "CustomEvent", "getComputedStyle", "URL", "URLSearchParams"]) if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k];
  global.CSS = global.CSS || { escape: (s) => s };
  global.requestAnimationFrame = (f) => setTimeout(f, 0);
  global.cancelAnimationFrame = (t) => clearTimeout(t);
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
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
  if (prev?.pred) localStorage.setItem(`nba-pred-v1:${id}`, JSON.stringify(prev.pred));
  if (prev?.odds) localStorage.setItem(`nba-odds-v1:${id}`, JSON.stringify(prev.odds));

  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const files = [...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  const src = files.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n;\n") + "\n;globalThis.__s = { state, loadPrediction, loadOdds, render };";
  (0, eval)(src);
  const S = globalThis.__s;
  const t0 = Date.now();
  while (!S.loadPrediction(id) && Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 2000));
    try { S.render(); } catch { /* 畫面錯誤不影響快照 */ }
    if (S.state.model && S.state.model.status?.phase !== "pre") break;
  }
  const m = S.state.model;
  const ko = Date.parse(m?.kickoff || prev?.kickoff || "");
  const pred = S.loadPrediction(id);
  const out = {
    id, league: "nba", kickoff: m?.kickoff || prev?.kickoff || null,
    home: m?.home?.name || prev?.home || "", away: m?.away?.name || prev?.away || "",
    updated: new Date().toISOString(),
    pred: pred && Number.isFinite(ko) && pred.at < ko ? pred : prev?.pred || null,
    odds: S.loadOdds(id) || prev?.odds || null
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`${id} ${out.away} @ ${out.home}｜賽前預測 ${out.pred ? "有" : "無"}｜盤口紀錄 ${out.odds ? "有" : "無"}`);
  process.exit(0);
}

async function main() {
  if (process.argv[3]) return runOne(process.argv[3]);
  const list = await listTargets();
  console.log(`籃球要存的比賽 ${list.length} 場`);
  for (const t of list) {
    try {
      execFileSync(process.execPath, [__filename, OUT, t.id], { stdio: "inherit", timeout: 150000 });
    } catch (err) {
      console.log(`失敗 ${t.id} ${t.name}：${err.message.split("\n")[0]}`);
    }
  }
  for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
    if (!/^\d+\.json$/.test(f)) continue;
    const j = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    if (Date.now() - Date.parse(j.kickoff || j.updated) > 10 * 86400e3) fs.unlinkSync(path.join(OUT, f));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
