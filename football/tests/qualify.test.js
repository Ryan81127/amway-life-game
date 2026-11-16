/* 執行：node football/tests/qualify.test.js
   涵蓋：勝平負積分、同分淨勝球、對戰成績優先、提前晉級／淘汰、需要其他場次配合、
   同組另一場進球（2022 世界盃 H 組韓國／烏拉圭）、賽制不同、點球決勝、兩回合淘汰賽、區域說明解析。 */
const assert = require("assert");
const R = require("../rules.js");
const Q = require("../qualify.js");

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("  ✓ " + name); };
const m = (id, home, away, hs, as) => ({ id, home, away, hs, as });
const rankOf = (t, id) => t.rows.find((r) => r.id === id).rank;

const WC22 = R.rulesFor("fifa.world", 2022);
const WC26 = R.rulesFor("fifa.world", 2026);
const UNL = R.rulesFor("uefa.nations", 2026);
const EPL = R.rulesFor("eng.1", 2026);
const LIGA = R.rulesFor("esp.1", 2026);

console.log("規則載入");
test("不同賽季的世界盃載入不同規則", () => {
  assert.strictEqual(WC22.tiebreak[0], "gd");
  assert.strictEqual(WC26.tiebreak[0], "h2h_pts");
  assert.deepStrictEqual(WC26.bestThird, { take: 8, of: 12 });
});
test("沒有規則的賽事回傳 null（不可套用別的賽事）", () => {
  assert.strictEqual(R.rulesFor("fifa.friendly", 2026), null);
  assert.strictEqual(R.rulesFor("xxx.1", 2026), null);
});

console.log("積分與同分");
test("勝 3 分、平 1 分、負 0 分", () => {
  const t = Q.rankTable(["A", "B", "C"], [m(1, "A", "B", 2, 0), m(2, "B", "C", 1, 1)], EPL);
  const row = (id) => t.rows.find((r) => r.id === id);
  assert.strictEqual(row("A").pts, 3); assert.strictEqual(row("B").pts, 1); assert.strictEqual(row("C").pts, 1);
  assert.strictEqual(row("A").w, 1); assert.strictEqual(row("B").l, 1); assert.strictEqual(row("B").d, 1);
});
test("同分先比淨勝球（英超規則）", () => {
  const t = Q.rankTable(["A", "B", "C"], [m(1, "A", "C", 3, 0), m(2, "B", "C", 1, 0), m(3, "B", "A", 1, 0), m(4, "A", "B", 1, 0)], EPL);
  assert.strictEqual(rankOf(t, "A"), 1); // A、B 都 6 分，A 淨勝球 +3、B +1；雖然對戰 1 勝 1 負
  assert.strictEqual(t.rows[0].why, "gd");
});
test("對戰成績優先（歐國聯規則）：淨勝球較差但贏了對戰的球隊排前面", () => {
  const ms = [m(1, "A", "B", 1, 0), m(2, "A", "C", 0, 1), m(3, "B", "C", 5, 0), m(4, "C", "A", 0, 1), m(5, "B", "A", 0, 0), m(6, "C", "B", 0, 1)];
  // A：1 勝 B、1 平 B → 對戰佔優；B 淨勝球遠高於 A
  const t = Q.rankTable(["A", "B", "C"], ms, UNL);
  const a = t.rows.find((r) => r.id === "A");
  const b = t.rows.find((r) => r.id === "B");
  assert.strictEqual(a.pts, b.pts);
  assert.ok(b.gd > a.gd);
  assert.ok(a.rank < b.rank);
  assert.strictEqual(a.why, "對戰成績");
  // 同樣的比賽用英超規則（先比淨勝球）結果相反
  const t2 = Q.rankTable(["A", "B", "C"], ms, EPL);
  assert.ok(rankOf(t2, "B") < rankOf(t2, "A"));
});
test("西甲：兩回合還沒踢完時不比對戰，改比淨勝球", () => {
  const ms = [m(1, "A", "B", 1, 0), m(2, "B", "C", 4, 0), m(3, "A", "C", 0, 1), m(4, "C", "A", 0, 1)];
  const t = Q.rankTable(["A", "B", "C"], ms, LIGA);
  assert.ok(rankOf(t, "B") > 0);
  const a = t.rows.find((r) => r.id === "A");
  assert.notStrictEqual(a.why, "對戰成績");
});
test("所有可用項目都相同時標為無法由資料判定，不硬排名次", () => {
  const t = Q.rankTable(["A", "B"], [m(1, "A", "B", 1, 1)], WC22);
  assert.strictEqual(t.unresolved.length, 1);
  assert.deepStrictEqual(t.rows[0].tied, ["B"]);
});

console.log("2022 世界盃 H 組（韓國／烏拉圭）回歸測試");
const H = ["POR", "GHA", "KOR", "URU"];
const before = [m(1, "URU", "KOR", 0, 0), m(2, "POR", "GHA", 3, 2), m(3, "KOR", "GHA", 2, 3), m(4, "POR", "URU", 2, 0)];
const kp = (hs, as) => m(5, "KOR", "POR", hs, as);
const gu = (hs, as) => m(6, "GHA", "URU", hs, as);
test("第三輪開踢前的積分：葡 6、迦 3、韓 1、烏 1", () => {
  const t = Q.rankTable(H, before, WC22);
  assert.deepStrictEqual(t.rows.map((r) => [r.id, r.pts]).slice(0, 2), [["POR", 6], ["GHA", 3]]);
});
test("賽前形勢：葡萄牙已確定晉級；韓國、烏拉圭都必須取勝", () => {
  const o = Q.outlook(H, before, [kp(NaN, NaN), gu(NaN, NaN)], WC22, 2);
  assert.strictEqual(Q.statusOf(o.get("POR")).code, "clinched");
  assert.strictEqual(Q.statusOf(o.get("KOR")).code, "mustWin");
  assert.strictEqual(Q.statusOf(o.get("URU")).code, "mustWin");
  assert.ok(["drawEnough", "winEnough"].includes(Q.statusOf(o.get("GHA")).code));
  assert.strictEqual(o.get("GHA").clinchIf.W, true);
});
test("烏拉圭 2:0、韓國 1:1 時：烏拉圭暫居第二", () => {
  const t = Q.rankTable(H, before.concat([kp(1, 1), gu(0, 2)]), WC22);
  assert.strictEqual(rankOf(t, "URU"), 2);
  assert.strictEqual(rankOf(t, "KOR"), 4);
});
test("韓國進球變 2:1：烏拉圭即使 2:0 領先也掉到第三（同分、同淨勝球，韓國總進球較多）", () => {
  const t = Q.rankTable(H, before.concat([kp(2, 1), gu(0, 2)]), WC22);
  const kor = t.rows.find((r) => r.id === "KOR");
  const uru = t.rows.find((r) => r.id === "URU");
  assert.strictEqual(kor.pts, 4); assert.strictEqual(uru.pts, 4);
  assert.strictEqual(kor.gd, uru.gd);
  assert.strictEqual(kor.gf, 4); assert.strictEqual(uru.gf, 2);
  assert.strictEqual(kor.rank, 2); assert.strictEqual(uru.rank, 3);
  assert.strictEqual(kor.why, "gf");
});
test("下一球影響：韓國進球會把烏拉圭擠出晉級區；之後烏拉圭再進 1 球就能回到第二", () => {
  const base = before.concat([kp(1, 1), gu(0, 2)]);
  const fx = Q.nextGoalEffects(H, base, [kp(1, 1), gu(0, 2)], WC22, 2);
  const korGoal = fx.find((x) => x.scorer === "KOR");
  assert.ok(korGoal.changes.find((c) => c.id === "URU" && c.drops));
  assert.ok(korGoal.changes.find((c) => c.id === "KOR" && c.enters));
  const after = before.concat([kp(2, 1), gu(0, 2)]);
  assert.strictEqual(Q.goalsNeeded(H, after, [gu(0, 2)], WC22, 2, "URU"), 1);
});
test("同一批比分若用 2026 規則（先比對戰）：韓烏對戰 0:0，仍回到總進球，韓國晉級", () => {
  const t = Q.rankTable(H, before.concat([kp(2, 1), gu(0, 2)]), WC26);
  assert.strictEqual(rankOf(t, "KOR"), 2);
});

console.log("提前確定與其他場次");
test("提前確定晉級與淘汰", () => {
  const ids = ["A", "B", "C", "D"];
  const played = [m(1, "A", "B", 1, 0), m(2, "C", "D", 0, 0), m(3, "A", "C", 2, 0), m(4, "B", "D", 0, 0)];
  const left = [m(5, "A", "D", NaN, NaN), m(6, "B", "C", NaN, NaN)];
  const o = Q.outlook(ids, played, left, WC22, 2);
  assert.strictEqual(Q.statusOf(o.get("A")).code, "clinched"); // 6 分，其他人最多 4 分的只有 2 隊中的一隊能追上… A 至少第二
  const o1 = Q.outlook(ids, played, left, WC22, 1);
  assert.strictEqual(Q.statusOf(o1.get("B")).code, "out"); // B 最多 4 分，A 已有 6 分
});
test("需要其他場次配合", () => {
  const ids = ["A", "B", "C", "D"];
  const played = [m(1, "A", "B", 1, 0), m(2, "C", "D", 1, 0), m(3, "A", "C", 0, 1), m(4, "B", "D", 1, 0)];
  // C 6、A 3、B 3、D 0；最後一輪 A–D、B–C
  const left = [m(5, "A", "D", NaN, NaN), m(6, "B", "C", NaN, NaN)];
  const o = Q.outlook(ids, played, left, WC22, 2);
  const a = Q.statusOf(o.get("A"));
  assert.ok(["needHelp", "mustWin"].includes(a.code), a.code);
  assert.strictEqual(o.get("A").clinchIf.W, false); // A 贏了也可能與 B、C 同為 6 分
});
test("比賽全部踢完：未賽清單為空時，確定與否只看積分；同分交給排名表", () => {
  const ids = ["A", "B"];
  const o = Q.outlook(ids, [m(1, "A", "B", 2, 0)], [], EPL, 1);
  assert.strictEqual(Q.statusOf(o.get("A")).code, "clinched");
  assert.strictEqual(Q.statusOf(o.get("B")).code, "out");
});
test("大型聯賽用上下界：領先太多即確定，追不上即無緣", () => {
  const rows = [{ id: "A", pts: 90, p: 36 }, { id: "B", pts: 80, p: 36 }, { id: "C", pts: 70, p: 36 }];
  const b = Q.boundsOutlook(rows, 38, 1);
  assert.strictEqual(b.get("A").clinched, true);
  assert.strictEqual(b.get("B").possible, false);
  const b2 = Q.boundsOutlook([{ id: "A", pts: 82, p: 36 }, { id: "B", pts: 80, p: 36 }], 38, 1);
  assert.strictEqual(b2.get("A").clinched, false);
  assert.strictEqual(b2.get("B").possible, true);
});
test("保級目標：k 為負數時換算成名次", () => {
  assert.strictEqual(Q.targetK(-3, 20), 17);
  assert.strictEqual(Q.targetK(4, 20), 4);
});

console.log("淘汰賽");
test("兩回合總比分", () => {
  const r = R.aggregateResult({ home: "A", away: "B", hs: 1, as: 0 }, { home: "B", away: "A", hs: 2, as: 2 });
  assert.strictEqual(r.winner, "A"); assert.strictEqual(r.decidedBy, "總比分");
});
test("兩回合打平：現行歐洲賽不算客場進球，需延長賽或點球", () => {
  const r = R.aggregateResult({ home: "A", away: "B", hs: 1, as: 1 }, { home: "B", away: "A", hs: 0, as: 0 }, { awayGoals: false });
  assert.strictEqual(r.winner, null); assert.strictEqual(r.pending, true);
  const old = R.aggregateResult({ home: "A", away: "B", hs: 1, as: 1 }, { home: "B", away: "A", hs: 0, as: 0 }, { awayGoals: true });
  assert.strictEqual(old.winner, "B"); assert.strictEqual(old.decidedBy, "客場進球");
});
test("兩回合打平後點球決勝", () => {
  const r = R.aggregateResult({ home: "A", away: "B", hs: 1, as: 1 }, { home: "B", away: "A", hs: 0, as: 0, shootout: { home: 3, away: 4 } });
  assert.strictEqual(r.winner, "A"); assert.strictEqual(r.decidedBy, "點球大戰");
});
test("單場淘汰賽點球決勝（2026 世界盃巴拉圭 1:1 德國，點球 4:3）", () => {
  const r = R.knockoutWinner({ home: "GER", away: "PAR", hs: 1, as: 1, extraTime: true, shootout: { home: 3, away: 4 } });
  assert.strictEqual(r.winner, "PAR"); assert.strictEqual(r.decidedBy, "點球大戰");
  assert.strictEqual(R.knockoutWinner({ home: "A", away: "B", hs: 1, as: 1 }).winner, null);
});

console.log("ESPN 區域說明");
test("歐國聯說明依級別取對應段落", () => {
  const a = R.zoneFromNote("A: Qualifies for QFs; B-D: Promotion playoffs", "Group A1");
  const b = R.zoneFromNote("A: Qualifies for QFs; B-D: Promotion playoffs", "Group B3");
  assert.strictEqual(a.type, "advance"); assert.strictEqual(a.label, "晉級八強");
  assert.strictEqual(b.type, "playoff");
  assert.strictEqual(R.zoneFromNote("A, B: Relegation; C: Relegation or playoffs", "Group C2").type, "relplayoff");
  assert.strictEqual(R.zoneFromNote("A, B: Relegation playoffs", "Group D1"), null);
});
test("聯賽與歐冠說明", () => {
  assert.strictEqual(R.zoneFromNote("Champions League", "").type, "advance");
  assert.strictEqual(R.zoneFromNote("Relegation", "").type, "relegation");
  assert.strictEqual(R.zoneFromNote("Eliminated", "").type, "out");
  assert.strictEqual(R.zoneFromNote("Knockout phase playoffs - unseeded", "").type, "playoff");
  assert.strictEqual(R.zoneFromNote("", ""), null);
});

console.log(`\n全部通過：${passed} 項`);
