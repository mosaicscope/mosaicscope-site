import type { World, Building } from './World';

/** A doorway may be a walkable tile inside the facade. Release bodies onto the pavement instead. */
export function buildingExit(w:World,b:Building):{x:number;y:number}{
  const ox=b.door.x+.5,oy=b.door.y+.5;
  let best:{x:number;y:number;score:number}|null=null;
  for(let radius=.5;radius<=3.5;radius+=.5)for(let i=0;i<16;i++){
    const x=Math.floor(ox+Math.cos(i*Math.PI/8)*radius)+.5,y=Math.floor(oy+Math.sin(i*Math.PI/8)*radius)+.5;
    if(!w.walkable(x,y)||w.buildingAt(Math.floor(x),Math.floor(y)))continue;
    const score=Math.hypot(x-ox,y-oy)+(w.drivable(x,y)?8:0);
    if(!best||score<best.score)best={x,y,score};
  }
  return best?{x:best.x,y:best.y}:w.nearestWalkable(ox,oy);
}
