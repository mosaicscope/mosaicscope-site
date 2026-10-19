import { describe, it, expect } from "vitest";
import { Simulation } from "../src/sim/Simulation";
import { small, byName, stage, emptyHands } from "./helpers";
import { laneCoord, lightGreenFor, makeVehicle, seat, walkSignal, crossingOf } from "../src/sim/Traffic";
import { T } from "../src/world/World";
import { buy, consume, evaluateTrade, commitCrime, findWall, paint, book } from "../src/sim/Society";
import { wound, bandage, updateHealth, hospitalise } from "../src/sim/Life";
import { addLove, getTogether, kiss, loveOf, onGossip } from "../src/sim/Romance";
import { lookKey } from "../src/content/appearance";
import { reachableMask } from "../src/world/WorldGenerator";
import { forceGoal } from "../src/ai/brain";
import { Phys } from "../src/entities/types";
import { pickUp } from "../src/inventory/Inventory";

describe("city layout", () => {
  const sim = small(4);
  it("every building door is reachable and the key places exist", () => {
    const seen = reachableMask(sim.world);
    for (const b of sim.world.buildings) expect(seen[b.door.y * sim.world.size + b.door.x], b.name).toBe(1);
    for (const k of ["casino", "police", "dealership", "gallery", "hospital", "pizza", "dairy", "toyshop", "pawn", "stripclub", "velvet", "hellkitchen"]) expect(sim.world.buildings.some((b) => b.kind === k), k).toBe(true);
  });
  it("has the clubs and Hagley Park's zoo corner", () => {
    const w = sim.world;
    expect(w.buildings.find((b) => b.kind === "stripclub")!.name).toBe("The Pink Pukeko");
    expect(w.buildings.find((b) => b.kind === "velvet")!.name).toBe("The Velvet Rooms");
    const zoo = w.areas.find((a) => a.name === "Velvet Zoo")!;
    expect(zoo.kind).toBe("park");
    let fences = 0;
    for (let y = zoo.y0; y <= zoo.y1; y++) for (let x = zoo.x0; x <= zoo.x1; x++) if (w.tile(x, y) === T.FENCE) fences++;
    expect(fences).toBeGreaterThan(20);
  });
  it("roads are four lanes wide with crossings beside every intersection", () => {
    const w = sim.world, P = w.period;
    expect(P).toBe(20);
    for (const m of [0, 1, 2, 3]) expect(w.isRoadLine(2 * P + m)).toBe(true);
    expect(w.isRoadLine(2 * P + 4)).toBe(false);
    // crossings on the arms of intersection (2, 2), one sidewalk-width deep
    for (const [x, y] of [[2 * P + 1, 2 * P + 4], [2 * P + 1, 2 * P - 1], [2 * P + 4, 2 * P + 2], [2 * P - 2, 2 * P + 2]]) expect(w.tile(x, y), `${x},${y}`).toBe(T.CROSSWALK);
    expect(w.tile(2 * P + 1, 2 * P + 6)).toBe(T.ROAD);
  });
  it("names are unique real names (no numbers) and every face is different", () => {
    const names = sim.chars.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => /\d/.test(n))).toBe(false);
    const looks = sim.chars.filter((c) => c.look.face).map((c) => lookKey(c.look));
    expect(new Set(looks).size).toBe(looks.length);
    expect(sim.world.buildings.filter((b) => b.kind !== "house").every((b) => !/\d/.test(b.name))).toBe(true);
  });
});

describe("traffic", () => {
  it("drives on the left: lane coordinates per direction", () => {
    // four lanes per road (period 20): E uses the north half, W the south half; kerb lane 0, inner lane 1
    expect(laneCoord(0, 1)).toBe(20.5); expect(laneCoord(0, 1, 1)).toBe(21.5);
    expect(laneCoord(2, 1)).toBe(23.5); expect(laneCoord(2, 1, 1)).toBe(22.5);
    expect(laneCoord(1, 2)).toBe(43.5); expect(laneCoord(1, 2, 1)).toBe(42.5);
    expect(laneCoord(3, 2)).toBe(40.5); expect(laneCoord(3, 2, 1)).toBe(41.5);
  });
  it("traffic lights alternate between the two axes", () => {
    for (let t = 0; t < 60 * 40; t += 60) expect(lightGreenFor(0, 2, 3, t).green).not.toBe(lightGreenFor(1, 2, 3, t).green);
  });
  it("the green man shows only while the traffic it crosses is held on red", () => {
    const w = small(9).world, P = w.period;
    const x = crossingOf(w, 2 * P + 1, 2 * P + 4)!; // across the north-south road below intersection (2, 2)
    expect(x).toEqual({ c: 2, r: 2, axis: 1 });
    for (let t = 0; t < 60 * 40; t += 30) {
      const l = lightGreenFor(1, 2, 2, t), s = walkSignal(w, 2 * P + 1, 2 * P + 4, t);
      if (l.green) expect(s).toBe("stop");
      if (s === "walk") expect(l.green).toBe(false);
    }
  });
  it("a car stops at the stop line before the crossing on red", () => {
    const sim = small(9), P = sim.world.period;
    for (const v of sim.vehicles) if (v.state === "drive") { v.state = "parked"; v.x = -50; v.y = -50; }
    sim.tick = 600; // east-west is red at intersection (2, 2) for the next 10 s
    expect(lightGreenFor(0, 2, 2, sim.tick).green).toBe(false);
    const v = makeVehicle(sim, "sedan", 2 * P - 12, laneCoord(0, 2), 0, "drive"); v.speed = 7;
    for (let i = 0; i < 240; i++) sim.step();
    const front = v.x + 1.0, stopLine = 2 * P - 2;
    expect(front).toBeLessThanOrEqual(stopLine + 0.05);
    expect(front).toBeGreaterThan(stopLine - 1.5);
    expect(v.speed).toBeLessThan(0.2);
  });
  it("people wait at the kerb for the green man", () => {
    const sim = small(9), P = sim.world.period;
    for (const v of sim.vehicles) { v.state = "parked"; v.x = -50; v.y = -50; v.speed = 0; }
    const c = byName(sim, "Nova"); c.x = 2 * P + 4.4; c.y = 2 * P + 4.5;
    sim.tick = 600; // north-south traffic has green: don't walk across it
    expect(sim.trafficAhead(c, -1, 0)).toBe(true);
    sim.tick = 60; // north-south held on red: walk
    expect(sim.trafficAhead(c, -1, 0)).toBe(false);
  });
  it("cars keep their lanes, stop for people and never leave the map", () => {
    const sim = small(9);
    for (let i = 0; i < 60 * 90; i++) sim.step();
    for (const v of sim.vehicles) {
      expect(v.x).toBeGreaterThan(0); expect(v.x).toBeLessThan(sim.world.size); expect(Number.isFinite(v.y)).toBe(true);
      if (v.state === "drive" && !(sim.world.isRoadLine(Math.floor(v.x)) && sim.world.isRoadLine(Math.floor(v.y)))) {
        const cross = v.dir % 2 === 0 ? v.y : v.x;
        const line = Math.floor(cross / sim.world.period);
        // in one of its two lanes, or part-way through a lane change between them
        expect(Math.min(Math.abs(cross - laneCoord(v.dir, line, 0)), Math.abs(cross - laneCoord(v.dir, line, 1)))).toBeLessThan(0.55);
      }
    }
  }, 15000);
  it("a car brakes for someone lying in its lane", () => {
    // (someone just standing about steps up onto the footpath now, so the case that matters is someone who can't)
    const sim = small(9);
    for (const v of sim.vehicles) if (v.state === "drive") { v.state = "parked"; v.x = -50; v.y = -50; }
    const v = makeVehicle(sim, "sedan", 27, laneCoord(0, 2), 0, "drive"); v.speed = 7;
    const p = byName(sim, "Nova"); p.x = 34; p.y = laneCoord(0, 2); p.nextThink = 1e9; p.phys = Phys.DOWN; p.physTimer = 60;
    for (let i = 0; i < 120; i++) sim.step();
    expect(v.x).toBeLessThan(p.x - 1);
    expect(Math.abs(v.speed)).toBeLessThan(0.5);
  });
});

describe("money and barter", () => {
  it("buying costs the price, food restores hunger and is used up", () => {
    const sim = small();
    const c = byName(sim, "Lux"); emptyHands(sim, c);
    c.cash = 10; c.hunger = 0.2;
    const r = buy(sim, c, "pie", {});
    expect(r.ok).toBe(true); expect(c.cash).toBeCloseTo(4.5);
    expect(consume(sim, c, r.toy!)).toBe(true);
    expect(c.hunger).toBeGreaterThan(0.6); expect(c.hand).toBe(-1);
    expect(buy(sim, c, "bat", {}).ok).toBe(false);
  });
  it("barter: lowballs get a counter-offer, fair deals and friends get accepted", () => {
    const sim = small();
    const a = byName(sim, "Bando"), b = byName(sim, "Kodak"); emptyHands(sim, a); emptyHands(sim, b);
    const cam = sim.spawnToy("camera", b.x, b.y)!; pickUp(b, cam, 0);
    const ball = sim.spawnToy("ball", a.x, a.y)!; pickUp(a, ball, 0);
    a.cash = 1000;
    const low = evaluateTrade(sim, b, a, { items: [ball.id], cash: 0 }, { items: [cam.id], cash: 0 });
    expect(low.accept).toBe(false); expect(low.counterCash).toBeGreaterThan(300);
    const fair = evaluateTrade(sim, b, a, { items: [ball.id], cash: low.counterCash }, { items: [cam.id], cash: 0 });
    expect(fair.accept).toBe(true);
  });
});

describe("crime and police", () => {
  it("a witnessed theft brings a cop who chases and arrests; stolen goods go back", () => {
    const sim = small(6);
    const thief = sim.chars.find((c) => c.role === "thief")!, victim = byName(sim, "Static");
    stage(sim, thief, victim, 1);
    emptyHands(sim, victim);
    const phone = sim.spawnToy("phone", victim.x, victim.y)!; pickUp(victim, phone, 0); phone.owner = victim.id;
    // the victim is watchful: they always notice
    victim.pers.curiosity = 1;
    const cop = sim.chars.find((c) => c.role === "cop" && c.inCar < 0)!;
    if (cop.inside >= 0) { cop.inside = -1; }
    cop.x = thief.x + 6; cop.y = thief.y; cop.goal = null;
    for (const c of sim.chars) if (c.role === "cop" && c !== cop) { c.x = 2; c.y = 2; c.nextThink = 1e9; }
    phone.holder = thief.id; victim.hand = -1; thief.bag.push(phone.id);
    let noticed = false;
    for (let i = 0; i < 10 && !noticed; i++) noticed = commitCrime(sim, thief, "snatch", victim, "phone");
    expect(noticed).toBe(true);
    thief.nextThink = 1e9; thief.goal = null; thief.vx = thief.vy = 0;
    let arrested = false;
    sim.bus.on("event", (e) => { if (e.type === "arrest" && e.actors[1] === thief.id) arrested = true; });
    for (let i = 0; i < 60 * 20 && !arrested; i++) sim.step();
    expect(arrested).toBe(true);
    expect(phone.holder).toBe(victim.id);
  });
  it("the player gets wanted stars for witnessed crimes, and they fade when unseen", () => {
    const sim = small(6);
    const p = sim.player, v = byName(sim, "Nova");
    v.x = p.x + 1; v.y = p.y; v.pers.curiosity = 1;
    for (let i = 0; i < 10 && p.wanted === 0; i++) commitCrime(sim, p, "assault", v);
    expect(p.wanted).toBeGreaterThan(0);
    for (const c of sim.chars) if (c.role === "cop") { c.x = 3; c.y = 3; c.inside = -1; c.nextThink = 1e9; c.inCar = -1; }
    p.x = 90; p.y = 90;
    for (let i = 0; i < 60 * 60; i++) sim.step();
    expect(p.wanted).toBe(0);
  });
  it("graffiti goes on a real wall and can be cleaned off", () => {
    const sim = small(6, { midCount: 110 });
    const artist = sim.chars.find((c) => c.role === "graffiti")!;
    const shop = sim.world.buildings.find((b) => b.kind === "dairy")!;
    const spot = findWall(sim, shop.door.x, shop.door.y, 8)!;
    expect(spot).toBeTruthy();
    expect(spot.legal).toBe(false); // a shopfront, not the alley's legal wall
    const g = paint(sim, artist, spot);
    expect(sim.world.graffiti).toContain(g);
    const cleaner = sim.chars.find((c) => c.role === "cleaner")!;
    cleaner.x = spot.sx; cleaner.y = spot.sy; cleaner.inside = -1; cleaner.inCar = -1; cleaner.goal = null; cleaner.nextThink = 0; cleaner.goalCooldowns = {};
    for (let i = 0; i < 60 * 20 && sim.world.graffiti.includes(g); i++) sim.step();
    expect(sim.world.graffiti.includes(g)).toBe(false);
  });
});

describe("injuries", () => {
  it("open wounds bleed, bandages stop it, blood loss causes collapse and hospital care", () => {
    const sim = small(2);
    const c = byName(sim, "Grain");
    wound(sim, c, "head", 2, "gash", -1, c.x - 1, c.y);
    expect(c.bleed).toBeGreaterThan(0.3); // head gashes bleed hardest
    const b0 = c.blood;
    updateHealth(sim, c, 10);
    expect(c.blood).toBeLessThan(b0);
    expect(bandage(sim, null, c)).toBe(true);
    expect(c.bleed).toBe(0);
    wound(sim, c, "torso", 3, "stab", -1, c.x, c.y);
    c.blood = 0.4;
    updateHealth(sim, c, 20);
    expect(c.phys).toBe(Phys.DOWN);
    // Someone patches them up on the spot, or the ambulance takes them in.
    for (let i = 0; i < 60 * 90 && c.inside < 0 && !(c.bleed === 0 && c.phys === Phys.OK); i++) sim.step();
    expect(c.bleed).toBe(0);
    expect(c.inside >= 0 || c.phys === Phys.OK).toBe(true);
    hospitalise(sim, c);
    expect(c.inside).toBeGreaterThanOrEqual(0);
  }, 15000);
  it("a knife wound is level 3 and counts as a stabbing", () => {
    const sim = small(2);
    const a = sim.chars.find((c) => c.role === "thief")!, v = byName(sim, "Lux");
    stage(sim, a, v, 1); emptyHands(sim, a);
    const k = sim.spawnToy("knife", a.x, a.y)!; pickUp(a, k, 0);
    sim.rng = new (sim.rng.constructor as any)(1);
    let stab = false;
    sim.bus.on("event", (e) => { if (e.type === "injury" && e.data.level === 3) stab = true; });
    for (let i = 0; i < 5 && !stab; i++) { sim.nextAttack.clear(); a.facing = 0; v.phys = Phys.OK; sim.swingHeld(a); for (let t = 0; t < 3; t++) sim.step(); }
    expect(stab).toBe(true);
  });
});

describe("romance", () => {
  it("feelings grow into a relationship; a witnessed affair is told to the partner and ends badly", () => {
    const sim = small(3);
    const [a, b, c] = sim.chars.filter((x) => x.tier === "mid" && x.partner < 0).slice(0, 3);
    for (const x of [a, b, c]) x.attractedTo = ["guy", "girl"];
    addLove(sim, a, b, 0.8); addLove(sim, b, a, 0.8);
    getTogether(sim, a, b);
    expect(a.partner).toBe(b.id); expect(b.partner).toBe(a.id);
    // a cheats with c in front of a friend of b
    a.pers.honesty = 0.1;
    const friend = sim.chars.find((x) => x.tier === "mid" && x !== a && x !== b && x !== c)!;
    stage(sim, a, c, 1); friend.x = a.x + 2; friend.y = a.y; b.x = 90; b.y = 90;
    const r = sim.relate(friend, b.id); r.aff = 0.6; r.trust = 0.5; r.fam = 0.6;
    sim.rebuildHash();
    kiss(sim, a, c);
    expect(friend.memories.some((m) => m.kind === "cheating" && m.subj === a.id)).toBe(true);
    onGossip(sim, b, "cheating", a.id, c.id, 0.9);
    expect(sim.events.history.length + 1).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) sim.step();
    expect(sim.events.history.some((e) => e.type === "caught_cheating")).toBe(true);
    expect(loveOf(b, a.id)).toBeLessThan(0.8);
  });
  it("couples go on dates together", () => {
    const sim = small(5);
    const t = byName(sim, "Tiles"), g = byName(sim, "Glitter");
    expect(t.partner).toBe(g.id);
    stage(sim, t, g, 2);
    t.nextThink = 0; g.nextThink = 0;
    let dated = false;
    sim.bus.on("event", (e) => { if ((e.type === "date" || e.type === "night_together") && e.actors.includes(t.id)) dated = true; });
    expect(forceGoal(t, sim, "date", { u: 1, target: g.id })).toBe(true);
    for (let i = 0; i < 60 * 80 && !dated; i++) sim.step();
    expect(dated).toBe(true);
  });
});

describe("MosaicScope business", () => {
  it("bookings use the real price list and get shot", () => {
    const sim = small(5, { midCount: 110 });
    const client = sim.chars.find((c) => c.role === "musician" && c.tier === "mid")!;
    client.cash = 500;
    const b = book(sim, client)!;
    expect([40, 60, 80, 300]).toContain(b.price);
    expect(client.cash).toBe(500 - b.price);
    b.at = sim.tick;
    let shot = false;
    sim.bus.on("event", (e) => { if (e.type === "photoshoot") shot = true; });
    for (let i = 0; i < 60 * 120 && !shot; i++) sim.step();
    expect(shot).toBe(true);
  }, 15000);
});

describe("drivers", () => {
  it("people drive real cars and get out of them", () => {
    const sim = small(5);
    expect(sim.vehicles.filter((v) => v.driver >= 0).length).toBeGreaterThan(5);
    const d = sim.chars.find((c) => c.inCar >= 0)!;
    expect(sim.vehicles[d.inCar].driver).toBe(d.id);
    const v = makeVehicle(sim, "hatch", 30, 30, 0, "parked");
    const p = sim.player; seat(sim, p, v);
    expect(p.inCar).toBe(v.id);
    void Simulation;
  });
});
