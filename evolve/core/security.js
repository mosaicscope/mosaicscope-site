// Security guard: cheap, deterministic scans over file text. Runs on every engine change (validate.js),
// on every PR (evolve-ci, comparing against the base) and daily on the whole repo (evolve-probe).
// Findings carry a severity; CI fails only on NEW high or critical findings, so existing debt is
// reported without blocking unrelated work.

import { hash } from "./html.js";

const SECRET_PATTERNS = [
  ["github-token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  ["aws-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ["slack-token", /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ["cloudflare-token", /\b(?:CF|CLOUDFLARE)_API_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/],
];
// web3forms access keys are public by design (they ship in the page); not a secret
const JS_RISKS = [
  ["eval", /\beval\s*\(/, "high"],
  ["new-function", /\bnew\s+Function\s*\(/, "high"],
  ["document-write", /\bdocument\.write\s*\(/, "medium"],
  ["string-timer", /\bset(?:Timeout|Interval)\s*\(\s*["'`]/, "medium"],
  ["inner-html", /\.(?:innerHTML|outerHTML)\s*\+?=(?!\s*["'`][^"'`$]*["'`]\s*;?\s*$)/, "low"],
  ["insert-html", /\binsertAdjacentHTML\s*\(/, "low"],
];

const lineAt = (text, i) => text.slice(0, i).split("\n").length;

/** files: { path: text }. Returns findings { kind, severity, path, line, fp }. */
export function scanSecurity(files) {
  const out = [];
  const add = (kind, severity, path, line, sample) => out.push({ kind, severity, path, line, fp: `${kind}|${path}|${hash(sample.trim())}` });
  for (const [path, text] of Object.entries(files)) {
    if (typeof text !== "string" || /(^|\/)(package-lock\.json|node_modules\/)/.test(path) || path.startsWith("@")) continue;
    for (const [kind, re] of SECRET_PATTERNS) {
      const g = new RegExp(re.source, "g");
      for (const m of text.matchAll(g)) add("secret:" + kind, "critical", path, lineAt(text, m.index), m[0]);
    }
    const isJs = /\.(m?js|ts)$/.test(path) || path.endsWith(".html");
    if (isJs && !path.startsWith("evolve/test/") && !path.endsWith("security.js")) {
      text.split("\n").forEach((ln, i) => {
        for (const [kind, re, sev] of JS_RISKS) if (re.test(ln) && !/^\s*(\/\/|\*)/.test(ln)) add("dom:" + kind, sev, path, i + 1, ln);
      });
    }
    if (path.endsWith(".html")) {
      text.split("\n").forEach((ln, i) => {
        if (/(src|href)=["']http:\/\//i.test(ln)) add("insecure-url", "medium", path, i + 1, ln);
        if (/<a\b[^>]*target=["']_blank["'](?![^>]*noopener)/i.test(ln)) add("tabnabbing", "low", path, i + 1, ln);
      });
    }
    if (path.startsWith(".github/workflows/")) {
      if (/\bpull_request_target\b/.test(text) && /actions\/checkout/.test(text)) add("workflow:pr-target-checkout", "high", path, 0, "pull_request_target");
      if (/permissions:\s*write-all/.test(text)) add("workflow:write-all", "high", path, 0, "write-all");
      if (/echo\s+[^\n]*\$\{\{\s*secrets\./.test(text)) add("workflow:echo-secret", "critical", path, 0, "echo secret");
      if (/\$\{\{\s*github\.event\.(pull_request\.(title|body)|comment\.body|issue\.(title|body))/.test(text)) add("workflow:script-injection", "high", path, 0, "event text in run");
    }
    if (/^functions\/.+\.js$/.test(path)) {
      if (/onRequestPost|onRequest\b/.test(text) && /\.put\(/.test(text) && !/(Authorization|ADMIN_TOKEN|STATS_KEY|n\(|Math\.min)/.test(text)) add("function:unauthenticated-write", "medium", path, 0, "write without auth or bounds");
    }
  }
  return out;
}

/** Findings in head that weren't in base, at or above a severity. */
export function newFindings(base, head, min = "high") {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  const had = new Set(base.map((f) => f.fp));
  return head.filter((f) => !had.has(f.fp) && rank[f.severity] <= rank[min]);
}

export function summarise(list) {
  const by = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of list) by[f.severity]++;
  return by;
}
