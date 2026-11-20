import {expect,it} from 'vitest';
import {FUSION_FLEET} from '../src/content/fusionFleet';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {impactComponents} from '../src/sim/VehicleDamage';
it('adds 50 fusion variants and ignites their battery on severe impacts',()=>{
 expect(Object.keys(FUSION_FLEET)).toHaveLength(50);
 const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0}),v=makeVehicle(s,'fusion_hyper_0',30,30,0,'free');
 impactComponents(v,1,0,14,1.2,1,{x:31,y:30});expect(v.burning).toBe(true);
});
