import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {stepImpactRagdoll,impactRagdollPose,clearImpactRagdoll} from '../src/physics/ImpactRagdoll';
import {makeVehicle} from '../src/sim/Traffic';

describe('impact body',()=>{
 it('keeps articulated limbs and head finite through repeated car and ground contacts',()=>{
  const sim=small(3),c=sim.player;c.x=40;c.y=40;c.z=0;c.kx=2;c.ky=-1;c.vz=1;
  const v=makeVehicle(sim,'sedan',40.2,40,0,'free');v.vx=3;v.vy=0;
  for(let i=0;i<240;i++)stepImpactRagdoll(c,sim.world,1/60,[v]);
  const pose=impactRagdollPose(c);expect(pose).toHaveLength(9);expect(pose.every(Number.isFinite)).toBe(true);expect([c.kx,c.ky,c.vz].every(Number.isFinite)).toBe(true);
  clearImpactRagdoll(c);expect(impactRagdollPose(c)).toEqual(Array(9).fill(0));
 });
});
