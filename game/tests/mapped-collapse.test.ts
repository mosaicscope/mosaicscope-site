import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {MappedFacadeDamage,type DamageFootprint} from '../src/sim/MappedFacadeDamage';

describe('mapped building collapse',()=>{
 it('accumulates impact energy, saves collapse, lets cars pass and defers repairs while occupied',()=>{
  const sim=small(6),v=makeVehicle(sim,'sedan',57,42.5,2,'free'),damage=new MappedFacadeDamage();
  const b:DamageFootprint={id:42,points:[[50,40],[53,40],[53,45],[50,45]],height:5,tags:{'building:material':'glass'}};
  v.px=57;v.py=42.5;v.x=52;v.y=42.5;v.vx=-20;v.vy=0;v.speed=20;
  const hit={x:53,y:42.5,edge:1,u:.5,nx:-1,ny:0,speed:20,t:.5};
  for(let i=0;i<20&&!damage.snapshot().some(d=>d.collapsed);i++)damage.hit(b,hit,v,10+i,1);
  const record=damage.snapshot().find(d=>d.collapsed);expect(record).toBeDefined();
  const restored=new MappedFacadeDamage();restored.restore(damage.snapshot());v.px=54;v.x=51;expect(restored.contact([b],v,100,1)).toBeNull();
  restored.update(record!.repairBy,[v]);expect(restored.snapshot().some(d=>d.collapsed)).toBe(true);
  v.x=60;restored.update(record!.repairBy+3,[v]);expect(restored.snapshot().some(d=>d.collapsed)).toBe(false);
 });
});
