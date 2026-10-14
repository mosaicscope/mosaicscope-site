import { describe, it, expect } from "vitest";
import { BUILDINGS, type BuildingKind } from "../src/content/buildings";
import { interiorFor, PROP_INFO } from "../src/content/interiors";
import { vary, interiorForBuilding } from "../src/content/interiorVariety";
import { applyEffect } from "../src/content/interiorEffects";
import { reachable, blockedAt } from "../src/content/interiorNav";

const kinds = Object.keys(BUILDINGS) as BuildingKind[];

describe("per-building interiors", () => {
  it("keeps every counter, spot and new interactable reachable, and props in bounds", () => {
    for (const kind of kinds) for (let id = 0; id < 12; id++) {
      const base = interiorFor(kind), d = vary(base, { id, kind, name: `${kind} ${id}` });
      for (const pt of [...base.interactables, ...base.spots]) if (reachable(base, base.door, pt)) expect(reachable(d, d.door, pt), `${kind}#${id} ${JSON.stringify(pt)}`).toBe(true);
      for (const it of d.interactables.filter((i) => i.id.startsWith("auto") || i.id === "shift")) {
        expect(blockedAt(d, it.x, it.y), `${kind}#${id} ${it.label}`).toBe(false);
        expect(reachable(d, d.door, it), `${kind}#${id} ${it.label}`).toBe(true);
      }
      for (const q of d.props) if (!PROP_INFO[q.type].wall) { expect(q.x + q.w).toBeLessThanOrEqual(d.size.w + 1e-6); expect(q.y + q.h).toBeLessThanOrEqual(d.size.h + 1e-6); }
    }
  });
  it("no two buildings of a kind look the same, and a building is stable between visits", () => {
    for (const kind of kinds) {
      const sigs = new Set<string>();
      for (let id = 0; id < 8; id++) { const d = vary(interiorFor(kind), { id, kind, name: "X" }); sigs.add(JSON.stringify([d.zones, d.props])); }
      expect(sigs.size, kind).toBe(8);
      const b = { id: 3, kind, name: "Y" };
      expect(interiorForBuilding(b)).toBe(interiorForBuilding(b));
    }
  });
  it("wires furniture to needs somewhere in town", () => {
    const effects = new Set<string>();
    for (const kind of kinds) for (let id = 0; id < 6; id++) for (const i of vary(interiorFor(kind), { id, kind, name: "Z" }).interactables) if (i.effect) effects.add(i.effect);
    for (const e of ["eat", "rest", "sit", "play", "browse", "work", "read"]) expect(effects.has(e), e).toBe(true);
  });
});

describe("interior effects", () => {
  const body = () => ({ cash: 10, hunger: 0.2, needs: { energy: 0.5, social: 0.5, fun: 0.5, curiosity: 0.5 }, emo: { fear: 0, frustration: 0, confidence: 0.5, mood: -0.5, composure: 1 }, bleed: 0, reputation: 0 });
  it("eating costs money and feeds you; mood can stay negative", () => {
    const p = body(); const r = applyEffect("eat", p as never, { wage: 25, worksHere: false, cost: 4 });
    expect(r.ok).toBe(true); expect(p.cash).toBe(6); expect(p.hunger).toBeCloseTo(0.55); expect(p.emo.mood).toBeCloseTo(-0.45);
  });
  it("refuses when broke and pays for shifts, more at your own workplace", () => {
    const p = body(); p.cash = 1;
    expect(applyEffect("play", p as never, { wage: 25, worksHere: false, cost: 2 }).ok).toBe(false); expect(p.cash).toBe(1);
    applyEffect("work", p as never, { wage: 24, worksHere: true }); expect(p.cash).toBe(31);
  });
});
