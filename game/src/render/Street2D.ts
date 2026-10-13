import type { Character } from "../entities/types";
import { dressOf } from "../mind/Dress";
import type { Simulation } from "../sim/Simulation";
import { pose, solve, J } from "./StickFigure";

/**
 * The 2D street view, dressed like a gritty hand-drawn pixel-art brawler: a brick alley at dusk,
 * cobbles, bins, cans and puddles, lamp light pooling in the murk, thick-outlined chunky people.
 * The scene is drawn small and blown up with smoothing off, which gives the chunky pixels for free
 * and keeps it cheap on phones.
 *
 * Who is on screen is decided by `StreetCast` (pure, tested). People used to vanish because the
 * old filter was a hard +/-1.6 band across the street plus a nearest-7 cut; anyone strolling off
 * that band, or the 8th nearest, simply popped out of existence. The cast now has a wide band, a
 * soft fade at its edge, hysteresis on the cap and smoothed positions.
 */

// ------------------------------------------------------------------ who is on screen (pure)
export interface CastChar { id: number; x: number; y: number; inside: number; inCar: number }
export interface CastSlot { id: number; x: number; dv: number; alpha: number }

/** Depth (iso x+y) either side of the focus that still counts as "on this street". */
export const BAND_FULL = 2.6;
export const BAND_OUT = 5;
const HYST = 1.6;   // a person already on screen counts this much closer than they are, so the cap never flickers
const MIN_GAP_K = 56;

export class StreetCast {
  private shown = new Set<number>();
  private sx = new Map<number, number>();

  /** Choose and lay out the people to draw. `pv` is the focus's depth (x+y), `pu` its lateral position, `S` px per lateral unit. */
  pick(chars: readonly CastChar[], focus: CastChar, W: number, S: number, k: number, dt: number, max: number): CastSlot[] {
    const pu = (focus.x - focus.y) / 1.414, pv = focus.x + focus.y;
    const cand: { c: CastChar; dv: number; tx: number; score: number }[] = [];
    for (const c of chars) {
      const isF = c.id === focus.id;
      if (!isF && (c.inside >= 0 || c.inCar >= 0)) continue;
      const dv = (c.x + c.y) - pv;
      if (!isF && Math.abs(dv) >= BAND_OUT) continue;
      const tx = W / 2 + ((c.x - c.y) / 1.414 - pu) * S;
      if (!isF && Math.abs(tx - W / 2) > W * 0.7) continue;
      const dist = Math.hypot(c.x - focus.x, c.y - focus.y);
      cand.push({ c, dv, tx, score: isF ? -1e9 : dist - (this.shown.has(c.id) ? HYST : 0) });
    }
    cand.sort((a, b) => a.score - b.score || a.c.id - b.c.id);
    const take = cand.slice(0, max);
    // keep everyone at least a body-width apart (the focus stays put)
    take.sort((a, b) => a.tx - b.tx || a.c.id - b.c.id);
    const gapMin = MIN_GAP_K * k;
    const fi = take.findIndex((t) => t.c.id === focus.id);
    for (let i = (fi < 0 ? 1 : fi + 1); i < take.length; i++) take[i].tx = Math.max(take[i].tx, take[i - 1].tx + gapMin);
    for (let i = (fi < 0 ? -1 : fi - 1); i >= 0; i--) take[i].tx = Math.min(take[i].tx, take[i + 1].tx - gapMin);
    const ease = 1 - Math.exp(-dt * 12);
    const out: CastSlot[] = [], now = new Set<number>();
    for (const t of take) {
      const id = t.c.id, prev = this.sx.get(id);
      const x = prev === undefined || Math.abs(prev - t.tx) > W ? t.tx : prev + (t.tx - prev) * ease;
      this.sx.set(id, x); now.add(id);
      const a = Math.abs(t.dv);
      out.push({ id, x, dv: t.dv, alpha: a <= BAND_FULL ? 1 : Math.max(0.15, (BAND_OUT - a) / (BAND_OUT - BAND_FULL)) });
    }
    for (const id of [...this.sx.keys()]) if (!now.has(id)) this.sx.delete(id);
    this.shown = now;
    return out.sort((a, b) => a.dv - b.dv || a.id - b.id); // far to near, so nearer people overdraw
  }
}

// ------------------------------------------------------------------ drawing
const INK = "#120a0c";
const SKIN = ["#e8b48a", "#d99a6c", "#b97a52", "#8a5a3a", "#f0c8a0"];
const hash = (n: number): number => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const rgb = (hex: string, m: number): string => { const v = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, ((v >> 16) & 255) * m) | 0},${Math.min(255, ((v >> 8) & 255) * m) | 0},${Math.min(255, (v & 255) * m) | 0})`; };

export class StreetView {
  readonly cast = new StreetCast();
  private lo = document.createElement("canvas");
  private bricks: HTMLCanvasElement | null = null;

  /** Returns true when it drew; `dest` is the visible canvas context (already scaled to CSS px). */
  draw(dest: CanvasRenderingContext2D, dpr: number, sim: Simulation, f: Character, W: number, H: number, zoom: number, dt: number, time: number, poseName: (c: Character, moving: boolean, spd: number) => string): void {
    const pix = W < 700 ? 2 : 3;
    const lw = Math.ceil(W / pix), lh = Math.ceil(H / pix);
    if (this.lo.width !== lw || this.lo.height !== lh) { this.lo.width = lw; this.lo.height = lh; }
    const g = this.lo.getContext("2d")!;
    g.setTransform(1 / pix, 0, 0, 1 / pix, 0, 0);       // draw in CSS px, land on a small grid
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.lineCap = "round"; g.lineJoin = "round";
    const pu = (f.x - f.y) / 1.414, pv = f.x + f.y;
    const S = 18 * (zoom - 1.2), ground = H * 0.66, day = sim.daylight, night = 1 - Math.min(1, day * 1.3);
    const rain = sim.env.raining;
    this.backdrop(g, sim, W, pu, pv, S, ground, day, time);
    this.wall(g, W, H, pu * S, ground, night, time);
    this.cobbles(g, W, H, pu * S, ground, night, rain, time);
    // night falls over the set; lamps then burn through it
    if (night > 0.05) { g.fillStyle = `rgba(10,6,22,${0.5 * night})`; g.fillRect(0, 0, W, H); }
    this.lamps(g, W, pu * S, ground, night, time);
    // people
    const kk = 1 + (zoom - 3) * 0.3;
    const slots = this.cast.pick(sim.chars, f, W, S, kk, dt, W < 700 ? 8 : 11);
    const drawn: { c: Character; x: number; y: number; k: number; dv: number }[] = [];
    for (const s of slots) {
      const c = sim.chars[s.id]; if (!c) continue;
      const k = kk * c.look.scale * (1 + s.dv * 0.035), sy = ground + H * 0.1 + s.dv * 6;
      const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.0005, spd = Math.hypot(c.x - c.px, c.y - c.py) * 60;
      c.anim.phase += spd * dt * 5.5;
      const dir = (Math.cos(c.facing) - Math.sin(c.facing)) >= 0 ? 1 : -1;
      g.globalAlpha = s.alpha * 0.4; g.fillStyle = "#000"; g.beginPath(); g.ellipse(s.x, sy, 20 * k, 5 * k, 0, 0, 6.283); g.fill();
      g.globalAlpha = s.alpha;
      solve(pose(poseName(c, moving, spd), c.style, time + c.seedPhase, c.anim.phase, spd, c.anim.poseT), s.x, sy, k, dir);
      this.brawler(g, c, k, dir, c.anim.flash > 0);
      g.globalAlpha = 1;
      drawn.push({ c, x: s.x, y: sy, k, dv: s.dv });
    }
    // grime and mood over the top: dark corners, warm smoke
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.28, W / 2, H * 0.55, H * 0.95); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(6,3,8,.72)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "soft-light"; g.fillStyle = night > 0.4 ? "rgba(255,140,60,.22)" : "rgba(255,170,90,.16)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    if (rain) { g.strokeStyle = "rgba(190,210,235,.35)"; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 90; i++) { const x = (hash(i) * W + time * 60) % W, y = (hash(i + 500) * H + time * 520) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 16); } g.stroke(); }

    // blow it up, crisp
    dest.setTransform(1, 0, 0, 1, 0, 0);
    dest.imageSmoothingEnabled = false;
    dest.drawImage(this.lo, 0, 0, lw, lh, 0, 0, lw * pix * dpr, lh * pix * dpr);
    dest.setTransform(dpr, 0, 0, dpr, 0, 0);
    dest.imageSmoothingEnabled = true;
    // text stays sharp: bubbles, your marker, the street name
    for (const d of drawn) {
      const c = d.c;
      if (c.bubble && c.bubble.until > sim.tick && Math.abs(d.dv) < 3) {
        dest.font = "600 13px 'IBM Plex Mono', monospace"; dest.textAlign = "center";
        const txt = c.bubble.text.slice(0, 44), tw = Math.min(280, dest.measureText(txt).width + 16), by = d.y - 125 * d.k - 28;
        dest.fillStyle = INK; dest.fillRect(d.x - tw / 2 - 2, by - 2, tw + 4, 26);
        dest.fillStyle = "#f3e6c8"; dest.fillRect(d.x - tw / 2, by, tw, 22);
        dest.fillStyle = INK; dest.fillText(txt, d.x, by + 15);
      }
      if (c.id === f.id) { dest.fillStyle = "#ec2a1c"; dest.strokeStyle = INK; dest.lineWidth = 3; dest.font = "800 13px 'IBM Plex Mono', monospace"; dest.textAlign = "center"; dest.strokeText("YOU", d.x, d.y + 22); dest.fillText("YOU", d.x, d.y + 22); }
    }
    dest.textAlign = "start"; dest.fillStyle = "rgba(243,230,200,.75)"; dest.font = "600 12px 'IBM Plex Mono', monospace";
    dest.fillText(`${sim.world.streetName(f.x, f.y)} · V or scroll out for 3D`, 16, 66);
  }

  // ---- sky and the far rooftops (real buildings, as silhouettes)
  private backdrop(g: CanvasRenderingContext2D, sim: Simulation, W: number, pu: number, pv: number, S: number, ground: number, day: number, time: number): void {
    const sky = g.createLinearGradient(0, 0, 0, ground);
    if (day > 0.6) { sky.addColorStop(0, "#3b5f7a"); sky.addColorStop(1, "#e0a070"); }
    else if (day > 0.2) { sky.addColorStop(0, "#1b2a3f"); sky.addColorStop(1, "#c4603a"); }
    else { sky.addColorStop(0, "#070a14"); sky.addColorStop(1, "#243040"); }
    g.fillStyle = sky; g.fillRect(0, 0, W, ground);
    if (day < 0.4) { g.fillStyle = "rgba(240,230,200,.8)"; for (let i = 0; i < 50; i++) g.fillRect(((hash(i) * W + pu * S * 0.05) % W + W) % W, hash(i + 90) * ground * 0.4, 2, 2); }
    const base = day > 0.4 ? "#4a3a36" : "#120e18";
    const bs = sim.world.buildings.map((b) => ({ b, u: ((b.x0 + b.x1 + 1) / 2 - (b.y0 + b.y1 + 1) / 2) / 1.414, v: (b.x0 + b.x1 + b.y0 + b.y1 + 2) / 2, w: (b.x1 - b.x0 + b.y1 - b.y0 + 2) / 1.6 }))
      .filter((q) => q.v < pv + 4 && q.v > pv - 40).sort((a, c) => a.v - c.v);
    for (const q of bs) {
      const depth = Math.max(0, (pv - q.v) / 40), k = 1 - depth * 0.55, par = 0.2 + 0.3 * k;
      const x = W / 2 + (q.u - pu) * S * par, w = Math.max(24, q.w * S * k * 0.8), h = Math.min(ground * 0.8, q.b.height * S * 0.6 * k);
      if (x + w / 2 < 0 || x - w / 2 > W) continue;
      g.fillStyle = base; g.fillRect(x - w / 2, ground - h, w, h);
      g.fillStyle = INK; g.fillRect(x - w / 2 - 2, ground - h - 2, w + 4, 3);
      const lit = day < 0.4 ? "rgba(255,190,90,.75)" : "rgba(255,230,190,.25)";
      for (let r = 0; r < 4; r++) for (let cI = 0; cI < 3; cI++) if (hash(q.b.id * 17 + r * 5 + cI) < 0.35) { g.fillStyle = lit; g.fillRect(x - w / 2 + 8 + cI * (w - 16) / 3, ground - h + 10 + r * 20, 8, 10); }
      if (q.b.kind !== "house" && depth < 0.5) { g.fillStyle = q.b.sign; g.globalAlpha = 0.5 + 0.3 * Math.sin(time * 3 + q.b.id); g.fillRect(x - w * 0.3, ground - h - 12, w * 0.6, 5); g.globalAlpha = 1; }
    }
    g.fillStyle = day > 0.4 ? "rgba(224,160,112,.18)" : "rgba(30,50,70,.35)"; g.fillRect(0, ground * 0.45, W, ground * 0.55);
  }

  private brickTex(): HTMLCanvasElement {
    if (this.bricks) return this.bricks;
    const c = document.createElement("canvas"); c.width = 64; c.height = 36; const x = c.getContext("2d")!;
    const cols = ["#6e3b2a", "#7d4632", "#5c2f24", "#8a5238", "#693a30"];
    x.fillStyle = INK; x.fillRect(0, 0, 64, 36);
    for (let r = 0; r < 4; r++) for (let i = -1; i < 3; i++) { x.fillStyle = cols[(r * 3 + i + 5) % 5]; x.fillRect(i * 32 + (r % 2 ? 16 : 0) + 2, r * 9 + 2, 28, 6); x.fillStyle = "rgba(255,200,140,.12)"; x.fillRect(i * 32 + (r % 2 ? 16 : 0) + 2, r * 9 + 2, 28, 1); }
    return this.bricks = c;
  }

  /** The long brick wall behind the pavement: doors, boarded windows, pipes, posters, graffiti. */
  private wall(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, time: number): void {
    const top = ground - H * 0.52;
    const pat = g.createPattern(this.brickTex(), "repeat");
    if (pat) { g.save(); g.translate(-(off % 64) + 0, top); g.fillStyle = pat; g.fillRect(0, 0, W + 64, ground - top); g.restore(); }
    g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, top, W, H * 0.06);                    // shadow under the eaves
    g.fillStyle = INK; g.fillRect(0, top - 3, W, 6);                                     // cornice
    g.fillStyle = "#3a2a28"; g.fillRect(0, top + 6, W, 5);
    const SEG = 190, i0 = Math.floor(off / SEG) - 1, n = Math.ceil(W / SEG) + 3;
    const wallH = ground - top;
    for (let i = i0; i < i0 + n; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 7 + 3), kind = h < 0.28 ? 0 : h < 0.5 ? 1 : h < 0.7 ? 2 : h < 0.85 ? 3 : 4;
      if (x > W + SEG || x < -SEG) continue;
      // windows upstairs
      for (let w = 0; w < 2; w++) {
        const wx = x + 24 + w * 90, wy = top + wallH * 0.14, lit = hash(i * 11 + w) < 0.4;
        g.fillStyle = INK; g.fillRect(wx - 4, wy - 4, 48, 66);
        g.fillStyle = lit ? "#ffb347" : "#1a1620"; g.fillRect(wx, wy, 40, 58);
        if (lit) { g.fillStyle = "rgba(255,240,180,.45)"; g.fillRect(wx + 4, wy + 4, 14, 18); g.fillStyle = INK; g.fillRect(wx + 18, wy, 4, 58); g.fillRect(wx, wy + 26, 40, 4); }
        else if (hash(i * 13 + w) < 0.5) { g.fillStyle = "#6a4a2c"; g.fillRect(wx, wy + 8, 40, 7); g.fillRect(wx, wy + 28, 40, 7); }  // boarded
        g.fillStyle = "#2b2220"; g.fillRect(wx - 6, wy + 62, 52, 6);
      }
      const dy = ground - wallH * 0.46, dh = wallH * 0.46;
      if (kind === 0) { // door with a lamp over it
        g.fillStyle = INK; g.fillRect(x + 62, dy - 4, 60, dh + 4); g.fillStyle = "#4a3320"; g.fillRect(x + 66, dy, 52, dh);
        g.fillStyle = INK; g.fillRect(x + 90, dy, 3, dh); g.fillStyle = "#c9a24a"; g.fillRect(x + 100, dy + dh * 0.5, 5, 5);
      } else if (kind === 1) { // roller shutter
        g.fillStyle = INK; g.fillRect(x + 30, dy - 4, 130, dh + 4); g.fillStyle = "#59606a"; g.fillRect(x + 34, dy, 122, dh);
        g.fillStyle = "rgba(0,0,0,.35)"; for (let r = 0; r < dh; r += 8) g.fillRect(x + 34, dy + r, 122, 2);
        g.fillStyle = hash(i) < 0.5 ? "#e63a8a" : "#3dd6ff"; g.fillRect(x + 44, dy + 12, 12, 40); g.fillRect(x + 58, dy + 20, 34, 12); g.fillRect(x + 98, dy + 8, 40, 14); // tag
      } else if (kind === 2) { // pipe, poster and a fire-escape ladder
        g.fillStyle = INK; g.fillRect(x + 140, top + 8, 10, wallH); g.fillStyle = "#6c6660"; g.fillRect(x + 142, top + 8, 5, wallH);
        g.fillStyle = "#e8d8a8"; g.fillRect(x + 50, dy + 8, 44, 56); g.fillStyle = "#b03a2a"; g.fillRect(x + 54, dy + 14, 36, 14); g.fillStyle = INK; g.fillRect(x + 56, dy + 36, 30, 3); g.fillRect(x + 56, dy + 44, 24, 3);
      } else if (kind === 3) { // arched alley mouth, black inside
        g.fillStyle = INK; g.beginPath(); g.moveTo(x + 40, ground); g.lineTo(x + 40, dy + 24); g.quadraticCurveTo(x + 95, dy - 22, x + 150, dy + 24); g.lineTo(x + 150, ground); g.fill();
        g.fillStyle = "#05030a"; g.beginPath(); g.moveTo(x + 48, ground); g.lineTo(x + 48, dy + 28); g.quadraticCurveTo(x + 95, dy - 12, x + 142, dy + 28); g.lineTo(x + 142, ground); g.fill();
        if (hash(i * 3) < 0.6) { g.fillStyle = "rgba(255,40,40,.9)"; g.fillRect(x + 80 + Math.sin(time) * 0, dy + 60, 3, 3); g.fillRect(x + 92, dy + 60, 3, 3); } // eyes in the dark
      } else { // shop front with striped awning
        g.fillStyle = INK; g.fillRect(x + 20, dy - 18, 150, dh + 18);
        g.fillStyle = "#2a3a4a"; g.fillRect(x + 26, dy + 14, 138, dh - 14);
        g.fillStyle = "rgba(255,210,120,.6)"; g.fillRect(x + 32, dy + 20, 60, dh - 28); g.fillRect(x + 100, dy + 20, 58, dh - 28);
        for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? "#f1e6d0" : "#b3202a"; g.fillRect(x + 22 + s * 18, dy - 14, 18, 28); }
        g.fillStyle = INK; g.fillRect(x + 22, dy + 12, 144, 4);
      }
    }
    g.fillStyle = INK; g.fillRect(0, ground - 5, W, 6);                                  // wall foot
    void night;
  }

  /** Pavement, kerb and cobbled road with bins, cans, litter and puddles. */
  private cobbles(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, rain: boolean, time: number): void {
    const padH = H * 0.1, roadY = ground + padH;
    g.fillStyle = "#4a423c"; g.fillRect(0, ground, W, padH);
    g.fillStyle = "#2c2622"; for (let x = -(off % 70) - 70; x < W; x += 70) g.fillRect(x, ground, 3, padH);   // slab joints
    g.fillStyle = INK; g.fillRect(0, roadY - 6, W, 8); g.fillStyle = "#8a8074"; g.fillRect(0, roadY - 4, W, 3);  // kerb
    // cobbles in staggered rows, bigger toward the viewer
    const rows = 5; let y = roadY + 2;
    for (let r = 0; r < rows; r++) {
      const rh = (H - roadY) / rows * (0.7 + r * 0.15), sw = 30 + r * 9, sh = Math.max(8, rh);
      const x0 = -((off * (1 + r * 0.04)) % sw) - sw + (r % 2 ? sw / 2 : 0), ri = Math.floor(off * (1 + r * 0.04) / sw);
      for (let x = x0, j = 0; x < W; x += sw, j++) {
        const hh = hash((ri + j) * 31 + r * 977), v = 0.55 + hh * 0.5;
        g.fillStyle = INK; g.fillRect(x, y, sw, sh);
        g.fillStyle = `rgb(${(78 * v) | 0},${(66 * v) | 0},${(62 * v) | 0})`; g.fillRect(x + 2, y + 2, sw - 4, sh - 4);
        g.fillStyle = "rgba(255,210,160,.1)"; g.fillRect(x + 2, y + 2, sw - 4, 2);
      }
      y += sh;
      if (y > H) break;
    }
    // puddles that catch the lamp light, and street litter keyed to world position so it stays put
    const SEG = 120, i0 = Math.floor(off / SEG) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 13 + 5), h2 = hash(i * 29 + 1);
      if (x < -80 || x > W + 80) continue;
      if (h < 0.18 || rain) { g.fillStyle = "rgba(60,90,120,.55)"; g.beginPath(); g.ellipse(x + h2 * 60, roadY + 36 + h2 * 50, 30 + h * 70, 6 + h2 * 5, 0, 0, 6.283); g.fill(); g.fillStyle = "rgba(255,200,120,.35)"; g.fillRect(x + h2 * 60 - 12, roadY + 33 + h2 * 50, 24, 2); }
      const lx = x + 30 + h2 * 60;
      if (h > 0.2 && h < 0.45) this.can(g, lx, ground + padH * (0.3 + h2 * 0.55), h2 < 0.5);
      else if (h >= 0.45 && h < 0.58) this.bin(g, x + 40, ground + padH * 0.8, h2 < 0.5, night, time);
      else if (h >= 0.58 && h < 0.7) this.paper(g, lx, ground + padH * 0.7, h2);
      else if (h >= 0.7 && h < 0.78) this.bottle(g, lx, roadY + 14 + h2 * 20);
      if (hash(i * 3 + 8) < 0.07) this.crate(g, x + 80, ground + padH * 0.9);
    }
  }

  private can(g: CanvasRenderingContext2D, x: number, y: number, up: boolean): void {
    g.fillStyle = INK; if (up) { g.fillRect(x - 5, y - 15, 10, 16); g.fillStyle = "#c9ced4"; g.fillRect(x - 3, y - 13, 6, 12); g.fillStyle = "#d1262d"; g.fillRect(x - 3, y - 9, 6, 4); }
    else { g.fillRect(x - 11, y - 6, 22, 9); g.fillStyle = "#c9ced4"; g.fillRect(x - 9, y - 4, 18, 5); g.fillStyle = "#d1262d"; g.fillRect(x - 5, y - 4, 7, 5); }
  }
  private bottle(g: CanvasRenderingContext2D, x: number, y: number): void { g.fillStyle = INK; g.fillRect(x - 12, y - 5, 24, 10); g.fillStyle = "#2f7a3a"; g.fillRect(x - 10, y - 3, 14, 6); g.fillRect(x + 4, y - 2, 6, 3); }
  private paper(g: CanvasRenderingContext2D, x: number, y: number, h: number): void { g.fillStyle = INK; g.fillRect(x - 11, y - 5, 22, 9); g.fillStyle = h < 0.5 ? "#e8e0c8" : "#d8b66a"; g.fillRect(x - 9, y - 3, 18, 5); }
  private crate(g: CanvasRenderingContext2D, x: number, y: number): void { g.fillStyle = INK; g.fillRect(x - 24, y - 40, 48, 44); g.fillStyle = "#8a6030"; g.fillRect(x - 21, y - 37, 42, 38); g.fillStyle = "#5a3c1c"; g.fillRect(x - 21, y - 20, 42, 4); g.fillRect(x - 3, y - 37, 6, 38); }
  private bin(g: CanvasRenderingContext2D, x: number, y: number, skip: boolean, night: number, time: number): void {
    const w = skip ? 96 : 40, h = skip ? 56 : 62, c = skip ? "#2e6a4a" : "#556068";
    g.fillStyle = INK; g.fillRect(x - w / 2 - 3, y - h - 3, w + 6, h + 6);
    g.fillStyle = c; g.fillRect(x - w / 2, y - h, w, h); g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(x - w / 2, y - h, w, 4);
    g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x - w / 2, y - 14, w, 14);
    g.fillStyle = INK; g.fillRect(x - w / 2 - 5, y - h - 8, w + 10, 8); g.fillStyle = "#3a4048"; g.fillRect(x - w / 2 - 3, y - h - 6, w + 6, 4);
    if (skip) { g.fillStyle = "#e9e0c8"; g.fillRect(x - 28, y - h - 15, 20, 9); g.fillStyle = "#6a5030"; g.fillRect(x + 6, y - h - 18, 24, 12); }
    if (night > 0.3 && skip) { g.fillStyle = "rgba(160,170,180,.2)"; g.beginPath(); g.ellipse(x + 8 + Math.sin(time * 0.8) * 6, y - h - 28 - ((time * 12) % 22), 8, 12, 0, 0, 6.283); g.fill(); } // steam
  }

  private lamps(g: CanvasRenderingContext2D, W: number, off: number, ground: number, night: number, time: number): void {
    const SEG = 380, i0 = Math.floor(off / SEG) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2 + 120;
      if (x < -150 || x > W + 150) continue;
      const flick = hash(i) < 0.2 ? (Math.sin(time * 23 + i) > 0.6 ? 0.55 : 1) : 1, y = ground - 160;
      g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.moveTo(x, ground + 6); g.lineTo(x, y); g.lineTo(x + 30, y - 8); g.stroke();
      g.strokeStyle = "#3a332e"; g.lineWidth = 4; g.beginPath(); g.moveTo(x, ground + 6); g.lineTo(x, y); g.lineTo(x + 30, y - 8); g.stroke();
      g.fillStyle = INK; g.fillRect(x + 20, y - 14, 28, 14); g.fillStyle = night > 0.2 ? "#ffd070" : "#a89c80"; g.fillRect(x + 23, y - 9, 22, 7);
      const a = (0.25 + 0.4 * night) * flick;
      g.globalCompositeOperation = "lighter";
      let gr = g.createRadialGradient(x + 34, y, 0, x + 34, y, 230); gr.addColorStop(0, `rgba(255,170,70,${a})`); gr.addColorStop(1, "rgba(255,170,70,0)"); g.fillStyle = gr; g.fillRect(x - 200, y - 230, 470, 460);
      gr = g.createRadialGradient(x + 34, ground + 70, 0, x + 34, ground + 70, 190); gr.addColorStop(0, `rgba(255,150,60,${a * 0.6})`); gr.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = gr; g.fillRect(x - 160, ground - 120, 400, 400);
      g.globalCompositeOperation = "source-over";
    }
  }

  /** A chunky brawler: fat outlined limbs, a vest and baggy trousers, a big angry head. Joints come from `solve`. */
  private brawler(g: CanvasRenderingContext2D, c: Character, k: number, dir: number, flash: boolean): void {
    const L = c.look, D = dressOf(c), skin = flash ? "#ffffff" : SKIN[c.id % SKIN.length], build = L.build ?? 1;
    const top = flash ? "#ffffff" : L.color, pants = flash ? "#ffffff" : rgb(L.accent, 0.55), boots = "#2a1d18";
    const lw = 9.5 * k * build, ol = 3.4 * k;
    const limb = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: string, w: number) => {
      g.strokeStyle = INK; g.lineWidth = w + ol * 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.stroke();
    };
    // back arm and both legs first
    const far = dir > 0 ? 8 : 12;
    limb(J[6], J[7], J[far], J[far + 1], J[far + 2], J[far + 3], skin, lw * 0.85);
    for (const i of [16, 20]) {
      limb(J[0], J[1], J[i], J[i + 1], J[i + 2], J[i + 3], pants, lw * 1.25);
      if (D?.legs === "shorts") { g.strokeStyle = skin; g.lineWidth = lw * 0.95; g.beginPath(); g.moveTo(J[i] + (J[i + 2] - J[i]) * 0.2, J[i + 1] + (J[i + 3] - J[i + 1]) * 0.2); g.lineTo(J[i + 2], J[i + 3]); g.stroke(); }
      const fx = J[i + 2], fy = J[i + 3];
      g.fillStyle = INK; g.fillRect(fx - 7 * k + (dir > 0 ? 0 : -9 * k), fy - 7 * k, 17 * k, 11 * k);
      g.fillStyle = boots; g.fillRect(fx - 5 * k + (dir > 0 ? 0 : -9 * k), fy - 5 * k, 13 * k, 7 * k);
      g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(fx - 5 * k + (dir > 0 ? 0 : -9 * k), fy - 5 * k, 13 * k, 2 * k);
    }
    // torso: a wide vest with a belly, belt, and ink outline
    const hx = J[0], hy = J[1], sx = J[6], sy = J[7], len = Math.hypot(sx - hx, sy - hy) || 1, nx = -(sy - hy) / len, ny = (sx - hx) / len;
    const sw = 19 * k * build, hw = 17 * k * build;
    g.beginPath(); g.moveTo(hx + nx * hw, hy + ny * hw); g.lineTo(sx + nx * sw, sy + ny * sw); g.lineTo(sx - nx * sw, sy - ny * sw); g.lineTo(hx - nx * hw, hy - ny * hw); g.closePath();
    g.fillStyle = top; g.fill(); g.strokeStyle = INK; g.lineWidth = ol * 1.6; g.stroke();
    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.moveTo(hx, hy); g.lineTo(sx, sy); g.lineTo(sx - nx * sw, sy - ny * sw); g.lineTo(hx - nx * hw, hy - ny * hw); g.closePath(); g.fill();   // shaded back half
    g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(hx + nx * hw * 0.6, hy + ny * hw * 0.6); g.lineTo(sx + nx * sw * 0.6, sy + ny * sw * 0.6); g.stroke();
    // grime stains and a belt
    g.fillStyle = "rgba(60,36,20,.35)"; g.fillRect(hx - 6 * k, hy - 14 * k, 8 * k, 5 * k);
    g.fillStyle = INK; g.fillRect(hx - hw - 1, hy - 3 * k, hw * 2 + 2, 6 * k); g.fillStyle = "#b08a3a"; g.fillRect(hx - 3 * k, hy - 2 * k, 6 * k, 4 * k);
    // jackets and puffers get sleeves
    const sleeves = !!D && D.top !== "tee" && D.top !== "shirt";
    const near = dir > 0 ? 12 : 8;
    limb(J[6], J[7], J[near], J[near + 1], J[near + 2], J[near + 3], sleeves ? top : skin, lw * (sleeves ? 1.05 : 0.95));
    if (sleeves) { g.strokeStyle = skin; g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(J[near] + (J[near + 2] - J[near]) * 0.45, J[near + 1] + (J[near + 3] - J[near + 1]) * 0.45); g.lineTo(J[near + 2], J[near + 3]); g.stroke(); }
    // fists, taped
    for (const i of [10, 14]) { g.fillStyle = INK; g.beginPath(); g.arc(J[i], J[i + 1], 6.6 * k, 0, 6.283); g.fill(); g.fillStyle = skin; g.beginPath(); g.arc(J[i], J[i + 1], 4.4 * k, 0, 6.283); g.fill(); g.fillStyle = "#e8e0cc"; g.fillRect(J[i] - 4.4 * k, J[i + 1] - 4 * k, 8.8 * k, 3 * k); }
    this.head(g, c, J[4], J[5], k, dir, skin, flash, D ? D.hat : L.hat);
  }

  private head(g: CanvasRenderingContext2D, c: Character, x: number, y: number, k: number, dir: number, skin: string, flash: boolean, hat: Character["look"]["hat"]): void {
    const L = c.look, F = L.face, r = 16.5 * k, hair = flash ? "#fff" : L.color;
    const ink = (path: () => void, fill: string, w = 3 * k) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = w; g.stroke(); };
    // back hair
    if (L.hair === "long" || L.hair === "braids" || L.hair === "pigtails" || L.hair === "bob" || L.hair === "pony") ink(() => g.ellipse(x - 3 * k * dir, y + 5 * k, r * 1.05, r * 1.35, 0, 0, 6.283), hair);
    if (L.hair === "big" || L.hair === "afro" || L.hair === "curly") ink(() => g.ellipse(x - 1 * k * dir, y - 3 * k, r * 1.4, r * 1.35, 0, 0, 6.283), hair);
    // ear + head
    ink(() => g.ellipse(x - r * 0.95 * dir, y + 1 * k, 3.5 * k, 5 * k, 0, 0, 6.283), skin, 2.4 * k);
    ink(() => g.ellipse(x, y, r * (F?.head === "wide" ? 1.12 : 1), r * (F?.head === "oval" ? 1.12 : 1.04), 0, 0, 6.283), skin);
    // stubble / beard
    const fc = F?.facial ?? "none";
    if (fc === "beard" || fc === "goatee" || fc === "stubble") { g.save(); g.beginPath(); g.ellipse(x, y, r, r * 1.04, 0, 0, 6.283); g.clip(); g.fillStyle = fc === "stubble" ? "rgba(40,30,28,.35)" : "rgba(50,34,26,.95)"; g.fillRect(x - r, y + r * (fc === "goatee" ? 0.5 : 0.1), r * 2, r); g.restore(); }
    // hair on top
    const hs = L.hair;
    if (hs !== "none" && !(hat !== "none" && hat !== "hood" && hat !== "headphones")) {
      g.beginPath(); g.ellipse(x, y - 1 * k, r * 1.04, r * 1.04, 0, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fillStyle = hair; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6 * k; g.stroke();
      if (hs === "mohawk" || hs === "spiky") { g.fillStyle = hair; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 5 * k - 3 * k, y - r * 0.95); g.lineTo(x + i * 5 * k, y - r * 1.65); g.lineTo(x + i * 5 * k + 3 * k, y - r * 0.95); g.fill(); g.stroke(); } }
      if (hs === "bun" || hs === "topknot") ink(() => g.arc(x - 2 * k * dir, y - r * 1.3, r * 0.4, 0, 6.283), hair, 2.4 * k);
    }
    // hat
    const hc = flash ? "#fff" : L.accent;
    if (hat === "beanie" || hat === "hood") ink(() => { g.ellipse(x, y - 2 * k, r * 1.1, r * 1.0, 0, Math.PI, 0); g.closePath(); }, hc);
    else if (hat === "cap" || hat === "snapback" || hat === "police") { ink(() => { g.ellipse(x, y - 2 * k, r * 1.06, r * 0.95, 0, Math.PI, 0); g.closePath(); }, hat === "police" ? "#1c2836" : hc); ink(() => g.rect(x + (hat === "snapback" ? -r * 1.5 * dir : r * 0.2 * dir) - (dir < 0 ? r * 1.3 : 0), y - 5 * k, r * 1.3, 4 * k), hat === "police" ? "#1c2836" : hc, 2.2 * k); }
    else if (hat === "bandana") ink(() => g.rect(x - r * 1.02, y - 8 * k, r * 2.04, 6 * k), hc, 2.4 * k);
    else if (hat === "bucket" || hat === "cowboy") { ink(() => g.ellipse(x, y - 6 * k, r * 1.6, 3.4 * k, 0, 0, 6.283), hc); ink(() => g.rect(x - r * 0.75, y - r * 1.5, r * 1.5, r * 0.9), hc); }
    else if (hat === "helmet") ink(() => { g.ellipse(x, y - 1 * k, r * 1.14, r * 1.1, 0, Math.PI, 0); g.closePath(); }, hc);
    // face: a scowl, because this is a fun scary game
    const fx = x + r * 0.35 * dir, ey = y - 2 * k;
    g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 2.4 * k;
    const shades = F?.eyes === "shades" || F?.eyes === "visor" || F?.eyes === "aviator" || F?.eyes === "shutter";
    if (shades) { g.fillRect(x - r * 0.1 * dir + (dir > 0 ? 0 : -r * 0.9), ey - 3 * k, r * 1.0, 5.5 * k); g.fillStyle = "rgba(120,200,255,.5)"; g.fillRect(x + (dir > 0 ? r * 0.15 : -r * 0.65), ey - 2 * k, 3 * k, 1.6 * k); }
    else { for (const o of [-0.3, 0.55]) { const ex = fx + o * r * dir; g.fillStyle = "#f4efe0"; g.beginPath(); g.ellipse(ex, ey, 3 * k, 3.4 * k, 0, 0, 6.283); g.fill(); g.lineWidth = 1.6 * k; g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(ex + 1 * k * dir, ey + 0.5 * k, 1.5 * k, 0, 6.283); g.fill(); } }
    g.lineWidth = 2.6 * k; g.beginPath(); g.moveTo(fx - r * 0.55 * dir, ey - 6.5 * k); g.lineTo(fx + r * 0.1 * dir, ey - 3.5 * k); g.moveTo(fx + r * 0.2 * dir, ey - 3.5 * k); g.lineTo(fx + r * 0.85 * dir, ey - 7 * k); g.stroke(); // angry brows
    ink(() => g.ellipse(fx + r * 0.55 * dir, y + 3 * k, 3.2 * k, 3.8 * k, 0, 0, 6.283), rgb(skin, 0.88), 2 * k);  // big nose
    const m = F?.mouth ?? "flat";
    g.lineWidth = 2.4 * k; g.beginPath();
    if (m === "grin" || m === "teeth" || m === "smile") { g.moveTo(fx - 3 * k, y + 8 * k); g.quadraticCurveTo(fx + 3 * k * dir, y + 12 * k, fx + 8 * k, y + 7.5 * k); g.stroke(); if (m !== "smile") { g.fillStyle = "#f4efe0"; g.fillRect(fx - 1.5 * k, y + 8 * k, 6 * k, 2.4 * k); } }
    else if (m === "o") { g.arc(fx + 2 * k * dir, y + 9 * k, 2.4 * k, 0, 6.283); g.fill(); }
    else { g.moveTo(fx - 4 * k, y + 9.5 * k); g.lineTo(fx + 7 * k, y + 9 * k); g.stroke(); }
    if (fc === "mustache") { g.fillStyle = "rgba(50,34,26,1)"; g.beginPath(); g.moveTo(fx - 5 * k, y + 6.5 * k); g.quadraticCurveTo(fx + 3 * k, y + 4 * k, fx + 10 * k, y + 7.5 * k); g.quadraticCurveTo(fx + 3 * k, y + 8.5 * k, fx - 5 * k, y + 6.5 * k); g.fill(); g.stroke(); }
    if (F?.extra === "scar") { g.strokeStyle = "rgba(160,60,60,.9)"; g.lineWidth = 1.8 * k; g.beginPath(); g.moveTo(fx + 1 * k, ey - 6 * k); g.lineTo(fx + 4 * k, ey + 5 * k); g.stroke(); }
  }
}
