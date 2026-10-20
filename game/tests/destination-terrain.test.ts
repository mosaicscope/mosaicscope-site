import {describe,it,expect} from 'vitest';
import {roadHalfWidth,waterBlocked,terrainAt,type MappedTerrain} from '../src/content/destinationTerrain';
const lake:MappedTerrain={id:1,name:'Mapped lake',kind:'water',points:[[0,0],[20,0],[20,20],[0,20],[0,0]]};
describe('mapped terrain changes movement',()=>{
 it('blocks lake interiors but permits real mapped bridges and dry land',()=>{expect(waterBlocked(10,10,[lake],[])).toBe(true);expect(waterBlocked(30,10,[lake],[])).toBe(false);expect(waterBlocked(10,10,[lake],[{id:4,name:'Bridge',kind:'footway',points:[[-5,10],[25,10]],tags:{bridge:'yes'}}])).toBe(false);expect(waterBlocked(10,15,[lake],[{id:4,name:'Bridge',kind:'footway',points:[[-5,10],[25,10]],tags:{bridge:'yes'}}])).toBe(true);});
 it('uses measured width or lane count before inferred road class widths',()=>{const road={id:1,name:'',kind:'residential',points:[]};expect(roadHalfWidth({...road,tags:{width:'5'}})).toBe(2.5);expect(roadHalfWidth({...road,tags:{lanes:'4'}})).toBe(6.4);expect(roadHalfWidth({...road,tags:{width:'bad'}})).toBe(3);expect(terrainAt(10,10,[lake])?.name).toBe('Mapped lake');});
});
