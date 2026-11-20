import {describe,it,expect} from 'vitest';
import {Camera} from '../src/render/Camera';
import {MAPPED_HEIGHT_RATIO,MAPPED_FIGURE_SCALE,ADULT_METRES,METRES_PER_TILE} from '../src/world/WorldScale';
import {BONES,HEAD_R} from '../src/render/StickFigure';
import {Z_PX} from '../src/world/iso';
import {DestinationRoads} from '../src/render/DestinationRoads';
describe('consistent street framing',()=>{
 it('starts with readable mobile and desktop framing and preserves deliberate zoom on resize',()=>{const cam=new Camera();cam.resize(390,844);expect(cam.zoom).toBe(2.2);cam.resize(1280,800);expect(cam.zoom).toBe(2.4);cam.setZoom(3);cam.resize(800,600);expect(cam.targetZoom).toBe(3);cam.frameStreet();expect(cam.targetZoom).toBeGreaterThanOrEqual(2.2);expect(cam.targetZoom).toBeLessThanOrEqual(2.4);});
 it('projects people, surveyed buildings and cars with the same metre height',()=>{const person=MAPPED_FIGURE_SCALE*(BONES.HIP+BONES.TORSO+BONES.NECK+HEAD_R);expect(person).toBeCloseTo(ADULT_METRES*Z_PX/METRES_PER_TILE);expect(16*MAPPED_HEIGHT_RATIO).toBe(Z_PX/METRES_PER_TILE);const cam=new Camera();cam.resize(390,844);for(const point of [[2,4],[-100,200]]){cam.unbounded=true;cam.lookAt(...point as [number,number],true);const foot=cam.toScreen(point[0],point[1],0,{x:0,y:0}),head=cam.toScreen(point[0],point[1],ADULT_METRES/METRES_PER_TILE,{x:0,y:0});expect(foot.y-head.y).toBeCloseTo(person*cam.zoom);const back=cam.toWorldAtHeight(head.x,head.y,ADULT_METRES/METRES_PER_TILE);expect(back.x).toBeCloseTo(point[0]);expect(back.y).toBeCloseTo(point[1]);}});
});
describe('local mapped road redraws',()=>{
 it('queries a small subset while retaining long roads crossing the viewport',()=>{const art=new DestinationRoads() as unknown as {build(data:unknown[]):void;candidates(bounds:unknown):unknown[];segments:unknown[]};const roads=Array.from({length:1000},(_,i)=>({id:i,kind:'residential',points:[[i*1000,500],[i*1000+20,500]]}));roads.push({id:1001,kind:'primary',points:[[-1000,0],[1000,0]]});art.build([{roads}]);const near=art.candidates({x0:-10,y0:-10,x1:10,y1:10});expect(near.length).toBeGreaterThan(0);expect(near.length).toBeLessThan(5);expect(art.segments.length).toBe(1001);});
});
