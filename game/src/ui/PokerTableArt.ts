import type {Character} from '../entities/types';
import type {PokerTable} from '../casino/holdem';
import {CasinoIso,TABLE_Z} from './CasinoIso';
export const POKER_W=900,POKER_H=620;
interface Seat{x:number;y:number;cx:number;cy:number}
function seats(t:PokerTable):Seat[]{if(t.seats.length===4)return[{x:2.8,y:2.55,cx:2.5,cy:1.3},{x:5.05,y:-.45,cx:3.8,cy:-.45},{x:-1.7,y:-2.85,cx:-1.4,cy:-1.45},{x:-5.05,y:-.55,cx:-3.7,cy:-.55}];return t.seats.map((_,i)=>{const a=Math.PI/2+i/t.seats.length*Math.PI*2;return{x:Math.cos(a)*5.05,y:Math.sin(a)*2.85,cx:Math.cos(a)*3.65,cy:Math.sin(a)*1.4};});}
export function pokerSeatAt(t:PokerTable,x:number,y:number,width=POKER_W):number{const project=new CasinoIso(null as unknown as CanvasRenderingContext2D,width),all=seats(t);return all.findIndex(s=>{const p=project.p(s.x,s.y,1.35);return Math.hypot(x-p[0],y-p[1])<38;});}
export function drawPokerTable(g:CanvasRenderingContext2D,t:PokerTable,people:readonly Character[],time:number,reduced:boolean,age:number,selected:number,preview=false,width=POKER_W):void{
 const iso=new CasinoIso(g,width,POKER_H),all=seats(t),person=(i:number)=>people.find(c=>c.id===t.seats[i].id),motion=reduced?0:time;
 iso.room();
 const figure=(i:number,arms=false)=>{const s=all[i],c=person(i);if(!c||preview&&i===0)return;const doing=t.winners.includes(i)&&!preview?'cheer':t.actor===i?'bet':'sit';iso.actor(c,s.x,s.y,motion,doing,true,[s.cx,s.cy,TABLE_Z],arms);};
 const back=all.map((s,i)=>({s,i})).filter(a=>a.s.x+a.s.y<0).sort((a,b)=>a.s.x+a.s.y-b.s.x-b.s.y);
 for(const {s,i}of back){iso.chair(s.x,s.y,Math.atan2(s.y,s.x)-Math.PI/2);figure(i);}
 const dealer=people.find(c=>c.phys===0&&c.tier!=='player'&&!t.seats.some(s=>s.id===c.id));if(dealer)iso.actor(dealer,-4.6,1.6,motion,'deal',false,[-3.3,.45,TABLE_Z]);
 iso.table(4.65,2.3);
 iso.plane(TABLE_Z+.03,p=>{p.textAlign='center';p.fillStyle='#b4bd8c';p.font='600 .22px Arial';p.fillText('TEXAS HOLD’EM',0,-1.33);p.font='.13px Arial';p.fillText('THE TESSERA · '+(preview?'TAKE A SEAT':t.mode==='cash'?'CASH TABLE':'TOURNAMENT'),0,-1.07);for(let i=0;i<5;i++){p.strokeStyle='#a7b78399';p.lineWidth=.015;p.strokeRect(-1.65+i*.69,-.39,.53,.79);}});
 // Dealer rack, deck, cut card, five community cards and a single shared pot all share this plane.
 iso.box(-3.9,.25,.9,.55,TABLE_Z,.045,'#344733');for(let i=0;i<4;i++)iso.chip(-3.77+i*.21,.55,TABLE_Z+.07,4+i%2,['#b77760','#d0b67c','#4e7661','#d6cdb0'][i]);
 iso.plane(TABLE_Z+.045,p=>{p.fillStyle='#c9b274';p.fillRect(-3.6,-.55,.43,.66);});for(let i=0;i<4;i++)iso.card(-3.2,-.2,2,'♠',false,TABLE_Z+.05+i*.012,.4,.6);
 const moving=!preview&&!reduced&&age<.65&&t.phase==='betting',last=t.board.length-1;
 t.board.forEach((c,i)=>{if(!(moving&&i===last))iso.card(-1.38+i*.69,0,c.rank,c.suit,true,TABLE_Z+.06,.55,.8);});
 if(moving&&last>=0){const f=Math.min(1,age/.65),c=t.board[last];iso.card(-3.2+(-1.38+last*.69+3.2)*f,-.2+.2*f,c.rank,c.suit,f>.35,TABLE_Z+.06+Math.sin(f*Math.PI)*.22,.55,.8);}
 if(preview){for(let i=0;i<3;i++)iso.card(-1.38+i*.69,0,[13,10,9][i],['♠','♥','♣'][i],true,TABLE_Z+.06,.55,.8);}
 if(t.pot){for(let i=0;i<3;i++)iso.chip(-.45+i*.42,.96,TABLE_Z+.05,Math.min(10,Math.ceil(t.pot/20)-i*3),['#b77760','#c9af75','#4c7160'][i]);}
 for(const s of all){const i=all.indexOf(s),a=t.seats[i];if(preview&&i===0)continue;a.hand.forEach((c,j)=>iso.card(s.cx+(j-.5)*.48,s.cy,c.rank,c.suit,i===0||!preview&&t.phase!=='betting',TABLE_Z+.06,.43,.66));iso.chip(s.cx+.55,s.cy,TABLE_Z+.05,Math.min(9,Math.ceil(a.stack/25)),'#c3ac74');if(a.bet)iso.chip(s.cx,s.cy*.6,TABLE_Z+.05,Math.min(8,Math.ceil(a.bet/5)),'#b87861');iso.glass(s.cx-.6,s.cy+.15);if(i===t.button)iso.plane(TABLE_Z+.06,p=>{p.fillStyle='#e6dfc5';p.beginPath();p.arc(s.cx+.65,s.cy+.3,.11,0,Math.PI*2);p.fill();p.fillStyle='#2b4432';p.font='600 .13px Arial';p.textAlign='center';p.fillText('D',s.cx+.65,s.cy+.35);});}
 if(dealer)iso.actor(dealer,-4.6,1.6,motion,'deal',false,[-3.3,.45,TABLE_Z],true);
 for(const {i}of back)figure(i,true);
 for(const {s,i}of all.map((s,i)=>({s,i})).filter(a=>a.s.x+a.s.y>=0).sort((a,b)=>a.s.x+a.s.y-b.s.x-b.s.y)){iso.chair(s.x,s.y,Math.atan2(s.y,s.x)-Math.PI/2);figure(i);}
 all.forEach((s,i)=>{const c=person(i);if(!c)return;iso.name(c,s.x,s.y,preview&&i===0?'Your seat':c.name.split(' ')[0]+(preview?'':' · $'+t.seats[i].stack+(t.seats[i].folded?' · folded':t.seats[i].allIn?' · ALL IN':''))+(i===selected?' ◇':''));});
 const label=preview?'TABLE PREVIEW · YOUR SEAT IS READY':t.phase==='betting'?['PREFLOP','FLOP','TURN','RIVER'][t.street]+' · POT $'+t.pot:t.message;
 g.font='600 15px Arial';g.textAlign='center';g.fillStyle='#e6d7af';g.fillText(label,width/2,POKER_H-24,width-50);
 if(dealer)iso.name(dealer,-4.6,1.6,'Dealer · '+dealer.name.split(' ')[0],true);
}
