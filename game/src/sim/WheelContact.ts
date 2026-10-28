import {clamp} from '../core/math';
import type {Vehicle} from '../entities/types';
import {handlingProfile} from './VehicleHandling';
import {drivingDynamics,wheelGrip} from './VehicleDynamics';

const CALIPERS=['fl_caliper','fr_caliper','rl_caliper','rr_caliper'] as const,ARMS=['fl_arm','fr_arm','rl_arm','rr_arm'] as const,SPRINGS=['fl_spring','fr_spring','rl_spring','rr_spring'] as const;
/** A lightweight contact-patch controller, expressed in the game's acceleration units. */
export interface WheelControl {surface:number; roughness:number; groundSpeed:number; drive:number; brake:number; lock:number; abs:number; traction:number}
export interface ContactControl {wheels:WheelControl[]; driveGrip:number; brakeGrip:number; frontGrip:number; rearGrip:number; splitPull:number; brakeEffect:number; abs:number; traction:number}
export function wheelContactControl(v:Vehicle,surface:number[],speed:number,yaw:number,engineForce:number,brakeDemand:number,handbrake:boolean,assists:boolean,width:number,dt:number,roughness:number[]=[],tractionAssist=assists):ContactControl {
 const d=drivingDynamics(v),profile=handlingProfile(v.cls),previous=v.contactControl?.wheels, wheels:WheelControl[]=[];
 let driveGrip=0,brakeGrip=0,frontGrip=0,rearGrip=0,leftBrake=0,rightBrake=0,abs=0,traction=0;const capacities:number[]=[];
 const frontBias=clamp(.6-d.longitudinalLoad*.5,.52,.68);
 const driveWeights=profile.twoWheeler?(profile.drive==='fwd'?[1,0,0,0]:[0,0,1,0]):profile.drive==='fwd'?[.5,.5,0,0]:profile.drive==='rwd'?[0,0,.5,.5]:[.25,.25,.25,.25];
 for(let i=0;i<4;i++){
  const front=i<2,side=i%2===0?-1:1,w=d.wheels[i],condition=v.components?.wheels[i],raw=Number.isFinite(surface[i])?surface[i]:1;
  const active=!profile.twoWheeler||i%2===0,groundSpeed=speed-yaw*side*width*(profile.twoWheeler?0:.5);
  const arm=clamp(v.components?.parts?.[ARMS[i]]??0,0,1),spring=clamp(v.components?.parts?.[SPRINGS[i]]??0,0,1);
  const wheelCondition=condition?.missing?0:(condition?.puncture?.72:1)*(1-(condition?.rim??0)*.12-(condition?.suspension??0)*.15);
  const softSurface=clamp(roughness[i]??0,0,1),footprint=1+softSurface*.45*(1-clamp(w.pressure,0,1));
  const contact=clamp(raw,0,1.5)*wheelGrip(v,i)*footprint*wheelCondition*(1-arm*.12)*(1-spring*.1);
  const suspensionVelocity=Number.isFinite(w.suspensionVelocity)?Math.abs(w.suspensionVelocity!):0;
  const contactStability=1-clamp(suspensionVelocity*.06,0,.12);
  const capacity=contact*contactStability*Math.pow(clamp(w.load*4,.1,1.8),.9);capacities.push(capacity);
  const drive=driveWeights[i]*Math.abs(engineForce),brake=active?(clamp(brakeDemand,0,1)*(front?frontBias:1-frontBias)*(profile.twoWheeler?1:.5)+(handbrake&&!front?(profile.twoWheeler?.7:.35):0)):0;
  const available=Math.max(.04,capacity),over=clamp((drive-available*.45)/Math.max(.2,available),0,1);
  const lockTarget=handbrake&&!front&&active?1:clamp((brake-available*.24)/Math.max(.15,available*.45),0,1);
  const absTarget=assists&&!handbrake&&Math.abs(speed)>1?lockTarget:0,tcTarget=tractionAssist&&Math.abs(speed)>0.4?over:0;
  const saved=previous?.[i],old=saved&&[saved.abs,saved.traction,saved.lock].every(Number.isFinite)?saved:undefined,blend=1-Math.exp(-Math.max(0,Math.min(.25,dt))*12);
  const absWheel=(old?.abs??0)+(absTarget-(old?.abs??0))*blend;
  const tcWheel=(old?.traction??0)+(tcTarget-(old?.traction??0))*blend;
  const lock=(old?.lock??0)+(Math.max(0,lockTarget-absWheel*.8)-(old?.lock??0))*blend;
  const fade=clamp((w.brakeHeat-.55)*.45,0,.25),caliper=v.components?.parts?.[CALIPERS[i]]??0;
  const effectiveBrake=brake*(1-lock*.25)*(1-absWheel*.08)*(1-fade)*(1-clamp(caliper,0,1)*.3)*(1-clamp(Number.isFinite(w.brakeWear)?w.brakeWear!:0,0,1)*.2);
  wheels.push({surface:raw,roughness:clamp(roughness[i]??0,0,1),groundSpeed,drive,brake:effectiveBrake,lock,abs:absWheel,traction:tcWheel});
  const loadWeight=profile.twoWheeler?(i%2?0:2):1;
  if(driveWeights[i])driveGrip+=capacity*driveWeights[i];
  brakeGrip+=capacity*(front?frontBias:1-frontBias)*.5*loadWeight;
  if(front)frontGrip+=capacity*.5*loadWeight;else rearGrip+=capacity*.5*loadWeight;
  if(side<0)leftBrake+=effectiveBrake*capacity;else rightBrake+=effectiveBrake*capacity;
  abs=Math.max(abs,absWheel);traction=Math.max(traction,tcWheel);
 }
 // Open differentials are limited by their weaker wheel; sport, drift and trail use a partial locking bias.
 const locking=v.driveMode==='sport'?.35:v.driveMode==='drift'?.5:v.driveMode==='trail'?.6:.15;
 const axle=(a:number,b:number)=>Math.min(capacities[a],capacities[b])*(1-locking)+(capacities[a]+capacities[b])*.5*locking;
 if(!profile.twoWheeler)driveGrip=profile.drive==='fwd'?axle(0,1):profile.drive==='rwd'?axle(2,3):(axle(0,1)+axle(2,3))*.5;
 const brakeRequested=clamp(brakeDemand,0,1)+(handbrake?.7:0),brakeApplied=wheels.reduce((n,w)=>n+w.brake,0);
 const brakeEffect=brakeRequested>0?clamp(brakeApplied/brakeRequested,.45,1):1;
 const result={wheels,brakeEffect,driveGrip:clamp(driveGrip,.15,1.5),brakeGrip:clamp(brakeGrip,.15,1.5),frontGrip:clamp(frontGrip,.1,1.5),rearGrip:clamp(rearGrip,.1,1.5),splitPull:profile.twoWheeler?0:clamp((rightBrake-leftBrake)*.018,-.025,.025),abs,traction};
 v.contactControl=result;return result;
}

/** Front wheels follow different radii when turning, preserving the requested centre angle. */
export function ackermannAngle(steer:number,wheelbase:number,track:number,side:number):number {
 if(!Number.isFinite(steer)||Math.abs(steer)<1e-5)return 0;
 const sign=Math.sign(steer),radius=Math.max(.05,wheelbase)/Math.tan(Math.min(.9,Math.abs(steer)));
 return sign*Math.atan(Math.max(.05,wheelbase)/Math.max(.05,radius-sign*side*Math.max(0,track)*.5));
}
