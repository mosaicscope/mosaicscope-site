import {afterEach,describe,expect,it} from 'vitest';
import {small} from './helpers';
import {makeVehicle,seat,playerInput,updateVehicles} from '../src/sim/Traffic';
import {stepPowertrain} from '../src/sim/DrivingExperience';
import {T} from '../src/world/World';
function rig(mode:'road'|'sport'|'drift'='road',speed=8){
 const sim=small(42,{trafficCars:0,midCount:0,backgroundCount:0});sim.vehicles=[];sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);sim.env.rain=0;
 sim.chars.forEach(c=>{c.x=c.px=2;c.y=c.py=2;});sim.rebuildHash();
 const v=makeVehicle(sim,'super',40,42,0,'free');seat(sim,sim.player,v);v.state='free';v.driveMode=mode;v.speed=speed;v.vx=speed;v.vy=0;v.dynT=sim.tick;return{sim,v};
}
function run(f:ReturnType<typeof rig>,seconds:number,hz=60){for(let i=0;i<seconds*hz;i++){f.v.x=40;f.v.y=42;f.sim.tick++;updateVehicles(f.sim,1/hz);}}
afterEach(()=>Object.assign(playerInput,{throttle:0,steer:0,brake:false,serviceBrake:0}));
describe('driving refinement',()=>{
 it('service brakes stop sooner than the handbrake without selecting reverse',()=>{
  const normal=rig(),hand=rig();Object.assign(playerInput,{throttle:1,steer:0,brake:false,serviceBrake:1});run(normal,.4);
  Object.assign(playerInput,{throttle:0,brake:true,serviceBrake:0});run(hand,.4);expect(normal.v.speed).toBeLessThan(hand.v.speed);
  Object.assign(playerInput,{throttle:1,brake:false,serviceBrake:1});run(normal,3);expect(normal.v.speed).toBe(0);expect(normal.v.wheelspin).toBe(0);
 });
 it('brakes hold a stopped car and stop reverse motion without pushing it forward',()=>{
  const f=rig('road',-3);Object.assign(playerInput,{throttle:-1,steer:0,brake:false,serviceBrake:1});run(f,2);expect(f.v.speed).toBe(0);run(f,1);expect(f.v.speed).toBe(0);
 });
 it('reduces high-speed Road steering lock while preserving Sport and low-speed manoeuvres',()=>{
  const road=rig(),sport=rig('sport'),slow=rig('road',1);Object.assign(playerInput,{throttle:0,steer:1,brake:false,serviceBrake:0});run(road,.15);run(sport,.15);run(slow,.15);
  expect(Math.abs(road.v.wheelSteer!)).toBeLessThan(Math.abs(sport.v.wheelSteer!)*.6);expect(Math.abs(slow.v.wheelSteer!)).toBeGreaterThan(Math.abs(road.v.wheelSteer!));
 });
 it('keeps assisted braking and turning consistent at 30 and 120 Hz',()=>{
  const a=rig(),b=rig();Object.assign(playerInput,{throttle:0,steer:.6,brake:false,serviceBrake:.8});run(a,.5,30);run(b,.5,120);expect(a.v.speed).toBeCloseTo(b.v.speed,6);expect(a.v.heading).toBeCloseTo(b.v.heading,6);
 });
 it('does not rotate a stationary car from residual yaw',()=>{
  const f=rig('road',0);f.v.yaw=.2;Object.assign(playerInput,{throttle:0,steer:1,brake:false,serviceBrake:1});run(f,.2);expect(f.v.heading).toBe(0);expect(f.v.yaw).toBe(0);
 });
 it('delivers more wheel torque in a lower gear without shifting an electric drive',()=>{
  const a=rig().v,b=rig().v;a.powertrain={gear:2,rpm:3500,shift:0};b.powertrain={gear:3,rpm:3500,shift:0};
  expect(stepPowertrain(a,2.5,10,.3,1/120)).toBeGreaterThan(stepPowertrain(b,2.5,10,.3,1/120));
  a.cls='ev';expect(stepPowertrain(a,2.5,10,1,1/120)).toBe(1);expect(a.powertrain.gear).toBe(1);
 });
 it('kicks down under demand, holds a cruising gear and prevents immediate gear hunting',()=>{
  const a=rig().v,b=rig().v;a.powertrain={gear:4,rpm:3000,shift:0};b.powertrain={gear:4,rpm:3000,shift:0};
  stepPowertrain(a,4,10,1,1/120);stepPowertrain(b,4,10,.3,1/120);expect(a.powertrain.gear).toBe(3);expect(b.powertrain.gear).toBe(4);
  for(let i=0;i<120;i++)stepPowertrain(a,4,10,1,1/120);expect(a.powertrain.gear).toBe(3);
 });
});
