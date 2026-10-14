import { describe, it, expect } from "vitest";
import { buzz, buzzOpener } from "../src/content/buzz";
import { small, byName } from "./helpers";

describe("town buzz", () => {
  it("passes a headline on as hearsay, never naming where it came from", () => {
    const a = buzzOpener("Bus fares going up in March", () => 0), q = buzzOpener("Best pie in town?", () => 1);
    expect(a).toBe("Apparently bus fares going up in March.");
    expect(q).toBe("Random, but. Best pie in town?");
    for (const s of [a, q]) expect(s.toLowerCase()).not.toMatch(/reddit|r\/|online|post/);
    expect(buzzOpener("Christchurch gets a new pool", () => 2)).toBe("Heard Christchurch gets a new pool.");
  });

  it("townspeople bring it up in small talk now and then", () => {
    buzz.push({ title: "Bus fares going up in March", sub: "chch", score: 100 });
    try {
      const sim = small(4), a = byName(sim, "Tiles"), b = byName(sim, "Glitter");
      const said: string[] = [];
      const say = sim.say.bind(sim);
      sim.say = (c, text, kind, secs) => { said.push(text); say(c, text, kind, secs); };
      for (let i = 0; i < 300 && !said.some((t) => t.includes("bus fares")); i++) {
        a.talkWith = b.talkWith = -1; a.x = b.x + 1; a.y = b.y;
        sim.dialogue.start(a, b, "chat");
        for (let k = 0; k < 900; k++) sim.dialogue.update(), sim.tick++;
      }
      expect(said.some((t) => t.includes("bus fares"))).toBe(true);
    } finally { buzz.length = 0; }
  });
});
