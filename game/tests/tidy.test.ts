import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { collectPiece, cashIn } from "../src/sim/Litter";
import { STREAK_WINDOW, updateTidy, nearestCompostable, collectCompostable, nearestCompost, feedCompost, swapFor, assembleArt, sellArt, compostCount } from "../src/sim/Tidy";
import { TRINKETS, ART_COST, verdictFor } from "../src/content/reuse";
import { serialize, restore, parseSave, toJSON } from "../src/persistence/SaveSystem";

describe("tidy-up streak, reuse stall and compost", () => {
  it("grows a streak with each tidy action, resets after a pause, and sparkles every fifth", () => {
    const sim = small(3), p = sim.player, fx: string[] = [], snd: string[] = [];
    sim.bus.on("fx", (f) => fx.push(f.kind)); sim.bus.on("sound", (s) => snd.push(s.kind));
    const cans = sim.litter.pieces.filter((l) => l.kind === "can").slice(0, 6);
    for (let i = 0; i < 4; i++) collectPiece(sim, p, cans[i]);
    expect(sim.tidy.streak).toBe(4);
    expect(snd).not.toContain("ding");
    collectPiece(sim, p, cans[4]);
    expect(sim.tidy.streak).toBe(5);
    expect(snd).toContain("ding"); expect(fx).toContain("star");
    sim.tick += STREAK_WINDOW + 1;
    collectPiece(sim, p, cans[5]);
    expect(sim.tidy.streak).toBe(1);
    expect(sim.tidy.best).toBe(5);
  });

  it("brightens windows where litter is gone", () => {
    const sim = small(3);
    updateTidy(sim);
    const b = sim.world.buildings.find((x) => x.shine !== undefined)!;
    const before = b.shine!;
    for (const l of sim.litter.pieces) l.taken = true;
    updateTidy(sim);
    expect(b.shine).toBeGreaterThanOrEqual(before);
    expect(b.shine).toBe(1);
    for (const x of sim.world.buildings) expect(x.shine).toBeGreaterThanOrEqual(0.0);
  });

  it("a tidy streak glows the blocks around the player", () => {
    const sim = small(3), p = sim.player;
    for (const l of sim.litter.pieces) l.taken = false;
    updateTidy(sim);
    const near = sim.world.buildings.reduce((a, b) => (Math.hypot(b.door.x - p.x, b.door.y - p.y) < Math.hypot(a.door.x - p.x, a.door.y - p.y) ? b : a));
    const base = near.shine!;
    sim.tidy.streak = 8; sim.tidy.last = sim.tick;
    updateTidy(sim);
    expect(near.shine!).toBeGreaterThanOrEqual(base);
  });

  it("swaps cans for trinkets, completes the set for a bonus, and refuses when short", () => {
    const sim = small(3), p = sim.player;
    p.scrap = { can: 1, bottle: 0 };
    expect(swapFor(sim, p, "kazoo").ok).toBe(false);
    p.scrap = { can: 200, bottle: 0 };
    const cash = p.cash;
    for (const t of TRINKETS) expect(swapFor(sim, p, t.id).ok).toBe(true);
    expect(sim.tidy.setDone).toBe(true);
    expect(p.cash).toBeGreaterThan(cash);
    expect(p.scrap!.can).toBe(200 - TRINKETS.reduce((n, t) => n + t.cost, 0));
    p.cash = 0; expect(swapFor(sim, p, "kazoo").ok).toBe(true); expect(p.cash).toBe(0); // the set bonus only pays once
  });

  it("assembles art Louis can price, deterministically, and pays when sold", () => {
    const a = small(5), b = small(5);
    for (const sim of [a, b]) { sim.player.scrap = { can: 3, bottle: 5 }; assembleArt(sim, sim.player); }
    expect(a.tidy.art).toEqual(b.tidy.art);
    const piece = a.tidy.art[0];
    expect(piece.cans + piece.bottles).toBe(ART_COST);
    expect(piece.price).toBeGreaterThan(0.5);
    expect(verdictFor(piece.q).length).toBeGreaterThan(20);
    expect(assembleArt(a, a.player).ok).toBe(false);
    const cash = a.player.cash;
    expect(sellArt(a, a.player, 0)).toBeTruthy();
    expect(a.player.cash).toBeCloseTo(cash + piece.price);
    expect(sellArt(a, a.player, 0)).toBeNull();
  });

  it("puts a compost bin in every park, and feeding it blooms that park", () => {
    const sim = small(3), p = sim.player;
    const parks = sim.world.areas.filter((x) => x.kind === "park");
    const bins = sim.world.pois.filter((x) => x.kind === "compost");
    expect(parks.length).toBeGreaterThan(0);
    expect(bins.length).toBe(parks.length);
    for (const bin of bins) expect(sim.world.walkableTile(Math.floor(bin.x), Math.floor(bin.y))).toBe(true);
    const wrapper = sim.litter.pieces.find((l) => l.kind === "wrapper" || l.kind === "cup")!;
    p.x = wrapper.x; p.y = wrapper.y;
    expect(nearestCompostable(sim.litter, p.x, p.y, 1)).toBe(wrapper);
    expect(collectCompostable(sim, p, wrapper)).toBe("ok");
    expect(compostCount(p)).toBe(1);
    const bin = bins[0];
    p.x = bin.x; p.y = bin.y;
    expect(nearestCompost(sim.world, p.x, p.y, 1)).toBe(bin);
    expect(sim.world.bloom.get(bin.area) ?? 0).toBe(0);
    expect(feedCompost(sim, p, bin)).toBe(1);
    expect(sim.world.bloom.get(bin.area)).toBeGreaterThan(0);
    expect(compostCount(p)).toBe(0);
    expect(feedCompost(sim, p, bin)).toBe(0);
    for (let i = 0; i < 40; i++) updateTidy(sim);
    expect(sim.world.bloom.get(bin.area) ?? 0).toBeLessThan(0.09);
  });

  it("cashing in counts as a tidy action", () => {
    const sim = small(3), p = sim.player;
    p.scrap = { can: 2, bottle: 0 };
    cashIn(sim, p);
    expect(sim.tidy.streak).toBe(1);
  });

  it("survives save and load, and does not disturb the main random stream", () => {
    const sim = small(4), p = sim.player;
    p.scrap = { can: 30, bottle: 0 };
    swapFor(sim, p, "kazoo"); assembleArt(sim, p);
    const bin = sim.world.pois.find((x) => x.kind === "compost")!;
    p.compost = 5; feedCompost(sim, p, bin);
    const rngBefore = sim.rng.getState();
    updateTidy(sim);
    expect(sim.rng.getState()).toEqual(rngBefore);
    const loaded = restore(parseSave(toJSON(serialize(sim))));
    expect(loaded.tidy.trinkets).toEqual(sim.tidy.trinkets);
    expect(loaded.tidy.art).toEqual(sim.tidy.art);
    expect(loaded.world.bloom.get(bin.area)).toBeCloseTo(sim.world.bloom.get(bin.area)!);
    expect(loaded.tidy.composted).toBe(5);
  });
});
