import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { makeVehicle, seat, updateVehicles } from "../src/sim/Traffic";
import { PERIOD, ROAD_W, T } from "../src/world/World";
import { Phys } from "../src/entities/types";
import { runStep } from "../src/ai/steps";

const roadMid = () => ({ x: PERIOD * 1 + ROAD_W + 3.5, y: PERIOD * 2 + ROAD_W / 2 });

describe("people and the road", () => {
  it("the nearest place to stand off the road is the footpath", () => {
    const sim = small(4), r = roadMid();
    expect(sim.world.carriageway(r.x, r.y)).toBe(true);
    const p = sim.world.nearestFoot(r.x, r.y);
    expect(sim.world.tile(Math.floor(p.x), Math.floor(p.y))).toBe(T.SIDEWALK);
    expect(Math.hypot(p.x - r.x, p.y - r.y)).toBeLessThan(5);
  });

  it("someone idling in a lane steps up onto the footpath", () => {
    const sim = small(4), c = byName(sim, "Kodak"), r = roadMid();
    c.x = c.px = r.x; c.y = c.py = r.y; c.goal = null; c.mode = "idle"; c.vx = c.vy = 0; c.nextThink = 1e9;
    sim.vehicles.length = 0;
    for (let i = 0; i < 60 * 6; i++) sim.step();
    expect(sim.world.carriageway(c.x, c.y)).toBe(false);
  });

  it("a wander spot in the road is moved to the kerb", () => {
    const sim = small(4), c = byName(sim, "Nova"), r = roadMid();
    sim.vehicles.length = 0;
    const step = { kind: "wander" as const, x: r.x, y: r.y };
    const g = { id: "wander", target: -1, plan: [step], stepIdx: 0, stepTimer: 0, started: sim.tick, replans: 0 };
    runStep(c, step, g, sim, 0.1);
    expect(sim.world.carriageway(step.x, step.y)).toBe(false);
  });

  it("someone in the path of a speeding car dives clear and the driver gets an earful", () => {
    const sim = small(4), r = roadMid(), c = byName(sim, "Grain");
    sim.vehicles.length = 0;
    const v = makeVehicle(sim, "sports", r.x - 6, r.y, 0, "parked");
    seat(sim, byName(sim, "Lux"), v); v.state = "free";
    v.speed = 9; v.vx = 9; v.vy = 0; v.dynT = sim.tick;
    c.x = c.px = r.x; c.y = c.py = r.y; c.goal = null; c.nextThink = 1e9; c.vx = c.vy = 0;
    sim.rebuildHash();
    let dodged = false;
    for (let i = 0; i < 40 && !dodged; i++) { sim.tick++; sim.rebuildHash(); updateVehicles(sim, 1 / 60); dodged = Math.hypot(c.kx, c.ky) > 2 && c.phys === Phys.STUMBLE; }
    expect(dodged).toBe(true);
    expect(c.emo.fear).toBeGreaterThan(0.2);
  });
});
