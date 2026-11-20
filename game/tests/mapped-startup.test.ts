import {expect,it,vi} from 'vitest';
import {Rng} from '../src/core/rng';
import {Simulation} from '../src/sim/Simulation';

it('starts the mapped world when a traffic driver is impaired during spawning',()=>{
 const original=Rng.prototype.int;
 const roll=vi.spyOn(Rng.prototype,'int').mockImplementation(function(this:Rng,min,max){
  return min===0&&max===199?0:original.call(this,min,max);
 });
 try {
  const sim=new Simulation({cityMap:'christchurch',trafficCars:100,backgroundCount:90,midCount:0});
  expect(sim.chars.some(c=>c.inCar>=0&&(c.substances?.levels.alcohol??0)>0)).toBe(true);
  expect(sim.events.defs.has('substance_use')).toBe(true);
  expect(()=>sim.step()).not.toThrow();
 } finally {roll.mockRestore();}
},30000);
