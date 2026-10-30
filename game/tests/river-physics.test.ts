import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {T} from '../src/world/World';
import {makeVehicle,seat,unseat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {waterDepth,waterCurrent,stepWaterVehicle} from '../src/sim/WaterPhysics';
import {vehicleGeometry} from '../src/sim/VehicleGeometry';
import {repairVehicle} from '../src/sim/VehicleDamage';
import {workshopAction} from '../src/sim/VehicleWorkshop';
function rig(){const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0});s.vehicles=[];s.world.tiles.fill(T.ROAD);s.world.blocked.fill(0);for(let y=20;y<40;y++)for(let x=20;x<40;x++){const i=y*s.world.size+x;s.world.tiles[i]=T.WATER;s.world.blocked[i]=1;}const v=makeVehicle(s,'sedan',30,30,0,'free');seat(s,s.player,v);return {s,v};}
describe('river vehicle and swimming physics',()=>{
 it('estimates shallower banks and deeper channels',()=>{const {s}=rig();expect(waterDepth(s.world,19,30)).toBe(0);expect(waterDepth(s.world,20,30)).toBeLessThan(waterDepth(s.world,30,30));});
 it('floats briefly, sinks, locks the engine and preserves the lock on land',()=>{const {s,v}=rig();for(let i=0;i<60;i++){s.tick++;stepWaterVehicle(s,v,1/60);}expect(v.water?.locked).toBe(false);expect(v.water!.submersion).toBeLessThan(.1);for(let i=0;i<900;i++){s.tick++;stepWaterVehicle(s,v,1/60);}expect(v.water?.locked).toBe(true);expect(v.water!.submersion).toBeGreaterThan(vehicleGeometry(v).height);expect(v.vx).toBeGreaterThan(0);v.x=19;stepWaterVehicle(s,v,1/60);expect(v.water?.locked).toBe(true);repairVehicle(v);expect(v.water).toBeUndefined();});
 it('requires dry recovery before repairing a hydrolocked engine',()=>{const {s,v}=rig();v.water={elapsed:5,submersion:.5,locked:true};v.engineDamage=.72;s.player.cash=1000;unseat(s,v);expect(workshopAction(s,'engine',v.id).ok).toBe(false);v.x=19;v.y=30;v.speed=0;s.player.x=19;s.player.y=30;expect(workshopAction(s,'engine',v.id).ok).toBe(true);expect(v.water?.locked).toBe(false);});
 it('lets the driver leave and swim through water',()=>{const {s,v}=rig(),c=unseat(s,v)!;expect(c.inCar).toBe(-1);expect(waterDepth(s.world,c.x,c.y)).toBeGreaterThan(0);const x=c.x;expect(s.physics.moveCircle(c,.3,0,true)).toBe(false);expect(c.x).toBeGreaterThan(x);});
 it('keeps the hydrolocked vehicle from accelerating under throttle',()=>{const {s,v}=rig();v.water={elapsed:5,submersion:.5,locked:true};v.speed=0;v.vx=0;v.vy=0;v.dynT=s.tick;Object.assign(playerInput,{throttle:1,steer:0,brake:false});try{for(let i=0;i<180;i++){s.tick++;updateVehicles(s,1/60);}expect(v.speed).toBeLessThan(1);expect(v.water?.locked).toBe(true);}finally{Object.assign(playerInput,{throttle:0,steer:0,brake:false});}});
 it('uses weather for water roughness without claiming measured flow',()=>{const {s}=rig();s.env.rain=0;const calm=waterCurrent(s);s.env.rain=1;const wet=waterCurrent(s);expect(wet.roughness).toBeGreaterThan(calm.roughness);});
});
