import type {Character,Wound,Vehicle} from "../entities/types";
import {bodyDamageModel,faceDamageModel,CAR_DAMAGE_MODELS,carZoneDamage} from "../content/damageModels";
let bloodEnabled=false;
export function setDamageBlood(on:boolean):void{bloodEnabled=on;}
/** Bounded flat cartoon decals: no organs, missing limbs or exposed anatomy. */
function mark(g:CanvasRenderingContext2D,w:Wound,x:number,y:number,k:number,pattern:number,seed:number):void{
 g.save();g.translate(x,y);g.rotate(((seed%7)-3)*.12);g.lineCap='round';
 const size=(1.8+w.severity*.7)*k;
 if(w.bandaged){g.fillStyle='#e9dfc8';g.strokeStyle='#a79f8d';g.lineWidth=.7*k;g.fillRect(-size*1.5,-size*.7,size*3,size*1.4);g.strokeRect(-size*1.5,-size*.7,size*3,size*1.4);g.strokeStyle='#a6a191';for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*size,-size*.5);g.lineTo(i*size,size*.5);g.stroke();}g.restore();return;}
 if(pattern===0||pattern===4||pattern===3&&w.part==='head'){g.fillStyle=pattern===4?'#c88f85':'#73516e';g.globalAlpha=.6;g.beginPath();g.ellipse(0,0,size*1.45,size*.8,0,0,Math.PI*2);g.fill();g.globalAlpha=.35;g.fillStyle='#c37083';g.beginPath();g.ellipse(size*.3,-size*.2,size,size*.6,0,0,Math.PI*2);g.fill();}
 else if(pattern===3){g.fillStyle='#3e3636';g.beginPath();g.moveTo(-size*1.5,-size);g.lineTo(size*.2,-size*.3);g.lineTo(size*1.4,-size*.8);g.lineTo(size*.5,size);g.lineTo(-size*.7,size*.4);g.fill();g.strokeStyle='#d2c5a8';g.lineWidth=.8*k;for(let i=0;i<3;i++){g.beginPath();g.moveTo((i-1)*size*.6,-size*.6);g.lineTo((i-1)*size*.6-size*.4,-size*1.2);g.stroke();}}
 else {g.strokeStyle=bloodEnabled?'#a62e3a':'#937a76';g.lineWidth=Math.max(.8,1.1*k);for(let i=0;i<(pattern===1?4:1);i++){g.beginPath();g.moveTo(-size,(i-1)*k);g.lineTo(size*.2,(i-.4)*k);g.lineTo(size,(i-1.5)*k);g.stroke();}}
 if(bloodEnabled&&w.kind!=='bruise'&&w.severity>=2){g.strokeStyle='#a82432';g.lineWidth=1.2*k;g.beginPath();g.moveTo(size*.3,0);g.quadraticCurveTo(size*.8,size,size*.4,size*(w.severity===3?2.7:1.6));g.stroke();g.fillStyle='#b83340';g.beginPath();g.ellipse(size*.4,size*1.7,k,1.6*k,0,0,Math.PI*2);g.fill();}
 g.restore();
}
export function drawFaceDamage(g:CanvasRenderingContext2D,c:Character,x:number,y:number,rx:number,ry:number,k:number):void{
 for(const w of c.wounds){if(w.part!=='head')continue;const m=faceDamageModel(w),p=[[-.45,-.08],[.45,-.08],[.5,.46],[0,.25],[-.25,-.52]][m.zone];mark(g,w,x+p[0]*rx,y+p[1]*ry,k,m.pattern,w.tick);}
}
export function drawBodyDamage(g:CanvasRenderingContext2D,c:Character,J:Float32Array,k:number):void{
 const lerp=(a:number,b:number,t:number)=>[J[a]+(J[b]-J[a])*t,J[a+1]+(J[b+1]-J[a+1])*t];
 for(const w of c.wounds){if(w.part==='head')continue;const m=bodyDamageModel(w),p=[lerp(0,6,.75),lerp(0,6,.25),lerp(0,6,.5),lerp(6,8,.65),lerp(6,12,.65),lerp(8,10,.6),lerp(12,14,.6),[J[20],J[21]],lerp(20,22,.6)][m.zone];mark(g,w,p[0],p[1],k,m.pattern,w.tick);}
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
