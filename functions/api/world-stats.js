// Cloudflare Pages Function: /api/world-stats
// POST: the Mosaics' world (/world/) sends anonymous session stats when a visitor leaves.
// GET:  PRIVATE. Needs your secret key (Cloudflare → Pages → Settings → Variables → STATS_KEY), sent as
//       the header "Authorization: Bearer <key>" or as ?key=<key>. Without the key it answers 401, and if
//       STATS_KEY isn't set it answers 401 too (closed by default). Daily totals over the last 30 days:
//       sessions, total/avg minutes played, how many came back (returning), sessions over 5 and 15 minutes,
//       missions finished and casino visits.
// Uses the same KV namespace as /api/egg (binding EGG). Without it, POSTs are ignored and nothing breaks.
// No personal data: no IPs, names or identifiers are stored, only per-day sums.

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const KEYS = ["sessions", "seconds", "returning", "over5", "over15", "missions", "casino", "mobile"];
const blank = () => Object.fromEntries(KEYS.map((k) => [k, 0]));

export async function onRequestPost({ request, env }) {
  if (!env.EGG) return new Response(null, { status: 204 });
  let b = {};
  try { b = await request.json(); } catch (e) { return new Response(null, { status: 204 }); }
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const secs = n(b.seconds, 6 * 3600);
  if (secs < 3) return new Response(null, { status: 204 });
  const key = "w:" + day();
  const cur = Object.assign(blank(), (await env.EGG.get(key, "json")) || {});
  cur.sessions += 1; cur.seconds += secs;
  if (b.returning) cur.returning += 1;
  if (secs >= 300) cur.over5 += 1;
  if (secs >= 900) cur.over15 += 1;
  cur.missions += n(b.missions, 50); cur.casino += n(b.casino, 50);
  if (b.mobile) cur.mobile += 1;
  await env.EGG.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 400 });
  return new Response(null, { status: 204 });
}

/** Constant-time string comparison so the key can't be guessed byte by byte from response timing. */
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  // PUBLIC minimal summary (?summary=1): anonymous per-day session counts and average minutes for the last 7 days,
  // nothing else. It lets the team's reports include visitor numbers without sharing the private key.
  if (url.searchParams.get("summary") === "1") {
    if (!env.EGG) return json({ note: "stats not collected yet" });
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = day(new Date(Date.now() - i * 86400000));
      const v = await env.EGG.get("w:" + d, "json");
      days.push({ day: d, sessions: v ? v.sessions || 0 : 0, avgMinutes: v && v.sessions ? Math.round((v.seconds / v.sessions / 60) * 10) / 10 : 0 });
    }
    return new Response(JSON.stringify({ last7Days: days, sessions: days.reduce((a, x) => a + x.sessions, 0) }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  }
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("key") || "";
  if (!env.STATS_KEY || !same(given, env.STATS_KEY)) return json({ error: "unauthorised" }, 401);
  if (!env.EGG) return json({ note: "Bind a KV namespace as EGG to collect stats." });
  const days = [];
  const tot = blank();
  for (let i = 0; i < 30; i++) {
    const d = day(new Date(Date.now() - i * 86400000));
    const v = await env.EGG.get("w:" + d, "json");
    if (!v) continue;
    days.push({ day: d, ...v, avgMinutes: v.sessions ? Math.round((v.seconds / v.sessions / 60) * 10) / 10 : 0 });
    for (const k of KEYS) tot[k] += v[k] || 0;
  }
  return json({ last30Days: { ...tot, avgMinutes: tot.sessions ? Math.round((tot.seconds / tot.sessions / 60) * 10) / 10 : 0 }, days });
}
