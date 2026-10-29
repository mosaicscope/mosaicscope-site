/** Six mass points and spring links give nearby crash damage a bounded physical response. */
export interface CrashNode {x:number;y:number;restX:number;restY:number;vx:number;vy:number}
export interface CrashLattice {nodes:CrashNode[];active:number}
const positions=[[-.42,-.4],[-.42,.4],[0,-.4],[0,.4],[.42,-.4],[.42,.4]] as const;
const links=[[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[4,5],[0,3],[1,2],[2,5],[3,4]] as const;
export function strikeLattice(lattice:CrashLattice|undefined,x:number,y:number,nx:number,ny:number,energy:number):CrashLattice {
 const state=lattice??{nodes:positions.map(([px,py])=>({x:px,y:py,restX:px,restY:py,vx:0,vy:0})),active:0};
 for(const node of state.nodes){const dist=(node.x-x)**2+(node.y-y)**2,weight=Math.exp(-dist*8)*energy;node.vx=Math.max(-2,Math.min(2,node.vx-nx*weight*1.4));node.vy=Math.max(-2,Math.min(2,node.vy-ny*weight*1.4));}
 state.active=2;return state;
}
/** A small damped spring network; permanent crush remains in the existing dent model. */
export function stepLattice(state:CrashLattice,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0||state.active<=0||state.nodes.length!==6)return;const count=Math.max(1,Math.ceil(Math.min(.05,dt)*120)),h=Math.min(.05,dt)/count;
 for(let step=0;step<count;step++){for(const [i,j] of links){const a=state.nodes[i],b=state.nodes[j],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||.001,rest=Math.hypot(b.restX-a.restX,b.restY-a.restY),force=Math.max(-2,Math.min(2,(length-rest)*20))*h,fx=dx/length*force,fy=dy/length*force;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;}
  for(const n of state.nodes){n.vx+=(n.restX-n.x)*9*h;n.vy+=(n.restY-n.y)*9*h;const damping=Math.exp(-5*h);n.vx*=damping;n.vy*=damping;n.x=Math.max(n.restX-.18,Math.min(n.restX+.18,n.x+n.vx*h));n.y=Math.max(n.restY-.18,Math.min(n.restY+.18,n.y+n.vy*h));}}
 state.active=Math.max(0,state.active-dt);if(state.active===0)for(const n of state.nodes){n.x=n.restX;n.y=n.restY;n.vx=n.vy=0;}
}
