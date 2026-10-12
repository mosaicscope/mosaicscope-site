import { describe, it, expect } from "vitest";
import { small, byName, stage, hashState, emptyHands } from "./helpers";
import { plan, F, PlanContext } from "../src/ai/planner";
import { think, forceGoal } from "../src/ai/brain";
import { Phys, Lod } from "../src/entities/types";
import { applyImpact } from "../src/physics/combat";
import { pickUp } from "../src/inventory/Inventory";
import { Simulation } from "../src/sim/Simulation";

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({ meleeToy: 1, throwToy: 2, bowToy: -1, comfortToy: 3, toyDist: () => 3, targetDist: 8, target: 9, boldness: 0.5, ...over });

describe("goal planner (GOAP)", () => {
  it("grabs a weapon, closes in and attacks when unarmed", () => {
    const p = plan(F.SEES_MELEE_TOY, F.TARGET_HIT, ctx())!;
    expect(p.ops.map((o) => o.name)).toEqual(["grab_melee", "close_in", "swing"]);
  });
  it("uses what is already in hand", () => {
    const p = plan(F.HAS_THROW | F.HAS_ANY_TOY, F.TARGET_HIT, ctx())!;
    expect(p.ops.map((o) => o.name)).toEqual(["get_in_range", "throw"]);
  });
  it("returns null when the goal is impossible", () => {
    expect(plan(0, F.TARGET_HIT, ctx())).toBeNull();
  });
  it("comforts with a plush when holding one", () => {
    const p = plan(F.HAS_COMFORT | F.HAS_ANY_TOY, F.TARGET_COMFORTED, ctx())!;
    expect(p.ops.map((o) => o.name)).toEqual(["close_in", "give_comfort"]);
  });
  it("plans a comforting gift when a plush is nearby", () => {
    const p = plan(F.SEES_COMFORT_TOY, F.TARGET_GIFTED, ctx())!;
    expect(p.ops.map((o) => o.name)).toEqual(["grab_comfort", "close_in", "give"]);
  });
});

describe("character state machine", () => {
  it("physical layer overrides goals; panic pre-empts; recovery returns to idle", () => {
    const sim = small();
    const c = byName(sim, "Nova");
    forceGoal(c, sim, "wander", { u: 1, target: -1 });
    expect(c.mode).toBe("goal");
    applyImpact(c, 99, 1, 0, false, sim.cfg.maxImpulse);
    think(c, sim, 0.016);
    expect(c.phys).toBe(Phys.DOWN); expect(c.mode).toBe("down");
    c.phys = Phys.OK; c.emo.fear = 1;
    think(c, sim, 0.016);
    expect(c.mode).toBe("panic"); expect(c.goal?.id).toBe("flee");
    c.emo.fear = 0;
    think(c, sim, 0.016);
    expect(c.mode).not.toBe("panic");
  });
  it("different personalities react differently to the same hit", () => {
    let retaliated = 0, timid = 0;
    for (const [name, seed] of [["Flash", 1], ["Flash", 2], ["Static", 1], ["Static", 2]] as const) {
      const sim = small(seed);
      const v = byName(sim, name), a = byName(sim, "Tiles");
      stage(sim, a, v, 2);
      v.nextThink = 0;
      const res = applyImpact(v, 2, 1, 0, false, sim.cfg.maxImpulse);
      sim.onImpact(a, v, "ball", res, false);
      sim.step(); sim.step();
      if (v.goal?.id === "fight" && v.goal.target === a.id) { if (name === "Flash") retaliated++; else timid++; }
    }
    expect(retaliated).toBeGreaterThan(timid);
  });
  it("principals pick up a toy and use it in a fight (end-to-end)", () => {
    const sim = small(5);
    const a = byName(sim, "Ruby"), t = byName(sim, "Grain");
    stage(sim, a, t, 3);
    emptyHands(sim, a);
    const sword = sim.spawnToy("foam_sword", a.x + 1, a.y + 0.5)!;
    a.nextThink = 0;
    expect(forceGoal(a, sim, "fight", { u: 1, target: t.id })).toBe(true);
    expect(a.goal!.plan[0].kind).toBe("pickup");
    t.nextThink = 1e9;
    let hit = false;
    sim.bus.on("event", (e) => { if ((e.type === "melee_hit" || e.type === "blocked") && e.actors.includes(t.id)) hit = true; });
    for (let i = 0; i < 60 * 10 && !hit; i++) sim.step();
    expect(sword.holder).toBe(a.id);
    expect(hit).toBe(true);
  });
  it("kind characters go and help someone who is down", () => {
    const sim = small(8);
    const helper = byName(sim, "Nova"), v = byName(sim, "Static");
    stage(sim, helper, v, 4);
    for (const c of sim.chars) if (c !== helper && c !== v) { c.x = c.px = 5; c.y = c.py = 5; c.nextThink = 1e9; }
    applyImpact(v, 99, 1, 0, false, sim.cfg.maxImpulse);
    v.physTimer = 20;
    helper.nextThink = 0; helper.goalCooldowns = {};
    let helped = false;
    sim.bus.on("event", (e) => { if (e.type === "help" && e.actors[0] === helper.id) helped = true; });
    for (let i = 0; i < 60 * 12 && !helped; i++) sim.step();
    expect(helped).toBe(true);
  });
});

describe("simulation tiers", () => {
  it("promotion and demotion keep memories, relationships and inventory", () => {
    const sim = small();
    const bg = sim.chars.find((c) => c.tier === "background")!;
    const toy = sim.spawnToy("ball", bg.x, bg.y)!;
    bg.hand = -1; pickUp(bg, toy, 0);
    sim.relate(bg, 1).aff = 0.7;
    bg.memories.push({ t: 1, kind: "event", subj: 1, obj: -1, toy: null, area: 0, val: 0.5, src: "saw", from: -1, cred: 1, ev: 1 });
    sim.focus = { x: bg.x, y: bg.y };
    sim.lod.update(sim);
    expect(bg.promoted).toBe(true); expect(bg.lod).toBe(Lod.REDUCED);
    bg.goal = null; bg.talkWith = -1;
    sim.focus = { x: (bg.x + 40) % 64, y: (bg.y + 40) % 64 };
    sim.lod.update(sim);
    expect(bg.promoted).toBe(false);
    expect(bg.hand).toBe(toy.id); expect(bg.rel.get(1)!.aff).toBe(0.7); expect(bg.memories.length).toBe(1);
  });
  it("far characters update less often than near ones", () => {
    const sim = small();
    for (let i = 0; i < 120; i++) sim.step();
    const near = sim.chars.filter((c) => c.lod === Lod.FULL).length, far = sim.chars.filter((c) => c.lod >= Lod.BACKGROUND).length;
    expect(near).toBeGreaterThan(0); expect(far).toBeGreaterThan(0);
  });
});

describe("determinism", () => {
  it("same seed, same world after many ticks", () => {
    const a = new Simulation({ seed: 77, midCount: 30, backgroundCount: 80 }), b = new Simulation({ seed: 77, midCount: 30, backgroundCount: 80 });
    for (let i = 0; i < 1200; i++) { a.step(); b.step(); }
    expect(hashState(a)).toBe(hashState(b));
    expect(a.events.history.map((e) => e.type)).toEqual(b.events.history.map((e) => e.type));
  });
});
