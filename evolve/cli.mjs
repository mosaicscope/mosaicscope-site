#!/usr/bin/env node
// Local runner for the evolution engine (Node 20+, no dependencies).
//
//   node evolve/cli.mjs check              run the local checks and print what they find
//   node evolve/cli.mjs cycle [--dry]      run one full cycle here; changes go to a git branch evolve/*
//   node evolve/cli.mjs experiment         test every candidate fix for the top problem in isolated previews
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
import { createRequire } from "node:module";
import { loadConfig, ALLOWED_PATHS, pathAllowed } from "./core/config.js";
import { runCycle } from "./core/cycle.js";
import { runChecks, ruleByKind } from "./core/rules.js";
import { validateChange } from "./core/validate.js";
import { publicView } from "./core/state.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = join(ROOT, "evolve", ".state");
const STATE = join(STATE_DIR, "state.json");
const LOCK = join(STATE_DIR, "lock");
const READ_PATHS = [...ALLOWED_PATHS, "manifest.webmanifest", "world/index.html", "main.js"];

const git = (args, cwd = ROOT) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const readLocal = (paths, root = ROOT) => Object.fromEntries(paths.filter((p) => existsSync(join(root, p))).map((p) => [p, readFileSync(join(root, p), "utf8")]));

export function localIo({ dry = false, root = ROOT, env = process.env } = {}) {
  return {
    now: () => Date.now(),
    store: {
      get: () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null),
      put: (s) => { if (!dry) { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(s, null, 1)); } },
      control: () => null,
      taskControls: () => { try { return JSON.parse(readFileSync(join(STATE_DIR, "tasks.json"), "utf8")); } catch { return null; } },
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
      for (const [k, t] of Object.entries(dataFiles(root, env))) out[k] = String(t.length) + ":" + t.slice(0, 40);
      return out;
    },
    readFiles: async (paths) => ({ ...readLocal(paths.filter((p) => !p.startsWith("@")), root), ...dataFiles(root, env) }),
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
        // EVOLVE_LOCAL_GATE=1: also run the browser gate (visual, performance, bugs) like CI does
        if (env.EVOLVE_LOCAL_GATE) {
          const base = dir + "-base";
          git(["worktree", "add", "-q", "--detach", base, "HEAD"], root);
          try {
            let pwPath = env.EVOLVE_PLAYWRIGHT || "";
            try { pwPath ||= createRequire(join(root, "game", "package.json")).resolve("playwright-core"); } catch { /* CI-style install */ }
            execFileSync(process.execPath, [join(dir, "evolve/probe.mjs"), "gate", base, dir], { cwd: dir, stdio: "pipe", timeout: 240000, env: { ...env, EVOLVE_PLAYWRIGHT: pwPath, EVOLVE_AREA: p.area || "", EVOLVE_MAX_VISUAL: p.approval ? "0.15" : "0.02" } });
          } finally { git(["worktree", "remove", "--force", base], root); }
        }
      } catch (e) {
        git(["worktree", "remove", "--force", dir], root);
        git(["branch", "-D", branch], root); // roll back
        // the change itself failed a gate: a rejection of this proposal (learned from), not an outage
        const why = String(e.stdout || "").trim().split("\n").filter((l) => /^- |FAILED/.test(l)).slice(-2).join(" ") || String(e.stderr || e.message).split("\n").find(Boolean);
        return { ref: branch, rejected: "failed validation on its branch: " + why.slice(0, 200) };
      }
      const sha = git(["rev-parse", "HEAD"], dir);
      git(["worktree", "remove", "--force", dir], root);
      return { ref: branch, sha };
    },
    /**
     * Recovery: put the editable site files back to a known-good commit, on a branch. A file is only
     * restored if every commit that touched it since then was the engine's own ("evolve: ..."), so a
     * person's edits are never overwritten; other files are left alone and listed as skipped.
     */
    async restore(good) {
      const branch = `evolve/revert-restore-${git(["rev-parse", good], root)}`;
      const dir = join(tmpdir(), "mosaicscope-" + branch.replace(/\W/g, "-"));
      git(["worktree", "add", "-q", "-b", branch, dir, "HEAD"], root);
      const restored = [], skipped = [];
      try {
        for (const p of ALLOWED_PATHS) {
          const changed = git(["diff", "--name-only", good, "HEAD", "--", p], root);
          if (!changed) continue;
          const subjects = git(["log", "--format=%s", `${good}..HEAD`, "--", p], root).split("\n").filter(Boolean);
          if (subjects.every((x) => /^evolve:/.test(x))) { git(["checkout", good, "--", p], dir); restored.push(p); } else skipped.push(p);
        }
        if (!restored.length) throw new Error("nothing safe to restore" + (skipped.length ? ` (people changed ${skipped.join(", ")})` : ""));
        git(["-c", "user.name=mosaicscope-evolve", "-c", "user.email=evolve@users.noreply.github.com", "commit", "-q", "-m", `evolve: restore ${restored.join(", ")} to known-good ${good.slice(0, 7)}`], dir);
      } catch (e) {
        git(["worktree", "remove", "--force", dir], root);
        git(["branch", "-D", branch], root);
        throw e;
      }
      git(["worktree", "remove", "--force", dir], root);
      return { ref: branch, restored, skipped };
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

/** Probe and security results: EVOLVE_PROBE / EVOLVE_SECURITY files, else the evolve-data branch. */
export function dataFiles(root = ROOT, env = process.env) {
  const out = {};
  for (const [key, file, envKey] of [["@probe", "probe.json", "EVOLVE_PROBE"], ["@security", "security.json", "EVOLVE_SECURITY"], ["@maintenance", "maintenance.json", "EVOLVE_MAINTENANCE"], ["@docs", "docs.json", "EVOLVE_DOCS"]]) {
    try {
      out[key] = env[envKey] ? readFileSync(env[envKey], "utf8") : execFileSync("git", ["show", `origin/evolve-data:${file}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch { /* not there yet */ }
  }
  return out;
}

/** CI gate: HEAD differs from base in exactly one allowed file, and that diff is a valid fix for one finding. */
export function verify(base, root = ROOT, cfg = loadConfig(process.env), headRef = process.env.GITHUB_HEAD_REF || "") {
  const changed = git(["diff", "--name-only", base, "HEAD"], root).split("\n").filter(Boolean);
  if (changed.length === 0) return { ok: false, reasons: ["no changes"] };
  // an undo: every changed file must be exactly its version from before the commit being undone
  const restore = /^evolve\/revert-restore-([0-9a-f]{7,40})$/.exec(headRef);
  if (restore) {
    const raw = (ref, p) => { try { return execFileSync("git", ["show", `${ref}:${p}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
    const bad = changed.filter((p) => !pathAllowed(p) || raw("HEAD", p) !== raw(restore[1], p));
    return bad.length ? { ok: false, reasons: ["restore doesn't match the known-good version: " + bad.join(", ")] } : { ok: true, reasons: [], lines: 0 };
  }
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
  const before = { ...dataFiles(root) };
  for (const p of READ_PATHS) { const t = show(base, p); if (t != null) before[p] = t; }
  const after = show("HEAD", path);
  if (after == null || before[path] == null) return { ok: false, reasons: ["file added or removed"] };
  const now = runChecks({ ...before, [path]: after });
  const fixed = runChecks(before).findings.filter((f) => f.path === path && !now.findings.some((g) => g.fp === f.fp));
  if (!fixed.length) return { ok: false, reasons: ["the diff fixes no known finding"] };
  // the diff must be byte-for-byte what one of the engine's own remedies produces: no hand edits slip through
  for (const f of fixed) for (const rem of ruleByKind(f.kind).remedies) {
    const ch = rem.apply(before, f);
    if (ch && ch.path === path && ch.text === after) return { ...validateChange(before, { path, text: after }, f, cfg, rem), kind: f.kind, area: ruleByKind(f.kind).area, approval: !!ruleByKind(f.kind).approval };
  }
  return { ok: false, reasons: ["the diff isn't exactly any remedy's output"] };
}

/**
 * Run one controlled experiment: the top queued problem with 2+ candidate fixes, each built in its own
 * worktree and measured by the browser gate against the unchanged site. The winner (if the evidence
 * supports one) goes through the normal pipeline as a proposal; everything is recorded in state.experiments.
 */
async function experiment(cfg) {
  const { experimentKey, decide } = await import("./core/experiments.js");
  const { normalise } = await import("./core/state.js");
  const { taskAllows } = await import("./core/memory.js");
  const io = localIo();
  const state = normalise(io.store.get());
  const now = Date.now();
  const files = await io.readFiles(Object.keys(await io.listFiles()));
  const target = runChecks(files).findings.find((f) => pathAllowed(f.path) && ruleByKind(f.kind).remedies.length > 1 && taskAllows(state, f.fp, now));
  if (!target) return console.log("no problem with competing candidates to test");
  const rems = ruleByKind(target.kind).remedies.filter((r) => { const ch = r.apply(files, target); return ch && validateChange(files, ch, target, cfg, r).ok; });
  const key = experimentKey(target.fp, rems.map((r) => r.id), git(["rev-parse", "HEAD"]));
  if ((state.experiments || []).some((e) => e.key === key)) return console.log("already ran this exact experiment; see status");
  const pw = (() => { try { return createRequire(join(ROOT, "game", "package.json")).resolve("playwright-core"); } catch { return ""; } })();
  const gateRun = (dir) => {
    const out = execFileSync(process.execPath, [join(ROOT, "evolve/probe.mjs"), "gate", ROOT, dir], { encoding: "utf8", timeout: 300000, env: { ...process.env, EVOLVE_PLAYWRIGHT: pw, EVOLVE_AREA: ruleByKind(target.kind).area }, stdio: ["ignore", "pipe", "pipe"] }).toString();
    return out;
  };
  const parse = (out, ok) => ({ ok, problems: out.split("\n").filter((l) => l.startsWith("- ")), measures: JSON.parse((out.match(/^measures (.*)$/m) || [, "{}"])[1]) });
  // baseline: the unchanged site measured the same way
  let baseOut;
  try { baseOut = gateRun(ROOT); } catch (e) { baseOut = String(e.stdout || ""); }
  const baseline = parse(baseOut, true).measures;
  const results = [];
  for (const r of rems) {
    const dir = join(tmpdir(), `mosaicscope-exp-${r.id}-${now.toString(36)}`);
    git(["worktree", "add", "-q", "--detach", dir, "HEAD"]);
    try {
      const ch = r.apply(files, target);
      writeFileSync(join(dir, ch.path), ch.text);
      let out, ok = true;
      try { out = gateRun(dir); } catch (e) { out = String(e.stdout || ""); ok = false; }
      results.push({ remedy: r.id, label: r.label, ...parse(out, ok) });
      console.log(`candidate ${r.id} (${r.label}): ${ok ? "passed" : "failed"} ${JSON.stringify(results.at(-1).measures)}`);
    } finally { git(["worktree", "remove", "--force", dir]); }
  }
  const d = decide(results, baseline);
  (state.experiments ||= []).unshift({ at: now, key, fp: target.fp, kind: target.kind, where: `${target.path}:${target.line}`, baseline, results: results.map(({ remedy, label, ok, problems, measures }) => ({ remedy, label, ok, problems: problems.slice(0, 3), measures })), winner: d.winner, verdict: d.verdict });
  state.experiments = state.experiments.slice(0, 15);
  io.store.put(state);
  console.log(`verdict: ${d.verdict}${d.winner ? ` -> promote remedy ${d.winner}` : ""}`);
  if (d.winner) {
    const rem = rems.find((r) => r.id === d.winner);
    const p = { fp: target.fp, kind: target.kind, path: target.path, line: target.line, remedy: rem.id, label: rem.label, risk: rem.meta.risk || 0, agent: "experiment", score: 0, at: now, area: ruleByKind(target.kind).area };
    const ch = rem.apply(files, target);
    const pub = await io.publish({ ...p, change: ch, lines: 0, title: `evolve: ${ruleByKind(target.kind).label} (${target.path}) — ${rem.label} [experiment winner]` });
    console.log(pub.rejected ? `promotion rejected: ${pub.rejected}` : `promoted on ${pub.ref}`);
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const cfg = loadConfig(process.env);
  if (cmd === "check") {
    const r = runChecks({ ...readLocal(READ_PATHS), ...dataFiles() });
    for (const f of r.findings) console.log(`fix   ${f.kind.padEnd(13)} ${f.path}:${f.line}${pathAllowed(f.path) ? "" : "  (read-only)"}`);
    for (const f of r.weaknesses) console.log(`note  ${f.kind.padEnd(13)} ${f.path}:${f.line} ${JSON.stringify(f.data)}`);
    if (!r.findings.length && !r.weaknesses.length) console.log("nothing found");
  } else if (cmd === "cycle") {
    const r = await runCycle(localIo({ dry: process.argv.includes("--dry") }), cfg);
    console.log(r.result);
    const p = r.state?.proposals?.[0];
    if (p && p.at === r.state.lastCycle?.at) console.log("innovator:", p.innovator, "\noptimiser:", p.optimiser, "\nwinner:", p.winner);
  } else if (cmd === "experiment") {
    await experiment(cfg);
  } else if (cmd === "status") {
    console.log(JSON.stringify(existsSync(STATE) ? publicView(JSON.parse(readFileSync(STATE, "utf8"))) : { note: "no local state yet" }, null, 1));
  } else if (cmd === "verify") {
    const r = verify(arg || "origin/main");
    console.log(r.ok ? `ok: ${r.kind || "undo"}, ${r.lines} changed lines${r.approval ? ", needs approval" : ""}` : "FAILED: " + r.reasons.join("; "));
    // tell the workflow what kind of change this is (performance changes must prove a measured gain)
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `area=${r.area || ""}\napproval=${r.approval ? "true" : "false"}\n`, { flag: "a" });
    process.exitCode = r.ok ? 0 : 1;
  } else {
    console.log("usage: node evolve/cli.mjs check | cycle [--dry] | experiment | status | verify <base-ref>");
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
