/** Optional procedural rain; created only after a user gesture and follows the game's mute setting. */
export class UpgradeAmbience {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  update(enabled: boolean, volume: number): void {
    if (!enabled) { if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); return; }
    if (!this.ctx) {
      this.ctx = new AudioContext(); const ctx = this.ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = buffer; source.loop = true; filter.type = "lowpass"; filter.frequency.value = 1200;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      source.connect(filter); filter.connect(this.gain); this.gain.connect(ctx.destination); source.start();
    }
    this.gain!.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.055, this.ctx.currentTime, 0.2);
  }
}
