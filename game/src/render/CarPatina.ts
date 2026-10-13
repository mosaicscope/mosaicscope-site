import type { VehicleClass } from "../content/vehicles";

/**
 * CAR PATINA: every car gets a life story. Louis read the "rusty sedan" and the sheet of dozens of small,
 * mismatched cars (art-requests/014, 015): no two are alike because they are old, mended, dirty, personalised.
 * This is the pure, deterministic half (derived from class, plate and price; nothing saved, no RNG drawn):
 * how old the car is, what has gone wrong with it (rust, dents, scratches, primer panels, mud) and how its
 * owner dressed it (stickers, pinstripes, a white roof, a lick of different paint). Cars.ts paints the marks.
 */
export type MarkKind = "rust" | "dent" | "scratch" | "primer" | "mud" | "sticker" | "stripe" | "sill" | "door";
/** A mark on a long side of the body, in face coordinates: t along the car (0 tail to 1 nose), u up the panel (0 sill to 1 shoulder). */
export interface Mark { kind: MarkKind; side: 0 | 1; t: number; u: number; w: number; h: number; col: string }

export interface Patina {
  /** 0 factory fresh to 1 wreck. */
  age: number;
  /** 0 clean to 1 filthy. */
  dirt: number;
  /** Paint multipliers: sun-bleached, per-car, so a row of "white" cars is never one white. */
  tint: [number, number, number];
  /** Sun fade toward grey, 0..0.5. */
  fade: number;
  /** A contrasting roof colour (two-tone, or a primer roof), or null for body colour. */
  roof: string | null;
  marks: Mark[];
  /** Top-plane story: the bonnet and boot are the biggest surfaces at street zoom. Sun bleach 0..0.3, rust blotches (along 0..1 over hood then boot, across -1..1, size), and an optional racing stripe. */
  bleach: number;
  topRust: [number, number, number, number][];
  stripe: string | null;
  yellowLamps: boolean;
  dice: boolean;
  aerial: boolean;
  missingHub: boolean;
}

const hash = (n: number): number => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const plateSeed = (plate: string): number => { let h = 7; for (let i = 0; i < plate.length; i++) h = Math.imul(h ^ plate.charCodeAt(i), 16777619); return h >>> 0; };

/** Base age by class: bangers are wrecks, emergency fleets are kept smart, supercars are babied. */
const AGE: Partial<Record<VehicleClass, number>> = {
  banger: 0.9, retro: 0.7, camper: 0.75, hearse: 0.5, minivan: 0.55, hatch: 0.5, sedan: 0.5, wagon: 0.5, mini: 0.45, ute: 0.5, van: 0.5, tradie: 0.55, flatdeck: 0.6, fourby: 0.6, lowrider: 0.4,
  police: 0.15, ambulance: 0.15, fire: 0.15, post: 0.3, bus: 0.35, bin: 0.55, tow: 0.55, taxi: 0.45, icecream: 0.6,
  jdm: 0.3, muscle: 0.35, sports: 0.1, super: 0.05, hothatch: 0.3, rally: 0.3, hotrod: 0.35, coupe: 0.35, roadster: 0.3, ev: 0.1, suv: 0.35, dcute: 0.35, limo: 0.3,
};
const STICKERS = ["#ff7ad9", "#3dd6ff", "#c6ff3d", "#f6b62c", "#ec2a1c", "#eee4d3"];
const DOORS = ["#c9d1d6", "#7a8f4a", "#b04a3a", "#3a6aa0", "#e8c42c", "#6a4a8a"];
const ROOFS = ["#eee4d3", "#1c1816", "#7a6f68", "#c9892a"];
const SERVICE = new Set<VehicleClass>(["police", "ambulance", "fire", "post", "bus", "taxi"]);

export function patinaOf(cls: VehicleClass, plate: string, price = 0, damage = 0): Patina {
  const s = plateSeed(plate), r = (n: number): number => hash(s + n * 977);
  const base = AGE[cls] ?? 0.4;
  const age = Math.max(0, Math.min(1, base + (r(1) - 0.5) * 0.4 - (price > 40000 ? 0.15 : 0)));
  const service = SERVICE.has(cls);
  const dirt = Math.max(0, Math.min(1, age * 0.7 + r(2) * 0.35 - 0.12));
  const marks: Mark[] = [];
  const add = (kind: MarkKind, n: number, f: (i: number) => Partial<Mark>): void => {
    for (let i = 0; i < n; i++) {
      const m: Mark = { kind, side: (r(10 + i + n) < 0.5 ? 0 : 1), t: 0.08 + r(20 + i + n * 3) * 0.78, u: 0.08 + r(30 + i + n * 5) * 0.5, w: 0.06, h: 0.1, col: "#000", ...f(i) };
      m.t = Math.max(0, Math.min(m.t, 0.99 - m.w)); m.u = Math.max(0, Math.min(m.u, 1 - m.h));   // always on the panel
      marks.push(m);
    }
  };
  if (!service) {
    add("rust", Math.round(age * 6), (i) => ({ w: 0.09 + (i % 3) * 0.05, h: 0.28 + r(40 + i) * 0.22, u: 0.0 + r(50 + i) * 0.3, col: i % 2 ? "rgba(122,62,22,.82)" : "rgba(92,46,18,.78)" }));
    // bold, readable at street zoom: a rusted-out sill along the whole flank, and a door from a different car
    add("sill", age > 0.42 ? 1 : 0, () => ({ t: 0.02, u: 0, w: 0.96, h: 0.2 + age * 0.14, col: "rgba(126,60,24,.85)" }));
    add("door", r(21) < 0.28 + age * 0.3 ? 1 : 0, () => ({ t: 0.28 + r(22) * 0.2, u: 0.04, w: 0.24, h: 0.84, col: DOORS[Math.floor(r(23) * DOORS.length)] }));
    add("primer", age > 0.55 && r(3) < 0.7 ? 1 : 0, () => ({ t: 0.3 + r(4) * 0.4, u: 0.12, w: 0.2, h: 0.62, col: "rgba(122,112,104,.95)" }));
    add("sticker", r(5) < 0.4 ? 1 : 0, () => ({ t: 0.1 + r(6) * 0.2, u: 0.5 + r(7) * 0.15, w: 0.07, h: 0.17, col: STICKERS[Math.floor(r(8) * STICKERS.length)] }));
    if (r(9) < 0.15) add("stripe", 1, () => ({ t: 0.02, u: 0.42, w: 0.96, h: 0.045, col: "rgba(238,228,211,.72)" }));
  }
  add("dent", Math.round(age * 2.5 + damage * 6 + r(11) * (service ? 0.5 : 1.2)), (i) => ({ w: 0.12 + r(60 + i) * 0.08, h: 0.28 + r(70 + i) * 0.2, u: 0.1 + r(80 + i) * 0.35, col: "rgba(0,0,0,.4)" }));
  add("scratch", Math.round(age * 3 + damage * 4), (i) => ({ w: 0.14 + r(90 + i) * 0.16, h: 0.15 + r(100 + i) * 0.25, u: 0.15 + r(110 + i) * 0.4, col: "rgba(255,240,215,.55)" }));
  if (dirt > 0.25) add("mud", 1, () => ({ t: 0.02, u: 0, w: 0.96, h: 0.1 + dirt * 0.2, col: `rgba(70,52,34,${(0.18 + dirt * 0.32).toFixed(2)})` }));
  const v = (n: number): number => 1 + (r(n) - 0.5) * 0.14;
  const topRust: [number, number, number, number][] = [];
  if (!service) for (let i = 0, n = Math.round(age * 4); i < n; i++) topRust.push([r(130 + i) < 0.6 ? 0 : 1, r(140 + i), (r(150 + i) - 0.5) * 1.3, 0.05 + r(160 + i) * 0.06]);
  return {
    age, dirt, marks, topRust,
    bleach: service ? 0 : Math.min(0.3, age * 0.32),
    stripe: !service && r(24) < 0.14 ? STICKERS[Math.floor(r(25) * STICKERS.length)] : null,
    tint: [v(12), v(13), v(14)],
    fade: service ? 0 : Math.min(0.5, age * 0.45),
    roof: !service && cls !== "super" && cls !== "sports" && r(15) < 0.18 + age * 0.12 ? ROOFS[Math.floor(r(16) * ROOFS.length)] : null,
    yellowLamps: age > 0.55 && r(17) < 0.6,
    dice: !service && r(18) < 0.25,
    aerial: !service && r(19) < 0.3,
    missingHub: age > 0.6 && r(20) < 0.5,
  };
}

/** Apply sun fade, per-car tint and dirt to a base paint colour. */
export function weather(rgb: [number, number, number], p: Patina): [number, number, number] {
  const lum = (rgb[0] + rgb[1] + rgb[2]) / 3, dim = 1 - p.dirt * 0.18;
  return rgb.map((c, i) => Math.max(0, Math.min(255, (c + (lum - c) * p.fade) * p.tint[i] * dim))) as [number, number, number];
}
