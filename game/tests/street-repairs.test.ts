import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {startNearbyScene,joinNearbyScene,activeNearbyScenes,updateNearbyScenes} from '../src/sim/NearbyScenes';
import {thinkBackground} from '../src/ai/brain';
import {exitBuilding} from '../src/sim/Society';
import {mappedMoverDepth} from '../src/render/MappedDepth';
import type {MappedBuilding} from '../src/ui/DestinationDistrict';
let sim:Simulation;const world=()=>sim??=new Simulation({cityMap:'christchurch',trafficCars:0,midCount:0,backgroundCount:20});
function cast(){const s=world();s.streetLife.history=[];s.tick=300;s.env.raining=false;const p=s.player;const at=s.world.nearestFoot(p.x,p.y);p.x=p.px=at.x;p.y=p.py=at.y;p.inside=p.inCar=p.arrestedBy=-1;p.phys=0;p.jailUntil=0;for(const c of s.chars)if(c.tier==='principal')c.inside=0;const people=s.chars.filter(c=>c.tier==='background').slice(0,3);for(const [i,c] of people.entries()){Object.assign(c,{x:at.x+i*.1,y:at.y,px:at.x+i*.1,py:at.y,z:0,vz:0,inside:-1,inCar:-1,arrestedBy:-1,jailUntil:0,pursuing:-1,talkWith:-1,phys:0,role:'local',crew:null,goal:null,mode:'idle'});c.emo.fear=0;}return {s,p,people};}
describe('nearby scenes that execute',()=>{
 it('uses existing local casts, keeps positions and executes background actions',()=>{const {s,people}=cast(),before=people.map(c=>[c.x,c.y]),e=startNearbyScene(s,'busking');expect(e).toBeTruthy();expect(people.map(c=>[c.x,c.y])).toEqual(before);const lead=s.chars[e!.actors[0]];for(let i=0;i<35;i++)thinkBackground(lead,s,.2);expect(lead.goal?.stepIdx).toBeGreaterThan(0);expect(lead.anim.pose).toBe('guitar');expect(activeNearbyScenes(s)).toHaveLength(1);});
 it('requires proximity and transfers one tip exactly once',()=>{const {s,p}=cast(),e=startNearbyScene(s,'busking')!,lead=s.chars[e.actors[0]],cash=lead.cash;p.cash=10;const x=p.x;p.x+=100;expect(joinNearbyScene(s,e.id)).toContain('finished');expect(p.cash).toBe(10);p.x=x;expect(joinNearbyScene(s,e.id)).toContain('tipped');expect(p.cash).toBe(8);expect(lead.cash).toBe(cash+2);joinNearbyScene(s,e.id);expect(p.cash).toBe(8);});
 it('does not invent cafe/nightlife scenes, or perform outside in rain',()=>{const {s}=cast();s.env.raining=true;expect(startNearbyScene(s,'busking')).toBeNull();s.env.startHour=12;expect(startNearbyScene(s,'nightout')).toBeNull();s.env.startHour=23;expect(startNearbyScene(s,'cafe_queue')).toBeNull();});
 it('requires actual litter for cleanup and removes it',()=>{const {s,p}=cast();for(const l of s.litter.pieces)l.taken=true;expect(startNearbyScene(s,'cleanup')).toBeNull();const piece=s.litter.pieces[0];Object.assign(piece,{x:p.x,y:p.y,taken:false});const e=startNearbyScene(s,'cleanup')!;expect(e).toBeTruthy();expect(joinNearbyScene(s,e.id)).toContain('tidy');expect(piece.taken).toBe(true);});
 it('ends expired actions and labels no cast that has left',()=>{const {s}=cast(),e=startNearbyScene(s,'busking')!;for(const id of e.actors)s.chars[id].inside=0;expect(activeNearbyScenes(s)).toHaveLength(0);s.tick=3000;updateNearbyScenes(s);expect(s.chars[e.actors[0]].goal).toBeNull();});
});
describe('grounded people and polygon depth',()=>{
 it('resets airborne motion at a real building exit',()=>{const {s,people}=cast(),c=people[0];c.inside=0;c.z=8;c.vz=-4;c.kx=5;c.ky=2;c.vx=1;exitBuilding(s,c);expect(c.z).toBe(s.world.groundZ(c.x,c.y));expect(c.vz+c.kx+c.ky+c.vx).toBe(0);expect(c.px).toBe(c.x);expect(c.py).toBe(c.y);expect(s.world.buildingAt(Math.floor(c.x),Math.floor(c.y))).toBeUndefined();});
 it('puts a person ahead of the local wall even below the farthest vertex depth',()=>{const m={offsetX:0,offsetY:0,metresPerTile:1},b={points:[[0,0],[10,0],[10,2],[0,2]],height:5} as MappedBuilding;expect(mappedMoverDepth(m,[b],1,3)).toBeGreaterThan(12);expect(mappedMoverDepth(m,[b],1,-1)).toBeCloseTo(.02);expect(mappedMoverDepth(m,[b],-10,10)).toBeCloseTo(.02);});
});
