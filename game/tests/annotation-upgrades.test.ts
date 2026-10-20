import {describe,it,expect} from 'vitest';
import {AIRCRAFT,DEALER_AIRCRAFT,aircraftStock,AIR_STOCK_MS} from '../src/content/aircraft';
import {SCRATCHCARDS} from '../src/content/scratchcards';
import {makeScratch,revealScratch} from '../src/sim/Arcade';
import {farmPlot,stockPosition} from '../src/sim/FarmPlot';
import {hangarBay} from '../src/sim/Hangar';
import {buyMarket} from '../src/sim/Commerce';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {small} from './helpers';
import {T} from '../src/world/World';
describe('annotated world upgrades',()=>{
 it('cycles all fifty sale aircraft across five-minute slots; sixty unique specifications exist',()=>{
  expect(AIRCRAFT).toHaveLength(60);expect(DEALER_AIRCRAFT).toHaveLength(50);
  expect(new Set(AIRCRAFT.map(a=>[a.type,a.length,a.span,a.engines,a.seats,a.tail].join(':'))).size).toBe(60);
  expect(aircraftStock(0)).toEqual(aircraftStock(AIR_STOCK_MS-1));expect(aircraftStock(0)).not.toEqual(aircraftStock(AIR_STOCK_MS));
  expect(new Set(Array.from({length:5},(_,i)=>aircraftStock(i*AIR_STOCK_MS)).flat().map(a=>a.id)).size).toBe(50);
 });
 it('stores one of a hundred printed designs and only pays a completed ticket once',()=>{
  expect(new Set(SCRATCHCARDS.map(d=>d.name)).size).toBe(100);
  for(let design=0;design<100;design++){const t=makeScratch(10,1000,()=>0,design);expect(t.design).toBe(design);expect(revealScratch(t,0)).toBe(0);expect(revealScratch(t,1)).toBe(0);expect(revealScratch(t,2)).toBe(1000);expect(revealScratch(t,2)).toBe(0);}
 });
 it('reserves clear farm land without fixtures and keeps roaming animals within fences after loading',()=>{
  for(const seed of[1,4,9]){const s=small(seed),p=farmPlot(s.world);expect(p).not.toBeNull();if(!p)continue;
   for(let y=p.y;y<p.y+p.size;y++)for(let x=p.x;x<p.x+p.size;x++)expect(s.world.tile(x,y)).toBe(T.GRASS);
   expect(s.world.pois.some(a=>a.x>=p.x&&a.x<p.x+p.size&&a.y>=p.y&&a.y<p.y+p.size)).toBe(false);
   for(let i=0;i<48;i++)for(const t of[0,23,10000]){const a=stockPosition(p,i,t);expect(a.x).toBeGreaterThan(p.x+.5);expect(a.x).toBeLessThan(p.x+p.size-.5);expect(a.y).toBeGreaterThan(p.y+.5);expect(a.y).toBeLessThan(p.y+p.size-.5);}
   s.expansion.farm=2;s.expansion.animals.Sheep=4;s.saltStory.decisions={'0':0,'12':2};const restored=restore(serialize(s));expect(farmPlot(restored.world)).toEqual(p);expect(restored.expansion.animals.Sheep).toBe(4);expect(restored.saltStory.decisions).toEqual({'0':0,'12':2});
  }
 });
 it('delivers an aircraft to an actual clear hangar apron and preserves it across saves',()=>{
  const s=small(4);s.player.cash=1e9;const sites=s.world.buildings.filter(b=>b.kind==='airport'||['flat','flats','house','hotel'].includes(b.kind)),b=sites.find(b=>hangarBay(s,b.id));expect(b,'At least one usable hangar site').toBeDefined();if(!b)return;
  expect(buyMarket(s,'air:'+DEALER_AIRCRAFT[0].id,b.id)).toContain('Delivered');const o=s.commerce.purchases[s.commerce.purchases.length-1]!;expect(o.bay).toBeDefined();expect(restore(serialize(s)).commerce.purchases.slice(-1)[0]?.bay).toEqual(o.bay);
 });
});
