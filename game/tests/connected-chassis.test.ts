import {describe,it,expect} from 'vitest';
import {strikeLattice,stepLattice,upgradeLattice,crashPositions,latticeFailure} from '../src/sim/CrashLattice';
import {vehicleDeformer} from '../src/render/VehicleMesh';
import type {Vehicle} from '../src/entities/types';

describe('connected crash chassis',()=>{
 it('persists localized crush and weakened links after motion settles',()=>{
  let state=strikeLattice(undefined,.45,0,1,0,1);expect(state.nodes).toHaveLength(200);expect(state.linkDamage!.some(x=>x>0)).toBe(true);
  for(let i=0;i<300;i++)stepLattice(state,1/120);
  expect(state.active).toBe(0);expect(state.nodes.some((n,i)=>n.x<crashPositions[i][0]-.001)).toBe(true);
  expect(state.nodes.every(n=>[n.x,n.y,n.z,n.vx,n.vy,n.vz].every(Number.isFinite))).toBe(true);expect(latticeFailure(state)).toBeGreaterThan(0);
  const saved=JSON.parse(JSON.stringify(state));expect(upgradeLattice(saved).nodes).toEqual(state.nodes);
 });
 it('yields under sustained strain and retains failure after save and reload',()=>{
  const state=strikeLattice(undefined,.45,0,1,0,.8),before=state.nodes.map(n=>[n.restX,n.restY] as const);
  for(const n of state.nodes)if(n.restX>.1){n.x+=.16;n.vx+=.8;}
  const oldDamage=[...state.linkDamage!];for(let i=0;i<60;i++)stepLattice(state,1/120);
  expect(state.linkDamage!.some((d,i)=>d>oldDamage[i]+.0001)).toBe(true);
  expect(state.nodes.some((n,i)=>Math.abs(n.restX-before[i][0])>.00001||Math.abs(n.restY-before[i][1])>.00001)).toBe(true);
  const restored=upgradeLattice(JSON.parse(JSON.stringify(state)));expect(restored.linkDamage).toEqual(state.linkDamage);
  for(let i=0;i<300;i++)stepLattice(restored,1/120);expect(restored.nodes.every(n=>[n.x,n.y,n.z,n.vx,n.vy,n.vz].every(Number.isFinite))).toBe(true);
 });
 it('migrates a 24-point chassis with its deformation and weakened links',()=>{
  const nodes=Array.from({length:24},(_,i)=>{const x=-.45+Math.floor(i%12/3)*.3,y=(i%3-1)*.4,z=i>=12?.9:.16;return{x:x-.04,y,z,restX:x-.04,restY:y,restZ:z,vx:.1,vy:0,vz:0};});
  const next=upgradeLattice({version:2,nodes,active:1,linkDamage:Array(200).fill(.4)});
  expect(next.version).toBe(4);expect(next.nodes).toHaveLength(200);expect(next.nodes.every((n,i)=>Math.abs(n.x-crashPositions[i][0]+.04)<1e-8)).toBe(true);
  expect(next.linkDamage!.every(n=>n===.4)).toBe(true);expect(next.active).toBe(1);
 });
 it('migrates the 50-point lattice including motion and link damage',()=>{
  const nodes=Array.from({length:50},(_,i)=>{const x=-.45+Math.floor(i%25/5)*.225,y=-.4+(i%5)*.2,z=i>=25?.9:.16;return{x:x-.035,y:y+.01,z,restX:x-.035,restY:y+.01,restZ:z,vx:.1,vy:.2,vz:0};});
  const next=upgradeLattice({version:3,nodes,active:1,linkDamage:Array(500).fill(.35)});
  expect(next.version).toBe(4);expect(next.nodes).toHaveLength(200);expect(next.nodes.every((n,i)=>Math.abs(n.x-crashPositions[i][0]+.035)<1e-8&&Math.abs(n.y-crashPositions[i][1]-.01)<1e-8)).toBe(true);
  expect(next.linkDamage!.every(n=>n===.35)).toBe(true);expect(next.active).toBe(1);
 });
 it('moves the visible mesh with a point in the 200-node lattice',()=>{
  const lattice=strikeLattice(undefined,.45,0,1,0,.8);for(let i=0;i<lattice.nodes.length;i++){const p=crashPositions[i],n=lattice.nodes[i];n.x=p[0];n.y=p[1];n.z=p[2];}
  lattice.nodes[144].z!+=.08;
  const car={components:{lattice}} as unknown as Vehicle,fn=vehicleDeformer(car,1,1,1,[]);
  expect(fn).toBeDefined();expect(fn!([crashPositions[144][0],crashPositions[144][1],.9])[2]).toBeGreaterThan(.96);
 });
 it('migrates permanent offsets from existing six-point saves',()=>{
  const old={active:0,nodes:[[-.42,-.4],[-.42,.4],[0,-.4],[0,.4],[.42,-.4],[.42,.4]].map(([x,y])=>({x:x-.03,y,restX:x-.03,restY:y,vx:0,vy:0}))};
  const next=upgradeLattice(old);expect(next.nodes).toHaveLength(200);expect(next.nodes.every((n,i)=>n.x<crashPositions[i][0])).toBe(true);
 });
});
