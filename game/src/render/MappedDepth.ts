import type {MappedCity} from '../world/MappedWorld';
import type {MappedBuilding} from '../ui/DestinationDistrict';
/** Whole polygons sort at their frontmost vertex. Match movers to the facade at their own isometric column. */
export function mappedMoverDepth(m:Pick<MappedCity,'offsetX'|'offsetY'|'metresPerTile'>,buildings:Iterable<MappedBuilding>,x:number,y:number,depth=x+y+.02):number{
 let result=depth;const sx=(x-y-m.offsetX+m.offsetY)*m.metresPerTile,sy=(x+y-m.offsetX-m.offsetY)*m.metresPerTile;
 for(const b of buildings){let front=-Infinity,buildingDepth=-Infinity;for(let i=0;i<b.points.length;i++){const a=b.points[i],c=b.points[(i+1)%b.points.length],ax=a[0]-a[1],cx=c[0]-c[1];buildingDepth=Math.max(buildingDepth,a[0]+a[1]);if(sx<Math.min(ax,cx)||sx>Math.max(ax,cx))continue;const span=cx-ax;if(Math.abs(span)<1e-9){front=Math.max(front,a[0]+a[1],c[0]+c[1]);continue;}const t=(sx-ax)/span;front=Math.max(front,a[0]+a[1]+t*(c[0]+c[1]-a[0]-a[1]));}
  if(Number.isFinite(front)&&sy>=front-.02)result=Math.max(result,buildingDepth/m.metresPerTile+m.offsetX+m.offsetY+.02+(sy-front)/m.metresPerTile*.001);
 }
 return result;
}
