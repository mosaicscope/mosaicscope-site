import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/rng";
import { uniqueLook } from "../src/content/appearance";
import { faceGenes, faceGeneKey, FACE_PART_COUNT, FACE_COMBINATIONS } from "../src/render/FaceGenes";
import { readFileSync } from "node:fs";

describe("procedural face genes", () => {
  it("offers 100+ part variants and a huge combination space", () => {
    expect(FACE_PART_COUNT).toBeGreaterThan(100);
    expect(FACE_COMBINATIONS).toBeGreaterThan(1e12);
  });
  it("is deterministic per seed", () => {
    expect(faceGeneKey(12345)).toBe(faceGeneKey(12345));
    expect(faceGenes(7).parts.length).toBe(14);
  });
  it("gives 2000+ distinct looks from 3000 random faces (spread across every slot)", () => {
    const r = new Rng(99), keys = new Set<string>(), used = new Set<string>(), looks = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const f = uniqueLook(r, i % 2 ? "guy" : "girl", false, looks).face!;
      keys.add(faceGeneKey(f.gene!));
      faceGenes(f.gene!).parts.forEach((p, s) => p && used.add(s + ":" + p));
    }
    expect(keys.size).toBeGreaterThan(2900);
    expect(used.size).toBeGreaterThan(100);
  });
  it("stays small: no assets, the module is under 30 KB of source", () => {
    expect(readFileSync(new URL("../src/render/FaceGenes.ts", import.meta.url)).length).toBeLessThan(30000);
  });
});
