import { rng } from "./Music";
import { buskerTune, buskerNote, buskerGain } from "./Moods";

/**
 * The street busker's tiny track. One soft plucked voice, panned and faded by how far the nearest busker is,
 * that follows the mood of the day (see Moods.buskerTune). Silent unless a busker is within earshot.
 */
export class BuskerVoice {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private slot = 0;
  private bar = 0;
  private rand = rng(0xB05C);
  private out: GainNode;
  private pan: StereoPannerNode | null;
  private gain = 0;
  private hour = 12;
  private rain = 0;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.pan) { this.out.connect(this.pan); this.pan.connect(dest); } else this.out.connect(dest);
  }

  start(): void { if (this.timer) return; this.nextAt = this.ctx.currentTime + 0.1; this.timer = setInterval(() => this.pump(), 100); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** `dist` in tiles to the nearest busker (Infinity for none), `pan` -1..1. */
  update(dist: number, pan: number, hour: number, rain: number): void {
    this.hour = hour; this.rain = rain; this.gain = buskerGain(dist);
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.gain * 0.5, t, 0.4);
    if (this.pan) this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.3);
  }

  private pump(): void {
    const ctx = this.ctx;
    if (ctx.state !== "running" || this.gain < 0.01) { this.nextAt = ctx.currentTime + 0.1; return; }
    const tune = buskerTune(this.hour, this.rain), slotLen = 60 / tune.bpm / 2;
    while (this.nextAt < ctx.currentTime + 0.3) {
      const n = buskerNote(tune, this.bar, this.slot, this.rand);
      if (n !== null) this.pluck(this.nextAt, n, tune.gain);
      this.nextAt += slotLen;
      if (++this.slot >= 8) { this.slot = 0; this.bar++; }
    }
  }

  /** A warm ukulele-ish pluck: triangle through a lowpass, short decay. */
  private pluck(t: number, midi: number, gain: number): void {
    const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    f.type = "lowpass"; f.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.75);
  }
}
