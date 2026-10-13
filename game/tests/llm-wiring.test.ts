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
