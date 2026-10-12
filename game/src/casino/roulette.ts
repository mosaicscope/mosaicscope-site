/**
 * European roulette: single zero, 37 pockets, house edge 2.70% on every bet.
 * Bets are defined by the set of numbers they cover; payout = 36 / count - 1 (so 35:1, 17:1, 11:1,
 * 8:1, 5:1, 2:1, 1:1), which is exactly the real table.
 */
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number): "green" | "red" | "black" => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");

export interface RouletteBet { id: string; label: string; numbers: number[]; amount: number }

export const payoutFor = (numbers: number[]) => 36 / numbers.length - 1;

export const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const OUTSIDE: Record<string, { label: string; numbers: number[] }> = {
  red: { label: "Red", numbers: range(1, 36).filter((n) => REDS.has(n)) },
  black: { label: "Black", numbers: range(1, 36).filter((n) => !REDS.has(n)) },
  odd: { label: "Odd", numbers: range(1, 36).filter((n) => n % 2 === 1) },
  even: { label: "Even", numbers: range(1, 36).filter((n) => n % 2 === 0) },
  low: { label: "1–18", numbers: range(1, 18) },
  high: { label: "19–36", numbers: range(19, 36) },
  d1: { label: "1st 12", numbers: range(1, 12) },
  d2: { label: "2nd 12", numbers: range(13, 24) },
  d3: { label: "3rd 12", numbers: range(25, 36) },
  c1: { label: "Column 1", numbers: range(1, 36).filter((n) => n % 3 === 1) },
  c2: { label: "Column 2", numbers: range(1, 36).filter((n) => n % 3 === 2) },
  c3: { label: "Column 3", numbers: range(1, 36).filter((n) => n % 3 === 0) },
};

/** Inside bets by type, validated against the real table layout (3 columns x 12 rows). */
export function insideBet(kind: "straight" | "split" | "street" | "corner" | "line", n: number, n2?: number): number[] | null {
  const col = (x: number) => (x - 1) % 3, row = (x: number) => Math.floor((x - 1) / 3);
  if (kind === "straight") return n >= 0 && n <= 36 ? [n] : null;
  if (kind === "split") {
    if (n2 === undefined || n < 0 || n2 < 0 || n > 36 || n2 > 36) return null;
    if (n === 0 || n2 === 0) return [1, 2, 3].includes(n + n2) ? [n, n2].sort((a, b) => a - b) : null;
    const adj = (row(n) === row(n2) && Math.abs(n - n2) === 1) || (col(n) === col(n2) && Math.abs(n - n2) === 3);
    return adj ? [n, n2].sort((a, b) => a - b) : null;
  }
  if (kind === "street") { const s = row(n) * 3 + 1; return n >= 1 && n <= 36 ? [s, s + 1, s + 2] : null; }
  if (kind === "corner") { if (n < 1 || n > 32 || col(n) === 2) return null; return [n, n + 1, n + 3, n + 4]; }
  if (kind === "line") { const s = row(n) * 3 + 1; return n >= 1 && s + 5 <= 36 ? range(s, s + 5) : null; }
  return null;
}

export function spin(rnd: () => number): number { return Math.floor(rnd() * 37); }

/** Total returned (stake + winnings) for all bets on a result. */
export function settle(bets: RouletteBet[], result: number): number {
  let back = 0;
  for (const b of bets) if (b.numbers.includes(result)) back += b.amount * (payoutFor(b.numbers) + 1);
  return back;
}
