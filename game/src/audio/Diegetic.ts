/**
 * Hunter S Bombson's in-world sound layer: everything you would hear standing in the city, and nothing
 * you would call music. All original, all synthesised live with Web Audio (no samples, no files).
 *
 * Footsteps by surface, engines by car class (with doppler as they pass), horns, sirens, crashes, car
 * doors, rain, wind and thunder, birds by day and crickets by night, distant traffic and crowd murmur that
 * follow the camera, shop bells and door latches, cans clinking, the Avon Recycling Centre's machinery,
 * bins, fridge hum and bass leaking through club walls. Indoors the whole outside world is muffled.
 *
 * Positional (pan + distance falloff, with a flatter side-on mix for the 2D street view), a hard cap on
 * live one-shot voices, and a smaller pool on phones. It sits on its own bus: its own mute and volume,
 * separate from the soundtrack (N mutes music only; J mutes this).
 *
 * Everything above `Diegetic` is pure so it can be tested without an AudioContext.
 */
import { T } from "../world/World";
import type { BuildingKind } from "../content/buildings";
import type { VehicleClass } from "../content/vehicles";
import type { Simulation } from "../sim/Simulation";
import type { Camera } from "../render/Camera";
import { carMutationOf } from "../render/CarMutation";
import { DEFAULT_VOICE, DEFAULT_FOOT, DEFAULT_AMBIENCE, voiceAllowed, voicePitch, voiceDuration, voiceTone, footGain, shoePitch, ambienceGain } from "./Prefs";
import { UI_TONES, uiGain } from "./Prefs";
import type { VoicePrefs, FootPrefs, AmbiencePrefs, UiTone } from "./Prefs";

// ------------------------------------------------------------------ pure planning

export type Surface = "pave" | "road" | "grass" | "wood" | "tile" | "sand" | "court" | "gravel";

/** What the player is hearing from (set by the game every frame). */
export interface Scene {
  /** the building whose interior is open, or null on the street */
  interior: BuildingKind | null;
  /** walking / running inside the interior */
  moving: boolean; running: boolean;
  /** the flat side-on street view */
  in2D: boolean;
}
export const STREET: Scene = { interior: null, moving: false, running: false, in2D: false };

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Stereo pan kept in the -1..1 range the panner accepts. */
export const clamp01Pan = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/** Footstep sounds are switched off for now (set to true to bring them back). */
const FOOTSTEPS_ON = false;

/** Which ground a footstep lands on. */
export function surfaceOf(tile: number): Surface {
  switch (tile) {
    case T.GRASS: case T.HEDGE: return "grass";
    case T.FLOOR: case T.STAGE: return "wood";
    case T.SAND: return "sand";
    case T.COURT: return "court";
    case T.ROAD: case T.CROSSWALK: return "road";
    case T.PARKING: case T.PATH: return "gravel";
    default: return "pave";
  }
}

/** Metres of walking per footstep: shorter strides when slow. */
export const strideFor = (speed: number): number => (speed > 3.4 ? 1.15 : 0.78);

export interface FootRecipe { noise: [freq: number, q: number, dur: number, vol: number, type: BiquadFilterType]; thud?: [f0: number, f1: number, dur: number, vol: number, wave: OscillatorType]; squeak?: number }
export const FOOT: Record<Surface, FootRecipe> = {
  pave:   { noise: [1900, 0.8, 0.05, 0.5, "bandpass"], thud: [120, 70, 0.06, 0.3, "sine"] },
  road:   { noise: [2500, 1.0, 0.06, 0.4, "bandpass"], thud: [100, 60, 0.05, 0.2, "sine"] },
  grass:  { noise: [900, 0.5, 0.1, 0.4, "lowpass"] },
  wood:   { noise: [700, 0.9, 0.05, 0.25, "bandpass"], thud: [170, 90, 0.08, 0.45, "triangle"] },
  tile:   { noise: [3200, 0.7, 0.035, 0.4, "highpass"], thud: [230, 120, 0.05, 0.25, "sine"] },
  sand:   { noise: [1500, 0.4, 0.13, 0.32, "bandpass"] },
  court:  { noise: [1400, 0.8, 0.04, 0.3, "bandpass"], thud: [150, 80, 0.06, 0.35, "sine"], squeak: 0.14 },
  gravel: { noise: [3200, 0.4, 0.08, 0.45, "bandpass"], thud: [110, 70, 0.04, 0.2, "sine"] },
};

/** The floor underfoot inside each kind of building. */
export function interiorSurface(k: BuildingKind): Surface {
  return TILED.has(k) ? "tile" : "wood";
}
const TILED = new Set<BuildingKind>(["diner", "pizza", "sushi", "bakery", "cafe", "fishchips", "dairy", "hospital", "mentalhealth", "bank", "police", "recycling", "gym", "airport", "garage"]);

/** Distance falloff and stereo pan from the camera. The 2D street view is side-on: depth counts for less, pan is wider. */
export function spatialize(dx: number, dy: number, zoom: number, in2D: boolean): { gain: number; pan: number; dist: number } {
  let dist: number, range: number, pan: number;
  if (in2D) {
    const u = (dx - dy) / 1.414, v = (dx + dy) / 1.414; // screen axes of the side view
    dist = Math.hypot(u, v * 0.5); range = 14; pan = u / 8;
  } else {
    dist = Math.hypot(dx, dy); range = Math.min(40, Math.max(14, 36 / (0.5 + zoom * 0.5))); pan = (dx - dy) / 14;
  }
  const f = clamp01(1 - dist / range);
  return { gain: f * f, pan: Math.max(-1, Math.min(1, pan)), dist };
}

/** Doppler pitch ratio from the radial speed of the source (tiles/s, positive = moving away). The speed of sound is shrunk so a pass is audible. */
export function dopplerRate(radial: number): number {
  const c = 38;
  return Math.max(0.8, Math.min(1.25, c / (c + radial)));
}

export interface EngineProfile { idle: number; top: number; cut: number; burble: number; sub: number; pops: boolean }
const E = (idle: number, top: number, cut: number, burble = 0.05, sub = 0.5, pops = false): EngineProfile => ({ idle, top, cut, burble, sub, pops });
export const ENGINE: Record<VehicleClass, EngineProfile> = {
  hatch: E(72, 200, 950),                 // buzzy little three-pot
  sedan: E(62, 170, 850),
  suv: E(55, 150, 700),
  ute: E(46, 140, 650, 0.18, 0.7),        // diesel clatter
  taxi: E(62, 170, 850),
  police: E(64, 205, 1100),
  van: E(50, 130, 650, 0.1),
  ambulance: E(48, 150, 700, 0.1),
  jdm: E(74, 270, 1700, 0.12, 0.35, true),  // pops and bangs
  muscle: E(38, 150, 800, 0.38, 0.8, true), // V8 burble
  sports: E(66, 285, 1900, 0.08, 0.3, true),
  super: E(82, 350, 2500, 0.06, 0.25, true),
  // the rest of the street
  mini: E(80, 210, 900, 0.04, 0.4),       // tiny two-pot buzz
  wagon: E(58, 160, 800),
  hothatch: E(72, 250, 1500, 0.1, 0.35, true),
  coupe: E(64, 250, 1500, 0.08, 0.35, true),
  roadster: E(66, 240, 1400, 0.08, 0.3, true),
  limo: E(40, 140, 600, 0.12, 0.7),
  hearse: E(44, 140, 600, 0.1, 0.6),
  minivan: E(52, 140, 650),
  camper: E(70, 110, 500, 0.2, 0.6),      // air-cooled rattle
  dcute: E(46, 140, 650, 0.18, 0.7),
  flatdeck: E(40, 120, 550, 0.22, 0.8),
  tradie: E(50, 130, 650, 0.12),
  icecream: E(50, 120, 600, 0.1),
  post: E(78, 130, 700, 0.08, 0.4),       // little two-stroke-ish delivery van
  bus: E(36, 110, 500, 0.2, 0.9),
  tow: E(42, 130, 600, 0.2, 0.8),
  fire: E(34, 120, 520, 0.22, 0.9),
  bin: E(36, 105, 480, 0.2, 0.9),
  banger: E(70, 150, 700, 0.3, 0.5),      // misfiring
  retro: E(90, 150, 600, 0.15, 0.3),      // air-cooled flat-four
  lowrider: E(36, 130, 700, 0.3, 0.8, true),
  fourby: E(46, 140, 650, 0.18, 0.7),
  ev: E(180, 420, 2600, 0, 0.1),         // electric whine
  rally: E(70, 260, 1700, 0.1, 0.35, true),
  hotrod: E(34, 160, 900, 0.4, 0.8, true),
};

/** Engine note for a car: five "gears", pitch climbing inside each and dropping at the shift. */
export function engineFreq(p: EngineProfile, speed: number, topSpeed: number): number {
  const s = clamp01(Math.abs(speed) / Math.max(1, topSpeed));
  const g = Math.min(4, Math.floor(s * 5)), t = s * 5 - g;
  const rev = clamp01((g * 0.1 + t * 0.62) / 0.9); // 0..1 across the whole range, sawtoothing at each shift
  return p.idle + (p.top - p.idle) * rev;
}

export type SirenKind = "yelp" | "hilo" | "wail";
export const sirenKindFor = (cls: VehicleClass): SirenKind => (cls === "police" ? "yelp" : cls === "ambulance" ? "hilo" : "wail");
/** Siren pitch at time t (seconds): police yelp, ambulance hi-lo, fire-engine wail. */
export function sirenFreq(kind: SirenKind, t: number): number {
  if (kind === "hilo") return Math.floor(t / 0.55) % 2 === 0 ? 960 : 720;
  if (kind === "yelp") { const ph = (t % 0.22) / 0.22; return 700 + 800 * ph; }
  const ph = (t % 4.5) / 4.5; return 560 + 820 * (ph < 0.6 ? ph / 0.6 : 1 - (ph - 0.6) / 0.4);
}

/** How loud the distant-traffic and crowd beds are, from what is near the camera. */
export function busyness(carWeight: number, people: number, hour: number): { traffic: number; crowd: number } {
  const h = ((hour % 24) + 24) % 24;
  const night = h < 5 || h >= 23 ? 0.35 : h < 7 || h >= 21 ? 0.7 : 1;
  return { traffic: clamp01(1 - Math.exp(-carWeight / 5)) * (0.5 + night * 0.5), crowd: clamp01(1 - Math.exp(-people / 24)) * night };
}

/** Daytime birdsong: dawn chorus peaks early, silenced by rain, richer near greenery. Per-second chirp rate. */
export function birdRate(hour: number, rain: number, greenery: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.2 || h >= 20 || rain > 0.45) return 0;
  const day = h < 8 ? 1.5 : h < 17 ? 0.8 : 0.6;
  return day * (0.15 + greenery) * (1 - rain * 1.8);
}
/** Night insects (crickets). 0..1 */
export function cricketLevel(hour: number, rain: number, greenery: number, storm: boolean): number {
  const h = ((hour % 24) + 24) % 24;
  if ((h > 5 && h < 19.5) || storm) return 0;
  return clamp01(0.25 + greenery) * (1 - rain * 0.9) * (h >= 19.5 || h <= 5 ? 1 : 0);
}
export function windLevel(weather: string, rain: number): number {
  return weather === "storm" ? 0.9 : weather === "rain" ? 0.4 + rain * 0.15 : weather === "cloudy" ? 0.22 : 0.1;
}

/** Terrance's voice: a clipped square-wave mutter, one blip per letter, pitched by the letter, stressed by capitals and bangs. */
export interface Blip { f: number; dur: number; gap: number; vol: number }
export function voiceBlips(text: string, base = 92): Blip[] {
  const out: Blip[] = [];
  for (const ch of text.slice(0, 90)) {
    if (out.length >= 28) break;
    const lower = ch.toLowerCase();
    if (lower === " ") { if (out.length) out[out.length - 1].gap += 0.07; continue; }
    if (!/[a-z0-9]/.test(lower)) { if (out.length) out[out.length - 1].gap += ch === "." || ch === "!" || ch === "?" ? 0.16 : 0.08; continue; }
    const k = lower.charCodeAt(0);
    const step = (k * 7) % 11; // 0..10 semitone-ish steps
    const shout = ch !== lower || text.includes("!");
    out.push({ f: base * 2 ** (step / 9) * (shout ? 1.15 : 1), dur: 0.045 + (k % 3) * 0.012, gap: 0.028, vol: shout ? 1 : 0.75 });
  }
  return out;
}

// ---- the mix rule: every sound obeys this, so the street never piles up

/** Who gets to speak when it is crowded: crashes and horns beat doors and clinks, which beat footsteps and birds. */
export type Prio = "critical" | "event" | "foley";
export interface MixCaps { total: number; event: number; foley: number }
export const mixCaps = (lite: boolean): MixCaps => (lite ? { total: 5, event: 3, foley: 2 } : { total: 8, event: 5, foley: 3 });
/** Minimum seconds between two starts of the same priority (stops a burst of identical sounds on one frame). */
export const MIX_GAP: Record<Prio, number> = { critical: 0.08, event: 0.06, foley: 0.11 };
/** The whole world-sound bus sits well under the soundtrack. */
export const BUS_LEVEL = 0.6;
/** Ambient beds sit under the bus level, and duck briefly when something important sounds. */
export const AMBIENT_LEVEL = 0.6;
export const DUCK = { amount: 0.4, secs: 0.45, music: 0.3 };

/** May a new one-shot of this priority start, given what is already playing? Critical sounds get headroom, foley is first to be dropped. */
export function admit(prio: Prio, live: Record<Prio, number>, c: MixCaps): boolean {
  const total = live.critical + live.event + live.foley;
  if (prio === "critical") return total < c.total + 2;
  if (prio === "event") return total < c.total && live.event + live.critical < c.event;
  return total < c.total - 2 && live.foley < c.foley;
}

/** Of the footsteps due this instant, which are heard: always yours, then only the nearest one or two others, and those quietly. */
export interface StepCand { id: number; dist: number; player: boolean }
export function pickSteps(cands: StepCand[], in2D: boolean, lite: boolean): { id: number; gain: number }[] {
  const range = in2D ? 7 : 9, maxOthers = in2D || lite ? 1 : 2;
  const out: { id: number; gain: number }[] = [];
  const others: StepCand[] = [];
  for (const c of cands) { if (c.player) out.push({ id: c.id, gain: 0.5 }); else if (c.dist < range) others.push(c); }
  others.sort((a, b) => a.dist - b.dist);
  for (const c of others.slice(0, maxOthers)) out.push({ id: c.id, gain: 0.2 * (1 - c.dist / range) ** 1.5 });
  return out;
}

export type DoorKind = "bell" | "latch" | "heavy";
export function doorKind(k: BuildingKind): DoorKind {
  if (k === "nightclub" || k === "stripclub" || k === "velvet" || k === "casino" || k === "police" || k === "hospital") return "heavy";
  if (SHOPS.has(k)) return "bell";
  return "latch";
}
const SHOPS = new Set<BuildingKind>(["diner", "pizza", "sushi", "bakery", "cafe", "fishchips", "dairy", "toyshop", "sports", "pawn", "records", "barber", "gym", "bank", "gallery", "dealership", "studio"]);

/**
 * A tiny signature jingle for every shop type, so you can tell where you are with your eyes shut.
 * `notes` are semitones above `root` (Hz); each note lasts `step` seconds on `wave`.
 */
export interface Jingle { wave: OscillatorType; root: number; notes: number[]; step: number }
export const JINGLES: Partial<Record<BuildingKind, Jingle>> = {
  diner: { wave: "triangle", root: 659, notes: [0, 4, 7, 4], step: 0.11 },        // cheerful counter ding
  pizza: { wave: "square", root: 392, notes: [0, 7, 5, 12], step: 0.09 },          // bouncy
  sushi: { wave: "sine", root: 880, notes: [0, 2, 7, 9], step: 0.14 },             // pentatonic chime
  bakery: { wave: "sine", root: 784, notes: [0, 4, 7, 12, 7], step: 0.1 },         // warm music-box rise
  cafe: { wave: "triangle", root: 523, notes: [0, 5, 4, 0], step: 0.13 },          // easy-going
  fishchips: { wave: "square", root: 330, notes: [0, 0, 7, 5], step: 0.1 },        // seaside squeeze-box
  dairy: { wave: "sine", root: 698, notes: [0, 7, 0], step: 0.15 },                // milk-float bell
  toyshop: { wave: "square", root: 1046, notes: [0, 4, 8, 12, 16], step: 0.06 },   // wind-up toy climb
  sports: { wave: "sawtooth", root: 392, notes: [0, 0, 7, 12], step: 0.08 },       // stadium fanfare
  pawn: { wave: "triangle", root: 311, notes: [0, -3, 0, 5], step: 0.12 },         // wary shop-bell, slightly off
  records: { wave: "sine", root: 440, notes: [0, 3, 7, 10, 14], step: 0.09 },      // jazzy seventh arpeggio
  barber: { wave: "triangle", root: 587, notes: [0, 5, 9, 5], step: 0.1 },         // barbershop two-step
  gym: { wave: "sawtooth", root: 196, notes: [0, 12, 0, 12], step: 0.07 },         // clanging plates
  bank: { wave: "sine", root: 523, notes: [0, 7, 12], step: 0.2 },                 // dignified triad
  gallery: { wave: "sine", root: 987, notes: [0, 6, 11], step: 0.22 },             // hushed, slightly strange
  dealership: { wave: "square", root: 440, notes: [0, 5, 9, 14], step: 0.08 },     // used-car jingle
  studio: { wave: "triangle", root: 466, notes: [0, 3, 5, 10], step: 0.12 },       // control-room sting
};
export const jingleFor = (k: BuildingKind): Jingle | null => JINGLES[k] ?? null;
/** Frequencies of each note of a jingle. */
export const jingleFreqs = (j: Jingle): number[] => j.notes.map((n) => j.root * Math.pow(2, n / 12));

/** Puddles only splash when it is properly wet and the ground is hard. */
export function puddleChance(surface: Surface, rain: number): number {
  if (surface !== "pave" && surface !== "road" && surface !== "gravel") return 0;
  return clamp01((rain - 0.3) * 1.6);
}
/** Gaps (s) after a first drip at which its echoes land, softer each time; a bigger drip echoes more. */
export function dripEchoes(size: number): { at: number; vol: number }[] {
  const n = size > 0.66 ? 3 : size > 0.33 ? 2 : 1;
  return Array.from({ length: n }, (_, i) => ({ at: 0.16 * (i + 1) * (1 + i * 0.4), vol: Math.pow(0.5, i + 1) }));
}
/** Drips per second from awnings and gutters: nothing in the dry, steady once it is soaking. */
export const dripRate = (rain: number): number => (rain < 0.12 ? 0 : 0.6 + rain * 3.2);

/**
 * The train: passes every `period` seconds and takes `length` to go by. Returns 0 when it is not
 * running, else a swell that rises, holds and fades (0..1).
 */
export function trainSwell(t: number, period = 95, length = 16, offset = 31): number {
  const x = (((t - offset) % period) + period) % period;
  if (x >= length) return 0;
  const u = x / length;
  return Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 * (u > 0.87 ? (1 - u) / 0.13 : 1);
}
/** Always faintly there when it runs, louder the nearer the station. */
export const trainReach = (dist: number): number => 0.2 + 0.8 * clamp01(1 - dist / 42);
/** Wheel clack rate (Hz) tracks the swell: slow rumble out of the station, quick at speed. */
export const trainClack = (swell: number): number => 2 + swell * 6;

/** What each interior sounds like underneath: chatter, a fridge, bass through the walls, machines. */
export interface Room { crowd: number; fridge: boolean; bass: number; machine: number }
export const ROOMS: Partial<Record<BuildingKind, Room>> = {
  nightclub: { crowd: 0.7, fridge: false, bass: 1, machine: 0 },
  stripclub: { crowd: 0.55, fridge: false, bass: 0.9, machine: 0 },
  velvet: { crowd: 0.35, fridge: false, bass: 0.55, machine: 0 },
  casino: { crowd: 0.55, fridge: false, bass: 0.3, machine: 0 },
  diner: { crowd: 0.4, fridge: true, bass: 0, machine: 0 },
  pizza: { crowd: 0.3, fridge: true, bass: 0, machine: 0 },
  sushi: { crowd: 0.25, fridge: true, bass: 0, machine: 0 },
  bakery: { crowd: 0.2, fridge: true, bass: 0, machine: 0 },
  cafe: { crowd: 0.35, fridge: true, bass: 0, machine: 0 },
  fishchips: { crowd: 0.25, fridge: true, bass: 0, machine: 0 },
  dairy: { crowd: 0.1, fridge: true, bass: 0, machine: 0 },
  recycling: { crowd: 0.05, fridge: false, bass: 0, machine: 1 },
  gym: { crowd: 0.3, fridge: false, bass: 0.35, machine: 0 },
  hospital: { crowd: 0.15, fridge: false, bass: 0, machine: 0 },
  garage: { crowd: 0.05, fridge: false, bass: 0, machine: 0.35 },
};
const QUIET_ROOM: Room = { crowd: 0.1, fridge: false, bass: 0, machine: 0 };
export const roomFor = (k: BuildingKind): Room => ROOMS[k] ?? QUIET_ROOM;

export const isOpenNow = (open: [number, number], hour: number): boolean => (open[0] <= open[1] ? hour >= open[0] && hour < open[1] : hour >= open[0] || hour < open[1]);

// ------------------------------------------------------------------ Web Audio

interface Out { node: AudioNode; t: number }
interface Bed { gain: GainNode; pan: StereoPannerNode | null; filter: BiquadFilterNode }
interface EngineVoice { veh: number; a: OscillatorNode; b: OscillatorNode; filt: BiquadFilterNode; amp: GainNode; road: GainNode; pan: StereoPannerNode | null; lfoDepth: GainNode; lfo: OscillatorNode }
interface SirenVoice { veh: number; osc: OscillatorNode; amp: GainNode; pan: StereoPannerNode | null }
interface Emitter { x: number; y: number; b: number }

export class Diegetic {
  /** every effect connects here (own volume and mute) */
  readonly input: GainNode;
  private muffle: BiquadFilterNode;
  private white: AudioBuffer;
  private brown: AudioBuffer;
  private liveBy: Record<Prio, number> = { critical: 0, event: 0, foley: 0 };
  private lastAt: Record<Prio, number> = { critical: -9, event: -9, foley: -9 };
  private caps: MixCaps;
  private cur: Prio = "event";
  private npcStepAt = 0;
  /** the soundtrack ducks for the street, never the other way round (set by AudioSystem) */
  onDuck?: (amount: number, secs: number) => void;
  /** ambience bus: beds, crickets, hum. Ducks when something important happens. */
  private amb: GainNode;
  private sim: Simulation | null = null;
  private on = true; private vol = 0.8;

  // beds
  private rain!: Bed; private roof!: Bed; private wind!: Bed; private traffic!: Bed; private crowd!: Bed; private water!: Bed; private machine!: Bed; private sizzle!: Bed; private train!: Bed; private trainTick!: Bed; private trainLfo!: OscillatorNode;
  private fridge!: GainNode; private cricket!: GainNode; private cricketLfo!: OscillatorNode; private room!: GainNode;
  private thump!: GainNode; private thumpPan!: StereoPannerNode | null; private thumpFilter!: BiquadFilterNode;
  private engines: EngineVoice[] = []; private sirens: SirenVoice[] = [];

  // world emitters
  private stations: Emitter[] = []; private machines: Emitter[] = []; private clubs: Emitter[] = []; private fountains: Emitter[] = []; private trucks: Emitter[] = [];

  // per-scan state
  private lastScan = 0; private lastTick = -1; private lastSlow = 0;
  private greenery = 0.3; private carWeight = 0; private people = 0;
  private foot = new Map<number, { x: number; y: number; acc: number; side: number }>();
  private veh = new Map<number, { x: number; y: number; speed: number; driver: number; pop: number }>();
  private inside = new Map<number, number>();
  private nextDrip = 0; private trainSwellPrev = 0; private nextBird = 0; private nextClank = 0; private nextBeat = 0; private beatN = 0; private nextHiss = 0;
  private lightning = -1; private interiorStep = 0; private leak = 0;
  private prevInterior: BuildingKind | null | undefined;
  private stop: (() => void)[] = [];
  private voicePrefs: VoicePrefs = DEFAULT_VOICE; private voiceRecent: number[] = [];
  private footPrefs: FootPrefs = DEFAULT_FOOT; private sneaking = false; private positional = true; private width = 1;
  private ambPrefs: AmbiencePrefs = DEFAULT_AMBIENCE;

  constructor(private ctx: AudioContext, master: AudioNode, private lite: boolean) {
    this.caps = mixCaps(lite);
    this.input = ctx.createGain(); this.input.gain.value = this.vol * BUS_LEVEL;
    this.amb = ctx.createGain(); this.amb.gain.value = AMBIENT_LEVEL; this.amb.connect(this.input);
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = "lowpass"; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.input.connect(this.muffle); this.muffle.connect(comp); comp.connect(master);
    this.white = this.makeNoise(false); this.brown = this.makeNoise(true);
    this.buildBeds();
    this.buildVoices();
  }

  // ---- control
  setLevel(on: boolean, vol: number): void {
    this.on = on; this.vol = vol;
    this.input.gain.setTargetAtTime(on ? vol * BUS_LEVEL : 0, this.ctx.currentTime, 0.05);
  }

  attach(sim: Simulation): void {
    this.sim = sim; this.foot.clear(); this.veh.clear(); this.inside.clear(); this.lastTick = -1; this.lightning = sim.env.lightningAt;
    const w = sim.world, door = (b: (typeof w.buildings)[number]): Emitter => ({ x: b.door.x + 0.5, y: b.door.y + 0.5, b: b.id });
    this.stations = w.buildings.filter((b) => b.kind === "airport").map(door);
    this.machines = w.buildings.filter((b) => b.kind === "recycling").map(door);
    this.clubs = w.buildings.filter((b) => b.kind === "nightclub" || b.kind === "stripclub" || b.kind === "velvet").map(door);
    this.fountains = w.pois.filter((p) => p.kind === "fountain").map((p) => ({ x: p.x, y: p.y, b: p.id }));
    this.trucks = w.pois.filter((p) => p.kind === "foodtruck").map((p) => ({ x: p.x, y: p.y, b: p.id }));
  }

  dispose(): void { for (const f of this.stop) f(); this.stop = []; }

  // ---- noise and beds
  private makeNoise(brown: boolean): AudioBuffer {
    const n = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w;
    }
    // crossfade the loop seam so it never clicks
    const f = Math.floor(this.ctx.sampleRate * 0.02);
    for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
    return buf;
  }

  private loop(buf: AudioBuffer): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 1.5); this.stop.push(() => { try { s.stop(); } catch { /* already stopped */ } });
    return s;
  }

  private bed(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, positional = false): Bed {
    const ctx = this.ctx, filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    this.loop(buf).connect(filter); filter.connect(gain);
    const pan = positional && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { gain.connect(pan); pan.connect(this.amb); } else gain.connect(this.amb);
    return { gain, pan, filter };
  }

  private lfo(rate: number, depth: number, target: AudioParam, shape: OscillatorType = "sine"): OscillatorNode {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = shape; o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(target); o.start(); this.stop.push(() => { try { o.stop(); } catch { /* already stopped */ } });
    return o;
  }

  private buildBeds(): void {
    const ctx = this.ctx;
    this.rain = this.bed(this.white, "highpass", 1100, 0.5);              // patter on pavement
    this.roof = this.bed(this.brown, "lowpass", 520, 0.4);                // the body of heavy rain
    this.wind = this.bed(this.brown, "bandpass", 380, 0.6);
    this.lfo(0.13, 160, this.wind.filter.frequency); this.lfo(0.21, 0.04, this.wind.gain.gain);
    this.traffic = this.bed(this.brown, "lowpass", 240, 0.5);
    this.crowd = this.bed(this.white, "bandpass", 650, 1.4);              // speech-shaped hiss, breathing slowly
    this.lfo(0.7, 0.03, this.crowd.gain.gain); this.lfo(0.31, 90, this.crowd.filter.frequency);
    this.water = this.bed(this.white, "bandpass", 3600, 0.8, true);       // fountains
    this.lfo(7, 0.06, this.water.gain.gain);
    this.machine = this.bed(this.brown, "lowpass", 380, 0.7, true);       // the depot's conveyor
    this.lfo(1.9, 0.12, this.machine.gain.gain, "square");
    this.sizzle = this.bed(this.white, "highpass", 6200, 0.5, true);      // food-truck fry
    this.lfo(11, 0.04, this.sizzle.gain.gain);
    this.train = this.bed(this.brown, "lowpass", 120, 0.8);               // distant train: rolling rumble
    this.lfo(2.3, 0.04, this.train.gain.gain);
    this.trainTick = this.bed(this.white, "bandpass", 1500, 1.2);         // wheel clack over the rail joints
    const gate = this.ctx.createGain(); gate.gain.value = 0.5;             // square-wave gate: clack, clack
    this.trainTick.filter.disconnect(); this.trainTick.filter.connect(gate); gate.connect(this.trainTick.gain);
    this.trainLfo = this.lfo(4, 0.5, gate.gain, "square");

    // fridge hum: mains hum and its octave with a little buzz
    this.fridge = ctx.createGain(); this.fridge.gain.value = 0; this.fridge.connect(this.amb);
    for (const [f, g] of [[50, 0.5], [100, 0.28], [150, 0.1]] as const) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = f === 50 ? "triangle" : "sine"; o.frequency.value = f; og.gain.value = g; o.connect(og); og.connect(this.fridge); o.start(); this.stop.push(() => { try { o.stop(); } catch { /* ok */ } });
    }
    // crickets: two high sines gated into chirp trains
    this.cricket = ctx.createGain(); this.cricket.gain.value = 0; this.cricket.connect(this.amb);
    const crick = (f: number, rate: number) => {
      const o = ctx.createOscillator(), am = ctx.createGain(); o.type = "sine"; o.frequency.value = f; am.gain.value = 0; o.connect(am); am.connect(this.cricket); o.start();
      this.lfo(rate, 0.5, am.gain, "square"); this.lfo(28, 0.25, am.gain); this.stop.push(() => { try { o.stop(); } catch { /* ok */ } });
      return o;
    };
    this.cricketLfo = crick(4300, 5.3); crick(5100, 4.1);
    // room tone for interiors (chatter lives on the crowd bed, this is just air)
    this.room = ctx.createGain(); this.room.gain.value = 0; this.room.connect(this.amb);
    const rt = ctx.createBiquadFilter(); rt.type = "lowpass"; rt.frequency.value = 300; this.loop(this.brown).connect(rt); rt.connect(this.room);
    // bass leaking through walls: kicks are scheduled into this
    this.thumpFilter = ctx.createBiquadFilter(); this.thumpFilter.type = "lowpass"; this.thumpFilter.frequency.value = 170;
    this.thump = ctx.createGain(); this.thump.gain.value = 0;
    this.thumpPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.thumpFilter.connect(this.thump);
    if (this.thumpPan) { this.thump.connect(this.thumpPan); this.thumpPan.connect(this.amb); } else this.thump.connect(this.amb);
  }

  private buildVoices(): void {
    const ctx = this.ctx;
    for (let i = 0; i < (this.lite ? 1 : 2); i++) {
      const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = "sawtooth"; b.type = "square";
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.Q.value = 1.2;
      const wob = ctx.createGain(); wob.gain.value = 1;
      const amp = ctx.createGain(); amp.gain.value = 0;
      const bg = ctx.createGain(); bg.gain.value = 0.5;
      a.connect(filt); b.connect(bg); bg.connect(filt); filt.connect(wob); wob.connect(amp);
      const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain(); lfo.frequency.value = 9; lfoDepth.gain.value = 0; lfo.connect(lfoDepth); lfoDepth.connect(wob.gain);
      const road = ctx.createGain(); road.gain.value = 0;
      const rf = ctx.createBiquadFilter(); rf.type = "bandpass"; rf.frequency.value = 900; rf.Q.value = 0.6;
      this.loop(this.white).connect(rf); rf.connect(road);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const sum = ctx.createGain();
      amp.connect(sum); road.connect(sum);
      if (pan) { sum.connect(pan); pan.connect(this.input); } else sum.connect(this.input);
      a.start(); b.start(); lfo.start();
      this.stop.push(() => { for (const n of [a, b, lfo]) try { n.stop(); } catch { /* ok */ } });
      this.engines.push({ veh: -1, a, b, filt, amp, road, pan, lfoDepth, lfo });
    }
    for (let i = 0; i < 1; i++) {
      const osc = ctx.createOscillator(); osc.type = "sawtooth";
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 0.7;
      const amp = ctx.createGain(); amp.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.connect(bp); bp.connect(amp);
      if (pan) { amp.connect(pan); pan.connect(this.input); } else amp.connect(this.input);
      osc.start(); this.stop.push(() => { try { osc.stop(); } catch { /* ok */ } });
      this.sirens.push({ veh: -1, osc, amp, pan });
    }
  }

  // ---- one-shot plumbing
  /** Ask the mix for a voice. Returns false when the street is too busy for this priority (the caller just skips the sound). */
  private begin(prio: Prio = "event"): boolean {
    const now = this.ctx.currentTime;
    if (now - this.lastAt[prio] < MIX_GAP[prio] || !admit(prio, this.liveBy, this.caps)) return false;
    this.lastAt[prio] = now; this.liveBy[prio]++; this.cur = prio;
    if (prio === "critical") this.duck();
    return true;
  }
  private end(...src: AudioScheduledSourceNode[]): void {
    const p = this.cur; let left = src.length;
    if (!left) { this.liveBy[p]--; return; }
    for (const s of src) s.onended = () => { if (--left === 0) this.liveBy[p]--; };
  }
  /** Dip the ambience for a moment so the important sound reads clearly. */
  private duck(): void {
    this.onDuck?.(DUCK.music, DUCK.secs + 0.15);
    const t = this.ctx.currentTime, g = this.amb.gain;
    const level = AMBIENT_LEVEL * ambienceGain(this.ambPrefs);
    g.cancelScheduledValues(t); g.setTargetAtTime(level * (1 - DUCK.amount), t, 0.03); g.setTargetAtTime(level, t + DUCK.secs, 0.4);
  }
  /** Ambience mute and fade time (the fade is a smooth ramp, so a change never clicks). */
  setAmbience(p: AmbiencePrefs): void {
    this.ambPrefs = p;
    const t = this.ctx.currentTime, g = this.amb.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(AMBIENT_LEVEL * ambienceGain(p), t, Math.max(0.01, p.fadeSecs) / 3);
  }
  /** Speech blip settings: who is muted, pitch, volume, speed, and the blip frequency limit. */
  setVoice(p: VoicePrefs): void { this.voicePrefs = p; }
  /** Footstep settings: volume, shoe sound, and whether sneaking quiets the steps. */
  setFoot(p: FootPrefs): void { this.footPrefs = p; }
  /** Whether the player is sneaking right now; the game calls this when it knows. */
  setSneaking(on: boolean): void { this.sneaking = on; }
  /** A UI tone (button, tab, error, save, level-up and so on): not spatial, so it always plays centred. */
  uiTone(tone: UiTone): void {
    if (!this.on) return;
    const spec = UI_TONES[tone], o = this.flat(uiGain(tone, this.vol));
    if (!this.begin("event")) return;
    this.end(this.blip(o, spec.shape, spec.freq, spec.freqEnd, spec.dur, 1));
  }
  /** Quiet mode: mutes ambience and speech blips, keeping footsteps and one-shot effects. */
  setQuiet(on: boolean): void {
    this.setAmbience({ ...this.ambPrefs, muted: on });
    this.voicePrefs = { ...this.voicePrefs, enabled: !on };
  }
  /** 3D audio: when off, every effect plays centred (no left/right panning from where it is). */
  setPositional(on: boolean): void { this.positional = on; }
  /** Stereo width: scales how far effects pan left and right (0 = centred, 1 = normal). */
  setWidth(w: number): void { this.width = Number.isFinite(w) ? Math.min(1, Math.max(0, w)) : 1; }
  /** Audio debug read-out: live one-shot voices by priority, the ambience gain now, and recent blips in the last second. */
  debugStats(): { live: Record<Prio, number>; bus: number; ambient: number; recentBlips: number; unheard: string[] } {
    return { live: { ...this.liveBy }, bus: this.input.gain.value, ambient: this.amb.gain.value, recentBlips: this.voiceRecent.length, unheard: [...this.unheard].sort() };
  }
  /** For the older effects in Audio.ts (impacts, gunfire): the same cap and spacing, with the slot freed after a short while. */
  allow(prio: Prio = "event"): boolean {
    if (!this.on || !this.begin(prio)) return false;
    const p = this.cur; setTimeout(() => { this.liveBy[p]--; }, 180);
    return true;
  }

  private route(x: number, y: number, vol: number, cam: Camera, in2D: boolean): Out | null {
    const sp = spatialize(x - cam.x, y - cam.y, cam.zoom, in2D);
    const g = sp.gain * vol;
    if (g < 0.01) return null;
    const ctx = this.ctx, gain = ctx.createGain(); gain.gain.value = g;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = this.positional ? clamp01Pan(sp.pan * this.width) : 0; gain.connect(pan); pan.connect(this.input); } else gain.connect(this.input);
    return { node: gain, t: ctx.currentTime };
  }
  /** A short speech blip for someone talking: pitch set by who they are, so each person sounds a little different. */
  voice(id: number, indoors: boolean): void {
    if (indoors || !voiceAllowed(this.voicePrefs, id, this.ctx.currentTime, this.voiceRecent)) return;
    const o = this.flat(0.2);
    if (!this.begin("event")) return;
    const wobble = this.voicePrefs.randomTone ? 1 + (Math.random() - 0.5) * 0.1 : 1;
    const f = voicePitch(id, this.voicePrefs) * wobble, d = voiceDuration(this.voicePrefs);
    const tone = voiceTone(this.voicePrefs);
    this.blip(o, tone.shape, f, f * 1.25, d, tone.gain);
    this.end();
  }

  private flat(vol: number): Out { const g = this.ctx.createGain(); g.gain.value = vol; g.connect(this.input); return { node: g, t: this.ctx.currentTime }; }

  private blip(o: Out, type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.5, at = 0): OscillatorNode {
    const ctx = this.ctx, osc = ctx.createOscillator(), env = ctx.createGain(), t = o.t + at;
    osc.type = type; osc.frequency.setValueAtTime(f0, t); if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vol, t + 0.004); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env); env.connect(o.node); osc.start(t); osc.stop(t + dur + 0.02);
    return osc;
  }

  private hit(o: Out, type: BiquadFilterType, freq: number, q: number, dur: number, vol = 0.5, at = 0, buf = this.white): AudioBufferSourceNode {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), env = ctx.createGain(), t = o.t + at;
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vol, t + 0.003); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(env); env.connect(o.node); src.start(t, Math.random() * 1.5, dur + 0.05);
    return src;
  }

  // ---- sound events (from the sim's sound bus)
  onSound(kind: string, x: number, y: number, vol: number, cam: Camera, scene: Scene): void {
    if (!this.on || !this.sim) return;
    if (scene.interior && !(kind === "till")) vol *= 0.35;
    this.soundLog.push({ kind, t: this.ctx.currentTime, vol });
    if (this.soundLog.length > 50) this.soundLog.shift();
    const o0 = () => this.route(x, y, vol, cam, scene.in2D);
    switch (kind) {
      case "horn": return this.horn(o0(), this.nearestClass(x, y));
      case "crash": return this.crash(o0(), 1);
      case "carhit": return this.crash(o0(), 0.45);
      case "till": return this.till(o0());
      case "clink": return this.clink(o0(), false);
      case "bin": return this.binRummage(o0());
      case "recycle": return this.recycleChunk(o0());
      case "taser": return this.zap(o0());
      case "squirt": case "paintball": return this.squirt(o0());
      case "creak": case "shatter": case "crackle": case "spark":
      case "whoosh": case "chime": case "loot": case "crunch":
        return this.tone(o0(), kind);
      default: this.unheard.add(kind);
    }
  }
  /** Sound kinds the sim sent that no effect plays for yet (a missing-sound report for the debug console). */
  private unheard = new Set<string>();
  /** The last fifty sound events from the sim, newest last: a sound log for the debug console. */
  private soundLog: { kind: string; t: number; vol: number }[] = [];
  soundHistory(): { kind: string; t: number; vol: number }[] { return this.soundLog.slice(); }

  /** Entity and combat one-shots: hinges, glass, fire, sparks, dodges, parries, loot and breakages. */
  private tone(o: Out | null, kind: string): void {
    if (!o || !this.begin()) return;
    const parts: AudioScheduledSourceNode[] = [];
    if (kind === "creak") { parts.push(this.blip(o, "sawtooth", 180, 260, 0.35, 0.12), this.hit(o, "bandpass", 600, 4, 0.3, 0.15)); }
    else if (kind === "shatter") {
      for (let i = 0; i < 6; i++) parts.push(this.blip(o, "sine", 2000 + Math.random() * 2200, 1800, 0.5, 0.14, Math.random() * 0.03));
      parts.push(this.hit(o, "highpass", 5200, 0.7, 0.45, 0.3, 0.03));
    }
    else if (kind === "crackle") { for (let i = 0; i < 8; i++) parts.push(this.hit(o, "highpass", 3000 + Math.random() * 2000, 1, 0.02, 0.15, i * 0.05 + Math.random() * 0.03)); }
    else if (kind === "spark") { parts.push(this.hit(o, "bandpass", 4000, 2, 0.06, 0.3), this.blip(o, "square", 1800, 900, 0.04, 0.12)); }
    else if (kind === "whoosh") { parts.push(this.hit(o, "bandpass", 800, 0.7, 0.35, 0.3)); }
    else if (kind === "chime") { parts.push(this.blip(o, "sine", 1760, 1760, 0.25, 0.15), this.blip(o, "sine", 2637, 2637, 0.2, 0.1, 0.06)); }
    else if (kind === "loot") { [1318, 1568, 2093].forEach((f, i) => parts.push(this.blip(o, "sine", f, f, 0.12, 0.12, i * 0.07))); }
    else if (kind === "crunch") { parts.push(this.hit(o, "lowpass", 900, 1, 0.12, 0.5), this.blip(o, "triangle", 220, 90, 0.08, 0.35)); }
    this.end(...parts);
  }

  private nearestClass(x: number, y: number): VehicleClass {
    let best: VehicleClass = "sedan", bd = 1e9;
    for (const v of this.sim?.vehicles ?? []) { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v.cls; } }
    return best;
  }

  private horn(o: Out | null, cls: VehicleClass): void {
    if (!o || !this.begin("critical")) return;
    const big = cls === "van" || cls === "ute" || cls === "ambulance" || cls === "suv", fast = cls === "jdm" || cls === "sports" || cls === "super";
    const f = big ? 330 : fast ? 480 : 400, dur = cls === "taxi" ? 0.2 : 0.34;
    const a = this.blip(o, "sawtooth", f, f, dur, 0.28), b = this.blip(o, "sawtooth", f * 1.26, f * 1.26, dur, 0.24);
    this.end(a, b);
  }

  private crash(o: Out | null, power: number): void {
    if (!o || !this.begin(power > 0.6 ? "critical" : "event")) return;
    const n = this.hit(o, "lowpass", 900, 0.6, 0.35, 0.9 * power);
    this.blip(o, "triangle", 110, 38, 0.3, 0.8 * power);
    if (power > 0.6) { for (const f of [210, 342, 588, 1130]) this.blip(o, "sine", f * (0.96 + Math.random() * 0.08), f * 0.97, 0.5, 0.18, 0.01); this.hit(o, "highpass", 5200, 0.7, 0.45, 0.3, 0.03); } // glass and bent metal
    this.end(n);
  }

  private till(o: Out | null): void {
    if (!o || !this.begin()) return;
    const a = this.blip(o, "sine", 2093, 2093, 0.35, 0.22), b = this.blip(o, "sine", 3136, 3136, 0.5, 0.18, 0.07);
    this.blip(o, "triangle", 140, 70, 0.09, 0.4, 0.16); this.hit(o, "bandpass", 1800, 1, 0.04, 0.3, 0.15);
    this.end(a, b);
  }

  private clink(o: Out | null, bottle: boolean): void {
    if (!o || !this.begin()) return;
    const r = 0.9 + Math.random() * 0.25, fs = bottle ? [1760, 2640, 4100] : [2900, 4150, 5400];
    const s = fs.map((f, i) => this.blip(o, "sine", f * r, f * r * 0.995, bottle ? 0.5 : 0.22 - i * 0.04, 0.2 - i * 0.04, i * 0.012));
    this.hit(o, "highpass", 4000, 0.7, 0.02, 0.25);
    this.end(s[s.length - 1]);
  }

  private binRummage(o: Out | null): void {
    if (!o || !this.begin()) return;
    this.hit(o, "bandpass", 450, 0.8, 0.12, 0.5); this.blip(o, "triangle", 160, 90, 0.1, 0.4, 0.05); // lid
    for (let i = 0; i < 3; i++) this.hit(o, "bandpass", 2600 + Math.random() * 2200, 3, 0.04, 0.3, 0.12 + i * 0.07 + Math.random() * 0.05); // rattle
    this.clink(null, false);
    this.end(this.hit(o, "highpass", 3000, 1, 0.1, 0.18, 0.35));
  }

  private recycleChunk(o: Out | null): void {
    if (!o || !this.begin()) return;
    this.blip(o, "triangle", 90, 40, 0.3, 0.7); this.hit(o, "lowpass", 300, 0.7, 0.4, 0.5, 0, this.brown); this.hit(o, "highpass", 5000, 0.6, 0.12, 0.3, 0.1);
    for (let i = 0; i < 5; i++) this.blip(o, "sine", 2400 + Math.random() * 2000, 2300, 0.18, 0.12, 0.35 + i * 0.07 + Math.random() * 0.03); // coins
    this.end(this.blip(o, "sine", 1800, 1700, 0.3, 0.01, 0.9));
  }

  private zap(o: Out | null): void {
    if (!o || !this.begin()) return;
    const n = this.hit(o, "bandpass", 3000, 2, 0.5, 0.4);
    for (let i = 0; i < 12; i++) this.blip(o, "square", 90 + Math.random() * 60, 90, 0.02, 0.12, i * 0.04);
    this.end(n);
  }

  private squirt(o: Out | null): void {
    if (!o || !this.begin()) return;
    this.end(this.hit(o, "bandpass", 2400, 1.5, 0.22, 0.4));
  }

  /** A footstep on a surface. wet: rain on hard ground adds a splashy edge. */
  private step(o: Out | null, surface: Surface, wet: number, jitter: number, soft = false, rain = wet / 1.6): void {
    const vol = footGain(this.footPrefs, this.sneaking);
    if (!o || vol <= 0 || !this.begin("foley")) return;
    o.t += Math.max(0, this.footPrefs.delay);
    const r = FOOT[surface], [f, q, d, v, type] = r.noise, k = (1 + jitter) * shoePitch(this.footPrefs.shoe);
    // everyone else's steps are a soft tap (low-passed, no squeak); only yours has the full detail
    const n = soft ? this.hit(o, "lowpass", Math.min(2400, f) * k, 0.5, d * 1.2, v * vol * 1.4) : this.hit(o, type, f * k * (1 + wet * 0.3), q, d * (1 + wet * 0.8), v * vol * (1 + wet * 0.35));
    if (r.thud) this.blip(o, r.thud[4], r.thud[0] * k, r.thud[1] * k, r.thud[2], r.thud[3] * vol);
    if (!soft && r.squeak && Math.random() < r.squeak) this.blip(o, "sine", 1100 + Math.random() * 300, 1700, 0.07, 0.05, 0.01);
    const parts: AudioScheduledSourceNode[] = [n];
    if (!soft && Math.random() < puddleChance(surface, rain) * 0.5) parts.push(this.splash(o)); // splashes are yours, and rare
    this.end(...parts);
  }

  /** A foot (or tyre) through a puddle: a wet slap and a little "bloop". */
  private splash(o: Out): AudioScheduledSourceNode {
    const n = this.hit(o, "bandpass", 1800 + Math.random() * 900, 0.9, 0.16, 0.5);
    this.hit(o, "highpass", 4500, 0.7, 0.07, 0.18, 0.02);
    this.blip(o, "sine", 260 + Math.random() * 120, 520, 0.09, 0.16, 0.03);
    return n;
  }

  /** Drips off awnings and gutters, each with a few echoes; only outdoors and only in rain. */
  private drips(cam: Camera, scene: Scene, rain: number, now: number): void {
    const rate = dripRate(rain);
    if (scene.interior || rate <= 0 || now < this.nextDrip) return;
    this.nextDrip = now + (0.9 + Math.random() * 1.2) / rate;
    const a = Math.random() * 6.283, r = 2 + Math.random() * 9;
    const o = this.route(cam.x + Math.cos(a) * r, cam.y + Math.sin(a) * r, 0.2, cam, scene.in2D);
    if (!o || !this.begin("foley")) return;
    const size = Math.random(), f = 1500 + Math.random() * 900, parts: AudioScheduledSourceNode[] = [this.blip(o, "sine", f, f * 0.5, 0.07, 0.4)];
    for (const e of dripEchoes(size)) parts.push(this.blip(o, "sine", f * (0.9 - e.at * 0.2), f * 0.45, 0.08, 0.4 * e.vol, e.at));
    this.end(...parts);
  }

  /** A far-off train: low rumble and wheel clack that swell as it passes, louder near the station. */
  private trains(cam: Camera, scene: Scene, now: number): void {
    const swell = trainSwell(now), t = now;
    let d = 99;
    for (const s of this.stations) d = Math.min(d, Math.hypot(s.x - cam.x, s.y - cam.y));
    const k = swell * trainReach(d) * (scene.interior ? 0.3 : 1);
    this.train.gain.gain.setTargetAtTime(k * 0.14, t, 0.5);
    this.train.filter.frequency.setTargetAtTime(110 + swell * 90, t, 0.5);
    this.trainTick.gain.gain.setTargetAtTime(k * 0.03, t, 0.3);
    this.trainLfo.frequency.setTargetAtTime(trainClack(swell), t, 0.5);
    // a long horn as it arrives at the station, if you are near enough to hear it
    const arriving = swell > 0.2 && this.trainSwellPrev <= 0.2;
    this.trainSwellPrev = swell;
    if (arriving && d < 55 && !scene.interior) {
      const o = this.flat(0.1 * trainReach(d));
      if (this.begin()) this.end(this.blip(o, "sawtooth", 233, 233, 1.1, 0.5), this.blip(o, "sawtooth", 311, 311, 1.1, 0.4));
    }
  }

  // ---- doors
  private door(o: Out | null, kind: DoorKind, opening: boolean, shop?: BuildingKind): void {
    if (!o || !this.begin()) return;
    const parts: AudioScheduledSourceNode[] = [];
    const jg = kind === "bell" && shop ? jingleFor(shop) : null;
    if (jg) {
      jingleFreqs(jg).forEach((f, i) => {
        parts.push(this.blip(o, jg.wave, f, f, jg.step * 1.2, jg.wave === "sine" ? 0.14 : 0.08, i * jg.step)); // short and quiet
        if (jg.wave !== "sine") this.blip(o, "sine", f * 2, f * 2, jg.step, 0.03, i * jg.step);
      });
      this.hit(o, "bandpass", 900, 1, 0.05, 0.15);
    }
    else if (kind === "bell") { parts.push(this.blip(o, "sine", 2637, 2637, 0.6, 0.2), this.blip(o, "sine", 3520, 3500, 0.5, 0.14, 0.09)); this.hit(o, "bandpass", 900, 1, 0.05, 0.25); }
    else if (kind === "heavy") { parts.push(this.hit(o, "lowpass", 500, 0.8, 0.25, 0.6, 0, this.brown)); this.blip(o, "triangle", 100, 45, 0.2, 0.6); if (!opening) this.blip(o, "square", 700, 500, 0.03, 0.2, 0.2); }
    else { parts.push(this.hit(o, "bandpass", 700, 1, 0.08, 0.5), this.blip(o, "triangle", 190, 110, 0.07, 0.4), this.blip(o, "square", 1500, 900, 0.02, 0.15, opening ? 0.07 : 0.0)); }
    this.end(...parts);
  }

  private carDoor(o: Out | null): void {
    if (!o || !this.begin()) return;
    const n = this.hit(o, "lowpass", 650, 0.9, 0.1, 0.65); this.blip(o, "sine", 95, 55, 0.09, 0.6); this.hit(o, "bandpass", 2400, 3, 0.02, 0.2, 0.01);
    this.end(n);
  }

  /** Terrance's voice. `at` is a world position; omit for the dialogue panel (centred). */
  speak(text: string, cam: Camera, scene: Scene, at?: { x: number; y: number }): void {
    if (!this.on) return;
    const o = at ? this.route(at.x, at.y, 0.85, cam, scene.in2D) : this.flat(0.5);
    if (!o || !this.begin()) return;
    let t = 0, last: AudioScheduledSourceNode | null = null;
    for (const b of voiceBlips(text)) {
      last = this.blip(o, "square", b.f, b.f * 0.93, b.dur, 0.2 * b.vol, t);
      t += b.dur + b.gap;
    }
    if (last) this.end(last); else this.liveBy[this.cur]--;
  }

  /** Doors, bell and a pop of bass when the player walks into or out of a building (interior overlay opened/closed). */
  private sceneChange(from: BuildingKind | null, to: BuildingKind | null): void {
    const k = to ?? from;
    if (!k) return;
    this.door(this.flat(0.5), doorKind(k), to !== null, k);
    if (to && roomFor(to).bass > 0) this.leak = 1;
  }

  // ---- per-frame
  update(sim: Simulation, cam: Camera, scene: Scene): void {
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this.on || ctx.state !== "running") return;
    if (this.sim !== sim) this.attach(sim);
    if (this.prevInterior !== undefined && this.prevInterior !== scene.interior) this.sceneChange(this.prevInterior, scene.interior);
    this.prevInterior = scene.interior;
    const dtScan = this.lite ? 0.09 : 0.05;
    if (now - this.lastScan < dtScan) return;
    const dt = Math.max(0.016, now - this.lastScan); this.lastScan = now;
    const frozen = sim.tick === this.lastTick; this.lastTick = sim.tick;
    const inside = scene.interior !== null, env = sim.env, hour = sim.hour, t = now;
    const rain = env.rain, wet = clamp01(rain * 1.6);

    // the outside world, muffled when you're indoors
    const out = inside ? 0.3 : 1;
    this.muffle.frequency.setTargetAtTime(inside ? 620 : 20000, t, 0.12);
    const slow = now - this.lastSlow > 1;
    if (slow) { this.lastSlow = now; this.greenery = this.sampleGreen(cam.x, cam.y); this.sceneBeds(sim, cam); }
    const wl = windLevel(env.weather, rain);
    this.rain.gain.gain.setTargetAtTime(rain * 0.05 * (inside ? 0.8 : 1), t, 0.4);
    this.roof.gain.gain.setTargetAtTime(rain * rain * 0.11 * (inside ? 1.2 : 1), t, 0.4);
    this.rain.filter.frequency.setTargetAtTime(900 + (1 - rain) * 500, t, 0.5);
    this.wind.gain.gain.setTargetAtTime(wl * 0.06 * out, t, 0.8);
    this.cricket.gain.setTargetAtTime(cricketLevel(hour, rain, this.greenery, env.storm) * 0.009 * out, t, 1.2);
    this.cricketLfo.frequency.setTargetAtTime(4300 + (sim.hour % 1) * 150, t, 3);

    if (!frozen) {
      this.scanVehicles(sim, cam, scene, dt, wet);
      this.scanPeople(sim, cam, scene, wet);
    } else this.silenceVoices(t);
    if (scene.interior) this.interiorLife(sim, scene, dt);

    // distant traffic and crowd murmur follow the camera
    const b = busyness(this.carWeight, this.people, hour);
    this.traffic.gain.gain.setTargetAtTime(b.traffic * 0.12 * out * (1 + wet * 0.5), t, 0.6);
    this.traffic.filter.frequency.setTargetAtTime(190 + b.traffic * 120 + wet * 90, t, 0.6);
    const room = scene.interior ? roomFor(scene.interior) : null;
    this.crowd.gain.gain.setTargetAtTime(room ? room.crowd * 0.06 : b.crowd * 0.028 * out, t, 0.6);

    this.thunder(sim, scene);
    this.birds(cam, scene, hour, rain, now);
    this.drips(cam, scene, rain, now);
    this.trains(cam, scene, now);
    this.emitters(sim, cam, scene, now);
  }

  private silenceVoices(t: number): void {
    for (const e of this.engines) { e.amp.gain.setTargetAtTime(0, t, 0.05); e.road.gain.setTargetAtTime(0, t, 0.05); }
    for (const s of this.sirens) s.amp.gain.setTargetAtTime(0, t, 0.05);
  }

  /** Share of grass, trees and hedges around the camera (0..1), for birds and crickets. */
  private sampleGreen(cx: number, cy: number): number {
    const w = this.sim!.world; let g = 0, n = 0;
    for (let y = -10; y <= 10; y += 2) for (let x = -10; x <= 10; x += 2) {
      const tl = w.tile(Math.floor(cx + x), Math.floor(cy + y)); n++;
      if (tl === T.GRASS || tl === T.TREE || tl === T.HEDGE) g++;
    }
    return clamp01(g / n * 1.6);
  }

  private sceneBeds(sim: Simulation, cam: Camera): void {
    // people near the camera, for the crowd bed
    let n = 0;
    for (const c of sim.chars) if (c.inside < 0 && c.inCar < 0 && Math.abs(c.x - cam.x) < 16 && Math.abs(c.y - cam.y) < 16) n++;
    this.people = n;
  }

  /** Engines, sirens, car doors, pops. */
  private scanVehicles(sim: Simulation, cam: Camera, scene: Scene, dt: number, wet: number): void {
    const t = this.ctx.currentTime, cands: { id: number; g: number; sp: ReturnType<typeof spatialize>; spd: number; rad: number; x: number; y: number }[] = [];
    const sirenC: typeof cands = [];
    let cw = 0;
    const myCar = sim.player.inCar;
    for (const v of sim.vehicles) {
      if (v.owner === -2 && v.driver < 0) { continue; } // dealership stock
      const dx = v.x - cam.x, dy = v.y - cam.y, d = Math.hypot(dx, dy);
      let prev = this.veh.get(v.id);
      if (!prev) { prev = { x: v.x, y: v.y, speed: 0, driver: v.driver, pop: 0 }; this.veh.set(v.id, prev); }
      const mx = v.x - prev.x, my = v.y - prev.y, spd = Math.hypot(mx, my) / dt;
      // radial velocity of the car relative to the camera (positive = moving away)
      const rad = d > 0.1 ? (mx * dx + my * dy) / d / dt : 0;
      const smooth = prev.speed + (spd - prev.speed) * 0.5;
      // doors: someone got in or out
      if (d < 30 && ((prev.driver < 0) !== (v.driver < 0)) && this.sim) {
        const o = this.route(v.x, v.y, 0.7, cam, scene.in2D); this.carDoor(o);
        if (prev.driver < 0 && v.driver >= 0 && d < 16) { const o2 = this.route(v.x, v.y, 0.5, cam, scene.in2D); if (o2 && this.begin()) { this.end(this.blip(o2, "sawtooth", 50, 130, 0.5, 0.25, 0.15)); } } // ignition
      }
      prev.driver = v.driver; prev.x = v.x; prev.y = v.y; prev.speed = smooth;
      if (d < 36) cw += (1 / (1 + d / 8)) * (0.4 + Math.min(1, smooth / 6));
      const sp = spatialize(dx, dy, cam.zoom, scene.in2D);
      const running = v.driver >= 0 || smooth > 0.4;
      if (running && sp.gain > 0.015) cands.push({ id: v.id, g: sp.gain, sp, spd: smooth, rad, x: v.x, y: v.y });
      if (v.siren) { const sg = spatialize(dx * 0.6, dy * 0.6, cam.zoom, scene.in2D); if (sg.gain > 0.01) sirenC.push({ id: v.id, g: sg.gain, sp: sg, spd: smooth, rad, x: v.x, y: v.y }); }
      // pops and bangs from the loud ones
      if (ENGINE[v.cls].pops && smooth > 2 && sp.gain > 0.15 && Math.random() < dt * 0.12 && v.id !== myCar) {
        const o = this.route(v.x, v.y, 0.8, cam, scene.in2D);
        if (o && this.begin("foley")) { const n = this.hit(o, "bandpass", 1500, 1, 0.05, 0.4); this.blip(o, "triangle", 160, 60, 0.06, 0.3); this.end(n); }
      }
    }
    this.carWeight = cw;
    cands.sort((a, b) => b.g - a.g);
    const veh = new Map(sim.vehicles.map((v) => [v.id, v]));
    // keep voices on the cars they already have, give free voices to the nearest others
    const want = new Set(cands.slice(0, this.engines.length).map((c) => c.id));
    for (const e of this.engines) if (e.veh >= 0 && !want.has(e.veh)) { e.veh = -1; e.amp.gain.setTargetAtTime(0, t, 0.05); e.road.gain.setTargetAtTime(0, t, 0.05); }
    const owned = new Set(this.engines.filter((e) => e.veh >= 0).map((e) => e.veh));
    for (const c of cands.slice(0, this.engines.length)) {
      let e = this.engines.find((x) => x.veh === c.id);
      if (!e) { e = this.engines.find((x) => x.veh < 0); if (!e) continue; e.veh = c.id; owned.add(c.id); e.amp.gain.cancelScheduledValues(t); e.amp.gain.setValueAtTime(0, t); }
      const v = veh.get(c.id)!, p = ENGINE[v.cls], top = 12;
      const s = clamp01(c.spd / top);
      const mine = c.id === myCar;
      const M = carMutationOf(v.plate, v.cls);   // bigger cars sound lower and heavier (visual size only, see CarMutation.ts)
      const f = engineFreq(p, c.spd, top) * dopplerRate(c.rad) * M.pitch;
      e.a.frequency.setTargetAtTime(f, t, 0.06); e.b.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      e.filt.frequency.setTargetAtTime(p.cut * (0.55 + s * 0.9) * (mine ? 0.55 : 1), t, 0.1);
      e.lfo.frequency.setTargetAtTime(7 + s * 12, t, 0.1); e.lfoDepth.gain.setTargetAtTime(p.burble, t, 0.1);
      const idle = c.spd < 0.4;
      e.amp.gain.setTargetAtTime(c.sp.gain * (mine ? 0.2 : 0.14) * (idle ? 0.55 : 0.65 + s * 0.6) * M.rumble, t, 0.07);
      e.road.gain.setTargetAtTime(c.sp.gain * clamp01(c.spd / 7) ** 1.4 * (0.04 + wet * 0.07), t, 0.08);
      if (e.pan) e.pan.pan.setTargetAtTime(mine ? 0 : c.sp.pan, t, 0.05);
    }
    // sirens
    sirenC.sort((a, b) => b.g - a.g);
    const swant = new Set(sirenC.slice(0, this.sirens.length).map((c) => c.id));
    for (const s of this.sirens) if (s.veh >= 0 && !swant.has(s.veh)) { s.veh = -1; s.amp.gain.setTargetAtTime(0, t, 0.08); }
    for (const c of sirenC.slice(0, this.sirens.length)) {
      let s = this.sirens.find((x) => x.veh === c.id);
      if (!s) { s = this.sirens.find((x) => x.veh < 0); if (!s) continue; s.veh = c.id; }
      const v = veh.get(c.id)!, f = sirenFreq(sirenKindFor(v.cls), t) * dopplerRate(c.rad);
      s.osc.frequency.setTargetAtTime(f, t, v.cls === "ambulance" ? 0.012 : 0.03);
      s.amp.gain.setTargetAtTime(c.sp.gain * 0.07, t, 0.08);
      if (s.pan) s.pan.pan.setTargetAtTime(c.sp.pan, t, 0.05);
    }
  }

  /** Footsteps, doors and shop bells for everyone on screen. */
  private scanPeople(sim: Simulation, cam: Camera, scene: Scene, wet: number): void {
    const w = sim.world, pid = sim.playerId, now = this.ctx.currentTime;
    const near = new Set<number>(), due: StepCand[] = [], dueC = new Map<number, { x: number; y: number }>();
    for (const c of sim.chars) {
      const dx = c.x - cam.x, dy = c.y - cam.y;
      // doors: someone walked into or out of a building near the camera
      const was = this.inside.get(c.id);
      if (was !== undefined && was !== c.inside && c.id !== pid) {
        const b = w.buildings[c.inside >= 0 ? c.inside : was];
        if (b && Math.hypot(b.door.x + 0.5 - cam.x, b.door.y + 0.5 - cam.y) < 20) this.door(this.route(b.door.x + 0.5, b.door.y + 0.5, 0.4, cam, scene.in2D), doorKind(b.kind), c.inside >= 0, b.kind);
      }
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) this.inside.set(c.id, c.inside); else this.inside.delete(c.id);
      if (c.inside >= 0 || c.inCar >= 0 || scene.interior) { this.foot.delete(c.id); continue; }
      if (c.lod > 2 && c.id !== pid) continue;
      if (dx * dx + dy * dy > 12 * 12 && c.id !== pid) continue; // footsteps only matter close by
      near.add(c.id);
      let f = this.foot.get(c.id);
      if (!f) { f = { x: c.x, y: c.y, acc: 0, side: c.id & 1 }; this.foot.set(c.id, f); continue; }
      const mx = c.x - f.x, my = c.y - f.y, m = Math.hypot(mx, my); f.x = c.x; f.y = c.y;
      if (m > 3 || c.phys !== 0) continue;
      f.acc += m;
      const dt = this.lite ? 0.09 : 0.05, spd = m / dt;
      if (FOOTSTEPS_ON && f.acc >= strideFor(spd) && spd > 0.5) {
        f.acc = 0; f.side ^= 1;
        due.push({ id: c.id, dist: Math.hypot(dx, dy), player: c.id === pid });
        dueC.set(c.id, c);
      }
    }
    // the mix picks who is heard: you, then the nearest one or two, and never a stampede
    for (const pick of pickSteps(due, scene.in2D, this.lite)) {
      const c = dueC.get(pick.id)!, mine = pick.id === pid;
      if (!mine && now - this.npcStepAt < 0.28) continue;
      const o = this.route(c.x, c.y, pick.gain * (mine ? 1 : 3.5), cam, scene.in2D);
      if (!o) continue;
      if (!mine) { this.npcStepAt = now; o.t += Math.random() * 0.08; }
      const surface = surfaceOf(w.tile(Math.floor(c.x), Math.floor(c.y)));
      this.step(o, surface, surface === "pave" || surface === "road" || surface === "gravel" ? wet : 0, (Math.random() - 0.5) * 0.3, !mine);
    }
    if (this.foot.size > near.size + 40) for (const id of this.foot.keys()) if (!near.has(id)) this.foot.delete(id);
  }

  /** Inside a building: your own footsteps, the room's hum, bass, machinery. */
  private interiorLife(sim: Simulation, scene: Scene, dt: number): void {
    const t = this.ctx.currentTime, room = roomFor(scene.interior!);
    this.interiorStep -= dt;
    if (scene.moving && this.interiorStep <= 0) {
      this.interiorStep = scene.running ? 0.26 : 0.38;
      this.step(this.flat(0.45), interiorSurface(scene.interior!), 0, (Math.random() - 0.5) * 0.3);
    }
    this.room.gain.setTargetAtTime(0.03, t, 0.5);
    this.fridge.gain.setTargetAtTime(room.fridge && sim.env.power ? 0.03 : 0, t, 0.4);
    if (room.machine > 0 && sim.world.buildings.length) {
      this.machine.gain.gain.setTargetAtTime(0.16 * room.machine, t, 0.4); if (this.machine.pan) this.machine.pan.pan.setTargetAtTime(0, t, 0.2);
    }
  }

  private thunder(sim: Simulation, scene: Scene): void {
    const la = sim.env.lightningAt;
    if (la === this.lightning) return;
    this.lightning = la;
    if (la < 0 || !this.on) return;
    const delay = 0.25 + Math.random() * 2.2, ctx = this.ctx;
    const at = ctx.currentTime + delay, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(700, at); f.frequency.exponentialRampToValueAtTime(90, at + 3.4);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(scene.interior ? 0.35 : 0.6, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + 3.8);
    const src = ctx.createBufferSource(); src.buffer = this.brown; src.start(at, Math.random() * 1.5, 4);
    src.connect(f); f.connect(g); g.connect(this.input);
    const sub = ctx.createOscillator(), sg = ctx.createGain(); sub.frequency.setValueAtTime(58, at); sub.frequency.exponentialRampToValueAtTime(32, at + 2.5);
    sg.gain.setValueAtTime(0.0001, at); sg.gain.exponentialRampToValueAtTime(0.35, at + 0.08); sg.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
    sub.connect(sg); sg.connect(this.input); sub.start(at); sub.stop(at + 3);
  }

  /** A random bird somewhere in the trees around the camera. */
  private birds(cam: Camera, scene: Scene, hour: number, rain: number, now: number): void {
    if (scene.interior || now < this.nextBird) return;
    const rate = birdRate(hour, rain, this.greenery);
    this.nextBird = now + (rate > 0 ? (1 + Math.random() * 1.5) / rate : 2.5);
    if (rate <= 0) return;
    const a = Math.random() * 6.283, r = 4 + Math.random() * 16;
    const o = this.route(cam.x + Math.cos(a) * r, cam.y + Math.sin(a) * r, 0.22, cam, scene.in2D);
    if (!o || !this.begin("foley")) return;
    const kind = Math.random(), base = 2400 + Math.random() * 1600;
    const parts: AudioScheduledSourceNode[] = [];
    if (kind < 0.45) { // sparrow: a few quick pips
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) parts.push(this.blip(o, "sine", base, base * (1.1 + Math.random() * 0.3), 0.05, 0.3, i * 0.11));
    } else if (kind < 0.8) { // blackbird-ish warble: a wandering run of notes with vibrato
      let f = base * 0.7; const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) { f = Math.max(1600, Math.min(3600, f * (0.85 + Math.random() * 0.35))); parts.push(this.blip(o, "sine", f, f * (0.95 + Math.random() * 0.15), 0.09 + Math.random() * 0.07, 0.28, i * 0.13)); }
    } else { // tui: low bubbling flute with clicks, very Christchurch
      for (let i = 0; i < 4; i++) { const f = 600 + Math.random() * 700; parts.push(this.blip(o, "sine", f, f * 1.5, 0.12, 0.3, i * 0.17)); this.hit(o, "bandpass", 4200, 4, 0.015, 0.2, i * 0.17 + 0.09); }
    }
    this.end(...parts);
  }

  /** Fixed sources in the world: the depot's machines, club bass, fountains and the food truck. */
  private emitters(sim: Simulation, cam: Camera, scene: Scene, now: number): void {
    const t = now, inside = scene.interior !== null, k = inside ? 0.15 : 1;
    const nearest = (list: Emitter[]) => {
      let best: Emitter | null = null, bd = 1e9;
      for (const e of list) { const d = Math.hypot(e.x - cam.x, e.y - cam.y); if (d < bd) { bd = d; best = e; } }
      return best ? { e: best, sp: spatialize(best.x - cam.x, best.y - cam.y, cam.zoom, scene.in2D) } : null;
    };
    const drive = (bed: Bed, list: Emitter[], level: number, reach = 1, open = true) => {
      const n = nearest(list);
      let g = 0;
      if (n && open) {
        const sp = spatialize((n.e.x - cam.x) * reach, (n.e.y - cam.y) * reach, cam.zoom, scene.in2D);
        g = sp.gain * level * k;
        if (bed.pan) bed.pan.pan.setTargetAtTime(sp.pan, t, 0.1);
      }
      bed.gain.gain.setTargetAtTime(g, t, 0.25);
    };
    drive(this.water, this.fountains, 0.06, 1.4);
    drive(this.sizzle, this.trucks, 0.05, 1.2);
    const depotOpen = isOpenNow([7, 19], sim.hour);
    if (!scene.interior) {
      drive(this.machine, this.machines, 0.14, 1, depotOpen);
      // periodic clanks and hydraulic hisses from the depot
      const n = nearest(this.machines);
      if (n && depotOpen && n.sp.gain > 0.03) {
        if (now >= this.nextClank) {
          this.nextClank = now + 0.6 + Math.random() * 1.2;
          const o = this.route(n.e.x, n.e.y, 0.55, cam, scene.in2D);
          if (o && this.begin()) {
            const f = 380 + Math.random() * 260; const a = this.blip(o, "sine", f, f * 0.99, 0.3, 0.2), b2 = this.blip(o, "sine", f * 2.76, f * 2.7, 0.2, 0.1);
            this.hit(o, "highpass", 3500, 1, 0.04, 0.3); this.end(a, b2);
          }
        }
        if (now >= this.nextHiss) {
          this.nextHiss = now + 4 + Math.random() * 5;
          const o = this.route(n.e.x, n.e.y, 0.5, cam, scene.in2D);
          if (o && this.begin()) this.end(this.hit(o, "highpass", 3200, 0.6, 0.7, 0.25));
        }
      }
    } else if (roomFor(scene.interior!).machine > 0 && now >= this.nextClank) {
      this.nextClank = now + 0.5 + Math.random();
      const o = this.flat(0.35 * roomFor(scene.interior!).machine);
      if (this.begin()) { const f = 300 + Math.random() * 300; this.end(this.blip(o, "sine", f, f * 0.99, 0.35, 0.2), this.blip(o, "sine", f * 2.76, f * 2.7, 0.2, 0.1)); }
    }

    // bass leaking through club walls: inside a venue, or on the pavement outside one after dark
    let leak = 0, pan = 0;
    if (scene.interior) leak = roomFor(scene.interior).bass * 0.6;
    else {
      const n = nearest(this.clubs);
      if (n && (sim.hour >= 20 || sim.hour < 5 || this.leak > 0)) { leak = n.sp.gain * 0.7; pan = n.sp.pan; }
    }
    this.leak = Math.max(0, this.leak - 0.04);
    leak = Math.min(1, leak + this.leak * 0.5);
    this.thump.gain.setTargetAtTime(leak * 0.55, t, 0.15);
    this.thumpFilter.frequency.setTargetAtTime(scene.interior ? 260 : 150, t, 0.2);
    if (this.thumpPan) this.thumpPan.pan.setTargetAtTime(pan, t, 0.1);
    if (leak > 0.02) {
      if (this.nextBeat < t - 0.5) this.nextBeat = t + 0.05;
      while (this.nextBeat < t + 0.15) {
        const at = this.nextBeat, n = this.beatN++;
        const beat = 60 / 124;
        if (n % 2 === 0) { // kick on the beat
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.9, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
          o.connect(g); g.connect(this.thumpFilter); o.start(at); o.stop(at + 0.22);
        } else if (n % 4 === 3) { // bass note on the off-beat (E / G)
          const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = "sawtooth"; o.frequency.value = n % 8 === 7 ? 49 : 41.2;
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + beat * 0.7);
          o.connect(g); g.connect(this.thumpFilter); o.start(at); o.stop(at + beat * 0.75);
        }
        this.nextBeat += beat / 2;
      }
    }
  }
}
