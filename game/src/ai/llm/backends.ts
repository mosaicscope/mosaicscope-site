// Three ways to reach a model. Each returns a Chooser: (system, user) -> reply text.
// Nothing here runs unless the page is opened with ?llm=... (see index.ts), so the default stays offline.

export type Chooser = (system: string, user: string) => Promise<string>;

const REQUEST_TIMEOUT_MS = 8000;

async function postJson(url: string, body: unknown): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`llm ${r.status}`);
    const j = (await r.json()) as { text?: string };
    return String(j.text ?? "");
  } finally {
    clearTimeout(timer);
  }
}

/** A. Hugging Face Inference via our Cloudflare Worker (game/llm-worker). The token never reaches the browser. */
export function hfWorkerChooser(url: string): Chooser {
  return (system, user) => postJson(url, { system, user });
}

/** C (local, Node). A small HTTP server wrapping a GGUF file through node-llama-cpp (game/scripts/llm-local.mjs). */
export function localGgufChooser(url = "http://127.0.0.1:8787/chat"): Chooser {
  return (system, user) => postJson(url, { system, user });
}

// Pinned so a CDN change cannot silently swap the code the page runs.
export const WEBLLM_VERSION = "0.2.80";
export const WEBLLM_DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

/** B. Fully in the visitor's browser via WebLLM. Downloads the model once; no server involved. */
export async function webLlmChooser(model = WEBLLM_DEFAULT_MODEL): Promise<Chooser> {
  const url = `https://esm.run/@mlc-ai/web-llm@${WEBLLM_VERSION}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webllm: any = await import(/* @vite-ignore */ url);
  const engine = await webllm.CreateMLCEngine(model);
  return async (system, user) => {
    const out = await engine.chat.completions.create({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 8,
      temperature: 0,
    });
    return String(out.choices?.[0]?.message?.content ?? "");
  };
}
