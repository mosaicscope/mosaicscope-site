import { Character, Phys, Toy } from "../entities/types";
import { TOYS } from "../content/toys";
import { SpatialHash } from "../world/SpatialHash";
import { Rng } from "../core/rng";
import { angDiff, clamp } from "../core/math";
import { GRAVITY } from "./PhysicsWorld";

/** Gameplay consequences of a physical impact, kept separate from the physics impulse itself. */
export interface ImpactResult { stumble: boolean; down: boolean; blocked: boolean; composureLoss: number }

/** Intensity scale (settings: "gentle" toy fights use a lower value). */
export let impactIntensity = 1;
export function setImpactIntensity(v: number): void { impactIntensity = clamp(v, 0.2, 1.5); }

/** True when the defender holds a shield and faces the incoming direction (from attacker toward defender). */
export function shieldBlocks(def: Character, toys: Toy[], fromX: number, fromY: number): boolean {
  if (def.hand < 0) return false;
  const t = toys[def.hand];
  if (!t || !TOYS[t.def].uses.includes("shield") || def.phys !== Phys.OK) return false;
  const toward = Math.atan2(fromY - def.y, fromX - def.x);
  return Math.abs(angDiff(toward, def.facing)) < 1.2;
}

/**
 * Apply knockback + composure loss. Physics gives the impulse; this decides stumble/fall.
 * Returns what happened so AI/social systems can react.
 */
export function applyImpact(c: Character, impulse: number, nx: number, ny: number, blocked: boolean, maxImpulse: number, damage = 1): ImpactResult {
  let imp = clamp(impulse * impactIntensity, 0, maxImpulse);
  if (blocked) imp *= 0.25;
  const massScale = c.tier === "background" ? 1.3 : 1;
  c.kx += nx * imp * 0.9 * massScale; c.ky += ny * imp * 0.9 * massScale;
  c.anim.flash = 0.18;
  const loss = blocked ? 0.02 : clamp(imp * 0.075 * damage, 0.01, 0.6);
  c.emo.composure = clamp(c.emo.composure - loss, 0, 1);
  let down = false, stumble = false;
  if (!blocked) {
    if (c.emo.composure <= 0.12 || imp > maxImpulse * 0.85) {
      down = true; c.phys = Phys.DOWN; c.physTimer = 2.2 + (1 - c.pers.boldness) * 1.5; c.vz = 2.5; c.stats.falls++;
    } else if (imp > 1.2) {
      stumble = true; if (c.phys === Phys.OK) { c.phys = Phys.STUMBLE; c.physTimer = 0.35 + imp * 0.05; }
    }
  }
  return { stumble, down, blocked, composureLoss: loss };
}

/** Advance stumble -> recover -> ok timers. */
export function updatePhysState(c: Character, dt: number): void {
  if (c.phys === Phys.OK) {
    c.emo.composure = Math.min(1, c.emo.composure + dt * 0.04);
    return;
  }
  c.physTimer -= dt;
  if (c.physTimer > 0) return;
  if (c.phys === Phys.STUMBLE) c.phys = Phys.OK;
  else if (c.phys === Phys.DOWN) { c.phys = Phys.RECOVER; c.physTimer = 0.8; c.emo.composure = Math.max(c.emo.composure, 0.45); }
  else if (c.phys === Phys.RECOVER) c.phys = Phys.OK;
}

/**
 * Compute a lobbed throw velocity from (x,y,z0) to target with skill-based error.
 * Misses are real: the error comes from rng scaled by (1 - accuracy), and the physics resolves the rest.
 */
export function aimThrow(x: number, y: number, z0: number, tx: number, ty: number, tz: number, accuracy: number, rng: Rng, power = 1): { vx: number; vy: number; vz: number } {
  const err = (1 - clamp(accuracy, 0, 1)) * 0.6;
  const ang = Math.atan2(ty - y, tx - x) + rng.gauss() * err * 0.35;
  const d = Math.max(0.5, Math.hypot(tx - x, ty - y) * (1 + rng.gauss() * err * 0.25));
  const s = clamp(5 + d * 0.9, 5, 13) * power;
  const t = d / s;
  const vz = (tz - z0) / t + 0.5 * GRAVITY * t;
  return { vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, vz: clamp(vz, 0.5, 9) };
}

/** Melee swing: every character in the forward arc within reach takes a hit. Writes hits into out. */
export function swingHits(att: Character, reach: number, chars: Character[], hash: SpatialHash, tmp: number[], out: Character[]): number {
  out.length = 0;
  const n = hash.query(att.x, att.y, reach + 0.4, tmp);
  for (let i = 0; i < n; i++) {
    const c = chars[tmp[i]];
    if (!c || c === att || c.tier === "background" || c.phys === Phys.DOWN) continue;
    const a = Math.atan2(c.y - att.y, c.x - att.x);
    if (Math.abs(angDiff(a, att.facing)) > 1.0) continue;
    out.push(c);
  }
  return out.length;
}
