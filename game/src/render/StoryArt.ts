import type { Pigeon } from "../sim/Stories";
import { INK, PAPER, GOLD, PINK, CYAN, ACID, RED } from "./palette";
import { Z_PX } from "../world/iso";

/**
 * Hand-drawn props for the street stories (sim/Stories.ts): the fortune-teller's booth, the rooftop
 * coop with its ladder and flags, pigeons, and the glint of a dropped coin. Everything is drawn at a
 * ground point (sx, sy) in screen space; `z` is the camera zoom.
 */
const T = 6.2832;
export const FLAG_COLOURS = [RED, GOLD, CYAN, PINK, ACID, PAPER];

/** The fortune booth: plum cabin, striped awning, a glowing crystal ball and a little sign. */
export function drawKiosk(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, time: number, dark: number): void {
  const u = z * 1.25;
  g.fillStyle = "rgba(0,0,0,.32)"; g.beginPath(); g.ellipse(sx, sy + 2 * u, 19 * u, 7 * u, 0, 0, T); g.fill();
  // cabin
  g.fillStyle = "#3b1d4a"; g.fillRect(sx - 14 * u, sy - 27 * u, 28 * u, 28 * u);
  g.fillStyle = "#2a1235"; g.fillRect(sx - 14 * u, sy - 27 * u, 4 * u, 28 * u);
  g.fillStyle = "#1a0b22"; g.fillRect(sx - 10 * u, sy - 22 * u, 20 * u, 14 * u);
  g.strokeStyle = GOLD; g.lineWidth = 1.4 * u; g.strokeRect(sx - 10 * u, sy - 22 * u, 20 * u, 14 * u);
  // counter
  g.fillStyle = "#5a2f6b"; g.fillRect(sx - 15 * u, sy - 8 * u, 30 * u, 4 * u);
  // awning
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? PAPER : PINK;
    g.beginPath(); g.moveTo(sx - 16 * u + i * 5.33 * u, sy - 36 * u); g.lineTo(sx - 16 * u + (i + 1) * 5.33 * u, sy - 36 * u);
    g.lineTo(sx - 17 * u + (i + 1) * 5.67 * u, sy - 27 * u); g.lineTo(sx - 17 * u + i * 5.67 * u, sy - 27 * u); g.closePath(); g.fill();
  }
  // crystal ball
  const glow = 0.55 + Math.sin(time * 2.2) * 0.2 + dark * 0.3;
  const bx = sx, by = sy - 14 * u;
  const grad = g.createRadialGradient(bx - 1.5 * u, by - 1.5 * u, 0.5 * u, bx, by, 6 * u);
  grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.5, CYAN); grad.addColorStop(1, "#5a3fa8");
  g.globalAlpha = Math.min(1, glow + 0.3); g.fillStyle = grad; g.beginPath(); g.arc(bx, by, 5 * u, 0, T); g.fill(); g.globalAlpha = 1;
  g.fillStyle = "#7a4a1d"; g.fillRect(bx - 3 * u, by + 4.5 * u, 6 * u, 2 * u);
  // twinkles
  for (let i = 0; i < 3; i++) {
    const a = time * 1.4 + i * 2.1, k = (Math.sin(a * 3) + 1) / 2;
    g.fillStyle = `rgba(255,236,170,${0.25 + k * 0.6})`;
    const tx = sx + Math.cos(a) * 15 * u, ty = sy - 40 * u + Math.sin(a * 1.3) * 5 * u;
    g.fillRect(tx - 0.7 * u, ty - 2 * u, 1.4 * u, 4 * u); g.fillRect(tx - 2 * u, ty - 0.7 * u, 4 * u, 1.4 * u);
  }
  // sign
  g.fillStyle = INK; g.fillRect(sx - 12 * u, sy - 46 * u, 24 * u, 8 * u);
  g.fillStyle = GOLD; g.font = `700 ${5.4 * u}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("FORTUNES", sx, sy - 42 * u);
}

/** A ladder up the wall: two rails and rungs from the pavement to the roof edge. */
export function drawLadder(g: CanvasRenderingContext2D, bx: number, by: number, tx: number, ty: number, z: number): void {
  const rail = Math.max(1, 1.6 * z);
  g.lineCap = "round";
  g.strokeStyle = "#8a6a45"; g.lineWidth = rail;
  const off = 4 * z;
  for (const o of [-off, off]) { g.beginPath(); g.moveTo(bx + o, by); g.lineTo(tx + o, ty); g.stroke(); }
  g.strokeStyle = "#b8935f"; g.lineWidth = rail * 0.8;
  const n = Math.max(3, Math.round(Math.hypot(tx - bx, ty - by) / (9 * z)));
  for (let i = 1; i < n; i++) { const k = i / n; g.beginPath(); g.moveTo(bx - off + (tx - bx) * k, by + (ty - by) * k); g.lineTo(bx + off + (tx - bx) * k, by + (ty - by) * k); g.stroke(); }
}

/** The rooftop coop at roof point (sx, sy): a wooden hut, perch rail, a feeder and a string of pennants. */
export function drawCoop(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, flags: number, time: number, fed: boolean): void {
  const u = z * 1.1;
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(sx, sy + 1 * u, 17 * u, 6 * u, 0, 0, T); g.fill();
  // hut
  g.fillStyle = "#a07a4b"; g.fillRect(sx - 11 * u, sy - 14 * u, 22 * u, 14 * u);
  g.fillStyle = "#7d5c35"; g.fillRect(sx - 11 * u, sy - 14 * u, 3 * u, 14 * u);
  g.strokeStyle = "#5e4326"; g.lineWidth = 0.8 * u;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(sx - 11 * u, sy - i * 3.5 * u); g.lineTo(sx + 11 * u, sy - i * 3.5 * u); g.stroke(); }
  // door hole
  g.fillStyle = "#1a120b"; g.beginPath(); g.arc(sx + 2 * u, sy - 6 * u, 3.6 * u, Math.PI, 0); g.lineTo(sx + 5.6 * u, sy); g.lineTo(sx - 1.6 * u, sy); g.closePath(); g.fill();
  // pitched roof
  g.fillStyle = "#c2523b"; g.beginPath(); g.moveTo(sx - 14 * u, sy - 14 * u); g.lineTo(sx, sy - 24 * u); g.lineTo(sx + 14 * u, sy - 14 * u); g.closePath(); g.fill();
  g.strokeStyle = "#7a2f20"; g.lineWidth = 1 * u; g.stroke();
  // perch rail + feeder
  g.strokeStyle = "#d9c9a6"; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(sx + 11 * u, sy - 5 * u); g.lineTo(sx + 20 * u, sy - 5 * u); g.stroke();
  g.fillStyle = fed ? GOLD : "#6a5a44"; g.fillRect(sx - 18 * u, sy - 3 * u, 6 * u, 3 * u);
  // pennants on a string from the roof peak to a pole
  const px = sx + 24 * u, py = sy - 16 * u;
  g.strokeStyle = "#cbbfa6"; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(px, py); g.lineTo(px, sy); g.stroke();
  g.strokeStyle = "rgba(238,228,211,.7)"; g.lineWidth = 0.7 * u;
  g.beginPath(); g.moveTo(sx, sy - 24 * u); g.quadraticCurveTo((sx + px) / 2, sy - 18 * u, px, py); g.stroke();
  for (let i = 0; i < flags; i++) {
    const k = (i + 1) / (flags + 1), x = sx + (px - sx) * k, y = (1 - k) * (1 - k) * (sy - 24 * u) + 2 * k * (1 - k) * (sy - 18 * u) + k * k * py;
    const sway = Math.sin(time * 3 + i) * 0.8 * u;
    g.fillStyle = FLAG_COLOURS[i % FLAG_COLOURS.length];
    g.beginPath(); g.moveTo(x - 1.6 * u, y); g.lineTo(x + 1.6 * u, y); g.lineTo(x + sway, y + 5 * u); g.closePath(); g.fill();
  }
}

/** A pigeon. `air` is its height in world units; wings beat when it flies. Pets wear a little pink scarf. */
export function drawPigeon(g: CanvasRenderingContext2D, b: Pigeon, sx: number, sy: number, z: number, time: number, showName: boolean): void {
  const air = b.z * Z_PX * z, u = z * 1.15;
  const fx = Math.cos(b.face) - Math.sin(b.face), dir = fx >= 0 ? 1 : -1;
  if (b.z < 1.6) { g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sx, sy + 1 * u, (4.4 - Math.min(2, air / (12 * z))) * u, 1.8 * u, 0, 0, T); g.fill(); }
  const y = sy - air - 3.2 * u, peck = b.mode === "peck" ? Math.max(0, Math.sin(time * 9 + b.id * 1.7)) : 0;
  const flying = b.mode === "fly", beat = flying ? Math.sin(b.flap) : 0;
  g.save(); g.translate(sx, y); g.scale(dir, 1);
  // tail, body
  g.fillStyle = "#6c7480"; g.beginPath(); g.moveTo(-3.6 * u, 0); g.lineTo(-7 * u, 1.2 * u + peck * u); g.lineTo(-6.4 * u, -1.6 * u + peck * u); g.closePath(); g.fill();
  g.fillStyle = "#97a0ad"; g.beginPath(); g.ellipse(0, 0, 4.4 * u, 3 * u, peck * 0.35, 0, T); g.fill();
  // wing
  g.fillStyle = "#6c7480"; g.beginPath(); g.ellipse(-0.6 * u, -0.6 * u - beat * 2.6 * u, 3.2 * u, flying ? 1.1 * u + Math.abs(beat) * 1.4 * u : 1.6 * u, -0.25 - beat * 0.7, 0, T); g.fill();
  if (flying) { g.beginPath(); g.ellipse(-0.6 * u, -0.6 * u - beat * 2.6 * u, 3.2 * u, 1.1 * u, 0.25 + beat * 0.7, 0, T); g.fill(); }
  // head: dips when pecking
  const hx = 3.6 * u + peck * 1.2 * u, hy = -2.4 * u + peck * 4.2 * u;
  g.fillStyle = "#5b6370"; g.beginPath(); g.arc(hx, hy, 2.1 * u, 0, T); g.fill();
  g.fillStyle = "#58c79b"; g.beginPath(); g.ellipse(hx - 1.4 * u, hy + 1.6 * u, 1.6 * u, 1.1 * u, 0.4, 0, T); g.fill();
  g.fillStyle = "#f2a141"; g.beginPath(); g.moveTo(hx + 1.9 * u, hy - 0.2 * u); g.lineTo(hx + 4 * u, hy + 0.5 * u); g.lineTo(hx + 1.9 * u, hy + 1 * u); g.closePath(); g.fill();
  g.fillStyle = "#ffcf5a"; g.beginPath(); g.arc(hx + 0.9 * u, hy - 0.5 * u, 0.6 * u, 0, T); g.fill();
  if (b.pet) { g.strokeStyle = PINK; g.lineWidth = 1.3 * u; g.beginPath(); g.moveTo(hx - 1.6 * u, hy + 1.8 * u); g.lineTo(hx - 0.2 * u, hy + 2.6 * u); g.stroke(); }
  // legs
  if (!flying) { g.strokeStyle = "#e0866b"; g.lineWidth = 0.9 * u; g.beginPath(); g.moveTo(-0.8 * u, 2.6 * u); g.lineTo(-0.8 * u, 3.4 * u + Math.sin(b.flap * 1.3) * 0.5 * u); g.moveTo(1 * u, 2.6 * u); g.lineTo(1 * u, 3.4 * u - Math.sin(b.flap * 1.3) * 0.5 * u); g.stroke(); }
  g.restore();
  if (showName && b.pet) {
    g.font = `600 ${7.5 * z}px sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.lineWidth = 2.4 * z; g.strokeStyle = "rgba(14,11,10,.8)"; g.strokeText(b.name, sx, y - 9 * u); g.fillStyle = PINK; g.fillText(b.name, sx, y - 9 * u);
  }
}

/** A coin purse glinting on the ground. */
export function drawDrop(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, time: number): void {
  const u = z * 1.4, k = (Math.sin(time * 4) + 1) / 2;
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(sx, sy + 1 * u, 4.5 * u, 1.9 * u, 0, 0, T); g.fill();
  g.fillStyle = "#e7b73a"; g.beginPath(); g.ellipse(sx, sy - 1 * u, 3.4 * u, 2.2 * u, 0, 0, T); g.fill();
  g.strokeStyle = "#a87a14"; g.lineWidth = 0.9 * u; g.stroke();
  g.fillStyle = `rgba(255,248,200,${0.35 + k * 0.6})`;
  g.fillRect(sx - 0.6 * u, sy - 8 * u, 1.2 * u, 5 * u); g.fillRect(sx - 2.5 * u, sy - 6.2 * u, 5 * u, 1.2 * u);
}
