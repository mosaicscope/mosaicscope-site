import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { nearestRecyclable, nearestBin, collectPiece, rummageBin, cashIn, scrapCount, updateLitter } from "../src/sim/Litter";
import { serialize, restore, parseSave, toJSON } from "../src/persistence/SaveSystem";
import { SACK_CAP } from "../src/content/litter";
import { T } from "../src/world/World";

describe("street litter and recycling", () => {
  it("scatters the same litter and bins for the same seed, only on walkable ground", () => {
    const a = small(5), b = small(5), c = small(6);
    expect(a.litter.pieces.length).toBeGreaterThan(200);
    expect(a.litter.pieces.map((p) => [p.kind, p.x, p.y])).toEqual(b.litter.pieces.map((p) => [p.kind, p.x, p.y]));
    expect(a.litter.pieces.map((p) => p.x).join()).not.toBe(c.litter.pieces.map((p) => p.x).join());
    for (const p of a.litter.pieces) { expect(a.world.walkable(p.x, p.y)).toBe(true); expect(a.world.tile(Math.floor(p.x), Math.floor(p.y))).not.toBe(T.ROAD); }
    const bins = a.world.pois.filter((p) => p.kind === "bin");
    expect(bins.length).toBeGreaterThan(20);
    for (const p of bins) expect(a.world.walkableTile(Math.floor(p.x), Math.floor(p.y))).toBe(true);
  });

  it("puts cans within reach of where the player starts, and a recycling centre nearby", () => {
    const sim = small(3), p = sim.player;
    const near = sim.litter.pieces.filter((l) => ["can", "bottle"].includes(l.kind) && Math.hypot(l.x - p.x, l.y - p.y) < 30);
    expect(near.length).toBeGreaterThanOrEqual(8);
    const centre = sim.world.buildings.find((b) => b.kind === "recycling")!;
    expect(centre).toBeTruthy();
    expect(Math.hypot(centre.door.x - sim.focus.x, centre.door.y - sim.focus.y)).toBeLessThan(30);
  });

  it("picks up cans, rummages bins, and cashes in for money with a bulk bonus", () => {
    const sim = small(3), p = sim.player;
    const piece = sim.litter.pieces.find((l) => l.kind === "can")!;
    p.x = piece.x; p.y = piece.y;
    expect(nearestRecyclable(sim.litter, p.x, p.y, 1)).toBe(piece);
    expect(collectPiece(sim, p, piece)).toBe("ok");
    expect(piece.taken).toBe(true);
    expect(collectPiece(sim, p, piece)).toBe("no");
    const before = p.cash;
    expect(cashIn(sim, p).total).toBeCloseTo(0.1);
    expect(p.cash).toBeCloseTo(before + 0.1);
    expect(sim.litter.recycled).toBe(1);

    const bin = nearestBin(sim.world, sim.world.pois.find((q) => q.kind === "bin")!.x, sim.world.pois.find((q) => q.kind === "bin")!.y, 1)!;
    sim.litter.stock.set(bin.id, 3);
    const got = rummageBin(sim, p, bin);
    expect(got.can + got.bottle).toBe(3);
    expect(sim.litter.stock.get(bin.id)).toBe(0);
    expect(rummageBin(sim, p, bin).can).toBe(0);

    p.scrap = { can: 20, bottle: 0 }; // exactly the bulk threshold: 20 x 10c + 25%
    const r = cashIn(sim, p);
    expect(r.base).toBeCloseTo(2); expect(r.bonus).toBeCloseTo(0.5); expect(r.total).toBeCloseTo(2.5);
    expect(scrapCount(p)).toBe(0);
  });

  it("caps the sack", () => {
    const sim = small(3), p = sim.player;
    p.scrap = { can: SACK_CAP, bottle: 0 };
    const piece = sim.litter.pieces.find((l) => l.kind === "bottle")!;
    expect(collectPiece(sim, p, piece)).toBe("full");
    expect(piece.taken).toBe(false);
  });

  it("keeps the street messy over time without disturbing the main random stream", () => {
    const a = small(9), b = small(9);
    const rngBefore = a.rng.getState();
    for (let i = 0; i < 600; i++) updateLitter(a);
    expect(a.rng.getState()).toEqual(rngBefore);
    expect(a.litter.pieces.length).toBeLessThanOrEqual(560);
    expect(b.litter.uncollected).toBeGreaterThan(200);
  });

  it("survives save and load", () => {
    const sim = small(4), p = sim.player;
    const piece = sim.litter.pieces.find((l) => l.kind === "can")!;
    collectPiece(sim, p, piece);
    sim.litter.recycled = 7;
    const loaded = restore(parseSave(toJSON(serialize(sim))));
    expect(loaded.litter.pieces[piece.id].taken).toBe(true);
    expect(loaded.litter.recycled).toBe(7);
    expect(loaded.player.scrap?.can).toBe(1);
    expect(loaded.litter.pieces.length).toBe(sim.litter.pieces.length);
  });
});
