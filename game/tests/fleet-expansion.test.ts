import {describe,it,expect} from 'vitest';
import {EXPANDED_FLEET,EXPANSION_BODY_FAMILIES} from '../src/content/fleetExpansion';
import {FLEET_MODELS} from '../src/content/fleet';
import {VEHICLES,type VehicleClass} from '../src/content/vehicles';
import {fleetBody} from '../src/content/vehicleBodies';
import type {Vehicle} from '../src/entities/types';
import {utilitySpec,utilityState,utilityDynamics,setPayload,stepUtility} from '../src/sim/VehicleUtility';
import {stepPowertrain,engineRevFraction} from '../src/sim/DrivingExperience';
import {vehicleGeometry} from '../src/sim/VehicleGeometry';
import {small} from './helpers';
import {makeVehicle,seat,playerInput,updateVehicles} from '../src/sim/Traffic';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {repairVehicle} from '../src/sim/VehicleDamage';

function car(cls:VehicleClass):Vehicle{return {id:0,cls,x:0,y:0,px:0,py:0,heading:0,speed:0,color:'#566d60',driver:0,owner:0,state:'free',dir:0,nextDir:-1,damage:0,siren:false,plate:'UTIL001',forSale:false,price:VEHICLES[cls].price,stuck:0,honkAt:0,crashedUntil:0,meet:false};}

describe('200 authored additional models',()=>{
 it('adds exactly 200 unique badges and ids across twenty authored body families',()=>{
   const entries=Object.entries(EXPANDED_FLEET);expect(entries).toHaveLength(200);expect(new Set(entries.map(([,m])=>m.name)).size).toBe(200);expect(EXPANSION_BODY_FAMILIES).toHaveLength(20);
   for(const[id,m]of entries)expect(FLEET_MODELS[id as keyof typeof FLEET_MODELS],id).toBe(m);
 });
 it('gives every model a distinct physical silhouette and an authored body definition',()=>{
   const signatures=new Set<string>();
   for(const[id,m]of Object.entries(EXPANDED_FLEET)){
     signatures.add(JSON.stringify([m.length,m.width,m.height,m.body?.shape]));
     expect(fleetBody(id)?.family,id).toBe(m.body?.family);expect(m.body?.shape.rh,id).toBeGreaterThan(.7);
     const d=VEHICLES[id as VehicleClass],g=vehicleGeometry(car(id as VehicleClass));expect(d.design).toBe(m);expect(g.wheelbase).toBeLessThan(g.length);expect(g.wheelbase).toBeGreaterThan(g.length*.5);
     expect(d.colors.length).toBeGreaterThanOrEqual(2);expect(d.accel).toBeGreaterThan(0);expect(d.brake).toBeGreaterThan(0);expect(d.grip).toBeGreaterThan(0);expect(d.traffic).toBe(m.traffic);
   }
   expect(signatures.size).toBe(200);
 });
 it('keeps commercial, exotic and emergency traffic less common than everyday cars',()=>{
   expect(VEHICLES.quarry.traffic).toBeLessThan(VEHICLES.fern.traffic);expect(VEHICLES.shard.traffic).toBeLessThan(VEHICLES.fern.traffic);
   expect(VEHICLES.rapidmedic.tier).toBe('emergency');expect(VEHICLES.rescuepump.tier).toBe('emergency');expect(VEHICLES.rangerpatrol.tier).toBe('emergency');
 });
 it('uses a stable chassis cache without sharing per-vehicle state',()=>{
   const a=car('watercart'),b=car('watercart');expect(vehicleGeometry(a)).toBe(vehicleGeometry(a));expect(vehicleGeometry(a)).not.toBe(vehicleGeometry(b));
   setPayload(a,3);expect(utilityState(a)?.payload).toBe(3);expect(utilityState(b)?.payload).not.toBe(3);
 });
});

describe('working load mechanics',()=>{
 it('connects payload to the actual player drivetrain and brake response',()=>{
   const fixture=(payload:number)=>{const s=small(19,{trafficCars:0,midCount:0,backgroundCount:0});s.vehicles=[];s.world.tiles.fill(16);s.world.blocked.fill(0);for(const c of s.chars){c.x=2;c.y=2;}s.rebuildHash();const v=makeVehicle(s,'stockman',40,42,0,'parked');seat(s,s.player,v);v.state='free';setPayload(v,payload);return{s,v};};
   const empty=fixture(0),full=fixture(1.1);
   try{
     Object.assign(playerInput,{throttle:1,steer:0,brake:false});
     for(let i=0;i<60;i++)for(const f of[empty,full]){f.v.x=40;f.v.y=42;f.s.tick++;updateVehicles(f.s,1/60);}
     expect(empty.v.speed).toBeGreaterThan(full.v.speed*1.25);expect(full.v.utility!.engineLoad).toBeGreaterThan(0);
     for(const f of[empty,full]){f.v.speed=6;f.v.vx=6;f.v.vy=0;f.v.heading=0;f.v.yaw=0;}
     Object.assign(playerInput,{throttle:-1,steer:0,brake:false});
     for(let i=0;i<20;i++)for(const f of[empty,full]){f.v.x=40;f.v.y=42;f.s.tick++;updateVehicles(f.s,1/60);}
     expect(full.v.speed).toBeGreaterThan(empty.v.speed);expect(full.v.utility!.brakeHeat).toBeGreaterThan(0);
   }finally{Object.assign(playerInput,{throttle:0,steer:0,brake:false});}
 });
 it('preserves ordinary passenger-car tuning exactly',()=>{
   const v=car('super'),d=utilityDynamics(v);expect(utilitySpec(v)).toBeUndefined();expect(d).toMatchObject({active:false,mass:VEHICLES.super.mass,massRatio:1,acceleration:1,braking:1,turnResponse:1,roll:1,grip:1,engineDrag:0,steering:1});
 });
 it('makes a loaded truck slower to accelerate and turn, with greater roll and stopping demand',()=>{
   const v=car('timberline');setPayload(v,0);const empty=utilityDynamics(v);setPayload(v,3.5);const loaded=utilityDynamics(v);
   expect(loaded.mass).toBeCloseTo(VEHICLES.timberline.mass+3.5);expect(loaded.acceleration).toBeLessThan(empty.acceleration);expect(loaded.braking).toBeLessThan(empty.braking);expect(loaded.turnResponse).toBeLessThan(empty.turnResponse);expect(loaded.roll).toBeGreaterThan(empty.roll);
 });
 it('clamps loading to rated capacity and ignores invalid or unsupported loads',()=>{
   const v=car('watercart');expect(setPayload(v,999)).toBe(5);expect(setPayload(v,-1)).toBe(0);expect(setPayload(v,NaN)).toBe(0);expect(setPayload(car('super'),3)).toBe(0);
 });
 it('full mechanical repair restores brakes and suspension feedback without deleting the cargo',()=>{
   const v=car('watercart');setPayload(v,3);v.utility!.brakeHeat=1;v.utility!.sway=.2;v.utility!.swayVelocity=.3;repairVehicle(v);
   expect(v.utility!.payload).toBe(3);expect(v.utility!.brakeHeat).toBe(0);expect(v.utility!.sway).toBe(0);expect(v.utility!.swayVelocity).toBe(0);
 });
 it('builds brake heat under sustained heavy braking and cools it with airflow',()=>{
   const v=car('quarry');setPayload(v,6.1);
   for(let i=0;i<600;i++)stepUtility(v,-7,0,10,true,1/60);
   const hot=utilityDynamics(v);expect(v.utility!.brakeHeat).toBeGreaterThan(.55);
   for(let i=0;i<1800;i++)stepUtility(v,0,0,10,false,1/60);
   expect(v.utility!.brakeHeat).toBeLessThan(.1);expect(utilityDynamics(v).braking).toBeGreaterThan(hot.braking);
 });
 it('slosh is strongest in a partially filled tanker, and settles after a turn',()=>{
   const half=car('watercart'),full=car('watercart');setPayload(half,2.5);setPayload(full,5);
   for(let i=0;i<120;i++){stepUtility(half,0,7,6,false,1/60);stepUtility(full,0,7,6,false,1/60);}
   expect(Math.abs(half.utility!.sway)).toBeGreaterThan(Math.abs(full.utility!.sway)+.02);
   for(let i=0;i<600;i++)stepUtility(half,0,0,6,false,1/60);expect(Math.abs(half.utility!.sway)).toBeLessThan(.001);
 });
 it('bounds suspension feedback across step rates and a long frame',()=>{
   const a=car('watercart'),b=car('watercart');setPayload(a,2.5);setPayload(b,2.5);
   for(let i=0;i<60;i++)stepUtility(a,2,5,5,false,1/60);for(let i=0;i<120;i++)stepUtility(b,2,5,5,false,1/120);
   expect(a.utility!.sway).toBeCloseTo(b.utility!.sway,4);stepUtility(a,10000,10000,10000,true,10);expect(Math.abs(a.utility!.sway)).toBeLessThanOrEqual(.28);expect(a.utility!.brakeHeat).toBeLessThanOrEqual(1);
 });
 it('diesels use working revs, while electric buses keep a single forward ratio',()=>{
   const diesel=car('quarry'),ev=car('quietlink');for(let i=0;i<180;i++){stepPowertrain(diesel,7,9,1,1/60);stepPowertrain(ev,8,10,1,1/60);}
   expect(diesel.powertrain!.rpm).toBeLessThanOrEqual(3600);expect(diesel.powertrain!.rpm).toBeGreaterThan(700);expect(ev.powertrain!.gear).toBe(1);expect(engineRevFraction(diesel)).toBeGreaterThan(0);expect(engineRevFraction(diesel)).toBeLessThanOrEqual(1);
 });
 it('persists the exact load and mechanical state through saves',()=>{
   const s=small(14),v=makeVehicle(s,'watercart',30,42,0,'parked');setPayload(v,3.2);stepUtility(v,-5,4,7,true,.1);
   const loaded=restore(serialize(s)).vehicles.find(c=>c.plate===v.plate)!;expect(loaded.cls).toBe('watercart');expect(loaded.utility).toEqual(v.utility);
 });
});
