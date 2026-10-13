import { Phys, type Character } from "../entities/types";
import { SITE, NEONS, SHOP_NAMES, hash01, pickOf, mix } from "./noir";
import type { Simulation } from "../sim/Simulation";
import { pose, solve, drawFigure, reachArm, type Angles } from "./StickFigure";

// ragdoll: a fallen figure goes limp, and blends back to its normal pose when it recovers
const LIMP: Partial<Angles> = { lean: 0.9, lying: 1, tilt: 0.6, armL: 2.4, armR: 2.7, foreL: 0.6, foreR: 0.6, thighL: 0.5, thighR: -0.4, bendL: 0.3, bendR: 0.2, bob: -2, hipX: 0 };
const ragdoll = new Map<number, number>();
/** px per lateral unit used to place people. Fixed (the zoom-3 value) so zooming never slides people across the screen. */
const LAYOUT_S = 18 * (3 - 1.2);


/**
 * The 2D street view. The look is the website footer (see game/docs/LOOK.md): a near-black street lit by people,
 * neon stick figures (the same drawFigure as the iso world), a string of coloured bulbs overhead, small glowing tag
 * labels, one loud red. Buildings take their colour and name from the real world building beside the player.
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
const hash = hash01;
const { ink: INK, ink2: INK2, paper: PAPER, dim: DIM, red: RED, acid: ACID, sodium: SODIUM } = SITE;
const BULBS = [SODIUM, RED, ACID];
const TAGS = ["OPEN", "LIVE", "AFTER HOURS", "24H", "BAR", "ROOMS", "NOODLES", "RECORDS", "ARCADE", "TAXI"];
const FONT_DISPLAY = `"Big Shoulders Display", "Arial Narrow", Impact, sans-serif`;
const FONT_MONO = `"IBM Plex Mono", ui-monospace, Menlo, monospace`;

/** A neon line: a wide faint halo under a thin bright core. `trace` adds the path, the caller does not stroke. */
function neon(g: CanvasRenderingContext2D, col: string, w: number, trace: () => void, halo = 0.2): void {
  g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = col;
  g.globalAlpha = halo; g.lineWidth = w * 4; g.beginPath(); trace(); g.stroke();
  g.globalAlpha = 1; g.lineWidth = w; g.beginPath(); trace(); g.stroke();
}
const rectEdge = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, lw = 1.6, halo = 0.2): void => neon(g, col, lw, () => g.rect(x, y, w, h), halo);

/** A small glowing label: mono caps, 1px coloured border, a slight tilt (the site's .prop--banner). */
function tag(g: CanvasRenderingContext2D, x: number, y: number, text: string, col: string, rot = -0.035, size = 11): void {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `600 ${size}px ${FONT_MONO}`; const w = g.measureText(text).width + 16, h = size + 9;
  g.fillStyle = "rgba(14,11,10,.88)"; g.fillRect(0, 0, w, h);
  g.shadowColor = col; g.shadowBlur = 7; g.strokeStyle = col; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1); g.shadowBlur = 0;
  g.fillStyle = col; g.textBaseline = "middle"; g.fillText(text, 8, h / 2 + 0.5); g.restore();
}

/** The site's string of bulbs: a swag between two points, bulbs cycling sodium / red / acid and twinkling. */
function bulbString(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag: number, time: number, seed: number, glow = 1): void {
  const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 34)), sy = (t: number) => y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
  g.strokeStyle = "rgba(238,228,211,.28)"; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24; g[i ? "lineTo" : "moveTo"](x0 + (x1 - x0) * t, sy(t)); } g.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = sy(t) + (i % 2 ? 5 : 2), col = BULBS[(i + seed) % 3];
    const tw = 0.55 + 0.45 * Math.sin(time * 2.1 + i * 0.37 + seed);
    g.fillStyle = col; g.globalAlpha = (0.35 + 0.65 * tw) * glow; g.beginPath(); g.arc(x, y, 3.2, 0, 6.283); g.fill();
    g.globalAlpha = 0.16 * tw * glow; g.beginPath(); g.arc(x, y, 9, 0, 6.283); g.fill(); g.globalAlpha = 1;
  }
}

/** A tiny neon stick figure behind a lit window: the footer's raver, at window scale. */
function windowFigure(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, time: number, seed: number): void {
  const cx = x + w * (0.3 + hash(seed) * 0.4), by = y + h - 2, hh = h * 0.78, sw = Math.sin(time * 2 + seed) * 3;
  g.strokeStyle = col; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath();
  g.moveTo(cx, by - hh * 0.5); g.lineTo(cx, by - hh * 0.82); g.moveTo(cx - 5, by - hh * 0.7 + sw * 0.3); g.lineTo(cx, by - hh * 0.76); g.lineTo(cx + 5, by - hh * 0.7 - sw * 0.3);
  g.moveTo(cx, by - hh * 0.5); g.lineTo(cx - 4, by); g.moveTo(cx, by - hh * 0.5); g.lineTo(cx + 4, by); g.stroke();
  g.beginPath(); g.arc(cx, by - hh * 0.92, 3, 0, 6.283); g.stroke();
}

export class StreetView {
  readonly cast = new StreetCast();
  private glow: number[] = [];

  /** `dest` is the visible canvas context (already scaled to CSS px). Everything is crisp vector: the site is, so the street is. */
  draw(dest: CanvasRenderingContext2D, dpr: number, sim: Simulation, f: Character, W: number, H: number, zoom: number, dt: number, time: number, poseName: (c: Character, moving: boolean, spd: number) => string): void {
    const g = dest;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.lineCap = "round"; g.lineJoin = "round";
    const pu = (f.x - f.y) / 1.414, pv = f.x + f.y;
    const S = 18 * (zoom - 1.2), ground = H * 0.62, day = sim.daylight, night = 1 - Math.min(1, day * 1.3);
    const rain = sim.env.raining, off = pu * S;
    this.glow.length = 0;
    this.backdrop(g, sim, W, ground, pu, pv, S, day, night, time);
    this.facades(g, sim, W, H, off, pv, S, ground, day, time);
    this.street(g, W, H, off, ground, night, rain, time);
    // kerb bushes, and pigeons pecking along the pavement (LOOK.md neon line for the animals)
    for (let i = 0; i < 16; i++) {
      const bx = hash(i + 700) * W, by = ground + 2 + hash(i + 710) * 6, br = 14 + hash(i + 720) * 16;
      g.fillStyle = "#14321f"; g.beginPath(); g.ellipse(bx, by, br, br * 0.7, 0, 0, 6.283); g.fill();
      g.fillStyle = "#2c5a36"; g.beginPath(); g.ellipse(bx - br * 0.2, by - br * 0.2, br * 0.6, br * 0.4, 0, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 6; i++) {
      const px = ((hash(i + 800) * W + time * (6 + hash(i + 810) * 6)) % (W + 40)) - 20, py = ground + 14 + hash(i + 820) * 8;
      g.strokeStyle = NEONS[(i + 3) % NEONS.length]; g.lineWidth = 1.4; g.beginPath(); g.ellipse(px, py, 5, 3, 0, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(px + 4, py - 1); g.lineTo(px + 8, py - 3); g.stroke();
    }
    this.lights(g, W, H, off, ground, night, time);
    // the people: the same neon stick figures as the iso world
    // figure size is fixed, and who is on the street and their spacing come from the world, not the zoom
    const kk = 0.95;
    const slots = this.cast.pick(sim.chars, f, W, LAYOUT_S, 1, dt, W < 700 ? 8 : 11);
    const drawn: { c: Character; x: number; y: number; k: number; dv: number }[] = [];
    for (const s of slots) {
      const c = sim.chars[s.id]; if (!c) continue;
      // no depth perspective: everyone stands on the same line at the same size, so walking never shifts them
      const k = kk * c.look.scale, sy = ground + H * 0.1;
      const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.0005, spd = Math.hypot(c.x - c.px, c.y - c.py) * 60;
      c.anim.phase += spd * dt * 5.5;
      const dir = (Math.cos(c.facing) - Math.sin(c.facing)) >= 0 ? 1 : -1;
      g.globalAlpha = s.alpha * 0.16; g.fillStyle = c.look.color; g.beginPath(); g.ellipse(s.x, sy, 26 * k, 5 * k, 0, 0, 6.283); g.fill();   // a pool of its own colour
      // mood-based animation: a happy figure swings its arms wider and leans forward; a low one slumps
      const A = pose(poseName(c, moving, spd), c.style, time + c.seedPhase, c.anim.phase, spd, c.anim.poseT);
      const mood = c.emo ? c.emo.mood : 0;
      A.armL *= 1 + 0.25 * mood; A.armR *= 1 + 0.25 * mood;
      A.lean += 0.06 * mood;
      // inverse kinematics: someone close to you reaches a hand toward you (in front, waist high)
      if (c.phys === Phys.OK && Math.hypot(c.x - f.x, c.y - f.y) < 6) reachArm(A, 1, A.hipX + 0.83 * 42 * Math.sin(A.lean), -44 - 0.83 * 42 * Math.cos(A.lean), 20 * dir, -66);
      // ragdoll blend: ease toward limp while knocked down, back to the pose when recovered
      const target = c.phys === Phys.DOWN ? 1 : 0, r0 = ragdoll.get(c.id) ?? 0;
      const r = r0 + (target - r0) * 0.15;
      ragdoll.set(c.id, r);
      if (r > 0.001) for (const key of Object.keys(LIMP) as (keyof Angles)[]) A[key] = A[key] * (1 - r) + (LIMP[key] as number) * r;
      solve(A, s.x, sy, k, dir);
      drawFigure(g, c, s.x, sy, k, dir, time, c.anim.flash, s.alpha, true);   // street people always get the HD pass (glow and ink outline)
      g.globalAlpha = 1;
      drawn.push({ c, x: s.x, y: sy, k, dv: s.dv });
    }
    // night: the same overlay colour as the iso world, then a quiet ink vignette
    if (night > 0.05) { g.fillStyle = `rgba(8,6,22,${(0.4 * night).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, H); vg.addColorStop(0, "rgba(14,11,10,0)"); vg.addColorStop(1, "rgba(14,11,10,.5)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (rain) { g.strokeStyle = "rgba(238,228,211,.22)"; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 90; i++) { const x = (hash(i) * W + time * 60) % W, y = (hash(i + 500) * H + time * 520) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 16); } g.stroke(); }
    // bulbs burn through the dark, then bubbles, your marker and the street tag
    this.overhead(g, W, off, ground, night, time);
    for (const d of drawn) {
      const c = d.c;
      if (c.bubble && c.bubble.until > sim.tick && Math.abs(d.dv) < 3) {
        g.font = `700 12px ${FONT_MONO}`; g.textAlign = "center";
        const txt = c.bubble.text.slice(0, 44), tw = Math.min(280, g.measureText(txt).width + 16), by = d.y - 125 * d.k - 28;
        g.fillStyle = PAPER; g.fillRect(d.x - tw / 2, by, tw, 22); g.fillStyle = INK; g.fillText(txt, d.x, by + 15);
      }
      if (c.id === f.id) { g.fillStyle = RED; g.strokeStyle = INK; g.lineWidth = 3; g.font = `800 12px ${FONT_MONO}`; g.textAlign = "center"; g.strokeText("YOU", d.x, d.y + 22); g.fillText("YOU", d.x, d.y + 22); }
    }
    g.textAlign = "start"; g.textBaseline = "alphabetic";
    tag(g, 16, 54, `${sim.world.streetName(f.x, f.y).toUpperCase()}`, "#ff7ad9", -0.03, 10);
    g.font = `500 10px ${FONT_MONO}`; g.fillStyle = "rgba(238,228,211,.4)"; g.fillText("V OR SCROLL OUT FOR 3D", 16, 86);
  }

  private lit(x: number, y: number, w: number, h: number): void { if (this.glow.length < 192) this.glow.push(x, y, w, h); }

  // ---- ground-black sky, far skyline, moon and stars
  private backdrop(g: CanvasRenderingContext2D, sim: Simulation, W: number, ground: number, pu: number, pv: number, S: number, day: number, night: number, time: number): void {
    const lift = Math.min(1, day * 1.15);
    const sky = g.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, mix(INK, "#2a2220", lift)); sky.addColorStop(1, mix(INK2, "#4a3c36", lift));
    g.fillStyle = sky; g.fillRect(0, 0, W, ground);
    if (night > 0.3) { g.fillStyle = PAPER; for (let i = 0; i < 46; i++) { g.globalAlpha = (0.25 + hash(i + 7) * 0.5) * night; g.fillRect(((hash(i) * W + pu * S * 0.03) % W + W) % W, hash(i + 90) * ground * 0.4, 1.6, 1.6); } g.globalAlpha = 1; }
    if (night > 0.3) { const mx = ((W * 0.82 - pu * S * 0.02) % (W + 80) + W + 80) % (W + 80) - 40, my = ground * 0.16; g.globalAlpha = night; g.fillStyle = PAPER; g.beginPath(); g.arc(mx, my, 14, 0, 6.283); g.fill(); g.globalAlpha = 0.1 * night; g.beginPath(); g.arc(mx, my, 34, 0, 6.283); g.fill(); g.globalAlpha = 1; }
    // two layers of far city: ink silhouettes with a dim rooftop line and a few sodium windows
    for (let layer = 0; layer < 2; layer++) {
      const SW = 150 - layer * 30, o = pu * S * (0.05 + layer * 0.07), j0 = Math.floor((o - W / 2) / SW) - 1, col = layer ? mix(INK2, "#2a2220", lift * 0.6) : mix(INK, INK2, 0.6);
      for (let i = j0; i < j0 + Math.ceil(W / SW) + 3; i++) {
        const hh = hash(i * 3 + layer * 50 + 1), x = i * SW - o + W / 2, w = SW * (0.75 + hash(i * 7 + layer) * 0.5), h = ground * (0.2 + hh * (0.55 - layer * 0.14));
        g.fillStyle = col; g.fillRect(x, ground - h, w, h);
        g.fillStyle = "rgba(238,228,211,.12)"; g.fillRect(x, ground - h, w, 1);
        if (hash(i * 13 + layer) < 0.3) { g.fillStyle = DIM; g.fillRect(x + w * 0.5, ground - h - 24, 1.5, 24); if (night > 0.3 && Math.sin(time * 2 + i) > 0) { g.fillStyle = RED; g.beginPath(); g.arc(x + w * 0.5 + 0.7, ground - h - 26, 2.4, 0, 6.283); g.fill(); } }
        if (night > 0.2) { g.fillStyle = SODIUM; g.globalAlpha = (0.55 - layer * 0.2) * night; for (let r = 0; r < h / 16; r++) for (let c = 0; c < w / 14; c++) if (hash(i * 31 + r * 7 + c + layer * 99) < 0.12) g.fillRect(x + 4 + c * 14, ground - h + 8 + r * 16, 5, 7); g.globalAlpha = 1; }
      }
    }
    void sim; void pv;
  }

  /** The world building closest to the street wall at street position u (scene units), looked for either side of the road. */
  private neighbour(sim: Simulation, u: number, pv: number): { color: string; sign: string; name: string } | undefined {
    for (const d of [-3, 3, -4.5, 4.5]) {
      const p = pv + d, tx = Math.round((p + u * 1.414) / 2), ty = Math.round((p - u * 1.414) / 2), b = sim.world.buildingAt(tx, ty);
      if (b) return b;
    }
    return undefined;
  }

  /** The long street wall. Each stretch stands for the real building beside you: dark body, neon edge in its sign colour, its own name on the fascia. */
  private facades(g: CanvasRenderingContext2D, sim: Simulation, W: number, H: number, off: number, pv: number, S: number, ground: number, day: number, time: number): void {
    const SEG = 280, i0 = Math.floor((off - W / 2) / SEG) - 1, n = Math.ceil(W / SEG) + 3, wallH = H * 0.54, lift = Math.min(1, day * 1.15);
    for (let i = i0; i < i0 + n; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 7 + 3);
      if (x > W + SEG || x < -SEG) continue;
      const wb = this.neighbour(sim, (i + 0.5) * SEG / S, pv);
      const accent = wb && wb.sign ? wb.sign : pickOf(NEONS, i * 17 + 3), base = wb?.color ?? pickOf(NEONS, i * 5);
      const kind = h < 0.34 ? 1 : h < 0.46 ? 3 : 0;                       // 1 shop, 3 alley mouth, 0 flats
      const hh = wallH * (0.7 + hash(i * 5) * 0.68), top = ground - hh;
      if (kind === 3) { this.alley(g, x, SEG, top, ground, i, accent, time); continue; }
      const body = mix(mix(INK2, base, 0.2), "#5a4a40", lift * 0.35);
      g.fillStyle = body; g.fillRect(x, top, SEG, hh);
      g.fillStyle = "rgba(14,11,10,.35)"; g.fillRect(x + SEG * 0.62, top, SEG * 0.38, hh);          // a flat shaded half
      // roof edge and side edge in the neon accent: the whole building is one line of light
      rectEdge(g, x, top, SEG, hh + 2, accent, 1.8, 0.16 + 0.1 * (1 - lift));
      this.roofKit(g, x, top, SEG, accent, i, time);
      const floors = hh > wallH * 1.22 ? 4 : hh > wallH * 0.95 ? 3 : 2, fh = (hh - H * 0.17) / floors;
      for (let fl = 0; fl < floors; fl++) for (let w = 0; w < 3; w++) {
        const wx = x + 30 + w * 80, wy = top + 16 + fl * fh, ww = 34, wh = Math.min(fh - 22, 54), r = hash(i * 11 + fl * 3 + w);
        const on = r < 0.4 && (day < 0.6 || r < 0.15);
        g.fillStyle = on ? "#3a2a14" : INK; g.fillRect(x + 30 + w * 80, wy, ww, wh);
        if (on) { g.fillStyle = SODIUM; g.globalAlpha = 0.9; g.fillRect(wx + 1, wy + 1, ww - 2, wh - 2); g.globalAlpha = 1; this.lit(wx, wy, ww, wh); if (r < 0.2) { g.fillStyle = "rgba(14,11,10,.8)"; g.fillRect(wx + 1, wy + 1, ww - 2, wh - 2); windowFigure(g, wx, wy, ww, wh, pickOf(NEONS, i * 7 + fl * 3 + w), time, i * 13 + w + fl * 5); } }
        else { g.strokeStyle = "rgba(238,228,211,.14)"; g.lineWidth = 1; g.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1); }
        g.fillStyle = "rgba(238,228,211,.16)"; g.fillRect(wx - 3, wy + wh + 1, ww + 6, 2);          // sill
      }
      const dy = ground - H * 0.17;
      if (kind === 1) this.shop(g, x, dy, SEG, ground, i, accent, wb?.name, time);
      else this.entry(g, x, dy, ground, i, accent);
      if (h > 0.46 && h < 0.7) tag(g, x + 18, top - 4 - 14 + (i % 3) * 0, pickOf(TAGS, i * 3 + 1), pickOf(NEONS, i * 11 + 2), -0.035, 10);
      if (h > 0.7) this.fireEscape(g, x + SEG - 74, top + 24, ground - H * 0.17 - top - 24, accent);
    }
    g.fillStyle = INK; g.fillRect(0, ground - 2, W, 4);
  }

  private roofKit(g: CanvasRenderingContext2D, x: number, top: number, SEG: number, col: string, i: number, time: number): void {
    const r = hash(i * 23 + 6);
    g.strokeStyle = DIM; g.lineWidth = 1.5;
    if (r < 0.34) { g.beginPath(); g.rect(x + 40, top - 34, 40, 34); g.moveTo(x + 36, top - 34); g.lineTo(x + 60, top - 48); g.lineTo(x + 84, top - 34); g.stroke(); }          // water tank
    else if (r < 0.66) { g.beginPath(); g.moveTo(x + SEG * 0.6, top); g.lineTo(x + SEG * 0.6, top - 40); g.moveTo(x + SEG * 0.6 - 10, top - 30); g.lineTo(x + SEG * 0.6 + 10, top - 30); g.stroke(); g.fillStyle = RED; g.globalAlpha = Math.sin(time * 2 + i) > 0 ? 1 : 0.25; g.beginPath(); g.arc(x + SEG * 0.6, top - 42, 2.6, 0, 6.283); g.fill(); g.globalAlpha = 1; }
    else { neon(g, col, 1.5, () => { g.moveTo(x + 30, top); g.lineTo(x + 30, top - 14); g.lineTo(x + SEG - 30, top - 14); g.lineTo(x + SEG - 30, top); }, 0.15); }
  }

  private entry(g: CanvasRenderingContext2D, x: number, dy: number, ground: number, i: number, accent: string): void {
    const dh = ground - dy;
    g.fillStyle = INK; g.fillRect(x + 30, dy + 4, 44, dh - 4); g.fillStyle = SODIUM; g.globalAlpha = 0.85; g.fillRect(x + 36, dy + 8, 32, 14); g.globalAlpha = 1; this.lit(x + 36, dy + 8, 32, 14);
    rectEdge(g, x + 30, dy + 4, 44, dh - 4, PAPER, 1.2, 0.08);
    g.fillStyle = INK; g.fillRect(x + 110, dy + 6, 40, dh - 6); rectEdge(g, x + 110, dy + 6, 40, dh - 6, accent, 1.2, 0.12);
    if (hash(i * 3) < 0.5) { g.fillStyle = accent; g.globalAlpha = 0.8; g.fillRect(x + 116, dy + 14, 14, 18); g.globalAlpha = 1; }   // a poster
  }

  private shop(g: CanvasRenderingContext2D, x: number, dy: number, SEG: number, ground: number, i: number, accent: string, name: string | undefined, time: number): void {
    const dh = ground - dy, label = (name && name.length <= 24 ? name : pickOf(SHOP_NAMES, i * 7 + 1)).toUpperCase();
    g.fillStyle = INK; g.fillRect(x + 8, dy - 28, SEG - 16, 24); rectEdge(g, x + 8, dy - 28, SEG - 16, 24, accent, 1.4, 0.2);
    let fs = 22; g.font = `800 ${fs}px ${FONT_DISPLAY}`; while (g.measureText(label).width > SEG - 40 && fs > 11) { fs -= 1; g.font = `800 ${fs}px ${FONT_DISPLAY}`; }
    g.textAlign = "center"; g.fillStyle = accent; g.shadowColor = accent; g.shadowBlur = 8; g.fillText(label, x + SEG / 2, dy - 10); g.shadowBlur = 0; g.textAlign = "start";
    g.fillStyle = INK; g.fillRect(x + 8, dy, SEG - 16, dh);
    const pane = [x + 16, x + SEG / 2 + 28], pw = SEG / 2 - 44;
    for (let q = 0; q < 2; q++) {
      const lit = hash(i + q) < 0.8;
      g.fillStyle = lit ? "#4a3414" : INK2; g.fillRect(pane[q], dy + 8, pw, dh - 16);
      if (lit) { g.fillStyle = SODIUM; g.globalAlpha = 0.9; g.fillRect(pane[q] + 1, dy + 9, pw - 2, dh - 18); g.globalAlpha = 1; this.lit(pane[q], dy + 8, pw, dh - 16); g.fillStyle = INK; g.fillRect(pane[q] + 8, dy + dh - 34, 30, 18); g.fillRect(pane[q] + 50, dy + dh - 44, 22, 28); }
      rectEdge(g, pane[q], dy + 8, pw, dh - 16, PAPER, 1, 0.06);
    }
    g.fillStyle = INK; g.fillRect(x + SEG / 2 - 22, dy + 10, 44, dh - 10); rectEdge(g, x + SEG / 2 - 22, dy + 10, 44, dh - 10, accent, 1.4, 0.18);
    for (let s = 0; s < 10; s++) { g.fillStyle = s % 2 ? INK : accent; g.globalAlpha = s % 2 ? 1 : 0.85; g.fillRect(x + 6 + s * ((SEG - 12) / 10), dy - 2, (SEG - 12) / 10 + 1, 12); } g.globalAlpha = 1;   // striped awning
    void time;
  }

  private alley(g: CanvasRenderingContext2D, x: number, SEG: number, top: number, ground: number, i: number, accent: string, time: number): void {
    const ax = x + 30, aw = SEG - 60, ay = top - 10;
    g.fillStyle = INK; g.fillRect(ax, ay, aw, ground - ay);
    g.fillStyle = INK2; g.fillRect(ax + 6, ay + 20, aw - 12, ground - ay - 20);
    this.fireEscape(g, ax + aw - 90, Math.max(ay, ground - 470) + 20, 400, accent);
    g.fillStyle = PAPER; g.globalAlpha = 0.2; g.fillRect(ax + 20, ground - 62, 30, 62); g.fillRect(ax + 60, ground - 40, 26, 40); g.globalAlpha = 1;   // bins in the dark
    neon(g, "#ff7ad9", 2, () => { g.moveTo(ax + aw - 36, ground - 330); g.lineTo(ax + aw - 36, ground - 250); }, 0.25);                                  // a pink blade sign down the wall
    bulbString(g, ax + 4, ground - 270, ax + aw - 4, ground - 270, 22, time, i, 1);
  }

  private fireEscape(g: CanvasRenderingContext2D, x: number, y: number, h: number, col: string): void {
    const lv = Math.max(2, Math.floor(h / 70));
    neon(g, col, 1.4, () => { for (let l = 0; l < lv; l++) { const ly = y + l * (h / lv); g.moveTo(x, ly); g.lineTo(x + 60, ly); g.moveTo(x, ly - 14); g.lineTo(x, ly); g.moveTo(x + 60, ly - 14); g.lineTo(x + 60, ly); g.moveTo(x + 4, ly); g.lineTo(x + 56, ly + h / lv); } }, 0.12);
  }

  /** Pavement, kerb, road with a double sodium line (like the iso roads), and the things that live on it. */
  private street(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, rain: boolean, time: number): void {
    const padH = H * 0.1, roadY = ground + padH;
    g.fillStyle = INK2; g.fillRect(0, ground, W, padH);
    g.strokeStyle = "rgba(238,228,211,.1)"; g.setLineDash([5, 5]); g.lineWidth = 1; g.beginPath(); g.moveTo(0, ground + padH * 0.5); g.lineTo(W, ground + padH * 0.5); g.stroke(); g.setLineDash([]);   // the footer's dashed hairline
    g.fillStyle = "rgba(238,228,211,.35)"; g.fillRect(0, roadY - 3, W, 3);
    g.fillStyle = INK; g.fillRect(0, roadY, W, H - roadY);
    const ly = roadY + (H - roadY) * 0.5;
    g.fillStyle = SODIUM; g.globalAlpha = 0.7; g.fillRect(0, ly, W, 2); g.fillRect(0, ly + 6, W, 2); g.globalAlpha = 1;
    g.fillStyle = "rgba(238,228,211,.35)"; for (let x = -(off % 120) - 120; x < W; x += 120) g.fillRect(x, roadY + (H - roadY) * 0.82, 56, 3);
    const SEG = 300, i0 = Math.floor((off - W / 2) / SEG) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 13 + 5), h2 = hash(i * 29 + 1);
      if (x < -260 || x > W + 260) continue;
      if (h < 0.18 || rain) { g.strokeStyle = pickOf(BULBS, i); g.globalAlpha = 0.25; g.lineWidth = 2; g.beginPath(); g.ellipse(x + h2 * 120, ly + 44 + h2 * 20, 30 + h * 70, 4 + h2 * 3, 0, 0, 6.283); g.stroke(); g.globalAlpha = 1; }   // a puddle holding a bulb's colour
      if (h < 0.34) this.car(g, x + 40, roadY + (H - roadY) * 0.3, pickOf(NEONS, i * 5), h2 < 0.5 ? 1 : -1, night);
      if (h2 < 0.28) this.mailbox(g, x + 220, ground + padH * 0.8);
      else if (h2 < 0.5) this.bin(g, x + 200, ground + padH * 0.8);
      if (hash(i * 3 + 8) < 0.3) this.bench(g, x + 120, ground + padH * 0.7);
      else if (hash(i * 3 + 9) < 0.4) this.tree(g, x + 100, ground + padH * 0.85, i);
    }
    void time;
  }

  /** A parked sedan as one neon outline over a dark body (original shape), wheels with paper rims, lamps lit. */
  private car(g: CanvasRenderingContext2D, x: number, y: number, col: string, dir: number, night: number): void {
    g.save(); g.translate(x + 95, y); g.scale(dir, 1); g.translate(-95, 0);
    const body = () => { g.moveTo(-4, -22); g.lineTo(-4, -44); g.quadraticCurveTo(0, -48, 22, -48); g.lineTo(52, -50); g.quadraticCurveTo(66, -82, 96, -82); g.lineTo(124, -82); g.quadraticCurveTo(144, -80, 150, -52); g.lineTo(196, -46); g.lineTo(202, -30); g.lineTo(202, -22); g.closePath(); };
    g.fillStyle = INK; g.beginPath(); body(); g.fill(); g.fillStyle = col; g.globalAlpha = 0.14; g.beginPath(); body(); g.fill(); g.globalAlpha = 1;
    neon(g, col, 2.2, body, 0.22);
    g.fillStyle = INK2; for (const [a, b] of [[62, 92], [98, 124]]) { g.beginPath(); g.moveTo(a, -50); g.quadraticCurveTo(a + 4, -74, a + 14, -75); g.lineTo(b, -75); g.lineTo(b + 2, -50); g.closePath(); g.fill(); }
    g.fillStyle = SODIUM; g.fillRect(194, -40, 8, 8); g.fillStyle = RED; g.fillRect(-3, -40, 4, 6);                     // lamps
    for (const wx of [38, 160]) { g.fillStyle = INK; g.beginPath(); g.arc(wx, -14, 17, 0, 6.283); g.fill(); neon(g, PAPER, 1.6, () => g.arc(wx, -14, 12, 0, 6.283), 0.1); }
    if (night > 0.3) { g.globalCompositeOperation = "lighter"; const bm = g.createLinearGradient(200, 0, 330, 0); bm.addColorStop(0, `rgba(246,182,44,${0.3 * night})`); bm.addColorStop(1, "rgba(246,182,44,0)"); g.fillStyle = bm; g.beginPath(); g.moveTo(200, -40); g.lineTo(330, -70); g.lineTo(330, 10); g.lineTo(200, -28); g.fill(); g.globalCompositeOperation = "source-over"; }
    g.restore();
  }

  private tree(g: CanvasRenderingContext2D, x: number, y: number, i: number): void {
    g.strokeStyle = DIM; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 92); g.stroke();
    for (let k = 0; k < 7; k++) { const cx = x + (hash(i * 7 + k) - 0.5) * 66, cy = y - 118 + (hash(i * 11 + k) - 0.5) * 40, r = 16 + hash(i * 3 + k) * 12; g.fillStyle = "#17301c"; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill(); }
    neon(g, ACID, 1.3, () => { for (let k = 0; k < 7; k += 2) { const cx = x + (hash(i * 7 + k) - 0.5) * 66, cy = y - 118 + (hash(i * 11 + k) - 0.5) * 40, r = 16 + hash(i * 3 + k) * 12; g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, 6.283); } }, 0.12);
  }
  private mailbox(g: CanvasRenderingContext2D, x: number, y: number): void { g.fillStyle = INK; g.fillRect(x - 11, y - 46, 22, 46); rectEdge(g, x - 11, y - 46, 22, 46, RED, 1.6, 0.25); g.fillStyle = RED; g.fillRect(x - 7, y - 36, 14, 3); }
  private bin(g: CanvasRenderingContext2D, x: number, y: number): void { g.fillStyle = INK; g.fillRect(x - 15, y - 36, 30, 36); rectEdge(g, x - 15, y - 36, 30, 36, ACID, 1.4, 0.2); g.fillStyle = ACID; g.fillRect(x - 15, y - 40, 30, 4); }
  private bench(g: CanvasRenderingContext2D, x: number, y: number): void { neon(g, SODIUM, 1.8, () => { g.moveTo(x - 34, y - 30); g.lineTo(x + 34, y - 30); g.moveTo(x - 34, y - 44); g.lineTo(x + 34, y - 44); g.moveTo(x - 28, y - 30); g.lineTo(x - 28, y); g.moveTo(x + 28, y - 30); g.lineTo(x + 28, y); }, 0.15); }

  /** Thin lamp posts with a warm globe. Lit windows and shop glass bloom into the dark. */
  private lights(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, time: number): void {
    const SEG = 420, i0 = Math.floor((off - W / 2) / SEG) - 1, py = ground + H * 0.1 + 8;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2 + 140;
      if (x < -150 || x > W + 150) continue;
      const flick = hash(i) < 0.2 ? (Math.sin(time * 23 + i) > 0.6 ? 0.55 : 1) : 1, y = py - 190;
      g.strokeStyle = DIM; g.lineWidth = 3; g.beginPath(); g.moveTo(x, py); g.lineTo(x, y); g.stroke();
      g.fillStyle = night > 0.2 ? SODIUM : DIM; g.beginPath(); g.arc(x, y - 6, 9, 0, 6.283); g.fill();
      const a = (0.2 + 0.45 * night) * flick;
      g.globalCompositeOperation = "lighter";
      let gr = g.createRadialGradient(x, y, 0, x, y, 220); gr.addColorStop(0, `rgba(246,182,44,${a * 0.8})`); gr.addColorStop(1, "rgba(246,182,44,0)"); g.fillStyle = gr; g.fillRect(x - 220, y - 220, 440, 440);
      gr = g.createRadialGradient(x, py, 0, x, py, 170); gr.addColorStop(0, `rgba(246,182,44,${a * 0.5})`); gr.addColorStop(1, "rgba(246,182,44,0)"); g.fillStyle = gr; g.fillRect(x - 170, py - 110, 340, 260);
      g.globalCompositeOperation = "source-over";
    }
    if (night > 0.05) for (let i = 0; i < this.glow.length; i += 4) {
      const x = this.glow[i], y = this.glow[i + 1], w = this.glow[i + 2], h = this.glow[i + 3];
      g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(246,182,44,${0.14 * night})`; g.fillRect(x - 10, y - 8, w + 20, h + 24); g.globalCompositeOperation = "source-over";
    }
  }

  /** The footer's string of bulbs, strung across the whole street from lamp to lamp, with the "THE MOSAICS" tag and a disco ball. */
  private overhead(g: CanvasRenderingContext2D, W: number, off: number, ground: number, night: number, time: number): void {
    const SEG = 420, i0 = Math.floor((off - W / 2) / SEG) - 1, py = ground + (W > 0 ? 0 : 0) + 0, y = ground * 0.3, glow = 0.55 + 0.45 * night;
    void py;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2 + 140;
      bulbString(g, x, y, x + SEG, y + 6, 34, time, i * 3, glow);
      if (hash(i + 3) < 0.22) { const bx = x + SEG / 2, by = y + 36; g.strokeStyle = "rgba(238,228,211,.3)"; g.beginPath(); g.moveTo(bx, by - 8); g.lineTo(bx, by + 6); g.stroke(); g.fillStyle = PAPER; g.globalAlpha = 0.9; g.beginPath(); g.arc(bx, by + 14, 8, 0, 6.283); g.fill(); g.globalAlpha = 0.12 * glow; g.beginPath(); g.arc(bx, by + 14, 26, 0, 6.283); g.fill(); g.globalAlpha = 1; }   // a disco ball
      if (i % 5 === 0) tag(g, x + 20, y + 56, "THE MOSAICS", "#ff7ad9", -0.035, 10);
    }
  }
}
