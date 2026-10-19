import type {Poi,World} from '../world/World';
import type {CivicDamage} from '../sim/CivicDamage';
type G=CanvasRenderingContext2D;
export function drawFixture(g:G,p:Poi,sx:number,sy:number,z:number):boolean{
 if(!['busstop','roadsign','streetsign'].includes(p.kind))return false;
 const P=(u:number,v:number,h=0)=>{const x=p.dir?v:u,y=p.dir?u:v;return[sx+(x-y)*32*z,sy+(x+y)*16*z-h*26*z];};
 const path=(a:number[][],col:string,fill=false,lw=1)=>{g.beginPath();a.forEach((a,i)=>{const q=P(a[0],a[1],a[2]);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);});if(fill){g.closePath();g.fillStyle=col;g.fill();}else{g.strokeStyle=col;g.lineWidth=lw*z;g.stroke();}};
 if(p.kind==='busstop'){
  path([[-.62,.24,0],[-.62,.24,1.85]],'#747d79',false,1.8);path([[.62,.24,0],[.62,.24,1.85]],'#747d79',false,1.8);
  path([[-.68,.28,.12],[.68,.28,.12],[.68,.28,1.76],[-.68,.28,1.76]],'#99bdc43d',true);path([[-.68,-.25,1.84],[.68,-.25,1.84],[.68,.36,1.84],[-.68,.36,1.84]],'#414c49',true);
  path([[-.55,.15,.45],[.55,.15,.45],[.55,-.1,.45],[-.55,-.1,.45]],'#9e8d72',true);path([[-.43,.1,.45],[-.43,.1,0]],'#4a5049',false,2);path([[.43,.1,.45],[.43,.1,0]],'#4a5049',false,2);
  const a=P(.8,0,1.7);g.fillStyle='#d6ba78';g.fillRect(a[0]-7*z,a[1]-10*z,14*z,16*z);g.fillStyle='#292f29';g.font=`600 ${Math.max(7,8*z)}px system-ui`;g.textAlign='center';g.fillText('BUS',a[0],a[1]+z);g.textAlign='start';
 }else{
  path([[0,0,0],[0,0,1.9]],'#818a80',false,2);const a=P(0,0,1.72);
  if(p.kind==='roadsign'){g.fillStyle='#e9e3d5';g.strokeStyle='#a95043';g.lineWidth=2*z;g.beginPath();g.arc(a[0],a[1],10*z,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#323830';g.font=`700 ${Math.max(7,8*z)}px system-ui`;g.textAlign='center';g.fillText(p.name==='50'?'50':'↙',a[0],a[1]+3*z);}
  else if(z>1.1){const label=(p.name??'Street').slice(0,30);g.font=`600 ${Math.max(8,8*z)}px system-ui`;const w=Math.min(120*z,g.measureText(label).width+10*z);g.fillStyle='#3f5348';g.fillRect(a[0]-w/2,a[1]-7*z,w,14*z);g.strokeStyle='#c7cdbb';g.lineWidth=.7*z;g.strokeRect(a[0]-w/2,a[1]-7*z,w,14*z);g.fillStyle='#e4e8d9';g.textAlign='center';g.fillText(label,a[0],a[1]+3*z,w-5*z);}
  g.textAlign='start';
 }return true;
}
export function drawDebris(g:G,d:CivicDamage|undefined,sx:number,sy:number,z:number):boolean{
 if(!d)return false;
 if(d.severity<.25)return false;
 const glass=d.fixture==='busstop',wood=d.fixture==='bench'||d.fixture==='billboard';
 g.save();g.strokeStyle=wood?'#917755':'#717b73';g.lineWidth=2*z;g.beginPath();g.moveTo(sx-17*z,sy+2*z);g.lineTo(sx+16*z,sy+7*z);g.stroke();
 for(let i=0;i<3+Math.ceil(d.severity*7);i++){g.fillStyle=wood?'#9e815b':i%2?'#acc4c18a':'#887359';g.beginPath();g.moveTo(sx+(i-2)*6*z,sy+(i%2)*4*z);g.lineTo(sx+(i-2)*6*z+5*z,sy-3*z);g.lineTo(sx+(i-2)*6*z+3*z,sy+7*z);g.fill();}
 if(glass){g.strokeStyle='#b8d8dd99';g.lineWidth=z;g.beginPath();g.moveTo(sx-13*z,sy+z);g.lineTo(sx+6*z,sy-5*z);g.lineTo(sx+11*z,sy+5*z);g.stroke();}
 if(d.phase!=='reported')cones(g,sx,sy,z);
 if(d.phase==='working'){g.fillStyle='#a48861';g.fillRect(sx-9*z,sy-5*z,18*z,7*z);g.strokeStyle='#453e31';g.strokeRect(sx-9*z,sy-5*z,18*z,7*z);for(let i=0;i<3;i++){g.strokeStyle='#b8b9ab';g.beginPath();g.moveTo(sx+(i*5-5)*z,sy-4*z);g.lineTo(sx+(i*5-7)*z,sy-12*z);g.stroke();}}
 g.restore();return true;
}
function cones(g:G,x:number,y:number,z:number){for(const side of[-1,1]){g.fillStyle='#d5a050';g.beginPath();g.moveTo(x+side*24*z-5*z,y+8*z);g.lineTo(x+side*24*z,y-9*z);g.lineTo(x+side*24*z+5*z,y+8*z);g.fill();g.strokeStyle='#e5d8bb';g.lineWidth=2*z;g.beginPath();g.moveTo(x+side*24*z-3*z,y+2*z);g.lineTo(x+side*24*z+3*z,y+2*z);g.stroke();}}
export function drawFacadeDamage(g:G,w:World,id:number,tx:number,ty:number,sx:number,sy:number,z:number):void{
 const d=w.civicDamage[`b:${id}:${tx}:${ty}`];if(!d||d.face==='n'||d.face==='w')return;
 const P=(u:number,h:number)=>d.face==='s'?[sx+(u-1)*32*z,sy+(u+1)*16*z-h*26*z]:[sx+(1-u)*32*z,sy+(1+u)*16*z-h*26*z];
 const scale=.35+d.severity*.65,variant=(tx*7+ty*11+id)%3;
 const pts=[[.25,.25],[.22,.85],[.48,1],[.77,.78],[.73,.28]].map(([u,h])=>P(.5+(u-.5)*scale,.55+(h-.55)*scale));g.save();g.fillStyle=d.phase==='working'?'#9c7d54':d.severity<.45?'#847a68aa':variant===1?'#4a5760bb':'#302d2bcc';g.strokeStyle='#afa38d';g.lineWidth=z;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();g.stroke();
 if(d.phase==='working'){for(const h of[.4,.6,.8]){const a=P(.24,h),b=P(.75,h);g.strokeStyle='#65593d';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}cones(g,sx,sy+25*z,z);}
 else{if(d.severity>.6&&variant===2){for(let i=0;i<5;i++){const a=P(.3+i*.09,.3+(i%2)*.18);g.fillStyle=i%2?'#9b8164':'#b39677';g.fillRect(a[0]-3*z,a[1]-2*z,6*z,3*z);}}const c=P(.5,.65);g.strokeStyle='#c0b9a6';for(const [u,h]of [[.15,.98],[.85,.9],[.8,.14],[.1,.2]]){const a=P(u,h);g.beginPath();g.moveTo(c[0],c[1]);g.lineTo(a[0],a[1]);g.stroke();}}
 g.restore();
}
