# 查證故事卡製作說明（給 Claude）

使用者在對話中貼上「幫 A 對 B 做故事卡（event…）」時照此製作（不使用定時任務）：
1. 讀 GitHub issues（label `story-request`，狀態 open），每個 issue 內有 event、league、home/away 的 ESPN 隊伍 id 與名稱、開賽時間。
2. 若請求不足 5 場，再從 ESPN 賽程（未來 30 小時內開賽）主動挑：國際賽（fifa.friendly、fifa.worldq.*、uefa.nations）與五大聯賽、歐冠的焦點戰，總數最多 6 場。已在 `queue.json` 的 `done` 裡、且兩隊檔案 30 天內更新過的跳過。
3. 每場查證後寫入 `cards/teams/{teamId}-{slug}.json`（格式同既有檔案），兩隊之間的故事寫在其中一隊檔案的 `rivals.{對手id}`。
4. 更新 `cards/index.json` 的 `teams` 對照、`updated`；更新 `cards/queue.json` 的 `done`、`teams`、`updated`，清掉已完成的 `queued`。
5. commit、push 到 main，並在 issue 留言「已完成，按重新整理故事」後關閉。

卡片原則：每張事實要有可點的來源與查證日期；台灣繁體用語；優先寫「兩隊恩怨與交手故事、近期大事（爆冷、轉會、教練、傷停）、隊史紀錄與冷知識、明星球員故事」，不要只寫「某某是某國國家隊」這種介紹。沒把握的寫 `status: "需更新"`，查不到可靠來源的不要寫。
