import type { Simulation } from "../sim/Simulation";
import type { Camera } from "../render/Camera";
import { Music } from "./Music";
import { Diegetic, STREET, type Scene } from "./Diegetic";

/**
 * Synthesised audio (no files to load): material-specific impact blips, whooshes, boings, rain and a
 * simple party beat. Off until the player turns it on (browsers require a gesture anyway).
 * Sounds are panned by screen position and attenuated by distance; a rate limiter stops pile-ups.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private recent = 0;
  private recentT = 0;
  private beatAt = 0;
  enabled = false;
  volume = 0.6;
  private unsub: (() => void) | null = null;
  private music: Music | null = null;
  /** the generative soundtrack; N toggles it, the sound setting still gates everything */
  musicOn = true;
  /** Hunter's in-world sound layer: footsteps, cars, weather, doors, machines (own bus, own mute: J) */
  private dg: Diegetic | null = null;
  private sim: Simulation | null = null;
  /** every effect connects here: the world-sound bus once audio is on */
  private fx: AudioNode | null = null;
  sfxOn = true; sfxVolume = 0.8;
  /** where the player is (the game sets this each frame): street, 2D street view or inside a building */
  scene: Scene = STREET;

  constructor(private getCam: () => Camera) {}

  /** N mutes/unmutes just the soundtrack (effects stay on). */
  toggleMusic(): boolean { this.musicOn = !this.musicOn; this.syncMusic(); return this.musicOn; }

  private syncMusic(): void {
    if (!this.music) return;
    if (this.enabled && this.musicOn) this.music.start(); else this.music.stop();
  }

  /** Set the world-sound mute and volume (separate from the soundtrack and the master volume). */
  setSfx(on: boolean, vol: number): void { this.sfxOn = on; this.sfxVolume = vol; this.dg?.setLevel(on, vol); }

  /** Terrance's voice for the dialogue panel. */
  speak(text: string): void { this.dg?.speak(text, this.getCam(), this.scene); }

  attach(sim: Simulation): void {
    this.unsub?.();
    this.sim = sim;
    this.dg?.attach(sim);
    const offs = [
      sim.bus.on("sound", (s) => { this.play(s.kind, s.x, s.y, s.vol); this.dg?.onSound(s.kind, s.x, s.y, s.vol, this.getCam(), this.scene); }),
      sim.bus.on("say", (s) => { const c = sim.chars[s.id]; if (c?.role === "overcoder") this.dg?.speak(s.text, this.getCam(), this.scene, c); }),
    ];
    this.unsub = () => offs.forEach((f) => f());
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && !this.ctx) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
        const lite = typeof matchMedia === "function" && (matchMedia("(pointer: coarse)").matches || window.innerWidth < 520);
        this.dg = new Diegetic(this.ctx, this.master, lite);
        this.fx = this.dg.input; this.dg.setLevel(this.sfxOn, this.sfxVolume);
        if (this.sim) this.dg.attach(this.sim);
        this.music = new Music(this.ctx, this.master);
        window.addEventListener("keydown", (e) => {
          const t = e.target as HTMLElement | null;
          if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey || t?.closest("input,textarea,select,[contenteditable]")) return;
          this.toggleMusic();
        });
      } catch { this.ctx = null; this.enabled = false; }
    }
    if (this.ctx) on ? this.ctx.resume() : this.ctx.suspend();
    this.syncMusic();
  }

  setVolume(v: number): void { this.volume = v; if (this.master) this.master.gain.value = v; }

  /** Per-frame ambience: the world's sounds, the soundtrack's mood and the party beat near the stage. */
  update(sim: Simulation): void {
    if (!this.enabled || !this.ctx || !this.dg) return;
    this.dg.update(sim, this.getCam(), this.scene);
    if (this.music && this.musicOn) {
      const p = sim.player, hurt = 1 - Math.min(1, p.blood);
      this.music.setMood({
        hour: sim.hour, rain: sim.env.rain, storm: sim.env.weather === "storm",
        tension: Math.min(1, (p.wanted ?? 0) / 4 + (hurt > 0.6 ? (hurt - 0.6) : 0)),
        street: this.getCam().zoom > 3, party: sim.env.party,
      });
    }
    if (sim.env.party) {
      const cam = this.getCam();
      const d = Math.hypot(cam.x - sim.stagePoint.x, cam.y - sim.stagePoint.y);
      const vol = Math.max(0, 1 - d / 30) * 0.5;
      const now = this.ctx.currentTime;
      if (vol > 0.02 && now >= this.beatAt) {
        const step = 60 / 112 / 2; // 112 bpm, eighth notes
        const n = Math.round(now / step) % 8;
        if (n % 4 === 0) this.kick(vol); else if (n % 2 === 0) this.hat(vol * 0.5); else this.hat(vol * 0.25);
        this.beatAt = now + step;
      }
    }
  }

  private out(x: number, y: number, vol: number): { gain: GainNode; at: number } | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    const dest = this.fx ?? this.master;
    const now = this.ctx.currentTime;
    if (now - this.recentT > 0.1) { this.recentT = now; this.recent = 0; }
    if (++this.recent > 8) return null; // rate limit
    const cam = this.getCam();
    const d = Math.hypot(x - cam.x, y - cam.y);
    const att = Math.max(0, 1 - d / (22 / Math.max(0.5, cam.zoom)));
    if (att <= 0.01) return null;
    const gain = this.ctx.createGain(); gain.gain.value = vol * att;
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, ((x - y) - (cam.x - cam.y)) / 12)); gain.connect(pan); pan.connect(dest); }
    else gain.connect(dest);
    return { gain, at: now };
  }

  private tone(o: { gain: GainNode; at: number }, type: OscillatorType, f0: number, f1: number, dur: number): void {
    const ctx = this.ctx!, osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, o.at); osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), o.at + dur);
    env.gain.setValueAtTime(0.0001, o.at); env.gain.exponentialRampToValueAtTime(0.5, o.at + 0.008); env.gain.exponentialRampToValueAtTime(0.0001, o.at + dur);
    osc.connect(env); env.connect(o.gain); osc.start(o.at); osc.stop(o.at + dur + 0.02);
  }

  private noise(o: { gain: GainNode; at: number }, dur: number, freq: number): void {
    const ctx = this.ctx!, n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
    src.connect(f); f.connect(o.gain); src.start(o.at);
  }

  play(kind: string, x: number, y: number, vol: number): void {
    const o = this.out(x, y, vol * 0.6);
    if (!o) return;
    const mat = kind.split("_")[1] ?? "";
    const pitch: Record<string, number> = { rubber: 320, foam: 180, plush: 120, plastic: 520, wood: 220, cardboard: 260 };
    // gunfire: a sharp crack of noise plus a low thump; shotguns boom, SMGs snap; reloads click; ricochets whine
    if (kind === "bang" || kind === "bang_shotgun" || kind === "bang_smg") { this.noise(o, kind === "bang_shotgun" ? 0.28 : kind === "bang_smg" ? 0.06 : 0.14, kind === "bang_shotgun" ? 700 : 2600); this.tone(o, "triangle", kind === "bang_shotgun" ? 90 : 140, 40, kind === "bang_smg" ? 0.05 : 0.12); return; }
    if (kind === "reload") { this.tone(o, "square", 900, 700, 0.03); this.tone(o, "square", 600, 500, 0.04); return; }
    if (kind === "ricochet") { this.tone(o, "sine", 2400, 900, 0.18); return; }
    if (kind.startsWith("hit_")) { this.tone(o, "sine", (pitch[mat] ?? 300) * 1.2, (pitch[mat] ?? 300) * 0.5, 0.12); this.noise(o, 0.06, 1200); }
    else if (kind.startsWith("bounce_") || kind.startsWith("clack_")) this.tone(o, "sine", pitch[mat] ?? 300, (pitch[mat] ?? 300) * 0.7, 0.07);
    else if (kind.startsWith("break_")) this.noise(o, 0.25, 900);
    else if (kind === "thud") this.tone(o, "triangle", 110, 60, 0.1);
    else if (kind === "whoosh" || kind === "swish") this.noise(o, 0.12, kind === "swish" ? 2500 : 1600);
    else if (kind === "twang") this.tone(o, "triangle", 440, 220, 0.15);
    else if (kind === "boing") this.tone(o, "sine", 180, 720, 0.25);
    else if (kind === "pickup") this.tone(o, "square", 660, 880, 0.04);
    else if (kind === "kick") this.tone(o, "sine", 150, 80, 0.08);
  }

  private kick(vol: number): void { const o = this.outAt(vol); if (o) this.tone(o, "sine", 120, 40, 0.18); }
  private hat(vol: number): void { const o = this.outAt(vol); if (o) this.noise(o, 0.03, 7000); }
  private outAt(vol: number): { gain: GainNode; at: number } | null {
    if (!this.ctx || !this.master) return null;
    const gain = this.ctx.createGain(); gain.gain.value = vol; gain.connect(this.fx ?? this.master);
    return { gain, at: this.ctx.currentTime };
  }
}
