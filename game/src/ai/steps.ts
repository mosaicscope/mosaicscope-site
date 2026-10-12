import type { Simulation } from "../sim/Simulation";
import { ActiveGoal, Character, Phys, Step } from "../entities/types";
import { TOYS, canThrow, isMelee } from "../content/toys";
import { findCarried, equip } from "../inventory/Inventory";

export const RUN = 0, DONE = 1, FAIL = 2;
export type StepStatus = 0 | 1 | 2;

/** Ask for a path (rate-limited) and steer along it. Returns true on arrival. */
export function moveTo(c: Character, x: number, y: number, sim: Simulation, arrive = 0.4, speedMul = 1): boolean {
  const dx = x - c.x, dy = y - c.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < arrive) { c.vx = 0; c.vy = 0; return true; }
  const goalMoved = Math.abs(x - c.pathGoalX) + Math.abs(y - c.pathGoalY) > 1.2;
  if ((goalMoved || (!c.path && c.pathReq === 0)) && sim.tick >= c.repathAt) {
    c.pathGoalX = x; c.pathGoalY = y; c.repathAt = sim.tick + 20;
    if (c.pathReq > 0) sim.nav.cancel(c.pathReq);
    if (d < 2.5 && sim.nav.walkLine(c.x, c.y, x, y)) { c.path = new Float32Array([x, y]); c.pathIdx = 0; c.pathReq = 0; }
    else {
      const id = sim.nav.request(c.x, c.y, x, y, (p) => {
        if (c.pathReq !== id) return;
        c.pathReq = p ? 0 : -1; c.path = p; c.pathIdx = 0;
      });
      c.pathReq = id;
    }
  }
  const spd = c.speed * speedMul * (0.7 + c.needs.energy * 0.3);
  if (c.path && c.pathIdx * 2 < c.path.length) {
    let wx = c.path[c.pathIdx * 2], wy = c.path[c.pathIdx * 2 + 1];
    const wd = Math.hypot(wx - c.x, wy - c.y);
    if (wd < 0.3 && c.pathIdx * 2 + 2 < c.path.length) { c.pathIdx++; wx = c.path[c.pathIdx * 2]; wy = c.path[c.pathIdx * 2 + 1]; }
    const ww = Math.hypot(wx - c.x, wy - c.y) || 1;
    c.vx = ((wx - c.x) / ww) * spd; c.vy = ((wy - c.y) / ww) * spd;
  } else if (c.pathReq > 0) {
    // waiting for the path queue: drift toward the goal slowly
    c.vx = (dx / d) * spd * 0.3; c.vy = (dy / d) * spd * 0.3;
  } else {
    c.vx = 0; c.vy = 0;
  }
  return false;
}

export function stop(c: Character): void { c.vx = 0; c.vy = 0; }
function face(c: Character, x: number, y: number): void { c.facing = Math.atan2(y - c.y, x - c.x); }

/** Execute one primitive step for one AI tick. dt = simulated seconds since the last think. */
export function runStep(c: Character, s: Step, g: ActiveGoal, sim: Simulation, dt: number): StepStatus {
  g.stepTimer += dt;
  if (g.stepTimer > (s.time ?? 0) + 25) return FAIL; // generic timeout: recover from stuck goals
  if (c.pathReq === -1) { c.pathReq = 0; c.path = null; return FAIL; } // unreachable
  const target = s.target !== undefined ? sim.chars[s.target] : undefined;
  if (s.target !== undefined && (!target || target.lod === 4 /* sleeping far away */)) return FAIL;

  switch (s.kind) {
    case "goto":
    case "wander": {
      c.anim.pose = "auto";
      return moveTo(c, s.x!, s.y!, sim, s.dist ?? 0.45) ? DONE : RUN;
    }
    case "approach": {
      c.anim.pose = "auto";
      const t = target!;
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d > 30) return FAIL;
      const fast = g.id === "fight" || g.id === "help" || g.id === "reclaim";
      if (d <= (s.dist ?? 1.2)) { stop(c); face(c, t.x, t.y); return DONE; }
      moveTo(c, t.x, t.y, sim, (s.dist ?? 1.2) * 0.9, fast ? 1.6 : 1);
      return RUN;
    }
    case "pickup": {
      const t = sim.toys[s.toy!];
      if (!t || t.state === "broken" || (t.state === "held" && t.holder !== c.id)) return FAIL;
      if (t.holder === c.id) { equip(c, t.id); return DONE; }
      c.anim.pose = "auto";
      if (!moveTo(c, t.x, t.y, sim, 0.6, g.id === "fight" ? 1.5 : 1)) return RUN;
      const r = sim.pickupToy(c, t);
      if (r === "hand" || r === "bag") { equip(c, t.id); return DONE; }
      if (r === "full") { sim.dropHeld(c); return RUN; }
      return FAIL;
    }
    case "throw": {
      const t = target!;
      const toy = c.hand >= 0 && canThrow(sim.toys[c.hand].def) ? sim.toys[c.hand] : findCarried(c, sim.toys, canThrow);
      if (!toy) return FAIL;
      equip(c, toy.id);
      face(c, t.x, t.y); stop(c);
      c.anim.pose = "throw";
      if (g.stepTimer < 0.4) return RUN;
      sim.throwHeld(c, t.x + t.vx * 0.3, t.y + t.vy * 0.3, t.id);
      return DONE;
    }
    case "swing": {
      const t = target!;
      if (c.hand < 0 || !isMelee(sim.toys[c.hand].def)) { const m = findCarried(c, sim.toys, isMelee); if (!m) return FAIL; equip(c, m.id); }
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d > 1.6) { c.anim.pose = "auto"; moveTo(c, t.x, t.y, sim, 1.0, 1.5); return g.stepTimer > 6 ? FAIL : RUN; }
      face(c, t.x, t.y); stop(c);
      c.anim.pose = "swing";
      if (g.stepTimer < 0.3) return RUN;
      sim.swingHeld(c);
      return DONE;
    }
    case "shoot": {
      const t = target!;
      const bow = findCarried(c, sim.toys, (d) => TOYS[d].uses.includes("ranged"));
      if (!bow) return FAIL;
      equip(c, bow.id); face(c, t.x, t.y); stop(c);
      c.anim.pose = "shoot";
      if (g.stepTimer < 0.5) return RUN;
      sim.shootAt(c, t.x, t.y, t.id);
      return DONE;
    }
    case "talk": {
      const t = target!;
      if (c.talkWith >= 0) return RUN; // conversation in progress
      if (g.stepTimer > 0.2 && s.text === "started") return DONE; // conversation finished
      if (Math.hypot(t.x - c.x, t.y - c.y) > 1.8) { c.anim.pose = "auto"; moveTo(c, t.x, t.y, sim, 1.2); return RUN; }
      stop(c);
      if (sim.startConversation(c, t, s.topic ?? "chat")) { s.text = "started"; return RUN; }
      return FAIL;
    }
    case "comfort": {
      const t = target!;
      if (Math.hypot(t.x - c.x, t.y - c.y) > 1.3) { c.anim.pose = "auto"; moveTo(c, t.x, t.y, sim, 1.0, 1.4); return RUN; }
      stop(c); face(c, t.x, t.y); c.anim.pose = "comfort";
      if (g.stepTimer < 1.6) return RUN;
      sim.comfort(c, t);
      return DONE;
    }
    case "give": {
      const t = target!;
      if (Math.hypot(t.x - c.x, t.y - c.y) > 1.4) { moveTo(c, t.x, t.y, sim, 1.1); return RUN; }
      stop(c); face(c, t.x, t.y);
      return sim.giveTo(c, t) ? DONE : FAIL;
    }
    case "sit": {
      const poi = sim.world.pois[s.poi!];
      if (!poi) return FAIL;
      if (c.anim.pose !== "sit") { c.anim.pose = "auto"; if (!moveTo(c, poi.x, poi.y + 0.3, sim, 0.5)) return RUN; g.stepTimer = 0; }
      stop(c); c.anim.pose = "sit";
      c.needs.energy = Math.min(1, c.needs.energy + dt * 0.05);
      return g.stepTimer > (s.time ?? 8) ? DONE : RUN;
    }
    case "wait": { stop(c); c.anim.pose = s.text ?? "auto"; return g.stepTimer > (s.time ?? 2) ? DONE : RUN; }
    case "watch":
    case "cheer": {
      const d = Math.hypot(s.x! - c.x, s.y! - c.y);
      if (d > (s.dist ?? 3.5)) { c.anim.pose = "auto"; moveTo(c, s.x!, s.y!, sim, (s.dist ?? 3.5) * 0.9); return g.stepTimer > 15 ? FAIL : RUN; }
      stop(c); face(c, s.x!, s.y!);
      c.anim.pose = s.kind === "cheer" || c.pers.playfulness > 0.6 ? "cheer" : "watch";
      c.needs.curiosity = Math.min(1, c.needs.curiosity + dt * 0.06); c.needs.fun = Math.min(1, c.needs.fun + dt * 0.02);
      return g.stepTimer > (s.time ?? 6) ? DONE : RUN;
    }
    case "dance": {
      const d = Math.hypot(s.x! - c.x, s.y! - c.y);
      // crowded dance floor: dance wherever you got to once you're close-ish or have tried a while
      if (d > 3 && !(d < 8 && g.stepTimer > 6) && g.stepTimer < 18) { c.anim.pose = "auto"; moveTo(c, s.x!, s.y!, sim, 2.5); return RUN; }
      stop(c); c.anim.pose = "dance";
      c.needs.fun = Math.min(1, c.needs.fun + dt * 0.05); c.needs.social = Math.min(1, c.needs.social + dt * 0.03);
      c.needs.energy = Math.max(0, c.needs.energy - dt * 0.01);
      return g.stepTimer > (s.time ?? 10) || !sim.env.party ? DONE : RUN;
    }
    case "play": {
      // kick or toss a toy around for a while
      const t = sim.toys[s.toy!];
      if (!t || t.state === "broken") return FAIL;
      if (t.state === "held" && t.holder !== c.id) return DONE; // someone else has it now: move on
      c.needs.fun = Math.min(1, c.needs.fun + dt * 0.04);
      if (t.holder === c.id) {
        stop(c); c.anim.pose = "throw";
        if (g.stepTimer > 0.5) { const a = sim.clearDirection(c), r = sim.rng.range(1.5, 3.5); sim.throwHeld(c, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, -1, 0.75); }
        return RUN;
      }
      c.anim.pose = "auto";
      if (moveTo(c, t.x, t.y, sim, 0.55, 1.2)) {
        if (TOYS[t.def].portable && sim.rng.chance(0.5)) sim.pickupToy(c, t);
        else sim.kickToy(c, t);
      }
      return g.stepTimer > (s.time ?? 10) ? DONE : RUN;
    }
    case "flee": {
      c.anim.pose = "panic";
      const fx = s.x!, fy = s.y!;
      if (!c.path || c.pathIdx * 2 >= (c.path?.length ?? 0) - 2) {
        const a = Math.atan2(c.y - fy, c.x - fx) + sim.rng.range(-0.6, 0.6);
        const p = sim.world.nearestWalkable(c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7);
        moveTo(c, p.x, p.y, sim, 0.5, 1.9);
      } else moveTo(c, c.pathGoalX, c.pathGoalY, sim, 0.5, 1.9);
      return g.stepTimer > (s.time ?? 4) ? DONE : RUN;
    }
    case "search": {
      c.anim.pose = "search";
      const lost = c.memories.find((m) => m.kind === "lost_item" && m.val < 0);
      if (lost) {
        const found = sim.findLostToy(c);
        if (found) { g.stepTimer = 0; s.kind = "pickup"; s.toy = found.id; return RUN; }
      }
      if (!moveTo(c, s.x!, s.y!, sim, 0.6)) return RUN;
      const a = sim.world.areas[lost?.area ?? c.homeArea] ?? sim.world.areas[0];
      const p = sim.world.randomPointIn(a, sim.rng); s.x = p.x; s.y = p.y;
      return g.stepTimer > (s.time ?? 20) ? DONE : RUN;
    }
    case "craft": {
      stop(c); c.anim.pose = "craft";
      if (g.stepTimer < 2) return RUN;
      return sim.craft(c) ? DONE : FAIL;
    }
    case "music": {
      const poi = sim.world.pois[s.poi!];
      if (!moveTo(c, poi.x + 0.6, poi.y, sim, 0.6)) { c.anim.pose = "auto"; return RUN; }
      stop(c); c.anim.pose = "music";
      if (g.stepTimer < 1) return RUN;
      sim.toggleBoombox(c, true);
      return DONE;
    }
    case "kick": {
      const t = sim.toys[s.toy!];
      if (!t || t.state === "broken") return FAIL;
      if (t.state === "held") { stop(c); c.anim.pose = "watch"; return g.stepTimer > 6 ? DONE : RUN; } // wait for the ball
      if (Math.hypot(t.x - c.x, t.y - c.y) > 9) return DONE;
      if (!moveTo(c, t.x, t.y, sim, 0.55, 1.3)) { c.anim.pose = "auto"; return RUN; }
      sim.kickToy(c, t, target ? target.x : s.x, target ? target.y : s.y);
      return DONE;
    }
    case "drop": { if (c.hand >= 0) sim.dropHeld(c); return DONE; }
    case "push": return DONE;
  }
  return FAIL;
}

export const isIncapacitated = (c: Character) => c.phys === Phys.DOWN || c.phys === Phys.RECOVER;
