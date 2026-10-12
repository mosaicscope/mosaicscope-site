import { DEFAULT_CONFIG, DEFAULT_FLAGS, FeatureFlags, SimConfig } from "../core/config";
import { Rng } from "../core/rng";
import { EventBus } from "../core/eventBus";
import { World, Area } from "../world/World";
import { generateWorld } from "../world/WorldGenerator";
import { Navigation } from "../world/Navigation";
import { SpatialHash } from "../world/SpatialHash";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { aimThrow, swingHits, applyImpact, shieldBlocks, updatePhysState } from "../physics/combat";
import { Character, Lod, LOD_INTERVAL, Phys, Rel, Toy } from "../entities/types";
import { makeToy } from "../entities/factory";
import { TOYS, canThrow } from "../content/toys";
import { WorldEventSystem, EmitSpec, WorldEvent } from "../events/WorldEvents";
import { EVENT_DEFS } from "../events/defs";
import { GroupSystem } from "../social/Groups";
import { applyInteraction, decayRelations, rel, remember } from "../social/Social";
import { DialogueEngine } from "../dialogue/DialogueEngine";
import { think, thinkBackground } from "../ai/brain";
import { Choice } from "../ai/goals";
import { LodManager } from "../crowd/LodManager";
import { EnvState, newEnv, updateEnvironment, TICKS_PER_HOUR, daylight } from "./Environment";
import { spawnAll, streetSpot, spawnBackground } from "./Spawner";
import { installRules } from "./Rules";
import { pickUp, drop, transfer, craftable, detach, PickupResult } from "../inventory/Inventory";
import { clamp } from "../core/math";

export type FxKind = "dust" | "impact" | "spark" | "confetti" | "break" | "heart" | "rain_splash" | "text" | "spring" | "zzz" | "music" | "star";
export interface SimSignals {
  fx: { kind: FxKind; x: number; y: number; z: number; color?: string; n?: number; text?: string };
  sound: { kind: string; x: number; y: number; vol: number };
  event: WorldEvent;
  say: { id: number; text: string };
}

export interface Metrics {
  aiDecisions: number; bgThinks: number; replans: number; failedGoals: number;
  stepMs: number; aiMs: number; physicsMs: number; moveMs: number; eventsMs: number;
  failByGoal: Record<string, number>;
}

/**
 * The whole simulation, independent of rendering. `step()` advances exactly one fixed tick.
 * Headless-safe: no DOM access anywhere under sim/, ai/, physics/, social/, events/, dialogue/.
 */
export class Simulation {
  readonly cfg: SimConfig;
  readonly flags: FeatureFlags;
  readonly step_dt = 1 / 60;
  rng: Rng;
  world!: World;
  nav!: Navigation;
  physics!: PhysicsWorld;
  events: WorldEventSystem;
  groups = new GroupSystem();
  dialogue: DialogueEngine;
  lod = new LodManager();
  bus = new EventBus<SimSignals>();
  chars: Character[] = [];
  toys: Toy[] = [];
  playerId = 0;
  charHash!: SpatialHash;
  tick = 0;
  env: EnvState = newEnv();
  focus = { x: 32, y: 32 };
  stagePoint = { x: 0, y: 0 };
  routines = new Map<number, [number, string][]>();
  metrics: Metrics = { aiDecisions: 0, bgThinks: 0, replans: 0, failedGoals: 0, stepMs: 0, aiMs: 0, physicsMs: 0, moveMs: 0, eventsMs: 0, failByGoal: {} };
  /** toy id -> intended target (to detect misses that hit someone else) */
  throwIntent = new Map<number, number>();
  hotspots: { x: number; y: number; severity: number; tick: number; ev: number; watchers: number }[] = [];
  /** victim id -> character currently going to help them (one helper each) */
  helpers = new Map<number, number>();
  games: { toy: number; x: number; y: number; until: number; area: number }[] = [];
  private deferred: (() => void)[] = [];
  private shelterPts: { x: number; y: number }[] = [];
  private tmp: number[] = [];
  private tmp2: number[] = [];
  private hits: Character[] = [];
  /** player-visible notifications */
  toasts: { text: string; tick: number; kind: string }[] = [];

  constructor(cfg: Partial<SimConfig> = {}, flags: Partial<FeatureFlags> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.flags = { ...DEFAULT_FLAGS, ...flags };
    this.rng = new Rng(this.cfg.seed);
    this.events = new WorldEventSystem(this.cfg.eventsPerTick, this.cfg.eventQueueCap, this.cfg.maxCausalDepth);
    for (const d of EVENT_DEFS) this.events.register(d);
    this.dialogue = new DialogueEngine(this);
    this.build();
    installRules(this);
  }

  private build(): void {
    this.world = generateWorld({ size: this.cfg.worldSize, seed: this.cfg.seed });
    this.nav = new Navigation(this.world, this.cfg.pathNodeBudget);
    this.physics = new PhysicsWorld(this.world, this.cfg.maxImpulse);
    this.charHash = new SpatialHash(this.world.size, this.world.size, 2, 1024);
    const stage = this.world.areas.find((a) => a.kind === "stage")!;
    this.stagePoint = { x: stage.cx + 2, y: stage.cy };
    const plaza = this.world.areas.find((a) => a.kind === "plaza")!;
    this.focus = { x: plaza.cx, y: plaza.cy };
    const S = this.world.size;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (this.world.shelter[y * S + x] && this.world.walkableTile(x, y)) this.shelterPts.push({ x: x + 0.5, y: y + 0.5 });
    spawnAll(this);
    this.rebuildHash();
  }

  get player(): Character { return this.chars[this.playerId]; }
  get hour(): number { return (this.env.startHour + this.tick / TICKS_PER_HOUR) % 24; }
  get daylight(): number { return daylight(this.hour); }
  get isDark(): boolean { return this.daylight < 0.35 || !this.env.power && this.daylight < 0.7; }

  relate(a: Character, b: number): Rel { return rel(a, b, this.tick); }

  emit(spec: EmitSpec): WorldEvent | null { return this.events.emit(spec, this.tick); }

  rebuildHash(): void {
    const h = this.charHash;
    h.clear();
    for (const c of this.chars) if (c.lod !== Lod.SLEEP) h.insert(c.id, c.x, c.y);
  }

  // ------------------------------------------------------------------ tick
  step(): void {
    const t0 = performance.now();
    const dt = this.step_dt;
    this.tick++;
    this.metrics.aiDecisions = 0; this.metrics.bgThinks = 0;
    this.charHash.queries = 0; this.charHash.candidatesVisited = 0;
    if (this.tick % 60 === 0) updateEnvironment(this);
    this.rebuildHash();
    if (this.tick % 30 === 0) this.lod.update(this);

    let aiMs = 0;
    const tm = performance.now();
    for (const c of this.chars) {
      c.px = c.x; c.py = c.y;
      const interval = LOD_INTERVAL[c.lod];
      if (this.tick >= c.nextThink) {
        const ta = performance.now();
        const tdt = interval * dt;
        if (c.tier === "background" && !c.promoted) thinkBackground(c, this, tdt);
        else think(c, this, tdt);
        c.nextThink = this.tick + interval + (c.lod >= Lod.GROUP ? (c.id % 3) : 0);
        aiMs += performance.now() - ta;
      }
      if (c.lod === Lod.SLEEP) {
        // off-screen and far away: integrate coarsely once per think interval
        if (this.tick % interval === c.id % interval) this.moveSimple(c, dt * interval);
        continue;
      }
      if (c.phys !== Phys.OK || c.lod <= Lod.GROUP) updatePhysState(c, dt);
      if (c.lod === Lod.BACKGROUND) { this.moveSimple(c, dt); continue; }
      this.moveCharacter(c, dt);
    }
    this.metrics.moveMs = performance.now() - tm - aiMs;
    this.metrics.aiMs = aiMs;

    const tp = performance.now();
    this.physics.step(dt, this.toys, this.chars, this.charHash, this.tick, this.hooks);
    for (const t of this.toys) if (t.state === "held") this.attachHeld(t);
    this.metrics.physicsMs = performance.now() - tp;

    this.nav.process(this.cfg.pathsPerTick);
    this.dialogue.update();
    const te = performance.now();
    this.events.process(this.tick);
    this.metrics.eventsMs = performance.now() - te;
    if (this.deferred.length) { const d = this.deferred; this.deferred = []; for (const fn of d) fn(); }

    if (this.tick % 120 === 0) this.groups.update(this.chars, this.tick);
    if (this.tick % 60 === 0) this.housekeeping();
    this.metrics.stepMs = performance.now() - t0;
  }

  /** Physics hooks are installed by Rules. */
  hooks!: import("../physics/PhysicsWorld").PhysicsHooks;

  private moveCharacter(c: Character, dt: number): void {
    if (c.phys === Phys.DOWN || c.phys === Phys.RECOVER) { c.vx = 0; c.vy = 0; }
    let vx = c.vx, vy = c.vy;
    if (c.phys === Phys.STUMBLE) { vx *= 0.2; vy *= 0.2; }
    // local avoidance: separation from neighbours (full/reduced only)
    if (c.lod <= Lod.REDUCED && c.tier !== "background") {
      const n = this.charHash.query(c.x, c.y, 0.75, this.tmp);
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        const o = this.chars[this.tmp[i]];
        if (o === c || o.tier === "background" && !o.promoted) continue;
        const dx = c.x - o.x, dy = c.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.0001 || d2 > 0.5) continue;
        const d = Math.sqrt(d2), push = (0.72 - d) / 0.72;
        sx += (dx / d) * push; sy += (dy / d) * push;
      }
      vx += sx * 1.8; vy += sy * 1.8;
    }
    if (vx !== 0 || vy !== 0) {
      const blocked = this.physics.moveCircle(c, vx * dt, vy * dt);
      if (c.vx !== 0 || c.vy !== 0) c.facing = Math.atan2(c.vy, c.vx);
      if (blocked) c.stuck += dt;
    }
    this.physics.stepCharacter(c, dt, this.hooks);
    if (c.lod === Lod.FULL && c.tier !== "background") this.physics.pushHeavies(c, this.toys, this.tick, this.hooks);
    // stuck recovery: no progress while trying to move
    if (this.tick % 30 === c.id % 30) {
      const moved = Math.abs(c.x - c.lastX) + Math.abs(c.y - c.lastY);
      if ((c.vx !== 0 || c.vy !== 0) && moved < 0.05) c.stuck += 0.5; else c.stuck = Math.max(0, c.stuck - 0.5);
      c.lastX = c.x; c.lastY = c.y;
      if (c.stuck > 2.5 && c.tier !== "player") {
        c.stuck = 0; c.path = null; c.pathReq = 0;
        if (!this.world.walkable(c.x, c.y)) { const p = this.world.nearestWalkable(c.x, c.y); c.x = p.x; c.y = p.y; }
        else if (c.goal) { c.goal.stepTimer += 30; } // forces the step to time out and replan
      }
    }
  }

  private moveSimple(c: Character, dt: number): void {
    if (c.vx === 0 && c.vy === 0) return;
    const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (this.world.walkable(nx, ny)) { c.x = nx; c.y = ny; c.facing = Math.atan2(c.vy, c.vx); }
    else { c.vx = 0; c.vy = 0; c.stuck += 1; }
  }

  private attachHeld(t: Toy): void {
    const c = this.chars[t.holder];
    if (!c) { t.state = "rest"; t.holder = -1; return; }
    t.px = t.x; t.py = t.y; t.pz = t.z;
    if (c.hand === t.id) { t.x = c.x + Math.cos(c.facing) * 0.25; t.y = c.y + Math.sin(c.facing) * 0.25; t.z = c.z + 0.9; }
    else { t.x = c.x - Math.cos(c.facing) * 0.15; t.y = c.y - Math.sin(c.facing) * 0.15; t.z = c.z + 1.1; }
  }

  private housekeeping(): void {
    const tick = this.tick;
    // broken toys vanish after a while; darts are pooled for reuse
    for (const t of this.toys) if (t.state === "broken" && t.def !== "dart" && tick - t.brokenAt > 600) { t.state = "broken"; t.x = -100; t.y = -100; }
    // relationships drift (staggered over a minute)
    for (let i = (tick / 60) % 60; i < this.chars.length; i += 60) {
      const c = this.chars[i];
      if (c.tier === "principal" || c.tier === "mid") decayRelations(c, tick, 3600);
    }
    // restock toy chests when the world runs low on usable toys
    if (tick % 1800 === 0) {
      const usable = this.toys.filter((t) => t.state !== "broken" && TOYS[t.def].portable).length;
      if (usable < 50) {
        const chests = this.world.pois.filter((p) => p.kind === "toychest");
        const p = this.rng.pick(chests);
        const defs = Object.values(TOYS).filter((d) => d.spawn > 0 && d.portable);
        for (let i = 0; i < 4; i++) { const d = defs[this.rng.weighted(defs.map((x) => x.spawn))]; this.spawnToy(d.id, p.x + this.rng.range(-1, 1), p.y + this.rng.range(-1, 1)); }
      }
    }
    this.hotspots = this.hotspots.filter((h) => tick - h.tick < 60 * 12);
    this.games = this.games.filter((g) => g.until > tick && this.toys[g.toy]?.state !== "broken");
    if (this.toasts.length > 40) this.toasts.splice(0, this.toasts.length - 40);
  }

  // ------------------------------------------------------------------ actions used by AI / player
  spawnToy(def: string, x: number, y: number, z = 0): Toy | null {
    // object pool: reuse a broken toy of the same def first
    const pooled = this.toys.find((t) => t.state === "broken" && t.def === def && this.tick - t.brokenAt > 120);
    if (pooled) {
      const fresh = makeToy(pooled.id, def, x, y, z);
      Object.assign(pooled, fresh);
      return pooled;
    }
    if (this.toys.length >= this.cfg.maxToys) return null;
    const t = makeToy(this.toys.length, def, x, y, z);
    this.toys.push(t);
    return t;
  }

  pickupToy(c: Character, t: Toy): PickupResult {
    const r = pickUp(c, t, this.tick);
    if (r === "hand" || r === "bag") {
      this.bus.emit("sound", { kind: "pickup", x: c.x, y: c.y, vol: 0.3 });
      if (t.owner === c.id && c.memories.some((m) => m.kind === "lost_item" && m.val < 0 && m.toy === t.def)) {
        for (const m of c.memories) if (m.kind === "lost_item" && m.toy === t.def) m.val = 0.2;
        this.say(c, this.dialogue.bark(c, "found"), "say", 1.5);
        this.emit({ type: "toy_found", x: c.x, y: c.y, actors: [c.id], toy: t.def, summary: `${c.name} found their ${TOYS[t.def].name}` });
      }
    }
    return r;
  }

  dropHeld(c: Character): void { if (c.hand >= 0) drop(c, this.toys[c.hand]); }

  throwHeld(c: Character, tx: number, ty: number, targetId: number, power = 1): boolean {
    if (c.hand < 0) return false;
    const t = this.toys[c.hand];
    if (!t || !canThrow(t.def)) return false;
    detach(c, t.id);
    const acc = c.tier === "player" ? 0.92 : 0.45 + c.emo.confidence * 0.35 + (c.prefs[t.def] ?? 0) * 0.1 - c.emo.frustration * 0.2;
    const v = aimThrow(c.x, c.y, 1.2, tx, ty, 1.0, acc, this.rng, power);
    t.state = "flying"; t.holder = -1; t.thrower = c.id; t.throwTick = this.tick;
    t.x = c.x + Math.cos(c.facing) * 0.35; t.y = c.y + Math.sin(c.facing) * 0.35; t.z = c.z + 1.2;
    t.vx = v.vx; t.vy = v.vy; t.vz = v.vz; t.spin = this.rng.range(-12, 12);
    if (t.def === "yoyo") { t.tether = c.id; t.tetherLen = 3.2; }
    if (targetId >= 0) this.throwIntent.set(t.id, targetId); else this.throwIntent.delete(t.id);
    c.stats.throws++;
    this.lod.markHot(c.id, this.tick);
    this.bus.emit("sound", { kind: "whoosh", x: c.x, y: c.y, vol: 0.4 });
    if (targetId >= 0 && this.rng.chance(0.3)) this.say(c, this.dialogue.bark(c, "taunt"), "shout", 1.2);
    return true;
  }

  kickToy(c: Character, t: Toy, tx?: number, ty?: number): void {
    if (t.state === "held" || t.state === "broken") return;
    const a = tx !== undefined && ty !== undefined ? Math.atan2(ty - t.y, tx - t.x) : c.facing + this.rng.range(-0.8, 0.8);
    const s = TOYS[t.def].uses.includes("heavy") ? 1.2 : this.rng.range(4, 7);
    t.vx = Math.cos(a) * s; t.vy = Math.sin(a) * s; t.vz = this.rng.range(1, 3); t.state = "flying"; t.thrower = c.id; t.throwTick = this.tick;
    this.throwIntent.delete(t.id);
    c.anim.pose = "kick"; c.anim.poseT = 0;
    this.bus.emit("sound", { kind: "kick", x: t.x, y: t.y, vol: 0.4 });
  }

  swingHeld(c: Character): number {
    if (c.hand < 0) return 0;
    const t = this.toys[c.hand], d = TOYS[t.def];
    const reach = 1.25 + (t.def === "noodle" ? 0.25 : 0);
    const n = swingHits(c, reach, this.chars, this.charHash, this.tmp2, this.hits);
    this.bus.emit("sound", { kind: "swish", x: c.x, y: c.y, vol: 0.35 });
    this.lod.markHot(c.id, this.tick);
    for (let i = 0; i < n; i++) {
      const v = this.hits[i];
      if (v.lastHitBy === c.id && this.tick - v.lastHitTick < 20) continue; // per-pair hit cooldown
      const nx = (v.x - c.x) || 0.01, ny = (v.y - c.y) || 0.01, nl = Math.hypot(nx, ny);
      const blocked = shieldBlocks(v, this.toys, c.x, c.y);
      const res = applyImpact(v, d.punch * (0.8 + c.pers.boldness * 0.4), nx / nl, ny / nl, blocked, this.cfg.maxImpulse);
      t.durability -= 2;
      this.onImpact(c, v, t.def, res, true);
      if (t.durability <= 0) this.physics.breakToy(t, c.id, this.tick, this.hooks);
    }
    return n;
  }

  /** Shared bookkeeping for any hit (thrown or melee) after the physical response. Implemented in Rules. */
  onImpact!: (attacker: Character, victim: Character, def: string, res: ReturnType<typeof applyImpact>, melee: boolean) => void;

  shootAt(c: Character, tx: number, ty: number, targetId: number): boolean {
    const dart = this.spawnToy("dart", c.x + Math.cos(c.facing) * 0.4, c.y + Math.sin(c.facing) * 0.4, c.z + 1.2);
    if (!dart) return false;
    const acc = 0.55 + c.emo.confidence * 0.3;
    const a = Math.atan2(ty - c.y, tx - c.x) + this.rng.gauss() * (1 - acc) * 0.25;
    const d = Math.hypot(tx - c.x, ty - c.y), s = 13, time = d / s;
    dart.vx = Math.cos(a) * s; dart.vy = Math.sin(a) * s; dart.vz = (1.0 - 1.2) / Math.max(0.1, time) + 0.5 * 14 * time;
    dart.state = "flying"; dart.thrower = c.id; dart.throwTick = this.tick; dart.angle = a;
    if (targetId >= 0) this.throwIntent.set(dart.id, targetId);
    this.bus.emit("sound", { kind: "twang", x: c.x, y: c.y, vol: 0.35 });
    return true;
  }

  startConversation(c: Character, t: Character, topic: string): boolean { return this.dialogue.start(c, t, topic); }
  endConversation(c: Character): void { this.dialogue.end(c); }
  afterConversation(fn: () => void): void { this.deferred.push(fn); }

  comfort(c: Character, t: Character): void {
    t.emo.fear = Math.max(0, t.emo.fear - 0.4);
    t.emo.composure = Math.min(1, t.emo.composure + 0.35);
    t.emo.mood = clamp(t.emo.mood + 0.2, -1, 1);
    if (t.phys === Phys.DOWN) { t.phys = Phys.RECOVER; t.physTimer = 0.6; }
    applyInteraction(t, c, "helped", true, this.tick);
    applyInteraction(c, t, "helped", false, this.tick);
    c.stats.helps++;
    this.say(c, this.dialogue.bark(c, "help", t), "say", 1.8);
    this.afterConversation(() => this.say(t, this.dialogue.bark(t, "thanks", c), "say", 1.8));
    this.emit({ type: "help", x: t.x, y: t.y, actors: [c.id, t.id], summary: `${c.name} helped ${t.name}` });
    this.bus.emit("fx", { kind: "heart", x: t.x, y: t.y, z: 1.8, n: 3 });
  }

  giveTo(c: Character, t: Character): boolean {
    // give the toy the receiver would like most
    const items = [c.hand, ...c.bag].filter((x) => x >= 0).map((x) => this.toys[x]);
    if (!items.length) return false;
    items.sort((a, b) => (t.likes.includes(b.def) ? 1 : 0) - (t.likes.includes(a.def) ? 1 : 0));
    const toy = items[0];
    if (!transfer(c, t, toy, true)) return false;
    applyInteraction(t, c, "gift", true, this.tick);
    applyInteraction(c, t, "gift", false, this.tick);
    c.stats.gifts++;
    const area = this.world.areaAt(c.x, c.y)?.id ?? 0;
    remember(t, { t: this.tick, kind: "gift_from", subj: c.id, obj: t.id, toy: toy.def, area, val: 0.5, ev: -1, src: "did" });
    remember(c, { t: this.tick, kind: "gift_to", subj: c.id, obj: t.id, toy: toy.def, area, val: 0.3, ev: -1, src: "did" });
    this.say(c, this.dialogue.bark(c, "gift", t, { toy: TOYS[toy.def].name }), "say", 1.8);
    this.emit({ type: "gift", x: t.x, y: t.y, actors: [c.id, t.id], toy: toy.def, summary: `${c.name} gave ${t.name} a ${TOYS[toy.def].name}` });
    this.bus.emit("fx", { kind: "heart", x: t.x, y: t.y, z: 1.8, n: 2 });
    return true;
  }

  craft(c: Character): boolean {
    const r = craftable(c, this.toys);
    if (!r) return false;
    detach(c, r.a.id); detach(c, r.b.id);
    for (const t of [r.a, r.b]) { t.state = "broken"; t.brokenAt = this.tick; t.holder = -1; t.x = -100; }
    const out = this.spawnToy(r.recipe.out, c.x, c.y);
    if (!out) return false;
    out.owner = c.id; pickUp(c, out, this.tick);
    if (out.def === "flail") { out.tether = -1; }
    this.say(c, this.dialogue.bark(c, "craft", null, { toy: r.recipe.name }), "say", 2);
    this.emit({ type: "craft", x: c.x, y: c.y, actors: [c.id], toy: out.def, summary: `${c.name} built a ${r.recipe.name}` });
    this.bus.emit("fx", { kind: "spark", x: c.x, y: c.y, z: 1, n: 10, color: "#f6b62c" });
    return true;
  }

  toggleBoombox(c: Character | null, on: boolean): void {
    if (on && !this.env.power) return;
    if (on && !this.env.party) {
      this.env.party = true; this.env.partyUntil = this.tick + 60 * 120;
      const p = this.world.pois.find((x) => x.kind === "boombox")!;
      this.emit({ type: "party", x: p.x, y: p.y, actors: c ? [c.id] : [], summary: c ? `${c.name} started a party` : "Party started" });
    } else if (!on && this.env.party) this.endParty("switched off");
  }

  endParty(why: string): void {
    if (!this.env.party) return;
    this.env.party = false; this.env.boomboxCooldown = this.tick + 60 * 90;
    const p = this.world.pois.find((x) => x.kind === "boombox")!;
    this.emit({ type: "party_end", x: p.x, y: p.y, summary: `Party over (${why})` });
  }

  findLostToy(c: Character): Toy | null {
    for (const t of this.toys) {
      if (t.owner !== c.id || t.state === "held" || t.state === "broken") continue;
      if (Math.hypot(t.x - c.x, t.y - c.y) < 7 && this.world.lineOfSight(c.x, c.y, t.x, t.y)) return t;
    }
    return null;
  }

  routineArea(c: Character): Area | null {
    const r = this.routines.get(c.id);
    if (!r) return null;
    const h = this.hour;
    let kind = r[r.length - 1][1];
    for (const [hr, k] of r) if (h >= hr) kind = k;
    return this.world.areas.find((a) => a.kind === kind) ?? null;
  }

  hotspotNear(x: number, y: number, r: number, self: number): { x: number; y: number; severity: number } | null {
    let best = null, bs = 0;
    for (const h of this.hotspots) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d > r || d < 1.5) continue;
      const ev = this.events.find(h.ev);
      if (ev && ev.actors.includes(self)) continue;
      const s = h.severity / (1 + d * 0.1) / (1 + h.watchers * 0.1);
      if (s > bs) { bs = s; best = h; }
    }
    if (best) best.watchers++;
    return best;
  }

  activeGameNear(x: number, y: number, r: number): { toy: number } | null {
    for (const g of this.games) if (Math.hypot(g.x - x, g.y - y) < r && this.toys[g.toy]?.state !== "held") return { toy: g.toy };
    return null;
  }

  nearestShelter(x: number, y: number): { x: number; y: number } | null {
    let best = null, bd = Infinity;
    for (let i = 0; i < this.shelterPts.length; i += 3) { const p = this.shelterPts[i]; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }

  threatFor(c: Character): { x: number; y: number } {
    if (c.lastHitBy >= 0 && this.tick - c.lastHitTick < 600) { const a = this.chars[c.lastHitBy]; if (a) return { x: a.x, y: a.y }; }
    let best = null, bd = Infinity;
    for (const h of this.hotspots) { const d = Math.hypot(h.x - c.x, h.y - c.y); if (d < bd) { bd = d; best = h; } }
    return best ?? { x: c.x + this.rng.range(-1, 1), y: c.y + this.rng.range(-1, 1) };
  }

  /** A direction with nobody standing in it (for friendly tosses); falls back to a random angle. */
  clearDirection(c: Character): number {
    const n = this.charHash.query(c.x, c.y, 4, this.tmp);
    for (let tries = 0; tries < 6; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      let clear = true;
      for (let i = 0; i < n && clear; i++) {
        const o = this.chars[this.tmp[i]];
        if (o === c) continue;
        const da = Math.abs(((Math.atan2(o.y - c.y, o.x - c.x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < 0.5) clear = false;
      }
      if (clear) return a;
    }
    return this.rng.range(0, Math.PI * 2);
  }

  streetPoint(_c: Character): { x: number; y: number } { return streetSpot(this); }

  say(c: Character, text: string, kind: "say" | "think" | "shout" = "say", secs = 2): void {
    if (!text || text === "...") return;
    c.bubble = { text, until: this.tick + Math.round(secs * 60), kind };
    this.bus.emit("say", { id: c.id, text });
  }

  emitArgument(a: Character, b: Character, cause: WorldEvent | null): void {
    this.emit({ type: "argument", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, actors: [a.id, b.id], cause, summary: `${a.name} and ${b.name} are arguing` });
  }

  onGoalStarted(c: Character, id: string, ch: Choice): void {
    if (id === "fight" && ch.target >= 0) {
      const t = this.chars[ch.target];
      this.lod.markHot(c.id, this.tick, 600); this.lod.markHot(t.id, this.tick, 600);
      this.emit({ type: "toy_fight", x: (c.x + t.x) / 2, y: (c.y + t.y) / 2, actors: [c.id, t.id], summary: `${c.name} is going after ${t.name}` });
    } else if (id === "help" && ch.target >= 0) {
      this.helpers.set(ch.target, c.id);
    } else if (id === "prank" && ch.target >= 0) {
      this.emit({ type: "prank", x: c.x, y: c.y, actors: [c.id, ch.target], summary: `${c.name} is pranking ${this.chars[ch.target].name}` });
    }
  }
  onGoalFinished(_c: Character, _id: string, _ok: boolean): void {}

  /** Player actions are remembered by witnesses (the stranger builds a reputation). */
  playerAct(kind: string, npc: Character | null): void {
    const p = this.player;
    this.emit({ type: "player", x: p.x, y: p.y, actors: npc ? [p.id, npc.id] : [p.id], data: { kind }, summary: `You ${kind}${npc ? " " + npc.name : ""}` });
  }

  // ------------------------------------------------------------------ dev tools
  spawnNpcAt(x: number, y: number, n = 1): void {
    const before = this.chars.length;
    spawnBackground(this, n);
    for (let i = before; i < this.chars.length; i++) { const c = this.chars[i]; const p = this.world.nearestWalkable(x + this.rng.range(-2, 2), y + this.rng.range(-2, 2)); c.x = c.px = p.x; c.y = c.py = p.y; c.pathGoalX = p.x; c.pathGoalY = p.y; c.homeArea = this.world.areaAt(p.x, p.y)?.id ?? 0; }
  }

  toast(text: string, kind = "info"): void { this.toasts.push({ text, tick: this.tick, kind }); }
}

export type { Choice };
