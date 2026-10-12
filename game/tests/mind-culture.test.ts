import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { Simulation } from "../src/sim/Simulation";
import { Director } from "../src/dialogue/director";
import {
  HOFSTEDE_NZ, OCEAN_NZ, deriveProfile, oceanOf, culturalize, alertness, shiftRoutine, toneOfExchange, cultureWeight, getProfile, SUBCULTURES, regionalise,
} from "../src/mind/Culture";
import { climateAt, dressFor, describeDress, dressOf, updateDress, weatherTalk, hardiness } from "../src/mind/Dress";
import { jaywalkProbability, queueCutProbability, tipFraction, famigliaReaction, copDeference, townOf, updateTown, profile, calloutLine } from "../src/mind/Town";
import type { Role } from "../src/content/names";
import type { Personality } from "../src/entities/types";
import { Rng } from "../src/core/rng";

const roles = (r: Role, n: number, area = "street") => Array.from({ length: n }, (_, i) => deriveProfile(7, i, r, area));
const big = (seed: number) => new Simulation({ seed, midCount: 100, backgroundCount: 40 });
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const fakeChar = (role: Role, name = "X") => ({ name, role, look: { kind: "guy", color: "#fff", accent: "#f00", hat: "none", hair: "none", scale: 1 }, pers: {} }) as never;

describe("regional culture profile", () => {
  it("carries the published NZ Hofstede scores and Big Five prior", () => {
    expect(HOFSTEDE_NZ).toEqual({ pdi: 22, idv: 79, mas: 58, uai: 49, lto: 33, ivr: 75 });
    expect(OCEAN_NZ.O).toBeGreaterThan(0.5); expect(OCEAN_NZ.N).toBeLessThan(0.5);
  });
  it("is deterministic and independent of the sim rng", () => {
    expect(deriveProfile(5, 12, "barista", "food")).toEqual(deriveProfile(5, 12, "barista", "food"));
    expect(deriveProfile(5, 12, "barista", "food")).not.toEqual(deriveProfile(5, 13, "barista", "food"));
  });
  it("sub-cultures and cohorts differ the way the literature says (skew, not stereotype)", () => {
    const stu = roles("student", 150), ret = deriveProfile(1, 1, "local", "residential");
    expect(stu.filter((p) => p.sub === "student").length).toBeGreaterThan(110);
    expect(mean(stu.filter((p) => p.sub === "student").map((p) => p.age))).toBeLessThan(26);
    // students: more owls than larks; retirees/older: more larks
    expect(stu.filter((p) => p.chrono === "owl").length).toBeGreaterThan(stu.filter((p) => p.chrono === "lark").length);
    const olds = Array.from({ length: 300 }, (_, i) => deriveProfile(3, i, "local", "residential")).filter((p) => p.cohort === "older");
    expect(olds.filter((p) => p.chrono === "lark").length).toBeGreaterThan(olds.filter((p) => p.chrono === "owl").length);
    // maturity principle: older people are more conscientious/agreeable and less neurotic than students
    const o = mean(olds.map((p) => p.ocean.C)), s = mean(stu.map((p) => p.ocean.C));
    expect(o).toBeGreaterThan(s);
    expect(mean(olds.map((p) => p.ocean.N))).toBeLessThan(mean(stu.map((p) => p.ocean.N)));
    expect(ret.norms.modesty).toBeGreaterThan(0.5);
  });
  it("maps district/role to sub-cultures: port, surf, CBD, tourist", () => {
    expect(roles("office", 30).every((p) => ["cbd", "local", "retiree", "student", "trades", "hospo", "surf", "port", "creative", "outdoors"].includes(p.sub))).toBe(true);
    expect(roles("office", 100).filter((p) => p.sub === "cbd").length).toBeGreaterThan(70);
    expect(roles("tourist", 20).every((p) => p.sub === "visitor" && !p.local)).toBe(true);
    const surf = Array.from({ length: 200 }, (_, i) => deriveProfile(9, i, "local", "playground")).filter((p) => p.sub === "surf");
    expect(surf.length).toBeGreaterThan(40);
    expect(mean(surf.map((p) => p.ocean.N))).toBeLessThan(OCEAN_NZ.N); // laid-back
    expect(SUBCULTURES.port.where).toMatch(/Lyttelton/);
  });
  it("skews a rolled personality towards the culture without erasing individuality", () => {
    const rng = new Rng(11);
    const roll = (): Personality => ({ boldness: 0.5 + rng.gauss() * 0.22, kindness: 0.5 + rng.gauss() * 0.22, temper: 0.5 + rng.gauss() * 0.22, sociability: 0.5 + rng.gauss() * 0.22, curiosity: 0.5 + rng.gauss() * 0.22, playfulness: 0.5 + rng.gauss() * 0.22, honesty: 0.5 + rng.gauss() * 0.22 });
    const raw = Array.from({ length: 400 }, roll), prof = deriveProfile(1, 1, "local", "residential");
    const out = raw.map((p) => culturalize({ ...p }, prof));
    expect(mean(out.map((p) => oceanOf(p).A))).toBeGreaterThan(mean(raw.map((p) => oceanOf(p).A))); // NZ + older agreeable
    expect(mean(out.map((p) => oceanOf(p).N))).toBeLessThan(mean(raw.map((p) => oceanOf(p).N)));
    const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
    expect(sd(out.map((p) => p.sociability))).toBeGreaterThan(0.12); // variance survives
    for (const p of out) for (const v of Object.values(p)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it("circadian alertness follows chronotype; routines shift for larks and owls", () => {
    const lark = { ...deriveProfile(1, 1, "local", "park"), phase: -2 }, owl = { ...lark, phase: 2.5 };
    expect(alertness(lark, 7)).toBeGreaterThan(alertness(owl, 7));
    expect(alertness(owl, 22)).toBeGreaterThan(alertness(lark, 22));
    const r: [number, string][] = [[7, "a"], [12, "b"], [22, "c"]];
    const L = shiftRoutine(r, lark), O = shiftRoutine(r, owl);
    expect(L[0][0]).toBeLessThan(O[0][0]);
    for (const x of [L, O]) for (let i = 1; i < x.length; i++) expect(x[i][0]).toBeGreaterThan(x[i - 1][0]);
  });
});

describe("dress by weather, season, role", () => {
  const prof = (role: Role, area = "street", id = 3) => deriveProfile(2, id, role, area);
  // a deterministic winter day with no nor'wester/southerly flukes: scan for one
  const day = (month: number, pred: (c: ReturnType<typeof climateAt>) => boolean, hour: number, w: "clear" | "rain" | "cloudy" | "storm") => {
    const base = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][month];
    for (let d = base; d < base + 28; d++) { const c = climateAt(2, d, hour, w); if (pred(c)) return c; }
    throw new Error("no day");
  };
  const plain = (c: ReturnType<typeof climateAt>) => !c.nor_wester && !c.southerly;
  it("puts on more layers and a beanie in a cold winter night than on a hot summer day", () => {
    const cold = day(6, plain, 23, "clear"), hot = day(0, plain, 15, "clear");
    expect(cold.tempC).toBeLessThan(hot.tempC - 8);
    const p = { ...prof("local", "residential"), cohort: "adult" as const };
    const c = fakeChar("local");
    const dc = dressFor(c, p, cold), dh = dressFor(c, p, hot);
    expect(dc.layers).toBeGreaterThan(dh.layers);
    expect(dc.hat).toBe("beanie"); expect(dc.scarf).toBe(true);
    expect(dh.top).toMatch(/tee|shirt/); expect(dh.legs).toBe("shorts");
  });
  it("wears jandals and shorts in the heat, a rain jacket with the hood up in rain", () => {
    const hot = day(0, plain, 15, "clear");
    const p = { ...prof("student", "plaza"), cohort: "youth" as const, sub: "student" as const };
    const d = dressFor(fakeChar("student"), p, hot);
    expect(d.legs).toBe("shorts"); expect(d.feet).toBe("jandals");
    const wet = day(8, (c) => plain(c), 9, "rain");
    const dr = dressFor(fakeChar("student"), { ...p, quirk: [0.9, 0.9, 0.5, 0.5] }, wet);
    expect(["raincoat", "puffer"]).toContain(dr.top);
    expect(dr.hood).toBe(true); expect(dr.hat).toBe("hood");
  });
  it("slip-slop-slap: sun hats in summer, none in winter", () => {
    const sum = day(0, (c) => plain(c) && c.sun > 0.8, 13, "clear"), win = day(6, plain, 13, "clear");
    const p = { ...prof("local"), cohort: "older" as const, quirk: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number] };
    expect(dressFor(fakeChar("local"), p, sum).hat).toBe("bucket");
    expect(dressFor(fakeChar("local"), p, win).hat).not.toBe("bucket");
  });
  it("uniforms win over weather and signature characters keep their look", () => {
    const hot = day(0, plain, 15, "clear");
    expect(dressFor(fakeChar("cop"), prof("cop"), hot).hat).toBe("police");
    expect(dressFor(fakeChar("medic"), prof("medic"), hot).top).toBe("hivis");
    expect(dressFor(fakeChar("local", "Vito Tessera"), prof("mobster"), hot)).toMatchObject({ hat: "beret", top: "suit" });
    expect(dressFor(fakeChar("local", "Chris"), prof("photographer"), hot).hat).toBe("beanie");
  });
  it("tolerates cold differently: surfers and the young wear shorts when others don't", () => {
    const winter = day(6, plain, 13, "clear");
    const surf = { ...prof("local", "playground"), sub: "surf" as const, cohort: "youth" as const };
    const old = { ...prof("local"), sub: "retiree" as const, cohort: "older" as const };
    expect(hardiness(surf, "local")).toBeGreaterThan(hardiness(old, "local") + 6);
    expect(dressFor(fakeChar("local"), surf, winter).legs).toBe("shorts");
    expect(dressFor(fakeChar("local"), old, winter).legs).toBe("long");
  });
  it("has hysteresis (no flicker around a threshold) and describes the outfit", () => {
    const base = day(4, plain, 12, "cloudy");
    const p = prof("local");
    const d0 = dressFor(fakeChar("local"), p, base);
    const d1 = dressFor(fakeChar("local"), p, { ...base, tempC: base.tempC + 0.4 }, d0);
    expect(d1.layers).toBe(d0.layers);
    expect(describeDress(d0).length).toBeGreaterThan(3);
  });
  it("models a Christchurch climate: warm summers, cold winters, nor'wester foehn days, weather talk", () => {
    const jan = climateAt(1, 20, 15, "clear"), jul = climateAt(1, 200, 3, "clear");
    expect(jan.tempC).toBeGreaterThan(jul.tempC + 10);
    let nw = 0; for (let d = 0; d < 365; d++) if (climateAt(1, d, 14, "clear").nor_wester) nw++;
    expect(nw).toBeGreaterThan(20); expect(nw).toBeLessThan(110);
    const w = Array.from({ length: 365 }, (_, d) => climateAt(1, d, 14, "clear")).find((c) => c.nor_wester)!;
    expect(weatherTalk(w)).toMatch(/nor'wester/);
  });
  it("dresses the spawned town: everyone has an outfit, wet weather brings out coats", () => {
    const sim = small(5);
    for (const c of sim.chars) expect(dressOf(c), c.name).toBeDefined();
    const rainy = (s: Simulation) => { s.env.weather = "rain"; s.env.raining = true; s.env.rain = 0.6; updateDress(s, true); return s.chars.filter((c) => { const d = dressOf(c)!; return d.top === "raincoat" || d.hood || d.top === "puffer"; }).length; };
    sim.env.weather = "clear"; sim.env.raining = false; sim.env.rain = 0; updateDress(sim, true);
    const dry = sim.chars.filter((c) => { const d = dressOf(c)!; return d.top === "raincoat" || d.hood; }).length;
    expect(rainy(sim)).toBeGreaterThan(dry);
  });
});

describe("spawned people carry a culture", () => {
  it("everyone has a profile consistent with their traits, the Mosaics keep authored traits", () => {
    const sim = small(9);
    for (const c of sim.chars) expect(getProfile(c), c.name).toBeDefined();
    const tourists = sim.chars.filter((c) => c.role === "tourist");
    expect(tourists.length).toBeGreaterThan(0);
    for (const t of tourists) expect(getProfile(t)!.local).toBe(false);
    for (const c of sim.chars) { const o = oceanOf(c.pers); for (const v of Object.values(o)) expect(v).toBeGreaterThanOrEqual(0); }
    expect(byName(sim, "Kodak").pers.boldness).toBeGreaterThan(0); // authored principal untouched by skew
  });
  it("is reproducible from the seed", () => {
    const a = small(21), b = small(21);
    expect(a.chars.map((c) => JSON.stringify(getProfile(c)))).toEqual(b.chars.map((c) => JSON.stringify(getProfile(c))));
    expect(a.chars.map((c) => JSON.stringify(dressOf(c)))).toEqual(b.chars.map((c) => JSON.stringify(dressOf(c))));
  });
});

describe("town norms", () => {
  const local = deriveProfile(1, 1, "office", "office"), tourist = deriveProfile(1, 2, "tourist", "plaza");
  it("locals jaywalk on an empty road and not into cars; queue and don't tip; tourists differ", () => {
    expect(jaywalkProbability(local, false)).toBeGreaterThan(0.3);
    expect(jaywalkProbability(local, true)).toBeLessThan(0.05);
    expect(queueCutProbability(local)).toBeLessThan(queueCutProbability(tourist) / 3);
    const tips = (p: typeof local) => Array.from({ length: 200 }, (_, i) => tipFraction(p, i / 200)).filter((x) => x > 0).length;
    expect(tips(tourist)).toBeGreaterThan(tips(local) * 3);
  });
  it("is civil but not servile to police (low power distance); Famiglia scares the timid and amuses the dry", () => {
    const cd = copDeference(local);
    expect(cd.civility).toBeGreaterThan(0.6); expect(cd.servility).toBeLessThan(0.3);
    const timid = { ...deriveProfile(1, 5, "local", "residential"), cohort: "older" as const };
    const wit = { ...deriveProfile(1, 6, "student", "plaza"), cohort: "youth" as const };
    const a = famigliaReaction(timid, "local", 0.2), b = famigliaReaction(wit, "student", 0.8);
    expect(a.fear).toBeGreaterThan(b.fear); expect(b.mock).toBeGreaterThan(a.mock);
    expect(famigliaReaction(timid, "shopkeeper", 0.5).pay).toBeGreaterThan(0.5);
  });
  it("callouts are gentle and register-matched", () => {
    const rng = new Rng(1), pick = <T>(a: readonly T[]) => rng.pick(a);
    const dry = { ...local, register: { ...local.register, banter: 0.9 } }, pol = { ...local, register: { ...local.register, banter: 0.1, formality: 0.9 } };
    expect(calloutLine("queue", dry, pick).length).toBeGreaterThan(5);
    expect(calloutLine("queue", pol, pick)).toMatch(/Sorry|Excuse/);
  });
  it("tourists break local norms and get gently called out; they acculturate", () => {
    const sim = big(13);
    const tour = sim.chars.find((c) => c.role === "tourist")!;
    const shop = sim.chars.find((c) => c.role === "barista")!;
    const others = sim.chars.filter((c) => c.tier !== "player" && c !== tour && c !== shop && c.role !== "tourist").slice(0, 5);
    const place = (c: typeof tour, x: number, y: number) => { c.x = c.px = x; c.y = c.py = y; c.vx = c.vy = 0; c.goal = null; c.nextThink = 1e9; c.inside = -1; c.inCar = -1; c.talkWith = -1; c.bubble = null; c.lod = 0; };
    const plaza = sim.world.areas.find((a) => a.kind === "plaza")!;
    const x = plaza.x0 + 3, y = plaza.y0 + 3;
    place(tour, x, y); place(shop, x + 1.5, y);
    others.forEach((o, i) => place(o, x + 1 + (i % 3), y + 1 + Math.floor(i / 3)));
    sim.rebuildHash();
    const prof = profile(sim, tour); const before = prof.adherence;
    tour.cash = 100;
    for (let i = 0; i < 4000 && !townOf(sim).log.some((e) => e.offender === tour.id && e.other >= 0 && e.line !== "" && prof.adherence > before); i++) { sim.tick += 60; tour.bubble = null; tour.talkWith = -1; townOf(sim).cooldown.clear(); updateTown(sim); for (const c of [tour, shop, ...others]) { c.x = c.px; c.vx = 0; } }
    const st = townOf(sim);
    expect(st.stats.violations).toBeGreaterThan(0);
    expect(st.stats.callouts).toBeGreaterThan(0);
    expect(prof.adherence).toBeGreaterThan(before);
    expect(st.log.some((e) => e.offender === tour.id && e.line.length > 3)).toBe(true);
  });
  it("locals greet strangers on a quiet street, and help someone who has fallen over", () => {
    const sim = small(17);
    const [a, b, c] = sim.chars.filter((x) => x.tier === "mid" && x.role !== "tourist" && x.role !== "cop" && x.role !== "mobster");
    const park = sim.world.areas.find((x) => x.kind === "park")!;
    const spot = (ch: typeof a, x: number, y: number) => { ch.x = ch.px = x; ch.y = ch.py = y; ch.vx = ch.vy = 0; ch.goal = null; ch.nextThink = 1e9; ch.inside = -1; ch.inCar = -1; ch.talkWith = -1; ch.bubble = null; ch.lod = 0; };
    spot(a, park.cx, park.cy); spot(b, park.cx + 1.5, park.cy); spot(c, park.cx + 40, park.cy + 40);
    sim.rebuildHash();
    for (const k of [a, b]) { k.pers.sociability = 1; getProfile(k)!.ocean.E = 0.9; getProfile(k)!.norms.greetStrangers = 0.9; }
    const st = townOf(sim);
    for (let i = 0; i < 400 && st.stats.greetings < 1; i++) { sim.tick += 60; a.bubble = b.bubble = null; st.lastGreet.clear(); updateTown(sim); }
    expect(st.stats.greetings).toBeGreaterThan(0);
    b.phys = 2; a.pers.kindness = 1; sim.rebuildHash();
    for (let i = 0; i < 400 && st.stats.helps < 1; i++) { sim.tick += 60; a.bubble = null; updateTown(sim); }
    expect(st.stats.helps).toBeGreaterThan(0);
  });
});

describe("culture-sensitive dialogue", () => {
  it("scores tone from wording", () => {
    const loud = toneOfExchange(["WOW, that is the BEST thing ever!", "I am the greatest, obviously!"], []);
    const dry = toneOfExchange(["Not bad, eh.", "Yeah nah, could be worse."], []);
    expect(loud.loud).toBeGreaterThan(dry.loud); expect(loud.boast).toBeGreaterThan(0);
    expect(dry.dry).toBeGreaterThan(loud.dry);
  });
  it("restrained Kiwis avoid boasting and love understatement; slangy youth like slang; formal elders like politeness", () => {
    const restrained = { ...deriveProfile(1, 1, "local", "residential"), register: { formality: 0.5, warmth: 0.5, restraint: 0.95, slang: 0.5, banter: 0.5, deference: 0.2 } };
    const brash = { ...restrained, register: { ...restrained.register, restraint: 0.05 } };
    const boasty = toneOfExchange(["I am the best, obviously!", "WOW, legend!"], []), understated = toneOfExchange(["Not bad.", "Fair enough, a bit of a wind."], []);
    expect(cultureWeight(restrained, boasty)).toBeLessThan(cultureWeight(brash, boasty));
    expect(cultureWeight(restrained, understated)).toBeGreaterThan(cultureWeight(brash, understated));
    const youth = { ...restrained, register: { ...restrained.register, slang: 0.95, formality: 0.1 } }, elder = { ...restrained, register: { ...restrained.register, slang: 0.1, formality: 0.9 } };
    const slangy = toneOfExchange(["Sweet as, bro.", "Heaps good, mate, chur."], []), polite = toneOfExchange(["Excuse me, would you please?", "Good evening, sir."], []);
    expect(cultureWeight(youth, slangy)).toBeGreaterThan(cultureWeight(elder, slangy));
    expect(cultureWeight(elder, polite)).toBeGreaterThan(cultureWeight(youth, polite));
    // weather talk is a national pastime, less so for visitors
    const wx = toneOfExchange(["Bit of a nor'wester.", "Cold wind, eh."], ["clear"]);
    expect(cultureWeight(deriveProfile(1, 1, "local", "street"), wx)).toBeGreaterThan(cultureWeight(deriveProfile(1, 1, "tourist", "plaza"), wx));
  });
  it("bends the exchanges people open with: restrained speakers pick less boastful ones over many draws", () => {
    const sim = big(31);
    const dir = new Director(sim);
    const a = sim.chars.find((c) => c.tier === "mid" && c.role === "local")!, b = sim.chars.find((c) => c.tier === "mid" && c !== a)!;
    const run = (restraint: number) => {
      const p = getProfile(a)!; p.register.restraint = restraint;
      let loudCount = 0, n = 0;
      for (let i = 0; i < 300; i++) {
        (dir as unknown as { byPair: Map<string, string[]> }).byPair.clear();
        const lines = dir.pick(a, b); if (!lines) continue;
        n++; if (/!/.test(lines[0])) loudCount++;
      }
      return loudCount / Math.max(1, n);
    };
    expect(run(0.95)).toBeLessThan(run(0.05));
  });
  it("regionalise adds a discourse particle only sometimes and only to short statements", () => {
    const p = { ...deriveProfile(1, 1, "student", "plaza"), register: { ...deriveProfile(1, 1, "student", "plaza").register, slang: 1 } };
    const outs = Array.from({ length: 200 }, (_, i) => regionalise("Good day.", p, i / 200));
    expect(outs.filter((o) => /, (eh|aye)\.$/.test(o)).length).toBeGreaterThan(10);
    expect(outs.filter((o) => o === "Good day.").length).toBeGreaterThan(100);
    expect(regionalise("Is it?", p, 0)).toBe("Is it?");
    expect(regionalise("x".repeat(70) + ".", p, 0).endsWith(".")).toBe(true);
  });
});
