/* Rule-based ESPN board. Sentences may only use numbers and names present in the feed. */
const API = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ATHLETE = "https://site.api.espn.com/apis/common/v3/sports/soccer";
const TZ = "Asia/Taipei";

const LEAGUES = [
  { slug: "eng.1", name: "英超" },
  { slug: "esp.1", name: "西甲" },
  { slug: "ita.1", name: "義甲" },
  { slug: "ger.1", name: "德甲" },
  { slug: "fra.1", name: "法甲" },
  { slug: "uefa.champions", name: "歐冠" },
  { slug: "uefa.europa", name: "歐霞" },
  { slug: "usa.1", name: "美職聯" },
  { slug: "jpn.1", name: "J1 聯賽" },
  { slug: "fifa.world", name: "世界盃" },
  { slug: "uefa.nations", name: "歐國聯" },
  { slug: "fifa.friendly", name: "國際友誼賽" }
];

const STATUS_ZH = {
  STATUS_SCHEDULED: "未開賽",
  STATUS_IN_PROGRESS: "進行中",
  STATUS_FIRST_HALF: "上半場",
  STATUS_SECOND_HALF: "下半場",
  STATUS_HALFTIME: "中場",
  STATUS_EXTRA_TIME: "加時",
  STATUS_EXTRA_TIME_HALF_TIME: "加時中場",
  STATUS_FIRST_EXTRA: "加時上半",
  STATUS_SECOND_EXTRA: "加時下半",
  STATUS_PENALTY_SHOOTOUT: "點球大戰",
  STATUS_SHOOTOUT: "點球大戰",
  STATUS_FULL_TIME: "完賽",
  STATUS_FINAL: "完賽",
  STATUS_FINAL_AET: "加時結束",
  STATUS_FINAL_PEN: "點球結束",
  STATUS_FINAL_PENALTIES: "點球結束",
  STATUS_POSTPONED: "延期",
  STATUS_CANCELED: "取消",
  STATUS_CANCELLED: "取消",
  STATUS_SUSPENDED: "中斷",
  STATUS_DELAYED: "延後",
  STATUS_ABANDONED: "腰斬"
};

const TEAM_ZH = {
  162: "義大利", 164: "西班牙", 202: "阿根廷", 204: "玻利維亞", 205: "巴西", 207: "智利",
  208: "哥倫比亞", 209: "厄瓜多", 210: "巴拉圭", 211: "秘魯", 212: "烏拉圭", 213: "委內瑞拉",
  214: "哥斯大黎加", 215: "宏都拉斯", 444: "愛沙尼亞", 445: "賽普勒斯", 447: "法羅群島", 448: "英格蘭",
  449: "荷蘭", 450: "捷克", 451: "南韓", 452: "波士尼亞", 453: "馬爾他", 454: "俄羅斯", 455: "希臘",
  456: "拉脫維亞", 457: "烏克蘭", 458: "芬蘭", 459: "比利時", 460: "立陶宛", 461: "以色列",
  462: "保加利亞", 463: "北馬其頓", 464: "挪威", 465: "土耳其", 466: "瑞典", 468: "斯洛伐克",
  469: "伊朗", 470: "冰島", 471: "波蘭", 472: "斯洛維尼亞", 473: "羅馬尼亞", 474: "奧地利",
  475: "瑞士", 476: "愛爾蘭", 477: "克羅埃西亞", 478: "法國", 479: "丹麥", 480: "匈牙利",
  481: "德國", 482: "葡萄牙", 483: "摩爾多瓦", 578: "威爾斯", 579: "亞美尼亞", 580: "蘇格蘭",
  581: "亞塞拜然", 582: "盧森堡", 583: "白俄羅斯", 584: "喬治亞", 585: "阿爾巴尼亞", 586: "北愛爾蘭",
  587: "安道爾", 588: "聖馬利諾", 589: "列支敦斯登", 627: "日本", 628: "澳洲", 655: "沙烏地阿拉伯",
  658: "中國", 841: "科威特", 2405: "馬來西亞", 2570: "烏茲別克", 2619: "哈薩克", 2649: "多明尼加",
  2664: "蘇利南", 2666: "紐西蘭", 2917: "約旦", 4375: "伊拉克", 4380: "敘利亞", 4381: "巴林",
  4384: "新加坡", 4385: "印度", 4388: "黎巴嫩", 4397: "阿聯", 4398: "卡達", 4895: "印尼",
  6014: "葉門", 6167: "巴勒斯坦", 6686: "史瓦帝尼", 6724: "吉爾吉斯", 6757: "塞爾維亞",
  6775: "蒙特內哥羅", 7349: "越南", 14561: "中華台北", 16721: "直布羅陀", 18272: "科索沃",
  359: "阿森納", 362: "阿斯頓維拉", 349: "伯恩茅斯", 337: "布蘭特福德", 331: "布萊頓",
  363: "切爾西", 388: "考文垂", 384: "水晶宮", 368: "埃弗頓", 370: "富勒姆",
  306: "赫爾城", 373: "伊普斯威奇", 357: "里茲聯", 364: "利物浦", 382: "曼城",
  360: "曼聯", 361: "紐卡斯爾", 393: "諾丁漢森林", 366: "桑德蘭", 367: "熱刺",
  96: "阿拉維斯", 1068: "馬德里競技", 83: "巴塞隆納", 85: "塞爾塔", 90: "拉科魯尼亞",
  3751: "埃爾切", 88: "西班牙人", 2922: "赫塔費", 1538: "萊萬特", 99: "馬拉加",
  97: "奧薩蘇納", 101: "巴列卡諾", 244: "皇家貝蒂斯", 86: "皇家馬德里", 89: "皇家社會",
  87: "桑坦德", 243: "塞維亞", 94: "瓦倫西亞", 102: "比利亞雷亞爾", 93: "畢爾包",
  103: "AC米蘭", 104: "羅馬", 105: "亞特蘭大", 107: "波隆那", 2925: "卡利亞里",
  2572: "科莫", 109: "佛羅倫薩", 4057: "弗羅西諾內", 3263: "熱那亞", 110: "國際米蘭",
  111: "尤文圖斯", 112: "拉齊奧", 113: "萊切", 4007: "蒙扎", 114: "那不勒斯",
  115: "帕爾馬", 3997: "薩索洛", 239: "都靈", 118: "烏迪內斯", 17530: "威尼斯",
  598: "柏林聯合", 131: "勒沃庫森", 132: "拜仁慕尼黑", 124: "多特蒙德", 268: "門興",
  125: "法蘭克福", 3841: "奧格斯堡", 122: "科隆", 127: "漢堡", 2950: "美因茨",
  11420: "RB萊比錫", 126: "弗萊堡", 3307: "帕德博恩", 133: "沙爾克04", 7911: "霍芬海姆",
  134: "斯圖加特", 137: "雲達不萊梅", 10388: "埃爾弗斯貝格",
  172: "歐塞爾", 174: "摩納哥", 7868: "昂熱", 6997: "布雷斯特", 3236: "勒阿弗爾",
  2697: "勒芒", 175: "朗斯", 166: "里爾", 273: "洛里昂", 167: "里昂",
  176: "馬賽", 2502: "尼斯", 6851: "巴黎FC", 160: "巴黎聖日耳曼", 169: "雷恩",
  180: "斯特拉斯堡", 179: "圖盧茲", 170: "特魯瓦",
  887: "雅典AEK", 140: "阿爾克馬爾", 441: "安德萊赫特", 1929: "本菲卡", 1895: "貝西克塔斯",
  2980: "博德閃耀", 256: "凱爾特人", 570: "布魯日", 597: "薩格勒布迪納摩", 436: "費內巴切",
  622: "費倫茨瓦羅斯", 142: "費耶諾德", 432: "加拉塔薩雷", 4411: "林茨", 2990: "波茲南萊赫",
  490: "列夫斯基", 147: "奈梅亨", 435: "奧林匹亞科斯", 617: "奧莫尼亞", 148: "埃因霍溫",
  437: "波爾圖", 2790: "薩爾茨堡", 493: "頓涅茨克礦工", 494: "布拉格斯拉維亞",
  521: "布拉迪斯拉發斯洛萬", 433: "布拉格斯巴達", 2250: "葡萄牙體育", 3746: "格拉茨風暴",
  510: "維京", 11706: "比爾森勝利", 5807: "聖吉羅斯",
  18418: "亞特蘭大聯", 20906: "奧斯汀", 21300: "夏洛特", 182: "芝加哥火焰",
  184: "科羅拉多急流", 183: "哥倫布機員", 193: "華盛頓聯", 18267: "辛辛那提",
  185: "達拉斯", 6077: "休士頓迪納摩", 20232: "邁阿密國際", 187: "洛杉磯銀河",
  18966: "洛杉磯FC", 17362: "明尼蘇達聯", 18986: "納什維爾", 189: "新英格蘭革命",
  17606: "紐約城", 12011: "奧蘭多城", 10739: "費城聯合", 9723: "波特蘭伐木者",
  4771: "皇家鹽湖城", 190: "紐約紅牛", 22529: "聖地牙哥", 191: "聖荷西地震",
  9726: "西雅圖海灣人", 186: "堪薩斯城體育", 21812: "聖路易城", 7318: "多倫多FC",
  9727: "溫哥華白帽", 9720: "蒙特婁",
  7107: "福岡黃蜂", 7109: "大阪櫻花", 3384: "FC東京", 22522: "岡山綠雉",
  7102: "大阪鋼巴", 7111: "千葉市原", 7115: "鹿島鹿角", 7476: "柏太陽神",
  7112: "川崎前鋒", 21361: "京都橘", 22167: "町田澤維亞", 131701: "水戶蜀葵",
  7108: "名古屋鯨魚", 7114: "廣島三箭", 7104: "清水心跳", 3393: "東京綠茵",
  3385: "浦和紅鑽", 19001: "長崎成功丸", 7477: "神戶勝利船", 7116: "橫濱水手"
};

const POS_ZH = {
  G: "門將", GK: "門將", RB: "右後衛", LB: "左後衛", CB: "中後衛", CD: "中後衛",
  "CD-R": "右中衛", "CD-L": "左中衛", RCB: "右中衛", LCB: "左中衛",
  RWB: "右翼衛", LWB: "左翼衛", DM: "防守中場", CDM: "防守中場",
  RDM: "右防守中場", LDM: "左防守中場", CM: "中場", RCM: "右中場", LCM: "左中場",
  RM: "右中場", LM: "左中場", AM: "攻擊中場", CAM: "攻擊中場",
  "AM-R": "右前腰", "AM-L": "左前腰", RAM: "右前腰", LAM: "左前腰",
  RW: "右翼", LW: "左翼", RF: "右前鋒", LF: "左前鋒", CF: "中鋒", ST: "前鋒",
  F: "前鋒", SS: "二前鋒", D: "後衛", M: "中場",
  "CF-L": "左中鋒", "CF-R": "右中鋒", "CM-L": "左中場", "CM-R": "右中場", "DM-L": "左後腰", "DM-R": "右後腰",
  "F-L": "左前鋒", "F-R": "右前鋒", "LB-L": "左後衛", "RB-R": "右後衛", LF: "左前鋒", RF: "右前鋒",
  LWF: "左邊鋒", RWF: "右邊鋒", SUB: "替補"
};

const MATCH_STATS = [
  ["possessionPct", "控球率"],
  ["totalShots", "射門"],
  ["shotsOnTarget", "射正"],
  ["wonCorners", "角球"],
  ["foulsCommitted", "犯規"],
  ["offsides", "越位"],
  ["saves", "救球"],
  ["yellowCards", "黃牌"],
  ["redCards", "紅牌"],
  ["totalPasses", "傳球"],
  ["passPct", "傳球成功率"],
  ["interceptions", "攔截"],
  ["totalClearance", "解圍"],
  ["effectiveTackles", "搶截"]
];

const SEASON_TEAM_STATS = [
  ["goalDifference", "得失球"],
  ["totalGoals", "進球"],
  ["goalAssists", "助攻"],
  ["goalsConceded", "失球"]
];

const SEASON_STAT_ZH = {
  starts: "先發",
  foulsCommitted: "犯規",
  foulsSuffered: "被犯",
  yellowCards: "黃牌",
  redCards: "紅牌",
  totalGoals: "進球",
  goalAssists: "助攻",
  totalShots: "射門",
  shotsOnTarget: "射正",
  offsides: "越位",
  cleanSheet: "零封",
  saves: "撲救",
  goalsConceded: "失球",
  appearances: "出賽",
  subIns: "替補",
  ownGoals: "烏龍",
  minutes: "分鐘"
};

const TIME_KINDS = [
  { id: "15", title: "15 分鐘", sort: 101500 },
  { id: "30", title: "30 分鐘", sort: 103000 },
  { id: "ht", title: "半場", sort: 109000 },
  { id: "60", title: "60 分鐘", sort: 206000 },
  { id: "75", title: "75 分鐘", sort: 207500 },
  { id: "ft", title: "全場", sort: 900000 }
];

const DELTA_KEYS = ["possessionPct", "totalShots", "shotsOnTarget", "wonCorners", "foulsCommitted", "offsides", "saves", "yellowCards", "redCards"];

const state = {
  matches: [],
  leagueErrors: [],
  scheduleReady: false,
  scheduleLoadedAt: 0,
  scheduleError: false,
  scheduleStaleError: false,
  rangeMode: "",
  rangeCache: null,
  model: null,
  memory: null,
  summaryLoading: false,
  summaryError: false,
  summaryStaleError: false,
  summaryLoadedAt: 0,
  filter: "all",
  day: "",
  tab: "all",
  pred: null,
  predAbort: null,
  token: 0,
  abort: null,
  timer: 0,
  enteredFromSchedule: false,
  softScroll: 0
};

function teamZh(id, fallback) {
  const key = String(id || "");
  const tw = TEAM_ZH[key];
  if (locale() === "cn") {
    if (TEAM_CN[key]) return TEAM_CN[key];
    if (tw) return han(tw);
  }
  return tw || fallback || (locale() === "cn" ? "球队" : "球隊");
}

function relabelNames() {
  const fix = (side) => {
    if (side?.id) side.name = teamZh(side.id, side.rawName || side.name);
  };
  for (const match of state.matches) {
    fix(match.home);
    fix(match.away);
  }
  const model = state.model;
  if (!model) return;
  fix(model.home);
  fix(model.away);
  for (const ev of model.events || []) {
    if (ev.teamId) ev.teamName = teamZh(ev.teamId, ev.teamName);
  }
  for (const block of model.form || []) {
    if (block.id) block.name = teamZh(block.id, block.name);
  }
  for (const game of model.h2h?.games || []) {
    for (const team of game.teams || []) if (team.id) team.name = teamZh(team.id, team.name);
  }
  for (const scorer of model.scorers || []) {
    /* team name is rewritten when cheat lines render from current side names */
  }
}

function posZh(abbr) {
  if (!abbr) return "";
  return POS_ZH[abbr] || abbr;
}

function tendency(text) {
  const s = String(text || "").replace(/。$/, "");
  if (s.startsWith("以目前數據來看")) return s.endsWith("。") ? s : s + "。";
  return "以目前數據來看，" + s + "。";
}

function pick(key, lists) {
  let hsh = 2166136261;
  const s = String(key || "");
  for (let i = 0; i < s.length; i += 1) {
    hsh ^= s.charCodeAt(i);
    hsh = Math.imul(hsh, 16777619);
  }
  return lists[(hsh >>> 0) % lists.length];
}

function trimNum(n) {
  const r = Math.round(Number(n) * 10) / 10;
  return String(r);
}

function signed(n) {
  const v = Number(n) || 0;
  return (v > 0 ? "+" : "") + trimNum(v);
}

function fmtStat(key, v) {
  if (v == null || Number.isNaN(Number(v))) return "–";
  if (key === "possessionPct" || key === "passPct" || /Pct$/.test(key)) return trimNum(v) + "%";
  return trimNum(v);
}

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isNilScore(v) {
  return v === 0 || v === "0" || v === "0.0" || v === "–" || v == null || v === "";
}

function pLimit(n) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < n && queue.length) {
      const job = queue.shift();
      active += 1;
      job.fn().then(job.ok, job.bad).finally(() => {
        active -= 1;
        pump();
      });
    }
  };
  return (fn) => new Promise((ok, bad) => {
    queue.push({ fn, ok, bad });
    pump();
  });
}

const limit = pLimit(6);

function taipeiYmd(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function eachYmd(from, to) {
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function ymdMeta(ymd) {
  const date = new Date(`${ymd}T12:00:00+08:00`);
  const wd = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, weekday: "short" }).format(date);
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d, wd };
}

function dayTitle(ymd, today) {
  const meta = ymdMeta(ymd);
  let rel = "";
  if (ymd === today) rel = "今天";
  else if (ymd === addDays(today, -1)) rel = "昨天";
  else if (ymd === addDays(today, 1)) rel = "明天";
  return `${meta.m}月${meta.d}日 ${meta.wd}${rel ? " · " + rel : ""}`;
}

function taipeiHM(iso) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(iso));
}

function taipeiClock(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(date);
}

function shortDate(iso) {
  if (!iso) return "";
  const meta = ymdMeta(taipeiYmd(iso));
  return `${meta.m}/${meta.d}`;
}

function inWindow(iso, start, end) {
  const t = new Date(iso).getTime();
  const a = new Date(`${start}T00:00:00+08:00`).getTime();
  const b = new Date(`${addDays(end, 1)}T00:00:00+08:00`).getTime();
  return t >= a && t < b;
}

function windowBounds() {
  const today = taipeiYmd(new Date());
  return { today, start: addDays(today, -3), end: addDays(today, 7) };
}

function compZh(name) {
  if (!name) return "";
  const rules = [
    [/UEFA Nations League/gi, "歐國聯"],
    [/Europa Conference League|Conference League/gi, "歐協聯"],
    [/Champions League/gi, "歐冠"],
    [/Europa League/gi, "歐霞"],
    [/English Premier League|Premier League/gi, "英超"],
    [/LaLiga|La Liga|LALIGA/gi, "西甲"],
    [/Serie A/gi, "義甲"],
    [/Bundesliga/gi, "德甲"],
    [/Ligue 1/gi, "法甲"],
    [/EURO\b/gi, "歐洲國家盃"],
    [/Qualifying/gi, "資格賽"],
    [/Major League Soccer|\bMLS\b/gi, "美職聯"],
    [/J\.?\s?League|J1 League/gi, "J1 聯賽"],
    [/FIFA World Cup|World Cup/gi, "世界盃"],
    [/International Friendly/gi, "國際賽"],
    [/Carabao Cup|EFL Cup|League Cup/gi, "英格蘭聯賽盃"],
    [/FA Cup/gi, "足總盃"],
    [/Copa del Rey/gi, "國王盃"],
    [/DFB-?Pokal/gi, "德國盃"],
    [/Coppa Italia/gi, "義大利盃"]
  ];
  let s = String(name);
  for (const [re, zh] of rules) s = s.replace(re, zh);
  s = s.replace(/Spanish\s+西甲/g, "西甲")
    .replace(/Italian\s+義甲/g, "義甲")
    .replace(/German\s+德甲/g, "德甲")
    .replace(/French\s+法甲/g, "法甲")
    .replace(/English\s+英超/g, "英超");
  return s;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: state.abort?.signal, cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data && data.message && data.code && !Array.isArray(data.events) && !data.header && !data.statistics) {
    throw new Error(String(data.message));
  }
  return data;
}

function logoOf(team) {
  if (!team) return "";
  if (team.logo) return team.logo;
  const logos = team.logos || [];
  const found = logos.find((item) => (item.rel || []).includes("default")) || logos[0];
  return found?.href || "";
}

function parseClock(text) {
  const m = String(text || "").match(/(\d+)\s*'(?:\s*\+\s*(\d+))?/);
  if (!m) return null;
  return { base: Number(m[1]), extra: m[2] ? Number(m[2]) : 0 };
}

function readMinute(status) {
  const t = status?.type || {};
  const clock = status?.displayClock || t.shortDetail || "";
  const period = Number(status?.period || 0);
  const name = t.name || "";
  const stateName = t.state || "";
  if (stateName === "pre" || name === "STATUS_SCHEDULED") {
    return { phase: "pre", base: 0, extra: 0, period: 0, label: "未開賽", statusName: name, state: "pre" };
  }
  if (name === "STATUS_HALFTIME" || clock === "HT") {
    return { phase: "ht", base: 45, extra: 0, period: 1, label: "中場", statusName: name, state: "in" };
  }
  if (stateName === "post" || /FULL_TIME|FINAL/.test(name)) {
    const parsed = parseClock(clock);
    return {
      phase: "ft",
      base: parsed?.base || 90,
      extra: parsed?.extra || 0,
      period: period || 2,
      label: STATUS_ZH[name] || "完賽",
      statusName: name,
      state: "post"
    };
  }
  const parsed = parseClock(clock);
  const base = parsed?.base || 0;
  return {
    phase: "play",
    base,
    extra: parsed?.extra || 0,
    period: period || (base > 45 ? 2 : 1),
    label: clock || STATUS_ZH[name] || "進行中",
    statusName: name,
    state: stateName || "in"
  };
}

function clockLabel(status) {
  const minute = readMinute(status);
  if (minute.phase === "pre") return "未開賽";
  return minute.label;
}

function phaseText(minute) {
  if (minute.phase === "pre") return "未開賽";
  if (minute.phase === "ht") return "中場";
  if (minute.phase === "ft") return minute.label;
  if (minute.period >= 2) return "下半場";
  if (minute.period === 1) return "上半場";
  return STATUS_ZH[minute.statusName] || "";
}

function safeColor(hex) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (r + g + b > 690) return "";
  return "#" + h;
}

function readNumbers(list, percentNames) {
  const out = {};
  for (const item of list || []) {
    if (!item || !item.name) continue;
    const n = parseFloat(String(item.displayValue ?? item.value).replace("%", ""));
    if (!Number.isFinite(n)) continue;
    let v = n;
    if (percentNames && item.name !== "possessionPct" && /Pct$/.test(item.name) && v <= 1.5) {
      v = Math.round(v * 1000) / 10;
    }
    out[item.name] = v;
  }
  return out;
}

function sideFrom(c) {
  const team = c?.team || {};
  const id = String(c?.id || team.id || "");
  return {
    id,
    name: teamZh(id, team.displayName || team.name || ""),
    rawName: team.displayName || team.name || "",
    abbr: team.abbreviation || "",
    logo: logoOf(team),
    color: team.color || "",
    score: c?.score != null ? String(c.score) : "–",
    linescores: c?.linescores || []
  };
}

function normalizeEvent(ev, league) {
  const comp = (ev.competitions || [])[0];
  if (!comp) return null;
  const teams = {};
  for (const c of comp.competitors || []) teams[c.homeAway] = sideFrom(c);
  if (!teams.home || !teams.away) return null;
  const status = comp.status || ev.status || {};
  return {
    id: String(ev.id),
    league: league.slug,
    leagueName: league.name,
    date: comp.date || ev.date,
    state: status.type?.state || "",
    statusName: status.type?.name || "",
    clock: clockLabel(status),
    venue: comp.venue?.fullName || ev.venue?.fullName || "",
    home: teams.home,
    away: teams.away,
    odds: parseBook((comp.odds || [])[0])
  };
}

function wantedDays(mode) {
  const bounds = windowBounds();
  const near = [addDays(bounds.today, -1), bounds.today, addDays(bounds.today, 1)];
  if (mode === "live") {
    const set = new Set();
    const leagues = new Set();
    for (const match of state.matches) {
      if (match.state !== "in" || !match.date) continue;
      set.add(match.date.slice(0, 10));
      set.add(taipeiYmd(match.date));
      leagues.add(match.league);
    }
    if (!set.size) return { ...bounds, days: near, full: false, leagues: null };
    return { ...bounds, days: [...set].filter(Boolean).sort(), full: false, leagues };
  }
  if (mode === "today") return { ...bounds, days: near, full: false, leagues: null };
  return { ...bounds, days: eachYmd(addDays(bounds.start, -1), addDays(bounds.end, 1)), full: true, leagues: null };
}

/* 每個聯賽每一天的賽程快取：避免每次刷新都重抓十幾天、被 ESPN 限流 */
const dayCache = new Map();

function dayTtl(day) {
  const today = taipeiYmd(new Date());
  if (day >= addDays(today, -1) && day <= addDays(today, 1)) return 0;
  if (day < today) return 6 * 3600 * 1000;
  return 20 * 60 * 1000;
}

async function probeRange(days) {
  if (state.rangeMode === "on" || state.rangeMode === "off") return;
  const slug = "eng.1";
  try {
    const data = await fetchJson(`${API}/${slug}/scoreboard?dates=${days[0].replaceAll("-", "")}-${days[days.length - 1].replaceAll("-", "")}`);
    if (!Array.isArray(data.events)) throw new Error("no events");
    state.rangeMode = "on";
    state.rangeCache = { slug, events: data.events };
  } catch (err) {
    if (err.name === "AbortError") throw err;
    state.rangeMode = "off";
  }
}

async function fetchLeague(slug, days) {
  if (state.rangeMode === "on") {
    if (state.rangeCache && state.rangeCache.slug === slug) {
      const cached = state.rangeCache.events;
      state.rangeCache = null;
      return cached;
    }
    const data = await fetchJson(`${API}/${slug}/scoreboard?dates=${days[0].replaceAll("-", "")}-${days[days.length - 1].replaceAll("-", "")}`);
    return data.events || [];
  }
  const chunks = await Promise.all(days.map((day) => limit(async () => {
    const key = `${slug}:${day}`;
    const hit = dayCache.get(key);
    if (hit && Date.now() - hit.t < dayTtl(day)) return hit.events;
    try {
      const data = await fetchJson(`${API}/${slug}/scoreboard?dates=${day.replaceAll("-", "")}`);
      dayCache.set(key, { t: Date.now(), events: data.events || [] });
      return data.events || [];
    } catch (err) {
      if (hit) return hit.events;
      if (err.name === "AbortError") throw err;
      return null;
    }
  })));
  if (chunks.every((chunk) => chunk == null)) throw new Error("league failed");
  const map = new Map();
  for (const list of chunks) {
    for (const ev of list || []) map.set(String(ev.id), ev);
  }
  return [...map.values()];
}

function matchName(en, home, away) {
  const n = String(en || "").trim().toLowerCase();
  for (const team of [home, away]) {
    if (!team) continue;
    if (team.rawName.toLowerCase() === n || team.abbr.toLowerCase() === n) return team.name;
    if (team.rawName && n.includes(team.rawName.toLowerCase())) return team.name;
  }
  return String(en || "").trim();
}

function classifyEvent(ev) {
  const blob = `${ev.type?.text || ""} ${ev.type?.type || ""}`.toLowerCase();
  if (/end delay/.test(blob)) return "marker";
  if (/miss/.test(blob) && /penalt/.test(blob)) return "miss";
  if (ev.scoringPlay || /goal/.test(blob)) return "goal";
  if (/red/.test(blob)) return "red";
  if (/yellow/.test(blob)) return "yellow";
  if (/substitut/.test(blob)) return "sub";
  if (/kickoff|halftime|half-time|2nd|second half|delay/.test(blob)) return "marker";
  return "other";
}

function markerLabel(ev) {
  const blob = `${ev.type?.text || ""} ${ev.type?.type || ""}`.toLowerCase();
  if (/kickoff/.test(blob)) return "開球";
  if (/halftime|half-time/.test(blob)) return "中場";
  if (/2nd|second/.test(blob)) return "下半場開始";
  if (/end delay/.test(blob)) return "比賽恢復";
  if (/delay/.test(blob)) return "比賽暫停";
  return "比賽進程";
}

function goalStyle(ev) {
  const blob = `${ev.type?.text || ""} ${ev.type?.type || ""} ${ev.text || ""}`.toLowerCase();
  if (/own goal|own-goal/.test(blob)) return "烏龍";
  if (/header/.test(blob)) return "頭槌";
  if (/penalt/.test(blob)) return "點球";
  if (/free/.test(blob)) return "自由球";
  return "";
}

function spokenFor(ev) {
  const min = ev.minuteLabel || "";
  const team = ev.teamName || "球隊";
  if (ev.kind === "goal") {
    const who = ev.scorer || "未列名";
    const style = ev.style ? `，方式是${ev.style}` : "";
    const assist = ev.assist ? `，助攻 ${ev.assist}` : "";
    const score = ev.score ? `比分 ${ev.score}。` : "事件文字沒有寫上比分。";
    return pick(ev.id, [
      [`${min}，${team}進球，${who}${style}${assist}。`, score],
      [`各位，先記 ${min}。`, `${who}幫${team}把球放進去${style}${assist}。`, score],
      [`${team}有進球，時間 ${min}。`, `進球者 ${who}${assist}。`, score]
    ]).slice(0, 3);
  }
  if (ev.kind === "yellow") {
    const who = ev.playerNames[0] || "未列名";
    return pick(ev.id, [
      [`黃牌，${min}，${who}，${team}。`],
      [`${min} ${team}有人吃牌。`, `${who}被出示黃牌。`],
      [`紀律記一下，${min} 黃牌是 ${who}（${team}）。`]
    ]);
  }
  if (ev.kind === "red") {
    const who = ev.playerNames[0] || "未列名";
    return pick(ev.id, [
      [`紅牌，${min}，${who}，${team}。`],
      [`${min} ${team}看到紅牌。`, `對象是 ${who}。`],
      [`${who}（${team}）在 ${min} 被出示紅牌。`]
    ]);
  }
  if (ev.kind === "sub" && ev.subOn && ev.subOff) {
    return pick(ev.id, [
      [`換人，${min}，${team}。`, `${ev.subOn} 上場，${ev.subOff} 下場。`],
      [`${min} ${team}調整人手。`, `上場 ${ev.subOn}，下場 ${ev.subOff}。`],
      [`${team}在 ${min} 換人。`, `${ev.subOff} 被換下，${ev.subOn} 上來。`]
    ]);
  }
  if (ev.kind === "sub") return [`${min} ${team}換人：${ev.playerNames.join("、") || "未列名"}。`];
  if (ev.kind === "miss") return [`${min} 點球沒進，${ev.playerNames[0] || "未列名"}（${team}）。`];
  if (ev.kind === "marker") return [`${min ? min + " " : ""}${ev.fact}。`.trim()];
  return [`${min} ${ev.fact}${team ? "，" + team : ""}。`];
}

function eventSort(ev) {
  const p = ev.period || (ev.base > 45 ? 2 : 1);
  return p * 100000 + (ev.base || 0) * 100 + (ev.extra || 0);
}

function buildEvents(raw, home, away) {
  const events = [];
  (raw || []).forEach((ev, index) => {
    const kind = classifyEvent(ev);
    const clock = ev.clock?.displayValue || "";
    const parsed = parseClock(clock);
    const names = (ev.participants || []).map((p) => playerZh(p.athlete?.displayName)).filter(Boolean);
    const ids = (ev.participants || []).map((p) => String(p.athlete?.id || ""));
    let period = Number(ev.period?.number || ev.period || 0);
    const base = parsed?.base || 0;
    if (!period) period = base > 45 ? 2 : 1;
    const teamId = String(ev.team?.id || "");
    const teamName = teamId === home.id ? home.name : teamId === away.id ? away.name : teamZh(teamId, ev.team?.displayName || "");
    let subOn = "";
    let subOff = "";
    if (kind === "sub" && /replaces/i.test(ev.text || "") && names[0] && names[1]) {
      subOn = names[0];
      subOff = names[1];
    }
    let score = "";
    const scored = /Goal!\s*(.+?)\s+(\d+)\s*,\s*(.+?)\s+(\d+)/i.exec(ev.text || "");
    if (scored) score = `${matchName(scored[1], home, away)} ${scored[2]} 比 ${matchName(scored[3], home, away)} ${scored[4]}`;
    const item = {
      id: String(ev.id || index),
      kind,
      minuteLabel: clock || "",
      base,
      extra: parsed?.extra || 0,
      period,
      teamId,
      teamName,
      playerNames: names,
      playerIds: ids,
      scorer: kind === "goal" ? (names[0] || "") : "",
      assist: kind === "goal" && names[1] && /assisted by/i.test(ev.text || "") ? names[1] : "",
      style: kind === "goal" ? goalStyle(ev) : "",
      subOn,
      subOff,
      score,
      fact: ""
    };
    item.fact = item.kind === "marker" ? markerLabel(ev) : factOf(item);
    item.spoken = spokenFor(item);
    events.push(item);
  });
  events.sort((a, b) => eventSort(a) - eventSort(b) || String(a.id).localeCompare(String(b.id)));
  return events;
}

function factOf(ev) {
  if (ev.kind === "goal") {
    const how = ev.style || "進球";
    let s = `${how}：${ev.scorer || "未列名"}`;
    if (ev.assist) s += `，助攻 ${ev.assist}`;
    if (ev.score) s += `。比分 ${ev.score}`;
    return s;
  }
  if (ev.kind === "yellow") return `黃牌：${ev.playerNames[0] || "未列名"}`;
  if (ev.kind === "red") return `紅牌：${ev.playerNames[0] || "未列名"}`;
  if (ev.kind === "sub") {
    if (ev.subOn) return `換人：${ev.subOn} 上場，${ev.subOff} 下場`;
    return `換人：${ev.playerNames.join("、") || "未列名"}`;
  }
  if (ev.kind === "miss") return `點球沒進：${ev.playerNames[0] || "未列名"}`;
  return ev.playerNames.length ? `比賽事件：${ev.playerNames.join("、")}` : "比賽事件";
}

function readRoster(block) {
  return {
    formation: block?.formation || "",
    players: (block?.roster || []).map((row) => {
      const athlete = row.athlete || {};
      const abbr = row.position?.abbreviation || "";
      const en = athlete.displayName || athlete.fullName || "";
      const zh = playerZh(en);
      const known = zh && zh !== en;
      return {
        id: String(athlete.id || ""),
        name: zh || "球員",
        en,
        shortName: known ? zh : athlete.shortName || "",
        lastName: known ? zh : athlete.lastName || "",
        jersey: row.jersey || athlete.jersey || "",
        posAbbr: abbr,
        posZh: posZh(abbr),
        starter: !!row.starter,
        formationPlace: Number(row.formationPlace || 0),
        outFor: String(row.subbedOutFor?.athlete?.id || ""),
        inFor: String(row.subbedInFor?.athlete?.id || ""),
        outMin: ((row.plays || []).find((pl) => pl.substitution)?.clock?.displayValue) || "",
        redPlay: (row.plays || []).some((pl) => pl.redCard),
        stats: readNumbers(row.stats, false),
        goalMins: [],
        assistMins: [],
        yellowMins: [],
        redMins: [],
        subOn: "",
        subOff: ""
      };
    })
  };
}

function attachPlayerEvents(roster, events) {
  const map = new Map();
  for (const side of [roster.home, roster.away]) {
    for (const player of side.players) if (player.id) map.set(player.id, player);
  }
  for (const ev of events) {
    if (ev.kind === "goal") {
      const scorer = map.get(ev.playerIds[0]);
      if (scorer && ev.minuteLabel) scorer.goalMins.push(ev.minuteLabel);
      if (ev.assist) {
        const assist = map.get(ev.playerIds[1]);
        if (assist && ev.minuteLabel) assist.assistMins.push(ev.minuteLabel);
      }
    } else if (ev.kind === "yellow") {
      const player = map.get(ev.playerIds[0]);
      if (player && ev.minuteLabel) player.yellowMins.push(ev.minuteLabel);
    } else if (ev.kind === "red") {
      const player = map.get(ev.playerIds[0]);
      if (player && ev.minuteLabel) player.redMins.push(ev.minuteLabel);
    } else if (ev.kind === "sub" && ev.subOn) {
      const on = map.get(ev.playerIds[0]);
      const off = map.get(ev.playerIds[1]);
      if (on) on.subOn = ev.minuteLabel;
      if (off) off.subOff = ev.minuteLabel;
    }
  }
}

function readTable(data) {
  const map = {};
  for (const group of data?.standings?.groups || []) {
    for (const entry of group?.standings?.entries || []) {
      const id = String(entry.id || "");
      const stats = {};
      for (const item of entry.stats || []) stats[item.name] = item.displayValue;
      if (id) map[id] = stats;
    }
  }
  return map;
}

function readScorers(data) {
  const out = [];
  for (const block of data?.leaders || []) {
    const teamName = teamZh(block.team?.id, block.team?.displayName);
    for (const cat of block.leaders || []) {
      const label = `${cat.name || ""} ${cat.displayName || ""}`;
      if (!/goal/i.test(label)) continue;
      const top = (cat.leaders || [])[0];
      if (!top) continue;
      const text = String(top.displayValue || "");
      const goals = /Goals:\s*(\d+)/i.exec(text);
      const matches = /Matches:\s*(\d+)/i.exec(text);
      if (!goals) continue;
      out.push({
        teamName,
        player: playerZh(top.athlete?.displayName || ""),
        goals: goals[1],
        matches: matches ? matches[1] : ""
      });
    }
  }
  return out;
}

function readForm(data) {
  return (data?.lastFiveGames || []).map((block) => ({
    id: String(block.team?.id || ""),
    name: teamZh(block.team?.id, block.team?.displayName),
    games: (block.events || []).map((ev) => ({
      date: ev.gameDate,
      result: ev.gameResult,
      score: ev.score,
      opponent: teamZh(ev.opponent?.id, ev.opponent?.displayName || ""),
      comp: compZh(ev.competitionName || "")
    })).sort((a, b) => new Date(b.date) - new Date(a.date))
  }));
}

function readH2H(data, home, away) {
  const series = (data?.seasonseries || [])[0];
  const games = [];
  for (const ev of series?.events || []) {
    const teams = (ev.competitors || []).map((c) => ({
      id: String(c.team?.id || ""),
      name: teamZh(c.team?.id, c.team?.displayName),
      score: c.score,
      homeAway: c.homeAway
    })).filter((c) => c.score != null && c.score !== "");
    if (teams.length < 2) continue;
    games.push({ date: ev.date, teams });
  }
  games.sort((a, b) => new Date(b.date) - new Date(a.date));
  let hw = 0;
  let aw = 0;
  let dr = 0;
  for (const game of games) {
    const h = game.teams.find((t) => t.id === home.id);
    const a = game.teams.find((t) => t.id === away.id);
    if (!h || !a) continue;
    const hs = Number(h.score);
    const as = Number(a.score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    if (hs > as) hw += 1;
    else if (as > hs) aw += 1;
    else dr += 1;
  }
  return { games, hw, aw, dr };
}

function teamStats(data, home, away) {
  const teams = data?.boxscore?.teams || [];
  const homeRow = teams.find((t) => t.homeAway === "home" || String(t.team?.id) === home.id);
  const awayRow = teams.find((t) => t.homeAway === "away" || String(t.team?.id) === away.id);
  const homeStats = readNumbers(homeRow?.statistics, true);
  const awayStats = readNumbers(awayRow?.statistics, true);
  const matchish = ["possessionPct", "totalShots", "shotsOnTarget", "wonCorners", "saves"]
    .some((key) => homeStats[key] != null || awayStats[key] != null);
  const seasonish = SEASON_TEAM_STATS.some(([key]) => homeStats[key] != null || awayStats[key] != null);
  let mode = "none";
  if (matchish) mode = "match";
  else if (seasonish) mode = "season";
  if (!home.logo && homeRow) home.logo = logoOf(homeRow.team);
  if (!away.logo && awayRow) away.logo = logoOf(awayRow.team);
  return { mode, home: homeStats, away: awayStats };
}

function buildModel(data, leagueSlug) {
  const comp = data?.header?.competitions?.[0];
  if (!comp) throw new Error("no competition");
  const league = LEAGUES.find((item) => item.slug === leagueSlug) || { slug: leagueSlug, name: leagueSlug };
  const competitors = comp.competitors || [];
  const home = sideFrom(competitors.find((c) => c.homeAway === "home") || competitors[0]);
  const away = sideFrom(competitors.find((c) => c.homeAway === "away") || competitors[1]);
  const minute = readMinute(comp.status || {});
  const rosterSides = data.rosters || [];
  const roster = {
    home: readRoster(rosterSides.find((s) => s.homeAway === "home")),
    away: readRoster(rosterSides.find((s) => s.homeAway === "away"))
  };
  const events = buildEvents(data.keyEvents || [], home, away);
  attachPlayerEvents(roster, events);
  const venue = data.gameInfo?.venue || {};
  return {
    id: String(data.header?.id || comp.id),
    leagueSlug,
    leagueName: league.name,
    kickoff: comp.date || data.header?.competitions?.[0]?.date,
    venue: venue.fullName || "",
    city: venue.address?.city || "",
    minute,
    home,
    away,
    stats: teamStats(data, home, away),
    events,
    roster,
    table: readTable(data),
    scorers: readScorers(data),
    form: readForm(data),
    formIds: (data.lastFiveGames || []).map((block) => ({
      id: String(block.team?.id || ""),
      events: (block.events || []).map((ev) => ({
        id: String(ev.id),
        date: ev.gameDate,
        home: String(ev.homeTeamId || ""),
        away: String(ev.awayTeamId || ""),
        hs: Number(ev.homeTeamScore),
        as: Number(ev.awayTeamScore)
      }))
    })),
    commentary: typeof parseCommentary === "function" ? parseCommentary(data.commentary || [], home, away) : [],
    h2h: readH2H(data, home, away),
    odds: parseBook((data.pickcenter || [])[0] || (data.odds || [])[0])
  };
}

function slimStats(stats) {
  const out = { home: {}, away: {} };
  for (const side of ["home", "away"]) {
    for (const key of DELTA_KEYS) {
      const v = stats?.[side]?.[key];
      if (typeof v === "number" && Number.isFinite(v)) out[side][key] = v;
    }
  }
  return out;
}

function diffSide(prev, curr) {
  const out = {};
  for (const key of DELTA_KEYS) {
    if (typeof prev?.[key] !== "number" || typeof curr?.[key] !== "number") continue;
    out[key] = { prev: prev[key], curr: curr[key], d: Math.round((curr[key] - prev[key]) * 10) / 10 };
  }
  return out;
}

function changeBits(delta, homeName, awayName) {
  const bits = [];
  const labels = Object.fromEntries(MATCH_STATS);
  for (const key of ["totalShots", "shotsOnTarget", "wonCorners", "possessionPct", "foulsCommitted", "yellowCards", "redCards", "saves"]) {
    const h = delta.home[key];
    const a = delta.away[key];
    if (!h && !a) continue;
    if ((h?.d || 0) === 0 && (a?.d || 0) === 0) continue;
    const label = labels[key] || key;
    if (key === "possessionPct") {
      bits.push(`${label} ${homeName} ${signed(h?.d || 0)}、${awayName} ${signed(a?.d || 0)} 個百分點`);
    } else {
      bits.push(`${label} ${homeName} ${signed(h?.d || 0)}、${awayName} ${signed(a?.d || 0)}`);
    }
  }
  return bits;
}

function pressingSentence(delta, homeName, awayName) {
  const shot = (delta.home.totalShots?.d || 0) - (delta.away.totalShots?.d || 0);
  const cor = (delta.home.wonCorners?.d || 0) - (delta.away.wonCorners?.d || 0);
  const pos = (delta.home.possessionPct?.d || 0) - (delta.away.possessionPct?.d || 0);
  const homeOn = shot >= 2 || cor >= 2 || pos >= 8;
  const awayOn = -shot >= 2 || -cor >= 2 || -pos >= 8;
  if (homeOn && awayOn) {
    return tendency(`這段沒有單邊壓制。射門差（主減客）${signed(shot)}，角球差 ${signed(cor)}，控球差 ${signed(pos)} 個百分點`);
  }
  if (!homeOn && !awayOn) return "";
  const name = homeOn ? homeName : awayName;
  const other = homeOn ? awayName : homeName;
  const side = homeOn ? delta.home : delta.away;
  const otherSide = homeOn ? delta.away : delta.home;
  const bits = [];
  if ((side.totalShots?.d || 0) !== 0 || (otherSide.totalShots?.d || 0) !== 0) {
    bits.push(`射門 ${name} ${signed(side.totalShots?.d || 0)}、${other} ${signed(otherSide.totalShots?.d || 0)}`);
  }
  if ((side.wonCorners?.d || 0) !== 0 || (otherSide.wonCorners?.d || 0) !== 0) {
    bits.push(`角球 ${name} ${signed(side.wonCorners?.d || 0)}、${other} ${signed(otherSide.wonCorners?.d || 0)}`);
  }
  if ((side.possessionPct?.d || 0) !== 0) bits.push(`控球率 ${signed(side.possessionPct?.d || 0)} 個百分點`);
  return tendency(`${name}這段比較像在壓制，${bits.join("，")}`);
}

function makeDelta(baseStats, currentStats, fromLabel, toLabel, homeName, awayName) {
  const home = diffSide(baseStats?.home, currentStats?.home);
  const away = diffSide(baseStats?.away, currentStats?.away);
  if (!Object.keys(home).length && !Object.keys(away).length) return null;
  const delta = { home, away, fromLabel, toLabel };
  const pressing = pressingSentence(delta, homeName, awayName);
  const bits = changeBits(delta, homeName, awayName);
  let sentence = pressing;
  if (!sentence) {
    sentence = bits.length
      ? `從 ${fromLabel} 到 ${toLabel}，${bits.join("，")}。`
      : `從 ${fromLabel} 到 ${toLabel}，射門、角球、控球率沒有變化。`;
  }
  delta.sentence = sentence;
  delta.pressing = pressing;
  delta.bits = bits;
  return delta;
}

function gapLines(model) {
  if (model.stats.mode !== "match") return [];
  const specs = [
    ["possessionPct", "控球率", 10],
    ["totalShots", "射門", 4],
    ["shotsOnTarget", "射正", 3],
    ["wonCorners", "角球", 3],
    ["foulsCommitted", "犯規", 6],
    ["saves", "救球", 3]
  ];
  const lines = [];
  for (const [key, label, min] of specs) {
    const h = model.stats.home[key];
    const a = model.stats.away[key];
    if (typeof h !== "number" || typeof a !== "number" || Math.abs(h - a) < min) continue;
    const homeLead = h > a;
    lines.push(`${label} ${homeLead ? model.home.name : model.away.name} ${fmtStat(key, homeLead ? h : a)}，${homeLead ? model.away.name : model.home.name} ${fmtStat(key, homeLead ? a : h)}。`);
  }
  return lines;
}

function disciplineInfo(model) {
  const tally = {
    home: { y: 0, r: 0, yNames: [], rNames: [] },
    away: { y: 0, r: 0, yNames: [], rNames: [] }
  };
  for (const ev of model.events) {
    const side = ev.teamId === model.home.id ? "home" : ev.teamId === model.away.id ? "away" : "";
    if (!side) continue;
    if (ev.kind === "yellow") {
      tally[side].y += 1;
      if (ev.playerNames[0]) tally[side].yNames.push(ev.playerNames[0]);
    }
    if (ev.kind === "red") {
      tally[side].r += 1;
      if (ev.playerNames[0]) tally[side].rNames.push(ev.playerNames[0]);
    }
  }
  const bits = [];
  for (const side of ["home", "away"]) {
    const name = model[side].name;
    const row = tally[side];
    if (row.r) bits.push(`${name}紅牌 ${row.r}${row.rNames.length ? "（" + row.rNames.join("、") + "）" : ""}`);
    if (row.y) bits.push(`${name}黃牌 ${row.y}${row.yNames.length ? "（" + row.yNames.join("、") + "）" : ""}`);
  }
  let risk = "";
  if (tally.home.r > tally.away.r) risk = tendency(`${model.home.name}有紅牌，紀律這端要盯著`);
  else if (tally.away.r > tally.home.r) risk = tendency(`${model.away.name}有紅牌，紀律這端要盯著`);
  else if (tally.home.y >= tally.away.y + 2) {
    risk = tendency(`${model.home.name}黃牌 ${tally.home.y} 張，${model.away.name} ${tally.away.y} 張，牌數比較多，紀律風險高一些`);
  } else if (tally.away.y >= tally.home.y + 2) {
    risk = tendency(`${model.away.name}黃牌 ${tally.away.y} 張，${model.home.name} ${tally.home.y} 張，牌數比較多，紀律風險高一些`);
  }
  return {
    fact: bits.length ? bits.join("；") + "。" : "目前事件裡沒有黃牌或紅牌。",
    risk
  };
}

function reached(kind, minute) {
  const name = minute?.statusName || "";
  if (/ABANDON|CANCEL|POSTPONE/.test(name)) return false;
  const post = minute?.phase === "ft" || minute?.state === "post" || /FULL_TIME|FINAL/.test(name);
  const ht = minute?.phase === "ht" || name === "STATUS_HALFTIME";
  const p = minute?.period || 0;
  const b = minute?.base || 0;
  if (kind === "15") return post || ht || p > 1 || b >= 15;
  if (kind === "30") return post || ht || p > 1 || b >= 30;
  if (kind === "ht") return post || ht || p >= 2;
  if (kind === "60") return post || (p >= 2 && b >= 60);
  if (kind === "75") return post || (p >= 2 && b >= 75);
  if (kind === "ft") return post;
  return false;
}

function eventsInKind(events, kind) {
  return events.filter((ev) => {
    if (!["goal", "yellow", "red", "sub"].includes(ev.kind)) return false;
    const key = eventSort(ev);
    const p = ev.period || (ev.base > 45 ? 2 : 1);
    if (kind === "15") return p === 1 && key <= 101500;
    if (kind === "30") return p === 1 && key > 101500 && key <= 103000;
    if (kind === "ht") return p === 1 && key > 103000;
    if (kind === "60") return p >= 2 && key <= 206000;
    if (kind === "75") return p >= 2 && key > 206000 && key <= 207500;
    if (kind === "ft") return key > 207500;
    return false;
  });
}

function scoreFromEvents(model, kindId) {
  const kind = TIME_KINDS.find((item) => item.id === kindId);
  const goals = model.events.filter((ev) => ev.kind === "goal" && eventSort(ev) <= kind.sort)
    .sort((a, b) => eventSort(a) - eventSort(b));
  if (!goals.length) {
    const anyGoal = model.events.some((ev) => ev.kind === "goal");
    const nil = isNilScore(model.home.score) && isNilScore(model.away.score);
    if (anyGoal || nil) return "事件紀錄裡還沒有進球，比分 0 比 0";
    return "事件清單對不上計分板，這個時間點的比分不另作推算";
  }
  const last = goals[goals.length - 1];
  if (last.score) return `事件紀錄寫到 ${last.score}`;
  return "事件紀錄有進球，但沒有寫上比分";
}

function verdictOf(seg, delta, scorePhrase) {
  const goals = seg.filter((ev) => ev.kind === "goal");
  if (goals.length) {
    const goal = goals[goals.length - 1];
    return `${goal.minuteLabel} ${goal.teamName}進球${goal.scorer ? "，" + goal.scorer : ""}。${scorePhrase}`;
  }
  if (delta?.pressing) return delta.pressing;
  if (delta?.bits?.length) return delta.sentence;
  if (seg.length) return `這段沒有進球，有 ${seg.length} 筆牌或換人。`;
  if (delta) return "這段沒有進球，射門、角球、控球率沒有變化。";
  return "這段事件紀錄沒有進球、紅黃牌或換人。";
}

function spokenCheckpoint(cp) {
  const open = pick(cp.id + cp.title, [
    `${cp.title}。${cp.scorePhrase}。`,
    `時間走到${cp.title}，${cp.scorePhrase}。`,
    `先看${cp.title}這個節點，${cp.scorePhrase}。`
  ]);
  const lines = [open];
  if (cp.eventFacts.length) lines.push(`這段記下來：${cp.eventFacts.slice(0, 2).join("；")}。`);
  else lines.push("這段沒有進球、紅黃牌或換人。");
  if (cp.delta?.pressing) lines.push(cp.delta.pressing);
  else if (cp.delta?.sentence) lines.push(cp.delta.sentence);
  return lines.slice(0, 3);
}

function makeTimeCheckpoint(kind, model, delta) {
  const seg = eventsInKind(model.events, kind.id);
  const scorePhrase = kind.id === "ft"
    ? `計分板 ${model.home.name} ${model.home.score} 比 ${model.away.name} ${model.away.score}`
    : scoreFromEvents(model, kind.id);
  const cp = {
    id: kind.id,
    title: kind.title,
    sort: kind.sort,
    createdAt: Date.now(),
    baselineLabel: model.minute.label,
    statsSnapshot: slimStats(model.stats),
    scorePhrase,
    eventFacts: seg.map((ev) => `${ev.minuteLabel} ${ev.fact}`),
    delta,
    verdict: verdictOf(seg, delta, scorePhrase)
  };
  cp.spoken = spokenCheckpoint(cp);
  return cp;
}

function makeGoalCheckpoint(ev, model, delta) {
  const scorePhrase = ev.score ? `事件紀錄寫到 ${ev.score}` : "事件文字沒有寫上比分";
  const seg = [ev];
  const cp = {
    id: "goal:" + ev.id,
    title: `${ev.minuteLabel || "進球"} 進球`,
    sort: eventSort(ev) + 0.5,
    createdAt: Date.now(),
    baselineLabel: model.minute.label,
    statsSnapshot: slimStats(model.stats),
    scorePhrase,
    eventFacts: [`${ev.minuteLabel} ${ev.fact}`],
    delta,
    verdict: verdictOf(seg, delta, scorePhrase)
  };
  cp.spoken = spokenCheckpoint(cp);
  return cp;
}

function pickWindow(snaps, now) {
  let best = null;
  for (const snap of snaps) {
    const age = now - snap.t;
    if (age < 10 * 60 * 1000 || age > 25 * 60 * 1000) continue;
    if (!best || Math.abs(age - 15 * 60 * 1000) < Math.abs(now - best.t - 15 * 60 * 1000)) best = snap;
  }
  return best;
}

function analysisSpoken(read, model) {
  if (model.minute.phase === "pre") return ["比賽還沒開始，我先不講走勢，等有射門和控球再更新。"];
  const lines = [];
  const goal = (read.newEvents || []).find((ev) => ev.kind === "goal");
  if (goal) {
    lines.push(`${goal.minuteLabel} 有進球，${goal.scorer || goal.teamName}。${goal.score ? "比分 " + goal.score + "。" : ""}`.trim());
  }
  if (read.since?.pressing) lines.push(read.since.pressing);
  else if (read.quarter?.pressing) lines.push(read.quarter.pressing);
  else if (read.since?.sentence) lines.push(read.since.sentence);
  if (lines.length < 3 && read.discipline?.risk) lines.push(read.discipline.risk);
  else if (lines.length < 3 && read.gaps?.[0]) lines.push(`全場累積，${read.gaps[0]}`);
  if (!lines.length) lines.push("這是第一次抓到這場數據，還沒有上一次可以比較。先看畫面上的累積數字。");
  return lines.slice(0, 3);
}

function memoryKey(id) {
  return "fb-board-v1:" + id;
}

function loadMemory(id) {
  try {
    const raw = localStorage.getItem(memoryKey(id));
    if (!raw) return { snapshots: [], checkpoints: [], liveRead: null };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.snapshots) || !Array.isArray(data.checkpoints)) {
      return { snapshots: [], checkpoints: [], liveRead: null };
    }
    return data;
  } catch {
    return { snapshots: [], checkpoints: [], liveRead: null };
  }
}

function saveMemory(id, mem) {
  try {
    localStorage.setItem(memoryKey(id), JSON.stringify(mem));
  } catch {
    /* ignore quota */
  }
}

function baselineFrom(mem, prev) {
  const cps = mem.checkpoints.filter((cp) => cp.statsSnapshot && Date.now() - cp.createdAt > 800);
  const cp = cps[cps.length - 1];
  if (cp) return { stats: cp.statsSnapshot, label: cp.baselineLabel || cp.title };
  if (prev && Date.now() - prev.t > 800) return { stats: prev.stats, label: prev.minute?.label || "上次" };
  return null;
}

function updateMemory(model) {
  const mem = loadMemory(model.id);
  const prev = mem.snapshots[mem.snapshots.length - 1] || null;
  const prevIds = new Set(prev?.eventIds || []);
  const created = [];
  for (const kind of TIME_KINDS) {
    if (mem.checkpoints.some((cp) => cp.id === kind.id)) continue;
    if (!reached(kind.id, model.minute)) continue;
    created.push({ kind, goal: null, crossed: !!(prev && !reached(kind.id, prev.minute)) });
  }
  for (const ev of model.events) {
    if (ev.kind !== "goal") continue;
    if (mem.checkpoints.some((cp) => cp.id === "goal:" + ev.id)) continue;
    created.push({ kind: null, goal: ev, crossed: !!(prev && !prevIds.has(ev.id)) });
  }
  created.sort((a, b) => {
    const as = a.goal ? eventSort(a.goal) + 0.5 : a.kind.sort;
    const bs = b.goal ? eventSort(b.goal) + 0.5 : b.kind.sort;
    return as - bs;
  });
  let used = false;
  const base = baselineFrom(mem, prev);
  for (const item of created) {
    let delta = null;
    if (item.crossed && !used && base && model.stats.mode === "match") {
      delta = makeDelta(base.stats, slimStats(model.stats), base.label, model.minute.label, model.home.name, model.away.name);
      used = true;
    }
    mem.checkpoints.push(item.goal ? makeGoalCheckpoint(item.goal, model, delta) : makeTimeCheckpoint(item.kind, model, delta));
  }
  const now = Date.now();
  const sinceBase = prev && now - prev.t > 800 ? { stats: prev.stats, label: prev.minute?.label || "上次", t: prev.t } : null;
  let quarter = pickWindow(mem.snapshots, now);
  if (quarter && sinceBase && quarter.t === sinceBase.t) quarter = null;
  const currentSlim = slimStats(model.stats);
  const since = sinceBase && model.stats.mode === "match"
    ? makeDelta(sinceBase.stats, currentSlim, sinceBase.label, model.minute.label, model.home.name, model.away.name)
    : null;
  const quarterDelta = quarter && model.stats.mode === "match"
    ? makeDelta(quarter.stats, currentSlim, quarter.minute?.label || "較早", model.minute.label, model.home.name, model.away.name)
    : null;
  if (quarterDelta) quarterDelta.mins = Math.max(1, Math.round((now - quarter.t) / 60000));
  const newEvents = prev ? model.events.filter((ev) => !prevIds.has(ev.id) && ["goal", "yellow", "red", "sub"].includes(ev.kind)) : [];
  mem.liveRead = {
    at: now,
    minute: model.minute.label,
    since,
    quarter: quarterDelta,
    newEvents,
    gaps: gapLines(model),
    discipline: disciplineInfo(model)
  };
  mem.liveRead.spoken = analysisSpoken(mem.liveRead, model);
  mem.snapshots.push({
    t: now,
    minute: model.minute,
    stats: currentSlim,
    eventIds: model.events.map((ev) => ev.id)
  });
  if (mem.snapshots.length > 80) mem.snapshots = mem.snapshots.slice(-80);
  if (mem.checkpoints.length > 80) mem.checkpoints = mem.checkpoints.slice(-80);
  const sig = oddsSig(model.odds);
  if (!mem.oddsStamp || mem.oddsStamp.sig !== sig) mem.oddsStamp = { sig, at: Date.now() };
  saveMemory(model.id, mem);
  return mem;
}

function formSentence(block) {
  const results = (block.games || []).map((g) => g.result).filter((r) => r === "W" || r === "D" || r === "L");
  if (!results.length) return "";
  const w = results.filter((r) => r === "W").length;
  const d = results.filter((r) => r === "D").length;
  const l = results.filter((r) => r === "L").length;
  return `${block.name}近 ${results.length} 場 ${w} 勝 ${d} 和 ${l} 負。`;
}

function tableSentence(name, row) {
  if (!row || row.rank == null || row.rank === "") return "";
  const parts = [`${name}積分榜第 ${row.rank}`];
  if (row.wins != null && row.ties != null && row.losses != null) parts.push(`${row.wins} 勝 ${row.ties} 和 ${row.losses} 負`);
  if (row.points != null && row.points !== "") parts.push(`積分 ${row.points}`);
  if (row.pointDifferential != null && row.pointDifferential !== "") parts.push(`得失球 ${row.pointDifferential}`);
  return parts.join("，") + "。";
}

function cheatLines(model) {
  const lines = [];
  if (model.minute.phase === "pre" && model.kickoff) lines.push(`開球時間台北 ${taipeiHM(model.kickoff)}。`);
  if (model.venue) lines.push(`場地：${model.venue}${model.city ? "（" + model.city + "）" : ""}。`);
  for (const block of model.form) {
    const line = formSentence(block);
    if (line) lines.push(line);
  }
  for (const side of [model.home, model.away]) {
    const line = tableSentence(side.name, model.table[side.id]);
    if (line) lines.push(line);
  }
  for (const scorer of model.scorers) {
    if (!scorer.player) continue;
    lines.push(`${scorer.teamName}的進球數據：${scorer.player}，${scorer.matches ? scorer.matches + " 場 " : ""}${scorer.goals} 球。`);
  }
  const decided = model.h2h.hw + model.h2h.aw + model.h2h.dr;
  if (decided) {
    lines.push(`資料裡的交手 ${decided} 場，${model.home.name} ${model.h2h.hw} 勝、和局 ${model.h2h.dr}、${model.away.name} ${model.h2h.aw} 勝。`);
  }
  if (model.h2h.games.length) {
    const last = model.h2h.games[0];
    const homeSide = last.teams.find((t) => t.homeAway === "home") || last.teams[0];
    const awaySide = last.teams.find((t) => t !== homeSide);
    if (homeSide && awaySide) lines.push(`最近一次 ${shortDate(last.date)}，${homeSide.name} ${homeSide.score} 比 ${awaySide.name} ${awaySide.score}。`);
  }
  const reds = model.events.filter((ev) => ev.kind === "red");
  if (reds.length) lines.push(`紅牌：${reds.map((ev) => `${ev.minuteLabel} ${ev.playerNames[0] || "未列名"}（${ev.teamName}）`).join("、")}。`);
  lines.push(...gapLines(model));
  return lines;
}

function cheatSpoken(lines) {
  if (!lines.length) return ["目前沒有足夠的背景資料可以念。"];
  const lead = pick(lines[0], [
    ["我先把背景資料念一下。"],
    ["聊天室先聽這幾條，都是目前抓到的數字。"],
    ["開講前先對一下資料。"]
  ])[0];
  return [lead, ...lines.slice(0, 2)].slice(0, 3);
}

function outlookLines(player) {
  const shots = numOrNull(player.stats.totalShots);
  const goalsStat = numOrNull(player.stats.totalGoals);
  const goals = goalsStat != null ? goalsStat : player.goalMins.length;
  const assistsStat = numOrNull(player.stats.goalAssists);
  const assists = assistsStat != null ? assistsStat : player.assistMins.length;
  const onTarget = numOrNull(player.stats.shotsOnTarget);
  const saves = numOrNull(player.stats.saves);
  const yellowStat = numOrNull(player.stats.yellowCards);
  const yellow = yellowStat != null ? yellowStat : player.yellowMins.length;
  const redStat = numOrNull(player.stats.redCards);
  const red = redStat != null ? redStat : player.redMins.length;
  const fouls = numOrNull(player.stats.foulsCommitted);
  const lines = [];
  if (red > 0) lines.push(`已有紅牌紀錄${player.redMins.length ? "（" + player.redMins.join("、") + "）" : ""}。`);
  if (yellow > 0 && red === 0) lines.push(`已有 ${trimNum(yellow)} 張黃牌${player.yellowMins.length ? "（" + player.yellowMins.join("、") + "）" : ""}。`);
  if (goals > 0) lines.push(`本場進球 ${trimNum(goals)}${player.goalMins.length ? "，時間 " + player.goalMins.join("、") : ""}。`);
  if (assists > 0) lines.push(`本場助攻 ${trimNum(assists)}${player.assistMins.length ? "，時間 " + player.assistMins.join("、") : ""}。`);
  if (shots != null && shots >= 3 && goals === 0) lines.push(tendency(`射門 ${trimNum(shots)} 次還沒進球，持續製造威脅，是下一個進球的人選`));
  else if (onTarget != null && onTarget >= 2 && goals === 0) lines.push(tendency(`射正 ${trimNum(onTarget)} 次還沒進球，威脅還在`));
  if (saves != null && saves >= 1) lines.push(`本場撲救 ${trimNum(saves)} 次。`);
  if (fouls != null && fouls >= 2 && yellow > 0) lines.push(tendency(`已有黃牌，本場犯規 ${trimNum(fouls)} 次，後續動作要收著`));
  if (player.subOn) lines.push(`第 ${player.subOn} 換上。`);
  if (player.subOff) lines.push(`第 ${player.subOff} 被換下。`);
  if (!lines.length) lines.push("目前這份數據沒有特別要強調的數字。");
  return lines.slice(0, 4);
}

function playerSpoken(player, teamName, lines) {
  const open = `${player.name}，${player.jersey ? player.jersey + " 號，" : ""}${player.posZh || "位置未列"}，${teamName}。`;
  const rest = lines.filter((line) => !line.includes("沒有特別")).slice(0, 2);
  return [open, ...rest].slice(0, 3);
}

function parseOverview(data, leagueSlug) {
  const stats = data?.statistics;
  if (!stats || !Array.isArray(stats.names) || !Array.isArray(stats.splits)) return [];
  const hint = {
    "eng.1": "英超", "esp.1": "西甲", "ita.1": "義甲", "ger.1": "德甲", "fra.1": "法甲",
    "uefa.champions": "歐冠", "uefa.europa": "歐霞", "usa.1": "美職聯", "jpn.1": "J1", "fifa.world": "世界盃"
  }[leagueSlug] || "";
  const splits = stats.splits.map((split) => ({
    title: compZh(split.displayName || "賽季數據"),
    rows: stats.names.map((name, index) => ({
      key: name,
      label: SEASON_STAT_ZH[name] || "",
      value: split.stats?.[index] ?? ""
    })).filter((row) => row.label && row.value !== "" && row.value != null)
  })).filter((split) => split.rows.length);
  splits.sort((a, b) => {
    const as = hint && a.title.includes(hint) ? 1 : 0;
    const bs = hint && b.title.includes(hint) ? 1 : 0;
    return bs - as;
  });
  const signal = (split) => split.rows.some((row) => ["totalGoals", "goalAssists", "totalShots", "saves", "starts"].includes(row.key) && row.value !== "0");
  const interesting = splits.filter(signal);
  if (!splits.length) return [];
  if (!interesting.length) return [splits[0]];
  const first = splits[0];
  return [first, ...interesting.filter((split) => split !== first)].slice(0, 4);
}

const seasonCache = new Map();

function loadSeason(league, id) {
  const key = league + ":" + id;
  if (!seasonCache.has(key)) {
    const job = fetchJson(`${ATHLETE}/${league}/athletes/${id}/overview`)
      .then((data) => parseOverview(data, league))
      .catch((err) => {
        seasonCache.delete(key);
        throw err;
      });
    seasonCache.set(key, job);
  }
  return seasonCache.get(key);
}

function parseAmerican(value) {
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) return value;
  const text = String(value ?? "").trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function parseLine(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const m = String(value ?? "").trim().match(/^[ou]?\s*([+-]?\d+(?:\.\d+)?)$/i);
  return m ? Number(m[1]) : null;
}

function priceFromAmerican(american, line) {
  const n = parseAmerican(american);
  if (n == null) return null;
  const decimal = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
  const implied = n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
  return {
    american: n,
    decimal: Math.round(decimal * 100) / 100,
    implied,
    line: line == null ? null : line
  };
}

function readQuote(node) {
  if (node == null) return null;
  if (typeof node === "number" || typeof node === "string") return priceFromAmerican(node, null);
  const line = parseLine(node.line);
  return priceFromAmerican(node.odds ?? node.moneyLine, line);
}

function withLine(quote, line) {
  if (!quote || quote.line != null || line == null) return quote;
  return { ...quote, line };
}

function sideQuote(block, fallbackAmerican, fallbackLine) {
  const open = block ? readQuote(block.open) : null;
  const close = block ? readQuote(block.close) : null;
  const live = block ? readQuote(block.live || block.current) : null;
  let pre = close || open;
  if (!pre && fallbackAmerican != null) pre = priceFromAmerican(fallbackAmerican, fallbackLine);
  pre = withLine(pre, fallbackLine);
  return { open, close, pre, live: withLine(live, live?.line != null ? live.line : fallbackLine) };
}

function spreadFallback(raw) {
  const n = Number(raw?.spread);
  if (!Number.isFinite(n)) return { home: null, away: null };
  const mag = Math.abs(n);
  if (raw.homeTeamOdds?.favorite === true) return { home: -mag, away: mag };
  if (raw.awayTeamOdds?.favorite === true) return { home: mag, away: -mag };
  return { home: null, away: null };
}

function parseBook(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lines = spreadFallback(raw);
  const book = {
    moneyline: {
      home: sideQuote(raw.moneyline?.home, raw.homeTeamOdds?.moneyLine, null),
      away: sideQuote(raw.moneyline?.away, raw.awayTeamOdds?.moneyLine, null),
      draw: sideQuote(raw.moneyline?.draw, raw.drawOdds?.moneyLine, null)
    },
    spread: {
      home: sideQuote(raw.pointSpread?.home, raw.homeTeamOdds?.spreadOdds, lines.home),
      away: sideQuote(raw.pointSpread?.away, raw.awayTeamOdds?.spreadOdds, lines.away)
    },
    total: {
      over: sideQuote(raw.total?.over, raw.overOdds, raw.overUnder),
      under: sideQuote(raw.total?.under, raw.underOdds, raw.overUnder)
    }
  };
  const quotes = [
    book.moneyline.home, book.moneyline.away, book.moneyline.draw,
    book.spread.home, book.spread.away, book.total.over, book.total.under
  ];
  const any = quotes.some((item) => item.pre || item.live);
  return any ? book : null;
}

function oddsSig(book) {
  if (!book) return "";
  const bit = (quote) => (quote ? `${quote.line}:${quote.american}` : "-");
  const side = (group, name) => `${bit(group[name]?.pre)}/${bit(group[name]?.live)}`;
  return [
    side(book.moneyline, "home"), side(book.moneyline, "away"), side(book.moneyline, "draw"),
    side(book.spread, "home"), side(book.spread, "away"),
    side(book.total, "over"), side(book.total, "under")
  ].join("|");
}

function fmtDecimal(n) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

function fmtAmerican(n) {
  if (n == null) return "";
  const rounded = Math.round(Number(n));
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function fmtPct(p) {
  return `${trimNum(p * 100)}%`;
}

function quoteText(quote) {
  if (!quote) return "";
  return `歐賠 ${fmtDecimal(quote.decimal)}（隱含 ${fmtPct(quote.implied)}，美式 ${fmtAmerican(quote.american)}）`;
}

function fmtHandicap(n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  if (n > 0) return `+${trimNum(n)}`;
  if (n < 0) return `-${trimNum(Math.abs(n))}`;
  return "0";
}

function handicapWords(who, line) {
  if (line == null) return who;
  if (line > 0) return `${who}受讓 ${trimNum(line)}`;
  if (line < 0) return `${who}讓 ${trimNum(Math.abs(line))}`;
  return `${who}平手`;
}

function activeQuote(group, liveMatch) {
  if (liveMatch && group?.live) return group.live;
  return group?.pre || group?.live || null;
}

function formRecord(model, id) {
  const block = (model.form || []).find((item) => item.id === id);
  if (!block) return null;
  const results = block.games.map((game) => game.result).filter((result) => result === "W" || result === "D" || result === "L");
  if (!results.length) return null;
  return {
    name: block.name,
    n: results.length,
    w: results.filter((result) => result === "W").length,
    d: results.filter((result) => result === "D").length,
    l: results.filter((result) => result === "L").length
  };
}

function recentTotals(model, id) {
  const block = (model.form || []).find((item) => item.id === id);
  if (!block) return null;
  let games = 0;
  let goals = 0;
  for (const game of block.games) {
    const m = String(game.score || "").match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!m) continue;
    games += 1;
    goals += Number(m[1]) + Number(m[2]);
  }
  if (!games) return null;
  return { name: block.name, games, goals, avg: Math.round((goals / games) * 10) / 10 };
}

function tableNums(row) {
  if (!row) return null;
  const num = (key) => {
    if (row[key] == null || row[key] === "") return null;
    const n = Number(String(row[key]).replace("+", ""));
    return Number.isFinite(n) ? n : null;
  };
  const rank = num("rank");
  if (rank == null) return null;
  return { rank, points: num("points"), gd: num("pointDifferential") };
}

function scorePair(model) {
  const home = Number(model.home.score);
  const away = Number(model.away.score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away, total: home + away };
}

function cardTally(model) {
  const tally = { home: { y: 0, r: 0 }, away: { y: 0, r: 0 } };
  for (const ev of model.events || []) {
    const side = ev.teamId === model.home.id ? "home" : ev.teamId === model.away.id ? "away" : "";
    if (!side) continue;
    if (ev.kind === "yellow") tally[side].y += 1;
    if (ev.kind === "red") tally[side].r += 1;
  }
  return tally;
}

function collectSignals(model) {
  const signals = [];
  const homeForm = formRecord(model, model.home.id);
  const awayForm = formRecord(model, model.away.id);
  if (homeForm && awayForm && Math.abs(homeForm.w - awayForm.w) >= 2) {
    const homeBetter = homeForm.w > awayForm.w;
    signals.push({
      key: homeBetter ? "home" : "away",
      text: `${homeBetter ? homeForm.name : awayForm.name}近 ${homeBetter ? homeForm.n : awayForm.n} 場 ${homeBetter ? homeForm.w : awayForm.w} 勝，${homeBetter ? awayForm.name : homeForm.name} ${homeBetter ? awayForm.w : homeForm.w} 勝。`
    });
  }
  const decided = (model.h2h?.hw || 0) + (model.h2h?.aw || 0) + (model.h2h?.dr || 0);
  if (decided >= 3 && Math.abs(model.h2h.hw - model.h2h.aw) >= 2) {
    const homeBetter = model.h2h.hw > model.h2h.aw;
    signals.push({
      key: homeBetter ? "home" : "away",
      text: `交手 ${decided} 場，${model.home.name} ${model.h2h.hw} 勝、和局 ${model.h2h.dr}、${model.away.name} ${model.h2h.aw} 勝。`
    });
  }
  const homeTable = tableNums(model.table?.[model.home.id]);
  const awayTable = tableNums(model.table?.[model.away.id]);
  if (homeTable && awayTable && Math.abs(homeTable.rank - awayTable.rank) >= 3) {
    const homeBetter = homeTable.rank < awayTable.rank;
    signals.push({
      key: homeBetter ? "home" : "away",
      text: `積分榜 ${homeBetter ? model.home.name : model.away.name} 第 ${homeBetter ? homeTable.rank : awayTable.rank}，${homeBetter ? model.away.name : model.home.name} 第 ${homeBetter ? awayTable.rank : homeTable.rank}。`
    });
  }
  const playing = model.minute.phase !== "pre" && model.minute.phase !== "ft";
  const score = scorePair(model);
  if (playing && score && score.home !== score.away) {
    signals.push({
      key: score.home > score.away ? "home" : "away",
      text: `目前比分 ${model.home.name} ${score.home} 比 ${model.away.name} ${score.away}（${model.minute.label}）。`
    });
  } else if (playing && score && score.home === score.away) {
    signals.push({ key: "draw", text: `目前 ${score.home} 比 ${score.away}，兩邊都沒領先（${model.minute.label}）。` });
  }
  if (playing && model.stats.mode === "match") {
    const sotH = model.stats.home.shotsOnTarget;
    const sotA = model.stats.away.shotsOnTarget;
    if (typeof sotH === "number" && typeof sotA === "number" && Math.abs(sotH - sotA) >= 3) {
      signals.push({
        key: sotH > sotA ? "home" : "away",
        text: `射正 ${model.home.name} ${trimNum(sotH)}、${model.away.name} ${trimNum(sotA)}。`
      });
    }
  }
  const cards = cardTally(model);
  if (cards.home.r !== cards.away.r) {
    const homeMore = cards.home.r > cards.away.r;
    signals.push({
      key: homeMore ? "away" : "home",
      text: `${homeMore ? model.home.name : model.away.name} ${homeMore ? cards.home.r : cards.away.r} 張紅牌，${homeMore ? model.away.name : model.home.name} ${homeMore ? cards.away.r : cards.home.r} 張。`
    });
  } else if (Math.abs(cards.home.y - cards.away.y) >= 2) {
    const homeMore = cards.home.y > cards.away.y;
    signals.push({
      key: homeMore ? "away" : "home",
      text: `黃牌 ${model.home.name} ${cards.home.y}、${model.away.name} ${cards.away.y}。`
    });
  }
  return signals;
}

function confidenceFor(gap, agree, disagree) {
  if (gap >= 15 && agree >= 2 && disagree === 0) return "高";
  if ((gap >= 8 && agree >= 1 && disagree === 0) || (gap >= 12 && agree >= 2)) return "中";
  return "低";
}

function leanFromSignals(topKey, gap, signals, labels) {
  const agree = signals.filter((signal) => signal.key === topKey);
  const disagree = signals.filter((signal) => signal.key !== topKey);
  if (gap < 6 && agree.length === 0) {
    return { key: null, label: "傾向不明顯", confidence: "低", cite: signals.slice(0, 2) };
  }
  if (disagree.length >= 2 && agree.length === 0) {
    const counts = {};
    for (const signal of signals) counts[signal.key] = (counts[signal.key] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2 && labels[best[0]]) {
      return { key: best[0], label: labels[best[0]], confidence: "低", cite: signals.filter((signal) => signal.key === best[0]).slice(0, 2) };
    }
    return { key: null, label: "傾向不明顯", confidence: "低", cite: signals.slice(0, 2) };
  }
  return {
    key: topKey,
    label: labels[topKey],
    confidence: confidenceFor(gap, agree.length, disagree.length),
    cite: (agree.length ? agree : signals).slice(0, 2)
  };
}

function spokenLines(seed, first, second) {
  const alt = second ? [`數據上比較支持這個讀法：${second}`, first] : [first];
  return pick(seed, [[first, second].filter(Boolean), alt]).slice(0, 2);
}

function oddsRows(label, group, liveMatch) {
  const pre = group?.pre;
  const live = liveMatch && group?.live ? group.live : null;
  const bits = [];
  if (pre) bits.push(`開賽 ${quoteText(pre)}`);
  if (live && (!pre || live.american !== pre.american || live.line !== pre.line)) bits.push(`目前 ${quoteText(live)}`);
  else if (live && pre) bits.push("目前與開賽盤相同");
  if (pre?.line != null && live?.line != null && pre.line !== live.line) {
    bits.push(`盤口從 ${trimNum(Math.abs(pre.line))} 改為 ${trimNum(Math.abs(live.line))}`);
  }
  if (!bits.length && group?.live) bits.push(quoteText(group.live));
  return { label, line: bits.join("；"), pre, live, use: live || pre };
}

function moneylineMarket(model, book) {
  const liveMatch = model.minute.phase !== "pre";
  const home = oddsRows("主勝", book.moneyline.home, liveMatch);
  const draw = oddsRows("和局", book.moneyline.draw, liveMatch);
  const away = oddsRows("客勝", book.moneyline.away, liveMatch);
  const options = [home, draw, away].filter((row) => row.use);
  if (options.length < 2) return null;
  const ranked = [...options].sort((a, b) => b.use.implied - a.use.implied);
  const gap = (ranked[0].use.implied - ranked[1].use.implied) * 100;
  const labels = { home: "偏向主勝", away: "偏向客勝", draw: "偏向和局" };
  const keyOf = { 主勝: "home", 和局: "draw", 客勝: "away" };
  const topKey = keyOf[ranked[0].label];
  const decision = model.minute.phase === "ft"
    ? { key: null, label: "完賽對照", confidence: "低", cite: [] }
    : leanFromSignals(topKey, gap, collectSignals(model), labels);
  const sum = options.reduce((total, row) => total + row.use.implied, 0);
  const reasons = [
    `目前用來判斷的價格：${options.map((row) => `${row.label} ${quoteText(row.use)}`).join("，")}。三邊原始隱含合計 ${fmtPct(sum)}。`
  ];
  for (const signal of decision.cite) reasons.push(signal.text);
  if (model.minute.phase === "ft") {
    const score = scorePair(model);
    if (score) reasons.push(`全場比分 ${model.home.name} ${score.home} 比 ${model.away.name} ${score.away}，這裡只做對照。`);
  }
  const picked = options.find((row) => keyOf[row.label] === decision.key);
  const spoken = decision.key && picked
    ? spokenLines(`${model.id}-ml-${decision.key}`, `從盤口看，${picked.label}歐賠 ${fmtDecimal(picked.use.decimal)}，原始隱含大約 ${fmtPct(picked.use.implied)}。`, decision.cite[0] ? decision.cite[0].text : "其他數據沒有再往同一邊加碼。")
    : ["從盤口看，獨贏三邊沒有差很多。", "數據上也沒有明顯站邊，傾向先放不明顯。"];
  return { title: "不讓分（獨贏）", rows: [home, draw, away].filter((row) => row.line), lean: decision.label, confidence: decision.confidence, reasons: reasons.slice(0, 3), spoken };
}

function spreadMarket(model, book) {
  const liveMatch = model.minute.phase !== "pre";
  const home = oddsRows(handicapWords("主隊", (liveMatch && book.spread.home.live?.line != null ? book.spread.home.live.line : book.spread.home.pre?.line)), book.spread.home, liveMatch);
  const away = oddsRows(handicapWords("客隊", (liveMatch && book.spread.away.live?.line != null ? book.spread.away.live.line : book.spread.away.pre?.line)), book.spread.away, liveMatch);
  if (!home.use || !away.use) return null;
  const ranked = [home, away].sort((a, b) => b.use.implied - a.use.implied);
  const gap = (ranked[0].use.implied - ranked[1].use.implied) * 100;
  const homeLine = home.use.line;
  const awayLine = away.use.line;
  const labels = { home: `偏向${home.label}`, away: `偏向${away.label}` };
  const score = scorePair(model);
  const signals = collectSignals(model).filter((signal) => signal.key !== "draw");
  const playing = model.minute.phase !== "pre" && model.minute.phase !== "ft";
  if (playing && score && awayLine != null && awayLine < 0) {
    const covering = score.away > score.home;
    signals.unshift({
      key: covering ? "away" : "home",
      text: `${away.label}，要全場贏球才過盤。目前 ${model.home.name} ${score.home} 比 ${model.away.name} ${score.away}。`
    });
  } else if (playing && score && homeLine != null && homeLine < 0) {
    const covering = score.home > score.away;
    signals.unshift({
      key: covering ? "home" : "away",
      text: `${home.label}，要全場贏球才過盤。目前 ${model.home.name} ${score.home} 比 ${model.away.name} ${score.away}。`
    });
  }
  const topKey = ranked[0] === home ? "home" : "away";
  const decision = model.minute.phase === "ft"
    ? { key: null, label: "完賽對照", confidence: "低", cite: [] }
    : leanFromSignals(topKey, gap, signals, labels);
  const reasons = [`讓分價格：${home.label} ${quoteText(home.use)}；${away.label} ${quoteText(away.use)}。`];
  for (const signal of decision.cite) reasons.push(signal.text);
  const picked = decision.key === "home" ? home : decision.key === "away" ? away : null;
  const spoken = picked
    ? spokenLines(`${model.id}-sp-${decision.key}`, `從盤口看，${picked.label}的歐賠是 ${fmtDecimal(picked.use.decimal)}，原始隱含 ${fmtPct(picked.use.implied)}。`, decision.cite[0] ? decision.cite[0].text : "")
    : ["從盤口看，讓分兩邊沒有差很多。", "數據沒有明顯幫某一邊，傾向先放不明顯。"];
  return { title: "讓分", rows: [home, away], lean: decision.label, confidence: decision.confidence, reasons: reasons.slice(0, 3), spoken };
}

function totalMarket(model, book) {
  const liveMatch = model.minute.phase !== "pre";
  const over = oddsRows("大分", book.total.over, liveMatch);
  const under = oddsRows("小分", book.total.under, liveMatch);
  if (!over.use || !under.use) return null;
  const line = (liveMatch && over.live?.line != null ? over.live.line : over.use.line);
  const ranked = [over, under].sort((a, b) => b.use.implied - a.use.implied);
  const gap = (ranked[0].use.implied - ranked[1].use.implied) * 100;
  const labels = { over: "偏向大分", under: "偏向小分" };
  const signals = [];
  const notes = [];
  const score = scorePair(model);
  const playing = model.minute.phase !== "pre";
  if (playing && score && line != null) {
    if (score.total > line) signals.push({ key: "over", text: `目前進球 ${score.total}，已經超過 ${trimNum(line)}。` });
    else notes.push(`目前進球 ${score.total}，大小分 ${trimNum(line)}，大分還要再進至少 ${Math.max(Math.floor(line) + 1 - score.total, 0)} 球。`);
  }
  if (playing && model.stats.mode === "match") {
    const shots = [model.stats.home.totalShots, model.stats.away.totalShots];
    const sot = [model.stats.home.shotsOnTarget, model.stats.away.shotsOnTarget];
    if (shots.every((n) => typeof n === "number") && sot.every((n) => typeof n === "number")) {
      const shotSum = shots[0] + shots[1];
      const sotSum = sot[0] + sot[1];
      const late = model.minute.base >= 75;
      if (late && shotSum <= 10 && score) signals.push({ key: "under", text: `${model.minute.label} 射門合計 ${trimNum(shotSum)}、射正合計 ${trimNum(sotSum)}，進球 ${score.total}。` });
      else if (sotSum >= 8 && score && score.total <= 1) signals.push({ key: "over", text: `射正合計 ${trimNum(sotSum)}，射門合計 ${trimNum(shotSum)}，目前進球 ${score.total}。` });
    }
  }
  const homeTotals = recentTotals(model, model.home.id);
  const awayTotals = recentTotals(model, model.away.id);
  if (homeTotals && awayTotals && line != null) {
    const bothHigh = homeTotals.avg >= line + 0.4 && awayTotals.avg >= line + 0.4;
    const bothLow = homeTotals.avg <= line - 0.4 && awayTotals.avg <= line - 0.4;
    if (bothHigh || bothLow) {
      signals.push({
        key: bothHigh ? "over" : "under",
        text: `${homeTotals.name}近 ${homeTotals.games} 場比賽總進球平均 ${trimNum(homeTotals.avg)}，${awayTotals.name}近 ${awayTotals.games} 場平均 ${trimNum(awayTotals.avg)}。`
      });
    }
  }
  const topKey = ranked[0] === over ? "over" : "under";
  let decision = model.minute.phase === "ft"
    ? { key: null, label: "完賽對照", confidence: "低", cite: signals.slice(0, 1) }
    : leanFromSignals(topKey, gap, signals, labels);
  if (playing && score && line != null && score.total > line) {
    decision = { key: "over", label: "偏向大分", confidence: "高", cite: signals.filter((signal) => signal.key === "over").slice(0, 2) };
  }
  const titleLine = line == null ? "" : ` ${trimNum(line)}`;
  const reasons = [`大小分價格：大分 ${quoteText(over.use)}；小分 ${quoteText(under.use)}。`];
  for (const note of notes) reasons.push(note);
  for (const signal of decision.cite) {
    if (!reasons.includes(signal.text)) reasons.push(signal.text);
  }
  const picked = decision.key === "over" ? over : decision.key === "under" ? under : null;
  const spoken = picked
    ? spokenLines(`${model.id}-ou-${decision.key}`, `從盤口看，${picked.label}${titleLine} 的歐賠是 ${fmtDecimal(picked.use.decimal)}，原始隱含 ${fmtPct(picked.use.implied)}。`, decision.cite[0] ? decision.cite[0].text : "")
    : [`從盤口看，大分和小分沒有差很多。`, "數據沒有明顯偏向大小，傾向先放不明顯。"];
  return { title: `大小分（大/小${titleLine}）`, rows: [over, under], lean: decision.label, confidence: decision.confidence, reasons: reasons.slice(0, 3), spoken };
}

function oddsReport(model) {
  const book = model?.odds;
  if (!book) return null;
  const markets = [moneylineMarket(model, book), spreadMarket(model, book), totalMarket(model, book)].filter(Boolean);
  if (!markets.length) return null;
  const liveMatch = model.minute.phase !== "pre";
  const groups = [book.moneyline.home, book.moneyline.away, book.moneyline.draw, book.spread.home, book.spread.away, book.total.over, book.total.under];
  const hasLive = liveMatch && groups.some((group) => group.live && (!group.pre || group.live.american !== group.pre.american || group.live.line !== group.pre.line));
  return { markets, hasLive };
}

function scheduleOddsLine(match) {
  const book = match?.odds;
  if (!book) return "";
  const live = match.state === "in";
  const pick = (group) => (live && group?.live ? group.live : group?.pre || group?.live);
  const home = pick(book.moneyline.home);
  const draw = pick(book.moneyline.draw);
  const away = pick(book.moneyline.away);
  const over = pick(book.total.over);
  const parts = [];
  if (home && away) parts.push(`獨贏 ${fmtDecimal(home.decimal)}/${draw ? fmtDecimal(draw.decimal) : "–"}/${fmtDecimal(away.decimal)}`);
  if (over?.line != null) parts.push(`大小 ${trimNum(over.line)}`);
  return parts.join(" · ");
}

function grokText(model) {
  const lines = [];
  lines.push(`【賽況快照】${model.leagueName}`);
  lines.push(`用語：${locale() === "cn" ? "大陆用语" : "台灣用語"}`);
  const homeShape = model.roster?.home?.formation || "未公布";
  const awayShape = model.roster?.away?.formation || "未公布";
  lines.push(`陣型：${model.home.name} ${homeShape}；${model.away.name} ${awayShape}`);
  lines.push(`${model.home.name}（主） vs ${model.away.name}（客）`);
  lines.push(`比分 ${model.home.score}-${model.away.score}`);
  lines.push(`狀態 ${model.minute.label}（${phaseText(model.minute)}）`);
  if (model.kickoff) lines.push(`開球 ${taipeiHM(model.kickoff)} 台北`);
  if (model.venue) lines.push(`場地 ${model.venue}${model.city ? "（" + model.city + "）" : ""}`);
  lines.push("");
  lines.push(model.stats.mode === "season" ? "球隊數據（本季，主-客）" : "技術統計（主-客）");
  const table = model.stats.mode === "season" ? SEASON_TEAM_STATS : MATCH_STATS;
  for (const [key, label] of table) {
    const h = model.stats.home[key];
    const a = model.stats.away[key];
    if (h == null && a == null) continue;
    lines.push(`${label} ${fmtStat(key, h)} - ${fmtStat(key, a)}`);
  }
  lines.push("");
  lines.push("事件");
  const important = model.events.filter((ev) => ["goal", "red", "yellow", "sub"].includes(ev.kind));
  const goals = important.filter((ev) => ev.kind === "goal" || ev.kind === "red");
  const rest = important.filter((ev) => ev.kind !== "goal" && ev.kind !== "red").slice(-8);
  const shown = [...goals, ...rest.filter((ev) => !goals.includes(ev))];
  shown.sort((a, b) => eventSort(a) - eventSort(b));
  if (!shown.length) lines.push("（沒有進球、牌或換人）");
  for (const ev of shown) lines.push(`${ev.minuteLabel} ${ev.teamName} ${ev.fact}`);
  lines.push("");
  for (const side of [["home", model.home], ["away", model.away]]) {
    const block = model.roster[side[0]];
    lines.push(`陣容 ${side[1].name}${block.formation ? " " + block.formation : ""}`);
    const starters = block.players.filter((p) => p.starter);
    const list = starters.length ? starters : block.players.slice(0, 11);
    if (!list.length) lines.push("陣容尚未公布");
    for (const player of list) lines.push(`${player.jersey || "-"} ${player.name} ${player.posZh || player.posAbbr || ""}`.trim());
    lines.push("");
  }
  const report = oddsReport(model, state.memory?.oddsStamp?.at || null);
  lines.push("盤口（ESPN／DraftKings 美式盤換算，僅供分析，非投注建議）");
  if (!report) lines.push("本場暫無盤口資料");
  else {
    for (const market of report.markets) {
      lines.push(market.title);
      for (const row of market.rows) lines.push(`  ${row.line}`);
      lines.push(`  傾向：${market.lean}（信心${market.confidence}）`);
      for (const reason of market.reasons) lines.push(`  ${reason}`);
    }
  }
  lines.push("");
  lines.push(`更新 ${taipeiClock(new Date())} 台北`);
  lines.push("資料來源：ESPN");
  const text = lines.join("\n");
  return locale() === "cn" ? speak(text) : text;
}

function anyLive() {
  return state.matches.some((match) => match.state === "in") || state.model?.minute?.state === "in";
}

function readRoute() {
  const query = new URLSearchParams(location.search);
  let league = query.get("league");
  let event = query.get("event");
  if ((!league || !event) && location.hash.length > 1) {
    const hash = new URLSearchParams(location.hash.slice(1));
    league = league || hash.get("league");
    event = event || hash.get("event");
  }
  return { league, event, filter: query.get("filter") || "all", day: query.get("day") || "", tab: query.get("tab") || "" };
}
