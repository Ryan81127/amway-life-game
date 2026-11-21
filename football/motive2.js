/* 戰意 2：萊恩主播戰意分析體系的單場模板。
   能從既有積分／出線計算得到的，標成「模型判斷」；得不到的標「待主播判斷」，缺的數字寫 X 或 XX，不編造。 */

function m2Tag(kind, text) {
  const cls = kind === "模型判斷" ? "m2-model" : kind === "待主播判斷" ? "m2-wait" : "m2-fact";
  return h("p", { class: "m2-line" }, h("span", { class: `v2-tag ${cls}` }, ui(kind)), ui(text));
}

function m2Codes(sit, id) {
  if (!sit?.status) return [];
  return (sit.targets || []).map((tg) => {
    const s = sit.status.get(tg.k)?.get(id);
    return s ? { k: tg.k, label: tg.label, code: s.code, notes: s.notes || [] } : null;
  }).filter(Boolean);
}

function m2Has(codes, code) {
  return codes.some((x) => x.code === code);
}

function m2Grade(row, codes, zone) {
  if (!row && !codes.length) return null;
  const z = zone?.type;
  if (m2Has(codes, "mustWin") && (z === "relegation" || z === "relplayoff")) {
    return { id: "life", label: "生死戰", why: "必須取勝才有機會，而且目前名次落在降級或保級附加賽區。" };
  }
  if (m2Has(codes, "mustWin")) {
    return { id: "life", label: "生死戰", why: "至少有一個目標是「必須取勝才有機會」。這是積分壓力，不一定是保級對決。" };
  }
  if (row && row.rank <= 2 && codes.some((x) => (x.code === "winEnough" || x.code === "mustWin") && /頭名|冠軍|晉級|升級/.test(x.label))) {
    return { id: "title", label: "爭冠關鍵輪", why: "頭名或晉級仍要靠贏球。小組出線不等於聯賽爭冠，口播時請改成這項賽事的說法。" };
  }
  const settled = codes.length > 0 && codes.every((x) => x.code === "clinched" || x.code === "out");
  if (settled) {
    return { id: "none", label: "無欲無求輪", why: "已計算的目標都是「已確定」或「已無緣」，積分壓力是最低一級。這不代表場上一定不會拚。" };
  }
  return null;
}

function m2Scenario(grade, codes, model, side) {
  const phase = model.minute?.phase;
  const live = phase && phase !== "pre" && phase !== "ft" && model.minute?.state !== "post";
  const hs = Number(model.home.score);
  const as = Number(model.away.score);
  const losing = live && Number.isFinite(hs) && Number.isFinite(as) && (side === "home" ? hs < as : as < hs);
  if (losing && m2Has(codes, "mustWin")) return "D";
  if (m2Has(codes, "mustWin")) return "A";
  if (m2Has(codes, "drawEnough")) return "B";
  if (grade?.id === "none") return "C";
  return null;
}

function m2Ou(grade, codes, zone) {
  if (m2Has(codes, "drawEnough") && !m2Has(codes, "mustWin")) return { id: "hold", text: "較接近「拿一分即達標」：可以接受平局，節奏可能主動放慢。保平不等於只會退守。" };
  if (zone?.type === "relegation" || zone?.type === "relplayoff") return { id: null, text: "名次在保級區。保級隊第一優先常常是不失球，不能直接當成被迫冒險的大球。" };
  if (m2Has(codes, "mustWin") || grade?.id === "life") return { id: "risk", text: "有「必須取勝」的目標，形態上偏向被迫冒險；開局仍可能先穩，大小球要等破門之後再看。" };
  if (grade?.id === "none") return { id: "hold", text: "積分壓力最低，較接近主動降速，但替補想表現時會不穩定。" };
  return null;
}

function m2Outcome(sc, side) {
  const hs = Number(sc.hs);
  const as = Number(sc.as);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  const result = hs === as ? "draw" : hs > as ? "home" : "away";
  if (result === "draw") return "draw";
  if (side === "home") return result === "home" ? "win" : "loss";
  return result === "away" ? "win" : "loss";
}
function m2RankAfter(sit, teamId, side, kind) {
  if (!sit?.scenarios) return null;
  const matches = sit.scenarios.filter((sc) => m2Outcome(sc, side) === kind);
  if (!matches.length) return null;
  const ranks = matches.map((sc) => sc.rows.find((x) => x.id === teamId)?.rank).filter((n) => n != null);
  if (!ranks.length || new Set(ranks).size !== 1) return null;
  const label = matches.length === 1 ? matches[0].label : "這幾種比分都還是這個結果";
  return { rank: ranks[0], label };
}

function m2Value(kind, codes, grade) {
  if (kind === "win" && m2Has(codes, "mustWin")) return "回報壓倒性：非贏不可才有機會達標。越關鍵，開局可能越拘謹。";
  if (kind === "win" && m2Has(codes, "winEnough")) return "贏球就能確定目標，進攻意願會拉高，但仍可能先求穩。";
  if (kind === "draw" && m2Has(codes, "drawEnough")) return "平局即達標。手握主動權，但不代表只會退守。";
  if (kind === "loss" && m2Has(codes, "mustWin")) return "輸球就達不成這個目標。落後之後比較可能全線壓上。";
  if (kind === "loss" && grade?.id === "none") return "已計算的目標不受這場輸贏影響，輸球代價在積分上可承受。替補是否放鬆，資料看不到。";
  if (kind === "win" && grade?.id === "none") return "主要目標已經定案，贏球的積分回報有限。是否刻意避頭名，要看下一輪對手，這裡沒有對陣表。";
  return null;
}

function m2Profile(model, sit, side) {
  const team = model[side];
  const row = sit?.state === "ok" ? sit.table?.find((r) => r.id === team.id) : null;
  const codes = row ? m2Codes(sit, team.id) : [];
  const zone = row?.zone || null;
  const grade = m2Grade(row, codes, zone);
  return {
    side, team, row, codes, zone, grade,
    scenario: m2Scenario(grade, codes, model, side),
    ou: m2Ou(grade, codes, zone)
  };
}

function m2Gate(title, body) {
  return h("div", { class: "m2-gate" }, h("h4", null, ui(title)), body);
}

function m2Gates(p) {
  const { row, codes, zone } = p;
  const top = codes.find((x) => /頭名|冠軍/.test(x.label)) || codes.find((x) => x.k === 1);
  const gate1 = !row ? m2Tag("待主播判斷", "沒有積分榜，頭名資格無法計算。")
    : top?.code === "clinched" ? m2Tag("模型判斷", `「${top.label}」在數學上已經確定，就算輸球也穩。大輪換要等先發名單。`)
    : top?.code === "drawEnough" ? m2Tag("模型判斷", `打平就能確定「${top.label}」。優先可能是保不失，不會一開始就全線壓上。`)
    : top?.code === "winEnough" || top?.code === "mustWin" ? m2Tag("模型判斷", `要確定「${top.label}」，贏球是關鍵（${top.code === "mustWin" ? "必須取勝才有機會" : "贏球即可確定"}）。`)
    : m2Tag("待主播判斷", row.rank === 1 ? "目前排第一，但規則沒有算出「輸了是否仍穩第一」。" : "這項目標的頭名門檻沒有算死，請主播依賽制補一句。");
  const adv = codes.find((x) => /晉級|出線|升級|十六|八強|附加/.test(x.label)) || codes[0];
  const gate2 = !adv ? m2Tag("待主播判斷", "沒有出線或升級目標的計算結果。")
    : adv.code === "mustWin" ? m2Tag("模型判斷", `「${adv.label}」非贏不可才有機會。落後後可能堆前鋒。`)
    : adv.code === "drawEnough" ? m2Tag("模型判斷", `「${adv.label}」平局就能達標，教練可能優先保平。`)
    : adv.code === "clinched" ? m2Tag("模型判斷", `「${adv.label}」已經確定。若沒有額外排名獎勵，才談得上輪換。`)
    : adv.code === "out" ? m2Tag("模型判斷", `「${adv.label}」在數學上已經無緣。`)
    : m2Tag("待主播判斷", `「${adv.label}」${({ needHelp: "還要其他場次配合", waiting: "要等其他場次", alive: "仍有機會，但門檻還沒算死", unknown: "資料不足，無法確認", winEnough: "贏球即可確定" })[adv.code] || "還不能收成非贏不可或保平即可"}。`);
  const gate3 = zone?.type === "relegation" || zone?.type === "relplayoff"
    ? m2Tag("模型判斷", `名次落在「${zone.label}」。保級隊多半先求不失球，時間不夠才壓上。`)
    : zone?.type === "advance" || zone?.type === "europe"
      ? m2Tag("模型判斷", `名次落在「${zone.label}」。是不是每一分都要命，還要看上面的出線計算，不能只靠區域名稱。`)
      : m2Tag("待主播判斷", row ? "積分榜沒有標成爭冠、歐戰或保級區，這關請主播自己定。" : "沒有分區資料。");
  const gate4 = m2Tag("待主播判斷", "贏球會不會抽到更強的下一輪對手，看板沒有對陣籤表，不能當成已經發生。");
  return h("div", null, m2Gate("1. 頭名資格", gate1), m2Gate("2. 晉級門檻", gate2), m2Gate("3. 保級、爭冠、歐戰", gate3), m2Gate("4. 晉級後的對手權益", gate4));
}

function m2Margin(p, sit) {
  const kinds = [["win", "贏"], ["draw", "平"], ["loss", "輸"]];
  return h("div", { class: "table-wrap" }, h("table", { class: "v2-table m2-table" },
    h("thead", null, h("tr", null, ["結果", "算得出的名次", "邊際價值"].map((x) => h("th", null, ui(x))))),
    h("tbody", null, kinds.map(([kind, label]) => {
      const after = m2RankAfter(sit, p.team.id, p.side, kind);
      const value = m2Value(kind, p.codes, p.grade);
      return h("tr", null,
        h("td", null, ui(label)),
        h("td", null, after ? ui(`模型判斷：${after.label} → 第 ${after.rank}`) : ui("待主播判斷（X）")),
        h("td", { class: "stt" }, ui(value ? "模型判斷：" + value : "待主播判斷")));
    }))));
}

function m2Rotation(model, side) {
  const sched = typeof mvSched !== "undefined" ? mvSched.get(model.id)?.[side] : null;
  const starters = model.roster?.[side]?.players?.filter((p) => p.starter).length || 0;
  const dense = sched?.ok && ((sched.restDays != null && sched.restDays < 4) || (sched.in14 != null && sched.in14 >= 3));
  return h("ul", { class: "v2-list" },
    h("li", null, m2Tag("待主播判斷", "單後腰或防守核心有沒有缺陣：名單沒有標出這個角色，不能從人數推測體系斷了。")),
    h("li", null, m2Tag("待主播判斷", "出球中衛或組織後腰有沒有缺陣：同樣要等主播看先發位置。")),
    h("li", null, m2Tag("待主播判斷", "唯一支點中鋒有沒有缺陣：看板沒有這個標籤。")),
    h("li", null, m2Tag("待主播判斷", "豪門替補和中下游替補的差距，不能用名氣直接套。請對照這場先發，不要把輪換人數當成小球。")),
    dense
      ? h("li", null, m2Tag("模型判斷", `賽程偏密：距離上一場 ${sched.restDays == null ? "X" : sched.restDays} 天，近 14 天 ${sched.in14 == null ? "X" : sched.in14} 場。可能以控制節奏為主，進球預期下修；角球要看是倒腳控場還是圍攻打不穿。`))
      : h("li", null, m2Tag(sched?.ok ? "模型判斷" : "待主播判斷", sched?.ok ? `休息 ${sched.restDays == null ? "X" : sched.restDays} 天、近 14 天 ${sched.in14 == null ? "X" : sched.in14} 場，還不到「密集到必須留力」的門檻。` : "拿不到賽程，密集賽程這項無法計算。")),
    h("li", null, starters >= 11 ? m2Tag("事實", "先發已公布，輪換請直接對照陣容，不要用這張表代替名單。") : m2Tag("待主播判斷", typeof lineupMissingText === "function" ? lineupMissingText(model) : "先發還沒公布，輪換先不要下結論。")));
}

const M2_SCENES = [
  ["A", "非贏不可", "開局高壓、邊路下底。大小球偏大，但對方死守時會狂射不進。角球容易拉高。"],
  ["B", "保平即可", "降速、少冒險。大小球偏小，角球偏少。"],
  ["C", "無欲無求／大輪換", "強度下滑。多數偏小，偶爾因為漏洞跑出大球。角球偏低。"],
  ["D", "落後才開始拼命", "前段平淡，比分打開以後後段容易爆進球。"],
  ["E", "刻意避頭名", "實力夠但收著踢。資料沒有下一輪籤表，這張卡不能由模型自動選中。"]
];

function m2Corners(home, away, model) {
  const trailing = (p) => p.scenario === "D";
  const bothMust = home.scenario === "A" && away.scenario === "A";
  const bothCold = home.grade?.id === "none" && away.grade?.id === "none";
  const cards = [
    ["1", "落後方追分", "落後的一方持續傳中，角球會堆在追分的那一邊。角球變多代表攻不進去，不是必進球。", trailing(home) || trailing(away)],
    ["2", "雙方背水一戰", "兩邊都非贏不可時，角球整體容易拉高。", bothMust],
    ["3", "無欲無求、節奏收縮", "刻意放慢就不會憑空多出角球。只有對攻時，角球和進球才會一起走高。", bothCold]
  ];
  const hs = model.stats?.home?.wonCorners;
  const as = model.stats?.away?.wonCorners;
  const fact = hs != null && as != null ? m2Tag("事實", `目前角球 ${model.home.name} ${hs}、${model.away.name} ${as}。這只是場上數字，不是戰意已經兌現。`) : null;
  return h("div", null,
    h("p", { class: "m2-quote" }, ui("角球不是進攻強，是進攻受阻。")),
    fact,
    ...cards.map(([n, title, text, on]) => h("div", { class: on ? "m2-card on" : "m2-card" },
      h("h4", null, ui(`情境 ${n}　${title}`), on ? h("span", { class: "v2-tag m2-model" }, ui("模型判斷")) : h("span", { class: "v2-tag m2-wait" }, ui("未套用"))),
      h("p", null, ui(text)))));
}

function m2Script(model, sit, p, other) {
  const name = p.team.name;
  const pts = p.row ? String(p.row.pts) : "X";
  const rank = p.row ? String(p.row.rank) : "X";
  const win = m2RankAfter(sit, p.team.id, p.side, "win");
  const draw = m2RankAfter(sit, p.team.id, p.side, "draw");
  const loss = m2RankAfter(sit, p.team.id, p.side, "loss");
  const line = model.odds?.spread?.home?.pre?.line ?? model.odds?.spread?.home?.live?.line;
  const odds = line == null || typeof fmtHandicap !== "function" ? null : `${model.home.name} ${fmtHandicap(line)}`;
  const bits = [
    `我們先看積分形勢：${name}目前排名第 ${rank}、積分 ${pts}。`,
    win ? `模型判斷：贏球之後（${win.label}）名次是第 ${win.rank}。` : "贏球之後的名次：待主播判斷（X）。",
    draw ? `模型判斷：打平之後（${draw.label}）名次是第 ${draw.rank}。` : "打平之後的名次：待主播判斷（X）。",
    loss ? `模型判斷：輸球之後（${loss.label}）名次是第 ${loss.rank}。` : "輸球之後的名次：待主播判斷（X）。",
    p.grade ? `模型判斷：這場對${name}比較接近「${p.grade.label}」。` : `這場對${name}屬於哪一種戰意：待主播判斷。`,
    other?.grade ? `對手${other.team.name}比較接近「${other.grade.label}」。` : `對手的戰意類型：待主播判斷。`,
    p.scenario === "A" ? "預期上可能從開局就施壓，邊路和角球偏高；若對方死守，上半場仍可能沉悶。" : "預期的跑動和角球先不要講死。",
    odds ? `現在盤口給出的是 ${odds}。這是資料上的讓球，不是戰意已經被證實。` : "現在盤口給出的是 XX（這場沒有讀到讓球盤）。",
    "開局若只有盤口熱度、跑動保守，要小心走小球；開場就持續圍攻，大球的機會才比較像會打開。以上都是模板，不是定論。"
  ];
  return bits;
}

function m2Summary(home, away) {
  const rows = [
    ["非贏不可", "全力壓上", "高", "偏高", "偏大"],
    ["保平即可", "保守控場", "中等偏低", "偏少", "偏小"],
    ["無欲無求／輪換", "強度下降", "低", "偏低", "多偏小、不穩定"],
    ["輸球就出局", "先守後衝", "後段爆發", "後期拉高", "下半場容易大"],
    ["刻意控分避頭名", "收著踢", "刻意壓低", "偏低", "偏小"]
  ];
  const picked = (p) => p.scenario === "A" ? "非贏不可" : p.scenario === "B" ? "保平即可" : p.scenario === "C" ? "無欲無求／輪換" : p.scenario === "D" ? "輸球就出局" : null;
  return h("div", null,
    h("div", { class: "table-wrap" }, h("table", { class: "v2-table m2-table" },
      h("thead", null, h("tr", null, ["戰意類型", "策略", "進攻意願", "角球", "大小球傾向"].map((x) => h("th", null, ui(x))))),
      h("tbody", null, rows.map((r) => h("tr", null, r.map((c) => h("td", { class: "stt" }, ui(c)))))))),
    m2Tag(picked(home) ? "模型判斷" : "待主播判斷", `${home.team.name}對上表：${picked(home) || "沒有自動對上某一列"}。`),
    m2Tag(picked(away) ? "模型判斷" : "待主播判斷", `${away.team.name}對上表：${picked(away) || "沒有自動對上某一列"}。`));
}

function motive2View(model) {
  const sit = v2Sit(model);
  const block = h("section", { class: "block", id: "v2-motive2" }, h("h2", null, ui("戰意 2")));
  if (sit.state === "loading") {
    block.append(h("p", { class: "muted" }, ui("讀取積分形勢中…")));
    return block;
  }
  if (typeof motivation === "function" && sit.state === "ok") motivation(model, sit);
  const home = m2Profile(model, sit, "home");
  const away = m2Profile(model, sit, "away");
  block.append(h("p", { class: "faint" }, ui("戰意不是「想不想贏」，而是贏、平、輸分別能拿到什麼。標「模型判斷」的句子只根據積分和規則，不是事實；標「待主播判斷」的格子沒有可靠資料，數字用 X 或 XX，不編造。")));

  block.append(h("h3", null, ui("一、晉級形勢四關卡")));
  const two = h("div", { class: "v2-two" });
  for (const p of [home, away]) {
    two.append(h("div", { class: "st-panel" }, h("h3", { class: "st-h" }, ui(p.team.name)), m2Gates(p)));
  }
  block.append(two);

  block.append(h("h3", null, ui("二、戰意分級")));
  block.append(h("p", { class: "faint" }, ui("四個等級：生死戰、德比尊嚴戰、爭冠關鍵輪、無欲無求輪。德比沒有資料，不會自動選。")));
  for (const p of [home, away]) {
    block.append(h("div", { class: "m2-card" }, h("h4", null, ui(p.team.name)),
      p.grade ? m2Tag("模型判斷", `比較接近「${p.grade.label}」。${p.grade.why}`) : m2Tag("待主播判斷", "現有積分計算對不上這四個等級，請主播自己定。"),
      m2Tag("待主播判斷", "是不是德比或尊嚴戰，看板看不出來。")));
  }
  block.append(h("p", { class: "m2-quote" }, ui("先問這場球對雙方各值幾分「必須拿分」。一邊很高、一邊很低，盤口卻開得很平衡，就要警惕誘導。這句是口播提醒，不是這場已經發生的事。")));

  block.append(h("h3", null, ui("三、贏、平、輸的邊際價值")));
  for (const p of [home, away]) block.append(h("h4", null, ui(p.team.name)), m2Margin(p, sit));

  block.append(h("h3", null, ui("四、輪換與體系斷層")));
  block.append(h("p", { class: "faint" }, ui("不是「換人就小球」，要看體系有沒有斷。下面五項，只有賽程密度能用休息天數計算。")));
  for (const p of [home, away]) block.append(h("h4", null, ui(p.team.name)), m2Rotation(model, p.side));

  block.append(h("h3", null, ui("五、大小球映射")));
  block.append(h("p", null, ui("有戰意不一定大球。看的是表現形態：被迫冒險，還是拿一分就達標。")));
  for (const p of [home, away]) {
    block.append(p.ou ? m2Tag("模型判斷", `${p.team.name}：${p.ou.text}`) : m2Tag("待主播判斷", `${p.team.name}：被迫冒險或拿一分達標，現有資料對不上，請主播選。`));
  }
  const rel = [home, away].find((p) => p.zone?.type === "relegation" || p.zone?.type === "relplayoff");
  const cold = [home, away].find((p) => p !== rel && p.grade?.id === "none");
  block.append(rel && cold
    ? m2Tag("模型判斷", `修正參考：${rel.team.name}在保級區、${cold.team.name}積分壓力最低時，預期進球可以上調 0.2。這是模板係數，不是這場的預測進球。`)
    : m2Tag("待主播判斷", "「保級對無欲、進球預期 +0.2」這條，兩隊沒有同時對上，不套用。"));
  const strongRest = [home, away].find((p) => p.grade?.id === "none");
  block.append(m2Tag("待主播判斷", "「強隊留力、進球預期 -0.5」要先確認是不是在為另一項賽事留人。休息天數不夠用來發明這 0.5。" + (strongRest ? ` ${strongRest.team.name}的積分壓力較低，只能先記下來。` : "")));
  block.append(h("p", { class: "faint" }, ui("基本面和盤口明顯背離時，先檢查戰意形態有沒有看錯。")));

  block.append(h("h3", null, ui("六、角球映射")));
  block.append(m2Corners(home, away, model));
  block.append(h("p", { class: "m2-quote" }, ui("先看誰必須壓上，再看是邊路傳中還是中路滲透。傳中多、受阻多，角球才會多。")));

  block.append(h("h3", null, ui("七、狀況 A 到 E")));
  block.append(h("p", { class: "faint" }, ui("每隊亮出最接近的一張。E「刻意避頭名」沒有籤表，不會自動亮。保級隊不等於一定猛攻；頭號種子也未必想贏。")));
  for (const p of [home, away]) {
    block.append(h("h4", null, ui(p.team.name)));
    block.append(h("div", { class: "m2-scenes" }, M2_SCENES.map(([id, title, text]) => h("div", { class: p.scenario === id ? "m2-card on" : "m2-card" },
      h("h4", null, ui(`狀況 ${id}　${title}`), p.scenario === id ? h("span", { class: "v2-tag m2-model" }, ui("模型判斷")) : null),
      h("p", null, ui(text))))));
    if (!p.scenario) block.append(m2Tag("待主播判斷", "沒有自動選中 A 到 D。"));
  }

  block.append(h("h3", null, ui("八、三步法則、盤口對照、開場驗證")));
  block.append(h("ol", { class: "v2-list" },
    h("li", null, ui("第一步，定等級：誰必須拿分、誰可以接受任何結果。上面的戰意分級就是這一步，沒標模型判斷的請主播補。")),
    h("li", null, ui("第二步，定形態：誰被迫壓上、誰可以收縮打反擊。先講空間，不先喊大小球。")),
    h("li", null, ui("第三步，對盤口：讓幅不足或退水，可能是質疑攻堅；深開但戰意和陣容都不匹配，要警惕名氣誘盤。戰意強但盤口不確認，優先相信盤口。"))));
  const ouLine = model.odds?.total?.over?.pre?.line ?? model.odds?.total?.over?.live?.line;
  block.append(ouLine == null ? m2Tag("待主播判斷", "理論大小球盤口是 XX，這場沒有讀到。") : m2Tag("事實", `資料上的大小球線是 ${trimNum(ouLine)}。這不是模型預測的進球數。`));
  block.append(h("p", null, ui("開場 10 到 15 分鐘看三件事：有沒有高壓前壓、邊路有沒有持續下底、角球和射門是否符合剛才的戰意。")),
    m2Tag("待主播判斷", "這三項要看直播，頁面不代替這 15 分鐘。盤口強但強度跟不上，是假熱度；盤口偏弱但開場就圍攻，才像戰意兌現。"));

  block.append(h("h3", null, ui("九、口播模板")));
  const script = [...m2Script(model, sit, home, away), ...m2Script(model, sit, away, home)];
  if (typeof scriptBlock === "function") block.append(scriptBlock(script, "戰意 2 口播"));
  else block.append(h("div", { class: "script" }, script.map((line) => h("p", null, ui(line)))));

  block.append(h("h3", null, ui("十、快速總結表")));
  block.append(m2Summary(home, away));

  block.append(h("h3", null, ui("十一、終極提醒")));
  block.append(h("p", null, ui("戰意是前提，不是單一答案。需要什麼結果，不代表一定踢成那樣。中間還有陣容、體能、教練取捨、對手風格。直播不必給出絕對的大小球或角球，把邏輯和不確定講清楚就好。")));
  block.append(h("p", { class: "m2-quote" }, ui("這場不是贏越多越好。若拿第一反而碰上更強的下一輪對手，目標就可能只是剛好出線。這句只有在主播確認籤表之後才用，模型沒有自動套用。")));
  block.append(h("p", { class: "faint" }, ui("依萊恩主播戰意分析體系模板。理性購彩、未成年人不得購彩。")));
  return block;
}
