/* commentaryGenerator：主播口播產生器（規則模板，不呼叫 AI）。
   每一句事實都來自 standings／qualify／motivation 的計算結果；沒有資料的段落直接不產生。
   風格只影響開場、銜接與收尾的語氣，不改變事實內容。
   之後若要接 AI（DeepSeek 等），只需把 cmFacts() 的輸出交給後端改寫，前端不放金鑰。 */

const CM_STYLES = {
  mix: { name: "預設混合", open: ["兄弟們，", "來，看一下形勢：", "這場有意思了，"], close: ["你們怎麼看？留言聊聊！", "覺得誰能拿下的，扣個 1！", "形勢就是這樣，我們繼續看。"] },
  pro: { name: "專業分析", open: ["先看積分形勢。", "從數據來看，", "整理一下目前的局面："], close: ["以上是目前的客觀形勢。", "後續變化我們持續追蹤。"] },
  casual: { name: "生活口語", open: ["兄弟們，", "跟大家說一下，", "簡單講，"], close: ["就是這麼回事，懂了吧？", "所以這場真的不能隨便踢。", "你們覺得呢？留言跟我說。"] },
  hype: { name: "熱血激情", open: ["兄弟們注意了！", "關鍵時刻來了！", "這就是足球！"], close: ["這場誰都輸不起！", "精彩一起看，熱鬧一起喊！", "接下來每一球都是生死球！"] },
  fun: { name: "幽默互動", open: ["兄弟們，算數時間到，", "別看現在領先，", "計算機拿出來，"], close: ["算不清楚沒關係，看球就對了，押誰的留言！", "這積分榜比我的感情還複雜。扣 1 讓我知道你還在！", "誰晉級？留言押一個，賽後對答案！"] },
  brief: { name: "精簡即時", open: [""], close: [""] }
};
const CM_LEN = { 15: 70, 30: 135, 60: 260 };

function cmPick(arr, seed) {
  if (!arr.length) return "";
  let k = 7;
  for (const ch of String(seed)) k = (k * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[k % arr.length];
}

function cmStatusLine(sit, id, name) {
  if (sit?.state !== "ok" || !sit.status) return "";
  const lines = [];
  for (const tg of sit.targets || []) {
    const s = mvStatusText(sit, tg.k, id);
    if (s && s.code !== "alive" && s.code !== "unknown") { lines.push(`${name}${s.text}`); break; }
  }
  return lines[0] ? lines[0] + "。" : "";
}

/* 依比賽階段整理出各段落的事實句（重要的排前面）。 */
function cmFacts(model, sit, mot) {
  const H = model.home.name;
  const A = model.away.name;
  const phase = model.minute?.phase;
  const done = phase === "ft" || model.minute?.state === "post";
  const live = !done && phase !== "pre";
  const out = [];
  const ok = sit?.state === "ok";
  const row = (id) => (ok ? sit.table.find((r) => r.id === id) : null);
  const rh = row(model.home.id);
  const ra = row(model.away.id);
  const grp = ok && sit.groupName ? sit.groupName.replace(/^Group /, "") + " 組" : "";
  const rowLine = (n, r) => `${n}${grp && sit.rules?.type === "groups" ? `在 ${grp}排` : "排"}第 ${r.rank}、積 ${r.pts} 分`;
  const hs = Number(model.home.score) || 0;
  const as = Number(model.away.score) || 0;

  if (phase === "pre") {
    if (rh && ra) out.push({ id: "standing", title: "兩隊積分與排名", facts: [
      `${rowLine(H, rh)}，${rowLine(A, ra)}。`,
      `${H} ${rh.p} 場 ${rh.w} 勝 ${rh.d} 和 ${rh.l} 負、淨勝球 ${rh.gd > 0 ? "+" : ""}${rh.gd}；${A} ${ra.w} 勝 ${ra.d} 和 ${ra.l} 負、淨勝球 ${ra.gd > 0 ? "+" : ""}${ra.gd}。`,
      rh.zone ? `${H}目前在「${rh.zone.label}」的位置。` : "", ra.zone ? `${A}目前在「${ra.zone.label}」的位置。` : ""
    ] });
    const cond = [cmStatusLine(sit, model.home.id, H), cmStatusLine(sit, model.away.id, A)].filter(Boolean);
    if (ok && sit.scenarios) {
      const sc = sit.scenarios;
      const r = (i, id) => sc[i].rows.find((x) => x.id === id).rank;
      cond.push(`如果${H}贏球會排到第 ${r(0, model.home.id)}，${A}贏球則升到第 ${r(2, model.away.id)}；打平的話${H}第 ${r(1, model.home.id)}、${A}第 ${r(1, model.away.id)}。`);
    }
    if (ok && sit.rules) cond.push(`這項賽事同分時的比較順序是：${tiebreakText(sit.rules).split(" → ").slice(0, 3).join("、")}。`);
    if (cond.length) out.push({ id: "stakes", title: "本場重要性與晉級條件", facts: cond });
    if (mot?.diff?.length) out.push({ id: "motivation", title: "雙方戰意差異", facts: mot.diff.filter((x) => x.tag !== "資料不足").map((x) => (x.tag === "推測" ? "從積分來看，" + x.text : x.text)).concat(mot.tactics.map((x) => x.text)) });
    const forms = ["home", "away"].map((s) => (typeof coachProfile === "function" ? coachProfile(model, s)?.form : "") || model.roster?.[s]?.formation || "");
    if (forms[0] || forms[1]) out.push({ id: "shape", title: "可能的陣型與安排", facts: [
      `${forms[0] ? `${H}近期最常用 ${forms[0]}` : ""}${forms[0] && forms[1] ? "，" : ""}${forms[1] ? `${A}最常用 ${forms[1]}` : ""}，實際陣型以開賽前的先發名單為準。`
    ] });
  }

  if (live) {
    const lead = hs === as ? null : hs > as ? "home" : "away";
    const st = [];
    st.push(`現在 ${model.minute.label || ""}，${H} ${hs} 比 ${as} ${A}。`);
    if (rh && ra && sit.matches) {
      st.push(`照目前比分，${rowLine(H, rh)}，${rowLine(A, ra)}。`);
      for (const side of ["home", "away"]) {
        const r = side === "home" ? rh : ra;
        const n = model[side].name;
        if (r.rank > sit.mainK) {
          const g = sit.goalsNeeded(model[side].id);
          st.push(g ? `${n}目前在晉級線外，其他場次不變的話，還要再進 ${g} 球才能擠進前 ${sit.mainK}。` : `${n}目前在晉級線外，光靠自己進球還不夠，需要其他場次幫忙。`);
        } else if (r.tied?.length) st.push(`${n}和${r.tied.map(sit.nameOf).join("、")}各項都相同，名次要靠公平競賽分等決定，資料不足。`);
      }
      if (lead === null) {
        const dr = ["home", "away"].filter((s) => sit.status?.get(sit.mainK)?.get(model[s].id)?.raw?.clinchIf?.D);
        if (dr.length) st.push(`平局對${dr.map((s) => model[s].name).join("和")}有利：維持平手就足以確定前 ${sit.mainK}。`);
      }
    } else if (ok && sit.scenarios) {
      const cur = sit.scenarios[1];
      st.push(`照目前比分算，${H}排到第 ${cur.rows.find((x) => x.id === model.home.id).rank}、${A}第 ${cur.rows.find((x) => x.id === model.away.id).rank}（同輪其他比賽未計）。`);
    }
    out.push({ id: "state", title: "目前比分對誰有利", facts: st });

    if (ok && sit.nextGoal?.length) {
      const f = [];
      for (const g of sit.nextGoal) {
        const drops = g.changes.filter((c) => c.drops).map((c) => sit.nameOf(c.id));
        const enters = g.changes.filter((c) => c.enters).map((c) => sit.nameOf(c.id));
        if (!drops.length && !enters.length) continue;
        const other = g.match !== model.id;
        f.push(`${other ? "隔壁場" : ""}如果${sit.nameOf(g.scorer)}再進一球，${enters.length ? enters.join("、") + "會升進晉級區" : ""}${enters.length && drops.length ? "，" : ""}${drops.length ? drops.join("、") + "會掉出晉級區" : ""}。`);
      }
      if (!f.length) f.push("下一球不管誰進，晉級區的球隊暫時都不會變。");
      out.push({ id: "nextgoal", title: "下一球與同組連動", facts: f });
      const others = sit.live.filter((m) => m.id !== model.id);
      if (others.length) out.push({ id: "other", title: "同組另一場", facts: others.map((m) => `隔壁場傳來消息：${sit.nameOf(m.home)} ${m.hs} 比 ${m.as} ${sit.nameOf(m.away)}${m.simulated ? "（手動輸入的比分）" : ""}。`) });
    }
    const min = model.minute.period >= 2 ? Math.max(45, model.minute.base || 45) : model.minute.base || 0;
    if (min >= 65) {
      const left = Math.max(0, 90 - min);
      const need = ["home", "away"].filter((s) => { const r = s === "home" ? rh : ra; return r && sit.matches && r.rank > sit.mainK; }).map((s) => model[s].name);
      out.push({ id: "clock", title: "時間壓力", facts: [
        `正規時間只剩大約 ${left} 分鐘。`,
        need.length ? `${need.join("和")}必須在剩下的時間改變比分，接下來可能會加派攻擊手、冒險壓上。` : lead ? `${model[lead].name}領先，接下來的重點是控制節奏、減少失誤。` : "目前平手，先進球的一方將掌握主動。",
        min >= 85 ? "注意傷停補時，最後幾分鐘常常是改變積分榜的時候。" : ""
      ] });
    }
    const reds = (model.events || []).filter((e) => e.kind === "red");
    if (reds.length) out.push({ id: "red", title: "紅牌後的調整", facts: [`場上已經出現 ${reds.length} 張紅牌，少一人的球隊通常會撤下一名前鋒補強防線，多一人的一方控球會明顯增加。`] });
  }

  if (done) {
    const f = [`終場 ${H} ${hs} 比 ${as} ${A}。`];
    if (rh && ra) f.push(`賽後${rowLine(H, rh)}，${rowLine(A, ra)}。`);
    f.push(cmStatusLine(sit, model.home.id, H), cmStatusLine(sit, model.away.id, A));
    out.push({ id: "result", title: "最終排名與晉級結果", facts: f });
    const saved = typeof loadPrediction === "function" ? loadPrediction(model.id) : null;
    if (saved?.top) {
      const fav = Object.entries(saved.top).sort((a, b) => b[1] - a[1])[0];
      const actual = hs > as ? "home" : hs < as ? "away" : "draw";
      const zh = { home: `${H}勝`, away: `${A}勝`, draw: "和局" };
      out.push({ id: "review", title: "賽前預測覆盤", facts: [
        `賽前模型最看好「${zh[fav[0]]}」，機率 ${pct(fav[1])}；實際結果是${zh[actual]}，${fav[0] === actual ? "符合預期" : "與預期不同"}。`,
        `賽前預期進球 ${fx(saved.lh)} 比 ${fx(saved.la)}，實際 ${hs} 比 ${as}。`
      ] });
    }
    const sch = typeof mvSched !== "undefined" ? mvSched.get(model.id) : null;
    const nx = ["home", "away"].map((s) => (sch?.[s]?.next ? `${model[s].name}下一場是 ${sch[s].nextInDays} 天後的 ${sch[s].next.name}` : "")).filter(Boolean);
    if (nx.length) out.push({ id: "next", title: "下一場展望", facts: [nx.join("；") + "。"] });
  }
  return out.map((s) => ({ ...s, facts: s.facts.filter(Boolean) })).filter((s) => s.facts.length);
}

function cmCompose(section, style, secs, seed) {
  const st = CM_STYLES[style] || CM_STYLES.mix;
  const budget = CM_LEN[secs] || 135;
  const open = cmPick(st.open, seed + section.id + "o");
  const close = secs >= 30 ? cmPick(st.close, seed + section.id + "c") : "";
  let body = "";
  for (const f of section.facts) {
    if (body && (open + body + f + close).length > budget) break;
    body += f;
  }
  return (open + body + (close ? close : "")).trim();
}
