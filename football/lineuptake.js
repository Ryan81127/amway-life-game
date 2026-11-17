/* 先發點評：先發名單公布後，依陣容、陣型、對手陣型、戰意與模型，產生主播可以直接講的五段點評。
   規則式推論，每段標明是事實還是推測；名單沒公布就不亂講。 */

const LT_SHAPES = {
  "4-3-3": { name: "4-3-3", style: "三前鋒拉開寬度，邊鋒負責突破，通常搭配高位逼搶與控球", tactic: "控球推進、邊路一對一、前場高位逼搶", risk: "邊後衛壓上後身後空檔大，怕被打反擊", tempo: 1 },
  "4-2-3-1": { name: "4-2-3-1", style: "雙後腰保護後防，前腰串聯，最常見的攻守平衡陣型", tactic: "雙後腰控制中場，前腰找縫隙送直塞，邊路插上", risk: "單前鋒容易被孤立，前腰被看死就缺乏創造力", tempo: 0 },
  "4-4-2": { name: "4-4-2", style: "兩條四人防線加雙前鋒，站位紮實、轉換直接", tactic: "穩守兩條線，搶下球就快速找雙前鋒做球或長傳", risk: "中場只有兩人居中，遇到三中場容易人數劣勢", tempo: 0 },
  "4-4-1-1": { name: "4-4-1-1", style: "類似 4-4-2，但一名前鋒回撤當影鋒，兼顧防守與串聯", tactic: "先守後攻，靠影鋒回撤接應打反擊", risk: "進攻人數少，久攻不下時缺乏辦法", tempo: -1 },
  "4-1-4-1": { name: "4-1-4-1", style: "單後腰保護、中場五人，重點在壓縮中路空間", tactic: "中場人數優勢搶控制權，邊路兩人負責攻守往返", risk: "單前鋒火力有限，後腰一被繞過就直接面對後防", tempo: -1 },
  "4-5-1": { name: "4-5-1", style: "中場五人密集佈防，偏保守", tactic: "收縮陣型、等對手失誤再打快速反擊", risk: "前場支點少，控球時間可能很短", tempo: -1 },
  "4-3-1-2": { name: "4-3-1-2", style: "菱形中場、雙前鋒，中路人多但寬度靠邊後衛", tactic: "中路短傳滲透、前腰與雙前鋒配合", risk: "邊路寬度不足，邊後衛負擔很重", tempo: 0 },
  "4-3-2-1": { name: "4-3-2-1", style: "聖誕樹陣型，兩名前腰在中路靠攏", tactic: "中路小範圍配合，邊後衛負責寬度", risk: "邊路容易被打穿", tempo: 0 },
  "3-5-2": { name: "3-5-2", style: "三中衛加兩翼衛，中場人數多、雙前鋒", tactic: "翼衛大幅前插提供寬度，雙前鋒做球、中場包抄", risk: "翼衛身後空檔，被打邊路轉換時會很吃力", tempo: 0 },
  "3-4-3": { name: "3-4-3", style: "三中衛加三前鋒，攻擊人數多、壓迫積極", tactic: "高位逼搶、前場三人加翼衛形成五人攻擊線", risk: "中場只有兩人，被打穿中路就直接面對三中衛", tempo: 1 },
  "3-4-2-1": { name: "3-4-2-1", style: "三中衛、雙翼衛、雙前腰撐起單前鋒", tactic: "雙前腰在肋部接球，翼衛提供寬度", risk: "翼衛回防不及時，邊路會被二打一", tempo: 0 },
  "5-3-2": { name: "5-3-2", style: "五後衛低位防守、雙前鋒等反擊", tactic: "深度防守、壓縮禁區前空間，搶斷後長傳找雙前鋒", risk: "控球少，若先失球很難追", tempo: -1 },
  "5-4-1": { name: "5-4-1", style: "九人在球後，最保守的擺法", tactic: "全隊退守、守住比分，偶爾靠定位球或長傳偷襲", risk: "前場幾乎沒有支點，一旦落後很難反攻", tempo: -2 }
};

function ltGroup(abbr) {
  const a = String(abbr || "").toUpperCase();
  if (a === "G" || a === "GK") return "gk";
  if (/WB|LB|RB|CB|CD|^D/.test(a)) return "def";
  if (/F|ST|CF|LW|RW|^A$/.test(a)) return "fwd";
  if (/M/.test(a)) return "mid";
  return "mid";
}

function ltShape(formation) {
  const f = String(formation || "").replace(/\s/g, "");
  if (LT_SHAPES[f]) return LT_SHAPES[f];
  const parts = f.split("-").map(Number).filter(Number.isFinite);
  if (parts.length < 3) return null;
  const def = parts[0];
  const fwd = parts[parts.length - 1];
  return {
    name: f,
    style: def >= 5 ? "五後衛為主的保守擺法" : def === 3 ? "三中衛搭配翼衛的擺法" : fwd >= 3 ? "前場人數多的攻擊擺法" : "四後衛的平衡擺法",
    tactic: def >= 5 ? "低位防守、找反擊" : fwd >= 3 ? "前場壓迫、多點進攻" : "攻守平衡、視比分調整",
    risk: def >= 5 ? "控球少，落後時很難追" : "攻守轉換時的空檔",
    tempo: def >= 5 ? -1 : fwd >= 3 ? 1 : 0
  };
}

function ltLines(formation) {
  const parts = String(formation || "").split("-").map(Number).filter(Number.isFinite);
  if (parts.length < 3) return null;
  return { def: parts[0], mid: parts.slice(1, -1).reduce((a, b) => a + b, 0), fwd: parts[parts.length - 1] };
}

function ltTake(model, side) {
  const oppSide = side === "home" ? "away" : "home";
  const team = model[side];
  const opp = model[oppSide];
  const block = model.roster?.[side];
  const starters = (block?.players || []).filter((p) => p.starter);
  if (starters.length < 11) return { ready: false };
  const out = { ready: true, items: [] };
  const add = (k, tag, text) => out.items.push({ k, tag, text });
  const shape = ltShape(block.formation);
  const oppShape = ltShape(model.roster?.[oppSide]?.formation);
  const L = ltLines(block.formation);
  const OL = ltLines(model.roster?.[oppSide]?.formation);
  const g = { gk: [], def: [], mid: [], fwd: [] };
  for (const p of starters) g[ltGroup(p.posAbbr)].push(p);

  /* 1. 陣容 */
  const lineup = [];
  lineup.push(`先發：門將 ${g.gk.map((p) => p.name).join("") || "–"}；後防 ${g.def.map((p) => p.name).join("、") || "–"}；中場 ${g.mid.map((p) => p.name).join("、") || "–"}；前場 ${g.fwd.map((p) => p.name).join("、") || "–"}。`);
  add("陣容", "事實", lineup[0]);
  const sched = typeof mvSched !== "undefined" ? mvSched.get(model.id) : null;
  if (!sched && typeof ensureTeamSchedule === "function") ensureTeamSchedule(model);
  const lastId = sched?.[side]?.last?.m?.id;
  let rotationWord = null;
  if (lastId && typeof mvRotation === "function") {
    const r = mvRot.get(model.id + ":" + side);
    if (!r) mvRotation(model, side, lastId);
    if (r?.status === "ok") {
      const same = starters.filter((p) => r.ids.has(String(p.id))).length;
      const dropped = [...r.ids].filter((id) => !starters.some((p) => String(p.id) === id)).map((id) => r.names.get(id)).filter(Boolean);
      add("陣容", "計算", `跟上一場相比，先發有 ${same} 人相同${dropped.length ? `；上一場先發但今天沒先發：${dropped.slice(0, 4).join("、")}` : ""}${r.formation && r.formation !== block.formation ? `；陣型從 ${r.formation} 改成 ${block.formation}` : ""}。`);
      rotationWord = same >= 9 ? "幾乎原班人馬" : same >= 7 ? "小幅輪換" : same >= 5 ? "中度輪換" : "大幅輪換";
      add("陣容", "推測", same >= 9 ? "幾乎是原班人馬，教練對這套組合有信心，默契應該不是問題。" : same >= 7 ? "小幅輪換，主力骨架還在。" : `${rotationWord}，可能是體能考量或在試新組合，默契是今天的變數。`);
    }
  }
  const sx = typeof pvStars === "function" ? pvStars(model, side) : null;
  if (sx?.stars?.length) {
    const on = sx.stars.filter((s) => starters.some((p) => p.en === s.en || p.name === s.name));
    const off = sx.stars.filter((s) => !on.includes(s));
    if (on.length) add("陣容", "事實", `關鍵球員 ${on.map((s) => s.name).join("、")} 先發。`);
    if (off.length) add("陣容", "事實", `關鍵球員 ${off.map((s) => s.name).join("、")} 沒有先發。`);
  }

  /* 2. 陣型 */
  if (shape) {
    add("陣型", "事實", `排出 ${shape.name}${oppShape ? `，對手 ${opp.name} 是 ${oppShape.name}` : ""}。`);
    add("陣型", "推測", `${shape.name} 的特點：${shape.style}。`);
    if (L && OL) {
      if (L.mid > OL.mid) add("陣型", "推測", `中場 ${L.mid} 人對 ${OL.mid} 人，有人數優勢，應該能掌握較多控球。`);
      else if (L.mid < OL.mid) add("陣型", "推測", `中場 ${L.mid} 人對 ${OL.mid} 人，人數吃虧，可能讓出控球、改打轉換。`);
      if (OL.fwd >= 3 && L.def === 4) add("陣型", "推測", `對手前場 ${OL.fwd} 人，${team.name}的邊後衛壓上要很小心。`);
      if (L.def >= 5) add("陣型", "推測", "五後衛擺法，看得出先求不失球。");
    }
  } else add("陣型", "資料不足", "ESPN 沒有給陣型。");

  /* 3. 戰術 */
  const pred = typeof pvPred === "function" ? pvPred(model) : null;
  const coach = typeof pvCoach === "function" ? pvCoach(model, side) : null;
  const myXg = pred ? (side === "home" ? pred.lh : pred.la) : null;
  const opXg = pred ? (side === "home" ? pred.la : pred.lh) : null;
  let plan = shape ? shape.tactic : "";
  if (coach?.prof?.poss != null) plan += `；教練近期平均控球 ${Math.round(coach.prof.poss)}%，${coach.prof.poss >= 55 ? "習慣主導比賽" : coach.prof.poss <= 45 ? "不怕讓球、擅長反擊" : "控球與反擊都能打"}`;
  if (plan) add("戰術", "推測", `可能打法：${plan}。`);
  if (myXg != null && opXg != null) add("戰術", "推測", myXg > opXg + 0.4 ? `模型看好${team.name}佔上風，預期會主動壓上、控球推進。` : opXg > myXg + 0.4 ? `模型認為${team.name}較弱勢，比較可能先守再找反擊與定位球。` : "兩隊實力接近，開場階段應該以試探為主。");
  if (shape?.risk) add("戰術", "推測", `要注意的弱點：${shape.risk}。`);

  /* 4. 戰意 */
  const mot = typeof motivation === "function" && typeof v2Sit === "function" ? motivation(model, v2Sit(model)) : null;
  const ms = mot?.sides?.[side];
  const word = ["結果不影響主要目標", "有目標但壓力不大", "壓力明顯", "背水一戰"];
  if (ms?.pressure != null) add("戰意", "計算", `依積分形勢：${word[ms.pressure]}。`);
  else if (ms?.friendly) add("戰意", "推測", "友誼賽沒有積分壓力，戰意要看陣容：派出主力代表重視，大幅輪換代表以練兵為主。");
  if (rotationWord) add("戰意", "推測", rotationWord === "幾乎原班人馬" ? "派出最強陣容，看得出對這場相當重視。" : rotationWord === "大幅輪換" ? "大幅輪換，戰意可能不如平常，或是在保留主力給下一場。" : "陣容有調整但骨架還在，戰意正常。");

  /* 5. 節奏 */
  let tempo = (shape?.tempo || 0) + (oppShape?.tempo || 0);
  if (pred) tempo += pred.lh + pred.la >= 3 ? 1 : pred.lh + pred.la <= 2.2 ? -1 : 0;
  add("節奏", "推測", `${tempo >= 2 ? "節奏偏快、來回攻防多，進球數可能偏多" : tempo <= -2 ? "節奏偏慢、以陣地戰與防守為主，可能是低比分" : "節奏中等，開場互相試探，先進球的一方會決定後面的走向"}${pred ? `（模型預期總進球 ${fx(pred.lh + pred.la)}）` : ""}。`);
  return out;
}

function ltBlock(model, side) {
  const t = ltTake(model, side);
  const wrap = h("div", { class: "lt-take" }, h("div", { class: "st-label" }, ui("🎙️ 先發點評")));
  if (!t.ready) {
    wrap.append(h("p", { class: "faint" }, ui("先發名單公布後（通常開賽前約 1 小時）會自動產生：陣容、陣型、可能戰術、戰意與節奏的點評。")));
    return wrap;
  }
  const tagCls = { 事實: "fact", 計算: "calc", 推測: "guess", 資料不足: "none" };
  const groups = ["陣容", "陣型", "戰術", "戰意", "節奏"];
  const titles = { 陣容: "這樣的陣容如何", 陣型: "這樣的陣型如何", 戰術: "可能的攻守打法", 戰意: "戰意推估", 節奏: "今天的節奏" };
  for (const k of groups) {
    const list = t.items.filter((x) => x.k === k);
    if (!list.length) continue;
    wrap.append(h("div", { class: "lt-sub" }, ui(titles[k])),
      h("ul", { class: "v2-tagged" }, list.map((x) => h("li", null, h("span", { class: `v2-tag ${tagCls[x.tag] || ""}` }, ui(x.tag)), ui(x.text)))));
  }
  const say = groups.map((k) => t.items.find((x) => x.k === k && x.tag !== "事實") || t.items.find((x) => x.k === k)).filter(Boolean).map((x) => x.text);
  wrap.append(scriptBlock([`${model[side].name}的先發出來了。`, ...say], `口播：${side === "home" ? "主隊" : "客隊"}先發點評`));
  return wrap;
}
