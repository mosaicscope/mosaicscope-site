import { describe, it, expect } from "vitest";
import feed from "../src/content/terrance-feed.json";

/** Terrance's feed is hand-edited by a routine and shown verbatim in the game, so it must stay small and clean. */
describe("terrance feed", () => {
  const all = [...feed.changes, ...feed.drama];
  it("has the shape the panel expects", () => {
    expect(feed.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(feed.changes) && Array.isArray(feed.drama)).toBe(true);
    for (const s of all) expect(typeof s).toBe("string");
  });
  it("stays small enough to read in a speech panel", () => {
    expect(feed.changes.length).toBeGreaterThan(0);
    expect(feed.changes.length).toBeLessThanOrEqual(8);
    expect(feed.drama.length).toBeLessThanOrEqual(6);
    for (const s of feed.changes) expect(s.length, s).toBeLessThanOrEqual(160);
    for (const s of feed.drama) expect(s.length, s).toBeLessThanOrEqual(240);
  });
  it("has no empty or duplicate lines", () => {
    expect(all.every((s) => s.trim().length > 0)).toBe(true);
    expect(new Set(all.map((s) => s.toLowerCase())).size).toBe(all.length);
  });
  it("keeps to the content rules (no attack references, no real product named as a style reference)", () => {
    for (const s of all) expect(s, s).not.toMatch(/2019|mosque|terror|massacre|shooting/i);
    for (const s of all) expect(s, s).not.toMatch(/bum fights/i);
  });
});
