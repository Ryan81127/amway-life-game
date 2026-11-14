/* 人脈廣場｜人物形象系統
 * Avatar.render(cfg) 回傳 SVG 字串;所有欄位都經過白名單驗證,避免惡意資料注入。 */
(function (g) {
  const SKIN = ['#f7d7bf', '#efc19f', '#dfa77f', '#c08560', '#94603f', '#63402b'];
  const HAIR = [['short', '短髮'], ['side', '旁分'], ['buzz', '平頭'], ['spiky', '抓髮'], ['bob', '鮑伯頭'], ['long', '長髮'], ['ponytail', '馬尾'], ['bun', '包頭']];
  const HAIR_COLORS = ['#1d1a18', '#3a2a20', '#6a4a30', '#a5743f', '#8b8f97', '#7c2f2c'];
  const TOPS = [['tee', 'T恤'], ['shirt', '襯衫'], ['polo', 'Polo衫'], ['blazer', '西裝外套'], ['hoodie', '連帽衫'], ['vest', '工作背心']];
  const BOTTOMS = [['slacks', '西裝褲'], ['jeans', '牛仔褲'], ['cargo', '工作褲'], ['shorts', '短褲'], ['skirt', '裙子']];
  const COLORS = ['#1f3a5f', '#c8352b', '#2f6f5e', '#d9a441', '#f3efe6', '#34363b', '#6d5aa6', '#4f86c6', '#b0693a', '#e58fa4', '#e0702b', '#5c6b4a'];
  const HEX = /^#[0-9a-f]{6}$/i;
  const ids = a => a.map(x => x[0]);

  const DEFAULT = { g: 'm', skin: SKIN[1], hair: 'short', hairColor: HAIR_COLORS[0], top: 'tee', topColor: COLORS[2], bottom: 'jeans', bottomColor: '#3d5a80' };

  function normalize(c) {
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = {}; } }
    c = c || {};
    const pick = (v, list, d) => list.indexOf(v) >= 0 ? v : d;
    const col = (v, d) => (typeof v === 'string' && HEX.test(v)) ? v : d;
    return {
      g: c.g === 'f' ? 'f' : 'm',
      skin: col(c.skin, DEFAULT.skin),
      hair: pick(c.hair, ids(HAIR), c.g === 'f' ? 'bob' : 'short'),
      hairColor: col(c.hairColor, DEFAULT.hairColor),
      top: pick(c.top, ids(TOPS), DEFAULT.top),
      topColor: col(c.topColor, DEFAULT.topColor),
      bottom: pick(c.bottom, ids(BOTTOMS), DEFAULT.bottom),
      bottomColor: col(c.bottomColor, DEFAULT.bottomColor)
    };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const light = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) > 175; };

  function backHair(h, c) {
    switch (h) {
      case 'long': return `<path fill="${c}" d="M18 24C17 11 24 8.5 32 8.5S47 11 46 24L48.5 57Q32 61.5 15.5 57Z"/>`;
      case 'bob': return `<path fill="${c}" d="M17.5 26C17 12 24 9 32 9S47 12 46.5 26L47.5 41Q44 43 41 41V31H23V41Q20 43 16.5 41Z"/>`;
      case 'ponytail': return `<path fill="${c}" d="M41 14C53 13 55.5 30 51 46C49 37 46.5 29 42 24Z"/>`;
      case 'bun': return `<circle cx="32" cy="9" r="6.5" fill="${c}"/>`;
      default: return '';
    }
  }
  function frontHair(h, c) {
    switch (h) {
      case 'side': return `<path fill="${c}" d="M19 27C18 14 26 9.5 33 10S46 16 45 26C44 21 41 17.5 36 17C33 20.5 26 21 19 27Z"/>`;
      case 'buzz': return `<path fill="${c}" opacity=".88" d="M19.6 24C20 15 26 12.5 32 12.5S44 15 44.4 24C39 19.5 25 19.5 19.6 24Z"/>`;
      case 'spiky': return `<path fill="${c}" d="M19 26L17.5 17L22 18L22.5 11L27 14L30 7.5L33.5 13L37.5 8.5L39 14L43.5 11.5L42.5 18L46.5 17.5L45 26C41 19 23 19 19 26Z"/>`;
      case 'bob': case 'long': return `<path fill="${c}" d="M19 26C19 13.5 25 10.5 32 10.5S45 13.5 45 26C42 20 37 17.5 31 20.5C27 18.5 22 20 19 26Z"/>`;
      case 'ponytail': case 'bun': return `<path fill="${c}" d="M19 26C18.5 14 25 10.5 32 10.5S45.5 14 45 26C41 19.5 35 18 29 19.5C25 20 21 22 19 26Z"/>`;
      default: return `<path fill="${c}" d="M19 27C18 15 25 10.5 32 10.5S46 15 45 27C43 21 40 18.5 35 18C30 18 24 19 19 27Z"/>`;
    }
  }

  function render(cfg, opt) {
    const c = normalize(cfg), f = c.g === 'f';
    const sk = c.skin, hc = c.hairColor, tc = c.topColor, bc = c.bottomColor;
    const td = shade(tc, -.28), bd = shade(bc, -.25), white = '#f6f3ec';
    const longSleeve = ['shirt', 'blazer', 'hoodie'].indexOf(c.top) >= 0;
    const vest = c.top === 'vest', baseTop = vest ? '#e9e5dc' : tc;
    const ax = f ? 15 : 13, axr = f ? 42 : 44;
    // 腿
    const legSkin = c.bottom === 'shorts' || c.bottom === 'skirt';
    const leg = (x) => {
      let s = `<rect x="${x}" y="71" width="7.5" height="32" rx="3.5" fill="${legSkin ? sk : bc}"/>`;
      if (c.bottom === 'shorts') s += `<rect x="${x - .5}" y="70" width="8.5" height="15" rx="2" fill="${bc}"/>`;
      if (c.bottom === 'jeans') s += `<path d="M${x + 5.5} 74V101" stroke="${shade(bc, .25)}" stroke-width=".8"/>`;
      if (c.bottom === 'cargo') s += `<rect x="${x + .5}" y="83" width="6.5" height="6" rx="1" fill="${bd}"/>`;
      return s + `<ellipse cx="${x + 3.6}" cy="104" rx="5.4" ry="2.9" fill="#26211e"/>`;
    };
    // 手
    const arm = (x) => {
      const sleeve = longSleeve ? `<rect x="${x}" y="41" width="7" height="25" rx="3.5" fill="${baseTop}"/>`
        : `<rect x="${x}" y="41" width="7" height="25" rx="3.5" fill="${sk}"/><rect x="${x - .4}" y="40.5" width="7.8" height="11" rx="3.5" fill="${baseTop}"/>`;
      return sleeve + `<circle cx="${x + 3.5}" cy="67.5" r="3.4" fill="${sk}"/>`;
    };
    const torso = f
      ? 'M20 44Q20 40 24 39H40Q44 40 44 44L42.5 56Q41 62 43 71H21Q23 62 21.5 56Z'
      : 'M18 44Q18 40 23 39H41Q46 40 46 44L44.5 71H19.5Z';
    let top = `<path d="${torso}" fill="${baseTop}"/>`;
    switch (c.top) {
      case 'tee': top += `<path d="M28 39Q32 43.5 36 39" fill="${sk}"/>`; break;
      case 'shirt': top += `<path d="M28 39Q32 42 36 39" fill="${sk}"/><path d="M26 38.5L32 46L28.5 49Z M38 38.5L32 46L35.5 49Z" fill="${light(tc) ? shade(tc, -.12) : white}"/><path d="M32 46V70" stroke="${td}" stroke-width=".7"/><circle cx="32" cy="54" r=".8" fill="${td}"/><circle cx="32" cy="62" r=".8" fill="${td}"/>`; break;
      case 'polo': top += `<path d="M28 39Q32 42 36 39" fill="${sk}"/><path d="M26.5 38.5L32 43.5L29 46Z M37.5 38.5L32 43.5L35 46Z" fill="${td}"/><path d="M32 43V50" stroke="${td}" stroke-width=".9"/>`; break;
      case 'blazer': top += `<path d="M27 39L32 53L37 39Z" fill="${white}"/>` + (f ? '' : `<path d="M31 42H33L34.2 52L32 55L29.8 52Z" fill="#b8322a"/>`) + `<path d="M26.5 39L32 53L28.5 55L24 44Z M37.5 39L32 53L35.5 55L40 44Z" fill="${td}"/><circle cx="33.5" cy="62" r="1" fill="${td}"/>`; break;
      case 'hoodie': top += `<path d="M23 41Q32 49 41 41Q38 36.5 32 36.5T23 41Z" fill="${td}"/><path d="M29.5 44V51M34.5 44V51" stroke="${white}" stroke-width=".8"/><path d="M24.5 60H39.5L38 68H26Z" fill="${td}"/>`; break;
      case 'vest': top += `<path d="M28 39Q32 43 36 39" fill="${sk}"/><path d="${f ? 'M20.5 43L27 39L32 50L37 39L43.5 43L42.5 56Q41 62 43 71H21Q23 62 21.5 56Z' : 'M18.5 43L27 39L32 50L37 39L45.5 43L44.5 71H19.5Z'}" fill="${tc}"/><rect x="${f ? 21.5 : 19.5}" y="59" width="9" height="2.6" fill="#f3d54a"/><rect x="${f ? 33.5 : 34.5}" y="59" width="9" height="2.6" fill="#f3d54a"/>`; break;
    }
    const hips = legSkin ? '' : `<rect x="${f ? 21 : 20}" y="67" width="${f ? 22 : 24}" height="9" rx="2" fill="${bc}"/><rect x="${f ? 21 : 20}" y="67" width="${f ? 22 : 24}" height="2" fill="${bd}"/>`;
    const skirt = c.bottom === 'skirt' ? `<path d="M21 68H43L46.5 88Q32 91 17.5 88Z" fill="${bc}"/><path d="M21 68H43V70.5H21Z" fill="${bd}"/>` : '';
    const shortsTop = c.bottom === 'shorts' ? `<rect x="${f ? 21 : 20}" y="67" width="${f ? 22 : 24}" height="8" rx="2" fill="${bc}"/>` : '';

    const head = `<rect x="28" y="34" width="8" height="7" fill="${shade(sk, -.08)}"/>` +
      `<circle cx="19.6" cy="27.5" r="2.6" fill="${sk}"/><circle cx="44.4" cy="27.5" r="2.6" fill="${sk}"/>` +
      `<circle cx="32" cy="26" r="12.6" fill="${sk}"/>` +
      `<path d="M25.5 23.6Q27.5 22.6 29.5 23.4M34.5 23.4Q36.5 22.6 38.5 23.6" stroke="${shade(hc, -.1)}" stroke-width="1" fill="none" stroke-linecap="round"/>` +
      `<circle cx="27.6" cy="27.8" r="1.45" fill="#2a211c"/><circle cx="36.4" cy="27.8" r="1.45" fill="#2a211c"/>` +
      `<circle cx="25" cy="31.3" r="2" fill="#ef8e83" opacity=".28"/><circle cx="39" cy="31.3" r="2" fill="#ef8e83" opacity=".28"/>` +
      `<path d="M29.6 32.4Q32 34.4 34.4 32.4" stroke="#7a3d33" stroke-width="1" fill="none" stroke-linecap="round"/>` +
      (f ? `<path d="M26 26.6L25 25.6M38 26.6L39 25.6" stroke="#2a211c" stroke-width=".7"/>` : '');

    const cls = (opt && opt.cls) || '';
    return `<svg class="avsvg ${cls}" viewBox="0 0 64 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<g class="bd">${backHair(c.hair, hc)}` +
      `<g class="leg leg-l">${leg(24.2)}</g><g class="leg leg-r">${leg(32.3)}</g>` +
      hips + shortsTop + skirt +
      `<g class="arm arm-l">${arm(ax)}</g><g class="arm arm-r">${arm(axr)}</g>` +
      top + head + frontHair(c.hair, hc) + `</g></svg>`;
  }

  // 依 id 產生穩定的隨機形象(給沒設定形象的人)
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const IND_TOP = { 水電: 'vest', 消防: 'vest', 清潔: 'vest', 汽車: 'vest', 建築: 'shirt', 律師: 'blazer', 會計: 'shirt', 保險: 'blazer', 行銷: 'hoodie', 資訊: 'hoodie', 攝影: 'tee', 室內設計: 'shirt', 餐飲: 'tee', 旅宿: 'polo', 營養: 'polo' };
  const IND_BOTTOM = { 水電: 'cargo', 消防: 'cargo', 清潔: 'cargo', 汽車: 'cargo', 律師: 'slacks', 會計: 'slacks', 保險: 'slacks', 建築: 'slacks' };
  function randomFor(id, gender, industry) {
    let h = hash(id); const r = n => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return h % n; };
    const gg = gender === 'f' ? 'f' : gender === 'm' ? 'm' : (r(2) ? 'f' : 'm');
    const hairs = gg === 'f' ? ['bob', 'long', 'ponytail', 'bun', 'short'] : ['short', 'side', 'buzz', 'spiky', 'side'];
    let bottom = IND_BOTTOM[industry] || ['slacks', 'jeans', 'jeans', 'slacks'][r(4)];
    if (gg === 'f' && bottom === 'slacks' && r(2)) bottom = 'skirt';
    const top = IND_TOP[industry] || TOPS[r(TOPS.length)][0];
    const topColor = top === 'vest' ? ['#e0702b', '#2f6f5e', '#1f3a5f', '#c8352b'][r(4)] : COLORS[r(COLORS.length)];
    return normalize({ g: gg, skin: SKIN[r(4)], hair: hairs[r(hairs.length)], hairColor: HAIR_COLORS[r(4)], top, topColor, bottom, bottomColor: ['#2c2f36', '#3d5a80', '#4a4a3f', '#5c4b3b', '#1f3a5f'][r(5)] });
  }

  const PRESETS = [
    { name: '商務男', g: 'm', skin: SKIN[1], hair: 'side', hairColor: '#1d1a18', top: 'blazer', topColor: '#1f3a5f', bottom: 'slacks', bottomColor: '#2c2f36' },
    { name: '商務女', g: 'f', skin: SKIN[0], hair: 'bob', hairColor: '#3a2a20', top: 'blazer', topColor: '#34363b', bottom: 'skirt', bottomColor: '#34363b' },
    { name: '休閒男', g: 'm', skin: SKIN[2], hair: 'short', hairColor: '#1d1a18', top: 'tee', topColor: '#2f6f5e', bottom: 'jeans', bottomColor: '#3d5a80' },
    { name: '休閒女', g: 'f', skin: SKIN[1], hair: 'ponytail', hairColor: '#6a4a30', top: 'hoodie', topColor: '#e58fa4', bottom: 'jeans', bottomColor: '#3d5a80' },
    { name: '職人', g: 'm', skin: SKIN[3], hair: 'buzz', hairColor: '#1d1a18', top: 'vest', topColor: '#e0702b', bottom: 'cargo', bottomColor: '#4a4a3f' },
    { name: '文青', g: 'f', skin: SKIN[0], hair: 'long', hairColor: '#1d1a18', top: 'shirt', topColor: '#f3efe6', bottom: 'slacks', bottomColor: '#b0693a' }
  ].map(p => Object.assign(normalize(p), { name: p.name }));

  g.Avatar = { SKIN, HAIR, HAIR_COLORS, TOPS, BOTTOMS, COLORS, PRESETS, normalize, render, randomFor };
})(window);
