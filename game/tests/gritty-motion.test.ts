import {describe,it,expect,vi} from 'vitest';
import {small,emptyHands} from './helpers';
import {NEGATIVE_REACTIONS,applyNegativeReaction,reactionFor} from '../src/render/NegativeReactions';
import {pose} from '../src/render/StickFigure';
import {wound,bandage,hospitalise,updateHealth} from '../src/sim/Life';
import {detachmentProfile,advanceDetachedLimbs} from '../src/sim/Trauma';
import {needsMedicalResponse} from '../src/content/damageModels';
import {weaponMotion,mechanicalBeats,REST_GUN} from '../src/render/WeaponMotion';
import {fireGun,bulletHit} from '../src/sim/Turf';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {Phys} from '../src/entities/types';
import {drawToy} from '../src/render/ToyArt';

describe('negative-emotion performances',()=>{
 it('provides 500 distinct deterministic timing/weight performances across 20 families',()=>{
  expect(NEGATIVE_REACTIONS).toHaveLength(500);expect(new Set(NEGATIVE_REACTIONS.map(x=>x.family)).size).toBe(20);
  expect(new Set(NEGATIVE_REACTIONS.map(x=>JSON.stringify(x))).size).toBe(500);
  for(const clip of NEGATIVE_REACTIONS){expect(clip.tempo).toBeGreaterThan(0);expect(clip.weight).toBeLessThanOrEqual(1.2);}
 });
 it('selects reactions from actual injuries, emotions and traits while protecting actions and locomotion',()=>{
  const c=small().player;c.emo.fear=.9;c.pers.boldness=.05;c.hand=-1;c.phys=Phys.OK;
  expect(reactionFor(c)?.clip.family).toBe('startle');
  const a={...pose('idle','normal',1,0,0,0)},b={...a};applyNegativeReaction(a,c,2,0,'idle');expect(a).not.toEqual(b);
  const shot={...b};applyNegativeReaction(shot,c,2,0,'shoot');expect(shot).toEqual(b);
  const walk={...pose('walk','normal',1,1,2,0)},legs=[walk.thighL,walk.thighR,walk.bendL,walk.bendR];applyNegativeReaction(walk,c,2,2,'walk');expect([walk.thighL,walk.thighR,walk.bendL,walk.bendR]).toEqual(legs);
  c.wounds=[{part:'arm',kind:'cut',severity:2,tick:0,bandaged:false}];expect(reactionFor(c)?.clip.family).toBe('arm-pain');
 });
 it('removes reaction oscillation under reduced motion and does not animate placeholder actors',()=>{
  const c=small().player;c.emo.fear=1;c.pers.boldness=.1;c.hand=-1;c.phys=0;
  const a={...pose('idle','normal',0,0,0,0)},b={...a};applyNegativeReaction(a,c,1,0,'idle',true);applyNegativeReaction(b,c,55,0,'idle',true);expect(a).toEqual(b);
  expect(reactionFor({} as typeof c)).toBeNull();
 });
});
describe('weapon-dependent nonfatal trauma',()=>{
 it('does not sever from rubber, unarmed, blunt impacts or ordinary pistol hits',()=>{
  for(const weapon of ['pistol','mace','baton','bat',''])expect(detachmentProfile(weapon,20,3)).toBeNull();
  expect(detachmentProfile('shotgun',10,3,'rubber')).toBeNull();expect(detachmentProfile('knife',5,3)).toBeNull();
  expect(detachmentProfile('shotgun',4,3)!.force).toBeGreaterThan(detachmentProfile('knife',6,3)!.force);
 });
 it('persists physical limb motion and calls medical recovery; bandages do not reattach limbs',()=>{
  const s=small(27),c=s.player;emptyHands(s,c);const toy=s.spawnToy('baton',c.x,c.y)!;s.pickupToy(c,toy);
  for(let i=0;i<6;i++)wound(s,c,'arm',3,'stab',-1,c.x-1,c.y,'knife');
  const w=c.wounds[0];expect(w.detached?.cause).toBe('knife');expect(c.hand).toBe(-1);expect(c.phys).toBe(Phys.DOWN);expect(s.pendingAmbulance.has(c.id)).toBe(true);
  const start=w.detached!.x;for(let i=0;i<200;i++)advanceDetachedLimbs(s,c,.05);expect(w.detached!.x).not.toBe(start);expect(w.detached!.z).toBe(0);expect(Math.abs(w.detached!.vx)).toBeLessThan(.01);
  bandage(s,null,c);expect(needsMedicalResponse(c)).toBe(true);expect(c.bleed).toBe(0);
  expect(restore(serialize(s)).player.wounds[0].detached).toEqual(w.detached);
  updateHealth(s,c,1);expect(c.blood).toBeGreaterThan(0);hospitalise(s,c);expect(w.detached).toBeUndefined();expect(c.phys).toBe(Phys.OK);expect(c.blood).toBe(.8);
 });
 it('responds to walls and gives severe blunt injury a bleeding fracture instead of severing',()=>{
  const s=small(),c=s.player;wound(s,c,'leg',3,'fracture',-1,c.x-1,c.y,'mace');expect(c.wounds[0].compound).toBe(true);expect(c.wounds[0].detached).toBeUndefined();expect(c.bleed).toBeGreaterThan(0);
  c.wounds[0].detached={side:1,x:c.x,y:c.y,z:1,vx:3,vy:2,vz:0,angle:0,spin:1,tick:0,cause:'shotgun'};
  const spy=vi.spyOn(s.world,'walkable').mockReturnValue(false),x=c.x;advanceDetachedLimbs(s,c,.1);expect(c.wounds[0].detached.x).toBe(x);expect(Math.abs(c.wounds[0].detached.vx)).toBeLessThan(3);spy.mockRestore();
 });
});
describe('visible firearm action',()=>{
 it('moves actual gun geometry for every mechanism rather than only changing a label',()=>{
  const trace=(def:string,moving:boolean)=>{const lines:unknown[][]=[];const g=new Proxy({} as CanvasRenderingContext2D,{get:(_,key)=>(...args:unknown[])=>{if(key==='moveTo'||key==='lineTo'||key==='ellipse')lines.push([key,...args]);},set:()=>true});drawToy(g,def,0,0,3,0,'#aaa',1,1,moving?{cycle:1,pump:1,magazine:1,cylinder:1,hammer:1,trigger:1,reload:.5}:REST_GUN);return lines;};
  for(const def of ['pistol','golden_pistol','smg','rifle','revolver','shotgun'])expect(trace(def,true)).not.toEqual(trace(def,false));
 });
 it('cycles, pumps and returns to rest, with a separate reload sequence',()=>{
  const a={weapon:'shotgun',firedAt:0,reloadFrom:60,reloadUntil:180,shots:6};expect(weaponMotion(a,0).cycle).toBe(0);expect(weaponMotion(a,4).cycle).toBeGreaterThan(.8);expect(weaponMotion(a,28).pump).toBeGreaterThan(.9);expect(weaponMotion(a,110).magazine).toBeGreaterThan(.8);expect(weaponMotion(a,240)).toEqual(REST_GUN);
  expect(mechanicalBeats('shotgun')[0].delay).toBeGreaterThan(mechanicalBeats('pistol')[0].delay);expect(mechanicalBeats('rifle',true).every(b=>b.delay>0&&b.duration>0)).toBe(true);
 });
 it('keeps the original weapon on a travelling bullet when the shooter changes weapons',()=>{
  const s=small(),c=s.player;emptyHands(s,c);const gun=s.spawnToy('rifle',c.x,c.y)!;s.pickupToy(c,gun);c.combat={style:'jab',xp:0,ammo:{'rifle:heavy':20},load:'heavy',vest:0,helmet:0};
  expect(fireGun(s,c,c.x+4,c.y,-1)).toBe(true);const b=s.toys.find(t=>t.state==='flying'&&t.weaponOrigin==='rifle')!;expect(b.load).toBe('heavy');
  const target=s.chars.find(t=>t.id!==c.id)!;s.dropHeld(c);b.z=.4;b.x=target.x;b.y=target.y;bulletHit(s,b,target,1,0);expect(target.wounds[0].weapon).toBe('rifle');expect(c.weaponAction?.weapon).toBe('rifle');
 });
});
