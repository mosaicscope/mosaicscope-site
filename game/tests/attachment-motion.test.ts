import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {components} from '../src/sim/VehicleDamage';
import {progressive,advanceAttachments} from '../src/sim/ProgressiveDamage';

describe('damaged vehicle hinges',()=>{
 it('simulates individual loose panels with bounded movement and saves it',()=>{
  const sim=small(3),v=makeVehicle(sim,'sedan',40,40,0,'free'),p=components(v);p.hood=.2;p.hoodLoose=true;p.boot=.3;p.doorHinges=[.25,1];p.doorGone=[false,false];const state=progressive(p);v.speed=15;v.vx=15;v.vy=0;v.yaw=.5;
  for(let i=0;i<120;i++)advanceAttachments(v,1/60);
  expect(state.hinges).toHaveLength(4);expect(state.hinges![0].angle).toBeGreaterThan(.01);expect(state.hinges![1].angle).toBeGreaterThan(.01);expect(state.hinges![2].angle).toBeGreaterThan(.01);expect(state.hinges![3].angle).toBe(0);
  expect(state.hinges!.every(h=>Number.isFinite(h.angle)&&h.angle>=0&&h.angle<=1.15&&Number.isFinite(h.velocity))).toBe(true);
  const saved=JSON.parse(JSON.stringify(p));expect(saved.progressive.hinges).toEqual(state.hinges);
  p.hood=1;p.hoodLoose=false;advanceAttachments(v,1/60);expect(state.hinges![0].angle).toBe(0);
 });
});
