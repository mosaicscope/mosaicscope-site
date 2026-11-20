import {expect,it} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {busDestination,isServiceBus} from '../src/sim/BusService';
it('connects a spawned city bus to a stop using the mapped Bus Interchange',()=>{
 const s=new Simulation({cityMap:'christchurch',trafficCars:120,backgroundCount:60,midCount:0});
 const bus=s.vehicles.find(v=>v.state==='drive'&&isServiceBus(v)&&v.driver>=0);expect(bus).toBeDefined();expect(busDestination(s,bus!)).toBeDefined();
},30000);

it('runs the mapped city with traffic, bus waiting and local props together',()=>{
 const s=new Simulation({cityMap:'christchurch',trafficCars:120,backgroundCount:60,midCount:0});
 for(let i=0;i<620;i++)s.step();
 expect(s.tick).toBe(620);expect(s.vehicles.some(v=>v.state==='drive'&&isServiceBus(v))).toBe(true);
 expect(s.cityPlay.props.length).toBeGreaterThan(0);
},60000);
