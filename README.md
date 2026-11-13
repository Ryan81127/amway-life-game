# 人生升級：安麗闖關

單頁靜態網頁遊戲。六個區域、地圖冒險：從新人走到卓越新星，邊玩邊看《安麗新人手冊》與《卓越新星計劃》的內容。角色會依進度進化，結局集齊自由、家庭、希望、獎勵四顆基石。

線上版本：<https://ryan81127.github.io/amway-life-game/>

## 城市任務版（升級城）

`city/index.html` 是開放城市風格的版本：俯視角城市地圖，可以走路、上車開車、甩尾，接 6 個任務（對應六章內容），開過「答題閘門」作答，答錯會增加謠言值、被謠言車追。

線上網址：<https://ryan81127.github.io/amway-life-game/city/>

新增「分享 OPP」：走路靠近路人按 T／💬 開口，對方會依機率加入直銷商（27.5%）、生活會員（22.5%）、安麗之友（22.5%）或婉拒（27.5%）；加入的夥伴每天隨機購買產品（NT$2,000～5,000，直銷商偶有 BV 40,000 大訂單），統計在手機 📱 →「團隊」。遊戲內有晝夜循環（1 天約 4 分鐘）。路邊有共享單車與共享電動機車可騎（速度：走路＜單車＜機車＜汽車），路口有紅綠燈。

題目與知識卡直接讀取 `src/data.js`，改那裡兩個版本會一起更新。進度存在瀏覽器（`amway-city-v1`），手機 📱 → 設定可以重置。

## 怎麼改文字與聯絡方式

遊戲內容的來源是 `src/`，不要只改 `index.html`。`index.html` 是建置產物，下次執行 `build.sh` 會被蓋掉。

聯絡方式在 `src/data.js` 最上面的 `window.AMWAY_GAME_CONFIG`（遊戲裡讀成 `CFG`）。LINE 與電話目前是空的，填進去即可：

| 欄位 | 用途 |
| --- | --- |
| `distributorName` | 結局「想更了解？跟 ○○ 聊聊」的名字（目前是 `Ryan`） |
| `lineUrl` | LINE 連結。有填的話，結局會出現「LINE 聊聊」按鈕 |
| `lineId` | LINE ID。沒有 `lineUrl` 時改顯示這一行 |
| `phone` | 電話。有填的話，結局會出現可撥打的電話按鈕 |
| `hopeUrl` | 希望工場連結 |
| `hopeName` | 希望工場名稱 |
| `videos` | 結局解鎖的 YouTube 影片（`id`、`url`、`t`） |

關卡文字也在同一個檔案的 `AREAS`：區域名稱 `name`、章節 `ch`、開場 `story`、圖鑑 `cards`、知識對戰 `qs`，以及射擊題 `shoot`、神殿快問 `fast`。收入說明字串是檔案裡的 `DISC`。

版面與樣式在 `src/head.html`。玩法程式在 `src/game.js`。

## 怎麼重新建置

`index.html` 是把這三個檔案接起來：

1. `src/head.html`
2. `<script>`，接著 `src/data.js`、`src/game.js`
3. `</script></body></html>`

在專案根目錄執行：

```bash
bash build.sh
```

腳本會同時寫出 `index.html` 與 `人生升級-安麗闖關v2.html`（兩份內容相同）。改完 `src/` 後先建置，再把變更推上 `main`。

## 部署

推上 `main` 會跑 `.github/workflows/pages.yml`，用 GitHub Actions 發佈到 GitHub Pages。網站根目錄就是這個儲存庫（`index.html` 是進入點）。

若 Actions 無法自動開啟 Pages，到這個儲存庫的 **Settings → Pages → Source**，選 **GitHub Actions**。
