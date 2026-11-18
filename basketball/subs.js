/* 籃球輪換：場上五人、每次換人（幾號誰換誰、先發或替補、位置）、換人後的變數。
   跟足球看板的「輪換」同一套做法：下拉選隊、比賽中最新在上、每次更新自動重算。 */

const bsPick = new Map();
const BS_POS = { G: "後衛", PG: "控球後衛", SG: "得分後衛", F: "前鋒", SF: "小前鋒", PF: "大前鋒", C: "中鋒", "G-F": "後衛／前鋒", "F-G": "前鋒／後衛", "F-C": "前鋒／中鋒", "C-F": "中鋒／前鋒" };

function bsSize(pos) {
  const p = String(pos || "").toUpperCase();
  if (/C/.test(p)) return 3;
  if (/F/.test(p)) return 2;
  if (/G/.test(p)) return 1;
  return 2;
}

function bsPeriodLabel(m, per) {
  return per > 4 ? `OT${per - 4 > 1 ? per - 4 : ""}` : `Q${per}`;
}

function bsSubs(m) {
  const players = new Map();
  for (const side of ["home", "away"]) for (const p of m.box?.players?.[side] || []) players.set(p.id, { p, side });
  const subs = [];
  /* 換人當下的個人得分與犯規（不是終場數字） */
  const run = new Map();
  const cur = (id) => { if (!run.has(id)) run.set(id, { pts: 0, pf: 0 }); return run.get(id); };
  for (const pl of m.plays || []) {
    if (!pl.sub) {
      if (pl.playerId && pl.score && pl.value) cur(pl.playerId).pts += pl.value;
      if (pl.playerId && pl.foul) cur(pl.playerId).pf += 1;
      continue;
    }
    const [inId, outId] = pl.ids || [];
    const a = players.get(inId);
    const b = players.get(outId);
    const side = pl.side || a?.side || b?.side;
    if (!side) continue;
    const snap = (p) => (p ? { ...p, pts: cur(p.id).pts, pf: cur(p.id).pf } : null);
    subs.push({ side, period: pl.period, clock: pl.clock, t: pl.t, pin: snap(a?.p), pout: snap(b?.p), hs: pl.hs, as: pl.as, text: pl.text });
  }
  return subs;
}

/* 依先發＋換人順序推出目前場上五人 */
function bsOnCourt(m, side, subs) {
  const on = new Set((m.box?.players?.[side] || []).filter((p) => p.starter).map((p) => p.id));
  for (const s of subs) {
    if (s.side !== side) continue;
    if (s.pout) on.delete(s.pout.id);
    if (s.pin) on.add(s.pin.id);
  }
  const by = new Map((m.box?.players?.[side] || []).map((p) => [p.id, p]));
  return [...on].map((id) => by.get(id)).filter(Boolean);
}

function bsNotes(m, s) {
  const notes = [];
  const team = m[s.side].name;
  const me = s.side === "home" ? s.hs : s.as;
  const opp = s.side === "home" ? s.as : s.hs;
  const late = s.period >= 4 && clockSecLeft(s.clock) <= 300;
  if (s.pout?.pf >= 5 || (s.pout?.pf >= 3 && s.period <= 2) || (s.pout?.pf >= 4 && s.period === 3)) notes.push(`${s.pout.name} 已經 ${s.pout.pf} 次犯規，換下是為了避免犯滿，${team}這個位置防守會比較保守。`);
  if (s.pin && s.pout) {
    const d = bsSize(s.pin.pos) - bsSize(s.pout.pos);
    if (d > 0) notes.push(`換上的人比較高大（${BS_POS[s.pin.pos] || s.pin.pos} 換 ${BS_POS[s.pout.pos] || s.pout.pos}），陣容變大，籃板與護框加強，但速度與外線可能下降。`);
    else if (d < 0) notes.push(`換成較矮小的球員（${BS_POS[s.pin.pos] || s.pin.pos} 換 ${BS_POS[s.pout.pos] || s.pout.pos}），走小球路線，節奏可能加快、外線出手變多。`);
    else notes.push("同位置互換，戰術大致不變，主要是輪替休息。");
    if (s.pout.starter && !s.pin.starter) notes.push(late ? "關鍵時刻先發換替補，可能是防守或犯規戰術的調整。" : "先發下場休息、替補上場，這段是板凳陣容的考驗。");
    if (!s.pout.starter && s.pin.starter) notes.push(late ? "先發回到場上，準備決戰。" : "先發主力回到場上。");
  }
  if (s.pout?.pts >= (s.period <= 2 ? 10 : 15)) notes.push(`${s.pout.name} 這時已經拿 ${s.pout.pts} 分正有手感，換下會讓進攻少一個主要火力點。`);
  if (Number.isFinite(me) && Number.isFinite(opp) && late && Math.abs(me - opp) <= 6) notes.push(`第四節最後 5 分鐘、比分 ${me}:${opp} 只差 ${Math.abs(me - opp)} 分，這是關鍵時刻陣容的調整。`);
  if (!notes.length) notes.push("例行輪替，可以觀察接下來 2 分鐘的得分走勢。");
  return notes;
}

function clockSecLeft(clock) {
  const [mm, ss] = String(clock || "0:0").split(":").map(Number);
  return (mm || 0) * 60 + (ss || 0);
}

function bsWho(p) {
  if (!p) return "未列名";
  return `${p.jersey ? p.jersey + " 號 " : ""}${p.name}`;
}

function bsRow(m, s) {
  const notes = bsNotes(m, s);
  const tag = (p) => p ? `${BS_POS[p.pos] || p.pos || "位置不明"}・${p.starter ? "先發" : "替補"}｜換人時 ${p.pts} 分 ${p.pf} 犯` : "";
  const person = (p, cls, arrow) => h("div", { class: `sub-p ${cls}` }, h("div", { class: "sub-arrow" }, arrow),
    h("div", null,
      h("div", { class: "sub-name" }, p?.jersey ? h("span", { class: "sub-no" }, p.jersey) : null, ui(p?.name || "未列名")),
      p?.en && p.en !== p.name ? h("div", { class: "faint" }, p.en) : null,
      h("div", { class: "sub-meta" }, ui(tag(p)))));
  const me = s.side === "home" ? s.hs : s.as;
  const opp = s.side === "home" ? s.as : s.hs;
  const say = `${bsPeriodLabel(m, s.period)} ${s.clock}，${m[s.side].name}換人：${bsWho(s.pout)}下場，換上 ${bsWho(s.pin)}。${notes[0]}`;
  const copy = h("button", { class: "copy" }, ui("複製口播"));
  copy.addEventListener("click", () => copyText(say, copy));
  return h("div", { class: "sub-card" },
    h("div", { class: "sub-head" }, h("b", null, `${bsPeriodLabel(m, s.period)} ${s.clock}`), h("span", null, ui(m[s.side].name)), Number.isFinite(me) ? h("span", { class: "faint" }, ui(`比分 ${me}:${opp}`)) : null),
    h("div", { class: "sub-pair" }, person(s.pout, "out", "⬇"), person(s.pin, "in", "⬆")),
    h("div", { class: "sub-var" }, h("div", { class: "st-label" }, ui("對場上的影響（推測）")), h("ul", null, notes.map((x) => h("li", null, ui(x))))),
    h("p", { class: "say" }, ui(say)), copy);
}

function bsSubsBlock(m) {
  const sec = h("section", { class: "panel", id: "subs" }, h("h2", null, ui("🔄 輪換")));
  if (m.status.phase === "pre") {
    sec.append(h("p", { class: "muted" }, ui("比賽開始後會顯示：兩隊場上五人、每次換人（誰換誰、先發或替補、位置）與對場上的影響。")));
    return sec;
  }
  if (!(m.box?.players?.home || []).length) {
    sec.append(h("p", { class: "muted" }, ui("資料不足：這個聯賽的來源沒有球員名單與換人紀錄。")));
    return sec;
  }
  const subs = bsSubs(m);
  const live = m.status.phase !== "ft";
  const pick = bsPick.get(m.id) || "home";
  const n = (side) => subs.filter((s) => s.side === side).length;
  const sel = h("select", { class: "sub-select", "aria-label": "選擇球隊", onchange: (e) => { bsPick.set(m.id, e.target.value); e.target.blur(); maybeRender({ soft: true }); } },
    [["home", `🏠 主隊 ${m.home.name}（換人 ${n("home")} 次）`], ["away", `✈️ 客隊 ${m.away.name}（換人 ${n("away")} 次）`], ["all", `兩隊全部（共 ${subs.length} 次）`]]
      .map(([v, t]) => h("option", { value: v, selected: pick === v }, ui(t))));
  sec.append(h("div", { class: "sub-bar" }, sel, h("span", { class: `sub-live ${live ? "on" : ""}` }, ui(live ? "● 即時更新中" : "完賽紀錄"))));
  if (live) sec.append(h("p", { class: "faint" }, ui("比賽中跟著看板自動更新；ESPN 約比電視慢 30–90 秒。最新的換人排在最上面。")));
  for (const side of pick === "all" ? ["home", "away"] : [pick]) {
    const court = bsOnCourt(m, side, subs);
    const bench = (m.box.players[side] || []).filter((p) => !p.starter && !p.dnp);
    sec.append(h("h3", null, ui(`${side === "home" ? "🏠" : "✈️"} ${m[side].name}${live ? "　場上五人" : "　終場時場上五人"}`)),
      h("div", { class: "court-five" }, court.map((p) => h("div", { class: "court-p" },
        h("b", null, p.jersey ? `#${p.jersey}` : ""), " ", ui(p.name),
        h("div", { class: "faint" }, ui(`${BS_POS[p.pos] || p.pos || ""}・${p.starter ? "先發" : "替補"}｜${p.min} 分鐘 ${p.pts} 分 ${p.pf} 犯`))))),
      h("p", { class: "faint" }, ui(`已上場 ${(m.box.players[side] || []).filter((p) => !p.dnp).length} 人；板凳得分 ${bench.reduce((a, p) => a + p.pts, 0)} 分。`)));
    let mine = subs.filter((s) => s.side === side);
    if (live) mine = mine.slice().reverse();
    if (!mine.length) { sec.append(h("p", { class: "faint" }, ui("還沒有換人。"))); continue; }
    const shown = mine.slice(0, 12);
    for (const s of shown) sec.append(bsRow(m, s));
    if (mine.length > shown.length) sec.append(h("p", { class: "faint" }, ui(`另有 ${mine.length - shown.length} 次較早的換人未顯示。`)));
  }
  sec.append(h("p", { class: "faint" }, ui("場上五人由先發名單加上逐球紀錄的換人推算；先發／替補依本場名單。影響分析依位置、犯規、得分與時間推測。")));
  return sec;
}
