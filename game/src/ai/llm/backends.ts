// Three ways to reach a model. Each returns a Chooser: (system, user) -> reply text.
// Nothing here runs unless the page is opened with ?llm=... (see index.ts), so the default stays offline.

/** Optional knobs: goal picks want one number (8 tokens, temperature 0); player chat wants a sentence or two. */
export interface AskOpts { maxTokens?: number; temperature?: number }
export type Chooser = (system: string, user: string, opts?: AskOpts) => Promise<string>;
const toks = (o?: AskOpts) => o?.maxTokens ?? 8;
const temp = (o?: AskOpts) => o?.temperature ?? 0;

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
  return (system, user, o) => postJson(url, { system, user, max_tokens: toks(o), temperature: temp(o) });
}

/** C (local, Node). A small HTTP server wrapping a GGUF file through node-llama-cpp (game/scripts/llm-local.mjs). */
export function localGgufChooser(url = "http://127.0.0.1:8787/chat"): Chooser {
  return (system, user, o) => postJson(url, { system, user, max_tokens: toks(o), temperature: temp(o) });
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
  return async (system, user, o) => {
    const out = await engine.chat.completions.create({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: toks(o),
      temperature: temp(o),
    });
    return String(out.choices?.[0]?.message?.content ?? "");
  };
}

// ---- Ollama (local app, uses your GPU) ----

export const OLLAMA_DEFAULT_URL = "http://127.0.0.1:11434";
/** Ollama's hosted service: a free ollama.com account gives an API key for its cloud models. */
export const OLLAMA_CLOUD_URL = "https://ollama.com";
const ollamaHeaders = (key?: string): Record<string, string> => ({ "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) });

/** Models installed in Ollama (names like "llama3.2:1b"). Throws if Ollama is not reachable from this page. */
export async function listOllamaModels(url = OLLAMA_DEFAULT_URL, key?: string): Promise<string[]> {
  const r = await fetch(`${url.replace(/\/$/, "")}/api/tags`, { headers: ollamaHeaders(key) });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const j = (await r.json()) as { models?: { name?: string }[] };
  return (j.models ?? []).map((m) => String(m.name ?? "")).filter(Boolean);
}

export function ollamaChooser(model: string, url = OLLAMA_DEFAULT_URL, key?: string): Chooser {
  const base = url.replace(/\/$/, "");
  return async (system, user, o) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000); // first call may load the model into memory
    try {
      const r = await fetch(`${base}/api/chat`, {
        method: "POST", headers: ollamaHeaders(key), signal: ctrl.signal,
        body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }], options: { temperature: temp(o), num_predict: toks(o) } }),
      });
      if (!r.ok) throw new Error(`ollama ${r.status}`);
      const j = (await r.json()) as { message?: { content?: string } };
      return String(j.message?.content ?? "");
    } finally {
      clearTimeout(timer);
    }
  };
}

// ---- Hugging Face directly from this browser, with your own token ----

/** Calls Hugging Face with the viewer's own token. The token stays in this browser only. */
export function hfDirectChooser(token: string, model: string): Chooser {
  return async (system, user, o) => {
    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: toks(o), temperature: temp(o) }),
    });
    if (!r.ok) throw new Error(`hf ${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return String(j.choices?.[0]?.message?.content ?? "");
  };
}

// ---- A GGUF file dropped into the page (wllama: llama.cpp compiled to WebAssembly, runs on the CPU) ----

export const WLLAMA_VERSION = "2.3.1";

export async function ggufFileChooser(file: Blob): Promise<Chooser> {
  const base = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* @vite-ignore */ `${base}/esm/index.js`);
  const wllama = new mod.Wllama({
    "single-thread/wllama.wasm": `${base}/esm/single-thread/wllama.wasm`,
    "multi-thread/wllama.wasm": `${base}/esm/multi-thread/wllama.wasm`,
  });
  await wllama.loadModel([file], { n_ctx: 1024 });
  return async (system, user, o) => {
    const out = await wllama.createChatCompletion(
      [{ role: "system", content: system }, { role: "user", content: user }],
      { nPredict: toks(o), sampling: { temp: temp(o) } },
    );
    return String(out ?? "");
  };
}

// ---- Claude, with the viewer's own API key (console.anthropic.com), straight from this browser ----

// Pinned so a CDN change cannot silently swap the code the page runs.
export const ANTHROPIC_SDK_VERSION = "0.71.0";
export const CLAUDE_DEFAULT_MODEL = "claude-opus-5-5";

/** The official Anthropic SDK, loaded only when this backend is picked. The key never leaves this browser except to Anthropic. */
export async function claudeChooser(apiKey: string, model = CLAUDE_DEFAULT_MODEL): Promise<Chooser> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@${ANTHROPIC_SDK_VERSION}/+esm`);
  const Anthropic = mod.default ?? mod.Anthropic;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return async (system, user, o) => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: Math.max(256, toks(o) * 4),
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low" }, // a one-number pick or a line of chat: shallow thinking is enough
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a safety decline re-runs on a fallback model instead of stopping
    });
    if (res.stop_reason === "refusal") return "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

// ---- Any OpenAI-compatible API (ChatGPT, Gemini, OpenRouter, LM Studio...) with the viewer's own key ----

export const OPENAI_COMPAT_PRESETS: { id: string; label: string; url: string; model: string; keyUrl: string }[] = [
  { id: "openai", label: "ChatGPT (OpenAI)", url: "https://api.openai.com/v1", model: "gpt-4o-mini", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", label: "Gemini (Google)", url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "openrouter", label: "OpenRouter (many models, one key)", url: "https://openrouter.ai/api/v1", model: "", keyUrl: "https://openrouter.ai/keys" },
];

export function openAiCompatChooser(baseUrl: string, apiKey: string, model: string): Chooser {
  const base = baseUrl.replace(/\/$/, "");
  return async (system, user, o) => {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: toks(o), temperature: temp(o) }),
    });
    if (!r.ok) throw new Error(`api ${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return String(j.choices?.[0]?.message?.content ?? "");
  };
}
