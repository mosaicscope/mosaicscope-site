import type { Simulation } from "../sim/Simulation";
import { Character, Lod, Phys } from "../entities/types";
import { GOALS, GOAL_BY_ID, Choice, GoalDef } from "./goals";
import { runStep, RUN, DONE, FAIL, moveTo, stop } from "./steps";
import { updateNeeds } from "./needs";
import { enterBuilding } from "../sim/Society";
import { goalBias, onGoalDone, updateMind } from "../mind/Mind";
import { violentBlocked, setForceGoal } from "../mind/Psychopathology";
import { getLlm } from "./llm";

/**
 * Top-level hierarchical state machine:
 *   physical (stumble/down/recover) > panic > talk > goal (utility choice + plan execution)
 * Higher layers pre-empt lower ones; the goal layer resumes or replans afterwards.
 */
const candidates: { g: GoalDef; ch: Choice }[] = [];

export function think(c: Character, sim: Simulation, dt: number): void {
  sim.metrics.aiDecisions++;
  updateNeeds(c, dt, { raining: sim.env.raining, dark: sim.isDark, sheltered: sim.world.isSheltered(c.x, c.y), party: sim.env.party && sim.world.areaAt(c.x, c.y)?.kind === "stage" });
  if (c.tier === "player") return;
  // cognition: low-rate affect/stress/forgetting/social-learning update, only for detailed characters
  if (c.lod <= Lod.REDUCED && sim.tick - c.mind.last >= 45) updateMind(c, sim);

  // 1. physical layer (a stumble only pauses; a knockdown interrupts everything)
  if (c.phys === Phys.STUMBLE) { stop(c); return; }
  if (c.phys !== Phys.OK) {
    c.mode = "down"; stop(c);
    if (c.talkWith >= 0) sim.endConversation(c);
    return;
  }
  if (c.mode === "down") { c.mode = "idle"; c.goal = null; } // the world changed while we were on the floor: replan

  // 2. panic layer
  const panicAt = 0.62 + c.pers.boldness * 0.25;
  if (c.emo.fear > panicAt && c.mode !== "panic") {
    c.mode = "panic";
    if (c.talkWith >= 0) sim.endConversation(c);
    const th = sim.threatFor(c);
    c.goal = { id: "flee", target: -1, plan: [{ kind: "flee", x: th.x, y: th.y, time: 3 + c.emo.fear * 3 }], stepIdx: 0, stepTimer: 0, started: sim.tick, replans: 0 };
    sim.say(c, sim.dialogue.bark(c, "panic"), "shout", 1.6);
  }
  if (c.mode === "panic") {
    if (c.emo.fear < 0.3 || !c.goal) { c.mode = "idle"; c.goal = null; }
    else { execute(c, sim, dt); return; }
  }

  // 3. conversation layer (DialogueEngine drives the exchange)
  if (c.talkWith >= 0) {
    c.mode = "talk"; stop(c);
    const o = sim.chars[c.talkWith];
    if (o) c.facing = Math.atan2(o.y - c.y, o.x - c.x);
    return;
  }
  if (c.mode === "talk") c.mode = c.goal ? "goal" : "idle";

  // group-level LOD: followers trail their leader instead of thinking for themselves
  if (c.lod === Lod.GROUP && c.group >= 0) {
    const g = sim.groups.get(c.group);
    if (g && g.leader !== c.id) {
      const l = sim.chars[g.leader];
      const slot = (g.members.indexOf(c.id) + 1) * 1.1;
      moveTo(c, l.x + Math.cos(c.seedPhase) * slot, l.y + Math.sin(c.seedPhase) * slot, sim, 1.2, 1.1);
      return;
    }
  }

  // 4. goal layer
  if (!c.goal || (c.goal && GOAL_BY_ID.get(c.goal.id)?.interruptible && sim.tick - c.goal.started > 60 * 25)) chooseGoal(c, sim);
  if (c.goal) execute(c, sim, dt);
}

export function chooseGoal(c: Character, sim: Simulation): void {
  candidates.length = 0;
  const now = sim.tick;
  for (const g of GOALS) {
    if (g.principalOnly && c.tier !== "principal") continue;
    if ((c.goalCooldowns[g.id] ?? 0) > now || violentBlocked(c, g.id)) continue;
    const ch = g.score(c, sim);
    if (ch && ch.u > 0) { ch.u *= goalBias(c, g.id, sim.hour); candidates.push({ g, ch }); }
  }
  if (!candidates.length) { c.goal = null; return; }
  candidates.sort((a, b) => b.ch.u - a.ch.u);
  // weighted pick among the top three keeps behaviour varied but sensible (seeded rng)
  const top = candidates.slice(0, 3);
  // optional model brain (principals only): use its last fresh pick if it is still valid, then ask for the next one
  const llm = getLlm(c.id);
  if (llm && c.tier === "principal") {
    const said = llm.take(c.id, now, new Set(candidates.map((x) => x.g.id)));
    const hit = said && candidates.find((x) => x.g.id === said);
    if (hit && startGoal(c, sim, hit.g, hit.ch)) return;
    llm.request(c.id, top.map((x) => ({ id: x.g.id, label: x.g.id })), now);
  }
  const w = top.map((x, i) => Math.max(0.001, x.ch.u) ** 3 * (i === 0 ? 1.5 : 1));
  const pick = top[Math.max(0, sim.rng.weighted(w))];
  startGoal(c, sim, pick.g, pick.ch);
}

export function startGoal(c: Character, sim: Simulation, g: GoalDef, ch: Choice): boolean {
  const plan = g.build(c, sim, ch);
  if (!plan || !plan.length) { c.goalCooldowns[g.id] = sim.tick + 60 * 3; c.goal = null; return false; }
  c.goal = { id: g.id, target: ch.target, plan, stepIdx: 0, stepTimer: 0, started: sim.tick, replans: 0 };
  c.mode = "goal";
  c.path = null; c.pathReq = 0;
  sim.onGoalStarted(c, g.id, ch);
  return true;
}

/** Force a goal (reactions such as retaliation). Ignored if the current goal is non-interruptible and more urgent. */
export function forceGoal(c: Character, sim: Simulation, id: string, ch: Choice): boolean {
  if (c.tier === "player" || c.phys === Phys.DOWN || c.phys === Phys.RECOVER) return false;
  if (c.goal && !GOAL_BY_ID.get(c.goal.id)?.interruptible && c.goal.id !== "wander" && c.goal.id === id) return false;
  const g = GOAL_BY_ID.get(id);
  if (!g || violentBlocked(c, id)) return false;
  return startGoal(c, sim, g, ch);
}

setForceGoal(forceGoal);

function execute(c: Character, sim: Simulation, dt: number): void {
  const goal = c.goal!;
  const step = goal.plan[goal.stepIdx];
  if (!step) { finish(c, sim, true); return; }
  const st = runStep(c, step, goal, sim, dt);
  if (st === RUN) return;
  if (st === DONE) {
    goal.stepIdx++; goal.stepTimer = 0;
    if (goal.stepIdx >= goal.plan.length) finish(c, sim, true);
    return;
  }
  if (st === FAIL) {
    // principals replan once or twice against the current world; others give up
    const def = GOAL_BY_ID.get(goal.id);
    if (def && c.tier === "principal" && goal.replans < 2 && goal.id !== "flee") {
      const ch = def.score(c, sim);
      const plan = ch ? def.build(c, sim, ch) : null;
      if (plan && plan.length) { goal.plan = plan; goal.stepIdx = 0; goal.stepTimer = 0; goal.replans++; goal.target = ch!.target; sim.metrics.replans++; return; }
    }
    finish(c, sim, false);
  }
}

function finish(c: Character, sim: Simulation, ok: boolean): void {
  const g = c.goal;
  if (!g) return;
  const def = GOAL_BY_ID.get(g.id);
  c.goalCooldowns[g.id] = sim.tick + 60 * (def ? (ok ? def.cooldown : Math.max(4, def.cooldown / 2)) : 4);
  if (!ok) { c.emo.frustration = Math.min(1, c.emo.frustration + 0.04); sim.metrics.failedGoals++; const k = g.id + ":" + (g.plan[g.stepIdx]?.kind ?? "?"); sim.metrics.failByGoal[k] = (sim.metrics.failByGoal[k] ?? 0) + 1; }
  sim.onGoalFinished(c, g.id, ok);
  if (c.tier !== "background") onGoalDone(c, g.id, ok, sim);
  c.goal = null; c.mode = "idle"; stop(c);
  if (c.anim.pose !== "auto") c.anim.pose = "auto";
}

/**
 * Background silhouettes: no goals, no pathfinding. They stroll between random street/area points in
 * straight lines (picking a new point if the way is blocked) and react coarsely to big events.
 */
export function thinkBackground(c: Character, sim: Simulation, dt: number): void {
  sim.metrics.bgThinks++;
  if (c.phys !== Phys.OK) { stop(c); return; }
  if (sim.env.party && Math.hypot(c.x - sim.stagePoint.x, c.y - sim.stagePoint.y) < 12) { stop(c); c.anim.pose = "dance"; return; }
  if (c.emo.fear > 0.5) { c.anim.pose = "panic"; } else if (c.anim.pose === "panic" || c.anim.pose === "dance") c.anim.pose = "auto";
  c.emo.fear = Math.max(0, c.emo.fear - dt * 0.08);
  // commuting: work in the morning, home at night (real people, not wanderers)
  const h = sim.hour;
  const dest = (h >= 23 || h < 6) && c.home >= 0 ? sim.world.buildings[c.home] : h >= 8 && h < 16 && c.workplace >= 0 && c.id % 3 === 0 ? sim.world.buildings[c.workplace] : null;
  if (dest && (c.goal === null) && sim.rng.chance(0.02)) {
    c.goal = { id: "commute", target: dest.id, plan: [], stepIdx: 0, stepTimer: 0, started: sim.tick, replans: 0 };
  }
  if (c.goal?.id === "commute") {
    const b = sim.world.buildings[c.goal.target];
    if (!b || sim.tick - c.goal.started > 60 * 90) { c.goal = null; }
    else if (moveTo(c, b.door.x + 0.5, b.door.y + 0.5, sim, 0.7)) {
      c.goal = null;
      enterBuilding(sim, c, b, h >= 23 || h < 6 ? ((7 - h + 24) % 24) * 60 : sim.rng.range(60, 200));
    } else if (c.pathReq === -1) { c.pathReq = 0; c.goal = null; }
    return;
  }
  const d = Math.hypot(c.pathGoalX - c.x, c.pathGoalY - c.y);
  if (d < 0.6 || c.stuck > 1.5) {
    c.stuck = 0;
    const tileNow = sim.world.tile(Math.floor(c.x), Math.floor(c.y));
    const onRoad = !sim.world.walkable(c.x, c.y) || tileNow === 16 || tileNow === 18;
    if (!onRoad && sim.rng.chance(0.35)) { stop(c); c.pathGoalX = c.x; c.pathGoalY = c.y; c.anim.pose = sim.rng.chance(0.3) ? "phone" : "auto"; return; }
    const area = sim.world.areas[c.homeArea] ?? sim.world.areas[0];
    let p = area.kind === "street" ? sim.streetPoint(c) : sim.world.randomPointIn(area, sim.rng);
    // stay on the footpath: short hops along it (or off the road if somehow standing in it)
    if (area.kind === "street") { const a = sim.rng.range(0, 6.28); const q = { x: c.x + Math.cos(a) * 4, y: c.y + Math.sin(a) * 4 }; if (sim.world.tile(Math.floor(q.x), Math.floor(q.y)) === 17) p = q; }
    if (onRoad) p = sim.world.nearestWalkable(c.x + (sim.world.isRoadLine(Math.floor(c.x)) ? 2 : 0), c.y + (sim.world.isRoadLine(Math.floor(c.y)) ? 2 : 0));
    else if (!sim.nav.walkLine(c.x, c.y, p.x, p.y)) return;
    c.pathGoalX = p.x; c.pathGoalY = p.y;
  }
  const dd = Math.hypot(c.pathGoalX - c.x, c.pathGoalY - c.y) || 1;
  const spd = c.speed * (sim.env.raining ? 1.5 : 1) * (c.emo.fear > 0.5 ? 2 : 1);
  if (dd > 0.6) { c.vx = ((c.pathGoalX - c.x) / dd) * spd; c.vy = ((c.pathGoalY - c.y) / dd) * spd; }
  else stop(c);
}
