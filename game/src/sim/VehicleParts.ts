import type {Vehicle} from '../entities/types';
import {clamp} from '../core/math';

export type PartEffect='power'|'braking'|'steering'|'grip'|'drag'|'frame'|'cooling'|'door';
export interface PartSpec { id:string; label:string; x:number; y:number; radius:number; threshold:number; rate:number; effect:PartEffect; repair:'mechanical'|'body'|'wheel'; wheel?:number }
const component=(id:string,label:string,x:number,y:number,effect:PartEffect,repair:PartSpec['repair'],threshold=.12,rate=.7,radius=.38):PartSpec=>({id,label,x,y,effect,repair,threshold,rate,radius});
/** Individual location-sensitive parts. Coordinates are normalised by chassis length and width. */
export const VEHICLE_PARTS:readonly PartSpec[]=[
 component('cooling_fan','Cooling fan',.4,0,'cooling','mechanical'),
 component('radiator_core','Radiator core',.46,0,'cooling','mechanical',.1),
 component('thermostat','Thermostat housing',.31,.08,'cooling','mechanical'),
 component('oil_filter','Oil filter',.24,-.2,'power','mechanical'),
 component('oil_pump','Oil pump',.19,-.1,'power','mechanical'),
 component('engine_block','Engine block',.24,0,'power','mechanical',.22,.55,.27),
 component('cylinder_head','Cylinder head',.28,0,'power','mechanical',.2,.6,.28),
 component('exhaust_manifold','Exhaust manifold',.22,-.25,'power','mechanical'),
 component('throttle_body','Throttle body',.33,.19,'power','mechanical'),
 component('transmission_mount','Transmission mount',.02,0,'frame','mechanical'),
 component('battery_cable','Battery cable',.38,.3,'power','mechanical'),
 component('water_pump','Water pump',.28,-.15,'cooling','mechanical'),
 component('coolant_hose','Coolant hose',.35,.18,'cooling','mechanical',.08),
 component('ignition','Ignition system',.25,-.2,'power','mechanical'),
 component('intake','Air intake',.38,.16,'power','mechanical'),
 component('front_engine_mount','Front engine mount',.3,-.26,'frame','mechanical'),
 component('rear_engine_mount','Rear engine mount',.13,.2,'frame','mechanical'),
 component('engine_sensor','Engine sensor',.28,.08,'power','mechanical'),
 component('drive_belt','Accessory belt',.42,-.12,'power','mechanical'),
 component('alternator','Alternator',.27,.25,'power','mechanical'),
 component('brake_booster','Brake booster',.16,-.26,'braking','mechanical'),
 component('steering_pump','Power steering pump',.2,.25,'steering','mechanical'),
 component('fuel_pump','Fuel pump',-.39,.12,'power','mechanical'),
 component('fuel_line','Fuel line',-.3,-.19,'power','mechanical'),
 component('differential','Rear differential',-.31,0,'power','mechanical'),
 component('driveshaft','Driveshaft',-.16,0,'power','mechanical'),
 component('exhaust_mount','Exhaust mount',-.38,-.3,'drag','mechanical'),
 component('muffler','Muffler',-.44,.25,'drag','mechanical'),
 component('rear_crossmember','Rear crossmember',-.42,0,'frame','body'),
 component('rear_antiroll','Rear anti-roll bar',-.25,0,'grip','mechanical'),
 component('left_door_hinge','Left door hinge',.08,-.47,'door','body'),
 component('right_door_hinge','Right door hinge',.08,.47,'door','body'),
 component('left_door_latch','Left door latch',-.12,-.49,'door','body'),
 component('right_door_latch','Right door latch',-.12,.49,'door','body'),
 component('left_sill','Left sill',0,-.49,'frame','body'),
 component('right_sill','Right sill',0,.49,'frame','body'),
 ...[0,1,2,3].flatMap(i=>{const x=i<2?.31:-.31,y=i%2?.44:-.44,name=['Front left','Front right','Rear left','Rear right'][i],id=['fl','fr','rl','rr'][i];return [
  component(id+'_hub',name+' wheel hub',x,y,'drag','wheel',.16,.7,.25),
  component(id+'_bearing',name+' wheel bearing',x,y,'drag','wheel',.2,.6,.27),
  component(id+'_spring',name+' suspension spring',x,y,'grip','wheel',.14,.8,.28),
  component(id+'_damper',name+' damper',x,y,'grip','wheel',.13,.8,.28),
  component(id+'_caliper',name+' brake caliper',x,y,'braking','wheel',.17,.75,.25),
  component(id+'_arm',name+' control arm',x,y,'steering','wheel',.16,.7,.28),
 ].map(p=>({...p,wheel:i}));}),
];
export type PartDamage=Record<string,number>;
const BY_ID=new Map(VEHICLE_PARTS.map(p=>[p.id,p]));
/** Near contacts harm nearby parts more; light scrapes do not destroy deep systems. */
export function damageVehicleParts(v:Vehicle,x:number,y:number,energy:number):void{
 if(!v.components||!Number.isFinite(energy)||energy<=.03)return;
 const existing=v.components.parts??{}, e=clamp(energy,0,1);let changed=false;
 for(const p of VEHICLE_PARTS){const d2=((x-p.x)**2+(y-p.y)**2)/(p.radius*p.radius),local=e*Math.exp(-d2*1.5),hit=Math.max(0,local-p.threshold)*p.rate;if(hit<=.002)continue;existing[p.id]=clamp((existing[p.id]??0)+hit,0,1);changed=true;}
 if(changed)v.components.parts=existing;
}
export function partsEffects(v:Vehicle){const parts=v.components?.parts;if(!parts)return{power:1,braking:1,steering:1,grip:1,drag:0,cooling:0,door:[0,0],steeringPull:0,brakePull:0};const total:Record<PartEffect,number>={power:0,braking:0,steering:0,grip:0,drag:0,frame:0,cooling:0,door:0};const door=[0,0],caliper=[0,0],arm=[0,0];
 for(const [id,value] of Object.entries(parts)){const p=BY_ID.get(id);if(!p||!Number.isFinite(value))continue;const n=clamp(value,0,1);total[p.effect]+=n;if(p.effect==='door')door[p.y<0?0:1]=Math.max(door[p.y<0?0:1],n);if(p.wheel!==undefined&&id.endsWith('_caliper'))caliper[p.wheel%2]+=n;if(p.wheel!==undefined&&id.endsWith('_arm'))arm[p.wheel%2]+=n;}
 return{power:Math.max(.55,1-total.power*.045),braking:Math.max(.55,1-total.braking*.055),steering:Math.max(.6,1-total.steering*.05),grip:Math.max(.7,1-total.grip*.035-total.frame*.02),drag:Math.min(.45,total.drag*.05+total.frame*.025),cooling:Math.min(1,total.cooling*.2),door,steeringPull:clamp((arm[1]-arm[0])*.025,-.05,.05),brakePull:clamp((caliper[1]-caliper[0])*.035,-.07,.07)};
}
export function repairParts(v:Vehicle,group:'mechanical'|'body'|'wheel',wheel?:number):number{const p=v.components?.parts;if(!p)return 0;let count=0;for(const id of Object.keys(p)){const spec=BY_ID.get(id);if(spec&&spec.repair===group&&(wheel===undefined||spec.wheel===wheel)){delete p[id];count++;}}if(!Object.keys(p).length)v.components!.parts=undefined;return count;}
export function damagedParts(v:Vehicle):{name:string;damage:number}[]{return Object.entries(v.components?.parts??{}).flatMap(([id,damage])=>{const p=BY_ID.get(id);return p&&Number.isFinite(damage)&&damage>.02?[{name:p.label,damage:clamp(damage,0,1)}]:[];}).sort((a,b)=>b.damage-a.damage);}

export function hasPartDamage(v:Vehicle,groups:readonly PartSpec['repair'][]):boolean{return Object.entries(v.components?.parts??{}).some(([id,n])=>!!BY_ID.get(id)&&groups.includes(BY_ID.get(id)!.repair)&&Number.isFinite(n)&&n>0);}
export function repairBodyZone(v:Vehicle,zone:number):number{const parts=v.components?.parts;if(!parts)return 0;let removed=0;for(const id of Object.keys(parts)){const p=BY_ID.get(id);if(!p||p.repair!=='body')continue;const partZone=p.x<-.25?1:p.x>.25?0:p.y<0?2:3;if(partZone===zone){delete parts[id];removed++;}}if(!Object.keys(parts).length)v.components!.parts=undefined;return removed;}
