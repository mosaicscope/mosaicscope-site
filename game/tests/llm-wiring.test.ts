import { describe, it, expect, afterEach, vi } from "vitest";
import { small } from "./helpers";
import { chooseGoal } from "../src/ai/brain";
import { LlmBrain, llmFromQuery, setLlm, getLlm } from "../src/ai/llm";
// @ts-expect-error plain JS worker, typed by its own contract in the test
import worker from "../llm-worker/index.js";

afterEach(() => { setLlm(null); vi.unstubAllGlobals(); });

describe("?llm= switch", () => {
  it("is off without the parameter", async () => {
    expect(await llmFromQuery("")).toBeNull();
    expect(await llmFromQuery("?foo=1")).toBeNull();
  });
  it("hf needs the Worker URL and does not guess one", async () => {
    expect(await llmFromQuery("?llm=hf")).toBeNull();
    expect(await llmFromQuery("?llm=hf&llmUrl=https://x.workers.dev/pick")).toBeInstanceOf(LlmBrain);
  });
  it("local and unknown kinds", async () => {
    expect(await llmFromQuery("?llm=local")).toBeInstanceOf(LlmBrain);
    expect(await llmFromQuery("?llm=bogus")).toBeNull();
  });
});

describe("llm-worker", () => {
  const env = { HF_TOKEN: "test-token", LLM_MODEL: "m/test", ALLOWED_ORIGIN: "https://site.test" };
  const post = (body: unknown) => new Request("https://w.test/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  it("forwards a bounded request to the router with the token and returns {text}", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "2" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await worker.fetch(post({ system: "s", user: "1. a\n2. b" }), env);
    expect(await res.json()).toEqual({ text: "2" });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.test");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(init.body)).model).toBe("m/test");
  });
  it("rejects GET, bad JSON and empty user text", async () => {
    expect((await worker.fetch(new Request("https://w.test/"), env)).status).toBe(405);
    expect((await worker.fetch(new Request("https://w.test/", { method: "POST", body: "nope" }), env)).status).toBe(400);
    expect((await worker.fetch(post({ system: "s" }), env)).status).toBe(400);
  });
  it("reports upstream failure as 502", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 503 }));
    expect((await worker.fetch(post({ user: "1. a\n2. b" }), env)).status).toBe(502);
  });
});

describe("model pick reaches the sim", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("a principal's next goal is the model's valid pick, and the menu is only the valid options", async () => {
    const sim = small(5);
    const c = sim.chars.find((x) => x.tier === "principal")!;
    const seen: string[] = [];
    setLlm(new LlmBrain(async (_s, user) => { seen.push(user); return "1"; }));
    chooseGoal(c, sim); // first decision: heuristic, and asks the model
    await flush();
    expect(seen.length).toBe(1);
    const menu = seen[0].split("\n").filter((l) => /^\d\. /.test(l));
    expect(menu.length).toBeGreaterThanOrEqual(2);
    const pickedId = menu[0].replace(/^1\. /, "");
    c.goal = null;
    chooseGoal(c, sim); // second decision: uses the model's pick if it is still valid
    expect((c.goal as { id: string } | null)?.id).toBe(pickedId);
  });

  it("non-principals never ask the model", async () => {
    const sim = small(5);
    const c = sim.chars.find((x) => x.tier !== "principal" && x.tier !== "player")!;
    let calls = 0;
    setLlm(new LlmBrain(async () => { calls++; return "1"; }));
    chooseGoal(c, sim);
    await flush();
    expect(calls).toBe(0);
    expect(getLlm()).not.toBeNull();
  });
});

describe("Settings: AI brains", () => {
  it("loads valid llm settings and rejects junk", async () => {
    const { loadSettings, DEFAULT_SETTINGS } = await import("../src/persistence/Settings");
    const mem = (v: string) => ({ get: () => v, set: () => {}, remove: () => {}, keys: () => [] }) as never;
    expect(DEFAULT_SETTINGS.brains).toEqual({});
    const ok = loadSettings(mem(JSON.stringify({ brains: { ollama: { on: true, url: "http://127.0.0.1:11434", model: "llama3.2", key: "" } } })));
    expect(ok.brains.ollama).toEqual({ on: true, url: "http://127.0.0.1:11434", model: "llama3.2", key: "" });
    const bad = loadSettings(mem(JSON.stringify({ brains: { evil: { on: true }, claude: { on: "yes", key: 5 } } })));
    expect(bad.brains.evil).toBeUndefined();
    expect(bad.brains.claude).toEqual({ on: false, url: "", model: "", key: "" });
  });
  it("URL choice parsing and test() round trip", async () => {
    const { choiceFromQuery } = await import("../src/ai/llm");
    expect(choiceFromQuery("?llm=local&llmUrl=x")).toEqual({ kind: "local", url: "x", model: undefined });
    expect(choiceFromQuery("?llm=nope")).toBeNull();
    expect(await new LlmBrain(async () => "2").test()).toBe(true);
    expect(await new LlmBrain(async () => "hello").test()).toBe(false);
    expect(await new LlmBrain(async () => { throw new Error("down"); }).test()).toBe(false);
  });
});

describe("brain roster and new backends", () => {
  it("spreads principals across several connected brains", async () => {
    const { setLlmPool, getLlm } = await import("../src/ai/llm");
    const a = new LlmBrain(async () => "1"), b = new LlmBrain(async () => "1");
    setLlmPool([a, b]);
    expect(getLlm(0)).toBe(a);
    expect(getLlm(1)).toBe(b);
    expect(getLlm(2)).toBe(a);
    setLlmPool([]);
    expect(getLlm(3)).toBeNull();
  });

  it("Ollama: lists models and chats with the chosen one", async () => {
    const { listOllamaModels, ollamaChooser } = await import("../src/ai/llm/backends");
    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return url.endsWith("/api/tags")
        ? new Response(JSON.stringify({ models: [{ name: "llama3.2:1b" }, { name: "qwen2.5:3b" }] }))
        : new Response(JSON.stringify({ message: { content: "2" } }));
    });
    expect(await listOllamaModels("http://127.0.0.1:11434/")).toEqual(["llama3.2:1b", "qwen2.5:3b"]);
    expect(await ollamaChooser("qwen2.5:3b")("s", "u")).toBe("2");
    const body = JSON.parse(String(calls[1][1]?.body));
    expect(calls[1][0]).toBe("http://127.0.0.1:11434/api/chat");
    expect(body.model).toBe("qwen2.5:3b");
    expect(body.stream).toBe(false);
  });

  it("OpenAI-compatible (ChatGPT / Gemini / OpenRouter): sends key, model and returns the text", async () => {
    const { openAiCompatChooser } = await import("../src/ai/llm/backends");
    let seen: [string, RequestInit] | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { seen = [url, init]; return new Response(JSON.stringify({ choices: [{ message: { content: "1" } }] })); });
    expect(await openAiCompatChooser("https://generativelanguage.googleapis.com/v1beta/openai/", "k", "gemini-2.0-flash")("s", "u")).toBe("1");
    expect(seen![0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect((seen![1].headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it("missing key or model means no brain rather than a broken one", async () => {
    const { llmFromChoice } = await import("../src/ai/llm");
    expect(await llmFromChoice({ kind: "openai", url: "https://api.openai.com/v1", model: "m" })).toBeNull();
    expect(await llmFromChoice({ kind: "ollama" })).toBeNull();
    expect(await llmFromChoice({ kind: "claude" })).toBeNull();
    expect(await llmFromChoice({ kind: "gguf" })).toBeNull();
  });
});

describe("Ollama cloud (free ollama.com account)", () => {
  it("uses ollama.com with the API key when a key is given and no address", async () => {
    const { llmFromChoice } = await import("../src/ai/llm");
    let seen: [string, RequestInit] | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { seen = [url, init]; return new Response(JSON.stringify({ message: { content: "1" } })); });
    const b = await llmFromChoice({ kind: "ollama", model: "gpt-oss:20b", token: "ok-key" });
    expect(await b!.test()).toBe(true);
    expect(seen![0]).toBe("https://ollama.com/api/chat");
    expect((seen![1].headers as Record<string, string>).authorization).toBe("Bearer ok-key");
  });
});
