import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from './VehicleGeometry';
import {mappedRails} from '../world/MappedRails';
import type {MappedCity} from '../world/MappedWorld';
export interface RailHit{x:number;y:number;t:number;nx:number;ny:number}
/** Swept oriented vehicle footprint against surveyed barrier segments. Normal points into the barrier. */
export function sweptRailContact(map:MappedCity,v:Vehicle,nx:number,ny:number):RailHit|null{
 const dx=nx-v.x,dy=ny-v.y,travel=Math.hypot(dx,dy),geometry=vehicleGeometry(v),forwardX=Math.cos(v.heading),forwardY=Math.sin(v.heading),radius=geometry.radius;
 if(travel<1e-8)return null;let best:RailHit|null=null;
 for(const rail of mappedRails(map,(v.x+nx)/2,(v.y+ny)/2,travel/2+radius+2)){
  const normalX=-rail.dy,normalY=rail.dx,side0=(v.x-rail.x)*normalX+(v.y-rail.y)*normalY,side1=(nx-rail.x)*normalX+(ny-rail.y)*normalY;
  const pad=Math.abs(forwardX*normalX+forwardY*normalY)*geometry.length/2+Math.abs(-forwardY*normalX+forwardX*normalY)*geometry.width/2+.04;
  const sign=side0>=0?1:-1,approach=(side1-side0)*sign;if(approach>=-1e-8)continue;
  const t=Math.abs(side0)<=pad?0:(sign*pad-side0)/(side1-side0);if(t<0||t>1||best&&t>=best.t)continue;
  const x=v.x+dx*t,y=v.y+dy*t,along=(x-rail.x)*rail.dx+(y-rail.y)*rail.dy;
  const tangentPad=Math.abs(forwardX*rail.dx+forwardY*rail.dy)*geometry.length/2+Math.abs(-forwardY*rail.dx+forwardX*rail.dy)*geometry.width/2;
  if(along < -tangentPad||along>rail.length+tangentPad)continue;
  best={x,y,t,nx:-sign*normalX,ny:-sign*normalY};
 }
 return best;
}
