import {trafficRadiusForView} from '../src/sim/TrafficBudget';
import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {T} from '../src/world/World';
import type {MappedCity} from '../src/world/MappedWorld';
import {makeVehicle} from '../src/sim/Traffic';
import {advanceDistantTraffic,driveMappedVehicle,snapMappedVehicle,refreshCityPopulation} from '../src/sim/MappedTraffic';
import {chassisContact} from '../src/sim/VehicleGeometry';
function rig(){const s=small(42,{trafficCars:0,midCount:0,backgroundCount:0});s.vehicles=[];s.world.tiles.fill(T.ROAD);s.world.blocked.fill(0);s.chars.forEach(c=>{c.x=c.px=2;c.y=c.py=2;});s.rebuildHash();s.world.mapped={streetSegments:[{id:1,name:'Fixture Street',kind:'residential',x:20,y:40,dx:1,dy:0,length:20,half:2,oneway:0,speed:5},{id:2,name:'Fixture Street',kind:'residential',x:40,y:40,dx:1,dy:0,length:100,half:2,oneway:0,speed:5}],trafficMode:'city'} as MappedCity;return s;}
describe('unblocked city traffic',()=>{
 it('enters the receiving lane when the opposite lane has a waiting car',()=>{const s=rig(),v=makeVehicle(s,'hatch',39.95,39.05,0,'drive'),other=makeVehicle(s,'hatch',43,40.95,2,'drive');v.heading=0;v.speed=4;other.heading=Math.PI;other.speed=0;expect(snapMappedVehicle(s,v)).toBe(true);driveMappedVehicle(s,v,1/30);expect(v.x).toBeGreaterThan(40);expect(v.speed).toBeGreaterThan(0);expect(chassisContact(v,other)).toBeNull();});
 it('does not continually refill an already busy normal-city neighbourhood',()=>{const s=rig();s.player.x=40;s.player.y=40;for(let i=0;i<85;i++)makeVehicle(s,'hatch',20+i%10*3,45+Math.floor(i/10)*3,0,'drive');const far=makeVehicle(s,'hatch',200,39.05,0,'drive'),before={x:far.x,y:far.y};refreshCityPopulation(s);expect({x:far.x,y:far.y}).toEqual(before);});
 it('keeps the detailed bubble around the current view and expands it for overview',()=>{expect(trafficRadiusForView(1280,800,1.8)).toBe(32);expect(trafficRadiusForView(1920,1080,.55)).toBeGreaterThan(75);expect(trafficRadiusForView(390,844,1.6)).toBeLessThan(40);});
 it('allows cars to cross the detailed/coarse boundary in either direction',()=>{const s=rig();s.focus={x:0,y:40};const outward=makeVehicle(s,'hatch',80.5,39.05,0,'drive');outward.heading=0;s.tick=outward.id%60;snapMappedVehicle(s,outward);advanceDistantTraffic(s);expect(outward.x).toBeGreaterThan(80.5);const inward=makeVehicle(s,'hatch',82.5,40.95,2,'drive');inward.heading=Math.PI;s.tick=inward.id%60;snapMappedVehicle(s,inward);advanceDistantTraffic(s);expect(inward.x).toBeLessThan(80);});
 it('advances distant cars on their staggered coarse update while preserving safe separation',()=>{const s=rig();s.focus={x:0,y:0};const v=makeVehicle(s,'hatch',100,39.05,0,'drive');v.heading=0;expect(snapMappedVehicle(s,v)).toBe(true);const x=v.x;s.tick=v.id%60;advanceDistantTraffic(s);expect(v.x).toBeGreaterThan(x);expect(s.world.drivable(v.x,v.y)).toBe(true);const nearby=makeVehicle(s,'hatch',v.x+3,39.05,0,'parked');s.tick+=60;advanceDistantTraffic(s);expect(chassisContact(v,nearby)).toBeNull();});
});
