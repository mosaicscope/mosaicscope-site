#!/usr/bin/env node
// The browser probe: one headless Chromium pass per page and width that measures what the
// static checks can't. Runs in GitHub Actions (and locally); the Cloudflare Worker only reads its results.
//
//   bugs:   page errors, console errors, failed requests, errors after clicking each button
//   perf:   requests, bytes, render-blocking files, LCP, CLS, long-task time, JS heap, DOM size
//   ui:     horizontal overflow, small tap targets, tiny text, low contrast, missing focus styles
//   visual: screenshots, and a pixel diff between two versions of the site
//
//   node evolve/probe.mjs report <url-or-dir> [out.json]   measure the live site or a folder
//   node evolve/probe.mjs gate <base-dir> <head-dir>        CI: head must not regress against base
//
// No AI is involved anywhere in here.

import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAGES = ["/", "/house/", "/404.html"];
export const WIDTHS = [[390, 844], [1280, 800]];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };

/** Serve a folder like Pages does. /api/* answers {} so pages that call their functions still load. */
export function serveDir(dir) {
  const root = resolve(dir);
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); return res.end("{}"); }
    let p = join(root, decodeURIComponent(u.pathname));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    try {
      const body = await readFile(p);
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
      res.end(body);
    } catch {
      const nf = await readFile(join(root, "404.html")).catch(() => "Not found");
      res.writeHead(404, { "content-type": "text/html" });
      res.end(nf);
    }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}

export async function launch() {
  // EVOLVE_PLAYWRIGHT pins the exact module (the local runner passes the repo's own copy into worktrees,
  // so a different global Playwright on NODE_PATH can't be picked up by mistake)
  let pw;
  if (process.env.EVOLVE_PLAYWRIGHT) pw = createRequire(import.meta.url)(process.env.EVOLVE_PLAYWRIGHT);
  else try { pw = await import("playwright-core"); } catch {
    pw = createRequire(join(ROOT, "game", "package.json"))("playwright-core");
  }
  const chromium = pw.chromium || pw.default?.chromium;
  // this sandbox ships a matching Chromium at /opt/pw-browsers/chromium; CI uses Playwright's own download
  const executablePath = process.env.EVOLVE_CHROMIUM || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  return chromium.launch({ executablePath, args: ["--no-sandbox"], timeout: 30000 });
}

// Installed before any page script: buffered observers for LCP, layout shift and long tasks.
const INIT = `(() => {
  const m = (window.__probe = { lcp: 0, cls: 0, tbt: 0, longTasks: 0 });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lcp = Math.max(m.lcp, e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.longTasks++; m.tbt += Math.max(0, e.duration - 50); } }).observe({ type: "longtask", buffered: true }); } catch (e) {}
})();`;

// Runs in the page after load: UI measurements. Kept dependency-free and bounded (first 40 of each).
function uiAudit() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
  // a CSS selector for the element: its id, else its first class, else parent > tag (up to 3 levels)
  const one = (el) => el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : "");
  const sel = (el) => { let s = one(el); for (let e = el.parentElement, n = 0; e && n < 2 && !el.id && !el.classList[0] && !s.startsWith("#"); e = e.parentElement, n++) { s = one(e) + " > " + s; if (e.id || e.classList[0]) break; } return s; };
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.9) return c; } return [255, 255, 255]; };
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), smallTargets: [], smallText: [], lowContrast: [], noFocusStyle: [] };
  for (const el of document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[role=button]")) {
    if (!vis(el) || out.smallTargets.length >= 40) continue;
    if (el.tabIndex < 0 || el.closest("[aria-hidden=true]")) continue;          // not reachable (e.g. a spam trap)
    if (el.closest("label") && el.closest("label").getBoundingClientRect().height >= 24) continue; // the label is the target
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    const inline = s.display === "inline" && el.closest("p,li,dd,td,figcaption");
    if (!inline && (r.width < 24 || r.height < 24)) out.smallTargets.push({ el: sel(el), w: Math.round(r.width), h: Math.round(r.height) });
  }
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (out.smallText.length >= 40 && out.lowContrast.length >= 40) break;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) || !vis(el)) continue;
    const s = getComputedStyle(el), size = parseFloat(s.fontSize), key = sel(el);
    if (seen.has(key)) continue;
    seen.add(key);
    if (size < 12 && out.smallText.length < 40) out.smallText.push({ el: key, px: size });
    const fg = parse(s.color);
    if ((fg[3] ?? 1) < 0.5) continue;
    // text over an image or gradient can't be judged from colours alone: skip it rather than guess
    let img = false;
    for (let e = el; e && !img; e = e.parentElement) { const st = getComputedStyle(e); if (st.backgroundImage !== "none" || ["IMG", "VIDEO", "CANVAS"].some((t) => e.parentElement?.querySelector(":scope > " + t.toLowerCase()))) img = true; if (parse(st.backgroundColor)[3] !== 0 && parse(st.backgroundColor).length >= 3 && (parse(st.backgroundColor)[3] ?? 1) > 0.9) break; }
    if (img) continue;
    const L1 = lum(fg), L2 = lum(bgOf(el)), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5) && out.lowContrast.length < 40) out.lowContrast.push({ el: key, ratio: Math.round(ratio * 100) / 100 });
  }
  return out;
}

// Where every line of visible text starts (first 400 text nodes). A fix that isn't a feature must
// leave all of these where they were: catching "moved everything 6px" that a pixel ratio misses.
function textLayout() {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = w.nextNode(); n && out.length < 400; n = w.nextNode()) {
    if (n.textContent.trim().length < 2) continue;
    range.selectNodeContents(n);
    const r = range.getClientRects()[0];
    if (!r || r.width === 0) continue;
    out.push([n.textContent.trim().slice(0, 24), Math.round(r.left + scrollX), Math.round(r.top + scrollY)]);
  }
  return out;
}

function perfSnapshot() {
  const nav = performance.getEntriesByType("navigation")[0] || {};
  const res = performance.getEntriesByType("resource");
  const head = document.head;
  const blocking = head ? [...head.querySelectorAll('link[rel=stylesheet],script[src]:not([defer]):not([async]):not([type=module])')].length : 0;
  return {
    domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0), loadMs: Math.round(nav.loadEventEnd || 0),
    lcpMs: Math.round(window.__probe?.lcp || 0), cls: Math.round((window.__probe?.cls || 0) * 1000) / 1000,
    tbtMs: Math.round(window.__probe?.tbt || 0), longTasks: window.__probe?.longTasks || 0,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
    domNodes: document.getElementsByTagName("*").length, renderBlocking: blocking, resourceEntries: res.length,
    screens: Math.round(document.documentElement.scrollHeight / innerHeight * 10) / 10,
  };
}

/** Measure one page at one width. */
export async function probePage(browser, url, [w, h], { interact = true, shot = false, offline = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const origin = new URL(url).origin;
  const own = (u) => { try { return new URL(u).origin === origin; } catch { return false; } };
  // comparing two local copies: third-party requests are noise (and slow), so they're cut off
  if (offline) await page.route((u) => !own(u.href) && !u.href.startsWith("data:"), (route) => route.abort("blockedbyclient"));
  const r = { url, width: w, errors: [], consoleErrors: [], failed: [], requests: 0, bytes: 0, ownBytes: 0, thirdParty: 0, status: 0 };
  page.on("pageerror", (e) => r.errors.push(String(e.message).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") r.consoleErrors.push({ text: m.text().slice(0, 160), own: own(m.location()?.url || url) }); });
  page.on("requestfailed", (q) => (offline && !own(q.url())) || r.failed.push({ url: q.url().slice(0, 120), own: own(q.url()), why: q.failure()?.errorText || "" }));
  page.on("response", (s) => { if (s.status() >= 400 && s.url() !== url) r.failed.push({ url: s.url().slice(0, 120), own: own(s.url()), why: "HTTP " + s.status() }); });
  page.on("requestfinished", async (q) => {
    r.requests++;
    if (!own(q.url())) r.thirdParty++;
    try { const z = await q.sizes(); r.bytes += z.responseBodySize; if (own(q.url())) r.ownBytes += z.responseBodySize; } catch { /* closed */ }
  });
  try {
    const resp = await page.goto(url, { waitUntil: "load", timeout: 20000 });
    r.status = resp?.status() || 0;
  } catch (e) { r.errors.push("navigation: " + String(e.message).split("\n")[0]); }
  await page.waitForTimeout(1500);
  // layout and screenshot first, before the focus and click checks change what's on screen
  if (shot) r.layout = await page.evaluate(textLayout).catch(() => []);
  if (shot) r.png = await page.screenshot({ fullPage: true, animations: "disabled" }).catch(() => null);
  r.perf = await page.evaluate(perfSnapshot).catch(() => null);
  r.ui = await page.evaluate(uiAudit).catch(() => null);
  if (r.ui) r.ui.noFocusStyle = await focusCheck(page);
  if (interact) r.interactions = await clickAround(page, r);
  r.bytes = Math.round(r.bytes / 1024);
  r.ownBytes = Math.round(r.ownBytes / 1024);
  await ctx.close();
  return r;
}

// Tab through the first few focusable things and note any that show no visible focus change.
async function focusCheck(page) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab").catch(() => {});
    await page.waitForTimeout(350); // let focus transitions finish, or outlines read as 0px mid-animation
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const shown = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none") || s.textDecorationLine.includes("underline");
      const one = (e) => e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.classList[0] ? "." + e.classList[0] : "");
      let path = one(el);
      for (let e = el.parentElement, n = 0; e && n < 2 && !el.id && !el.classList[0]; e = e.parentElement, n++) { path = one(e) + " > " + path; if (e.id || e.classList[0]) break; }
      return { el: path, shown };
    }).catch(() => null);
    if (f && !f.shown && !out.includes(f.el)) out.push(f.el);
  }
  return out;
}

// Bug hunting: click each visible button once; any new page error is a broken interaction.
async function clickAround(page, r) {
  const before = r.errors.length;
  const handles = (await page.$$("button:not([type=submit]):not([disabled]),[role=button]")).slice(0, 15);
  let clicked = 0;
  const broken = [];
  for (const h of handles) {
    if (!(await h.isVisible().catch(() => false))) continue;
    const label = await h.evaluate((el) => el.id || el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30)).catch(() => "");
    const n = r.errors.length;
    await h.click({ timeout: 2000, trial: false }).catch(() => {});
    await page.waitForTimeout(150);
    clicked++;
    if (r.errors.length > n) broken.push({ button: label, error: r.errors[r.errors.length - 1] });
    await page.keyboard.press("Escape").catch(() => {});
  }
  return { clicked, broken, newErrors: r.errors.length - before };
}

/** Fraction of pixels that differ (per-channel tolerance 24) between two PNGs, computed in the browser. */
export async function pixelDiff(browser, a, b) {
  if (!a || !b) return 1;
  const page = await browser.newPage();
  const ratio = await page.evaluate(async ([x, y]) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [A, B] = await Promise.all([load(x), load(y)]);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const px = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#f0f"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const p = px(A), q = px(B);
    let diff = 0;
    for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > 24 || Math.abs(p[i + 1] - q[i + 1]) > 24 || Math.abs(p[i + 2] - q[i + 2]) > 24) diff++;
    return diff / (w * h);
  }, [`data:image/png;base64,${a.toString("base64")}`, `data:image/png;base64,${b.toString("base64")}`]);
  await page.close();
  return Math.round(ratio * 10000) / 10000;
}

/** Probe every page at every width. */
export async function report(target, { pages = PAGES, interact = true, shot = false, offline = !/^https?:/.test(target) } = {}) {
  const local = !/^https?:/.test(target);
  const srv = local ? await serveDir(target) : null;
  const base = srv ? srv.url : target.replace(/\/$/, "");
  const browser = await launch();
  const results = [];
  try {
    for (const p of pages) for (const wh of WIDTHS) results.push({ page: p, ...(await probePage(browser, base + p, wh, { interact, shot, offline })) });
  } finally {
    await browser.close();
    if (srv) await srv.close();
  }
  return { at: Date.now(), target: local ? "local" : base, results };
}

/** Text runs (by text) whose position differs between two layouts, or which disappeared. */
export function movedText(A = [], B = []) {
  const pos = (L) => { const m = new Map(); for (const [t, x, y] of L) if (!m.has(t)) m.set(t, [x, y]); return m; };
  const a = pos(A), b = pos(B), out = [];
  for (const [t, [x, y]] of a) { const q = b.get(t); if (!q || Math.abs(q[0] - x) > 2 || Math.abs(q[1] - y) > 2) out.push(t); }
  return out;
}

const numbers = (r) => ({ requests: r.requests, ownKB: r.ownBytes, renderBlocking: r.perf?.renderBlocking ?? 0, lcpMs: r.perf?.lcpMs ?? 0, cls: r.perf?.cls ?? 0, domNodes: r.perf?.domNodes ?? 0 });

/**
 * CI gate: head must be no worse than base on errors, UI issues and performance, and must not
 * change how pages look by more than maxVisual (a feature PR is allowed more). A performance change
 * must show a measured improvement, not just a plausible one.
 */
export async function gate(baseDir, headDir, { maxVisual = 0.02, area = "", pages = PAGES } = {}) {
  const [A, B] = [await serveDir(baseDir), await serveDir(headDir)];
  const browser = await launch();
  const problems = [], notes = [];
  let improved = false;
  try {
    for (const p of pages) for (const wh of WIDTHS) {
      const a = await probePage(browser, A.url + p, wh, { shot: true, offline: true });
      const b = await probePage(browser, B.url + p, wh, { shot: true, offline: true });
      const at = `${p} @${wh[0]}px`;
      const ownErr = (x) => x.errors.length + x.consoleErrors.filter((c) => c.own).length + x.failed.filter((f) => f.own).length + (x.interactions?.broken.length || 0);
      if (ownErr(b) > ownErr(a)) problems.push(`${at}: new errors (${b.errors.concat(b.failed.filter((f) => f.own).map((f) => f.url + " " + f.why)).slice(-2).join(" | ")})`);
      const ui = (x) => (x.ui ? x.ui.smallTargets.length + x.ui.lowContrast.length + x.ui.noFocusStyle.length + (x.ui.overflowPx > 0 ? 5 : 0) : 0);
      if (ui(b) > ui(a)) problems.push(`${at}: more UI issues (${ui(a)} -> ${ui(b)})`);
      const na = numbers(a), nb = numbers(b);
      if (nb.requests > na.requests) problems.push(`${at}: more requests (${na.requests} -> ${nb.requests})`);
      if (nb.ownKB > na.ownKB * 1.02 + 2) problems.push(`${at}: heavier (${na.ownKB} -> ${nb.ownKB} KB)`);
      if (nb.renderBlocking > na.renderBlocking) problems.push(`${at}: more render-blocking files`);
      if (nb.cls > na.cls + 0.02) problems.push(`${at}: more layout shift (${na.cls} -> ${nb.cls})`);
      if (nb.requests < na.requests || nb.ownKB < na.ownKB - 1 || nb.renderBlocking < na.renderBlocking || nb.cls < na.cls - 0.01) improved = true;
      // text that moved: allowed only for features (which add content on purpose). Animated text moves
      // by itself, so when anything moved, the base is loaded again and text unstable across two loads
      // of the SAME version is ignored.
      let movedRuns = movedText(a.layout, b.layout);
      if (movedRuns.length) {
        const a2 = await probePage(browser, A.url + p, wh, { shot: true, offline: true, interact: false });
        const unstable = new Set(movedText(a.layout, a2.layout));
        movedRuns = movedRuns.filter((t) => !unstable.has(t));
      }
      const moved = movedRuns.length;
      notes.push(`${at}: ${moved} text runs moved${moved ? " (" + movedRuns.slice(0, 3).join(", ") + ")" : ""}`);
      if (moved && maxVisual < 0.1) problems.push(`${at}: layout changed (${moved} text runs moved)`);
      const d = await pixelDiff(browser, a.png, b.png);
      notes.push(`${at}: ${(d * 100).toFixed(2)}% pixels changed`);
      if (d > maxVisual) problems.push(`${at}: looks different (${(d * 100).toFixed(1)}% of pixels > ${(maxVisual * 100).toFixed(1)}% allowed)`);
      if (process.env.EVOLVE_SHOTS) {
        await mkdir(process.env.EVOLVE_SHOTS, { recursive: true });
        const name = (p.replace(/\W+/g, "_") || "home") + "-" + wh[0];
        if (a.png) await writeFile(join(process.env.EVOLVE_SHOTS, name + "-before.png"), a.png);
        if (b.png) await writeFile(join(process.env.EVOLVE_SHOTS, name + "-after.png"), b.png);
      }
    }
  } finally {
    await browser.close();
    await A.close(); await B.close();
  }
  if (area === "perf" && !improved) problems.push("a performance change must measurably improve requests, bytes, render-blocking files or layout shift");
  return { ok: problems.length === 0, problems, notes };
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "report") {
    const r = await report(a || "https://mosaicscope.pages.dev");
    for (const x of r.results) delete x.png;
    const out = JSON.stringify(r, null, 1);
    if (b) await writeFile(b, out); else console.log(out);
  } else if (cmd === "gate") {
    const r = await gate(a, b, { maxVisual: Number(process.env.EVOLVE_MAX_VISUAL || 0.02), area: process.env.EVOLVE_AREA || "" });
    r.notes.forEach((n) => console.log("  " + n));
    console.log(r.ok ? "probe gate: ok" : "probe gate FAILED:\n- " + r.problems.join("\n- "));
    process.exitCode = r.ok ? 0 : 1;
  } else {
    console.log("usage: node evolve/probe.mjs report <url-or-dir> [out.json] | gate <base-dir> <head-dir>");
    process.exitCode = 2;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
