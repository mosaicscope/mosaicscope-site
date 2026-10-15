import { describe, it, expect } from "vitest";
import { EXCHANGES, Director } from "../src/dialogue/director";
import { small, byName } from "./helpers";

const ROLES = "local student barista chef vendor shopkeeper cop thief graffiti cleaner dealer bouncer busker skater car_enthusiast office tourist mechanic musician photographer medic taxi driver gambler mobster smuggler comic mogul model vigilante villain skibunny zookeeper mosaic player".split(" ");
const MOODS = "happy sad angry scared tired hungry bored broke rich hurt limping sorehead armhurt hunched hitbycar wreck".split(" ");
const PLACES = "street plaza park court studio stage market playground alley casino police food shops residential office dealership hospital gallery airport".split(" ");
const VALID = new Set<string>([
  "morning", "day", "evening", "night", "late", "rain", "storm", "clear", "friends", "strangers", "rivals", "couple", "crush", "party", "wanted", "post",
  ...PLACES.map((p) => "@" + p), ...ROLES.flatMap((r) => ["a:" + r, "b:" + r]), ...MOODS.flatMap((m) => ["a:" + m, "b:" + m]),
  ...["crime", "arrest", "crash", "fight", "graffiti", "kiss", "shoot", "collapse", "casino_win", "party", "close_call"].map((e) => "after:" + e),
]);

describe("authored dialogue", () => {
  const lines = EXCHANGES.flatMap((e) => e.lines);
  it("has thousands of unique, bubble-sized lines", () => {
    expect(lines.length).toBeGreaterThanOrEqual(2000);
    const seen = new Set<string>();
    const dupes = lines.filter((l) => { const k = l.toLowerCase().trim(); if (seen.has(k)) return true; seen.add(k); return false; });
    expect(dupes).toEqual([]);
    expect(lines.filter((l) => l.replace(/\{\w+\}/g, "xxxxxxxx").length > 80)).toEqual([]);
  });
  it("uses only known tags and placeholders, with unique ids and real back-and-forths", () => {
    expect(new Set(EXCHANGES.map((e) => e.id)).size).toBe(EXCHANGES.length);
    for (const e of EXCHANGES) {
      expect(e.lines.length, e.id).toBeGreaterThanOrEqual(2);
      for (const t of e.tags) expect(VALID.has(t), `${e.id}: ${t}`).toBe(true);
      for (const l of e.lines) for (const m of l.match(/\{(\w+)\}/g) ?? []) expect(["{a}", "{b}", "{place}", "{item}", "{who}", "{handle}", "{rate}", "{post}"], `${e.id}: ${m}`).toContain(m);
    }
  });
  it("picks exchanges that fit the moment and never repeats one for the same pair", () => {
    const sim = small(4);
    const d = new Director(sim);
    const a = byName(sim, "Tiles"), b = byName(sim, "Glitter");
    const ctx = d.context(a, b);
    expect(ctx.tags.has("couple")).toBe(true);
    expect(ctx.tags.has("a:mosaic")).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const s = d.pick(a, b);
      expect(s).not.toBeNull();
      const key = s!.join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      for (const l of s!) expect(l).not.toMatch(/\{\w+\}/); // every placeholder filled
    }
  });
  it("runs NPC small talk as authored exchanges, paced by reading time", () => {
    const sim = small(4);
    const a = byName(sim, "Kodak"), b = byName(sim, "Nova");
    b.x = a.x + 1; b.y = a.y; b.goal = null; a.goal = null;
    expect(sim.dialogue.start(a, b, "chat")).toBe(true);
    const conv = [...sim.dialogue.convs.values()][0];
    expect(conv.script?.length).toBeGreaterThanOrEqual(2);
    const said: string[] = [];
    sim.bus.on("say", (e: { id: number; text: string }) => { if (e.id === a.id || e.id === b.id) said.push(e.text); });
    for (let i = 0; i < 60 * 30 && sim.dialogue.convs.size; i++) sim.step();
    // each line is the authored one, or the authored one sworn up (the town swears, see swear.ts)
    const lines = said.slice(0, conv.script!.length);
    expect(lines.length).toBe(conv.script!.length);
    lines.forEach((l, i) => expect(l === conv.script![i] || /\b(fuck\w*|shit|bloody|bugger|bastard|piss|jesus christ)\b/i.test(l), `${l} vs ${conv.script![i]}`).toBe(true));
  });
});
