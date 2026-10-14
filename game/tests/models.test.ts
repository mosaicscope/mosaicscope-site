import { describe, it, expect } from "vitest";
import { MODELS, EYE_SHAPES, modelOf } from "../src/render/Models";
import type { Character } from "../src/entities/types";

const fake = (id: number, tier: Character["tier"], kind: "guy" | "girl", extra: object = {}): Character =>
  ({ id, tier, promoted: false, look: { kind, color: "#fff", accent: "#000", hat: "none", hair: "none", scale: 1 }, ...extra }) as unknown as Character;

describe("character models", () => {
  it("has 25 distinct archetypes", () => {
    expect(MODELS.length).toBe(25);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(25);
    expect(new Set(MODELS.map((m) => m.label)).size).toBe(25);
  });
  it("gives every model its own eye shape", () => {
    for (const m of MODELS) expect(EYE_SHAPES[m.id], m.id).toBeDefined();
    const shapes = MODELS.map((m) => JSON.stringify(EYE_SHAPES[m.id]));
    expect(new Set(shapes).size).toBe(MODELS.length);
  });
  it("is deterministic, gender-compatible and spreads across the cast", () => {
    const seen = new Set<string>();
    for (let id = 0; id < 600; id++) {
      const kind = id % 2 ? "girl" : "guy";
      const m = modelOf(fake(id, "mid", kind));
      expect(m).toBeDefined();
      expect(m!.kind === "any" || m!.kind === kind).toBe(true);
      expect(modelOf(fake(id, "mid", kind))).toBe(m);
      seen.add(m!.id);
    }
    expect(seen.size).toBe(25);
  });
  it("leaves principals, the player and the crowd on their own look", () => {
    expect(modelOf(fake(1, "principal", "guy"))).toBeUndefined();
    expect(modelOf(fake(2, "player", "guy"))).toBeUndefined();
    expect(modelOf(fake(3, "background", "guy"))).toBeUndefined();
    expect(modelOf(fake(4, "mid", "guy", { look: { kind: "guy", main: true, scale: 1 } }))).toBeUndefined();
  });
});
