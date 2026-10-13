import { describe, it, expect } from "vitest";
import { patinaOf, weather } from "../src/render/CarPatina";
import { VEHICLES, type VehicleClass } from "../src/content/vehicles";

const classes = Object.keys(VEHICLES) as VehicleClass[];
const plates = Array.from({ length: 80 }, (_, i) => `ABC${100 + i * 7}`);

describe("car patina", () => {
  it("is deterministic for the same car", () => {
    for (const c of classes) expect(patinaOf(c, "XYZ123", 9000, 0)).toEqual(patinaOf(c, "XYZ123", 9000, 0));
  });
  it("makes cars of one class differ from each other", () => {
    const sigs = new Set(plates.map((p) => JSON.stringify(patinaOf("sedan", p, 9500))));
    expect(sigs.size).toBeGreaterThan(60);
  });
  it("wrecks look older than supercars, on average", () => {
    const avg = (c: VehicleClass) => plates.reduce((s, p) => s + patinaOf(c, p, VEHICLES[c].price).age, 0) / plates.length;
    expect(avg("banger")).toBeGreaterThan(avg("sedan"));
    expect(avg("sedan")).toBeGreaterThan(avg("super"));
  });
  it("keeps the emergency fleet clean of rust and stickers", () => {
    for (const c of ["police", "ambulance", "fire"] as VehicleClass[]) for (const p of plates) {
      const m = patinaOf(c, p, 0).marks.map((x) => x.kind);
      expect(m).not.toContain("rust"); expect(m).not.toContain("sticker"); expect(m).not.toContain("primer");
    }
  });
  it("crash damage adds dents", () => {
    const n = (d: number) => patinaOf("hatch", "QQQ999", 6500, d).marks.filter((m) => m.kind === "dent").length;
    expect(n(1)).toBeGreaterThan(n(0));
  });
  it("marks stay on the panel and weather() stays in colour range", () => {
    for (const c of classes) for (const p of plates.slice(0, 20)) {
      const pt = patinaOf(c, p, VEHICLES[c].price, 0.5);
      for (const m of pt.marks) { expect(m.t).toBeGreaterThanOrEqual(0); expect(m.t + m.w).toBeLessThanOrEqual(1.01); expect(m.u).toBeGreaterThanOrEqual(0); expect(m.u + m.h).toBeLessThanOrEqual(1.1); }
      for (const ch of weather([240, 30, 20], pt)) { expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(255); }
    }
  });
});
