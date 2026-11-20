import {clamp} from '../core/math';
import type {Vehicle} from '../entities/types';
/** Trip computer is updated for the player-driven car only. Distances are in game metres. */
export interface DrivingTelemetry {distance:number;topKmh:number;longG:number;latG:number;lastSpeed:number;launchElapsed:number;launchActive:boolean;launchReady:boolean;best0100?:number;brakeDistance:number;brakeActive:boolean;lastBrakeDistance?:number;absEvents:number;tractionEvents:number;lastAbs:boolean;lastTraction:boolean}
export function resetDrivingTelemetry(v:Vehicle):void{v.telemetry=undefined;}
export function stepDrivingTelemetry(v:Vehicle,speed:number,distance:number,throttle:number,braking:boolean,dt:number):void{
 if(!Number.isFinite(dt)||dt<=0||![speed,distance,throttle].every(Number.isFinite))return;
 const h=Math.min(.25,dt),sp=Math.abs(speed),t=v.telemetry??={distance:0,topKmh:0,longG:0,latG:0,lastSpeed:speed,launchElapsed:0,launchActive:false,launchReady:sp<.2,brakeDistance:0,brakeActive:false,absEvents:0,tractionEvents:0,lastAbs:false,lastTraction:false};
 const travel=clamp(distance,0,(sp+5)*h)*2;
 t.distance+=travel;t.topKmh=Math.max(t.topKmh,sp*7.2);
 t.longG=clamp((speed-t.lastSpeed)*2/(9.81*h),-3,3);t.latG=clamp((v.yaw??0)*speed*2/9.81,-3,3);
 if(sp<.2&&!t.launchActive)t.launchReady=true;
 if(t.launchReady&&throttle>.2&&speed>.2&&!braking){t.launchReady=false;t.launchActive=true;t.launchElapsed=0;}
 if(t.launchActive){t.launchElapsed+=h;if(speed>=100/7.2){const fraction=clamp((100/7.2-t.lastSpeed)/Math.max(.001,speed-t.lastSpeed),0,1),elapsed=t.launchElapsed-h*(1-fraction);if(!t.best0100||elapsed<t.best0100)t.best0100=elapsed;t.launchActive=false;}else if(braking||speed<0||throttle<.05||sp<.15&&t.launchElapsed>.4)t.launchActive=false;}
 let brakeTravel=travel;
 if(!t.brakeActive&&braking&&t.lastSpeed>=80/7.2&&speed<=80/7.2){t.brakeActive=true;t.brakeDistance=0;const fraction=clamp((80/7.2-speed)/Math.max(.001,t.lastSpeed-speed),0,1);brakeTravel=travel*fraction;}
 if(t.brakeActive){if(!braking)t.brakeActive=false;else{t.brakeDistance+=brakeTravel;if(sp<.15){t.lastBrakeDistance=t.brakeDistance;t.brakeActive=false;}}}
 const abs=(v.contactControl?.abs??0)>.15,traction=(v.contactControl?.traction??0)>.15;
 if(abs&&!t.lastAbs)t.absEvents++;if(traction&&!t.lastTraction)t.tractionEvents++;t.lastAbs=abs;t.lastTraction=traction;t.lastSpeed=speed;
}
