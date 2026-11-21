/**
 * AMBIENT LIFE ENGINE
 * ---------------------------------------------------------------------------
 * The invisible layer under your open world: the leaf that skitters past your
 * boots, the paper cup tumbling down the street, the cat that watches you from
 * a fence, the shutter that bangs only when the gust actually arrives.
 *
 * It is renderer-agnostic. You give it a WorldContext (questions about the
 * world) and an AmbientHost (where cues go). It decides WHAT happens, WHEN,
 * and WHERE, and emits Cues (sounds, props, critters, particles, lights).
 *
 * Design pillars
 *  1. ONE WIND. Debris, fixtures, trees, dust devils and gust sweeps all read
 *     the same travelling gust field, so the world reacts coherently.
 *  2. PERSISTENCE. Things that blow past come to rest as litter, stay in the
 *     world, get woken by later gusts, and get kicked by the player's boots.
 *  3. A DIRECTOR. Poisson pacing, variety penalties, quiet-after-burst,
 *     stillness rewards (animals show up when you stand still), and zero
 *     events during combat or dialogue.
 *  4. DATA-DRIVEN. Add a new event by pushing an EventDef into the catalog.
 *
 * Coordinates: Y is up. Units are metres and seconds. wind.windDir is the
 * horizontal unit vector the wind blows TOWARD.
 */

/* =============================== MATH ==================================== */

export interface Vec3 { x: number; y: number; z: number }

export const V = {
  make: (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z }),
  add: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  len: (a: Vec3): number => Math.hypot(a.x, a.y, a.z),
  lenXZ: (a: Vec3): number => Math.hypot(a.x, a.z),
  dist: (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  distXZ: (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z),
  normXZ: (a: Vec3): Vec3 => { const l = Math.hypot(a.x, a.z) || 1; return { x: a.x / l, y: 0, z: a.z / l }; },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }),
  copy: (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z }),
};

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Seeded RNG (mulberry32) so a given seed always replays the same world life. */
export class Rng {
  private s: number;
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  exp(mean: number) { return -Math.log(1 - this.next()) * mean; }
  weighted<T>(items: readonly T[], weights: readonly number[]): T | null {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

function hash1(i: number, seed: number): number {
  let x = (Math.imul(i, 374761393) + Math.imul(seed, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, seed: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

/* ============================ WORLD VOCAB ================================ */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Biome = 'street' | 'alley' | 'plaza' | 'suburb' | 'park' | 'forest' | 'meadow'
  | 'beach' | 'industrial' | 'farm' | 'interior';
export type Surface = 'asphalt' | 'concrete' | 'grass' | 'dirt' | 'gravel' | 'sand' | 'wood'
  | 'metal' | 'water' | 'leaves' | 'snow';
export type PlayerState = 'idle' | 'walking' | 'running' | 'sneaking' | 'driving' | 'combat' | 'dialogue';

/** Things in the world events can hook onto. Your level data / chunk system supplies these. */
export type AnchorTag = 'tree' | 'bush' | 'bin' | 'door' | 'window' | 'lamp' | 'roof' | 'gutter'
  | 'fence' | 'car' | 'bench' | 'shutter' | 'gate' | 'sign' | 'chime' | 'flag' | 'power_line'
  | 'road' | 'bell_tower' | 'puddle' | 'water';

export interface Anchor {
  id: string;
  tag: AnchorTag;
  pos: Vec3;
  dir?: Vec3;      // e.g. direction of travel for 'road'
  height?: number; // e.g. tree height, fence height
}

export interface Weather {
  rain: number;        // 0..1
  wetness: number;     // 0..1 how wet surfaces still are (lags behind rain)
  windSpeed: number;   // m/s base wind
  windDir: Vec3;       // horizontal unit vector, direction wind blows toward
  gustiness: number;   // 0..1
  temperature: number; // Celsius
  cloud: number;       // 0..1
  fog: number;         // 0..1
}

export interface PlayerInfo {
  pos: Vec3;
  vel: Vec3;
  forward: Vec3;       // horizontal facing
  state: PlayerState;
  stillFor: number;    // seconds since last meaningful movement
  noise: number;       // 0..1 how loud the player currently is
}

/** Everything the engine needs to ask of your game. Implement once. */
export interface WorldContext {
  time: number;        // monotonically increasing sim seconds
  hour: number;        // 0..24
  season: Season;
  weather: Weather;
  player: PlayerInfo;
  biomeAt(p: Vec3): Biome;
  surfaceAt(p: Vec3): Surface;
  groundY(x: number, z: number): number;
  isIndoors(p: Vec3): boolean;
  isVisible(p: Vec3): boolean; // in the player's view right now
  anchorsNear(tag: AnchorTag, center: Vec3, radius: number, max: number): Anchor[];
}

/* =============================== CUES ==================================== */

/** What the engine tells your game to do. Map these onto your audio/render/AI. */
export type Cue =
  | { kind: 'sound'; id: string; pos: Vec3; volume: number; pitch?: number; muffled?: boolean; moveTo?: Vec3; duration?: number }
  | { kind: 'loop'; handle: number; id: string; pos: Vec3; volume: number; action: 'start' | 'set' | 'stop' }
  | { kind: 'particles'; preset: string; pos: Vec3; dir?: Vec3; intensity: number; duration: number }
  | { kind: 'prop'; handle: number; prop: string; action: 'spawn' | 'update' | 'despawn'; pos: Vec3; rotation: Vec3; scale: number }
  | { kind: 'critter'; handle: number; species: string; action: 'spawn' | 'moveTo' | 'orbit' | 'anim' | 'despawn'; pos: Vec3; target?: Vec3; speed?: number; anim?: string; radius?: number }
  | { kind: 'anchorAnim'; anchorId: string; anim: string; intensity: number }
  | { kind: 'light'; anchorId: string; mode: 'on' | 'off' | 'flicker'; duration?: number }
  | { kind: 'stimulus'; pos: Vec3; type: 'noise' | 'sight'; loudness: number }
  | { kind: 'litter'; handle: number; prop: string; action: 'add' | 'remove'; pos: Vec3; rotation: Vec3 };

export interface AmbientHost { emit(cue: Cue): void }

/* ============================== WIND FIELD =============================== */

/**
 * Gust fronts travel downwind across the world as 1D value-noise waves along
 * the wind axis. Two points on the same front feel the same gust at the same
 * instant, so a leaf, a shutter and a tree 30m apart react in a believable
 * order as the gust rolls through.
 */
export class WindField {
  constructor(private seed = 1337) {}

  /** 0..1 gust intensity at a point. */
  gust(pos: Vec3, t: number, w: Weather): number {
    const along = pos.x * w.windDir.x + pos.z * w.windDir.z;
    const phase = along * 0.06 - t * (0.35 + 0.12 * w.windSpeed);
    const a = vnoise(phase, this.seed);
    const b = vnoise(phase * 3.3 + 41.7, this.seed + 1);
    const g = clamp((a * 0.7 + b * 0.3 - 0.35) / 0.5, 0, 1);
    return g * g * clamp(w.gustiness, 0, 1);
  }

  /** Full wind vector (m/s) at a point. */
  sample(pos: Vec3, t: number, w: Weather): Vec3 {
    const along = pos.x * w.windDir.x + pos.z * w.windDir.z;
    const g = this.gust(pos, t, w);
    const lull = vnoise(t * 0.2 + pos.x * 0.01, this.seed + 5);
    const speed = w.windSpeed * (0.45 + 0.35 * lull + 0.9 * g);
    const ang = (vnoise(t * 0.25 + along * 0.02, this.seed + 2) - 0.5) * 0.9;
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = w.windDir.x * c - w.windDir.z * s;
    const dz = w.windDir.x * s + w.windDir.z * c;
    const vy = (vnoise(t * 1.7 + pos.x * 0.13 + pos.z * 0.11, this.seed + 3) - 0.5) * speed * 0.6 + g * speed * 0.25;
    return { x: dx * speed, y: vy, z: dz * speed };
  }
}

/* ========================= EVENT / INSTANCE TYPES ======================== */

export interface Env {
  ctx: WorldContext;
  rng: Rng;
  wind: WindField;
  emit: (c: Cue) => void;
  engine: AmbientEngine;
}

/** A live, running event. Return false from update() when finished. */
export interface EventInstance {
  readonly defId: string;
  update(dt: number, env: Env): boolean;
  dispose?(env: Env): void;
}

export type EventCategory = 'debris' | 'critter' | 'sound' | 'structure' | 'human' | 'weather' | 'light';

export interface EventDef {
  id: string;
  category: EventCategory;
  weight: number;                          // base likelihood
  cooldown: number;                        // seconds before this can fire again
  tense?: boolean;                         // unsettling; can be disabled globally
  modifier?: (ctx: WorldContext) => number; // 0 = not eligible right now
  spawn: (env: Env) => EventInstance | EventInstance[] | null;
}

/* ============================== SMALL HELPERS ============================ */

const snd = (e: Env, id: string, pos: Vec3, volume = 1, pitch = 1, extra: object = {}) =>
  e.emit({ kind: 'sound', id, pos, volume, pitch, ...extra } as Cue);

const isNight = (h: number) => h >= 20.5 || h < 5.5;
const isDay = (h: number) => h >= 7 && h < 18.5;
const inB = (c: WorldContext, ...b: Biome[]) => b.includes(c.biomeAt(c.player.pos));
const hasNear = (c: WorldContext, tag: AnchorTag, r: number) => c.anchorsNear(tag, c.player.pos, r, 1).length > 0;
const seasonW = (c: WorldContext, sp: number, su: number, au: number, wi: number) =>
  ({ spring: sp, summer: su, autumn: au, winter: wi }[c.season]);
const snap = (c: WorldContext, p: Vec3, lift = 0): Vec3 => ({ x: p.x, y: c.groundY(p.x, p.z) + lift, z: p.z });
const awayFrom = (from: Vec3, origin: Vec3): Vec3 => {
  const d = V.normXZ(V.sub(from, origin));
  return (d.x === 0 && d.z === 0) ? { x: 1, y: 0, z: 0 } : d;
};

/** An instance driven by a closure. fn(dt, env, age) -> keepAlive. */
const proc = (defId: string, fn: (dt: number, env: Env, age: number) => boolean, end?: (env: Env) => void): EventInstance => {
  let age = 0;
  return { defId, update(dt, env) { age += dt; return fn(dt, env, age); }, dispose: end };
};

/** An instance that fires steps at fixed times: [[seconds, fn], ...]. */
const timeline = (defId: string, steps: [number, (e: Env) => void][], tail = 0.5): EventInstance => {
  const s = [...steps].sort((a, b) => a[0] - b[0]);
  let i = 0;
  const end = (s.length ? s[s.length - 1][0] : 0) + tail;
  return proc(defId, (_dt, env, age) => {
    while (i < s.length && s[i][0] <= age) { s[i][1](env); i++; }
    return age < end;
  });
};

/** Spawns a critter that dashes somewhere and vanishes. Returns its handle. */
function dash(env: Env, species: string, from: Vec3, dist: number, speed: number, anim = 'run', away = true): number {
  const h = env.engine.nextHandle();
  const dir = away ? awayFrom(from, env.ctx.player.pos)
    : V.normXZ({ x: env.rng.range(-1, 1), y: 0, z: env.rng.range(-1, 1) });
  const target = snap(env.ctx, V.add(from, V.scale(dir, dist)));
  env.emit({ kind: 'critter', handle: h, species, action: 'spawn', pos: from, anim: 'idle' });
  env.emit({ kind: 'critter', handle: h, species, action: 'moveTo', pos: from, target, speed, anim });
  env.engine.later(dist / speed + 0.4, e => e.emit({ kind: 'critter', handle: h, species, action: 'despawn', pos: target }));
  return h;
}

/** A songbird bursts out of cover: wing clatter, a few leaves, an alarm call. */
function flushBird(env: Env, pos: Vec3) {
  const h = env.engine.nextHandle();
  const up = V.add(pos, { x: 0, y: 0.6, z: 0 });
  const dir = awayFrom(pos, env.ctx.player.pos);
  const target = V.add(up, { x: dir.x * 26 + env.rng.range(-6, 6), y: 11, z: dir.z * 26 + env.rng.range(-6, 6) });
  snd(env, 'critter.bird.flush', pos, 0.8, env.rng.range(0.9, 1.15));
  env.emit({ kind: 'particles', preset: 'leaf_burst', pos, intensity: 0.4, duration: 0.8 });
  env.emit({ kind: 'critter', handle: h, species: 'songbird', action: 'spawn', pos: up, anim: 'takeoff' });
  env.emit({ kind: 'critter', handle: h, species: 'songbird', action: 'moveTo', pos: up, target, speed: 8, anim: 'fly' });
  env.emit({ kind: 'stimulus', pos, type: 'noise', loudness: 0.1 });
  env.engine.later(1.2, e => snd(e, 'critter.songbird.alarm', target, 0.6));
  env.engine.later(4, e => e.emit({ kind: 'critter', handle: h, species: 'songbird', action: 'despawn', pos: target }));
}

/* ============================ DEBRIS PHYSICS ============================= */

interface DebrisType {
  id: string; prop: string;
  drag: number;       // aerodynamic responsiveness. Higher = follows wind more closely.
  buoyancy: number;   // 0 normal gravity; >1 floats upward (balloon)
  radius: number;     // resting height above ground
  bounce: number; friction: number;
  liftoff: number;    // wind speed (m/s) needed to move it from rest
  kick: number;       // upward kick on gusts while on the ground
  tumble: number;     // spin rate multiplier
  rolls: boolean;     // rolls (cup, can) vs flutters (leaf, paper)
  loud: number;       // impact loudness scale
  stepLen: number;    // metres between scrape/roll sound ticks
  maxAge: number;     // seconds before it quietly despawns if still airborne
  soggy: boolean;     // wet weather pins it down
}

export const DEBRIS: Record<string, DebrisType> = {
  leaf:       { id: 'leaf',       prop: 'prop_leaf',       drag: 1.6,  buoyancy: 0,    radius: 0.03, bounce: 0.25, friction: 3.5, liftoff: 2.2, kick: 1.6, tumble: 6, rolls: false, loud: 0.12, stepLen: 0.8,  maxAge: 90,  soggy: true },
  cup:        { id: 'cup',        prop: 'prop_paper_cup',  drag: 0.5,  buoyancy: 0,    radius: 0.05, bounce: 0.45, friction: 0.8, liftoff: 3.0, kick: 1.5, tumble: 3, rolls: true,  loud: 0.5,  stepLen: 0.55, maxAge: 80,  soggy: true },
  bag:        { id: 'bag',        prop: 'prop_plastic_bag',drag: 1.3,  buoyancy: 0.05, radius: 0.12, bounce: 0.2,  friction: 2.5, liftoff: 2.0, kick: 3.5, tumble: 2, rolls: false, loud: 0.15, stepLen: 1.2,  maxAge: 120, soggy: false },
  newspaper:  { id: 'newspaper',  prop: 'prop_newspaper',  drag: 1.0,  buoyancy: 0,    radius: 0.04, bounce: 0.15, friction: 4.0, liftoff: 2.8, kick: 2.2, tumble: 4, rolls: false, loud: 0.2,  stepLen: 1.0,  maxAge: 100, soggy: true },
  wrapper:    { id: 'wrapper',    prop: 'prop_crisp_packet',drag: 1.4, buoyancy: 0,    radius: 0.03, bounce: 0.3,  friction: 3.0, liftoff: 2.0, kick: 2.0, tumble: 7, rolls: false, loud: 0.25, stepLen: 0.7,  maxAge: 90,  soggy: false },
  can:        { id: 'can',        prop: 'prop_tin_can',    drag: 0.12, buoyancy: 0,    radius: 0.04, bounce: 0.5,  friction: 0.6, liftoff: 5.0, kick: 0.8, tumble: 2, rolls: true,  loud: 0.9,  stepLen: 0.4,  maxAge: 70,  soggy: false },
  feather:    { id: 'feather',    prop: 'prop_feather',    drag: 2.4,  buoyancy: 0.02, radius: 0.01, bounce: 0,    friction: 6.0, liftoff: 1.2, kick: 1.2, tumble: 3, rolls: false, loud: 0.02, stepLen: 9,    maxAge: 110, soggy: true },
  fluff:      { id: 'fluff',      prop: 'prop_seed_fluff', drag: 3.0,  buoyancy: 0.08, radius: 0.01, bounce: 0,    friction: 6.0, liftoff: 0.8, kick: 0.8, tumble: 1, rolls: false, loud: 0,    stepLen: 99,   maxAge: 120, soggy: true },
  tumbleweed: { id: 'tumbleweed', prop: 'prop_tumbleweed', drag: 0.25, buoyancy: 0,    radius: 0.35, bounce: 0.5,  friction: 0.15,liftoff: 4.5, kick: 2.0, tumble: 1, rolls: true,  loud: 0.3,  stepLen: 1.2,  maxAge: 150, soggy: false },
  balloon:    { id: 'balloon',    prop: 'prop_balloon',    drag: 0.9,  buoyancy: 1.12, radius: 0.15, bounce: 0.6,  friction: 1.0, liftoff: 99,  kick: 0,   tumble: 1, rolls: false, loud: 0.05, stepLen: 99,   maxAge: 140, soggy: false },
};

class DebrisInstance implements EventInstance {
  readonly defId: string;
  private handle: number;
  private pos: Vec3; private vel: Vec3;
  private rot: Vec3 = V.make(); private spin: Vec3;
  private age = 0; private restT = 0; private stepAcc = 0; private done = false;

  constructor(private T: DebrisType, pos: Vec3, vel: Vec3, env: Env) {
    this.defId = `debris.${T.id}`;
    this.handle = env.engine.nextHandle();
    this.pos = V.copy(pos); this.vel = V.copy(vel);
    this.rot = V.make(env.rng.range(0, TAU), env.rng.range(0, TAU), env.rng.range(0, TAU));
    this.spin = V.make(env.rng.range(-1, 1), env.rng.range(-1, 1), env.rng.range(-1, 1));
    env.emit({ kind: 'prop', handle: this.handle, prop: T.prop, action: 'spawn', pos: this.pos, rotation: this.rot, scale: env.rng.range(0.85, 1.15) });
  }

  update(dtRaw: number, env: Env): boolean {
    const dt = Math.min(dtRaw, 0.05);
    const { ctx, wind, rng } = env, T = this.T;
    this.age += dt;

    const w = wind.sample(this.pos, ctx.time, ctx.weather);
    const gust = wind.gust(this.pos, ctx.time, ctx.weather);
    const rel = V.sub(w, this.vel);
    const relSpd = V.len(rel);

    // Aerodynamic drag toward the moving air, plus (buoyancy-scaled) gravity.
    const k = Math.min(T.drag * relSpd * dt, 0.9);
    this.vel.x += rel.x * k; this.vel.y += rel.y * k; this.vel.z += rel.z * k;
    this.vel.y -= 9.81 * (1 - T.buoyancy) * dt;

    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.pos.z += this.vel.z * dt;

    const floorY = ctx.groundY(this.pos.x, this.pos.z) + T.radius;
    const speedXZ = Math.hypot(this.vel.x, this.vel.z);
    let grounded = false;

    if (this.pos.y <= floorY) {
      grounded = true;
      const impact = -this.vel.y;
      this.pos.y = floorY;
      if (impact > 0.6) {
        snd(env, `debris.${T.id}.${ctx.surfaceAt(this.pos)}.impact`, this.pos, clamp(impact * T.loud, 0.02, 1), rng.range(0.9, 1.1));
        this.vel.y = impact * T.bounce * rng.range(0.6, 1.1);
      } else this.vel.y = 0;

      const f = Math.exp(-T.friction * dt);
      this.vel.x *= f; this.vel.z *= f;

      // Gusts kick things back into the air. Wet weather pins soggy things down.
      const wetPin = T.soggy && ctx.weather.wetness > 0.5 ? 0.25 : 1;
      if (relSpd > T.liftoff && rng.chance(dt * (1 + gust * 3) * wetPin)) {
        this.vel.y += T.kick * rng.range(0.5, 1.5) * (0.4 + gust);
        this.spin = V.make(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
      }

      // Scrape / roll ticks: the rhythmic "tink-tink-tink" of a cup on asphalt.
      this.stepAcc += speedXZ * dt;
      if (speedXZ > 0.25 && this.stepAcc > T.stepLen) {
        this.stepAcc = 0;
        const kind = T.rolls ? 'roll' : 'scrape';
        snd(env, `debris.${T.id}.${ctx.surfaceAt(this.pos)}.${kind}`, this.pos, clamp(speedXZ * T.loud * 0.4, 0.03, 0.8), rng.range(0.9, 1.1));
        if (T.loud > 0.8) env.emit({ kind: 'stimulus', pos: this.pos, type: 'noise', loudness: 0.1 });
      }
      if (T.rolls) { this.rot.x += (speedXZ / T.radius) * dt; this.rot.y = Math.atan2(this.vel.x, this.vel.z); }
      else { const s = T.tumble * clamp(speedXZ * 0.4, 0, 1) * dt; this.rot.x += this.spin.x * s; this.rot.z += this.spin.z * s; this.rot.y += this.spin.y * s; }
    } else if (!T.rolls || T.buoyancy > 0.5) {
      const s = T.tumble * clamp(relSpd * 0.5, 0.2, 2) * dt;
      this.rot.x += this.spin.x * s; this.rot.y += this.spin.y * s; this.rot.z += this.spin.z * s;
    } else {
      this.rot.x += this.spin.x * T.tumble * dt;
    }

    // Come to rest and become persistent litter in the world.
    const restWind = relSpd < T.liftoff * 0.8;
    if (grounded && T.buoyancy < 1 && speedXZ < 0.12 && restWind) this.restT += dt; else this.restT = 0;
    if (this.restT > 1.2) {
      env.emit({ kind: 'prop', handle: this.handle, prop: T.prop, action: 'despawn', pos: this.pos, rotation: this.rot, scale: 1 });
      env.engine.addLitter(T.id, this.pos, this.rot);
      this.done = true;
      return false;
    }

    const far = V.dist(this.pos, ctx.player.pos) > (T.buoyancy > 1 ? 140 : 90);
    if (far || this.age > T.maxAge) return false;

    env.emit({ kind: 'prop', handle: this.handle, prop: T.prop, action: 'update', pos: this.pos, rotation: this.rot, scale: 1 });
    return true;
  }

  dispose(env: Env) {
    if (!this.done) env.emit({ kind: 'prop', handle: this.handle, prop: this.T.prop, action: 'despawn', pos: this.pos, rotation: this.rot, scale: 1 });
  }

  /** Used by the litter system to launch a resting object. */
  static launch(typeId: string, pos: Vec3, vel: Vec3, env: Env): DebrisInstance {
    return new DebrisInstance(DEBRIS[typeId], V.add(pos, { x: 0, y: DEBRIS[typeId].radius + 0.02, z: 0 }), vel, env);
  }
}

/* ============================== EVENT CATALOG ============================ */

const debrisDef = (
  typeId: string,
  o: { weight: number; cooldown: number; count: [number, number]; mod: (c: WorldContext) => number; minWind?: number }
): EventDef => ({
  id: `debris.${typeId}`, category: 'debris', weight: o.weight, cooldown: o.cooldown,
  modifier: c => {
    const T = DEBRIS[typeId], ws = c.weather.windSpeed;
    if (ws < (o.minWind ?? T.liftoff * 0.5)) return 0;
    const wet = T.soggy && c.weather.rain > 0.3 ? 0.2 : 1;
    return o.mod(c) * clamp(ws / (T.liftoff * 1.5), 0.2, 2) * wet;
  },
  spawn: env => {
    const n = env.rng.int(o.count[0], o.count[1]);
    const base = env.engine.placeCrossing(env, 10, 26, 7);
    const out: EventInstance[] = [];
    for (let i = 0; i < n; i++) {
      const p = { x: base.x + env.rng.range(-2.5, 2.5), y: 0, z: base.z + env.rng.range(-2.5, 2.5) };
      p.y = env.ctx.groundY(p.x, p.z) + DEBRIS[typeId].radius + env.rng.range(0, 0.6);
      out.push(DebrisInstance.launch(typeId, p, V.scale(env.wind.sample(p, env.ctx.time, env.ctx.weather), 0.4), env));
    }
    return out;
  },
});

interface Fixture { tag: AnchorTag; minWind: number; sound: string; anim: string; weight: number }
const FIXTURES: Fixture[] = [
  { tag: 'shutter',    minWind: 4,   sound: 'fixture.shutter.bang',  anim: 'bang',   weight: 2 },
  { tag: 'gate',       minWind: 5,   sound: 'fixture.gate.rattle',   anim: 'rattle', weight: 1 },
  { tag: 'sign',       minWind: 3,   sound: 'fixture.sign.creak',    anim: 'swing',  weight: 2 },
  { tag: 'door',       minWind: 6,   sound: 'fixture.door.slam',     anim: 'slam',   weight: 0.7 },
  { tag: 'chime',      minWind: 1,   sound: 'fixture.chime.tinkle',  anim: 'swing',  weight: 2 },
  { tag: 'flag',       minWind: 2.5, sound: 'fixture.flag.snap',     anim: 'flap',   weight: 1.5 },
  { tag: 'power_line', minWind: 7,   sound: 'fixture.wire.whine',    anim: 'hum',    weight: 0.8 },
];

export function buildDefaultCatalog(): EventDef[] {
  const defs: EventDef[] = [];

  /* ---------- Wind-blown debris (physics-driven) ---------- */
  defs.push(
    debrisDef('leaf', { weight: 3, cooldown: 8, count: [1, 5], minWind: 1.2,
      mod: c => (hasNear(c, 'tree', 45) ? 1 : 0.15) * seasonW(c, 1, 0.8, 3, 0.4) * (inB(c, 'park', 'forest', 'street', 'suburb', 'plaza', 'meadow') ? 1 : 0.2) }),
    debrisDef('cup', { weight: 1.4, cooldown: 60, count: [1, 1],
      mod: c => inB(c, 'street', 'plaza', 'alley', 'park') ? (isDay(c.hour) ? 1.2 : 0.8) : 0.05 }),
    debrisDef('bag', { weight: 1.0, cooldown: 90, count: [1, 1],
      mod: c => inB(c, 'street', 'alley', 'plaza', 'industrial', 'beach') ? 1 : 0.1 }),
    debrisDef('newspaper', { weight: 1.0, cooldown: 90, count: [1, 2],
      mod: c => inB(c, 'street', 'plaza', 'suburb') ? 1 : 0.1 }),
    debrisDef('wrapper', { weight: 1.2, cooldown: 45, count: [1, 2],
      mod: c => inB(c, 'street', 'alley', 'plaza', 'park', 'beach') ? 1 : 0.1 }),
    debrisDef('can', { weight: 0.8, cooldown: 120, count: [1, 1], minWind: 3.5,
      mod: c => inB(c, 'alley', 'industrial', 'street') ? 1 : 0.05 }),
    debrisDef('feather', { weight: 0.8, cooldown: 60, count: [1, 2],
      mod: c => inB(c, 'park', 'meadow', 'beach', 'plaza', 'farm') ? 1 : 0.2 }),
    debrisDef('fluff', { weight: 1.5, cooldown: 40, count: [3, 9], minWind: 0.5,
      mod: c => seasonW(c, 2, 2.5, 0.1, 0) * (c.weather.rain < 0.05 ? 1 : 0) * (inB(c, 'park', 'meadow', 'suburb', 'farm') ? 1 : 0.1) }),
    debrisDef('tumbleweed', { weight: 0.5, cooldown: 240, count: [1, 1], minWind: 4.5,
      mod: c => inB(c, 'meadow', 'farm', 'industrial') && c.weather.wetness < 0.3 && c.weather.temperature > 12 ? 1 : 0 }),
    {
      id: 'debris.balloon', category: 'debris', weight: 0.35, cooldown: 600,
      modifier: c => isDay(c.hour) && c.weather.rain < 0.2 && inB(c, 'plaza', 'park', 'street') ? 1 : 0,
      spawn: env => {
        const p = env.engine.placeCrossing(env, 8, 18, 5); p.y += 2.2;
        return DebrisInstance.launch('balloon', p, V.scale(env.wind.sample(p, env.ctx.time, env.ctx.weather), 0.5), env);
      },
    },
  );

  /* ---------- Wind itself: a gust that sweeps through ---------- */
  defs.push({
    id: 'weather.gust_sweep', category: 'weather', weight: 2, cooldown: 25,
    modifier: c => c.weather.windSpeed >= 2 ? clamp(c.weather.windSpeed / 6, 0.3, 2) * (0.5 + c.weather.gustiness) : 0,
    spawn: env => {
      const wd = env.ctx.weather.windDir, pl = env.ctx.player.pos;
      const front = 55, speed = 5 + env.ctx.weather.windSpeed * 0.9;
      const start = V.add(pl, V.scale(wd, -front)), arrive = front / speed;
      const trees = env.ctx.anchorsNear('tree', pl, 30, 8);
      return timeline('weather.gust_sweep', [
        [0, e => snd(e, 'wind.gust.approach', start, 0.4, 1, { moveTo: pl, duration: arrive })],
        [arrive * 0.55, e => trees.forEach(t => e.emit({ kind: 'anchorAnim', anchorId: t.id, anim: 'sway', intensity: 0.7 }))],
        [arrive, e => {
          snd(e, 'wind.gust.through_foliage', pl, 0.7);
          e.emit({ kind: 'particles', preset: 'leaf_swirl', pos: V.add(pl, V.scale(wd, -2)), dir: wd, intensity: clamp(e.ctx.weather.windSpeed / 8, 0.2, 1), duration: 2.5 });
          e.engine.wakeLitterNear(pl, 14, 2.5 + e.ctx.weather.windSpeed * 0.3);
        }],
      ], 3);
    },
  });

  /* ---------- Things that sit in the world and react to the wind ---------- */
  defs.push({
    id: 'structure.wind_fixture', category: 'structure', weight: 2, cooldown: 20,
    modifier: c => c.weather.windSpeed >= 1 ? clamp(c.weather.windSpeed / 5, 0.3, 2) : 0,
    spawn: env => {
      const ws = env.ctx.weather.windSpeed;
      const options = FIXTURES.filter(f => ws >= f.minWind && hasNear(env.ctx, f.tag, 40));
      const fx = env.rng.weighted(options, options.map(o => o.weight));
      const a = fx && env.engine.pickAnchor(env, fx.tag, 3, 40);
      if (!fx || !a) return null;
      const life = env.rng.range(12, 40);
      let last = 0, prev = 0;
      return proc('structure.wind_fixture', (_dt, e, age) => {
        // Sounds fire when the actual gust field crosses a threshold at the fixture,
        // so rhythm follows the same gusts that push the leaves around.
        const g = e.wind.gust(a.pos, e.ctx.time, e.ctx.weather);
        if (g > 0.35 && prev <= 0.35 && age - last > 0.8) {
          last = age;
          const v = clamp(0.3 + g, 0.2, 1);
          snd(e, fx.sound, a.pos, v, e.rng.range(0.92, 1.08));
          e.emit({ kind: 'anchorAnim', anchorId: a.id, anim: fx.anim, intensity: g });
        }
        prev = g;
        return age < life && V.dist(e.ctx.player.pos, a.pos) < 70;
      });
    },
  });

  /* ---------- Cover, branches, nuts ---------- */
  defs.push(
    {
      id: 'critter.bush_rustle', category: 'critter', weight: 1.4, cooldown: 25,
      modifier: c => (inB(c, 'park', 'forest', 'meadow', 'suburb', 'farm') ? 1 : 0.1) * (c.weather.rain > 0.5 ? 0.3 : 1) * (isNight(c.hour) ? 0.5 : 1),
      spawn: env => {
        const b = env.engine.pickAnchor(env, 'bush', 4, 24);
        if (!b) return null;
        const rng = env.rng, dur = rng.range(1.2, 3.6);
        const outcome = rng.weighted(['nothing', 'bird', 'mouse', 'hedgehog'], [3, 3, 2, isNight(env.ctx.hour) ? 2 : 0])!;
        const steps: [number, (e: Env) => void][] = [];
        for (let t = 0; t < dur; t += rng.range(0.12, 0.45)) {
          const v = rng.range(0.2, 0.55);
          steps.push([t, e => { snd(e, 'foliage.bush.rustle', b.pos, v, rng.range(0.9, 1.1)); e.emit({ kind: 'anchorAnim', anchorId: b.id, anim: 'shake', intensity: v }); }]);
        }
        steps.push([dur, e => {
          const close = V.dist(e.ctx.player.pos, b.pos) < 5;
          if (outcome === 'bird' || (close && e.rng.chance(0.5))) flushBird(e, b.pos);
          else if (outcome === 'mouse') dash(e, 'mouse', b.pos, 5, 3.5);
          else if (outcome === 'hedgehog') dash(e, 'hedgehog', b.pos, 3, 0.9, 'waddle');
        }]);
        return timeline('critter.bush_rustle', steps, 1);
      },
    },
    {
      id: 'structure.acorn_drop', category: 'structure', weight: 1.2, cooldown: 30,
      modifier: c => (hasNear(c, 'tree', 25) ? 1 : 0) * seasonW(c, 0.4, 0.6, 2.5, 0.2) * (c.weather.windSpeed > 2 ? 1.4 : 1),
      spawn: env => {
        const t = env.engine.pickAnchor(env, 'tree', 4, 25);
        if (!t) return null;
        const h = t.height ?? 8, fall = Math.sqrt((2 * h) / 9.81) * 1.15;
        const hit = snap(env.ctx, V.add(t.pos, { x: env.rng.range(-2, 2), y: 0, z: env.rng.range(-2, 2) }));
        return timeline('structure.acorn_drop', [
          [0, e => { snd(e, 'foliage.twig.snap', t.pos, 0.3); e.emit({ kind: 'anchorAnim', anchorId: t.id, anim: 'shake', intensity: 0.25 }); }],
          [fall, e => {
            snd(e, `object.acorn.drop.${e.ctx.surfaceAt(hit)}`, hit, 0.45, e.rng.range(0.9, 1.15));
            e.emit({ kind: 'particles', preset: 'leaf_fall', pos: V.add(t.pos, { x: 0, y: h * 0.6, z: 0 }), intensity: 0.2, duration: 2 });
            if (e.rng.chance(0.25)) dash(e, 'squirrel', V.add(hit, { x: 3, y: 0, z: 0 }), 6, 5);
          }],
        ], 1);
      },
    },
    {
      id: 'structure.branch_fall', category: 'structure', weight: 0.6, cooldown: 180,
      modifier: c => c.weather.windSpeed >= 9 && hasNear(c, 'tree', 40) ? 1 : 0,
      spawn: env => {
        const t = env.engine.pickAnchor(env, 'tree', 10, 40);
        if (!t) return null;
        const ground = snap(env.ctx, t.pos);
        const steps: [number, (e: Env) => void][] = [];
        const n = env.rng.int(3, 6);
        for (let i = 0; i < n; i++) steps.push([i * 0.9, e => { snd(e, 'foliage.branch.creak', t.pos, 0.4 + i * 0.08); e.emit({ kind: 'anchorAnim', anchorId: t.id, anim: 'sway', intensity: 0.8 }); }]);
        steps.push([n * 0.9, e => snd(e, 'foliage.branch.crack', t.pos, 0.9)]);
        steps.push([n * 0.9 + 0.9, e => {
          snd(e, 'object.branch.crash', ground, 1);
          e.emit({ kind: 'particles', preset: 'leaf_burst', pos: ground, intensity: 1, duration: 1.5 });
          e.emit({ kind: 'stimulus', pos: ground, type: 'noise', loudness: 0.7 });
        }]);
        return timeline('structure.branch_fall', steps, 1);
      },
    },
    {
      id: 'weather.drips', category: 'weather', weight: 2, cooldown: 60,
      modifier: c => c.weather.wetness > 0.25 && c.weather.rain < 0.1 ? 1.5 * c.weather.wetness : 0,
      spawn: env => {
        const a = env.engine.pickAnchor(env, 'gutter', 2, 18) ?? env.engine.pickAnchor(env, 'roof', 2, 18) ?? env.engine.pickAnchor(env, 'tree', 2, 18);
        if (!a) return null;
        const life = env.rng.range(20, 45);
        let next = 0;
        return proc('weather.drips', (_dt, e, age) => {
          if (age >= next) {
            next = age + e.rng.range(0.5, 1.6) * (1 + age / 18);
            snd(e, `water.drip.${e.ctx.surfaceAt(snap(e.ctx, a.pos))}`, snap(e.ctx, a.pos), e.rng.range(0.15, 0.35), e.rng.range(0.85, 1.25));
          }
          return age < life;
        });
      },
    },
    {
      id: 'weather.distant_thunder', category: 'weather', weight: 1, cooldown: 90,
      modifier: c => c.weather.cloud > 0.7 && c.weather.rain > 0.2 ? 1.5 : 0,
      spawn: env => {
        const d = awayFrom(V.make(env.rng.range(-1, 1), 0, env.rng.range(-1, 1)), V.make());
        const p = V.add(env.ctx.player.pos, V.scale(d, env.rng.range(300, 900)));
        return timeline('weather.distant_thunder', [[0, e => snd(e, 'weather.thunder.distant', p, e.rng.range(0.3, 0.7))], [e_delay(env), e => snd(e, 'weather.thunder.rumble', p, 0.3)]], 5);
      },
    },
  );

  /* ---------- Animals ---------- */
  defs.push(
    {
      id: 'critter.squirrel_dash', category: 'critter', weight: 1.3, cooldown: 70,
      modifier: c => (isDay(c.hour) && c.weather.rain < 0.3 && inB(c, 'park', 'forest', 'suburb') && hasNear(c, 'tree', 30)) ? 1 : 0,
      spawn: env => {
        const tree = env.engine.pickAnchor(env, 'tree', 6, 30);
        if (!tree) return null;
        const pl = env.ctx.player;
        const start = snap(env.ctx, V.add(pl.pos, V.add(V.scale(pl.forward, env.rng.range(6, 10)), { x: env.rng.range(-5, 5), y: 0, z: env.rng.range(-5, 5) })));
        const base = snap(env.ctx, tree.pos), dist = V.distXZ(start, base), speed = 5.5, h = env.engine.nextHandle();
        return timeline('critter.squirrel_dash', [
          [0, e => { e.emit({ kind: 'critter', handle: h, species: 'squirrel', action: 'spawn', pos: start, anim: 'idle' }); e.emit({ kind: 'critter', handle: h, species: 'squirrel', action: 'moveTo', pos: start, target: base, speed, anim: 'bound' }); snd(e, `critter.squirrel.dash.${e.ctx.surfaceAt(start)}`, start, 0.3); }],
          [dist / speed, e => { e.emit({ kind: 'critter', handle: h, species: 'squirrel', action: 'anim', pos: base, anim: 'climb' }); snd(e, 'critter.squirrel.claws_bark', base, 0.5); }],
          [dist / speed + 1.2, e => snd(e, 'critter.squirrel.chatter', V.add(base, { x: 0, y: 4, z: 0 }), 0.6, e.rng.range(0.9, 1.2))],
          [dist / speed + 4, e => e.emit({ kind: 'critter', handle: h, species: 'squirrel', action: 'despawn', pos: base })],
        ], 0.5);
      },
    },
    {
      id: 'critter.pigeon_flock', category: 'critter', weight: 1.4, cooldown: 120,
      modifier: c => isDay(c.hour) && inB(c, 'plaza', 'street', 'park') ? 1.2 : 0,
      spawn: env => {
        const centre = env.engine.ringPoint(env, 9, 24, { biomes: ['plaza', 'street', 'park'] });
        if (!centre) return null;
        const n = env.rng.int(4, 9), birds: { h: number; p: Vec3 }[] = [];
        for (let i = 0; i < n; i++) {
          const p = snap(env.ctx, V.add(centre, { x: env.rng.range(-2, 2), y: 0, z: env.rng.range(-2, 2) }));
          const h = env.engine.nextHandle(); birds.push({ h, p });
          env.emit({ kind: 'critter', handle: h, species: 'pigeon', action: 'spawn', pos: p, anim: 'peck' });
        }
        const wait = env.rng.range(10, 25); let gone = false;
        return proc('critter.pigeon_flock', (_dt, e, age) => {
          if (age < 3 && e.rng.chance(0.02)) snd(e, 'critter.pigeon.coo', centre, 0.3);
          const d = V.dist(e.ctx.player.pos, centre);
          if (!gone && (d < 5 || (d < 9 && e.ctx.player.state === 'running') || age > wait)) {
            gone = true;
            snd(e, 'critter.pigeon.flock.takeoff', centre, 0.9);
            e.emit({ kind: 'particles', preset: 'feather_dust', pos: centre, intensity: 0.5, duration: 1.2 });
            for (const b of birds) {
              const dir = awayFrom(b.p, e.ctx.player.pos);
              const t = V.add(b.p, { x: dir.x * 24 + e.rng.range(-8, 8), y: e.rng.range(8, 16), z: dir.z * 24 + e.rng.range(-8, 8) });
              e.emit({ kind: 'critter', handle: b.h, species: 'pigeon', action: 'moveTo', pos: b.p, target: t, speed: e.rng.range(7, 10), anim: 'fly' });
              e.engine.later(4, ee => ee.emit({ kind: 'critter', handle: b.h, species: 'pigeon', action: 'despawn', pos: t }));
            }
            return false;
          }
          return age < wait + 1 && !gone;
        }, e => { /* flock already scheduled its own despawns */ void e; });
      },
    },
    {
      id: 'critter.cat_watcher', category: 'critter', weight: 1.1, cooldown: 150,
      modifier: c => inB(c, 'street', 'alley', 'suburb') ? (isNight(c.hour) ? 1.5 : 1) : 0,
      spawn: env => {
        const perch = env.engine.pickAnchor(env, 'fence', 6, 30) ?? env.engine.pickAnchor(env, 'bin', 6, 30) ?? env.engine.pickAnchor(env, 'car', 6, 30);
        if (!perch) return null;
        const h = env.engine.nextHandle(), pos = V.add(perch.pos, { x: 0, y: perch.height ?? 1, z: 0 });
        const wait = env.rng.range(8, 20); let fled = false;
        env.emit({ kind: 'critter', handle: h, species: 'cat', action: 'spawn', pos, anim: 'sit_watch' });
        return proc('critter.cat_watcher', (_dt, e, age) => {
          const d = V.dist(e.ctx.player.pos, pos);
          if (age > 3 && e.rng.chance(0.004)) snd(e, 'critter.cat.meow', pos, 0.4, e.rng.range(0.9, 1.15));
          if (d < 4.5 || age > wait || d > 80) {
            const dir = awayFrom(pos, e.ctx.player.pos), t = snap(e.ctx, V.add(pos, V.scale(dir, 10)));
            if (d < 3) snd(e, 'critter.cat.hiss', pos, 0.5);
            snd(e, 'critter.cat.thump_land', pos, 0.3);
            e.emit({ kind: 'critter', handle: h, species: 'cat', action: 'moveTo', pos, target: t, speed: 5.5, anim: 'run' });
            e.engine.later(3, ee => ee.emit({ kind: 'critter', handle: h, species: 'cat', action: 'despawn', pos: t }));
            fled = true; return false;
          }
          return true;
        }, e => { if (!fled) e.emit({ kind: 'critter', handle: h, species: 'cat', action: 'despawn', pos }); });
      },
    },
    {
      id: 'critter.alley_rat', category: 'critter', weight: 0.9, cooldown: 120, tense: true,
      modifier: c => inB(c, 'alley', 'industrial') && isNight(c.hour) ? 1.5 : 0,
      spawn: env => {
        const bin = env.engine.pickAnchor(env, 'bin', 4, 22);
        if (!bin) return null;
        return timeline('critter.alley_rat', [
          [0, e => snd(e, 'critter.rat.skitter', bin.pos, 0.35)],
          [0.9, e => { snd(e, 'object.bin.lid_rattle', bin.pos, 0.6); e.emit({ kind: 'anchorAnim', anchorId: bin.id, anim: 'rattle', intensity: 0.5 }); }],
          [1.8, e => { snd(e, 'object.bottle.clink', bin.pos, 0.5); snd(e, 'critter.rat.squeak', bin.pos, 0.3); }],
          [2.4, e => dash(e, 'rat', bin.pos, 7, 4.5)],
        ], 1);
      },
    },
    {
      id: 'sound.dog_bark_chain', category: 'sound', weight: 1.2, cooldown: 150,
      modifier: c => c.weather.rain < 0.5 && inB(c, 'suburb', 'street', 'farm', 'industrial') ? 1 : 0.1,
      spawn: env => {
        const p = env.engine.ringPoint(env, 70, 160, {}); if (!p) return null;
        const steps: [number, (e: Env) => void][] = []; let t = 0;
        const n = env.rng.int(2, 5);
        for (let i = 0; i < n; i++) { t += env.rng.range(0.4, 1.1); steps.push([t, e => snd(e, 'critter.dog.bark.distant', p, 0.5, e.rng.range(0.85, 1.1))]); }
        const q = V.add(p, { x: env.rng.range(-50, 50), y: 0, z: env.rng.range(-50, 50) });
        steps.push([t + env.rng.range(1, 3), e => snd(e, 'critter.dog.bark.distant', q, 0.35, e.rng.range(0.7, 0.95))]);
        return timeline('sound.dog_bark_chain', steps, 1);
      },
    },
    {
      id: 'sound.crow_caw', category: 'sound', weight: 1.2, cooldown: 90,
      modifier: c => isDay(c.hour) && inB(c, 'park', 'farm', 'meadow', 'street', 'forest') ? 1 : 0.1,
      spawn: env => {
        const p = env.engine.ringPoint(env, 25, 90, {}); if (!p) return null;
        const n = env.rng.int(1, 3), steps: [number, (e: Env) => void][] = [];
        for (let i = 0; i < n; i++) steps.push([i * env.rng.range(0.7, 1.2), e => snd(e, 'critter.crow.caw', V.add(p, { x: 0, y: 8, z: 0 }), 0.7, e.rng.range(0.9, 1.1))]);
        steps.push([n + 0.8, e => snd(e, 'critter.crow.wingbeat', V.add(p, { x: 0, y: 10, z: 0 }), 0.3)]);
        return timeline('sound.crow_caw', steps, 1);
      },
    },
    {
      id: 'sound.owl', category: 'sound', weight: 1.4, cooldown: 100,
      modifier: c => isNight(c.hour) && inB(c, 'forest', 'park', 'farm', 'meadow') ? 1.5 : 0,
      spawn: env => {
        const p = env.engine.ringPoint(env, 30, 100, {}); if (!p) return null;
        const hp = V.add(p, { x: 0, y: 9, z: 0 });
        return timeline('sound.owl', [[0, e => snd(e, 'critter.owl.hoo', hp, 0.7)], [0.55, e => snd(e, 'critter.owl.hoo', hp, 0.7)], [1.3, e => snd(e, 'critter.owl.hoo_long', hp, 0.8)],
          [env.rng.range(8, 14), e => snd(e, 'critter.owl.hoo_long', V.add(hp, { x: 40, y: 0, z: 20 }), 0.35)]], 1);
      },
    },
    {
      id: 'critter.insect_chorus', category: 'critter', weight: 1.6, cooldown: 120,
      modifier: c => (isNight(c.hour) || c.hour > 18) && c.weather.temperature > 12 && c.weather.rain < 0.2 && inB(c, 'meadow', 'park', 'forest', 'farm', 'suburb') ? 1.4 : 0,
      spawn: env => {
        const centre = env.engine.ringPoint(env, 14, 28, {}); if (!centre) return null;
        const h = env.engine.nextHandle(), life = env.rng.range(45, 100);
        let hush = 0;
        env.emit({ kind: 'loop', handle: h, id: 'critter.insects.chorus', pos: centre, volume: 0, action: 'start' });
        return proc('critter.insect_chorus', (dt, e, age) => {
          // Crickets go quiet as you get close, then recover slowly once you are still.
          const d = V.dist(e.ctx.player.pos, centre);
          if (d < 7 || e.ctx.player.noise > 0.7) hush = 1; else hush = Math.max(0, hush - dt / (e.ctx.player.stillFor > 3 ? 6 : 20));
          const env01 = Math.min(1, age / 6) * Math.min(1, (life - age) / 6);
          e.emit({ kind: 'loop', handle: h, id: 'critter.insects.chorus', pos: centre, volume: clamp(env01 * (1 - hush) * 0.5, 0, 1), action: 'set' });
          return age < life;
        }, e => e.emit({ kind: 'loop', handle: h, id: 'critter.insects.chorus', pos: centre, volume: 0, action: 'stop' }));
      },
    },
    {
      id: 'critter.frog', category: 'critter', weight: 1.0, cooldown: 90,
      modifier: c => (c.weather.temperature > 8 && hasNear(c, 'water', 40)) ? (isNight(c.hour) ? 1.5 : 0.4) : 0,
      spawn: env => {
        const w = env.engine.pickAnchor(env, 'water', 5, 40); if (!w) return null;
        const steps: [number, (e: Env) => void][] = [];
        for (let i = 0; i < env.rng.int(2, 4); i++) steps.push([i * env.rng.range(1, 1.8), e => snd(e, 'critter.frog.croak', w.pos, 0.5, e.rng.range(0.85, 1.15))]);
        steps.push([8, e => { if (V.dist(e.ctx.player.pos, w.pos) < 7) { snd(e, 'critter.frog.plop', w.pos, 0.7); e.emit({ kind: 'particles', preset: 'water_splash_small', pos: w.pos, intensity: 0.3, duration: 0.6 }); } }]);
        return timeline('critter.frog', steps, 1);
      },
    },
    {
      id: 'critter.butterfly', category: 'critter', weight: 1.0, cooldown: 120,
      modifier: c => isDay(c.hour) && c.weather.rain < 0.1 && c.weather.temperature > 14 && c.weather.windSpeed < 4 && inB(c, 'meadow', 'park', 'farm') ? seasonW(c, 1.5, 2, 0.3, 0) : 0,
      spawn: env => {
        const start = env.engine.ringPoint(env, 4, 12, {}); if (!start) return null;
        const h = env.engine.nextHandle(), life = env.rng.range(20, 40);
        let cur = snap(env.ctx, start, 1.2), nextWp = 0;
        env.emit({ kind: 'critter', handle: h, species: 'butterfly', action: 'spawn', pos: cur, anim: 'flutter' });
        return proc('critter.butterfly', (_dt, e, age) => {
          if (age >= nextWp) {
            nextWp = age + e.rng.range(1.2, 2.2);
            const t = snap(e.ctx, V.add(cur, { x: e.rng.range(-5, 5), y: 0, z: e.rng.range(-5, 5) }), e.rng.range(0.8, 2.2));
            e.emit({ kind: 'critter', handle: h, species: 'butterfly', action: 'moveTo', pos: cur, target: t, speed: 1.3, anim: 'flutter' });
            cur = t;
          }
          return age < life;
        }, e => e.emit({ kind: 'critter', handle: h, species: 'butterfly', action: 'despawn', pos: cur }));
      },
    },
    {
      id: 'critter.moth_lamp', category: 'critter', weight: 1.3, cooldown: 90,
      modifier: c => isNight(c.hour) && c.weather.rain < 0.1 && c.weather.temperature > 8 && hasNear(c, 'lamp', 35) ? 1.4 : 0,
      spawn: env => {
        const lamp = env.engine.pickAnchor(env, 'lamp', 3, 35); if (!lamp) return null;
        const h = env.engine.nextHandle(), top = V.add(lamp.pos, { x: 0, y: (lamp.height ?? 4) - 0.3, z: 0 }), life = env.rng.range(25, 60);
        env.emit({ kind: 'critter', handle: h, species: 'moth', action: 'spawn', pos: top, anim: 'flutter' });
        env.emit({ kind: 'critter', handle: h, species: 'moth', action: 'orbit', pos: top, radius: 0.5, speed: 2.5 });
        return proc('critter.moth_lamp', (_dt, e, age) => {
          if (e.rng.chance(0.01)) snd(e, 'critter.moth.tick_on_glass', top, 0.12);
          return age < life;
        }, e => e.emit({ kind: 'critter', handle: h, species: 'moth', action: 'despawn', pos: top }));
      },
    },
  );

  /* ---------- Human traces, infrastructure ---------- */
  defs.push(
    {
      id: 'human.radio_window', category: 'human', weight: 1.0, cooldown: 140,
      modifier: c => (c.hour > 8 && c.hour < 23) && inB(c, 'suburb', 'street') && hasNear(c, 'window', 30) ? 1 : 0,
      spawn: env => {
        const w = env.engine.pickAnchor(env, 'window', 5, 30); if (!w) return null;
        const dur = env.rng.range(6, 16);
        return timeline('human.radio_window', [[0, e => snd(e, 'human.radio.fragment', w.pos, 0.35, 1, { muffled: true, duration: dur })]], dur);
      },
    },
    {
      id: 'human.distant_voices', category: 'human', weight: 1.1, cooldown: 100,
      modifier: c => inB(c, 'plaza', 'street', 'park', 'beach', 'suburb') && c.hour > 8 && c.hour < 23 && c.weather.rain < 0.4 ? 1 : 0.1,
      spawn: env => {
        const p = env.engine.ringPoint(env, 35, 90, {}); if (!p) return null;
        const id = env.rng.pick(['human.laughter.distant', 'human.chatter.distant', 'human.child_shout.distant', 'human.whistle.distant']);
        return timeline('human.distant_voices', [[0, e => snd(e, id, p, 0.4, e.rng.range(0.9, 1.1))]], 2);
      },
    },
    {
      id: 'human.lawnmower', category: 'human', weight: 0.8, cooldown: 600,
      modifier: c => inB(c, 'suburb', 'park') && isDay(c.hour) && c.hour > 9 && c.weather.rain < 0.05 && c.weather.wetness < 0.3 ? seasonW(c, 1.3, 1.8, 0.4, 0) : 0,
      spawn: env => {
        const p = env.engine.ringPoint(env, 50, 100, {}); if (!p) return null;
        const h = env.engine.nextHandle(), life = env.rng.range(40, 90);
        env.emit({ kind: 'loop', handle: h, id: 'human.lawnmower', pos: p, volume: 0, action: 'start' });
        return proc('human.lawnmower', (_dt, e, age) => {
          const swell = 0.35 + 0.15 * Math.sin(age * 0.35); // mower drifts nearer and further
          e.emit({ kind: 'loop', handle: h, id: 'human.lawnmower', pos: p, volume: swell * Math.min(1, age / 4) * Math.min(1, (life - age) / 4), action: 'set' });
          return age < life;
        }, e => e.emit({ kind: 'loop', handle: h, id: 'human.lawnmower', pos: p, volume: 0, action: 'stop' }));
      },
    },
    {
      id: 'human.hammering', category: 'human', weight: 0.8, cooldown: 300,
      modifier: c => isDay(c.hour) && c.hour > 8 && inB(c, 'suburb', 'industrial', 'farm') && c.weather.rain < 0.3 ? 1 : 0.05,
      spawn: env => {
        const p = env.engine.ringPoint(env, 50, 120, {}); if (!p) return null;
        const steps: [number, (e: Env) => void][] = []; let t = 0;
        for (let burst = 0; burst < env.rng.int(2, 3); burst++) {
          for (let i = 0; i < env.rng.int(3, 7); i++) { t += env.rng.range(0.28, 0.4); steps.push([t, e => snd(e, 'human.hammer.tap', p, 0.35, e.rng.range(0.95, 1.05))]); }
          t += env.rng.range(2, 5);
        }
        return timeline('human.hammering', steps, 1);
      },
    },
    {
      id: 'human.footsteps_behind', category: 'human', weight: 0.7, cooldown: 400, tense: true,
      modifier: c => isNight(c.hour) && inB(c, 'alley', 'street', 'industrial') && c.player.state === 'walking' ? 1 : 0,
      spawn: env => {
        const life = env.rng.range(14, 24); let gap = 14, nextStep = 0.5;
        return proc('human.footsteps_behind', (_dt, e, age) => {
          const p = e.ctx.player;
          if (p.state === 'idle' && p.stillFor > 1.5) return false; // they stop when you stop
          const speed = Math.max(V.lenXZ(p.vel), 0.5);
          if (age >= nextStep) {
            nextStep = age + clamp(0.75 / (speed / 1.4), 0.25, 1.2);
            const pos = snap(e.ctx, V.add(p.pos, V.scale(p.forward, -gap)));
            snd(e, `human.footstep.${e.ctx.surfaceAt(pos)}`, pos, 0.35, e.rng.range(0.9, 1.1));
            gap = Math.max(8, gap - 0.12);
          }
          if (age > life) { snd(e, 'object.door.close_distant', snap(e.ctx, V.add(p.pos, V.scale(p.forward, -gap))), 0.4); return false; }
          return true;
        });
      },
    },
    {
      id: 'light.lamp_flicker', category: 'light', weight: 1.0, cooldown: 120,
      modifier: c => isNight(c.hour) && hasNear(c, 'lamp', 35) ? 1.2 : 0,
      spawn: env => {
        const lamp = env.engine.pickAnchor(env, 'lamp', 3, 35); if (!lamp) return null;
        const dead = env.rng.chance(0.15);
        return timeline('light.lamp_flicker', [
          [0, e => { e.emit({ kind: 'light', anchorId: lamp.id, mode: 'flicker', duration: 3 }); snd(e, 'fixture.lamp.buzz', lamp.pos, 0.3, 1, { duration: 3 }); }],
          [3, e => { if (dead) { e.emit({ kind: 'light', anchorId: lamp.id, mode: 'off' }); snd(e, 'fixture.lamp.pop', lamp.pos, 0.5); } }],
        ], 1);
      },
    },
    {
      id: 'sound.siren_distant', category: 'sound', weight: 0.7, cooldown: 480,
      modifier: c => inB(c, 'street', 'plaza', 'suburb', 'industrial', 'alley') ? 1 : 0,
      spawn: env => {
        const from = env.engine.ringPoint(env, 250, 400, {}); if (!from) return null;
        const to = V.add(from, { x: env.rng.range(-300, 300), y: 0, z: env.rng.range(-300, 300) });
        return timeline('sound.siren_distant', [[0, e => snd(e, 'vehicle.siren.distant', from, 0.5, 1, { moveTo: to, duration: 20 })]], 20);
      },
    },
    {
      id: 'sound.train_horn', category: 'sound', weight: 0.4, cooldown: 900,
      modifier: c => inB(c, 'industrial', 'farm', 'meadow', 'suburb') ? 1 : 0,
      spawn: env => {
        const from = env.engine.ringPoint(env, 350, 600, {}); if (!from) return null;
        const to = V.add(from, { x: env.rng.range(-400, 400), y: 0, z: env.rng.range(-400, 400) });
        return timeline('sound.train_horn', [[0, e => snd(e, 'vehicle.train.horn', from, 0.5, 1, { moveTo: to, duration: 12 })], [2.4, e => snd(e, 'vehicle.train.horn', V.lerp(from, to, 0.2), 0.5)], [6, e => snd(e, 'vehicle.train.rumble', V.lerp(from, to, 0.5), 0.3, 1, { duration: 12 })]], 12);
      },
    },
    {
      id: 'vehicle.car_pass', category: 'sound', weight: 2.0, cooldown: 25,
      modifier: c => inB(c, 'street', 'suburb', 'industrial') && hasNear(c, 'road', 45) ? (isNight(c.hour) ? 0.5 : 1.2) : 0,
      spawn: env => {
        const road = env.engine.pickAnchor(env, 'road', 6, 45); if (!road) return null;
        const dir = V.normXZ(road.dir ?? { x: 1, y: 0, z: 0 }), sign = env.rng.chance(0.5) ? 1 : -1;
        const from = V.add(road.pos, V.scale(dir, -70 * sign)), to = V.add(road.pos, V.scale(dir, 70 * sign));
        const speed = env.rng.range(9, 16), total = 140 / speed;
        return timeline('vehicle.car_pass', [
          [0, e => snd(e, 'vehicle.car.pass', from, 0.7, e.rng.range(0.9, 1.1), { moveTo: to, duration: total })],
          [total / 2, e => {
            if (e.ctx.weather.wetness > 0.6 && V.dist(e.ctx.player.pos, road.pos) < 12) {
              e.emit({ kind: 'particles', preset: 'puddle_splash', pos: road.pos, dir, intensity: 0.8, duration: 1 });
              snd(e, 'water.splash.car', road.pos, 0.7);
            }
            e.emit({ kind: 'stimulus', pos: road.pos, type: 'noise', loudness: 0.3 });
          }],
        ], total);
      },
    },
    {
      id: 'structure.dust_devil', category: 'weather', weight: 0.35, cooldown: 600,
      modifier: c => inB(c, 'meadow', 'farm', 'industrial', 'beach') && c.weather.temperature > 24 && c.weather.wetness < 0.15 && c.weather.windSpeed > 1.5 && c.weather.windSpeed < 7 && isDay(c.hour) ? 1 : 0,
      spawn: env => {
        let pos = env.engine.ringPoint(env, 18, 40, {}); if (!pos) return null;
        const h = env.engine.nextHandle(), life = env.rng.range(8, 20); let tick = 0;
        env.emit({ kind: 'loop', handle: h, id: 'wind.whirl', pos, volume: 0.3, action: 'start' });
        return proc('structure.dust_devil', (dt, e, age) => {
          const w = e.wind.sample(pos!, e.ctx.time, e.ctx.weather);
          pos = snap(e.ctx, V.add(pos!, V.make((w.x * 0.5 + Math.sin(age * 0.9) * 0.8) * dt, 0, (w.z * 0.5 + Math.cos(age * 0.7) * 0.8) * dt)));
          e.emit({ kind: 'loop', handle: h, id: 'wind.whirl', pos, volume: 0.3, action: 'set' });
          tick -= dt;
          if (tick <= 0) { tick = 0.4; e.emit({ kind: 'particles', preset: 'dust_devil', pos, intensity: 0.8, duration: 0.6 }); e.engine.wakeLitterNear(pos, 7, 4); }
          return age < life;
        }, e => e.emit({ kind: 'loop', handle: h, id: 'wind.whirl', pos: pos!, volume: 0, action: 'stop' }));
      },
    },
    {
      id: 'human.coin_glint', category: 'human', weight: 0.5, cooldown: 300,
      modifier: c => isDay(c.hour) && c.weather.cloud < 0.5 && c.weather.rain < 0.05 && inB(c, 'street', 'plaza', 'park', 'alley', 'beach') ? 1 : 0,
      spawn: env => {
        const p = env.engine.ringPoint(env, 4, 12, {}); if (!p) return null;
        const prop = env.rng.pick(['prop_coin', 'prop_bottle_cap', 'prop_lost_glove', 'prop_cigarette_butt', 'prop_hair_tie']);
        const pos = snap(env.ctx, p);
        env.engine.addLitter(null, pos, V.make(0, env.rng.range(0, TAU), 0), prop);
        if (prop === 'prop_coin') env.emit({ kind: 'particles', preset: 'sun_glint', pos, intensity: 0.5, duration: 6 });
        return null;
      },
    },
  );

  return defs;
}
// helper used by the thunder event (delay for the rumble tail)
function e_delay(env: Env) { return env.rng.range(1.5, 4); }

/* ================================ ENGINE ================================= */

export interface EngineOptions {
  seed: number;
  density: number;        // global multiplier on event rate (1 = default)
  allowTense: boolean;    // allow unsettling events (footsteps behind, rats in the dark)
  maxConcurrent: number;
  maxLitter: number;
  debug: boolean;
}

interface LitterItem { handle: number; typeId: string | null; prop: string; pos: Vec3; rot: Vec3; born: number }

const BIOME_DENSITY: Record<Biome, number> = {
  street: 1, alley: 1, plaza: 1.1, suburb: 0.9, park: 1.2, forest: 1.2,
  meadow: 0.9, beach: 0.8, industrial: 0.8, farm: 0.8, interior: 0.5,
};

export class AmbientEngine {
  readonly wind = new WindField();
  readonly stats = { spawned: 0, active: 0, litter: 0, lastEvent: '' };

  private rng: Rng;
  private opts: EngineOptions;
  private catalog: EventDef[];
  private instances: EventInstance[] = [];
  private timers: { at: number; fn: (e: Env) => void }[] = [];
  private cooldownUntil = new Map<string, number>();
  private recent: { id: string; cat: EventCategory; t: number }[] = [];
  private litter: LitterItem[] = [];
  private handleSeq = 1;
  private nextEventIn = 4;
  private litterTimer = 0;
  private lastHour = -1;
  private now = 0;

  constructor(private host: AmbientHost, opts: Partial<EngineOptions> = {}, catalog?: EventDef[]) {
    this.opts = { seed: 1, density: 1, allowTense: true, maxConcurrent: 16, maxLitter: 150, debug: false, ...opts };
    this.rng = new Rng(this.opts.seed);
    this.catalog = catalog ?? buildDefaultCatalog();
  }

  register(def: EventDef) { this.catalog.push(def); }
  nextHandle() { return this.handleSeq++; }
  later(seconds: number, fn: (e: Env) => void) { this.timers.push({ at: this.now + seconds, fn }); }
  addInstance(i: EventInstance) { this.instances.push(i); }

  /** Debug / scripted moments: fire a specific event now, ignoring weight and cooldown. */
  force(id: string, ctx: WorldContext): boolean {
    const def = this.catalog.find(d => d.id === id);
    if (!def) return false;
    return this.spawnDef(def, this.makeEnv(ctx));
  }

  /** Call every frame. */
  update(dt: number, ctx: WorldContext) {
    this.now = ctx.time;
    const env = this.makeEnv(ctx);

    // 1. Tick live events
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      if (!inst.update(dt, env)) { inst.dispose?.(env); this.instances.splice(i, 1); }
    }
    // 2. Delayed callbacks
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].at <= this.now) { const t = this.timers.splice(i, 1)[0]; t.fn(env); }
    }
    // 3. Persistent litter, hourly routines, director
    this.litterTimer -= dt;
    if (this.litterTimer <= 0) { this.litterTimer = 0.7; this.stepLitter(env); }
    const hr = Math.floor(ctx.hour);
    if (hr !== this.lastHour) { if (this.lastHour >= 0) this.onHour(hr, env); this.lastHour = hr; }

    this.nextEventIn -= dt;
    if (this.nextEventIn <= 0) {
      const rate = this.ratePerMinute(ctx);
      if (rate > 0.01) { this.trySpawn(env); this.nextEventIn = this.rng.exp(60 / rate); }
      else this.nextEventIn = 2;
    }
    this.stats.active = this.instances.length; this.stats.litter = this.litter.length;
  }

  /* ---------- Director ---------- */

  private ratePerMinute(ctx: WorldContext): number {
    const p = ctx.player;
    let r = 5 * this.opts.density * BIOME_DENSITY[ctx.biomeAt(p.pos)];
    switch (p.state) {
      case 'combat': case 'dialogue': return 0;
      case 'running': r *= 0.5; break;
      case 'driving': r *= 0.3; break;
      case 'idle': r *= 1 + Math.min(p.stillFor / 20, 1) * 0.8; break; // stand still, the world comes to you
      case 'sneaking': r *= 1.2; break;
      default: break;
    }
    if (ctx.isIndoors(p.pos)) r *= 0.4;
    // After a burst of activity let the world breathe.
    const burst = this.recent.filter(e => ctx.time - e.t < 20).length;
    return r * Math.max(0.25, 1 - burst * 0.2);
  }

  private trySpawn(env: Env) {
    if (this.instances.length >= this.opts.maxConcurrent) return;
    const { ctx } = env;
    this.recent = this.recent.filter(e => ctx.time - e.t < 180);
    const cands: EventDef[] = [], weights: number[] = [];
    for (const d of this.catalog) {
      if ((this.cooldownUntil.get(d.id) ?? 0) > ctx.time) continue;
      if (d.tense && !this.opts.allowTense) continue;
      const m = d.modifier ? d.modifier(ctx) : 1;
      if (m <= 0) continue;
      let w = d.weight * m;
      if (this.recent.some(e => e.id === d.id && ctx.time - e.t < 120)) w *= 0.15;   // variety
      if (this.recent.some(e => e.cat === d.category && ctx.time - e.t < 15)) w *= 0.5;
      cands.push(d); weights.push(w);
    }
    const pick = this.rng.weighted(cands, weights);
    if (pick) this.spawnDef(pick, env);
  }

  private spawnDef(def: EventDef, env: Env): boolean {
    const out = def.spawn(env);
    this.cooldownUntil.set(def.id, env.ctx.time + def.cooldown * this.rng.range(0.8, 1.3));
    this.recent.push({ id: def.id, cat: def.category, t: env.ctx.time });
    this.stats.spawned++; this.stats.lastEvent = def.id;
    if (this.opts.debug) console.debug(`[ambient] ${def.id}`);
    if (!out) return false;
    if (Array.isArray(out)) this.instances.push(...out); else this.instances.push(out);
    return true;
  }

  /* ---------- Scheduled by the clock ---------- */

  private onHour(h: number, env: Env) {
    const { ctx } = env, pl = ctx.player.pos;
    // Church / clock tower strikes the hour
    const tower = ctx.anchorsNear('bell_tower', pl, 220, 1)[0];
    if (tower && h >= 7 && h <= 22) {
      const n = h % 12 || 12;
      for (let i = 0; i < n; i++) this.later(i * 2.6 + 1, e => snd(e, 'structure.bell.toll', tower.pos, clamp(1 - V.dist(pl, tower.pos) / 260, 0.15, 0.8)));
    }
    // Factory whistle
    if ((h === 7 || h === 12 || h === 17) && ctx.biomeAt(pl) === 'industrial')
      this.later(1, e => snd(e, 'structure.factory.whistle', V.add(pl, { x: 120, y: 10, z: 60 }), 0.5));
    // Windows light up at dusk, go dark late at night
    if ((h >= 17 && h <= 20) || h === 23 || h === 0 || h === 1) {
      const on = h >= 17 && h <= 20;
      for (const w of ctx.anchorsNear('window', pl, 70, 8)) {
        if (this.rng.chance(on ? 0.6 : 0.5)) this.later(this.rng.range(1, 90), e => e.emit({ kind: 'light', anchorId: w.id, mode: on ? 'on' : 'off' }));
      }
    }
  }

  /* ---------- Persistent litter: the world remembers ---------- */

  /** Registers a resting object. typeId=null means a static pickup that never blows away. */
  addLitter(typeId: string | null, pos: Vec3, rot: Vec3, prop?: string) {
    const item: LitterItem = { handle: this.nextHandle(), typeId, prop: prop ?? DEBRIS[typeId!].prop, pos: V.copy(pos), rot: V.copy(rot), born: this.now };
    this.litter.push(item);
    this.host.emit({ kind: 'litter', handle: item.handle, prop: item.prop, action: 'add', pos: item.pos, rotation: item.rot });
    while (this.litter.length > this.opts.maxLitter) this.removeLitter(this.litter[0]);
  }

  private removeLitter(item: LitterItem) {
    this.host.emit({ kind: 'litter', handle: item.handle, prop: item.prop, action: 'remove', pos: item.pos, rotation: item.rot });
    const i = this.litter.indexOf(item);
    if (i >= 0) this.litter.splice(i, 1);
  }

  private wakeLitter(item: LitterItem, vel: Vec3, env: Env) {
    this.removeLitter(item);
    if (item.typeId) this.instances.push(DebrisInstance.launch(item.typeId, item.pos, vel, env));
  }

  private stepLitter(env: Env) {
    const { ctx, rng } = env, pl = ctx.player;
    for (const item of [...this.litter]) {
      if (!item.typeId) continue;
      const d = V.dist(item.pos, pl.pos);
      if (d > 45) continue;
      const T = DEBRIS[item.typeId];
      // Leaves in the wet quietly rot into the ground eventually.
      if (T.id === 'leaf' && ctx.weather.wetness > 0.5 && this.now - item.born > 600) { this.removeLitter(item); continue; }
      // The player's boots kick light things.
      const speed = V.lenXZ(pl.vel);
      if (d < 1.2 && speed > 2.5) {
        const v = V.add(V.scale(pl.vel, 0.5), { x: 0, y: 1 + rng.range(0, 1.2), z: 0 });
        snd(env, `debris.${T.id}.${ctx.surfaceAt(item.pos)}.scrape`, item.pos, 0.3);
        this.wakeLitter(item, v, env); continue;
      }
      // A strong enough gust lifts it. Wet weather pins soggy things down.
      const w = env.wind.sample(item.pos, ctx.time, ctx.weather);
      const thr = T.liftoff * (T.soggy && ctx.weather.wetness > 0.5 ? 2.5 : 1);
      if (V.len(w) > thr && rng.chance(0.3)) this.wakeLitter(item, V.scale(w, 0.3), env);
    }
  }

  /** Dust devils and gust sweeps stir up nearby litter. */
  wakeLitterNear(pos: Vec3, radius: number, impulse: number) {
    const env = this.lastEnv; if (!env) return;
    for (const item of [...this.litter]) {
      if (!item.typeId || V.dist(item.pos, pos) > radius) continue;
      if (env.rng.chance(0.6)) {
        const d = awayFrom(item.pos, pos);
        this.wakeLitter(item, { x: d.x * impulse + env.rng.range(-1, 1), y: impulse * 0.5, z: d.z * impulse + env.rng.range(-1, 1) }, env);
      }
    }
  }

  /* ---------- Placement helpers used by events ---------- */

  private lastEnv: Env | null = null;
  private makeEnv(ctx: WorldContext): Env {
    const env: Env = { ctx, rng: this.rng, wind: this.wind, emit: c => this.host.emit(c), engine: this };
    this.lastEnv = env; return env;
  }

  /** A point upwind of the player offset sideways, so debris crosses the player's path. */
  placeCrossing(env: Env, minD: number, maxD: number, lateral: number): Vec3 {
    const { ctx, rng } = env, pl = ctx.player.pos, wd = ctx.weather.windDir;
    const perp = { x: -wd.z, y: 0, z: wd.x }, back = rng.range(minD, maxD), side = rng.range(-lateral, lateral);
    const p = { x: pl.x - wd.x * back + perp.x * side, y: 0, z: pl.z - wd.z * back + perp.z * side };
    p.y = ctx.groundY(p.x, p.z);
    return p;
  }

  pickAnchor(env: Env, tag: AnchorTag, minD: number, maxD: number): Anchor | null {
    const pl = env.ctx.player.pos;
    const list = env.ctx.anchorsNear(tag, pl, maxD, 16).filter(a => V.dist(a.pos, pl) >= minD);
    return list.length ? env.rng.pick(list) : null;
  }

  /** Random point on a ring around the player; optionally restricted by biome and visibility. */
  ringPoint(env: Env, minR: number, maxR: number, o: { biomes?: Biome[]; outOfView?: boolean }): Vec3 | null {
    const { ctx, rng } = env, pl = ctx.player.pos;
    for (let i = 0; i < 8; i++) {
      const a = rng.range(0, TAU), r = rng.range(minR, maxR);
      const p = { x: pl.x + Math.cos(a) * r, y: 0, z: pl.z + Math.sin(a) * r };
      p.y = ctx.groundY(p.x, p.z);
      if (ctx.isIndoors(p)) continue;
      if (o.biomes && !o.biomes.includes(ctx.biomeAt(p))) continue;
      if (o.outOfView && ctx.isVisible(p)) continue;
      return p;
    }
    return null;
  }
}

export function createAmbientEngine(host: AmbientHost, opts?: Partial<EngineOptions>) {
  return new AmbientEngine(host, opts);
}

/* ============================== INTEGRATION ===============================
 *
 *   const engine = createAmbientEngine({
 *     emit(cue) {
 *       switch (cue.kind) {
 *         case 'sound':     audio.playAt(cue.id, cue.pos, cue.volume, cue.pitch, cue.moveTo, cue.duration); break;
 *         case 'loop':      audio.loop(cue.handle, cue.id, cue.pos, cue.volume, cue.action); break;
 *         case 'prop':      props.apply(cue); break;       // spawn/update/despawn a pooled mesh
 *         case 'litter':    litterLayer.apply(cue); break; // static resting pieces, pickups
 *         case 'critter':   critters.apply(cue); break;
 *         case 'particles': vfx.play(cue.preset, cue.pos, cue.dir, cue.intensity, cue.duration); break;
 *         case 'anchorAnim':level.animateAnchor(cue.anchorId, cue.anim, cue.intensity); break;
 *         case 'light':     level.setLight(cue.anchorId, cue.mode, cue.duration); break;
 *         case 'stimulus':  npcs.hear(cue.pos, cue.type, cue.loudness); break;
 *       }
 *     },
 *   }, { seed: 42, density: 1 });
 *
 *   // each frame:
 *   engine.update(dt, worldContext);
 *
 * Sound ids are structured so you can fall back gracefully:
 *   debris.cup.asphalt.roll -> debris.cup.roll -> debris.roll
 *
 * Add your own event:
 *   engine.register({
 *     id: 'human.newspaper_boy', category: 'human', weight: 0.5, cooldown: 600,
 *     modifier: c => c.hour > 5.5 && c.hour < 7.5 ? 1 : 0,
 *     spawn: env => timeline('human.newspaper_boy', [[0, e => snd(e, 'vehicle.bike.bell', ...)]]),
 *   });
 * (timeline, proc and snd are module-local; export them if you build events elsewhere.)
 */
