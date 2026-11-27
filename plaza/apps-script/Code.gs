/**
 * 人脈廣場｜Google Apps Script 後端
 * - setup():執行一次，在你的 Google 帳號建立私人資料表（成員 / 介紹需求 / 找廠商需求）
 * - doPost:網站的「我想加入」「請幫我介紹」「請 Ryan 幫我找廠商」直接寫進資料表，並寄通知信
 * - doGet:公開 API，只輸出已核准成員的白名單欄位（絕不含手機、Email、LINE）
 * - doGet?admin=1:私人後台，只有 OWNER 這個 Google 帳號能開
 * - 一頁式介紹的照片與作品圖片存在雲端硬碟「人脈廣場圖片」資料夾（知道連結的人可檢視）
 *
 * 更新程式碼後：先執行一次 setup()（補新欄位、建立圖片資料夾、授權雲端硬碟），
 * 再到「部署 → 管理部署作業」把兩個部署都編輯成「新版本」，網址才不會變。
 */
const OWNER = 'ryan.ttm81127@gmail.com';
const PAGES = 'https://ryan81127.github.io/amway-life-game/plaza/';

const SHEETS = {
  member: { name: '成員', cols: ['id', 'created_at', 'name', 'industry', 'title', 'city', 'short_intro', 'services', 'can_help_with', 'looking_for', 'profile_url', 'avatar', 'phone', 'email', 'line_id', 'source_circle', 'consent', 'approved', 'active', 'note', 'photo', 'links', 'works'] },
  match: { name: '介紹需求', cols: ['id', 'created_at', 'status', 'requester', 'contact', 'target_id', 'target_name', 'target_industry', 'why', 'need', 'next_step', 'note'] },
  need: { name: '找廠商需求', cols: ['id', 'created_at', 'status', 'need', 'detail', 'area', 'timeline', 'requester', 'contact', 'note'] }
};
const PUBLIC = ['id', 'name', 'industry', 'title', 'city', 'short_intro', 'services', 'can_help_with', 'looking_for', 'profile_url', 'avatar', 'photo', 'links', 'works'];
const STATUS = { match: ['新需求', '已聯絡', '已介紹', '洽談中', '成交', '不處理'], need: ['新需求', '尋找中', '已找到廠商', '已介紹', '不處理'] };
const REQUIRED = { member: ['name', 'industry', 'title', 'short_intro', 'services', 'looking_for'], match: ['requester', 'contact', 'why'], need: ['need', 'detail', 'requester', 'contact'] };

/* ---------- 一次性設定 ---------- */
function setup() {
  const P = PropertiesService.getScriptProperties();
  let ss = P.getProperty('SHEET_ID') && SpreadsheetApp.openById(P.getProperty('SHEET_ID'));
  if (!ss) { ss = SpreadsheetApp.create('人脈廣場資料庫（私人）'); P.setProperty('SHEET_ID', ss.getId()); }
  Object.keys(SHEETS).forEach((k, i) => {
    const def = SHEETS[k];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = i === 0 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(def.name) : ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) { sh.appendRow(def.cols); sh.setFrozenRows(1); }
    head_(sh, def.cols);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#f6f1e7');
  });
  const folder = imgFolder_();
  Logger.log('資料表已就緒：' + ss.getUrl());
  Logger.log('圖片資料夾：' + folder.getUrl());
  Logger.log('下一步：部署 → 新增部署作業 → 網頁應用程式（請看 README）');
}

/* ---------- 工具 ---------- */
function ss_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')); }
function sheet_(k) { return ss_().getSheetByName(SHEETS[k].name); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function yes_(v) { return v === true || v === 'TRUE' || v === 'true'; }
function rows_(k) {
  const sh = sheet_(k), v = sh.getDataRange().getValues(), h = v.shift();
  return v.map(r => { const o = {}; h.forEach((c, j) => o[c] = r[j] instanceof Date ? r[j].toISOString() : r[j]); return o; });
}
// 讀表頭；缺少的欄位補在最後面（舊資料表升級用）
function head_(sh, cols) {
  const n = Math.max(1, sh.getLastColumn());
  const h = sh.getRange(1, 1, 1, n).getValues()[0].map(String).filter(Boolean);
  const miss = (cols || []).filter(c => h.indexOf(c) < 0);
  if (miss.length) { sh.getRange(1, h.length + 1, 1, miss.length).setValues([miss]); return h.concat(miss); }
  return h;
}
function col_(sh, name) {
  const i = head_(sh).indexOf(name);
  if (i < 0) throw new Error('資料表少了欄位：' + name + '，請重新執行 setup');
  return i + 1;
}
function imgFolder_() {
  const P = PropertiesService.getScriptProperties(), id = P.getProperty('IMG_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('人脈廣場圖片');
  P.setProperty('IMG_FOLDER', f.getId());
  return f;
}
// 網站送來的 data:image/...;base64 存成雲端硬碟檔案，回傳可嵌入的圖片網址
function saveImg_(dataUrl, name) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return '';
  if (m[2].length > 1400000) throw new Error('圖片太大，請換一張小一點的照片');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1], name + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
  const file = imgFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
}
const okUrl_ = u => typeof u === 'string' && u.length <= 400 && /^https?:\/\/[^\s"'<>]+$/i.test(u);
function arr_(s) { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function cleanLinks_(s) {
  return arr_(s).filter(l => l && okUrl_(l.url)).slice(0, 5).map(l => ({ label: String(l.label || '').trim().slice(0, 20), url: l.url }));
}
function cleanWorks_(s, base) {
  return arr_(s).filter(w => w && String(w.title || '').trim()).slice(0, 6).map((w, i) => ({
    title: String(w.title).trim().slice(0, 30), desc: String(w.desc || '').trim().slice(0, 120),
    img: saveImg_(w.img, base + '-作品' + (i + 1)), url: okUrl_(w.url) ? w.url : ''
  }));
}
function findRow_(k, id) {
  const sh = sheet_(k), ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return { sh: sh, row: i + 2 };
  throw new Error('找不到資料：' + id);
}
function cleanAvatar_(s) {
  // 只保留白名單欄位，顏色必須是 #RRGGBB
  let a = {}; try { a = JSON.parse(s || '{}'); } catch (e) { }
  const ok = /^#[0-9a-f]{6}$/i, o = {};
  o.g = a.g === 'f' ? 'f' : 'm';
  ['hair', 'top', 'bottom'].forEach(k => { if (/^[a-z]{2,10}$/.test(a[k] || '')) o[k] = a[k]; });
  ['skin', 'hairColor', 'topColor', 'bottomColor'].forEach(k => { if (ok.test(a[k] || '')) o[k] = a[k]; });
  return JSON.stringify(o);
}
function adminUrl_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_URL') || ss_().getUrl(); }
function notify_(subject, body) {
  try { MailApp.sendEmail(OWNER, subject, body + '\n\n打開私人後台：' + adminUrl_() + '\n資料表：' + ss_().getUrl()); } catch (e) { }
}

/* ---------- 網站送出 ---------- */
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // 機器人陷阱
    const cache = CacheService.getScriptCache(), n = Number(cache.get('rl') || 0);
    if (n > 60) return json_({ ok: false, error: '目前送出太頻繁，請稍後再試' });
    cache.put('rl', String(n + 1), 600);

    const kind = d.kind === 'join' ? 'member' : d.kind;
    if (!SHEETS[kind]) throw new Error('未知的表單類型');
    const v = k => String(d[k] == null ? '' : d[k]).trim().slice(0, 600);
    REQUIRED[kind].forEach(k => { if (!v(k)) throw new Error('請填寫所有必填欄位'); });

    const rec = { id: kind[0] + Utilities.getUuid().slice(0, 8), created_at: new Date(), note: '' };
    if (kind === 'member') {
      if (v('consent') !== 'yes') throw new Error('請勾選同意公開');
      if (!v('phone') && !v('line_id') && !v('email')) throw new Error('聯絡方式請至少留一項');
      SHEETS.member.cols.forEach(c => { if (rec[c] === undefined) rec[c] = v(c); });
      rec.avatar = cleanAvatar_(d.avatar);
      if (!okUrl_(rec.profile_url)) rec.profile_url = '';
      const base = rec.name.replace(/[\\/:*?"<>|]/g, '') + '-' + rec.id;
      rec.photo = saveImg_(d.photo, base + '-照片');
      rec.links = JSON.stringify(cleanLinks_(d.links));
      rec.works = JSON.stringify(cleanWorks_(d.works, base));
      rec.approved = false; rec.active = true;
    } else {
      SHEETS[kind].cols.forEach(c => { if (rec[c] === undefined) rec[c] = v(c); });
      rec.status = '新需求';
    }
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const sh = sheet_(kind), h = head_(sh, SHEETS[kind].cols);
      sh.appendRow(h.map(c => rec[c] === undefined ? '' : rec[c]));
      if (kind === 'member') {
        const r = sh.getLastRow();
        sh.getRange(r, h.indexOf('approved') + 1).insertCheckboxes().setValue(false);
        sh.getRange(r, h.indexOf('active') + 1).insertCheckboxes().setValue(true);
      }
    } finally { lock.releaseLock(); }
    CacheService.getScriptCache().remove('public');

    if (kind === 'member') notify_('【人脈廣場】新的加入申請：' + rec.name + '(' + rec.industry + ')', rec.name + ' 申請加入。\n想認識：' + rec.looking_for +
      '\n一頁式介紹：' + (rec.photo ? '有照片' : '沒有照片') + '、' + JSON.parse(rec.links).length + ' 個連結、' + JSON.parse(rec.works).length + ' 項作品');
    if (kind === 'match') notify_('【人脈廣場】' + rec.requester + ' 想認識 ' + rec.target_name, '原因：' + rec.why + '\n聯絡方式：' + rec.contact);
    if (kind === 'need') notify_('【人脈廣場】有人在找「' + rec.need + '」', rec.requester + ':' + rec.detail + '\n地區：' + rec.area + ' / ' + rec.timeline + '\n聯絡方式：' + rec.contact);
    return json_({ ok: true, id: rec.id });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- 公開 API 與後台入口 ---------- */
function doGet(e) {
  if (e && e.parameter && e.parameter.admin) {
    if (Session.getActiveUser().getEmail() !== OWNER) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">沒有權限。請用管理者的 Google 帳號登入。</p>');
    return HtmlService.createHtmlOutput(ADMIN_HTML.replace(/__PAGES__/g, PAGES))
      .setTitle('人脈廣場後台').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const cache = CacheService.getScriptCache(), hit = cache.get('public');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const people = rows_('member').filter(p => yes_(p.approved) && yes_(p.active))
    .map(p => { const o = {}; PUBLIC.forEach(c => o[c] = p[c]); return o; });
  const out = JSON.stringify({ people: people, updated: new Date().toISOString() });
  try { cache.put('public', out, 60); } catch (e) { } // 超過 100 KB 時快取放不下，直接回傳
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 後台用（每次都驗證身分）---------- */
function guard_() { if (Session.getActiveUser().getEmail() !== OWNER) throw new Error('沒有權限'); }
function adminData() {
  guard_();
  const members = rows_('member');
  return { members: members, matches: rows_('match'), needs: rows_('need'), industries: members.filter(m => yes_(m.approved) && yes_(m.active)).map(m => m.industry) };
}
function adminSetMember(id, patch) {
  guard_();
  const f = findRow_('member', id);
  ['approved', 'active'].forEach(k => { if (patch && k in patch) f.sh.getRange(f.row, col_(f.sh, k)).setValue(!!patch[k]); });
  CacheService.getScriptCache().remove('public');
  return true;
}
function adminSetStatus(kind, id, status) {
  guard_();
  if (!STATUS[kind] || STATUS[kind].indexOf(status) < 0) throw new Error('狀態不正確');
  const f = findRow_(kind, id); f.sh.getRange(f.row, col_(f.sh, 'status')).setValue(status);
  return true;
}
function adminSetNote(kind, id, note) {
  guard_();
  if (!SHEETS[kind]) throw new Error('類型不正確');
  const f = findRow_(kind, id); f.sh.getRange(f.row, col_(f.sh, 'note')).setValue(String(note || '').slice(0, 500));
  return true;
}

const ADMIN_HTML = `<!DOCTYPE html><html><head><base target="_blank">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="__PAGES__admin.css"></head><body><div id="app">載入中…</div>
<script src="__PAGES__avatar.js"></script><script src="__PAGES__admin-ui.js"></script>
<script>
const run = (fn, ...a) => new Promise((res, rej) => google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...a));
PlazaAdmin.mount(document.getElementById('app'), {
  mode: 'live', siteUrl: '__PAGES__',
  extraTools: '<a class="btn red sm" href="__PAGES__">打開廣場</a>',
  load: () => run('adminData'),
  setMember: (id, p) => run('adminSetMember', id, p),
  setStatus: (k, id, s) => run('adminSetStatus', k, id, s),
  setNote: (k, id, n) => run('adminSetNote', k === 'member' ? 'member' : k, id, n)
});
</script></body></html>`;
