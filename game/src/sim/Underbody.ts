/** A 10×7 flexible underside, created only after an impact. */
export interface UnderbodyPoint {z:number;rest:number;velocity:number;damage:number}
export interface UnderbodyState {points:UnderbodyPoint[];active:number}
export function strikeUnderbody(state:UnderbodyState|undefined,x:number,y:number,energy:number):UnderbodyState{
 const out=state?.points?.length===70?state:{points:Array.from({length:70},()=>({z:0,rest:0,velocity:0,damage:0})),active:0};
 for(let i=0;i<70;i++){const px=-.45+(i%10)*.1,py=-.4+Math.floor(i/10)*(.8/6),w=Math.exp(-((px-x)**2+(py-y)**2)*12)*Math.max(0,energy-.08),p=out.points[i];p.rest=Math.max(-.18,p.rest-w*.035);p.velocity=Math.max(-1,p.velocity-w*.7);p.damage=Math.min(1,p.damage+w*.3);}
 out.active=2;return out;
}
export function stepUnderbody(s:UnderbodyState,dt:number):void{if(s.points?.length!==70||s.active<=0||!Number.isFinite(dt)||dt<=0)return;const h=Math.min(dt,.025),p=s.points;
 for(let i=0;i<70;i++){const x=i%10,y=Math.floor(i/10),n=p[i],left=p[y*10+Math.max(0,x-1)],right=p[y*10+Math.min(9,x+1)],up=p[Math.max(0,y-1)*10+x],down=p[Math.min(6,y+1)*10+x];n.velocity+=((left.z+right.z+up.z+down.z-4*n.z)*9+(n.rest-n.z)*8)*h;n.velocity*=Math.exp(-h*5);}
 for(const n of p)n.z=Math.max(-.3,Math.min(.12,n.z+n.velocity*h));s.active=Math.max(0,s.active-dt);if(!s.active)for(const n of p){n.z=n.rest;n.velocity=0;}
}
export function underbodyDamage(s:UnderbodyState|undefined):number{return s?.points?.length===70?s.points.reduce((sum,p)=>sum+(Number.isFinite(p.damage)?p.damage:0),0)/70:0;}
