#!/usr/bin/env node
// Security guard runner.
//   node evolve/security.mjs scan [out.json]   scan every tracked text file (fast, no network)
//   node evolve/security.mjs gate <base-ref>   CI: fail on NEW high/critical findings versus base
//   node evolve/security.mjs deps [out.json]   deeper: npm audit of game/ (needs network)

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSecurity, newFindings, summarise } from "./core/security.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /^(world\/assets\/|game\/node_modules\/|game\/public\/|images\/|.*\.(png|jpe?g|webp|gif|mp3|mp4|ico|woff2?|lock)$|.*package-lock\.json$)/;
const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });

export function filesAt(ref) {
  const list = (ref ? git(["ls-tree", "-r", "--name-only", ref]) : git(["ls-files"])).split("\n").filter((p) => p && !SKIP.test(p));
  const out = {};
  for (const p of list) {
    try {
      const t = ref ? git(["show", `${ref}:${p}`]) : readFileSync(join(ROOT, p), "utf8");
      if (t.length < 2_000_000 && !t.includes("\u0000")) out[p] = t;
    } catch { /* deleted or binary */ }
  }
  return out;
}

function deps() {
  try {
    const raw = execFileSync("npm", ["audit", "--json", "--omit=dev"], { cwd: join(ROOT, "game"), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return JSON.parse(raw).metadata?.vulnerabilities || {};
  } catch (e) {
    try { return JSON.parse(e.stdout).metadata?.vulnerabilities || {}; } catch { return { error: "npm audit unavailable" }; }
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "scan") {
  const list = scanSecurity(filesAt(""));
  const out = { at: Date.now(), counts: summarise(list), findings: list.slice(0, 60) };
  if (arg) writeFileSync(arg, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.counts));
  for (const f of list.filter((x) => x.severity !== "low").slice(0, 20)) console.log(`${f.severity.padEnd(8)} ${f.kind.padEnd(28)} ${f.path}:${f.line}`);
} else if (cmd === "gate") {
  const fresh = newFindings(scanSecurity(filesAt(arg || "origin/main")), scanSecurity(filesAt("")), "high");
  if (fresh.length) {
    console.log("security gate FAILED: new findings\n" + fresh.map((f) => `- ${f.severity} ${f.kind} ${f.path}:${f.line}`).join("\n"));
    process.exitCode = 1;
  } else console.log("security gate: ok (no new high or critical findings)");
} else if (cmd === "deps") {
  const v = deps();
  if (arg) writeFileSync(arg, JSON.stringify({ at: Date.now(), vulnerabilities: v }, null, 1));
  console.log(JSON.stringify(v));
} else {
  console.log("usage: node evolve/security.mjs scan [out.json] | gate <base-ref> | deps [out.json]");
  process.exitCode = 2;
}
