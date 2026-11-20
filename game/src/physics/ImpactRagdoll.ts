import {BodyLattice} from './BodyLattice';
import type {Character,Vehicle} from '../entities/types';
import {vehicleGeometry} from '../sim/VehicleGeometry';
import {utilityDynamics} from '../sim/VehicleUtility';
import type {World} from '../world/World';
/** Lightweight articulated limbs; joints and endpoints react to ground and impacts. */
interface Limb {x:number;y:number;z:number;vx:number;vy:number;vz:number}
interface State {limbs:Limb[];joints:Limb[];head:Limb;torso:Limb;pelvis:Limb;pose:number[]; lattice?:BodyLattice}
const states=new WeakMap<Character,State>();
export function clearImpactRagdoll(c:Character):void{states.delete(c);}
export function stepImpactRagdoll(c:Character,world:World,dt:number,vehicles:readonly Vehicle[]=[]):void{
 const facing=Number.isFinite(c.facing)?c.facing:0,fx=Math.cos(facing),fy=Math.sin(facing),sx=-fy,sy=fx,baseZ=Math.max(0,c.z)+.38;
 let state=states.get(c);
 const anchor=(i:number)=>{const side=i%2?1:-1,arms=i<2,core=arms?state?.torso:state?.pelvis;return{x:(core?.x??c.x)+sx*side*(arms?.12:.08),y:(core?.y??c.y)+sy*side*(arms?.12:.08),z:core?.z??baseZ+(arms?.14:-.1)}};
 if(!state){state={torso:{x:c.x,y:c.y,z:baseZ+.14,vx:c.kx,vy:c.ky,vz:c.vz},pelvis:{x:c.x,y:c.y,z:baseZ-.1,vx:c.kx,vy:c.ky,vz:c.vz},limbs:Array.from({length:4},(_,i)=>{const a=anchor(i),side=i%2?1:-1;return{x:a.x+sx*side*.3,y:a.y+sy*side*.3,z:Math.max(.02,a.z-.18),vx:c.kx*.8+sx*side*.4,vy:c.ky*.8+sy*side*.4,vz:c.vz*.7}}),joints:Array.from({length:4},(_,i)=>{const a=anchor(i),side=i%2?1:-1;return{x:a.x+sx*side*.15,y:a.y+sy*side*.15,z:Math.max(.02,a.z-.09),vx:c.kx,vy:c.ky,vz:c.vz}}),head:{x:c.x,y:c.y,z:baseZ+.37,vx:c.kx,vy:c.ky,vz:c.vz},pose:[0,0,0,0,0,0,0,0,0]};states.set(c,state);}
 const elapsed=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),steps=Math.max(1,Math.ceil(elapsed*120)),h=elapsed/steps;
 // Torso and pelvis have separate mass points connected by a spine. Their
 // bounded impulses share motion with the gameplay body and nearby vehicles.
 const coreStep=(n:Limb,targetZ:number,mass:number)=>{const ox=n.x,oy=n.y;n.vz-=14*elapsed;n.x+=n.vx*elapsed;n.y+=n.vy*elapsed;n.z+=n.vz*elapsed;
  if(!world.walkable(n.x,n.y)){n.x=ox;n.y=oy;n.vx*=-.2;n.vy*=-.2;}const floor=world.groundZ(n.x,n.y)+.07;if(n.z<floor){n.z=floor;n.vz=Math.max(0,-n.vz*.12);n.vx*=.82;n.vy*=.82;}
  for(let i=0;i<Math.min(4,vehicles.length);i++){const v=vehicles[i],g=vehicleGeometry(v),ca=Math.cos(v.heading),sa=Math.sin(v.heading),dx=n.x-v.x,dy=n.y-v.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;if(n.z>g.height||Math.abs(x)>=g.length*.5||Math.abs(y)>=g.width*.5)continue;const front=g.length*.5-Math.abs(x)<g.width*.5-Math.abs(y),lx=front?(x<0?-1:1):0,ly=front?0:(y<0?-1:1),nx=lx*ca-ly*sa,ny=lx*sa+ly*ca,depth=front?g.length*.5-Math.abs(x):g.width*.5-Math.abs(y);n.x+=nx*(depth+.02);n.y+=ny*(depth+.02);const rv=((v.vx??0)-n.vx)*nx+((v.vy??0)-n.vy)*ny;if(rv>0){const impulse=Math.min(3,rv*.45);n.vx+=nx*impulse;n.vy+=ny*impulse;c.kx+=nx*impulse*mass;c.ky+=ny*impulse*mass;if(v.state==='free'&&v.vx!==undefined&&v.vy!==undefined){const share=Math.min(.08,mass*.09/Math.max(.3,utilityDynamics(v).mass));v.vx-=nx*impulse*share;v.vy-=ny*impulse*share;const fc=Math.cos(v.heading),fs=Math.sin(v.heading);v.speed=v.vx*fc+v.vy*fs;v.slip=-v.vx*fs+v.vy*fc;}}}
  const dx=n.x-c.x,dy=n.y-c.y,dz=n.z-targetZ,d=Math.hypot(dx,dy,dz)||.001;if(d>.32){const correction=(d-.32)/d;n.x-=dx*correction;n.y-=dy*correction;n.z-=dz*correction;}const damping=Math.exp(-3*elapsed);n.vx=c.kx+(n.vx-c.kx)*damping;n.vy=c.ky+(n.vy-c.ky)*damping;n.vz*=damping;};
 coreStep(state.torso,baseZ+.14,.05);coreStep(state.pelvis,baseZ-.1,.07);
 const spineX=state.torso.x-state.pelvis.x,spineY=state.torso.y-state.pelvis.y,spineZ=state.torso.z-state.pelvis.z,spineLength=Math.hypot(spineX,spineY,spineZ)||.001,spineError=(spineLength-.24)/spineLength*.5;
 state.torso.x-=spineX*spineError;state.torso.y-=spineY*spineError;state.torso.z-=spineZ*spineError;state.pelvis.x+=spineX*spineError;state.pelvis.y+=spineY*spineError;state.pelvis.z+=spineZ*spineError;
 for(let k=0;k<steps;k++)for(let i=0;i<4;i++){const n=state.limbs[i],a=anchor(i),previousX=n.x,previousY=n.y;n.vz-=14*h;n.x+=n.vx*h;n.y+=n.vy*h;n.z+=n.vz*h;
  if(!world.walkable(n.x,n.y)){n.x=previousX;n.y=previousY;n.vx*=-.2;n.vy*=-.2;}
  for(let vi=0;vi<Math.min(4,vehicles.length);vi++){const v=vehicles[vi];const g=vehicleGeometry(v);if(n.z>g.height||Math.abs(n.x-v.x)>g.radius||Math.abs(n.y-v.y)>g.radius)continue;const ca=Math.cos(v.heading),sa=Math.sin(v.heading),dx=n.x-v.x,dy=n.y-v.y,lx=dx*ca+dy*sa,ly=-dx*sa+dy*ca,hx=g.length*.5,hy=g.width*.5;if(Math.abs(lx)>=hx||Math.abs(ly)>=hy)continue;let ox=lx,oy=ly;if(hx-Math.abs(lx)<hy-Math.abs(ly))ox=(lx<0?-1:1)*(hx+.02);else oy=(ly<0?-1:1)*(hy+.02);const pushX=(ox-lx)*ca-(oy-ly)*sa,pushY=(ox-lx)*sa+(oy-ly)*ca,pushLength=Math.hypot(pushX,pushY)||1,nx=pushX/pushLength,ny=pushY/pushLength;
   n.x=v.x+ox*ca-oy*sa;n.y=v.y+ox*sa+oy*ca;
   const relative=((v.vx??0)-n.vx)*nx+((v.vy??0)-n.vy)*ny;
   if(relative>0){const impulse=Math.min(4,relative*.6);n.vx+=nx*impulse;n.vy+=ny*impulse;c.kx+=nx*impulse*.08;c.ky+=ny*impulse*.08;n.vz+=Math.min(.8,impulse*.15);}}
  const ground=world.groundZ(n.x,n.y);if(n.z<ground){n.z=ground;n.vz=Math.max(0,-n.vz*.16);n.vx*=.85;n.vy*=.85;}
  let dx=n.x-a.x,dy=n.y-a.y,dz=n.z-a.z,dist=Math.hypot(dx,dy,dz)||.001;const max=i<2?.48:.54;if(dist>max){const q=(dist-max)/dist;n.x-=dx*q;n.y-=dy*q;n.z-=dz*q;const outward=(n.vx-c.kx)*dx/dist+(n.vy-c.ky)*dy/dist+(n.vz-c.vz)*dz/dist;if(outward>0){n.vx-=outward*dx/dist;n.vy-=outward*dy/dist;n.vz-=outward*dz/dist;const impulse=Math.min(.12,outward*.025);c.kx+=impulse*dx/dist;c.ky+=impulse*dy/dist;c.vz+=impulse*dz/dist;}}
  const damping=Math.exp(-2.2*h);n.vx=c.kx+(n.vx-c.kx)*damping;n.vy=c.ky+(n.vy-c.ky)*damping;n.vz*=damping;
  // Solve two segments per limb, with a shoulder/hip anchor and a free
  // elbow/knee. Bounded corrections couple joint movement back to the body.
  const j=state.joints[i],jx=j.x,jy=j.y,jz=j.z;j.vz-=14*h;j.x+=j.vx*h;j.y+=j.vy*h;j.z+=j.vz*h;
  if(!world.walkable(j.x,j.y)){j.x=jx;j.y=jy;j.vx*=-.2;j.vy*=-.2;}
  const floor=world.groundZ(j.x,j.y);if(j.z<floor){j.z=floor;j.vz=Math.max(0,-j.vz*.12);}
  const upper=i<2?.24:.27,lower=i<2?.24:.27;
  for(let pass=0;pass<2;pass++){let x=j.x-a.x,y=j.y-a.y,z=j.z-a.z,d=Math.hypot(x,y,z)||.001;if(d>upper){const excess=(d-upper)/d;j.x-=x*excess;j.y-=y*excess;j.z-=z*excess;}
   x=n.x-j.x;y=n.y-j.y;z=n.z-j.z;d=Math.hypot(x,y,z)||.001;if(d>lower){const excess=(d-lower)/d*.5;j.x+=x*excess;j.y+=y*excess;j.z+=z*excess;n.x-=x*excess;n.y-=y*excess;n.z-=z*excess;}}
  if(h>0){j.vx=Math.max(-12,Math.min(12,(j.x-jx)/h))*damping;j.vy=Math.max(-12,Math.min(12,(j.y-jy)/h))*damping;j.vz=Math.max(-12,Math.min(12,(j.z-jz)/h))*damping;}
 }
 // A head body and neck constraint feed impacts back into the existing torso.
 const head=state.head,oldX=head.x,oldY=head.y,neckZ=state.torso.z+.06;head.vz-=14*elapsed;head.x+=head.vx*elapsed;head.y+=head.vy*elapsed;head.z+=head.vz*elapsed;
 if(!world.walkable(head.x,head.y)){head.x=oldX;head.y=oldY;head.vx*=-.2;head.vy*=-.2;}
 const headGround=world.groundZ(head.x,head.y)+.08;if(head.z<headGround){head.z=headGround;head.vz=Math.max(0,-head.vz*.12);head.vx*=.8;head.vy*=.8;}
 for(let i=0;i<Math.min(4,vehicles.length);i++){const v=vehicles[i],g=vehicleGeometry(v),ca=Math.cos(v.heading),sa=Math.sin(v.heading),dx=head.x-v.x,dy=head.y-v.y,x=dx*ca+dy*sa,y=-dx*sa+dy*ca;if(head.z>g.height||Math.abs(x)>g.length*.5||Math.abs(y)>g.width*.5)continue;const axisX=g.length*.5-Math.abs(x)<g.width*.5-Math.abs(y),localX=axisX?(x<0?-1:1):0,localY=axisX?0:(y<0?-1:1),nx=localX*ca-localY*sa,ny=localX*sa+localY*ca,depth=axisX?g.length*.5-Math.abs(x):g.width*.5-Math.abs(y);head.x+=nx*(depth+.02);head.y+=ny*(depth+.02);const rel=((v.vx??0)-head.vx)*nx+((v.vy??0)-head.vy)*ny;if(rel>0){const impulse=Math.min(3,rel*.5);head.vx+=nx*impulse;head.vy+=ny*impulse;c.kx+=nx*impulse*.06;c.ky+=ny*impulse*.06;}}
 const hx=head.x-state.torso.x,hy=head.y-state.torso.y,hz=head.z-neckZ,dist=Math.hypot(hx,hy,hz)||.001;if(dist>.25){const q=(dist-.25)/dist;head.x-=hx*q;head.y-=hy*q;head.z-=hz*q;const outward=(head.vx-c.kx)*hx/dist+(head.vy-c.ky)*hy/dist+(head.vz-c.vz)*hz/dist;if(outward>0){head.vx-=outward*hx/dist;head.vy-=outward*hy/dist;head.vz-=outward*hz/dist;c.kx+=outward*hx/dist*.02;c.ky+=outward*hy/dist*.02;c.vz+=outward*hz/dist*.02;}}
 const headDamping=Math.exp(-2.2*elapsed);head.vx=c.kx+(head.vx-c.kx)*headDamping;head.vy=c.ky+(head.vy-c.ky)*headDamping;head.vz*=headDamping;
 const strands=[{a:state.pelvis,b:state.torso},{a:state.torso,b:state.head},...state.joints.map((j,i)=>({a:i<2?state!.torso:state!.pelvis,b:j})),...state.joints.map((j,i)=>({a:j,b:state!.limbs[i]}))];
 state.lattice??=new BodyLattice(strands);state.lattice.step(c,world,vehicles,strands,elapsed);
 state.pose=state.limbs.map((n,i)=>{const a=anchor(i),forward=(n.x-a.x)*fx+(n.y-a.y)*fy;return Math.max(-.9,Math.min(.9,Math.atan2(forward,Math.max(.08,Math.abs(n.z-a.z)))));});
 for(let i=0;i<4;i++){const n=state.limbs[i],j=state.joints[i],f=(n.x-j.x)*fx+(n.y-j.y)*fy;state.pose.push(Math.max(-.9,Math.min(.9,Math.atan2(f,Math.max(.06,Math.abs(n.z-j.z))))));}
 // Mid-strand flex follows the joint motion and contributes subtly to the visible limb pose.
 for(let i=0;i<4;i++){const mid=state.lattice.points[(6+i)*10+4],a=state.joints[i],b=state.limbs[i],dx=mid.x-(a.x+b.x)*.5,dy=mid.y-(a.y+b.y)*.5;state.pose[i]+=Math.max(-.12,Math.min(.12,(dx*fx+dy*fy)*.6));}
 state.pose.push(Math.max(-.8,Math.min(.8,Math.atan2((head.x-state.torso.x)*fx+(head.y-state.torso.y)*fy,Math.max(.08,Math.abs(head.z-neckZ))))));
 state.pose.push(Math.max(-.8,Math.min(.8,Math.atan2(spineX*fx+spineY*fy,Math.max(.08,Math.abs(spineZ))))));
}

/** Read-only pose: rendering never advances physics. */
export function impactBodyPointCount(c:Character):number{return states.get(c)?.lattice?.points.length??0;}
export function impactRagdollPose(c:Character):readonly number[]{return states.get(c)?.pose??[0,0,0,0,0,0,0,0,0,0];}
