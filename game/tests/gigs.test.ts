import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import {
  paidFor, parcelPay, parcelLimit, festivalOn, isFestivalDay, isRentDay, rivalHaul, rivalTally, roundPrize, crewBonusRate,
  rentStress, rentPayment, rentDeadline, RENT_DUE, dayOf, ROUND_DAYS, GigState,
} from "../src/sim/Gigs";
import { ARREARS_CAP } from "../src/sim/Arrears";
import { cashIn } from "../src/sim/Litter";
import { serialize, restore } from "../src/persistence/SaveSystem";

describe("courier pay", () => {
  it("pays a tip when fast, shrinks to 40% at the limit, and a quarter once cold", () => {
    expect(paidFor(40, 0, 60)).toEqual({ pay: 50, cold: false, tip: true });
    expect(paidFor(40, 30, 60).pay).toBe(50);
    expect(paidFor(40, 60, 60)).toEqual({ pay: 16, cold: false, tip: false });
    expect(paidFor(40, 61, 60)).toEqual({ pay: 10, cold: true, tip: false });
  });
  it("is monotone non-increasing in elapsed time and never NaN", () => {
    let last = Infinity;
    for (let e = 0; e <= 90; e += 3) { const v = paidFor(40, e, 60).pay; expect(v).toBeLessThanOrEqual(last); last = v; }
    expect(Number.isFinite(paidFor(40, NaN, NaN).pay)).toBe(true);
  });
  it("longer trips pay more and give more time", () => {
    expect(parcelPay(40)).toBeGreaterThan(parcelPay(15));
    expect(parcelLimit(40)).toBeGreaterThan(parcelLimit(15));
  });
});

describe("festival and rent day calendar", () => {
  it("festival runs 16:00 to 23:00 on every third day only", () => {
    expect(isFestivalDay(1) && isFestivalDay(4) && !isFestivalDay(2)).toBe(true);
    expect(festivalOn(1, 15.9)).toBe(false); expect(festivalOn(1, 16)).toBe(true); expect(festivalOn(1, 22.9)).toBe(true); expect(festivalOn(1, 23)).toBe(false);
    expect(festivalOn(2, 20)).toBe(false);
  });
  it("rent day comes every fourth day", () => { expect([0, 1, 2, 3, 7, 11].filter(isRentDay)).toEqual([3, 7, 11]); });
  it("stress climbs from 9 to 18 and only while rent is owed", () => {
    expect(rentStress(8, 100)).toBe(0); expect(rentStress(13.5, 100)).toBeCloseTo(0.5); expect(rentStress(17.9, 100)).toBeGreaterThan(0.95); expect(rentStress(18, 100)).toBe(0); expect(rentStress(15, 0)).toBe(0);
  });
});

describe("rent day money", () => {
  it("pays what you can and never more than is owed", () => {
    expect(rentPayment(135, 500)).toBe(135); expect(rentPayment(135, 50)).toBe(50); expect(rentPayment(135, -5)).toBe(0); expect(rentPayment(0, 100)).toBe(0);
  });
  it("at the deadline takes at most 40% of cash and the rest becomes capped arrears", () => {
    expect(rentDeadline(135, 100, 0)).toEqual({ taken: 40, arrears: 95 });
    expect(rentDeadline(135, 1000, 0)).toEqual({ taken: 135, arrears: 0 });
    expect(rentDeadline(135, 0, ARREARS_CAP).arrears).toBe(ARREARS_CAP);
    for (const [o, c, a] of [[NaN, NaN, NaN], [-5, -5, -5]] as const) { const r = rentDeadline(o, c, a); expect(r.taken).toBeGreaterThanOrEqual(0); expect(Number.isFinite(r.arrears)).toBe(true); }
  });
});

describe("can crew", () => {
  it("the Tigers haul a steady, deterministic amount", () => {
    for (let d = 0; d < 30; d++) { const v = rivalHaul(3, d); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThanOrEqual(10); }
    expect(rivalHaul(3, 5)).toBe(rivalHaul(3, 5));
    expect(rivalTally(3, 0, ROUND_DAYS - 1)).toBeGreaterThan(rivalTally(3, 0, 0));
    expect(rivalTally(3, 0, 99)).toBe(rivalTally(3, 0, ROUND_DAYS - 1)); // the round stops counting when it ends
  });
  it("members share a pot, rivals need to win, and prizes are capped", () => {
    expect(roundPrize("none", 50, 0)).toBe(0);
    expect(roundPrize("join", 10, 99)).toBe(20); expect(roundPrize("join", 500, 0)).toBe(120);
    expect(roundPrize("rival", 30, 30)).toBe(0); expect(roundPrize("rival", 40, 30)).toBe(170); expect(roundPrize("rival", 9999, 0)).toBe(400);
    expect(crewBonusRate("join")).toBeGreaterThan(0); expect(crewBonusRate("rival")).toBe(0);
  });
});

describe("gigs in the simulation", () => {
  it("posts parcels between real doors and delivers them for pay", () => {
    const sim = small(3);
    for (let i = 0; i < 6; i++) { sim.tick = 600 * (i + 1); sim.gigs.update(sim); }
    expect(sim.gigs.parcels.length).toBeGreaterThan(0);
    const par = sim.gigs.parcels[0];
    expect(sim.world.buildings[par.from].name).toBe(par.fromName);
    expect(sim.gigs.parcelNear(par.fx, par.fy)).toBe(par);
    sim.gigs.take(sim, par);
    expect(sim.gigs.run?.parcel).toBe(par);
    expect(sim.gigs.arrive(sim, par.fx, par.fy)).toBeNull(); // not there yet
    sim.tick += 60 * 5;
    const d = sim.gigs.arrive(sim, par.tx, par.ty)!;
    expect(d.pay).toBeGreaterThan(0); expect(d.cold).toBe(false);
    expect(sim.gigs.run).toBeNull(); expect(sim.gigs.delivered).toBe(1);
  });
  it("runs rent day: due at 9, pay-able, unpaid sum handed over at 18:00 exactly once", () => {
    const sim = small(3);
    const g = sim.gigs, start = sim.env.startHour;
    const at = (day: number, hour: number) => { sim.tick = Math.round(((day * 24 + hour) - start) * 3600); g.update(sim); };
    at(3, 8.9); expect(g.rentOwed).toBe(0);
    at(3, 9); expect(g.rentOwed).toBe(RENT_DUE);
    sim.player.cash = 1000; expect(g.payRent(sim.player)).toBe(RENT_DUE); expect(sim.player.cash).toBe(1000 - RENT_DUE); expect(g.rentOwed).toBe(0);
    at(3, 18); expect(g.takeUnpaid()).toBe(0);
    at(7, 9); at(7, 18); expect(g.takeUnpaid()).toBe(RENT_DUE); expect(g.takeUnpaid()).toBe(0);
  });
  it("opens the festival in the evening, litters the market and closes it later", () => {
    const sim = small(3);
    const g = sim.gigs, start = sim.env.startHour;
    const at = (day: number, hour: number) => { sim.tick = Math.round(((day * 24 + hour) - start) * 3600); g.update(sim); };
    const before = sim.litter.uncollected;
    at(1, 15); expect(g.festival).toBe(false);
    at(1, 16); expect(g.festival).toBe(true); expect(sim.litter.uncollected).toBeGreaterThanOrEqual(before);
    at(1, 23); expect(g.festival).toBe(false);
    expect(dayOf(start, sim.tick)).toBe(1);
  });
  it("pays a crew prize when the round closes, and members earn a recycling bonus", () => {
    const sim = small(3);
    const g = sim.gigs; sim.player.cash = 0;
    g.joinCrew("join", sim);
    sim.player.scrap = { can: 4, bottle: 0 };
    const r = cashIn(sim, sim.player);
    expect(r.crew).toBeGreaterThan(0); expect(g.mine).toBe(4);
    sim.tick = Math.round((ROUND_DAYS * 24 - sim.env.startHour) * 3600) + 3600; g.update(sim);
    expect(sim.player.cash).toBeGreaterThanOrEqual(r.total + 8);
    expect(g.mine).toBe(0);
  });
  it("survives a save and load", () => {
    const sim = small(3);
    for (let i = 1; i <= 4; i++) { sim.tick = 600 * i; sim.gigs.update(sim); }
    sim.gigs.joinCrew("rival", sim); sim.gigs.mine = 7;
    const copy = restore(JSON.parse(JSON.stringify(serialize(sim, "t"))));
    expect(copy.gigs.serialize()).toEqual(sim.gigs.serialize());
    expect(new GigState(3).serialize().crew).toBe("none");
  });
});
