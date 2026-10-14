import { Rng } from "../core/rng";

export const enum T {
  GRASS = 0, PAVE = 1, PATH = 2, FLOOR = 3, COURT = 4, WATER = 5, WALL = 6, TREE = 7,
  STALL = 8, FOUNTAIN = 9, STAGE = 10, FENCE = 11, HEDGE = 12, STREET = 13, SAND = 14, CRATE = 15,
  ROAD = 16, SIDEWALK = 17, CROSSWALK = 18, BUILDING = 19, PARKING = 20,
}

export const TILE_NAMES = ["grass", "pave", "path", "floor", "court", "water", "wall", "tree", "stall", "fountain", "stage", "fence", "hedge", "street", "sand", "crate", "road", "sidewalk", "crosswalk", "building", "parking"];

/** Tiles nobody can stand on. */
export const SOLID = new Set<number>([T.WATER, T.WALL, T.TREE, T.STALL, T.FOUNTAIN, T.FENCE, T.HEDGE, T.CRATE, T.BUILDING]);
/** Tiles that block line of sight (fences and water do not). */
export const OPAQUE = new Set<number>([T.WALL, T.TREE, T.STALL, T.BUILDING]);
/** Tiles cars may drive on. */
export const DRIVABLE = new Set<number>([T.ROAD, T.CROSSWALK, T.PARKING]);
/** Pathfinding cost per tile (people prefer sidewalks and crossings to walking down the road). */
export const WALK_COST: Record<number, number> = { [T.ROAD]: 60, [T.PARKING]: 1.5 }; // jaywalking is a last resort: people walk round to a crossing
/** Decoration that the generator may remove to keep the world connected. */
export const DECOR = new Set<number>([T.TREE, T.HEDGE, T.STALL, T.CRATE]);
/** Visual heights for rendering blocks. */
export const TILE_HEIGHT: Record<number, number> = { [T.WALL]: 1.25, [T.FENCE]: 0.7, [T.STALL]: 1.3, [T.FOUNTAIN]: 0.45, [T.STAGE]: 0.3, [T.HEDGE]: 0.8, [T.CRATE]: 0.8 };

export type AreaKind = "street" | "plaza" | "park" | "court" | "studio" | "stage" | "market" | "playground" | "alley"
  | "casino" | "police" | "food" | "shops" | "residential" | "office" | "dealership" | "hospital" | "gallery" | "airport" | "nightlife";
export interface Area { id: number; name: string; kind: AreaKind; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }
export type PoiKind = "bench" | "boombox" | "toychest" | "lamp" | "hoop" | "door" | "springpad" | "fountain" | "busstop" | "foodtruck" | "atm" | "mural" | "hydrant" | "billboard" | "light" | "plane" | "bin";
export interface Poi { id: number; kind: PoiKind; x: number; y: number; area: number; on?: boolean; building?: number; menu?: string[]; name?: string; dir?: number }

export interface Building {
  id: number;
  kind: import("../content/buildings").BuildingKind;
  name: string;
  x0: number; y0: number; x1: number; y1: number;  // inclusive tile rect
  floors: number;
  height: number;                                  // world z units
  color: string; roof: string; sign: string;
  door: { x: number; y: number; face: "n" | "s" | "e" | "w" };
  area: number;
  billboard: boolean;
}

/** One painted tag or mural on a building face. */
export interface Graffiti { id: number; tx: number; ty: number; face: "s" | "e"; text: string; color: string; artist: number; tick: number; legal: boolean; style: number }

/**
 * Road grid geometry. Every PERIOD tiles there is a ROAD_W-wide road (two lanes each way, left-hand
 * traffic: lanes at offsets 0.5/1.5 carry eastbound/northbound traffic, 2.5/3.5 westbound/southbound,
 * the centre line sits at offset 2). Each block between roads is a 2-tile sidewalk ring around a
 * 12x12 interior. Crosswalks are the CROSS_W tiles of road next to each intersection, in line with
 * the sidewalk.
 */
export const PERIOD = 20;
export const ROAD_W = 4;
export const SIDEWALK_W = 2;
export const CROSS_W = 2;

export class World {
  readonly size: number;
  readonly tiles: Uint8Array;
  readonly areaOf: Uint8Array;
  readonly shelter: Uint8Array;
  areas: Area[] = [];
  pois: Poi[] = [];
  buildings: Building[] = [];
  /** building id per tile (-1 none) */
  readonly buildingOf: Int16Array;
  graffiti: Graffiti[] = [];
  /** road grid: roads at coordinates where c % period < ROAD_W */
  readonly period = PERIOD;
  /** real street names per road line (index = coordinate / period), west->east and north->south */
  streetsX: string[] = [];
  streetsY: string[] = [];
  /** Tiles changed since last render (drives chunk re-render). */
  dirtyTiles = new Set<number>();

  constructor(size: number) {
    this.size = size;
    this.tiles = new Uint8Array(size * size);
    this.areaOf = new Uint8Array(size * size);
    this.shelter = new Uint8Array(size * size);
    this.buildingOf = new Int16Array(size * size).fill(-1);
  }

  /** "Colombo St" etc. for a point on (or next to) a road; the nearest street otherwise. */
  streetName(x: number, y: number): string {
    const half = ROAD_W / 2;
    const lx = Math.round((x - half) / this.period), ly = Math.round((y - half) / this.period);
    const dx = Math.abs(x - lx * this.period - half), dy = Math.abs(y - ly * this.period - half);
    return (dx <= dy ? this.streetsX[lx] : this.streetsY[ly]) ?? "";
  }
  isRoadLine(c: number): boolean { return c >= 0 && c % this.period < ROAD_W; }
  /** Index of the last road line (roads run along both map edges). */
  get maxLine(): number { return Math.floor((this.size - ROAD_W) / this.period); }
  drivable(x: number, y: number): boolean { return DRIVABLE.has(this.tile(Math.floor(x), Math.floor(y))); }
  buildingAt(tx: number, ty: number): Building | undefined { if (!this.inBounds(tx, ty)) return undefined; const b = this.buildingOf[ty * this.size + tx]; return b >= 0 ? this.buildings[b] : undefined; }
  walkCost(tx: number, ty: number): number { return WALK_COST[this.tiles[ty * this.size + tx]] ?? 1; }

  idx(tx: number, ty: number): number { return ty * this.size + tx; }
  inBounds(tx: number, ty: number): boolean { return tx >= 0 && ty >= 0 && tx < this.size && ty < this.size; }
  tile(tx: number, ty: number): number { return this.inBounds(tx, ty) ? this.tiles[ty * this.size + tx] : T.WALL; }
  set(tx: number, ty: number, t: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.size + tx;
    if (this.tiles[i] !== t) { this.tiles[i] = t; this.dirtyTiles.add(i); }
  }
  /** Extra solid footprints that aren't tiles (the parked jet): blocks walking, not drawing. */
  blocked: Uint8Array = new Uint8Array(0);
  walkableTile(tx: number, ty: number): boolean { return this.inBounds(tx, ty) && !SOLID.has(this.tiles[ty * this.size + tx]) && !this.blocked[ty * this.size + tx]; }
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
  /** Car space: the road and its crossings. Parking bays are fine to stand in. */
  carriageway(x: number, y: number): boolean { const t = this.tile(Math.floor(x), Math.floor(y)); return t === T.ROAD || t === T.CROSSWALK; }
  /**
   * The nearest place to stand that is out of the traffic: the footpath first, then anything walkable that is not
   * road. People who stop (to wait, chat, watch, dance) do it here, not in a lane.
   */
  nearestFoot(x: number, y: number, maxR = 8): { x: number; y: number } {
    if (!this.carriageway(x, y) && this.walkable(x, y)) return { x, y };
    const cx = Math.floor(x), cy = Math.floor(y);
    // keep the spot's own place within its tile, so a crowd moved off the road spreads along the kerb instead of
    // piling onto one tile centre and shoving each other back and forth
    const fx = 0.15 + (x - cx) * 0.7, fy = 0.15 + (y - cy) * 0.7;
    let alt: { x: number; y: number } | null = null;
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (!this.walkableTile(tx, ty)) continue;
        const t = this.tiles[ty * this.size + tx];
        if (t === T.SIDEWALK) return { x: tx + fx, y: ty + fy };
        if (!alt && t !== T.ROAD && t !== T.CROSSWALK) alt = { x: tx + fx, y: ty + fy };
      }
      if (alt) return alt;
    }
    return this.nearestWalkable(x, y);
  }

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
