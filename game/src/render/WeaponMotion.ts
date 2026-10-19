import {TOYS} from '../content/toys';
export interface WeaponAction{weapon:string;firedAt:number;reloadFrom?:number;reloadUntil?:number;shots:number}
export interface GunMotion{cycle:number;pump:number;magazine:number;cylinder:number;hammer:number;trigger:number;reload:number}
export const REST_GUN:GunMotion={cycle:0,pump:0,magazine:0,cylinder:0,hammer:0,trigger:0,reload:0};
export function weaponMotion(action:WeaponAction|undefined,tick:number):GunMotion{
 if(!action)return REST_GUN;
 const t=(tick-action.firedAt)/60;if(t<0)return REST_GUN;
 const cycle=t<.16?Math.sin(t/.16*Math.PI):0;
 const pump=t>.22&&t<.72?Math.sin((t-.22)/.5*Math.PI):0;
 const reload=action.reloadFrom!==undefined&&action.reloadUntil!==undefined&&tick>=action.reloadFrom&&tick<action.reloadUntil?(tick-action.reloadFrom)/(action.reloadUntil-action.reloadFrom):0;
 const magazine=reload>.08&&reload<.8?Math.sin((reload-.08)/.72*Math.PI):0;
 return{cycle,pump,magazine,cylinder:reload?Math.sin(reload*Math.PI):0,hammer:t<.24?Math.sin(t/.24*Math.PI):0,trigger:t<.12?Math.sin(t/.12*Math.PI):0,reload};
}
/** Delays are measured from the shot; metal sounds coincide with the visible part travel. */
export function mechanicalBeats(weapon:string,reload=false){
 if(reload){const w=TOYS[weapon]?.weapon,start=w?.rate??.45,length=w?.reload??1.5;return[{delay:start+length*.12,pitch:430,duration:.045,level:.45},{delay:start+length*.76,pitch:650,duration:.04,level:.7},{delay:start+length*.9,pitch:950,duration:.025,level:.65}];}
 return weapon==='shotgun'?[{delay:.3,pitch:460,duration:.07,level:.65},{delay:.61,pitch:770,duration:.045,level:.7}]:[{delay:.035,pitch:1150,duration:.022,level:.35},{delay:.12,pitch:710,duration:.03,level:.4}];
}
