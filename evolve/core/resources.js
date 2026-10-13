// Adaptive resource manager. Three operating modes (EVOLVE_MODE), and automatic throttling as budgets
// run down. It only ever turns activity DOWN: limits come from config and are never raised here.
//
//   economy      local scripts do almost everything; AI only for an unusually valuable, close decision
//   balanced     AI whenever there's a real choice between verified fixes (within the budgets)
//   development  more options per decision and escalation allowed; only when explicitly enabled

export const MODES = {
  economy: { ai: "valuable", options: 3, escalate: false },
  balanced: { ai: "choice", options: 5, escalate: true },
  development: { ai: "choice", options: 8, escalate: true },
};

/** The effective policy for this cycle, given the configured mode and how much budget is left. */
export function policy(state, cfg, now = Date.now()) {
  const want = MODES[cfg.MODE] ? cfg.MODE : "economy";
  const day = cfg.DAILY_USD_LIMIT > 0 ? (state.ledger.usd || 0) / cfg.DAILY_USD_LIMIT : 1;
  const month = cfg.MONTHLY_USD_LIMIT > 0 ? (state.month?.usd || 0) / cfg.MONTHLY_USD_LIMIT : 1;
  const calls = cfg.DAILY_CALL_LIMIT > 0 ? (state.ledger.calls || 0) / cfg.DAILY_CALL_LIMIT : 1;
  const used = Math.max(day, month, calls);
  let mode = want, reason = "";
  if (used >= 0.8) { mode = "local-only"; reason = `${Math.round(used * 100)}% of a budget used: no AI until it resets`; }
  else if (used >= 0.5 && want !== "economy") { mode = "economy"; reason = `${Math.round(used * 100)}% of a budget used: dropped to economy`; }
  const kvWrites = state.ledger.writes || 0;
  const slow = (state.ledger.avgMs || 0) > cfg.CYCLE_DEADLINE_MS * 0.6;
  const p = mode === "local-only" ? { ai: "never", options: 3, escalate: false } : { ...MODES[mode] };
  if (slow) { p.options = Math.min(p.options, 3); reason ||= "cycles are running slow: fewer options"; }
  if (kvWrites > 800) reason ||= "close to the KV free-tier write limit";
  return { mode, want, reason, used: Math.round(used * 100) / 100, ...p };
}

/** Should this decision go to an AI at all? (Deterministic; the cheap answer is always the default.) */
export function worthAsking(pol, options, scoreOf) {
  if (pol.ai === "never") return false;
  const combos = options.flatMap((o) => o.remedies.map((r) => scoreOf(o, r))).sort((a, b) => b - a);
  if (combos.length < 2) return false;
  if (pol.ai === "choice") return true;
  // economy: only when the top two are close (a genuine judgement call) AND the stakes are high
  return combos[0] >= 15 && combos[1] >= combos[0] * 0.85;
}

/** Book resource use for the dashboard: cycle time (moving average), storage size, KV writes. */
export function trackResources(state, ms, wrote, bytes) {
  const L = state.ledger;
  L.avgMs = Math.round(L.avgMs ? L.avgMs * 0.9 + ms * 0.1 : ms);
  if (wrote) L.writes = (L.writes || 0) + 1;
  state.storage = { stateKB: Math.round(bytes / 1024), kvLimitKB: 25 * 1024 };
}
