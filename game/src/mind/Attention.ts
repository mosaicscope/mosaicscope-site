const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/**
 * Attention budget (ported from Acacia m11 "budget arbiter"). Idle-driven subsystems ask here for capacity
 * instead of each keeping its own timer. Driven by sim ticks (60 per second), so runs stay deterministic.
 */
export interface AttentionState { budget: number; last: number; gaps: Record<string, number>; focus?: string }

export const BUDGET_MAX = 1;
const REFILL_PER_SEC = 0.1;
const TICKS_PER_SEC = 60;
export const ATTN_COSTS: Record<string, number> = { social: 0.4, reflect: 0.25, plan: 0.15, inner: 0.3, dream: 0.5 };
export const ATTN_GAPS: Record<string, number> = { social: 480 * TICKS_PER_SEC, reflect: 60 * TICKS_PER_SEC, plan: 20 * TICKS_PER_SEC, inner: 45 * TICKS_PER_SEC, dream: 90 * TICKS_PER_SEC };

export function newAttention(): AttentionState { return { budget: BUDGET_MAX, last: 0, gaps: {} }; }

export function refillAttention(a: AttentionState, tick: number): void {
  const dt = Math.max(0, tick - a.last);
  a.last = tick;
  a.budget = clamp(a.budget + dt * (REFILL_PER_SEC / TICKS_PER_SEC), 0, BUDGET_MAX);
}

/** True if subsystem may run now. A grant spends budget and starts that subsystem's cooldown. */
export function requestAttention(a: AttentionState, tick: number, sub: string, importance = 0.5): boolean {
  const gap = ATTN_GAPS[sub] ?? 45 * TICKS_PER_SEC;
  const last = a.gaps[sub] ?? -Infinity;
  if (tick - last < gap) return false;
  const price = (ATTN_COSTS[sub] ?? 0.3) * clamp(1.25 - importance, 0.5, 1.25);
  if (a.budget < price) return false;
  a.budget -= price;
  a.gaps[sub] = tick;
  return true;
}

/** Which unmet need currently holds attention (the most pressing one under 0.5), or "none". */
export function pickFocus(c: { needs: { energy: number; social: number; fun: number }; hunger: number; cash: number }): string {
  const cands: [string, number][] = [["energy", c.needs.energy], ["social", c.needs.social], ["fun", c.needs.fun], ["hunger", c.hunger], ["cash", Math.min(1, c.cash / 40)]];
  let best = "none", bestV = 0.5;
  for (const [k, v] of cands) if (v < bestV) { best = k; bestV = v; }
  return best;
}

/** Goals that answer each focused need. Used by Mind.goalBias. */
export const FOCUS_GOALS: Record<string, string[]> = {
  energy: ["rest", "gohome", "home"], social: ["socialize", "party", "date", "gift"], fun: ["play", "party", "skate", "tag"],
  hunger: ["eat"], cash: ["work", "busk"],
};
