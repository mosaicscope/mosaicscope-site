import type { Character } from "../entities/types";
import { dressOf } from "../mind/Dress";

/** Residents keep the big head from their art request (the rest of the figure uses HEAD_R from StickFigure). */
const RESIDENT_HEAD_R = 10.5;

/**
 * RESIDENTS: the everyday Christchurch local, drawn the way Louis read the "pink guy" references
 * (art-requests/011 to 013): an egg-shaped belly that tapers into a long thin neck, a tall head with a
 * big bulb nose, one big ear, heavy droopy eyelids, buck teeth, a baseball cap, a tee, spindly limbs and
 * little flat feet. It is still a LINE drawing: neon outline on dark fill in the person's own colour, so it
 * sits with the Mosaics' footer crew instead of replacing them. Cosmetic and derived from the id only
 * (no RNG, nothing saved), so the simulation is untouched. Original shapes; nothing is traced.
 */
type Ctx = CanvasRenderingContext2D;

const INK = "#0e0b0a";
const NOSE = ["#ff7ad9", "#ffb36b", "#ff9a8a", "#d99aff"];
const TEES = ["#8fd0ff", "#8fd0ff", "#ffe08a", "#f4efe0", "#a6f0b8", "#ffb3d9"];   // mostly the reference's light blue
const CAPS = ["#d9382c", "#2f7ad9", "#e8c42c", "#3a9e6a", "#efe6d2"];
const hashId = (n: number): number => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; };

/** Share of eligible people who are a resident: about half, so crowds mix residents with the other looks. */
export const RESIDENT_SHARE = 0.5;
const UNIFORMED = new Set(["uniform", "hivis", "suit", "wetsuit", "robe", "apron"]);
const CACHE = new WeakMap<Character, boolean>();

/** True for ordinary locals; false for the Mosaics, the player, glam people and anyone in a uniform. */
export function isResident(c: Character): boolean {
  let r = CACHE.get(c);
  if (r === undefined) {
    const L = c.look, D = dressOf(c);
    r = !L.main && !L.glam && c.id !== -1 && c.mode !== "player" && !(D && UNIFORMED.has(D.top)) && hashId(c.id) / 4294967296 < RESIDENT_SHARE;
    CACHE.set(c, r);
  }
  return r;
}

/** Deterministic cosmetic traits for one resident. */
export function residentTraits(id: number): { tee: string; nose: string; cap: string | null; belly: number; lids: number; teeth: boolean } {
  const h = hashId(id * 7 + 3);
  return {
    tee: TEES[(h >>> 2) % TEES.length],
    nose: NOSE[h % NOSE.length],
    cap: (h >>> 4) % 10 < 6 ? CAPS[(h >>> 8) % CAPS.length] : null,
    belly: 0.85 + ((h >>> 12) % 40) / 100,     // 0.85 to 1.24 of the base belly
    lids: 0.45 + ((h >>> 16) % 40) / 100,      // how droopy: 0.45 to 0.84 of the eye covered
    teeth: (h >>> 20) % 10 < 7,
  };
}

export function drawResident(g: Ctx, J: Float32Array, c: Character, k: number, dir: number, alpha: number, hd: boolean, flash: boolean, lw: number): void {
  const L = c.look, T = residentTraits(c.id), col = flash ? "#ffffff" : L.color;
  const thin = Math.max(1, lw * 0.82);
  g.globalAlpha = alpha; g.lineCap = "round"; g.lineJoin = "round";
  const path = (pts: number[]) => { g.beginPath(); g.moveTo(J[pts[0]], J[pts[0] + 1]); for (let i = 1; i < pts.length; i++) g.lineTo(J[pts[i]], J[pts[i] + 1]); };
  const stroke = (pts: number[], w: number) => {
    if (hd) { g.strokeStyle = "rgba(10,8,12,.85)"; g.lineWidth = w + 2.2 * k; path(pts); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; path(pts); g.stroke();
  };
  // spindly legs and arms
  stroke([0, 16, 18], thin); stroke([0, 20, 22], thin);
  stroke([6, 8, 10], thin * 0.9); stroke([6, 12, 14], thin * 0.9);
  // little flat feet and round hands
  g.fillStyle = INK; g.strokeStyle = col; g.lineWidth = thin * 0.8;
  for (const f of [18, 22]) { g.beginPath(); g.ellipse(J[f] + 3.2 * k * dir, J[f + 1] - 0.6 * k, 5.4 * k, 2.3 * k, 0, 0, 6.283); g.fill(); g.stroke(); }
  for (const h of [10, 14]) { g.beginPath(); g.arc(J[h], J[h + 1], 2.1 * k + thin * 0.35, 0, 6.283); g.fill(); g.stroke(); }

  // ---- the egg: a belly that tapers into the neck
  const hx = J[0], hy = J[1], nx = J[2], ny = J[3];
  const ux = nx - hx, uy = ny - hy, len = Math.hypot(ux, uy) || 1, tx = ux / len, ty = uy / len, px = -ty, py = tx;
  const bw = 15.5 * k * T.belly * (L.build ?? 1), nw = 2.6 * k;
  const width = (t: number): number => nw + (bw - nw) * Math.pow(1 - t, 1.7);   // t: 0 at the hip, 1 at the neck
  const at = (t: number, side: number): [number, number] => [hx + ux * t + px * side * width(t), hy + uy * t + py * side * width(t)];
  const egg = (t0: number): void => {
    g.beginPath();
    let p = at(1, 1); g.moveTo(p[0], p[1]);
    for (let i = 1; i <= 10; i++) { p = at(1 - (1 - t0) * (i / 10), 1); g.lineTo(p[0], p[1]); }
    if (t0 === 0) { for (let a = 0; a <= 6; a++) { const th = (a / 6) * Math.PI; g.lineTo(hx - tx * Math.sin(th) * bw * 0.55 + px * Math.cos(th) * bw, hy - ty * Math.sin(th) * bw * 0.55 + py * Math.cos(th) * bw); } }
    else { p = at(t0, -1); g.lineTo(p[0], p[1]); }
    for (let i = 1; i <= 10; i++) { p = at(t0 + (1 - t0) * (i / 10), -1); g.lineTo(p[0], p[1]); }
    g.closePath();
  };
  egg(0); g.fillStyle = INK; g.fill();
  g.fillStyle = col; g.globalAlpha = alpha * 0.34; egg(0); g.fill(); g.globalAlpha = alpha;   // skin: the pear reads as a form, not a hole
  // the tee: a brighter upper half with short sleeves and a hem line
  const tee = flash ? "#ffffff" : T.tee;
  g.fillStyle = tee; g.globalAlpha = alpha * 0.9; egg(0.14); g.fill();
  g.fillStyle = "rgba(20,14,40,.28)"; g.globalAlpha = alpha; { const a = at(0.14, -dir), b = at(1, -dir), c2 = at(1, -dir * 0.15), d = at(0.14, -dir * 0.15); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }   // turned-away side in shade, for volume
  g.strokeStyle = tee; g.lineWidth = thin * 1.5; g.beginPath(); g.moveTo(J[6], J[7]); g.lineTo(J[6] + (J[8] - J[6]) * 0.45, J[7] + (J[9] - J[7]) * 0.45); g.moveTo(J[6], J[7]); g.lineTo(J[6] + (J[12] - J[6]) * 0.45, J[7] + (J[13] - J[7]) * 0.45); g.stroke();
  g.strokeStyle = col; g.lineWidth = lw; egg(0); g.stroke();
  const hem0 = at(0.16, 1), hem1 = at(0.16, -1); g.lineWidth = thin * 0.7; g.beginPath(); g.moveTo(hem0[0], hem0[1]); g.lineTo(hem1[0], hem1[1]); g.stroke();
  if (hd) { g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = Math.max(0.6, lw * 0.3); g.beginPath(); for (let i = 0; i <= 8; i++) { const p = at(0.1 + 0.8 * (i / 8), dir > 0 ? -1 : 1); i ? g.lineTo(p[0] + 1.2 * k, p[1] - 0.8 * k) : g.moveTo(p[0] + 1.2 * k, p[1] - 0.8 * k); } g.stroke(); }

  // ---- long neck into a tall head
  const x = J[4], y = J[5], rx = RESIDENT_HEAD_R * k * 1.12, ry = RESIDENT_HEAD_R * k * 1.36;
  g.strokeStyle = col; g.lineWidth = thin;
  g.beginPath(); g.moveTo(nx + px * nw, ny + py * nw); g.lineTo(x + rx * 0.42, y + ry * 0.8); g.moveTo(nx - px * nw, ny - py * nw); g.lineTo(x - rx * 0.42, y + ry * 0.8); g.stroke();
  // the big ear on the far side
  g.fillStyle = INK; g.beginPath(); g.ellipse(x - dir * rx * 0.98, y + ry * 0.08, rx * 0.34, ry * 0.3, -0.2 * dir, 0, 6.283); g.fill(); g.lineWidth = thin; g.stroke();
  g.fillStyle = col; g.globalAlpha = alpha * 0.25; g.beginPath(); g.ellipse(x - dir * rx * 0.98, y + ry * 0.08, rx * 0.18, ry * 0.16, 0, 0, 6.283); g.fill(); g.globalAlpha = alpha;
  // head
  if (hd) { g.strokeStyle = "rgba(10,8,12,.85)"; g.lineWidth = lw + 2.2 * k; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.stroke(); }
  g.fillStyle = INK; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); g.stroke();
  g.fillStyle = col; g.globalAlpha = alpha * 0.14; g.beginPath(); g.ellipse(x, y, rx * 0.96, ry * 0.96, 0, 0, 6.283); g.fill(); g.globalAlpha = alpha;
  // the big bulb nose
  const nr = rx * 0.44, nxp = x + dir * rx * 0.98, nyp = y + ry * 0.2;
  g.fillStyle = flash ? "#fff" : T.nose; g.strokeStyle = INK; g.lineWidth = Math.max(1, 1.5 * k); g.beginPath(); g.arc(nxp, nyp, nr, 0, 6.283); g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(nxp - dir * nr * 0.25, nyp - nr * 0.3, nr * 0.22, 0, 6.283); g.fill();
  // droopy eyes: white, a green pupil, and a heavy lid covering the top of each
  for (const o of [0.12, 0.62]) {
    const ex = x + dir * rx * o, ey = y - ry * 0.16, er = rx * 0.3;
    g.fillStyle = "#f4efe0"; g.beginPath(); g.ellipse(ex, ey, er, er * 0.85, 0, 0, 6.283); g.fill();
    g.fillStyle = "#2f9e6a"; g.beginPath(); g.arc(ex + dir * er * 0.25, ey + er * 0.18, er * 0.42, 0, 6.283); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(ex + dir * er * 0.25, ey + er * 0.18, er * 0.2, 0, 6.283); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(ex, ey - er * (0.85 - T.lids), er * 1.08, er * T.lids, 0, Math.PI, 0); g.closePath(); g.fill();   // the lid
    g.strokeStyle = INK; g.lineWidth = Math.max(1, 1.3 * k); g.beginPath(); g.ellipse(ex, ey, er, er * 0.85, 0, 0, 6.283); g.stroke();
    g.strokeStyle = col; g.lineWidth = thin * 0.7; g.beginPath(); g.moveTo(ex - er * 1.1, ey - er * (1.0 + 0.2 * dir * (o > 0.3 ? 1 : -1))); g.lineTo(ex + er * 1.1, ey - er * (1.0 - 0.2 * dir * (o > 0.3 ? 1 : -1))); g.stroke();   // brow, tilted tired
  }
  // lazy smirk and buck teeth
  const my = y + ry * 0.58, mx = x + dir * rx * 0.38;
  g.strokeStyle = col; g.lineWidth = thin * 0.8; g.beginPath(); g.moveTo(mx - rx * 0.45, my); g.quadraticCurveTo(mx + dir * rx * 0.1, my + ry * 0.2, mx + rx * 0.5, my - ry * 0.05); g.stroke();
  if (T.teeth) { g.fillStyle = "#f4efe0"; g.fillRect(mx - rx * 0.12, my + ry * 0.04, rx * 0.2, ry * 0.2); g.fillRect(mx + rx * 0.1, my + ry * 0.02, rx * 0.2, ry * 0.2); g.strokeStyle = INK; g.lineWidth = Math.max(0.6, 0.8 * k); g.strokeRect(mx - rx * 0.12, my + ry * 0.04, rx * 0.2, ry * 0.2); g.strokeRect(mx + rx * 0.1, my + ry * 0.02, rx * 0.2, ry * 0.2); }
  // baseball cap, brim pointing where they look
  if (T.cap) {
    const cc = flash ? "#fff" : T.cap;
    g.fillStyle = cc; g.strokeStyle = INK; g.lineWidth = Math.max(1, 1.8 * k);
    g.beginPath(); g.ellipse(x, y - ry * 0.34, rx * 1.06, ry * 0.7, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x + dir * rx * 0.85, y - ry * 0.3, rx * 0.8, ry * 0.12, 0, 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(x - dir * rx * 1.12 - (dir > 0 ? 2.5 * k : 0), y - ry * 0.36, 2.5 * k, ry * 0.55);   // a tuft of hair under the cap at the back
  }
  g.globalAlpha = alpha;
}

