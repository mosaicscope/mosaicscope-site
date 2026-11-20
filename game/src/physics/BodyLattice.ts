import type {Character,Vehicle} from '../entities/types';
import type {World} from '../world/World';
import {vehicleGeometry} from '../sim/VehicleGeometry';
export interface BodyPoint{x:number;y:number;z:number;vx:number;vy:number;vz:number}
interface Strand {a:BodyPoint;b:BodyPoint}
/** Ten ten-point elastic strands follow and feed back into the articulated body. */
export class BodyLattice {
 readonly points:BodyPoint[]=[];
 constructor(strands:readonly Strand[]){for(const {a,b} of strands)for(let j=0;j<10;j++){const t=j/9;this.points.push({x:a.x*(1-t)+b.x*t,y:a.y*(1-t)+b.y*t,z:a.z*(1-t)+b.z*t,vx:a.vx*(1-t)+b.vx*t,vy:a.vy*(1-t)+b.vy*t,vz:a.vz*(1-t)+b.vz*t});}}
 step(c:Character,world:World,vehicles:readonly Vehicle[],strands:readonly Strand[],dt:number):void{
  dt=Math.min(.05,Math.max(0,dt));if(!dt)return;
  for(let strand=0;strand<10;strand++){const {a,b}=strands[strand],off=strand*10,span=Math.max(.025,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/9);
   for(let j=1;j<9;j++){const p=this.points[off+j],ox=p.x,oy=p.y;p.vz-=9.8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    if(!world.walkable(p.x,p.y)){p.x=ox;p.y=oy;p.vx*=-.15;p.vy*=-.15;}const floor=world.groundZ(p.x,p.y)+.015;if(p.z<floor){p.z=floor;p.vz=Math.max(0,-p.vz*.12);p.vx*=.9;p.vy*=.9;}
    for(let vi=0;vi<Math.min(4,vehicles.length);vi++){const v=vehicles[vi],g=vehicleGeometry(v),co=Math.cos(v.heading),si=Math.sin(v.heading),dx=p.x-v.x,dy=p.y-v.y,x=dx*co+dy*si,y=-dx*si+dy*co;if(p.z>g.height||Math.abs(x)>g.length/2||Math.abs(y)>g.width/2)continue;const along=g.length/2-Math.abs(x)<g.width/2-Math.abs(y),lx=along?(x<0?-1:1):0,ly=along?0:(y<0?-1:1),nx=lx*co-ly*si,ny=lx*si+ly*co,depth=along?g.length/2-Math.abs(x):g.width/2-Math.abs(y);p.x+=nx*(depth+.01);p.y+=ny*(depth+.01);const force=Math.max(0,((v.vx??0)-p.vx)*nx+((v.vy??0)-p.vy)*ny);p.vx+=nx*force*.3;p.vy+=ny*force*.3;c.kx+=nx*Math.min(.025,force*.002);c.ky+=ny*Math.min(.025,force*.002);}
   }
   Object.assign(this.points[off],a);Object.assign(this.points[off+9],b);
   for(let pass=0;pass<3;pass++)for(let j=0;j<9;j++){const p=this.points[off+j],q=this.points[off+j+1],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,len=Math.hypot(dx,dy,dz)||.001,correction=(len-span)/len*.45,pa=j===0?0:1,qa=j===8?0:1;p.x+=dx*correction*pa;p.y+=dy*correction*pa;p.z+=dz*correction*pa;q.x-=dx*correction*qa;q.y-=dy*correction*qa;q.z-=dz*correction*qa;}
   for(let j=1;j<9;j++){const p=this.points[off+j],t=j/9,tx=a.x*(1-t)+b.x*t,ty=a.y*(1-t)+b.y*t,tz=a.z*(1-t)+b.z*t;p.vx=(p.vx+(tx-p.x)*12*dt)*Math.exp(-5*dt);p.vy=(p.vy+(ty-p.y)*12*dt)*Math.exp(-5*dt);p.vz=(p.vz+(tz-p.z)*12*dt)*Math.exp(-5*dt);}
  }
 }
}
