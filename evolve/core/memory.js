// Strategic memory: one ranked, deduplicated backlog of everything the engine knows is wrong or
// worth doing, from every source (static checks, browser probe, security scan, audit). Records that
// stop being observed age out; nothing is ever sent to a model wholesale (agents only see the top 5).

import { ruleByKind } from "./rules.js";
import { priority } from "./score.js";

const DAY = 24 * 3600 * 1000;
const SEV = { critical: 8, high: 4, medium: 2, low: 1 };
export const CONSTRAINTS = [
  "edits only index.html, 404.html, house/, stats/, sitemap.xml and styles.css",
  "one small change at a time, re-validated in CI; CSS append-only",
  "features always wait for a person to approve",
  "never touches functions/, evolve/, .github/, game/, world/, content.json or secrets",
];

/**
 * Merge this cycle's observations into the backlog.
 * sources: { findings (fixable), weaknesses (need a person), issues (probe), security (scan) }.
 * Returns the backlog ranked by value, highest first.
 */
export function updateBacklog(state, sources, now) {
  const map = new Map((state.backlog || []).map((b) => [b.id, b]));
  const seenNow = new Set();
  const put = (id, rec) => {
    seenNow.add(id);
    const old = map.get(id);
    map.set(id, { ...rec, id, firstSeen: old?.firstSeen || now, lastSeen: now, attempts: old?.attempts || 0 });
  };
  for (const f of sources.findings || []) {
    const rule = ruleByKind(f.kind);
    put(f.fp, { title: rule?.label || f.kind, where: `${f.path}${f.line > 1 ? ":" + f.line : ""}`, source: "check", severity: f.severity || "medium", status: rule?.approval ? "needs approval" : "fixable", value: round(priority(f, state, now)) });
  }
  for (const w of sources.weaknesses || []) put(`w|${w.kind}|${w.path}|${JSON.stringify(w.data)}`, { title: w.kind, where: w.path, source: "check", severity: "low", status: "needs a person", value: 1 });
  for (const i of sources.issues || []) put(`i|${i.fp}`, { title: i.kind, where: `${i.page} ${i.detail}`.slice(0, 90), source: "probe", severity: i.severity, status: i.fixable ? "fixable" : "needs a person", value: SEV[i.severity] || 1 });
  for (const s of sources.security || []) put(`s|${s.fp}`, { title: s.kind, where: `${s.path}${s.line ? ":" + s.line : ""}`, source: "security", severity: s.severity, status: "needs a person", value: SEV[s.severity] || 1 });

  // tie each attempt (history) to its record, and age out what's no longer observed
  for (const h of state.history.slice(0, 30)) {
    for (const b of map.values()) if (b.where.startsWith(h.path) && b.title === (ruleByKind(h.kind)?.label || h.kind)) b.lastOutcome = h.outcome;
  }
  const scanned = new Set(Object.keys(sources).filter((k) => sources[k] != null));
  for (const [id, b] of map) {
    const src = { check: b.status === "needs a person" ? "weaknesses" : "findings", probe: "issues", security: "security" }[b.source];
    if (!seenNow.has(id) && (scanned.has(src) || now - b.lastSeen > 14 * DAY)) map.delete(id); // fixed, or stale
  }
  // unresolved problems slowly gain weight so nothing important is starved forever
  const ranked = [...map.values()].map((b) => ({ ...b, rank: round(b.value * (1 + Math.min(1, (now - b.firstSeen) / (14 * DAY)) * 0.5)) }))
    .sort((a, b) => b.rank - a.rank);
  state.backlog = ranked.slice(0, 40);
  return state.backlog;
}

const round = (n) => Math.round(n * 100) / 100;
