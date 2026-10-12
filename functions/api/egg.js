// Cloudflare Pages Function: /api/egg
// POST: the site sends easter-egg stats when a visitor leaves.
// GET:  open https://mosaicscope.pages.dev/api/egg to see totals for the last 30 days.
// Needs a KV namespace bound to this project as EGG (Cloudflare → Pages → Settings → Bindings).
// Without it, POSTs are ignored and nothing breaks.

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
  if (!env.EGG) return new Response(null, { status: 204 });
  let b = {};
  try { b = await request.json(); } catch (e) { return new Response(null, { status: 204 }); }
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const key = "d:" + day();
  const cur = (await env.EGG.get(key, "json")) || { visitors: 0, seconds: 0, clicks: 0, plays: 0, rains: 0, clickers: 0 };
  cur.visitors += 1;
  cur.seconds += n(b.seconds, 3600);
  cur.clicks += n(b.clicks, 200);
  cur.plays += n(b.plays, 50);
  cur.rains += n(b.rains, 20);
  if (n(b.clicks, 200) > 0) cur.clickers += 1;
  await env.EGG.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 400 });
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ env }) {
  if (!env.EGG) return json({ note: "Stats are off. Bind a KV namespace called EGG to this Pages project to turn them on." });
  const days = [];
  for (let i = 0; i < 30; i++) days.push(day(new Date(Date.now() - i * 864e5)));
  const rows = await Promise.all(days.map(async (d) => ({ date: d, ...((await env.EGG.get("d:" + d, "json")) || {}) })));
  const t = rows.reduce((a, r) => { ["visitors", "seconds", "clicks", "plays", "rains", "clickers"].forEach((k) => (a[k] += r[k] || 0)); return a; }, { visitors: 0, seconds: 0, clicks: 0, plays: 0, rains: 0, clickers: 0 });
  return json({
    last30days: {
      peopleWhoFoundTheCrew: t.visitors,
      averageSecondsWatching: t.visitors ? Math.round(t.seconds / t.visitors) : 0,
      peopleWhoClickedThem: t.clickers,
      totalClicks: t.clicks,
      timesTheyStartedTheMusic: t.plays,
      timesItRained: t.rains
    },
    byDay: rows.filter((r) => r.visitors)
  });
}
