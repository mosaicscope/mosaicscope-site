/**
 * What using things indoors does to you. Pure: takes the player's numbers, changes them, returns
 * the toast. The overlay owns cooldowns; this owns the rules, so tests can pin them down.
 */
import type { Effect } from "./interiors";
import type { Character } from "../entities/types";

type Body = Pick<Character, "cash" | "hunger" | "needs" | "emo" | "bleed" | "reputation">;
export interface EffectCtx { wage: number; worksHere: boolean; cost?: number }
export interface EffectResult { ok: boolean; toast: string; tone?: string; cooldown: number }

const up = (v: number, d: number): number => Math.max(0, Math.min(1, v + d));
const upM = (v: number, d: number): number => Math.max(-1, Math.min(1, v + d));
const money = (n: number): string => `$${n % 1 ? n.toFixed(2) : n}`;

export function applyEffect(e: Effect, p: Body, ctx: EffectCtx): EffectResult {
  const cost = ctx.cost ?? 0;
  if (cost > 0 && p.cash < cost) return { ok: false, toast: `Needs ${money(cost)}. You're short.`, tone: "red", cooldown: 0 };
  p.cash = Math.round((p.cash - cost) * 100) / 100;
  const paid = cost > 0 ? `-${money(cost)}. ` : "";
  const n = p.needs, m = p.emo;
  switch (e) {
    case "treat": p.bleed = 0; m.composure = 1; m.fear = up(m.fear, -0.4); return { ok: true, toast: "Patched up. Public healthcare: free.", tone: "acid", cooldown: 25 };
    case "vend": p.hunger = up(p.hunger, 0.15); m.mood = upM(m.mood, 0.08); n.energy = up(n.energy, 0.06); return { ok: true, toast: `${paid}Snack acquired.`, cooldown: 20 };
    case "eat": p.hunger = up(p.hunger, 0.35); m.mood = upM(m.mood, 0.05); return { ok: true, toast: `${paid}Fed. Hunger sorted.`, tone: "acid", cooldown: 30 };
    case "rest": n.energy = up(n.energy, 0.18); m.fear = up(m.fear, -0.2); m.mood = upM(m.mood, 0.04); return { ok: true, toast: "You feel a little better.", tone: "acid", cooldown: 25 };
    case "sit": n.energy = up(n.energy, 0.08); m.mood = upM(m.mood, 0.03); return { ok: true, toast: "Feet up. Energy up.", cooldown: 15 };
    case "cuppa": m.mood = upM(m.mood, 0.07); n.social = up(n.social, 0.05); p.hunger = up(p.hunger, 0.05); return { ok: true, toast: `${paid}A cuppa. Mood up.`, cooldown: 25 };
    case "wash": m.mood = upM(m.mood, 0.06); m.fear = up(m.fear, -0.1); n.energy = up(n.energy, 0.05); return { ok: true, toast: "Fresh as. Mood up.", tone: "acid", cooldown: 40 };
    case "workout": n.energy = up(n.energy, -0.1); n.fun = up(n.fun, 0.08); m.confidence = up(m.confidence, 0.06); p.hunger = up(p.hunger, -0.06); return { ok: true, toast: "Pump. Confidence up, energy down.", cooldown: 30 };
    case "play": n.fun = up(n.fun, 0.2); m.mood = upM(m.mood, 0.05); return { ok: true, toast: `${paid}Fun up.`, cooldown: 15 };
    case "music": n.fun = up(n.fun, 0.1); m.mood = upM(m.mood, 0.05); return { ok: true, toast: `${paid}Good track. Fun up.`, cooldown: 20 };
    case "dance": n.fun = up(n.fun, 0.18); n.social = up(n.social, 0.08); n.energy = up(n.energy, -0.06); return { ok: true, toast: "You dance. Fun and social up.", tone: "acid", cooldown: 15 };
    case "browse": n.curiosity = up(n.curiosity, 0.18); n.fun = up(n.fun, 0.04); return { ok: true, toast: "Curiosity scratched.", cooldown: 15 };
    case "read": n.curiosity = up(n.curiosity, 0.15); n.energy = up(n.energy, 0.03); return { ok: true, toast: "A good read. Curiosity up.", cooldown: 20 };
    case "work": {
      if (n.energy < 0.15) { return { ok: false, toast: "Too knackered to work. Rest first.", tone: "red", cooldown: 0 }; }
      const pay = Math.round(ctx.wage * (ctx.worksHere ? 1.25 : 0.8));
      p.cash += pay; n.energy = up(n.energy, -0.15); p.hunger = up(p.hunger, -0.1); p.reputation = Math.max(-1, Math.min(1, p.reputation + 0.01));
      return { ok: true, toast: `Shift done: +${money(pay)}${ctx.worksHere ? " (your workplace, full rate)" : ""}. Tired now.`, tone: "acid", cooldown: 90 };
    }
  }
}
