/* 人脈廣場｜管理後台介面（Demo 後台與 Apps Script 私人後台共用） */
(function (g) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = {
    match: ['新需求', '已聯絡', '已介紹', '洽談中', '成交', '不處理'],
    need: ['新需求', '尋找中', '已找到廠商', '已介紹', '不處理']
  };
  const DONE = ['成交', '不處理', '已介紹'];
  const fmt = d => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const yes = v => v === true || v === 'TRUE' || v === 'true';

  function mount(root, ad) {
    let data = { members: [], matches: [], needs: [], industries: [] }, tab = 'join', q = '';
    root.innerHTML = `<header class="ad-top"><div class="brand"><span class="seal">人<br>脈</span><div><b>人脈廣場後台</b><small>${ad.mode === 'demo' ? 'Demo 模式 · 只顯示這台瀏覽器的測試資料' : '私人後台 · 只有你登入的 Google 帳號看得到'}</small></div></div>
      <div class="ad-tools">${ad.extraTools || ''}<button class="btn ghost sm" id="adReload">重新整理</button></div></header>
      ${ad.banner ? `<div class="ad-banner">${ad.banner}</div>` : ''}
      <section class="ad-stats" id="adStats"></section>
      <nav class="ad-tabs" id="adTabs" role="tablist"></nav>
      <div class="ad-search"><input id="adQ" type="search" placeholder="搜尋姓名、產業、需求、聯絡方式…"></div>
      <section id="adList" class="ad-list"><p class="ad-empty">載入中…</p></section>`;
    const $ = s => root.querySelector(s);

    async function load() {
      $('#adList').innerHTML = '<p class="ad-empty">載入中…</p>';
      try { data = await ad.load(); render(); }
      catch (e) { $('#adList').innerHTML = `<p class="ad-empty">讀取失敗：${esc(e.message || e)}</p>`; }
    }
    const pending = () => data.members.filter(m => !yes(m.approved) && yes(m.active));
    const live = () => data.members.filter(m => yes(m.approved) && yes(m.active));
    const open = list => list.filter(x => DONE.indexOf(x.status) < 0);

    function gaps() {
      const have = new Set((data.industries || []).concat(live().map(m => m.industry)));
      const covered = t => [...have].some(i => t.indexOf(i) >= 0 || i.indexOf(t) >= 0);
      const m = {};
      const add = (t, src) => { t = String(t || '').trim(); if (!t || t.length > 14 || covered(t)) return; (m[t] = m[t] || { n: 0, src: [] }).n++; m[t].src.push(src); };
      data.needs.forEach(n => { if (DONE.indexOf(n.status) < 0) add(n.need, `找廠商：${n.requester}`); });
      live().concat(pending()).forEach(p => String(p.looking_for || '').split(/[、,，/;；\s]+/).forEach(t => add(t, `${p.name} 想認識`)));
      return Object.entries(m).sort((a, b) => b[1].n - a[1].n);
    }

    function render() {
      const tabs = [['join', '加入申請', pending().length], ['match', '介紹需求', open(data.matches).length], ['need', '找廠商需求', open(data.needs).length], ['gap', '缺口雷達', gaps().length], ['live', '已上架', live().length]];
      $('#adStats').innerHTML = tabs.slice(0, 3).concat([tabs[4]]).map(t => `<button class="ad-stat" data-tab="${t[0]}"><b>${t[2]}</b><span>${t[0] === 'live' ? '已上架成員' : '待處理' + t[1]}</span></button>`).join('');
      $('#adTabs').innerHTML = tabs.map(t => `<button role="tab" aria-selected="${tab === t[0]}" data-tab="${t[0]}">${t[1]}<i>${t[2]}</i></button>`).join('');
      const match = x => !q || JSON.stringify(x).toLowerCase().indexOf(q) >= 0;
      const byTime = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
      let html = '';
      if (tab === 'join') html = pending().filter(match).sort(byTime).map(memberCard).join('') || empty('目前沒有待審核的加入申請');
      if (tab === 'live') html = live().filter(match).sort(byTime).map(memberCard).join('') || empty('還沒有已上架的成員');
      if (tab === 'match') html = data.matches.filter(match).sort(byTime).map(matchCard).join('') || empty('還沒有介紹需求');
      if (tab === 'need') html = `<p class="ad-tip">訪客找不到的廠商會進到這裡。找到合適的人選後，把加入連結傳給對方，他填完就會出現在「加入申請」。</p>` +
        (data.needs.filter(match).sort(byTime).map(needCard).join('') || empty('目前沒有找廠商需求'));
      if (tab === 'gap') { const gp = gaps(); html = `<p class="ad-tip">廣場上還沒有、但有人在找的產業。數字越大，越值得優先邀請。</p>` + (gp.length ? gp.map(([t, v]) => `<div class="ad-card gap"><div class="gap-h"><b>${esc(t)}</b><span class="gap-n">${v.n} 人在找</span></div><div class="gap-bar"><i style="width:${Math.min(100, v.n * 20)}%"></i></div><small>${esc(v.src.slice(0, 4).join('、'))}${v.src.length > 4 ? ' …' : ''}</small></div>`).join('') : empty('目前沒有缺口，所有需求在廣場上都找得到人')); }
      $('#adList').innerHTML = html;
    }
    const empty = t => `<p class="ad-empty">${t}</p>`;
    const contact = m => [m.phone && `📱 ${esc(m.phone)}`, m.line_id && `LINE ${esc(m.line_id)}`, m.email && `✉️ ${esc(m.email)}`].filter(Boolean).join(' · ') || '<span class="muted">未留聯絡方式</span>';
    const noteBox = (kind, x) => `<textarea class="ad-note" data-note="${kind}" data-id="${esc(x.id)}" rows="1" placeholder="備註（例：已傳 LINE、約週三見面）">${esc(x.note || '')}</textarea>`;

    function memberCard(m) {
      const av = g.Avatar ? g.Avatar.render(m.avatar || g.Avatar.randomFor(m.id, null, m.industry)) : '';
      const isLive = yes(m.approved);
      return `<article class="ad-card mem"><div class="ad-por">${av}</div><div class="ad-body">
        <div class="ad-row"><b class="ad-name">${esc(m.name)}</b><span class="tagx">${esc(m.industry)}</span><span class="muted">${esc(m.title)}${m.city ? ' · ' + esc(m.city) : ''}</span><span class="muted ad-time">${fmt(m.created_at)}</span></div>
        <p>${esc(m.short_intro)}</p>
        <dl><dt>服務</dt><dd>${esc(m.services)}</dd>${m.can_help_with ? `<dt>可協助</dt><dd>${esc(m.can_help_with)}</dd>` : ''}<dt>想認識</dt><dd>${esc(m.looking_for)}</dd>
        <dt>私人聯絡</dt><dd>${contact(m)}</dd><dt>來源</dt><dd>${esc(m.source_circle || '—')}${m.profile_url ? ` · <a href="${esc(m.profile_url)}" target="_blank" rel="noopener">介紹連結</a>` : ''}</dd></dl>
        ${noteBox('member', m)}
        <div class="ad-acts">${isLive ? `<button class="btn ghost sm" data-act="hide" data-id="${esc(m.id)}">下架</button>` : `<button class="btn red sm" data-act="approve" data-id="${esc(m.id)}">核准上架</button><button class="btn ghost sm" data-act="reject" data-id="${esc(m.id)}">不通過</button>`}</div>
      </div></article>`;
    }
    const sel = (kind, x) => `<select class="ad-sel st-${STATUS[kind].indexOf(x.status)}" data-status="${kind}" data-id="${esc(x.id)}">${STATUS[kind].map(s => `<option${s === x.status ? ' selected' : ''}>${s}</option>`).join('')}</select>`;
    function matchCard(x) {
      return `<article class="ad-card${DONE.indexOf(x.status) >= 0 ? ' done' : ''}"><div class="ad-body">
        <div class="ad-row">${sel('match', x)}<b>${esc(x.requester)}</b><span class="muted">想認識</span><b>${esc(x.target_name || '(未指定)')}</b><span class="tagx">${esc(x.target_industry)}</span><span class="muted ad-time">${fmt(x.created_at)}</span></div>
        <dl><dt>聯絡方式</dt><dd>${esc(x.contact)}</dd><dt>原因</dt><dd>${esc(x.why)}</dd>${x.need ? `<dt>合作需求</dt><dd>${esc(x.need)}</dd>` : ''}<dt>下一步</dt><dd>${esc(x.next_step)}</dd></dl>
        ${noteBox('match', x)}</div></article>`;
    }
    function needCard(x) {
      const invite = `嗨！我這邊有朋友在找「${x.need}」，想邀請你加入我的人脈廣場，填完資料我就能幫你們牽線：${ad.siteUrl || ''}`;
      return `<article class="ad-card${DONE.indexOf(x.status) >= 0 ? ' done' : ''}"><div class="ad-body">
        <div class="ad-row">${sel('need', x)}<b>${esc(x.requester)}</b><span class="muted">在找</span><b class="hl">${esc(x.need)}</b><span class="muted ad-time">${fmt(x.created_at)}</span></div>
        <dl><dt>需求說明</dt><dd>${esc(x.detail)}</dd><dt>地區/時間</dt><dd>${esc(x.area || '未填')} · ${esc(x.timeline)}</dd><dt>聯絡方式</dt><dd>${esc(x.contact)}</dd></dl>
        ${noteBox('need', x)}
        <div class="ad-acts"><button class="btn ghost sm" data-copy="${esc(invite)}">複製邀請廠商的訊息</button></div></div></article>`;
    }

    async function act(fn, after) {
      try { await fn(); after && after(); render(); }
      catch (e) { alert('更新失敗：' + (e.message || e)); load(); }
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
      if (b.id === 'adReload') { load(); return; }
      if (b.dataset.copy) { navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = '已複製 ✓'; setTimeout(() => b.textContent = '複製邀請廠商的訊息', 1600); }); return; }
      const m = data.members.find(x => x.id === b.dataset.id);
      if (b.dataset.act === 'approve') act(() => ad.setMember(m.id, { approved: true, active: true }), () => { m.approved = true; });
      if (b.dataset.act === 'reject') { if (confirm(`確定不通過「${m.name}」的申請？`)) act(() => ad.setMember(m.id, { active: false }), () => { m.active = false; }); }
      if (b.dataset.act === 'hide') { if (confirm(`確定把「${m.name}」從廣場下架？`)) act(() => ad.setMember(m.id, { approved: false }), () => { m.approved = false; }); }
    });
    root.addEventListener('change', e => {
      const s = e.target;
      if (s.dataset.status) { const list = s.dataset.status === 'match' ? data.matches : data.needs, x = list.find(i => i.id === s.dataset.id); act(() => ad.setStatus(s.dataset.status, x.id, s.value), () => { x.status = s.value; }); }
      if (s.dataset.note) {
        const list = { member: data.members, match: data.matches, need: data.needs }[s.dataset.note], x = list.find(i => i.id === s.dataset.id);
        ad.setNote(s.dataset.note, x.id, s.value).then(() => { x.note = s.value; s.classList.add('saved'); setTimeout(() => s.classList.remove('saved'), 1200); }).catch(err => alert('備註儲存失敗：' + (err.message || err)));
      }
    });
    $('#adQ').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
    load();
    return { reload: load };
  }
  g.PlazaAdmin = { mount, STATUS };
})(window);
