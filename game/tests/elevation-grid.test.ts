import {describe,it,expect} from 'vitest';
import {sampledElevation,validElevation,elevationAt} from '../src/world/Elevation';
import type {ElevationTile} from '../src/world/Elevation';
import type {MappedCity} from '../src/world/MappedWorld';
const tile:ElevationTile={code:'CHC',cx:0,cy:0,spacing:100,reference:10,heights:Array.from({length:25},(_,i)=>10+i%5+Math.floor(i/5)*2),source:'test',sourceUrl:'test'};
describe('token-free elevation grid',()=>{
 it('interpolates and converts metres to world units',()=>{expect(validElevation(tile,0,0)).toBe(true);expect(sampledElevation(tile,0,0)).toBe(6);const map={metresPerTile:2,offsetX:10,offsetY:10,elevation:new Map([['0,0',tile]])} as unknown as MappedCity;expect(elevationAt(map,10,10)).toBe(3);expect(elevationAt(map,1000,1000)).toBeNull();});
 it('rejects missing and non-finite samples',()=>{expect(validElevation({...tile,heights:[0]},0,0)).toBe(false);expect(validElevation({...tile,heights:tile.heights.map((v,i)=>i===4?NaN:v)},0,0)).toBe(false);});
});
