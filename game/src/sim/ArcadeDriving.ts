import type {Vehicle} from '../entities/types';
import {VEHICLES} from '../content/vehicles';
import {utilitySpec} from './VehicleUtility';
import {clamp} from '../core/math';
/** Player/free-drive tuning only. Traffic retains its mapped road speeds and braking rules. */
export function arcadeDriving(v:Vehicle,posted:number){const d=VEHICLES[v.cls],base=d.design?.base??v.cls,cycle=['bicycle','ebike','escooter'].includes(base),heavy=(utilitySpec(v)?.capacity??0)>=2,highway=Number.isFinite(posted)&&posted>10;
 const gearing=cycle?1:heavy?1.08:highway?1.55:1.15;
 const missing=v.components?.wheels.filter(w=>w.missing).length??0,bodyLoss=Math.max(0,v.damage-.45)*.12,rollingCondition=Math.max(.25,1-missing*.3)*(v.flatLeft||v.flatRight?.82:1);
 return{top:d.topSpeed*gearing*(1-bodyLoss)*rollingCondition,launch:cycle?1:heavy?1.12:(v.driveMode==='sport'?1.5:v.driveMode==='drift'?1.4:1.35),steerResponse:cycle?1:1.3,frontLoad:cycle?.48:.6};}
/** Full torque is retained through the useful rev range; only the last 18% tapers to its target. */
export function powerEnvelope(speed:number,top:number):number{return clamp((top-Math.abs(speed))/Math.max(.1,top*.18),0,1);}
/** Worn bodywork pulls less than a damaged steering rack; assistance fades with actual speed. */
export function damagePull(v:Vehicle,speed:number,structuralPull:number):number{const w=v.components?.wheels;return clamp(structuralPull+((v.dmgS??0)-(v.dmgL??0))*.045+(w?.[0].alignment??0)*.2+(w?.[1].alignment??0)*.2,-.22,.22)/(1+Math.abs(speed)*.09);}

/** Shared speed envelope for physics and shift safety, including heavy modifications. */
export function drivingTopSpeed(v:Vehicle,baseTop:number,range:number):number {
 const mods=v.lifeMods??[],heavy=mods.filter(m=>['Limousine chassis','Double deck','Hearse body'].includes(m)).length;
 return Math.max(.1,baseTop*range*(mods.includes('Tractor engine')?1.2:1)/(1+heavy*.035));
}
