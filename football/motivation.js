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
  } else {
    res.diff.push({ tag: "資料不足", text: "缺少積分榜或規則資料，無法比較兩隊的積分壓力。" });
  }
  res.signals = [
    "先發名單：主力是否全部上場（開賽前約 1 小時公布）。",
    "開場 15 分鐘的逼搶高度與防線位置。",
    "落後或平手時，第一個換人是換攻擊手還是防守球員。",
    sit?.isLive || sit?.live?.length ? "同組另一場的比分變化（看板會自動重算）。" : "同組其他比賽是否同時開踢（最後一輪通常同時進行）。",
    "70 分鐘後的陣型變化：是否改三後衛、門將是否上前。"
  ];
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
