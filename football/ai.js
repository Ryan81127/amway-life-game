/* AI 口播改寫（前端）：只把 cmFacts() 的事實句送到你自己的 Cloudflare Worker，
   Worker 再去呼叫 DeepSeek 等模型。這裡沒有任何 API Key。
   改寫稿裡出現原始事實沒有的數字，就不給複製，改用模板稿。 */

const AI_EP_KEY = "fb-ai-endpoint";
const aiCache = new Map();

function aiEndpoint() {
  try { return localStorage.getItem(AI_EP_KEY) || ""; } catch { return ""; }
}

function aiSetEndpoint(url) {
  const v = String(url || "").trim();
  try { if (v) localStorage.setItem(AI_EP_KEY, v); else localStorage.removeItem(AI_EP_KEY); } catch { /* 略過 */ }
}

function aiNums(s) {
  return (String(s).match(/\d+(?:\.\d+)?/g) || []).map((x) => String(Number(x)));
}

function aiCheck(facts, text) {
  const have = new Set(aiNums(facts.join(" ")));
  const extra = [...new Set(aiNums(text).filter((n) => !have.has(n)))];
  return { ok: !extra.length, extra };
}

function aiKey(model, sec, cm) {
  return [model.id, sec.id, cm.style, cm.secs, typeof locale === "function" ? locale() : "tw", sec.facts.join("|")].join("§");
}

async function aiRewrite(model, sec, cm) {
  const ep = aiEndpoint();
  const key = aiKey(model, sec, cm);
  if (!ep) return;
  aiCache.set(key, { status: "loading" });
  maybeRender({ soft: true });
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: sec.title, facts: sec.facts, style: cm.style, secs: cm.secs, lang: typeof locale === "function" ? locale() : "tw" })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) throw new Error(data.error || `HTTP ${res.status}`);
    const chk = aiCheck(sec.facts, data.text);
    aiCache.set(key, { status: chk.ok && data.ok !== false ? "ok" : "bad", text: data.text, extra: [...new Set([...(data.extra || []), ...chk.extra])], model: data.model, at: Date.now() });
  } catch (err) {
    aiCache.set(key, { status: "error", error: String(err.message || err) });
  }
  maybeRender({ soft: true });
}

function aiSettings() {
  const ep = aiEndpoint();
  const input = h("input", { type: "url", class: "ai-ep", placeholder: "https://xxx.workers.dev", value: ep });
  return h("details", { class: "fold", "data-k": "ai-set", open: !ep },
    h("summary", null, ui(ep ? "✨ AI 改寫：已設定" : "✨ AI 改寫：尚未設定（點開設定）")),
    h("p", { class: "faint" }, ui("填入你自己部署的 Cloudflare Worker 網址。API Key 只放在 Cloudflare，不會出現在這個網頁。AI 只能改寫下方的事實句；改寫稿出現原始事實沒有的數字時，會擋下並改用模板稿。")),
    h("div", { class: "chips" }, input,
      h("button", { class: "chip", onclick: () => { aiSetEndpoint(input.value); aiCache.clear(); maybeRender({ soft: true }); } }, ui("儲存")),
      ep ? h("button", { class: "chip", onclick: () => { aiSetEndpoint(""); aiCache.clear(); maybeRender({ soft: true }); } }, ui("清除")) : null));
}

/* 每個段落底下的 AI 區塊 */
function aiBlock(model, sec, cm) {
  if (!aiEndpoint()) return null;
  const r = aiCache.get(aiKey(model, sec, cm));
  const btn = h("button", { class: "chip", disabled: r?.status === "loading", onclick: () => aiRewrite(model, sec, cm) }, ui(r?.status === "loading" ? "AI 改寫中…" : r ? "✨ 再改寫一次" : "✨ AI 改寫"));
  if (!r || r.status === "loading") return h("div", { class: "ai-out" }, btn);
  if (r.status === "error") return h("div", { class: "ai-out" }, h("p", { class: "muted" }, ui(`AI 改寫失敗：${r.error}。請用上方模板稿。`)), btn);
  if (r.status === "bad") return h("div", { class: "ai-out bad" }, h("p", { class: "muted" }, ui(`AI 稿出現原始事實沒有的數字（${r.extra.join("、")}），已擋下，請用上方模板稿。`)), btn);
  const text = speak(r.text);
  const copy = h("button", { class: "copy" }, ui("複製 AI 稿"));
  copy.addEventListener("click", () => copyText(text, copy));
  return h("div", { class: "ai-out" },
    h("div", { class: "script-k" }, ui(`AI 改寫｜${text.length} 字｜${r.model || ""}｜只重述上方事實`)),
    h("p", { class: "say" }, text),
    h("div", { class: "chips" }, copy, btn));
}
