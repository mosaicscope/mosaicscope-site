import type {Simulation} from './Simulation';
import {T} from '../world/World';
/** A clear apron near the chosen property, never a road or somebody else's occupied parking bay. */
export function hangarBay(sim:Simulation,building:number):{x:number;y:number}|null{
 const b=sim.world.buildings[building];if(!b)return null;const candidates:{x:number;y:number}[]=[];
 for(let y=Math.max(2,Math.floor(b.door.y)-16);y<Math.min(sim.world.size-2,b.door.y+16);y++)for(let x=Math.max(2,Math.floor(b.door.x)-16);x<Math.min(sim.world.size-2,b.door.x+16);x++){
  if(sim.world.tile(x,y)!==T.PARKING||sim.world.tile(x+1,y)!==T.PARKING||sim.world.tile(x,y+1)!==T.PARKING||sim.world.tile(x+1,y+1)!==T.PARKING)continue;
  const p={x:x+1,y:y+1};if(sim.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<2.5)||sim.commerce.purchases.some(o=>o.bay&&Math.hypot(o.bay.x-p.x,o.bay.y-p.y)<3)||sim.world.pois.some(o=>Math.hypot(o.x-p.x,o.y-p.y)<2))continue;candidates.push(p);
 }
 return candidates.sort((a,c)=>Math.hypot(a.x-b.door.x,a.y-b.door.y)-Math.hypot(c.x-b.door.x,c.y-b.door.y))[0]??null;
}
