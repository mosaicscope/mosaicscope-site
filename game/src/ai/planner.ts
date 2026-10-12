import { Step } from "../entities/types";

/**
 * Small goal-oriented action planner (GOAP) for principal characters. World facts are bits; operators
 * have preconditions, effects, a cost and a step generator. A* over fact-sets finds the cheapest
 * operator sequence that satisfies the goal. With ~10 operators and depth <= 5 this is microseconds.
 */
export const F = {
  HAS_MELEE: 1 << 0,
  HAS_THROW: 1 << 1,
  HAS_BOW: 1 << 2,
  HAS_COMFORT: 1 << 3,
  NEAR_TARGET: 1 << 4,
  IN_RANGE: 1 << 5,
  SEES_MELEE_TOY: 1 << 6,
  SEES_THROW_TOY: 1 << 7,
  SEES_BOW_TOY: 1 << 8,
  SEES_COMFORT_TOY: 1 << 9,
  TARGET_HIT: 1 << 10,
  TARGET_COMFORTED: 1 << 11,
  TARGET_GIFTED: 1 << 12,
  TALKED: 1 << 13,
  HAS_ANY_TOY: 1 << 14,
} as const;

export interface PlanContext {
  /** world toys the operators may bind to */
  meleeToy: number; throwToy: number; bowToy: number; comfortToy: number;
  toyDist: (id: number) => number;
  targetDist: number;
  target: number;
  boldness: number;
}

export interface Operator {
  name: string;
  pre: number;
  eff: number;
  /** Facts the operator removes (e.g. throwing loses the toy). */
  del?: number;
  cost(ctx: PlanContext): number;
  steps(ctx: PlanContext): Step[];
}

export const OPERATORS: Operator[] = [
  { name: "grab_melee", pre: F.SEES_MELEE_TOY, eff: F.HAS_MELEE | F.HAS_ANY_TOY, del: F.NEAR_TARGET | F.IN_RANGE,
    cost: (c) => 1 + c.toyDist(c.meleeToy) * 0.25, steps: (c) => [{ kind: "pickup", toy: c.meleeToy }] },
  { name: "grab_throwable", pre: F.SEES_THROW_TOY, eff: F.HAS_THROW | F.HAS_ANY_TOY, del: F.NEAR_TARGET | F.IN_RANGE,
    cost: (c) => 1 + c.toyDist(c.throwToy) * 0.25, steps: (c) => [{ kind: "pickup", toy: c.throwToy }] },
  { name: "grab_bow", pre: F.SEES_BOW_TOY, eff: F.HAS_BOW | F.HAS_ANY_TOY, del: F.NEAR_TARGET | F.IN_RANGE,
    cost: (c) => 1.2 + c.toyDist(c.bowToy) * 0.25, steps: (c) => [{ kind: "pickup", toy: c.bowToy }] },
  { name: "grab_comfort", pre: F.SEES_COMFORT_TOY, eff: F.HAS_COMFORT | F.HAS_ANY_TOY, del: F.NEAR_TARGET,
    cost: (c) => 1 + c.toyDist(c.comfortToy) * 0.25, steps: (c) => [{ kind: "pickup", toy: c.comfortToy }] },
  { name: "close_in", pre: 0, eff: F.NEAR_TARGET | F.IN_RANGE,
    cost: (c) => 0.5 + c.targetDist * 0.2, steps: (c) => [{ kind: "approach", target: c.target, dist: 1.1 }] },
  { name: "get_in_range", pre: 0, eff: F.IN_RANGE,
    cost: (c) => 0.3 + Math.max(0, c.targetDist - 6) * 0.2, steps: (c) => [{ kind: "approach", target: c.target, dist: 5.5 }] },
  { name: "swing", pre: F.HAS_MELEE | F.NEAR_TARGET, eff: F.TARGET_HIT,
    cost: (c) => 1.5 - c.boldness * 0.8, steps: (c) => [{ kind: "swing", target: c.target }, { kind: "swing", target: c.target }] },
  { name: "throw", pre: F.HAS_THROW | F.IN_RANGE, eff: F.TARGET_HIT, del: F.HAS_THROW,
    cost: (c) => 1 + c.boldness * 0.3, steps: (c) => [{ kind: "throw", target: c.target }] },
  { name: "shoot", pre: F.HAS_BOW | F.IN_RANGE, eff: F.TARGET_HIT,
    cost: () => 1.1, steps: (c) => [{ kind: "shoot", target: c.target }, { kind: "shoot", target: c.target }] },
  { name: "comfort", pre: F.NEAR_TARGET, eff: F.TARGET_COMFORTED,
    cost: () => 1, steps: (c) => [{ kind: "comfort", target: c.target }] },
  { name: "give", pre: F.HAS_ANY_TOY | F.NEAR_TARGET, eff: F.TARGET_GIFTED, del: F.HAS_COMFORT | F.HAS_ANY_TOY,
    cost: () => 0.8, steps: (c) => [{ kind: "give", target: c.target }] },
  { name: "give_comfort", pre: F.HAS_COMFORT | F.NEAR_TARGET, eff: F.TARGET_GIFTED | F.TARGET_COMFORTED, del: F.HAS_COMFORT | F.HAS_ANY_TOY,
    cost: () => 0.9, steps: (c) => [{ kind: "give", target: c.target }, { kind: "comfort", target: c.target }] },
  { name: "chat", pre: F.NEAR_TARGET, eff: F.TALKED,
    cost: () => 1, steps: (c) => [{ kind: "talk", target: c.target }] },
];

interface Node { facts: number; g: number; f: number; ops: Operator[] }

const popcount = (n: number) => { let c = 0; while (n) { n &= n - 1; c++; } return c; };

/** Returns the cheapest operator list from `start` to a state containing all `goal` bits, or null. */
export function plan(start: number, goal: number, ctx: PlanContext, ops: Operator[] = OPERATORS, maxDepth = 5): { ops: Operator[]; cost: number } | null {
  const open: Node[] = [{ facts: start, g: 0, f: popcount(goal & ~start), ops: [] }];
  const best = new Map<number, number>([[start, 0]]);
  let expansions = 0;
  while (open.length && expansions < 400) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const n = open.splice(bi, 1)[0];
    expansions++;
    if ((n.facts & goal) === goal) return { ops: n.ops, cost: n.g };
    if (n.ops.length >= maxDepth) continue;
    for (const op of ops) {
      if ((n.facts & op.pre) !== op.pre) continue;
      if ((n.facts & op.eff) === op.eff) continue; // no progress
      const facts = (n.facts & ~(op.del ?? 0)) | op.eff;
      const g = n.g + Math.max(0.05, op.cost(ctx));
      if ((best.get(facts) ?? Infinity) <= g) continue;
      best.set(facts, g);
      open.push({ facts, g, f: g + popcount(goal & ~facts) * 0.5, ops: [...n.ops, op] });
    }
  }
  return null;
}

export function planSteps(start: number, goal: number, ctx: PlanContext): Step[] | null {
  const p = plan(start, goal, ctx);
  if (!p) return null;
  const steps: Step[] = [];
  for (const op of p.ops) steps.push(...op.steps(ctx));
  return steps;
}
