import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {impactComponents,repairVehicle} from '../src/sim/VehicleDamage';
import {vehicleCondition} from '../src/sim/VehicleCondition';
import {ENGINE} from '../src/audio/Diegetic';
const car=()=>makeVehicle(small(42,{trafficCars:0,midCount:0,backgroundCount:0}),'sedan',30,40,0,'free');
describe('vehicle condition display',()=>{
 it('reads crash damage and individual parts without creating state, and clears after repair',()=>{const v=car();expect(vehicleCondition(v).worst).toBe(0);expect(v.components).toBeUndefined();impactComponents(v,1,0,12,1,1);const c=vehicleCondition(v);expect(c.zones[0]).toBeGreaterThan(0);expect(c.issues.length).toBeGreaterThan(0);repairVehicle(v);expect(vehicleCondition(v).worst).toBe(0);});
 it('only estimates burnout when the actual heat model is advancing',()=>{const v=car();v.engineDamage=.8;v.driver=0;v.speed=0;expect(vehicleCondition(v).forecast).toContain('moving will build heat');v.speed=3;v.heat=.7;expect(vehicleCondition(v).forecast).toContain('32 s');v.burning=true;v.burnTime=7;expect(vehicleCondition(v).forecast).toContain('5 s');v.burnt=true;expect(vehicleCondition(v).forecast).toContain('disabled');});
 it('keeps distinct engine notes for different vehicle models',()=>{expect(ENGINE.kei_coupe).not.toEqual(ENGINE.retro_micro);expect(ENGINE.compact_ev).not.toEqual(ENGINE.estate_ev);expect(ENGINE.rally_sedan).not.toEqual(ENGINE.box_suv);});
});
