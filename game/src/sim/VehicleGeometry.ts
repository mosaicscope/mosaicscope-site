import type { Vehicle } from "../entities/types";
import { VEHICLES } from "../content/vehicles";
import { carMutationOf } from "../render/CarMutation";

interface Geometry { length:number; width:number; height:number; wheelbase:number }
const geometries=new WeakMap<Vehicle,{cls:Vehicle["cls"];plate:string;limo:boolean;deck:boolean;geometry:Geometry}>();

/** One chassis envelope for rendering, contact patches, steering and collision tests. */
export function vehicleGeometry(v: Vehicle) {
  const limo=v.lifeMods?.includes("Limousine chassis")??false,deck=v.lifeMods?.includes("Double deck")??false,cached=geometries.get(v);
  if(cached&&cached.cls===v.cls&&cached.plate===v.plate&&cached.limo===limo&&cached.deck===deck)return cached.geometry;
  const d = VEHICLES[v.cls], scale = v.cls === "tank" ? 1 : carMutationOf(v.plate, v.cls).scale;
  const length = d.length * scale * (v.lifeMods?.includes("Limousine chassis") ? 1.35 : 1);
  const width = d.width * scale;
  const height = d.height * 1.08 * scale * (v.lifeMods?.includes("Double deck") ? 1.6 : 1);
  const base=d.design?.base??v.cls,twoWheeler=["motorcycle","sportbike","cruiser","bicycle","ebike","escooter"].includes(base);
  const axle = twoWheeler ? base === "cruiser" ? 0.38 : 0.36 : d.design?.wb ?? (v.cls === "van" || v.cls === "ambulance" ? 0.33 : 0.31);
  const geometry={ length, width, height, wheelbase: length * axle * 2 };
  geometries.set(v,{cls:v.cls,plate:v.plate,limo,deck,geometry});return geometry;
}

/** Separating-axis contact: penetration and outward normal from a toward b. */
export function chassisContact(a: Vehicle, b: Vehicle): { nx: number; ny: number; depth: number; x: number; y: number } | null {
  const ga = vehicleGeometry(a), gb = vehicleGeometry(b);
  const ac = Math.cos(a.heading), as = Math.sin(a.heading), bc = Math.cos(b.heading), bs = Math.sin(b.heading);
  const dx = b.x-a.x, dy = b.y-a.y;
  let depth = Infinity, nx = 0, ny = 0;
  for (const [x,y] of [[ac,as],[-as,ac],[bc,bs],[-bs,bc]]) {
    const ra = Math.abs(x*ac+y*as)*ga.length/2 + Math.abs(-x*as+y*ac)*ga.width/2;
    const rb = Math.abs(x*bc+y*bs)*gb.length/2 + Math.abs(-x*bs+y*bc)*gb.width/2;
    const along = dx*x+dy*y, overlap = ra+rb-Math.abs(along);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth=overlap; nx=x*(along<0?-1:1); ny=y*(along<0?-1:1); }
  }
  // Midpoint of the overlapping face intervals: centred hits stay straight, corner hits create torque.
  const radius = (g: Geometry, c: number, s: number, x: number, y: number) => Math.abs(x*c+y*s)*g.length/2+Math.abs(-x*s+y*c)*g.width/2;
  const an=a.x*nx+a.y*ny,bn=b.x*nx+b.y*ny,at=-a.x*ny+a.y*nx,bt=-b.x*ny+b.y*nx;
  const ar=radius(ga,ac,as,-ny,nx),br=radius(gb,bc,bs,-ny,nx);
  const tangent=(Math.max(at-ar,bt-br)+Math.min(at+ar,bt+br))/2;
  const plane=(an+radius(ga,ac,as,nx,ny)+bn-radius(gb,bc,bs,nx,ny))/2;
  return { nx, ny, depth, x:nx*plane-ny*tangent, y:ny*plane+nx*tangent };
}

/** Continuous separating axes for translation during one small physics step. */
export function sweptChassisContact(a:Vehicle,b:Vehicle,stationaryB=false):{nx:number;ny:number;t:number}|null {
  const ga=vehicleGeometry(a),gb=vehicleGeometry(b),ac=Math.cos(a.heading),as=Math.sin(a.heading),bc=Math.cos(b.heading),bs=Math.sin(b.heading);
  const dx=(stationaryB?b.x:b.px)-a.px,dy=(stationaryB?b.y:b.py)-a.py,vx=(stationaryB?0:b.x-b.px)-(a.x-a.px),vy=(stationaryB?0:b.y-b.py)-(a.y-a.py);
  let enter=0,leave=1,nx=0,ny=0;
  for(const [x,y] of [[ac,as],[-as,ac],[bc,bs],[-bs,bc]]){
    const radius=(Math.abs(x*ac+y*as)*ga.length+Math.abs(-x*as+y*ac)*ga.width+Math.abs(x*bc+y*bs)*gb.length+Math.abs(-x*bs+y*bc)*gb.width)/2;
    const p=dx*x+dy*y,d=vx*x+vy*y;
    if(Math.abs(d)<1e-9){if(Math.abs(p)>=radius)return null;continue;}
    const t0=(-radius-p)/d,t1=(radius-p)/d,first=Math.min(t0,t1);
    if(first>enter){enter=first;const sign=p+d*first<0?-1:1;nx=x*sign;ny=y*sign;}
    leave=Math.min(leave,Math.max(t0,t1));if(enter>leave)return null;
  }
  // Initial overlaps are handled by the ordinary penetration solver.
  return enter>0&&enter<=1&&leave>=0?{nx,ny,t:enter}:null;
}
