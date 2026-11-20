/* 打油詩產生器（足球、籃球共用）：依照韻式與節奏規則組句，不是固定範本。
   - 句式：七言（2／2／3 停頓）、五言（2／3 停頓）。
   - 韻式：隔句韻（二、四句押韻）、交韻 ABAB、抱韻 ABBA、句句韻 AAAA（少用，容易膩）。
   - 同韻不同聲調：押韻的句尾字盡量平聲、仄聲交錯（例：光 guāng、狂 kuáng、響 xiǎng、壯 zhuàng）。
   - 平仄交替：每句第二段的尾字與句尾字盡量一平一仄，讀起來有起伏。
   每個片段後面的數字是該片段最後一字的聲調（1、2 為平，3、4 為仄）。 */

/* 語意配對：每個片段標記「誰能說這句」與「攻／守」。
   主語 P 球員／球隊／位置、F 看台球迷、T 時間時刻、S 比分勝負、C 教練。
   攻守 a 進攻、d 防守、x 都可以；進攻的句尾不會配上「苦守」這種防守動作。
   格式：片段|聲調|主語|攻守 */
const PM_FAM = {
  ang: { name: "ㄤ韻", ends: ["戰意狂|2|PC|x", "夜未央|1|T|x", "照四方|1|T|x", "熱血揚|2|FP|x", "寫輝煌|2|P|x", "鬥志昂|2|PC|x", "不可擋|3|P|a", "響全場|3|F|x", "再登場|3|PC|x", "志如鋼|1|PC|x", "意氣壯|4|PC|x", "主場亮|4|T|x", "浪千丈|4|F|x", "氣勢強|2|P|a", "勝負藏|2|FT|x", "心發燙|4|F|x"] },
  ao: { name: "ㄠ韻", ends: ["傳得妙|4|P|a", "奔如豹|4|P|a", "攻勢高|1|P|a", "浪滔滔|1|F|x", "戰旗飄|1|FT|x", "比分咬|3|T|x", "熱情燒|1|FT|x", "手氣好|3|P|a", "拚到老|3|PC|x", "全場叫|4|F|x", "心在跳|4|F|x", "不服老|3|PC|x"] },
  i: { name: "ㄧ韻", ends: ["拚到底|3|PC|x", "志不移|2|PC|x", "戰鼓擊|1|FT|x", "再崛起|3|P|x", "不放棄|4|PC|x", "一口氣|4|P|x", "決高低|1|P|x", "創奇蹟|4|P|x", "掌聲起|3|F|x", "看今夕|1|T|x", "鬥心機|1|PC|x"] },
  ou: { name: "ㄡ韻", ends: ["不回頭|2|P|x", "再出手|3|P|a", "汗水流|2|P|x", "一起吼|3|F|x", "守城樓|2|P|d", "莫停留|2|P|a", "勝在手|3|PC|x", "拚個夠|4|P|x", "不罷休|1|PC|x", "熱血流|2|FP|x", "看身手|3|P|x"] },
  an: { name: "ㄢ韻", ends: ["戰正酣|1|T|x", "不畏難|2|PC|x", "心不甘|1|PC|x", "一瞬間|1|TS|x", "等翻盤|2|SC|x", "火正燃|2|FT|x", "響雲端|1|F|x", "鬥志滿|3|PC|x", "戰未完|2|TS|x", "看今晚|3|S|x", "守邊關|1|P|d"] },
  eng: { name: "ㄥ韻", ends: ["拚輸贏|2|P|x", "爭頭名|2|P|x", "一陣風|1|P|a", "誰稱雄|2|SP|x", "震長空|1|F|x", "鬥志濃|2|PC|x", "熱血湧|3|F|x", "不放鬆|1|P|d", "看英雄|2|FT|x", "等哨聲|1|ST|x", "氣如虹|2|P|a", "定乾坤|1|SC|x"] }
};

/* 第一段（2 字，主語）；運動專用的另外加 */
const PM_HEAD = {
  common: ["今晚|1|T|x", "開場|3|T|x", "哨響|3|T|x", "看台|2|F|x", "球迷|2|F|x", "教頭|2|C|x", "主將|4|P|x", "場邊|1|F|x", "終場|3|T|x", "燈下|4|T|x", "全場|3|F|x", "比分|1|S|x", "雙方|1|P|x", "主隊|4|P|x", "客隊|4|P|x", "此刻|4|T|x", "勝負|4|S|x"],
  football: ["門前|2|P|a", "邊路|4|P|a", "鋒線|4|P|a", "後防|2|P|d", "中場|3|P|x", "禁區|1|P|x", "角球|2|P|a", "門將|4|P|d"],
  basketball: ["籃下|4|P|a", "外線|4|P|a", "三分|1|P|a", "禁區|1|P|x", "板凳|4|P|x", "快攻|1|P|a", "罰線|4|P|a", "後場|3|P|d"]
};

/* 第二段（2 字，動作／狀態） */
const PM_MID = ["一聲|4|FT|x", "全力|4|P|x", "拚搏|2|PC|x", "搶攻|1|P|a", "穩守|3|P|d", "齊聲|1|F|x", "猛攻|1|P|a", "疾奔|1|P|a", "頻頻|2|P|a", "再度|4|P|x", "苦守|3|P|d", "豪情|2|FPCT|x", "怒吼|3|FPC|x", "屏息|1|FT|x", "揮汗|4|P|x", "堅守|3|P|d", "放膽|3|P|a", "沉著|2|PC|x", "火熱|4|FT|x", "高歌|1|F|x", "咬牙|2|PC|x", "不退|4|P|d", "逆風|1|P|x", "未定|4|S|x", "膠著|2|ST|x", "拉鋸|4|ST|x", "緊咬|3|S|x"];

const PM_TONE_P = (t) => t === 1 || t === 2;

function pmSplit(x) {
  if (typeof x === "object") return x;
  const [text, tone, subj = "PFTSC", flav = "x"] = String(x).split("|");
  return { text, tone: Number(tone) || 0, subj, flav };
}
const pmFlavOk = (a, b) => a === "x" || b === "x" || a === b;

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

const pmAny = (rand, list) => list[Math.floor(rand() * list.length)];
const pmShare = (a, b) => [...a].some((ch) => b.includes(ch));

/* 組一句：先看句尾說的是誰，再挑合得上的主語和動作。
   七言 2/2/3、五言 2/3；第二段尾字與句尾一平一仄；同一字不在一句裡重複。 */
function pmLine(rand, heads, end, five, used) {
  const hs = heads.map(pmSplit).filter((x) => !used.has(x.text));
  const fit = hs.filter((x) => end.subj.includes(x.subj) && pmFlavOk(x.flav, end.flav) && !pmShare(x.text, end.text));
  const head = pmAny(rand, fit) || pmAny(rand, hs.filter((x) => end.subj.includes(x.subj))) || pmAny(rand, hs) || pmSplit(heads[0]);
  used.add(head.text);
  if (five) return { text: `${head.text}${end.text}`, show: `${head.text}／${end.text}`, tone: end.tone };
  const want = PM_TONE_P(end.tone) ? [3, 4] : [1, 2];
  const ms = PM_MID.map(pmSplit).filter((x) => !used.has(x.text) && x.subj.includes(head.subj) && pmFlavOk(x.flav, end.flav) && pmFlavOk(x.flav, head.flav) && !pmShare(x.text, end.text + head.text));
  const mid = pmAny(rand, ms.filter((x) => want.includes(x.tone))) || pmAny(rand, ms) || pmSplit(PM_MID[0]);
  used.add(mid.text);
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
  for (const n of [ctx.H, ctx.A]) if (n && [...n].length === 2) heads.push(`${n}|0|P|x`);
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
      const pool = PM_FAM[f].ends.map(pmSplit).filter((x) => PM_TONE_P(x.tone) !== PM_TONE_P(endsA[0]?.tone) && ![...endsA, ...endsB].some((e) => e.text === x.text || pmShare(e.text, x.text)));
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
