import { Card, Shoe } from "./cards";

/**
 * Blackjack, Vegas-Strip-style rules as dealt in most NZ casinos:
 * 6 decks, cut card at 75%, dealer stands on soft 17 (S17), blackjack pays 3:2, double on any first two
 * cards, double after split allowed, split up to 4 hands, split aces get one card each and can't be
 * resplit, insurance pays 2:1 when the dealer shows an ace, late surrender returns half the bet.
 * Dealer peeks for blackjack with an ace or ten up (so you never lose doubles/splits to a dealer BJ).
 */
export interface Hand { cards: Card[]; bet: number; doubled: boolean; fromSplit: boolean; splitAces: boolean; done: boolean; surrendered: boolean; result?: "win" | "lose" | "push" | "blackjack" | "surrender"; payout?: number }

export const cardValue = (c: Card) => (c.rank === 14 ? 11 : c.rank >= 10 ? 10 : c.rank);

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c); if (c.rank === 14) aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

export type Phase = "betting" | "insurance" | "player" | "dealer" | "settled";

export class Blackjack {
  shoe: Shoe;
  dealer: Card[] = [];
  hands: Hand[] = [];
  active = 0;
  phase: Phase = "betting";
  insurance = 0;
  holeRevealed = false;
  log: string[] = [];
  readonly min = 5; readonly max = 500; readonly maxHands = 4;

  constructor(rnd: () => number, decks = 6) { this.shoe = new Shoe(decks, rnd); }

  /** Start a round. Returns the money taken from the player (the bet). */
  deal(bet: number): number {
    if (this.phase !== "betting" && this.phase !== "settled") throw new Error("Round in progress");
    if (bet < this.min || bet > this.max) throw new Error(`Table limits are $${this.min}–$${this.max}`);
    if (this.shoe.needsShuffle) { this.shoe.reshuffle(); this.log.push("The dealer shuffles a fresh shoe."); }
    this.dealer = []; this.insurance = 0; this.holeRevealed = false; this.active = 0;
    this.hands = [{ cards: [], bet, doubled: false, fromSplit: false, splitAces: false, done: false, surrendered: false }];
    const h = this.hands[0];
    h.cards.push(this.shoe.draw()); this.dealer.push(this.shoe.draw()); h.cards.push(this.shoe.draw()); this.dealer.push(this.shoe.draw());
    if (this.dealer[0].rank === 14 && !isBlackjack(h.cards)) { this.phase = "insurance"; return bet; }
    this.afterPeek();
    return bet;
  }

  /** Take or decline insurance (costs half the bet). Returns money taken. */
  takeInsurance(yes: boolean): number {
    if (this.phase !== "insurance") return 0;
    const cost = yes ? this.hands[0].bet / 2 : 0;
    this.insurance = cost;
    this.afterPeek();
    return cost;
  }

  private afterPeek(): void {
    const up = this.dealer[0];
    const dealerBJ = isBlackjack(this.dealer);
    if ((up.rank === 14 || cardValue(up) === 10) && dealerBJ) { this.holeRevealed = true; this.settle(); return; }
    if (isBlackjack(this.hands[0].cards)) { this.hands[0].done = true; this.holeRevealed = true; this.settle(); return; }
    this.phase = "player";
  }

  get hand(): Hand { return this.hands[this.active]; }
  canHit(): boolean { return this.phase === "player" && !this.hand.done && !this.hand.splitAces; }
  canDouble(): boolean { return this.phase === "player" && this.hand.cards.length === 2 && !this.hand.splitAces; }
  canSplit(): boolean { const c = this.hand.cards; return this.phase === "player" && c.length === 2 && cardValue(c[0]) === cardValue(c[1]) && this.hands.length < this.maxHands && !this.hand.splitAces; }
  canSurrender(): boolean { return this.phase === "player" && this.hands.length === 1 && this.hand.cards.length === 2; }

  hit(): void {
    if (!this.canHit()) return;
    this.hand.cards.push(this.shoe.draw());
    if (handValue(this.hand.cards).total >= 21) this.stand();
  }
  stand(): void { if (this.phase !== "player") return; this.hand.done = true; this.next(); }
  /** Returns extra money taken. */
  double(): number {
    if (!this.canDouble()) return 0;
    const extra = this.hand.bet; this.hand.bet *= 2; this.hand.doubled = true;
    this.hand.cards.push(this.shoe.draw()); this.hand.done = true; this.next();
    return extra;
  }
  /** Returns extra money taken. */
  split(): number {
    if (!this.canSplit()) return 0;
    const h = this.hand, aces = h.cards[0].rank === 14;
    const nh: Hand = { cards: [h.cards.pop()!], bet: h.bet, doubled: false, fromSplit: true, splitAces: aces, done: false, surrendered: false };
    h.fromSplit = true; h.splitAces = aces;
    h.cards.push(this.shoe.draw()); nh.cards.push(this.shoe.draw());
    this.hands.splice(this.active + 1, 0, nh);
    if (aces) { h.done = true; nh.done = true; this.next(); }
    return nh.bet;
  }
  surrender(): void { if (!this.canSurrender()) return; this.hand.surrendered = true; this.hand.done = true; this.next(); }

  private next(): void {
    while (this.active < this.hands.length && this.hands[this.active].done) this.active++;
    if (this.active < this.hands.length) return;
    this.active = this.hands.length - 1;
    this.phase = "dealer";
    this.holeRevealed = true;
    // dealer draws only if some hand is still live
    if (this.hands.some((h) => !h.surrendered && handValue(h.cards).total <= 21)) {
      while (handValue(this.dealer).total < 17) this.dealer.push(this.shoe.draw()); // stands on all 17s (S17)
    }
    this.settle();
  }

  /** Pay out. Returns total money returned to the player (stakes + winnings). */
  settle(): number {
    const d = handValue(this.dealer).total, dealerBJ = isBlackjack(this.dealer);
    let back = 0;
    if (this.insurance) back += dealerBJ ? this.insurance * 3 : 0;
    for (const h of this.hands) {
      const p = handValue(h.cards).total;
      const natural = !h.fromSplit && isBlackjack(h.cards);
      if (h.surrendered) { h.result = "surrender"; h.payout = h.bet / 2; }
      else if (natural && !dealerBJ) { h.result = "blackjack"; h.payout = h.bet * 2.5; }
      else if (dealerBJ) { h.result = natural ? "push" : "lose"; h.payout = natural ? h.bet : 0; }
      else if (p > 21) { h.result = "lose"; h.payout = 0; }
      else if (d > 21 || p > d) { h.result = "win"; h.payout = h.bet * 2; }
      else if (p === d) { h.result = "push"; h.payout = h.bet; }
      else { h.result = "lose"; h.payout = 0; }
      back += h.payout;
    }
    this.phase = "settled";
    this.settledBack = back;
    return back;
  }
  settledBack = 0;

  /** Basic strategy hint for S17/DAS/6-deck (the "what should I do?" card the casino lets you hold). */
  hint(): "hit" | "stand" | "double" | "split" | "surrender" {
    const h = this.hand, up = cardValue(this.dealer[0]);
    const { total, soft } = handValue(h.cards);
    if (this.canSplit()) {
      const r = cardValue(h.cards[0]);
      if (r === 11 || r === 8) return "split";
      if (r === 9 && ![7, 10, 11].includes(up)) return "split";
      if ((r === 2 || r === 3 || r === 7) && up <= 7) return "split";
      if (r === 6 && up <= 6) return "split";
      if (r === 4 && (up === 5 || up === 6)) return "split";
    }
    if (this.canSurrender() && !soft && (total === 16 && up >= 9 || total === 15 && up === 10)) return "surrender";
    if (soft) {
      if (total >= 19) return total === 19 && up === 6 && this.canDouble() ? "double" : "stand";
      if (total === 18) return up <= 6 && this.canDouble() ? "double" : up <= 8 ? "stand" : "hit";
      const dbl: Record<number, number[]> = { 17: [3, 4, 5, 6], 16: [4, 5, 6], 15: [4, 5, 6], 14: [5, 6], 13: [5, 6] };
      return (dbl[total] ?? []).includes(up) && this.canDouble() ? "double" : "hit";
    }
    if (total >= 17) return "stand";
    if (total >= 13) return up <= 6 ? "stand" : "hit";
    if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
    if (total === 11) return this.canDouble() ? "double" : "hit";
    if (total === 10) return up <= 9 && this.canDouble() ? "double" : "hit";
    if (total === 9) return up >= 3 && up <= 6 && this.canDouble() ? "double" : "hit";
    return "hit";
  }
}
