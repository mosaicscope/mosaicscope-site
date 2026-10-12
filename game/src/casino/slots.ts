/**
 * "Kiwi Gold" pokie: 3 reels x 1 payline, weighted reel strips. The return-to-player is computed
 * exactly by enumerating every stop combination (see `rtp()`), and tested: 92.54%, typical of a
 * pub pokie in New Zealand (the legal minimum there is 87%).
 */
export const SYMBOLS = ["🍒", "🍋", "🔔", "🥝", "BAR", "7", "💎"] as const;
export type Sym = (typeof SYMBOLS)[number];

/** Symbol counts per reel strip (each reel has the same 32-stop strip). */
export const STRIP: Record<Sym, number> = { "🍒": 5, "🍋": 8, "🔔": 7, "🥝": 5, "BAR": 4, "7": 2, "💎": 1 };
export const REEL: Sym[] = (Object.entries(STRIP) as [Sym, number][]).flatMap(([s, n]) => Array(n).fill(s));

/** Pays for 3 of a kind, plus cherry consolation pays (left to right). Multipliers of the bet. */
export const PAYS: { label: string; match: (r: Sym[]) => boolean; mult: number }[] = [
  { label: "💎 💎 💎", match: (r) => r.every((s) => s === "💎"), mult: 1000 },
  { label: "7 7 7", match: (r) => r.every((s) => s === "7"), mult: 200 },
  { label: "BAR BAR BAR", match: (r) => r.every((s) => s === "BAR"), mult: 50 },
  { label: "🥝 🥝 🥝", match: (r) => r.every((s) => s === "🥝"), mult: 26 },
  { label: "🔔 🔔 🔔", match: (r) => r.every((s) => s === "🔔"), mult: 20 },
  { label: "🍋 🍋 🍋", match: (r) => r.every((s) => s === "🍋"), mult: 12 },
  { label: "🍒 🍒 🍒", match: (r) => r.every((s) => s === "🍒"), mult: 10 },
  { label: "🍒 🍒 any", match: (r) => r[0] === "🍒" && r[1] === "🍒", mult: 4 },
  { label: "🍒 any any", match: (r) => r[0] === "🍒", mult: 1 },
];

export function payFor(r: Sym[]): { mult: number; label: string } {
  for (const p of PAYS) if (p.match(r)) return { mult: p.mult, label: p.label };
  return { mult: 0, label: "" };
}

export function spinReels(rnd: () => number): Sym[] {
  return [0, 1, 2].map(() => REEL[Math.floor(rnd() * REEL.length)]);
}

/** Exact return-to-player over all 32^3 equally likely outcomes. */
export function rtp(): number {
  let total = 0;
  const n = REEL.length;
  for (const a of REEL) for (const b of REEL) for (const c of REEL) total += payFor([a, b, c]).mult;
  return total / (n * n * n);
}
