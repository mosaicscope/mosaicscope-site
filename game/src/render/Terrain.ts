import {drawFixture} from "./CivicArt";
import {ROAD_PAINT,paintRoadArrow} from './RoadArt';
import { reserveSign } from "./ScreenBounds";
import { World, T, TILE_HEIGHT, Poi, ROAD_W, CROSS_W, PERIOD } from "../world/World";
import { decorGrid, D } from "./StreetDecor";
import { hash01 } from "./noir";
import { drawBin } from "./LitterArt";
import { TILE_W, TILE_H, Z_PX } from "../world/iso";
import { GROUND } from "./palette";
import type { Camera } from "./Camera";
import { drawAd } from "./Ads";
import { fillTextured, type Material } from "./Textures";

/** Which material each ground type gets, and how strongly. */
const MAT_OF: Record<number, [Material, number]> = { 0: ["grass", 0.9], 1: ["pavers", 0.9], 2: ["concrete", 0.7], 13: ["asphalt", 0.9], 14: ["concrete", 0.5], 16: ["asphalt", 1], 17: ["pavers", 0.9], 18: ["asphalt", 1], 20: ["asphalt", 0.8] };

/**
 * Ground is pre-rendered into 16x16-tile chunk canvases (only rebuilt when tiles change).
 * Tall tiles (walls, trees, stalls, fences...) are drawn per frame inside the depth-sorted pass.
 */
const CH = 16;

export class Terrain {
  private chunks = new Map<number, { cv: HTMLCanvasElement; ox: number; oy: number }>();
  /** Ultra: chunks are baked at 2x so ground stays razor sharp when zoomed in. */
  private sc = 1;
  setUltra(on: boolean): void { const n = on ? 2 : 1; if (n !== this.sc) { this.sc = n; this.chunks.clear(); } }
  chunksBuilt = 0;
  constructor(private world: World) {}

  invalidateAll(): void { this.chunks.clear(); }

  private noise(i: number): number { let h = (i * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /** Smooth value noise over the tile lattice (0..1), so ground colour drifts instead of alternating. */
  private smooth(tx: number, ty: number): number {
    const f = (x: number, y: number) => this.noise(y * 4099 + x);
    const gx = tx / 3, gy = ty / 3, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (f(ix, iy) * (1 - u) + f(ix + 1, iy) * u) * (1 - v) + (f(ix, iy + 1) * (1 - u) + f(ix + 1, iy + 1) * u) * v;
  }

  private build(cx: number, cy: number) {
    const w = this.world, S = w.size;
    const x0 = cx * CH, y0 = cy * CH;
    const ox = (x0 - (y0 + CH)) * (TILE_W / 2), oy = (x0 + y0) * (TILE_H / 2);
    const cv = document.createElement("canvas");
    const SC = this.sc;
    cv.width = (CH * TILE_W + 2) * SC; cv.height = (CH * TILE_H + 2) * SC;
    const g = cv.getContext("2d")!;
    g.scale(SC, SC);
    const anchor = { x: -ox, y: -oy, zoom: 1 }; // grain is pinned to the world, so it runs on across chunk edges
    const hw = TILE_W / 2, hh = TILE_H / 2, bleed = 0.7; // diamonds overdraw a hair so no seam lattice shows between tiles
    const diamond = (sx: number, sy: number) => { g.moveTo(sx, sy - bleed); g.lineTo(sx + hw + bleed, sy + hh); g.lineTo(sx, sy + TILE_H + bleed); g.lineTo(sx - hw - bleed, sy + hh); g.closePath(); };
    // tiles sharing a material get their grain in ONE fill: filling tile by tile double-covers every shared edge (the criss-cross)
    const grit = new Map<string, { m: Material; a: number; at: number[] }>();
    const cell: { sx: number; sy: number; base: number; n: number; tx: number; ty: number }[] = [];
    for (let ty = y0; ty < Math.min(S, y0 + CH); ty++) for (let tx = x0; tx < Math.min(S, x0 + CH); tx++) {
      const t = w.tiles[ty * S + tx];
      const base = groundOf(w, tx, ty, t);
      const n = this.noise(ty * S + tx);
      const [c1, c2] = GROUND[base] ?? ["#1a1614", "#1e1a17"];
      const sx = (tx - ty) * hw - ox, sy = (tx + ty) * hh - oy;
      // soft tonal variation: blend the two ground colours smoothly (no checkerboard)
      g.fillStyle = base === T.WATER ? waterShade(g, sx, sy, w, tx, ty) : mix(c1, c2, this.smooth(tx, ty), base === T.GRASS ? 0 : zoneAt(w, tx, ty));
      g.beginPath(); diamond(sx, sy); g.fill();
      const mat = MAT_OF[base];
      if (mat) { const k = mat[0] + mat[1]; let e = grit.get(k); if (!e) grit.set(k, e = { m: mat[0], a: mat[1], at: [] }); e.at.push(sx, sy); }
      cell.push({ sx, sy, base, n, tx, ty });
    }
    for (const e of grit.values()) {
      g.beginPath(); for (let i = 0; i < e.at.length; i += 2) diamond(e.at[i], e.at[i + 1]);
      fillTextured(g, e.m, e.a, anchor);
    }
    for (const c of cell) detail(g, c.base, c.sx, c.sy, c.n, w, c.tx, c.ty);
    this.chunksBuilt++;
    return { cv, ox, oy };
  }

  draw(g: CanvasRenderingContext2D, cam: Camera): void {
    const S = this.world.size, n = Math.ceil(S / CH);
    for (const i of this.world.dirtyTiles) { const tx = i % S, ty = Math.floor(i / S); this.chunks.delete(Math.floor(ty / CH) * n + Math.floor(tx / CH)); }
    this.world.dirtyTiles.clear();
    const z = cam.zoom, pt = { x: 0, y: 0 };
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
      const x0 = cx * CH, y0 = cy * CH;
      cam.toScreen(x0, y0 + CH, 0, pt); const left = pt.x;
      cam.toScreen(x0 + CH, y0, 0, pt); const right = pt.x;
      cam.toScreen(x0, y0, 0, pt); const top = pt.y;
      cam.toScreen(x0 + CH, y0 + CH, 0, pt); const bottom = pt.y;
      if (right < 0 || left > cam.viewW || bottom < 0 || top > cam.viewH) continue;
      const key = cy * n + cx;
      let ch = this.chunks.get(key);
      if (!ch) { ch = this.build(cx, cy); this.chunks.set(key, ch); }
      g.drawImage(ch.cv, left, top, (ch.cv.width / this.sc) * z, (ch.cv.height / this.sc) * z);
    }
  }
}

function mix(a: string, b: string, t: number, zone = 0): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  // zone: warm (+) pushes red up and blue down, cool (-) the other way; a few levels, never a different material
  const r = p(a, 0) + (p(b, 0) - p(a, 0)) * t + zone * 5, gr = p(a, 1) + (p(b, 1) - p(a, 1)) * t + zone * 1.5, bl = p(a, 2) + (p(b, 2) - p(a, 2)) * t - zone * 5;
  return `rgb(${Math.round(Math.max(0, r))},${Math.round(Math.max(0, gr))},${Math.round(Math.max(0, bl))})`;
}

const ZONE_OF: Partial<Record<string, number>> = { market: 0.9, food: 0.8, shops: 0.6, residential: 0.5, playground: 0.4, nightlife: 0.2, plaza: 0.3, gallery: 0.1, park: 0, office: -0.5, studio: -0.4, court: -0.5, airport: -0.8, hospital: -0.6, police: -0.6, casino: 0.3 };
const zones = new WeakMap<World, Float32Array>();
/** Warm/cool tone of each city block (from its district), blended smoothly across the roads between blocks. -1 cool .. +1 warm. */
function zoneAt(w: World, tx: number, ty: number): number {
  let z = zones.get(w);
  const nb = Math.ceil(w.size / PERIOD);
  if (!z) {
    z = new Float32Array(nb * nb);
    for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
      const cx = bx * PERIOD + (PERIOD + ROAD_W) / 2, cy = by * PERIOD + (PERIOD + ROAD_W) / 2;
      const a = w.areas[w.areaOf[Math.min(w.size - 1, cy) * w.size + Math.min(w.size - 1, cx)]];
      z[by * nb + bx] = Math.max(-1, Math.min(1, (ZONE_OF[a?.kind ?? "street"] ?? 0) + (hash01(bx * 31 + by * 57) - 0.5) * 0.5));
    }
    zones.set(w, z);
  }
  // bilinear between block centres
  const gx = (tx - (PERIOD + ROAD_W) / 2) / PERIOD, gy = (ty - (PERIOD + ROAD_W) / 2) / PERIOD;
  const x0 = Math.max(0, Math.min(nb - 1, Math.floor(gx))), y0 = Math.max(0, Math.min(nb - 1, Math.floor(gy)));
  const x1 = Math.min(nb - 1, x0 + 1), y1 = Math.min(nb - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, gx - x0)), fy = Math.max(0, Math.min(1, gy - y0));
  return (z[y0 * nb + x0] * (1 - fx) + z[y0 * nb + x1] * fx) * (1 - fy) + (z[y1 * nb + x0] * (1 - fx) + z[y1 * nb + x1] * fx) * fy;
}

/** Smooth value noise at world position (tile units), 0..1. Pinned to the world so water colour flows across tile and chunk edges. */
function wnoise(x: number, y: number): number {
  const h = (ix: number, iy: number) => { let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
}

/** Water colour at a world point: deep ink-teal offshore, glassy turquoise in the shallows, drifting with two octaves of noise so no tile repeats. */
function waterColour(w: World, x: number, y: number, tx: number, ty: number): string {
  let land = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (w.tile(tx + dx, ty + dy) !== T.WATER) land += 1 / (1 + dx * dx + dy * dy);
  const sh = Math.min(1, Math.max(0, land * 0.42 - 0.12));                                   // 0 deep .. 1 shallow
  const n = wnoise(x * 0.35, y * 0.35) * 0.65 + wnoise(x * 0.9 + 40, y * 0.9 - 17) * 0.35; // 0..1 large + small patches
  const d = 1 - sh;
  const r = 15 + sh * 9 + n * 7 - d * 2;
  const gg = 30 + sh * 20 + n * 10;
  const b = 36 + sh * 16 + n * 12;
  return `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(b)})`;
}

/** Water: a per-tile gradient between colours sampled at the tile's top and bottom corners (continuous across tiles), baked into the chunk. */
function waterShade(g: CanvasRenderingContext2D, sx: number, sy: number, w: World, tx: number, ty: number): CanvasGradient {
  const grd = g.createLinearGradient(sx, sy, sx, sy + TILE_H);
  grd.addColorStop(0, waterColour(w, tx, ty, tx, ty));
  grd.addColorStop(0.5, waterColour(w, tx + 0.5, ty + 0.5, tx, ty));
  grd.addColorStop(1, waterColour(w, tx + 1, ty + 1, tx, ty));
  return grd;
}

/** What ground to paint under a tile (solid tiles show their district's floor). */
function groundOf(w: World, tx: number, ty: number, t: number): number {
  if (GROUND[t] && t !== T.WATER) return t;
  if (t === T.WATER) return T.WATER;
  const a = w.areas[w.areaOf[ty * w.size + tx]];
  switch (a?.kind) { case "studio": return T.FLOOR; case "court": return T.COURT; case "market": return T.PATH; case "park": case "residential": return T.GRASS; default: return T.PAVE; }
}

function detail(g: CanvasRenderingContext2D, t: number, sx: number, sy: number, n: number, w: World, tx: number, ty: number): void {
  const hw = TILE_W / 2, hh = TILE_H / 2;
  switch (t) {
    case T.GRASS: {
      g.strokeStyle = "rgba(198,255,61,.07)"; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = (n * 7 + i * 0.37) % 1, b = (n * 13 + i * 0.61) % 1; const x = sx + (a - 0.5) * hw, y = sy + hh + (b - 0.5) * hh * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 3); g.stroke(); }
      break;
    }
    case T.PAVE: case T.PATH: {
      // (no per-tile chevrons: repeated every tile they formed a diagonal criss-cross lattice)
      break;
    }
    case T.WATER: {
      // shore: a wide soft turquoise wash, then a thin bright foam line, along any edge that meets land
      const land = (dx: number, dy: number) => w.tile(tx + dx, ty + dy) !== T.WATER;
      const edges = (inset: number) => {
        g.beginPath();
        if (land(0, -1)) { g.moveTo(sx, sy + inset); g.lineTo(sx + hw - inset, sy + hh); }
        if (land(1, 0)) { g.moveTo(sx + hw - inset, sy + hh); g.lineTo(sx, sy + TILE_H - inset); }
        if (land(0, 1)) { g.moveTo(sx, sy + TILE_H - inset); g.lineTo(sx - hw + inset, sy + hh); }
        if (land(-1, 0)) { g.moveTo(sx - hw + inset, sy + hh); g.lineTo(sx, sy + inset); }
      };
      g.lineCap = "round";
      g.strokeStyle = "rgba(85,112,105,.12)"; g.lineWidth = 7; edges(4); g.stroke();
      g.strokeStyle = "rgba(128,155,145,.16)"; g.lineWidth = 3.2; edges(2.5); g.stroke();
      g.strokeStyle = "rgba(172,185,170,.22)"; g.lineWidth = 1.1; edges(1.2); g.stroke();
      g.stroke(); g.lineCap = "butt";
      break;
    }
    case T.FLOOR: break;
    case T.COURT: {
      const edge = (dx: number, dy: number) => w.tile(tx + dx, ty + dy) !== T.COURT && w.tile(tx + dx, ty + dy) !== T.FENCE;
      g.strokeStyle = "rgba(238,228,211,.35)"; g.lineWidth = 1.5; g.beginPath();
      if (edge(0, -1)) { g.moveTo(sx, sy + 3); g.lineTo(sx + hw - 4, sy + hh); }
      if (edge(-1, 0)) { g.moveTo(sx, sy + 3); g.lineTo(sx - hw + 4, sy + hh); }
      g.stroke();
      break;
    }
    case T.SAND: g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 4; i++) g.fillRect(sx + ((n * (i + 3) * 17) % 1 - 0.5) * hw, sy + hh + ((n * (i + 5) * 11) % 1 - 0.5) * hh, 1.5, 1.5); break;
    case T.STREET: {
      const S = w.size;
      if ((ty === 1 || ty === S - 2) && tx % 3 === 0) { g.strokeStyle = "rgba(246,182,44,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - hw * 0.5, sy + hh * 0.5); g.lineTo(sx + hw * 0.5, sy + hh * 1.5); g.stroke(); }
      if ((tx === 1 || tx === S - 2) && ty % 3 === 0) { g.strokeStyle = "rgba(246,182,44,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx + hw * 0.5, sy + hh * 0.5); g.lineTo(sx - hw * 0.5, sy + hh * 1.5); g.stroke(); }
      break;
    }
    case T.ROAD: {
      // four-lane road: kerb edge lines, dashed lane dividers, a solid centre line, stop lines before
      // each crossing and lane arrows. (u, v) are tile-local 0..1 coords; mx/my the offset in the road.
      const P = w.period, RW = ROAD_W;
      const vertical = w.isRoadLine(tx) && !w.isRoadLine(ty), horizontal = w.isRoadLine(ty) && !w.isRoadLine(tx);
      const a = (u: number, v: number) => [sx + (u - v) * hw, sy + (u + v) * hh];
      const line = (u0: number, v0: number, u1: number, v1: number) => { const A = a(u0, v0), B = a(u1, v1); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); };
      const quad = (q: number[][], col: string) => { g.fillStyle = col; g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < q.length; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.fill(); };
      // worn patches and repairs, manhole covers
      if (n < 0.12) quad([a(0.1, 0.2), a(0.7, 0.15), a(0.8, 0.7), a(0.2, 0.8)], n < 0.06 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.035)");
      else if (n < 0.16) { const c = a(0.5, 0.5); g.fillStyle = "rgba(90,85,80,.5)"; g.beginPath(); g.ellipse(c[0], c[1], hw * 0.22, hh * 0.22, 0, 0, 6.283); g.fill(); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; g.stroke(); }
      if (!horizontal && !vertical) break; // intersection box: no markings
      const lane = horizontal ? ty % P : tx % P;     // 0..3 across the road
      const along = horizontal ? tx % P : ty % P;    // position along the block
      // the across-road coordinate is v for an east-west road, u for a north-south one
      const across = (t: number) => (horizontal ? [0, t, 1, t] : [t, 0, t, 1]) as [number, number, number, number];
      // solid white edge line along the kerb
      if (lane === 0 || lane === RW - 1) {
        g.strokeStyle = ROAD_PAINT.edge; g.lineWidth = 1.2; g.beginPath();
        const e = across(lane === 0 ? 0.08 : 0.92); line(e[0], e[1], e[2], e[3]); g.stroke();
      }
      // dashed lane dividers between the two lanes of each carriageway
      if (lane === 0 || lane === RW - 2) {
        g.strokeStyle = ROAD_PAINT.lane; g.lineWidth = 1.3; g.setLineDash([6, 8]); g.beginPath();
        const e = across(1); line(e[0], e[1], e[2], e[3]); g.stroke(); g.setLineDash([]);
      }
      // solid centre line (no crossing it) between the two carriageways
      if (lane === RW / 2 - 1) {
        g.strokeStyle = ROAD_PAINT.centre; g.lineWidth = 2; g.beginPath();
        const e = across(1); line(e[0], e[1], e[2], e[3]); g.stroke();
      }
      // stop lines just before the crossings, across the lanes heading into the intersection
      // (eastbound/northbound use lanes 0-1 and approach the intersection at lower coordinates)
      const toLow = lane >= RW / 2 ? horizontal : !horizontal; // lane carries traffic toward the lower intersection
      const firstRoad = RW + CROSS_W, lastRoad = P - CROSS_W - 1;
      if ((along === firstRoad && toLow) || (along === lastRoad && !toLow)) {
        g.strokeStyle = ROAD_PAINT.stop; g.lineWidth = 2.6; g.beginPath();
        const t = along === firstRoad ? 0.06 : 0.94;
        if (horizontal) line(t, 0, t, 1); else line(0, t, 1, t);
        g.stroke();
      }
      // painted arrows in each lane, in the direction of travel (left-hand traffic)
      if (along === firstRoad + 3 || along === lastRoad - 3) {
        const fwd = toLow ? -1 : 1;
        const dx = horizontal ? fwd : 0, dy = vertical ? fwd : 0;
        paintRoadArrow(g,a,.5,.5,dx,dy);
      }
      break;
    }
    case T.CROSSWALK: {
      // zebra stripes running along the direction of travel; (u, v) are tile-local 0..1 coords
      const vertical = w.isRoadLine(tx);
      const a = (u: number, v: number) => [sx + (u - v) * hw, sy + (u + v) * hh];
      g.fillStyle = ROAD_PAINT.zebra;
      for (let i = 0; i < 4; i++) {
        const t0 = 0.08 + i * 0.23, t1 = t0 + 0.12;
        const q = vertical ? [a(t0, 0.15), a(t1, 0.15), a(t1, 0.85), a(t0, 0.85)] : [a(0.15, t0), a(0.15, t1), a(0.85, t1), a(0.85, t0)];
        g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.fill();
      }
      break;
    }
    case T.SIDEWALK: {
      sidewalkLife(g, w, sx, sy, n, tx, ty);
      const kerb = (dx: number, dy: number) => { const t = w.tile(tx + dx, ty + dy); return t === T.ROAD || t === T.CROSSWALK; };
      g.strokeStyle = "rgba(238,228,211,.28)"; g.lineWidth = 2; g.beginPath();
      if (kerb(0, 1)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      if (kerb(1, 0)) { g.moveTo(sx, sy + TILE_H); g.lineTo(sx + hw, sy + hh); }
      if (kerb(0, -1)) { g.moveTo(sx, sy); g.lineTo(sx + hw, sy + hh); }
      if (kerb(-1, 0)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy); }
      g.stroke();
      break;
    }
    case T.PARKING: {
      if ((tx + ty) % 2 === 0) { g.strokeStyle = "rgba(238,228,211,.35)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx - hw * 0.8, sy + hh * 0.8); g.lineTo(sx - hw * 0.2, sy + hh * 0.2); g.stroke(); }
      break;
    }
    case T.STAGE: {
      const edge = (dx: number, dy: number) => w.tile(tx + dx, ty + dy) !== T.STAGE;
      g.strokeStyle = "rgba(255,122,217,.7)"; g.lineWidth = 2; g.beginPath();
      if (edge(0, -1)) { g.moveTo(sx, sy); g.lineTo(sx + hw, sy + hh); }
      if (edge(1, 0)) { g.moveTo(sx + hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      if (edge(0, 1)) { g.moveTo(sx, sy + TILE_H); g.lineTo(sx - hw, sy + hh); }
      if (edge(-1, 0)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy); }
      g.stroke();
      g.fillStyle = "rgba(255,122,217,.05)"; g.fillRect(sx - 2, sy + hh - 1, 4, 2);
      break;
    }
  }
}

/** Draw one tall tile as an isometric block or object. (sx, sy) = screen position of the tile's north corner. */
export function drawTallTile(g: CanvasRenderingContext2D, t: number, sx: number, sy: number, z: number, time: number, n: number): void {
  const hw = (TILE_W / 2) * z, hh = (TILE_H / 2) * z, h = (TILE_HEIGHT[t] ?? 1) * Z_PX * z;
  const block = (top: string, left: string, right: string, hh2 = h, inset = 0) => {
    const ix = hw * inset, iy = hh * inset;
    const N = [sx, sy + iy * 2], E = [sx + hw - ix, sy + hh], S = [sx, sy + hh * 2 - iy * 2], W = [sx - hw + ix, sy + hh];
    g.fillStyle = left; g.beginPath(); g.moveTo(W[0], W[1]); g.lineTo(S[0], S[1]); g.lineTo(S[0], S[1] - hh2); g.lineTo(W[0], W[1] - hh2); g.closePath(); g.fill();
    g.fillStyle = right; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.lineTo(E[0], E[1] - hh2); g.lineTo(S[0], S[1] - hh2); g.closePath(); g.fill();
    g.fillStyle = top; g.beginPath(); g.moveTo(N[0], N[1] - hh2); g.lineTo(E[0], E[1] - hh2); g.lineTo(S[0], S[1] - hh2); g.lineTo(W[0], W[1] - hh2); g.closePath(); g.fill();
  };
  switch (t) {
    case T.WALL: block("#4a3a2e", "#30261f", "#272019"); g.strokeStyle = "rgba(198,255,61,.25)"; g.lineWidth = Math.max(1, z); g.beginPath(); g.moveTo(sx - hw, sy + hh - h); g.lineTo(sx, sy + hh * 2 - h); g.lineTo(sx + hw, sy + hh - h); g.stroke(); break;
    case T.STALL: {
      block("#4a3a2c", "#33281f", "#2a211a", h * 0.75, 0.12);
      // striped awning
      const ah = h * 1.05;
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? "#eee4d3" : "#ec2a1c";
        const a = i / 4, b = (i + 1) / 4;
        g.beginPath();
        g.moveTo(sx - hw + hw * 2 * a * 0.5 + 0, sy + hh - ah + hh * a); g.lineTo(sx - hw + hw * b, sy + hh - ah + hh * b);
        g.lineTo(sx - hw + hw * b + hw * 0.25, sy + hh - ah + hh * b + hh * 0.5); g.lineTo(sx - hw + hw * a + hw * 0.25, sy + hh - ah + hh * a + hh * 0.5);
        g.closePath(); g.fill();
      }
      break;
    }
    case T.TREE: {
      g.strokeStyle = "#4a3020"; g.lineWidth = 4 * z;
      g.beginPath(); g.moveTo(sx, sy + hh); g.lineTo(sx, sy + hh - 30 * z); g.stroke();
      const sway = Math.sin(time * 0.8 + n * 10) * 2 * z;
      const greens = ["#183a1c", "#1f4a22", "#2a5f2a"];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = greens[i];
        g.beginPath(); g.arc(sx + sway * (i + 1) / 3 + (i - 1) * 6 * z, sy + hh - (34 + i * 10) * z, (17 - i * 3) * z, 0, 6.283); g.fill();
      }
      g.fillStyle = "rgba(198,255,61,.12)"; g.beginPath(); g.arc(sx + sway - 4 * z, sy + hh - 58 * z, 6 * z, 0, 6.283); g.fill();
      break;
    }
    case T.FENCE: {
      g.strokeStyle = "rgba(154,141,128,.55)"; g.lineWidth = Math.max(1, 1.2 * z);
      g.beginPath();
      for (const [px, py] of [[sx - hw, sy + hh], [sx, sy + hh * 2], [sx + hw, sy + hh]]) { g.moveTo(px, py); g.lineTo(px, py - h); }
      g.moveTo(sx - hw, sy + hh - h); g.lineTo(sx, sy + hh * 2 - h); g.lineTo(sx + hw, sy + hh - h);
      g.moveTo(sx - hw, sy + hh - h * 0.5); g.lineTo(sx, sy + hh * 2 - h * 0.5); g.lineTo(sx + hw, sy + hh - h * 0.5);
      g.stroke();
      break;
    }
    case T.HEDGE: block("#1f4a22", "#163518", "#112a13", h, 0.05); break;
    case T.CRATE: block("#7a4a22", "#5a3618", "#4a2c14", h, 0.15); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = z; g.beginPath(); g.moveTo(sx - hw * 0.85, sy + hh - h * 0.5); g.lineTo(sx, sy + hh * 1.85 - h * 0.5); g.lineTo(sx + hw * 0.85, sy + hh - h * 0.5); g.stroke(); break;
    case T.FOUNTAIN: {
      block("#3a3430", "#2a2420", "#221d1a", h);
      g.fillStyle = `rgba(61,214,255,${0.35 + Math.sin(time * 2 + n * 6) * 0.08})`;
      g.beginPath(); g.moveTo(sx, sy + hh * 0.3 - h); g.lineTo(sx + hw * 0.8, sy + hh - h); g.lineTo(sx, sy + hh * 1.7 - h); g.lineTo(sx - hw * 0.8, sy + hh - h); g.closePath(); g.fill();
      break;
    }
  }
}

/** Points of interest (benches, lamps, boombox, chests, hoops, spring pads). */
export function drawPoi(g: CanvasRenderingContext2D, p: Poi, sx: number, sy: number, z: number, time: number, party: boolean, dark: boolean): void {
  if(drawFixture(g,p,sx,sy,z))return;
  switch (p.kind) {
    case "bin": drawBin(g, sx, sy, z, p.id >= 0 && ((p.id * 2654435761) >>> 0) % 3 === 0); break;
    case "bench": {
      g.strokeStyle = "#9a5a1c"; g.lineWidth = 3 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx - 14 * z, sy - 5 * z); g.lineTo(sx + 14 * z, sy + 2 * z); g.stroke();
      g.lineWidth = 2 * z; g.beginPath(); g.moveTo(sx - 14 * z, sy - 13 * z); g.lineTo(sx + 14 * z, sy - 6 * z); g.moveTo(sx - 12 * z, sy - 5 * z); g.lineTo(sx - 12 * z, sy + 2 * z); g.moveTo(sx + 12 * z, sy + 2 * z); g.lineTo(sx + 12 * z, sy + 8 * z); g.stroke();
      break;
    }
    case "lamp": {
      g.fillStyle="#6b776e";g.beginPath();g.ellipse(sx,sy,6*z,3*z,0,0,7);g.fill();
      if(p.on&&dark){const glow=g.createRadialGradient(sx+8*z,sy-63*z,0,sx+8*z,sy-63*z,24*z);glow.addColorStop(0,"#ffe4a680");glow.addColorStop(1,"#ffe4a600");g.fillStyle=glow;g.fillRect(sx-16*z,sy-87*z,48*z,48*z);}
      g.strokeStyle = "#82918b"; g.lineWidth = 3 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 66 * z); g.lineTo(sx + 8 * z, sy - 66 * z); g.stroke();
      g.fillStyle = p.on ? (dark ? "#fff6c8" : "#d8d0b0") : "#3a3430";
      g.beginPath(); g.arc(sx + 8 * z, sy - 63 * z, 4 * z, 0, 6.283); g.fill();
      break;
    }
    case "boombox": {
      const pulse = party ? 1 + Math.abs(Math.sin(time * 7.5)) * 0.12 : 1;
      const w = 22 * z * pulse, h = 13 * z * pulse;
      g.fillStyle = "#1a1614"; g.strokeStyle = party ? "#c6ff3d" : "#9a8d80"; g.lineWidth = 1.5 * z;
      g.beginPath(); g.rect(sx - w / 2, sy - h - 3 * z, w, h); g.fill(); g.stroke();
      g.beginPath(); g.arc(sx - w * 0.25, sy - h / 2 - 3 * z, h * 0.32, 0, 6.283); g.arc(sx + w * 0.25, sy - h / 2 - 3 * z, h * 0.32, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(sx - w * 0.3, sy - h - 3 * z); g.lineTo(sx - w * 0.2, sy - h - 8 * z); g.lineTo(sx + w * 0.2, sy - h - 8 * z); g.lineTo(sx + w * 0.3, sy - h - 3 * z); g.stroke();
      break;
    }
    case "toychest": {
      g.fillStyle = "#6b3a12"; g.strokeStyle = "#f6b62c"; g.lineWidth = 1.2 * z;
      g.beginPath(); g.rect(sx - 11 * z, sy - 12 * z, 22 * z, 12 * z); g.fill(); g.stroke();
      g.fillStyle = "#7a4a22"; g.beginPath(); g.ellipse(sx, sy - 12 * z, 11 * z, 4 * z, 0, Math.PI, 0); g.fill(); g.stroke();
      break;
    }
    case "hoop": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 2 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 58 * z); g.stroke();
      g.fillStyle = "rgba(238,228,211,.8)"; g.fillRect(sx - 9 * z, sy - 70 * z, 18 * z, 12 * z);
      g.strokeStyle = "#ff9a3d"; g.beginPath(); g.ellipse(sx, sy - 56 * z, 6 * z, 2.5 * z, 0, 0, 6.283); g.stroke();
      break;
    }
    case "springpad": {
      g.strokeStyle = "#c6ff3d"; g.lineWidth = 1.5 * z;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(sx, sy - i * 2.5 * z, 12 * z, 6 * z, 0, 0, 6.283); g.stroke(); }
      break;
    }
    case "busstop": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 2 * z;
      g.beginPath(); g.moveTo(sx - 12 * z, sy); g.lineTo(sx - 12 * z, sy - 34 * z); g.moveTo(sx + 12 * z, sy + 4 * z); g.lineTo(sx + 12 * z, sy - 30 * z); g.stroke();
      g.fillStyle = "rgba(61,214,255,.25)"; g.beginPath(); g.moveTo(sx - 14 * z, sy - 34 * z); g.lineTo(sx + 14 * z, sy - 30 * z); g.lineTo(sx + 14 * z, sy - 26 * z); g.lineTo(sx - 14 * z, sy - 30 * z); g.closePath(); g.fill();
      g.fillStyle = "#f6b62c"; g.fillRect(sx - 12 * z, sy - 44 * z, 8 * z, 10 * z);
      g.fillStyle = "#0e0b0a"; g.font = `700 ${Math.max(5, Math.round(6 * z))}px monospace`; g.fillText("BUS", sx - 11.5 * z, sy - 37 * z);
      break;
    }
    case "foodtruck": {
      g.fillStyle = "#eee4d3"; g.fillRect(sx - 20 * z, sy - 26 * z, 40 * z, 20 * z);
      g.fillStyle = "#ec2a1c"; g.fillRect(sx - 20 * z, sy - 30 * z, 40 * z, 5 * z);
      g.fillStyle = "#0e0b0a"; g.fillRect(sx - 12 * z, sy - 22 * z, 18 * z, 8 * z);
      g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(sx - 12 * z, sy - 4 * z, 4 * z, 0, 6.283); g.arc(sx + 12 * z, sy - 4 * z, 4 * z, 0, 6.283); g.fill();
      if (p.name) { g.fillStyle = "#ec2a1c"; g.font = `700 ${Math.max(6, Math.round(7 * z))}px "IBM Plex Mono", monospace`; g.textAlign = "center"; g.fillText(p.name, sx, sy - 33 * z); g.textAlign = "start"; }
      break;
    }
    case "atm": g.fillStyle = "#3a3430"; g.fillRect(sx - 6 * z, sy - 22 * z, 12 * z, 22 * z); g.fillStyle = "#c6ff3d"; g.fillRect(sx - 4 * z, sy - 19 * z, 8 * z, 5 * z); break;
    case "hydrant": g.fillStyle = "#ec2a1c"; g.fillRect(sx - 3 * z, sy - 10 * z, 6 * z, 10 * z); g.beginPath(); g.arc(sx, sy - 10 * z, 3 * z, Math.PI, 0); g.fill(); break;
    case "light": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 1.5 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40 * z); g.moveTo(sx - 6 * z, sy); g.lineTo(sx, sy - 10 * z); g.lineTo(sx + 6 * z, sy); g.stroke();
      g.fillStyle = "#eee4d3"; g.fillRect(sx - 7 * z, sy - 52 * z, 14 * z, 12 * z);
      break;
    }
    case "billboard": {
      if((p.name==="mosaicscope"||!p.name)&&p.id%5!==0)break;
      if(z<1.25||!reserveSign(`street-ad:${p.id}`,{x:sx-42*z,y:sy-68*z,w:84*z,h:68*z}))break;
      g.strokeStyle = "#3a3430"; g.lineWidth = 3 * z; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40 * z); g.stroke();
      const kind = p.name === "cars" ? "cars" : p.name === "kiwi" ? "kiwi" : "mosaic";
      drawAd(g, kind, sx, sy - 38 * z, 84 * z, 30 * z, p.id, dark ? 1 : 0);
      break;
    }
    case "plane": {
      // a parked widebody on the apron, nose to the east; world x = (32, 16) px, world y = (-32, 16) px, up = 26 px
      // drawn at 0.72 scale so wings and tail stay on the apron, clear of the terminal
      const W = (wx: number, wy: number, h: number) => [sx + (wx - wy) * 0.72 * 32 * z, sy + (wx + wy) * 0.72 * 16 * z - h * 0.72 * 26 * z];
      const line = (pts: number[][], lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round"; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.lineCap = "butt"; };
      const polyF = (pts: number[][], col: string) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); };
      // shadow
      polyF([W(-3.6, -0.4, 0), W(3.6, -0.4, 0), W(3.6, 0.4, 0), W(-3.6, 0.4, 0)], "rgba(0,0,0,.25)");
      polyF([W(-0.6, -3.4, 0), W(0.6, -0.3, 0), W(0.6, 0.3, 0), W(-0.6, 3.4, 0)], "rgba(0,0,0,.2)");
      // far wing + engine
      polyF([W(0.7, -0.3, 1.0), W(-0.7, -3.4, 0.95), W(-1.1, -3.4, 0.95), W(-0.4, -0.3, 1.0)], "#b8b0a4");
      line([W(0.3, -1.4, 0.75), W(-0.3, -1.4, 0.75)], 7 * z, "#6a6560");
      // gear
      line([W(1.8, 0, 0), W(1.8, 0, 0.8)], 2 * z, "#3a3430"); line([W(-0.2, 0.3, 0), W(-0.2, 0.3, 0.8)], 2 * z, "#3a3430");
      // fuselage
      line([W(-3.4, 0, 1.25), W(3.2, 0, 1.25)], 20 * z, "#eee4d3");
      line([W(-3.4, 0, 1.0), W(3.2, 0, 1.0)], 8 * z, "#d0c8bc");
      line([W(-3.2, 0, 1.12), W(2.9, 0, 1.12)], 3 * z, "#1c4f6b");
      // nose cone + cockpit
      const n = W(3.55, 0, 1.25); g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(n[0], n[1], 9 * z, 0, 6.283); g.fill();
      polyF([W(3.3, -0.2, 1.45), W(3.55, -0.1, 1.42), W(3.55, 0.1, 1.42), W(3.3, 0.2, 1.45)], "#1c2a3e");
      // windows
      g.fillStyle = "#3a5068"; for (let i = 0; i < 18; i++) { const q = W(-2.8 + i * 0.32, 0.2, 1.38); g.fillRect(q[0] - 1.2 * z, q[1] - 1.2 * z, 2.4 * z, 2.4 * z); }
      // near wing + engine
      polyF([W(0.7, 0.3, 1.0), W(-0.7, 3.4, 0.95), W(-1.1, 3.4, 0.95), W(-0.4, 0.3, 1.0)], "#d8d0c4");
      line([W(0.4, 1.5, 0.72), W(-0.3, 1.5, 0.72)], 8 * z, "#8a8580");
      // tail fin with a koru-ish swoosh in the crew's neon
      polyF([W(-2.6, 0, 1.6), W(-3.5, 0, 3.0), W(-3.9, 0, 3.0), W(-3.6, 0, 1.5)], "#0e0b0a");
      line([W(-3.0, 0, 2.0), W(-3.5, 0, 2.6)], 2.5 * z, "#3dd6ff");
      // tailplane
      polyF([W(-3.2, -0.1, 1.5), W(-3.8, -1.1, 1.5), W(-3.9, 1.1, 1.5), W(-3.2, 0.1, 1.5)], "#c8c0b4");
      // Windows, service doors, nacelle intakes, undercarriage and apron markings.
      for(let i=0;i<22;i++){const q=W(-2.5+i*.23,.31,1.48);g.fillStyle='#2d4b5b';g.beginPath();g.ellipse(q[0],q[1],1.25*z,1.7*z,0,0,Math.PI*2);g.fill();}
      for(const dx of[-2.55,.1,2.25]){const a=W(dx,.33,1.24),b=W(dx+.18,.33,1.75);g.strokeStyle='#969d96';g.lineWidth=.8*z;g.strokeRect(a[0],b[1],Math.max(3,Math.abs(b[0]-a[0])),Math.abs(a[1]-b[1]));}
      for(const side of[-1,1]){const q=W(.2,side*1.4,.85);g.fillStyle='#48515a';g.beginPath();g.ellipse(q[0],q[1],7*z,4*z,-.25,0,Math.PI*2);g.fill();g.strokeStyle='#a5aaa4';g.lineWidth=1.4*z;g.stroke();g.fillStyle='#1c2630';g.beginPath();g.ellipse(q[0]+2*z,q[1],4*z,3*z,0,0,Math.PI*2);g.fill();}
      for(const dx of[-1.2,2.55]){const a=W(dx,0,.25),b=W(dx,0,.85);line([a,b],2*z,'#737c78');g.fillStyle='#222a2b';for(const offset of[-2.5,2.5]){g.beginPath();g.ellipse(a[0]+offset*z,a[1],2.6*z,4*z,0,0,Math.PI*2);g.fill();}}
      const reg=W(-1,.32,1.17);g.fillStyle='#263b45';g.font=`600 ${Math.max(5,6*z)}px system-ui`;g.fillText('AOTEAROA AIR · ZK-MSC',reg[0],reg[1]);
      break;
    }
    case "mural": break;
    case "door": {
      // every door you can walk into gets a glowing mat and a bobbing arrow
      if (p.building !== undefined && (p.building === -2 || p.building >= 0)) {
        const bob = Math.sin(time * 3) * 3 * z;
        g.fillStyle = "rgba(198,255,61,.18)"; g.beginPath(); g.ellipse(sx, sy, 16 * z, 7 * z, 0, 0, 6.283); g.fill();
        g.fillStyle = "#c6ff3d"; g.beginPath(); g.moveTo(sx - 5 * z, sy - 30 * z + bob); g.lineTo(sx + 5 * z, sy - 30 * z + bob); g.lineTo(sx, sy - 23 * z + bob); g.closePath(); g.fill();
      }
      if (p.building === -2) {
        g.font = `700 ${Math.round(11 * z)}px "Big Shoulders Display", Impact, sans-serif`;
        g.textAlign = "center";
        g.fillStyle = "#ff7ad9"; g.shadowColor = "#ff7ad9"; g.shadowBlur = dark ? 10 * z : 0;
        g.fillText("MOSAICSCOPE STUDIO", sx, sy - 70 * z);
        g.shadowBlur = 0; g.textAlign = "start";
      }
      break;
    }
  }
}

/** Small signs that people live here, baked into the ground: fallen leaves, worn paving, chalk, the odd manhole. */
function sidewalkLife(g: CanvasRenderingContext2D, w: World, sx: number, sy: number, n: number, tx: number, ty: number): void {
  const hw = TILE_W / 2, hh = TILE_H / 2, S = w.size, cx = sx, cy = sy + hh;
  const h = hash01(tx * 2711 + ty * 9293);
  // leaves drift around the trees
  let near = false;
  const dg = decorGrid(w);
  for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const X = tx + dx, Y = ty + dy; if (X >= 0 && Y >= 0 && X < S && Y < S && dg[Y * S + X] === D.TREE) { near = true; break; } }
  if (near) {
    const cols = ["#7a421a", "#a8651e", "#4a3a12", "#6a4a1c"];
    for (let i = 0; i < 4; i++) { const a = hash01(tx * 31 + ty * 17 + i * 7), b = hash01(tx * 13 + ty * 41 + i * 3); g.fillStyle = cols[i]; g.globalAlpha = 0.75; g.fillRect(cx + (a - 0.5) * hw * 1.1, cy + (b - 0.5) * hh * 0.9, 2, 1.4); }
    g.globalAlpha = 1;
  }
  // worn, darker patches where feet go, and a hairline crack
  if (h < 0.1) { g.fillStyle = "rgba(14,11,10,.16)"; g.beginPath(); g.ellipse(cx + (n - 0.5) * 8, cy, hw * 0.45, hh * 0.4, 0.4, 0, 6.283); g.fill(); }
  else if (h < 0.15) { g.strokeStyle = "rgba(14,11,10,.28)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - hw * 0.3, cy - hh * 0.15); g.lineTo(cx - hw * 0.05, cy + hh * 0.05); g.lineTo(cx + hw * 0.1, cy - hh * 0.05); g.lineTo(cx + hw * 0.35, cy + hh * 0.2); g.stroke(); }
  else if (h > 0.985) { // manhole cover
    g.fillStyle = "rgba(90,85,80,.55)"; g.beginPath(); g.ellipse(cx, cy, hw * 0.2, hh * 0.2, 0, 0, 6.283); g.fill();
    g.strokeStyle = "rgba(14,11,10,.45)"; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(cx - hw * 0.14, cy); g.lineTo(cx + hw * 0.14, cy); g.moveTo(cx, cy - hh * 0.14); g.lineTo(cx, cy + hh * 0.14); g.stroke();
  } else if (h > 0.96 && h < 0.97 && w.tile(tx, ty + 1) !== T.ROAD && w.tile(tx + 1, ty) !== T.ROAD) { // chalk on the inner footpath
    g.strokeStyle = ["rgba(238,228,211,.4)", "rgba(255,122,217,.4)", "rgba(61,214,255,.38)"][Math.floor(n * 3) % 3]; g.lineWidth = 1.2;
    if (n < 0.5) { // hopscotch: a ladder of squares
      for (let i = 0; i < 4; i++) { const u = cx - hw * 0.35 + i * hw * 0.2, v = cy - hh * 0.2 + i * hh * 0.1; g.strokeRect(u, v, 6, 4); }
    } else { // a little heart and a sun
      g.beginPath(); g.moveTo(cx, cy + 3); g.bezierCurveTo(cx - 8, cy - 3, cx - 3, cy - 8, cx, cy - 3); g.bezierCurveTo(cx + 3, cy - 8, cx + 8, cy - 3, cx, cy + 3); g.stroke();
      g.beginPath(); g.arc(cx + hw * 0.35, cy - hh * 0.1, 3, 0, 6.283); g.stroke();
    }
  }
}
