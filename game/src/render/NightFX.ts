import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { T } from "../world/World";
import { TICKS_PER_HOUR } from "../sim/Environment";

/**
 * Night weather dressing, drawn after the lighting pass so it glows through the dark:
 * mood-coloured neon puddles in the rain, fog nights with humming streetlights, a lantern river on
 * and the canal. Pure look: it reads the sim, writes nothing.
 */

/** Cheap deterministic hash in [0,1) from two integers. */
export function h2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 0 in daylight, 1 in the dead of night; dusk ramps in so lanterns come out as the sun goes. */
export function nightness(daylight: number): number { return Math.max(0, Math.min(1, (0.6 - daylight) / 0.45)); }

/** Fog density 0..1 for a given game day and darkness: roughly one night in three is foggy. */
export function fogDensity(day: number, night: number): number {
  const roll = h2(day, 77);
  if (roll > 0.36) return 0;
  return night * (0.45 + 0.55 * (roll / 0.36));
}

/** Mood -1..1 -> a neon hue: cold violet when low, through teal and lime, to hot pink when happy. */
export function moodHue(mood: number): number {
  const m = Math.max(-1, Math.min(1, mood));
  return (250 + (m + 1) * 55) % 360;
}

/** 0..1 pulse on the beat (84 bpm), sharpened so it thumps instead of breathing. */
export function beatPulse(time: number): number {
  const s = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 1.4);
  return s * s * s;
}

const LANTERN_COLS = ["255,170,70", "255,110,150", "255,220,120", "150,230,255"];

export class NightFX {
  private pt = { x: 0, y: 0 };

  draw(g: CanvasRenderingContext2D, sim: Simulation, cam: Camera, time: number, quality: number, reduceMotion: boolean,
    minX: number, maxX: number, minY: number, maxY: number): void {
    if (quality === 0) return;
    const night = nightness(sim.daylight);
    if (night < 0.05) return;
    const S = sim.world.size, tiles = sim.world.tiles, z = cam.zoom;
    const t = reduceMotion ? 0 : time;
    const day = Math.floor(sim.tick / (TICKS_PER_HOUR * 24));
    const fog = fogDensity(day, night);
    const W = cam.viewW, H = cam.viewH;
    g.save();
    g.globalCompositeOperation = "lighter";

    // Wet roads retain their ground material; no mood-coloured emissive discs.

    // lantern river: little paper lanterns drifting down the water, with a soft reflection under each
    if (z > 0.5) {
      let n = 0;
      for (let ty = minY; ty <= maxY && n < 70; ty++) for (let tx = minX; tx <= maxX && n < 70; tx++) {
        if (tiles[ty * S + tx] !== T.WATER) continue;
        const h = h2(tx + 91, ty);
        if (h > 0.22) continue;
        // drift along the iso x axis, wrapping inside a 3 tile run so the lantern stays near its tile
        const run = (t * 0.28 + h * 30) % 3;
        const wx = tx - 1 + run, wy = ty + 0.5 + Math.sin(t * 0.7 + h * 20) * 0.12;
        if (tiles[Math.floor(wy) * S + Math.floor(wx)] !== T.WATER) continue;
        const edge = Math.min(run, 3 - run, 1); // fade in/out at the ends of the run
        cam.toScreen(wx, wy, 0.15, this.pt);
        if (this.pt.x < -40 || this.pt.y < -40 || this.pt.x > W + 40 || this.pt.y > H + 40) continue;
        n++;
        const col = LANTERN_COLS[Math.floor(h * 400) % LANTERN_COLS.length];
        const a = night * edge, r = 3.2 * z;
        const bob = Math.sin(t * 2 + h * 50) * 0.6 * z;
        g.fillStyle = `rgba(${col},${0.16 * a})`; g.beginPath(); g.arc(this.pt.x, this.pt.y + bob, r * 4, 0, 6.283); g.fill();
        g.fillStyle = `rgba(${col},${0.85 * a})`; g.beginPath(); g.ellipse(this.pt.x, this.pt.y + bob, r, r * 1.25, 0, 0, 6.283); g.fill();
        g.fillStyle = `rgba(${col},${0.3 * a})`; g.beginPath(); g.ellipse(this.pt.x, this.pt.y + r * 3 + bob, r * 0.8, r * 2.6, 0, 0, 6.283); g.fill();
      }
    }

    // fog night: streetlights wear a humming halo
    if (fog > 0.05 && sim.env.power) {
      const hum = reduceMotion ? 1 : 0.88 + 0.12 * Math.sin(time * 6.3);
      for (const p of sim.world.pois) {
        if (p.kind !== "lamp" || !p.on) continue;
        cam.toScreen(p.x, p.y, 1.6, this.pt);
        if (this.pt.x < -90 || this.pt.y < -90 || this.pt.x > W + 90 || this.pt.y > H + 90) continue;
        const r = 52 * z * (0.8 + fog * 0.5);
        const grd = g.createRadialGradient(this.pt.x, this.pt.y, 0, this.pt.x, this.pt.y, r);
        grd.addColorStop(0, `rgba(255,214,150,${0.5 * fog * hum})`); grd.addColorStop(1, "rgba(255,214,150,0)");
        g.fillStyle = grd; g.fillRect(this.pt.x - r, this.pt.y - r, r * 2, r * 2);
      }
    }
    g.restore();

    // fog itself: a cool veil that thickens away from the player, so far figures turn to silhouettes
    if (fog > 0.05) {
      cam.toScreen(sim.player.x, sim.player.y, 0, this.pt);
      const r0 = 90 * z + 40, r1 = Math.hypot(W, H) * 0.55;
      const grd = g.createRadialGradient(this.pt.x, this.pt.y, r0, this.pt.x, this.pt.y, r1);
      grd.addColorStop(0, "rgba(110,125,160,0)"); grd.addColorStop(1, `rgba(110,125,160,${0.2 * fog})`);
      g.fillStyle = grd; g.fillRect(0, 0, W, H);

    }
  }
}
