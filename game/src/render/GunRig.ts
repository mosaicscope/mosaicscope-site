import type {GunMotion} from './WeaponMotion';
export const gunScale=(def:string)=>def==='rifle'?1.7:def==='shotgun'?1.65:def==='smg'?1.5:1.25;
/** Grip-centred world proportions; support hand follows the actual pump/fore-end, not a generic pose. */
export function gunGrips(def:string,motion:GunMotion,reloading:boolean){
 const long=['rifle','shotgun','smg'].includes(def),scale=gunScale(def),kick=motion.cycle*(long?3:2);
 const right={x:(long?12:18)-kick,y:9-kick*.4};
 const fore=def==='shotgun'?1.22-motion.pump*.5:def==='rifle'?.85:.64;
 const left=reloading?{x:8,y:22}:long?{x:right.x+(fore+.17)*10*scale,y:right.y-.43*10*scale}:{x:right.x-1,y:right.y+1};
 return{right,left,scale,originX:1.7*scale,originY:-3.5*scale};
}
