import { describe, it, expect } from "vitest";
import { carMutationOf } from "../src/render/CarMutation";
import { VEHICLES, type VehicleClass } from "../src/content/vehicles";

const classes = Object.keys(VEHICLES) as VehicleClass[];
const plates = Array.from({ length: 300 }, (_, i) => `QX${100 + i * 13}`);

describe("car mutation", () => {
  it("is deterministic for the same car", () => {
    for (const c of classes) expect(carMutationOf("ABC123", c)).toEqual(carMutationOf("ABC123", c));
  });
  it("keeps every size within the drawable range", () => {
    for (const c of classes) for (const p of plates) {
      const m = carMutationOf(p, c);
      expect(m.scale).toBeGreaterThanOrEqual(0.55);
      expect(m.scale).toBeLessThanOrEqual(2.2);
    }
  });
  it("produces micro single-wheelers and multi-axle monsters across the fleet", () => {
    const all = classes.flatMap((c) => plates.map((p) => carMutationOf(p, c)));
    expect(all.some((m) => m.axles === 1)).toBe(true);
    expect(all.some((m) => m.axles === 3)).toBe(true);
    expect(all.some((m) => m.cabins === 3)).toBe(true);
  });
  it("makes the same class look different from car to car", () => {
    const sizes = new Set(plates.map((p) => carMutationOf(p, "sedan").scale.toFixed(3)));
    expect(sizes.size).toBeGreaterThan(100);
  });
  it("keeps emergency and bus vehicles near their real proportions", () => {
    for (const c of ["police", "ambulance", "fire", "bus", "bin"] as VehicleClass[]) for (const p of plates) {
      const m = carMutationOf(p, c);
      expect(m.scale).toBeGreaterThanOrEqual(0.95);
      expect(m.scale).toBeLessThanOrEqual(1.1);
      expect(m.axles).toBe(2);
    }
  });
  it("makes bigger cars sound lower and heavier", () => {
    const all = classes.flatMap((c) => plates.map((p) => carMutationOf(p, c)));
    const big = all.filter((m) => m.scale > 1.6), small = all.filter((m) => m.scale < 0.8);
    expect(big.length).toBeGreaterThan(0);
    expect(small.length).toBeGreaterThan(0);
    for (const m of big) { expect(m.pitch).toBeLessThan(1); expect(m.rumble).toBeGreaterThan(1.4); }
    for (const m of small) { expect(m.pitch).toBeGreaterThan(1); expect(m.rumble).toBeLessThan(1.15); }
  });
});
