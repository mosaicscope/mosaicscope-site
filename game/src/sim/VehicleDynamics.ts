import {VEHICLES} from '../content/vehicles';
import type {Vehicle} from '../entities/types';
import {clamp} from '../core/math';
import {handlingProfile} from './VehicleHandling';

export interface WheelDynamics { pressure:number; temperature:number; wear:number; brakeHeat:number; load:number; travel:number; slip:number; water:number; rotation:number }
export interface DrivingDynamics { wheels:WheelDynamics[]; longitudinalLoad:number; lateralLoad:number; brakeFade:number; aquaplaning:number }
const wheel=():WheelDynamics=>({pressure:1,temperature:.4,wear:0,brakeHeat:0,load:.25,travel:0,slip:0,water:0,rotation:0});
export function drivingDynamics(v:Vehicle):DrivingDynamics {const d=v.dynamics;if(d&&[d.longitudinalLoad,d.lateralLoad,d.brakeFade,d.aquaplaning].every(Number.isFinite)&&Array.isArray(d.wheels)&&d.wheels.length===4&&d.wheels.every(w=>w&&[w.pressure,w.temperature,w.wear,w.brakeHeat,w.load,w.travel,w.slip,w.water,w.rotation].every(Number.isFinite)))return d;return v.dynamics={wheels:Array.from({length:4},wheel),longitudinalLoad:0,lateralLoad:0,brakeFade:0,aquaplaning:0};}
/** Each contact patch has its own pressure, wear, temperature and water-film grip. */
export function wheelGrip(v:Vehicle,index:number):number{const w=v.dynamics?.wheels[index];if(!w)return 1;const pressure=clamp(w.pressure,0,1),wear=clamp(w.wear,0,1),heat=clamp(w.temperature,0,1);return clamp((.75+.25*pressure)*(1-wear*.2)*(1-Math.max(0,heat-.7)*.35)*(1-clamp(w.water,0,1)*.28),.35,1.05);}
/** Road-mode assists respond smoothly; Sport/Drift keep less intervention. */
export function dynamicsEffects(v:Vehicle){const d=v.dynamics;if(!d)return{braking:1,steering:1,pull:0,brakePull:0,drag:0,differential:1,roll:0,pitch:0};const w=d.wheels,front=(w[0].pressure+w[1].pressure)/2,left=(w[0].pressure+w[2].pressure)/2,right=(w[1].pressure+w[3].pressure)/2,average=w.reduce((n,x)=>n+x.pressure,0)/4,fade=w.reduce((n,x)=>n+Math.max(0,x.brakeHeat-.55),0)/4;const profile=handlingProfile(v.cls),drive=profile.drive==='fwd'?[0,1]:profile.drive==='rwd'?[2,3]:[0,1,2,3],weak=Math.min(...drive.map(i=>wheelGrip(v,i))),leftHeat=(w[0].brakeHeat+w[2].brakeHeat)/2,rightHeat=(w[1].brakeHeat+w[3].brakeHeat)/2;
 return{braking:clamp(1-fade*.45,.7,1),steering:clamp(.8+front*.2,.8,1),pull:clamp((right-left)*.05,-.05,.05),brakePull:clamp((rightHeat-leftHeat)*.025,-.025,.025),drag:(1-average)*.35,differential:clamp(.65+.35*weak,.77,1),roll:clamp((w[1].travel+w[3].travel-w[0].travel-w[2].travel)*.025,-.04,.04),pitch:clamp((w[2].travel+w[3].travel-w[0].travel-w[1].travel)*.025,-.04,.04)};}
/** Bounded, frame-rate-independent tyre and load state. Values use game units, not manufacturer data. */
export function stepDrivingDynamics(v:Vehicle,speed:number,lateral:number,acceleration:number,rain:number,brake:number,handbrake:boolean,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0)return;const d=drivingDynamics(v),h=Math.min(.25,dt),profile=handlingProfile(v.cls),velocity=Math.abs(speed),wet=clamp(rain,0,1),long=clamp(acceleration*.025,-.14,.14),lat=clamp((v.yaw??0)*speed*.035,-.13,.13);d.longitudinalLoad+=(long-d.longitudinalLoad)*(1-Math.exp(-h*7));d.lateralLoad+=(lat-d.lateralLoad)*(1-Math.exp(-h*7));let fade=0,water=0;
 for(let i=0;i<4;i++){const w=d.wheels[i],front=i<2,side=i%2===0?-1:1,damage=v.components?.wheels[i],driven=profile.drive==='awd'||(profile.drive==='fwd'?front:!front),demand=clamp(Math.abs(lateral)/Math.max(2,velocity)+Math.abs(v.wheelspin??0)*(driven?.14:.02)+(handbrake&&!front?.55:0),0,1);
  const targetLoad=clamp((front?.27:.23)+(front?-d.longitudinalLoad:d.longitudinalLoad)/2+side*d.lateralLoad/2,.04,.46);w.load+=(targetLoad-w.load)*(1-Math.exp(-h*12));const compression=clamp((w.load-.25)*1.8+(damage?.suspension??0)*.12,-.25,.3);w.travel+=(compression-w.travel)*(1-Math.exp(-h*9));w.slip+=(demand-w.slip)*(1-Math.exp(-h*10));
  const punctured=damage?(damage.puncture||damage.missing):(i%2===0?v.flatLeft:v.flatRight);if(punctured)w.pressure=clamp(w.pressure-h*(damage?.missing?.2:.025),0,1);
  const tempTarget=clamp(.35+velocity*.009+w.slip*.42+brake*.12-wet*.12,.15,.95);w.temperature+=(tempTarget-w.temperature)*(1-Math.exp(-h*.18));w.wear=clamp(w.wear+h*velocity*(.000001+w.slip*.000018)*(1+Math.max(0,w.temperature-.7)),0,1);
  const braking=clamp(brake+(handbrake&&!front?.7:0),0,1),base=VEHICLES[v.cls].design?.base??v.cls,electric=['ev','compact_ev','estate_ev','deliveryev'].includes(base),regen=electric&&!handbrake?clamp(velocity/8,0,1)*.3:0,targetHeat=clamp(velocity*braking*(1-regen)*.065*(front?1.1:.85),0,1);w.brakeHeat+=(targetHeat-w.brakeHeat)*(1-Math.exp(-h*(braking?.55:.09)));fade+=Math.max(0,w.brakeHeat-.55)/4;
  const wheelSpeed=handbrake&&!front?0:speed+(driven?(v.wheelspin??0)*Math.sign(v.driveThrottle??0)*.22:0);w.rotation=(w.rotation+wheelSpeed*h)%10000;
  const film=wet*clamp((velocity-10.5)/8,0,1)*(.35+w.wear*.45+(1-w.pressure)*.4);w.water+=(clamp(film,0,1)-w.water)*(1-Math.exp(-h*4));water+=w.water/4;
 }
 d.brakeFade=fade;d.aquaplaning=water;
}
export function resetWheelDynamics(v:Vehicle,index:number,replace:boolean):void{const w=v.dynamics?.wheels[index];if(!w)return;w.pressure=1;if(replace){w.wear=0;w.temperature=.4;w.water=0;}}
