// Documentation engine: keeps docs aligned with the code, deterministically.
// Finds: paths the docs mention that don't exist, EVOLVE_* settings missing from (or stale in) the docs,
// API endpoints and workflows nobody documented, and CLI commands the docs show that the tools don't have.
// Generates one thing itself: the settings table in evolve/README.md between markers (git keeps history).

import { DEFAULTS } from "./config.js";
import { hash } from "./html.js";

const DOCS = (files) => Object.keys(files).filter((p) => /(^|\/)README\.md$|^docs\/.+\.md$/.test(p));

export function checkDocs(files) {
  const out = [];
  const add = (kind, severity, where, detail) => out.push({ kind, severity, where, detail, fp: `${kind}|${hash(where + detail)}` });
  const docs = DOCS(files);
  const allDocs = docs.map((p) => files[p]).join("\n");

  for (const d of docs) {
    const base = d.includes("/") ? d.slice(0, d.lastIndexOf("/") + 1) : "";
    for (const m of files[d].matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.(?:m?js|json|ya?ml|toml|html|css|md))`/g)) {
      const p = m[1];
      if (/^(probe|security|audit|deps|out|state)\.json$/.test(p) || p.includes("<")) continue; // generated at runtime
      const candidates = [p, base + p, "evolve/" + p, ".github/workflows/" + p, "functions/" + p, "game/" + p];
      if (!candidates.some((c) => files[c] != null)) add("doc-dead-path", "low", d, `mentions \`${p}\`, which doesn't exist`);
    }
    for (const m of files[d].matchAll(/node evolve\/(\w+)\.mjs (\w[\w-]*)/g)) {
      const tool = files[`evolve/${m[1]}.mjs`];
      if (tool == null) add("doc-dead-command", "medium", d, `shows evolve/${m[1]}.mjs, which doesn't exist`);
      else if (!tool.includes(`"${m[2]}"`) && !tool.includes(`'${m[2]}'`)) add("doc-dead-command", "medium", d, `shows \`${m[1]} ${m[2]}\`, which the tool doesn't accept`);
    }
  }
  const readme = files["evolve/README.md"] || "";
  for (const k of Object.keys(DEFAULTS)) if (!readme.includes("EVOLVE_" + k)) add("doc-missing-setting", "low", "evolve/README.md", `EVOLVE_${k} isn't documented`);
  for (const m of readme.matchAll(/EVOLVE_([A-Z_]+)/g)) {
    const k = m[1];
    if (!(k in DEFAULTS) && !["AUTO_MERGE", "PROBE", "SECURITY", "LOCAL_GATE", "SHOTS", "AREA", "MAX_VISUAL", "PLAYWRIGHT", "CHROMIUM", "SITE_URL", "ADMIN_TOKEN"].includes(k)) add("doc-stale-setting", "low", "evolve/README.md", `documents EVOLVE_${k}, which no longer exists`);
  }
  for (const p of Object.keys(files).filter((x) => /^functions\/api\/[\w-]+\.js$/.test(x))) {
    const ep = "/api/" + p.slice(14, -3);
    if (!allDocs.includes(ep)) add("doc-missing-api", "low", p, `${ep} isn't mentioned in any README`);
  }
  for (const p of Object.keys(files).filter((x) => /^\.github\/workflows\/[\w-]+\.ya?ml$/.test(x))) {
    const name = p.split("/").pop().replace(/\.ya?ml$/, "");
    if (!allDocs.includes(name)) add("doc-missing-workflow", "low", p, `workflow ${name} isn't mentioned in any README`);
  }
  return out;
}

/** Hash of every doc and every file the docs describe: unchanged = skip the whole check. */
export function docsKey(files) {
  return hash(Object.keys(files).filter((p) => /\.(md|m?js|ya?ml)$/.test(p)).sort().map((p) => p + hash(files[p])).join("|"));
}

/** The generated settings table (between markers in evolve/README.md). */
export function settingsTable(configSource) {
  const rows = [];
  for (const m of configSource.matchAll(/^\s{2}([A-Z_]+):\s*([^,\n]+),\s*(?:\/\/\s*(.*))?$/gm)) rows.push(`| \`EVOLVE_${m[1]}\` | \`${m[2].trim()}\` | ${(m[3] || "").trim()} |`);
  return ["| Setting | Default | What it does |", "|---|---|---|", ...rows].join("\n");
}

export function applySettingsTable(readme, table) {
  const a = "<!-- evolve:settings:start (generated from core/config.js; edit there) -->", b = "<!-- evolve:settings:end -->";
  const block = `${a}\n${table}\n${b}`;
  if (readme.includes(a) && readme.includes(b)) return readme.slice(0, readme.indexOf(a)) + block + readme.slice(readme.indexOf(b) + b.length);
  return readme.replace("## Hard limits and safety", `## Hard limits and safety\n\n${block}\n`);
}
