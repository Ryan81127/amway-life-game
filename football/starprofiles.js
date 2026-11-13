/* 球星資料庫：只放查過、能對到來源的生涯事實。沒有收錄的人不會走這裡。
   新增一位：
   1. 複製下面任一筆，貼進 STAR_PROFILES。
   2. id 用 ESPN 球員頁網址裡的數字（…/player/_/id/236586/…）。
   3. names 寫 ESPN 的英文名，連字號、空格都各放一條。
   4. style / honours / story / say 只寫 sources 打得開的事實，不要猜慣用腳，也不要寫盤口。
   5. sources 至少一條 { name, url }，checked 填查證日期 YYYY-MM-DD。
   6. say 是主播要念的那幾句（資料放前面、句子短）。畫面上的「資料庫」標籤會標出這些字。
   沒加進去的球員，看板仍會用 ESPN 的年齡、位置、身高、俱樂部、本季數字和近況趨勢寫口播。 */

const STAR_PROFILES = [
  {
    id: "236586",
    names: ["Hassan Al-Haydos", "Hassan Al Haydos"],
    style: ["前鋒"],
    honours: [
      "2019、2023 兩屆亞洲盃冠軍，兩次都是以隊長身份拿下",
      "2011 年隨薩德拿下亞冠，世俱盃季軍"
    ],
    story: "2024 年 3 月 16 日曾宣布退出國家隊，當時 183 場、41 球，是卡達出場最多的人。這個數字停在宣布當天，之後的出場以 ESPN 名單為準。",
    say: "2019、2023 兩屆亞洲盃，他都是以隊長身份帶隊拿冠軍。2011 年還隨薩德拿下亞冠，世俱盃拿季軍。2024 年 3 月 16 日他曾宣布退出國家隊，當時 183 場、41 球，卡達出場最多。這個數字停在宣布那天。",
    sources: [
      { name: "英文維基百科", url: "https://en.wikipedia.org/wiki/Hassan_Al-Haydos" },
      { name: "中文維基百科", url: "https://zh.wikipedia.org/wiki/%E5%93%88%E6%A1%91%C2%B7%E6%B5%B7%E5%A4%9A%E6%96%AF" }
    ],
    checked: "2026-11-13"
  },
  {
    id: "219258",
    names: ["Akram Afif"],
    style: ["左路側翼"],
    honours: [
      "2019 亞洲盃冠軍，整屆 10 次助攻，寫下該屆紀錄",
      "2023 亞洲盃冠軍，並拿下金靴",
      "隨薩德多次拿下卡達聯賽，含 2024–25、2025–26"
    ],
    story: "左路側翼。2019 那屆亞洲盃，他的工作是把球送進禁區，助攻數是那一屆最多的。",
    say: "左路側翼。2019 亞洲盃他送出 10 次助攻，是那一屆最多的。2023 亞洲盃再拿冠軍，個人金靴。",
    sources: [
      { name: "英文維基百科", url: "https://en.wikipedia.org/wiki/Akram_Afif" },
      { name: "中文維基百科", url: "https://zh.wikipedia.org/wiki/%E9%98%BF%E5%85%8B%E6%8B%89%E5%A7%86%C2%B7%E9%98%BF%E8%8F%B2%E5%A4%AB" }
    ],
    checked: "2026-11-13"
  },
  {
    id: "332081",
    names: ["Alessandro Circati"],
    style: ["中後衛"],
    honours: [
      "2023–24 隨帕爾馬拿下義乙冠軍",
      "2023、2025 代表澳洲參加 Soccer Ashes"
    ],
    story: "義大利出生，青少年時期曾代表義大利，後來改踢澳洲，也曾是澳洲隊長。",
    say: "中後衛。義大利出生，青少年時期曾代表義大利，後來改踢澳洲，也曾是澳洲隊長。2023–24 隨帕爾馬拿下義乙冠軍。",
    sources: [
      { name: "英文維基百科", url: "https://en.wikipedia.org/wiki/Alessandro_Circati" },
      { name: "中文維基百科", url: "https://zh.wikipedia.org/wiki/%E4%BA%9E%E6%AD%B7%E5%B1%B1%E5%BE%B7%E7%BE%85%C2%B7%E5%A5%87%E7%88%BE%E5%8D%A1%E8%92%82" }
    ],
    checked: "2026-11-13"
  },
  {
    id: "328535",
    names: ["Nestory Irankunda"],
    style: ["邊鋒", "百科寫他的特點是速度跟射門力量"],
    honours: [
      "2023–24 澳職年度最佳年輕球員",
      "2026 年 FIFA Series 澳洲站最佳球員"
    ],
    story: "坦尚尼亞出生，父母來自蒲隆地，代表澳洲。",
    say: "邊鋒。坦尚尼亞出生，父母來自蒲隆地，代表澳洲。百科寫他的特點是速度跟射門力量。2023–24 拿下澳職年度最佳年輕球員，2026 年 FIFA Series 澳洲站最佳球員。",
    sources: [
      { name: "英文維基百科", url: "https://en.wikipedia.org/wiki/Nestory_Irankunda" }
    ],
    checked: "2026-11-13"
  },
  {
    id: "200414",
    names: ["Aziz Behich"],
    style: ["左後衛"],
    honours: [
      "2015 亞洲盃冠軍成員",
      "2023 亞洲盃入選最佳陣容",
      "2019–20 隨巴薩克謝希爾拿下土超",
      "2025 隨墨爾本城拿下澳職總冠軍"
    ],
    story: "澳洲左路老將，2015 年那屆亞洲盃就在冠軍名單裡。",
    say: "左後衛。2015 亞洲盃冠軍成員，2023 亞洲盃入選最佳陣容。2019–20 隨巴薩克謝希爾拿下土超，2025 隨墨爾本城拿下澳職總冠軍。",
    sources: [
      { name: "英文維基百科", url: "https://en.wikipedia.org/wiki/Aziz_Behich" },
      { name: "中文維基百科", url: "https://zh.wikipedia.org/wiki/%E9%98%BF%E9%BD%90%E5%85%B9%C2%B7%E8%B4%9D%E5%B8%8C%E5%A5%87" }
    ],
    checked: "2026-11-13"
  }
];

function starNameKey(name) {
  return plainKey(name).replace(/[-'.’]/g, " ").replace(/\s+/g, " ").trim();
}

function starProfile(id, en) {
  const key = starNameKey(en || "");
  const sid = String(id || "");
  return STAR_PROFILES.find((p) => (sid && p.id === sid) || (key && (p.names || []).some((n) => starNameKey(n) === key))) || null;
}
