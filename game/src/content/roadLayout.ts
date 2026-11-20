import type {MappedRoad} from './destinationTerrain';
export interface RoadLane {sign:number;offset:number}
const count=(s:string|undefined)=>{const n=Number(s);return Number.isInteger(n)&&n>0?Math.min(8,n):0;};
export function roadOneWay(r:MappedRoad):number{return r.tags?.oneway==='-1'?-1:['yes','1','true'].includes(r.tags?.oneway??'')?1:0;}
/** Preserve explicit widths; missing lane widths use a 3.4 m estimate. No extra lanes inferred from appearance. */
export function mappedLaneCounts(r:MappedRoad):{forward:number;backward:number}{const t=r.tags??{},one=roadOneWay(r),total=count(t.lanes),f=count(t['lanes:forward']),b=count(t['lanes:backward']);if(one)return{forward:one>0?(total||f||1):0,backward:one<0?(total||b||1):0};const n=total||f+b||2;return{forward:Math.max(1,f||Math.ceil((n-b)/2)),backward:Math.max(1,b||Math.floor((n-f)/2))};}
/**
 * Chase-friendly widening. Roads keep their surveyed centrelines, junctions and routes; only the carriageway grows,
 * and only into space measured clear of mapped buildings and barriers (see world/RoadClearance). A road with no
 * measured clearance (tests, UI previews before a world build) keeps its surveyed width and lanes.
 */
export const ROAD_WIDEN=1.6,ROAD_WIDEN_CAP=18,ROAD_WIDEN_LANE=3.6;
export const WIDENED_KINDS=new Set(['motorway','trunk','primary','secondary','tertiary','unclassified','residential','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','road']);
const clearances=new Map<number,number>();
/** Record the widest half-width (metres) a road may take before its pavement would touch a building. First value wins. */
export function setRoadClearance(id:number,halfMetres:number):void{if(!clearances.has(id))clearances.set(id,halfMetres);}
export function hasRoadClearance(id:number):boolean{return clearances.has(id);}
export function clearRoadClearances():void{clearances.clear();}
/** Widened half-width in metres: up to ROAD_WIDEN times the surveyed width, never narrower, never into buildings. */
export function widenedHalf(r:MappedRoad,surveyed:number):number{const room=clearances.get(r.id);if(room===undefined||!WIDENED_KINDS.has(r.kind))return surveyed;return Math.max(surveyed,Math.min(surveyed*ROAD_WIDEN,ROAD_WIDEN_CAP,room));}
/** Lane counts for the drivable (possibly widened) road: surveyed lanes, plus extra lanes where the width allows. */
export function drivableLaneCounts(r:MappedRoad,half:number):{forward:number;backward:number}{const n=mappedLaneCounts(r);if(!clearances.has(r.id)||!WIDENED_KINDS.has(r.kind))return n;const fit=Math.floor(half/ROAD_WIDEN_LANE);if(n.forward&&n.backward)return{forward:Math.min(4,Math.max(n.forward,fit)),backward:Math.min(4,Math.max(n.backward,fit))};const total=Math.min(8,Math.max(n.forward+n.backward,Math.floor(half*2/ROAD_WIDEN_LANE)));return n.forward?{forward:total,backward:0}:{forward:0,backward:total};}
export function mappedLanes(r:MappedRoad,half:number):RoadLane[]{const n=drivableLaneCounts(r,half),total=n.forward+n.backward,width=half*2/total,out:RoadLane[]=[];for(let i=0;i<total;i++)out.push({sign:i<n.forward?1:-1,offset:-half+(i+.5)*width});return out;}
/** Numeric OSM limits (including mph) take precedence; estimates are conservative by road class. */
export function mappedSpeed(r:MappedRoad):number {const tag=r.tags?.maxspeed??'',value=parseFloat(tag),kmh=Number.isFinite(value)&&value>0?value*(tag.includes('mph')?1.609344:1):r.kind==='motorway'?100:r.kind==='trunk'?80:['service','living_street'].includes(r.kind)?20:50;return Math.max(5,Math.min(110,kmh))/7.2;}
