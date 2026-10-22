export type Point3=[number,number,number];
export interface SurfaceFace{a0:Point3;b0:Point3;a1:Point3;b1:Point3}
/** Fixtures are expressed on their parent surface, so deformation cannot leave them behind. */
export function surfacePoint(f:SurfaceFace,u:number,v:number):Point3{const a=f.a0.map((x,i)=>x+(f.b0[i]-x)*u),b=f.a1.map((x,i)=>x+(f.b1[i]-x)*u);return a.map((x,i)=>x+(b[i]-x)*v) as Point3;}
export function surfacePatch(f:SurfaceFace,u0:number,u1:number,v0:number,v1:number):Point3[]{const clamp=(n:number)=>Math.min(.97,Math.max(.03,n));return[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>surfacePoint(f,clamp(u),clamp(v)));}
export function lampFixture(f:SurfaceFace,side:-1|1,front:boolean,kind='square'){
 const u=(front?side:-side)<0?.2:.8,v=front?.7:.68,ru=kind==='bar'?.18:kind==='slit'?.145:.125,rv=kind==='slit'?.11:.18;
 return{center:surfacePoint(f,u,v),housing:surfacePatch(f,u-ru-.025,u+ru+.025,v-rv-.04,v+rv+.04),lens:surfacePatch(f,u-ru,u+ru,v-rv,v+rv),u,v,ru,rv};
}
