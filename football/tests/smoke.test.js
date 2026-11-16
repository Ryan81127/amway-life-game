/* 執行：node football/tests/smoke.test.js（需要 jsdom：npm i jsdom）
   用假的 ESPN 回應（2022 世界盃 H 組最後一輪進行中）把四個新分頁各渲染一次，確認不會出錯，
   並檢查 API 無回應、沒有盤口時的畫面。 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch { try { ({ JSDOM } = require("/tmp/node_modules/jsdom")); } catch { console.log("略過：沒有安裝 jsdom"); process.exit(0); } }
const dir = path.join(__dirname, "..");
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: "https://x.test/football/?league=fifa.world&event=E5" });
for (const k of ["window", "document", "localStorage", "location", "history", "navigator", "Node", "DOMParser", "CSS", "URL", "URLSearchParams"]) if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k];
global.CSS = global.CSS || { escape: (s) => s };
global.requestAnimationFrame = (f) => setTimeout(f, 0);
global.IntersectionObserver = undefined;

const T = { POR: "Portugal", GHA: "Ghana", KOR: "South Korea", URU: "Uruguay" };
const comp = (id, date, home, away, hs, as, state) => ({ id, date, name: `${T[away]} at ${T[home]}`, competitions: [{ date, status: { displayClock: "70'", type: { state, shortDetail: state } }, competitors: [{ id: home, homeAway: "home", score: { value: hs }, team: { id: home, displayName: T[home] } }, { id: away, homeAway: "away", score: { value: as }, team: { id: away, displayName: T[away] } }] }] });
const EVENTS = [comp("E1", "2022-11-24T13:00Z", "URU", "KOR", 0, 0, "post"), comp("E2", "2022-11-24T16:00Z", "POR", "GHA", 3, 2, "post"), comp("E3", "2022-11-28T13:00Z", "KOR", "GHA", 2, 3, "post"), comp("E4", "2022-11-28T19:00Z", "POR", "URU", 2, 0, "post"), comp("E5", "2022-12-02T15:00Z", "KOR", "POR", 1, 1, "in"), comp("E6", "2022-12-02T15:00Z", "GHA", "URU", 0, 2, "in")];
const entry = (id, rank, p, w, d, l, gf, ga, pts, note) => ({ team: { id, displayName: T[id] }, note: note ? { description: note } : undefined, stats: Object.entries({ rank, gamesPlayed: p, wins: w, ties: d, losses: l, pointsFor: gf, pointsAgainst: ga, pointDifferential: gf - ga, points: pts }).map(([name, value]) => ({ name, value })) });
const STANDINGS = { season: { year: 2022, displayName: "2022 FIFA World Cup" }, children: [{ name: "Group H", standings: { entries: [entry("POR", 1, 2, 2, 0, 0, 5, 2, 6, "Advance to round of 16"), entry("GHA", 2, 2, 1, 0, 1, 5, 5, 3, "Advance to round of 16"), entry("KOR", 3, 2, 0, 1, 1, 2, 3, 1), entry("URU", 4, 2, 0, 1, 1, 0, 2, 1)] } }] };
let apiDown = false;
global.fetch = async (url) => {
  url = String(url);
  if (apiDown) throw new Error("network");
  let body = {};
  if (url.includes("/standings")) body = STANDINGS;
  else if (url.includes("/schedule")) body = { events: url.includes("fixture=true") ? [] : EVENTS.filter((e) => e.competitions[0].competitors.some((c) => url.includes(`/teams/${c.id}/`))) };
  else if (url.includes("/scoreboard")) body = { events: EVENTS.filter((e) => e.competitions[0].status.type.state === "in") };
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
};

const files = [...fs.readFileSync(path.join(dir, "index.html"), "utf8").matchAll(/src="([a-z0-9]+\.js)/g)].map((m) => m[1]).filter((f) => f !== "app.js");
const appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8").replace(/\nboot\(\);?\s*$/, "\n");
const src = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n") + "\n" + appSrc + `
;globalThis.__t = { state, v2Render, situationStrip, v2Sit, v2Store, loadV2, simWrite, simKey, v2Ctx, stCache, mvSched, motivation, cmFacts, marketPanel };`;
(0, eval)(src);
const { state, v2Render, situationStrip, v2Sit, v2Store, loadV2, simWrite, simKey, v2Ctx, stCache } = globalThis.__t;

const model = { id: "E5", leagueSlug: "fifa.world", leagueName: "世界盃", kickoff: "2022-12-02T15:00Z", venue: "", city: "",
  home: { id: "KOR", name: "南韓", rawName: "South Korea", score: "1", linescores: [] }, away: { id: "POR", name: "葡萄牙", rawName: "Portugal", score: "1", linescores: [] },
  minute: { phase: "live", state: "in", period: 2, base: 70, label: "70'" }, events: [], commentary: [], stats: { mode: "match", home: {}, away: {} }, roster: { home: { players: [] }, away: { players: [] } }, odds: null, form: [], formIds: [] };
state.model = model;
globalThis.maybeRender = () => {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let n = 0;
  const ok = (name) => { n += 1; console.log("  ✓ " + name); };
  await loadV2(model, true);
  const sit = v2Sit(model);
  assert.strictEqual(sit.state, "ok");
  assert.strictEqual(sit.rules.tiebreak[0], "gd", "2022 賽季要載入 2022 規則");
  assert.strictEqual(sit.table.find((r) => r.id === "URU").rank, 2);
  ok("同組另一場自動識別、即時積分榜：烏拉圭 2:0 時暫居第二");
  assert.ok(sit.nextGoal.some((g) => g.scorer === "KOR" && g.changes.some((c) => c.id === "URU" && c.drops)));
  ok("下一球：韓國進球會讓烏拉圭掉出晉級區");
  for (const v of ["table", "motive", "motive2", "script", "market"]) {
    const node = v2Render(model, v);
    assert.ok(node && node.textContent.length > 100, v);
    assert.ok(!/undefined|NaN|\[object/.test(node.textContent), `${v} 出現未處理的值：` + (/.{20}(undefined|NaN|\[object).{20}/.exec(node.textContent) || [""])[0]);
  }
  ok("四個新分頁都能渲染，沒有 undefined／NaN");
  assert.ok(/資料不足|沒有盤口資料/.test(v2Render(model, "market").textContent));
  ok("缺少盤口時顯示資料不足，不產生數字");
  model.home.score = "2";
  const sit2 = v2Sit(model);
  assert.strictEqual(sit2.table.find((r) => r.id === "KOR").rank, 2);
  assert.strictEqual(sit2.table.find((r) => r.id === "URU").rank, 3);
  assert.ok(/烏拉圭.*再進 1 球/.test(v2Render(model, "table").textContent) || /Uruguay.*再進 1 球/.test(v2Render(model, "table").textContent));
  assert.ok(situationStrip(model).textContent.includes("第 2"));
  ok("韓國進球後：韓國第二、烏拉圭第三，並提示烏拉圭還差 1 球；形勢快報更新");
  simWrite(simKey(v2Ctx(model)), { E6: { hs: 0, as: 3 } });
  const sit3 = v2Sit(model);
  assert.strictEqual(sit3.table.find((r) => r.id === "URU").rank, 2);
  assert.ok(v2Render(model, "table").textContent.includes("模擬"));
  simWrite(simKey(v2Ctx(model)), {});
  ok("手動修正比分（模擬模式）：烏拉圭 3:0 時回到第二，畫面標示模擬");
  apiDown = true; stCache.clear();
  await loadV2(model, true);
  assert.strictEqual(v2Store.get("E5").status, "stale");
  assert.ok(situationStrip(model).textContent.includes("更新不了"));
  ok("API 無回應：保留上一次成功的資料並提示");
  v2Store.clear();
  const m2 = { ...model, id: "E9" }; state.model = m2;
  await loadV2(m2, true);
  assert.strictEqual(v2Sit(m2).state, "error");
  assert.ok(v2Render(m2, "table").textContent.includes("資料不足"));
  ok("第一次就讀取失敗：顯示資料不足，不做判定");
  console.log(`\n全部通過：${n} 項`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
