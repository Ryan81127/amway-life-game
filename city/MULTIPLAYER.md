# 升級城：多人連線設定

多人連線讓輸入同一個「房間代碼」的人，在同一座城裡即時看到彼此走路、開車、騎車。玩家還可以按喇叭、打招呼、傳送到朋友旁邊。任務、分享 OPP 和團隊數字仍然是每個人各自計算。

連線用的是 Google 的 Firebase Realtime Database（免費方案）。網站照樣放在 GitHub Pages。

## 一次性設定（約 10 分鐘）

1. **建立專案**
   打開 <https://console.firebase.google.com/>，按「新增專案」。名稱可以取 `upgrade-city`，Google Analytics 可以關掉。
2. **開啟匿名登入**
   左側「建構 → Authentication」→「開始使用」→「登入方式」→ 選「匿名」→ 啟用 → 儲存。
   玩家不用註冊帳號；匿名登入只是讓每個人只能改自己的資料。
3. **建立資料庫**
   左側「建構 → Realtime Database」→「建立資料庫」→ 位置選 **新加坡（asia-southeast1）**，離台灣最近 →「以鎖定模式啟動」。
4. **貼上安全規則**
   在 Realtime Database 的「規則」分頁，把內容整個換成下面這段，按「發布」：

   ```json
   {
     "rules": {
       "rooms": {
         "$room": {
           ".read": "auth != null && $room.matches(/^[A-Z0-9]{3,8}$/)",
           "players": {
             "$uid": {
               ".write": "auth != null && auth.uid === $uid",
               ".validate": "newData.hasChildren(['n','x','y']) && newData.child('n').isString() && newData.child('n').val().length <= 10 && newData.child('x').isNumber() && newData.child('y').isNumber()"
             }
           },
           "events": {
             ".indexOn": ["t"],
             "$eid": {
               ".write": "auth != null && ((!data.exists() && newData.child('u').val() === auth.uid) || (data.exists() && !newData.exists() && data.child('u').val() === auth.uid))",
               ".validate": "newData.hasChildren(['u','ty','t']) && newData.child('ty').isString() && newData.child('ty').val().length <= 10"
             }
           }
         }
       }
     }
   }
   ```

5. **取得網頁設定**
   左上齒輪「專案設定」→「一般」→ 下方「你的應用程式」→ 按 `</>`（網頁）→ 取個暱稱 → 註冊（不用勾 Hosting）。畫面會出現一段 `firebaseConfig = { ... }`。
6. **允許網站網域**
   「Authentication → 設定 → 已授權網域」→ 新增 `ryan81127.github.io`。
7. **填入設定**
   把第 5 步的內容貼進 `city/firebase-config.js`，取代 `window.CITY_FIREBASE = null;`：

   ```js
   window.CITY_FIREBASE = {
     apiKey: "...",
     authDomain: "....firebaseapp.com",
     databaseURL: "https://....asia-southeast1.firebasedatabase.app",
     projectId: "...",
     appId: "..."
   };
   ```

   一定要有 `databaseURL`。如果第 5 步沒有出現，可以從 Realtime Database 頁面上方複製網址。
   這些是網頁用的公開設定，不是密碼，放在網站上沒問題；資料安全靠第 4 步的規則保護。

推上 `main` 之後，首頁的「👥 多人連線」就能用了。

## 怎麼玩

- **加入房間：** 首頁按「👥 多人連線（同一座城）」，輸入暱稱和房間代碼（3～8 個英文或數字）。代碼一樣的人就在同一座城。
- **邀請朋友：** 遊戲中到 📱 手機 →「連線」→「邀請朋友」，把連結傳到 LINE。朋友點開會自動帶入房間代碼。
- **連線分頁還能：** 打招呼（👋👍❤️😂🎉💪）、看在線玩家和距離、「📍 去找他」傳送到朋友旁邊（任務中不能傳送）、離開房間。
- **按喇叭：** 附近的玩家會聽到，畫面上也會顯示「叭！」。
- **全房間通知：** 有人完成任務或開口分享時，其他人會收到通知。

## 會同步、不會同步的東西

| 會同步 | 不會同步 |
|---|---|
| 暱稱、位置、方向、交通工具、角色稱號（🌱🌿🌳🌟）、正在進行的任務編號 | 團隊人數、營業額、BV、知識卡、存檔 |
| 喇叭、打招呼、完成任務、開口分享的通知 | 路上的 NPC 車流和路人（每台手機各自模擬，所以每個人看到的不一樣） |

## 免費方案用量

Firebase 免費方案（Spark）的限制：

- 同時連線上限約 100 人
- 每月下載量 10 GB

**用量估算：**

| 房間人數 | 一小時用量 | 每月可玩時數 |
|---|---|---|
| 10 人 | 約 300～350 MB | 約 30 小時 |
| 5 人 | 約 70 MB | 約 140 小時 |

如果要讓很多團隊天天一起玩，可以升級成用多少付多少的 Blaze 方案；或者請我調低同步頻率。

## 本機測試（不需要 Firebase）

網址加上 `?net=local`，例如 `city/?net=local&room=TEST`。同一個瀏覽器開兩個分頁、都按「多人連線」，就會互相看到。這個模式只用來測試，不能跨裝置。
