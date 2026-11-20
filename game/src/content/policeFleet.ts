/**
 * Police and news vehicles used by the pursuit (src/sim/Pursuit.ts). They ride on existing base bodies, so
 * physics, damage and rendering come for free; Cars.ts paints the police livery and lightbar on any class
 * isPolice() accepts, and a roof dish and NEWS panel on the news van. None of them appear in normal traffic.
 */
export const POLICE_FLEET = {
  "pol_interceptor": { name: "Holdun Commodore Interceptor", base: "fast_sedan", length: 2.4, width: 0.93, height: 0.7, speed: 15, mass: 1.6, price: 0, wb: 0.31, lamp: "slit", trim: "plain", traffic: 0, colors: ["#f2f2ee"] },
  "pol_suv": { name: "Skodo Kodiaq Highway Patrol", base: "suv", length: 2.35, width: 0.97, height: 0.86, speed: 12.5, mass: 1.95, price: 0, wb: 0.31, lamp: "slit", trim: "plain", traffic: 0, colors: ["#f2f2ee"] },
  "pol_ute": { name: "Toyoda Highlux Dog Unit", base: "ute", length: 2.35, width: 1.0, height: 0.82, speed: 10.5, mass: 1.9, price: 0, wb: 0.32, lamp: "square", trim: "rack", traffic: 0, colors: ["#f2f2ee"] },
  "pol_van": { name: "Paddy Wagon", base: "panelvan", length: 2.5, width: 1.0, height: 1.04, speed: 9.5, mass: 2.3, price: 0, wb: 0.33, lamp: "square", trim: "plain", traffic: 0, colors: ["#f2f2ee"] },
  "pol_truck": { name: "Armed Offenders Squad Truck", base: "stepvan", length: 2.8, width: 1.06, height: 1.2, speed: 9, mass: 3.4, price: 0, wb: 0.36, lamp: "square", trim: "plain", traffic: 0, colors: ["#1f2328"] },
  "news_van": { name: "Channel 7 News Van", base: "panelvan", length: 2.5, width: 1.0, height: 1.04, speed: 8.5, mass: 2.2, price: 0, wb: 0.33, lamp: "square", trim: "plain", traffic: 0, colors: ["#f2efeb"] },
} as const;

export type PoliceFleetClass = keyof typeof POLICE_FLEET;
export const POLICE_CLASSES = ["police", "pol_interceptor", "pol_suv", "pol_ute", "pol_van", "pol_truck"] as const;
export function isPolice(cls: string): boolean { return cls === "police" || cls.startsWith("pol_"); }

/** Which cruiser turns up depends on how hot you are: patrol cars first, then interceptors and SUVs, then the AOS truck. */
export function policeClassFor(stars: number, roll: number): (typeof POLICE_CLASSES)[number] {
  const pool: (typeof POLICE_CLASSES)[number][] = stars <= 1 ? ["police", "police", "pol_ute"] : stars === 2 ? ["police", "pol_suv", "pol_ute", "pol_van"]
    : stars === 3 ? ["pol_interceptor", "pol_suv", "police", "pol_van"] : ["pol_interceptor", "pol_interceptor", "pol_suv", "pol_truck"];
  return pool[Math.floor(roll * pool.length) % pool.length];
}
