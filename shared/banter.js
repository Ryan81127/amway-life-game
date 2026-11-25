/* 主播閒聊產生器（足球看板共用）：
   1. 吐槽／碎碎念／自嘲／嘮嗑：套入本場隊名、球星、教練、球場、比分、時間，按「換一批」就重抽。
   2. 押韻句與打油詩：四個韻腳家族，把本場資訊嵌進句子裡，每場、每次都不同。
   只放娛樂效果，不新增事實；用到的數字都來自看板上的資料。 */

const bnSeed = new Map();

function bnRand(seed) {
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x + 0x6d2b79f5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function bnPick(rand, list, n) {
  const pool = [...new Set(list.filter(Boolean))];
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

function bnFill(text, c) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (c[k] != null && c[k] !== "" ? c[k] : "這隊"));
}

/* 需要的欄位都有值才用這句，避免出現空白 */
function bnUsable(text, c) {
  return [...text.matchAll(/\{(\w+)\}/g)].every(([, k]) => c[k] != null && c[k] !== "");
}

function bnWords(c) {
  const fb = c.sport === "football";
  return {
    shoot: fb ? "射門" : "出手", score1: fb ? "進球" : "得分", keeper: fb ? "門將" : "防守", net: fb ? "球門" : "籃框",
    big: fb ? "世界波" : "大號三分", unit: fb ? "球" : "分", field: fb ? "球場" : "球館", foul: fb ? "黃牌" : "犯規"
  };
}

const BN_MOOD = {
  tucao: [
    "{H}今天的球衣顏色很好看，希望踢得跟球衣一樣亮眼。",
    "{A}大老遠跑來{V}，如果只是來觀光，門票錢不太划算喔。",
    "{S1}今天要是再不{score1}，球迷的耐心大概只剩下一格電。",
    "{C1}在場邊比手畫腳的樣子，比我叫外送還急。",
    "{lead}領先了，但{trail}的防線看起來像是週末早上的我，人到了魂還沒到。",
    "兩隊{shoot}的準度，讓我懷疑{net}是不是今天被調小了。",
    "{trail}再這樣下去，賽後記者會應該會很安靜。",
    "{H}主場作戰，{V}的觀眾比場上球員還有拚勁。",
    "看{A}的進攻，我想到我家的 Wi-Fi：有訊號，但就是連不上。",
    "{S2}今天的存在感，跟我減肥計畫的進度差不多。"
  ],
  mutter: [
    "{H}對{A}，這組合我想了一整天，結果開賽前還是不知道該押誰。",
    "{S1}拿球的時候，我手心都在冒汗，到底是我比賽還是他比賽？",
    "比分 {sh}:{sa}，我的心跳大概跟現場音樂一樣快。",
    "第 {min}，這時候最怕一個失誤，全部前功盡棄。",
    "{C2}今天一直站在場邊不坐下，看得出來壓力不小。",
    "{V}今天的氣氛，隔著螢幕都感覺得到。",
    "我一直在等{S2}的表現，拜託給我一個高光時刻。",
    "{trail}只差一點點，我替他們急到想自己下去。",
    "{H}今年{RH}的戰績，今天能不能再往上添一筆？",
    "每次{A}拿球，我都忍不住小聲說：快一點、快一點。"
  ],
  self: [
    "先說好，我今天押{H}，如果輸了請不要截圖。",
    "我賽前說{S1}會發威，現在講出口有點後悔，壓力好大。",
    "主播也是人，看到{lead}這樣領先，我也想站起來歡呼。",
    "我今天口播準備了三頁，現在用到第一頁就已經講錯兩個名字。",
    "我對{A}的了解，大概跟我對我家冰箱裡剩什麼一樣，模模糊糊。",
    "說真的，我比{C1}還緊張，至少他可以換人，我只能換口水。",
    "如果我今天預測準了，請記得截圖幫我宣傳，不準的話就當沒看過。",
    "我講到{S2}的名字一直怕念錯，念錯了請大家用愛包容。"
  ],
  chat: [
    "大家今天在哪裡看{H}對{A}？留言跟我說你的城市。",
    "{V}所在的{city}，有人去過嗎？當地有什麼必吃？",
    "支持{H}的扣 1，支持{A}的扣 2，看看今天誰的球迷比較多。",
    "看球一定要配點東西，今天你準備的是鹹酥雞、滷味還是泡麵？",
    "有沒有人跟我一樣，是因為{S1}才開始看這支球隊的？",
    "你心中今天的 MVP 是誰？先押一個，賽後來對答案。",
    "猜猜今天最終比分？猜中的我記在小本本上，下次幫你喊名字。",
    "如果可以帶一位球員回家當室友，{S1}跟{S2}你選誰？"
  ]
};

/* 押韻：每個家族的句子都押同一個韻腳，挑四句就是一首打油詩 */
const BN_RHYME = {
  ang: { name: "ㄤ 韻（場／強／光）", lines: [
    "{H}主場氣勢強，{A}要撐住別慌張",
    "{S1}一出手，全場都發光",
    "{V}座無虛席滿看台，今晚誰才是王",
    "{C1}場邊在盤算，戰術寫了滿滿一張",
    "比分 {sh}:{sa} 還沒定，好戲才剛開場",
    "{trail}別灰心，下一波還有希望",
    "{lead}握有領先，最怕最後鬆一場",
    "{A}遠道而來不怕生，客場也要闖一闖",
    "防守要像一道牆，{score1}要像一道光",
    "比賽說長不長，勝負全看最後的倔強"
  ] },
  ao: { name: "ㄠ 韻（跑／好／妙）", lines: [
    "{H}全場拚命跑，{A}防守要顧好",
    "{S1}腳下有魔法，每次觸球都很妙",
    "{C2}在場邊又叫又跳，戰術板畫得滿滿好",
    "比分 {sh}:{sa} 還在膠著，觀眾心臟受不了",
    "{lead}先拔頭籌心情好，{trail}可別先跌倒",
    "{shoot}要大膽，猶豫一秒機會就溜掉",
    "{V}今晚特別熱鬧，加油聲音震破屋頂高",
    "今天誰是關鍵？我猜{S2}會跑出來報到",
    "看球配宵夜最好，留言押比分別害臊"
  ] },
  i: { name: "ㄧ 韻（氣／起／力）", lines: [
    "{H}主場有底氣，{A}客場不放棄",
    "{S1}拿球就加速，對手只能看背影嘆氣",
    "比分 {sh}:{sa} 很刺激，每次攻防都是好戲",
    "{C1}運籌帷幄要沉住氣，換人時機是勝負的關鍵契機",
    "{trail}只要一{score1}，局勢立刻翻起",
    "{lead}守住這口氣，勝利就在眼皮底",
    "{V}吶喊聲四起，替{H}再加一點力",
    "{S2}今天要爭氣，球迷都在等你出擊"
  ] },
  ou: { name: "ㄡ 韻（球／手／走）", lines: [
    "{H}傳一腳好球，{A}防得滿頭大汗手發抖",
    "{S1}是最強的那隻手，關鍵時刻不放手",
    "比分 {sh}:{sa} 先別走，好戲常常在後頭",
    "{C2}眉頭深鎖不鬆口，換人布局在心頭",
    "{trail}落後先別愁，下一次進攻要搶先手",
    "{lead}領先別放鬆，最怕被追到尾巴後頭",
    "{V}今晚人潮湧，全場一起為{H}吼",
    "看球就要看到最後一秒，誰先放棄誰先走"
  ] }
};

const BN_COUPLET = [
  ["{H}守主場寸土不讓", "{A}闖客關一步不退", "橫批：今晚見真章"],
  ["{S1}出手如閃電", "{S2}回防似銅牆", "橫批：巨星對決"],
  ["主場燈火照{V}", "客隊心火燃{A}", "橫批：誰與爭鋒"],
  ["{lead}領先一步笑", "{trail}追分步步急", "橫批：好戲在後頭"],
  ["{C1}運籌帷幄", "{C2}見招拆招", "橫批：場邊鬥智"]
];

function bnBuild(ctx) {
  const w = bnWords(ctx);
  const c = { ...w, ...ctx };
  c.sh = ctx.sh ?? "";
  c.sa = ctx.sa ?? "";
  c.min = ctx.min || "";
  const diff = Number(ctx.sh) - Number(ctx.sa);
  c.lead = ctx.phase !== "pre" && diff ? (diff > 0 ? ctx.H : ctx.A) : "";
  c.trail = ctx.phase !== "pre" && diff ? (diff > 0 ? ctx.A : ctx.H) : "";
  if (ctx.phase === "pre") { c.sh = ""; c.sa = ""; c.min = ""; }
  return c;
}

function bnMood(ctx, seed) {
  const c = bnBuild(ctx);
  const rand = bnRand(`${ctx.id}|mood|${seed}`);
  const out = {};
  for (const k of Object.keys(BN_MOOD)) out[k] = bnPick(rand, BN_MOOD[k].filter((t) => bnUsable(t, c)).map((t) => bnFill(t, c)), 2);
  return out;
}

function bnRhyme(ctx, seed) {
  const c = bnBuild(ctx);
  const rand = bnRand(`${ctx.id}|rhyme|${seed}`);
  const fams = Object.keys(BN_RHYME);
  const famKey = fams[Math.floor(rand() * fams.length)];
  const fam = BN_RHYME[famKey];
  const usable = fam.lines.filter((t) => bnUsable(t, c)).map((t) => bnFill(t, c));
  const poem = bnPick(rand, usable, 4);
  /* 另外兩個家族各挑兩句當單句押韻 */
  const others = fams.filter((k) => k !== famKey);
  const singles = bnPick(rand, others, 2).map((k) => ({ fam: BN_RHYME[k].name, lines: bnPick(rand, BN_RHYME[k].lines.filter((t) => bnUsable(t, c)).map((t) => bnFill(t, c)), 2) }));
  const cp = bnPick(rand, BN_COUPLET.filter((x) => x.every((t) => bnUsable(t, c))), 1)[0];
  return { fam: fam.name, poem, singles, couplet: cp ? cp.map((t) => bnFill(t, c)) : null };
}

/* 面板：兩個可展開的區塊，各自有「換一批」與複製 */
function bnPanel(ctx, extraMood) {
  const key = ctx.id;
  const seeds = bnSeed.get(key) || { mood: 0, rhyme: 0, open: { mood: false, rhyme: true } };
  bnSeed.set(key, seeds);
  const reroll = (k) => { seeds[k] += 1; seeds.open[k] = true; maybeRender({ soft: true }); };
  const copyBtn = (lines, label) => {
    const b = h("button", { class: "copy" }, ui(label));
    b.addEventListener("click", () => copyText(lines.map((x) => (typeof speak === "function" ? speak(x) : x)).join("\n"), b));
    return b;
  };
  const kinds = [["tucao", "吐槽"], ["mutter", "碎碎念"], ["self", "自我調侃"], ["chat", "無關嘮嗑"]];
  const gen = bnMood(ctx, seeds.mood);
  const mood = {};
  for (const [k] of kinds) mood[k] = [...gen[k], ...(extraMood?.[k] || []).slice(0, 1)];
  const moodAll = kinds.flatMap(([k]) => mood[k]);
  const moodBox = h("details", { class: "banter mood bn-box", open: seeds.open.mood ? true : null, ontoggle: (e) => { seeds.open.mood = e.target.open; } },
    h("summary", null, ui("😆 吐槽／碎碎念／自嘲／嘮嗑")),
    h("div", { class: "bn-tools" }, h("button", { class: "chip bn-roll", onclick: () => reroll("mood") }, ui("🔄 換一批")), h("span", { class: "faint" }, ui(`第 ${seeds.mood + 1} 批・依本場隊名、球星、比分生成`))),
    ...kinds.flatMap(([k, label]) => (mood[k].length ? [h("h4", null, ui(label)), ...mood[k].map((x) => h("p", null, ui(x)))] : [])),
    copyBtn(moodAll, "全部複製"));
  /* 押韻依情境分類：開場、進球、僵局、終場（進球句要放在球員、動作、比分講完之後） */
  const H = ctx.H || "主隊", A = ctx.A || "客隊";
  const sh = Number(ctx.sh), sa = Number(ctx.sa);
  const hasScore = Number.isFinite(sh) && Number.isFinite(sa) && ctx.sh !== "" && ctx.sa !== "";
  const W = hasScore && sh !== sa ? (sh > sa ? H : A) : "";
  const SCENE = {
    "開場": [`${H}主場燈光亮，${A}遠道來較量。`, "哨聲一響開戰場，九十分鐘看誰強。", `${A}踏進客場來，${H}要把門守好來。`],
    "進球": [`${H}這球進得妙，全場跟著跳！`, `${A}這球進得妙，客隊球迷跟著跳！`, "球進網裡晃，氣勢一下漲！"],
    "僵局": ["比分還在膠著，誰先破門誰快活。", "你來我往不鬆手，就等一腳定春秋。", "零比零也有戲，耐心看到底。"],
    "終場": W ? [`終場哨聲響，${W}把三分帶回家鄉。`, `九十分鐘拚到底，${W}今晚寫勝利。`] : ["握手言和各一分，下回再來論輸贏。", "九十分鐘拚到底，平手收場也是戲。"]
  };
  const autoScene = ctx.phase === "pre" ? "開場" : ctx.phase === "ft" ? "終場" : hasScore && sh === sa ? "僵局" : "進球";
  if (!seeds.scene) seeds.scene = autoScene;
  const sceneBox = h("div", { class: "bn-scene" },
    h("div", { class: "chips" }, Object.keys(SCENE).map((k) => h("button", { class: `chip${seeds.scene === k ? " on" : ""}`, onclick: () => { seeds.scene = k; maybeRender({ soft: true }); } }, ui(k)))),
    seeds.scene === "進球" ? h("p", { class: "faint" }, ui("先講完球員、動作、比分，再接這句。")) : null,
    ...SCENE[seeds.scene].map((x) => h("p", { class: "say" }, ui(x))),
    copyBtn(SCENE[seeds.scene], "複製這組"));
  const r = bnRhyme(ctx, seeds.rhyme);
  const usePm = typeof pmPoem === "function";
  const poem = usePm ? pmPoem(ctx, seeds.rhyme) : null;
  const pairs = usePm ? pmCouplets(ctx, seeds.rhyme) : r.singles;
  const poemLines = usePm ? poem.lines.map((l) => l.text) : r.poem;
  const rhymeAll = [...poemLines, ...pairs.flatMap((s) => s.lines), ...(r.couplet || [])];
  const rhymeBox = h("details", { class: "banter bn-box", open: seeds.open.rhyme ? true : null, ontoggle: (e) => { seeds.open.rhyme = e.target.open; } },
    h("summary", null, ui("🎤 押韻句與打油詩")),
    h("div", { class: "bn-tools" }, h("button", { class: "chip bn-roll", onclick: () => reroll("rhyme") }, ui("🔄 重新生成")), h("span", { class: "faint" }, ui(`第 ${seeds.rhyme + 1} 版・韻式、韻腳、五七言每次輪換`))),
    h("h4", null, ui(usePm ? `本場打油詩（${poem.title}）` : `本場打油詩（${r.fam}）`)),
    h("div", { class: "bn-poem" }, usePm
      ? poem.lines.map((l) => h("p", null, ui(l.text), l.rhyme ? h("span", { class: "bn-rhyme" }, ui(` ← ${l.rhyme}`)) : null))
      : poemLines.map((x) => h("p", null, ui(x)))),
    usePm ? h("p", { class: "faint" }, ui(poem.note)) : null,
    usePm ? h("details", { class: "bn-beat" }, h("summary", null, ui("看停頓節奏")), poem.lines.map((l) => h("p", null, ui(l.show)))) : null,
    ...pairs.flatMap((s) => [h("h4", null, ui(`押韻口號（${s.fam}，上句仄收、下句平收）`)), ...s.lines.map((x) => h("p", null, ui(x)))]),
    r.couplet ? h("h4", null, ui("對聯（套入本場隊名、球星、教練）")) : null,
    r.couplet ? h("div", { class: "bn-couplet" }, r.couplet.map((x) => h("p", null, ui(x)))) : null,
    copyBtn(rhymeAll, "全部複製"));
  /* 吐槽／碎碎念／嘮嗑已移除（內容重複、幫助不大），只留押韻句與打油詩 */
  return h("div", { class: "bn-panel" }, h("h4", null, ui("情境押韻（開場／進球／僵局／終場）")), sceneBox, rhymeBox);
}
