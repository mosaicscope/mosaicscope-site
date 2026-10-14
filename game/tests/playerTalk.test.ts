import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { cleanChatLine } from "../src/ai/llm";

const open = (name: string) => {
  const sim = small(), npc = byName(sim, name), p = sim.player;
  p.x = npc.x + 1; p.y = npc.y; npc.talkWith = -1; npc.goal = null;
  return { sim, npc, p };
};

describe("what you can say depends on the moment", () => {
  it("never offers more than five things plus a way out", () => {
    const { sim, npc } = open("Nova");
    const r = sim.dialogue.playerOpen(npc);
    expect(r.options.length).toBeLessThanOrEqual(6);
    expect(r.options[r.options.length - 1].id).toBe("bye");
  });
  it("a scared person gets asked if they're ok; a stranger gets an introduction", () => {
    const { sim, npc, p } = open("Lux");
    npc.rel.delete(p.id);
    npc.emo.fear = 0.9;
    const ids = sim.dialogue.playerOpen(npc).options.map((o) => o.id);
    expect(ids).toContain("t_ok");
    expect(ids).toContain("t_intro");
  });
  it("someone who can't stand you gets the beef question", () => {
    const { sim, npc, p } = open("Flash");
    const r = sim.relate(npc, p.id); r.grudge = 0.9; r.rivalry = 0.9; r.aff = -0.6; r.fam = 0.5;
    expect(sim.dialogue.playerOpen(npc).options.map((o) => o.id)).toContain("t_beef");
  });
  it("what they're doing shapes the options", () => {
    const { sim, npc } = open("Grain");
    npc.goal = { id: "eat" } as typeof npc.goal;
    expect(sim.dialogue.playerOpen(npc).options.map((o) => o.id)).toContain("t_eat");
  });
  it("asking moves the conversation on: follow-ups appear and the same question isn't offered twice", () => {
    const { sim, npc, p } = open("Ruby");
    npc.rel.delete(p.id);
    sim.dialogue.playerOpen(npc);
    const r = sim.dialogue.playerChoose(npc, "t_intro");
    const ids = r.options.map((o) => o.id);
    expect(ids).not.toContain("t_intro");
    expect(ids.some((id) => id === "t_tips" || id === "t_where_eat")).toBe(true);
    expect(r.text.length).toBeGreaterThan(3);
  });
});

describe("typed chat", () => {
  it("builds a persona from real state", () => {
    const { sim, npc } = open("Kodak");
    npc.emo.fear = 0.9;
    const s = sim.dialogue.persona(npc);
    expect(s).toContain("You are Kodak");
    expect(s).toMatch(/scared/);
  });
  it("insults typed at someone cost you with them", () => {
    const { sim, npc, p } = open("Nova");
    const before = npc.memories.length;
    sim.dialogue.playerOpen(npc);
    sim.dialogue.playerTyped(npc, "you're an idiot");
    expect(npc.memories.length).toBeGreaterThan(before);
    expect(npc.memories.some((m) => m.kind === "insulted_by" && m.subj === p.id)).toBe(true);
  });
  it("cleans model replies into one spoken line", () => {
    expect(cleanChatLine('Kodak: "Yeah nah, mate."', "Kodak")).toBe("Yeah nah, mate.");
    expect(cleanChatLine("<think>hmm</think>*shrugs* Sweet as.\nMore text", "Kodak")).toBe("Sweet as.");
    expect(cleanChatLine("   ", "Kodak")).toBeNull();
    expect(cleanChatLine("a ".repeat(300), "Kodak")!.length).toBeLessThanOrEqual(221);
  });
});
