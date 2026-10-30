import type {Vehicle,Character} from '../entities/types';
import {vehicleGeometry} from '../sim/VehicleGeometry';

export interface DriveCameraPose { x:number; y:number; heading:number; distance:number; height:number; focalFactor:number; }
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Frame-rate independent chase camera. Vehicle positions stay in the same world coordinate system. */
export class DrivingCamera {
 private pose?:DriveCameraPose;private lastX=0;private lastY=0;private visualSpeed=0;
 reset():void {this.pose=undefined;this.visualSpeed=0;}
 update(vehicle:Vehicle,alpha:number,dt:number,reduceMotion=false):DriveCameraPose {
  const t=clamp(Number.isFinite(alpha)?alpha:1,0,1),x=vehicle.px+(vehicle.x-vehicle.px)*t,y=vehicle.py+(vehicle.y-vehicle.py)*t;
  const velocity=Math.hypot(vehicle.vx??Math.cos(vehicle.heading)*vehicle.speed,vehicle.vy??Math.sin(vehicle.heading)*vehicle.speed),speed=clamp(Number.isFinite(velocity)?velocity:0,0,60),factor=speed/60;
  const snap=!this.pose||Math.hypot(x-this.lastX,y-this.lastY)>35;
  // Ease the racing field of view in, and release it slowly after braking or impact.
  // A crash must not cause an abrupt zoom or hide the road ahead.
  if(snap)this.visualSpeed=reduceMotion?0:factor;
  else {const rate=factor>this.visualSpeed?2.5:.38;this.visualSpeed+=(factor-this.visualSpeed)*(1-Math.exp(-clamp(dt,0,.1)*rate));}
  const visual=reduceMotion?0:this.visualSpeed;
  const baseDistance=Math.max(5.6,vehicleGeometry(vehicle).length*1.8+1.9),distance=baseDistance+visual*.9,height=3.3+visual*.3,focalFactor=.95-visual*.12;
  // Look a little into the direction of travel while drifting, but never flip on reverse.
  const vx=vehicle.vx??0,vy=vehicle.vy??0,forward=vx*Math.cos(vehicle.heading)+vy*Math.sin(vehicle.heading);
  const slip=forward>3?Math.atan2(vy,vx)-vehicle.heading:0;
  const look=reduceMotion?0:clamp(Math.atan2(Math.sin(slip),Math.cos(slip))*.22,-.17,.17);
  const heading=vehicle.heading+look;
  if(snap){this.pose={x,y,heading,distance,height,focalFactor};}
  else {const pose=this.pose!,k=reduceMotion?1:1-Math.exp(-clamp(dt,0,.1)*6),rotation=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading));pose.x=x;pose.y=y;pose.heading+=rotation*k;pose.distance+=(distance-pose.distance)*k;pose.height+=(height-pose.height)*k;pose.focalFactor+=(focalFactor-pose.focalFactor)*k;}
  this.lastX=x;this.lastY=y;return this.pose!;
 }
 updateFoot(character:Character,alpha:number,dt:number,reduceMotion=false):DriveCameraPose {
  const t=clamp(Number.isFinite(alpha)?alpha:1,0,1),x=character.px+(character.x-character.px)*t,y=character.py+(character.y-character.py)*t;
  if(!this.pose||Math.hypot(x-this.lastX,y-this.lastY)>35)this.pose={x,y,heading:character.facing,distance:5,height:2.8,focalFactor:.95};
  else {const k=reduceMotion?1:1-Math.exp(-clamp(dt,0,.1)*8);this.pose.x=x;this.pose.y=y;this.pose.distance+=(5-this.pose.distance)*k;this.pose.height+=(2.8-this.pose.height)*k;this.pose.focalFactor+=(.95-this.pose.focalFactor)*k;}
  this.lastX=x;this.lastY=y;return this.pose;
 }
}
