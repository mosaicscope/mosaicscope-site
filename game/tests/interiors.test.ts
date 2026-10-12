import { describe, it, expect } from "vitest";
import { BUILDINGS, type BuildingKind } from "../src/content/buildings";
import { INTERIORS, FALLBACK, PROP_INFO, interiorFor, hasOwnInterior, type InteriorDef } from "../src/content/interiors";
import { blockedAt, reachable, findPath, moveInside } from "../src/content/interiorNav";

const kinds = Object.keys(BUILDINGS) as BuildingKind[];
const defs: [string, InteriorDef][] = [...Object.entries(INTERIORS).map(([k, d]) => [k, d!] as [string, InteriorDef]), ["fallback", FALLBACK]];

describe("interior coverage", () => {
  it("every building kind resolves to an interior (own or declared fallback) and is enterable", () => {
    for (const k of kinds) {
      expect(interiorFor(k), k).toBeTruthy();
      expect(BUILDINGS[k].enterable, k).toBe(true);
    }
  });
  it("hand-built interiors cover the Agent C kinds", () => {
    for (const k of ["hospital", "mentalhealth", "police", "bank", "office", "apartments", "house", "hotel"] as BuildingKind[]) expect(hasOwnInterior(k), k).toBe(true);
  });
  it("interior table has no keys that are not building kinds", () => {
    for (const k of Object.keys(INTERIORS)) expect(kinds).toContain(k);
  });
});

describe.each(defs)("interior %s", (name, def) => {
  const W = def.size.w, H = def.size.h;
  it("has a title, zones, props, flavour and ambience", () => {
    expect(def.title.length).toBeGreaterThan(2);
    expect(def.zones.length).toBeGreaterThan(0);
    expect(def.props.length).toBeGreaterThan(5);
    expect(def.flavour.length).toBeGreaterThanOrEqual(2);
    expect(def.flavour.length).toBeLessThanOrEqual(3);
    expect(def.ambience.length).toBeGreaterThan(0);
    expect(def.interactables.length).toBeGreaterThan(0);
  });
  it("keeps zones and props inside the floor plan", () => {
    for (const q of def.zones) { expect(q.x).toBeGreaterThanOrEqual(0); expect(q.y).toBeGreaterThanOrEqual(0); expect(q.x + q.w).toBeLessThanOrEqual(W + 1e-6); expect(q.y + q.h).toBeLessThanOrEqual(H + 1e-6); }
    for (const q of def.props) {
      const info = PROP_INFO[q.type];
      expect(info, `${name}:${q.type}`).toBeTruthy();
      expect(q.x, `${name}:${q.label ?? q.type} x`).toBeGreaterThanOrEqual(-1e-6);
      expect(q.y, `${name}:${q.label ?? q.type} y`).toBeGreaterThanOrEqual(-1e-6);
      if (info.wall) {
        const onN = q.y === 0 && q.h === 0 && q.x + q.w <= W, onW = q.x === 0 && q.w === 0 && q.y + q.h <= H;
        expect(onN || onW, `${name}: wall prop ${q.label ?? q.type} must sit on the north or west wall`).toBe(true);
      } else {
        expect(q.w, `${name}:${q.label ?? q.type}`).toBeGreaterThan(0);
        expect(q.h, `${name}:${q.label ?? q.type}`).toBeGreaterThan(0);
        expect(q.x + q.w, `${name}:${q.label ?? q.type} east edge`).toBeLessThanOrEqual(W + 1e-6);
        expect(q.y + q.h, `${name}:${q.label ?? q.type} south edge`).toBeLessThanOrEqual(H + 1e-6);
      }
    }
  });
  it("starts the player on a free tile", () => {
    expect(blockedAt(def, def.door.x, def.door.y)).toBe(false);
    expect(def.door.x).toBeLessThan(3);
  });
  it("lets the player walk from the door to every interactable (no prop blocks the path)", () => {
    for (const it of def.interactables) {
      expect(blockedAt(def, it.x, it.y), `${name}: ${it.id} stands on a prop`).toBe(false);
      expect(reachable(def, def.door, it), `${name}: ${it.id} unreachable from the door`).toBe(true);
    }
  });
  it("has an unobstructed path from the door to the exit side and into the room", () => {
    const far = { x: def.door.x + 1, y: def.door.y };
    expect(blockedAt(def, far.x, far.y)).toBe(false);
    expect(findPath(def, def.door, far)).not.toBeNull();
    // the door never gets walled in: a step west of the spawn stays free (the exit trigger band)
    expect(blockedAt(def, 0.4, def.door.y)).toBe(false);
    expect(reachable(def, def.door, { x: 0.4, y: def.door.y })).toBe(true);
  });
  it("places NPC spots inside bounds and off solid props", () => {
    expect(def.spots.length).toBeGreaterThan(3);
    expect(def.spots.some((s) => s.doing === "work")).toBe(true);
    for (const s of def.spots) { expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(W); expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(H); }
    for (const s of def.spots) if (s.doing !== "sit" && s.doing !== "lie") expect(blockedAt(def, s.x, s.y, 0.12), `${name}: spot ${s.x},${s.y} ${s.doing} is inside a prop`).toBe(false);
  });
  it("collision slides along solid props and never lets you out", () => {
    let p = { ...def.door };
    for (let i = 0; i < 400; i++) p = moveInside(def, p.x, p.y, -0.1, -0.1);
    expect(blockedAt(def, p.x, p.y)).toBe(false);
    for (let i = 0; i < 400; i++) p = moveInside(def, p.x, p.y, 0.15, 0.05);
    expect(p.x).toBeLessThanOrEqual(W); expect(blockedAt(def, p.x, p.y)).toBe(false);
  });
  it("round-trips through JSON unchanged", () => {
    expect(JSON.parse(JSON.stringify(def))).toEqual(def);
  });
});
