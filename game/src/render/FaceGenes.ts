/**
 * Procedural face "genes": ~107 tiny part variants (x8 tones) in 14 slots (iris, liner, glasses, brow pierce, nose bit, cheek,
 * forehead, face paint, mouth bit, ear, chin, scar, tattoo, age) plus continuous jitter, combined by one integer
 * seed. Nothing is stored per face but that seed, so there are no assets and the bundle stays flat.
 * The product of the tables is ~10^15 faces; the seed gives 2^31 of them.
 */
export interface FaceCtx { x: number; y: number; k: number; dir: number; lw: number; col: string; alpha: number; fx: number; ey: number; my: number; rx: number; ry: number; covered: boolean }
type Draw = (g: CanvasRenderingContext2D, c: FaceCtx, t: string) => void;

// 24 bright markings colours: paint, ink, glitter and tattoo tones, picked per slot per face
const TONES = ["#3dd6ff", "#ff4fa3", "#f6b62c", "#7be34a", "#a35bff", "#ff6a3d", "#f4f1ea", "#1fd1b8",
  "#ff2e63", "#00e5ff", "#ffe600", "#b8ff3d", "#ff8c00", "#7b2cff", "#ff9ad5", "#2ee6a6", "#0077ff", "#ffffff",
  "#ff3838", "#c6ff3d", "#ff00c8", "#00ffa3", "#8a5a2b", "#1a1a1a"];
export const FACE_SLOT_COUNT = 14;

const ln = (g: CanvasRenderingContext2D, pts: number[]): void => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
const ring = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke(); };
const sides = (c: FaceCtx, n: number): number[] => [-n * c.k, n * c.k];

/** Each slot: index 0 is "nothing"; the rest draw one small detail in tone `t`. */
const SLOTS: Draw[][] = [
  // 0 iris glint (on open eyes)
  [() => {}, ...[-1, 1].flatMap((_, i) => [0, 1, 2].map((v): Draw => (g, c, t) => { if (c.covered) return; g.fillStyle = t; for (const s of sides(c, 4)) dot(g, c.fx + s + (v - 1) * 0.5 * c.k * (i ? 1 : -1), c.ey + 0.8 * c.k, 0.7 * c.k); }))],
  // 1 eyeliner / lashes / eye shadow
  [() => {}, (g, c, t) => { if (!c.covered) { g.strokeStyle = t; for (const s of sides(c, 4)) ln(g, [c.fx + s - 2.6 * c.k, c.ey - 1.6 * c.k, c.fx + s + 2.6 * c.k, c.ey - 1.6 * c.k]); } },
    (g, c, t) => { if (!c.covered) { g.strokeStyle = t; for (const s of sides(c, 4)) ln(g, [c.fx + s + 2.4 * c.k, c.ey - 1.4 * c.k, c.fx + s + 4 * c.k, c.ey - 2.8 * c.k]); } },
    (g, c, t) => { if (!c.covered) { g.strokeStyle = t; for (const s of sides(c, 4)) ln(g, [c.fx + s - 2.4 * c.k, c.ey + 2.6 * c.k, c.fx + s + 2.4 * c.k, c.ey + 2.6 * c.k]); } },
    (g, c, t) => { if (!c.covered) { g.fillStyle = t; g.globalAlpha = c.alpha * 0.5; for (const s of sides(c, 4)) { g.beginPath(); g.ellipse(c.fx + s, c.ey - 1 * c.k, 3 * c.k, 1.6 * c.k, 0, 0, 6.283); g.fill(); } g.globalAlpha = c.alpha; } },
    (g, c, t) => { if (!c.covered) { g.strokeStyle = t; for (const s of sides(c, 4)) for (let i = -1; i <= 1; i++) ln(g, [c.fx + s + i * 1.4 * c.k, c.ey - 1.2 * c.k, c.fx + s + i * 2 * c.k, c.ey - 3 * c.k]); } },
    (g, c, t) => { if (!c.covered) { g.strokeStyle = t; ln(g, [c.fx - 7 * c.k, c.ey + 3 * c.k, c.fx - 5 * c.k, c.ey + 4.6 * c.k]); ln(g, [c.fx + 7 * c.k, c.ey + 3 * c.k, c.fx + 5 * c.k, c.ey + 4.6 * c.k]); } }],
  // 2 glasses and eyewear
  [() => {},
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; for (const s of sides(c, 4.6)) ring(g, c.fx + s, c.ey + 0.8 * c.k, 3.6 * c.k); ln(g, [c.fx - 1 * c.k, c.ey + 0.8 * c.k, c.fx + 1 * c.k, c.ey + 0.8 * c.k]); },
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; for (const s of sides(c, 4.6)) { g.beginPath(); g.rect(c.fx + s - 3.4 * c.k, c.ey - 2 * c.k, 6.8 * c.k, 5.4 * c.k); g.stroke(); } },
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; for (const s of sides(c, 4.6)) ln(g, [c.fx + s - 3.4 * c.k, c.ey - 2 * c.k, c.fx + s + 3.4 * c.k, c.ey - 2 * c.k]); },
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; ring(g, c.fx + 4.6 * c.k, c.ey + 0.8 * c.k, 3.6 * c.k); ln(g, [c.fx + 4.6 * c.k, c.ey + 4.4 * c.k, c.fx + 6 * c.k, c.ey + 9 * c.k]); },
    (g, c) => { if (c.covered) return; g.save(); g.lineWidth = c.lw * 0.6; g.strokeStyle = "#ff3a3a"; g.beginPath(); g.rect(c.fx - 8 * c.k, c.ey - 1.8 * c.k, 7 * c.k, 5 * c.k); g.stroke(); g.strokeStyle = "#3dd6ff"; g.beginPath(); g.rect(c.fx + 1 * c.k, c.ey - 1.8 * c.k, 7 * c.k, 5 * c.k); g.stroke(); g.restore(); },
    (g, c, t) => { if (c.covered) return; g.fillStyle = t; g.globalAlpha = c.alpha * 0.8; for (const s of sides(c, 4.4)) { g.beginPath(); g.moveTo(c.fx + s, c.ey + 3.6 * c.k); g.bezierCurveTo(c.fx + s - 5 * c.k, c.ey - 0.5 * c.k, c.fx + s - 2 * c.k, c.ey - 3 * c.k, c.fx + s, c.ey - 0.6 * c.k); g.bezierCurveTo(c.fx + s + 2 * c.k, c.ey - 3 * c.k, c.fx + s + 5 * c.k, c.ey - 0.5 * c.k, c.fx + s, c.ey + 3.6 * c.k); g.fill(); } g.globalAlpha = c.alpha; },
    (g, c, t) => { if (c.covered) return; g.fillStyle = t; g.globalAlpha = c.alpha * 0.8; for (const s of sides(c, 4.4)) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.628 - 1.57, r = i % 2 ? 1.6 * c.k : 3.6 * c.k; g.lineTo(c.fx + s + Math.cos(a) * r, c.ey + 0.8 * c.k + Math.sin(a) * r); } g.closePath(); g.fill(); } g.globalAlpha = c.alpha; },
    (g, c, t) => { g.strokeStyle = t; g.lineWidth = c.lw * 1.4; ln(g, [c.fx - 9.5 * c.k, c.ey - 3 * c.k, c.fx + 9.5 * c.k, c.ey + 3.5 * c.k]); g.fillStyle = "#0e0b0a"; g.beginPath(); g.ellipse(c.fx + 4.6 * c.k, c.ey + 0.8 * c.k, 3 * c.k, 2.4 * c.k, 0, 0, 6.283); g.fill(); },
    (g, c, t) => { g.strokeStyle = t; g.lineWidth = c.lw * 0.9; g.fillStyle = "#9ee7ff"; g.globalAlpha = c.alpha * 0.55; g.beginPath(); g.rect(c.fx - 10 * c.k, c.ey - 3 * c.k, 20 * c.k, 6.4 * c.k); g.fill(); g.globalAlpha = c.alpha; g.stroke(); },
    (g, c, t) => { g.strokeStyle = t; g.lineWidth = c.lw * 0.7; g.beginPath(); g.rect(c.fx - 10 * c.k, c.ey - 3.4 * c.k, 20 * c.k, 1.6 * c.k); g.stroke(); },
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; for (const s of sides(c, 4.6)) { ring(g, c.fx + s, c.ey + 0.8 * c.k, 3.8 * c.k); ring(g, c.fx + s, c.ey + 0.8 * c.k, 2.2 * c.k); } },
    (g, c, t) => { if (c.covered) return; g.strokeStyle = t; for (const s of sides(c, 4.6)) { g.beginPath(); g.moveTo(c.fx + s - 3.6 * c.k, c.ey - 1.8 * c.k); g.lineTo(c.fx + s + 3.6 * c.k, c.ey - 2.4 * c.k); g.lineTo(c.fx + s + 2.4 * c.k, c.ey + 3 * c.k); g.lineTo(c.fx + s - 2.4 * c.k, c.ey + 3 * c.k); g.closePath(); g.stroke(); } }],
  // 3 brow piercing / slit / scar
  [() => {}, (g, c, t) => { g.fillStyle = t; dot(g, c.fx + 6 * c.k, c.ey - 3.8 * c.k, 0.7 * c.k); dot(g, c.fx + 6 * c.k, c.ey - 1.8 * c.k, 0.7 * c.k); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 5 * c.k, c.ey - 4.6 * c.k, c.fx - 4 * c.k, c.ey - 2.4 * c.k]); ln(g, [c.fx - 4 * c.k, c.ey - 4.6 * c.k, c.fx - 3 * c.k, c.ey - 2.4 * c.k]); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx + 3 * c.k, c.ey - 4.8 * c.k, c.fx + 7 * c.k, c.ey - 4.8 * c.k]); },
    (g, c, t) => { g.fillStyle = t; for (const s of sides(c, 5)) dot(g, c.fx + s, c.ey - 5.2 * c.k, 0.6 * c.k); }],
  // 4 nose bit
  [() => {}, (g, c, t) => { g.fillStyle = t; dot(g, c.fx + 1.6 * c.k * c.dir, c.y + 4 * c.k, 0.7 * c.k); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 2 * c.k, c.y + 1.4 * c.k, c.fx + 2 * c.k, c.y + 2.4 * c.k]); ln(g, [c.fx - 2 * c.k, c.y + 2.4 * c.k, c.fx + 2 * c.k, c.y + 1.4 * c.k]); },
    (g, c, t) => { g.fillStyle = t; g.globalAlpha = c.alpha * 0.6; g.beginPath(); g.ellipse(c.fx, c.y + 3.2 * c.k, 1.8 * c.k, 1.3 * c.k, 0, 0, 6.283); g.fill(); g.globalAlpha = c.alpha; },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 3 * c.k, c.y + 4.2 * c.k, c.fx + 3 * c.k, c.y + 4.2 * c.k]); },
    (g, c, t) => { g.fillStyle = t; for (const s of [-1.2, 1.2]) dot(g, c.fx + s * c.k, c.y + 4.2 * c.k, 0.5 * c.k); },
    (g, c, t) => { g.fillStyle = t; g.globalAlpha = c.alpha * 0.7; for (let i = 0; i < 5; i++) dot(g, c.fx - 3 * c.k + i * 1.5 * c.k, c.y + 2.6 * c.k + (i % 2) * c.k, 0.4 * c.k); g.globalAlpha = c.alpha; }],
  // 5 cheek
  [() => {}, (g, c, t) => { g.strokeStyle = t; for (const s of sides(c, 6.5)) ln(g, [c.fx + s, c.my - 2.4 * c.k, c.fx + s * 0.95, c.my - 0.4 * c.k]); },
    (g, c, t) => { g.fillStyle = t; g.globalAlpha = c.alpha * 0.8; dot(g, c.fx - 6.5 * c.k, c.y + 4 * c.k, 1.4 * c.k); dot(g, c.fx + 6.5 * c.k, c.y + 4 * c.k, 1.4 * c.k); g.globalAlpha = c.alpha; },
    (g, c, t) => { g.fillStyle = t; g.beginPath(); g.moveTo(c.fx + 5 * c.k, c.ey + 3.4 * c.k); g.quadraticCurveTo(c.fx + 6.4 * c.k, c.ey + 5.6 * c.k, c.fx + 4.8 * c.k, c.ey + 6 * c.k); g.quadraticCurveTo(c.fx + 3.6 * c.k, c.ey + 5.4 * c.k, c.fx + 5 * c.k, c.ey + 3.4 * c.k); g.fill(); },
    (g, c, t) => { g.strokeStyle = t; for (const s of sides(c, 6.5)) for (const o of [-1, 0, 1]) ln(g, [c.fx + s, c.y + 4.2 * c.k + o * c.k, c.fx + s * 1.45, c.y + 3.6 * c.k + o * 1.4 * c.k]); },
    (g, c, t) => { g.fillStyle = t; for (const s of sides(c, 6.5)) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * 0.785, r = i % 2 ? 0.7 * c.k : 1.6 * c.k; g.lineTo(c.fx + s + Math.cos(a) * r, c.y + 4.2 * c.k + Math.sin(a) * r); } g.closePath(); g.fill(); } },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 7.5 * c.k, c.y + 3 * c.k, c.fx - 4.5 * c.k, c.y + 5 * c.k]); ln(g, [c.fx - 7.5 * c.k, c.y + 5 * c.k, c.fx - 4.5 * c.k, c.y + 3 * c.k]); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx + 6 * c.k, c.y + 2 * c.k, c.fx + 7 * c.k, c.y + 6 * c.k]); ln(g, [c.fx + 7 * c.k, c.y + 2 * c.k, c.fx + 8 * c.k, c.y + 6 * c.k]); },
    (g, c, t) => { g.fillStyle = t; for (const [ox, oy] of [[-6, 2.5], [-4, 4.5], [-7, 5], [5, 3], [7, 5], [4, 5.6]]) dot(g, c.fx + ox * c.k, c.y + oy * c.k, 0.45 * c.k); }],
  // 6 forehead
  [() => {}, (g, c, t) => { g.strokeStyle = t; ring(g, c.fx, c.y - c.ry * 0.62, 1.2 * c.k); dot(g, c.fx, c.y - c.ry * 0.62, 0.3 * c.k); },
    (g, c, t) => { g.fillStyle = t; dot(g, c.fx, c.y - c.ry * 0.6, 1 * c.k); },
    (g, c, t) => { g.strokeStyle = t; for (let i = -1; i <= 1; i++) ln(g, [c.fx + i * 2.4 * c.k, c.y - c.ry * 0.8, c.fx + i * 2.4 * c.k, c.y - c.ry * 0.4]); },
    (g, c, t) => { g.strokeStyle = t; g.lineWidth = c.lw * 1.2; ln(g, [c.fx - c.rx * 0.8, c.y - c.ry * 0.55, c.fx + c.rx * 0.8, c.y - c.ry * 0.55]); },
    (g, c) => { g.fillStyle = "#f4f1ea"; g.strokeStyle = c.col; g.beginPath(); g.rect(c.fx - 3.4 * c.k, c.y - c.ry * 0.75, 6.8 * c.k, 2.2 * c.k); g.fill(); g.stroke(); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 2 * c.k, c.y - c.ry * 0.4, c.fx, c.y - c.ry * 0.8, c.fx + 2 * c.k, c.y - c.ry * 0.4]); },
    (g, c, t) => { g.fillStyle = t; g.beginPath(); g.moveTo(c.fx, c.y - c.ry * 0.85); g.lineTo(c.fx + 1.8 * c.k, c.y - c.ry * 0.55); g.lineTo(c.fx, c.y - c.ry * 0.25); g.lineTo(c.fx - 1.8 * c.k, c.y - c.ry * 0.55); g.closePath(); g.fill(); },
    (g, c, t) => { g.strokeStyle = t; g.beginPath(); g.arc(c.fx, c.y - c.ry * 0.4, 2.4 * c.k, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); },
    (g, c, t) => { g.strokeStyle = t; for (let i = 0; i < 3; i++) ln(g, [c.fx - 4 * c.k, c.y - c.ry * 0.78 + i * 1.3 * c.k, c.fx + 4 * c.k, c.y - c.ry * 0.78 + i * 1.3 * c.k]); }],
  // 7 face paint
  [() => {}, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((v): Draw => (g, c, t) => {
    g.save(); g.fillStyle = t; g.strokeStyle = t; g.globalAlpha = c.alpha * 0.55;
    g.beginPath(); g.ellipse(c.x, c.y, c.rx * 0.96, c.ry * 0.96, 0, 0, 6.283); g.clip();
    switch (v) {
      case 0: g.fillRect(c.x, c.y - c.ry, c.rx, c.ry * 2); break; // half face
      case 1: g.fillRect(c.x - c.rx, c.y - c.ry, c.rx, c.ry * 2); break;
      case 2: g.fillRect(c.x - c.rx, c.ey - 2.4 * c.k, c.rx * 2, 4.2 * c.k); break; // war stripe over eyes
      case 3: g.fillRect(c.x - c.rx, c.y + 2 * c.k, c.rx * 2, c.ry); break; // lower mask
      case 4: g.lineWidth = c.lw * 1.6; g.globalAlpha = c.alpha * 0.8; ln(g, [c.fx - 7 * c.k, c.y + 2 * c.k, c.fx + 7 * c.k, c.y + 7 * c.k]); break;
      case 5: g.lineWidth = c.lw * 1.4; g.globalAlpha = c.alpha * 0.8; for (const s of sides(c, 6)) for (let i = 0; i < 3; i++) ln(g, [c.fx + s, c.y + 1 * c.k + i * 2 * c.k, c.fx + s * 1.3, c.y + 1.6 * c.k + i * 2 * c.k]); break;
      case 6: g.fillRect(c.x - c.rx, c.y - c.ry, c.rx * 2, c.ry * 0.7); break; // forehead cap
      case 7: g.fillRect(c.x - c.rx, c.y, c.rx * 2, c.ry); g.globalAlpha = c.alpha * 0.4; g.fillRect(c.x - c.rx, c.y - c.ry, c.rx * 2, c.ry); break;
      case 8: g.beginPath(); g.arc(c.fx, c.y + 1 * c.k, c.rx * 0.6, 0, 6.283); g.fill(); break; // clown nose-ish disc
      case 9: g.lineWidth = c.lw * 1.2; g.globalAlpha = c.alpha * 0.8; ln(g, [c.fx - 8 * c.k, c.ey - 4 * c.k, c.fx - 3 * c.k, c.ey + 6 * c.k]); ln(g, [c.fx + 8 * c.k, c.ey - 4 * c.k, c.fx + 3 * c.k, c.ey + 6 * c.k]); break;
      case 10: g.beginPath(); g.moveTo(c.x - c.rx, c.y); g.quadraticCurveTo(c.x, c.y - c.ry * 0.9, c.x + c.rx, c.y); g.lineTo(c.x + c.rx, c.y - c.ry); g.lineTo(c.x - c.rx, c.y - c.ry); g.fill(); break;
      default: g.globalAlpha = c.alpha * 0.8; g.lineWidth = c.lw * 1.2; ln(g, [c.fx - 6 * c.k, c.my - 3 * c.k, c.fx - 2 * c.k, c.my + 4 * c.k]); ln(g, [c.fx + 6 * c.k, c.my - 3 * c.k, c.fx + 2 * c.k, c.my + 4 * c.k]);
    }
    g.restore();
  })],
  // 8 mouth bit
  [() => {}, (g, c) => { g.fillStyle = "#f6b62c"; g.fillRect(c.fx + 1 * c.k, c.my - 0.4 * c.k, 1.2 * c.k, 1.4 * c.k); },
    (g, c) => { g.fillStyle = "#f4f1ea"; for (const s of [-1.8, 1.8]) { g.beginPath(); g.moveTo(c.fx + s * c.k - 0.6 * c.k, c.my); g.lineTo(c.fx + s * c.k + 0.6 * c.k, c.my); g.lineTo(c.fx + s * c.k, c.my + 2.2 * c.k); g.closePath(); g.fill(); } },
    (g, c, t) => { g.strokeStyle = t; g.beginPath(); g.arc(c.fx + 3 * c.k, c.my + 1.2 * c.k, 0.9 * c.k, 0, 6.283); g.stroke(); },
    (g, c, t) => { g.fillStyle = t; g.globalAlpha = c.alpha * 0.8; g.beginPath(); g.ellipse(c.fx, c.my + 0.4 * c.k, 3.8 * c.k, 1.3 * c.k, 0, 0, 6.283); g.fill(); g.globalAlpha = c.alpha; },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx + 2 * c.k, c.my + 0.6 * c.k, c.fx + 8 * c.k * c.dir, c.my + 3.4 * c.k]); g.fillStyle = t; dot(g, c.fx + 8 * c.k * c.dir, c.my + 3.4 * c.k, 1.4 * c.k); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx + 2 * c.k, c.my + 0.6 * c.k, c.fx + 6.5 * c.k * c.dir, c.my - 0.6 * c.k]); },
    (g, c, t) => { g.strokeStyle = t; ring(g, c.fx + 5.5 * c.k * c.dir, c.my - 2.4 * c.k, 1.3 * c.k); },
    (g, c, t) => { g.fillStyle = t; g.globalAlpha = c.alpha * 0.55; g.beginPath(); g.arc(c.fx + 4 * c.k * c.dir, c.my - 1 * c.k, 2.2 * c.k, 0, 6.283); g.fill(); g.globalAlpha = c.alpha; },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 4 * c.k, c.my + 3.6 * c.k, c.fx + 4 * c.k, c.my + 3.6 * c.k]); },
    // a cigarette hanging from the mouth corner: white stick, orange lit tip, a thin smoke thread
    (g, c) => { const x0 = c.fx + 2 * c.k, y0 = c.my + 0.6 * c.k, x1 = c.fx + 9 * c.k * c.dir, y1 = c.my + 1.8 * c.k; g.strokeStyle = "#f4f1ea"; g.lineWidth = Math.max(1, c.lw * 0.8); ln(g, [x0, y0, x1, y1]); g.strokeStyle = "#ff7a1a"; ln(g, [x1 - 1 * c.k * c.dir, y1 - 0.2 * c.k, x1, y1]); g.strokeStyle = "rgba(230,230,235,.5)"; g.lineWidth = Math.max(0.6, c.lw * 0.3); ln(g, [x1 + 1 * c.k * c.dir, y1 - 1 * c.k, x1 + 3 * c.k * c.dir, y1 - 4 * c.k]); },
    // a cold sore: a small red-pink blister on the lip edge
    (g, c) => { g.fillStyle = "#e0607a"; g.globalAlpha = c.alpha * 0.9; dot(g, c.fx + 3.2 * c.k * c.dir, c.my + 0.4 * c.k, 1.3 * c.k); g.fillStyle = "#ffd0d8"; dot(g, c.fx + 3.2 * c.k * c.dir, c.my + 0.1 * c.k, 0.5 * c.k); g.globalAlpha = c.alpha; }],
  // 9 ear bits
  [() => {}, (g, c, t) => { g.fillStyle = t; for (const s of [-1, 1]) dot(g, c.x + s * c.rx * 1.02, c.y + 3 * c.k, 0.8 * c.k); },
    (g, c, t) => { g.strokeStyle = t; for (const s of [-1, 1]) ring(g, c.x + s * c.rx * 1.02, c.y + 4.4 * c.k, 1.9 * c.k); },
    (g, c, t) => { g.strokeStyle = t; for (const s of [-1, 1]) { ln(g, [c.x + s * c.rx, c.y - 2 * c.k, c.x + s * c.rx * 1.2, c.y]); ln(g, [c.x + s * c.rx * 1.2, c.y, c.x + s * c.rx * 1.02, c.y + 2 * c.k]); } },
    (g, c, t) => { g.fillStyle = t; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(c.x + s * c.rx, c.y - 2 * c.k); g.lineTo(c.x + s * c.rx * 1.5, c.y - 5 * c.k); g.lineTo(c.x + s * c.rx, c.y + 1 * c.k); g.closePath(); g.fill(); } },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.x - c.rx * 1.02, c.y - 1 * c.k, c.x - c.rx * 1.3, c.y - 6 * c.k]); g.fillStyle = t; dot(g, c.x - c.rx * 1.3, c.y - 6 * c.k, 1 * c.k); },
    (g, c, t) => { g.fillStyle = t; for (const s of [-1, 1]) for (const o of [0, 2, 4]) dot(g, c.x + s * c.rx * 1.03, c.y + (o - 1) * c.k, 0.45 * c.k); }],
  // 10 chin
  [() => {}, (g, c, t) => { g.fillStyle = t; dot(g, c.fx, c.y + c.ry * 0.95, 0.7 * c.k); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx, c.my + 3 * c.k, c.fx, c.my + 5.4 * c.k]); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 1.4 * c.k, c.my + 4.4 * c.k, c.fx, c.my + 5.2 * c.k, c.fx + 1.4 * c.k, c.my + 4.4 * c.k]); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx - 4 * c.k, c.y + c.ry * 0.9, c.fx - 3 * c.k, c.y + c.ry * 1.4, c.fx - 2 * c.k, c.y + c.ry * 0.95]); ln(g, [c.fx, c.y + c.ry * 0.95, c.fx, c.y + c.ry * 1.6]); },
    (g, c, t) => { g.strokeStyle = t; ln(g, [c.fx, c.y + c.ry * 0.95, c.fx - 0.6 * c.k, c.y + c.ry * 1.5, c.fx + 0.6 * c.k, c.y + c.ry * 1.8, c.fx, c.y + c.ry * 2.2]); },
    (g, c, t) => { g.fillStyle = t; for (let i = -2; i <= 2; i++) dot(g, c.fx + i * 1.5 * c.k, c.my + 5 * c.k - Math.abs(i) * 0.4 * c.k, 0.35 * c.k); }],
  // 11 scars
  [() => {}, ...[0, 1, 2, 3, 4, 5, 6, 7].map((v): Draw => (g, c) => {
    g.strokeStyle = "#ec2a1c"; g.lineWidth = Math.max(0.8, c.lw * 0.5);
    const a = [[-4, -4, -7, 3], [4, -4, 7, 3], [-7, 3, 7, 4], [-6, 6, -2, 9], [3, 5, 8, 6], [-2, -6, 3, -3], [-7, 0, -5, 8], [5, -1, 6, 8]][v];
    ln(g, [c.fx + a[0] * c.k, c.y + a[1] * c.k, c.fx + a[2] * c.k, c.y + a[3] * c.k]);
    for (let i = 1; i <= 2; i++) { const m = i / 3, mx = a[0] + (a[2] - a[0]) * m, my = a[1] + (a[3] - a[1]) * m; ln(g, [c.fx + (mx - 0.9) * c.k, c.y + (my - 0.4) * c.k, c.fx + (mx + 0.9) * c.k, c.y + (my + 0.4) * c.k]); }
  }),
    // a sticking plaster over a cut
    (g, c) => { g.fillStyle = "#e9d9b8"; g.save(); g.translate(c.fx - 3 * c.k, c.y - 2 * c.k); g.rotate(-0.4); g.fillRect(-4 * c.k, -1.4 * c.k, 8 * c.k, 2.8 * c.k); g.fillStyle = "#c9a878"; g.fillRect(-1.2 * c.k, -1.4 * c.k, 2.4 * c.k, 2.8 * c.k); g.restore(); },
    // a fresh cut with a bead of dried blood
    (g, c) => { g.strokeStyle = "#b0101a"; g.lineWidth = Math.max(1, c.lw * 0.7); ln(g, [c.fx + 1 * c.k, c.y - 6 * c.k, c.fx + 4 * c.k, c.y - 3 * c.k]); g.fillStyle = "#7a0a14"; dot(g, c.fx + 4 * c.k, c.y - 2.6 * c.k, 0.9 * c.k); }],
  // 12 small tattoos
  [() => {}, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((v): Draw => (g, c, t) => {
    g.strokeStyle = t; g.fillStyle = t; const bx = c.fx + (v % 2 ? 6.4 : -6.4) * c.k, by = c.y + 3.4 * c.k;
    switch (v >> 1) {
      case 0: ln(g, [bx - 1.2 * c.k, by - 1.4 * c.k, bx + 1.2 * c.k, by + 1.4 * c.k]); ln(g, [bx - 1.2 * c.k, by + 1.4 * c.k, bx + 1.2 * c.k, by - 1.4 * c.k]); break; // x
      case 1: ring(g, bx, by, 1.4 * c.k); break;
      case 2: ln(g, [bx, by - 1.8 * c.k, bx, by + 1.8 * c.k]); ln(g, [bx - 1.8 * c.k, by, bx + 1.8 * c.k, by]); break; // plus
      case 3: g.beginPath(); g.moveTo(bx, by - 1.8 * c.k); g.lineTo(bx + 1.6 * c.k, by + 1.2 * c.k); g.lineTo(bx - 1.6 * c.k, by + 1.2 * c.k); g.closePath(); g.stroke(); break;
      default: ln(g, [bx - 1.6 * c.k, by - 1.4 * c.k, bx, by + 1.6 * c.k, bx + 1.6 * c.k, by - 1.4 * c.k]);
    }
  })],
  // 13 age / character lines
  [() => {}, (g, c) => { g.strokeStyle = c.col; g.globalAlpha = c.alpha * 0.55; for (const s of sides(c, 8)) ln(g, [c.fx + s, c.ey + 0.4 * c.k, c.fx + s * 1.1, c.ey + 2.2 * c.k]); g.globalAlpha = c.alpha; },
    (g, c) => { g.strokeStyle = c.col; g.globalAlpha = c.alpha * 0.55; for (const s of sides(c, 4)) ln(g, [c.fx + s - 2.4 * c.k, c.ey + 4 * c.k, c.fx + s + 2.4 * c.k, c.ey + 4 * c.k]); g.globalAlpha = c.alpha; },
    (g, c) => { g.strokeStyle = c.col; g.globalAlpha = c.alpha * 0.55; ln(g, [c.fx - 3 * c.k, c.y - c.ry * 0.7, c.fx + 3 * c.k, c.y - c.ry * 0.7]); ln(g, [c.fx - 2 * c.k, c.y - c.ry * 0.55, c.fx + 2 * c.k, c.y - c.ry * 0.55]); g.globalAlpha = c.alpha; },
    (g, c) => { g.strokeStyle = c.col; g.globalAlpha = c.alpha * 0.55; for (const s of sides(c, 3.4)) ln(g, [c.fx + s * 0.6, c.my - 3.4 * c.k, c.fx + s, c.my - 0.4 * c.k, c.fx + s * 0.8, c.my + 1.6 * c.k]); g.globalAlpha = c.alpha; },
    (g, c) => { g.fillStyle = "#c93a2a"; g.globalAlpha = c.alpha * 0.55; g.beginPath(); g.ellipse(c.fx, c.y + 3.2 * c.k, 1.6 * c.k, 1.1 * c.k, 0, 0, 6.283); g.fill(); g.globalAlpha = c.alpha; }],
];

export const FACE_SLOT_SIZES: number[] = SLOTS.map((s) => s.length);
/** Total distinct drawable part variants (tone choices not counted). */
export const FACE_PART_COUNT = FACE_SLOT_SIZES.reduce((a, b) => a + b - 1, 0);
/** Raw combination space of the tables: the product of every slot size, times the tone palette per toned slot. */
export const FACE_COMBINATIONS = FACE_SLOT_SIZES.reduce((a, b) => a * b, 1) * TONES.length ** 4;

/** Odds that a slot is used at all (so most faces stay readable at 100px). */
// more of the faces get markings now: about 1.6x the old odds, capped so faces stay readable
const USE: number[] = [0.85, 0.55, 0.5, 0.3, 0.28, 0.5, 0.3, 0.32, 0.4, 0.5, 0.36, 0.3, 0.3, 0.5];

function mix(a: number): number { a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); return (a ^ (a >>> 15)) >>> 0; }

/** Stable 31-bit seed from a string (FNV-1a). */
export function geneFromString(str: string): number { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 1) || 1; }

export interface FaceGenes { parts: number[]; tones: string[] }
const cache = new Map<number, FaceGenes>();

/** Decode a face seed into one part index per slot (0 = none) and a tone per slot. */
export function faceGenes(seed: number): FaceGenes {
  let G = cache.get(seed);
  if (G) return G;
  const parts: number[] = [], tones: string[] = [];
  let s = mix(seed | 0);
  for (let i = 0; i < SLOTS.length; i++) {
    s = mix(s + i + 1); const use = (s & 1023) / 1024 < USE[i];
    s = mix(s); parts.push(use ? 1 + (s % (SLOTS[i].length - 1)) : 0);
    s = mix(s); tones.push(TONES[s % TONES.length]);
  }
  G = { parts, tones };
  if (cache.size > 4000) cache.clear();
  cache.set(seed, G);
  return G;
}

/** A compact string identifying how a seed renders: used for variety checks and look uniqueness. */
export const faceGeneKey = (seed: number): string => faceGenes(seed).parts.join(".") + "~" + faceGenes(seed).tones.join("");

export function drawFaceGenes(g: CanvasRenderingContext2D, seed: number, c: FaceCtx): void {
  const G = faceGenes(seed);
  g.save();
  g.lineCap = "round"; g.lineWidth = Math.max(0.7, c.lw * 0.45);
  for (let i = 0; i < SLOTS.length; i++) {
    const p = G.parts[i];
    if (p) { g.strokeStyle = G.tones[i]; g.fillStyle = G.tones[i]; SLOTS[i][p](g, c, G.tones[i]); }
  }
  g.restore();
}
