import {describe,it,expect} from 'vitest';
import {Running} from '../src/sim/Running';
import {World,T} from '../src/world/World';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
describe('responsive progressive running',()=>{
 it('builds to a bounded sprint substantially faster than the old fixed boost',()=>{const r=new Running();let first=0,last=0,energy=0;for(let i=0;i<240;i++){const s=r.step(1.6,true,1,1,1/60);if(i===30)first=s.speed;last=s.speed;energy+=s.energyCost;}expect(last).toBeGreaterThan(1.6*1.35*1.5);expect(last).toBeCloseTo(1.6*2.4,6);expect(last).toBeGreaterThan(first);expect(energy).toBeLessThan(4*.012);});
 it('uses analog pressure for fine walking, and never turns a diagonal into a speed exploit',()=>{const a=new Running(),b=new Running();let gentle=0,full=0;for(let i=0;i<60;i++){gentle=a.step(1.6,false,1,.2,1/60).speed;full=b.step(1.6,false,1,Math.SQRT2,1/60).speed;}expect(gentle).toBeCloseTo(full*.2,6);expect(full).toBeCloseTo(1.6*1.25,6);});
 it('keeps speed and stamina consistent across input rates',()=>{const run=(hz:number)=>{const r=new Running();let energy=0,result=0;for(let i=0;i<hz*3;i++){const s=r.step(1.6,true,1,1,1/hz);energy+=s.energyCost;result=s.speed;}return{energy,result};};const a=run(30),b=run(120);expect(a.result).toBeCloseTo(b.result,6);expect(a.energy).toBeCloseTo(b.energy,4);});
 it('clears the sprint on release and respects low energy without silently changing base speed',()=>{const r=new Running();for(let i=0;i<180;i++)r.step(1.6,true,1,1,1/60);expect(r.step(1.6,true,0,1,1/60).multiplier).toBe(1.25);r.reset();expect(r.step(1.6,true,1,0,1/60).speed).toBe(0);expect(r.step(1.6,true,1,1,1/60).multiplier).toBeLessThan(1.77);expect(r.step(NaN,true,1,1,1/60).speed).toBe(0);});
 it('still collides with walls at maximum sprint speed',()=>{const w=new World(16);for(let y=0;y<16;y++)w.set(8,y,T.WALL);const physics=new PhysicsWorld(w),r=new Running(),body={x:4,y:6,radius:.28,z:0};for(let i=0;i<360;i++)physics.moveCircle(body,r.step(1.6,true,1,1,1/60).speed/60,0);expect(body.x).toBeLessThan(8-.28);expect(body.x).toBeGreaterThan(7.5);});
});
