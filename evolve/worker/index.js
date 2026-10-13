// MosaicScope evolution engine: the Cloudflare Worker that runs one cycle every two minutes.
// Cron trigger "*/2 * * * *" (wrangler.toml). Shares the site's EGG KV namespace (keys "evo:*").
//
// Secrets (wrangler secret put ...):
//   GITHUB_TOKEN       fine-grained token for this one repo: Contents + Pull requests read/write
//   ANTHROPIC_API_KEY  optional; without it both agents use their local heuristics and spend nothing
// Vars: GITHUB_REPO ("owner/name"), GITHUB_BRANCH ("main"), SITE_URL, and any EVOLVE_* limit.

import { loadConfig, ALLOWED_PATHS } from "../core/config.js";
import { runCycle } from "../core/cycle.js";
import { hash } from "../core/html.js";

// What the checks read: the editable pages plus read-only context (manifest, the world page for the sitemap).
const READ_PATHS = [...ALLOWED_PATHS, "manifest.webmanifest", "world/index.html"];

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cycle(env).then((r) => console.log("evolve:", r.result)));
  },
  // GET /run?key=<EVOLVE_ADMIN_TOKEN> runs a cycle by hand (handy right after deploying). Nothing else is served.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/run" || !env.EVOLVE_ADMIN_TOKEN || !(await same(url.searchParams.get("key") || "", env.EVOLVE_ADMIN_TOKEN))) return new Response("Not found", { status: 404 });
    const r = await cycle(env);
    return Response.json({ result: r.result, wrote: r.wrote });
  },
};

export async function cycle(env) {
  const cfg = loadConfig(env);
  if (!env.EGG) return { result: "no EGG KV binding" };
  return runCycle(workerIo(env), cfg);
}

export function workerIo(env, fetchImpl = fetch) {
  const repo = env.GITHUB_REPO || "mosaicscope/mosaicscope-site";
  const branch = env.GITHUB_BRANCH || "main";
  const gh = async (path, init = {}) => {
    const r = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "mosaicscope-evolve", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) },
    });
    if (!r.ok && r.status !== 404) throw new Error(`GitHub ${init.method || "GET"} ${path.split("?")[0]}: ${r.status}`);
    return r;
  };
  let head = "";

  return {
    now: () => Date.now(),
    store: {
      get: () => env.EGG.get("evo:state", "json"),
      put: (s) => env.EGG.put("evo:state", JSON.stringify(s)),
      control: () => env.EGG.get("evo:control", "json"),
      // Cron runs once per tick and a cycle is cut off at CYCLE_DEADLINE_MS (< the 2 minute interval),
      // so cycles can't overlap. No KV lock: it would cost two writes per cycle on the free tier.
      lock: async () => true,
      unlock: async () => {},
    },
    async listFiles() {
      if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
      // one tiny request: the head commit. Same head as last scan = nothing to re-read.
      const r = await gh(`/commits/${branch}`, { headers: { Accept: "application/vnd.github.sha" } });
      head = (await r.text()).trim();
      return Object.fromEntries(READ_PATHS.map((p) => [p, head]));
    },
    async readFiles(paths) {
      const out = {};
      await Promise.all(paths.map(async (p) => {
        const r = await gh(`/contents/${p}?ref=${head || branch}`, { headers: { Accept: "application/vnd.github.raw+json" } });
        if (r.ok) out[p] = await r.text();
      }));
      return out;
    },
    async publish(p) {
      const name = `evolve/${p.kind}-${hash(p.fp + p.remedy + p.at)}`;
      const base = head || (await (await gh(`/commits/${branch}`, { headers: { Accept: "application/vnd.github.sha" } })).text()).trim();
      const meta = await (await gh(`/contents/${p.change.path}?ref=${base}`)).json();
      await gh(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${name}`, sha: base }) });
      try {
        await gh(`/contents/${p.change.path}`, { method: "PUT", body: JSON.stringify({ message: p.title, content: b64(p.change.text), sha: meta.sha, branch: name }) });
        const pr = await (await gh(`/pulls`, { method: "POST", body: JSON.stringify({
          title: p.title, head: name, base: branch,
          body: `Automatic change from the MosaicScope evolution engine.\n\n- Check: \`${p.kind}\` at \`${p.path}:${p.line}\`\n- Fix: ${p.label}\n- Won by: **${p.agent}** (score ${p.score})\n- Changed lines: ${p.lines}\n\nCI (\`evolve-ci\`) re-validates this diff, runs the engine tests, and closes this PR and deletes the branch if anything fails.`,
        }) })).json();
        if (!pr.number) throw new Error("PR was not created");
        return { ref: `#${pr.number}`, url: pr.html_url, pr: pr.number, branch: name };
      } catch (e) {
        await gh(`/git/refs/heads/${name}`, { method: "DELETE" }).catch(() => {}); // roll back the branch
        throw e;
      }
    },
    async checkPending(p) {
      const n = String(p.ref).replace("#", "");
      const r = await gh(`/pulls/${n}`);
      if (r.status === 404) return "closed";
      const pr = await r.json();
      return pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";
    },
    async health() {
      if (!env.SITE_URL) return null;
      const t = Date.now();
      const r = await fetchImpl(env.SITE_URL, { headers: { "User-Agent": "mosaicscope-evolve" }, cf: { cacheTtl: 0 } });
      const body = await r.arrayBuffer();
      return { status: r.status, ms: Date.now() - t, kb: Math.round(body.byteLength / 1024) };
    },
    llm: env.ANTHROPIC_API_KEY ? async ({ model, system, user, maxTokens }) => {
      const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j?.error?.type || ""}`);
      return { text: j.content?.[0]?.text || "", inTok: j.usage?.input_tokens, outTok: j.usage?.output_tokens };
    } : null,
  };
}

function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
