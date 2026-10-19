import type {Simulation} from '../sim/Simulation';
import type {Encounter} from '../content/encounters';
import type {Character} from '../entities/types';
import {pose,solve,drawFigure,J} from '../render/StickFigure';
import {canvasStage,roundBox,sceneText} from './CanvasStage';
/** An authored riverside wedding: the same people and inked figures as the city. */
export function weddingScene(sim:Simulation,event:Encounter,completed:boolean){
 const choice=completed?sim.expansion.outcomes?.wedding:undefined,result=choice===undefined?undefined:event.choices[choice];
 const locals=sim.chars.filter(c=>c.id!==sim.playerId&&c.tier!=='principal').sort((a,b)=>a.id-b.id);
 const couple=locals.find(c=>c.partner>=0&&c.partner!==sim.playerId),a=couple??locals[0]??sim.player,b=couple?sim.chars[couple.partner]:locals[1]??sim.player;
 const guests=locals.filter(c=>c.id!==a.id&&c.id!==b.id).slice(0,5),volunteer=guests[0]??sim.player;
 const people=(g:CanvasRenderingContext2D,c:Character,x:number,y:number,t:number,action:string,formal:'light'|'dark'|undefined=undefined)=>{
  const k=.85,dir=x>550?-1:1;g.save();g.fillStyle='#13151540';g.beginPath();g.ellipse(x,y,16,5,0,0,Math.PI*2);g.fill();
  solve(pose(action,c.style,t+c.id,t*3.5,action==='walk'?1:0,0),x,y,k,dir);drawFigure(g,c,x,y,k,dir,t,0,1);
  if(formal){const hx=J[0],hy=J[1],sx=J[6],sy=J[7];g.fillStyle=formal==='light'?'#e2d8c6':'#383b3c';g.strokeStyle='#33312d';g.lineWidth=1.2;g.beginPath();g.moveTo(sx-5,sy+2);g.lineTo(sx+5,sy+2);g.lineTo(hx+(formal==='light'?15:7),hy+12);g.lineTo(hx-(formal==='light'?15:7),hy+12);g.closePath();g.fill();g.stroke();g.fillStyle='#c6b89a';g.fillRect(sx-1.5,sy+3,3,7);}
  if(action==='photo'){const x=(J[10]+J[14])/2,y=(J[11]+J[15])/2;roundBox(g,x-9,y-6,18,12,3,'#303436','#a4a49a');g.fillStyle='#98b2af';g.beginPath();g.arc(x+1,y,4,0,Math.PI*2);g.fill();}
  g.restore();
 };
 const stage=canvasStage((g,time,reduced)=>{const t=reduced?0:time;
  const sky=g.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#454b48');sky.addColorStop(1,'#292f2e');g.fillStyle=sky;g.fillRect(0,0,960,600);
  for(let i=0;i<10;i++){g.fillStyle=i%2?'#646a6230':'#333b3740';g.fillRect(i*105,110+(i%3)*14,92,100);}
  g.fillStyle='#647366';g.beginPath();g.moveTo(0,280);g.lineTo(590,155);g.lineTo(960,300);g.lineTo(960,600);g.lineTo(0,600);g.fill();
  // The Avon / Ōtākaro, bank stones and ripples: an actual riverside setting.
  g.fillStyle='#4b7277';g.beginPath();g.moveTo(0,330);g.bezierCurveTo(200,355,200,470,470,600);g.lineTo(0,600);g.fill();
  g.strokeStyle='#c9c5b3';g.lineWidth=12;g.beginPath();g.moveTo(0,324);g.bezierCurveTo(200,348,210,468,480,606);g.stroke();
  g.strokeStyle='#a3c0bd50';g.lineWidth=2;for(let i=0;i<14;i++){const x=(i*47+t*9)%330,y=385+i%5*38;g.beginPath();g.moveTo(x,y);g.lineTo(x+30,y-4);g.stroke();}
  // Terrace, cream aisle, flower arch, ribbons and lanterns.
  g.fillStyle='#8d8e7b';g.beginPath();g.moveTo(240,328);g.lineTo(620,226);g.lineTo(935,389);g.lineTo(557,537);g.fill();
  g.fillStyle='#d7c9b4';g.beginPath();g.moveTo(390,440);g.lineTo(530,300);g.lineTo(650,332);g.lineTo(500,483);g.fill();
  g.strokeStyle='#d1c3a6';g.lineWidth=8;g.beginPath();g.moveTo(470,336);g.lineTo(470,214);g.quadraticCurveTo(565,120,660,214);g.lineTo(660,350);g.stroke();
  for(let i=0;i<20;i++){const angle=Math.PI+i/19*Math.PI,x=565+95*Math.cos(angle),y=225+74*Math.sin(angle);g.fillStyle=i%3===0?'#bd8d93':i%3===1?'#ded2bb':'#889574';g.beginPath();g.arc(x,y,7+(i%2),0,Math.PI*2);g.fill();}
  g.strokeStyle='#d9cdb5';g.lineWidth=1.4;g.beginPath();g.moveTo(250,193);g.quadraticCurveTo(550,106,915,240);g.stroke();for(let i=0;i<11;i++){const x=260+i*60,y=176+Math.pow((i-5)/5,2)*38;g.fillStyle='#e5cb8a';g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();}
  for(const x of[260,850]){g.fillStyle='#6d7d59';g.beginPath();g.ellipse(x,278,40,58,0,0,Math.PI*2);g.fill();g.strokeStyle='#77604b';g.lineWidth=8;g.beginPath();g.moveTo(x,300);g.lineTo(x,350);g.stroke();}
  // Guests sit along one side, leaving a clear aisle and portrait area.
  for(let i=0;i<4;i++){const x=740+(i%2)*78,y=382+Math.floor(i/2)*76;g.fillStyle='#b6a990';g.fillRect(x-13,y-27,26,18);g.fillRect(x-11,y-9,4,14);g.fillRect(x+7,y-9,4,14);const c=guests[i+1];if(c)people(g,c,x,y,t,'sit');}
  people(g,a,535,358,t,'idle','light');people(g,b,605,377,t,'idle','dark');
  // Bouquet and a small cake station give the ceremony its own props.
  g.strokeStyle='#6d865c';g.lineWidth=3;g.beginPath();g.moveTo(549,305);g.lineTo(554,322);g.stroke();for(let i=0;i<5;i++){g.fillStyle=i%2?'#d7b5ba':'#eee0c4';g.beginPath();g.arc(546+i*3,300+i%2*5,4,0,Math.PI*2);g.fill();}
  roundBox(g,827,294,62,18,4,'#b9a98c');g.fillStyle='#d9bca8';g.fillRect(846,276,26,17);g.fillStyle='#eee1c7';g.fillRect(850,263,18,14);
  const photographer=choice===1?volunteer:sim.player;
  people(g,photographer,345,435,t,completed?'photo':'phone');if(choice===1)people(g,sim.player,410,493,t,'watch');
  if(completed&&!reduced&&t%3<.11){g.fillStyle='#fff0c66b';g.beginPath();g.ellipse(500,300,95,65,0,0,Math.PI*2);g.fill();}
  if(completed){roundBox(g,752,103,168,92,5,'#e9dfcc','#a89a80');
   for(const [x,w]of [[762,65],[837,73]]){roundBox(g,x,113,w,59,2,'#8d9a89');g.save();g.beginPath();g.rect(x,113,w,59);g.clip();g.translate(x+5,115);g.scale(.3,.3);people(g,a,60,170,0,'idle','light');people(g,b,135,170,0,'idle','dark');g.restore();}
   if(choice===0){g.save();g.translate(872,143);g.rotate(-.2);roundBox(g,-27,-25,54,67,25,'#c9977c');roundBox(g,-15,-18,30,21,12,'#dcb7a0');g.restore();}
   sceneText(g,'PORTRAIT',794,187,10,'#4e4c43');sceneText(g,choice===0?"UNCLE’S THUMB":'VOLUNTEER',873,187,10,'#4e4c43');
  }
  roundBox(g,20,18,920,61,8,'#252624ed','#a5946b50');sceneText(g,'Wedding emergency',40,43,22,'#e8dfcd','left');sceneText(g,'ŌTĀKARO RIVERBANK · A PHOTOGRAPHER IS NEEDED',40,64,11,'#c3b79e','left');
  roundBox(g,20,536,920,46,8,'#252624ed');sceneText(g,result?result[0]+' · '+result[3]:event.scene,40,563,13,'#e0d6c2','left');
 },{height:600,label:'Riverside wedding ceremony with a flower arch, dressed couple, seated guests, bouquet and photographer; choices change who takes the portraits'});
 stage.classList.add('encounter-stage');return stage;
}
