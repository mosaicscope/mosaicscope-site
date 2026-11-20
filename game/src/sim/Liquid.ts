import {T,type World} from '../world/World';
/** Bounded particles and interacting 10×7 shallow-water surface patches. */
export type LiquidKind='blood'|'vomit'|'water';
export interface LiquidDrop{kind:LiquidKind;x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;ground:boolean;size:number}
export interface WaterPatch{x:number;y:number;height:Float32Array;velocity:Float32Array;foam:Float32Array;age:number}
export class LiquidSystem{
 readonly drops:LiquidDrop[]=[];readonly water:WaterPatch[]=[];
 spray(kind:LiquidKind,x:number,y:number,z:number,vx:number,vy:number,count:number):void{
  for(let i=0;i<Math.min(16,Math.max(0,count));i++){if(this.drops.length>=160)this.drops.shift();const a=i*2.399963,spread=.3+(i%5)*.18;this.drops.push({kind,x,y,z,vx:vx+Math.cos(a)*spread,vy:vy+Math.sin(a)*spread,vz:.5+(i%4)*.25,age:0,ground:false,size:.035+(i%4)*.012});}
 }
 /** A local impulse is distributed to the actual contact location; velocity shapes the wake. */
 disturb(x:number,y:number,speed:number,vx=0,vy=0,splash=true):void{
  if(![x,y,speed,vx,vy].every(Number.isFinite)||speed<=0)return;
  let p=this.water.find(w=>Math.abs(w.x-x)<1.1&&Math.abs(w.y-y)<.7&&w.age<3);
  if(!p){if(this.water.length>=8)this.water.shift();p={x,y,height:new Float32Array(70),velocity:new Float32Array(70),foam:new Float32Array(70),age:0};this.water.push(p);}
  const cx=4.5+(x-p.x)/.35,cy=3+(y-p.y)/.35,mag=Math.min(3,speed*.16),len=Math.hypot(vx,vy)||1;
  for(let row=0;row<7;row++)for(let col=0;col<10;col++){const dx=col-cx,dy=row-cy,dist=dx*dx+dy*dy,weight=Math.exp(-dist*.7);if(weight<.01)continue;const i=row*10+col,tail=Math.max(0,-(dx*vx+dy*vy)/len);p.velocity[i]-=mag*weight*(1+Math.min(.45,tail*.12));p.foam[i]=Math.min(1,p.foam[i]+weight*Math.min(1,speed*.09));}
  p.age=0;if(splash&&speed>1)this.spray('water',x,y,.15,vx*.12,vy*.12,Math.min(12,Math.ceil(speed)));
 }
 /** Bilinear sampling couples the local wave grid to objects and surface lighting. */
 surfaceAt(x:number,y:number):number{
  let result=0;
  for(const p of this.water){const gx=(x-p.x)/.35+4.5,gy=(y-p.y)/.35+3;if(gx<0||gx>9||gy<0||gy>6)continue;
   const x0=Math.floor(gx),y0=Math.floor(gy),x1=Math.min(9,x0+1),y1=Math.min(6,y0+1),fx=gx-x0,fy=gy-y0;
   const a=p.height[y0*10+x0]*(1-fx)+p.height[y0*10+x1]*fx,b=p.height[y1*10+x0]*(1-fx)+p.height[y1*10+x1]*fx;
   result+=(a*(1-fy)+b*fy)*Math.min(1,Math.min(gx,9-gx,gy,6-gy)*2);
  }
  return Math.max(-.35,Math.min(.35,result));
 }
 step(dt:number,world?:World,flow:{x:number;y:number;roughness:number}={x:0,y:0,roughness:0}):void{
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
  for(const d of this.drops){d.age+=dt;if(d.ground){if(d.kind==='water'&&world?.tile(Math.floor(d.x),Math.floor(d.y))===T.WATER){d.x+=flow.x*dt;d.y+=flow.y*dt;}continue;}d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vz-=9.8*dt;d.vx*=Math.exp(-dt*.8);d.vy*=Math.exp(-dt*.8);if(d.z<=.02){d.z=.02;d.ground=true;}}
  for(let i=this.drops.length-1;i>=0;i--)if(this.drops[i].age>(this.drops[i].kind==='water'?3:45))this.drops.splice(i,1);
  const damping=Math.exp(-dt*(1.25+flow.roughness*.3));
  for(const p of this.water){p.age+=dt;
   for(let y=0;y<7;y++)for(let x=0;x<10;x++){const i=y*10+x,h=p.height[i],wx=p.x+(x-4.5)*.35,wy=p.y+(y-3)*.35;
    if(world&&world.tile(Math.floor(wx),Math.floor(wy))!==T.WATER){p.velocity[i]=0;p.height[i]*=.9;p.foam[i]*=.95;continue;}
    const left=p.height[y*10+Math.max(0,x-1)],right=p.height[y*10+Math.min(9,x+1)],up=p.height[Math.max(0,y-1)*10+x],down=p.height[Math.min(6,y+1)*10+x];
    const gradientX=(right-left)*.5,gradientY=(down-up)*.5,lap=left+right+up+down-4*h;
    p.velocity[i]+=(lap*12-(gradientX*flow.x+gradientY*flow.y)*1.8)*dt;p.velocity[i]*=damping;
    p.foam[i]=Math.max(0,Math.min(1,p.foam[i]*Math.exp(-dt*.8)+Math.max(0,Math.abs(lap)-.025)*dt*1.5));
   }
   for(let i=0;i<70;i++)p.height[i]=Math.max(-.35,Math.min(.35,p.height[i]+p.velocity[i]*dt));
  }
  for(let i=this.water.length-1;i>=0;i--)if(this.water[i].age>8)this.water.splice(i,1);
 }
}
