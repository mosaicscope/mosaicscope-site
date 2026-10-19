/**
 * Every physical item in the world: toys, weapons, food and valuables. Data-driven: add an entry and
 * physics, inventory, shops, barter and AI pick it up. `value` is in NZ dollars.
 */
export type ToyUse = "throw" | "melee" | "shield" | "ranged" | "tether" | "comfort" | "spring" | "heavy" | "breakable" | "projectile" | "food" | "valuable" | "tool";
export type Category = "toy" | "weapon" | "food" | "valuable" | "prop";

export interface WeaponStats {
  damage: number;     // composure loss multiplier (1 = foam sword)
  reach: number;      // tiles (melee) or range (ranged)
  rate: number;       // seconds between attacks
  knockback: number;  // impulse
  accuracy: number;   // 0..1 for ranged
  blood: number;      // 0..1 chance of a (fake, cartoon) blood splatter on a solid hit
  ammo?: string;      // projectile item id
  stun?: number;      // seconds of stun (taser)
  /** firearm: muzzle flash, casings, bang, bullets that wound (see sim/Turf.ts) */
  gun?: boolean;
  mode?:"semi"|"auto"|"pump";
  mag?: number;       // rounds before a reload pause
  reload?: number;    // seconds to reload
  pellets?: number;   // projectiles per shot (shotgun)
  spread?: number;    // radians of pellet spread
}

export interface ToyDef {
  id: string;
  name: string;
  category: Category;
  uses: ToyUse[];
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  durability: number;
  color: string;
  /** Base knockback dealt on a solid hit (before mass/speed scaling). */
  punch: number;
  material: "rubber" | "foam" | "plush" | "plastic" | "wood" | "cardboard" | "metal" | "food" | "paper" | "glass";
  portable: boolean;
  spawn: number;      // weight in toy chests
  value: number;      // NZD
  weapon?: WeaponStats;
  food?: { hunger: number; energy: number; drink?: boolean };
  blurb?: string;
}

const T = (d: Partial<ToyDef> & Pick<ToyDef, "id" | "name" | "uses">): ToyDef => ({
  category: "toy", radius: 0.18, mass: 0.3, restitution: 0.3, friction: 2, durability: 50, color: "#eee4d3", punch: 2, material: "plastic", portable: true, spawn: 0, value: 10, ...d,
});

export const TOYS: Record<string, ToyDef> = {
  // ---- toys / throwables
  ball: T({ id: "ball", name: "bouncy ball", uses: ["throw"], radius: 0.18, mass: 0.4, restitution: 0.75, friction: 0.6, durability: 60, color: "#ec2a1c", punch: 3, material: "rubber", spawn: 5, value: 8 }),
  frisbee: T({ id: "frisbee", name: "frisbee", uses: ["throw"], radius: 0.2, mass: 0.2, restitution: 0.4, friction: 1.4, durability: 40, color: "#3dd6ff", punch: 2, spawn: 3, value: 12 }),
  plush: T({ id: "plush", name: "plush bear", uses: ["throw", "comfort"], radius: 0.22, mass: 0.35, restitution: 0.1, friction: 3, durability: 80, color: "#f6b62c", punch: 1.5, material: "plush", spawn: 3, value: 25 }),
  yoyo: T({ id: "yoyo", name: "yo-yo", uses: ["tether", "throw"], radius: 0.12, mass: 0.15, restitution: 0.5, friction: 1, durability: 50, color: "#8fe3c0", punch: 1.5, spawn: 2, value: 6 }),
  spring: T({ id: "spring", name: "jack-in-the-box", uses: ["spring", "throw"], radius: 0.22, mass: 0.5, restitution: 0.9, friction: 1.5, durability: 40, color: "#f6b62c", punch: 2, spawn: 2, value: 18 }),
  water_balloon: T({ id: "water_balloon", name: "water balloon", uses: ["throw"], radius: 0.15, mass: 0.5, restitution: 0.05, friction: 3, durability: 3, color: "#3dd6ff", punch: 1.5, material: "rubber", spawn: 3, value: 2 }),
  skateboard: T({ id: "skateboard", name: "skateboard", category: "valuable", uses: ["valuable", "throw"], radius: 0.3, mass: 2, restitution: 0.3, friction: 1, durability: 200, color: "#c6ff3d", punch: 3, material: "wood", spawn: 1, value: 120 }),
  cannonball:T({id:'cannonball',name:'tank shell',uses:['projectile','heavy','breakable'],portable:false,category:'weapon',radius:.15,mass:2,durability:1,restitution:0,color:'#d6b870',punch:12,value:0}),
  fists:T({id:'fists',name:'unarmed strike',category:'weapon',uses:['melee'],portable:false,value:0,spawn:0,weapon:{damage:.8,reach:1.35,rate:.4,knockback:1.7,accuracy:1,blood:0}}),
  baton:T({id:'baton',name:'baton',category:'weapon',uses:['melee'],value:180,material:'metal',durability:400,color:'#343c43',weapon:{damage:1.7,reach:1.45,rate:.65,knockback:5,accuracy:1,blood:.2}}),
  mace:T({id:'mace',name:'cartoon mace',category:'weapon',uses:['melee'],value:450,material:'metal',durability:500,color:'#8b9294',mass:1.8,weapon:{damage:2.6,reach:1.4,rate:1.1,knockback:8,accuracy:1,blood:.5}}),
  rifle:T({id:'rifle',name:'semi-auto rifle',category:'weapon',uses:['ranged'],value:3200,material:'metal',durability:1200,color:'#596453',weapon:{damage:3,reach:18,rate:.4,knockback:5,accuracy:.93,blood:.7,ammo:'bullet',gun:true,mode:'semi',mag:20,reload:2}}),
  // ---- melee weapons
  foam_sword: T({ id: "foam_sword", name: "foam sword", category: "weapon", uses: ["melee"], radius: 0.25, durability: 45, color: "#c6ff3d", punch: 4, material: "foam", spawn: 4, value: 15,
    weapon: { damage: 1, reach: 1.25, rate: 0.55, knockback: 4, accuracy: 1, blood: 0 }, blurb: "Light, fast, harmless. Mostly." }),
  noodle: T({ id: "noodle", name: "pool noodle", category: "weapon", uses: ["melee"], radius: 0.3, mass: 0.2, durability: 35, color: "#ff7ad9", punch: 3, material: "foam", spawn: 3, value: 5,
    weapon: { damage: 0.7, reach: 1.5, rate: 0.5, knockback: 3, accuracy: 1, blood: 0 }, blurb: "Longest reach of any melee toy, lowest damage." }),
  bat: T({ id: "bat", name: "baseball bat", category: "weapon", uses: ["melee"], radius: 0.25, mass: 0.9, durability: 150, color: "#b0641c", punch: 7, material: "wood", spawn: 1, value: 45,
    weapon: { damage: 2.2, reach: 1.3, rate: 0.9, knockback: 7.5, accuracy: 1, blood: 0.55 }, blurb: "Slow wind-up, huge knockback. Draws the police fast." }),
  hockey_stick: T({ id: "hockey_stick", name: "hockey stick", category: "weapon", uses: ["melee"], radius: 0.3, mass: 0.6, durability: 110, color: "#9a8d80", punch: 5, material: "wood", spawn: 1, value: 40,
    weapon: { damage: 1.6, reach: 1.55, rate: 0.75, knockback: 5.5, accuracy: 1, blood: 0.3 } }),
  frying_pan: T({ id: "frying_pan", name: "frying pan", category: "weapon", uses: ["melee", "shield"], radius: 0.22, mass: 1.1, durability: 300, color: "#3a3430", punch: 6, material: "metal", spawn: 1, value: 30,
    weapon: { damage: 1.9, reach: 1.05, rate: 0.85, knockback: 6, accuracy: 1, blood: 0.45 }, blurb: "Bonk. Also blocks a hit if you're quick." }),
  boxing_gloves: T({ id: "boxing_gloves", name: "boxing gloves", category: "weapon", uses: ["melee"], radius: 0.18, mass: 0.6, durability: 200, color: "#ec2a1c", punch: 4.5, material: "plush", spawn: 1, value: 60,
    weapon: { damage: 1.3, reach: 0.95, rate: 0.35, knockback: 4.5, accuracy: 1, blood: 0.25 }, blurb: "Fastest hands in the block." }),
  pillow: T({ id: "pillow", name: "pillow", category: "weapon", uses: ["melee", "comfort"], radius: 0.25, mass: 0.3, durability: 60, color: "#eee4d3", punch: 2.5, material: "plush", spawn: 2, value: 20,
    weapon: { damage: 0.4, reach: 1.15, rate: 0.45, knockback: 3, accuracy: 1, blood: 0 } }),
  nunchucks: T({ id: "nunchucks", name: "foam nunchucks", category: "weapon", uses: ["melee"], radius: 0.2, mass: 0.4, durability: 80, color: "#f6b62c", punch: 4, material: "foam", spawn: 1, value: 35,
    weapon: { damage: 1.2, reach: 1.15, rate: 0.4, knockback: 4, accuracy: 1, blood: 0.1 } }),
  flail: T({ id: "flail", name: "plush flail", category: "weapon", uses: ["melee", "tether"], radius: 0.3, mass: 0.5, durability: 60, color: "#ff7ad9", punch: 5, material: "plush", value: 40,
    weapon: { damage: 1.4, reach: 1.6, rate: 0.8, knockback: 5, accuracy: 1, blood: 0.15 } }),
  shield: T({ id: "shield", name: "riot shield (toy)", category: "weapon", uses: ["shield"], radius: 0.26, mass: 0.6, restitution: 0.3, durability: 90, color: "#9a8d80", punch: 1, spawn: 2, value: 35 }),
  knife: T({ id: "knife", name: "flick knife", category: "weapon", uses: ["melee"], radius: 0.12, mass: 0.2, durability: 400, color: "#9a8d80", punch: 2, material: "metal", value: 25,
    weapon: { damage: 2.6, reach: 0.95, rate: 0.7, knockback: 2, accuracy: 1, blood: 1 }, blurb: "Street crime. Deep wounds; every cop in the city comes running." }),
  bandage: T({ id: "bandage", name: "bandage", category: "food", uses: ["food"], radius: 0.08, color: "#eee4d3", material: "paper", value: 6, food: { hunger: 0, energy: 0 }, blurb: "Stops bleeding. Use it on yourself or someone hurt (B)." }),
  // ---- ranged weapons + ammo
  foam_bow: T({ id: "foam_bow", name: "foam bow", category: "weapon", uses: ["ranged"], radius: 0.25, durability: 50, color: "#b48cff", punch: 0, spawn: 2, value: 40,
    weapon: { damage: 1, reach: 9, rate: 0.9, knockback: 2.2, accuracy: 0.8, blood: 0.05, ammo: "dart" } }),
  nerf: T({ id: "nerf", name: "dart blaster", category: "weapon", uses: ["ranged"], radius: 0.22, durability: 70, color: "#ff9a3d", punch: 0, spawn: 2, value: 55,
    weapon: { damage: 0.6, reach: 8, rate: 0.3, knockback: 1.5, accuracy: 0.7, blood: 0, ammo: "dart" }, blurb: "Rapid fire, low punch." }),
  paintball: T({ id: "paintball", name: "paintball marker", category: "weapon", uses: ["ranged"], radius: 0.24, mass: 0.9, durability: 120, color: "#3a3430", punch: 0, spawn: 1, value: 180,
    weapon: { damage: 1.5, reach: 11, rate: 0.45, knockback: 2.5, accuracy: 0.85, blood: 0, ammo: "pellet" }, blurb: "Leaves paint everywhere. Stings." }),
  water_pistol: T({ id: "water_pistol", name: "water pistol", category: "weapon", uses: ["ranged"], radius: 0.18, durability: 60, color: "#3dd6ff", punch: 0, spawn: 2, value: 15,
    weapon: { damage: 0.25, reach: 6, rate: 0.15, knockback: 0.6, accuracy: 0.75, blood: 0, ammo: "droplet" } }),
  slingshot: T({ id: "slingshot", name: "slingshot", category: "weapon", uses: ["ranged"], radius: 0.15, durability: 80, color: "#9a5a1c", punch: 0, spawn: 1, value: 20,
    weapon: { damage: 1.7, reach: 10, rate: 1.0, knockback: 3.5, accuracy: 0.65, blood: 0.35, ammo: "pebble" } }),
  taser: T({ id: "taser", name: "police taser", category: "weapon", uses: ["ranged"], radius: 0.15, durability: 500, color: "#f6b62c", punch: 0, value: 900,
    weapon: { damage: 0.6, reach: 5, rate: 2.5, knockback: 1, accuracy: 0.9, blood: 0, ammo: "probe", stun: 3.5 }, blurb: "Police issue. Stuns for a few seconds." }),
  // ---- firearms (cartoon street guns; black market only, never in toy chests)
  pistol: T({ id: "pistol", name: "pistol", category: "weapon", uses: ["ranged"], radius: 0.16, mass: 0.8, durability: 900, color: "#3a3430", punch: 0, material: "metal", value: 650,
    weapon: { damage: 2.4, reach: 12, rate: 0.45, knockback: 4, accuracy: 0.78, blood: 0.8, ammo: "bullet", gun: true, mag: 12, reload: 1.4 }, blurb: "Twelve in the mag. Every shot is a three-star crime." }),
  revolver: T({ id: "revolver", name: "revolver", category: "weapon", uses: ["ranged"], radius: 0.18, mass: 1.1, durability: 1200, color: "#9a8d80", punch: 0, material: "metal", value: 900,
    weapon: { damage: 3.2, reach: 13, rate: 0.85, knockback: 6.5, accuracy: 0.86, blood: 0.9, ammo: "bullet", gun: true, mag: 6, reload: 2.2 }, blurb: "Six shots, big kick, slow reload. Very cowboy." }),
  smg: T({ id: "smg", name: "SMG", category: "weapon", uses: ["ranged"], radius: 0.2, mass: 1.6, durability: 900, color: "#0e0b0a", punch: 0, material: "metal", value: 2200,
    weapon: { damage: 1.5, reach: 10, rate: 0.11, knockback: 2.5, accuracy: 0.5, blood: 0.7, ammo: "bullet", gun: true, mode:"auto", mag: 25, reload: 1.8 }, blurb: "Sprays more than it aims." }),
  shotgun: T({ id: "shotgun", name: "pump shotgun", category: "weapon", uses: ["ranged"], radius: 0.3, mass: 2.4, durability: 1200, color: "#6b3a12", punch: 0, material: "metal", value: 1600,
    weapon: { damage: 2.2, reach: 7, rate: 1.05, knockback: 8.5, accuracy: 0.6, blood: 0.9, ammo: "buckshot", gun: true, mode:"pump", mag: 6, reload: 2.6, pellets: 6, spread: 0.22 }, blurb: "Chk-chk. Short range, knocks people off their feet." }),
  golden_pistol: T({ id: "golden_pistol", name: "golden pistol", category: "weapon", uses: ["ranged"], radius: 0.16, mass: 1.6, durability: 600, color: "#f6b62c", punch: 0, material: "metal", value: 25000,
    weapon: { damage: 2.4, reach: 11, rate: 0.55, knockback: 4, accuracy: 0.42, blood: 0.8, ammo: "bullet", gun: true, mag: 7, reload: 1.6 }, blurb: "Solid gold, terrible aim. Shoots sparkles as well as bullets. Pure flex." }),
  bullet: T({ id: "bullet", name: "bullet", uses: ["projectile"], radius: 0.06, mass: 0.05, restitution: 0, friction: 3, durability: 1, color: "#fff6c8", punch: 3, material: "metal", portable: false, value: 0 }),
  buckshot: T({ id: "buckshot", name: "buckshot pellet", uses: ["projectile"], radius: 0.05, mass: 0.04, restitution: 0, friction: 3, durability: 1, color: "#fff6c8", punch: 2.5, material: "metal", portable: false, value: 0 }),
  dart: T({ id: "dart", name: "foam dart", uses: ["projectile"], radius: 0.08, mass: 0.05, restitution: 0.2, friction: 3, durability: 4, color: "#ff9a3d", punch: 2.2, material: "foam", portable: false, value: 0 }),
  pellet: T({ id: "pellet", name: "paint pellet", uses: ["projectile"], radius: 0.06, mass: 0.05, restitution: 0, friction: 3, durability: 1, color: "#ff7ad9", punch: 3, material: "rubber", portable: false, value: 0 }),
  droplet: T({ id: "droplet", name: "water", uses: ["projectile"], radius: 0.05, mass: 0.02, restitution: 0, friction: 3, durability: 1, color: "#3dd6ff", punch: 0.6, material: "rubber", portable: false, value: 0 }),
  pebble: T({ id: "pebble", name: "pebble", uses: ["projectile"], radius: 0.06, mass: 0.1, restitution: 0.3, friction: 3, durability: 2, color: "#9a8d80", punch: 3.5, material: "wood", portable: false, value: 0 }),
  probe: T({ id: "probe", name: "taser probe", uses: ["projectile"], radius: 0.05, mass: 0.03, restitution: 0, friction: 3, durability: 1, color: "#f6b62c", punch: 1, material: "metal", portable: false, value: 0 }),
  // ---- props
  box: T({ id: "box", name: "cardboard box", category: "prop", uses: ["breakable", "heavy"], radius: 0.35, mass: 2.2, restitution: 0.1, friction: 4, durability: 18, color: "#9a5a1c", punch: 2, material: "cardboard", portable: false, spawn: 2, value: 0 }),
  crate: T({ id: "crate", name: "wooden crate", category: "prop", uses: ["heavy"], radius: 0.42, mass: 6, restitution: 0.05, friction: 6, durability: 400, color: "#6b3a12", punch: 3, material: "wood", portable: false, value: 0 }),
  bin: T({ id: "bin", name: "wheelie bin", category: "prop", uses: ["heavy", "breakable"], radius: 0.3, mass: 3, restitution: 0.1, friction: 5, durability: 120, color: "#2d6b24", punch: 2, material: "plastic", portable: false, value: 0 }),
  // ---- food (NZ dairy / takeaway menu)
  pie: T({ id: "pie", name: "mince & cheese pie", category: "food", uses: ["food", "throw"], radius: 0.12, mass: 0.2, color: "#b0641c", material: "food", value: 5.5, food: { hunger: 0.5, energy: 0.1 } }),
  fish_chips: T({ id: "fish_chips", name: "fish & chips", category: "food", uses: ["food"], radius: 0.15, color: "#f6b62c", material: "paper", value: 14, food: { hunger: 0.8, energy: 0.1 } }),
  burger: T({ id: "burger", name: "burger", category: "food", uses: ["food", "throw"], radius: 0.12, color: "#9a5a1c", material: "food", value: 12, food: { hunger: 0.65, energy: 0.1 } }),
  kebab: T({ id: "kebab", name: "kebab", category: "food", uses: ["food"], radius: 0.12, color: "#eee4d3", material: "food", value: 13, food: { hunger: 0.7, energy: 0.1 } }),
  sushi: T({ id: "sushi", name: "sushi pack", category: "food", uses: ["food"], radius: 0.12, color: "#ff7ad9", material: "food", value: 11, food: { hunger: 0.5, energy: 0.05 } }),
  pizza: T({ id: "pizza", name: "pizza slice", category: "food", uses: ["food", "throw"], radius: 0.12, color: "#f6b62c", material: "food", value: 6, food: { hunger: 0.4, energy: 0.05 } }),
  bao: T({ id: "bao", name: "pork bao", category: "food", uses: ["food"], radius: 0.1, color: "#eee4d3", material: "food", value: 7, food: { hunger: 0.35, energy: 0.05 } }),
  donut: T({ id: "donut", name: "donut", category: "food", uses: ["food", "throw"], radius: 0.1, color: "#ff7ad9", material: "food", value: 4, food: { hunger: 0.25, energy: 0.15 } }),
  hokey_pokey: T({ id: "hokey_pokey", name: "hokey pokey ice cream", category: "food", uses: ["food"], radius: 0.1, color: "#f6b62c", material: "food", value: 6, food: { hunger: 0.2, energy: 0.1 } }),
  flat_white: T({ id: "flat_white", name: "flat white", category: "food", uses: ["food"], radius: 0.08, color: "#9a5a1c", material: "paper", value: 5.5, food: { hunger: 0.05, energy: 0.45, drink: true } }),
  lp: T({ id: "lp", name: "L&P", category: "food", uses: ["food", "throw"], radius: 0.08, color: "#f6b62c", material: "glass", value: 3.5, food: { hunger: 0.05, energy: 0.2, drink: true } }),
  energy_drink: T({ id: "energy_drink", name: "energy drink", category: "food", uses: ["food", "throw"], radius: 0.08, color: "#c6ff3d", material: "metal", value: 4.5, food: { hunger: 0, energy: 0.6, drink: true } }),
  // ---- valuables (steal, pawn, barter)
  phone: T({ id: "phone", name: "phone", category: "valuable", uses: ["valuable"], radius: 0.08, color: "#0e0b0a", material: "glass", value: 380 }),
  camera: T({ id: "camera", name: "film camera", category: "valuable", uses: ["valuable"], radius: 0.12, color: "#3a3430", material: "metal", value: 450, blurb: "A proper MosaicScope tool." }),
  watch: T({ id: "watch", name: "watch", category: "valuable", uses: ["valuable"], radius: 0.06, color: "#f6b62c", material: "metal", value: 220 }),
  chain: T({ id: "chain", name: "gold chain", category: "valuable", uses: ["valuable"], radius: 0.06, color: "#f6b62c", material: "metal", value: 300 }),
  headphones: T({ id: "headphones", name: "headphones", category: "valuable", uses: ["valuable"], radius: 0.1, color: "#ec2a1c", material: "plastic", value: 150 }),
  spray_can: T({ id: "spray_can", name: "spray can", category: "valuable", uses: ["tool", "throw"], radius: 0.07, color: "#c6ff3d", material: "metal", value: 12, blurb: "For walls. Not for the police station." }),
  vinyl: T({ id: "vinyl", name: "vinyl record", category: "valuable", uses: ["valuable", "throw"], radius: 0.15, color: "#0e0b0a", material: "plastic", value: 40 }),
};

/** Crafting: two items held together become an improvised one. */
export const RECIPES: { a: string; b: string; out: string; name: string }[] = [
  { a: "noodle", b: "plush", out: "flail", name: "plush flail" },
  { a: "frisbee", b: "foam_sword", out: "shield", name: "frisbee shield" },
];

export const isWeapon = (def: string) => TOYS[def]?.uses.some((u) => u === "melee" || u === "throw" || u === "ranged") ?? false;
export const canThrow = (def: string) => TOYS[def]?.uses.includes("throw") ?? false;
export const isMelee = (def: string) => TOYS[def]?.uses.includes("melee") ?? false;
export const isRanged = (def: string) => TOYS[def]?.uses.includes("ranged") ?? false;
export const isFood = (def: string) => TOYS[def]?.category === "food" && def !== "bandage";
export const isGun = (def: string) => !!TOYS[def]?.weapon?.gun;
/** Bullets and buckshot: projectiles fired by a gun. */
export const isBullet = (def: string) => def === "bullet" || def === "buckshot";
/** Firearms for sale at the black-market dealer (the only place that sells them). Price = TOYS[id].value. */
export const BLACK_MARKET: readonly string[] = ["pistol", "revolver", "smg", "shotgun", "golden_pistol"];
export const valueOf = (def: string) => TOYS[def]?.value ?? 0;
