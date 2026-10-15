import { describe, it, expect } from "vitest";
import { interiorFor } from "../src/content/interiors";
import { placeActions, ACTIONS } from "../src/content/interiorActions";
import { blockedAt, reachable } from "../src/content/interiorNav";
import type { BuildingKind } from "../src/content/buildings";

describe("things to do inside every building", () => {
  for (const kind of Object.keys(ACTIONS) as BuildingKind[]) {
    it(`${kind}: actions stand on free floor, reachable from the door, apart from each other`, () => {
      const base = interiorFor(kind), def = placeActions(base);
      const added = def.interactables.slice(base.interactables.length);
      expect(added.length, kind).toBeGreaterThan(0);
      for (const it of added) {
        expect(blockedAt(def, it.x, it.y), `${kind}:${it.id}`).toBe(false);
        expect(reachable(def, def.door, it), `${kind}:${it.id}`).toBe(true);
        for (const o of def.interactables) if (o !== it) expect(Math.hypot(o.x - it.x, o.y - it.y), `${kind}:${it.id} vs ${o.id}`).toBeGreaterThan(1.4);
      }
      expect(new Set(def.interactables.map((i) => i.id)).size).toBe(def.interactables.length);
    });
  }
  it("the gym has a workout, the club a dance floor, the barber a haircut", () => {
    const has = (k: BuildingKind, e: string) => placeActions(interiorFor(k)).interactables.some((i) => i.effect === e);
    expect(has("gym", "workout")).toBe(true); expect(has("nightclub", "dance")).toBe(true); expect(has("barber", "wash")).toBe(true); expect(has("records", "music")).toBe(true);
  });
});
