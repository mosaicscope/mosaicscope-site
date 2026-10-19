export type Waypoint=readonly [number,number];
/** Travel at a fixed speed, pause at destinations, then retrace the same clear aisle. */
export function routeAt(path:readonly Waypoint[],time:number,speed=.55,dwell=3){
 const route=[...path,...path.slice(0,-1).reverse()];
 const lengths=route.slice(1).map((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1]));
 const period=lengths.reduce((a,n)=>a+n/speed+dwell,0);
 let elapsed=((time%period)+period)%period;
 for(let i=0;i<lengths.length;i++){
  const duration=lengths[i]/speed,a=route[i],b=route[i+1];
  if(elapsed<duration){const u=elapsed/duration;return{x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,moving:true,facing:b[0]-a[0]-(b[1]-a[1])>=0?1:-1,phase:elapsed*speed*3.8};}
  elapsed-=duration;if(elapsed<dwell)return{x:b[0],y:b[1],moving:false,facing:b[0]-a[0]-(b[1]-a[1])>=0?1:-1,phase:0};elapsed-=dwell;
 }
 return{x:path[0][0],y:path[0][1],moving:false,facing:1,phase:0};
}
