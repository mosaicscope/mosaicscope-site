import type {Vehicle} from '../entities/types';
import {VEHICLES} from '../content/vehicles';
export interface VehicleContact{x:number;y:number;nx:number;ny:number;speed:number}
/** Swept oriented chassis against a roadside object's footprint, including side impacts. */
export function vehicleContact(v:Vehicle,x:number,y:number,radius=.2):VehicleContact|null{
 const d=VEHICLES[v.cls],c=Math.cos(v.heading),s=Math.sin(v.heading),hx=d.length/2,hy=d.width/2;
 const local=(cx:number,cy:number)=>({x:(x-cx)*c+(y-cy)*s,y:-(x-cx)*s+(y-cy)*c});
 const start=local(v.px,v.py),end=local(v.x,v.y),dx=end.x-start.x,dy=end.y-start.y;let enter=0,leave=1;
 for(const [p,delta,half]of[[start.x,dx,hx+radius],[start.y,dy,hy+radius]]){if(Math.abs(delta)<1e-8){if(Math.abs(p)>half)return null;}else{const a=(-half-p)/delta,b=(half-p)/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(enter>leave)return null;}}
 if(leave<0||enter>1)return null;
 const t=Math.max(0,enter),lx=start.x+dx*t,ly=start.y+dy*t,ax=Math.max(-hx,Math.min(hx,lx)),ay=Math.max(-hy,Math.min(hy,ly));let nx=lx-ax,ny=ly-ay;
 if(Math.hypot(nx,ny)<1e-6){if(hx-Math.abs(lx)<hy-Math.abs(ly))nx=Math.sign(lx)||1;else ny=Math.sign(ly)||1;}
 const len=Math.hypot(nx,ny);nx/=len;ny/=len;const wx=nx*c-ny*s,wy=nx*s+ny*c,cx=v.px+(v.x-v.px)*t,cy=v.py+(v.y-v.py)*t;
 const vx=v.vx??Math.cos(v.heading)*v.speed,vy=v.vy??Math.sin(v.heading)*v.speed;
 return{x:cx+ax*c-ay*s,y:cy+ax*s+ay*c,nx:wx,ny:wy,speed:Math.abs(vx*wx+vy*wy)};
}
