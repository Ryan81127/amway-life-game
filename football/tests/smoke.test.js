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
  if (url.includes("cards/index.json")) body = { teams: {}, h2h: { "KOR-POR": "h2h/KOR-POR.json" } };
  else if (url.includes("cards/h2h/KOR-POR.json")) body = { checked: "2026-11-17", sources: [{ name: "雷速", url: "https://m.leisu.com/" }], games: [{ date: "2002-06-14", home: "POR", away: "KOR", hs: 0, as: 1, comp: "世界盃" }, { date: "2022-12-02", home: "KOR", away: "POR", hs: 9, as: 9 }], notes: ["2002 世界盃朴智星破門"] };
  else if (url.includes("/standings")) body = STANDINGS;
  else if (url.includes("/schedule")) body = { events: url.includes("fixture=true") ? [] : EVENTS.filter((e) => e.competitions[0].competitors.some((c) => url.includes(`/teams/${c.id}/`))) };
  else if (url.includes("/scoreboard")) body = { events: EVENTS.filter((e) => e.competitions[0].status.type.state === "in") };
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
};

const files = [...fs.readFileSync(path.join(dir, "index.html"), "utf8").matchAll(/src="([a-z0-9]+\.js)/g)].map((m) => m[1]).filter((f) => f !== "app.js");
const appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8").replace(/\nboot\(\);?\s*$/, "\n");
const src = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n") + "\n" + appSrc + `
;globalThis.__t = { state, v2Render, situationStrip, v2Sit, v2Store, loadV2, simWrite, simKey, v2Ctx, stCache, mvSched, motivation, cmFacts, marketPanel, m2RankAfter, m2Grade, aiRewrite, aiBlock, ensureDeepH2H, h2hSummary, h2hBlock, liveCard, stickyBar, bcLines, bcNodeCard, bcNodes, bcScene, timeline, onPitchTable, recapBlock, subsBlock };`;
(0, eval)(src);
const { state, v2Render, situationStrip, v2Sit, v2Store, loadV2, simWrite, simKey, v2Ctx, stCache, m2RankAfter, m2Grade, aiRewrite, aiBlock, cmFacts, motivation, ensureDeepH2H, h2hSummary, h2hBlock } = globalThis.__t;

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
  {
    const T = globalThis.__t;
    const goalModel = { ...model, minute: { phase: "live", state: "in", period: 2, base: 72, label: "72'" }, home: { ...model.home, score: "1" }, away: { ...model.away, score: "1" },
      events: [{ id: "g1", kind: "goal", base: 24, period: 1, teamId: "KOR", teamName: "南韓", scorer: "孫興慜", style: "頭槌" }, { id: "g2", kind: "goal", base: 70, period: 2, teamId: "POR", teamName: "葡萄牙", scorer: "C 羅", style: "" }] };
    const L = T.bcLines(goalModel);
    assert.ok(/第 70 分鐘，葡萄牙的C 羅破門！現在 一 比 一/.test(L.quick), L.quick);
    assert.ok(/第 24 分鐘，南韓的孫興慜頭球破門/.test(L.longer), L.longer);
    const card = T.liveCard(goalModel);
    assert.ok(card.querySelector(".bc-scenes"), "進行中要有手動場景按鈕");
    assert.ok(T.stickyBar(goalModel).textContent.includes("1 : 1"));
    const n = T.bcNodeCard(goalModel, T.bcNodes().find((x) => x.id === "ht"));
    assert.ok(/到第 45 分鐘：南韓 1 比 0 領先/.test(n.textContent), n.textContent);
    assert.ok(/比分待確認：南韓 2 比 1 葡萄牙/.test(T.bcScene(goalModel, "goal", "home")[1]));
    const ftCard = T.liveCard({ ...goalModel, minute: { phase: "ft", state: "post", period: 2, base: 90, label: "完賽" } });
    assert.ok(!ftCard.querySelector(".bc-scenes") && /終場，南韓 和 葡萄牙 1 比 1/.test(ftCard.textContent));
    ok("即時口播卡：5 秒／15 秒、節點分段比分、手動場景；完賽不顯示場景鍵");
    const ev = (id, kind, base, extra = {}) => ({ id, kind, base, period: base > 45 ? 2 : 1, minuteLabel: `${base}'`, teamId: "KOR", teamName: "南韓", playerNames: ["甲"], playerIds: [""], scorer: kind === "goal" ? "甲" : "", spoken: [`${base} 分鐘${kind}`], ...extra });
    const tlModel = { ...goalModel, events: [ev("a", "yellow", 10), ev("b", "goal", 24), ev("c", "sub", 60), ev("d", "goal", 70, { isVar: true })] };
    const tl = T.timeline(tlModel);
    const mins = [...tl.querySelectorAll("li .min")].map((x) => x.textContent);
    assert.deepStrictEqual(mins, ["70'", "60'", "24'", "10'"], "賽點要最新在上");
    assert.ok(tl.querySelector(".script.lead").textContent.includes("70 分鐘goal"), "最新關鍵事件要放口播重點");
    assert.ok([...tl.querySelectorAll(".tl-filter .chip")].map((b) => b.textContent).join(",").includes("VAR 1"));
    const op = T.onPitchTable({ ...goalModel, roster: { home: { players: [{ id: "1", name: "孫興慜", en: "Son Heung-min", jersey: "7", posZh: "前鋒", starter: true, goalMins: ["24'"], assistMins: [], yellowMins: [] }] }, away: { players: [] } } });
    assert.ok(/南韓 7 號孫興慜（前鋒），本場進球 24'/.test(op.lines[0]), op.lines[0]);
    ok("賽點最新在上、可篩選；球星區列出本場出場者與表現");
    const rc = T.recapBlock({ ...goalModel, minute: { phase: "ft", state: "post", period: 2, base: 90, label: "完賽" } });
    const lead = rc.querySelector(".script.lead").textContent;
    assert.ok(/終場：南韓 和 葡萄牙 1 比 1 平手/.test(lead) && /轉折：第 24 分鐘，南韓的孫興慜頭球破門/.test(lead), lead);
    const rc2 = T.recapBlock({ ...goalModel, events: [], minute: { phase: "ft", state: "post", period: 2, base: 90, label: "完賽" } });
    assert.ok(/可確認賽果/.test(rc2.textContent) && /待補/.test(rc2.textContent));
    ok("復盤：比分→轉折→調整；只有比分時標可確認賽果、其餘待補");
    {
      const src = require("fs").readFileSync(require("path").join(__dirname, "../../shared/extlive.js"), "utf8");
      const X = new Function(src + "; return { extParse };")();
      assert.deepStrictEqual(X.extParse("https://www.flashscore.com/match/abc/#/match-summary"), { site: "flashscore", url: "https://www.flashscore.com/match/abc/#/match-summary" });
      assert.strictEqual(X.extParse('<iframe id="sofa" src="https://widgets.sofascore.com/embed/lineups?id=123&widgetTheme=dark" frameborder="0"></iframe>').widget, "https://widgets.sofascore.com/embed/lineups?id=123&widgetTheme=dark");
      assert.strictEqual(X.extParse('<iframe src="https://www.sofascore.com/event/7713313/lineups/embed" frameborder="0"></iframe>').widget, "https://www.sofascore.com/event/7713313/lineups/embed");
      assert.strictEqual(X.extParse("https://www.sofascore.com/football/match/a-b/xyz").url, "https://www.sofascore.com/football/match/a-b/xyz");
      assert.strictEqual(X.extParse("https://evil.example/x"), null);
      assert.strictEqual(X.extParse("http://www.fotmob.com/x"), null);
      ok("三平台：辨識本場網址與 Sofascore 嵌入代碼，拒絕其他網站");
    }
  }
  for (const v of ["table", "motive", "motive2", "script", "market"]) {
    const node = v2Render(model, v);
    assert.ok(node && node.textContent.length > 100, v);
    assert.ok(!/undefined|NaN|\[object/.test(node.textContent), `${v} 出現未處理的值：` + (/.{20}(undefined|NaN|\[object).{20}/.exec(node.textContent) || [""])[0]);
  }
  ok("四個新分頁都能渲染，沒有 undefined／NaN");
  const liveSc = { scenarios: [
    { label: "主隊再進 1 球", hs: 3, as: 0, rows: [{ id: "KOR", rank: 1 }] },
    { label: "維持目前比分", hs: 2, as: 0, rows: [{ id: "KOR", rank: 2 }] },
    { label: "客隊再進 1 球", hs: 2, as: 1, rows: [{ id: "KOR", rank: 2 }] }
  ] };
  assert.strictEqual(m2RankAfter(liveSc, "KOR", "home", "draw"), null);
  assert.strictEqual(m2RankAfter(liveSc, "KOR", "home", "loss"), null);
  assert.strictEqual(m2RankAfter(liveSc, "KOR", "home", "win"), null);
  assert.strictEqual(m2Grade({ rank: 4 }, [{ code: "unknown", label: "晉級" }], null), null);
  assert.strictEqual(m2Grade({ rank: 4 }, [{ code: "clinched", label: "晉級" }, { code: "out", label: "頭名" }], null).id, "none");
  ok("進行中的再進一球不當成平局或輸球；未知出線狀態不標成無欲無求");
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
  {
    apiDown = false; stCache.clear(); v2Store.clear(); state.model = model;
    await loadV2(model, true);
    localStorage.setItem("fb-ai-endpoint", "https://ai.test/");
    const realFetch = global.fetch;
    let reply = "南韓 1:1 葡萄牙，控球 62%";
    global.fetch = async (url, init) => String(url).startsWith("https://ai.test") ? { ok: true, status: 200, json: async () => ({ ok: true, text: reply, model: "deepseek-chat" }) } : realFetch(url, init);
    const sit2 = v2Sit(model);
    const sec = cmFacts(model, sit2, motivation(model, sit2))[0];
    const cm = { style: "mix", secs: 30 };
    await aiRewrite(model, sec, cm);
    assert.ok(/已擋下/.test(aiBlock(model, sec, cm).textContent), "多出來的數字要擋下");
    reply = sec.facts[0];
    await aiRewrite(model, sec, cm);
    assert.ok(/複製 AI 稿/.test(aiBlock(model, sec, cm).textContent));
    const page = v2Render(model, "script").textContent;
    assert.ok(/AI 改寫/.test(page), page.slice(0, 300));
    assert.ok(!/undefined|NaN/.test(page), (/.{30}(undefined|NaN).{30}/.exec(page) || [""])[0]);
    global.fetch = realFetch;
    localStorage.removeItem("fb-ai-endpoint");
    await wait(30);
    const p2 = v2Render(model, "script").textContent;
    for (const k of ["近10場進球", "近10場丟球", "歷史交手", "盤口走勢", "贏盤率", "大小分", "資金走勢"]) assert.ok(p2.includes(k), k);
    assert.ok(/南韓\d+球（2場）/.test(p2) && /資料不足/.test(p2) && !/undefined|NaN/.test(p2), p2.slice(p2.indexOf("賽前條列"), p2.indexOf("賽前條列") + 400));
    model.odds = { moneyline: {}, spread: { home: { close: { line: -0.25, decimal: 1.9 } }, away: { close: { line: 0.25, decimal: 1.9 } } }, total: { over: { close: { line: 2.5, decimal: 1.9 } }, under: { close: { line: 2.5, decimal: 1.9 } } } };
    const p3 = v2Render(model, "script").textContent;
    model.odds = null;
    assert.ok(/以本場-0.25回套近況：南韓\d+%、葡萄牙\d+%/.test(p3) && /場大於2.5/.test(p3) && !/undefined|NaN/.test(p3), p3.slice(p3.indexOf("賽前條列"), p3.indexOf("賽前條列") + 500));
    await ensureDeepH2H(model);
    const hs = h2hSummary(model, 10);
    assert.strictEqual(hs.total, 1, "本場當天的資料不算進交手");
    assert.ok(/近1次南韓1勝0和0負/.test(v2Render(model, "script").textContent));
    assert.ok(/2002 世界盃朴智星破門/.test(h2hBlock(model).textContent) && /查證/.test(h2hBlock(model).textContent));
    ok("條列分析：近期進失球來自賽程，沒有盤口的項目標資料不足；有盤口時回套算贏盤率、大小走勢");
    ok("AI 改寫：前端再檢查一次數字，亂加的擋下、照抄的可複製；沒有任何 Key");
  }
  console.log(`\n全部通過：${n} 項`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
