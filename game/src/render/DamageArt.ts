import type {Character,Wound,Vehicle} from "../entities/types";
import {bodyDamageModel,faceDamageModel,CAR_DAMAGE_MODELS,carZoneDamage} from "../content/damageModels";
let bloodEnabled=false;
export function setDamageBlood(on:boolean):void{bloodEnabled=on;}
export function damageBloodEnabled():boolean{return bloodEnabled;}
/** Injury detail shares the figure's scale and respects the blood-effects setting. */
function mark(g:CanvasRenderingContext2D,w:Wound,x:number,y:number,k:number,pattern:number,seed:number):void{
 g.save();g.translate(x,y);g.rotate(((seed%7)-3)*.12);g.lineCap='round';
 const size=(w.part==='head'?3+w.severity*.8:1.8+w.severity*.7)*k;
 if(w.bandaged){g.fillStyle='#e9dfc8';g.strokeStyle='#a79f8d';g.lineWidth=.7*k;g.fillRect(-size*1.5,-size*.7,size*3,size*1.4);g.strokeRect(-size*1.5,-size*.7,size*3,size*1.4);g.strokeStyle='#a6a191';for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*size,-size*.5);g.lineTo(i*size,size*.5);g.stroke();}g.restore();return;}
 if(pattern===0||pattern===4||pattern===3&&w.part==='head'){g.fillStyle=pattern===4?'#c88f85':'#73516e';g.globalAlpha=.6;g.beginPath();g.ellipse(0,0,size*1.45,size*.8,0,0,Math.PI*2);g.fill();g.globalAlpha=.35;g.fillStyle='#c37083';g.beginPath();g.ellipse(size*.3,-size*.2,size,size*.6,0,0,Math.PI*2);g.fill();}
 else if(pattern===3){g.fillStyle='#3e3636';g.beginPath();g.moveTo(-size*1.5,-size);g.lineTo(size*.2,-size*.3);g.lineTo(size*1.4,-size*.8);g.lineTo(size*.5,size);g.lineTo(-size*.7,size*.4);g.fill();g.strokeStyle='#d2c5a8';g.lineWidth=.8*k;for(let i=0;i<3;i++){g.beginPath();g.moveTo((i-1)*size*.6,-size*.6);g.lineTo((i-1)*size*.6-size*.4,-size*1.2);g.stroke();}}
 else {g.strokeStyle=bloodEnabled?'#a62e3a':'#937a76';g.lineWidth=Math.max(.8,1.1*k);for(let i=0;i<(pattern===1?4:1);i++){g.beginPath();g.moveTo(-size,(i-1)*k);g.lineTo(size*.2,(i-.4)*k);g.lineTo(size,(i-1.5)*k);g.stroke();}}
 if(bloodEnabled&&w.kind!=='bruise'&&w.severity>=2){g.strokeStyle='#a82432';g.lineWidth=1.2*k;g.beginPath();g.moveTo(size*.3,0);g.quadraticCurveTo(size*.8,size,size*.4,size*(w.severity===3?2.7:1.6));g.stroke();g.fillStyle='#b83340';g.beginPath();g.ellipse(size*.4,size*1.7,k,1.6*k,0,0,Math.PI*2);g.fill();}
 if(bloodEnabled&&w.severity>=2&&w.kind!=='bruise'&&w.kind!=='fracture'){
  // Layered wound edge, pooled centre and small directional droplets, never a flat red sticker.
  g.strokeStyle='#63232c';g.lineWidth=1.8*k;g.beginPath();g.moveTo(-size*.8,0);g.quadraticCurveTo(0,size*.6,size*.9,-size*.35);g.stroke();
  g.strokeStyle='#da767a';g.lineWidth=.55*k;g.beginPath();g.moveTo(-size*.7,-k);g.quadraticCurveTo(0,size*.35,size*.75,-size*.35-k);g.stroke();
  for(let i=0;i<3;i++){g.fillStyle=i%2?'#822532':'#b9434e';g.beginPath();g.ellipse(size*(i*.7-1),size*(1+i*.45),(.55+i*.12)*k,(.7+i*.2)*k,.3,0,7);g.fill();}
 }
 g.restore();
}
export function detachedOn(c:Character,part:'arm'|'leg',side:number):boolean{return (c.wounds??[]).some(w=>w.part===part&&w.detached?.side===side);}
function bone(g:CanvasRenderingContext2D,x:number,y:number,k:number,wrapped=false):void{
 g.save();g.translate(x,y);g.rotate(-.35);g.lineCap='round';
 if(wrapped){g.fillStyle='#e7dfc9';g.strokeStyle='#8e8a7a';g.lineWidth=.7*k;g.beginPath();g.roundRect(-4*k,-2*k,8*k,6*k,2*k);g.fill();g.stroke();for(const xx of[-2,0,2]){g.beginPath();g.moveTo(xx*k,-k);g.lineTo(xx*k,3*k);g.stroke();}g.restore();return;}
 g.strokeStyle=wrapped?'#c8c2ad':'#573738';g.lineWidth=7*k;g.beginPath();g.moveTo(-2*k,3*k);g.lineTo(3*k,-3*k);g.stroke();
 if(!wrapped&&bloodEnabled){g.strokeStyle='#a9434d';g.lineWidth=4*k;g.beginPath();g.moveTo(-3*k,4*k);g.lineTo(k,0);g.stroke();g.fillStyle='#b75c63';g.beginPath();g.ellipse(0,2*k,4*k,2*k,-.4,0,7);g.fill();}
 g.fillStyle=wrapped?'#e7dfc9':'#ddd4b5';g.strokeStyle='#776f5d';g.lineWidth=.65*k;
 g.beginPath();g.moveTo(-k,0);g.lineTo(2*k,-8*k);g.lineTo(3*k,-6*k);g.lineTo(5*k,-9*k);g.lineTo(6*k,-5*k);g.lineTo(2*k,2*k);g.closePath();g.fill();g.stroke();
 g.strokeStyle='#f5edcf';g.lineWidth=.7*k;g.beginPath();g.moveTo(k,0);g.lineTo(3*k,-5*k);g.stroke();g.restore();
}
/** Detached forearm/shin: the same pale limbs, cuff and shoe as the parent character. */
export function drawDetachedLimb(g:CanvasRenderingContext2D,c:Character,w:Wound,x:number,y:number,k:number):void{
 const l=w.detached;if(!l)return;g.save();g.translate(x,y);g.rotate(l.angle);g.lineCap='round';
 g.strokeStyle='#191615';g.lineWidth=4*k;g.beginPath();g.moveTo(0,0);g.lineTo(17*k,2*k);g.stroke();g.strokeStyle='#eee4d3';g.lineWidth=2.3*k;g.stroke();
 if(w.part==='leg'){g.fillStyle='#171717';g.strokeStyle=c.look.accent;g.lineWidth=k;g.beginPath();g.ellipse(19*k,2*k,5*k,2.5*k,.2,0,7);g.fill();g.stroke();}
 else{g.fillStyle='#eee4d3';g.beginPath();g.arc(18*k,2*k,2.7*k,0,7);g.fill();g.strokeStyle='#eee4d3';g.lineWidth=1.1*k;for(let i=0;i<4;i++){g.beginPath();g.moveTo(18*k,2*k);g.lineTo((22+i%2)*k,(i-1)*2*k);g.stroke();}}
 bone(g,0,0,k,!bloodEnabled||w.bandaged);g.restore();
}
export function drawFaceDamage(g:CanvasRenderingContext2D,c:Character,x:number,y:number,rx:number,ry:number,k:number):void{
 for(const w of c.wounds??[]){if(w.part!=='head')continue;
  for(const art of w.bandaged?[w.art]:w.marks?.length?w.marks:[w.art]){const m=faceDamageModel({...w,art}),p=[[-.45,-.08],[.45,-.08],[.5,.46],[0,.25],[-.25,-.52]][m.zone];mark(g,w,x+p[0]*rx,y+p[1]*ry,k,m.pattern,w.tick);
   if(!w.bandaged&&(m.zone===0||m.zone===1)){g.save();g.strokeStyle='#413039';g.lineWidth=(1+w.severity*.35)*k;g.lineCap='round';g.beginPath();g.moveTo(x+p[0]*rx-3*k,y+p[1]*ry);g.quadraticCurveTo(x+p[0]*rx,y+p[1]*ry+2*k,x+p[0]*rx+3*k,y+p[1]*ry);g.stroke();g.restore();}
  }
 }
}
export function drawBodyDamage(g:CanvasRenderingContext2D,c:Character,J:Float32Array,k:number):void{
 const lerp=(a:number,b:number,t:number)=>[J[a]+(J[b]-J[a])*t,J[a+1]+(J[b+1]-J[a+1])*t];
 for(const w of c.wounds??[]){if(w.part==='head')continue;const m=bodyDamageModel(w),p=[lerp(0,6,.75),lerp(0,6,.25),lerp(0,6,.5),lerp(6,8,.65),lerp(6,12,.65),lerp(8,10,.6),lerp(12,14,.6),[J[20],J[21]],lerp(20,22,.6)][m.zone];
  if(w.detached){const joint=w.part==='arm'?(w.detached.side<0?8:12):(w.detached.side<0?16:20);bone(g,J[joint],J[joint+1],k,w.bandaged||!bloodEnabled);continue;}
  if(w.bandaged&&(w.part==='leg'||w.part==='arm')){
   const a=w.part==='leg'?((w.art??0)%2?16:20):((w.art??0)%2?8:12),b=a+2,x=(J[a]+J[b])*.5,y=(J[a+1]+J[b+1])*.5;
   g.save();g.translate(x,y);g.rotate(Math.atan2(J[b+1]-J[a+1],J[b]-J[a])-Math.PI/2);g.fillStyle='#ded6bf';g.strokeStyle='#8c8878';g.lineWidth=.45*k;g.beginPath();g.roundRect(-1.8*k,-3*k,3.6*k,6*k,.7*k);g.fill();g.stroke();for(const yy of[-1.5,0,1.5]){g.beginPath();g.moveTo(-1.7*k,yy*k);g.lineTo(1.7*k,(yy+.4)*k);g.stroke();}g.restore();continue;
  }
  mark(g,w,p[0],p[1],k,m.pattern,w.tick);
  if(w.compound&&!w.bandaged&&bloodEnabled)bone(g,p[0],p[1],k);
  if(w.part==='torso'&&w.kind==='stab'&&w.severity===3&&!w.bandaged&&bloodEnabled){g.save();g.translate(p[0],p[1]);g.fillStyle='#532b32';g.beginPath();g.ellipse(0,0,4*k,6*k,.2,0,7);g.fill();g.strokeStyle='#bf747a';g.lineWidth=1.4*k;g.lineCap='round';for(let i=0;i<3;i++){g.beginPath();g.moveTo(-2*k,(i*3-3)*k);g.bezierCurveTo(5*k,(i*3-6)*k,-5*k,(i*3+2)*k,3*k,(i*3)*k);g.stroke();}g.restore();}
 }
}
type Point=number[];
export function drawCarDamage(g:CanvasRenderingContext2D,v:Vehicle,L:number,hw:number,H:number,z:number,project:(x:number,y:number,h:number)=>Point,visible:(zone:number)=>boolean=()=>true):void{
 if(v.damage<.05&&!v.dmgF&&!v.dmgR&&!v.dmgL&&!v.dmgS)return;
 const positions=[[.32,0,.49],[-.35,0,.44],[0,-1.01,.36],[0,1.01,.36],[0,0,1.01],[.22,0,.75],[-.22,0,.77],[.49,0,.17],[-.49,0,.16],[-.2,1.01,.18]];
 g.save();g.lineCap='round';
 for(const m of CAR_DAMAGE_MODELS){if(!visible(m.zone)||carZoneDamage(v,m.zone)<m.threshold)continue;
 const p=positions[m.zone],offset=(m.pattern-2.5)*.045,side=m.zone===2||m.zone===3||m.zone===9;
 const A=project((p[0]+offset)*L,p[1]*hw,p[2]*H),B=project((p[0]+offset+.08)*L,(p[1]+(side?0:.12))*hw,(p[2]+(side?.05:0))*H),s=Math.max(1,z);
 g.strokeStyle=['#c6b9a1','#453f3b','#272c2c','#d0c5b0','#171c1c','#302b29'][m.pattern];g.lineWidth=s*(m.pattern===5?3:1.1);g.beginPath();g.moveTo(A[0],A[1]);
 if(m.pattern===1||m.pattern===4)g.quadraticCurveTo((A[0]+B[0])/2+3*s,(A[1]+B[1])/2+2*s,B[0],B[1]);else{g.lineTo((A[0]+B[0])/2,(A[1]+B[1])/2-2*s);g.lineTo(B[0],B[1]);}g.stroke();
 if(m.pattern===2){g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(A[0]-3*s,A[1]+3*s);g.stroke();}
 }g.restore();
}
