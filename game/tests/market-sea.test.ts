import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {buyMarket,createCompany,furnishInterior,MARKET,restoreCommerce} from '../src/sim/Commerce';
import {newSea,stepSea} from '../src/sim/Sea';
import {launchRocket,updateRockets} from '../src/sim/Rockets';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {interiorForBuilding} from '../src/content/interiorVariety';
import {findPath} from '../src/content/interiorNav';
describe('world purchases and the sea',()=>{
 it('an owned attraction has distinct exhibits, reachable services and daily company income',()=>{
  const s=small(4);s.player.cash=1e8;const b=s.world.buildings.find(b=>!['hospital','police','prison','airport'].includes(b.kind))!;
  expect(buyMarket(s,'experience:marine',b.id)).toContain('Delivered');const def=furnishInterior(s,b.id,interiorForBuilding(b));expect(def.props.filter(p=>p.type==='aquarium').length).toBe(2);expect(s.life.businesses.some(c=>c.id===b.id&&c.kind==='marine park')).toBe(true);
  for(const target of def.interactables)expect(findPath(def,def.door,target),target.label).not.toBeNull();
 });
 it('delivers a real owned car without spending twice or using an occupied bay',()=>{
  const s=small(9);s.player.cash=1e8;const b=s.world.buildings.find(b=>b.kind==='dealership')??s.world.buildings[0],before=s.player.cash;
  const result=buyMarket(s,'car:hatch',b.id);
  if(!result.startsWith('Delivered')){expect(s.player.cash).toBe(before);expect(result).toMatch(/parking|bay/);return;}
  const order=s.commerce.purchases[s.commerce.purchases.length-1]!,v=s.vehicles[order.vehicle!];expect(v.owner).toBe(s.playerId);expect(v.cls).toBe('hatch');expect(s.player.cash).toBe(before-MARKET.find(i=>i.id==='car:hatch')!.price);expect(s.vehicles.some(o=>o!==v&&Math.hypot(o.x-v.x,o.y-v.y)<1)).toBe(false);
 });
 it('installs bought furniture into the owned address without mutating shared interiors',()=>{
  const s=small(3);s.player.cash=1e8;const b=s.world.buildings.find(b=>['flat','flats','house','hotel'].includes(b.kind))!;expect(b).toBeDefined();
  expect(buyMarket(s,'home:sofa',b.id)).toContain('before furnishing');expect(buyMarket(s,'property:home',b.id)).toContain('Delivered');expect(buyMarket(s,'home:sofa',b.id)).toContain('Delivered');
  const base=interiorForBuilding(b),n=base.props.length,inside=furnishInterior(s,b.id,base);expect(base.props.length).toBe(n);expect(inside.props.some(p=>p.label==='Lounge suite')).toBe(true);expect(inside.interactables.some(p=>p.label==='Lounge suite'&&p.effect==='sit')).toBe(true);const cash=s.player.cash;expect(buyMarket(s,'home:sofa',b.id)).toContain('Already');expect(s.player.cash).toBe(cash);
 });
 it('registers a map company in the existing daily business ledger and preserves orders on save',()=>{
  const s=small(5);s.player.cash=1e8;const b=s.world.buildings.find(b=>!['hospital','police','prison','airport'].includes(b.kind))!;
  expect(createCompany(s,'Mosaic Motors','retail',b.id)).toContain('is open');expect(b.name).toBe('Mosaic Motors');expect(s.life.businesses.find(c=>c.id===b.id)?.name).toBe('Mosaic Motors');const cash=s.player.cash;expect(createCompany(s,'Again','retail',b.id)).toContain('already');expect(s.player.cash).toBe(cash);
  expect(buyMarket(s,'boat:fishing',b.id)).toContain('Delivered');const loaded=restore(serialize(s));expect(loaded.commerce.purchases[0].sku).toBe('boat:fishing');expect(loaded.life.businesses[0].name).toBe('Mosaic Motors');expect(restoreCommerce({purchases:'bad'}).purchases).toEqual([]);
 });
 it('hull size changes acceleration, rudder authority and stopping distance',()=>{
  const smallBoat=newSea(),ship=newSea(),light={length:3,speed:35,mass:1},heavy={length:180,speed:12,mass:800};
  for(let i=0;i<120;i++){stepSea(smallBoat,light,1,.5,.05);stepSea(ship,heavy,1,.5,.05);}expect(smallBoat.speed).toBeGreaterThan(ship.speed);expect(Math.abs(smallBoat.heading)).toBeGreaterThan(Math.abs(ship.heading));
  const speed=ship.speed;stepSea(ship,heavy,0,0,.05);expect(ship.speed).toBeGreaterThan(speed*.9);expect(ship.x).toBeGreaterThan(15);
 });
 it('a map rocket is charged once, cannot be double-fired and produces an existing game projectile',()=>{
  const s=small(3);s.player.cash=1e8;const b=s.world.buildings[0];buyMarket(s,'defense:launcher',b.id);const id=s.commerce.purchases[0].id,cash=s.player.cash;expect(launchRocket(s,id,b.x0+.5,b.y0+.5)).toContain('launched');expect(s.player.cash).toBe(cash-1000);expect(launchRocket(s,id,b.x0+.5,b.y0+.5)).toContain('already');expect(s.player.cash).toBe(cash-1000);s.tick+=240;updateRockets(s);expect(s.toys.some(t=>t.def==='cannonball'&&t.state==='flying')).toBe(true);expect(s.commerce.purchases[0].flight).toBeUndefined();expect(Object.keys(s.world.civicDamage).length).toBeGreaterThan(0);
 });
});
