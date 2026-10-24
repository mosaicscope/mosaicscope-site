import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {VEHICLES,type VehicleClass} from '../content/vehicles';
import type {CitySegment} from '../world/MappedWorld';
import {vehicleGeometry,chassisContact,sweptChassisContact} from './VehicleGeometry';
import {utilityDynamics,stepUtility} from './VehicleUtility';
interface Edge{segment:CitySegment;sign:number;from:string;to:string;x:number;y:number;dx:number;dy:number;length:number;offset:number;next:number[]}
interface Route{edge:number;at:number;wait:number}
interface Network{revision:number;edges:Edge[];routes:WeakMap<Vehicle,Route>;buckets:Map<string,Vehicle[]>;tick:number;junctions:Map<string,{car:Vehicle;until:number}>}
const networks=new WeakMap<Simulation,Network>();
const crossingPeople:number[]=[];
const nearbyObstacles:Vehicle[]=[];
const probes=new WeakMap<Vehicle,Vehicle>();
const key=(x:number,y:number)=>x.toFixed(1)+','+y.toFixed(1);
function network(sim:Simulation):Network{
 let n=networks.get(sim);const revision=sim.world.mapped?.streetSegments.length??0;if(n?.revision===revision)return n;const edges:Edge[]=[],nodes=new Map<string,number[]>();
 for(const s of sim.world.mapped?.streetSegments??[]){if(s.length<.25)continue;for(const sign of s.oneway?[s.oneway]:[1,-1]){const x=sign===1?s.x:s.x+s.dx*s.length,y=sign===1?s.y:s.y+s.dy*s.length,dx=s.dx*sign,dy=s.dy*sign,from=key(x,y),to=key(x+dx*s.length,y+dy*s.length),offset=Math.min(.95,Math.max(.48,s.half*.48));const edge:Edge={segment:s,sign,from,to,x,y,dx,dy,length:s.length,offset,next:[]};const list=nodes.get(from)??[];list.push(edges.length);nodes.set(from,list);edges.push(edge);}}
 for(const e of edges){const out=nodes.get(e.to)??[];e.next=out.filter(i=>edges[i].to!==e.from);if(!e.next.length)e.next=out;}
 n={revision,edges,routes:n?.routes??new WeakMap(),buckets:new Map(),tick:-1,junctions:new Map()};networks.set(sim,n);return n;
}
function position(e:Edge,at:number){return{x:e.x+e.dx*at+e.dy*e.offset,y:e.y+e.dy*at-e.dx*e.offset};}
/** Keep the existing pool busy around newly visited streets, without adding entities or teleporting visible cars. */
export function refreshCityPopulation(sim:Simulation):void{
 const m=sim.world.mapped;if(!m)return;const n=network(sim),p=sim.player;
 const local=n.edges.map((e,i)=>({e,i})).filter(({e})=>e.length>10&&Math.hypot(e.x+e.dx*Math.max(0,Math.min(e.length,(p.x-e.x)*e.dx+(p.y-e.y)*e.dy))-p.x,e.y+e.dy*Math.max(0,Math.min(e.length,(p.x-e.x)*e.dx+(p.y-e.y)*e.dy))-p.y)<65&&!m.closedRoads?.has(e.segment.id));
 if(!local.length)return;
 let moved=0;
 for(const v of sim.vehicles){if(moved>=10)break;if(v.owner>=0||v.state!=='drive'||v.siren||v.rescueTarget!==undefined||v.cls==='police'||Math.hypot(v.x-p.x,v.y-p.y)<110)continue;
  for(let attempt=0;attempt<6;attempt++){const {e,i}=sim.rng.pick(local),at=sim.rng.range(4,e.length-4),q=position(e,at),distance=Math.hypot(q.x-p.x,q.y-p.y);
   if(distance<32||distance>70||!sim.world.drivable(q.x,q.y)||sim.vehicles.some(o=>Math.hypot(o.x-q.x,o.y-q.y)<7)||sim.chars.some(c=>c.inCar<0&&Math.hypot(c.x-q.x,c.y-q.y)<3))continue;
   v.x=v.px=q.x;v.y=v.py=q.y;v.heading=Math.atan2(e.dy,e.dx);v.speed=0;n.routes.set(v,{edge:i,at,wait:0});n.tick=-1;if(v.driver>=0){const c=sim.chars[v.driver];c.x=c.px=q.x;c.y=c.py=q.y;}moved++;break;
  }
 }
 let people=0;for(const c of sim.chars){if(people>=6)break;if(c.tier!=='background'||c.promoted||c.inCar>=0||c.inside>=0||c.talkWith>=0||Math.hypot(c.x-p.x,c.y-p.y)<110)continue;const {e}=sim.rng.pick(local),at=sim.rng.range(3,e.length-3),off=e.segment.half+1,q={x:e.x+e.dx*at+e.dy*off,y:e.y+e.dy*at-e.dx*off};if(Math.hypot(q.x-p.x,q.y-p.y)<32||!sim.world.walkable(q.x,q.y)||sim.world.carriageway(q.x,q.y))continue;c.x=c.px=q.x;c.y=c.py=q.y;c.path=null;c.goal=null;c.vx=c.vy=0;people++;}
}
export function snapMappedVehicle(sim:Simulation,v:Vehicle):boolean{
 const n=network(sim);let route:Route|undefined,best=4;
 n.edges.forEach((e,i)=>{const along=Math.max(0,Math.min(e.length,(v.x-e.x)*e.dx+(v.y-e.y)*e.dy)),p=position(e,along),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(e.dy,e.dx)-v.heading),Math.cos(Math.atan2(e.dy,e.dx)-v.heading))),d=Math.hypot(v.x-p.x,v.y-p.y)+angle*.45;if(d<best){best=d;route={edge:i,at:along,wait:0};}});
 if(!route)return false;n.routes.set(v,route);return true;
}
type Factory=(sim:Simulation,cls:VehicleClass,x:number,y:number,dir:number,state:Vehicle['state'])=>Vehicle;
export function spawnMappedVehicles(sim:Simulation,make:Factory):void{
 const n=network(sim),drivers=sim.chars.filter(c=>c.tier==='background'&&c.inCar<0).slice(0,Math.floor(sim.chars.filter(c=>c.tier==='background').length/3)),pool=Object.values(VEHICLES).filter(d=>d.traffic>0),bag=pool.filter(d=>d.design).map(d=>d.cls),rng=sim.rng;
 const model=()=>{if(!bag.length)bag.push(...pool.map(d=>d.cls));return bag.splice(rng.int(0,bag.length-1),1)[0];};
 const candidates=n.edges.map((e,i)=>({e,i})).filter(({e})=>e.length>5&&e.x>10&&e.y>10&&e.x<sim.world.size-10&&e.y<sim.world.size-10);
 const near=candidates.filter(({e})=>Math.hypot(e.x-sim.player.x,e.y-sim.player.y)<110),moving=Math.min(850,Math.max(100,sim.cfg.trafficCars));
 const firstNew=sim.vehicles.length;
 for(let i=sim.vehicles.filter(v=>v.state==='drive').length,attempt=0;i<moving&&attempt<moving*25;attempt++){const list=i<moving*.65&&near.length&&attempt<moving*10?near:candidates;if(!list.length)break;const {e,i:edge}=rng.pick(list),at=rng.range(3,e.length-3),p=position(e,at);if(!sim.world.drivable(p.x,p.y)||sim.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<5)||sim.chars.some(c=>c.inCar<0&&c.inside<0&&Math.hypot(c.x-p.x,c.y-p.y)<3))continue;const v=make(sim,model(),p.x,p.y,0,'drive');v.heading=Math.atan2(e.dy,e.dx);v.dir=((Math.round(v.heading/(Math.PI/2))%4)+4)%4;v.speed=Math.min(5,e.segment.speed*.7);n.routes.set(v,{edge,at,wait:0});const c=drivers.pop();if(c){v.driver=c.id;c.inCar=v.id;c.x=c.px=p.x;c.y=c.py=p.y;}i++;}
 // Kerb parking follows the same road geometry. Keep junctions, entrances and river banks clear.
 let parked=sim.vehicles.filter(v=>v.state==='parked').length;for(const {e}of [...candidates].sort((a,b)=>Math.hypot(a.e.x-sim.player.x,a.e.y-sim.player.y)-Math.hypot(b.e.x-sim.player.x,b.e.y-sim.player.y))){if(parked>=210)break;if(e.sign<0||e.length<9||['primary','trunk','motorway','service'].includes(e.segment.kind))continue;for(let at=5;at<e.length-4&&parked<210;at+=5.5){const off=e.segment.half+.75,x=e.x+e.dx*at+e.dy*off,y=e.y+e.dy*at-e.dx*off;if(!sim.world.walkable(x,y)||sim.world.carriageway(x,y)||sim.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<3.2)||sim.world.pois.some(p=>p.kind==='door'&&Math.hypot(p.x-x,p.y-y)<2.2))continue;make(sim,model(),x,y,0,'parked').heading=Math.atan2(e.dy,e.dx);parked++;}}
 // Police patrols and a nearby unowned car remain available to the full game systems.
 if(!sim.vehicles.slice(0,firstNew).some(v=>v.cls==='police')){const cops=sim.chars.filter(c=>c.role==='cop'&&c.inCar<0);for(let i=0;i<Math.min(2,cops.length);i++){const v=sim.vehicles[firstNew+i];if(!v||v.state!=='drive')continue;v.cls='police';v.siren=false;if(v.driver>=0)sim.chars[v.driver].inCar=-1;v.driver=cops[i].id;cops[i].inCar=v.id;}}
}
/** Local broad phase shared by following, yielding and chassis clearance checks. */
function buckets(sim:Simulation,n:Network):void{if(n.tick===sim.tick)return;n.tick=sim.tick;if(n.buckets.size>2048)n.buckets.clear();else for(const a of n.buckets.values())a.length=0;for(const v of sim.vehicles){const k=Math.floor(v.x/8)+','+Math.floor(v.y/8),a=n.buckets.get(k)??[];a.push(v);n.buckets.set(k,a);}}
export function driveMappedVehicle(sim:Simulation,v:Vehicle,dt:number):void{
 const n=network(sim);let route=n.routes.get(v);if(!route){if(!snapMappedVehicle(sim,v)){v.speed=0;v.state='parked';return;}route=n.routes.get(v)!;}
 if(route.wait>25&&Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)>150){
  for(let attempt=0;attempt<24;attempt++){const edge=sim.rng.int(0,n.edges.length-1),q=n.edges[edge];if(q.length<12||sim.world.mapped?.closedRoads?.has(q.segment.id))continue;
   const at=sim.rng.range(4,q.length-4),p=position(q,at);if(Math.hypot(p.x-sim.focus.x,p.y-sim.focus.y)<150||!sim.world.drivable(p.x,p.y)||sim.vehicles.some(o=>o!==v&&Math.hypot(o.x-p.x,o.y-p.y)<7))continue;
   v.x=v.px=p.x;v.y=v.py=p.y;v.heading=Math.atan2(q.dy,q.dx);v.speed=0;route.edge=edge;route.at=at;route.wait=0;n.tick=-1;break;
  }
 }
 buckets(sim,n);let e=n.edges[route.edge];if(!e){v.state='parked';return;}const d=VEHICLES[v.cls],utility=utilityDynamics(v),geometry=vehicleGeometry(v),oldSpeed=v.speed;let target=Math.min(e.segment.speed,d.topSpeed*.7);
 const mode=sim.world.mapped?.trafficMode??'city',headway=mode==='cruise'?1.8:mode==='rush'?1.15:1.45;target*=mode==='cruise'?.65:mode==='rush'?1:.85;
 const cx=Math.floor(v.x/8),cy=Math.floor(v.y/8),obstacles=nearbyObstacles;obstacles.length=0;for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)for(const o of n.buckets.get(x+','+y)??[]){if(o===v)continue;obstacles.push(o);const dx=o.x-v.x,dy=o.y-v.y,along=dx*e.dx+dy*e.dy,cross=Math.abs(-dx*e.dy+dy*e.dx),gap=along-(geometry.length+vehicleGeometry(o).length)/2;if(along>0&&along<15&&cross<(geometry.width+vehicleGeometry(o).width)/2+.25)target=Math.min(target,Math.max(0,(gap-1)/headway));}
 if(sim.world.mapped?.closedRoads?.has(e.segment.id))target=0;
 {const lookahead=Math.max(5,v.speed*v.speed/(2*d.brake)+geometry.length+2),count=sim.charHash.query(v.x+e.dx*lookahead/2,v.y+e.dy*lookahead/2,lookahead/2+2,crossingPeople);for(let i=0;i<count;i++){const c=sim.chars[crossingPeople[i]];if(c.inCar>=0||c.inside>=0||!sim.world.drivable(c.x,c.y))continue;const along=(c.x-v.x)*e.dx+(c.y-v.y)*e.dy,cross=Math.abs(-(c.x-v.x)*e.dy+(c.y-v.y)*e.dx);if(along>0&&cross<geometry.width/2+.8)target=Math.min(target,Math.sqrt(Math.max(0,2*d.brake*(along-geometry.length/2-1.2))));}}
 // Give way to crossing pedestrians and vehicles already entering this actual mapped junction.
 if(e.length-route.at<6&&e.next.length>1){const cycle=(sim.tick/60)%16,ns=Math.abs(e.dy)>Math.abs(e.dx),green=ns?cycle<7:cycle>=8&&cycle<15;if(!green)target=Math.min(target,Math.sqrt(Math.max(0,2*d.brake*(e.length-route.at-geometry.length/2-.6))));}
 const delta=target-v.speed,rate=delta>0?d.accel*.55*utility.acceleration:d.brake*utility.braking;v.speed=Math.max(0,v.speed+Math.sign(delta)*Math.min(Math.abs(delta),rate*dt));
 let nextAt=route.at+v.speed*dt,nextEdge=route.edge;route.wait=v.speed<.15?route.wait+dt:0;
 if(nextAt>=e.length){const options=e.next.filter(i=>!sim.world.mapped?.closedRoads?.has(n.edges[i].segment.id));if(!options.length){v.speed=0;return;}const turn=sim.rng.weighted(options.map(i=>{const q=n.edges[i],dot=e.dx*q.dx+e.dy*q.dy;return dot>.9?6:dot>-.1?2:.15;}));const old=e,reservation=n.junctions.get(e.to);
  if(reservation&&reservation.car!==v&&reservation.until>sim.tick&&Math.hypot(reservation.car.x-(e.x+e.dx*e.length),reservation.car.y-(e.y+e.dy*e.length))<7){v.speed=0;return;}
  nextEdge=options[turn];e=n.edges[nextEdge];nextAt=Math.min(e.length,nextAt-old.length);
  // Never enter a junction without enough receiving-lane space for the full chassis.
  const exit=position(e,Math.min(e.length,geometry.length+1));
  if(obstacles.some(o=>Math.hypot(o.x-exit.x,o.y-exit.y)<(geometry.length+vehicleGeometry(o).length)/2+.7)){v.speed=0;return;}
  n.junctions.set(old.to,{car:v,until:sim.tick+600});
 }
 const heading=Math.atan2(e.dy,e.dx),angle=Math.atan2(Math.sin(heading-v.heading),Math.cos(heading-v.heading)),nextHeading=v.heading+angle*Math.min(1,dt*5*utility.turnResponse);
 const p=position(e,nextAt);let candidate=probes.get(v);if(!candidate){candidate={...v};probes.set(v,candidate);}candidate.cls=v.cls;candidate.plate=v.plate;candidate.lifeMods=v.lifeMods;candidate.x=p.x;candidate.y=p.y;candidate.px=v.x;candidate.py=v.y;candidate.heading=nextHeading;
 // Reject an occupied or swept chassis position before committing the route, including opposite lanes and turns.
 const occupied=obstacles.some(o=>chassisContact(candidate!,o)||sweptChassisContact(candidate!,o,true))||crossingPeople.some(id=>{const c=sim.chars[id];if(c.inCar>=0||c.inside>=0||!sim.world.drivable(c.x,c.y))return false;const dx=c.x-p.x,dy=c.y-p.y,cos=Math.cos(nextHeading),sin=Math.sin(nextHeading);return Math.abs(dx*cos+dy*sin)<geometry.length/2+c.radius+.4&&Math.abs(-dx*sin+dy*cos)<geometry.width/2+c.radius+.4;});
 if(!occupied&&sim.world.walkable(p.x,p.y)){v.x=p.x;v.y=p.y;route.at=nextAt;route.edge=nextEdge;v.heading=nextHeading;
  const cell=Math.floor(v.x/8)+','+Math.floor(v.y/8),before=cx+','+cy;if(cell!==before){const list=n.buckets.get(before),i=list?.indexOf(v)??-1;if(i>=0)list!.splice(i,1);const next=n.buckets.get(cell)??[];next.push(v);n.buckets.set(cell,next);}
 }else{v.speed=0;route.wait+=dt;}
 v.dir=((Math.round(v.heading/(Math.PI/2))%4)+4)%4;v.yaw=v.speed>0?angle*Math.min(5,1/Math.max(.001,dt)):0;v.wheelTravel=(v.wheelTravel??0)+v.speed*dt;
 stepUtility(v,(v.speed-oldSpeed)/dt,v.yaw*v.speed,v.speed,delta<-.3,dt);
}
/** Only nearby chassis pairs reach SAT, with stable pair order and no duplicate hash inserts. */
export function* nearbyVehiclePairs(vehicles:readonly Vehicle[]):Generator<[number,number]>{
 const cell=10,buckets=new Map<string,number[]>();let radius=1;vehicles.forEach((v,i)=>{const k=Math.floor(v.x/cell)+','+Math.floor(v.y/cell),a=buckets.get(k)??[];a.push(i);buckets.set(k,a);radius=Math.max(radius,vehicleGeometry(v).length*1.2);});const reach=Math.ceil(radius/cell);
 for(let i=0;i<vehicles.length;i++){const v=vehicles[i],x=Math.floor(v.x/cell),y=Math.floor(v.y/cell),matches:number[]=[];for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++)for(const j of buckets.get((x+dx)+','+(y+dy))??[])if(j>i)matches.push(j);matches.sort((a,b)=>a-b);for(const j of matches)yield[i,j];}
}
export function mappedRouteCount(sim:Simulation):number{return network(sim).edges.length;}
