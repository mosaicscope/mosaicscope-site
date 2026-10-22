import {pose} from '../src/render/StickFigure';
import {it,expect} from 'vitest';
import {SKILL_GAMES,STREET_EFFECTS,WORLD_FUN_COUNT} from '../src/content/worldFun';
import {newSkillRound,advanceSkill,skillInput,dartTarget,fishingTarget,keeperLane} from '../src/sim/SkillGames';
import {finishSkill,streetEffect} from '../src/sim/WorldFun';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {small} from './helpers';
it('ships 12 distinct rule sets and 38 separately wired street interactions',()=>{expect(SKILL_GAMES).toHaveLength(12);expect(STREET_EFFECTS).toHaveLength(38);expect(WORLD_FUN_COUNT).toBe(50);expect(new Set([...SKILL_GAMES,...STREET_EFFECTS].map(e=>e[0])).size).toBe(50);});
it.each(SKILL_GAMES.map(g=>[g[0]] as const))('supports a complete successful %s round without an auto-win button',id=>{
 const s=newSkillRound(id),tap=(x=480,y=230,type='tap')=>skillInput(s,x,y,type);
 if(id==='basketball'||id==='focus')for(let i=0;i<3;i++)tap();
 if(id==='penalty')for(let i=0;i<3;i++)tap((keeperLane(s.t)+1)%3*320+160);
 if(id==='darts')for(let i=0;i<3;i++){const p=dartTarget(s.t);tap(p.x,p.y);}
 if(id==='rhythm')for(let i=0;i<6;i++){s.t=i*.7;tap([160,800,480,160,800,480][i]);}
 if(id==='fishing')for(let t=.05;t<=4;t+=.05){s.value=fishingTarget(t);advanceSkill(s,t);}
 if(id==='repair')for(const cell of[0,4,8])tap(345+cell%3*100,140+Math.floor(cell/3)*90);
 if(id==='garden'){for(const x of[250,470,690]){tap(x);tap(x);}for(let t=.05;t<=4;t+=.05)advanceSkill(s,t);for(const x of[250,470,690])tap(x);}
 if(id==='delivery'){for(let x=1;x<=5;x++)tap(274+x*75,114);for(let y=1;y<=3;y++)tap(274+5*75,114+y*75);}
 if(id==='skate')for(let t=.05;t<=6.3;t+=.05){if([1.7,3.7,5.7].some(v=>Math.abs(t-v)<.02))tap();advanceSkill(s,t);}
 if(id==='rings')for(let i=0;i<3;i++){s.t=i*2;tap(480,230,'down');s.t+=.98;tap(480,230,'up');}
 if(id==='shuffle'){tap(Math.sqrt(615*300)/650*960);for(let t=.05;t<8;t+=.05)advanceSkill(s,t);}
 expect(s.done,id).toBe(true);expect(s.score,id).toBeGreaterThan(80);const score=s.score;tap();advanceSkill(s,100);expect(s.score).toBe(score);
});
it('persists results and limits repeat payouts, while target-dependent repairs refuse missing objects',()=>{const s=small(2);s.player.cash=100;finishSkill(s,'darts',100);expect(s.player.cash).toBe(110);finishSkill(s,'darts',100);expect(s.player.cash).toBe(110);const before=s.player.cash;expect(streetEffect(s,'sign')).toContain('No damaged');expect(s.player.cash).toBe(before);streetEffect(s,'tea');expect(s.player.cash).toBe(before-5);const loaded=restore(serialize(s));expect(loaded.worldFun.scores.darts).toBe(100);expect(loaded.worldFun.used.tea).toBe(s.tick);});

it('uses readable native gestures rather than an idle fallback for new street actions',()=>{const wave={...pose('wave','normal',0,0,0,0)},waveLater={...pose('wave','normal',.2,0,0,0)};expect(wave.armR).toBeGreaterThan(2);expect(Math.abs(waveLater.foreR-wave.foreR)).toBeGreaterThan(.02);expect(Math.abs(waveLater.foreR-wave.foreR)).toBeLessThan(.1);expect(pose('bow','normal',0,0,0,0).lean).toBeGreaterThan(.4);expect(pose('stretch','normal',0,0,0,0).armL).toBeGreaterThan(2);const jab={...pose('punch','normal',.25,0,0,0)},guard={...pose('punch','normal',.75,0,0,0)};expect(jab.armR).toBeGreaterThan(guard.armR);});
