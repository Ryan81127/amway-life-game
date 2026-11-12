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
  1: "老鹰", 2: "凯尔特人", 3: "鹈鹕", 4: "公牛", 5: "骑士", 6: "独行侠", 7: "掘金", 8: "活塞", 9: "勇士", 10: "火箭",
  11: "步行者", 12: "快船", 13: "湖人", 14: "热火", 15: "雄鹿", 16: "森林狼", 17: "篮网", 18: "尼克斯", 19: "魔术", 20: "76人",
  21: "太阳", 22: "开拓者", 23: "国王", 24: "马刺", 25: "雷霆", 26: "爵士", 27: "奇才", 28: "猛龙", 29: "灰熊", 30: "黄蜂"
};

const HAN_PAIRS = "門门後后場场為为這这個个對对說说見见與与從从發发經经过過還还會会時时间間開开關关勝胜負负賽赛戰战術术罰罚規规盤盘賠赔隱隐總总進进邊边衛卫鋒锋龍龙點点補补讓让黃黄紅红綠绿東东車车長长馬马魚鱼鳥鸟頁页風风飛飞齊齐亞亚國国际際華华萬万書书画畫體体來来們们裡里於于並并業业兩两兒儿內内寫写軍军準准幾几動动區区協协單单參参雙双號号員员問问團团圍围圖图壓压壞坏夠够頭头獎奖婦妇學学層层屬属幣币幫帮廣广廳厅張张強强當当態态機机權权歡欢決决況况淨净滿满漢汉熱热燈灯爾尔牆墙狀状產产碼码確确種种類类節节級级紀纪約约結结給给統统絕绝線线練练縣县義义習习聯联聲声聽听腳脚臨临興兴舉举舊旧葉叶著着處处製制複复視视覽览覺觉計计記记訪访設设評评詞词試试話话該该語语誰谁課课調调談谈請请論论謝谢證证識识譯译讀读變变豐丰貝贝財财責责質质較较載载輔辅達达運运遠远適适選选針针銀银銷销陣阵陰阴隊队階阶隨随難难電电靈灵靜静項项順顺預预領领題题額额餘余鬥斗歐欧實实現现條条辦办備备氣气歷历標标擊击沒没換换無无網网麼么隻只鬆松納纳徹彻羅罗薩萨萊莱頓顿諾诺錫锡茲兹宮宫維维喬乔蘭兰魯鲁蓋盖復复數数傳传導导轉转勢势贏赢價价敗败歸归觀观據据檔档擋挡搶抢斷断攔拦終终險险鍵键釋释範范錄录誤误註注擇择頻频優优議议構构遞递響响擁拥爭争帶带獲获戲戏剛刚週周鐘钟緊紧懸悬貼贴衝冲細细純纯礎础濟济歲岁災灾嗎吗擬拟綜综漲涨傷伤輪轮謹谨訊讯佈布愛爱繃绷編编穩稳頂顶膠胶鬧闹應应眾众費费緒绪劇剧懶懒曬晒飆飙渦涡麵面廁厕齣出駁驳鋼钢鏢镖鑼锣驚惊彈弹撿捡閉闭窩窝繼继續续籃篮鐵铁暫暂騎骑鵜鹈鶘鹕鷹鹰獨独俠侠塊块陽阳擲掷籌筹灣湾撥拨鏡镜驗验遜逊擴扩";

const HAN = {};
for (let i = 0; i < HAN_PAIRS.length - 1; i += 2) HAN[HAN_PAIRS[i]] = HAN_PAIRS[i + 1];

function han(text) {
  return String(text || "").replace(/[\u3400-\u9fff]/g, (ch) => HAN[ch] || ch);
}

const PHRASES = [
  ["大小分", "大小分"],
  ["讓分", "让分"],
  ["受讓", "受让"],
  ["獨贏", "独赢"],
  ["主勝", "主胜"],
  ["客勝", "客胜"],
  ["籃板", "篮板"],
  ["抄截", "抢断"],
  ["火鍋", "盖帽"],
  ["助攻", "助攻"],
  ["失誤", "失误"],
  ["罰球", "罚球"],
  ["投籃", "投篮"],
  ["命中率", "命中率"],
  ["暫停", "暂停"],
  ["第一節", "第一节"],
  ["單節", "单节"],
  ["延長賽", "加时赛"],
  ["先發", "首发"],
  ["板凳", "替补"],
  ["禁區", "内线"],
  ["快攻", "快攻"],
  ["空中接力", "空接"],
  ["灌籃", "扣篮"],
  ["上籃", "上篮"],
  ["打鐵", "打铁"],
  ["影片", "视频"],
  ["網路", "网络"],
  ["留言", "评论"],
  ["品質", "质量"],
  ["資料", "数据"],
  ["程式", "程序"],
  ["宵夜", "夜宵"]
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
