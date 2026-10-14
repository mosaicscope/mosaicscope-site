// Cloudflare Worker: proxies one short call (a "pick a number" goal choice, or a line of player chat) to a Hugging Face model, so the token stays server-side.
// Secrets: HF_TOKEN. Vars (wrangler.toml): LLM_MODEL, ALLOWED_ORIGIN.
// Route it under the site's /llm/pick path so the game's default endpoint works.

const MAX_CHARS = 4000;

export default {
  async fetch(request, env) {
    const cors = {
      "access-control-allow-origin": env.ALLOWED_ORIGIN || "https://mosaicscope.pages.dev",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    let body;
    try { body = await request.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }
    const system = String(body.system ?? "").slice(0, MAX_CHARS);
    const user = String(body.user ?? "").slice(0, MAX_CHARS);
    if (!user) return new Response("missing user", { status: 400, headers: cors });
    // capped so a visitor can't run up the owner's bill: a chat line is a sentence or two
    const maxTokens = Math.max(1, Math.min(160, Number(body.max_tokens) || 8));
    const temperature = Math.max(0, Math.min(1, Number(body.temperature) || 0));

    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.HF_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!r.ok) return new Response("upstream " + r.status, { status: 502, headers: cors });
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    return Response.json({ text }, { headers: cors });
  },
};
