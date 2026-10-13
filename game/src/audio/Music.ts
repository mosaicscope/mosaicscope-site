/**
 * Generative soundtrack for the city: all original, synthesised live with Web Audio (no samples, no files).
 * Fun-but-scary: a lazy sunny jangle by day, a moody dorian pad by night, rain softens it and storms
 * rumble under it, and police heat or a brawl bends it towards phrygian dread. The 2D street view gets a
 * dusty boom-bap shuffle. Everything below `Music` is pure so it can be tested without an AudioContext.
 */

export interface Mood {
  /** 0..24 */ hour: number;
  /** 0..1 */ rain: number;
  storm: boolean;
  /** 0..1 dread: police heat, low health, a brawl nearby */ tension: number;
  /** street view (2D) rather than the iso city */ street: boolean;
  party: boolean;
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

/** Pick the musical flavour: dread wins over everything, otherwise follow the clock. */
export function flavourFor(m: Mood): Flavour {
  if (m.tension > 0.55) return "dread";
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
  /** seconds to push this step late (swing) */ swing: number;
}

/** One 16th-note step of the groove. `bar` and `step` count from zero; `pad` (0..1) is how busy the lead is. */
export function planStep(m: Mood, f: Flavour, bar: number, step: number, rand: () => number): Step {
  const sc = SCALES[f], chord = sc.chords[bar % sc.chords.length];
  const beat = step % 4 === 0, offbeat = step % 4 === 2;
  const dread = f === "dread";
  // drums: street view gets a boom-bap shuffle, the iso city only ticks softly, party/dread override
  const busy = m.street || m.party;
  const kick = busy ? (step === 0 || step === 7 || step === 10 || (m.party && beat)) : step === 0 && bar % 2 === 0;
  const snare = busy ? step === 4 || step === 12 : false;
  const hat: 0 | 1 | 2 = busy ? (step % 2 === 0 ? 1 : (rand() < 0.4 ? 2 : 0)) : (offbeat && !dread && m.rain < 0.5 ? 2 : 0);
  const bass = beat && (step === 0 || rand() < 0.45) ? sc.root - 12 + chord[0] + (step === 8 && rand() < 0.5 ? 7 : 0) : null;
  const density = (dread ? 0.12 : f === "night" ? 0.2 : 0.3) * (m.street ? 1.3 : 1) * (1 - m.rain * 0.5);
  let lead: number | null = null;
  if (step % 2 === 0 && rand() < density) {
    const deg = sc.steps[Math.floor(rand() * sc.steps.length)];
    lead = sc.root + 12 + deg + (rand() < 0.15 ? 12 : 0);
  }
  return { bass, lead, kick, snare, hat, swing: step % 2 === 1 ? 0.035 : 0 };
}

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
  mood: Mood = { hour: 17, rain: 0, storm: false, tension: 0, street: false, party: false };

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(dest);
  }

  start(): void {
    if (this.timer) return;
    this.nextAt = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.pump(), 80);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  setLevel(v: number): void { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); }

  setMood(m: Mood): void {
    this.mood = m;
    const t = this.ctx.currentTime;
    if (this.drone) this.drone.gain.gain.setTargetAtTime(Math.max(m.tension * 0.35, m.storm ? 0.12 : 0), t, 1.5);
    if (this.pad) this.pad.filter.frequency.setTargetAtTime(600 + (1 - m.rain * 0.6) * 900 + (m.street ? 300 : 0), t, 1);
  }

  private pump(): void {
    const ctx = this.ctx;
    if (ctx.state !== "running") { this.nextAt = ctx.currentTime + 0.1; return; }
    while (this.nextAt < ctx.currentTime + 0.25) {
      if (this.step === 0) this.newBar();
      const f = this.flavour, sc = SCALES[f], s = planStep(this.mood, f, this.bar, this.step, this.rand);
      const t = this.nextAt + s.swing * (this.mood.street ? 1 : 0.4);
      if (s.kick) this.kick(t);
      if (s.snare) this.snare(t);
      if (s.hat) this.hat(t, s.hat === 2 ? 0.05 : 0.09);
      if (s.bass !== null) this.bass(t, s.bass, stepSeconds(sc.bpm) * 3);
      if (s.lead !== null) this.lead(t, s.lead, f);
      this.nextAt += stepSeconds(sc.bpm);
      if (++this.step >= 16) { this.step = 0; this.bar++; }
    }
  }

  /** Bar boundary: re-read the mood, swap scale when it changes, retune the pad. */
  private newBar(): void {
    const f = flavourFor(this.mood);
    this.flavour = f;
    const sc = SCALES[f], chord = sc.chords[this.bar % sc.chords.length];
    const key = f + ":" + (this.bar % sc.chords.length);
    if (key !== this.chordKey) { this.chordKey = key; this.setPad(sc.root + chord[0], chord.slice(1), f); }
    this.ensureDrone(sc.root - 12);
  }

  private setPad(root: number, tones: number[], f: Flavour): void {
    const ctx = this.ctx, t = ctx.currentTime, dur = stepSeconds(SCALES[f].bpm) * 16;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 900; filter.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(f === "dread" ? 0.07 : 0.1, t + dur * 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
    const oscs: OscillatorNode[] = [];
    for (const [i, n] of [0, ...tones].entries()) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator(); o.type = f === "day" ? "triangle" : "sawtooth";
        o.frequency.value = mtof(root + n + (i === 0 ? 12 : 12)); o.detune.value = det;
        o.connect(filter); o.start(t); o.stop(t + dur * 1.15); oscs.push(o);
      }
    }
    filter.connect(gain); gain.connect(this.out);
    this.pad = { oscs, gain, filter };
    this.setMood(this.mood);
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

  private env(t: number, peak: number, dur: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out); return g;
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator(), g = this.env(t, 0.5, 0.22);
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    o.connect(g); o.start(t); o.stop(t + 0.25);
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number): void {
    const ctx = this.ctx, n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    src.connect(f); f.connect(this.env(t, peak, dur)); src.start(t);
  }

  private snare(t: number): void { this.noiseBurst(t, 0.16, "bandpass", 1800, 0.22); }
  private hat(t: number, v: number): void { this.noiseBurst(t, 0.04, "highpass", 7000, v); }

  private bass(t: number, midi: number, dur: number): void {
    const o = this.ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(midi);
    const g = this.env(t, 0.32, dur); o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  /** Kalimba-ish pluck by day, glassy detuned bell at night and in dread. */
  private lead(t: number, midi: number, f: Flavour): void {
    const ctx = this.ctx, dur = f === "day" ? 0.5 : 1.1, g = this.env(t, f === "dread" ? 0.07 : 0.1, dur);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = mtof(midi);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    if (f !== "day") {
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = mtof(midi) * (f === "dread" ? 1.4142 : 2.005);
      const g2 = this.env(t, 0.03, dur * 0.8); o2.connect(g2); o2.start(t); o2.stop(t + dur);
    }
  }
}
