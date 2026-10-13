import type { Character, EyeShape, Face } from "../entities/types";
import { Phys } from "../entities/types";
import { dressOf } from "../mind/Dress";
import type { Dress } from "../mind/Dress";
import { isResident, drawResident } from "./Residents";
import { modelOf, modelLook, drawModelBody, drawModelHeadGear, MODEL_INK } from "./Models";
import { drawFaceGenes } from "./FaceGenes";

/**
 * Procedural stick figures in the style of the MosaicScope footer crew (single-stroke limbs, neon
 * colours) with real adult proportions. A pose function produces joint angles; `solve` turns them
 * into absolute screen points; draw functions stroke them. No per-figure canvas transforms, so
 * background figures can be batched.
 */
export interface Angles {
  lean: number; bob: number; hipX: number;
  thighL: number; bendL: number; thighR: number; bendR: number;
  armL: number; foreL: number; armR: number; foreR: number;
  tilt: number; lying: number; // lying: 0 upright .. 1 flat on the ground
}

const A: Angles = { lean: 0, bob: 0, hipX: 0, thighL: 0, bendL: 0, thighR: 0, bendR: 0, armL: 0, foreL: 0, armR: 0, foreR: 0, tilt: 0, lying: 0 };
const reset = () => { A.lean = 0; A.bob = 0; A.hipX = 0; A.thighL = 0; A.bendL = 0; A.thighR = 0; A.bendR = 0; A.armL = 0.12; A.foreL = 0.1; A.armR = 0.12; A.foreR = 0.1; A.tilt = 0; A.lying = 0; };

/** Choose angles for a pose. t = seconds, ph = walk phase, speed = ground speed. */
/** 20 punch variants: the arm, forearm, lean and stance each one ends in, reached in `t` seconds. */
const PUNCHES: { t: number; to: Partial<Angles> }[] = [
  { t: 0.18, to: { armR: 1.6, foreR: 0.1, lean: 0.2 } },                       // 0 straight jab
  { t: 0.2, to: { armR: 1.9, foreR: 0.0, lean: 0.34, thighR: -0.3 } },          // 1 cross
  { t: 0.24, to: { armL: 2.2, foreL: 1.2, lean: 0.12, bendL: 0.4 } },           // 2 left hook
  { t: 0.24, to: { armR: 2.5, foreR: 1.4, lean: 0.1 } },                        // 3 right hook
  { t: 0.22, to: { armR: -0.4, foreR: 2.4, lean: 0.4 } },                       // 4 uppercut
  { t: 0.3, to: { armR: 2.9, foreR: 0.0, lean: 0.45, thighR: -0.45 } },         // 5 overhand smash
  { t: 0.3, to: { armR: 2.6, foreR: 1.0, lean: 0.3, thighL: 0.5 } },            // 6 haymaker
  { t: 0.16, to: { armL: 1.0, foreL: 0.2, lean: 0.5 } },                        // 7 body shot
  { t: 0.18, to: { armR: 1.1, foreR: 0.3, armL: 0.9, foreL: 0.4, lean: 0.25 } },// 8 double jab
  { t: 0.2, to: { armR: 1.4, foreR: 0.9, lean: -0.1, thighR: 0.6 } },           // 9 backfist
  { t: 0.26, to: { armL: 1.8, foreL: 0.1, lean: 0.3, thighL: -0.5, thighR: 0.4 } }, // 10 lunge jab
  { t: 0.26, to: { armR: 1.5, foreR: 2.2, lean: 0.55, bendR: 1.0 } },           // 11 elbow strike
  { t: 0.22, to: { armR: 0.6, foreR: 1.6, armL: 0.5, foreL: 1.6, lean: 0.2 } }, // 12 guard up, forward
  { t: 0.28, to: { armR: 2.1, foreR: 0.6, lean: -0.3, thighR: 0.9, thighL: -0.3 } }, // 13 spinning back punch
  { t: 0.2, to: { armR: 1.7, foreR: 0.2, lean: 0.15, hipX: 4 } },               // 14 shoulder-led jab
  { t: 0.24, to: { armL: 2.7, foreL: 0.4, lean: 0.4, thighR: -0.6 } },          // 15 rabbit punch
  { t: 0.3, to: { armR: 2.3, foreR: 0.5, lean: 0.6, bendL: 1.1, thighL: 0.8 } },// 16 low dropping punch
  { t: 0.22, to: { armR: 1.2, foreR: 1.9, armL: 1.2, foreL: 1.9, lean: 0.35 } },// 17 double-fist slam
  { t: 0.26, to: { armL: 2.0, foreL: 2.0, armR: 0.3, foreR: 0.2, lean: 0.15, tilt: 0.2 } }, // 18 sideways hook
  { t: 0.34, to: { armR: 3.0, foreR: 0.0, lean: 0.7, thighR: -0.7, thighL: 0.6, bob: 3 } }, // 19 full-body wind-up punch
];

export function pose(name: string, style: string, t: number, ph: number, speed: number, poseT: number): Angles {
  reset();
  const s = Math.sin(ph), c = Math.cos(ph);
  switch (name) {
    case "walk": {
      A.thighL = s * 0.45; A.thighR = -s * 0.45; A.bendL = Math.max(0, -c) * 0.5; A.bendR = Math.max(0, c) * 0.5;
      A.armL = -s * 0.42; A.armR = s * 0.42; A.foreL = 0.25; A.foreR = 0.25; A.bob = -Math.abs(c) * 2;
      if (style === "swagger") { A.lean = -0.06; A.armR = s * 0.6; }
      if (style === "bouncy") A.bob = -Math.abs(c) * 4;
      break;
    }
    case "run": {
      // Running responds to speed: stride reach, knee lift, lean and bounce all grow with f (0 = jog, 1 = flat out).
      // Legs and arms swing opposite; the body is lowest at footfall, so the bounce runs at twice the stride rate.
      const f = Math.min(1, Math.max(0, (speed - 2.6) / 4));
      A.thighL = s * (0.6 + 0.35 * f); A.thighR = -s * (0.6 + 0.35 * f);
      A.bendL = Math.max(0, -c) * (1.1 + 0.6 * f) + 0.15; A.bendR = Math.max(0, c) * (1.1 + 0.6 * f) + 0.15;
      A.lean = 0.1 + 0.18 * f;
      A.bob = -(1 - Math.cos(2 * ph)) * (1.5 + 3 * f);
      A.armL = -s * (0.8 + 0.4 * f); A.armR = s * (0.8 + 0.4 * f); A.foreL = 1.5; A.foreR = 1.5; // elbows near a right angle
      break;
    }
    case "panic": {
      A.thighL = s * 0.85; A.thighR = -s * 0.85; A.bendL = Math.max(0, -c) * 1.3 + 0.2; A.bendR = Math.max(0, c) * 1.3 + 0.2;
      A.lean = 0.05; A.bob = -Math.abs(c) * 4;
      A.armL = 2.7 + Math.sin(t * 14) * 0.4; A.armR = 2.7 + Math.cos(t * 13) * 0.4; A.foreL = 0.3; A.foreR = 0.3;
      break;
    }
    case "dance": dance(style, t); break;
    case "cheer": A.armL = 2.7 + Math.sin(t * 10) * 0.3; A.armR = 2.7 + Math.cos(t * 10) * 0.3; A.bob = -Math.abs(Math.sin(t * 6)) * 4; break;
    case "watch": A.armL = 0.7; A.foreL = 1.9; A.armR = 0.7; A.foreR = 1.9; A.tilt = Math.sin(t * 0.7) * 0.08; break;
    case "think": A.armR = 0.45; A.foreR = 2.5; A.armL = 0.5; A.foreL = 1.6; A.tilt = 0.15; break;
    case "talk": A.armR = 0.5 + Math.sin(t * 5) * 0.35; A.foreR = 0.9 + Math.sin(t * 7) * 0.3; A.armL = 0.15; A.tilt = Math.sin(t * 3) * 0.06; break;
    case "throw": {
      const w = Math.min(1, poseT / 0.38);
      if (w < 1) { A.armR = -1.2 - w * 1.4; A.foreR = -0.6; A.lean = -0.12 * w; A.thighR = -0.25 * w; A.thighL = 0.2 * w; A.armL = 0.9; }
      else { A.armR = 1.5; A.foreR = 0.1; A.lean = 0.25; A.thighL = 0.35; A.thighR = -0.3; A.armL = -0.4; }
      break;
    }
    case "swing": {
      const w = Math.min(1, poseT / 0.28);
      if (w < 1) { A.armR = 2.4 + w * 0.6; A.foreR = 0.2; A.lean = -0.08; } else { A.armR = 0.9; A.foreR = 0.2; A.lean = 0.28; A.thighL = 0.4; A.thighR = -0.25; }
      A.armL = 0.7; A.foreL = 1.2;
      break;
    }
    case "punch0": case "punch1": case "punch2": case "punch3": case "punch4": case "punch5": case "punch6": case "punch7": case "punch8": case "punch9":
    case "punch10": case "punch11": case "punch12": case "punch13": case "punch14": case "punch15": case "punch16": case "punch17": case "punch18": case "punch19": {
      // 20 punch variants: each one is a short reach-and-recover with its own arm, lean and stance
      const v = PUNCHES[Number(name.slice(5))], w = Math.min(1, poseT / v.t), back = poseT > v.t ? Math.min(1, (poseT - v.t) / 0.25) : 0;
      const k = w * (1 - back);
      for (const key of Object.keys(v.to) as (keyof Angles)[]) (A as any)[key] = (A as any)[key] + ((v.to[key] as number) - (A as any)[key]) * k;
      A.bob += -2 * k;
      break;
    }
    case "kick": A.thighR = 1.2; A.bendR = 0.1; A.lean = -0.15; A.armL = 0.9; A.armR = -0.5; break;
    case "shoot": A.armL = 1.55; A.foreL = 0; A.armR = 1.5; A.foreR = poseT < 0.45 ? -1.6 : -0.4; break;
    case "sit": A.bob = 15; A.thighL = 1.45; A.thighR = 1.35; A.bendL = 1.5; A.bendR = 1.4; A.lean = -0.1; A.armL = 0.6; A.foreL = 0.9; A.armR = 0.3; break;
    case "comfort": case "craft": case "search": {
      A.bob = 12; A.thighL = 1.0; A.thighR = 0.5; A.bendL = 1.8; A.bendR = 1.9; A.lean = 0.45;
      A.armL = 1.1; A.foreL = 0.4; A.armR = 1.2 + (name === "craft" ? Math.sin(t * 9) * 0.2 : 0); A.foreR = 0.6;
      if (name === "search") { A.bob = 4; A.thighL = 0.2; A.thighR = 0; A.bendL = 0.3; A.bendR = 0.3; A.armR = 2.2; A.foreR = 1.2; A.tilt = Math.sin(t * 2) * 0.3; }
      break;
    }
    case "music": A.armL = 1.2; A.foreL = 0.7; A.armR = 1.2 + Math.sin(t * 8) * 0.15; A.foreR = 0.7; A.tilt = Math.sin(t * 8) * 0.2; A.bob = -Math.abs(Math.sin(t * 4)) * 2; break;
    case "phone": A.armR = 0.4; A.foreR = 2.6; A.tilt = -0.15; break;
    case "eat": A.armR = 0.5; A.foreR = 2.3 + Math.sin(t * 6) * 0.15; A.armL = 0.25; A.tilt = -0.08; break;
    case "spray": A.armR = 1.7 + Math.sin(t * 9) * 0.15; A.foreR = 0.2; A.armL = 0.3; A.lean = 0.05; break;
    case "camera": A.armL = 0.7; A.foreL = 2.3; A.armR = 0.7; A.foreR = 2.3; A.lean = 0.12; A.thighL = 0.3; A.thighR = -0.2; A.bendL = 0.4; break;
    case "posecool": A.armL = 0.6; A.foreL = 1.9; A.armR = 2.6 + Math.sin(t * 0.8) * 0.1; A.foreR = 0.3; A.hipX = 1.5; A.tilt = 0.12; A.thighL = 0.15; break;
    case "skate": A.bob = 4; A.thighL = 0.35; A.thighR = -0.25; A.bendL = 0.5; A.bendR = 0.4; A.armL = -1.0 + Math.sin(t * 2) * 0.2; A.armR = 1.2; A.lean = 0.12; break;
    case "guitar": A.armL = 0.9; A.foreL = 1.2; A.armR = 0.55 + Math.sin(t * 9) * 0.18; A.foreR = 1.3; A.tilt = Math.sin(t * 3) * 0.12; A.bob = -Math.abs(Math.sin(t * 3)) * 1.5; break;
    case "cuffed": A.armL = -0.45; A.foreL = -0.9; A.armR = -0.45; A.foreR = -0.9; A.tilt = 0.25; A.lean = 0.08; break;
    case "stunned": A.armL = -0.8 + Math.sin(t * 30) * 0.3; A.armR = 0.8 + Math.cos(t * 28) * 0.3; A.lean = Math.sin(t * 25) * 0.08; A.thighL = 0.1; A.bendL = 0.4; A.bendR = 0.4; break;
    case "kiss": A.lean = 0.28; A.armL = 1.1; A.foreL = 0.9; A.armR = 1.0; A.foreR = 1.0; A.tilt = 0.2; break;
    case "threaten": A.armR = 1.45; A.foreR = 0.05; A.lean = 0.15; A.armL = 0.6; A.foreL = 1.2; A.thighL = 0.3; A.bendL = 0.3; break;
    case "idle": break;
    case "stumble": A.lean = -0.45; A.armL = -2.0; A.armR = 2.0; A.foreL = 0.4; A.foreR = 0.4; A.thighL = -0.4; A.thighR = 0.3; break;
    case "down": A.lying = 1; A.armL = 2.2; A.armR = 1.4; A.thighL = 0.3; A.thighR = -0.1; A.bendL = 0.6; break;
    case "recover": A.bob = 14; A.thighL = 1.3; A.bendL = 1.7; A.thighR = 0.1; A.bendR = 2.2; A.lean = 0.35; A.armL = 0.8; A.armR = 0.5; break;
    default: { // idle
      A.bob = Math.sin(t * 2) * 0.6;
      if (style === "swagger") { A.lean = -0.05; A.armR = 0.5; A.foreR = 1.6; }
      else if (style === "smooth") { A.armL = 0.35; A.foreL = 1.5; A.hipX = Math.sin(t * 1.3) * 1; }
      else if (style === "hype") { A.bob = -Math.abs(Math.sin(t * 3)) * 1.5; }
    }
  }
  if (speed > 0.05 && name !== "walk" && name !== "run" && name !== "panic") { /* moving while posing: keep legs walking */ }
  return A;
}

function dance(style: string, t: number): void {
  const b = Math.sin(t * 7.5), bb = Math.abs(b);
  switch (style) {
    case "swagger": A.bob = -bb * 4; A.armR = 2.5 + b * 0.35; A.foreR = 0.3; A.armL = 0.4 + b * 0.2; A.lean = -0.05; A.thighL = b * 0.2; break;
    case "smooth": A.hipX = Math.sin(t * 3.8) * 3.5; A.armL = 2.3 + Math.sin(t * 3.8) * 0.5; A.armR = 2.3 - Math.sin(t * 3.8) * 0.5; A.foreL = 0.6; A.foreR = 0.6; A.bob = -bb * 2; break;
    case "bouncy": A.bob = -Math.abs(Math.sin(t * 6)) * 9; A.bendL = 0.9 * (1 - bb); A.bendR = 0.9 * (1 - bb); A.armL = 1.2 + b; A.armR = 1.2 - b; break;
    case "loose": A.armL = 1.4 + Math.sin(t * 5.1) * 1.2; A.armR = 1.4 + Math.cos(t * 4.3) * 1.2; A.foreL = Math.sin(t * 7) * 0.8; A.foreR = Math.cos(t * 6) * 0.8; A.thighL = Math.sin(t * 5) * 0.4; A.tilt = Math.sin(t * 5) * 0.2; A.bob = -bb * 3; break;
    case "sharp": { const q = Math.round(Math.sin(t * 4) * 2) / 2; A.armL = 1.57 + q; A.foreL = 1.57 * (q > 0 ? 1 : 0); A.armR = 1.57 - q; A.foreR = -1.57 * (q < 0 ? 1 : 0); A.thighL = q * 0.3; A.bob = -Math.abs(q) * 2; break; }
    default: A.armL = 2.8; A.armR = 2.8; A.foreL = Math.sin(t * 9) * 0.4; A.foreR = -Math.sin(t * 9) * 0.4; A.bob = -Math.abs(Math.sin(t * 9)) * 7;
  }
}

/** Absolute joint positions (screen px). Layout: hip, neck, head, shoulder, elbowL, handL, elbowR, handR, kneeL, footL, kneeR, footR. */
export const J = new Float32Array(24);
/** How many figures may get the HD pass this frame (the renderer resets it; nearest first). */
export let hdBudget = 0;
export function resetHdBudget(n: number): void { hdBudget = n; }
/**
 * Bone lengths for a figure about 120 units tall (1 unit = 1 px at k=1). Ratios follow common adult
 * anthropometry: head about 1/7.5 of height, hip joint at about half height, legs about half of height,
 * upper arm and forearm about 0.19H and 0.15H, shoulders about 0.82H.
 */
export const BONES = { HIP: 61, TORSO: 37, NECK: 14, UP: 22, FORE: 17.5, TH: 30, SH: 31 };
/** Head radius at k=1: 16 units tall, so the head is about a seventh of the figure. */
export const HEAD_R = 8;
/** The face art (eyes, brows, mouth, hair, hats) was drawn for a 10.5 head; drawHead gets k * HEAD_SCALE. */
const HEAD_DESIGN = 10.5;
export const HEAD_SCALE = HEAD_R / HEAD_DESIGN;

/**
 * Inverse kinematics for one arm: aim the hand at a point (tx, ty) in figure space (before solve's screen transform,
 * y down, shoulder at the origin of the arm). Two-bone law of cosines; the elbow bends so the hand reaches out in front.
 * Writes armL/foreL (side 0) or armR/foreR (side 1) into `a`. Targets beyond reach are clamped to a straight arm.
 */
export function reachArm(a: Angles, side: 0 | 1, shx: number, shy: number, tx: number, ty: number): void {
  const { UP, FORE } = BONES;
  const dx = tx - shx, dy = ty - shy;
  const d = Math.min(Math.max(Math.hypot(dx, dy), 1e-3), UP + FORE - 1e-3);
  const base = Math.atan2(dx, dy);                       // direction from shoulder to target, same convention as solve
  const alpha = Math.acos(Math.min(1, Math.max(-1, (UP * UP + d * d - FORE * FORE) / (2 * UP * d))));
  const a1 = base - alpha;                               // upper arm: elbow bends forward (toward the target side)
  const ex = shx + Math.sin(a1) * UP, ey = shy + Math.cos(a1) * UP;
  const a12 = Math.atan2(tx - ex, ty - ey);              // forearm direction from elbow to target
  const a2 = a12 - a1;
  if (side === 0) { a.armL = a1 - a.lean; a.foreL = a2; } else { a.armR = a1 - a.lean; a.foreR = a2; }
}

export function solve(a: Angles, sx: number, sy: number, k: number, dir: number): void {
  const { HIP: T, TORSO, NECK, UP, FORE, TH, SH } = BONES;
  let hx = a.hipX, hy = -T + a.bob;
  if (a.lying > 0) hy = -6;
  const lean = a.lean + a.lying * 1.45;
  const nx = hx + Math.sin(lean) * TORSO, ny = hy - Math.cos(lean) * TORSO;
  const shx = hx + Math.sin(lean) * TORSO * 0.93, shy = hy - Math.cos(lean) * TORSO * 0.93;
  const headA = lean + a.tilt;
  const headx = nx + Math.sin(headA) * NECK, heady = ny - Math.cos(headA) * NECK;
  const limb = (ox: number, oy: number, a1: number, a2: number, l1: number, l2: number, i: number) => {
    const ex = ox + Math.sin(a1) * l1, ey = oy + Math.cos(a1) * l1;
    J[i] = ex; J[i + 1] = ey;
    J[i + 2] = ex + Math.sin(a1 + a2) * l2; J[i + 3] = ey + Math.cos(a1 + a2) * l2;
  };
  J[0] = hx; J[1] = hy; J[2] = nx; J[3] = ny; J[4] = headx; J[5] = heady; J[6] = shx; J[7] = shy;
  // arms hang from the shoulder: angle 0 = down, PI = straight up, positive = forward
  limb(shx, shy, a.armL + lean, a.foreL, UP, FORE, 8);
  limb(shx, shy, a.armR + lean, a.foreR, UP, FORE, 12);
  // legs: knees bend backwards
  limb(hx, hy, a.thighL - a.lying * 1.5, -a.bendL, TH, SH, 16);
  limb(hx, hy, a.thighR - a.lying * 1.5, -a.bendR, TH, SH, 20);
  for (let i = 0; i < 24; i += 2) { J[i] = sx + J[i] * k * dir; J[i + 1] = sy + J[i + 1] * k; }
}

export interface ItemDraw { (g: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, angle: number): void }

/** Full-detail figure (principal, mid, player). */
export function drawFigure(g: CanvasRenderingContext2D, c: Character, _sx: number, _sy: number, k: number, dir: number, t: number, flash: number, alpha: number, hdOverride?: boolean): void {
  const L = c.look, girl = L.kind === "girl";
  const lw = Math.max(1.1, 3.2 * k * (L.build ?? 1));
  g.globalAlpha = alpha;
  g.lineCap = "round"; g.lineJoin = "round";
  const col = flash > 0 ? "#ffffff" : L.color;
  // HD pass when you're close: soft neon glow, a crisp ink outline under every limb, then the line
  // very close people always get the HD face, whatever the quality budget says
  const hd = hdOverride ?? (k >= 1.05 && (hdBudget-- > 0 || k >= 1.6));
  if (isResident(c)) {   // the everyday local: egg belly, long neck, big nose (see Residents.ts)
    drawResident(g, J, c, k, dir, alpha, hd, flash > 0, lw);
    if (c.phys === Phys.DOWN) stars(g, J[4], J[5] - 18 * k, k, t);
    return;
  }
  const M = modelOf(c);
  if (M) {
    // chunky street model: filled body over the solved skeleton, skin-tone head with thick ink outline
    drawModelBody(g, J, c, M, k, dir, alpha, hd, flash > 0);
    const ML = modelLook(L, M);
    drawHead(g, ML, J[4], J[5], k * HEAD_SCALE, dir, Math.max(1.4, lw * 1.05), MODEL_INK, alpha, M.hat, flash > 0 ? "#ffffff" : M.skin, hd);
    drawModelHeadGear(g, M, J[4], J[5], k * HEAD_SCALE, dir, hd);
    if (c.phys === Phys.DOWN) stars(g, J[4], J[5] - 14 * k, k, t);
    return;
  }
  const skel = () => {
    g.beginPath();
    g.moveTo(J[0], J[1]); g.lineTo(J[16], J[17]); g.lineTo(J[18], J[19]);
    g.moveTo(J[0], J[1]); g.lineTo(J[20], J[21]); g.lineTo(J[22], J[23]);
    g.moveTo(J[0], J[1]); g.lineTo(J[2], J[3]); g.lineTo(J[4], J[5]);
    g.moveTo(J[6], J[7]); g.lineTo(J[8], J[9]); g.lineTo(J[10], J[11]);
    g.moveTo(J[6], J[7]); g.lineTo(J[12], J[13]); g.lineTo(J[14], J[15]);
  };
  if (hd) {
    g.strokeStyle = col; g.globalAlpha = alpha * 0.13; g.lineWidth = lw * 3.4; skel(); g.stroke();
    g.globalAlpha = alpha; g.strokeStyle = "rgba(10,8,12,.85)"; g.lineWidth = lw + 2.4 * k; skel(); g.stroke();
  }
  g.strokeStyle = col; g.lineWidth = lw;
  // legs
  g.beginPath();
  g.moveTo(J[0], J[1]); g.lineTo(J[16], J[17]); g.lineTo(J[18], J[19]);
  g.moveTo(J[0], J[1]); g.lineTo(J[20], J[21]); g.lineTo(J[22], J[23]);
  // torso
  g.moveTo(J[0], J[1]); g.lineTo(J[2], J[3]);
  // arms
  g.moveTo(J[6], J[7]); g.lineTo(J[8], J[9]); g.lineTo(J[10], J[11]);
  g.moveTo(J[6], J[7]); g.lineTo(J[12], J[13]); g.lineTo(J[14], J[15]);
  g.stroke();
  if (hd) {
    // rim light along the top-left edge of every limb
    g.save(); g.translate(-0.55 * k, -0.7 * k); g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = Math.max(0.6, lw * 0.32); skel(); g.stroke(); g.restore();
    // shirt panel between shoulders and hips, tinted with their accent
    const ux = J[6] - J[0], uy = J[7] - J[1], len = Math.hypot(ux, uy) || 1, px = (-uy / len) * 5.5 * k, py = (ux / len) * 5.5 * k;
    g.fillStyle = L.accent; g.globalAlpha = alpha * 0.32;
    g.beginPath(); g.moveTo(J[0] + px * 0.8, J[1] + py * 0.8); g.lineTo(J[6] + px, J[7] + py); g.lineTo(J[6] - px, J[7] - py); g.lineTo(J[0] - px * 0.8, J[1] - py * 0.8); g.closePath(); g.fill();
    g.globalAlpha = alpha;
    // joints (shoulder, elbows, hip, knees) and mitten hands
    g.fillStyle = col;
    for (const i of [6, 8, 12, 0, 16, 20]) { g.beginPath(); g.arc(J[i], J[i + 1], lw * 0.62, 0, 6.283); g.fill(); }
    g.strokeStyle = "rgba(10,8,12,.85)"; g.lineWidth = 1.2 * k;
    for (const i of [10, 14]) { g.beginPath(); g.arc(J[i], J[i + 1], lw * 0.95, 0, 6.283); g.fill(); g.stroke(); }
  }
  // boots in accent
  g.strokeStyle = L.accent; g.lineWidth = lw * (girl ? 1.6 : 1.9);
  g.beginPath();
  g.moveTo(J[18] - 2 * k * dir, J[19]); g.lineTo(J[18] + 5 * k * dir, J[19]);
  g.moveTo(J[22] - 2 * k * dir, J[23]); g.lineTo(J[22] + 5 * k * dir, J[23]);
  g.stroke();
  // outfit
  const hx = J[0], hy = J[1], nx = J[2], ny = J[3];
  if (girl) {
    g.fillStyle = L.accent; g.globalAlpha = alpha * 0.9;
    g.beginPath(); // skirt
    const ux = (nx - hx) * 0.22, uy = (ny - hy) * 0.22;
    g.moveTo(hx + ux - 7 * k, hy + uy); g.lineTo(hx + ux + 7 * k, hy + uy); g.lineTo(hx + 10 * k, hy + 11 * k); g.lineTo(hx - 10 * k, hy + 11 * k); g.closePath(); g.fill();
    g.beginPath(); // top
    const tx = hx + (nx - hx) * 0.7, ty = hy + (ny - hy) * 0.7;
    g.rect(tx - 6.5 * k, ty - 4 * k, 13 * k, 8 * k); g.fill();
    g.globalAlpha = alpha;
  } else {
    g.strokeStyle = col; g.lineWidth = lw * 0.75;
    g.beginPath();
    const ax = hx + (nx - hx) * 0.15, ay = hy + (ny - hy) * 0.15, bx = hx + (nx - hx) * 0.8, by = hy + (ny - hy) * 0.8;
    g.moveTo(ax - 8 * k, ay); g.lineTo(bx - 7.5 * k, by); g.lineTo(bx + 7.5 * k, by); g.lineTo(ax + 8 * k, ay);
    g.stroke();
    if (L.main) { g.strokeStyle = "#f6b62c"; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(bx - 4 * k, by); g.quadraticCurveTo(bx, by + 8 * k, bx + 4 * k, by); g.stroke(); }
  }
  const D = dressOf(c);
  if (D) drawDress(g, D, L, k, dir, lw, alpha);
  drawHead(g, L, J[4], J[5], k * HEAD_SCALE, dir, lw, col, alpha, D ? D.hat : L.hat);
  if (c.phys === Phys.DOWN) stars(g, J[4], J[5] - 14 * k, k, t);
}

/** Outer layers by climate (see src/mind/Dress.ts): coats, bare legs in shorts, gumboots, scarf, umbrella. */
const OUTER: Partial<Record<Dress["top"], string>> = { raincoat: "#f6c21c", puffer: "", jacket: "#2b2f3a", hivis: "#f08a1c", wetsuit: "#15181c", suit: "#10131a", uniform: "#1c3a6b", knit: "", apron: "#e8e0cf", robe: "#7b3f9e" };
function drawDress(g: CanvasRenderingContext2D, D: Dress, L: Character["look"], k: number, dir: number, lw: number, alpha: number): void {
  const col = D.tint ?? OUTER[D.top] ?? "";
  const outer = col || L.accent;
  if (D.legs === "shorts") { // bare lower legs (skin) from knee to ankle
    g.strokeStyle = "#e9c7a0"; g.lineWidth = lw * 0.85; g.globalAlpha = alpha;
    g.beginPath(); g.moveTo(J[16], J[17]); g.lineTo(J[18], J[19]); g.moveTo(J[20], J[21]); g.lineTo(J[22], J[23]); g.stroke();
  }
  if (D.feet === "gumboots") {
    g.strokeStyle = "#2f7d3a"; g.lineWidth = lw * 1.5;
    g.beginPath(); g.moveTo(J[16] + (J[18] - J[16]) * 0.35, J[17] + (J[19] - J[17]) * 0.35); g.lineTo(J[18], J[19]); g.moveTo(J[20] + (J[22] - J[20]) * 0.35, J[21] + (J[23] - J[21]) * 0.35); g.lineTo(J[22], J[23]); g.stroke();
  }
  if (D.top !== "tee" && D.top !== "shirt") {
    const fat = D.top === "puffer" ? 6.5 : D.top === "wetsuit" || D.top === "suit" ? 3.2 : 5;
    const ux = J[6] - J[0], uy = J[7] - J[1], len = Math.hypot(ux, uy) || 1, px = (-uy / len) * fat * k, py = (ux / len) * fat * k;
    g.fillStyle = outer; g.globalAlpha = alpha * (D.top === "knit" ? 0.5 : 0.8);
    g.beginPath(); g.moveTo(J[0] + px * 0.9, J[1] + py * 0.9); g.lineTo(J[6] + px, J[7] + py); g.lineTo(J[6] - px, J[7] - py); g.lineTo(J[0] - px * 0.9, J[1] - py * 0.9); g.closePath(); g.fill();
    if (D.top !== "apron" && D.top !== "robe") { // sleeves
      g.strokeStyle = outer; g.lineWidth = lw * (D.top === "puffer" ? 1.5 : 1.15); g.globalAlpha = alpha * 0.85;
      g.beginPath(); g.moveTo(J[6], J[7]); g.lineTo(J[8], J[9]); g.moveTo(J[6], J[7]); g.lineTo(J[12], J[13]); g.stroke();
    }
    if (D.top === "hivis") { g.strokeStyle = "#e8f2f0"; g.lineWidth = Math.max(0.8, lw * 0.35); g.globalAlpha = alpha * 0.9; g.beginPath(); g.moveTo(J[0] + px, J[1] + py); g.lineTo(J[0] - px, J[1] - py); g.stroke(); }
  }
  if (D.scarf) { g.strokeStyle = L.accent; g.lineWidth = lw * 1.3; g.globalAlpha = alpha; g.beginPath(); g.moveTo(J[2] - 3 * k, J[3]); g.lineTo(J[2] + 3 * k, J[3]); g.stroke(); }
  if (D.umbrella) {
    g.globalAlpha = alpha * 0.9; g.fillStyle = "#3a3f58"; g.strokeStyle = "#cfd4e8"; g.lineWidth = Math.max(0.8, lw * 0.4);
    const ux = J[4] + 2 * k * dir, uy = J[5] - 15 * k;
    g.beginPath(); g.ellipse(ux, uy, 13 * k, 7 * k, 0, Math.PI, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(ux, uy); g.lineTo(J[10], J[11]); g.stroke();
  }
  g.globalAlpha = alpha;
}

/** k here is the head scale (figure scale × HEAD_SCALE): every feature below is drawn for a 10.5 head. */
function drawHead(g: CanvasRenderingContext2D, L: Character["look"], x: number, y: number, k: number, dir: number, lw: number, col: string, alpha: number, hat: Character["look"]["hat"] = L.hat, skin?: string, inkRing = false): void {
  const F: Face = L.face ?? { eyes: "shades", brows: "none", mouth: L.kind === "girl" ? "smile" : "smile", nose: "none", facial: "none", extra: "none", head: "round" } as const;
  const r = HEAD_DESIGN * k;
  // real heads are a little narrower than tall; "wide" and "oval" push the proportions either way
  const rx = F.head === "wide" ? r * 1.05 : r * 0.9, ry = F.head === "oval" ? r * 1.12 : r;
  g.lineCap = "round";
  // ---- hair behind the head
  const H = L.hair;
  g.strokeStyle = col; g.fillStyle = L.color;
  if (H === "big" || H === "afro") { g.globalAlpha = alpha * (H === "afro" ? 0.45 : 0.25); g.beginPath(); g.ellipse(x - 2 * k * dir, y - (H === "afro" ? 3 : -1) * k, rx * (H === "afro" ? 1.5 : 1.55), ry * (H === "afro" ? 1.45 : 1.45), 0, 0, 6.283); g.fill(); g.globalAlpha = alpha; g.lineWidth = lw * 0.8; g.stroke(); }
  if (H === "long" || H === "braids") { g.lineWidth = lw * (H === "braids" ? 1.1 : 1.4); g.beginPath(); g.moveTo(x - rx * 0.9, y - ry * 0.2); g.lineTo(x - rx * 1.05, y + ry * 1.5); g.moveTo(x + rx * 0.9, y - ry * 0.2); g.lineTo(x + rx * 1.05, y + ry * 1.5); g.stroke(); if (H === "braids") { for (const sx of [-1.05, 1.05]) { g.beginPath(); g.arc(x + rx * sx, y + ry * 1.6, 1.6 * k + 0.5, 0, 6.283); g.fill(); } } }
  if (H === "pony") { g.lineWidth = lw; g.beginPath(); g.moveTo(x - rx * 0.7 * dir, y - ry * 0.5); g.quadraticCurveTo(x - rx * 1.9 * dir, y - ry * 0.2, x - rx * 1.6 * dir, y + ry * 1.4); g.stroke(); }
  if (H === "pigtails") { g.globalAlpha = alpha * 0.5; for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + rx * 1.25 * sx, y - ry * 0.1, r * 0.45, 0, 6.283); g.fill(); } g.globalAlpha = alpha; }
  // ---- head
  g.fillStyle = skin ?? "#0e0b0a"; g.strokeStyle = col; g.lineWidth = lw;
  if (inkRing) { g.lineWidth = lw + 1.1 * k; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.stroke(); g.lineWidth = lw; }
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); g.stroke();
  if (skin && inkRing) { g.fillStyle = "rgba(0,0,0,.16)"; g.beginPath(); g.ellipse(x, y, rx * 0.98, ry * 0.98, 0, -0.6, 1.9); g.lineTo(x, y); g.fill(); g.fillStyle = skin; }
  // ---- hair on top
  g.fillStyle = L.color; g.strokeStyle = col;
  if (H === "bun" || H === "topknot") { g.globalAlpha = alpha * 0.35; g.beginPath(); g.arc(x - 1 * k * dir, y - ry * (H === "topknot" ? 1.3 : 1.45), r * (H === "topknot" ? 0.4 : 0.6), 0, 6.283); g.fill(); g.globalAlpha = alpha; g.lineWidth = lw * 0.8; g.stroke(); }
  if (H === "mohawk") { g.lineWidth = lw * 0.9; g.beginPath(); for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.22; g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry); g.lineTo(x + Math.cos(a) * rx * 1.55, y + Math.sin(a) * ry * 1.55); } g.stroke(); }
  if (H === "spiky") { g.lineWidth = lw * 0.8; g.beginPath(); for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.32; g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry); g.lineTo(x + Math.cos(a) * rx * 1.4, y + Math.sin(a) * ry * 1.4); } g.stroke(); }
  if (H === "curly") { g.lineWidth = lw * 0.7; for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.36; g.beginPath(); g.arc(x + Math.cos(a) * rx * 1.08, y + Math.sin(a) * ry * 1.08, 2 * k + 0.4, 0, 6.283); g.stroke(); } }
  if (H === "buzz" || H === "sidepart" || H === "bob") {
    g.globalAlpha = alpha * (H === "buzz" ? 0.45 : 0.8);
    g.beginPath(); g.ellipse(x, y, rx * 1.04, ry * 1.04, 0, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (H === "sidepart") { g.beginPath(); g.moveTo(x - rx * dir, y - ry * 0.3); g.quadraticCurveTo(x, y - ry * 1.4, x + rx * 1.05 * dir, y - ry * 0.1); g.lineTo(x + rx * 0.6 * dir, y - ry * 0.9); g.fill(); }
    if (H === "bob") { g.beginPath(); g.moveTo(x - rx * 1.05, y - ry * 0.4); g.lineTo(x - rx * 1.1, y + ry * 0.8); g.moveTo(x + rx * 1.05, y - ry * 0.4); g.lineTo(x + rx * 1.1, y + ry * 0.8); g.lineWidth = lw * 1.8; g.strokeStyle = L.color; g.stroke(); g.strokeStyle = col; }
    g.globalAlpha = alpha;
  }
  // ---- hats
  if (hat !== "none") {
    g.fillStyle = L.accent; g.strokeStyle = L.accent;
    const capDome = (ext = 1.02) => { g.beginPath(); g.ellipse(x, y - 1 * k, rx * ext, ry * ext, 0, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); };
    g.lineWidth = lw * 0.9;
    switch (hat) {
      case "bandana": capDome(); g.beginPath(); g.moveTo(x - rx * 0.95 * dir, y - 3 * k); g.lineTo(x - rx * 1.6 * dir, y - 6 * k); g.moveTo(x - rx * 0.95 * dir, y - 3 * k); g.lineTo(x - rx * 1.6 * dir, y); g.stroke(); break;
      case "cap": capDome(); g.lineWidth = lw * 1.1; g.beginPath(); g.moveTo(x + rx * 0.6 * dir, y - 4 * k); g.lineTo(x + rx * 1.75 * dir, y - 4 * k); g.stroke(); break;
      case "snapback": capDome(); g.lineWidth = lw * 1.1; g.beginPath(); g.moveTo(x - rx * 0.6 * dir, y - 4 * k); g.lineTo(x - rx * 1.6 * dir, y - 5 * k); g.stroke(); break;
      case "police": { g.fillStyle = "#1c2836"; capDome(1.06); g.fillStyle = "#1c2836"; g.fillRect(x - rx * 1.15, y - 4.5 * k, rx * 2.3, 2.4 * k); g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(x + 1 * k * dir, y - 7 * k, 1.6 * k, 0, 6.283); g.fill(); g.strokeStyle = "#0e0b0a"; g.beginPath(); g.moveTo(x + rx * 0.4 * dir, y - 3 * k); g.lineTo(x + rx * 1.4 * dir, y - 2 * k); g.stroke(); break; }
      case "beanie": capDome(1.08); g.beginPath(); g.arc(x, y - ry * 1.15, r * 0.25, 0, 6.283); g.fill(); break;
      case "bucket": capDome(1.05); g.beginPath(); g.ellipse(x, y - 3.5 * k, rx * 1.5, 2.6 * k, 0, 0, 6.283); g.fill(); break;
      case "beret": g.beginPath(); g.ellipse(x - 2 * k * dir, y - ry * 0.85, rx * 1.15, ry * 0.5, -0.2 * dir, 0, 6.283); g.fill(); break;
      case "cowboy": g.beginPath(); g.ellipse(x, y - 4 * k, rx * 1.75, 2.8 * k, 0, 0, 6.283); g.fill(); g.fillRect(x - rx * 0.75, y - ry * 1.5, rx * 1.5, ry * 0.9); break;
      case "helmet": g.beginPath(); g.ellipse(x, y - 0.5 * k, rx * 1.12, ry * 1.12, 0, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fill(); break;
      case "hood": g.lineWidth = lw * 1.6; g.beginPath(); g.ellipse(x, y + 0.5 * k, rx * 1.3, ry * 1.3, 0, Math.PI * 0.85, Math.PI * 2.15); g.stroke(); break;
      case "headphones": g.strokeStyle = "#0e0b0a"; g.lineWidth = lw * 0.9; g.beginPath(); g.arc(x, y, rx * 1.15, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = L.accent; g.fillRect(x - rx * 1.3, y - 2 * k, 3.5 * k, 6 * k); g.fillRect(x + rx * 1.3 - 3.5 * k, y - 2 * k, 3.5 * k, 6 * k); break;
    }
  }
  // ---- face (shifted slightly toward where they look)
  const fx = x + 2.2 * k * dir, ey = y - 1 * k;
  g.strokeStyle = col; g.fillStyle = "#0e0b0a"; g.lineWidth = Math.max(0.8, lw * 0.5);
  if (F.shape) drawEyeShape(g, F.shape, fx, ey, k, dir, skin ?? "#0e0b0a", col, alpha, lw);
  else switch (F.eyes) {
    case "shades": g.beginPath(); g.rect(fx - 9.5 * k, ey - 1.5 * k, 8.5 * k, 4.5 * k); g.rect(fx + 0.8 * k, ey - 1.5 * k, 8.5 * k, 4.5 * k); g.fill(); g.stroke(); break;
    case "aviator": g.beginPath(); g.ellipse(fx - 4.8 * k, ey + 1 * k, 4 * k, 3 * k, 0, 0, 6.283); g.ellipse(fx + 4.8 * k, ey + 1 * k, 4 * k, 3 * k, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "round": g.beginPath(); g.arc(fx - 4.5 * k, ey + 0.5 * k, 3.2 * k, 0, 6.283); g.moveTo(fx + 7.7 * k, ey + 0.5 * k); g.arc(fx + 4.5 * k, ey + 0.5 * k, 3.2 * k, 0, 6.283); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(fx - 4.2 * k, ey + 0.5 * k, 1 * k, 0, 6.283); g.arc(fx + 4.8 * k, ey + 0.5 * k, 1 * k, 0, 6.283); g.fill(); break;
    case "visor": g.fillStyle = L.accent; g.globalAlpha = alpha * 0.85; g.fillRect(fx - 9.5 * k, ey - 1 * k, 19 * k, 3.6 * k); g.globalAlpha = alpha; break;
    case "shutter": g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(fx - 9 * k, ey - 1 * k + i * 1.3 * k); g.lineTo(fx + 9 * k, ey - 1 * k + i * 1.3 * k); } g.stroke(); break;
    case "cateye": g.fillStyle = col; g.beginPath(); g.moveTo(fx - 8 * k, ey + 1 * k); g.lineTo(fx - 2 * k, ey - 0.5 * k); g.lineTo(fx - 3 * k, ey + 2.5 * k); g.closePath(); g.moveTo(fx + 8 * k, ey + 1 * k); g.lineTo(fx + 2 * k, ey - 0.5 * k); g.lineTo(fx + 3 * k, ey + 2.5 * k); g.closePath(); g.fill(); break;
    case "happy": g.beginPath(); g.arc(fx - 4 * k, ey + 1.5 * k, 2 * k, Math.PI * 1.1, Math.PI * 1.9); g.moveTo(fx + 6 * k, ey + 1 * k); g.arc(fx + 4 * k, ey + 1.5 * k, 2 * k, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); break;
    case "sleepy": g.beginPath(); g.moveTo(fx - 6 * k, ey + 1 * k); g.lineTo(fx - 2 * k, ey + 1 * k); g.moveTo(fx + 2 * k, ey + 1 * k); g.lineTo(fx + 6 * k, ey + 1 * k); g.stroke(); break;
    case "wink": g.fillStyle = col; g.beginPath(); g.arc(fx - 4 * k, ey + 0.8 * k, 1.3 * k, 0, 6.283); g.fill(); g.beginPath(); g.moveTo(fx + 2 * k, ey + 1 * k); g.lineTo(fx + 6 * k, ey + 0.4 * k); g.stroke(); break;
    case "wide": g.fillStyle = col; g.beginPath(); g.arc(fx - 4 * k, ey + 0.8 * k, 2.2 * k, 0, 6.283); g.arc(fx + 4 * k, ey + 0.8 * k, 2.2 * k, 0, 6.283); g.fill(); g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(fx - 3.6 * k, ey + 0.8 * k, 0.9 * k, 0, 6.283); g.arc(fx + 4.4 * k, ey + 0.8 * k, 0.9 * k, 0, 6.283); g.fill(); break;
    default: g.fillStyle = col; g.beginPath(); g.arc(fx - 4 * k, ey + 0.8 * k, 1.3 * k, 0, 6.283); g.arc(fx + 4 * k, ey + 0.8 * k, 1.3 * k, 0, 6.283); g.fill();
  }
  g.beginPath();
  switch (F.brows) {
    case "straight": g.moveTo(fx - 7 * k, ey - 3.5 * k); g.lineTo(fx - 2 * k, ey - 3.5 * k); g.moveTo(fx + 2 * k, ey - 3.5 * k); g.lineTo(fx + 7 * k, ey - 3.5 * k); break;
    case "angry": g.moveTo(fx - 7 * k, ey - 4.5 * k); g.lineTo(fx - 2 * k, ey - 2.8 * k); g.moveTo(fx + 2 * k, ey - 2.8 * k); g.lineTo(fx + 7 * k, ey - 4.5 * k); break;
    case "worried": g.moveTo(fx - 7 * k, ey - 2.8 * k); g.lineTo(fx - 2 * k, ey - 4.5 * k); g.moveTo(fx + 2 * k, ey - 4.5 * k); g.lineTo(fx + 7 * k, ey - 2.8 * k); break;
    case "raised": g.moveTo(fx - 7 * k, ey - 4 * k); g.quadraticCurveTo(fx - 4.5 * k, ey - 6 * k, fx - 2 * k, ey - 4 * k); g.moveTo(fx + 2 * k, ey - 4 * k); g.quadraticCurveTo(fx + 4.5 * k, ey - 6 * k, fx + 7 * k, ey - 4 * k); break;
    case "thick": g.lineWidth = lw * 0.9; g.moveTo(fx - 7 * k, ey - 3.8 * k); g.lineTo(fx - 2 * k, ey - 3.6 * k); g.moveTo(fx + 2 * k, ey - 3.6 * k); g.lineTo(fx + 7 * k, ey - 3.8 * k); break;
  }
  g.stroke(); g.lineWidth = Math.max(0.8, lw * 0.5);
  if (F.nose !== "none") { g.beginPath(); if (F.nose === "dot") g.arc(fx, y + 3 * k, 0.8 * k, 0, 6.283); else if (F.nose === "line") { g.moveTo(fx + 0.5 * k * dir, y + 1 * k); g.lineTo(fx + 1.5 * k * dir, y + 4 * k); g.lineTo(fx, y + 4 * k); } else { g.moveTo(fx, y + 0.5 * k); g.quadraticCurveTo(fx + 3 * k * dir, y + 3 * k, fx, y + 4.5 * k); } g.stroke(); }
  const my = y + 6.8 * k;
  g.beginPath();
  switch (F.mouth) {
    case "grin": g.moveTo(fx - 4.5 * k, my - 0.8 * k); g.quadraticCurveTo(fx, my + 3.5 * k, fx + 4.5 * k, my - 0.8 * k); break;
    case "flat": g.moveTo(fx - 3 * k, my + 0.5 * k); g.lineTo(fx + 3 * k, my + 0.5 * k); break;
    case "o": g.arc(fx, my + 0.6 * k, 1.6 * k, 0, 6.283); break;
    case "smirk": g.moveTo(fx - 3 * k, my + 0.6 * k); g.quadraticCurveTo(fx + 1 * k, my + 1.4 * k, fx + 4 * k, my - 1 * k); break;
    case "frown": g.moveTo(fx - 3.5 * k, my + 1.5 * k); g.quadraticCurveTo(fx, my - 1 * k, fx + 3.5 * k, my + 1.5 * k); break;
    case "teeth": g.rect(fx - 3.5 * k, my - 0.5 * k, 7 * k, 2.6 * k); g.moveTo(fx, my - 0.5 * k); g.lineTo(fx, my + 2.1 * k); break;
    case "tongue": g.moveTo(fx - 3.5 * k, my); g.quadraticCurveTo(fx, my + 2.5 * k, fx + 3.5 * k, my); break;
    default: g.moveTo(fx - 3.5 * k, my); g.quadraticCurveTo(fx, my + 2 * k, fx + 3.5 * k, my);
  }
  g.stroke();
  if (F.mouth === "tongue") { g.fillStyle = "#ff7ad9"; g.beginPath(); g.arc(fx + 0.5 * k, my + 2 * k, 1.4 * k, 0, Math.PI); g.fill(); }
  // facial hair & extras
  g.strokeStyle = col;
  switch (F.facial) {
    case "mustache": g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(fx - 4 * k, my - 1.5 * k); g.quadraticCurveTo(fx, my - 3 * k, fx + 4 * k, my - 1.5 * k); g.stroke(); break;
    case "goatee": g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(fx, my + 2.5 * k); g.lineTo(fx, my + 5 * k); g.stroke(); break;
    case "soulpatch": g.fillStyle = col; g.fillRect(fx - 0.8 * k, my + 2 * k, 1.6 * k, 1.8 * k); break;
    case "beard": g.lineWidth = lw * 0.6; g.beginPath(); g.ellipse(x, y + 2 * k, rx * 0.98, ry * 0.9, 0, 0.15, Math.PI - 0.15); g.stroke(); break;
    case "stubble": g.fillStyle = col; g.globalAlpha = alpha * 0.6; for (let i = 0; i < 7; i++) g.fillRect(fx - 5 * k + i * 1.6 * k, my + 2.4 * k + (i % 2) * k, 0.7 * k, 0.7 * k); g.globalAlpha = alpha; break;
  }
  switch (F.extra) {
    case "freckles": g.fillStyle = col; g.globalAlpha = alpha * 0.7; for (const [ox, oy] of [[-6, 3], [-4.5, 4], [4.5, 4], [6, 3]]) g.fillRect(fx + ox * k, y + oy * k, 0.8 * k, 0.8 * k); g.globalAlpha = alpha; break;
    case "earrings": g.strokeStyle = "#f6b62c"; g.beginPath(); g.arc(x - rx * 1.02, y + 5 * k, 1.8 * k, 0, 6.283); g.arc(x + rx * 1.02, y + 5 * k, 1.8 * k, 0, 6.283); g.stroke(); break;
    case "nosering": g.strokeStyle = "#f6b62c"; g.beginPath(); g.arc(fx + 1 * k * dir, y + 4.5 * k, 1.1 * k, 0, Math.PI); g.stroke(); break;
    case "blush": g.fillStyle = "#ff7ad9"; g.globalAlpha = alpha * 0.45; g.beginPath(); g.ellipse(fx - 6 * k, y + 4 * k, 2 * k, 1.2 * k, 0, 0, 6.283); g.ellipse(fx + 6 * k, y + 4 * k, 2 * k, 1.2 * k, 0, 0, 6.283); g.fill(); g.globalAlpha = alpha; break;
    case "tattoo": g.strokeStyle = "#3dd6ff"; g.beginPath(); g.moveTo(fx - 7 * k, y + 1 * k); g.lineTo(fx - 6 * k, y + 4 * k); g.lineTo(fx - 7.5 * k, y + 6 * k); g.stroke(); break;
    case "scar": g.strokeStyle = "#ec2a1c"; g.beginPath(); g.moveTo(fx + 3 * k, ey - 4 * k); g.lineTo(fx + 6 * k, ey + 3 * k); g.stroke(); break;
    case "mole": g.fillStyle = col; g.beginPath(); g.arc(fx + 5 * k * dir, my - 1 * k, 0.8 * k, 0, 6.283); g.fill(); break;
  }
  if (F.gene !== undefined) drawFaceGenes(g, F.gene, { x, y, k, dir, lw, col, alpha, fx, ey, my, rx, ry, covered: F.eyes === "shades" || F.eyes === "visor" || F.eyes === "aviator" || F.eyes === "shutter" });
  if (L.glam) { g.strokeStyle = "#f6b62c"; g.beginPath(); g.arc(x - rx * 1.05, y + 6 * k, 2.4 * k, 0, 6.283); g.arc(x + rx * 1.05, y + 6 * k, 2.4 * k, 0, 6.283); g.stroke(); }
}

/**
 * A unique eye from its parameters (see EyeShape). Two eyes at fx ± 4.6k, the same spacing as the
 * other styles. `base` is the head colour, used to drop a heavy lid over the eye.
 */
function drawEyeShape(g: CanvasRenderingContext2D, s: EyeShape, fx: number, ey: number, k: number, dir: number, base: string, col: string, alpha: number, lw: number): void {
  const SCLERA = "#f6f1e6", INK = "#0e0b0a";
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = Math.max(0.8, lw * 0.5);
  for (const side of [-1, 1]) {
    const ex = fx + side * 4.6 * k, hw = 2.3 * k * s.w * 1.35, hh = 2.0 * k * s.h * 1.35; // 1.35: bigger eyes read at street size
    const pr = Math.max(0.9 * k, hh * 0.42), px = ex + s.pupil * hw * 0.35 * dir;
    const dot = (x: number, y: number, rr: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); };
    const outer = ex + side * hw, outerY = ey - s.tilt * hw, innerX = ex - side * hw, innerY = ey + s.tilt * hw * 0.3;
    switch (s.kind) {
      case "oval": case "heavy": {
        g.fillStyle = SCLERA; g.beginPath(); g.ellipse(ex, ey, hw, hh, s.tilt * side, 0, 6.283); g.fill(); g.stroke();
        dot(px, ey + hh * 0.15, pr, INK);
        if (s.kind === "heavy") { // the lid drops over the top of the eye, painted in the head colour
          const lidY = ey - hh + s.lid * 2 * hh;
          g.save(); g.beginPath(); g.ellipse(ex, ey, hw, hh, s.tilt * side, 0, 6.283); g.clip();
          g.fillStyle = base; g.fillRect(ex - hw * 2, ey - hh * 2, hw * 4, lidY - (ey - hh * 2)); g.restore();
          g.strokeStyle = INK; g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(ex - hw * 1.05, lidY); g.lineTo(ex + hw * 1.05, lidY); g.stroke(); g.strokeStyle = col;
        }
        break;
      }
      case "almond": {
        g.fillStyle = SCLERA; g.beginPath(); g.moveTo(innerX, innerY);
        g.quadraticCurveTo(ex, ey - 2.1 * hh, outer, outerY); g.quadraticCurveTo(ex, ey + 1.3 * hh, innerX, innerY); g.closePath(); g.fill(); g.stroke();
        dot(px, ey + hh * 0.1, pr, INK);
        break;
      }
      case "slit": { // cat-like: narrow sclera, a slit of ink
        g.fillStyle = SCLERA; g.beginPath(); g.ellipse(ex, ey, hw * 0.5, hh * 1.25, 0, 0, 6.283); g.fill(); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.ellipse(px, ey, hw * 0.2, hh * 1.05, 0, 0, 6.283); g.fill();
        dot(ex - hw * 0.12, ey - hh * 0.5, Math.max(0.6, 0.6 * k), SCLERA);
        break;
      }
      case "ring": { // open ring with a dot pupil
        g.beginPath(); g.arc(ex, ey, hh * 0.85, 0, 6.283); g.stroke();
        dot(px, ey, pr * 0.8, INK);
        break;
      }
      case "closed": { // a shut, happy arc
        g.beginPath(); g.moveTo(ex - hw * 0.9, ey - hh * 0.2 - s.tilt * hw * side); g.quadraticCurveTo(ex, ey + hh * 1.3, ex + hw * 0.9, ey - hh * 0.2 + s.tilt * hw * side); g.stroke();
        break;
      }
      case "cross": { // knocked out: two crossed strokes
        const cx = hw * 0.75, cy = hh * 0.75;
        g.beginPath(); g.moveTo(ex - cx, ey - cy); g.lineTo(ex + cx, ey + cy); g.moveTo(ex + cx, ey - cy); g.lineTo(ex - cx, ey + cy); g.stroke();
        break;
      }
    }
    if (s.lash && (s.kind === "oval" || s.kind === "almond" || s.kind === "heavy")) { // a few lashes at the outer corner
      g.lineWidth = Math.max(0.8, lw * 0.45); g.beginPath();
      for (const t of [-0.25, 0, 0.25]) {
        g.moveTo(outer, outerY - hh * 0.1 + t * hh); g.lineTo(outer + side * 2.2 * k, outerY - hh * 0.7 + t * hh);
      }
      g.stroke(); g.lineWidth = Math.max(0.8, lw * 0.5);
    }
  }
  g.globalAlpha = alpha;
}

function stars(g: CanvasRenderingContext2D, x: number, y: number, k: number, t: number): void {
  g.fillStyle = "#f6b62c";
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.09;
    const px = x + Math.cos(a) * 12 * k, py = y + Math.sin(a) * 4 * k;
    g.beginPath(); g.arc(px, py, 2 * k + 0.6, 0, 6.283); g.fill();
  }
}

/** Cheap silhouette for background crowds: appended to an open path (caller strokes in batches). */
export function pathSilhouette(g: CanvasRenderingContext2D, k: number): void {
  g.moveTo(J[0], J[1]); g.lineTo(J[16], J[17]); g.lineTo(J[18], J[19]);
  g.moveTo(J[0], J[1]); g.lineTo(J[20], J[21]); g.lineTo(J[22], J[23]);
  g.moveTo(J[0], J[1]); g.lineTo(J[2], J[3]);
  g.moveTo(J[6], J[7]); g.lineTo(J[8], J[9]); g.lineTo(J[10], J[11]);
  g.moveTo(J[6], J[7]); g.lineTo(J[12], J[13]); g.lineTo(J[14], J[15]);
  const r = HEAD_R * k;
  g.moveTo(J[4] + r, J[5]); g.arc(J[4], J[5], r, 0, 6.283);
}

/** Hand positions after solve(). */
export const handR = () => [J[14], J[15]] as const;
export const handL = () => [J[10], J[11]] as const;
