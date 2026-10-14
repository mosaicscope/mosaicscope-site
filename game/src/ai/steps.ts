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
/** Step kinds that end with someone standing at (x, y). */
const LOITER_AT = new Set(["goto", "wander", "watch", "cheer", "dance"]);
function face(c: Character, x: number, y: number): void { c.facing = Math.atan2(y - c.y, x - c.x); }

/** Execute one primitive step for one AI tick. dt = simulated seconds since the last think. */
export function runStep(c: Character, s: Step, g: ActiveGoal, sim: Simulation, dt: number): StepStatus {
  g.stepTimer += dt;
  if (g.stepTimer > (s.time ?? 0) + 60) return FAIL; // generic timeout: recover from stuck goals
  if (c.pathReq === -1) { c.pathReq = 0; c.path = null; return FAIL; } // unreachable
  const target = s.target !== undefined ? sim.chars[s.target] : undefined;
  if (s.target !== undefined && (!target || target.lod === 4 /* sleeping far away */)) return FAIL;

  // somewhere to stand (a wander spot, a place to watch from, the dance floor) never goes in a lane: use the kerb.
  // Steps with an explicit reach (closing in on someone) keep their target.
  if (s.x !== undefined && s.y !== undefined && s.dist === undefined && LOITER_AT.has(s.kind) && sim.world.carriageway(s.x, s.y)) {
    const p = sim.world.nearestFoot(s.x, s.y); s.x = p.x; s.y = p.y;
  }
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
    default: { const r = runCityStep(c, s, g, sim, dt); if (r !== null) return r; }
  }
  return FAIL;
}

export const isIncapacitated = (c: Character) => c.phys === Phys.DOWN || c.phys === Phys.RECOVER;

/* ------------------------------------------------------------------ city behaviours */
import { enterBuilding, buy, consume, commitCrime, paint, arrest, findWall, book } from "../sim/Society";
import { isFood as _isFood, TOYS as _TOYS } from "../content/toys";
import { BUILDINGS as _B, isOpen as _isOpen } from "../content/buildings";
import { carried as _carried, detach as _detach } from "../inventory/Inventory";

/** Second executor for the city steps; returns null when the step kind isn't one of these. */
export function runCityStep(c: Character, s: Step, g: ActiveGoal, sim: Simulation, dt: number): StepStatus | null {
  switch (s.kind) {
    case "enter": {
      const b = sim.world.buildings[s.building!];
      if (!b) return FAIL;
      if (!_isOpen(_B[b.kind], sim.hour) && b.kind !== "house" && b.kind !== "apartments" && c.workplace !== b.id) return FAIL;
      c.anim.pose = "auto";
      if (!moveTo(c, b.door.x + 0.5, b.door.y + 0.5, sim, 0.6)) return RUN;
      enterBuilding(sim, c, b, s.minutes ?? 10);
      return DONE;
    }
    case "buy": {
      const poi = sim.world.pois[s.poi!];
      if (!poi?.menu?.length) return FAIL;
      if (!moveTo(c, poi.x, poi.y + 0.6, sim, 0.7)) { c.anim.pose = "auto"; return RUN; }
      const opts = poi.menu.filter((m) => _TOYS[m].value <= c.cash && (s.item ? m === s.item : _isFood(m)));
      if (!opts.length) return FAIL;
      const r = buy(sim, c, s.item ? sim.rng.pick(opts) : chooseFood(sim, c, opts), { poi: poi.id });
      return r.ok ? DONE : FAIL;
    }
    case "eat": {
      const food = _carried(c).map((id) => sim.toys[id]).find((t) => t && _isFood(t.def));
      if (!food) return DONE;
      stop(c); c.anim.pose = "eat";
      if (g.stepTimer < 2.2) return RUN;
      consume(sim, c, food);
      return DONE;
    }
    case "steal": {
      const v = sim.chars[s.target!];
      if (!v || v.inside >= 0 || v.inCar >= 0) return FAIL;
      // approach from behind, casually
      const bx = v.x - Math.cos(v.facing) * 0.6, by = v.y - Math.sin(v.facing) * 0.6;
      if (!moveTo(c, bx, by, sim, 0.5, 1.15)) { c.anim.pose = "auto"; return g.stepTimer > 20 ? FAIL : RUN; }
      stop(c);
      const loot = _carried(v).map((id) => sim.toys[id]).find((t) => t && _TOYS[t.def].category === "valuable");
      let item: string | null = null;
      if (loot && sim.rng.chance(0.6)) {
        _detach(v, loot.id); loot.holder = c.id; loot.state = "held"; c.bag.push(loot.id); item = loot.def;
        remember(v, { t: sim.tick, kind: "lost_item", subj: v.id, obj: -1, toy: loot.def, area: sim.world.areaAt(v.x, v.y)?.id ?? 0, val: -0.6, ev: -1, src: "did" });
      } else {
        const take = Math.min(v.cash, Math.round(10 + sim.rng.next() * 60));
        v.cash -= take; c.cash += take;
        if (take <= 0) return FAIL;
      }
      c.stats.hits++;
      commitCrime(sim, c, item ? "snatch" : "pickpocket", v, item);
      return DONE;
    }
    case "flee_far": {
      c.anim.pose = "auto";
      if (s.x === undefined) { const a = sim.rng.range(0, 6.28); const p = sim.world.nearestWalkable(c.x + Math.cos(a) * 18, c.y + Math.sin(a) * 18); s.x = p.x; s.y = p.y; }
      return moveTo(c, s.x!, s.y!, sim, 0.8, 1.9) || g.stepTimer > 14 ? DONE : RUN;
    }
    case "spray": {
      if (!moveTo(c, s.x!, s.y!, sim, 0.4)) { c.anim.pose = "auto"; return g.stepTimer > 25 ? FAIL : RUN; }
      stop(c); c.anim.pose = "spray";
      c.facing = s.text === "e" ? Math.PI : -Math.PI / 2;
      if (g.stepTimer < 4) { if (sim.tick % 6 === 0) sim.bus.emit("fx", { kind: "spray", x: c.x + Math.cos(c.facing) * 0.5, y: c.y + Math.sin(c.facing) * 0.5, z: 1.1, n: 2, color: c.look.color }); return RUN; }
      const spot = { tx: s.poi!, ty: s.target!, face: (s.text as "s" | "e") ?? "s", legal: s.topic === "legal" };
      paint(sim, c, spot);
      if (!spot.legal) commitCrime(sim, c, "vandalism", null);
      return DONE;
    }
    case "clean": {
      const gi = sim.world.graffiti.findIndex((x) => x.id === s.poi);
      if (gi < 0) return DONE;
      const gr = sim.world.graffiti[gi];
      const sx = gr.face === "e" ? gr.tx + 1.5 : gr.tx + 0.5, sy = gr.face === "s" ? gr.ty + 1.5 : gr.ty + 0.5;
      if (!moveTo(c, sx, sy, sim, 0.5)) { c.anim.pose = "auto"; return g.stepTimer > 30 ? FAIL : RUN; }
      stop(c); c.anim.pose = "craft";
      if (g.stepTimer < 5) return RUN;
      sim.world.graffiti.splice(gi, 1);
      sim.emit({ type: "cleanup", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} scrubbed off the "${gr.text}" tag` });
      return DONE;
    }
    case "chase": {
      const sus = sim.chars[s.target!];
      if (!sus || sus.jailUntil > 0 || sus.arrestedBy >= 0) { c.pursuing = -1; return DONE; }
      if (sus.inside >= 0) { c.pursuing = -1; return g.stepTimer > 5 ? DONE : RUN; } // lost them indoors
      if (sus.inCar >= 0) { const v = sim.vehicles[sus.inCar]; if (v && Math.abs(v.speed) > 2) { moveTo(c, v.x, v.y, sim, 1, 1.8); return g.stepTimer > 30 ? DONE : RUN; } }
      const d = Math.hypot(sus.x - c.x, sus.y - c.y);
      c.anim.pose = "auto";
      if (d > 30 || g.stepTimer > 45) { c.pursuing = -1; sim.emit({ type: "escaped", x: sus.x, y: sus.y, actors: [sus.id, c.id], summary: `${sus.name} got away from ${c.name}` }); return DONE; }
      // armed suspect: armed response. Keep some distance, sidearm out, return fire; cuff them once they're down
      if (isArmed(sim, sus) && drawGun(sim, c)) {
        c.facing = Math.atan2(sus.y - c.y, sus.x - c.x);
        if (sus.phys === Phys.DOWN && d < 1.1) { arrest(sim, c, sus); return DONE; }
        if (sus.phys !== Phys.DOWN && d < 9 && d > 1.5 && sim.world.lineOfSight(c.x, c.y, sus.x, sus.y)) {
          stop(c); c.anim.pose = "shoot";
          if (g.stepTimer > 0.8) sim.fireGun(c, sus.x, sus.y, sus.id);
          if (d > 6) moveTo(c, sus.x, sus.y, sim, 5, 1.2);
          return RUN;
        }
        moveTo(c, sus.x, sus.y, sim, sus.phys === Phys.DOWN ? 0.9 : 5, 1.7);
        return RUN;
      }
      if (holdsGun(sim, c)) { holster(sim, c); const tz = _carried(c).find((id) => sim.toys[id]?.def === "taser"); if (tz !== undefined) equip(c, tz); }
      // taser at range
      const taser = c.hand >= 0 && sim.toys[c.hand]?.def === "taser";
      if (taser && d < 5 && d > 1.4 && sim.tick > (c.lastHitTick + 150) && sus.phys === 0) {
        c.lastHitTick = sim.tick; c.facing = Math.atan2(sus.y - c.y, sus.x - c.x); c.anim.pose = "shoot";
        sim.shootAt(c, sus.x, sus.y, sus.id);
      }
      if (d < 1.1) { arrest(sim, c, sus); return DONE; }
      moveTo(c, sus.x, sus.y, sim, 0.9, 1.95);
      return RUN;
    }
    case "gunfight": {
      // a turf skirmish: gun out, pick the nearest rival, trade shots from cover-ish range, then scarper
      if (!drawGun(sim, c)) return FAIL;
      const foe = nearestFoe(sim, c, 16);
      if (!s.text) { s.text = "started"; sim.say(c, sim.rng.pick(TURF_TAUNTS), "shout", 1.8); }
      if (g.stepTimer > (s.time ?? 18) || c.emo.composure < 0.2) { holster(sim, c); return DONE; }
      if (!foe) { stop(c); c.anim.pose = "threaten"; return RUN; }
      const d = Math.hypot(foe.x - c.x, foe.y - c.y);
      const reach = _TOYS[sim.toys[c.hand].def].weapon?.reach ?? 10;
      if (d > reach * 0.85) { c.anim.pose = "auto"; moveTo(c, foe.x, foe.y, sim, reach * 0.7, 1.3); return RUN; }
      if (d < 3) { const a = Math.atan2(c.y - foe.y, c.x - foe.x) + 0.6; const p = sim.world.nearestWalkable(c.x + Math.cos(a) * 3, c.y + Math.sin(a) * 3); moveTo(c, p.x, p.y, sim, 0.4, 1.4); }
      else stop(c);
      c.facing = Math.atan2(foe.y - c.y, foe.x - c.x); c.anim.pose = "shoot";
      if (g.stepTimer > 1.2) sim.fireGun(c, foe.x + foe.vx * 0.15, foe.y + foe.vy * 0.15, foe.id);
      return RUN;
    }
    case "photo": {
      const bk = sim.bookings.find((b) => b.id === s.booking);
      const cl = bk ? sim.chars[bk.client] : undefined;
      if (!bk || !cl || bk.done) return DONE;
      const dx = cl.x - c.x, dy = cl.y - c.y, d = Math.hypot(dx, dy);
      if (d > 3) { c.anim.pose = "auto"; moveTo(c, cl.x - 2, cl.y + 0.5, sim, 1.2); return g.stepTimer > 40 ? FAIL : RUN; }
      stop(c); c.facing = Math.atan2(dy, dx); c.anim.pose = "camera";
      if (sim.tick % 45 === 0) sim.bus.emit("fx", { kind: "flash", x: c.x + Math.cos(c.facing) * 0.4, y: c.y + Math.sin(c.facing) * 0.4, z: 1.3, n: 1 });
      if (g.stepTimer < 9) return RUN;
      bk.done = true; bk.shotAt = sim.tick;
      for (const [a, b2] of [[c, cl], [cl, c]] as const) { remember(a, { t: sim.tick, kind: "shoot", subj: a.id, obj: b2.id, toy: null, area: sim.world.areaAt(a.x, a.y)?.id ?? 0, val: 0.5, ev: -1, src: "did" }); }
      cl.emo.mood = Math.min(1, cl.emo.mood + 0.3); cl.emo.confidence = Math.min(1, cl.emo.confidence + 0.1);
      sim.emit({ type: "photoshoot", x: c.x, y: c.y, actors: [c.id, cl.id], data: { booking: bk.id }, summary: `${c.name} shot ${cl.name}'s ${bk.label.replace(/^an? /, "")}. Photos within a week, tag @mosaicscope` });
      return DONE;
    }
    case "pose": {
      const bk = sim.bookings.find((b) => b.id === s.booking);
      if (!bk || bk.done) return DONE;
      if (!moveTo(c, s.x!, s.y!, sim, 0.6)) { c.anim.pose = "auto"; return g.stepTimer > 50 ? FAIL : RUN; }
      stop(c); c.anim.pose = sim.chars[bk.photographer] && Math.hypot(sim.chars[bk.photographer].x - c.x, sim.chars[bk.photographer].y - c.y) < 4 ? "posecool" : "phone";
      return g.stepTimer > 150 ? FAIL : RUN;
    }
    case "skate": case "busk": {
      if (s.kind === "skate") {
        c.anim.pose = "skate";
        if (!c.path || c.pathIdx * 2 >= (c.path?.length ?? 0) - 2) { const a = sim.world.areas.find((x) => x.kind === "playground")!; const p = sim.world.randomPointIn(a, sim.rng); moveTo(c, p.x, p.y, sim, 0.6, 2.2); }
        else moveTo(c, c.pathGoalX, c.pathGoalY, sim, 0.6, 2.2);
        c.needs.fun = Math.min(1, c.needs.fun + dt * 0.04);
      } else {
        if (!moveTo(c, s.x!, s.y!, sim, 0.6)) { c.anim.pose = "auto"; return RUN; }
        stop(c); c.anim.pose = "guitar";
        if (sim.tick % 50 === 0) sim.bus.emit("fx", { kind: "music", x: c.x, y: c.y, z: 1.6, n: 1, color: c.look.color });
        if (sim.tick % 300 === 0) sim.tipBusker(c);
      }
      return g.stepTimer > (s.time ?? 30) ? DONE : RUN;
    }
    case "treat": {
      const v = sim.chars[s.target!];
      if (!v || v.inside >= 0) return DONE;
      if (Math.hypot(v.x - c.x, v.y - c.y) > 1.2) { c.anim.pose = "auto"; moveTo(c, v.x, v.y, sim, 0.9, 1.8); return RUN; }
      stop(c); c.anim.pose = "comfort";
      if (g.stepTimer < 3) return RUN;
      lifeBandage(sim, c, v);
      if (v.blood < 0.45 || v.phys === 2) lifeHospital(sim, v);
      sim.say(c, sim.dialogue.bark(c, "help", v), "say", 2);
      return DONE;
    }
    case "mug": {
      // knifepoint robbery: threaten, take cash/valuables, stab if they fight back
      const v = sim.chars[s.target!];
      if (!v || v.inside >= 0 || v.inCar >= 0) return FAIL;
      if (Math.hypot(v.x - c.x, v.y - c.y) > 1.0) { c.anim.pose = "auto"; moveTo(c, v.x, v.y, sim, 0.8, 1.3); return g.stepTimer > 25 ? FAIL : RUN; }
      stop(c); c.facing = Math.atan2(v.y - c.y, v.x - c.x); c.anim.pose = "threaten";
      if (g.stepTimer < 0.4) { sim.say(c, sim.dialogue.bark(c, "mug", v), "shout", 2); v.emo.fear = Math.min(1, v.emo.fear + 0.5); v.goal = null; v.vx = v.vy = 0; return RUN; }
      if (g.stepTimer < 2) return RUN;
      const resists = v.tier !== "player" && v.pers.boldness + v.pers.temper * 0.4 > 1.05 && sim.rng.chance(0.6);
      if (resists) {
        sim.say(v, "Not a chance!", "shout", 1.5);
        sim.swingHeld(c);
        commitCrime(sim, c, "stabbing", v);
        return DONE;
      }
      const take = Math.min(v.cash, Math.max(20, Math.round(v.cash * 0.8)));
      v.cash -= take; c.cash += take;
      const loot = _carried(v).map((id) => sim.toys[id]).find((t) => t && _TOYS[t.def].category === "valuable");
      if (loot) { _detach(v, loot.id); loot.holder = c.id; loot.state = "held"; c.bag.push(loot.id); }
      if (v.tier !== "player") sim.say(v, "Take it, take it!", "shout", 1.5);
      remember(v, { t: sim.tick, kind: "robbed", subj: c.id, obj: v.id, toy: loot?.def ?? null, area: sim.world.areaAt(v.x, v.y)?.id ?? 0, val: -0.9, ev: -1, src: "did" });
      commitCrime(sim, c, "armed_robbery", v, loot?.def ?? null);
      return DONE;
    }
    case "flirt": case "kiss": {
      const o = sim.chars[s.target!];
      if (!o || o.inside >= 0 || o.inCar >= 0 || o.phys !== 0) return FAIL;
      if (Math.hypot(o.x - c.x, o.y - c.y) > 1.1) { c.anim.pose = "auto"; moveTo(c, o.x, o.y, sim, 0.8); return g.stepTimer > 25 ? FAIL : RUN; }
      stop(c); c.facing = Math.atan2(o.y - c.y, o.x - c.x);
      if (s.kind === "flirt") { if (c.talkWith >= 0) return RUN; if (s.text === "started") return DONE; if (sim.startConversation(c, o, "flirt")) { s.text = "started"; return RUN; } return FAIL; }
      c.anim.pose = "kiss"; o.anim.pose = "kiss"; o.facing = Math.atan2(c.y - o.y, c.x - o.x); o.vx = o.vy = 0;
      if (g.stepTimer < 2) return RUN;
      romanceKiss(sim, c, o);
      o.anim.pose = "auto";
      return DONE;
    }
    case "date": {
      // walk to the place with the partner following, then go in together
      const o = sim.chars[s.target!], b = sim.world.buildings[s.building!];
      if (!o || !b || o.inside >= 0 || o.jailUntil > 0) return FAIL;
      if (o.goal?.id !== "follow" || o.goal.target !== c.id) { if (o.phys === 0 && o.talkWith < 0) forceFollow(sim, o, c); }
      c.anim.pose = "auto";
      if (!moveTo(c, b.door.x + 0.5, b.door.y + 0.5, sim, 0.7)) return g.stepTimer > 60 ? FAIL : RUN;
      stop(c);
      if (Math.hypot(o.x - c.x, o.y - c.y) > 2.5) return g.stepTimer > 80 ? FAIL : RUN;
      const mins = s.minutes ?? 25;
      enterBuilding(sim, c, b, mins); enterBuilding(sim, o, b, mins);
      addLove(sim, c, o, 0.12); addLove(sim, o, c, 0.12);
      remember(c, { t: sim.tick, kind: "dated", subj: c.id, obj: o.id, toy: null, area: b.area, val: 0.6, ev: -1, src: "did" });
      remember(o, { t: sim.tick, kind: "dated", subj: o.id, obj: c.id, toy: null, area: b.area, val: 0.6, ev: -1, src: "did" });
      const home = b.kind === "house" || b.kind === "apartments";
      sim.bus.emit("fx", { kind: "heart", x: b.door.x + 0.5, y: b.door.y + 0.5, z: 1.8, n: home ? 8 : 4 });
      sim.emit({ type: home ? "night_together" : "date", x: c.x, y: c.y, actors: [c.id, o.id], summary: home ? `${c.name} and ${o.name} went back to ${b.name} together` : `${c.name} took ${o.name} on a date at ${b.name}` });
      return DONE;
    }
    case "follow": {
      const o = sim.chars[s.target!];
      if (!o || o.inside >= 0) return DONE;
      c.anim.pose = "auto";
      moveTo(c, o.x - Math.cos(o.facing) * 0.9, o.y - Math.sin(o.facing) * 0.9, sim, 0.6, 1.15);
      return g.stepTimer > (s.time ?? 60) ? DONE : RUN;
    }
    case "book": {
      const r = book(sim, c);
      return r ? DONE : FAIL;
    }
    case "trade": {
      const o = sim.chars[s.target!];
      if (!o || o.inside >= 0 || o.inCar >= 0) return FAIL;
      if (Math.hypot(o.x - c.x, o.y - c.y) > 1.5) { moveTo(c, o.x, o.y, sim, 1.1); return g.stepTimer > 20 ? FAIL : RUN; }
      return sim.npcTrade(c, o) ? DONE : FAIL;
    }
  }
  return null;
}
import { remember } from "../social/Social";
import { chooseFood } from "../mind/Mind";
import { bandage as lifeBandage, hospitalise as lifeHospital } from "../sim/Life";
import { kiss as romanceKiss, addLove } from "../sim/Romance";
import { forceGoal as _forceGoal } from "./brain";
function forceFollow(sim: Simulation, o: Character, leader: Character): void { _forceGoal(o, sim, "follow", { u: 2, target: leader.id }); }
void findWall;
import { drawGun, holster, holdsGun, isArmed, nearestFoe } from "../sim/Turf";
const TURF_TAUNTS = ["This is our street!", "Riccarton runs this!", "The Don sends his regards!", "Get off our patch!", "You lot again?!", "Nobody touches the hubcaps!"];
