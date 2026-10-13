import { describe, expect, it } from "vitest";
import { small, byName } from "./helpers";
import feed from "../src/content/terrance-feed.json";

describe("Terrance the overcoder", () => {
  it("is completely red, stands in front of the Studio and holds his post", () => {
    const sim = small(7);
    const t = byName(sim, "Terrance");
    expect(t.role).toBe("overcoder");
    expect(t.look.color).toBe("#ec2a1c");
    const studio = { door: sim.world.pois.find((q) => q.kind === "door" && q.name === "MosaicScope Studio")! };
    expect(Math.hypot(t.x - studio.door.x, t.y - studio.door.y)).toBeLessThan(5);
    const x = t.x, y = t.y;
    for (let i = 0; i < 600; i++) sim.step();
    expect(t.x).toBeCloseTo(x, 5);
    expect(t.y).toBeCloseTo(y, 5);
  });
  it("ships a feed with changes and drama as plain strings", () => {
    expect(feed.changes.length).toBeGreaterThan(0);
    for (const s of [...feed.changes, ...feed.drama]) expect(typeof s).toBe("string");
  });
});
