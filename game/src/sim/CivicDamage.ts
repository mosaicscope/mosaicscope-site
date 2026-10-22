import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {World} from '../world/World';
import {decorGrid} from '../render/StreetDecor';
import {moveTo,stop} from '../ai/steps';
import {commitCrime} from './Society';
import {VEHICLES} from '../content/vehicles';
export type FacadeMaterial='timber'|'brick'|'glass'|'concrete'|'metal'|'stone';
export function facadeMaterial(kind:string,floors=1):FacadeMaterial{return kind==='house'?'timber':kind==='warehouse'||kind==='garage'?'metal':kind==='office'&&floors>4?'glass':kind==='apartments'||kind==='dairy'||kind==='cafe'?'brick':kind==='church'||kind==='museum'?'stone':'concrete';}
export interface CivicDamage{material?:FacadeMaterial;building?:number;energy?:number;variant?:number;fixture?:string;key:string;kind:'building'|'furniture';x:number;y:number;tx:number;ty:number;face?:'s'|'e'|'n'|'w';severity:number;at:number;crew?:number;phase:'reported'|'travelling'|'working';workUntil?:number;repairBy:number}
const buckets=new WeakMap<World,Map<number,number[]>>();
function poiBuckets(w:World){let b=buckets.get(w);if(b)return b;b=new Map();for(const p of w.pois){if(!['busstop','streetsign','roadsign','lamp','billboard','bench','bin'].includes(p.kind))continue;const key=Math.floor(p.y)*w.size+Math.floor(p.x),a=b.get(key)??[];a.push(p.id);b.set(key,a);}buckets.set(w,b);return b;}
function record(sim:Simulation,v:Pick<Vehicle,"cls"|"driver"|"damage">,key:string,kind:CivicDamage['kind'],x:number,y:number,speed:number,face?:CivicDamage['face']):void{
 const old=sim.world.civicDamage[key];if(old&&sim.tick-old.at<45)return;
 const severity=Math.min(1,(old?.severity??0)+speed*VEHICLES[v.cls].mass*.055),spot=sim.world.nearestWalkable(x,y);
 const d:CivicDamage=old??{key,kind,x:spot.x,y:spot.y,tx:Math.floor(x),ty:Math.floor(y),severity,at:sim.tick,phase:'reported',repairBy:sim.tick+60*180};const building=sim.world.buildingAt(Math.floor(x),Math.floor(y));if(kind==='building'&&building){d.building=building.id;d.material=(['timber','brick','glass','concrete','metal','stone'].includes(building.facadeMaterial??'')?building.facadeMaterial:facadeMaterial(building.kind,building.floors)) as FacadeMaterial;d.energy=speed*speed*VEHICLES[v.cls].mass*.5;d.variant=(building.id*13+d.tx*17+d.ty*23)%12;}d.fixture=kind==='furniture'&&key.startsWith('p:')?sim.world.pois[Number(key.slice(2))]?.kind:undefined;d.face=face;d.severity=severity;d.at=sim.tick;sim.world.civicDamage[key]=d;
 v.damage=Math.min(1,v.damage+severity*.08);sim.bus.emit('fx',{kind:kind==='building'?'dust':'spark',x,y,z:.5,n:Math.min(18,6+Math.round(speed)),color:'#c4b49b'});
 if(!old){sim.emit({type:'property_damage',x,y,actors:v.driver>=0?[v.driver]:[],summary:`${kind==='building'?'Facade impact':'Broken street furniture'} reported. A maintenance crew has been requested.`});if(v.driver===sim.playerId)commitCrime(sim,sim.player,'vandalism',null);}
}
/** Record a facade at the actual impact tile. Masonry remains solid; broken glazing is boarded during repairs. */
export function hitFacade(sim:Simulation,v:Pick<Vehicle,"cls"|"driver"|"damage">,x:number,y:number,speed:number):void{
 for(const [dx,dy]of [[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]]){const tx=Math.floor(x+dx),ty=Math.floor(y+dy),b=sim.world.buildingAt(tx,ty);if(!b)continue;const edges:[CivicDamage['face'],number][]=[['s',Math.abs(ty-b.y1)],['e',Math.abs(tx-b.x1)],['n',Math.abs(ty-b.y0)],['w',Math.abs(tx-b.x0)]];edges.sort((a,b)=>a[1]-b[1]);record(sim,v,`b:${b.id}:${tx}:${ty}`, 'building',tx+.5,ty+.5,speed,edges[0][0]);return;}
}
export function updateCivicDamage(sim:Simulation):void{
 const w=sim.world,b=poiBuckets(w),decor=decorGrid(w);
 for(const v of sim.vehicles){if(v.state!=='free'||Math.abs(v.speed)<1.5)continue;const r=VEHICLES[v.cls].length*.45,fx=v.x+Math.cos(v.heading)*r*Math.sign(v.speed),fy=v.y+Math.sin(v.heading)*r*Math.sign(v.speed);
  for(let y=Math.floor(fy)-1;y<=Math.floor(fy)+1;y++)for(let x=Math.floor(fx)-1;x<=Math.floor(fx)+1;x++){
   if(!w.inBounds(x,y))continue;for(const id of b.get(y*w.size+x)??[]){const p=w.pois[id];if(Math.hypot(p.x-fx,p.y-fy)<.9&&!w.civicDamage[`p:${id}`]){record(sim,v,`p:${id}`,'furniture',p.x,p.y,Math.abs(v.speed));v.speed*=.8;if(v.vx!==undefined)v.vx*=.8;if(v.vy!==undefined)v.vy*=.8;}}
   if(decor[y*w.size+x]&&Math.hypot(x+.5-fx,y+.5-fy)<.75)record(sim,v,`d:${y*w.size+x}`,'furniture',x+.5,y+.5,Math.abs(v.speed));
  }
 }
 const jobs=Object.values(w.civicDamage),reserved=new Set(jobs.map(j=>j.crew).filter(id=>id!==undefined));
 for(const d of jobs){if(sim.tick-d.at<60*8)continue;
  if(d.crew===undefined&&jobs.filter(j=>j.crew!==undefined).length<3){const crew=sim.chars.filter(c=>c.tier!=='player'&&c.inside<0&&c.inCar<0&&c.phys===0&&!reserved.has(c.id)&&(c.role==='mechanic'||c.role==='cleaner')).sort((a,b)=>Math.hypot(a.x-d.x,a.y-d.y)-Math.hypot(b.x-d.x,b.y-d.y))[0];if(crew){d.crew=crew.id;d.phase='travelling';reserved.add(crew.id);crew.goal=null;}}
  const crew=d.crew===undefined?undefined:sim.chars[d.crew];
  if(crew&&crew.phys===0){crew.nextThink=sim.tick+60;if(d.phase==='travelling'&&moveTo(crew,d.x,d.y,sim,1.3,1.2)){d.phase='working';d.workUntil=sim.tick+60*(12+d.severity*18);}
   if(d.phase==='working'){stop(crew);crew.anim.pose='repair';if(sim.tick>=(d.workUntil??Infinity)){crew.anim.pose='auto';crew.nextThink=sim.tick;delete w.civicDamage[d.key];}}
  }
  // An off-screen city maintenance team also resolves inaccessible jobs after three minutes.
  if(sim.tick>=d.repairBy){if(crew){stop(crew);crew.anim.pose='auto';crew.nextThink=sim.tick;}delete w.civicDamage[d.key];}
 }
}
