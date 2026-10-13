/**
 * Rent arrears: when you stay away, the rent keeps running. What your cash can't cover (at most 40% of
 * it is taken at once) is no longer forgiven; it becomes arrears that grow slowly with interest and are
 * collected from your next winnings. Pure and deterministic: no randomness, no clock, no storage.
 * Consequences have weight but never trap you: the debt is capped, and collection leaves you most of
 * your cash.
 */
export const RENT_PER_DAY = 45;
/** Share of cash the landlord can take in one go, and the share the collector can take per visit. */
export const RENT_CASH_SHARE = 0.4;
export const COLLECT_CASH_SHARE = 0.3;
/** Daily interest on arrears, and the hard ceiling on what can ever be owed. */
export const ARREARS_INTEREST = 0.015;
export const ARREARS_CAP = 1500;

export interface AbsenceBill { rent: number; paid: number; arrears: number }

const money = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

/** Rent due for `days` away, how much of it `cash` covers now, and the new arrears balance. */
export function billAbsence(days: number, cash: number, arrears = 0): AbsenceBill {
  const d = Math.min(30, Math.max(0, Number.isFinite(days) ? days : 0));
  const rent = money(d * RENT_PER_DAY);
  const paid = Math.min(rent, money(Math.max(0, cash) * RENT_CASH_SHARE));
  const grown = money(arrears) * Math.pow(1 + ARREARS_INTEREST, d);
  return { rent, paid, arrears: Math.min(ARREARS_CAP, money(grown + (rent - paid))) };
}

/** A collector's visit: takes up to a share of `cash` towards `arrears`, and never more than `room`. */
export function collect(cash: number, arrears: number, room = Infinity): { taken: number; left: number } {
  const owed = money(arrears);
  const taken = Math.min(owed, money(Math.max(0, cash) * COLLECT_CASH_SHARE), money(Number.isNaN(room) ? 0 : Math.min(room, 1e12)));
  return { taken, left: owed - taken };
}
