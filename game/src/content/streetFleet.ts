import {EXPANDED_FLEET} from './fleetExpansion';
import type {FleetModel} from './fleet';

/** 100 body platforms × seven distinct chassis/handling packages. Stable IDs survive saves. */
export type StreetFleetClass = `street_${string}_${number}`;
const packages = [
 ['Metro',.91,.97,1.03,.88,.86,'plain'],
 ['Touring',1.08,1.02,1.04,1.02,1.12,'rack'],
 ['Sport',.99,1.06,.92,1.18,1.03,'wing'],
 ['Heritage',1.03,1.01,1.06,.93,1.14,'chrome'],
 ['Club',.95,1.05,.90,1.24,.91,'stripe'],
 ['Cross',1.04,1.04,1.16,.97,1.18,'spare'],
 ['Grand',1.13,1.07,1.02,1.10,1.25,'chrome'],
] as const;
export const STREET_FLEET = Object.fromEntries(Object.entries(EXPANDED_FLEET).slice(0,100).flatMap(([id,m],platform)=>packages.map(([badge,l,w,h,s,mass,trim],i)=>{
 const shape=m.body!.shape;
 return [`street_${id}_${i}`,{...m,name:`${m.name} ${badge}`,length:m.length*l,width:m.width*w,height:m.height*h,
  speed:m.speed*s,mass:m.mass*mass,price:Math.round(m.price*(.85+i*.16)/100)*100,wb:m.wb+(i-3)*.003,
  lamp:(['round','square','slit','quad','bar'] as const)[(platform+i)%5],trim,traffic:.14,
  body:{family:`${m.body!.family} ${badge}`,shape:{...shape,cf:Math.max(.04,shape.cf+(i-3)*.012),rw:Math.min(.96,shape.rw+(i-3)*.018),rh:(shape.rh??1)*h,
   roof:[shape.roof[0]-(l-1)*.1,shape.roof[1]+(l-1)*.12] as [number,number]}},
 } satisfies FleetModel];
}))) as Record<StreetFleetClass,FleetModel>;
