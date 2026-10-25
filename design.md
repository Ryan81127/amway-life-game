# 人生升級：安麗闖關 v2 — 設計文件

Structure (per 小安管家 steering): MapleStory-inspired side-view town map with 6 areas (original art: emoji/CSS/canvas). Character evolves 🌱新人 → 🌿生活會員 (after A1) → 🌳直銷商 (after A3) → 🌟卓越新星 (after A6). Areas 1–5 = 新人手冊 chapters; bonus math only in Area 6.

Each area loop: story intro (~20s) → action mini-game (60–90s) → 知識對戰 (3–4 Q, ~40s) → result: 3 stars (速度/正確/零陷阱), EXP + level-up, companion, badge (+secret badge on 3★ perfect), knowledge cards into 寶物圖鑑, gem (cornerstone).

| # | Area | Chapter | Mini-game | Knowledge covered | Companion | Gem | Est. time |
|---|---|---|---|---|---|---|---|
|1|初始村・選擇夥伴|01 認識身份|Starter pick + stat-card matching (15 cells)|3 身份: 費用/8折上限/門市/長客/事業權益/續約費, 押金可退, 加入兩方式, 入會費不得退還|🐣 啾啾|家庭|~2.5 min|
|2|好康磚塊城|02 新人好康|Brick breaker; perks drop with time limits, catch correct|5 重送 & 期限, 折扣上限, 限本人/1次|🐱 磚磚喵|—|~2.5 min|
|3|長客計畫跑酷|03 長客計畫|Runner: collect 期 1–12, 6→100% 券, 12→120% 券; jump trap-rules|83 折, 免運, 出貨日, 四步驟, 四規則, 續約 500/200 & 3 個月緩衝|🐰 期期兔|自由|~2.5 min|
|4|數位工具射擊場|04 Am-Card/iShare/安麗空間|Shooter: shoot correct answer target|Am-Card 4 功能, 長客數據路徑, iShare/行動大學, 6 據點, 維修, 營業時間, 小安/專線, 官方社群|🦉 雷達鴞|—|~2.5 min|
|5|賦能神殿|05 賦能|Quick-answer boss battle (HP bar, combo)|北醫三門課, 學分證明不授學位, 皮膚班 2026, 最後陷阱「證書＝國家營養師？」→ 否|🐢 智慧龜|希望|~2 min|
|6|魔王塔・卓越新星|卓越新星計劃|Tower builder: open 分店 A–D (town grows), rate meter 3%→21%, tap-timing + calc battle|級距表, 2,228→12,739→98,076 (示範試算), 差額概念, 領導獎金 6%, 獎金類別|🐉 星耀龍|獎勵|~3 min|

Ending (all 4 gems): 四大基石 story, 希望工場 (2012) link, 4 YouTube unlock videos, share card, CTA 「想更了解？跟 Ryan 聊聊」(LINE/phone config).

Octalysis: CD1 meaning (gems→希望工場 ending), CD2 stars/EXP/badges, CD3 town growth from 分店 choices, CD4 圖鑑 %/hats/companions, CD5 local leaderboard + share image, CD6 gentle: daily 2× EXP 幸運加倍 once/day; retries always free, no countdowns outside gameplay, CD7 locked silhouette of next companion + mystery line. No fear tactics.
Cosmetic hats unlock by total stars: 3★🎓 6★🎩 9★👑 12★🪖 15★✨ 18★🌈(all).
Compliance: footer 「直銷商個人製作，非安麗官方網站」; all income figures 「示範試算，非保證收入、因人而異」; no 「零風險」; HQ/分店 metaphor = building your own customer service network, not 拉人頭.
Debug hook: `window.__game.win()` completes current mini-game perfectly; `__game.answerAll()` answers battle correctly.
