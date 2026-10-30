import {expect,it} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {impactComponents} from '../src/sim/VehicleDamage';
it('detaches the struck end only after a severe impact',()=>{
 const sim=small(3,{trafficCars:0,midCount:0,backgroundCount:0});
 const minor=makeVehicle(sim,'sedan',30,30,0,'free');
 impactComponents(minor,1,0,2,1.2,1,{x:31,y:30});
 expect(minor.components!.hoodGone).toBe(false);
 const severe=makeVehicle(sim,'sedan',40,40,0,'free');
 impactComponents(severe,1,0,14,1.2,1,{x:41,y:40});
 expect(severe.components!.hoodGone).toBe(true);
 expect(severe.components!.debris.some(d=>d.kind==='metal'&&d.size===.4)).toBe(true);
 expect(severe.components!.dents![0].depth).toBeGreaterThan(minor.components!.dents![0].depth);
});
