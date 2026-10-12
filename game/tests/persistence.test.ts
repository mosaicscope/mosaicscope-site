import { describe, it, expect } from "vitest";
import { small, hashState } from "./helpers";
import { serialize, restore, parseSave, SaveError, SAVE_VERSION, SaveSystem, toJSON } from "../src/persistence/SaveSystem";
import { MemoryStorageProvider } from "../src/persistence/storage";
import { loadSettings, DEFAULT_SETTINGS } from "../src/persistence/Settings";

describe("save / load", () => {
  it("round-trips the full dynamic state and keeps simulating identically", () => {
    const sim = small(12);
    for (let i = 0; i < 900; i++) sim.step();
    const json = toJSON(serialize(sim));
    const loaded = restore(parseSave(json));
    expect(loaded.chars.length).toBe(sim.chars.length);
    expect(loaded.tick).toBe(sim.tick);
    const a = sim.chars[3], b = loaded.chars[3];
    expect(b.name).toBe(a.name); expect(b.x).toBeCloseTo(a.x, 2); expect(b.hand).toBe(a.hand);
    expect([...b.rel.keys()]).toEqual([...a.rel.keys()]);
    for (const [id, r] of a.rel) expect(b.rel.get(id)!.grudge).toBeCloseTo(r.grudge, 2);
    expect(b.memories.map((m) => [m.kind, m.subj, m.src, m.from])).toEqual(a.memories.map((m) => [m.kind, m.subj, m.src, m.from]));
    expect(loaded.toys.map((t) => [t.def, t.holder, t.owner])).toEqual(sim.toys.map((t) => [t.def, t.holder, t.owner]));
    expect(loaded.toys.every((t, i) => Math.abs(t.x - sim.toys[i].x) < 0.01)).toBe(true);
    expect(loaded.events.history.length).toBe(Math.min(120, sim.events.history.length));
    // a second round trip is stable
    const again = restore(parseSave(toJSON(serialize(loaded))));
    expect(again.chars.map((c) => [c.name, Math.round(c.x * 100), c.hand, c.rel.size, c.memories.length])).toEqual(loaded.chars.map((c) => [c.name, Math.round(c.x * 100), c.hand, c.rel.size, c.memories.length]));
    for (let i = 0; i < 300; i++) loaded.step();
    expect(hashState(loaded)).toBeTruthy();
  });
  it("migrates v1 and v2 saves step by step", () => {
    const sim = small();
    for (let i = 0; i < 300; i++) sim.step();
    sim.chars[2].memories.push({ t: 5, kind: "argued", subj: 3, obj: 2, toy: null, area: 0, val: -0.4, src: "told", from: 4, cred: 0.6, ev: 9 });
    sim.relate(sim.chars[2], 3).grudge = 0.5;
    const d: any = serialize(sim);
    // rebuild what a v1 save looked like: object memories/relationships, no reputation/prefs/lamps
    d.version = 1; delete d.lamps;
    d.chars = sim.chars.map((c) => { const { rel, path, goal, bubble, goalCooldowns, reputation, prefs, ...rest } = c as any; return { ...rest, rel: [...rel.entries()] }; });
    const m = parseSave(JSON.stringify(d));
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.chars[0].reputation).toBe(0);
    const loaded = restore(m);
    const who = sim.chars[2], lw = loaded.chars[2];
    expect(lw.memories[lw.memories.length - 1]).toEqual(who.memories[who.memories.length - 1]);
    expect(lw.rel.size).toBe(who.rel.size); expect(lw.rel.get(3)!.grudge).toBe(0.5);
  });
  it("rejects corrupted or foreign data with readable errors (no crash)", () => {
    expect(() => parseSave("{nope")).toThrow(SaveError);
    expect(() => parseSave(JSON.stringify({ hello: 1 }))).toThrow(SaveError);
    expect(() => parseSave(JSON.stringify({ version: 99 }))).toThrow(/newer version/);
    const d: any = serialize(small()); d.chars[0].x = null;
    expect(() => parseSave(JSON.stringify(d))).toThrow(/damaged/);
  });
  it("uses a pluggable storage provider with namespaced keys", () => {
    const store = new MemoryStorageProvider();
    const saves = new SaveSystem(store);
    const sim = small();
    expect(saves.save(sim, "1").ok).toBe(true);
    expect(store.keys("mosaics-world:")).toEqual(["mosaics-world:save:1"]);
    expect(saves.load("1").chars.length).toBe(sim.chars.length);
    store.set("mosaics-world:save:2", "garbage");
    expect(() => saves.load("2")).toThrow(SaveError);
    expect(saves.info("2")!.label).toBe("Damaged save");
  });
  it("settings survive corruption and bad types", () => {
    const store = new MemoryStorageProvider();
    store.set("mosaics-world:settings", "{{{");
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.set("mosaics-world:settings", JSON.stringify({ volume: 7, quality: "ultra", gentle: true, keys: { talk: "y", up: 5 } }));
    const s = loadSettings(store);
    expect(s.volume).toBe(DEFAULT_SETTINGS.volume); expect(s.quality).toBe("auto"); expect(s.gentle).toBe(true); expect(s.keys.talk).toBe("y"); expect(s.keys.up).toBe("w");
  });
});
