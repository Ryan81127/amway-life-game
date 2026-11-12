/* Taiwan / mainland wording. Taiwan mode is the default and leaves existing copy unchanged. */
let fbLocale = "tw";
try {
  fbLocale = localStorage.getItem("fb-locale") === "cn" ? "cn" : "tw";
} catch {
  fbLocale = "tw";
}

function locale() {
  return fbLocale;
}

function setLocale(next) {
  fbLocale = next === "cn" ? "cn" : "tw";
  try { localStorage.setItem("fb-locale", fbLocale); } catch { /* ignore */ }
  document.documentElement.lang = fbLocale === "cn" ? "zh-Hans" : "zh-Hant";
  window.dispatchEvent(new Event("fb-locale"));
}

const TEAM_CN = {
  359: "阿森纳", 382: "曼城", 363: "切尔西", 367: "热刺", 360: "曼联", 364: "利物浦",
  361: "纽卡斯尔", 362: "阿斯顿维拉", 331: "布莱顿", 384: "水晶宫", 370: "富勒姆",
  393: "诺丁汉森林", 357: "利兹联", 349: "伯恩茅斯",
  83: "巴萨", 86: "皇马", 1068: "马竞", 93: "毕尔巴鄂", 102: "比利亚雷亚尔",
  243: "塞维利亚", 94: "瓦伦西亚", 89: "皇家社会", 244: "贝蒂斯", 88: "西班牙人",
  103: "AC米兰", 110: "国米", 111: "尤文图斯", 114: "那不勒斯", 104: "罗马",
  112: "拉齐奥", 109: "佛罗伦萨", 105: "亚特兰大", 239: "都灵",
  132: "拜仁", 124: "多特蒙德", 131: "勒沃库森", 11420: "莱比锡", 134: "斯图加特",
  125: "法兰克福", 598: "柏林联合", 268: "门兴",
  160: "巴黎圣日耳曼", 176: "马赛", 167: "里昂", 174: "摩纳哥", 166: "里尔",
  2502: "尼斯", 175: "朗斯", 169: "雷恩",
  1929: "本菲卡", 437: "波尔图", 2250: "葡萄牙体育", 148: "埃因霍温", 142: "费耶诺德",
  162: "意大利", 477: "克罗地亚", 451: "韩国", 455: "希腊", 465: "土耳其", 472: "斯洛文尼亚",
  579: "亚美尼亚", 584: "格鲁吉亚", 627: "日本", 628: "澳大利亚", 655: "沙特", 2666: "新西兰",
  4397: "阿联酋", 4398: "卡塔尔", 14561: "中国台北", 6775: "黑山", 6757: "塞尔维亚", 2405: "马来西亚",
  256: "凯尔特人", 432: "加拉塔萨雷", 1895: "贝西克塔斯", 436: "费内巴切"
};

const HAN_PAIRS = "門门後后場场為为這这個个對对說说見见與与從从發发經经过過還还會会時时间間開开關关勝胜負负賽赛戰战術术罰罚規规盤盘賠赔隱隐總总進进邊边衛卫鋒锋龍龙點点補补讓让黃黄紅红綠绿東东車车長长馬马魚鱼鳥鸟頁页風风飛飞齊齐亞亚國国际際華华萬万書书画畫體体來来們们裡里於于並并業业兩两兒儿內内寫写軍军準准幾几動动區区協协單单參参雙双號号員员問问團团圍围圖图壓压壞坏夠够頭头獎奖婦妇學学層层屬属幣币幫帮廣广廳厅張张強强當当態态機机權权歡欢決决況况淨净滿满漢汉熱热燈灯爾尔牆墙狀状產产碼码確确種种類类節节級级紀纪約约結结給给統统絕绝線线練练縣县義义習习聯联聲声聽听腳脚臨临興兴舉举舊旧葉叶著着處处製制複复視视覽览覺觉計计記记訪访設设評评詞词試试話话該该語语誰谁課课調调談谈請请論论謝谢證证識识譯译讀读變变豐丰貝贝財财責责質质較较載载輔辅達达運运遠远適适選选針针銀银銷销陣阵陰阴隊队階阶隨随難难電电靈灵靜静項项順顺預预領领題题額额餘余鬥斗歐欧實实現现條条辦办備备氣气歷历標标擊击沒没換换無无網网麼么隻只鬆松納纳徹彻羅罗薩萨萊莱頓顿諾诺錫锡茲兹宮宫維维喬乔蘭兰魯鲁蓋盖復复數数傳传導导轉转勢势贏赢價价敗败歸归觀观據据檔档擋挡搶抢斷断攔拦終终險险鍵键釋释範范錄录誤误註注擇择頻频優优議议構构遞递響响擁拥爭争帶带獲获戲戏剛刚週周鐘钟緊紧懸悬貼贴衝冲細细純纯礎础濟济歲岁災灾嗎吗擬拟綜综漲涨傷伤輪轮謹谨訊讯佈布愛爱繃绷編编穩稳頂顶膠胶鬧闹應应眾众費费緒绪劇剧懶懒曬晒飆飙渦涡麵面廁厕齣出駁驳鋼钢鏢镖鑼锣驚惊彈弹撿捡閉闭窩窝繼继續续";

const HAN = {};
for (let i = 0; i < HAN_PAIRS.length - 1; i += 2) HAN[HAN_PAIRS[i]] = HAN_PAIRS[i + 1];

function han(text) {
  return String(text || "").replace(/[\u3400-\u9fff]/g, (ch) => HAN[ch] || ch);
}

const PHRASES = [
  ["不讓分（獨贏）", "胜平负"],
  ["以目前數據來看", "从目前数据来看"],
  ["帽子戲法", "帽子戏法"],
  ["高位逼搶", "高位逼抢"],
  ["邊路進攻", "边路进攻"],
  ["任意球", "任意球"],
  ["自由球", "任意球"],
  ["烏龍球", "乌龙球"],
  ["大小分", "大小球"],
  ["不讓分", "胜平负"],
  ["守門員", "门将"],
  ["門將", "门将"],
  ["世界盃", "世界杯"],
  ["歐霞", "欧联"],
  ["義甲", "意甲"],
  ["讓分", "让球"],
  ["受讓", "受让"],
  ["大分", "大球"],
  ["小分", "小球"],
  ["和局", "平局"],
  ["主勝", "主胜"],
  ["客勝", "客胜"],
  ["獨贏", "独赢"],
  ["射門", "射门"],
  ["進球", "进球"],
  ["黃牌", "黄牌"],
  ["紅牌", "红牌"],
  ["點球", "点球"],
  ["補時", "补时"],
  ["上半場", "上半场"],
  ["下半場", "下半场"],
  ["零封", "零封"],
  ["反擊", "反击"],
  ["先發", "首发"],
  ["陣型", "阵型"],
  ["換人", "换人"],
  ["撲救", "扑救"],
  ["救球", "扑救"],
  ["複製口播", "复制解说"],
  ["口播", "解说"]
];

let namePairs = null;
function teamNamePairs() {
  if (namePairs) return namePairs;
  const pairs = [];
  for (const [id, tw] of Object.entries(TEAM_ZH)) {
    const cn = TEAM_CN[id] || han(tw);
    if (tw && cn && tw !== cn) pairs.push([tw, cn]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  namePairs = pairs;
  return pairs;
}

function speak(text) {
  if (locale() !== "cn" || text == null) return text == null ? "" : String(text);
  let s = String(text);
  for (const [tw, cn] of teamNamePairs()) s = s.split(tw).join(cn);
  for (const [tw, cn] of PHRASES) s = s.split(tw).join(cn);
  return han(s);
}

function ui(text) {
  return speak(text);
}

const GLOSSARY = [
  ["pos", "門將", "门将", "goalkeeper"],
  ["pos", "後衛", "后卫", "defender"],
  ["pos", "中後衛", "中后卫", "centre-back"],
  ["pos", "左後衛", "左后卫", "left-back"],
  ["pos", "右後衛", "右后卫", "right-back"],
  ["pos", "翼衛", "边翼卫", "wing-back"],
  ["pos", "防守中場", "后腰", "defensive midfielder"],
  ["pos", "中場", "中场", "midfielder"],
  ["pos", "前腰", "前腰", "attacking midfielder"],
  ["pos", "邊鋒", "边锋", "winger"],
  ["pos", "前鋒", "前锋", "forward"],
  ["pos", "中鋒", "中锋", "centre-forward"],
  ["pos", "影鋒", "影锋", "second striker"],
  ["pos", "清道夫", "清道夫", "sweeper"],
  ["pos", "偽九號", "伪九号", "false nine"],
  ["pos", "替補", "替补", "substitute"],
  ["tac", "陣型", "阵型", "formation"],
  ["tac", "高位逼搶", "高位逼抢", "high press"],
  ["tac", "低位防守", "低位防守", "low block"],
  ["tac", "反擊", "反击", "counter-attack"],
  ["tac", "傳控", "传控", "possession play"],
  ["tac", "邊路進攻", "边路进攻", "wing play"],
  ["tac", "中路滲透", "中路渗透", "through the middle"],
  ["tac", "換邊", "换边", "switch of play"],
  ["tac", "套邊", "套边", "overlap"],
  ["tac", "二過一", "二过一", "one-two"],
  ["tac", "越位陷阱", "越位陷阱", "offside trap"],
  ["tac", "三中衛", "三中卫", "back three"],
  ["tac", "雙後腰", "双后腰", "double pivot"],
  ["tac", "單箭頭", "单箭头", "lone striker"],
  ["tac", "控球", "控球", "possession"],
  ["tac", "平行站位", "平行站位", "flat line"],
  ["tac", "壓上", "压上", "push up"],
  ["tac", "回防", "回防", "recover"],
  ["foul", "犯規", "犯规", "foul"],
  ["foul", "黃牌", "黄牌", "yellow card"],
  ["foul", "紅牌", "红牌", "red card"],
  ["foul", "兩黃一紅", "两黄变一红", "second yellow"],
  ["foul", "點球", "点球", "penalty"],
  ["foul", "十二碼", "点球点", "penalty spot"],
  ["foul", "直接自由球", "直接任意球", "direct free kick"],
  ["foul", "間接自由球", "间接任意球", "indirect free kick"],
  ["foul", "越位", "越位", "offside"],
  ["foul", "手球", "手球", "handball"],
  ["foul", "危險動作", "危险动作", "dangerous play"],
  ["foul", "拖延時間", "拖延时间", "time wasting"],
  ["foul", "VAR", "VAR", "VAR"],
  ["foul", "補時", "补时", "stoppage time"],
  ["foul", "傷停", "伤停补时", "injury time"],
  ["foul", "罰下", "红牌罚下", "sending off"],
  ["stat", "進球", "进球", "goal"],
  ["stat", "助攻", "助攻", "assist"],
  ["stat", "烏龍球", "乌龙球", "own goal"],
  ["stat", "帽子戲法", "帽子戏法", "hat-trick"],
  ["stat", "零封", "零封", "clean sheet"],
  ["stat", "射門", "射门", "shot"],
  ["stat", "射正", "射正", "shot on target"],
  ["stat", "角球", "角球", "corner"],
  ["stat", "頭槌", "头球", "header"],
  ["stat", "自由球", "任意球", "free kick"],
  ["stat", "傳球", "传球", "pass"],
  ["stat", "控球率", "控球率", "possession"],
  ["stat", "攔截", "拦截", "interception"],
  ["stat", "解圍", "解围", "clearance"],
  ["stat", "撲救", "扑救", "save"],
  ["stat", "上半場", "上半场", "first half"],
  ["stat", "下半場", "下半场", "second half"],
  ["stat", "加時", "加时", "extra time"],
  ["odds", "不讓分（獨贏）", "胜平负", "1X2"],
  ["odds", "讓分", "让球", "handicap"],
  ["odds", "大小分", "大小球", "over/under"],
  ["odds", "歐賠", "欧赔", "decimal odds"],
  ["odds", "隱含機率", "隐含概率", "implied probability"],
  ["odds", "主勝", "主胜", "home win"],
  ["odds", "客勝", "客胜", "away win"],
  ["odds", "和局", "平局", "draw"],
  ["odds", "大分", "大球", "over"],
  ["odds", "小分", "小球", "under"],
  ["odds", "受讓", "受让", "plus handicap"],
  ["odds", "水位", "水位", "price"]
].map(([group, tw, cn, en], index) => ({ id: `${group}-${index}`, group, tw, cn, en }));

const GLOSS_GROUPS = [
  ["pos", "位置"],
  ["tac", "戰術"],
  ["foul", "犯規與判罰"],
  ["stat", "賽事與數據"],
  ["odds", "盤口"]
];

function glossByTw(name) {
  return GLOSSARY.find((item) => item.tw === name);
}

function formationNote(shape) {
  const notes = {
    "4-3-3": "4-3-3 三前鋒，邊路進攻為主",
    "4-4-2": "4-4-2 雙前鋒，中場四人並列",
    "4-2-3-1": "4-2-3-1 雙後腰，前面三個攻擊點",
    "3-5-2": "3-5-2 三中衛，翼衛負責邊路",
    "3-4-3": "3-4-3 三中衛加三前鋒",
    "5-3-2": "5-3-2 五後衛，站位偏守",
    "5-4-1": "5-4-1 五後衛，單前鋒",
    "4-5-1": "4-5-1 五中場，單前鋒",
    "4-1-4-1": "4-1-4-1 單後腰拖在中場前面",
    "4-3-2-1": "4-3-2-1 前場收成一個箭頭",
    "4-4-1-1": "4-4-1-1 前腰頂在單箭頭後面",
    "3-4-2-1": "3-4-2-1 三中衛，前腰兩人",
    "4-2-2-2": "4-2-2-2 雙後腰加兩組邊路",
    "4-1-2-1-2": "4-1-2-1-2 菱形中場，雙前鋒",
    "3-4-1-2": "3-4-1-2 三中衛，前腰單人"
  };
  return notes[shape] || (shape ? `${shape}` : "");
}

function matchTerms(model) {
  if (!model) return [];
  const out = [];
  const push = (tw, line) => {
    const term = glossByTw(tw);
    if (!term || out.some((item) => item.tw === tw)) return;
    out.push({ ...term, line });
  };
  const events = model.events || [];
  const pen = events.find((ev) => ev.style === "點球" || ev.kind === "miss");
  if (pen) push("點球", `點球，${pen.minuteLabel || ""} ${pen.playerNames?.[0] || ""}。`.trim());
  const own = events.find((ev) => ev.style === "烏龍");
  if (own) push("烏龍球", `${own.minuteLabel || ""} 烏龍球，${own.scorer || own.playerNames?.[0] || ""}。`.trim());
  const red = events.find((ev) => ev.kind === "red");
  if (red) push("紅牌", `${red.minuteLabel || ""} 紅牌，${red.playerNames?.[0] || ""}，${red.teamName || ""}。`.trim());
  if (red) push("罰下", `${red.playerNames?.[0] || "這名球員"} 被罰下，場上會少一人。`);
  const yellow = events.find((ev) => ev.kind === "yellow");
  if (yellow) push("黃牌", `${yellow.minuteLabel || ""} 黃牌，${yellow.playerNames?.[0] || ""}。`.trim());
  const goal = events.find((ev) => ev.kind === "goal" && ev.style !== "烏龍" && ev.style !== "點球");
  if (goal) push("進球", `${goal.minuteLabel || ""} 進球，${goal.scorer || ""}。`.trim());
  if (events.some((ev) => ev.style === "頭槌")) push("頭槌", "這球是頭槌。");
  if (events.some((ev) => ev.style === "自由球")) push("自由球", "這球來自自由球。");
  const sub = events.find((ev) => ev.kind === "sub");
  if (sub) push("替補", `${sub.minuteLabel || ""} 換人，${sub.subOn || ""} 上場。`.trim());
  const clocks = [model.minute?.label].concat(events.map((ev) => ev.minuteLabel));
  if (clocks.some((label) => String(label || "").includes("+"))) push("補時", `現在是補時，${model.minute?.label || ""}。`);
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const late = model.minute?.phase === "ft" || (model.minute?.base || 0) >= 75;
  if (late && hs === 0 && as === 0) push("零封", `目前 ${model.home.name} 和 ${model.away.name} 都沒有失球。`);
  else if (late && as === 0) push("零封", `${model.home.name} 目前沒有失球。`);
  else if (late && hs === 0) push("零封", `${model.away.name} 目前沒有失球。`);
  if (model.stats?.mode === "match") {
    if ((model.stats.home.totalShots || 0) + (model.stats.away.totalShots || 0) > 0) {
      push("射門", `射門 ${model.home.name} ${model.stats.home.totalShots}，${model.away.name} ${model.stats.away.totalShots}。`);
    }
    if ((model.stats.home.shotsOnTarget || 0) + (model.stats.away.shotsOnTarget || 0) > 0) {
      push("射正", `射正 ${model.home.name} ${model.stats.home.shotsOnTarget}，${model.away.name} ${model.stats.away.shotsOnTarget}。`);
    }
    if ((model.stats.home.wonCorners || 0) + (model.stats.away.wonCorners || 0) > 0) {
      push("角球", `角球 ${model.home.name} ${model.stats.home.wonCorners}，${model.away.name} ${model.stats.away.wonCorners}。`);
    }
    if ((model.stats.home.offsides || 0) + (model.stats.away.offsides || 0) > 0) push("越位", "場上已經有越位。");
  }
  if (model.roster?.home?.formation || model.roster?.away?.formation) push("陣型", "陣型依首發名單來排。");
  if ((model.home.score === "0" && model.away.score === "0") === false && events.some((ev) => ev.kind === "goal")) {
    /* goal already added */
  }
  return out.slice(0, 8);
}
