import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {T} from '../src/world/World';
import {updateCityRoutine} from '../src/sim/CityRoutine';
import {thinkBackground} from '../src/ai/brain';
function scene(){const s=small(44,{trafficCars:0,midCount:0,backgroundCount:6});s.world.tiles.fill(T.PAVE);s.world.blocked.fill(0);for(const c of s.chars)Object.assign(c,{x:3,y:3,inside:0,talkWith:-1});Object.assign(s.player,{x:30,y:30,inside:-1,inCar:-1});const people=s.chars.filter(c=>c.tier==='background').slice(0,4);for(const [i,c] of people.entries()){Object.assign(c,{x:30+(i%2)*.7,y:30+Math.floor(i/2)*4,px:30,py:30,inside:-1,inCar:-1,arrestedBy:-1,pursuing:-1,talkWith:-1,phys:0,goal:null,mode:'idle',vx:1,vy:1});c.emo.fear=0;}s.tick=180;s.rebuildHash();return {s,people};}
describe('nearby conversations',()=>{
 it('lets nearby strangers begin actual paired conversations and stay still while talking',()=>{const {s,people}=scene();updateCityRoutine(s);const a=people.find(c=>c.talkWith>=0);expect(a).toBeDefined();const b=s.chars[a!.talkWith];expect(b.talkWith).toBe(a!.id);thinkBackground(a!,s,.1);expect(a!.vx).toBe(0);expect(a!.vy).toBe(0);expect(a!.anim.pose).toBe('talk');});
 it('does not pull busy or frightened people into chats',()=>{const {s,people}=scene();people.forEach(c=>{c.emo.fear=.9});updateCityRoutine(s);expect(people.every(c=>c.talkWith<0)).toBe(true);});
});
