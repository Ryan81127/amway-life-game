/* 升級城：空氣污染來襲＋SKY 空氣清淨機保護網
   只被 city/index.html 載入，放在主程式與 net.js 之後；從外面包住 render、renderFP、drawMini、drawHUD、renderPhone。
   - 每個遊戲日大約一次：細菌與 PM2.5 從四面八方出現，慢慢追著主角跑，持續約 10 秒。碰到會扣信用值。
   - 商城（📱 →「商城」）用遊戲錢包購買 SKY 空氣清淨機。錢包來源：每天結算時新增的示範獎金。
   - 購買後出現 🌀 按鈕（電腦按 R）：主角周圍形成保護網 20 秒，淨化靠近的細菌與 PM2.5；用完需要充電 60 秒。 */
(function(){
"use strict";
const PRICE=2000,ATTACK=10,SHIELD=20,RECHARGE=60,SHIELD_R=115,SPEED=165;
const A=window.AIR={on:false,t:0,mob:[],shield:0,cd:0,warn:0,next:null,hitCD:0,lastT:performance.now()};
const me=()=>PL.car||PL;
S.wallet=S.wallet||0;

/* ---------- schedule: about once per game day ---------- */
function planDay(){if(S.airDay===S.day){A.next=null;return}A.next={day:S.day,at:(10+Math.random()*9)*60}}
planDay();
function maybeStart(){
 if(A.on||!A.next)return;
 if(S.day!==A.next.day){planDay();return}
 if(S.clock<A.next.at)return;
 if(MS&&MS.chase)return;               // 謠言大追緝進行中先不打擾
 start();
}
function start(){
 A.on=true;A.t=ATTACK;A.mob=[];A.next=null;S.airDay=S.day;try{save()}catch(e){}
 const o=me();
 for(let i=0;i<10;i++){const ang=i/10*Math.PI*2+Math.random()*.4,d=560+Math.random()*260,pm=i%2==1;
  A.mob.push({x:o.x+Math.cos(ang)*d,y:o.y+Math.sin(ang)*d,pm,ph:Math.random()*6,sp:SPEED*(.8+Math.random()*.4),dead:0,hit:0})}
 tone(880,.18,"square",.05);tone(660,.25,"square",.05,0,.2);tone(880,.18,"square",.05,0,.45);
 toast("⚠️ 空氣品質警報","細菌和 PM2.5 從四面八方來襲，持續約 10 秒！"+(S.hasSky?"按 🌀 開啟 SKY 保護網。":"快跑開！可以到 📱 →「商城」用遊戲錢包買 SKY 空氣清淨機。"),"#9be15d");
 if(S.hasSky)$("#bSky").classList.add("glow");
}
function end(){A.on=false;A.mob=[];$("#bSky").classList.remove("glow");toast("🌤 空氣恢復清新","這波細菌和 PM2.5 散去了。","#57ff8a")}
window.airStart=start;

/* ---------- per-frame update ---------- */
function tick(dt){
 if(A.shield>0){A.shield-=dt;if(A.shield<=0){A.shield=0;A.cd=RECHARGE;toast("🌀 SKY 保護網結束","清淨機充電中（60 秒）。","#5ec8ff")}}
 else if(A.cd>0)A.cd=Math.max(0,A.cd-dt);
 if(A.hitCD>0)A.hitCD-=dt;
 maybeStart();
 if(!A.on)return;
 A.t-=dt;const o=me();
 for(const m of A.mob){
  if(m.dead>0){m.dead-=dt;continue}
  const dx=o.x-m.x,dy=o.y-m.y,d=Math.hypot(dx,dy)||1;
  m.x+=dx/d*m.sp*dt+Math.sin(TIME*3+m.ph)*18*dt;m.y+=dy/d*m.sp*dt+Math.cos(TIME*2.6+m.ph)*18*dt;
  if(A.shield>0&&d<SHIELD_R){m.dead=.5;burst(m.x,m.y,"#7fe3ff",14);float(m.x,m.y-20,"淨化！+5 EXP","#7fe3ff");S.exp+=5;tone(1200,.08,"triangle",.04);continue}
  if(d<(PL.car?32:24)&&A.hitCD<=0){A.hitCD=.8;PL.credit-=m.pm?5:7;SFX.crash();float(o.x,o.y-34,m.pm?"咳咳…PM2.5！":"被細菌碰到了！","#9be15d");
   m.x-=dx/d*90;m.y-=dy/d*90;if(PL.credit<=0){A.on=false;A.mob=[];wasted();return}}
 }
 A.mob=A.mob.filter(m=>!(m.dead<0));
 if(A.t<=0||!A.mob.some(m=>m.dead<=0))end();
}

/* ---------- drawing ---------- */
function germ(x,y,s,m){
 if(m.pm){ctx.fillStyle="rgba(70,62,55,.78)";for(let k=0;k<7;k++){const a=k/7*6.28+TIME*.8+m.ph;ctx.beginPath();ctx.arc(x+Math.cos(a)*13*s,y+Math.sin(a)*10*s,(9+4*Math.sin(TIME*3+k))*s,0,7);ctx.fill()}
  ctx.font=`900 ${Math.max(9,12*s)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=3;ctx.strokeStyle="#222";ctx.strokeText("PM2.5",x,y);ctx.fillStyle="#ffe14d";ctx.fillText("PM2.5",x,y)}
 else{ctx.font=`${Math.max(12,30*s)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🦠",x,y+Math.sin(TIME*6+m.ph)*3*s)}
}
function shieldTop(o){const r=SHIELD_R,p=(Math.sin(TIME*4)+1)/2;
 const g=ctx.createRadialGradient(o.x,o.y,r*.2,o.x,o.y,r);g.addColorStop(0,"rgba(120,220,255,0)");g.addColorStop(.75,"rgba(120,220,255,.12)");g.addColorStop(1,"rgba(120,220,255,.35)");
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y,r,0,7);ctx.fill();
 ctx.strokeStyle=`rgba(160,235,255,${.55+p*.35})`;ctx.lineWidth=3;ctx.setLineDash([14,10]);ctx.lineDashOffset=-TIME*40;ctx.beginPath();ctx.arc(o.x,o.y,r-4,0,7);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="#fff";ctx.font="900 14px 'Noto Sans TC',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=4;ctx.strokeStyle="#0a6d8f";ctx.strokeText("SKY 保護網 "+Math.ceil(A.shield)+"s",o.x,o.y-r-12);ctx.fillText("SKY 保護網 "+Math.ceil(A.shield)+"s",o.x,o.y-r-12)}
function drawTop(){if(!A.on&&A.shield<=0)return;const z=CAM.z;ctx.setTransform(DPR*z,0,0,DPR*z,DPR*(VW/2-CAM.x*z),DPR*(VH/2-CAM.y*z));
 if(A.shield>0)shieldTop(me());
 if(A.on)for(const m of A.mob){if(m.dead>0){ctx.globalAlpha=m.dead*2}germ(m.x,m.y,1.3,m);ctx.globalAlpha=1}
 ctx.setTransform(DPR,0,0,DPR,0,0);
 if(A.on){ctx.fillStyle="rgba(150,190,60,.10)";ctx.fillRect(0,0,VW,VH)}}
function drawFP(){if(!A.on&&A.shield<=0)return;ctx.setTransform(DPR,0,0,DPR,0,0);
 if(A.on&&FB&&ZB){const bw=FB.width,bh=FB.height,ps=VW/bw,car=PL.car,a=car?car.a:PL.a,eye=car?22:18,f=Math.min(bw,bh)*.85,hor=Math.round(bh*(VW<VH?.5:.45)),o=me(),fx=Math.cos(a),fy=Math.sin(a),rx=-fy,ry=fx;
  const L=[];for(const m of A.mob){const dx=m.x-o.x,dy=m.y-o.y,d=dx*fx+dy*fy;if(d<12||d>1800)continue;const sx=bw/2+(dx*rx+dy*ry)*f/d;if(sx<-30||sx>bw+30)continue;const col=Math.max(0,Math.min(bw-1,Math.round(sx)));if(ZB[col]<d)continue;L.push({m,d,sx})}
  L.sort((p,q)=>q.d-p.d);for(const{m,d,sx}of L){const sc=f/d*ps,X=sx*ps,Y=(hor+(eye-26)*f/d)*ps;if(m.dead>0)ctx.globalAlpha=m.dead*2;germ(X,Y,Math.min(3,sc*1.4),m);ctx.globalAlpha=1}
  ctx.fillStyle="rgba(150,190,60,.10)";ctx.fillRect(0,0,VW,VH)}
 if(A.shield>0){const g=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.35,VW/2,VH/2,Math.max(VW,VH)*.7);g.addColorStop(0,"rgba(120,220,255,0)");g.addColorStop(1,"rgba(120,220,255,.35)");ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
  ctx.fillStyle="#fff";ctx.font="900 15px 'Noto Sans TC',sans-serif";ctx.textAlign="center";ctx.lineWidth=4;ctx.strokeStyle="#0a6d8f";ctx.strokeText("🌀 SKY 保護網 "+Math.ceil(A.shield)+"s",VW/2,VH*.62);ctx.fillText("🌀 SKY 保護網 "+Math.ceil(A.shield)+"s",VW/2,VH*.62)}}
function drawMiniGerms(){if(!A.on)return;const s=272,R=s/2,sc=2*MS_,o=me();mx.setTransform(1,0,0,1,0,0);
 for(const m of A.mob){if(m.dead>0)continue;let a=R+(m.x-o.x)*sc,b=R+(m.y-o.y)*sc;const d=Math.hypot(a-R,b-R);if(d>R-10){a=R+(a-R)/d*(R-10);b=R+(b-R)/d*(R-10)}
  mx.fillStyle=m.pm?"#777":"#7ed957";mx.strokeStyle="#000";mx.lineWidth=2;mx.beginPath();mx.arc(a,b,6,0,7);mx.fill();mx.stroke()}}

/* ---------- SKY button ---------- */
const st=document.createElement("style");st.textContent=`
#bSky{position:fixed;top:calc(150px + env(safe-area-inset-top));left:168px;z-index:12;width:46px;height:46px;border-radius:12px;border:3px solid #111;background:linear-gradient(#e9f9ff,#9fdcf0);color:#0a4a63;font-size:20px;font-weight:900;display:none;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;line-height:1;padding:0}
#bSky.own{display:flex}#bSky small{font-size:10px;margin-top:1px}
#bSky.cd{filter:grayscale(.8);opacity:.7}#bSky.act{background:linear-gradient(#7fe3ff,#2bb3e0);color:#fff}
#bSky.glow{animation:skyGlow 1s ease-in-out infinite}@keyframes skyGlow{50%{box-shadow:0 0 0 6px #7fe3ff88}}
body.cut #bSky{visibility:hidden}
.shopcard{background:var(--card,#1f2533);border-radius:14px;padding:12px;margin:8px 0}
.shopcard img{width:100%;max-width:220px;display:block;margin:0 auto 6px;border-radius:12px;background:#fff}`;
document.head.appendChild(st);
const btn=document.createElement("button");btn.id="bSky";btn.title="SKY 空氣清淨機（R）";btn.innerHTML="🌀<small>SKY</small>";document.body.appendChild(btn);
function useSky(){if(!S.hasSky||PAUSE||!STARTED)return;
 if(A.shield>0)return;if(A.cd>0){toast("🌀 清淨機充電中","還要 "+Math.ceil(A.cd)+" 秒才能再開啟。","#5ec8ff");return}
 A.shield=SHIELD;tone(523,.12,"triangle",.05);tone(784,.2,"triangle",.05,0,.1);burst(me().x,me().y,"#7fe3ff",30);$("#bSky").classList.remove("glow")}
window.airUseSky=useSky;
btn.addEventListener("pointerdown",e=>{e.preventDefault();useSky()});
addEventListener("keydown",e=>{if(e.key&&e.key.toLowerCase()=="r"&&!e.repeat)useSky()});
let btnKey="";function updBtn(){const k=`${!!S.hasSky}|${A.shield>0?Math.ceil(A.shield):0}|${A.cd>0?Math.ceil(A.cd):0}`;if(k==btnKey)return;btnKey=k;
 btn.classList.toggle("own",!!S.hasSky);btn.classList.toggle("act",A.shield>0);btn.classList.toggle("cd",A.shield<=0&&A.cd>0);
 btn.innerHTML=A.shield>0?`🌀<small>${Math.ceil(A.shield)}s</small>`:A.cd>0?`🌀<small>${Math.ceil(A.cd)}s</small>`:"🌀<small>SKY</small>"}

/* ---------- shop tab (📱 →「商城」) ---------- */
const tabs=document.querySelector("#phone .tabs");const tb=document.createElement("button");tb.dataset.t="shop";tb.textContent="商城";tabs.appendChild(tb);
tb.onclick=()=>{phTab="shop";tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x==tb));renderPhone()};
function shopHTML(){const w=S.wallet||0,own=!!S.hasSky,can=w>=PRICE;
 return`<h3 style="margin:0 0 6px">🛒 升級城商城</h3>
 <div class="shopcard" style="display:flex;justify-content:space-between;align-items:center"><span>💰 遊戲錢包</span><b style="font-size:22px;color:var(--pri,#ffcf3f)">$${fmt(w)}</b></div>
 <div class="shopcard"><img src="img/sky-purifier.webp" alt="SKY 空氣清淨機"><div style="font-size:18px;font-weight:900">SKY 空氣清淨機</div>
  <p class="sub" style="margin:4px 0">每天大約會有一次細菌和 PM2.5 來襲。買了之後，畫面上會出現 🌀 按鈕（電腦按 R）：主角周圍形成保護網 <b>20 秒</b>，淨化靠近的細菌與 PM2.5（每淨化一個 +5 EXP）。用完充電 60 秒後可以再開。</p>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><b style="font-size:20px">$${fmt(PRICE)}</b>
  ${own?`<span style="color:var(--ok,#4ade80);font-weight:900">✅ 已擁有</span>`:`<button class="btn" id="buySky" ${can?"":"disabled"}>${can?"購買":"錢包不足"}</button>`}</div></div>
 <details class="more"><summary>怎麼賺遊戲錢包？</summary><div>開口分享、服務顧客，顧客購買會累積團隊 BV。每天結算時，當天新增的「示範獎金」會存進遊戲錢包。</div></details>
 <p class="disc">遊戲錢包是遊戲內的示範貨幣，商品價格為遊戲設定，非實際售價，也非保證收入。</p>`}
function bindShop(){const b=document.getElementById("buySky");if(b)b.onclick=()=>{if(S.hasSky||(S.wallet||0)<PRICE)return;S.wallet-=PRICE;S.hasSky=1;try{save()}catch(e){}
 SFX.pass();toast("🎉 買到 SKY 空氣清淨機！","畫面上方出現 🌀 按鈕（電腦按 R），細菌和 PM2.5 來襲時按下去開啟保護網。","#57ff8a");btnKey="";renderPhone()}}

/* ---------- hooks into the main game ---------- */
const _render=render;render=function(){_render.apply(this,arguments);drawTop()};
const _renderFP=renderFP;renderFP=function(){_renderFP.apply(this,arguments);drawFP()};
const _drawMini=drawMini;drawMini=function(){_drawMini.apply(this,arguments);drawMiniGerms()};
const _drawHUD=drawHUD;drawHUD=function(){_drawHUD.apply(this,arguments);const now=performance.now(),dt=Math.min(.1,(now-A.lastT)/1000);A.lastT=now;if(STARTED&&!PAUSE)tick(dt);updBtn()};
const _rp=renderPhone;renderPhone=function(){if(phTab=="shop"){$("#phBody").innerHTML=shopHTML();bindShop();return}return _rp.apply(this,arguments)};
})();
