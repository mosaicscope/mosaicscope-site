// Self-maintaining codebase: deterministic static analysis (no AI, no new tools).
// Duplicate code, oversized modules, long functions, circular imports, formatting drift, dead exports,
// unused CSS classes and unused dependencies. Reported with a severity and the smallest safe next step;
// nothing here rewrites code on its own (refactors need a person and real tests).

import { hash } from "./html.js";

const isCode = (p) => /\.(m?js|ts)$/.test(p);
const own = (p) => !/^(world\/assets|game\/node_modules|game\/public|images)\//.test(p) && !/\.min\.js$/.test(p);

export function scanMaintenance(files) {
  const out = [];
  const add = (kind, severity, where, detail, fix) => out.push({ kind, severity, where, detail, fix, fp: `${kind}|${hash(where + detail)}` });
  const code = Object.entries(files).filter(([p]) => isCode(p) && own(p));

  // duplicate blocks: 8 normalised non-trivial lines appearing in two places
  const windows = new Map();
  for (const [p, t] of code) {
    const lines = t.split("\n").map((l) => l.trim()).map((l, i) => [l, i + 1]).filter(([l]) => l.length > 12 && !/^(\/\/|\*|import |export \{|\}|\);?$)/.test(l));
    for (let i = 0; i + 8 <= lines.length; i++) {
      const key = hash(lines.slice(i, i + 8).map(([l]) => l).join("\n"));
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key).push(`${p}:${lines[i][1]}`);
    }
  }
  const dupes = [...windows.values()].filter((v) => v.length > 1 && new Set(v).size > 1);
  const seenPairs = new Set();
  for (const v of dupes) {
    const k = v.map((x) => x.split(":")[0]).sort().join("+");
    if (seenPairs.has(k)) continue;
    seenPairs.add(k);
    add("duplicate-code", "low", v.slice(0, 2).join(" = "), `8+ identical lines in ${v.length} places`, "extract a shared helper");
  }

  for (const [p, t] of code) {
    const lines = t.split("\n");
    if (lines.length > 1500) add("oversized-module", "medium", p, `${lines.length} lines`, "split by feature into modules");
    else if (lines.length > 800) add("oversized-module", "low", p, `${lines.length} lines`, "consider splitting");
    // long functions: brace-matched bodies longer than 150 lines
    const starts = [];
    lines.forEach((l, i) => { if (/\bfunction\b[\s\w]*\(|=>\s*\{\s*$/.test(l)) starts.push(i); });
    let reported = 0;
    for (const s of starts) {
      let depth = 0, end = -1, opened = false;
      for (let i = s; i < lines.length && i < s + 2000; i++) {
        for (const ch of lines[i].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) { if (ch === "{") { depth++; opened = true; } else if (ch === "}") depth--; }
        if (opened && depth <= 0) { end = i; break; }
      }
      if (end - s > 150 && reported < 3) { add("long-function", "low", `${p}:${s + 1}`, `${end - s} lines`, "split into named steps"); reported++; }
    }
    // formatting drift
    const trailing = lines.filter((l) => /[ \t]+$/.test(l)).length;
    const tabs = lines.filter((l) => /^\t/.test(l)).length, spaces = lines.filter((l) => /^ {2}/.test(l)).length;
    if (t.includes("\r\n")) add("format", "low", p, "Windows line endings", "convert to LF");
    if (trailing > 5) add("format", "low", p, `${trailing} lines with trailing spaces`, "strip trailing whitespace");
    if (tabs > 5 && spaces > 5) add("format", "low", p, "mixes tab and space indentation", "pick one");
  }

  // circular imports between our own modules
  const graph = {};
  for (const [p, t] of code) {
    graph[p] = [...t.matchAll(/^\s*import[^"'`]*["'`](\.[^"'`]+)["'`]/gm)].map((m) => resolve(p, m[1])).filter((x) => files[x] != null);
  }
  for (const cyc of cycles(graph).slice(0, 5)) add("circular-import", "low", cyc.join(" -> "), "modules import each other", "move the shared part into its own module");

  // dead exports: exported from a module under evolve/ or functions/ but never imported anywhere
  const allText = code.map(([, t]) => t).join("\n");
  for (const [p, t] of code) {
    if (!/^(evolve|functions)\//.test(p) || /test|worker\/index|cli\.mjs|probe\.mjs|functions\/api/.test(p)) continue;
    for (const m of t.matchAll(/^export (?:async )?function (\w+)/gm)) {
      const name = m[1];
      const uses = allText.split(new RegExp(`\\b${name}\\b`)).length - 1;
      if (uses <= 1) add("dead-code", "low", `${p}`, `export ${name} is never used`, "remove it or use it");
    }
  }

  // unused CSS classes (in the site stylesheet, not referenced by any page or script)
  const css = files["styles.css"];
  if (css) {
    const refs = Object.entries(files).filter(([p]) => /\.(html|m?js)$/.test(p) && own(p)).map(([, t]) => t).join("\n");
    const unused = [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([a-z][\w-]{2,})(?=[\s,.:{[>+~)])/g)].map((m) => m[1]))]
      .filter((c) => !refs.includes(c) && !refs.includes(c.split("--")[0] + "--"));
    if (unused.length) add("unused-css", unused.length > 20 ? "medium" : "low", "styles.css", `${unused.length} classes never referenced (e.g. ${unused.slice(0, 4).join(", ")})`, "remove after checking content.json-driven markup");
  }

  // unused dependencies in game/
  const pkg = files["game/package.json"];
  if (pkg) {
    let deps = {};
    try { deps = JSON.parse(pkg).dependencies || {}; } catch { /* bad json is its own problem */ }
    const src = Object.entries(files).filter(([p]) => p.startsWith("game/src/") || p.startsWith("game/scripts/")).map(([, t]) => t).join("\n");
    for (const d of Object.keys(deps)) if (!src.includes(`"${d}`) && !src.includes(`'${d}`)) add("unused-dependency", "low", "game/package.json", `${d} is never imported`, "remove it");
  }
  return out;
}

export function maintenanceTotals(list) {
  const t = {};
  for (const f of list) t[f.kind] = (t[f.kind] || 0) + 1;
  return t;
}

function resolve(from, rel) {
  const parts = from.split("/").slice(0, -1);
  for (const seg of rel.split("/")) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); }
  return parts.join("/");
}

function cycles(graph) {
  const out = [], state = {}, stack = [];
  const visit = (n) => {
    state[n] = 1; stack.push(n);
    for (const m of graph[n] || []) {
      if (state[m] === 1) out.push([...stack.slice(stack.indexOf(m)), m]);
      else if (!state[m]) visit(m);
    }
    stack.pop(); state[n] = 2;
  };
  for (const n of Object.keys(graph)) if (!state[n]) visit(n);
  return out;
}
