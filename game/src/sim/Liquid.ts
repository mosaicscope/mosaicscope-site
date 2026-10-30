/** Bounded local liquid particles and 10×7 surface patches, allocated only near an impact. */
export type LiquidKind='blood'|'vomit'|'water';
export interface LiquidDrop{kind:LiquidKind;x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;ground:boolean;size:number}
export interface WaterPatch{x:number;y:number;height:Float32Array;velocity:Float32Array;age:number}
export class LiquidSystem{
 readonly drops:LiquidDrop[]=[];readonly water:WaterPatch[]=[];
 spray(kind:LiquidKind,x:number,y:number,z:number,vx:number,vy:number,count:number):void{
  for(let i=0;i<Math.min(16,Math.max(0,count));i++){if(this.drops.length>=160)this.drops.shift();const a=i*2.399963,spread=.3+(i%5)*.18;this.drops.push({kind,x,y,z,vx:vx+Math.cos(a)*spread,vy:vy+Math.sin(a)*spread,vz:.5+(i%4)*.25,age:0,ground:false,size:.035+(i%4)*.012});}
 }
 disturb(x:number,y:number,speed:number):void{if(!Number.isFinite(x+y+speed)||speed<=0)return;let p=this.water.find(w=>Math.hypot(w.x-x,w.y-y)<2&&w.age<1);if(!p){if(this.water.length>=4)this.water.shift();p={x,y,height:new Float32Array(70),velocity:new Float32Array(70),age:0};this.water.push(p);}p.velocity[35]-=Math.min(3,speed*.16);p.age=0;this.spray('water',x,y,.15,0,0,Math.min(12,Math.ceil(speed)));}
 step(dt:number):void{if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
  for(const d of this.drops){d.age+=dt;if(d.ground)continue;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vz-=9.8*dt;d.vx*=Math.exp(-dt*.8);d.vy*=Math.exp(-dt*.8);if(d.z<=.02){d.z=.02;d.ground=true;}}
  for(let i=this.drops.length-1;i>=0;i--)if(this.drops[i].age>(this.drops[i].kind==='water'?3:45))this.drops.splice(i,1);
  for(const p of this.water){p.age+=dt;for(let y=0;y<7;y++)for(let x=0;x<10;x++){const i=y*10+x,h=p.height[i],left=p.height[y*10+Math.max(0,x-1)],right=p.height[y*10+Math.min(9,x+1)],up=p.height[Math.max(0,y-1)*10+x],down=p.height[Math.min(6,y+1)*10+x];p.velocity[i]+=(left+right+up+down-4*h)*dt*12;p.velocity[i]*=Math.exp(-dt*1.8);}for(let i=0;i<70;i++)p.height[i]+=p.velocity[i]*dt;}
  for(let i=this.water.length-1;i>=0;i--)if(this.water[i].age>6)this.water.splice(i,1);
 }
}
