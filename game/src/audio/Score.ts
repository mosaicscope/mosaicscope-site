/**
 * Lil Wooski's score logic: which scene the player is in, the theme each scene gets, the leitmotifs for
 * recurring characters and places, the mood vocabulary Chris can use in `inspo.json`, and how real-world
 * Christchurch conditions tint the music. All pure (no AudioContext), so it is unit-tested and the
 * simulation never reads any of it: live data only ever bends the audio.
 */
import type { Mood, Flavour } from "./Music";

export type Scene = "city" | "dawn" | "rain" | "street2d" | "interior" | "nightlife" | "chase" | "recycling" | "terrance" | "studio";
export type Place = "" | "studio" | "recycling" | "terrance" | "nightlife";
export type Drums = "none" | "tick" | "shuffle" | "club" | "chase" | "mallet";
export type Timbre = "pluck" | "bell" | "brass" | "marimba" | "keys";
export type MotifId = "terrance" | "studio" | "recycling" | "police" | "club";

export interface Theme {
  /** forced scale family; undefined follows the clock */ flavour?: Flavour;
  /** tempo multiplier on the scale's bpm */ bpm: number;
  drums: Drums;
  /** lead busyness multiplier */ density: number;
  /** pad filter multiplier, lower is more muffled */ bright: number;
  timbre: Timbre;
  motif?: MotifId;
}

export const THEMES: Record<Scene, Theme> = {
  city: { bpm: 0.92, drums: "tick", density: 0.85, bright: 1, timbre: "pluck" },
  dawn: { flavour: "day", bpm: 0.82, drums: "none", density: 0.7, bright: 0.8, timbre: "bell" },
  rain: { bpm: 0.88, drums: "none", density: 0.6, bright: 0.6, timbre: "bell" },
  street2d: { bpm: 0.95, drums: "shuffle", density: 1, bright: 1, timbre: "pluck" },
  interior: { bpm: 0.9, drums: "none", density: 0.8, bright: 0.55, timbre: "keys" },
  nightlife: { flavour: "night", bpm: 1.1, drums: "club", density: 1.6, bright: 1, timbre: "keys", motif: "club" },
  chase: { flavour: "dread", bpm: 1.25, drums: "chase", density: 0.8, bright: 1, timbre: "brass", motif: "police" },
  recycling: { flavour: "day", bpm: 0.95, drums: "mallet", density: 1.1, bright: 1, timbre: "marimba", motif: "recycling" },
  terrance: { flavour: "dread", bpm: 1.05, drums: "tick", density: 0.8, bright: 1, timbre: "brass", motif: "terrance" },
  studio: { flavour: "day", bpm: 0.9, drums: "tick", density: 0.9, bright: 0.9, timbre: "keys", motif: "studio" },
};

/**
 * Leitmotifs: the same few notes every time that character or place is near, transposed to the chord.
 * `at` are 16th-note steps inside a bar, `notes` are semitones above the chord root (one octave up),
 * `every` plays the motif on bars where `bar % every === 0`.
 */
export interface Motif { at: number[]; notes: number[]; every: number }
export const MOTIFS: Record<MotifId, Motif> = {
  terrance: { at: [0, 3, 6, 9], notes: [0, 1, 0, 6], every: 1 },      // an insistent, slightly wrong ostinato: frugal but insane
  studio: { at: [0, 4, 8, 12], notes: [0, 4, 7, 12], every: 4 },      // a warm rising arpeggio, the creative home
  recycling: { at: [0, 2, 4, 8], notes: [12, 7, 12, 16], every: 2 },  // a bouncy clink-clink for cans and cash
  police: { at: [0, 4, 8, 12], notes: [0, 6, 0, 6], every: 1 },       // a tritone siren
  club: { at: [0, 6, 10], notes: [0, 7, 10], every: 1 },              // a three-note hook
};

export function motifNote(id: MotifId | undefined, bar: number, step: number): number | null {
  if (!id) return null;
  const mo = MOTIFS[id];
  if (bar % mo.every !== 0) return null;
  const i = mo.at.indexOf(step);
  return i < 0 ? null : mo.notes[i];
}

/** Which scene the player is in right now. Highest priority first. */
export function sceneFor(m: Mood): Scene {
  if (m.chase) return "chase";
  if (m.place === "terrance") return "terrance";
  if (m.party || m.place === "nightlife") return "nightlife";
  if (m.place === "recycling") return "recycling";
  if (m.place === "studio") return "studio";
  if (m.indoors) return "interior";
  if (m.street) return "street2d";
  const h = ((m.hour % 24) + 24) % 24;
  if (m.rain > 0.4 || m.storm) return "rain";
  if (h >= 5 && h < 7.5) return "dawn";
  return "city";
}

/**
 * Smooth transitions: a scene only changes after the new one has held for `HOLD` bars, so walking past a door
 * does not whiplash the music. The chase is the exception and cuts in on the next bar line.
 */
export const HOLD = 2;
export class SceneTracker {
  scene: Scene = "city";
  private pending: Scene | null = null;
  private bars = 0;
  /** Call once per bar. Returns the previous scene when it changed, else null. */
  update(m: Mood): Scene | null {
    const c = sceneFor(m);
    if (c === this.scene) { this.pending = null; this.bars = 0; return null; }
    if (c !== this.pending) { this.pending = c; this.bars = 0; }
    if (c === "chase" || ++this.bars >= HOLD) { const prev = this.scene; this.scene = c; this.pending = null; this.bars = 0; return prev; }
    return null;
  }
}

/** Named moods Chris can hand the score in `inspo.json` ("make the studio feel tender"). */
export interface MoodSpec { flavour?: Flavour; bpm: number; density: number; bright: number }
export const MOODS = {
  lonely: { flavour: "night", bpm: 0.85, density: 0.7, bright: 0.7 },
  swagger: { flavour: "dusk", bpm: 1.05, density: 1.2, bright: 1.1 },
  dreamy: { flavour: "dusk", bpm: 0.8, density: 0.6, bright: 0.75 },
  hype: { flavour: "day", bpm: 1.3, density: 1.5, bright: 1.3 },
  tender: { flavour: "day", bpm: 0.9, density: 0.7, bright: 0.8 },
  mischief: { flavour: "dusk", bpm: 1.15, density: 1.4, bright: 1.1 },
  noir: { flavour: "night", bpm: 0.95, density: 0.8, bright: 0.7 },
  dread: { flavour: "dread", bpm: 0.9, density: 0.5, bright: 0.8 },
} satisfies Record<string, MoodSpec>;
export type MoodName = keyof typeof MOODS;

export interface SceneInspo { mood?: MoodName; tempo?: number; density?: number; flavour?: Flavour }
export interface Inspo {
  /** let real Christchurch weather and time colour the audio */ live: boolean;
  tempo: number; density: number;
  scenes: Partial<Record<Scene, SceneInspo>>;
}

const clamp = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const FLAVOURS: Flavour[] = ["day", "dusk", "night", "dread"];

/** Reads `inspo.json` defensively: anything unknown or out of range is ignored or clamped, never thrown. */
export function parseInspo(raw: unknown): Inspo {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Inspo = { live: o.live !== false, tempo: clamp(o.tempo, 0.7, 1.3, 1), density: clamp(o.density, 0.3, 2, 1), scenes: {} };
  const sc = (o.scenes && typeof o.scenes === "object" ? o.scenes : {}) as Record<string, unknown>;
  for (const k of Object.keys(THEMES) as Scene[]) {
    const s = sc[k]; if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>, e: SceneInspo = {};
    if (typeof r.mood === "string" && r.mood in MOODS) e.mood = r.mood as MoodName;
    if (typeof r.tempo === "number") e.tempo = clamp(r.tempo, 0.6, 1.6, 1);
    if (typeof r.density === "number") e.density = clamp(r.density, 0.3, 2, 1);
    if (typeof r.flavour === "string" && FLAVOURS.includes(r.flavour as Flavour)) e.flavour = r.flavour as Flavour;
    out.scenes[k] = e;
  }
  return out;
}

/** Real-world conditions in Christchurch, fetched by /api/vibe (or computed from the clock if offline). */
export interface Live { weather: "clear" | "cloudy" | "rain" | "storm"; isDay: boolean; temp: number; wind: number; /** local hour 0..24 */ hour: number; source: "live" | "clock" }

export interface Tint { bpm: number; density: number; bright: number; rain: number }
/** How the real world bends the music: IRL rain softens and thins it, a cold snap darkens it, late nights slow it. */
export function liveTint(l: Live | null | undefined): Tint {
  const t: Tint = { bpm: 1, density: 1, bright: 1, rain: 0 };
  if (!l) return t;
  if (l.weather === "rain") { t.rain = 0.45; t.density *= 0.85; t.bright *= 0.9; }
  if (l.weather === "storm") { t.rain = 0.8; t.density *= 0.7; t.bright *= 0.8; t.bpm *= 0.97; }
  if (l.temp < 8) { t.bright *= 0.88; t.bpm *= 0.97; } else if (l.temp > 22) { t.bright *= 1.1; t.bpm *= 1.02; }
  if (l.wind > 35) t.bright *= 1.08;
  const h = ((l.hour % 24) + 24) % 24;
  if (h >= 23 || h < 5) { t.density *= 0.75; t.bpm *= 0.95; }
  return t;
}

/** Base theme for the scene, then Chris's inspo, then the live tint. Everything clamped to sane musical ranges. */
export function resolveTheme(scene: Scene, inspo: Inspo, live: Live | null | undefined): Theme {
  const base = THEMES[scene], si = inspo.scenes[scene] ?? {}, mood = si.mood ? MOODS[si.mood] as MoodSpec : null;
  const tint = inspo.live ? liveTint(live) : liveTint(null);
  const bpm = base.bpm * (mood?.bpm ?? 1) * (si.tempo ?? 1) * inspo.tempo * tint.bpm;
  const density = base.density * (mood?.density ?? 1) * (si.density ?? 1) * inspo.density * tint.density;
  const bright = base.bright * (mood?.bright ?? 1) * tint.bright;
  return { ...base, flavour: si.flavour ?? mood?.flavour ?? base.flavour, bpm: Math.min(2.4, Math.max(0.5, bpm)), density: Math.min(2.5, Math.max(0.2, density)), bright: Math.min(2, Math.max(0.3, bright)) };
}
