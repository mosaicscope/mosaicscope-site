import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { TICKS_PER_HOUR } from "../sim/Environment";

/**
 * Night weather dressing, drawn after the lighting pass so it glows through the dark:
 * fog nights with humming streetlights. Pure look: it reads the sim, writes nothing.
 */

/** Cheap deterministic hash in [0,1) from two integers. */
export function h2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 0 in daylight, 1 in the dead of night, with a gradual dusk transition. */
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


export class NightFX {
  private pt = { x: 0, y: 0 };

  draw(g: CanvasRenderingContext2D, sim: Simulation, cam: Camera, time: number, quality: number, reduceMotion: boolean,
    _minX: number, _maxX: number, _minY: number, _maxY: number): void {
    if (quality === 0) return;
    const night = nightness(sim.daylight);
    if (night < 0.05) return;
    const z = cam.zoom;
    const day = Math.floor(sim.tick / (TICKS_PER_HOUR * 24));
    const fog = fogDensity(day, night);
    const W = cam.viewW, H = cam.viewH;
    g.save();
    g.globalCompositeOperation = "lighter";

    // Wet roads retain their ground material; no mood-coloured emissive discs.

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
