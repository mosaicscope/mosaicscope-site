import {VEHICLES} from '../content/vehicles';
import type {Vehicle} from '../entities/types';
import {clamp} from '../core/math';
import {handlingProfile} from './VehicleHandling';
import {vehicleGeometry} from './VehicleGeometry';

export interface WheelDynamics { pressure:number; temperature:number; wear:number; brakeHeat:number; load:number; travel:number; slip:number; water:number; rotation:number; suspensionVelocity?:number; brakeWear?:number }
export interface DrivingDynamics { wheels:WheelDynamics[]; longitudinalLoad:number; lateralLoad:number; brakeFade:number; aquaplaning:number }
const DAMPERS=['fl_damper','fr_damper','rl_damper','rr_damper'] as const,SPRINGS=['fl_spring','fr_spring','rl_spring','rr_spring'] as const;
const wheel=():WheelDynamics=>({pressure:1,temperature:.4,wear:0,brakeHeat:0,load:.25,travel:0,slip:0,water:0,rotation:0});
export function drivingDynamics(v:Vehicle):DrivingDynamics {const d=v.dynamics;if(d&&[d.longitudinalLoad,d.lateralLoad,d.brakeFade,d.aquaplaning].every(Number.isFinite)&&Array.isArray(d.wheels)&&d.wheels.length===4&&d.wheels.every(w=>w&&[w.pressure,w.temperature,w.wear,w.brakeHeat,w.load,w.travel,w.slip,w.water,w.rotation].every(Number.isFinite)))return d;return v.dynamics={wheels:Array.from({length:4},wheel),longitudinalLoad:0,lateralLoad:0,brakeFade:0,aquaplaning:0};}
/** Each contact patch has its own pressure, wear, temperature and water-film grip. */
export function wheelGrip(v:Vehicle,index:number):number{const w=v.dynamics?.wheels[index];if(!w)return 1;const pressure=clamp(w.pressure,0,1),wear=clamp(w.wear,0,1),heat=clamp(w.temperature,0,1);return clamp((.75+.25*pressure)*(1-wear*.2)*(.96+.04*clamp(heat/.4,0,1))*(1-Math.max(0,heat-.7)*.35)*(1-clamp(w.water,0,1)*.28),.35,1.05);}
/** Road-mode assists respond smoothly; Sport/Drift keep less intervention. */
export function dynamicsEffects(v:Vehicle){const d=v.dynamics;if(!d)return{braking:1,steering:1,pull:0,brakePull:0,drag:0,differential:1,roll:0,pitch:0};const w=d.wheels,front=(w[0].pressure+w[1].pressure)/2,left=(w[0].pressure+w[2].pressure)/2,right=(w[1].pressure+w[3].pressure)/2,average=w.reduce((n,x)=>n+x.pressure,0)/4,fade=w.reduce((n,x)=>n+Math.max(0,x.brakeHeat-.55),0)/4;const profile=handlingProfile(v.cls),drive=profile.drive==='fwd'?[0,1]:profile.drive==='rwd'?[2,3]:[0,1,2,3],weak=Math.min(...drive.map(i=>wheelGrip(v,i))),leftHeat=(w[0].brakeHeat+w[2].brakeHeat)/2,rightHeat=(w[1].brakeHeat+w[3].brakeHeat)/2;
 return{braking:clamp(1-fade*.45,.7,1),steering:clamp(.8+front*.2,.8,1),pull:clamp((right-left)*.05,-.05,.05),brakePull:clamp((rightHeat-leftHeat)*.025,-.025,.025),drag:(1-average)*.35,differential:clamp(.65+.35*weak,.77,1),roll:clamp((w[1].travel+w[3].travel-w[0].travel-w[2].travel)*.025,-.04,.04),pitch:clamp((w[2].travel+w[3].travel-w[0].travel-w[1].travel)*.025,-.04,.04)};}
/** Bounded, frame-rate-independent tyre and load state. Values use game units, not manufacturer data. */
export function stepDrivingDynamics(v:Vehicle,speed:number,lateral:number,acceleration:number,rain:number,brake:number,handbrake:boolean,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0)return;const d=drivingDynamics(v),h=Math.min(.25,dt),profile=handlingProfile(v.cls),velocity=Math.abs(speed),wet=clamp(rain,0,1),long=clamp(acceleration*.025,-.14,.14),lat=clamp((v.yaw??0)*speed*.035,-.13,.13);d.longitudinalLoad+=(long-d.longitudinalLoad)*(1-Math.exp(-h*7));d.lateralLoad+=(lat-d.lateralLoad)*(1-Math.exp(-h*7));let fade=0,water=0;const wheelbase=vehicleGeometry(v).wheelbase;
 for(let i=0;i<4;i++){const w=d.wheels[i],front=i<2,side=i%2===0?-1:1,damage=v.components?.wheels[i],driven=profile.drive==='awd'||(profile.drive==='fwd'?front:!front),groundSpeed=v.contactControl?.wheels[i]?.groundSpeed??speed,patchVelocity=Math.abs(groundSpeed),patchLateral=lateral+(v.yaw??0)*(front?1:-1)*wheelbase*.5-(front?Math.tan(v.wheelSteer??0)*groundSpeed:0),demand=clamp(Math.abs(patchLateral)/Math.max(2,patchVelocity)+Math.abs(v.wheelspin??0)*(driven?.14:.02)+(handbrake&&!front?.55:0),0,1);
  const targetLoad=clamp((front?.27:.23)+(front?-d.longitudinalLoad:d.longitudinalLoad)/2+side*d.lateralLoad/2,.04,.46);w.load+=(targetLoad-w.load)*(1-Math.exp(-h*12));const compression=clamp((w.load-.25)*1.8+(damage?.suspension??0)*.12,-.25,.3);
  const damper=v.components?.parts?.[DAMPERS[i]]??0,spring=v.components?.parts?.[SPRINGS[i]]??0;
  const suspensionVelocity=Number.isFinite(w.suspensionVelocity)?w.suspensionVelocity!:0;
  const stiffness=Math.max(20,90*(1-spring*.4)),damping=12*(1-clamp(damper,0,1)*.55),alpha=damping/2,frequency=Math.sqrt(Math.max(.01,stiffness-alpha*alpha));
  const offset=w.travel-compression,b=(suspensionVelocity+alpha*offset)/frequency,decay=Math.exp(-alpha*h),cos=Math.cos(frequency*h),sin=Math.sin(frequency*h);
  w.suspensionVelocity=clamp(decay*((b*frequency-alpha*offset)*cos+(-offset*frequency-alpha*b)*sin),-2,2);w.travel=clamp(compression+decay*(offset*cos+b*sin),-.3,.35);w.slip+=(demand-w.slip)*(1-Math.exp(-h*10));
  const punctured=damage?(damage.puncture||damage.missing):(i%2===0?v.flatLeft:v.flatRight);if(punctured)w.pressure=clamp(w.pressure-h*(damage?.missing?.2:.025),0,1);
  const rough=clamp(v.contactControl?.wheels[i]?.roughness??0,0,1);
  const tempTarget=clamp(.35+patchVelocity*.009+w.slip*.42+brake*.12+rough*.04-wet*.12,.15,.95);w.temperature+=(tempTarget-w.temperature)*(1-Math.exp(-h*.18));w.wear=clamp(w.wear+h*patchVelocity*(.000001+w.slip*.000018)*(1+rough*.5)*(1+Math.max(0,w.temperature-.7)),0,1);
  const braking=clamp(brake+(handbrake&&!front?.7:0),0,1),base=VEHICLES[v.cls].design?.base??v.cls,electric=['ev','compact_ev','estate_ev','deliveryev'].includes(base),regen=electric&&!handbrake?clamp(velocity/8,0,1)*.3:0,targetHeat=clamp(patchVelocity*braking*(1-regen)*.065*(front?1.1:.85)*(1-(v.contactControl?.wheels[i]?.abs??0)*.12),0,1);w.brakeHeat+=(targetHeat-w.brakeHeat)*(1-Math.exp(-h*(braking?.55:.09+wet*.04+velocity*.002)));w.brakeWear=clamp((Number.isFinite(w.brakeWear)?w.brakeWear!:0)+h*patchVelocity*braking*(.000002+Math.max(0,w.brakeHeat-.55)*.000008),0,1);fade+=Math.max(0,w.brakeHeat-.55)/4;
  const contact=v.contactControl?.wheels[i],ground=contact?.groundSpeed??speed,lock=contact?.lock??(handbrake&&!front?1:0);
  const wheelSpeed=ground*(1-lock)+(driven?(v.wheelspin??0)*Math.sign(v.driveThrottle??0)*.22*(1-(contact?.traction??0)*.65):0);w.rotation=(w.rotation+wheelSpeed*h)%10000;
  const film=wet*clamp((patchVelocity-10.5)/8,0,1)*(.35+w.wear*.45+(1-w.pressure)*.4);w.water+=(clamp(film,0,1)-w.water)*(1-Math.exp(-h*4));water+=w.water/4;
 }
 d.brakeFade=fade;d.aquaplaning=water;
}
export function resetWheelDynamics(v:Vehicle,index:number,replace:boolean):void{const w=v.dynamics?.wheels[index];if(!w)return;w.pressure=1;if(replace){w.wear=0;w.temperature=.4;w.water=0;}}
