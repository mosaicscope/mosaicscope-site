import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from '../sim/VehicleGeometry';

export interface DriveCameraPose { x:number; y:number; heading:number; distance:number; height:number; focalFactor:number; }
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Frame-rate independent chase camera. Vehicle positions stay in the same world coordinate system. */
export class DrivingCamera {
 private pose?:DriveCameraPose;private vehicle?:Vehicle;private lastX=0;private lastY=0;
 reset():void {this.pose=undefined;this.vehicle=undefined;}
 update(vehicle:Vehicle,alpha:number,dt:number,reduceMotion=false):DriveCameraPose {
  const t=clamp(Number.isFinite(alpha)?alpha:1,0,1),x=vehicle.px+(vehicle.x-vehicle.px)*t,y=vehicle.py+(vehicle.y-vehicle.py)*t;
  const velocity=Math.hypot(vehicle.vx??Math.cos(vehicle.heading)*vehicle.speed,vehicle.vy??Math.sin(vehicle.heading)*vehicle.speed),speed=clamp(Number.isFinite(velocity)?velocity:0,0,60),factor=speed/60;
  const baseDistance=Math.max(5,vehicleGeometry(vehicle).length*1.8+1.6),distance=baseDistance+factor*.9,height=3.1+factor*.3,focalFactor=.95-factor*.12;
  const snap=!this.pose||this.vehicle!==vehicle||Math.hypot(x-this.lastX,y-this.lastY)>35;
  if(snap){this.pose={x,y,heading:vehicle.heading,distance,height,focalFactor};this.vehicle=vehicle;}
  else {const pose=this.pose!,k=reduceMotion?1:1-Math.exp(-clamp(dt,0,.1)*8),rotation=Math.atan2(Math.sin(vehicle.heading-pose.heading),Math.cos(vehicle.heading-pose.heading));pose.x=x;pose.y=y;pose.heading+=rotation*k;pose.distance+=(distance-pose.distance)*k;pose.height+=(height-pose.height)*k;pose.focalFactor+=(focalFactor-pose.focalFactor)*k;}
  this.lastX=x;this.lastY=y;return this.pose!;
 }
}
