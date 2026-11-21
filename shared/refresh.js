/* 「重新整理」按鈕共用：
   1. 先看網站有沒有新版（index.html 的 ?v= 版本號變了），有就整頁重新載入，才拿得到新功能與新賽程檔。
   2. 沒有新版就清掉暫存（賽程、快照聯賽），重新抓資料。
   3. 按鈕顯示「更新中…」，完成後顯示「已更新 HH:MM」，失敗也會講。 */
async function siteHasNewVersion() {
  try {
    const res = await fetch(`${location.pathname}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const html = await res.text();
    const want = [...html.matchAll(/<script src="([^"]+\?v=[^"]+)"/g)].map((m) => m[1].split("/").pop());
    const have = new Set([...document.scripts].map((s) => (s.getAttribute("src") || "").split("/").pop()).filter(Boolean));
    return want.some((src) => !have.has(src));
  } catch {
    return false;
  }
}

function refreshFeedback(btn, text, ms = 2500) {
  if (!btn) return;
  btn.textContent = text;
  clearTimeout(btn._rt);
  btn._rt = setTimeout(() => { if (btn.isConnected) btn.textContent = typeof ui === "function" ? ui("重新整理") : "重新整理"; }, ms);
}

async function runRefresh(btn, work) {
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.classList.add("busy"); btn.textContent = typeof ui === "function" ? ui("更新中…") : "更新中…"; }
  try {
    if (await siteHasNewVersion()) {
      if (btn) btn.textContent = typeof ui === "function" ? ui("有新版，重新載入…") : "有新版，重新載入…";
      location.reload();
      return;
    }
    await work();
    const now = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
    const live = document.getElementById(btn?.id) || btn;
    refreshFeedback(live, typeof ui === "function" ? ui(`✓ 已更新 ${now}`) : `✓ 已更新 ${now}`);
  } catch {
    refreshFeedback(document.getElementById(btn?.id) || btn, typeof ui === "function" ? ui("更新失敗，再按一次") : "更新失敗，再按一次", 4000);
  } finally {
    const live = document.getElementById(btn?.id) || btn;
    if (live) { live.disabled = false; live.classList.remove("busy"); }
    if (btn && btn !== live) { btn.disabled = false; btn.classList.remove("busy"); }
  }
}
