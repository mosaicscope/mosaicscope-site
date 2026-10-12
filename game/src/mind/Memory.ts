import type { Character, Memory } from "../entities/types";

/**
 * Forgetting and rehearsal.
 *  - Ebbinghaus (1885): retention R = exp(-age / S). Each rehearsal lengthens the stability S (spaced retrieval).
 *  - Flashbulb / emotional enhancement (Brown & Kulik 1977; McGaugh): strongly valenced events get a much larger S,
 *    so a scalding coffee is remembered for days while a shrug is gone by tomorrow.
 * This sweeps the existing `Character.memories` list rather than adding a second store.
 */
const TPH = 3600;
/** Base stability of a neutral memory: six game hours. */
export const BASE_STABILITY = 6 * TPH;

/** Stability in ticks: grows with emotional intensity (up to ~x7) and with every rehearsal. */
export function stability(m: Memory): number {
  const a = Math.abs(m.val);
  const emo = 1 + 4 * a * a + (a >= 0.7 ? 2 : 0);
  return BASE_STABILITY * emo * (1 + 0.6 * (m.rep ?? 0)) * (0.6 + 0.4 * m.cred);
}

/** Retention 0..1 at `tick`; age counts from the last recall or the event itself. */
export function retention(m: Memory, tick: number): number {
  const last = Math.max(m.t, m.rec ?? 0);
  return Math.exp(-Math.max(0, tick - last) / stability(m));
}

/** Recalling something strengthens it (rehearsal). */
export function rehearse(m: Memory, tick: number): void {
  m.rep = Math.min(12, (m.rep ?? 0) + 1);
  m.rec = tick;
}

/** Rehearse everything the person knows about `subj` (e.g. while talking with them). */
export function rehearseAbout(c: Character, subj: number, tick: number): number {
  let n = 0;
  for (const m of c.memories) if (m.subj === subj || m.obj === subj) { rehearse(m, tick); n++; }
  return n;
}

/** Drop memories that have faded below the recall threshold. Returns how many were forgotten. */
export function sweepMemories(c: Character, tick: number, threshold = 0.03): number {
  let w = 0;
  const ms = c.memories;
  for (let i = 0; i < ms.length; i++) if (retention(ms[i], tick) >= threshold) ms[w++] = ms[i];
  const dropped = ms.length - w;
  ms.length = w;
  return dropped;
}

/** Number of memories still sharply recalled (R > 0.5). */
export function vividCount(c: Character, tick: number): number {
  let n = 0;
  for (const m of c.memories) if (retention(m, tick) > 0.5) n++;
  return n;
}
