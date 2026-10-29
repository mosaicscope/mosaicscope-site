import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from './VehicleGeometry';

/** Visible under-bonnet assemblies linked to existing mechanical damage IDs. */
export const ENGINE_COMPONENTS=[
 {id:'cooling_fan',x:.39,y:0,z:.6,colour:'#adb8a8',size:.08},
 {id:'radiator_core',x:.46,y:0,z:.5,colour:'#84918a',size:.14},
 {id:'alternator',x:.27,y:.25,z:.55,colour:'#b5b6a0',size:.08},
 {id:'intake',x:.38,y:.16,z:.63,colour:'#46534f',size:.11},
 {id:'drive_belt',x:.42,y:-.12,z:.52,colour:'#343b35',size:.07},
 {id:'battery_cable',x:.38,y:.3,z:.52,colour:'#bd9b68',size:.06},
 {id:'coolant_hose',x:.35,y:.18,z:.52,colour:'#ad9874',size:.07},
] as const;
export type EngineComponentId=typeof ENGINE_COMPONENTS[number]['id'];
export interface EngineMount {mount:number;angle:number;velocity:number;detached:boolean}
export type EngineMounts=Partial<Record<EngineComponentId,EngineMount>>;
/** Allocate only after mechanical damage; detached parts reuse the bounded debris pool. */
export function tickEngineComponents(v:Vehicle,dt:number):void{
 const p=v.components,parts=p?.parts;if(!p||!parts||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.05,dt);
 const speed=Math.abs(v.speed),rpm=v.driver>=0&&!v.burnt?(v.powertrain?.rpm??900):0,exposed=p.hoodGone||p.hood<.25;
 for(const spec of ENGINE_COMPONENTS){const damage=Math.max(0,Math.min(1,parts[spec.id]??0));if(damage<.25)continue;
  const mounts=p.engineMounts??={},state=mounts[spec.id]??={mount:1,angle:0,velocity:0,detached:false};if(state.detached)continue;
  state.mount=Math.min(state.mount,Math.max(0,1-Math.max(0,damage-.25)*1.15));
  const loose=1-state.mount,shake=Math.min(4,rpm/2200+speed*.04),forcing=Math.sin((p.progressive?.age??0)*(8+shake*3)+spec.x*19)*shake*loose;
  state.velocity=(state.velocity+(forcing-state.angle*12)*dt)*Math.exp(-4*dt);state.angle=Math.max(-.4,Math.min(.4,state.angle+state.velocity*dt));
  if(exposed&&damage>.7)state.mount=Math.max(0,state.mount-dt*(damage-.7)*(shake*.06+Math.abs(v.yaw??0)*.06));
  if(exposed&&state.mount<=.04){state.detached=true;parts[spec.id]=1;const g=vehicleGeometry(v),c=Math.cos(v.heading),s=Math.sin(v.heading),x=spec.x*g.length,y=spec.y*g.width;
   if(p.debris.length<24)p.debris.push({kind:'engine',part:spec.id,x:v.x+x*c-y*s,y:v.y+x*s+y*c,z:g.height*spec.z,vx:(v.vx??c*v.speed)*.8-s*.6,vy:(v.vy??s*v.speed)*.8+c*.6,vz:1,age:0,spin:0,size:spec.size,colour:spec.colour,roll:0,pitch:0,spinRate:3});
  }
 }
}
