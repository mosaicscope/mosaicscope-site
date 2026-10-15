import { newLife, tickLife } from "./Chronicles";
import { newExpansion, wageBoost, farmDay, encounterAt } from "./Expansion";
import { DEFAULT_CONFIG, DEFAULT_FLAGS, FeatureFlags, SimConfig } from "../core/config";
import { Rng } from "../core/rng";
import { EventBus } from "../core/eventBus";
import { World, Area, ROAD_W, CROSS_W } from "../world/World";
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
import { pickUp, drop, transfer, craftable, detach, PickupResult, carried } from "../inventory/Inventory";
import { Vehicle } from "../entities/types";
import { spawnVehicles, updateVehicles, unseat, laneCoord, clearLaneState, walkSignal, carVel, bump } from "./Traffic";
import { Crime, Booking, exitBuilding, insideOutcome, updateCustody, commitCrime, evaluateTrade, executeTrade, fmtCash } from "./Society";
import { NameBook } from "./Spawner";
import { VEHICLES } from "../content/vehicles";
import { forceGoal } from "../ai/brain";
import { updateHealth, hospitalise, wound, useBandage, recomputeBleed, hurtOf } from "./Life";
import { clamp } from "../core/math";
import { fireGun, startTurfWar, turfWarActive } from "./Turf";
import { LitterState, updateLitter } from "./Litter";

export type FxKind = "dust" | "impact" | "spark" | "confetti" | "break" | "heart" | "rain_splash" | "text" | "spring" | "zzz" | "music" | "star" | "blood" | "spray" | "flash" | "paint" | "water" | "cash" | "gib" | "skid";
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
/**
 * Step kinds that are just standing about with no spot of their own: never done in a traffic lane. Steps that walk
 * to a spot (goto, wander, dance, pose, watch...) are not here: their spot is moved to the kerb instead, because
 * nudging them while the step walks them back makes them flip back and forth on the spot.
 */
const ROAD_LOITER = new Set(["wait", "talk", "sit", "music", "craft", "eat", "book", "trade", "buy", "flirt", "kiss", "date"]);

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
  /** street litter, bins and the recycling run (sim/Litter.ts) */
  litter!: LitterState;
  vehicles: Vehicle[] = [];
  names?: NameBook;
  usedLooks = new Set<string>();
  /** money taken by each building's till */
  tills: Record<number, number> = {};
  crimes: Crime[] = [];
  bookings: Booking[] = [];
  /** tick a cop last had eyes on the wanted player */
  lastSeenByCops = 0;
  /** set when the player gets arrested (the UI shows the "busted" screen) */
  bustedAt = -1;
  bustedFine = 0;
  playerId = 0;
  charHash!: SpatialHash;
  expansion = newExpansion();
  life = newLife();
  private exploredFrom: { x: number; y: number } | null = null;
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
    spawnVehicles(this);
    this.litter = new LitterState(this.world, this.cfg.seed);
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
    for (const c of this.chars) if (c.lod !== Lod.SLEEP && c.inside < 0 && c.inCar < 0) h.insert(c.id, c.x, c.y);
  }

  // ------------------------------------------------------------------ tick
  step(): void {
    const t0 = performance.now();
    const dt = this.step_dt;
    this.tick++;
    if (this.tick % 60 === 0) {
      tickLife(this);
      const p = this.player;
      const from = this.exploredFrom;
      this.exploredFrom = { x: p.x, y: p.y };
      if (from && p.inCar < 0 && p.inside < 0) encounterAt(this.expansion, this.tick, Math.min(8, Math.hypot(p.x - from.x, p.y - from.y)), this.rng.next());
      const settlement = farmDay(this.expansion, this.tick, this.env.raining);
      if (settlement) { p.cash = Math.max(0, p.cash + settlement.net); this.toasts.push({ text: `Farm day: sales $${settlement.gross}, costs $${settlement.costs}, net $${settlement.net}`, tick: this.tick, kind: "" }); }
    }
    this.metrics.aiDecisions = 0; this.metrics.bgThinks = 0;
    this.charHash.queries = 0; this.charHash.candidatesVisited = 0;
    if (this.tick % 60 === 0) updateEnvironment(this);
    this.rebuildHash();
    if (this.tick % 30 === 0) this.lod.update(this);

    let aiMs = 0;
    const tm = performance.now();
    for (const c of this.chars) {
      if (c.inCar >= 0) continue; // the car carries them (updated in Traffic)
      if (c.inside >= 0) {
        // indoors: nothing to simulate until they come back out
        if (this.tick >= c.insideUntil && this.tick % 15 === c.id % 15) {
          const b = this.world.buildings[c.inside];
          if (b && c.jailUntil === 0) insideOutcome(this, c, b);
          if (c.jailUntil > 0) { if (this.tick >= c.jailUntil) { c.jailUntil = 0; exitBuilding(this, c); this.emit({ type: "released", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} was released from the cells` }); } }
          else exitBuilding(this, c);
        }
        continue;
      }
      c.px = c.x; c.py = c.y;
      if (c.role === "overcoder") { c.vx = c.vy = 0; c.x = c.pathGoalX; c.y = c.pathGoalY; c.mode = "idle"; continue; } // Terrance holds his post
      if (updateCustody(this, c) || this.tick < c.stunUntil) {
        if (this.tick < c.stunUntil) { c.vx = c.vy = 0; c.anim.pose = "stunned"; }
        this.moveCharacter(c, dt);
        continue;
      }
      const interval = LOD_INTERVAL[c.lod];
      if (this.tick >= c.nextThink) {
        const ta = performance.now();
        const tdt = interval * dt;
        updateHealth(this, c, tdt);
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

    updateVehicles(this, dt);
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

    if (this.tick % 120 === 0) { this.groups.update(this.chars, this.tick); updateLitter(this); }
    if (this.tick % 30 === 0) this.policeTick();
    if (this.tick % 60 === 0) for (const [id, at] of this.pendingAmbulance) {
      const c = this.chars[id];
      if (!c || c.blood >= 0.35 && c.phys !== Phys.DOWN) { this.pendingAmbulance.delete(id); continue; }
      if (this.tick >= at) { this.pendingAmbulance.delete(id); hospitalise(this, c); }
    }
    if (this.tick % 60 === 0) this.housekeeping();
    // nothing (car exits, knockbacks, doors on the edge) may leave anyone outside the map
    const lim = this.world.size - 0.3;
    for (const c of this.chars) { if (c.x < 0.3) c.x = 0.3; else if (c.x > lim) c.x = lim; if (c.y < 0.3) c.y = 0.3; else if (c.y > lim) c.y = lim; }
    this.metrics.stepMs = performance.now() - t0;
  }

  /** Physics hooks are installed by Rules. */
  hooks!: import("../physics/PhysicsWorld").PhysicsHooks;

  private moveCharacter(c: Character, dt: number): void {
    if (c.phys === Phys.DOWN || c.phys === Phys.RECOVER) { c.vx = 0; c.vy = 0; }
    let vx = c.vx, vy = c.vy;
    if (c.phys === Phys.STUMBLE) { vx *= 0.2; vy *= 0.2; }
    // a hurt body moves like one: a bad leg limps and slows, a hurt torso hunches and slows, a knock to the head weaves
    if (c.wounds.length && (vx !== 0 || vy !== 0)) {
      const h = hurtOf(c), slow = Math.max(0.4, 1 - h.leg * 0.14 - h.torso * 0.06);
      vx *= slow; vy *= slow;
      if (h.head >= 2) { const w = Math.sin(this.tick * 0.06 + c.id) * 0.35 * Math.min(1, h.head / 4), sp = Math.hypot(vx, vy) || 1; const ox = -vy / sp, oy = vx / sp; vx += ox * w * sp; vy += oy * w * sp; }
    }
    if (c.tier !== "player" && c.mode !== "panic") {
      const h = this.hour, park = this.world.areaAt(c.x, c.y)?.kind === "park";
      const pace = (h >= 7 && h < 9.5 ? 1.12 : h >= 18 ? 0.9 : 1) * (park ? 0.82 : 1) * (0.75 + c.needs.energy * 0.3);
      vx *= pace; vy *= pace;
    }
    // local avoidance: separation from neighbours (full/reduced only)
    if (c.lod <= Lod.REDUCED) {
      const n = this.charHash.query(c.x, c.y, 0.75, this.tmp);
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        const o = this.chars[this.tmp[i]];
        if (o === c || o.inside >= 0 || o.inCar >= 0) continue;
        const dx = c.x - o.x, dy = c.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.0001 || d2 > 0.5) continue;
        const d = Math.sqrt(d2), push = (0.72 - d) / 0.72;
        sx += (dx / d) * push; sy += (dy / d) * push;
      }
      // anticipation: someone coming the other way within a few steps? pass on the left, early, like
      // people do (eye contact, a small sidestep), instead of bumping and correcting at the last moment
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 0.1) {
        const ux = c.vx / sp, uy = c.vy / sp;
        const m2 = this.charHash.query(c.x + ux * 1.4, c.y + uy * 1.4, 1.3, this.tmp);
        for (let i = 0; i < m2; i++) {
          const o = this.chars[this.tmp[i]];
          if (o === c || o.inside >= 0 || o.inCar >= 0) continue;
          const dx = o.x - c.x, dy = o.y - c.y, ahead = dx * ux + dy * uy, side = dx * -uy + dy * ux;
          const oncoming = (o.vx * ux + o.vy * uy) < 0.2;
          if (ahead > 0.2 && ahead < 2.4 && Math.abs(side) < 0.7 && oncoming) { const k = (1 - ahead / 2.4) * 0.9; sx += uy * k; sy += -ux * k; break; } // left of travel = (uy, -ux) in screen-iso world
        }
      }
      // capped, gentle push: people step round each other instead of jittering
      const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m; }
      vx += sx * 1.2; vy += sy * 1.2;
    }
    // nobody stands about in the road: someone stopped in a lane (chatting, waiting, idling, getting up after a fall)
    // steps up onto the footpath. Not people on a job there: cops on a chase, medics, anyone fighting or fleeing.
    if (this.kerbStep(c)) { vx = this.kerb.x; vy = this.kerb.y; }
    if ((vx !== 0 || vy !== 0) && c.tier !== "player" && this.trafficAhead(c, vx, vy)) { vx = 0; vy = 0; c.vx = 0; c.vy = 0; }
    if (vx !== 0 || vy !== 0) {
      const blocked = this.physics.moveCircle(c, vx * dt, vy * dt);
      if (c.vx !== 0 || c.vy !== 0) c.facing = Math.atan2(c.vy, c.vx);
      if (blocked) c.stuck += dt;
    }
    this.physics.stepCharacter(c, dt, this.hooks);
    // the map has hard edges: knockbacks and car exits can't push anyone off it
    const lim = this.world.size - 0.3;
    if (c.x < 0.3) c.x = 0.3; else if (c.x > lim) c.x = lim;
    if (c.y < 0.3) c.y = 0.3; else if (c.y > lim) c.y = lim;
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

  /**
   * About to step off the kerb? Wait there. People start across a crossing only on the green man
   * (whoever is already on it when it changes keeps going), and never step out in front of a moving
   * car. Cops on a chase and people on the run ignore the signal, not the cars.
   */
  private kerb = { x: 0, y: 0 };
  /** Someone standing still in a lane who has no business there: the velocity that takes them onto the footpath. */
  private kerbStep(c: Character): boolean {
    if (c.vx !== 0 || c.vy !== 0 || c.tier === "player" || c.phys !== Phys.OK || c.pursuing >= 0 || c.wanted > 0) return false;
    if (!this.world.carriageway(c.x, c.y) || !this.loiteringInRoad(c)) return false;
    const p = this.world.nearestFoot(c.x, c.y), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, sp = c.speed * 1.15;
    this.kerb.x = ((p.x - c.x) / d) * sp; this.kerb.y = ((p.y - c.y) / d) * sp; c.facing = Math.atan2(this.kerb.y, this.kerb.x);
    return true;
  }

  /** Is this person just hanging about (so should not be doing it in a lane), rather than busy with something there? */
  private loiteringInRoad(c: Character): boolean {
    if (c.mode === "idle" || c.mode === "talk") return true;
    const st = c.goal?.plan[c.goal.stepIdx];
    return !!st && ROAD_LOITER.has(st.kind);
  }

  trafficAhead(c: Character, vx: number, vy: number, reach = 0.6): boolean {
    const sp = Math.hypot(vx, vy) || 1;
    const nx = c.x + (vx / sp) * reach, ny = c.y + (vy / sp) * reach;
    const ntx = Math.floor(nx), nty = Math.floor(ny);
    const t = this.world.tile(ntx, nty);
    if (t !== 16 && t !== 18) return false; // road or crossing
    const onRoad = this.world.tile(Math.floor(c.x), Math.floor(c.y));
    if (onRoad === 16 || onRoad === 18) return false; // already crossing: keep going
    if (t === 18 && c.pursuing < 0 && !(c.wanted > 0) && walkSignal(this.world, ntx, nty, this.tick) !== "walk") return true;
    // nerves: someone scared, or who was hit by a car not long ago, leaves a much bigger gap before stepping out
    const hitByCar = c.lastHitBy <= -100 && this.tick - c.lastHitTick < 60 * 60 * 3;
    const wary = 1 + c.emo.fear * 1.2 + (hitByCar ? 1.5 : 0);
    for (const v of this.vehicles) {
      if (Math.abs(v.speed) < 0.5) continue;
      const dx = c.x - v.x, dy = c.y - v.y, d = Math.hypot(dx, dy);
      if (d > (2 + Math.abs(v.speed) * 0.9) * wary) continue;
      if ((dx * Math.cos(v.heading) + dy * Math.sin(v.heading)) / (d || 1) > 0.3) return true;
    }
    return false;
  }

  private moveSimple(c: Character, dt: number): void {
    let vx = c.vx, vy = c.vy;
    if (this.kerbStep(c)) { vx = this.kerb.x; vy = this.kerb.y; }
    if (vx === 0 && vy === 0) return;
    if (this.trafficAhead(c, vx, vy, Math.max(0.6, Math.hypot(vx, vy) * dt + 0.3))) return;
    const lim = this.world.size - 0.3;
    const nx = Math.min(lim, Math.max(0.3, c.x + vx * dt)), ny = Math.min(lim, Math.max(0.3, c.y + vy * dt));
    if (this.world.walkable(nx, ny)) { c.x = nx; c.y = ny; c.facing = Math.atan2(vy, vx); }
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

  // ------------------------------------------------------------------ city: money, police, cars
  wagePerHour(c: Character): number {
    const w: Record<string, number> = { office: 32, cop: 38, medic: 40, dealer: 30, chef: 26, barista: 25, shopkeeper: 25, mechanic: 30, bouncer: 28, cleaner: 24, vendor: 24, taxi: 26, driver: 25, photographer: 35 };
    return (w[c.role] ?? 23) * (c.id === this.playerId ? wageBoost(this.expansion) : 1);
  }

  /** Passers-by sometimes drop a coin in the busker's case. */
  tipBusker(b: Character): void {
    const n = this.charHash.query(b.x, b.y, 4, this.tmp);
    for (let i = 0; i < n; i++) {
      const c = this.chars[this.tmp[i]];
      if (c === b || c.cash < 5 || c.tier === "player" || !this.rng.chance(0.15 + c.pers.kindness * 0.2)) continue;
      const tip = this.rng.pick([1, 2, 2, 5]);
      c.cash -= tip; b.cash += tip;
      this.bus.emit("fx", { kind: "cash", x: b.x, y: b.y, z: 0.4, n: 1 });
      applyInteraction(b, c, "gift", true, this.tick, 0.3);
      if (this.rng.chance(0.3)) this.emit({ type: "tip", x: b.x, y: b.y, actors: [c.id, b.id], summary: `${c.name} tipped ${b.name} ${fmtCash(tip)} for the busking` });
      return;
    }
  }

  /** NPC barter: offer the least-loved item (plus cash if needed) for something liked. */
  npcTrade(c: Character, o: Character): boolean {
    const want = carried(o).map((id) => this.toys[id]).find((t) => t && c.likes.includes(t.def) && t.owner === o.id);
    if (!want) return false;
    const mine = carried(c).map((id) => this.toys[id]).filter((t) => t && t.id !== want.id && !c.likes.includes(t.def));
    const offer = { items: mine.slice(0, 1).map((t) => t.id), cash: 0 };
    let v = evaluateTrade(this, o, c, offer, { items: [want.id], cash: 0 });
    if (!v.accept && v.counterCash > 0 && v.counterCash <= c.cash && v.counterCash < 200) { offer.cash = v.counterCash; v = evaluateTrade(this, o, c, offer, { items: [want.id], cash: 0 }); }
    if (!v.accept) { this.say(o, this.dialogue.bark(o, "trade_no", c), "say", 1.8); return false; }
    this.say(c, this.dialogue.bark(c, "trade_ask", o, { toy: TOYS[want.def].name }), "say", 1.8);
    return executeTrade(this, c, o, offer, { items: [want.id], cash: 0 });
  }

  /** A moving car hits someone: knockback scaled by speed and mass, cartoon blood at speed. */
  onCarHit(v: Vehicle, c: Character, speed: number): void {
    if (c.lastHitTick > this.tick - 30 && c.lastHitBy === -100 - v.id) return;
    c.lastHitTick = this.tick; c.lastHitBy = -100 - v.id;
    const d = VEHICLES[v.cls];
    const nx = Math.cos(v.heading), ny = Math.sin(v.heading);
    const res = applyImpact(c, Math.min(this.cfg.maxImpulse * 1.5, speed * d.mass * 1.1), nx, ny, false, this.cfg.maxImpulse * 1.5);
    // a real pedestrian strike: past a jog the person is carried off at most of the car's speed and thrown up in an
    // arc (they fly, land and slide; PhysicsWorld.stepCharacter does the rest). The car barely notices the mass.
    if (speed > 3) {
      const cv = carVel(this, v), sv = Math.hypot(cv.x, cv.y) || 1, carry = 0.82;
      c.kx = cv.x / sv * speed * carry; c.ky = cv.y / sv * speed * carry;
      c.vz = 1.2 + speed * 0.32;
    } else c.vz = 2 + speed * 0.2;
    v.speed *= 1 - Math.min(0.25, 0.09 / d.mass);
    if (v.vx !== undefined && v.vy !== undefined) { const k = 1 - Math.min(0.25, 0.09 / d.mass); v.vx *= k; v.vy *= k; }
    v.damage = Math.min(1, v.damage + 0.03);
    bump(v, Math.cos(v.heading), Math.sin(v.heading), Math.min(0.08, speed * 0.008));
    this.bus.emit("sound", { kind: "carhit", x: c.x, y: c.y, vol: Math.min(1, speed / 8) });
    if (speed > 3.5) { const part = speed > 7 && this.rng.chance(0.4) ? "head" : this.rng.chance(0.5) ? "leg" : "torso"; wound(this, c, part, speed > 7 ? 3 : 2, part === "head" ? "gash" : "cut", v.driver, v.x, v.y); }
    const driver = v.driver >= 0 ? this.chars[v.driver] : null;
    remember(c, { t: this.tick, kind: "car_hit", subj: driver?.id ?? -1, obj: c.id, toy: null, area: this.world.areaAt(c.x, c.y)?.id ?? 0, val: -0.8, ev: -1, src: "did" });
    const e = this.emit({ type: "car_hit", x: c.x, y: c.y, actors: driver ? [driver.id, c.id] : [c.id], severity: res.down ? 4 : 3, summary: `${driver ? driver.name : "A car"} hit ${c.name} with a ${d.name.toLowerCase()}${res.down ? " and knocked them flat" : ""}` });
    if (c.tier !== "player") this.say(c, this.dialogue.bark(c, res.down ? "down" : "hit"), "shout", 1.5);
    if (driver) {
      const rr = this.relate(c, driver.id); rr.grudge = Math.min(1, rr.grudge + 0.5);
      if (driver.tier === "player" || driver.pers.honesty < 0.4) commitCrime(this, driver, "hit_and_run", c);
      else if (e) { v.speed = 0; this.say(c, "Watch the road!", "shout", 1.5); }
    }
  }

  onCarCrash(a: Vehicle, b: Vehicle, rel: number): void {
    if (a.state === "crashed" && b.state === "crashed") return;
    for (const v of [a, b]) { v.damage = Math.min(1, v.damage + rel * 0.03); if (v.state !== "parked") { v.state = "crashed"; v.crashedUntil = this.tick + 60 * (v.driver === this.playerId ? 1 : 6); } v.speed *= 0.2; }
    this.bus.emit("sound", { kind: "crash", x: a.x, y: a.y, vol: Math.min(1, rel / 8) });
    this.bus.emit("fx", { kind: "break", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0.5, n: 14, color: "#9a8d80" });
    const da = a.driver >= 0 ? this.chars[a.driver] : null, db = b.driver >= 0 ? this.chars[b.driver] : null;
    const e = this.emit({ type: "car_crash", x: a.x, y: a.y, actors: [da?.id ?? -1, db?.id ?? -1].filter((x) => x >= 0), severity: 3, summary: `Crash: ${da ? da.name : "a parked car"}'s ${VEHICLES[a.cls].name} and ${db ? db.name : "a parked car"}'s ${VEHICLES[b.cls].name}` });
    // both drivers get out and have words (road rage chain)
    if (da && db && da.tier !== "player" && db.tier !== "player") {
      // both cars slide to a stop on their own momentum (state "crashed" parks them once nobody is in them)
      unseat(this, a); unseat(this, b);
      const ra = this.relate(da, db.id), rb = this.relate(db, da.id); ra.grudge = Math.min(1, ra.grudge + 0.3); rb.grudge = Math.min(1, rb.grudge + 0.3);
      this.emitArgument(da, db, e);
      this.carsToReclaim.push({ v: a.id, c: da.id, at: this.tick + 60 * 25 }, { v: b.id, c: db.id, at: this.tick + 60 * 25 });
    } else if (da?.tier === "player" && b.driver >= 0 || db?.tier === "player" && a.driver >= 0) {
      const p = this.player;
      if (this.rng.chance(0.5)) commitCrime(this, p, "hit_and_run", da?.tier === "player" ? db : da);
    }
  }
  /** drivers walk back to their car after an argument */
  carsToReclaim: { v: number; c: number; at: number }[] = [];
  private abandoned = new Map<number, number>();

  /** Move a car to a clear stretch of road far from the camera (towing, gridlock). */
  relocateCar(v: Vehicle, drv: Character | null): void {
    const lines = this.world.maxLine, P = this.world.period;
    for (let tries = 0; tries < 30; tries++) {
      const dir = this.rng.int(0, 3), line = this.rng.int(0, lines), along = this.rng.range(4, this.world.size - 4), lane = this.rng.int(0, 1);
      const m = along % P;
      if (m < ROAD_W + CROSS_W + 1.5 || m > P - CROSS_W - 1.5) continue; // mid-block: clear of junctions and crossings
      const lc = laneCoord(dir, line, lane);
      const x = dir % 2 === 0 ? along : lc, y = dir % 2 === 0 ? lc : along;
      if (this.world.tile(Math.floor(x), Math.floor(y)) !== 16) continue; // plain road, not a crossing
      if (Math.hypot(x - this.focus.x, y - this.focus.y) < 25 || this.vehicles.some((o) => o !== v && Math.hypot(o.x - x, o.y - y) < 3)) continue;
      v.x = v.px = x; v.y = v.py = y; v.dir = dir; v.heading = dir * Math.PI / 2; v.speed = 0; v.damage = 0; v.nextDir = -1; v.state = "drive"; v.stuck = 0;
      clearLaneState(v);
      if (drv) { if (drv.inCar >= 0 && drv.inCar !== v.id) continue; drv.inCar = v.id; v.driver = drv.id; drv.goal = null; } else v.state = "parked";
      return;
    }
  }

  /** Police dispatch for the wanted player, cops leaving cars to chase on foot, wanted-level decay. */
  private policeTick(): void {
    const p = this.player;
    for (const r of this.carsToReclaim.splice(0)) {
      if (this.tick < r.at) { this.carsToReclaim.push(r); continue; }
      const v = this.vehicles[r.v], c = this.chars[r.c];
      if (v && c && c.inCar < 0 && c.inside < 0 && c.phys === Phys.OK && c.arrestedBy < 0 && Math.hypot(v.x - c.x, v.y - c.y) < 6 && v.driver < 0) { v.driver = c.id; c.inCar = v.id; v.state = "free"; v.state = "crashed"; v.crashedUntil = this.tick + 30; c.goal = null; }
    }
    // abandoned cars left in the road get towed (and a new car joins traffic elsewhere)
    for (const v of this.vehicles) {
      if (v.driver >= 0 || v.state !== "parked" || !this.world.isRoadLine(Math.floor(v.x)) && !this.world.isRoadLine(Math.floor(v.y)) || this.world.tile(Math.floor(v.x), Math.floor(v.y)) === 20) { this.abandoned.delete(v.id); continue; }
      const since = this.abandoned.get(v.id) ?? this.tick;
      this.abandoned.set(v.id, since);
      if (this.tick - since < 60 * 120 || this.player.inCar === v.id) continue;
      this.abandoned.delete(v.id);
      this.emit({ type: "towed", x: v.x, y: v.y, summary: `A tow truck took away the ${VEHICLES[v.cls].name.toLowerCase()} (${v.plate}) blocking the road` });
      const drv = this.chars.find((c) => c.tier === "background" && c.inCar < 0 && c.inside < 0 && c.lod >= Lod.BACKGROUND);
      this.relocateCar(v, drv ?? null);
    }
    // gridlock breaker: a stuck traffic car quietly rejoins traffic somewhere else (off-camera first)
    for (const v of this.vehicles) {
      if (v.state !== "drive" || v.siren || this.player.inCar === v.id || v.driver < 0) continue;
      const far = Math.hypot(v.x - this.focus.x, v.y - this.focus.y) > 18;
      if (v.stuck > (far ? 6 : 18)) this.relocateCar(v, this.chars[v.driver]);
    }
    // cops in pursuing cars bail out near a suspect on foot
    for (const v of this.vehicles) {
      if (!v.siren || v.driver < 0) continue;
      const cop = this.chars[v.driver];
      const s = cop ? this.chars[cop.pursuing] : undefined;
      if (!cop || !s || s.jailUntil > 0) { v.siren = false; if (cop) cop.pursuing = -1; continue; }
      if (s.inCar < 0 && Math.hypot(s.x - v.x, s.y - v.y) < 7) { v.speed = 0; unseat(this, v); v.state = "parked"; forceGoal(cop, this, "pursue", { u: 1, target: s.id }); }
    }
    if (p.wanted > 0) {
      // keep enough officers on the case
      const on = this.chars.filter((c) => c.role === "cop" && c.pursuing === p.id).length;
      if (on < Math.min(4, p.wanted)) {
        const free = this.chars.filter((c) => c.role === "cop" && c.pursuing < 0 && c.jailUntil === 0 && c.phys === Phys.OK).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (free) {
          free.pursuing = p.id;
          if (free.inside >= 0) exitBuilding(this, free);
          if (free.inCar >= 0) this.vehicles[free.inCar].siren = true; else forceGoal(free, this, "pursue", { u: 1, target: p.id });
        }
      }
      // seen?
      for (const c of this.chars) if (c.role === "cop" && c.inside < 0 && Math.hypot(c.x - p.x, c.y - p.y) < 10 && this.world.lineOfSight(c.x, c.y, p.x, p.y)) { this.lastSeenByCops = this.tick; break; }
      if (this.tick - this.lastSeenByCops > 60 * 12) {
        p.wanted = Math.max(0, p.wanted - 1); this.lastSeenByCops = this.tick;
        this.emit({ type: "wanted", x: p.x, y: p.y, actors: [p.id], data: { stars: p.wanted }, summary: p.wanted ? `The police are losing your trail (${p.wanted}★)` : "The police lost you. Wanted level cleared." });
        if (!p.wanted) for (const c of this.chars) if (c.pursuing === p.id) { c.pursuing = -1; c.goal = null; }
      }
    }
  }

  forceFollow(c: Character, leader: Character): void { forceGoal(c, this, "follow", { u: 2, target: leader.id }); }

  /** Send the nearest paramedic; if nobody can come, the ambulance does it after a minute. */
  callAmbulance(c: Character): void {
    const medic = this.chars.filter((m) => m.role === "medic" && m.phys === Phys.OK && m.jailUntil === 0).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    if (medic) { if (medic.inside >= 0) exitBuilding(this, medic); if (medic.inCar >= 0) unseat(this, this.vehicles[medic.inCar]); forceGoal(medic, this, "treat", { u: 2, target: c.id }); }
    // a second 111 call doesn't push the ambulance back
    if (!this.pendingAmbulance.has(c.id)) this.pendingAmbulance.set(c.id, this.tick + 60 * 75);
  }
  pendingAmbulance = new Map<number, number>();

  /** Player arrested: fine, weapons confiscated, released at the station. */
  busted(cop: Character): void {
    const p = this.player;
    if (p.inCar >= 0) { const v = this.vehicles[p.inCar]; if (v) { v.driver = -1; v.state = "parked"; } p.inCar = -1; }
    const fine = Math.min(p.cash, Math.max(20, Math.round(p.cash * 0.1) + p.wanted * 50));
    p.cash -= fine; this.bustedFine = fine;
    for (const id of carried(p)) { const t = this.toys[id]; if (t && TOYS[t.def].category === "weapon") { detach(p, id); t.state = "broken"; t.x = -100; t.holder = -1; } }
    p.wanted = 0; p.arrestedBy = -1;
    for (const c of this.chars) if (c.pursuing === p.id) { c.pursuing = -1; c.goal = null; }
    const st = this.world.buildings.find((b) => b.kind === "police");
    if (st) { const w = this.world.nearestWalkable(st.door.x + 0.5, st.door.y + 1.5); p.x = p.px = w.x; p.y = p.py = w.y; }
    this.bustedAt = this.tick;
    this.emit({ type: "busted", x: p.x, y: p.y, actors: [cop.id, p.id], summary: `BUSTED by ${cop.name}. Fined ${fmtCash(fine)}.` });
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

  /** tick before which each character can't attack again (weapon rate of fire) */
  nextAttack = new Map<number, number>();
  /** cartoon blood on or off (settings) */
  fakeBlood = true;

  /** Bare-fisted punch: lands on whoever is in front, with a light knock and small damage. No toy involved. */
  punchHeld(c: Character): number {
    if ((this.nextAttack.get(c.id) ?? 0) > this.tick) return 0;
    this.nextAttack.set(c.id, this.tick + Math.round(0.45 * 60));
    const n = swingHits(c, 1.1, this.chars, this.charHash, this.tmp2, this.hits);
    this.lod.markHot(c.id, this.tick);
    for (let i = 0; i < n; i++) {
      const v = this.hits[i];
      if (v.lastHitBy === c.id && this.tick - v.lastHitTick < 20) continue; // per-pair hit cooldown
      const nx = (v.x - c.x) || 0.01, ny = (v.y - c.y) || 0.01, nl = Math.hypot(nx, ny);
      applyImpact(v, 0.6 * (0.8 + c.pers.boldness * 0.4), nx / nl, ny / nl, shieldBlocks(v, this.toys, c.x, c.y), this.cfg.maxImpulse, 0.5);
      v.lastHitBy = c.id; v.lastHitTick = this.tick;
    }
    if (n) this.bus.emit("sound", { kind: "swish", x: c.x, y: c.y, vol: 0.2 });
    return n;
  }

  swingHeld(c: Character): number {
    if (c.hand < 0) return 0;
    const t = this.toys[c.hand], d = TOYS[t.def];
    const ws = d.weapon;
    if ((this.nextAttack.get(c.id) ?? 0) > this.tick) return 0;
    this.nextAttack.set(c.id, this.tick + Math.round((ws?.rate ?? 0.55) * 60));
    const reach = ws?.reach ?? 1.25;
    const n = swingHits(c, reach, this.chars, this.charHash, this.tmp2, this.hits);
    this.bus.emit("sound", { kind: "swish", x: c.x, y: c.y, vol: 0.35 });
    this.lod.markHot(c.id, this.tick);
    for (let i = 0; i < n; i++) {
      const v = this.hits[i];
      if (v.lastHitBy === c.id && this.tick - v.lastHitTick < 20) continue; // per-pair hit cooldown
      const nx = (v.x - c.x) || 0.01, ny = (v.y - c.y) || 0.01, nl = Math.hypot(nx, ny);
      const blocked = shieldBlocks(v, this.toys, c.x, c.y);
      const res = applyImpact(v, (ws?.knockback ?? d.punch) * (0.8 + c.pers.boldness * 0.4), nx / nl, ny / nl, blocked, this.cfg.maxImpulse, ws?.damage ?? 1);
      t.durability -= 2;
      if (!blocked && ws && this.fakeBlood && this.rng.chance(ws.blood)) this.bus.emit("fx", { kind: "blood", x: v.x, y: v.y, z: 1.2, n: 8 + Math.round(ws.damage * 4), color: "#b3121b" });
      this.onImpact(c, v, t.def, res, true);
      if (t.durability <= 0) this.physics.breakToy(t, c.id, this.tick, this.hooks);
    }
    return n;
  }

  /** Shared bookkeeping for any hit (thrown or melee) after the physical response. Implemented in Rules. */
  onImpact!: (attacker: Character, victim: Character, def: string, res: ReturnType<typeof applyImpact>, melee: boolean) => void;

  shootAt(c: Character, tx: number, ty: number, targetId: number): boolean {
    if (c.hand >= 0 && TOYS[this.toys[c.hand]?.def]?.weapon?.gun) return this.fireGun(c, tx, ty, targetId); // firearms: sim/Turf.ts
    const weapon = c.hand >= 0 ? TOYS[this.toys[c.hand]?.def]?.weapon : undefined;
    if ((this.nextAttack.get(c.id) ?? 0) > this.tick) return false;
    this.nextAttack.set(c.id, this.tick + Math.round((weapon?.rate ?? 0.9) * 60));
    const ammo = weapon?.ammo ?? "dart";
    const dart = this.spawnToy(ammo, c.x + Math.cos(c.facing) * 0.4, c.y + Math.sin(c.facing) * 0.4, c.z + 1.2);
    if (!dart) return false;
    const acc = (weapon?.accuracy ?? 0.7) * (c.tier === "player" ? 1.15 : 0.75 + c.emo.confidence * 0.3);
    const a = Math.atan2(ty - c.y, tx - c.x) + this.rng.gauss() * (1 - Math.min(1, acc)) * 0.25;
    const d = Math.min(weapon?.reach ?? 9, Math.hypot(tx - c.x, ty - c.y)), s = ammo === "droplet" ? 9 : 14, time = d / s;
    dart.vx = Math.cos(a) * s; dart.vy = Math.sin(a) * s; dart.vz = (1.0 - 1.2) / Math.max(0.1, time) + 0.5 * 14 * time;
    dart.state = "flying"; dart.thrower = c.id; dart.throwTick = this.tick; dart.angle = a;
    if (targetId >= 0) this.throwIntent.set(dart.id, targetId);
    this.bus.emit("sound", { kind: ammo === "pellet" ? "paintball" : ammo === "droplet" ? "squirt" : ammo === "probe" ? "taser" : "twang", x: c.x, y: c.y, vol: 0.35 });
    return true;
  }

  startConversation(c: Character, t: Character, topic: string): boolean { return this.dialogue.start(c, t, topic); }
  endConversation(c: Character): void { this.dialogue.end(c); }
  afterConversation(fn: () => void): void { this.deferred.push(fn); }

  comfort(c: Character, t: Character): void {
    if (t.wounds.some((w) => !w.bandaged)) { if (!useBandage(this, c, t)) { for (const w of t.wounds) if (w.severity >= 2) w.bandaged = this.rng.chance(0.5); recomputeBleed(t); } }
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
    const tools = ["camera", "taser", "spray_can"];
    const items = [c.hand, ...c.bag].filter((x) => x >= 0).map((x) => this.toys[x]).filter((t) => !tools.includes(t.def) && TOYS[t.def].category !== "valuable");
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

  // ------------------------------------------------------------------ firearms & turf war (sim/Turf.ts)
  /** Fire the held gun at a point (muzzle flash, casing, bang, bullets; witnessed = "gunfire" crime). */
  fireGun(c: Character, tx: number, ty: number, targetId = -1): boolean { return fireGun(this, c, tx, ty, targetId); }
  /** Kick off a Famiglia vs Riccarton Boys skirmish now (missions, dev panel). */
  startTurfWar(): boolean { return startTurfWar(this, true); }
  /** The skirmish in progress, if any. */
  get turfWar(): { x: number; y: number; area: string } | null { return turfWarActive(this); }
}

export type { Choice };
