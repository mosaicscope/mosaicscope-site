import {expect,it} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {updateFireResponse} from '../src/sim/FireResponse';
it('applies character fire and a nearby fire engine sprays and puts the vehicle out',()=>{
 const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0});s.vehicles=[];const fire=makeVehicle(s,'sedan',30,30,0,'free');fire.burning=true;fire.heat=1;
 const truck=makeVehicle(s,'fire',35,30,0,'parked');truck.fireTarget=fire.id;s.player.x=30;s.player.y=30;
 s.tick=15;updateFireResponse(s);expect(s.player.fireUntil).toBeGreaterThan(s.tick);expect(s.liquids.drops.length).toBeGreaterThan(0);
 s.tick=375;updateFireResponse(s);expect(fire.burning).toBe(false);expect(truck.fireTarget).toBeUndefined();
});
