import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {VEHICLES,type VehicleClass} from '../content/vehicles';
import type {CitySegment} from '../world/MappedWorld';
import {vehicleGeometry} from './VehicleGeometry';
import {utilityDynamics,stepUtility} from './VehicleUtility';
interface Edge{segment:CitySegment;sign:number;from:string;to:string;x:number;y:number;dx:number;dy:number;length:number;offset:number;next:number[]}
interface Route{edge:number;at:number;wait:number}
interface Network{edges:Edge[];routes:WeakMap<Vehicle,Route>;buckets:Map<string,Vehicle[]>;tick:number}
const networks=new WeakMap<Simulation,Network>();
const key=(x:number,y:number)=>x.toFixed(1)+','+y.toFixed(1);
function network(sim:Simulation):Network{
 let n=networks.get(sim);if(n)return n;const edges:Edge[]=[],nodes=new Map<string,number[]>();
 for(const s of sim.world.mapped?.streetSegments??[]){if(s.length<.25)continue;for(const sign of s.oneway?[s.oneway]:[1,-1]){const x=sign===1?s.x:s.x+s.dx*s.length,y=sign===1?s.y:s.y+s.dy*s.length,dx=s.dx*sign,dy=s.dy*sign,from=key(x,y),to=key(x+dx*s.length,y+dy*s.length),offset=Math.min(.95,Math.max(.48,s.half*.48));const edge:Edge={segment:s,sign,from,to,x,y,dx,dy,length:s.length,offset,next:[]};const list=nodes.get(from)??[];list.push(edges.length);nodes.set(from,list);edges.push(edge);}}
 for(const e of edges){const out=nodes.get(e.to)??[];e.next=out.filter(i=>edges[i].to!==e.from);if(!e.next.length)e.next=out;}
 n={edges,routes:new WeakMap(),buckets:new Map(),tick:-1};networks.set(sim,n);return n;
}
function position(e:Edge,at:number){return{x:e.x+e.dx*at+e.dy*e.offset,y:e.y+e.dy*at-e.dx*e.offset};}
export function snapMappedVehicle(sim:Simulation,v:Vehicle):boolean{
 const n=network(sim);let route:Route|undefined,best=4;
 n.edges.forEach((e,i)=>{const along=Math.max(0,Math.min(e.length,(v.x-e.x)*e.dx+(v.y-e.y)*e.dy)),p=position(e,along),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(e.dy,e.dx)-v.heading),Math.cos(Math.atan2(e.dy,e.dx)-v.heading))),d=Math.hypot(v.x-p.x,v.y-p.y)+angle*.45;if(d<best){best=d;route={edge:i,at:along,wait:0};}});
 if(!route)return false;n.routes.set(v,route);return true;
}
type Factory=(sim:Simulation,cls:VehicleClass,x:number,y:number,dir:number,state:Vehicle['state'])=>Vehicle;
export function spawnMappedVehicles(sim:Simulation,make:Factory):void{
 const n=network(sim),drivers=sim.chars.filter(c=>c.tier==='background'&&c.inCar<0),pool=Object.values(VEHICLES).filter(d=>d.traffic>0),bag=pool.filter(d=>d.design).map(d=>d.cls),rng=sim.rng;
 const model=()=>{if(!bag.length)bag.push(...pool.map(d=>d.cls));return bag.splice(rng.int(0,bag.length-1),1)[0];};
 const candidates=n.edges.map((e,i)=>({e,i})).filter(({e})=>e.length>5&&e.x>10&&e.y>10&&e.x<sim.world.size-10&&e.y<sim.world.size-10);
 const near=candidates.filter(({e})=>Math.hypot(e.x-sim.player.x,e.y-sim.player.y)<110),moving=Math.min(220,Math.max(100,sim.cfg.trafficCars));
 for(let i=0,attempt=0;i<moving&&attempt<moving*12;attempt++){const list=i<moving*.65&&near.length?near:candidates;if(!list.length)break;const {e,i:edge}=rng.pick(list),at=rng.range(1,e.length-1),p=position(e,at);if(!sim.world.drivable(p.x,p.y)||sim.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<4))continue;const v=make(sim,model(),p.x,p.y,0,'drive');v.heading=Math.atan2(e.dy,e.dx);v.dir=((Math.round(v.heading/(Math.PI/2))%4)+4)%4;v.speed=Math.min(5,e.segment.speed*.7);n.routes.set(v,{edge,at,wait:0});const c=drivers.pop();if(c){v.driver=c.id;c.inCar=v.id;c.x=c.px=p.x;c.y=c.py=p.y;}i++;}
 // Kerb parking follows the same road geometry. Keep junctions, entrances and river banks clear.
 let parked=0;for(const {e}of [...candidates].sort((a,b)=>Math.hypot(a.e.x-sim.player.x,a.e.y-sim.player.y)-Math.hypot(b.e.x-sim.player.x,b.e.y-sim.player.y))){if(parked>=210)break;if(e.sign<0||e.length<9||['primary','trunk','motorway','service'].includes(e.segment.kind))continue;for(let at=5;at<e.length-4&&parked<210;at+=5.5){const off=e.segment.half+.75,x=e.x+e.dx*at+e.dy*off,y=e.y+e.dy*at-e.dx*off;if(!sim.world.walkable(x,y)||sim.world.carriageway(x,y)||sim.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<3.2)||sim.world.pois.some(p=>p.kind==='door'&&Math.hypot(p.x-x,p.y-y)<2.2))continue;make(sim,model(),x,y,0,'parked').heading=Math.atan2(e.dy,e.dx);parked++;}}
 // Police patrols and a nearby unowned car remain available to the full game systems.
 const cops=sim.chars.filter(c=>c.role==='cop');for(let i=0;i<Math.min(2,cops.length);i++){const v=sim.vehicles[i];if(!v)continue;v.cls='police';v.siren=false;if(v.driver>=0)sim.chars[v.driver].inCar=-1;v.driver=cops[i].id;cops[i].inCar=v.id;}
}
/** Local broad phase, shared by following/yielding. Far vehicles use the same routes at a cheaper cadence. */
function buckets(sim:Simulation,n:Network):void{if(n.tick===sim.tick)return;n.tick=sim.tick;for(const a of n.buckets.values())a.length=0;for(const v of sim.vehicles){const k=Math.floor(v.x/8)+','+Math.floor(v.y/8),a=n.buckets.get(k)??[];a.push(v);n.buckets.set(k,a);}}
export function driveMappedVehicle(sim:Simulation,v:Vehicle,dt:number):void{
 const n=network(sim);let route=n.routes.get(v);if(!route){if(!snapMappedVehicle(sim,v)){v.speed=0;v.state='parked';return;}route=n.routes.get(v)!;}
 const near=Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)<100;if(!near&&(sim.tick+v.id)%4!==0)return;if(!near)dt*=4;
 buckets(sim,n);let e=n.edges[route.edge];if(!e){v.state='parked';return;}const d=VEHICLES[v.cls],utility=utilityDynamics(v),geometry=vehicleGeometry(v),oldSpeed=v.speed;let target=Math.min(e.segment.speed,d.topSpeed*.7);
 const cx=Math.floor(v.x/8),cy=Math.floor(v.y/8);for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)for(const o of n.buckets.get(x+','+y)??[]){if(o===v)continue;const dx=o.x-v.x,dy=o.y-v.y,along=dx*e.dx+dy*e.dy,cross=Math.abs(-dx*e.dy+dy*e.dx),gap=along-(geometry.length+vehicleGeometry(o).length)/2;if(along>0&&along<15&&cross<(geometry.width+vehicleGeometry(o).width)/2+.18)target=Math.min(target,Math.max(0,(gap-.8)/1.2));}
 // Give way to crossing pedestrians and vehicles already entering this actual mapped junction.
 if(e.length-route.at<4&&e.next.length>1){const cycle=(sim.tick/60+Math.abs(e.segment.id)%8)%16,ns=Math.abs(e.dy)>Math.abs(e.dx),green=ns?cycle<7:cycle>=8&&cycle<15;if(!green&&e.length-route.at>1)target=Math.min(target,Math.sqrt(Math.max(0,2*d.brake*(e.length-route.at-1))));}
 const delta=target-v.speed,rate=delta>0?d.accel*.55*utility.acceleration:d.brake*utility.braking;v.speed=Math.max(0,v.speed+Math.sign(delta)*Math.min(Math.abs(delta),rate*dt));
 let nextAt=route.at+v.speed*dt;route.wait=v.speed<.15?route.wait+dt:0;
 if(nextAt>=e.length){const options=e.next;if(!options.length){v.speed=0;v.state='parked';return;}const turn=sim.rng.weighted(options.map(i=>{const q=n.edges[i],dot=e.dx*q.dx+e.dy*q.dy;return dot>.9?6:dot>-.1?2:.15;}));const old=e;route.edge=options[turn];e=n.edges[route.edge];nextAt=Math.min(e.length,nextAt-old.length);}
 const p=position(e,nextAt);if(sim.world.walkable(p.x,p.y)){v.x=p.x;v.y=p.y;route.at=nextAt;}else{v.speed=0;route.wait+=dt;}
 const heading=Math.atan2(e.dy,e.dx),angle=Math.atan2(Math.sin(heading-v.heading),Math.cos(heading-v.heading));v.heading+=angle*Math.min(1,dt*5*utility.turnResponse);v.dir=((Math.round(heading/(Math.PI/2))%4)+4)%4;v.yaw=angle*Math.min(5,1/Math.max(.001,dt));v.wheelTravel=(v.wheelTravel??0)+v.speed*dt;
 stepUtility(v,(v.speed-oldSpeed)/dt,v.yaw*v.speed,v.speed,delta<-.3,dt);
 if(route.wait>25&&Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)>75){n.routes.delete(v);v.state='parked';v.speed=0;}
}
/** Only nearby chassis pairs reach SAT, with stable pair order and no duplicate hash inserts. */
export function* nearbyVehiclePairs(vehicles:readonly Vehicle[]):Generator<[number,number]>{
 const cell=10,buckets=new Map<string,number[]>();let radius=1;vehicles.forEach((v,i)=>{const k=Math.floor(v.x/cell)+','+Math.floor(v.y/cell),a=buckets.get(k)??[];a.push(i);buckets.set(k,a);radius=Math.max(radius,vehicleGeometry(v).length*1.2);});const reach=Math.ceil(radius/cell);
 for(let i=0;i<vehicles.length;i++){const v=vehicles[i],x=Math.floor(v.x/cell),y=Math.floor(v.y/cell),matches:number[]=[];for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++)for(const j of buckets.get((x+dx)+','+(y+dy))??[])if(j>i)matches.push(j);matches.sort((a,b)=>a-b);for(const j of matches)yield[i,j];}
}
export function mappedRouteCount(sim:Simulation):number{return network(sim).edges.length;}
