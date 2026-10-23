import type {Aircraft} from '../content/aircraft';
import {roundBox} from './CanvasStage';
const TAU=Math.PI*2;
/** Hand-drawn side profiles share the catalogue's airframe, engine, seating and livery data. */
export function drawCrashAircraft(g:CanvasRenderingContext2D,a:Aircraft,x:number,y:number,width:number,t:number,flight:boolean,gear:number,damage:number):void{
 const L=320,H=a.type==='jet'?a.seats>90?40:31:23,colour=a.color,wing=Math.min(82,Math.max(30,a.span/a.length*65));g.save();g.translate(x,y);g.rotate(flight?-.035:0);g.scale(width/L,width/L);
 const poly=(points:number[][],fill:string)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle='#303d42';g.lineWidth=1.1;g.stroke();};
 poly([[-45,4],[a.type==='jet'?4:-22,-wing],[a.type==='jet'?36:14,-wing],[14,6]],'#929e9c');
 poly([[-146,-3],[-133,-70-a.tail*3],[-110,-70-a.tail*3],[-86,2]],colour);poly([[-139,-5],[-134,-57-a.tail*3],[-124,-57-a.tail*3],[-115,-5]],'#527477');
 const body=g.createLinearGradient(0,-H/2,0,H*.75);body.addColorStop(0,'#f0edda');body.addColorStop(.4,colour);body.addColorStop(1,'#869995');g.beginPath();g.moveTo(-151,0);g.bezierCurveTo(-130,-H*.55,-75,-H*.55,80,-H*.55);g.bezierCurveTo(112,-H*.55,151,-H*.3,160,0);g.bezierCurveTo(167,H*.35,115,H*.58,72,H*.58);g.lineTo(-120,H*.4);g.closePath();g.fillStyle=body;g.fill();g.strokeStyle='#34464c';g.lineWidth=1.6;g.stroke();
 g.beginPath();g.moveTo(-127,H*.2);g.bezierCurveTo(-45,H*.25,98,H*.32,142,H*.12);g.strokeStyle='#a77e55';g.lineWidth=3;g.stroke();
 poly([[97,-H*.48],[118,-H*.4],[134,-H*.2],[97,-H*.2]],'#2e525d');g.strokeStyle='#b8d2c9';g.lineWidth=.8;g.beginPath();g.moveTo(114,-H*.43);g.lineTo(116,-H*.2);g.stroke();
 const windows=Math.min(24,Math.max(1,Math.ceil(a.seats/6)));for(let i=0;i<windows;i++){const xx=windows===1?65:-85+i*165/windows;roundBox(g,xx,-H*.35,4.6,6,1.8,'#3b5964','#c1d3c6');g.fillStyle='#b9cfc4';g.fillRect(xx+1,-H*.35+1,2,.8);}for(const xx of[-106,84]){g.strokeStyle='#8c9b92';g.lineWidth=.7;g.strokeRect(xx,-H*.4,9,H*.68);g.fillStyle='#637b75';g.fillRect(xx+2,H*.1,3,1);}
 g.font='600 8px Arial';g.fillStyle='#3a5e65';g.textAlign='center';g.fillText(a.type==='seaplane'?'TESSERA COASTAL':'TESSERA AIR',-6,H*.13);g.fillStyle='#d4b97d';g.beginPath();g.moveTo(-126,-45);g.lineTo(-119,-38);g.lineTo(-126,-31);g.lineTo(-133,-38);g.closePath();g.fill();
 poly([[-50,H*.25],[43,H*.23],[-14,wing+15],[-45,wing+15],[-13,35]],'#aab7b2');poly([[-134,5],[-83,5],[-110,31],[-144,28]],'#7e9291');
 const engines=a.type==='jet'?Math.min(a.engines,4):a.engines;for(let i=0;i<engines;i++){const single=a.type!=='jet'&&engines===1,ex=single?132:-10+i*25,ey=single?0:H*.8+12+(i%2)*7;roundBox(g,ex-20,ey-8,45,17,7,'#9daea9','#485e62');g.fillStyle='#3d555e';g.beginPath();g.ellipse(ex+24,ey,3.5,8,0,0,TAU);g.fill();g.strokeStyle='#d0d5bb';g.lineWidth=.8;g.beginPath();g.ellipse(ex+24,ey,3,6.5,0,0,TAU);g.stroke();if(a.type!=='jet'){g.save();g.translate(ex+28,ey);g.scale(1,flight?.25+Math.abs(Math.sin(t*48)):.85);g.fillStyle='#415257';g.fillRect(-1.2,-28,2.4,56);g.restore();}}
 if(a.type==='seaplane')for(const dx of[-48,44]){g.strokeStyle='#596b6b';g.lineWidth=2;g.beginPath();g.moveTo(dx,H*.4);g.lineTo(dx-3,44);g.stroke();roundBox(g,dx-30,43,76,10,5,'#b0bdb6','#4b6467');}
 if(gear>.05)for(const xx of[-80,104]){g.strokeStyle='#65797a';g.lineWidth=3;g.beginPath();g.moveTo(xx,H*.3);g.lineTo(xx,H*.3+gear*26);g.stroke();g.fillStyle='#2b3d42';g.beginPath();g.arc(xx,H*.3+gear*28,4.5,0,TAU);g.fill();g.fillStyle='#a9b6aa';g.beginPath();g.arc(xx,H*.3+gear*28,1.6,0,TAU);g.fill();}
 if(flight){g.fillStyle=Math.sin(t*4)>0?'#dfaa75':'#9a6855';g.beginPath();g.arc(4,-H*.5-2,2,0,TAU);g.fill();}
 if(damage>0){g.strokeStyle='#684c3f';g.lineWidth=1.4;g.beginPath();g.moveTo(12,-H*.3);g.lineTo(4,H*.05);g.lineTo(19,H*.3);g.stroke();}g.restore();
}
