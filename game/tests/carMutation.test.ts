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
      expect(m.scale).toBeGreaterThanOrEqual(0.97);
      expect(m.scale).toBeLessThanOrEqual(1.03);
    }
  });
  it("retains normal two-axle silhouettes without stacked cabins", () => {
    for(const c of classes)for(const p of plates){const m=carMutationOf(p,c);expect(m.axles).toBe(2);expect(m.cabins).toBe(1);}
  });
  it("makes the same class look different from car to car", () => {
    const sizes = new Set(plates.map((p) => carMutationOf(p, "sedan").scale.toFixed(3)));
    expect(sizes.size).toBeGreaterThan(40);
  });
  it("keeps emergency and bus vehicles near their real proportions", () => {
    for (const c of ["police", "ambulance", "fire", "bus", "bin"] as VehicleClass[]) for (const p of plates) {
      const m = carMutationOf(p, c);
      expect(m.scale).toBeGreaterThanOrEqual(0.95);
      expect(m.scale).toBeLessThanOrEqual(1.1);
      expect(m.axles).toBe(2);
    }
  });
  it("keeps the engine pitch variation subtle", () => {
    for(const c of classes)for(const p of plates){const m=carMutationOf(p,c);expect(m.pitch).toBeGreaterThan(.98);expect(m.pitch).toBeLessThan(1.02);}
  });
});
