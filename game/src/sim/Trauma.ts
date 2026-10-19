import type {Character,Wound} from '../entities/types';
import {Phys} from '../entities/types';
import type {Simulation} from './Simulation';

export interface DetachedLimb{side:-1|1;x:number;y:number;z:number;vx:number;vy:number;vz:number;angle:number;spin:number;tick:number;cause:string}
/** Deliberately nonfatal. Blunt trauma fractures; only repeated severe sharp/heavy hits can detach. */
export function detachmentProfile(weapon:string,hits:number,severity:number,load?:string):{force:number;spin:number}|null{
 if(severity<3||load==='rubber')return null;
 if(weapon==='knife'&&hits>=6)return{force:1.4,spin:3};
 if(weapon==='shotgun'&&hits>=4)return{force:4.5,spin:7};
 if(weapon==='rifle'&&load==='heavy'&&hits>=5)return{force:3.2,spin:5};
 return null;
}
export function applyTrauma(sim:Simulation,c:Character,w:Wound,weapon:string,fromX:number,fromY:number,load?:string):void{
 w.weapon=weapon;
 if(w.part!=='arm'&&w.part!=='leg')return;
 if(w.kind==='fracture'&&w.severity===3)w.compound=(w.hits??0)>=2||weapon==='mace';
 const profile=detachmentProfile(weapon,w.hits??1,w.severity,load);if(!profile||w.detached)return;
 const a=Math.atan2(c.y-fromY,c.x-fromX),side=((c.id+w.tick)%2?1:-1) as -1|1;
 w.detached={side,x:c.x,y:c.y,z:w.part==='arm'?1:.45,vx:Math.cos(a)*profile.force,vy:Math.sin(a)*profile.force,vz:1.8,angle:a,spin:profile.spin*side,tick:sim.tick,cause:weapon};
 if(c.hand>=0)sim.dropHeld(c);
 c.phys=Phys.DOWN;c.physTimer=9999;c.emo.fear=1;c.emo.composure=0;sim.callAmbulance(c);
}
export function advanceDetachedLimbs(sim:Simulation,c:Character,dt:number):void{
 for(const w of c.wounds){const l=w.detached;if(!l)continue;
  let left=Math.min(2,dt);while(left>0){const step=Math.min(.025,left);left-=step;
   const nx=l.x+l.vx*step,ny=l.y+l.vy*step;
   if(sim.world.walkable(nx,l.y))l.x=nx;else l.vx*=-.25;
   if(sim.world.walkable(l.x,ny))l.y=ny;else l.vy*=-.25;
   l.vz-=9.81*step;l.z+=l.vz*step;l.angle+=l.spin*step;
   if(l.z<0){l.z=0;if(l.vz<-.5)l.vz*=-.22;else l.vz=0;const friction=Math.exp(-8*step);l.vx*=friction;l.vy*=friction;l.spin*=friction;}
  }
 }
}
