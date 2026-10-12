import { Rng } from "../core/rng";
import { TOYS } from "../content/toys";
import { Character, Lod, Look, Personality, Tier, Toy } from "./types";
import { LAYER, MASK } from "../physics/layers";

export function makeCharacter(id: number, name: string, tier: Tier, x: number, y: number, look: Look, pers: Personality, rng: Rng): Character {
  const memMax = tier === "principal" ? 32 : tier === "mid" ? 10 : tier === "player" ? 16 : 4;
  return {
    id, name, tier, lod: tier === "background" ? Lod.BACKGROUND : Lod.FULL,
    x, y, z: 0, px: x, py: y, vx: 0, vy: 0, kx: 0, ky: 0, vz: 0,
    facing: rng.range(0, Math.PI * 2), radius: tier === "background" ? 0.22 : 0.28,
    speed: (tier === "background" ? 1.1 : 1.6) * (0.85 + rng.next() * 0.3),
    look, pers,
    needs: { energy: rng.range(0.6, 1), social: rng.range(0.4, 1), fun: rng.range(0.4, 1), curiosity: rng.range(0.4, 1) },
    emo: { fear: 0, frustration: 0, confidence: 0.4 + pers.boldness * 0.5, mood: rng.range(-0.1, 0.4), composure: 1 },
    phys: 0, physTimer: 0,
    mode: tier === "player" ? "player" : "idle",
    goal: null, goalCooldowns: {},
    path: null, pathIdx: 0, pathReq: 0, pathGoalX: x, pathGoalY: y, repathAt: 0, promoted: false,
    stuck: 0, lastX: x, lastY: y,
    hand: -1, bag: [], bagMax: tier === "principal" || tier === "player" ? 3 : 1,
    memories: [], memMax,
    rel: new Map(), group: -1,
    anim: { phase: rng.next() * 6.28, pose: "idle", poseT: 0, flash: 0, gesture: 0 },
    bubble: null, talkWith: -1, nextThink: rng.int(0, 30),
    lastHitBy: -1, lastHitTick: -9999, homeArea: 0,
    bio: "", style: "loose", likes: [], fears: [], catchphrase: "",
    stats: { hits: 0, hitsTaken: 0, throws: 0, gifts: 0, talks: 0, helps: 0, falls: 0 },
    prefs: {}, reputation: 0, dirty: true, seedPhase: rng.next() * 100,
  };
}

export function makeToy(id: number, def: string, x: number, y: number, z = 0): Toy {
  const d = TOYS[def];
  if (!d) throw new Error("Unknown toy " + def);
  const projectile = d.uses.includes("projectile"), heavy = d.uses.includes("heavy");
  return {
    id, def, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, angle: 0, spin: 0,
    radius: d.radius, mass: d.mass, restitution: d.restitution, friction: d.friction,
    durability: d.durability, maxDurability: d.durability,
    holder: -1, owner: -1, thrower: -1, throwTick: -9999, state: "rest",
    layer: projectile ? LAYER.PROJECTILE : heavy ? LAYER.HEAVY : LAYER.TOY,
    mask: projectile ? MASK.PROJECTILE : heavy ? MASK.HEAVY : MASK.TOY,
    tether: -1, tetherLen: 0, hitUntil: 0, brokenAt: -1, color: d.color, lostBy: -1,
  };
}
