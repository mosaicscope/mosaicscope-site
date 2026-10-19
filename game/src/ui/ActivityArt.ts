import { canvasStage, felt, playingCard, die, roundBox, sceneText } from './CanvasStage';
import type { ExpansionState } from '../sim/Expansion';
import type { ArcadeResult, ScratchTicket } from '../sim/Arcade';

export function creature(g:CanvasRenderingContext2D,x:number,y:number,kind:string,t:number,size=1,color='#b8754c') {
  g.save(); g.translate(x,y);g.scale(size,size);
  const bird=/Chick|Duck|Chook/.test(kind), sheep=/Sheep|Alpaca/.test(kind), horse=/horse|Horse|race|Trainer/.test(kind);
  g.fillStyle='#142d2930';g.beginPath();g.ellipse(0,9,46,12,0,0,7);g.fill();
  g.strokeStyle=color;g.lineWidth=horse?8:5;g.lineCap='round';
  for(let i=0;i<(bird?2:4);i++){const a=Math.sin(t*6+i*2)*8;g.beginPath();g.moveTo(-25+i*(bird?24:16),-8);g.lineTo(-25+i*(bird?24:16)+a,10);g.stroke();}
  g.fillStyle=sheep?'#f5e8cc':color;g.beginPath();g.ellipse(-4,-25,bird?22:40,bird?23:22,0,0,7);g.fill();
  if(/cattle/.test(kind)){g.fillStyle='#38423b';for(let i=0;i<3;i++){g.beginPath();g.ellipse(-23+i*20,-27,8,12,i,0,7);g.fill();}}
  if(sheep)for(let i=0;i<9;i++){g.beginPath();g.arc(-32+i*7,-36+Math.sin(i)*7,12,0,7);g.fill();}
  g.strokeStyle=color;g.lineWidth=horse?17:13;g.beginPath();g.moveTo(24,-28);g.lineTo(35,horse?-65:-43);g.stroke();
  g.fillStyle=color;g.beginPath();g.ellipse(42,horse?-64:-43,horse?19:14,11,.2,0,7);g.fill();
  g.beginPath();g.moveTo(32,horse?-71:-50);g.lineTo(32,horse?-86:-63);g.lineTo(41,horse?-71:-50);g.fill();
  g.fillStyle='#142821';g.beginPath();g.arc(45,horse?-67:-46,2.5,0,7);g.fill();
  if(/Goat|Deer/.test(kind)){g.strokeStyle='#d9c599';g.lineWidth=3;for(let i=0;i<2;i++){g.beginPath();g.moveTo(31+i*9,-49);g.lineTo(27+i*13,-74);g.lineTo(20+i*23,-79);g.stroke();}}
  if(/Pig/.test(kind)){g.fillStyle='#e5a39b';g.beginPath();g.ellipse(54,-40,9,7,0,0,7);g.fill();g.fillStyle='#875c51';g.fillRect(51,-43,2,3);g.fillRect(57,-43,2,3);}
  if(bird){g.fillStyle='#edbe48';g.beginPath();g.moveTo(54,-45);g.lineTo(69,-40);g.lineTo(54,-36);g.fill();g.fillStyle='#db5550';g.beginPath();g.arc(36,-59,7,0,7);g.fill();}
  if(horse){g.strokeStyle='#392d2c';g.lineWidth=6;g.beginPath();g.moveTo(-39,-30);g.quadraticCurveTo(-63,-35,-53,-8+Math.sin(t*4)*8);g.stroke();}
  g.restore();
}

export function countryside(s:ExpansionState,mode:'farm'|'horse'|'campus',click?:(x:number,y:number)=>void) {
 return canvasStage((g,t,reduced)=>{
  if(reduced)t=0;
  const sky=g.createLinearGradient(0,0,0,480);sky.addColorStop(0,'#94cad2');sky.addColorStop(.5,'#e7e5be');sky.addColorStop(.51,'#849d57');sky.addColorStop(1,'#385c44');g.fillStyle=sky;g.fillRect(0,0,960,480);
  g.fillStyle='#fff3b7';g.beginPath();g.arc(803,71,32,0,7);g.fill();
  for(let i=0;i<5;i++){g.fillStyle=i%2?'#839d96':'#658c83';g.beginPath();g.moveTo(i*260-150,245);g.lineTo(i*260+20,100+i%2*25);g.lineTo(i*260+230,245);g.fill();}
  if(mode==='campus'){
   const names=['LIBRARY','LECTURE HALL','EXAM STUDIO','STUDENT CAFE'];
   names.forEach((n,i)=>{const x=50+i*225,y=174+(i%2)*55;roundBox(g,x,y,190,145,8,i%2?'#a67157':'#c6b9a0');g.fillStyle='#345b59';g.fillRect(x+12,y+20,166,62);for(let j=0;j<5;j++){g.fillStyle='#b8dfca';g.fillRect(x+20+j*32,y+28,20,46);}g.fillStyle='#294847';g.fillRect(x+78,y+95,35,50);sceneText(g,n,x+95,y-12,15,'#173d37');});
   for(let i=0;i<9;i++){roundBox(g,292+i*43,440,31,9,4,i<s.credits?'#eed17f':'#d1dfbd44');}
   sceneText(g,s.degree?`${s.degree.toUpperCase()} · ${s.credits} COURSE CREDITS`:'ILAM CAMPUS · YOUR NEXT CHAPTER',480,416,22);
   for(let i=0;i<7;i++){const x=(i*143+t*18)%900+25,y=365+Math.sin(i)*20;g.fillStyle=['#edc36b','#d9877e','#85c5c0'][i%3];g.fillRect(x,y-19,10,21);g.fillStyle='#e5c7a2';g.beginPath();g.arc(x+5,y-26,6,0,7);g.fill();}
  }else{
   roundBox(g,60,160,170,120,3,'#a24e41');g.fillStyle='#654838';g.beginPath();g.moveTo(40,160);g.lineTo(145,95);g.lineTo(250,160);g.fill();g.fillStyle='#3a3930';g.fillRect(110,205,65,75);
   for(let y=310;y<=450;y+=140){g.strokeStyle='#e6d3a1';g.lineWidth=6;g.beginPath();g.moveTo(20,y);g.lineTo(940,y);g.stroke();for(let x=20;x<960;x+=65){g.fillStyle='#e5d3a6';g.fillRect(x,y-18,6,48);}}
   if(mode==='horse'){
    creature(g,480,355,'Horse',s.horse&&s.horse.fitness>35?t:0,2,s.horse?'#a76942':'#73866b');
    sceneText(g,s.horse?s.horse.name:'YOUR STABLE AWAITS',480,76,28,'#183f38');
    if(s.horse){sceneText(g,`FITNESS ${s.horse.fitness}%  •  SKILL ${s.horse.skill}%  •  ${s.horse.wins} WINS`,480,428,19);for(let i=0;i<Math.min(8,s.horse.wins);i++){g.fillStyle='#f4cf61';g.beginPath();g.arc(745+i%4*40,195+Math.floor(i/4)*45,13,0,7);g.fill();}}
   }else{
    let index=0;for(const [kind,count]of Object.entries(s.animals))for(let n=0;n<Math.min(count,12)&&index<28;n++,index++){
     const x=290+(index%7)*88+Math.sin(t*.4+index)*13,y=290+Math.floor(index/7)*39;
     if(kind==='Beehives'){roundBox(g,x,y-28,31,30,2,'#dfb55f');sceneText(g,'•',x+Math.sin(t*3)*20,y-40,15,'#ecce69');}
     else creature(g,x,y,kind,t+index,.65,['#b37d55','#ddd9c4','#5b5c54'][index%3]);
    }
    sceneText(g,s.farm?'CANTERBURY · YOUR LIVING FARM':'A LITTLE LAND. A BIG NEW LIFE.',480,64,25,'#173f36');
    if(!index)sceneText(g,s.farm?'Add your first animals below':'Buy a lifestyle block to bring this paddock to life',570,349,17,'#ecf3d8');
    if(s.machines.includes('Tractor')){roundBox(g,90,340,90,40,4,'#d3a43e');roundBox(g,132,302,40,45,3,'#8ebabb');for(const x of[112,170]){g.fillStyle='#28362f';g.beginPath();g.arc(x,383,21,0,7);g.fill();}}
    if(s.feed>0){roundBox(g,740,408,110,17,3,'#657c81');g.fillStyle='#b8ce83';g.fillRect(744,408,Math.min(102,s.feed),5);}
    sceneText(g,s.farmCare>=0?'Stock cared for · fresh water & feed':'Check your animals and water troughs daily',480,465,15);
   }
  }
 },{label:mode==='farm'?'Living farm: purchased animals grazing in paddocks':mode==='horse'?'Your racehorse and its current fitness':'Interactive university campus',pointer:click?p=>{if(p.type==='up')click(p.x,p.y);}:undefined});
}

export function casinoArt(game:string,result:()=>ArcadeResult|undefined,state:()=>ExpansionState,tick:()=>number) {
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
   g.save();g.translate(480,253);g.rotate(rotation);
   for(let i=0;i<24;i++){g.beginPath();g.moveTo(0,0);g.arc(0,0,154,i*Math.PI/12,(i+1)*Math.PI/12);g.fillStyle=['#183f3b','#bd9760','#315d51','#b6605b'][i%4];g.fill();g.strokeStyle='#ead49a';g.stroke();g.save();g.rotate((i+.5)*Math.PI/12);sceneText(g,String(i<12?'—':i<18?'2×':i<21?'3×':i<23?'5×':'8×'),119,5,17);g.restore();}g.restore();
   g.fillStyle='#f7d783';g.beginPath();g.moveTo(465,80);g.lineTo(495,80);g.lineTo(480,113);g.fill();roundBox(g,459,232,42,42,20,'#ead39c');
  }else if(game==='Keno'){
   for(let i=0;i<10;i++){const visible=reduced||t>i*.18;const x=164+i%5*157,y=196+Math.floor(i/5)*112;if(!visible)continue;g.fillStyle=v[i]?'#e7ca85':'#607b70';g.beginPath();g.arc(x,y-((1-ease)*100),37,0,7);g.fill();sceneText(g,String(v[i]||'?'),x,y+7,23,'#173c34');}
  }else if(game==='Crash'){
   const f=state().casino.crash,elapsed=f?Math.max(0,(tick()-f.start)/60):0,m=f?.paid&&r?.game==='Crash'?r.values[0]:Math.exp(elapsed*.2),bust=!!f&&m>=f.bust;
   g.strokeStyle='#7ecfb2';g.lineWidth=4;g.beginPath();g.moveTo(90,365);const end=Math.min(1,elapsed/12),stop=f?Math.min(end,Math.log(f.bust)/.2/12):.2;
   for(let x=0;x<=stop;x+=.005)g.lineTo(90+x*760,365-Math.pow(x,1.5)*260);g.stroke();
   const px=90+stop*760,py=365-Math.pow(stop,1.5)*260;sceneText(g,bust?'✹':'✈',px,py,45,bust?'#ed8a79':'#edd18b');sceneText(g,f?`${bust?'CRASHED ':f.paid?'COLLECTED ':'LIVE '}${Math.min(m,f.bust).toFixed(2)}×`:'READY FOR TAKEOFF',480,200,36,bust?'#f08c80':'#eddaab');
  }else if(game==='Scratchies'){sceneText(g,'LUCKY PŪKEKO',480,145,34,'#edce86');for(let i=0;i<3;i++){roundBox(g,147+i*230,180,190,155,16,'#a7b6a1','#f2dc9f');sceneText(g,'✦',242+i*230,275,50,'#f5e6b6');}sceneText(g,'Buy a ticket below. Rub to reveal.',480,390,19);
  }else{
   for(let i=0;i<4;i++){const x=225+i*170;playingCard(g,x,238,1+i*3,['♠','♦','♣','♥'][i],1,.9);roundBox(g,x-46,322,92,28,12,'#b49459');sceneText(g,['MIRI','BAZ','AROHA','DALE'][i],x,342,14,'#142f28');}
  }
  sceneText(g,r?.game===game?r.result:'Place a game-money stake to play',480,444,16,'#dfd7ba');
 },{label:`Animated ${game} table showing the actual saved outcome`});
}

export function scratchArt(ticket:ScratchTicket,onReveal:(panel:number)=>void) {
 const coating=document.createElement('canvas');coating.width=960;coating.height=480;const c=coating.getContext('2d')!;
 for(let i=0;i<3;i++)if(!(ticket.mask&(1<<i))){const x=147+i*230;const grad=c.createLinearGradient(x,170,x+190,340);grad.addColorStop(0,'#f6e8b5');grad.addColorStop(.5,'#8ca4a0');grad.addColorStop(1,'#d4d5ba');c.fillStyle=grad;c.fillRect(x,174,190,166);sceneText(c,'SCRATCH',x+95,254,18,'#29483f');sceneText(c,'✦',x+95,304,27,'#e9e2c2');}
 const reveal=(i:number)=>{if(ticket.mask&(1<<i))return;c.clearRect(147+i*230,174,190,166);onReveal(i);};
 let last:{x:number,y:number}|null=null,coin:{x:number,y:number}|null=null;
 const stage=canvasStage((g,t,reduced)=>{
  felt(g);sceneText(g,'LUCKY PŪKEKO',480,80,38,'#f0d58a');sceneText(g,'MATCH THREE · REVEAL YOUR LITTLE FORTUNE',480,120,16,'#bbd6c6');
  for(let i=0;i<3;i++){roundBox(g,143+i*230,170,198,174,17,'#0a302a','#e7c67a');sceneText(g,['♛','◆','✦','☘','♥','☀'][ticket.symbols[i]],242+i*230,281,68,'#f3d278');}
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
