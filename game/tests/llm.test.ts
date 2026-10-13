import { describe, it, expect } from "vitest";
import { buildMenu, parseChoice } from "../src/ai/llm/choice";
import { LlmBrain } from "../src/ai/llm";

describe("LLM choice protocol", () => {
  it("builds a numbered menu", () => {
    expect(buildMenu([{ id: "wander", label: "wander" }, { id: "party", label: "party" }])).toBe("1. wander\n2. party");
  });
  it("parses the first number as a 1-based option", () => {
    expect(parseChoice("2", 3)).toBe(1);
    expect(parseChoice("  3. because", 3)).toBe(2);
  });
  it("rejects out-of-range, empty and non-numeric replies", () => {
    expect(parseChoice("0", 3)).toBeNull();
    expect(parseChoice("4", 3)).toBeNull();
    expect(parseChoice("", 3)).toBeNull();
    expect(parseChoice("wander", 3)).toBeNull();
  });
});

describe("LlmBrain", () => {
  const items = [{ id: "wander", label: "wander" }, { id: "party", label: "party" }];
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("returns the model's valid pick once, then nothing", async () => {
    const brain = new LlmBrain(async () => "2");
    brain.request(7, items, 100);
    await flush();
    expect(brain.take(7, 101, new Set(["wander", "party"]))).toBe("party");
    expect(brain.take(7, 101, new Set(["wander", "party"]))).toBeNull();
  });

  it("ignores a pick that is no longer a valid option", async () => {
    const brain = new LlmBrain(async () => "2");
    brain.request(7, items, 100);
    await flush();
    expect(brain.take(7, 101, new Set(["wander"]))).toBeNull();
  });

  it("discards a pick that has gone stale", async () => {
    const brain = new LlmBrain(async () => "1", { maxPerMinute: 20, maxAgeTicks: 10 });
    brain.request(7, items, 100);
    await flush();
    expect(brain.take(7, 500, new Set(["wander", "party"]))).toBeNull();
  });

  it("respects the per-minute budget", async () => {
    let calls = 0;
    let t = 0;
    const brain = new LlmBrain(async () => { calls++; return "1"; }, { maxPerMinute: 2, maxAgeTicks: 1000 }, () => t);
    for (let i = 0; i < 5; i++) brain.request(i, items, 0);
    await flush();
    expect(calls).toBe(2);
    t = 61_000;
    brain.request(9, items, 0);
    await flush();
    expect(calls).toBe(3);
  });

  it("keeps at most one request in flight per character", async () => {
    let calls = 0;
    const brain = new LlmBrain(() => { calls++; return new Promise(() => {}); });
    brain.request(1, items, 0);
    brain.request(1, items, 0);
    expect(calls).toBe(1);
  });

  it("treats a failing model as no pick", async () => {
    const brain = new LlmBrain(async () => { throw new Error("offline"); });
    brain.request(3, items, 0);
    await flush();
    expect(brain.take(3, 0, new Set(["wander", "party"]))).toBeNull();
  });
});
