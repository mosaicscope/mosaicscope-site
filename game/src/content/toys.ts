/** Data-driven toy definitions. Add a toy by adding an entry; physics and AI read these fields. */
export type ToyUse = "throw" | "melee" | "shield" | "ranged" | "tether" | "comfort" | "spring" | "heavy" | "breakable" | "projectile";

export interface ToyDef {
  id: string;
  name: string;
  uses: ToyUse[];
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  durability: number;
  color: string;
  /** Base knockback dealt on a solid hit (before mass/speed scaling). */
  punch: number;
  /** Impact sound/particle material. */
  material: "rubber" | "foam" | "plush" | "plastic" | "wood" | "cardboard";
  /** Can be held / carried in a bag. */
  portable: boolean;
  /** Relative spawn weight in toy chests. */
  spawn: number;
}

export const TOYS: Record<string, ToyDef> = {
  ball:      { id: "ball", name: "bouncy ball", uses: ["throw"], radius: 0.18, mass: 0.4, restitution: 0.75, friction: 0.6, durability: 60, color: "#ec2a1c", punch: 3, material: "rubber", portable: true, spawn: 5 },
  frisbee:   { id: "frisbee", name: "frisbee", uses: ["throw"], radius: 0.2, mass: 0.2, restitution: 0.4, friction: 1.4, durability: 40, color: "#3dd6ff", punch: 2, material: "plastic", portable: true, spawn: 3 },
  foam_sword:{ id: "foam_sword", name: "foam sword", uses: ["melee"], radius: 0.25, mass: 0.3, restitution: 0.3, friction: 2, durability: 45, color: "#c6ff3d", punch: 4, material: "foam", portable: true, spawn: 4 },
  noodle:    { id: "noodle", name: "pool noodle", uses: ["melee"], radius: 0.3, mass: 0.2, restitution: 0.4, friction: 2, durability: 35, color: "#ff7ad9", punch: 3, material: "foam", portable: true, spawn: 3 },
  plush:     { id: "plush", name: "plush bear", uses: ["throw", "comfort"], radius: 0.22, mass: 0.35, restitution: 0.1, friction: 3, durability: 80, color: "#f6b62c", punch: 1.5, material: "plush", portable: true, spawn: 3 },
  shield:    { id: "shield", name: "toy shield", uses: ["shield"], radius: 0.26, mass: 0.6, restitution: 0.3, friction: 2, durability: 90, color: "#9a8d80", punch: 1, material: "plastic", portable: true, spawn: 2 },
  foam_bow:  { id: "foam_bow", name: "foam bow", uses: ["ranged"], radius: 0.25, mass: 0.3, restitution: 0.2, friction: 2, durability: 50, color: "#b48cff", punch: 0, material: "plastic", portable: true, spawn: 2 },
  dart:      { id: "dart", name: "foam dart", uses: ["projectile"], radius: 0.08, mass: 0.05, restitution: 0.2, friction: 3, durability: 4, color: "#ff9a3d", punch: 2.2, material: "foam", portable: false, spawn: 0 },
  yoyo:      { id: "yoyo", name: "yo-yo", uses: ["tether", "throw"], radius: 0.12, mass: 0.15, restitution: 0.5, friction: 1, durability: 50, color: "#8fe3c0", punch: 1.5, material: "plastic", portable: true, spawn: 2 },
  spring:    { id: "spring", name: "jack-in-the-box", uses: ["spring", "throw"], radius: 0.22, mass: 0.5, restitution: 0.9, friction: 1.5, durability: 40, color: "#f6b62c", punch: 2, material: "plastic", portable: true, spawn: 2 },
  box:       { id: "box", name: "cardboard box", uses: ["breakable", "heavy"], radius: 0.35, mass: 2.2, restitution: 0.1, friction: 4, durability: 18, color: "#9a5a1c", punch: 2, material: "cardboard", portable: false, spawn: 2 },
  crate:     { id: "crate", name: "wooden crate", uses: ["heavy"], radius: 0.42, mass: 6, restitution: 0.05, friction: 6, durability: 400, color: "#6b3a12", punch: 3, material: "wood", portable: false, spawn: 0 },
  flail:     { id: "flail", name: "plush flail", uses: ["melee", "tether"], radius: 0.3, mass: 0.5, restitution: 0.3, friction: 2, durability: 60, color: "#ff7ad9", punch: 5, material: "plush", portable: true, spawn: 0 },
};

/** Crafting: two toys held together become an improvised one. */
export const RECIPES: { a: string; b: string; out: string; name: string }[] = [
  { a: "noodle", b: "plush", out: "flail", name: "plush flail" },
  { a: "frisbee", b: "foam_sword", out: "shield", name: "frisbee shield" },
];

export const isWeapon = (def: string) => TOYS[def]?.uses.some((u) => u === "melee" || u === "throw" || u === "ranged") ?? false;
export const canThrow = (def: string) => TOYS[def]?.uses.includes("throw") ?? false;
export const isMelee = (def: string) => TOYS[def]?.uses.includes("melee") ?? false;
