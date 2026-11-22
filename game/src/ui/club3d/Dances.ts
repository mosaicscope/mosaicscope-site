/**
 * 520 dance moves for the Pink Pukeko, composed from three move banks: 26 arm styles x 20 body styles (= 520 combinations),
 * each with its own leg pattern and tempo. They are playful club, showgirl and party moves: shimmies, body rolls, hair flips,
 * hip swings and dips. Everyone stays clothed. Drives the same joint rig the original five routines use.
 */
import type { Mosaic } from "./Mosaic3D";

interface Arm { n: string; bx: number; bz: number; ax: number; az: number; ph: number; e: number; ea: number }
interface Body { n: string; hz: number; hy: number; sz: number; sy: number; cx: number; ht: number; hf: number; bounce: number; step: number }
interface Leg { lift: number; knee: number; cross: number }

// [name, base shoulder x, base shoulder z, swing x, swing z, left/right phase, base elbow, elbow swing]
const ARMS: Arm[] = ([
  ["Swan", -2.4, 0.5, 0.25, 0.2, 0, -0.4, 0.2], ["Windmill", -1.4, 1.0, 1.1, 0.4, 3.14, -0.2, 0.1], ["Siren", -2.7, 0.2, 0.1, 0.1, 0, -0.1, 0.05], ["Shoulder shimmy", -0.3, 0.25, 0.1, 0.3, 3.14, -1.2, 0.3],
  ["Wave", -1.8, 1.2, 0.2, 0.5, 1.6, -0.3, 0.3], ["Hands on hips", -0.1, 0.55, 0.05, 0.1, 0, -1.5, 0.1], ["Hair toss", -2.8, 0.7, 0.3, 0.3, 3.14, -1.4, 0.5], ["Jazz hands", -1.6, 0.9, 0.2, 0.25, 0, -0.2, 0.9],
  ["Fan flutter", -1.2, 0.8, 0.5, 0.2, 0, -0.9, 0.7], ["Pointing", -1.5, 0.3, 0.4, 0.5, 3.14, -0.1, 0.1], ["Cheerleader", -2.9, 0.9, 0.1, 0.15, 0, -0.1, 0.05], ["Snake arms", -1.0, 0.8, 0.7, 0.6, 1.6, -0.5, 0.6],
  ["Boa swing", -1.0, 0.6, 0.9, 0.3, 0, -0.7, 0.2], ["Stretch", -3.0, 0.1, 0.1, 0.05, 0, -0.05, 0.05], ["Pulse", -0.8, 0.7, 0.4, 0.35, 0, -1.0, 0.6], ["Hug", -1.1, -0.5, 0.2, 0.2, 3.14, -1.8, 0.2],
  ["Reach", -2.0, 0.2, 0.6, 0.1, 3.14, -0.1, 0.1], ["Clap", -1.2, -0.3, 0.1, 0.5, 3.14, -1.6, 0.2], ["Pose frame", -2.2, 0.6, 0.15, 0.15, 0, -1.9, 0.1], ["Disco finger", -2.6, 0.4, 0.4, 0.1, 3.14, -0.1, 0.4],
  ["Lasso", -2.4, 0.3, 1.0, 0.9, 0, -0.5, 0.3], ["Tango", -0.9, 0.9, 0.3, 0.2, 3.14, -1.1, 0.2], ["Ripple", -1.6, 0.7, 0.5, 0.4, 0.8, -0.4, 0.5], ["Float", -1.9, 1.1, 0.2, 0.15, 1.6, -0.2, 0.1],
  ["Shake it", -0.6, 0.4, 0.3, 0.45, 3.14, -1.4, 0.8], ["Curtsy", -0.4, 0.75, 0.15, 0.1, 0, -0.3, 0.05],
] as [string, number, number, number, number, number, number, number][]).map(([n, bx, bz, ax, az, ph, e, ea]) => ({ n, bx, bz, ax, az, ph, e, ea }));

// [name, hip tilt, hip turn, spine side, spine turn, chest roll, head tilt, hair flow, bounce, side step]
const BODIES: Body[] = ([
  ["Sway", 0.22, 0.1, 0.1, 0.05, 0.05, 0.1, 0.2, 0.02, 0], ["Figure eight", 0.2, 0.4, 0.15, 0.2, 0.1, 0.15, 0.3, 0.02, 0.05], ["Body roll", 0.12, 0.15, 0.12, 0.1, 0.35, 0.2, 0.25, 0.04, 0], ["Pop and lock", 0.3, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0],
  ["Slow grind", 0.1, 0.35, 0.08, 0.25, 0.1, 0.1, 0.35, 0.01, 0], ["Bounce", 0.08, 0.05, 0.03, 0.02, 0.1, 0.05, 0.4, 0.1, 0], ["Twirl", 0.1, 0.9, 0.05, 0.6, 0.05, 0.1, 0.5, 0.03, 0.1], ["Dip", 0.25, 0.1, 0.25, 0.1, 0.3, 0.3, 0.3, 0.07, 0],
  ["Strut", 0.18, 0.2, 0.08, 0.12, 0.05, 0.05, 0.25, 0.04, 0.15], ["Shimmy", 0.05, 0.05, 0.02, 0.02, 0.05, 0.1, 0.5, 0.01, 0.02], ["Hip circle", 0.2, 0.6, 0.1, 0.1, 0.1, 0.1, 0.3, 0.02, 0], ["Jive", 0.15, 0.15, 0.1, 0.1, 0.1, 0.15, 0.3, 0.09, 0.12],
  ["Glide", 0.12, 0.25, 0.06, 0.15, 0.05, 0.05, 0.2, 0.01, 0.35], ["Hair flip", 0.1, 0.2, 0.2, 0.15, 0.3, 0.45, 0.6, 0.03, 0], ["Wiggle", 0.28, 0.08, 0.2, 0.05, 0.05, 0.2, 0.3, 0.05, 0.03], ["Spin and pose", 0.1, 1.1, 0.05, 0.8, 0.1, 0.1, 0.5, 0.03, 0],
  ["Sashay", 0.24, 0.3, 0.1, 0.1, 0.05, 0.1, 0.3, 0.03, 0.25], ["Rock", 0.06, 0.1, 0.18, 0.05, 0.3, 0.1, 0.2, 0.05, 0], ["Stomp", 0.1, 0.1, 0.05, 0.05, 0.1, 0.05, 0.2, 0.12, 0.08], ["Swagger", 0.2, 0.25, 0.14, 0.12, 0.12, 0.2, 0.3, 0.03, 0.1],
] as [string, number, number, number, number, number, number, number, number, number][]).map(([n, hz, hy, sz, sy, cx, ht, hf, bounce, step]) => ({ n, hz, hy, sz, sy, cx, ht, hf, bounce, step }));

const LEGS: Leg[] = [{ lift: 0.1, knee: 0.15, cross: 0 }, { lift: 0.35, knee: 0.5, cross: 0 }, { lift: 0.2, knee: 0.3, cross: 0.2 }, { lift: 0.5, knee: 0.7, cross: 0 }, { lift: 0.15, knee: 0.1, cross: 0.35 }, { lift: 0.3, knee: 0.4, cross: 0.1 }, { lift: 0.05, knee: 0.2, cross: 0.05 }, { lift: 0.45, knee: 0.35, cross: 0.25 }, { lift: 0.25, knee: 0.6, cross: 0 }, { lift: 0.4, knee: 0.2, cross: 0.15 }];

export interface DanceMove { id: number; name: string; a: Arm; b: Body; l: Leg; speed: number }
export const DANCES: readonly DanceMove[] = Array.from({ length: ARMS.length * BODIES.length }, (_, i) => {
  const a = ARMS[i % ARMS.length], b = BODIES[Math.floor(i / ARMS.length)];
  return { id: i, name: `${b.n} + ${a.n}`, a, b, l: LEGS[(i * 7 + Math.floor(i / 11)) % LEGS.length], speed: 0.7 + (i % 6) * 0.12 };
});

/** Pose a Mosaic's joints for move `idx` at beat phase `t` (the caller has already reset the pose). */
export function applyDance(m: Mosaic, idx: number, t: number, bpmK: number): void {
  const d = DANCES[((idx % DANCES.length) + DANCES.length) % DANCES.length], rig = m.rig, a = d.a, b = d.b, l = d.l;
  const w = t * d.speed * bpmK, s = Math.sin(w), c = Math.cos(w), s2 = Math.sin(w * 2);
  rig.hips.position.y = 0.94 - 0.03 + b.bounce * Math.abs(s2); rig.hips.rotation.z = b.hz * s; rig.hips.rotation.y = b.hy * c;
  rig.spine.rotation.z = -b.sz * s; rig.spine.rotation.y = b.sy * c; rig.chest.rotation.x = b.cx * s2; rig.head.rotation.z = b.ht * Math.sin(w + 1); rig.head.rotation.x = -0.04; rig.hairFlow.rotation.z = b.hf * Math.sin(w * 1.5);
  rig.armL.shoulder.rotation.set(a.bx + a.ax * Math.sin(w + a.ph), 0, a.bz + a.az * Math.sin(w * 1.3 + a.ph));
  rig.armR.shoulder.rotation.set(a.bx + a.ax * Math.sin(w), 0, -(a.bz + a.az * Math.sin(w * 1.3)));
  rig.armL.elbow.rotation.set(a.e + a.ea * Math.sin(w * 2), 0, 0); rig.armR.elbow.rotation.set(a.e + a.ea * Math.sin(w * 2 + a.ph), 0, 0);
  const lp = Math.max(0, s), rp = Math.max(0, -s);
  rig.legL.hipJoint.rotation.set(-l.lift * lp, 0, 0.06 + l.cross * lp); rig.legL.knee.rotation.set(l.knee * lp, 0, 0);
  rig.legR.hipJoint.rotation.set(-l.lift * rp, 0, -0.06 - l.cross * rp); rig.legR.knee.rotation.set(l.knee * rp, 0, 0);
  m.root.position.x += b.step * Math.sin(w * 0.5);
}

/** Auto-rotate: each dancer walks through the whole library, a new move every `secs` seconds. */
export const autoMove = (name: string, elapsed: number, secs = 9): number => {
  let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h + Math.floor(elapsed / secs) * 37) % DANCES.length;
};
