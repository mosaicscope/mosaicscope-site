import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { rankOf, repOf, onPlayerCrime, repLine } from "../src/sim/Rep";
import { WORLD_PROMPT } from "../src/ai/llm/context";

describe("street rep", () => {
  it("ranks run from marked to made", () => {
    expect(rankOf(-60)).toBe("marked");
    expect(rankOf(-20)).toBe("unwelcome");
    expect(rankOf(0)).toBe("nobody");
    expect(rankOf(20)).toBe("known face");
    expect(rankOf(50)).toBe("associate");
    expect(rankOf(90)).toBe("made");
  });

  it("hitting a crew costs rep with them and earns it with their rival", () => {
    const sim = small(5);
    const p = sim.player;
    const victim = sim.chars.find((c) => c.crew === "famiglia");
    expect(victim).toBeTruthy();
    onPlayerCrime(sim, p, "assault", victim!, true);
    const rep = repOf(p);
    expect(rep.famiglia).toBeLessThan(0);
    expect(rep.riccarton).toBeGreaterThan(0);
  });

  it("a public crime with no crew victim builds a little cred with both", () => {
    const sim = small(5);
    onPlayerCrime(sim, sim.player, "vandalism", null, true);
    const rep = repOf(sim.player);
    expect(rep.famiglia).toBeGreaterThan(0);
    expect(rep.riccarton).toBeGreaterThan(0);
  });

  it("crew members know where the player stands, and every brain shares the story bible", () => {
    const sim = small(5);
    const member = sim.chars.find((c) => c.tier === "mid")!;
    member.crew = "riccarton";
    repOf(sim.player).riccarton = 50;
    expect(repLine(member, sim)).toMatch(/Riccarton Boys.*associate/);
    expect(WORLD_PROMPT).toMatch(/Don Vittorio/);
    expect(WORLD_PROMPT).toMatch(/Velvet Heist/);
  });
});
