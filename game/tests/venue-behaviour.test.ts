import { describe,it,expect } from 'vitest';
import { routeAt } from '../src/ui/SceneMotion';
import { ENCOUNTER_ACTIONS } from '../src/ui/EncounterDirection';
import { ENCOUNTERS } from '../src/content/encounters';
import { raceRoster,raceOrder,raceReturn } from '../src/sim/RaceBook';
import { Camera } from '../src/render/Camera';
describe('living venues',()=>{
 it('walks a clear path, dwells at its destination and reverses without teleporting',()=>{const path=[[0,0],[2,0]] as const;expect(routeAt(path,1,1,2).x).toBeCloseTo(1);expect(routeAt(path,3,1,2)).toMatchObject({x:2,y:0,moving:false});expect(routeAt(path,5,1,2)).toMatchObject({x:1,y:0,moving:true,facing:-1});expect(routeAt(path,8.001,1,2).x).toBeCloseTo(.001);});
 it('authors an action for both choices of all forty encounters',()=>{for(const e of ENCOUNTERS)expect(ENCOUNTER_ACTIONS[e.id]).toHaveLength(e.choices.length);expect(ENCOUNTER_ACTIONS.memorial).toEqual(['sit','drink']);});
 it('puts the owned horse and its actual condition in the race field',()=>{const horse={name:'My Mare',skill:85,fitness:91,wins:4,tier:1,trained:0,raced:0};const field=raceRoster(horse);expect(field[0]).toMatchObject({name:'My Mare',skill:85,fitness:91,owned:true});expect(raceRoster(horse,'Greyhound').some(r=>r.owned)).toBe(false);expect(raceRoster({...horse,fitness:10})[0].winReturn).toBeGreaterThan(field[0].winReturn);});
 it('prices each bet against its actual weighted probability and produces a permutation',()=>{const field=raceRoster(null),total=field.reduce((s,r)=>s+r.weight,0);expect(raceReturn(field,0,'Win')*field[0].weight/total).toBeCloseTo(.9,2);expect(raceReturn(field,0,'Exacta')).toBeGreaterThan(raceReturn(field,0,'Win'));expect(raceReturn(field,0,'Place')).toBeLessThan(raceReturn(field,0,'Win'));expect([...raceOrder(field,()=>.4)].sort()).toEqual([0,1,2,3,4,5]);});
 it('allows deliberate detail zoom while retaining safe camera bounds',()=>{const c=new Camera();c.setZoom(99);expect(c.targetZoom).toBe(7);c.setZoom(.1);expect(c.targetZoom).toBe(.55);});
});
