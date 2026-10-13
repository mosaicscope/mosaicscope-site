/**
 * Generative soundtrack for the city: all original, synthesised live with Web Audio (no samples, no files).
 * Fun-but-scary: a lazy sunny jangle by day, a moody dorian pad by night, rain softens it and storms
 * rumble under it, and police heat or a brawl bends it towards phrygian dread. The 2D street view gets a
 * dusty boom-bap shuffle. Everything below `Music` is pure so it can be tested without an AudioContext.
 */

import { THEMES, SceneTracker, sceneFor, resolveTheme, motifNote, liveTint, parseInspo, type Theme, type Place, type Scene, type Live, type Inspo, type Timbre } from "./Score";
import inspoRaw from "./inspo.json";
import { layersFor, BASE_CRACKLE, type Layers } from "./Moods";

export interface Mood {
  /** 0..24 */ hour: number;
  /** 0..1 */ rain: number;
  storm: boolean;
  /** 0..1 dread: police heat, low health, a brawl nearby */ tension: number;
  /** street view (2D) rather than the iso city */ street: boolean;
  party: boolean;
  /** inside a building (the walk-in interior view) */ indoors?: boolean;
  /** a notable place or character is near, which brings in its leitmotif */ place?: Place;
  /** the cops are properly after you (wanted 2+) */ chase?: boolean;
}

export type Flavour = "day" | "dusk" | "night" | "dread";
export interface Scale { name: Flavour; root: number; steps: number[]; chords: number[][]; bpm: number }

/** Mulberry32, so a given seed always plays the same tune. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

const SCALES: Record<Flavour, Scale> = {
  // D major pentatonic-ish, bright and lazy
  day: { name: "day", root: 50, steps: [0, 2, 4, 7, 9, 12], chords: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 5, 9, 12]], bpm: 88 },
  // A mixolydian, golden hour wobble
  dusk: { name: "dusk", root: 45, steps: [0, 2, 4, 7, 9, 10, 12], chords: [[0, 4, 7, 10], [5, 9, 12, 16], [10, 14, 17, 21], [0, 4, 7, 10]], bpm: 80 },
  // E dorian, minor and a bit lonely
  night: { name: "night", root: 40, steps: [0, 2, 3, 7, 9, 10, 12], chords: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [10, 14, 17, 20]], bpm: 72 },
  // C phrygian with a tritone in it, slow and wrong
  dread: { name: "dread", root: 36, steps: [0, 1, 3, 6, 7, 8, 12], chords: [[0, 3, 7, 8], [1, 5, 8, 12], [0, 3, 6, 10], [6, 9, 12, 15]], bpm: 64 },
};

/** Pick the musical flavour: dread wins over everything, then the scene's own colour, otherwise follow the clock. */
export function flavourFor(m: Mood, theme?: Theme): Flavour {
  if (m.tension > 0.55) return "dread";
  if (theme?.flavour) return theme.flavour;
  const h = ((m.hour % 24) + 24) % 24;
  if (h >= 6 && h < 17) return "day";
  if (h >= 17 && h < 21) return "dusk";
  return "night";
}

export const scaleFor = (f: Flavour): Scale => SCALES[f];

export interface Step {
  bass: number | null;     // midi
  lead: number | null;     // midi
  kick: boolean; snare: boolean; hat: 0 | 1 | 2;
  /** a leitmotif note (midi) for this step, if the scene has one and it is due */ motif: number | null;
  /** seconds to push this step late (swing) */ swing: number;
}

/** One 16th-note step of the groove. `bar` and `step` count from zero; the theme (default: the scene's) sets drums, busyness and leitmotif. */
export function planStep(m: Mood, f: Flavour, bar: number, step: number, rand: () => number, theme: Theme = THEMES[sceneFor(m)]): Step {
  const sc = SCALES[f], chord = sc.chords[bar % sc.chords.length];
  const beat = step % 4 === 0, offbeat = step % 4 === 2;
  const dread = f === "dread";
  let kick = false, snare = false, hat: 0 | 1 | 2 = 0;
  switch (theme.drums) {
    case "shuffle": kick = step === 0 || step === 7 || step === 10; snare = step === 4 || step === 12; hat = step % 2 === 0 ? 2 : 0; break; // lazy boom-bap
    case "club": kick = step === 0 || step === 8 || step === 10; snare = step === 4 || step === 12; hat = step % 2 === 0 ? 2 : 0; break;
    case "chase": kick = step === 0 || step === 7 || step === 10; snare = step === 4 || step === 12; hat = step % 4 === 2 ? 1 : 0; break;
    case "mallet": kick = step === 0 && bar % 2 === 0; hat = offbeat ? 2 : 0; break;
    case "tick": kick = step === 0 && bar % 2 === 0; hat = offbeat && bar % 2 === 0 && !dread && m.rain < 0.5 ? 2 : 0; break;
    case "none": break;
  }
  const bass = beat && (step === 0 || rand() < 0.45) ? sc.root - 12 + chord[0] + (step === 8 && rand() < 0.5 ? 7 : 0) : null;
  const density = (dread ? 0.12 : f === "night" ? 0.2 : 0.3) * theme.density * (1 - m.rain * 0.5);
  const mo = motifNote(theme.motif, bar, step);
  const motif = mo === null ? null : sc.root + chord[0] + 12 + mo;
  let lead: number | null = null;
  if (step % 2 === 0 && rand() < density && motif === null) {
    const deg = sc.steps[Math.floor(rand() * sc.steps.length)];
    lead = sc.root + 12 + deg + (rand() < 0.15 ? 12 : 0);
  }
  return { bass, lead, kick, snare, hat, motif, swing: step % 2 === 1 ? 0.06 : 0 };
}

/** Peak levels of each voice. Soft by design (lofi): the critique's loudness proxy reads these too. */
export const LEVELS = { kick: 0.26, snare: 0.07, hatLo: 0.018, hatHi: 0.032, bass: 0.24, lead: 0.08, motif: 0.11, pad: 0.09 };

export const stepSeconds = (bpm: number): number => 60 / bpm / 4;

/** Plays the generator through the supplied context into `dest`. Safe to start/stop repeatedly. */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private bar = 0;
  private step = 0;
  private rand = rng(0xC0FFEE);
  private flavour: Flavour = "day";
  private chordKey = "";
  private pad: { oscs: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null;
  private out: GainNode;
  private tracker = new SceneTracker();
  private theme: Theme = THEMES.city;
  /** the score Chris art-directs through inspo.json */
  inspo: Inspo = parseInspo(inspoRaw);
  /** real Christchurch conditions; audio only, the simulation never sees this */
  live: Live | null = null;
  /** dream / rain-glass / 3am add-ons, set per frame by AudioSystem */
  layers: Layers = layersFor({ dream: 0, late: 0, rain: 0 });
  private crackleGain: GainNode | null = null;
  private glass: GainNode | null = null;
  private hush: { gain: GainNode; oscs: OscillatorNode[] } | null = null;
  mood: Mood = { hour: 17, rain: 0, storm: false, tension: 0, street: false, party: false };

  constructor(private ctx: AudioContext, dest: AudioNode) {
    // everything runs through a warm lowpass ("tape"), so nothing can be harsh
    const warm = ctx.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 3600; warm.Q.value = 0.4; warm.connect(dest);
    this.out = ctx.createGain(); this.out.gain.value = 0.4; this.out.connect(warm);
  }

  get scene(): Scene { return this.tracker.scene; }

  start(): void {
    if (this.timer) return;
    this.nextAt = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.pump(), 80);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  setLevel(v: number): void { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); }

  /** A short victory or defeat sting, played through the same warm tape filter as the score. */
  stinger(kind: "victory" | "defeat"): void {
    const t = this.ctx.currentTime + 0.02;
    const notes = kind === "victory" ? [440, 554.37, 659.25, 880] : [329.63, 293.66, 261.63, 233.08];
    const wave: OscillatorType = kind === "victory" ? "triangle" : "sine";
    const gap = kind === "victory" ? 0.09 : 0.2, len = kind === "victory" ? 0.5 : 0.7, peak = kind === "victory" ? 0.12 : 0.1;
    notes.forEach((f, i) => {
      const at = t + i * gap, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = wave; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(this.out); o.start(at); o.stop(at + len + 0.05);
    });
  }

  setLive(l: Live | null): void { this.live = l; }

  /** Ease the mood layers in: crackle, rain on glass, the 3am hush and the dream wobble all glide, never jump. */
  setLayers(l: Layers): void {
    this.layers = l;
    const t = this.ctx.currentTime;
    this.crackleGain?.gain.setTargetAtTime(l.crackle, t, 1.5);
    this.glass?.gain.setTargetAtTime(l.glass, t, 1.5);
    this.hush?.gain.gain.setTargetAtTime(l.hush, t, 3);
    if (this.pad) for (const o of this.pad.oscs) o.detune.setTargetAtTime((o.detune.value < 0 ? -7 : 7) * (1 + l.wobble / 7), t, 2);
  }


  setMood(m: Mood): void {
    this.mood = m;
    const t = this.ctx.currentTime, rain = Math.min(1, m.rain + (this.inspo.live ? liveTint(this.live).rain : 0));
    if (this.drone) this.drone.gain.gain.setTargetAtTime(Math.max(m.tension * 0.35, m.storm ? 0.12 : 0), t, 1.5);
    if (this.pad) this.pad.filter.frequency.setTargetAtTime((600 + (1 - rain * 0.6) * 900) * this.theme.bright, t, 1);
  }

  private pump(): void {
    const ctx = this.ctx;
    if (ctx.state !== "running") { this.nextAt = ctx.currentTime + 0.1; return; }
    while (this.nextAt < ctx.currentTime + 0.25) {
      if (this.step === 0) this.newBar();
      const f = this.flavour, sc = SCALES[f], th = this.theme, s = planStep(this.mood, f, this.bar, this.step, this.rand, th);
      const t = this.nextAt + s.swing * (th.drums === "shuffle" ? 1 : 0.4);
      if (s.kick) this.kick(t);
      if (s.snare) this.snare(t);
      if (s.hat) this.hat(t, s.hat === 2 ? LEVELS.hatLo : LEVELS.hatHi);
      if (s.bass !== null) this.bass(t, s.bass, stepSeconds(sc.bpm * th.bpm) * 3);
      if (s.lead !== null) this.lead(t, s.lead, f, th.timbre);
      if (s.motif !== null) this.lead(t, s.motif, f, th.timbre, LEVELS.motif / LEVELS.lead);
      this.nextAt += stepSeconds(sc.bpm * th.bpm);
      if (++this.step >= 16) { this.step = 0; this.bar++; }
    }
  }

  /** Bar boundary: pick the scene (with hold), resolve its theme, swap scale when it changes, retune the pad. */
  private newBar(): void {
    const prev = this.tracker.update(this.mood);
    const base = resolveTheme(this.tracker.scene, this.inspo, this.live), ly = this.layers;
    this.theme = { ...base, bpm: base.bpm * ly.bpm, density: base.density * ly.density, bright: base.bright * ly.bright };
    if (prev) this.swell();
    const f = flavourFor(this.mood, this.theme);
    this.flavour = f;
    const sc = SCALES[f], chord = sc.chords[this.bar % sc.chords.length];
    const key = f + ":" + (this.bar % sc.chords.length);
    if (key !== this.chordKey) { this.chordKey = key; this.setPad(sc.root + chord[0], chord.slice(1), f); }
    this.ensureDrone(sc.root - 12);
    this.ensureCrackle();
    this.ensureHush(sc.root);
  }

  /** Scene change: no risers or sweeps, just a soft breath: the level eases down for a beat and back up. */
  private swell(): void {
    const g = this.out.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.22, t + 0.6); g.linearRampToValueAtTime(0.4, t + 2.2);
  }

  private setPad(root: number, tones: number[], f: Flavour): void {
    const ctx = this.ctx, t = ctx.currentTime, dur = stepSeconds(SCALES[f].bpm) * 16;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 700; filter.Q.value = 0.5;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(f === "dread" ? LEVELS.pad * 0.75 : LEVELS.pad, t + dur * 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
    const oscs: OscillatorNode[] = [];
    for (const [i, n] of [0, ...tones].entries()) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = "triangle"; // soft, no saw buzz
        o.frequency.value = mtof(root + n + (i === 0 ? 12 : 12)); o.detune.value = det * (1 + this.layers.wobble / 7);
        o.connect(filter); o.start(t); o.stop(t + dur * 1.15); oscs.push(o);
      }
    }
    filter.connect(gain); gain.connect(this.out);
    this.pad = { oscs, gain, filter };
    this.setMood(this.mood);
  }

  /** Quiet vinyl hiss and the odd soft pop, always on: the lofi bed. */
  private crackle = false;
  private ensureCrackle(): void {
    if (this.crackle) return;
    this.crackle = true;
    const ctx = this.ctx, n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = rng(0xBEEF);
    for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * 0.25 + (r() < 0.0004 ? (r() * 2 - 1) * 2 : 0);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.value = BASE_CRACKLE; this.crackleGain = g;
    src.connect(f); f.connect(g); g.connect(this.out); src.start();
    // rain on the window: soft lowpassed noise that only opens up when it rains while you are inside
    const gl = ctx.createBufferSource(); gl.buffer = buf; gl.loop = true; gl.playbackRate.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
    const gg = ctx.createGain(); gg.gain.value = 0; this.glass = gg;
    gl.connect(lp); lp.connect(gg); gg.connect(this.out); gl.start();
  }

  /** The 3am layer: two very quiet sine tones (root and fifth, an octave up) that fade in when the city sleeps. */
  private ensureHush(root: number): void {
    const ctx = this.ctx;
    if (!this.hush) {
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.out);
      const oscs = [0, 7].map((n) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = mtof(root + 12 + n); o.connect(gain); o.start(); return o; });
      this.hush = { gain, oscs };
    }
    this.hush.oscs.forEach((o, i) => o.frequency.setTargetAtTime(mtof(root + 12 + (i ? 7 : 0)), ctx.currentTime, 2));
  }

  private ensureDrone(midi: number): void {
    const ctx = this.ctx;
    if (!this.drone) {
      const osc = ctx.createOscillator(); osc.type = "sine";
      const gain = ctx.createGain(); gain.gain.value = 0;
      // slow tremolo so the drone breathes
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.18; lg.gain.value = 0.04;
      lfo.connect(lg); lg.connect(gain.gain); lfo.start();
      osc.connect(gain); gain.connect(this.out); osc.start();
      this.drone = { osc, gain };
    }
    this.drone.osc.frequency.setTargetAtTime(mtof(midi), ctx.currentTime, 0.8);
  }

  private env(t: number, peak: number, dur: number, attack = 0.012): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out); return g;
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator(), g = this.env(t, LEVELS.kick, 0.3, 0.015);
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.35);
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number): void {
    const ctx = this.ctx, n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    src.connect(f); f.connect(this.env(t, peak, dur)); src.start(t);
  }

  private snare(t: number): void { this.noiseBurst(t, 0.2, "bandpass", 1100, LEVELS.snare); } // a soft brushed rim, not a crack
  private hat(t: number, v: number): void { this.noiseBurst(t, 0.05, "bandpass", 5200, v); }

  private bass(t: number, midi: number, dur: number): void {
    const o = this.ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(midi);
    const g = this.env(t, LEVELS.bass, dur, 0.03); o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  /** Pluck by day, glassy detuned bell at night and in dread; brass, marimba and keys colour the special scenes. */
  private lead(t: number, midi: number, f: Flavour, timbre: Timbre = "pluck", gain = 1): void {
    const ctx = this.ctx, fq = mtof(midi), tone = (type: OscillatorType, mul: number, peak: number, dur: number, lp?: number): void => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = fq * mul;
      const g = this.env(t, peak * gain, dur, 0.025);
      if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); fl.connect(g); } else o.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    };
    // every voice has a soft attack and a lowpass: warm electric-piano and music-box colours, nothing sharp
    const L = LEVELS.lead;
    switch (timbre) {
      case "brass": tone("triangle", 1, L * 0.9, 0.9, 1100); tone("sine", 2, L * 0.25, 0.5); break;   // a soft "rhodes" for the tense scenes
      case "marimba": tone("sine", 1, L * 1.1, 0.5, 1800); tone("triangle", 2, L * 0.2, 0.2, 1500); break;
      case "keys": tone("triangle", 1, L, 1.1, 1400); tone("sine", 2, L * 0.3, 0.7); break;
      case "bell": tone("sine", 1, L, 1.6, 2000); tone("sine", f === "dread" ? 1.4142 : 2.005, L * 0.25, 1.1, 2000); break;
      default:
        tone("sine", 1, f === "dread" ? L * 0.75 : L, f === "day" ? 0.8 : 1.3, 1800);
        if (f !== "day") tone("sine", f === "dread" ? 1.4142 : 2.005, L * 0.25, 1.0, 2000);
    }
  }
}
