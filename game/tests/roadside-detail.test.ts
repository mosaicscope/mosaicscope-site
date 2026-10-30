import {describe,it,expect} from 'vitest';
import {mappedRails,railSpan} from '../src/world/MappedRails';
import {validDistrict} from '../src/world/CitySurvey';
import type {MappedCity} from '../src/world/MappedWorld';
import type {DistrictData} from '../src/ui/DestinationDistrict';
const fixture:DistrictData={code:'CHC',cx:1,cy:1,centre:{name:'test'},buildings:[],roads:[],venues:[],barriers:[{id:42,kind:'guard_rail',points:[[0,0],[20,0]],tags:{barrier:'guard_rail'}}]};
const city=():MappedCity=>({metresPerTile:2,offsetX:10,offsetY:20,revision:1,data:[fixture]} as unknown as MappedCity);
describe('surveyed roadside features',()=>{
 it('renders only mapped barrier ways, with converted coordinates and bounded spans',()=>{const map=city(),rails=mappedRails(map,10,20,20);expect(rails).toHaveLength(1);expect(rails[0]).toMatchObject({x:10,y:20,length:10,kind:'guard_rail'});expect(railSpan(rails[0],15,20,2)).toEqual([3,7]);expect(mappedRails(map,100,100,2)).toHaveLength(0);});
 it('deduplicates district overlap and refreshes the index on a map revision',()=>{const map=city();map.data=[fixture,{...fixture}];expect(mappedRails(map,10,20,20)).toHaveLength(1);map.data=[{...fixture,barriers:[]}];map.revision=2;expect(mappedRails(map,10,20,20)).toHaveLength(0);});
 it('rejects invalid geometry from a streamed barrier',()=>{expect(validDistrict(fixture)).toBe(true);expect(validDistrict({...fixture,barriers:[{...fixture.barriers![0],points:[[NaN,0],[2,3]]}]})).toBe(false);});
});

