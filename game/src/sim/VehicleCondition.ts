import {ENGINE_COMPONENTS} from './EngineComponents';
import type {Vehicle} from '../entities/types';
import {damagedParts,partsEffects} from './VehicleParts';
import {structuralDynamics} from './VehicleStructure';
const bounded=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,Math.min(1,n!)):0;
/** Read existing state without allocating simulation components. */
export function vehicleCondition(v:Vehicle){
 const c=v.components,s=c?.structure;
 const wheel=(i:number)=>{const w=c?.wheels[i],d=v.dynamics?.wheels[i];return Math.max(w?.missing||w?.puncture||(!w&&(i%2===0?v.flatLeft:v.flatRight))?1:0,bounded(w?.rim),bounded(w?.suspension),w?1-bounded(w.attachment??1):0,d?1-bounded(d.pressure):0)};
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

/** Inspection details describe tracked simulation state rather than inferred component failures. */
export function vehicleInspection(v:Vehicle){
 const c=v.components,s=c?.structure,condition=vehicleCondition(v),effects=partsEffects(v),structure=structuralDynamics(v);
 const pct=(n:number)=>Math.round(bounded(n)*100)+'%';
 const wheels=['Front left','Front right','Rear left','Rear right'].map((name,i)=>{const w=c?.wheels[i],d=v.dynamics?.wheels[i],faults:string[]=[];
  if(w?.missing)faults.push('missing');else if(w&&(w.attachment??1)<.65)faults.push('hanging; mount '+pct(w.attachment??1)+' intact');if(!w?.missing&&(w?.puncture||(!w&&(i%2===0?v.flatLeft:v.flatRight))))faults.push('punctured');
  if(w&&w.rim>.02)faults.push('rim '+pct(w.rim));if(w&&w.suspension>.02)faults.push('suspension '+pct(w.suspension));
  if(w&&Math.abs(w.alignment)>.01)faults.push('alignment '+Math.round(w.alignment*100)+'%');
  if(d)faults.push('pressure '+pct(d.pressure),'wear '+pct(d.wear),'brake heat '+pct(d.brakeHeat));
  return name+': '+(faults.length?faults.join(' · '):'no faults recorded');});
 const body=['Front','Rear','Left','Right'].map((name,i)=>name+': '+pct(Math.max(bounded(c?.panels[i]),bounded([v.dmgF,v.dmgR,v.dmgL,v.dmgS][i])))+' damage · glass '+pct(c?.glass[i]??0)+' damaged');
 if(c?.doorHinges)for(let i=0;i<2;i++)if(c.doorGone?.[i])body.push((i?'Right':'Left')+' door: detached');else if(c.doorHinges[i]<.55)body.push((i?'Right':'Left')+' door: hanging · hinge '+pct(c.doorHinges[i])+' intact');
 if(c?.bootGone)body.push('Boot lid: detached');else if((c?.boot??1)<.55)body.push('Boot lid: loose · hinge '+pct(c!.boot!)+' intact');
 const mechanical=s?['Radiator '+pct(s.radiator)+' damaged','oil sump '+pct(s.sump)+' damaged','gearbox '+pct(s.gearbox)+' damaged','steering rack '+pct(s.rack)+' damaged','front axle '+pct(s.axles[0])+' damaged','rear axle '+pct(s.axles[1])+' damaged','battery '+pct(s.battery)+' damaged','fuel tank '+pct(s.tank)+' damaged','exhaust '+pct(s.exhaust)+' damaged']:[];
 if(c?.lattice?.version===4&&c.lattice.linkDamage?.length){const links=c.lattice.linkDamage,damaged=links.filter(n=>n>.05).length,severe=links.filter(n=>n>.75).length;body.push('Chassis: '+damaged+'/'+links.length+' links weakened · '+severe+' severely damaged');}
 for(const spec of ENGINE_COMPONENTS){const mount=c?.engineMounts?.[spec.id];if(!mount)continue;const name=spec.id.replace(/_/g,' ');if(mount.detached)mechanical.push(name+': detached');else if(mount.mount<.65)mechanical.push(name+': loose · mount '+pct(mount.mount)+' intact');}
 const impacts=(c?.impacts??[]).slice().reverse().map(i=>['Front','Rear','Left','Right'][i.zone]+' '+i.severity+' impact · severity '+pct(i.energy)+' · speed change '+Math.round(i.deltaV*7.2)+' km/h');
 const warnings:string[]=[];if(c?.wheels.some(w=>!w.missing&&(w.attachment??1)<.65))warnings.push('A wheel is hanging and can detach while driving. Stop and repair the mount.');if(c?.wheels.some(w=>w.missing))warnings.push('A wheel is missing: grip and ground clearance are reduced.');if((s?.oil??1)<.3)warnings.push('Low oil is damaging the engine while it runs.');if((s?.coolant??1)<.25)warnings.push('Low coolant increases overheating risk.');
 return {condition,wheels,body,mechanical,impacts,warnings,effects:[`Mechanical power ${Math.round(effects.power*structure.power*100)}% · braking ${Math.round(effects.braking*structure.braking*100)}% · steering ${Math.round(effects.steering*structure.steer*100)}%`,`Oil ${pct(s?.oil??1)} · coolant ${pct(s?.coolant??1)} · fuel ${pct(s?.fuel??1)} · engine temperature ${pct(s?.temperature??0)}`]};
}
