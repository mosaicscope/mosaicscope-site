import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {FLEET_MODELS} from '../src/content/fleet';
import {VEHICLES,FOR_SALE,type VehicleClass} from '../src/content/vehicles';
import {PROP_KINDS,propDef} from '../src/content/streetProps';
import {prepareStreetProps,useStreetProp,updateStreetProps} from '../src/sim/StreetProps';
import {restoreCityPlay} from '../src/sim/CityPlay';
import {makeVehicle} from '../src/sim/Traffic';
import {impactComponents,repairVehicle} from '../src/sim/VehicleDamage';
import {stagePoint} from '../src/ui/CanvasStage';
import {prohibitedItem,scannerDefinition} from '../src/ui/ScannerItems';
import {activityAt,routeAt} from '../src/ui/SceneMotion';
import {windowOn} from '../src/render/Buildings';

describe('23 October city annotations',()=>{
 it('adds more than 70 saleable and road-ready models with different physical specifications',()=>{
  const entries=Object.entries(FLEET_MODELS);expect(entries.length).toBeGreaterThan(70);
  expect(new Set(entries.map(([,m])=>[m.length,m.width,m.height,m.wb,m.lamp,m.trim].join('/'))).size).toBe(entries.length);
  for(const [id]of entries){const d=VEHICLES[id as VehicleClass];expect(FOR_SALE).toContain(id);expect(d.traffic).toBeGreaterThan(0);expect(d.accel*d.brake*d.grip).toBeGreaterThan(0);expect(d.length).toBeGreaterThan(d.width);}
 });
 it('gives every new chassis independent impact damage and restores it through actual repair',()=>{
  const s=small();for(const id of Object.keys(FLEET_MODELS)){const v=makeVehicle(s,id as VehicleClass,10,10,0,'parked');impactComponents(v,1,1,16,1,s.tick);expect(v.components?.panels.some(n=>n>0)).toBe(true);expect(v.components?.wheels.some(w=>w.puncture)).toBe(true);repairVehicle(v);expect(v.components).toBeUndefined();expect(v.damage).toBe(0);}
 });
 it('places the 32 extra prop types on the footpath without blocking entrances and does not duplicate them',()=>{
  const s=small();prepareStreetProps(s);expect(PROP_KINDS.length-5).toBeGreaterThanOrEqual(30);expect(new Set(s.cityPlay.props.map(p=>p.kind)).size).toBe(PROP_KINDS.length);
  for(const p of s.cityPlay.props){expect(s.world.buildingAt(Math.floor(p.x),Math.floor(p.y))).toBeFalsy();expect(s.world.buildings.some(b=>Math.hypot(b.door.x-p.x,b.door.y-p.y)<.8)).toBe(false);}
  const n=s.cityPlay.props.length;prepareStreetProps(s);expect(s.cityPlay.props.length).toBe(n);
 });
 it('adds missing types to an older save while preserving its damaged existing object',()=>{
  const s=small();s.cityPlay.props=[{id:0,kind:'crate',x:4,y:4,z:0,vx:0,vy:0,vz:0,turn:0,spin:0,health:.43,lastHit:0}];prepareStreetProps(s);expect(s.cityPlay.props[0].health).toBe(.43);expect(s.cityPlay.props.some(p=>p.kind==='public_piano')).toBe(true);expect(s.cityPlay.props.some(p=>p.kind==='fountain')).toBe(true);
 });
 it('charges a parking meter once per use and shows an appropriate action instead of pushing it',()=>{
  const s=small();prepareStreetProps(s);const p=s.cityPlay.props.find(p=>p.kind==='parking_meter')!,c=s.player;c.x=p.x-.5;c.y=p.y;c.cash=20;expect(useStreetProp(s,c,p)).toBe(true);expect(c.cash).toBe(18);expect(c.anim.pose).toBe('press');expect(p.vx).toBe(0);useStreetProp(s,c,p);expect(c.cash).toBe(18);
 });
 it('bounces an actual ball while a damaged object cannot grant a benefit',()=>{
  const s=small();prepareStreetProps(s);const p=s.cityPlay.props.find(p=>p.kind==='basketball')!,c=s.player;c.x=p.x-.5;c.y=p.y;c.needs.fun=.2;useStreetProp(s,c,p);expect(p.vz).toBeGreaterThan(3);expect(c.needs.fun).toBeGreaterThan(.2);const h=p.z;updateStreetProps(s,1/60);expect(p.z).toBeGreaterThan(h);const fountain=s.cityPlay.props.find(p=>p.kind==='fountain')!;fountain.health=0;c.x=fountain.x;c.y=fountain.y;c.needs.energy=.2;useStreetProp(s,c,fountain);expect(c.needs.energy).toBe(.2);
 });
 it('preserves the added props through saves and discards obsolete family calls',()=>{
  const s=small();prepareStreetProps(s);s.cityPlay.phone.calls=[{name:'Dad',at:9,missed:true},{name:'Mum',at:10,missed:true}];const out=restoreCityPlay(s.cityPlay);expect(out.props.map(p=>p.kind)).toEqual(s.cityPlay.props.map(p=>p.kind));expect(out.phone.calls).toEqual([]);out.props[0].health=0;expect(s.cityPlay.props[0].health).toBe(1);
 });
 it('maps the pointer back to the same cloth position at all roulette camera zoom levels',()=>{
  for(const scale of[1,1.3,2.7,3.2]){const camera={scale,x:665,y:393},p={x:731,y:370},screen={x:600+(p.x-camera.x)*scale,y:380+(p.y-camera.y)*scale};const q=stagePoint(screen.x,screen.y,1200,760,camera);expect(q.x).toBeCloseTo(p.x);expect(q.y).toBeCloseTo(p.y);}
 });
 it('identifies individual weapons, ordinary items and all carried drug packs for scanning',()=>{
  for(const def of['pistol','rifle','bat','knife','camera','phone','stimulant_powder','cannabis','sedative']){const item={id:1,def,name:def,category:['pistol','rifle','bat','knife'].includes(def)?'weapon':'prop'};expect(scannerDefinition(item)).toBe(def);expect(prohibitedItem(item)).toBe(!['camera','phone'].includes(def));}
  expect(prohibitedItem({id:2,def:'beer',name:'beer',category:'food'})).toBe(false);
 });
 it('gives people separated rests and activity beats while handling stationary scene routes',()=>{
  const poses=new Set(Array.from({length:60},(_,t)=>activityAt(17,t)));expect(poses.has('sit')).toBe(true);expect(poses.has('bet')).toBe(true);expect(poses.has('sitdrink')).toBe(true);expect(Array.from({length:20},(_,id)=>activityAt(id,8)).some(p=>p!==activityAt(0,8))).toBe(true);expect(routeAt([[2,3]],9)).toMatchObject({x:2,y:3,moving:false});
 });
 it('keeps household lights stable between beats but changes individual occupied rooms over time',()=>{
  const a=Array.from({length:50},(_,id)=>windowOn(id,6,10)),b=Array.from({length:50},(_,id)=>windowOn(id,6,300));expect(a).not.toEqual(b);expect(a).toEqual(Array.from({length:50},(_,id)=>windowOn(id,6,10)));
 });
 it('has a distinct renderable physical model and interaction for every new prop',()=>{for(const k of PROP_KINDS){const d=propDef(k);expect(d.model.length*d.action.length*d.line.length).toBeGreaterThan(0);expect(d.mass).toBeGreaterThan(0);}});
});
