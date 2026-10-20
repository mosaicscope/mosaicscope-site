import {AIRCRAFT} from '../content/aircraft';
import {drawAircraft} from '../render/Aircraft';
import {scratchDesign} from '../content/scratchcards';
import type { Character } from "../entities/types";
import { campusScene, farmScene } from "./VenueArt";
import { canvasStage, felt, playingCard, die, roundBox, sceneText } from './CanvasStage';
import type { ExpansionState } from '../sim/Expansion';
import type { ArcadeResult, ScratchTicket } from '../sim/Arcade';

export { animalSprite as creature } from './VenueArt';
export function countryside(s:ExpansionState,mode:'farm'|'horse'|'campus',click?:(x:number,y:number)=>void,people:readonly Character[]=[]) {
 return mode==='campus'?campusScene(s,click,people):farmScene(s,mode==='horse',people);
}

export function casinoArt(game:string,result:()=>ArcadeResult|undefined,state:()=>ExpansionState,tick:()=>number,model=0) {
 return canvasStage((g,t,reduced)=>{
  felt(g);const r=result(),v=r?.game===game?r.values:[],anim=reduced?1:Math.min(1,t/1.8),ease=1-Math.pow(1-anim,3);
  sceneText(g,game.toUpperCase(),480,63,25,'#ecd28d');
  if(game==='Baccarat'||game==='Tournament'){
   const split=game==='Baccarat'?v[0]||2:v.length;
   sceneText(g,game==='Baccarat'?'PLAYER':'THREE ROUND CHALLENGE',265,122,17,'#b6d5c5');if(game==='Baccarat')sceneText(g,'BANKER',700,122,17,'#b6d5c5');
   const cards=game==='Baccarat'?v.slice(1):v;
   (cards.length?cards:[0,0,0,0]).forEach((n,i)=>{const x=game==='Baccarat'?(i<split?185+i*83:620+(i-split)*83):385+i*90;playingCard(g,x,230-(1-ease)*150,n||1,i%2?'♥':'♠',n?(reduced?1:Math.max(0,Math.min(1,t*2-i*.25))):0);});
  }else if(game==='Craps'){
   sceneText(g,state().casino.point?`POINT ${state().casino.point}`:'PASS LINE',480,139,24,'#c4dfc5');
   die(g,370,245,v[0]||1,(1-ease)*17,1.5);die(g,580,245,v[1]||1,-(1-ease)*21,1.5);
  }else if(game==='Big wheel'){
   const sector=v[0]??0,rotation=-(sector+.5)*Math.PI/12-Math.PI/2+(1-ease)*Math.PI*10;
   roundBox(g,220,60,520,372,24,'#242b27','#ad9972');g.fillStyle='#151b18';g.beginPath();g.arc(480,253,169,0,7);g.fill();for(let i=0;i<40;i++){const a=i*Math.PI/20;g.fillStyle=reduced||Math.floor(t*5+i)%4?'#b6a379':'#fff1c1';g.beginPath();g.arc(480+Math.cos(a)*164,253+Math.sin(a)*164,3.3,0,7);g.fill();}g.save();g.translate(480,253);g.rotate(rotation);
   for(let i=0;i<24;i++){g.beginPath();g.moveTo(0,0);g.arc(0,0,154,i*Math.PI/12,(i+1)*Math.PI/12);g.fillStyle=['#183f3b','#bd9760','#315d51','#b6605b'][i%4];g.fill();g.strokeStyle='#ead49a';g.stroke();g.save();g.rotate((i+.5)*Math.PI/12);sceneText(g,String(i<12?'—':i<18?'2×':i<21?'3×':i<23?'5×':'8×'),119,5,17);g.restore();}g.restore();
   g.fillStyle='#f7d783';g.beginPath();g.moveTo(465,80);g.lineTo(495,80);g.lineTo(480,113);g.fill();roundBox(g,459,232,42,42,20,'#ead39c');
  }else if(game==='Keno'){
   for(let i=0;i<10;i++){const visible=reduced||t>i*.18;const x=164+i%5*157,y=196+Math.floor(i/5)*112;if(!visible)continue;g.fillStyle=v[i]?'#e7ca85':'#607b70';g.beginPath();g.arc(x,y-((1-ease)*100),37,0,7);g.fill();sceneText(g,String(v[i]||'?'),x,y+7,23,'#173c34');}
  }else if(game==='Crash'){
   const f=state().casino.crash,elapsed=f?Math.max(0,(tick()-f.start)/60):0,m=f?.paid&&r?.game==='Crash'?r.values[0]:Math.exp(elapsed*.2),bust=!!f&&m>=f.bust;
   const aircraft=AIRCRAFT[model%AIRCRAFT.length],scene=model%5;
   const sky=g.createLinearGradient(0,0,0,480);sky.addColorStop(0,['#324c5b','#606c78','#314145','#534b56','#303c55'][scene]);sky.addColorStop(1,'#b5b49e');g.fillStyle=sky;g.fillRect(0,0,960,480);
   for(let layer=0;layer<3;layer++){g.fillStyle=['#526663','#455650','#35453e'][layer];g.beginPath();g.moveTo(0,480);for(let i=0;i<=12;i++){const xx=i*100-(reduced?0:t*(8+layer*8)%100);g.lineTo(xx,335+layer*32-Math.sin(i*1.8+scene+layer)*45);}g.lineTo(960,480);g.fill();}
   for(let i=0;i<8;i++){const xx=((i*179-(reduced?0:t*23))%1150+1150)%1150-100;g.fillStyle='#dddcd142';g.beginPath();g.ellipse(xx,70+i%3*46,50+i%3*16,11,0,0,7);g.fill();}
   const end=Math.min(1,elapsed/12),stop=f?Math.min(end,Math.log(f.bust)/.2/12):.2,px=100+stop*730,py=345-Math.pow(stop,1.35)*240;
   g.strokeStyle='#eee4ce66';g.lineWidth=2;g.setLineDash([7,6]);g.beginPath();g.moveTo(70,360);g.quadraticCurveTo(px*.7,365,px,py);g.stroke();g.setLineDash([]);
   g.save();g.translate(px,py);g.rotate(-.12-stop*.25);drawAircraft(g,aircraft,0,0,Math.min(1.6,210/(aircraft.length*5)),reduced?0:t,!!f&&!bust);g.restore();
   if(f?.paid&&r?.payout&&!reduced)for(let i=0;i<36;i++){const a=i*2.4,rad=(t%1.5)*70;g.fillStyle=['#e4c58b','#c0d4bf','#e7a993'][i%3];g.fillRect(750+Math.cos(a)*rad,100+Math.sin(a)*rad,4,4);}
   roundBox(g,24,22,912,66,8,'#202722e8','#c1b28b');sceneText(g,aircraft.name+' · '+['COASTAL ROUTE','HIGH COUNTRY','SOUTHERN LAKES','DUSK EXPRESS','NIGHT DEPARTURE'][scene],45,47,17,'#e4d6b4','left');sceneText(g,f?`${bust?'FLIGHT ENDED':f.paid?'COLLECTED':'LIVE'} · ${Math.min(m,f.bust).toFixed(2)}×`:'READY FOR TAKEOFF',480,75,23,'#f1dfb7');
  }else if(game==='Scratchies'){sceneText(g,'LUCKY PŪKEKO',480,145,34,'#edce86');for(let i=0;i<3;i++){roundBox(g,147+i*230,180,190,155,16,'#a7b6a1','#f2dc9f');sceneText(g,'✦',242+i*230,275,50,'#f5e6b6');}sceneText(g,'Buy a ticket below. Rub to reveal.',480,390,19);
  }else{
   for(let i=0;i<4;i++){const x=225+i*170;playingCard(g,x,238,1+i*3,['♠','♦','♣','♥'][i],1,.9);roundBox(g,x-46,322,92,28,12,'#b49459');sceneText(g,['MIRI','BAZ','AROHA','DALE'][i],x,342,14,'#142f28');}
  }
  sceneText(g,r?.game===game?r.result:'Place a game-money stake to play',480,444,16,'#dfd7ba');
 },{label:`Animated ${game} table showing the actual saved outcome`});
}

export function scratchArt(ticket:ScratchTicket,onReveal:(panel:number)=>void) {
 const design=scratchDesign(ticket.design);
 const coating=document.createElement('canvas');coating.width=960;coating.height=480;const c=coating.getContext('2d')!;
 for(let i=0;i<3;i++)if(!(ticket.mask&(1<<i))){const x=147+i*230;const grad=c.createLinearGradient(x,170,x+190,340);grad.addColorStop(0,'#f6e8b5');grad.addColorStop(.5,'#8ca4a0');grad.addColorStop(1,'#d4d5ba');c.fillStyle=grad;c.fillRect(x,174,190,166);sceneText(c,'SCRATCH',x+95,254,18,'#29483f');sceneText(c,'✦',x+95,304,27,'#e9e2c2');}
 const reveal=(i:number)=>{if(ticket.mask&(1<<i))return;c.clearRect(147+i*230,174,190,166);onReveal(i);};
 let last:{x:number,y:number}|null=null,coin:{x:number,y:number}|null=null;
 const stage=canvasStage((g,t,reduced)=>{
  felt(g);g.fillStyle=`hsla(${design.hue},27%,20%,.8)`;g.fillRect(0,0,960,480);for(let i=0;i<24;i++){g.strokeStyle=design.accent+'33';g.beginPath();const xx=(i*83+design.pattern*19)%960,yy=(i*149)%480;if(design.pattern%2)g.rect(xx,yy,26+design.pattern*3,26);else g.arc(xx,yy,12+design.pattern*2,0,7);g.stroke();}sceneText(g,design.name.toUpperCase(),480,80,30,design.accent);sceneText(g,'MATCH THREE · REVEAL YOUR LITTLE FORTUNE',480,120,16,'#bbd6c6');
  for(let i=0;i<3;i++){roundBox(g,143+i*230,170,198,174,17,'#0a302a','#e7c67a');sceneText(g,design.symbols[ticket.symbols[i]],242+i*230,281,68,'#f3d278');}
  g.drawImage(coating,0,0);if(coin){g.fillStyle='#f4d174';g.beginPath();g.arc(coin.x,coin.y,16,0,7);g.fill();g.strokeStyle='#9f773b';g.stroke();}
  sceneText(g,ticket.paid?(ticket.payout?`YOU WON $${ticket.payout.toFixed(2)}!`:'A little suspense. Try another ticket.'):'Rub the silver panels with your finger or mouse',480,404,19,ticket.payout&&ticket.paid?'#e8d182':'#bfd6cc');
  if(ticket.paid&&ticket.payout&&!reduced)for(let i=0;i<30;i++){g.fillStyle=['#edcf7c','#96d0b3','#e49e8d'][i%3];g.fillRect((i*149)%960,(t*70+i*31)%480,5,8);}
 },{label:'Interactive scratchcard. Rub all three panels or press Enter to reveal.',key:()=>{for(let i=0;i<3;i++)reveal(i);},pointer:p=>{
  coin={x:p.x,y:p.y};if(p.type==='up'){last=null;return;}if(!p.down)return;
  c.globalCompositeOperation='destination-out';c.lineWidth=42;c.lineCap='round';c.beginPath();c.moveTo(last?.x??p.x,last?.y??p.y);c.lineTo(p.x,p.y);c.stroke();c.globalCompositeOperation='source-over';last={x:p.x,y:p.y};
  for(let i=0;i<3;i++){if(ticket.mask&(1<<i))continue;const pixels=c.getImageData(147+i*230,174,190,166).data;let clear=0;for(let j=3;j<pixels.length;j+=64)if(pixels[j]<30)clear++;if(clear/(pixels.length/64)>.48)reveal(i);}
 }});
 return stage;
}
