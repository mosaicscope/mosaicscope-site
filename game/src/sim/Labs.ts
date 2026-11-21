import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import { impairment, type SubstanceKind } from "./Substances";
import { forceGoal } from "../ai/brain";
import { arrest, enterBuilding, exitBuilding } from "./Society";
import { wound } from "./Life";

/**
 * Production, crew money and raids, adapted from npc-industry (fictional and abstract: no chemistry, just risk meters):
 *  - each crew runs one hidden lab in an industrial building; a member goes inside to cook a batch, and skill, ventilation,
 *    tiredness, being impaired and built-up residue drive the accident risk (fumes, fire, explosion)
 *  - batches fill the crew stash; street dealers restock from it; quality (potency, purity) follows the cook's skill
 *  - sales pay the crew a cut; crew pay keeps people loyal, heat and poverty wear it down, and a disloyal member under
 *    heat turns informant
 *  - smell, an accident, gossip or an informant raise suspicion; at the limit police raid: they go after the people
 *    there, seize the stash, and the lab shuts for a long while
 * Runtime-only: nothing is saved.
 */
type Kind = SubstanceKind;
interface Quality { potency: number; purity: number }
interface Gang { id: string; cash: number; heat: number; power: number; stash: Partial<Record<Kind, number>>; quality: Partial<Record<Kind, Quality>>; nextPay: number }
interface Lab { id: number; name: string; x: number; y: number; owner: string; hazard: number; reopenAt: number; cook: number; cookUntil: number; nextCook: number;
  suspicion: number; raidAt: number; raidCop: number; phase: number; skill: number; batches: number }
interface State { gangs: Map<string, Gang>; labs: Lab[]; loyalty: Map<number, number>; informants: Set<number>; started: boolean }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { gangs: new Map(), labs: [], loyalty: new Map(), informants: new Set(), started: false }); return s; };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const KINDS: Kind[] = ["stimulant", "sedative", "cannabis"];
const SEC = 60;
const free = (c: Character) => c.tier !== "player" && c.phys === Phys.OK && c.inside < 0 && c.inCar < 0 && c.jailUntil <= 0 && c.arrestedBy < 0;
const crewOf = (sim: Simulation, id: string) => sim.chars.filter((c) => c.crew === id && c.tier !== "player");

/** A street sale: the crew takes its cut, a strong batch can put a buyer in crisis. */
export function onSale(sim: Simulation, dealer: Character, buyer: Character, price: number, kind: Kind): void {
  const g = state(sim).gangs.get(dealer.crew); if (!g) return;
  const cut = Math.round(price * 0.3); dealer.cash -= cut; g.cash += cut;
  const q = g.quality[kind];
  if (q && q.potency > 1.25 && buyer.substances && sim.rng.next() < q.potency - 1.2) {   // an unexpectedly strong batch
    buyer.substances.levels[kind] = Math.min(3, buyer.substances.levels[kind] + 1.2); buyer.substances.crisis = true; sim.callAmbulance(buyer);
  }
}
/** Crew dealers restock from the crew stash; anyone else is handled by the caller. Returns false if this dealer is not in a crew. */
export function restock(sim: Simulation, dealer: Character, kind: Kind): number | null {
  const g = state(sim).gangs.get(dealer.crew); if (!g) return null;
  const have = g.stash[kind] ?? 0, n = Math.min(have, 4); g.stash[kind] = have - n; return n;
}
export const gangHeat = (sim: Simulation, crew: string) => state(sim).gangs.get(crew)?.heat ?? 0;
export function bustHeat(sim: Simulation, crew: string, d: number): void { const g = state(sim).gangs.get(crew); if (g) g.heat = clamp(g.heat + d); }

export function updateLabs(sim: Simulation): void {
  if (sim.tick % 30 !== 23) return;
  const st = state(sim);
  // crews and labs appear once the crews do (Turf creates them over time)
  if (sim.tick % 600 === 23 || !st.started) {
    for (const id of ["famiglia", "riccarton"]) if (!st.gangs.has(id) && crewOf(sim, id).length) st.gangs.set(id, { id, cash: 500, heat: 0, power: 1, stash: {}, quality: {}, nextPay: sim.tick + 60 * 120 });
    const sites = sim.world.buildings.filter((b) => b.kind === "recycling" || b.kind === "garage");
    for (const g of st.gangs.values()) if (!st.labs.some((l) => l.owner === g.id) && sites.length) {
      // the industrial building closest to where the crew spends its time, so a member can actually walk there to cook
      const crew = crewOf(sim, g.id), cx = crew.reduce((s, c) => s + c.x, 0) / crew.length, cy = crew.reduce((s, c) => s + c.y, 0) / crew.length;
      const taken = new Set(st.labs.map((l) => l.x + "," + l.y)), open = sites.filter((s) => !taken.has(s.door.x + "," + s.door.y));
      const b = (open.length ? open : sites).sort((a, z) => Math.hypot(a.door.x - cx, a.door.y - cy) - Math.hypot(z.door.x - cx, z.door.y - cy))[0];
      st.labs.push({ id: st.labs.length, name: b.name ?? "the yard", x: b.door.x, y: b.door.y, owner: g.id, hazard: 0, reopenAt: 0, cook: -1, cookUntil: 0, nextCook: sim.tick + 60 * 60, suspicion: 0, raidAt: 0, raidCop: -1, phase: 0, skill: 0.3, batches: 0 });
      st.started = true;
    }
  }
  for (const lab of st.labs) tickLab(sim, st, lab);
  for (const g of st.gangs.values()) tickGang(sim, st, g);
}

function tickLab(sim: Simulation, st: State, lab: Lab): void {
  const g = st.gangs.get(lab.owner)!, now = sim.tick;
  if (lab.phase) { if (now >= lab.raidAt) raid(sim, lab, g); return; }
  if (now < lab.reopenAt) return;
  const cook = lab.cook >= 0 ? sim.chars[lab.cook] : undefined;
  // smell and watchers: neighbours gossip, an officer on the street notices
  if (cook) for (const o of sim.chars) {
    if (o.tier === "player" || o.inside >= 0 || o.crew === lab.owner) continue;
    const d = Math.hypot(o.x - lab.x, o.y - lab.y);
    if (d < 9) lab.suspicion += o.role === "cop" && free(o) ? 0.08 : 0.004;
  }
  lab.suspicion = Math.min(1.5, lab.suspicion + g.heat * 0.002);
  if (lab.suspicion >= 1 && !lab.phase) { const cop = nearestCop(sim, lab.x, lab.y); if (cop) { lab.phase = 1; lab.raidAt = now + SEC * 45; lab.raidCop = cop.id; sim.emit({ type: "police", x: lab.x, y: lab.y, actors: [cop.id, cook?.id ?? -1], summary: `Police are preparing to raid ${lab.name}` }); return; } }
  if (cook && cook.inside >= 0) {
    const skill = lab.skill, fatigue = 1 - cook.needs.energy, impaired = impairment(cook) > 0.2 ? 0.5 : 0;
    const risk = 0.35 * (1 - 0.7 * skill) * (1 - 0.5 * 0.3) * (1 + fatigue + impaired) * (1 + 3 * lab.hazard);
    lab.hazard = clamp(lab.hazard + risk * 0.004);
    if (sim.rng.next() < risk * 0.004) { accident(sim, lab, g, cook, clamp(sim.rng.next() * 0.5 + risk * 0.8)); return; }
  }
  if (cook && now >= lab.cookUntil) {
    const kind = KINDS[(lab.batches + (lab.owner === "riccarton" ? 1 : 0)) % KINDS.length], q = lab.skill * 0.75;
    const potency = clamp(0.6 + 0.6 * q + (sim.rng.next() - 0.5) * 0.3, 0.4, 1.5), purity = clamp(0.5 + 0.45 * q + (sim.rng.next() - 0.5) * 0.2, 0.3, 1), units = Math.max(2, Math.round(6 * (0.7 + 0.3)));
    const have = g.stash[kind] ?? 0, old = g.quality[kind] ?? { potency, purity }, t = have + units;
    g.quality[kind] = { potency: (old.potency * have + potency * units) / t, purity: (old.purity * have + purity * units) / t }; g.stash[kind] = t;
    lab.skill = clamp(lab.skill + 0.02 * (1 - lab.skill)); lab.hazard *= 0.6; lab.batches++; lab.cook = -1; lab.nextCook = now + SEC * 180;
    if (cook.inside >= 0) exitBuilding(sim, cook);
    return;
  }
  if (!cook && now >= lab.nextCook && g.cash >= 30) {
    const who = crewOf(sim, lab.owner).filter((c) => free(c) && Math.hypot(c.x - lab.x, c.y - lab.y) < 40)[0];
    const b = sim.world.buildings.find((x) => x.door.x === lab.x && x.door.y === lab.y);
    if (who && b) { g.cash -= 30; lab.cook = who.id; lab.cookUntil = now + SEC * 45; enterBuilding(sim, who, b, 45); }
    else lab.nextCook = now + SEC * 30;
  }
}

function accident(sim: Simulation, lab: Lab, g: Gang, cook: Character, sev: number): void {
  const type = sev < 0.3 ? "fumes" : sev < 0.6 ? "fire" : "explosion", radius = 4 + 10 * sev;
  lab.cook = -1; lab.reopenAt = sim.tick + SEC * (type === "explosion" ? 900 : type === "fire" ? 400 : 120); lab.suspicion = Math.min(1.5, lab.suspicion + 0.5 + sev);
  if (cook.inside >= 0) exitBuilding(sim, cook);
  wound(sim, cook, "torso", sev > 0.6 ? 3 : sev > 0.3 ? 2 : 1, sev > 0.6 ? "fracture" : sev > 0.3 ? "gash" : "graze", -1, lab.x, lab.y); sim.callAmbulance(cook);
  for (const o of sim.chars) {
    if (o === cook || o.inside >= 0) continue;
    const d = Math.hypot(o.x - lab.x, o.y - lab.y); if (d > radius) continue;
    o.emo.fear = 1; sim.say(o, type === "fumes" ? "What is that smell?!" : "Run! It's going up!", "shout", 2);
    if (type !== "fumes" && d < radius * 0.6) { o.fireUntil = sim.tick + 240; }   // FireResponse burns anyone caught in it
    if (d < radius * 0.5) wound(sim, o, "leg", 1, "graze", -1, lab.x, lab.y);
  }
  g.heat = clamp(g.heat + 0.2 * sev); g.power = Math.max(0.2, g.power - 0.1 * sev);
  sim.emit({ type: "injury", x: lab.x, y: lab.y, actors: [cook.id], priority: 8, summary: type === "explosion" ? `There was an explosion at ${lab.name}` : type === "fire" ? `Fire at ${lab.name}` : `Fumes at ${lab.name}` });
}

function nearestCop(sim: Simulation, x: number, y: number): Character | undefined {
  let best: Character | undefined, bd = Infinity;
  for (const c of sim.chars) if (c.role === "cop" && free(c) && c.pursuing < 0) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
  return best;
}

/** Two phases: officers set off after whoever is at the lab, then (after a while) the lab is shut, stash seized, people held. */
function raid(sim: Simulation, lab: Lab, g: Gang): void {
  const cop = sim.chars[lab.raidCop];
  const people = crewOf(sim, lab.owner).filter((c) => free(c) || c.inside >= 0).sort((a, b) => Math.hypot(a.x - lab.x, a.y - lab.y) - Math.hypot(b.x - lab.x, b.y - lab.y));
  if (lab.phase === 1) {
    const target = people[0];
    if (cop && free(cop) && target) {
      if (target.inside >= 0) exitBuilding(sim, target);
      cop.pursuing = target.id; sim.say(cop, "Police! Nobody move!", "shout", 2);
      if (cop.inCar >= 0) { const v = sim.vehicles[cop.inCar]; if (v) v.siren = true; } else forceGoal(cop, sim, "pursue", { u: 1, target: target.id });
    }
    lab.phase = 2; lab.raidAt = sim.tick + SEC * 40;   // phase two comes later
    return;
  }
  // phase two: close the lab and take what is there
  lab.phase = 0; lab.raidAt = 0; lab.raidCop = -1; lab.suspicion = 0; lab.cook = -1; lab.reopenAt = sim.tick + SEC * 900; lab.hazard = 0;
  g.stash = {}; g.cash = Math.max(0, g.cash - 150); g.heat = clamp(g.heat + 0.3); g.power = Math.max(0.2, g.power - 0.2);
  const officer = cop && free(cop) ? cop : nearestCop(sim, lab.x, lab.y);
  if (officer) for (const m of people) if (Math.hypot(m.x - lab.x, m.y - lab.y) < 8 && free(m)) arrest(sim, officer, m);
  sim.emit({ type: "police", x: lab.x, y: lab.y, actors: officer ? [officer.id] : [], summary: `Police raided ${lab.name} and shut it down` });
}

/** Crew pay, loyalty, heat and informants. */
function tickGang(sim: Simulation, st: State, g: Gang): void {
  if (sim.tick < g.nextPay) return;
  g.nextPay = sim.tick + SEC * 120;
  g.heat = Math.max(0, g.heat - 0.02);
  const members = crewOf(sim, g.id);
  for (const m of members) {
    let l = st.loyalty.get(m.id) ?? 0.6;
    if (g.cash >= 15) { g.cash -= 15; m.cash += 15; l += 0.03; } else l -= 0.05;
    l = clamp(l - g.heat * 0.03); st.loyalty.set(m.id, l);
    if (l < 0.25 && g.heat > 0.5 && !st.informants.has(m.id)) st.informants.add(m.id);
  }
  // an informant gives the police the lab
  for (const id of st.informants) {
    const m = sim.chars[id]; if (!m || m.crew !== g.id || sim.rng.next() > 0.5) continue;
    for (const lab of st.labs) if (lab.owner === g.id) lab.suspicion = Math.max(lab.suspicion, 1);
    sim.emit({ type: "rumour", x: m.x, y: m.y, actors: [m.id], summary: `Word is someone in ${g.id === "famiglia" ? "the Famiglia" : "the Riccarton Boys"} is talking to the police` });
  }
}

/** Developer helpers: find the first lab, make it have an accident, or call a raid on it. */
export function debugLab(sim: Simulation, action: string): { x: number; y: number; text: string } | undefined {
  const st = state(sim), lab = st.labs[0]; if (!lab) return undefined;
  const g = st.gangs.get(lab.owner)!;
  if (action === "accident") { const who = crewOf(sim, lab.owner)[0]; if (who) { lab.reopenAt = 0; accident(sim, lab, g, who, 0.7); } return { x: lab.x, y: lab.y, text: `Accident at ${lab.name}` }; }
  if (action === "raid") { lab.suspicion = 1; lab.reopenAt = 0; return { x: lab.x, y: lab.y, text: `${lab.name} is being watched; a raid follows` }; }
  return { x: lab.x, y: lab.y, text: `${lab.name} (${lab.owner}) stash ${JSON.stringify(g.stash)} cash ${g.cash}` };
}
