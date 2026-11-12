/* 共用工具（取自足球看板）：DOM、日期、賠率換算、表格。 */
const TZ = "Asia/Taipei";
function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (key === "disabled" || key === "hidden" || key === "open") node[key] = Boolean(value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (tag === "button" && !node.hasAttribute("type")) node.type = "button";
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

async function copyText(text, button) {
  const old = button.textContent;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else throw new Error("clipboard");
  } catch {
    const area = h("textarea", { class: "sr" });
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "已複製";
  setTimeout(() => {
    button.textContent = old;
  }, 1400);
}

function scriptBlock(lines, label) {
  lines = (lines || []).filter(Boolean);
  if (!lines.length) return null;
  const shown = lines.map((line) => speak(line));
  const button = h("button", { class: "copy" }, ui("複製口播"));
  button.addEventListener("click", () => copyText(shown.join("\n"), button));
  return h("div", { class: "script" },
    h("div", { class: "script-k" }, ui(label || "口播")),
    shown.map((line) => h("p", { class: "say" }, line)),
    button
  );
}

function logoNode(src, abbr) {
  const wrap = h("span", { class: "logo" });
  if (!src) {
    wrap.append(h("span", { class: "abbr" }, abbr || "隊"));
    return wrap;
  }
  const img = h("img", { alt: "", src });
  img.addEventListener("error", () => {
    wrap.replaceChildren(h("span", { class: "abbr" }, abbr || "隊"));
  });
  wrap.append(img);
  return wrap;
}

function footer() {
  return h("footer", { class: "foot" }, ui("資料來源：ESPN。時間為台北時間。口播只依畫面上的數據，預測句會標明「以目前數據來看」。"));
}

function errorBox(retry) {
  return h("div", { class: "error-box" },
    h("p", null, "資料暫時無法取得"),
    h("button", { class: "retry", onclick: retry }, "重試")
  );
}

function setProgress(text) {
  const node = document.getElementById("progress");
  if (node) node.textContent = text;
}

function langToggle() {
  const go = (next) => {
    if (locale() === next) return;
    setLocale(next);
    relabelNames();
    maybeRender({ soft: true });
  };
  return h("div", { class: "langbar", role: "group", "aria-label": "用語" },
    h("button", { class: "chip", "aria-pressed": String(locale() === "tw"), onclick: () => go("tw") }, "台灣用語"),
    h("button", { class: "chip", "aria-pressed": String(locale() === "cn"), onclick: () => go("cn") }, "大陆用语")
  );
}

function trimNum(n) {
  const r = Math.round(Number(n) * 10) / 10;
  return String(r);
}

function signed(n) {
  const v = Number(n) || 0;
  return (v > 0 ? "+" : "") + trimNum(v);
}

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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

function fmtHandicap(n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  if (n > 0) return `+${trimNum(n)}`;
  if (n < 0) return `-${trimNum(Math.abs(n))}`;
  return "0";
}

const limit = pLimit(6);

function fmtOdd(dec) {
  return dec == null ? "–" : (Math.round(dec * 100) / 100).toFixed(2);
}

function pct(p) {
  return `${Math.round(p * 1000) / 10}%`;
}

function evText(ev) {
  const v = Math.round(ev * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

function num2(n) {
  return String(Math.round(Number(n) * 100) / 100);
}

function pickN(model, salt, list, n) {
  const pool = list.filter(Boolean);
  const out = [];
  let k = 0;
  for (const ch of String(model.id) + salt) k = (k * 33 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < pool.length && out.length < n; i += 1) {
    const line = pool[(k + i * 7) % pool.length];
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

function taipeiHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date())) % 24;
}

function predTable(head, rows) {
  return h("div", { class: "ptable-wrap" }, h("table", { class: "ptable" },
    h("tr", null, head.map((x) => h("th", null, ui(x)))),
    rows.map((r) => h("tr", { class: r.cls || null }, r.cells.map((c) => h("td", { class: c?.cls || null }, c?.node ?? ui(String(c ?? "–"))))))
  ));
}

function evCell(ev) {
  if (ev == null) return { node: "–" };
  return { node: evText(ev), cls: ev >= 0.02 ? "pos" : ev <= -0.04 ? "neg" : "" };
}

