import type {Character} from '../entities/types';
import {pose,solve,drawFigure} from '../render/StickFigure';
import {flightRate,type CrashFlight,type FlightPreferences,type FlightRecord} from '../casino/flight';
import {roundBox} from './CanvasStage';

/** Sky High: the casino's rocket crash scene. Everything here is a pure function of the saved flight and the clock,
 *  so the live view, the replay and a resumed save all draw the same picture. Nothing here touches the random end point. */
export const SKY_W=1200,SKY_H=700;
export interface Livery{name:string;body:string;accent:string;trim:string}
export const LIVERIES:readonly Livery[]=[
 {name:'Mosaic Rose',body:'#f4efe8',accent:'#e0428f',trim:'#ffd36a'},{name:'Kiwi Gold',body:'#f3e8c8',accent:'#c8961c',trim:'#fff3c0'},
 {name:'Pounamu',body:'#e6f1ec',accent:'#2f9e75',trim:'#baf2da'},{name:'Midnight',body:'#4a4f72',accent:'#8f9bff',trim:'#e3e6ff'},
 {name:'Lava',body:'#f3e4da',accent:'#e2552b',trim:'#ffd0a0'},{name:'Glacier',body:'#e9f3f7',accent:'#3aa0d8',trim:'#c9ecff'},
 {name:'Chrome',body:'#d4d8de',accent:'#5a6270',trim:'#ffffff'},{name:'Sunburst',body:'#fff0c8',accent:'#f08a24',trim:'#fff7dc'},
 {name:'Amethyst',body:'#eee6f7',accent:'#8a4bd6',trim:'#e7d3ff'},{name:'Tessera Red',body:'#f3e7e5',accent:'#c0343c',trim:'#ffc9c9'},
 {name:'Mint',body:'#e5f7ef',accent:'#26b394',trim:'#c4fff0'},{name:'Obsidian',body:'#35323b',accent:'#e8c15a',trim:'#fff0b8'}];
const PORT=[-40,34,108] as const;
const MILESTONES:readonly (readonly [number,string])[]=[[2,'CLIMBING'],[3,'HIGHER!'],[5,'SKY HIGH!'],[10,'ORBIT!'],[20,'MOON SHOT!'],[50,'DEEP SPACE!'],[100,'LEGEND!'],[250,'IMPOSSIBLE!']];
const STAGES:readonly (readonly [number,string])[]=[[0,'SKY'],[.7,'STRATOSPHERE'],[1.6,'SPACE'],[3,'DEEP SPACE'],[4.6,'BEYOND']];
const DAY={day:['#3f95d6','#cfeaf7'],sunset:['#4b3a7a','#f4a77c'],night:['#0b1230','#2b3b72']} as const;
const FONT='"Segoe UI",system-ui,-apple-system,sans-serif';
export interface SkyView{f?:CrashFlight;livery:number;scene:number;riders:readonly Character[];crew:readonly Character[];history:readonly FlightRecord[];prefs:FlightPreferences;replaySeconds?:number}
/** What a crew Mosaic is doing this round. The bets are for show: they only react to the end point, they never influence it. */
export interface CrewPlan{stake:number;target:number;out:boolean;at:number}

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const wrap=(n:number,s:number)=>((n%s)+s)%s;
const rnd=(a:number,b=0)=>{let x=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263))|0;x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967295;};
const hex=(s:string)=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const mix=(a:string,b:string,t:number)=>{const x=hex(a),y=hex(b);return`rgb(${Math.round(lerp(x[0],y[0],t))},${Math.round(lerp(x[1],y[1],t))},${Math.round(lerp(x[2],y[2],t))})`;};
const money=(n:number)=>'$'+Math.floor(n).toLocaleString('en-NZ');
const tier=(m:number)=>m<2?'#8cffbe':m<5?'#ffe9a6':m<10?'#ffb35c':m<25?'#ff7a59':'#ff4fa3';
const ease=(t:number)=>1-Math.pow(1-clamp(t,0,1),3);
export function crewPlan(f:Pick<CrashFlight,'start'|'bust'>,id:number,rate:number):CrewPlan{
 const s=f.start%100003,target=1.12-Math.log(1-rnd(s,id*31+7)*.995)*2.4,stake=[10,20,25,50,100,250][Math.floor(rnd(s,id+3)*6)%6];
 return{stake,target,out:target<f.bust,at:Math.log(target)/rate};
}
const ell=(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number)=>{g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);g.fill();};
const text=(g:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color:string,align:CanvasTextAlign='center',weight=700,shade=true)=>{g.font=`${weight} ${size}px ${FONT}`;g.textAlign=align;g.textBaseline='alphabetic';g.fillStyle=color;if(shade){g.shadowColor='rgba(0,0,0,.7)';g.shadowBlur=5;}g.fillText(s,x,y);if(shade)g.shadowBlur=0;};
const pill=(g:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color:string,bg:string,border:string)=>{g.font=`700 ${size}px ${FONT}`;const w=g.measureText(s).width+size*1.5,h=size*1.9;roundBox(g,x-w/2,y-h/2,w,h,h/2,bg,border);text(g,s,x,y+size*.35,size,color);};

export function drawSkyHigh(g:CanvasRenderingContext2D,v:SkyView,time:number,reduced:boolean,W=SKY_W,H=SKY_H):void{
 const f=v.f,prefs=v.prefs,rate=f?flightRate(f):.15,calm=reduced||!prefs.effects,lv=LIVERIES[(f?.model??v.livery)%LIVERIES.length]??LIVERIES[0],theme=f?.scene??v.scene;
 const nowMs=v.replaySeconds===undefined?Date.now():(f?.start??0)+v.replaySeconds*1000,elapsed=f?Math.max(0,(nowMs-f.start)/1000):0;
 const bustSec=f?Math.log(f.bust)/rate:Infinity,endSec=f?.paid?((f.endedAt??f.start)-f.start)/1000:Infinity;
 /* The player is "out" once their cash-out time has passed. The rocket keeps climbing (faster) to show where it would have blinked. */
 const out=!!f&&f.outcome==='landed'&&f.paid===true&&elapsed>=endSec,trueSec=out?endSec+(elapsed-endSec)*2.2:elapsed;
 const rocketSec=f?Math.min(trueSec,bustSec):0,blinked=!!f&&trueSec>=bustSec,blinkT=blinked?(trueSec-bustSec)/(out?2.2:1):-1;
 const mult=Math.exp(rate*rocketSec),alt=Math.log(Math.max(1,mult)),k=clamp(alt/3,0,1),youMult=out?(f!.cashMultiplier??Math.exp(rate*endSec)):mult,live=!!f&&!blinked&&!out;
 const hu=Math.min(W/820,H/700,1.15),u=hu*1.28,t=reduced?0:time,night=prefs.day==='night';
 const sx=(60*rocketSec+75*rate*rocketSec*rocketSec)*u,sy=(40*rocketSec+80*rate*rocketSec*rocketSec)*u;

 /* ---- the camera shakes harder the higher it goes ---- */
 const rumble=f&&rocketSec<2.6&&!blinked?(2.6-rocketSec)*2.2:0,amp=calm?0:(blinked?Math.max(0,1-blinkT*2.2)*15:Math.min(9,Math.max(0,alt-.7)*3.4)+rumble)*u;
 const shx=amp?(Math.sin(t*93.1)+Math.sin(t*57.7)*.7)*amp*.5:0,shy=amp?(Math.cos(t*81.3)+Math.sin(t*44.9)*.7)*amp*.5:0;
 g.save();g.beginPath();g.rect(0,0,W,H);g.clip();g.translate(shx,shy);

 /* ---- sky, stars, nebula, clouds, planets ---- */
 const [top,bot]=DAY[prefs.day],sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,mix(top,'#04020c',k));sky.addColorStop(1,mix(bot,'#1b0a36',k));g.fillStyle=sky;g.fillRect(-30,-30,W+60,H+60);
 const starsOn=clamp(k*1.7-.15,night?.55:0,1);
 if(starsOn>.02){const streak=live&&alt>1.1&&!calm?Math.min(5,alt-.8):0;for(let layer=0;layer<3;layer++){const sp=.2+layer*.35,size=.9+layer*.8,count=62-layer*14;g.fillStyle=['rgba(200,215,255,.55)','rgba(225,235,255,.8)','#fff'][layer];g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.1;g.globalAlpha=starsOn;for(let i=0;i<count;i++){const x=wrap(rnd(i,layer*7+1)*W*1.2-sx*sp,W*1.2)-W*.1,y=wrap(rnd(i,layer*7+2)*H*1.2+sy*sp,H*1.2)-H*.1;if(streak&&layer>0){g.beginPath();g.moveTo(x,y);g.lineTo(x+streak*(7+layer*9)*.42*u,y-streak*(7+layer*9)*u);g.stroke();}g.fillRect(x,y,size*u+.4,size*u+.4);}}g.globalAlpha=1;}
 if(k>.4){g.globalAlpha=clamp((k-.4)*.9,0,.45);for(let i=0;i<3;i++){const x=wrap(rnd(i,201)*W-sx*.05,W*1.4)-W*.2,y=wrap(rnd(i,202)*H+sy*.06,H*1.4)-H*.2,r=Math.max(W,H)*(.3+rnd(i,203)*.25),n=g.createRadialGradient(x,y,0,x,y,r);n.addColorStop(0,['#7a3cc8','#2fa8b8','#c8407a'][i]);n.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=n;g.fillRect(x-r,y-r,r*2,r*2);}g.globalAlpha=1;}
 const cloudA=clamp(1-k/.7,0,1);if(cloudA>.02){g.globalAlpha=cloudA;g.fillStyle=night?'rgba(150,165,210,.35)':'rgba(255,255,255,.62)';for(let i=0;i<9;i++){const sp=.8+rnd(i,95)*.5,x=wrap(rnd(i,91)*W*1.6-sx*sp,W*1.6)-W*.3,y=wrap(rnd(i,92)*H*1.4+sy*sp,H*1.4)-H*.2,s=(50+rnd(i,93)*70)*Math.max(.7,u);ell(g,x,y,s,s*.3);ell(g,x+s*.5,y-s*.1,s*.6,s*.25);ell(g,x-s*.45,y+s*.05,s*.5,s*.2);}g.globalAlpha=1;}
 /* worlds drift down past the rocket as it climbs */
 for(const [a,bx,r,kind] of [[1.3,.84,48,0],[2.05,.13,92,1],[2.9,.8,140,2],[3.6,.18,64,0],[4.3,.7,210,3]] as const){const y=H*.5+(alt-a)*H*.95,R=r*Math.max(.7,u);if(y<-R*2||y>H+R*2)continue;const x=W*bx;
  if(kind===3){const s=g.createRadialGradient(x,y,0,x,y,R*1.8);s.addColorStop(0,'#fff6d0');s.addColorStop(.25,'#ffd36a');s.addColorStop(1,'rgba(255,120,60,0)');g.fillStyle=s;g.fillRect(x-R*2,y-R*2,R*4,R*4);continue;}
  const body=g.createRadialGradient(x-R*.35,y-R*.35,R*.1,x,y,R);body.addColorStop(0,kind===0?'#eceaf0':kind===1?'#f0c9a0':'#d98acb');body.addColorStop(1,kind===0?'#6f6a7c':kind===1?'#8a4f5e':'#4a2a78');
  if(kind===1){g.save();g.translate(x,y);g.rotate(-.35);g.strokeStyle='rgba(255,226,180,.55)';g.lineWidth=R*.16;g.beginPath();g.ellipse(0,0,R*1.65,R*.42,0,Math.PI,Math.PI*2);g.stroke();g.restore();}
  g.fillStyle=body;g.beginPath();g.arc(x,y,R,0,Math.PI*2);g.fill();
  if(kind===0){g.fillStyle='rgba(60,55,75,.28)';for(let c=0;c<5;c++)ell(g,x+(rnd(c,7)-.5)*R*1.1,y+(rnd(c,8)-.5)*R*1.1,R*.12*(1+rnd(c,9)),R*.1*(1+rnd(c,9)));}
  if(kind===2){g.save();g.beginPath();g.arc(x,y,R,0,Math.PI*2);g.clip();for(let c=0;c<7;c++){g.fillStyle=c%2?'rgba(255,200,240,.16)':'rgba(60,20,90,.2)';g.fillRect(x-R,y-R+c*R*.3,R*2,R*.16);}g.restore();}
  if(kind===1){g.save();g.translate(x,y);g.rotate(-.35);g.strokeStyle='rgba(255,226,180,.75)';g.lineWidth=R*.16;g.beginPath();g.ellipse(0,0,R*1.65,R*.42,0,0,Math.PI);g.stroke();g.restore();}}

 /* ---- rocket placement: lifts off the pad, then hangs in the sky while the world rushes past ---- */
 const lift=ease(rocketSec/2.6),groundY=H*.9,padTop=groundY-14*u,ry0=padTop-182*u,rx=lerp(W*.4,W*.48,lift)+(calm?0:Math.sin(t*1.7)*5*u*lift),ry=lerp(ry0,H*.56,lift)+(calm?0:Math.sin(t*2.2)*6*u*lift),tilt=lift*.34,cs=Math.cos(tilt),sn=Math.sin(tilt);
 const scr=(lx:number,ly:number)=>({x:rx+(lx*cs-ly*sn)*u,y:ry+(lx*sn+ly*cs)*u});

 /* ---- the launch site falls away ---- */
 const drop=u*(rocketSec*rocketSec*70+rocketSec*40),gy=groundY+drop;
 if(gy<H+260*u){
  const gs=night?'#0d1522':theme===3||theme===1||theme===7?'#1e4c5e':theme===4?'#7a5a3e':'#243a34';
  if([2,4,5,6].includes(theme)){g.fillStyle=night?'#1a2438':'#5e7a82';g.beginPath();g.moveTo(0,gy);for(let x=0;x<=W+120;x+=120)g.lineTo(x,gy-(60+rnd(x/120,theme)*150)*u);g.lineTo(W,gy);g.fill();}
  else if(![1,3,7].includes(theme)){for(let i=0;i<14;i++){const bx=i*W/12-30,bh=(60+rnd(i,theme+4)*170)*u;g.fillStyle=night?'#141c2c':'#4a5d68';g.fillRect(bx,gy-bh,W/12-6,bh+20);g.fillStyle=night?'#f1d48a':'#8aa4ad';for(let r=0;r<bh/(22*u);r++)for(let c=0;c<3;c++)if((i+r+c)%3)g.fillRect(bx+10*u+c*(W/42),gy-bh+10*u+r*22*u,5*u,8*u);}}
  g.fillStyle=gs;g.fillRect(-10,gy,W+20,H-gy+260*u);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(-10,gy,W+20,3*u);
  g.fillStyle='#6d7078';g.fillRect(rx-130*u,gy-14*u,260*u,16*u);g.fillStyle='#43464d';g.fillRect(rx-130*u,gy-2*u,260*u,6*u);
  g.fillStyle='#8a8d94';g.fillRect(rx-186*u,gy-300*u,26*u,300*u);g.strokeStyle='#8a8d94';g.lineWidth=3*u;g.beginPath();for(let i=0;i<8;i++){g.moveTo(rx-186*u,gy-i*37*u);g.lineTo(rx-160*u,gy-(i+1)*37*u);}g.stroke();g.fillStyle='#e0428f';ell(g,rx-173*u,gy-306*u,5*u,5*u);
  if(f&&rocketSec<4){const a=clamp(1-rocketSec/4,0,1)*.8;g.fillStyle=`rgba(235,232,240,${a})`;for(let i=0;i<9;i++){const s=(40+i*14)*u*(.6+rocketSec*.5);ell(g,rx+(i%2?1:-1)*(30+i*26+rocketSec*70)*u,gy-s*.18,s,s*.34);}}
 }

 /* ---- weather near the ground only ---- */
 if(prefs.weather!=='clear'&&prefs.effects&&k<.45){g.globalAlpha=1-k/.45;g.strokeStyle='#dbe6df99';g.fillStyle='#eef3e6cc';g.lineWidth=1.4;g.beginPath();for(let i=0;i<70;i++){const x=wrap(i*157-t*55,W),y=wrap(i*97+t*(prefs.weather==='snow'?24:240)+sy*.3,H);if(prefs.weather==='snow'){g.moveTo(x+2,y);g.arc(x,y,2,0,Math.PI*2);}else{g.moveTo(x,y);g.lineTo(x-5,y+11);}}prefs.weather==='snow'?g.fill():g.stroke();g.globalAlpha=1;}

 /* ---- speed lines ---- */
 if(live&&alt>.5&&!calm){g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=1.2*u;g.beginPath();const n=Math.floor(8+alt*7);for(let i=0;i<n;i++){const x=rnd(i,41)*W,len=(40+rnd(i,42)*90)*(.6+alt*.35)*u,y=wrap(rnd(i,43)*H+t*(900+alt*350)*u,H+len)-len;g.moveTo(x,y);g.lineTo(x+len*.42,y-len);}g.stroke();}

 const ex=scr(0,176).x,ey=scr(0,176).y;
 /* ---- exhaust trail: a stateless ribbon of puffs whose age rolls with the clock ---- */
 if(f&&!blinked&&(rocketSec>0||elapsed>0)){const N=calm?18:38,speed=(170+130*alt)*u;for(let i=0;i<N;i++){const age=(t*1.5+i/N)%1,life=age*1.25,d=speed*life,px=ex-sn*d+(rnd(i,31)-.5)*26*age*u,py=ey+cs*d,r=(12+age*40*(1+Math.min(alt,3)*.25))*u;g.fillStyle=mix(age<.2?'#fff0b0':'#ffb35c','#c9c4d6',Math.sqrt(age));g.globalAlpha=Math.pow(1-age,1.6)*.4;ell(g,px,py,r,r);}g.globalAlpha=1;
  if(!calm){g.fillStyle='#ffd36a';for(let i=0;i<14;i++){const age=(t*2.3+i*.137)%1,d=(80+rnd(i,51)*280)*u*age;g.globalAlpha=1-age;g.fillRect(ex-sn*d+(rnd(i,52)-.5)*70*u*age,ey+cs*d,2.4*u,2.4*u);}g.globalAlpha=1;}}

 /* ---- the rocket ---- */
 if(!blinked){
  g.save();g.translate(rx,ry);g.rotate(tilt);g.scale(u,u);
  const heat=clamp((alt-1.5)/3,0,1);
  if(f&&!blinked){const fl=(76+Math.min(alt,5)*34)*(calm?1:1+Math.sin(t*41)*.1+Math.sin(t*67)*.06),wob=calm?0:Math.sin(t*53)*5;
   const glow=g.createRadialGradient(0,196,0,0,230,fl*1.5);glow.addColorStop(0,'rgba(255,190,90,.55)');glow.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=glow;g.fillRect(-fl*1.6,150,fl*3.2,fl*2.2);
   g.fillStyle='#ff8c28';g.beginPath();g.moveTo(-34,180);g.quadraticCurveTo(-40+wob,180+fl*.55,wob,180+fl);g.quadraticCurveTo(40+wob,180+fl*.55,34,180);g.fill();
   g.fillStyle='#ffd36a';g.beginPath();g.moveTo(-22,180);g.quadraticCurveTo(-24+wob*.6,180+fl*.45,wob*.6,180+fl*.72);g.quadraticCurveTo(24+wob*.6,180+fl*.45,22,180);g.fill();
   g.fillStyle='#fff7d8';g.beginPath();g.moveTo(-11,180);g.quadraticCurveTo(-10,180+fl*.3,0,180+fl*.46);g.quadraticCurveTo(10,180+fl*.3,11,180);g.fill();}
  const fin=(s:number)=>{g.fillStyle=lv.accent;g.strokeStyle='#1d1a24';g.lineWidth=5;g.beginPath();g.moveTo(s*64,40);g.quadraticCurveTo(s*124,70,s*138,176);g.lineTo(s*106,170);g.lineTo(s*64,140);g.closePath();g.fill();g.stroke();g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.moveTo(s*64,100);g.lineTo(s*124,150);g.lineTo(s*106,170);g.lineTo(s*64,140);g.fill();};fin(-1);fin(1);
  g.fillStyle='#2a2630';g.strokeStyle='#1d1a24';g.lineWidth=5;g.beginPath();g.moveTo(-36,148);g.lineTo(36,148);g.lineTo(50,184);g.lineTo(-50,184);g.closePath();g.fill();g.stroke();
  const hull=()=>{g.beginPath();g.moveTo(-70,152);g.lineTo(-70,-70);g.bezierCurveTo(-70,-142,-35,-190,0,-208);g.bezierCurveTo(35,-190,70,-142,70,-70);g.lineTo(70,152);g.closePath();};
  const sh=g.createLinearGradient(-70,0,70,0);sh.addColorStop(0,mix(lv.body,'#000000',.22));sh.addColorStop(.3,lv.body);sh.addColorStop(.62,lv.body);sh.addColorStop(1,mix(lv.body,'#000000',.38));g.fillStyle=sh;hull();g.fill();
  g.save();hull();g.clip();const nose=g.createLinearGradient(-70,0,70,0);nose.addColorStop(0,mix(lv.accent,'#000000',.15));nose.addColorStop(.35,lv.accent);nose.addColorStop(1,mix(lv.accent,'#000000',.45));g.fillStyle=nose;g.fillRect(-76,-215,152,148);g.fillStyle=lv.trim;g.fillRect(-76,-67,152,6);g.fillStyle=lv.accent;g.fillRect(-76,126,152,26);g.fillStyle=lv.trim;g.fillRect(-76,120,152,5);
   g.fillStyle='rgba(255,255,255,.34)';g.beginPath();g.ellipse(-44,-130,9,38,.25,0,Math.PI*2);g.fill();g.fillStyle='rgba(255,255,255,.22)';g.fillRect(-58,-52,9,176);
   if(heat>0){const hg=g.createLinearGradient(0,-210,0,-60);hg.addColorStop(0,`rgba(255,90,40,${.5*heat})`);hg.addColorStop(1,'rgba(255,90,40,0)');g.fillStyle=hg;g.fillRect(-76,-215,152,160);}g.restore();
  g.strokeStyle='#1d1a24';g.lineWidth=5;hull();g.stroke();
  /* portholes: the Mosaics ride inside, seated, and react to the climb */
  const riders=v.riders.slice(0,3);
  riders.forEach((c,i)=>{
   const cy=PORT[i],plan=i===0||!f?null:crewPlan(f,c.id,rate),youIdx=i===0;
   const cashedNow=youIdx?out:!!plan&&plan.out&&rocketSec>=plan.at,sinceCash=youIdx?(out?(elapsed-endSec):0):plan&&cashedNow?rocketSec-plan.at:0;
   const crossed=MILESTONES.filter(([m])=>mult>=m&&rocketSec-Math.log(m)/rate<1.1).length>0&&!cashedNow;
   const mood=!f?'sit':blinked&&!cashedNow?'panic':cashedNow?(sinceCash<1.5?'cheer':youIdx?'cheer':'drink'):crossed?'cheer':mult>=12?'panic':mult>=4?'think':'sit';
   g.save();g.beginPath();g.arc(0,cy,30,0,Math.PI*2);g.clip();
   const room=g.createLinearGradient(0,cy-30,0,cy+30);room.addColorStop(0,'#3a2b52');room.addColorStop(1,'#80506f');g.fillStyle=room;g.fillRect(-32,cy-32,64,64);
   g.fillStyle='rgba(20,10,30,.55)';g.beginPath();g.roundRect(-27,cy-2,54,42,10);g.fill();
   const bob=calm||!f?0:Math.sin(t*(5+alt*2)+i*2)*Math.min(2.4,.4+alt*.5)+(rocketSec<2.6?Math.sin(t*38+i)*1.2:0),kf=.98;
   g.save();solve(pose(mood,c.style,t*1.2,t*5+c.seedPhase,0,0),-1,cy-9+96.7*kf+bob,kf,1);drawFigure(g,c,-1,cy-9+96.7*kf+bob,kf,1,t,0,1,false);g.restore();
   const gl=g.createLinearGradient(-22,cy-26,16,cy+12);gl.addColorStop(0,'rgba(255,255,255,.38)');gl.addColorStop(.35,'rgba(255,255,255,.08)');gl.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gl;g.fillRect(-32,cy-32,64,64);
   g.restore();
   const ring=g.createLinearGradient(-30,cy-30,30,cy+30);ring.addColorStop(0,lv.trim);ring.addColorStop(.5,'#8d8a96');ring.addColorStop(1,'#46424e');g.strokeStyle=ring;g.lineWidth=6;g.beginPath();g.arc(0,cy,32.5,0,Math.PI*2);g.stroke();g.strokeStyle='#1d1a24';g.lineWidth=2.4;g.beginPath();g.arc(0,cy,36.5,0,Math.PI*2);g.stroke();
   g.fillStyle='#d8d4de';for(let b=0;b<6;b++){const a=b*1.047+.3;ell(g,Math.cos(a)*36.5,cy+Math.sin(a)*36.5,1.7,1.7);}
  });
  g.restore();
  /* crew cash-out tags float beside their windows */
  if(f)riders.forEach((c,i)=>{if(i===0)return;const plan=crewPlan(f,c.id,rate),since=rocketSec-plan.at;if(plan.out&&since>=0&&since<2.6&&!blinked){const p=scr(84,PORT[i]),a=clamp(1-since/2.6,0,1);g.globalAlpha=a;pill(g,(c.name.split(' ')[0]||'Mosaic').slice(0,9)+' ✓ '+plan.target.toFixed(2)+'×',p.x+58*u,p.y-since*14*u,Math.max(11,13*u),'#9bffc6','#10241bdd','#3ddc84');g.globalAlpha=1;}});
 }

 /* ---- cash-out burst: coins pop out of your window ---- */
 if(out&&!calm){const s=elapsed-endSec;if(s<2){const p=scr(0,PORT[0]);for(let i=0;i<30;i++){const a=-Math.PI/2+(rnd(i,61)-.5)*2.6,sp=(180+rnd(i,62)*340)*u,x=p.x+Math.cos(a)*sp*s,y=p.y+Math.sin(a)*sp*s+620*u*s*s*.5;g.globalAlpha=clamp(1.8-s,0,1);g.fillStyle='#f2c14e';g.strokeStyle='#8a5d00';g.lineWidth=1.2;g.beginPath();g.ellipse(x,y,6*u*Math.abs(Math.cos(s*9+i)),6*u,0,0,Math.PI*2);g.fill();g.stroke();}g.globalAlpha=1;}}

 /* ---- the blink: flash, fireball, shockwave, debris, parachuting Mosaics ---- */
 if(blinked){const s=blinkT,bp=scr(0,0);
  const fr=(50+s*340)*u,fa=clamp(1-s/1.3,0,1);if(fa>0){const fb=g.createRadialGradient(bp.x,bp.y,0,bp.x,bp.y,fr);fb.addColorStop(0,`rgba(255,255,225,${fa})`);fb.addColorStop(.4,`rgba(255,170,50,${fa*.85})`);fb.addColorStop(1,'rgba(200,40,40,0)');g.fillStyle=fb;g.fillRect(bp.x-fr,bp.y-fr,fr*2,fr*2);}
  if(s<1.1){g.strokeStyle=`rgba(255,226,170,${1-s/1.1})`;g.lineWidth=(12-s*9)*u;g.beginPath();g.arc(bp.x,bp.y,s*820*u,0,Math.PI*2);g.stroke();}
  for(let i=0;i<34;i++){const ang=rnd(i,5)*Math.PI*2,sp=(150+rnd(i,6)*520)*u,x=bp.x+Math.cos(ang)*sp*s,y=bp.y+Math.sin(ang)*sp*s+260*u*s*s,sz=(4+rnd(i,7)*10)*u,a=clamp(1.9-s,0,1);if(a<=0)continue;g.save();g.translate(x,y);g.rotate(s*(rnd(i,8)*12-6));g.globalAlpha=a;g.fillStyle=[lv.body,lv.accent,'#2a2630','#ffb35c'][i%4];g.fillRect(-sz/2,-sz/2,sz,sz*.6);g.restore();}
  v.riders.slice(0,3).forEach((c,i)=>{const e0=scr(0,PORT[i]),vx=(i-1)*190*u,rise=-260*u*(1-Math.exp(-3*s))/3,fall=70*u*(s-(1-Math.exp(-3*s))/3),cx=e0.x+vx*(1-Math.exp(-2*s))/2+Math.sin(s*2.1+i)*14*u,cy=e0.y+rise+fall;if(cy>H+160*u)return;
   const open=clamp((s-.45)/.35,0,1),plan=i===0||!f?null:crewPlan(f,c.id,rate),safe=i===0?out:!!plan&&plan.out;
   if(open>0){const r=54*u*open;g.fillStyle=[lv.accent,lv.trim,'#8cd0ff'][i%3];g.strokeStyle='#1d1a24';g.lineWidth=2;g.beginPath();g.arc(cx,cy-74*u*open,r,Math.PI,0);for(let b=0;b<4;b++)g.quadraticCurveTo(cx-r+(b+1)*r/2,cy-74*u*open+r*.28,cx-r+(b+1)*r/2,cy-74*u*open);g.fill();g.stroke();g.beginPath();g.moveTo(cx-r,cy-74*u*open);g.lineTo(cx,cy-22*u);g.moveTo(cx+r,cy-74*u*open);g.lineTo(cx,cy-22*u);g.stroke();}
   g.save();const m=safe||s>1.2?'cheer':'panic';solve(pose(m,c.style,t,t*5+c.seedPhase,0,0),cx,cy+44*u,.72*hu,1);drawFigure(g,c,cx,cy+44*u,.72*hu,1,t,0,1,false);g.restore();});
 }
 g.restore();

 /* ---- screen effects (not shaken) ---- */
 if(live&&alt>1.6&&!calm){const a=clamp((alt-1.6)/2.2,0,1)*.34*(.65+.35*Math.sin(t*9)),vg=g.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.95);vg.addColorStop(0,'rgba(255,40,80,0)');vg.addColorStop(1,`rgba(255,40,80,${a})`);g.fillStyle=vg;g.fillRect(0,0,W,H);}
 if(f&&!calm){const hits=MILESTONES.filter(([m])=>mult>=m&&!blinked&&rocketSec-Math.log(m)/rate<.18);if(hits.length){const s=rocketSec-Math.log(hits[hits.length-1][0])/rate;g.fillStyle=`rgba(255,255,255,${(.18-s)*1.1})`;g.fillRect(0,0,W,H);}}
 if(blinked&&blinkT<.35){g.fillStyle=`rgba(255,255,255,${clamp(.9-blinkT*2.6,0,.9)})`;g.fillRect(0,0,W,H);}

 /* ---- milestone banner ---- */
 if(f&&!blinked){const m=[...MILESTONES].reverse().find(([x])=>mult>=x&&rocketSec-Math.log(x)/rate<1.7);if(m){const s=rocketSec-Math.log(m[0])/rate,pop=s<.22?ease(s/.22)*1.25:1.25-Math.min(.25,(s-.22)*.4),a=clamp(1.7-s,0,1)*clamp(s*8,0,1),cx=W*.82,cy=H*.52;
  g.save();g.globalAlpha=a;g.translate(cx,cy);g.scale(pop,pop);text(g,'×'+m[0],0,0,Math.max(30,58*hu),'#000','center',800,false);g.translate(-2,-2);text(g,'×'+m[0],0,0,Math.max(30,58*hu),'#ffe9a6','center',800,false);g.translate(2,2);text(g,m[1],0,Math.max(18,28*hu),Math.max(13,19*hu),'#fff','center',800);g.restore();
  if(!calm&&s<.8){const p=scr(0,0);g.strokeStyle=`rgba(255,233,166,${(1-s/.8)*.7})`;g.lineWidth=5*hu;g.beginPath();g.arc(p.x,p.y,s*420*hu+60*hu,0,Math.PI*2);g.stroke();}}}

 /* ---- HUD ---- */
 const wide=W>=900,hud=prefs.hud;
 const bigNum=!f?'READY':mult.toFixed(2)+'×',col=!f?'#ffe9a6':blinked?'#ff465a':out?'#cfc8e4':tier(mult),pulse=live?1+Math.sin(t*(6+alt))*.016*Math.min(4,alt):1,numY=H*.17;
 g.save();g.translate(W/2,numY);g.scale(pulse,pulse);g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=18*hu;text(g,bigNum,3,3,(f?96:64)*hu,'#000','center',800,false);g.shadowBlur=live&&alt>1?24*hu:0;g.shadowColor=col;text(g,bigNum,0,0,(f?96:64)*hu,col,'center',800,false);g.restore();
 const subY=numY+36*hu,size=Math.max(13,17*hu);
 if(!f)text(g,'Rocket fuelled and ready',W/2,subY,size,'#e6ecf6');
 else if(blinked&&out)text(g,'BLINKED — but you were already out',W/2,subY,size,'#e6ecf6');
 else if(blinked)text(g,f.stake>0?'BLINKED. You lost '+money(f.stake):'BLINKED · practice, nothing lost',W/2,subY,size,'#ffb5a3');
 else if(!out)text(g,f.stake>0?'Stake '+money(f.stake)+'  ·  worth '+money(f.stake*mult)+' now':'Free practice  ·  no chips at risk',W/2,subY,size,'#e6ecf6');
 else text(g,'Rocket still climbing…',W/2,subY,size,'#cfc8e4');
 if(out)pill(g,'YOU CASHED OUT '+youMult.toFixed(2)+'×'+(f!.stake>0?'  ·  '+(f!.returned!>=f!.stake?'+':'')+money((f!.returned??0)-f!.stake):''),W/2,subY+32*hu,Math.max(12,16*hu),'#ffe9a6','#2b2108ee','#f2c14e');

 if(hud){
  /* crash points of your recent rockets, newest first */
  let hx=14;const chips=v.history.slice(-(wide?9:5)).reverse();
  for(const r of chips){const val=r.bust??r.multiplier,label=val.toFixed(2)+'×',cs2=Math.max(11,12.5*hu);g.font=`700 ${cs2}px ${FONT}`;const w=g.measureText(label).width+cs2*1.2;roundBox(g,hx,12,w,cs2*1.9,cs2*.95,'rgba(10,6,16,.62)',r.outcome==='landed'?'#3ddc8488':'#ff465a55');text(g,label,hx+w/2,12+cs2*1.3,cs2,val<2?'#ff7882':'#8cffbe');hx+=w+6;}
  /* altitude gauge */
  const gx=22*Math.max(.8,hu),gt=H*.3,gb=H*.82;g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=3;g.beginPath();g.moveTo(gx,gt);g.lineTo(gx,gb);g.stroke();
  for(const [a,name] of STAGES){const y=gb-(a/5)*(gb-gt);g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=2;g.beginPath();g.moveTo(gx-5,y);g.lineTo(gx+5,y);g.stroke();if(wide)text(g,name,gx+12,y+4,10,'rgba(230,236,246,.6)','left',600);}
  const my=gb-clamp(alt/5,0,1)*(gb-gt);g.fillStyle=col;g.beginPath();g.arc(gx,my,7,0,Math.PI*2);g.fill();text(g,(alt*8.4).toFixed(1)+' km',gx-8,gb+22,12,'#fff','left',700);
  /* the crew: other Mosaics riding for show */
  if(wide&&v.crew.length){const cw=250,rowH=24,cx=W-cw-14,ch=30+Math.min(5,v.crew.length)*rowH;roundBox(g,cx,12,cw,ch,10,'rgba(10,6,16,.62)','rgba(255,255,255,.14)');text(g,'THE CREW · riding for show',cx+12,30,11,'rgba(230,236,246,.7)','left',700);
   v.crew.slice(0,5).forEach((c,i)=>{const y=52+i*rowH,name=(c.name.split(' ')[0]||'Mosaic').slice(0,10);if(!f){text(g,name,cx+12,y,12.5,'#e6ecf6','left',600);text(g,'waiting',cx+cw-12,y,12,'rgba(230,236,246,.5)','right',600);return;}
    const p=crewPlan(f,c.id,rate),done=rocketSec>=p.at;text(g,name,cx+12,y,12.5,'#e6ecf6','left',600);
    if(p.out&&done)text(g,'✓ '+p.target.toFixed(2)+'× · +'+money(p.stake*(p.target-1)),cx+cw-12,y,12,'#8cffbe','right',700);else if(blinked&&!p.out)text(g,'✗ blinked',cx+cw-12,y,12,'#ff7882','right',700);else text(g,'riding · '+money(p.stake),cx+cw-12,y,12,'rgba(230,236,246,.55)','right',600);});}
  text(g,live?'SPACE or TAP the sky to cash out':'SPACE to launch',W/2,H-14,Math.max(11,12*hu),'rgba(230,236,246,.55)','center',600);
 }
}
