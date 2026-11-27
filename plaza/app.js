/* 人脈廣場｜廣場互動、呼叫廠商、表單 */
(() => {
  const C = window.PLAZA_CONFIG, A = window.Avatar;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  const stage = $('#stage'), floor = $('#floor'), hover = $('#hover'), drawer = $('#drawer');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth < 700;
  const colorOf = ind => C.COLORS[ind] || '#718096';
  $$('.owner').forEach(e => e.textContent = C.OWNER_NAME);

  let people = [], shown = [], nodes = [], me = null, summon = null, W = 0, H = 0, last = performance.now(), chatClock = 0, crowd = 1;
  const view = { z: 1, x: 0, y: 0 };

  /* ---------- 幾何 ---------- */
  const FT = () => H * (isMobile() ? .6 : .615), FB = () => H - (isMobile() ? 150 : 135);
  const FW = () => W - (isMobile() ? 48 : 90);
  const pos = n => ({ x: (isMobile() ? 24 : 45) + n.fx * FW(), y: FT() + n.fy * (FB() - FT()) });
  const scaleOf = n => (isMobile() ? .74 : 1) * (.78 + .36 * n.fy) * (n.me ? 1.08 : 1) * crowd;
  function measure() { W = stage.clientWidth; H = stage.clientHeight; }

  /* ---------- 資料 ---------- */
  function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 3400); }
  function stateMsg(t) { const s = $('#state'); s.textContent = t || ''; s.classList.toggle('on', !!t); }

  const K = window.PlazaKit;
  const loadPeople = K.loadPeople;

  /* ---------- 角色節點 ---------- */
  function makeNode(p, o = {}) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'av idle' + (o.me ? ' me' : '') + (p.pending ? ' pending' : '');
    el.innerHTML = `<span class="tag" style="--c:${colorOf(p.industry)}"><i></i>${esc(o.me ? '你' : p.industry)}${p.pending ? '<em>審核中</em>' : ''}</span>` +
      `<span class="fig">${A.render(p.avatar)}</span><span class="shd"></span>`;
    el.setAttribute('aria-label', o.me ? '你的角色，點擊打造形象' : `${p.industry}・${p.title},查看介紹`);
    floor.appendChild(el);
    const n = { p, el, me: !!o.me, fx: o.fx != null ? o.fx : Math.random(), fy: o.fy != null ? o.fy : Math.random(), tx: null, ty: null,
      state: 'idle', t: rand(.3, 3), speed: rand(20, 30), face: Math.random() < .5 ? -1 : 1, cool: performance.now() + rand(3000, 16000), cls: '', s: 0 };
    el.addEventListener('click', e => { e.stopPropagation(); if (n.me) openCustomizer(); else openProfile(n.p); });
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !n.me) showHover(n); });
    el.addEventListener('pointerleave', hideHover);
    el.addEventListener('focus', () => { if (!n.me) showHover(n); });
    el.addEventListener('blur', hideHover);
    return n;
  }

  function build() {
    const keep = {}; nodes.forEach(n => { keep[n.me ? '__me' : n.p.id] = n; });
    release(true); closeDrawer(); hideHover();
    floor.innerHTML = ''; nodes = [];
    shown = people.filter(matchFilter);
    const vis = shown.slice(0, isMobile() ? 60 : 200);
    crowd = clamp(Math.sqrt(26 / Math.max(1, vis.length)), .56, 1);
    const meCfg = A.normalize(LS.get('plaza_me', A.PRESETS[0])), km = keep.__me;
    me = makeNode({ industry: '你', avatar: meCfg }, { me: true, fx: km ? km.fx : .5, fy: km ? km.fy : .5 });
    me.face = 1; nodes.push(me);
    const gx = .07 * crowd, gy = .2 * crowd;
    vis.forEach(p => {
      const k = keep[p.id];
      if (k) { nodes.push(makeNode(p, { fx: k.fx, fy: k.fy })); return; }
      let fx, fy, tries = 0;
      do { fx = Math.random(); fy = Math.random(); tries++; } while (tries < 20 && nodes.some(m => Math.abs(m.fx - fx) < gx && Math.abs(m.fy - fy) < gy));
      nodes.push(makeNode(p, { fx, fy }));
    });
    $('#cnt').textContent = shown.length;
    if (people.length) stateMsg(shown.length ? '' : '這個篩選條件下還沒有成員。換個縣市或產業試試，或按「清除篩選」。');
    buildDirectory(); buildChips(); paintFilters();
  }

  function refreshMe(cfg) {
    me.p.avatar = A.normalize(cfg);
    $('.fig', me.el).innerHTML = A.render(me.p.avatar);
    me.cls = '';
  }

  /* ---------- 說話泡泡 ---------- */
  function say(n, text, ms, cls) {
    $$('.bub', n.el).forEach(b => b.remove());
    const b = document.createElement('span');
    b.className = 'bub ' + (cls || ''); b.textContent = text;
    n.el.appendChild(b);
    setTimeout(() => b.remove(), ms || 3200);
  }
  const CHAT = ['嗨！', '吃飽沒？', '最近生意好嗎？', '改天喝杯咖啡', '有案子互相介紹', '今天夜市好熱鬧', '你也在這啊！'];
  const ARRIVE = ['我是{i},來幫你！', '找{i}?我在這！', '{i}交給我', '你好，我做{i}', '需要{i}嗎？'];
  const wants = (a, b) => !!a.p.looking_for && a.p.looking_for.indexOf(b.p.industry) >= 0;

  /* ---------- 移動 ---------- */
  function wander(n) {
    n.tx = clamp(n.fx + rand(-.3, .3), 0, 1); n.ty = clamp(n.fy + rand(-.45, .45), 0, 1);
    n.state = 'walk';
  }
  function arrive(n) {
    n.tx = n.ty = null;
    if (n.summoned) {
      n.state = 'arrived'; n.face = me.fx < n.fx ? -1 : 1;
      if (!n.greeted) { n.greeted = true; setTimeout(() => n.summoned && say(n, ARRIVE[n.si % ARRIVE.length].replace('{i}', n.p.industry), 4200, 'hot'), n.si * 280); }
    } else { n.state = 'idle'; n.t = n.me ? 9e9 : rand(1.5, 5); }
  }
  function startChat(a, b) {
    const m = wants(a, b), m2 = wants(b, a);
    [a, b].forEach(n => { n.state = 'chat'; n.tx = n.ty = null; n.t = 4.2; n.el.classList.add('wave'); });
    a.face = b.fx < a.fx ? -1 : 1; b.face = -a.face;
    say(a, m ? `我在找${b.p.industry}!` : pickOne(CHAT), 3400, m ? 'hot' : '');
    setTimeout(() => { if (b.state === 'chat') say(b, m ? '我可以幫忙！' : m2 ? `正想找${a.p.industry}` : pickOne(CHAT), 3000, (m || m2) ? 'hot' : ''); }, 1200);
  }
  function endChat(n) { n.state = 'idle'; n.t = rand(.6, 2); n.cool = performance.now() + rand(10000, 18000); n.el.classList.remove('wave'); }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!W) measure();
    const fw = FW(), fh = FB() - FT();
    for (const n of nodes) {
      if (n.state === 'paused') continue;
      if (n.state === 'idle' || n.state === 'chat') {
        n.t -= dt;
        if (n.t <= 0) { if (n.state === 'chat') endChat(n); else if (!n.me && !reduce) wander(n); }
      }
      if (n.tx != null && (n.state === 'walk' || n.state === 'run')) {
        const dx = (n.tx - n.fx) * fw, dy = (n.ty - n.fy) * fh, d = Math.hypot(dx, dy);
        const sp = n.state === 'run' ? (isMobile() ? 170 : 230) : n.me ? 70 : n.speed * (isMobile() ? .75 : 1);
        if (d < 2 || reduce && n.state === 'run') { if (reduce) { n.fx = n.tx; n.fy = n.ty; } arrive(n); }
        else { const st = Math.min(d, sp * dt); n.fx += dx / d * st / fw; n.fy += dy / d * st / fh; if (Math.abs(dx) > .4) n.face = dx < 0 ? -1 : 1; }
      }
    }
    // 輕微推開，避免疊在一起
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = (a.fx - b.fx) * fw, dy = (a.fy - b.fy) * fh * 1.6, d = Math.hypot(dx, dy);
      const R = 34 * crowd;
      if (d > 0 && d < R) {
        const push = (R - d) / R * 0.6 / fw, ux = dx / d;
        const free = n => n.state === 'walk' || n.state === 'idle';
        if (free(a) && !a.me) a.fx = clamp(a.fx + ux * push, 0, 1);
        if (free(b) && !b.me) b.fx = clamp(b.fx - ux * push, 0, 1);
      }
    }
    // 相遇打招呼
    chatClock += dt;
    if (chatClock > .5 && !summon && !reduce) {
      chatClock = 0;
      const chatting = nodes.filter(n => n.state === 'chat').length / 2;
      const free = chatting >= (isMobile() ? 1 : 2) ? [] : nodes.filter(n => !n.me && (n.state === 'walk' || n.state === 'idle') && now > n.cool);
      outer: for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
        const a = free[i], b = free[j];
        if (Math.hypot((a.fx - b.fx) * fw, (a.fy - b.fy) * fh) < 64 * crowd) { startChat(a, b); break outer; }
      }
    }
    // 繪製（標籤與泡泡另外縮放：人多時變小、放大時只稍微變大，避免疊成一團）
    const T = Math.min(1, Math.max(.6, crowd) * Math.sqrt(view.z));
    for (const n of nodes) {
      const P = pos(n), s = scaleOf(n), inv = T / (s * view.z);
      n.el.style.transform = `translate3d(${(P.x - 28).toFixed(1)}px,${(P.y - 124).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      n.el.style.zIndex = Math.round(P.y) + (n.me ? 1 : 0);
      if (Math.abs(n.s - inv) > .01) { n.s = inv; n.el.style.setProperty('--inv', inv.toFixed(3)); }
      const moving = n.state === 'walk' || n.state === 'run';
      const cls = (moving ? 'walking' : 'idle') + (n.state === 'run' ? ' running' : '') + (n.face < 0 ? ' flip' : '');
      if (cls !== n.cls) {
        n.el.classList.remove('walking', 'idle', 'running', 'flip');
        cls.split(' ').forEach(c => c && n.el.classList.add(c));
        n.cls = cls;
      }
    }
    if (hover.node) placeHover(hover.node);
    if (summon && !summon.shown && summon.list.every(n => n.state === 'arrived')) {
      if (!summon.done) summon.done = now;
      if (now - summon.done > (isMobile() ? 1800 : 900)) showResults();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 點地板移動自己 ---------- */
  stage.addEventListener('click', e => {
    if (e.target.closest('.av,.needbar,.drawer,.theme-btn,.hovercard,.zoom')) return;
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left - view.x) / view.z, y = (e.clientY - r.top - view.y) / view.z;
    if (y < FT() - 30 || y > FB() + 40) return;
    me.tx = clamp((x - (isMobile() ? 24 : 45)) / FW(), 0, 1);
    me.ty = clamp((y - FT()) / (FB() - FT()), 0, 1);
    me.state = 'walk';
    $('#hint').classList.add('off');
  });

  /* ---------- 簡卡 ---------- */
  function showHover(n) {
    const p = n.p;
    const fits = nodes.filter(m => m !== n && !m.me && (wants(n, m) || wants(m, n))).map(m => m.p.industry);
    hover.innerHTML = `<span class="pill" style="--c:${colorOf(p.industry)}"><i></i>${esc(p.industry)}</span> <b>${esc(p.name)}</b>` +
      `<p>${esc(p.short_intro)}</p><p><span class="k">想認識：</span>${esc(p.looking_for)}</p>` +
      (fits.length ? `<p><span class="k">廣場上可互相介紹：</span>${esc([...new Set(fits)].join('、'))}</p>` : '');
    hover.node = n; hover.classList.add('on'); placeHover(n);
  }
  function hideHover() { hover.node = null; hover.classList.remove('on'); }
  function placeHover(n) {
    const Q = pos(n), P = { x: view.x + Q.x * view.z, y: view.y + Q.y * view.z }; let x = P.x + 34, y = P.y - 150;
    if (x + 260 > W) x = P.x - 284;
    hover.style.left = clamp(x, 8, W - 258) + 'px'; hover.style.top = clamp(y, 8, H - 200) + 'px';
  }

  /* ---------- 需求比對與呼叫 ---------- */
  function matchQuery(q) {
    const ql = q.toLowerCase().trim(), inds = new Set();
    const allInd = [...new Set(people.map(p => p.industry).concat(Object.keys(C.SYNONYMS)))];
    allInd.forEach(ind => {
      const words = C.SYNONYMS[ind] || [];
      if (ql.indexOf(ind.toLowerCase()) >= 0 || ind.indexOf(ql) >= 0 || words.some(w => ql.indexOf(w.toLowerCase()) >= 0)) inds.add(ind);
    });
    let list = nodes.filter(n => !n.me && inds.has(n.p.industry));
    if (!list.length) list = nodes.filter(n => !n.me && [n.p.services, n.p.can_help_with, n.p.title, n.p.short_intro].join(' ').toLowerCase().indexOf(ql) >= 0);
    return { inds: [...inds], list, label: inds.size ? [...inds].join('、') : q };
  }

  function callFor(raw) {
    const q = String(raw || '').trim().slice(0, 40);
    if (!q) { $('#needInput').focus(); return; }
    release(true); hideHover(); closeDrawer();
    $('#hint').classList.add('off');
    const res = matchQuery(q);
    me.face = 1;
    say(me, `我需要${res.label}!`, 3200, 'me');
    ring();
    if (!res.list.length) {
      nodes.filter(n => !n.me && n.state !== 'chat').sort(() => Math.random() - .5).slice(0, 2)
        .forEach((n, i) => setTimeout(() => say(n, pickOne(['我不是耶…', '這個我不會', '幫你問問看']), 2600), 500 + i * 400));
      setTimeout(() => showUnmet(q, res), 1300);
      return;
    }
    if (view.z > 1.05) centerOn(me);
    const list = res.list.slice(0, isMobile() ? 4 : 6);
    summon = { q, label: res.label, inds: res.inds, list, all: res.list, at: performance.now(), shown: false };
    const fw = FW(), fh = FB() - FT(), rx = isMobile() ? 70 : 120, ry = isMobile() ? 32 : 50, k = list.length;
    nodes.forEach(n => { if (!n.me && list.indexOf(n) < 0) n.el.classList.add('dim'); });
    list.forEach((n, i) => {
      const ang = k === 1 ? Math.PI + .35 : Math.PI + .15 + (i / (k - 1)) * (Math.PI - .3);
      const tx = me.fx + Math.cos(ang) * rx / fw;
      let ty = me.fy + Math.sin(ang) * ry / fh;
      if (ty < 0) ty = me.fy - Math.sin(ang) * ry / fh;
      n.summoned = true; n.greeted = false; n.si = i; n.el.classList.remove('wave', 'dim');
      n.tx = clamp(tx, 0, 1); n.ty = clamp(ty, 0, 1); n.state = 'run';
      $$('.bub', n.el).forEach(b => b.remove());
    });
    setTimeout(() => { if (summon && !summon.shown) showResults(); }, isMobile() ? 5200 : 4400);
  }

  function ring() {
    const P = pos(me), r = document.createElement('span');
    r.className = 'ring'; r.style.left = P.x + 'px'; r.style.top = (P.y - 4) + 'px';
    floor.appendChild(r); setTimeout(() => r.remove(), 1300);
  }

  function release(silent) {
    if (!summon) { nodes.forEach(n => n.el.classList.remove('dim')); return; }
    summon.all.concat(summon.list).forEach(n => { n.summoned = false; if (n.state === 'arrived' || n.state === 'run') { n.state = 'idle'; n.t = rand(.2, 1.2); n.tx = null; } });
    nodes.forEach(n => n.el.classList.remove('dim'));
    summon = null;
    if (!silent) closeDrawer();
  }

  /* ---------- 結果抽屜 ---------- */
  function mini(av) { return `<span class="mini">${A.render(av)}</span>`; }
  function vcard(p, i) {
    return `<article class="vc" style="animation-delay:${i * 70}ms">${mini(p.avatar)}<div>
      <span class="pill" style="--c:${colorOf(p.industry)}"><i></i>${esc(p.industry)}</span>
      <h4>${esc(p.name)} <span class="meta">· ${esc(p.title)}${p.city ? ' · ' + esc(p.city) : ''}</span></h4>
      <p>${esc(p.short_intro)}</p>
      <div class="acts"><button class="btn red sm" data-intro="${esc(p.id)}">請幫我介紹</button><button class="btn ghost sm" data-prof="${esc(p.id)}">看介紹</button></div></div></article>`;
  }
  function showResults() {
    if (!summon) return; summon.shown = true;
    const list = summon.all;
    drawer.innerHTML = `<div class="dr-h"><div><small>你呼叫的「${esc(summon.q)}」</small><h3>${esc(summon.label)} · ${list.length} 位跑來了</h3></div><button class="x" data-close aria-label="關閉">×</button></div>
      <div class="dr-b">${list.map((n, i) => vcard(n.p, i)).join('')}
      <div class="empty"><p>沒有想要的？留下需求，${esc(C.OWNER_NAME)} 幫你另外找。</p><button class="btn ghost sm" data-need="${esc(summon.q)}">請 ${esc(C.OWNER_NAME)} 幫我找</button></div></div>`;
    drawer.classList.add('on');
  }
  function showUnmet(q) {
    drawer.innerHTML = `<div class="dr-h"><div><small>你呼叫的「${esc(q)}」</small><h3>廣場上還沒有這類廠商</h3></div><button class="x" data-close aria-label="關閉">×</button></div>
      <div class="dr-b"><div class="empty"><div class="big">「${esc(q)}」</div>
      <p>沒關係，${esc(C.OWNER_NAME)} 的人脈不只在廣場上。留下你的需求，我會幫你找合適的廠商，確認後再聯絡你。</p>
      <button class="btn red" data-need="${esc(q)}">請 ${esc(C.OWNER_NAME)} 幫我找廠商</button></div></div>`;
    drawer.classList.add('on');
  }
  function closeDrawer() { drawer.classList.remove('on'); }
  drawer.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-close')) { closeDrawer(); release(true); }
    else if (t.dataset.intro) openMatch(byId(t.dataset.intro));
    else if (t.dataset.prof) openProfile(byId(t.dataset.prof));
    else if (t.dataset.need != null) openNeed(t.dataset.need);
  });
  const byId = id => people.find(p => p.id === id);

  $('#needForm').addEventListener('submit', e => { e.preventDefault(); callFor($('#needInput').value); $('#needInput').blur(); });

  function buildChips() {
    const inds = [...new Set(shown.map(p => p.industry))];
    $('#chips').innerHTML = inds.map(i => `<button type="button" class="chip" style="--c:${colorOf(i)}" data-i="${esc(i)}"><i></i>${esc(i)}</button>`).join('');
    $$('#chips .chip').forEach(b => b.onclick = () => { $('#needInput').value = b.dataset.i; callFor(b.dataset.i); });
  }
  function buildDirectory() {
    const m = {}; shown.forEach(p => (m[p.industry] = m[p.industry] || []).push(p));
    const keys = Object.keys(m);
    $('#dirTotal').textContent = `${filter.city ? filter.city + ' · ' : ''}${shown.length} 位 · ${keys.length} 個產業`;
    $('#dirGrid').innerHTML = keys.map(k => `<button class="dcard" style="--c:${colorOf(k)}" data-i="${esc(k)}"><span><span class="pill" style="--c:${colorOf(k)}"><i></i>${esc(k)}</span><b>${m[k].length} 位</b><small>點我，請他們跑過來</small></span>
      <span class="stack">${m[k].slice(0, 3).map(p => `<span>${A.render(p.avatar)}</span>`).join('')}</span></button>`).join('');
    if (!keys.length) $('#dirGrid').innerHTML = '<p class="muted">這個篩選條件下還沒有成員。</p>';
    $$('#dirGrid .dcard').forEach(b => b.onclick = () => {
      stage.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      $('#needInput').value = b.dataset.i; setTimeout(() => callFor(b.dataset.i), reduce ? 0 : 450);
    });
  }

  /* ---------- 縣市・產業・關鍵字篩選 ---------- */
  const COUNTIES = ['台北', '新北', '基隆', '桃園', '新竹', '苗栗', '台中', '彰化', '南投', '雲林', '嘉義', '台南', '高雄', '屏東', '宜蘭', '花蓮', '台東', '澎湖', '金門', '連江'];
  function cityOf(p) {
    const s = String(p.city || '').trim().replace(/臺/g, '台');
    if (!s) return '';
    return COUNTIES.find(c => s.indexOf(c) === 0) || s.replace(/[市縣]$/, '');
  }
  const filter = { city: LS.get('plaza_city', ''), ind: '', q: '' };
  function matchFilter(p) {
    if (filter.city && cityOf(p) !== filter.city) return false;
    if (filter.ind && p.industry !== filter.ind) return false;
    if (filter.q) {
      const hay = [p.name, p.industry, p.title, p.city, p.services, p.can_help_with, p.looking_for, p.short_intro].join(' ').toLowerCase();
      if (filter.q.toLowerCase().split(/\s+/).some(w => w && hay.indexOf(w) < 0)) return false;
    }
    return true;
  }
  function paintFilters() {
    const cc = {}; people.forEach(p => { const c = cityOf(p); if (c) cc[c] = (cc[c] || 0) + 1; });
    const cities = Object.keys(cc).sort((a, b) => (COUNTIES.indexOf(a) + 1 || 99) - (COUNTIES.indexOf(b) + 1 || 99));
    if (filter.city && !cc[filter.city]) cities.unshift(filter.city);
    $('#fCity').innerHTML = `<option value="">全部縣市</option>` + cities.map(c => `<option value="${esc(c)}"${c === filter.city ? ' selected' : ''}>${esc(c)}（${cc[c] || 0}）</option>`).join('');
    const pool = people.filter(p => !filter.city || cityOf(p) === filter.city), ic = {};
    pool.forEach(p => { ic[p.industry] = (ic[p.industry] || 0) + 1; });
    const inds = Object.keys(ic); if (filter.ind && !ic[filter.ind]) inds.unshift(filter.ind);
    $('#fInd').innerHTML = `<option value="">全部產業</option>` + inds.map(i => `<option value="${esc(i)}"${i === filter.ind ? ' selected' : ''}>${esc(i)}（${ic[i] || 0}）</option>`).join('');
    const on = !!(filter.city || filter.ind || filter.q);
    $('#fClear').hidden = !on;
    $('#fCount').textContent = on ? `顯示 ${shown.length} / ${people.length} 位` : `共 ${people.length} 位`;
    stage.classList.toggle('filtered', on);
  }
  $('#fCity').onchange = e => { filter.city = e.target.value; filter.ind = ''; LS.set('plaza_city', filter.city); build(); };
  $('#fInd').onchange = e => { filter.ind = e.target.value; build(); };
  let fqT; $('#fQ').oninput = e => { clearTimeout(fqT); fqT = setTimeout(() => { filter.q = e.target.value.trim().slice(0, 40); build(); }, 250); };
  $('#fClear').onclick = () => { filter.city = filter.ind = filter.q = ''; $('#fQ').value = ''; LS.set('plaza_city', ''); build(); };

  /* ---------- 縮放與拖曳 ---------- */
  const ZMAX = 3.2, scene = $('#scene');
  function applyView() {
    view.z = clamp(view.z, 1, ZMAX);
    view.x = clamp(view.x, W - W * view.z, 0); view.y = clamp(view.y, H - H * view.z, 0);
    const t = `translate(${view.x.toFixed(1)}px,${view.y.toFixed(1)}px) scale(${view.z.toFixed(3)})`;
    floor.style.transform = scene.style.transform = t;
    stage.classList.toggle('zoomed', view.z > 1.02);
    $('#zPct').textContent = Math.round(view.z * 100) + '%';
    if (hover.node) placeHover(hover.node);
  }
  function zoomAt(z, cx, cy) {
    const nz = clamp(z, 1, ZMAX);
    view.x = cx - (cx - view.x) * nz / view.z; view.y = cy - (cy - view.y) * nz / view.z; view.z = nz; applyView();
  }
  function animateTo(tz, tx, ty) {
    const fz = view.z, fx = view.x, fy = view.y, t0 = performance.now(), d = reduce ? 1 : 320;
    const step = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
      view.z = fz + (tz - fz) * e; view.x = fx + (tx - fx) * e; view.y = fy + (ty - fy) * e; applyView(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function zoomBy(f) { const nz = clamp(view.z * f, 1, ZMAX), cx = W / 2, cy = (FT() + FB()) / 2 * view.z + view.y; animateTo(nz, cx - (cx - view.x) * nz / view.z, cy - (cy - view.y) * nz / view.z); }
  function centerOn(n) { const P = pos(n); animateTo(view.z, W / 2 - P.x * view.z, H * .55 - P.y * view.z); }
  $('#zIn').onclick = () => zoomBy(1.45);
  $('#zOut').onclick = () => zoomBy(1 / 1.45);
  $('#zFit').onclick = () => animateTo(1, 0, 0);
  // 觸控板捏合會送出 ctrl + 滾輪；一般滾輪仍然捲動網頁
  stage.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect(); zoomAt(view.z * Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // 單指拖曳平移（放大後）、雙指捏合縮放
  const pts = new Map(); let drag = null, moved = false;
  const UI = '.needbar,.drawer,.theme-btn,.hovercard,.zoom';
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest(UI) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: view.x, vy: view.y }; moved = true; }
  });
  addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !drag) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stage.getBoundingClientRect();
    if (pts.size >= 2 && drag.pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const nz = clamp(drag.z * d / drag.pinch, 1, ZMAX), cx = drag.mx - r.left, cy = drag.my - r.top;
      view.z = nz; view.x = cx - (cx - drag.vx) * nz / drag.z + (mx - drag.mx); view.y = cy - (cy - drag.vy) * nz / drag.z + (my - drag.my);
      applyView(); hideHover();
    } else if (pts.size === 1 && view.z > 1.02) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; stage.classList.add('dragging'); hideHover(); }
      if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    }
  });
  const endPt = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size === 1) { const [a] = [...pts.values()]; drag = { x: a.x, y: a.y, vx: view.x, vy: view.y }; }
    if (!pts.size) { drag = null; stage.classList.remove('dragging'); setTimeout(() => { moved = false; }, 0); }
  };
  addEventListener('pointerup', endPt); addEventListener('pointercancel', endPt);
  // 拖曳結束時不要當成點擊（不移動角色、不開介紹）
  stage.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  stage.addEventListener('dblclick', e => {
    if (e.target.closest(UI + ',.av')) return;
    const r = stage.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (view.z > 2.4) animateTo(1, 0, 0); else { const nz = view.z * 1.6; animateTo(nz, cx - (cx - view.x) * nz / view.z, cy - (cy - view.y) * nz / view.z); }
  });

  /* ---------- 時段 ---------- */
  const THEMES = [['t-dusk', '黃昏'], ['t-night', '夜晚'], ['t-day', '白天']];
  let ti = Math.max(0, THEMES.findIndex(t => t[0] === LS.get('plaza_theme', 't-dusk')));
  function applyTheme() { THEMES.forEach(t => stage.classList.remove(t[0])); stage.classList.add(THEMES[ti][0]); $('#btnTheme').textContent = THEMES[ti][1]; }
  $('#btnTheme').onclick = () => { ti = (ti + 1) % THEMES.length; applyTheme(); LS.set('plaza_theme', THEMES[ti][0]); };
  applyTheme();

  /* ---------- Modal ---------- */
  let lastFocus = null;
  function openModal(html, wide) {
    lastFocus = document.activeElement;
    const sh = $('#sheet'); sh.className = 'sheet' + (wide ? ' wide' : ''); sh.innerHTML = html;
    $('#modal').classList.add('on');
    const f = [...sh.querySelectorAll('input,select,textarea,button')].find(x => !x.closest('.hp') && x.type !== 'hidden' && !x.hasAttribute('data-x')); if (f) f.focus();
    return sh;
  }
  function closeModal() { $('#modal').classList.remove('on'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-x]')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) closeModal(); else if (drawer.classList.contains('on')) { closeDrawer(); release(true); } } });
  const head = (t, sub) => `<div class="sh-h"><div><h2 id="mTitle">${t}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button type="button" class="x" data-x aria-label="關閉">×</button></div>`;

  function openProfile(p) {
    if (!p) return; hideHover();
    const sh = openModal(head(esc(p.name), `<span class="pill" style="--c:${colorOf(p.industry)}"><i></i>${esc(p.industry)}</span> ${esc(p.title)}${p.city ? ' · ' + esc(p.city) : ''}`) +
      `<div class="prof"><div class="portrait${K.photo(p) ? ' photo' : ''}">${K.photo(p) ? `<img src="${esc(K.photo(p))}" alt="${esc(p.name)} 的照片">` : A.render(p.avatar)}</div><dl>
        <dd style="margin:0">${esc(p.short_intro)}</dd>
        <dt>產品/服務</dt><dd>${esc(p.services)}</dd>
        ${p.can_help_with ? `<dt>可以協助的資源</dt><dd>${esc(p.can_help_with)}</dd>` : ''}
        <dt>目前想認識</dt><dd>${esc(p.looking_for)}</dd></dl></div>
      <div class="acts-row">${p.pending ? '<span class="note">這筆資料正在等候審核，通過後才會公開。</span>' : `<button class="btn red" id="goIntro">請幫我介紹</button>`}
      <a class="btn ghost" href="profile.html?id=${encodeURIComponent(p.id)}">看一頁式介紹</a></div>
      <p class="note">為保護隱私，不公開聯絡方式。送出需求後由 ${esc(C.OWNER_NAME)} 確認雙方意願，再幫你們牽線。</p>`);
    const b = $('#goIntro', sh); if (b) b.onclick = () => openMatch(p);
  }

  const honeypot = `<div class="hp" aria-hidden="true"><label>網站<input name="website" tabindex="-1" autocomplete="off"></label></div>`;
  function bindForm(sh, kind, extra, done) {
    const f = $('form', sh);
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f)); Object.assign(d, extra ? extra() : {});
      const btn = $('button[type=submit]', f), err = $('.err', f);
      btn.disabled = true; btn.textContent = '送出中…'; err.textContent = '';
      try { await submit(kind, d); done(d); }
      catch (x) { err.textContent = x.message || '送出失敗，請稍後再試'; btn.disabled = false; btn.textContent = '重新送出'; }
    };
  }
  function success(title, msg) {
    $('#sheet').innerHTML = `<div class="ok"><span class="seal" aria-hidden="true">收<br>到</span><h2 style="font-family:var(--serif);margin:0">${title}</h2>
      <p class="note" style="font-size:14px">${msg}</p><button class="btn red" data-x>回到廣場</button></div>`;
    $('#sheet [data-x]').focus();
  }
  const demoNote = () => C.API_URL ? '' : '<br><small>(目前是 Demo 模式，資料只存在這台瀏覽器，可在管理後台看到。)</small>';

  function openMatch(p) {
    if (!p) return;
    const sh = openModal(head('請幫我介紹', `想認識：<b>${esc(p.name)}</b>(${esc(p.industry)})`) +
      `<form class="f" novalidate>${honeypot}
        <div class="two"><div><label>你的稱呼 *</label><input name="requester" required maxlength="30"></div>
        <div><label>聯絡方式 * <small>手機 / LINE / Email，只有 ${esc(C.OWNER_NAME)} 看得到</small></label><input name="contact" required maxlength="80"></div></div>
        <label>為什麼想認識？ *</label><textarea name="why" rows="2" required maxlength="300"></textarea>
        <label>合作需求 <small>預算、時間、地點都可以寫</small></label><textarea name="need" rows="2" maxlength="300"></textarea>
        <label>希望的下一步</label><select name="next_step"><option>先幫我確認對方意願</option><option>安排線上聊聊</option><option>安排見面</option><option>直接請對方報價</option></select>
        <div class="err"></div><div class="acts-row"><button class="btn red" type="submit">送出介紹需求</button><button class="btn ghost" type="button" data-x>取消</button></div></form>`);
    bindForm(sh, 'match', () => ({ target_id: p.id, target_name: p.name, target_industry: p.industry }),
      () => success('已收到你的介紹需求', `${esc(C.OWNER_NAME)} 會先聯絡 ${esc(p.name)} 確認意願，再回覆你。` + demoNote()));
  }

  function openNeed(q) {
    const sh = openModal(head(`請 ${esc(C.OWNER_NAME)} 幫我找廠商`, '廣場上還沒有？留下需求，我幫你從人脈裡找。') +
      `<form class="f" novalidate>${honeypot}
        <label>需要的廠商或服務 *</label><input name="need" required maxlength="40" value="${esc(q || '')}">
        <label>需求說明 * <small>想解決什麼問題？</small></label><textarea name="detail" rows="3" required maxlength="400"></textarea>
        <div class="two"><div><label>地區</label><input name="area" maxlength="30" placeholder="例：台中西屯"></div>
        <div><label>希望時間</label><select name="timeline"><option>越快越好</option><option>一週內</option><option>一個月內</option><option>不急，先了解</option></select></div></div>
        <div class="two"><div><label>你的稱呼 *</label><input name="requester" required maxlength="30"></div>
        <div><label>聯絡方式 * <small>不會公開</small></label><input name="contact" required maxlength="80"></div></div>
        <div class="err"></div><div class="acts-row"><button class="btn red" type="submit">送出找廠商需求</button><button class="btn ghost" type="button" data-x>取消</button></div></form>`);
    bindForm(sh, 'need', null, d => success('收到，我來幫你找', `找到合適的「${esc(d.need)}」廠商後，${esc(C.OWNER_NAME)} 會聯絡你。` + demoNote()));
  }

  /* ---------- 形象自訂 ---------- */
  function customizer(cfg) {
    const c = A.normalize(cfg);
    const opt = (key, list) => list.map(([v, l]) => `<button type="button" class="opt" data-k="${key}" data-v="${v}" aria-pressed="${c[key] === v}">${l}</button>`).join('');
    const sw = (key, list) => list.map(v => `<button type="button" class="sw" style="background:${v}" data-k="${key}" data-v="${v}" aria-pressed="${c[key] === v}" aria-label="${key} ${v}"></button>`).join('');
    return `<div class="cz"><div class="cz-prev"><div class="stagebox" id="czPrev">${A.render(c)}</div>
        <div class="acts-row" style="justify-content:center;margin-top:10px"><button type="button" class="btn ghost sm" id="czRand">隨機</button></div></div>
      <div><h4>預設角色</h4><div class="presets">${A.PRESETS.map((p, i) => `<button type="button" class="preset" data-p="${i}">${A.render(p)}${p.name}</button>`).join('')}</div>
        <h4>性別</h4><div class="opts">${opt('g', [['m', '男生'], ['f', '女生']])}</div>
        <h4>膚色</h4><div class="opts">${sw('skin', A.SKIN)}</div>
        <h4>髮型</h4><div class="opts">${opt('hair', A.HAIR)}</div>
        <h4>髮色</h4><div class="opts">${sw('hairColor', A.HAIR_COLORS)}</div>
        <h4>上衣</h4><div class="opts">${opt('top', A.TOPS)}</div><div class="opts" style="margin-top:6px">${sw('topColor', A.COLORS)}</div>
        <h4>褲子/裙子</h4><div class="opts">${opt('bottom', A.BOTTOMS)}</div><div class="opts" style="margin-top:6px">${sw('bottomColor', A.COLORS)}</div></div></div>`;
  }
  function bindCustomizer(root, state) {
    const sync = () => {
      $('#czPrev', root).innerHTML = A.render(state.c);
      $$('[data-k]', root).forEach(b => b.setAttribute('aria-pressed', String(state.c[b.dataset.k] === b.dataset.v)));
      $$('.preset', root).forEach(b => b.setAttribute('aria-pressed', 'false'));
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) { state.c[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'g' && (['bob', 'long', 'ponytail', 'bun'].indexOf(state.c.hair) >= 0) !== (b.dataset.v === 'f')) state.c.hair = b.dataset.v === 'f' ? 'bob' : 'short'; sync(); }
      else if (b.dataset.p != null) { const p = A.PRESETS[+b.dataset.p]; state.c = A.normalize(p); sync(); b.setAttribute('aria-pressed', 'true'); }
      else if (b.id === 'czRand') { state.c = A.randomFor(Math.random().toString(36)); sync(); }
    });
  }
  function openCustomizer() {
    const state = { c: A.normalize(LS.get('plaza_me', me.p.avatar)) };
    const sh = openModal(head('打造我的形象', '選一個預設角色，再調整髮型、膚色和穿搭。') + customizer(state.c) +
      `<div class="acts-row"><button class="btn red" id="czSave">換上這個形象</button><button class="btn ghost" data-x>取消</button></div>`, true);
    bindCustomizer(sh, state);
    $('#czSave', sh).onclick = () => { LS.set('plaza_me', state.c); refreshMe(state.c); closeModal(); say(me, '換好了！', 2200, 'me'); };
  }

  /* ---------- 我想加入 ---------- */
  const IND_OPTIONS = () => [...new Set(Object.keys(C.COLORS).concat(people.map(p => p.industry)))];
  function openJoin() {
    const state = { c: A.normalize(LS.get('plaza_me', A.PRESETS[0])), step: 1, data: {}, x: { photo: '', links: [{ label: '', url: '' }], works: [] }, busy: 0 };
    const STEPS = n => `<div class="steps-mini">${[1, 2, 3].map(i => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`;
    const render = () => {
      if (state.step === 1) {
        const sh = openModal(head('加入人脈廣場', '第 1 步：打造你在廣場上的形象') + STEPS(1) + customizer(state.c) +
          `<div class="acts-row"><button class="btn red" id="jNext">下一步：填寫資料</button><button class="btn ghost" data-x>取消</button></div>`, true);
        bindCustomizer(sh, state);
        $('#jNext', sh).onclick = () => { state.step = 2; render(); };
        return;
      }
      if (state.step === 3) return renderStep3();
      const v = k => esc(state.data[k] || '');
      const sh = openModal(head('加入人脈廣場', '第 2 步：介紹你自己（審核通過後才會公開）') + STEPS(2) +
        `<form class="f" novalidate>${honeypot}
          <div class="two"><div><label>姓名/暱稱 *</label><input name="name" required maxlength="20" value="${v('name')}"></div>
          <div><label>產業 * <small>可自行輸入</small></label><input name="industry" required maxlength="12" list="indList" value="${v('industry')}"><datalist id="indList">${IND_OPTIONS().map(i => `<option value="${esc(i)}">`).join('')}</datalist></div></div>
          <div class="two"><div><label>職稱/角色 *</label><input name="title" required maxlength="24" value="${v('title')}"></div>
          <div><label>所在縣市</label><input name="city" maxlength="10" list="cityList" placeholder="例：台中" value="${v('city')}"><datalist id="cityList">${COUNTIES.map(c => `<option value="${c}">`).join('')}</datalist></div></div>
          <label>一句話介紹 * <small>30–60 字</small></label><textarea name="short_intro" rows="2" required maxlength="80">${v('short_intro')}</textarea>
          <label>可提供的產品/服務 *</label><input name="services" required maxlength="80" value="${v('services')}">
          <label>可以幫助別人的資源</label><input name="can_help_with" maxlength="80" value="${v('can_help_with')}">
          <label>目前想認識的產業或對象 *</label><input name="looking_for" required maxlength="80" placeholder="例：室內設計、旅宿業主" value="${v('looking_for')}">
          <div class="two"><div><label>手機 <small>不公開</small></label><input name="phone" maxlength="20" inputmode="tel" value="${v('phone')}"></div>
          <div><label>LINE ID <small>不公開</small></label><input name="line_id" maxlength="40" value="${v('line_id')}"></div></div>
          <div class="two"><div><label>Email <small>不公開</small></label><input name="email" type="email" maxlength="80" value="${v('email')}"></div>
          <div><label>怎麼認識 ${esc(C.OWNER_NAME)} 的</label><select name="source_circle"><option>BNI</option><option>讀書會</option><option>客戶</option><option>朋友介紹</option><option>其他</option></select></div></div>
          <label class="chk"><input type="checkbox" name="consent" value="yes" required ${state.data.consent === 'yes' ? 'checked' : ''}> 我同意公開我的商務介紹資料（手機、LINE、Email 不會公開）</label>
          <div class="err"></div>
          <div class="acts-row"><button class="btn red" type="submit">下一步：一頁式介紹</button><button class="btn ghost" type="button" id="jBack">上一步</button></div></form>`);
      const sel = $('select[name=source_circle]', sh); if (state.data.source_circle) sel.value = state.data.source_circle;
      $('#jBack', sh).onclick = () => { state.data = Object.fromEntries(new FormData($('form', sh))); state.step = 1; render(); };
      $('form', sh).onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        try { checkJoin(d); } catch (x) { $('.err', sh).textContent = x.message; return; }
        state.data = d; state.step = 3; render();
      };
    };

    // 第 3 步：一頁式介紹（照片、連結、作品，全部選填）
    function renderStep3() {
      const x = state.x;
      const sh = openModal(head('加入人脈廣場', '第 3 步：一頁式介紹（選填，可直接送出）') + STEPS(3) +
        `<form class="f" novalidate>
          <h4 class="f-h">人像照片</h4>
          <div class="ph-row"><div class="ph-prev" id="phPrev"></div>
            <div><label class="btn ghost sm upl">上傳照片<input type="file" accept="image/*" id="phFile" hidden></label>
            <button type="button" class="btn ghost sm" id="phDel">移除</button>
            <p class="note">建議清楚的半身照。沒有照片時，介紹頁會用你的卡通形象。</p></div></div>
          <h4 class="f-h">相關連結 <small>官網、FB、IG、LINE 官方帳號…最多 5 個</small></h4>
          <div id="lnkList"></div><button type="button" class="btn ghost sm" id="lnkAdd">＋ 新增連結</button>
          <h4 class="f-h">代表作品・指標客戶 <small>最多 6 項，例如服務過的客戶、代表產品</small></h4>
          <div id="wkList" class="wk-list"></div><button type="button" class="btn ghost sm" id="wkAdd">＋ 新增作品</button>
          <div class="err"></div>
          <div class="acts-row"><button class="btn red" type="submit">送出申請</button><button class="btn ghost" type="button" id="jBack">上一步</button></div></form>`, true);
      const paintPhoto = () => { $('#phPrev', sh).innerHTML = x.photo ? `<img src="${esc(x.photo)}" alt="">` : A.render(state.c); $('#phDel', sh).hidden = !x.photo; };
      const paintLinks = () => {
        $('#lnkList', sh).innerHTML = x.links.map((l, i) => `<div class="lk-row">
          <input data-l="${i}" data-k="label" maxlength="20" placeholder="名稱，例：官網" value="${esc(l.label)}">
          <input data-l="${i}" data-k="url" maxlength="300" inputmode="url" placeholder="https://" value="${esc(l.url)}">
          <button type="button" class="x" data-ldel="${i}" aria-label="刪除這個連結">×</button></div>`).join('');
        $('#lnkAdd', sh).hidden = x.links.length >= 5;
      };
      const paintWorks = () => {
        $('#wkList', sh).innerHTML = x.works.map((w, i) => `<div class="wk-row">
          <label class="wk-img" title="上傳圖片">${w.img === 'busy' ? '<span>處理中…</span>' : w.img ? `<img src="${esc(w.img)}" alt="">` : '<span>＋ 圖片</span>'}<input type="file" accept="image/*" data-wimg="${i}" hidden></label>
          <div class="wk-f"><input data-w="${i}" data-k="title" maxlength="30" placeholder="名稱，例：○○飯店 POS 導入" value="${esc(w.title)}">
          <textarea data-w="${i}" data-k="desc" rows="2" maxlength="120" placeholder="一兩句說明成果">${esc(w.desc)}</textarea>
          <input data-w="${i}" data-k="url" maxlength="300" inputmode="url" placeholder="相關連結（選填）https://" value="${esc(w.url)}"></div>
          <button type="button" class="x" data-wdel="${i}" aria-label="刪除這個作品">×</button></div>`).join('');
        $('#wkAdd', sh).hidden = x.works.length >= 6;
      };
      paintPhoto(); paintLinks(); paintWorks();
      const err = t => { $('.err', sh).textContent = t || ''; };
      const load = async (file, max, set) => {
        if (!file) return; err(''); state.busy++;
        try { set(await K.compress(file, max)); } catch (e) { set(null); err(e.message); }
        finally { state.busy--; }
      };
      sh.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.l != null) x.links[+t.dataset.l][t.dataset.k] = t.value;
        if (t.dataset.w != null) x.works[+t.dataset.w][t.dataset.k] = t.value;
      });
      sh.addEventListener('change', e => {
        const t = e.target;
        if (t.id === 'phFile') { const f = t.files[0]; t.value = ''; load(f, 1000, v => { if (v) x.photo = v; paintPhoto(); }); }
        if (t.dataset.wimg != null) {
          const i = +t.dataset.wimg, f = t.files[0], w = x.works[i]; t.value = ''; if (!f) return;
          const old = w.img; w.img = 'busy'; paintWorks();
          load(f, 900, v => { w.img = v || old; paintWorks(); });
        }
      });
      sh.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'phDel') { x.photo = ''; paintPhoto(); }
        if (b.id === 'lnkAdd' && x.links.length < 5) { x.links.push({ label: '', url: '' }); paintLinks(); $$('#lnkList input', sh).slice(-2)[0].focus(); }
        if (b.dataset.ldel != null) { x.links.splice(+b.dataset.ldel, 1); paintLinks(); }
        if (b.id === 'wkAdd' && x.works.length < 6) { x.works.push({ title: '', desc: '', img: '', url: '' }); paintWorks(); $$('#wkList [data-k=title]', sh).slice(-1)[0].focus(); }
        if (b.dataset.wdel != null) { x.works.splice(+b.dataset.wdel, 1); paintWorks(); }
      });
      $('#jBack', sh).onclick = () => { state.step = 2; render(); };
      $('form', sh).onsubmit = async e => {
        e.preventDefault(); err('');
        if (state.busy) { err('圖片還在處理中，請稍等一下再送出'); return; }
        let links, works;
        try { links = cleanLinks(x.links); works = cleanWorks(x.works); } catch (z) { err(z.message); return; }
        const d = { ...state.data, avatar: JSON.stringify(state.c), photo: x.photo, links: JSON.stringify(links), works: JSON.stringify(works) };
        const btn = $('button[type=submit]', sh); btn.disabled = true; btn.textContent = x.photo || works.some(w => w.img) ? '上傳照片中…' : '送出中…';
        try { await submit('join', d); }
        catch (z) { err(z.message || '送出失敗，請稍後再試'); btn.disabled = false; btn.textContent = '重新送出'; return; }
        LS.set('plaza_me', state.c); refreshMe(state.c);
        if (!C.API_URL) { const p = { ...d, id: d._id, avatar: state.c, pending: true }; people.push(p); const n = makeNode(p, { fx: clamp(me.fx + .08, 0, 1), fy: me.fy }); nodes.push(n); say(n, '大家好！', 3000, 'hot'); }
        success('已收到你的加入申請', `${esc(C.OWNER_NAME)} 審核通過後，你就會出現在廣場上，也會有自己的一頁式介紹。` + demoNote());
      };
    }
    render();
  }

  const fixUrl = u => { u = String(u || '').trim(); if (u && !/^https?:\/\//i.test(u) && /^[\w-]+(\.[\w-]+)+/.test(u)) u = 'https://' + u; return u; };
  function cleanLinks(list) {
    return list.map(l => ({ label: String(l.label || '').trim(), url: fixUrl(l.url) })).filter(l => l.label || l.url).map(l => {
      if (!K.okUrl(l.url)) throw new Error(`連結「${l.label || l.url}」的網址不正確，請以 https:// 開頭`);
      return l;
    });
  }
  function cleanWorks(list) {
    return list.map(w => ({ title: String(w.title || '').trim(), desc: String(w.desc || '').trim(), img: w.img && w.img !== 'busy' ? w.img : '', url: fixUrl(w.url) }))
      .filter(w => w.title || w.desc || w.img || w.url).map(w => {
        if (!w.title) throw new Error('每個作品都要填名稱');
        if (w.url && !K.okUrl(w.url)) throw new Error(`作品「${w.title}」的連結網址不正確`);
        return w;
      });
  }
  function checkJoin(data) {
    const miss = ['name', 'industry', 'title', 'short_intro', 'services', 'looking_for'].filter(k => !String(data[k] || '').trim());
    if (miss.length) throw new Error('請填寫所有標示 * 的欄位');
    if (data.consent !== 'yes') throw new Error('請勾選同意公開商務介紹資料');
    if (!data.phone && !data.line_id && !data.email) throw new Error('手機、LINE、Email 請至少留一項，方便我聯絡你');
  }

  /* ---------- 送出 ---------- */
  async function submit(kind, data) {
    if (data.website) return {}; // 機器人陷阱欄位
    delete data.website;
    const need = { match: ['requester', 'contact', 'why'], need: ['need', 'detail', 'requester', 'contact'], join: ['name', 'industry', 'title', 'short_intro', 'services', 'looking_for'] }[kind];
    const miss = need.filter(k => !String(data[k] || '').trim());
    if (miss.length) throw new Error('請填寫所有標示 * 的欄位');
    if (kind === 'join') checkJoin(data);
    const rl = LS.get('plaza_rl', []).filter(t => Date.now() - t < 600000);
    if (rl.length >= 8) throw new Error('送出太頻繁，請 10 分鐘後再試');
    rl.push(Date.now()); LS.set('plaza_rl', rl);
    const payload = { ...data, kind };
    if (C.API_URL) {
      let j = null;
      try { const r = await fetch(C.API_URL, { method: 'POST', body: JSON.stringify(payload) }); j = await r.json(); }
      catch (e) { await fetch(C.API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); j = { ok: true }; }
      if (!j || j.ok === false) throw new Error((j && j.error) || '送出失敗，請稍後再試');
      return j;
    }
    const id = kind[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    data._id = id;
    const db = LS.get('plaza_demo_db', []);
    db.push({ ...payload, id, created_at: new Date().toISOString(), status: kind === 'join' ? '' : '新需求', approved: false, active: true, note: '' });
    if (!K.LS.set('plaza_demo_db', db)) throw new Error('Demo 模式的瀏覽器空間不夠放這些圖片，請少放幾張');
    return { ok: true, id };
  }

  $('#btnMe').onclick = openCustomizer;
  $('#btnJoin').onclick = openJoin;

  /* ---------- 啟動 ---------- */
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const was = isMobile(); measure(); applyView(); if (people.length && was !== build.mobile) { build(); build.mobile = isMobile(); } }, 200); });
  (async () => {
    measure(); stateMsg('人脈廣場準備中…');
    let ok = true;
    try { people = await loadPeople(); }
    catch (e) { people = []; ok = false; }
    build(); build.mobile = isMobile(); applyView();
    if (!ok) stateMsg('資料暫時載入失敗，請稍後重新整理。');
    else if (!people.length) stateMsg('廣場上還沒有商家，歡迎成為第一位！');
    const q = new URLSearchParams(location.search), want = q.get('intro');
    if (want) { history.replaceState(null, '', location.pathname); const p = byId(want); if (p) setTimeout(() => openMatch(p), 400); }
    setTimeout(() => say(me, '我在這！', 2600, 'me'), 900);
    setTimeout(() => $('#hint').classList.add('off'), 9000);
    requestAnimationFrame(frame);
  })();
})();
