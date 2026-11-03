import type {Character} from '../entities/types';
import {AIRCRAFT} from '../content/aircraft';
import {pose,solve,drawFigure} from '../render/StickFigure';
import {flightMultiplier,flightPreferences,FLIGHT_ROUTES,type CrashFlight,type FlightPreferences} from '../casino/flight';
import {roundBox,sceneText} from './CanvasStage';
export const FLIGHT_W=1200,FLIGHT_H=700;
const wrap=(n:number,s:number)=>((n%s)+s)%s;
/** The casino's own cartoon skyline. Flight scenery never influences the random result. */
export function drawCrashFlight(g:CanvasRenderingContext2D,f:CrashFlight|undefined,model:number,scene:number,people:readonly Character[],time:number,reduced:boolean,W=FLIGHT_W,H=FLIGHT_H,raw?:FlightPreferences,replaySeconds?:number):void{
 const prefs=flightPreferences(raw),now=replaySeconds===undefined?Date.now():(f?.start??0)+replaySeconds*1000,seconds=f?Math.max(0,((f.endedAt===undefined?now:Math.min(now,f.endedAt))-f.start)/1000):0,settled=!!f?.paid&&now>=(f.endedAt??now),lost=settled&&f?.outcome==='crashed',moving=!!f&&!settled,mult=f?flightMultiplier({...f,endedAt:settled?f.endedAt:undefined},now):1,t=reduced?0:time,night=prefs.day==='night',sunset=prefs.day==='sunset',route=FLIGHT_ROUTES[f?.scene??scene]??FLIGHT_ROUTES[0],aircraft=AIRCRAFT[f?.model??model]??AIRCRAFT[0],theme=f?.scene??scene;
 const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,night?'#1d2740':sunset?'#655570':'#7299aa');sky.addColorStop(1,night?'#706575':sunset?'#e1aa83':'#d2d2bc');g.fillStyle=sky;g.fillRect(0,0,W,H);
 g.fillStyle=night?'#e9dec0':'#f4d798';g.beginPath();g.arc(W*.81,H*.2,night?20:36,0,Math.PI*2);g.fill();
 const scroll=seconds*45;if([1,3,7].includes(theme)){g.fillStyle=night?'#293f51':'#729aa0';g.fillRect(0,H*.72,W,H*.28);}if([2,4,5,6].includes(theme)){g.fillStyle=theme===4?'#a88a70':'#7e9290';g.beginPath();g.moveTo(0,H*.7);for(let x=0;x<=W+100;x+=140)g.lineTo(x,H*(.48+wrap(x/140*17,8)/100));g.lineTo(W,H);g.lineTo(0,H);g.fill();}for(let layer=0;layer<3;layer++){const base=H*(.68+layer*.065),unit=layer?100:145;for(let i=-1;i<W/unit+2;i++){const x=i*unit-wrap(scroll*(.2+layer*.16),unit),height=55+wrap(i*61+layer*37,120);g.fillStyle=['#65767a','#536868','#354e50'][layer];g.fillRect(x,base-height,unit-9,height+H*.2);g.fillStyle=night?'#e9c986':'#a9c0bc';for(let row=0;row<height/24;row++)for(let col=0;col<4;col++)if(wrap(i+row+col,4)!==0)g.fillRect(x+10+col*18,base-height+10+row*20,6,8);}}
 const pad=22;roundBox(g,pad,pad,W-pad*2,90,12,'#171e20ee','#d2bc86');sceneText(g,'THE MOSAICS  /  SKYLINE',pad+24,57,19,'#e5d4ae','left');sceneText(g,route+' · '+aircraft.name+' · '+(f?.practice?'PRACTICE':'GAME CHIPS'),pad+24,86,14,'#aabbb2','left');sceneText(g,lost?'FLIGHT ENDED':'×'+mult.toFixed(2),W-pad-25,82,42,lost?'#ef8b76':'#e9d69d','right');
 const px=W*.5,py=H*.48+(moving&&!reduced?Math.sin(t*2)*3:0)+(lost?Math.min(80,(now-(f?.endedAt??now))/70):0),scale=Math.min(W/1200,H/700),pilot=people.find(c=>c.tier==='player')??people[0];
 g.save();g.translate(px,py);g.scale(scale,scale);g.rotate(lost?.18:-.06);
 if(moving&&prefs.effects){g.fillStyle='#ff9b4b99';g.beginPath();g.moveTo(-160,-3);g.lineTo(-235-(reduced?0:Math.sin(t*13)*20),14);g.lineTo(-160,24);g.fill();}
 g.fillStyle=aircraft.color;g.strokeStyle='#25242a';g.lineWidth=5;g.beginPath();g.moveTo(-175,-8);g.quadraticCurveTo(-80,-40,95,-32);g.lineTo(166,-4);g.quadraticCurveTo(118,27,-130,30);g.closePath();g.fill();g.stroke();
 g.fillStyle='#dc514c';g.beginPath();g.moveTo(-32,4);g.lineTo(-110,75);g.lineTo(-32,70);g.lineTo(40,18);g.closePath();g.fill();g.stroke();
 g.fillStyle='#445d70';g.beginPath();g.ellipse(20,-30,60,29,0,0,Math.PI*2);g.fill();g.stroke();
 if(pilot){g.save();g.beginPath();g.ellipse(20,-31,54,25,0,0,Math.PI*2);g.clip();const a=pose('sit',pilot.style,t,t*5+pilot.seedPhase,0,0);solve(a,20,48,.9,1);drawFigure(g,pilot,20,48,.9,1,t,0,1,false);g.restore();}
 g.fillStyle=aircraft.color;g.fillRect(116,-15,27,17);g.strokeRect(116,-15,27,17);g.fillStyle='#d64d4c';g.beginPath();g.moveTo(-145,-10);g.lineTo(-174,-56);g.lineTo(-123,-42);g.lineTo(-95,-13);g.fill();g.stroke();g.restore();
 if(prefs.weather!=='clear'&&prefs.effects){g.strokeStyle='#dbe6df88';g.fillStyle='#eef3e6bb';g.lineWidth=1.5;g.beginPath();for(let i=0;i<60;i++){const x=wrap(i*157-(reduced?0:t*55),W),y=wrap(i*97+(reduced?0:t*(prefs.weather==='snow'?22:200)),H);if(prefs.weather==='snow'){g.moveTo(x+2,y);g.arc(x,y,2,0,Math.PI*2);}else{g.moveTo(x,y);g.lineTo(x-5,y+11);}}prefs.weather==='snow'?g.fill():g.stroke();}
 const text=!f?'Choose a stake and take flight':settled?(lost?'ROUND OVER':f.practice?'PRACTICE LANDING':'CASHED OUT'):'CASH OUT BEFORE THE FLIGHT ENDS';
 sceneText(g,text,W/2,H*.72,Math.max(17,24*scale),lost?'#ffb5a3':'#f4e5c4');
 if(f&&settled)sceneText(g,f.practice?'Practice · no chips at risk':lost?'Stake lost · $'+f.stake:'Return · $'+(f.returned??0).toLocaleString('en-NZ'),W/2,H*.77,18,'#efe5ca');
 roundBox(g,24,H-76,W-48,52,9,'#20292ae9','#bfae8055');sceneText(g,'PLAY CHIPS ONLY  ·  OUTCOMES ARE RANDOM',W/2,H-43,14,'#d4ccb6');
}

