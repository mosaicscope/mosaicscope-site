import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {resetDrivingTelemetry,stepDrivingTelemetry} from '../src/sim/DrivingTelemetry';
import {wheelContactControl} from '../src/sim/WheelContact';
function rig(){const sim=small(8,{trafficCars:0,midCount:0,backgroundCount:0});sim.vehicles=[];return makeVehicle(sim,'hatch',40,42,0,'free');}
describe('driving trip computer',()=>{
 it('measures distance in metres and peak speed in km/h',()=>{const v=rig();stepDrivingTelemetry(v,10,1,1,false,.2);expect(v.telemetry!.distance).toBe(2);expect(v.telemetry!.topKmh).toBe(72);});
 it('calculates signed longitudinal acceleration and lateral g forces',()=>{const v=rig();stepDrivingTelemetry(v,5,0,1,false,.1);v.yaw=.2;stepDrivingTelemetry(v,6,.5,1,false,.1);expect(v.telemetry!.longG).toBeCloseTo(2/9.81/.1);expect(v.telemetry!.latG).toBeCloseTo(.2*6*2/9.81);stepDrivingTelemetry(v,5,.5,0,true,.1);expect(v.telemetry!.longG).toBeLessThan(0);});
 it('records the best 0–100 acceleration run and cancels an abandoned run',()=>{const v=rig();stepDrivingTelemetry(v,0,0,0,false,.1);for(let i=1;i<=150;i++)stepDrivingTelemetry(v,i/10,.1,1,false,.1);expect(v.telemetry!.best0100).toBeGreaterThan(13);expect(v.telemetry!.best0100).toBeLessThan(15);stepDrivingTelemetry(v,0,0,0,false,.1);stepDrivingTelemetry(v,1,.1,1,false,.1);stepDrivingTelemetry(v,2,.1,0,false,.1);expect(v.telemetry!.launchActive).toBe(false);});
 it('records braking distance only for a complete 80–0 stop',()=>{const v=rig();stepDrivingTelemetry(v,12,1,0,true,.1);stepDrivingTelemetry(v,8,1,0,true,.1);stepDrivingTelemetry(v,0,0,0,true,.1);expect(v.telemetry!.lastBrakeDistance).toBeCloseTo((80/7.2-8)/4*2);});
 it('cancels braking-distance measurement if the brakes are released',()=>{const v=rig();stepDrivingTelemetry(v,12,1,0,true,.1);stepDrivingTelemetry(v,8,1,0,false,.1);stepDrivingTelemetry(v,0,0,0,true,.1);expect(v.telemetry!.lastBrakeDistance).toBeUndefined();});
 it('counts assist activations once per intervention',()=>{const v=rig();wheelContactControl(v,[.2,.2,.2,.2],10,0,0,1,false,true,1.5,.25);for(let i=0;i<5;i++)stepDrivingTelemetry(v,10,0,0,true,.1);expect(v.telemetry!.absEvents).toBe(1);});
 it('caps anomalous travel, ignores invalid inputs and can be reset',()=>{const v=rig();stepDrivingTelemetry(v,1,9999,0,false,.1);expect(v.telemetry!.distance).toBeLessThan(2);const before=v.telemetry!.distance;stepDrivingTelemetry(v,NaN,1,0,false,.1);expect(v.telemetry!.distance).toBe(before);resetDrivingTelemetry(v);expect(v.telemetry).toBeUndefined();});
 it('does not count reverse driving as a forward 0–100 run',()=>{const v=rig();stepDrivingTelemetry(v,0,0,0,false,.1);for(let i=1;i<=150;i++)stepDrivingTelemetry(v,-i/10,.1,-1,false,.1);expect(v.telemetry!.best0100).toBeUndefined();expect(v.telemetry!.launchActive).toBe(false);});
 it('persists trip readings when the vehicle is serialized',()=>{const v=rig();stepDrivingTelemetry(v,5,.5,0,false,.1);expect(JSON.parse(JSON.stringify(v)).telemetry.distance).toBe(1);});
});
