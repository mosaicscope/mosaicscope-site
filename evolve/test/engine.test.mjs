// Engine tests: node --test evolve/test/   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { runChecks, ruleByKind } from "../core/rules.js";
import { validateChange, changedLines } from "../core/validate.js";
import { loadConfig, pathAllowed } from "../core/config.js";
import { blankState } from "../core/state.js";
import { priority, recordOutcome, scoreProposal, learned } from "../core/score.js";
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
  io.fs["index.html"] = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="theme-color" content="#000"><meta name="description" content="x"><title>x</title></head><body><h1>x</h1></body></html>\n';
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
  const broken = Object.assign(io, { health: async () => ({ status: 500, ms: 50, kb: 1 }) });
  broken.tick();
  assert.match((await runCycle(broken, cfg)).result, /regression/);
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
