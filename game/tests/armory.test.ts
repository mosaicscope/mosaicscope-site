import {describe,it,expect} from 'vitest';
import {small,stage} from './helpers';
import {equipmentPace,unarmedMove} from '../src/content/combat';
import {wound} from '../src/sim/Life';
import {equip} from '../src/inventory/Inventory';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {makeVehicle} from '../src/sim/Traffic';
import {VEHICLES} from '../src/content/vehicles';
describe('player combat and armory',()=>{
 it('hits background people, records consequences and earns unarmed experience',()=>{const sim=small(6),p=sim.player,v=sim.chars.find(c=>c.tier==='background')!;stage(sim,p,v,1);v.inCar=-1;v.inside=-1;v.lod=0;p.inCar=-1;p.inside=-1;sim.rebuildHash();p.combat={style:'slap',xp:0,ammo:{},vest:0,helmet:0};const before=v.emo.composure;expect(sim.punchHeld(p)).toBeGreaterThan(0);expect(v.emo.composure).toBeLessThan(before);expect(v.lastHitBy).toBe(p.id);expect(v.wounds.length).toBeGreaterThan(0);expect(p.combat.xp).toBe(1);expect(p.stats.hits).toBeGreaterThan(0);expect(sim.punchHeld(p)).toBe(0);});
 it('keeps attacks distinct and respects training unlocks',()=>{expect(unarmedMove('uppercut',0)).toEqual(unarmedMove('jab',0));expect(unarmedMove('kick',20).reach).toBeGreaterThan(unarmedMove('hook',20).reach);expect(unarmedMove('shove').knockback).toBeGreaterThan(unarmedMove('slap').knockback);expect(unarmedMove('slap').pose).not.toBe(unarmedMove('jab').pose);});
 it('uses the gun system with finite reserves and separate ammunition loads',()=>{const sim=small(7),p=sim.player,t=sim.spawnToy('pistol',p.x,p.y)!;while(p.hand>=0)sim.dropHeld(p);sim.pickupToy(p,t);equip(p,t.id);p.combat={style:'jab',xp:0,ammo:{pistol:1,'pistol:rubber':1},vest:0,helmet:0};expect(sim.shootAt(p,p.x+5,p.y,-1)).toBe(true);expect(p.combat.ammo.pistol).toBe(0);expect(p.combat.recoil).toBeGreaterThan(0);expect(Math.hypot(p.kx,p.ky)).toBeGreaterThan(0);sim.tick+=100;expect(sim.shootAt(p,p.x+5,p.y,-1)).toBe(false);p.combat.load='rubber';expect(sim.shootAt(p,p.x+5,p.y,-1)).toBe(true);expect(sim.toys.some(t=>t.def==='bullet'&&t.load==='rubber')).toBe(true);expect(p.combat.ammo['pistol:rubber']).toBe(0);});
 it('reduces covered wounds, wears armour and saves equipment and heavy vehicles',()=>{const sim=small(8),p=sim.player;p.combat={style:'hook',xp:20,ammo:{rifle:60},vest:100,helmet:100};const injury=wound(sim,p,'torso',3,'gash',-1,p.x-1,p.y);expect(injury.severity).toBe(2);expect(p.combat.vest).toBeLessThan(100);expect(equipmentPace(p,sim.toys)).toBeLessThan(.92);const tank=makeVehicle(sim,'tank',p.x+4,p.y,0,'parked');tank.owner=p.id;const saved=restore(serialize(sim));expect(saved.player.combat).toEqual(p.combat);expect(saved.vehicles.find(v=>v.cls==='tank')?.owner).toBe(p.id);expect(VEHICLES.tank.mass).toBeGreaterThan(VEHICLES.suv.mass*5);});
});
