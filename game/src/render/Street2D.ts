import { Phys, type Character } from "../entities/types";
import { dressOf } from "../mind/Dress";
import { NOIR, SHOP_NAMES, hash01, pickOf, shade, muted, worldWall } from "./noir";
import type { Simulation } from "../sim/Simulation";
import { pose, solve, J, drawFigure, reachArm, type Angles } from "./StickFigure";

// ragdoll: a fallen figure goes limp, and blends back to its normal pose when it recovers
const LIMP: Partial<Angles> = { lean: 0.9, lying: 1, tilt: 0.6, armL: 2.4, armR: 2.7, foreL: 0.6, foreR: 0.6, thighL: 0.5, thighR: -0.4, bendL: 0.3, bendR: 0.2, bob: -2, hipX: 0 };
const ragdoll = new Map<number, number>();

/**
 * The 2D street view, in Louis's noir style (render/noir.ts): a dusk-blue city street with brick tenements,
 * lit shopfronts, parked sedans, thin lamp posts and small outlined people, seen side-on. The scene is drawn at
 * device resolution (capped at 2x for phones) so houses and figures stay sharp when zoomed in.
 *
 * Who is on screen is decided by `StreetCast` (pure, tested). People used to vanish because the
 * old filter was a hard +/-1.6 band across the street plus a nearest-7 cut; anyone strolling off
 * that band, or the 8th nearest, simply popped out of existence. The cast now has a wide band, a
 * soft fade at its edge, hysteresis on the cap and smoothed positions.
 */

// neon line colours from LOOK.md, one per person (same set as the zoomed-out figures)
const NEON = ["#c6ff3d", "#ff7ad9", "#3dd6ff", "#f6b62c", "#ec2a1c", "#eee4d3", "#b48cff"] as const;

// ------------------------------------------------------------------ who is on screen (pure)
export interface CastChar { id: number; x: number; y: number; inside: number; inCar: number }
export interface CastSlot { id: number; x: number; dv: number; alpha: number }

/** Depth (iso x+y) either side of the focus that still counts as "on this street". */
export const BAND_FULL = 2.6;
export const BAND_OUT = 5;
const HYST = 1.6;   // a person already on screen counts this much closer than they are, so the cap never flickers
const MIN_GAP_K = 56;
/** px per lateral unit used to place people. Fixed (the zoom-3 value) so zooming never slides people across the screen. */
const LAYOUT_S = 18 * (3 - 1.2);
/** How much closer the side-on street view sits: 1 is the layout as drawn, bigger is closer. */
const CLOSE = 1.2;

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
// The look is Louis's "noir pixel" style (see render/noir.ts and art-requests/003-010): a dusk-blue city,
// warm brick, lit amber windows, parked cars, thin lamp posts, small people with a one-pixel outline.
const INK = NOIR.ink;
const hash = hash01;
const GLOWS = 48;

/** Draw a rect with a 1-unit ink outline: the whole style in one helper. */
const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, o = 1.5): void => { g.fillStyle = INK; g.fillRect(x - o, y - o, w + o * 2, h + o * 2); g.fillStyle = fill; g.fillRect(x, y, w, h); };

export class StreetView {
  readonly cast = new StreetCast();
  private lo = document.createElement("canvas");
  private glow = new Float32Array(GLOWS * 4);
  private nGlow = 0;

  /** Returns true when it drew; `dest` is the visible canvas context (already scaled to CSS px). */
  draw(dest: CanvasRenderingContext2D, dpr: number, sim: Simulation, f: Character, W: number, H: number, _zoom: number, dt: number, time: number, poseName: (c: Character, moving: boolean, spd: number) => string): void {
    // full device resolution (capped at 2x for phones): figures and houses are drawn sharp, not as a chunky pixel grid
    const res = Math.min(dpr, 2);
    const lw = Math.ceil(W * res), lh = Math.ceil(H * res);
    if (this.lo.width !== lw || this.lo.height !== lh) { this.lo.width = lw; this.lo.height = lh; }
    const g = this.lo.getContext("2d")!;
    g.setTransform(res, 0, 0, res, 0, 0);               // draw in CSS px
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.lineCap = "round"; g.lineJoin = "round";
    const pu = (f.x - f.y) / 1.414, pv = f.x + f.y;
    // the street's scale is fixed (the same as the people's layout), so zooming never moves the scenery: only walking does
    const S = LAYOUT_S, ground = H * 0.62, day = sim.daylight, night = 1 - Math.min(1, day * 1.3);
    const rain = sim.env.raining, off = pu * S;
    this.nGlow = 0;
    this.backdrop(g, sim, W, pu, pv, S, ground, day, time);
    this.facades(g, sim, W, H, off, pv, S, ground, day, time);
    this.street(g, W, H, off, ground, night, rain, time);
    // kerb bushes are fixed to the world: they slide only when you walk, never when you zoom or pan
    const BUSH_P = 2720;
    for (let i = 0; i < 16; i++) {
      const bx = ((((hash(i + 700) * BUSH_P) - off) % BUSH_P) + BUSH_P) % BUSH_P - 40, by = ground + 2 + hash(i + 710) * 6, br = 14 + hash(i + 720) * 16;
      g.fillStyle = "#14321f"; g.beginPath(); g.ellipse(bx, by, br, br * 0.7, 0, 0, 6.283); g.fill();
      g.fillStyle = "#2c5a36"; g.beginPath(); g.ellipse(bx - br * 0.2, by - br * 0.2, br * 0.6, br * 0.4, 0, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 6; i++) {
      const px = ((hash(i + 800) * W + time * (6 + hash(i + 810) * 6)) % (W + 40)) - 20, py = ground + 14 + hash(i + 820) * 8;
      g.strokeStyle = NEON[(i + 3) % NEON.length]; g.lineWidth = 1.4; g.beginPath(); g.ellipse(px, py, 5, 3, 0, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(px + 4, py - 1); g.lineTo(px + 8, py - 3); g.stroke();
    }
    // dusk settles over the set; the lamps and lit windows then burn through it
    if (night > 0.05) { g.fillStyle = `rgba(14,10,36,${0.55 * night})`; g.fillRect(0, 0, W, H); }
    this.lights(g, W, H, off, ground, night, time);
    // people
    // figure size is fixed: zooming in and out does not change how big people are drawn
    const kk = 0.62;
    // who is on the street and their spacing come from the world, not the zoom: zoom does not change figure size or spacing
    const slots = this.cast.pick(sim.chars, f, W, LAYOUT_S, 1, dt, W < 700 ? 8 : 11);
    const drawn: { c: Character; x: number; y: number; k: number; dv: number }[] = [];
    for (const s of slots) {
      const c = sim.chars[s.id]; if (!c) continue;
      // no depth perspective: everyone stands on the same line at the same size, so walking never shifts them
      const k = kk * c.look.scale, sy = ground + H * 0.1;
      const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.0005, spd = Math.hypot(c.x - c.px, c.y - c.py) * 60;
      c.anim.phase += spd * dt * 5.5;
      const dir = (Math.cos(c.facing) - Math.sin(c.facing)) >= 0 ? 1 : -1;
      g.globalAlpha = s.alpha * 0.45; g.fillStyle = NOIR.night; g.beginPath(); g.ellipse(s.x, sy, 22 * k, 4.5 * k, 0, 0, 6.283); g.fill();
      g.globalAlpha = s.alpha;
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
      this.person(g, c, k, dir, c.anim.flash > 0, 1, night);
      g.globalAlpha = 1;
      drawn.push({ c, x: s.x, y: sy, k, dv: s.dv });
    }
    // mood over the top: dark corners and a violet wash, rain
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.32, W / 2, H * 0.55, H); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(8,5,18,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "soft-light"; g.fillStyle = night > 0.4 ? "rgba(90,70,170,.28)" : "rgba(150,120,200,.18)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    if (rain) { g.strokeStyle = "rgba(170,190,230,.4)"; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 90; i++) { const x = (hash(i) * W + time * 60) % W, y = (hash(i + 500) * H + time * 520) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 16); } g.stroke(); }

    // blow it up, crisp, a little closer than the raw layout (scaled about the middle of the view)
    const cx = W / 2, cy = H / 2, zx = (x: number) => cx + (x - cx) * CLOSE, zy = (y: number) => cy + (y - cy) * CLOSE;
    dest.setTransform(1, 0, 0, 1, 0, 0);
    dest.imageSmoothingEnabled = true;
    dest.drawImage(this.lo, 0, 0, lw, lh, (W - W * CLOSE) / 2 * dpr, (H - H * CLOSE) / 2 * dpr, W * dpr * CLOSE, H * dpr * CLOSE);
    dest.setTransform(dpr, 0, 0, dpr, 0, 0);
    // text stays sharp: bubbles, your marker, the street name
    for (const d of drawn) {
      const c = d.c, x = zx(d.x), y = zy(d.y);
      if (c.bubble && c.bubble.until > sim.tick && Math.abs(d.dv) < 3) {
        dest.font = "600 13px 'IBM Plex Mono', monospace"; dest.textAlign = "center";
        const txt = c.bubble.text.slice(0, 44), tw = Math.min(280, dest.measureText(txt).width + 16), by = y - 125 * d.k * CLOSE - 28;
        dest.fillStyle = INK; dest.fillRect(x - tw / 2 - 2, by - 2, tw + 4, 26);
        dest.fillStyle = "#efe4cc"; dest.fillRect(x - tw / 2, by, tw, 22);
        dest.fillStyle = INK; dest.fillText(txt, x, by + 15);
      }
      if (c.id === f.id) { dest.fillStyle = "#e8483a"; dest.strokeStyle = INK; dest.lineWidth = 3; dest.font = "800 13px 'IBM Plex Mono', monospace"; dest.textAlign = "center"; dest.strokeText("YOU", x, y + 22); dest.fillText("YOU", x, y + 22); }
    }
    dest.textAlign = "start"; dest.fillStyle = "rgba(239,228,204,.75)"; dest.font = "600 12px 'IBM Plex Mono', monospace";
    dest.fillText(`${sim.world.streetName(f.x, f.y)} · V or scroll out for 3D`, 16, 66);
  }

  /** A soft shadow band: four stacked strips that deepen downward. No checker patterns anywhere: they read as a criss-cross lattice. */
  private band(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number): void {
    g.save();
    for (let i = 0; i < 4; i++) { g.globalAlpha *= 1; g.fillStyle = `rgba(8,5,18,${(alpha * (0.35 + i * 0.3)).toFixed(3)})`; g.fillRect(x, y + (h * i) / 4, w, Math.ceil(h / 4)); }
    g.restore();
  }
  private lit(x: number, y: number, w: number, h: number): void {
    if (this.nGlow >= GLOWS) return; const i = this.nGlow++ * 4; this.glow[i] = x; this.glow[i + 1] = y; this.glow[i + 2] = w; this.glow[i + 3] = h;
  }

  // ---- sky, far skyline, telegraph poles and wires
  private backdrop(g: CanvasRenderingContext2D, sim: Simulation, W: number, pu: number, pv: number, S: number, ground: number, day: number, time: number): void {
    const sky = g.createLinearGradient(0, 0, 0, ground);
    // LOOK.md: a near-black street at every hour, lit by people and lamps (no blue or brown washes)
    sky.addColorStop(0, NOIR.skyTop); sky.addColorStop(0.7, NOIR.skyLow); sky.addColorStop(1, NOIR.skyDusk);
    g.fillStyle = sky; g.fillRect(0, 0, W, ground);
    if (day < 0.4) { g.fillStyle = "rgba(240,230,210,.8)"; for (let i = 0; i < 40; i++) g.fillRect(((hash(i) * W + pu * S * 0.04) % W + W) % W, hash(i + 90) * ground * 0.35, 2, 2); }
    // two hazy layers of far city behind everything, so the horizon is never bare sky
    const farCol = day > 0.85 ? ["#9aa6bd", "#7f8aa6"] : day > 0.4 ? ["#8a6e70", "#6c5560"] : day > 0.2 ? ["#4a3c52", "#33283e"] : ["#1c1a26", "#13111a"];
    for (let layer = 0; layer < 2; layer++) {
      const SW = 150 - layer * 30, o = pu * S * (0.05 + layer * 0.07), j0 = Math.floor((o - W / 2) / SW) - 1;
      for (let i = j0; i < j0 + Math.ceil(W / SW) + 3; i++) {
        const hh = hash(i * 3 + layer * 50 + 1), x = i * SW - o + W / 2, w = SW * (0.75 + hash(i * 7 + layer) * 0.5), h = ground * (0.2 + hh * (0.55 - layer * 0.14));
        g.fillStyle = farCol[layer]; g.fillRect(x, ground - h, w, h);
        if (hash(i * 11 + layer * 3) < 0.14) { g.beginPath(); g.moveTo(x + w * 0.35, ground - h); g.lineTo(x + w * 0.5, ground - h - 70 - hh * 40); g.lineTo(x + w * 0.65, ground - h); g.closePath(); g.fill(); }   // a spire: Cathedral Square's neighbours
        else if (hash(i * 13 + layer) < 0.3) { g.fillRect(x + w * 0.5, ground - h - 26, 2, 26); if (day < 0.35 && Math.sin(time * 2 + i) > 0) { g.fillStyle = "#ff3b2f"; g.fillRect(x + w * 0.5 - 1, ground - h - 29, 4, 4); } }   // an aerial with a red lamp
        if (day < 0.5) { g.fillStyle = day < 0.25 ? `rgba(255,196,110,${0.5 - layer * 0.15})` : "rgba(255,196,110,.22)"; for (let r = 0; r < h / 16; r++) for (let c = 0; c < w / 14; c++) if (hash(i * 31 + r * 7 + c + layer * 99) < 0.22) g.fillRect(x + 5 + c * 14, ground - h + 8 + r * 16, 4, 6); }
      }
    }
    const base = day > 0.4 ? "#5c4e54" : "#16131c";
    const bs = sim.world.buildings.map((b) => ({ b, u: ((b.x0 + b.x1 + 1) / 2 - (b.y0 + b.y1 + 1) / 2) / 1.414, v: (b.x0 + b.x1 + b.y0 + b.y1 + 2) / 2, w: (b.x1 - b.x0 + b.y1 - b.y0 + 2) / 1.6 }))
      .filter((q) => q.v < pv + 4 && q.v > pv - 40).sort((a, c) => a.v - c.v);
    for (const q of bs) {
      const depth = Math.max(0, (pv - q.v) / 40), k = 1 - depth * 0.55, par = 0.2 + 0.3 * k;
      const x = W / 2 + (q.u - pu) * S * par, w = Math.max(24, q.w * S * k * 0.8), h = Math.min(ground * 0.85, q.b.height * S * 0.6 * k);
      if (x + w / 2 < 0 || x - w / 2 > W) continue;
      g.fillStyle = base; g.fillRect(x - w / 2, ground - h, w, h);
      g.fillStyle = INK; g.fillRect(x - w / 2 - 2, ground - h - 2, w + 4, 3);
      const lit = day < 0.4 ? "rgba(255,196,100,.8)" : "rgba(255,230,190,.22)";
      for (let r = 0; r < 4; r++) for (let cI = 0; cI < 3; cI++) if (hash(q.b.id * 17 + r * 5 + cI) < 0.35) { g.fillStyle = lit; g.fillRect(x - w / 2 + 8 + cI * (w - 16) / 3, ground - h + 10 + r * 20, 8, 10); }
    }
    // a telegraph pole line with sagging wires, far behind the facades
    const sp = 520, o = pu * S * 0.18;
    g.strokeStyle = INK; g.lineWidth = 2;
    for (let i = Math.floor(o / sp) - 1; i < Math.floor(o / sp) + Math.ceil(W / sp) + 2; i++) {
      const x = i * sp - o + W / 2, ty = ground * 0.28;
      g.fillStyle = INK; g.fillRect(x - 3, ty, 6, ground - ty); g.fillRect(x - 22, ty + 6, 44, 4);
      g.beginPath(); g.moveTo(x - 20, ty + 8); g.quadraticCurveTo(x + sp / 2, ty + 42 + Math.sin(time * 0.5 + i) * 1.5, x - 20 + sp, ty + 8); g.stroke();
    }
    // pixel cloud streaks drifting slowly, tinted by the hour
    const cl = day > 0.6 ? "255,230,210" : day > 0.2 ? "230,150,140" : "120,110,170";
    for (let i = 0; i < 6; i++) {
      const cx = (((hash(i + 40) * W * 1.5 + pu * S * 0.02 - time * (2 + hash(i) * 3)) % (W + 360)) + W + 360) % (W + 360) - 180, cy = ground * (0.08 + hash(i + 70) * 0.34), cw = 120 + hash(i + 9) * 160;
      g.fillStyle = `rgba(${cl},${day > 0.2 ? 0.3 : 0.12})`; g.fillRect(cx, cy, cw, 8); g.fillRect(cx + cw * 0.15, cy - 6, cw * 0.55, 6); g.fillRect(cx + cw * 0.3, cy + 8, cw * 0.6, 5);
    }
  }

  /** The long street wall: tenements, shopfronts, a stone bank, alley mouths with fire escapes. */
  private facades(g: CanvasRenderingContext2D, sim: Simulation, W: number, H: number, off: number, pv: number, S: number, ground: number, day: number, time: number): void {
    const SEG = 280, i0 = Math.floor((off - W / 2) / SEG) - 1, n = Math.ceil(W / SEG) + 3;
    const wallH = H * 0.54, dim = day > 0.4 ? 1 : 0.85;
    for (let i = i0; i < i0 + n; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 7 + 3);
      if (x > W + SEG || x < -SEG) continue;
      const kind = h < 0.32 ? 0 : h < 0.58 ? 1 : h < 0.74 ? 2 : h < 0.86 ? 3 : 4;
      const hh = wallH * (0.7 + hash(i * 5) * 0.68), top = ground - hh;
      if (kind === 3) { this.alley(g, x, SEG, top, ground, i); continue; }
      const mat = kind === 2 ? NOIR.wallStone : kind === 4 ? NOIR.wallPlaster : NOIR.wallBrick;
      const wb = this.neighbour(sim, (i + 0.5) * SEG / S, pv);                // the real building this stretch of wall stands for
      const col = shade(worldWall(pickOf(mat, i * 31), wb?.color), dim);
      box(g, x, top, SEG, hh, col, 2);
      // brick coursing: faint horizontal joints and a few lighter bricks, no bitmap needed
      if (kind !== 2) { g.fillStyle = "rgba(20,10,20,.22)"; for (let y = top + 6; y < ground; y += 8) g.fillRect(x, y, SEG, 1); g.fillStyle = "rgba(255,210,170,.1)"; for (let k = 0; k < 14; k++) g.fillRect(x + hash(i * 9 + k) * (SEG - 10), top + 6 + Math.floor(hash(i * 13 + k) * (hh / 8)) * 8, 9, 3); }
      else { g.fillStyle = "rgba(20,20,40,.25)"; for (let p = 0; p <= SEG; p += SEG / 4) g.fillRect(x + p - 3, top, 6, hh); }        // pilasters
      // cornice and a stone string course
      box(g, x - 3, top - 5, SEG + 6, 8, shade(col, 0.7), 1.5); g.fillStyle = NOIR.sill; g.fillRect(x - 2, top - 3, SEG + 4, 2);
      this.roofKit(g, x, top, SEG, col, i, day, time);
      const floors = hh > wallH * 1.22 ? 4 : hh > wallH * 0.95 ? 3 : 2, fh = (hh - H * 0.17) / floors;
      for (let fl = 0; fl < floors; fl++) {
        for (let w = 0; w < 3; w++) {
          const wx = x + 30 + w * 80, wy = top + 16 + fl * fh, ww = 34, wh = Math.min(fh - 22, 54);
          this.window(g, wx, wy, ww, wh, hash(i * 11 + fl * 3 + w), day);
        }
      }
      const dy = ground - H * 0.17;                                   // ground floor
      if (kind === 1) { this.shop(g, x, dy, SEG, ground, i, col, wb?.sign); this.bladeSign(g, x + SEG - 34, dy - 74, i, day); }
      else this.entry(g, x, dy, ground, i, col);
      if (kind === 0 && hash(i * 17) < 0.5) this.fireEscape(g, x + SEG - 70, top + 20, ground - H * 0.17 - top - 20);
      // drainpipe and the dark foot of the wall
      box(g, x + SEG - 12, top, 6, hh, shade(col, 0.6), 1);
      this.band(g, x, ground - H * 0.06, SEG, H * 0.06, 0.3);
    }
    g.fillStyle = INK; g.fillRect(0, ground - 3, W, 5);
  }

  /** The world building closest to the street wall at street position u (scene units), looked for either side of the road. */
  private neighbour(sim: Simulation, u: number, pv: number): { color: string; sign: string } | undefined {
    for (const d of [-3, 3, -4.5, 4.5]) {
      const p = pv + d, tx = Math.round((p + u * 1.414) / 2), ty = Math.round((p - u * 1.414) / 2), b = sim.world.buildingAt(tx, ty);
      if (b) return b;
    }
    return undefined;
  }

  private window(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, day: number): void {
    box(g, x - 3, y - 6, w + 6, 5, NOIR.sill, 1.5);                                 // lintel
    const on = r < 0.4, noon = day > 0.5;
    box(g, x, y, w, h, on ? (noon ? "#a89a88" : NOIR.glassLit) : NOIR.glassDark, 1.5);
    if (on) { if (!noon) this.lit(x, y, w, h); g.fillStyle = "rgba(60,20,20,.35)"; g.fillRect(x, y, 6, h); g.fillRect(x + w - 6, y, 6, h); if (r < 0.15) { g.fillStyle = INK; g.fillRect(x + w / 2 - 3, y + h * 0.4, 6, h * 0.6); g.fillRect(x + w / 2 - 2, y + h * 0.28, 4, 4); } }  // curtains, a figure behind the glass
    else { g.fillStyle = "rgba(160,170,220,.18)"; g.beginPath(); g.moveTo(x + 4, y + h - 4); g.lineTo(x + w * 0.5, y + 4); g.lineTo(x + w * 0.7, y + 4); g.lineTo(x + 12, y + h - 4); g.fill(); if (r > 0.88) { g.fillStyle = "#6a4a2c"; g.fillRect(x, y + 6, w, 6); g.fillRect(x, y + h * 0.55, w, 6); } }
    g.fillStyle = INK; g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + h * 0.45, w, 2);   // mullions
    box(g, x - 3, y + h + 1, w + 6, 4, NOIR.sill, 1.2);                              // sill
    g.fillStyle = "rgba(10,6,20,.45)"; g.fillRect(x, y, w, 3);                      // reveal shadow under the lintel
  }

  private entry(g: CanvasRenderingContext2D, x: number, dy: number, ground: number, i: number, col: string): void {
    const dh = ground - dy;
    box(g, x + 30, dy + 4, 44, dh - 4, "#4a3322", 1.5); g.fillStyle = NOIR.glassLit; g.fillRect(x + 36, dy + 8, 32, 16); this.lit(x + 36, dy + 8, 32, 16);
    g.fillStyle = INK; g.fillRect(x + 51, dy + 8, 2, 16); g.fillStyle = "#c9a24a"; g.fillRect(x + 62, dy + dh * 0.55, 4, 4);
    box(g, x + 24, ground - 6, 56, 6, NOIR.pave, 1.2);                                // step
    box(g, x + 110, dy + 6, 40, dh - 6, NOIR.glassDark, 1.5);                        // ground-floor window
    g.fillStyle = hash(i * 3) < 0.5 ? "#e8d8a8" : "#c0503a"; g.fillRect(x + 114, dy + 12, 14, 18);   // a poster
    if (hash(i * 9) < 0.45) { g.fillStyle = "#3a6a48"; g.fillRect(x + 122, dy - 2, 16, 8); g.fillRect(x + 126, dy - 6, 8, 6); }   // window box
    void col;
  }

  private shop(g: CanvasRenderingContext2D, x: number, dy: number, SEG: number, ground: number, i: number, col: string, sign?: string): void {
    const dh = ground - dy, name = pickOf(SHOP_NAMES, i * 7 + 1), aw = sign ? muted(sign, 0.8) : pickOf(NOIR.awning, i * 3);
    box(g, x + 8, dy - 26, SEG - 16, 22, NOIR.trim, 1.5);                             // fascia board
    g.fillStyle = "#e8d8a8"; g.font = "800 19px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.fillText(name, x + SEG / 2, dy - 9); g.textAlign = "start";
    box(g, x + 8, dy, SEG - 16, dh, "#241f1c", 1.5);
    const g2 = [x + 16, x + SEG / 2 + 28];
    for (let q = 0; q < 2; q++) { box(g, g2[q], dy + 8, SEG / 2 - 44, dh - 16, hash(i + q) < 0.75 ? NOIR.glassLit : NOIR.glassDark, 1.5); this.lit(g2[q], dy + 8, SEG / 2 - 44, dh - 16); g.fillStyle = INK; g.fillRect(g2[q] + 8, dy + dh - 34, 30, 22); g.fillRect(g2[q] + 50, dy + dh - 44, 22, 32); }  // shelves and stock in silhouette
    box(g, x + SEG / 2 - 22, dy + 10, 44, dh - 10, "#3a2a1e", 1.5); g.fillStyle = NOIR.glassLit; g.fillRect(x + SEG / 2 - 16, dy + 14, 32, 14);   // door
    for (let s = 0; s < 10; s++) { g.fillStyle = s % 2 ? NOIR.sill : aw; g.fillRect(x + 6 + s * ((SEG - 12) / 10), dy - 2, (SEG - 12) / 10 + 1, 14); } // striped awning
    g.fillStyle = INK; g.fillRect(x + 6, dy + 12, SEG - 12, 2);
    void col;
  }

  private alley(g: CanvasRenderingContext2D, x: number, SEG: number, top: number, ground: number, i: number): void {
    // the mouth of an alley: the back of the next street, a long way off, with a life of its own
    const ax = x + 14, aw = SEG - 28, ah = ground - top - 10, ay = top + 10, r = hash(i * 3), fy = Math.max(ay, ground - 470);   // fy: the lived-in part of the wall, within sight of the pavement
    const wall = g.createLinearGradient(0, ay, 0, ground); wall.addColorStop(0, "#2e2630"); wall.addColorStop(0.6, "#3c3038"); wall.addColorStop(1, "#1a1418");
    g.fillStyle = INK; g.fillRect(ax - 2, ay - 2, aw + 4, ah + 2); g.fillStyle = wall; g.fillRect(ax, ay, aw, ah);
    g.fillStyle = "rgba(10,6,20,.3)"; for (let y = ay + 6; y < ground; y += 8) g.fillRect(ax, y, aw, 1);                       // back-wall brick joints
    g.fillStyle = "#171124"; g.fillRect(ax, ay, 16, ah); g.fillRect(ax + aw - 16, ay, 16, ah);                                    // the side walls fall away in shadow
    for (let k = 0; k < 2; k++) { const wx = ax + 54 + k * 92, wy = fy + 24 + hash(i * 5 + k) * 60, on = hash(i * 7 + k) < 0.65; box(g, wx, wy, 28, 38, on ? NOIR.glassLit : NOIR.glassDark, 1.5); if (on) this.lit(wx, wy, 28, 38); g.fillStyle = INK; g.fillRect(wx + 13, wy, 2, 38); }
    // washing strung across, a lantern, a neon blade, bins and crates
    const ly = fy + 150 + r * 14; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(ax + 6, ly); g.quadraticCurveTo(ax + aw / 2, ly + 22, ax + aw - 6, ly - 4); g.stroke();
    const cl = ["#eee4d3", "#3d7ad9", "#ec2a1c", "#f6b62c"]; for (let k = 0; k < 4; k++) { g.fillStyle = cl[(i + k) % 4]; g.fillRect(ax + 40 + k * 44, ly + 10 + Math.sin(k) * 4, 14, 20); }
    g.fillStyle = "#ffd27a"; g.fillRect(ax + aw / 2 - 3, fy + 4, 6, 8); this.lit(ax + aw / 2 - 3, fy + 4, 6, 8);
    if (r < 0.55) { g.fillStyle = "#ff4fb8"; g.fillRect(ax + aw - 40, fy + 190, 4, 60); g.fillStyle = "rgba(255,79,184,.5)"; g.fillRect(ax + aw - 44, fy + 190, 12, 60); }
    g.fillStyle = "#0e0a18"; g.fillRect(ax, ground - 36, aw, 36);
    box(g, ax + 28, ground - 54, 30, 54, "#3a4250", 1.5); box(g, ax + 66, ground - 40, 26, 40, "#4a3a2a", 1.5); box(g, ax + 100, ground - 28, 34, 28, "#5a4430", 1.5);
    g.fillStyle = "rgba(255,70,60,.9)"; if (r < 0.5) { g.fillRect(ax + 150, ground - 30, 3, 3); g.fillRect(ax + 164, ground - 30, 3, 3); }   // eyes in the dark
    this.fireEscape(g, ax + aw - 80, fy + 20, ground - fy - 50);
  }

  /** Things that live on a roofline: a water tank on legs, a chimney stack with pots, an aerial, a painted sign. */
  private roofKit(g: CanvasRenderingContext2D, x: number, top: number, SEG: number, col: string, i: number, day: number, time: number): void {
    const r = hash(i * 19 + 4), dark = shade(col, 0.55);
    if (r < 0.26) {          // water tank
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 70, top - 4); g.lineTo(x + 66, top - 36); g.moveTo(x + 100, top - 4); g.lineTo(x + 104, top - 36); g.stroke();
      box(g, x + 62, top - 78, 46, 42, "#6b4a30", 1.5); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x + 62, top - 78, 8, 42); g.fillStyle = INK; for (let y = top - 66; y < top - 40; y += 12) g.fillRect(x + 62, y, 46, 2);
      g.fillStyle = "#4a3322"; g.beginPath(); g.moveTo(x + 58, top - 78); g.lineTo(x + 85, top - 94); g.lineTo(x + 112, top - 78); g.closePath(); g.fill();
    } else if (r < 0.52) {   // chimney stack with pots, and a thread of smoke when it is cold
      box(g, x + 150, top - 46, 30, 44, dark, 1.5); box(g, x + 146, top - 52, 38, 8, shade(col, 0.4), 1.5);
      g.fillStyle = "#8a4a2a"; g.fillRect(x + 154, top - 66, 8, 14); g.fillRect(x + 168, top - 62, 8, 10);
      if (day < 0.7) { g.fillStyle = `rgba(210,210,225,${day < 0.4 ? 0.34 : 0.2})`; for (let k = 0; k < 4; k++) { const ph = (time * 0.2 + k / 4 + hash(i)) % 1; g.fillRect(x + 156 + Math.sin(ph * 6 + i) * 6 + ph * 10, top - 70 - ph * 60, 8 + ph * 6, 6 + ph * 4); } }
    } else if (r < 0.66) {   // aerial farm
      g.fillStyle = INK; g.fillRect(x + 90, top - 50, 3, 48); g.fillRect(x + 78, top - 44, 28, 2); g.fillRect(x + 82, top - 34, 20, 2); g.fillRect(x + 86, top - 24, 12, 2);
      if (day < 0.3 && Math.sin(time * 2.4 + i) > 0) { g.fillStyle = "#ff3b2f"; g.fillRect(x + 89, top - 55, 5, 5); }
    } else if (r < 0.76) {   // a painted roof sign
      box(g, x + 40, top - 40, SEG - 80, 28, "#2a2224", 1.5); g.fillStyle = day < 0.4 ? "#ffd27a" : "#e8d8a8"; for (let k = 0; k < 7; k++) g.fillRect(x + 54 + k * 22, top - 32, 14 + (k % 3) * 2, 12);
      g.fillStyle = INK; g.fillRect(x + 60, top - 12, 4, 10); g.fillRect(x + SEG - 64, top - 12, 4, 10);
    }
  }

  /** A blade sign on an iron bracket over a shop door. */
  private bladeSign(g: CanvasRenderingContext2D, x: number, y: number, i: number, day: number): void {
    g.fillStyle = INK; g.fillRect(x - 16, y, 18, 3); g.fillRect(x, y, 2, 10);
    const cols = ["#c0503a", "#3a6a8a", "#e8c42c", "#4a8a5a"];
    box(g, x - 10, y + 10, 26, 24, cols[i % cols.length], 1.5);
    g.fillStyle = day > 0.4 ? "#efe4cc" : "#ffe9a8"; g.fillRect(x - 6, y + 16, 18, 3); g.fillRect(x - 6, y + 23, 12, 3);
  }

  private fireEscape(g: CanvasRenderingContext2D, x: number, y: number, h: number): void {
    g.strokeStyle = INK; g.lineWidth = 3;
    const lv = Math.max(2, Math.floor(h / 70));
    for (let l = 0; l < lv; l++) { const ly = y + l * (h / lv); g.beginPath(); g.moveTo(x, ly); g.lineTo(x + 60, ly); g.moveTo(x, ly - 14); g.lineTo(x, ly); g.moveTo(x + 60, ly - 14); g.lineTo(x + 60, ly); g.stroke(); g.beginPath(); g.moveTo(x + 4, ly); g.lineTo(x + 56, ly + h / lv); g.stroke(); }
  }

  /** Pavement, kerb, road with a worn lane line, and the things that live on it. */
  private street(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, rain: boolean, time: number): void {
    const padH = H * 0.1, roadY = ground + padH;
    g.fillStyle = NOIR.pave; g.fillRect(0, ground, W, padH);
    g.fillStyle = NOIR.paveJoint; for (let x = -(off % 90) - 90; x < W; x += 90) g.fillRect(x, ground, 2, padH);
    box(g, 0, roadY - 6, W, 6, NOIR.kerb, 1.5);
    g.fillStyle = NOIR.road; g.fillRect(0, roadY, W, H - roadY);
    g.fillStyle = NOIR.roadFar; g.fillRect(0, roadY, W, (H - roadY) * 0.25); this.band(g, 0, roadY + (H - roadY) * 0.25, W, 12, 0.3);
    const ly = roadY + (H - roadY) * 0.55;
    g.fillStyle = NOIR.lane; for (let x = -(off % 120) - 120; x < W; x += 120) g.fillRect(x, ly, 64, 4);
    const SEG = 300, i0 = Math.floor((off - W / 2) / SEG) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2, h = hash(i * 13 + 5), h2 = hash(i * 29 + 1);
      if (x < -260 || x > W + 260) continue;
      if (h < 0.18 || rain) { g.fillStyle = NOIR.puddle; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(x + h2 * 120, ly + 34 + h2 * 30, 36 + h * 80, 5 + h2 * 4, 0, 0, 6.283); g.fill(); g.globalAlpha = 1; }
      g.fillStyle = "rgba(10,6,20,.5)"; g.fillRect(x + 20 + h2 * 100, ly + 22 + h * 40, 40 + h * 60, 2); g.fillRect(x + 70 + h * 80, ly + 25 + h2 * 40, 24, 2);   // cracks
      if (h2 > 0.55) { g.fillStyle = "#171424"; g.beginPath(); g.ellipse(x + 160, ly + 46, 20, 5, 0, 0, 6.283); g.fill(); g.fillStyle = "#3a3450"; g.fillRect(x + 142, ly + 45, 36, 1); }   // manhole
      if (h < 0.34) this.parked(g, x + 40, roadY + (H - roadY) * 0.34, pickOf(NOIR.cars, i * 5), h2 < 0.5 ? 1 : -1, night);
      if (h2 < 0.28) this.mailbox(g, x + 220, ground + padH * 0.8);
      else if (h2 < 0.5) this.bin(g, x + 200, ground + padH * 0.8, i);
      if (hash(i * 3 + 8) < 0.3) this.bench(g, x + 120, ground + padH * 0.7);
      else if (hash(i * 3 + 9) < 0.4) this.tree(g, x + 100, ground + padH * 0.85, i, night);
      if (h2 > 0.4 && h2 < 0.62) this.vent(g, x + 90, roadY + (H - roadY) * 0.5, time, i);
    }
    if (night > 0.3) {                                                                          // lamp light on the wet road
      const LS = 420, j0 = Math.floor((off - W / 2) / LS) - 1;
      for (let j = j0; j < j0 + Math.ceil(W / LS) + 3; j++) { const lx = j * LS - off + W / 2 + 140; for (let q = 0; q < 7; q++) { g.fillStyle = `rgba(255,200,120,${(0.28 - q * 0.035) * night})`; g.fillRect(lx - 7 + (q % 2) * 3, roadY + 10 + q * 22, 14 - q, 8); } }
    }
  }

  /** A parked 1930s-style sedan, side-on: long bonnet, rounded cabin, fenders, white-wall wheels. Original shapes. */
  private parked(g: CanvasRenderingContext2D, x: number, y: number, col: string, dir: number, night: number): void {
    g.save(); g.translate(x + 95, y); g.scale(dir, 1); g.translate(-95, 0);
    const dark = shade(col, 0.6), lite = shade(col, 1.5);
    g.fillStyle = "rgba(8,6,18,.5)"; g.beginPath(); g.ellipse(95, 4, 100, 7, 0, 0, 6.283); g.fill();
    // body: bonnet (right), cabin, boot (left)
    g.fillStyle = INK; g.beginPath(); g.moveTo(-4, -22); g.lineTo(-4, -44); g.quadraticCurveTo(0, -48, 22, -48); g.lineTo(52, -50); g.quadraticCurveTo(66, -82, 96, -82); g.lineTo(124, -82); g.quadraticCurveTo(144, -80, 150, -52); g.lineTo(196, -46); g.quadraticCurveTo(204, -44, 204, -30); g.lineTo(204, -22); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(-1, -24); g.lineTo(-1, -43); g.quadraticCurveTo(2, -45, 22, -45); g.lineTo(54, -47); g.quadraticCurveTo(67, -79, 96, -79); g.lineTo(124, -79); g.quadraticCurveTo(141, -77, 147, -49); g.lineTo(195, -43); g.quadraticCurveTo(201, -42, 201, -30); g.lineTo(201, -24); g.closePath(); g.fill();
    g.fillStyle = lite; g.fillRect(2, -44, 190, 2);                                             // light along the shoulder
    g.fillStyle = dark; g.fillRect(0, -30, 201, 7);                                             // lower sill
    g.fillStyle = NOIR.glassDark; for (const [a, b] of [[62, 92], [98, 124]]) { g.beginPath(); g.moveTo(a, -48); g.quadraticCurveTo(a + 4, -74, a + 14, -75); g.lineTo(b, -75); g.lineTo(b + 2, -48); g.closePath(); g.fill(); }
    g.fillStyle = "rgba(170,180,230,.3)"; g.fillRect(68, -70, 8, 18); g.fillRect(104, -70, 8, 18);
    g.fillStyle = lite; g.fillRect(70, -79, 56, 2);                                            // roof highlight
    g.fillStyle = INK; g.fillRect(94, -76, 3, 30);                                             // pillar
    g.fillStyle = NOIR.lampLight; g.fillRect(194, -40, 8, 8); g.fillStyle = "#b7aebb"; g.fillRect(-6, -28, 6, 8); g.fillRect(200, -26, 8, 6);   // lamp, bumpers
    for (const wx of [38, 160]) {                                                              // wheels and fender arches
      g.fillStyle = dark; g.beginPath(); g.arc(wx, -18, 25, Math.PI, 0); g.fill();
      g.fillStyle = INK; g.beginPath(); g.arc(wx, -14, 17, 0, 6.283); g.fill(); g.fillStyle = "#cfc6b0"; g.beginPath(); g.arc(wx, -14, 12, 0, 6.283); g.fill();
      g.fillStyle = "#1a1620"; g.beginPath(); g.arc(wx, -14, 8, 0, 6.283); g.fill(); g.fillStyle = "#b7aebb"; g.fillRect(wx - 2, -16, 4, 4);
    }
    g.fillStyle = "#a02020"; g.fillRect(-3, -40, 4, 6);                                        // tail lamp
    if (night > 0.3) { g.globalCompositeOperation = "lighter"; const bm = g.createLinearGradient(200, 0, 330, 0); bm.addColorStop(0, `rgba(255,214,140,${0.3 * night})`); bm.addColorStop(1, "rgba(255,214,140,0)"); g.fillStyle = bm; g.beginPath(); g.moveTo(200, -38); g.lineTo(340, -62); g.lineTo(340, -4); g.lineTo(200, -30); g.closePath(); g.fill(); g.globalCompositeOperation = "source-over"; }
    g.restore();
  }

  /** A street tree in an iron grating: dark trunk, a clumped pixel canopy that catches the last light. */
  private tree(g: CanvasRenderingContext2D, x: number, y: number, i: number, night: number): void {
    g.fillStyle = INK; g.fillRect(x - 5, y - 96, 10, 96); g.fillRect(x - 20, y - 2, 40, 5);
    const leaf = night > 0.5 ? ["#16261f", "#1d3328"] : ["#2f5a3a", "#3f7a4a"];
    for (let k = 0; k < 9; k++) { const cx = x + (hash(i * 7 + k) - 0.5) * 70, cy = y - 118 + (hash(i * 11 + k) - 0.5) * 44, r = 18 + hash(i * 3 + k) * 14; g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, r + 2, 0, 6.283); g.fill(); g.fillStyle = leaf[k % 2]; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill(); }
    g.fillStyle = "rgba(255,210,150,.14)"; g.beginPath(); g.arc(x - 14, y - 128, 16, 0, 6.283); g.fill();
  }

  /** A steam vent in the road: a grating and slow puffs rising, straight out of the SimCity night streets. */
  private vent(g: CanvasRenderingContext2D, x: number, y: number, time: number, i: number): void {
    g.fillStyle = "#0e0c18"; g.fillRect(x - 22, y, 44, 8); g.fillStyle = "#3a3450"; for (let k = 0; k < 5; k++) g.fillRect(x - 18 + k * 9, y + 1, 4, 6);
    for (let k = 0; k < 7; k++) { const ph = (time * 0.22 + k / 7 + hash(i)) % 1; g.fillStyle = `rgba(215,215,232,${(0.4 * (1 - ph)).toFixed(3)})`; const r = 7 + ph * 22; g.beginPath(); g.arc(x + Math.sin(ph * 5 + k) * 10 + ph * 14, y - ph * 120, r, 0, 6.283); g.fill(); }
  }
  private mailbox(g: CanvasRenderingContext2D, x: number, y: number): void { box(g, x - 11, y - 46, 22, 46, "#2f4a8a", 1.5); box(g, x - 13, y - 52, 26, 8, "#3a5aa0", 1.5); g.fillStyle = INK; g.fillRect(x - 7, y - 36, 14, 3); }
  private bin(g: CanvasRenderingContext2D, x: number, y: number, i: number): void { box(g, x - 15, y - 36, 30, 36, "#4a525e", 1.5); box(g, x - 18, y - 42, 36, 7, "#2c3038", 1.5); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x - 15, y - 36, 5, 36); if (hash(i) < 0.5) { g.fillStyle = "#c7b98a"; g.fillRect(x - 8, y - 48, 14, 7); } }
  private bench(g: CanvasRenderingContext2D, x: number, y: number): void { box(g, x - 34, y - 28, 68, 8, "#5a3c26", 1.5); box(g, x - 34, y - 44, 68, 10, "#6a4a30", 1.5); g.fillStyle = INK; g.fillRect(x - 30, y - 20, 5, 20); g.fillRect(x + 25, y - 20, 5, 20); }

  /** Thin cast-iron lamp posts with a warm globe, lit windows and shop glass blooming into the dusk. */
  private lights(g: CanvasRenderingContext2D, W: number, H: number, off: number, ground: number, night: number, time: number): void {
    const SEG = 420, i0 = Math.floor((off - W / 2) / SEG) - 1, py = ground + H * 0.1 + 8;
    for (let i = i0; i < i0 + Math.ceil(W / SEG) + 3; i++) {
      const x = i * SEG - off + W / 2 + 140;
      if (x < -150 || x > W + 150) continue;
      const flick = hash(i) < 0.2 ? (Math.sin(time * 23 + i) > 0.6 ? 0.55 : 1) : 1, y = py - 190;
      g.fillStyle = INK; g.fillRect(x - 4, y, 8, py - y); g.fillRect(x - 10, py - 10, 20, 10); g.fillRect(x - 7, y + 24, 14, 4);
      g.fillStyle = NOIR.lampPost; g.fillRect(x - 2, y, 3, py - y);
      g.fillStyle = INK; g.beginPath(); g.arc(x, y - 6, 14, 0, 6.283); g.fill(); g.fillStyle = night > 0.2 ? NOIR.lampLight : "#a89c88"; g.beginPath(); g.arc(x, y - 6, 10, 0, 6.283); g.fill();
      const a = (0.2 + 0.45 * night) * flick;
      g.globalCompositeOperation = "lighter";
      let gr = g.createRadialGradient(x, y, 0, x, y, 240); gr.addColorStop(0, `rgba(255,180,90,${a})`); gr.addColorStop(1, "rgba(255,180,90,0)"); g.fillStyle = gr; g.fillRect(x - 240, y - 240, 480, 480);
      gr = g.createRadialGradient(x, py, 0, x, py, 180); gr.addColorStop(0, `rgba(255,160,80,${a * 0.6})`); gr.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = gr; g.fillRect(x - 180, py - 120, 360, 280);
      g.globalCompositeOperation = "source-over";
    }
    // windows keep their own light: redraw each lit pane bright over the dusk wash
    if (night > 0.05) for (let i = 0; i < this.nGlow; i++) {
      const x = this.glow[i * 4], y = this.glow[i * 4 + 1], w = this.glow[i * 4 + 2], h = this.glow[i * 4 + 3];
      g.globalAlpha = Math.min(1, night * 1.6); g.fillStyle = NOIR.glassLit; g.fillRect(x, y, w, h); g.fillStyle = NOIR.glassGlow; g.fillRect(x + 3, y + 3, w * 0.4, h * 0.35); g.globalAlpha = 1;
      g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,170,70,${0.12 * night})`; g.fillRect(x - 10, y - 8, w + 20, h + 24); g.globalCompositeOperation = "source-over";
    }
  }

  /** A small noir figure: muted coat, fedora or flat cap, one-unit outline, flat two-tone shading. Joints come from `solve`. */
  private person(g: CanvasRenderingContext2D, c: Character, k: number, dir: number, flash: boolean, pix: number, night: number): void {
    // the same figure as the zoomed-out view: drawn from the joints `solve` already placed
    void pix; void night;
    // the same figure as the zoomed-out view (no heavy HD ink outline), so close-up people keep the same look
    drawFigure(g, c, 0, 0, k, dir, 0, flash ? 1 : 0, 1, false);
  }

  /** LOOK.md: people are neon stick figures, one colour each, same as the zoomed-out view. Joints come from `solve`. */
  neonPerson(g: CanvasRenderingContext2D, c: Character, k: number, flash: boolean, night: number): void {
    const col = flash ? "#ffffff" : NEON[c.id % NEON.length];
    const w = Math.max(1.6, 2.2 * k);
    g.save();
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
    if (night > 0.3) { g.shadowColor = col; g.shadowBlur = 6 * k; }
    const seg = (a: number, b: number) => { g.beginPath(); g.moveTo(J[a], J[a + 1]); g.lineTo(J[b], J[b + 1]); g.stroke(); };
    seg(0, 2);                              // torso
    seg(6, 8); seg(8, 10); seg(6, 12); seg(12, 14);   // arms
    seg(0, 16); seg(16, 18); seg(0, 20); seg(20, 22); // legs
    g.beginPath(); g.arc(J[4], J[5], 4 * k, 0, 6.283); g.fill();   // head
    g.restore();
  }

  personOutlined(g: CanvasRenderingContext2D, c: Character, k: number, _dir: number, flash: boolean, _pix: number, night: number): void {
    const dir = _dir, pix = _pix;
    const L = c.look, D = dressOf(c), skin = flash ? "#fff" : NOIR.skin[c.id % NOIR.skin.length], build = L.build ?? 1;
    const coat = flash ? "#fff" : muted(L.color, 0.5), pants = flash ? "#fff" : shade(muted(L.accent, 0.4), 0.7), lamp = night > 0.3 ? 1.25 : 1.1;
    const lw = 8 * k * build, ol = pix * 0.9;
    const limb = (a: number, b: number, d: number, col: string, w: number) => {
      g.strokeStyle = INK; g.lineWidth = w + ol * 2; g.beginPath(); g.moveTo(J[a], J[a + 1]); g.lineTo(J[b], J[b + 1]); g.lineTo(J[d], J[d + 1]); g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
    };
    const far = dir > 0 ? 8 : 12, near = dir > 0 ? 12 : 8;
    limb(6, far, far + 2, shade(coat, 0.75), lw * 0.85);
    for (const i of [16, 20]) {
      limb(0, i, i + 2, pants, lw * 1.2);
      g.fillStyle = INK; g.fillRect(J[i + 2] - 5 * k + (dir > 0 ? 0 : -6 * k), J[i + 3] - 4 * k, 12 * k, 7 * k);
    }
    const hx = J[0], hy = J[1], sx = J[6], sy = J[7], len = Math.hypot(sx - hx, sy - hy) || 1, nx = -(sy - hy) / len, ny = (sx - hx) / len;
    const sw = 12 * k * build, hw = 11 * k * build;
    g.beginPath(); g.moveTo(hx + nx * hw, hy + ny * hw); g.lineTo(sx + nx * sw, sy + ny * sw); g.lineTo(sx - nx * sw, sy - ny * sw); g.lineTo(hx - nx * hw, hy - ny * hw); g.closePath();
    g.fillStyle = coat; g.fill(); g.strokeStyle = INK; g.lineWidth = ol * 1.4; g.stroke();
    g.fillStyle = shade(coat, 0.7); g.beginPath(); g.moveTo(hx, hy); g.lineTo(sx, sy); g.lineTo(sx - nx * sw, sy - ny * sw); g.lineTo(hx - nx * hw, hy - ny * hw); g.closePath(); g.fill();   // two-tone: shaded back half
    g.strokeStyle = shade(coat, lamp); g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(sx + nx * sw * 0.6, sy + ny * sw * 0.6); g.lineTo(hx + nx * hw * 0.6, hy + ny * hw * 0.6); g.stroke();  // lamp-side edge light
    g.fillStyle = INK; g.fillRect(hx - hw, hy - 2 * k, hw * 2, 3 * k);
    limb(6, near, near + 2, coat, lw * 0.95);
    g.fillStyle = skin; g.beginPath(); g.arc(J[near + 2], J[near + 3], 3 * k, 0, 6.283); g.fill();
    this.head(g, c, J[4], J[5], k, dir, skin, flash, D ? D.hat : L.hat, ol);
  }

  private head(g: CanvasRenderingContext2D, c: Character, x: number, y: number, k: number, dir: number, skin: string, flash: boolean, hat: Character["look"]["hat"], ol: number): void {
    const L = c.look, r = 9.5 * k, hair = flash ? "#fff" : shade(muted(L.color, 0.3), 0.55);
    const part = (path: () => void, fill: string) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = ol; g.stroke(); };
    if (L.hair === "long" || L.hair === "braids" || L.hair === "pigtails" || L.hair === "bob" || L.hair === "pony") part(() => g.ellipse(x - 2 * k * dir, y + 4 * k, r * 1.05, r * 1.3, 0, 0, 6.283), hair);
    part(() => g.ellipse(x, y, r, r * 1.08, 0, 0, 6.283), skin);
    if (L.hair !== "none" && hat === "none") part(() => { g.ellipse(x, y - 1 * k, r * 1.05, r * 1.02, 0, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); }, hair);
    const hc = flash ? "#fff" : shade(muted(L.accent, 0.35), 0.6);
    if (hat === "cowboy" || hat === "bucket" || hat === "police") { part(() => g.ellipse(x, y - 4 * k, r * 1.7, 2.6 * k, 0, 0, 6.283), hc); part(() => g.rect(x - r * 0.8, y - r * 1.5, r * 1.6, r * 1.1), hc); g.fillStyle = INK; g.fillRect(x - r * 0.8, y - r * 0.85, r * 1.6, 2 * k); }   // fedora
    else if (hat !== "none" && hat !== "headphones") part(() => { g.ellipse(x, y - 2 * k, r * 1.1, r * 0.95, 0, Math.PI, 0); g.closePath(); }, hc);
    g.fillStyle = INK; const ex = x + r * 0.4 * dir; g.fillRect(ex - 1.5 * k, y - 1 * k, 2 * k, 2 * k); g.fillRect(ex + 3.5 * k * dir - 1 * k, y - 1 * k, 2 * k, 2 * k);
    if (L.face?.facial === "mustache" || L.face?.facial === "beard") g.fillRect(ex - 1 * k, y + 4 * k, 6 * k, 2 * k);
  }
}
