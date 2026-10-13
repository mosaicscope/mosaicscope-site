import type { Character } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { classifyMoment, comicLayout, panelProgress, type Moment, type PanelRect } from "./ArtSecrets";
import { hash01 } from "./noir";

/**
 * Comic-panel view for big moments in the 2D street. When something loud happens near you (a crash, a bust,
 * a caught cheater, a power cut) the street freezes into a three-panel strip across the top of the screen for a
 * few seconds: the scene, a close-up, and the sound word. The sim keeps running underneath and the strip draws
 * on the canvas only, so it never blocks a button or a touch. Reduced motion skips the pop-in.
 */
const DUR = 3.6, COOLDOWN = 22, RANGE = 14, FRESH = 150;
const INK = "#0e0b0a", PAPER = "#eee4d3";   // the site's --ink and --paper (docs/LOOK.md)

interface Shot { m: Moment; caption: string; fx: number; seed: number }

export class ComicView {
  private lastId = -1;
  private cool = 4;
  private t = -1;
  private pending: Shot | null = null;
  private cur: Shot | null = null;
  private snap = document.createElement("canvas");

  get active(): boolean { return this.t >= 0; }
  get armed(): boolean { return this.pending !== null; }

  /** Look at the events that happened since last frame and queue the loudest one near you. `pu` is your lateral position, `S` px per lateral unit. */
  watch(sim: Simulation, f: Character, W: number, pu: number, S: number, dt: number): void {
    const hist = sim.events.history;
    if (this.lastId < 0) { this.lastId = hist.length ? hist[hist.length - 1].id : 0; return; }   // events from before you looked are not news
    this.cool -= dt;
    let best: Shot | null = null, bestRank = 0, top = this.lastId;
    for (let i = hist.length - 1; i >= 0 && hist[i].id > this.lastId; i--) {
      const e = hist[i]; top = Math.max(top, e.id);
      if (sim.tick - e.tick > FRESH || Math.hypot(e.x - f.x, e.y - f.y) > RANGE) continue;
      const m = classifyMoment(e.type, e.severity);
      if (!m || m.rank <= bestRank) continue;
      const tx = W / 2 + ((e.x - e.y) / 1.414 - pu) * S;
      best = { m, caption: e.summary, fx: Math.max(0.12, Math.min(0.88, tx / W)), seed: e.id }; bestRank = m.rank;
    }
    this.lastId = top;
    if (best && this.t < 0 && this.cool <= 0 && !this.pending) this.pending = best;
  }

  /** Once the scene is drawn into the small canvas, freeze a copy of it for the panels. */
  capture(lo: HTMLCanvasElement): void {
    if (!this.pending) return;
    this.snap.width = lo.width; this.snap.height = lo.height;
    this.snap.getContext("2d")!.drawImage(lo, 0, 0);
    this.cur = this.pending; this.pending = null; this.t = 0;
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, dt: number, reduceMotion: boolean): void {
    const shot = this.cur; if (this.t < 0 || !shot) return;
    this.t += dt;
    if (this.t > DUR) { this.t = -1; this.cur = null; this.cool = COOLDOWN; return; }
    const panels = comicLayout(W, H);
    g.save();
    for (let i = 0; i < panels.length; i++) {
      const { pop, fade } = panelProgress(i, this.t, DUR);
      if (pop <= 0) continue;
      const p = panels[i], k = reduceMotion ? 1 : 0.86 + 0.14 * (1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2);
      g.globalAlpha = (reduceMotion ? 1 : Math.min(1, pop * 1.6)) * fade;
      g.save(); g.translate(p.x + p.w / 2, p.y + p.h / 2); g.scale(k, k); g.translate(-p.x - p.w / 2, -p.y - p.h / 2);
      this.panel(g, p, i, shot);
      g.restore();
    }
    g.restore();
  }

  private shape(g: CanvasRenderingContext2D, p: PanelRect, grow = 0): void {
    g.beginPath(); g.moveTo(p.x + p.slant - grow, p.y - grow); g.lineTo(p.x + p.w + grow, p.y - grow); g.lineTo(p.x + p.w - p.slant + grow, p.y + p.h + grow); g.lineTo(p.x - grow, p.y + p.h + grow); g.closePath();
  }

  private panel(g: CanvasRenderingContext2D, p: PanelRect, i: number, s: Shot): void {
    g.save();
    g.fillStyle = PAPER; this.shape(g, p, 2.5); g.fill();
    this.shape(g, p); g.clip();
    g.fillStyle = INK; g.fillRect(p.x, p.y, p.w, p.h);
    if (i < 2) this.scene(g, p, s, i === 0 ? 0.62 : 0.3, i === 0 ? 0.58 : 0.7);
    else this.burst(g, p, s);
    if (i === 1) { this.speedLines(g, p, s.seed); this.halftone(g, p, "rgba(236,42,28,.6)", 9, 1); }
    if (i === 0) this.captionBox(g, p, s.caption);
    g.restore();
  }

  /** A window onto the frozen street: `hFrac` of its height, centred on `cy`, and horizontally on the action. */
  private scene(g: CanvasRenderingContext2D, p: PanelRect, s: Shot, hFrac: number, cy: number): void {
    const SW = this.snap.width, SH = this.snap.height; if (!SW || !SH) return;
    const sh = SH * hFrac, sw = Math.min(SW, sh * (p.w / p.h)), sy = Math.max(0, Math.min(SH - sh, SH * cy - sh / 2)), sx = Math.max(0, Math.min(SW - sw, SW * s.fx - sw / 2));
    g.imageSmoothingEnabled = false; g.drawImage(this.snap, sx, sy, sw, sh, p.x, p.y, p.w, p.h); g.imageSmoothingEnabled = true;
  }

  private captionBox(g: CanvasRenderingContext2D, p: PanelRect, text: string): void {
    g.font = "600 11px 'IBM Plex Mono', monospace"; g.textAlign = "left";
    const maxW = p.w - p.slant - 22, words = text.slice(0, 90).split(" "), lines: string[] = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line); if (lines.length > 3) lines.length = 3;
    const bw = Math.min(maxW + 12, Math.max(...lines.map((l) => g.measureText(l).width)) + 14), bh = lines.length * 14 + 8, bx = p.x + p.slant + 4, by = p.y + 5;
    g.fillStyle = "#f6b62c"; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2); g.fillStyle = INK; g.fillRect(bx, by, bw, bh);
    g.fillStyle = PAPER; lines.forEach((l, n) => g.fillText(l, bx + 7, by + 15 + n * 14));
  }

  private halftone(g: CanvasRenderingContext2D, p: PanelRect, color: string, step: number, dir: number): void {
    g.fillStyle = color; g.beginPath();
    for (let yy = p.y + step / 2, row = 0; yy < p.y + p.h; yy += step * 0.87, row++) {
      for (let xx = p.x + (row % 2) * step / 2; xx < p.x + p.w; xx += step) {
        const t = dir > 0 ? (xx - p.x) / p.w : 1 - (xx - p.x) / p.w, r = step * 0.46 * t * t;
        if (r > 0.5) { g.moveTo(xx + r, yy); g.arc(xx, yy, r, 0, 6.283); }
      }
    }
    g.fill();
  }

  private speedLines(g: CanvasRenderingContext2D, p: PanelRect, seed: number): void {
    g.strokeStyle = "rgba(18,13,22,.5)"; g.lineWidth = 1.4; g.beginPath();
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.62;
    for (let n = 0; n < 22; n++) {
      const a = (n / 22) * 6.283 + hash01(seed * 7 + n) * 0.2, r0 = Math.min(p.w, p.h) * (0.42 + hash01(seed + n) * 0.1), r1 = r0 + 14 + hash01(seed * 3 + n) * 26;
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
    }
    g.stroke();
  }

  private burst(g: CanvasRenderingContext2D, p: PanelRect, s: Shot): void {
    const m = s.m, cx = p.x + p.w / 2 + p.slant * 0.1, cy = p.y + p.h / 2, R = Math.min(p.w * 0.5, p.h * 0.56);
    g.fillStyle = INK; g.fillRect(p.x, p.y, p.w, p.h);
    this.halftone(g, p, m.hue + "66", 8, -1);
    const n = 18; g.beginPath();
    for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * 6.283, r = k % 2 ? R * 0.66 : R * (0.9 + hash01(s.seed * 13 + k) * 0.25); g.lineTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 0.9); }
    g.closePath(); g.shadowColor = m.hue; g.shadowBlur = 14; g.fillStyle = m.hue; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = PAPER; g.lineWidth = 2.5; g.stroke();
    let size = 52; g.textAlign = "center";
    do { g.font = `900 italic ${size}px 'Big Shoulders Display', Impact, sans-serif`; size -= 2; } while (g.measureText(m.word).width > Math.min(R * 1.9, p.w * 0.78) && size > 14);
    g.save(); g.translate(cx, cy + size * 0.35); g.rotate(-0.1);
    g.lineJoin = "round"; g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(m.word, 0, 0); g.fillStyle = INK; g.fillText(m.word, 0, 0);
    g.restore();
    g.font = "700 11px 'IBM Plex Mono', monospace"; g.fillStyle = PAPER; g.fillText(m.verb.toUpperCase(), p.x + p.w / 2, p.y + p.h - 9);
  }
}
