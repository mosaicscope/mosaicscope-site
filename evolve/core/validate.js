// Every proposed edit must pass all of these before it leaves the engine (and again in CI).

import { pathAllowed } from "./config.js";
import { runChecks } from "./rules.js";
import { scanTags } from "./html.js";

/** Lines removed plus lines added (multiset difference; good enough for one-tag edits). */
export function changedLines(a, b) {
  const count = (s) => s.split("\n").reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const A = count(a), B = count(b);
  let n = 0;
  for (const [l, c] of A) n += Math.max(0, c - (B.get(l) || 0));
  for (const [l, c] of B) n += Math.max(0, c - (A.get(l) || 0));
  return n;
}

const FORBIDDEN = [
  [/<script\b/i, "adds a script"],
  [/\son[a-z]+\s*=/i, "adds an inline event handler"],
  [/javascript:/i, "adds a javascript: URL"],
  [/http:\/\//i, "adds an insecure http:// URL"],
  [/<(iframe|object|embed|form|base)\b/i, "adds an embed, form or base tag"],
  [/(api[_-]?key|secret|token|password)\s*[=:]/i, "touches something that looks like a credential"],
];

/**
 * files: the current file set; change: { path, text }; finding: the finding it claims to fix.
 * Returns { ok, reasons: [...] }.
 */
export function validateChange(files, change, finding, cfg) {
  const reasons = [];
  if (!change || typeof change.text !== "string") return { ok: false, reasons: ["no change produced"] };
  if (!pathAllowed(change.path)) reasons.push(`path ${change.path} is protected`);
  if (change.path !== finding.path) reasons.push("edits a different file than the finding");
  const before = files[change.path];
  if (before == null) reasons.push("file does not exist");
  if (reasons.length) return { ok: false, reasons };

  const lines = changedLines(before, change.text);
  if (lines === 0) reasons.push("no-op change");
  if (lines > cfg.MAX_DIFF_LINES) reasons.push(`${lines} changed lines > limit ${cfg.MAX_DIFF_LINES}`);
  if (Math.abs(change.text.length - before.length) > 400) reasons.push("change is too large");

  const added = addedText(before, change.text);
  for (const [re, why] of FORBIDDEN) if (re.test(added) && !re.test(removedText(before, change.text))) reasons.push(why);

  if (change.path.endsWith(".html")) {
    const h = (t) => scanTags(t).reduce((m, x) => ((m[x.name] = (m[x.name] || 0) + 1), m), {});
    const A = h(before), B = h(change.text);
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const d = (B[k] || 0) - (A[k] || 0);
      if (d !== 0 && !(k === "meta" && d === 1)) reasons.push(`tag count for <${k}> changed by ${d}`);
    }
    for (const close of ["</html>", "</head>", "</body>"]) if (before.includes(close) && !change.text.includes(close)) reasons.push(`lost ${close}`);
  }
  if (change.path.endsWith(".xml") && !/<\/urlset>\s*$/.test(change.text)) reasons.push("sitemap no longer ends with </urlset>");

  // the target is fixed, and nothing new is broken (accessibility and security checks included)
  const old = runChecks(files), now = runChecks({ ...files, [change.path]: change.text });
  const oldFps = new Set([...old.findings, ...old.weaknesses].map((f) => f.fp));
  if (now.findings.some((f) => f.fp === finding.fp)) reasons.push("the finding is still there");
  const fresh = [...now.findings, ...now.weaknesses].filter((f) => !oldFps.has(f.fp));
  if (fresh.length) reasons.push("introduces " + fresh.map((f) => f.kind).join(", "));

  return { ok: reasons.length === 0, reasons, lines };
}

function addedText(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return b.slice(Math.max(0, i - 1), b.length - j); // one char of context so " onclick=" still matches
}
function removedText(a, b) { return addedText(b, a); }
