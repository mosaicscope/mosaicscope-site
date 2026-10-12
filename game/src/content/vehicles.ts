/** Vehicle classes. Speeds in tiles per second (1 tile ≈ 2 m, so 10 t/s ≈ 72 km/h). Prices in NZD. */
export type VehicleClass = "hatch" | "sedan" | "suv" | "ute" | "taxi" | "police" | "van" | "ambulance" | "jdm" | "muscle" | "sports" | "super";

export interface VehicleDef {
  cls: VehicleClass;
  name: string;
  tier: "everyday" | "work" | "emergency" | "performance";
  length: number; width: number; height: number;
  topSpeed: number; accel: number; brake: number; grip: number; // grip: turning rate rad/s at low speed
  mass: number;
  price: number;
  colors: string[];
  traffic: number; // weight in normal traffic
  blurb: string;
}

export const VEHICLES: Record<VehicleClass, VehicleDef> = {
  hatch:  { cls: "hatch", name: "Suzumi Swyft", tier: "everyday", length: 1.7, width: 0.85, height: 0.65, topSpeed: 8.5, accel: 3.2, brake: 9, grip: 2.6, mass: 1, price: 6500, colors: ["#ec2a1c", "#3dd6ff", "#eee4d3", "#c6ff3d", "#9a8d80"], traffic: 6, blurb: "Cheap, nippy, parks anywhere." },
  sedan:  { cls: "sedan", name: "Toyoda Corolle", tier: "everyday", length: 2.0, width: 0.9, height: 0.65, topSpeed: 9, accel: 3, brake: 9, grip: 2.3, mass: 1.2, price: 9500, colors: ["#eee4d3", "#3a3430", "#9a8d80", "#1c2836", "#6b3a12"], traffic: 7, blurb: "Every second car in Christchurch." },
  suv:    { cls: "suv", name: "Mazdo CX-Fam", tier: "everyday", length: 2.1, width: 1.0, height: 0.85, topSpeed: 8.5, accel: 2.6, brake: 8, grip: 2.0, mass: 1.6, price: 18000, colors: ["#3a3430", "#eee4d3", "#1c2836", "#2d6b24"], traffic: 4, blurb: "School run spec." },
  ute:    { cls: "ute", name: "Toyoda Highlux", tier: "work", length: 2.3, width: 1.0, height: 0.8, topSpeed: 8.5, accel: 2.6, brake: 8, grip: 1.9, mass: 1.8, price: 22000, colors: ["#eee4d3", "#9a8d80", "#ec2a1c", "#3a3430"], traffic: 4, blurb: "The national vehicle." },
  taxi:   { cls: "taxi", name: "Blue Bubble Taxi", tier: "work", length: 2.0, width: 0.9, height: 0.7, topSpeed: 9, accel: 3, brake: 9, grip: 2.3, mass: 1.2, price: 0, colors: ["#f6b62c"], traffic: 2, blurb: "Blue Bubble yellow." },
  van:    { cls: "van", name: "Fordo Transyt", tier: "work", length: 2.4, width: 1.0, height: 1.05, topSpeed: 7.5, accel: 2.2, brake: 7, grip: 1.7, mass: 2.2, price: 15000, colors: ["#eee4d3", "#ec2a1c"], traffic: 2, blurb: "Parcels, pies, flowers." },
  police: { cls: "police", name: "Skodo Superb Patrol", tier: "emergency", length: 2.1, width: 0.95, height: 0.7, topSpeed: 12, accel: 4.2, brake: 11, grip: 2.6, mass: 1.4, price: 0, colors: ["#eee4d3"], traffic: 0, blurb: "Battenburg blue and yellow." },
  ambulance: { cls: "ambulance", name: "St Jon Ambulance", tier: "emergency", length: 2.5, width: 1.05, height: 1.1, topSpeed: 10, accel: 3, brake: 9, grip: 1.8, mass: 2.4, price: 0, colors: ["#f6b62c"], traffic: 0, blurb: "Hi-vis green-yellow and a siren." },
  jdm:    { cls: "jdm", name: "Nissun Skyliner GT-R", tier: "performance", length: 1.9, width: 0.9, height: 0.58, topSpeed: 12.5, accel: 5.2, brake: 11, grip: 3.2, mass: 1.1, price: 32000, colors: ["#3dd6ff", "#eee4d3", "#ff7ad9", "#b48cff", "#c6ff3d"], traffic: 1, blurb: "Car-meet royalty. Pops and bangs." },
  muscle: { cls: "muscle", name: "Holdin Commodor V8", tier: "performance", length: 2.2, width: 1.0, height: 0.62, topSpeed: 13, accel: 5.5, brake: 9, grip: 2.2, mass: 1.6, price: 55000, colors: ["#ec2a1c", "#0e0b0a", "#f6b62c", "#2d6b24"], traffic: 1, blurb: "Loud, straight-line fast, hates corners." },
  sports: { cls: "sports", name: "Pfister Elevenn", tier: "performance", length: 2.0, width: 0.95, height: 0.55, topSpeed: 14.5, accel: 6.2, brake: 12, grip: 3.4, mass: 1.2, price: 95000, colors: ["#ec2a1c", "#f6b62c", "#3dd6ff", "#eee4d3"], traffic: 1, blurb: "Weekend toy with real grip." },
  super:  { cls: "super", name: "Lamborgotti Venomo", tier: "performance", length: 2.1, width: 1.0, height: 0.5, topSpeed: 17, accel: 7.5, brake: 13, grip: 3.8, mass: 1.3, price: 320000, colors: ["#c6ff3d", "#ff9a3d", "#ec2a1c", "#b48cff"], traffic: 0, blurb: "The one Kodak wants to shoot at the car meet." },
};

export const FOR_SALE: VehicleClass[] = ["hatch", "sedan", "suv", "ute", "van", "jdm", "muscle", "sports", "super"];
