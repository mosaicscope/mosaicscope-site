import type {Simulation} from './Simulation';
import type {Character,Vehicle} from '../entities/types';
import {Phys} from '../entities/types';
import {makeVehicle,snapToLane,unseat,seat} from './Traffic';
import {forceGoal} from '../ai/brain';
import {hospitalise} from './Life';
import {needsMedicalResponse} from '../content/damageModels';
function release(sim:Simulation,v:Vehicle):void{
 if(v.driver>=0&&sim.chars[v.driver])unseat(sim,v);
 v.rescueTarget=undefined;v.rescueAt=undefined;v.rescueMedic=undefined;v.siren=false;v.state='parked';v.speed=0;v.vx=v.vy=0;
}
/** Four responding vehicles at most; further casualties stay in the triage queue. */
export function sendAmbulance(sim:Simulation,c:Character):void{
 if(sim.vehicles.some(v=>v.rescueTarget===c.id)||sim.vehicles.filter(v=>v.rescueTarget!==undefined).length>=4)return;
 let v=sim.vehicles.filter(v=>v.cls==='ambulance'&&v.owner!==sim.playerId&&v.driver<0&&v.rescueTarget===undefined&&!v.burning&&!v.burnt&&v.damage<.5).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];
 if(!v){const h=sim.world.buildings.find(b=>b.kind==='hospital'),origin=h?.door??c;let best:{x:number;y:number;d:number}|undefined;
  for(let y=Math.max(1,Math.floor(origin.y)-24);y<Math.min(sim.world.size-1,origin.y+24);y++)for(let x=Math.max(1,Math.floor(origin.x)-24);x<Math.min(sim.world.size-1,origin.x+24);x++){if(!sim.world.drivable(x+.5,y+.5))continue;const d=Math.hypot(x-origin.x,y-origin.y);if(!best||d<best.d)best={x:x+.5,y:y+.5,d};}
  if(!best)return;v=makeVehicle(sim,'ambulance',best.x,best.y,0,'parked');
 }
 const ox=v.x,oy=v.y;
 let aligned=false;
 for(let dir=0;dir<4&&!aligned;dir++){v.x=ox;v.y=oy;v.heading=dir*Math.PI/2;aligned=snapToLane(sim,v);}
 if(!aligned){let best:{x:number;y:number;d:number}|undefined;
  for(let y=Math.max(1,Math.floor(oy)-24);y<Math.min(sim.world.size-1,oy+24);y++)for(let x=Math.max(1,Math.floor(ox)-24);x<Math.min(sim.world.size-1,ox+24);x++){
   if(!(sim.world.isRoadLine(x)||sim.world.isRoadLine(y))||!sim.world.drivable(x+.5,y+.5))continue;
   const d=Math.hypot(x-ox,y-oy);if(!best||d<best.d)best={x:x+.5,y:y+.5,d};
  }
  if(!best)return;v.x=v.px=best.x;v.y=v.py=best.y;v.heading=sim.world.isRoadLine(Math.floor(best.x))?Math.PI/2:0;
  if(!snapToLane(sim,v))return;
 }
 v.px=v.x;v.py=v.y;
 const crew=sim.chars.filter(m=>m.role==='medic'&&m.phys===Phys.OK&&m.id!==c.id&&m.inside<0&&m.inCar<0&&Math.hypot(m.x-v.x,m.y-v.y)<20&&!sim.vehicles.some(a=>a.rescueMedic===m.id)).sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0];
 if(crew){seat(sim,crew,v);v.rescueMedic=crew.id;}
 v.rescueTarget=c.id;v.rescueAt=undefined;v.siren=true;v.state='drive';v.stuck=0;
 sim.emit({type:'ambulance',x:c.x,y:c.y,actors:[c.id],summary:`Ambulance dispatched for ${c.name}. Paramedics are on the way.`});
}
/** A nearby team treats at the scene; blocked routes retain a guaranteed nonfatal hospital fallback. */
export function updateMedicalResponses(sim:Simulation):void{
 for(const [id,deadline]of sim.pendingAmbulance){const c=sim.chars[id],v=sim.vehicles.find(v=>v.rescueTarget===id);
  if(!c||!needsMedicalResponse(c)){sim.pendingAmbulance.delete(id);if(v)release(sim,v);continue;}
  if(!v)sendAmbulance(sim,c);
  if(v&&!v.rescueAt&&Math.hypot(v.x-c.x,v.y-c.y)<8){v.state='parked';v.speed=0;v.vx=v.vy=0;v.siren=false;v.rescueAt=sim.tick+60*10;
   const driver=v.driver>=0?unseat(sim,v):null;
   const medic=driver??sim.chars.filter(m=>m.role==='medic'&&m.phys===Phys.OK&&m.id!==c.id&&m.inside<0&&m.inCar<0&&Math.hypot(m.x-v.x,m.y-v.y)<16&&!sim.vehicles.some(a=>a.rescueMedic===m.id)).sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0];
   if(medic){v.rescueMedic=medic.id;forceGoal(medic,sim,'treat',{u:2,target:c.id});}
   sim.emit({type:'ambulance',x:c.x,y:c.y,actors:medic?[medic.id,c.id]:[c.id],summary:`Paramedics arrived to stabilise ${c.name}.`});
  }
  if(sim.tick>=deadline||v?.rescueAt!==undefined&&sim.tick>=v.rescueAt){hospitalise(sim,c);sim.pendingAmbulance.delete(id);if(v)release(sim,v);}
 }
}
