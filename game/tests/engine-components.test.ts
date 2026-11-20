import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {components,damageTick} from '../src/sim/VehicleDamage';
import {repairParts,partsEffects} from '../src/sim/VehicleParts';
import {vehicleInspection} from '../src/sim/VehicleCondition';

describe('engine components',()=>{
 it('keeps damaged engine components mounted with a closed bonnet, then detaches and reports an exposed failed fan',()=>{
  const sim=small(4),v=makeVehicle(sim,'sedan',40,40,0,'free'),p=components(v);v.driver=sim.playerId;v.speed=18;v.vx=18;v.vy=0;p.parts={cooling_fan:1};
  for(let i=0;i<180;i++)damageTick(v,1/60);expect(p.engineMounts?.cooling_fan?.detached).toBe(false);
  p.hoodGone=true;for(let i=0;i<3000&&!p.engineMounts?.cooling_fan?.detached;i++)damageTick(v,1/60);
  expect(p.engineMounts?.cooling_fan?.detached).toBe(true);expect(p.debris.some(d=>d.kind==='engine'&&d.part==='cooling_fan')).toBe(true);expect(partsEffects(v).cooling).toBeGreaterThan(0);expect(vehicleInspection(v).mechanical.join(' ')).toContain('cooling fan: detached');
  const saved=JSON.parse(JSON.stringify(p));expect(saved.engineMounts.cooling_fan.detached).toBe(true);repairParts(v,'mechanical');expect(p.engineMounts).toBeUndefined();expect(p.parts?.cooling_fan).toBeUndefined();
 });
 it('does not allocate mounts for a healthy car',()=>{const sim=small(4),v=makeVehicle(sim,'sedan',40,40,0,'free');components(v);damageTick(v,1/60);expect(v.components?.engineMounts).toBeUndefined();});
});
