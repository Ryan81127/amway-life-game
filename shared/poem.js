/* 打油詩產生器（足球、籃球共用）：依照韻式與節奏規則組句，不是固定範本。
   - 句式：七言（2／2／3 停頓）、五言（2／3 停頓）。
   - 韻式：隔句韻（二、四句押韻）、交韻 ABAB、抱韻 ABBA、句句韻 AAAA（少用，容易膩）。
   - 同韻不同聲調：押韻的句尾字盡量平聲、仄聲交錯（例：光 guāng、狂 kuáng、響 xiǎng、壯 zhuàng）。
   - 平仄交替：每句第二段的尾字與句尾字盡量一平一仄，讀起來有起伏。
   每個片段後面的數字是該片段最後一字的聲調（1、2 為平，3、4 為仄）。 */

const PM_FAM = {
  ang: { name: "ㄤ韻", ends: ["戰意狂2", "夜未央1", "照四方1", "熱血揚2", "寫輝煌2", "鬥志昂2", "不可擋3", "響全場3", "再登場3", "志如鋼1", "意氣壯4", "主場亮4", "浪千丈4", "氣勢強2", "勝負藏2", "心發燙4"] },
  ao: { name: "ㄠ韻", ends: ["傳得妙4", "奔如豹4", "攻勢高1", "浪滔滔1", "戰旗飄1", "比分咬3", "終場哨4", "熱情燒1", "手氣好3", "拚到老3", "笑聲到4", "全場叫4", "心在跳4", "不服老3"] },
  i: { name: "ㄧ韻", ends: ["拚到底3", "志不移2", "戰鼓擊1", "再崛起3", "不放棄4", "一口氣4", "決高低1", "創奇蹟4", "掌聲起3", "勝負繫4", "看今夕1", "鬥心機1" ] },
  ou: { name: "ㄡ韻", ends: ["不回頭2", "再出手3", "汗水流2", "一起吼3", "守城樓2", "莫停留2", "等你秀4", "誰先走3", "勝在手3", "拚個夠4", "不罷休1", "熱血流2", "看身手3"] },
  an: { name: "ㄢ韻", ends: ["戰正酣1", "不畏難2", "心不甘1", "一瞬間1", "勝負看4", "等翻盤2", "火正燃2", "響雲端1", "鬥志滿3", "不怕晚3", "戰未完2", "掌聲歡1", "看今晚3", "守邊關1"] },
  eng: { name: "ㄥ韻", ends: ["拚輸贏2", "爭頭名2", "見真情2", "一陣風1", "主場燈1", "誰稱雄2", "震長空1", "鬥志濃2", "熱血湧3", "不放鬆1", "看英雄2", "等哨聲1", "氣如虹2", "定乾坤1"] }
};

/* 第一段（2 字，主語／時間）；運動專用的另外加 */
const PM_HEAD = {
  common: ["今晚1", "開場3", "哨響3", "看台2", "球迷2", "教頭2", "主將4", "場邊1", "終場3", "燈下4", "全場3", "比分1", "雙方1", "主隊4", "客隊4", "此刻4", "勝負4", "汗水3"],
  football: ["門前2", "邊路4", "鋒線4", "後防2", "中場3", "禁區1", "角球2", "門將4"],
  basketball: ["籃下4", "外線4", "三分1", "禁區1", "板凳4", "快攻1", "罰線4", "後場3"]
};

/* 第二段（2 字，動作／狀態） */
const PM_MID = ["一聲4", "全力4", "拚搏2", "搶攻1", "穩守3", "齊聲1", "猛攻1", "疾奔1", "頻頻2", "再度4", "苦守3", "豪情2", "怒吼3", "屏息1", "揮汗4", "堅守3", "放膽3", "沉著2", "火熱4", "如虹2", "高歌1", "咬牙2", "不退4", "逆風1"];

const PM_TONE_P = (t) => t === 1 || t === 2;

function pmSplit(x) {
  const m = /^(.*?)(\d)$/.exec(x);
  return m ? { text: m[1], tone: Number(m[2]) } : { text: x, tone: 0 };
}

/* 押韻句尾：同一韻、盡量平仄交錯，不重複 */
function pmRhymeEnds(rand, fam, n) {
  const pool = PM_FAM[fam].ends.map(pmSplit);
  const ping = pool.filter((x) => PM_TONE_P(x.tone));
  const ze = pool.filter((x) => !PM_TONE_P(x.tone));
  const out = [];
  let wantPing = rand() < 0.5;
  while (out.length < n && (ping.length || ze.length)) {
    const src = (wantPing ? ping : ze).length ? (wantPing ? ping : ze) : (wantPing ? ze : ping);
    out.push(src.splice(Math.floor(rand() * src.length), 1)[0]);
    wantPing = !wantPing;
  }
  return out;
}

function pmPick(rand, list, avoid) {
  const pool = list.map(pmSplit).filter((x) => !avoid.has(x.text));
  const x = pool[Math.floor(rand() * pool.length)] || pmSplit(list[0]);
  avoid.add(x.text);
  return x;
}

/* 組一句：七言 2/2/3、五言 2/3；第二段尾字與句尾一平一仄 */
function pmLine(rand, heads, end, five, used) {
  const head = pmPick(rand, heads, used);
  if (five) return { text: `${head.text}${end.text}`, show: `${head.text}／${end.text}`, tone: end.tone };
  const want = PM_TONE_P(end.tone) ? [3, 4] : [1, 2];
  const mids = PM_MID.filter((x) => want.includes(pmSplit(x).tone) && !used.has(pmSplit(x).text));
  const mid = pmPick(rand, mids.length ? mids : PM_MID, used);
  return { text: `${head.text}${mid.text}${end.text}`, show: `${head.text}／${mid.text}／${end.text}`, tone: end.tone };
}

const PM_SCHEMES = [
  { key: "alt", name: "隔句韻（二、四句押韻，最自然）", map: ["X", "A", "Y", "A"], w: 4 },
  { key: "abab", name: "交韻 ABAB（一三、二四句各押一韻）", map: ["A", "B", "A", "B"], w: 3 },
  { key: "abba", name: "抱韻 ABBA（首尾一韻、中間一韻）", map: ["A", "B", "B", "A"], w: 3 },
  { key: "aaba", name: "絕句式（一、二、四句押韻，第三句轉折）", map: ["A", "A", "X", "A"], w: 3 },
  { key: "aaaa", name: "句句韻（節奏最強，少量使用）", map: ["A", "A", "A", "A"], w: 1 }
];

function pmWeighted(rand, list) {
  const total = list.reduce((a, x) => a + x.w, 0);
  let r = rand() * total;
  for (const x of list) { r -= x.w; if (r <= 0) return x; }
  return list[0];
}

/* 隊名剛好 2 字或 4 字才放進句子裡，不破壞節奏 */
function pmHeads(ctx) {
  const heads = [...PM_HEAD.common, ...(PM_HEAD[ctx.sport] || [])];
  for (const n of [ctx.H, ctx.A]) if (n && [...n].length === 2) heads.push(`${n}0`);
  return heads;
}

function pmPoem(ctx, seed) {
  const rand = bnRand(`${ctx.id}|poem|${seed}`);
  const scheme = pmWeighted(rand, PM_SCHEMES);
  const fams = Object.keys(PM_FAM);
  const pickFam = (not) => { const f = fams.filter((k) => !not.includes(k)); return f[Math.floor(rand() * f.length)]; };
  const A = pickFam([]);
  const B = pickFam([A]);
  const need = { A: scheme.map.filter((x) => x === "A").length, B: scheme.map.filter((x) => x === "B").length };
  const endsA = pmRhymeEnds(rand, A, need.A);
  const endsB = need.B ? pmRhymeEnds(rand, B, need.B) : [];
  const five = rand() < 0.3;
  const used = new Set();
  const heads = pmHeads(ctx);
  let ia = 0, ib = 0;
  const lines = scheme.map.map((k) => {
    let end;
    if (k === "A") end = endsA[ia++];
    else if (k === "B") end = endsB[ib++];
    else {
      /* 不押韻的句子：換一個韻、而且聲調跟押韻句相反，製造轉折 */
      const f = pickFam([A, B]);
      const pool = PM_FAM[f].ends.map(pmSplit).filter((x) => PM_TONE_P(x.tone) !== PM_TONE_P(endsA[0]?.tone));
      end = pool[Math.floor(rand() * pool.length)] || pmSplit(PM_FAM[f].ends[0]);
    }
    const ln = pmLine(rand, heads, end, five, used);
    return { ...ln, rhyme: k === "A" || k === "B" ? (k === "A" ? PM_FAM[A].name : PM_FAM[B].name) : "" };
  });
  const toneWord = (t) => (PM_TONE_P(t) ? "平" : "仄");
  const title = `${five ? "五言" : "七言"}・${ctx.A || "客隊"} 對 ${ctx.H || "主隊"}`;
  const note = `韻式：${scheme.name}；韻腳 ${PM_FAM[A].name}${need.B ? `＋${PM_FAM[B].name}` : ""}；句尾聲調 ${lines.map((l) => toneWord(l.tone)).join("")}；停頓 ${five ? "2／3" : "2／2／3"}`;
  return { title, lines, note, scheme: scheme.key };
}

/* 押韻單句：上下兩句（上句仄收、下句平收），像對口號一樣好喊 */
function pmCouplets(ctx, seed, n = 2) {
  const rand = bnRand(`${ctx.id}|pair|${seed}`);
  const heads = pmHeads(ctx);
  const out = [];
  const fams = Object.keys(PM_FAM);
  for (let i = 0; i < n; i += 1) {
    const f = fams[Math.floor(rand() * fams.length)];
    const pool = PM_FAM[f].ends.map(pmSplit);
    const ze = pool.filter((x) => !PM_TONE_P(x.tone));
    const ping = pool.filter((x) => PM_TONE_P(x.tone));
    const e1 = ze[Math.floor(rand() * ze.length)] || pool[0];
    const e2 = ping.filter((x) => x.text !== e1.text)[Math.floor(rand() * ping.length)] || pool[1];
    const used = new Set();
    out.push({ fam: PM_FAM[f].name, lines: [pmLine(rand, heads, e1, false, used).text, pmLine(rand, heads, e2, false, used).text] });
  }
  return out;
}
