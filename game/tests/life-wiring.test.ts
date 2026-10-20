import { describe, expect, it } from "vitest";
import { EVENT_DEFS } from "../src/events/defs";
import { Rng } from "../src/core/rng";
import { LIFE_SYSTEM_LABELS, newLifeSystemFlags } from "../src/debug/flags";
import { stepLifeSystems } from "../src/sim/life/index";
import { newLifeSystems } from "../src/sim/life/state";
import { applyLifeFine } from "../src/sim/Society";
import { small } from "./helpers";

const SYSTEM_KEYS = {
  sleepFatigue: "sleep", dietHunger: "diet", injuryRecovery: "injury", childhood: "childhood",
  budgetBills: "budget", savingsInterest: "savings", jobSearch: "jobSearch", payslips: "payslip",
  renting: "renting", driverLicence: "licence", vehicleCompliance: "wof", schoolExams: "school",
  friendships: "friendships", birthdaysGifts: "birthdays", councilRatesBins: "council", voting: "voting",
  gymFitness: "gym", cooking: "cooking",
} as const;

describe("life-system wiring", () => {
  it("keeps the retired licence restriction off while other life systems remain enabled", () => {
    const flags = newLifeSystemFlags();
    expect(Object.keys(flags).sort()).toEqual(Object.keys(LIFE_SYSTEM_LABELS).sort());
    expect(flags.driverLicence).toBe(false);
    expect(Object.entries(flags).filter(([key])=>key!=="driverLicence").every(([,value])=>value)).toBe(true);
    expect(Object.keys(flags)).toHaveLength(18);
  });

  it("registers the events emitted by life updates", () => {
    const types = new Set(EVENT_DEFS.map((event) => event.type));
    for (const event of [
      "life_tired", "life_exhausted", "life_rested", "life_injury_recovered", "life_growing_up",
      "life_bill", "life_interest", "life_job_reply", "life_rent_rise", "life_birthday", "life_council_rates",
      "life_bin_collection", "life_sleep_started", "life_cooked", "life_workout", "life_job_applied",
      "life_job_accepted", "life_rent_bond", "life_rent_paid", "life_rent_inspection", "life_licence_practice",
      "life_licence_test", "life_wof_renewed", "life_rego_renewed", "life_school_study", "life_school_exam",
      "life_friend_gift", "life_birthday_gift", "life_rates_paid", "life_vote", "life_payslip", "life_tax_code",
      "life_child_activity", "life_traffic_fine", "life_council_fine",
    ])
      expect(types.has(event)).toBe(true);
  });

  it("leaves each system untouched when its own switch is off", () => {
    const state = newLifeSystems();
    for (const [flag, key] of Object.entries(SYSTEM_KEYS)) {
      const flags = newLifeSystemFlags();
      flags[flag as keyof typeof flags] = false;
      const result = stepLifeSystems(state, 3600, new Rng(9), 100, 500, flags);
      expect(result.state[key]).toEqual(state[key]);
    }
  });

  it("reports household payments as cash deltas for the simulation to apply", () => {
    const budget = { ...newLifeSystems().budget, nextBill: 3600 };
    const result = stepLifeSystems({ ...newLifeSystems(), budget }, 3600, new Rng(9), 10, 0, newLifeSystemFlags());
    expect(result.events.find((event) => event.type === "life_bill")?.cashDelta).toBe(-10);
  });

  it("routes unpaid traffic fines through cash, arrears, and a review appointment", () => {
    const sim = small(9, { midCount: 0, backgroundCount: 0 });
    sim.player.cash = 10;
    applyLifeFine(sim, 120);
    expect(sim.player.cash).toBe(0);
    expect(sim.life.systems.budget.arrears).toBe(110);
    expect(sim.life.appointments.some((appointment) => appointment.kind === "citation")).toBe(true);
  });
});