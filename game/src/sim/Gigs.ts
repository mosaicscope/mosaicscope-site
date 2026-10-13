import { Rng } from "../core/rng";
import { TICKS_PER_HOUR } from "./Environment";
import { RENT_PER_DAY, RENT_CASH_SHARE, ARREARS_CAP } from "./Arrears";
import type { Simulation } from "./Simulation";
import type { Building } from "../world/World";
import type { Character } from "../entities/types";

/**
 * Town gigs and days: courier parcels, the can-collector crew, the festival and rent day.
 * The rules are small pure functions (tested on their own); GigState holds the little bit of
 * saved state and is ticked about once a second from the simulation. It draws from its own Rng so
 * it never disturbs the main random stream.
 */

// ---------------------------------------------------------------- the calendar
/** Day number from the clock (day 0 starts at the world's start hour). */
export const dayOf = (startHour: number, tick: number): number => Math.floor((startHour + tick / TICKS_PER_HOUR) / 24);
export const hourOf = (startHour: number, tick: number): number => (startHour + tick / TICKS_PER_HOUR) % 24;

export const FESTIVAL_FROM = 16;
export const FESTIVAL_TO = 23;
/** Every third day the market street fills with stalls, lanterns and music in the evening. */
export const isFestivalDay = (day: number): boolean => day % 3 === 1;
export const festivalOn = (day: number, hour: number): boolean => isFestivalDay(day) && hour >= FESTIVAL_FROM && hour < FESTIVAL_TO;

export const RENT_DUE = RENT_PER_DAY * 3;
export const RENT_FROM = 9;
export const RENT_DEADLINE = 18;
/** Rent day comes round every fourth day. */
export const isRentDay = (day: number): boolean => day % 4 === 3;

// ---------------------------------------------------------------- courier
export const MAX_PARCELS = 3;
const PICKUPS = new Set(["bakery", "cafe", "diner", "pizza", "sushi", "toyshop", "pawn", "records", "dairy", "fishchips", "gallery", "sports", "barber"]);
const DROPOFFS = new Set(["apartments", "house", "office", "hotel", "studio", "gym", "bank"]);

export interface Parcel {
  id: number; from: number; to: number;
  fromName: string; toName: string;
  fx: number; fy: number; tx: number; ty: number;
  pay: number;
  /** seconds you get before the parcel goes cold */
  limit: number;
}
export interface CourierRun { parcel: Parcel; since: number }
export interface Delivery { pay: number; seconds: number; cold: boolean; tip: boolean }

export const parcelPay = (dist: number): number => Math.round(18 + Math.max(0, dist) * 1.1);
export const parcelLimit = (dist: number): number => Math.round(25 + Math.max(0, dist) * 1.1);
/** Full pay in the first half of the time, shrinking to 40% at the limit, and a cold parcel pays a quarter. */
export function paidFor(base: number, elapsed: number, limit: number): { pay: number; cold: boolean; tip: boolean } {
  const e = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0), l = Math.max(1, Number.isFinite(limit) ? limit : 1);
  if (e > l) return { pay: Math.round((Number.isFinite(base) ? base : 0) * 0.25), cold: true, tip: false };
  if (e <= l * 0.5) return { pay: Math.round(base * 1.25), cold: false, tip: true };
  const f = 1 - 0.6 * ((e - l * 0.5) / (l * 0.5));
  return { pay: Math.round(base * f), cold: false, tip: false };
}

// ---------------------------------------------------------------- can crew
export type CrewSide = "none" | "join" | "rival";
export const CREW_NAME = "the Tin Tigers";
/** A crew round lasts four days. */
export const ROUND_DAYS = 4;
export const JOIN_BONUS = 0.2;
const hash = (n: number): number => { let x = (n ^ 0x2c1b3c6d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
/** What the Tigers haul on a given day: steady, with a bit of weather in it. */
export const rivalHaul = (seed: number, day: number): number => 5 + (hash(seed * 31 + day) % 6);
export const roundOf = (day: number): number => Math.floor(Math.max(0, day) / ROUND_DAYS);
export function rivalTally(seed: number, round: number, dayNow: number): number {
  const start = round * ROUND_DAYS;
  const last = Math.min(dayNow, start + ROUND_DAYS - 1);
  let t = 0;
  for (let d = start; d <= last; d++) t += rivalHaul(seed, d);
  return t;
}
export const crewBonusRate = (side: CrewSide): number => (side === "join" ? JOIN_BONUS : 0);
/** Cash paid when a round closes: members share the crew pot, rivals win a prize for beating the Tigers. */
export function roundPrize(side: CrewSide, mine: number, rival: number): number {
  const m = Math.max(0, Math.floor(mine || 0));
  if (side === "join") return Math.min(120, m * 2);
  if (side === "rival" && m > rival) return Math.min(400, 120 + (m - rival) * 5);
  return 0;
}

// ---------------------------------------------------------------- rent day
export function rentStress(hour: number, owed: number): number {
  if (owed <= 0 || hour < RENT_FROM || hour >= RENT_DEADLINE) return 0;
  return Math.min(1, Math.max(0, (hour - RENT_FROM) / (RENT_DEADLINE - RENT_FROM)));
}
/** Paying up: the player hands over whatever the rent needs and their cash allows. */
export const rentPayment = (owed: number, cash: number): number => Math.max(0, Math.min(Math.round(owed), Math.floor(Math.max(0, cash || 0))));
/** The deadline passes: the landlord takes at most the usual share of your cash and the rest becomes arrears. */
export function rentDeadline(owed: number, cash: number, arrears: number): { taken: number; arrears: number } {
  const o = Math.max(0, Math.round(owed || 0));
  const taken = Math.min(o, Math.floor(Math.max(0, cash || 0) * RENT_CASH_SHARE));
  return { taken, arrears: Math.min(ARREARS_CAP, Math.max(0, Math.round((arrears || 0) + o - taken))) };
}
export const rentStageLine = (hour: number): string =>
  hour < 12 ? "The landlord is going door to door." : hour < 16 ? "Landlord's on his second round. Rent is due by six." : "FINAL NOTICE. He is outside, tapping his watch.";

// ---------------------------------------------------------------- state
export interface SavedGigs {
  parcels: Parcel[]; nextId: number; delivered: number; run: CourierRun | null;
  crew: CrewSide; round: number; mine: number; rng: number[];
  rentDay: number; rentOwed: number; rentUnpaid: number; festivalDay: number;
}

export class GigState {
  parcels: Parcel[] = [];
  nextId = 1;
  delivered = 0;
  run: CourierRun | null = null;
  crew: CrewSide = "none";
  /** the crew round we're in, and the cans you've handed in during it */
  round = 0;
  mine = 0;
  /** rent day state: which day it was last set up for, what's still owed, and an unpaid sum waiting for the deadline to be settled */
  rentDay = -1;
  rentOwed = 0;
  rentUnpaid = 0;
  festivalDay = -1;
  festival = false;
  private rng: Rng;
  constructor(private seed: number) { this.rng = new Rng((seed ^ 0x6197a5) >>> 0); }

  day(sim: Simulation): number { return dayOf(sim.env.startHour, sim.tick); }

  // courier ------------------------------------------------------
  private candidates(sim: Simulation, kinds: Set<string>): Building[] { return sim.world.buildings.filter((b) => kinds.has(b.kind)); }

  private post(sim: Simulation): void {
    const from = this.candidates(sim, PICKUPS), to = this.candidates(sim, DROPOFFS);
    if (!from.length || !to.length) return;
    for (let tries = 0; tries < 6; tries++) {
      const a = this.rng.pick(from), b = this.rng.pick(to);
      const dist = Math.hypot(a.door.x - b.door.x, a.door.y - b.door.y);
      if (dist < 12 || this.parcels.some((p) => p.from === a.id) || this.run?.parcel.from === a.id) continue;
      this.parcels.push({ id: this.nextId++, from: a.id, to: b.id, fromName: a.name, toName: b.name, fx: a.door.x + 0.5, fy: a.door.y + 0.5, tx: b.door.x + 0.5, ty: b.door.y + 0.5, pay: parcelPay(dist), limit: parcelLimit(dist) });
      return;
    }
  }

  /** The posted parcel whose pickup is within `reach` of (x, y). */
  parcelNear(x: number, y: number, reach = 2): Parcel | null {
    if (this.run) return null;
    let best: Parcel | null = null, bd = reach;
    for (const p of this.parcels) { const d = Math.hypot(p.fx - x, p.fy - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  take(sim: Simulation, p: Parcel): void {
    this.parcels = this.parcels.filter((q) => q !== p);
    this.run = { parcel: p, since: sim.tick };
  }
  /** Seconds left before the current parcel goes cold (negative once it has). */
  secondsLeft(sim: Simulation): number { return this.run ? this.run.parcel.limit - (sim.tick - this.run.since) / 60 : 0; }
  /** Called with the player's position: delivers if they have arrived. */
  arrive(sim: Simulation, x: number, y: number, reach = 2.4): Delivery | null {
    const r = this.run;
    if (!r || Math.hypot(r.parcel.tx - x, r.parcel.ty - y) > reach) return null;
    const seconds = (sim.tick - r.since) / 60, got = paidFor(r.parcel.pay, seconds, r.parcel.limit);
    this.run = null; this.delivered++;
    return { pay: got.pay, seconds, cold: got.cold, tip: got.tip };
  }
  /** Drop a run that's long past cold. Returns true if it was dropped. */
  abandonStale(sim: Simulation): boolean {
    if (this.run && this.secondsLeft(sim) < -this.run.parcel.limit) { this.run = null; return true; }
    return false;
  }

  // can crew -------------------------------------------------------
  joinCrew(side: CrewSide, sim: Simulation): void { this.crew = side; this.round = roundOf(this.day(sim)); this.mine = 0; }
  noteRecycled(n: number): void { if (this.crew !== "none") this.mine += Math.max(0, Math.floor(n)); }
  rival(sim: Simulation): number { return rivalTally(this.seed, this.round, this.day(sim)); }

  // rent day -------------------------------------------------------
  /** The player pays towards today's rent. Returns what they handed over. */
  payRent(p: Character): number {
    const amt = rentPayment(this.rentOwed, p.cash);
    p.cash -= amt; this.rentOwed -= amt;
    return amt;
  }
  /** Returns (and clears) the sum left unpaid at the deadline, for the caller to settle against arrears. */
  takeUnpaid(): number { const u = this.rentUnpaid; this.rentUnpaid = 0; return u; }

  // tick -------------------------------------------------------------
  /** Once a second (called from housekeeping, so `tick` is always a multiple of 60). */
  update(sim: Simulation): void {
    const day = this.day(sim), hour = hourOf(sim.env.startHour, sim.tick);
    // parcels: keep the board stocked, let old ones go stale
    if (sim.tick % 600 === 0 && this.parcels.length < MAX_PARCELS) this.post(sim);
    if (sim.tick % 3600 === 0 && this.parcels.length > 1) this.parcels.shift();
    this.abandonStale(sim);
    const mid = { x: sim.world.size / 2, y: sim.world.size / 2 };
    // crew rounds close at midnight of the first day of the next round
    const round = roundOf(day);
    if (round > this.round) {
      if (this.crew !== "none") {
        const prize = roundPrize(this.crew, this.mine, rivalTally(this.seed, this.round, this.round * ROUND_DAYS + ROUND_DAYS - 1));
        if (prize > 0) { sim.player.cash += prize; sim.toast(this.crew === "join" ? `Crew pot: $${prize} for your ${this.mine} cans.` : `You out-hauled ${CREW_NAME}! Prize: $${prize}.`, "acid"); }
        else if (this.crew === "rival") sim.toast(`${CREW_NAME} out-hauled you this round. Rematch?`);
      }
      this.round = round; this.mine = 0;
    }
    // festival
    const on = festivalOn(day, hour);
    if (on !== this.festival) {
      this.festival = on;
      const m = sim.world.areas.find((a) => a.kind === "market");
      if (on && this.festivalDay !== day) {
        this.festivalDay = day;
        sim.emit({ type: "festival", x: m?.cx ?? mid.x, y: m?.cy ?? mid.y, summary: "Lantern festival: the market street is open late" });
        sim.litter.scatterNear(m?.cx ?? mid.x, m?.cy ?? mid.y, 18, 7);
      } else if (!on) sim.emit({ type: "festival_end", x: m?.cx ?? mid.x, y: m?.cy ?? mid.y, summary: "Festival over. The street needs a sweep." });
    }
    // rent day
    if (isRentDay(day) && this.rentDay !== day && hour >= RENT_FROM) {
      this.rentDay = day; this.rentOwed = RENT_DUE; this.rentUnpaid = 0;
      sim.emit({ type: "rent_day", x: sim.player.x, y: sim.player.y, summary: `Rent day: $${RENT_DUE} due by ${RENT_DEADLINE - 12}pm`, data: { stage: "knock" } });
    } else if (this.rentDay === day && this.rentOwed > 0) {
      if (hour >= 12 && hour < 12.05) sim.emit({ type: "rent_day", x: sim.player.x, y: sim.player.y, summary: rentStageLine(hour), data: { stage: "reminder" } });
      if (hour >= 16 && hour < 16.05) sim.emit({ type: "rent_day", x: sim.player.x, y: sim.player.y, summary: rentStageLine(hour), data: { stage: "final" } });
      if (hour >= RENT_DEADLINE) { this.rentUnpaid = this.rentOwed; this.rentOwed = 0; sim.emit({ type: "rent_day", x: sim.player.x, y: sim.player.y, summary: "Deadline. The landlord's nephew has your name.", data: { stage: "deadline" } }); }
    } else if (this.rentDay !== day && this.rentOwed > 0) {
      // the day rolled over while rent was still pending (e.g. a long pause): treat it as missed
      this.rentUnpaid += this.rentOwed; this.rentOwed = 0;
    }
  }

  serialize(): SavedGigs {
    return { parcels: this.parcels.map((p) => ({ ...p })), nextId: this.nextId, delivered: this.delivered, run: this.run ? { parcel: { ...this.run.parcel }, since: this.run.since } : null, crew: this.crew, round: this.round, mine: this.mine, rng: this.rng.getState() as number[], rentDay: this.rentDay, rentOwed: this.rentOwed, rentUnpaid: this.rentUnpaid, festivalDay: this.festivalDay };
  }
  restore(d: SavedGigs): void {
    this.parcels = d.parcels.map((p) => ({ ...p })); this.nextId = d.nextId; this.delivered = d.delivered;
    this.run = d.run ? { parcel: { ...d.run.parcel }, since: d.run.since } : null;
    this.crew = d.crew; this.round = d.round; this.mine = d.mine;
    this.rentDay = d.rentDay; this.rentOwed = d.rentOwed; this.rentUnpaid = d.rentUnpaid; this.festivalDay = d.festivalDay;
    this.rng.setState(d.rng as [number, number, number, number]);
  }
}
