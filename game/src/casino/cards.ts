import { Rng } from "../core/rng";

export type Suit = "♠" | "♥" | "♦" | "♣";
export interface Card { rank: number; suit: Suit } // rank 2..14 (11 J, 12 Q, 13 K, 14 A)
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ["J", "Q", "K", "A"][r - 11]);
export const isRed = (c: Card) => c.suit === "♥" || c.suit === "♦";
export const cardName = (c: Card) => rankLabel(c.rank) + c.suit;

export function deck(): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) out.push({ rank, suit });
  return out;
}

/** Fisher–Yates with the game's seeded RNG (or Math.random for live play). */
export function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** A dealing shoe with a cut card. */
export class Shoe {
  cards: Card[] = [];
  private cut = 0;
  dealt = 0;
  constructor(public decks: number, private rnd: () => number, public penetration = 0.75) { this.reshuffle(); }
  reshuffle(): void {
    this.cards = [];
    for (let i = 0; i < this.decks; i++) this.cards.push(...deck());
    shuffle(this.cards, this.rnd);
    this.cut = Math.floor(this.cards.length * this.penetration);
    this.dealt = 0;
  }
  get needsShuffle(): boolean { return this.dealt >= this.cut; }
  draw(): Card { if (this.dealt >= this.cards.length) this.reshuffle(); return this.cards[this.dealt++]; }
  get remaining(): number { return this.cards.length - this.dealt; }
}

export const rngFn = (r: Rng) => () => r.next();
