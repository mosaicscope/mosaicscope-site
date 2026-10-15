import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import {
  action,
  tickLife,
  resolveScene,
  workField,
  horseMeet,
  syncStock,
  OWNABLE,
} from "../src/sim/Chronicles";
import { HOUR, DAY, settleRace } from "../src/sim/Expansion";
import { serialize, restore } from "../src/persistence/SaveSystem";
const setup = () => {
  const sim = small(7, { midCount: 0, backgroundCount: 0 });
  sim.player.cash = 20000;
  tickLife(sim);
  return sim;
};
const advance = (sim: ReturnType<typeof setup>, ticks: number) => {
  sim.tick += ticks;
  tickLife(sim);
};
const horse = (sim: ReturnType<typeof setup>) => {
  sim.expansion.horse = {
    name: "Big Hay",
    skill: 100,
    fitness: 100,
    wins: 0,
    tier: 0,
    trained: -HOUR,
    raced: -HOUR,
  };
};
describe("saved city lives", () => {
  it("preserves state and building labels without sharing mutable state between slots", () => {
    const sim = setup(),
      b = sim.world.buildings.find((b) => OWNABLE.has(b.kind))!;
    action(sim, "buyBusiness", String(b.id));
    action(sim, "bank", "50");
    action(sim, "tv");
    action(sim, "case");
    const restored = restore(serialize(sim));
    expect(restored.life).toEqual(sim.life);
    expect(restored.world.buildings[b.id].name).toBe(b.name);
    restored.life.savings = 0;
    expect(sim.life.savings).toBe(50);
  });
  it("loads older saves with fresh city and casino defaults", () => {
    const sim = setup(),
      save = serialize(sim);
    delete save.life;
    delete (save.expansion as any).casino;
    const restored = restore(save);
    expect(restored.life.farm.fields).toHaveLength(16);
    expect(restored.expansion.casino.point).toBe(0);
  });
  it("conserves money through savings and rejects overdrafts/non-finite values", () => {
    const sim = setup(),
      cash = sim.player.cash;
    action(sim, "bank", "100");
    action(sim, "bank", "-50");
    expect(sim.player.cash + sim.life.savings).toBe(cash);
    action(sim, "bank", "-200");
    action(sim, "bank", "NaN");
    expect(sim.life.savings).toBe(50);
  });
  it("pays an encounter callback once across save/load and improves its contact relationship", () => {
    const sim = setup();
    resolveScene(sim, "dog", 2);
    resolveScene(sim, "dog", 2);
    expect(sim.life.followups).toHaveLength(1);
    const saved = restore(serialize(sim)),
      cash = saved.player.cash;
    advance(saved, HOUR * 3);
    expect(saved.player.cash).toBe(cash + 25);
    const trust = saved.chars[saved.life.followups[0].contact].rel.get(
      saved.playerId,
    )!.trust;
    tickLife(saved);
    expect(saved.player.cash).toBe(cash + 25);
    expect(trust).toBeGreaterThan(0);
  });
  it("rejects repeat charges during a movement meeting cooldown", () => {
    const sim = setup();
    action(sim, "movement");
    const cash = sim.player.cash;
    action(sim, "movement");
    expect(sim.player.cash).toBe(cash);
    expect(sim.life.movement.followers).toBe(3);
  });
  it("holds a scheduled election and unlocks policies and persistent landmarks", () => {
    const sim = setup();
    for (let i = 0; i < 5; i++) {
      action(sim, "campaign");
      advance(sim, HOUR);
    }
    expect(sim.life.politics.mayor).toBe(false);
    advance(sim, HOUR);
    action(sim, "elect");
    expect(sim.life.politics.mayor).toBe(true);
    action(sim, "policy", "Nightlife grants");
    expect(sim.env.party).toBe(true);
    action(sim, "rename", "0");
    expect(sim.world.buildings[0].name).toContain("Monument");
    expect(sim.life.markers).toHaveLength(2);
  });
  it("pays a business once per day and rejects government property purchases", () => {
    const sim = setup(),
      b = sim.world.buildings.find((b) => OWNABLE.has(b.kind))!;
    action(sim, "buyBusiness", String(b.id));
    const cash = sim.player.cash;
    tickLife(sim);
    expect(sim.player.cash).toBe(cash);
    advance(sim, DAY);
    expect(sim.player.cash).toBeGreaterThan(cash);
    const count = sim.life.businesses.length;
    action(
      sim,
      "buyBusiness",
      String(sim.world.buildings.find((b) => b.kind === "police")!.id),
    );
    expect(sim.life.businesses).toHaveLength(count);
  });
  it("turns a prepared festival into income; a bad one damages reputation and raises council heat", () => {
    const good = setup();
    action(good, "festival");
    for (const key of ["toilet", "toilet", "act", "act"]) action(good, key);
    const cash = good.player.cash;
    advance(good, HOUR * 6);
    expect(good.player.cash).toBeGreaterThan(cash);
    expect(good.player.reputation).toBe(8);
    const paid = good.player.cash;
    tickLife(good);
    expect(good.player.cash).toBe(paid);
    const bad = setup();
    action(bad, "festival");
    advance(bad, HOUR * 6);
    expect(bad.player.reputation).toBe(-5);
    expect(bad.life.council.heat).toBe(25);
  });
  it("requires timed evidence and settles a court case only once", () => {
    const sim = setup();
    action(sim, "case");
    action(sim, "evidence");
    action(sim, "evidence");
    expect(sim.life.court!.evidence).toBe(1);
    advance(sim, HOUR);
    action(sim, "evidence");
    advance(sim, HOUR * 2);
    action(sim, "hearing");
    expect(sim.life.precedent).toBe(true);
    const cash = sim.player.cash;
    action(sim, "hearing");
    expect(sim.player.cash).toBe(cash);
  });
  it("runs four causally linked disaster chapters and records a final map landmark", () => {
    const sim = setup();
    action(sim, "cascade");
    for (let i = 0; i < 4; i++) advance(sim, HOUR);
    expect(sim.life.chain.active).toBe(false);
    expect(sim.life.chain.step).toBe(4);
    expect(sim.life.markers[sim.life.markers.length - 1]?.name).toBe(
      "The Great Bull Detour",
    );
    expect(sim.life.tv.fame).toBe(12);
  });
  it("connects property ownership to tunnels, flooding, a pump and ghost income", () => {
    const sim = setup(),
      buildings = sim.world.buildings
        .filter((b) => OWNABLE.has(b.kind))
        .slice(0, 2);
    for (const b of buildings) {
      action(sim, "buyBusiness", String(b.id));
      action(sim, "tunnel", String(b.id));
    }
    expect(sim.life.tunnels.links).toHaveLength(2);
    sim.env.raining = true;
    advance(sim, DAY);
    expect(sim.life.tunnels.flood).toBe(20);
    action(sim, "pump");
    expect(sim.life.tunnels.flood).toBe(0);
    action(sim, "haunt");
    const id = String(sim.life.ghosts[0].building);
    action(sim, "ghostPeace", id);
    action(sim, "ghostPeace", id);
    expect(sim.life.ghosts[0].trust).toBe(50);
  });
  it("requires heir progression and carries businesses and grudges into the next generation", () => {
    const sim = setup();
    action(sim, "heir", "Pie Junior");
    action(sim, "trust");
    action(sim, "generation");
    expect(sim.life.dynasty.generation).toBe(1);
    for (let i = 0; i < 7; i++) advance(sim, DAY);
    action(sim, "generation");
    expect(sim.life.dynasty.generation).toBe(2);
    expect(sim.player.name).toBe("Pie Junior");
    expect(sim.life.dynasty.trust).toBe(0);
  });
  it("unlocks qualified careers and promotions without an interview/shift payout exploit", () => {
    const sim = setup();
    action(sim, "interview", "Engineer");
    expect(sim.life.career.role).toBe("");
    sim.expansion.graduated = ["Bachelor of Engineering"];
    action(sim, "interview", "Engineer");
    action(sim, "shift");
    const cash = sim.player.cash;
    action(sim, "interview", "Engineer");
    action(sim, "shift");
    expect(sim.player.cash).toBe(cash);
    for (let i = 0; i < 2; i++) {
      advance(sim, HOUR * 3);
      action(sim, "shift");
    }
    expect(sim.life.career.rank).toBe(2);
  });
  it("enrols a horse in Commerce with timed easy tests and a lasting bonus", () => {
    const sim = setup();
    horse(sim);
    action(sim, "horseEnrol");
    action(sim, "horseCourse", "calculator");
    expect(sim.life.horseUni.credits).toBe(0);
    for (let i = 0; i < 3; i++) {
      action(sim, "horseCourse", "carrot");
      advance(sim, HOUR);
    }
    expect(sim.life.horseUni.graduated).toBe(true);
    expect(sim.life.nemesis.heat).toBeGreaterThanOrEqual(15);
  });
  it("enforces scheduled racing meets and completes a four-meet season", () => {
    const sim = setup();
    horse(sim);
    horseMeet(sim);
    expect(sim.life.season.meets).toBe(0);
    for (let i = 0; i < 4; i++) {
      advance(sim, HOUR * 3);
      sim.expansion.horse!.fitness = 100;
      horseMeet(sim);
      const cash = sim.player.cash;
      horseMeet(sim);
      expect(sim.player.cash).toBe(cash);
    }
    expect(sim.life.season.year).toBe(2);
    expect(sim.life.season.meets).toBe(0);
  });
});
describe("farm machinery and individual stock", () => {
  it("requires tractor ownership, position, matching attachment and growth before harvesting", () => {
    const sim = setup();
    sim.expansion.farm = 1;
    expect(workField(sim, 0)).toContain("tractor");
    sim.expansion.machines = [
      "Tractor",
      "Plough",
      "Seed drill",
      "Combine harvester",
    ];
    sim.life.farm.ride = true;
    workField(sim, 0);
    expect(sim.life.farm.fields[0].stage).toBe("ploughed");
    sim.life.farm.tool = "Seed drill";
    workField(sim, 0);
    expect(sim.life.farm.fields[0].stage).toBe("sown");
    sim.life.farm.tool = "Combine harvester";
    const cash = sim.player.cash;
    workField(sim, 0);
    expect(sim.player.cash).toBe(cash);
    advance(sim, HOUR * 3);
    workField(sim, 0);
    expect(sim.player.cash).toBeGreaterThan(cash);
    expect(sim.life.farm.fields[0].stage).toBe("grass");
  });
  it("cannot work a remote paddock or mow a field repeatedly for free feed", () => {
    const sim = setup();
    sim.expansion.farm = 1;
    sim.expansion.machines = ["Tractor", "Mower"];
    sim.life.farm.ride = true;
    sim.life.farm.tool = "Mower";
    workField(sim, 5);
    expect(sim.expansion.feed).toBe(0);
    workField(sim, 0);
    workField(sim, 0);
    expect(sim.expansion.feed).toBe(10);
  });
  it("creates named stock with parentage and blocks instant repeated breeding", () => {
    const sim = setup();
    sim.expansion.farm = 1;
    sim.expansion.animals.Chickens = 1;
    syncStock(sim);
    const a = sim.life.farm.stock[0];
    a.name = "Mayor Cluck";
    action(sim, "breed", String(a.id));
    action(sim, "breed", String(a.id));
    expect(sim.life.farm.stock).toHaveLength(2);
    expect(sim.life.farm.stock[1].parent).toBe(a.id);
    expect(sim.expansion.animals.Chickens).toBe(2);
    action(sim, "celebrity", String(a.id));
    const cash = sim.player.cash;
    action(sim, "celebrity", String(a.id));
    expect(sim.player.cash).toBe(cash);
    expect(a.fame).toBe(10);
  });
  it("connects equipment and staff to contract income and daily wages", () => {
    const sim = setup();
    sim.expansion.farm = 1;
    action(sim, "contract");
    expect(sim.life.farm.lastContract).toBe(-DAY);
    sim.expansion.machines = ["Tractor"];
    action(sim, "hire");
    const cash = sim.player.cash;
    action(sim, "contract");
    expect(sim.player.cash - cash).toBe(110);
    const paid = sim.player.cash;
    action(sim, "contract");
    expect(sim.player.cash).toBe(paid);
    advance(sim, DAY);
    expect(sim.expansion.feed).toBe(10);
  });
});
describe("saved casino and vehicle services", () => {
  it("settles a saved race on the game clock once and never transfers it between slots", () => {
    const sim = setup();
    sim.expansion.casino.race = {
      sport: "Horse",
      order: [0, 1],
      names: ["Big Hay", "Rent"],
      until: 270,
      stake: 10,
      payout: 50,
      settled: false,
    };
    const saved = restore(serialize(sim));
    expect(settleRace(saved.expansion, 269)).toBe(0);
    expect(settleRace(saved.expansion, 270)).toBe(50);
    expect(settleRace(saved.expansion, 300)).toBe(0);
    expect(sim.expansion.casino.race.settled).toBe(false);
    expect(settleRace(setup().expansion, 300)).toBe(0);
  });
  it("preserves an unfinished craps point, Crash flight and tournament", () => {
    const sim = setup(),
      s = sim.expansion.casino;
    s.point = 6;
    s.pointStake = 25;
    s.crash = { start: sim.tick, stake: 10, bust: 2, paid: false };
    s.tournament = { round: 2, score: 17, paid: false };
    expect(restore(serialize(sim)).expansion.casino).toEqual(s);
  });
  it("fits unique car modifications and checks insurance claims against damage and cooldowns", () => {
    const sim = setup(),
      v = sim.vehicles[0];
    v.owner = sim.playerId;
    action(sim, "mod", "Tractor engine");
    const cash = sim.player.cash;
    action(sim, "mod", "Tractor engine");
    expect(sim.player.cash).toBe(cash);
    expect(v.lifeMods).toEqual(["Tractor engine"]);
    action(sim, "claim");
    expect(v.damage).toBe(0);
    action(sim, "insurance");
    v.damage = 0.8;
    v.engineDamage = 0.7;
    action(sim, "claim");
    expect(v.damage).toBe(0);
    expect(v.engineDamage).toBe(0);
    v.damage = 0.5;
    action(sim, "claim");
    expect(v.damage).toBe(0.5);
  });
});
