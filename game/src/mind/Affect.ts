import type { Character, Personality } from "../entities/types";
import type { Mind, EmotionName } from "./Mind";

/**
 * Affect and appraisal.
 *  - Core affect (Russell, 1980): all feeling is a point in valence (unpleasant..pleasant) x arousal (calm..activated).
 *  - Appraisal (Lazarus 1991 / OCC, Ortony-Clore-Collins 1988): an event is judged on goal relevance, goal congruence,
 *    coping potential (control) and blame; the pattern selects a NAMED emotion (anger = blamed other + high control,
 *    fear = threat + low control, shame = blamed self ...).
 *  - Mood decays toward a personality baseline (extraverts sit higher, neurotics lower and more aroused, and
 *    neurotics recover slower). Nothing here touches the DOM or Math.random.
 */

/** Big Five (OCEAN) derived from the game's trait vector, so the two models can never disagree. 0..1 each. */
export interface Ocean { o: number; c: number; e: number; a: number; n: number }
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export function ocean(p: Personality): Ocean {
  return {
    o: cl(p.curiosity * 0.7 + p.playfulness * 0.3),
    c: cl(p.honesty * 0.45 + (1 - p.temper) * 0.3 + (1 - p.playfulness) * 0.25),
    e: cl(p.sociability * 0.65 + p.boldness * 0.35),
    a: cl(p.kindness * 0.6 + (1 - p.temper) * 0.4),
    n: cl(p.temper * 0.4 + (1 - p.boldness) * 0.45 + (1 - p.sociability) * 0.15),
  };
}

/** Personality-dependent resting point of core affect (Costa & McCrae: E raises baseline valence, N lowers it). */
export function baseline(p: Personality): { val: number; aro: number } {
  const b = ocean(p);
  return { val: cl(0.1 + 0.4 * (b.e - 0.5) - 0.45 * (b.n - 0.5) + 0.15 * (b.a - 0.5), -1, 1), aro: cl(0.3 + 0.2 * (b.e - 0.5) + 0.25 * (b.n - 0.5)) };
}

export interface Appraisal {
  /** how much the event matters to this person's goals, 0..1 */
  rel: number;
  /** congruence with their goals: -1 harmful .. +1 helpful */
  cong: number;
  /** perceived coping potential 0..1 */
  ctrl: number;
  /** who is responsible */
  blame: "self" | "other" | "none";
  /** the event was physically painful */
  pain?: boolean;
}

/** Appraise an event: shifts core affect and picks the named emotion (held for ~a game hour). */
export function appraise(c: Character, tick: number, ev: Appraisal): EmotionName {
  const m = c.mind, b = ocean(c.pers);
  // neurotics feel negative events harder; extraverts feel positive ones harder (reactivity)
  const gain = ev.cong < 0 ? 0.6 + 0.5 * b.n : 0.6 + 0.4 * b.e;
  m.val = cl(m.val + ev.cong * ev.rel * gain, -1, 1);
  m.aro = cl(m.aro + ev.rel * (0.25 + 0.3 * Math.abs(ev.cong)) + (ev.pain ? 0.25 : 0));
  let e: EmotionName;
  if (ev.pain) e = "hurt";
  else if (ev.cong < -0.1) e = ev.blame === "other" ? (ev.ctrl > 0.4 ? "angry" : "afraid") : ev.blame === "self" ? "ashamed" : ev.ctrl < 0.4 ? "anxious" : "sad";
  else if (ev.cong > 0.1) e = m.val < -0.05 ? "relieved" : ev.blame === "self" ? "proud" : ev.rel > 0.5 ? "joyful" : "content";
  else e = "neutral";
  m.emotion = e; m.emoUntil = tick + 3600;
  return e;
}

/** Name the felt state from core affect alone (used when no appraised emotion is being held). */
export function nameAffect(val: number, aro: number): EmotionName {
  if (aro > 0.55) return val > 0.35 ? "excited" : val < -0.3 ? "anxious" : "neutral";
  if (val > 0.4) return "joyful";
  if (val > 0.15) return aro < 0.3 ? "calm" : "content";
  if (val < -0.35) return aro < 0.35 ? "sad" : "anxious";
  if (aro < 0.15 && val < 0.1) return "bored";
  return "neutral";
}

/** Relax core affect toward baseline and refresh the named emotion. `dt` in seconds. */
export function relaxAffect(c: Character, tick: number, dt: number): void {
  const m = c.mind, b = ocean(c.pers), base = baseline(c.pers);
  // burnout drags the baseline down (Maslach); the sum of felt fear/frustration feeds arousal
  const target = base.val - 0.3 * m.burnout - 0.25 * c.emo.frustration - 0.2 * c.emo.fear + 0.35 * c.emo.mood;
  const tv = 60 + 90 * b.n, ta = 25;
  m.val = cl(m.val + (cl(target, -1, 1) - m.val) * (1 - Math.exp(-dt / tv)), -1, 1);
  m.aro = cl(m.aro + (cl(base.aro + 0.6 * c.emo.fear + 0.4 * c.emo.frustration) - m.aro) * (1 - Math.exp(-dt / ta)));
  if (tick >= m.emoUntil) m.emotion = nameAffect(m.val, m.aro);
}

/**
 * Yerkes-Dodson (1908): performance is an inverted-U in arousal, and the optimum is lower for complex tasks.
 * Returns 0..1 where 1 = ideal arousal for the task.
 */
export function performance(aro: number, complex: boolean): number {
  const opt = complex ? 0.3 : 0.55, w = complex ? 0.35 : 0.5;
  const d = (aro - opt) / w;
  return Math.max(0, 1 - d * d);
}

/** How each named emotion tilts each goal (multiplier on utility). Missing = 1. */
const EMOTION_GOALS: Partial<Record<EmotionName, Record<string, number>>> = {
  angry: { fight: 1.35, prank: 1.25, tag: 1.15, reconcile: 0.7, help: 0.8, socialize: 0.9, flirt: 0.8, treat: 0.8 },
  afraid: { gohome: 1.3, shelter: 1.4, home: 1.2, wander: 0.7, fight: 0.5, steal: 0.6, mug: 0.6, party: 0.7, gamble: 0.8 },
  anxious: { gohome: 1.15, shelter: 1.2, home: 1.1, rest: 1.1, fight: 0.7, steal: 0.7, party: 0.85 },
  sad: { socialize: 1.15, treat: 1.3, gift: 1.1, rest: 1.2, party: 0.8, play: 0.8, fight: 0.9, flirt: 0.85 },
  hurt: { rest: 1.3, gohome: 1.2, treat: 1.2, fight: 0.8, play: 0.8 },
  ashamed: { gohome: 1.2, socialize: 0.8, party: 0.7, flirt: 0.7 },
  joyful: { party: 1.3, socialize: 1.2, play: 1.25, music: 1.2, busk: 1.2, gift: 1.2, flirt: 1.2, help: 1.15, fight: 0.7, mug: 0.7 },
  excited: { party: 1.25, play: 1.2, skate: 1.2, flirt: 1.15, gamble: 1.15, socialize: 1.1 },
  proud: { busk: 1.2, music: 1.15, photograph: 1.15, socialize: 1.1 },
  relieved: { rest: 1.1, socialize: 1.1 },
  bored: { wander: 1.3, shop: 1.3, play: 1.2, skate: 1.2, prank: 1.15, gamble: 1.15, tag: 1.1, photograph: 1.1 },
  calm: { rest: 1.05, home: 1.05, music: 1.05 },
};
export const emotionBias = (e: EmotionName, goal: string): number => EMOTION_GOALS[e]?.[goal] ?? 1;

/** Goals whose execution is cognitively demanding (low optimal arousal under Yerkes-Dodson). */
export const COMPLEX_GOALS = new Set(["craft", "photograph", "steal", "mug", "book", "barter", "music", "busk", "work", "date", "reclaim", "search"]);
