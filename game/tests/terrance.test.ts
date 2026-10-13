import { describe, expect, it } from "vitest";
import { small, byName } from "./helpers";
import { reviewOf, type Reviewee } from "../src/ui/Terrance";
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
  it("reviews the player from their real run, worst first, three at most", () => {
    const calm: Reviewee = { cash: 100, wanted: 0, hunger: 0.8, blood: 1, stats: { hits: 0, falls: 0, helps: 0, gifts: 0 } };
    expect(reviewOf(calm, 12)).toEqual(["Clean diff. No comments. That is the suspicious part."]);
    const mess: Reviewee = { ...calm, wanted: 2, blood: 0.5, hunger: 0.1, cash: 5, stats: { hits: 9, falls: 4, helps: 0, gifts: 0 } };
    const r = reviewOf(mess, 3);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatch(/2 stars/);
    expect(reviewOf(calm, 3.5)[0]).toContain("03:00");
    expect(reviewOf({ ...calm, scrap: { can: 7, bottle: 5 } }, 12)[0]).toMatch(/12 cans/);
    expect(reviewOf({ ...calm, wanted: 1 }, 12)[0]).toMatch(/1 star\./);
  });
  it("reads a live sim", () => {
    const sim = small(7);
    expect(reviewOf(sim.player, sim.hour).length).toBeGreaterThan(0);
  });
});
