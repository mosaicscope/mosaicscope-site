import type { Vehicle } from "../entities/types";
export interface WheelDamage { puncture:boolean; rim:number; alignment:number; suspension:number; missing:boolean }
export interface VehicleDebris {kind:'glass'|'wheel'|'metal';x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;spin:number}
export interface VehicleComponents {wheels:WheelDamage[];panels:number[];glass:number[];hood:number;bumper:number;hoodLoose:boolean;hoodGone:boolean;bumperLoose:boolean;debris:VehicleDebris[];lastImpact:number}
export function components(v:Vehicle):VehicleComponents{return v.components??={wheels:Array.from({length:4},()=>({puncture:false,rim:0,alignment:0,suspension:0,missing:false})),panels:[v.dmgF??0,v.dmgR??0,v.dmgL??0,v.dmgS??0],glass:[0,0,0,0],hood:1,bumper:1,hoodLoose:false,hoodGone:false,bumperLoose:false,debris:[],lastImpact:0};}
/** Energy and direction choose actual components; a slow scrape never removes a wheel. */
export function impactComponents(v:Vehicle,nx:number,ny:number,speed:number,mass:number,tick:number):void{
 const p=components(v),c=Math.cos(v.heading),s=Math.sin(v.heading),along=nx*c+ny*s,side=-nx*s+ny*c;
 const energy=Math.min(1,Math.max(0,speed*speed*mass/150)),zone=Math.abs(along)>=Math.abs(side)?along>0?0:1:side>0?3:2;
 p.panels[zone]=Math.min(1,p.panels[zone]+energy);p.glass[zone]=Math.min(1,p.glass[zone]+energy*.95);p.lastImpact=tick;
 const wheel=(along>=0?0:2)+(side>=0?1:0),w=p.wheels[wheel];w.rim=Math.min(1,w.rim+energy*.8);w.suspension=Math.min(1,w.suspension+energy*.9);w.alignment=Math.max(-.42,Math.min(.42,w.alignment+(side>=0?1:-1)*energy*.2));if(energy>.3)w.puncture=true;
 const toss=(kind:VehicleDebris['kind'],n:number)=>{for(let i=0;i<n&&p.debris.length<24;i++)p.debris.push({kind,x:v.x+nx*.6,y:v.y+ny*.6,z:kind==='glass'?.7:.2,vx:nx*(1+i%3)+Math.cos(i*2.4),vy:ny*(1+i%3)+Math.sin(i*2.4),vz:1.4+i%3*.35,age:0,spin:i*1.7});};
 if(p.glass[zone]>.45)toss('glass',3+Math.floor(energy*5));
 if(energy>.68&&w.suspension>.82&&!w.missing){w.missing=true;toss('wheel',1);}
 if(zone===0){p.hood=Math.max(0,p.hood-energy*.8);p.hoodLoose=p.hood<.55;}
 if(zone<2){p.bumper=Math.max(0,p.bumper-energy);p.bumperLoose=p.bumper<.6;}
 if(p.bumper===0&&!v.bumperLost){v.bumperLost=true;toss('metal',2);}
}
export function damageParts(v: Vehicle): void {
  const f=v.dmgF??0, r=v.dmgR??0, l=v.dmgL??0, s=v.dmgS??0;
  v.engineDamage=Math.max(v.engineDamage??0, f*0.9);
  v.glassDamage=Math.max(v.glassDamage??0, Math.max(f,r)*0.95);
  if (l>0.6) v.flatLeft=true;
  if (s>0.6) v.flatRight=true;
  v.bumperLost=!!v.bumperLost || Math.max(f,r)>0.82;
  v.mirrorLost=!!v.mirrorLost || Math.max(l,s)>0.7;
  v.leak=Math.max(v.leak??0,Math.max(0,f-0.5));
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
  v.components=undefined;v.steerAngle=0;
  v.damage=0; v.dmgF=0; v.dmgR=0; v.dmgL=0; v.dmgS=0;
  v.engineDamage=0; v.glassDamage=0; v.flatLeft=false; v.flatRight=false;
  v.bumperLost=false; v.mirrorLost=false; v.leak=0; v.heat=0; v.burning=false; v.burnTime=0; v.burnt=false; v.burntAge=0; v.towAt=undefined;
}
