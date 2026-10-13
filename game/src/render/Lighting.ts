import type { Simulation } from "../sim/Simulation";
import { TICKS_PER_HOUR } from "../sim/Environment";
import type { Camera } from "./Camera";

/**
 * Time-of-day colour: a golden-hour warm wash around 18:00 and a lighter gold at 06:30, a hazy
 * dawn just after sunrise, and a cool neon wash once it is properly dark. Pure function of the clock.
 */
export interface LightCycle { warm: number; neon: number; haze: number }
export function lightCycle(hour: number, daylight: number): LightCycle {
  const h = ((hour % 24) + 24) % 24;
  const dusk = Math.max(0, 1 - Math.abs(h - 18) / 1.6), dawn = Math.max(0, 1 - Math.abs(h - 6.5) / 1.2);
  const haze = Math.max(0, 1 - Math.abs(h - 6) / 2.2);
  const night = Math.max(0, Math.min(1, (0.45 - daylight) / 0.4));
  return {
    warm: Math.min(0.2, (dusk + dawn * 0.7) * 0.14 * (0.5 + daylight * 0.5)),
    neon: night * 0.12,
    haze: haze * 0.1,
  };
}

/**
 * Night/storm darkness as a low-resolution overlay with holes cut for light sources, plus additive
 * coloured party lights. Low quality skips the gradients and just tints. Overlay resolution scales
 * with the graphics quality setting: crisper light holes on high and ultra, cheaper on low.
 */
export class Lighting {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private scale = 0.25;
  private pt = { x: 0, y: 0 };

  constructor() {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
  }

  draw(main: CanvasRenderingContext2D, sim: Simulation, cam: Camera, time: number, quality: number, reduceMotion: boolean): void {
    const day = sim.daylight;
    let dark = (1 - day) * 0.78 + (sim.env.storm ? 0.18 : sim.env.raining ? 0.08 : 0);
    if (!sim.env.power) dark += 0.12 * (1 - day);
    dark = Math.min(0.9, dark);
    const W = cam.viewW, H = cam.viewH;
    this.scale = quality >= 3 ? 0.4 : quality === 2 ? 0.32 : 0.22;
    // colour grade follows the light cycle (golden hour, dawn haze, neon night); soft-light keeps the neon palette intact
    if (quality > 0) {
      const cyc = lightCycle((sim.tick / TICKS_PER_HOUR) % 24, day);
      if (cyc.warm > 0.005) {
        main.globalCompositeOperation = "soft-light";
        main.fillStyle = `rgba(255,190,120,${cyc.warm})`;
        main.fillRect(0, 0, W, H); main.globalCompositeOperation = "source-over";
      }
      if (cyc.neon > 0.005) {
        main.globalCompositeOperation = "soft-light";
        main.fillStyle = `rgba(120,70,230,${cyc.neon})`;
        main.fillRect(0, 0, W, H); main.globalCompositeOperation = "source-over";
      }
      if (cyc.haze > 0.005) {
        main.fillStyle = `rgba(205,210,225,${cyc.haze})`; main.fillRect(0, 0, W, H);
      }
      if (quality >= 2) {
        const r = Math.hypot(W, H) * 0.55, vg = main.createRadialGradient(W / 2, H / 2, r * 0.55, W / 2, H / 2, r);
        vg.addColorStop(0, "rgba(6,4,14,0)"); vg.addColorStop(1, `rgba(6,4,14,${quality >= 3 ? 0.4 : 0.28})`);
        main.fillStyle = vg; main.fillRect(0, 0, W, H);
      }
    }
    if (dark > 0.02) {
      if (quality === 0) {
        main.fillStyle = `rgba(8,6,22,${dark})`; main.fillRect(0, 0, W, H);
      } else {
        const w = Math.ceil(W * this.scale), h = Math.ceil(H * this.scale);
        if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
        const g = this.g;
        g.globalCompositeOperation = "source-over";
        g.clearRect(0, 0, w, h);
        g.fillStyle = `rgba(8,6,22,${dark})`; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = "destination-out";
        const hole = (x: number, y: number, z: number, r: number, a: number) => {
          cam.toScreen(x, y, z, this.pt);
          const px = this.pt.x * this.scale, py = this.pt.y * this.scale, rr = r * cam.zoom * this.scale;
          if (px < -rr || py < -rr || px > w + rr || py > h + rr) return;
          const grd = g.createRadialGradient(px, py, 0, px, py, rr);
          grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grd; g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill();
        };
        if (sim.env.power) for (const p of sim.world.pois) if (p.kind === "lamp" && p.on) hole(p.x + 0.3, p.y - 0.3, 1.5, 190, 0.95);
        if (sim.env.party) hole(sim.stagePoint.x, sim.stagePoint.y, 0, 300, 0.7);
        const pl = sim.player;
        hole(pl.x, pl.y, 1, 110, 0.55);
        // anyone holding a phone light / fleeing in the dark gets a little glow
        for (const c of sim.chars) if (c.tier === "principal" && c.lod === 0) hole(c.x, c.y, 1, 45, 0.3);
        main.drawImage(this.cv, 0, 0, W, H);
      }
    }
    // coloured party lights (additive)
    if (sim.env.party && quality > 0) {
      main.globalCompositeOperation = "lighter";
      const cols = ["255,122,217", "61,214,255", "198,255,61", "246,182,44"];
      for (let i = 0; i < 4; i++) {
        const a = (reduceMotion ? 0 : time * 0.9) + i * 1.57;
        cam.toScreen(sim.stagePoint.x + Math.cos(a) * 4, sim.stagePoint.y + Math.sin(a) * 4, 0, this.pt);
        const r = 170 * cam.zoom;
        const grd = main.createRadialGradient(this.pt.x, this.pt.y, 0, this.pt.x, this.pt.y, r);
        grd.addColorStop(0, `rgba(${cols[i]},${0.22 * Math.max(0.3, 1 - sim.daylight)})`); grd.addColorStop(1, `rgba(${cols[i]},0)`);
        main.fillStyle = grd; main.fillRect(this.pt.x - r, this.pt.y - r, r * 2, r * 2);
      }
      main.globalCompositeOperation = "source-over";
    }
    // lightning: a soft flash (no strobing; disabled under reduced motion)
    if (!reduceMotion && sim.env.lightningAt >= 0) {
      const age = sim.tick - sim.env.lightningAt;
      if (age >= 0 && age < 18) { main.fillStyle = `rgba(220,230,255,${0.28 * (1 - age / 18)})`; main.fillRect(0, 0, W, H); }
    }
  }
}

/** Screen-space rain streaks, batched into one path. */
export class Rain {
  private drops: Float32Array = new Float32Array(0);
  private n = 0;
  resize(max: number, W: number, H: number): void {
    if (this.drops.length !== max * 3) { this.drops = new Float32Array(max * 3); for (let i = 0; i < max; i++) { this.drops[i * 3] = Math.random() * W; this.drops[i * 3 + 1] = Math.random() * H; this.drops[i * 3 + 2] = 0.6 + Math.random() * 0.4; } }
  }
  draw(g: CanvasRenderingContext2D, intensity: number, W: number, H: number, dt: number, max: number, reduceMotion: boolean): void {
    if (intensity < 0.02) return;
    this.resize(max, W, H);
    this.n = Math.floor(max * intensity);
    const speed = reduceMotion ? 250 : 900;
    g.strokeStyle = "rgba(170,195,240,.32)"; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      this.drops[j + 1] += speed * this.drops[j + 2] * dt; this.drops[j] -= speed * 0.15 * dt;
      if (this.drops[j + 1] > H) { this.drops[j + 1] = -10; this.drops[j] = Math.random() * (W + 100); }
      const x = this.drops[j], y = this.drops[j + 1], l = 14 * this.drops[j + 2];
      g.moveTo(x, y); g.lineTo(x - l * 0.15, y + l);
    }
    g.stroke();
  }
}
