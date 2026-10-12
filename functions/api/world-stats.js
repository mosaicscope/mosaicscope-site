// Cloudflare Pages Function: /api/world-stats
// POST: the Mosaics' world (/world/) sends anonymous session stats when a visitor leaves.
// GET:  open https://mosaicscope.pages.dev/api/world-stats for daily totals over the last 30 days:
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

export async function onRequestGet({ env }) {
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
