import type { VehicleClass } from "../content/vehicles";

/**
 * Subtle per-car manufacturing variation,
 * derived from its plate so the same car always looks the same. Drawing (Cars.ts) and sound
 * (Diegetic.ts) read it; the simulation never does, so traffic movement and collisions are unchanged.
 */
export interface CarMutation {
  scale: number;        // within three percent of class dimensions
  axles: 1 | 2 | 3;     // standard two-axle chassis
  cabins: 1 | 2 | 3;    // one glasshouse
  rumble: number;       // low-end gain multiplier for the engine voice
  pitch: number;        // engine pitch multiplier (bigger = lower)
}

/** FNV-1a string hash, mapped to 0..1 values that are stable per (plate, class). */
function hashUnit(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const cache = new Map<string, CarMutation>();

export function carMutationOf(plate: string, cls: VehicleClass): CarMutation {
  const key = `${cls}|${plate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Class dimensions carry real size differences; plates only add manufacturing variation.
  const clamped = .97 + hashUnit(key, 2) * .06;
  const axles = 2, cabins = 1;
  const m: CarMutation = {
    scale: clamped,
    axles,
    cabins,
    rumble: 0.75 + 0.45 * clamped,
    pitch: Math.pow(clamped, -0.3),
  };
  cache.set(key, m);
  return m;
}
