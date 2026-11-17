# AI 口播改寫後端（Cloudflare Worker）

看板的「主播口播」分頁會把**已經算好的事實句**送到這個 Worker，Worker 再請模型改寫成口播。
API Key 只存在 Cloudflare，不會進 GitHub。

## 一次性部署（約 10 分鐘，免費方案即可）

1. 到 DeepSeek 開放平台（platform.deepseek.com）註冊、儲值少量金額、建立 API Key。
2. 到 Cloudflare（dash.cloudflare.com）註冊免費帳號。
3. 在電腦上（需要 Node.js）進到這個資料夾：
   ```
   cd football/ai-worker
   npx wrangler login
   npx wrangler secret put AI_KEY      # 貼上 DeepSeek 的 Key
   npx wrangler deploy
   ```
   完成後會顯示一個網址，例如 `https://fb-commentary.xxx.workers.dev`。
4. 打開看板任一場比賽 →「主播口播」分頁 →「✨ AI 改寫」→ 貼上網址 → 儲存。

不想裝 Node.js：Cloudflare 後台 → Workers & Pages → Create → 貼上 `worker.js` 內容，
再到 Settings → Variables 新增 `AI_KEY`（選 Encrypt）、`ALLOWED_ORIGINS`、`AI_BASE_URL`、`AI_MODEL`。

## 換模型

改 `wrangler.toml` 的 `AI_BASE_URL`、`AI_MODEL`，重新設定 `AI_KEY` 後 `npx wrangler deploy`。
任何 OpenAI 相容的服務都可以（例如通義千問、Moonshot、OpenRouter）。

## 安全與防亂寫

- 只接受 `ALLOWED_ORIGINS` 的網頁呼叫；請求超過 6000 字、事實句超過 12 句會被截掉。
- 提示詞要求：不可新增事實、數字照抄、推測要保留「可能」。
- 回傳前檢查：改寫稿裡的每個數字都必須出現在原始事實句裡，否則標記不通過，前端擋下改用模板稿。
- 這個檢查擋得住亂編數字，擋不住所有措辭上的誇大；上線口播前仍請主播看一眼。

## 費用估算

一次改寫約 400 輸入 token＋200 輸出 token。依 DeepSeek 公開價格，每次不到新台幣 0.1 元；
一場比賽改寫 10 次也只是幾毛錢。Cloudflare Workers 免費方案每天 10 萬次請求。
（價格會變動，請以官方價目表為準。）
