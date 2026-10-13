import { describe, it, expect } from "vitest";
import { choose, currentScene, finish, newHeist } from "../src/sim/Heist";

describe("Velvet Heist Night", () => {
  it("starts at the gossip act with no picks", () => {
    const s = newHeist();
    expect(s.act).toBe("gossip");
    expect(s.picks).toEqual([]);
    expect(currentScene(s)?.act).toBe("gossip");
  });

  it("walks through all three acts in order and then ends", () => {
    let s = newHeist();
    s = choose(s, "rumour_roast");
    expect(s.act).toBe("heist");
    s = choose(s, "rooftops");
    expect(s.act).toBe("getaway");
    s = choose(s, "gondola");
    expect(s.act).toBe("ending");
    expect(s.ending).toBeDefined();
    expect(currentScene(s)).toBeUndefined();
    expect(s.picks).toEqual(["rumour_roast", "rooftops", "gondola"]);
  });

  it("ignores choices that do not belong to the current act", () => {
    const s = newHeist();
    expect(choose(s, "rooftops")).toBe(s);
    expect(choose(s, "does_not_exist")).toBe(s);
  });

  it("accumulates stats from each choice", () => {
    let s = newHeist();
    s = choose(s, "rumour_none"); // heat +1
    s = choose(s, "front"); // heat +2, loot +1
    s = choose(s, "velvet_car"); // heat +1
    expect(s.heat).toBe(4);
    expect(s.loot).toBe(1);
  });

  it("ends busted when heat reaches 4", () => {
    let s = newHeist();
    s = choose(s, "rumour_none");
    s = choose(s, "front");
    s = choose(s, "velvet_car");
    expect(s.ending).toBe("busted");
  });

  it("ends clean on a quiet, successful run", () => {
    let s = newHeist();
    s = choose(s, "rumour_roast"); // trust +1
    s = choose(s, "rooftops"); // loot +1
    s = choose(s, "gondola"); // trust +1
    expect(s.ending).toBe("clean");
  });

  it("ends messy when the crate is missed or trust goes negative", () => {
    let s = newHeist();
    s = choose(s, "rumour_roast");
    s = choose(s, "rooftops");
    s = choose(s, "on_foot"); // trust -1
    expect(s.trust).toBe(0);
    expect(s.ending).toBe("clean");

    let t = newHeist();
    t = choose(t, "rumour_model");
    t = choose(t, "rooftops");
    t = choose(t, "on_foot"); // trust -1 overall
    expect(t.trust).toBe(-1);
    expect(t.ending).toBe("messy");
  });

  it("finish() marks a state as over without changing its stats", () => {
    const s = finish({ ...newHeist(), loot: 3 });
    expect(s.act).toBe("ending");
    expect(s.loot).toBe(3);
    expect(s.ending).toBe("clean");
  });
});
