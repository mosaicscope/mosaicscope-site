import {expect,it} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {blastVehicle} from '../src/sim/VehicleDamage';
it('applies stronger blast damage on the exposed side',()=>{
 const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0});
 const near=makeVehicle(s,'sedan',30,30,0,'free'),far=makeVehicle(s,'sedan',40,40,0,'free');
 blastVehicle(near,1,0,3,1);blastVehicle(far,1,0,.4,1);
 expect(near.damage).toBeGreaterThan(far.damage);expect(near.components!.panels[0]).toBeGreaterThan(far.components!.panels[0]);
});
