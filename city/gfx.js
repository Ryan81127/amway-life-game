/* 升級城：畫質設定與自動降級
   高畫質：車輛陰影與玻璃反光、第一人稱太陽光暈與夜空星星。
   省電：關閉以上特效。遊戲卡頓（連續多秒掉幀）時會自動切到省電，並在 📱 →「設定」可以手動切換。 */
(function(){
"use strict";
let samples=[],lastT=performance.now(),autoOff=false;
function setGfx(v){S.gfx=v;autoOff=v=="lo";try{save()}catch(e){}}
window.gfxSet=setGfx;
// frame timing: if the average frame is slow for ~4s, drop to 省電 once
function monitor(){const now=performance.now(),dt=now-lastT;lastT=now;if(!STARTED||PAUSE||dt>400)return;
 samples.push(dt);if(samples.length>240)samples.shift();
 if(samples.length==240&&gfxHi()&&!autoOff){const avg=samples.reduce((a,b)=>a+b,0)/samples.length;if(avg>26){setGfx("lo");toast("⚡ 已自動切換省電畫質","手機較慢，已關閉部分特效。想換回來可以到 📱 →「設定」。","#ffd23d")}samples=[]}}
// hook the frame loop via requestAnimationFrame wrapper (loop itself is a function declaration)
const raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=function(cb){return raf(function(t){monitor();cb(t)})};
// settings tab: toggle button
const _rp=renderPhone;renderPhone=function(){const r=_rp.apply(this,arguments);const b=document.getElementById("sGfx");if(b)b.onclick=()=>{setGfx(gfxHi()?"lo":"hi");renderPhone();toast(gfxHi()?"✨ 已切換高畫質":"⚡ 已切換省電","","#5ec8ff")};return r};
})();
