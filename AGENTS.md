# 專案規則（每個工作階段開始前必讀）

> 本檔與 `CLAUDE.md`／`AGENTS.md` 內容相同（`CLAUDE.md` 給 Claude、`AGENTS.md` 給 Cursor 等其他 AI 工具），修改時兩份要一起改。

這個專案是 Ryan 的 Amway 相關遊戲與工具，透過 GitHub Pages 發佈：`https://ryan81127.github.io/amway-life-game/`。
推上 `main` 就會自動上線，所以改錯一個檔案，所有網站都會一起受影響。

## 一、各資料夾歸誰

| 資料夾 | 內容 | 網址 |
|---|---|---|
| `city/` | 升級城（俠盜獵車手風格的 Amway 遊戲） | `/city/` |
| `src/`、根目錄 `index.html`、`build.sh` | 原版「人生升級：安麗闖關」 | `/` |
| `life/`、`sky/`、`plaza/` | 其他 Amway 小遊戲與人脈廣場 | 各自的資料夾 |
| `football/index.html` | **只是轉址頁。** 運動轉播看板（足球、籃球）已經搬到獨立專案 `Ryan81127/football-board`（足球 `https://ryan81127.github.io/football-board/football/`、籃球 `https://ryan81127.github.io/football-board/basketball/`）。**足球、籃球看板的修改一律到那個專案做，不要在這裡加回足球或籃球的檔案。** | `/football/` |

## 二、改動範圍

1. **只改這次任務負責的資料夾。** 改升級城就只動 `city/`；改足球看板就只動足球的檔案。不確定某個檔案屬於誰，先問 Ryan。
2. **Amway 遊戲裡不能出現籃球或任何運動看板的內容。** 籃球、足球看板都在 `football-board` 專案，不要加回這裡。
3. 不要刪除或改寫別的工作階段做的東西。合併 `main` 時如果有衝突，停下來告訴 Ryan，不要自己挑一邊蓋掉。

## 三、PR 與合併（最重要）

1. **不准自行合併 PR。** 只能開 PR，把連結交給 Ryan，由 Ryan 在 GitHub 上確認後合併。
2. 開 PR 前先確認 PR 只包含這次任務的檔案（`git diff --stat origin/main`）。
3. 回報時寫清楚 PR 編號和連結，不要只說「已完成」。
4. 不要直接推到 `main`。

## 四、升級城（`city/`）的固定規則

- 所有收入、獎金、BV 數字都要標示「示範試算，非保證收入、因人而異」。
- 頁尾保留「直銷商個人製作，非安麗官方網站」。
- 主程式是 `city/index.html`。多人連線在 `city/net.js`，天空與海景在 `city/scenery.js`，畫質設定在 `city/gfx.js`，Amway 文字資料在 `city/data-city.js` 與 `src/data.js`。

## 五、回報

- 用繁體中文回報，包括工作過程中的說明。
- 改完要實際打開頁面確認，回報時說明確認了什麼、沒確認什麼。
