/**
 * Everyday skin, eye, teeth and mouth issues that people actually get, drawn as small cartoon marks
 * (no photos or real faces are used). Each one is a face part in one of the slots of FaceGenes.
 */
import type { Draw, FaceCtx } from "./FaceGenes";

type G = CanvasRenderingContext2D;
const dot = (g: G, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
const ring = (g: G, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke(); };
const ln = (g: G, pts: number[]): void => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
const blob = (g: G, x: number, y: number, rx: number, ry: number, col: string, a = 0.7): void => { g.globalAlpha *= a; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); g.globalAlpha /= a; };
const sides = (c: FaceCtx, n: number): number[] => [-n * c.k, n * c.k];
/** A cluster of small dots in a fixed pattern around (x, y). */
const cluster = (g: G, x: number, y: number, k: number, n: number, r: number, col: string): void => { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = i * 2.4, d = (i % 3) * 1.6 * k; dot(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * k); } };

/** Skin: pimples, rashes, freckles, age spots and marks. */
const skin: Draw[] = [
  (g, c, t) => { cluster(g, c.fx - 4.5 * c.k, c.my - 5 * c.k, c.k, 6, 0.8, "#d8485c"); g.fillStyle = t; dot(g, c.fx - 4 * c.k, c.my - 5 * c.k, 0.6 * c.k); },            // acne cluster on the cheek
  (g, c) => { cluster(g, c.fx + 4 * c.k, c.y - 4 * c.k, c.k, 7, 0.5, "#2a1a1a"); },                                                                                     // blackheads on the nose and forehead
  (g, c) => { blob(g, c.fx + 6 * c.k, c.ey + 2 * c.k, 3 * c.k, 2 * c.k, "#6b2fb8", 0.8); blob(g, c.fx + 6 * c.k, c.ey + 2 * c.k, 1.4 * c.k, 1 * c.k, "#2f8a6b", 0.6); }, // a bruise, purple with green edge
  (g, c) => { blob(g, c.fx - 4.6 * c.k, c.ey + 0.8 * c.k, 4.6 * c.k, 3.6 * c.k, "#2a1a3a", 0.85); },                                                                     // a black eye
  (g, c) => { blob(g, c.fx, c.y - 1 * c.k, 9 * c.k, 4 * c.k, "#e0493c", 0.45); },                                                                                       // sunburn across the nose and cheeks
  (g, c) => { blob(g, c.fx - 5 * c.k, c.my - 2 * c.k, 2.6 * c.k, 2.6 * c.k, "#ff5a6e", 0.35); blob(g, c.fx + 5 * c.k, c.my - 2 * c.k, 2.6 * c.k, 2.6 * c.k, "#ff5a6e", 0.35); }, // rosacea redness
  (g, c) => { cluster(g, c.fx - 3 * c.k, c.ey + 4 * c.k, c.k, 5, 0.4, "#6b4a30"); cluster(g, c.fx + 4 * c.k, c.ey + 3 * c.k, c.k, 4, 0.4, "#6b4a30"); },                 // freckles
  (g, c) => { blob(g, c.fx + 3 * c.k, c.y + 6 * c.k, 1.8 * c.k, 1.2 * c.k, "#5a3a22", 0.6); blob(g, c.fx - 6 * c.k, c.y - 2 * c.k, 1.2 * c.k, 1.2 * c.k, "#5a3a22", 0.6); }, // age spots
  (g, c) => { g.strokeStyle = "#f4f1ea"; g.lineWidth = c.lw * 0.5; for (let i = 0; i < 7; i++) ln(g, [c.fx + (i - 3) * 1.6 * c.k, c.y - 9 * c.k, c.fx + (i - 3) * 1.6 * c.k + 0.8 * c.k, c.y - 6 * c.k]); },   // sweat beads on the forehead
  (g, c) => { g.fillStyle = "#ff3838"; g.globalAlpha = c.alpha * 0.6; for (const s of sides(c, 5)) { g.beginPath(); g.ellipse(c.fx + s, c.ey + 4 * c.k, 1.4 * c.k, 3 * c.k, 0, 0, 6.283); g.fill(); } g.globalAlpha = c.alpha; }, // a flushed, rosy look under the eyes
  (g, c) => { g.strokeStyle = "#8a6b8a"; g.lineWidth = c.lw * 0.5; for (let i = 0; i < 3; i++) ln(g, [c.fx - 1 * c.k, c.y - 7 * c.k + i * 2 * c.k, c.fx + 6 * c.k, c.y - 7 * c.k + i * 2 * c.k]); }, // dandruff and forehead lines
  (g, c) => { g.fillStyle = "#8a5a3a"; for (const s of sides(c, 4)) { dot(g, c.fx + s, c.ey - 0.8 * c.k, 0.5 * c.k); } blob(g, c.fx, c.my + 2 * c.k, 1.4 * c.k, 1 * c.k, "#8a5a3a", 0.5); }, // mole cluster
  (g, c) => { blob(g, c.fx + 1 * c.k, c.my - 6 * c.k, 1.4 * c.k, 1.4 * c.k, "#c4a07a", 0.8); g.strokeStyle = "#7a5a3a"; g.lineWidth = c.lw * 0.4; ring(g, c.fx + 1 * c.k, c.my - 6 * c.k, 1.4 * c.k); }, // a wart
  (g, c) => { g.strokeStyle = "#b03030"; g.lineWidth = c.lw * 0.5; for (const s of sides(c, 4.5)) ln(g, [c.fx + s - 2 * c.k, c.ey - 3 * c.k, c.fx + s + 2 * c.k, c.ey - 1 * c.k]); }, // a scratch by the eye
  (g, c) => { blob(g, c.fx + 4 * c.k, c.my - 3 * c.k, 1.2 * c.k, 1.2 * c.k, "#ffb3c1", 0.9); blob(g, c.fx - 3 * c.k, c.y - 3 * c.k, 1 * c.k, 1 * c.k, "#ffb3c1", 0.9); }, // spots with white tops
  (g, c) => { g.fillStyle = "#3a2a1e"; for (let i = 0; i < 5; i++) dot(g, c.fx - 6 * c.k + i * 3 * c.k, c.my + 3 * c.k + (i % 2) * 0.5 * c.k, 0.3 * c.k); }, // stubble dots
  (g, c) => { g.strokeStyle = "#e0493c"; g.lineWidth = c.lw * 0.5; ring(g, c.fx + 5 * c.k, c.y - 1 * c.k, 1.8 * c.k); }, // a small scab
];

/** Eyes: puffiness, bags, dark circles, styes and eye redness. */
const eyes: Draw[] = [
  (g, c) => { if (c.covered) return; blob(g, c.fx - 4.6 * c.k, c.ey + 4.8 * c.k, 4 * c.k, 1.4 * c.k, "#3a2a4a", 0.5); blob(g, c.fx + 4.6 * c.k, c.ey + 4.8 * c.k, 4 * c.k, 1.4 * c.k, "#3a2a4a", 0.5); }, // dark circles
  (g, c) => { if (c.covered) return; g.strokeStyle = "#7a6a8a"; g.lineWidth = c.lw * 0.5; for (const s of sides(c, 4.6)) ln(g, [c.fx + s - 3.6 * c.k, c.ey + 3 * c.k, c.fx + s, c.ey + 4.4 * c.k, c.fx + s + 3.6 * c.k, c.ey + 3 * c.k]); }, // eye bags
  (g, c) => { if (c.covered) return; g.fillStyle = "#ff5a6e"; for (const s of sides(c, 4.6)) { g.beginPath(); g.ellipse(c.fx + s, c.ey, 3.6 * c.k, 2.6 * c.k, 0, 0, 6.283); g.fill(); } g.fillStyle = "#f4f1ea"; for (const s of sides(c, 4.6)) dot(g, c.fx + s, c.ey + 0.2 * c.k, 1.2 * c.k); }, // bloodshot eyes
  (g, c) => { if (c.covered) return; blob(g, c.fx + 4.6 * c.k, c.ey - 3.6 * c.k, 1.6 * c.k, 2 * c.k, "#ff6a7a", 0.9); }, // a stye on the eyelid
  (g, c) => { if (c.covered) return; g.strokeStyle = "#3dd6ff"; g.lineWidth = c.lw * 0.5; for (const s of sides(c, 4.6)) { ln(g, [c.fx + s - 2 * c.k, c.ey + 3 * c.k, c.fx + s - 3 * c.k, c.ey + 7 * c.k]); ln(g, [c.fx + s + 2 * c.k, c.ey + 3 * c.k, c.fx + s + 3 * c.k, c.ey + 7 * c.k]); } }, // tear streaks
  (g, c) => { if (c.covered) return; g.fillStyle = "#3dd6ff"; g.globalAlpha = c.alpha * 0.8; dot(g, c.fx - 4.6 * c.k, c.ey + 4 * c.k, 0.9 * c.k); g.globalAlpha = c.alpha; }, // a watery eye drop
  (g, c) => { if (c.covered) return; g.strokeStyle = "#6a5a7a"; g.lineWidth = c.lw * 0.6; for (const s of sides(c, 4.6)) ln(g, [c.fx + s - 3.6 * c.k, c.ey - 3.6 * c.k, c.fx + s + 3.6 * c.k, c.ey - 3.6 * c.k]); }, // heavy lids
  (g, c) => { if (c.covered) return; g.strokeStyle = "#0e0b0a"; g.lineWidth = c.lw * 0.6; for (const s of sides(c, 4.6)) for (let i = 0; i < 4; i++) ln(g, [c.fx + s - 3 * c.k + i * 2 * c.k, c.ey - 3.6 * c.k, c.fx + s - 3.5 * c.k + i * 2.2 * c.k, c.ey - 5.2 * c.k]); }, // crusty lashes
  (g, c) => { if (c.covered) return; g.fillStyle = "#0e0b0a"; dot(g, c.fx - 4.6 * c.k + 1.6 * c.k, c.ey + 0.8 * c.k, 1 * c.k); dot(g, c.fx + 4.6 * c.k + 1.6 * c.k, c.ey + 0.8 * c.k, 1 * c.k); }, // a turned eye
  (g, c) => { if (c.covered) return; g.strokeStyle = "#7a6a8a"; g.lineWidth = c.lw * 0.5; ln(g, [c.fx - 9 * c.k, c.ey - 1 * c.k, c.fx - 7 * c.k, c.ey - 3 * c.k]); ln(g, [c.fx + 9 * c.k, c.ey - 1 * c.k, c.fx + 7 * c.k, c.ey - 3 * c.k]); }, // crow's feet
  (g, c) => { if (c.covered) return; g.fillStyle = "#c4a07a"; dot(g, c.fx + 9 * c.k, c.ey + 2 * c.k, 0.9 * c.k); }, // a grain of sleep
];

/** Mouth and teeth: braces, gaps, cracks, ulcers and dental trouble. */
const mouth: Draw[] = [
  (g, c) => { g.fillStyle = "#c8c8d0"; g.strokeStyle = "#0e0b0a"; g.lineWidth = Math.max(0.5, c.lw * 0.3); g.fillRect(c.fx - 4 * c.k, c.my - 0.6 * c.k, 8 * c.k, 1.4 * c.k); g.strokeRect(c.fx - 4 * c.k, c.my - 0.6 * c.k, 8 * c.k, 1.4 * c.k); }, // braces
  (g, c) => { g.fillStyle = "#f4f1ea"; g.strokeStyle = "#0e0b0a"; g.lineWidth = Math.max(0.5, c.lw * 0.3); g.beginPath(); g.rect(c.fx - 2.4 * c.k, c.my, 1.2 * c.k, 2.4 * c.k); g.fill(); g.stroke(); g.beginPath(); g.rect(c.fx + 1.2 * c.k, c.my, 1.2 * c.k, 2.4 * c.k); g.fill(); g.stroke(); }, // a gap in the front teeth
  (g, c) => { g.fillStyle = "#f4f1ea"; g.strokeStyle = "#0e0b0a"; g.lineWidth = Math.max(0.5, c.lw * 0.3); g.beginPath(); g.rect(c.fx + 0.6 * c.k, c.my - 0.2 * c.k, 1.2 * c.k, 2.6 * c.k); g.fill(); g.stroke(); }, // a crooked tooth
  (g, c) => { g.strokeStyle = "#8a2a3a"; g.lineWidth = c.lw * 0.5; ln(g, [c.fx - 3 * c.k, c.my + 1.6 * c.k, c.fx - 1 * c.k, c.my + 2.2 * c.k, c.fx + 1 * c.k, c.my + 1.6 * c.k]); }, // chapped lips
  (g, c) => { g.strokeStyle = "#8a2a3a"; g.lineWidth = c.lw * 0.5; ln(g, [c.fx - 2 * c.k, c.my, c.fx, c.my + 0.6 * c.k, c.fx + 2 * c.k, c.my]); ln(g, [c.fx + 0.4 * c.k, c.my + 0.5 * c.k, c.fx + 1 * c.k, c.my + 1.2 * c.k]); }, // cracked lip
  (g, c) => { g.fillStyle = "#f7e8ff"; g.strokeStyle = "#c04a7a"; g.lineWidth = c.lw * 0.4; g.beginPath(); g.ellipse(c.fx + 3 * c.k, c.my + 1 * c.k, 1.4 * c.k, 1 * c.k, 0, 0, 6.283); g.fill(); g.stroke(); }, // mouth ulcer
  (g, c) => { g.fillStyle = "#c04a3a"; g.globalAlpha = c.alpha * 0.8; dot(g, c.fx - 2 * c.k, c.my + 0.8 * c.k, 0.9 * c.k); g.globalAlpha = c.alpha; }, // cheek bite
  (g, c) => { g.fillStyle = "#e0c060"; g.globalAlpha = c.alpha * 0.9; dot(g, c.fx + 1 * c.k, c.my - 3 * c.k, 1.2 * c.k); g.globalAlpha = c.alpha; }, // a bit of food stuck to the lip
  (g, c) => { g.fillStyle = "#ffffff"; g.strokeStyle = "#0e0b0a"; g.lineWidth = Math.max(0.5, c.lw * 0.25); for (let i = 0; i < 4; i++) { g.beginPath(); g.rect(c.fx - 4.2 * c.k + i * 2 * c.k, c.my, 1.5 * c.k, 2.2 * c.k); g.fill(); g.stroke(); } }, // many teeth showing
  (g, c) => { g.strokeStyle = "#5a2a6a"; g.lineWidth = c.lw * 0.4; ln(g, [c.fx - 4 * c.k, c.my + 3.2 * c.k, c.fx, c.my + 2.8 * c.k, c.fx + 4 * c.k, c.my + 3.2 * c.k]); }, // a sore on the gum line
  (g, c) => { g.fillStyle = "#e0c060"; for (let i = 0; i < 3; i++) dot(g, c.fx - 2 * c.k + i * 2 * c.k, c.my + 3.4 * c.k, 0.5 * c.k); }, // tartar on the teeth
];

/** Nose and forehead: runny, bleeding, blocked, peeling and scabbed. */
const nose: Draw[] = [
  (g, c) => { g.fillStyle = "#c8e8ff"; g.globalAlpha = c.alpha * 0.8; dot(g, c.fx + 1 * c.k * c.dir, c.y + 6 * c.k, 0.9 * c.k); g.globalAlpha = c.alpha; }, // a runny nose drop
  (g, c) => { g.fillStyle = "#b0101a"; dot(g, c.fx + 1 * c.k * c.dir, c.y + 5 * c.k, 1.2 * c.k); g.fillRect(c.fx + 0.4 * c.k * c.dir, c.y + 5 * c.k, 1.2 * c.k, 3 * c.k); }, // a nosebleed
  (g, c) => { blob(g, c.fx, c.y + 3 * c.k, 3 * c.k, 2.4 * c.k, "#e0493c", 0.5); }, // a red nose from a cold
  (g, c) => { g.strokeStyle = "#8a2a3a"; g.lineWidth = c.lw * 0.5; ln(g, [c.fx - 1.6 * c.k, c.y + 4 * c.k, c.fx + 1.6 * c.k, c.y + 4 * c.k]); }, // a cracked nostril
  (g, c) => { g.strokeStyle = "#e0493c"; g.lineWidth = c.lw * 0.5; ring(g, c.fx + 2 * c.k, c.y - 9 * c.k, 1.4 * c.k); }, // a forehead scab
  (g, c) => { g.fillStyle = "#f4f1ea"; g.globalAlpha = c.alpha * 0.8; for (let i = 0; i < 4; i++) dot(g, c.fx - 3 * c.k + i * 2 * c.k, c.y - 8.6 * c.k + (i % 2) * 0.8 * c.k, 0.5 * c.k); g.globalAlpha = c.alpha; }, // flaky skin on the brow
  (g, c) => { g.strokeStyle = "#2a1a1a"; g.lineWidth = c.lw * 0.5; for (let i = 0; i < 3; i++) ln(g, [c.fx + (i - 1) * 2 * c.k, c.y - 5 * c.k, c.fx + (i - 1) * 2 * c.k + 0.6 * c.k, c.y - 3 * c.k]); }, // a pinched nose line
  (g, c) => { blob(g, c.fx - 1 * c.k, c.y + 5 * c.k, 2 * c.k, 1 * c.k, "#ff8a9a", 0.6); }, // a cold sore on the nose
  (g, c) => { g.strokeStyle = "#7a5a3a"; g.lineWidth = c.lw * 0.5; ln(g, [c.fx - 2 * c.k, c.y - 2 * c.k, c.fx + 2 * c.k, c.y - 3 * c.k]); }, // a split brow
  (g, c) => { g.fillStyle = "#ffd27a"; g.globalAlpha = c.alpha * 0.5; blob(g, c.fx, c.y - 2 * c.k, 6 * c.k, 4 * c.k, "#ffd27a", 0.2); g.globalAlpha = c.alpha; }, // a shiny oily T-zone
];

/** Every issue above, each one a face part (drawn over the slot it belongs to). */
export const ISSUES: [number, Draw[]][] = [[5, skin], [0, eyes], [8, mouth], [4, nose]];
