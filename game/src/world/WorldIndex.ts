import type {World} from './World';
/** Coarse static broad phase, rebuilt only when streamed geometry changes. */
class Grid{
 private cells=new Map<string,number[]>();
 add(id:number,x0:number,y0:number,x1=x0,y1=y0){for(let y=Math.floor(y0/32);y<=Math.floor(y1/32);y++)for(let x=Math.floor(x0/32);x<=Math.floor(x1/32);x++){const key=x+','+y,a=this.cells.get(key)??[];a.push(id);this.cells.set(key,a);}}
 query(x0:number,y0:number,x1:number,y1:number){const ids=new Set<number>();for(let y=Math.floor(y0/32);y<=Math.floor(y1/32);y++)for(let x=Math.floor(x0/32);x<=Math.floor(x1/32);x++)for(const id of this.cells.get(x+','+y)??[])ids.add(id);return ids;}
}
interface Index{revision:number;buildings:Grid;pois:Grid;roads:Grid;length:number;damage:Map<number,import('../sim/MappedFacadeDamage').DamageFootprint>}
const indices=new WeakMap<World,Index>();
export function worldIndex(w:World){const revision=w.mapped?.revision??0;let index=indices.get(w);if(index&&index.revision===revision&&index.length===w.buildings.length)return index;
 index={revision,buildings:new Grid(),pois:new Grid(),roads:new Grid(),length:w.buildings.length,damage:new Map()};
 for(const b of w.buildings)index.buildings.add(b.id,b.x0,b.y0,b.x1,b.y1);
 for(const p of w.pois)index.pois.add(p.id,p.x,p.y);
 for(const b of w.mapped?.damageFootprints??[]){const id=w.mapped!.buildingIds.get(Number(b.id));if(id!==undefined)index.damage.set(id,b);}
 w.mapped?.streetSegments.forEach((s,i)=>index!.roads.add(i,Math.min(s.x,s.x+s.dx*s.length),Math.min(s.y,s.y+s.dy*s.length),Math.max(s.x,s.x+s.dx*s.length),Math.max(s.y,s.y+s.dy*s.length)));
 indices.set(w,index);return index;
}
