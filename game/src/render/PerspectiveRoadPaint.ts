import type {CitySegment} from '../world/MappedWorld';
import {ROAD_PAINT} from './RoadArt';
export interface PerspectiveRoadLine{offset:number;color:string;dashed:boolean}
/** Translate mapped lane positions from metres to world tiles, preserving the isometric paint colours. */
export function perspectiveRoadLines(road:CitySegment,metresPerTile:number):PerspectiveRoadLine[]{
 const edge=Math.max(0,road.half-.15),out:PerspectiveRoadLine[]=[{offset:-edge,color:ROAD_PAINT.edge,dashed:false},{offset:edge,color:ROAD_PAINT.edge,dashed:false}],lanes=road.lanes??[];
 for(let i=1;i<lanes.length;i++){const a=lanes[i-1],b=lanes[i],opposed=a.sign!==b.sign;out.push({offset:(a.offset+b.offset)/(2*metresPerTile),color:opposed?ROAD_PAINT.centre:ROAD_PAINT.lane,dashed:!opposed});}
 if(!lanes.length&&road.oneway===0)out.push({offset:0,color:ROAD_PAINT.centre,dashed:false});return out;
}
