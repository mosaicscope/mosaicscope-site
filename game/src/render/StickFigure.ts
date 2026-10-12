import type { Character } from "../entities/types";
import { Phys } from "../entities/types";

/**
 * Procedural stick figures in the style of the MosaicScope footer crew (same proportions as the
 * site's 100x140 SVG figure: round head, sunglasses, single-stroke limbs, neon colours).
 * A pose function produces joint angles; `solve` turns them into absolute screen points; draw
 * functions stroke them. No per-figure canvas transforms, so background figures can be batched.
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
    case "run": case "panic": {
      A.thighL = s * 0.85; A.thighR = -s * 0.85; A.bendL = Math.max(0, -c) * 1.3 + 0.2; A.bendR = Math.max(0, c) * 1.3 + 0.2;
      A.lean = 0.22; A.bob = -Math.abs(c) * 4;
      if (name === "panic") { A.armL = 2.7 + Math.sin(t * 14) * 0.4; A.armR = 2.7 + Math.cos(t * 13) * 0.4; A.foreL = 0.3; A.foreR = 0.3; A.lean = 0.05; }
      else { A.armL = -s * 0.9; A.armR = s * 0.9; A.foreL = 1.4; A.foreR = 1.4; }
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
export const HEAD_R = 10.5;

export function solve(a: Angles, sx: number, sy: number, k: number, dir: number): void {
  const T = 44, TORSO = 42, UP = 17, FORE = 14, TH = 22, SH = 21, NECK = 13;
  let hx = a.hipX, hy = -T + a.bob;
  if (a.lying > 0) hy = -6;
  const lean = a.lean + a.lying * 1.45;
  const nx = hx + Math.sin(lean) * TORSO, ny = hy - Math.cos(lean) * TORSO;
  const shx = hx + Math.sin(lean) * TORSO * 0.83, shy = hy - Math.cos(lean) * TORSO * 0.83;
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
export function drawFigure(g: CanvasRenderingContext2D, c: Character, _sx: number, _sy: number, k: number, dir: number, t: number, flash: number, alpha: number): void {
  const L = c.look, girl = L.kind === "girl";
  const lw = Math.max(1.1, 3.2 * k);
  g.globalAlpha = alpha;
  g.lineCap = "round"; g.lineJoin = "round";
  const col = flash > 0 ? "#ffffff" : L.color;
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
  drawHead(g, L, J[4], J[5], k, dir, lw, col, alpha);
  if (c.phys === Phys.DOWN) stars(g, J[4], J[5] - 14 * k, k, t);
}

function drawHead(g: CanvasRenderingContext2D, L: Character["look"], x: number, y: number, k: number, dir: number, lw: number, col: string, alpha: number): void {
  const r = HEAD_R * k;
  // hair behind the head
  if (L.hair === "big") { g.fillStyle = L.color; g.globalAlpha = alpha * 0.25; g.beginPath(); g.ellipse(x - 3 * k * dir, y + 1 * k, r * 1.55, r * 1.45, 0, 0, 6.283); g.fill(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = lw * 0.8; g.stroke(); }
  if (L.hair === "pony") { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x - r * 0.7 * dir, y - r * 0.5); g.quadraticCurveTo(x - r * 1.9 * dir, y - r * 0.2, x - r * 1.6 * dir, y + r * 1.4); g.stroke(); }
  g.fillStyle = "#0e0b0a"; g.strokeStyle = col; g.lineWidth = lw;
  g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); g.stroke();
  if (L.hair === "bun") { g.fillStyle = L.color; g.globalAlpha = alpha * 0.3; g.beginPath(); g.arc(x - 1 * k * dir, y - r * 1.45, r * 0.6, 0, 6.283); g.fill(); g.globalAlpha = alpha; g.stroke(); }
  // hats
  if (L.hat === "bandana" || L.hat === "cap" || L.hat === "beanie") {
    g.fillStyle = L.accent; g.strokeStyle = L.accent;
    g.beginPath(); g.arc(x, y - 1 * k, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    g.lineWidth = lw * 0.9; g.beginPath();
    if (L.hat === "bandana") { g.moveTo(x - r * 0.95 * dir, y - 3 * k); g.lineTo(x - r * 1.6 * dir, y - 6 * k); g.moveTo(x - r * 0.95 * dir, y - 3 * k); g.lineTo(x - r * 1.6 * dir, y); }
    if (L.hat === "cap") { g.lineWidth = lw * 1.1; g.moveTo(x + r * 0.6 * dir, y - 4 * k); g.lineTo(x + r * 1.75 * dir, y - 4 * k); }
    if (L.hat === "beanie") { g.arc(x, y - r * 1.1, r * 0.25, 0, 6.283); }
    g.stroke();
  }
  // sunglasses: the Mosaics never take them off
  g.fillStyle = "#0e0b0a"; g.strokeStyle = col; g.lineWidth = Math.max(0.8, lw * 0.5);
  const gx = x + 2.2 * k * dir, gy = y - 1 * k;
  g.beginPath(); g.rect(gx - 9.5 * k, gy - 1.5 * k, 8.5 * k, 4.5 * k); g.rect(gx + 0.8 * k, gy - 1.5 * k, 8.5 * k, 4.5 * k); g.fill(); g.stroke();
  // mouth
  g.beginPath(); g.moveTo(gx - 3.5 * k, y + 6.5 * k); g.quadraticCurveTo(gx, y + 8.5 * k, gx + 3.5 * k, y + 6.5 * k); g.stroke();
  if (L.glam) { g.strokeStyle = "#f6b62c"; g.beginPath(); g.arc(x - r * 1.05, y + 6 * k, 2.4 * k, 0, 6.283); g.arc(x + r * 1.05, y + 6 * k, 2.4 * k, 0, 6.283); g.stroke(); }
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
