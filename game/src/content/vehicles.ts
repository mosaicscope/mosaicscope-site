/** Vehicle classes. Speeds in tiles per second (1 tile ≈ 2 m, so 10 t/s ≈ 72 km/h). Prices in NZD. */
export type VehicleClass = "hatch" | "sedan" | "suv" | "ute" | "taxi" | "police" | "van" | "ambulance" | "jdm" | "muscle" | "sports" | "super"
  | "mini" | "wagon" | "hothatch" | "coupe" | "roadster" | "limo" | "hearse" | "minivan" | "camper" | "dcute" | "flatdeck" | "tradie" | "icecream"
  | "post" | "bus" | "tow" | "fire" | "bin" | "banger" | "retro" | "lowrider" | "fourby" | "ev" | "rally" | "hotrod";

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

  // ---- the rest of the street: bangers, work trucks, oddballs and weekend toys (all parody, no real brands) ----
  mini:     { cls: "mini", name: "Daihatsa Teeny", tier: "everyday", length: 1.4, width: 0.75, height: 0.62, topSpeed: 7.5, accel: 2.8, brake: 8, grip: 2.8, mass: 0.7, price: 3800, colors: ["#ff7ad9", "#c6ff3d", "#3dd6ff", "#eee4d3", "#f6b62c"], traffic: 2, blurb: "A kei car with a lawnmower's courage." },
  wagon:    { cls: "wagon", name: "Subari Outbak", tier: "everyday", length: 2.1, width: 0.92, height: 0.7, topSpeed: 9, accel: 3, brake: 9, grip: 2.4, mass: 1.3, price: 12000, colors: ["#2d6b24", "#1c2836", "#9a8d80", "#eee4d3", "#6b3a12"], traffic: 3, blurb: "Surfboards, dogs and a boot full of gumboots." },
  hothatch: { cls: "hothatch", name: "Hondah Civik Type-Arr", tier: "performance", length: 1.75, width: 0.9, height: 0.6, topSpeed: 11, accel: 4.6, brake: 10, grip: 3.1, mass: 1.0, price: 28000, colors: ["#ec2a1c", "#eee4d3", "#3dd6ff", "#0e0b0a"], traffic: 1, blurb: "Boy-racer with a wing the size of a door." },
  coupe:    { cls: "coupe", name: "Mazdo Rx-Eight", tier: "everyday", length: 1.95, width: 0.9, height: 0.56, topSpeed: 11, accel: 4.2, brake: 10, grip: 3.0, mass: 1.1, price: 24000, colors: ["#b48cff", "#ec2a1c", "#0e0b0a", "#eee4d3"], traffic: 1, blurb: "Spins like a top, literally." },
  roadster: { cls: "roadster", name: "Mazdo Miyata", tier: "everyday", length: 1.8, width: 0.88, height: 0.5, topSpeed: 10.5, accel: 3.8, brake: 10, grip: 3.2, mass: 0.9, price: 19000, colors: ["#ec2a1c", "#3dd6ff", "#eee4d3", "#2d6b24"], traffic: 1, blurb: "Roof down, even in a Canterbury nor'wester." },
  limo:     { cls: "limo", name: "Stretch Limo", tier: "performance", length: 3.0, width: 0.95, height: 0.66, topSpeed: 8.5, accel: 2.2, brake: 7, grip: 1.4, mass: 2.2, price: 60000, colors: ["#0e0b0a", "#eee4d3", "#ff7ad9"], traffic: 0.4, blurb: "Hens' nights and one very long three-point turn." },
  hearse:   { cls: "hearse", name: "Last Ride Hearse", tier: "work", length: 2.4, width: 0.95, height: 0.78, topSpeed: 8, accel: 2.4, brake: 8, grip: 1.9, mass: 1.8, price: 14000, colors: ["#0e0b0a"], traffic: 0.4, blurb: "Slow, polished and never late for a client." },
  minivan:  { cls: "minivan", name: "Toyoda Estimah", tier: "everyday", length: 2.2, width: 0.98, height: 0.85, topSpeed: 8.5, accel: 2.6, brake: 8, grip: 2.0, mass: 1.7, price: 8500, colors: ["#eee4d3", "#9a8d80", "#1c2836", "#c6ff3d"], traffic: 2.5, blurb: "A people mover with a sliding door that always jams." },
  camper:   { cls: "camper", name: "Combi Camper", tier: "everyday", length: 2.2, width: 0.95, height: 0.95, topSpeed: 6.5, accel: 1.9, brake: 7, grip: 1.7, mass: 2.0, price: 17000, colors: ["#3dd6ff", "#f6b62c", "#ff7ad9", "#c6ff3d"], traffic: 0.8, blurb: "Hippies, surf wax and a tape stuck on the same song." },
  dcute:    { cls: "dcute", name: "Fordo Rangah", tier: "work", length: 2.35, width: 1.0, height: 0.82, topSpeed: 9, accel: 2.8, brake: 8, grip: 1.9, mass: 1.9, price: 38000, colors: ["#eee4d3", "#3a3430", "#ec2a1c", "#1c2836", "#ff9a3d"], traffic: 2, blurb: "Double cab, bull bar, and a dog on the tray." },
  flatdeck: { cls: "flatdeck", name: "Isuzoo Flatdeck", tier: "work", length: 2.7, width: 1.05, height: 0.9, topSpeed: 7.5, accel: 2.0, brake: 7, grip: 1.6, mass: 2.6, price: 26000, colors: ["#eee4d3", "#f6b62c", "#2d6b24"], traffic: 1, blurb: "Hay bales, pallets and a mattress nobody tied down." },
  tradie:   { cls: "tradie", name: "Toyoda Hiacey Tradie", tier: "work", length: 2.3, width: 1.0, height: 1.0, topSpeed: 7.5, accel: 2.3, brake: 7, grip: 1.7, mass: 2.1, price: 16000, colors: ["#eee4d3", "#9a8d80", "#1c2836"], traffic: 3, blurb: "Ladder on the roof, pie wrapper on the dash." },
  icecream: { cls: "icecream", name: "Mister Whippee Van", tier: "work", length: 2.3, width: 1.0, height: 1.05, topSpeed: 6.5, accel: 1.9, brake: 7, grip: 1.7, mass: 2.0, price: 13000, colors: ["#fff1d6", "#ffc2e8"], traffic: 0.6, blurb: "Plays a jingle that sticks in your head for a week." },
  post:     { cls: "post", name: "Pukeko Post Van", tier: "work", length: 2.1, width: 0.95, height: 0.95, topSpeed: 7.5, accel: 2.4, brake: 8, grip: 1.9, mass: 1.7, price: 0, colors: ["#d4382a"], traffic: 1.5, blurb: "Delivers everything except the thing you ordered." },
  bus:      { cls: "bus", name: "Metro Bus", tier: "work", length: 3.0, width: 1.1, height: 1.15, topSpeed: 6.5, accel: 1.5, brake: 6, grip: 1.1, mass: 4.0, price: 0, colors: ["#2d6bd6", "#eee4d3"], traffic: 1.2, blurb: "Always two at once, after a long wait." },
  tow:      { cls: "tow", name: "Hook & Haul Tow Truck", tier: "work", length: 2.6, width: 1.0, height: 0.85, topSpeed: 8, accel: 2.4, brake: 8, grip: 1.7, mass: 2.4, price: 0, colors: ["#f6b62c", "#eee4d3"], traffic: 0.8, blurb: "Arrives faster than the ambulance, charges more." },
  fire:     { cls: "fire", name: "Station Seven Fire Engine", tier: "emergency", length: 3.0, width: 1.08, height: 1.0, topSpeed: 8, accel: 2.0, brake: 7, grip: 1.3, mass: 4.5, price: 0, colors: ["#d4382a"], traffic: 0.3, blurb: "Red, loud and secretly full of firefighter calendars." },
  bin:      { cls: "bin", name: "Rubbish Truck", tier: "work", length: 2.8, width: 1.05, height: 1.0, topSpeed: 6, accel: 1.6, brake: 6.5, grip: 1.3, mass: 3.8, price: 0, colors: ["#2d6b24", "#eee4d3"], traffic: 1, blurb: "Wakes the whole street at 5 a.m. on Tuesday." },
  banger:   { cls: "banger", name: "Rusty Corolle", tier: "everyday", length: 2.0, width: 0.9, height: 0.65, topSpeed: 7, accel: 2.4, brake: 7, grip: 2.0, mass: 1.2, price: 800, colors: ["#8a6a3a", "#6b7b3a", "#9a8d80", "#7a2a22", "#4a6a7a"], traffic: 3, blurb: "Held together with hope and number 8 wire." },
  retro:    { cls: "retro", name: "Bubbly Bug", tier: "everyday", length: 1.65, width: 0.85, height: 0.6, topSpeed: 6.5, accel: 2.2, brake: 7, grip: 2.4, mass: 0.9, price: 11000, colors: ["#ffc2e8", "#c6ff3d", "#3dd6ff", "#f6b62c", "#eee4d3"], traffic: 0.8, blurb: "The engine is in the boot and the heater is a rumour." },
  lowrider: { cls: "lowrider", name: "Impalo Lowrider", tier: "performance", length: 2.4, width: 0.98, height: 0.52, topSpeed: 8.5, accel: 2.8, brake: 7, grip: 1.8, mass: 1.9, price: 36000, colors: ["#b48cff", "#ec2a1c", "#3dd6ff", "#0e0b0a"], traffic: 0.5, blurb: "Bounces at the lights. Never in a hurry." },
  fourby:   { cls: "fourby", name: "Landcruzer 80", tier: "work", length: 2.2, width: 1.02, height: 0.9, topSpeed: 8, accel: 2.4, brake: 8, grip: 1.9, mass: 2.0, price: 21000, colors: ["#6b7b3a", "#eee4d3", "#3a3430", "#8a6a3a"], traffic: 1.5, blurb: "Has crossed rivers. Mostly used for the school run." },
  ev:       { cls: "ev", name: "Tezla Model Why", tier: "everyday", length: 1.95, width: 0.92, height: 0.62, topSpeed: 11.5, accel: 5.0, brake: 10, grip: 2.8, mass: 1.5, price: 48000, colors: ["#eee4d3", "#0e0b0a", "#ec2a1c", "#3dd6ff"], traffic: 1.5, blurb: "Silent, quick, and the owner will tell you about it." },
  rally:    { cls: "rally", name: "Subari Rumblex", tier: "performance", length: 1.95, width: 0.92, height: 0.62, topSpeed: 12, accel: 5.0, brake: 11, grip: 3.3, mass: 1.2, price: 34000, colors: ["#2d6bd6"], traffic: 0.7, blurb: "Gold wheels, blue paint, flat out on gravel." },
  hotrod:   { cls: "hotrod", name: "Fordo Deuce Hot Rod", tier: "performance", length: 1.9, width: 0.95, height: 0.55, topSpeed: 12, accel: 5.4, brake: 9, grip: 2.2, mass: 1.2, price: 42000, colors: ["#0e0b0a", "#ec2a1c", "#f6b62c"], traffic: 0.4, blurb: "Flames up the side and a blower sticking out of the bonnet." },
};

export const FOR_SALE: VehicleClass[] = ["hatch", "sedan", "suv", "ute", "van", "jdm", "muscle", "sports", "super",
  "mini", "wagon", "hothatch", "coupe", "roadster", "minivan", "camper", "dcute", "tradie", "banger", "retro", "lowrider", "fourby", "ev", "rally", "hotrod"];
