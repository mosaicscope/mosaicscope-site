/** Isometric ground extent plus room for following/braking beyond the visible edge. */
export function trafficRadiusForView(width:number,height:number,zoom:number):number {return Math.max(32,Math.min(120,Math.hypot(width/64,height/32)/(Math.SQRT2*Math.max(.1,zoom))+18));}
