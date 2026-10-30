import {describe,it,expect} from 'vitest';
import {DrivingCamera} from '../src/render/DrivingCamera';
import {makeVehicle} from '../src/sim/Traffic';
import {small} from './helpers';
const car=()=>makeVehicle(small(8,{trafficCars:0,midCount:0,backgroundCount:0}),'sedan',20,20,0,'parked');
describe('driving chase camera',()=>{
 it('interpolates the car position and widens its view smoothly as speed increases',()=>{const v=car(),camera=new DrivingCamera();v.px=18;v.py=19;v.x=20;v.y=21;const slow={...camera.update(v,.5,1/60)};expect(slow.x).toBe(19);expect(slow.y).toBe(20);v.vx=50;v.vy=0;const first={...camera.update(v,1,1/60)};expect(first.focalFactor).toBeLessThan(slow.focalFactor);expect(first.focalFactor).toBeGreaterThan(.83);for(let i=0;i<180;i++)camera.update(v,1,1/60);const fast=camera.update(v,1,1/60);expect(fast.distance).toBeGreaterThan(slow.distance);expect(fast.focalFactor).toBeCloseTo(.85,2);const beforeCrash=fast.focalFactor;v.vx=0;const impact=camera.update(v,1,1/60);expect(impact.focalFactor-beforeCrash).toBeLessThan(.002);});
 it('looks slightly into a drift without turning around in reverse',()=>{const v=car(),camera=new DrivingCamera();v.vx=20;v.vy=10;for(let i=0;i<120;i++)camera.update(v,1,1/60);expect(camera.update(v,1,1/60).heading).toBeGreaterThan(0);v.vx=-20;v.vy=0;for(let i=0;i<120;i++)camera.update(v,1,1/60);expect(Math.abs(camera.update(v,1,1/60).heading)).toBeLessThan(.01);});
 it('takes the shortest path across the heading wrap and snaps when teleported',()=>{const v=car(),camera=new DrivingCamera();v.heading=Math.PI-.02;camera.update(v,1,1/60);v.heading=-Math.PI+.02;const p=camera.update(v,1,1/60);expect(Math.abs(p.heading-(Math.PI-.02))).toBeLessThan(.04);v.x+=100;v.px=v.x;v.heading=0;expect(camera.update(v,1,1/60).heading).toBe(0);});
 it('converges similarly at different display frame rates',()=>{const v=car(),a=new DrivingCamera(),b=new DrivingCamera();a.update(v,1,1/60);b.update(v,1,1/60);v.heading=1;for(let i=0;i<30;i++)a.update(v,1,1/30);for(let i=0;i<120;i++)b.update(v,1,1/120);expect(a.update(v,1,0).heading).toBeCloseTo(b.update(v,1,0).heading,5);});
});
