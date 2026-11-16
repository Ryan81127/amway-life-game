/* 球員中文名，沿用足球看板的順序：辭典 → 維基（本機快取）→ 音譯。
   音譯一定標成未查證。日文漢字名先標「原名」，查到維基再換。查詢不擋住畫面。 */

const BB_CACHE = "bb-pname-v1:";
const BB_TTL = 21 * 86400000;
const BB_MISS_TTL = 12 * 3600000;
const bbMemo = new Map();
const bbFlight = new Set();
const bbQueue = [];
let bbRunning = 0;
let bbPaint = 0;

const BB_RAW = {
  "Jameel Warney": ["賈米爾·沃尼", "贾米尔·沃尼"],
  "Isaiah Hicks": ["以賽亞·希克斯", "以赛亚·希克斯"],
  "Arvin Tolentino": ["阿爾文·托倫蒂諾", "阿尔文·托伦蒂诺"],
  "Stanley Johnson": ["斯坦利·強森", "斯坦利·约翰逊"],
  "D.J. Hogg": ["迪傑·霍格", "迪杰·霍格"],
  "DJ Hogg": ["迪傑·霍格", "迪杰·霍格"],
  "Yuki Togashi": ["富樫勇樹", "富樫勇树"],
  "Makoto Hiejima": ["比江島慎", "比江岛慎"],
  "Yuma Fujii": ["藤井祐真", "藤井祐真"],
  "Leo Vendrame": ["里奧·文德拉姆", "里奥·文德拉姆"],
  "Oh Se Keun": ["吳世根", "吴世根"],
  "OH SEKEUN": ["吳世根", "吴世根"],
  "Heo Hoon": ["許訓", "许训"],
  "Koh Flippin": ["科·弗利平", "科·弗利平"],
  "Kerry Blackshear Jr": ["凱瑞·布萊克希爾", "凯瑞·布莱克希尔"],
  "A.J. Edu": ["A·J·埃杜", "A·J·埃杜"],
  "Trey Jones": ["特雷·瓊斯", "特雷·琼斯"],
  "Freddy Mbuyi": ["弗雷迪·穆布伊", "弗雷迪·穆布伊"],
  "MBUYI FREDDY MUTEBA": ["弗雷迪·穆布伊", "弗雷迪·穆布伊"]
};
const BB_DICT = {};
function bbKey(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ").trim();
}
for (const [en, pair] of Object.entries(BB_RAW)) BB_DICT[bbKey(en)] = { tw: pair[0], cn: pair[1] };

const BB_CONS = { sh: "什", ch: "奇", th: "瑟", kh: "赫", gh: "格", ph: "夫", sch: "施", qu: "奎", b: "布", c: "克", d: "德", f: "夫", g: "格", h: "赫", j: "吉", k: "克", l: "爾", m: "姆", n: "納", p: "普", r: "爾", s: "斯", t: "特", v: "夫", w: "瓦", z: "茲", x: "克斯" };
const BB_VOW = { ou: "烏", ai: "艾", ei: "埃", au: "奧", oi: "奧", oy: "奧", ay: "艾", ey: "伊", ia: "亞", ie: "耶", io: "約", a: "阿", e: "埃", i: "伊", o: "奧", u: "烏", y: "伊" };
const BB_HAN = { 烏: "乌", 奧: "奥", 茲: "兹", 爾: "尔", 亞: "亚", 約: "约", 韋: "韦", 馮: "冯", 達: "达", 聖: "圣", 馬: "马", 納: "纳", 麥: "麦", 魯: "鲁", 歐: "欧", 眞: "真" };

function bbHan(text) {
  const base = typeof han === "function" ? han(text) : text;
  return String(base).replace(/[\u3400-\u9fff]/g, (ch) => BB_HAN[ch] || ch);
}
function bbTw(text) {
  return String(text || "").replace(/眞/g, "真");
}

function bbCacheGet(key) {
  const hit = bbMemo.get(key);
  if (hit) return hit;
  try {
    const raw = JSON.parse(localStorage.getItem(BB_CACHE + key) || "null");
    if (!raw || Date.now() - raw.t > (raw.miss ? BB_MISS_TTL : BB_TTL)) return null;
    bbMemo.set(key, raw);
    return raw;
  } catch { return null; }
}
function bbCacheSet(key, value) {
  const raw = { t: Date.now(), ...value };
  bbMemo.set(key, raw);
  try { localStorage.setItem(BB_CACHE + key, JSON.stringify(raw)); } catch { /* 略過 */ }
}

function bbPhon(word) {
  const low = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!low) return "";
  let i = 0;
  let out = "";
  const re = /^(sch|sh|ch|th|kh|gh|ph|qu|[bcdfghjklmnpqrstvwxz])?(ou|ai|ei|au|oi|oy|ay|ey|ia|ie|io|a+|e+|i+|o+|u+|y)?/;
  while (i < low.length) {
    const m = low.slice(i).match(re);
    const chunk = m ? (m[1] || "") + (m[2] || "") : "";
    if (!chunk) { i += 1; continue; }
    const cons = m[1] ? (BB_CONS[m[1]] || "") : "";
    const vowKey = m[2] ? (BB_VOW[m[2]] ? m[2] : m[2][0]) : "";
    out += (cons + (vowKey ? (BB_VOW[vowKey] || "") : "")) || chunk;
    i += chunk.length;
  }
  return (out || low).replace(/(.)\1/g, "$1");
}
function bbPhonetic(en) {
  const tw = String(en || "").replace(/[-'.]/g, " ").split(/\s+/).filter(Boolean).map(bbPhon).filter(Boolean).join("·");
  return { tw, cn: bbHan(tw) };
}
function bbPick(pair) {
  if (!pair) return "";
  if (typeof locale === "function" && locale() === "cn") return pair.cn || bbHan(pair.tw || "");
  return pair.tw || pair.cn || "";
}
function bbKanji(text) {
  return /[\u4e00-\u9fff]/.test(text || "");
}

function bbInfo(en, ja) {
  const raw = String(en || ja || "").trim();
  const key = bbKey(en || raw);
  const dict = BB_DICT[key] || BB_DICT[bbKey(raw)];
  if (dict) return { zh: bbPick(dict), source: "dict", en: en || raw };
  const cached = key ? bbCacheGet(key) : null;
  if (cached && !cached.miss && (cached.tw || cached.cn)) return { zh: bbPick(cached), source: "wiki", en: en || raw };
  if (en && !cached) bbQueueName(en);
  if (bbKanji(ja)) return { zh: bbPick({ tw: bbTw(ja), cn: bbHan(ja) }), source: "orig", en: en || "" };
  const phon = bbPhonetic(en || "");
  return { zh: bbPick(phon), source: "phon", en: en || raw };
}

function bbQueueName(en) {
  const key = bbKey(en);
  if (!key || bbFlight.has(key) || bbQueue.some((item) => item.key === key)) return;
  if (bbQueue.length + bbFlight.size >= 16) return;
  bbQueue.push({ key, en });
  bbPump();
}
function warmNames(list) {
  const seen = new Set();
  for (const en of list || []) {
    const raw = String(en || "").trim();
    const key = bbKey(raw);
    if (!raw || seen.has(key) || BB_DICT[key] || bbCacheGet(key)) continue;
    seen.add(key);
    bbQueueName(raw);
    if (seen.size >= 24) break;
  }
}
function bbPump() {
  while (bbRunning < 2 && bbQueue.length) {
    const job = bbQueue.shift();
    bbRunning += 1;
    bbFlight.add(job.key);
    bbLookup(job.en).then((pair) => {
      bbCacheSet(job.key, pair ? { tw: pair.tw, cn: pair.cn, miss: false } : { miss: true });
      if (pair) bbPaintSoon();
    }).catch(() => bbCacheSet(job.key, { miss: true })).finally(() => {
      bbFlight.delete(job.key);
      bbRunning -= 1;
      bbPump();
    });
  }
}
function bbPaintSoon() {
  if (bbPaint) return;
  bbPaint = setTimeout(() => {
    bbPaint = 0;
    if (typeof maybeRender === "function") maybeRender({ soft: true });
  }, 150);
}
function bbClose(en, title) {
  const words = bbKey(en).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const page = bbKey(title);
  if (!words.length || !page) return false;
  const last = words[words.length - 1];
  return page.includes(last) && words.filter((w) => page.includes(w)).length >= Math.min(2, words.length);
}
function bbPair(twRaw, cnRaw) {
  const tw = bbTw(twRaw || cnRaw || "");
  const cn = bbHan(cnRaw || twRaw || "");
  return tw || cn ? { tw, cn } : null;
}
async function bbLookup(en) {
  let wiki = null;
  try { wiki = await bbWiki(en); } catch { wiki = null; }
  if (wiki) return wiki;
  return bbWikidata(en);
}
async function bbWiki(en) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrsearch=${encodeURIComponent(en + " basketball")}&gsrlimit=1&prop=langlinks&lllang=zh`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  const zh = page?.langlinks?.[0]?.["*"];
  if (!page || !zh || !bbClose(en, page.title)) return null;
  return bbPair(zh, zh);
}
async function bbWikidata(en) {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(en)}&language=en&type=item&limit=4&format=json&origin=*`);
  if (!res.ok) return null;
  const data = await res.json();
  const hits = (data.search || []).filter((item) => /basketball|kbl|b\.?\s*league|選手/i.test(item.description || ""));
  const id = hits[0]?.id;
  if (!id) return null;
  const entRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=labels&languages=zh-cn|zh-hans|zh-tw|zh&format=json&origin=*`);
  if (!entRes.ok) return null;
  const ent = await entRes.json();
  const labels = ent?.entities?.[id]?.labels || {};
  const cn = labels["zh-cn"]?.value || labels["zh-hans"]?.value || labels.zh?.value || "";
  const tw = labels["zh-tw"]?.value || labels.zh?.value || cn;
  return bbPair(tw, cn);
}

function nameHead(en, jersey, ja) {
  const info = bbInfo(en, ja);
  const num = String(jersey || "").trim();
  const title = info.zh ? info.zh + (num ? " #" + num : "") : (num ? "#" + num : (en || ja || ""));
  const tagText = info.source === "dict" ? "辭典" : info.source === "wiki" ? "維基" : info.source === "orig" ? "原名" : "音譯·未查證";
  const tag = h("span", {
    class: "ntag ntag-" + info.source,
    title: ui(info.source === "phon" ? "音譯，尚未查證，不要當成正式譯名" : info.source === "orig" ? "球員本名的漢字，還沒查到另外的中文譯名" : "點一下複製中文名"),
    onclick: (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (info.zh) copyText(info.zh, event.currentTarget);
    }
  }, ui(tagText));
  return h("span", { class: "pname" },
    h("span", { class: "pname-zh" }, title),
    info.zh ? tag : null,
    en && en !== info.zh ? h("span", { class: "pname-en" }, en) : null
  );
}
