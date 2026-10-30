import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {VEHICLES,type VehicleClass} from '../content/vehicles';
import type {CitySegment} from '../world/MappedWorld';
import {vehicleGeometry,chassisContact,sweptChassisContact} from './VehicleGeometry';
import {followingSpeed} from './VehicleHandling';
import {waterDepth} from './WaterPhysics';
import {T} from '../world/World';
import {utilityDynamics,stepUtility} from './VehicleUtility';
import {impairment,useSubstance} from './Substances';
import {busDestination,serviceBus} from './BusService';
interface Edge{segment:CitySegment;sign:number;from:string;to:string;x:number;y:number;dx:number;dy:number;length:number;offset:number;next:number[];junction:boolean}
interface Route{edge:number;at:number;wait:number;next?:number;laneFrom?:number;laneBlend?:number}
interface Network{revision:number;edges:Edge[];routes:WeakMap<Vehicle,Route>;buckets:Map<string,Vehicle[]>;tick:number;edgeCells:Map<string,number[]>;junctions:Map<string,{car:Vehicle;until:number;entry:number;exit:number}>}
const networks=new WeakMap<Simulation,Network>();
const crossingPeople:number[]=[];
const nearbyObstacles:Vehicle[]=[];
const probes=new WeakMap<Vehicle,Vehicle>();
const key=(x:number,y:number)=>x.toFixed(1)+','+y.toFixed(1);
function network(sim:Simulation):Network{
 let n=networks.get(sim);const revision=sim.world.mapped?.streetSegments.length??0;if(n?.revision===revision)return n;const edges:Edge[]=[],nodes=new Map<string,number[]>();
 for(const s of sim.world.mapped?.streetSegments??[]){if(s.length<.25)continue;for(const lane of s.lanes??(s.oneway?[{sign:s.oneway,offset:-s.oneway*s.half}]:[{sign:1,offset:-Math.min(1.9,s.half)},{sign:-1,offset:Math.min(1.9,s.half)}])){const sign=lane.sign;const x=sign===1?s.x:s.x+s.dx*s.length,y=sign===1?s.y:s.y+s.dy*s.length,dx=s.dx*sign,dy=s.dy*sign,from=key(x,y),to=key(x+dx*s.length,y+dy*s.length),offset=-lane.offset*sign/2;const edge:Edge={segment:s,sign,from,to,x,y,dx,dy,length:s.length,offset,next:[],junction:false};const list=nodes.get(from)??[];list.push(edges.length);nodes.set(from,list);edges.push(edge);}}
 for(const e of edges){const out=nodes.get(e.to)??[];e.next=out.filter(i=>edges[i].to!==e.from);if(!e.next.length)e.next=out;e.junction=e.next.some(i=>edges[i].to!==edges[e.next[0]].to);}
 const edgeCells=new Map<string,number[]>();for(let i=0;i<edges.length;i++){const e=edges[i],ex=e.x+e.dx*e.length,ey=e.y+e.dy*e.length;for(let y=Math.floor((Math.min(e.y,ey)-3)/64);y<=Math.floor((Math.max(e.y,ey)+3)/64);y++)for(let x=Math.floor((Math.min(e.x,ex)-3)/64);x<=Math.floor((Math.max(e.x,ex)+3)/64);x++){const k=x+','+y,a=edgeCells.get(k)??[];a.push(i);edgeCells.set(k,a);}}
 n={revision,edges,edgeCells,routes:n?.routes??new WeakMap(),buckets:new Map(),tick:-1,junctions:new Map()};networks.set(sim,n);return n;
}
function localEdges(n:Network,x:number,y:number,r:number):number[]{const out=new Set<number>();for(let cy=Math.floor((y-r)/64);cy<=Math.floor((y+r)/64);cy++)for(let cx=Math.floor((x-r)/64);cx<=Math.floor((x+r)/64);cx++)for(const i of n.edgeCells.get(cx+','+cy)??[])out.add(i);return [...out];}
/** Stagger cheap far-away updates so stopped boundary cars cannot back queues into the active area. */
export function advanceDistantTraffic(sim:Simulation):void{
 if(!sim.world.mapped)return;const n=network(sim);buckets(sim,n);
 for(const v of sim.vehicles){if(v.id%60!==sim.tick%60||v.state!=='drive'||v.owner>=0||v.rescueTarget!==undefined||v.fireTarget!==undefined||Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)<=sim.trafficRadius)continue;const far=Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)>sim.trafficRadius+70;if(far&&Math.floor(sim.tick/60)%5!==Math.floor(v.id/60)%5)continue;let r=n.routes.get(v);if(!r){if(!snapMappedVehicle(sim,v))continue;r=n.routes.get(v)!;}if(r.wait>=25&&recoverDistant(sim,n,v,r))continue;let e=n.edges[r.edge];if(!e)continue;const seconds=far?5:1;let edge=r.edge,at=r.at+mappedCruiseSpeed(v.cls,e.segment.speed,sim.world.mapped?.trafficMode)*(far?5:1);
  for(let i=0;at>e.length&&i<32;i++){const options=e.next.filter(i=>!sim.world.mapped?.closedRoads?.has(n.edges[i].segment.id));if(!options.length){at=e.length;break;}at-=e.length;edge=options.reduce((best,i)=>e.dx*n.edges[i].dx+e.dy*n.edges[i].dy>e.dx*n.edges[best].dx+e.dy*n.edges[best].dy?i:best,options[0]);e=n.edges[edge];}
  const p=position(e,Math.min(at,e.length));if(!sim.world.drivable(p.x,p.y)||sim.world.mapped.closedRoads?.has(e.segment.id)){r.wait+=seconds;continue;}const g=vehicleGeometry(v),near:Vehicle[]=[];for(let y=Math.floor(p.y/8)-1;y<=Math.floor(p.y/8)+1;y++)for(let x=Math.floor(p.x/8)-1;x<=Math.floor(p.x/8)+1;x++)for(const o of n.buckets.get(x+','+y)??[])if(o!==v)near.push(o);const candidate={...v,x:p.x,y:p.y,heading:Math.atan2(e.dy,e.dx)};if(near.some(o=>{if(chassisContact(candidate,o))return true;const dx=o.x-p.x,dy=o.y-p.y,other=vehicleGeometry(o);return Math.abs(dx*e.dx+dy*e.dy)<(g.length+other.length)/2+1&&Math.abs(-dx*e.dy+dy*e.dx)<(g.width+other.width)/2+.15;})){r.wait+=seconds;continue;}
  const oldKey=Math.floor(v.x/8)+','+Math.floor(v.y/8),old=n.buckets.get(oldKey),idx=old?.indexOf(v)??-1;if(idx>=0)old!.splice(idx,1);const progress=Math.hypot(v.x-p.x,v.y-p.y);v.x=v.px=p.x;v.y=v.py=p.y;v.heading=Math.atan2(e.dy,e.dx);r.edge=edge;r.at=Math.min(at,e.length);r.next=undefined;r.wait=progress<.1?r.wait+seconds:0;const k=Math.floor(v.x/8)+','+Math.floor(v.y/8),list=n.buckets.get(k)??[];list.push(v);n.buckets.set(k,list);if(v.driver>=0){const c=sim.chars[v.driver];c.x=c.px=v.x;c.y=c.py=v.y;}
 }
}

/** Only recycle ordinary background traffic beyond the buffered camera bubble. */
function recoverDistant(sim:Simulation,n:Network,v:Vehicle,r:Route,nearby=false):boolean{
 if(v.owner>=0||v.driver===sim.playerId||v.siren||v.rescueTarget!==undefined||!nearby&&Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)<=sim.trafficRadius+12)return false;
 const local=nearby?localEdges(n,sim.focus.x,sim.focus.y,75):[];
 for(let attempt=0;attempt<64;attempt++){const edge=local.length?local[sim.rng.int(0,local.length-1)]:sim.rng.int(0,n.edges.length-1),e=n.edges[edge];if(e.length<12||!e.next.length||sim.world.mapped?.closedRoads?.has(e.segment.id))continue;const at=sim.rng.range(4,e.length-4),p=position(e,at);if((nearby?(Math.hypot(p.x-sim.focus.x,p.y-sim.focus.y)<45||Math.hypot(p.x-sim.focus.x,p.y-sim.focus.y)>75):Math.hypot(p.x-sim.focus.x,p.y-sim.focus.y)<=sim.trafficRadius+18)||!sim.world.drivable(p.x,p.y)||sim.vehicles.some(o=>o!==v&&Math.hypot(o.x-p.x,o.y-p.y)<7))continue;
  const oldKey=Math.floor(v.x/8)+','+Math.floor(v.y/8),old=n.buckets.get(oldKey),index=old?.indexOf(v)??-1;if(index>=0)old!.splice(index,1);v.x=v.px=p.x;v.y=v.py=p.y;v.heading=Math.atan2(e.dy,e.dx);v.speed=0;r.edge=edge;r.at=at;r.next=undefined;r.wait=0;const newKey=Math.floor(v.x/8)+','+Math.floor(v.y/8),list=n.buckets.get(newKey)??[];list.push(v);n.buckets.set(newKey,list);if(v.driver>=0){const c=sim.chars[v.driver];c.x=c.px=p.x;c.y=c.py=p.y;}return true;
 }return false;
}
function position(e:Edge,at:number){return{x:e.x+e.dx*at+e.dy*e.offset,y:e.y+e.dy*at-e.dx*e.offset};}
/** Keep the existing pool busy around newly visited streets, without adding entities or teleporting visible cars. */
export function refreshCityPopulation(sim:Simulation):void{
 const m=sim.world.mapped;if(!m)return;const n=network(sim),p=sim.player;
 const local=localEdges(n,p.x,p.y,70).map(i=>({e:n.edges[i],i})).filter(({e})=>e.length>10&&Math.hypot(e.x+e.dx*Math.max(0,Math.min(e.length,(p.x-e.x)*e.dx+(p.y-e.y)*e.dy))-p.x,e.y+e.dy*Math.max(0,Math.min(e.length,(p.x-e.x)*e.dx+(p.y-e.y)*e.dy))-p.y)<65&&!m.closedRoads?.has(e.segment.id));
 if(!local.length)return;
 // Older saves may not contain a service bus; convert only clear, ordinary background traffic.
 let buses=sim.vehicles.filter(v=>v.state==='drive'&&(v.cls==='bus'||VEHICLES[v.cls].design?.base==='bus')).length;
 for(const v of sim.vehicles){if(buses>=2)break;if(v.state!=='drive'||v.owner>=0||v.driver<0||v.siren||Math.hypot(v.x-p.x,v.y-p.y)<40||sim.vehicles.some(o=>o!==v&&Math.hypot(o.x-v.x,o.y-v.y)<5))continue;v.cls='bus';buses++;}
 const mode=m.trafficMode??'city',capacity=Math.max(20,Math.floor(local.reduce((sum,{e})=>sum+e.length,0)/9)),target=Math.min(capacity,mode==='rush'?135:mode==='cruise'?55:95),localCount=sim.vehicles.filter(v=>v.state==='drive'&&Math.hypot(v.x-p.x,v.y-p.y)<80).length,budget=Math.min(10,Math.max(0,target-localCount));
 let moved=0;
 for(const v of sim.vehicles){if(moved>=budget)break;if(v.owner>=0||v.state!=='drive'||v.siren||v.rescueTarget!==undefined||v.cls==='police'||Math.hypot(v.x-p.x,v.y-p.y)<110)continue;
  for(let attempt=0;attempt<6;attempt++){const {e,i}=sim.rng.pick(local),at=sim.rng.range(4,e.length-4),q=position(e,at),distance=Math.hypot(q.x-p.x,q.y-p.y);
   if(distance<32||distance>70||!sim.world.drivable(q.x,q.y)||sim.vehicles.some(o=>Math.hypot(o.x-q.x,o.y-q.y)<7)||sim.chars.some(c=>c.inCar<0&&Math.hypot(c.x-q.x,c.y-q.y)<3))continue;
   v.x=v.px=q.x;v.y=v.py=q.y;v.heading=Math.atan2(e.dy,e.dx);v.speed=0;n.routes.set(v,{edge:i,at,wait:0});n.tick=-1;if(v.driver>=0){const c=sim.chars[v.driver];c.x=c.px=q.x;c.y=c.py=q.y;}moved++;break;
  }
 }
 let people=0;for(const c of sim.chars){if(people>=6)break;if(c.tier!=='background'||c.promoted||c.inCar>=0||c.inside>=0||c.talkWith>=0||Math.hypot(c.x-p.x,c.y-p.y)<110)continue;const {e}=sim.rng.pick(local),at=sim.rng.range(3,e.length-3),off=e.segment.half+1,q={x:e.x+e.dx*at+e.dy*off,y:e.y+e.dy*at-e.dx*off};if(Math.hypot(q.x-p.x,q.y-p.y)<32||!sim.world.walkable(q.x,q.y)||sim.world.carriageway(q.x,q.y))continue;c.x=c.px=q.x;c.y=c.py=q.y;c.path=null;c.goal=null;c.vx=c.vy=0;people++;}
}
export function snapMappedVehicle(sim:Simulation,v:Vehicle):boolean{
 const n=network(sim);let route:Route|undefined,best=4;
 for(const i of localEdges(n,v.x,v.y,5)){const e=n.edges[i];const along=Math.max(0,Math.min(e.length,(v.x-e.x)*e.dx+(v.y-e.y)*e.dy)),p=position(e,along),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(e.dy,e.dx)-v.heading),Math.cos(Math.atan2(e.dy,e.dx)-v.heading))),d=Math.hypot(v.x-p.x,v.y-p.y)+angle*.45;if(d<best){best=d;route={edge:i,at:along,wait:0};}}
 if(!route)return false;n.routes.set(v,route);return true;
}
type Factory=(sim:Simulation,cls:VehicleClass,x:number,y:number,dir:number,state:Vehicle['state'])=>Vehicle;
export function spawnMappedVehicles(sim:Simulation,make:Factory):void{
 const n=network(sim),drivers=sim.chars.filter(c=>c.tier==='background'&&c.inCar<0).slice(0,Math.floor(sim.chars.filter(c=>c.tier==='background').length/3)),pool=Object.values(VEHICLES).filter(d=>d.traffic>0),bag=pool.filter(d=>d.design).map(d=>d.cls),rng=sim.rng;
 const model=()=>{if(!bag.length)bag.push(...pool.map(d=>d.cls));return bag.splice(rng.int(0,bag.length-1),1)[0];};
 const candidates=n.edges.map((e,i)=>({e,i})).filter(({e})=>e.length>5&&e.x>10&&e.y>10&&e.x<sim.world.size-10&&e.y<sim.world.size-10);
 const near=candidates.filter(({e})=>Math.hypot(e.x-sim.player.x,e.y-sim.player.y)<110),moving=Math.min(850,Math.max(100,sim.cfg.trafficCars));
 const firstNew=sim.vehicles.length;
 for(let i=sim.vehicles.filter(v=>v.state==='drive').length,attempt=0;i<moving&&attempt<moving*25;attempt++){const list=i<Math.min(120,moving*.2)&&near.length&&attempt<moving*10?near:candidates;if(!list.length)break;const {e,i:edge}=rng.pick(list),at=rng.range(3,e.length-3),p=position(e,at);if(!sim.world.drivable(p.x,p.y)||sim.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<5)||sim.chars.some(c=>c.inCar<0&&c.inside<0&&Math.hypot(c.x-p.x,c.y-p.y)<3))continue;const v=make(sim,i%50===0?'bus':model(),p.x,p.y,0,'drive');v.heading=Math.atan2(e.dy,e.dx);v.dir=((Math.round(v.heading/(Math.PI/2))%4)+4)%4;v.speed=Math.min(5,e.segment.speed*.7);n.routes.set(v,{edge,at,wait:0});const c=drivers.pop();if(c){v.driver=c.id;c.inCar=v.id;c.x=c.px=p.x;c.y=c.py=p.y;if(rng.int(0,199)===0)useSubstance(sim,c,'alcohol');}i++;}
 // Kerb parking follows the same road geometry. Keep junctions, entrances and river banks clear.
 let parked=sim.vehicles.filter(v=>v.state==='parked').length;for(const {e}of [...candidates].sort((a,b)=>Math.hypot(a.e.x-sim.player.x,a.e.y-sim.player.y)-Math.hypot(b.e.x-sim.player.x,b.e.y-sim.player.y))){if(parked>=240)break;if(e.sign<0||e.length<9||['primary','trunk','motorway','service'].includes(e.segment.kind))continue;for(let at=5;at<e.length-4&&parked<240;at+=5.5){const off=e.segment.half+.75,x=e.x+e.dx*at+e.dy*off,y=e.y+e.dy*at-e.dx*off;if(!sim.world.walkable(x,y)||sim.world.carriageway(x,y)||sim.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<3.2)||sim.world.pois.some(p=>p.kind==='door'&&Math.hypot(p.x-x,p.y-y)<2.2))continue;make(sim,model(),x,y,0,'parked').heading=Math.atan2(e.dy,e.dx);parked++;}}
 // Police patrols and a nearby unowned car remain available to the full game systems.
 if(!sim.vehicles.slice(0,firstNew).some(v=>v.cls==='police')){const cops=sim.chars.filter(c=>c.role==='cop'&&c.inCar<0);for(let i=0;i<Math.min(2,cops.length);i++){const v=sim.vehicles[firstNew+i];if(!v||v.state!=='drive')continue;v.cls='police';v.siren=false;if(v.driver>=0)sim.chars[v.driver].inCar=-1;v.driver=cops[i].id;cops[i].inCar=v.id;}}
}
/** Local broad phase shared by following, yielding and chassis clearance checks. */
function buckets(sim:Simulation,n:Network):void{if(n.tick===sim.tick)return;n.tick=sim.tick;if(n.buckets.size>2048)n.buckets.clear();else for(const a of n.buckets.values())a.length=0;for(const v of sim.vehicles){const k=Math.floor(v.x/8)+','+Math.floor(v.y/8),a=n.buckets.get(k)??[];a.push(v);n.buckets.set(k,a);}}
/** Follow the suspect through the mapped street graph while retaining junction clearance. */
function chooseNext(sim:Simulation,n:Network,e:Edge,options:number[],v:Vehicle):number{
 const cop=v.siren&&v.driver>=0?sim.chars[v.driver]:undefined;
 const suspect=(cop&&cop.pursuing>=0?sim.chars[cop.pursuing]:undefined)??(v.fireTarget!==undefined?sim.vehicles[v.fireTarget]:undefined)??busDestination(sim,v);
 if(suspect){
  const score=(i:number)=>{const q=n.edges[i],x=q.x+q.dx*q.length,y=q.y+q.dy*q.length;
   const direct=Math.hypot(x-suspect.x,y-suspect.y);
   const look=q.next.filter(j=>!sim.world.mapped?.closedRoads?.has(n.edges[j].segment.id));
   return Math.min(direct,...look.map(j=>{const z=n.edges[j];return Math.hypot(z.x+z.dx*z.length-suspect.x,z.y+z.dy*z.length-suspect.y)+z.length*.15;}));};
  return options.reduce((best,i)=>score(i)<score(best)?i:best,options[0]);
 }
 return options[sim.rng.weighted(options.map(i=>{const q=n.edges[i],dot=e.dx*q.dx+e.dy*q.dy;return dot>.9?6/(1+Math.abs(e.offset-q.offset)*4):dot>-.1?2:.15;}))];
}
function eForBusRefresh(route:Route,n:Network):boolean{const edge=n.edges[route.edge];return !!edge&&edge.length-route.at>8;}
export function driveMappedVehicle(sim:Simulation,v:Vehicle,dt:number):void{
 const n=network(sim);let route=n.routes.get(v);if(!route){if(!snapMappedVehicle(sim,v)){v.speed=0;v.state='parked';return;}route=n.routes.get(v)!;}
 buckets(sim,n);if(serviceBus(sim,v))return;if((busDestination(sim,v)||v.fireTarget!==undefined)&&eForBusRefresh(route,n))route.next=undefined;if((route.wait>10||route.wait>5&&Math.hypot(v.x-sim.focus.x,v.y-sim.focus.y)>35)&&recoverDistant(sim,n,v,route,true))return;let e=n.edges[route.edge];if(!e){v.state='parked';return;}const d=VEHICLES[v.cls],utility=utilityDynamics(v),geometry=vehicleGeometry(v),oldSpeed=v.speed;let target=mappedCruiseSpeed(v.cls,e.segment.speed,sim.world.mapped?.trafficMode);
 const driver=v.driver>=0?sim.chars[v.driver]:undefined,impaired=driver?impairment(driver):0;if(v.siren&&driver?.pursuing!==undefined&&driver.pursuing>=0){target=Math.min(d.topSpeed,e.segment.speed*1.25);if(e.length-route.at>8)route.next=undefined;}else if(impaired>.1)target=Math.min(d.topSpeed,target*(1+impaired*.35));
 const mode=sim.world.mapped?.trafficMode??'city',headway=(mode==='cruise'?1.8:mode==='rush'?1.15:1.45)*(1-impaired*.4);
 const cx=Math.floor(v.x/8),cy=Math.floor(v.y/8),obstacles=nearbyObstacles;obstacles.length=0;for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)for(const o of n.buckets.get(x+','+y)??[]){if(o===v)continue;obstacles.push(o);const dx=o.x-v.x,dy=o.y-v.y,along=dx*e.dx+dy*e.dy,cross=Math.abs(-dx*e.dy+dy*e.dx),gap=along-(geometry.length+vehicleGeometry(o).length)/2;if((o.state==='parked'||Math.cos(o.heading)*e.dx+Math.sin(o.heading)*e.dy>.25)&&along>0&&along<15&&cross<(geometry.width+vehicleGeometry(o).width)/2+.25)target=Math.min(target,followingSpeed(Math.max(0,gap-1),Math.max(0,o.speed),d.brake,headway));}
 // Only pass on a second lane travelling in the same direction, with space ahead and behind.
 if(target<v.speed*.75&&route.laneBlend===undefined&&route.at>5&&e.length-route.at>12){
  const alt=n.edges.findIndex(q=>q.segment===e.segment&&q.sign===e.sign&&q!==e&&Math.abs(q.offset-e.offset)>geometry.width*.8);
  if(alt>=0){const lane=n.edges[alt],p=position(lane,route.at),safe=obstacles.every(o=>{const dx=o.x-p.x,dy=o.y-p.y,along=dx*e.dx+dy*e.dy,cross=Math.abs(-dx*e.dy+dy*e.dx);return cross>(geometry.width+vehicleGeometry(o).width)/2+.5||along>geometry.length+8||along< -geometry.length-10;});
   if(safe){route.laneFrom=e.offset;route.laneBlend=0;route.edge=alt;route.next=undefined;e=lane;}}
 }
 if(sim.world.mapped?.closedRoads?.has(e.segment.id))target=0;
 {const lookahead=Math.max(5,v.speed*v.speed/(2*d.brake)+geometry.length+2),count=sim.charHash.query(v.x+e.dx*lookahead/2,v.y+e.dy*lookahead/2,lookahead/2+2,crossingPeople);for(let i=0;i<count;i++){const c=sim.chars[crossingPeople[i]];if(c.inCar>=0||c.inside>=0||!sim.world.drivable(c.x,c.y))continue;const along=(c.x-v.x)*e.dx+(c.y-v.y)*e.dy,cross=Math.abs(-(c.x-v.x)*e.dy+(c.y-v.y)*e.dx);if(along>0&&cross<geometry.width/2+.8)target=Math.min(target,Math.sqrt(Math.max(0,2*d.brake*(along-geometry.length/2-1.2))));}}
 // Plan before the junction so turning traffic brakes instead of charging into a blocked swept turn.
 if(route.next===undefined&&e.next.length){const options=e.next.filter(i=>!sim.world.mapped?.closedRoads?.has(n.edges[i].segment.id));if(options.length)route.next=chooseNext(sim,n,e,options,v);}
 if(route.next!==undefined){const next=n.edges[route.next],dot=e.dx*next.dx+e.dy*next.dy;if(dot<.9){const corner=dot<-.5?1.5:3.4;target=Math.min(target,Math.sqrt(corner*corner+2*d.brake*Math.max(0,e.length-route.at-geometry.length)));}}
 // Give way to crossing pedestrians and vehicles already entering this actual mapped junction.
 if(e.length-route.at<6&&e.junction){const cycle=(sim.tick/60)%16,ns=Math.abs(e.dy)>Math.abs(e.dx),green=ns?cycle<7:cycle>=8&&cycle<15;if(!green&&!v.siren)target=Math.min(target,Math.sqrt(Math.max(0,2*d.brake*(e.length-route.at-geometry.length/2-.6))));}
 const delta=target-v.speed,rate=delta>0?d.accel*.8*utility.acceleration:d.brake*utility.braking;v.speed=Math.max(0,v.speed+Math.sign(delta)*Math.min(Math.abs(delta),rate*dt));
 let nextAt=route.at+v.speed*dt,nextEdge=route.edge;let lease:{key:string;entry:number;exit:number}|null=null;route.wait=v.speed<.15?route.wait+dt:0;
 if(nextAt>=e.length){const options=e.next.filter(i=>!sim.world.mapped?.closedRoads?.has(n.edges[i].segment.id));if(!options.length){v.speed=0;return;}if(route.next===undefined||!options.includes(route.next))route.next=chooseNext(sim,n,e,options,v);const turn=options.indexOf(route.next);const old=e,reservation=n.junctions.get(e.to);
  const straight=(a:Edge,b:Edge)=>a.dx*b.dx+a.dy*b.dy>.9,previous=reservation?n.edges[reservation.entry]:null,previousExit=reservation?n.edges[reservation.exit]:null,compatible=previous&&previousExit&&straight(old,n.edges[options[turn]])&&straight(previous,previousExit)&&Math.abs(old.dx*previous.dy-old.dy*previous.dx)<.1;
  if(reservation&&!compatible&&reservation.car!==v&&reservation.until>sim.tick&&Math.hypot(reservation.car.x-(e.x+e.dx*e.length),reservation.car.y-(e.y+e.dy*e.length))<7){v.speed=0;return;}
  nextEdge=options[turn];e=n.edges[nextEdge];nextAt=Math.min(e.length,nextAt-old.length);
  // Never enter a junction without enough receiving-lane space for the full chassis.
  const exit=position(e,Math.min(e.length,geometry.length+1));
  if(obstacles.some(o=>{const dx=o.x-exit.x,dy=o.y-exit.y,g=vehicleGeometry(o);return Math.abs(dx*e.dx+dy*e.dy)<(geometry.length+g.length)/2+.8&&Math.abs(-dx*e.dy+dy*e.dx)<(geometry.width+g.width)/2+.15&&(o.state==='parked'||Math.cos(o.heading)*e.dx+Math.sin(o.heading)*e.dy>.25);})){v.speed=0;if(route.wait>6){const alternative=options.find(i=>i!==nextEdge&&!obstacles.some(o=>{const q=n.edges[i],exit=position(q,Math.min(q.length,geometry.length+1));return Math.hypot(o.x-exit.x,o.y-exit.y)<geometry.length+2;}));if(alternative!==undefined){route.next=alternative;route.wait=0;}}return;}
  lease={key:old.to,entry:route.edge,exit:nextEdge};
 }
 const heading=Math.atan2(e.dy,e.dx),angle=Math.atan2(Math.sin(heading-v.heading),Math.cos(heading-v.heading)),nextHeading=v.heading+angle*Math.min(1,dt*5*utility.turnResponse);
 const p=position(e,nextAt);
 if(route.laneBlend!==undefined&&route.laneFrom!==undefined){route.laneBlend=Math.min(1,route.laneBlend+dt*.5);const off=(route.laneFrom-e.offset)*(1-route.laneBlend);p.x+=e.dy*off;p.y-=e.dx*off;if(route.laneBlend>=1){route.laneBlend=undefined;route.laneFrom=undefined;}}
 let candidate=probes.get(v);if(!candidate){candidate={...v};probes.set(v,candidate);}candidate.cls=v.cls;candidate.plate=v.plate;candidate.lifeMods=v.lifeMods;candidate.x=p.x;candidate.y=p.y;candidate.px=v.x;candidate.py=v.y;candidate.heading=nextHeading;
 // Reject an occupied or swept chassis position before committing the route, including opposite lanes and turns.
 const occupied=obstacles.some(o=>chassisContact(candidate!,o)||sweptChassisContact(candidate!,o,true))||crossingPeople.some(id=>{const c=sim.chars[id];if(c.inCar>=0||c.inside>=0||!sim.world.drivable(c.x,c.y))return false;const dx=c.x-p.x,dy=c.y-p.y,cos=Math.cos(nextHeading),sin=Math.sin(nextHeading);return Math.abs(dx*cos+dy*sin)<geometry.length/2+c.radius+.4&&Math.abs(-dx*sin+dy*cos)<geometry.width/2+c.radius+.4;});
 if(!occupied&&(sim.world.walkable(p.x,p.y)||(sim.world.tile(Math.floor(p.x),Math.floor(p.y))===T.WATER&&waterDepth(sim.world,p.x,p.y)===0))){if(lease){n.junctions.set(lease.key,{car:v,until:sim.tick+Math.max(90,Math.min(240,(geometry.length+3)/Math.max(2,v.speed)*60)),entry:lease.entry,exit:lease.exit});route.next=undefined;}v.x=p.x;v.y=p.y;route.at=nextAt;route.edge=nextEdge;v.heading=nextHeading;
  const cell=Math.floor(v.x/8)+','+Math.floor(v.y/8),before=cx+','+cy;if(cell!==before){const list=n.buckets.get(before),i=list?.indexOf(v)??-1;if(i>=0)list!.splice(i,1);const next=n.buckets.get(cell)??[];next.push(v);n.buckets.set(cell,next);}
 }else{v.speed=0;route.wait+=dt;if(lease&&route.wait>8){const alternative=n.edges[route.edge].next.find(i=>i!==nextEdge&&!sim.world.mapped?.closedRoads?.has(n.edges[i].segment.id));if(alternative!==undefined){route.next=alternative;route.wait=0;}}}
 v.dir=((Math.round(v.heading/(Math.PI/2))%4)+4)%4;v.yaw=v.speed>0?angle*Math.min(5,1/Math.max(.001,dt)):0;v.wheelTravel=(v.wheelTravel??0)+v.speed*dt;
 stepUtility(v,(v.speed-oldSpeed)/dt,v.yaw*v.speed,v.speed,delta<-.3,dt);
}
/** Only nearby chassis pairs reach SAT, with stable pair order and no duplicate hash inserts. */
export function* nearbyVehiclePairs(vehicles:readonly Vehicle[]):Generator<[number,number]>{
 const cell=10,buckets=new Map<string,number[]>();let radius=1;vehicles.forEach((v,i)=>{const k=Math.floor(v.x/cell)+','+Math.floor(v.y/cell),a=buckets.get(k)??[];a.push(i);buckets.set(k,a);radius=Math.max(radius,vehicleGeometry(v).length*1.2);});const reach=Math.ceil(radius/cell);
 for(let i=0;i<vehicles.length;i++){const v=vehicles[i],x=Math.floor(v.x/cell),y=Math.floor(v.y/cell),matches:number[]=[];for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++)for(const j of buckets.get((x+dx)+','+(y+dy))??[])if(j>i)matches.push(j);matches.sort((a,b)=>a-b);for(const j of matches)yield[i,j];}
}
export function mappedRouteCount(sim:Simulation):number{return network(sim).edges.length;}

/** Ambient drivers use posted speeds without stacking a second city-wide crawl multiplier. */
export function mappedCruiseSpeed(cls:VehicleClass,posted:number,mode='city'):number{return Math.min(posted,VEHICLES[cls].topSpeed*.9)*(mode==='cruise'?.85:.95);}

const drivingLimits=new WeakMap<Vehicle,{tick:number;x:number;y:number;limit:number}>();
/** Local road lookup cached for half a second; unrelated roads cannot grant motorway speed. */
export function mappedDrivingLimit(sim:Simulation,v:Vehicle):number {
 if(!sim.world.mapped)return Infinity;const old=drivingLimits.get(v);if(old&&sim.tick>=old.tick&&sim.tick-old.tick<30&&Math.hypot(v.x-old.x,v.y-old.y)<3)return old.limit;
 const n=network(sim);let best=Infinity,limit=30/7.2;
 for(const i of localEdges(n,v.x,v.y,8)){const s=n.edges[i].segment,at=Math.max(0,Math.min(s.length,(v.x-s.x)*s.dx+(v.y-s.y)*s.dy)),distance=Math.hypot(v.x-s.x-s.dx*at,v.y-s.y-s.dy*at);if(distance<=s.half+.5&&distance<best){best=distance;limit=s.speed;}}
 drivingLimits.set(v,{tick:sim.tick,x:v.x,y:v.y,limit});return limit;
}
