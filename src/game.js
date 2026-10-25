const CFG=window.AMWAY_GAME_CONFIG,KEY="amway-life-game-v2";
const $=s=>document.querySelector(s);
let S=JSON.parse(localStorage.getItem(KEY)||"null")||{name:"",done:{},gems:[],cards:[],badges:[],exp:0,hat:"",daily:"",board:[]};
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
const lvl=()=>Math.floor(S.exp/100)+1;
const totStars=()=>Object.values(S.done).reduce((a,d)=>a+d.stars,0);
const totScore=()=>Object.values(S.done).reduce((a,d)=>a+d.score,0);
const evoIdx=()=>S.done[6]?3:S.done[3]?2:S.done[1]?1:0;
const allCards=AREAS.reduce((a,x)=>a+x.cards.length,0);
function show(id){document.querySelectorAll(".scr").forEach(e=>e.classList.toggle("on",e.id==id));scrollTo(0,0)}
function modal(html){$("#mbox").innerHTML=html;$("#modal").classList.add("on")}
function close(){$("#modal").classList.remove("on")}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const G=window.__game={state:()=>S,win:null,answerAll:false,phase:"",_auto:false};
let STOP=null;

function heroHTML(cls=""){const e=EVO[evoIdx()];return `<span id="hero" class="${cls}">${S.hat?`<span class="hat">${S.hat}</span>`:""}${e[0]}</span>`}
function renderMap(){
  const next=AREAS.find(a=>!S.done[a.id]);
  let h=`<div class="hud"><span>${S.name||"冒險者"}｜${EVO[evoIdx()][1]}</span><span>Lv.${lvl()}</span><div class="bar"><i style="width:${S.exp%100}%"></i></div><span>⭐${totStars()}/18</span></div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:8px">${heroHTML()}<div><b>${S.name||"冒險者"}</b><div class="gems">${["自由","家庭","希望","獎勵"].map(g=>`<span class="${S.gems.includes(g)?"on":""}">💎${g}</span>`).join("")}</div></div></div>
  <div style="margin:6px 0"><button class="btn s" onclick="book()">📖 寶物圖鑑 ${Math.round(S.cards.length/allCards*100)}%</button><button class="btn s" onclick="wardrobe()">🎩 衣櫃</button><button class="btn s" onclick="board()">🏆 排行榜</button>${S.gems.length==4?`<button class="btn s g" onclick="ending()">🌈 結局</button>`:""}</div>
  <h3>🗺 安麗冒險小鎮</h3>`;
  AREAS.forEach((a,i)=>{const d=S.done[a.id],open=d||a===next;
    if(i)h+=`<div class="path"></div>`;
    h+=`<div class="area ${open?"":"lock"}" ${open?`onclick="playArea(${a.id})"`:""} data-area="${a.id}"><div class="ic">${d||a===next?a.ic:a.comp.e}</div><div style="flex:1"><b>${i+1}. ${open?a.name:"？？？"}</b><br><small>${open?a.ch:"🔒 "+a.mystery}</small>
    ${d?`<div class="stars">${"★".repeat(d.stars)}${"☆".repeat(3-d.stars)}</div><small>夥伴 ${a.comp.e}${a.comp.n}｜最佳 ${d.score}</small>`:a===next?`<div><small>下一站！通關可得：<span style="filter:brightness(0)">${a.comp.e}</span> ？？？${a.gem?"＋💎":""}</small></div>`:""}</div>${a===next?`<div style="position:absolute;right:8px;top:-14px">${heroHTML()}</div>`:""}</div>`});
  const today=new Date().toDateString();
  h+=`<p style="font-size:13px">${S.daily!=today?"🍀 今日幸運加倍：今天第一次通關 EXP ×2":"🍀 今日幸運加倍已使用，明天再來～（重玩永遠免費）"}</p>
  <button class="btn s" onclick="if(confirm('確定清除進度？'))reset()">重置進度</button>`;
  $("#s-map").innerHTML=h;show("s-map");
}
function reset(){localStorage.removeItem(KEY);location.reload()}

async function dialog(a){
  for(let i=0;i<a.story.length;i++){
    await new Promise(r=>{modal(`<div style="font-size:40px">${a.ic} ${heroHTML()}</div><h3>${a.name}</h3><p style="font-size:17px">${a.story[i]}</p><button class="btn" id="nx">${i<a.story.length-1?"下一句 ▶":"開始挑戰！"}</button>`);$("#nx").onclick=r;if(G._auto)setTimeout(r,10)})}
  close();
}
async function playArea(id){
  const a=AREAS.find(x=>x.id==id);G.cur=a;
  G.phase="intro";await dialog(a);
  $("#pTitle").textContent=`${a.ic} ${a.name}`;show("s-play");
  G.phase="mini";const t0=Date.now();
  const r=await ({1:gMatch,2:gBrick,3:gRunner,4:gShooter,5:gTemple,6:gTower}[id])(a);
  const mt=(Date.now()-t0)/1000;
  G.phase="battle";const b=await battle(a,a.qs);
  const stars=1+(mt<=a.target?1:0)+(b.perfect&&r.traps==0?1:0);
  const s={speed:mt<=a.target,acc:b.perfect,trap:r.traps==0};
  const score=r.score+b.score+(s.speed?200:0);
  await result(a,{stars,score,s,mt});
}
// ---------- knowledge battle ----------
async function battle(a,qs,title="⚔️ 知識對戰"){
  let combo=0,score=0,perfect=true;const st=$("#stage");
  for(let i=0;i<qs.length;i++){const q=qs[i];
    await new Promise(res=>{
      st.innerHTML=`<div class="card"><div style="display:flex;justify-content:space-between"><b>${title} ${i+1}/${qs.length}</b><span class="combo">${combo>1?"🔥連擊 x"+combo:""}</span></div>
      <div style="text-align:center;font-size:44px;margin:8px">${heroHTML()} ⚡ ${a.comp.e}</div><div class="bar" style="margin:0 0 10px"><i style="width:${(qs.length-i)/qs.length*100}%;background:#e44"></i></div>
      <h3>${q[0]}</h3>${q[1].map((o,j)=>`<button class="opt" data-j="${j}">${o}</button>`).join("")}<div id="fb"></div></div>`;
      st.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const j=+b.dataset.j,ok=j==q[2];
        st.querySelectorAll(".opt").forEach(x=>x.onclick=null);
        b.classList.add(ok?"ok":"no");st.querySelectorAll(".opt")[q[2]].classList.add("ok");
        if(ok){combo++;score+=100+combo*20}else{combo=0;perfect=false}
        $("#fb").innerHTML=`<p>${ok?"✅ 答對！":"❌ 再記一下："}${q[3]||""}</p><button class="btn b" id="nq">繼續</button>`;
        $("#nq").onclick=res;if(G._auto)setTimeout(res,10)});
      if(G.answerAll)setTimeout(()=>st.querySelectorAll(".opt")[q[2]].click(),30);
    })}
  return {score,perfect};
}
// ---------- result ----------
async function result(a,r){
  const prev=S.done[a.id],first=!prev;const today=new Date().toDateString();
  let exp=60+r.stars*20;if(S.daily!=today){exp*=2;S.daily=today}
  const oldL=lvl(),oldE=evoIdx();S.exp+=exp;
  S.done[a.id]={stars:Math.max(r.stars,prev?prev.stars:0),score:Math.max(r.score,prev?prev.score:0)};
  a.cards.forEach(c=>{if(!S.cards.includes(c[0]))S.cards.push(c[0])});
  if(a.gem&&!S.gems.includes(a.gem))S.gems.push(a.gem);
  const bd=`${a.name}徽章`;if(!S.badges.includes(bd))S.badges.push(bd);
  let secret="";if(r.stars==3&&!S.badges.includes("祕・"+bd)){S.badges.push("祕・"+bd);secret=`<p>🏅 隱藏徽章解鎖：<b>祕・${bd}</b>（完美通關）</p>`}
  const hatNew=HATS.filter(h=>h[0]&&h[0]<=totStars()&&!S["hat_"+h[0]]);hatNew.forEach(h=>S["hat_"+h[0]]=1);
  save();
  const nxt=AREAS.find(x=>!S.done[x.id]);
  await new Promise(res=>{modal(`<div style="text-align:center"><h2>🎉 通關！</h2><div class="stars" style="font-size:34px">${"★".repeat(r.stars)}${"☆".repeat(3-r.stars)}</div>
  <small>${r.s.speed?"★":"☆"}速度（${Math.round(r.mt)} 秒／目標 ${a.target}）｜${r.s.acc?"★":"☆"}全對｜${r.s.trap?"★":"☆"}零陷阱</small>
  <p>分數 <b>${r.score}</b>｜EXP +${exp}${exp>140?"（幸運加倍）":""}</p>
  ${first?`<p style="font-size:40px">${a.comp.e}</p><p>新夥伴加入：<b>${a.comp.n}</b></p>`:""}
  ${a.gem&&first?`<p>💎 取得基石寶石「${a.gem}」</p>`:""}<p>📖 圖鑑 +${a.cards.length} 張知識卡｜🏅 ${bd}</p>${secret}
  ${hatNew.map(h=>`<p>🎁 新造型解鎖：${h[1]} ${h[2]}</p>`).join("")}
  ${lvl()>oldL?`<h3 id="lvup">⬆️ LEVEL UP！Lv.${lvl()}</h3>`:""}
  ${evoIdx()>oldE?`<div style="font-size:60px">${heroHTML("evo")}</div><h3>✨ 進化！成為「${EVO[evoIdx()][1]}」</h3>`:""}
  ${nxt?`<div class="card" style="background:#1b2440;color:#fff">下一站預告：<span style="filter:brightness(0) invert(.3);font-size:30px">${nxt.comp.e}</span><br><small>${nxt.mystery}</small></div>`:""}
  <button class="btn" id="rb">回地圖</button><button class="btn s" id="rt">再玩一次（免費）</button></div>`);
  $("#rb").onclick=()=>{close();res();renderMap();if(S.gems.length==4&&first&&a.id==6)ending()};$("#rt").onclick=()=>{close();res();playArea(a.id)}});
}
// ---------- canvas helper ----------
function makeCanvas(h=520){const st=$("#stage");st.innerHTML=`<canvas id="cv"></canvas><div id="cvinfo" style="font-size:13px;margin-top:6px"></div>`;
  const c=$("#cv"),W=360;c.width=W;c.height=h;const x=c.getContext("2d");
  const pt=e=>{const r=c.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return {x:(p.clientX-r.left)*W/r.width,y:(p.clientY-r.top)*h/r.height}};
  return {c,x,W,H:h,pt}}
function loop(fn){return new Promise(res=>{let last=performance.now(),run=true;STOP=()=>run=false;
  const f=t=>{if(!run)return;const dt=Math.min(.05,(t-last)/1000);last=t;const r=fn(dt);if(r){run=false;res(r)}else requestAnimationFrame(f)};requestAnimationFrame(f)})}
function txt(x,s,X,Y,sz=14,col="#fff",al="center"){x.fillStyle=col;x.font=`bold ${sz}px "Noto Sans TC",sans-serif`;x.textAlign=al;x.fillText(s,X,Y)}
function wrap(x,s,X,Y,w,sz,col){const lines=[];let l="";for(const ch of s){if(x.measureText(l+ch).width>w){lines.push(l);l=ch}else l+=ch}lines.push(l);lines.forEach((t,i)=>txt(x,t,X,Y+i*(sz+3),sz,col))}
// ---------- 1 match ----------
async function gMatch(a){
  const st=$("#stage");let traps=0,score=0;
  const pick=await new Promise(r=>{st.innerHTML=`<div class="card" style="text-align:center"><h3>選擇你的初始蛋</h3><p>（外觀不同，能力一樣，放心選！）</p>${["🥚","🪺","🔮"].map(e=>`<button class="btn b" style="font-size:36px" data-e="${e}">${e}</button>`).join("")}</div>`;
    st.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>r(b.dataset.e));if(G.win)G.win=null;G.win=()=>r("🥚")});
  const rows=["費用","新人 8 折上限","門市購買","長客計畫","事業權益","年度續約費"];
  const ID=[["安麗之友",["0 元","無","不可","不可","無","無"]],["生活會員",["入會費 200 元","1,000 元","可","可","無","200 元"]],["直銷商",["押金 1,000 元","1,500 元","可","可","有","500 元"]]];
  const pools=[["0 元","入會費 200 元","押金 1,000 元"],["無","1,000 元","1,500 元"],["可","不可"],["可","不可"],["有","無"],["無","200 元","500 元"]];
  for(const [nm,vals] of ID){
    await new Promise(res=>{let done=0;
      st.innerHTML=`<div class="card"><h3>${pick} 身份卡：${nm}</h3><p style="font-size:13px">點選每一列正確的能力值</p><table>${rows.map((r,i)=>`<tr><th>${r}</th><td>${pools[i].map(v=>`<span class="chip" data-r="${i}" data-v="${v}">${v}</span>`).join("")}</td></tr>`).join("")}</table><div id="mm" class="combo"></div></div>`;
      st.querySelectorAll(".chip").forEach(ch=>ch.onclick=()=>{const i=+ch.dataset.r;if(ch.parentNode.dataset.ok)return;
        if(ch.dataset.v==vals[i]){ch.classList.add("ok");ch.parentNode.dataset.ok=1;score+=50;done++;if(done==rows.length){$("#mm").textContent="✅ 配對完成！";setTimeout(res,G._auto?10:600)}}
        else{ch.classList.add("no");traps++;$("#mm").textContent="❌ 再想想～"}});
      G.win=()=>{st.querySelectorAll(".chip").forEach(ch=>{if(ch.dataset.v==vals[+ch.dataset.r]&&!ch.parentNode.dataset.ok)ch.click()})};
    })}
  G.win=null;return {score,traps};
}
// ---------- 2 brick ----------
const PERKS=[["全品項 8 折","加入日～次 2 個月月底","加入日～次 6 個月月底"],["滿千再折百","第一階段至次 3 個月月底","只有加入當天"],["加碼送免運","加入日～次 6 個月月底","加入日～次 1 個月月底"],["雙倍積點","加入日～次 6 個月月底","永久有效"],["首年續約券","首年完成續約時","加入第一天"],["8 折上限","直銷商 1,500／會員 1,000","不限金額"],["滿千折百額度","直銷商 500／會員 200","人人 5,000"]];
async function gBrick(a){
  const {c,x,W,H,pt}=makeCanvas(540);let px=W/2,score=0,traps=0,combo=0,time=0;const pw=80;
  let ball={x:W/2,y:H-60,vx:150,vy:-260},bricks=[],caps=[],msg="",mt=0,caught=0;
  const icons=["💳","🔟","🚚","✨","🎟️"];
  for(let r=0;r<4;r++)for(let k=0;k<6;k++)bricks.push({x:8+k*58,y:60+r*30,w:52,h:24,ic:icons[(r+k)%5],cap:(r*6+k)%2==0});
  const mv=e=>{e.preventDefault();px=pt(e).x};c.addEventListener("touchmove",mv,{passive:false});c.addEventListener("touchstart",mv,{passive:false});c.addEventListener("mousemove",mv);
  const kd=e=>{if(e.key=="ArrowLeft")px-=30;if(e.key=="ArrowRight")px+=30};addEventListener("keydown",kd);
  let win=false;G.win=()=>{win=true;bricks=[];caught=8};
  const r=await loop(dt=>{time+=dt;
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    if(ball.x<6||ball.x>W-6)ball.vx*=-1;if(ball.y<36)ball.vy=Math.abs(ball.vy);
    if(ball.y>H-36&&ball.y<H-20&&Math.abs(ball.x-px)<pw/2&&ball.vy>0){ball.vy=-Math.abs(ball.vy);ball.vx=(ball.x-px)*5}
    if(ball.y>H){traps++;combo=0;ball={x:px,y:H-60,vx:150,vy:-260};msg="球掉了！";mt=1}
    for(const b of bricks){if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y>b.y&&ball.y<b.y+b.h){b.dead=1;ball.vy*=-1;score+=20;
      if(b.cap){const p=PERKS[Math.floor(Math.random()*PERKS.length)],ok=Math.random()<.6;caps.push({x:b.x+26,y:b.y,t:p[0],d:ok?p[1]:p[2],ok})}break}}
    bricks=bricks.filter(b=>!b.dead);
    for(const k of caps){k.y+=90*dt;if(k.y>H-40&&k.y<H-20&&Math.abs(k.x-px)<pw/2+30){k.gone=1;if(k.ok){combo++;caught++;score+=50*combo;msg=`✅ ${k.t}：${k.d}`}else{traps++;combo=0;msg=`❌ ${k.t} 期限不是「${k.d}」`}mt=2}if(k.y>H)k.gone=1}
    caps=caps.filter(k=>!k.gone);
    if(mt>0)mt-=dt;
    x.fillStyle="#14213d";x.fillRect(0,0,W,H);
    txt(x,`⏱${Math.max(0,75-time|0)}  分數 ${score}  🔥x${combo}  接對 ${caught}`,W/2,22,14);
    for(const b of bricks){x.fillStyle="#ff8a3d";x.fillRect(b.x,b.y,b.w,b.h);txt(x,b.ic,b.x+26,b.y+18,14)}
    for(const k of caps){x.fillStyle="#fff";x.strokeStyle=k.ok?"#38b26a":"#38b26a";x.lineWidth=2;x.fillRect(k.x-70,k.y-16,140,34);x.strokeRect(k.x-70,k.y-16,140,34);txt(x,k.t,k.x,k.y-2,12,"#1b2440");txt(x,k.d,k.x,k.y+13,10,"#2552b8")}
    x.fillStyle="#ffd23d";x.beginPath();x.arc(ball.x,ball.y,7,0,7);x.fill();
    x.fillStyle="#3dd6ff";x.fillRect(px-pw/2,H-34,pw,12);
    if(mt>0)wrap(x,msg,W/2,H/2+60,W-30,14,"#ffd23d");
    if(win||!bricks.length||time>75)return {score,traps:win?0:traps};
  });
  removeEventListener("keydown",kd);G.win=null;return r;
}
// ---------- 3 runner ----------
const GOODR=["預設自動續訂","最高 83 折","不限金額免運","可線上調整"],BADR=["回饋券可抵運費","終止後接續期數","券用一年","回饋券抵續約費","逾期不影響長客"];
async function gRunner(a){
  const {c,x,W,H}=makeCanvas(420);const G0=H-70;let py=G0,vy=0,time=0,score=0,traps=0,period=0,objs=[],spawn=0,msg="",mt=0,combo=0,inv=0,win=false;
  const jump=e=>{if(e&&e.preventDefault)e.preventDefault();if(py>=G0-1)vy=-470};
  c.addEventListener("touchstart",jump,{passive:false});c.addEventListener("mousedown",jump);const kd=e=>{if(e.code=="Space"||e.key=="ArrowUp")jump(e)};addEventListener("keydown",kd);
  G.win=()=>{win=true};let k=0;
  const r=await loop(dt=>{time+=dt;vy+=1300*dt;py=Math.min(G0,py+vy*dt);if(inv>0)inv-=dt;
    spawn-=dt;if(spawn<=0){spawn=.9+Math.random()*.5;k++;
      const t=k%3==0?"trap":k%5==0?"good":"coin";objs.push({t,x:W+20,y:t=="coin"?G0-(Math.random()<.5?0:90):G0,s:t=="trap"?BADR[k%BADR.length]:GOODR[k%GOODR.length]})}
    const sp=170+time*1.5;
    for(const o of objs){o.x-=sp*dt;if(Math.abs(o.x-60)<24&&Math.abs(o.y-py)<34&&!o.hit){o.hit=1;
      if(o.t=="coin"){period++;combo++;score+=30+combo*5;o.gone=1;if(period==6){msg="🎟️ 訂滿 6 期！獲得 100% 回饋券";mt=2;score+=200}if(period==12){msg="🎟️ 第二輪滿 6 期！120% 回饋券（多 20%）";mt=2;score+=300}}
      else if(o.t=="good"){score+=80;o.gone=1;msg="✅ 正確規則："+o.s;mt=1.5}
      else if(inv<=0){traps++;combo=0;inv=1;msg="❌ 錯誤規則："+o.s;mt=1.8}}}
    objs=objs.filter(o=>o.x>-80&&!o.gone);if(mt>0)mt-=dt;
    x.fillStyle="#7fd1ff";x.fillRect(0,0,W,H);x.fillStyle="#5bbf5b";x.fillRect(0,G0+20,W,H);
    txt(x,`⏱${Math.max(0,85-time|0)}  期數 ${period}/12  分數 ${score}`,W/2,22,15,"#1b2440");
    x.fillStyle="#0002";x.fillRect(20,32,W-40,10);x.fillStyle=period>=6?"#ff8a3d":"#ffd23d";x.fillRect(20,32,(W-40)*Math.min(12,period)/12,10);
    for(const o of objs){if(o.t=="coin"){x.fillStyle="#ffd23d";x.beginPath();x.arc(o.x,o.y,15,0,7);x.fill();txt(x,"期",o.x,o.y+5,13,"#8a5a00")}
      else{x.fillStyle=o.t=="trap"?"#e44":"#38b26a";x.fillRect(o.x-18,o.y-14,36,34);txt(x,o.t=="trap"?"✖":"✔",o.x,o.y+8,16);x.font="bold 11px sans-serif";txt(x,o.s,o.x,o.y-22,11,o.t=="trap"?"#a00":"#185")}}
    x.globalAlpha=inv>0&&(time*10|0)%2?.4:1;txt(x,EVO[evoIdx()][0],60,py+12,34);txt(x,"🐰",28,G0+14,20);x.globalAlpha=1;
    if(mt>0)wrap(x,msg,W/2,120,W-30,15,"#1b2440");
    txt(x,"點擊畫面／空白鍵 跳躍",W/2,H-14,12,"#fff");
    if(win)return {score:score+800,traps:0};if(period>=12||time>85)return {score,traps};
  });
  removeEventListener("keydown",kd);G.win=null;return r;
}
// ---------- 4 shooter ----------
async function gShooter(a){
  const {c,x,W,H,pt}=makeCanvas(540);let px=W/2,time=0,score=0,traps=0,qi=0,bul=[],tg=[],fire=0,msg="",mt=0,combo=0,win=false;
  const newQ=()=>{const q=a.shoot[qi];tg=q[1].map((o,i)=>({t:o,ok:i==q[2],x:60+((i+qi)%3)*120,y:80,vx:(i%2?1:-1)*(40+qi*10)}))};newQ();
  const mv=e=>{e.preventDefault();px=pt(e).x};c.addEventListener("touchmove",mv,{passive:false});c.addEventListener("touchstart",mv,{passive:false});c.addEventListener("mousemove",mv);
  const kd=e=>{if(e.key=="ArrowLeft")px-=25;if(e.key=="ArrowRight")px+=25};addEventListener("keydown",kd);G.win=()=>{win=true};
  const r=await loop(dt=>{time+=dt;fire-=dt;if(fire<=0){fire=.28;bul.push({x:px,y:H-60})}
    bul.forEach(b=>b.y-=420*dt);bul=bul.filter(b=>b.y>0);
    for(const t of tg){t.x+=t.vx*dt;t.y+=18*dt;if(t.x<58){t.x=58;t.vx=Math.abs(t.vx)}if(t.x>W-58){t.x=W-58;t.vx=-Math.abs(t.vx)}
      for(const b of bul)if(!t.dead&&Math.abs(b.x-t.x)<50&&Math.abs(b.y-t.y)<18){b.y=-9;t.dead=1;
        if(t.ok){combo++;score+=150+combo*30;msg="✅ "+t.t;mt=1.4;qi++;if(qi<a.shoot.length)newQ()}else{traps++;combo=0;msg="❌ 不是「"+t.t+"」";mt=1.4}}
      if(t.y>H-90){newQ();break}}
    tg=tg.filter(t=>!t.dead);if(mt>0)mt-=dt;
    x.fillStyle="#0b1430";x.fillRect(0,0,W,H);for(let i=0;i<30;i++){x.fillStyle="#fff3";x.fillRect((i*73)%W,(i*131+time*40)%H,2,2)}
    if(qi<a.shoot.length){x.fillStyle="#1b2440";x.fillRect(0,0,W,50);wrap(x,`Q${qi+1}/${a.shoot.length} ${a.shoot[qi][0]}`,W/2,22,W-20,15,"#ffd23d")}
    for(const t of tg){x.fillStyle="#3d7dff";x.beginPath();x.roundRect?x.roundRect(t.x-55,t.y-16,110,32,10):x.rect(t.x-55,t.y-16,110,32);x.fill();txt(x,t.t,t.x,t.y+5,12)}
    x.fillStyle="#ffd23d";bul.forEach(b=>x.fillRect(b.x-2,b.y,4,10));
    txt(x,"🚀",px,H-36,34);txt(x,`分數 ${score} 🔥x${combo} ⏱${Math.max(0,90-time|0)}`,W/2,H-8,13);
    if(mt>0)txt(x,msg,W/2,H/2,15,"#ffd23d");
    if(win)return {score:score+900,traps:0};if(qi>=a.shoot.length||time>90)return {score,traps};
  });
  removeEventListener("keydown",kd);G.win=null;return r;
}
// ---------- 5 temple ----------
async function gTemple(a){
  const st=$("#stage");let score=0,traps=0,combo=0,hp=a.fast.length;
  for(let i=0;i<a.fast.length;i++){const q=a.fast[i];
    await new Promise(res=>{let t=8,done=false;
      st.innerHTML=`<div class="card" style="background:#2a1d4a;color:#fff"><div style="display:flex;justify-content:space-between"><b>🏛️ 神殿守護者 HP</b><span class="combo">${combo>1?"🔥x"+combo:""}</span></div><div class="bar" style="margin:6px 0"><i style="width:${hp/a.fast.length*100}%;background:#b05cff"></i></div>
      <div style="text-align:center;font-size:50px">🗿 ⚔️ ${heroHTML()}</div><h3>${q[0]}</h3><div class="bar" style="margin:0 0 8px"><i id="tb" style="width:100%;transition:none;background:#3dd6ff"></i></div>
      ${q[1].map((o,j)=>`<button class="opt" data-j="${j}">${o}</button>`).join("")}<div id="fb"></div></div>`;
      const end=(ok,j)=>{if(done)return;done=true;clearInterval(iv);const bs=st.querySelectorAll(".opt");if(j!=null)bs[j].classList.add(ok?"ok":"no");bs[q[2]].classList.add("ok");
        if(ok){combo++;hp--;score+=80+combo*30+Math.round(t*10)}else{combo=0;traps++}
        $("#fb").innerHTML=`<p>${ok?"💥 命中！":"🛡 守護者擋下了"}${i==a.fast.length-1?"——證書是課程結業證明，不是國家營養師資格！":""}</p>`;setTimeout(res,G._auto?20:900)};
      const iv=setInterval(()=>{t-=.1;const tb=$("#tb");if(tb)tb.style.width=Math.max(0,t/8*100)+"%";if(t<=0)end(false,null)},100);
      st.querySelectorAll(".opt").forEach(b=>b.onclick=()=>end(+b.dataset.j==q[2],+b.dataset.j));
      G.win=()=>end(true,q[2]);if(G._auto&&G.answerAll)setTimeout(()=>G.win&&G.win(),30);
    })}
  G.win=null;return {score,traps};
}
// ---------- 6 tower ----------
function tierOf(v){let p=0;TIERS.forEach(t=>{if(v>=t[0])p=t[1]});return p}
const fmt=n=>n.toLocaleString("en-US");
async function gTower(a){
  const st=$("#stage");let score=0,traps=0;let town=["🏠"];
  const steps=[
   {title:"步驟一：建立你的總部",taps:5,unit:"7,425",total:37125,pct:6,calc:"7,425 × 5 = 37,125 → 6% = 2,228",inc:"2,228",grow:i=>{}},
   {title:"步驟二：協助 A、B、C、D 開分店",taps:4,unit:"分店 37,125",total:155925,pct:12,calc:"37,125 × 4 + 7,425（自己）= 155,925 → 12% = 18,711<br>18,711 − 2,228 × 4（夥伴各自的獎金）= 9,799<br>9,799 × 130%（示範加碼）≈ 12,739",inc:"12,739",grow:i=>town.push("🏪")},
   {title:"步驟三：分店各自成長",taps:4,unit:"分店 155,925",total:631125,pct:21,calc:"155,925 × 4 + 7,425（自己）= 631,125 → 21% = 132,536<br>132,536 − 18,711 × 4 = 57,692<br>57,692 × 170%（示範加碼）≈ 98,076",inc:"98,076",grow:i=>{town[i+1]="🏬"}}];
  for(const s of steps){
    await new Promise(res0=>{let n=0,live=true;const res=()=>{if(live){live=false;G.win=null;res0()}};const lbl=["A","B","C","D"];
      const draw=()=>{if(!live)return;const cur=s===steps[0]?7425*n:s===steps[1]?7425+37125*n:7425+37125*(4-n)+155925*n;
        st.innerHTML=`<div class="card"><h3>🗼 ${s.title}</h3><div class="town">${town.join(" ")}</div>
        <p>小組業績：<b>${fmt(cur)}</b>｜目前級距 <b>${tierOf(cur)}%</b></p>
        <div class="ladder">${TIERS.slice().reverse().map(t=>`<div class="${tierOf(cur)==t[1]?"on":""}"><span>${fmt(t[0])}</span><span>${t[1]}%</span></div>`).join("")}</div>
        ${n<s.taps?`<button class="btn g" id="tp" style="width:100%">${s===steps[0]?"🛒 服務一份顧客業績 +7,425":`🏪 ${s===steps[1]?"協助開設":"輔導成長"} 分店 ${lbl[n]}`}（${n}/${s.taps}）</button>`:""}
        <p class="note">${DISC}</p></div>`;
        const b=$("#tp");if(b)b.onclick=()=>{s.grow(n);n++;score+=40;draw()};else setTimeout(()=>res(),G._auto?10:500)};
      G.win=()=>{while(n<s.taps){s.grow(n);n++}draw()};draw();if(G._auto)setTimeout(()=>G.win&&G.win(),20)});
    // timing stop: pick the tier
    const hit=await new Promise(res=>{let pos=0,dir=1,iv;
      st.innerHTML=`<div class="card"><h3>🎯 對準級距！</h3><p>業績 <b>${fmt(s.total)}</b> 對應哪一級？指針停在正確％時按「停！」</p><div class="ladder" id="ld">${TIERS.map(t=>`<div><span>${fmt(t[0])}</span><span>${t[1]}%</span></div>`).join("")}</div><button class="btn" id="stp" style="width:100%">停！</button></div>`;
      const rows=st.querySelectorAll("#ld div");
      iv=setInterval(()=>{pos+=dir;if(pos>=6||pos<=0)dir*=-1;rows.forEach((r,i)=>r.classList.toggle("on",i==pos))},380);
      let fd=false;const fin=p=>{if(fd)return;fd=true;G.win=null;clearInterval(iv);res(TIERS[p][1]==s.pct)};$("#stp").onclick=()=>fin(pos);
      G.win=()=>fin(TIERS.findIndex(t=>t[1]==s.pct));if(G._auto)setTimeout(()=>G.win&&G.win(),20)});
    if(hit)score+=150;else traps++;
    await new Promise(res=>{st.innerHTML=`<div class="card"><h3>${hit?"✅ 正中 "+s.pct+"%！":"❌ 正確是 "+s.pct+"%"}</h3><div class="town">${town.join(" ")}</div><p>${s.calc}</p><p>你的業績獎金（示範）：<b>${s.inc}</b></p><p class="note">${DISC}</p><button class="btn b" id="nx">繼續 ▶</button></div>`;$("#nx").onclick=res;if(G._auto)setTimeout(res,10)});
  }
  await new Promise(res=>{st.innerHTML=`<div class="card" style="background:#fff6d5"><h2>🔓 解鎖：領導獎金 6%</h2><div class="town">🏠 🏬 🏬 🏬 🏬 🌟</div>
   <p>當你協助的分店也成長到 21%，你可以領取「領導獎金 6%」（示範）：</p><table><tr><td>A 631,125</td><td>× 6% = 37,868</td></tr><tr><td>B 500,000</td><td>× 6% = 30,000</td></tr><tr><td>C 1,000,000</td><td>× 6% = 60,000</td></tr></table>
   <h3>獎金類別一覽</h3><table><tr><th>月結</th><td>業績獎金 21%、領導獎金 6%、紅寶石 2%、明珠 1%</td></tr><tr><th>年度</th><td>翡翠、鑽石、傑出鑽石 各 0.25%</td></tr><tr><th>GAR</th><td>10~100 分（EDC 10、FC 64、FCA 100）</td></tr><tr><th>特別</th><td>年度特別獎勵辦法、創業者獎金</td></tr></table>
   <p class="note">${DISC}。獎金依安麗台灣實際制度與個人努力而定。</p><button class="btn b" id="nx">迎戰魔王問答 ▶</button></div>`;$("#nx").onclick=res;if(G._auto)setTimeout(res,10)});
  G.win=null;return {score,traps};
}
// ---------- extras ----------
function book(){let h=`<h2>📖 寶物圖鑑 ${S.cards.length}/${allCards}（${Math.round(S.cards.length/allCards*100)}%）</h2>`;
  AREAS.forEach(a=>{h+=`<h3>${a.ic} ${a.ch}</h3>`;a.cards.forEach(c=>{const g=S.cards.includes(c[0]);h+=`<div class="card" style="${g?"":"background:#ddd;color:#888"}"><b>${g?c[0]:"？？？"}</b><br><small>${g?c[1]:"通關「"+a.name+"」即可解鎖"}</small></div>`})});
  h+=`<h3>🏅 徽章 ${S.badges.length}/12</h3><p>${S.badges.join("、")||"尚未取得"}</p><button class="btn" onclick="close()">關閉</button>`;modal(h)}
function wardrobe(){const t=totStars();modal(`<h2>🎩 衣櫃（⭐${t}）</h2>${HATS.map(h=>`<button class="btn ${t>=h[0]?"b":"s"}" ${t>=h[0]?`onclick="S.hat='${h[1]}';save();close();renderMap()"`:"disabled"}>${h[1]||"不戴"} ${h[2]||""} ${h[0]?"("+h[0]+"★)":""}</button>`).join("")}<br><button class="btn" onclick="close()">關閉</button>`)}
function board(){const b=S.board.slice().sort((p,q)=>q.s-p.s).slice(0,10);
  modal(`<h2>🏆 本機排行榜</h2><table>${b.map((r,i)=>`<tr><td>${i+1}</td><td>${r.n}</td><td>${r.s}</td><td>${r.d}</td></tr>`).join("")||"<tr><td>還沒有紀錄</td></tr>"}</table>
  <p>目前總分 <b>${totScore()}</b></p><input id="bn" value="${S.name||""}" maxlength="10" style="font-size:16px;padding:6px"><button class="btn g" onclick="S.board.push({n:$('#bn').value||'冒險者',s:totScore(),d:new Date().toLocaleDateString('zh-TW')});save();board()">登錄成績</button>
  <button class="btn b" onclick="shareCard()">📸 分享成績卡</button><button class="btn" onclick="close()">關閉</button><div id="sc"></div>`)}
function shareCard(){const c=document.createElement("canvas");c.width=600;c.height=800;const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,0,800);g.addColorStop(0,"#3d7dff");g.addColorStop(1,"#ff8a3d");x.fillStyle=g;x.fillRect(0,0,600,800);
  txt(x,"人生升級：安麗闖關",300,90,40);txt(x,EVO[evoIdx()][0]+(S.hat||""),300,250,120);txt(x,`${S.name||"冒險者"}｜${EVO[evoIdx()][1]}`,300,340,34);
  txt(x,`Lv.${lvl()}   ⭐${totStars()}/18   總分 ${totScore()}`,300,410,30);txt(x,"夥伴 "+AREAS.filter(a=>S.done[a.id]).map(a=>a.comp.e).join(""),300,480,34);
  txt(x,"基石 "+S.gems.map(g=>"💎"+g).join(" "),300,550,28);txt(x,`圖鑑完成 ${Math.round(S.cards.length/allCards*100)}%`,300,610,28);
  txt(x,"直銷商個人製作，非安麗官方網站",300,760,20);
  c.toBlob(b=>{const f=new File([b],"amway-game-card.png",{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:"人生升級：安麗闖關"}).catch(()=>{});
    const u=URL.createObjectURL(b);const sc=$("#sc");if(sc)sc.innerHTML=`<img src="${u}" style="width:100%;border-radius:12px"><a class="btn g" download="amway-game-card.png" href="${u}">下載成績卡</a>`})}
function ending(){
  const cta=[CFG.lineUrl?`<a class="btn g" href="${CFG.lineUrl}" target="_blank">💬 LINE 聊聊</a>`:CFG.lineId?`<p>LINE ID：${CFG.lineId}</p>`:"",CFG.phone?`<a class="btn b" href="tel:${CFG.phone}">📞 ${CFG.phone}</a>`:""].join("")||`<p style="font-size:13px">（聯絡方式設定中：請在檔案中搜尋 AMWAY_GAME_CONFIG 填入 LINE／電話）</p>`;
  $("#stage").innerHTML=`<div class="card" style="text-align:center"><h1>🌈 四大基石集齊！</h1><div style="font-size:60px">${heroHTML("evo")}</div>
  <div class="gems">${["自由","家庭","希望","獎勵"].map(g=>`<span class="on">💎${g}</span>`).join("")}</div>
  <p><b>自由</b>：用長客計畫與數位工具，經營自己的時間。<br><b>家庭</b>：從選擇身份開始，讓好產品照顧家人。<br><b>希望</b>：持續學習、專業賦能，也把愛傳出去。<br><b>獎勵</b>：依實際制度與付出而來的回饋（非保證、因人而異）。</p></div>
  <div class="card"><h3>💛 希望工場</h3><p>${CFG.hopeName}（2012 年成立；來源：基金會官網章程、公益資訊中心），把「希望」延伸到社會需要的地方。</p><a class="btn b" href="${CFG.hopeUrl}" target="_blank">認識希望工場</a></div>
  <div class="card"><h3>🎬 解鎖影片</h3>${CFG.videos.map(v=>`<p><b>${v.t}</b></p><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${v.id}" allowfullscreen></iframe><a href="${v.url}" target="_blank" style="font-size:13px">在 YouTube 開啟</a>`).join("")}</div>
  <div class="card" style="text-align:center"><h2>想更了解？跟 ${CFG.distributorName} 聊聊</h2>${cta}<p><button class="btn" onclick="board()">🏆 排行榜／分享</button><button class="btn s" onclick="renderMap()">回地圖</button></p><p class="note">本遊戲中所有收入數字皆為示範試算，非保證、因人而異。</p></div>`;
  $("#pTitle").textContent="🌈 結局";show("s-play");G.phase="ending";
}
$("#nameIn").value=S.name||"";
$("#startBtn").onclick=()=>{S.name=$("#nameIn").value.trim()||"冒險者";save();renderMap()};
if(S.name)renderMap();
Object.assign(G,{playArea,renderMap,ending,book,board});
