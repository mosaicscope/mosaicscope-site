/** A bounded, connected three-dimensional chassis in normalized vehicle coordinates.
 * Allocated only on impact; healthy vehicles incur no lattice cost. */
export interface CrashNode {x:number;y:number;restX:number;restY:number;vx:number;vy:number;z?:number;restZ?:number;vz?:number}
export interface CrashLattice {nodes:CrashNode[];active:number;linkDamage?:number[];version?:number}
export const crashPositions:readonly (readonly [number,number,number])[]=Array.from({length:24},(_,i)=>{
 const layer=Math.floor(i/12),row=Math.floor((i%12)/3),col=i%3;return [-.45+row*.3,(col-1)*.4,layer?.9:.16] as const;
});
// Longitudinal rails, crossmembers, uprights and diagonal braces form one network.
const links: [number,number][]=[];
for(let i=0;i<crashPositions.length;i++)for(let j=i+1;j<crashPositions.length;j++){
 const a=crashPositions[i],b=crashPositions[j],x=Math.abs(a[0]-b[0]),y=Math.abs(a[1]-b[1]),z=Math.abs(a[2]-b[2]);
 if(x>.301||y>.401||z>.741)continue;
 const axes=Number(x>.01)+Number(y>.01)+Number(z>.01);
 if(axes===1||axes===2&&z<.01||axes===2&&y<.01)links.push([i,j]);
}
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
function fresh():CrashLattice{return {version:2,nodes:crashPositions.map(([x,y,z])=>({x,y,z,restX:x,restY:y,restZ:z,vx:0,vy:0,vz:0})),active:0,linkDamage:links.map(()=>0)};}
/** Convert the earlier six-node saved chassis without discarding permanent crush. */
export function upgradeLattice(old:CrashLattice|undefined):CrashLattice{
 if(old?.version===2&&old.nodes.length===crashPositions.length&&old.nodes.every(n=>[n.x,n.y,n.z,n.restX,n.restY,n.restZ,n.vx,n.vy,n.vz].every(Number.isFinite)))return old;
 const out=fresh();if(old?.nodes?.length===6){for(const n of out.nodes){let dx=0,dy=0,total=0;for(let i=0;i<6;i++){const previous=old.nodes[i],bx=[-.42,-.42,0,0,.42,.42][i],by=i%2?.4:-.4;if(!previous||![previous.restX,previous.restY].every(Number.isFinite))continue;const weight=Math.exp(-((n.restX-bx)**2+(n.restY-by)**2)*8);dx+=(previous.restX-bx)*weight;dy+=(previous.restY-by)*weight;total+=weight;}if(total){n.x=n.restX+=dx/total;n.y=n.restY+=dy/total;}}}return out;
}
export function strikeLattice(lattice:CrashLattice|undefined,x:number,y:number,nx:number,ny:number,energy:number):CrashLattice {
 const state=upgradeLattice(lattice);state.linkDamage??=links.map(()=>0);
 for(let i=0;i<state.nodes.length;i++){const n=state.nodes[i],base=crashPositions[i],dist=(base[0]-x)**2+(base[1]-y)**2,weight=Math.exp(-dist*9)*energy*(base[2]>.5?.55:1),crush=Math.max(0,weight-.1)*.055;
  n.restX=clamp(n.restX-nx*crush,base[0]-.16,base[0]+.16);n.restY=clamp(n.restY-ny*crush,base[1]-.16,base[1]+.16);
  n.restZ=clamp((n.restZ??base[2])-crush*(base[2]>.5?.2:.03),base[2]-.09,base[2]+.06);
  n.vx=clamp(n.vx-nx*weight*1.25,-2,2);n.vy=clamp(n.vy-ny*weight*1.25,-2,2);n.vz=clamp((n.vz??0)+weight*(base[2]>.5?-.3:.15),-1,1);
 }
 for(let i=0;i<links.length;i++){const [a,b]=links[i],pa=crashPositions[a],pb=crashPositions[b],mx=(pa[0]+pb[0])*.5,my=(pa[1]+pb[1])*.5,w=Math.exp(-((mx-x)**2+(my-y)**2)*9)*energy;state.linkDamage[i]=clamp((state.linkDamage[i]??0)+Math.max(0,w-.25)*.32,0,1);}
 state.active=2;return state;
}
/** A damaged link loses stiffness; normalized permanent rest positions remain in saved data. */
export function stepLattice(state:CrashLattice,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0||state.active<=0||state.version!==2||state.nodes.length!==crashPositions.length)return;
 const elapsed=Math.min(.05,dt),count=Math.max(1,Math.ceil(elapsed*120)),h=elapsed/count;
 state.linkDamage??=links.map(()=>0);
 for(let step=0;step<count;step++){
  for(let i=0;i<links.length;i++){
   const [ia,ib]=links[i],a=state.nodes[ia],b=state.nodes[ib],dx=b.x-a.x,dy=b.y-a.y,dz=b.z!-a.z!,len=Math.hypot(dx,dy,dz)||.001;
   const rest=Math.hypot(b.restX-a.restX,b.restY-a.restY,b.restZ!-a.restZ!)||.001,strain=Math.abs(len-rest)/rest;
   // Above yield, load permanently shifts the connected nodes and weakens the link.
   // Fully failed links no longer transmit spring force; the remaining links still connect the chassis.
   const excess=Math.max(0,strain-.12),damage=state.linkDamage[i]??0;
   if(excess>0&&damage<1){
    state.linkDamage[i]=clamp(damage+excess*h*.85,0,1);
    const plastic=Math.min(.08,excess*h*.32);
    for(const [node,index] of [[a,ia],[b,ib]] as const){const base=crashPositions[index];node.restX=clamp(node.restX+(node.x-node.restX)*plastic,base[0]-.2,base[0]+.2);node.restY=clamp(node.restY+(node.y-node.restY)*plastic,base[1]-.2,base[1]+.2);node.restZ=clamp(node.restZ!+(node.z!-node.restZ!)*plastic,base[2]-.12,base[2]+.08);}
   }
   const strength=state.linkDamage[i]>=.98?0:1-state.linkDamage[i]*.9,force=clamp((len-rest)*18*strength,-2,2)*h,fx=dx/len*force,fy=dy/len*force,fz=dz/len*force;
   a.vx+=fx;a.vy+=fy;a.vz!+=fz;b.vx-=fx;b.vy-=fy;b.vz!-=fz;
  }
  for(const n of state.nodes){n.vx+=(n.restX-n.x)*8*h;n.vy+=(n.restY-n.y)*8*h;n.vz!+=(n.restZ!-n.z!)*8*h;const damping=Math.exp(-5*h);n.vx*=damping;n.vy*=damping;n.vz!*=damping;n.x=clamp(n.x+n.vx*h,n.restX-.18,n.restX+.18);n.y=clamp(n.y+n.vy*h,n.restY-.18,n.restY+.18);n.z=clamp(n.z!+n.vz!*h,n.restZ!-.12,n.restZ!+.12);}
 }
 state.active=Math.max(0,state.active-dt);if(state.active===0)for(const n of state.nodes){n.x=n.restX;n.y=n.restY;n.z=n.restZ;n.vx=n.vy=n.vz=0;}
}
/** Mean rail failure is deliberately bounded to avoid making a damaged car undriveable. */
export function latticeFailure(state:CrashLattice|undefined):number {if(!state?.linkDamage?.length)return 0;return clamp(state.linkDamage.reduce((sum,n)=>sum+(Number.isFinite(n)?clamp(n,0,1):0),0)/state.linkDamage.length,0,1);}
