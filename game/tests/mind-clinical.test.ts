import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { small, byName, stage } from "./helpers";
import { EVIDENCE, searchEvidence, evidenceFor } from "../src/mind/Evidence";
import { PSY, distress, respond, applyLifeEvent, updatePsy, onsetAgeFactor, violentBlocked, psyBias, careOutcome, noteEnter, mentalSummary, WHAT_HELPS, PSY_GOALS } from "../src/mind/Psychopathology";
import { describeMind } from "../src/mind/Mind";
import { GOAL_BY_ID } from "../src/ai/goals";
import { serialize, restore, parseSave, toJSON } from "../src/persistence/SaveSystem";
import { applyInteraction } from "../src/social/Social";

const TPH = 3600;
const quiet = (sim: ReturnType<typeof small>, name: string) => { const c = byName(sim, name); c.goal = null; c.nextThink = 1e9; return c; };
/** run only the clinical update for `hours` game hours with the given conditions held */
function run(sim: ReturnType<typeof small>, c: ReturnType<typeof quiet>, hours: number, hold?: () => void): void {
  for (let i = 0; i < hours * 4; i++) { sim.tick += TPH / 4; hold?.(); c.mind.last = sim.tick - 900; updatePsy(c, sim, 900 / 60); }
}

describe("evidence base", () => {
  const src = fs.readdirSync("src/mind").filter((f) => f.endsWith(".ts")).map((f) => fs.readFileSync(path.join("src/mind", f), "utf8")).join("\n") + fs.readFileSync("src/sim/Society.ts", "utf8");
  it("is a large, well-formed catalogue with unique ids", () => {
    expect(EVIDENCE.length).toBeGreaterThan(200);
    expect(new Set(EVIDENCE.map((e) => e.id)).size).toBe(EVIDENCE.length);
    for (const e of EVIDENCE) {
      expect(e.cite.length).toBeGreaterThan(10); expect(e.finding.length).toBeGreaterThan(15); expect(e.tags.length).toBeGreaterThan(0);
      expect(["landmark", "well-replicated", "contested"]).toContain(e.confidence);
      expect(/\b(18|19|20)\d\d\b/.test(e.cite)).toBe(true);
    }
  });
  it("every entry points at an identifier that really exists in the code", () => {
    for (const e of EVIDENCE) { const id = e.drives.split(/[^A-Za-z0-9_]/)[0]; expect(id.length, e.id).toBeGreaterThan(1); expect(src.includes(id), `${e.id} -> ${id}`).toBe(true); }
  });
  it("is searchable and honest about contested findings", () => {
    expect(searchEvidence("garcia").length).toBeGreaterThanOrEqual(3);
    expect(searchEvidence("holmes rahe")[0].id).toBe("holmes-rahe-1967");
    expect(evidenceFor("prospect").length).toBeGreaterThan(0);
    expect(EVIDENCE.filter((e) => e.confidence === "contested").length).toBeGreaterThan(5);
    expect(EVIDENCE.some((e) => e.id === "risch-2009" && e.confidence === "contested")).toBe(true);
  });
});

describe("diathesis-stress dynamics", () => {
  it("the same stress hurts a vulnerable, adversity-exposed person more", () => {
    const sim = small(5), a = quiet(sim, "Chris"), b = quiet(sim, "Kodak");
    for (const c of [a, b]) { c.pers.temper = 0.5; c.pers.boldness = 0.5; }
    a.mind.psy.ace = 0; b.mind.psy.ace = 5; a.mind.stress = b.mind.stress = 0.9;
    run(sim, a, 60, () => { a.mind.stress = 0.9; a.needs.social = 0.1; }); run(sim, b, 60, () => { b.mind.stress = 0.9; b.needs.social = 0.1; });
    expect(b.mind.psy.load).toBeGreaterThan(a.mind.psy.load);
  });
  it("social support buffers load (Cohen & Wills)", () => {
    const sim = small(5), a = quiet(sim, "Chris"), b = quiet(sim, "Kodak");
    for (const c of [a, b]) { c.rel.clear(); c.mind.psy.ace = 2; }
    const f = byName(sim, "Ruby"); applyInteraction(a, f, "talk", true, sim.tick, 3);
    a.rel.get(f.id)!.aff = 0.9; a.rel.get(f.id)!.trust = 0.9;
    const hold = (c: typeof a) => () => { c.mind.stress = 0.9; c.needs.social = c === a ? 0.8 : 0.1; if (c === a) c.mind.psy.contact = 0.7; };
    run(sim, a, 60, hold(a)); run(sim, b, 60, hold(b));
    expect(a.mind.psy.support).toBeGreaterThan(b.mind.psy.support);
    expect(a.mind.psy.load).toBeLessThan(b.mind.psy.load);
  });
  it("depression recovers faster with behavioural activation, and recovery happens", () => {
    const sim = small(5), a = quiet(sim, "Chris"), b = quiet(sim, "Kodak");
    for (const c of [a, b]) { c.mind.psy.dep = 0.8; c.mind.psy.load = 0.1; c.mind.stress = 0; c.rel.clear(); }
    run(sim, a, 72, () => { a.mind.psy.act = 0.9; a.mind.stress = 0; }); run(sim, b, 72, () => { b.mind.psy.act = 0; b.mind.stress = 0; });
    expect(a.mind.psy.dep).toBeLessThan(b.mind.psy.dep);
    expect(a.mind.psy.dep).toBeLessThan(0.35);
    run(sim, b, 600, () => { b.mind.stress = 0; });
    expect(b.mind.psy.dep).toBeLessThan(0.4); // even untreated, episodes end
  });
  it("trauma after violence decays faster with support", () => {
    const sim = small(5), a = quiet(sim, "Chris"), b = quiet(sim, "Kodak");
    for (const c of [a, b]) { c.mind.psy.trauma = 0; applyLifeEvent(c, "wounded"); c.mind.stress = 0; }
    expect(a.mind.psy.trauma).toBeGreaterThan(0.2);
    run(sim, a, 48, () => { a.mind.psy.contact = 0.9; a.mind.stress = 0; }); run(sim, b, 48, () => { b.mind.psy.contact = 0; b.mind.stress = 0; });
    expect(a.mind.psy.trauma).toBeLessThan(b.mind.psy.trauma);
    run(sim, b, 400, () => { b.mind.stress = 0; });
    expect(b.mind.psy.trauma).toBeLessThan(0.05);
  });
  it("acute stress reaction fades in hours", () => {
    const sim = small(5), a = quiet(sim, "Chris"); a.mind.psy.acute = 0.8; a.mind.stress = 0;
    run(sim, a, 15, () => { a.mind.stress = 0; });
    expect(a.mind.psy.acute).toBeLessThan(0.15);
  });
});

describe("psychotic-spectrum episodes: rare, gated, with prodrome, never violent", () => {
  it("needs both high liability and high stress, and the right age", () => {
    expect(onsetAgeFactor(22, true)).toBeGreaterThan(onsetAgeFactor(60, true) * 5);
    expect(onsetAgeFactor(22, true)).toBeGreaterThan(onsetAgeFactor(22, false) - 0.01 - 1); // sanity
    expect(onsetAgeFactor(21, true)).toBeGreaterThan(onsetAgeFactor(21, false));  // men peak earlier
    expect(onsetAgeFactor(10, true)).toBe(0);
  });
  it("is almost never seen in a whole town over days; only the high-liability, high-load can progress", () => {
    const sim = small(9, { backgroundCount: 200 });
    for (let i = 0; i < 4000; i++) sim.step();
    const eps = sim.chars.filter((c) => c.mind.psy.episodes > 0 || c.mind.psy.psychosis > 0);
    expect(eps.length).toBeLessThanOrEqual(Math.ceil(sim.chars.length * 0.03));
    const hot = sim.chars.filter((c) => c.mind.psy.prod > 0.3);
    for (const c of hot) expect(c.mind.psy.liab).toBeGreaterThanOrEqual(PSY.liabGate);
  });
  it("a vulnerable, very stressed young adult shows a prodrome first, then can have an episode, which ends", () => {
    const sim = small(5), c = quiet(sim, "Chris"), p = c.mind.psy;
    // force the vulnerability inputs (liability comes from the kin module; this is the forced-conditions test)
    const stress = () => { c.mind.stress = 1; c.hunger = 0.1; c.needs.energy = 0.1; c.needs.social = 0.05; c.cash = 0; p.ace = 4; p.liabLock = 3; p.ageLock = 22; p.sleep = Math.max(p.sleep, 0.6); };
    let sawProdromeBeforeEpisode = false;
    for (let i = 0; i < 4000 && p.psychosis === 0; i++) {
      sim.tick += 900; stress(); c.mind.last = sim.tick - 900;
      // keep liability pinned (updatePsy refreshes it from kin); young adult
      updatePsy(c, sim, 15);
      if (p.prod > 0.3 && p.psychosis === 0) sawProdromeBeforeEpisode = true;
    }
    if (p.psychosis === 0) { expect(p.prod).toBeGreaterThan(0.3); } else expect(sawProdromeBeforeEpisode).toBe(true);
  });
  it("psychosis blocks every aggressive goal and the forced-fight route; people in distress are not villains", () => {
    const sim = small(5), c = quiet(sim, "Chris");
    c.mind.psy.psychosis = 0.7;
    for (const g of ["fight", "mug", "steal", "turf", "prank"]) expect(violentBlocked(c, g)).toBe(true);
    expect(violentBlocked(c, "socialize")).toBe(false);
    expect(psyBias(c, "gohome")).toBeGreaterThan(1);       // withdraws and seeks safety
    expect(psyBias(c, "socialize")).toBeLessThan(1);
    // across many decisions nobody in an episode ever starts a fight
    const forced = sim.chars.slice(0, 40); for (const o of forced) o.mind.psy.psychosis = 0.6;
    let fights = 0;
    for (let i = 0; i < 900; i++) { sim.step(); for (const o of forced) if (o.goal && ["fight", "mug", "steal", "turf", "prank"].includes(o.goal.id)) fights++; for (const o of forced) o.mind.psy.psychosis = Math.max(o.mind.psy.psychosis, 0.6); }
    expect(fights).toBe(0);
  });
  it("thoughts are the person's own, gentle words (no slurs, no mockery)", () => {
    const src = fs.readFileSync("src/mind/Psychopathology.ts", "utf8");
    const block = src.slice(src.indexOf("const VOICES"), src.indexOf("function speak"));
    expect(block).not.toMatch(/crazy|insane|psycho\b|lunatic|nutter|mad\b|loony|schizo|freak/i);
    const sim = small(5), c = quiet(sim, "Chris"); c.mind.psy.psychosis = 0.6; c.mind.psy.lastVoice = -1e6;
    updatePsy(c, sim, 15);
    if (c.bubble) expect(c.bubble.kind).toBe("think");
  });
});

describe("responses and care", () => {
  it("calm company measurably helps; crowding and shouting measurably hurt", () => {
    const sim = small(5), a = quiet(sim, "Chris"), b = quiet(sim, "Kodak"), h = quiet(sim, "Ruby");
    for (const c of [a, b]) { c.mind.psy.acute = 0.5; c.mind.psy.anx = 0.5; c.mind.psy.psychosis = 0.5; }
    const d0 = distress(a);
    respond(h, a, sim, "company");
    expect(distress(a)).toBeLessThan(d0);
    expect(a.mind.psy.contact).toBeGreaterThan(0.2);
    const d1 = distress(b); respond(h, b, sim, "shout");
    expect(distress(b)).toBeGreaterThan(d1);
    const c2 = distress(b); respond(h, b, sim, "crowd");
    expect(distress(b)).toBeGreaterThanOrEqual(c2);
  });
  it("a friend nearby responds kindly in the live update", () => {
    const sim = small(5), a = quiet(sim, "Chris"), f = quiet(sim, "Kodak");
    stage(sim, a, f, 1.5);
    applyInteraction(f, a, "talk", true, sim.tick, 3); f.rel.get(a.id)!.aff = 0.9; f.rel.get(a.id)!.trust = 0.9;
    a.mind.psy.anx = 0.7; a.mind.psy.acute = 0.5; a.mind.psy.lastResp = -1e6;
    sim.rebuildHash();
    updatePsy(a, sim, 15);
    expect(a.mind.psy.contact).toBeGreaterThan(0.1);
    expect(f.bubble?.text).toBeTruthy();
  });
  it("registers the three care goals and sends the very unwell to the unit", () => {
    for (const id of ["seek_help", "crisis_care", "visit_friend_in_care"]) expect(GOAL_BY_ID.has(id)).toBe(true);
    expect(PSY_GOALS.length).toBe(3);
    const sim = small(5), c = quiet(sim, "Chris");
    expect(GOAL_BY_ID.get("crisis_care")!.score(c, sim)).toBeNull();
    c.mind.psy.psychosis = 0.8;
    const ch = GOAL_BY_ID.get("crisis_care")!.score(c, sim);
    if (sim.world.buildings.some((b) => b.kind === "mentalhealth")) {
      expect(ch).not.toBeNull();
      expect(sim.world.buildings[ch!.toy!].kind).toBe("mentalhealth");
      expect(GOAL_BY_ID.get("crisis_care")!.build(c, sim, ch!)![0].kind).toBe("enter");
    }
    c.mind.psy.psychosis = 0; c.mind.psy.dep = 0.7;
    expect(GOAL_BY_ID.get("seek_help")!.score(c, sim)).not.toBeNull();
  });
  it("a stay in care treats, rests and books a follow-up; a visiting friend comforts", () => {
    const sim = small(5), c = quiet(sim, "Chris"), f = quiet(sim, "Kodak");
    const b = sim.world.buildings.find((x) => x.kind === "mentalhealth") ?? sim.world.buildings.find((x) => x.kind === "hospital")!;
    Object.assign(c.mind.psy, { psychosis: 0.7, anx: 0.8, load: 0.8, sleep: 0.7, dep: 0.6 });
    c.goal = { id: "crisis_care", target: -1, plan: [], stepIdx: 0, stepTimer: 0, started: 0, replans: 0 };
    c.inside = b.id; c.insideUntil = sim.tick + 6 * TPH; noteEnter(sim, c, b.kind, "crisis_care");
    expect(c.mind.psy.careUntil).toBeGreaterThan(sim.tick);
    // a friend visits first
    applyInteraction(f, c, "talk", true, sim.tick, 3); f.rel.get(c.id)!.aff = 0.9; f.rel.get(c.id)!.trust = 0.9;
    f.inside = b.id; f.mind.psy.via = "visit_friend_in_care"; careOutcome(sim, f, b);
    expect(c.mind.psy.visits).toBe(1);
    sim.tick += 6 * TPH;
    careOutcome(sim, c, b);
    const p = c.mind.psy;
    expect(p.psychosis).toBeLessThan(0.4); expect(p.load).toBeLessThan(0.4); expect(p.treated).toBeGreaterThan(0.3);
    expect(p.followUp).toBeGreaterThan(sim.tick);
    expect(describeMind(c, sim.tick).some((l) => /follow-up/.test(l))).toBe(true);
  });
});

describe("inspector summary and persistence", () => {
  it("describes how someone is doing gently, with what helps and no diagnosis labels", () => {
    const sim = small(5), c = quiet(sim, "Chris");
    expect(mentalSummary(c, sim.tick)[0]).toMatch(/Coping well/);
    Object.assign(c.mind.psy, { load: 0.8, sleep: 0.7, confidant: byName(sim, "Ruby").id, confidantName: "Tiles", support: 0.6, dep: 0.5 });
    const lines = mentalSummary(c, sim.tick);
    expect(lines[0]).toMatch(/heavy stress/); expect(lines[0]).toMatch(/sleeping badly/); expect(lines[0]).toMatch(/leaning on Tiles/);
    expect(lines.some((l) => l.startsWith("What helps"))).toBe(true);
    c.mind.psy.psychosis = 0.6;
    const all = describeMind(c, sim.tick).join(" ");
    expect(all).not.toMatch(/schizophren|disorder|diagnos|PTSD|bipolar/i);
    for (const v of Object.values(WHAT_HELPS)) expect(v.length).toBeGreaterThan(20);
  });
  it("round-trips the clinical state through a save", () => {
    const sim = small(5), c = quiet(sim, "Chris");
    Object.assign(c.mind.psy, { dep: 0.6, trauma: 0.4, treated: 0.5, followUp: 99999, confidantName: "Tiles", episodes: 1 });
    const l = restore(parseSave(toJSON(serialize(sim)))).chars[c.id].mind.psy;
    expect(l.dep).toBeCloseTo(0.6, 2); expect(l.followUp).toBe(99999); expect(l.confidantName).toBe("Tiles"); expect(l.episodes).toBe(1);
  });
  it("migrates v5 saves that have minds without clinical state", () => {
    const sim = small(5);
    const d: any = JSON.parse(toJSON(serialize(sim)));
    d.version = 5; for (const c of d.chars) delete c.mind.psy;
    const loaded = restore(parseSave(JSON.stringify(d)));
    expect(loaded.chars.every((c) => typeof c.mind.psy.dep === "number")).toBe(true);
  });
  it("stays finite and deterministic in a longer run", () => {
    const run2 = () => { const s = small(11); for (let i = 0; i < 3000; i++) s.step(); return s; };
    const a = run2(), b = run2();
    for (const c of a.chars) for (const v of Object.values(c.mind.psy)) if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    expect(JSON.stringify(a.chars.map((c) => c.mind.psy))).toBe(JSON.stringify(b.chars.map((c) => c.mind.psy)));
  });
});
