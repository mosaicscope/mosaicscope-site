// The engine's whole memory: one small JSON document (KV key "evo:state" on Cloudflare,
// evolve/.state/state.json locally). Lists are capped so it stays a few KB.

export const AGENTS = ["innovator", "optimiser"];
const agent = () => ({ points: 0, wins: 0, accepted: 0, rejected: 0, regressions: 0, proposals: 0 });

export function blankState() {
  return {
    v: 1,
    mode: "running",          // running | paused | stopped | tripped
    modeReason: "",
    controlAt: 0,             // time of the last dashboard control applied
    agents: { innovator: agent(), optimiser: agent() },
    stats: { kinds: {}, fixes: {} },   // outcome counts that steer priorities: { ok, fail }
    seen: {},                 // "fp#remedy" -> { at, outcome } (no repeats, cooldown after rejection)
    pending: null,            // the one change waiting on CI / merge
    history: [],              // latest outcomes, newest first
    proposals: [],            // latest competitions, newest first
    health: [],               // live-site samples { at, status, ms, kb }
    weaknesses: [],           // things the checks see but won't fix
    priorities: [],           // current ranked opportunities (for the dashboard)
    scanKey: "",              // hash of the file versions last scanned (skip unchanged files)
    findings: [],             // findings from that scan
    failStreak: 0,
    lastCycle: null,          // { at, result, ms }
    lastWrite: 0,
    ledger: { day: "", calls: 0, inTok: 0, outTok: 0, usd: 0, cycles: 0, skipped: 0 },
    days: [],                 // past ledgers, newest first
  };
}

export function normalise(s) {
  const b = blankState();
  if (!s || typeof s !== "object" || s.v !== 1) return b;
  const out = { ...b, ...s };
  out.agents = { innovator: { ...agent(), ...(s.agents?.innovator || {}) }, optimiser: { ...agent(), ...(s.agents?.optimiser || {}) } };
  out.stats = { kinds: { ...(s.stats?.kinds || {}) }, fixes: { ...(s.stats?.fixes || {}) } };
  out.ledger = { ...b.ledger, ...(s.ledger || {}) };
  return out;
}

const cap = (a, n) => (a.length > n ? a.slice(0, n) : a);
const WEEK = 7 * 24 * 3600 * 1000;

/** Trim lists and forget old dedupe entries so the document never grows without bound. */
export function prune(s, now) {
  s.history = cap(s.history, 30);
  s.proposals = cap(s.proposals, 20);
  s.health = cap(s.health, 24);
  s.days = cap(s.days, 14);
  s.weaknesses = cap(s.weaknesses, 20);
  s.findings = cap(s.findings, 60);
  const keys = Object.keys(s.seen);
  for (const k of keys) if (now - s.seen[k].at > WEEK) delete s.seen[k];
  const left = Object.entries(s.seen).sort((a, b) => b[1].at - a[1].at);
  if (left.length > 200) s.seen = Object.fromEntries(left.slice(0, 200));
  return s;
}

/** Public view for the dashboard: everything except the raw finding cache. */
export function publicView(s) {
  const { findings, scanKey, seen, ...rest } = s;
  return { ...rest, seenCount: Object.keys(seen || {}).length, findingCount: (findings || []).length };
}
