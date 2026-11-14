/* 體育館：球場資料（維基百科）、開賽時天氣與當月氣候（Open-Meteo）、主辦國家特色（維基百科）。 */

const VENUE_PREFIX = "fb-venue-v1:";
const venueStore = new Map();

const WMO_ZH = {
  0: "晴朗", 1: "大致晴朗", 2: "局部多雲", 3: "陰天", 45: "起霧", 48: "霧淞", 51: "毛毛雨", 53: "毛毛雨", 55: "較大毛毛雨",
  56: "凍毛毛雨", 57: "凍毛毛雨", 61: "小雨", 63: "中雨", 65: "大雨", 66: "凍雨", 67: "凍雨", 71: "小雪", 73: "中雪", 75: "大雪",
  77: "冰粒", 80: "陣雨", 81: "較強陣雨", 82: "豪大陣雨", 85: "陣雪", 86: "較強陣雪", 95: "雷雨", 96: "雷雨夾冰雹", 99: "強雷雨夾冰雹"
};
const WMO_ICON = (c) => (c === 0 ? "☀️" : c <= 2 ? "🌤️" : c === 3 ? "☁️" : c <= 48 ? "🌫️" : c <= 67 || (c >= 80 && c <= 82) ? "🌧️" : c <= 86 ? "🌨️" : "⛈️");

const STADIUM_KEYS = [
  [/^(啟用|開幕|開放|落成|建成|完工|正式啟用|開業)/, "opened", "🗓️ 啟用"],
  [/^(動工|興建|始建|建造時間|破土)/, "built", "🏗️ 動工"],
  [/^(改建|翻新|擴建|重建)/, "renov", "🔧 改建"],
  [/^(容量|座位|容納|觀眾容量)/, "cap", "👥 容量"],
  [/^(場地|草皮|地面|表面)/, "surface", "🌱 草皮"],
  [/^(建造費用|造價|建設費用|成本)/, "cost", "💰 造價"],
  [/^(建築師|設計)/, "arch", "📐 設計"],
  [/^(擁有者|業主|所有者)/, "owner", "🏢 擁有者"],
  [/^(主隊|租戶|使用者|主場球隊)/, "tenants", "🏠 主場球隊"],
  [/^(位置|地址|地點)/, "loc", "📍 位置"]
];
const EN_KEYS = [
  [/^opened$/i, "opened"], [/^(broke ground|built|construction)$/i, "built"], [/^(renovated|expanded|reopened)$/i, "renov"],
  [/^capacity$/i, "cap"], [/^surface$/i, "surface"], [/^construction cost$/i, "cost"], [/^architect$/i, "arch"],
  [/^owner$/i, "owner"], [/^tenants?$/i, "tenants"], [/^location$/i, "loc"]
];

function vClean(t) {
  return String(t || "").replace(/\[\w+\]/g, "").replace(/\s+/g, " ").trim();
}

function infoboxRows(doc) {
  const box = doc?.querySelector("table.infobox");
  const rows = [];
  if (!box) return rows;
  for (const tr of box.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    const td = tr.querySelector("td");
    if (!th || !td) continue;
    td.querySelectorAll("br").forEach((b) => b.replaceWith("；"));
    rows.push([vClean(th.textContent), vClean(td.textContent).replace(/^；|；$/g, "")]);
  }
  return rows;
}

async function enSearchPage(q, extra = "") {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=langlinks%7Ccoordinates%7Cextracts&lllang=zh&exintro=1&explaintext=1&exsentences=4${extra}`;
  const page = (await fetchT(url).then((r) => r.json())).query?.pages?.[0];
  return page || null;
}

async function zhSummary(title) {
  const r = await fetchT(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { "Accept-Language": "zh-tw" } });
  return r.ok ? r.json() : null;
}

async function stadiumInfo(model) {
  const page = await enSearchPage(`${model.venue} ${model.city || ""} stadium`);
  if (!page) return null;
  const out = { en: page.title, enText: page.extract || "", coords: page.coordinates?.[0] ? { lat: page.coordinates[0].lat, lon: page.coordinates[0].lon } : null, facts: {}, stories: [] };
  const zh = page.langlinks?.[0]?.title;
  if (zh) {
    const doc = await storyDoc(zh);
    if (doc) {
      for (const [k, v] of infoboxRows(doc)) {
        const hit = STADIUM_KEYS.find(([re]) => re.test(k));
        if (hit && !out.facts[hit[1]] && v.length < 120) out.facts[hit[1]] = v;
      }
      const sents = [];
      for (const sec of docSections(doc)) {
        if (STORY_SKIP.test(sec.head)) continue;
        for (const s of storySentences(sec.text)) sents.push(s);
      }
      out.intro = sents.slice(0, 2).join("");
      const score = (s) => [/最大|最高|第一|首座|首次|唯一|紀錄|世界盃|奧運|決賽|亞運|歐洲盃|屋頂|開闔|可伸縮|演唱會|改建|拆除|翻新|地標|設計|造價|億/].reduce((a, re) => a + (re.test(s) ? 2 : 0), 0) + (/\d{4}年/.test(s) ? 1 : 0);
      out.stories = sents.slice(2).map((s) => ({ s, n: score(s) })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 5).map((x) => x.s);
      out.title = toTw(zh);
      out.url = `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(zh)}`;
    }
  }
  if (!out.title) {
    const doc = await enHtml(page.title);
    for (const [k, v] of infoboxRows(doc)) {
      const hit = EN_KEYS.find(([re]) => re.test(k));
      if (hit && !out.facts[hit[1]] && v.length < 120) out.facts[hit[1]] = v;
    }
    out.title = page.title;
    out.url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`;
  }
  return out;
}

async function countryInfo(countryEn) {
  if (!countryEn) return null;
  const page = await enSearchPage(countryEn);
  const zh = page?.langlinks?.[0]?.title;
  if (!zh) return null;
  const doc = await storyDoc(zh);
  const sum = await zhSummary(zh).catch(() => null);
  const facts = {};
  const pick = [[/^首都/, "首都", "🏛️"], [/^最大城市/, "最大城市", "🏙️"], [/^官方語言/, "官方語言", "🗣️"], [/^貨幣/, "貨幣", "💱"], [/^(人口|總人口)/, "人口", "👨‍👩‍👧"], [/^時區/, "時區", "🕒"], [/^(國家格言|格言)/, "格言", "📜"]];
  for (const [k, v] of infoboxRows(doc)) {
    const hit = pick.find(([re]) => re.test(k));
    if (hit && !facts[hit[1]] && v.length < 90) facts[hit[1]] = { v: v.replace(/（[^）]{20,}）/g, ""), icon: hit[2] };
  }
  const want = /美食|料理|菜|飲食|咖啡|啤酒|葡萄酒|文化|音樂|舞蹈|節慶|節日|世界遺產|遺產|宗教|景點|著名|聞名|以.*聞名|特產|運動|足球|國球|傳統|語言|旅遊|自然|山|海灘|沙漠|氣候/;
  const sents = [];
  for (const sec of docSections(doc)) {
    if (STORY_SKIP.test(sec.head) || /政治|政府|軍事|外交|行政區劃|經濟/.test(sec.head)) continue;
    for (const s of storySentences(sec.text)) if (want.test(s) || /文化|飲食|體育|旅遊|宗教|節日/.test(sec.head)) sents.push({ s, head: sec.head });
  }
  const seen = new Set();
  const features = [];
  for (const x of sents) {
    const tag = /體育|足球|運動/.test(x.head + x.s) ? "⚽ 體育" : /飲食|美食|料理|菜|咖啡|酒/.test(x.head + x.s) ? "🍽️ 美食" : /節|音樂|舞|文化|宗教|傳統/.test(x.head + x.s) ? "🎭 文化" : /遺產|景點|旅遊|自然|山|海/.test(x.head + x.s) ? "🏞️ 景點" : "📌 特色";
    if (seen.has(tag) && features.filter((f) => f.tag === tag).length >= 2) continue;
    seen.add(tag);
    features.push({ tag, s: x.s });
    if (features.length >= 7) break;
  }
  return { name: toTw(sum?.title || zh), intro: sum?.extract || "", url: `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(zh)}`, facts, features };
}

async function geocode(city, country) {
  try {
    const j = await fetchT(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en`).then((r) => r.json());
    const list = j.results || [];
    const hit = list.find((x) => !country || x.country === country) || list[0];
    return hit ? { lat: hit.latitude, lon: hit.longitude, country: hit.country } : null;
  } catch {
    return null;
  }
}

function fetchT(url, opts = {}, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

/* 逐時天氣：Open-Meteo 預報 → Open-Meteo 歷史預報（已開賽）→ wttr.in（部分網路連不到 Open-Meteo 預報時） */
async function weatherAt(lat, lon, kickoff, utcOffset) {
  const k = new Date(kickoff);
  const days = (k - Date.now()) / 86400000;
  if (days > 15) return null;
  const ymd = k.toISOString().slice(0, 10);
  const target = k.toISOString().slice(0, 13);
  const hourly = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m";
  const pick = (j) => {
    const i = (j.hourly?.time || []).findIndex((t) => t.slice(0, 13) === target);
    if (i < 0) return null;
    const v = (key) => j.hourly?.[key]?.[i];
    return { temp: v("temperature_2m"), feel: v("apparent_temperature"), hum: v("relative_humidity_2m"), pop: v("precipitation_probability") ?? null, rain: v("precipitation"), code: v("weather_code"), wind: v("wind_speed_10m"), utcOffset: utcOffset ?? null, src: "Open-Meteo" };
  };
  const urls = days < 0.1
    ? [`https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${hourly.replace(",precipitation_probability", "")}&timezone=GMT&start_date=${ymd}&end_date=${ymd}`]
    : [`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${hourly}&timezone=GMT&start_date=${ymd}&end_date=${ymd}`];
  for (const u of urls) {
    try {
      const j = await fetchT(u).then((r) => r.json());
      const w = pick(j);
      if (w) return w;
    } catch { /* 換下一個來源 */ }
  }
  if (days >= -0.2 && days <= 2.5) {
    try {
      const j = await fetchT(`https://wttr.in/${lat},${lon}?format=j1&lang=zh-tw`, {}, 12000).then((r) => r.json());
      const off = utcOffset ?? Math.round(lon / 15) * 3600;
      const local = new Date(k.getTime() + off * 1000);
      const day = (j.weather || []).find((d) => d.date === local.toISOString().slice(0, 10));
      if (day) {
        const hr = local.getUTCHours() * 100;
        const slot = day.hourly.reduce((a, x) => (Math.abs(Number(x.time) - hr) < Math.abs(Number(a.time) - hr) ? x : a), day.hourly[0]);
        const desc = slot["lang_zh-tw"]?.[0]?.value || slot.weatherDesc?.[0]?.value || "";
        const code = /雷/.test(desc) ? 95 : /雪/.test(desc) ? 73 : /陣雨/.test(desc) ? 80 : /雨/.test(desc) ? 61 : /霧/.test(desc) ? 45 : /陰/.test(desc) ? 3 : /多雲|雲/.test(desc) ? 2 : 0;
        return { temp: Number(slot.tempC), feel: Number(slot.FeelsLikeC), hum: Number(slot.humidity), pop: Number(slot.chanceofrain), rain: Number(slot.precipMM), code, desc, wind: Number(slot.windspeedKmph), utcOffset: off, src: "wttr.in" };
      }
    } catch { /* 都失敗就算了 */ }
  }
  return null;
}

async function monthClimate(lat, lon, kickoff) {
  const k = new Date(kickoff);
  const y = k.getUTCFullYear() - 1;
  const m = String(k.getUTCMonth() + 1).padStart(2, "0");
  const last = new Date(Date.UTC(y, k.getUTCMonth() + 1, 0)).getUTCDate();
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y}-${m}-01&end_date=${y}-${m}-${last}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const j = await fetchT(url).then((r) => r.json());
  const d = j.daily;
  if (!d?.time?.length) return null;
  const avg = (a) => a.filter((x) => x != null).reduce((s, x) => s + x, 0) / a.filter((x) => x != null).length;
  return { year: y, month: Number(m), hi: avg(d.temperature_2m_max), lo: avg(d.temperature_2m_min), rainDays: d.precipitation_sum.filter((x) => x >= 1).length, rainSum: d.precipitation_sum.reduce((s, x) => s + (x || 0), 0), days: d.time.length, tz: j.timezone, utcOffset: j.utc_offset_seconds };
}

async function ensureVenue(model) {
  const key = model.id;
  if (venueStore.has(key)) return;
  venueStore.set(key, { status: "loading" });
  let base = null;
  try {
    const cached = JSON.parse(localStorage.getItem(VENUE_PREFIX + model.venue) || "null");
    if (cached && Date.now() - cached.t < 14 * 86400000) base = cached.v;
  } catch { /* 略過 */ }
  try {
    if (!base) {
      const stadium = model.venue ? await stadiumInfo(model).catch(() => null) : null;
      let coords = stadium?.coords || null;
      let countryEn = model.country || "";
      const geo = model.city ? await geocode(model.city, model.country) : null;
      if (!coords && geo) coords = { lat: geo.lat, lon: geo.lon };
      if (!countryEn && geo) countryEn = geo.country;
      const country = await countryInfo(countryEn).catch(() => null);
      base = { stadium, coords, countryEn, country };
      try { localStorage.setItem(VENUE_PREFIX + model.venue, JSON.stringify({ t: Date.now(), v: base })); } catch { /* 略過 */ }
    }
    let weather = null;
    let climate = null;
    if (base.coords) {
      climate = await monthClimate(base.coords.lat, base.coords.lon, model.kickoff).catch(() => null);
      weather = await weatherAt(base.coords.lat, base.coords.lon, model.kickoff, climate?.utcOffset).catch(() => null);
    }
    venueStore.set(key, { status: "ok", ...base, weather, climate, at: Date.now() });
  } catch (err) {
    console.error(err);
    venueStore.set(key, { status: "error" });
  }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function weatherImpact(w) {
  const out = [];
  if (w.temp >= 30 || w.feel >= 32) out.push("高溫：體能消耗大，下半場節奏容易掉，換人與補水暫停是關鍵。");
  else if (w.temp <= 3) out.push("低溫：肌肉容易拉傷，開賽前段雙方通常比較保守。");
  if (w.hum >= 80 && w.temp >= 25) out.push("又熱又濕：悶熱讓高位逼搶撐不久，控球隊比較吃香。");
  if ((w.rain || 0) >= 1 || (w.pop || 0) >= 60 || (w.code >= 51 && w.code <= 82)) out.push("下雨：草皮濕滑、球速變快，遠射與守門員脫手的機會增加，大小球偏大。");
  if (w.wind >= 30) out.push(`強風（${Math.round(w.wind)} km/h）：長傳、傳中和定位球容易失準，順風的那半場比較好打。`);
  if (!out.length) out.push("天氣條件正常，對比賽影響不大。");
  return out;
}

function venueBlock(model) {
  const st = venueStore.get(model.id);
  if (!st) ensureVenue(model);
  const block = h("section", { class: "block", id: "venue" }, h("h2", null, ui(`體育館：${model.venue || "未公布"}`)));
  if (!model.venue) { block.append(h("p", { class: "muted" }, ui("ESPN 還沒公布這場的比賽場地。"))); return block; }
  if (!st || st.status === "loading") { block.append(h("p", { class: "muted" }, ui("整理球場資料、天氣與主辦國家特色中…"))); return block; }
  if (st.status !== "ok") { block.append(h("p", { class: "muted" }, ui("場地資料暫時無法取得。"))); return block; }
  const say = [];
  /* 1–2. 球場 */
  const s = st.stadium;
  const sp = h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui(`🏟️ ${s?.title || model.venue}`)));
  if (model.city) sp.append(h("p", { class: "faint" }, ui(`📍 ${model.city}${model.country ? `，${model.country}` : ""}`)));
  if (s) {
    const order = [["opened", "🗓️ 啟用／完工"], ["built", "🏗️ 動工"], ["renov", "🔧 改建"], ["cap", "👥 容量"], ["surface", "🌱 草皮"], ["cost", "💰 造價"], ["arch", "📐 設計"], ["owner", "🏢 擁有者"], ["tenants", "🏠 主場球隊"]];
    const rows = order.filter(([k]) => s.facts[k]).map(([k, label]) => h("tr", null, h("th", null, ui(label)), h("td", null, ui(s.facts[k]))));
    if (rows.length) sp.append(h("table", { class: "fact-table kv" }, h("tbody", null, rows)));
    if (s.intro) sp.append(h("p", null, ui(s.intro)));
    else if (s.enText) sp.append(h("p", { class: "faint" }, s.enText));
    if (s.stories.length) sp.append(h("div", { class: "st-label" }, ui("✨ 球場特色")), h("ul", { class: "st-bullets" }, s.stories.map((x) => h("li", null, ui(x)))));
    sp.append(h("p", { class: "faint kc-src" }, ui("來源：維基百科 · "), h("a", { href: s.url, target: "_blank", rel: "noopener" }, ui("看完整條目"))));
    const opened = s.facts.opened ? `${s.facts.opened}啟用` : "";
    const cap = s.facts.cap ? `可以容納 ${s.facts.cap.split("；")[0]} 人` : "";
    say.push(`今天的戰場是${s.title || model.venue}${[opened, cap].filter(Boolean).length ? "，" + [opened, cap].filter(Boolean).join("、") : ""}。${s.stories[0] || ""}`);
  } else {
    sp.append(h("p", { class: "muted" }, ui("維基百科找不到這座球場的條目。")));
  }
  block.append(sp);
  /* 3. 天氣與氣候 */
  const wp = h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui("🌦️ 開賽時天氣與當地氣候")));
  const w = st.weather;
  if (w && w.temp != null) {
    const local = w.utcOffset != null ? new Date(new Date(model.kickoff).getTime() + w.utcOffset * 1000).toISOString().slice(11, 16) : "";
    wp.append(h("div", { class: "wx" },
      h("div", { class: "wx-main" }, h("span", { class: "wx-ic" }, WMO_ICON(w.code)), h("b", null, `${Math.round(w.temp)}°C`), h("span", null, ui(w.desc || WMO_ZH[w.code] || ""))),
      h("div", { class: "wx-grid" },
        h("span", null, ui(`體感 ${Math.round(w.feel)}°C`)), h("span", null, ui(`濕度 ${Math.round(w.hum)}%`)),
        w.pop != null ? h("span", null, ui(`降雨機率 ${w.pop}%`)) : h("span", null, ui(`雨量 ${w.rain ?? 0} mm`)),
        h("span", null, ui(`風速 ${Math.round(w.wind)} km/h`)),
        local ? h("span", null, ui(`當地開球時間 ${local}`)) : null)));
    wp.append(h("ul", { class: "st-bullets" }, weatherImpact(w).map((x) => h("li", null, ui(x)))));
    say.push(`開球時天氣${w.desc || WMO_ZH[w.code] || ""}，氣溫大約 ${Math.round(w.temp)} 度${w.pop != null ? `，降雨機率 ${w.pop}%` : ""}。${weatherImpact(w)[0]}`);
  } else {
    wp.append(h("p", { class: "faint" }, ui("開賽時間超過 15 天，或還拿不到逐時預報；比賽前幾天再按「重新整理」。")));
  }
  const c = st.climate;
  if (c) {
    wp.append(h("p", null, ui(`📅 當地 ${c.month} 月氣候（參考 ${c.year} 年同月實測）：白天平均 ${trimNum(c.hi)}°C、夜間 ${trimNum(c.lo)}°C，${c.days} 天中有 ${c.rainDays} 天下雨，月雨量約 ${Math.round(c.rainSum)} mm。`)));
  }
  wp.append(h("p", { class: "faint" }, ui(`資料：${w?.src || "Open-Meteo"}（開賽時逐時天氣）、Open-Meteo 歷史實測（當月氣候）。`)));
  block.append(wp);
  /* 4. 國家特色 */
  const co = st.country;
  const cp = h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui(`🌍 ${co?.name || st.countryEn || "主辦國家"}`)));
  if (co) {
    const fRows = Object.entries(co.facts).map(([k, f]) => h("tr", null, h("th", null, ui(`${f.icon} ${k}`)), h("td", null, ui(f.v))));
    if (fRows.length) cp.append(h("table", { class: "fact-table kv" }, h("tbody", null, fRows)));
    if (co.intro) cp.append(h("p", null, ui(String(co.intro).split(/(?<=。)/).slice(0, 2).join(""))));
    if (co.features.length) cp.append(h("div", { class: "st-label" }, ui("🎯 國家特色（美食、文化、體育、景點）")), h("div", { class: "st-list" }, co.features.map((f) => h("div", { class: "st-item" }, h("b", null, ui(f.tag)), h("p", null, ui(f.s))))));
    cp.append(h("p", { class: "faint kc-src" }, ui("來源：維基百科 · "), h("a", { href: co.url, target: "_blank", rel: "noopener" }, ui("看完整條目"))));
    const food = co.features.find((f) => /美食/.test(f.tag)) || co.features[0];
    if (food) say.push(`順便認識一下${co.name}：${food.s}`);
  } else {
    cp.append(h("p", { class: "muted" }, ui("找不到主辦國家的資料。")));
  }
  block.append(cp);
  if (say.length) block.append(scriptBlock([...say, "你有去過這個國家或這座球場嗎？留言分享！"], "口播：場地與天氣"));
  block.append(h("button", { class: "chip", onclick: () => { venueStore.delete(model.id); ensureVenue(model); maybeRender({ soft: true }); } }, ui("🔄 重新整理天氣")));
  return block;
}
