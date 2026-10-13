// Visitor notes: shared across visitors, no live connection needed.
// Needs a KV namespace bound as NOTES in the Pages project settings.
const MAX_TEXT = 140, MAX_NAME = 24, PER_HOUR = 10, TTL = 60 * 60 * 24 * 14;

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export async function onRequestGet({ env }) {
  const list = await env.NOTES.list({ prefix: "note:", limit: 100 });
  const notes = (await Promise.all(list.keys.map((k) => env.NOTES.get(k.name, "json")))).filter(Boolean);
  notes.sort((a, b) => b.t - a.t);
  return Response.json({ notes }, { headers: { "Cache-Control": "no-cache" } });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const text = clean(body.text, MAX_TEXT);
  const name = clean(body.name, MAX_NAME) || "a visitor";
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const hour = Math.floor(Date.now() / 3600000);
  const rlKey = `rl:${hour}:${ip}`;
  const used = Number((await env.NOTES.get(rlKey)) ?? 0);
  if (used >= PER_HOUR) return Response.json({ error: "slow down" }, { status: 429 });
  await env.NOTES.put(rlKey, String(used + 1), { expirationTtl: 3700 });

  const t = Date.now();
  const id = `note:${String(t).padStart(15, "0")}:${crypto.randomUUID().slice(0, 8)}`;
  await env.NOTES.put(id, JSON.stringify({ id, name, text, t }), { expirationTtl: TTL });
  return Response.json({ ok: true, id }, { status: 201 });
}
