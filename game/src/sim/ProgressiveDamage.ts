import type {Vehicle} from '../entities/types';
import type {VehicleComponents,VehicleDebris} from './VehicleDamage';
import {vehicleGeometry} from './VehicleGeometry';
export interface PaneDamage{bond:number;retained:number;flutter:number;shed:number}
export interface SkinDamage{hinge:number;curl:number;flutter:number;gone:boolean}
export interface HingeMotion{angle:number;velocity:number}
export interface ProgressiveDamage{panes:PaneDamage[];skins:SkinDamage[];age:number;hinges?:HingeMotion[];lastSpeed?:number}
export function progressive(p:VehicleComponents):ProgressiveDamage{return p.progressive??={panes:Array.from({length:4},()=>({bond:1,retained:1,flutter:0,shed:0})),skins:Array.from({length:4},()=>({hinge:1,curl:0,flutter:0,gone:false})),age:0};}
export function damageStage(n:number):number{return n<.12?0:n<.35?1:n<.65?2:n<.9?3:4;}
export function stressAttachments(p:VehicleComponents,zone:number,energy:number):void{if(energy<.06)return;const a=progressive(p),pane=a.panes[zone],skin=a.skins[zone];pane.bond=Math.max(0,pane.bond-Math.max(0,energy-.12)*(zone===0?.5:1));if(zone!==0&&energy>.7)pane.retained=Math.min(pane.retained,.45);skin.hinge=Math.max(0,skin.hinge-Math.max(0,energy-.2)*.65);skin.curl=Math.min(1,skin.curl+energy*.6);}
function fragment(v:Vehicle,zone:number,kind:VehicleDebris['kind'],size:number,curl:number,index:number):void{const p=v.components!;if(p.debris.length>=24)return;const g=vehicleGeometry(v),along=zone<2?(zone===0?1:-1)*g.length*.4:((index%3)-1)*g.length*.18,side=zone>=2?(zone===3?1:-1)*g.width*.5:((index%3)-1)*g.width*.2,c=Math.cos(v.heading),s=Math.sin(v.heading);p.debris.push({kind,x:v.x+c*along-s*side,y:v.y+s*along+c*side,z:g.height*.65,vx:(v.vx??c*v.speed)*.8+Math.cos(index*2.4)*.5,vy:(v.vy??s*v.speed)*.8+Math.sin(index*2.4)*.5,vz:.5+(index%3)*.2,age:0,spin:index*1.7,size,curl,zone,roll:index*.7,pitch:index*.3,spinRate:kind==='glass'?4+index%3:1.5});}
/** Air pressure scales with relative speed squared; laminated fronts retain their bonded edge. */
export function advanceAttachments(v:Vehicle,dt:number):void{const p=v.components,a=p?.progressive;if(!p||!a||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.25,dt);a.age+=dt;const speed=Math.hypot(v.vx??Math.cos(v.heading)*v.speed,v.vy??Math.sin(v.heading)*v.speed),pressure=speed*speed*.0018;
 // Four independent hinges: bonnet, boot and left/right doors. They respond
 // to acceleration, cornering and airflow rather than a renderer-only wobble.
 const hinges=a.hinges??=Array.from({length:4},()=>({angle:0,velocity:0})),previous=Number.isFinite(a.lastSpeed)?a.lastSpeed!:v.speed,accel=Math.max(-25,Math.min(25,(v.speed-previous)/dt)),turn=Math.max(-20,Math.min(20,(v.yaw??0)*v.speed));a.lastSpeed=v.speed;
 const bonds=[p.hood,p.boot??1,p.doorHinges?.[0]??1,p.doorHinges?.[1]??1],gone=[p.hoodGone,p.bootGone,p.doorGone?.[0],p.doorGone?.[1]];
 for(let i=0;i<4;i++){const hinge=hinges[i],bond=bonds[i];if(!hinge||!Number.isFinite(hinge.angle)||!Number.isFinite(hinge.velocity)){hinges[i]={angle:0,velocity:0};continue;}if(bond>=.55||gone[i]){hinge.angle=hinge.velocity=0;continue;}
  const loose=(.55-bond)/.55,wind=pressure*loose*(i===0?2:i===1?1.3:.55),inertia=i<2?(i===0?-accel:accel)*.015:Math.abs(turn)*.018;
  const force=Math.max(-12,Math.min(12,wind+inertia*loose-9*hinge.angle));hinge.velocity=(hinge.velocity+force*dt)*Math.exp(-3*dt);hinge.angle=Math.max(0,Math.min(1.15,hinge.angle+hinge.velocity*dt));if(hinge.angle===0&&hinge.velocity<0)hinge.velocity=0;if(hinge.angle===1.15&&hinge.velocity>0)hinge.velocity*=.2;
 }
 for(let zone=0;zone<4;zone++){const pane=a.panes[zone],skin=a.skins[zone],damage=p.glass[zone];if(damage<.05){pane.bond=pane.retained=1;pane.flutter=pane.shed=0;}else if(damage>.25){const loose=1-pane.bond,stress=pressure*loose*(zone===0?.35:1);pane.flutter=Math.sin(a.age*(6+speed*.3)+zone)*Math.min(.15,stress*.5);pane.retained=Math.max(zone===0&&damage<.95?.25:0,pane.retained-stress*dt);const count=Math.floor((1-pane.retained)*8);while(pane.shed<count){fragment(v,zone,'glass',.025+(pane.shed%3)*.015,0,pane.shed);pane.shed++;}}
 if(p.panels[zone]<.05){skin.hinge=1;skin.curl=skin.flutter=0;skin.gone=false;continue;}if(skin.gone||p.panels[zone]<.5)continue;const loose=Math.max(0,.65-skin.hinge);skin.flutter=Math.sin(a.age*8+zone)*pressure*loose*.18;skin.hinge=Math.max(0,skin.hinge-pressure*loose*dt*.35);if(skin.hinge<.06){skin.gone=true;fragment(v,zone,'metal',.18,skin.curl,zone);}}
}
