/* 查 ESPN 某些聯賽某幾天有沒有比賽（GitHub Actions 上跑；沙盒連不到 ESPN）
   用法：node tools/probe.js "soccer/jpn.w.1:20261123,soccer/afc.champions:20261124" */
const list = String(process.argv[2] || "").split(",").filter(Boolean);
(async () => {
  for (const item of list) {
    const [path, dates] = item.split(":");
    const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard${dates ? `?dates=${dates}` : ""}`;
    try {
      const r = await fetch(url);
      const j = r.ok ? await r.json() : {};
      const ev = (j.events || []).map((e) => `${e.date} ${e.name} [${e.id}]`);
      console.log(`== ${path} ${dates || ""} → ${r.status} ${j.leagues?.[0]?.name || ""}`);
      for (const x of ev) console.log("   " + x);
    } catch (err) {
      console.log(`== ${path} ${dates || ""} → ERR ${err.message}`);
    }
  }
})();
