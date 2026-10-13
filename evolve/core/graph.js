// A compact knowledge graph of the site, rebuilt incrementally from file text (no database).
// Nodes: page, style, script, api, selector, feature, test, issue, change, task, decision.
// Edges: loads, uses, calls, styles, affects, tests, found-on, changed, blocks.
// Used to answer "what does this change touch?" so a CSS edit is gated on every page that uses it,
// and to give an agent only the few facts relevant to one task.

import { scanTags } from "./html.js";

const API = /fetch\(\s*["'`](\/api\/[\w-]+)/g;
const CLASS_IN_CSS = /\.([a-zA-Z][\w-]*)/g;

/** Build the graph from site files. Returns { nodes: {id: type}, edges: [[from, rel, to]], hashes } */
export function buildGraph(files, previous = null, extras = {}) {
  const nodes = {}, edges = [];
  const node = (id, type) => (nodes[id] ||= type) && id;
  const edge = (a, rel, b) => edges.push([a, rel, b]);
  const htmlPages = Object.keys(files).filter((p) => p.endsWith(".html"));
  const classesByPage = {};
  for (const p of htmlPages) {
    const page = node("page:" + p, "page");
    const tags = scanTags(files[p]);
    classesByPage[p] = new Set();
    for (const t of tags) {
      if (t.name === "link" && /stylesheet/.test(t.attrs.rel || "") && t.attrs.href && !/^https?:/.test(t.attrs.href)) edge(page, "loads", node("style:" + t.attrs.href.replace(/^\//, ""), "style"));
      if (t.name === "script" && t.attrs.src && !/^https?:/.test(t.attrs.src)) edge(page, "loads", node("script:" + t.attrs.src.replace(/^\//, ""), "script"));
      for (const c of (t.attrs.class || "").split(/\s+/).filter(Boolean)) classesByPage[p].add(c);
      if (t.attrs.id && /^(work|rates|quote|contact|faq|instagram|booking|services|gallery)$/.test(t.attrs.id)) edge(node("feature:" + t.attrs.id, "feature"), "on", page);
    }
  }
  // scripts: which APIs they call, and which classes they add at runtime
  for (const [p, text] of Object.entries(files)) {
    if (!/\.m?js$/.test(p) || p.startsWith("evolve/")) continue;
    const sc = node("script:" + p, "script");
    for (const m of text.matchAll(API)) edge(sc, "calls", node("api:" + m[1], "api"));
  }
  // stylesheets: which selectors exist, and which pages actually use them
  for (const [p, text] of Object.entries(files)) {
    if (!p.endsWith(".css")) continue;
    const st = node("style:" + p, "style");
    const seen = new Set();
    for (const m of text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(CLASS_IN_CSS)) {
      const c = m[1];
      if (seen.has(c)) continue;
      seen.add(c);
      for (const [page, set] of Object.entries(classesByPage)) if (set.has(c)) edge(st, "styles", "page:" + page);
    }
  }
  for (const [a, rel, b] of extras.edges || []) { node(a, a.split(":")[0]); node(b, b.split(":")[0]); edge(a, rel, b); }
  return { nodes, edges: dedupe(edges), builtAt: extras.now || 0, from: previous?.builtAt || 0 };
}

function dedupe(edges) {
  const s = new Set(), out = [];
  for (const e of edges) { const k = e.join(">"); if (!s.has(k)) { s.add(k); out.push(e); } }
  return out;
}

/** Pages affected by a change to a file (and, for CSS, to a selector). */
export function impactOf(graph, path) {
  const pages = new Set();
  const id = (path.endsWith(".css") ? "style:" : path.endsWith(".html") ? "page:" : "script:") + path;
  if (id.startsWith("page:")) pages.add(path);
  for (const [a, rel, b] of graph.edges) {
    if (a === id && (rel === "styles") && b.startsWith("page:")) pages.add(b.slice(5));
    if (b === id && rel === "loads" && a.startsWith("page:")) pages.add(a.slice(5));
  }
  return [...pages].sort();
}

/** Attach issues, changes and tasks as nodes so "what's known about this page" is one lookup. */
export function linkKnowledge(graph, state) {
  for (const i of state.issues || []) {
    const page = "page:" + (i.page === "/" ? "index.html" : String(i.page).replace(/^\//, "").replace(/\/$/, "/index.html"));
    graph.nodes["issue:" + i.fp] = "issue";
    graph.edges.push(["issue:" + i.fp, "found-on", page]);
  }
  const FEATURE = { "nav-to-rates": "rates", "quote-builder": "quote", "contact-validation": "contact", "faq-opens": "faq", "work-viewer": "work" };
  for (const j of state.journeys || []) {
    graph.nodes["test:journey:" + j.id] = "test";
    if (FEATURE[j.id]) graph.edges.push(["test:journey:" + j.id, "tests", "feature:" + FEATURE[j.id]]);
  }
  for (const h of (state.history || []).slice(0, 20)) {
    graph.nodes["change:" + h.at] = "change";
    graph.edges.push(["change:" + h.at, "changed", (h.path.endsWith(".css") ? "style:" : "page:") + h.path]);
  }
  for (const t of (state.backlog || []).slice(0, 20)) {
    graph.nodes["task:" + t.id] = "task";
    const target = t.where.split(/[: ]/)[0];
    if (target) graph.edges.push(["task:" + t.id, "affects", (target.endsWith(".css") ? "style:" : target.startsWith("/") ? "page:" : "page:") + (target === "/" ? "index.html" : target.replace(/^\//, "").replace(/\/$/, "/index.html"))]);
  }
  return graph;
}

/** The handful of facts relevant to one target, for an agent prompt or the dashboard. Never the whole graph. */
export function contextFor(graph, target, limit = 8) {
  const out = [];
  for (const [a, rel, b] of graph.edges) if (a === target || b === target) out.push(`${a} ${rel} ${b}`);
  return out.slice(0, limit);
}

export function graphStats(graph) {
  const by = {};
  for (const t of Object.values(graph.nodes)) by[t] = (by[t] || 0) + 1;
  return { nodes: Object.keys(graph.nodes).length, edges: graph.edges.length, by };
}
