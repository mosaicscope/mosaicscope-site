import {roundBox,sceneText} from './CanvasStage';
import {pose,solve,drawFigure} from '../render/StickFigure';
import type {Character} from '../entities/types';
export interface CabinState{first:boolean;tablet?:boolean;headphonePairs?:number;seat:'window'|'aisle';meal:number;snack:string;headphones:boolean;blanket:boolean;service:string}
export function drawCabin(g:CanvasRenderingContext2D,t:number,p:number,s:CabinState,people:readonly Character[],reduced:boolean,narrow=false):void{
 const box=(x:number,y:number,w:number,h:number,c:string,r=6)=>roundBox(g,x,y,w,h,r,c,'#303a3c');
 g.fillStyle=s.first?'#343735':'#454e51';g.fillRect(0,0,960,420);
 const light=g.createLinearGradient(0,0,0,420);light.addColorStop(0,'#eee5cf');light.addColorStop(1,'#888f8d');g.fillStyle=light;g.beginPath();g.moveTo(0,0);g.lineTo(960,0);g.lineTo(615,185);g.lineTo(350,185);g.closePath();g.fill();
 // Aisle vanishing point and overhead bins stay in one projection.
 g.fillStyle='#333a3c';g.beginPath();g.moveTo(350,420);g.lineTo(445,160);g.lineTo(515,160);g.lineTo(650,420);g.fill();
 for(let row=0;row<5;row++){const ww=95+row*34,yy=174+row*42;box(10,yy-110,300-row*41,24,'#c2c2b5',7);box(650+row*26,yy-110,300-row*25,24,'#c2c2b5',7);for(const side of[-1,1]){const xx=480+side*(70+row*46)-(side<0?ww:0);box(xx,yy,ww,s.first?58:74,s.first?'#7e6955':'#526b7a',12);box(xx+9,yy+8,ww-18,18,'#d2c8b0',5);if(!s.first){box(xx+ww*.34,yy+30,ww*.34,22,'#22323b',3);sceneText(g,'MS',xx+ww*.51,yy+45,9,'#b4c6c8');}box(xx-8,yy+45,ww+16,9,'#878b82',4);g.strokeStyle='#c9bda2';g.beginPath();g.moveTo(xx+12,yy+55);g.lineTo(xx+ww-12,yy+62);g.stroke();}}
 // Nearby window is large enough to read a bank, wing flex and moving terrain.
 const wx=s.seat==='window'?28:50,wy=72,ww=s.seat==='window'?310:205,wh=220;
 g.save();g.beginPath();g.roundRect(wx,wy,ww,wh,64);g.clip();const sky=g.createLinearGradient(0,wy,0,wy+wh);sky.addColorStop(0,'#3d789d');sky.addColorStop(.7,'#b7d3dc');sky.addColorStop(1,'#e3debe');g.fillStyle=sky;g.fillRect(wx,wy,ww,wh);
 const bank=reduced?0:Math.sin(t*.22)*.018;g.translate(wx+ww/2,wy+wh/2);g.rotate(bank);
 if(p<.18||p>.86){g.fillStyle='#6b8062';g.fillRect(-ww,60,ww*2,wh);for(let i=0;i<18;i++){g.fillStyle=i%3?'#849577':'#c0bca1';g.fillRect((i*67-t*(p<.18?45:24))%(ww*2)-ww,70+i%4*17,44,12);}g.fillStyle='#4b5253';g.fillRect(-ww,108,ww*2,14);g.fillStyle='#e3d9bd';for(let i=0;i<10;i++)g.fillRect(-ww+i*54-t*15%54,114,25,2);}
 for(let i=0;i<7;i++){const x=(i*91-(reduced?0:t*(12+i*2)))%(ww*2)-ww,y=-70+i%3*48;g.fillStyle='#f5f4e4b0';g.beginPath();g.ellipse(x,y,60,15,0,0,7);g.ellipse(x+30,y-8,34,16,0,0,7);g.fill();}
 const flex=reduced?0:Math.sin(t*1.4)*1.5;g.fillStyle='#c8cdd0';g.beginPath();g.moveTo(-130,100);g.lineTo(128,24+flex);g.lineTo(160,1+flex);g.lineTo(148,43+flex);g.lineTo(-10,111);g.closePath();g.fill();g.strokeStyle='#7e9099';g.lineWidth=2;g.stroke();g.beginPath();g.moveTo(-65,91);g.lineTo(122,37+flex);g.stroke();g.fillStyle='#7d8b92';g.fillRect(-120,105,120,17);g.restore();
 g.strokeStyle='#e6dfcf';g.lineWidth=10;g.beginPath();g.roundRect(wx,wy,ww,wh,64);g.stroke();g.strokeStyle='#7b8586';g.lineWidth=2;g.stroke();
 // Window reflections, overhead latches and seat stitching make the surfaces read at desktop scale.
 g.strokeStyle='#eee7d333';g.lineWidth=2;g.beginPath();g.moveTo(wx+ww*.15,wy+30);g.lineTo(wx+ww*.6,wy+wh-35);g.stroke();
 for(let row=0;row<5;row++){const yy=174+row*42,ww=95+row*34;for(const side of[-1,1]){const xx=480+side*(70+row*46)-(side<0?ww:0);g.strokeStyle='#dfd3b033';g.setLineDash([2,3]);g.strokeRect(xx+5,yy+5,ww-10,48);g.setLineDash([]);g.fillStyle='#334446';g.fillRect(xx+ww-20,yy+50,10,5);}box(290-row*41,yy-103,12,9,'#8e9894',2);box(666+row*26,yy-103,12,9,'#8e9894',2);}
 // Vent, reading lights, seat signs, call bell and textured cabin details.
 for(let i=0;i<3;i++){g.fillStyle='#677374';g.beginPath();g.ellipse(370+i*32,62,9,4,0,0,7);g.fill();}box(515,45,75,22,'#434e4d');sceneText(g,p<.18||p>.84?'BELTS ON':'CRUISE',552,60,10,'#e6c582');
 const crew=people.find(c=>c.role==='office')??people[1];if(crew){const x=478+(reduced?0:Math.sin(t*.25)*20),y=218,k=.48;solve(pose('give','normal',reduced?0:t,0,0,0),x,y,k,1);drawFigure(g,crew,x,y,k,1,t,0,1);box(x-25,y+7,58,37,'#8c9694');for(let i=0;i<3;i++)box(x-18+i*17,y+13,11,20,'#d8c49d',2);}
 g.save();if(narrow&&s.seat==='window')g.translate(-170,0);
 box(358,294,264,105,s.first?'#a18b6c':'#707d7b',10);box(368,304,244,84,'#d6cdb4',6);
 if(s.snack){box(386,323,72,43,'#b39169',3);sceneText(g,s.snack,422,349,10,'#2e3836');}if(s.meal){g.fillStyle='#eee6d4';g.beginPath();g.ellipse(500,345,48,26,0,0,7);g.fill();g.fillStyle=['#a17d4c','#9c754f','#9c6970'][Math.min(2,s.meal-1)];g.beginPath();g.ellipse(500,343,35,17,0,0,7);g.fill();if(s.meal===2){for(let i=0;i<5;i++)box(480+i*9,332,6,15,'#719660',2);}sceneText(g,['','Soup','Main course','Dessert'][s.meal],498,379,10,'#3b4238');}
 box(563,317,22,40,'#d9e0d8',3);g.fillStyle='#a8b7b5';g.fillRect(565,322,18,23);g.strokeStyle='#e0d8c1';g.lineWidth=3;g.beginPath();g.moveTo(378,310);g.lineTo(378,378);g.moveTo(598,310);g.lineTo(598,378);g.stroke();
 if(s.headphones){g.strokeStyle='#263239';g.lineWidth=6;g.beginPath();g.arc(677,340,20,Math.PI,0);g.stroke();box(653,334,10,22,'#303d43',3);box(692,334,10,22,'#303d43',3);}if(s.blanket){box(722,325,110,59,s.first?'#ad9f85':'#637b8b',9);box(787,310,63,31,'#ded8c9',9);}if((s.headphonePairs??0)>1){box(680,362,42,25,'#c8c4ae',3);sceneText(g,'SPARE',701,378,7,'#3d4b48');}
 if(s.meal){g.fillStyle='#6a8a58';for(let i=0;i<4;i++){g.beginPath();g.ellipse(493+i*5,335+i%2*3,4,2,i,0,7);g.fill();}g.strokeStyle='#eee4cf';g.lineWidth=2;g.beginPath();g.ellipse(500,345,44,23,0,0,7);g.stroke();}if(s.blanket){g.strokeStyle='#c5baa33b';g.lineWidth=1;for(let i=0;i<6;i++){g.beginPath();g.moveTo(730+i*14,330);g.lineTo(725+i*14,378);g.stroke();}}g.restore();
 if(s.first){box(754,262,142,15,'#a58d68');box(820,225,24,36,'#d9cfb7');g.fillStyle='#9fa77a';for(let i=0;i<4;i++){g.beginPath();g.ellipse(831+Math.cos(i*2)*12,215+i%2*8,13,6,i,0,7);g.fill();}sceneText(g,'PRIVATE SUITE',820,308,12,'#ebd5a3');}
 box(365,102,230,42,'#24343c');sceneText(g,`${p<.18?'TAKEOFF':p>.86?'APPROACH':'CRUISE'} · ${Math.round(Math.sin(Math.min(1,p)*Math.PI)*38000).toLocaleString()} FT`,480,119,10,'#cae0dc');sceneText(g,s.first?'FIRST · THREE-COURSE SERVICE':'ECONOMY · CABIN SERVICE',480,136,9,'#d9c9a3');
}
