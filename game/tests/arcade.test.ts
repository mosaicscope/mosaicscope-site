import { describe, expect, it } from 'vitest';
import { makeScratch, revealScratch, dealBaccarat } from '../src/sim/Arcade';
import { serialize, restore } from '../src/persistence/SaveSystem';
import { small } from './helpers';

describe('graphical arcade outcomes',()=>{
 it('prints the payout before scratching and pays once after the third panel',()=>{
  const t=makeScratch(10,1000,()=>.1);expect(t.payout).toBe(20);expect(new Set(t.symbols).size).toBe(1);
  expect(revealScratch(t,0)).toBe(0);expect(revealScratch(t,0)).toBe(0);expect(revealScratch(t,2)).toBe(0);
  expect(revealScratch(t,1)).toBe(20);expect(revealScratch(t,1)).toBe(0);expect(t.paid).toBe(true);
 });
 it('retains unfinished ticket symbols and reveal progress across save/load',()=>{
  const sim=small();sim.expansion.casino.scratch=makeScratch(10,1000,()=>.001);revealScratch(sim.expansion.casino.scratch,1);
  const next=restore(serialize(sim)).expansion.casino.scratch!;expect(next.mask).toBe(2);expect(next.paid).toBe(false);
  expect(revealScratch(next,0)).toBe(0);expect(revealScratch(next,2)).toBe(200);expect(revealScratch(next,2)).toBe(0);
 });
 it('prints a distinct losing trio and rejects invalid stakes',()=>{
  const t=makeScratch(10,1000,()=>.8);expect(t.payout).toBe(0);expect(new Set(t.symbols).size).toBe(3);
  for(const n of [NaN,Infinity,0,501])expect(()=>makeScratch(n,1000)).toThrow();
 });
 it('shows the actual baccarat cards and uses their totals',()=>{
  for(let i=0;i<1000;i++){const d=dealBaccarat();const total=(v:number[])=>v.reduce((a,n)=>a+(n>=10?0:n),0)%10;expect(d.p).toBe(total(d.player));expect(d.b).toBe(total(d.banker));expect(d.player.length).toBeLessThanOrEqual(3);expect(d.banker.length).toBeLessThanOrEqual(3);}
 });
});
