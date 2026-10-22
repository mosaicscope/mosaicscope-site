import type {Character} from '../entities/types';
import {CasinoIso} from './CasinoIso';
import {canvasStage} from './CanvasStage';
import {h} from './dom';
export const FLOOR_W=1200,FLOOR_H=740;
import {FLOOR_AREAS,casinoCompany,casinoWalkPath} from './CasinoFloorPlan';
function miniTable(iso:CasinoIso,id:string,x:number,y:number,people:readonly Character[],time:number):void{
 const dealer=people[0],a=people[1],b=people[2];if(dealer)iso.actor(dealer,x,y-1.25,time,'deal',false,[x,y,.94]);
 if(a){iso.chair(x-1.9,y,Math.PI/2);iso.actor(a,x-1.9,y,time,'bet',true,[x-1,y,.94]);}
 iso.at(x,y,q=>{q.table(1.75,1);if(id==='roulette'){q.oval(.48,.48,.99,'#60452d','#d2b77c');q.oval(.35,.35,1.01,'#8d7250','#d2b77c');q.plane(1.02,g=>{for(let n=0;n<18;n++){g.fillStyle=n%2?'#ad5143':'#253a2b';g.fillRect(.25+(n%6)*.17,-.45+Math.floor(n/6)*.22,.15,.2);}});}else{for(let i=0;i<5;i++)q.card(-.75+i*.37,0,7+i,'♠',i<3,1,.28,.4);}for(let i=0;i<4;i++)q.chip(-1.1+i*.7,.6,1,3+i%2,['#c3aa74','#a86155','#74937c'][i%3]);});
 if(dealer)iso.actor(dealer,x,y-1.25,time,'deal',false,[x,y,.94],true);
 if(b){iso.chair(x+.5,y+1.35,0);iso.actor(b,x+.5,y+1.35,time,Math.floor(time/5)%4===0?'cheer':'sit',true,[x+.4,y+.6,.94]);}
}
export class CasinoFloor {
 x=4.5;y=5.5;private path:[number,number][]=[];private last=0;private hover='';private chosen='roulette';
 view(people:readonly Character[],go:(id:string)=>void,meet:(id?:number)=>void):HTMLElement{
  const player=people.find(c=>c.tier==='player'),company=casinoCompany(people,[],24),isoPoint=new CasinoIso(null as unknown as CanvasRenderingContext2D,FLOOR_W,FLOOR_H,38,360),guestSpots=[[-3.8,5.5],[-2.7,5.3],[-.5,5.5],[.8,5.7],[3.5,-1.9]];
  const stage=canvasStage((g,t,reduced)=>{const iso=new CasinoIso(g,FLOOR_W,FLOOR_H,38,360),dt=Math.min(.06,Math.max(0,t-this.last));this.last=t;const next=this.path[0];if(next){const dx=next[0]-this.x,dy=next[1]-this.y,d=Math.hypot(dx,dy),step=dt*2.4;if(d<=step){this.x=next[0];this.y=next[1];this.path.shift();}else{this.x+=dx/d*step;this.y+=dy/d*step;}}
   iso.room();iso.plane(.01,p=>{p.fillStyle='#603d3f';p.strokeStyle='#b7a276';p.lineWidth=.055;p.beginPath();p.roundRect(-6.2,-2.2,12.6,7.9,.25);p.fill();p.stroke();p.strokeStyle='#b7a27633';p.lineWidth=.02;for(let x=-5.8;x<6;x+=.5){p.beginPath();p.moveTo(x,-2);p.lineTo(x,5.5);p.stroke();}});
   iso.sign(-.5,-4.95,2.1,'THE TESSERA · AFTER HOURS',6);for(const x of[-5.8,0,5.8]){iso.box(x,-4.9,.16,.16,0,2.7,'#aa936d');}
   const objects:{depth:number;draw:()=>void}[]=[];
   for(const [start,mark]of[[-5.8,'7'],[.2,'♦']] as const)for(let i=0;i<3;i++){const x=start+i*1.1;objects.push({depth:x-3.4,draw:()=>{iso.cabinet(x,-4.45,mark,reduced?0:t+i);const c=company[(mark==='7'?0:3)+i];if(c)iso.actor(c,x+.35,-3.25,reduced?0:t,'sit',true,[x+.35,-4,.9]);}});}
   objects.push({depth:1.5,draw:()=>{iso.box(4.8,-4.4,1.6,.85,0,.95,'#7a6950');for(let i=0;i<8;i++)iso.line([[4.9+i*.19,-3.54,.98],[4.9+i*.19,-3.54,1.85]],'#b8a67e',1.4);iso.sign(5.6,-3.5,1.85,'CASHIER',1.7);if(company[6])iso.actor(company[6],5.5,-4.3,t,'give',false,[5.5,-3.3,1]);}});
   objects.push({depth:4,draw:()=>{iso.cabinet(4.95,-1.9,'✈',t);iso.cabinet(5.75,-1.9,'✈',t);}});
   for(const [i,id,x,y]of[[0,'blackjack',-3.9,-.2],[1,'holdem',0,1],[2,'roulette',4,2]] as const)objects.push({depth:x+y,draw:()=>miniTable(iso,id,x,y,[company[7+i*3],company[8+i*3],company[9+i*3]].filter((c):c is Character=>!!c),reduced?0:t)});
   objects.push({depth:-.9,draw:()=>{iso.bar(-6.4,3.35,3.3);if(company[16])iso.actor(company[16],-4.7,3.2,t,'give',false,[-4.7,4,.98]);}});
   objects.push({depth:5.2,draw:()=>iso.lounge(-1.3,5.2,3)});
   guestSpots.forEach(([x,y],i)=>{const c=company[17+i]??company[i];if(c)objects.push({depth:x+y,draw:()=>{iso.actor(c,x,y,reduced?0:t,i===2?'sitdrink':'talk',i===2,[x+.2,y+.3,1]);}});});
   if(player)objects.push({depth:this.x+this.y,draw:()=>{iso.actor(player!,this.x,this.y,reduced?0:t,this.path.length?'walk':'watch',false,[next?.[0]??this.x+1,next?.[1]??this.y,0]);const p=iso.p(this.x,this.y);g.strokeStyle='#d2bc84';g.lineWidth=2;g.beginPath();g.ellipse(p[0],p[1],13,6,0,0,Math.PI*2);g.stroke();}});
   objects.sort((a,b)=>a.depth-b.depth);objects.forEach(o=>o.draw());
   for(const a of FLOOR_AREAS){const [x,y]=iso.p(a.x,a.y,.1);g.font='600 14px Arial';g.textAlign='center';g.strokeStyle='#1f2725';g.lineWidth=4;g.strokeText(a.label,x,y+33);g.fillStyle=this.hover===a.id?'#f4db9d':'#e7d6b2';g.fillText(a.label,x,y+33);}
   if(this.path.length){const end=this.path[this.path.length-1],p=iso.p(...end);g.strokeStyle='#c7b48388';g.lineWidth=1.5;g.beginPath();g.ellipse(p[0],p[1],9,4,0,0,Math.PI*2);g.stroke();}
  },{width:FLOOR_W,height:FLOOR_H,label:'Interactive isometric Tessera casino floor with seven playable game areas, bar, women and men Mosaics, staff and lounge. Tap a station to enter or the floor to walk.',pointer:p=>{
   let found='',best=70;for(const a of FLOOR_AREAS){const q=isoPoint.p(a.x,a.y,.8),d=Math.hypot(p.x-q[0],p.y-q[1]);if(d<best){best=d;found=a.id;}}this.hover=found;if(p.type!=='up')return;if(found){if(found==='bar')meet();else go(found);return;}
   for(let i=0;i<guestSpots.length;i++){const q=isoPoint.p(guestSpots[i][0],guestSpots[i][1],1);if(Math.hypot(p.x-q[0],p.y-q[1])<26){meet((company[17+i]??company[i])?.id);return;}}
   const dx=(p.x-FLOOR_W/2)/38,dy=(p.y-360)/19;this.path=casinoWalkPath([this.x,this.y],[(dx+dy)/2,(dy-dx)/2]);
  }});
  const enter=()=>this.chosen==='bar'?meet():go(this.chosen);
  return h('section.iso-game.iso-casino-floor',null,[stage,h('div.iso-table-console',null,[h('div.venue-service-actions',null,[h('select',{'aria-label':'Casino destination',onchange:(e:Event)=>{this.chosen=(e.target as HTMLSelectElement).value;}},FLOOR_AREAS.map(a=>h('option',{value:a.id,selected:this.chosen===a.id,text:a.label}))),h('button.btn',{text:'Enter area',onclick:enter}),h('button.btn',{text:'Meet the guests',onclick:()=>meet()})]),h('p',{role:'status',text:'Tap a table to play, a guest to meet them, or an aisle to walk. Your chips follow you between games.'})])]);
 }
}
