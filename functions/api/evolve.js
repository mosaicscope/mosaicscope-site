// Cloudflare Pages Function: /api/evolve
// GET:  the evolution engine's live state for the /evolve/ dashboard (read from KV, written by the Worker).
// POST: { action: "pause" | "resume" | "stop" } with "Authorization: Bearer <EVOLVE_ADMIN_TOKEN>".
// Needs the EGG KV binding (already used by /api/egg) and an EVOLVE_ADMIN_TOKEN secret on the Pages project.

import { publicView } from "../../evolve/core/state.js";
import { loadConfig } from "../../evolve/core/config.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function onRequestGet({ env }) {
  if (!env.EGG) return json({ configured: false, note: "Bind the EGG KV namespace to this Pages project." });
  const [state, control] = await Promise.all([env.EGG.get("evo:state", "json"), env.EGG.get("evo:control", "json")]);
  const cfg = loadConfig(env);
  const now = Date.now();
  const every = cfg.INTERVAL_SECONDS * 1000;
  return json({
    configured: !!state,
    now,
    nextCycle: Math.ceil((now + 1) / every) * every, // the cron fires on every even minute
    control: control || null,
    limits: {
      interval: cfg.INTERVAL_SECONDS, maxIn: cfg.MAX_INPUT_TOKENS, maxOut: cfg.MAX_OUTPUT_TOKENS, usd: cfg.DAILY_USD_LIMIT, monthUsd: cfg.MONTHLY_USD_LIMIT,
      calls: cfg.DAILY_CALL_LIMIT, cycles: cfg.DAILY_CYCLE_LIMIT, failures: cfg.MAX_CONSECUTIVE_FAILURES, changes: cfg.MAX_CHANGES_PER_CYCLE,
    },
    state: state ? publicView(state) : null,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.EGG || !env.EVOLVE_ADMIN_TOKEN) return json({ error: "controls are not configured" }, 503);
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await same(auth, env.EVOLVE_ADMIN_TOKEN))) return json({ error: "wrong admin token" }, 401);
  let b = {};
  try { b = await request.json(); } catch { /* empty body */ }
  const mode = { pause: "paused", resume: "running", stop: "stopped" }[b.action];
  if (!mode) return json({ error: "action must be pause, resume or stop" }, 400);
  const ctl = { mode, at: Date.now() };
  await env.EGG.put("evo:control", JSON.stringify(ctl));
  return json({ ok: true, control: ctl, note: "The engine applies this at its next cycle (within 2 minutes)." });
}

async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
