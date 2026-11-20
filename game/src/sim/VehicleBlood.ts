import type {Vehicle} from '../entities/types';
import {components} from './VehicleDamage';
import {vehicleGeometry} from './VehicleGeometry';
/** Persistent panel-local impact transfer. No extra actors, textures or per-frame particle emitters. */
export function transferBlood(v:Vehicle,x:number,y:number,speed:number):void{
 if(![x,y,speed].every(Number.isFinite)||speed<3.5)return;const p=components(v),g=vehicleGeometry(v),c=Math.cos(v.heading),s=Math.sin(v.heading),dx=x-v.x,dy=y-v.y;
 const marks=p.blood??=[],side=Math.max(-.48,Math.min(.48,(-dx*s+dy*c)/g.width)),at=Math.max(-.48,Math.min(.48,(dx*c+dy*s)/g.length));
 for(let i=0;i<3;i++){if(marks.length>=12)marks.shift();marks.push({x:at-i*.045,y:Math.max(-.48,Math.min(.48,side+(i-1)*.05)),z:.42+i*.12,size:Math.min(.2,.035+speed*.006)*(1-i*.18),age:0});}
}
