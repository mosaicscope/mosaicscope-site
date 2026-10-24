import {bakeCityDistrict,registerCityBuilding,validDistrict} from '../world/CitySurvey';
import type {DistrictData,MappedBuilding} from '../ui/DestinationDistrict';
import {restoreCityPlay} from '../sim/CityPlay';
import {STREET_NEIGHBOURS} from '../content/streetVoices';
import {spawnBackground} from '../sim/Spawner';
import {migrateMappedPositions} from './MappedMigration';
import {spawnVehicles,refreshAmbientFleet} from '../sim/Traffic';
import {restoreWorldFun} from '../sim/WorldFun';
import {restoreCommerce,type CommerceState} from '../sim/Commerce';
import {restoreSubstances} from '../sim/Substances';
import {newStreetLife} from '../sim/StreetLife';
import { restoreSaltProgress, type SaltProgress } from '../content/salt-story/progress';
import {rememberContinue} from './ContinueCookie';
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
import { newLifeSystemFlags, type LifeSystemFlags } from "../debug/flags";

/**
 * Versioned saves. The world layout is regenerated from the seed (deterministic), so a save stores
 * the seed/config plus everything dynamic: characters (needs, emotions, inventory, relationships,
 * memories), toys, cars, graffiti, tills, crime records, bookings, environment, groups, routines
 * and event history. Transient AI state (paths,
 * current plans) is dropped and rebuilt by the AI on load.
 */
export const SAVE_VERSION = 8;

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
  citySurvey?:{buildings:MappedBuilding[];districts:DistrictData[]};
  mappedDamage?:import('../sim/MappedFacadeDamage').MappedFacadeRecord[];
  ambientFleetVersion?:number;
  trafficMode?:'cruise'|'city'|'rush';
  cityPlay?:import("../sim/CityPlay").CityPlay;
  worldFun?:import('../sim/WorldFun').WorldFunState;
  saltStory?: SaltProgress;
  commerce?: CommerceState;
  streetLife?: import("../sim/StreetLife").StreetLifeState;
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
  pendingAmbulance?:[number,number][];
  civicDamage?:import("../world/World").World["civicDamage"];
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
  7: (d) => ({ ...d, version: 8, life: { ...newLife(), ...(d.life ?? {}), upgrades: { ...newLife().upgrades, ...(d.life?.upgrades ?? {}) } } }),
  // v6 adds the Batch 1 daily-life state with defaults, preserving all existing story progress.
  6: (d) => {
    const defaults = newLife();
    return { ...d, version: 7, life: { ...defaults, ...(d.life ?? {}), systems: { ...defaults.systems, ...(d.life?.systems ?? {}) } } };
  },
  4: (d) => ({ ...d, version: 5, chars: d.chars.map((c: any) => ({ ...c, mind: c.mind ?? newMind(c.id, c.pers) })) }),
};

export function serialize(sim: Simulation, label = "Save"): SaveData {
  return {
    citySurvey:sim.world.mapped?{buildings:[...(sim.world.mapped.streamedBuildingIds??[])].map(id=>sim.world.mapped!.byBuilding.get(id)!),districts:sim.world.mapped.streamedData??[]}:undefined,
    mappedDamage:sim.mappedDamage.snapshot(),
    ambientFleetVersion:3,
    trafficMode:sim.world.mapped?.trafficMode,
    saltStory: { ...sim.saltStory },
    cityPlay:structuredClone(sim.cityPlay),streetLife: structuredClone(sim.streetLife),worldFun:structuredClone(sim.worldFun),
    commerce: structuredClone(sim.commerce),
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
    civicDamage:structuredClone(sim.world.civicDamage),
    pendingAmbulance:[...sim.pendingAmbulance],
    vehicles: sim.vehicles.map((v) => structuredClone(v)),
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
export function restore(d: SaveData, lifeFlags: LifeSystemFlags = newLifeSystemFlags(),mapped=false): Simulation {
  const migrate=mapped&&!d.cfg.cityMap;
  const sim = new Simulation({...d.cfg,...(mapped?{cityMap:'christchurch' as const,trafficCars:650,pathsPerTick:2,backgroundCount:(d.ambientFleetVersion??0)<3?Math.min((d.cfg.backgroundCount??150)*3,900):d.cfg.backgroundCount}:{})}, {}, lifeFlags);
  if(sim.world.mapped&&d.citySurvey){const survey=d.citySurvey;
    if(Array.isArray(survey.buildings)&&survey.buildings.length<50000&&Array.isArray(survey.districts)&&survey.districts.length<=32){
      for(const b of survey.buildings)if(validDistrict({code:'CHC',cx:0,cy:0,centre:{name:''},buildings:[b],roads:[],venues:[]}))registerCityBuilding(sim.world,b);
      for(const district of survey.districts)if(validDistrict(district))for(const _ of bakeCityDistrict(sim.world,district)){void _;}
      sim.world.cityTiles.trim(d.chars[d.playerId]?.x??sim.player.x,d.chars[d.playerId]?.y??sim.player.y);
    }
  }
  const freshFleet=migrate?sim.vehicles:[];
  const freshNeighbours=sim.chars.filter(c=>STREET_NEIGHBOURS.some(n=>n.name===c.name));
  if(sim.world.mapped&&['cruise','city','rush'].includes(d.trafficMode??''))sim.world.mapped.trafficMode=d.trafficMode;
  sim.saltStory = restoreSaltProgress(d.saltStory);sim.worldFun=restoreWorldFun(d.worldFun);sim.cityPlay=restoreCityPlay(d.cityPlay);
  sim.commerce=restoreCommerce(d.commerce);
  const street=d.streetLife;
  sim.streetLife=street&&Number.isSafeInteger(street.serial)&&Number.isFinite(street.nextAt)&&Array.isArray(street.history)?structuredClone(street):newStreetLife();
  sim.streetLife.history=sim.streetLife.history.filter(e=>Number.isFinite(e.x+e.y)&&Array.isArray(e.actors)&&typeof e.line==='string'&&typeof e.title==='string').slice(-24);
  sim.expansion = { ...newExpansion(), ...structuredClone(d.expansion ?? {}) };
  sim.expansion.casino = { ...newCasino(), ...sim.expansion.casino };
  sim.life = { ...newLife(), ...structuredClone(d.life ?? {}) };
  sim.life.upgrades = { ...newLife().upgrades, ...sim.life.upgrades };
  sim.life.body = { ...newLife().body, ...sim.life.body };
  sim.life.systems = { ...newLife().systems, ...sim.life.systems };
  for (const [id, name] of Object.entries(sim.life.renames)) if (sim.world.buildings[+id]) sim.world.buildings[+id].name = name;
  sim.tick = d.tick;
  sim.rng.setState(d.rng);
  sim.env = { ...sim.env, ...d.env };
  sim.playerId = d.playerId;
  sim.chars = d.chars.map((sc) => {
    const base = makeCharacter(sc.id, sc.name, sc.tier, sc.x, sc.y, sc.look, sc.pers, sim.rng);
    const { rel, memories, ...rest } = sc;
    const c: Character = Object.assign(base, rest, { rel: new Map(rel.map(unpackRel)), memories: memories.map(unpackMem), path: null, goal: null, bubble: null, goalCooldowns: {}, nextThink: d.tick + (sc.id % 20) });
    c.substances=restoreSubstances(c.substances,d.tick);
    ensureMind(c);
    return c;
  });
  sim.toys = d.toys.map((t) => ({ ...t }));
  sim.events.restore(d.events);
  sim.groups.restore(d.groups);
  sim.routines = new Map(d.routines);
  d.lamps.forEach((on, i) => { if (sim.world.pois[i]) sim.world.pois[i].on = on; });
  if (d.vehicles) {sim.vehicles = d.vehicles.map((v) => structuredClone(v));if((d.ambientFleetVersion??0)<2)refreshAmbientFleet(sim);}
  else for (const v of sim.vehicles) if (v.driver >= 0 && sim.chars[v.driver]?.inCar !== v.id) { v.driver = -1; v.state = "parked"; v.speed = 0; } // old save: fresh traffic, nobody behind the wheel
  sim.world.graffiti = d.graffiti.map((g) => ({ ...g }));
  sim.tills = { ...d.tills };
  sim.crimes = d.crimes.map((c) => ({ ...c, witnesses: [...c.witnesses] }));
  sim.bookings = d.bookings.map((b) => ({ ...b }));
  if (d.litter) restoreLitter(sim.litter, d.litter);
  sim.world.civicDamage=structuredClone(d.civicDamage??{});
  sim.mappedDamage.restore(d.mappedDamage??[]);
  sim.pendingAmbulance=new Map(d.pendingAmbulance??[]);
  if(migrate){migrateMappedPositions(sim);const plates=new Set(sim.vehicles.map(v=>v.plate));for(const fresh of freshFleet){if(sim.vehicles.length>=360)break;if(sim.vehicles.some(v=>Math.hypot(v.x-fresh.x,v.y-fresh.y)<3))continue;const v=structuredClone(fresh);v.id=sim.vehicles.length;v.driver=-1;if(plates.has(v.plate))v.plate='MAP'+(100+v.id);plates.add(v.plate);sim.vehicles.push(v);}}
  if(mapped&&(d.ambientFleetVersion??0)<3){for(const c of sim.chars)sim.names?.reserve(c.name);spawnBackground(sim,Math.max(0,sim.cfg.backgroundCount-sim.chars.filter(c=>c.tier==='background').length));}
  if(sim.world.mapped)for(const fresh of freshNeighbours)if(!sim.chars.some(c=>c.name===fresh.name)){
    const c=structuredClone(fresh),spot=sim.world.nearestFoot(sim.player.x+sim.chars.length%12-6,sim.player.y+8,16);
    c.id=sim.chars.length;c.x=c.px=spot.x;c.y=c.py=spot.y;c.rel=new Map();c.memories=[];c.hand=-1;c.bag=[];c.inCar=-1;sim.chars.push(c);
  }
  if(sim.world.mapped&&(d.ambientFleetVersion??0)<3)spawnVehicles(sim);
  sim.rebuildHash();
  sim.lod.update(sim);
  return sim;
}

/** Compact JSON: floats rounded to 3 decimals (millimetre precision is plenty), ~40% smaller. */
export function toJSON(d: SaveData): string {
  return JSON.stringify(d, (_k, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}

export class SaveSystem {
  constructor(private store: StorageProvider,private mapped=false) {}
  key(slot: string) { return NS + "save:" + slot; }
  save(sim: Simulation, slot: string, label?: string): { ok: boolean; bytes: number; error?: string } {
    const json = toJSON(serialize(sim, label ?? slot));
    const ok = this.store.set(this.key(slot), json);
    if(ok)rememberContinue(slot);
    return ok ? { ok, bytes: json.length } : { ok, bytes: json.length, error: "Browser storage is full or blocked." };
  }
  load(slot: string, lifeFlags: LifeSystemFlags = newLifeSystemFlags()): Simulation {
    const raw = this.store.get(this.key(slot));
    if (!raw) throw new SaveError("There is no save in that slot.");
    const sim=restore(parseSave(raw), lifeFlags,this.mapped);rememberContinue(slot);return sim;
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
