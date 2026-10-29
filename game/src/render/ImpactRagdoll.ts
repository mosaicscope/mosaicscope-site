import type {Character,Vehicle} from '../entities/types';
import {vehicleGeometry} from '../sim/VehicleGeometry';
import type {World} from '../world/World';
/** Four bounded limb bodies tethered to the simulated character centre. */
interface Limb {x:number;y:number;z:number;vx:number;vy:number;vz:number}
interface State {limbs:Limb[]}
const states=new WeakMap<Character,State>();
export function clearImpactRagdoll(c:Character):void{states.delete(c);}
export function impactRagdoll(c:Character,world:World,dt:number,vehicles:readonly Vehicle[]=[]):number[]{
 const facing=Number.isFinite(c.facing)?c.facing:0,fx=Math.cos(facing),fy=Math.sin(facing),sx=-fy,sy=fx,baseZ=Math.max(0,c.z)+.38;
 const anchor=(i:number)=>{const side=i%2?1:-1,arms=i<2;return{x:c.x+sx*side*(arms?.12:.08),y:c.y+sy*side*(arms?.12:.08),z:baseZ+(arms?.14:-.1)}};
 let state=states.get(c);if(!state){state={limbs:Array.from({length:4},(_,i)=>{const a=anchor(i),side=i%2?1:-1;return{x:a.x+sx*side*.3,y:a.y+sy*side*.3,z:Math.max(.02,a.z-.18),vx:c.kx*.8+sx*side*.4,vy:c.ky*.8+sy*side*.4,vz:c.vz*.7}})};states.set(c,state);}
 const elapsed=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),steps=Math.max(1,Math.ceil(elapsed*120)),h=elapsed/steps;
 for(let k=0;k<steps;k++)for(let i=0;i<4;i++){const n=state.limbs[i],a=anchor(i),previousX=n.x,previousY=n.y;n.vz-=14*h;n.x+=n.vx*h;n.y+=n.vy*h;n.z+=n.vz*h;
  if(!world.walkable(n.x,n.y)){n.x=previousX;n.y=previousY;n.vx*=-.2;n.vy*=-.2;}
  for(let vi=0;vi<Math.min(4,vehicles.length);vi++){const v=vehicles[vi];const g=vehicleGeometry(v);if(n.z>g.height||Math.abs(n.x-v.x)>g.radius||Math.abs(n.y-v.y)>g.radius)continue;const ca=Math.cos(v.heading),sa=Math.sin(v.heading),dx=n.x-v.x,dy=n.y-v.y,lx=dx*ca+dy*sa,ly=-dx*sa+dy*ca,hx=g.length*.5,hy=g.width*.5;if(Math.abs(lx)>=hx||Math.abs(ly)>=hy)continue;let ox=lx,oy=ly;if(hx-Math.abs(lx)<hy-Math.abs(ly))ox=(lx<0?-1:1)*(hx+.02);else oy=(ly<0?-1:1)*(hy+.02);n.x=v.x+ox*ca-oy*sa;n.y=v.y+ox*sa+oy*ca;n.vx+=((v.vx??0)-n.vx)*.12;n.vy+=((v.vy??0)-n.vy)*.12;}
  const ground=world.groundZ(n.x,n.y);if(n.z<ground){n.z=ground;n.vz=Math.max(0,-n.vz*.16);n.vx*=.85;n.vy*=.85;}
  let dx=n.x-a.x,dy=n.y-a.y,dz=n.z-a.z,dist=Math.hypot(dx,dy,dz)||.001;const max=i<2?.48:.54;if(dist>max){const q=(dist-max)/dist;n.x-=dx*q;n.y-=dy*q;n.z-=dz*q;const outward=(n.vx-c.kx)*dx/dist+(n.vy-c.ky)*dy/dist+(n.vz-c.vz)*dz/dist;if(outward>0){n.vx-=outward*dx/dist;n.vy-=outward*dy/dist;n.vz-=outward*dz/dist;}}
  const damping=Math.exp(-2.2*h);n.vx=c.kx+(n.vx-c.kx)*damping;n.vy=c.ky+(n.vy-c.ky)*damping;n.vz*=damping;}
 return state.limbs.map((n,i)=>{const a=anchor(i),forward=(n.x-a.x)*fx+(n.y-a.y)*fy;return Math.max(-.9,Math.min(.9,Math.atan2(forward,Math.max(.08,Math.abs(n.z-a.z)))));});
}
