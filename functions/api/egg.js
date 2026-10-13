// Cloudflare Pages Function: /api/egg
// POST: the site sends easter-egg stats when a visitor leaves.
// GET:  open https://mosaicscope.pages.dev/api/egg to see totals for the last 30 days.
// Needs a KV namespace bound to this project as EGG (Cloudflare → Pages → Settings → Bindings).
// Without it, POSTs are ignored and nothing breaks.

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const SUMS = ["visitors", "seconds", "clicks", "plays", "rains", "clickers", "photos", "throws", "boombox"];
const blank = () => { const o = { maxCrew: 0, maxLevel: 0 }; SUMS.forEach((k) => (o[k] = 0)); return o; };

export async function onRequestPost({ request, env }) {
  if (!env.EGG) return new Response(null, { status: 204 });
  let b = {};
  try { b = await request.json(); } catch (e) { return new Response(null, { status: 204 }); }
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const key = "d:" + day();
  const cur = Object.assign(blank(), (await env.EGG.get(key, "json")) || {});
  cur.visitors += 1;
  cur.seconds += n(b.seconds, 3600);
  cur.clicks += n(b.clicks, 200);
  cur.plays += n(b.plays, 50);
  cur.rains += n(b.rains, 20);
  cur.photos += n(b.photos, 100);
  cur.throws += n(b.throws, 500);
  cur.boombox += n(b.boombox, 50);
  cur.maxCrew = Math.max(cur.maxCrew, n(b.crew, 10));
  cur.maxLevel = Math.max(cur.maxLevel, n(b.level, 6));
  if (n(b.clicks, 200) > 0) cur.clickers += 1;
  await env.EGG.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 400 });
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ request, env }) {
  // people opening the link in a browser get the desktop-style stats page; scripts and ?format=json get the raw numbers
  const url = new URL(request.url);
  const wantsHtml = (request.headers.get("Accept") || "").includes("text/html") && url.searchParams.get("format") !== "json";
  if (wantsHtml) return Response.redirect(new URL("/stats/", url).toString(), 302);
  if (!env.EGG) return json({ note: "Stats are off. Bind a KV namespace called EGG to this Pages project to turn them on." });
  const days = [];
  for (let i = 0; i < 30; i++) days.push(day(new Date(Date.now() - i * 864e5)));
  const rows = await Promise.all(days.map(async (d) => ({ date: d, ...((await env.EGG.get("d:" + d, "json")) || {}) })));
  const t = rows.reduce((a, r) => { SUMS.forEach((k) => (a[k] += r[k] || 0)); a.maxCrew = Math.max(a.maxCrew, r.maxCrew || 0); a.maxLevel = Math.max(a.maxLevel, r.maxLevel || 0); return a; }, blank());
  return json({
    last30days: {
      peopleWhoFoundTheCrew: t.visitors,
      averageSecondsWatching: t.visitors ? Math.round(t.seconds / t.visitors) : 0,
      peopleWhoClickedThem: t.clickers,
      totalClicks: t.clicks,
      timesTheyStartedTheMusic: t.plays,
      timesItRained: t.rains,
      photoshootsTriggered: t.photos,
      cashThrows: t.throws,
      boomboxClicks: t.boombox,
      biggestCrewSeen: t.maxCrew,
      highestSceneLevel: t.maxLevel
    },
    byDay: rows.filter((r) => r.visitors)
  });
}
