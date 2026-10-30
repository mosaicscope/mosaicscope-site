import {expect,it} from 'vitest';
import {small} from './helpers';
import {equipDeveloperWeapon} from '../src/debug/DevEquipment';
it('equips and reloads a weapon even when the ordinary item pool is full',()=>{
 const s=small(3,{trafficCars:0,midCount:0,backgroundCount:0});s.cfg.maxToys=s.toys.length;
 expect(equipDeveloperWeapon(s,s.player,'pistol')).toContain('equipped');
 expect(s.toys[s.player.hand].def).toBe('pistol');expect(s.player.combat!.ammo.pistol).toBe(250);
 const count=s.toys.length;expect(equipDeveloperWeapon(s,s.player,'pistol')).toContain('equipped');expect(s.toys.length).toBe(count);
});
