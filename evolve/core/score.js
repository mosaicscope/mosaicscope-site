// Deterministic scoring and the learning that changes it.
// Every outcome updates success counts per check kind and per remedy; those counts multiply
// future priorities and proposal scores, so the engine drifts toward fixes that land and away
// from ones that fail CI or get rejected.

import { ruleByKind } from "./rules.js";

// How much each criterion is worth. Complexity and regression risk count against a proposal.
export const WEIGHTS = { benefit: 3, perf: 2, a11y: 2, rel: 1.5, complexity: -1.5, risk: -3 };

/** Learned multiplier from outcome counts: 1.0 with no history, toward 2 for reliable, toward 0 for failing. */
export function learned(st) {
  const ok = st?.ok || 0, fail = st?.fail || 0;
  return ((ok + 1) / (ok + fail + 2)) * 2;
}
/** A remedy that failed three times without ever landing is retired. */
export function retired(st) {
  return (st?.fail || 0) >= 3 && !(st?.ok > 0);
}

export const fixKey = (kind, id) => `${kind}:${id}`;

/** Priority of a finding: rule weight times what we've learned about that kind of fix. */
export function priority(finding, state) {
  const rule = ruleByKind(finding.kind);
  return (rule?.weight || 1) * learned(state.stats.kinds[finding.kind]);
}

/** Score of one proposal (finding + remedy), the number both agents compete on. */
export function scoreProposal(finding, remedy, state) {
  const rule = ruleByKind(finding.kind);
  let base = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) base += w * (remedy.meta[k] || 0);
  base += 2 * (rule?.weight || 1);
  return round(Math.max(0, base) * learned(state.stats.kinds[finding.kind]) * learned(state.stats.fixes[fixKey(finding.kind, remedy.id)]));
}

/** Points an agent earns or loses for an outcome. */
export function reward(outcome, score, risk) {
  if (outcome === "accepted") return Math.max(1, Math.round(score));
  if (outcome === "regression") return -10;
  if (outcome === "rejected") return -(5 + 3 * (risk || 0));
  return 0;
}

/** Record an outcome: counts, agent points, dedupe entry and the failure streak. */
export function recordOutcome(state, p, outcome, now, note = "") {
  const k = (state.stats.kinds[p.kind] ||= { ok: 0, fail: 0 });
  const f = (state.stats.fixes[fixKey(p.kind, p.remedy)] ||= { ok: 0, fail: 0 });
  const good = outcome === "accepted";
  if (good) { k.ok++; f.ok++; state.failStreak = 0; } else { k.fail++; f.fail++; state.failStreak++; }
  const a = state.agents[p.agent];
  if (a) {
    a.points += reward(outcome, p.score, p.risk);
    if (good) a.accepted++; else if (outcome === "regression") a.regressions++; else a.rejected++;
  }
  state.seen[`${p.fp}#${p.remedy}`] = { at: now, outcome };
  state.history.unshift({ at: now, kind: p.kind, path: p.path, remedy: p.remedy, label: p.label, agent: p.agent, score: p.score, outcome, note, ref: p.ref || "" });
}

export const round = (n) => Math.round(n * 100) / 100;
