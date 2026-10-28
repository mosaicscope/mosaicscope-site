import {VEHICLES} from '../content/vehicles';
import {clamp} from '../core/math';
import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from './VehicleGeometry';
/** Game-unit approximation: velocity-squared aero forces, using authored body dimensions. */
export function aerodynamicForces(v:Vehicle,speed:number,top:number){
 const g=vehicleGeometry(v),base=VEHICLES[v.cls].design?.base??v.cls;
 const ratio=clamp(Math.abs(speed)/Math.max(.1,top),0,1.6),pressure=ratio*ratio;
 const area=clamp(g.width*g.height/.6,.8,1.4),sport=['super','super_wedge','sports','trackcoupe','rally','rally_sedan'].includes(base);
 const damage=clamp(v.dmgF??0,0,1),bumper=v.bumperLost?1:0;
 const drag=1.4*pressure*area*(1+damage*.12+bumper*.06);
 const load=1+Math.min(.08,pressure*(sport?.05:.02)*(1-damage*.5));
 const pull=clamp(((v.dmgS??0)-(v.dmgL??0))*pressure*.012,-.025,.025);
 return {drag,load,pull};
}
