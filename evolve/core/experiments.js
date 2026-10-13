// Controlled experiments: several candidate fixes for one problem, each measured in its own isolated
// preview (a git worktree served locally, never the live site), compared on the same deterministic
// scenarios. A candidate is promoted only when the evidence says it's better than doing nothing AND
// better than the alternatives. No visitor traffic is used: there isn't enough of it to be meaningful,
// and synthetic tests don't need anyone's data. No statistics are claimed beyond what was measured.

import { hash } from "./html.js";

/** Same problem, same candidates, same file versions = the same experiment: don't run it twice. */
export const experimentKey = (fp, remedyIds, filesKey) => hash(`${fp}|${[...remedyIds].sort().join(",")}|${filesKey}`);

/**
 * results: [{ remedy, ok, problems, measures: { visual, moved, uiIssues, errors, kb, requests, journeysPass } }]
 * baseline: measures of the unchanged site.
 * Returns { winner, verdict, ranking }.
 */
export function decide(results, baseline) {
  const passed = results.filter((r) => r.ok);
  if (!passed.length) return { winner: null, verdict: "every candidate failed a gate", ranking: [] };
  const better = (m) => (baseline.uiIssues - m.uiIssues) * 10 + (baseline.kb - m.kb) * 0.5 + (baseline.requests - m.requests) * 5 + (m.journeysPass - baseline.journeysPass) * 10 - m.visual * 100 - m.moved * 5;
  const ranking = passed.map((r) => ({ remedy: r.remedy, gain: Math.round(better(r.measures) * 100) / 100, measures: r.measures })).sort((a, b) => b.gain - a.gain || a.measures.visual - b.measures.visual);
  const top = ranking[0];
  if (top.gain <= 0) return { winner: null, verdict: "no candidate measurably beat the current site", ranking };
  if (ranking[1] && ranking[1].gain === top.gain) return { winner: top.remedy, verdict: `tie on gain; picked the smaller visual change`, ranking };
  return { winner: top.remedy, verdict: `measured gain ${top.gain} over the current site`, ranking };
}
