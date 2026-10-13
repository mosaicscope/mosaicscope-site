// Deterministic scoring and the learning that changes it.
//
// What is learned, and where it is used:
//   stats.kinds[kind] / stats.fixes[kind:id]  landed vs failed (decaying)  -> priority and proposal score
//   stats.kinds[kind].effect                  measured before/after change -> priority (fixes that don't move
//                                                                             the numbers sink; ones that do rise)
//   agents[a].areas[area]                     each agent's own record       -> that agent's own picks (strategy)
//   agents[a].elo                             head-to-head rating           -> tie-breaks between the agents
// Nothing here is reported by the agents themselves: every number comes from CI, merges or probes.

import { ruleByKind } from "./rules.js";

// How much each criterion is worth. Complexity and regression risk count against a proposal.
export const WEIGHTS = { benefit: 3, perf: 2, a11y: 2, rel: 1.5, complexity: -1.5, risk: -3 };
const HALF_LIFE_MS = 14 * 24 * 3600 * 1000; // old outcomes count half after two weeks
const SEVERITY_WEIGHT = { critical: 4, high: 2, medium: 1.3, low: 1 };

/** Outcome counts faded by age, so the engine can change its mind as the site changes. */
export function decayed(st, now) {
  if (!st) return { ok: 0, fail: 0 };
  if (st.at == null || !now) return st;
  const k = Math.pow(0.5, Math.max(0, now - st.at) / HALF_LIFE_MS);
  return { ...st, ok: (st.ok || 0) * k, fail: (st.fail || 0) * k };
}

/** Learned multiplier from outcome counts: 1.0 with no history, toward 2 for reliable, toward 0 for failing. */
export function learned(st, now) {
  const d = decayed(st, now);
  return ((d.ok + 1) / (d.ok + d.fail + 2)) * 2;
}
/** A remedy that failed three times without ever landing is retired; so is one measured as useless 3 times. */
export function retired(st) {
  return ((st?.fail || 0) >= 3 && !(st?.ok > 0)) || ((st?.flat || 0) >= 3 && !((st?.effect || 0) > 0));
}

export const fixKey = (kind, id) => `${kind}:${id}`;

/** Priority of a finding: rule weight x learned success x measured effect x audit focus x severity. */
export function priority(finding, state, now) {
  const rule = ruleByKind(finding.kind);
  const k = state.stats.kinds[finding.kind];
  const effect = 1 + 0.5 * Math.max(-1, Math.min(1, k?.effect || 0));
  return (rule?.weight || 1) * learned(k, now) * effect * auditBoost(rule?.area, state.audit) * (SEVERITY_WEIGHT[finding.severity] || 1);
}

/**
 * The weekly speed audit (Lighthouse on the live site) pushes up whichever area it scores lowest:
 * x1.5 when an area is under its bar, x2 when it's well under.
 */
export function auditBoost(area, audit) {
  const sc = audit?.scores;
  if (!sc) return 1;
  const v = { perf: sc.performance, a11y: sc.accessibility, ux: sc.accessibility, seo: sc.seo, rel: sc.bestPractices }[area];
  if (typeof v !== "number") return 1;
  return v < 0.7 ? 2 : v < 0.9 ? 1.5 : 1;
}

/** Score of one proposal (finding + remedy), the number both agents compete on. */
export function scoreProposal(finding, remedy, state, now) {
  const rule = ruleByKind(finding.kind);
  let base = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) base += w * (remedy.meta[k] || 0);
  base += 2 * (rule?.weight || 1);
  return round(Math.max(0, base) * learned(state.stats.kinds[finding.kind], now) * learned(state.stats.fixes[fixKey(finding.kind, remedy.id)], now));
}

/** Points an agent earns or loses for an outcome (capped, so no single result can be farmed). */
export function reward(outcome, score, risk) {
  if (outcome === "accepted") return Math.min(15, Math.max(1, Math.round(score)));
  if (outcome === "regression") return -10;
  if (outcome === "perf-regression") return -5;
  if (outcome === "rejected") return -(5 + 3 * (risk || 0));
  return 0;
}

function bump(st, good, now) {
  const d = decayed(st, now);
  st.ok = round(d.ok + (good ? 1 : 0));
  st.fail = round(d.fail + (good ? 0 : 1));
  st.at = now;
}

/** Record an outcome: counts, agent points and ratings, dedupe entry and the failure streak. */
export function recordOutcome(state, p, outcome, now, note = "") {
  const k = (state.stats.kinds[p.kind] ||= { ok: 0, fail: 0 });
  const f = (state.stats.fixes[fixKey(p.kind, p.remedy)] ||= { ok: 0, fail: 0 });
  const good = outcome === "accepted";
  bump(k, good, now);
  bump(f, good, now);
  state.failStreak = good ? 0 : state.failStreak + 1;
  const a = state.agents[p.agent];
  if (a) {
    a.points += reward(outcome, p.score, p.risk);
    if (good) a.accepted++; else if (outcome === "regression" || outcome === "perf-regression") a.regressions++; else a.rejected++;
    const ar = ((a.areas ||= {})[p.area || ruleByKind(p.kind)?.area || "other"] ||= { ok: 0, fail: 0 });
    bump(ar, good, now);
    if (p.rival && state.agents[p.rival]) elo(state, good ? p.agent : p.rival, good ? p.rival : p.agent, good ? 1 : 0.5);
  }
  state.seen[`${p.fp}#${p.remedy}`] = { at: now, outcome };
  state.history.unshift({ at: now, kind: p.kind, path: p.path, remedy: p.remedy, label: p.label, agent: p.agent, score: p.score, outcome, note, ref: p.ref || "", sha: p.sha || "", url: p.url || "", area: p.area || "", before: p.before ?? null });
}

/** Head-to-head rating. A landed change is a full win for its agent; a rejected one half a win for the rival. */
export function elo(state, winner, loser, weight = 1) {
  const W = state.agents[winner], L = state.agents[loser];
  W.elo ??= 1000; L.elo ??= 1000;
  const e = 1 / (1 + Math.pow(10, (L.elo - W.elo) / 400));
  const d = Math.round(24 * weight * (1 - e));
  W.elo += d; L.elo -= d;
}

/**
 * A measured effect for an accepted change, from probes before and after it.
 * The metric is "lower is better". Returns -1 (worse), 0 (no change), 1 (better).
 */
export function recordEffect(state, item, before, after, now) {
  if (before == null || after == null) return null;
  const sign = after < before - 1e-9 ? 1 : after > before + 1e-9 ? -1 : 0;
  const k = (state.stats.kinds[item.kind] ||= { ok: 0, fail: 0 });
  k.effect = round(0.7 * (k.effect || 0) + 0.3 * sign);
  k.measured = (k.measured || 0) + 1;
  const f = (state.stats.fixes[fixKey(item.kind, item.remedy)] ||= { ok: 0, fail: 0 });
  f.flat = sign === 0 ? (f.flat || 0) + 1 : 0;
  f.effect = round(0.7 * (f.effect || 0) + 0.3 * sign);
  item.measured = { before, after, sign, at: now };
  return sign;
}

export const round = (n) => Math.round(n * 100) / 100;
