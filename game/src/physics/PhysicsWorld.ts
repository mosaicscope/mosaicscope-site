import { World, SOLID, TILE_HEIGHT } from "../world/World";
import { SpatialHash } from "../world/SpatialHash";
import { Character, Phys, Toy } from "../entities/types";
import { TOYS } from "../content/toys";
import { canCollide, LAYER, MASK } from "./layers";
import { clamp } from "../core/math";

export const GRAVITY = 14;
/** World modifier: toy gravity as a fraction of GRAVITY (1 = normal, 0.35 = low-gravity toys). */
export let gravityScale = 1;
export function setGravityScale(v: number): void { gravityScale = Math.max(0.1, Math.min(2, v)); }
export const CHAR_HEIGHT = 1.75;
/** Quadratic air drag per unit of (radius / mass). */
const AIR_DRAG = 0.05;
/** Ground friction: deceleration in tiles/s² per unit of a toy's friction. */
const GROUND_FRICTION = 2.2;
/** A glancing wall hit keeps most, not all, of the speed along the wall. */
const WALL_SCRUB = 0.88;
/** People: how hard feet (standing) or a sliding body (down) brake a shove, in tiles/s². */
const FEET_GRIP = 12, BODY_SLIDE = 7.5;

export interface PhysicsHooks {
  onToyHitChar(toy: Toy, c: Character, impulse: number, nx: number, ny: number): void;
  onToyHitToy(a: Toy, b: Toy, impulse: number): void;
  onToyBounce(t: Toy, speed: number, wall: boolean): void;
  onToyBreak(t: Toy, by: number): void;
  onSpring(t: Toy | null, c: Character | null, x: number, y: number): void;
}

/**
 * Lightweight 2.5D rigid-body physics specialised for toys: circles on the ground plane plus a height
 * axis. Swept sub-stepping prevents tunnelling; layers/masks filter contacts; sleeping bodies cost
 * nothing. Characters are kinematic circles that receive bounded knockback impulses.
 */
export class PhysicsWorld {
  readonly world: World;
  toyHash: SpatialHash;
  maxImpulse: number;
  springPads: { x: number; y: number }[] = [];
  /** metrics */
  activeBodies = 0;
  contacts = 0;
  contactPoints: { x: number; y: number; z: number }[] = [];
  private tmp: number[] = [];

  constructor(world: World, maxImpulse = 9) {
    this.world = world;
    this.toyHash = new SpatialHash(world.size, world.size, 2, 256);
    this.maxImpulse = maxImpulse;
    this.springPads = world.pois.filter((p) => p.kind === "springpad").map((p) => ({ x: p.x, y: p.y }));
  }

  /** Solid at this point for something at height z? Low walls (fences) can be cleared by airborne toys. */
  blocked(x: number, y: number, z: number): boolean {
    const t = this.world.tile(Math.floor(x), Math.floor(y));
    if (!SOLID.has(t)) return false;
    const h = TILE_HEIGHT[t] ?? 99;
    return z < h;
  }

  step(dt: number, toys: Toy[], chars: Character[], charHash: SpatialHash, tick: number, hooks: PhysicsHooks): void {
    this.activeBodies = 0; this.contacts = 0;
    if (this.contactPoints.length > 64) this.contactPoints.length = 0;
    const th = this.toyHash;
    th.clear();
    for (let i = 0; i < toys.length; i++) { const t = toys[i]; if (t.state !== "broken" && t.state !== "held") th.insert(i, t.x, t.y); }

    for (let i = 0; i < toys.length; i++) {
      const t = toys[i];
      t.px = t.x; t.py = t.y; t.pz = t.z;
      if (t.state === "held" || t.state === "broken") continue;
      const speed2 = t.vx * t.vx + t.vy * t.vy + t.vz * t.vz;
      const grounded = t.z <= this.world.groundZ(t.x, t.y) + 1e-3;
      if (t.state === "rest" && grounded && speed2 < 1e-4 && t.tether < 0) {
        // sleeping: only spring pads can wake it
        continue;
      }
      this.activeBodies++;
      this.integrateToy(t, dt, toys, chars, charHash, tick, hooks);
    }
  }

  private integrateToy(t: Toy, dt: number, toys: Toy[], chars: Character[], charHash: SpatialHash, tick: number, hooks: PhysicsHooks): void {
    const speed = Math.sqrt(t.vx * t.vx + t.vy * t.vy + t.vz * t.vz);
    const sub = clamp(Math.ceil((speed * dt) / (t.radius * 0.7)), 1, 10);
    const h = dt / sub;
    // air drag grows with the square of speed; big light things (foam, plush) feel it, dense small ones barely do
    const drag = AIR_DRAG * t.radius / Math.max(0.15, t.mass);
    for (let s = 0; s < sub; s++) {
      t.vz -= GRAVITY * gravityScale * h;
      const v3 = Math.sqrt(t.vx * t.vx + t.vy * t.vy + t.vz * t.vz);
      if (v3 > 0.5) { const k = Math.max(0, 1 - drag * v3 * h); t.vx *= k; t.vy *= k; t.vz *= k; }
      // X axis
      let nx = t.x + t.vx * h;
      if (this.blocked(nx + Math.sign(t.vx) * t.radius, t.y, t.z)) {
        const sp = Math.abs(t.vx);
        t.vx = -t.vx * t.restitution; nx = t.x; t.vy *= WALL_SCRUB; t.spin += t.vy * 2;
        if (sp > 1) hooks.onToyBounce(t, sp, true);
      }
      t.x = nx;
      let ny = t.y + t.vy * h;
      if (this.blocked(t.x, ny + Math.sign(t.vy) * t.radius, t.z)) {
        const sp = Math.abs(t.vy);
        t.vy = -t.vy * t.restitution; ny = t.y; t.vx *= WALL_SCRUB; t.spin -= t.vx * 2;
        if (sp > 1) hooks.onToyBounce(t, sp, true);
      }
      t.y = ny;
      t.z += t.vz * h;
      const gz = this.world.groundZ(t.x, t.y);
      if (t.z <= gz) {
        t.z = gz;
        if (t.vz < -2) {
          hooks.onToyBounce(t, -t.vz, false);
          // the contact patch grips during the bounce: the harder it lands, the more ground speed it loses
          const vt = Math.hypot(t.vx, t.vy), loss = Math.min(vt, -t.vz * (1 + t.restitution) * Math.min(0.6, t.friction * 0.12));
          if (vt > 1e-6) { const k = (vt - loss) / vt; t.vx *= k; t.vy *= k; t.spin += loss * 3 * Math.sign(t.vx + t.vy || 1); }
          t.vz = -t.vz * t.restitution * 0.8;
          if (t.vz < 1) t.vz = 0;
        } else t.vz = 0;
        // ground friction is a constant deceleration (Coulomb), not a fade: a ball rolls a long way, a crate grinds to
        // a stop, and both actually stop instead of creeping forever
        if (t.z <= gz + 1e-3) {
          const vt = Math.hypot(t.vx, t.vy), dec = t.friction * GROUND_FRICTION * gravityScale * h;
          if (vt <= dec) { t.vx = 0; t.vy = 0; } else { const k = (vt - dec) / vt; t.vx *= k; t.vy *= k; }
        }
      }
      t.angle += t.spin * h;
      t.spin *= 1 - 1.5 * h;
      // keep inside world
      const S = this.world.size;
      if (t.x < 0.2) { t.x = 0.2; t.vx = Math.abs(t.vx) * t.restitution; }
      if (t.y < 0.2) { t.y = 0.2; t.vy = Math.abs(t.vy) * t.restitution; }
      if (t.x > S - 0.2) { t.x = S - 0.2; t.vx = -Math.abs(t.vx) * t.restitution; }
      if (t.y > S - 0.2) { t.y = S - 0.2; t.vy = -Math.abs(t.vy) * t.restitution; }
    }

    // tether constraint (yo-yo, flail): pull back toward holder
    if (t.tether >= 0) {
      const c = chars[t.tether];
      if (c) {
        const dx = t.x - c.x, dy = t.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > t.tetherLen) {
          const ux = dx / d, uy = dy / d;
          t.x = c.x + ux * t.tetherLen; t.y = c.y + uy * t.tetherLen;
          const vr = t.vx * ux + t.vy * uy;
          if (vr > 0) { t.vx -= vr * ux * 1.8; t.vy -= vr * uy * 1.8; }
        }
        // reel in
        t.vx -= dx * 3 * dt; t.vy -= dy * 3 * dt;
        t.vz += (1.1 - t.z) * 4 * dt;
      } else t.tether = -1;
    }

    const sp2 = t.vx * t.vx + t.vy * t.vy;
    if (sp2 < 0.0004 && Math.abs(t.vz) < 0.01 && t.z <= this.world.groundZ(t.x, t.y) + 1e-3 && t.tether < 0) {
      t.vx = t.vy = t.vz = 0;
      if (t.state === "flying") t.state = "rest";
      if (TOYS[t.def].uses.includes("projectile") && t.durability <= 2) { t.state = "broken"; t.brokenAt = tick; }
    }

    this.toyVsChars(t, chars, charHash, tick, hooks);
    this.toyVsToys(t, toys, tick, hooks);
    this.springPadCheck(t, hooks);
  }

  private toyVsChars(t: Toy, chars: Character[], charHash: SpatialHash, tick: number, hooks: PhysicsHooks): void {
    if (t.hitUntil > tick || t.z > CHAR_HEIGHT) return;
    const sp = Math.sqrt(t.vx * t.vx + t.vy * t.vy + t.vz * t.vz);
    if (sp < 2.2) return;
    if (!canCollide(t.layer, t.mask, LAYER.CHAR, MASK.CHAR)) return;
    const n = charHash.query(t.x, t.y, t.radius + 0.45, this.tmp);
    for (let k = 0; k < n; k++) {
      const c = chars[this.tmp[k]];
      if (!c || c.id === t.holder || c.id === t.tether) continue;
      if (c.id === t.thrower && tick - t.throwTick < 25) continue;
      if (c.tier === "background") continue; // background silhouettes are scenery-level
      const dx = c.x - t.x, dy = c.y - t.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (d > c.radius + t.radius) continue;
      if (c.z > t.z + 0.3) continue;
      const nx = dx / d, ny = dy / d;
      const impulse = clamp(t.mass * sp * (TOYS[t.def].punch / 3) * 1.6, 0, this.maxImpulse);
      // bounce the toy off the body
      const vn = t.vx * nx + t.vy * ny;
      if (vn > 0) { t.vx -= (1 + t.restitution) * vn * nx; t.vy -= (1 + t.restitution) * vn * ny; }
      t.vx *= 0.6; t.vy *= 0.6; t.spin += (((t.id * 7919 + tick) % 100) / 100 - 0.5) * 10; // deterministic spin jitter
      t.hitUntil = tick + 12;
      t.durability -= impulse * 0.5;
      this.contacts++;
      this.contactPoints.push({ x: t.x, y: t.y, z: t.z });
      hooks.onToyHitChar(t, c, impulse, nx, ny);
      if (t.durability <= 0) this.breakToy(t, t.thrower, tick, hooks);
      return;
    }
  }

  private toyVsToys(t: Toy, toys: Toy[], tick: number, hooks: PhysicsHooks): void {
    const n = this.toyHash.query(t.x, t.y, t.radius + 0.5, this.tmp);
    for (let k = 0; k < n; k++) {
      const o = toys[this.tmp[k]];
      if (!o || o === t || o.state === "held" || o.state === "broken") continue;
      if (!canCollide(t.layer, t.mask, o.layer, o.mask)) continue;
      if (Math.abs(o.z - t.z) > Math.max(o.radius, t.radius) * 2 + (o.layer === LAYER.HEAVY ? 0.6 : 0)) continue;
      const dx = o.x - t.x, dy = o.y - t.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001, min = o.radius + t.radius;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d;
      const rv = (t.vx - o.vx) * nx + (t.vy - o.vy) * ny;
      // positional correction weighted by mass
      const inv = 1 / t.mass + 1 / o.mass, pen = min - d;
      t.x -= nx * pen * (1 / t.mass) / inv; t.y -= ny * pen * (1 / t.mass) / inv;
      o.x += nx * pen * (1 / o.mass) / inv; o.y += ny * pen * (1 / o.mass) / inv;
      if (rv <= 0) continue;
      const e = Math.min(t.restitution, o.restitution);
      const j = ((1 + e) * rv) / inv;
      t.vx -= (j / t.mass) * nx; t.vy -= (j / t.mass) * ny;
      o.vx += (j / o.mass) * nx; o.vy += (j / o.mass) * ny;
      if (o.state === "rest") { o.state = "flying"; o.thrower = t.thrower; o.throwTick = t.throwTick; }
      this.contacts++;
      if (j > 0.3) {
        this.contactPoints.push({ x: (t.x + o.x) / 2, y: (t.y + o.y) / 2, z: t.z });
        hooks.onToyHitToy(t, o, j);
        o.durability -= j * 2; t.durability -= j;
        if (o.durability <= 0) this.breakToy(o, t.thrower, tick, hooks);
        if (t.durability <= 0) this.breakToy(t, t.thrower, tick, hooks);
      }
    }
  }

  private springPadCheck(t: Toy, hooks: PhysicsHooks): void {
    if (t.z > 0.05 || t.vz > 0) return;
    for (const p of this.springPads) {
      const dx = t.x - p.x, dy = t.y - p.y;
      if (dx * dx + dy * dy < 0.25) { t.vz = 7; t.state = "flying"; hooks.onSpring(t, null, p.x, p.y); return; }
    }
  }

  /** Toy repair: a broken toy goes back to rest with full durability. Returns false if it was not broken. */
  repairToy(t: Toy): boolean {
    if (t.state !== "broken") return false;
    t.state = "rest"; t.durability = t.maxDurability; t.brokenAt = -1;
    return true;
  }

  breakToy(t: Toy, by: number, tick: number, hooks: PhysicsHooks): void {
    if (t.state === "broken") return;
    t.state = "broken"; t.brokenAt = tick; t.vx = t.vy = t.vz = 0;
    hooks.onToyBreak(t, by);
  }

  /**
   * Move a circle by (dx, dy), sliding along solid tiles. Used for character steering and knockback.
   * Returns true if any axis was blocked.
   */
  moveCircle(c: { x: number; y: number; radius: number; z: number }, dx: number, dy: number): boolean {
    let hit = false;
    const r = c.radius;
    if (dx !== 0) {
      const nx = c.x + dx, ex = nx + Math.sign(dx) * r;
      if (this.blocked(ex, c.y - r * 0.7, c.z) || this.blocked(ex, c.y + r * 0.7, c.z)) hit = true; else c.x = nx;
    }
    if (dy !== 0) {
      const ny = c.y + dy, ey = ny + Math.sign(dy) * r;
      if (this.blocked(c.x - r * 0.7, ey, c.z) || this.blocked(c.x + r * 0.7, ey, c.z)) hit = true; else c.y = ny;
    }
    return hit;
  }

  /** Characters: knockback decay and vertical motion (spring pads, hops). */
  stepCharacter(c: Character, dt: number, hooks: PhysicsHooks): void {
    const airborne = c.z > this.world.groundZ(c.x, c.y) + 0.02 || c.vz > 0;
    if (c.kx !== 0 || c.ky !== 0) {
      // move one axis at a time so a wall only bounces the part of the motion that hit it
      if (c.kx !== 0 && this.moveCircle(c, c.kx * dt, 0)) c.kx *= -0.3;
      if (c.ky !== 0 && this.moveCircle(c, 0, c.ky * dt)) c.ky *= -0.3;
      // in the air nothing slows you but the air; on the ground it is feet bracing, or a body skidding on the tarmac
      const sp = Math.hypot(c.kx, c.ky);
      const dec = (airborne ? 0.3 * sp : c.phys === Phys.DOWN ? BODY_SLIDE : FEET_GRIP) * dt;
      if (sp <= dec || sp < 0.02) { c.kx = 0; c.ky = 0; } else { const k = (sp - dec) / sp; c.kx *= k; c.ky *= k; }
    }
    if (c.z > 0 || c.vz !== 0) {
      c.vz -= GRAVITY * dt;
      c.z += c.vz * dt;
      const gz = this.world.groundZ(c.x, c.y);
      if (c.z <= gz) {
        c.z = gz;
        // a hard landing bounces a little and knocks the wind out of the slide
        if (c.vz < -5) { c.vz = -c.vz * 0.18; c.kx *= 0.8; c.ky *= 0.8; } else c.vz = 0;
      }
    } else {
      const gz = this.world.groundZ(c.x, c.y);
      if (gz > 0) c.z = gz;
      if (c.phys === Phys.OK) {
        for (const p of this.springPads) {
          const dx = c.x - p.x, dy = c.y - p.y;
          if (dx * dx + dy * dy < 0.2) { c.vz = 6.5; hooks.onSpring(null, c, p.x, p.y); break; }
        }
      }
    }
  }

  /** Push heavy props (crates, boxes) out of a character's way, transferring momentum. */
  pushHeavies(c: Character, toys: Toy[], tick: number, hooks: PhysicsHooks): void {
    const n = this.toyHash.query(c.x, c.y, 1, this.tmp);
    for (let k = 0; k < n; k++) {
      const t = toys[this.tmp[k]];
      if (!t || t.layer !== LAYER.HEAVY || t.state === "broken") continue;
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001, min = t.radius + c.radius;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d, pen = min - d;
      const share = 1 / (1 + t.mass);
      const before = { x: t.x, y: t.y };
      this.moveCircle(t, nx * pen * share * 2, ny * pen * share * 2);
      c.x -= nx * pen * (1 - share); c.y -= ny * pen * (1 - share);
      const moved = Math.abs(t.x - before.x) + Math.abs(t.y - before.y);
      if (moved > 0.001) { t.vx = nx * 0.6; t.vy = ny * 0.6; t.state = "flying"; t.thrower = c.id; t.throwTick = tick; }
      t.durability -= moved * 0.5;
      if (t.durability <= 0) this.breakToy(t, c.id, tick, hooks);
    }
  }
}
