/* NBA 知識卡：自動數據卡 + 城市／球隊冷知識 + 可擴充的 cards/teams/{id}.json。 */

const CARD_GOAL = { team: 5, player: 5, place: 5, ask: 10 };
const WHEN_ZH = { open: "開場", timeout: "暫停", half: "中場", cold: "冷場", post: "賽後" };
const STATUS_ZH = { verified: "已查證", update: "需更新", nofact: "不可當事實播報" };
const TOPIC_ZH = { team: "球隊", player: "球員", city: "城市", country: "國家", culture: "文化", trivia: "趣聞" };

/* 球隊由來：status 一律「需更新」，播前請點來源複核 */
const TEAM_LORE = {
  1: ["老鷹隊前身是 1946 年的三城黑鷹，一路搬過密爾瓦基、聖路易，1968 年才落腳亞特蘭大。", "搬家次數比很多人換工作還多。"],
  2: ["塞爾提克是 1946 年成立的元老球隊，名字來自波士頓大量的愛爾蘭裔移民，吉祥物是愛爾蘭小精靈。", "綠色不是環保，是祖傳。"],
  3: ["鵜鶘隊 2013 年才改用現名，鵜鶘是路易斯安那州的州鳥。", "州鳥當隊名，連鳥都有代言費。"],
  4: ["公牛隊 1966 年成立，九〇年代拿下兩次三連霸，是很多人認識 NBA 的起點。", "很多人的童年就是一件紅色 23 號球衣。"],
  5: ["騎士隊 1970 年加入聯盟，隊名是當年球迷投票選出來的。", "隊名是球迷投票來的，比很多選舉還有參與感。"],
  6: ["獨行俠 1980 年加入聯盟，隊名同樣由球迷票選，取自德州牛仔的獨行精神。", "德州人連隊名都要自己闖。"],
  7: ["金塊隊的名字跟 19 世紀科羅拉多淘金熱有關，主場海拔約一英里，客隊常說空氣比較稀薄。", "客隊來這裡，第一件事是先學會呼吸。"],
  8: ["活塞隊前身是韋恩堡活塞，老闆經營活塞工廠，1957 年搬到汽車城底特律剛好對味。", "工廠名當隊名，最早期的置入行銷。"],
  9: ["勇士隊 1946 年在費城成立，1962 年搬到西岸，2019 年起主場在舊金山大通中心。", "從東岸搬到西岸，時差都調了半世紀。"],
  10: ["火箭隊 1967 年在聖地牙哥成立，1971 年搬到休士頓，正好呼應當地的太空中心。", "名字取得早，搬家後反而更貼切。"],
  11: ["溜馬隊名來自印第安納波利斯 500 賽車的傳統，Pacer 是賽車場上的前導車。", "籃球隊用賽車梗，跨界跨得很自然。"],
  12: ["快艇隊 1970 年從水牛城起家，經過聖地牙哥，1984 年搬到洛杉磯。", "快艇在洛杉磯跟湖人當室友很多年。"],
  13: ["湖人隊名來自明尼蘇達「萬湖之州」，1960 年搬到洛杉磯後名字就留下來了。", "洛杉磯湖不多，但湖人很多。"],
  14: ["熱火隊 1988 年加入聯盟，主場在比斯坎灣旁邊。", "邁阿密的熱，連隊名都直接寫出來。"],
  15: ["公鹿隊 1968 年成立，隊名是當年球迷票選，象徵威斯康辛常見的白尾鹿。", "鹿很多，冠軍也有。"],
  16: ["灰狼隊 1989 年加入聯盟，明尼蘇達是美國本土灰狼數量最多的州之一。", "冬天零下二十度，灰狼都比我們耐寒。"],
  17: ["籃網隊 2012 年從紐澤西搬到布魯克林巴克萊中心。", "從紐澤西搬到布魯克林，房租漲了不少。"],
  18: ["尼克隊是 1946 年元老球隊，主場麥迪遜廣場花園被稱為「籃球聖地」。", "在花園打球，連板凳都比較貴。"],
  19: ["魔術隊 1989 年加入聯盟，名字呼應奧蘭多的主題樂園。", "奧蘭多最不缺的就是魔法。"],
  20: ["76人隊名來自 1776 年在費城簽署的美國獨立宣言。", "隊名直接是一堂美國歷史課。"],
  21: ["太陽隊 1968 年加入聯盟，鳳凰城夏天常常超過攝氏 40 度。", "這裡的太陽是真的會曬傷人。"],
  22: ["拓荒者 1970 年加入聯盟，主場球迷口號是「Rip City」。", "Rip City 一喊，全場都醒了。"],
  23: ["國王隊歷史可追溯到 1923 年的羅徹斯特，是 NBA 歷史最悠久的球隊之一，1985 年搬到沙加緬度。", "這支隊伍的歷史比很多國家的憲法還長。"],
  24: ["馬刺隊前身是 ABA 的達拉斯牛仔，1973 年搬到聖安東尼奧，1976 年隨 ABA 合併加入 NBA。", "從 ABA 來的，帶著一股西部牛仔味。"],
  25: ["雷霆隊前身是西雅圖超音速，2008 年搬到奧克拉荷馬市。", "西雅圖球迷到現在還在等超音速回來。"],
  26: ["爵士隊 1974 年在紐奧良成立，1979 年搬到鹽湖城，爵士樂隊名就這樣留了下來。", "鹽湖城的爵士樂，聽起來有點不搭但很經典。"],
  27: ["巫師隊 1997 年前叫子彈隊，改名是為了避免槍枝暴力的聯想。", "改名之後，魔法取代了火藥。"],
  28: ["暴龍隊 1995 年加入聯盟，是目前唯一一支加拿大球隊，隊名取自當年《侏羅紀公園》熱潮。", "一部電影改變一支球隊的名字。"],
  29: ["灰熊隊 1995 年在溫哥華成立，2001 年搬到曼菲斯。", "灰熊從加拿大搬到美國南方，換了氣候也換了口味。"],
  30: ["黃蜂隊 1988 年加入聯盟，2014 年才把黃蜂隊名拿回來。", "名字被借走十幾年，最後還是回家了。"]
};

const CITY_FACTS = {
  1: ["亞特蘭大是可口可樂的總部所在地。", "亞特蘭大機場是全球旅客量最大的機場之一。"],
  2: ["波士頓有全美第一條地鐵，1897 年通車。", "波士頓馬拉松是全世界歷史最悠久的年度馬拉松之一。"],
  3: ["紐奧良是爵士樂的發源地。", "紐奧良的嘉年華（Mardi Gras）遊行每年吸引大量觀光客。"],
  4: ["芝加哥是摩天大樓的發源地之一。", "芝加哥厚片披薩（Deep Dish）是當地招牌美食。"],
  5: ["克里夫蘭是搖滾名人堂的所在地。", "克里夫蘭位在伊利湖畔，冬天湖效應雪非常驚人。"],
  6: ["達拉斯是 1963 年甘迺迪遇刺的城市。", "德州烤肉（BBQ）在達拉斯是信仰等級。"],
  7: ["丹佛海拔約 1,609 公尺，剛好一英里，有「一英里高城」之稱。", "丹佛一年有超過 300 天晴天的說法很有名。"],
  8: ["底特律有「汽車城」之稱，福特、通用、克萊斯勒都起家於此。", "摩城唱片（Motown）也誕生在底特律。"],
  9: ["舊金山金門大橋 1937 年通車。", "舊金山灣區是矽谷的所在地。"],
  10: ["休士頓有 NASA 詹森太空中心，「休士頓，我們有麻煩了」就是對這裡說的。", "休士頓是美國人口第四多的城市。"],
  11: ["印第安納波利斯 500 是全球最知名的賽車比賽之一。", "印第安納州是美國高中籃球最瘋狂的州之一。"],
  12: ["洛杉磯好萊塢是全球電影產業中心。", "洛杉磯兩度主辦奧運，2028 年將第三度主辦。"],
  13: ["洛杉磯好萊塢星光大道上有超過 2,700 顆星星。", "洛杉磯塞車塞到當地人用「分鐘」而不是「公里」算距離。"],
  14: ["邁阿密南灘的裝飾藝術建築非常有名。", "邁阿密是拉丁美洲文化在美國最濃的城市之一。"],
  15: ["密爾瓦基以啤酒釀造聞名。", "哈雷機車總部就在密爾瓦基。"],
  16: ["明尼蘇達號稱「萬湖之州」，實際湖泊超過一萬個。", "美國購物中心（Mall of America）就在明尼亞波利斯旁。"],
  17: ["布魯克林大橋 1883 年通車，是全世界最早的鋼索吊橋之一。", "布魯克林如果獨立成一座城市，人口會是全美前幾名。"],
  18: ["紐約時代廣場每年跨年降球是全球直播的活動。", "紐約地鐵 24 小時營運。"],
  19: ["奧蘭多有迪士尼世界和環球影城，是全球主題樂園之都。", "奧蘭多每年觀光客人數是全美數一數二。"],
  20: ["費城起司牛肉堡（Cheesesteak）是在地招牌。", "美國獨立宣言 1776 年在費城簽署，自由鐘也在這裡。"],
  21: ["鳳凰城夏天高溫常超過攝氏 40 度。", "大峽谷就在鳳凰城所在的亞利桑那州。"],
  22: ["波特蘭有「玫瑰之城」的稱號。", "波特蘭以獨立咖啡店和精釀啤酒聞名。"],
  23: ["沙加緬度是加州的首府。", "淘金熱時期，沙加緬度是重要的補給站。"],
  24: ["聖安東尼奧的阿拉莫要塞是德州歷史地標。", "聖安東尼奧河濱步道是熱門觀光景點。"],
  25: ["奧克拉荷馬市國家紀念館紀念 1995 年爆炸案的罹難者。", "奧克拉荷馬州是美國龍捲風最常見的地區之一。"],
  26: ["鹽湖城 2002 年主辦冬季奧運。", "大鹽湖是西半球最大的鹹水湖。"],
  27: ["華盛頓特區是美國首都，白宮和國會山莊都在這裡。", "史密森尼博物館群大多免費參觀。"],
  28: ["多倫多 CN 塔曾經是全世界最高的獨立結構物。", "籃球的發明人奈史密斯是加拿大人。"],
  29: ["曼菲斯是貓王故居雅園（Graceland）的所在地。", "曼菲斯烤肉和藍調音樂非常有名。"],
  30: ["夏洛特有 NASCAR 名人堂。", "夏洛特是美國第二大的銀行業中心。"]
};

function wikiUrl(q) {
  return "https://zh.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(q);
}

function staticCards(model) {
  const out = [];
  const today = taipeiYmd(new Date());
  for (const side of ["home", "away"]) {
    const t = model[side];
    const lore = TEAM_LORE[Number(t.id)];
    if (lore) out.push({ id: `lore-${t.id}`, topic: "team", title: `${t.name}名字的由來`, fact: lore[0], sources: [{ name: "維基百科", url: wikiUrl(t.rawName || t.name) }], checked: "", say: `${lore[0]}${lore[1]}`, humor: { light: lore[1], spicy: `所以今晚${t.name}打不好，可以怪祖先取錯名字嗎？` }, ask: `你知道${t.name}名字的由來嗎？知道的扣 1！`, when: ["open", "timeout"], status: "update", note: "依公開常識整理，播前請點來源複核" });
    const city = CITY_FACTS[Number(t.id)] || [];
    city.forEach((fact, i) => out.push({ id: `city-${t.id}-${i}`, topic: "city", title: `${TEAM_CITY[Number(t.id)] || ""}冷知識`, fact, sources: [{ name: "維基百科", url: wikiUrl(TEAM_CITY[Number(t.id)] || t.rawName) }], checked: "", say: `來點${TEAM_CITY[Number(t.id)]}的冷知識：${fact}`, humor: { light: `下次去${TEAM_CITY[Number(t.id)]}，記得幫我打卡。`, spicy: `${t.name}今晚要是輸球，我就只記得這個冷知識了。` }, ask: `有去過${TEAM_CITY[Number(t.id)]}的朋友嗎？留言分享！`, when: i ? ["cold", "half"] : ["timeout", "cold"], status: "update", note: "城市常識，播前可複核" }));
  }
  if (model.venue) out.push({ id: `venue-${model.id}`, topic: "city", title: `今晚球場：${model.venue}`, fact: `今晚比賽在 ${model.venue}${model.city ? "（" + model.city + "）" : ""} 進行${model.attendance ? "，現場觀眾 " + model.attendance.toLocaleString() + " 人" : ""}。`, sources: [{ name: "ESPN", url: `https://www.espn.com/nba/game/_/gameId/${model.id}` }], checked: today, say: `今晚的戰場在 ${model.venue}，主場球迷的聲音會不會影響比賽，我們等等看！`, humor: { light: "主場的地板，連彈跳都比較有利（大概）。", spicy: "客隊今晚要對抗的不只是對手，還有一萬多個人的噓聲。" }, ask: "你最想去哪一座 NBA 球館看現場？", when: ["open"], status: "verified" });
  return out;
}

function autoCards(model) {
  const out = [];
  const today = taipeiYmd(new Date());
  const src = [{ name: "ESPN", url: `https://www.espn.com/nba/game/_/gameId/${model.id}` }];
  for (const side of ["home", "away"]) {
    const t = model[side];
    const st = model.standings?.[side];
    if (t.record || st) {
      const fact = `${t.name} 本季戰績 ${t.record || `${st?.w}-${st?.l}`}${st ? `，${st.conf}第 ${st.rank}${st.streak ? "，目前 " + st.streak.replace("W", "連勝 ").replace("L", "連敗 ") : ""}` : ""}${t.split ? `；${side === "home" ? "主場" : "客場"} ${t.split}` : ""}。`;
      out.push({ id: `rec-${t.id}`, topic: "team", title: `${t.name} 本季走勢`, fact, sources: src, checked: today, say: fact + (st?.streak?.startsWith("W") ? "手感正熱，今晚想延續。" : st?.streak?.startsWith("L") ? "最近卡關，今晚急需一場勝利止血。" : ""), humor: { light: st?.streak?.startsWith("W") ? "連勝中的球隊，走路都有風。" : "戰績這種東西，今晚可以重新寫。", spicy: st?.streak?.startsWith("L") ? "再輸下去，球迷要開始寫陳情書了。" : "贏球的時候，什麼都對。" }, ask: `${t.name} 今晚能不能${st?.streak?.startsWith("L") ? "止敗" : "續勝"}？扣 1 能、扣 2 不能！`, when: ["open"], status: "verified" });
    }
    const f = formOf(model, side);
    if (f) {
      const g = f.games.map((x) => `${x.result === "W" ? "勝" : "負"}${x.opp}${x.pf}-${x.pa}`).join("、");
      out.push({ id: `form-${t.id}`, topic: "team", title: `${t.name} 近 ${f.n} 場`, fact: `${t.name} 近 ${f.n} 場 ${f.w} 勝 ${f.n - f.w} 負，平均得 ${trimNum(f.pts)} 失 ${trimNum(f.allow)}：${g}。`, sources: src, checked: today, say: `${t.name}最近 ${f.n} 場 ${f.w} 勝，平均每場${f.diff >= 0 ? "贏" : "輸"} ${trimNum(Math.abs(f.diff))} 分。`, humor: { light: f.w >= 4 ? "最近狀態好到可以去買樂透。" : "最近狀態……我們先不提。", spicy: f.w <= 1 ? "最近的比賽，球迷看了都想退票。" : "這數據放在履歷上很好看。" }, ask: `${t.name}最近的狀態你給幾分？`, when: ["open", "timeout"], status: "verified" });
    }
    const imp = (model.injuries[side] || []).filter((i) => /Out|Doubtful|Questionable|Day/i.test(i.status));
    if (imp.length) {
      out.push({ id: `inj-${t.id}`, topic: "team", title: `${t.name} 傷兵名單`, fact: imp.slice(0, 4).map((i) => `${i.name}（${i.statusZh}${i.part ? "，" + i.part : ""}${i.ret ? "，預計 " + i.ret.slice(5).replace("-", "/") + " 回歸" : ""}）`).join("、") + "。", sources: src, checked: today, say: `${t.name}今晚的傷兵：${imp.slice(0, 3).map((i) => `${i.name}${i.statusZh}`).join("、")}。輪換會怎麼調整，是今晚的看點。`, humor: { light: "醫護室比更衣室還熱鬧。", spicy: "傷兵名單長到可以組一隊打全明星賽了。" }, ask: "傷兵影響有多大？覺得會影響勝負的扣 1！", when: ["open", "half"], status: imp.some((i) => /Questionable|Day/i.test(i.status)) ? "update" : "verified", note: "出賽狀態賽前一小時可能變動" });
    }
    for (const l of model.leaders[side] || []) {
      if (!l.name) continue;
      const key = /points/i.test(l.key) ? "得分" : /assists/i.test(l.key) ? "助攻" : /rebounds/i.test(l.key) ? "籃板" : l.label;
      out.push({ id: `ldr-${t.id}-${l.key}`, topic: "player", player: l.name, title: `${l.name}：${t.name}${key}王`, fact: `${l.name} 是 ${t.name} 本場資料中的${key}領先者，數據 ${l.display}。`, sources: src, checked: today, say: `${t.name}${key}最穩的就是 ${l.name}，${l.display}。今晚對手要怎麼限制他，是比賽關鍵。`, humor: { light: `${l.name}的${key}，穩定到可以拿去設鬧鐘。`, spicy: `對手的防守計畫第一頁應該只寫了他的名字。` }, ask: `${l.name}今晚${key}會超過平均嗎？扣 1 會！`, when: ["open", "timeout"], status: "verified" });
    }
  }
  const ser = model.series;
  if (ser?.summary) out.push({ id: `ser-${model.id}`, topic: "team", title: "本季對戰", fact: `本季交手：${ser.summary.replace(/leads series/i, "系列賽領先").replace(/series tied/i, "系列賽打平")}（本季共 ${ser.total} 次交手）。`, sources: src, checked: today, say: `兩隊本季已經交手過，${ser.summary.replace(/leads series/i, "目前系列賽領先").replace(/series tied/i, "系列賽打平")}，今晚是復仇戰還是續寫劇本？`, humor: { light: "老朋友見面，分外眼紅。", spicy: "上一場輸的那隊，今晚應該連熱身都在生氣。" }, ask: "今晚誰會贏下這次交手？", when: ["open"], status: "verified" });
  for (const a of model.news.slice(0, 3)) out.push({ id: `news-${a.url || a.title}`, topic: "trivia", title: "賽前新聞（英文原文）", fact: a.title, sources: [{ name: "ESPN 新聞", url: a.url }], checked: (a.at || "").slice(0, 10), say: `賽前消息：${a.title}`, humor: { light: "賽前新聞看一下，賽後才知道誰說中了。", spicy: "新聞寫得很熱鬧，球場上見真章。" }, ask: "這則消息你怎麼看？", when: ["open"], status: "update", note: "英文標題，請先確認翻譯再播" });
  return out;
}

const cardFileCache = new Map();
async function loadTeamFile(id) {
  if (cardFileCache.has(id)) return cardFileCache.get(id);
  let cards = [];
  try {
    const res = await fetch(`cards/teams/${id}.json`, { cache: "no-cache" });
    if (res.ok) cards = (await res.json()).cards || [];
  } catch { /* 沒有檔案就算了 */ }
  cardFileCache.set(id, cards);
  return cards;
}

async function loadMatchCards(model) {
  const [h, a] = await Promise.all([loadTeamFile(model.home.id), loadTeamFile(model.away.id)]);
  return [...h, ...a];
}

function ttlDays(topic) {
  return topic === "player" ? 60 : topic === "team" ? 180 : topic === "trivia" ? 365 : 730;
}

function effectiveStatus(c) {
  if (c.status === "verified" && c.checked) {
    const age = (Date.now() - new Date(c.checked + "T00:00:00+08:00")) / 86400000;
    if (age > ttlDays(c.topic)) return "update";
  }
  return c.status || "update";
}

function interactionLines(model) {
  const H = model.home.name;
  const A = model.away.name;
  return [
    `今晚 ${H} 還是 ${A}？主隊扣 1、客隊扣 2！`,
    ...EXTRA_ASKS
  ].slice(0, 10);
}

function allCards(model) {
  const seen = new Set();
  return [...(state.cards || []), ...autoCards(model), ...staticCards(model)].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function cardArticle(c) {
  const st = effectiveStatus(c);
  return h("article", { class: `kcard st-${st}` },
    h("div", { class: "kc-top" },
      h("span", { class: "pill" }, ui(TOPIC_ZH[c.topic] || c.topic)),
      h("strong", null, ui(c.title)),
      h("span", { class: `kst ${st}` }, ui(STATUS_ZH[st] || st))
    ),
    h("p", { class: "kfact" }, ui(c.fact)),
    c.say ? scriptBlock([c.say], "口語版（20–40 秒）") : null,
    c.humor ? h("p", { class: "khumor" }, h("b", null, ui("輕鬆：")), ui(c.humor.light), h("br"), h("b", null, ui("嗆辣：")), ui(c.humor.spicy)) : null,
    c.ask ? h("p", { class: "kask" }, ui("互動：" + c.ask)) : null,
    h("p", { class: "faint kmeta" },
      ui("時機：" + (c.when || []).map((w) => WHEN_ZH[w] || w).join("、")),
      " · ",
      ...(c.sources || []).flatMap((s, i) => [i ? "、" : "", s.url ? h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name) : s.name]),
      c.checked ? ` · ${ui("查證")} ${c.checked}` : "",
      c.note ? ` · ${ui(c.note)}` : ""
    )
  );
}

function cardsBlock(model) {
  const cards = allCards(model);
  const asks = interactionLines(model);
  const count = {
    team: cards.filter((c) => c.topic === "team").length,
    player: cards.filter((c) => c.topic === "player").length,
    place: cards.filter((c) => ["city", "country", "culture", "trivia"].includes(c.topic)).length,
    ask: asks.length
  };
  const f = state.cardFilter || "all";
  const shown = cards.filter((c) => f === "all" || (c.when || []).includes(f) || c.topic === f || (f === "place" && ["city", "country", "culture", "trivia"].includes(c.topic)));
  const chips = [["all", "全部"], ["team", "球隊"], ["player", "球員"], ["place", "城市／趣聞"], ["open", "開場"], ["timeout", "暫停"], ["half", "中場"], ["cold", "冷場"], ["post", "賽後"]];
  const body = h("div", { class: "kgrid" }, shown.map(cardArticle));
  return h("section", { class: "panel", id: "cards" },
    h("h2", null, ui("知識卡")),
    h("p", { class: "faint" }, ui(`本場準備：球隊故事 ${count.team}/${CARD_GOAL.team}、球員故事 ${count.player}/${CARD_GOAL.player}、城市冷知識 ${count.place}/${CARD_GOAL.place}、互動話術 ${count.ask}/${CARD_GOAL.ask}`)),
    h("div", { class: "chips" }, chips.map(([id, label]) => h("button", { class: "chip", "aria-pressed": String(f === id), onclick: () => { state.cardFilter = id; maybeRender({ soft: true }); } }, ui(label)))),
    body,
    h("details", { class: "fold" }, h("summary", null, ui(`觀眾互動話術 ${asks.length} 句`)), scriptBlock(asks, "互動話術"))
  );
}
