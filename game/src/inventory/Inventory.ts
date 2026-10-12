import { Character, Toy } from "../entities/types";
import { TOYS, RECIPES } from "../content/toys";

/**
 * Inventory rules: one hand slot plus a small bag. All ownership changes go through these functions
 * so invariants hold (a toy has at most one holder; holder.hand/bag always agree with toy.holder).
 */
export type PickupResult = "hand" | "bag" | "full" | "unavailable" | "too_far";

export function canPickUp(c: Character, t: Toy, reach = 0.9): PickupResult {
  if (t.state === "broken" || t.state === "held" || !TOYS[t.def].portable) return "unavailable";
  if (Math.hypot(t.x - c.x, t.y - c.y) > reach || t.z > 1.6) return "too_far";
  if (c.hand < 0) return "hand";
  if (c.bag.length < c.bagMax) return "bag";
  return "full";
}

export function pickUp(c: Character, t: Toy, tick: number, reach = 0.9): PickupResult {
  const r = canPickUp(c, t, reach);
  if (r !== "hand" && r !== "bag") return r;
  if (r === "hand") c.hand = t.id; else c.bag.push(t.id);
  t.state = "held"; t.holder = c.id; t.vx = t.vy = t.vz = 0; t.tether = -1;
  if (t.owner < 0) t.owner = c.id;
  if (t.lostBy >= 0 && t.lostBy !== c.id) t.lostBy = t.lostBy; // stays marked lost until owner recovers it
  if (t.lostBy === c.id) t.lostBy = -1;
  t.throwTick = tick;
  return r;
}

/** Remove from whatever slot holds it. Does not change toy physics state. */
export function detach(c: Character, toyId: number): boolean {
  if (c.hand === toyId) { c.hand = c.bag.length ? c.bag.shift()! : -1; return true; }
  const i = c.bag.indexOf(toyId);
  if (i >= 0) { c.bag.splice(i, 1); return true; }
  return false;
}

export function drop(c: Character, t: Toy): void {
  if (!detach(c, t.id)) return;
  t.state = "rest"; t.holder = -1;
  t.x = c.x + Math.cos(c.facing) * 0.4; t.y = c.y + Math.sin(c.facing) * 0.4; t.z = 0.5; t.vz = 0.1;
  t.state = "flying";
}

/** Give a toy to someone else. Ownership transfers with gifts. */
export function transfer(from: Character, to: Character, t: Toy, asGift: boolean): boolean {
  if (t.holder !== from.id) return false;
  if (to.hand >= 0 && to.bag.length >= to.bagMax) return false;
  detach(from, t.id);
  if (to.hand < 0) to.hand = t.id; else to.bag.push(t.id);
  t.holder = to.id;
  if (asGift) t.owner = to.id;
  return true;
}

/** Bring a bag item to hand (equip). */
export function equip(c: Character, toyId: number): boolean {
  const i = c.bag.indexOf(toyId);
  if (i < 0) return c.hand === toyId;
  c.bag.splice(i, 1);
  if (c.hand >= 0) c.bag.push(c.hand);
  c.hand = toyId;
  return true;
}

export function carried(c: Character): number[] { return c.hand >= 0 ? [c.hand, ...c.bag] : c.bag.slice(); }

export function findCarried(c: Character, toys: Toy[], pred: (def: string) => boolean): Toy | null {
  for (const id of carried(c)) { const t = toys[id]; if (t && pred(t.def)) return t; }
  return null;
}

/** Which recipe (if any) the carried items satisfy. */
export function craftable(c: Character, toys: Toy[]): { recipe: (typeof RECIPES)[number]; a: Toy; b: Toy } | null {
  const items = carried(c).map((id) => toys[id]).filter(Boolean);
  for (const r of RECIPES) {
    const a = items.find((t) => t.def === r.a), b = items.find((t) => t.def === r.b);
    if (a && b) return { recipe: r, a, b };
  }
  return null;
}
