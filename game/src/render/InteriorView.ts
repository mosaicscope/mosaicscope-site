import {drawDetachedLimb} from './DamageArt';
import {applyNegativeReaction} from './NegativeReactions';
import { ScreenBounds } from "./ScreenBounds";
/**
 * Canvas 2D isometric renderer for an InteriorDef. Same 2:1 iso language as the street renderer.
 * Static things (floor, walls, wall art) are painted once into an offscreen layer; every prop is
 * painted once into a cached sprite; each frame only blits those plus the living things on top,
 * depth-sorted. Scale and camera are derived from the CSS size, so phones get a following camera
 * at a readable tile size instead of a tiny whole-room fit.
 *
 * Louis's warm cutaway look (art-requests/007, 009, 010): walnut wainscot and picture rails, thick cut-wall
 * slabs, lamp light pools on a dark floor, per-plank wood, framed pictures, clutter on every surface, and
 * native device-pixel detail in cached floors, walls and furnishings.
 */
import { PROP_INFO, type InteriorDef, type Prop, type FloorMat } from "../content/interiors";
import { fillTextured } from "./Textures";
import { wallSconces, wallPictures } from "./interiorDecor";
import { pose, solve, drawFigure } from "./StickFigure";
import type { Character, Look } from "../entities/types";

export interface ViewActor {
  id: string | number;
  look: Look;
  x: number; y: number;
  dir: 1 | -1;
  pose: string;
  phase: number; poseT: number; speed: number;
  seed: number; style: string;
  name?: string;
  isPlayer?: boolean;
  lying?: boolean;
  /** the real person (townsfolk and the player), so they look exactly as they do on the street */
  char?: Character;
  /** staff keep their uniform (whites, scrubs...) instead of a personalised outfit */
  staff?: boolean;
}
export interface ViewState {
  t: number;
  fakeBlood?: boolean;
  hour: number;
  player: ViewActor;
  actors: ViewActor[];
  /** id of the interactable within reach, or null. */
  near: string | null;
  nearActor: string | number | null;
  exitNear: boolean;
}

const WALL_H = 2.6;
const MIN_S = 21, MAX_S = 46;

// ------------------------------------------------------------------ colour helpers
function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [136, 136, 136];
}
export function shade(hex: string, f: number): string {
  const [r, g, b] = rgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function hashSeed(a: number, b = 0): number { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function srand(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

type Proj = (x: number, y: number, z?: number) => [number, number];
interface Sprite { cv: HTMLCanvasElement; dx: number; dy: number; w: number; h: number }

export class InteriorView {
  private g: CanvasRenderingContext2D;
  private def: InteriorDef | null = null;
  private cssW = 300; private cssH = 200; private dpr = 1;
  s = 24; private Zh = 22;
  /** Cached floors and props render at full device resolution. */
  private get pixF(): number { return 1; }
  private camX = 0; private camY = 0;
  private staticLayer: { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number; day: boolean } | null = null;
  private sprites = new Map<number, Sprite>();
  private order: { key: number; prop: number }[] = [];
  /**
   * One stand-in per walk-in visitor or staff member. Looks, models and outfits are cached per person and varied by id,
   * so a single shared stand-in made a whole room of identical clones.
   */
  private stubs = new Map<string | number, Character>();
  private figureOf(a: ViewActor): Character {
    if (a.char) return a.char;
    let c = this.stubs.get(a.id);
    if (!c || c.look !== a.look) {
      let h = 0; for (const ch of String(a.id)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
      c = { id: 100000 + ((h >>> 0) % 1000000), look: a.look, phys: 0, name: a.name ?? "", tier: a.staff ? "principal" : "background", mode: "normal" } as unknown as Character;
      this.stubs.set(a.id, c);
      if (this.stubs.size > 400) this.stubs.delete(this.stubs.keys().next().value as string | number);
    }
    return c;
  }

  constructor(readonly canvas: HTMLCanvasElement) { this.g = canvas.getContext("2d")!; }

  setDef(def: InteriorDef): void {
    this.def = def; this.staticLayer = null; this.sprites.clear();
    this.order = def.props.map((p, i) => ({ key: p.x + p.y + (p.w + p.h) / 2 + (PROP_INFO[p.type].flat ? -100 : 0), prop: i })).filter((o) => !PROP_INFO[def.props[o.prop].type].wall && !PROP_INFO[def.props[o.prop].type].flat).sort((a, b) => a.key - b.key);
    this.resize(this.cssW, this.cssH, this.dpr, true);
  }

  /** CSS pixels in, backing store scaled by (capped) devicePixelRatio. Never touches page zoom. */
  resize(cssW: number, cssH: number, dpr: number, force = false): void {
    const w = Math.max(160, Math.round(cssW)), h = Math.max(120, Math.round(cssH)), d = Math.max(1, Math.min(2, dpr || 1));
    if (!force && w === this.cssW && h === this.cssH && d === this.dpr) return;
    this.cssW = w; this.cssH = h; this.dpr = d;
    this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
    this.staticLayer=null;this.sprites.clear();
    const def = this.def; if (!def) return;
    const W = def.size.w, H = def.size.h;
    const fitX = (w - 16) / (W + H), fitY = (h - 90) / ((W + H) * 0.5 + WALL_H * 0.95);
    const fit = Math.min(fitX, fitY);
    const s = Math.round(Math.max(MIN_S, Math.min(MAX_S, fit)));
    if (s !== this.s || force) { this.s = s; this.Zh = s * 0.95; this.staticLayer = null; this.sprites.clear(); }
  }

  /** Map a screen-space pixel offset (from stick or tap) to a world direction. */
  static screenToWorld(ix: number, iy: number): [number, number] {
    const wx = ix + iy, wy = iy - ix, l = Math.hypot(wx, wy) || 1; // screen up = (-1,-1), right = (+1,-1)
    return [wx / l, wy / l];
  }

  screenPoint(x:number,y:number):[number,number] { return this.proj(this.camX,this.camY)(x,y,0); }
  groundPoint(x:number,y:number):{x:number;y:number} { const a=(x-this.camX)/this.s,b=2*(y-this.camY)/this.s;return {x:(a+b)/2,y:(b-a)/2}; }
  private proj(ox: number, oy: number): Proj {
    const s = this.s, Zh = this.Zh;
    return (x, y, z = 0) => [ox + (x - y) * s, oy + (x + y) * s * 0.5 - z * Zh];
  }

  // ------------------------------------------------------------------ static layer
  private buildStatic(day: boolean): void {
    const def = this.def!, s = this.s, Zh = this.Zh, W = def.size.w, H = def.size.h, d = this.dpr;
    const pad = 12;
    const ox = H * s + pad, oy = WALL_H * Zh + pad;
    const w = Math.ceil((W + H) * s + pad * 2), h = Math.ceil((W + H) * s * 0.5 + WALL_H * Zh + pad * 2 + s * 0.4);
    const f = this.pixF, cv = document.createElement("canvas"); cv.width = Math.ceil(w * d * f); cv.height = Math.ceil(h * d * f);
    const g = cv.getContext("2d")!; g.scale(d * f, d * f);
    const P = this.proj(ox, oy);
    this.paintFloor(g, P, def);
    this.paintWalls(g, P, def, ox, oy, day);
    this.staticLayer = { cv, ox, oy, w, h, day };
  }

  private paintFloor(g: CanvasRenderingContext2D, P: Proj, def: InteriorDef): void {
    const W = def.size.w, H = def.size.h, s = this.s;
    // slab edge under the front faces
    g.fillStyle = "#0b0908";
    g.beginPath(); const a = P(0, H, 0), b = P(W, H, 0), c = P(W, 0, 0);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(c[0], c[1] + s * 0.28); g.lineTo(b[0], b[1] + s * 0.28); g.lineTo(a[0], a[1] + s * 0.28); g.closePath(); g.fill();
    g.strokeStyle = "rgba(224,160,96,.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();   // lit lip of the cut slab
    for (const zn of def.zones) {
      const quad = () => { g.beginPath(); const q = [P(zn.x, zn.y), P(zn.x + zn.w, zn.y), P(zn.x + zn.w, zn.y + zn.h), P(zn.x, zn.y + zn.h)]; g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); };
      g.save(); quad(); g.fillStyle = zn.color; g.fill(); quad(); g.clip();
      this.floorPattern(g, P, zn.floor, zn.x, zn.y, zn.w, zn.h, zn.color, hashSeed(zn.x * 31 + zn.y, zn.w));
      g.restore();
      quad(); g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 1; g.stroke();
    }
    // flat props (rugs, mats, planting) sit on the floor
    for (const p of def.props) if (PROP_INFO[p.type].flat) this.flatProp(g, P, p);
    // zone captions printed on the floor
    for (const zn of def.zones) {
      if (zn.w < 3 || zn.h < 2) continue;
      g.save(); const o = P(zn.x + 0.4, zn.y + zn.h - 0.35);
      g.transform(s / 32, (s * 0.5) / 32, -s / 32, (s * 0.5) / 32, o[0], o[1]);
      g.font = "600 9px 'IBM Plex Mono', monospace"; g.fillStyle = "rgba(255,255,255,.34)"; g.textBaseline = "alphabetic";
      g.fillText(zn.name.toUpperCase(), 0, 0); g.restore();
    }
  }

  private floorPattern(g: CanvasRenderingContext2D, P: Proj, m: FloorMat, x: number, y: number, w: number, h: number, _color: string, seed: number): void {
    const line = (x0: number, y0: number, x1: number, y1: number) => { const a = P(x0, y0), b = P(x1, y1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); };
    const r = srand(seed);
    const grid = (step: number, col: string, lw = 1) => { g.beginPath(); for (let i = 0; i <= w + 1e-6; i += step) line(x + i, y, x + i, y + h); for (let j = 0; j <= h + 1e-6; j += step) line(x, y + j, x + w, y + j); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
    const full = () => { g.beginPath(); const q = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)]; g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); };
    switch (m) {
      case "tile":
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if ((Math.floor(x + i) + Math.floor(y + j)) % 2 === 0) { g.beginPath(); const q = [P(x + i, y + j), P(x + i + 1, y + j), P(x + i + 1, y + j + 1), P(x + i, y + j + 1)]; g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.fillStyle = "rgba(255,225,180,.11)"; g.fill(); }
        grid(1, "rgba(0,0,0,.18)"); break;
      case "lino": grid(2, "rgba(0,0,0,.10)"); full(); fillTextured(g, "concrete", 0.35); break;
      case "carpet": full(); fillTextured(g, "concrete", 0.9); g.beginPath(); for (let j = 0; j < h; j += 3) line(x, y + j, x + w, y + j); g.strokeStyle = "rgba(0,0,0,.05)"; g.lineWidth = 1; g.stroke(); break;
      case "wood": {
        for (let j = 0; j < h; j += 0.33) for (let i = -r() * 2; i < w; ) {   // every plank its own value, like the Zomboid floor
          const len = 1.6 + r() * 2.2, a0 = Math.max(0, i), a1 = Math.min(w, i + len);
          if (a1 > a0) { const q = [P(x + a0, y + j), P(x + a1, y + j), P(x + a1, y + Math.min(h, j + 0.33)), P(x + a0, y + Math.min(h, j + 0.33))]; g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.fillStyle = r() < 0.5 ? `rgba(255,190,120,${(r() * 0.1).toFixed(3)})` : `rgba(0,0,0,${(r() * 0.14).toFixed(3)})`; g.fill(); }
          i += len;
        }
        g.beginPath(); for (let j = 0; j <= h; j += 0.33) line(x, y + j, x + w, y + j); g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1; g.stroke();
        g.beginPath(); for (let j = 0; j < h; j += 0.33) { const k = r() * 3; for (let i = k; i < w; i += 2 + r() * 2) line(x + i, y + j, x + i, y + j + 0.33); } g.strokeStyle = "rgba(0,0,0,.18)"; g.stroke();
        full(); fillTextured(g, "brick", 0.18); break;
      }
      case "concrete": full(); fillTextured(g, "concrete", 0.9); grid(3, "rgba(0,0,0,.12)"); break;
      case "marble": {
        grid(2, "rgba(255,255,255,.10)", 1.2); full(); fillTextured(g, "concrete", 0.3);
        g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 0.8;
        for (let n = 0; n < Math.ceil((w * h) / 10); n++) { let vx = x + r() * w, vy = y + r() * h; g.beginPath(); const a = P(vx, vy); g.moveTo(a[0], a[1]); for (let k = 0; k < 5; k++) { vx += (r() - 0.3) * 1.2; vy += (r() - 0.5) * 1.2; const b = P(vx, vy); g.lineTo(b[0], b[1]); } g.stroke(); }
        break;
      }
      case "grass": full(); fillTextured(g, "grass", 1); g.fillStyle = "rgba(20,60,20,.35)"; for (let n = 0; n < w * h * 2; n++) { const a = P(x + r() * w, y + r() * h); g.fillRect(a[0], a[1], 2, 1); } break;
      case "pavers": full(); fillTextured(g, "pavers", 1); grid(1, "rgba(0,0,0,.2)"); break;
      case "rubber": full(); fillTextured(g, "concrete", 0.7); g.fillStyle = "rgba(0,0,0,.14)"; for (let i = 0.5; i < w; i += 1) for (let j = 0.5; j < h; j += 1) { const a = P(x + i, y + j); g.beginPath(); g.arc(a[0], a[1], 1.4, 0, 6.283); g.fill(); } break;
    }
  }

  private flatProp(g: CanvasRenderingContext2D, P: Proj, p: Prop): void {
    const q = [P(p.x, p.y), P(p.x + p.w, p.y), P(p.x + p.w, p.y + p.h), P(p.x, p.y + p.h)];
    const path = () => { g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); };
    if (p.type === "flower") {
      const r = srand(hashSeed(p.x * 10, p.y * 10)); path(); g.fillStyle = "rgba(40,90,40,.7)"; g.fill();
      for (let n = 0; n < p.w * p.h * 5; n++) { const a = P(p.x + r() * p.w, p.y + r() * p.h); g.fillStyle = r() < 0.5 ? p.color : "#f6e24a"; g.beginPath(); g.arc(a[0], a[1], 1.8, 0, 6.283); g.fill(); }
      return;
    }
    path(); g.fillStyle = p.type === "rug" ? shade(p.color, 0.8) : p.color; g.fill();
    if (p.type === "rug") { const i = 0.12, qi = [P(p.x + i, p.y + i), P(p.x + p.w - i, p.y + i), P(p.x + p.w - i, p.y + p.h - i), P(p.x + i, p.y + p.h - i)]; g.beginPath(); g.moveTo(qi[0][0], qi[0][1]); for (let k = 1; k < 4; k++) g.lineTo(qi[k][0], qi[k][1]); g.closePath(); g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 1.2; g.stroke(); }
    path(); fillTextured(g, "concrete", 0.5);
    path(); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; g.stroke();
  }

  /** Matrix that maps (u px at 32/tile, v px) onto a wall plane so text and art lie flat on the wall. */
  private wallMatrix(g: CanvasRenderingContext2D, P: Proj, side: "n" | "w", at: number, len: number, elev: number): void {
    const s = this.s, k = s / 32, zk = this.Zh / 32;
    if (side === "n") { const o = P(at, 0, elev); g.transform(k, k * 0.5, 0, -zk, o[0], o[1]); }
    else { const o = P(0, at + len, elev); g.transform(k, -k * 0.5, 0, -zk, o[0], o[1]); } // reads left to right = north to... y decreasing
  }

  private paintWalls(g: CanvasRenderingContext2D, P: Proj, def: InteriorDef, _ox: number, _oy: number, day: boolean): void {
    const W = def.size.w, H = def.size.h, base = def.zones[0].color;
    const warm = def.light === "cool" ? 0.18 : def.light === "neon" ? 0.12 : 0.5;
    const wallN = mix(mix(shade(base, 0.5), "#2a2630", 0.4), "#8a5a3a", warm), wallW = shade(wallN, 0.78);
    const quadW = (pts: [number, number][], col: string) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = col; g.fill(); };
    // north wall (y = 0)
    quadW([P(0, 0, 0), P(W, 0, 0), P(W, 0, WALL_H), P(0, 0, WALL_H)], wallN);
    quadW([P(0, 0, 0), P(W, 0, 0), P(W, 0, 0.18), P(0, 0, 0.18)], shade(wallN, 0.62));
    quadW([P(0, 0, WALL_H - 0.12), P(W, 0, WALL_H - 0.12), P(W, 0, WALL_H), P(0, 0, WALL_H)], shade(wallN, 1.3));
    // west wall (x = 0), with a doorway
    const d0 = Math.max(0.3, def.door.y - 0.9), d1 = Math.min(H - 0.3, def.door.y + 0.9);
    quadW([P(0, 0, 0), P(0, d0, 0), P(0, d0, WALL_H), P(0, 0, WALL_H)], wallW);
    quadW([P(0, d1, 0), P(0, H, 0), P(0, H, WALL_H), P(0, d1, WALL_H)], wallW);
    quadW([P(0, d0, 2.1), P(0, d1, 2.1), P(0, d1, WALL_H), P(0, d0, WALL_H)], wallW);
    quadW([P(0, 0, 0), P(0, H, 0), P(0, H, 0.18), P(0, 0, 0.18)], shade(wallW, 0.6));
    quadW([P(0, 0, WALL_H - 0.12), P(0, H, WALL_H - 0.12), P(0, H, WALL_H), P(0, 0, WALL_H)], shade(wallW, 1.3));
    // walnut wainscot, a picture rail and panel lines on both back walls
    const wood = mix(wallN, "#4a2a1e", 0.65);
    for (const side of ["n", "w"] as const) {
      const len = side === "n" ? W : H, at = (t: number, z: number) => (side === "n" ? P(t, 0, z) : P(0, t, z));
      const strips: [number, number, string][] = [[0.18, 0.95, side === "n" ? wood : shade(wood, 0.78)], [0.95, 1.03, shade(wood, 1.5)], [1.03, 1.08, shade(wood, 0.55)]];
      for (const [z0, z1, col] of strips) quadW([at(0, z0), at(len, z0), at(len, z1), at(0, z1)], col);
      g.strokeStyle = "rgba(14,8,14,.35)"; g.lineWidth = 1; g.beginPath();
      for (let t = 1; t < len; t += 1) { const a = at(t, 0.22), b = at(t, 0.92); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.stroke();
    }
    // the cut walls are thick slabs: their lit tops show
    const T = 0.2;
    quadW([P(0, -T, WALL_H), P(W, -T, WALL_H), P(W, 0, WALL_H), P(0, 0, WALL_H)], shade(wallN, 1.6));
    quadW([P(-T, 0, WALL_H), P(0, 0, WALL_H), P(0, H, WALL_H), P(-T, H, WALL_H)], shade(wallW, 1.45));
    // wall lamps and framed pictures
    for (const sc of wallSconces(def)) this.sconce(g, P, sc.side, sc.at);
    for (const pc of wallPictures(def)) this.picture(g, P, pc.side, pc.at, pc.len, pc.seed);
    // wall texture
    for (const [pts] of [[[P(0, 0, 0), P(W, 0, 0), P(W, 0, WALL_H), P(0, 0, WALL_H)]], [[P(0, 0, 0), P(0, H, 0), P(0, H, WALL_H), P(0, 0, WALL_H)]]] as [[number, number][]][]) {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); fillTextured(g, "concrete", 0.4);
    }
    // doorway: night street beyond, warm spill, frame
    quadW([P(0, d0, 0), P(0, d1, 0), P(0, d1, 2.1), P(0, d0, 2.1)], day ? "#9fc6e0" : "#0a1020");
    const gr = g.createLinearGradient(...P(0, d0, 0), ...P(0, d0, 2.1)); gr.addColorStop(0, "rgba(255,230,160,.55)"); gr.addColorStop(1, "rgba(255,230,160,0)");
    quadW([P(0, d0, 0), P(0, d1, 0), P(0, d1, 2.1), P(0, d0, 2.1)], gr as unknown as string);
    g.strokeStyle = "#0b0908"; g.lineWidth = Math.max(2, this.s * 0.12); g.beginPath(); const f = [P(0, d0, 0), P(0, d0, 2.1), P(0, d1, 2.1), P(0, d1, 0)]; g.moveTo(f[0][0], f[0][1]); for (let i = 1; i < 4; i++) g.lineTo(f[i][0], f[i][1]); g.stroke();
    // EXIT sign above the door
    g.save(); this.wallMatrix(g, P, "w", d0, d1 - d0, 2.18);
    const len = (d1 - d0) * 32; g.fillStyle = "#07210f"; g.fillRect(len / 2 - 22, -13, 44, 13); g.strokeStyle = "#3dff7a"; g.lineWidth = 1; g.strokeRect(len / 2 - 22, -13, 44, 13);
    g.font = "800 10px 'IBM Plex Mono', monospace"; g.fillStyle = "#6bff9a"; g.textAlign = "center"; g.fillText("EXIT", len / 2, -3); g.restore();
    // wall-mounted props
    for (const p of def.props) if (PROP_INFO[p.type].wall) this.wallProp(g, P, p, day);
  }

  /** A brass wall lamp with a pool of light thrown up and down the wall. */
  private sconce(g: CanvasRenderingContext2D, P: Proj, side: "n" | "w", at: number): void {
    g.save(); this.wallMatrix(g, P, side, at, 0.5, 1.5);
    const cone = g.createLinearGradient(0, 0, 0, 40); cone.addColorStop(0, "rgba(255,196,110,.42)"); cone.addColorStop(1, "rgba(255,196,110,0)");
    g.fillStyle = cone; g.beginPath(); g.moveTo(3, 0); g.lineTo(13, 0); g.lineTo(26, 40); g.lineTo(-10, 40); g.closePath(); g.fill();
    const up = g.createLinearGradient(0, -2, 0, -22); up.addColorStop(0, "rgba(255,196,110,.3)"); up.addColorStop(1, "rgba(255,196,110,0)");
    g.fillStyle = up; g.beginPath(); g.moveTo(4, -9); g.lineTo(12, -9); g.lineTo(20, -24); g.lineTo(-4, -24); g.closePath(); g.fill();
    g.fillStyle = "#120d16"; g.fillRect(6, -2, 4, 3); g.fillRect(2, -13, 12, 12);
    g.fillStyle = "#c98a3a"; g.beginPath(); g.moveTo(3, -2); g.lineTo(13, -2); g.lineTo(11, -11); g.lineTo(5, -11); g.closePath(); g.fill();
    g.fillStyle = "#ffe3a0"; g.fillRect(6, -7, 4, 4);
    g.restore();
  }

  /** A framed picture: dusk landscape, harbour or a head-and-shoulders silhouette, all hand-made shapes. */
  private picture(g: CanvasRenderingContext2D, P: Proj, side: "n" | "w", at: number, len: number, seed: number): void {
    const r = srand(seed), L = len * 32, h = 22 + Math.floor(r() * 8), kind = Math.floor(r() * 3);
    g.save(); this.wallMatrix(g, P, side, at, len, 1.3);
    g.fillStyle = "#120d16"; g.fillRect(0, -h - 3, L, h + 3);
    g.fillStyle = ["#6a4428", "#3a2a22", "#7a5a30"][Math.floor(r() * 3)]; g.fillRect(1.5, -h - 1.5, L - 3, h);
    const ix = 4, iw = L - 8, iy = -h + 1, ih = h - 6;
    const sky = g.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, kind === 2 ? "#3a3a4a" : "#3a2f5a"); sky.addColorStop(1, kind === 2 ? "#6a5a4a" : "#d08a5a");
    g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
    g.fillStyle = "#1a1626";
    if (kind === 0) { g.beginPath(); g.moveTo(ix, iy + ih); g.lineTo(ix + iw * 0.3, iy + ih * 0.45); g.lineTo(ix + iw * 0.55, iy + ih * 0.75); g.lineTo(ix + iw * 0.8, iy + ih * 0.35); g.lineTo(ix + iw, iy + ih); g.closePath(); g.fill(); }
    else if (kind === 1) { g.fillRect(ix, iy + ih * 0.7, iw, ih * 0.3); g.fillStyle = "#e8d8a8"; g.fillRect(ix + iw * 0.6, iy + ih * 0.2, 4, 4); g.fillStyle = "#1a1626"; g.fillRect(ix + iw * 0.25, iy + ih * 0.5, 2, ih * 0.25); g.beginPath(); g.moveTo(ix + iw * 0.25, iy + ih * 0.5); g.lineTo(ix + iw * 0.45, iy + ih * 0.7); g.lineTo(ix + iw * 0.25, iy + ih * 0.7); g.fill(); }
    else { g.beginPath(); g.arc(ix + iw / 2, iy + ih * 0.42, ih * 0.22, 0, 6.283); g.fill(); g.fillRect(ix + iw * 0.28, iy + ih * 0.62, iw * 0.44, ih * 0.38); }
    g.restore();
  }

  private wallProp(g: CanvasRenderingContext2D, P: Proj, p: Prop, day: boolean): void {
    const side = p.y === 0 ? "n" : "w", at = side === "n" ? p.x : p.y, len = side === "n" ? p.w : p.h, info = PROP_INFO[p.type];
    const L = len * 32, r = srand(hashSeed(Math.round(at * 10), p.label?.length ?? 1));
    g.save(); this.wallMatrix(g, P, side, at, len, info.elev ?? 1);
    const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, -y - h, w, h); };
    const text = (t: string, x: number, y: number, size: number, c: string, align: CanvasTextAlign = "center", wmax = L - 4) => { g.font = `600 ${size}px 'IBM Plex Mono', monospace`; g.fillStyle = c; g.textAlign = align; g.fillText(t, x, -y, wmax); };
    const wrap = (t: string, x: number, y: number, size: number, c: string, maxW: number, lines: number) => {
      g.font = `600 ${size}px 'IBM Plex Mono', monospace`; g.fillStyle = c; g.textAlign = "center";
      const words = t.split(" "); let line = "", yy = y;
      for (const w of words) { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, -yy); line = w; yy -= size + 1; if (--lines <= 0) return; } else line = test; }
      g.fillText(line, x, -yy);
    };
    switch (p.type) {
      case "poster": { const h = 40; rect(0, 0, L, h, "#0b0908"); rect(2, 2, L - 4, h - 4, p.color); rect(2, 2, L - 4, 9, "rgba(0,0,0,.18)"); wrap(p.label ?? "", L / 2, h - 12, 7, "#0e0b0a", L - 8, 4); break; }
      case "sign": { const h = 17; rect(0, 0, L, h, "#0b0908"); g.shadowColor = p.color; g.shadowBlur = 10; rect(1.5, 1.5, L - 3, h - 3, shade(p.color, 0.22)); g.shadowBlur = 0; g.strokeStyle = p.color; g.lineWidth = 1.2; g.strokeRect(1.5, -h + 1.5, L - 3, h - 3); text(p.label ?? "", L / 2, 5.5, 8.5, p.color, "center", L - 8); break; }
      case "clock": { const R = Math.min(L, 40) / 2; g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(L / 2, -R, R, 0, 6.283); g.fill(); g.strokeStyle = "#222"; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.moveTo(L / 2, -R); g.lineTo(L / 2, -R * 1.7); g.moveTo(L / 2, -R); g.lineTo(L / 2 + R * 0.55, -R); g.stroke(); break; }
      case "screen": { const h = 26; rect(0, 0, L, h, "#050608"); rect(2, 2, L - 4, h - 4, "#0b1822"); g.fillStyle = shade(p.color, 1.4); for (let i = 0; i < 4; i++) g.fillRect(5, -h + 5 + i * 5, (L - 10) * (0.35 + r() * 0.6), 2.5); if (p.label) text(p.label, L / 2, 1.5, 6.5, "rgba(255,255,255,.55)", "center", L - 4); break; }
      case "board": { const h = 36; rect(0, 0, L, h, "#3a2c22"); rect(2, 2, L - 4, h - 4, p.color); const notes = ["#fff8c2", "#ffd0d0", "#d0f0ff", "#ffffff"]; for (let i = 0; i < Math.max(2, Math.floor(L / 20)); i++) { g.save(); g.translate(5 + i * (L - 14) / Math.max(1, Math.floor(L / 20)) + r() * 4, -h + 5 + r() * 12); g.rotate((r() - 0.5) * 0.2); g.fillStyle = notes[i % 4]; g.fillRect(0, 0, 14, 11); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(2, 3, 9, 1); g.fillRect(2, 6, 7, 1); g.restore(); } wrap(p.label ?? "", L / 2, 6, 6.5, "#0e0b0a", L - 6, 2); break; }
      case "window": { const h = 44; rect(0, 0, L, h, "#d8cdb8"); const gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, day ? "#a9d6f2" : "#10203a"); gr.addColorStop(1, day ? "#dff1ff" : "#223a5a"); g.fillStyle = gr; g.fillRect(3, -h + 3, L - 6, h - 6); if (!day) { g.fillStyle = "#fff"; for (let i = 0; i < 6; i++) g.fillRect(6 + r() * (L - 12), -h + 6 + r() * 14, 1.2, 1.2); } g.fillStyle = "#d8cdb8"; g.fillRect(L / 2 - 1.5, -h, 3, h); g.fillRect(0, -h / 2 - 1, L, 2.5); break; }
      case "vent": { const h = 12; rect(0, 0, L, h, "#e8e8e8"); g.fillStyle = "#b9b9b9"; for (let i = 0; i < 4; i++) g.fillRect(3, -h + 2.5 + i * 2.2, L - 6, 1); break; }
    }
    g.restore();
  }

  // ------------------------------------------------------------------ prop sprites
  private spriteFor(i: number): Sprite {
    let sp = this.sprites.get(i);
    if (sp) return sp;
    const p = this.def!.props[i], info = PROP_INFO[p.type], s = this.s, d = this.dpr;
    const P0 = this.proj(0, 0);
    const ht = Math.max(info.ht, 0.2) + (p.type === "tree" ? 0.9 : p.type === "plant" ? 0.5 : p.type === "lamp" ? 0.3 : 0);
    const corners = [P0(p.x, p.y, 0), P0(p.x + p.w, p.y, 0), P0(p.x + p.w, p.y + p.h, 0), P0(p.x, p.y + p.h, 0), P0(p.x, p.y, ht), P0(p.x + p.w, p.y, ht), P0(p.x + p.w, p.y + p.h, ht), P0(p.x, p.y + p.h, ht)];
    const pad = Math.ceil(s * 0.9);
    const minX = Math.min(...corners.map((c) => c[0])) - pad, maxX = Math.max(...corners.map((c) => c[0])) + pad;
    const minY = Math.min(...corners.map((c) => c[1])) - pad, maxY = Math.max(...corners.map((c) => c[1])) + pad;
    const w = Math.ceil(maxX - minX), h = Math.ceil(maxY - minY);
    const f = this.pixF, cv = document.createElement("canvas"); cv.width = Math.ceil(w * d * f); cv.height = Math.ceil(h * d * f);
    const g = cv.getContext("2d")!; g.scale(d * f, d * f);
    this.paintProp(g, this.proj(-minX, -minY), p);
    sp = { cv, dx: minX, dy: minY, w, h }; this.sprites.set(i, sp);
    return sp;
  }

  private paintProp(g: CanvasRenderingContext2D, P: Proj, p: Prop): void {
    const info = PROP_INFO[p.type], z1 = info.ht, c = p.color, s = this.s;
    const poly = (pts: [number, number][], fill: string, stroke?: string) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };
    const box = (x: number, y: number, w: number, h: number, za: number, zb: number, col: string, top = 1.14) => {
      poly([P(x, y + h, za), P(x + w, y + h, za), P(x + w, y + h, zb), P(x, y + h, zb)], shade(col, 0.84), "rgba(14,8,14,.62)");
      poly([P(x + w, y + h, za), P(x + w, y, za), P(x + w, y, zb), P(x + w, y + h, zb)], shade(col, 0.6), "rgba(14,8,14,.62)");
      poly([P(x, y, zb), P(x + w, y, zb), P(x + w, y + h, zb), P(x, y + h, zb)], shade(col, top), "rgba(255,232,190,.3)");
      const e0 = P(x, y + h, zb), e1 = P(x + w, y + h, zb), e2 = P(x + w, y, zb); g.strokeStyle = "rgba(255,226,170,.38)"; g.lineWidth = 1; g.beginPath(); g.moveTo(e0[0], e0[1] + 1); g.lineTo(e1[0], e1[1] + 1); g.lineTo(e2[0], e2[1] + 1); g.stroke();   // edge light on the top face
    };
    const topGrain = (x: number, y: number, w: number, h: number, z: number, a: number) => { g.beginPath(); const q = [P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)]; g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); fillTextured(g, "concrete", a); };
    const shadow = (x: number, y: number, w: number, h: number) => poly([P(x - 0.05, y + 0.05, 0), P(x + w + 0.28, y + 0.05, 0), P(x + w + 0.28, y + h + 0.28, 0), P(x - 0.05, y + h + 0.28, 0)], "rgba(0,0,0,.22)");
    const clutter = (cx: number, cy: number, cw: number, ch: number, z: number): void => {
      const r = srand(hashSeed(Math.round(cx * 17), Math.round(cy * 17))), n = Math.min(6, Math.floor(cw * ch * 1.4) + 1);
      for (let i = 0; i < n; i++) {
        const a = P(cx + 0.2 + r() * Math.max(0.1, cw - 0.4), cy + 0.2 + r() * Math.max(0.1, ch - 0.4), z), k = r();
        g.fillStyle = "#120d16";
        if (k < 0.3) { const col = ["#3a7a4a", "#b86a2a", "#4a3a2a"][Math.floor(r() * 3)]; g.fillRect(a[0] - 2, a[1] - 8, 4, 8); g.fillRect(a[0] - 1, a[1] - 11, 2, 3); g.fillStyle = col; g.fillRect(a[0] - 1, a[1] - 7, 2, 6); }
        else if (k < 0.55) { g.fillRect(a[0] - 3, a[1] - 6, 6, 6); g.fillStyle = "rgba(210,225,240,.8)"; g.fillRect(a[0] - 2, a[1] - 5, 4, 4); g.fillStyle = "#d8a050"; g.fillRect(a[0] - 2, a[1] - 3, 4, 2); }
        else if (k < 0.8) { g.beginPath(); g.ellipse(a[0], a[1] - 1, 5, 2.4, 0, 0, 6.283); g.fill(); g.fillStyle = "#eee4d3"; g.beginPath(); g.ellipse(a[0], a[1] - 1.5, 3.8, 1.7, 0, 0, 6.283); g.fill(); }
        else { g.fillRect(a[0] - 4, a[1] - 5, 8, 5); g.fillStyle = ["#a63030", "#2f5a6a", "#d8c8a0"][Math.floor(r() * 3)]; g.fillRect(a[0] - 3, a[1] - 4, 6, 3); }
      }
    };
    const { x, y, w, h } = p;
    const fS = (u: number, v: number) => P(x + u * w, y + h, v * z1);       // south face
    const fE = (u: number, v: number) => P(x + w, y + h - u * h, v * z1);   // east face
    const led = (px: number, py: number, col: string) => { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 5; g.beginPath(); g.arc(px, py, 1.6, 0, 6.283); g.fill(); g.shadowBlur = 0; };
    if (p.type !== "partition" && p.type !== "curtain" && p.type !== "bars") shadow(x, y, w, h);
    switch (p.type) {
      case "partition": box(x, y, w, h, 0, z1, c, 1.25); break;
      case "counter": case "desk": case "cabinet": {
        box(x, y, w, h, 0, z1, c, 1.1); topGrain(x, y, w, h, z1, 0.5); if (p.type !== "cabinet") clutter(x, y, w, h, z1);
        const L = Math.max(w, h) > 1.2; if (L && p.type !== "cabinet") { // panels
          const n = Math.floor(w); for (let i = 1; i < n; i++) { const a = fS(i / n, 0.05), b = fS(i / n, 0.8); g.strokeStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
          const a = fS(0, 0.9), b = fS(1, 0.9); g.strokeStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        }
        if (p.type === "desk" && w >= 1.1) { const m = P(x + w * 0.5, y + h * 0.3, z1); poly([[m[0] - 7, m[1] - 3], [m[0] + 7, m[1] - 3], [m[0] + 7, m[1] - 15], [m[0] - 7, m[1] - 15]], "#0b1822", "#222"); g.fillStyle = "#6fe3ff"; g.fillRect(m[0] - 5, m[1] - 13, 10, 7); }
        if (p.type === "cabinet") for (let i = 0; i < 3; i++) { const a = fS(0.15, 0.2 + i * 0.27), b = fS(0.85, 0.2 + i * 0.27); g.strokeStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        break;
      }
      case "chair": case "bench": case "sofa": {
        const bench = p.type === "bench", sofa = p.type === "sofa";
        const seat = z1 * 0.78;
        if (!bench) box(x, y, w, Math.min(h * 0.28, 0.4), 0, z1 + (sofa ? 0.28 : 0.45), c, 1.05);       // backrest on the north edge
        box(x, y + (bench ? 0 : Math.min(h * 0.28, 0.4)), w, h - (bench ? 0 : Math.min(h * 0.28, 0.4)), 0, seat, shade(c, 1.08), 1.18);
        if (sofa) { box(x, y, 0.22, h, 0, z1 + 0.05, c, 1.1); box(x + w - 0.22, y, 0.22, h, 0, z1 + 0.05, c, 1.1); }
        if (bench) for (const lx of [0.15, w - 0.25]) { const a = P(x + lx, y + h - 0.1, 0), b = P(x + lx, y + h - 0.1, seat); g.strokeStyle = "#111"; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        break;
      }
      case "bed": {
        box(x, y, w, h, 0, 0.3, "#3a2c22", 1.0); // base
        box(x + 0.04, y + 0.04, w - 0.08, h - 0.08, 0.3, z1, "#e8eef0", 1.12);
        const pill = (px: number, py: number) => { const q = [P(px, py, z1 + 0.01), P(px + Math.min(0.9, w * 0.7), py, z1 + 0.01), P(px + Math.min(0.9, w * 0.7), py + 0.5, z1 + 0.01), P(px, py + 0.5, z1 + 0.01)]; poly(q, "#ffffff", "rgba(0,0,0,.2)"); };
        pill(x + w * 0.15, y + 0.12);
        const q = [P(x + 0.04, y + h * 0.42, z1 + 0.012), P(x + w - 0.04, y + h * 0.42, z1 + 0.012), P(x + w - 0.04, y + h - 0.04, z1 + 0.012), P(x + 0.04, y + h - 0.04, z1 + 0.012)];
        poly(q, shade(c === "#dfe6ea" ? "#79b8a6" : c, 0.8), "rgba(0,0,0,.2)");
        break;
      }
      case "curtain": {
        const n = Math.max(3, Math.round(Math.max(w, h) * 4)), vert = h > w;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const A = vert ? P(x, y + t0 * h, 0) : P(x + t0 * w, y, 0), B = vert ? P(x, y + t1 * h, 0) : P(x + t1 * w, y, 0);
          const A2 = vert ? P(x, y + t0 * h, z1) : P(x + t0 * w, y, z1), B2 = vert ? P(x, y + t1 * h, z1) : P(x + t1 * w, y, z1);
          poly([A, B, B2, A2], shade(c, i % 2 ? 0.92 : 1.05));
        }
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.4; const r0 = vert ? P(x, y, z1) : P(x, y, z1), r1 = vert ? P(x, y + h, z1) : P(x + w, y, z1); g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
        break;
      }
      case "table": {
        for (const [lx, ly] of [[0.08, 0.08], [w - 0.08, 0.08], [0.08, h - 0.08], [w - 0.08, h - 0.08]]) { const a = P(x + lx, y + ly, 0), b = P(x + lx, y + ly, z1 * 0.95); g.strokeStyle = shade(c, 0.5); g.lineWidth = 2.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        box(x, y, w, h, z1 * 0.9, z1, c, 1.15); topGrain(x, y, w, h, z1, 0.5); clutter(x, y, w, h, z1);
        break;
      }
      case "shelf": case "locker": {
        box(x, y, w, h, 0, z1, c, 1.1);
        const rows = p.type === "shelf" ? 4 : 3, cols = Math.max(1, Math.round((w >= h ? w : h) * (p.type === "locker" ? 1.6 : 1.2)));
        const south = w >= h; const face = south ? fS : fE;
        const r = srand(hashSeed(Math.round(x * 7), Math.round(y * 7)));
        for (let rr = 0; rr < rows; rr++) {
          const v = 0.12 + rr * (0.82 / rows);
          const a = face(0.02, v), b = face(0.98, v); g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          if (p.type === "shelf") for (let cc = 0; cc < cols * 2; cc++) { const u = (cc + 0.2 + r() * 0.5) / (cols * 2), pa = face(u, v + 0.02), pb = face(u + 0.3 / (cols * 2), v + 0.02); g.strokeStyle = ["#ec2a1c", "#f6b62c", "#3dd6ff", "#c6ff3d", "#eee4d3", "#ff7ad9"][Math.floor(r() * 6)]; g.lineWidth = 3.2; g.beginPath(); g.moveTo(pa[0], pa[1] - 3); g.lineTo(pb[0], pb[1] - 3); g.stroke(); }
        }
        if (p.type === "locker") for (let cc = 1; cc < cols; cc++) { const a = face(cc / cols, 0.02), b = face(cc / cols, 0.98); g.strokeStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); const k = face((cc - 0.5) / cols, 0.55); g.fillStyle = "#e8e8e8"; g.fillRect(k[0] - 1, k[1] - 1, 2, 3); }
        break;
      }
      case "plant": case "tree": {
        const tree = p.type === "tree", cx = x + w / 2, cy = y + h / 2, potH = tree ? 0.4 : 0.35;
        box(cx - w * 0.25, cy - h * 0.25, w * 0.5, h * 0.5, 0, potH, tree ? "#6b4a2a" : "#8a4a2a", 1.1);
        const tr = P(cx, cy, potH), top = P(cx, cy, z1 + (tree ? 0.4 : 0.2));
        g.strokeStyle = tree ? "#4a3220" : "#2d6b24"; g.lineWidth = tree ? Math.max(3, s * 0.18) : 2; g.beginPath(); g.moveTo(tr[0], tr[1]); g.lineTo(top[0], top[1] + (tree ? s * 0.7 : 0)); g.stroke();
        const foliage = tree ? (p.color.length > 3 ? p.color : "#3f8f4a") : "#3f8f4a";
        const r = srand(hashSeed(Math.round(x * 13), Math.round(y * 13)));
        const R = Math.max(w, h) * s * (tree ? 0.72 : 0.5);
        for (let n = 0; n < (tree ? 14 : 7); n++) { const a = r() * 6.283, rad = r() * R * 0.75; g.fillStyle = shade(n % 3 === 0 && tree ? "#f6e24a" : foliage, 0.75 + r() * 0.5); g.beginPath(); g.arc(top[0] + Math.cos(a) * rad, top[1] + (tree ? -s * 0.1 : 0) + Math.sin(a) * rad * 0.7, R * (0.28 + r() * 0.2), 0, 6.283); g.fill(); }
        break;
      }
      case "vending": {
        box(x, y, w, h, 0, z1, c, 1.0);
        const a = fS(0.12, 0.2), b = fS(0.88, 0.2), c2 = fS(0.88, 0.9), d = fS(0.12, 0.9);
        poly([a, b, c2, d], "#0b1822", "#222"); const r = srand(hashSeed(Math.round(x * 3), Math.round(y * 3)));
        for (let i = 0; i < 12; i++) { const u = 0.18 + (i % 4) * 0.19, v = 0.3 + Math.floor(i / 4) * 0.19, q = fS(u, v); g.fillStyle = ["#ec2a1c", "#f6b62c", "#3dd6ff", "#c6ff3d", "#ff7ad9"][Math.floor(r() * 5)]; g.fillRect(q[0] - 2, q[1] - 3, 4, 5); }
        const l = fS(0.5, 0.12); g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(l[0] - 5, l[1] - 2, 10, 3);
        break;
      }
      case "wheel": {const foot=P(x+w/2,y+h/2,0),top=P(x+w/2,y+h/2,3);g.strokeStyle='#b8b1a0';g.lineWidth=3;g.beginPath();g.moveTo(foot[0]-s*1.8,foot[1]);g.lineTo(top[0],top[1]);g.lineTo(foot[0]+s*1.8,foot[1]);g.stroke();break;}
      case "aquarium": {box(x,y,w,h,0,.25,'#5c625a');box(x,y,w,h,.25,z1,'#3c6268');g.strokeStyle='#8fa8a6';g.lineWidth=2;const a=P(x,y+h,z1),b=P(x+w,y+h,z1);g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();break;}
      case "machine": {
        box(x, y, w, h, 0, z1, c, 1.1);
        const a = fS(0.15, 0.4), b = fS(0.85, 0.4), c2 = fS(0.85, 0.85), d = fS(0.15, 0.85);
        poly([a, b, c2, d], "#06121a", "rgba(255,255,255,.2)"); g.fillStyle = "#4df0ff"; const m = fS(0.5, 0.62); g.fillRect(m[0] - 4, m[1] - 3, 8, 2); g.fillRect(m[0] - 4, m[1] + 1, 5, 2);
        break;
      }
      case "bars": {
        box(x, y + h - 0.06, w, 0.06, 0, 0.1, "#444", 1); box(x, y, w, 0.06, z1 - 0.06, z1, "#555", 1.1);
        const n = Math.round(Math.max(w, h) / 0.3);
        for (let i = 0; i <= n; i++) { const t = i / n, a = P(x + (w >= h ? t * w : 0), y + (w >= h ? 0 : t * h), 0.05), b = P(x + (w >= h ? t * w : 0), y + (w >= h ? 0 : t * h), z1 - 0.05); g.strokeStyle = "#aab4c0"; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 0.8; g.stroke(); }
        break;
      }
      case "lift": {
        box(x, y, w, h, 0, z1, c, 1.0);
        const n = Math.max(1, Math.round(w / 1.3)), dw = 1 / n;
        for (let i = 0; i < n; i++) { const a = fS(i * dw + 0.08 * dw, 0.03), b = fS((i + 1) * dw - 0.08 * dw, 0.03), c2 = fS((i + 1) * dw - 0.08 * dw, 0.82), d = fS(i * dw + 0.08 * dw, 0.82); poly([a, b, c2, d], "#c4ccd2", "#222"); const m = fS(i * dw + dw / 2, 0.03), m2 = fS(i * dw + dw / 2, 0.82); g.strokeStyle = "#555"; g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(m2[0], m2[1]); g.stroke(); }
        const t = fS(0.5, 0.9); g.fillStyle = "#111"; g.fillRect(t[0] - 8, t[1] - 3, 16, 5); led(t[0], t[1] - 0.5, "#ff5a3d");
        break;
      }
      case "stairs": {
        const steps = 6; for (let i = 0; i < steps; i++) box(x, y + (h * i) / steps, w, h / steps, 0, z1 * ((steps - i) / steps) * 0.95 + 0.05, shade(c, 0.9 + i * 0.03), 1.15);
        break;
      }
      case "bath": {
        box(x, y, w, h, 0, z1, "#e8e8e8", 1.05);
        const q = [P(x + 0.1, y + 0.1, z1 + 0.01), P(x + w - 0.1, y + 0.1, z1 + 0.01), P(x + w - 0.1, y + h - 0.1, z1 + 0.01), P(x + 0.1, y + h - 0.1, z1 + 0.01)];
        poly(q, w * h < 1 ? "#cfd8dc" : "#9fd8ff");
        break;
      }
      case "fridge": {
        box(x, y, w, h, 0, z1, c, 1.1);
        const a = fS(0.05, 0.62), b = fS(0.95, 0.62); g.strokeStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        const hnd = fS(0.85, 0.78), hnd2 = fS(0.85, 0.95); g.strokeStyle = "#777"; g.lineWidth = 2; g.beginPath(); g.moveTo(hnd[0], hnd[1]); g.lineTo(hnd2[0], hnd2[1]); g.stroke();
        break;
      }
      case "fountain": {
        box(x, y, w, h, 0, z1, "#8a8f96", 1.1);
        const q = [P(x + 0.18, y + 0.18, z1 + 0.01), P(x + w - 0.18, y + 0.18, z1 + 0.01), P(x + w - 0.18, y + h - 0.18, z1 + 0.01), P(x + 0.18, y + h - 0.18, z1 + 0.01)];
        poly(q, c); const m = P(x + w / 2, y + h / 2, z1 + 0.02); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1; for (let k = 1; k <= 2; k++) { g.beginPath(); g.ellipse(m[0], m[1], k * s * 0.3, k * s * 0.15, 0, 0, 6.283); g.stroke(); }
        break;
      }
      case "trolley": {
        box(x, y, w, h, 0.16, 0.26, c, 1.1);
        for (const [lx, ly] of [[0.1, 0.1], [w - 0.1, 0.1], [0.1, h - 0.1], [w - 0.1, h - 0.1]]) { const a = P(x + lx, y + ly, 0); g.fillStyle = "#111"; g.beginPath(); g.arc(a[0], a[1] - 2, 2.2, 0, 6.283); g.fill(); }
        const a = P(x + 0.06, y + 0.06, 0.26), b = P(x + 0.06, y + 0.06, z1); g.strokeStyle = "#999"; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        break;
      }
      case "bin": { box(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8, 0, z1, c, 1.0); break; }
      case "lamp": {
        const m = P(x + w / 2, y + h / 2, 0), t = P(x + w / 2, y + h / 2, z1);
        g.strokeStyle = "#333"; g.lineWidth = 2; g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(t[0], t[1]); g.stroke();
        const gr = g.createRadialGradient(t[0], t[1], 2, t[0], t[1], s * 1.4); gr.addColorStop(0, "rgba(255,236,170,.55)"); gr.addColorStop(1, "rgba(255,236,170,0)"); g.fillStyle = gr; g.beginPath(); g.arc(t[0], t[1], s * 1.4, 0, 6.283); g.fill();
        g.fillStyle = c; g.beginPath(); g.moveTo(t[0] - 6, t[1] + 2); g.lineTo(t[0] + 6, t[1] + 2); g.lineTo(t[0] + 3.5, t[1] - 6); g.lineTo(t[0] - 3.5, t[1] - 6); g.closePath(); g.fill();
        break;
      }
      case "pillar": { const m = P(x + w / 2, y + h / 2, 0), t = P(x + w / 2, y + h / 2, z1); const rr = Math.max(w, h) * s * 0.5; const gr = g.createLinearGradient(m[0] - rr, 0, m[0] + rr, 0); gr.addColorStop(0, shade(c, 1.1)); gr.addColorStop(1, shade(c, 0.55)); g.fillStyle = gr; g.fillRect(m[0] - rr, t[1], rr * 2, m[1] - t[1]); g.beginPath(); g.ellipse(t[0], t[1], rr, rr * 0.5, 0, 0, 6.283); g.fillStyle = shade(c, 1.2); g.fill(); break; }
      case "stanchion": { const m = P(x + w / 2, y + h / 2, 0), t = P(x + w / 2, y + h / 2, z1); g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(t[0], t[1]); g.stroke(); g.fillStyle = c; g.beginPath(); g.arc(t[0], t[1], 2.5, 0, 6.283); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.ellipse(m[0], m[1], 5, 2.5, 0, 0, 6.283); g.fill(); break; }
      case "vault": {
        box(x, y, w, h, 0, z1, c, 1.0);
        const m = fS(0.5, 0.5), R = Math.min(w, z1) * s * 0.34;
        g.fillStyle = "#4a5560"; g.beginPath(); g.ellipse(m[0], m[1], R, R, 0, 0, 6.283); g.fill(); g.strokeStyle = "#cfd8dc"; g.lineWidth = 2; g.stroke(); g.beginPath(); g.ellipse(m[0], m[1], R * 0.45, R * 0.45, 0, 0, 6.283); g.stroke();
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + 0.4; g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(m[0] + Math.cos(a) * R * 0.45, m[1] + Math.sin(a) * R * 0.45); g.stroke(); }
        break;
      }
      case "rack": {
        for (let i = 0; i < Math.max(2, Math.round(Math.max(w, h) / 0.4)); i++) { const t = (i + 0.5) / Math.max(2, Math.round(Math.max(w, h) / 0.4)); const m = P(x + (w >= h ? t * w : w / 2), y + (w >= h ? h / 2 : t * h), 0); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.ellipse(m[0], m[1] - s * 0.25, s * 0.17, s * 0.3, 0, 0, 6.283); g.stroke(); }
        box(x, y, w, h, 0, 0.05, "#222", 1);
        break;
      }
      default: box(x, y, w, h, 0, Math.max(0.1, z1), c);
    }
    // top-of-prop LEDs on electronics are live; sprites hold the static art only
  }

  // ------------------------------------------------------------------ frame
  render(st: ViewState, def: InteriorDef): void {
    if (def !== this.def) this.setDef(def);
    const g = this.g, d = this.dpr, s = this.s, W = def.size.w, H = def.size.h;
    const day = st.hour >= 7 && st.hour < 19;
    if (!this.staticLayer || this.staticLayer.day !== day) this.buildStatic(day);
    g.setTransform(d, 0, 0, d, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#07050a"; g.fillRect(0, 0, this.cssW, this.cssH);
    // camera: whole room if it fits, else follow the player (clamped to the room)
    const P0 = this.proj(0, 0);
    const lay = this.staticLayer!;
    const roomMinX = -H * s, roomMaxX = W * s, roomMinY = -WALL_H * this.Zh, roomMaxY = (W + H) * 0.5 * s + s * 0.3;
    const rw = roomMaxX - roomMinX, rh = roomMaxY - roomMinY;
    const topInset = 56, botInset = 12;
    const availH = this.cssH - topInset - botInset;
    const pp = P0(st.player.x, st.player.y, 0.8);
    let camX: number, camY: number;
    if (rw <= this.cssW - 8) camX = this.cssW / 2 - (roomMinX + rw / 2); else camX = Math.max(this.cssW - 8 - roomMaxX, Math.min(8 - roomMinX, this.cssW / 2 - pp[0]));
    if (rh <= availH) camY = topInset + availH / 2 - (roomMinY + rh / 2); else camY = Math.max(this.cssH - botInset - roomMaxY, Math.min(topInset - roomMinY, topInset + availH / 2 - pp[1]));
    // ease so tiny float steps never shimmer
    this.camX = Math.round(camX); this.camY = Math.round(camY);
    g.drawImage(lay.cv, this.camX - lay.ox, this.camY - lay.oy, lay.w, lay.h);

    // near-glow rings for interactables
    const P = this.proj(this.camX, this.camY);
    const rings=new ScreenBounds(this.cssW,this.cssH);
    const nearby=def.interactables.filter(it=>Math.hypot(it.x-st.player.x,it.y-st.player.y)<3.5).sort((a,b)=>Number(b.id===st.near)-Number(a.id===st.near));
    for (const it of nearby) {
      const [sx, sy] = P(it.x, it.y, 0), isNear = st.near === it.id, pulse = 0.5 + 0.5 * Math.sin(st.t * 3 + it.x);
      if(!rings.reserve({x:sx-s*.45,y:sy-s*.23,w:s*.9,h:s*.46}))continue;
      g.strokeStyle = isNear ? "#c6ff3d" : "rgba(198,255,61,.5)"; g.lineWidth = isNear ? 2.2 : 1.4;
      g.beginPath(); g.ellipse(sx, sy, s * (0.38 + 0.06 * pulse), s * (0.19 + 0.03 * pulse), 0, 0, 6.283); g.stroke();
      if (isNear) { g.fillStyle = "rgba(198,255,61,.14)"; g.fill(); }
    }
    // exit mat glow
    if (st.exitNear) { const [sx, sy] = P(0.5, def.door.y, 0); g.strokeStyle = "#6bff9a"; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy, s * 0.5, s * 0.25, 0, 0, 6.283); g.stroke(); }

    // depth-sorted: props and living things
    type Item = { key: number; draw: () => void };
    const items: Item[] = [];
    for (const o of this.order) { const pr = def.props[o.prop]; items.push({ key: o.key, draw: () => { const sp = this.spriteFor(o.prop); g.drawImage(sp.cv, this.camX + sp.dx, this.camY + sp.dy, sp.w, sp.h); this.liveBits(g, P, pr, st.t); } }); }
    const all = [st.player, ...st.actors];
    for (const a of all){items.push({ key: a.x + a.y + 0.02, draw: () => this.figure(g, P, a, st) });
      for(const w of a.char?.wounds??[]){const l=w.detached;if(!l)continue;const x=a.x+l.x-a.char!.x,y=a.y+l.y-a.char!.y;items.push({key:x+y+.01,draw:()=>drawDetachedLimb(g,a.char!,w,...P(x,y,l.z),this.s*.0172*(a.look.scale||1))});}
    }
    items.sort((a, b) => a.key - b.key);
    for (const it of items) it.draw();

    // near-prop labels and interactable captions
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    for (const it of def.interactables) {
      if (st.near !== it.id) continue;
      const [sx, sy] = P(it.x, it.y, 0);
      this.tag(g, it.label, sx, sy - s * 2.15, "#c6ff3d");
    }
    this.lighting(g, def, st, P);
  }

  private liveBits(g: CanvasRenderingContext2D, P: Proj, p: Prop, t: number): void {
    if(p.type==='wheel'){const [cx,cy]=P(p.x+p.w/2,p.y+p.h/2,3),r=this.s*2.5;g.save();g.strokeStyle='#c5baa1';g.lineWidth=2;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();for(let i=0;i<10;i++){const a=i*Math.PI/5+t*.1,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;g.beginPath();g.moveTo(cx,cy);g.lineTo(x,y);g.stroke();g.fillStyle=['#9e6755','#a7915c','#5f7c78'][i%3];g.fillRect(x-5,y,10,7);g.strokeRect(x-5,y,10,7);}g.restore();}
    else if(p.type==='aquarium'){g.save();for(let i=0;i<8;i++){const u=.15+((t*.035+i*.127)%1)*.7,v=.2+(i%3)*.22,[x,y]=P(p.x+p.w*u,p.y+p.h,.55+v);g.fillStyle=i%2?'#d0ba86':'#a4b8b5';g.beginPath();g.ellipse(x,y,3.5,1.6,0,0,Math.PI*2);g.fill();}g.restore();}
    else if (p.type === "machine" || p.type === "vending") { const m = P(p.x + p.w * 0.85, p.y + p.h, PROP_INFO[p.type].ht * 0.95); const on = Math.sin(t * 2 + p.x * 3) > -0.2; g.fillStyle = on ? "#6bff9a" : "#1a3a22"; g.fillRect(m[0] - 1, m[1] - 1, 2.5, 2.5); }
    else if (p.type === "bed" && p.label) { /* obs monitors blink via machine */ }
  }

  private tag(g: CanvasRenderingContext2D, text: string, x: number, y: number, col: string): void {
    g.font = "600 11px 'IBM Plex Mono', monospace";
    const w = Math.min(this.cssW - 12, g.measureText(text).width + 14), left = Math.max(6, Math.min(this.cssW - 6 - w, x - w / 2));
    g.fillStyle = "rgba(10,8,12,.86)"; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(left, y - 12, w, 17, 6) : g.rect(left, y - 12, w, 17); g.fill();
    g.strokeStyle = col; g.lineWidth = 1; g.stroke();
    g.fillStyle = col; g.textAlign = "left"; g.fillText(text, left + 7, y + 0.5, w - 10); g.textAlign = "center";
  }

  private figure(g: CanvasRenderingContext2D, P: Proj, a: ViewActor, st: ViewState): void {
    const [sx, sy] = P(a.x, a.y, a.lying ? 0.5 : 0);
    const k = this.s * 0.0172 * (a.look.scale || 1);
    g.fillStyle = "rgba(0,0,0,.34)"; g.beginPath(); g.ellipse(sx, sy, 15 * k, 4.2 * k, 0, 0, 6.283); g.fill();
    const injuryPose=a.char?.phys===2?"down":a.char?.phys===1?"stumble":a.pose;
    const A = pose(injuryPose, a.style, st.t + a.seed, a.phase, a.speed, a.poseT);
    applyNegativeReaction(A,this.figureOf(a),st.t,a.speed,a.pose);
    solve(A, sx, sy, k, a.dir);
    drawFigure(g, this.figureOf(a), sx, sy, k, a.dir, st.t, 0, 1);
    if (a.isPlayer) { g.fillStyle = "#ec2a1c"; g.font = "700 10px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.fillText("You", sx, sy + 13); }
    else if (st.nearActor === a.id && a.name) this.tag(g, a.name, sx, sy - 122 * k - 6, "#eee4d3");
  }

  private lighting(g: CanvasRenderingContext2D, def: InteriorDef, st: ViewState, P: Proj): void {
    const w = this.cssW, h = this.cssH, s = this.s;
    // warm light pools from lamps and wall sconces, lighting props and people too
    const night = st.hour < 7 || st.hour >= 19, a = night ? 0.3 : 0.16;
    const pool = (sx: number, sy: number, rad: number, al: number): void => {
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad); gr.addColorStop(0, `rgba(255,170,80,${al})`); gr.addColorStop(1, "rgba(255,170,80,0)");
      g.fillStyle = gr; g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    };
    g.globalCompositeOperation = "lighter";
    for (const sc of wallSconces(def)) { const [sx, sy] = sc.side === "n" ? P(sc.at + sc.len / 2, 1.1, 0) : P(1.1, sc.at + sc.len / 2, 0); pool(sx, sy, s * 3.4, a); }
    for (const p of def.props) if (p.type === "lamp") { const [sx, sy] = P(p.x + p.w / 2, p.y + p.h / 2, 0.2); pool(sx, sy, s * 3, a * 1.2); }
    g.globalCompositeOperation = "source-over";
    const tint = { cool: "rgba(120,190,255,.07)", warm: "rgba(255,190,110,.09)", dim: "rgba(40,20,70,.28)", soft: "rgba(180,255,210,.06)", neon: "rgba(255,70,200,.12)" }[def.light];
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    const flick = def.ambience.includes("fluorescent") ? 0.02 * Math.max(0, Math.sin(st.t * 31) * Math.sin(st.t * 1.7)) : 0;
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${0.55 + flick})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}
