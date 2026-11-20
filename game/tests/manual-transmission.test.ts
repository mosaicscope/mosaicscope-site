import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {manualGearLimit,setManualTransmission,shiftManual,stepPowertrain,supportsManual,cycleDriverAssists,driverAssists} from '../src/sim/DrivingExperience';
import {T} from '../src/world/World';
import {aerodynamicForces} from '../src/sim/VehicleAero';
import {workshopAction} from '../src/sim/VehicleWorkshop';
import {components} from '../src/sim/VehicleDamage';
import {wheelContactControl} from '../src/sim/WheelContact';
import {drivingDynamics} from '../src/sim/VehicleDynamics';
import type {VehicleClass} from '../src/content/vehicles';
function rig(cls:VehicleClass='hatch'){const sim=small(44,{trafficCars:0,midCount:0,backgroundCount:0});sim.vehicles=[];sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);sim.chars.forEach(c=>{c.x=c.px=2;c.y=c.py=2});sim.rebuildHash();const v=makeVehicle(sim,cls,40,42,0,'free');seat(sim,sim.player,v);return{sim,v};}
describe('optional manual transmission',()=>{
 it('defaults to automatic and preserves existing automatic shifting',()=>{const {v}=rig();expect(v.manualTransmission).not.toBe(true);stepPowertrain(v,8,17,1,1/60);expect(v.powertrain!.gear).toBeGreaterThan(1);});
 it('holds a selected gear rather than shifting automatically',()=>{const {v}=rig();expect(setManualTransmission(v,true)).toBe(true);for(let i=0;i<180;i++)stepPowertrain(v,8,17,1,1/60);expect(v.powertrain!.gear).toBe(1);});
 it('shifts up and models a short torque interruption',()=>{const {v}=rig();setManualTransmission(v,true);stepPowertrain(v,4,17,1,.1);expect(shiftManual(v,1,4,17)).toBe(true);expect(v.powertrain!.gear).toBe(2);expect(v.powertrain!.shift).toBeGreaterThan(0);const shifting=stepPowertrain(v,4,17,1,.01);const settled=stepPowertrain(v,4,17,1,.2);expect(shifting).toBeLessThan(settled);});
 it('refuses rapid duplicate shifts until the shift finishes',()=>{const {v}=rig();setManualTransmission(v,true);expect(shiftManual(v,1,1,17)).toBe(true);expect(shiftManual(v,1,1,17)).toBe(false);stepPowertrain(v,1,17,1,.2);expect(shiftManual(v,1,1,17)).toBe(true);});
 it('rejects downshifts that would over-rev and allows them after slowing',()=>{const {v}=rig();setManualTransmission(v,true);v.powertrain={gear:3,rpm:3000,shift:0};expect(shiftManual(v,-1,12,17)).toBe(false);expect(v.powertrain.gear).toBe(3);expect(shiftManual(v,-1,4,17)).toBe(true);expect(v.powertrain.gear).toBe(2);});
 it('enforces first and top gear bounds without changing state',()=>{const {v}=rig();setManualTransmission(v,true);expect(shiftManual(v,-1,0,17)).toBe(false);v.powertrain={gear:5,rpm:3000,shift:0};expect(shiftManual(v,1,1,17)).toBe(false);expect(v.powertrain.gear).toBe(5);});
 it('limits engine force to the selected gear and raises that limit after an upshift',()=>{const {v}=rig();setManualTransmission(v,true);v.powertrain={gear:1,rpm:3000,shift:0};const first=manualGearLimit(v,20);v.powertrain.gear=2;expect(manualGearLimit(v,20)).toBeGreaterThan(first);setManualTransmission(v,false);expect(manualGearLimit(v,20)).toBe(20);});
 it('continues to allow reverse at rest in manual mode',()=>{const {v}=rig();setManualTransmission(v,true);stepPowertrain(v,0,17,-1,1/60);expect(v.powertrain!.gear).toBe(-1);});
 it('refuses forward gear changes while reversing',()=>{const {v}=rig();setManualTransmission(v,true);expect(shiftManual(v,1,-3,17)).toBe(false);});
 it('keeps single-speed electric cars and bicycles in automatic mode',()=>{for(const cls of ['ev','bicycle','ebike','escooter'] as VehicleClass[]){const {v}=rig(cls);expect(supportsManual(v)).toBe(false);expect(setManualTransmission(v,true)).toBe(false);expect(v.manualTransmission).not.toBe(true);}});
 it('retains manual choice across save serialization and allows returning to auto',()=>{const {v}=rig();setManualTransmission(v,true);const saved=JSON.parse(JSON.stringify(v));expect(saved.manualTransmission).toBe(true);expect(setManualTransmission(saved,false)).toBe(true);expect(saved.manualTransmission).toBe(false);});
 it('actually limits acceleration in the real driving loop',()=>{const a=rig(),b=rig();setManualTransmission(b.v,true);Object.assign(playerInput,{throttle:1,steer:0,brake:false,serviceBrake:0});for(let i=0;i<600;i++){a.v.x=b.v.x=40;a.v.y=b.v.y=42;a.sim.tick++;b.sim.tick++;updateVehicles(a.sim,1/60);updateVehicles(b.sim,1/60);}expect(a.v.speed).toBeGreaterThan(b.v.speed+1);Object.assign(playerInput,{throttle:0,steer:0,brake:false,serviceBrake:0});});
});

describe('control and contact behavior',()=>{
 it('does not request traction control while service braking',()=>{const {sim,v}=rig();v.speed=10;v.vx=10;v.vy=0;v.dynT=sim.tick;Object.assign(playerInput,{throttle:0,steer:0,brake:false,serviceBrake:1});for(let i=0;i<10;i++){sim.tick++;updateVehicles(sim,1/60);}expect(v.contactControl!.traction).toBe(0);Object.assign(playerInput,{serviceBrake:0});});
 it('applies stability assistance to excess yaw in road mode but leaves drift mode free',()=>{const road=rig(),drift=rig();drift.v.driveMode='drift';for(const r of [road,drift]){r.v.speed=8;r.v.vx=8;r.v.vy=0;r.v.yaw=3;r.v.dynT=r.sim.tick;r.sim.tick++;updateVehicles(r.sim,1/120);}expect(road.v.stabilityActive).toBe(true);expect(drift.v.stabilityActive).toBe(false);});
});

describe('selectable driving assists',()=>{
 it('defaults to the aid settings appropriate to the current driving mode',()=>{const {v}=rig();expect(driverAssists(v)).toEqual({abs:true,traction:true,stability:true});v.driveMode='drift';expect(driverAssists(v)).toEqual({abs:false,traction:false,stability:false});});
 it('cycles through on, sport, off and automatic configurations',()=>{const {v}=rig();expect(cycleDriverAssists(v)).toBe('on');expect(driverAssists(v)).toEqual({abs:true,traction:true,stability:true});expect(cycleDriverAssists(v)).toBe('sport');expect(driverAssists(v)).toEqual({abs:true,traction:false,stability:true});expect(cycleDriverAssists(v)).toBe('off');expect(driverAssists(v)).toEqual({abs:false,traction:false,stability:false});expect(cycleDriverAssists(v)).toBe('auto');});
 it('can enable assistance in drift mode or disable it in road mode',()=>{const {v}=rig();v.driveMode='drift';v.assistMode='on';expect(driverAssists(v).stability).toBe(true);v.driveMode='road';v.assistMode='off';expect(driverAssists(v).abs).toBe(false);});
 it('persists the aid preference with the vehicle',()=>{const {v}=rig();v.assistMode='sport';const loaded=JSON.parse(JSON.stringify(v));expect(loaded.assistMode).toBe('sport');expect(driverAssists(loaded).traction).toBe(false);});
 it('recovers an unknown saved preference to automatic when cycled',()=>{const {v}=rig();v.assistMode='invalid' as never;expect(cycleDriverAssists(v)).toBe('auto');});
});

describe('aerodynamic handling',()=>{
 it('starts at zero and grows with the square of speed',()=>{const {v}=rig();const a=aerodynamicForces(v,5,20),b=aerodynamicForces(v,10,20);expect(aerodynamicForces(v,0,20).drag).toBe(0);expect(b.drag).toBeCloseTo(a.drag*4,8);});
 it('accounts for larger frontal area',()=>{const {v}=rig();const before=aerodynamicForces(v,10,20).drag;v.lifeMods=['Double deck'];expect(aerodynamicForces(v,10,20).drag).toBeGreaterThan(before);});
 it('adds drag and reduces aerodynamic load after frontal damage',()=>{const {v}=rig('super');const healthy=aerodynamicForces(v,18,20);v.dmgF=.8;v.bumperLost=true;const damaged=aerodynamicForces(v,18,20);expect(damaged.drag).toBeGreaterThan(healthy.drag);expect(damaged.load).toBeLessThan(healthy.load);});
 it('makes asymmetric body damage pull in opposite directions at speed',()=>{const {v}=rig();v.dmgS=.8;const right=aerodynamicForces(v,15,20);v.dmgS=0;v.dmgL=.8;const left=aerodynamicForces(v,15,20);expect(right.pull).toBeGreaterThan(0);expect(left.pull).toBeLessThan(0);expect(Math.abs(aerodynamicForces(v,0,20).pull)).toBe(0);});
 it('keeps forces bounded even above the nominal top speed',()=>{const {v}=rig();const a=aerodynamicForces(v,10000,20),b=aerodynamicForces(v,32,20);expect(a.drag).toBeCloseTo(b.drag);expect(a.load).toBeLessThanOrEqual(1.08);});
});

describe('individual tyre pressure service',()=>{
 function parked(){const r=rig();r.sim.player.inCar=-1;r.v.driver=-1;r.v.state='parked';r.v.x=r.sim.player.x;r.v.y=r.sim.player.y;r.sim.player.cash=100;return r;}
 it('lowers only the selected tyre in controlled steps and inflates it again',()=>{const {sim,v}=parked();expect(workshopAction(sim,'airDown',0,-1,0).ok).toBe(true);expect(v.dynamics!.wheels[0].pressure).toBe(.9);expect(v.dynamics!.wheels[1].pressure).toBe(1);expect(workshopAction(sim,'inflateTyre',0,-1,0).ok).toBe(true);expect(v.dynamics!.wheels[0].pressure).toBe(1);expect(sim.player.cash).toBe(95);});
 it('refuses pressure changes on punctured or missing tyres and does not charge',()=>{const {sim,v}=parked();components(v).wheels[0].puncture=true;expect(workshopAction(sim,'inflateTyre',0,-1,0).ok).toBe(false);expect(sim.player.cash).toBe(100);components(v).wheels[1].missing=true;expect(workshopAction(sim,'airDown',0,-1,1).ok).toBe(false);});
 it('does not adjust nonexistent wheels on a bicycle',()=>{const {sim,v}=parked();v.cls='bicycle';expect(workshopAction(sim,'airDown',0,-1,1).ok).toBe(false);});
 it('never drops pressure below the supported adjustment range',()=>{const {sim,v}=parked();for(let i=0;i<8;i++)workshopAction(sim,'airDown',0,-1,0);expect(v.dynamics!.wheels[0].pressure).toBe(.6);});
 it('changes contact grip differently on sealed and soft ground',()=>{const low=rig().v,fresh=rig().v;drivingDynamics(low).wheels[0].pressure=drivingDynamics(low).wheels[1].pressure=.6;const c=(v:typeof low,rough:number)=>wheelContactControl(v,[1,1,1,1],10,0,1,0,false,true,1.5,.1,[rough,rough,rough,rough]).driveGrip;expect(c(low,0)).toBeLessThan(c(fresh,0));expect(c(low,1)).toBeGreaterThan(c(fresh,1));});
});
