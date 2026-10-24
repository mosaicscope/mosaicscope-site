import {moveTo} from '../src/ai/steps';
import {beforeAll,describe,it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {bakeCityDistrict,validDistrict} from '../src/world/CitySurvey';
import {mappedPoint} from '../src/world/MappedWorld';
import {CityTiles} from '../src/world/CityTiles';
import {SpatialHash} from '../src/world/SpatialHash';
import {Navigation} from '../src/world/Navigation';
import {Camera} from '../src/render/Camera';
import {serialize,restore} from '../src/persistence/SaveSystem';
import {T} from '../src/world/World';
import type {DistrictData} from '../src/ui/DestinationDistrict';

const district:DistrictData={code:'CHC',cx:-4,cy:0,centre:{name:'Streamed test district'},venues:[],
 buildings:[{id:999999991,name:'Survey workshop',kind:'office',height:6,heightEstimated:false,tags:{building:'commercial'},points:[[-1610,-25],[-1590,-25],[-1590,-15],[-1610,-15],[-1610,-25]]}],
 roads:[{id:999999992,name:'Continued street',kind:'residential',tags:{},points:[[-1800,0],[-1400,0]]}]};
let sim:Simulation;
beforeAll(()=>{sim=new Simulation({cityMap:'christchurch',midCount:0,backgroundCount:0,trafficCars:0});for(const _ of bakeCityDistrict(sim.world,district))void _;},30000);
describe('continuous surveyed city',()=>{
 it('bakes real roads and building collisions beyond the old western wall, with stable IDs on revisits',()=>{
  const w=sim.world,m=w.mapped!,road=mappedPoint(m,-1600,0),wall=mappedPoint(m,-1600,-20),count=w.buildings.length;
  expect(road.x).toBeLessThan(0);expect(w.tile(Math.floor(road.x),Math.floor(road.y))).toBe(T.ROAD);
  expect(w.walkable(road.x,road.y)).toBe(true);expect(w.walkable(wall.x,wall.y)).toBe(false);expect(w.buildingAt(wall.x,wall.y)?.name).toBe('Survey workshop');
  for(const _ of bakeCityDistrict(w,district))void _;
  expect(w.buildings.length).toBe(count);expect(m.streetSegments.filter(s=>s.id===999999992)).toHaveLength(1);
 });
 it('paths around streamed buildings using bounded scratch space at negative coordinates',()=>{
  const m=sim.world.mapped!,a=mappedPoint(m,-1620,-20),b=mappedPoint(m,-1580,-20),nav=new Navigation(sim.world,3500),path=nav.findPath(a.x,a.y,b.x,b.y);
  expect(path).not.toBeNull();expect(path!.length).toBeGreaterThan(2);expect(path![path!.length-2]).toBeCloseTo(b.x,0);
 });
 it('keeps the camera, player and spatial queries open past every old edge',()=>{
  const cam=new Camera();cam.unbounded=true;cam.lookAt(-250,sim.world.size+200,true);cam.update(1,true);expect(cam.x).toBe(-250);expect(cam.y).toBeGreaterThan(sim.world.size);
  const p=sim.player;p.x=p.px=-230;p.y=p.py=sim.world.size+120;sim.focus={x:p.x,y:p.y};sim.step();expect(p.x).toBeLessThan(0);expect(p.y).toBeGreaterThan(sim.world.size);
  const hash=new SpatialHash(20,20,2,8,true),out:number[]=[];hash.insert(1,-200,500);hash.insert(2,900,500);expect(hash.query(-200,500,3,out)).toBe(1);expect(out[0]).toBe(1);
 });
 it('continues walking after reaching an intermediate streamed-city path leg',()=>{
  const p=sim.player;p.x=p.px=-300;p.y=p.py=-300;p.path=new Float32Array([-300,-300]);p.pathReq=0;p.repathAt=sim.tick+10000;
  expect(moveTo(p,-100,-300,sim)).toBe(false);expect(p.pathReq).toBeGreaterThan(0);
 });
 it('restores the surveyed continuation and player position from saves',()=>{
  const saved=serialize(sim),loaded=restore(saved);expect(loaded.player.x).toBe(sim.player.x);expect(loaded.player.y).toBe(sim.player.y);
  const p=mappedPoint(loaded.world.mapped!,-1600,-20);expect(loaded.world.buildingAt(p.x,p.y)?.name).toBe('Survey workshop');expect(loaded.world.mapped!.buildingIds.get(999999991)).toBe(sim.world.mapped!.buildingIds.get(999999991));
 },30000);
 it('bounds continuation terrain memory without aliasing negative and positive chunks',()=>{
  const tiles=new CityTiles(()=>{});tiles.set(-1,-1,T.ROAD,42);tiles.set(31,31,T.WATER);expect(tiles.tile(-1,-1)).toBe(T.ROAD);expect(tiles.building(-1,-1)).toBe(42);
  for(let x=0;x<1000;x++)tiles.set(x*32,0,T.PATH);tiles.trim(0,0,40);expect(tiles.count).toBe(40);expect(tiles.tile(0,0)).toBe(T.PATH);
 });
 it('rejects malformed district geometry before allocating raster/index data',()=>{
  expect(validDistrict(district)).toBe(true);expect(validDistrict({...district,buildings:[{...district.buildings[0],height:Infinity}]})).toBe(false);expect(validDistrict({...district,roads:[{...district.roads[0],points:[[NaN,0],[1,2]]}]})).toBe(false);
 });
});
