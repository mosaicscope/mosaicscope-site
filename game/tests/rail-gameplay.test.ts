import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {T} from '../src/world/World';
import {mappedPoint} from '../src/world/MappedWorld';
describe('mapped rail gameplay',()=>{
 it('stops and damages a free-driven car at a surveyed barrier',()=>{
  const sim=new Simulation({cityMap:'christchurch',midCount:0,backgroundCount:0,trafficCars:0}),m=sim.world.mapped!;sim.vehicles=[];sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);
  const segment=m.streetSegments.find(s=>s.length>35)!;const x=segment.x+segment.dx*10,y=segment.y+segment.dy*10,barrierX=x+segment.dx*5,barrierY=y+segment.dy*5;
  const point=(x:number,y:number)=>[(x-m.offsetX)*m.metresPerTile,(y-m.offsetY)*m.metresPerTile];
  const a=point(barrierX-segment.dy*5,barrierY+segment.dx*5),b=point(barrierX+segment.dy*5,barrierY-segment.dx*5);
  m.data.push({code:'CHC',cx:888,cy:888,centre:{name:'rail test'},buildings:[],roads:[],venues:[],barriers:[{id:999999998,kind:'guard_rail',points:[a,b],tags:{}}]});m.revision=(m.revision??0)+1;
  const v=makeVehicle(sim,'sedan',x,y,Math.atan2(segment.dy,segment.dx),'free');seat(sim,sim.player,v);v.state='free';v.speed=10;v.vx=segment.dx*10;v.vy=segment.dy*10;v.dynT=sim.tick;Object.assign(playerInput,{throttle:0,steer:0,brake:false,serviceBrake:0});
  for(let i=0;i<40;i++){sim.tick++;updateVehicles(sim,1/60);}
  const along=(v.x-x)*segment.dx+(v.y-y)*segment.dy;expect(along).toBeLessThan(5);expect(v.damage).toBeGreaterThan(0);void mappedPoint;
 },30000);
});
