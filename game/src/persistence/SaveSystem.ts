import { newLife, type LifeState } from "../sim/Chronicles";
import { newExpansion, newCasino, type ExpansionState } from "../sim/Expansion";
import { Simulation } from "../sim/Simulation";
import { Character, Toy, Rel, Memory, Vehicle } from "../entities/types";
import { Graffiti } from "../world/World";
import { Crime, Booking } from "../sim/Society";
import { makeCharacter } from "../entities/factory";
import { SimConfig } from "../core/config";
import { EnvState } from "../sim/Environment";
import { WorldEvent } from "../events/WorldEvents";
import { Group } from "../social/Groups";
import { StorageProvider, NS } from "./storage";
import { ensureMind, newMind } from "../mind/Mind";
import { SavedLitter, serializeLitter, restoreLitter } from "../sim/Litter";

/**
 * Versioned saves. The world layout is regenerated from the seed (deterministic), so a save stores
 * the seed/config plus everything dynamic: characters (needs, emotions, inventory, relationships,
 * memories), toys, cars, graffiti, tills, crime records, bookings, environment, groups, routines
 * and event history. Transient AI state (paths,
 * current plans) is dropped and rebuilt by the AI on load.
 */
export const SAVE_VERSION = 6;

/** v3 packs the two biggest structures into tuples (about half the size of objects). */
/** v5 appends the Ebbinghaus rehearsal count and last-recall tick (omitted when never rehearsed). */
type MemTuple = [number, Memory["kind"], number, number, string | null, number, number, Memory["src"], number, number, number, number?, number?];
type RelTuple = [number, number, number, number, number, number, number, number, number, number, number];
type SavedChar = Omit<Character, "rel" | "path" | "goal" | "bubble" | "goalCooldowns" | "memories"> & { rel: RelTuple[]; memories: MemTuple[] };

export const packMem = (m: Memory): MemTuple => (m.rep || m.rec ? [m.t, m.kind, m.subj, m.obj, m.toy, m.area, m.val, m.src, m.from, m.cred, m.ev, m.rep ?? 0, m.rec ?? 0] : [m.t, m.kind, m.subj, m.obj, m.toy, m.area, m.val, m.src, m.from, m.cred, m.ev]);
export const unpackMem = (a: MemTuple): Memory => { const m: Memory = { t: a[0], kind: a[1], subj: a[2], obj: a[3], toy: a[4], area: a[5], val: a[6], src: a[7], from: a[8], cred: a[9], ev: a[10] }; if (a[11]) m.rep = a[11]; if (a[12]) m.rec = a[12]; return m; };
export const packRel = (id: number, r: Rel): RelTuple => [id, r.fam, r.trust, r.aff, r.respect, r.fear, r.rivalry, r.grudge, r.shared, r.favours, r.last];
export const unpackRel = (a: RelTuple): [number, Rel] => [a[0], { fam: a[1], trust: a[2], aff: a[3], respect: a[4], fear: a[5], rivalry: a[6], grudge: a[7], shared: a[8], favours: a[9], last: a[10] }];
export interface SaveData {
  expansion?: ExpansionState;
  life?: LifeState;
  version: number;
  savedAt: string;
  label: string;
  cfg: SimConfig;
  tick: number;
  rng: number[];
  env: EnvState;
  playerId: number;
  chars: SavedChar[];
  toys: Toy[];
  events: { nextId: number; history: WorldEvent[]; counts: Record<string, number> };
  groups: Group[];
  routines: [number, [number, string][]][];
  lamps: boolean[];
  vehicles?: Vehicle[];
  graffiti: Graffiti[];
  tills: Record<number, number>;
  crimes: Crime[];
  bookings: Booking[];
  /** street litter and bins; absent in older saves (the street regenerates from the seed) */
  litter?: SavedLitter;
}

/** Migrations from older versions, applied in order. */
export const MIGRATIONS: Record<number, (d: any) => any> = {
  // v1 had no reputation/prefs on characters and no lamp states
  1: (d) => ({ ...d, version: 2, lamps: d.lamps ?? [], chars: d.chars.map((c: any) => ({ reputation: 0, prefs: {}, ...c })) }),
  // v2 stored memories and relationships as objects; v3 packs them into tuples
  2: (d) => ({ ...d, version: 3, chars: d.chars.map((c: any) => ({ ...c, memories: (c.memories ?? []).map(packMem), rel: (c.rel ?? []).map(([id, r]: [number, Rel]) => packRel(id, r)) })) }),
  // v3 predates the city: no cars, tags, tills, crime records or bookings (the city fills them in fresh)
  3: (d) => ({ ...d, version: 4, graffiti: [], tills: {}, crimes: [], bookings: [] }),
  // v4 had no minds: everyone starts with a fresh, personality-derived one (they learn from here)
  // v5 minds had no clinical state: ensureMind() on restore fills it in (liability comes from the kin module, so nothing else to store)
  5: (d) => ({ ...d, version: 6, chars: d.chars.map((c: any) => ({ ...c, mind: c.mind ? { ...c.mind, psy: c.mind.psy ?? newMind(c.id, c.pers).psy } : c.mind })) }),
  4: (d) => ({ ...d, version: 5, chars: d.chars.map((c: any) => ({ ...c, mind: c.mind ?? newMind(c.id, c.pers) })) }),
};

export function serialize(sim: Simulation, label = "Save"): SaveData {
  return {
    life: structuredClone(sim.life),
    expansion: structuredClone(sim.expansion),
    version: SAVE_VERSION, savedAt: new Date().toISOString(), label,
    cfg: sim.cfg, tick: sim.tick, rng: sim.rng.getState(), env: { ...sim.env }, playerId: sim.playerId,
    chars: sim.chars.map((c) => {
      const { rel, memories, path: _p, goal: _g, bubble: _b, goalCooldowns: _gc, ...rest } = c;
      return { ...rest, talkWith: -1, pathReq: 0, mode: c.tier === "player" ? "player" : "idle", rel: [...rel.entries()].map(([id, r]) => packRel(id, r)), memories: memories.map(packMem), mind: structuredClone(c.mind) } as SavedChar;
    }),
    toys: sim.toys.map((t) => ({ ...t })),
    events: sim.events.serialize(),
    groups: [...sim.groups.groups.values()],
    routines: [...sim.routines.entries()],
    lamps: sim.world.pois.map((p) => !!p.on),
    vehicles: sim.vehicles.map((v) => ({ ...v })),
    graffiti: sim.world.graffiti.map((g) => ({ ...g })),
    tills: { ...sim.tills },
    crimes: sim.crimes.slice(-200).map((c) => ({ ...c, witnesses: [...c.witnesses] })),
    bookings: sim.bookings.slice(-100).map((b) => ({ ...b })),
    litter: serializeLitter(sim.litter),
  };
}

export class SaveError extends Error {}

/** Validate + migrate raw JSON into current SaveData. Throws SaveError with a readable message. */
export function parseSave(json: string): SaveData {
  let d: any;
  try { d = JSON.parse(json); } catch { throw new SaveError("The save file is not valid JSON (it may be corrupted)."); }
  if (!d || typeof d !== "object" || typeof d.version !== "number") throw new SaveError("This doesn't look like a Mosaics world save.");
  if (d.version > SAVE_VERSION) throw new SaveError(`This save is from a newer version (v${d.version}). Update the game to load it.`);
  while (d.version < SAVE_VERSION) {
    const m = MIGRATIONS[d.version];
    if (!m) throw new SaveError(`No migration from save v${d.version}.`);
    d = m(d);
  }
  if (!Array.isArray(d.chars) || !Array.isArray(d.toys) || !d.cfg || typeof d.cfg.seed !== "number") throw new SaveError("The save is missing required data.");
  if (!d.chars.every((c: any) => typeof c.id === "number" && typeof c.x === "number" && Number.isFinite(c.x) && Number.isFinite(c.y) && Array.isArray(c.memories) && Array.isArray(c.rel))) throw new SaveError("The save has damaged character data.");
  return d as SaveData;
}

/** Build a fresh simulation from a save. */
export function restore(d: SaveData): Simulation {
  const sim = new Simulation(d.cfg);
  sim.expansion = { ...newExpansion(), ...structuredClone(d.expansion ?? {}) };
  sim.expansion.casino = { ...newCasino(), ...sim.expansion.casino };
  sim.life = { ...newLife(), ...structuredClone(d.life ?? {}) };
  for (const [id, name] of Object.entries(sim.life.renames)) if (sim.world.buildings[+id]) sim.world.buildings[+id].name = name;
  sim.tick = d.tick;
  sim.rng.setState(d.rng);
  sim.env = { ...sim.env, ...d.env };
  sim.playerId = d.playerId;
  sim.chars = d.chars.map((sc) => {
    const base = makeCharacter(sc.id, sc.name, sc.tier, sc.x, sc.y, sc.look, sc.pers, sim.rng);
    const { rel, memories, ...rest } = sc;
    const c: Character = Object.assign(base, rest, { rel: new Map(rel.map(unpackRel)), memories: memories.map(unpackMem), path: null, goal: null, bubble: null, goalCooldowns: {}, nextThink: d.tick + (sc.id % 20) });
    ensureMind(c);
    return c;
  });
  sim.toys = d.toys.map((t) => ({ ...t }));
  sim.events.restore(d.events);
  sim.groups.restore(d.groups);
  sim.routines = new Map(d.routines);
  d.lamps.forEach((on, i) => { if (sim.world.pois[i]) sim.world.pois[i].on = on; });
  if (d.vehicles) sim.vehicles = d.vehicles.map((v) => ({ ...v }));
  else for (const v of sim.vehicles) if (v.driver >= 0 && sim.chars[v.driver]?.inCar !== v.id) { v.driver = -1; v.state = "parked"; v.speed = 0; } // old save: fresh traffic, nobody behind the wheel
  sim.world.graffiti = d.graffiti.map((g) => ({ ...g }));
  sim.tills = { ...d.tills };
  sim.crimes = d.crimes.map((c) => ({ ...c, witnesses: [...c.witnesses] }));
  sim.bookings = d.bookings.map((b) => ({ ...b }));
  if (d.litter) restoreLitter(sim.litter, d.litter);
  sim.rebuildHash();
  sim.lod.update(sim);
  return sim;
}

/** Compact JSON: floats rounded to 3 decimals (millimetre precision is plenty), ~40% smaller. */
export function toJSON(d: SaveData): string {
  return JSON.stringify(d, (_k, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}

export class SaveSystem {
  constructor(private store: StorageProvider) {}
  key(slot: string) { return NS + "save:" + slot; }
  save(sim: Simulation, slot: string, label?: string): { ok: boolean; bytes: number; error?: string } {
    const json = toJSON(serialize(sim, label ?? slot));
    const ok = this.store.set(this.key(slot), json);
    return ok ? { ok, bytes: json.length } : { ok, bytes: json.length, error: "Browser storage is full or blocked." };
  }
  load(slot: string): Simulation {
    const raw = this.store.get(this.key(slot));
    if (!raw) throw new SaveError("There is no save in that slot.");
    return restore(parseSave(raw));
  }
  info(slot: string): { savedAt: string; label: string; tick: number } | null {
    const raw = this.store.get(this.key(slot));
    if (!raw) return null;
    try { const d = JSON.parse(raw); return { savedAt: d.savedAt, label: d.label, tick: d.tick }; } catch { return { savedAt: "corrupted", label: "Damaged save", tick: 0 }; }
  }
  remove(slot: string) { this.store.remove(this.key(slot)); }
  /** The slot's save as stored JSON, for exporting to a file. */
  raw(slot: string): string | null { return this.store.get(this.key(slot)); }
  /** Store a save file in a slot, after checking it parses as a valid save. */
  importRaw(slot: string, json: string): void {
    parseSave(json);
    if (!this.store.set(this.key(slot), json)) throw new SaveError("Browser storage is full or blocked.");
  }
}
