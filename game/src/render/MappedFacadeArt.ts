import type {MappedFacadeDamage,MappedFacadeRecord} from '../sim/MappedFacadeDamage';
import {paintFacadeDamage,eraseFacadeGlow,type DamageProjection} from './FacadeDamageArt';

type Project=(x:number,y:number,height?:number)=>[number,number];
/** Works with metre coordinates (units=2) or main-world tile coordinates (units=1).
 * Call per building in painter order. Far walls remain hidden by the building's solid volume. */
export function drawMappedFacadeDamage(g:CanvasRenderingContext2D,damage:MappedFacadeDamage|Iterable<MappedFacadeRecord>,project:Project,scale:number,seconds:number,buildingId?:number|string,glow=false):void {
  const records='values' in damage?damage.values():damage;
  for(const d of records){
    if(buildingId!==undefined&&d.buildingId!==buildingId)continue;
    if(d.normal[0]+d.normal[1]>.001)continue;
    const P:DamageProjection=(u,h,out=0)=>project(d.a[0]+(d.b[0]-d.a[0])*u-d.normal[0]*out*d.units,d.a[1]+(d.b[1]-d.a[1])*u-d.normal[1]*out*d.units,h*1.625*d.units);
    if(glow)eraseFacadeGlow(g,d,P);else paintFacadeDamage(g,d,P,Math.max(.2,scale*d.units/16),seconds);
  }
}
