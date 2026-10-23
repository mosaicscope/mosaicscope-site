import type { Vehicle } from "../entities/types";
import {vehicleGeometry} from './VehicleGeometry';
import type {CrushDent} from '../render/VehicleMesh';
export interface WheelDamage { puncture:boolean; rim:number; alignment:number; suspension:number; missing:boolean }
export interface VehicleDebris {kind:'glass'|'wheel'|'metal'|'lamp';x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;spin:number;colour?:string}
export interface VehicleComponents {dents?:CrushDent[];wheels:WheelDamage[];panels:number[];glass:number[];contacts?:{x:number;y:number}[];lamps?:number[];mirrors?:number[];bumpers?:number[];bumperZone?:number;hood:number;bumper:number;hoodLoose:boolean;hoodGone:boolean;bumperLoose:boolean;debris:VehicleDebris[];lastImpact:number}
export function components(v:Vehicle):VehicleComponents{const p:VehicleComponents=v.components??={wheels:Array.from({length:4},(_,i)=>({puncture:(i%2===0?v.flatLeft:v.flatRight)??false,rim:0,alignment:0,suspension:0,missing:false})),panels:[v.dmgF??0,v.dmgR??0,v.dmgL??0,v.dmgS??0],glass:Array(4).fill(v.glassDamage??0),hood:1,bumper:1,hoodLoose:false,hoodGone:false,bumperLoose:false,debris:[],lastImpact:0};p.lamps??=[v.dmgF??0,v.dmgF??0,v.dmgR??0,v.dmgR??0];p.mirrors??=[0,0];p.bumpers??=[p.bumper,p.bumper];return p;}
export function lampDamage(v:Vehicle,index:number):number{return v.components?.lamps?.[index]??(index<2?v.dmgF??0:v.dmgR??0);}
/** Energy and direction choose actual components; a slow scrape never removes a wheel. */
export function impactComponents(v:Vehicle,nx:number,ny:number,speed:number,mass:number,tick:number,contact?:{x:number;y:number}):void{
 const p=components(v),c=Math.cos(v.heading),s=Math.sin(v.heading),along=nx*c+ny*s,side=-nx*s+ny*c;
 const energy=Math.min(1,Math.max(0,speed*speed*mass/150)),zone=Math.abs(along)>=Math.abs(side)?along>0?0:1:side>0?3:2;
 p.contacts??=[{x:.5,y:0},{x:-.5,y:0},{x:0,y:-.5},{x:0,y:.5}];if(contact){const dx=contact.x-v.x,dy=contact.y-v.y,d=vehicleGeometry(v);p.contacts[zone]={x:Math.max(-.5,Math.min(.5,(dx*c+dy*s)/d.length)),y:Math.max(-.5,Math.min(.5,(-dx*s+dy*c)/d.width))};}
 if(energy>.005){const at=p.contacts[zone],len=Math.hypot(along,side)||1,dent={zone,x:at.x,y:at.y,z:.44,nx:along/len,ny:side/len,energy,depth:energy*(zone<2?.2:.3),radius:.24+energy*.15};p.dents??=[];const old=p.dents.find(d=>d.zone===zone&&Math.hypot(d.x-at.x,d.y-at.y)<.18);if(old){old.depth=Math.min(.34,old.depth+dent.depth*.7);old.energy=Math.min(1,old.energy+energy);old.radius=Math.max(old.radius,dent.radius);}else{if(p.dents.length>=8)p.dents.shift();p.dents.push(dent);}}
 if(zone===0&&energy>.2)v.engineRepaired=false;
 p.panels[zone]=Math.min(1,p.panels[zone]+energy);p.glass[zone]=Math.min(1,p.glass[zone]+energy*.95);p.lastImpact=tick;
 const lamp=(along>=0?0:2)+(side>=0?1:0),oldLamp=p.lamps![lamp];p.lamps![lamp]=Math.min(1,p.lamps![lamp]+energy*1.05);if(Math.abs(side)>.35)p.mirrors![side>0?1:0]=Math.min(1,p.mirrors![side>0?1:0]+energy);
 const wheel=(along>=0?0:2)+(side>=0?1:0),w=p.wheels[wheel];w.rim=Math.min(1,w.rim+energy*.8);w.suspension=Math.min(1,w.suspension+energy*.9);w.alignment=Math.max(-.42,Math.min(.42,w.alignment+(side>=0?1:-1)*energy*.2));if(energy>.3)w.puncture=true;
 const toss=(kind:VehicleDebris['kind'],n:number)=>{for(let i=0;i<n&&p.debris.length<24;i++)p.debris.push({kind,x:v.x+nx*.6,y:v.y+ny*.6,z:kind==='glass'?.7:.2,vx:nx*(1+i%3)+Math.cos(i*2.4),vy:ny*(1+i%3)+Math.sin(i*2.4),vz:1.4+i%3*.35,age:0,spin:i*1.7});};
 if(oldLamp<.94&&p.lamps![lamp]>=.94){toss('lamp',1);p.debris[p.debris.length-1].colour=lamp<2?'#c2d0bb':'#b56b5b';}
 if(p.glass[zone]>.45)toss('glass',3+Math.floor(energy*5));
 if(energy>.68&&w.suspension>.82&&!w.missing){w.missing=true;toss('wheel',1);}
 if(zone===0){p.hood=Math.max(0,p.hood-energy*.8);p.hoodLoose=p.hood<.55;}
 if(zone<2){p.bumperZone=zone;p.bumpers![zone]=Math.max(0,p.bumpers![zone]-energy);p.bumper=Math.min(...p.bumpers!);p.bumperLoose=p.bumper<.6;}
 if(p.bumper===0&&!v.bumperLost){v.bumperLost=true;toss('metal',2);}
}
export function damageParts(v: Vehicle): void {
  const f=v.dmgF??0, r=v.dmgR??0, l=v.dmgL??0, s=v.dmgS??0;
  if(!v.engineRepaired)v.engineDamage=Math.max(v.engineDamage??0, f*0.9);
  v.glassDamage=v.components?Math.max(...v.components.glass):Math.max(v.glassDamage??0, Math.max(f,r)*.95);
  if(v.components){const p=v.components;v.flatLeft=p.wheels[0].puncture||p.wheels[2].puncture;v.flatRight=p.wheels[1].puncture||p.wheels[3].puncture;v.bumperLost=p.bumper<=0;v.mirrorLost=p.mirrors?.some(n=>n>.85)??!!v.mirrorLost;}else{if(l>.6)v.flatLeft=true;if(s>.6)v.flatRight=true;v.bumperLost=!!v.bumperLost||Math.max(f,r)>.82;v.mirrorLost=!!v.mirrorLost||Math.max(l,s)>.7;}
  if(!v.engineRepaired)v.leak=Math.max(v.leak??0,Math.max(0,f-0.5));
}
/** Heat rises only while badly damaged engines run; stopping prevents escalation. */
export function damageTick(v: Vehicle, dt: number): void {
  damageParts(v);
  if(v.components){const p=v.components;const air=Math.abs(v.speed)**2;
   if(p.hoodLoose&&!p.hoodGone){p.hood=Math.max(0,p.hood-dt*air*.00018);if(!p.hood){p.hoodGone=true;p.debris.length<24&&p.debris.push({kind:'metal',x:v.x,y:v.y,z:.8,vx:v.vx??0,vy:v.vy??0,vz:2,age:0,spin:0});}}
   p.debris=p.debris.filter(d=>d.age<25);for(const d of p.debris){d.age+=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vz-=9.8*dt;d.spin+=dt*(d.kind==='wheel'?5:2);if(d.z<.03){d.z=.03;d.vz=Math.abs(d.vz)>.5?-d.vz*.23:0;d.vx*=Math.max(0,1-dt*(d.kind==='wheel'?.7:4));d.vy*=Math.max(0,1-dt*(d.kind==='wheel'?.7:4));}}
  }
  if (v.burnt) { v.burntAge = (v.burntAge ?? 0) + dt; return; }
  const running=v.driver>=0 && Math.abs(v.speed)>0.5;
  v.heat=Math.max(0,Math.min(1,(v.heat??0)+(running && (v.engineDamage??0)>0.65 ? dt*0.015 : -dt*0.02)));
  if ((v.heat??0)>=1) v.burning=true;
  if (v.burning) { v.damage=Math.min(1,v.damage+dt*0.025); v.burnTime=(v.burnTime??0)+dt; }
  if ((v.burnTime??0)>12) { v.burnt=true; v.burning=false; v.damage=1; v.speed=0; v.vx=0; v.vy=0; }
}
export function repairVehicle(v: Vehicle): void {
  v.powertrain=undefined;v.driveThrottle=0;v.wheelspin=0;v.wheelSteer=0;v.tyreHeat=0;
  v.components=undefined;v.steerAngle=0;v.engineRepaired=false;
  v.damage=0; v.dmgF=0; v.dmgR=0; v.dmgL=0; v.dmgS=0;
  v.engineDamage=0; v.glassDamage=0; v.flatLeft=false; v.flatRight=false;
  v.bumperLost=false; v.mirrorLost=false; v.leak=0; v.heat=0; v.burning=false; v.burnTime=0; v.burnt=false; v.burntAge=0; v.towAt=undefined;
}
