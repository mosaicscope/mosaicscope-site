#!/usr/bin/env node
// Security guard runner.
//   node evolve/security.mjs scan [out.json]   scan every tracked text file (fast, no network)
//   node evolve/security.mjs gate <base-ref>   CI: fail on NEW high/critical findings versus base
//   node evolve/security.mjs deps [out.json]   deeper: npm audit of game/ (needs network)

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanSecurity, newFindings, summarise } from "./core/security.js";

import { filesAt, ROOT } from "./repo.mjs";

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
