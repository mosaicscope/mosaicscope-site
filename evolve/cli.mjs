#!/usr/bin/env node
// Local runner for the evolution engine (Node 20+, no dependencies).
//
//   node evolve/cli.mjs check              run the local checks and print what they find
//   node evolve/cli.mjs cycle [--dry]      run one full cycle here; changes go to a git branch evolve/*
//   node evolve/cli.mjs status             print the local state
//   node evolve/cli.mjs verify <base-ref>  CI gate: the diff from <base-ref> to HEAD must be one safe fix
//
// Local state lives in evolve/.state/ (git-ignored). Set ANTHROPIC_API_KEY to let the agents use the API;
// without it they use their local heuristics. EVOLVE_* variables override the limits.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, openSync, closeSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { loadConfig, ALLOWED_PATHS, pathAllowed } from "./core/config.js";
import { runCycle } from "./core/cycle.js";
import { runChecks } from "./core/rules.js";
import { validateChange } from "./core/validate.js";
import { publicView } from "./core/state.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = join(ROOT, "evolve", ".state");
const STATE = join(STATE_DIR, "state.json");
const LOCK = join(STATE_DIR, "lock");
const READ_PATHS = [...ALLOWED_PATHS, "manifest.webmanifest", "world/index.html"];

const git = (args, cwd = ROOT) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const readLocal = (paths, root = ROOT) => Object.fromEntries(paths.filter((p) => existsSync(join(root, p))).map((p) => [p, readFileSync(join(root, p), "utf8")]));

export function localIo({ dry = false, root = ROOT, env = process.env } = {}) {
  return {
    now: () => Date.now(),
    store: {
      get: () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null),
      put: (s) => { if (!dry) { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(s, null, 1)); } },
      control: () => null,
      async lock(ttl) {
        mkdirSync(STATE_DIR, { recursive: true });
        if (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < ttl * 1000) return false;
        rmSync(LOCK, { force: true });
        try { closeSync(openSync(LOCK, "wx")); return true; } catch { return false; }
      },
      unlock: async () => rmSync(LOCK, { force: true }),
    },
    async listFiles() {
      const out = {};
      for (const p of READ_PATHS) if (existsSync(join(root, p))) out[p] = git(["hash-object", p], root);
      return out;
    },
    readFiles: async (paths) => readLocal(paths, root),
    async publish(p) {
      if (dry) return { ref: "dry-run", accepted: true };
      // checkpoint: an isolated worktree on a new branch; the working tree you're in is never touched
      const branch = `evolve/${p.kind}-${p.at.toString(36)}`;
      const dir = join(tmpdir(), "mosaicscope-" + branch.replace(/\W/g, "-"));
      git(["worktree", "add", "-q", "-b", branch, dir, "HEAD"], root);
      try {
        writeFileSync(join(dir, p.change.path), p.change.text);
        git(["add", p.change.path], dir);
        git(["-c", "user.name=mosaicscope-evolve", "-c", "user.email=evolve@users.noreply.github.com", "commit", "-q", "-m", p.title], dir);
        execFileSync(process.execPath, [join(dir, "evolve/cli.mjs"), "verify", "HEAD~1"], { cwd: dir, stdio: "pipe" });
        execFileSync(process.execPath, ["--test", "evolve/test/engine.test.mjs"], { cwd: dir, stdio: "pipe" });
      } catch (e) {
        git(["worktree", "remove", "--force", dir], root);
        git(["branch", "-D", branch], root); // roll back
        throw new Error("validation failed on the branch: " + String(e.stdout || "").trim().split("\n").pop() || String(e.stderr || e.message).split("\n").find(Boolean));
      }
      const sha = git(["rev-parse", "HEAD"], dir);
      git(["worktree", "remove", "--force", dir], root);
      return { ref: branch, sha };
    },
    async revert(acc) {
      const sha = acc.sha || acc.ref;
      const branch = `evolve/revert-${git(["rev-parse", sha], root)}`;
      const dir = join(tmpdir(), "mosaicscope-" + branch.replace(/\W/g, "-"));
      git(["worktree", "add", "-q", "-b", branch, dir, "HEAD"], root);
      try { git(["-c", "user.name=mosaicscope-evolve", "-c", "user.email=evolve@users.noreply.github.com", "revert", "--no-edit", sha], dir); }
      finally { git(["worktree", "remove", "--force", dir], root); }
      return { ref: branch };
    },
    async audit() {
      try { return JSON.parse(execFileSync("git", ["show", "origin/evolve-data:audit.json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; }
    },
    async checkPending(p) {
      // by commit, not branch name: a merged branch is often deleted right after
      const ref = p.sha || p.ref;
      try { git(["merge-base", "--is-ancestor", ref, "HEAD"], root); return "merged"; } catch { /* not in HEAD */ }
      try { git(["rev-parse", "--verify", "-q", p.ref], root); return "open"; } catch { return "closed"; }
    },
    health: env.EVOLVE_SITE_URL ? async () => {
      const t = Date.now();
      const r = await fetch(env.EVOLVE_SITE_URL);
      const b = await r.arrayBuffer();
      return { status: r.status, ms: Date.now() - t, kb: Math.round(b.byteLength / 1024) };
    } : null,
    llm: env.ANTHROPIC_API_KEY ? async ({ model, system, user, maxTokens }) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Anthropic ${r.status}`);
      return { text: j.content?.[0]?.text || "", inTok: j.usage?.input_tokens, outTok: j.usage?.output_tokens };
    } : null,
  };
}

/** CI gate: HEAD differs from base in exactly one allowed file, and that diff is a valid fix for one finding. */
export function verify(base, root = ROOT, cfg = loadConfig(process.env), headRef = process.env.GITHUB_HEAD_REF || "") {
  const changed = git(["diff", "--name-only", base, "HEAD"], root).split("\n").filter(Boolean);
  if (changed.length === 0) return { ok: false, reasons: ["no changes"] };
  // an undo: every changed file must be exactly its version from before the commit being undone
  const undo = /^evolve\/revert-([0-9a-f]{7,40})$/.exec(headRef);
  if (undo) {
    const sha = undo[1];
    let touched;
    try { touched = git(["diff", "--name-only", `${sha}^1`, sha], root).split("\n").filter(Boolean); } catch { return { ok: false, reasons: ["unknown commit to undo"] }; }
    const raw = (ref, p) => { try { return execFileSync("git", ["show", `${ref}:${p}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
    const bad = changed.filter((p) => !touched.includes(p) || !pathAllowed(p) || raw("HEAD", p) !== raw(`${sha}^1`, p));
    return bad.length ? { ok: false, reasons: ["undo doesn't restore: " + bad.join(", ")] } : { ok: true, reasons: [], lines: 0 };
  }
  if (changed.length > cfg.MAX_FILES_PER_CHANGE) return { ok: false, reasons: [`${changed.length} files changed`] };
  const path = changed[0];
  if (!pathAllowed(path)) return { ok: false, reasons: [`${path} is protected`] };
  const show = (ref, p) => { try { return execFileSync("git", ["show", `${ref}:${p}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
  const before = {};
  for (const p of READ_PATHS) { const t = show(base, p); if (t != null) before[p] = t; }
  const after = show("HEAD", path);
  if (after == null || before[path] == null) return { ok: false, reasons: ["file added or removed"] };
  const now = runChecks({ ...before, [path]: after });
  const fixed = runChecks(before).findings.filter((f) => f.path === path && !now.findings.some((g) => g.fp === f.fp));
  if (!fixed.length) return { ok: false, reasons: ["the diff fixes no known finding"] };
  return validateChange(before, { path, text: after }, fixed[0], cfg);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const cfg = loadConfig(process.env);
  if (cmd === "check") {
    const r = runChecks(readLocal(READ_PATHS));
    for (const f of r.findings) console.log(`fix   ${f.kind.padEnd(13)} ${f.path}:${f.line}${pathAllowed(f.path) ? "" : "  (read-only)"}`);
    for (const f of r.weaknesses) console.log(`note  ${f.kind.padEnd(13)} ${f.path}:${f.line} ${JSON.stringify(f.data)}`);
    if (!r.findings.length && !r.weaknesses.length) console.log("nothing found");
  } else if (cmd === "cycle") {
    const r = await runCycle(localIo({ dry: process.argv.includes("--dry") }), cfg);
    console.log(r.result);
    const p = r.state?.proposals?.[0];
    if (p && p.at === r.state.lastCycle?.at) console.log("innovator:", p.innovator, "\noptimiser:", p.optimiser, "\nwinner:", p.winner);
  } else if (cmd === "status") {
    console.log(JSON.stringify(existsSync(STATE) ? publicView(JSON.parse(readFileSync(STATE, "utf8"))) : { note: "no local state yet" }, null, 1));
  } else if (cmd === "verify") {
    const r = verify(arg || "origin/main");
    console.log(r.ok ? `ok: ${r.lines} changed lines` : "FAILED: " + r.reasons.join("; "));
    process.exitCode = r.ok ? 0 : 1;
  } else {
    console.log("usage: node evolve/cli.mjs check | cycle [--dry] | status | verify <base-ref>");
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
