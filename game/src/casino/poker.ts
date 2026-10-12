import { Card, Shoe } from "./cards";

/**
 * Video poker: Jacks or Better, "9/6" full-pay table (99.54% return with perfect play).
 * Single 52-card deck reshuffled every hand. Five-coin max bet pays 800 for a royal flush.
 */
export type PokerHand = "Royal Flush" | "Straight Flush" | "Four of a Kind" | "Full House" | "Flush" | "Straight" | "Three of a Kind" | "Two Pair" | "Jacks or Better" | "Nothing";
export const PAYTABLE: Record<PokerHand, number[]> = {
  "Royal Flush": [250, 500, 750, 1000, 4000],
  "Straight Flush": [50, 100, 150, 200, 250],
  "Four of a Kind": [25, 50, 75, 100, 125],
  "Full House": [9, 18, 27, 36, 45],
  "Flush": [6, 12, 18, 24, 30],
  "Straight": [4, 8, 12, 16, 20],
  "Three of a Kind": [3, 6, 9, 12, 15],
  "Two Pair": [2, 4, 6, 8, 10],
  "Jacks or Better": [1, 2, 3, 4, 5],
  "Nothing": [0, 0, 0, 0, 0],
};

export function evaluate(cards: Card[]): PokerHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const uniq = [...counts.keys()].sort((a, b) => a - b);
  const wheel = uniq.length === 5 && uniq.join() === "2,3,4,5,14";
  const straight = uniq.length === 5 && (uniq[4] - uniq[0] === 4 || wheel);
  if (straight && flush) return uniq[0] === 10 ? "Royal Flush" : "Straight Flush";
  if (groups[0] === 4) return "Four of a Kind";
  if (groups[0] === 3 && groups[1] === 2) return "Full House";
  if (flush) return "Flush";
  if (straight) return "Straight";
  if (groups[0] === 3) return "Three of a Kind";
  if (groups[0] === 2 && groups[1] === 2) return "Two Pair";
  if (groups[0] === 2) { const pair = [...counts.entries()].find(([, n]) => n === 2)![0]; return pair >= 11 ? "Jacks or Better" : "Nothing"; }
  return "Nothing";
}

export class VideoPoker {
  shoe: Shoe;
  hand: Card[] = [];
  held = [false, false, false, false, false];
  coins = 1; coinValue = 1;
  phase: "bet" | "draw" | "done" = "bet";
  result: PokerHand = "Nothing";
  constructor(rnd: () => number) { this.shoe = new Shoe(1, rnd, 0); }
  /** Returns money taken. */
  deal(coins: number, coinValue: number): number {
    this.coins = Math.max(1, Math.min(5, coins)); this.coinValue = coinValue;
    this.shoe.reshuffle();
    this.hand = [0, 1, 2, 3, 4].map(() => this.shoe.draw());
    this.held = [false, false, false, false, false];
    this.phase = "draw"; this.result = evaluate(this.hand);
    return this.coins * this.coinValue;
  }
  toggle(i: number): void { if (this.phase === "draw") this.held[i] = !this.held[i]; }
  /** Returns money paid out. */
  draw(): number {
    if (this.phase !== "draw") return 0;
    this.hand = this.hand.map((c, i) => (this.held[i] ? c : this.shoe.draw()));
    this.result = evaluate(this.hand);
    this.phase = "done";
    return PAYTABLE[this.result][this.coins - 1] * this.coinValue;
  }
}
