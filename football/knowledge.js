/* 比賽知識卡：讀 cards/ 裡可重複使用的球隊、球員、城市與文化卡，加上 ESPN 自動生成的數據卡。
   每張卡：主題、50–100 字事實（附來源與查證日期）、20–40 秒口語稿、兩種強度的幽默、互動問題、使用時機、資料狀態。 */

const CARD_GOAL = { team: 5, player: 5, place: 5, ask: 10 };
const CARD_WHEN = ["開場", "暫停", "中場", "冷場", "賽後"];
const CARD_TOPICS = ["球隊", "球員", "城市", "國家", "文化", "趣聞"];
const CARD_VER = "20261113c";

const cardStore = { index: null, indexAt: 0, files: new Map() };

async function cardJson(path) {
  if (cardStore.files.has(path)) return cardStore.files.get(path);
  const p = fetch(`cards/${path}?v=${CARD_VER}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  cardStore.files.set(path, p);
  return p;
}

async function cardIndex() {
  if (cardStore.index && Date.now() - cardStore.indexAt < 10 * 60000) return cardStore.index;
  const res = await fetch(`cards/index.json?v=${CARD_VER}&t=${Math.floor(Date.now() / 600000)}`, { cache: "no-cache" }).catch(() => null);
  cardStore.index = res && res.ok ? await res.json() : { teams: {}, venues: {}, ttlDays: {} };
  cardStore.indexAt = Date.now();
  return cardStore.index;
}

function cardGroup(topic) {
  if (topic === "球隊") return "team";
  if (topic === "球員") return "player";
  return "place";
}

function daysSince(ymd) {
  const t = Date.parse(`${ymd}T00:00:00+08:00`);
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : 9999;
}

function effectiveStatus(card, ttl) {
  if (card.status === "不可當成事實播報") return { status: card.status, why: card.note || "" };
  const limit = ttl[card.topic] ?? 365;
  const age = daysSince(card.checked);
  if (card.status === "已查證" && age > limit) return { status: "需更新", why: `距上次查證 ${age} 天，超過「${card.topic}」類 ${limit} 天的期限` };
  return { status: card.status || "需更新", why: card.note || "" };
}

async function loadMatchCards(model) {
  const idx = await cardIndex();
  const ttl = idx.ttlDays || {};
  const out = [];
  const add = (list, owner) => {
    for (const card of list || []) out.push({ ...card, owner, eff: effectiveStatus(card, ttl) });
  };
  for (const side of ["home", "away"]) {
    const t = model[side];
    const file = idx.teams?.[t.id];
    if (!file) continue;
    const data = await cardJson(file);
    if (!data) continue;
    add(data.cards, t.name);
    const other = model[side === "home" ? "away" : "home"];
    add(data.rivals?.[other.id], `${t.name} vs ${other.name}`);
  }
  const vkey = String(model.venue || "").toLowerCase().trim();
  const vfile = idx.venues?.[vkey];
  if (vfile) {
    const data = await cardJson(vfile);
    if (data) add(data.cards, data.city || model.venue);
  }
  for (const card of autoCards(model)) out.push({ ...card, eff: { status: "已查證", why: "ESPN 即時資料" } });
  return { cards: out, hasFiles: !!(idx.teams?.[model.home.id] || idx.teams?.[model.away.id] || vfile) };
}

/* ESPN 自動卡：近況、交手、積分，資料當下查證 */
function autoCards(model) {
  const today = taipeiYmd(new Date());
  const src = [{ name: "ESPN 賽事資料", url: `https://www.espn.com/soccer/match/_/gameId/${model.id}` }];
  const cards = [];
  for (const block of model.form || []) {
    const games = (block.games || []).slice(0, 5);
    if (games.length < 3) continue;
    const w = games.filter((g) => g.result === "W").length;
    const d = games.filter((g) => g.result === "D").length;
    const l = games.filter((g) => g.result === "L").length;
    const streak = (() => {
      const first = games[0]?.result;
      let n = 0;
      for (const g of games) { if (g.result === first) n += 1; else break; }
      return { r: first, n };
    })();
    const word = { W: "連勝", D: "連和", L: "連敗" }[streak.r] || "";
    const list = games.map((g) => `${g.opponent} ${g.score}`).join("、");
    cards.push({
      id: `auto-form-${block.id}`, topic: "球隊", owner: block.name, auto: true,
      title: `${block.name}近 ${games.length} 場 ${w} 勝 ${d} 和 ${l} 負`,
      fact: `${block.name}最近 ${games.length} 場：${list}。${streak.n >= 2 ? `目前${word} ${streak.n} 場。` : ""}`,
      sources: src, checked: today,
      say: `先看${block.name}的近況，最近 ${games.length} 場拿下 ${w} 勝 ${d} 和 ${l} 負${streak.n >= 2 ? `，而且正處在${word} ${streak.n} 場的狀態` : ""}。${w >= 3 ? "手感正熱。" : l >= 3 ? "狀態不算好，今天急需一場勝利止血。" : "表現起伏，今天是證明自己的機會。"}`,
      humor: {
        light: l >= 3 ? `${block.name}最近的戰績，像極了我月底的錢包。` : `${block.name}最近踢得順，連熱身都帶著自信。`,
        spicy: l >= 3 ? `再輸下去，${block.name}的球迷大概要集體退追蹤了。` : `${block.name}這波手感熱到燙手，對手今天要戴隔熱手套。`
      },
      ask: `你覺得${block.name}今天能延續狀態嗎？`,
      when: ["開場"]
    });
  }
  const h2h = model.h2h;
  const n = (h2h?.hw || 0) + (h2h?.dr || 0) + (h2h?.aw || 0);
  if (n) {
    cards.push({
      id: "auto-h2h", topic: "球隊", owner: `${model.home.name} vs ${model.away.name}`, auto: true,
      title: `本季交手 ${n} 場`,
      fact: `${model.home.name}與${model.away.name}本季交手 ${n} 場：${model.home.name} ${h2h.hw} 勝、和 ${h2h.dr}、${model.away.name} ${h2h.aw} 勝。`,
      sources: src, checked: today,
      say: `兩隊本季已經交手 ${n} 次，${model.home.name}贏 ${h2h.hw} 場、和 ${h2h.dr} 場、${model.away.name}贏 ${h2h.aw} 場。彼此都很熟，今天比的是誰先調整。`,
      humor: { light: "交手這麼多次，雙方球員大概連對方的髮型都記住了。", spicy: "見面次數比我跟親戚還多，今天就看誰先翻臉。" },
      ask: "你覺得交手紀錄對今天有影響嗎？",
      when: ["開場", "中場"]
    });
  }
  return cards;
}

/* 10 句觀眾互動話術：卡片提問優先，不足用比賽情境補齊 */
function interactionLines(model, cards) {
  const hn = model.home.name;
  const an = model.away.name;
  const phase = model.minute.phase;
  const base = [
    `${hn}和${an}，你押哪一隊？主隊打 1、客隊打 2！`,
    "留言猜今天的比分，賽後我們來看誰最準！",
    "你心中今天的 MVP 會是誰？先留言卡位！",
    "下一顆進球會在幾分鐘出現？猜最接近的人有面子！",
    `如果你是${hn}的教練，現在第一個要換誰？`,
    "今天會不會有紅牌？覺得會的打 +1！",
    "你人在哪裡看比賽？留言報個城市，看看今天哪裡的人最多！",
    "這場比賽你給幾分？1 到 10 分，留言評分！",
    "哪一隊的球衣比較好看？留言投票！",
    "看球配什麼最對味？鹹酥雞還是滷味？"
  ];
  if (phase === "in") base.unshift(`現在比分 ${model.home.score}:${model.away.score}，你覺得終場會變嗎？留言預測！`);
  if (phase === "ft" || model.minute.state === "post") base.unshift(`終場 ${model.home.score}:${model.away.score}，你賽前有猜中嗎？`);
  const asks = [...cards.map((c) => c.ask), ...(EXTRA_ASKS[locale() === "cn" ? "cn" : "tw"] || [])].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const line of [...asks, ...base]) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= CARD_GOAL.ask) break;
  }
  return out;
}

function cardStatusTag(eff) {
  const cls = eff.status === "已查證" ? "tag-val" : eff.status === "需更新" ? "tag-live" : "tag-bad";
  return h("span", { class: cls, title: eff.why || "" }, ui(eff.status));
}

function cardArticle(card) {
  const box = h("article", { class: `cp kcard${card.eff.status !== "已查證" ? " warn-card" : ""}` });
  const art = { append: (...nodes) => box.append(...nodes.filter((n) => n != null && n !== false && n !== "")) };
  art.append(
    h("div", { class: "kc-head" },
      h("span", { class: "pill" }, ui(card.topic)),
      card.auto ? h("span", { class: "pill" }, ui("自動")) : null,
      cardStatusTag(card.eff),
      h("span", { class: "faint" }, ui(card.owner || ""))
    ),
    h("h3", null, ui(card.title)),
    h("p", { class: "kc-fact" }, ui(card.fact)),
    card.eff.why && card.eff.status !== "已查證" ? h("p", { class: "faint warn" }, ui(`⚠ ${card.eff.why}`)) : null,
    h("p", { class: "faint kc-src" }, ui(`來源（查證 ${card.checked}）：`),
      ...(card.sources || []).flatMap((s, i) => [i ? "、" : "", h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.name)]))
  );
  if (card.eff.status === "不可當成事實播報") {
    art.append(h("p", { class: "warn" }, ui("此卡不可當成事實播報，只能當作「傳聞／待證實」提及。")));
  }
  art.append(scriptBlock([card.say], "口語版（20–40 秒）"));
  if (card.humor) {
    art.append(h("div", { class: "kc-humor" },
      h("p", null, h("b", null, ui("輕鬆：")), ui(card.humor.light || "")),
      h("p", null, h("b", null, ui("嗆辣：")), ui(card.humor.spicy || ""))
    ));
  }
  art.append(
    h("p", null, h("b", null, ui("互動：")), ui(card.ask || "")),
    h("div", { class: "chips kc-when" }, (card.when || []).map((w) => h("span", { class: "pill" }, ui(w))))
  );
  return box;
}

function cardsBlock(model) {
  const block = h("section", { class: "block", id: "cards" }, h("h2", null, ui("知識卡")));
  const st = state.cards && state.cards.id === model.id ? state.cards : null;
  if (!st || st.status === "loading") {
    block.append(h("p", { class: "muted" }, ui("讀取知識卡中…")));
    return block;
  }
  const cards = [...st.data.cards, ...(typeof storyCards === "function" ? storyCards(model) : []), ...(typeof teamInfoCards === "function" ? teamInfoCards(model) : [])];
  const g = { team: 0, player: 0, place: 0 };
  for (const c of cards) if (c.eff.status !== "不可當成事實播報") g[cardGroup(c.topic)] += 1;
  const asks = interactionLines(model, cards);
  const need = cards.filter((c) => c.eff.status !== "已查證");
  const prog = (label, n, goal) => h("span", { class: n >= goal ? "prog ok" : "prog" }, ui(`${label} ${Math.min(n, goal)}/${goal}`));
  block.append(h("div", { class: "kc-progress" },
    prog("球隊故事", g.team, CARD_GOAL.team),
    prog("球員故事", g.player, CARD_GOAL.player),
    prog("城市／國家冷知識", g.place, CARD_GOAL.place),
    prog("互動話術", asks.length, CARD_GOAL.ask)
  ));
  const gaps = [];
  if (g.team < CARD_GOAL.team) gaps.push(`球隊故事還缺 ${CARD_GOAL.team - g.team} 張`);
  if (g.player < CARD_GOAL.player) gaps.push(`球員故事還缺 ${CARD_GOAL.player - g.player} 張`);
  if (g.place < CARD_GOAL.place) gaps.push(`城市／國家冷知識還缺 ${CARD_GOAL.place - g.place} 張`);
  if (!st.data.hasFiles) block.append(h("p", { class: "faint" }, ui("這兩隊還沒有建立知識卡，目前只有 ESPN 自動卡。跟 Claude 說「幫○○對○○做知識卡」就會查證後建立，之後遇到同一隊可直接重複使用。")));
  if (gaps.length) block.append(h("p", { class: "faint" }, ui(`本場準備清單：${gaps.join("、")}。`)));
  if (need.length) block.append(h("p", { class: "warn" }, ui(`播報前需更新 ${need.length} 張（多半是球員名單、教練或近期事件），卡片上有標示原因。`)));

  const f = state.cardFilter || { when: "全部", topic: "全部" };
  const chipRow = (list, key) => h("div", { class: "chips" }, ["全部", ...list].map((v) => h("button", {
    class: "chip",
    "aria-pressed": String(f[key] === v),
    onclick: () => { state.cardFilter = { ...f, [key]: v }; maybeRender({ soft: true }); }
  }, ui(v))));
  block.append(h("p", { class: "faint" }, ui("使用時機：")), chipRow(CARD_WHEN, "when"), h("p", { class: "faint" }, ui("主題：")), chipRow(CARD_TOPICS, "topic"));
  const shown = cards.filter((c) => (f.when === "全部" || (c.when || []).includes(f.when)) && (f.topic === "全部" || c.topic === f.topic));
  const order = { "已查證": 0, "需更新": 1, "不可當成事實播報": 2 };
  shown.sort((a, b) => (order[a.eff.status] ?? 3) - (order[b.eff.status] ?? 3));
  if (!shown.length) block.append(h("p", { class: "muted" }, ui("這個篩選條件下沒有卡片。")));
  for (const card of shown) block.append(cardArticle(card));
  block.append(h("h3", null, ui("觀眾互動話術（10 句）")), scriptBlock(asks, "互動話術"));
  return block;
}

async function ensureCards(model) {
  if (state.cards && state.cards.id === model.id && state.cards.status === "ok") return;
  if (state.cards && state.cards.id === model.id && state.cards.status === "loading") return;
  state.cards = { id: model.id, status: "loading" };
  try {
    const data = await loadMatchCards(model);
    state.cards = { id: model.id, status: "ok", data };
  } catch (err) {
    console.error(err);
    state.cards = { id: model.id, status: "ok", data: { cards: autoCards(model).map((c) => ({ ...c, eff: { status: "已查證", why: "" } })), hasFiles: false } };
  }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}
