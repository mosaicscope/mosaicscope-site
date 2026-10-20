import { describe, it, expect } from 'vitest';
import { small, emptyHands } from './helpers';
import { HAIR_VARIANTS, HAIR_FAMILIES, hairVariant } from '../src/content/hair';
import { drawCatalogueHair } from '../src/render/HairArt';
import { hospitalise } from '../src/sim/Life';
import { consume } from '../src/sim/Society';
import { useSubstance, impairment, updateSubstances, restoreSubstances } from '../src/sim/Substances';
import { applySubstanceMotion } from '../src/render/SubstanceMotion';
import { pose, solve, J } from '../src/render/StickFigure';
import { updateMedicalResponses } from '../src/sim/MedicalResponse';
import { ensureStreetCrews, triggerStreetIncident, resolveStreetIncident, STREET_CREWS, storyPhase } from '../src/sim/StreetLife';
import { SALT_MILESTONES } from '../src/content/salt-story/milestones';
import chapters from '../src/content/salt-story/chapters.json';
import { serialize, restore } from '../src/persistence/SaveSystem';

describe('expanded hairstyles',()=>{
  it('has exactly 500 distinct geometric renderings across 25 style families',()=>{
    expect(HAIR_VARIANTS).toHaveLength(500);expect(HAIR_FAMILIES).toHaveLength(25);
    const paths=new Set<string>();
    for(const hair of HAIR_VARIANTS){
      const calls:unknown[][]=[];
      const g=new Proxy({}, {get:(_,key)=> (...args:unknown[])=>{calls.push([key,...args]);},set:()=>true}) as CanvasRenderingContext2D;
      expect(drawCatalogueHair(g,hair.id,0,0,20,20,'#111','#000')).toBe(true);
      paths.add(JSON.stringify(calls));
    }
    expect(paths.size).toBe(500);expect(hairVariant('hair-500')).toBeNull();expect(hairVariant('hair--1')).toBeNull();
  });
});
it('discharges the player to a walkable hospital entrance, while NPCs can rest indoors',()=>{
  const s=small(),p=s.player,c=s.chars.find(c=>c!==p)!;
  hospitalise(s,p);expect(p.inside).toBe(-1);expect(s.world.walkable(p.x,p.y)).toBe(true);expect(p.phys).toBe(0);expect(s.world.buildingAt(Math.floor(p.x),Math.floor(p.y))).toBeUndefined();
  hospitalise(s,c);expect(s.world.buildings[c.inside].kind).toBe('hospital');
});
describe('substances use the real inventory, skeleton and medical system',()=>{
  it('consumes only an owned item, refuses a second use during the animation and decays over time',()=>{
    const s=small(),p=s.player;emptyHands(s,p);
    const beer=s.spawnToy('beer',p.x,p.y)!;expect(consume(s,p,beer)).toBe(false);s.pickupToy(p,beer);expect(consume(s,p,beer)).toBe(true);
    expect(beer.state).toBe('broken');expect(p.substances!.last).toBe('alcohol');const before=impairment(p);
    const another=s.spawnToy('beer',p.x,p.y)!;s.pickupToy(p,another);expect(consume(s,p,another)).toBe(false);expect(another.holder).toBe(p.id);
    s.tick=600;updateSubstances(s);expect(impairment(p)).toBeLessThan(before);
  });
  it('moves the hand to the face for use and keeps the walking skeleton coherent',()=>{
    const s=small(),p=s.player;useSubstance(s,p,'stimulant');s.tick=75;
    const angles={...pose('idle','normal',1,0,0,0)};applySubstanceMotion(angles,p,s.tick,1,false);solve(angles,0,0,1,1);
    expect(Math.hypot(J[14]-J[4],J[15]-J[5])).toBeLessThan(12);expect(angles.lying).toBe(0);
  });
  it('dispatches paramedics for severe effects and restores player control after nonfatal treatment',()=>{
    const s=small(),p=s.player;
    for(let i=0;i<3;i++){s.tick=i*151;expect(useSubstance(s,p,'sedative')).toBe(true);}
    expect(p.substances!.crisis).toBe(true);expect(s.pendingAmbulance.has(p.id)).toBe(true);
    s.tick=s.pendingAmbulance.get(p.id)!;updateMedicalResponses(s);
    expect(p.substances).toBeUndefined();expect(p.inside).toBe(-1);expect(p.phys).toBe(0);expect(p.blood).toBeGreaterThan(0);
  });
  it('preserves effects in saves and clamps malformed optional state',()=>{
    const s=small();useSubstance(s,s.player,'cannabis');s.tick=30;
    const loaded=restore(serialize(s));expect(loaded.player.substances!.levels.cannabis).toBe(.75);
    expect(restoreSubstances({levels:{alcohol:Infinity,cannabis:-1},last:'bad'},30)!.levels.alcohol).toBe(0);
    expect(restoreSubstances(undefined,30)).toBeUndefined();
  });
});
describe('contextual street life',()=>{
  it('keeps its chapter index aligned with every authored dialogue chapter',()=>{
    let beat=0;const s=small();
    for(const [i,c]of chapters.entries()){expect(SALT_MILESTONES[i].start).toBe(beat);s.saltStory.position=beat;expect(storyPhase(s)).toBe(i);beat+=c.scenes.reduce((n,s)=>n+s.beats.length,0);}
  });
  it('uses existing NPCs, real goals and nearby actions, without teleporting or dosing the player',()=>{
    const s=small(3,{backgroundCount:120});const count=s.chars.length;ensureStreetCrews(s);
    for(const crew of STREET_CREWS)expect(s.chars.filter(c=>c.crew===crew.id).length).toBe(8);
    const before=s.chars.map(c=>[c.x,c.y]);const e=triggerStreetIncident(s,'dispute')!;expect(e).not.toBeNull();expect(s.chars.length).toBe(count);
    expect(s.chars.map(c=>[c.x,c.y])).toEqual(before);expect(s.chars[e.actors[0]].goal!.id).toBe('street_life');expect(s.player.substances).toBeUndefined();
    s.player.x=e.x;s.player.y=e.y;const heat=s.streetLife.heat[e.crew];expect(resolveStreetIncident(s,e.id,'calm')).toContain('talked');expect(s.streetLife.heat[e.crew]).toBeLessThan(heat);
    expect(resolveStreetIncident(s,e.id,'calm')).toContain('finished');
    const loaded=restore(serialize(s));expect(loaded.streetLife.history[0].resolved).toBe(true);
  });
  it('bounds concurrent scenes and preserves the original story cast',()=>{
    const s=small(4,{backgroundCount:120}),principals=s.chars.filter(c=>c.tier==='principal').map(c=>c.name);
    for(const crew of STREET_CREWS)triggerStreetIncident(s,'meetup',crew.id);
    expect(s.streetLife.history.length).toBeLessThanOrEqual(3);expect(s.chars.filter(c=>c.tier==='principal').map(c=>c.name)).toEqual(principals);
  });
});
