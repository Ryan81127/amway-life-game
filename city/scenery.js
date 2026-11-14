/* 升級城：天空與海景（小鳥、Amway 飛機、東側海岸與 Amway 獎勵旅遊郵輪）
   只被 city/index.html 載入，主程式的 render() 會呼叫 SCN.ground() 與 SCN.sky()。 */
(function(){
"use strict";
const SHIP_X=W+150,SHIP_L=460,SHIP_B=110;
const SC={last:performance.now(),dt:0,ship:{y:900,dir:1,a:Math.PI/2},birds:[],plane:null,planeT:6,fpPlane:null,fpPlaneT:5,fpBirds:[]};
function tick(){const now=performance.now();SC.dt=Math.min(.05,(now-SC.last)/1000);SC.last=now;const dt=SC.dt,sh=SC.ship;
 sh.y+=sh.dir*42*dt;if(sh.y>W-520)sh.dir=-1;if(sh.y<520)sh.dir=1;const ta=sh.dir>0?Math.PI/2:-Math.PI/2;sh.a+=angDiff(ta,sh.a)*Math.min(1,dt*.6);
 // birds: flocks drift across the view
 const cx=CAM.x,cy=CAM.y;
 while(SC.birds.length<3){const ang=Math.random()*6.28,d=900+Math.random()*300,dir=ang+Math.PI+(Math.random()-.5);const n=4+(Math.random()*4|0),fl={x:cx+Math.cos(ang)*d,y:cy+Math.sin(ang)*d,vx:Math.cos(dir)*70,vy:Math.sin(dir)*70,m:[]};for(let i=0;i<n;i++)fl.m.push({ox:-Math.abs(i-n/2)*18,oy:(i-n/2)*16,ph:Math.random()*6});SC.birds.push(fl)}
 for(const f of SC.birds){f.x+=f.vx*dt;f.y+=f.vy*dt}SC.birds=SC.birds.filter(f=>Math.hypot(f.x-cx,f.y-cy)<1500);
 // plane
 if(!SC.plane){SC.planeT-=dt;if(SC.planeT<=0){const fromW=Math.random()<.5,y=cy+(Math.random()-.5)*500;SC.plane={x:cx+(fromW?-1300:1300),y,vx:fromW?240:-240,vy:(Math.random()-.5)*40}}}
 else{const p=SC.plane;p.x+=p.vx*dt;p.y+=p.vy*dt;if(Math.abs(p.x-cx)>1500){SC.plane=null;SC.planeT=25+Math.random()*20}}}
/* ---------- top-down ---------- */
function drawShip(g,x,y,a,night){g.save();g.translate(x,y);g.rotate(a);const L=SHIP_L,B=SHIP_B;
 // wake
 g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.moveTo(-L/2,-B*.3);g.lineTo(-L/2-260,-B*1.1);g.lineTo(-L/2-260,B*1.1);g.lineTo(-L/2,B*.3);g.fill();
 g.fillStyle="rgba(0,0,0,.25)";g.beginPath();g.ellipse(14,16,L/2+10,B/2+6,0,0,7);g.fill();
 // hull
 g.fillStyle="#f7f8fb";g.beginPath();g.moveTo(-L/2,-B/2);g.lineTo(L*.3,-B/2);g.quadraticCurveTo(L/2+10,-B*.2,L/2+26,0);g.quadraticCurveTo(L/2+10,B*.2,L*.3,B/2);g.lineTo(-L/2,B/2);g.closePath();g.fill();g.strokeStyle="#1d3b6e";g.lineWidth=6;g.stroke();
 // decks
 g.fillStyle="#e6eaf2";g.fillRect(-L*.44,-B*.38,L*.7,B*.76);g.fillStyle="#d7dde8";g.fillRect(-L*.36,-B*.28,L*.5,B*.56);
 g.fillStyle="#38b6e8";g.fillRect(-L*.2,-B*.16,L*.12,B*.32);g.strokeStyle="#fff";g.lineWidth=3;g.strokeRect(-L*.2,-B*.16,L*.12,B*.32);
 g.fillStyle="#ff9a3d";for(let i=0;i<7;i++){g.fillRect(-L*.4+i*L*.1,-B/2+3,L*.06,8);g.fillRect(-L*.4+i*L*.1,B/2-11,L*.06,8)}
 for(const fx of[-L*.32,-L*.02]){g.fillStyle="#c8102e";g.beginPath();g.ellipse(fx,0,18,13,0,0,7);g.fill();g.fillStyle="#1d3b6e";g.beginPath();g.ellipse(fx,0,10,7,0,0,7);g.fill()}
 g.fillStyle="#1d3b6e";g.beginPath();g.arc(L*.3,0,20,0,7);g.fill();g.fillStyle="#fff";g.font="900 20px Anton,sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("H",L*.3,1);
 // name on deck
 g.fillStyle="#1d3b6e";g.font="900 30px 'Noto Sans TC',sans-serif";g.fillText("Amway 獎勵旅遊",L*.08,-B*.34+2);
 if(night){g.fillStyle="#ffe7a0";for(let i=0;i<16;i++){g.fillRect(-L*.42+i*L*.045,-B*.43,6,4);g.fillRect(-L*.42+i*L*.045,B*.4,6,4)}}
 g.restore()}
function ground(vx0,vy0,vx1,vy1,DI){tick();if(vx1<W)return;
 const top=Math.max(vy0,-3000),bot=Math.min(vy1,W+3000);
 ctx.fillStyle="#e9d8a6";ctx.fillRect(W,top,70,bot-top);
 const sg=ctx.createLinearGradient(W+70,0,W+900,0);sg.addColorStop(0,"#3aa7d6");sg.addColorStop(.25,"#2382c0");sg.addColorStop(1,"#155f99");ctx.fillStyle=sg;ctx.fillRect(W+70,top,Math.max(10,vx1-W),bot-top);
 ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=5;ctx.beginPath();for(let y=Math.floor(top/40)*40;y<bot;y+=40){const o=Math.sin(TIME*1.6+y*.05)*6;ctx.moveTo(W+70+o,y);ctx.lineTo(W+70+o,y+28)}ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=3;ctx.beginPath();for(let y=Math.floor(top/90)*90;y<bot;y+=90)for(let x=W+130;x<vx1;x+=140){const o=((TIME*20+x*.3+y)%140);ctx.moveTo(x+o-20,y+((x/140)|0)%2*45);ctx.quadraticCurveTo(x+o,y-6+((x/140)|0)%2*45,x+o+20,y+((x/140)|0)%2*45)}ctx.stroke();
 const sh=SC.ship;if(sh.y>vy0-400&&sh.y<vy1+400)drawShip(ctx,SHIP_X,sh.y,sh.a,DI.dark>.45)}
function bird(x,y,ph,s){const f=Math.sin(TIME*10+ph);ctx.beginPath();ctx.moveTo(x-8*s,y-2*s*f);ctx.quadraticCurveTo(x-4*s,y-6*s*f,x,y);ctx.quadraticCurveTo(x+4*s,y-6*s*f,x+8*s,y-2*s*f);ctx.stroke()}
function drawPlane(p,night){const a=Math.atan2(p.vy,p.vx),sv=sunVec(dayInfo());
 ctx.save();ctx.translate(p.x+60,p.y+70);ctx.rotate(a);ctx.fillStyle="rgba(0,0,30,.16)";planeShape(.9);ctx.restore();
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle="#fff";planeShape(1);
 ctx.fillStyle="#1d3b6e";ctx.fillRect(-60,-3,118,6);
 ctx.save();if(Math.cos(a)<0){ctx.scale(-1,-1)}ctx.fillStyle="#c8102e";ctx.font="900 22px Anton,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("Amway",0,-1);ctx.restore();
 ctx.fillStyle=night?(Math.sin(TIME*8)>0?"#ff3d3d":"#400"):"#ff3d3d";ctx.beginPath();ctx.arc(-6,-74,4,0,7);ctx.fill();ctx.fillStyle=night?(Math.sin(TIME*8)>0?"#38e07a":"#030"):"#38e07a";ctx.beginPath();ctx.arc(-6,74,4,0,7);ctx.fill();
 ctx.restore()}
function planeShape(k){ctx.beginPath();ctx.ellipse(0,0,80*k,13*k,0,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(10*k,-8*k);ctx.lineTo(-18*k,-78*k);ctx.lineTo(-34*k,-78*k);ctx.lineTo(-16*k,-8*k);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(10*k,8*k);ctx.lineTo(-18*k,78*k);ctx.lineTo(-34*k,78*k);ctx.lineTo(-16*k,8*k);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(-58*k,-4*k);ctx.lineTo(-76*k,-30*k);ctx.lineTo(-84*k,-30*k);ctx.lineTo(-74*k,0);ctx.lineTo(-84*k,30*k);ctx.lineTo(-76*k,30*k);ctx.lineTo(-58*k,4*k);ctx.closePath();ctx.fill()}
function sky(vx0,vy0,vx1,vy1,DI){const night=DI.dark>.45;
 if(!night){ctx.strokeStyle="#2a2a33";ctx.lineWidth=2.4;ctx.lineCap="round";for(const f of SC.birds)for(const b of f.m){const x=f.x+b.ox*Math.sign(f.vx||1),y=f.y+b.oy;if(x<vx0||x>vx1||y<vy0||y>vy1)continue;ctx.globalAlpha=.25;ctx.strokeStyle="#000";bird(x+40,y+50,b.ph,1.2);ctx.globalAlpha=1;ctx.strokeStyle="#2a2a33";bird(x,y,b.ph,1.4)}ctx.lineCap="butt"}
 if(SC.plane)drawPlane(SC.plane,night)}
/* ---------- first person ---------- */
function fpExtras(){if(!FB||!ZB)return;tick();const bw=FB.width,bh=FB.height,ps=VW/bw,car=PL.car,a=car?car.a:PL.a,eye=car?22:18,f=Math.min(bw,bh)*.85,hor=Math.round(bh*(VW<VH?.5:.45)),H=hor*ps;
 const o=car||PL,fx=Math.cos(a),fy=Math.sin(a),rx=-fy,ry=fx,dt=SC.dt,night=dayInfo().dark>.45;ctx.setTransform(DPR,0,0,DPR,0,0);
 // ship billboard
 const sh=SC.ship,dx=SHIP_X-o.x,dy=sh.y-o.y,d=dx*fx+dy*fy;if(d>40){const sx=bw/2+(dx*rx+dy*ry)*f/d,col=Math.round(sx);if(sx>-200&&sx<bw+200&&(col<0||col>=bw||ZB[col]>d)){const sc=f/d*ps,X=sx*ps,G=(hor+eye*f/d)*ps,rel=angDiff(sh.a,a),w=(SHIP_B*Math.abs(Math.cos(rel))+SHIP_L*Math.abs(Math.sin(rel)))*sc,h=70*sc;
  ctx.fillStyle="#f7f8fb";ctx.fillRect(X-w/2,G-h*.55,w,h*.55);ctx.fillStyle="#1d3b6e";ctx.fillRect(X-w/2,G-h*.18,w,h*.18);ctx.fillStyle="#e6eaf2";ctx.fillRect(X-w*.38,G-h,w*.7,h*.45);ctx.fillStyle="#c8102e";ctx.fillRect(X-w*.2,G-h*1.3,w*.06,h*.32);ctx.fillRect(X+w*.05,G-h*1.3,w*.06,h*.32);
  ctx.fillStyle="#38b6e8";for(let i=0;i<10;i++)ctx.fillRect(X-w*.34+i*w*.065,G-h*.85,w*.035,h*.12);
  const fs=Math.max(9,Math.min(40,26*sc));ctx.fillStyle="#1d3b6e";ctx.font=`900 ${fs}px 'Noto Sans TC',sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("Amway 獎勵旅遊",X,G-h*.36)}}
 if(!night){// birds drifting in the sky band
  while(SC.fpBirds.length<6)SC.fpBirds.push({x:Math.random()*VW,y:H*(.15+Math.random()*.5),v:(Math.random()<.5?-1:1)*(20+Math.random()*25),ph:Math.random()*6});
  ctx.strokeStyle="#2a2a33";ctx.lineWidth=2;ctx.lineCap="round";for(const b of SC.fpBirds){b.x+=b.v*dt;if(b.x<-30)b.x=VW+30;if(b.x>VW+30)b.x=-30;bird(b.x,b.y,b.ph,1)}ctx.lineCap="butt"}
 if(!SC.fpPlane){SC.fpPlaneT-=dt;if(SC.fpPlaneT<=0){const l=Math.random()<.5;SC.fpPlane={x:l?-160:VW+160,y:H*(.12+Math.random()*.25),v:l?70:-70}}}
 else{const p=SC.fpPlane;p.x+=p.v*dt;ctx.save();ctx.translate(p.x,p.y);if(p.v<0)ctx.scale(-1,1);ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(0,0,54,9,0,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(-22,26);ctx.lineTo(-12,26);ctx.lineTo(8,0);ctx.fill();ctx.beginPath();ctx.moveTo(-42,-2);ctx.lineTo(-54,-20);ctx.lineTo(-46,-20);ctx.lineTo(-34,-2);ctx.fill();ctx.fillStyle="#c8102e";ctx.font="900 13px Anton,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("Amway",4,0);ctx.restore();
  if(p.x<-200||p.x>VW+200){SC.fpPlane=null;SC.fpPlaneT=20+Math.random()*20}}}
const _rfp=renderFP;renderFP=function(){_rfp.apply(this,arguments);fpExtras()};
/* ---------- minimap: sea to the east ---------- */
const _dm=drawMini;drawMini=function(){_dm.apply(this,arguments);const s=272,R=s/2,sc=2*MS_,o=PL.car||PL,x0=R+(W-o.x)*sc;if(x0>s)return;
 mx.save();mx.setTransform(1,0,0,1,0,0);mx.beginPath();mx.arc(R,R,R-1,0,7);mx.clip();mx.fillStyle="#e9d8a6";mx.fillRect(x0,0,70*sc,s);mx.fillStyle="#2382c0";mx.fillRect(x0+70*sc,0,s,s);
 const sy=R+(SC.ship.y-o.y)*sc;mx.fillStyle="#fff";mx.strokeStyle="#1d3b6e";mx.lineWidth=2;mx.beginPath();mx.ellipse(R+(SHIP_X-o.x)*sc,sy,5,14,0,0,7);mx.fill();mx.stroke();mx.restore()};
window.SCN={ground,sky,state:SC};
})();
