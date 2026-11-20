import type { Vehicle } from "../entities/types";
import { VEHICLES } from "../content/vehicles";
import { clamp } from "../core/math";
import { handlingProfile } from "./VehicleHandling";
import {utilityRevRange,utilitySpec} from './VehicleUtility';

export type DriveMode="road"|"sport"|"drift"|"trail";
export type AssistMode='auto'|'on'|'sport'|'off';
export const ASSIST_LABELS:Record<AssistMode,string>={auto:'Auto',on:'On',sport:'Sport',off:'Off'};
export function cycleDriverAssists(v:Vehicle):AssistMode {
 const modes:AssistMode[]=['auto','on','sport','off'],index=modes.indexOf(v.assistMode??'auto');
 return v.assistMode=modes[(index+1)%modes.length];
}
/** Auto follows the selected drive mode; explicit choices persist per vehicle. */
export function driverAssists(v:Vehicle):{abs:boolean;traction:boolean;stability:boolean} {
 const mode=v.assistMode??'auto',automatic=drivingSetup(v).tractionControl;
 if(mode==='on')return {abs:true,traction:true,stability:true};
 if(mode==='sport')return {abs:true,traction:false,stability:true};
 if(mode==='off')return {abs:false,traction:false,stability:false};
 return {abs:automatic,traction:automatic,stability:automatic};
}
export interface PowertrainState { gear:number; rpm:number; shift:number }
export interface DriftState { points:number; best:number; chain:number; grace:number; angle:number }
const MODES:DriveMode[]=["road","sport","drift","trail"];
const GEAR_LIMITS=[.3,.49,.69,.9,1.1];
export const DRIVE_MODE_LABELS:Record<DriveMode,string>={road:"Road",sport:"Sport",drift:"Drift",trail:"Trail"};

export function cycleDriveMode(v:Vehicle):DriveMode {
  const modes=handlingProfile(v.cls).offroad?MODES:MODES.filter(m=>m!=="trail");
  v.driveMode=modes[(modes.indexOf(v.driveMode??"road")+1)%modes.length];return v.driveMode;
}

/** Mode changes tune driver aids and axle balance; surface grip stays a physical limit. */
export function drivingSetup(v:Vehicle) {
  const mode=v.driveMode??"road",profile=handlingProfile(v.cls);
  return {
    response:mode==="sport"||mode==="drift"?18:mode==="trail"?8:16,
    rearSlip:mode==="drift"?1.15:mode==="sport"?.8:.25,
    steer:mode==="drift"?1.12:mode==="trail"?1.08:1,
    torque:mode==="trail"&&profile.offroad?0.85:1,
    range:mode==="trail"&&profile.offroad?0.65:1,
    shiftAt:mode==="sport"||mode==="drift"?0.96:mode==="trail"?0.78:0.88,
    tractionControl:mode==="road"||mode==="trail",
  };
}

/** Automatic transmission with shift hysteresis and an actual torque interruption. */
export function supportsManual(v:Vehicle):boolean {
  const base=VEHICLES[v.cls].design?.base??v.cls,utility=utilitySpec(v);
  return !['ev','compact_ev','estate_ev','deliveryev','bicycle','ebike','escooter'].includes(base)&&utility?.kind!=='electriccargo'&&utility?.kind!=='electricbus';
}
/** Manual mode keeps the selected gear; reverse is still selected by the reverse pedal at rest. */
export function setManualTransmission(v:Vehicle,manual:boolean):boolean {
  if(manual&&!supportsManual(v))return false;
  v.manualTransmission=manual;return true;
}
export function manualGearLimit(v:Vehicle,top:number):number {
  if(!v.manualTransmission||!supportsManual(v)||(v.powertrain?.gear??1)<1)return top;
  const gear=clamp(v.powertrain?.gear??1,1,5);return Math.max(.1,top*GEAR_LIMITS[gear-1]);
}
/** Refuse shifts while the clutch is engaged and unsafe downshifts above redline. */
export function shiftManual(v:Vehicle,direction:1|-1,speed:number,top:number):boolean {
  if(!v.manualTransmission||!supportsManual(v))return false;
  const p=v.powertrain??={gear:1,rpm:900,shift:0};
  if(p.shift>0||!Number.isFinite(speed)||speed<-.08||!Number.isFinite(top)||top<=0)return false;
  const current=clamp(p.gear,1,5),next=clamp(current+direction,1,5);
  if(next===current||(direction<0&&Math.abs(speed)>top*GEAR_LIMITS[next-1]*.98))return false;
  p.gear=next;p.shift=.09+(v.components?.structure?.gearbox??0)*.3;return true;
}

export function stepPowertrain(v:Vehicle,speed:number,top:number,pedal:number,dt:number):number {
  const base=VEHICLES[v.cls].design?.base??v.cls;
  const utility=utilitySpec(v),range=utilityRevRange(v),idle=range?.idle??900,redline=range?.redline??7000;
  const single=["ev","compact_ev","estate_ev","deliveryev","bicycle","ebike","escooter"].includes(base)||utility?.kind==='electriccargo'||utility?.kind==='electricbus';
  const setup=drivingSetup(v),p=v.powertrain??={gear:1,rpm:idle,shift:0};
  p.shift=Math.max(0,p.shift-dt);
  if(speed < -0.08 || Math.abs(speed)<0.08 && pedal<0) p.gear=-1;
  else if(p.gear<1) p.gear=1;
  if(single)p.gear=speed<-.08?-1:1;
  const s=Math.abs(speed)/Math.max(0.1,top),gear=clamp(p.gear,1,5);
  let rev=s/(p.gear<0?.35:single?1.1:GEAR_LIMITS[gear-1]);
  if(!single&&!v.manualTransmission&&p.gear>0&&p.shift===0) {
    if(rev>setup.shiftAt&&p.gear<5) {p.gear++;p.shift=.09+(v.components?.structure?.gearbox??0)*.3;}
    else if(p.gear>1&&(rev<.3||pedal>.75&&rev<.52&&s/GEAR_LIMITS[p.gear-2]<setup.shiftAt*.95)) {p.gear--;p.shift=.08+(v.components?.structure?.gearbox??0)*.3;}
    rev=s/GEAR_LIMITS[p.gear-1];
  }
  const target=idle+clamp(rev+Math.min(.18,(v.wheelspin??0)*.035)+Math.abs(pedal)*.06,0,1)*(redline-idle);
  p.rpm+=(target-p.rpm)*(1-Math.exp(-dt*15));
  // Lower forward gears multiply wheel torque; a kickdown changes acceleration as well as engine sound.
  const gearTorque=1+(5-clamp(p.gear,1,5))*.06;
  return single?1:(p.shift>0?.8:0.94+Math.sin(clamp((p.rpm-idle)/(redline-idle),0,1)*Math.PI)*.1)*gearTorque;
}

/** Shared by engine audio: correctly normalizes diesel, electric and passenger-car rev envelopes. */
export function engineRevFraction(v:Vehicle):number {const range=utilityRevRange(v),idle=range?.idle??900,top=range?.redline??7000;return clamp(((v.powertrain?.rpm??idle)-idle)/(top-idle),0,1);}

/** Rewards distance travelled in a controlled slide. Spins, crashes and stationary burnouts cannot score. */
export function stepDrift(v:Vehicle,distance:number,dt:number):void {
  const d=v.drift??={points:0,best:0,chain:0,grace:0,angle:0};
  d.angle=Math.abs(Math.atan2(v.slip??0,Math.max(.01,Math.abs(v.speed))))*180/Math.PI;
  const valid=v.state==="free"&&Math.abs(v.speed)>3&&d.angle>8&&d.angle<65&&distance>dt*.5;
  if(valid) {
    d.chain+=dt;d.grace=1;
    d.points+=distance*d.angle*(1+Math.min(3,Math.floor(d.chain/2)));
  } else {
    d.grace=Math.max(0,d.grace-dt);
    if(!d.grace){d.best=Math.max(d.best,Math.round(d.points));d.points=0;d.chain=0;}
  }
}

/** Mild, gear-dependent lift-off drag; electric vehicles use speed-dependent regeneration. */
export function coastResistance(v:Vehicle,speed:number,pedal:number,braking:boolean):number {
 if(braking||Math.abs(pedal)>.02||Math.abs(speed)<.3)return 0;
 const base=VEHICLES[v.cls].design?.base??v.cls,utility=utilitySpec(v);
 if(['bicycle','ebike','escooter'].includes(base))return 0;
 if(['ev','compact_ev','estate_ev','deliveryev'].includes(base)||utility?.kind==='electriccargo'||utility?.kind==='electricbus')
  return .18*clamp(Math.abs(speed)/4,0,1);
 const gear=Math.max(1,v.powertrain?.gear??1),rpm=engineRevFraction(v),mode=v.driveMode??'road';
 return clamp((.055+.07*rpm)*(1.2-.1*Math.min(gear,5))*(mode==='sport'?1.2:1)*clamp(Math.abs(speed)/2,0,1),0,.18);
}
