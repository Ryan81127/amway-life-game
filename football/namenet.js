/* 中文名：辭典 → 維基／維基數據（本機快取）→ 音譯。音譯一定標成未查證。查詢不擋住畫面。 */

const NAME_CACHE = "fb-pname-v2:";
const NAME_TTL = 21 * 86400000;
const NAME_MISS_TTL = 12 * 3600000;
const nameMemo = new Map();
const nameFlight = new Set();
const nameQueue = [];
let nameRunning = 0;
let namePaint = 0;

const PHON_WORD = {
  al: "阿爾", el: "埃爾", bin: "本", ibn: "伊本", van: "范", von: "馮", de: "德", da: "達", di: "迪",
  dos: "多斯", mac: "麥克", mc: "麥克", st: "聖", jr: "儒尼奧爾", junior: "儒尼奧爾"
};
const PHON_CONS = { sh: "什", ch: "奇", th: "瑟", kh: "赫", gh: "格", ph: "夫", sch: "施", qu: "奎", b: "布", c: "克", d: "德", f: "夫", g: "格", h: "赫", j: "吉", k: "克", l: "爾", m: "姆", n: "納", p: "普", r: "爾", s: "斯", t: "特", v: "夫", w: "瓦", z: "茲", x: "克斯" };
const PHON_VOW = { ou: "烏", ai: "艾", ei: "埃", au: "奧", oi: "奧", oy: "奧", ay: "艾", ey: "伊", ia: "亞", ie: "耶", io: "約", a: "阿", e: "埃", i: "伊", o: "奧", u: "烏", y: "伊" };
const PHON_HAN = { 烏: "乌", 奧: "奥", 茲: "兹", 爾: "尔", 亞: "亚", 約: "约", 韋: "韦", 馮: "冯", 達: "达", 聖: "圣", 馬: "马", 納: "纳", 麥: "麦", 魯: "鲁", 歐: "欧" };

function phonHan(text) {
  const base = typeof han === "function" ? han(text) : text;
  return String(base).replace(/[\u3400-\u9fff]/g, (ch) => PHON_HAN[ch] || ch);
}

function nameCacheGet(key) {
  const hit = nameMemo.get(key);
  if (hit) return hit;
  try {
    const raw = JSON.parse(localStorage.getItem(NAME_CACHE + key) || "null");
    if (!raw) return null;
    const ttl = raw.miss ? NAME_MISS_TTL : NAME_TTL;
    if (Date.now() - raw.t > ttl) return null;
    nameMemo.set(key, raw);
    return raw;
  } catch {
    return null;
  }
}

function nameCacheSet(key, value) {
  const raw = { t: Date.now(), ...value };
  nameMemo.set(key, raw);
  try { localStorage.setItem(NAME_CACHE + key, JSON.stringify(raw)); } catch { /* 略過 */ }
}

function phonWord(word) {
  const low = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!low) return "";
  if (PHON_WORD[low]) return PHON_WORD[low];
  let i = 0;
  let out = "";
  const re = /^(sch|sh|ch|th|kh|gh|ph|qu|[bcdfghjklmnpqrstvwxz])?(ou|ai|ei|au|oi|oy|ay|ey|ia|ie|io|a+|e+|i+|o+|u+|y)?/;
  while (i < low.length) {
    const m = low.slice(i).match(re);
    const chunk = m ? (m[1] || "") + (m[2] || "") : "";
    if (!chunk) { i += 1; continue; }
    const cons = m[1] ? (PHON_CONS[m[1]] || "") : "";
    const vowKey = m[2] ? (PHON_VOW[m[2]] ? m[2] : m[2][0]) : "";
    const vow = vowKey ? (PHON_VOW[vowKey] || "") : "";
    out += (cons + vow) || chunk;
    i += chunk.length;
  }
  return (out || low).replace(/(.)\1/g, "$1");
}

function phoneticPair(en) {
  const parts = String(en || "").replace(/[-']/g, " ").split(/\s+/).filter(Boolean);
  const tw = parts.map(phonWord).filter(Boolean).join("·");
  return { tw, cn: phonHan(tw) };
}

function pickPair(pair) {
  if (!pair) return "";
  if (typeof locale === "function" && locale() === "cn") return pair.cn || pair.tw || "";
  return pair.tw || pair.cn || "";
}

function nameInfo(en) {
  const raw = String(en || "").trim();
  if (!raw) return { zh: "", source: "phon", en: raw };
  if (/[\u3400-\u9fff]/.test(raw) && !/[A-Za-z]/.test(raw)) return { zh: raw, source: "dict", en: raw };
  const key = plainKey(raw);
  if (typeof dictPair === "function") {
    const dict = dictPair(raw);
    if (dict) return { zh: pickPair(dict), source: "dict", en: raw };
  }
  const cached = nameCacheGet(key);
  if (cached && !cached.miss && (cached.tw || cached.cn)) return { zh: pickPair(cached), source: "wiki", en: raw };
  if (!cached) queueName(raw);
  const phon = phoneticPair(raw);
  return { zh: pickPair(phon), source: "phon", en: raw };
}

function shownZh(en) {
  return nameInfo(en).zh || (typeof playerZh === "function" ? playerZh(en) : en);
}

function queueName(en) {
  const key = plainKey(en);
  if (!key || nameFlight.has(key) || nameQueue.some((item) => item.key === key)) return;
  if (nameQueue.length + nameFlight.size >= 16) return;
  nameQueue.push({ key, en });
  pumpNames();
}

function warmNames(list) {
  const seen = new Set();
  for (const en of list || []) {
    const raw = String(en || "").trim();
    const key = typeof plainKey === "function" ? plainKey(raw) : raw;
    if (!raw || seen.has(key)) continue;
    seen.add(key);
    if (typeof dictPair === "function" && dictPair(raw)) continue;
    if (nameCacheGet(key)) continue;
    queueName(raw);
    if (seen.size >= 24) break;
  }
}

function pumpNames() {
  while (nameRunning < 2 && nameQueue.length) {
    const job = nameQueue.shift();
    nameRunning += 1;
    nameFlight.add(job.key);
    lookupName(job.en).then((pair) => {
      if (pair) nameCacheSet(job.key, { tw: pair.tw, cn: pair.cn, miss: false });
      else nameCacheSet(job.key, { miss: true });
      scheduleNamePaint();
    }).catch(() => {
      nameCacheSet(job.key, { miss: true });
    }).finally(() => {
      nameFlight.delete(job.key);
      nameRunning -= 1;
      pumpNames();
    });
  }
}

function scheduleNamePaint() {
  if (namePaint) return;
  namePaint = setTimeout(() => {
    namePaint = 0;
    if (typeof maybeRender === "function" && typeof state !== "undefined" && state.model) maybeRender({ soft: true });
  }, 120);
}

function wikiClose(en, title) {
  const words = plainKey(en).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const page = plainKey(title);
  if (!words.length || !page) return false;
  const last = words[words.length - 1];
  return page.includes(last) && words.filter((w) => page.includes(w)).length >= Math.min(2, words.length);
}

function namePair(twRaw, cnRaw) {
  const twBase = twRaw || cnRaw || "";
  const cnBase = cnRaw || twRaw || "";
  if (!twBase && !cnBase) return null;
  const tw = typeof toTw === "function" ? toTw(twBase) : twBase;
  const cn = typeof han === "function" ? han(cnBase) : cnBase;
  return { tw, cn };
}

async function lookupName(en) {
  let wiki = null;
  try {
    wiki = await wikiLabel(en);
  } catch {
    wiki = null;
  }
  if (wiki) return wiki;
  return wikidataLabel(en);
}

async function wikiLabel(en) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrsearch=${encodeURIComponent(en + " footballer")}&gsrlimit=1&prop=langlinks&lllang=zh`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  const zh = page?.langlinks?.[0]?.["*"];
  if (!page || !zh || !wikiClose(en, page.title)) return null;
  return namePair(zh, zh);
}

async function wikidataLabel(en) {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(en)}&language=en&type=item&limit=4&format=json&origin=*`;
  const res = await fetch(searchUrl);
  if (!res.ok) return null;
  const data = await res.json();
  const hits = (data.search || []).filter((item) => /football|soccer/i.test(item.description || ""));
  const id = (hits[0] || data.search?.[0])?.id;
  if (!id) return null;
  if (hits.length === 0 && !/football|soccer/i.test(data.search?.[0]?.description || "")) return null;
  const entUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=labels&languages=zh-cn|zh-hans|zh-tw|zh&format=json&origin=*`;
  const entRes = await fetch(entUrl);
  if (!entRes.ok) return null;
  const ent = await entRes.json();
  const labels = ent?.entities?.[id]?.labels || {};
  const cn = labels["zh-cn"]?.value || labels["zh-hans"]?.value || labels.zh?.value || "";
  const tw = labels["zh-tw"]?.value || labels.zh?.value || cn;
  return namePair(tw, cn);
}

function copyPlayerName(text) {
  const value = String(text || "");
  if (!value) return;
  if (typeof copyText === "function") {
    const button = h("button", null, "");
    copyText(value, button);
    return;
  }
  if (navigator.clipboard) navigator.clipboard.writeText(value).catch(() => {});
}

function nameHead(en, jersey) {
  const info = nameInfo(en);
  const num = String(jersey || "").trim();
  const title = info.zh ? info.zh + (num ? " #" + num : "") : (num ? "#" + num : en);
  const tagText = info.source === "dict" ? "辭典" : info.source === "wiki" ? "維基" : "音譯·未查證";
  const tag = h("span", {
    class: "ntag ntag-" + info.source,
    title: ui(info.source === "phon" ? "音譯，尚未查證，不要當成正式譯名" : "點一下複製中文名"),
    onclick: (event) => {
      event.stopPropagation();
      event.preventDefault();
      copyPlayerName(info.zh);
    }
  }, ui(tagText));
  const box = h("span", { class: "pname" },
    h("span", { class: "pname-zh" }, title),
    info.zh ? tag : null,
    en && en !== info.zh ? h("span", { class: "pname-en" }, en) : null
  );
  return box;
}
