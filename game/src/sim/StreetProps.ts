import {waterCurrent,waterDepth} from './WaterPhysics';
import {vehicleIndex} from './VehicleIndex';
import type {Vehicle} from '../entities/types';
const propCars:Vehicle[]=[];
import {impactComponents} from './VehicleDamage';
import {vehicleContact} from './VehicleContact';
import {propPhysics} from '../content/propPhysics';
import {vehicleGeometry} from './VehicleGeometry';
import {VEHICLES} from '../content/vehicles';
import {utilityDynamics} from './VehicleUtility';
import type {Simulation} from './Simulation';
import type {Character} from '../entities/types';
import {PROP_KINDS,propDef,type StreetPropKind} from '../content/streetProps';
export interface StreetProp{id:number;kind:StreetPropKind;x:number;y:number;z:number;vx:number;vy:number;vz:number;turn:number;spin:number;health:number;lastHit:number;colour?:string;lastUse?:number;uses?:number;user?:number;until?:number;secured?:boolean;stock?:number}
const prepared=new WeakSet<Simulation>();
/** Migrate old saves and populate reachable footpaths, keeping entrances clear. */
export function prepareStreetProps(sim:Simulation):void{
 if(prepared.has(sim))return;prepared.add(sim);
 const anchors:{x:number;y:number;kind:string}[]=[...sim.world.pois.filter(p=>['bench','bin','busstop','hoop','billboard'].includes(p.kind)),...sim.world.buildings.map(b=>({x:b.door.x,y:b.door.y,kind:b.kind}))];
 if(!anchors.length)anchors.push({x:sim.player.x,y:sim.player.y,kind:'bench'});
 for(const [i,kind]of PROP_KINDS.entries()){
  if(sim.cityPlay.props.some(p=>p.kind===kind))continue;
  for(let attempt=0;attempt<anchors.length;attempt++){
   const a=anchors[(i*13+attempt)%anchors.length],q=sim.world.nearestFoot(a.x+(i%2?.9:-.9),a.y+.65,4);
   if(sim.world.mapped&&(!sim.world.walkable(q.x,q.y)||sim.world.carriageway(q.x,q.y))||sim.world.buildingAt(Math.floor(q.x),Math.floor(q.y))||sim.cityPlay.props.some(p=>Math.hypot(p.x-q.x,p.y-q.y)<.85)||sim.world.buildings.some(b=>Math.hypot(b.door.x-q.x,b.door.y-q.y)<.8))continue;
   sim.cityPlay.props.push({id:sim.cityPlay.props.length,kind,x:q.x,y:q.y,z:0,vx:0,vy:0,vz:0,turn:i*.36,spin:0,health:1,lastHit:-1000,lastUse:-1000,uses:0});break;
  }
 }
}
export function useStreetProp(sim:Simulation,c:Character,p:StreetProp,manual=true):boolean{
 if(c.inCar>=0||c.inside>=0||c.phys!==0||Math.hypot(c.x-p.x,c.y-p.y)>1.35)return false;
 const d=propDef(p.kind);
 if(p.health<.15){if(manual)sim.say(c,'This needs repairing before anyone can use it.','say',2);return true;}
 if(sim.tick-(p.lastUse??-1000)<240){if(manual)sim.say(c,'Give that a moment.','say',1);return true;}
 if(d.cost&&c.cash<d.cost){if(manual)sim.say(c,'I need $'+d.cost+' for that.','say',2);return true;}
 const stocked=['newspaper_box','market_stall','water_cooler'].includes(p.kind);if(stocked&&(p.stock??20)<=0){if(manual)sim.say(c,'Empty. This dispenser needs restocking.','say',2);return true;}if(stocked)p.stock=(p.stock??20)-1;
 if(d.cost)c.cash-=d.cost;p.lastUse=sim.tick;p.uses=(p.uses??0)+1;p.user=c.id;p.until=sim.tick+150;
 c.facing=Math.atan2(p.y-c.y,p.x-c.x);c.anim.pose=d.pose;c.anim.poseT=0;
 if(d.benefit)c.needs[d.benefit]=Math.min(1,c.needs[d.benefit]+.07);
 if(!d.fixed&&!p.secured){const a=Math.atan2(p.y-c.y,p.x-c.x),force=['ball','football','basketball','skateboard'].includes(p.kind)?2.3:.7/d.mass;p.vx=Math.cos(a)*force;p.vy=Math.sin(a)*force;p.vz=p.kind==='basketball'?3.4:p.kind==='ball'||p.kind==='football'?1.8:.15;p.spin=force;}
 if(manual)sim.say(c,d.line,'say',3.5);
 if(p.kind==='public_piano'||p.kind==='busker_amp')sim.bus.emit('fx',{kind:'music',x:p.x,y:p.y,z:.8,n:4,color:d.colour});return true;
}
export function nudgeStreetProp(sim:Simulation):boolean{prepareStreetProps(sim);const c=sim.player,p=sim.cityPlay.props.filter(p=>Math.hypot(p.x-c.x,p.y-c.y)<1.35).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];return p?useStreetProp(sim,c,p):false;}
export function updateStreetProps(sim:Simulation,dt:number):void{
 prepareStreetProps(sim);
 // Add bounded, collision-enabled street furniture near the player's current neighbourhood.
 if(sim.world.mapped&&sim.tick%600===0&&sim.cityPlay.props.length<200){const anchors=sim.world.pois.filter(p=>['bench','bin','busstop','lamp'].includes(p.kind)&&Math.hypot(p.x-sim.player.x,p.y-sim.player.y)<65);let added=0;for(let i=0;i<anchors.length&&added<6&&sim.cityPlay.props.length<200;i+=3){const a=anchors[i],kinds:StreetPropKind[]=['wheelie_bin','planter','sandwich_board','cone','newspaper_box','crate'],kind=kinds[(i+Math.floor(sim.tick/600))%kinds.length],q=sim.world.nearestFoot(a.x+1.2,a.y+.8,4);if(!sim.world.walkable(q.x,q.y)||sim.world.carriageway(q.x,q.y)||sim.world.buildingAt(Math.floor(q.x),Math.floor(q.y))||sim.cityPlay.props.some(p=>Math.hypot(p.x-q.x,p.y-q.y)<2)||sim.world.pois.some(p=>p.kind==='door'&&Math.hypot(p.x-q.x,p.y-q.y)<2))continue;sim.cityPlay.props.push({id:sim.cityPlay.props.length,kind,x:q.x,y:q.y,z:0,vx:0,vy:0,vz:0,turn:i*.4,spin:0,health:1,lastHit:-1000});added++;}}
 if(sim.tick%120===0&&sim.chars.length){const c=sim.chars[Math.floor(sim.tick/120)%sim.chars.length];if(c.tier!=='player'&&c.phys===0&&c.inside<0&&c.inCar<0&&c.talkWith<0&&c.arrestedBy<0&&!['fight','chase','gunfight','flee','treat','arrest'].includes(c.goal?.id??'')){const p=sim.cityPlay.props.find(p=>propDef(p.kind).benefit&&Math.hypot(p.x-c.x,p.y-c.y)<1.3);if(p)useStreetProp(sim,c,p,false);}}
 for(const p of sim.cityPlay.props){const def=propDef(p.kind);
  if((p.until??0)>sim.tick&&p.user!==undefined){const c=sim.chars[p.user];if(c&&c.phys===0&&c.inCar<0&&c.inside<0&&Math.hypot(c.x-p.x,c.y-p.y)<1.6&&Math.hypot(c.vx,c.vy)<.2){c.anim.pose=def.pose;c.facing=Math.atan2(p.y-c.y,p.x-c.x);}else{if(c&&c.anim.pose===def.pose)c.anim.pose='auto';p.user=undefined;p.until=0;}}else if(p.user!==undefined){const c=sim.chars[p.user];if(c&&c.anim.pose===def.pose)c.anim.pose='auto';p.user=undefined;p.until=0;}
  const physical=propPhysics(def.model),fixed=def.fixed||p.secured;
  for(const v of sim.world.mapped?vehicleIndex(sim).query(p.x,p.y,6,propCars):sim.vehicles){const reach=(sim.world.mapped?vehicleGeometry(v).length:VEHICLES[v.cls].length)/2+1;if(Math.abs(v.speed)<1.3||v.state==='parked'||sim.tick-p.lastHit<30||Math.abs(p.x-v.x)>reach+Math.abs(v.x-v.px)||Math.abs(p.y-v.y)>reach+Math.abs(v.y-v.py))continue;const hit=vehicleContact(v,p.x,p.y,physical.radius);if(!hit||hit.speed<.5)continue;p.lastHit=sim.tick;const energy=hit.speed**2*(sim.world.mapped?utilityDynamics(v).mass:VEHICLES[v.cls].mass)*.5,force=Math.min(12,Math.sqrt(energy)*1.3);if(!fixed){p.vx=hit.nx*force/Math.sqrt(def.mass);p.vy=hit.ny*force/Math.sqrt(def.mass);p.vz=force*.16;p.spin=(hit.nx-hit.ny)*force*.5;}p.health=Math.max(0,p.health-energy/physical.strength);if(fixed||def.mass>4){impactComponents(v,hit.nx,hit.ny,hit.speed,Math.min(2,def.mass/10),sim.tick,{x:hit.x,y:hit.y});v.damage=Math.min(1,v.damage+energy*.002);}
   const slow=def.mass<1?.99:fixed?.8:.94;v.speed*=slow;if(sim.world.mapped){if(v.vx!==undefined)v.vx*=slow;if(v.vy!==undefined)v.vy*=slow;}sim.bus.emit('fx',{kind:physical.material==='metal'?'spark':'dust',x:p.x,y:p.y,z:.3,n:Math.min(14,3+Math.ceil(force)),color:physical.material==='timber'?'#bca477':'#b9a886'});}
  if(def.fixed||p.secured)continue;
  if(waterDepth(sim.world,p.x,p.y)>0){const flow=waterCurrent(sim),blend=1-Math.exp(-dt*1.5);p.vx+=(flow.x-p.vx)*blend;p.vy+=(flow.y-p.vy)*blend;}
  const oldX=p.x,oldY=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=9.8*dt;p.turn+=p.spin*dt;
  const round=['ball','football','basketball'].includes(p.kind);if(p.z<0){p.z=0;p.vz=Math.abs(p.vz)>.6?-p.vz*(round?.65:.18):0;}
  const drag=Math.max(0,1-dt*(round||p.kind==='barrel'||p.kind==='skateboard'?.7:3));p.vx*=drag;p.vy*=drag;p.spin*=drag;
  if(!sim.world.inBounds(Math.floor(p.x),Math.floor(p.y))||sim.world.buildingAt(Math.floor(p.x),Math.floor(p.y))){p.x=oldX;p.y=oldY;p.vx*=-.3;p.vy*=-.3;}
 }
}
