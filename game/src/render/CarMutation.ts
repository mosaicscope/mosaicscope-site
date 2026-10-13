import type { VehicleClass } from "../content/vehicles";

/**
 * Per-car "mutation": a deterministic, purely visual exaggeration of a car's size and layout,
 * derived from its plate so the same car always looks the same. Drawing (Cars.ts) and sound
 * (Diegetic.ts) read it; the simulation never does, so traffic movement and collisions are unchanged.
 */
export interface CarMutation {
  scale: number;        // drawn size multiplier (micro ≈ 0.55, monstrous ≈ 2.2)
  axles: 1 | 2 | 3;     // 1 = single-wheel micro-car, 3 = long multi-axle monster
  cabins: 1 | 2 | 3;    // extra glasshouse pods stacked on the body
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
  // Emergency and work vehicles stay near their real proportions so their livery still reads.
  const tame = cls === "police" || cls === "ambulance" || cls === "fire" || cls === "bus" || cls === "bin";
  const u = hashUnit(key, 1);
  // Skew towards normal sizes: square the unit so most cars are near 1, with rare extremes at both ends.
  const spread = (u * 2 - 1);
  const scale = tame ? 0.95 + hashUnit(key, 2) * 0.15 : 1 + Math.sign(spread) * Math.abs(spread) ** 2 * 0.8 + (hashUnit(key, 3) - 0.5) * 0.12;
  const clamped = Math.max(0.55, Math.min(2.2, scale));
  const axles: 1 | 2 | 3 = clamped < 0.8 ? 1 : clamped > 1.85 ? 3 : 2;
  const cabins: 1 | 2 | 3 = clamped > 1.5 ? (hashUnit(key, 4) < 0.5 ? 2 : 3) : clamped > 1.15 && hashUnit(key, 5) < 0.3 ? 2 : 1;
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
