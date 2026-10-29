/** Six mass points and spring links give nearby crash damage a bounded physical response. */
export interface CrashNode {x:number;y:number;restX:number;restY:number;vx:number;vy:number}
export interface CrashLattice {nodes:CrashNode[];active:number;linkDamage?:number[]}
const positions=[[-.42,-.4],[-.42,.4],[0,-.4],[0,.4],[.42,-.4],[.42,.4]] as const;
const links=[[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[4,5],[0,3],[1,2],[2,5],[3,4]] as const;
export function strikeLattice(lattice:CrashLattice|undefined,x:number,y:number,nx:number,ny:number,energy:number):CrashLattice {
 const state=lattice??{nodes:positions.map(([px,py])=>({x:px,y:py,restX:px,restY:py,vx:0,vy:0})),active:0};
 if(state.nodes.length!==positions.length)return strikeLattice(undefined,x,y,nx,ny,energy);
 state.linkDamage??=links.map(()=>0);
 for(let i=0;i<state.nodes.length;i++){const node=state.nodes[i],dist=(positions[i][0]-x)**2+(positions[i][1]-y)**2,weight=Math.exp(-dist*8)*energy;
  // Plastic crush keeps a permanent offset; the original impact calculations
  // still determine component failures, dents and vehicle handling.
  const crush=Math.max(0,weight-.12)*.045;node.restX=Math.max(positions[i][0]-.12,Math.min(positions[i][0]+.12,node.restX-nx*crush));node.restY=Math.max(positions[i][1]-.12,Math.min(positions[i][1]+.12,node.restY-ny*crush));
  node.vx=Math.max(-2,Math.min(2,node.vx-nx*weight*1.4));node.vy=Math.max(-2,Math.min(2,node.vy-ny*weight*1.4));}
 for(let i=0;i<links.length;i++){const [a,b]=links[i],mx=(positions[a][0]+positions[b][0])*.5,my=(positions[a][1]+positions[b][1])*.5,w=Math.exp(-((mx-x)**2+(my-y)**2)*8)*energy;state.linkDamage[i]=Math.min(1,(state.linkDamage[i]??0)+Math.max(0,w-.3)*.4);}
 state.active=2;return state;
}
/** A small damped spring network; permanent crush remains in the existing dent model. */
export function stepLattice(state:CrashLattice,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0||state.active<=0||state.nodes.length!==6)return;const count=Math.max(1,Math.ceil(Math.min(.05,dt)*120)),h=Math.min(.05,dt)/count;
 for(let step=0;step<count;step++){for(let link=0;link<links.length;link++){const [i,j]=links[link],a=state.nodes[i],b=state.nodes[j],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||.001,rest=Math.hypot(b.restX-a.restX,b.restY-a.restY),strength=1-(state.linkDamage?.[link]??0)*.85,force=Math.max(-2,Math.min(2,(length-rest)*20*strength))*h,fx=dx/length*force,fy=dy/length*force;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;}
  for(const n of state.nodes){n.vx+=(n.restX-n.x)*9*h;n.vy+=(n.restY-n.y)*9*h;const damping=Math.exp(-5*h);n.vx*=damping;n.vy*=damping;n.x=Math.max(n.restX-.18,Math.min(n.restX+.18,n.x+n.vx*h));n.y=Math.max(n.restY-.18,Math.min(n.restY+.18,n.y+n.vy*h));}}
 state.active=Math.max(0,state.active-dt);if(state.active===0)for(const n of state.nodes){n.x=n.restX;n.y=n.restY;n.vx=n.vy=0;}
}
