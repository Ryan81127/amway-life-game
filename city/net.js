/* 升級城：多人連線（同一座城即時同步）
   只被 city/index.html 載入，放在主程式之後。
   做法：不改主程式內部，而是包住幾個全域函式（render、renderFP、drawMini、drawHUD、carHits、
   passMission、talkResult、horn、renderPhone），把其他玩家畫進同一座城。
   伺服器：Firebase Realtime Database（設定在 firebase-config.js）。
   測試：網址加上 ?net=local，同一台裝置的兩個分頁會互相連線（不需要 Firebase）。 */
(function(){
"use strict";
const FBC=window.CITY_FIREBASE;
const LOCAL=/[?&]net=local\b/.test(location.search);
const NET=window.NET={on:false,connecting:false,room:"",uid:"",name:"",peers:{},tr:null,sendT:0,hbT:0,last:"",lastT:performance.now(),myEm:"",myEmT:0,hornT:0,joinedAt:0};
const EMOTES=["👋","👍","❤️","😂","🎉","💪"];
const avail=()=>LOCAL||!!(FBC&&FBC.apiKey&&FBC.databaseURL);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cleanName=s=>String(s||"").replace(/[<>&"'`\\]/g,"").trim().slice(0,10);
const cleanRoom=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
const me=()=>PL.car||PL;
const randRoom=()=>Array.from({length:4},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
const urlRoom=cleanRoom((location.search.match(/[?&]room=([^&]+)/)||[])[1]||"");

/* ---------- transports ---------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("load "+src));document.head.appendChild(s)})}
async function fbTransport(room){
 const B="https://www.gstatic.com/firebasejs/10.12.2/";
 if(!window.firebase)for(const f of["firebase-app-compat.js","firebase-auth-compat.js","firebase-database-compat.js"])await loadScript(B+f);
 if(!firebase.apps.length)firebase.initializeApp(FBC);
 const cred=await firebase.auth().signInAnonymously();const uid=cred.user.uid;
 const root=firebase.database().ref("rooms/"+room),pl=root.child("players"),mine=pl.child(uid),evs=root.child("events");
 await mine.onDisconnect().remove();
 const t0=Date.now()-5000;
 return{uid,
  send:v=>mine.set(v).catch(()=>{}),
  onPlayers(cb){pl.on("child_added",s=>cb("add",s.key,s.val()));pl.on("child_changed",s=>cb("chg",s.key,s.val()));pl.on("child_removed",s=>cb("del",s.key))},
  emit(v){const r=evs.push(v);setTimeout(()=>r.remove().catch(()=>{}),20000)},
  onEvent(cb){evs.orderByChild("t").startAt(t0).on("child_added",s=>cb(s.val()))},
  leave(){mine.remove().catch(()=>{});pl.off();evs.off()}}}
function localTransport(room){
 const uid="L"+Math.random().toString(36).slice(2,10),ch=new BroadcastChannel("city-net-"+room),seen={};let pcb=null,ecb=null,closed=false;const bc={postMessage:m=>{if(!closed)ch.postMessage(m)},close:()=>{closed=true;ch.close()},set onmessage(f){ch.onmessage=f}};
 bc.onmessage=e=>{const d=e.data;if(d.k=="p"){const ex=seen[d.id];seen[d.id]=1;pcb&&pcb(ex?"chg":"add",d.id,d.v)}else if(d.k=="x"){delete seen[d.id];pcb&&pcb("del",d.id)}else if(d.k=="e")ecb&&ecb(d.v)};
 addEventListener("pagehide",()=>bc.postMessage({k:"x",id:uid}));
 return{uid,send(v){bc.postMessage({k:"p",id:uid,v})},onPlayers(cb){pcb=cb},emit(v){bc.postMessage({k:"e",v})},onEvent(cb){ecb=cb},leave(){bc.postMessage({k:"x",id:uid});bc.close()}}}

/* ---------- connect / leave ---------- */
async function connect(room,name){
 if(NET.on||NET.connecting)return;room=cleanRoom(room);name=cleanName(name);
 if(room.length<3){toast("⚠️ 房間代碼","請輸入 3～8 個英文字母或數字。","#f87171");return}
 if(!name){toast("⚠️ 暱稱","請輸入暱稱（10 字以內）。","#f87171");return}
 NET.connecting=true;S.netName=name;S.netRoom=room;save();toast("🔌 連線中…","正在加入房間 "+room,"#5ec8ff");
 try{const tr=LOCAL?localTransport(room):await fbTransport(room);
  Object.assign(NET,{tr,uid:tr.uid,room,name,on:true,peers:{},joinedAt:performance.now(),last:""});
  tr.onPlayers(onPeer);tr.onEvent(onEvent);sendState(true);
  toast("🟢 已加入房間 "+room,"同一個房間代碼的人會在同一座城裡看到彼此。到 📱 →「連線」可以邀請朋友。","#4ade80");
  emit("join","")}
 catch(e){console.warn(e);toast("⚠️ 連線失敗","目前先以單人模式進行。請確認網路，或請管理者檢查 Firebase 設定。","#f87171")}
 NET.connecting=false;if(!$("#phone").classList.contains("hide"))renderPhone()}
function leave(){if(!NET.on)return;try{NET.tr.leave()}catch(e){}NET.on=false;NET.peers={};NET.tr=null;toast("🔴 已離開房間","回到單人模式。","#9aa3b5");if(!$("#phone").classList.contains("hide"))renderPhone()}
window.netConnect=connect;window.netLeave=leave;

/* ---------- sync ---------- */
function state(){const o=me(),a=PL.car?PL.car.a:PL.a;return{n:NET.name,x:Math.round(o.x),y:Math.round(o.y),a:Math.round(a*100)/100,k:PL.car?(PL.car.kind||"car"):"foot",c:PL.car?(PL.car.color||"#d63a3a"):"#ff3d7f",e:EVO[evoIdx()][0],m:MS&&MS.m?MS.m.id:0,t:Date.now()}}
function sendState(force){const s=state(),key=`${s.x},${s.y},${s.a},${s.k},${s.e},${s.m}`;if(!force&&key==NET.last&&NET.hbT<4)return;NET.last=key;NET.hbT=0;NET.tr.send(s)}
function emit(ty,v){if(!NET.on)return;NET.tr.emit({u:NET.uid,n:NET.name,ty,v:v==null?"":v,t:Date.now()})}
window.netEmit=emit;
function onPeer(kind,id,v){if(id===NET.uid)return;const now=performance.now();
 if(kind=="del"){const p=NET.peers[id];if(p)feed(`👋 ${esc(p.n)} 離開了城市`);delete NET.peers[id];return}
 if(!v||typeof v.x!="number"||typeof v.y!="number")return;
 let p=NET.peers[id];
 if(!p){p=NET.peers[id]={x:v.x,y:v.y,a:+v.a||0,em:"",emT:0,honk:0};if(kind=="add"&&now-NET.joinedAt>2000)feed(`🙌 ${esc(cleanName(v.n)||"玩家")} 進入了城市`)}
 const k=["foot","car","bike","scooter"].includes(v.k)?v.k:"foot";
 Object.assign(p,{n:cleanName(v.n)||"玩家",tx:v.x,ty:v.y,ta:+v.a||0,k,c:/^#[0-9a-f]{6}$/i.test(v.c)?v.c:"#3fd0ff",e:typeof v.e=="string"?v.e.slice(0,4):"🌱",m:v.m|0,seen:now});
 const K=KINDS[k];if(K){p.L=K.L;p.Wd=K.Wd;p.R=K.R}else{p.L=0;p.Wd=0;p.R=12}}
function onEvent(ev){if(!ev||ev.u===NET.uid||Date.now()-(+ev.t||0)>15000)return;const p=NET.peers[ev.u],n=esc(cleanName(ev.n)||"玩家");
 if(ev.ty=="horn"&&p){p.honk=1.2;const o=me(),d=Math.hypot(p.x-o.x,p.y-o.y);if(d<900){tone(392,.25,"square",.012+.03*(1-d/900));tone(494,.25,"square",.01+.025*(1-d/900))}}
 else if(ev.ty=="emote"&&p&&EMOTES.includes(ev.v)){p.em=ev.v;p.emT=3.5}
 else if(ev.ty=="pass")feed(`🏁 ${n} 完成任務「${esc(String(ev.v).slice(0,20))}」`);
 else if(ev.ty=="talk")feed(`💬 ${n} 剛剛開口分享（累計 ${(+ev.v|0)} 次），一起加油！`)}
function netTick(dt){if(!NET.on)return;const now=performance.now();
 for(const id in NET.peers){const p=NET.peers[id];if(now-p.seen>15000){delete NET.peers[id];continue}
  if(Math.hypot(p.tx-p.x,p.ty-p.y)>500){p.x=p.tx;p.y=p.ty}else{const k=Math.min(1,dt*8);p.x+=(p.tx-p.x)*k;p.y+=(p.ty-p.y)*k}
  p.a+=angDiff(p.ta,p.a)*Math.min(1,dt*10);if(p.emT>0)p.emT-=dt;if(p.honk>0)p.honk-=dt}
 if(NET.myEmT>0)NET.myEmT-=dt;NET.hornT-=dt;
 NET.sendT+=dt;NET.hbT+=dt;if(NET.sendT>=.2){NET.sendT=0;sendState(false)}}

/* ---------- drawing ---------- */
function tagAt(x,y,p,col){const t=`${p.e} ${p.n}`+(p.m?`・任務${p.m}`:"");ctx.font="900 15px 'Noto Sans TC',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";const w=ctx.measureText(t).width+14;
 ctx.fillStyle="rgba(10,14,24,.78)";rr(x-w/2,y-11,w,22,11);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#fff";ctx.fillText(t,x,y+1)}
function bubble(x,y,em,honk){if(em){ctx.font="30px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(em,x,y)}if(honk){ctx.font="900 18px 'Noto Sans TC',sans-serif";ctx.lineWidth=4;ctx.strokeStyle="#000";ctx.strokeText("叭！",x+28,y+8);ctx.fillStyle="#ffd23d";ctx.fillText("叭！",x+28,y+8)}}
function drawPeerTop(p){
 if(p.k=="car"){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);const L=p.L,W=p.Wd;ctx.fillStyle="#0005";rr(-L/2+4,-W/2+5,L,W,7);ctx.fill();ctx.fillStyle=p.c;rr(-L/2,-W/2,L,W,7);ctx.fill();ctx.strokeStyle="#5ec8ff";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#1d2a38";rr(L*.08,-W/2+4,L*.2,W-8,3);ctx.fill();rr(-L*.36,-W/2+5,L*.14,W-10,3);ctx.fill();ctx.fillStyle="#fff7b0";ctx.fillRect(L/2-4,-W/2+3,4,6);ctx.fillRect(L/2-4,W/2-9,4,6);ctx.restore()}
 else if(p.k=="bike"||p.k=="scooter")drawTwo({x:p.x,y:p.y,a:p.a,L:p.L,Wd:p.Wd,color:p.c,kind:p.k},true);
 else{ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle="#0005";ctx.beginPath();ctx.arc(3,4,12,0,7);ctx.fill();ctx.rotate(p.a);ctx.fillStyle="#3fd0ff";ctx.beginPath();ctx.ellipse(0,0,8,12,0,0,7);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#2a1d14";ctx.beginPath();ctx.arc(1,0,6.5,0,7);ctx.fill();ctx.restore()}}
function drawRemotesTop(){if(!NET.on&&!NET.myEmT)return;const z=CAM.z;ctx.setTransform(DPR*z,0,0,DPR*z,DPR*(VW/2-CAM.x*z),DPR*(VH/2-CAM.y*z));
 const hw=VW/2/z+80,hh=VH/2/z+80;
 for(const id in NET.peers){const p=NET.peers[id];if(Math.abs(p.x-CAM.x)>hw||Math.abs(p.y-CAM.y)>hh)continue;drawPeerTop(p);tagAt(p.x,p.y-(p.k=="car"?36:30),p,"#5ec8ff");if(p.emT>0||p.honk>0)bubble(p.x,p.y-64,p.emT>0?p.em:"",p.honk>0)}
 if(NET.myEmT>0){const o=me();bubble(o.x,o.y-60,NET.myEm,false)}
 ctx.setTransform(DPR,0,0,DPR,0,0)}
function drawRemotesFP(){if(!NET.on||!FB||!ZB)return;const bw=FB.width,bh=FB.height,ps=VW/bw,car=PL.car,a=car?car.a:PL.a,eye=car?22:18,f=Math.min(bw,bh)*.85,hor=Math.round(bh*(VW<VH?.5:.45));
 const o=me(),fx=Math.cos(a),fy=Math.sin(a),rx=-fy,ry=fx;const L=[];
 for(const id in NET.peers){const p=NET.peers[id],dx=p.x-o.x,dy=p.y-o.y,d=dx*fx+dy*fy;if(d<16||d>2600)continue;const sx=bw/2+(dx*rx+dy*ry)*f/d;if(sx<-40||sx>bw+40)continue;const col=Math.max(0,Math.min(bw-1,Math.round(sx)));if(ZB[col]<d)continue;L.push({p,d,sx})}
 L.sort((u,v)=>v.d-u.d);ctx.setTransform(DPR,0,0,DPR,0,0);
 for(const{p,d,sx}of L){const sc=f/d*ps,X=sx*ps,G=(hor+eye*f/d)*ps;
  if(p.k=="foot"){ctx.fillStyle="#222";ctx.fillRect(X-3*sc,G-10*sc,6*sc,10*sc);ctx.fillStyle="#3fd0ff";rr(X-5*sc,G-22*sc,10*sc,13*sc,3*sc);ctx.fill();ctx.fillStyle="#f1c9a0";ctx.beginPath();ctx.arc(X,G-26*sc,4.5*sc,0,7);ctx.fill()}
  else{const rel=angDiff(p.a,a),w=(p.Wd*Math.abs(Math.cos(rel))+p.L*Math.abs(Math.sin(rel)))*sc,h=(p.k=="car"?22:24)*sc;ctx.fillStyle="#0006";ctx.fillRect(X-w/2,G-3*sc,w,4*sc);ctx.fillStyle=p.c;rr(X-w/2,G-h,w,h*.62,4*sc);ctx.fill();ctx.strokeStyle="#5ec8ff";ctx.lineWidth=Math.max(1,2*sc);ctx.stroke();if(p.k=="car"){ctx.fillStyle="#1d2a38";rr(X-w*.3,G-h*.95,w*.6,h*.3,2*sc);ctx.fill()}else{ctx.fillStyle="#3fd0ff";rr(X-5*sc,G-h*1.5,10*sc,h*.8,3*sc);ctx.fill()}}
  const ty=G-(p.k=="car"?40:46)*sc;ctx.save();ctx.translate(X,ty);const k=Math.max(.55,Math.min(1.2,sc));ctx.scale(k,k);tagAt(0,0,p,"#5ec8ff");if(p.emT>0||p.honk>0)bubble(0,-30,p.emT>0?p.em:"",p.honk>0);ctx.restore()}}
function drawRemotesMini(){if(!NET.on)return;const s=272,R=s/2,sc=2*MS_,o=me();mx.setTransform(1,0,0,1,0,0);
 for(const id in NET.peers){const p=NET.peers[id];let a=R+(p.x-o.x)*sc,b=R+(p.y-o.y)*sc;const d=Math.hypot(a-R,b-R);if(d>R-14){a=R+(a-R)/d*(R-14);b=R+(b-R)/d*(R-14)}
  mx.fillStyle="#5ec8ff";mx.strokeStyle="#000";mx.lineWidth=3;mx.beginPath();mx.arc(a,b,10,0,7);mx.fill();mx.stroke();mx.fillStyle="#000";mx.font="900 13px sans-serif";mx.textAlign="center";mx.textBaseline="middle";mx.fillText(p.n.slice(0,1),a,b+1)}}

/* ---------- hooks into the main game ---------- */
const _render=render;render=function(){_render.apply(this,arguments);drawRemotesTop()};
const _renderFP=renderFP;renderFP=function(){_renderFP.apply(this,arguments);drawRemotesFP();if(NET.myEmT>0){ctx.setTransform(DPR,0,0,DPR,0,0);bubble(VW/2,VH*.62,NET.myEm,false)}};
const _drawMini=drawMini;drawMini=function(){_drawMini.apply(this,arguments);drawRemotesMini()};
const _drawHUD=drawHUD;drawHUD=function(){_drawHUD.apply(this,arguments);const now=performance.now(),dt=Math.min(.1,(now-NET.lastT)/1000);NET.lastT=now;if(STARTED)netTick(dt);updNetHUD()};
const _carHits=carHits;carHits=function(c){_carHits.apply(this,arguments);if(!NET.on)return;for(const id in NET.peers){const o=NET.peers[id],Rr=(o.R||12)+(c.R||19),d=Math.hypot(c.x-o.x,c.y-o.y);if(d<Rr&&d>0){const nx=(c.x-o.x)/d,ny=(c.y-o.y)/d;c.x+=nx*(Rr-d);c.y+=ny*(Rr-d);const vn=c.vx*nx+c.vy*ny;if(vn<0){c.vx-=nx*vn*1.4;c.vy-=ny*vn*1.4}}}};
const _pass=passMission;passMission=function(){const t=MS&&MS.m?MS.m.title:"";const r=_pass.apply(this,arguments);if(t)emit("pass",t);return r};
const _talk=talkResult;talkResult=function(){const r=_talk.apply(this,arguments);emit("talk",S.opp&&S.opp.talks|0);return r};
const _horn=horn;horn=function(){_horn.apply(this,arguments);if(NET.on&&NET.hornT<=0){NET.hornT=.8;emit("horn","")}};
const _rp=renderPhone;renderPhone=function(){if(phTab=="n"){$("#phBody").innerHTML=netTab();bindNetTab();return}return _rp.apply(this,arguments)};

/* ---------- UI ---------- */
const hud=document.createElement("div");hud.id="netH";hud.style.cssText="position:fixed;top:calc(128px + env(safe-area-inset-top));left:14px;width:128px;text-align:center;z-index:11;pointer-events:none;font-size:11px;font-weight:900;color:#fff;background:#0b3b24e6;border:2px solid #4ade80;border-radius:12px;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";hud.hidden=true;document.body.appendChild(hud);
const st=document.createElement("style");st.textContent="body.cut #netH{visibility:hidden}";document.head.appendChild(st);
let hudKey="";function updNetHUD(){const n=Object.keys(NET.peers).length+1,k=NET.on?`🟢 ${NET.room}・${n} 人在線`:"";if(k!=hudKey){hudKey=k;hud.textContent=k;hud.hidden=!k}}
// phone tab
const tabs=document.querySelector("#phone .tabs");const tb=document.createElement("button");tb.dataset.t="n";tb.textContent="連線";tabs.appendChild(tb);
tb.onclick=()=>{phTab="n";tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x==tb));renderPhone()};
tabs.querySelectorAll("button").forEach(b=>{if(b!==tb){const old=b.onclick;b.onclick=()=>{tb.classList.remove("on");old&&old()}}});
function inviteUrl(){const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("room",NET.room||S.netRoom||"");if(LOCAL)u.searchParams.set("net","local");return u.toString()}
function joinForm(){const dis=!avail();return`<h3 style="margin:0 0 6px">👥 多人連線（同一座城）</h3>
 <p class="sub">輸入同一個房間代碼的人，會在同一座城裡即時看到彼此走路、開車、騎車。任務、分享和團隊數字仍然各自計算。</p>
 ${dis?`<div class="kc" style="border-color:#f87171"><b>連線伺服器尚未設定</b><br>管理者需要在 city/firebase-config.js 填入 Firebase 設定後才能連線（步驟見 city/MULTIPLAYER.md）。</div>`:""}
 <p style="margin:10px 0 4px;font-weight:900">暱稱（別人會看到，請勿用真名或電話）</p><input id="nNm" maxlength="10" value="${esc(S.netName||"")}" placeholder="例如：阿明" style="width:100%;font-size:17px;padding:10px;border-radius:10px;border:2px solid #444;background:#111;color:#fff">
 <p style="margin:10px 0 4px;font-weight:900">房間代碼（3～8 個英文或數字）</p><input id="nRm" maxlength="8" value="${esc(urlRoom||S.netRoom||randRoom())}" style="width:100%;font-size:20px;letter-spacing:4px;text-transform:uppercase;padding:10px;border-radius:10px;border:2px solid #444;background:#111;color:#fff;font-family:Anton,sans-serif">
 <button class="btn w100" id="nGo" ${dis?"disabled":""}>🟢 加入房間</button>`}
function netTab(){if(!NET.on)return joinForm()+(NET.connecting?`<p class="sub">連線中…</p>`:"");
 const o=me(),list=Object.entries(NET.peers).map(([id,p])=>({id,p,d:Math.round(Math.hypot(p.x-o.x,p.y-o.y)/4)})).sort((a,b)=>a.d-b.d);
 return`<h3 style="margin:0 0 6px">🟢 房間 <span style="font-family:Anton;letter-spacing:3px;color:var(--gold)">${esc(NET.room)}</span>｜${list.length+1} 人在線</h3>
 <button class="btn w100 gr" id="nInv">📨 邀請朋友（分享房間連結）</button>
 <p style="margin:12px 0 4px;font-weight:900">打招呼</p><div style="display:flex;gap:6px;flex-wrap:wrap">${EMOTES.map(e=>`<button class="btn dk sm nEm" data-e="${e}" style="font-size:22px;padding:6px 12px">${e}</button>`).join("")}</div>
 <p style="margin:12px 0 4px;font-weight:900">在線玩家</p>
 <div class="ml"><div class="ic">${EVO[evoIdx()][0]}</div><div class="tx"><b>${esc(NET.name)}（你）</b></div></div>
 ${list.map(({id,p,d})=>`<div class="ml"><div class="ic">${esc(p.e)}</div><div class="tx"><b>${esc(p.n)}</b>｜${{foot:"🚶 走路",car:"🚗 開車",bike:"🚲 騎單車",scooter:"🛵 騎機車"}[p.k]}${p.m?`｜任務 ${p.m} 中`:""}<br><small>距離約 ${d} m</small></div><button class="btn dk sm nTp" data-id="${esc(id)}">📍 去找他</button></div>`).join("")||`<p class="sub">房間裡還沒有其他人。把邀請連結傳給朋友吧！</p>`}
 <button class="btn dk w100" id="nLv" style="margin-top:12px">離開房間</button>
 <p class="disc">連線時只會傳送暱稱、位置、交通工具和稱號，不會傳送你的團隊數字或個人資料。</p>`}
function bindNetTab(){const g=$("#nGo");if(g)g.onclick=()=>{connect($("#nRm").value,$("#nNm").value)};
 const inv=$("#nInv");if(inv)inv.onclick=async()=>{const u=inviteUrl(),txt=`一起來升級城！房間代碼 ${NET.room}`;try{if(navigator.share){await navigator.share({title:"升級城",text:txt,url:u});return}}catch(e){}try{await navigator.clipboard.writeText(txt+" "+u);toast("📋 已複製邀請連結","貼到 LINE 給朋友，對方點開就會帶入房間代碼。","#4ade80")}catch(e){prompt("複製這個連結給朋友：",u)}};
 document.querySelectorAll(".nEm").forEach(b=>b.onclick=()=>{NET.myEm=b.dataset.e;NET.myEmT=3.5;emit("emote",b.dataset.e);closeOv("phone")});
 document.querySelectorAll(".nTp").forEach(b=>b.onclick=()=>{const p=NET.peers[b.dataset.id];if(!p)return;if(MS){toast("⚠️ 任務進行中","完成或離開任務後才能傳送。","#f87171");return}const o=me();o.x=p.x+36;o.y=p.y+36;if(PL.car){PL.car.vx=PL.car.vy=0}pushOut(o,12);closeOv("phone");toast("📍 已傳送",`你來到 ${p.n} 旁邊了。`,"#5ec8ff")});
 const lv=$("#nLv");if(lv)lv.onclick=leave}
// title button
const bs=$("#bStart");if(bs){const b=document.createElement("button");b.className="btn w100 gr";b.id="bNet";b.style.maxWidth="340px";b.textContent="👥 多人連線（同一座城）";bs.insertAdjacentElement("afterend",b);
 b.onclick=()=>{bs.click();let n=0;const iv=setInterval(()=>{if(++n>400){clearInterval(iv);return}if(!STARTED||PAUSE)return;clearInterval(iv);phTab="n";$("#phone").classList.remove("hide");PAUSE=true;tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x==tb));renderPhone()},300)}}
if(urlRoom&&$("#bNet"))$("#bNet").textContent=`👥 加入房間 ${urlRoom}`;
addEventListener("pagehide",()=>{if(NET.on)try{NET.tr.leave()}catch(e){}});
})();
