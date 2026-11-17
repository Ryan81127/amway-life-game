/* 足球看板｜AI 口播改寫（Cloudflare Worker）
   - 前端只送「已經算好的事實句」，這裡請模型改寫成口播，不准新增事實。
   - API Key 只存在 Cloudflare 的 Secret（AI_KEY），不會出現在 GitHub Pages。
   - 任何 OpenAI 相容的服務都能用：改 AI_BASE_URL / AI_MODEL 就能換（預設 DeepSeek）。
   - 回傳前檢查：改寫稿裡出現的每個數字都必須在原始事實裡出現過，否則標記 ok:false，前端會改用模板稿。 */

const STYLE = {
  mix: "台灣體育直播主播的自然口吻，有一點互動感",
  pro: "冷靜專業的分析口吻",
  casual: "像跟朋友聊天的口語",
  hype: "熱血、節奏快的激情口吻",
  fun: "輕鬆幽默、會跟觀眾互動",
  brief: "極精簡、只講重點"
};
const LEN = { 15: 70, 30: 135, 60: 260 };

function cors(origin, env) {
  const allow = (env.ALLOWED_ORIGINS || "https://ryan81127.github.io").split(",").map((s) => s.trim());
  const ok = allow.includes(origin);
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : allow[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin"
    }
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}

/* 把中文數字以外的阿拉伯數字抓出來比對（含 1:0、0.75、65' 這類） */
function numbers(s) {
  return (String(s).match(/\d+(?:\.\d+)?/g) || []).map((x) => String(Number(x)));
}

export function checkNumbers(facts, text) {
  const have = new Set(numbers(facts.join(" ")));
  const extra = numbers(text).filter((n) => !have.has(n));
  return { ok: extra.length === 0, extra: [...new Set(extra)] };
}

export function buildPrompt({ title, facts, style, secs, lang }) {
  const len = LEN[secs] || 135;
  const sys = [
    "你是體育直播主播的口播改寫助手。",
    "只能改寫使用者提供的事實句，讓它變成順口、適合直接念出來的口播稿。",
    "嚴格規則：",
    "1. 不可以新增任何事實、數字、球員、傷停、賠率、歷史戰績或預測；不確定的就不要說。",
    "2. 所有數字必須照原文，不可換算、不可四捨五入、不可改成中文數字。",
    "3. 標示為「推測」或「模型」的內容，口播裡要保留「可能」「模型估計」這類保留語氣。",
    "4. 不要使用 emoji、不要加標題、不要條列，只輸出一段口播文字。",
    `5. 長度約 ${len} 個字（大約 ${secs} 秒），寧可短不可長；事實放不下就挑重要的講。`,
    lang === "cn" ? "6. 使用簡體中文與大陸常用說法。" : "6. 使用繁體中文與台灣常用說法。"
  ].join("\n");
  const user = `段落：${title}\n風格：${STYLE[style] || STYLE.mix}\n事實句：\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}`;
  return { sys, user, maxTokens: Math.min(600, Math.round(len * 2.2)) };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const c = cors(origin, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c.headers });
    if (req.method === "GET") return json({ ok: true, service: "fb-commentary", model: env.AI_MODEL || "deepseek-chat" }, 200, c.headers);
    if (req.method !== "POST") return json({ error: "method" }, 405, c.headers);
    if (!c.ok) return json({ error: "origin not allowed" }, 403, c.headers);
    if (!env.AI_KEY) return json({ error: "AI_KEY 尚未設定" }, 500, c.headers);
    const raw = await req.text();
    if (raw.length > 6000) return json({ error: "too large" }, 413, c.headers);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400, c.headers); }
    const facts = Array.isArray(body.facts) ? body.facts.filter((x) => typeof x === "string" && x.trim()).slice(0, 12).map((x) => x.slice(0, 300)) : [];
    if (!facts.length) return json({ error: "沒有事實句" }, 400, c.headers);
    const secs = [15, 30, 60].includes(Number(body.secs)) ? Number(body.secs) : 30;
    const p = buildPrompt({ title: String(body.title || "").slice(0, 40), facts, style: String(body.style || "mix"), secs, lang: body.lang === "cn" ? "cn" : "tw" });
    const base = (env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
    let r;
    try {
      r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_KEY}` },
        body: JSON.stringify({
          model: env.AI_MODEL || "deepseek-chat",
          temperature: 0.7,
          max_tokens: p.maxTokens,
          messages: [{ role: "system", content: p.sys }, { role: "user", content: p.user }]
        })
      });
    } catch {
      return json({ error: "AI 服務連不上" }, 502, c.headers);
    }
    if (!r.ok) return json({ error: `AI 服務回應 ${r.status}` }, 502, c.headers);
    const data = await r.json().catch(() => null);
    const text = String(data?.choices?.[0]?.message?.content || "").replace(/\s+/g, " ").trim();
    if (!text) return json({ error: "AI 沒有回傳內容" }, 502, c.headers);
    const chk = checkNumbers(facts, text);
    return json({ ok: chk.ok, text, extra: chk.extra, model: data?.model || env.AI_MODEL || "deepseek-chat", usage: data?.usage || null }, 200, c.headers);
  }
};
