import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { applyInteraction, friendship, hostility, peek, remember, shareGossip, decayRelations } from "../src/social/Social";

describe("relationships", () => {
  it("change through interactions and personality", () => {
    const sim = small();
    const hot = byName(sim, "Flash"), calm = byName(sim, "Nova"), x = byName(sim, "Grain");
    applyInteraction(hot, x, "hit", true, 1); applyInteraction(calm, x, "hit", true, 1);
    expect(peek(hot, x.id)!.grudge).toBeGreaterThan(peek(calm, x.id)!.grudge); // temper matters
    const before = friendship(peek(calm, x.id));
    applyInteraction(calm, x, "helped", true, 2); applyInteraction(calm, x, "gift", true, 3);
    expect(friendship(peek(calm, x.id))).toBeGreaterThan(before);
    const g = peek(hot, x.id)!.grudge;
    applyInteraction(hot, x, "apologise", true, 4);
    expect(peek(hot, x.id)!.grudge).toBeLessThan(g);
  });
  it("stays sparse: meaningless edges are pruned", () => {
    const sim = small();
    const c = byName(sim, "Lux");
    c.rel.set(9999, { fam: 0, trust: 0, aff: 0, respect: 0, fear: 0, rivalry: 0, grudge: 0, shared: 0, favours: 0, last: 0 });
    decayRelations(c, 100000, 3600);
    expect(c.rel.has(9999)).toBe(false);
  });
});

describe("memory and gossip provenance", () => {
  it("passes on what was seen, marked as told, with lower credibility each hop", () => {
    const sim = small();
    const a = byName(sim, "Kodak"), b = byName(sim, "Glitter"), c = byName(sim, "Lux"), x = byName(sim, "Flash"), y = byName(sim, "Grain");
    remember(a, { t: 1, kind: "saw_fight", subj: x.id, obj: y.id, toy: "ball", area: 0, val: -0.8, ev: 77, src: "saw" });
    const m1 = shareGossip(a, b, 2)!;
    expect(m1.src).toBe("told"); expect(m1.from).toBe(a.id); expect(m1.cred).toBeLessThan(1);
    const m2 = shareGossip(b, c, 3)!;
    expect(m2.src).toBe("heard"); expect(m2.cred).toBeLessThan(m1.cred);
    expect(shareGossip(b, c, 4)).toBeNull(); // c already knows event 77
  });
  it("hearing that someone hit a person lowers trust in the aggressor", () => {
    const sim = small();
    const a = byName(sim, "Kodak"), b = byName(sim, "Nova"), x = byName(sim, "Flash");
    const t0 = peek(b, x.id)?.trust ?? 0;
    remember(a, { t: 1, kind: "hit", subj: x.id, obj: a.id, toy: "ball", area: 0, val: -0.7, ev: 5, src: "saw" });
    shareGossip(a, b, 2);
    expect(peek(b, x.id)!.trust).toBeLessThan(t0);
  });
  it("forgets the least important memories when full", () => {
    const sim = small();
    const c = byName(sim, "Grain");
    c.memories = [];
    for (let i = 0; i < c.memMax + 5; i++) remember(c, { t: i * 1000, kind: "event", subj: i, obj: -1, toy: null, area: 0, val: i === 0 ? -1 : 0.01, ev: i, src: "saw" });
    expect(c.memories.length).toBe(c.memMax);
    expect(c.memories.some((m) => m.val === -1)).toBe(true); // the vivid one survives
  });
});

describe("dialogue", () => {
  it("chooses lines that fit the relationship", () => {
    const sim = small();
    const a = byName(sim, "Grain"), b = byName(sim, "Flash");
    const r = sim.relate(a, b.id); r.grudge = 0.9; r.rivalry = 0.9; r.aff = -0.5;
    const lines = new Set(Array.from({ length: 12 }, () => sim.dialogue.bark(a, "greet", b)));
    expect([...lines].some((l) => /you|what do you want|again/i.test(l))).toBe(true);
    expect(hostility(r)).toBeGreaterThan(0.3);
  });
  it("only reports news the NPC actually knows, with its source", () => {
    const sim = small();
    const npc = byName(sim, "Static"), tiles = byName(sim, "Tiles"), ruby = byName(sim, "Ruby");
    npc.memories = [];
    const p = sim.player; p.x = npc.x + 1; p.y = npc.y;
    npc.talkWith = -1; npc.goal = null;
    let reply = sim.dialogue.playerOpen(npc);
    reply = sim.dialogue.playerChoose(npc, "news");
    expect(reply.text).not.toMatch(/Tiles|Ruby/);
    remember(npc, { t: sim.tick, kind: "argued", subj: tiles.id, obj: ruby.id, toy: null, area: 0, val: -0.6, ev: 3, src: "told", from: byName(sim, "Glitter").id, cred: 0.6 });
    reply = sim.dialogue.playerChoose(npc, "news");
    expect(reply.text).toMatch(/Tiles/); expect(reply.text).toMatch(/Glitter/);
  });
  it("NPC conversations run to completion and change relationships", () => {
    const sim = small();
    const a = byName(sim, "Lux"), b = byName(sim, "Nova");
    b.x = a.x + 1; b.y = a.y; a.nextThink = b.nextThink = 1e9;
    const fam0 = peek(a, b.id)?.fam ?? 0;
    expect(sim.startConversation(a, b, "chat")).toBe(true);
    for (let i = 0; i < 60 * 15; i++) sim.step();
    expect(a.talkWith).toBe(-1);
    expect(peek(a, b.id)!.fam).toBeGreaterThan(fam0);
    expect(a.memories.some((m) => m.kind === "talked" && m.subj === b.id)).toBe(true);
  });
});
