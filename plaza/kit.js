/* 人脈廣場｜廣場與個人介紹頁共用：讀取成員、解析一頁式介紹欄位、壓縮圖片 */
window.PlazaKit = (() => {
  const C = window.PLAZA_CONFIG, A = window.Avatar;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const okUrl = u => typeof u === 'string' && u.length <= 400 && /^https?:\/\/[^\s"'<>]+$/i.test(u);
  const okImg = u => okUrl(u) || (typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u));
  const arr = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '連結'; } };

  // 一頁式介紹欄位（舊資料的 profile_url 也當成一個連結）
  function links(p) {
    const out = arr(p.links).filter(l => l && okUrl(l.url)).slice(0, 5)
      .map(l => ({ label: String(l.label || '').trim().slice(0, 20) || host(l.url), url: l.url }));
    if (okUrl(p.profile_url) && !out.some(l => l.url === p.profile_url)) out.unshift({ label: '一頁式介紹', url: p.profile_url });
    return out;
  }
  function works(p) {
    return arr(p.works).filter(w => w && (String(w.title || '').trim() || okImg(w.img))).slice(0, 6).map(w => ({
      title: String(w.title || '').trim().slice(0, 30), desc: String(w.desc || '').trim().slice(0, 120),
      img: okImg(w.img) ? w.img : '', url: okUrl(w.url) ? w.url : ''
    }));
  }
  const photo = p => okImg(p.photo) ? p.photo : '';

  async function loadPeople() {
    if (C.API_URL) {
      const r = await fetch(C.API_URL + (C.API_URL.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now());
      if (!r.ok) throw new Error('load');
      const j = await r.json();
      return (j.people || []).map(p => ({ ...p, avatar: p.avatar ? A.normalize(p.avatar) : A.randomFor(p.id, null, p.industry) }));
    }
    const seed = window.PLAZA_SEED.map(p => ({ ...p, avatar: A.randomFor(p.id, p.g, p.industry) }));
    // Demo：這台瀏覽器送出的加入申請（審核中 / Demo 後台核准後正常顯示）
    const mine = LS.get('plaza_demo_db', []).filter(x => x.kind === 'join' && x.active !== false)
      .map(x => ({ ...x, avatar: A.normalize(x.avatar), pending: !x.approved }));
    return seed.concat(mine);
  }

  // 手機照片動輒 3–8 MB，先縮成長邊 max 的 JPEG 再上傳
  function compress(file, max, quality) {
    max = max || 1000; quality = quality || .82;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || 'image/')) return reject(new Error('請選擇圖片檔'));
      if (file.size > 25 * 1024 * 1024) return reject(new Error('圖片太大了，請選 25 MB 以下的照片'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight;
        const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        let q = quality, out = cv.toDataURL('image/jpeg', q);
        while (out.length > 450000 && q > .45) { q -= .12; out = cv.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('這張圖片讀不到，請改用 JPG 或 PNG')); };
      img.src = url;
    });
  }

  return { C, esc, LS, okUrl, okImg, host, links, works, photo, loadPeople, compress };
})();
