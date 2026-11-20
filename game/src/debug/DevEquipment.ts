import {makeToy} from '../entities/factory';
import type {Character} from '../entities/types';
import {equip} from '../inventory/Inventory';
import {TOYS} from '../content/toys';
import type {Simulation} from '../sim/Simulation';
/** Developer-only bounded reserve prevents ordinary world clutter blocking equipment. */
export function equipDeveloperWeapon(s:Simulation,c:Character,id:string):string{
 const def=TOYS[id];if(!def?.portable||!def.weapon)return 'Choose a portable weapon';
 let t=[c.hand,...c.bag].map(i=>s.toys[i]).find(t=>t?.def===id&&t.holder===c.id&&t.state==='held');
 if(!t){t=s.spawnToy(id,c.x,c.y)??undefined;
  if(!t&&s.toys.length<s.cfg.maxToys+32){t=makeToy(s.toys.length,id,c.x,c.y);s.toys.push(t);}
  if(!t)return 'Cannot equip: developer item reserve is full';
  if(c.hand>=0)s.dropHeld(c);
  const result=s.pickupToy(c,t);if(result!=='hand'&&result!=='bag')return 'Cannot equip: '+result;
 }
 if(!equip(c,t.id))return 'Cannot equip weapon';
 const combat=c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};combat.ammo[id==='golden_pistol'?'pistol':id]=250;combat.load='standard';combat.reloadUntil=0;combat.magUsed={};c.weaponAction=undefined;
 return c.name+': '+def.name+' equipped';
}
