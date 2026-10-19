import { RENTING } from "./renting";

export const BUDGET = { rent: RENTING.baseWeeklyRent, power: 45, phone: 20, groceries: 120, billPeriodTicks: 7 * 24 * 3600, arrearsCap: 1500 } as const;