import { VEHICLES, type VehicleClass } from "../content/vehicles";
import { worldIndex } from "../world/WorldIndex";
import type { World } from "../world/World";
import { T } from "../world/World";
import { clamp } from "../core/math";

export type Drivetrain = "fwd" | "rwd" | "awd";
const AWD = new Set(["fourby", "offroad_wagon", "rally", "rally_sedan", "lift_suv", "box_suv", "ranger", "tank"]);
const RWD = new Set(["muscle", "hotrod", "coupe", "roadster", "super", "super_wedge", "sports", "lowrider", "limo", "limousine", "fast_sedan", "executive", "trackcoupe", "grandtourer", "ute", "retro_ute", "pickup_single", "dcute", "motorcycle", "sportbike", "cruiser", "bicycle", "ebike"]);

/** Fleet models inherit the handling family of their authored base vehicle. */
export function handlingProfile(cls: VehicleClass) {
  const d = VEHICLES[cls], base = d.design?.base ?? cls;
  const drive: Drivetrain = AWD.has(base) ? "awd" : RWD.has(base) ? "rwd" : "fwd";
  const offroad = ["fourby", "offroad_wagon", "lift_suv", "ranger", "tank"].includes(base);
  const twoWheeler=["motorcycle","sportbike","cruiser","bicycle","ebike","escooter"].includes(base);
  return { drive, offroad, twoWheeler, cg: d.height * 0.45 };
}

/** Surface coefficients are tuning values in the world's tile/second units. */
export function roadSurface(tile: number, rain: number, offroad: boolean) {
  const wet = clamp(rain, 0, 1);
  if (tile === T.GRASS) return { grip: (offroad ? 0.69 : 0.46) * (1 - wet * 0.38), drag: offroad ? 0.08 : 0.12, loose: true };
  if (tile === T.SAND) return { grip: offroad ? 0.62 : 0.38, drag: offroad ? 1.1 : 2.2, loose: true };
  if (tile === T.PATH) return { grip: (offroad ? 0.8 : 0.65) * (1 - wet * 0.18), drag: offroad ? 0.35 : 0.6, loose: true };
  if (tile === T.CROSSWALK || tile === T.COURT) return { grip: 0.96 * (1 - wet * 0.48), drag: 0, loose: false };
  return { grip: 1 - wet * 0.35, drag: 0, loose: false };
}

/** A smooth peak followed by sliding friction, rather than an on/off grip switch. */
export function slipGrip(slipAngle: number): number {
  const slide = clamp((Math.abs(slipAngle) - 0.12) / 0.55, 0, 1);
  return 1 - slide * slide * (3 - 2 * slide) * 0.24;
}

/** Remaining lateral force from a combined longitudinal/lateral friction circle. */
export function corneringBudget(grip: number, longitudinal: number): number {
  const used = clamp(Math.abs(longitudinal) / Math.max(0.1, grip), 0, 0.98);
  return grip * Math.sqrt(1 - used * used);
}

/** Comfortable following speed with a reaction gap and relative braking distance. */
export function followingSpeed(gap: number, leaderSpeed: number, brake: number, headway = 0.65): number {
  const b = Math.max(0.1, brake), lead = Math.max(0, leaderSpeed);
  return Math.max(0, Math.sqrt((b * headway) ** 2 + lead * lead + 2 * b * Math.max(0, gap - 0.2)) - b * headway);
}

/** Warm rubber has a broad sweet spot; sustained burnouts eventually cost adhesion. */
export function temperatureGrip(heat: number): number {
  const h = clamp(heat, 0, 1);
  return 1 + Math.min(h, 0.45) * 0.12 - Math.max(0, h - 0.65) * 0.38;
}

/** Surface and weather estimates: maps may lack material tags; temperature is live only when fresh. */
export function roadSurfaceAt(world:World,x:number,y:number,rain:number,offroad:boolean,daylight=.5){
 const tx=Math.floor(x),ty=Math.floor(y),tile=world.tile(tx,ty);let material:string|undefined;
 if(world.mapped&&tile!==T.WATER&&tile!==T.BUILDING){
  let nearest=Infinity;for(const i of worldIndex(world).roads.query(x-12,y-12,x+12,y+12)){
   const r=world.mapped.streetSegments[i],at=(x-r.x)*r.dx+(y-r.y)*r.dy,cross=Math.abs(-(x-r.x)*r.dy+(y-r.y)*r.dx);
   if(at>=0&&at<=r.length&&cross<=r.half&&cross<nearest){nearest=cross;material=r.surface??'asphalt';}
  }
 }
 let result=roadSurface(material?T.ROAD:tile,rain,offroad);
 if(material&&['gravel','fine_gravel','unpaved','dirt','ground','sand'].includes(material))result={grip:(offroad?.76:.58)*(1-clamp(rain,0,1)*.25),drag:offroad?.15:.3,loose:true};
 else if(material&&['paving_stones','sett','cobblestone'].includes(material))result={grip:.85*(1-clamp(rain,0,1)*.4),drag:.04,loose:false};
 else if(tile===T.GRASS&&!material&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>world.tile(tx+dx,ty+dy)===T.WATER))result={grip:result.grip*.82,drag:result.drag+.08,loose:true};
 const data=world.mapped?.liveConditions,weather=data?.weather&&Date.now()-Date.parse(data.fetchedAt)<1800000?data.weather:null;
 if(weather&&Number.isFinite(weather.temperature)){const cold=clamp((12-weather.temperature)/22,0,1),sun=clamp(daylight,0,1)*(1-clamp(weather.cloud/100,0,1))*(1-clamp(rain,0,1));result={...result,grip:result.grip*(1-cold*.12+sun*.025)};}
 return result;
}
