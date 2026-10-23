import type {Character} from '../entities/types';
import type {Blackjack} from '../casino/blackjack';
import {handValue} from '../casino/blackjack';
import type {Card} from '../casino/cards';
import {CasinoIso,TABLE_Z} from './CasinoIso';
export interface StationState{kind:'blackjack'|'pokies'|'poker';people:readonly Character[];dealer?:Character;blackjack?:Blackjack;bet:number;reels:readonly string[];spinning:boolean;hand:readonly Card[];held:readonly boolean[];win:number}
export const STATION_W=1200,STATION_H=700;
/** Native room furniture surrounds the actual game state. Controls remain readable below the scene. */
export function drawCasinoStation(g:CanvasRenderingContext2D,s:StationState,time:number,reduced=false):void{
 const iso=new CasinoIso(g,STATION_W,STATION_H,52,365),t=reduced?0:time,player=s.people.find(c=>c.tier==='player'),guests=s.people.filter(c=>c.tier!=='player'&&c.id!==s.dealer?.id&&c.phys===0).slice(0,12),dealer=s.dealer??guests[0];iso.room();iso.ambience(s.kind==='blackjack'?'BLACKJACK · SIX DECKS':s.kind==='pokies'?'KIWI GOLD · MACHINE LOUNGE':'JACKS OR BETTER · VIDEO POKER');
 // Guests have distinct jobs and paths, with short pauses at each end of a journey.
 const walker=(c:Character,i:number)=>{const cycle=(t*.5+i*2.7)%20,go=cycle<8,back=cycle>=10&&cycle<18,u=go?cycle/8:cycle<10?1:back?1-(cycle-10)/8:0,x=-5.8+u*10.5,y=4.6+i%2*.55;iso.actor(c,x,y,t,go||back?'walk':'talk',false,[x+(back?-1:1),y,1]);};
 if(s.kind==='blackjack'){
  const bj=s.blackjack!;if(dealer)iso.actor(dealer,0,-2.5,t,bj.phase==='betting'?'watch':'deal',false,[0,-.9,TABLE_Z]);
  for(const[i,x,y]of [[0,-4.3,-.3],[1,4.3,-.3]] as const){const c=guests[i+1];if(c){iso.chair(x,y,Math.atan2(y,x)-Math.PI/2);iso.actor(c,x,y,t,'watch',true,[x*.65,y,TABLE_Z]);}}
  iso.table(4.1,2.05);iso.plane(TABLE_Z+.03,p=>{p.fillStyle='#d9c99c';p.textAlign='center';p.font='600 .28px Georgia';p.fillText('BLACKJACK PAYS 3 TO 2',0,-.25);p.font='.16px Arial';p.fillText('DEALER STANDS ON SOFT 17 · INSURANCE 2 TO 1',0,.12);p.strokeStyle='#d2c59e';p.lineWidth=.025;for(const x of[-2.9,-1.4,0,1.4,2.9]){p.beginPath();p.ellipse(x,1.1,.35,.33,0,0,6.283);p.stroke();}});
  iso.box(-1.6,-1.6,1.9,.27,TABLE_Z,.07,'#303d32');for(let i=0;i<7;i++)iso.chip(-1.45+i*.27,-1.45,1.02,5+i%4,['#b65c4b','#829d73','#c3b07c'][i%3]);iso.box(1.55,-1.6,.55,.65,TABLE_Z,.16,'#6c5b43');
  bj.dealer.forEach((c,i)=>iso.card(-.6+i*.45,-.8,c.rank,c.suit,i!==1||bj.holeRevealed,1.03,.38,.57));
  const hands=bj.hands.length?bj.hands:[null];hands.forEach((hd,i)=>{const x=(i-(hands.length-1)/2)*1.5;hd?.cards.forEach((c,j)=>iso.card(x+(j-(hd.cards.length-1)/2)*.31,.55,c.rank,c.suit,true,1.04+j*.001,.4,.6));iso.chip(x,1.22,1.03,Math.ceil((hd?.bet??s.bet)/5),'#a65b4c');if(hd){const q=iso.p(x,1.68,1.04);g.fillStyle=i===bj.active&&bj.phase==='player'?'#f2d396':'#d0d3bb';g.font='bold 15px Arial';g.textAlign='center';g.fillText(String(handValue(hd.cards).total)+(hd.result?' · '+hd.result:''),q[0],q[1]);}});
  for(const side of[-1,1]){iso.card(side*2.8,.3,10,'♣',false,1.025);iso.chip(side*2.8,1.1,1.025,3,'#7e9a79');iso.glass(side*3.45,.4,1.03);}
  if(dealer)iso.actor(dealer,0,-2.5,t,bj.phase==='betting'?'watch':'deal',false,[0,-.9,TABLE_Z],true);
  if(player){iso.chair(0,2.75,0);iso.actor(player,0,2.75,t,bj.phase==='player'?'bet':'watch',true,[0,1.1,TABLE_Z]);iso.name(player,0,2.75,'You');}
 }else{
  // Freestanding cabinets have a footrest, seat, tilted console, screen and payment slot.
  const stations=[[-4.8,-1.9],[-2.3,-1.9],[.2,-1.9],[2.7,-1.9]];
  stations.forEach(([x,y],i)=>{iso.cabinet(x,y,s.kind==='pokies'?'7':'♦',t+i);const c=i===1?player:guests[i+1];if(c)iso.actor(c,x+.32,y+1.3,t,'sit',true,[x+.32,y+.65,.95]);if(i===1){const p=iso.p(x+.05,y+.628,1.23);g.save();g.transform(52,26,0,-64,p[0],p[1]);g.fillStyle='#182d2e';g.fillRect(0,0,.54,.62);g.textAlign='center';g.fillStyle='#e3cc8f';g.font='bold .082px Arial';g.scale(1,-1);if(s.kind==='pokies'){const symbols=s.spinning?['7','◆','7'].map((v,j)=>Math.floor(t*13+j)%2?v:'BAR'):s.reels;g.fillText(symbols.join('  '),.27,-.28);g.font='.055px Arial';g.fillText(s.spinning?'SPINNING':s.win?'PAID $'+s.win:'BET $'+s.bet,.27,-.12);}else{s.hand.forEach((c,j)=>{g.fillStyle=c.suit==='♥'||c.suit==='♦'?'#e9ac9b':'#e3ddc0';g.fillText((c.rank===14?'A':c.rank>10?['J','Q','K'][c.rank-11]:c.rank)+c.suit,.06+j*.102,-.31);if(s.held[j]){g.fillStyle='#a4c9a4';g.font='.035px Arial';g.fillText('HOLD',.06+j*.102,-.2);g.font='bold .082px Arial';}});}g.restore();iso.sign(x+.32,y+.65,1.75,'YOUR MACHINE',1.4);}});
 }
 iso.lounge(-4.4,3.3,2.5);for(let i=0;i<2;i++){const c=guests[i+5];if(c)iso.actor(c,-3.9+i*.9,3.65,t,i?'sitdrink':'talk',true,[-3,3,.9]);}
 for(let i=0;i<2;i++){const c=guests[i+8];if(c)walker(c,i);}
 const p=iso.p(4.7,3.7,.02);g.fillStyle='#b6a17b';g.font='600 13px Arial';g.textAlign='center';g.fillText(s.kind==='blackjack'?'LIVE TABLE · YOUR CARDS ON THE FELT':'YOUR CONTROLS & PAYTABLE BELOW',p[0],p[1]);
}
