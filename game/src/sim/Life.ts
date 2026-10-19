import { hasBody } from "./life/body";
import type { Simulation } from "./Simulation";
import { Character, Phys, Wound, WoundPart, WoundKind } from "../entities/types";
import { remember } from "../social/Social";
import { carried, detach } from "../inventory/Inventory";
import { injure } from "./life/injury";

/**
 * Injuries. Hits can leave wounds on a body part at four levels. Open cuts bleed (drip trails, falling
 * blood level); a head gash bleeds hardest, and a hit to the head sprays. Bandages stop the bleeding.
 * If blood runs low the person collapses and paramedics take them to hospital. Nobody dies.
 */
const BLEED: Record<number, number> = { 1: 0, 2: 0.25, 3: 0.6 };

export function pickPart(sim: Simulation, z: number | null): WoundPart {
  if (z !== null) return z >= 1.35 ? "head" : z >= 0.75 ? "torso" : "leg";
  const r = sim.rng.next();
  return r < 0.22 ? "head" : r < 0.62 ? "torso" : r < 0.85 ? "arm" : "leg";
}

/** Add a wound. `from` is where the blow came from (for the direction of a spray). */
export function wound(sim: Simulation, c: Character, part: WoundPart, severity: 1 | 2 | 3, kind: WoundKind, by: number, fromX: number, fromY: number): Wound {
  if (c.id === sim.playerId && part === "head" && kind !== "stab" && hasBody(sim.life.body, "mouthguard")) severity = Math.max(1, severity - 1) as 1 | 2 | 3;
  if (c.id === sim.playerId && sim.lifeFlags.injuryRecovery)
    sim.life.systems.injury = injure(sim.life.systems.injury, severity / 3, sim.tick);
  // a second hit to the same place makes it worse
  const existing = c.wounds.find((w) => w.part === part && !w.bandaged);
  const w: Wound = existing ?? { part, kind, severity, bandaged: false, tick: sim.tick };
  if (existing) { existing.severity = Math.min(3, Math.max(existing.severity, severity) + (severity >= 2 ? 1 : 0)) as 1 | 2 | 3; existing.kind = severity >= existing.severity ? kind : existing.kind; }
  else { c.wounds.push(w); if (c.wounds.length > 6) c.wounds.shift(); }
  if (part === "head" && w.severity >= 2) w.kind = kind === "stab" ? "stab" : "gash";
  recomputeBleed(c);
  if (sim.fakeBlood) {
    const a = Math.atan2(c.y - fromY, c.x - fromX);
    // headshots and stabs spray hard; every hit draws some (cartoon) blood
    const n = (part === "head" ? 40 : kind === "stab" ? 30 : 14) * w.severity;
    sim.bus.emit("fx", { kind: "blood", x: c.x + Math.cos(a) * 0.2, y: c.y + Math.sin(a) * 0.2, z: part === "head" ? 1.6 : 1.0, n, color: "#b3121b" });
    if (w.severity >= 3 || part === "head" && w.severity >= 2) sim.bus.emit("fx", { kind: "gib", x: c.x, y: c.y, z: 1.2, n: (part === "head" ? 5 : 3) + w.severity * 2 });
  }
  if (w.severity >= 2) {
    const att = sim.chars[by];
    remember(c, { t: sim.tick, kind: "wounded", subj: by, obj: c.id, toy: null, area: sim.world.areaAt(c.x, c.y)?.id ?? 0, val: -0.4 - w.severity * 0.15, ev: -1, src: "did" });
    sim.emit({ type: "injury", x: c.x, y: c.y, actors: by >= 0 ? [by, c.id] : [c.id], severity: w.severity >= 3 ? 4 : 3, data: { part, level: w.severity },
      summary: `${c.name} ${part === "head" ? (w.kind === "stab" ? "was stabbed in the head" : "has a nasty head gash") : w.kind === "stab" ? `was stabbed in the ${part}` : `has a bleeding ${part}`}${att ? ` (${att.name})` : ""}` });
  }
  return w;
}

export function recomputeBleed(c: Character): void {
  let b = 0;
  for (const w of c.wounds) if (!w.bandaged) b += BLEED[w.severity] * (w.part === "head" ? 1.4 : 1);
  c.bleed = Math.min(1, b);
}

/** Bandage the worst open wound. Returns true if there was one. */
export function bandage(sim: Simulation, medic: Character | null, c: Character): boolean {
  const open = c.wounds.filter((w) => !w.bandaged).sort((a, b) => b.severity - a.severity);
  if (!open.length) return false;
  for (const w of open) w.bandaged = true;
  recomputeBleed(c);
  c.emo.fear = Math.max(0, c.emo.fear - 0.3);
  sim.emit({ type: "bandaged", x: c.x, y: c.y, actors: medic ? [medic.id, c.id] : [c.id], summary: medic && medic !== c ? `${medic.name} bandaged ${c.name}'s ${open[0].part}` : `${c.name} bandaged their ${open[0].part}` });
  return true;
}

/** Use a bandage item from the inventory on someone (yourself or another). */
export function useBandage(sim: Simulation, user: Character, target: Character): boolean {
  const item = carried(user).map((id) => sim.toys[id]).find((t) => t?.def === "bandage");
  if (!item || !target.wounds.some((w) => !w.bandaged)) return false;
  detach(user, item.id); item.state = "broken"; item.x = -100; item.holder = -1;
  return bandage(sim, user, target);
}

/** Per AI tick: blood loss, collapse, slow recovery, healing over time. */
/** How badly each part of a body is hurt right now (open wounds count fully, bandaged ones half): 0 = fine, 3+ = bad. */
export function hurtOf(c: Character): { head: number; torso: number; arm: number; leg: number; total: number } {
  const h = { head: 0, torso: 0, arm: 0, leg: 0, total: 0 };
  for (const w of c.wounds) { const v = w.severity * (w.bandaged ? 0.5 : 1); h[w.part] += v; h.total += v; }
  return h;
}

export function updateHealth(sim: Simulation, c: Character, dt: number): void {
  if (!c.wounds.length && c.blood >= 1) return;
  // pain wears you down: the more it hurts, the lower the mood and the shorter the fuse
  if (c.wounds.length) {
    const pain = hurtOf(c).total;
    c.emo.mood = Math.max(-1, c.emo.mood - pain * dt * 0.003);
    c.emo.composure = Math.max(0, c.emo.composure - pain * dt * 0.0015);
  }
  if (c.bleed > 0) {
    c.blood = Math.max(0, c.blood - c.bleed * dt * 0.012);
    c.emo.fear = Math.min(1, c.emo.fear + c.bleed * dt * 0.01);
    if (c.blood < 0.35 && c.phys !== Phys.DOWN && c.tier !== "player") {
      c.phys = Phys.DOWN; c.physTimer = 9999; c.emo.composure = 0;
      sim.emit({ type: "collapse", x: c.x, y: c.y, actors: [c.id], severity: 4, summary: `${c.name} collapsed from blood loss. Someone call an ambulance!` });
      sim.callAmbulance(c);
    }
  } else c.blood = Math.min(1, c.blood + dt * 0.004);
  // wounds heal: bruises fade, bandaged wounds close up after a while
  for (let i = c.wounds.length - 1; i >= 0; i--) {
    const w = c.wounds[i], age = sim.tick - w.tick;
    if (w.severity === 1 && age > 60 * 120 || w.bandaged && age > 60 * 60 * 6) c.wounds.splice(i, 1);
  }
  recomputeBleed(c);
}

/** Paramedics: patched up at the hospital, then sent home. */
export function hospitalise(sim: Simulation, c: Character): void {
  const h = sim.world.buildings.find((b) => b.kind === "hospital");
  for (const w of c.wounds) w.bandaged = true;
  recomputeBleed(c);
  c.blood = 0.8; c.phys = Phys.OK; c.physTimer = 0; c.emo.composure = 0.6;
  if (h && c.tier !== "player") { c.inside = h.id; c.insideUntil = sim.tick + 60 * 90; c.x = h.door.x + 0.5; c.y = h.door.y + 0.5; c.goal = null; }
  sim.emit({ type: "hospital", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} was taken to hospital and patched up` });
}
