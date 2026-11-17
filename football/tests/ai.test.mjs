// 執行：node football/tests/ai.test.mjs
import assert from "assert";
import worker, { checkNumbers, buildPrompt } from "../ai-worker/worker.js";
let n = 0;
const ok = (s) => { n += 1; console.log("  ✓ " + s); };

const facts = ["南韓目前 1:1 葡萄牙，排第 3。", "再進 1 球就能晉級。"];
assert.ok(checkNumbers(facts, "南韓 1 比 1，只要再進 1 球就晉級，現在排第 3").ok);
const bad = checkNumbers(facts, "南韓 1:1，控球率 62%，再進 1 球晉級");
assert.ok(!bad.ok && bad.extra.includes("62"));
ok("數字檢查：原文沒有的 62 會被擋下");

const p = buildPrompt({ title: "積分", facts, style: "hype", secs: 15, lang: "tw" });
assert.ok(p.sys.includes("不可以新增任何事實") && p.sys.includes("70") && p.user.includes("2. 再進 1 球"));
ok("提示詞：禁止新增事實、長度與事實編號");

const env = { AI_KEY: "k", ALLOWED_ORIGINS: "https://ryan81127.github.io" };
let sent = null;
globalThis.fetch = async (url, init) => { sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization }; return new Response(JSON.stringify({ model: "deepseek-chat", choices: [{ message: { content: "兄弟們，南韓 1:1 葡萄牙，再進 1 球就晉級！" } }] }), { status: 200 }); };
const req = (origin, body) => new Request("https://w.test/", { method: "POST", headers: { Origin: origin, "content-type": "application/json" }, body: JSON.stringify(body) });
let r = await worker.fetch(req("https://evil.test", { facts }), env);
assert.strictEqual(r.status, 403);
ok("其他網站呼叫一律拒絕");
r = await worker.fetch(req("https://ryan81127.github.io", { title: "積分", facts, style: "mix", secs: 30 }), env);
const j = await r.json();
assert.strictEqual(r.status, 200); assert.ok(j.ok); assert.strictEqual(sent.url, "https://api.deepseek.com/chat/completions");
assert.strictEqual(sent.auth, "Bearer k"); assert.strictEqual(r.headers.get("Access-Control-Allow-Origin"), "https://ryan81127.github.io");
ok("正常改寫：Key 只在後端、預設 DeepSeek、CORS 正確");
r = await worker.fetch(req("https://ryan81127.github.io", { facts: [] }), env);
assert.strictEqual(r.status, 400);
r = await worker.fetch(req("https://ryan81127.github.io", { facts }), { ...env, AI_KEY: "" });
assert.strictEqual(r.status, 500);
ok("沒有事實句或沒設 Key 時回錯誤，不會亂產生");
console.log(`ai: ${n} 項通過`);
