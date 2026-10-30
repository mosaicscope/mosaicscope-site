import {expect,it} from 'vitest';
import {small} from './helpers';
import {makeVehicle,seat} from '../src/sim/Traffic';
import {busDestination,serviceBus,releaseBusPassengers} from '../src/sim/BusService';
import {T} from '../src/world/World';
it('boards a waiting passenger and drops them at the exchange',()=>{
 const s=small(3,{trafficCars:0,midCount:0,backgroundCount:6});s.vehicles=[];s.world.tiles.fill(T.SIDEWALK);s.world.blocked.fill(0);s.world.buildings[0].name='Bus Exchange';s.world.buildings[0].door.x=30;s.world.buildings[0].door.y=30;s.world.pois=[{id:0,kind:'busstop',x:30,y:30,area:0},{id:1,kind:'busstop',x:40,y:40,area:0}];
 const rider=s.chars.find(c=>c.tier==='background')!;for(const c of s.chars){c.x=c.px=5;c.y=c.py=5;c.inCar=-1;c.inside=-1;}rider.x=40;rider.y=40;rider.phys=0;rider.talkWith=-1;rider.arrestedBy=-1;
 const bus=makeVehicle(s,'bus',40,40,0,'drive');seat(s,s.player,bus);expect(busDestination(s,bus)).toEqual({id:1,kind:'busstop',x:40,y:40,area:0});expect(serviceBus(s,bus)).toBe(true);expect(rider.inCar).toBe(bus.id);
 s.tick+=180;expect(serviceBus(s,bus)).toBe(false);expect(busDestination(s,bus)?.x).toBe(30);bus.x=30;bus.y=30;expect(serviceBus(s,bus)).toBe(true);expect(rider.inCar).toBe(-1);expect(Math.hypot(rider.x-30,rider.y-30)).toBeLessThan(3);
 releaseBusPassengers(s,bus);
});
