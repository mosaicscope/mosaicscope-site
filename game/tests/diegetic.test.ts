import { describe, it, expect } from "vitest";
import { T } from "../src/world/World";
import {
  surfaceOf, strideFor, FOOT, spatialize, dopplerRate, ENGINE, engineFreq, sirenFreq, sirenKindFor, busyness, birdRate, cricketLevel, windLevel,
  voiceBlips, doorKind, roomFor, interiorSurface, isOpenNow, Diegetic, STREET, type Surface,
  admit, mixCaps, pickSteps, MIX_GAP, BUS_LEVEL, type Prio,
} from "../src/audio/Diegetic";
import type { VehicleClass } from "../src/content/vehicles";
import { Camera } from "../src/render/Camera";
import { small } from "./helpers";

describe("Hunter's sound design (pure parts)", () => {
  it("every ground has a footstep and the surfaces differ", () => {
    const tiles = [T.GRASS, T.FLOOR, T.SAND, T.COURT, T.ROAD, T.CROSSWALK, T.PARKING, T.PATH, T.SIDEWALK, T.PAVE, T.STAGE];
    const seen = new Set<Surface>();
    for (const t of tiles) { const s = surfaceOf(t); seen.add(s); expect(FOOT[s]).toBeDefined(); }
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect(strideFor(4.5)).toBeGreaterThan(strideFor(1.5));
  });

  it("gets quieter with distance, pans with the screen, and the 2D view is flatter", () => {
    const near = spatialize(1, 0, 1.5, false), far = spatialize(20, 0, 1.5, false);
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(spatialize(60, 60, 1.5, false).gain).toBe(0);
    expect(spatialize(4, -4, 1.5, false).pan).toBeGreaterThan(0.2); // to the right on screen
    expect(spatialize(-4, 4, 1.5, false).pan).toBeLessThan(-0.2);
    // depth (towards or away from the viewer) costs less in the side view than distance along the street
    expect(spatialize(6, 6, 4, true).gain).toBeGreaterThan(spatialize(6, -6, 4, true).gain);
    for (const g of [spatialize(0, 0, 1, true), spatialize(0, 0, 1, false)]) expect(g.gain).toBe(1);
  });

  it("doppler: higher pitch approaching, lower receding, always bounded", () => {
    expect(dopplerRate(-8)).toBeGreaterThan(1);
    expect(dopplerRate(8)).toBeLessThan(1);
    expect(dopplerRate(0)).toBe(1);
    expect(dopplerRate(-500)).toBeLessThanOrEqual(1.25);
    expect(dopplerRate(500)).toBeGreaterThanOrEqual(0.8);
  });

  it("every car class has an engine, revving up with speed and dropping at each shift", () => {
    const classes: VehicleClass[] = ["hatch", "sedan", "suv", "ute", "taxi", "police", "van", "ambulance", "jdm", "muscle", "sports", "super"];
    for (const c of classes) {
      const p = ENGINE[c];
      expect(p).toBeDefined();
      expect(engineFreq(p, 0, 12)).toBeCloseTo(p.idle, 5);
      for (let s = 0; s <= 14; s += 0.25) { const f = engineFreq(p, s, 12); expect(f).toBeGreaterThanOrEqual(p.idle - 1e-6); expect(f).toBeLessThanOrEqual(p.top + 1e-6); }
      expect(engineFreq(p, 2.3, 12)).toBeGreaterThan(engineFreq(p, 0.2, 12)); // within first gear
      expect(engineFreq(p, 2.39, 12)).toBeGreaterThan(engineFreq(p, 2.41, 12)); // across the 1->2 shift (2.4 = a fifth of 12)
    }
    expect(ENGINE.muscle.idle).toBeLessThan(ENGINE.hatch.idle); // V8 sits lower than a hatchback
    expect(ENGINE.jdm.pops && ENGINE.muscle.pops && !ENGINE.sedan.pops).toBe(true);
  });

  it("sirens: police yelp sweeps, ambulance alternates, fire wails, all in a sane band", () => {
    expect(sirenKindFor("police")).toBe("yelp"); expect(sirenKindFor("ambulance")).toBe("hilo"); expect(sirenKindFor("van")).toBe("wail");
    const hilo = new Set<number>(), yelp = new Set<number>();
    for (let t = 0; t < 4; t += 0.01) {
      for (const k of ["yelp", "hilo", "wail"] as const) { const f = sirenFreq(k, t); expect(f).toBeGreaterThan(400); expect(f).toBeLessThan(1700); }
      hilo.add(sirenFreq("hilo", t)); yelp.add(Math.round(sirenFreq("yelp", t) / 50));
    }
    expect(hilo.size).toBe(2);
    expect(yelp.size).toBeGreaterThan(8);
  });

  it("the city is busier by day and with more around; birds and crickets keep their hours", () => {
    expect(busyness(0, 0, 12).traffic).toBeCloseTo(0, 2);
    expect(busyness(12, 30, 12).traffic).toBeGreaterThan(busyness(2, 5, 12).traffic);
    expect(busyness(12, 30, 12).crowd).toBeGreaterThan(busyness(12, 30, 3).crowd);
    expect(birdRate(9, 0, 0.8)).toBeGreaterThan(0);
    expect(birdRate(9, 0, 0.8)).toBeGreaterThan(birdRate(9, 0, 0.1));
    expect(birdRate(23, 0, 1)).toBe(0);
    expect(birdRate(9, 0.9, 1)).toBe(0);
    expect(cricketLevel(23, 0, 0.8, false)).toBeGreaterThan(0);
    expect(cricketLevel(12, 0, 0.8, false)).toBe(0);
    expect(cricketLevel(23, 0, 0.8, true)).toBe(0);
    expect(windLevel("storm", 1)).toBeGreaterThan(windLevel("clear", 0));
  });

  it("Terrance's voice is a capped, deterministic, higher-when-shouting mutter", () => {
    const a = voiceBlips("BOBONUT. I've read it one more time. Ask."), b = voiceBlips("BOBONUT. I've read it one more time. Ask.");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
    expect(voiceBlips("x".repeat(500)).length).toBeLessThanOrEqual(28);
    expect(voiceBlips("   ...  ")).toEqual([]);
    expect(voiceBlips("go!")[0].f).toBeGreaterThan(voiceBlips("go")[0].f);
    for (const bl of a) { expect(bl.f).toBeGreaterThan(80); expect(bl.f).toBeLessThan(400); expect(bl.dur).toBeLessThan(0.1); }
  });

  it("doors, rooms and opening hours", () => {
    expect(doorKind("cafe")).toBe("bell"); expect(doorKind("nightclub")).toBe("heavy"); expect(doorKind("house")).toBe("latch");
    expect(roomFor("nightclub").bass).toBeGreaterThan(roomFor("diner").bass);
    expect(roomFor("diner").fridge).toBe(true);
    expect(roomFor("recycling").machine).toBe(1);
    expect(roomFor("house").crowd).toBeLessThan(roomFor("nightclub").crowd);
    expect(interiorSurface("diner")).toBe("tile"); expect(interiorSurface("house")).toBe("wood");
    expect(isOpenNow([7, 19], 8)).toBe(true); expect(isOpenNow([7, 19], 21)).toBe(false);
    expect(isOpenNow([20, 4], 23)).toBe(true); expect(isOpenNow([20, 4], 12)).toBe(false);
  });
});

describe("the central mix rule", () => {
  const none: Record<Prio, number> = { critical: 0, event: 0, foley: 0 };
  it("drops foley first, then events, and always leaves headroom for critical sounds", () => {
    for (const lite of [false, true]) {
      const c = mixCaps(lite);
      expect(admit("foley", none, c)).toBe(true);
      // fill with foley until it is refused, long before the total cap
      let n = 0; while (admit("foley", { ...none, foley: n }, c)) n++;
      expect(n).toBeLessThanOrEqual(c.foley);
      // a crowded street (at the total cap) refuses events and foley but not a crash
      const full = { ...none, event: c.total };
      expect(admit("foley", full, c)).toBe(false);
      expect(admit("event", full, c)).toBe(false);
      expect(admit("critical", full, c)).toBe(true);
      expect(admit("critical", { ...none, critical: c.total + 2 }, c)).toBe(false); // still bounded
    }
    expect(mixCaps(true).total).toBeLessThan(mixCaps(false).total);
    expect(MIX_GAP.foley).toBeGreaterThan(MIX_GAP.critical);
    expect(BUS_LEVEL).toBeLessThan(0.8); // sits under the soundtrack
  });

  it("footsteps: yours always, at most two others, only close and quiet", () => {
    const crowd = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, dist: 1 + i * 0.5, player: false }));
    const picked = pickSteps([{ id: 0, dist: 0, player: true }, ...crowd], false, false);
    expect(picked.filter((p) => p.id === 0)).toHaveLength(1);
    expect(picked.length).toBe(3);
    const others = picked.filter((p) => p.id !== 0);
    expect(others.map((p) => p.id)).toEqual([1, 2]); // the nearest two
    for (const o of others) expect(o.gain).toBeLessThan(picked.find((p) => p.id === 0)!.gain * 0.5);
    // far people are never heard; 2D and phones allow only one other
    expect(pickSteps([{ id: 5, dist: 12, player: false }], false, false)).toEqual([]);
    expect(pickSteps(crowd, true, false).length).toBe(1);
    expect(pickSteps(crowd, false, true).length).toBe(1);
    expect(pickSteps([], false, false)).toEqual([]);
  });
});

/** A do-nothing AudioContext: records what gets built and lets the engine run headless. */
function fakeContext() {
  const made = { nodes: 0, started: 0 };
  const param = () => new Proxy<Record<string | symbol, unknown>>({ value: 0 }, { get: (t, k) => (k in t ? t[k] : () => undefined), set: (t, k, v) => { t[k] = v; return true; } });
  const node = (): any => {
    made.nodes++;
    const t: Record<string | symbol, unknown> = {};
    return new Proxy(t, {
      get(o, k) {
        if (k === "connect") return (x: unknown) => x;
        if (k === "start") return () => { made.started++; };
        if (k === "stop" || k === "disconnect") return () => undefined;
        if (!(k in o)) o[k] = param();
        return o[k];
      },
      set(o, k, v) { o[k] = v; return true; },
    });
  };
  const ctx: any = {
    currentTime: 0, sampleRate: 8000, state: "running",
    createGain: node, createBiquadFilter: node, createOscillator: node, createBufferSource: node, createStereoPanner: node, createDynamicsCompressor: node,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { ctx: ctx as AudioContext, made };
}

describe("Diegetic engine, headless", () => {
  it("runs over a live city without throwing, builds nodes, honours mute, and stays inside the voice cap", () => {
    const sim = small(5);
    const { ctx, made } = fakeContext();
    const dg = new Diegetic(ctx, (ctx as any).createGain(), false);
    dg.attach(sim);
    const cam = new Camera(); const p = sim.player; cam.lookAt(p.x, p.y, true); cam.zoom = 1.5;
    const before = made.nodes;
    for (let i = 0; i < 400; i++) {
      sim.step();
      (ctx as any).currentTime += 1 / 60;
      dg.update(sim, cam, STREET);
    }
    expect(made.nodes).toBeGreaterThan(before); // footsteps / doors / birds got built
    // sound events of every kind the sim sends are handled
    for (const k of ["horn", "crash", "carhit", "till", "clink", "bin", "recycle", "taser", "squirt", "paintball", "mystery"]) dg.onSound(k, p.x + 1, p.y, 1, cam, STREET);
    dg.speak("BOBONUT. Ask.", cam, STREET, p);
    dg.speak("Panel line", cam, { ...STREET, in2D: true });
    // interior, 2D, muted and storm do not throw either
    const inside = { interior: "nightclub" as const, moving: true, running: false, in2D: false };
    for (let i = 0; i < 80; i++) { sim.step(); (ctx as any).currentTime += 1 / 30; dg.update(sim, cam, i % 2 ? inside : { ...STREET, in2D: true }); }
    sim.env.weather = "storm"; sim.env.raining = true; sim.env.storm = true; sim.env.rain = 1; sim.env.lightningAt = sim.tick;
    for (let i = 0; i < 40; i++) { sim.step(); (ctx as any).currentTime += 1 / 30; dg.update(sim, cam, STREET); }
    dg.setLevel(false, 0.5);
    const n = made.nodes;
    dg.onSound("crash", p.x, p.y, 1, cam, STREET); dg.update(sim, cam, STREET);
    expect(made.nodes).toBe(n); // muted: nothing new is built
    dg.dispose();
  });

  it("caps live one-shot voices", () => {
    const sim = small(6);
    const { ctx, made } = fakeContext();
    const dg = new Diegetic(ctx, (ctx as any).createGain(), true); // phone-sized pool: 8
    dg.attach(sim);
    const cam = new Camera(); cam.lookAt(sim.player.x, sim.player.y, true);
    const base = made.nodes;
    for (let i = 0; i < 100; i++) dg.onSound("crash", sim.player.x, sim.player.y, 1, cam, STREET); // nothing ever ends in the fake, so the pool fills
    const perCrash = 30; // generous upper bound on nodes per crash
    expect(made.nodes - base).toBeLessThan(8 * perCrash);
  });
});
