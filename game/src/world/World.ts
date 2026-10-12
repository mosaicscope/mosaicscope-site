import { Rng } from "../core/rng";

export const enum T {
  GRASS = 0, PAVE = 1, PATH = 2, FLOOR = 3, COURT = 4, WATER = 5, WALL = 6, TREE = 7,
  STALL = 8, FOUNTAIN = 9, STAGE = 10, FENCE = 11, HEDGE = 12, STREET = 13, SAND = 14, CRATE = 15,
}

export const TILE_NAMES = ["grass", "pave", "path", "floor", "court", "water", "wall", "tree", "stall", "fountain", "stage", "fence", "hedge", "street", "sand", "crate"];

/** Tiles nobody can stand on. */
export const SOLID = new Set<number>([T.WATER, T.WALL, T.TREE, T.STALL, T.FOUNTAIN, T.FENCE, T.HEDGE, T.CRATE]);
/** Tiles that block line of sight (fences and water do not). */
export const OPAQUE = new Set<number>([T.WALL, T.TREE, T.STALL]);
/** Decoration that the generator may remove to keep the world connected. */
export const DECOR = new Set<number>([T.TREE, T.HEDGE, T.STALL, T.CRATE]);
/** Visual heights for rendering blocks. */
export const TILE_HEIGHT: Record<number, number> = { [T.WALL]: 1.25, [T.FENCE]: 0.7, [T.STALL]: 1.3, [T.FOUNTAIN]: 0.45, [T.STAGE]: 0.3, [T.HEDGE]: 0.8, [T.CRATE]: 0.8 };

export type AreaKind = "street" | "plaza" | "park" | "court" | "studio" | "stage" | "market" | "playground" | "alley";
export interface Area { id: number; name: string; kind: AreaKind; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }
export type PoiKind = "bench" | "boombox" | "toychest" | "lamp" | "hoop" | "door" | "springpad" | "fountain";
export interface Poi { id: number; kind: PoiKind; x: number; y: number; area: number; on?: boolean }

export class World {
  readonly size: number;
  readonly tiles: Uint8Array;
  readonly areaOf: Uint8Array;
  readonly shelter: Uint8Array;
  areas: Area[] = [];
  pois: Poi[] = [];
  /** Tiles changed since last render (drives chunk re-render). */
  dirtyTiles = new Set<number>();

  constructor(size: number) {
    this.size = size;
    this.tiles = new Uint8Array(size * size);
    this.areaOf = new Uint8Array(size * size);
    this.shelter = new Uint8Array(size * size);
  }

  idx(tx: number, ty: number): number { return ty * this.size + tx; }
  inBounds(tx: number, ty: number): boolean { return tx >= 0 && ty >= 0 && tx < this.size && ty < this.size; }
  tile(tx: number, ty: number): number { return this.inBounds(tx, ty) ? this.tiles[ty * this.size + tx] : T.WALL; }
  set(tx: number, ty: number, t: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.size + tx;
    if (this.tiles[i] !== t) { this.tiles[i] = t; this.dirtyTiles.add(i); }
  }
  walkableTile(tx: number, ty: number): boolean { return this.inBounds(tx, ty) && !SOLID.has(this.tiles[ty * this.size + tx]); }
  walkable(x: number, y: number): boolean { return this.walkableTile(Math.floor(x), Math.floor(y)); }
  isSheltered(x: number, y: number): boolean { const tx = Math.floor(x), ty = Math.floor(y); return this.inBounds(tx, ty) && this.shelter[ty * this.size + tx] === 1; }
  areaAt(x: number, y: number): Area | undefined { const tx = Math.floor(x), ty = Math.floor(y); return this.inBounds(tx, ty) ? this.areas[this.areaOf[ty * this.size + tx]] : undefined; }
  groundZ(x: number, y: number): number { return this.tile(Math.floor(x), Math.floor(y)) === T.STAGE ? 0.3 : 0; }

  /** Grid DDA line-of-sight test; true when nothing opaque sits between the points. */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    let tx = Math.floor(x0), ty = Math.floor(y0);
    const ex = Math.floor(x1), ey = Math.floor(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tmx = dx !== 0 ? (sx > 0 ? tx + 1 - x0 : x0 - tx) * tdx : Infinity;
    let tmy = dy !== 0 ? (sy > 0 ? ty + 1 - y0 : y0 - ty) * tdy : Infinity;
    for (let guard = 0; guard < 256; guard++) {
      if (tx === ex && ty === ey) return true;
      if (tmx < tmy) { tmx += tdx; tx += sx; } else { tmy += tdy; ty += sy; }
      if (tx === ex && ty === ey) return true;
      if (OPAQUE.has(this.tile(tx, ty))) return false;
    }
    return true;
  }

  /** Random walkable point inside an area (rejection sampling, deterministic via rng). */
  randomPointIn(area: Area, rng: Rng): { x: number; y: number } {
    for (let i = 0; i < 40; i++) {
      const x = rng.range(area.x0 + 0.5, area.x1 + 0.5), y = rng.range(area.y0 + 0.5, area.y1 + 0.5);
      if (this.walkable(x, y)) return { x, y };
    }
    return { x: area.cx, y: area.cy };
  }

  randomWalkable(rng: Rng): { x: number; y: number } {
    for (let i = 0; i < 200; i++) {
      const x = rng.range(1, this.size - 1), y = rng.range(1, this.size - 1);
      if (this.walkable(x, y)) return { x, y };
    }
    return { x: this.size / 2, y: this.size / 2 };
  }

  /** Nearest walkable tile centre to (x, y), spiralling outward. */
  nearestWalkable(x: number, y: number): { x: number; y: number } {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (this.walkableTile(cx, cy)) return { x, y };
    for (let r = 1; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.walkableTile(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
      }
    }
    return { x: this.size / 2, y: this.size / 2 };
  }
}
