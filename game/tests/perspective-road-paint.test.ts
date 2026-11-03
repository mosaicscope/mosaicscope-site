import {describe,it,expect} from 'vitest';
import {perspectiveRoadLines} from '../src/render/PerspectiveRoadPaint';
import {ROAD_PAINT} from '../src/render/RoadArt';
import type {CitySegment} from '../src/world/MappedWorld';
const road=(lanes:CitySegment['lanes'],oneway=0):CitySegment=>({id:1,name:'',kind:'residential',x:0,y:0,dx:1,dy:0,length:30,half:4,oneway,speed:5,lanes});
describe('perspective mapped road markings',()=>{
 it('uses matching edge and centre paint for two-way roads',()=>{const lines=perspectiveRoadLines(road([{sign:1,offset:-2},{sign:-1,offset:2}]),2);expect(lines.map(x=>x.color)).toEqual([ROAD_PAINT.edge,ROAD_PAINT.edge,ROAD_PAINT.centre]);expect(lines[2]).toMatchObject({offset:0,dashed:false});});
 it('converts lane positions to world scale and dashes same-direction dividers',()=>{const lines=perspectiveRoadLines(road([{sign:1,offset:-6},{sign:1,offset:-2},{sign:-1,offset:2},{sign:-1,offset:6}]),2);expect(lines[2]).toMatchObject({offset:-2,color:ROAD_PAINT.lane,dashed:true});expect(lines[3]).toMatchObject({offset:0,color:ROAD_PAINT.centre,dashed:false});expect(lines[4].offset).toBe(2);});
 it('does not invent a centre divider for a one-way road without lane data',()=>expect(perspectiveRoadLines(road([],1),2)).toHaveLength(2));
});
