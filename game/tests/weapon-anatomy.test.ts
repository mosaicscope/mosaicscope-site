import {describe,it,expect} from 'vitest';
import {contactPose,headFrame,stampPose} from '../src/render/ReactionAnatomy';
import {REST_REACTION,REACTION_KEYS} from '../src/render/ReactionPoses';
import {solve,J} from '../src/render/StickFigure';
import {visibleWeaponMotion} from '../src/render/WeaponMotion';
import {hitAccessories,equipAccessory} from '../src/content/accessories';
import {Camera} from '../src/render/Camera';
import {fireGun} from '../src/sim/Turf';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {small,emptyHands} from './helpers';
import {wound} from '../src/sim/Life';
import {NEGATIVE_REACTIONS,sampleReactionClip,REACTION_TRACKS} from '../src/render/NegativeReactions';

describe('grounded anatomical reactions',()=>{
 it('puts a rubbing hand at the temple instead of flinging it out sideways',()=>{
  for(const key of ['tl','tr'] as const){const a=contactPose(key,{...REACTION_KEYS[key].angles}),h=headFrame(a);solve(a,0,0,1,1);const i=key==='tl'?10:14,side=key==='tl'?-1:1,ox=side*4.42*Math.cos(a.lean),oy=side*4.42*Math.sin(a.lean),x=h.x+side*10*Math.cos(h.angle)+2*Math.sin(h.angle),y=h.y+side*10*Math.sin(h.angle)-2*Math.cos(h.angle);expect(Math.hypot(J[i]+ox-x,J[i+1]+oy-y)).toBeLessThan(.01);}
 });
 it('holds a support foot in place through weight transfer, lift, strike and compression',()=>{
  for(const side of[0,1] as const){const lift=[];for(const u of[0,.2,.4,.5,.63,.7,.85,1]){const a={...REST_REACTION};stampPose(a,side,u);solve(a,0,0,1,1);const support=side===0?22:18,active=side===0?18:22;expect(Math.abs(J[support])).toBeLessThan(.01);expect(Math.abs(J[support+1])).toBeLessThan(.01);expect(J[active+1]).toBeLessThanOrEqual(.01);lift.push(J[active+1]);}expect(Math.min(...lift)).toBeLessThan(-25);expect(lift[4]).toBeCloseTo(0,2);expect(lift[5]).toBeCloseTo(0,2);}
 });
 it('blends into and out of stamp actions without snapping at clip boundaries',()=>{
  for(const clip of NEGATIVE_REACTIONS)for(let stage=0;stage<3;stage++){if(!['ts','tu'].includes(clip.keys[stage]))continue;for(const u of[stage*.315,stage*.315+.37]){if(u>=1||u<=0)continue;const a=sampleReactionClip(clip,(u-.000001)*clip.duration),b=sampleReactionClip(clip,(u+.000001)*clip.duration);for(const track of REACTION_TRACKS)expect(Math.abs(a[track]-b[track])).toBeLessThan(.01);}}
 });
});
describe('readable firing and accessories',()=>{
 it('keeps action travel visible when four simulation ticks pass per visual tick',()=>{
  const action={weapon:'pistol',firedAt:100,shots:1};visibleWeaponMotion(action,100,10);expect(visibleWeaponMotion(action,120,10.08).cycle).toBeGreaterThan(.9);expect(visibleWeaponMotion(action,180,10.5).cycle).toBe(0);
 });
 it('allows close inspection and still clamps zoom safely',()=>{const c=new Camera();c.setZoom(6);expect(c.targetZoom).toBe(6);c.setZoom(100);expect(c.targetZoom).toBe(7);});
 it('records cracks and shifted accessories in saves without treating glasses as armour',()=>{
  const s=small(),p=s.player;equipAccessory(p,'glasses',true);equipAccessory(p,'goggles',true);expect(p.look.accessories).toEqual(['goggles']);expect(hitAccessories(p,1,'bullet')).toBe(false);wound(s,p,'head',1,'bruise',-1,p.x-1,p.y);expect(p.look.accessoryWear?.goggles).toBe(2);expect(restore(serialize(s)).player.look.accessoryWear?.goggles).toBe(2);equipAccessory(p,'mouthguard',true);expect(hitAccessories(p,1,'bruise')).toBe(true);
 });
 it('fires from a valid held gun, consumes one round, respects reload and rejects invalid aim',()=>{
  const s=small(),p=s.player;emptyHands(s,p);const gun=s.spawnToy('pistol',p.x,p.y)!;s.pickupToy(p,gun);p.combat={style:'jab',xp:0,ammo:{pistol:20},vest:0,helmet:0};
  expect(fireGun(s,p,NaN,p.y,-1)).toBe(false);expect(p.combat.ammo.pistol).toBe(20);expect(fireGun(s,p,p.x+4,p.y,-1)).toBe(true);expect(p.combat.ammo.pistol).toBe(19);expect(fireGun(s,p,p.x+4,p.y,-1)).toBe(false);expect(s.toys.some(t=>t.weaponOrigin==='pistol'&&t.state==='flying')).toBe(true);
 });
});
