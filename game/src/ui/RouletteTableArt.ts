import type {Character} from '../entities/types';
import {CasinoIso,TABLE_Z,type V3} from './CasinoIso';
import {OUTSIDE,colorOf,type RouletteBet} from '../casino/roulette';
export const ROULETTE_W=1000,ROULETTE_H=620;
export interface RouletteCell{key:string;x:number;y:number;w:number;h:number;label:string;n?:number}
export const rouletteCells:RouletteCell[]=[{key:'0',x:-1.5,y:-1.5,w:.5,h:1.8,label:'0',n:0}];
for(let n=1;n<=36;n++)rouletteCells.push({key:String(n),n,x:-1+Math.floor((n-1)/3)*.47,y:-1.5+(2-(n-1)%3)*.6,w:.47,h:.6,label:String(n)});
for(let row=0;row<3;row++)rouletteCells.push({key:'c'+(3-row),x:4.64,y:-1.5+row*.6,w:.5,h:.6,label:'2:1'});
for(let i=0;i<3;i++)rouletteCells.push({key:'d'+(i+1),x:-1+i*1.88,y:.3,w:1.88,h:.53,label:['1st 12','2nd 12','3rd 12'][i]});
for(const [i,key]of['low','even','red','black','odd','high'].entries())rouletteCells.push({key,x:-1+i*.94,y:.83,w:.94,h:.58,label:({low:'1–18',even:'EVEN',red:'◆',black:'◆',odd:'ODD',high:'19–36'} as Record<string,string>)[key]});
export function cellQuad(c:RouletteCell):[number,number][]{const iso=new CasinoIso(null as unknown as CanvasRenderingContext2D,ROULETTE_W,ROULETTE_H);return[[c.x,c.y],[c.x+c.w,c.y],[c.x+c.w,c.y+c.h],[c.x,c.y+c.h]].map(([x,y])=>iso.p(x,y,TABLE_Z+.04));}
export interface RouletteArtState{wheel:HTMLCanvasElement;bets:readonly RouletteBet[];last:number;spinning:boolean;hover:string;people:readonly Character[];guests:readonly {id:number;balance:number}[];player?:Character;dealer?:Character;recent:boolean;net:number}
export function drawRouletteTable(g:CanvasRenderingContext2D,s:RouletteArtState,time:number,reduced:boolean):void{
 const iso=new CasinoIso(g,ROULETTE_W,ROULETTE_H),motion=reduced?0:time;iso.room();
 const seats: {id:number;x:number;y:number;aim:V3}[]=[{id:s.guests[0]?.id??-1,x:-6.5,y:-.2,aim:[-4.7,0,TABLE_Z]},{id:s.guests[1]?.id??-1,x:0,y:-3,aim:[0,-1.5,TABLE_Z]},{id:s.guests[2]?.id??-1,x:6.5,y:-.2,aim:[5,0,TABLE_Z]},{id:s.player?.id??-1,x:3.5,y:2.85,aim:[3.5,1.9,TABLE_Z]}];
 const person=(id:number)=>s.people.find(c=>c.id===id),figure=(seat:typeof seats[number],arms=false)=>{const c=person(seat.id);if(c)iso.actor(c,seat.x,seat.y,motion,s.recent&&s.net>0?'cheer':s.spinning?'watch':'bet',true,seat.aim,arms);};
 for(const seat of seats.filter(a=>a.x+a.y<0)){iso.chair(seat.x,seat.y,Math.atan2(seat.y,seat.x)-Math.PI/2);figure(seat);}
 if(s.dealer)iso.actor(s.dealer,-3,-2.75,motion,s.dealer.wounds.length?'watch':'deal',false,[-3,-.9,TABLE_Z]);
 iso.table(6,2.5,true);
 // A single physical wheel is embedded into the same tabletop plane as the betting cloth.
 iso.plane(TABLE_Z+.05,p=>{p.drawImage(s.wheel,-5.35,-1.4,2.8,2.8);p.fillStyle='#d5c8a1';p.textAlign='center';p.font='600 .15px Arial';p.fillText('EUROPEAN ROULETTE',-3.95,1.71);});
 for(const c of rouletteCells){const isNumber=c.n!==undefined,colour=isNumber?colorOf(c.n!):c.key,won=s.last>=0&&(isNumber?c.n===s.last:OUTSIDE[c.key]?.numbers.includes(s.last));iso.plane(TABLE_Z+.04,p=>{p.fillStyle=isNumber?(colour==='red'?'#a14c3d':colour==='black'?'#253b2d':'#3e704b'):'#3d6040';p.fillRect(c.x,c.y,c.w,c.h);if(s.hover===c.key||won&&!s.spinning){p.fillStyle=s.hover===c.key?'#d7c18b55':'#d7c18b38';p.fillRect(c.x,c.y,c.w,c.h);}p.strokeStyle='#d3d0a3';p.lineWidth=.015;p.strokeRect(c.x,c.y,c.w,c.h);p.fillStyle=c.key==='red'?'#b84436':c.key==='black'?'#172c24':'#eee5c6';p.textAlign='center';p.textBaseline='middle';p.font=(isNumber?'600 .24px':'600 .16px')+' Arial';p.fillText(c.label,c.x+c.w/2,c.y+c.h/2,c.w*.9);});}
 for(const b of s.bets){const selected=b.numbers.map(n=>rouletteCells.find(c=>c.n===n)).filter((c):c is RouletteCell=>!!c);const outside=rouletteCells.find(c=>OUTSIDE[c.key]?.numbers.length===b.numbers.length&&OUTSIDE[c.key].numbers.every(n=>b.numbers.includes(n)));let x=0,y=0;if(outside){x=outside.x+outside.w/2;y=outside.y+outside.h/2;}else if(selected.length){x=selected.reduce((a,c)=>a+c.x+c.w/2,0)/selected.length;y=selected.reduce((a,c)=>a+c.y+c.h/2,0)/selected.length;if(b.numbers.length===3||b.numbers.length===6)y=.3;if(b.numbers.length===2&&b.numbers.includes(0)){const other=selected.find(c=>c.n!==0)!;x=-1;y=other.y+other.h/2;}}else{const c=rouletteCells.find(c=>c.key===b.id||OUTSIDE[c.key]?.numbers.length===b.numbers.length&&OUTSIDE[c.key]?.numbers.every(n=>b.numbers.includes(n)));if(!c)continue;x=c.x+c.w/2;y=c.y+c.h/2;}iso.chip(x,y,TABLE_Z+.06,Math.min(7,1+Math.floor(Math.log10(Math.max(1,b.amount)))),'#c7af79');}
 iso.box(-2.35,-2,.75,.3,TABLE_Z+.03,.06,'#354b35');for(let i=0;i<4;i++)iso.chip(-2.25+i*.16,-1.86,TABLE_Z+.1,5,['#c4ac76','#b27660','#527a5d','#d9cfb2'][i]);
 for(const seat of seats){iso.glass(seat.aim[0]+.35,seat.aim[1]);const guest=s.guests.find(a=>a.id===seat.id);if(guest)iso.chip(seat.aim[0]-.25,seat.aim[1],TABLE_Z+.04,Math.min(8,Math.ceil(guest.balance/50)),'#aebf98');}
 if(s.dealer)iso.actor(s.dealer,-3,-2.75,motion,s.dealer.wounds.length?'watch':'deal',false,[-3,-.9,TABLE_Z],true);
 for(const seat of seats.filter(a=>a.x+a.y<0))figure(seat,true);
 for(const seat of seats.filter(a=>a.x+a.y>=0).sort((a,b)=>a.x+a.y-b.x-b.y)){iso.chair(seat.x,seat.y,Math.atan2(seat.y,seat.x)-Math.PI/2);figure(seat);}
 for(const seat of seats){const c=person(seat.id);if(c)iso.name(c,seat.x,seat.y,c.id===s.player?.id?'You':undefined);}if(s.dealer)iso.name(s.dealer,-3,-2.75,'Dealer · '+s.dealer.name.split(' ')[0],true);
 g.fillStyle='#e5d6ad';g.font='600 15px Arial';g.textAlign='center';g.fillText(s.spinning?'NO MORE BETS · BALL IN PLAY':s.last<0?'PLACE YOUR CHIPS ON THE CLOTH':s.last+' '+colorOf(s.last).toUpperCase(),ROULETTE_W/2,ROULETTE_H-25);
}
