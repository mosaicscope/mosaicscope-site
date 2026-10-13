/**
 * Lil Wooski's mood layers: small, chill add-ons on top of the scene score. Dream mode after a long walk,
 * rain-on-the-window vinyl, a hushed 3am layer, and the busker's little day-following tune.
 * All pure (no AudioContext) so it is unit-tested; Music.ts and Audio.ts only read these numbers.
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrapHour = (h: number): number => ((h % 24) + 24) % 24;

/** Seconds of steady walking before the dream starts, and when it is full. */
export const DREAM_FROM = 90;
export const DREAM_FULL = 240;

/** 0..1: how deep into the dream the player is after walking for `walked` seconds. */
export const dreamLevel = (walked: number): number => smooth(DREAM_FROM, DREAM_FULL, walked);

/** Walk timer: grows while moving, drains (faster than it grew) when the player stops, so a rest wakes you gently. */
export function stepWalk(walked: number, speed: number, dt: number): number {
  const d = Math.min(0.25, Math.max(0, dt));
  return speed > 0.6 ? Math.min(DREAM_FULL * 1.5, walked + d) : Math.max(0, walked - d * 3);
}

/** 0..1: the sleepy 3am layer. Fades in around 1am, full 2am to 4am, gone by 5:30. Chases, danger and busy streets cut it. */
export function lateLevel(hour: number, tension = 0, crowd = 0): number {
  const h = wrapHour(hour), t = h < 12 ? h : h - 24; // late evening reads as negative so 23:00 counts as -1
  const clock = smooth(-0.5, 2, t) * (1 - smooth(4, 5.5, t));
  return clamp01(clock * (1 - clamp01(tension * 2)) * (1 - clamp01(crowd) * 0.6));
}

export interface Layers {
  /** tempo multiplier */ bpm: number;
  /** pad brightness multiplier */ bright: number;
  /** lead busyness multiplier */ density: number;
  /** vinyl crackle gain */ crackle: number;
  /** rain-on-glass noise gain (0 when dry) */ glass: number;
  /** hushed 3am pad gain */ hush: number;
  /** pad detune wobble in cents */ wobble: number;
  /** canvas hue drift in degrees */ hue: number;
}

export const BASE_CRACKLE = 0.02;

/** Everything the layers do to the base score right now. All values are gentle on purpose (lofi, never jarring). */
export function layersFor(o: { dream: number; late: number; rain: number; indoors?: boolean }): Layers {
  const rain = clamp01(o.rain), dream = clamp01(o.dream), late = clamp01(o.late);
  return {
    bpm: (1 - dream * 0.14) * (1 - late * 0.08),
    bright: (1 - dream * 0.3) * (1 - late * 0.15) * (1 - rain * 0.1),
    density: (1 - dream * 0.25) * (1 - late * 0.4),
    crackle: BASE_CRACKLE * (1 + rain * 1.4 + late * 0.3 + dream * 0.4),
    glass: o.indoors ? rain * 0.03 : 0,
    hush: late * 0.03,
    wobble: dream * 14,
    hue: dream * 28,
  };
}

/** The busker plays a tiny track that follows the mood of the day. */
export interface BuskerTune { name: string; bpm: number; root: number; steps: number[]; chance: number; gain: number }
export const BUSKER_TUNES: BuskerTune[] = [
  { name: "morning", bpm: 84, root: 62, steps: [0, 2, 4, 7, 9, 12], chance: 0.55, gain: 1 },        // sunny ukulele pentatonic
  { name: "afternoon", bpm: 92, root: 60, steps: [0, 2, 4, 5, 7, 9, 11, 12], chance: 0.6, gain: 1 }, // easy walking major
  { name: "evening", bpm: 76, root: 57, steps: [0, 2, 3, 5, 7, 8, 10, 12], chance: 0.45, gain: 0.9 }, // gentle minor
  { name: "late", bpm: 62, root: 55, steps: [0, 3, 5, 7, 10, 12], chance: 0.3, gain: 0.75 },          // slow and sparse
];

export function buskerTune(hour: number, rain = 0): BuskerTune {
  const h = wrapHour(hour);
  const base = h >= 6 && h < 12 ? BUSKER_TUNES[0] : h >= 12 && h < 17 ? BUSKER_TUNES[1] : h >= 17 && h < 22 ? BUSKER_TUNES[2] : BUSKER_TUNES[3];
  // rain: slower, softer, sparser
  return rain > 0.4 ? { ...base, bpm: base.bpm * 0.9, chance: base.chance * 0.8, gain: base.gain * 0.85 } : base;
}

/** One eighth-note slot of the busker's tune: a midi note or null. Bar 0 of every 4 starts on the root so it feels like a song. */
export function buskerNote(tune: BuskerTune, bar: number, slot: number, rand: () => number): number | null {
  if (slot % 2 === 1 && rand() < 0.5) return null;
  if (bar % 4 === 0 && slot === 0) return tune.root;
  if (rand() > tune.chance) return null;
  return tune.root + tune.steps[Math.floor(rand() * tune.steps.length)];
}

/** How loud the busker is at `dist` tiles; inaudible beyond `BUSKER_RANGE`. */
export const BUSKER_RANGE = 14;
export const buskerGain = (dist: number): number => { const t = clamp01(1 - dist / BUSKER_RANGE); return t * t; };
