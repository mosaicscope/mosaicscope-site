import {footprintDistance} from '../src/ui/DestinationDistrict';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {ENCOUNTERS} from '../src/content/encounters';
import {choiceMotion} from '../src/ui/EncounterChoreography';
import {casinoPose} from '../src/ui/CasinoBehaviour';
import {continueSlot,rememberContinue} from '../src/persistence/ContinueCookie';
import {newHorseRace,advanceHorseRace} from '../src/sim/HorseRace';
import {raceRoster} from '../src/sim/RaceBook';
import {small,emptyHands} from './helpers';
import {fireGun} from '../src/sim/Turf';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {TOYS} from '../src/content/toys';
afterEach(()=>vi.unstubAllGlobals());
describe('authored actions and browser resume',()=>{
 it('allows entry beside a long facade without walking to a distant corner',()=>{expect(footprintDistance(100,-5,[[0,0],[200,0],[200,30],[0,30]])).toBe(5);expect(footprintDistance(100,-40,[[0,0],[200,0],[200,30],[0,30]])).toBe(40);});
 it('stages all 80 authored choices and holds their final outcome without looping',()=>{
  for(const e of ENCOUNTERS)for(let i=0;i<e.choices.length;i++){
   expect(choiceMotion(e.id,i,0).stage).toBe('approach');
   expect(choiceMotion(e.id,i,3).stage).toBe('action');
   expect(choiceMotion(e.id,i,8)).toEqual(choiceMotion(e.id,i,300));
   expect(choiceMotion(e.id,i,0,true)).toEqual(choiceMotion(e.id,i,8));
  }
  expect(choiceMotion('film',0,3).item).toBe('sandwich');
  expect(choiceMotion('film',1,3).item).toBe('reflector');
 });
 it('uses a secure cookie to resume a selected slot, handles malformed and unavailable cookies',()=>{
  const doc={cookie:''};vi.stubGlobal('document',doc);vi.stubGlobal('location',{protocol:'https:'});
  rememberContinue('manual 2');expect(doc.cookie).toContain('Secure');expect(doc.cookie).toContain('Path=/world/');expect(continueSlot()).toBe('manual 2');
  doc.cookie='other=1; mosaics_continue=%broken';expect(continueSlot()).toBeNull();
  vi.stubGlobal('document',undefined);expect(()=>rememberContinue('1')).not.toThrow();expect(continueSlot()).toBeNull();
 });
 it('keeps gamblers at stations with a readable round, including reduced motion',()=>{
  expect(casinoPose('table',1)).toBe('bet');expect(casinoPose('table',7)).toBe('watch');expect(casinoPose('table',14)).toBe('cheer');
  expect(casinoPose('slots',7)).toBe('sit');expect(casinoPose('dealer',7)).toBe('deal');expect(casinoPose('table',19)).toBe(casinoPose('table',1));
 });
});
describe('physical race continuity and weapon handling',()=>{
 it('applies slower wet bends and records gait by actual distance, including after save/resume',()=>{
  const field=raceRoster(null),dry=newHorseRace(field,0,()=>.5),wet=newHorseRace(field,0,()=>.5,true);
  for(const r of[dry,wet])for(const h of r.runners){h.distance=160;h.speed=20;h.reaction=0;}
  advanceHorseRace(dry,120);advanceHorseRace(wet,120);expect(wet.runners[0].speed).toBeLessThan(dry.runners[0].speed);
  expect(wet.runners[0].stride).toBeGreaterThan(0);const resumed=structuredClone(wet);advanceHorseRace(resumed,600);advanceHorseRace(wet,600);expect(resumed).toEqual(wet);
 });
 it('does not let a same-lane following horse run through its leader',()=>{
  const r=newHorseRace(raceRoster(null).slice(0,2),0,()=>0);r.runners[0].distance=30;r.runners[0].lane=1;r.runners[0].speed=0;r.runners[1].distance=27;r.runners[1].lane=1;r.runners[1].speed=20;
  advanceHorseRace(r,6);expect(r.runners[1].distance).toBeLessThan(r.runners[0].distance-1.9);
 });
 it('preserves rounds used per weapon through save and enforces a magazine reload',()=>{
  const s=small(22,{midCount:0,backgroundCount:0}),c=s.player;emptyHands(s,c);
  c.combat={style:'jab',xp:0,ammo:{pistol:200},vest:0,helmet:0};const gun=s.spawnToy('pistol',c.x,c.y)!;s.pickupToy(c,gun);
  const mag=TOYS.pistol.weapon!.mag!;for(let i=0;i<mag;i++){s.nextAttack.delete(c.id);expect(fireGun(s,c,c.x+4,c.y,-1)).toBe(true);s.tick+=1;}
  expect(c.combat.reloadWeapon).toBe('pistol');expect(c.combat.reloadUntil).toBeGreaterThan(s.tick);expect(fireGun(s,c,c.x+4,c.y,-1)).toBe(false);
  const saved=restore(serialize(s));expect(saved.player.combat?.magUsed).toEqual(c.combat.magUsed);expect(saved.player.combat?.reloadUntil).toBe(c.combat.reloadUntil);expect(fireGun(saved,saved.player,saved.player.x+4,saved.player.y,-1)).toBe(false);
 });
});
