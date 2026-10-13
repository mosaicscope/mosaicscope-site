// Turns a browser-probe report (evolve/probe.mjs, run by GitHub Actions) into graded issues.
// Severity: critical (site broken: pauses the engine and undoes the last change),
// high (something a visitor will hit), medium, low. Fixable: a rule in rules.js can repair it.

import { hash } from "./html.js";

export const SEVERITY = ["critical", "high", "medium", "low"];

export function classify(probe) {
  if (!probe || !Array.isArray(probe.results)) return [];
  const out = new Map();
  const add = (kind, severity, page, detail, fixable = false, data = {}) => {
    const fp = `${kind}|${page}|${hash(detail)}`;
    if (!out.has(fp)) out.set(fp, { fp, kind, severity, page, detail: String(detail).slice(0, 140), fixable, data });
  };
  for (const r of probe.results) {
    const at = `${r.page} @${r.width}`;
    if (!r.status || r.status >= 500) add("down", "critical", r.page, `HTTP ${r.status || "no response"} ${at}`);
    for (const e of r.errors || []) add("js-error", "critical", r.page, e);
    for (const f of (r.failed || []).filter((x) => x.own)) add("own-request-failed", /\.(js|css)(\?|$)/.test(f.url) ? "critical" : "high", r.page, `${f.url} ${f.why}`);
    for (const f of (r.failed || []).filter((x) => !x.own)) add("third-party-failed", "low", r.page, `${f.url.replace(/^https?:\/\//, "").split("/")[0]} ${f.why}`);
    for (const c of (r.consoleErrors || []).filter((x) => x.own)) add("console-error", "high", r.page, c.text);
    for (const b of r.interactions?.broken || []) add("broken-interaction", "high", r.page, `clicking "${b.button}": ${b.error}`);
    const ui = r.ui;
    if (ui) {
      if (ui.overflowPx > 0 && r.width < 500) add("mobile-overflow", "high", r.page, `page is ${ui.overflowPx}px wider than a phone screen`);
      for (const t of ui.smallTargets || []) add("small-target", "medium", r.page, t.el, true, { sel: t.el, h: t.h, w: t.w });
      for (const c of ui.lowContrast || []) add("low-contrast", "medium", r.page, `${c.el} ${c.ratio}:1`, false, { sel: c.el, ratio: c.ratio });
      for (const s of ui.noFocusStyle || []) add("no-focus-style", "medium", r.page, s, true, { sel: s });
      for (const s of (ui.smallText || []).slice(0, 5)) add("small-text", "low", r.page, `${s.el} ${s.px}px`);
    }
    const p = r.perf;
    if (p) {
      if (p.cls > 0.25) add("layout-shift", "high", r.page, `CLS ${p.cls} ${at}`);
      else if (p.cls > 0.1) add("layout-shift", "medium", r.page, `CLS ${p.cls} ${at}`);
      if (probe.target !== "local" && p.lcpMs > 4000) add("slow-lcp", "high", r.page, `LCP ${p.lcpMs}ms ${at}`);
      else if (probe.target !== "local" && p.lcpMs > 2500) add("slow-lcp", "medium", r.page, `LCP ${p.lcpMs}ms ${at}`);
      if (p.renderBlocking > 2) add("render-blocking", "medium", r.page, `${p.renderBlocking} render-blocking files`);
      if (p.heapMB > 60) add("heavy-memory", "low", r.page, `${p.heapMB} MB JS heap ${at}`);
      if (p.domNodes > 1500) add("big-dom", "low", r.page, `${p.domNodes} DOM nodes ${at}`);
      if (probe.target !== "local" && p.tbtMs > 600) add("main-thread", "medium", r.page, `${p.tbtMs}ms blocked by long tasks ${at}`);
    }
  }
  return [...out.values()].sort((a, b) => SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity));
}

export const critical = (issues) => issues.filter((i) => i.severity === "critical");

/** A small summary for the dashboard and for the engine's memory. */
export function probeSummary(probe) {
  if (!probe?.results) return null;
  const home = probe.results.filter((r) => r.page === "/");
  const pick = (w) => home.find((r) => r.width === w) || {};
  const m = pick(390), d = pick(1280);
  return {
    at: probe.at,
    mobile: m.perf ? { lcpMs: m.perf.lcpMs, cls: m.perf.cls, tbtMs: m.perf.tbtMs, kb: m.ownBytes, requests: m.requests, heapMB: m.perf.heapMB } : null,
    desktop: d.perf ? { lcpMs: d.perf.lcpMs, cls: d.perf.cls, tbtMs: d.perf.tbtMs, kb: d.ownBytes, requests: d.requests, heapMB: d.perf.heapMB } : null,
  };
}

/**
 * The number used to measure whether a change helped, from a probe report. Lower is better.
 * perf: own kilobytes + 20 per render-blocking file + 1000 x layout shift, summed over pages and widths.
 * a11y / ux: how many accessibility and UI issues the probe sees. Other areas aren't measurable this way.
 */
export function metricFor(area, probe) {
  if (!probe?.results) return null;
  if (area === "perf") return Math.round(probe.results.reduce((n, r) => n + (r.ownBytes || 0) + 20 * (r.perf?.renderBlocking || 0) + 1000 * (r.perf?.cls || 0), 0));
  if (area === "a11y" || area === "ux") return classify(probe).filter((i) => ["small-target", "no-focus-style", "low-contrast", "mobile-overflow"].includes(i.kind)).length;
  return null;
}
