import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {vehicleWallProfile} from '../src/sim/VehicleWallProfile';
import {vehicleGeometry} from '../src/sim/VehicleGeometry';
import {impactComponents} from '../src/sim/VehicleDamage';

describe('vehicle wall profile',()=>{
 it('projects model-specific body geometry at different angles and preserves deformation',()=>{
  const sim=small(7),sedan=makeVehicle(sim,'sedan',40,40,0,'free'),van=makeVehicle(sim,'van',40,40,0,'free');
  const profile=(v:typeof sedan)=>vehicleWallProfile(v,0,1,1,4,0,8);
  const a=profile(sedan),b=profile(van);expect(a.contour.length).toBeGreaterThanOrEqual(3);expect(a.contour).not.toEqual(b.contour);expect(b.height).toBeGreaterThan(a.height);
  const front=a.contour;sedan.heading=Math.PI/2;expect(profile(sedan).contour).not.toEqual(front);
  const before=profile(sedan).contour;impactComponents(sedan,0,1,12,1.5,1,{x:40,y:40.4});expect(profile(sedan).contour).not.toEqual(before);
  expect(profile(sedan).height*1.625).toBeGreaterThanOrEqual(vehicleGeometry(sedan).height);
  expect(profile(sedan).contour.every(p=>p.every(Number.isFinite))).toBe(true);
 });
});
