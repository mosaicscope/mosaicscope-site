import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {T} from '../src/world/World';
import {serialize,restore} from '../src/persistence/SaveSystem';
describe('mapped pedestrian and fixture placement',()=>{
 it('keeps newly spawned pedestrians and shelter footprints out of surveyed traffic lanes',()=>{
  const s=new Simulation({cityMap:'christchurch',midCount:20,backgroundCount:80,trafficCars:0}),w=s.world;
  const people=s.chars.filter(c=>c.inCar<0&&c.inside<0&&c.tier!=='player');const onRoad=people.filter(c=>w.carriageway(c.x,c.y));expect(onRoad.map(c=>({name:c.name,role:c.role,tier:c.tier,x:c.x,y:c.y,tile:w.tile(Math.floor(c.x),Math.floor(c.y))}))).toEqual([]);
  const count=s.chars.length;s.spawnNpcAt(s.player.x,s.player.y,12);expect(s.chars.slice(count).filter(c=>w.carriageway(c.x,c.y)).map(c=>c.name)).toEqual([]);
  const shelters=w.pois.filter(p=>p.kind==='busstop');expect(shelters.length).toBeGreaterThan(0);
  for(const p of shelters)expect(w.fixtureClear(p.x,p.y,p.angle??(p.dir===1?Math.PI/2:0),1,.4)).toBe(true);
 },30000);
 it('detects a mapped carriageway even if its underlying tile is pavement',()=>{
  const s=new Simulation({cityMap:'christchurch',midCount:0,backgroundCount:0,trafficCars:0}),w=s.world,road=w.mapped!.streetSegments.find(r=>r.length>10)!;const x=road.x+road.dx*5,y=road.y+road.dy*5,tx=Math.floor(x),ty=Math.floor(y);w.set(tx,ty,T.PAVE);expect(w.carriageway(x,y)).toBe(true);const foot=w.nearestFoot(x,y,20);expect(w.carriageway(foot.x,foot.y)).toBe(false);
  const saved=restore(serialize(s));expect(saved.world.mapped).toBeTruthy();
 },30000);
});
