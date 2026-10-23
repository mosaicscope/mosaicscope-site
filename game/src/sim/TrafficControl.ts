import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {PERIOD,ROAD_W,CROSS_W} from '../world/World';
import {vehicleGeometry} from './VehicleGeometry';
const reservations=new WeakMap<Simulation,Map<number,Map<Vehicle,number>>>();
/** Parallel and opposing straight streams can share a green; crossing routes reserve the box. */
export function junctionAvailable(sim:Simulation,v:Vehicle,c:number,r:number,candidates=sim.vehicles):boolean{
 const x=c*PERIOD,y=r*PERIOD;
 const compatible=(o:Vehicle)=>o.state==='drive'&&v.state==='drive'&&(v.nextDir<0||v.nextDir===v.dir)&&(o.nextDir<0||o.nextDir===o.dir)&&v.dir%2===o.dir%2;
 // Existing saves may already have traffic inside the box before reservations were introduced.
 if(candidates.some(o=>o!==v&&o.state!=='parked'&&!compatible(o)&&o.x>x-.3&&o.x<x+ROAD_W+.3&&o.y>y-.3&&o.y<y+ROAD_W+.3))return false;
 let map=reservations.get(sim);if(!map){map=new Map();reservations.set(sim,map);}const key=c*256+r;
 let slots=map.get(key);if(!slots){slots=new Map();map.set(key,slots);}
 for(const [o,until] of slots){const pad=CROSS_W+2+vehicleGeometry(o).length/2,occupied=o.x>x-pad&&o.x<x+ROAD_W+pad&&o.y>y-pad&&o.y<y+ROAD_W+pad;
  if(!occupied||sim.tick>=until){slots.delete(o);continue;}
  if(o!==v&&!compatible(o))return false;
 }
 slots.set(v,sim.tick+60*10);return true;
}
