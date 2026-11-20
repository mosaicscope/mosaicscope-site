import type {MappedCity} from '../world/MappedWorld';
export interface RailSegment { x:number;y:number;dx:number;dy:number;length:number;kind:string }
interface Index {revision:number;length:number;cells:Map<string,RailSegment[]>}
const cache=new WeakMap<MappedCity,Index>();
/** Spatially index only guardrails actually present in streamed OpenStreetMap ways. */
export function mappedRails(map:MappedCity,x:number,y:number,radius=40):RailSegment[]{
 const revision=map.revision??0;let index=cache.get(map);
 if(!index||index.revision!==revision||index.length!==map.data.length){
  const cells=new Map<string,RailSegment[]>(),seen=new Set<number>();
  for(const district of map.data)for(const rail of district.barriers??[]){if(seen.has(rail.id)||!['guard_rail','jersey_barrier'].includes(rail.kind))continue;seen.add(rail.id);
   for(let i=1;i<rail.points.length;i++){const a=rail.points[i-1],b=rail.points[i],ax=a[0]/map.metresPerTile+map.offsetX,ay=a[1]/map.metresPerTile+map.offsetY,bx=b[0]/map.metresPerTile+map.offsetX,by=b[1]/map.metresPerTile+map.offsetY,length=Math.hypot(bx-ax,by-ay);if(length<.05||length>1000)continue;
    const segment={x:ax,y:ay,dx:(bx-ax)/length,dy:(by-ay)/length,length,kind:rail.kind};
    for(let cy=Math.floor(Math.min(ay,by)/32);cy<=Math.floor(Math.max(ay,by)/32);cy++)for(let cx=Math.floor(Math.min(ax,bx)/32);cx<=Math.floor(Math.max(ax,bx)/32);cx++){const key=cx+','+cy,list=cells.get(key)??[];list.push(segment);cells.set(key,list);}
   }
  }index={revision,length:map.data.length,cells};cache.set(map,index);
 }
 const found=new Set<RailSegment>();for(let cy=Math.floor((y-radius)/32);cy<=Math.floor((y+radius)/32);cy++)for(let cx=Math.floor((x-radius)/32);cx<=Math.floor((x+radius)/32);cx++)for(const item of index.cells.get(cx+','+cy)??[])found.add(item);
 return [...found];
}
/** Bound detail to the portion close to the player. */
export function railSpan(segment:RailSegment,x:number,y:number,radius=40):[number,number] {
 const at=(x-segment.x)*segment.dx+(y-segment.y)*segment.dy;
 return [Math.max(0,at-radius),Math.min(segment.length,at+radius)];
}
