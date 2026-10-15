import { Rng } from "../core/rng";
import { T, World } from "../world/World";
import { applyInteraction } from "../social/Social";
import { forceGoal } from "../ai/brain";
import { SpatialHash } from "../world/SpatialHash";
import { TICKS_PER_HOUR } from "./Environment";
import type { Character } from "../entities/types";
import type { Simulation } from "./Simulation";

/**
 * Street stories: a fortune-teller kiosk whose fortunes quietly come true, neighbour feuds that
 * escalate over game days until the player mediates, pet pigeons that learn the player's route, and
 * the rooftop coop (with a ladder) they roost in. Headless and deterministic: all randomness comes
 * from the state's own Rng (seeded from the world seed, saved with the game), so it never disturbs the
 * main simulation's stream. Rendering lives in render/StoryArt.ts.
 */

const WALK = new Set<number>([T.SIDEWALK, T.PAVE, T.PATH, T.GRASS, T.SAND, T.COURT, T.FLOOR]);
export const FORTUNE_PRICE = 5;
export const FEED_PRICE = 1;
export const FEEDER_PRICE = 3;
export const PET_CAP = 3;
export const PET_CAP_COOP = 5;
export const STAGE_TICKS = 6 * TICKS_PER_HOUR;
const CELL = 6;

/* ------------------------------------------------------------------ data */
export type FortuneKind = "coin" | "hello" | "honk" | "pigeon";
export type FortuneState = "pending" | "sent" | "true" | "lapsed";
export interface Fortune { id: number; text: string; kind: FortuneKind; due: number; state: FortuneState; target: number }
export interface Drop { x: number; y: number; cash: number; until: number; fortune: number }
export interface Kiosk { x: number; y: number }
/** The rooftop coop: (rx, ry) is the roof tile, lx the tile column of the ladder up its south wall. */
export interface Coop { building: number; rx: number; ry: number; lx: number; height: number; fedUntil: number; adopted: number }
export interface Pigeon {
  id: number; name: string; pet: boolean; trust: number;
  x: number; y: number; z: number; tx: number; ty: number; hx: number; hy: number;
  mode: "peck" | "walk" | "fly" | "perch"; wait: number; face: number; learned: number; guess: number; flap: number;
}
export interface Feud { id: number; a: number; b: number; reason: number; stage: number; next: number; heard: [boolean, boolean]; state: "on" | "truce" | "brawl"; bark: number }
export interface Note { text: string; kind: string }

export const NAMES = ["Biscuit", "Gravy", "Sir Coo", "Doris", "Pebble", "Nugget", "Flapjack", "Mavis", "Toast", "Dot", "Waffle", "Admiral Crumb"];

const FORTUNES: Record<FortuneKind, string[]> = {
  coin: ["Small money will find you before the day is out.", "Look down. The pavement is holding a gift.", "A stranger's loss becomes your lunch."],
  hello: ["A friendly voice will greet you when you least expect it.", "Someone nearby has been meaning to say hello.", "Smile first. Someone will smile back."],
  honk: ["A horn will sing in your honour.", "A driver will notice you and approve.", "Somebody on four wheels is thinking of you."],
  pigeon: ["A feathered friend will seek you out.", "Wings are coming. Keep your pockets crumby.", "Watch the sky. It is watching you."],
};

export const REASONS = ["the hedge", "bin day", "the late-night trumpet", "the parking spot", "the washing line", "a very opinionated cat", "the fence", "a borrowed ladder"];
const TIERS: string[][] = [
  ["Not naming names, but some people's {t} is a disgrace.", "Funny how {t} is only ever MY problem.", "I'm not saying anything about {t}. I'm just saying it loudly."],
  ["That's it. {t} ends today.", "You can take {t} and put it where the sun doesn't shine!", "Everyone on this street knows about {t}!"],
  ["I'll sort {t} myself, in front of everyone!", "Say one more thing about {t}. I dare you.", "{t}! THIS. MEANS. WAR."],
];
const TRUCE_LINES = ["Fine. We'll share it.", "You know what? You're alright.", "Cuppa, then?", "I was being daft about it, to be fair."];

export interface SavedStories {
  rng: number[]; kiosk: Kiosk | null; coop: Coop | null; pigeons: Pigeon[]; fortunes: Fortune[]; drops: Drop[]; feuds: Feud[];
  route: [number, number, number][]; truces: number; nextId: number;
}

/* ------------------------------------------------------------------ state */
export class StoriesState {
  rng: Rng;
  kiosk: Kiosk | null = null;
  coop: Coop | null = null;
  pigeons: Pigeon[] = [];
  fortunes: Fortune[] = [];
  drops: Drop[] = [];
  feuds: Feud[] = [];
  /** coarse cell -> next cell -> times the player walked it */
  route = new Map<number, Map<number, number>>();
  lastCell = -1;
  truces = 0;
  nextId = 1;
  /** toasts for the UI to drain */
  notes: Note[] = [];
  private hash: SpatialHash;
  private tmp: number[] = [];
  private cols: number;

  constructor(private world: World, seed: number) {
    this.rng = new Rng((seed ^ 0x57a11e5) >>> 0);
    this.cols = Math.ceil(world.size / CELL);
    this.hash = new SpatialHash(world.size, world.size, 2, 1024);
    this.placeKiosk();
    this.placeCoop();
    this.flock();
  }

  cellOf(x: number, y: number): number { return Math.floor(y / CELL) * this.cols + Math.floor(x / CELL); }
  cellCentre(c: number): { x: number; y: number } {
    const x = (c % this.cols) * CELL + CELL / 2, y = Math.floor(c / this.cols) * CELL + CELL / 2;
    return this.world.nearestWalkable(x, y);
  }
  get petCap(): number { return this.coop ? PET_CAP_COOP : PET_CAP; }
  pets(): Pigeon[] { return this.pigeons.filter((p) => p.pet); }

  private solidNear(tx: number, ty: number): boolean {
    for (const p of this.world.pois) if (Math.hypot(p.x - tx - 0.5, p.y - ty - 0.5) < 1.6) return true;
    return false;
  }
  private plainTile(tx: number, ty: number): boolean { return this.world.walkableTile(tx, ty) && WALK.has(this.world.tile(tx, ty)); }

  /** A booth on the plaza's edge, away from the fountain. */
  private placeKiosk(): void {
    const w = this.world, a = w.areas.find((x) => x.kind === "plaza");
    if (!a) return;
    let best: Kiosk | null = null, bd = 1e9;
    for (let ty = a.y0; ty <= a.y1; ty++) for (let tx = a.x0; tx <= a.x1; tx++) {
      if (!this.plainTile(tx, ty) || this.solidNear(tx, ty)) continue;
      const d = Math.hypot(tx - (a.x1 - 1.5), ty - (a.y0 + 1.5));
      if (d < bd) { bd = d; best = { x: tx + 0.5, y: ty + 0.5 }; }
    }
    this.kiosk = best;
  }

  /** A roof corner with a free pavement tile at the foot of its south wall, near (but not on) the plaza. */
  private placeCoop(): void {
    const w = this.world, f = w.areas.find((x) => x.kind === "plaza");
    if (!f) return;
    const okKinds = new Set(["apartments", "house", "hotel", "office", "records", "barber", "gym", "pawn", "bank"]);
    let best: Coop | null = null, bd = 1e9;
    for (const b of w.buildings) {
      if (!okKinds.has(b.kind) || b.floors < 2 || b.x1 - b.x0 < 2) continue;
      for (const lx of [b.x1, b.x1 - 1]) {
        const fy = b.y1 + 1;
        if (!this.plainTile(lx, fy) || !this.plainTile(lx, fy + 1) || (b.door.x === lx && b.door.y === fy) || this.solidNear(lx, fy)) continue;
        const d = Math.hypot(lx - f.cx, b.y1 - f.cy);
        if (d < 9 || d > 40 || d >= bd) continue;
        bd = d; best = { building: b.id, rx: lx, ry: b.y1, lx, height: b.height, fedUntil: 0, adopted: 0 };
      }
    }
    this.coop = best;
  }

  /** Where the player stands to use the ladder. */
  ladderFoot(): { x: number; y: number } | null { return this.coop ? { x: this.coop.lx + 0.5, y: this.world.buildings[this.coop.building].y1 + 1.6 } : null; }
  /** Where a perched bird sits on the coop roof. */
  roost(i: number): { x: number; y: number; z: number } | null {
    const c = this.coop; if (!c) return null;
    return { x: c.rx + 0.25 + (i % 3) * 0.25, y: c.ry + 0.35 + Math.floor(i / 3) * 0.3, z: c.height + 0.62 };
  }
  flags(): number { const c = this.coop; return c ? Math.min(12, c.adopted * 2 + Math.floor(this.pets().reduce((n, p) => n + p.learned, 0) / 4)) : 0; }

  /** Wild flocks on the plaza and by the benches. */
  private flock(): void {
    const w = this.world, plaza = w.areas.find((x) => x.kind === "plaza");
    const spots: { x: number; y: number }[] = [];
    if (plaza) spots.push(w.nearestWalkable(plaza.cx + 2, plaza.cy + 2));
    const benches = w.pois.filter((p) => p.kind === "bench" || p.kind === "fountain");
    for (let i = 0; i < 3 && benches.length; i++) { const b = benches[this.rng.int(0, benches.length - 1)]; spots.push(w.nearestWalkable(b.x + 1, b.y + 1)); }
    for (const s of spots) for (let i = 0; i < 3; i++) this.spawnWild(s.x + this.rng.range(-1.2, 1.2), s.y + this.rng.range(-1.2, 1.2), s.x, s.y);
  }

  spawnWild(x: number, y: number, hx: number, hy: number): Pigeon {
    const p: Pigeon = { id: this.pigeons.length, name: NAMES[this.rng.int(0, NAMES.length - 1)], pet: false, trust: 0, x, y, z: 0, tx: x, ty: y, hx, hy, mode: "peck", wait: this.rng.int(30, 200), face: this.rng.range(0, 6.28), learned: 0, guess: -1, flap: 0 };
    this.pigeons.push(p);
    return p;
  }

  /* ---------------------------------------------------------------- pigeons */
  private spotNear(x: number, y: number, r: number): { x: number; y: number } {
    for (let i = 0; i < 6; i++) {
      const a = this.rng.range(0, 6.283), d = this.rng.range(r * 0.4, r);
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      if (this.plainTile(Math.floor(sx), Math.floor(sy))) return { x: sx, y: sy };
    }
    return { x, y };
  }

  nearestWild(x: number, y: number, r: number): Pigeon | null {
    let best: Pigeon | null = null, bd = r;
    for (const p of this.pigeons) { if (p.pet || p.mode === "fly") continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /** Scatter crumbs: wild pigeons nearby come over, and the closest one learns to trust you. */
  feed(sim: Simulation): "poor" | "none" | "fed" | "adopted" | "full" {
    const p = sim.player;
    if (p.cash < FEED_PRICE) return "poor";
    const near = this.nearestWild(p.x, p.y, 2.8);
    if (!near) return "none";
    p.cash -= FEED_PRICE;
    for (const b of this.pigeons) if (!b.pet && b.mode !== "fly" && Math.hypot(b.x - p.x, b.y - p.y) < 4.5) { b.tx = p.x + this.rng.range(-0.8, 0.8); b.ty = p.y + this.rng.range(-0.8, 0.8); b.mode = "walk"; b.wait = 150; }
    near.trust = Math.min(1, near.trust + 0.34);
    if (near.trust < 1) return "fed";
    if (this.pets().length >= this.petCap) { near.trust = 0.6; return "full"; }
    this.adopt(near);
    return "adopted";
  }

  adopt(b: Pigeon): void {
    b.pet = true; b.trust = 1; b.wait = 0; b.mode = "walk";
    if (this.pigeons.some((o) => o !== b && o.pet && o.name === b.name)) b.name = NAMES.find((n) => !this.pigeons.some((o) => o.pet && o.name === n)) ?? b.name;
    if (this.coop) this.coop.adopted++;
    this.notes.push({ text: `${b.name} the pigeon has decided you're alright.`, kind: "acid" });
  }

  private step(sim: Simulation): void {
    const p = sim.player, night = sim.hour < 5 || sim.hour >= 22;
    const moving = Math.hypot(p.vx, p.vy) > 0.5 && p.inCar < 0;
    const pets = this.pets();
    const succ = this.successors(this.cellOf(p.x, p.y));
    pets.forEach((b, i) => this.stepPet(sim, b, i, moving, night, succ));
    // wild birds: peck about their spot, scatter from walkers and cars, drift home again
    const w = this.world;
    for (const b of this.pigeons) {
      if (b.pet) continue;
      if (b.mode === "fly") { if (this.glide(b, 5.2)) { b.mode = "peck"; b.z = 0; b.wait = this.rng.int(120, 300); b.hx = b.x; b.hy = b.y; } continue; }
      if (sim.tick % 6 === b.id % 6 && b.wait < 200) {
        let scare = false;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 1.1 && !(b.trust > 0 && b.wait > 0)) scare = true;
        else if (sim.tick % 12 === b.id % 12) {
          const n = this.hash.query(b.x, b.y, 0.9, this.tmp);
          for (let k = 0; k < n; k++) { const c = sim.chars[this.tmp[k]]; if (c && c.id !== p.id && Math.hypot(c.vx, c.vy) > 1.2) { scare = true; break; } }
        }
        if (scare) { const s = this.spotNear(b.x, b.y, 5); b.tx = s.x; b.ty = s.y; b.mode = "fly"; b.face = Math.atan2(s.y - b.y, s.x - b.x); b.wait = 0; continue; }
      }
      if (b.wait > 0) { b.wait--; b.mode = "peck"; continue; }
      if (b.mode === "peck") { const s = this.spotNear(b.hx, b.hy, 2.2); b.tx = s.x; b.ty = s.y; b.mode = "walk"; }
      if (this.glide(b, 1.3)) { b.mode = "peck"; b.wait = this.rng.int(40, 220); }
      if (!w.walkable(b.x, b.y)) { b.x = b.hx; b.y = b.hy; }
    }
  }

  /** Move toward (tx, ty) at `speed` tiles/s; flying birds arc up and down. True on arrival. */
  private glide(b: Pigeon, speed: number): boolean {
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), st = speed / 60;
    if (d <= st) { b.x = b.tx; b.y = b.ty; if (b.mode === "fly" || b.mode === "perch") b.z = Math.max(0, b.z - 0.08); return true; }
    b.x += (dx / d) * st; b.y += (dy / d) * st; b.face = Math.atan2(dy, dx);
    b.flap += speed > 3 ? 0.9 : 0.35;
    if (b.mode === "fly" && b.z <= 1.5) b.z = Math.max(0, Math.min(1.4, b.z + (d > 1.5 ? 0.05 : -0.04)));
    return false;
  }

  private stepPet(sim: Simulation, b: Pigeon, i: number, moving: boolean, night: boolean, succ: [number, number][]): void {
    const p = sim.player, c = this.coop;
    if (night && c) {
      const r = this.roost(i)!, near = Math.hypot(r.x - b.x, r.y - b.y) < 6;
      b.tx = r.x; b.ty = r.y; b.mode = "fly"; b.guess = -1;
      const arrived = this.glide(b, 5);
      const goal = near ? r.z : 1.4;
      b.z += Math.max(-0.12, Math.min(0.12, goal - b.z));
      if (arrived && Math.abs(b.z - r.z) < 0.15) { b.mode = "perch"; b.z = r.z; }
      return;
    }
    if (b.z > 1.5) b.z -= 0.12; // leaving the roost
    // scout ahead to where the player usually goes next
    const share = succ.length > i ? succ[i][1] : 0;
    if (b.guess < 0 && moving && succ.length > i && share >= (i === 0 ? 0.45 : 0.2) && sim.tick % 30 === i) {
      const ctr = this.cellCentre(succ[i][0]);
      if (Math.hypot(ctr.x - p.x, ctr.y - p.y) > 4 && Math.hypot(ctr.x - p.x, ctr.y - p.y) < 18) { b.guess = succ[i][0]; b.tx = ctr.x; b.ty = ctr.y; b.mode = "fly"; b.wait = 900; }
    }
    if (b.guess >= 0) {
      const cur = this.cellOf(p.x, p.y);
      if (cur === b.guess) { b.learned++; b.guess = -1; if ([3, 10, 25].includes(b.learned)) this.notes.push({ text: `${b.name} was already waiting where you were headed (${b.learned} routes learned).`, kind: "acid" }); }
      else if (--b.wait <= 0) { b.guess = -1; b.wait = 0; } // wrong guess: give up and tag along again
      if (b.guess >= 0) { if (this.glide(b, 4.6)) { b.mode = "perch"; b.z = 0; } return; }
    }
    // otherwise tag along behind, or peck about when you stop
    const slot = 1.2 + i * 0.7, side = i % 2 ? 0.7 : -0.7;
    const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
    const gx = p.x - fx * slot - fy * side, gy = p.y - fy * slot + fx * side;
    const d = Math.hypot(gx - b.x, gy - b.y);
    if (moving || d > 3) {
      b.tx = this.plainTile(Math.floor(gx), Math.floor(gy)) ? gx : p.x; b.ty = this.plainTile(Math.floor(gx), Math.floor(gy)) ? gy : p.y;
      b.mode = d > 5 ? "fly" : "walk";
      this.glide(b, d > 5 ? 5.4 : Math.min(3.6, 1.2 + d * 1.1));
      if (b.mode === "walk") b.z = Math.max(0, b.z - 0.06);
    } else {
      b.mode = "peck";
      if (b.wait-- <= 0) { const s = this.spotNear(p.x, p.y, 1.8); b.tx = s.x; b.ty = s.y; b.mode = "walk"; b.wait = this.rng.int(60, 200); }
      if (b.mode === "walk") this.glide(b, 1.2);
      b.z = Math.max(0, b.z - 0.06);
    }
  }

  /** Where the player goes next from `cell`, most likely first, as [cell, share]. */
  successors(cell: number): [number, number][] {
    const m = this.route.get(cell);
    if (!m) return [];
    let total = 0;
    for (const n of m.values()) total += n;
    if (total < 3) return [];
    return [...m.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, n / total] as [number, number]);
  }

  private trackRoute(sim: Simulation): void {
    const p = sim.player;
    if (p.inCar >= 0 || p.inside >= 0) { this.lastCell = -1; return; }
    const cell = this.cellOf(p.x, p.y);
    if (cell === this.lastCell) return;
    if (this.lastCell >= 0) {
      let m = this.route.get(this.lastCell);
      if (!m) { m = new Map(); this.route.set(this.lastCell, m); }
      m.set(cell, Math.min(60, (m.get(cell) ?? 0) + 1));
      if (this.route.size > 500) this.route.delete(this.route.keys().next().value as number);
    }
    this.lastCell = cell;
  }

  /* ---------------------------------------------------------------- fortunes */
  /** Pay the fortune-teller. The slip is written now; the world quietly gets on with making it true. */
  readFortune(sim: Simulation): Fortune | "poor" {
    const p = sim.player;
    if (p.cash < FORTUNE_PRICE) return "poor";
    p.cash -= FORTUNE_PRICE;
    const kinds: FortuneKind[] = ["coin", "hello", "pigeon"];
    if (sim.vehicles.some((v) => v.driver >= 0 && Math.hypot(v.x - p.x, v.y - p.y) < 40)) kinds.push("honk");
    const kind = this.rng.pick(kinds);
    const f: Fortune = { id: this.nextId++, text: this.rng.pick(FORTUNES[kind]), kind, due: sim.tick + Math.round(this.rng.range(0.4, 1.4) * TICKS_PER_HOUR), state: "pending", target: -1 };
    if (kind === "honk") { const vs = sim.vehicles.filter((v) => v.driver >= 0 && Math.hypot(v.x - p.x, v.y - p.y) < 40); f.target = this.rng.pick(vs).id; }
    this.fortunes.push(f);
    if (this.fortunes.length > 12) this.fortunes.shift();
    return f;
  }

  private fortunesTick(sim: Simulation): void {
    const p = sim.player;
    for (const f of this.fortunes) {
      if (f.state !== "pending" || sim.tick < f.due) continue;
      if (f.kind === "coin") {
        const s = this.spotNear(p.x, p.y, 7);
        if (Math.hypot(s.x - p.x, s.y - p.y) < 2.5) continue; // try again next beat
        this.drops.push({ x: s.x, y: s.y, cash: this.rng.int(12, 45), until: sim.tick + 3 * TICKS_PER_HOUR, fortune: f.id });
        f.state = "sent";
      } else if (f.kind === "hello") {
        let best: Character | null = null, bd = 12;
        for (const c of sim.chars) { if (c === p || c.inside >= 0 || c.inCar >= 0 || c.tier === "background" && !c.promoted) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd && d > 1.5) { bd = d; best = c; } }
        if (!best) { if (sim.tick > f.due + 2 * TICKS_PER_HOUR) f.state = "lapsed"; continue; }
        sim.say(best, this.rng.pick(["Morena! Lovely to see you.", "Hey, you! Having a good one?", "Oh, hello! I was just thinking of you."]), "say", 3);
        applyInteraction(best, p, "compliment", true, sim.tick);
        f.state = "true";
      } else if (f.kind === "honk") {
        const v = sim.vehicles[f.target] ?? sim.vehicles.find((q) => q.driver >= 0);
        if (!v) { f.state = "lapsed"; continue; }
        sim.bus.emit("sound", { kind: "horn", x: v.x, y: v.y, vol: 0.9 });
        const d = v.driver >= 0 ? sim.chars[v.driver] : null;
        if (d) sim.say(d, "Beep beep! Love the look!", "shout", 2.5);
        f.state = "true";
      } else {
        const b = this.nearestWild(p.x, p.y, 40) ?? this.pigeons.find((q) => !q.pet) ?? null;
        if (!b) { f.state = "lapsed"; continue; }
        const s = this.spotNear(p.x, p.y, 2.5);
        b.tx = s.x; b.ty = s.y; b.mode = "fly"; b.wait = 0; b.trust = Math.min(1, b.trust + 0.5);
        f.state = "true";
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.hypot(d.x - p.x, d.y - p.y) < 0.9 && p.inCar < 0) {
        p.cash += d.cash;
        const f = this.fortunes.find((q) => q.id === d.fortune); if (f) f.state = "true";
        this.notes.push({ text: `Found $${d.cash} on the pavement. Huh.`, kind: "acid" });
        this.drops.splice(i, 1);
      } else if (sim.tick > d.until) { const f = this.fortunes.find((q) => q.id === d.fortune); if (f) f.state = "lapsed"; this.drops.splice(i, 1); }
    }
  }

  /* ---------------------------------------------------------------- feuds */
  feudsNear(sim: Simulation, x: number, y: number, r: number): { feud: Feud; side: 0 | 1 } | null {
    let best: { feud: Feud; side: 0 | 1 } | null = null, bd = r;
    for (const f of this.feuds) {
      if (f.state !== "on") continue;
      for (const side of [0, 1] as const) {
        const c = sim.chars[side ? f.b : f.a];
        if (!c || c.inside >= 0 || c.inCar >= 0) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = { feud: f, side }; }
      }
    }
    return best;
  }

  private startFeud(sim: Simulation): void {
    if (this.feuds.filter((f) => f.state === "on").length >= 2) return;
    const busy = new Set(this.feuds.filter((f) => f.state === "on").flatMap((f) => [f.a, f.b]));
    const pool = sim.chars.filter((c) => c.tier !== "player" && c.tier !== "background" && c.home >= 0 && c.role !== "cop" && !busy.has(c.id));
    if (pool.length < 2) return;
    const a = this.rng.pick(pool), ha = this.world.buildings[a.home];
    const near = pool.filter((c) => c !== a && c.id !== a.partner && c.home !== a.home && Math.hypot(this.world.buildings[c.home].door.x - ha.door.x, this.world.buildings[c.home].door.y - ha.door.y) < 16);
    if (!near.length) return;
    const b = this.rng.pick(near);
    this.feuds.push({ id: this.nextId++, a: a.id, b: b.id, reason: this.rng.int(0, REASONS.length - 1), stage: 0, next: sim.tick + STAGE_TICKS, heard: [false, false], state: "on", bark: 0 });
  }

  private feudsTick(sim: Simulation): void {
    const p = sim.player;
    if (sim.tick % 1800 === 0 && sim.tick > 0 && this.rng.chance(0.55)) this.startFeud(sim);
    for (const f of this.feuds) {
      if (f.state !== "on") continue;
      const a = sim.chars[f.a], b = sim.chars[f.b];
      if (sim.tick >= f.next) { f.stage++; f.next = sim.tick + STAGE_TICKS; this.escalate(sim, f, a, b); }
      if (f.state !== "on") continue;
      // barks the player can overhear
      if (sim.tick % 600 === 0) {
        const who = f.bark++ % 2 ? b : a;
        if (who.inside < 0 && who.inCar < 0 && Math.hypot(who.x - p.x, who.y - p.y) < 16) {
          const line = this.rng.pick(TIERS[Math.min(2, Math.floor(f.stage / 2))]).replace("{t}", REASONS[f.reason]);
          sim.say(who, line, f.stage >= 2 ? "shout" : "say", 3.2);
          if (f.stage >= 2) sim.emitArgument(a, b, null);
        }
      }
    }
    this.feuds = this.feuds.filter((f) => f.state === "on" || sim.tick - f.next < 3 * TICKS_PER_HOUR + STAGE_TICKS);
  }

  private escalate(sim: Simulation, f: Feud, a: Character, b: Character): void {
    const mess = (to: Character) => { const bl = this.world.buildings[to.home]; if (bl) sim.litter.add(this.rng.pick(["wrapper", "cup", "can"] as const), bl.door.x + this.rng.range(-1.5, 2), bl.door.y + this.rng.range(1, 2.2)); };
    for (const c of [a, b]) { c.emo.frustration = Math.min(1, c.emo.frustration + 0.18); c.emo.mood = Math.max(-1, c.emo.mood - 0.12); }
    const ra = sim.relate(a, b.id), rb = sim.relate(b, a.id);
    ra.rivalry = Math.min(1, ra.rivalry + 0.15); rb.rivalry = Math.min(1, rb.rivalry + 0.15);
    ra.grudge = Math.min(1, ra.grudge + 0.15); rb.grudge = Math.min(1, rb.grudge + 0.15);
    if (f.stage >= 1) { mess(a); mess(b); }
    if (f.stage >= 3) { mess(a); mess(b); }
    if (f.stage >= 5) {
      f.state = "brawl";
      forceGoal(a, sim, "fight", { u: 1, target: b.id }); forceGoal(b, sim, "fight", { u: 1, target: a.id });
      sim.emitArgument(a, b, null);
      this.notes.push({ text: `${a.name.split(" ")[0]} and ${b.name.split(" ")[0]} had a bust-up over ${REASONS[f.reason]}.`, kind: "red" });
    }
  }

  /** Sit down with one side of a feud. Hearing both out is what makes a truce possible. */
  hearOut(sim: Simulation, f: Feud, side: 0 | 1): string {
    f.heard[side] = true;
    f.next += TICKS_PER_HOUR; // you're keeping them talking, not shouting
    const c = sim.chars[side ? f.b : f.a];
    const lines = [`"It's not the ${REASONS[f.reason]} itself. It's the principle."`, `"Years I've put up with ${REASONS[f.reason]}. Years."`, `"I just want a bit of respect over ${REASONS[f.reason]}, bro."`];
    const line = this.rng.pick(lines);
    sim.say(c, line.replace(/"/g, ""), "say", 3);
    return line;
  }

  /** Bring them together. Needs both sides heard; pays the player and cools the grudge. */
  brokerTruce(sim: Simulation, f: Feud): number {
    if (!f.heard[0] || !f.heard[1] || f.state !== "on") return 0;
    const a = sim.chars[f.a], b = sim.chars[f.b], p = sim.player;
    for (const [x, y] of [[a, b], [b, a]] as const) {
      applyInteraction(x, y, "helped", true, sim.tick, 1.6);
      const r = sim.relate(x, y.id); r.grudge *= 0.2; r.rivalry *= 0.25; r.aff = Math.min(1, r.aff + 0.25);
      applyInteraction(x, p, "helped", true, sim.tick, 1.5);
      x.emo.frustration = Math.max(0, x.emo.frustration - 0.4); x.emo.mood = Math.min(1, x.emo.mood + 0.25);
    }
    sim.say(a, this.rng.pick(TRUCE_LINES), "say", 3); sim.say(b, this.rng.pick(TRUCE_LINES), "say", 3);
    f.state = "truce"; f.next = sim.tick; this.truces++;
    const reward = 40 + f.stage * 25;
    p.cash += reward; p.reputation = Math.min(1, p.reputation + 0.04);
    return reward;
  }

  /* ---------------------------------------------------------------- coop */
  atLadder(x: number, y: number): boolean { const f = this.ladderFoot(); return !!f && Math.hypot(f.x - x, f.y - y) < 1.6; }
  nearKiosk(x: number, y: number): boolean { return !!this.kiosk && Math.hypot(this.kiosk.x - x, this.kiosk.y - y) < 1.6; }

  fillFeeder(sim: Simulation): boolean {
    const p = sim.player, c = this.coop;
    if (!c || p.cash < FEEDER_PRICE) return false;
    p.cash -= FEEDER_PRICE; c.fedUntil = sim.tick + 36 * TICKS_PER_HOUR;
    return true;
  }

  private coopTick(sim: Simulation): void {
    const c = this.coop;
    if (!c || sim.tick >= c.fedUntil) return;
    // a full feeder tempts wild birds to move in
    if (this.pets().length < this.petCap && this.rng.chance(0.4)) {
      const wild = this.pigeons.filter((b) => !b.pet);
      if (wild.length) { const b = this.rng.pick(wild); this.adopt(b); this.notes.push({ text: `A new lodger moved into the coop: ${b.name}.`, kind: "" }); }
    }
  }

  /** Keep a few wild birds about the streets. */
  private topUp(): void {
    const wild = this.pigeons.filter((b) => !b.pet);
    if (wild.length >= 6) return;
    const plaza = this.world.areas.find((x) => x.kind === "plaza"); if (!plaza) return;
    const s = this.spotNear(plaza.cx, plaza.cy, 10);
    this.spawnWild(s.x, s.y, s.x, s.y);
  }

  update(sim: Simulation): void {
    if (sim.tick % 3 === 0) { this.hash.clear(); for (const c of sim.chars) if (c.inside < 0 && c.inCar < 0 && c.lod < 3) this.hash.insert(c.id, c.x, c.y); }
    this.step(sim);
    if (sim.tick % 20 === 0) this.trackRoute(sim);
    if (sim.tick % 30 === 0) this.fortunesTick(sim);
    if (sim.tick % 60 === 0) this.feudsTick(sim);
    if (sim.tick % TICKS_PER_HOUR === 0) { this.coopTick(sim); this.topUp(); }
  }
}

export function updateStories(sim: Simulation): void { sim.stories.update(sim); }

/* ------------------------------------------------------------------ saving */
export function serializeStories(st: StoriesState): SavedStories {
  const route: [number, number, number][] = [];
  for (const [a, m] of st.route) for (const [b, n] of m) route.push([a, b, n]);
  return {
    rng: st.rng.getState(), kiosk: st.kiosk && { ...st.kiosk }, coop: st.coop && { ...st.coop }, pigeons: st.pigeons.map((p) => ({ ...p })),
    fortunes: st.fortunes.map((f) => ({ ...f })), drops: st.drops.map((d) => ({ ...d })), feuds: st.feuds.map((f) => ({ ...f, heard: [...f.heard] as [boolean, boolean] })), route, truces: st.truces, nextId: st.nextId,
  };
}
export function restoreStories(st: StoriesState, d: SavedStories): void {
  st.rng.setState(d.rng as [number, number, number, number]);
  st.kiosk = d.kiosk; st.coop = d.coop;
  st.pigeons = d.pigeons.map((p) => ({ ...p }));
  st.fortunes = d.fortunes.map((f) => ({ ...f })); st.drops = d.drops.map((x) => ({ ...x }));
  st.feuds = d.feuds.map((f) => ({ ...f, heard: [...f.heard] as [boolean, boolean] }));
  st.route = new Map();
  for (const [a, b, n] of d.route) { let m = st.route.get(a); if (!m) { m = new Map(); st.route.set(a, m); } m.set(b, n); }
  st.truces = d.truces; st.nextId = d.nextId; st.lastCell = -1;
}
