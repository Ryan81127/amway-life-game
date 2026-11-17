/* motivationAnalyzer：兩隊戰意分析。
   每一句都標「事實」（資料直接給的）、「計算」（由規則算出）或「推測」（合理推論，可能不成立）。
   禁止只靠積分斷言輪換、放水或沒有求勝慾望；沒有名單或可信報導時只能寫「可能輪換，尚待確認」。 */

const mvSched = new Map();

async function ensureTeamSchedule(model) {
  if (mvSched.has(model.id)) return;
  mvSched.set(model.id, { status: "loading" });
  const out = { status: "ok", home: {}, away: {} };
  const kick = new Date(model.kickoff).getTime();
  await Promise.all(["home", "away"].map(async (side) => {
    const id = model[side].id;
    try {
      const [res, fix] = await Promise.all([
        stCached(`${ALL_API}/teams/${id}/schedule`, 600000).catch(() => null),
        stCached(`${ALL_API}/teams/${id}/schedule?fixture=true`, 600000).catch(() => null)
      ]);
      const evs = [...(res?.events || []), ...(fix?.events || [])].map((e) => ({ m: evToMatch(e), league: e.league?.name || e.season?.displayName || "", name: e.name || "" })).filter((x) => x.m);
      const past = evs.filter((x) => new Date(x.m.date).getTime() < kick - 3600000 && x.m.state === "post").sort((a, b) => new Date(b.m.date) - new Date(a.m.date));
      const next = evs.filter((x) => new Date(x.m.date).getTime() > kick + 3600000).sort((a, b) => new Date(a.m.date) - new Date(b.m.date));
      const day = 86400000;
      out[side] = {
        ok: !!(res || fix),
        last: past[0] || null,
        past10: past.slice(0, 10).map((x) => x.m),
        restDays: past[0] ? Math.round((kick - new Date(past[0].m.date).getTime()) / day * 10) / 10 : null,
        next: next[0] || null,
        nextInDays: next[0] ? Math.round((new Date(next[0].m.date).getTime() - kick) / day * 10) / 10 : null,
        in14: past.filter((x) => kick - new Date(x.m.date).getTime() <= 14 * day).length
      };
    } catch { out[side] = { ok: false }; }
  }));
  mvSched.set(model.id, out);
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

/* ---------- 友誼賽：沒有積分榜，改看 FIFA 排名、正式賽程與先發輪換 ---------- */
let mvFifa = null;
const mvRot = new Map();
const FIFA_ALIAS = { "United States": "USA", "South Korea": "Korea Republic", "Korea Republic": "Korea Republic", "Iran": "IR Iran", "Ivory Coast": "Côte d'Ivoire", "Cape Verde": "Cabo Verde", "Turkey": "Türkiye", "Czech Republic": "Czechia", "China": "China PR", "North Korea": "Korea DPR", "Curacao": "Curaçao", "DR Congo": "Congo DR", "Bosnia-Herzegovina": "Bosnia and Herzegovina", "Republic of Ireland": "Republic of Ireland", "Chinese Taipei": "Chinese Taipei", "Kyrgyzstan": "Kyrgyz Republic" };

function mvIsFriendly(model) {
  return /friendly/i.test(model.leagueSlug || "") || /友誼/.test(model.leagueName || "");
}

function mvFifaLoad() {
  if (!mvFifa) {
    mvFifa = { status: "loading" };
    fetch("https://api.fifa.com/api/v3/rankings?gender=1&count=300").then((r) => r.json()).then((j) => {
      const by = new Map();
      for (const x of j.Results || []) {
        by.set(String(x.TeamName?.[0]?.Description || "").toLowerCase(), x);
        by.set(String(x.IdCountry || "").toLowerCase(), x);
      }
      mvFifa = { status: "ok", by, pub: (j.Results?.[0]?.PubDate || "").slice(0, 10) };
    }).catch(() => { mvFifa = { status: "error" }; }).finally(() => { if (state.model) maybeRender({ soft: true }); });
  }
  return mvFifa;
}

function mvFifaOf(team) {
  const f = mvFifaLoad();
  if (f.status !== "ok") return null;
  const name = String(team.rawName || "");
  return f.by.get((FIFA_ALIAS[name] || name).toLowerCase()) || f.by.get(String(team.abbr || "").toLowerCase()) || null;
}

/* 先發輪換：本場先發 vs 這隊上一場先發 */
async function mvRotation(model, side, lastId) {
  const key = model.id + ":" + side;
  if (mvRot.has(key)) return;
  mvRot.set(key, { status: "loading" });
  try {
    const j = await stCached(`${ALL_API}/summary?event=${encodeURIComponent(lastId)}`, 3600000);
    const block = (j.rosters || []).find((r) => String(r.team?.id) === String(model[side].id));
    const st = (block?.roster || []).filter((r) => r.starter);
    const ids = new Set(st.map((r) => String(r.athlete?.id || "")));
    const names = new Map(st.map((r) => [String(r.athlete?.id || ""), typeof playerZh === "function" ? playerZh(r.athlete?.displayName || "") : r.athlete?.displayName || ""]));
    mvRot.set(key, { status: ids.size >= 11 ? "ok" : "none", ids, names, formation: block?.formation || "" });
  } catch { mvRot.set(key, { status: "none" }); }
  if (state.model?.id === model.id) maybeRender({ soft: true });
}

function mvFriendlyItems(model, side, sched) {
  const team = model[side];
  const opp = model[side === "home" ? "away" : "home"];
  const items = [{ tag: "事實", text: "這是國際友誼賽：沒有積分、晉級或降級，輸贏不影響任何排名表（FIFA 排名分數仍會小幅變動）。" }];
  const f = mvFifaLoad();
  const me = mvFifaOf(team);
  const them = mvFifaOf(opp);
  if (me) {
    items.push({ tag: "事實", text: `FIFA 排名第 ${me.Rank}${them ? `，對手 ${opp.name} 第 ${them.Rank}` : ""}（FIFA ${mvFifa.pub} 公布）。` });
    if (them) {
      const gap = me.Rank - them.Rank;
      if (Math.abs(gap) >= 30) items.push({ tag: "推測", text: gap < 0 ? `排名高出對手 ${-gap} 名，這種友誼賽常被拿來試新人或演練戰術。` : `排名落後對手 ${gap} 名，能跟強隊交手本身就是練兵機會，可能派出最強陣容爭取表現。` });
    }
  } else if (f.status === "loading") items.push({ tag: "資料不足", text: "讀取 FIFA 排名中…" });
  else items.push({ tag: "資料不足", text: "FIFA 排名查不到這隊（名稱對不上或資料暫時拿不到）。" });
  const sc = sched?.[side];
  if (sc?.ok) {
    const official = (x) => x && !/friendly|友誼/i.test(`${x.league} ${x.name}`);
    if (sc.next) {
      const nx = official(sc.next) ? sc.next : null;
      items.push({ tag: "事實", text: `下一場：${sc.nextInDays} 天後的 ${sc.next.name}${sc.next.league ? `（${sc.next.league}）` : ""}。` });
      if (nx && sc.nextInDays <= 45) items.push({ tag: "推測", text: `${sc.nextInDays} 天後就是正式比賽，這場很可能是熱身，教練會以調整陣容與避免受傷為優先。` });
    } else items.push({ tag: "資料不足", text: "ESPN 還沒有這隊的下一場賽程，無法判斷是不是大賽前熱身。" });
    if (sc.last) items.push({ tag: "事實", text: `上一場：${sc.last.name}${sc.last.league ? `（${sc.last.league}）` : ""}，距今 ${sc.restDays} 天。` });
  }
  const form = (model.form || []).find((b) => b.id === team.id);
  if (form?.games?.length) {
    const w = form.games.filter((g) => g.result === "W").length;
    const d = form.games.filter((g) => g.result === "D").length;
    items.push({ tag: "計算", text: `近 ${form.games.length} 場 ${w} 勝 ${d} 和 ${form.games.length - w - d} 負。` });
  }
  const starters = model.roster?.[side]?.players?.filter((p) => p.starter) || [];
  if (starters.length >= 11 && sc?.last?.m?.id) {
    const r = mvRot.get(model.id + ":" + side);
    if (!r) mvRotation(model, side, sc.last.m.id);
    if (r?.status === "ok") {
      const same = starters.filter((p) => r.ids.has(String(p.id))).length;
      items.push({ tag: "計算", text: `先發 11 人中有 ${same} 人是上一場的先發。` });
      items.push({ tag: "推測", text: same >= 8 ? "先發變動很小，幾乎是主力陣容，對這場相當認真。" : same <= 5 ? "先發大幅更動，像是在試新人或給替補機會。" : "先發部分輪換，主力與新人混搭。" });
    } else if (r?.status === "none") items.push({ tag: "資料不足", text: "拿不到上一場的先發名單，無法比較輪換幅度。" });
  } else items.push({ tag: "資料不足", text: "先發名單公布後（通常開賽前約 1 小時），會自動比對上一場先發、判斷是不是主力出戰。" });
  return items;
}

function mvStatusText(sit, k, id) {
  const s = sit.status?.get(k)?.get(id);
  if (!s) return null;
  const label = sit.targets.find((t) => t.k === k)?.label || "晉級";
  const zh = { clinched: `數學上已確定${label}`, out: `數學上已無緣${label}`, drawEnough: `平局即可確定${label}`, winEnough: `贏球即確定${label}`, mustWin: `必須取勝才有機會${label}`, needHelp: `${label}需要其他場次配合`, waiting: `自己踢完了，${label}要等其他場次`, alive: `仍有機會${label}`, unknown: `${label}形勢資料不足，無法確認` }[s.code];
  return { code: s.code, text: zh, notes: s.notes || [], label };
}

/* 壓力分數只是把上面的事實換成 0–3 的級距，方便比較兩隊，不是機率。 */
function mvPressure(codes) {
  if (codes.some((c) => c === "mustWin")) return 3;
  if (codes.some((c) => c === "winEnough" || c === "needHelp")) return 2;
  if (codes.some((c) => c === "drawEnough" || c === "alive")) return 1;
  return 0;
}

function motivation(model, sit) {
  const sched = mvSched.get(model.id);
  if (!sched) ensureTeamSchedule(model);
  const res = { ok: sit?.state === "ok", sides: {}, diff: [], tactics: [], signals: [], counter: [], completeness: [] };
  const ti = typeof tiStore !== "undefined" ? tiStore.get(tiKey(model)) : null;
  for (const side of ["home", "away"]) {
    const team = model[side];
    const items = [];
    const codes = [];
    const row = sit?.table?.find((r) => r.id === team.id);
    if (sit?.state === "ok" && row) {
      items.push({ tag: "事實", text: `${sit.isLive ? "即時" : "目前"}排名 ${sit.groupName ? sit.groupName.replace(/^Group /, "") + " 組" : ""}第 ${row.rank}，${row.p} 場 ${row.w} 勝 ${row.d} 和 ${row.l} 負，積 ${row.pts} 分、淨勝球 ${row.gd > 0 ? "+" : ""}${row.gd}。` });
      if (row.zone) items.push({ tag: "事實", text: `這個名次目前落在「${row.zone.label}」（ESPN 積分榜的區域說明）。` });
      for (const tg of sit.targets || []) {
        const st = mvStatusText(sit, tg.k, team.id);
        if (!st) continue;
        codes.push(st.code);
        items.push({ tag: "計算", text: st.text + "。" + (st.notes[0] ? st.notes[0] : "") });
      }
      const left = sit.matchLevel === false ? null : sit.remaining ? sit.remaining.filter((m) => m.home === team.id || m.away === team.id).length + sit.live.filter((m) => m.home === team.id || m.away === team.id).length : null;
      if (left != null) items.push({ tag: "事實", text: `含本場在內，這個階段還剩 ${left} 場。` });
      else if (sit.totalGames) items.push({ tag: "計算", text: `聯賽共 ${sit.totalGames} 輪，還剩 ${Math.max(0, sit.totalGames - row.p)} 場，最多還能拿到 ${row.pts + Math.max(0, sit.totalGames - row.p) * 3} 分。` });
      if (sit.scenarios) {
        const base = sit.baseRank?.get(team.id) ?? row.rank;
        const txt = sit.scenarios.map((sc) => { const r = sc.rows.find((x) => x.id === team.id); return `${sc.label}→第 ${r.rank}`; }).join("；");
        items.push({ tag: "計算", text: `本場結果對名次的影響（其他場次不變）：${txt}（目前第 ${base}）。` });
      }
    } else if (mvIsFriendly(model)) {
      items.push(...mvFriendlyItems(model, side, sched));
      res.sides[side] = { name: team.name, items, codes, pressure: null, row: null, friendly: true };
      continue;
    } else {
      items.push({ tag: "資料不足", text: sit?.why || "沒有積分榜資料，無法由積分判斷壓力。" });
    }
    const sc = sched?.[side];
    if (sc?.ok) {
      if (sc.restDays != null) items.push({ tag: "事實", text: `距離上一場（${sc.last.name}）休息 ${sc.restDays} 天；最近 14 天踢了 ${sc.in14} 場。` });
      if (sc.next) items.push({ tag: "事實", text: `下一場是 ${sc.nextInDays} 天後的 ${sc.next.name}${sc.next.league ? `（${sc.next.league}）` : ""}。` });
      if (sc.restDays != null && sc.restDays < 4) items.push({ tag: "推測", text: "休息不到 4 天，體能是變數；是否輪換要等先發名單，尚待確認。" });
      if (sc.next && sc.nextInDays <= 4 && codes.every((c) => c === "clinched" || c === "out") && codes.length) items.push({ tag: "推測", text: "本場結果不影響主要目標，而且幾天內還有比賽，可能輪換，尚待確認（以先發名單為準）。" });
    } else if (sched && sched.status !== "loading") {
      items.push({ tag: "資料不足", text: "拿不到這隊的賽程，無法計算休息天數與下一場。" });
    }
    if (ti?.status === "ok" && typeof absenceList === "function") {
      const abs = absenceList(model, side, ti);
      const out = abs.filter((x) => x.kind !== "risk");
      const risk = abs.filter((x) => x.kind === "risk");
      if (out.length) items.push({ tag: out.some((x) => x.kind === "infer") ? "推測" : "事實", text: `可能缺陣：${out.slice(0, 4).map((x) => `${x.name}（${x.status}）`).join("、")}。${out.some((x) => x.kind === "infer") ? "其中由名單比對推測的項目需再確認。" : ""}` });
      if (risk.length) items.push({ tag: "事實", text: `黃牌累積偏多：${risk.slice(0, 3).map((x) => x.name).join("、")}，再吃牌有停賽風險。` });
    } else {
      items.push({ tag: "資料不足", text: "傷停與停賽：ESPN 多數賽事沒有提供，需以先發名單或可信報導為準。" });
    }
    const starters = model.roster?.[side]?.players?.filter((p) => p.starter).length || 0;
    items.push(starters >= 11 ? { tag: "事實", text: "先發名單已公布，是否輪換可直接對照陣容區。" } : { tag: "資料不足", text: "先發名單尚未公布，無法確認是否輪換。" });
    res.sides[side] = { name: team.name, items, codes, pressure: codes.length ? mvPressure(codes) : null, row };
  }
  const H = res.sides.home;
  const A = res.sides.away;
  if (H.friendly && A.friendly) {
    const hr = mvFifaOf(model.home);
    const ar = mvFifaOf(model.away);
    if (hr && ar) {
      const hi = hr.Rank < ar.Rank ? H : A;
      res.diff.push({ tag: "計算", text: `FIFA 排名差 ${Math.abs(hr.Rank - ar.Rank)} 名，${hi.name} 排名較高。` });
    }
    res.diff.push({ tag: "推測", text: "友誼賽的戰意主要看三件事：是不是大賽前熱身、教練派不派主力、排名較低的一方想不想藉強敵證明自己。先發名單公布後再看一次最準。" });
  }
  if (H.pressure != null && A.pressure != null) {
    const word = ["結果不影響主要目標", "有目標但壓力不大", "壓力明顯", "背水一戰"];
    res.diff.push({ tag: "計算", text: `積分壓力：${H.name}「${word[H.pressure]}」、${A.name}「${word[A.pressure]}」。` });
    if (H.pressure !== A.pressure) {
      const hi = H.pressure > A.pressure ? H : A;
      const lo = hi === H ? A : H;
      res.diff.push({ tag: "推測", text: `${hi.name}更需要這場的積分，落後或僵持時比較可能提早壓上；${lo.name}可以更有耐心。這只是由積分推論，不代表實際踢法。` });
      res.tactics.push({ tag: "推測", text: `${hi.name}若久攻不下，60 分鐘後可能加派前鋒、兩翼壓上；${lo.name}則可能收縮打反擊。` });
    } else {
      res.diff.push({ tag: "推測", text: "兩隊的積分壓力相近，戰意差異要看場上表現與教練調度。" });
    }
    if ([H, A].some((x) => x.codes.includes("drawEnough"))) {
      const t = [H, A].find((x) => x.codes.includes("drawEnough"));
      res.tactics.push({ tag: "推測", text: `${t.name}平局就夠，比賽後段可能偏保守；但「平局即可」不等於一開始就會守，仍以場上為準。` });
    }
  } else if (!(H.friendly && A.friendly)) {
    res.diff.push({ tag: "資料不足", text: "缺少積分榜或規則資料，無法比較兩隊的積分壓力。" });
  }
  res.signals = [
    "先發名單：主力是否全部上場（開賽前約 1 小時公布）。",
    "開場 15 分鐘的逼搶高度與防線位置。",
    "落後或平手時，第一個換人是換攻擊手還是防守球員。",
    sit?.isLive || sit?.live?.length ? "同組另一場的比分變化（看板會自動重算）。" : "同組其他比賽是否同時開踢（最後一輪通常同時進行）。",
    "70 分鐘後的陣型變化：是否改三後衛、門將是否上前。"
  ];
  if (H.friendly && A.friendly) {
    res.signals = [
      "先發名單：排名較高的一方有沒有派主力，還是大量給新人機會。",
      "換人時機與人數：友誼賽換人名額多，下半場大量換人常讓比賽節奏改變。",
      "排名較低的一方開場是否全力逼搶，想藉強敵證明自己。",
      "領先方是否在下半場放慢節奏、以控球為主。"
    ];
    res.counter = [
      "友誼賽也可能踢得很認真：新教練上任、球員爭取大賽名單時常常特別拚。",
      "FIFA 排名差距大不代表比分一定懸殊，客場長途飛行與氣候也有影響。",
      "教練賽前發言、球員俱樂部賽程與身體狀況，資料裡看不到。"
    ];
    res.completeness = [
      ["FIFA 排名", !!(mvFifaOf(model.home) && mvFifaOf(model.away))],
      ["休息天數與下一場", !!(sched?.home?.ok && sched?.away?.ok)],
      ["先發名單", ["home", "away"].every((s) => (model.roster?.[s]?.players?.filter((p) => p.starter).length || 0) >= 11)],
      ["先發與上一場比對", ["home", "away"].every((s) => mvRot.get(model.id + ":" + s)?.status === "ok")],
      ["教練賽前發言", false]
    ];
    return res;
  }
  res.counter = [
    "積分壓力大不代表踢得好：急躁反而容易失誤、被打反擊。",
    "已確定晉級或無緣的球隊，替補球員為了爭取位置有時反而更拚。",
    "教練賽前發言、更衣室氣氛、獎金或榮譽等因素，資料裡看不到。",
    "同分規則（對戰成績、淨勝球）可能讓「只差一球」的局面完全改變。"
  ];
  res.completeness = [
    ["積分榜與排名", sit?.state === "ok"],
    ["出線規則已建檔", !!sit?.rules],
    ["同組賽程（可逐場計算）", !!sit?.matches],
    ["休息天數與下一場", !!(sched?.home?.ok && sched?.away?.ok)],
    ["先發名單", ["home", "away"].every((s) => (model.roster?.[s]?.players?.filter((p) => p.starter).length || 0) >= 11)],
    ["傷停資料", ti?.status === "ok"],
    ["教練賽前發言", false]
  ];
  return res;
}
