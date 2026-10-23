import type {Vehicle} from '../entities/types';
export interface CrushDent{zone:number;x:number;y:number;z:number;nx:number;ny:number;depth:number;radius:number;energy:number}
export type MeshPoint=[number,number,number];
/** A persistent local crush field, sampled by body surfaces and their attached fittings. */
export function deformVehiclePoint(dents:readonly CrushDent[],p:MeshPoint,L:number,W:number,H:number,rigidity=1):MeshPoint{
 let dx=0,dy=0,dz=0;const x=p[0]/L,y=p[1]/W,z=p[2]/H;
 for(const d of dents){const rx=d.zone<2?d.radius:d.radius*.85,ry=d.zone<2?d.radius*1.5:d.radius,rz=.58,xx=(x-d.x)/rx,yy=(y-d.y)/ry,zz=(z-d.z)/rz,weight=Math.exp(-(xx*xx+yy*yy+zz*zz)*1.6),fold=Math.sin((d.zone<2?y:x)*28+d.zone*2.3)*Math.min(.025,d.depth*.13);dx-=d.nx*d.depth*L*weight*rigidity;dy-=d.ny*d.depth*W*weight*rigidity;dz+=(d.zone<2?Math.sin((x-d.x)*14)*d.depth*.18:fold)*H*weight*rigidity;}
 return[p[0]+Math.max(-L*.32,Math.min(L*.32,dx)),p[1]+Math.max(-W*.38,Math.min(W*.38,dy)),Math.max(.035,p[2]+Math.max(-H*.16,Math.min(H*.19,dz)))];
}
export function vehicleDents(v:Vehicle):readonly CrushDent[]{if(v.components?.dents?.length)return v.components.dents;const p=v.components;return(p?.panels??[v.dmgF??0,v.dmgR??0,v.dmgL??0,v.dmgS??0]).flatMap((energy,zone)=>energy<.08?[]:[{zone,x:p?.contacts?.[zone]?.x??(zone===0?.48:zone===1?-.48:0),y:p?.contacts?.[zone]?.y??(zone===2?-.48:zone===3?.48:0),z:.45,nx:zone===0?1:zone===1?-1:0,ny:zone===2?-1:zone===3?1:0,depth:energy*(zone<2?.18:.27),radius:.3,energy}]);}
