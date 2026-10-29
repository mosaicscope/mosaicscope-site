import {deformStructure} from '../sim/VehicleStructure';
import type {Vehicle} from '../entities/types';
export interface CrushDent{zone:number;x:number;y:number;z:number;nx:number;ny:number;depth:number;radius:number;energy:number}
export type MeshPoint=[number,number,number];
/** A persistent local crush field, sampled by body surfaces and their attached fittings. */
export function deformVehiclePoint(dents:readonly CrushDent[],p:MeshPoint,L:number,W:number,H:number,rigidity=1):MeshPoint{
 let dx=0,dy=0,dz=0;const x=p[0]/L,y=p[1]/W,z=p[2]/H;
 for(const d of dents){const rx=d.zone<2?d.radius:d.radius*.85,ry=d.zone<2?d.radius*1.5:d.radius,rz=.58,xx=(x-d.x)/rx,yy=(y-d.y)/ry,zz=(z-d.z)/rz,weight=Math.exp(-(xx*xx+yy*yy+zz*zz)*1.6),fold=Math.sin((d.zone<2?y:x)*28+d.zone*2.3)*Math.min(.025,d.depth*.13);dx-=d.nx*d.depth*L*weight*rigidity;dy-=d.ny*d.depth*W*weight*rigidity;const inward=(x-d.x)*d.nx+(y-d.y)*d.ny,crease=Math.sin(inward*32)*Math.min(.07,d.depth*.45),buckle=d.zone<2?Math.exp(-(((inward+.16)/.1)**2))*d.depth*.6:fold;dz+=(buckle+crease)*H*weight*rigidity;}
 return[p[0]+Math.max(-L*.32,Math.min(L*.32,dx)),p[1]+Math.max(-W*.38,Math.min(W*.38,dy)),Math.max(.035,p[2]+Math.max(-H*.16,Math.min(H*.28,dz)))];
}
export function vehicleDents(v:Vehicle):readonly CrushDent[]{if(v.components?.dents?.length)return v.components.dents;const p=v.components;return(p?.panels??[v.dmgF??0,v.dmgR??0,v.dmgL??0,v.dmgS??0]).flatMap((energy,zone)=>energy<.08?[]:[{zone,x:p?.contacts?.[zone]?.x??(zone===0?.48:zone===1?-.48:0),y:p?.contacts?.[zone]?.y??(zone===2?-.48:zone===3?.48:0),z:.45,nx:zone===0?1:zone===1?-1:0,ny:zone===2?-1:zone===3?1:0,depth:energy*(zone<2?.18:.27),radius:.3,energy}]);}

const deformationCaches=new WeakMap<Vehicle,{key:string;deform:(p:MeshPoint)=>MeshPoint}>();
/** Static crush geometry is shared by panel meshes, glazing and fittings until the damage changes. */
export function vehicleDeformer(v:Vehicle,L:number,W:number,H:number,dents:readonly CrushDent[]=vehicleDents(v)):((p:MeshPoint)=>MeshPoint)|undefined{
 const structure=v.components?.structure,lattice=v.components?.lattice,shape=structure?[structure.front,structure.rear,structure.bend,structure.twist,structure.roof,...structure.intrusion]:[];if(!dents.length&&!shape.some(n=>n!==0))return undefined;
 const key=[L,W,H,...shape,...(lattice?.nodes.flatMap(n=>[n.x,n.y])??[]),...dents.flatMap(d=>[d.zone,d.x,d.y,d.z,d.nx,d.ny,d.depth,d.radius,d.energy])].join(',');const old=deformationCaches.get(v);if(old?.key===key)return old.deform;const points=new Map<number,MeshPoint>();const deform=(p:MeshPoint):MeshPoint=>{const cacheable=p.every(n=>Math.abs(n)<7.9),id=(Math.round(p[0]*4096)+32768)*4294967296+(Math.round(p[1]*4096)+32768)*65536+Math.round(p[2]*4096)+32768;let q=cacheable?points.get(id):undefined;if(q)return q;const dented=deformVehiclePoint(dents,p,L,W,H);q=structure?deformStructure(structure,dented,L,W,H):dented;if(lattice?.nodes.length===6){let dx=0,dy=0,total=0;for(let i=0;i<lattice.nodes.length;i++){const n=lattice.nodes[i],baseX=[-.42,-.42,0,0,.42,.42][i],baseY=i%2?.4:-.4,distance=((p[0]/L-baseX)**2+(p[1]/W-baseY)**2),weight=Math.exp(-distance*8);dx+=(n.x-baseX)*weight;dy+=(n.y-baseY)*weight;total+=weight;}if(total>.01)q=[q[0]+dx/total*L,q[1]+dy/total*W,q[2]];}if(points.size>=4096)points.clear();if(cacheable)points.set(id,q);return q;};deformationCaches.set(v,{key,deform});return deform;
}
