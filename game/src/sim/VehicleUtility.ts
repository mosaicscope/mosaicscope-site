import type { Vehicle } from '../entities/types';
import { VEHICLES } from '../content/vehicles';
import { clamp } from '../core/math';

export type UtilityKind='expedition'|'equipment'|'timber'|'freight'|'roadwork'|'refrigerated'|'electriccargo'|'tow'|'ambulance'|'fire'|'tanker'|'refuse'|'police'|'passenger'|'electricbus'|'aggregate';
export interface UtilitySpec {kind:UtilityKind;capacity:number;defaultLoad:number;loadHeight:number;diesel:boolean;beacon:boolean}
export interface UtilityState {payload:number;brakeHeat:number;sway:number;swayVelocity:number;loadShift:number;engineLoad:number;airRelease:number}
export interface UtilityDynamics {active:boolean;mass:number;massRatio:number;acceleration:number;braking:number;turnResponse:number;roll:number;grip:number;engineDrag:number;steering:number}
const spec=(kind:UtilityKind,capacity:number,defaultLoad=.35,loadHeight=.45,beacon=false):UtilitySpec=>({kind,capacity,defaultLoad,loadHeight,diesel:true,beacon});
const DEFAULTS:Partial<Record<string,UtilitySpec>>={
 ute:spec('freight',.8),retro_ute:spec('timber',.7),pickup_single:spec('equipment',1),dcute:spec('equipment',1),flatdeck:spec('timber',2),tradie:spec('equipment',1.2),
 van:spec('freight',.9),panelvan:spec('equipment',1.3),stepvan:spec('freight',1.8),microvan:spec('freight',.5),deliveryev:{...spec('electriccargo',1),diesel:false},
 bus:spec('passenger',3,.45,.58),minivan:spec('passenger',.65,.35,.45),minibus:spec('passenger',1),camper:spec('expedition',.7,.5,.7),
 tow:spec('tow',1.6,.25,.5,true),fire:spec('fire',2.2,.8,.6,true),bin:spec('refuse',3,.55,.62,true),ambulance:spec('ambulance',.65,.7,.4,true),
 ranger:spec('expedition',.7,.25,.4),fourby:spec('expedition',.7,.2,.4),offroad_wagon:spec('expedition',.6,.2,.4),icecream:spec('refrigerated',.8,.65,.55),post:spec('freight',.5,.4,.4),
};
export function utilitySpec(v:Vehicle):UtilitySpec|undefined {const d=VEHICLES[v.cls];return d.design?.utility??DEFAULTS[d.design?.base??v.cls];}
export function utilityState(v:Vehicle):UtilityState|undefined {
 const s=utilitySpec(v);if(!s)return;
 return v.utility??={payload:s.capacity*s.defaultLoad,brakeHeat:0,sway:0,swayVelocity:0,loadShift:0,engineLoad:0,airRelease:0};
}
/** Explicit loading, including compatibility with old saves that have no utility state. */
export function setPayload(v:Vehicle,tonnes:number):number {
 const s=utilitySpec(v),state=utilityState(v);if(!s||!state)return 0;
 state.payload=clamp(Number.isFinite(tonnes)?tonnes:0,0,s.capacity);return state.payload;
}

/** Local physical modifiers; ordinary passenger cars retain their existing tuning exactly. */
export function utilityDynamics(v:Vehicle):UtilityDynamics {
 const d=VEHICLES[v.cls],s=utilitySpec(v);
 if(!s)return {active:false,mass:d.mass,massRatio:1,acceleration:1,braking:1,turnResponse:1,roll:1,grip:1,engineDrag:0,steering:1};
 const state=utilityState(v)!,payload=clamp(state.payload,0,s.capacity),ratio=1+payload/Math.max(.1,d.mass),fill=payload/Math.max(.1,s.capacity);
 const heat=clamp(state.brakeHeat,0,1),liquid=s.kind==='tanker'||s.kind==='fire';
 return {active:true,mass:d.mass+payload,massRatio:ratio,acceleration:1/ratio,braking:Math.pow(ratio,-.6)*(1-Math.max(0,heat-.55)*.6),turnResponse:1/Math.sqrt(ratio),roll:1+fill*s.loadHeight*.65,grip:1-fill*s.loadHeight*.07-(liquid?Math.abs(state.sway)*.08:0),engineDrag:s.diesel?.16+fill*.12:.08,steering:clamp(1-(d.length-2.3)*.075,.78,1)};
}

/** Damped load motion in seconds. Bounded substeps keep fluid slosh stable across tick rates. */
export function stepUtility(v:Vehicle,acceleration:number,lateralAcceleration:number,speed:number,braking:boolean,dt:number):void {
 const s=utilitySpec(v),u=utilityState(v);if(!s||!u||dt<=0||!Number.isFinite(dt))return;
 const total=Math.min(dt,.25),steps=Math.ceil(total/(1/120)),h=total/steps,fill=clamp(u.payload/Math.max(.1,s.capacity),0,1);
 const liquid=s.kind==='tanker'||s.kind==='fire',slosh=liquid?4*fill*(1-fill):.18*fill;
 for(let i=0;i<steps;i++) {
   const target=clamp(-lateralAcceleration*.035*s.loadHeight*slosh,-.24,.24);
   u.swayVelocity+=(target-u.sway)*28*h-u.swayVelocity*(liquid?5:9)*h;
   u.sway=clamp(u.sway+u.swayVelocity*h,-.28,.28);
 }
 const work=braking?Math.abs(acceleration*speed)*(1+u.payload/Math.max(.1,VEHICLES[v.cls].mass))*.004:0;
 u.brakeHeat=clamp(u.brakeHeat+(work-.025-Math.abs(speed)*.006)*total,0,1);
 u.loadShift+=(clamp(-acceleration*.012*fill,-.08,.08)-u.loadShift)*(1-Math.exp(-dt*5));
 u.engineLoad=clamp(Math.abs(v.driveThrottle??0)*(1+fill*.4),0,1);
 const wasMoving=Math.abs(speed)>.5;
 u.airRelease=wasMoving?1:Math.max(0,u.airRelease-dt*2);
}

/** Diesel and electric working fleets use their own rev envelope rather than sports-car redlines. */
export function utilityRevRange(v:Vehicle):{idle:number;redline:number}|undefined {
 const s=utilitySpec(v);return s?s.diesel?{idle:700,redline:3600}:{idle:900,redline:7000}:undefined;
}
