import type {Simulation} from './Simulation';
import type {Character} from '../entities/types';
import {TOYS} from '../content/toys';
import {carried,transfer,equip} from '../inventory/Inventory';
import {commitCrime} from './Society';
export function theftRank(c:Character):number{return Math.floor((c.combat?.theftXP??0)/5);}
export function gainTheft(c:Character):void{const s=c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};s.theftXP=(s.theftXP??0)+1;}
/** Stealing transfers the actual held item and a bounded ammunition reserve, never creates a duplicate. */
export function stealWeapon(sim:Simulation,p:Character,v:Character):'none'|'skill'|'full'|'stolen'{
 const t=carried(v).map(id=>sim.toys[id]).find(t=>TOYS[t.def]?.weapon?.gun);if(!t)return 'none';
 const need=t.def==='rifle'||t.def==='golden_pistol'?2:t.def==='smg'||t.def==='shotgun'?1:0;if(theftRank(p)<need)return 'skill';
 if(!transfer(v,p,t,false))return 'full';equip(p,t.id);gainTheft(p);
 const base=t.def==='golden_pistol'?'pistol':t.def,n=Math.min(v.combat?.ammo[base]??(TOYS[t.def].weapon?.mag??12),48);
 p.combat!.ammo[base]=(p.combat!.ammo[base]??0)+n;if(v.combat)v.combat.ammo[base]=Math.max(0,(v.combat.ammo[base]??0)-n);
 commitCrime(sim,p,'snatch',v);v.emo.fear=Math.min(1,v.emo.fear+.2);return 'stolen';
}
