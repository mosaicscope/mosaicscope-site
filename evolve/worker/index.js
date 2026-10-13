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
const READ_PATHS = [...ALLOWED_PATHS, "manifest.webmanifest", "world/index.html", "main.js"];

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
      taskControls: () => env.EGG.get("evo:tasks", "json"),
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
      // plus the probe and security results the workflows keep on the evolve-data branch
      const d = await gh(`/commits/evolve-data`, { headers: { Accept: "application/vnd.github.sha" } });
      const data = d.ok ? (await d.text()).trim() : "";
      return { ...Object.fromEntries(READ_PATHS.map((p) => [p, head])), ...(data ? { "@probe": data, "@security": data, "@maintenance": data, "@docs": data } : {}) };
    },
    async readFiles(paths) {
      const out = {};
      await Promise.all(paths.map(async (p) => {
        const data = { "@probe": "probe.json", "@security": "security.json", "@maintenance": "maintenance.json", "@docs": "docs.json" }[p];
        const r = await gh(data ? `/contents/${data}?ref=evolve-data` : `/contents/${p}?ref=${head || branch}`, { headers: { Accept: "application/vnd.github.raw+json" } });
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
          body: `Automatic change from the MosaicScope evolution engine.\n\n- Check: \`${p.kind}\` at \`${p.path}:${p.line}\`\n- Pages it can affect (knowledge graph): ${(p.deps || []).join(", ") || "this file only"}\n- Fix: ${p.label}\n- Won by: **${p.agent}** (score ${p.score})\n- Changed lines: ${p.lines}\n\nCI (\`evolve-ci\`) re-validates this diff, runs the engine tests, and closes this PR and deletes the branch if anything fails.`,
        }) })).json();
        if (!pr.number) throw new Error("PR was not created");
        // features never merge themselves: a person approves them from the PR's preview
        if (p.approval) await gh(`/issues/${pr.number}/labels`, { method: "POST", body: JSON.stringify({ labels: ["evolve:needs-approval"] }) }).catch(() => {});
        return { ref: `#${pr.number}`, url: pr.html_url, pr: pr.number, branch: name };
      } catch (e) {
        await gh(`/git/refs/heads/${name}`, { method: "DELETE" }).catch(() => {}); // roll back the branch
        throw e;
      }
    },
    // Undo a merged change: restore its file to the version before the merge, on its own PR.
    async revert(acc) {
      const n = String(acc.ref).replace("#", "");
      const pr = await (await gh(`/pulls/${n}`)).json();
      const merge = pr.merge_commit_sha;
      if (!merge) throw new Error("change was never merged");
      const parent = (await (await gh(`/commits/${merge}`)).json()).parents?.[0]?.sha;
      const old = await (await gh(`/contents/${acc.path}?ref=${parent}`, { headers: { Accept: "application/vnd.github.raw+json" } })).text();
      const base = (await (await gh(`/commits/${branch}`, { headers: { Accept: "application/vnd.github.sha" } })).text()).trim();
      const meta = await (await gh(`/contents/${acc.path}?ref=${base}`)).json();
      const name = `evolve/revert-${merge}`;
      await gh(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${name}`, sha: base }) });
      await gh(`/contents/${acc.path}`, { method: "PUT", body: JSON.stringify({ message: `evolve: undo ${acc.ref} (site broke after it merged)`, content: b64(old), sha: meta.sha, branch: name }) });
      const r = await (await gh(`/pulls`, { method: "POST", body: JSON.stringify({ title: `evolve: undo ${acc.ref} — ${acc.label}`, head: name, base: branch, body: `The live site stopped answering 200 within 30 minutes of ${acc.ref} merging, so the engine is undoing it and has paused itself.\n\nCI checks this restores \`${acc.path}\` exactly to its version before the merge. Resume the engine from /evolve/ once the site is healthy.` }) })).json();
      return { ref: `#${r.number}`, url: r.html_url };
    },
    async audit() {
      const r = await gh(`/contents/audit.json?ref=evolve-data`, { headers: { Accept: "application/vnd.github.raw+json" } });
      return r.ok ? r.json() : null;
    },
    // Recovery to a known-good commit: only files whose every change since then came from the engine.
    async restore(good) {
      const base = (await (await gh(`/commits/${branch}`, { headers: { Accept: "application/vnd.github.sha" } })).text()).trim();
      const restored = [], skipped = [], contents = {};
      for (const p of ALLOWED_PATHS) {
        const list = await (await gh(`/commits?sha=${base}&path=${encodeURIComponent(p)}&per_page=30`)).json();
        const since = [];
        for (const c of Array.isArray(list) ? list : []) { if (c.sha === good) break; since.push(c); }
        if (!since.length) continue;
        if (since.length >= 30 || since.some((c) => !/^evolve:|^Merge pull request .* from [\w-]+\/evolve\//.test(c.commit?.message || ""))) { skipped.push(p); continue; }
        const r = await gh(`/contents/${p}?ref=${good}`, { headers: { Accept: "application/vnd.github.raw+json" } });
        if (r.ok) { contents[p] = await r.text(); restored.push(p); }
      }
      if (!restored.length) throw new Error("nothing safe to restore" + (skipped.length ? ` (people changed ${skipped.join(", ")})` : ""));
      const name = `evolve/revert-restore-${good}`;
      await gh(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${name}`, sha: base }) });
      for (const p of restored) {
        const meta = await (await gh(`/contents/${p}?ref=${name}`)).json();
        await gh(`/contents/${p}`, { method: "PUT", body: JSON.stringify({ message: `evolve: restore ${p} to known-good ${good.slice(0, 7)}`, content: b64(contents[p]), sha: meta.sha, branch: name }) });
      }
      const pr = await (await gh(`/pulls`, { method: "POST", body: JSON.stringify({ title: `evolve: restore ${restored.join(", ")} to known-good ${good.slice(0, 7)}`, head: name, base: branch, body: `A critical failure was seen on the live site. This restores the engine-edited files to the last commit the probe verified as healthy. Files a person changed since then were left alone: ${skipped.join(", ") || "none"}.` }) })).json();
      return { ref: `#${pr.number}`, url: pr.html_url, restored, skipped };
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
