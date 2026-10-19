import type { Rng } from "../../core/rng";
import type { LifeSystemFlags } from "../../debug/flags";
import type { LifeSystemsState } from "./state";
import type { LifeEvent } from "./types";
import * as sleep from "./sleep";
import * as diet from "./diet";
import * as injury from "./injury";
import * as childhood from "./childhood";
import * as budget from "./budget";
import * as savings from "./savings";
import * as jobSearch from "./jobSearch";
import * as payslip from "./payslip";
import * as renting from "./renting";
import * as licence from "./licence";
import * as vehicleCompliance from "./vehicleCompliance";
import * as school from "./school";
import * as friendships from "./friendships";
import * as birthdays from "./birthdays";
import * as council from "./council";
import * as voting from "./voting";
import * as gym from "./gym";
import * as cooking from "./cooking";

export function stepLifeSystems(
  state: LifeSystemsState,
  tick: number,
  rng: Rng,
  cash: number,
  savingsBalance: number,
  flags: LifeSystemFlags,
  driving = false,
  treated = false,
): { state: LifeSystemsState; events: LifeEvent[] } {
  const next = { ...state };
  const events: LifeEvent[] = [];
  const add = (result: { state: unknown; events?: LifeEvent[] }, key: keyof LifeSystemsState) => {
    (next as unknown as Record<string, unknown>)[key] = result.state;
    events.push(...(result.events ?? []));
  };
  if (flags.sleepFatigue) add(sleep.step(state.sleep, tick, rng), "sleep");
  if (flags.dietHunger) add(diet.step(state.diet, tick, rng), "diet");
  if (flags.injuryRecovery) add(injury.step(state.injury, tick, rng, treated), "injury");
  if (flags.childhood) add(childhood.step(state.childhood, tick, rng), "childhood");
  if (flags.budgetBills) add(budget.step(state.budget, tick, rng, cash, state.renting.bondPaid ? state.renting.weeklyRent : 0), "budget");
  if (flags.savingsInterest) {
    const result = savings.step(state.savings, tick, rng, savingsBalance);
    next.savings = result.state;
    events.push(...result.events);
  }
  if (flags.jobSearch) add(jobSearch.step(state.jobSearch, tick, rng), "jobSearch");
  if (flags.payslips) add(payslip.step(state.payslip, tick, rng), "payslip");
  if (flags.renting) add(renting.step(state.renting, tick, rng), "renting");
  if (flags.driverLicence) add(licence.step(state.licence, tick, rng), "licence");
  if (flags.vehicleCompliance) add(vehicleCompliance.step(state.wof, tick, rng, driving), "wof");
  if (flags.schoolExams) add(school.step(state.school, tick, rng), "school");
  if (flags.friendships) add(friendships.step(state.friendships, tick, rng), "friendships");
  if (flags.birthdaysGifts) add(birthdays.step(state.birthdays, tick, rng), "birthdays");
  if (flags.councilRatesBins) add(council.step(state.council, tick, rng), "council");
  if (flags.voting) add(voting.step(state.voting, tick, rng), "voting");
  if (flags.gymFitness) add(gym.step(state.gym, tick, rng), "gym");
  if (flags.cooking) add(cooking.step(state.cooking, tick, rng), "cooking");
  return { state: next, events };
}

export { sleep, diet, injury, childhood, budget, savings, jobSearch, payslip, renting, licence, vehicleCompliance, school, friendships, birthdays, council, voting, gym, cooking };