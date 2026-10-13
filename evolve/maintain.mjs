#!/usr/bin/env node
// Code maintenance and documentation runner (no AI).
//   node evolve/maintain.mjs code [out.json]   duplicates, oversized modules, long functions, cycles, format, dead code
//   node evolve/maintain.mjs docs [out.json]   docs that disagree with the code
//   node evolve/maintain.mjs docs-fix          regenerate the settings table in evolve/README.md (git keeps history)
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { filesAt, ROOT } from "./repo.mjs";
import { scanMaintenance, maintenanceTotals } from "./core/maintain.js";
import { checkDocs, docsKey, settingsTable, applySettingsTable } from "./core/docs.js";

const [cmd, out] = process.argv.slice(2);
const files = filesAt("");
if (cmd === "code") {
  const list = scanMaintenance(files);
  const r = { at: Date.now(), totals: maintenanceTotals(list), findings: list.slice(0, 60) };
  if (out) writeFileSync(out, JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r.totals));
  for (const f of list.filter((x) => x.severity !== "low").concat(list.filter((x) => x.severity === "low")).slice(0, 15)) console.log(`${f.severity.padEnd(7)} ${f.kind.padEnd(18)} ${f.where}  ${f.detail}`);
} else if (cmd === "docs") {
  // skip entirely when no doc and no described file changed since the last check
  const cache = join(ROOT, "evolve/.state/docs-key");
  const key = docsKey(files);
  if (!out && existsSync(cache) && readFileSync(cache, "utf8") === key) { console.log("docs unchanged since last check"); process.exit(0); }
  const list = checkDocs(files);
  if (out) writeFileSync(out, JSON.stringify({ at: Date.now(), key, findings: list }, null, 1));
  mkdirSync(join(ROOT, "evolve/.state"), { recursive: true });
  writeFileSync(cache, key);
  console.log(`${list.length} documentation problems`);
  for (const f of list.slice(0, 20)) console.log(`${f.severity.padEnd(7)} ${f.kind.padEnd(22)} ${f.where}  ${f.detail}`);
} else if (cmd === "docs-fix") {
  const p = join(ROOT, "evolve/README.md");
  const before = readFileSync(p, "utf8");
  const after = applySettingsTable(before, settingsTable(readFileSync(join(ROOT, "evolve/core/config.js"), "utf8")));
  if (after === before) console.log("settings table already up to date");
  else { writeFileSync(p, after); console.log("updated the settings table in evolve/README.md (review with git diff)"); }
} else {
  console.log("usage: node evolve/maintain.mjs code [out.json] | docs [out.json] | docs-fix");
  process.exitCode = 2;
}
