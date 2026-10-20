import {T,type World} from '../world/World';
export interface FarmPlot{x:number;y:number;size:number;gate:{x:number;y:number}}
const plots=new WeakMap<World,FarmPlot|null>();
/** Locate genuinely clear land. Never place stock over roads, buildings, trees or street furniture. */
export function farmPlot(world:World):FarmPlot|null{
 if(plots.has(world))return plots.get(world)!;
 for(const size of[8,7,6,5])for(const a of world.areas.filter(a=>a.kind==='park').sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0))){
  for(let y=Math.ceil(a.y0)+1;y+size<a.y1;y++)for(let x=Math.ceil(a.x0)+1;x+size<a.x1;x++){
   let clear=true;for(let yy=y;yy<y+size&&clear;yy++)for(let xx=x;xx<x+size;xx++)if(world.tile(xx,yy)!==T.GRASS){clear=false;break;}
   if(!clear||world.pois.some(p=>p.x>x-.5&&p.x<x+size+.5&&p.y>y-.5&&p.y<y+size+.5))continue;
   const result={x,y,size,gate:{x:x+size/2,y:y+size-.3}};plots.set(world,result);return result;
  }
 }
 for(const a of world.areas.filter(a=>a.kind==='park'))for(let y=Math.ceil(a.y0)+1;y+7<=a.y1;y++)for(let x=Math.ceil(a.x0)+1;x+7<=a.x1;x++){
  let valid=true;for(let yy=y;yy<y+7&&valid;yy++)for(let xx=x;xx<x+7;xx++)if(![T.GRASS,T.TREE,T.PATH,T.FENCE,T.HEDGE].includes(world.tile(xx,yy))){valid=false;break;}
  if(!valid||world.pois.some(p=>p.kind==='door'&&p.x>=x&&p.x<x+7&&p.y>=y&&p.y<y+7))continue;
  const result={x,y,size:7,gate:{x:x+3.5,y:y+6.7}};plots.set(world,result);return result;
 }
 plots.set(world,null);return null;
}
/** Called before people/pathfinding are created, so the field is identical after save/load. */
export function prepareFarmPlot(world:World):void{const p=farmPlot(world);if(!p)return;
 for(let y=p.y;y<p.y+p.size;y++)for(let x=p.x;x<p.x+p.size;x++)world.set(x,y,T.GRASS);
 for(const poi of world.pois){if(poi.x<p.x||poi.x>=p.x+p.size||poi.y<p.y||poi.y>=p.y+p.size)continue;
  outer:for(let radius=1;radius<20;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=Math.floor(poi.x)+dx+.5,y=Math.floor(poi.y)+dy+.5;if(x>=p.x-.5&&x<=p.x+p.size+.5&&y>=p.y-.5&&y<=p.y+p.size+.5)continue;if(!world.walkable(x,y)||[T.ROAD,T.CROSSWALK].includes(world.tile(Math.floor(x),Math.floor(y)))||world.pois.some(other=>other!==poi&&Math.hypot(other.x-x,other.y-y)<1.5))continue;poi.x=x;poi.y=y;break outer;}
 }
}
export function stockPosition(plot:FarmPlot,index:number,time:number):{x:number;y:number;moving:boolean}{
 const local=time+index*2.3,cycles=Math.floor(local/20),within=local%20,travel=cycles*12+Math.min(12,within),phase=travel*.13+index*2.399,active=within<12;
 return {x:plot.x+1+(plot.size-2)*(.5+.38*Math.sin(phase)),y:plot.y+3.3+(plot.size-4.3)*(.5+.38*Math.sin(phase*.71+index)),moving:active};
}
