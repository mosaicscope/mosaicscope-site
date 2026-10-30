import {ackermannAngle} from '../sim/WheelContact';
import {damageStage} from '../sim/ProgressiveDamage';
import {damageBloodEnabled} from './DamageArt';
import {lampFixture,surfacePoint,surfacePatch} from './SurfaceFixtures';
import {vehicleGeometry} from '../sim/VehicleGeometry';
import {handlingProfile} from '../sim/VehicleHandling';
import {utilitySpec} from '../sim/VehicleUtility';
import {lampDamage} from '../sim/VehicleDamage';
import {drawTwoWheeler} from './TwoWheelers';
import type {Character} from '../entities/types';
import { T, type World } from "../world/World";
import type { Vehicle } from "../entities/types";
import { VEHICLES, VehicleClass } from "../content/vehicles";
import type { Camera } from "./Camera";
import { GLOW } from "./Buildings";
import { patinaOf, weather } from "./CarPatina";
import { carMutationOf } from "./CarMutation";
import {vehicleBodyShape,bonnetSection} from '../sim/VehicleBodyShape';
import {vehicleDents,vehicleDeformer} from './VehicleMesh';

/**
 * Cars are little lofted 3D models projected into the iso view: a rocker skirt, a body whose top
 * slopes from the bonnet to the boot deck, and a glasshouse whose roof is narrower and shorter than
 * its base (so windscreens and rear windows rake back). Each face is lit by its own normal, hidden
 * faces are culled, and wheels are real discs (far side behind the body, near side in the arches).
 * Per-class shapes give hatchbacks, sedans, utes, vans, tuners, muscle cars and supercars their own
 * silhouettes; liveries, light bars, wings and neon underglow sit on top.
 */
type V3 = [number, number, number];
const pt = { x: 0, y: 0 };
const VIEW: V3 = [1, 1, 1.23];            // towards the iso camera, in world units (x, y, up)
const LIGHT = norm([-0.45, 0.55, 1]);       // key light from the upper left of the screen

function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function rgb(hex: string): [number, number, number] {
  if (!hex.startsWith("#")) return [128, 128, 128];
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lit(c: [number, number, number], k: number, add = 0): string {
  return `rgb(${Math.min(255, Math.round(c[0] * k + add))},${Math.min(255, Math.round(c[1] * k + add))},${Math.min(255, Math.round(c[2] * k + add))})`;
}


type Band = { u0: number; u1: number; cols: string[]; n?: number };
/** Paint, trim and fittings per class, on top of the shape. */
interface Style {
  paint?: string;                 // fixed paint (ignores the car's own colour)
  rim?: string;
  bands?: Band[];                 // stripes / checks along the long sides
  flames?: boolean; rust?: number;
  roof?: "rack" | "surf" | "pop" | "cone" | "beacon" | "bar" | "ladder" | "boom";
  neon?: boolean; spare?: boolean; crest?: string;
}
const STYLE: Partial<Record<VehicleClass, Style>> = {
  hothatch: { rim: "#c9c4bc", neon: true, bands: [{ u0: 0.28, u1: 0.34, cols: ["#0e0b0a"] }] },
  roadster: { rim: "#cfc8c0" },
  hearse: { paint: "#0e0b0a", rim: "#cfc8c0", bands: [{ u0: 0.42, u1: 0.47, cols: ["#cfc8c0"] }] },
  limo: { rim: "#cfc8c0", bands: [{ u0: 0.44, u1: 0.48, cols: ["#e6b422"] }] },
  camper: { rim: "#cfc8c0", bands: [{ u0: 0.58, u1: 1.0, cols: ["#f4f0e4"] }], roof: "pop" },
  minivan: { rim: "#a39d96" },
  wagon: { roof: "surf" },
  dcute: { rim: "#8a8580", roof: "bar" },
  flatdeck: { rim: "#8a8580" },
  tradie: { rim: "#8a8580", roof: "ladder", bands: [{ u0: 0.18, u1: 0.3, cols: ["#ff9a3d"] }] },
  icecream: { rim: "#8a8580", roof: "cone", bands: [{ u0: 0.22, u1: 0.78, cols: ["#ffc2e8", "#fff1d6"], n: 10 }] },
  post: { rim: "#8a8580", bands: [{ u0: 0.36, u1: 0.46, cols: ["#f6d32c"] }] },
  bus: { rim: "#8a8580", bands: [{ u0: 0.08, u1: 0.3, cols: ["#eee4d3"] }, { u0: 0.3, u1: 0.4, cols: ["#f6d32c"] }] },
  tow: { rim: "#8a8580", roof: "boom", bands: [{ u0: 0.05, u1: 0.2, cols: ["#f6d32c", "#0e0b0a"], n: 14 }] },
  fire: { paint: "#d4382a", rim: "#cfc8c0", roof: "ladder", bands: [{ u0: 0.3, u1: 0.4, cols: ["#f6d32c"] }] },
  bin: { rim: "#8a8580", roof: "beacon", bands: [{ u0: 0.05, u1: 0.18, cols: ["#0e0b0a"] }] },
  banger: { rust: 6, rim: "#8a8580" },
  retro: { rim: "#cfc8c0" },
  lowrider: { rim: "#e6b422", neon: true },
  fourby: { rim: "#8a8580", spare: true, roof: "rack" },
  ev: { rim: "#2a2a2a" },
  rally: { rim: "#e6b422", neon: false, bands: [{ u0: 0.25, u1: 0.33, cols: ["#e6b422"] }, { u0: 0.36, u1: 0.4, cols: ["#eee4d3"] }] },
  hotrod: { rim: "#cfc8c0", neon: true, flames: true },
};

/** Octagonal plan ring (counter-clockwise), centred on cx, with nose / tail chamfers. */
function ring(x0: number, x1: number, hw: number, cf: number, cr: number, h: (x: number) => number): V3[] {
  const f = hw * 2 * cf, r = hw * 2 * cr;
  const P: [number, number][] = [[x1, -hw + f], [x1, hw - f], [x1 - f * 0.8, hw], [x0 + r * 0.8, hw], [x0, hw - r], [x0, -hw + r], [x0 + r * 0.8, -hw], [x1 - f * 0.8, -hw]];
  return P.map(([x, y]) => [x, y, h(x)]);
}

interface Ctx { g: CanvasRenderingContext2D; cam: Camera; x: number; y: number; c: number; s: number; roll?:number; pitch?:number; submersion?:number; deform?:(p:V3)=>V3 }
const W3 = (k: Ctx, raw: V3) => { const p=k.deform?.(raw)??raw;k.cam.toScreen(k.x + p[0] * k.c - p[1] * k.s, k.y + p[0] * k.s + p[1] * k.c, Math.max(-2,p[2]+(k.roll??0)*p[1]+(k.pitch??0)*p[0]-(k.submersion??0)), pt); return [pt.x, pt.y]; };
/** Local -> world normal. */
const WN = (k: Ctx, n: V3): V3 => [n[0] * k.c - n[1] * k.s, n[0] * k.s + n[1] * k.c, n[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function fillPoly(k: Ctx, pts: V3[], col: string): void {
  const g = k.g; g.fillStyle = col; g.beginPath();
  pts.forEach((p, i) => { const q = W3(k, p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
  g.closePath(); g.fill();
}
const shadeFor = (n: V3) => 0.5 + 0.62 * Math.max(0, dot(norm(n), LIGHT));

/** Subdivide damaged sheet metal so an impact between corners changes the surface and its light. */
function meshTriangle(k:Ctx,a:V3,b:V3,c:V3,col:string,normal:V3,level:number):void{
 if(level>0){const mid=(p:V3,q:V3):V3=>[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);for(const tri of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])meshTriangle(k,tri[0],tri[1],tri[2],col,normal,level-1);return;}
 const A=k.deform!(a),B=k.deform!(b),C=k.deform!(c);let n=cross([B[0]-A[0],B[1]-A[1],B[2]-A[2]],[C[0]-A[0],C[1]-A[1],C[2]-A[2]]);if(dot(n,normal)<0)n=n.map(v=>-v) as V3;
 const base=col.startsWith('#')?rgb(col):col.match(/[\d.]+/g)?.slice(0,3).map(Number) as [number,number,number]|undefined,ratio=Math.max(.55,Math.min(1.3,shadeFor(WN(k,n))/shadeFor(WN(k,normal)))),shade=base?lit(base,ratio):col;const g=k.g,points=[a,b,c].map(p=>W3(k,p)),cx=points.reduce((n,p)=>n+p[0]/3,0),cy=points.reduce((n,p)=>n+p[1]/3,0);g.fillStyle=shade;g.beginPath();points.forEach((p,i)=>{const dx=p[0]-cx,dy=p[1]-cy,length=Math.hypot(dx,dy)||1,x=p[0]+dx/length*.25,y=p[1]+dy/length*.25;if(i)g.lineTo(x,y);else g.moveTo(x,y);});g.closePath();g.fill();
}
function meshFace(k:Ctx,points:V3[],col:string,normal:V3):void{
 if(!k.deform||k.cam.zoom<.45){fillPoly(k,points,col);return;}
 const centre=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length,a[2]+p[2]/points.length] as V3,[0,0,0] as V3),level=k.cam.zoom>3.5?2:1;
 const samples=[centre,...points,...points.map((p,i)=>{const q=points[(i+1)%points.length];return [(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2] as V3;})];
 const warp=Math.max(...samples.map(p=>{const q=k.deform!(p);return Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);}));if(warp<.008){fillPoly(k,points,col);return;}
 fillPoly(k,points,col);
 for(let i=0;i<points.length;i++)meshTriangle(k,centre,points[i],points[(i+1)%points.length],col,normal,level);
}

/** Draw the visible side faces of a loft between two rings. Returns the faces drawn (for liveries). */
function loft(k: Ctx, r0: V3[], r1: V3[], colorOf: (n: V3, i: number) => string, edge?: string): { a0: V3; b0: V3; a1: V3; b1: V3; n: V3 }[] {
  const out: { a0: V3; b0: V3; a1: V3; b1: V3; n: V3 }[] = [];
  const cx = r0.reduce((s, p) => s + p[0], 0) / r0.length, cy = r0.reduce((s, p) => s + p[1], 0) / r0.length;
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length;
    const a0 = r0[i], b0 = r0[j], a1 = r1[i], b1 = r1[j];
    const e: V3 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
    const f: V3 = [(a1[0] + b1[0] - a0[0] - b0[0]) / 2, (a1[1] + b1[1] - a0[1] - b0[1]) / 2, (a1[2] + b1[2] - a0[2] - b0[2]) / 2];
    let n = cross(e, f);
    const mx = (a0[0] + b0[0]) / 2 - cx, my = (a0[1] + b0[1]) / 2 - cy;
    if (n[0] * mx + n[1] * my < 0) n = [-n[0], -n[1], -n[2]];
    const wn = WN(k, n);
    if (dot(wn, VIEW) <= 0) continue;
    meshFace(k, [a0, b0, b1, a1], colorOf(wn, i),n);
    if (edge) { const g = k.g, A = W3(k, a1), B = W3(k, b1); g.strokeStyle = edge; g.lineWidth = Math.max(1, k.cam.zoom); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    out.push({ a0, b0, a1, b1, n: wn });
  }
  return out;
}
function cap(k: Ctx, r: V3[], col: [number, number, number], add = 0): void {
  // plane normal from two diagonals
  const a = r[0], b = r[Math.floor(r.length / 2)], c = r[Math.floor(r.length / 4)], d = r[Math.floor((3 * r.length) / 4)];
  let n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]);
  if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
  meshFace(k, r, lit(col, shadeFor(WN(k, n)) * 1.05, add),n);
}
/** Point on a face: t along the edge, u up the face. */
const onFace = (f: { a0: V3; b0: V3; a1: V3; b1: V3 }, t: number, u: number): V3 => {
  const lo: V3 = [f.a0[0] + (f.b0[0] - f.a0[0]) * t, f.a0[1] + (f.b0[1] - f.a0[1]) * t, f.a0[2] + (f.b0[2] - f.a0[2]) * t];
  const hi: V3 = [f.a1[0] + (f.b1[0] - f.a1[0]) * t, f.a1[1] + (f.b1[1] - f.a1[1]) * t, f.a1[2] + (f.b1[2] - f.a1[2]) * t];
  return [lo[0] + (hi[0] - lo[0]) * u, lo[1] + (hi[1] - lo[1]) * u, lo[2] + (hi[2] - lo[2]) * u];
};

function wheel(k: Ctx, lx: number, ly: number, r: number, near: boolean, spin: number, rim: string, flat = false): void {
  const g = k.g, pts: number[][] = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; pts.push(W3(k, [lx + Math.cos(a) * r, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * r * (flat ? 0.55 : 1)])); }
  g.fillStyle = "#121010"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  if (!near) return;
  const ri = r * 0.62;
  g.fillStyle = rim; g.beginPath();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; const p = W3(k, [lx + Math.cos(a) * ri, ly + Math.sign(ly) * 0.01, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * (flat ? 0.55 : 1)]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  g.closePath(); g.fill();
  // spokes turn with the wheel
  g.strokeStyle = "rgba(14,11,10,.55)"; g.lineWidth = Math.max(1, 0.8 * k.cam.zoom); g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * 6.283;
    const A = W3(k, [lx + Math.cos(a) * ri * 0.25, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * 0.25 * (flat ? 0.55 : 1)]), B = W3(k, [lx + Math.cos(a) * ri * 0.92, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * 0.92 * (flat ? 0.55 : 1)]);
    g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
  }
  g.stroke();
}

// World positions from the rendered assembly are also used by the lighting pass.
const lampMounts = new WeakMap<Vehicle, V3[]>();

export function drawCar(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, alpha: number, time: number, dark: number, selected: boolean, driver?:Character): void {
  const mods=v.lifeMods??[],d=VEHICLES[v.cls],S=vehicleBodyShape(v),M=carMutationOf(v.plate,v.cls);
  const x = v.px + (v.x - v.px) * alpha, y = v.py + (v.y - v.py) * alpha;
  const z = cam.zoom, ang = v.heading;
  const k: Ctx = { g, cam, x, y, c: Math.cos(ang), s: Math.sin(ang),submersion:Math.max(0,(v.water?.submersion??0)-(v.water?.bob??0)) };
  if(drawTwoWheeler(g,cam,v,alpha,time,driver,dark))return;
  if(v.cls==='tank'){
    const L=d.length,hw=d.width/2,p=v.components,front=p?.panels[0]??v.dmgF??0,rear=p?.panels[1]??v.dmgR??0;
    for(const side of[-1,1]){const y=side*(hw-.14),hurt=p?.wheels[side<0?0:1],lo=ring(-L/2,L/2,.18,.1,.1,()=>.08).map(p=>[p[0],p[1]+y,p[2]] as V3),hi=lo.map(p=>[p[0],p[1],hurt?.missing?.35:.52] as V3);loft(k,lo,hi,()=> '#2b302c','#171e1b');cap(k,hi,rgb('#414a40'));for(let i=0;i<5;i++){if(hurt?.missing&&i===4)continue;wheel(k,-L*.36+i*L*.18,side*hw,.18,side>0,time*v.speed,'#68715b');}for(let i=0;i<14;i++){const a=-L*.47+i*L*.067;strokePoly(k,[[a,y-.17,.525],[a,y+.17,.525]],'#89907a',.65*z,false);}}
    const hull=ring(-L*.48+rear*.06,L*.45-front*.08,hw*.85,.18,.12,()=>.4),top=ring(-L*.4+rear*.04,L*.32-front*.06,hw*.77,.22,.15,()=>.9);const armour=loft(k,hull,top,()=>v.color,'#333d30');cap(k,top,rgb(v.color));
    for(const f of armour){const side=(f.a0[1]+f.b0[1])/2,amount=Math.abs(f.a0[0]-f.b0[0])<.1?((f.a0[0]+f.b0[0])>0?front:rear):p?.panels[side<0?2:3]??0;for(let j=0;j<Math.ceil(amount*5);j++)strokePoly(k,[surfacePoint(f,.12+j*.14,.35),surfacePoint(f,.18+j*.14,.5),surfacePoint(f,.24+j*.14,.43)],'#b5af8c',.7*z,false);}
    const turret=ring(-.6,.45,.42,.2,.2,()=>.9),roof=ring(-.5,.35,.35,.2,.2,()=>1.3);loft(k,turret,roof,()=> '#59664d','#33402e');cap(k,roof,rgb('#7b8769'));
    fillPoly(k,[[.2,-.09,1.17],[L*.85,-.09,1.17],[L*.85,.09,1.17],[.2,.09,1.17]],'#8c977a');fillPoly(k,[[.2,.09,1.04],[L*.85,.09,1.04],[L*.85,.09,1.17],[.2,.09,1.17]],'#3f4b37');
    for(const f of armour){if(Math.abs(f.a0[0]-f.b0[0])>.1)continue;const frontEnd=f.a0[0]>0;for(const side of[-1,1] as const){const fixture=lampFixture(f,side,frontEnd,'square');fillPoly(k,fixture.housing,'#24342a');if(lampDamage(v,(frontEnd?0:2)+(side>0?1:0))<.94)fillPoly(k,fixture.lens,frontEnd?'#bac4a4':'#a0604b');}}return;
  }
  const geometry=vehicleGeometry(v),L=geometry.length,hw=geometry.width/2,H=geometry.height;
  // crumple zones: a hit end is pushed in (Traffic.bump records where the car was hit)
  const panels=v.components?.panels??[];
  const dF=Math.max(v.dmgF??0,(panels[0]??0)*.65),dR=Math.max(v.dmgR??0,(panels[1]??0)*.65),dL=Math.max(v.dmgL??0,(panels[2]??0)*.65),dS=Math.max(v.dmgS??0,(panels[3]??0)*.65);
  const dents=vehicleDents(v),structure=v.components?.structure;k.deform=vehicleDeformer(v,L,hw*2,H,dents);

  const x0 = -L / 2, x1 = L / 2;

  const night = dark > 0.35;
  const ST:Style = {...STYLE[d.design?.base??v.cls],...(d.design?.trim==='rack'?{roof:'rack' as const}:d.design?.trim==='spare'?{spare:true}:d.design?.trim==='work'?{roof:'ladder' as const}:d.design?.trim==='stripe'?{bands:[{u0:.36,u1:.45,cols:['#e1dac2']}]}:{}),...(mods.includes("Neon kit")?{neon:true}:{}),...(mods.includes("Tractor engine")?{roof:"cone" as const}:{}),...(mods.includes("Hearse body")?{paint:"#171420"}:{})};
  const rawPatina=patinaOf(v.cls,v.plate,d.price,v.damage),PT=v.resprayed?{...rawPatina,dirt:0,fade:0,bleach:0,marks:[],topRust:[],roof:null,stripe:null}:v.cleaned?{...rawPatina,dirt:.02,marks:rawPatina.marks.filter(m=>m.kind!=='mud')}:rawPatina;   // this car's own story: age, rust, dents, stickers (CarPatina.ts)
  const paint = weather(rgb(v.cls === "police" ? "#f2f2ee" : v.cls === "ambulance" ? "#f4f1e6" : ST.paint ?? v.color), PT);
  const roofPaint = PT.roof ? rgb(PT.roof) : paint;
  const dmg = 1 - v.damage * 0.35;
  const spin = (v.wheelTravel ?? time*v.speed) / (S.wheel * H);

  // A compact shadow follows the actual vehicle footprint and heading.
  g.save();g.fillStyle='rgba(0,0,0,.25)';g.beginPath();
  for(const [i,[lx,ly]] of [[-L*.47,-hw*.88],[L*.47,-hw*.88],[L*.47,hw*.88],[-L*.47,hw*.88]].entries()){
    const p=cam.toScreen(x+lx*k.c-ly*k.s,y+lx*k.s+ly*k.c,.005,{x:0,y:0});if(i)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);
  }g.closePath();g.fill();g.restore();

  // Neon is an explicit player upgrade, rather than a ring on every sports car.
  if(night&&ST.neon&&!(v.state==='parked'&&v.driver<0)){
    cam.toScreen(x,y,0,pt);const sx=pt.x,sy=pt.y+2*z,rx=L*15*z;
    GLOW.push(layer=>{layer.save();layer.globalCompositeOperation='lighter';layer.translate(sx,sy);layer.scale(1,.5);const grad=layer.createRadialGradient(0,0,0,0,0,rx);grad.addColorStop(0,'rgba(61,214,255,0)');grad.addColorStop(.7,'rgba(61,214,255,.09)');grad.addColorStop(1,'rgba(61,214,255,0)');layer.fillStyle=grad;layer.beginPath();layer.arc(0,0,rx,0,6.283);layer.fill();layer.restore();});
  }

  // which side faces the camera
  const nearSign = dot(WN(k, [0, 1, 0]), VIEW) > 0 ? 1 : -1;
  const wr = S.wheel * H, wx = geometry.wheelbase/2, wy = hw - 0.02;
  const rimCol = d.design?.rim ?? ST.rim ?? (v.cls === "police" || v.cls === "ambulance" || v.cls === "van" ? "#8a8580" : v.cls === "super" || v.cls === "sports" ? "#2a2a2a" : "#cfc8c0");
  const axles = M.axles === 1 ? [0] : M.axles === 2 ? [wx, -wx] : [wx, 0, -wx];
  for (const lx of axles) roadWheel(k,v,lx,-nearSign*wy,wr,false,spin,rimCol);

  // The chassis settles toward a failed corner; grounded wheels keep their own contact plane.
  if(v.components){const drop=(i:number)=>{const w=v.components!.wheels[i];return w.missing?.2:(w.puncture?.06:0)+w.suspension*.045+Math.max(0,.65-(w.attachment??1))*.13;};k.roll=((drop(0)+drop(2))-(drop(1)+drop(3)))/Math.max(.2,hw*4);k.pitch=((drop(2)+drop(3))-(drop(0)+drop(1)))/Math.max(.4,L*2);}
  k.roll=(k.roll??0)+(v.bodyRoll??0)+(structure?.hop??0);k.pitch=(k.pitch??0)+(v.bodyPitch??0);
  if(v.utility){k.roll+=(v.utility.sway??0)*.35;k.pitch+=(v.utility.loadShift??0)*.25;}
  // ---- lower skirt ----
  const hs = H * 0.3, ground = 0.08;
  const bodyTop = (lx: number) => { const t = (lx - x0) / L; return H * (S.deck + (S.hood - S.deck) * Math.max(0, Math.min(1, (t - 0.25) / 0.75))); };
  const dent=(ring:V3[]):V3[]=>ring;
  const rSk0 = dent(ring(x0 + 0.04, x1 - 0.04, hw * 0.9, S.cf, S.cr, () => ground));
  const rSk1 = dent(ring(x0, x1, hw, S.cf, S.cr, () => hs));
  const lower = (n: V3) => lit(paint, shadeFor(n) * 0.72 * dmg);
  loft(k, rSk0, rSk1, lower);
  for (const lx of axles) roadWheel(k,v,lx,nearSign*wy,wr,true,spin,rimCol);

  // ---- body sides (with a slight tumblehome) and the bonnet/boot deck ----
  const rTop = dent(ring(x0 + 0.03, x1 - 0.02, hw * 0.95, S.cf * 1.05, S.cr * 1.05, bodyTop));
  const sides = loft(k, rSk1, rTop, (n) => lit(paint, shadeFor(n) * dmg), "rgba(255,255,255,.32)");
  const frontFace={a0:rSk1[0],b0:rSk1[1],a1:rTop[0],b1:rTop[1]};
  lampMounts.set(v,([-1,1] as const).map(side=>{const raw=lampFixture(frontFace,side,true,d.design?.lamp).center,p=k.deform?.(raw)??raw;const hurt=lampDamage(v,side<0?0:1);return[x+p[0]*k.c-p[1]*k.s,y+p[0]*k.s+p[1]*k.c,p[2]+(k.roll??0)*p[1]+(k.pitch??0)*p[0]-(hurt>.72&&hurt<.94?.08:0)] as V3;}));
  // shoulder crease highlight (the "gloss" line)
  for (const f of sides) {
    const A = W3(k, onFace(f, 0, 0.62)), B = W3(k, onFace(f, 1, 0.62));
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = Math.max(1, 1.2 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  cap(k, rTop, paint.map((c) => c * dmg) as [number, number, number], 14);
  // extra glasshouse pods stacked on the bonnet and boot of the big ones (multi-cabin monstrosities)
  if (M.cabins > 1) {
    const pods: [number, number][] = M.cabins === 2 ? [[x1 - L * 0.44, x1 - L * 0.2]] : [[x1 - L * 0.44, x1 - L * 0.24], [x0 + L * 0.08, x0 + L * 0.34]];
    for (const [a, b] of pods) {
      const base = (bodyTop(a) + bodyTop(b)) / 2, top = base + H * 0.34;
      const p0 = ring(a, b, hw * 0.72, 0.08, 0.08, () => base), p1 = ring(a + (b - a) * 0.14, b - (b - a) * 0.14, hw * 0.46, 0.08, 0.08, () => top);
      loft(k, p0, p1, (n) => lit(roofPaint, shadeFor(n) * dmg));
      cap(k, p1, roofPaint.map((c) => c * dmg) as [number, number, number], 18);
    }
  }
  // top-plane patina: sun-bleached paint, rust blotches and a racing stripe over bonnet and boot
  if (!S.tray) {
    const sh = (lx: number) => bodyTop(lx) + 0.006, regions: [number, number][] = [[S.cab[1] * L, x1 - 0.07], [x0 + 0.07, S.cab[0] * L]];
    const at = (r: number, t: number, s: number): V3 => { const [a, b] = regions[r]; const lx = a + (b - a) * t; return [lx, s * hw * 0.8, sh(lx)]; };
    if (PT.bleach > 0.02) for (let r = 0; r < 2; r++) fillPoly(k, [at(r, 0.05, -0.85), at(r, 0.95, -0.85), at(r, 0.95, 0.85), at(r, 0.05, 0.85)], `rgba(255,238,215,${(PT.bleach * 0.55).toFixed(3)})`);
    for (const [r, t, sx, sz] of PT.topRust) { const w = sz, c0 = at(r, Math.min(0.9, t), sx); const [lx, ly, lz] = c0; fillPoly(k, [[lx, ly - w * hw * 2, lz], [lx + w * L * 0.7, ly, lz], [lx, ly + w * hw * 2, lz], [lx - w * L * 0.7, ly, lz]], "rgba(132,64,26,.8)"); fillPoly(k, [[lx, ly - w * hw, lz], [lx + w * L * 0.3, ly, lz], [lx, ly + w * hw, lz], [lx - w * L * 0.3, ly, lz]], "rgba(204,112,44,.8)"); }
    if (PT.stripe) for (const off of [-0.16, 0.16]) for (let r = 0; r < 2; r++) fillPoly(k, [at(r, 0, off - 0.09), at(r, 1, off - 0.09), at(r, 1, off + 0.09), at(r, 0, off + 0.09)], PT.stripe);
  }
  // liveries on the long sides
  const longSides = sides.filter((f) => Math.abs(f.a0[0] - f.b0[0]) > L * 0.4);
  if (v.cls === "police" || v.cls === "ambulance" || v.cls === "taxi") {
    const cols = v.cls === "police" ? ["#1c4fd6", "#f6d32c"] : v.cls === "ambulance" ? ["#2d8a3a", "#f6d32c"] : ["#0e0b0a", "#f6d32c"];
    const n = v.cls === "taxi" ? 14 : 8, u0 = v.cls === "taxi" ? 0.55 : 0.18, u1 = v.cls === "taxi" ? 0.72 : 0.78;
    for (const f of longSides) for (let i = 0; i < n; i++) {
      const t0 = 0.06 + (i / n) * 0.88, t1 = 0.06 + ((i + 1) / n) * 0.88;
      fillPoly(k, [onFace(f, t0, u0), onFace(f, t1, u0), onFace(f, t1, u1), onFace(f, t0, u1)], cols[i % 2]);
    }
  } else if (v.cls === "muscle" || v.cls === "super") {
    // racing stripes over the bonnet
    const sh = (lx: number) => bodyTop(lx) + 0.005;
    for (const off of [-0.09, 0.09]) fillPoly(k, [[x1 - 0.05, off - 0.04, sh(x1 - 0.05)], [x1 - 0.05, off + 0.04, sh(x1 - 0.05)], [S.cab[1] * L, off + 0.04, sh(S.cab[1] * L)], [S.cab[1] * L, off - 0.04, sh(S.cab[1] * L)]], v.cls === "super" ? "rgba(14,11,10,.55)" : "rgba(238,228,211,.8)");
  }
  for (const b of ST.bands ?? []) {
    const n = b.n ?? 1;
    for (const f of longSides) for (let i = 0; i < n; i++) {
      const t0 = n > 1 ? 0.04 + (i / n) * 0.92 : 0.02, t1 = n > 1 ? 0.04 + ((i + 1) / n) * 0.92 : 0.98;
      fillPoly(k, [onFace(f, t0, b.u0), onFace(f, t1, b.u0), onFace(f, t1, b.u1), onFace(f, t0, b.u1)], b.cols[i % b.cols.length]);
    }
  }
  if (ST.flames) {
    // tongues of flame licking back from the front wheel arch
    for (const f of longSides) for (let i = 0; i < 4; i++) {
      const t = 0.12 + i * 0.13;
      fillPoly(k, [onFace(f, t, 0.12), onFace(f, t + 0.12, 0.12), onFace(f, t + 0.01, 0.62 - i * 0.1)], i % 2 ? "#f6b62c" : "#ff6a1c");
    }
  }
  if (ST.rust) {
    // rust bloom and a mismatched door
    const seed = v.plate.charCodeAt(1) + v.plate.charCodeAt(2);
    for (const f of longSides) {
      for (let i = 0; i < ST.rust; i++) {
        const t = ((seed * (i + 3) * 37) % 90) / 100 + 0.04, u = ((seed * (i + 5) * 17) % 40) / 100 + 0.05, w = 0.05 + (i % 3) * 0.03;
        fillPoly(k, [onFace(f, t, u), onFace(f, t + w, u + 0.04), onFace(f, t + w * 1.2, u + 0.16), onFace(f, t - 0.01, u + 0.1)], i % 2 ? "rgba(122,62,22,.8)" : "rgba(90,48,20,.75)");
      }
      fillPoly(k, [onFace(f, 0.4, 0.2), onFace(f, 0.6, 0.2), onFace(f, 0.6, 0.95), onFace(f, 0.4, 0.95)], lit(rgb(seed % 2 ? "#9a8d80" : "#4a6a7a"), shadeFor(f.n) * dmg));
    }
  }
  // patina on the near long side only (the far one shows when the car turns)
  {
    const nearIdx = longSides.findIndex((f) => dot(WN(k, f.n), VIEW) > 0);
    const f = nearIdx >= 0 ? longSides[nearIdx] : undefined;
    if (f) for (const m of PT.marks) {
      const t0 = m.t, t1 = m.t + m.w, u0 = m.u, u1 = m.u + m.h, F = (t: number, u: number) => onFace(f, t, u);
      if (m.kind === "rust") {
        fillPoly(k, [F(t0, u0), F(t1, u0 + m.h * 0.3), F(t1 - m.w * 0.2, u1), F(t0 - 0.01, u0 + m.h * 0.7)], m.col);
        fillPoly(k, [F(t0 + m.w * 0.3, u0 + m.h * 0.2), F(t0 + m.w * 0.55, u0 + m.h * 0.25), F(t0 + m.w * 0.45, u0 + m.h * 0.5)], "rgba(190,100,40,.7)");   // a bright orange bloom in the middle
      } else if (m.kind === "dent") {
        fillPoly(k, [F(t0, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u0), F(t1, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u1)], m.col);
        fillPoly(k, [F(t0, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u1), F(t0 + m.w * 0.5, u1 - m.h * 0.12), F(t0 + m.w * 0.05, u0 + m.h * 0.5)], "rgba(255,255,255,.22)");
      } else if (m.kind === "scratch") {
        const A = W3(k, F(t0, u0)), B = W3(k, F(t1, u1)); g.strokeStyle = m.col; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      } else if (m.kind === "primer") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u0 + m.h), F(t0, u0 + m.h)], lit(rgb("#7a6f68"), shadeFor(f.n) * dmg));
        fillPoly(k, [F(t0, u0), F(t0 + 0.012, u0), F(t0 + 0.012, u0 + m.h), F(t0, u0 + m.h)], "rgba(122,62,22,.7)");
      } else if (m.kind === "mud") {
        fillPoly(k, [F(t0, 0), F(t1, 0), F(t1, u1), F(t0, u0 + m.h * 0.55)], m.col);
      } else if (m.kind === "sticker") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u1), F(t0, u1)], m.col);
        fillPoly(k, [F(t0 + m.w * 0.2, u0 + m.h * 0.25), F(t1 - m.w * 0.2, u0 + m.h * 0.25), F(t1 - m.w * 0.2, u0 + m.h * 0.45), F(t0 + m.w * 0.2, u0 + m.h * 0.45)], "rgba(14,11,10,.7)");
      } else if (m.kind === "sill") {
        // a jagged rust line eating up from the sill, the whole length of the car
        const top: [number, number][] = []; for (let k = 0; k <= 10; k++) top.push([t0 + (m.w * k) / 10, u0 + m.h * (0.55 + 0.45 * Math.abs(Math.sin(k * 2.3 + m.h * 40)))]);
        fillPoly(k, [F(t0, u0), F(t1, u0), ...top.reverse().map(([a, b]) => F(a, b))], m.col);
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u0 + m.h * 0.3), F(t0, u0 + m.h * 0.3)], "rgba(70,30,12,.55)");
      } else if (m.kind === "door") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u1), F(t0, u1)], lit(rgb(m.col), shadeFor(f.n) * dmg));
        g.strokeStyle = "rgba(14,11,10,.85)"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath();
        for (const [a, b] of [[t0, u0], [t0, u1], [t1, u1], [t1, u0]] as const) { const q = W3(k, F(a, b)); g.lineTo(q[0], q[1]); } g.closePath(); g.stroke();
      } else if (m.kind === "stripe") {
        fillPoly(k, [F(t0, u0), F(t0 + m.w, u0), F(t0 + m.w, u0 + m.h), F(t0, u0 + m.h)], m.col);
      }
    }
  }
  if (S.tray) {
    // open tray behind the cab
    const tx0 = x0 + 0.06, tx1 = S.cab[0] * L - 0.04, th = bodyTop(tx0);
    fillPoly(k, [[tx0, -hw * 0.82, th - 0.02], [tx1, -hw * 0.82, th - 0.02], [tx1, hw * 0.82, th - 0.02], [tx0, hw * 0.82, th - 0.02]], S.bed ?? "#1c1816");
    g.strokeStyle = lit(paint, 1.15); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    const c = [[tx0, -hw * 0.9], [tx1, -hw * 0.9], [tx1, hw * 0.9], [tx0, hw * 0.9]].map(([a, b]) => W3(k, [a, b, th + 0.03]));
    c.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
  }
  if (S.scoop) {
    const sx0 = x1 - L * 0.32, sx1 = x1 - L * 0.16, sh = bodyTop(sx1);
    fillPoly(k, [[sx0, -0.08, sh], [sx1, -0.08, sh], [sx1, 0.08, sh + 0.05], [sx0, 0.08, sh + 0.05]], lit(paint, 0.55));
  }

  // ---- glasshouse ----
  const glassBase = rgb(night ? "#141c28" : "#2c4058");
  const cb0 = S.cab[0] * L, cb1 = S.cab[1] * L, rf0 = S.roof[0] * L, rf1 = S.roof[1] * L;
  const rCab0 = dent(ring(cb0, cb1, hw * S.cw, 0.12, 0.1, (lx) => bodyTop(lx) - 0.01));
  const roofZ = H * (S.rh ?? 1);
  const rCab1 = dent(ring(rf0, rf1, hw * S.rw, 0.1, 0.08, () => roofZ));
  const seat = rgb("#2a1c16");
  const pillar = lit(paint, 0.75 * dmg);
  const fwdW = WN(k, [1, 0, 0]), frontVisible = dot(fwdW, VIEW) > 0;
  const drawBox = () => {
    const B = S.box!, bx0 = B.a * L, bx1 = B.b * L, base = bodyTop(bx0) - 0.02, col = rgb(B.col);
    const rb0 = ring(bx0, bx1, hw * 0.97, 0.03, 0.03, () => base), rb1 = ring(bx0 + 0.02, bx1 - 0.02, hw * 0.95, 0.03, 0.03, () => H * B.h);
    loft(k, rb0, rb1, (n) => lit(col, shadeFor(n) * dmg), "rgba(255,255,255,.28)");
    cap(k, rb1, col.map((c) => c * dmg) as [number, number, number], 10);
    if (v.cls === "bin") { // lift arm and hopper lip
      const A = W3(k, [bx0 + 0.05, -hw * 0.5, H * B.h + 0.02]), C = W3(k, [bx0 + 0.05, hw * 0.5, H * B.h + 0.02]);
      g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.5 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(C[0], C[1]); g.stroke();
    }
  };
  if (S.box && frontVisible) drawBox(); // the cab is nearer the camera, so the body goes down first
  const glassFaces = loft(k, rCab0, rCab1, (n, i) => {
    if (S.open) return i === 0 || i === 1 || i === 7 ? lit(glassBase, shadeFor(n) * 1.1, 26) : lit(seat, shadeFor(n) * 1.1);
    // vans: painted sides, glass only at the front
    if (S.boxy && !(i === 0 || i === 1 || i === 7)) return lit(paint, shadeFor(n) * dmg);
    const sky = n[2] > 0.4 ? 26 : 0; // raked glass catches the sky
    return lit(glassBase, shadeFor(n) * 1.1, sky + (night ? 0 : 10));
  });
  // pillars: the edges between glass panels, plus a B-pillar in the side windows
  g.strokeStyle = pillar; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
  for (const f of glassFaces) {
    const A = W3(k, f.a0), B = W3(k, f.a1); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
    const C = W3(k, f.b0), D = W3(k, f.b1); g.moveTo(C[0], C[1]); g.lineTo(D[0], D[1]);
    if (Math.abs(f.a0[0] - f.b0[0]) > L * 0.25 && !S.boxy && !S.open) {
      const np = S.pill ?? 1;
      for (let j = 1; j <= np; j++) { const E = W3(k, onFace(f, j / (np + 1), 0)), F = W3(k, onFace(f, j / (np + 1), 1)); g.moveTo(E[0], E[1]); g.lineTo(F[0], F[1]); }
    }
  }
  g.stroke();
  if(z>=1.4)for(const f of glassFaces){const nose=(f.a0[0]+f.b0[0])/2>0&&Math.abs(f.a0[0]-f.b0[0])<L*.18;if(!nose)continue;for(const u of[.28,.7]){strokePoly(k,[onFace(f,u-.1,.08),onFace(f,u+.04,.26)],'#172d2a',1.15*z,false);strokePoly(k,[onFace(f,u-.08,.23),onFace(f,u+.16,.29)],'#a1aaa088',.65*z,false);}}
  // window reflections
  if (!night) for (const f of glassFaces) {
    if (S.boxy) continue;
    fillPoly(k, [onFace(f, 0.15, 0.15), onFace(f, 0.3, 0.15), onFace(f, 0.5, 0.9), onFace(f, 0.35, 0.9)], "rgba(220,235,255,.16)");
  }
  for(const f of glassFaces){const dx=Math.abs(f.b0[0]-f.a0[0]),dy=Math.abs(f.b0[1]-f.a0[1]),cx=(f.a0[0]+f.b0[0])/2,cy=(f.a0[1]+f.b0[1])/2,zone=dx<dy?(cx>0?0:1):(cy>0?3:2),damage=v.components?.glass[zone]??v.glassDamage??0;if(damage<.2||S.boxy&&zone!==0)continue;
   g.save();g.beginPath();[f.a0,f.b0,f.b1,f.a1].forEach((p,i)=>{const q=W3(k,p);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);});g.closePath();g.clip();
   // Fracture coordinates live on this pane. No screen-space zigzags or roof scratches.
   const seed=v.id*17+zone*31,ou=.3+(seed%29)/100,ov=.35+(seed%17)/100,reach=.16+damage*.55,rays=7+Math.floor(damage*5),uv=(u:number,w:number)=>W3(k,onFace(f,u,w));
   g.strokeStyle='#d0e0d49c';g.lineWidth=Math.max(.3,.38*z);const ends:[number,number][]=[];
   for(let j=0;j<rays;j++){const a=j/rays*6.283+(seed%7)*.2,r=reach*(.74+(j*7%13)/40),u=ou+Math.cos(a)*r,w=ov+Math.sin(a)*r;ends.push([u,w]);const A=uv(ou,ov),B=uv(ou+(u-ou)*.43,ov+(w-ov)*.43),C=uv(u,w);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.lineTo(C[0],C[1]);g.stroke();if(damage>.45){const D=uv(ou+(u-ou)*.72,ov+(w-ov)*.72),E=uv(u+(j%2?.035:-.04),w+.06);g.beginPath();g.moveTo(D[0],D[1]);g.lineTo(E[0],E[1]);g.stroke();}}
   for(const radius of[.3,.61,.84]){g.beginPath();ends.forEach(([u,w],i)=>{const q=uv(ou+(u-ou)*radius,ov+(w-ov)*radius);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);});g.closePath();g.stroke();}
   const pane=v.components?.progressive?.panes[zone],lost=1-(pane?.retained??1);if(pane&&pane.retained<1){for(let shard=0;shard<Math.ceil(pane.retained*5);shard++){const u=.15+shard*.14,h=(pane.flutter??0)*(shard%2?1:-1),chip=[onFace(f,u,.1),onFace(f,u+.1,.2),onFace(f,u+.12,.38)].map(([x,y,z])=>[x,y,z+h] as V3);fillPoly(k,chip,'#bbd9d28a');strokePoly(k,chip,'#dce9db',.4*z,true);}}
   if(damage>.75&&zone!==0||lost>.05){const hole=ends.filter((_,i)=>i%2===0).map(([u,w])=>onFace(f,ou+(u-ou)*Math.max(.3,lost),ov+(w-ov)*Math.max(.3,lost)));fillPoly(k,hole,'#182529');strokePoly(k,hole,'#9cb6aa',.35*z,true);}
   g.restore();
  }
  cap(k, rCab1, (S.open ? seat : roofPaint).map((c) => c * dmg) as [number, number, number], S.open ? 4 : 8);
  if (S.box && !frontVisible) drawBox();
  if (S.boxy) { // window line on vans
    for (const f of glassFaces) if (Math.abs(f.a0[0] - f.b0[0]) > L * 0.4) fillPoly(k, [onFace(f, 0.66, 0.35), onFace(f, 0.95, 0.35), onFace(f, 0.95, 0.85), onFace(f, 0.66, 0.85)], lit(glassBase, 1.1, night ? 0 : 12));
  }

  // Door seams, handles and mirrors are fittings on their physical parent panels.
  for(const f of longSides){const span=f.b0[0]-f.a0[0];if(Math.abs(span)<.1)continue;const uFor=(x:number)=>Math.max(.08,Math.min(.92,(x-f.a0[0])/span)),ends=[cb0,Math.min(cb1,(cb0+cb1)*.5),cb1];for(const x of ends)strokePoly(k,[onFace(f,uFor(x),.1),onFace(f,uFor(x),.95)],'#29392f88',.55*z,false);for(const x of[(cb0+cb1)*.5,cb1-.04]){const u=uFor(x);strokePoly(k,[onFace(f,u-.018,.8),onFace(f,u+.018,.8)],'#b0b9a4',.9*z,false);}}
  for(const f of glassFaces){if(Math.abs(f.b0[0]-f.a0[0])<L*.2)continue;const side=(f.a0[1]+f.b0[1])>0?1:-1,index=side<0?0:1;if((v.components?.mirrors?.[index]??(v.mirrorLost?1:0))>.85)continue;const u=Math.max(.1,Math.min(.9,(cb1-.05-f.a0[0])/(f.b0[0]-f.a0[0]))),anchor=onFace(f,u,.1),outer:V3=[anchor[0]+.01,anchor[1]+side*.12,anchor[2]+.015];strokePoly(k,[anchor,outer],'#6d7c6d',1.1*z,false);fillPoly(k,[[outer[0]-.04,outer[1],outer[2]-.025],[outer[0]+.055,outer[1],outer[2]-.025],[outer[0]+.055,outer[1],outer[2]+.04],[outer[0]-.04,outer[1],outer[2]+.04]],'#90aaa3');}
  // ---- roof furniture ----
  const roofMid = (rf0 + rf1) / 2;
  if (v.cls === "police" || v.cls === "ambulance") {
    const on = v.siren && Math.floor(time * 6) % 2 === 0;
    const bar = (lx0: number, lx1: number, w: number, col: string) => fillPoly(k, [[lx0, -w, H + 0.07], [lx1, -w, H + 0.07], [lx1, w, H + 0.07], [lx0, w, H + 0.07]], col);
    bar(roofMid - 0.06, roofMid + 0.06, hw * 0.7, "#222");
    fillPoly(k, [[roofMid - 0.05, -hw * 0.66, H + 0.08], [roofMid + 0.05, -hw * 0.66, H + 0.08], [roofMid + 0.05, 0, H + 0.08], [roofMid - 0.05, 0, H + 0.08]], v.siren ? (on ? "#ff3b2f" : "#5a1410") : "#6a2a26");
    fillPoly(k, [[roofMid - 0.05, 0, H + 0.08], [roofMid + 0.05, 0, H + 0.08], [roofMid + 0.05, hw * 0.66, H + 0.08], [roofMid - 0.05, hw * 0.66, H + 0.08]], v.siren ? (!on ? "#3d7bff" : "#10204a") : "#26386a");
    if (v.siren) {
      cam.toScreen(x + k.c * roofMid, y + k.s * roofMid, H + 0.1, pt);
      const sx = pt.x, sy = pt.y, col = on ? "236,42,28" : "28,107,214";
      GLOW.push((g) => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, 34 * z); grd.addColorStop(0, `rgba(${col},.55)`); grd.addColorStop(1, `rgba(${col},0)`); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, 34 * z, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; });
    }
  }
  if (v.cls === "taxi") {
    cam.toScreen(x + k.c * roofMid, y + k.s * roofMid, H + 0.1, pt);
    g.fillStyle = "#0e0b0a"; g.fillRect(pt.x - 7 * z, pt.y - 5 * z, 14 * z, 5 * z);
    g.fillStyle = "#f6d32c"; g.font = `800 ${Math.max(5, Math.round(4.5 * z))}px monospace`; g.textAlign = "center"; g.fillText("TAXI", pt.x, pt.y - 1.2 * z); g.textAlign = "start";
  }
  if (v.cls === "suv") { // roof rails
    g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.3 * z); g.beginPath();
    for (const sy of [-hw * 0.7, hw * 0.7]) { const A = W3(k, [rf0 + 0.05, sy, H + 0.04]), B = W3(k, [rf1 - 0.05, sy, H + 0.04]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
  }
  if (ST.roof) {
    const rm = roofMid, hz = (S.box ? H * S.box.h : H) + 0.04;
    if (ST.roof === "rack" || ST.roof === "ladder") {
      const r0 = S.box ? S.box.a * L : rf0, r1 = S.box ? S.box.b * L : rf1;
      g.strokeStyle = ST.roof === "ladder" ? "#c9c4bc" : "#1c1816"; g.lineWidth = Math.max(1, 1.3 * z); g.beginPath();
      for (const sy of [-hw * 0.6, hw * 0.6]) { const A = W3(k, [r0 + 0.04, sy, hz]), B = W3(k, [r1 - 0.04, sy, hz]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
      for (let i = 0; i < 5; i++) { const t = r0 + 0.04 + (r1 - r0 - 0.08) * (i / 4), A = W3(k, [t, -hw * 0.6, hz]), B = W3(k, [t, hw * 0.6, hz]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
      g.stroke();
    } else if (ST.roof === "surf") {
      fillPoly(k, [[rf0 + 0.02, -0.07, hz + 0.01], [rf1 - 0.02, -0.04, hz + 0.01], [rf1, 0, hz + 0.01], [rf1 - 0.02, 0.04, hz + 0.01], [rf0 + 0.02, 0.07, hz + 0.01]], lit(rgb(["#3dd6ff", "#ff7ad9", "#c6ff3d"][v.plate.charCodeAt(0) % 3]), 1.05));
    } else if (ST.roof === "pop") {
      const rp0 = ring(rf0 + 0.05, rf1 - 0.05, hw * 0.7, 0.1, 0.1, () => H), rp1 = ring(rf0 + 0.08, rf1 - 0.08, hw * 0.66, 0.1, 0.1, () => H + 0.12);
      loft(k, rp0, rp1, (n) => lit(rgb("#f4f0e4"), shadeFor(n) * dmg));
      cap(k, rp1, rgb("#f4f0e4"), 8);
    } else if (ST.roof === "cone") {
      cam.toScreen(x + k.c * rm, y + k.s * rm, H + 0.12, pt);
      g.fillStyle = "#c98a3a"; g.beginPath(); g.moveTo(pt.x - 3.5 * z, pt.y); g.lineTo(pt.x + 3.5 * z, pt.y); g.lineTo(pt.x, pt.y + 8 * z); g.closePath(); g.fill();
      g.fillStyle = "#ffc2e8"; g.beginPath(); g.arc(pt.x, pt.y - 1.5 * z, 4.2 * z, 0, 6.283); g.fill();
      g.fillStyle = "#fff1d6"; g.beginPath(); g.arc(pt.x, pt.y - 5 * z, 3 * z, 0, 6.283); g.fill();
    } else if (ST.roof === "beacon" || ST.roof === "bar" || ST.roof === "boom") {
      const blink = Math.floor(time * 5) % 2 === 0;
      cam.toScreen(x + k.c * (ST.roof === "boom" ? rm : rm + 0.05), y + k.s * (ST.roof === "boom" ? rm : rm + 0.05), H + 0.1, pt);
      g.fillStyle = blink ? "#ffb02a" : "#7a5410"; g.fillRect(pt.x - 3 * z, pt.y - 3 * z, 6 * z, 3.5 * z);
      if (ST.roof === "boom") { // winch arm over the bed
        g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
        const A = W3(k, [x0 + 0.5, 0, bodyTop(x0) + 0.02]), B = W3(k, [x0 + 0.1, 0, bodyTop(x0) + 0.3]);
        g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      }
      if (night && blink) { const sx = pt.x, sy = pt.y; GLOW.push((g) => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, 22 * z); grd.addColorStop(0, "rgba(255,176,42,.5)"); grd.addColorStop(1, "rgba(255,176,42,0)"); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, 22 * z, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; }); }
    }
  }
  if (PT.aerial && !S.open) {   // a whip aerial off the back corner
    const A = W3(k, [rf0 + 0.05, hw * 0.7, roofZ]), B = W3(k, [rf0 - 0.12, hw * 0.78, roofZ + 0.3]);
    g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  if (ST.spare && !frontVisible) {
    const sp: number[][] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; sp.push(W3(k, [x0 - 0.04, Math.cos(a) * 0.12, H * 0.55 + Math.sin(a) * 0.12])); }
    g.fillStyle = "#121010"; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.fillStyle = "#8a8580"; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, p = W3(k, [x0 - 0.045, Math.cos(a) * 0.06, H * 0.55 + Math.sin(a) * 0.06]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.closePath(); g.fill();
  }
  if (S.wing) {
    const wx0 = x0 + 0.03, wx1 = x0 + 0.17, wh = bodyTop(x0) + (v.cls === "super" ? 0.16 : 0.13);
    g.strokeStyle = lit(paint, 0.4); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    for (const sy of [-hw * 0.6, hw * 0.6]) { const A = W3(k, [wx0 + 0.07, sy, bodyTop(x0)]), B = W3(k, [wx0 + 0.07, sy, wh]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
    fillPoly(k, [[wx0, -hw * 0.95, wh], [wx1, -hw * 0.95, wh + 0.02], [wx1, hw * 0.95, wh + 0.02], [wx0, hw * 0.95, wh]], lit(paint, v.cls === "super" ? 0.35 : 0.85));
  }

  // ---- lights (only on the ends that face the camera) ----
  const hl = night || v.siren ? (PT.yellowLamps ? "#f2d27a" : "#fff8d8") : PT.yellowLamps ? "#cdb878" : "#e8e2c8";
  const brake = v.state === "crashed" || (v.braking ?? (v.state === "drive" && v.speed < 0.5));
  const rearFace={a0:rSk1[4],b0:rSk1[5],a1:rTop[4],b1:rTop[5]},end=frontVisible?frontFace:rearFace,mounts:[number,number,number][]=[];
  if(end){const frontEnd=frontVisible,kind=d.design?.lamp??(S.boxy?'square':'slit');for(const side of[-1,1] as const){const fixture=lampFixture(end,side,frontEnd,kind),index=(frontEnd?0:2)+(side>0?1:0),hurt=lampDamage(v,index),signal=(v.hazards||v.indicator===(side<0?'left':'right'))&&Math.floor(time*1.6)%2===0,lights=(v.lights??night)&&(v.components?.structure?.battery??0)<.8,colour=hurt>.94?'#25342e':signal?'#e7ac50':frontEnd?(lights?hl:'#b9c5bc'):brake?'#ed6b54':lights?'#b84f41':'#763f38';
   fillPoly(k,fixture.housing,'#293731');strokePoly(k,fixture.housing,'#89958a',.55*z,true);
   if(hurt<=.72||hurt>=.94){if(kind==='round'||kind==='quad'){const count=kind==='quad'?2:1;for(let j=0;j<count;j++){const u=fixture.u+(count===2?(j-.5)*.12:0),pts=Array.from({length:20},(_,i)=>surfacePoint(end,u+Math.cos(i/20*6.283)*(count===2?.055:.105),fixture.v+Math.sin(i/20*6.283)*.15));fillPoly(k,pts,colour);strokePoly(k,pts,'#b9c2b3',.45*z,true);}}
   else fillPoly(k,fixture.lens,colour);}
   if(!frontEnd&&hurt<=.72){fillPoly(k,surfacePatch(end,fixture.u-.11,fixture.u-.055,fixture.v-.12,fixture.v+.12),v.speed<0?'#e8e7d1':'#a5aaa0');fillPoly(k,surfacePatch(end,fixture.u+.07,fixture.u+.12,fixture.v-.12,fixture.v+.12),signal?'#e2a347':'#a38348');}
   if(hurt>.25){strokePoly(k,[surfacePoint(end,fixture.u-.08,fixture.v-.1),surfacePoint(end,fixture.u+.015,fixture.v+.08),surfacePoint(end,fixture.u+.08,fixture.v-.08)],'#c3c5b988',.4*z,false);}
   const center:V3=[fixture.center[0],fixture.center[1],fixture.center[2]-(hurt>.72&&hurt<.94?.08+Math.sin(time*2)*.012:0)],q=W3(k,center);mounts.push([q[0],q[1],index]);
   if(hurt>.72&&hurt<.94){const anchor=fixture.center,lens=fixture.lens.map(([x,y,h])=>[x+(frontEnd?.02:-.02),y,h-.08-Math.sin(time*2)*.012] as V3);strokePoly(k,[anchor,[anchor[0],anchor[1],anchor[2]-.09]],'#252d29',.5*z,false);fillPoly(k,lens,colour);}
  }
  const bumper=v.components?.bumpers?.[frontEnd?0:1]??(v.components?.bumperZone===(frontEnd?0:1)?v.components.bumper:1);if(bumper>0){const panel=surfacePatch(end,.055,.945,.025,.14),hinge=surfacePoint(end,.1,.08);if(bumper<.6){const dropped=panel.map(([x,y,h])=>[x,y,h-(.035+(1-bumper)*.09)] as V3);strokePoly(k,[hinge,dropped[0]],'#3b493e',.7*z,false);fillPoly(k,dropped,'#68786b');}else fillPoly(k,panel,'#69786d');}
  // Grille, plate and trim follow the same deformed face as the lights.
  fillPoly(k,surfacePatch(end,.37,.63,.12,.45),frontVisible?'#24322c':'#d4d5c4');
  if(frontVisible)for(let j=0;j<5;j++)strokePoly(k,[surfacePoint(end,.4+j*.05,.15),surfacePoint(end,.4+j*.05,.43)],'#879286',.45*z,false);
  }
  if((v.water?.submersion??0)<.2&&((v.lights??night)||brake)&&!(v.state==='parked'&&v.driver<0&&v.lights!==true))for(const [sx,sy,index]of mounts){if((v.components?.structure?.battery??0)>=.8||lampDamage(v,index)>.94||index<2&&!(v.lights??night))continue;const color=index<2?'235,230,197':'200,74,54',r=(index<2?6:brake?7:4)*M.scale*z;GLOW.push(layer=>{const grd=layer.createRadialGradient(sx,sy,0,sx,sy,r);grd.addColorStop(0,`rgba(${color},.4)`);grd.addColorStop(1,`rgba(${color},0)`);layer.fillStyle=grd;layer.beginPath();layer.arc(sx,sy,r,0,6.283);layer.fill();});}

  // Metal creases and primer scuffs are clipped to the actual visible sheet-metal faces.
  for(const f of sides){const dx=Math.abs(f.b0[0]-f.a0[0]),dy=Math.abs(f.b0[1]-f.a0[1]),cx=(f.a0[0]+f.b0[0])/2,cy=(f.a0[1]+f.b0[1])/2,zone=dx<dy?(cx>0?0:1):(cy>0?3:2),amount=[dF,dR,dL,dS][zone];if(amount<.15)continue;g.save();g.beginPath();[f.a0,f.b0,f.b1,f.a1].forEach((p,i)=>{const q=W3(k,p);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);});g.closePath();g.clip();
   for(let j=0;j<Math.ceil(amount*7);j++){const u=.16+(j*17%63)/100,w=.25+(j%3)*.16,pts=[onFace(f,u,w),onFace(f,u+.07,w+.04),onFace(f,u+.2,w-.03)];strokePoly(k,pts,j%2?'#c1b79b':'#39423b',Math.max(.35,z*.65),false);}
   g.restore();
  }
  if (dF > 0.45 || v.damage > 0.75) {
    for (let i = 0; i < 4; i++) {
      const ph = (time * 0.5 + i / 4) % 1;
      const p = W3(k, [x1 - L * 0.18, (i % 2 ? 0.08 : -0.08), bodyTop(x1 - L * 0.18) + ph * 0.9]);
      g.fillStyle = `rgba(${dF > 0.75 ? "40,36,34" : "190,186,180"},${((1 - ph) * 0.35).toFixed(3)})`;
      g.beginPath(); g.arc(p[0] + Math.sin(time * 2 + i) * 3 * z, p[1], (0.06 + ph * 0.16) * z * 10, 0, 6.283); g.fill();
    }
  }

  if (v.leak) { const P=W3(k,[-L*.2,0,.01]);g.fillStyle="rgba(12,8,10,.75)";g.beginPath();g.ellipse(P[0],P[1]+8*z,12*z*v.leak,4*z,0,0,Math.PI*2);g.fill(); }

  if (v.burning) { for(let i=0;i<5;i++){const P=W3(k,[x1-L*.2,(i-2)*.06,H*.7]);g.fillStyle=i%2?"#ffb52e":"#ec3b12";g.beginPath();g.moveTo(P[0]-4*z,P[1]);g.lineTo(P[0]+Math.sin(time*9+i)*3*z,P[1]-(10+Math.sin(time*7+i)*5)*z);g.lineTo(P[0]+4*z,P[1]);g.fill();} }
  if (v.burnt && (v.burntAge ?? 0) < 0.8) { const P=W3(k,[0,0,H]); const r=(12+(v.burntAge??0)*40)*z; g.fillStyle="rgba(255,170,30,.6)";g.beginPath();g.arc(P[0],P[1],r,0,Math.PI*2);g.fill(); }


  if(v.components){const p=v.components;
   if(p.hoodGone||p.hoodLoose){const [a,b]=bonnetSection(S,L),h=bodyTop(b)+.016,span=b-a;
    const electric=['ev','compact_ev','estate_ev','deliveryev'].includes(d.design?.base??v.cls),running=v.driver>=0&&!v.burnt,rpm=v.powertrain?.rpm??900,phase=running?time*Math.min(100,rpm/18):0;
    fillPoly(k,[[a,-hw*.8,h],[b,-hw*.8,h],[b,hw*.8,h],[a,hw*.8,h]],'#1d2928');
    // Engine block, mounted transversely; the bay follows the same collision deformation as the body.
    const block=[a+span*.22,b-span*.25],left=-hw*.37,right=hw*.37;
    fillPoly(k,[[block[0],left,h+.025],[block[1],left,h+.025],[block[1],right,h+.08],[block[0],right,h+.08]],electric?'#515f61':'#68736d');
    fillPoly(k,[[block[0]+span*.04,left*.82,h+.09],[block[1]-span*.04,left*.82,h+.09],[block[1]-span*.04,right*.82,h+.12],[block[0]+span*.04,right*.82,h+.12]],electric?'#829692':'#3f4b48');
    for(let j=0;j<4;j++){const y=-hw*.25+j*hw*.16;strokePoly(k,[[block[0]+span*.06,y,h+.13],[block[1]-span*.06,y,h+.13]],electric?'#a9bfba':'#9ca99f',Math.max(.5,z*.65),false);}
    // Radiator, battery and plumbing are separately coloured to remain readable at game scale.
    if(!p.engineMounts?.radiator_core?.detached){const r=p.engineMounts?.radiator_core,offset=(r?.angle??0)*.08;fillPoly(k,[[b-span*.12,-hw*.7,h+.02],[b-span*.06,-hw*.7,h+.02+offset],[b-span*.06,hw*.7,h+.02+offset],[b-span*.12,hw*.7,h+.02]],(p.parts?.radiator_core??0)>.6?'#71675b':'#84918a');}
    if(!p.engineMounts?.battery_cable?.detached)fillPoly(k,[[a+span*.08,hw*.47,h+.04],[a+span*.25,hw*.47,h+.04],[a+span*.25,hw*.69,h+.04],[a+span*.08,hw*.69,h+.04]],(p.parts?.battery_cable??0)>.6?'#776754':'#b0aa91');
    if(!p.engineMounts?.coolant_hose?.detached)strokePoly(k,[[a+span*.22,-hw*.52,h+.06],[a+span*.55,-hw*.58,h+.09+(p.engineMounts?.coolant_hose?.angle??0)*.08],[b-span*.08,-hw*.5,h+.04]],electric?'#eaa655':'#b39a73',Math.max(.7,z),false);
    if(!electric&&!p.engineMounts?.intake?.detached)fillPoly(k,[[a+span*.48,hw*.17,h+.11],[a+span*.77,hw*.17,h+.11],[a+span*.77,hw*.39,h+.11+(p.engineMounts?.intake?.angle??0)*.08],[a+span*.48,hw*.39,h+.11]],(p.parts?.intake??0)>.6?'#5f5044':'#46534f');
    if(!electric&&!p.engineMounts?.alternator?.detached){const ax=a+span*.32,ay=hw*.38,loose=(p.engineMounts?.alternator?.angle??0)*.08;fillPoly(k,[[ax,ay,h+.08],[ax+span*.12,ay,h+.08+loose],[ax+span*.12,ay+hw*.15,h+.08+loose],[ax,ay+hw*.15,h+.08]],(p.parts?.alternator??0)>.6?'#7f6c58':'#b5b6a0');}
    if(!electric&&z>=.65){const x=b-span*.19,y=0,r=Math.min(span*.1,hw*.2),fan=(v.components?.parts?.cooling_fan??0)<.9&&!p.engineMounts?.cooling_fan?.detached;
     strokePoly(k,[[x,-r,h+.07],[x,r,h+.07]],'#263734',Math.max(1,z*2),false);
     if(!p.engineMounts?.cooling_fan?.detached)for(let j=0;j<3;j++){const angle=(fan?phase:0)+j*Math.PI*2/3+(p.engineMounts?.cooling_fan?.angle??0);strokePoly(k,[[x,y,h+.09],[x+Math.cos(angle)*r,y+Math.sin(angle)*r,h+.09]],fan?'#c1c6ad':'#665d4d',Math.max(.6,z*.8),false);}
     const bx=a+span*.13,by=-hw*.42,br=hw*.1;if(!p.engineMounts?.drive_belt?.detached)strokePoly(k,[[bx-br,by,h+.08],[bx+br,by,h+.08],[x,by,h+.08]],'#2e3632',Math.max(.8,z),false);
     const angle=(v.components?.parts?.drive_belt??0)>.9?0:phase;if(!p.engineMounts?.drive_belt?.detached)strokePoly(k,[[bx,by,h+.1],[bx+Math.cos(angle)*br,by+Math.sin(angle)*br,h+.1]],'#c2bba6',Math.max(.6,z*.7),false);
    }
   }
   if(p.boot!==undefined&&p.boot<.55){const a=x0+.04,b=Math.min(S.cab[0]*L-.03,-L*.12),h=bodyTop(a)+.025;fillPoly(k,[[a,-hw*.75,h],[b,-hw*.75,h],[b,hw*.75,h],[a,hw*.75,h]],'#202b29');if(!p.bootGone){const lift=(.55-p.boot)*.12+(p.progressive?.hinges?.[1]?.angle??0)*L*.16;meshFace(k,[[a,-hw*.75,h+lift],[b,-hw*.75,bodyTop(b)+.03],[b,hw*.75,bodyTop(b)+.03],[a,hw*.75,h+lift]],v.color,[0,0,1]);}}
   if(p.hoodLoose&&!p.hoodGone){const [a,b]=bonnetSection(S,L),span=Math.max(.02,b-a),angle=Math.min(1.1,.2+(1-p.hood)*.45+(p.progressive?.hinges?.[0]?.angle??0)*.65),front=a+span*Math.cos(angle),base=bodyTop(a)+.025,tip=bodyTop(b)+.025+span*Math.sin(angle);meshFace(k,[[a,-hw*.82,base],[front,-hw*.82,tip],[front,hw*.82,tip],[a,hw*.82,base]],v.color,[0,0,1]);}


  }


  if (v.forSale) {
    cam.toScreen(x, y, H + 0.55, pt);
    const fs = Math.max(8, Math.round(7 * z));
    g.font = `700 ${fs}px "IBM Plex Mono", monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    const label = `$${v.price.toLocaleString("en-NZ")}`;
    const w = g.measureText(label).width + fs;
    g.fillStyle = "#c6ff3d"; g.fillRect(pt.x - w / 2, pt.y - fs * 0.8, w, fs * 1.6);
    g.fillStyle = "#0e0b0a"; g.fillText(label, pt.x, pt.y + 1); g.textAlign = "start"; g.textBaseline = "alphabetic";
  }
  drawWorkingDetails(k,v,L,hw,H,time,S.tray===true);
  // A struck underside exposes a displaced exhaust line that moves with the chassis.
  const under=v.components?.underbody;if(under?.points?.length===70){const hurt=under.points.reduce((sum,p)=>sum+p.damage,0)/70;if(hurt>.015){const sag=Math.min(.16,hurt*.6)+Math.sin(time*8)*Math.min(.025,hurt*.08)*Math.min(1,Math.abs(v.speed)/4);strokePoly(k,[[-L*.36,nearSign*hw*.48,.14],[-L*.1,nearSign*hw*.48,.12-sag],[L*.22,nearSign*hw*.48,.13]],'#a39c88',Math.max(1,z*1.5),false);}}

  // Separate outer skins buckle, hang on a hinge and eventually expose the inner frame.
  for(const f of sides){const zone=Math.abs(f.a0[0]-f.b0[0])<Math.abs(f.a0[1]-f.b0[1])?((f.a0[0]+f.b0[0])>0?0:1):((f.a0[1]+f.b0[1])>0?3:2),skin=v.components?.progressive?.skins[zone];if(!skin||damageStage(v.components!.panels[zone])<2)continue;const patch=surfacePatch(f,.2,.8,.2,.85);if(skin.gone){fillPoly(k,patch,'#192725');strokePoly(k,[onFace(f,.25,.25),onFace(f,.7,.7)],'#7f8a79',z,false);}else{const curled=patch.map(([x,y,h],i)=>[x,y,h+(i<2?0:skin.curl*.07+skin.flutter)] as V3);meshFace(k,curled,v.color,f.n);strokePoly(k,curled,'#a8ad97',.6*z,true);}}
  // Impact-local folded seams and exposed primer remain attached to the crushed material.
  if(z>=.65)for(const dent of dents.slice(-6)){if(dent.energy<.045)continue;const side=dent.zone>=2,normal:V3=side?[0,dent.zone===3?1:-1,0]:[dent.zone===0?1:-1,0,0];if(dot(WN(k,normal),VIEW)<=0)continue;const span=.035+Math.min(.12,dent.depth*.55),cx=Math.max(-.43,Math.min(.43,dent.x)),cy=Math.max(-.42,Math.min(.42,dent.y));const point=(u:number,h:number):V3=>side?[(cx+u)*L,normal[1]*hw*.965,h*H]:[normal[0]*L*.487,(cy+u)*hw*2,h*H];
   for(let strip=0;strip<3;strip++){const h=.35+strip*.07,off=(strip-1)*span*.25;const scar=[point(off-span,h),point(off-span*.35,h+.025),point(off+span,h-.015),point(off+span*.45,h-.035)];fillPoly(k,scar,strip===1?'#b5b9a9':'#414b49');strokePoly(k,[point(off-span*.8,h+.018),point(off,h-.01),point(off+span*.8,h+.015)],'#d0c9b6',Math.max(.45,z*.45),false);}
   if(!side&&dent.energy>.12){const along=normal[0],fold=(u:number,y:number):V3=>{const x=along*(.42-u)*L;return[x,Math.max(-.8,Math.min(.8,cy*2+y))*hw,bodyTop(x)+.012];};strokePoly(k,[fold(0,-.35),fold(.035,-.1),fold(.01,.14),fold(.055,.35)],'#3e4b46',Math.max(.6,z*.65),false);strokePoly(k,[fold(.015,-.35),fold(.05,-.1),fold(.025,.14),fold(.07,.35)],'#c5c4ae',Math.max(.4,z*.4),false);}
  }
  // Contact stains travel with the deformed panel and darken as they dry. Bounded at 12.
  if(damageBloodEnabled())for(const stain of v.components?.blood??[]){if(Math.abs(stain.x)>.36?(stain.x>0)!==frontVisible:dot(WN(k,[0,Math.sign(stain.y),0]),VIEW)<=0)continue;const p=W3(k,[stain.x*L,stain.y*hw*2,stain.z*H]);g.fillStyle=stain.age>60?'#55262b':'#a52b36';g.beginPath();g.ellipse(p[0],p[1],Math.max(.7,stain.size*z*12),Math.max(.5,stain.size*z*5),-.35,0,Math.PI*2);g.fill();g.strokeStyle='#72232d';g.lineWidth=Math.max(.5,z*.5);g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0]+z,p[1]+stain.size*z*13);g.stroke();}
  // Damaged door skins remain hinged, flutter in the airflow, and expose the cabin after detachment.
  if(v.components?.doorHinges)for(const side of [-1,1]){const i=side<0?0:1,hinge=v.components.doorHinges[i],gone=v.components.doorGone?.[i];if(hinge>=.55&&!gone||dot(WN(k,[0,side,0]),VIEW)<=0)continue;const y=side*hw*.99,lo=H*.32,hi=H*.58;fillPoly(k,[[-L*.2,y,lo],[L*.14,y,lo],[L*.14,y,hi],[-L*.2,y,hi]],'#26302c');if(!gone){const open=(.55-hinge)*.12+(v.components.progressive?.hinges?.[i+2]?.angle??0)*L*.16,outer=y+side*open;fillPoly(k,[[-L*.2,y,lo],[L*.14,outer,lo-.02],[L*.14,outer,hi],[-L*.2,y,hi]],v.color);strokePoly(k,[[-L*.2,y,hi],[L*.14,outer,hi],[L*.14,outer,lo-.02]],'#a6aa98',Math.max(.6,z*.7),false);}}
  if(structure)for(const side of [-1,1])if(structure.doors[side<0?0:1]>.5)strokePoly(k,[[-L*.16,side*hw*.98,H*.3],[L*.15,side*hw*.98,H*.56]],'#302c28',Math.max(.7,z),false);
  // Electric vehicles have no tailpipe. Working diesels darken gently under engine load.
  const working=utilitySpec(v),electric=working?!working.diesel:['ev','compact_ev','estate_ev','deliveryev'].includes(d.design?.base??v.cls);
  if (!electric&&z>=.8&&(Math.abs(v.speed) > 0.3 || v.state === "drive")) {
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.9 + i / 3 + spin * 0.01) % 1;
      const p = W3(k, [x0 - 0.04 - ph * 0.5 * M.scale, (i % 2 ? 1 : -1) * hw * 0.45, 0.06 + ph * 0.4 * M.scale]);
      const load=working?.diesel?(v.utility?.engineLoad??.25):0;
      g.fillStyle = `rgba(${load>.6?'108,111,108':'200,196,190'},${((1 - ph) * (0.2+load*.16)).toFixed(3)})`;
      g.beginPath(); g.arc(p[0], p[1], (0.035 + ph * 0.12) * M.scale * z * 10, 0, 6.283); g.fill();
    }
  }
  if (selected) { cam.toScreen(x, y, 0, pt); g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.beginPath(); g.ellipse(pt.x, pt.y, L * 26 * z, L * 13 * z, 0, 0, 6.283); g.stroke(); }
}

/** Fixed-cost fittings: catalogue size never determines per-car geometry or particle counts. */
function drawWorkingDetails(k:Ctx,v:Vehicle,L:number,hw:number,H:number,time:number,tray:boolean):void {
 const spec=utilitySpec(v);if(!spec||k.cam.zoom<.9)return;
 const fill=Math.max(0,Math.min(1,(v.utility?.payload??spec.capacity*spec.defaultLoad)/Math.max(.1,spec.capacity))),z=k.cam.zoom;
 const box=(x:number,y:number,w:number,d:number,h:number,colour:string)=>{const lo:V3[]=[[x-w/2,y-d/2,H*.55],[x+w/2,y-d/2,H*.55],[x+w/2,y+d/2,H*.55],[x-w/2,y+d/2,H*.55]],hi=lo.map(p=>[p[0],p[1],p[2]+h] as V3);loft(k,lo,hi,()=>colour,'#3c463c');cap(k,hi,rgb(colour));};
 if((spec.kind==='tanker'||spec.kind==='fire')&&tray) {
   const radius=hw*.75,cx=-L*.15,half=L*.23,cy=0,cz=H*.73;
   const left:V3[]=[],right:V3[]=[];
   for(let i=0;i<10;i++){const a=i/10*Math.PI*2;left.push([cx-half,cy+Math.cos(a)*radius,cz+Math.sin(a)*radius*.72]);right.push([cx+half,cy+Math.cos(a)*radius,cz+Math.sin(a)*radius*.72]);}
   for(let i=0;i<10;i++)fillPoly(k,[left[i],left[(i+1)%10],right[(i+1)%10],right[i]],i<5?'#a4ada6':'#69766e');
   fillPoly(k,left,'#64746b');fillPoly(k,right,'#a9b2aa');
   for(const x of[cx-half*.65,cx+half*.65])strokePoly(k,Array.from({length:11},(_,i)=>[x,Math.cos(i/10*Math.PI*2)*radius,cz+Math.sin(i/10*Math.PI*2)*radius*.72] as V3),'#41524b',1.5*z);
 } else if(spec.kind==='refuse') {
   box(-L*.16,0,L*.46,hw*1.75,H*.48,'#6a7e58');
   strokePoly(k,[[-L*.34,-hw*.89,H*.64],[-L*.09,-hw*.89,H*.92],[L*.04,-hw*.89,H*.7]],'#b7ba87',2*z);
 } else if(fill>.05&&tray&&['freight','equipment','timber','roadwork','aggregate'].includes(spec.kind)) {
   if(spec.kind==='timber') {
     for(let i=0;i<Math.min(4,1+Math.ceil(fill*3));i++){const y=(i-1.5)*hw*.32;strokePoly(k,[[-L*.49,y,H*.63],[L*.025,y,H*.63]],i%2?'#9d8055':'#b29b6b',Math.max(2,hw*9*z));}
   } else if(spec.kind==='aggregate') {
     box(-L*.2,0,L*.43,hw*1.55,H*.12+fill*H*.2,'#8e8c77');
   } else {
     const n=Math.min(3,Math.ceil(fill*3));for(let i=0;i<n;i++){const x=-L*.35+i*L*.13;box(x,0,L*.12,hw*1.3,H*(.17+fill*.1),i%2?'#858671':'#a18d69');strokePoly(k,[[x,-hw*.65,H*.56],[x,0,H*(.75+fill*.1)],[x,hw*.65,H*.56]],'#444d43',z);}
   }
 }
 if(spec.kind==='refrigerated'&&z>1.1){box(-L*.24,0,L*.14,hw*.9,H*.12,'#c3c8b7');strokePoly(k,[[-L*.28,-hw*.46,H*.63],[-L*.18,-hw*.46,H*.63]],'#53665d',z);}
 if(spec.kind==='tow'){strokePoly(k,[[-L*.3,0,H*.8],[-L*.56,0,H*.52],[-L*.56,0,.15]],'#b3b4a5',z);strokePoly(k,[[-L*.56,0,.15],[-L*.52,0,.12],[-L*.50,0,.18]],'#7c8880',2*z);}
 if(spec.beacon&&(v.driver>=0||v.siren||v.hazards)&&!v.burnt){
   const flashing=.55+.45*Math.sin(time*5+v.id),point=W3(k,[L*.16,0,H*1.04]);
   k.g.fillStyle=spec.kind==='police'?'#75a4cf':spec.kind==='ambulance'||spec.kind==='fire'?'#b95345':'#ca9e42';k.g.globalAlpha=.65+flashing*.3;
   k.g.beginPath();k.g.ellipse(point[0],point[1],Math.max(1.5,3*z),Math.max(1,2*z),0,0,Math.PI*2);k.g.fill();k.g.globalAlpha=1;
 }
}

/** Headlight beams (drawn in the lighting pass, additive): a beam from each lamp fanning onto a lit pool of road ahead. */
export function headlights(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, strength: number,world?:World,traffic:readonly Vehicle[]=[]): void {
 if((v.water?.submersion??0)>.2||(v.components?.structure?.battery??0)>=.8||v.lights===false||lampDamage(v,0)>.94&&lampDamage(v,1)>.94)return;
  if (strength < 0.1 || v.state === "parked" && v.driver < 0 && v.lights!==true) return;
  const d = VEHICLES[v.cls], M = carMutationOf(v.plate, v.cls);
  const ca = Math.cos(v.heading), sa = Math.sin(v.heading);
  const L = d.length * M.scale, hw = d.width * M.scale * 0.36, spread = 1.05 * M.scale;
  let reach = 5.5 * M.scale;
  const nx = v.x + ca * (L * 0.5 + 0.1), ny = v.y + sa * (L * 0.5 + 0.1);
  for(const other of traffic){if(other===v)continue;const dx=other.x-nx,dy=other.y-ny,ahead=dx*ca+dy*sa,side=Math.abs(-dx*sa+dy*ca);if(ahead>0&&side<.8*M.scale)reach=Math.min(reach,Math.max(.45,ahead-VEHICLES[other.cls].length*.5));}
  if(world)for(let n=.4;n<reach;n+=.4){const tile=world.tile(Math.floor(nx+ca*n),Math.floor(ny+sa*n));if(tile===T.BUILDING||tile===T.WALL||tile===T.TREE||tile===T.HEDGE){reach=n;break;}}
  const p = { x: 0, y: 0 }, q = { x: 0, y: 0 }, c = { x: 0, y: 0 }, e = { x: 0, y: 0 };
  // the lit pool on the road: brightest a few metres ahead, soft at the edges
  const px = nx + ca * reach * 0.55, py = ny + sa * reach * 0.55;
  cam.toScreen(px, py, 0, p); cam.toScreen(px + ca * reach * 0.5, py + sa * reach * 0.5, 0, q); cam.toScreen(px - sa * spread, py + ca * spread, 0, c);
  const rL = Math.hypot(q.x - p.x, q.y - p.y), rW = Math.hypot(c.x - p.x, c.y - p.y);
  g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(q.y - p.y, q.x - p.x)); g.scale(1, rW / Math.max(rL, 1));
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, rL);
  pool.addColorStop(0, `rgba(255,236,180,${0.08 * strength})`); pool.addColorStop(0.6, `rgba(255,236,180,${0.035 * strength})`); pool.addColorStop(1, "rgba(255,236,180,0)");
  g.fillStyle = pool; g.beginPath(); g.arc(0, 0, rL, 0, 6.283); g.fill(); g.restore();
  // one cone per lamp, slightly toed out, so the beams read as two
  for (const s of [-1, 1]) {
    if(lampDamage(v,s<0?0:1)>.94)continue;
    const mount=lampMounts.get(v)?.[s<0?0:1],lx=mount?.[0]??nx-sa*hw*s,ly=mount?.[1]??ny+ca*hw*s;
    const fx = lx + ca * reach - sa * s * 0.6, fy = ly + sa * reach + ca * s * 0.6;
    cam.toScreen(lx - sa * 0.08, ly + ca * 0.08, 0, p); cam.toScreen(lx + sa * 0.08, ly - ca * 0.08, 0, q);
    cam.toScreen(fx + sa * spread * 0.6, fy - ca * spread * 0.6, 0, c); cam.toScreen(fx - sa * spread * 0.6, fy + ca * spread * 0.6, 0, e);
    const grd = g.createLinearGradient((p.x + q.x) / 2, (p.y + q.y) / 2, (c.x + e.x) / 2, (c.y + e.y) / 2);
    grd.addColorStop(0, `rgba(255,246,210,${0.11 * strength})`); grd.addColorStop(0.5, `rgba(255,240,190,${0.04 * strength})`); grd.addColorStop(1, "rgba(255,240,190,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.lineTo(q.x, q.y); g.closePath(); g.fill();
    // The body pass draws the hot core on the lens, avoiding a second floating light.
  }
}

function roadWheel(k:Ctx,v:Vehicle,x:number,y:number,r:number,near:boolean,spin:number,color:string):void{
 const i=(x>0?0:2)+(y>0?1:0),w=v.components?.wheels[i];if(w?.missing)return;
 const drive=handlingProfile(v.cls).drive;if(v.dynamics?.wheels[i])spin=v.dynamics.wheels[i].rotation/Math.max(.05,r);else if(drive==='awd'||(drive==='fwd'?x>0:x<0))spin+=(v.wheelSpinTravel??0)/Math.max(.05,r);
 const looseness=Math.max(0,.65-(w?.attachment??1)),wobble=looseness*(.28+Math.sin(spin*2)*.12),offset=(y>0?1:-1)*looseness*.18;
 const cx=k.x+x*k.c-(y+offset)*k.s,cy=k.y+x*k.s+(y+offset)*k.c,ang=v.heading+(y>0?1:-1)*wobble+(x>0?ackermannAngle(v.wheelSteer??v.steerAngle??0,vehicleGeometry(v).wheelbase,vehicleGeometry(v).width,y>0?1:-1):0)+(w?.alignment??0),ctx={...k,x:cx,y:cy,c:Math.cos(ang),s:Math.sin(ang),roll:0,pitch:0,deform:undefined};
 wheel(ctx,0,0,r*(1-(w?.rim??0)*.08),near,spin,color,w?w.puncture:(y<0?v.flatLeft:v.flatRight));
 const wheelHeat=Math.max(v.utility?.brakeHeat??0,v.dynamics?.wheels[i]?.brakeHeat??0);if(near&&wheelHeat>.55&&k.cam.zoom>1.2){const heat=(wheelHeat-.55)/.45,q=W3(ctx,[0,0,r]);k.g.strokeStyle=`rgba(205,111,53,${heat*.65})`;k.g.lineWidth=Math.max(.7,k.cam.zoom);k.g.beginPath();k.g.ellipse(q[0],q[1],r*11*k.cam.zoom,r*15*k.cam.zoom,-.4,0,Math.PI*2);k.g.stroke();}
 if(w&&w.rim>.3){const q=W3(ctx,[0,0,r]);k.g.strokeStyle='#a9b3a2';k.g.lineWidth=k.cam.zoom;k.g.beginPath();k.g.moveTo(q[0]-3*k.cam.zoom,q[1]-r*12*k.cam.zoom);k.g.lineTo(q[0]+3*k.cam.zoom,q[1]+r*10*k.cam.zoom);k.g.stroke();}
}
export function drawVehicleFragment(g:CanvasRenderingContext2D,cam:Camera,v:Vehicle,index:number):void{
 for(const d of (v.components?.debris[index]?[v.components.debris[index]]:[])){if(d.size&&d.kind!=='wheel'){const size=d.size,roll=d.roll??0,pitch=d.pitch??0,co=Math.cos(d.spin),si=Math.sin(d.spin),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),raw=d.kind==='glass'?[[-1,-.6,0],[.8,-.8,0],[.3,.85,0]]:[[-1,-.6,0],[.8,-.8,0],[1,.65,(d.curl??0)*.8],[-.7,.8,0]],points=raw.map(([x,y,z])=>{x*=size;y*=size;z*=size;const yy=y*cr-z*sr,zz=y*sr+z*cr,xx=x*cp+zz*sp,h=-x*sp+zz*cp;const p=cam.toScreen(d.x+xx*co-yy*si,d.y+xx*si+yy*co,Math.max(.02,d.z+h),{x:0,y:0});return[p.x,p.y];});g.fillStyle=d.colour??(d.kind==='glass'?'#b7d5d29c':v.color);g.strokeStyle=d.kind==='glass'?'#dce8de':d.kind==='masonry'?'#706b60':'#798573';g.lineWidth=Math.max(.5,cam.zoom*.3);g.beginPath();points.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();g.stroke();continue;}const q=cam.toScreen(d.x,d.y,d.z,{x:0,y:0}),z=cam.zoom;g.save();g.translate(q.x,q.y);g.rotate(d.spin);if(d.size)g.scale(d.size/(d.kind==='glass'?.045:.16),d.size/(d.kind==='glass'?.045:.16));if(d.kind==='wheel'){g.fillStyle='#26302e';g.beginPath();g.ellipse(0,0,5*z,7*z,0,0,6.3);g.fill();g.strokeStyle='#9ca89c';g.lineWidth=z;g.stroke();}else{g.fillStyle=d.colour??(d.kind==='glass'?'#b7d5d2b0':v.color);g.strokeStyle=d.kind==='glass'?'#d9ece0':'#4a5952';g.lineWidth=.5*z;g.beginPath();g.moveTo(-3*z,-z);g.lineTo(2*z,-4*z);g.lineTo((4-(d.curl??0)*3)*z,(2+(d.curl??0)*4)*z);g.lineTo(-z,3*z);g.closePath();g.fill();g.stroke();}g.restore();}
}

function strokePoly(k:Ctx,points:V3[],color:string,width:number,closed=false):void{k.g.strokeStyle=color;k.g.lineWidth=width;k.g.beginPath();points.forEach((p,i)=>{const q=W3(k,p);if(i)k.g.lineTo(q[0],q[1]);else k.g.moveTo(q[0],q[1]);});if(closed)k.g.closePath();k.g.stroke();}
