// Engine tests: node --test evolve/test/   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { runChecks, ruleByKind } from "../core/rules.js";
import { validateChange, changedLines } from "../core/validate.js";
import { loadConfig, pathAllowed } from "../core/config.js";
import { blankState } from "../core/state.js";
import { priority, recordOutcome, scoreProposal, learned, retired } from "../core/score.js";
import { canCall, rollLedger } from "../core/budget.js";
import { ask, parsePick } from "../core/agents.js";
import { runCycle, applyControl } from "../core/cycle.js";

const cfg = loadConfig({});
const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Work</title>
</head>
<body>
<h1>Hi</h1>
<img src="a.jpg" alt="first">
<img src="photos/night-market.jpg">
<a href="https://x.example" target="_blank">x</a>
<button id="play-music"></button>
<input name="email_address">
</body>
</html>
`;
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mosaicscope.pages.dev/</loc></url>
</urlset>
`;
const files = () => ({ "index.html": PAGE, "sitemap.xml": SITEMAP, "house/index.html": "<!doctype html><html lang=en><head><title>House</title></head><body><h1>h</h1></body></html>\n" });

test("checks find real problems in plain HTML", () => {
  const kinds = runChecks(files()).findings.map((f) => f.kind).sort();
  for (const k of ["blank-rel", "btn-name", "field-name", "html-lang", "img-alt", "img-lazy", "meta-desc", "sitemap-page", "theme-color", "viewport"]) assert.ok(kinds.includes(k), k);
});

test("every remedy produces a change that passes validation", () => {
  const fs = files();
  for (const f of runChecks(fs).findings) for (const r of ruleByKind(f.kind).remedies) {
    const ch = r.apply(fs, f);
    if (!ch) continue; // remedy not applicable (e.g. no title to copy)
    const v = validateChange(fs, ch, f, cfg);
    assert.ok(v.ok, `${f.kind}/${r.id}: ${v.reasons}`);
  }
});

test("validation blocks protected paths, scripts, big diffs and no-ops", () => {
  const fs = { ...files(), "functions/api/egg.js": "x" };
  const f = runChecks(fs).findings.find((x) => x.kind === "img-alt");
  assert.ok(!validateChange(fs, { path: "functions/api/egg.js", text: "y" }, { ...f, path: "functions/api/egg.js" }, cfg).ok);
  assert.ok(!validateChange(fs, { path: "index.html", text: PAGE.replace("</body>", "<script>alert(1)</script></body>") }, f, cfg).ok);
  assert.ok(!validateChange(fs, { path: "index.html", text: PAGE.replace("<img src=\"photos", "<img onerror=\"x()\" alt=\"\" src=\"photos") }, f, cfg).ok);
  assert.ok(!validateChange(fs, { path: "index.html", text: PAGE }, f, cfg).ok);
  assert.ok(!validateChange(fs, { path: "index.html", text: PAGE + "\n".repeat(30) + "<p>x</p>\n".repeat(20) }, f, cfg).ok);
  assert.equal(pathAllowed("../index.html"), false);
  assert.equal(pathAllowed("evolve/core/config.js"), false);
  assert.equal(changedLines("a\nb\n", "a\nc\n"), 2);
});

test("outcomes change what the engine prefers next time", () => {
  const s = blankState();
  const fs = files();
  const f = runChecks(fs).findings.find((x) => x.kind === "theme-color");
  const g = runChecks(fs).findings.find((x) => x.kind === "meta-desc");
  const r = ruleByKind("theme-color").remedies[0];
  const before = scoreProposal(f, r, s);
  assert.equal(priority(f, s), priority(g, s)); // same weight, no history
  for (let i = 0; i < 2; i++) recordOutcome(s, { fp: "x" + i, kind: "theme-color", remedy: "a", agent: "innovator", score: 5, risk: 0 }, "rejected", 1);
  recordOutcome(s, { fp: "y", kind: "meta-desc", remedy: "a", agent: "optimiser", score: 5, risk: 0 }, "accepted", 1);
  assert.ok(priority(g, s) > priority(f, s), "failed kind now ranks below a kind that landed");
  assert.ok(scoreProposal(f, r, s) < before);
  assert.ok(s.agents.innovator.points < 0 && s.agents.optimiser.points > 0);
  assert.equal(learned(undefined), 1);
});

test("budget refuses calls past the daily limit, and agents fall back to heuristics", async () => {
  const s = blankState();
  rollLedger(s, Date.now());
  s.ledger.usd = cfg.DAILY_USD_LIMIT;
  assert.match(canCall(s, cfg, cfg.MODEL_CHEAP, 50), /spend/);
  let calls = 0;
  const llm = async () => { calls++; return { text: "1a", inTok: 50, outTok: 2 }; };
  const options = [{ finding: { kind: "theme-color", path: "index.html", line: 1 }, area: "ux", remedies: ruleByKind("theme-color").remedies }];
  const pick = await ask("innovator", options, s, cfg, llm);
  assert.equal(calls, 0);
  assert.equal(pick.via, "local");
});

test("agents answer in a few tokens, escalate once on a bad answer, then stop", async () => {
  const s = blankState();
  rollLedger(s, Date.now());
  const seen = [];
  const llm = async (req) => { seen.push(req); return req.model === cfg.MODEL_CHEAP ? { text: "hmm", inTok: 60, outTok: 3 } : { text: "1b", inTok: 60, outTok: 2 }; };
  const options = [{ finding: { kind: "img-lazy", path: "index.html", line: 9 }, area: "perf", remedies: ruleByKind("img-lazy").remedies }];
  const pick = await ask("optimiser", options, s, cfg, llm);
  assert.equal(seen.length, 2);
  assert.ok(seen.every((r) => r.maxTokens <= 8));
  assert.equal(pick.r.id, "b");
  assert.equal(pick.model, cfg.MODEL_ESCALATE);
  assert.equal(s.ledger.calls, 2);
  assert.equal(s.ledger.outTok, 5);
  assert.equal(parsePick("2a", options), null);
});

// A fake world for whole cycles: files in memory, PRs as a map.
function fakeIo(opts = {}) {
  let state = null, t = Date.UTC(2026, 9, 14, 0, 0, 0);
  const fs = files();
  const prs = new Map();
  const io = {
    calls: 0, reads: 0, writes: 0, fs, prs,
    now: () => t,
    tick: (ms = 120000) => { t += ms; },
    store: { get: async () => state && JSON.parse(JSON.stringify(state)), put: async (s) => { io.writes++; state = JSON.parse(JSON.stringify(s)); }, control: async () => io.ctl || null, lock: async () => true, unlock: async () => {} },
    listFiles: async () => Object.fromEntries(Object.entries(fs).map(([p, x]) => [p, String(x.length)])),
    readFiles: async (ps) => { io.reads++; return Object.fromEntries(ps.map((p) => [p, fs[p]])); },
    publish: async (p) => { const n = prs.size + 1; prs.set(n, { p, state: "open" }); return { ref: "#" + n }; },
    checkPending: async (p) => prs.get(Number(p.ref.slice(1))).state,
    health: async () => ({ status: opts.status ?? 200, ms: 100, kb: 20 }),
    llm: opts.llm === false ? null : async () => { io.calls++; return { text: "1a", inTok: 80, outTok: 2 }; },
    get state() { return state; },
  };
  return io;
}
const merge = (io, n) => { const pr = io.prs.get(n); pr.state = "merged"; io.fs[pr.p.change.path] = pr.p.change.text; };

test("a full cycle: compete, propose, wait, learn from the merge", async () => {
  const io = fakeIo();
  const r1 = await runCycle(io, cfg);
  assert.match(r1.result, /^proposed #1/);
  assert.equal(io.calls, 2, "one tiny call per agent");
  const s1 = io.state;
  assert.ok(s1.pending && s1.proposals[0].innovator && s1.proposals[0].optimiser);
  io.tick();
  assert.match((await runCycle(io, cfg)).result, /waiting on #1/);
  assert.equal(io.calls, 2, "no AI while a change is pending");
  merge(io, 1);
  io.tick();
  assert.match((await runCycle(io, cfg)).result, /#1 accepted/);
  const s = io.state;
  assert.equal(s.history[0].outcome, "accepted");
  assert.ok(s.agents[s.history[0].agent].points > 0);
  assert.equal(Object.values(s.stats.kinds).reduce((n, k) => n + k.ok, 0), 1);
});

test("rejections are penalised, never re-proposed, and trip the engine after the failure limit", async () => {
  const io = fakeIo();
  const seenFps = new Set();
  for (let i = 0; i < cfg.MAX_CONSECUTIVE_FAILURES; i++) {
    const r = await runCycle(io, cfg);
    assert.match(r.result, /^proposed/);
    const p = io.state.pending;
    const key = p.fp + "#" + p.remedy;
    assert.ok(!seenFps.has(key), "same proposal came back");
    seenFps.add(key);
    io.prs.get(io.prs.size).state = "closed";
    io.tick();
    assert.match((await runCycle(io, cfg)).result, /rejected/);
    io.tick();
  }
  assert.equal(io.state.mode, "tripped");
  assert.match((await runCycle(io, cfg)).result, /skipped: tripped/);
  const pts = io.state.agents.innovator.points + io.state.agents.optimiser.points;
  assert.ok(pts < 0);
});

test("nothing to fix: no AI calls, no file reads on unchanged files, few writes", async () => {
  const io = fakeIo();
  for (const k of Object.keys(io.fs)) delete io.fs[k];
  io.fs["index.html"] = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="theme-color" content="#000"><meta name="description" content="x"><meta property="og:title" content="x"><meta property="og:image" content="x"><title>x</title></head><body><h1>x</h1></body></html>\n';
  assert.equal((await runCycle(io, cfg)).result, "nothing to improve");
  const reads = io.reads, writes = io.writes;
  for (let i = 0; i < 5; i++) { io.tick(); assert.equal((await runCycle(io, cfg)).result, "nothing to improve"); }
  assert.equal(io.calls, 0);
  assert.equal(io.reads, reads, "unchanged files are not re-read");
  assert.equal(io.writes, writes, "idle cycles don't write state");
  io.tick(cfg.HEARTBEAT_MINUTES * 60000 + 1);
  await runCycle(io, cfg);
  assert.equal(io.writes, writes + 1, "heartbeat write");
});

test("works with no API key: local heuristic agents still compete", async () => {
  const io = fakeIo({ llm: false });
  const r = await runCycle(io, cfg);
  assert.match(r.result, /^proposed/);
  const p = io.state.proposals[0];
  assert.equal(p.innovator.via, "local");
  assert.equal(p.optimiser.via, "local");
  assert.equal(io.state.ledger.calls, 0);
});

test("pause, stop and the env kill switch hold the engine", async () => {
  const io = fakeIo();
  io.ctl = { mode: "paused", at: 1 };
  assert.match((await runCycle(io, cfg)).result, /skipped: paused/);
  io.ctl = { mode: "running", at: 2 };
  assert.match((await runCycle(io, cfg)).result, /^proposed/);
  io.ctl = { mode: "stopped", at: 3 };
  assert.match((await runCycle(io, cfg)).result, /emergency stop/);
  const killed = fakeIo();
  assert.match((await runCycle(killed, loadConfig({ EVOLVE_KILL: "1" }))).result, /emergency stop \(env\)/);
  assert.equal(killed.calls, 0);
  const s = blankState();
  applyControl(s, { mode: "stopped", at: 5 });
  applyControl(s, { mode: "running", at: 4 }); // older control is ignored
  assert.equal(s.mode, "stopped");
});

test("a broken site right after a merge counts as a regression and trips the engine", async () => {
  const io = fakeIo();
  await runCycle(io, cfg);
  merge(io, 1);
  io.tick();
  await runCycle(io, cfg);
  const winner = io.state.history[0].agent;
  const before = io.state.agents[winner].points;
  const undone = [];
  const broken = Object.assign(io, { health: async () => ({ status: 500, ms: 50, kb: 1 }), revert: async (acc) => { undone.push(acc.ref); return { ref: "#99" }; } });
  broken.tick();
  assert.match((await runCycle(broken, cfg)).result, /regression: tripped, undo #99 opened/);
  assert.deepEqual(undone, ["#1"]);
  assert.equal(io.state.mode, "tripped");
  assert.ok(io.state.agents[winner].points < before);
});

// ---- the Cloudflare side, with fetch and KV faked ----
import { workerIo, cycle as workerCycle } from "../worker/index.js";
import { onRequestGet, onRequestPost } from "../../functions/api/evolve.js";

function fakeKv() {
  const m = new Map();
  return { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); } };
}

test("worker cycle: reads the repo, opens one PR on its own branch, never touches protected files", async () => {
  const fs = files();
  const log = [];
  const fakeFetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    log.push(`${method} ${u.pathname}`);
    const path = u.pathname.replace("/repos/mosaicscope/mosaicscope-site", "");
    if (path === "/commits/main") return new Response("abc123");
    if (path === "/commits/evolve-data") return new Response("", { status: 404 });
    if (method === "GET" && path.startsWith("/contents/")) {
      const p = path.slice(10);
      if (!(p in fs)) return new Response("", { status: 404 });
      return (init.headers?.Accept || "").includes("raw") ? new Response(fs[p]) : Response.json({ sha: "blob-" + p });
    }
    if (method === "POST" && path === "/git/refs") return Response.json({ ref: JSON.parse(init.body).ref }, { status: 201 });
    if (method === "PUT" && path.startsWith("/contents/")) {
      const b = JSON.parse(init.body);
      assert.ok(b.branch.startsWith("evolve/"), "commits only to an evolve/ branch");
      assert.ok(!path.includes("functions") && !path.includes("evolve/"));
      return Response.json({}, { status: 201 });
    }
    if (method === "POST" && path === "/pulls") return Response.json({ number: 7, html_url: "https://github.com/x/pull/7" }, { status: 201 });
    if (path === "/pulls/7") return Response.json({ state: "open", merged: false });
    return new Response("unexpected", { status: 500 });
  };
  const env = { EGG: fakeKv(), GITHUB_TOKEN: "t" };
  const io = workerIo(env, fakeFetch);
  const r = await runCycle(io, cfg);
  assert.match(r.result, /^proposed #7/);
  assert.ok(log.includes("PUT /repos/mosaicscope/mosaicscope-site/contents/" + r.state.pending.path));
  assert.equal(r.state.pending.url, "https://github.com/x/pull/7");
  assert.ok(env.EGG.m.has("evo:state"));
  assert.match((await runCycle(io, cfg)).result, /waiting on #7/);
  assert.equal((await workerCycle({})).result, "no EGG KV binding");
});

test("dashboard API: public read, controls need the admin token", async () => {
  const EGG = fakeKv();
  const s = blankState();
  s.seen = { secret: { at: 1 } };
  await EGG.put("evo:state", JSON.stringify(s));
  const env = { EGG, EVOLVE_ADMIN_TOKEN: "letmein" };
  const g = await (await onRequestGet({ env })).json();
  assert.equal(g.state.mode, "running");
  assert.equal(g.state.seen, undefined);
  assert.ok(g.nextCycle > Date.now() - 1);
  const post = (auth, action) => onRequestPost({ env, request: new Request("https://x/api/evolve", { method: "POST", headers: { Authorization: "Bearer " + auth }, body: JSON.stringify({ action }) }) });
  assert.equal((await post("nope", "stop")).status, 401);
  assert.equal((await post("letmein", "explode")).status, 400);
  assert.equal((await post("letmein", "stop")).status, 200);
  assert.equal(JSON.parse(EGG.m.get("evo:control")).mode, "stopped");
});

test("new checks: charset, link names, share tags, CSS focus and reduced motion", () => {
  const fs = {
    "index.html": '<!doctype html>\n<html lang="en">\n<head>\n<title>Shop</title>\n</head>\n<body>\n<h1>x</h1>\n<a href="https://instagram.com/x"></a>\n<a href="#gone">x</a>\n<h4>skip</h4>\n</body>\n</html>\n',
    "styles.css": "a { color: red; }\n@keyframes spin { to { transform: rotate(1turn); } }\n.x { animation: spin 1s; }\n",
  };
  const r = runChecks(fs);
  const kinds = r.findings.map((f) => f.kind);
  for (const k of ["charset", "link-name", "og-title", "css-focus", "css-motion"]) assert.ok(kinds.includes(k), k);
  assert.ok(r.weaknesses.some((w) => w.kind === "dead-anchor") && r.weaknesses.some((w) => w.kind === "heading-skip"));
  for (const f of r.findings) for (const rem of ruleByKind(f.kind).remedies) {
    const ch = rem.apply(fs, f);
    if (ch) assert.ok(validateChange(fs, ch, f, cfg).ok, `${f.kind}/${rem.id}: ${validateChange(fs, ch, f, cfg).reasons}`);
  }
  const f = r.findings.find((x) => x.kind === "css-focus");
  assert.ok(!validateChange(fs, { path: "styles.css", text: fs["styles.css"] + "a{background:url(//evil)}\n:focus{}\n" }, f, cfg).ok);
});

test("the weekly audit pushes its weakest area up the priority list", async () => {
  const { auditBoost } = await import("../core/score.js");
  const s = blankState();
  const fs = files();
  const lazy = runChecks(fs).findings.find((x) => x.kind === "img-lazy");
  const before = priority(lazy, s);
  s.audit = { at: 1, scores: { performance: 0.62, accessibility: 0.98, seo: 1, bestPractices: 1 } };
  assert.equal(priority(lazy, s), before * 2);
  assert.equal(auditBoost("a11y", s.audit), 1);
  const io = fakeIo();
  io.audit = async () => ({ at: 5, scores: { performance: 0.8 } });
  await runCycle(io, cfg);
  assert.equal(io.state.audit.at, 5);
});

// ---- Evolution 3.0: probe, issues, learning, memory, security, features, cost ----
import { classify, metricFor, critical } from "../core/issues.js";
import { decayed, recordEffect, elo } from "../core/score.js";
import { updateBacklog } from "../core/memory.js";
import { scanSecurity, newFindings } from "../core/security.js";
import { bookCall } from "../core/budget.js";

const probeOf = (over = {}) => ({
  at: 1000, target: "https://site", results: [
    { page: "/", width: 390, status: 200, errors: [], consoleErrors: [], failed: [], requests: 6, ownBytes: 300,
      perf: { lcpMs: 1200, cls: 0.13, tbtMs: 100, renderBlocking: 3, domNodes: 900, heapMB: 20, screens: 9 },
      ui: { overflowPx: 0, smallTargets: [{ el: "nav.bar > a", w: 30, h: 13 }], smallText: [], lowContrast: [], noFocusStyle: ["nav.bar > a"] },
      interactions: { clicked: 3, broken: [] }, ...over },
  ],
});
const SITE3 = {
  "index.html": '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width">\n<meta name="theme-color" content="#000">\n<meta name="description" content="x">\n<meta property="og:title" content="x">\n<meta property="og:image" content="x">\n<title>x</title>\n</head>\n<body>\n<header><nav class="bar"><a href="#a">a</a></nav></header>\n<main id="top"><h1>x</h1></main>\n</body>\n</html>\n',
  "styles.css": "a { color: red; }\n:focus-visible { outline: 1px solid; }\n",
};

test("probe results are graded by severity; breakage is critical", () => {
  const ok = classify(probeOf());
  assert.ok(ok.some((i) => i.kind === "small-target" && i.severity === "medium" && i.fixable));
  assert.ok(ok.some((i) => i.kind === "layout-shift"));
  assert.equal(critical(ok).length, 0);
  const broken = classify(probeOf({ errors: ["TypeError: x is undefined"], failed: [{ url: "https://site/main.js", own: true, why: "HTTP 404" }] }));
  assert.equal(critical(broken).length, 2);
  assert.ok(metricFor("ux", probeOf()) >= 2 && metricFor("perf", probeOf()) > 300 && metricFor("seo", probeOf()) === null);
});

test("probe-driven UI fixes: detected from live data, fixed by appended CSS, gone afterwards", () => {
  const fs = { ...SITE3, "@probe": JSON.stringify(probeOf()) };
  const r = runChecks(fs);
  const tap = r.findings.find((f) => f.kind === "tap-target"), foc = r.findings.find((f) => f.kind === "focus-style");
  assert.ok(tap && foc);
  for (const f of [tap, foc]) for (const rem of ruleByKind(f.kind).remedies) {
    const ch = rem.apply(fs, f);
    const v = validateChange(fs, ch, f, cfg, rem);
    assert.ok(v.ok, `${f.kind}/${rem.id}: ${v.reasons}`);
    assert.ok(ch.text.startsWith(fs["styles.css"].trimEnd()), "append-only");
  }
  // a selector that could inject CSS is ignored
  const evil = probeOf({ ui: { overflowPx: 0, smallTargets: [{ el: "a{} body{display:none", w: 1, h: 1 }], smallText: [], lowContrast: [], noFocusStyle: [] } });
  assert.equal(runChecks({ ...SITE3, "@probe": JSON.stringify(evil) }).findings.filter((f) => f.kind === "tap-target").length, 0);
});

test("micro-features need evidence, declare their extra tags, and always need approval", () => {
  const page = SITE3["index.html"];
  const f = runChecks({ "index.html": page }).findings.find((x) => x.kind === "feature-skip-link");
  assert.ok(f, "page with a header and main but no skip link");
  const rem = ruleByKind("feature-skip-link").remedies[0];
  const ch = rem.apply({ "index.html": page }, f);
  assert.ok(validateChange({ "index.html": page }, ch, f, cfg, rem).ok);
  assert.ok(!validateChange({ "index.html": page }, ch, f, cfg, null).ok, "without the remedy's allowance the new tags are refused");
  assert.equal(ruleByKind("feature-skip-link").approval, true);
  const withSkip = page.replace("<body>", '<body>\n<a class="skip" href="#top">Skip to the work</a>');
  assert.equal(runChecks({ "index.html": withSkip }).findings.filter((x) => x.kind === "feature-skip-link").length, 0, "no evidence, no feature");
  const short = probeOf({ perf: { ...probeOf().results[0].perf, screens: 2 } });
  assert.equal(runChecks({ "index.html": page.replace('id="top"', 'id="m"'), "@probe": JSON.stringify(short) }).findings.filter((x) => x.kind === "feature-back-to-top").length, 0);
});

test("security guard finds secrets and unsafe DOM, and validation blocks new ones", () => {
  const found = scanSecurity({
    "a.js": "const k = 'ghp_" + "a".repeat(36) + "';\neval(userInput);\nel.innerHTML = data;\n",
    ".github/workflows/x.yml": "on: pull_request_target\nsteps:\n - uses: actions/checkout@v4\n",
    "page.html": '<img src="http://x/y.png">',
  });
  const kinds = found.map((f) => f.kind);
  for (const k of ["secret:github-token", "dom:eval", "dom:inner-html", "workflow:pr-target-checkout", "insecure-url"]) assert.ok(kinds.includes(k), k);
  assert.equal(newFindings(found, found).length, 0);
  assert.equal(scanSecurity({ "b.js": "el.innerHTML = '';\n" }).length, 0, "a constant string is fine");
  const fs = files();
  const f = runChecks(fs).findings.find((x) => x.kind === "img-alt");
  const sneaky = { path: "index.html", text: fs["index.html"].replace('<img src="photos', '<img alt="" data-k="sk-ant-' + "x".repeat(30) + '" src="photos') };
  assert.ok(!validateChange(fs, sneaky, f, cfg).ok);
});

test("learning: outcomes fade, effects are measured, ratings move", () => {
  const s = blankState();
  assert.equal(decayed({ ok: 4, fail: 0, at: 0 }, 14 * 24 * 3600 * 1000).ok, 2);
  const item = { kind: "tap-target", remedy: "a" };
  assert.equal(recordEffect(s, item, 5, 3, 1), 1);
  assert.ok(s.stats.kinds["tap-target"].effect > 0);
  const f = runChecks({ ...SITE3, "@probe": JSON.stringify(probeOf()) }).findings.find((x) => x.kind === "tap-target");
  const plain = blankState();
  assert.ok(priority(f, s) > priority(f, plain), "a fix that measurably helped ranks higher");
  for (let i = 0; i < 3; i++) recordEffect(s, { kind: "img-lazy", remedy: "a" }, 10, 10, 1);
  assert.ok(retired(s.stats.fixes["img-lazy:a"]), "a remedy that never moves the numbers is retired");
  elo(s, "optimiser", "innovator");
  assert.ok(s.agents.optimiser.elo > 1000 && s.agents.innovator.elo < 1000);
});

test("cycle: a new probe measures landed changes and a critical failure pauses and undoes", async () => {
  const io = fakeIo();
  Object.assign(io.fs, { "@probe": JSON.stringify(probeOf()) });
  await runCycle(io, cfg);
  const p = io.state.pending;
  assert.ok(p && "before" in p);
  merge(io, 1);
  io.tick();
  await runCycle(io, cfg);
  assert.equal(io.state.history[0].outcome, "accepted");
  // a later probe: the site now throws on load
  const undone = [];
  io.revert = async (acc) => { undone.push(acc.ref); return { ref: "#50" }; };
  io.fs["@probe"] = JSON.stringify({ ...probeOf({ errors: ["ReferenceError: boom"] }), at: io.now() + 1 });
  io.tick();
  const r = await runCycle(io, cfg);
  assert.match(r.result, /critical failure: paused, undo #50 opened/);
  assert.equal(io.state.mode, "tripped");
  assert.deepEqual(undone, ["#1"]);
  assert.ok(io.state.issues.some((i) => i.severity === "critical"));
  assert.ok(io.state.backlog.some((b) => b.severity === "critical"));
});

test("strategic memory: one deduplicated, ranked backlog that forgets what's fixed", () => {
  const s = blankState();
  const fs = files();
  const r = runChecks(fs);
  updateBacklog(s, { findings: [...r.findings, ...r.findings], weaknesses: [], issues: classify(probeOf()), security: [] }, 1000);
  const n = s.backlog.length;
  assert.equal(new Set(s.backlog.map((b) => b.id)).size, n, "no duplicates");
  assert.ok(s.backlog[0].rank >= s.backlog[n - 1].rank);
  updateBacklog(s, { findings: r.findings.slice(1), weaknesses: [], issues: [], security: [] }, 2000);
  assert.ok(s.backlog.length < n, "fixed problems drop out");
  assert.equal(s.backlog.find((b) => b.id === r.findings[1].fp).firstSeen, 1000, "first seen is kept");
});

test("zero-waste: cached answers, a monthly ceiling, and no pointless proposals", async () => {
  const s = blankState();
  rollLedger(s, Date.now());
  let calls = 0;
  const llm = async () => { calls++; return { text: "1a", inTok: 50, outTok: 2 }; };
  const options = [{ finding: { kind: "img-lazy", path: "index.html", line: 9 }, area: "perf", remedies: ruleByKind("img-lazy").remedies }];
  await ask("innovator", options, s, cfg, llm);
  const again = await ask("innovator", options, s, cfg, llm);
  assert.equal(calls, 1);
  assert.equal(again.via, "cache");
  s.month.usd = cfg.MONTHLY_USD_LIMIT;
  assert.match(canCall(s, cfg, cfg.MODEL_CHEAP, 50), /monthly/);
  const before = s.month.calls;
  bookCall(s, cfg.MODEL_CHEAP, 100, 2);
  assert.equal(s.month.calls, before + 1);
  const io = fakeIo();
  const strict = loadConfig({ EVOLVE_MIN_SCORE: "1000" });
  assert.equal((await runCycle(io, strict)).result, "nothing to improve");
  assert.equal(io.calls, 0);
});

test("competition: the Optimiser doesn't copy A when a near-equal alternative exists", async () => {
  const { heuristicPick } = await import("../core/agents.js");
  const s = blankState();
  const options = [
    { finding: { kind: "blank-rel", path: "index.html", line: 1 }, area: "rel", remedies: ruleByKind("blank-rel").remedies },
  ];
  const first = heuristicPick("optimiser", options, s);
  const second = heuristicPick("optimiser", options, s, first);
  assert.notEqual(first.r.id, second.r.id);
});
