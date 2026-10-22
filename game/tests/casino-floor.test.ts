import {describe,it,expect} from 'vitest';
import {casinoWalkPath,FLOOR_AREAS,casinoCompany} from '../src/ui/CasinoFloorPlan';
import {newCityPlay,restoreCityPlay} from '../src/sim/CityPlay';
import type {Character} from '../src/entities/types';
describe('casino floor aisles and company',()=>{
 it('routes around actual table footprints and stays inside the room',()=>{const path=casinoWalkPath([4.5,5.5],[-5,1.5]);expect(path.length).toBeGreaterThan(8);for(let i=0;i<path.length;i++){const [x,y]=path[i];expect(x).toBeGreaterThanOrEqual(-6.6);expect(x).toBeLessThanOrEqual(6.7);expect(y).toBeGreaterThanOrEqual(-3);expect(y).toBeLessThanOrEqual(6);expect(FLOOR_AREAS.some(a=>Math.abs(x-a.x)<a.w/2+.18&&Math.abs(y-a.y)<a.d/2+.18)).toBe(false);if(i)expect(Math.abs(x-path[i-1][0])+Math.abs(y-path[i-1][1])).toBe(.5);}});
 it('finds an aisle beside a blocked destination rather than walking into furniture',()=>{const path=casinoWalkPath([4.5,5.5],[0,1]);expect(path.length).toBeGreaterThan(1);const [x,y]=path[path.length-1];expect(Math.abs(x)>2||Math.abs(y-1)>1.4).toBe(true);});
 it('draws distinct available women and men, excluding current players and injured guests',()=>{const person=(id:number,kind:string,phys=0)=>({id,tier:'extra',phys,look:{kind}} as unknown as Character),people=[person(1,'guy'),person(2,'guy'),person(3,'girl'),person(4,'girl'),person(5,'girl',2)];const cast=casinoCompany(people,[2],4);expect(cast.map(c=>c.id)).toEqual([3,1,4]);expect(new Set(cast.map(c=>c.id)).size).toBe(cast.length);});
 it('restores the expanded guest list with its real identity and balances',()=>{const raw=newCityPlay();raw.casino.guests=Array.from({length:20},(_,i)=>({id:i,style:'patient',balance:100+i,bet:5,pick:i,line:'Hello',affinity:1}));const restored=restoreCityPlay(raw);expect(restored.casino.guests).toEqual(raw.casino.guests);restored.casino.guests[10].balance=1;expect(raw.casino.guests[10].balance).toBe(110);});
});
