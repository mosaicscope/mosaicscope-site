/**
 * Fixed-step simulation clock with an accumulator. Rendering runs at display rate; the simulation
 * advances in exact `step` increments so physics and AI never depend on frame rate.
 */
export interface ClockOptions {
  /** Simulation step in seconds (default 1/60). */
  step?: number;
  /** Max simulation steps per frame before we drop time (spiral-of-death guard). */
  maxStepsPerFrame?: number;
}

export class SimulationClock {
  readonly step: number;
  readonly maxStepsPerFrame: number;
  speed = 1;
  /** Transient multiplier on `speed` (the golden-minute slow-mo); 1 means no effect. */
  timeScale = 1;
  paused = false;
  tick = 0;
  private acc = 0;
  /** Simulated seconds dropped because the machine could not keep up. */
  droppedSeconds = 0;

  constructor(opts: ClockOptions = {}) {
    this.step = opts.step ?? 1 / 60;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 8;
  }

  /**
   * Feed real elapsed seconds; returns how many fixed steps to run now.
   * `alpha` (0..1) afterwards says how far we are between the last and next step, for interpolation.
   */
  advance(realDt: number): number {
    if (this.paused) return 0;
    const dt = Math.min(Math.max(realDt, 0), 0.25) * this.speed * this.timeScale;
    this.acc += dt;
    let steps = Math.floor(this.acc / this.step);
    if (steps > this.maxStepsPerFrame) {
      this.droppedSeconds += (steps - this.maxStepsPerFrame) * this.step;
      this.acc -= (steps - this.maxStepsPerFrame) * this.step;
      steps = this.maxStepsPerFrame;
    }
    this.acc -= steps * this.step;
    this.tick += steps;
    return steps;
  }

  get alpha(): number { return this.acc / this.step; }
}
