import {describe,it,expect} from 'vitest';
import {NEGATIVE_REACTIONS,REACTION_TRACKS,sampleReactionClip,applyNegativeReaction} from '../src/render/NegativeReactions';
import {sampleReactionFace,currentReactionFace} from '../src/render/ReactionFaces';
import {REST_REACTION} from '../src/render/ReactionPoses';
import {pose} from '../src/render/StickFigure';
import {small} from './helpers';

describe('distinct visible face and body sequences',()=>{
 it('has exactly 25 explicitly scored clips per family, with different anatomical trajectories',()=>{
  const seen=new Set();for(const c of NEGATIVE_REACTIONS){expect(c.keys).toHaveLength(3);expect(new Set(c.keys).size).toBe(3);const signature=[.195,.49,.815].flatMap(u=>{const p=sampleReactionClip(c,u*c.duration);return REACTION_TRACKS.map(k=>p[k]);});seen.add(JSON.stringify(signature));}
  expect(seen.size).toBe(500);for(const family of new Set(NEGATIVE_REACTIONS.map(c=>c.family)))expect(NEGATIVE_REACTIONS.filter(c=>c.family===family)).toHaveLength(25);
 });
 it('gives every action facial eye, brow and mouth channels, rather than just a body gesture',()=>{
  for(const c of NEGATIVE_REACTIONS)for(const u of[.195,.49,.815]){const f=sampleReactionFace(c,c.duration*u);expect(Object.values(f).every(Number.isFinite)).toBe(true);expect(f.eyeL!==1||f.eyeR!==1).toBe(true);expect(Math.abs(f.browL)+Math.abs(f.browR)+Math.abs(f.browY)).toBeGreaterThan(.1);expect(f.mouthOpen>0||f.mouthCurve<-.1).toBe(true);expect(f.mouthCurve).toBeLessThanOrEqual(0);}
 });
 it('holds real key poses, transitions smoothly and returns to rest at both ends',()=>{
  for(const c of NEGATIVE_REACTIONS){expect(sampleReactionClip(c,0)).toEqual(REST_REACTION);expect(sampleReactionClip(c,c.duration)).toEqual(REST_REACTION);expect(sampleReactionClip(c,.15*c.duration)).toEqual(sampleReactionClip(c,.2*c.duration));const p=sampleReactionClip(c,.24*c.duration),q=sampleReactionClip(c,.24001*c.duration);for(const key of REACTION_TRACKS)expect(Math.abs(p[key]-q[key])).toBeLessThan(.01);}
 });
 it('shows a facial and upper-body reaction during a knockdown while preserving the physical floor pose',()=>{
  const c=small().player;c.wounds=[{part:'head',kind:'bruise',severity:3,bandaged:false,tick:0}];c.phys=2;c.hand=-1;const a={...pose('down','normal',0,0,0,0)},before={...a};applyNegativeReaction(a,c,1.6,0,'down');expect(a.lying).toBe(1);expect(a.armL!==before.armL||a.armR!==before.armR||a.tilt!==before.tilt).toBe(true);expect(currentReactionFace(c)).toBeDefined();expect(currentReactionFace(c)!.mouthCurve).toBeLessThan(0);
 });
 it('cycles to another action score and keeps reduced-motion face/body poses steady',()=>{
  const c=small().player;c.emo.fear=1;c.hand=-1;c.phys=0;c.seedPhase=0;const a={...REST_REACTION},b={...REST_REACTION};applyNegativeReaction(a,c,1.6,0,'idle');const f=currentReactionFace(c);applyNegativeReaction(b,c,4.8,0,'idle');expect(a).not.toEqual(b);expect(currentReactionFace(c)).not.toEqual(f);const d={...REST_REACTION},e={...REST_REACTION};applyNegativeReaction(d,c,1,0,'idle',true);const fixed=currentReactionFace(c);applyNegativeReaction(e,c,80,0,'idle',true);expect(d).toEqual(e);expect(currentReactionFace(c)).toEqual(fixed);
 });
});
