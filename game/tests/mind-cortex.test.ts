import { describe, it, expect, afterEach } from "vitest";
import { small, byName, stage } from "./helpers";
import { buy, consume } from "../src/sim/Society";
import { Character, Memory } from "../src/entities/types";
import { MIND_TUNING, chooseFood, aversion, addAversion, scaldRoll, td, learnGoal, noteGamble, chaseProbability, lossLambda, prospect, socialLearn, learnPlace, welcomeReward, placePull, slotOf } from "../src/mind/Learning";
import { appraise, ocean, nameAffect, relaxAffect, performance, baseline } from "../src/mind/Affect";
import { retention, rehearse, sweepMemories, stability } from "../src/mind/Memory";
import { describeMind, goalBias, newMind, updateMind } from "../src/mind/Mind";
import { serialize, restore, parseSave, toJSON, SAVE_VERSION } from "../src/persistence/SaveSystem";
import { applyInteraction } from "../src/social/Social";

const MENU = ["flat_white", "donut", "bao", "pie"];
const TPH = 3600;
const defaults = { ...MIND_TUNING };
afterEach(() => Object.assign(MIND_TUNING, defaults));

const mem = (over: Partial<Memory> = {}): Memory => ({ t: 0, kind: "talked", subj: 5, obj: -1, toy: null, area: 0, val: 0, src: "saw", from: -1, cred: 1, ev: -1, ...over });
function person(sim = small(5), name = "Chris"): { sim: ReturnType<typeof small>; c: Character } {
  const c = byName(sim, name);
  c.goal = null; c.nextThink = 1e9; c.cash = 500;
  c.needs.energy = 0.15; c.hunger = 0.85; // a tired coffee-lover
  return { sim, c };
}
const shareOf = (sim: ReturnType<typeof small>, c: Character, def: string, n = 400) => { let k = 0; const tally: Record<string, number> = {}; for (let i = 0; i < n; i++) { const p = chooseFood(sim, c, MENU); tally[p] = (tally[p] ?? 0) + 1; if (p === def) k++; } return { share: k / n, tally }; };
/** buy + drink a flat white right now */
function drink(sim: ReturnType<typeof small>, c: Character): boolean {
  const r = buy(sim, c, "flat_white", {});
  expect(r.ok).toBe(true);
  const before = c.mind.scalds;
  consume(sim, c, r.toy!);
  return c.mind.scalds > before;
}

describe("Garcia taste aversion (scalding hot drinks)", () => {
  it("scald rolls are deterministic and only hot drinks can scald", () => {
    const { c } = person();
    expect(scaldRoll(1234, c, "flat_white")).toBe(scaldRoll(1234, c, "flat_white"));
    expect(scaldRoll(1234, c, "donut")).toBe(false);
    let hits = 0; for (let t = 0; t < 6000; t++) if (scaldRoll(t, c, "flat_white")) hits++;
    expect(hits / 6000).toBeGreaterThan(MIND_TUNING.scaldChance * 0.6);
    expect(hits / 6000).toBeLessThan(MIND_TUNING.scaldChance * 1.5);
  });

  it("a burn creates a strong aversion; the person switches to something cooler, then recovers", () => {
    const { sim, c } = person();
    const base = shareOf(sim, c, "flat_white");
    expect(base.share).toBeGreaterThan(0.1); // coffee is a real option for a tired person

    MIND_TUNING.scaldChance = 1;
    expect(drink(sim, c)).toBe(true);
    MIND_TUNING.scaldChance = 0;
    expect(aversion(c, "item:flat_white", sim.tick)).toBeGreaterThan(0.9);
    expect(aversion(c, "trait:hot_drink", sim.tick)).toBeGreaterThan(0.6);
    expect(c.emo.mood).toBeLessThan(0.4);

    const after = shareOf(sim, c, "flat_white");
    expect(after.share).toBeLessThan(base.share * 0.25);
    // the alternative they now reach for is cooler than the coffee
    const top = Object.entries(after.tally).sort((a, b) => b[1] - a[1])[0][0];
    expect(top).not.toBe("flat_white");
    expect(["donut", "bao"]).toContain(top);

    // a few game hours later the memory is fading, a day and a half later they are back to normal
    sim.tick += 6 * TPH;
    const mid = shareOf(sim, c, "flat_white").share;
    expect(mid).toBeGreaterThan(after.share);
    // time passes with the mind ticking along (aversion and the learned dislike both fade)
    for (let i = 0; i < 160; i++) { sim.tick += TPH / 4; updateMind(c, sim); c.hunger = 0.85; c.needs.energy = 0.15; }
    const healed = shareOf(sim, c, "flat_white").share;
    expect(healed).toBeGreaterThan(base.share * 0.35); // not identical: the drink is no longer novel and a faint dislike lingers
    expect(healed).toBeGreaterThan(after.share * 2.5);
  });

  it("anxious people hold the grudge longer than calm people", () => {
    const { sim, c } = person();
    const calm = person(small(5), "Kodak").c;
    c.pers.temper = 0.95; c.pers.boldness = 0.05; calm.pers.temper = 0.05; calm.pers.boldness = 0.95;
    addAversion(c, "item:flat_white", 1, sim.tick); addAversion(calm, "item:flat_white", 1, sim.tick);
    expect(aversion(c, "item:flat_white", sim.tick + 12 * TPH)).toBeGreaterThan(aversion(calm, "item:flat_white", sim.tick + 12 * TPH));
  });

  it("safe re-exposure extinguishes the aversion (Rescorla-Wagner)", () => {
    const { sim, c } = person();
    addAversion(c, "item:flat_white", 1, sim.tick);
    MIND_TUNING.scaldChance = 0;
    drink(sim, c);
    expect(aversion(c, "item:flat_white", sim.tick)).toBeLessThan(0.55);
  });

  it("the inspector explains the aversion", () => {
    const { sim, c } = person();
    MIND_TUNING.scaldChance = 1; drink(sim, c);
    const lines = describeMind(c, sim.tick);
    expect(lines.some((l) => /Avoids hot drinks/.test(l))).toBe(true);
    expect(lines.some((l) => /Burned my tongue/.test(l))).toBe(true);
  });
});

describe("value learning of places, items and goals", () => {
  it("repeated good outcomes raise a value; bad ones lower it; mood biases the learning", () => {
    const a = person().c, b = person(small(5), "Kodak").c;
    a.mind.val = 0.8; b.mind.val = -0.8;
    for (let i = 0; i < 6; i++) { td(a, "item:pie", 0.3); td(b, "item:pie", 0.3); }
    expect(a.mind.v["item:pie"]).toBeGreaterThan(0.15);
    expect(a.mind.v["item:pie"]).toBeGreaterThan(b.mind.v["item:pie"]); // happy people rate the same pie higher
    for (let i = 0; i < 10; i++) td(a, "item:pie", -0.8);
    expect(a.mind.v["item:pie"]).toBeLessThan(0);
  });

  it("a shy person gets a bigger lift from a warm welcome and starts preferring that cafe", () => {
    const sim = small(5);
    const cafe = sim.world.buildings.find((b) => b.kind === "cafe")!;
    const shy = byName(sim, "Chris"), loud = byName(sim, "Kodak"), barista = sim.chars.find((x) => x.role === "barista" && x !== shy && x !== loud) ?? byName(sim, "Ruby");
    barista.workplace = cafe.id; barista.inside = cafe.id; barista.pers.kindness = 1;
    shy.pers.sociability = 0.05; shy.pers.boldness = 0.1; loud.pers.sociability = 0.95; loud.pers.boldness = 0.95;
    const rs = welcomeReward(sim, shy, cafe.id), rl = welcomeReward(sim, loud, cafe.id);
    expect(rs).toBeGreaterThan(rl);
    expect(rs).toBeGreaterThan(0.3);
    const pull0 = placePull(shy, cafe.kind, cafe.id);
    for (let i = 0; i < 5; i++) learnPlace(sim, shy, cafe.kind, cafe.id, cafe.name, rs);
    expect(placePull(shy, cafe.kind, cafe.id)).toBeGreaterThan(pull0 + 3);
    expect(describeMind(shy).some((l) => l.includes(cafe.name))).toBe(true);
  });

  it("goal outcomes shape goal utilities", () => {
    const { c } = person();
    for (let i = 0; i < 8; i++) learnGoal(c, "play", true, 12);
    const good = goalBias(c, "play", 12);
    const d = person(small(5), "Kodak").c;
    for (let i = 0; i < 8; i++) learnGoal(d, "play", false, 12);
    expect(good).toBeGreaterThan(goalBias(d, "play", 12));
  });
});

describe("loss aversion and chasing", () => {
  const careful = (c: Character) => Object.assign(c.pers, { temper: 0.9, boldness: 0.1, honesty: 0.95, playfulness: 0.05, sociability: 0.2 });
  const reckless = (c: Character) => Object.assign(c.pers, { temper: 0.1, boldness: 0.98, honesty: 0.05, playfulness: 0.95, sociability: 0.95 });

  it("prospect theory: a loss hurts more than the same gain pleases", () => {
    const { c } = person();
    expect(-prospect(-1, lossLambda(c))).toBeGreaterThan(prospect(1, lossLambda(c)) * 1.5);
    const a = person(small(5), "Kodak").c; careful(a); reckless(c);
    expect(lossLambda(a)).toBeGreaterThan(lossLambda(c) + 0.5);
  });

  it("a careful person turns cautious after a big loss; a reckless one chases", () => {
    const sim = small(5);
    const a = byName(sim, "Chris"), b = byName(sim, "Kodak");
    careful(a); reckless(b);
    a.mind.coping = "problem";
    noteGamble(sim, a, -150, 150); noteGamble(sim, b, -150, 150);
    expect(a.mind.gamble.caution).toBeGreaterThan(0.2);
    expect(a.mind.gamble.caution).toBeGreaterThan(a.mind.gamble.urge * 2);
    expect(b.mind.gamble.urge).toBeGreaterThan(0.2);
    expect(b.mind.gamble.urge).toBeGreaterThan(b.mind.gamble.caution * 2);
    expect(chaseProbability(b, -150, 150)).toBeGreaterThan(chaseProbability(a, -150, 150) + 0.4);
    expect(goalBias(a, "gamble", 20)).toBeLessThan(1);
    expect(goalBias(b, "gamble", 20)).toBeGreaterThan(1);
    expect(describeMind(a).some((l) => /Wary of gambling/.test(l))).toBe(true);
    expect(describeMind(b).some((l) => /win it back/.test(l))).toBe(true);
    // the casino itself is now a bad place for the careful one
    expect(a.mind.v["place:casino"]).toBeLessThan(b.mind.v["place:casino"] + 0.01);
  });

  it("a win relaxes the urge", () => {
    const sim = small(5), b = byName(sim, "Kodak"); reckless(b);
    noteGamble(sim, b, -150, 150); const u = b.mind.gamble.urge;
    noteGamble(sim, b, 200, 100);
    expect(b.mind.gamble.urge).toBeLessThan(u);
  });
});

describe("Ebbinghaus memory", () => {
  it("emotional memories last far longer than neutral ones, and rehearsal helps", () => {
    const calm = mem({ val: 0 }), vivid = mem({ val: -0.9 });
    expect(stability(vivid)).toBeGreaterThan(stability(calm) * 4);
    const t = 24 * TPH;
    expect(retention(vivid, t)).toBeGreaterThan(retention(calm, t) + 0.3);
    const before = retention(calm, t); rehearse(calm, 10 * TPH); rehearse(calm, 20 * TPH);
    expect(retention(calm, t)).toBeGreaterThan(before);
  });

  it("sweeping the existing memory list forgets faded neutral memories but keeps flashbulb ones", () => {
    const { c, sim } = person();
    c.memories.length = 0;
    c.memories.push(mem({ kind: "talked", val: 0.0 }), mem({ kind: "wounded", val: -0.95 }));
    expect(sweepMemories(c, 30 * TPH)).toBe(1);
    expect(c.memories.map((m) => m.kind)).toEqual(["wounded"]);
    // and the live engine does it for detailed characters
    c.memories.push(mem({ kind: "talked", val: 0 }));
    sim.tick = 40 * TPH; c.mind.last = 0; updateMind(c, sim);
    expect(c.memories.some((m) => m.kind === "talked")).toBe(false);
  });
});

describe("core affect and appraisal", () => {
  it("OCEAN follows from the trait vector", () => {
    const { c } = person();
    Object.assign(c.pers, { curiosity: 1, playfulness: 1, sociability: 1, boldness: 1, kindness: 1, temper: 0, honesty: 1 });
    const hi = ocean(c.pers);
    expect(hi.o).toBeGreaterThan(0.9); expect(hi.e).toBeGreaterThan(0.9); expect(hi.a).toBeGreaterThan(0.9); expect(hi.n).toBeLessThan(0.1);
  });

  it("appraisal names different emotions and they tilt goal utilities", () => {
    const { sim, c } = person();
    const calm = goalBias(c, "fight", 12);
    expect(appraise(c, sim.tick, { rel: 0.8, cong: -0.8, ctrl: 0.8, blame: "other" })).toBe("angry");
    expect(goalBias(c, "fight", 12)).toBeGreaterThan(calm);
    expect(appraise(c, sim.tick, { rel: 0.8, cong: -0.8, ctrl: 0.1, blame: "other" })).toBe("afraid");
    expect(goalBias(c, "shelter", 12)).toBeGreaterThan(1);
    expect(goalBias(c, "fight", 12)).toBeLessThan(calm);
    expect(appraise(c, sim.tick, { rel: 0.8, cong: -0.6, ctrl: 0.5, blame: "self" })).toBe("ashamed");
    expect(appraise(c, sim.tick, { rel: 0.7, cong: 0.8, ctrl: 0.5, blame: "none" })).toBe("relieved"); // after a bad moment
    expect(nameAffect(0.6, 0.3)).toBe("joyful");
  });

  it("mood decays toward the personality baseline, extraverts higher than neurotics", () => {
    const a = person().c, b = person(small(5), "Kodak").c;
    Object.assign(a.pers, { sociability: 0.95, boldness: 0.9, temper: 0.1 }); Object.assign(b.pers, { sociability: 0.1, boldness: 0.1, temper: 0.9 });
    expect(baseline(a.pers).val).toBeGreaterThan(baseline(b.pers).val);
    a.mind.val = -0.9; a.emo.mood = 0; a.emo.fear = a.emo.frustration = 0; a.mind.burnout = 0;
    for (let i = 0; i < 40; i++) relaxAffect(a, 1e6, 30);
    expect(a.mind.val).toBeGreaterThan(0);
  });

  it("Yerkes-Dodson: complex tasks prefer low arousal", () => {
    expect(performance(0.3, true)).toBeGreaterThan(performance(0.9, true));
    expect(performance(0.55, false)).toBeGreaterThan(performance(0.05, false));
    expect(performance(0.55, false)).toBeGreaterThan(performance(0.55, true));
  });
});

describe("habits and chronotype", () => {
  it("successful repetition builds a time-of-day habit that pulls at the cue and not at other times", () => {
    const { c } = person();
    for (let i = 0; i < 10; i++) learnGoal(c, "busk", true, 8.5);
    expect(c.mind.habit["busk@" + slotOf(8.5, c.mind.chrono)]).toBeGreaterThan(0.5);
    const at = goalBias(c, "busk", 8.5), off = goalBias(c, "busk", 21);
    expect(at).toBeGreaterThan(off);
  });

  it("owls and larks live on shifted clocks", () => {
    expect(slotOf(9.5, 1)).not.toBe(slotOf(9.5, -1));
    const lark = newMind(1, person().c.pers); lark.chrono = -1;
    const owl = newMind(2, person().c.pers); owl.chrono = 1;
    const c = person().c; c.mind = lark; const l = goalBias(c, "gohome", 22); c.mind = owl; const o = goalBias(c, "gohome", 22);
    expect(l).toBeGreaterThan(o); // larks head home earlier
  });
});

describe("stress, coping and burnout", () => {
  it("chronically unmet needs produce burnout that suppresses work and favours rest", () => {
    const { sim, c } = person();
    c.needs.energy = c.needs.social = c.needs.fun = 0.05; c.hunger = 0.1; c.cash = 0;
    for (let i = 0; i < 400; i++) { sim.tick += 120; updateMind(c, sim); c.needs.energy = c.needs.social = c.needs.fun = 0.05; c.hunger = 0.1; }
    expect(c.mind.burnout).toBeGreaterThan(0.4);
    expect(goalBias(c, "work", 12)).toBeLessThan(goalBias(c, "rest", 12));
    expect(describeMind(c).some((l) => /Burning out/.test(l))).toBe(true);
  });
});

describe("social learning", () => {
  it("friends nudge each other's tastes; strangers do not; gossip carries aversions", () => {
    const sim = small(5);
    const a = byName(sim, "Chris"), b = byName(sim, "Kodak"), s = byName(sim, "Ruby");
    stage(sim, a, b);
    for (let i = 0; i < 6; i++) applyInteraction(a, b, "talk", true, sim.tick, 1);
    a.rel.get(b.id)!.aff = 0.9; a.rel.get(b.id)!.respect = 0.8;
    b.mind.v["item:sushi"] = 0.8; b.mind.v["place:cafe"] = 0.6; b.mind.names["place:cafe"] = "cafe";
    addAversion(b, "trait:hot_drink", 0.9, sim.tick);
    expect(socialLearn(sim, a, b)).toBeGreaterThan(0);
    expect(a.mind.v["item:sushi"]).toBeGreaterThan(0.1);
    expect(aversion(a, "trait:hot_drink", sim.tick)).toBeGreaterThan(0.1);
    expect(aversion(a, "trait:hot_drink", sim.tick)).toBeLessThan(aversion(b, "trait:hot_drink", sim.tick));
    s.rel.clear();
    expect(socialLearn(sim, s, b)).toBe(0);
    expect(s.mind.v["item:sushi"]).toBeUndefined();
  });
});

describe("engine in the live sim", () => {
  it("minds update for detailed characters, stay finite, and the run is deterministic", () => {
    const run = () => { const sim = small(9); for (let i = 0; i < 2400; i++) sim.step(); return sim; };
    const a = run(), b = run();
    const upd = a.chars.filter((c) => c.tier !== "background" && c.mind.last > 0);
    expect(upd.length).toBeGreaterThan(5);
    for (const c of a.chars) { const m = c.mind; for (const x of [m.val, m.aro, m.stress, m.burnout, ...Object.values(m.v)]) expect(Number.isFinite(x)).toBe(true); }
    expect(JSON.stringify(a.chars.map((c) => c.mind))).toBe(JSON.stringify(b.chars.map((c) => c.mind)));
  }, 15000);

  it("describeMind always returns readable lines", () => {
    const sim = small(9); for (let i = 0; i < 600; i++) sim.step();
    for (const c of sim.chars.slice(0, 20)) { const l = describeMind(c, sim.tick); expect(l.length).toBeGreaterThan(2); expect(l.every((x) => typeof x === "string" && x.length > 3)).toBe(true); }
  });
});

describe("persistence of the mind", () => {
  it("round-trips aversions, values, habits and rehearsed memories", () => {
    const { sim, c } = person();
    MIND_TUNING.scaldChance = 1; drink(sim, c);
    learnGoal(c, "busk", true, 9); c.mind.gamble.urge = 0.5;
    c.memories.push(mem({ val: -0.8 })); rehearse(c.memories[c.memories.length - 1], 777);
    const loaded = restore(parseSave(toJSON(serialize(sim))));
    const l = loaded.chars[c.id];
    expect(l.mind.av["item:flat_white"][0]).toBeCloseTo(c.mind.av["item:flat_white"][0], 2);
    expect(l.mind.habit).toEqual(c.mind.habit);
    expect(l.mind.gamble.urge).toBeCloseTo(0.5, 2);
    expect(l.mind.log).toEqual(c.mind.log);
    const m = l.memories[l.memories.length - 1];
    expect(m.rep).toBe(1); expect(m.rec).toBe(777);
    expect(aversion(l, "item:flat_white", sim.tick)).toBeCloseTo(aversion(c, "item:flat_white", sim.tick), 2);
  });

  it("migrates a v4 save (no minds) by giving everyone a fresh one", () => {
    const sim = small(5);
    const d: any = JSON.parse(toJSON(serialize(sim)));
    d.version = 4; for (const c of d.chars) delete c.mind;
    const m = parseSave(JSON.stringify(d));
    expect(m.version).toBe(SAVE_VERSION);
    const loaded = restore(m);
    expect(loaded.chars.every((c) => c.mind && typeof c.mind.val === "number")).toBe(true);
  });
});
