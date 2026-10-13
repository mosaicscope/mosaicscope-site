import { Rng } from "../core/rng";
import { T, World, Poi } from "../world/World";
import { LITTER } from "../content/litter";
import { TRINKETS, TRINKET_BY_ID, SET_BONUS, ART_COST, ArtPiece, artTitle } from "../content/reuse";
import type { Character } from "../entities/types";
import type { Simulation } from "./Simulation";
import type { Piece, LitterState } from "./Litter";
import { scrapCount } from "./Litter";

/**
 * The tidy-up layer on top of litter: a streak that brightens the block you are cleaning, the
 * reuse stall (trinkets and found-object art), and the community compost bins that make the park
 * flowers bloom. Headless; everything random comes from its own seeded Rng so the main
 * simulation's stream is never touched. Shine and bloom are mirrored onto the buildings and the
 * world so the renderer can read them without knowing about the sim.
 */
export const STREAK_WINDOW = 1200;   // ticks (20 s at 60 Hz) between tidy actions before the streak drops
export const COMPOST_CAP = 24;       // scraps one person can carry to the bin
const BLOOM_PER_SCRAP = 0.09;
const SHINE_CELL = 8;

export class TidyState {
  rng: Rng;
  streak = 0; best = 0; last = -1e9;
  trinkets: Record<string, number> = {};
  art: ArtPiece[] = [];
  made = 0; sold = 0; composted = 0; setDone = false;
  /** poi ids of the community compost bins, one per park */
  compostBins: number[] = [];

  constructor(private world: World, seed: number) {
    this.rng = new Rng((seed ^ 0x7d1e2) >>> 0);
    this.placeCompost();
  }

  /** One compost bin in every park, tucked beside a bench where there is one. */
  private placeCompost(): void {
    const w = this.world, S = w.size;
    const free = (tx: number, ty: number) => w.walkableTile(tx, ty) && [T.GRASS, T.PATH, T.PAVE, T.SIDEWALK].includes(w.tile(tx, ty)) && !w.pois.some((p) => Math.floor(p.x) === tx && Math.floor(p.y) === ty);
    for (const a of w.areas) {
      if (a.kind !== "park") continue;
      const spots: [number, number][] = [];
      for (const p of w.pois) if (p.kind === "bench" && p.area === a.id) spots.push([Math.floor(p.x) - 1, Math.floor(p.y)], [Math.floor(p.x), Math.floor(p.y) + 1]);
      for (let r = 0; r < 6; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) spots.push([Math.floor(a.cx) + dx, Math.floor(a.cy) + dy]);
      const s = spots.find(([x, y]) => x > 0 && y > 0 && x < S - 1 && y < S - 1 && free(x, y));
      if (!s) continue;
      const poi: Poi = { id: w.pois.length, kind: "compost", x: s[0] + 0.5, y: s[1] + 0.5, area: a.id, name: "Community compost" };
      w.pois.push(poi); this.compostBins.push(poi.id);
    }
  }

  /** A tidy-up action: extends the streak (or starts a new one) and returns its length. */
  bump(sim: Simulation, c: Character): number {
    this.streak = sim.tick - this.last > STREAK_WINDOW ? 1 : this.streak + 1;
    this.last = sim.tick;
    if (this.streak > this.best) this.best = this.streak;
    if (this.streak % 10 === 0) sparkle(sim, c.x, c.y, 1); // every 10th, so it stays rare next to the per-5 pickup spark
    return this.streak;
  }

  active(tick: number): boolean { return tick - this.last <= STREAK_WINDOW; }
  get trinketCount(): number { let n = 0; for (const k in this.trinkets) n += this.trinkets[k]; return n; }
}

/** A little sparkle and a very soft ding: a flash, a burst of stars, then two rising notes (see Audio "ding"). */
export function sparkle(sim: Simulation, x: number, y: number, size: 1 | 2 = 1): void {
  sim.bus.emit("fx", { kind: "flash", x, y, z: 1.2, n: 1 });
  sim.bus.emit("fx", { kind: "star", x, y, z: 1.4, n: size === 2 ? 9 : 4 });
  if (size === 2) sim.bus.emit("fx", { kind: "confetti", x, y, z: 1.6, n: 10 });
  sim.bus.emit("sound", { kind: "ding", x, y, vol: size === 2 ? 0.3 : 0.18 });
}

/* ------------------------------------------------------------- compost */
export const isCompostable = (k: Piece["kind"]): boolean => LITTER[k].value === 0;
export const compostCount = (c: Character): number => c.compost ?? 0;

/** Nearest uncollected wrapper or cup within r tiles, or null. */
export function nearestCompostable(st: LitterState, x: number, y: number, r: number): Piece | null {
  let best: Piece | null = null, bd = r;
  for (const p of st.pieces) {
    if (p.taken || !isCompostable(p.kind)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function collectCompostable(sim: Simulation, c: Character, p: Piece): "ok" | "full" | "no" {
  if (p.taken || !isCompostable(p.kind)) return "no";
  if (compostCount(c) >= COMPOST_CAP) return "full";
  p.taken = true;
  c.compost = compostCount(c) + 1;
  sim.bus.emit("sound", { kind: "pickup", x: c.x, y: c.y, vol: 0.25 });
  if (c.tier === "player") sim.tidy.bump(sim, c);
  return "ok";
}

export function nearestCompost(world: World, x: number, y: number, r: number): Poi | null {
  let best: Poi | null = null, bd = r;
  for (const p of world.pois) {
    if (p.kind !== "compost") continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Tip a bag of scraps into a compost bin: that park blooms for a good while. Returns how many went in. */
export function feedCompost(sim: Simulation, c: Character, bin: Poi): number {
  const n = compostCount(c);
  if (!n) return 0;
  c.compost = 0;
  const st = sim.tidy, was = sim.world.bloom.get(bin.area) ?? 0;
  sim.world.bloom.set(bin.area, Math.min(1, was + n * BLOOM_PER_SCRAP));
  st.composted += n;
  if (c.tier === "player") st.bump(sim, c);
  sparkle(sim, bin.x, bin.y, was < 0.3 && n >= 3 ? 2 : 1);
  return n;
}

/* --------------------------------------------------- reuse stall: trinkets and art */
/** Take n pieces out of the sack, cans first. */
function spend(c: Character, n: number): { cans: number; bottles: number } {
  const s = c.scrap ?? (c.scrap = { can: 0, bottle: 0 });
  const cans = Math.min(s.can, n), bottles = n - cans;
  s.can -= cans; s.bottle -= bottles;
  return { cans, bottles };
}

export function swapFor(sim: Simulation, c: Character, id: string): { ok: boolean; reason?: string; setBonus?: number } {
  const t = TRINKET_BY_ID[id];
  if (!t) return { ok: false, reason: "No such trinket." };
  if (scrapCount(c) < t.cost) return { ok: false, reason: `Needs ${t.cost} cans or bottles.` };
  spend(c, t.cost);
  const st = sim.tidy;
  st.trinkets[id] = (st.trinkets[id] ?? 0) + 1;
  if (c.tier === "player") st.bump(sim, c);
  let setBonus = 0;
  if (!st.setDone && TRINKETS.every((x) => st.trinkets[x.id])) { st.setDone = true; setBonus = SET_BONUS; c.cash += setBonus; sim.bus.emit("fx", { kind: "cash", x: c.x, y: c.y, z: 1.2, n: 10 }); }
  sparkle(sim, c.x, c.y, setBonus ? 2 : 1);
  return { ok: true, setBonus };
}

/** Assemble found-object art from the sack. Louis appraises it: quality is part craft (glass reads better), part his mood. */
export function assembleArt(sim: Simulation, c: Character): { ok: boolean; reason?: string; piece?: ArtPiece } {
  if (scrapCount(c) < ART_COST) return { ok: false, reason: `Needs ${ART_COST} cans or bottles.` };
  const { cans, bottles } = spend(c, ART_COST), st = sim.tidy;
  const q = Math.min(1, 0.15 + bottles * 0.1 + st.rng.next() * 0.55);
  const piece: ArtPiece = { title: artTitle(st.rng.int(0, 99), st.rng.int(0, 99)), cans, bottles, q: Math.round(q * 100) / 100, price: Math.round((0.5 + q * q * 7.5) * 100) / 100 };
  st.art.push(piece); st.made++;
  if (c.tier === "player") st.bump(sim, c);
  sparkle(sim, c.x, c.y, q > 0.8 ? 2 : 1);
  return { ok: true, piece };
}

export function sellArt(sim: Simulation, c: Character, index: number): ArtPiece | null {
  const st = sim.tidy, piece = st.art[index];
  if (!piece) return null;
  st.art.splice(index, 1); st.sold++;
  c.cash += piece.price;
  sim.bus.emit("fx", { kind: "cash", x: c.x, y: c.y, z: 1.2, n: 6 });
  sparkle(sim, c.x, c.y, piece.q > 0.8 ? 2 : 1);
  return piece;
}

/* ------------------------------------------------------------ shine and bloom */
/**
 * Every two seconds: a building's windows glow with how few uncollected pieces lie around it (counted
 * in 8-tile cells, the building's own and its neighbours), plus a short-lived glow near the player
 * while their tidy streak is running. Bloom slowly fades back so the bins want feeding.
 */
export function updateTidy(sim: Simulation): void {
  const w = sim.world, S = w.size, st = sim.tidy, cells = Math.ceil(S / SHINE_CELL);
  const grid = new Uint16Array(cells * cells);
  for (const p of sim.litter.pieces) if (!p.taken) grid[Math.floor(p.y / SHINE_CELL) * cells + Math.floor(p.x / SHINE_CELL)]++;
  const p = sim.player, glow = st.active(sim.tick) ? Math.min(0.5, st.streak * 0.06) : 0;
  for (const b of w.buildings) {
    const cx = Math.floor((b.x0 + b.x1 + 1) / 2 / SHINE_CELL), cy = Math.floor((b.y0 + b.y1 + 1) / 2 / SHINE_CELL);
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx, gy = cy + dy;
      if (gx >= 0 && gy >= 0 && gx < cells && gy < cells) n += grid[gy * cells + gx] * (dx || dy ? 0.4 : 1);
    }
    let shine = Math.exp(-n / 9);
    if (glow && Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.y0 + b.y1) / 2 - p.y) < 18) shine += glow;
    b.shine = Math.round(Math.min(1, shine) * 20) / 20;
  }
  for (const [area, v] of w.bloom) { const nv = v * 0.998 - 0.0004; if (nv < 0.03) w.bloom.delete(area); else w.bloom.set(area, nv); }
}

/* ------------------------------------------------------------------ saving */
export type SavedTidy = { trinkets: Record<string, number>; art: ArtPiece[]; made: number; sold: number; composted: number; setDone: boolean; best: number; bloom: [number, number][]; rng: number[] };
export function serializeTidy(st: TidyState, w: World): SavedTidy {
  return { trinkets: { ...st.trinkets }, art: st.art.map((a) => ({ ...a })), made: st.made, sold: st.sold, composted: st.composted, setDone: st.setDone, best: st.best, bloom: [...w.bloom.entries()], rng: st.rng.getState() };
}
export function restoreTidy(st: TidyState, w: World, d: SavedTidy): void {
  st.trinkets = { ...d.trinkets }; st.art = d.art.map((a) => ({ ...a }));
  st.made = d.made; st.sold = d.sold; st.composted = d.composted; st.setDone = d.setDone; st.best = d.best;
  w.bloom = new Map(d.bloom);
  st.rng.setState(d.rng as [number, number, number, number]);
}
