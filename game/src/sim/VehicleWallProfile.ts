import type {Vehicle} from '../entities/types';
import {vehicleGeometry} from './VehicleGeometry';
import {vehicleBodyShape} from './VehicleBodyShape';
import {vehicleDeformer,type MeshPoint} from '../render/VehicleMesh';

type Point=[number,number];
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
/** Project the same body rings used by the car renderer onto a wall.
 * The convex envelope accounts for the whole car crossing the wall; it is not
 * a Boolean subtraction of every cosmetic fitting or detached part. */
export function vehicleWallProfile(v:Vehicle,tangentX:number,tangentY:number,units:number,centre:number,start:number,end:number):{contour:number[][];height:number}{
 const shape=vehicleBodyShape(v),g=vehicleGeometry(v),L=g.length,hw=g.width/2,H=g.height,x0=-L/2,x1=L/2;
 const bodyTop=(x:number)=>{const t=(x-x0)/L;return H*(shape.deck+(shape.hood-shape.deck)*Math.max(0,Math.min(1,(t-.25)/.75)));};
 const ring=(a:number,b:number,w:number,cf:number,cr:number,z:(x:number)=>number):MeshPoint[]=>{const f=w*2*cf,r=w*2*cr;return [[b,-w+f],[b,w-f],[b-f*.8,w],[a+r*.8,w],[a,w-r],[a,-w+r],[a+r*.8,-w],[b-f*.8,-w]].map(([x,y])=>[x,y,z(x)]);};
 const rings=[ring(x0+.04,x1-.04,hw*.9,shape.cf,shape.cr,()=>.08),ring(x0,x1,hw,shape.cf,shape.cr,()=>H*.3),ring(x0+.03,x1-.02,hw*.95,shape.cf*1.05,shape.cr*1.05,bodyTop),ring(shape.cab[0]*L,shape.cab[1]*L,hw*shape.cw,.12,.1,x=>bodyTop(x)-.01),ring(shape.roof[0]*L,shape.roof[1]*L,hw*shape.rw,.1,.08,()=>H*(shape.rh??1))];
 if(shape.box)rings.push(ring(shape.box.a*L+.02,shape.box.b*L-.02,hw*.95,.03,.03,()=>H*shape.box!.h));
 const deform=vehicleDeformer(v,L,2*hw,H),c=Math.cos(v.heading),s=Math.sin(v.heading),along=tangentX*c+tangentY*s,side=-tangentX*s+tangentY*c,span=Math.max(.001,end-start);
 const vertices=rings.flat().map(p=>deform?.(p)??p).map(([x,y,z])=>[centre+(x*along+y*side)*units,z*units] as Point);
 const min=Math.min(...vertices.map(p=>p[0])),max=Math.max(...vertices.map(p=>p[0])),top=Math.max(...vertices.map(p=>p[1]),H*units),margin=Math.min(span*.04,.06*units);
 const points:Point[]=vertices.map(([x,z])=>[Math.max(0,Math.min(1,(x+(x<(min+max)/2?-margin:margin)-start)/span)),Math.max(0,Math.min(1,z/(top*1.03)))]);
 points.push([Math.max(0,(min-margin-start)/span),0],[Math.min(1,(max+margin-start)/span),0]);
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lower:Point[]=[],upper:Point[]=[];
 for(const p of points){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
 for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
 lower.pop();upper.pop();return{contour:lower.concat(upper),height:top*1.03/(1.625*units)};
}
