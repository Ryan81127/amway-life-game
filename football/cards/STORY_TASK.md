# 查證故事卡製作說明（給 Claude）

使用者在對話中貼上「幫 A 對 B 做故事卡（event…）」時照此製作（不使用定時任務）：
1. 讀 GitHub issues（label `story-request`，狀態 open），每個 issue 內有 event、league、home/away 的 ESPN 隊伍 id 與名稱、開賽時間。
2. 若請求不足 5 場，再從 ESPN 賽程（未來 30 小時內開賽）主動挑：國際賽（fifa.friendly、fifa.worldq.*、uefa.nations）與五大聯賽、歐冠的焦點戰，總數最多 6 場。已在 `queue.json` 的 `done` 裡、且兩隊檔案 30 天內更新過的跳過。
3. 每場查證後寫入 `cards/teams/{teamId}-{slug}.json`（格式同既有檔案），兩隊之間的故事寫在其中一隊檔案的 `rivals.{對手id}`。
4. 更新 `cards/index.json` 的 `teams` 對照、`updated`；更新 `cards/queue.json` 的 `done`、`teams`、`updated`，清掉已完成的 `queued`。
5. commit、push 到 main，並在 issue 留言「已完成，按重新整理故事」後關閉。

卡片原則：每張事實要有可點的來源與查證日期；台灣繁體用語；優先寫「兩隊恩怨與交手故事、近期大事（爆冷、轉會、教練、傷停）、隊史紀錄與冷知識、明星球員故事」，不要只寫「某某是某國國家隊」這種介紹。沒把握的寫 `status: "需更新"`，查不到可靠來源的不要寫。

## 球員身價（每次製作故事卡時一併做）

在球隊檔案最外層加 `squad`（來源以 Transfermarkt 為主，查不到的球員不要猜）：

```json
"squad": {
  "source": { "name": "Transfermarkt", "url": "..." },
  "checked": "2026-11-13",
  "count": 26,
  "total": 123000000,
  "players": [ { "name": "Diego Gómez", "pos": "M", "value": 25000000 } ]
}
```
`value` 與 `total` 用歐元整數；`pos` 用 G/D/M/F。

## 教練（每次製作故事卡時一併做）

在球隊檔案最外層加 `coach`：`name`、`hook`（一句讓人想聽下去的介紹）、`achievements`（豐功偉業：冠軍、成名戰、紀錄）、`style`（戰術招牌、帶兵風格、換人習慣）、`quote`（名言）、`watch`（今晚看他什麼）、`sources`、`checked`。

## 歷史交手（每次製作故事卡時一併做）

看板會先用 ESPN 近 9 季賽程自動算交手；這裡補 ESPN 沒有的更早年份與交手故事。
來源依序：雷速（m.leisu.com，用內建瀏覽器開，等 1–2 分鐘資料才會出現）、FootyStats、Transfermarkt、維基百科；至少兩個來源比分一致才寫。

寫入 `cards/h2h/{小id}-{大id}.json`（兩隊 ESPN id 由小到大），並在 `cards/index.json` 加 `"h2h": { "小id-大id": "h2h/小id-大id.json" }`：

```json
{
  "pair": ["359", "363"],
  "checked": "2026-11-17",
  "sources": [ { "name": "雷速", "url": "..." }, { "name": "Transfermarkt", "url": "..." } ],
  "games": [ { "date": "2019-05-29", "home": "363", "away": "359", "hs": 4, "as": 1, "comp": "歐霸決賽" } ],
  "notes": [ "2019 歐霸決賽在巴庫，切爾西 4:1 大勝" ]
}
```
`home`/`away` 用 ESPN 隊伍 id、`hs`/`as` 為正規時間＋延長賽比分（PK 寫進 notes）。最多寫最近 20 場；notes 最多 3 條、每條一句。查不到可靠來源就不寫該場。
