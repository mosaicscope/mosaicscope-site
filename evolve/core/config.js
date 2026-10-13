// Evolution engine settings. Every number here is a hard limit the engine checks before it acts.
// Override any of them with an EVOLVE_<NAME> environment variable (Worker vars or the shell),
// e.g. EVOLVE_DAILY_USD_LIMIT=0.05. The engine cannot change these itself.

export const DEFAULTS = {
  INTERVAL_SECONDS: 120,          // one cycle every two minutes (the Worker cron is */2)
  MAX_INPUT_TOKENS: 400,          // per AI call, estimated before the call; the call is skipped if over
  MAX_OUTPUT_TOKENS: 8,           // per AI call; an answer is two short codes like "2b"
  DAILY_USD_LIMIT: 0.10,          // estimated spend per UTC day across both agents
  DAILY_CALL_LIMIT: 200,          // AI calls per UTC day
  DAILY_CYCLE_LIMIT: 720,         // cycles per UTC day (720 = every 2 minutes)
  MAX_CHANGES_PER_CYCLE: 1,       // proposals applied per cycle
  MAX_OPEN_CHANGES: 1,            // unmerged change branches at once; no new proposals until it resolves
  MAX_CONSECUTIVE_FAILURES: 3,    // validation or CI failures in a row before the engine pauses itself
  MAX_DIFF_LINES: 12,             // changed lines a single proposal may touch
  MAX_FILES_PER_CHANGE: 1,
  CYCLE_DEADLINE_MS: 60000,       // a cycle gives up after this, so cycles never overlap
  LOCK_TTL_SECONDS: 110,
  HEARTBEAT_MINUTES: 15,          // write state at least this often even when nothing changes (KV write budget)
  COOLDOWN_HOURS: 24,             // a rejected proposal can't be proposed again for this long
  AUTO_MERGE: false,              // true: CI merges a change branch once every check passes
  MODEL_CHEAP: "claude-haiku-5-5",
  MODEL_ESCALATE: "claude-sonnet-5-5",
  KILL: false,                    // global emergency stop (env only; the dashboard cannot clear it)
};

// USD per million tokens, used to estimate spend before a call and to price the usage the API reports.
export const PRICES = {
  "claude-haiku-5-5": { in: 1, out: 5 },
  "claude-sonnet-5-5": { in: 3, out: 15 },
};

// Paths a proposal may change. Everything else (functions/, evolve/, .github/, game/, world/,
// content.json, wrangler config, .pages.yml, images) is off limits, whatever an agent says.
export const ALLOWED_PATHS = [
  "index.html", "404.html", "house/index.html", "stats/index.html", "stats/screen.html", "sitemap.xml", "styles.css",
];
export const PROTECTED_PREFIXES = [
  "functions/", "evolve/", ".github/", ".claude/", "game/", "world/", "images/", ".git",
  "content.json", ".pages.yml", "wrangler", "package", "_headers", "_redirects", "_routes",
];

export function loadConfig(env = {}) {
  const c = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    const v = env["EVOLVE_" + k];
    if (v == null || v === "") continue;
    c[k] = typeof DEFAULTS[k] === "number" ? Number(v) : typeof DEFAULTS[k] === "boolean" ? v === true || v === "1" || v === "true" : String(v);
    if (typeof DEFAULTS[k] === "number" && !Number.isFinite(c[k])) c[k] = DEFAULTS[k];
  }
  return c;
}

export function pathAllowed(path) {
  if (typeof path !== "string" || path.includes("..") || path.startsWith("/")) return false;
  if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) return false;
  return ALLOWED_PATHS.includes(path);
}
