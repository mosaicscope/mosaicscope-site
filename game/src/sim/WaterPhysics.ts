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
/** Weather changes surface force; the eastward current is an approximation, not live flow data. */
export function waterCurrent(sim:Simulation):{x:number;y:number;roughness:number}{
 const live=sim.world.mapped?.liveConditions,weather=live?.weather&&Date.now()-Date.parse(live.fetchedAt)<1800000?live.weather:null;
 const wind=weather?.wind??0,rain=weather?.rain??sim.env.rain*3,roughness=Math.min(1,Math.max(0,wind/18+rain/10));return{x:.22+roughness*.18,y:0,roughness};
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
 const current=waterCurrent(sim),drag=Math.exp(-dt*(2.2+depth));v.vx=(v.vx??Math.cos(v.heading)*v.speed)*drag+current.x*(1-drag);v.vy=(v.vy??Math.sin(v.heading)*v.speed)*drag+current.y*(1-drag);v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);v.dynT=sim.tick;
 if((sim.tick+v.id)%45===0&&Math.hypot(v.vx,v.vy)>.08)sim.liquids.disturb(v.x,v.y,Math.max(1,Math.hypot(v.vx,v.vy)));
}
