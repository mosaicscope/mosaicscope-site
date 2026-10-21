import type {Character} from '../entities/types';
import type {PokerTable} from '../casino/holdem';
import {pose,solve,drawFigure,J} from '../render/StickFigure';
import {roundBox,playingCard,sceneText} from './CanvasStage';
interface Seat{x:number;y:number;cx:number;cy:number;dir:number}
function seats(t:PokerTable):Seat[]{
 if(t.seats.length===4)return[{x:480,y:554,cx:552,cy:503,dir:1},{x:146,y:371,cx:225,cy:323,dir:1},{x:480,y:215,cx:478,cy:235,dir:1},{x:814,y:371,cx:735,cy:323,dir:-1}];
 return t.seats.map((_,i)=>{const a=Math.PI/2+i/t.seats.length*Math.PI*2,x=480+Math.cos(a)*340,y=Math.max(250,330+Math.sin(a)*220);return{x,y,cx:x-Math.cos(a)*55,cy:y-48,dir:Math.cos(a)>0?-1:1};});
}
export function pokerSeatAt(t:PokerTable,x:number,y:number):number{const all=seats(t);let picked=-1;all.forEach((s,i)=>{if(Math.hypot(x-s.x,y-(s.y-60))<43||Math.abs(x-s.cx)<58&&Math.abs(y-s.cy)<42)picked=i;});return picked;}
/** World-native characters and flat-lit furniture; cards and chips are placed on the table plane. */
export function drawPokerTable(g:CanvasRenderingContext2D,t:PokerTable,people:readonly Character[],time:number,reduced:boolean,age:number,selected:number):void{
 const W=960,H=600,all=seats(t),money=(n:number)=>'$'+Math.round(n).toLocaleString('en-NZ');
 const polygon=(pts:number[][],col:string,edge?:string)=>{g.fillStyle=col;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=1;g.stroke();}};
 const ellipse=(x:number,y:number,rx:number,ry:number,fill:string,stroke?:string,width=1)=>{g.fillStyle=fill;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}};
 const stack=(x:number,y:number,n:number,colour:string)=>{for(let i=0;i<Math.min(11,Math.ceil(n));i++){ellipse(x,y-i*3,9,3.8,colour,'#dfd4aa77',.7);g.strokeStyle='#e4dab8';g.lineWidth=1;g.beginPath();g.moveTo(x-7,y-i*3);g.lineTo(x-4,y-i*3);g.moveTo(x+4,y-i*3);g.lineTo(x+7,y-i*3);g.stroke();}};
 const chair=(s:Seat)=>{ellipse(s.x,s.y+10,29,10,'#10181566');polygon([[s.x-20,s.y-30],[s.x-15,s.y+6],[s.x-11,s.y+8],[s.x-13,s.y-27]],'#6c6350');polygon([[s.x+20,s.y-30],[s.x+15,s.y+6],[s.x+11,s.y+8],[s.x+13,s.y-27]],'#6c6350');roundBox(g,s.x-24,s.y-74,48,44,8,'#34423a','#a2926e');for(let j=-1;j<=1;j++)roundBox(g,s.x+j*11-3,s.y-66,6,26,3,'#435047');ellipse(s.x,s.y-30,26,11,'#626951','#b1a281');};
 const character=(i:number,frontArms=false)=>{const a=t.seats[i],s=all[i],c=people.find(c=>c.id===a.id);if(!c)return;const doing=t.winners.includes(i)?'cheer':t.actor===i&&t.phase==='betting'?'bet':'sit';solve(pose(doing,'normal',reduced?0:time,0,0,0),s.x,s.y,.65,s.dir);if(frontArms){for(const n of[8,12]){g.lineCap='round';g.strokeStyle='#1d2922';g.lineWidth=3;g.beginPath();g.moveTo(J[n],J[n+1]);g.lineTo(J[n+2],J[n+3]);g.stroke();g.strokeStyle='#ded7bd';g.lineWidth=1.6;g.stroke();}return;}g.save();drawFigure(g,c,s.x,s.y,.65,s.dir,time,0,1);g.restore();};
 g.fillStyle='#282d27';g.fillRect(0,0,W,H);
 for(let row=-2;row<13;row++)for(let col=-2;col<16;col++){const x=col*85+(row%2)*42.5,y=row*36+135;polygon([[x,y],[x+42.5,y-18],[x+85,y],[x+42.5,y+18]],(row+col)%2?'#333a2f':'#30372d','#46503b55');}
 g.fillStyle='#252e27';g.fillRect(0,0,W,126);g.fillStyle='#303b30';g.fillRect(0,94,W,25);g.fillStyle='#8d8161';g.fillRect(0,117,W,3);
 for(let x=35;x<960;x+=90){roundBox(g,x,38,62,63,3,'#2d382d','#53604a');g.fillStyle='#928567';g.fillRect(x+5,43,52,2);}
 for(const x of[115,845]){polygon([[x-18,37],[x,20],[x+18,37],[x+12,60],[x-12,60]],'#b5a276','#d9c699');g.fillStyle='#d5c69b';g.fillRect(x-2,60,4,26);}
 sceneText(g,'THE TESSERA',480,45,22,'#d8c49a');sceneText(g,t.mode==='tournament'?'SIT & GO · HAND '+t.round:'TEXAS HOLD’EM · HAND '+t.round,480,70,12,'#c5bda4');
 const back=all.map((s,i)=>({s,i})).filter(a=>a.s.y<300);for(const a of back){chair(a.s);character(a.i);}const dealer=people.find(c=>c.phys===0&&c.tier!=='player'&&!t.seats.some(s=>s.id===c.id));let dealerArms:number[]=[];if(dealer){solve(pose('deal','normal',reduced?0:time,0,0,0),680,240,.56,-1);g.save();drawFigure(g,dealer,680,240,.56,-1,time,0,1);g.restore();dealerArms=Array.from(J.slice(8,16));roundBox(g,659,151,43,15,3,'#252f27','#9c926d');sceneText(g,'DEALER',680,162,8,'#d8c69e');}
 // A pedestal, bevelled timber skirt, padded rail and separate baize surface give the table weight.
 ellipse(480,472,335,63,'#121b1666');polygon([[360,383],[387,488],[423,499],[403,377]],'#4c4838','#74674b');polygon([[557,377],[537,499],[574,488],[600,383]],'#62533b','#74674b');
 ellipse(480,344,354,143,'#3d392c','#191f1b',2);ellipse(480,330,354,143,'#6c5940','#b7a078',2);ellipse(480,317,353,140,'#2c3c31','#b9a77d',2);ellipse(480,316,331,120,'#42604a','#627a57',1.5);
 // Quiet felt texture and stitched betting line stay in the same subdued game palette.
 g.save();g.beginPath();g.ellipse(480,316,328,117,0,0,Math.PI*2);g.clip();for(let i=0;i<220;i++){g.fillStyle=i%2?'#b6c1a10a':'#132c220d';g.fillRect(160+(i*73)%650,202+(i*37)%228,2,1);}g.restore();
 g.strokeStyle='#b3b08a77';g.lineWidth=1;g.setLineDash([3,4]);g.beginPath();g.ellipse(480,318,294,91,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
 // Dealer tray, cut card and shoe are physical props, followed by the actual five-card board.
 roundBox(g,558,200,123,28,5,'#28332b','#9c906b');for(let i=0;i<6;i++)stack(572+i*18,219,3+i%3,['#b57b68','#c4b27d','#273d37'][i%3]);
 for(let i=0;i<4;i++)playingCard(g,650+i*1.6,258-i*1.4,2,'♠',0,.3);
 for(let i=0;i<5;i++){roundBox(g,343+i*58,281,47,65,4,'#37513e','#b0b28e44');const c=t.board[i];if(c)playingCard(g,366+i*58,313,c.rank,c.suit,1,.58);}
 if(!reduced&&age<.7&&t.board.length&&t.phase==='betting'){const c=t.board[t.board.length-1],f=Math.min(1,age/.7);g.save();g.translate(650+(366+(t.board.length-1)*58-650)*f,255+58*f);g.rotate((1-f)*.35);playingCard(g,0,0,c.rank,c.suit,f>.5?1:0,.58);g.restore();}
 for(let i=0;i<3;i++)stack(454+i*25,376,Math.min(9,Math.ceil(t.pot/15)-i*4),['#bd856e','#ceb782','#30463b'][i]);sceneText(g,'POT '+money(t.pot),480,405,17,'#e2d4b0');
 if(dealerArms.length){g.lineCap='round';g.strokeStyle='#e3dcc2';g.lineWidth=1.6;for(const n of[0,4]){g.beginPath();g.moveTo(dealerArms[n],dealerArms[n+1]);g.lineTo(dealerArms[n+2],dealerArms[n+3]);g.stroke();}}
 for(let i=0;i<all.length;i++){
  const s=all[i],a=t.seats[i];if(s.y>=300){chair(s);character(i);}else character(i,true);
  a.hand.forEach((c,j)=>playingCard(g,s.cx-18+j*36,s.cy,c.rank,c.suit,i===0||t.phase!=='betting'?1:0,.43));
  if(a.folded){g.save();g.globalAlpha=.65;roundBox(g,s.cx-40,s.cy-11,80,23,3,'#253129');sceneText(g,'FOLDED',s.cx,s.cy+5,10,'#c4bba3');g.restore();}
  const bx=i===0?s.x-60:s.cx+42,by=i===0?s.y-26:s.cy+35;stack(bx,by,Math.min(8,a.stack/10),'#c2aa77');if(a.bet)stack(bx+22,by-12,Math.min(7,a.bet/5),'#b47b69');
  if(i===t.button){ellipse(bx-21,by-5,9,5,'#ddd6b8','#a29a78');sceneText(g,'D',bx-21,by-2,8,'#354335');}
  const ny=s.y-94,label=a.name.split(' ')[0]+' · '+money(a.stack);roundBox(g,s.x-67,ny-13,134,23,5,selected===i?'#5f6046':'#26352cf0',t.actor===i&&t.phase==='betting'?'#d2b77b':'#6e7d59');sceneText(g,label,s.x,ny+2,11,'#e1d5b2');
  if(a.allIn)sceneText(g,'ALL IN',s.x,ny-20,12,'#e3be7d');
 }
 if(!reduced&&t.pot>0&&age<.8){const i=Math.max(0,t.seats.findIndex(a=>(t.log[t.log.length-1]??'').startsWith(a.name))),s=all[i],f=Math.min(1,age/.8);stack(s.cx+(480-s.cx)*f,s.cy+(372-s.cy)*f,3,'#cbb57d');}
 if(t.phase!=='betting'&&t.winners.length){const text=t.winners.map(i=>t.seats[i].name.split(' ')[0]).join(' & ')+' wins';roundBox(g,362,422,236,27,5,'#243a2c','#b5a16d');sceneText(g,text,480,440,14,'#e7d49e');}
}
