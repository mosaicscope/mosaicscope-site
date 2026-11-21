import type { World } from "../world/World";
import type { MappedCity } from "../world/MappedWorld";
import { T } from "../world/World";
import { worldIndex } from "../world/WorldIndex";
import { D, drawDecor, LEAF } from "./StreetDecor";

/**
 * Wild greenery and wildlife for open grass, so lawns stop reading as flat green carpet.
 *
 * Everything here goes through ONE panel engine, shared with the kerb trees and planters:
 *   - each piece is painted once into a small offscreen "panel" (sprite) per size / light / variant,
 *   - every frame it is a single drawImage, no path building, no arcs, no fills;
 *   - sway is three pre-painted poses, not a per-frame transform;
 *   - fauna are closed-form functions of time (no per-animal state to update or allocate).
 * Placement is a pure function of the world, cached per 16x16 chunk, purely visual (no collision, nothing saved).
 *
 * A frame-time governor (`flora`) holds ~45 fps: when frames run long it thins flora and fauna by a stable
 * per-piece seed (so nothing pops about), and under heavier load freezes sway, wing flaps and window animation.
 */

// ---------------------------------------------------------------- noise (pure, deterministic)

const h2 = (x: number, y: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise, 0..1. */
export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h2(ix, iy) * (1 - u) + h2(ix + 1, iy) * u) * (1 - v) + (h2(ix, iy + 1) * (1 - u) + h2(ix + 1, iy + 1) * u) * v;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 lawn .. 1 deep forest. Also darkens the ground in Terrain so groves read from above. */
export function forestDepth(tx: number, ty: number): number { return clamp01((woodland(tx, ty) - 0.5) / 0.3); }
/** 0..1: dry, sun-bleached patches of lawn. */
export function dryness(tx: number, ty: number): number { return clamp01((valueNoise(tx / 7 + 200, ty / 7 + 90) - 0.62) / 0.25); }
/** Raw woodland field: large groves with finer clumping, stretched so there are real clearings and real forest. */
function woodland(tx: number, ty: number): number {
  const raw = valueNoise(tx / 11, ty / 11) * 0.62 + valueNoise(tx / 4.3 + 50, ty / 4.3 - 30) * 0.38;
  return clamp01(0.5 + (raw - 0.5) * 1.55);
}

// ---------------------------------------------------------------- placement

const CH = 16;
const TREES = new Set<number>([D.OAK, D.PINE, D.BIRCH]);
/** Small ground cover: skipped when zoomed out or far away, and first to go when the governor trims. */
const TINY = new Set<number>([D.FERN, D.FLOWERS, D.TALLGRASS, D.MUSHROOM]);

/** What wild thing (if any) grows on this tile. Pure: same answer every load. */
function placeKind(w: World, tx: number, ty: number): number {
  const r = h2(tx * 7 + 13, ty * 11 + 5);
  if (r > 0.5) return 0; // most tiles stay open grass; also the cheap early-out
  if (w.tile(tx, ty) !== T.GRASS) return 0;
  const f = woodland(tx, ty), r2 = h2(tx * 13 + 7, ty * 5 + 29);
  let k = 0;
  if (f > 0.52) { // woodland: canopy over an understorey
    const d = clamp01((f - 0.52) / 0.35);
    if (r < 0.2 + d * 0.1) k = r2 < 0.38 ? D.OAK : r2 < 0.78 ? D.PINE : D.BIRCH;
    else if (r < 0.3 + d * 0.1) k = D.BUSH;
    else if (r < 0.42 + d * 0.06) k = D.FERN;
    else if (r < 0.46 + d * 0.04) k = r2 < 0.4 ? D.LOG : r2 < 0.75 ? D.MUSHROOM : D.ROCK;
  } else if (f > 0.34) { // meadow
    if (r < 0.14) k = D.FLOWERS;
    else if (r < 0.3) k = D.TALLGRASS;
    else if (r < 0.34) k = D.BUSH;
    else if (r < 0.36) k = D.ROCK;
    else if (r < 0.385) k = r2 < 0.5 ? D.OAK : D.BIRCH;
  } else { // mown lawn: tufts, wildflowers, the odd shade tree and shrub
    if (r < 0.07) k = D.TALLGRASS;
    else if (r < 0.13) k = D.FLOWERS;
    else if (r < 0.145) k = r2 < 0.6 ? D.OAK : D.BIRCH;
    else if (r < 0.18) k = D.BUSH;
  }
  if (!k) return 0;
  // keep footpaths, kerbs and facades clear: trees, bushes and logs need grass all round; small ground cover may
  // sit at an edge (lawns in a city are small) but never in a nook with open paving on two sides
  const g = (w.tile(tx + 1, ty) === T.GRASS ? 1 : 0) + (w.tile(tx - 1, ty) === T.GRASS ? 1 : 0) + (w.tile(tx, ty + 1) === T.GRASS ? 1 : 0) + (w.tile(tx, ty - 1) === T.GRASS ? 1 : 0);
  return g === 4 || (g === 3 && (k === D.FLOWERS || k === D.TALLGRASS || k === D.FERN || k === D.MUSHROOM || k === D.ROCK)) ? k : 0;
}

interface Home { x: number; y: number; fk: number; seed: number }
interface Chunk { rev: number; n: number; tx: number[]; ty: number[]; k: number[]; s: number[]; homes: Home[] }
interface Cache { chunks: Map<number, Chunk>; busy: Uint8Array | null }
const caches = new WeakMap<World, Cache>();

/** Tiles next to a point of interest stay clear (synthetic worlds: one byte per tile, built once). */
function busyGrid(w: World): Uint8Array {
  const S = w.size, g = new Uint8Array(S * S);
  for (const p of w.pois) {
    const r = p.kind === "door" ? 2 : 1, px = Math.floor(p.x), py = Math.floor(p.y);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = px + dx, Y = py + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) g[Y * S + X] = 1; }
  }
  return g;
}
function isBusy(w: World, cache: Cache, tx: number, ty: number): boolean {
  if (!w.mapped) {
    cache.busy ??= busyGrid(w);
    const S = w.size;
    return tx >= 0 && ty >= 0 && tx < S && ty < S && cache.busy[ty * S + tx] === 1;
  }
  for (const id of worldIndex(w).pois.query(tx - 1, ty - 1, tx + 2, ty + 2)) {
    const p = w.pois[id];
    if (p && Math.abs(p.x - tx - 0.5) < 1.6 && Math.abs(p.y - ty - 0.5) < 1.6) return true;
  }
  return false;
}

/**
 * Surveyed rivers and ponds are drawn from their polygons (MappedGround), and the collision grid does not always agree with
 * them, so flora checks the polygons too: nothing grows in or on the bank of mapped water.
 */
interface WaterPoly { x0: number; y0: number; x1: number; y1: number; rings: number[][] }
const waterCache = new WeakMap<MappedCity, { rev: number; polys: WaterPoly[] }>();
function waterPolys(map: MappedCity): WaterPoly[] {
  const rev = map.revision ?? 0, hit = waterCache.get(map);
  if (hit && hit.rev === rev) return hit.polys;
  const polys: WaterPoly[] = [], k = 1 / map.metresPerTile;
  for (const t of map.terrain) {
    if (t.kind !== "water" || t.points.length < 3) continue;
    const rings: number[][] = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ring of [t.points, ...(t.holes ?? [])]) {
      const flat: number[] = [];
      for (const p of ring) { const x = p[0] * k + map.offsetX, y = p[1] * k + map.offsetY; flat.push(x, y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      rings.push(flat);
    }
    polys.push({ x0, y0, x1, y1, rings });
  }
  waterCache.set(map, { rev, polys });
  return polys;
}
/** Even-odd point test across a polygon and its holes (the same rule MappedGround fills with). */
function insideWater(p: WaterPoly, x: number, y: number): boolean {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;
  let inside = false;
  for (const r of p.rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const ax = r[i], ay = r[i + 1], bx = r[j], by = r[j + 1];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
/** Tile centre and four points about 0.7 tile out, so a bank or a canopy overhang counts as water too. */
function nearWater(polys: WaterPoly[], tx: number, ty: number): boolean {
  const x = tx + 0.5, y = ty + 0.5;
  for (const p of polys) {
    if (x < p.x0 - 1 || x > p.x1 + 1 || y < p.y0 - 1 || y > p.y1 + 1) continue;
    if (insideWater(p, x, y) || insideWater(p, x + 0.7, y) || insideWater(p, x - 0.7, y) || insideWater(p, x, y + 0.7) || insideWater(p, x, y - 0.7)) return true;
  }
  return false;
}

function buildChunk(w: World, cache: Cache, cx: number, cy: number, rev: number): Chunk {
  const c: Chunk = { rev, n: 0, tx: [], ty: [], k: [], s: [], homes: [] };
  const x0 = cx * CH, y0 = cy * CH;
  let deer = 0;
  const lakes = w.mapped ? waterPolys(w.mapped).filter((p) => p.x1 >= x0 - 1 && p.x0 <= x0 + CH + 1 && p.y1 >= y0 - 1 && p.y0 <= y0 + CH + 1) : [];
  for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
    const k = placeKind(w, tx, ty); // TEMP-DEBUG block start
    const S = flora.dbg.st; if (w.tile(tx, ty) === 0) S.grass++; if (k) S.cand++;
    if (k && isBusy(w, cache, tx, ty)) { S.busy++; continue; }
    if (k && lakes.length && nearWater(lakes, tx, ty)) { S.water++; continue; }
    if (k) S.kept++; // TEMP-DEBUG block end
    if (!k) continue;
    const s = Math.floor(h2(tx * 3 + 1, ty * 17 + 9) * 1000);
    c.tx.push(tx); c.ty.push(ty); c.k.push(k); c.s.push(s); c.n++;
    if (c.homes.length >= 6) continue;
    // wildlife lives where its habitat is
    const h3 = h2(tx * 29 + 3, ty * 31 + 11), fd = forestDepth(tx, ty), x = tx + 0.5, y = ty + 0.5;
    if (k === D.FLOWERS && h3 < 0.3) c.homes.push({ x, y, fk: FK.BUTTERFLY, seed: s });
    else if (TREES.has(k) && h3 < 0.06) c.homes.push({ x, y, fk: FK.BIRD, seed: s });
    else if ((k === D.TALLGRASS || k === D.BUSH) && fd < 0.4 && h3 < 0.02) c.homes.push({ x, y, fk: FK.RABBIT, seed: s });
    else if ((k === D.OAK || k === D.PINE) && fd > 0.5 && h3 < 0.012 && deer < 1) { deer++; c.homes.push({ x, y, fk: FK.DEER, seed: s }); }
    else if ((k === D.FERN || k === D.BUSH) && fd > 0.3 && h3 < 0.12) c.homes.push({ x, y, fk: FK.FIREFLY, seed: s });
  }
  return c;
}

function cacheOf(w: World): Cache {
  let cache = caches.get(w);
  if (!cache) {
    const made: Cache = { chunks: new Map(), busy: null };
    cache = made;
    caches.set(w, made);
    // a streamed-in or edited chunk (and its neighbours, whose edge rules read across the seam) is re-planted next time it is seen
    w.chunkWatchers.push((cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) made.chunks.delete((cx + dx + 16384) * 32768 + (cy + dy + 16384)); });
  }
  return cache;
}

function chunkAt(w: World, cx: number, cy: number): Chunk {
  const cache = cacheOf(w);
  const key = (cx + 16384) * 32768 + (cy + 16384), rev = w.mapped?.revision ?? 0;
  let c = cache.chunks.get(key);
  if (c && c.rev === rev) { cache.chunks.delete(key); cache.chunks.set(key, c); return c; } // keep recently-used at the back
  c = buildChunk(w, cache, cx, cy, rev);
  cache.chunks.set(key, c);
  while (cache.chunks.size > 300) cache.chunks.delete(cache.chunks.keys().next().value!);
  return c;
}

// ---------------------------------------------------------------- the governor

/**
 * Holds the frame rate near 45 fps (22.2 ms). It watches how long the renderer itself took on recent frames, not the
 * raw frame interval, so a throttled or vsync-capped display is not mistaken for a slow scene. Past ~15 ms of render
 * time (leaving ~7 ms of the 22 ms budget for the sim, input and compositing) it thins flora and fauna; once there is
 * clear headroom it brings them back. `scale` (0.3 .. 1) is the share drawn; `animate` turns off sway, wing flaps and
 * window animation once the renderer stays over budget. Game.adaptQuality is the second line: it steps the whole
 * quality tier down if real frames still fall under 45 fps.
 */
export const flora = {
  scale: 1,
  animate: true,
  reduce: false,
  ema: 8,
  acc: 0,
  dbg: { w: null as World | null, count: 0, animals: 0, chunks: 0, items: [] as number[][], focus: [0, 0], fd: forestDepth, t: { gather: 0, draw: 0, calls: 0 }, st: { grass: 0, early: 0, cand: 0, busy: 0, water: 0, kept: 0 } }, // TEMP-DEBUG
  update(renderMs: number, dt: number, reduceMotion: boolean): void {
    this.reduce = reduceMotion;
    if (dt <= 0 || dt > 0.25 || !(renderMs >= 0)) return; // hidden tab / loading hitch: not a real frame
    this.ema += (Math.min(renderMs, 80) - this.ema) * 0.05;
    this.acc += dt;
    if (this.acc < 0.35) return;
    this.acc = 0;
    if (this.ema > 15.5) this.scale = Math.max(0.3, this.scale - 0.1);
    else if (this.ema < 12) this.scale = Math.min(1, this.scale + 0.025);
    this.animate = this.scale > 0.5 && !reduceMotion;
  },
};

// ---------------------------------------------------------------- fauna (closed-form poses, no state)

const enum FK { BUTTERFLY = 0, BIRD = 1, RABBIT = 2, DEER = 3, FIREFLY = 4 }
const FAUNA_BASE = 64;
interface Pose { x: number; y: number; lift: number; frame: number; dir: number }
const POSE: Pose = { x: 0, y: 0, lift: 0, frame: 0, dir: 0 };
const TAU = Math.PI * 2;

/** Where this animal is at time t. Returns false while it is hidden (asleep, or not its hour). Lift is px above the ground at zoom 1. */
function pose(h: Home, t: number, dark: number): boolean {
  const p = h.seed * 0.37, o = POSE;
  switch (h.fk) {
    case FK.BUTTERFLY: {
      if (dark > 0.55) return false;
      o.x = h.x + Math.sin(t * 0.5 + p) * 1.7 + Math.sin(t * 1.7 + p * 2) * 0.35;
      o.y = h.y + Math.cos(t * 0.43 + p * 1.3) * 1.7;
      o.lift = 9 + Math.sin(t * 2.3 + p) * 3;
      o.frame = Math.floor(t * 9 + p) & 1;
      o.dir = Math.cos(t * 0.5 + p) * 0.85 + Math.sin(t * 0.43 + p * 1.3) * 0.73 > 0 ? 1 : 0;
      return true;
    }
    case FK.BIRD: {
      if (dark > 0.75) return false;
      const c = (t / 14 + h.seed * 0.013) % 1;
      if (c < 0.72) { // perched in the canopy, turning its head now and then
        o.x = h.x; o.y = h.y; o.lift = 46 + (((t * 2 + h.seed) % 7) < 0.3 ? 2 : 0); o.frame = 0; o.dir = Math.floor(t / 3 + h.seed) & 1;
        return true;
      }
      const s = (c - 0.72) / 0.28, a = h.seed * 0.0173, d = Math.sin(s * Math.PI) * 8;
      o.x = h.x + Math.cos(a) * d; o.y = h.y + Math.sin(a) * d;
      o.lift = 46 + Math.sin(s * Math.PI) * 22; o.frame = Math.floor(t * 10) & 1;
      o.dir = (Math.cos(a) - Math.sin(a)) * (s < 0.5 ? 1 : -1) > 0 ? 1 : 0;
      return true;
    }
    case FK.RABBIT: {
      if (dark > 0.8) return false;
      const c = (t / 10 + h.seed * 0.0071) % 1;
      if (c < 0.62) { o.x = h.x; o.y = h.y; o.lift = 0; o.frame = 0; o.dir = h.seed & 1; return true; }
      const s = (c - 0.62) / 0.38, a = h.seed * 0.0137, d = 1.6 * Math.sin(s * Math.PI * 0.999);
      o.x = h.x + Math.cos(a) * d; o.y = h.y + Math.sin(a) * d;
      o.lift = Math.abs(Math.sin(s * Math.PI * 3)) * 8; o.frame = o.lift > 2 ? 1 : 0;
      o.dir = (Math.cos(a) - Math.sin(a)) * (s < 0.5 ? 1 : -1) > 0 ? 1 : 0;
      return true;
    }
    case FK.DEER: {
      o.x = h.x + Math.sin(t * 0.07 + p) * 2.2; o.y = h.y + Math.cos(t * 0.05 + p * 1.7) * 1.6;
      o.lift = 0; o.frame = Math.floor(t / 7 + h.seed) & 1;
      o.dir = Math.cos(t * 0.07 + p) * 0.154 + Math.sin(t * 0.05 + p * 1.7) * 0.08 > 0 ? 1 : 0;
      return true;
    }
    default: { // fireflies
      if (dark < 0.45 || Math.sin(t * 2.2 + p) < -0.25) return false;
      o.x = h.x + Math.sin(t * 0.4 + p) * 1.2; o.y = h.y + Math.cos(t * 0.33 + p * 1.1) * 1.2;
      o.lift = 10 + Math.sin(t * 0.9 + p) * 6; o.frame = 0; o.dir = 0;
      return true;
    }
  }
}

// ---------------------------------------------------------------- gathering what to draw

const QUALITY_KEEP = [0.3, 0.55, 0.8, 1];
const FLORA_CAP = [300, 500, 800, 1200];
const FAUNA_CAP = [3, 8, 14, 22];

/**
 * Calls `emit` for each piece of wild greenery and each visible animal in the given tile window.
 * `emit(depth, ref, wx, wy, lift)`: depth is the painter key (x + y), ref is `panelKind * 1000 + seed`,
 * (wx, wy) the ground position in tiles, lift px above ground at zoom 1. Draw it with drawPanel(ref / 1000 ...).
 * `maxDist` (tiles from the focus) bounds the work for the 3D view; pass Infinity for the overhead view.
 */
function gatherFloraInner(
  w: World, minX: number, maxX: number, minY: number, maxY: number, zoom: number, quality: number, time: number, dark: number,
  focusX: number, focusY: number, maxDist: number,
  emit: (depth: number, ref: number, wx: number, wy: number, lift: number) => void,
): void {
  const q = quality < 0 ? 0 : quality > 3 ? 3 : quality | 0;
  const keep = flora.scale * QUALITY_KEEP[q] * 1000, keepTree = Math.min(1000, keep * 1.6);
  const small = zoom < 0.62, limited = maxDist < Infinity, md2 = maxDist * maxDist, far2 = md2 * 0.3;
  const cap = Math.floor(FLORA_CAP[q] * flora.scale);
  flora.dbg.items.length = 0; flora.dbg.focus = [focusX, focusY]; flora.dbg.w = w; flora.dbg.count = 0; flora.dbg.animals = 0; flora.dbg.chunks = 0; // TEMP-DEBUG
  const cx0 = Math.floor(minX / CH), cx1 = Math.floor(maxX / CH), cy0 = Math.floor(minY / CH), cy1 = Math.floor(maxY / CH);
  let count = 0;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = chunkAt(w, cx, cy); flora.dbg.chunks++; // TEMP-DEBUG
    for (let i = 0; i < c.n; i++) {
      const k = c.k[i], s = c.s[i];
      if (s >= (TREES.has(k) ? keepTree : keep)) continue;
      const tiny = TINY.has(k);
      if (small && tiny) continue;
      const wx = c.tx[i] + 0.5, wy = c.ty[i] + 0.5;
      if (wx < minX || wx > maxX + 1 || wy < minY || wy > maxY + 1) continue;
      if (limited) { const dx = wx - focusX, dy = wy - focusY, d2 = dx * dx + dy * dy; if (d2 > md2 || (tiny && d2 > far2)) continue; }
      emit(wx + wy, k * 1000 + s, wx, wy, 0); flora.dbg.count++; if (flora.dbg.items.length < 400) flora.dbg.items.push([wx, wy, k]); // TEMP-DEBUG
      if (++count >= cap) break;
    }
    if (count >= cap) break;
  }
  if (!flora.animate || flora.reduce) return; // animals stay home when the machine is struggling or motion is reduced
  const faunaMax = Math.max(2, Math.floor(FAUNA_CAP[q] * flora.scale)), reach = Math.min(maxDist, 26), r2 = reach * reach;
  const faunaKeep = flora.scale * 1000;
  let animals = 0;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = chunkAt(w, cx, cy);
    for (const h of c.homes) {
      if (h.seed >= faunaKeep) continue;
      const dx = h.x - focusX, dy = h.y - focusY;
      if (dx * dx + dy * dy > r2) continue;
      if (!pose(h, time, dark)) continue;
      const o = POSE;
      if (o.x < minX || o.x > maxX + 1 || o.y < minY || o.y > maxY + 1) continue;
      const kind = FAUNA_BASE + h.fk * 16 + (h.seed & 3) * 4 + o.frame * 2 + o.dir;
      emit(o.x + o.y + 0.02, kind * 1000 + h.seed, o.x, o.y, o.lift); flora.dbg.animals++; // TEMP-DEBUG
      if (++animals >= faunaMax) return;
    }
  }
}

// ---------------------------------------------------------------- the panel engine

interface Panel { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
const panels = new Map<number, Panel>();
let res = 1;
/** Device pixels per CSS pixel: panels are painted at this density so they stay sharp. Changing it rebuilds them lazily. */
export function setPanelResolution(dpr: number): void {
  const r = Math.round(dpr * 4) / 4 || 1;
  if (r !== res) { res = r; panels.clear(); }
}

/** Sprite extent around the base point at zoom 1: [left, up, right, down] in px. */
const BOX: Record<number, [number, number, number, number]> = {
  1: [28, 58, 30, 10], 2: [14, 20, 14, 8], 3: [16, 20, 18, 8], 4: [16, 16, 20, 6], 5: [20, 24, 20, 10],
  6: [32, 68, 34, 12], 7: [22, 74, 24, 10], 8: [24, 60, 26, 10], 9: [16, 24, 16, 8], 10: [22, 24, 22, 6],
  11: [14, 18, 14, 5], 12: [14, 22, 14, 4], 13: [16, 18, 20, 6], 14: [18, 12, 18, 6], 15: [12, 14, 12, 4],
};
const FAUNA_BOX: [number, number, number, number][] = [[8, 8, 8, 4], [16, 18, 16, 5], [16, 20, 16, 5], [28, 46, 28, 8], [10, 10, 10, 10]];
/** Kinds that get three pre-painted sway poses. */
const SWAY = new Set<number>([D.TREE, D.OAK, D.PINE, D.BIRCH, D.FERN, D.TALLGRASS]);

/**
 * Draw one panel (kerb tree, planter, wild flora, or animal) centred on its base point (sx, sy).
 * Same signature as the old drawDecor, so the renderers swap it in directly.
 */
function drawPanelInner(g: CanvasRenderingContext2D, kind: number, sx: number, sy: number, z: number, time: number, dark: number, n: number): void {
  if (z <= 0.02 || kind <= 0) return;
  const zi = Math.max(0, Math.min(63, Math.round(Math.log2(z) * 3) + 24)); // a third of an octave per size step
  let frame = 1;
  if (kind < FAUNA_BASE && flora.animate && z >= 0.35 && SWAY.has(kind)) {
    const sv = Math.sin(time * 0.7 + n * 20);
    frame = sv < -0.33 ? 0 : sv > 0.33 ? 2 : 1;
  }
  const db = kind === D.TREE || kind === D.CAFE || kind === D.OAK ? (dark < 0.3 ? 0 : dark < 0.6 ? 1 : 2) : 0;
  const nb = Math.min(5, Math.floor(n * 6));
  const key = (((kind * 64 + zi) * 4 + db) * 8 + nb) * 4 + frame;
  let p = panels.get(key);
  if (!p) {
    p = buildPanel(kind, zi, db, nb, frame);
    if (panels.size > 900) panels.clear();
    panels.set(key, p);
  }
  g.drawImage(p.cv, sx - p.ox * z, sy - p.oy * z, p.w * z, p.h * z);
}

function buildPanel(kind: number, zi: number, db: number, nb: number, frame: number): Panel {
  const zb = Math.pow(2, (zi - 24) / 3);
  const box = kind >= FAUNA_BASE ? FAUNA_BOX[(kind - FAUNA_BASE) >> 4] : BOX[kind] ?? BOX[1];
  const [l, u, r, d] = box;
  let s = zb * res;
  const big = Math.max(l + r, u + d);
  if (big * s > 360) s = 360 / big; // enormous close-ups reuse a slightly soft panel rather than a huge one
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.ceil((l + r) * s)); cv.height = Math.max(2, Math.ceil((u + d) * s));
  const g = cv.getContext("2d")!;
  const n = (nb + 0.5) / 6, dark = db === 0 ? 0 : db === 1 ? 0.45 : 1;
  if (kind >= FAUNA_BASE) paintFauna(g, kind - FAUNA_BASE, l * s, u * s, s);
  else if (kind <= D.CAFE) drawDecor(g, kind, l * s, u * s, s, frame === 1 ? 0 : (Math.asin(frame - 1) - n * 20) / 0.7, dark, n); // old art, sway pose picked through its own time term
  else paintFlora(g, kind, l * s, u * s, s, frame - 1, dark, n);
  return { cv, ox: l, oy: u, w: cv.width / s, h: cv.height / s };
}

// ---------------------------------------------------------------- panel art: flora

const INK = "#0e0b0a";
const GREENS = ["#143319", "#1a4020", "#22522a", "#2a5f2a"];
const BIRCH_LEAF: [string, string, string][] = [["#3f5f20", "#557a2a", "#7a9a36"], ["#5a6a1c", "#7f8f28", "#a9a83a"], ["#8a5a14", "#b9801f", "#d9a63a"]];
const BLOOM = ["#f6b62c", "#ff7ad9", "#eee4d3", "#b58cff", "#ff8a3d"];
const pickLeaf = (n: number): [string, string, string] => LEAF[n < 0.14 ? 3 : n < 0.5 ? 0 : n < 0.8 ? 1 : 2];

function shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, z: number): void {
  g.fillStyle = "rgba(0,0,0,.26)"; g.beginPath(); g.ellipse(x + 3 * z, y + 1.5 * z, rx * z, ry * z, 0, 0, TAU); g.fill();
}
const blob = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

/** `sw` is the sway pose: -1, 0 or +1. */
function paintFlora(g: CanvasRenderingContext2D, kind: number, sx: number, sy: number, z: number, sw: number, dark: number, n: number): void {
  switch (kind) {
    case D.OAK: {
      const pal = pickLeaf(n), r = (16 + n * 4) * z, cy = sy - 40 * z, o = sw * 1.6 * z;
      shadow(g, sx, sy, 22, 8, z);
      g.strokeStyle = "#4a3020"; g.lineWidth = 4.4 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + o * 0.1, sy - 28 * z); g.stroke(); g.lineCap = "butt";
      g.fillStyle = pal[0]; g.beginPath(); g.arc(sx + o * 0.5 - 10 * z, cy + 5 * z, r * 0.85, 0, TAU); g.arc(sx + o * 0.5 + 11 * z, cy + 4 * z, r * 0.8, 0, TAU); g.fill();
      g.fillStyle = pal[1]; blob(g, sx + o * 0.8, cy - 3 * z, r);
      g.fillStyle = pal[2]; blob(g, sx + o - 4 * z, cy - 9 * z, r * 0.55);
      if (dark < 0.5) { g.fillStyle = "rgba(255,210,122,.1)"; blob(g, sx + o - 6 * z, cy - 10 * z, r * 0.35); }
      break;
    }
    case D.PINE: {
      shadow(g, sx, sy, 15, 6, z);
      g.strokeStyle = "#3a2a1c"; g.lineWidth = 3 * z; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 14 * z); g.stroke();
      for (let i = 0; i < 4; i++) {
        const by = sy - 9 * z - i * 13 * z, hw = (18 - i * 3.6) * z, top = by - 19 * z, ax = sx + sw * (0.6 + i * 0.5) * z;
        g.fillStyle = GREENS[i]; g.beginPath(); g.moveTo(ax, top); g.lineTo(sx + hw, by); g.lineTo(sx - hw, by); g.closePath(); g.fill();
        g.fillStyle = "rgba(120,170,80,.14)"; g.beginPath(); g.moveTo(ax, top); g.lineTo(sx + hw, by); g.lineTo(sx, by); g.closePath(); g.fill();
      }
      break;
    }
    case D.BIRCH: {
      const pal = BIRCH_LEAF[n < 0.2 ? 2 : n < 0.6 ? 0 : 1], o = sw * 1.4 * z, cy = sy - 40 * z, r = 10 * z;
      shadow(g, sx, sy, 14, 5.5, z);
      g.strokeStyle = "#d9d2c3"; g.lineWidth = 3.4 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + o * 0.1, sy - 32 * z); g.stroke(); g.lineCap = "butt";
      g.strokeStyle = INK; g.lineWidth = 1 * z; g.beginPath();
      for (let i = 0; i < 4; i++) { const y = sy - (6 + i * 7) * z; g.moveTo(sx - 1.5 * z, y); g.lineTo(sx + 0.5 * z, y); }
      g.stroke();
      g.fillStyle = pal[0]; g.beginPath(); g.arc(sx + o * 0.4 - 6 * z, cy + 3 * z, r * 0.8, 0, TAU); g.arc(sx + o * 0.4 + 7 * z, cy + 2 * z, r * 0.75, 0, TAU); g.fill();
      g.fillStyle = pal[1]; blob(g, sx + o * 0.7, cy - 4 * z, r);
      g.fillStyle = pal[2]; blob(g, sx + o - 2 * z, cy - 10 * z, r * 0.6);
      break;
    }
    case D.BUSH: {
      const pal = pickLeaf(n);
      shadow(g, sx, sy, 11, 4.5, z);
      g.fillStyle = pal[0]; g.beginPath(); g.arc(sx - 6 * z, sy - 5 * z, 6.5 * z, 0, TAU); g.arc(sx + 6 * z, sy - 5 * z, 6 * z, 0, TAU); g.fill();
      g.fillStyle = pal[1]; blob(g, sx, sy - 8 * z, 8 * z);
      g.fillStyle = pal[2]; blob(g, sx - 2 * z, sy - 12 * z, 4.5 * z);
      if (n > 0.7) { g.fillStyle = "#b8321f"; g.beginPath(); g.arc(sx - 4 * z, sy - 9 * z, 1.3 * z, 0, TAU); g.arc(sx + 3 * z, sy - 7 * z, 1.3 * z, 0, TAU); g.arc(sx + 5 * z, sy - 11 * z, 1.2 * z, 0, TAU); g.fill(); }
      else if (n < 0.2) { g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(sx - 3 * z, sy - 12 * z, 1.4 * z, 0, TAU); g.arc(sx + 4 * z, sy - 9 * z, 1.4 * z, 0, TAU); g.fill(); }
      break;
    }
    case D.FERN: {
      g.lineCap = "round";
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.42, tipX = sx + Math.sin(a) * 17 * z + sw * i * 0.5 * z, tipY = sy - 8 * z - Math.cos(a) * 13 * z;
        g.strokeStyle = i & 1 ? "#2c6a2c" : "#3b7d33"; g.lineWidth = 2 * z;
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + Math.sin(a) * 8 * z, sy - 12 * z, tipX, tipY); g.stroke();
      }
      g.lineCap = "butt";
      break;
    }
    case D.FLOWERS: {
      g.strokeStyle = "#2c6a2c"; g.lineWidth = 1.2 * z; g.beginPath();
      for (let i = -2; i <= 2; i++) { g.moveTo(sx + i * 2.6 * z, sy); g.lineTo(sx + i * 3.2 * z, sy - (6 + (i & 1) * 3) * z); }
      g.stroke();
      const c0 = Math.floor(n * 5);
      for (let i = 0; i < 7; i++) {
        const bx = sx + (((i * 53) % 11) - 5) * 1.5 * z, by = sy - (4 + (i * 37) % 10) * z;
        g.fillStyle = BLOOM[(c0 + (i > 3 ? 1 : 0)) % 5]; blob(g, bx, by, 1.8 * z);
        g.fillStyle = "#f6e9a8"; blob(g, bx, by, 0.7 * z);
      }
      break;
    }
    case D.TALLGRASS: {
      g.lineCap = "round"; g.lineWidth = 1.5 * z;
      for (let i = 0; i < 9; i++) {
        const bx = sx + (i - 4) * 2.2 * z, h = (9 + ((i * 37) % 7)) * z;
        g.strokeStyle = i & 1 ? "#4f7a2a" : "#6a9a36";
        g.beginPath(); g.moveTo(bx, sy); g.quadraticCurveTo(bx + (i - 4) * 0.5 * z, sy - h * 0.6, bx + sw * 2.5 * z + (i - 4) * 0.9 * z, sy - h); g.stroke();
      }
      g.lineCap = "butt";
      break;
    }
    case D.ROCK: {
      shadow(g, sx, sy, 13, 5, z);
      g.fillStyle = "#5a5650"; g.beginPath(); g.moveTo(sx - 9 * z, sy); g.lineTo(sx - 7 * z, sy - 8 * z); g.lineTo(sx - 1 * z, sy - 11 * z); g.lineTo(sx + 6 * z, sy - 8 * z); g.lineTo(sx + 9 * z, sy); g.closePath(); g.fill();
      g.fillStyle = "#46423d"; g.beginPath(); g.moveTo(sx - 1 * z, sy - 11 * z); g.lineTo(sx + 6 * z, sy - 8 * z); g.lineTo(sx + 9 * z, sy); g.lineTo(sx, sy); g.closePath(); g.fill();
      g.fillStyle = "#7a746b"; g.beginPath(); g.moveTo(sx - 7 * z, sy - 8 * z); g.lineTo(sx - 1 * z, sy - 11 * z); g.lineTo(sx - 2 * z, sy - 8 * z); g.closePath(); g.fill();
      g.fillStyle = "#4a4640"; g.beginPath(); g.moveTo(sx + 9 * z, sy); g.lineTo(sx + 11 * z, sy - 4 * z); g.lineTo(sx + 14 * z, sy); g.closePath(); g.fill();
      g.fillStyle = "rgba(63,95,42,.8)"; g.beginPath(); g.ellipse(sx - 3 * z, sy - 9 * z, 4 * z, 1.6 * z, 0, 0, TAU); g.fill();
      break;
    }
    case D.LOG: {
      shadow(g, sx, sy, 15, 5, z);
      g.fillStyle = "#4a3020"; g.beginPath(); g.roundRect(sx - 12 * z, sy - 6 * z, 23 * z, 7 * z, 3 * z); g.fill();
      g.fillStyle = "#5e4230"; g.fillRect(sx - 9 * z, sy - 6 * z, 18 * z, 2 * z);
      g.fillStyle = "#7a5a3a"; g.beginPath(); g.ellipse(sx - 12 * z, sy - 2.5 * z, 2.4 * z, 3.5 * z, 0, 0, TAU); g.fill();
      g.strokeStyle = "#4a3020"; g.lineWidth = 0.8 * z; g.beginPath(); g.ellipse(sx - 12 * z, sy - 2.5 * z, 1.2 * z, 1.9 * z, 0, 0, TAU); g.stroke();
      g.fillStyle = "rgba(63,95,42,.85)"; g.beginPath(); g.ellipse(sx + 3 * z, sy - 6 * z, 5 * z, 1.5 * z, 0, 0, TAU); g.fill();
      break;
    }
    case D.MUSHROOM: {
      for (const [dx, h, r] of [[-4, 5, 3.4], [2, 7, 4.2], [7, 4, 2.6]] as const) {
        g.fillStyle = "#d9cdb8"; g.fillRect(sx + (dx - 0.9) * z, sy - h * z, 1.8 * z, h * z);
        g.fillStyle = "#b8321f"; g.beginPath(); g.ellipse(sx + dx * z, sy - h * z, r * z, r * 0.7 * z, 0, Math.PI, 0); g.fill();
        g.fillStyle = "#f2ece0"; blob(g, sx + (dx - r * 0.3) * z, sy - (h + r * 0.35) * z, 0.7 * z);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- panel art: fauna

const BUTTERFLY = ["#ff8a3d", "#5fb4ff", "#f6e04a", "#f2efe6"];

function paintFauna(g: CanvasRenderingContext2D, f: number, x: number, y: number, z: number): void {
  const fk = f >> 4, colour = (f >> 2) & 3, frame = (f >> 1) & 1, sg = f & 1 ? 1 : -1;
  switch (fk) {
    case FK.BUTTERFLY: {
      g.fillStyle = BUTTERFLY[colour];
      if (frame === 0) { g.beginPath(); g.ellipse(x - 3 * z, y - 2.2 * z, 3 * z, 2.4 * z, -0.4, 0, TAU); g.ellipse(x + 3 * z, y - 2.2 * z, 3 * z, 2.4 * z, 0.4, 0, TAU); g.fill(); }
      else { g.beginPath(); g.ellipse(x, y - 2.4 * z, 1.5 * z, 3 * z, 0, 0, TAU); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 1.2 * z; g.beginPath(); g.moveTo(x, y - 0.6 * z); g.lineTo(x, y - 4 * z); g.stroke();
      break;
    }
    case FK.BIRD: {
      const body = colour === 1 ? "#17130f" : colour === 2 ? "#5a4a3a" : "#7a5a3a";
      g.fillStyle = body; g.beginPath(); g.ellipse(x, y - 5 * z, 4.6 * z, 3.2 * z, 0, 0, TAU); g.fill();
      blob(g, x + sg * 4 * z, y - 8 * z, 2.4 * z);
      g.fillStyle = colour === 1 ? "#f2a81b" : "#c9b27a"; g.beginPath(); g.moveTo(x + sg * 6 * z, y - 8.4 * z); g.lineTo(x + sg * 9 * z, y - 7.6 * z); g.lineTo(x + sg * 6 * z, y - 7 * z); g.closePath(); g.fill();
      g.strokeStyle = body; g.lineWidth = 1.4 * z;
      if (colour === 2) { g.fillStyle = "#d9d0bf"; g.beginPath(); g.moveTo(x - sg * 4 * z, y - 5 * z); g.lineTo(x - sg * 10 * z, y - 9 * z); g.lineTo(x - sg * 11 * z, y - 4 * z); g.closePath(); g.fill(); }
      else { g.beginPath(); g.moveTo(x - sg * 4 * z, y - 4.5 * z); g.lineTo(x - sg * 10 * z, y - 2.5 * z); g.stroke(); }
      if (frame === 1) { g.strokeStyle = body; g.lineWidth = 2 * z; g.beginPath(); g.moveTo(x, y - 6 * z); g.quadraticCurveTo(x - sg * 3 * z, y - 14 * z, x - sg * 7 * z, y - 15 * z); g.stroke(); }
      else { g.strokeStyle = "#3a2a1c"; g.lineWidth = 0.9 * z; g.beginPath(); g.moveTo(x - 1 * z, y - 2 * z); g.lineTo(x - 1 * z, y); g.moveTo(x + 1.5 * z, y - 2 * z); g.lineTo(x + 1.5 * z, y); g.stroke(); }
      break;
    }
    case FK.RABBIT: {
      const fur = "#8a7258";
      g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x, y, 7 * z, 2.2 * z, 0, 0, TAU); g.fill();
      g.fillStyle = fur;
      if (frame === 0) {
        g.beginPath(); g.ellipse(x, y - 5 * z, 5 * z, 4 * z, 0, 0, TAU); g.fill(); blob(g, x + sg * 4.5 * z, y - 8 * z, 2.8 * z);
        g.beginPath(); g.ellipse(x + sg * 3.6 * z, y - 13 * z, 1.1 * z, 3.4 * z, sg * 0.2, 0, TAU); g.ellipse(x + sg * 5.8 * z, y - 12.6 * z, 1.1 * z, 3.2 * z, sg * 0.35, 0, TAU); g.fill();
      } else {
        g.beginPath(); g.ellipse(x, y - 6 * z, 7 * z, 3.2 * z, -0.25 * sg, 0, TAU); g.fill(); blob(g, x + sg * 7 * z, y - 7.5 * z, 2.6 * z);
        g.beginPath(); g.ellipse(x + sg * 4.5 * z, y - 10 * z, 3.2 * z, 1 * z, sg * 0.5, 0, TAU); g.fill();
      }
      g.fillStyle = "#f2ece0"; blob(g, x - sg * 5 * z, y - 5 * z, 1.6 * z);
      break;
    }
    case FK.DEER: {
      const hide = "#7a5a3a";
      g.fillStyle = "rgba(0,0,0,.24)"; g.beginPath(); g.ellipse(x, y, 14 * z, 3.4 * z, 0, 0, TAU); g.fill();
      g.strokeStyle = "#4a3320"; g.lineWidth = 1.8 * z; g.beginPath();
      for (const lx of [-7, -3, 3, 7]) { g.moveTo(x + lx * z, y - 13 * z); g.lineTo(x + lx * z, y); }
      g.stroke();
      g.fillStyle = hide; g.beginPath(); g.ellipse(x, y - 18 * z, 11 * z, 5.5 * z, 0, 0, TAU); g.fill();
      g.fillStyle = "#a07a50"; g.beginPath(); g.ellipse(x, y - 15.5 * z, 8.5 * z, 2.4 * z, 0, 0, TAU); g.fill();
      g.fillStyle = "#f2ece0"; blob(g, x - sg * 11 * z, y - 19 * z, 1.8 * z);
      const hx = x + sg * 15 * z, hy = y - (frame === 1 ? 12 : 31) * z;
      g.strokeStyle = hide; g.lineWidth = 4 * z; g.lineCap = "round"; g.beginPath(); g.moveTo(x + sg * 8 * z, y - 21 * z); g.lineTo(hx, hy); g.stroke(); g.lineCap = "butt";
      g.fillStyle = hide; g.beginPath(); g.ellipse(hx + sg * 1.5 * z, hy, 3.6 * z, 2.3 * z, sg * 0.4, 0, TAU); g.fill();
      if (colour & 1 && frame === 0) { g.strokeStyle = "#cfc3a8"; g.lineWidth = 1.1 * z; g.beginPath(); g.moveTo(hx, hy - 2 * z); g.lineTo(hx - sg * 2 * z, hy - 9 * z); g.moveTo(hx - sg * 1 * z, hy - 6 * z); g.lineTo(hx + sg * 2 * z, hy - 9 * z); g.moveTo(hx + sg * 1.5 * z, hy - 2 * z); g.lineTo(hx + sg * 3 * z, hy - 8 * z); g.stroke(); }
      break;
    }
    default: { // firefly glow
      const gr = g.createRadialGradient(x, y, 0, x, y, 8 * z);
      gr.addColorStop(0, "rgba(235,255,140,.95)"); gr.addColorStop(0.3, "rgba(200,255,90,.4)"); gr.addColorStop(1, "rgba(200,255,90,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 8 * z, 0, TAU); g.fill();
    }
  }
}

if (typeof window !== "undefined") (window as unknown as { __flora?: unknown }).__flora = flora; // TEMP-DEBUG

// TEMP-DEBUG timing wrappers
export function gatherFlora(...a: Parameters<typeof gatherFloraInner>): void { const t = performance.now(); gatherFloraInner(...a); flora.dbg.t.gather += performance.now() - t; }
export function drawPanel(...a: Parameters<typeof drawPanelInner>): void { const t = performance.now(); drawPanelInner(...a); flora.dbg.t.draw += performance.now() - t; flora.dbg.t.calls++; }
