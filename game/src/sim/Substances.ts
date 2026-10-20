import type { Simulation } from './Simulation';
import type { Character } from '../entities/types';
import { Phys } from '../entities/types';

export type SubstanceKind = 'alcohol' | 'stimulant' | 'cannabis' | 'sedative';
export interface SubstanceState {
  levels: Record<SubstanceKind, number>;
  last: SubstanceKind;
  usedAt: number;
  actionUntil: number;
  updatedAt: number;
  crashUntil: number;
  crisis: boolean;
}
export const emptyLevels = () => ({ alcohol: 0, stimulant: 0, cannabis: 0, sedative: 0 });
export function restoreSubstances(value: unknown, tick: number): SubstanceState | undefined {
  if(!value||typeof value!=='object')return undefined;
  const raw=value as SubstanceState,levels=emptyLevels();
  for(const kind of Object.keys(levels) as SubstanceKind[]){const n=raw.levels?.[kind];levels[kind]=typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(3,n)):0;}
  const at=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(tick+60*600,n)):tick;
  return {levels,last:Object.prototype.hasOwnProperty.call(levels,raw.last)?raw.last:'alcohol',usedAt:Math.min(tick,at(raw.usedAt)),updatedAt:tick,actionUntil:at(raw.actionUntil),crashUntil:at(raw.crashUntil),crisis:raw.crisis===true};
}
export function impairment(c: Character): number {
  const l = c.substances?.levels; return l ? Math.min(.88, l.alcohol*.32+l.sedative*.4+l.cannabis*.18+l.stimulant*.07) : 0;
}
/** Abstract game-state effects, not real-world amounts, dosing or pharmacology. */
export function useSubstance(sim: Simulation, c: Character, kind: SubstanceKind): boolean {
  if (c.phys !== Phys.OK || c.substances?.crisis) return false;
  const s = c.substances ??= { levels: emptyLevels(), last: kind, usedAt: sim.tick, actionUntil: 0, updatedAt: sim.tick, crashUntil: 0, crisis: false };
  if (sim.tick < s.actionUntil) return false;
  s.levels[kind] = Math.min(3, s.levels[kind] + .75); s.last = kind; s.usedAt = sim.tick; s.updatedAt = sim.tick;
  s.actionUntil = sim.tick + 150; s.crashUntil = Math.max(s.crashUntil, sim.tick + 60*450);
  c.emo.mood = Math.min(.6, c.emo.mood + .08); c.needs.energy = Math.max(.08,c.needs.energy-.03);
  const l = s.levels;
  s.crisis = l.alcohol+l.stimulant+l.cannabis+l.sedative >= 2.9 || l.alcohol+l.sedative >= 2.2;
  if (s.crisis) { c.emo.composure = Math.min(c.emo.composure,.3); c.emo.fear = Math.max(.6,c.emo.fear); sim.callAmbulance(c); }
  sim.emit({type:'substance_use',x:c.x,y:c.y,actors:[c.id],summary:s.crisis?`${c.name} is unwell. Paramedics have been called.`:`${c.name} is visibly affected by ${kind}.`});
  return true;
}
export function substancePhase(c: Character, tick: number): string {
  const s = c.substances; if (!s) return 'Clear';
  if(s.crisis)return 'Medical help on the way';
  if(tick<s.actionUntil)return s.last==='alcohol'?'Drinking':s.last==='stimulant'?'Using · wipe nose':s.last==='cannabis'?'Smoking':'Taking a tablet';
  if(impairment(c)>.1)return s.levels.stimulant>1?'Agitated':s.levels.alcohol+s.levels.sedative>1.4?'Stupor':s.levels.alcohol>.5?'Unsteady':'Impaired';
  return tick<s.crashUntil?'Comedown · tired':'Clear';
}
export function updateSubstances(sim: Simulation): void {
  if(sim.tick%30!==0)return;
  for(const c of sim.chars){
    const s=c.substances;if(!s)continue;
    const elapsed=Math.max(0,Math.min(30,(sim.tick-s.updatedAt)/60));s.updatedAt=sim.tick;
    for(const kind of Object.keys(s.levels) as SubstanceKind[])s.levels[kind]=Math.max(0,s.levels[kind]-elapsed*(kind==='stimulant'?.004:.003));
    const level=impairment(c);
    if(level>.1){c.needs.energy=Math.max(.04,c.needs.energy-elapsed*.0008);c.emo.composure=Math.max(.25,c.emo.composure-elapsed*.0004);}
    else if(sim.tick<s.crashUntil)c.needs.energy=Math.max(.04,c.needs.energy-elapsed*.0005);
    if(s.levels.stimulant>1){c.emo.frustration=Math.min(.75,c.emo.frustration+elapsed*.001);c.emo.fear=Math.min(.65,c.emo.fear+elapsed*.0007);}
    if(s.crisis&&!sim.pendingAmbulance.has(c.id))sim.callAmbulance(c);
    if(level<.01&&sim.tick>=s.crashUntil&&!s.crisis)c.substances=undefined;
  }
}
