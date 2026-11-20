import {describe,it,expect,afterEach} from 'vitest';
import {small} from './helpers';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {components,repairVehicle} from '../src/sim/VehicleDamage';
import {wheelContactControl,ackermannAngle} from '../src/sim/WheelContact';
import {coastResistance} from '../src/sim/DrivingExperience';
import {drivingDynamics,stepDrivingDynamics} from '../src/sim/VehicleDynamics';
import {T} from '../src/world/World';
import {workshopAction} from '../src/sim/VehicleWorkshop';
import type {VehicleClass} from '../src/content/vehicles';
function rig(cls:VehicleClass='hatch'){const sim=small(42,{trafficCars:0,midCount:0,backgroundCount:0});sim.vehicles=[];sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);sim.chars.forEach(c=>{c.x=c.px=2;c.y=c.py=2});sim.rebuildHash();const v=makeVehicle(sim,cls,40,42,0,'free');seat(sim,sim.player,v);return{sim,v};}
function contact(v:ReturnType<typeof rig>['v'],opt:{surface?:number[];speed?:number;yaw?:number;engine?:number;brake?:number;hand?:boolean;assists?:boolean}={}){let r;for(let i=0;i<60;i++)r=wheelContactControl(v,opt.surface??[1,1,1,1],opt.speed??10,opt.yaw??0,opt.engine??0,opt.brake??0,opt.hand??false,opt.assists??true,1.6,1/60);return r!;}
afterEach(()=>Object.assign(playerInput,{throttle:0,steer:0,brake:false,serviceBrake:0}));
describe('individual contact patches and driver assists',()=>{
 it('sends driving torque to the correct axle for front, rear and all-wheel drive',()=>{const f=contact(rig('hatch').v,{engine:1}),r=contact(rig('muscle').v,{engine:1}),a=contact(rig('fourby').v,{engine:1});expect(f.wheels.slice(0,2).every(w=>w.drive>0)).toBe(true);expect(f.wheels.slice(2).every(w=>w.drive===0)).toBe(true);expect(r.wheels.slice(0,2).every(w=>w.drive===0)).toBe(true);expect(a.wheels.every(w=>w.drive>0)).toBe(true);});
 it('detects lost grip on the driven axle independently of the other axle',()=>{const f=contact(rig('hatch').v,{surface:[.25,.25,1,1],engine:1});const r=contact(rig('muscle').v,{surface:[.25,.25,1,1],engine:1});expect(f.driveGrip).toBeLessThan(r.driveGrip);expect(f.traction).toBeGreaterThan(r.traction);});
 it('reduces wheel lock under assisted braking while preserving the rear handbrake lock',()=>{const a=contact(rig().v,{surface:[.3,.3,.3,.3],brake:1}),b=contact(rig().v,{surface:[.3,.3,.3,.3],brake:1,assists:false}),h=contact(rig().v,{surface:[.3,.3,.3,.3],brake:1,hand:true});expect(a.abs).toBeGreaterThan(.2);expect(a.wheels[0].lock).toBeLessThan(b.wheels[0].lock);expect(h.wheels[2].lock).toBeGreaterThan(.9);expect(h.abs).toBe(0);});
 it('reports different left/right braking when the wheels have split grip',()=>{const left=contact(rig().v,{surface:[.25,1,.25,1],brake:1}),right=contact(rig().v,{surface:[1,.25,1,.25],brake:1});expect(left.splitPull).toBeGreaterThan(0);expect(right.splitPull).toBeLessThan(0);});
 it('uses different wheel ground speeds when the car rotates',()=>{const r=contact(rig().v,{speed:10,yaw:1});expect(r.wheels[0].groundSpeed).toBeGreaterThan(r.wheels[1].groundSpeed);expect(r.wheels[2].groundSpeed).toBe(r.wheels[0].groundSpeed);});
 it('front biases normal service braking and locks the rear under the handbrake',()=>{const r=contact(rig().v,{brake:.4});expect(r.wheels[0].brake).toBeGreaterThan(r.wheels[2].brake);const h=contact(rig().v,{hand:true});expect(h.wheels[2].brake).toBeGreaterThan(h.wheels[0].brake);});
 it('reduces braking on a hot or damaged individual caliper',()=>{const cold=rig().v,hot=rig().v;drivingDynamics(hot).wheels[0].brakeHeat=1;components(hot).parts={fl_caliper:1};const a=contact(cold,{brake:.7}),b=contact(hot,{brake:.7});expect(b.wheels[0].brake).toBeLessThan(a.wheels[0].brake);expect(b.wheels[1].brake).toBeCloseTo(a.wheels[1].brake);});
 it('reacts to uneven tyre pressure and missing wheels at their contact patches',()=>{const intact=rig().v,broken=rig().v;drivingDynamics(broken).wheels[0].pressure=.2;components(broken).wheels[1].missing=true;const a=contact(intact,{engine:1}),b=contact(broken,{engine:1});expect(b.frontGrip).toBeLessThan(a.frontGrip*.6);expect(b.driveGrip).toBeLessThan(a.driveGrip);});
 it('lets the outside wheel carry more normal load without creating grip from zero load',()=>{const v=rig().v,d=drivingDynamics(v);d.wheels[0].load=.08;d.wheels[1].load=.42;const r=contact(v);expect(r.frontGrip).toBeLessThan(1.02);expect(r.frontGrip).toBeGreaterThan(.7);});
 it('does not run ABS at a standstill and does not accumulate NaN after invalid surfaces',()=>{const r=contact(rig().v,{surface:[NaN,1,1,1],speed:0,brake:1});expect(r.abs).toBe(0);expect(r.wheels.every(w=>Number.isFinite(w.surface+w.groundSpeed+w.brake+w.lock))).toBe(true);});
 it('models damped suspension response and settles after the load returns',()=>{const v=rig().v;for(let i=0;i<60;i++)stepDrivingDynamics(v,10,0,4,0,0,false,1/60);const d=drivingDynamics(v),loaded=d.wheels[2].travel;expect(loaded).toBeGreaterThan(0);for(let i=0;i<240;i++)stepDrivingDynamics(v,10,0,0,0,0,false,1/60);expect(Math.abs(d.wheels[2].suspensionVelocity??0)).toBeLessThan(.02);});
 it('preserves existing saved tyre state when adding the contact controller and resets it during a full repair',()=>{const {v}=rig();drivingDynamics(v).wheels[0].pressure=.6;contact(v);expect(v.dynamics!.wheels[0].pressure).toBe(.6);repairVehicle(v);expect(v.contactControl).toBeUndefined();expect(v.dynamics).toBeUndefined();});
 it('actually connects contacts to acceleration and braking in the game simulation',()=>{const {sim,v}=rig();Object.assign(playerInput,{throttle:1});for(let i=0;i<180;i++){sim.tick++;updateVehicles(sim,1/60);}expect(v.speed).toBeGreaterThan(5);expect(v.contactControl?.wheels).toHaveLength(4);Object.assign(playerInput,{throttle:0,serviceBrake:1});const before=v.speed;for(let i=0;i<30;i++){sim.tick++;updateVehicles(sim,1/60);}expect(v.speed).toBeLessThan(before);expect(v.contactControl!.wheels[0].brake).toBeGreaterThan(0);});
});

describe('steering and drivetrain details',()=>{
 it('angles the inside front wheel further than the outside, in both directions',()=>{const left=ackermannAngle(.4,2,1.5,1),outside=ackermannAngle(.4,2,1.5,-1);expect(left).toBeGreaterThan(outside);expect(ackermannAngle(-.4,2,1.5,-1)).toBeCloseTo(-left);expect(ackermannAngle(0,2,1.5,1)).toBe(0);});
 it('gains driven-axle traction from a limited-slip mode on a split surface',()=>{const road=rig('muscle').v,drift=rig('muscle').v;drift.driveMode='drift';const a=contact(road,{surface:[1,1,.2,1],engine:1}),b=contact(drift,{surface:[1,1,.2,1],engine:1});expect(b.driveGrip).toBeGreaterThan(a.driveGrip);});
 it('applies more engine braking at lower gears and higher engine speed',()=>{const v=rig().v;v.powertrain={gear:1,rpm:5500,shift:0};const low=coastResistance(v,10,0,false);v.powertrain.gear=5;v.powertrain.rpm=1200;expect(coastResistance(v,10,0,false)).toBeLessThan(low);expect(coastResistance(v,10,1,false)).toBe(0);expect(coastResistance(v,10,0,true)).toBe(0);});
 it('tapers electric regeneration at low speed and lets bicycles coast freely',()=>{const ev=rig('ev').v,bike=rig('bicycle').v;expect(coastResistance(ev,10,0,false)).toBeGreaterThan(coastResistance(ev,1,0,false));expect(coastResistance(ev,0,0,false)).toBe(0);expect(coastResistance(bike,10,0,false)).toBe(0);});
 it('restores a malformed saved contact control without poisoning the driving state',()=>{const v=rig().v;const control=contact(v);control.wheels[0].lock=NaN;const repaired=contact(v);expect(Number.isFinite(repaired.wheels[0].lock)).toBe(true);});
});

describe('wheel wear and turning',()=>{
 it('lets wheels on opposite sides rotate at different speeds in a turn',()=>{const v=rig().v;contact(v,{speed:10,yaw:1});stepDrivingDynamics(v,10,0,0,0,0,false,.1);expect(v.dynamics!.wheels[0].rotation).toBeGreaterThan(v.dynamics!.wheels[1].rotation);});
 it('grows brake wear under sustained braking and services it without touching tyre tread',()=>{const {sim,v}=rig();sim.player.inCar=-1;v.driver=-1;v.state='parked';v.x=sim.player.x;v.y=sim.player.y;sim.player.cash=1000;const d=drivingDynamics(v);d.wheels[0].wear=.4;for(let i=0;i<1200;i++)stepDrivingDynamics(v,20,0,0,0,1,false,1/60);expect(d.wheels[0].brakeWear).toBeGreaterThan(.001);expect(workshopAction(sim,'mechanical',0).ok).toBe(true);expect(d.wheels[0].brakeWear).toBe(0);expect(d.wheels[0].wear).toBeGreaterThanOrEqual(.4);});
 it('keeps suspension stable across long or short simulation steps',()=>{const a=rig().v,b=rig().v;for(let i=0;i<120;i++)stepDrivingDynamics(a,10,0,4,0,0,false,1/120);for(let i=0;i<30;i++)stepDrivingDynamics(b,10,0,4,0,0,false,1/30);expect(Math.abs(a.dynamics!.wheels[2].travel-b.dynamics!.wheels[2].travel)).toBeLessThan(.01);expect(Number.isFinite(b.dynamics!.wheels[2].suspensionVelocity)).toBe(true);});
});

describe('two-wheeled and damaged handling',()=>{
 it('uses a single front and rear contact for bicycles, without phantom braking pull',()=>{const r=contact(rig('bicycle').v,{engine:1,brake:.8,yaw:1});expect(r.wheels[1].brake).toBe(0);expect(r.wheels[3].brake).toBe(0);expect(r.wheels[2].drive).toBeGreaterThan(0);expect(r.wheels[3].drive).toBe(0);expect(r.splitPull).toBe(0);expect(r.wheels[0].groundSpeed).toBe(r.wheels[2].groundSpeed);});
 it('reduces grip at a locally punctured or damaged wheel',()=>{const v=rig().v;components(v).wheels[0].puncture=true;v.components!.parts={fl_arm:1,fl_spring:1};const damaged=contact(v,{engine:1});const fresh=contact(rig().v,{engine:1});expect(damaged.frontGrip).toBeLessThan(fresh.frontGrip);expect(damaged.driveGrip).toBeLessThan(fresh.driveGrip);});
});

describe('load-aware braking',()=>{
 it('moves service-brake bias forward when the car decelerates',()=>{const neutral=rig().v,loaded=rig().v;drivingDynamics(loaded).longitudinalLoad=-.12;const a=contact(neutral,{brake:.5}),b=contact(loaded,{brake:.5});expect(b.wheels[0].brake).toBeGreaterThan(a.wheels[0].brake);expect(b.wheels[2].brake).toBeLessThan(a.wheels[2].brake);});
 it('recovers wheel rotation after releasing the handbrake',()=>{const v=rig().v;const locked=contact(v,{speed:10,hand:true});expect(locked.wheels[2].lock).toBeGreaterThan(.9);const released=contact(v,{speed:10});expect(released.wheels[2].lock).toBeLessThan(.01);});
});

describe('surface-specific tyre wear',()=>{
 it('wears tyres faster on loose ground without confusing wet pavement with rough ground',()=>{const wet=rig().v,loose=rig().v;wheelContactControl(wet,[.7,.7,.7,.7],15,0,0,0,false,true,1.6,1/60,[0,0,0,0]);wheelContactControl(loose,[.7,.7,.7,.7],15,0,0,0,false,true,1.6,1/60,[1,1,1,1]);for(let i=0;i<1200;i++){stepDrivingDynamics(wet,15,0,0,.5,0,false,1/60);stepDrivingDynamics(loose,15,0,0,.5,0,false,1/60);}expect(loose.dynamics!.wheels[0].wear).toBeGreaterThan(wet.dynamics!.wheels[0].wear);});
});
