import { newSleepState, type SleepState } from "./sleep";
import { BUDGET } from "../../content/life/budget";
import { RENTING } from "../../content/life/renting";
import { VEHICLE_COMPLIANCE } from "../../content/life/vehicleCompliance";
import { SCHOOL } from "../../content/life/school";
import { FRIENDSHIPS } from "../../content/life/friendships";
import { VOTING } from "../../content/life/voting";
import { GYM } from "../../content/life/gym";
import { COOKING } from "../../content/life/cooking";
import { LICENCE } from "../../content/life/licence";
import { PAYSLIP } from "../../content/life/payslip";

export interface LifeSystemsState {
  sleep: SleepState;
  diet: { hunger: number; weight: number; foodQuality: number; lastTick: number };
  injury: { sprain: number; scar: number; lastTick: number; injuredAt: number };
  childhood: { ageDays: number; stage: "child" | "teen" | "adult"; schoolDays: number; sportSessions: number; friendVisits: number; bedtimeUntil: number; lastTick: number };
  budget: { nextBill: number; arrears: number };
  savings: { lastInterest: number };
  jobSearch: { applications: number; nextReply: number; message: string };
  payslip: { gross: number; tax: number; net: number; sickLeave: number; taxCode: "M" | "S" };
  renting: { bondPaid: boolean; weeklyRent: number; lastInspection: number; nextRise: number };
  licence: { stage: "learner" | "restricted" | "full"; practiceHours: number; demerits: number; lastPractice: number };
  wof: { expires: number; regoExpires: number; citations: number; lastCitation: number };
  school: { credits: number; grade: number; lastStudy: number };
  friendships: { gifts: number; lastGift: number };
  birthdays: { lastDay: number; giftsReceived: number };
  council: { ratesDue: number; binDay: number; fines: number };
  voting: { lastElection: number; votes: number };
  gym: { fitness: number; lastWorkout: number };
  cooking: { meals: number; lastCook: number; quality: number };
}

export const newLifeSystems = (): LifeSystemsState => ({
  sleep: newSleepState(),
  diet: { hunger: 1, weight: 70, foodQuality: 0.5, lastTick: 0 },
  injury: { sprain: 0, scar: 0, lastTick: 0, injuredAt: -1 },
  childhood: { ageDays: 0, stage: "child", schoolDays: 0, sportSessions: 0, friendVisits: 0, bedtimeUntil: 0, lastTick: 0 },
  budget: { nextBill: BUDGET.billPeriodTicks, arrears: 0 },
  savings: { lastInterest: 0 },
  jobSearch: { applications: 0, nextReply: 0, message: "" },
  payslip: { gross: 0, tax: 0, net: 0, sickLeave: PAYSLIP.sickLeaveDays, taxCode: "M" },
  renting: { bondPaid: false, weeklyRent: RENTING.baseWeeklyRent, lastInspection: 0, nextRise: RENTING.riseTicks },
  licence: { stage: "learner", practiceHours: 0, demerits: 0, lastPractice: -LICENCE.practiceCooldown },
  wof: { expires: VEHICLE_COMPLIANCE.renewalTicks, regoExpires: VEHICLE_COMPLIANCE.renewalTicks, citations: 0, lastCitation: -24 * 3600 },
  school: { credits: 0, grade: 0, lastStudy: -SCHOOL.studyCooldown },
  friendships: { gifts: 0, lastGift: -FRIENDSHIPS.giftCooldown },
  birthdays: { lastDay: 0, giftsReceived: 0 },
  council: { ratesDue: 0, binDay: 0, fines: 0 },
  voting: { lastElection: -VOTING.electionPeriod, votes: 0 },
  gym: { fitness: 0.5, lastWorkout: -GYM.cooldown },
  cooking: { meals: 0, lastCook: -COOKING.cooldown, quality: 0.5 },
});