import { describe, it, expect } from "vitest";
import { small, byName, stage, emptyHands } from "./helpers";
import { canCollide, LAYER, MASK } from "../src/physics/layers";
import { Phys } from "../src/entities/types";
import { applyImpact, aimThrow } from "../src/physics/combat";
import { Rng } from "../src/core/rng";
import { pickUp, drop, transfer, canPickUp } from "../src/inventory/Inventory";
import { peek } from "../src/social/Social";

describe("collision filtering", () => {
  it("darts hit people and walls but never other darts", () => {
    expect(canCollide(LAYER.PROJECTILE, MASK.PROJECTILE, LAYER.PROJECTILE, MASK.PROJECTILE)).toBe(false);
    expect(canCollide(LAYER.PROJECTILE, MASK.PROJECTILE, LAYER.CHAR, MASK.CHAR)).toBe(true);
    expect(canCollide(LAYER.TOY, MASK.TOY, LAYER.HEAVY, MASK.HEAVY)).toBe(true);
  });
});

describe("toy physics and impacts", () => {
  it("a thrown ball hits, knocks back, costs composure, and is remembered with a grudge", () => {
    const sim = small();
    const a = byName(sim, "Flash"), b = byName(sim, "Nova");
    stage(sim, a, b, 4);
    const ball = sim.spawnToy("ball", a.x, a.y)!;
    emptyHands(sim, a); pickUp(a, ball, sim.tick);
    const before = { comp: b.emo.composure, grudge: peek(b, a.id)?.grudge ?? 0 };
    sim.rng = new Rng(1);
    // a perfect throw straight at Nova
    ball.state = "flying"; ball.holder = -1; a.hand = -1;
    ball.x = a.x + 0.4; ball.y = a.y; ball.z = 1.1; ball.vx = 9; ball.vy = 0; ball.vz = 0.3; ball.thrower = a.id; ball.throwTick = sim.tick;
    sim.throwIntent.set(ball.id, b.id);
    let hit = false;
    sim.bus.on("event", (e) => { if (e.type === "toy_hit" && e.actors[1] === b.id) hit = true; });
    for (let i = 0; i < 40; i++) sim.step();
    expect(hit).toBe(true);
    expect(b.emo.composure).toBeLessThan(before.comp);
    expect(b.memories.some((m) => m.kind === "hit_by" && m.subj === a.id)).toBe(true);
    expect(peek(b, a.id)!.grudge).toBeGreaterThan(before.grudge);
    expect(b.stats.hitsTaken).toBe(1);
  });
  it("balls bounce off the ground and come to rest; walls reflect them", () => {
    const sim = small();
    const t = sim.spawnToy("ball", 30, 30, 3)!;
    t.state = "flying";
    let bounces = 0; const orig = sim.hooks.onToyBounce;
    sim.hooks.onToyBounce = (toy, s, w) => { if (toy === t) bounces++; orig(toy, s, w); };
    for (let i = 0; i < 600; i++) sim.step();
    expect(bounces).toBeGreaterThan(1);
    expect(t.state).toBe("rest"); expect(t.z).toBeCloseTo(0, 3);
  });
  it("fast toys do not tunnel through walls", () => {
    const sim = small();
    const w = sim.world;
    // find a wall tile with walkable ground to its west
    let wx = -1, wy = -1;
    for (let y = 2; y < w.size - 2 && wx < 0; y++) for (let x = 3; x < w.size - 2; x++) if (w.tile(x, y) === 6 && w.walkableTile(x - 1, y) && w.walkableTile(x - 2, y)) { wx = x; wy = y; break; }
    expect(wx).toBeGreaterThan(0);
    const t = sim.spawnToy("dart", wx - 1.5, wy + 0.5, 0.5)!;
    t.state = "flying"; t.vx = 60; t.vy = 0; t.vz = 0;
    for (let i = 0; i < 30; i++) sim.step();
    expect(t.x).toBeLessThan(wx + 0.01);
  });
  it("impacts are capped and big hits knock people down, then they recover", () => {
    const sim = small();
    const c = byName(sim, "Static");
    const r = applyImpact(c, 999, 1, 0, false, sim.cfg.maxImpulse);
    expect(r.down).toBe(true); expect(c.phys).toBe(Phys.DOWN);
    expect(Math.hypot(c.kx, c.ky)).toBeLessThanOrEqual(sim.cfg.maxImpulse);
    c.nextThink = 1e9;
    for (let i = 0; i < 60 * 8; i++) sim.step();
    expect(c.phys).toBe(Phys.OK);
  });
  it("a raised shield blocks a frontal hit", () => {
    const sim = small();
    const a = byName(sim, "Flash"), d = byName(sim, "Grain");
    stage(sim, a, d, 1);
    const shield = sim.spawnToy("shield", d.x, d.y)!;
    emptyHands(sim, d); pickUp(d, shield, sim.tick);
    const sword = sim.spawnToy("foam_sword", a.x, a.y)!;
    emptyHands(sim, a); pickUp(a, sword, sim.tick);
    let blocked = false;
    sim.bus.on("event", (e) => { if (e.type === "blocked") blocked = true; });
    const comp = d.emo.composure;
    sim.swingHeld(a);
    for (let i = 0; i < 3; i++) sim.step();
    expect(blocked).toBe(true);
    expect(comp - d.emo.composure).toBeLessThan(0.05);
  });
  it("aimed throws land near the target for accurate throwers", () => {
    const rng = new Rng(4);
    const v = aimThrow(0, 0, 1.2, 6, 0, 1, 1, rng);
    expect(Math.atan2(v.vy, v.vx)).toBeCloseTo(0, 5);
    expect(v.vz).toBeGreaterThan(0);
  });
});

describe("inventory and ownership", () => {
  it("pickup, bag overflow, drop and transfer keep holder and slots consistent", () => {
    const sim = small();
    const c = byName(sim, "Bando");
    emptyHands(sim, c);
    const toys = ["ball", "plush", "yoyo", "frisbee", "noodle"].map((d) => sim.spawnToy(d, c.x, c.y)!);
    expect(pickUp(c, toys[0], 0)).toBe("hand");
    expect(pickUp(c, toys[1], 0)).toBe("bag");
    pickUp(c, toys[2], 0); pickUp(c, toys[3], 0);
    expect(pickUp(c, toys[4], 0)).toBe("full");
    expect(toys[0].holder).toBe(c.id); expect(toys[0].owner).toBe(c.id);
    drop(c, toys[0]);
    expect(toys[0].holder).toBe(-1); expect(c.hand).toBe(toys[1].id); // next item moves to hand
    const o = byName(sim, "Lux"); emptyHands(sim, o);
    expect(transfer(c, o, toys[1], true)).toBe(true);
    expect(toys[1].holder).toBe(o.id); expect(toys[1].owner).toBe(o.id);
    expect(canPickUp(o, toys[1])).toBe("unavailable");
    for (const t of sim.toys) if (t.state === "held") { const h = sim.chars[t.holder]; expect(h.hand === t.id || h.bag.includes(t.id)).toBe(true); }
  });
  it("broken toys are pooled and reused", () => {
    const sim = small();
    const t = sim.spawnToy("ball", 30, 30)!;
    sim.physics.breakToy(t, -1, sim.tick, sim.hooks);
    sim.tick += 200;
    const n = sim.toys.length;
    const t2 = sim.spawnToy("ball", 31, 31)!;
    expect(t2.id).toBe(t.id); expect(sim.toys.length).toBe(n); expect(t2.state).toBe("rest");
  });
  it("crafting turns a noodle and a plush into a flail", () => {
    const sim = small();
    const c = byName(sim, "Bando"); emptyHands(sim, c);
    pickUp(c, sim.spawnToy("noodle", c.x, c.y)!, 0); pickUp(c, sim.spawnToy("plush", c.x, c.y)!, 0);
    expect(sim.craft(c)).toBe(true);
    expect(sim.toys[c.hand].def).toBe("flail");
  });
});
