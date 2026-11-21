/**
 * What is in someone's system shows on their face. The simulation sets a small state per look (Health.ts) and the stick-figure
 * head reads it each frame: bloodshot eyes, huge or pinpoint pupils, heavy lids, sweat, a grey pallor, dark circles. Transient:
 * never saved.
 */
export interface FaceState { red: number; pupil: number; lids: number; sweat: number; pale: number; dark: number; wide: number }
export const faceStates = new WeakMap<object, FaceState>();
export const NO_FACE: FaceState = { red: 0, pupil: 0, lids: 0, sweat: 0, pale: 0, dark: 0, wide: 0 };

type G = CanvasRenderingContext2D;
export function drawDrugFace(g: G, s: FaceState, c: { x: number; y: number; k: number; fx: number; ey: number; my: number; rx: number; ry: number; alpha: number; skin: string; covered: boolean }): void {
  const { k, fx, ey, rx, ry } = c, sides = [-4.4 * k, 4.4 * k];
  g.save();
  if (s.pale > 0.05) { g.globalAlpha = c.alpha * Math.min(0.32, s.pale * 0.34); g.fillStyle = "#9fb0a4"; g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, 6.283); g.fill(); }
  if (s.dark > 0.05) { g.globalAlpha = c.alpha * Math.min(0.6, s.dark * 0.6); g.fillStyle = "#3a2a4a"; for (const o of sides) { g.beginPath(); g.ellipse(fx + o, ey + 3.6 * k, 2.8 * k, 1.1 * k, 0, 0, 6.283); g.fill(); } }
  if (!c.covered) {
    if (s.red > 0.05) { g.globalAlpha = c.alpha * Math.min(0.9, 0.3 + s.red); g.strokeStyle = "#e0493c"; g.lineWidth = Math.max(0.5, k * 0.28); for (const o of sides) { for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; g.beginPath(); g.moveTo(fx + o + Math.cos(a) * 1.1 * k, ey + Math.sin(a) * 1.1 * k); g.lineTo(fx + o + Math.cos(a) * 2.5 * k, ey + Math.sin(a) * 2.2 * k); g.stroke(); } } }
    if (Math.abs(s.pupil) > 0.08 || s.wide > 0.05) {   // pinpoint or blown pupils; wide, staring eyes when paranoid
      const r = Math.max(0.35, 0.95 + s.pupil * 0.75 + s.wide * 0.4) * k; g.globalAlpha = c.alpha; g.fillStyle = "#0a0808";
      for (const o of sides) { g.beginPath(); g.arc(fx + o, ey, r, 0, 6.283); g.fill(); }
    }
    if (s.lids > 0.1) { g.globalAlpha = c.alpha; g.fillStyle = c.skin; for (const o of sides) { g.beginPath(); g.ellipse(fx + o, ey - 0.5 * k, 2.4 * k, Math.min(2.2, 0.6 + s.lids * 1.6) * k, 0, Math.PI, 6.283); g.fill(); g.strokeStyle = "#2a1f1f"; g.lineWidth = Math.max(0.5, k * 0.3); g.beginPath(); g.moveTo(fx + o - 2.2 * k, ey + (s.lids - 0.1) * 0.6 * k); g.lineTo(fx + o + 2.2 * k, ey + (s.lids - 0.1) * 0.6 * k); g.stroke(); } }
  }
  if (s.sweat > 0.1) { g.globalAlpha = c.alpha * 0.85; g.fillStyle = "#bfe6ff"; const n = 2 + Math.round(s.sweat * 3); for (let i = 0; i < n; i++) { const px = c.x + (i - n / 2) * 2.6 * k + ((i * 7) % 3) * 0.4 * k, py = c.y - ry * 0.7 + (i % 2) * 2.4 * k; g.beginPath(); g.ellipse(px, py, 0.55 * k, 0.9 * k, 0, 0, 6.283); g.fill(); } }
  g.restore();
}
