import {VEHICLES} from '../content/vehicles';
import {strikeUnderbody,stepUnderbody,type UnderbodyState} from './Underbody';
import {tickEngineComponents,type EngineMounts,type EngineComponentId} from './EngineComponents';
import {strikeLattice,stepLattice,upgradeLattice,type CrashLattice} from './CrashLattice';
import {damageVehicleParts,type PartDamage} from './VehicleParts';
import {stressAttachments,advanceAttachments,type ProgressiveDamage} from './ProgressiveDamage';
import {crushStructure,tickStructure,type VehicleStructure} from './VehicleStructure';
import type { Vehicle } from "../entities/types";
import {vehicleGeometry} from './VehicleGeometry';
import type {CrushDent} from '../render/VehicleMesh';
export interface WheelDamage { puncture:boolean; rim:number; alignment:number; suspension:number; missing:boolean; attachment?:number }
export interface VehicleDebris {kind:'glass'|'wheel'|'metal'|'lamp'|'masonry'|'engine';part?:EngineComponentId;x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;spin:number;colour?:string;size?:number;curl?:number;zone?:number;roll?:number;pitch?:number;spinRate?:number}
export interface VehicleImpact {tick:number;zone:number;deltaV:number;energy:number;x:number;y:number;severity:string}
export interface VehicleComponents {underbody?:UnderbodyState;engineMounts?:EngineMounts;parts?:PartDamage;progressive?:ProgressiveDamage;structure?:VehicleStructure;lattice?:CrashLattice;doorHinges?:number[];doorGone?:boolean[];boot?:number;bootGone?:boolean;blood?:{x:number;y:number;z:number;size:number;age:number}[];impacts?:VehicleImpact[];dents?:CrushDent[];wheels:WheelDamage[];panels:number[];glass:number[];contacts?:{x:number;y:number}[];lamps?:number[];mirrors?:number[];bumpers?:number[];bumperZone?:number;hood:number;bumper:number;hoodLoose:boolean;hoodGone:boolean;bumperLoose:boolean;debris:VehicleDebris[];lastImpact:number}
export function components(v:Vehicle):VehicleComponents{const p:VehicleComponents=v.components??={wheels:Array.from({length:4},(_,i)=>({puncture:(i%2===0?v.flatLeft:v.flatRight)??false,rim:0,alignment:0,suspension:0,missing:false})),panels:[v.dmgF??0,v.dmgR??0,v.dmgL??0,v.dmgS??0],glass:Array(4).fill(v.glassDamage??0),hood:1,bumper:1,hoodLoose:false,hoodGone:false,bumperLoose:false,debris:[],lastImpact:0};p.lamps??=[v.dmgF??0,v.dmgF??0,v.dmgR??0,v.dmgR??0];p.mirrors??=[0,0];p.bumpers??=[p.bumper,p.bumper];return p;}
export function lampDamage(v:Vehicle,index:number):number{return v.components?.lamps?.[index]??(index<2?v.dmgF??0:v.dmgR??0);}
/** Energy and direction choose actual components; a slow scrape never removes a wheel. */
export function impactComponents(v:Vehicle,nx:number,ny:number,speed:number,mass:number,tick:number,contact?:{x:number;y:number}):void{
 if(![nx,ny,speed,mass].every(Number.isFinite)||speed<=0||mass<=0)return;
 const p=components(v),c=Math.cos(v.heading),s=Math.sin(v.heading),along=nx*c+ny*s,side=-nx*s+ny*c;
 const energy=Math.min(1,Math.max(0,speed*speed*mass/150)),zone=Math.abs(along)>=Math.abs(side)?along>0?0:1:side>0?3:2;
 p.contacts??=[{x:.5,y:0},{x:-.5,y:0},{x:0,y:-.5},{x:0,y:.5}];if(contact){const dx=contact.x-v.x,dy=contact.y-v.y,d=vehicleGeometry(v);p.contacts[zone]={x:Math.max(-.5,Math.min(.5,(dx*c+dy*s)/d.length)),y:Math.max(-.5,Math.min(.5,(-dx*s+dy*c)/d.width))};}
 if(energy>.005){const at=p.contacts[zone];p.impacts??=[];const previous=p.impacts[p.impacts.length-1],impact={tick,zone,deltaV:speed,energy,x:at.x,y:at.y,severity:energy>.65?'severe':energy>.25?'heavy':energy>.07?'moderate':'light'};if(previous&&tick-previous.tick<=6&&previous.zone===zone&&Math.hypot(previous.x-at.x,previous.y-at.y)<.15){if(energy>previous.energy)p.impacts[p.impacts.length-1]=impact;}else{if(p.impacts.length>=8)p.impacts.shift();p.impacts.push(impact);}}
 if(energy>.005){const at=p.contacts[zone],len=Math.hypot(along,side)||1,dent={zone,x:at.x,y:at.y,z:.44,nx:along/len,ny:side/len,energy,depth:energy*(zone<2?.28:.34),radius:.24+energy*.24};p.dents??=[];const old=p.dents.find(d=>d.zone===zone&&Math.hypot(d.x-at.x,d.y-at.y)<.18);if(old){old.depth=Math.min(.34,old.depth+dent.depth*.7);old.energy=Math.min(1,old.energy+energy);old.radius=Math.max(old.radius,dent.radius);}else{if(p.dents.length>=12)p.dents.shift();p.dents.push(dent);}}
 if(energy>.08){const at=p.contacts[zone],len=Math.hypot(along,side)||1;p.lattice=strikeLattice(p.lattice,at.x,at.y,along/len,side/len,energy);}
 if(zone>=2&&energy>.25){const sideIndex=zone-2;p.doorHinges??=[1,1];p.doorGone??=[false,false];if(!p.doorGone[sideIndex])p.doorHinges[sideIndex]=Math.max(0,p.doorHinges[sideIndex]-(energy-.25)*.8);}
 if(energy>.08)p.underbody=strikeUnderbody(p.underbody,p.contacts[zone].x,p.contacts[zone].y,energy);
 damageVehicleParts(v,p.contacts[zone].x,p.contacts[zone].y,energy);
 crushStructure(v,zone,energy,p.contacts[zone].x,p.contacts[zone].y);
 if(zone===0&&energy>.2)v.engineRepaired=false;
 const oldGlass=p.glass[zone];
 // Major engine or battery impacts can ignite even without a running engine.
 if(energy>.88&&speed>9&&zone===0&&!v.burnt){v.heat=1;v.burning=true;}
 p.panels[zone]=Math.min(1,p.panels[zone]+energy);p.glass[zone]=Math.min(1,p.glass[zone]+Math.max(0,energy-.12)*.7);p.lastImpact=tick;stressAttachments(p,zone,energy);
 const lamp=(along>=0?0:2)+(side>=0?1:0),oldLamp=p.lamps![lamp];p.lamps![lamp]=Math.min(1,p.lamps![lamp]+energy*1.05);if(Math.abs(side)>.35)p.mirrors![side>0?1:0]=Math.min(1,p.mirrors![side>0?1:0]+energy);
 const wheel=(along>=0?0:2)+(side>=0?1:0),geometry=vehicleGeometry(v),at=p.contacts[zone];
 const wheelEnergy=p.wheels.map((_,i)=>{if(!contact)return i===wheel?energy:0;const x=(i<2?1:-1)*geometry.wheelbase/(2*geometry.length),y=(i%2===0?-1:1)*.44;return energy*Math.exp(-1.5*(((at.x-x)/.34)**2+((at.y-y)/.36)**2));});
 for(let i=0;i<p.wheels.length;i++){const w=p.wheels[i],e=wheelEnergy[i];if(e>.3&&!w.missing)w.attachment=Math.max(0,(w.attachment??1)-Math.max(0,e-.3)*1.25);w.rim=Math.min(1,w.rim+e*.8);w.suspension=Math.min(1,w.suspension+e*.9);w.alignment=Math.max(-.42,Math.min(.42,w.alignment+(side>=0?1:-1)*e*.2));if(e>.3)w.puncture=true;}
 const toss=(kind:VehicleDebris['kind'],n:number)=>{for(let i=0;i<n&&p.debris.length<24;i++)p.debris.push({kind,x:contact?.x??v.x+nx*.6,y:contact?.y??v.y+ny*.6,z:kind==='glass'?.7:.2,vx:(v.vx??0)*.45+nx*(1+i%3)+Math.cos(i*2.4),vy:(v.vy??0)*.45+ny*(1+i%3)+Math.sin(i*2.4),vz:1.4+i%3*.35,age:0,spin:i*1.7});};
 if(oldLamp<.94&&p.lamps![lamp]>=.94){const before=p.debris.length;toss('lamp',1);if(p.debris.length>before)p.debris[p.debris.length-1].colour=lamp<2?'#c2d0bb':'#b56b5b';}
 if(oldGlass<=.45&&p.glass[zone]>.45||oldGlass<=.85&&p.glass[zone]>.85)toss('glass',3+Math.floor(energy*5));
 for(let i=0;i<p.wheels.length;i++){const w=p.wheels[i];if(wheelEnergy[i]>.68&&w.suspension>.82&&!w.missing){w.missing=true;w.attachment=0;toss('wheel',1);}}
 if(zone===0){p.hood=Math.max(0,p.hood-energy*.8);p.hoodLoose=p.hood<.55;}
 if(zone===1)p.boot=Math.max(0,(p.boot??1)-energy*.7);
 if(zone<2){p.bumperZone=zone;p.bumpers![zone]=Math.max(0,p.bumpers![zone]-energy);p.bumper=Math.min(...p.bumpers!);p.bumperLoose=p.bumper<.6;}
 if(p.bumper===0&&!v.bumperLost){v.bumperLost=true;toss('metal',2);}
 // Severe concentrated impacts tear the struck end or door free at impact,
 // rather than waiting for wind while an already wrecked car is stationary.
 if(energy>.85&&speed>8){
  if(VEHICLES[v.cls].design?.powerSource==='fusion'&&!v.burnt){v.heat=1;v.burning=true;}
  const detach=(kind:'metal',size:number)=>{const before=p.debris.length;toss(kind,1);if(p.debris.length>before){const fragment=p.debris[p.debris.length-1];fragment.size=size;fragment.colour=v.color;fragment.zone=zone;fragment.curl=.45;fragment.spinRate=3;}};
  if(zone===0&&!p.hoodGone){p.hood=0;p.hoodLoose=false;p.hoodGone=true;detach('metal',.4);}
  if(zone===1&&!p.bootGone){p.boot=0;p.bootGone=true;detach('metal',.32);}
  if(zone>=2){const index=zone-2;p.doorGone??=[false,false];p.doorHinges??=[1,1];if(!p.doorGone[index]){p.doorGone[index]=true;p.doorHinges[index]=0;detach('metal',.38);}}
 }

}
/** Apply a bounded blast to the chassis, panels, glass and existing parts model. */
export function blastVehicle(v:Vehicle,nx:number,ny:number,strength:number,tick:number):void{
 if(!Number.isFinite(strength)||strength<=0)return;const len=Math.hypot(nx,ny)||1;nx/=len;ny/=len;
 const speed=Math.min(15,strength*4),g=vehicleGeometry(v);
 impactComponents(v,nx,ny,speed,VEHICLES[v.cls].mass,tick,{x:v.x+nx*g.length*.35,y:v.y+ny*g.width*.35});
 v.damage=Math.min(1,v.damage+Math.min(.6,strength*.16));v.heat=Math.min(1,(v.heat??0)+strength*.12);
}
export function damageParts(v: Vehicle): void {
  const f=v.dmgF??0, r=v.dmgR??0, l=v.dmgL??0, s=v.dmgS??0;
  if(!v.engineRepaired)v.engineDamage=Math.max(v.engineDamage??0, Math.max(0,(f-.3)/.7)*0.9);
  v.glassDamage=v.components?Math.max(...v.components.glass):Math.max(v.glassDamage??0, Math.max(f,r)*.95);
  if(v.components){const p=v.components;v.flatLeft=p.wheels[0].puncture||p.wheels[2].puncture;v.flatRight=p.wheels[1].puncture||p.wheels[3].puncture;v.bumperLost=p.bumper<=0;v.mirrorLost=p.mirrors?.some(n=>n>.85)??!!v.mirrorLost;}else{if(l>.6)v.flatLeft=true;if(s>.6)v.flatRight=true;v.bumperLost=!!v.bumperLost||Math.max(f,r)>.82;v.mirrorLost=!!v.mirrorLost||Math.max(l,s)>.7;}
  if(!v.engineRepaired)v.leak=Math.max(v.leak??0,Math.max(0,f-0.5));
}
/** Heat rises only while badly damaged engines run; stopping prevents escalation. */
export function damageTick(v: Vehicle, dt: number): void {
  damageParts(v);if(v.components?.underbody)stepUnderbody(v.components.underbody,dt);tickStructure(v,dt);advanceAttachments(v,dt);tickEngineComponents(v,dt);if(v.components?.lattice){if(v.components.lattice.version!==4)v.components.lattice=upgradeLattice(v.components.lattice);stepLattice(v.components.lattice,dt);}
  // A damaged wheel mount carries load until motion tears the remaining attachment.
  if(v.components&&Number.isFinite(dt)&&dt>0){const p=v.components,speed=Math.abs(v.speed),step=Math.min(.25,dt);
   for(let i=0;i<p.wheels.length;i++){const w=p.wheels[i],mount=w.attachment??1;if(w.missing||mount>=.65||speed<.5)continue;
    const rough=Math.max(0,Math.min(1,v.contactControl?.wheels[i]?.roughness??0)),turn=Math.min(2,Math.abs(v.yaw??0));
    w.attachment=Math.max(0,mount-step*(.65-mount)*Math.min(speed,25)*.025*(1+rough*.5+turn*.15));
    if(w.attachment===0){w.missing=true;w.puncture=true;if(p.debris.length<24){const geo=vehicleGeometry(v),x=(i<2?1:-1)*geo.wheelbase*.5,y=(i%2?1:-1)*geo.width*.5,c=Math.cos(v.heading),s=Math.sin(v.heading);p.debris.push({kind:'wheel',x:v.x+x*c-y*s,y:v.y+x*s+y*c,z:.2,vx:(v.vx??c*v.speed)+(i%2?1:-1)*-s,vy:(v.vy??s*v.speed)+(i%2?1:-1)*c,vz:.8,age:0,spin:0});}}
   }
  }
  if(v.components){const p=v.components;const air=Math.abs(v.speed)**2;for(const stain of p.blood??[])stain.age=Math.min(900,stain.age+dt);
   if(p.doorHinges&&p.doorGone&&Number.isFinite(dt)&&dt>0){for(let side=0;side<2;side++){const hinge=p.doorHinges[side];if(p.doorGone[side]||hinge>=.55||Math.abs(v.speed)<.5)continue;p.doorHinges[side]=Math.max(0,hinge-Math.min(.25,dt)*(.55-hinge)*Math.min(air,625)*.0008);if(p.doorHinges[side]===0){p.doorGone[side]=true;const c=Math.cos(v.heading),s=Math.sin(v.heading),sign=side?1:-1;if(p.debris.length<24)p.debris.push({kind:'metal',x:v.x-sign*s*.5,y:v.y+sign*c*.5,z:.6,vx:(v.vx??c*v.speed)-sign*s,vy:(v.vy??s*v.speed)+sign*c,vz:.8,age:0,spin:0,size:.24,curl:.3,zone:side+2});}}}
   if(p.boot!==undefined&&p.boot<.55&&!p.bootGone&&Number.isFinite(dt)&&dt>0){p.boot=Math.max(0,p.boot-Math.min(.25,dt)*air*.00012);if(p.boot===0){p.bootGone=true;const c=Math.cos(v.heading),s=Math.sin(v.heading);if(p.debris.length<24)p.debris.push({kind:'metal',x:v.x-c*.6,y:v.y-s*.6,z:.7,vx:v.vx??c*v.speed,vy:v.vy??s*v.speed,vz:1,age:0,spin:0,size:.2,curl:.2,zone:1});}}
   if(p.hoodLoose&&!p.hoodGone){p.hood=Math.max(0,p.hood-dt*air*.00018);if(!p.hood){p.hoodGone=true;p.debris.length<24&&p.debris.push({kind:'metal',x:v.x,y:v.y,z:.8,vx:v.vx??0,vy:v.vy??0,vz:2,age:0,spin:0});}}
   p.debris=p.debris.filter(d=>d.age<25);for(const d of p.debris){d.age+=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vz-=9.8*dt;d.spin+=dt*(d.spinRate??(d.kind==='wheel'?5:2));if(d.size){const drag=Math.exp(-dt*(d.kind==='glass'?1.2:.45));d.vx*=drag;d.vy*=drag;d.roll=(d.roll??0)+dt*(d.kind==='glass'?6:2);d.pitch=(d.pitch??0)+dt*3;}if(d.z<.03){d.z=.03;if(d.size){d.roll=(d.roll??0)*Math.exp(-dt*8);d.pitch=(d.pitch??0)*Math.exp(-dt*8);d.spinRate=(d.spinRate??2)*Math.exp(-dt*3);}d.vz=Math.abs(d.vz)>.5?-d.vz*.23:0;d.vx*=Math.max(0,1-dt*(d.kind==='wheel'?.7:4));d.vy*=Math.max(0,1-dt*(d.kind==='wheel'?.7:4));}}
  }
  if (v.burnt) { v.burntAge = (v.burntAge ?? 0) + dt; return; }
  const running=v.driver>=0 && Math.abs(v.speed)>0.5;
  v.heat=Math.max(0,Math.min(1,(v.heat??0)+(running && (v.engineDamage??0)>0.65 ? dt*0.015 : -dt*0.02)));
  if ((v.heat??0)>=1) v.burning=true;
  if (v.burning) { v.damage=Math.min(1,v.damage+dt*0.025); v.burnTime=(v.burnTime??0)+dt; }
  if ((v.burnTime??0)>(VEHICLES[v.cls].design?.powerSource==='fusion'||['ev','compact_ev','estate_ev'].includes(VEHICLES[v.cls].design?.base??v.cls)?90:75)) { v.burnt=true; v.burning=false; v.damage=1; v.speed=0; v.vx=0; v.vy=0; }
}
export function repairVehicle(v: Vehicle): void {
  if(v.utility){v.utility.brakeHeat=0;v.utility.sway=0;v.utility.swayVelocity=0;v.utility.loadShift=0;v.utility.engineLoad=0;v.utility.airRelease=0;}
  v.water=undefined;v.dynamics=undefined;v.contactControl=undefined;v.stabilityActive=false;v.powertrain=undefined;v.driveThrottle=0;v.wheelspin=0;v.wheelSteer=0;v.tyreHeat=0;
  v.components=undefined;v.steerAngle=0;v.engineRepaired=false;
  v.damage=0; v.dmgF=0; v.dmgR=0; v.dmgL=0; v.dmgS=0;
  v.engineDamage=0; v.glassDamage=0; v.flatLeft=false; v.flatRight=false;
  v.bumperLost=false; v.mirrorLost=false; v.leak=0; v.heat=0; v.burning=false; v.burnTime=0; v.burnt=false; v.burntAge=0; v.towAt=undefined;
}
