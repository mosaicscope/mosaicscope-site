import {describe,it,expect} from 'vitest';
import {strikeLattice,stepLattice,upgradeLattice,crashPositions,latticeFailure} from '../src/sim/CrashLattice';

describe('connected crash chassis',()=>{
 it('persists localized crush and weakened links after motion settles',()=>{
  let state=strikeLattice(undefined,.45,0,1,0,1);expect(state.nodes).toHaveLength(24);expect(state.linkDamage!.some(x=>x>0)).toBe(true);
  for(let i=0;i<300;i++)stepLattice(state,1/120);
  expect(state.active).toBe(0);expect(state.nodes.some((n,i)=>n.x<crashPositions[i][0]-.001)).toBe(true);
  expect(state.nodes.every(n=>[n.x,n.y,n.z,n.vx,n.vy,n.vz].every(Number.isFinite))).toBe(true);expect(latticeFailure(state)).toBeGreaterThan(0);
  const saved=JSON.parse(JSON.stringify(state));expect(upgradeLattice(saved).nodes).toEqual(state.nodes);
 });
 it('migrates permanent offsets from existing six-point saves',()=>{
  const old={active:0,nodes:[[-.42,-.4],[-.42,.4],[0,-.4],[0,.4],[.42,-.4],[.42,.4]].map(([x,y])=>({x:x-.03,y,restX:x-.03,restY:y,vx:0,vy:0}))};
  const next=upgradeLattice(old);expect(next.nodes).toHaveLength(24);expect(next.nodes.every((n,i)=>n.x<crashPositions[i][0])).toBe(true);
 });
});
