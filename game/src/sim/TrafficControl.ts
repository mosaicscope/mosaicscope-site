import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {PERIOD,ROAD_W,CROSS_W} from '../world/World';
const reservations=new WeakMap<Simulation,Map<number,{id:number;until:number}>>();
/** A light-controlled junction accepts one committed vehicle until its footprint clears the exit. */
export function junctionAvailable(sim:Simulation,v:Vehicle,c:number,r:number):boolean{
 const x=c*PERIOD,y=r*PERIOD;
 // Existing saves may already have traffic inside the box before reservations were introduced.
 if(sim.vehicles.some(o=>o!==v&&o.state!=='parked'&&o.x>x-.3&&o.x<x+ROAD_W+.3&&o.y>y-.3&&o.y<y+ROAD_W+.3))return false;
 let map=reservations.get(sim);if(!map){map=new Map();reservations.set(sim,map);}const key=c*256+r,slot=map.get(key);
 if(slot&&slot.id!==v.id){const o=sim.vehicles[slot.id],pad=CROSS_W+1,occupied=o&&o.x>c*PERIOD-pad&&o.x<c*PERIOD+ROAD_W+pad&&o.y>r*PERIOD-pad&&o.y<r*PERIOD+ROAD_W+pad;
  if(occupied&&sim.tick<slot.until)return false;map.delete(key);
 }
 map.set(key,{id:v.id,until:sim.tick+60*10});return true;
}
