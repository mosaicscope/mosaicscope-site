// Strategic memory and the task queue. Every observed problem, from every source (static checks,
// browser probe, journeys, security scan, maintenance, docs), becomes ONE task. Each task has:
//   benefit, severity, confidence, cost, risk, deps (pages it touches, from the knowledge graph),
//   resource (local / ai-decision / person), status, retries.
// Statuses: queued, paused, cancelled, needs-approval, approved, blocked (retry limit), needs-person.
// Scheduling is deterministic (highest score first); the AI never picks the task, only the remedy.

import { ruleByKind } from "./rules.js";
import { priority } from "./score.js";
import { impactOf } from "./graph.js";

const DAY = 24 * 3600 * 1000, HOUR = 3600 * 1000;
const SEV = { critical: 8, high: 4, medium: 2, low: 1 };
const CONF = { check: 0.95, probe: 0.8, journey: 0.85, security: 0.8, maintenance: 0.7, docs: 0.7 };
export const MAX_RETRIES = 3;
export const CONSTRAINTS = [
  "edits only index.html, 404.html, house/, stats/, sitemap.xml and styles.css",
  "one small change at a time, re-validated in CI; CSS append-only",
  "features always wait for a person to approve",
  "never touches functions/, evolve/, .github/, game/, world/, content.json or secrets",
];
const KEEP = new Set(["paused", "cancelled", "approved"]); // statuses only a person sets

/**
 * Merge this cycle's observations into the queue.
 * sources: { findings, weaknesses, issues, security, maintenance, docs } (null = not scanned this time).
 */
export function updateBacklog(state, sources, now, graph = null) {
  const map = new Map((state.backlog || []).map((b) => [b.id, b]));
  const seenNow = new Set();
  const put = (id, rec) => {
    seenNow.add(id);
    const old = map.get(id);
    const status = old && KEEP.has(old.status) ? old.status : old?.status === "blocked" ? "blocked" : rec.status;
    map.set(id, { ...rec, id, status, firstSeen: old?.firstSeen || now, lastSeen: now, retries: old?.retries || 0, nextTry: old?.nextTry || 0, lastOutcome: old?.lastOutcome });
  };
  for (const f of sources.findings || []) {
    const rule = ruleByKind(f.kind);
    const best = rule?.remedies?.[0]?.meta || {};
    put(f.fp, {
      title: rule?.label || f.kind, kind: f.kind, where: `${f.path}${f.line > 1 ? ":" + f.line : ""}`, source: "check",
      severity: f.severity || "medium", benefit: best.benefit ?? 1, confidence: CONF.check, cost: (best.complexity ?? 1) + 1, risk: best.risk ?? 1,
      deps: graph ? impactOf(graph, f.path) : [], resource: (rule?.remedies?.length || 0) > 1 ? "ai-decision" : "local",
      status: rule?.approval ? "needs-approval" : "queued", value: round(priority(f, state, now)),
    });
  }
  const person = (id, title, where, source, severity, extra = {}) => put(id, { title, kind: title, where, source, severity, benefit: SEV[severity] / 2, confidence: CONF[source] || 0.7, cost: 3, risk: 2, deps: [], resource: "person", status: "needs-person", value: SEV[severity] || 1, ...extra });
  for (const w of sources.weaknesses || []) person(`w|${w.kind}|${w.path}|${JSON.stringify(w.data)}`, w.kind, w.path, "check", "low");
  for (const i of sources.issues || []) {
    if (i.fixable) continue; // fixable probe issues already arrive as findings (tap-target, focus-style)
    person(`i|${i.fp}`, i.kind, `${i.page} ${i.detail}`.slice(0, 90), i.kind === "broken-journey" ? "journey" : "probe", i.severity);
  }
  for (const s of sources.security || []) person(`s|${s.fp}`, s.kind, `${s.path}${s.line ? ":" + s.line : ""}`, "security", s.severity);
  for (const m of sources.maintenance || []) person(`m|${m.fp}`, m.kind, m.where, "maintenance", m.severity);
  for (const d of sources.docs || []) person(`d|${d.fp}`, d.kind, d.where, "docs", d.severity);

  // results of attempts: back off, and stop retrying after MAX_RETRIES (no infinite loops)
  for (const h of state.history.slice(0, 30)) {
    const t = [...map.values()].find((b) => b.kind === h.kind && b.where.startsWith(h.path) && !(b.attempted || []).includes(h.at));
    if (!t) continue;
    (t.attempted ||= []).push(h.at);
    t.attempted = t.attempted.slice(-5);
    t.lastOutcome = h.outcome;
    if (h.outcome !== "accepted") {
      t.retries++;
      t.nextTry = h.at + Math.pow(2, t.retries) * HOUR;
      if (t.retries >= MAX_RETRIES && !KEEP.has(t.status)) t.status = "blocked";
    }
  }
  // age out what's fixed (not seen in a scan of its source) or stale
  const scanned = new Set(Object.keys(sources).filter((k) => sources[k] != null));
  const srcKey = { check: null, probe: "issues", journey: "issues", security: "security", maintenance: "maintenance", docs: "docs" };
  for (const [id, b] of map) {
    const k = b.source === "check" ? (b.status === "needs-person" ? "weaknesses" : "findings") : srcKey[b.source];
    if (!seenNow.has(id) && ((k && scanned.has(k)) || now - b.lastSeen > 14 * DAY)) map.delete(id);
  }
  const ranked = [...map.values()].map((b) => ({ ...b, rank: taskScore(b, now) })).sort((a, b) => b.rank - a.rank);
  state.backlog = ranked.slice(0, 60);
  return state.backlog;
}

/** Deterministic task score: value x confidence x benefit-for-cost, with age so nothing starves. */
export function taskScore(t, now) {
  const age = 1 + Math.min(1, (now - t.firstSeen) / (14 * DAY)) * 0.5;
  const crit = t.severity === "critical" ? 3 : t.source === "security" && t.severity === "high" ? 2 : 1;
  return round(t.value * (t.confidence || 0.7) * ((t.benefit || 1) + 1) / ((t.cost || 1) + (t.risk || 0)) * age * crit);
}

/** May the engine work on this finding now? (status, approval, back-off) */
export function taskAllows(state, fp, now) {
  const t = (state.backlog || []).find((b) => b.id === fp);
  if (!t) return true;
  if (["paused", "cancelled", "blocked"].includes(t.status)) return false;
  // needs-approval tasks may still produce a PR: the PR is the preview, and CI never merges it
  if (t.nextTry && now < t.nextTry) return false;
  return true;
}

/** Person controls from the dashboard: { id: { action, at } } with pause / resume / cancel / approve. */
export function applyTaskControls(state, controls) {
  if (!controls) return 0;
  let n = 0;
  for (const [id, c] of Object.entries(controls)) {
    const t = (state.backlog || []).find((b) => b.id === id);
    if (!t || !(c.at > (t.controlAt || 0))) continue;
    t.controlAt = c.at;
    t.status = { pause: "paused", cancel: "cancelled", approve: "approved", resume: "queued" }[c.action] || t.status;
    if (c.action === "resume") { t.retries = 0; t.nextTry = 0; }
    n++;
  }
  return n;
}

const round = (n) => Math.round(n * 100) / 100;
