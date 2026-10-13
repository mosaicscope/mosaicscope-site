import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { Rng } from "../core/rng";
import { T } from "../world/World";
import { nightness, h2 } from "./NightFX";
import { PAPER, ACID, GOLD, PINK, CYAN, RED } from "./palette";

/**
 * STELLAR: the night sparkles in the site's own language. Neon points in the palette (never a
 * realistic Milky Way, see docs/LOOK.md), a rare shooting star that follows the sim's rare_meteor
 * event, a sagging string of bulbs across the top of the view, a disco glint on the stage, and neon
 * glitter on the lit water. Everything is pure look: it reads the sim and writes nothing.
 */

const SKY_COLS = [PAPER, PAPER, PAPER, ACID, GOLD, PINK, CYAN];
const BULB_COLS = [GOLD, RED, ACID, PINK, CYAN, PAPER];
const GLITTER_COLS = [ACID, PINK, CYAN];
const SKY_COUNT = 220;

interface Star { x: number; y: number; r: number; col: string; ph: number; sp: number; cross: boolean }
interface Meteor { x: number; y: number; vx: number; vy: number; age: number; life: number }

export class StarField {
  /** Positions are fractions of the view, so the field scales with the window. */
  readonly stars: Star[] = [];
  private meteors: Meteor[] = [];
  private rng = new Rng(0x57a7);
  private untilMeteor = 60;
  private pt = { x: 0, y: 0 };

  constructor(sim: Simulation) {
    for (let i = 0; i < SKY_COUNT; i++) {
      this.stars.push({
        x: this.rng.next(), y: this.rng.next() * 0.92,
        r: 0.6 + this.rng.next() * 1.3,
        col: this.rng.pick(SKY_COLS),
        ph: this.rng.next() * 6.283, sp: 0.8 + this.rng.next() * 2.4,
        cross: this.rng.next() < 0.12,
      });
    }
    // the sim already rolls a rare shooting star; when it does, the sky shows one too
    sim.bus.on("event", (e) => { if (e.type === "rare_meteor") this.streak(); });
  }

  /** Sky stars over the night overlay: 'lighter' so they glow through the dark, fading out by day. */
  drawSky(g: CanvasRenderingContext2D, cam: Camera, sim: Simulation, time: number, dt: number, quality: number, reduceMotion: boolean): void {
    if (quality === 0) return;
    const night = nightness(sim.daylight);
    if (night < 0.05) return;
    const W = cam.viewW, H = cam.viewH, t = reduceMotion ? 0 : time;
    const n = quality === 1 ? 90 : this.stars.length;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const s = this.stars[i];
      const a = night * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)));
      if (a < 0.04) continue;
      const x = s.x * W, y = s.y * H;
      g.globalAlpha = a; g.fillStyle = s.col;
      g.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      if (s.cross && quality >= 2) {
        // the brightest few get a four-point glint, drawn as two hairlines
        const L = 2.5 + s.r * 2.2;
        g.globalAlpha = a * 0.6; g.fillRect(x - L, y - 0.3, L * 2, 0.6); g.fillRect(x - 0.3, y - L, 0.6, L * 2);
      }
    }
    if (!reduceMotion && night > 0.3) {
      this.untilMeteor -= dt;
      if (this.untilMeteor <= 0) { this.streak(); this.untilMeteor = 90 + this.rng.next() * 110; }
    }
    this.drawMeteors(g, W, H, dt);
    g.restore();
  }

  /** A shooting star: enters from the top, streaks down-left, fades in under a second. */
  streak(): void {
    if (this.meteors.length > 2) return;
    const x = 0.45 + this.rng.next() * 0.6, y = -0.05 + this.rng.next() * 0.25;
    this.meteors.push({ x, y, vx: -0.55 - this.rng.next() * 0.25, vy: 0.42 + this.rng.next() * 0.2, age: 0, life: 0.7 + this.rng.next() * 0.4 });
  }

  private drawMeteors(g: CanvasRenderingContext2D, W: number, H: number, dt: number): void {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += dt;
      if (m.age >= m.life) { this.meteors.splice(i, 1); continue; }
      const k = m.age / m.life, fade = Math.sin(k * Math.PI);
      const hx = (m.x + m.vx * k) * W, hy = (m.y + m.vy * k) * H;
      const tx = hx - m.vx * 0.22 * W, ty = hy - m.vy * 0.22 * H;
      const grd = g.createLinearGradient(tx, ty, hx, hy);
      grd.addColorStop(0, "rgba(238,228,211,0)");
      grd.addColorStop(1, `rgba(238,228,211,${(0.9 * fade).toFixed(3)})`);
      g.globalAlpha = 1;
      g.strokeStyle = grd; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = `rgba(198,255,61,${fade.toFixed(3)})`;
      g.beginPath(); g.arc(hx, hy, 2, 0, 6.283); g.fill();
    }
  }

  /** Night-only screen pass: a sagging string of bulbs across the top, and a disco glint on the stage. */
  drawNight(g: CanvasRenderingContext2D, sim: Simulation, cam: Camera, time: number, quality: number, reduceMotion: boolean): void {
    if (quality === 0) return;
    const night = nightness(sim.daylight);
    if (night < 0.2) return;
    const W = cam.viewW, H = cam.viewH, t = reduceMotion ? 0 : time;
    g.save();
    g.globalCompositeOperation = "lighter";
    // two strings: the top one dips in the middle, a fainter one sits lower to frame the view
    for (const [y0, sag, spacing, bright] of [[12, 16, 26, 1], [H * 0.36, 10, 44, 0.45]] as const) {
      if (y0 > H) continue;
      g.globalAlpha = 0.28 * night * bright; g.strokeStyle = PAPER; g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= W; x += 6) { const y = y0 + sag * (1 - 4 * (x / W - 0.5) ** 2); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      const n = Math.floor(W / spacing);
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W, y = y0 + sag * (1 - 4 * (i / n - 0.5) ** 2);
        const col = BULB_COLS[(i + Math.floor(t * 2.5)) % BULB_COLS.length];
        const tw = 0.5 + 0.5 * Math.sin(t * 4.2 + i * 1.7 + y0);
        const a = night * bright * (0.45 + 0.55 * tw);
        // soft bloom, then the bulb itself
        g.globalAlpha = a * 0.22; g.fillStyle = col; g.beginPath(); g.arc(x, y, 7, 0, 6.283); g.fill();
        g.globalAlpha = Math.min(1, a + 0.2); g.beginPath(); g.arc(x, y + 2, 2.4, 0, 6.283); g.fill();
      }
    }
    // disco glint: the stage's mirror ball throws little orbiting specks while the night is on
    if (quality >= 2) {
      const sx = sim.stagePoint.x, sy = sim.stagePoint.y;
      cam.toScreen(sx, sy, 2, this.pt);
      const px = this.pt.x, py = this.pt.y;
      if (px > -40 && px < W + 40 && py > -40 && py < H + 40) {
        const R = 10 * cam.zoom + 4;
        for (let k = 0; k < 14; k++) {
          const ang = t * 1.4 + k * (6.283 / 14), rr = R * (0.8 + 0.2 * Math.sin(t * 3 + k));
          const flick = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.1);
          g.globalAlpha = night * (0.35 + 0.65 * flick);
          g.fillStyle = k % 3 === 0 ? PAPER : k % 3 === 1 ? PINK : CYAN;
          g.fillRect(px + Math.cos(ang) * rr - 0.9, py + Math.sin(ang) * rr * 0.55 - 0.9, 1.8, 1.8);
        }
        g.globalAlpha = night * 0.3; g.fillStyle = PAPER;
        g.beginPath(); g.arc(px, py, 3, 0, 6.283); g.fill();
      }
    }
    g.restore();
  }

  /** Neon glitter on the lit water: the shore's sparkle, pushed into the palette at night. */
  drawWater(g: CanvasRenderingContext2D, sim: Simulation, cam: Camera, minX: number, maxX: number, minY: number, maxY: number, time: number, quality: number, reduceMotion: boolean): void {
    if (quality < 2) return;
    const night = nightness(sim.daylight);
    if (night < 0.2) return;
    const S = sim.world.size, tiles = sim.world.tiles, t = reduceMotion ? 0 : time, z = cam.zoom;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (tiles[ty * S + tx] !== T.WATER) continue;
      const seed = h2(tx, ty);
      const ph = Math.sin(t * 2.2 + seed * 40);
      if (ph < 0.82) continue;
      cam.toScreen(tx + seed, ty + 0.5, 0, this.pt);
      g.globalAlpha = night * (ph - 0.82) * 4.5;
      g.fillStyle = GLITTER_COLS[Math.floor(seed * GLITTER_COLS.length * 7) % GLITTER_COLS.length];
      g.fillRect(this.pt.x - 1.2 * z, this.pt.y - 1.2 * z, 2.4 * z, 2.4 * z);
    }
    g.restore();
  }
}
