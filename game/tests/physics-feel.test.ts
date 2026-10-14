import { describe, it, expect } from "vitest";
import { small, byName, stage, emptyHands } from "./helpers";
import { makeVehicle, seat, updateVehicles, playerInput } from "../src/sim/Traffic";
import { PERIOD, ROAD_W } from "../src/world/World";
import { Phys } from "../src/entities/types";
import { Simulation } from "../src/sim/Simulation";

/** A lone car for the player on the middle of an east-west road, everything else cleared off the street. */
function testCar(cls: "super" | "muscle" | "hatch") {
  const sim = small(4);
  const y = PERIOD * 2 + ROAD_W / 2, x = PERIOD * 1 + ROAD_W + 1;
  sim.vehicles.length = 0;
  const v = makeVehicle(sim, cls, x, y, 0, "parked");
  seat(sim, sim.player, v);
  v.state = "free";
  return { sim, v };
}
function drive(sim: Simulation, secs: number, inp: { throttle: number; steer: number; brake: boolean }, each?: () => void) {
  Object.assign(playerInput, inp);
  for (let i = 0; i < secs * 60; i++) { sim.tick++; updateVehicles(sim, 1 / 60); each?.(); }
  Object.assign(playerInput, { throttle: 0, steer: 0, brake: false });
}

describe("car handling", () => {
  it("accelerates hard, then coasts down slowly instead of stopping dead", () => {
    const { sim, v } = testCar("super");
    drive(sim, 1.2, { throttle: 1, steer: 0, brake: false });
    const fast = v.speed;
    expect(fast).toBeGreaterThan(6);
    drive(sim, 0.5, { throttle: 0, steer: 0, brake: false });
    expect(v.speed).toBeGreaterThan(fast * 0.85); // rolling resistance and drag, not a brick wall
    expect(Math.abs(v.slip ?? 0)).toBeLessThan(0.05);
  });

  it("holds a gentle turn at low speed without sliding", () => {
    const { sim, v } = testCar("hatch");
    drive(sim, 0.6, { throttle: 1, steer: 0, brake: false });
    let maxSlip = 0;
    drive(sim, 0.5, { throttle: 0.3, steer: 0.4, brake: false }, () => { maxSlip = Math.max(maxSlip, Math.abs(v.slip ?? 0)); });
    expect(maxSlip).toBeLessThan(0.6);
  });

  it("a handbrake turn at speed kicks the tail out, and the slide scrubs speed", () => {
    const { sim, v } = testCar("super");
    drive(sim, 1.3, { throttle: 1, steer: 0, brake: false });
    const before = v.speed;
    let maxSlip = 0;
    drive(sim, 0.4, { throttle: 0, steer: 1, brake: true }, () => { maxSlip = Math.max(maxSlip, Math.abs(v.slip ?? 0)); });
    expect(maxSlip).toBeGreaterThan(1);
    expect(v.speed).toBeLessThan(before);
  });

  it("a crash hands momentum to the car that was hit and spins it", () => {
    const { sim, v } = testCar("muscle");
    const other = makeVehicle(sim, "hatch", v.x + 5, v.y + 0.35, 1, "free");
    other.heading = Math.PI / 2;
    drive(sim, 1.4, { throttle: 1, steer: 0, brake: false });
    expect(other.state).toBe("crashed");
    expect(Math.hypot(other.vx ?? 0, other.vy ?? 0)).toBeGreaterThan(0.5);
    expect(Math.abs(other.yaw ?? 0) + Math.abs(v.yaw ?? 0)).toBeGreaterThan(0.05);
  });
});

describe("bodies and objects", () => {
  it("a car at speed throws a person up and forward, and they slide to a stop", () => {
    const { sim, v } = testCar("sedan" as "hatch");
    const c = byName(sim, "Kodak");
    c.x = c.px = v.x + 1.9; c.y = c.py = v.y; // too close to dive clear c.goal = null; c.nextThink = 1e9; c.vx = c.vy = 0; c.inCar = -1; c.inside = -1;
    sim.rebuildHash();
    v.speed = 8; v.vx = 8; v.vy = 0; v.dynT = sim.tick;
    let peakZ = 0, peakK = 0;
    for (let i = 0; i < 30 && peakK === 0; i++) { sim.tick++; sim.rebuildHash(); updateVehicles(sim, 1 / 60); peakK = Math.hypot(c.kx, c.ky) > 4 ? Math.hypot(c.kx, c.ky) : 0; }
    expect(peakK).toBeGreaterThan(5);
    for (let i = 0; i < 240; i++) { sim.physics.stepCharacter(c, 1 / 60, sim as never); peakZ = Math.max(peakZ, c.z); }
    expect(peakZ).toBeGreaterThan(0.3);
    expect(c.kx).toBe(0); expect(c.ky).toBe(0);
  });

  it("a ball rolls much further than a crate, and both come to a full stop", () => {
    const sim = small(4);
    const a = byName(sim, "Tiles"), b = byName(sim, "Glitter");
    stage(sim, a, b, 30); emptyHands(sim, a); emptyHands(sim, b);
    const p = sim.world.areas.find((x) => x.kind === "plaza")!;
    const ball = sim.spawnToy("ball", p.x0 + 2, p.y0 + 2)!, crate = sim.spawnToy("crate", p.x0 + 2, p.y0 + 4)!;
    for (const t of [ball, crate]) { t.vx = 4; t.vy = 0; t.vz = 0; t.state = "flying"; }
    const x0b = ball.x, x0c = crate.x;
    for (let i = 0; i < 60 * 8; i++) { sim.tick++; sim.physics.step(1 / 60, sim.toys, [], sim.charHash, sim.tick, sim as never); }
    expect(ball.x - x0b).toBeGreaterThan((crate.x - x0c) * 3);
    expect(ball.vx).toBe(0); expect(crate.vx).toBe(0);
  });

  it("knockback on someone standing stops quickly; a body down on the ground skids further", () => {
    const sim = small(4);
    const a = byName(sim, "Tiles"), b = byName(sim, "Glitter");
    stage(sim, a, b, 6);
    const run = (c: typeof a, phys: Phys) => { const x0 = c.x; c.phys = phys; c.kx = 5; c.ky = 0; c.z = 0; c.vz = 0; for (let i = 0; i < 120; i++) sim.physics.stepCharacter(c, 1 / 60, sim as never); return c.x - x0; };
    const standing = run(a, Phys.OK), sliding = run(b, Phys.DOWN);
    expect(sliding).toBeGreaterThan(standing * 1.3);
  });
});
