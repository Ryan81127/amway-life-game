/* 執行：node football/tests/history.test.js（需要 jsdom）
   預測歷史：四分之一盤的半贏／半輸、原始快照不被改寫、篩選與命中率算法。 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch { try { ({ JSDOM } = require("/tmp/node_modules/jsdom")); } catch { console.log("略過：沒有安裝 jsdom"); process.exit(0); } }
const dir = path.join(__dirname, "..");
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: "https://x.test/football/?view=history" });
for (const k of ["window", "document", "localStorage", "location", "history", "navigator", "Node", "DOMParser", "URL", "URLSearchParams"]) if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k];
global.CSS = { escape: (s) => s };
global.requestAnimationFrame = (f) => setTimeout(f, 0);

const SUMMARY = {
  header: { competitions: [{ date: "2026-11-10T19:00Z", status: { type: { state: "post", completed: true, shortDetail: "FT" }, period: 2, displayClock: "90'" },
    competitors: [{ id: "1", homeAway: "home", score: "2", linescores: [{ value: 1 }], team: { id: "1", displayName: "Arsenal" } }, { id: "2", homeAway: "away", score: "1", linescores: [{ value: 0 }], team: { id: "2", displayName: "Chelsea" } }] }] }
};
let calls = 0;
global.fetch = async (url) => { calls += 1; return { ok: true, status: 200, json: async () => SUMMARY, text: async () => "" }; };

const files = [...fs.readFileSync(path.join(dir, "index.html"), "utf8").matchAll(/src="([a-z0-9]+\.js)/g)].map((m) => m[1]).filter((f) => f !== "app.js");
const appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8").replace(/\nboot\(\);?\s*$/, "\n");
(0, eval)(files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n") + "\n" + appSrc + `
;globalThis.__h = { ahDetail, histLoad, histState, historyView, histFiltered, histSummary, histRate, LEDGER_PREFIX, HIST_PREFIX, HIST_META };`);
const H = globalThis.__h;
globalThis.maybeRender = () => {};

(async () => {
  let n = 0;
  const ok = (name) => { n += 1; console.log("  ✓ " + name); };
  // 讓球細分
  assert.strictEqual(H.ahDetail(1, -0.75), "halfwin");   // 讓 0.75 贏 1 球
  assert.strictEqual(H.ahDetail(0, -0.25), "halflose");  // 讓 0.25 打平
  assert.strictEqual(H.ahDetail(0, 0.25), "halfwin");    // 受讓 0.25 打平
  assert.strictEqual(H.ahDetail(-1, 0.75), "halflose");  // 受讓 0.75 輸 1 球
  assert.strictEqual(H.ahDetail(1, -1), "push");
  assert.strictEqual(H.ahDetail(2, -1.5), "hit");
  assert.strictEqual(H.ahDetail(0, -0.5), "miss");
  ok("四分之一盤分出半贏、半輸，整數盤走盤");

  const pre = { at: Date.parse("2026-11-10T12:00Z"), items: [
    { cat: "pre", kind: "1x2", pick: "home", text: "主勝" },
    { cat: "pre", kind: "ah", side: "home", line: -0.75, text: "主讓 0.75" },
    { cat: "pre", kind: "ou", side: "over", line: 3, text: "全場大於 3" },
    { cat: "pre", kind: "score", score: "1-0", text: "1:0" }
  ] };
  const bag = { pre, live: [{ at: 1, minute: "80", hs: 2, as: 1, items: [{ cat: "live", kind: "ah-rest", side: "away", line: -0.25, text: "客讓 0.25" }] }], corners: null, cornerLive: [] };
  const raw = JSON.stringify(bag);
  localStorage.setItem(H.LEDGER_PREFIX + "777", raw);
  localStorage.setItem(H.HIST_META, JSON.stringify({ 777: { league: "eng.1", leagueName: "英超", home: "兵工廠", away: "切爾西", kickoff: new Date(Date.now() - 2 * 86400000).toISOString() } }));
  await H.histLoad(true);
  const m = H.histState.matches[0];
  assert.ok(m && m.final, "完賽");
  const code = Object.fromEntries(m.rows.map((r) => [r.kind, r.code]));
  assert.deepStrictEqual(code, { "1x2": "hit", ah: "halfwin", ou: "push", score: "miss", "ah-rest": "halflose" });
  ok("2:1 終場：主勝命中、讓 0.75 半贏、大 3 走盤、比分未中、80 分鐘客讓 0.25（之後 0:0）半輸");
  assert.strictEqual(localStorage.getItem(H.LEDGER_PREFIX + "777"), raw);
  assert.ok(localStorage.getItem(H.HIST_PREFIX + "777"));
  ok("原始預測快照一字未改，對帳結果另存");

  const before = calls;
  H.histState.status = "idle";
  await H.histLoad(false);
  assert.strictEqual(calls, before, "已完賽不再重抓");
  ok("已完賽的結果固定，不重新抓也不重算");

  const all = H.histFiltered();
  const tot = [...H.histSummary(all).values()].reduce((a, s) => { for (const k in s) a[k] = (a[k] || 0) + s[k]; return a; }, {});
  const r = H.histRate(tot);
  assert.strictEqual(r.n, 4); // hit + miss + halfwin + halflose，走盤不計
  assert.strictEqual(r.p, 1.5 / 4);
  ok("命中率：(命中 + 半贏×0.5) ÷ 4，走盤不計入");

  H.histState.filters.kind = "ah"; assert.strictEqual(H.histFiltered().length, 1);
  H.histState.filters.kind = "all"; H.histState.filters.cat = "live"; assert.strictEqual(H.histFiltered().length, 1);
  H.histState.filters.cat = "all"; H.histState.filters.league = "esp.1"; assert.strictEqual(H.histFiltered().length, 0);
  H.histState.filters.league = "all"; H.histState.filters.range = "1"; assert.strictEqual(H.histFiltered().length, 0);
  H.histState.filters.range = "30";
  ok("聯賽、盤口、類型、時間篩選");

  const node = H.historyView();
  const t = node.textContent;
  assert.ok(/半贏/.test(t) && /半輸/.test(t) && /走盤/.test(t) && /無法判定/.test(t));
  assert.ok(!/undefined|NaN|\[object/.test(t), (/.{20}(undefined|NaN|\[object).{20}/.exec(t) || [""])[0]);
  ok("頁面渲染：六種結果欄位都在，沒有未處理的值");
  console.log(`history: ${n} 項通過`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
