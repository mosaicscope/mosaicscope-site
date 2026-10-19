import {World,T,PERIOD,ROAD_W} from './World';
/** Place furniture on the kerb, outside doorways, pedestrian crossings and the carriageway. */
export function placeStreetFixtures(w:World):void{
 const valid=(x:number,y:number)=>{const tx=Math.floor(x),ty=Math.floor(y);if(w.tile(tx,ty)!==T.SIDEWALK)return false;
  const horizontal=w.isRoadLine(ty-1)||w.isRoadLine(ty+1),vertical=w.isRoadLine(tx-1)||w.isRoadLine(tx+1);if(!horizontal&&!vertical)return false;
  const m=(horizontal?tx:ty)%PERIOD;if(m<ROAD_W+4||m>PERIOD-4)return false;
  return !w.pois.some(p=>p.kind==='door'&&Math.hypot(p.x-x,p.y-y)<2.5);
 };
 const occupied:{x:number;y:number}[]=[];
 for(const p of w.pois.filter(p=>p.kind==='busstop')){let best:{x:number;y:number;d:number}|undefined;
  for(let y=Math.max(1,Math.floor(p.y)-18);y<Math.min(w.size-1,p.y+18);y++)for(let x=Math.max(1,Math.floor(p.x)-18);x<Math.min(w.size-1,p.x+18);x++){
   if(!valid(x+.5,y+.5)||occupied.some(o=>Math.hypot(o.x-x-.5,o.y-y-.5)<4))continue;const d=Math.hypot(x+.5-p.x,y+.5-p.y);if(!best||d<best.d)best={x:x+.5,y:y+.5,d};
  }
  if(best){p.x=best.x;p.y=best.y;occupied.push(p);p.dir=w.isRoadLine(Math.floor(p.y)-1)||w.isRoadLine(Math.floor(p.y)+1)?0:1;w.shelter[Math.floor(p.y)*w.size+Math.floor(p.x)]=1;}
 }
 for(let r=0;r<w.maxLine;r++)for(let c=0;c<w.maxLine;c++){
  const x=c*PERIOD+ROAD_W+1.5,y=r*PERIOD+ROAD_W+1.5;if(!w.walkable(x,y))continue;
  w.pois.push({id:w.pois.length,kind:'streetsign',x,y,area:w.areaOf[Math.floor(y)*w.size+Math.floor(x)],name:w.streetName(x,y),dir:0});
  if((r+c)%3===0){const rx=c*PERIOD+10.5,ry=r*PERIOD+ROAD_W+.5;if(valid(rx,ry))w.pois.push({id:w.pois.length,kind:'roadsign',x:rx,y:ry,area:w.areaOf[Math.floor(ry)*w.size+Math.floor(rx)],name:(r+c)%2?'KEEP LEFT':'50',dir:0});}
 }
}
