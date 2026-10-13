// One improvement cycle. Cheap local work first; the agents are asked only when there is a real
// choice between verified fixes; at most one change leaves per cycle, and only after validation.
//
// io (adapters, so the same cycle runs in the Cloudflare Worker and the local CLI):
//   store.get() / store.put(state) / store.lock(ttlSec) -> bool / store.unlock()
//   listFiles()          -> { path: version }   for the files the checks read
//   readFiles(paths)     -> { path: text }
//   publish(p)           -> { ref, url, accepted? }   checkpoint the change (branch / PR); throws on failure
//   checkPending(p)      -> "open" | "merged" | "closed"
//   health()             -> { status, ms, kb } | null
//   llm({model,system,user,maxTokens}) -> { text, inTok, outTok }   (null when there's no API key)
//   now()                -> ms

import { pathAllowed } from "./config.js";
import { RULES, ruleByKind, runChecks } from "./rules.js";
import { normalise, prune } from "./state.js";
import { rollLedger, canCycle } from "./budget.js";
import { priority, scoreProposal, recordOutcome, recordEffect, retired, fixKey, round } from "./score.js";
import { classify, critical, probeSummary, metricFor } from "./issues.js";
import { updateBacklog, taskAllows, applyTaskControls } from "./memory.js";
import { policy, worthAsking, trackResources } from "./resources.js";
import { buildGraph, linkKnowledge, impactOf, graphStats } from "./graph.js";
import { ask } from "./agents.js";
import { validateChange } from "./validate.js";
import { hash } from "./html.js";

const OPTIONS_SHOWN = 5;
const REGRESSION_WINDOW_MS = 30 * 60 * 1000;

export async function runCycle(io, cfg) {
  const t0 = io.now();
  if (!(await io.store.lock(cfg.LOCK_TTL_SECONDS))) return { result: "skipped: another cycle is running" };
  try {
    const state = normalise(await io.store.get());
    rollLedger(state, t0);
    applyControl(state, io.store.control ? await io.store.control() : null);
    applyTaskControls(state, io.store.taskControls ? await io.store.taskControls() : null);
    const before = significant(state);
    let result;
    try {
      result = await withDeadline(body(io, cfg, state, t0), cfg.CYCLE_DEADLINE_MS);
    } catch (e) {
      result = "error: " + String(e?.message || e).slice(0, 120);
      state.failStreak++;
    }
    if (state.failStreak >= cfg.MAX_CONSECUTIVE_FAILURES && state.mode === "running") {
      state.mode = "tripped";
      state.modeReason = `${state.failStreak} failures in a row`;
    }
    state.lastCycle = { at: t0, result, ms: io.now() - t0 };
    prune(state, t0);
    trackResources(state, io.now() - t0, false, JSON.stringify(state).length);
    const dirty = significant(state) !== before;
    if (dirty || t0 - (state.lastWrite || 0) > cfg.HEARTBEAT_MINUTES * 60000) {
      state.lastWrite = t0;
      state.ledger.writes = (state.ledger.writes || 0) + 1;
      await io.store.put(state);
    }
    return { result, wrote: dirty, state };
  } finally {
    await io.store.unlock();
  }
}

/**
 * Pause / resume / stop arrive as a separate small record written by the dashboard, so the
 * dashboard never races the engine's own state write. Newer than the last one seen = applied.
 */
export function applyControl(state, ctl) {
  if (!ctl || !(ctl.at > (state.controlAt || 0))) return;
  state.controlAt = ctl.at;
  if (ctl.mode === "running") { state.mode = "running"; state.modeReason = ""; state.failStreak = 0; }
  else if (ctl.mode === "paused" || ctl.mode === "stopped") { state.mode = ctl.mode; state.modeReason = ctl.mode === "stopped" ? "emergency stop from the dashboard" : "paused from the dashboard"; }
}

// Changes worth a storage write (KV writes are the scarce free-tier resource, not reads).
function significant(s) {
  const { lastCycle, lastWrite, ledger, storage, ...rest } = s;
  const { cycles, skipped, avgMs, writes, ...money } = ledger;
  return JSON.stringify([rest, money]);
}

function withDeadline(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("cycle deadline")), ms); })]).finally(() => clearTimeout(t));
}

async function body(io, cfg, state, now) {
  const blocked = canCycle(state, cfg);
  if (blocked) { state.ledger.skipped++; return "skipped: " + blocked; }
  state.ledger.cycles++;

  // 1. live health, and catching a regression after the last accepted change
  const h = io.health ? await io.health().catch(() => ({ status: 0, ms: 0, kb: 0 })) : null;
  if (h) {
    const last = state.health[0];
    const med = median(state.health.filter((x) => x.status === 200).map((x) => x.ms));
    const odd = h.status !== 200 || (med && h.ms > med * 3);
    if (odd || !last || now - last.at > cfg.HEARTBEAT_MINUTES * 60000) state.health.unshift({ at: now, ...h });
    const acc = state.history.find((x) => x.outcome === "accepted");
    if (h.status !== 200 && acc && now - acc.at < REGRESSION_WINDOW_MS && !acc.regressed) {
      acc.regressed = true;
      recordOutcome(state, { ...acc, fp: `regression|${acc.at}`, risk: 0 }, "regression", now, `site returned ${h.status} after this change`);
      state.mode = "tripped";
      state.modeReason = `site returned ${h.status} after "${acc.label}" on ${acc.path}`;
      // open an undo for that change straight away (CI checks it restores the file exactly)
      if (io.revert && acc.ref) {
        try {
          const u = await io.revert(acc);
          state.history[0].note += ` · undo opened: ${u.ref}`;
          return `health regression: tripped, undo ${u.ref} opened`;
        } catch (e) {
          state.history[0].note += " · undo failed: " + String(e?.message || e).slice(0, 80);
        }
      }
      return "health regression: tripped";
    }
  }

  // weekly speed audit results (written by the evolve-audit workflow); looked up every 6 hours
  if (io.audit && now - (state.auditCheckedAt || 0) > 6 * 3600000) {
    state.auditCheckedAt = now;
    const a = await io.audit().catch(() => null);
    if (a && a.at && a.at !== state.audit?.at) state.audit = a;
  }

  // 2. live data first, even while a change is pending: a critical failure must never wait behind a PR
  const versions = await io.listFiles();
  const dataKey = Object.entries(versions).filter(([k]) => k.startsWith("@")).sort().map((e) => e.join("@")).join("|");
  if (dataKey && dataKey !== state.dataKey) {
    const data = await io.readFiles(Object.keys(versions).filter((k) => k.startsWith("@")));
    const fresh = parseJson(data["@probe"]);
    if (fresh && fresh.at && fresh.at !== state.probeAt) {
      state.dataKey = dataKey;
      const outcome = await absorbProbe(io, state, fresh, now);
      if (outcome) {
        updateBacklog(state, { findings: null, weaknesses: null, issues: state.issues, security: null, maintenance: null, docs: null }, now);
        state.scanKey = "";
        return outcome;
      }
      state.probeAt = 0; // let the full scan below take it in again with the files (cheap, local)
    }
    state.dataKey = dataKey;
  }

  // 3. a change already in flight blocks new proposals until it lands or is rejected
  if (state.pending) {
    const p = state.pending;
    const st = await io.checkPending(p);
    if (st === "open") return `waiting on ${p.ref}`;
    recordOutcome(state, p, st === "merged" ? "accepted" : "rejected", now, st === "merged" ? "merged" : "closed without merging (CI failed or reviewer said no)");
    state.pending = null;
    state.scanKey = ""; // files changed: rescan
    return `${p.ref} ${st === "merged" ? "accepted" : "rejected"}`;
  }

  // 4. cheap local checks, skipped entirely when no file changed since the last scan
  const key = hash(Object.entries(versions).sort().map((e) => e.join("@")).join("|"));
  let files = null;
  let probe = null;
  if (key !== state.scanKey) {
    files = await io.readFiles(Object.keys(versions));
    const r = runChecks(files);
    state.findings = r.findings;
    state.weaknesses = r.weaknesses.map(({ kind, path, line, data }) => ({ kind, path, line, data }));
    state.scanKey = key;
    probe = parseJson(files["@probe"]);
    const graph = buildGraph(files, null, { now });
    state.graph = { stats: graphStats(graph), edges: graph.edges.slice(0, 400), at: now };
    const maint = parseJson(files["@maintenance"]), docs = parseJson(files["@docs"]);
    if (maint && maint.at !== state.maintenance?.at) state.maintenance = { at: maint.at, totals: maint.totals, history: [{ at: maint.at, totals: maint.totals }, ...(state.maintenance?.history || [])].slice(0, 12) };
    if (docs && docs.at !== state.docs?.at) state.docs = { at: docs.at, count: (docs.findings || []).length };
    const sources = () => ({ findings: state.findings.filter((f) => pathAllowed(f.path)), weaknesses: state.weaknesses, issues: probe ? state.issues : null, security: state.security?.top || null, maintenance: maint ? (maint.findings || []).slice(0, 15) : null, docs: docs ? (docs.findings || []).slice(0, 15) : null });
    const sec = parseJson(files["@security"]);
    if (sec && sec.at !== state.security?.at) state.security = { at: sec.at, counts: sec.counts, deps: sec.deps || null, top: (sec.findings || []).filter((f) => f.severity !== "low").slice(0, 10) };
    // a new probe of the live site: grade it, measure what recent changes did, and react to breakage
    if (probe && probe.at && probe.at !== state.probeAt) {
      const outcome = absorbProbe(io, state, probe, now);
      updateBacklog(state, sources(), now, graph);
      if (outcome) return outcome;
    }
    updateBacklog(state, sources(), now, graph);
    linkKnowledge(graph, state);
    state.graph = { stats: graphStats(graph), edges: graph.edges.slice(0, 400), at: now };
  }

  // 4. rank what's left after dedupe, cooldowns and retired remedies (this is where history steers)
  const open = (f) => (rem) => {
    if (retired(state.stats.fixes[fixKey(f.kind, rem.id)])) return false;
    const seen = state.seen[`${f.fp}#${rem.id}`];
    return !seen || (seen.outcome !== "accepted" && now - seen.at > cfg.COOLDOWN_HOURS * 3600000);
  };
  const worth = (f) => (rem) => open(f)(rem) && scoreProposal(f, rem, state, now) >= cfg.MIN_SCORE; // nothing pointless
  const pol = policy(state, cfg, now);
  state.resources = { mode: pol.mode, want: pol.want, reason: pol.reason, used: pol.used, ai: pol.ai, options: pol.options };
  const ranked = state.findings
    .filter((f) => pathAllowed(f.path) && taskAllows(state, f.fp, now) && ruleByKind(f.kind)?.remedies.some(worth(f)))
    .map((f) => ({ f, p: priority(f, state, now) }))
    .sort((a, b) => b.p - a.p || a.f.path.localeCompare(b.f.path) || a.f.line - b.f.line);
  state.priorities = ranked.slice(0, 8).map(({ f, p }) => ({ kind: f.kind, path: f.path, line: f.line, priority: round(p) }));
  if (!ranked.length) return "nothing to improve";

  // 5. verify each candidate fix locally before any agent sees it
  files ||= await io.readFiles(Object.keys(versions));
  const options = [];
  for (const { f } of ranked) {
    if (options.length >= Math.min(OPTIONS_SHOWN, pol.options)) break;
    const rule = ruleByKind(f.kind);
    const remedies = rule.remedies.filter(worth(f)).filter((rem) => validateChange(files, rem.apply(files, f), f, cfg, rem).ok);
    if (remedies.length) options.push({ finding: f, area: rule.area, remedies });
    else rule.remedies.forEach((rem) => { state.seen[`${f.fp}#${rem.id}`] = { at: now, outcome: "unverifiable" }; });
  }
  if (!options.length) return "nothing verifiable";

  // 6. the competition (no AI at all when there's only one possible move)
  const combos = options.reduce((n, o) => n + o.remedies.length, 0);
  let A, B;
  if (combos === 1) {
    const only = { o: options[0], r: options[0].remedies[0], via: "auto", note: "single option, no AI needed" };
    const owner = ["a11y", "ux"].includes(options[0].area) ? "innovator" : "optimiser";
    A = owner === "innovator" ? only : null;
    B = owner === "optimiser" ? only : null;
  } else {
    // the resource manager decides whether this choice is worth an AI call at all
    const llm = worthAsking(pol, options, (o, r) => scoreProposal(o.finding, r, state, now)) ? io.llm : null;
    const ecfg = pol.escalate ? cfg : { ...cfg, MODEL_ESCALATE: cfg.MODEL_CHEAP };
    A = await ask("innovator", options, state, ecfg, llm, null, null, now);
    B = await ask("optimiser", options, state, ecfg, llm, A && code(options, A), A, now);
  }
  const entry = (x) => x && { code: code(options, x), kind: x.o.finding.kind, path: x.o.finding.path, label: x.r.label, score: scoreProposal(x.o.finding, x.r, state, now), via: x.via, model: x.model || "", note: x.note || "" };
  const a = entry(A), b = entry(B);
  if (A) state.agents.innovator.proposals++;
  if (B) state.agents.optimiser.proposals++;
  let winner;
  if (!a || !b) winner = a ? "innovator" : "optimiser";
  else if (a.score !== b.score) winner = a.score > b.score ? "innovator" : "optimiser";
  else if (a.code === b.code) winner = "innovator"; // same pick: no credit for copying, the one who found it wins
  else if ((B.r.meta.risk || 0) !== (A.r.meta.risk || 0)) winner = (B.r.meta.risk || 0) < (A.r.meta.risk || 0) ? "optimiser" : "innovator";
  else winner = (state.agents.optimiser.elo ?? 1000) > (state.agents.innovator.elo ?? 1000) ? "optimiser" : "innovator";
  if (a && b && a.code === b.code) b.note = (b.note ? b.note + "; " : "") + "agreed with A (no credit)";
  state.agents[winner].wins++;
  const W = winner === "innovator" ? A : B;
  const w = winner === "innovator" ? a : b;
  state.proposals.unshift({ at: now, innovator: a, optimiser: b, winner });

  // 7. apply only if it still validates, then checkpoint it on its own branch
  const f = W.o.finding;
  const change = W.r.apply(files, f);
  const v = validateChange(files, change, f, cfg, W.r);
  const rule = ruleByKind(f.kind);
  const rival = winner === "innovator" ? (b && b.code !== a.code ? "optimiser" : "") : (a ? "innovator" : "");
  const p = { fp: f.fp, kind: f.kind, path: f.path, line: f.line, remedy: W.r.id, label: W.r.label, risk: W.r.meta.risk || 0, agent: winner, rival, score: w.score, at: now, area: rule.area, approval: !!rule.approval };
  probe ||= parseJson(files["@probe"]);
  p.before = metricFor(rule.area, probe); // measured again on the next probe after it lands
  p.deps = state.graph ? impactOf({ edges: state.graph.edges }, f.path) : []; // pages this change can affect
  if (!v.ok) { recordOutcome(state, p, "rejected", now, v.reasons.join("; ")); return "rejected: " + v.reasons.join("; "); }
  let pub;
  try {
    pub = await io.publish({ ...p, change, lines: v.lines, title: `${p.approval ? "[needs approval] " : ""}evolve: ${rule.label} (${f.path}) — ${W.r.label}` });
  } catch (e) {
    state.failStreak++;
    return "publish failed: " + String(e?.message || e).slice(0, 120);
  }
  p.ref = pub.ref;
  if (pub.rejected) { recordOutcome(state, p, "rejected", now, pub.rejected); return `rejected ${p.ref}: ${pub.rejected}`; }
  p.url = pub.url || "";
  if (pub.sha) p.sha = pub.sha;
  if (pub.accepted) { recordOutcome(state, p, "accepted", now, "validated and committed locally"); state.scanKey = ""; return `accepted ${p.ref}`; }
  state.pending = p;
  return `proposed ${p.ref} (${winner} won ${w.score})`;
}

const code = (options, x) => `${options.indexOf(x.o) + 1}${x.r.id}`;
const parseJson = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

/**
 * A fresh probe of the live site: store graded issues, measure the effect of changes that landed
 * since the last probe, and on a critical failure pause everything and undo the latest change.
 */
function absorbProbe(io, state, probe, now) {
  const prevAt = state.probeAt || 0;
  const issues = classify(probe);
  state.issues = issues.slice(0, 40).map(({ fp, kind, severity, page, detail, fixable }) => ({ fp, kind, severity, page, detail, fixable }));
  state.probe = probeSummary(probe);
  state.journeys = (probe.journeys || []).map(({ id, name, width, status, why, ms }) => ({ id, name, width, status, why: why || "", ms }));
  state.probeAt = probe.at;
  for (const h of state.history) {
    if (h.outcome !== "accepted" || h.measured || h.before == null || h.at > probe.at) continue;
    const sign = recordEffect(state, h, h.before, metricFor(h.area, probe), now);
    if (sign === -1 && h.area === "perf") {
      recordOutcome(state, { ...h, fp: `perf-regression|${h.at}`, risk: 0 }, "perf-regression", now, `measured worse after it landed (${h.measured.before} -> ${h.measured.after})`);
    }
  }
  const crit = critical(issues);
  const rec = (state.recovery ||= { points: [], log: [] });
  const brokenJourney = issues.some((i) => i.kind === "broken-journey");
  // a clean probe of a known commit is a recovery point
  if (!crit.length && !brokenJourney && probe.sha && rec.points[0]?.sha !== probe.sha) rec.points = [{ sha: probe.sha, at: probe.at }, ...rec.points].slice(0, 5);
  if (crit.length && state.mode === "running") {
    state.mode = "tripped";
    const cause = `${crit[0].kind} on ${crit[0].page} (${crit[0].detail.slice(0, 60)})`;
    state.modeReason = "critical: " + cause;
    const log = (action, ref = "") => { rec.log = [{ at: now, cause, action, ref }, ...rec.log].slice(0, 20); };
    const last = state.history.find((h) => h.outcome === "accepted");
    // 1. the engine's own latest change landed since the last good probe: undo just that, and learn from it
    if (last && last.at > prevAt && io.revert && last.ref && !last.reverted) {
      last.reverted = true;
      recordOutcome(state, { ...last, fp: `regression|${last.at}`, risk: 0 }, "regression", now, "critical failure on the live site after it landed: " + cause);
      return io.revert(last).then((u) => { log("undo " + last.ref, u.ref); return `critical failure: paused, undo ${u.ref} opened`; },
        (e) => { log("undo failed: " + String(e?.message || e).slice(0, 60)); return "critical failure: paused (undo failed)"; });
    }
    // 2. otherwise restore the site's editable files to the last known-good commit (engine-made changes only)
    const good = rec.points.find((x) => x.sha && x.sha !== probe.sha);
    if (good && io.restore) {
      return io.restore(good.sha).then((u) => { log(`restore to ${good.sha.slice(0, 7)}`, u.ref); return `critical failure: paused, restore ${u.ref} opened`; },
        (e) => { log("restore not possible: " + String(e?.message || e).slice(0, 80)); return "critical failure: paused (needs a person: " + String(e?.message || e).slice(0, 60) + ")"; });
    }
    log("paused; no safe automatic recovery");
    return "critical failure: paused";
  }
  return null;
}
function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export { RULES };
