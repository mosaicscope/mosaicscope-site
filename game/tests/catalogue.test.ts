import { describe, it, expect } from "vitest";
import { buildCatalogue, validateCatalogue, CATEGORIES } from "../src/content/catalogue";
import { EVENT_DEFS } from "../src/events/defs";
import { TOYS } from "../src/content/toys";

describe("feature catalogue", () => {
  const list = buildCatalogue();
  it("is unique, valid and covers all 40 categories", () => {
    expect(CATEGORIES.length).toBe(40);
    expect(validateCatalogue(list)).toEqual([]);
    expect(new Set(list.map((f) => f.id)).size).toBe(list.length);
  });
  it("derives implemented entries from real registries", () => {
    for (const e of EVENT_DEFS) expect(list.some((f) => f.category === "Event types" && f.status === "implemented" && f.description.includes(`"${e.type}"`))).toBe(true);
    for (const t of Object.values(TOYS)) expect(list.some((f) => f.name === t.name && f.status === "implemented")).toBe(true);
  });
  it("labels planned ideas honestly and stays a reasonable size", () => {
    expect(list.filter((f) => f.status === "planned").length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10000);
  });
});
