import {describe,it,expect} from 'vitest';
import {LiquidSystem} from '../src/sim/Liquid';
import {strikeUnderbody,stepUnderbody,underbodyDamage} from '../src/sim/Underbody';
import {small} from './helpers';
import {useSubstance,updateSubstances} from '../src/sim/Substances';
import {wound} from '../src/sim/Life';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {T} from '../src/world/World';
import {impactComponents} from '../src/sim/VehicleDamage';
import {workshopAction} from '../src/sim/VehicleWorkshop';

describe('liquid and underside physics',()=>{
 it('keeps 70 connected underside points, settles, and persists damage',()=>{const s=strikeUnderbody(undefined,.3,.2,1);expect(s.points).toHaveLength(70);const before=underbodyDamage(s);expect(before).toBeGreaterThan(0);for(let i=0;i<180;i++)stepUnderbody(s,1/60);expect(s.points.every(p=>Number.isFinite(p.z))).toBe(true);expect(underbodyDamage(JSON.parse(JSON.stringify(s)))).toBeCloseTo(before);});
 it('feeds underside damage into crash components and permits mechanical repair',()=>{const s=small();s.vehicles=[];const v=makeVehicle(s,'hatch',s.player.x,s.player.y,0,'parked');s.player.cash=1000;impactComponents(v,1,0,12,1,s.tick);expect(v.components?.underbody?.points).toHaveLength(70);expect(workshopAction(s,'mechanical',v.id).ok).toBe(true);expect(v.components?.underbody).toBeUndefined();});
 it('moves and settles droplets and propagates a bounded 70-point water disturbance',()=>{const l=new LiquidSystem();l.spray('vomit',0,0,1,1,0,5);l.disturb(3,3,8);expect(l.water[0].height).toHaveLength(70);for(let i=0;i<180;i++)l.step(1/60);expect(l.drops.some(d=>d.kind==='vomit'&&d.ground&&d.x>0)).toBe(true);expect([...l.water[0].height].some(x=>x!==0)).toBe(true);});
 it('places a second impact at its local position and produces fading foam',()=>{const l=new LiquidSystem();l.disturb(10,10,7,3,0,false);const patch=l.water[0],first=Array.from(patch.velocity);l.disturb(10.7,10,7,3,0,false);expect(l.water).toHaveLength(1);expect(patch.velocity[37]).toBeLessThan(first[37]);expect(Math.max(...patch.foam)).toBeGreaterThan(0);const before=patch.foam.reduce((a,b)=>a+b,0);for(let i=0;i<60;i++)l.step(1/60);expect(patch.foam.reduce((a,b)=>a+b,0)).toBeLessThan(before);});
 it('reflects water patches at banks and caps active work',()=>{const s=small(),l=new LiquidSystem();s.world.tiles.fill(T.ROAD);for(let y=20;y<24;y++)for(let x=20;x<24;x++)s.world.set(x,y,T.WATER);l.disturb(20,21,8);l.step(1/60,s.world);const p=l.water[0];expect(p.height[0]).toBe(0);for(let i=0;i<20;i++)l.disturb(30+i*3,30,4);expect(l.water.length).toBeLessThanOrEqual(8);});
 it('creates blood from actual injuries and vomit from intoxication',()=>{const s=small(),c=s.player;s.fakeBlood=true;wound(s,c,'arm',2,'cut',-1,c.x-1,c.y);expect(s.liquids.drops.some(d=>d.kind==='blood')).toBe(true);s.tick=0;useSubstance(s,c,'alcohol');s.tick=151;useSubstance(s,c,'alcohol');s.tick=180;updateSubstances(s);expect(s.liquids.drops.some(d=>d.kind==='vomit')).toBe(true);});
 it('lets a driven car enter water and produces displacement',()=>{const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0});s.vehicles=[];s.world.tiles.fill(T.ROAD);s.world.blocked.fill(0);for(let y=20;y<30;y++)for(let x=25;x<35;x++){const i=y*s.world.size+x;s.world.tiles[i]=T.WATER;s.world.blocked[i]=1;}const v=makeVehicle(s,'sedan',23,25,0,'free');seat(s,s.player,v);v.heading=0;v.speed=8;v.vx=8;v.vy=0;v.dynT=s.tick;Object.assign(playerInput,{throttle:1,steer:0,brake:false});try{for(let i=0;i<90&&v.x<25.2;i++){s.tick++;updateVehicles(s,1/60);}expect(v.x).toBeGreaterThan(25);expect(s.liquids.water.length).toBeGreaterThan(0);expect(s.liquids.water[0].height).toHaveLength(70);}finally{Object.assign(playerInput,{throttle:0,steer:0,brake:false});}});
});
