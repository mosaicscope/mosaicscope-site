import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import { raiseCue } from "./Pursuit";
import { mappedDrivingLimit } from "./MappedTraffic";
import { wealthTier } from "./Wealth";

/**
 * Lived-in police, adapted from cop_life / cop_ai_engine and layered on the existing Society + Pursuit systems
 * (no second wanted system): officer quirks and idle talk, speeding warnings/tickets, and eyewitness-style
 * recognition (a changed outfit or car makes you harder to pick out while wanted). Runtime-only, nothing is saved.
 */
const QUIRKS = [
  { mercy: -0.3, lines: ["Seatbelt, signal, speed. It is not hard.", "Another form in triplicate."] },
  { mercy: 0, lines: ["Twenty minutes to end of shift...", "Is it Friday yet?"] },
  { mercy: 0, lines: ["Big night. Could be the one.", "Keeping my eyes peeled."] },
  { mercy: 0.2, lines: ["Did you see the game last night?", "My cousin opened a food truck, you have to try it."] },
  { mercy: 0, lines: ["Fourth cup. Do not judge me.", "Station coffee is a crime in itself."] },
  { mercy: 0.2, lines: ["Got my kid's recital at six.", "Promised I would be home for dinner."] },
  { mercy: 0, lines: ["Habit. I check every doorway.", "Quiet. Too quiet."] },
  { mercy: 0.5, lines: ["Most people are just having a bad day.", "Hope everyone gets home okay."] },
  { mercy: 0, lines: ["Did you see that car circle the block?", "Something is off tonight."] },
];
const RADIO = ["Copy, dispatch. Show me clear.", "Dispatch, all quiet on foot patrol.", "Unit checking in, nothing to report."];
interface State { nextBark: number; spoke: Map<number, number>; speedFor: number; lastTicket: number; suspect: { look: string; car: string } | null }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { nextBark: 0, spoke: new Map(), speedFor: 0, lastTicket: -1e9, suspect: null }); return s; };

function signature(sim: Simulation): { look: string; car: string } {
  const p = sim.player, l = p.look, v = p.inCar >= 0 ? sim.vehicles[p.inCar] : undefined;
  return { look: [l.hat, l.top, l.color, l.accent, l.bottom].join("|"), car: v ? String(v.cls) : "" };
}

/** Multiplier on how far officers can pick you out: 1 normally, lower once you've changed clothes or car since the crime. */
export function disguiseFactor(sim: Simulation): number {
  const s = states.get(sim); if (!s?.suspect) return 1;
  const now = signature(sim); let f = 1;
  if (now.look !== s.suspect.look) f *= 0.75;
  if (now.car !== s.suspect.car) f *= 0.7;
  return Math.max(0.5, f);
}

export function updateCopLife(sim: Simulation): void {
  if (sim.tick % 30 !== 7) return;
  const s = state(sim), p = sim.player;
  if (p.wanted > 0) { s.suspect ??= signature(sim); s.speedFor = 0; return; }
  s.suspect = null;
  if (p.inside >= 0 || p.jailUntil > 0) return;
  const cops = sim.chars.filter((c) => c.role === "cop" && c.phys === Phys.OK && c.pursuing < 0 && c.jailUntil <= 0 && c.inside < 0 && Math.hypot(c.x - p.x, c.y - p.y) < 16);
  if (!cops.length) { s.speedFor = 0; return; }

  // idle talk: one nearby officer on foot says something in character now and then
  if (sim.tick >= s.nextBark) {
    s.nextBark = sim.tick + Math.round(60 * sim.rng.range(8, 20));
    const c = cops.find((k) => k.inCar < 0 && k.talkWith < 0 && Math.hypot(k.x - p.x, k.y - p.y) < 12 && !(k.bubble && k.bubble.until > sim.tick) && sim.tick - (s.spoke.get(k.id) ?? -1e9) > 2700);
    if (c) {
      s.spoke.set(c.id, sim.tick);
      const q = QUIRKS[c.id % QUIRKS.length];
      sim.say(c, sim.rng.next() < 0.25 ? RADIO[Math.floor(sim.rng.next() * RADIO.length)] : q.lines[Math.floor(sim.rng.next() * q.lines.length)], "say", 3);
    }
  }

  // reckless speeding in sight of an officer: warning or ticket, then trouble if you keep it up
  const car = p.inCar >= 0 ? sim.vehicles[p.inCar] : undefined;
  if (!car) { s.speedFor = 0; return; }
  const limit = mappedDrivingLimit(sim, car);
  const watcher = cops.find((c) => sim.world.lineOfSight(c.x, c.y, p.x, p.y));
  if (!Number.isFinite(limit) || !watcher || Math.abs(car.speed) <= limit * 1.6 + 1.5) { s.speedFor = Math.max(0, s.speedFor - 1); return; }
  s.speedFor += 0.5;
  if (s.speedFor < 2) return;
  s.speedFor = 0;
  if (sim.tick - s.lastTicket < 600) {   // still at it right after a ticket
    p.wanted = Math.max(p.wanted, 1); sim.lastSeenByCops = sim.tick;
    sim.say(watcher, "Stop that car!", "shout", 2); raiseCue(sim, "ticket", "Failed to stop", "The officer is giving chase");
    return;
  }
  if (sim.tick - s.lastTicket < 5400) return;
  s.lastTicket = sim.tick;
  if (sim.rng.next() < 0.35 + QUIRKS[watcher.id % QUIRKS.length].mercy + wealthTier(sim) * 0.05) {
    sim.say(watcher, "Slow down, alright? I'll let it go this time.", "say", 3); raiseCue(sim, "ticket", "Warning", "Slow down");
  } else {
    const fine = Math.min(p.cash, Math.round(sim.rng.range(60, 140))); p.cash -= fine;
    sim.say(watcher, "Here's your ticket. Drive safe.", "say", 3); raiseCue(sim, "ticket", "Speeding ticket", "-$" + fine);
  }
}
