import type {CitySegment,MappedCity} from '../world/MappedWorld';
import type {World} from '../world/World';
import {GROUND} from './palette';
import {T} from '../world/World';

/** Reusable, bounded preparation for static perspective-view data. */
export class PerspectivePrepared {
 private roads=new WeakMap<CitySegment,Map<number,RoadPiece>>();
 private tiles=new Map<string,{type:number;hash:number;color:string}>();
 private windowLayouts=new Map<string,Float32Array>();
 private pending:(()=>void)[]=[];private warming=false;private anchor='';private world?:World;
 /** Prepares nearby static details in short idle slices; on-demand reads always work. */
 prepare(world:World,map:MappedCity,x:number,y:number){const ax=Math.floor(x/16),ay=Math.floor(y/16),key=ax+','+ay+','+(map.revision??0);if(this.world!==world||this.anchor!==key){this.world=world;this.anchor=key;this.pending=[];const px=ax*16,py=ay*16;for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){const tx=px+dx,ty=py+dy;this.pending.push(()=>this.tile(tx,ty,world.tile(tx,ty)));}for(const road of map.streetSegments){if(Math.abs(road.x-x)<120&&Math.abs(road.y-y)<120&&!this.roads.has(road))this.pending.push(()=>this.road(road,0,Math.min(road.length,120)));}for(let row=1;row<=8;row++)for(let col=1;col<=8;col++)this.pending.push(()=>this.windows(row,col,false));}this.schedule();}
 private schedule(){if(this.warming||!this.pending.length)return;this.warming=true;const work=()=>{this.warming=false;const end=performance.now()+2;let count=0;while(this.pending.length&&count++<24&&performance.now()<end)this.pending.pop()!();if(this.pending.length)this.schedule();};if(typeof requestIdleCallback==='function')requestIdleCallback(work,{timeout:1000});else setTimeout(work,50);}
 road(road:CitySegment,start=0,end=road.length):readonly RoadPiece[]{let cache=this.roads.get(road);if(!cache){cache=new Map();this.roads.set(road,cache);}const pieces:RoadPiece[]=[];for(let index=Math.max(0,Math.floor(start/12));index*12<Math.min(end,road.length);index++){let piece=cache.get(index);if(!piece){const at=index*12,to=Math.min(road.length,at+12),x=road.x+road.dx*at,y=road.y+road.dy*at,u=road.x+road.dx*to,v=road.y+road.dy*to,ox=road.dy*road.half,oy=road.dx*road.half;piece={at,to,x,y,u,v,points:[[x-ox,y+oy,.01],[u-ox,v+oy,.01],[u+ox,v-oy,.01],[x+ox,y-oy,.01]]};cache.set(index,piece);}pieces.push(piece);}return pieces;}
 tile(x:number,y:number,type:number){const key=x+','+y,cached=this.tiles.get(key);if(cached?.type===type)return cached;const hash=Math.abs(Math.imul(x,73856093)^Math.imul(y,19349663)),colors=GROUND[type===T.TREE?T.GRASS:type]??GROUND[T.PAVE],entry={type,hash,color:colors[hash%5<2?0:1]};if(this.tiles.size>=12000)this.tiles.delete(this.tiles.keys().next().value!);this.tiles.set(key,entry);return entry;}
 windows(rows:number,cols:number,ribbon:boolean):Float32Array{const key=rows+','+cols+','+Number(ribbon),found=this.windowLayouts.get(key);if(found)return found;const inset=ribbon?.08:.2,out=new Float32Array(rows*cols*4);let i=0;for(let f=0;f<rows;f++)for(let c=0;c<cols;c++){out[i++]=(c+inset)/cols;out[i++]=(c+1-inset)/cols;out[i++]=(f+.23)/rows;out[i++]=(f+.75)/rows;}this.windowLayouts.set(key,out);return out;}
}
export interface RoadPiece{at:number;to:number;x:number;y:number;u:number;v:number;points:[number,number,number][]}
