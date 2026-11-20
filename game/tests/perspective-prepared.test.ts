import {describe,it,expect} from 'vitest';
import {PerspectivePrepared} from '../src/render/PerspectivePrepared';
import {T} from '../src/world/World';
import {GROUND} from '../src/render/palette';
import type {CitySegment} from '../src/world/MappedWorld';
describe('perspective preparation cache',()=>{
 it('reuses bounded road pieces without materializing a whole long road',()=>{const p=new PerspectivePrepared(),r:CitySegment={id:1,name:'',kind:'residential',x:0,y:0,dx:1,dy:0,length:100000,half:2,oneway:0,speed:50},pieces=p.road(r,120,145);expect(pieces).toHaveLength(3);expect(pieces[0].points[0]).toEqual([120,2,.01]);expect(p.road(r,120,145)[0]).toBe(pieces[0]);});
 it('updates cached tile colour when the actual terrain changes',()=>{const p=new PerspectivePrepared(),a=p.tile(1,2,T.ROAD),b=p.tile(1,2,T.GRASS);expect(p.tile(1,2,T.GRASS)).toBe(b);expect(b).not.toBe(a);expect(GROUND[T.GRASS]).toContain(b.color);});
 it('reuses window layouts and preserves facade pattern dimensions',()=>{const p=new PerspectivePrepared(),layout=p.windows(2,3,false);expect(layout.length).toBe(24);expect(p.windows(2,3,false)).toBe(layout);expect(p.windows(2,3,true)).not.toBe(layout);});
});
