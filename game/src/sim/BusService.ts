import {forceGoal} from '../ai/brain';
import type {Simulation} from './Simulation';
import type {Vehicle,Character} from '../entities/types';
import type {Poi} from '../world/World';
import {VEHICLES} from '../content/vehicles';
import {mappedPoint} from '../world/MappedWorld';
interface Service {stops:Poi[];exchange:Poi;target:Poi;dwellUntil:number;lastStop:number;visits:number}
const services=new WeakMap<Vehicle,Service>();
export function isServiceBus(v:Vehicle):boolean{return v.cls==='bus'||VEHICLES[v.cls].design?.base==='bus';}
function service(sim:Simulation,v:Vehicle):Service|undefined{
 let state=services.get(v);if(state)return state;
 const stops=sim.world.pois.filter(p=>p.kind==='busstop');if(stops.length<2)return;
 const b=sim.world.buildings.find(b=>/bus (?:exchange|interchange)/i.test(b.name)),venue=sim.world.mapped?.venues.find(v=>/bus (?:exchange|interchange)/i.test(v.name));
 const centre=b?{x:b.door.x,y:b.door.y}:venue&&sim.world.mapped?mappedPoint(sim.world.mapped,venue.point[0],venue.point[1]):undefined;
 if(!centre)return;
 const exchange=stops.reduce((a,p)=>Math.hypot(p.x-centre.x,p.y-centre.y)<Math.hypot(a.x-centre.x,a.y-centre.y)?p:a,stops[0]);
 const other=stops.filter(p=>p.id!==exchange.id).sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0];
 state={stops,exchange,target:other??exchange,dwellUntil:0,lastStop:-1,visits:0};services.set(v,state);return state;
}
export function busDestination(sim:Simulation,v:Vehicle):{x:number;y:number}|undefined{return isServiceBus(v)?service(sim,v)?.target:undefined;}
function passengers(sim:Simulation,v:Vehicle):Character[]{return sim.chars.filter(c=>c.inCar===v.id&&c.id!==v.driver);}
function leave(sim:Simulation,c:Character,stop:Poi):void{
 const p=sim.world.nearestFoot(stop.x+(c.id%3-1)*.5,stop.y+.5,6);c.inCar=-1;c.x=c.px=p.x;c.y=c.py=p.y;c.vx=c.vy=0;c.goal=null;c.path=null;c.nextThink=sim.tick+60;c.anim.pose='auto';
}
/** Short dwell at the mapped stop, using existing people and vehicle state. */
export function serviceBus(sim:Simulation,v:Vehicle):boolean{
 if(!isServiceBus(v)||v.driver<0||v.siren)return false;const state=service(sim,v);if(!state)return false;
 for(const c of passengers(sim,v)){c.x=c.px=v.x;c.y=c.py=v.y;}
 if(state.dwellUntil>sim.tick){v.speed=0;v.vx=v.vy=0;return true;}
 if(state.dwellUntil){state.dwellUntil=0;const atExchange=state.target.id===state.exchange.id;state.lastStop=state.target.id;state.visits++;
  const choices=state.stops.filter(p=>p.id!==state.lastStop&&Math.hypot(p.x-v.x,p.y-v.y)>15);state.target=atExchange?(choices.sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0]??state.exchange):state.exchange;return false;}
 if(Math.hypot(v.x-state.target.x,v.y-state.target.y)>4||state.lastStop===state.target.id)return false;
 const stop=state.target,aboard=passengers(sim,v);for(const c of aboard)leave(sim,c,stop);
 const candidates=sim.chars.filter(c=>c.tier==='background'&&c.id!==v.driver&&!aboard.includes(c)&&c.inCar<0&&c.inside<0&&c.phys===0&&c.talkWith<0&&c.arrestedBy<0&&Math.hypot(c.x-stop.x,c.y-stop.y)<3).slice(0,5);
 for(const c of candidates){c.inCar=v.id;c.goal=null;c.path=null;c.vx=c.vy=0;c.x=c.px=v.x;c.y=c.py=v.y;}
 state.dwellUntil=sim.tick+180;v.speed=0;v.vx=v.vy=0;if(candidates[0])sim.say(candidates[0],stop.id===state.exchange.id?'Next stop, around town.':'Thanks, heading to the exchange.','say',3);return true;
}
/** A failed bus releases passengers safely rather than trapping them in a parked vehicle. */
export function releaseBusPassengers(sim:Simulation,v:Vehicle):void{if(!isServiceBus(v))return;const aboard=passengers(sim,v);if(!aboard.length)return;const stop={x:v.x,y:v.y} as Poi;for(const c of aboard)leave(sim,c,stop);services.delete(v);}
/** Nearby commuters walk to a stop and wait; no characters are teleported into queues. */
export function updateBusWaiting(sim:Simulation):void{
 if(!sim.world.mapped||sim.tick%600!==0)return;
 const stops=sim.world.pois.filter(p=>p.kind==='busstop'&&Math.hypot(p.x-sim.player.x,p.y-sim.player.y)<55);let assigned=0;
 for(const stop of stops){if(assigned>=3)break;if(sim.chars.filter(c=>c.inCar<0&&c.inside<0&&Math.hypot(c.x-stop.x,c.y-stop.y)<2).length>=3)continue;
  const c=sim.chars.find(c=>c.tier==='background'&&c.inCar<0&&c.inside<0&&c.phys===0&&c.talkWith<0&&c.arrestedBy<0&&(!c.goal||c.goal.id==='wander')&&Math.hypot(c.x-stop.x,c.y-stop.y)<10&&Math.hypot(c.x-stop.x,c.y-stop.y)>2);
  if(!c)continue;const q=sim.world.nearestFoot(stop.x+.5,stop.y+.5,4);if(sim.world.carriageway(q.x,q.y)||!sim.world.walkable(q.x,q.y))continue;
  if(forceGoal(c,sim,'wander',{u:1,target:-1})&&c.goal){c.goal.plan=[{kind:'goto',x:q.x,y:q.y},{kind:'wait',time:40,text:'auto'}];assigned++;}
 }
}
