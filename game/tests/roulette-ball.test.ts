import { describe, expect, it } from 'vitest';
import { planBall, BALL_R } from '../src/ui/RouletteBallPhysics';
import { WHEEL_ORDER } from '../src/casino/roulette';

const N = 37, STEP = (Math.PI * 2) / N;
const wheel = (dur: number, W0: number, wTot: number) => ({
  W: (t: number) => W0 + wTot * (1 - Math.pow(1 - Math.min(t / dur, 1), 2.2)),
  Wd: (t: number) => { const u = Math.min(t / dur, 1); return u >= 1 ? 0 : wTot * 2.2 * Math.pow(1 - u, 1.2) / dur; },
});

describe('roulette ball physics', () => {
  it('always ends at rest in the decided pocket, for every number and spin length', () => {
    for (const dur of [3, 5, 8]) for (let i = 0; i < N; i++) {
      const plan = planBall({ target: i, dur, N, STEP, ...wheel(dur, 1.3, 12 + (i % 5)), seed: i * 7919 + dur });
      expect(plan.pocket).toBe(i);
      expect(plan.restSpeed).toBeLessThan(.5);
    }
  });

  it('tumbles for real: drops late, bounces on frets and deflectors, stays on the wheel and never goes through the floor', () => {
    const dur = 7, plan = planBall({ target: WHEEL_ORDER.indexOf(17), dur, N, STEP, ...wheel(dur, 0, 14), seed: 42 });
    expect(plan.dropAt).toBeGreaterThan(dur * .3);
    expect(plan.dropAt).toBeLessThan(dur * .8);
    expect(plan.events.filter(e => e.kind === 'fret').length).toBeGreaterThanOrEqual(2);
    expect(plan.events.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < plan.n; i++) {
      expect(Number.isFinite(plan.th[i] + plan.r[i] + plan.y[i])).toBe(true);
      expect(plan.r[i]).toBeGreaterThan(2.4);
      expect(plan.r[i]).toBeLessThan(4.7);
      expect(plan.y[i]).toBeGreaterThan(BALL_R * .9);
    }
  });

  it('moves smoothly: no sample jumps further than the ball can travel in one step', () => {
    const dur = 6, plan = planBall({ target: 5, dur, N, STEP, ...wheel(dur, 0, 14), seed: 9 });
    for (let i = 1; i < plan.n; i++) {
      const step = Math.hypot(plan.r[i] * Math.cos(plan.th[i]) - plan.r[i - 1] * Math.cos(plan.th[i - 1]), plan.r[i] * Math.sin(plan.th[i]) - plan.r[i - 1] * Math.sin(plan.th[i - 1]));
      expect(step).toBeLessThan(.6);
    }
  });
});
