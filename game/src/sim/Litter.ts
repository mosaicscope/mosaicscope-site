import { Rng } from "../core/rng";
import { T, World, AreaKind, Poi } from "../world/World";
import { BUILDINGS } from "../content/buildings";
import { LITTER, LITTER_KINDS, LitterKind, Recyclable, isRecyclable, SACK_CAP, BULK_MIN, BULK_BONUS } from "../content/litter";
import type { Character } from "../entities/types";
import type { Simulation } from "./Simulation";

/**
 * Street litter, bins and the recycling run. Headless and deterministic: everything is drawn from
 * the litter's own Rng (seeded from the world seed, saved with the game), so it never disturbs the
 * main simulation's random stream. Pieces are flat ground clutter, not physics toys.
 */
export interface Piece { id: number; kind: LitterKind; x: number; y: number; rot: number; tone: number; taken: boolean }

/** How messy each kind of place gets (relative weight per tile). */
const MESS: Partial<Record<AreaKind, number>> = {
  nightlife: 5, alley: 5, food: 3, shops: 3, market: 3, plaza: 2.5, casino: 2, park: 1.6, playground: 1.4, street: 1.5, stage: 2,
  court: 1.2, residential: 0.6, office: 0.5, dealership: 0.4, studio: 0.8, hospital: 0.15, police: 0.15, airport: 0.3,
};
const LITTER_TILES = new Set<number>([T.SIDEWALK, T.PAVE, T.PATH, T.GRASS, T.SAND, T.COURT, T.FLOOR]);
export const MAX_PIECES = 560;
export const BIN_CAP = 4;
const START_PIECES = 340;

export class LitterState {
  pieces: Piece[] = [];
  /** items left in each street bin (poi id -> count) */
  stock = new Map<number, number>();
  /** pieces the player has returned for cash, ever */
  recycled = 0;
  rng: Rng;
  private spots: { x: number; y: number }[] = [];
  private cum: number[] = [];

  constructor(private world: World, seed: number) {
    this.rng = new Rng((seed ^ 0x11773c) >>> 0);
    this.placeBins();
    this.mapSpots();
    for (let i = 0; i < START_PIECES; i++) this.scatter();
  }

  /** Wheelie-style street bins by shop and club doors and beside benches (appended after generation, so lamp indices stay put). */
  private placeBins(): void {
    const w = this.world, S = w.size;
    const free = (tx: number, ty: number) => {
      if (!w.walkableTile(tx, ty) || ![T.SIDEWALK, T.PAVE, T.PATH, T.GRASS].includes(w.tile(tx, ty))) return false;
      return !w.pois.some((p) => Math.floor(p.x) === tx && Math.floor(p.y) === ty);
    };
    const add = (tx: number, ty: number) => {
      const poi: Poi = { id: w.pois.length, kind: "bin", x: tx + 0.5, y: ty + 0.5, area: w.areaOf[ty * S + tx] };
      w.pois.push(poi);
      this.stock.set(poi.id, this.rng.int(1, 3));
    };
    const loud = new Set(["nightclub", "casino", "stripclub", "velvet", "recycling", "gallery", "studio"]);
    for (const b of w.buildings) {
      const def = BUILDINGS[b.kind];
      if (!def.menu && !loud.has(b.kind)) continue;
      const along = b.door.face === "n" || b.door.face === "s" ? [[2, 0], [-2, 0]] : [[0, 2], [0, -2]];
      const reach = b.kind === "recycling" ? 2 : 1; // the depot has bins either side of its door
      let placed = 0;
      for (const [dx, dy] of along) if (placed < reach && free(b.door.x + dx, b.door.y + dy)) { add(b.door.x + dx, b.door.y + dy); placed++; }
    }
    for (const p of [...w.pois]) {
      if (p.kind !== "bench") continue;
      const tx = Math.floor(p.x) + 1, ty = Math.floor(p.y);
      if (free(tx, ty)) add(tx, ty);
    }
  }

  /** Every tile litter can land on, with a cumulative weight so picking a spot is a binary search. */
  private mapSpots(): void {
    const w = this.world, S = w.size;
    const hot = new Set<number>();
    for (const p of w.pois) if (p.kind === "bench" || p.kind === "bin") hot.add(Math.floor(p.y) * S + Math.floor(p.x));
    let total = 0;
    for (let ty = 1; ty < S - 1; ty++) for (let tx = 1; tx < S - 1; tx++) {
      const i = ty * S + tx;
      if (!LITTER_TILES.has(w.tiles[i]) || !w.walkableTile(tx, ty)) continue;
      let k = MESS[w.areas[w.areaOf[i]]?.kind ?? "street"] ?? 1;
      if (w.tiles[i - 1] === T.BUILDING || w.tiles[i + 1] === T.BUILDING || w.tiles[i - S] === T.BUILDING || w.tiles[i + S] === T.BUILDING) k *= 1.8; // collects along walls
      if (hot.has(i) || hot.has(i - 1) || hot.has(i + 1) || hot.has(i - S) || hot.has(i + S)) k *= 3; // and round benches and bins
      total += k;
      this.spots.push({ x: tx, y: ty }); this.cum.push(total);
    }
  }

  pickSpot(): { x: number; y: number } {
    const r = this.rng.next() * this.cum[this.cum.length - 1];
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.cum[mid] < r) lo = mid + 1; else hi = mid; }
    return this.spots[lo];
  }

  pickKind(): LitterKind { return LITTER_KINDS[this.rng.weighted(LITTER_KINDS.map((k) => LITTER[k].weight))]; }

  /** Drop a piece (reusing a collected slot when the street is full). Returns it, or null if full. */
  add(kind: LitterKind, x: number, y: number): Piece | null {
    let p = this.pieces.find((q) => q.taken);
    if (!p && this.pieces.length >= MAX_PIECES) return null;
    const tone = this.rng.int(0, LITTER[kind].tones.length - 1), rot = this.rng.range(0, 6.283);
    if (p) Object.assign(p, { kind, x, y, rot, tone, taken: false });
    else { p = { id: this.pieces.length, kind, x, y, rot, tone, taken: false }; this.pieces.push(p); }
    return p;
  }

  /** A fresh piece (sometimes a little cluster) at a weighted-random spot. */
  scatter(): void {
    const s = this.pickSpot(), n = this.rng.chance(0.3) ? this.rng.int(2, 3) : 1;
    for (let i = 0; i < n; i++) {
      const x = s.x + this.rng.range(0.12, 0.88), y = s.y + this.rng.range(0.12, 0.88);
      if (this.world.walkable(x, y)) this.add(this.pickKind(), x, y);
    }
  }

  get uncollected(): number { let n = 0; for (const p of this.pieces) if (!p.taken) n++; return n; }
}

export const scrapCount = (c: Character): number => (c.scrap ? c.scrap.can + c.scrap.bottle : 0);
export const scrapValue = (c: Character): number => (c.scrap ? c.scrap.can * LITTER.can.value + c.scrap.bottle * LITTER.bottle.value : 0);

/** Nearest uncollected redeemable piece within r tiles (cans and bottles only), or null. */
export function nearestRecyclable(st: LitterState, x: number, y: number, r: number): Piece | null {
  let best: Piece | null = null, bd = r;
  for (const p of st.pieces) {
    if (p.taken || !isRecyclable(p.kind)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function nearestBin(world: World, x: number, y: number, r: number): Poi | null {
  let best: Poi | null = null, bd = r;
  for (const p of world.pois) {
    if (p.kind !== "bin") continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function addScrap(c: Character, k: Recyclable, n = 1): void { c.scrap = c.scrap ?? { can: 0, bottle: 0 }; c.scrap[k] += n; }

/** Pick a can or bottle off the ground into the sack. */
export function collectPiece(sim: Simulation, c: Character, p: Piece): "ok" | "full" | "no" {
  if (p.taken || !isRecyclable(p.kind)) return "no";
  if (scrapCount(c) >= SACK_CAP) return "full";
  p.taken = true;
  addScrap(c, p.kind);
  sim.bus.emit("sound", { kind: "clink", x: c.x, y: c.y, vol: 0.5 });
  return "ok";
}

/** Rummage a street bin: cans and bottles people left in it. Empties it until it refills. */
export function rummageBin(sim: Simulation, c: Character, bin: Poi): { can: number; bottle: number; full: boolean } {
  const st = sim.litter, got = { can: 0, bottle: 0, full: false };
  let left = st.stock.get(bin.id) ?? 0;
  while (left > 0) {
    if (scrapCount(c) >= SACK_CAP) { got.full = true; break; }
    const k: Recyclable = st.rng.chance(0.65) ? "can" : "bottle";
    addScrap(c, k); got[k]++; left--;
  }
  st.stock.set(bin.id, left);
  if (got.can + got.bottle) sim.bus.emit("sound", { kind: "bin", x: c.x, y: c.y, vol: 0.6 });
  return got;
}

/** Return everything in the sack at the recycling centre. Bulk returns earn a tidy-up bonus. */
export function cashIn(sim: Simulation, c: Character): { n: number; base: number; bonus: number; total: number } {
  const n = scrapCount(c), base = Math.round(scrapValue(c) * 100) / 100;
  const bonus = n >= BULK_MIN ? Math.round(base * BULK_BONUS * 100) / 100 : 0;
  const total = Math.round((base + bonus) * 100) / 100;
  if (n > 0) {
    c.scrap = { can: 0, bottle: 0 };
    c.cash += total;
    if (c.tier === "player") sim.litter.recycled += n;
    sim.bus.emit("sound", { kind: "recycle", x: c.x, y: c.y, vol: 0.8 });
    sim.bus.emit("fx", { kind: "cash", x: c.x, y: c.y, z: 1.2, n: Math.min(12, 3 + Math.floor(n / 3)) });
  }
  return { n, base, bonus, total };
}

const MESSY_AREA = (sim: Simulation, x: number, y: number): number => MESS[sim.world.areaAt(x, y)?.kind ?? "street"] ?? 1;

/**
 * Every two seconds a few people are sampled: some drop a can or wrapper where they stand (more at
 * night, more in the messy parts of town), cleaners and the odd tidy citizen pick things up. Once an
 * hour a handful of collected pieces turn up again out of sight, and bins slowly refill.
 */
export function updateLitter(sim: Simulation): void {
  const st = sim.litter, rng = st.rng, n = sim.chars.length;
  if (!n) return;
  const hour = sim.hour, night = hour >= 20 || hour < 4;
  for (let i = 0; i < 4; i++) {
    const c = sim.chars[rng.int(0, n - 1)];
    if (c.tier === "player" || c.inside >= 0 || c.inCar >= 0 || c.phys !== 0) continue;
    const moving = Math.hypot(c.vx, c.vy) > 0.2;
    if (c.role === "cleaner") {
      for (const p of st.pieces) if (!p.taken && Math.hypot(p.x - c.x, p.y - c.y) < 1.4 && rng.chance(0.6)) { p.taken = true; break; }
      continue;
    }
    // a tidy citizen pockets a can for the deposit
    const near = nearestRecyclable(st, c.x, c.y, 0.9);
    if (near && c.pers.kindness > 0.5 && rng.chance(0.2 * c.pers.kindness)) { near.taken = true; c.cash += LITTER[near.kind].value; continue; }
    const mess = MESSY_AREA(sim, c.x, c.y);
    if (moving && mess >= 1.2 && rng.chance((night ? 0.2 : 0.07) * Math.min(2, mess / 2) * (1 - c.pers.kindness * 0.6))) st.add(st.pickKind(), c.x, c.y);
  }
  if (sim.tick % 3600 === 0) {
    // the city makes more mess, but never in front of the player
    const p = sim.player;
    for (let i = 0; i < 8; i++) {
      if (!st.pieces.some((q) => q.taken)) break;
      const s = st.pickSpot();
      if (Math.hypot(s.x - p.x, s.y - p.y) < 14) continue;
      st.add(st.pickKind(), s.x + rng.range(0.15, 0.85), s.y + rng.range(0.15, 0.85));
    }
  }
  if (sim.tick % 1800 === 0) for (const [id, left] of st.stock) if (left < BIN_CAP && rng.chance(0.5)) st.stock.set(id, left + 1);
}

/* ------------------------------------------------------------------ saving */
export type SavedLitter = { pieces: [LitterKind, number, number, number, number, number][]; stock: [number, number][]; recycled: number; rng: number[] };
export function serializeLitter(st: LitterState): SavedLitter {
  return { pieces: st.pieces.map((p) => [p.kind, p.x, p.y, p.rot, p.tone, p.taken ? 1 : 0]), stock: [...st.stock.entries()], recycled: st.recycled, rng: st.rng.getState() };
}
export function restoreLitter(st: LitterState, d: SavedLitter): void {
  st.pieces = d.pieces.map(([kind, x, y, rot, tone, taken], id) => ({ id, kind, x, y, rot, tone, taken: !!taken }));
  st.stock = new Map(d.stock);
  st.recycled = d.recycled;
  st.rng.setState(d.rng as [number, number, number, number]);
}
