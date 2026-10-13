const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/**
 * Falsifiable beliefs (ported from Acacia m13 Hypothesis). A belief predicts a valence outcome for a cue.
 * Status only changes through measured error against what actually happened.
 */
export interface Hyp {
  cue: string; pred: number; tests: number; support: number; refute: number; err: number;
  status: "open" | "supported" | "refuted";
  /** tick the belief was first formed, and a rolling history of [tick, outcome] for each test */
  since: number; hist: [number, number][];
}
export const HYP_HIST = 8;

export const HYP_TOLERANCE = 0.12;
export const HYP_MAX = 12;

/** Find or create the belief for a cue, keeping the list bounded (drops the oldest settled belief first). */
export function hypFor(list: Hyp[], cue: string, prior: number, tick = 0): Hyp {
  const found = list.find((h) => h.cue === cue);
  if (found) return found;
  const h: Hyp = { cue, pred: clamp(prior, -1, 1), tests: 0, support: 0, refute: 0, err: 0, status: "open", since: tick, hist: [] };
  list.push(h);
  if (list.length > HYP_MAX) {
    const drop = list.findIndex((x) => x.status !== "open");
    list.splice(drop >= 0 ? drop : 0, 1);
  }
  return h;
}

/** Test a belief against an observed outcome. Returns the prediction error. */
export function testHyp(h: Hyp, actual: number, tick = 0): number {
  const error = Math.abs(clamp(actual, -1, 1) - h.pred);
  h.hist.push([tick, actual < 0 ? -1 : 1]);
  if (h.hist.length > HYP_HIST) h.hist.shift();
  h.tests++;
  h.err += (error - h.err) * (h.tests < 3 ? 0.5 : 0.2);
  if (error <= HYP_TOLERANCE) { h.support++; h.pred += (actual - h.pred) * 0.15; }
  else h.refute++;
  if (h.tests >= 3) h.status = h.support / h.tests >= 0.6 ? "supported" : h.refute / h.tests >= 0.6 ? "refuted" : "open";
  return error;
}
