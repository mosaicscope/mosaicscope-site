export type Waypoint=readonly [number,number];
/** Travel at a fixed speed, pause at destinations, then retrace the same clear aisle. */
export function routeAt(path:readonly Waypoint[],time:number,speed=.55,dwell=3){
 if(path.length<2)return{x:path[0]?.[0]??0,y:path[0]?.[1]??0,moving:false,facing:1,phase:0};
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

/** Separate work/rest beats per person. Gestures have starts, pauses and returns to rest. */
export function activityAt(id:number,time:number,role:'table'|'lounge'|'work'|'queue'|'crew'|'shop'='table'):string{
 const period=19+(Math.abs(id*7)%13),beat=((time+id*3.71)%period+period)%period;
 if(role==='table')return beat<1.8?'bet':beat<5?'watch':beat>period-2.5?'sitdrink':'sit';
 if(role==='lounge')return beat<3?'sitdrink':beat<7?'talk':'sit';
 if(role==='work')return beat<4?'type':beat<6?'give':beat<10?'inspect':'idle';
 if(role==='crew')return beat<3?'give':beat<6?'inspect':'idle';
 if(role==='shop')return beat<4?'inspect':beat<7?'give':'idle';
 return beat<3?'phone':beat<5?'inspect':'idle';
}
