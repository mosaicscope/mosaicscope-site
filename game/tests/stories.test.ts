import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { FORTUNE_PRICE, FEED_PRICE, STAGE_TICKS } from "../src/sim/Stories";
import { serialize, restore, parseSave, toJSON } from "../src/persistence/SaveSystem";
import { Phys } from "../src/entities/types";

const runTicks = (sim: ReturnType<typeof small>, n: number) => { for (let i = 0; i < n; i++) { sim.tick++; sim.stories.update(sim); } };
const stand = (sim: ReturnType<typeof small>, x: number, y: number) => { const p = sim.player; p.x = p.px = x; p.y = p.py = y; p.vx = p.vy = 0; p.inCar = -1; p.phys = Phys.OK; };

describe("street stories", () => {
  it("places the fortune booth and the rooftop coop on open ground, the same for the same seed", () => {
    const a = small(5), b = small(5);
    expect(a.stories.kiosk).toBeTruthy();
    expect(a.stories.kiosk).toEqual(b.stories.kiosk);
    expect(a.stories.coop).toEqual(b.stories.coop);
    expect(a.world.walkable(a.stories.kiosk!.x, a.stories.kiosk!.y)).toBe(true);
    const foot = a.stories.ladderFoot();
    if (a.stories.coop) {
      expect(foot).toBeTruthy();
      expect(a.world.walkable(foot!.x, foot!.y)).toBe(true);
      const bl = a.world.buildings[a.stories.coop.building];
      expect(bl.floors).toBeGreaterThanOrEqual(2);
    }
    expect(a.stories.pigeons.filter((p) => !p.pet).length).toBeGreaterThanOrEqual(6);
  });

  it("charges for a fortune and quietly makes it come true", () => {
    const sim = small(3), st = sim.stories, p = sim.player;
    p.cash = 1000;
    stand(sim, sim.focus.x, sim.focus.y);
    for (let i = 0; i < 8; i++) expect(st.readFortune(sim)).not.toBe("poor");
    expect(p.cash).toBe(1000 - 8 * FORTUNE_PRICE);
    expect(st.fortunes.length).toBe(8);
    for (const f of st.fortunes) f.due = sim.tick;
    sim.tick = 30 * Math.ceil(sim.tick / 30);
    for (let r = 0; r < 4; r++) { runTicks(sim, 30); }
    // coins land near the player; walk onto them
    const before = p.cash;
    for (const d of [...st.drops]) { stand(sim, d.x, d.y); runTicks(sim, 60); }
    expect(st.drops.length).toBe(0);
    expect(p.cash).toBeGreaterThanOrEqual(before);
    expect(st.fortunes.every((f) => f.state === "true" || f.state === "pending")).toBe(true);
    expect(st.fortunes.filter((f) => f.state === "true").length).toBeGreaterThanOrEqual(6);
  });

  it("refuses a fortune when you can't pay", () => {
    const sim = small(3);
    sim.player.cash = FORTUNE_PRICE - 1;
    expect(sim.stories.readFortune(sim)).toBe("poor");
    expect(sim.stories.fortunes.length).toBe(0);
  });

  it("grows neighbour feuds through stages, and a mediator who hears both sides can end one", () => {
    const sim = small(3, { midCount: 40 }), st = sim.stories, p = sim.player;
    for (let i = 0; i < 60 && !st.feuds.length; i++) { sim.tick = 1800 * (i + 1); (st as any).startFeud(sim); }
    expect(st.feuds.length).toBeGreaterThan(0);
    const f = st.feuds[0];
    expect(f.state).toBe("on");
    const a = sim.chars[f.a], b = sim.chars[f.b];
    const litter0 = sim.litter.pieces.length, riv0 = sim.relate(a, b.id).rivalry;
    sim.tick = f.next; sim.tick -= sim.tick % 60; f.next = sim.tick;
    runTicks(sim, 60);
    expect(f.stage).toBe(1);
    expect(sim.litter.pieces.length).toBeGreaterThan(litter0);
    expect(sim.relate(a, b.id).rivalry).toBeGreaterThan(riv0);
    // can't broker a peace unheard
    expect(st.brokerTruce(sim, f)).toBe(0);
    st.hearOut(sim, f, 0); st.hearOut(sim, f, 1);
    p.cash = 0; const rep = p.reputation;
    const reward = st.brokerTruce(sim, f);
    expect(reward).toBeGreaterThan(0);
    expect(p.cash).toBe(reward);
    expect(p.reputation).toBeGreaterThanOrEqual(rep);
    expect(f.state).toBe("truce");
    expect(sim.relate(a, b.id).rivalry).toBeLessThan(riv0 + 0.15);
    expect(st.truces).toBe(1);
  });

  it("lets an ignored feud boil over into a brawl", () => {
    const sim = small(3, { midCount: 40 }), st = sim.stories;
    for (let i = 0; i < 60 && !st.feuds.length; i++) { sim.tick = 1800 * (i + 1); (st as any).startFeud(sim); }
    const f = st.feuds[0];
    for (let s = 0; s < 6 && f.state === "on"; s++) { sim.tick += STAGE_TICKS; sim.tick -= sim.tick % 60; f.next = sim.tick; runTicks(sim, 60); }
    expect(f.stage).toBe(5);
    expect(f.state).toBe("brawl");
    expect(st.notes.some((n) => n.text.includes("bust-up"))).toBe(true);
  });

  it("wins pigeons over with crumbs, who then tag along", () => {
    const sim = small(3), st = sim.stories, p = sim.player;
    p.cash = 50;
    const wild = st.pigeons.find((b) => !b.pet)!;
    stand(sim, wild.x + 1, wild.y);
    expect(st.feed(sim)).toBe("fed");
    expect(st.feed(sim)).toBe("fed");
    expect(st.feed(sim)).toBe("adopted");
    expect(p.cash).toBe(50 - 3 * FEED_PRICE);
    expect(wild.pet).toBe(true);
    expect(st.pets().length).toBe(1);
    p.cash = 0;
    expect(st.feed(sim)).toBe("poor");
    // the player walks off; the pet keeps up
    const dest = sim.world.nearestWalkable(sim.focus.x + 10, sim.focus.y);
    stand(sim, dest.x, dest.y);
    p.vx = 2; p.facing = 0;
    runTicks(sim, 600);
    expect(Math.hypot(wild.x - p.x, wild.y - p.y)).toBeLessThan(5);
  });

  it("learns the player's usual route and waits ahead of them", () => {
    const sim = small(3), st = sim.stories, p = sim.player;
    const b = st.pigeons.find((q) => !q.pet)!; st.adopt(b);
    const a = sim.world.nearestWalkable(sim.focus.x, sim.focus.y), next = sim.world.nearestWalkable(sim.focus.x + 12, sim.focus.y);
    const ca = st.cellOf(a.x, a.y), cn = st.cellOf(next.x, next.y);
    expect(ca).not.toBe(cn);
    st.route.set(ca, new Map([[cn, 9]]));
    stand(sim, a.x, a.y); p.vx = 2; p.facing = 0;
    b.x = a.x; b.y = a.y;
    sim.tick = 30 * 40;
    runTicks(sim, 31);
    expect(b.guess).toBe(cn);
    runTicks(sim, 400);
    const c = st.cellCentre(cn);
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeLessThan(1);
    // the player arrives: the guess counts
    stand(sim, c.x, c.y); p.vx = 2;
    runTicks(sim, 5);
    expect(b.learned).toBe(1);
    expect(b.guess).toBe(-1);
  });

  it("roosts pets on the coop roof at night and lets a full feeder tempt new lodgers", () => {
    const sim = small(5), st = sim.stories;
    if (!st.coop) return; // some tiny worlds have no suitable roof
    const wilds = st.pigeons.filter((b) => !b.pet);
    st.adopt(wilds[0]); st.adopt(wilds[1]);
    sim.env.startHour = 23; sim.tick = 0;
    runTicks(sim, 1500);
    const roof = st.coop.height;
    for (const b of st.pets()) { expect(b.mode).toBe("perch"); expect(b.z).toBeGreaterThan(roof); }
    sim.player.cash = 10;
    expect(st.fillFeeder(sim)).toBe(true);
    expect(sim.player.cash).toBe(7);
    const pets0 = st.pets().length;
    for (let h = 0; h < 12; h++) { sim.tick = Math.ceil(sim.tick / 3600) * 3600; st.update(sim); }
    expect(st.pets().length).toBeGreaterThan(pets0);
    expect(st.pets().length).toBeLessThanOrEqual(st.petCap);
  });

  it("saves and restores kiosk fortunes, feuds, pigeons and learned routes", () => {
    const sim = small(3, { midCount: 40 }), st = sim.stories;
    sim.player.cash = 100;
    st.readFortune(sim);
    const b = st.pigeons.find((q) => !q.pet)!; st.adopt(b); b.learned = 4;
    st.route.set(3, new Map([[4, 5], [7, 2]]));
    for (let i = 0; i < 60 && !st.feuds.length; i++) { sim.tick = 1800 * (i + 1); (st as any).startFeud(sim); }
    if (st.feuds.length) st.hearOut(sim, st.feuds[0], 1);
    const loaded = restore(parseSave(toJSON(serialize(sim))));
    const ls = loaded.stories;
    expect(ls.fortunes).toEqual(st.fortunes);
    expect(ls.pets().map((q) => [q.name, q.learned])).toEqual(st.pets().map((q) => [q.name, q.learned]));
    expect([...ls.route.get(3)!]).toEqual([[4, 5], [7, 2]]);
    expect(ls.feuds).toEqual(st.feuds);
    expect(ls.kiosk).toEqual(st.kiosk);
    for (let i = 0; i < 300; i++) loaded.step();
  });
});
