import type { Angles } from "./StickFigure";

/**
 * FIGURE RIG: turns the instant joint angles from pose() into fluid motion.
 * Every angle is chased by a tiny damped spring (semi-implicit Euler, fixed 1/120 s steps), so poses
 * ease into each other instead of snapping, shoulders lead and forearms follow through with a little
 * overshoot (secondary motion), and legs stay tight so footfalls still read. Hair and loose cloth ride a
 * second spring driven by how fast the head moves. State is one Float32Array per figure, no allocation
 * per frame, and a rig is built lazily the first time a figure is seen.
 */
const N = 13;
// field order matches Angles
const KEYS = ["lean", "bob", "hipX", "thighL", "bendL", "thighR", "bendR", "armL", "foreL", "armR", "foreR", "tilt", "lying"] as const;
//                lean bob  hipX thL  bnL  thR  bnR  arL  frL  arR  frR  tilt lying
const FREQ  = [16,  24,  16,  44,  40,  44,  40,  21,  15,  21,  15,  15,  9];
const ZETA  = [0.85, 0.8, 0.8, 0.95, 0.9, 0.95, 0.9, 0.62, 0.5, 0.62, 0.5, 0.7, 1];
const GAIT = new Set(["walk", "run", "panic"]);
const STEP = 1 / 120;

export class Rig {
  pos = new Float32Array(N);
  vel = new Float32Array(N);
  t = -1;
  /** hair / cloth sway, a spring chasing -head velocity; read by drawHead */
  sway = 0; swayV = 0; lastHx = 0; lastHy = 0; lastDrawT = -1; hasHead = false;
  /** vertical hair bounce */
  bounce = 0; bounceV = 0;
}

const rigs = new WeakMap<object, Rig>();
const OUT: Angles = { lean: 0, bob: 0, hipX: 0, thighL: 0, bendL: 0, thighR: 0, bendR: 0, armL: 0, foreL: 0, armR: 0, foreR: 0, tilt: 0, lying: 0 };

export function rigOf(key: object): Rig {
  let r = rigs.get(key);
  if (!r) { r = new Rig(); rigs.set(key, r); }
  return r;
}

/**
 * Ease the target pose `a` for one figure. `key` is any stable object owned by the figure (c.anim).
 * `t` is the animation clock in seconds. Returns a shared scratch Angles (valid until the next call).
 */
export function smooth(key: object, a: Angles, t: number, poseName: string): Angles {
  const r = rigOf(key);
  const tgt = a as unknown as Record<string, number>;
  const out = OUT as unknown as Record<string, number>;
  let dt = t - r.t;
  if (r.t < 0 || dt <= 0 || dt > 0.5) {   // first sight, clock jumped or paused: snap and carry on
    for (let i = 0; i < N; i++) { r.pos[i] = tgt[KEYS[i]]; r.vel[i] = 0; }
    r.t = t;
    return a;
  }
  if (dt > 0.05) dt = 0.05;
  r.t = t;
  const gait = GAIT.has(poseName) ? 2.3 : 1;
  const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < N; i++) {
      const w = FREQ[i] * (i >= 7 && i <= 10 ? gait : i >= 3 && i <= 6 ? 1.4 : 1);
      const acc = w * w * (tgt[KEYS[i]] - r.pos[i]) - 2 * ZETA[i] * w * r.vel[i];
      r.vel[i] += acc * h; r.pos[i] += r.vel[i] * h;
    }
  }
  for (let i = 0; i < N; i++) out[KEYS[i]] = r.pos[i];
  // follow-through: forearms flick a touch against how fast the upper arm swings
  OUT.foreL += -r.vel[7] * 0.035; OUT.foreR += -r.vel[9] * 0.035;
  return OUT;
}

/** Advance the hair/cloth spring from head motion (call once per drawn frame, after solve()). */
export function sway(key: object, hx: number, hy: number, k: number, dir: number, t: number): Rig {
  const r = rigOf(key);
  if (!r.hasHead || t - r.lastDrawT > 0.5 || t <= r.lastDrawT) { r.lastHx = hx; r.lastHy = hy; r.lastDrawT = t; r.hasHead = true; r.sway = 0; r.swayV = 0; r.bounce = 0; r.bounceV = 0; return r; }
  let dt = t - r.lastDrawT; if (dt > 0.05) dt = 0.05;
  const vx = (hx - r.lastHx) / (dt * Math.max(0.2, k) * 60), vy = (hy - r.lastHy) / (dt * Math.max(0.2, k) * 60);
  r.lastHx = hx; r.lastHy = hy; r.lastDrawT = t;
  const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps;
  const tx = Math.max(-1, Math.min(1, -vx * dir * 0.06)), ty = Math.max(-1, Math.min(1, vy * 0.05));
  for (let s = 0; s < steps; s++) {
    r.swayV += (190 * (tx - r.sway) - 11 * r.swayV) * h; r.sway += r.swayV * h;
    r.bounceV += (230 * (ty - r.bounce) - 9 * r.bounceV) * h; r.bounce += r.bounceV * h;
  }
  return r;
}
