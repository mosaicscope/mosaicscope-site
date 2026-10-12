import type { Character, HatStyle } from "../entities/types";
import type { Role } from "../content/names";
import type { Simulation } from "../sim/Simulation";
import type { Weather } from "../sim/Environment";
import { TICKS_PER_HOUR } from "../sim/Environment";
import type { CultureProfile } from "./Culture";
import { deriveProfile, getProfile, setProfile } from "./Culture";

/**
 * DRESS: climate-appropriate layering, the Kiwi way.
 *
 * Christchurch is a four-seasons-in-a-day city (NIWA normals: Jan mean ~17C, Jul ~6C, big diurnal
 * swings, nor'wester foehn days that are hot and gale-ish, southerly changes that drop 10C in an
 * hour). Dress follows a simple thermal-comfort idea (Fanger's PMV, reduced to one number: the
 * clothing insulation needed to feel neutral, "clo") adjusted by personal cold tolerance, a social
 * layer (uniform > subculture > weather) and NZ-specific habits: sun-smart hats in the high-UV
 * summer, shorts-and-jandals people in all weather ("hardy" youth, surfers, trades), umbrellas
 * rare because of the wind, hoods up for the commute, beanies after dark in winter.
 *
 * Dress is purely cosmetic and derived (from profile + climate), so it is never saved and does not
 * touch `sim.rng`. Renderers call `dressOf(c)`; `updateDress` refreshes a staggered slice of the
 * population once a second.
 */

export type Season = "summer" | "autumn" | "winter" | "spring";
export type Top = "tee" | "shirt" | "knit" | "jacket" | "raincoat" | "puffer" | "hivis" | "uniform" | "wetsuit" | "suit" | "apron" | "robe";
export type Legs = "long" | "shorts";
export type Feet = "sneakers" | "boots" | "jandals" | "gumboots" | "shoes";

export interface Dress {
  top: Top;
  legs: Legs;
  feet: Feet;
  /** hat actually worn (may differ from `look.hat`; the signature hat wins unless the weather forces another) */
  hat: HatStyle;
  hood: boolean;
  umbrella: boolean;
  sunnies: boolean;
  scarf: boolean;
  /** 0..4 insulation layers, for the renderer's puffiness and for tests */
  layers: number;
  /** tint for the outer layer, or null to use the character's own colour */
  tint: string | null;
}

export interface Climate {
  tempC: number;      // felt air temperature at the character
  wind: number;       // 0..1
  rain: number;       // 0..1
  sun: number;        // 0..1 UV exposure (daylight, clear, summer)
  season: Season;
  hour: number;
  weather: Weather;
  nor_wester: boolean;
  southerly: boolean;
  dark: boolean;
}

// ---------------------------------------------------------------- climate

/** Mean daily temperature by month (Christchurch, NIWA 1991-2020 normals, rounded). */
const MONTH_MEAN = [17.3, 17.2, 15.4, 12.6, 9.7, 7.1, 6.5, 7.8, 10.1, 12.1, 14.1, 16.2];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function monthOfDay(day: number): number {
  let d = ((day % 365) + 365) % 365;
  for (let m = 0; m < 12; m++) { if (d < MONTH_DAYS[m]) return m; d -= MONTH_DAYS[m]; }
  return 11;
}
export function seasonOfMonth(m: number): Season { return m === 11 || m <= 1 ? "summer" : m <= 4 ? "autumn" : m <= 7 ? "winter" : "spring"; }

/** Cheap deterministic day hash in 0..1 (no RNG stream consumed). */
function dayHash(seed: number, day: number, salt: number): number {
  let h = Math.imul(seed ^ salt, 0x9e3779b1) ^ Math.imul(day + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12;
  return ((h >>> 0) % 10000) / 10000;
}

/** The sim has no calendar, so a seeded start day plus elapsed game days gives a slow season cycle. */
export function dayOfYear(sim: Simulation): number {
  const start = Math.floor(dayHash(sim.cfg.seed, 0, 77) * 365);
  return start + Math.floor((sim.env.startHour + sim.tick / TICKS_PER_HOUR) / 24);
}

/** Pure climate model. Tests feed it directly. */
export function climateAt(seed: number, day: number, hour: number, weather: Weather, rainLevel = -1): Climate {
  const month = monthOfDay(day), season = seasonOfMonth(month);
  const mean = MONTH_MEAN[month];
  const swing = season === "summer" ? 6 : season === "winter" ? 4.5 : 5.5;
  let t = mean + swing * Math.cos(((hour - 15) / 24) * Math.PI * 2); // warmest ~15:00
  // nor'wester: warm dry foehn from the Alps, spring-summer-autumn, ~1 day in 6; southerly: cold change, any season but mostly cooler months
  const nor_wester = season !== "winter" && dayHash(seed, day, 1) < 0.17 && weather !== "rain" && weather !== "storm";
  const southerly = !nor_wester && dayHash(seed, day, 2) < (season === "winter" ? 0.2 : 0.12);
  if (nor_wester) t += 5;
  if (southerly) t -= 6;
  if (weather === "cloudy") t -= 1.5; else if (weather === "rain") t -= 2.5; else if (weather === "storm") t -= 4;
  else if (hour < 7 || hour > 20) t -= 2; // clear skies lose heat fast (frosts)
  const dark = hour < 6 || hour > 20;
  const rain = rainLevel >= 0 ? rainLevel : weather === "storm" ? 1 : weather === "rain" ? 0.6 : 0;
  const wind = Math.min(1, (nor_wester ? 0.8 : southerly ? 0.65 : 0.15) + (weather === "storm" ? 0.5 : weather === "rain" ? 0.15 : 0));
  const day01 = hour >= 7 && hour <= 18 ? 1 : 0;
  const sun = weather === "clear" ? day01 * (season === "summer" ? 1 : season === "winter" ? 0.3 : 0.6) : weather === "cloudy" ? day01 * 0.35 * (season === "summer" ? 1 : 0.5) : 0;
  return { tempC: t - wind * 3, wind, rain, sun, season, hour, weather, nor_wester, southerly, dark };
}

export function climateOf(sim: Simulation): Climate {
  return climateAt(sim.cfg.seed, dayOfYear(sim), sim.hour, sim.env.weather, sim.env.rain);
}

/** What people say about it, for dialogue and tests ("Bit of a nor'wester, eh"). */
export function weatherTalk(cl: Climate): string {
  if (cl.nor_wester) return "Bit of a nor'wester today.";
  if (cl.southerly) return "That southerly came through quick.";
  if (cl.weather === "storm") return "Not the best day for it.";
  if (cl.weather === "rain") return "Bit damp out.";
  if (cl.tempC < 4) return "Brass monkeys out here.";
  if (cl.tempC > 25) return "Scorcher, eh.";
  if (cl.weather === "clear") return "Beautiful day, eh.";
  return "Not bad out.";
}

// ---------------------------------------------------------------- uniforms and signatures

/** Fixed outfits by job: a uniform beats subculture beats weather. */
const UNIFORM: Partial<Record<Role, { top: Top; hat?: HatStyle; tint?: string; feet?: Feet; legs?: Legs }>> = {
  cop: { top: "uniform", hat: "police", tint: "#1c6bd6", feet: "boots" },
  medic: { top: "hivis", tint: "#c6ff3d", feet: "boots" },
  cleaner: { top: "hivis", tint: "#f6b62c", feet: "boots" },
  mechanic: { top: "hivis", tint: "#f08a1c", feet: "boots" },
  barista: { top: "apron", feet: "sneakers" },
  chef: { top: "apron", hat: "bandana", feet: "shoes" },
  vendor: { top: "apron", feet: "sneakers" },
  dealer: { top: "suit", feet: "shoes" },
  bouncer: { top: "jacket", tint: "#0e0b0a", feet: "boots" },
  office: { top: "shirt", feet: "shoes" },
  zookeeper: { top: "uniform", tint: "#4f7a3a", feet: "gumboots" },
  mogul: { top: "robe", tint: "#b48cff", feet: "shoes" },
  mobster: { top: "suit", tint: "#0e0b0a", feet: "shoes" },
  model: { top: "jacket", feet: "shoes" },
  vigilante: { top: "jacket", tint: "#0e0b0a", hat: "hood", feet: "boots" },
};

/** Named mission characters keep their signature silhouette (hat always the same). */
const SIGNATURE: Record<string, { hat?: HatStyle; top?: Top; tint?: string }> = {
  "Vito Tessera": { hat: "beret", top: "suit", tint: "#0e0b0a" },
  "Roastie Malone": { hat: "snapback" },
  "Sir Ponsonby Velvet": { top: "robe", tint: "#b48cff" },
  "Bryce Wainui": { hat: "hood", top: "jacket", tint: "#0e0b0a" },
  "Hamish Quake": { hat: "helmet", top: "jacket", tint: "#c6ff3d" },
  "Chris": { hat: "beanie" },
};

const WET_ROLES = new Set<Role>(["skibunny", "zookeeper"]);

// ---------------------------------------------------------------- the model

/** Cold tolerance in degrees C shifted onto the felt temperature: shorts-in-winter people are +5. */
export function hardiness(prof: CultureProfile, role: Role): number {
  let h = (prof.quirk[0] - 0.5) * 5;
  if (prof.cohort === "youth") h += 2.5; else if (prof.cohort === "older") h -= 3;
  if (prof.sub === "surf") h += 4; else if (prof.sub === "trades" || prof.sub === "port") h += 2.5;
  else if (prof.sub === "student") h += 1.5; else if (prof.sub === "visitor") h -= 2; else if (prof.sub === "retiree") h -= 2;
  if (role === "skibunny") h += 1;
  return h;
}

/** Choose what a person wears. `prev` (optional) provides hysteresis so outfits don't flicker. */
export function dressFor(c: Pick<Character, "name" | "role" | "look" | "pers">, prof: CultureProfile, cl: Climate, prev?: Dress): Dress {
  const role = c.role;
  const sig = SIGNATURE[c.name];
  const uni = UNIFORM[role];
  const baseHat = c.look.hat;
  const felt = cl.tempC + hardiness(prof, role);
  // insulation needed, in layers (0 = tee in the sun .. 4 = full puffer): neutral at ~21C felt
  const rawNeed = Math.max(0, Math.min(4, (21 - felt) / 4.2));
  let need = Math.round(rawNeed);
  if (prev && Math.abs(rawNeed - prev.layers) < 0.7) need = prev.layers; // hysteresis
  const sunHot = cl.sun > 0.6 && felt > 20;

  // top
  let top: Top;
  if (sig?.top) top = sig.top;
  else if (uni) top = uni.top;
  else if (prof.sub === "surf" && (cl.tempC < 12 || cl.weather !== "clear") && prof.quirk[1] < 0.55) top = "wetsuit";
  else if (cl.rain > 0.3) top = need >= 3 ? "puffer" : "raincoat";
  else if (need >= 4) top = "puffer";
  else if (need === 3) top = "jacket";
  else if (need === 2) top = prof.sub === "cbd" || prof.sub === "creative" ? "jacket" : "knit";
  else if (need === 1) top = prof.quirk[2] < 0.5 ? "shirt" : "knit";
  else top = prof.sub === "cbd" || role === "office" ? "shirt" : "tee";
  // cold snaps on a hi-vis worker add a layer under it: counted in layers, not the silhouette
  const wetGear = cl.rain > 0.3 && (uni?.top === "hivis" || uni?.top === "uniform" || role === "cop");
  if (wetGear && (top === "hivis" || top === "uniform")) top = top === "uniform" ? "raincoat" : top;

  // legs: shorts when felt temperature is high or the person is a hardy shorts-in-winter type
  let legs: Legs = "long";
  if (!uni?.legs && !uni && !sig) {
    const shortsLimit = 16 + (prof.quirk[3] - 0.5) * 4;
    if (felt >= shortsLimit && top !== "wetsuit" && (role !== "office" || cl.tempC > 24)) legs = "shorts";
    if (prof.sub === "surf" && cl.rain < 0.3 && top !== "puffer") legs = "shorts";
    if (prof.cohort === "older" && felt < 25) legs = "long";
  } else if (uni?.legs) legs = uni.legs;

  // feet
  let feet: Feet;
  if (uni?.feet) feet = uni.feet;
  else if (cl.rain > 0.5 && WET_ROLES.has(role)) feet = "gumboots";
  else if (legs === "shorts" && felt > 18 && cl.rain < 0.3 && prof.cohort !== "older" && !(prof.sub === "cbd")) feet = "jandals";
  else if (prof.sub === "surf" && cl.rain < 0.3) feet = "jandals";
  else if (cl.rain > 0.5 || need >= 3) feet = prof.quirk[1] < 0.4 ? "gumboots" : "boots";
  else feet = prof.sub === "cbd" || prof.sub === "service" ? "shoes" : "sneakers";
  if (c.look.kind === "girl" && feet === "gumboots" && cl.rain < 0.5) feet = "boots";

  // head: signature or uniform hat first, then weather
  let hat: HatStyle = sig?.hat ?? uni?.hat ?? baseHat;
  let hood = false;
  const forced = !(sig?.hat || uni?.hat);
  if (forced) {
    if (cl.rain > 0.3 && (top === "raincoat" || top === "puffer" || top === "jacket") && baseHat !== "helmet") {
      // Christchurch: the hood goes up before the umbrella comes out
      if (baseHat === "none" || prof.quirk[0] > 0.5) { hat = "hood"; hood = true; }
    } else if (need >= 3 && (cl.dark || felt < 4) && baseHat === "none") hat = "beanie";
    else if (need >= 3 && baseHat === "none" && prof.quirk[3] < 0.5) hat = "beanie";
    else if (cl.sun > 0.55 && cl.season === "summer" && (baseHat === "none" || baseHat === "beanie")) {
      // slip, slop, slap: high-UV summers (NZ Cancer Society) mean hats and sunnies
      hat = prof.cohort === "older" ? "bucket" : prof.quirk[2] < 0.6 ? "cap" : "none";
    } else if (baseHat === "beanie" && sunHot) hat = prof.quirk[2] < 0.5 ? "cap" : "none";
  }

  const umbrella = cl.rain > 0.3 && cl.wind < 0.45 && !hood && !uni && !sig && (prof.cohort === "older" || prof.sub === "cbd" || prof.sub === "visitor") && prof.quirk[1] > 0.4;
  const sunnies = cl.sun > 0.5 && !cl.dark && prof.quirk[2] > 0.25;
  const scarf = need >= 3 && cl.dark && !uni && prof.quirk[0] > 0.4 && top !== "wetsuit";
  const tint = sig?.tint ?? uni?.tint ?? null;
  return { top, legs, feet, hat, hood, umbrella, sunnies, scarf, layers: top === "wetsuit" ? 2 : need, tint };
}

// ---------------------------------------------------------------- state

const DRESS = new WeakMap<Character, Dress>();

export function dressOf(c: Character): Dress | undefined { return DRESS.get(c); }

/** Build and store the dress for one person, deriving their cultural profile if needed. */
export function dress(sim: Simulation, c: Character, cl: Climate = climateOf(sim)): Dress {
  let prof = getProfile(c);
  if (!prof) {
    const area = sim.world.areas[c.homeArea]?.kind ?? "street";
    prof = setProfile(c, deriveProfile(sim.cfg.seed, c.id, c.role, area, c.tier === "principal"));
  }
  const d = dressFor(c, prof, cl, DRESS.get(c));
  DRESS.set(c, d);
  return d;
}

/**
 * Per-second refresh (called from the environment tick): everybody is re-evaluated every 8 seconds,
 * staggered by id, and the whole town at once when the weather changes. Hysteresis in `dressFor`
 * keeps people from flickering at a threshold.
 */
export function updateDress(sim: Simulation, forceAll = false): void {
  const cl = climateOf(sim);
  const slot = Math.floor(sim.tick / 60) % 8;
  const chars = sim.chars;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!forceAll && (c.id & 7) !== slot && DRESS.has(c)) continue;
    dress(sim, c, cl);
  }
}

/** Plain-English outfit, for the debug panel and tests. */
export function describeDress(d: Dress): string {
  const bits: string[] = [d.top === "raincoat" ? "rain jacket" : d.top === "hivis" ? "hi-vis" : d.top];
  if (d.hood) bits.push("hood up"); else if (d.hat !== "none") bits.push(d.hat);
  if (d.scarf) bits.push("scarf");
  if (d.legs === "shorts") bits.push("shorts");
  bits.push(d.feet);
  if (d.umbrella) bits.push("umbrella");
  if (d.sunnies) bits.push("sunnies");
  return bits.join(", ");
}
