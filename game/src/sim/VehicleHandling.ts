import { VEHICLES, type VehicleClass } from "../content/vehicles";
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
  if (tile === T.GRASS) return { grip: (offroad ? 0.72 : 0.49) * (1 - wet * 0.38), drag: offroad ? 0.65 : 1.3, loose: true };
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
