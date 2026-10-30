import type {World} from './World';
/** Bulk-loaded spatial index for mapped buildings, fixtures and streets. */
import RBush from 'rbush';
interface Entry {id:number;minX:number;minY:number;maxX:number;maxY:number}
class Grid{
 private tree=new RBush<Entry>();private pending:Entry[]=[];
 add(id:number,x0:number,y0:number,x1=x0,y1=y0){this.pending.push({id,minX:x0,minY:y0,maxX:x1,maxY:y1});}
 finish(){this.tree.load(this.pending);this.pending=[];}
 query(x0:number,y0:number,x1:number,y1:number){return new Set(this.tree.search({minX:x0,minY:y0,maxX:x1,maxY:y1}).map(item=>item.id));}
}
interface Index{revision:number;buildings:Grid;pois:Grid;roads:Grid;length:number;damage:Map<number,import('../sim/MappedFacadeDamage').DamageFootprint>}
const indices=new WeakMap<World,Index>();
export function worldIndex(w:World){const revision=w.mapped?.revision??0;let index=indices.get(w);if(index&&index.revision===revision&&index.length===w.buildings.length)return index;
 index={revision,buildings:new Grid(),pois:new Grid(),roads:new Grid(),length:w.buildings.length,damage:new Map()};
 for(const b of w.buildings)index.buildings.add(b.id,b.x0,b.y0,b.x1+1,b.y1+1);
 for(const p of w.pois)index.pois.add(p.id,p.x,p.y);
 for(const b of w.mapped?.damageFootprints??[]){const id=w.mapped!.buildingIds.get(Number(b.id));if(id!==undefined)index.damage.set(id,b);}
 w.mapped?.streetSegments.forEach((s,i)=>index!.roads.add(i,Math.min(s.x,s.x+s.dx*s.length)-s.half,Math.min(s.y,s.y+s.dy*s.length)-s.half,Math.max(s.x,s.x+s.dx*s.length)+s.half,Math.max(s.y,s.y+s.dy*s.length)+s.half));
 index.buildings.finish();index.pois.finish();index.roads.finish();
 indices.set(w,index);return index;
}
