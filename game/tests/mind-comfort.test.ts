import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { comfortPull, WARM_FOODS, COLD_TREATS } from "../src/mind/Comfort";
import { foodUtility, chooseFood } from "../src/mind/Learning";
import { TOYS } from "../src/content/toys";
import type { Weather } from "../src/sim/Environment";

const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "storm"];
const MENU = ["flat_white", "hokey_pokey", "pie", "lp"];

describe("weather comfort appetite", () => {
  it("only names real food items", () => {
    for (const d of [...WARM_FOODS, ...COLD_TREATS]) expect(TOYS[d]?.category, d).toBe("food");
  });
  it("is small, bounded, deterministic and zero for unknown items or no weather", () => {
    for (const w of WEATHERS) for (const d of [...WARM_FOODS, ...COLD_TREATS, "energy_drink", "nope"]) {
      const v = comfortPull(d, w);
      expect(v).toBeGreaterThanOrEqual(-0.05); expect(v).toBeLessThanOrEqual(0.14);
      expect(comfortPull(d, w)).toBe(v);
    }
    expect(comfortPull("pie", undefined)).toBe(0);
    expect(comfortPull("energy_drink", "storm")).toBe(0);
  });
  it("warm food is pulled harder as the weather worsens; cold treats the other way", () => {
    expect(comfortPull("pie", "storm")).toBeGreaterThan(comfortPull("pie", "rain"));
    expect(comfortPull("pie", "rain")).toBeGreaterThan(comfortPull("pie", "clear"));
    expect(comfortPull("hokey_pokey", "clear")).toBeGreaterThan(comfortPull("hokey_pokey", "rain"));
  });
  it("shifts a person's utility by exactly the comfort pull and leaves the old behaviour without weather", () => {
    const sim = small(5), c = byName(sim, "Chris");
    c.hunger = 0.8; c.needs.energy = 0.3;
    const base = foodUtility(c, "pie", sim.tick);
    expect(foodUtility(c, "pie", sim.tick, undefined)).toBe(base);
    expect(foodUtility(c, "pie", sim.tick, "rain") - base).toBeCloseTo(comfortPull("pie", "rain"), 10);
    expect(foodUtility(c, "hokey_pokey", sim.tick, "clear")).toBeGreaterThan(foodUtility(c, "hokey_pokey", sim.tick));
  });
  it("makes the whole town pick more warm food in the rain than in the sun", () => {
    const share = (w: Weather) => {
      const sim = small(5); sim.env.weather = w;
      const c = byName(sim, "Chris"); c.hunger = 0.7; c.needs.energy = 0.4;
      let warm = 0; const n = 600;
      for (let i = 0; i < n; i++) if (WARM_FOODS.includes(chooseFood(sim, c, MENU))) warm++;
      return warm / n;
    };
    expect(share("storm")).toBeGreaterThan(share("clear"));
  });
});
