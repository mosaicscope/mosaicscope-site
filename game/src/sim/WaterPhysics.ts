import {T,type World} from '../world/World';
import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from './VehicleGeometry';

/** Local depth is inferred from distance to the mapped bank, not a live depth survey. */
export function waterDepth(world:World,x:number,y:number):number{
 if(world.tile(Math.floor(x),Math.floor(y))!==T.WATER)return 0;
 const tx=Math.floor(x),ty=Math.floor(y);for(let r=1;r<=4;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===r&&world.tile(tx+dx,ty+dy)!==T.WATER)return .12+r*.22;
 return 1.18;
}
const channelCache=new WeakMap<World,{revision:number;directions:Map<string,[number,number]>}>();
/** Approximate channel direction from surrounding water; actual downstream data is not supplied. */
function channelDirection(world:World,x:number,y:number):[number,number]{
 const tx=Math.floor(x),ty=Math.floor(y);if(world.tile(tx,ty)!==T.WATER)return[1,0];const revision=world.mapped?.revision??0;let cache=channelCache.get(world);if(!cache||cache.revision!==revision){cache={revision,directions:new Map()};channelCache.set(world,cache);}const key=tx+','+ty,cached=cache.directions.get(key);if(cached)return cached;
 const dirs:[number,number][]=[[1,0],[1,-1],[0,-1],[1,1]],scores=dirs.map(([dx,dy])=>{let score=0;for(let d=1;d<=5;d++)for(const sign of[-1,1])if(world.tile(tx+dx*d*sign,ty+dy*d*sign)===T.WATER)score+=1/d;return score;});let best=0;for(let i=1;i<scores.length;i++)if(scores[i]>scores[best]+.05)best=i;const [dx,dy]=dirs[best],len=Math.hypot(dx,dy),result:[number,number]=[dx/len,dy/len];if(cache.directions.size>4096)cache.directions.clear();cache.directions.set(key,result);return result;
}
/** Fresh weather controls roughness; direction and flow remain estimated from the map. */
export function waterCurrent(sim:Simulation,x=sim.player.x,y=sim.player.y):{x:number;y:number;roughness:number}{
 const live=sim.world.mapped?.liveConditions,weather=live?.weather&&Date.now()-Date.parse(live.fetchedAt)<1800000?live.weather:null;
 const wind=weather?.wind??0,rain=weather?.rain??sim.env.rain*3,roughness=Math.min(1,Math.max(0,wind/18+rain/10)),dir=channelDirection(sim.world,x,y),speed=.22+roughness*.18;return{x:dir[0]*speed,y:dir[1]*speed,roughness};
}
export interface VehicleWaterState{elapsed:number;submersion:number;locked:boolean}
/** Slow flooding, drift and engine lock. State persists until a repair. */
export function stepWaterVehicle(sim:Simulation,v:Vehicle,dt:number):void{
 const depth=waterDepth(sim.world,v.x,v.y),old=v.water;
 if(!depth){if(old){old.elapsed=0;old.submersion=Math.max(0,old.submersion-dt*.35);if(old.submersion===0&&!old.locked)v.water=undefined;}return;}
 const state=v.water??={elapsed:0,submersion:0,locked:false};state.elapsed+=dt;
 const height=vehicleGeometry(v).height,target=Math.min(depth,height*1.3),flood=state.elapsed<2?.04:Math.min(.2,dt*(.09+Math.max(0,depth-.3)*.09));
 state.submersion=Math.min(target,state.submersion+(state.elapsed<2?dt*flood:flood));
 if(depth>.35&&state.elapsed>3&&state.submersion>height*.22){state.locked=true;v.engineDamage=Math.max(v.engineDamage??0,.72);v.driveThrottle=0;}
 const current=waterCurrent(sim,v.x,v.y),drag=Math.exp(-dt*(2.2+depth));v.vx=(v.vx??Math.cos(v.heading)*v.speed)*drag+current.x*(1-drag);v.vy=(v.vy??Math.sin(v.heading)*v.speed)*drag+current.y*(1-drag);v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);v.dynT=sim.tick;
 if((sim.tick+v.id)%45===0&&Math.hypot(v.vx,v.vy)>.08)sim.liquids.disturb(v.x,v.y,Math.max(1,Math.hypot(v.vx,v.vy)),v.vx,v.vy);
}
