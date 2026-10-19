import { describe,it,expect } from 'vitest';
import { ScreenBounds,overlaps,beginSignFrame,reserveSign } from '../src/render/ScreenBounds';
describe('readable city labels',()=>{
 it('keeps crowded bubbles inside the viewport without intersecting',()=>{const b=new ScreenBounds(390,844),placed=[];for(let i=0;i<10;i++){const r=b.place(300,240,140,65);if(r)placed.push(r);}expect(placed.length).toBeGreaterThan(1);for(const r of placed){expect(r.x).toBeGreaterThanOrEqual(6);expect(r.x+r.w).toBeLessThanOrEqual(384);for(const other of placed)if(r!==other)expect(overlaps(r,other)).toBe(false);}});
 it('rejects overlapping rooftop ads and preserves the same decision on glow replay',()=>{beginSignFrame(800,600);expect(reserveSign('motors',{x:100,y:100,w:140,h:35})).toBe(true);expect(reserveSign('jandal',{x:150,y:110,w:100,h:40})).toBe(false);expect(reserveSign('motors',{x:100,y:100,w:140,h:35})).toBe(true);});
});
