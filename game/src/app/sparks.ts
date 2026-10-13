/**
 * Gilbert's two long-haul sparks, kept pure so they can be tested without a browser.
 *  - The golden minute: game hour 18:00 to 19:00 is exactly one real minute at 1x. When the clock
 *    crosses 18:00 the world eases into slow motion for a few seconds under a warm amber wash.
 *  - The streak: consecutive local calendar days of play build a glow on the clock; day 7 gets a gift.
 */

/** Real seconds of each phase of the golden-minute slow-mo. */
export const GOLDEN = { easeIn: 1.2, hold: 4.6, easeOut: 1.5, floor: 0.45 } as const;
export const GOLDEN_LEN = GOLDEN.easeIn + GOLDEN.hold + GOLDEN.easeOut;
export const GOLDEN_HOUR = 18;

const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** True on the step the clock passes 18:00 (a wrap through midnight never counts). */
export function crossedGolden(prevHour: number, hour: number): boolean {
  return prevHour < GOLDEN_HOUR && hour >= GOLDEN_HOUR && hour - prevHour < 1;
}

/** 0..1 strength of the golden moment `t` real seconds in (smoothstep in, hold, smoothstep out). */
export function goldenEnvelope(t: number): number {
  if (t <= 0 || t >= GOLDEN_LEN) return 0;
  if (t < GOLDEN.easeIn) return smooth(t / GOLDEN.easeIn);
  if (t < GOLDEN.easeIn + GOLDEN.hold) return 1;
  return 1 - smooth((t - GOLDEN.easeIn - GOLDEN.hold) / GOLDEN.easeOut);
}

/** Time scale for the sim clock: 1 normally, dipping to GOLDEN.floor at full strength. */
export function goldenTimeScale(t: number): number {
  return 1 - (1 - GOLDEN.floor) * goldenEnvelope(t);
}

export interface Streak { last: string; count: number; best: number }

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number), [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Advance the streak for a play session on `today`. Same day: unchanged. Next day: +1. Any gap: back to 1. */
export function nextStreak(prev: Streak | null, today: string): { streak: Streak; changed: boolean } {
  if (!prev || !/^\d{4}-\d{2}-\d{2}$/.test(prev.last) || !(prev.count >= 1)) return { streak: { last: today, count: 1, best: 1 }, changed: true };
  const gap = daysBetween(prev.last, today);
  if (gap === 0) return { streak: prev, changed: false };
  const count = gap === 1 ? prev.count + 1 : 1;
  return { streak: { last: today, count, best: Math.max(prev.best || 0, count) }, changed: true };
}

/** 0 for day 1, then rising to 1 at day 7 and staying there. */
export function streakGlow(count: number): number {
  return Math.max(0, Math.min(1, (count - 1) / 6));
}

/** Day 7, 14, 21 ... get the surprise. */
export const isStreakGiftDay = (count: number): boolean => count >= 7 && count % 7 === 0;
export const STREAK_GIFT = 77;

export function streakLine(count: number): string {
  if (isStreakGiftDay(count)) return `Day ${count} in a row. A little something for turning up: $${STREAK_GIFT}.`;
  if (count === 1) return "";
  return `Day ${count} in a row. The glow's getting warmer.`;
}

// ---------------------------------------------------------------------------------------------
// Glow trail and the all-calm glow (Bertha's round 4, approved by Chris). Both are drawn by ui/Glow.ts.

/** The trail behind the player: a point every TRAIL.step tiles, each fading over TRAIL.life seconds. */
export const TRAIL = { step: 0.18, life: 0.85, max: 14, peak: 0.55 } as const;

/** Alpha of a trail point `age` seconds old: a quick bloom then a smooth fade to nothing. Quadratic, so the tail vanishes softly. */
export function trailAlpha(age: number): number {
  if (age <= 0 || age >= TRAIL.life) return 0;
  const k = 1 - age / TRAIL.life;
  return TRAIL.peak * k * k;
}

/** The calm glow: the player has been still this long, in a tended spot, before it starts. */
export const CALM = { still: 2.5, rise: 1.8, fall: 0.5, peak: 0.2, radius: 5 } as const;

/** A spot is tended when no litter is lying within CALM.radius tiles. */
export function isTended(pieces: ReadonlyArray<{ x: number; y: number; taken: boolean }>, x: number, y: number): boolean {
  for (const p of pieces) if (!p.taken && Math.hypot(p.x - x, p.y - y) < CALM.radius) return false;
  return true;
}

/** Advance the calm level (0..1): rises over CALM.rise once still for CALM.still in a tended spot, drops in CALM.fall otherwise. */
export function calmStep(level: number, stillFor: number, tended: boolean, dt: number): number {
  const on = tended && stillFor >= CALM.still;
  return Math.max(0, Math.min(1, level + (on ? dt / CALM.rise : -dt / CALM.fall)));
}
