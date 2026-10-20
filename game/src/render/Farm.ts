import type {Simulation} from '../sim/Simulation';
import {farmPlot,stockPosition} from '../sim/FarmPlot';
import {animalSprite} from '../ui/VenueArt';
import {drawAnimal,type AnimalKind} from './Animals';
import type {Camera} from './Camera';
export interface FarmObject{x:number;y:number;kind:string;phase:number;name?:string;dir?:number}
export function farmObjects(sim:Simulation,time:number,zoo:readonly{kind:AnimalKind;name:string}[]):FarmObject[]{
 const p=farmPlot(sim.world);if(!p||(!sim.expansion.farm&&!zoo.length))return [];const s=sim.expansion,out:FarmObject[]=[];
 for(let i=0;i<p.size;i++){out.push({x:p.x+i+.5,y:p.y,kind:'fence-x',phase:0},{x:p.x,y:p.y+i+.5,kind:'fence-y',phase:0},{x:p.x+p.size,y:p.y+i+.5,kind:'fence-y',phase:0});if(Math.abs(i-p.size/2)>1)out.push({x:p.x+i+.5,y:p.y+p.size,kind:'fence-x',phase:0});}
 out.push({x:p.x+.9,y:p.y+.9,kind:'barn',phase:s.farm});
 s.machines.forEach((name,i)=>out.push({x:p.x+.9+(i%4)*1.5,y:p.y+1.5+Math.floor(i/4)*.6,kind:'upgrade',phase:i,name}));
 const stock=[...Object.entries(s.animals).flatMap(([name,n])=>Array.from({length:Math.min(8,n)},()=>({kind:name}))),...zoo.map(z=>({kind:'zoo:'+z.kind}))].slice(0,48);
 stock.forEach((animal,i)=>{const v=stockPosition(p,i,time);out.push({...v,kind:animal.kind,phase:v.moving?time*.7+i:0,dir:Math.cos(time*.13+i*2.399)>=0?1:-1});});return out;
}
export function drawFarmObject(g:CanvasRenderingContext2D,cam:Camera,a:FarmObject,time:number):void{
 const p={x:0,y:0};cam.toScreen(a.x,a.y,0,p);const z=cam.zoom;g.save();g.translate(p.x,p.y);
 if(a.kind.startsWith('fence')){const end={x:0,y:0};cam.toScreen(a.x+(a.kind==='fence-x'?.95:0),a.y+(a.kind==='fence-y'?.95:0),0,end);const dx=end.x-p.x,dy=end.y-p.y;g.strokeStyle='#d3c8ad';g.lineWidth=2*z;g.beginPath();g.moveTo(0,0);g.lineTo(0,-14*z);g.moveTo(dx,dy);g.lineTo(dx,dy-14*z);for(const yy of[-5,-11]){g.moveTo(0,yy*z);g.lineTo(dx,dy+yy*z);}g.stroke();}
 else if(a.kind==='barn'){g.scale(z,z);g.fillStyle='#7c5747';g.fillRect(-15,-28,30,28);g.fillStyle='#414d4b';g.beginPath();g.moveTo(-19,-28);g.lineTo(0,-43);g.lineTo(19,-28);g.fill();g.fillStyle='#262f2a';g.fillRect(-7,-18,14,18);g.strokeStyle='#b3a17e';g.strokeRect(-15,-28,30,28);g.fillStyle='#ddd0aa';g.font='7px Arial';g.textAlign='center';g.fillText('MOSAIC FARM',0,-21);}
 else if(a.kind==='upgrade'){g.scale(z,z);g.fillStyle=a.name?.includes('Tractor')?'#6f8760':'#8d8061';g.fillRect(-8,-9,16,9);g.fillStyle='#323c37';g.fillRect(-9,-2,5,5);g.fillRect(4,-2,5,5);if(a.name?.includes('shed')||a.name?.includes('house')){g.fillStyle='#676e62';g.fillRect(-9,-20,18,12);g.fillStyle='#b5a27b';g.fillRect(-11,-23,22,3);}}
 else {g.scale(a.dir??1,1);if(a.kind.startsWith('zoo:'))drawAnimal(g,a.kind.slice(4) as AnimalKind,0,0,z*.42,1,time,a.phase,a.phase?1:0);else animalSprite(g,0,0,a.kind,a.phase,z*.5);}
 g.restore();
}
