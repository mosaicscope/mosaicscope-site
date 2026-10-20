import {canvasStage,sceneText,roundBox} from './CanvasStage';
import {pose,solve,drawFigure} from '../render/StickFigure';
import type {Simulation} from '../sim/Simulation';
export type StorySetting='dairy'|'medical'|'station'|'warehouse'|'party'|'home'|'street';
export function storySetting(text:string):StorySetting{const t=text.toLowerCase();return /hospital|ward|nurse/.test(t)?'medical':/police station|interrogation|holding cell/.test(t)?'station':/warehouse|loading|container/.test(t)?'warehouse':/club|party|dance|bar /.test(t)?'party':/dairy|milk crates|shop counter/.test(t)?'dairy':/kitchen|bedroom|living room|lounge|flat /.test(t)?'home':'street';}
export function saltStage(sim:Simulation,title:string,context:string,cast:string[],speaker:string,line:string){
 const setting=storySetting(title+' '+context),people=cast.map((name,i)=>sim.chars.find(c=>c.name.toLowerCase().includes(name.toLowerCase()))??sim.chars.filter(c=>c.tier==='principal')[i%11]??sim.player).slice(0,5);
 return canvasStage((g,t,reduced)=>{
  const night=/night|dark|midnight|evening/i.test(context),cold=/frost|cold|snow/i.test(context);g.fillStyle=night?'#252c31':cold?'#7a8581':'#8b8b78';g.fillRect(0,0,960,480);
  const interior=!['street','dairy'].includes(setting);g.fillStyle=interior?'#7b7767':'#5d665b';g.beginPath();g.moveTo(0,270);g.lineTo(960,255);g.lineTo(960,480);g.lineTo(0,480);g.fill();
  g.strokeStyle='#4e554c';g.lineWidth=1;for(let i=0;i<12;i++){g.beginPath();g.moveTo(i*100-70,270);g.lineTo(i*140-250,480);g.stroke();}for(let i=0;i<6;i++){g.beginPath();g.moveTo(0,280+i*i*6);g.lineTo(960,265+i*i*6);g.stroke();}
  const box=(x:number,y:number,w:number,h:number,c:string)=>roundBox(g,x,y,w,h,3,c,'#343a32');
  if(setting==='street'||setting==='dairy'){box(65,82,820,190,'#555d59');for(let i=0;i<5;i++){box(94+i*155,110,120,130,night?'#b4a47a':'#9ba6a0');box(102+i*155,117,104,111,'#4b6068');}box(490,130,100,143,'#313d39');if(setting==='dairy'){box(76,55,810,39,'#c4b88d');sceneText(g,'TUAM STREET DAIRY',480,83,21,'#363d32');for(let i=0;i<4;i++){box(84+i*34,263,28,24,'#828b66');g.strokeStyle='#434f3d';g.strokeRect(87+i*34,266,22,18);}}else{g.fillStyle='#393d3b';g.fillRect(0,422,960,58);g.fillStyle='#c6b47a';g.fillRect(0,454,960,3);}}
  if(setting==='medical'){box(80,90,200,110,'#8b9d9d');for(let i=0;i<2;i++){box(85+i*610,283,200,35,'#c6c5b1');box(85+i*610,262,70,25,'#e0d9c5');for(const x of[100+i*610,260+i*610])box(x,318,6,31,'#4b5c58');}g.fillStyle='#aa4d45';g.fillRect(455,91,48,14);g.fillRect(472,74,14,48);}
  if(setting==='station'){box(75,100,210,146,'#494f47');for(let i=0;i<7;i++)box(92+i*28,102,5,140,'#b3b4a3');box(625,265,240,60,'#73634d');box(670,165,150,70,'#3a4744');sceneText(g,'SALT DISTRICT',745,196,14,'#d8cda9');}
  if(setting==='warehouse'){for(let i=0;i<8;i++)box(60+i%4*210,238-Math.floor(i/4)*76,110,74,i%2?'#85765b':'#6c725d');g.strokeStyle='#b19c72';for(let i=0;i<4;i++)g.strokeRect(77+i*210,95,80,217);}
  if(setting==='home'){box(80,98,210,120,'#4c6064');box(130,263,230,57,'#7c8170');box(115,246,260,25,'#929680');box(650,267,180,21,'#8d7657');box(667,288,9,45,'#635a48');box(805,288,9,45,'#635a48');box(744,130,12,112,'#77725f');box(713,105,74,45,'#cfbf91');}
  if(setting==='party'){box(50,240,340,50,'#474c44');for(let i=0;i<8;i++)box(75+i*36,213,12,27,['#b1a073','#6f8877','#8d7180'][i%3]);box(720,180,115,150,'#303b37');g.fillStyle='#807b68';g.beginPath();g.arc(777,270,33,0,7);g.fill();if(!reduced){g.fillStyle='#c8ab6b15';g.beginPath();g.moveTo(480,40);g.lineTo(170+Math.sin(t)*60,400);g.lineTo(770+Math.sin(t)*60,400);g.fill();}}
  people.forEach((c,i)=>{const x=300+i*110,y=368+(i%2)*15,k=.82,active=cast[i]?.toLowerCase()===speaker.toLowerCase(),talk=active&&speaker!=='Scene';g.fillStyle='#151c1833';g.beginPath();g.ellipse(x,y,24,7,0,0,7);g.fill();solve(pose(talk?'talk':'idle','normal',reduced?0:t+i,0,0,0),x,y,k,i%2? -1:1);drawFigure(g,c,x,y,k,i%2?-1:1,reduced?0:t,0,1);if(active){g.strokeStyle='#d7c18a';g.lineWidth=2;g.beginPath();g.ellipse(x,y,26,8,0,0,7);g.stroke();}sceneText(g,cast[i],x,y+23,13,'#e5dcc2');});
  roundBox(g,24,18,912,44,6,'#252b25e8','#a99b7355');sceneText(g,title.replace(/^Scene\s*\d+[:.\s-]*/i,''),44,46,20,'#e5d2a6','left');
  if(/rain|storm/i.test(context)&&!reduced){g.strokeStyle='#b4c3c455';g.lineWidth=1;for(let i=0;i<65;i++){const x=i*163%960,y=(i*73+t*190)%480;g.beginPath();g.moveTo(x,y);g.lineTo(x-4,y+12);g.stroke();}}
  if(speaker==='Scene')sceneText(g,line.length>115?line.slice(0,112)+'…':line,480,452,13,'#e9dfc7');
 },{label:'Illustrated '+title.replace(/^Scene\s*\d+[:.\s-]*/i,'')});
}
