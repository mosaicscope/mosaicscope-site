import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {reactionFor,applyNegativeReaction} from '../src/render/NegativeReactions';
import {currentReactionFace} from '../src/render/ReactionFaces';
import {REST_REACTION} from '../src/render/ReactionPoses';
import {detailedCrowd} from '../src/render/CrowdDetail';
import {gunGrips} from '../src/render/GunRig';
import {REST_GUN} from '../src/render/WeaponMotion';
describe('context-driven expressions',()=>{
 it('keeps ordinary unhappiness quiet, without random crying, shame or a timed clip carousel',()=>{
  const c=small().player;c.emo.fear=0;c.emo.frustration=0;c.emo.mood=-.6;c.needs.energy=.7;c.hand=-1;
  expect(reactionFor(c,0)?.clip.id).toBe(reactionFor(c,900)?.clip.id);expect(reactionFor(c)?.clip.family).toBe('withdraw');
  const a={...REST_REACTION};applyNegativeReaction(a,c,1,0,'idle');expect(a).toEqual(REST_REACTION);const face=currentReactionFace(c)!;expect(face.tears).toBe(0);expect(face.mouthOpen).toBeLessThan(.2);applyNegativeReaction({...a},c,100,0,'idle');expect(currentReactionFace(c)).toEqual(face);
 });
 it('settles after a threat, retriggers for a new injury and clears when recovered',()=>{
  const c=small().player;c.emo.fear=.95;c.hand=-1;const initial={...REST_REACTION};applyNegativeReaction(initial,c,1,0,'idle');expect(initial).not.toEqual(REST_REACTION);
  const settled={...REST_REACTION};applyNegativeReaction(settled,c,9,0,'idle');expect(settled).toEqual(REST_REACTION);
  c.wounds=[{part:'head',kind:'bruise',severity:2,tick:600,hits:1,bandaged:false}];const hit={...REST_REACTION};applyNegativeReaction(hit,c,10,0,'idle');expect(hit).not.toEqual(REST_REACTION);expect(reactionFor(c)?.clip.family).toBe('headache');
  c.wounds=[];c.emo.fear=0;c.emo.frustration=0;c.emo.mood=0;c.needs.energy=1;applyNegativeReaction({...REST_REACTION},c,11,0,'idle');expect(currentReactionFace(c)).toBeUndefined();
 });
});
describe('crowd budgets and world-held weapons',()=>{
 it('bounds detail while preserving player and selected NPC regardless of background promotion',()=>{
  const s=small();s.spawnNpcAt(s.player.x,s.player.y,650-s.chars.length);for(const c of s.chars)c.promoted=true;
  const selected=s.chars[s.chars.length-1];selected.x=60;selected.y=60;const chosen=detailedCrowd(s.chars,s.player.x,s.player.y,48,selected.id);expect(chosen.size).toBe(48);expect(chosen.has(s.playerId)).toBe(true);expect(chosen.has(selected.id)).toBe(true);
  const occupied=new Set(s.chars.map(c=>`${Math.floor(c.x*2)}:${Math.floor(c.y*2)}`));expect(occupied.size).toBeGreaterThan(550);expect(s.chars.every(c=>Number.isFinite(c.x+c.y)&&s.world.walkable(c.x,c.y))).toBe(true);
 });
 it('centres each actual grip at the hand and moves the shotgun support hand with its pump',()=>{
  for(const id of['pistol','rifle','shotgun','smg','revolver']){const rig=gunGrips(id,REST_GUN,false);expect(rig.originX-1.7*rig.scale).toBeCloseTo(0);expect(rig.originY+3.5*rig.scale).toBeCloseTo(0);expect(rig.scale).toBeGreaterThan(1);}
  const rest=gunGrips('shotgun',REST_GUN,false),pump=gunGrips('shotgun',{...REST_GUN,pump:1},false);expect(rest.left.x-pump.left.x).toBeCloseTo(8.25);expect(gunGrips('rifle',REST_GUN,true).left.y).toBe(22);
 });
});
