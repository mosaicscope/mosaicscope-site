import type {MappedRoad} from './destinationTerrain';
export interface RoadLane {sign:number;offset:number}
const count=(s:string|undefined)=>{const n=Number(s);return Number.isInteger(n)&&n>0?Math.min(8,n):0;};
export function roadOneWay(r:MappedRoad):number{return r.tags?.oneway==='-1'?-1:['yes','1','true'].includes(r.tags?.oneway??'')?1:0;}
/** Preserve explicit widths; missing lane widths use a 3.4 m estimate. No extra lanes inferred from appearance. */
export function mappedLaneCounts(r:MappedRoad):{forward:number;backward:number}{const t=r.tags??{},one=roadOneWay(r),total=count(t.lanes),f=count(t['lanes:forward']),b=count(t['lanes:backward']);if(one)return{forward:one>0?(total||f||1):0,backward:one<0?(total||b||1):0};const n=total||f+b||2;return{forward:Math.max(1,f||Math.ceil((n-b)/2)),backward:Math.max(1,b||Math.floor((n-f)/2))};}
export function mappedLanes(r:MappedRoad,half:number):RoadLane[]{const n=mappedLaneCounts(r),total=n.forward+n.backward,width=half*2/total,out:RoadLane[]=[];for(let i=0;i<total;i++)out.push({sign:i<n.forward?1:-1,offset:-half+(i+.5)*width});return out;}
/** Numeric OSM limits (including mph) take precedence; estimates are conservative by road class. */
export function mappedSpeed(r:MappedRoad):number {const tag=r.tags?.maxspeed??'',value=parseFloat(tag),kmh=Number.isFinite(value)&&value>0?value*(tag.includes('mph')?1.609344:1):r.kind==='motorway'?100:r.kind==='trunk'?80:['service','living_street'].includes(r.kind)?20:50;return Math.max(5,Math.min(110,kmh))/7.2;}
