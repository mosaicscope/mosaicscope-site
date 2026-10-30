import {describe,it,expect} from 'vitest';
import {sweptRailContact} from '../src/sim/RailCollision';
import {makeVehicle} from '../src/sim/Traffic';
import {small} from './helpers';
import type {MappedCity} from '../src/world/MappedWorld';
const map={metresPerTile:2,offsetX:0,offsetY:0,revision:0,data:[{barriers:[{id:1,kind:'guard_rail',points:[[0,0],[40,0]],tags:{}}]}]} as unknown as MappedCity;
describe('mapped guardrail collision',()=>{
 it('detects a fast crosswise impact and supplies a normal',()=>{const v=makeVehicle(small(4,{trafficCars:0,midCount:0,backgroundCount:0}),'sedan',8,-5,Math.PI/2,'free');const hit=sweptRailContact(map,v,8,5);expect(hit).not.toBeNull();expect(hit!.t).toBeGreaterThan(0);expect(hit!.t).toBeLessThan(1);expect(hit!.ny).toBe(1);});
 it('allows parallel motion and leaving a rail after contact',()=>{const v=makeVehicle(small(4,{trafficCars:0,midCount:0,backgroundCount:0}),'sedan',8,-.4,0,'free');expect(sweptRailContact(map,v,10,-.4)).toBeNull();expect(sweptRailContact(map,v,8,-3)).toBeNull();});
 it('does not invent rails on unrelated roads',()=>{const v=makeVehicle(small(4,{trafficCars:0,midCount:0,backgroundCount:0}),'sedan',30,-5,Math.PI/2,'free');expect(sweptRailContact(map,v,30,5)).toBeNull();});
});
