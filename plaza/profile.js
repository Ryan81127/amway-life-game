/* 人脈廣場｜一頁式介紹頁 profile.html?id=成員編號 */
(async () => {
  const K = window.PlazaKit, A = window.Avatar, C = K.C, esc = K.esc;
  const root = document.getElementById('pf');
  document.querySelectorAll('.owner').forEach(e => e.textContent = C.OWNER_NAME);
  const colorOf = ind => C.COLORS[ind] || '#718096';
  const toast = t => { const e = document.getElementById('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); };
  const id = new URLSearchParams(location.search).get('id') || '';

  let people = [];
  try { people = await K.loadPeople(); }
  catch (e) { root.innerHTML = `<p class="pf-state">資料暫時載入失敗，請稍後重新整理。<br><a href="./">回到廣場</a></p>`; return; }
  const p = people.find(x => String(x.id) === id);
  if (!p) { root.innerHTML = `<p class="pf-state">找不到這位成員，可能還在審核中或已經下架。<br><a class="btn red" href="./">回到人脈廣場</a></p>`; return; }

  document.title = `${p.name}｜${p.industry}｜人脈廣場`;
  const photo = K.photo(p), links = K.links(p), works = K.works(p), col = colorOf(p.industry);
  const intro = `./?intro=${encodeURIComponent(p.id)}`;
  const info = [['產品/服務', p.services], ['可以協助的資源', p.can_help_with], ['目前想認識', p.looking_for]].filter(x => String(x[1] || '').trim());

  root.style.setProperty('--c', col);
  root.innerHTML = `
    ${p.pending ? '<p class="pf-pending">這是 Demo 模式的預覽：這筆資料還在等候審核，通過後才會公開。</p>' : ''}
    <section class="pf-hero">
      <div class="pf-por${photo ? ' photo' : ''}">${photo ? `<img src="${esc(photo)}" alt="${esc(p.name)} 的照片">` : A.render(p.avatar)}</div>
      <div class="pf-id">
        <span class="pill" style="--c:${col}"><i></i>${esc(p.industry)}</span>
        <h1>${esc(p.name)}</h1>
        <p class="pf-role">${esc(p.title)}${p.city ? `<span>·</span>${esc(p.city)}` : ''}</p>
        <p class="pf-intro">${esc(p.short_intro)}</p>
        <div class="acts-row">
          ${p.pending ? '' : `<a class="btn red" href="${intro}">請 ${esc(C.OWNER_NAME)} 幫我介紹</a>`}
          <button type="button" class="btn ghost" id="share">分享這頁</button>
        </div>
      </div>
    </section>

    ${info.length ? `<section class="pf-info">${info.map(([t, v]) => `<div><h2>${t}</h2><p>${esc(v)}</p></div>`).join('')}</section>` : ''}

    ${works.length ? `<section class="pf-sec"><div class="pf-sh"><h2>代表作品・指標客戶</h2><span>${works.length} 項</span></div>
      <div class="pf-works">${works.map((w, i) => {
        const body = `<div class="pw-img">${w.img ? `<img src="${esc(w.img)}" alt="${esc(w.title)}" loading="lazy">` : `<span>${esc((w.title || '作品').slice(0, 1))}</span>`}</div>
          <div class="pw-b"><h3>${esc(w.title)}</h3>${w.desc ? `<p>${esc(w.desc)}</p>` : ''}${w.url ? `<span class="pw-go">${esc(K.host(w.url))} ↗</span>` : ''}</div>`;
        return w.url ? `<a class="pw" style="animation-delay:${i * 60}ms" href="${esc(w.url)}" target="_blank" rel="noopener">${body}</a>` : `<article class="pw" style="animation-delay:${i * 60}ms">${body}</article>`;
      }).join('')}</div></section>` : ''}

    ${links.length ? `<section class="pf-sec"><div class="pf-sh"><h2>相關連結</h2></div>
      <div class="pf-links">${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"><b>${esc(l.label)}</b><small>${esc(K.host(l.url))}</small><i aria-hidden="true">↗</i></a>`).join('')}</div></section>` : ''}

    ${p.pending ? '' : `<section class="pf-cta">
      <div><h2>想認識 ${esc(p.name)}？</h2><p>這裡不公開聯絡方式。留下你的需求，${esc(C.OWNER_NAME)} 會先確認雙方意願，再幫你們牽線。</p></div>
      <a class="btn red" href="${intro}">請 ${esc(C.OWNER_NAME)} 幫我介紹</a></section>`}`;

  document.getElementById('share').onclick = async () => {
    const url = location.href, title = `${p.name}｜${p.industry}`;
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast('已複製這頁的連結'); } catch (e) { prompt('複製這頁的連結：', url); }
  };
})();
