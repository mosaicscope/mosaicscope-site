import type {Vehicle} from '../entities/types';
import {damagedParts} from './VehicleParts';
const bounded=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,Math.min(1,n!)):0;
/** Read existing state without allocating simulation components. */
export function vehicleCondition(v:Vehicle){
 const c=v.components,s=c?.structure;
 const wheel=(i:number)=>{const w=c?.wheels[i],d=v.dynamics?.wheels[i];return Math.max(w?.missing||w?.puncture?1:0,bounded(w?.rim),bounded(w?.suspension),d?1-bounded(d.pressure):0)};
 const zones=[Math.max(bounded(c?.panels[0]),bounded(v.dmgF),bounded(v.engineDamage)),Math.max(bounded(c?.panels[2]),bounded(v.dmgL)),Math.max(bounded(c?.panels[3]),bounded(v.dmgS)),Math.max(bounded(c?.panels[1]),bounded(v.dmgR))];
 const wheels=[wheel(0),wheel(1),wheel(2),wheel(3)],issues=damagedParts(v),engine=bounded(v.engineDamage),heat=bounded(v.heat);
 let forecast='No timed breakdown is currently predicted.';
 if(v.burnt)forecast='Vehicle disabled by fire.';
 else if(v.burning)forecast=`Fire: about ${Math.max(0,Math.ceil(12-(v.burnTime??0)))} s until the vehicle burns out.`;
 else if(engine>.65&&v.driver>=0&&Math.abs(v.speed)>.5)forecast=`Fire risk: about ${Math.ceil((1-heat)/.015+12)} s until burnout if current movement and damage continue. Stop to cool down.`;
 else if(engine>.65)forecast='Engine badly damaged: moving will build heat. Stop and repair.';
 const worst=Math.max(...zones,...wheels,engine,bounded(s?.gearbox),bounded(s?.temperature));
 return {zones,wheels,engine,issues,forecast,worst,oil:s?.oil??1,coolant:s?.coolant??1,temperature:s?.temperature??0,gearbox:s?.gearbox??0};
}
