/**
 * AMBIENT: one shared wind and one shared evening rhythm, so the street moves together and the windows keep believable hours.
 *
 * Pure and deterministic: no RNG, nothing saved, the sim is untouched. Both are a few multiplies per call, so they are safe in the
 * hot draw loops. The renderer sets the game hour once a frame; everything else just asks.
 */

/** Wind at a moment: `lean` is the slow push (-1..1), `gust` how strong the air is right now (0.35..1). One value for every tree and banner. */
export interface Wind { lean: number; gust: number }

let windT = Number.NaN;
const W: Wind = { lean: 0, gust: 0.5 };

/** The street's wind at `time` (seconds). Cached per frame; the same object is returned for equal times. */
export function wind(time: number): Wind {
  if (time === windT) return W;
  windT = time;
  W.lean = 0.5 * Math.sin(time * 0.11) + 0.3 * Math.sin(time * 0.23 + 1.3) + 0.2 * Math.sin(time * 0.057 + 4);
  W.gust = 0.675 + 0.325 * Math.sin(time * 0.09 + 0.7) * Math.sin(time * 0.041 + 2);
  return W;
}

/**
 * Sway of one thing in the wind, about -1.4..1.4. `phase` keeps neighbours from nodding in step (a 0..1 seed or any number);
 * `stiff` (1 = tree, 2+ = something heavy) damps it. The shared lean means everything leans the same way as a gust passes.
 */
export function sway(time: number, phase: number, stiff = 1): number {
  const w = wind(time);
  return (Math.sin(time * 1.1 + phase * 20) * w.gust * 0.7 + w.lean * 0.75) / stiff;
}

let clock = 12;
/** Set once per frame from the sim's game hour (0..24). */
export function setClock(hour: number): void { clock = hour; }
export function clockHour(): number { return clock; }

const mix = (n: number): number => { n = Math.imul(n ^ 0x7f4a7c15, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/**
 * Is this household's window lit at `hour`? Everyone comes home and switches on between about 17:30 and 21:00; most are out by
 * midnight, a few night owls stay on until 05:00, and some early risers light up between 05:00 and 07:30. Seed it with anything stable.
 */
export function windowOn(seed: number, hour: number): boolean {
  const on = 17.5 + mix(seed) * 3.5, off = 22 + mix(seed + 101) * mix(seed + 211) * 7;   // off skews early; past 24 means a night owl, up to off - 24
  if (hour >= on) return hour < Math.min(off, 24) || off > 24;
  if (hour < off - 24) return true;
  return mix(seed + 307) < 0.22 && hour >= 5 + mix(seed + 401) * 2.5 && hour < 7.5;
}
