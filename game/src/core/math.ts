export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);
/** Smallest signed angle difference a-b in (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
/** Move value toward target by at most maxDelta. */
export const approach = (v: number, target: number, maxDelta: number): number =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);
