import { describe, it, expect } from "vitest";
import { faceGenes } from "../src/render/FaceGenes";

describe("not everyone smokes", () => {
  it("only a rare face gets a cigarette, and nothing else that reads as smoking", () => {
    let cig = 0, lookalike = 0;
    const N = 6000;
    for (let seed = 1; seed <= N; seed++) {
      const m = faceGenes(seed * 7919).parts[8];
      if (m === 10) cig++;
      if (m === 5 || m === 6 || m === 8) lookalike++;
    }
    expect(lookalike).toBe(0);
    expect(cig / N).toBeLessThan(0.01);
  });
});
