import { describe, it, expect } from "vitest";
import { Blackjack, handValue, isBlackjack } from "../src/casino/blackjack";
import { Card, Shoe } from "../src/casino/cards";
import { evaluate, VideoPoker, PAYTABLE } from "../src/casino/poker";
import { colorOf, insideBet, OUTSIDE, payoutFor, settle, WHEEL_ORDER } from "../src/casino/roulette";
import { rtp, REEL, payFor } from "../src/casino/slots";
import { Rng } from "../src/core/rng";

const C = (s: string): Card => { const r = s.slice(0, -1), suit = s.slice(-1) as Card["suit"]; return { rank: ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? +r, suit }; };
const rnd = () => { const r = new Rng(3); return () => r.next(); };
/** Stack the shoe so the next cards dealt are exactly these (deal order: P, D, P, D, then draws). */
function stack(bj: Blackjack, cards: string[]): void { bj.shoe.cards = [...cards.map(C), ...bj.shoe.cards]; bj.shoe.dealt = 0; }

describe("blackjack rules", () => {
  it("counts soft and hard totals", () => {
    expect(handValue([C("A♠"), C("6♥")])).toEqual({ total: 17, soft: true });
    expect(handValue([C("A♠"), C("6♥"), C("10♦")])).toEqual({ total: 17, soft: false });
    expect(handValue([C("A♠"), C("A♥"), C("9♦")])).toEqual({ total: 21, soft: true });
    expect(isBlackjack([C("A♠"), C("K♥")])).toBe(true);
  });
  it("pays a natural 3:2 and the dealer stands on soft 17", () => {
    const bj = new Blackjack(rnd());
    stack(bj, ["A♠", "9♥", "K♣", "7♦"]);
    bj.deal(10);
    expect(bj.phase).toBe("settled"); expect(bj.hands[0].result).toBe("blackjack"); expect(bj.settledBack).toBe(25);
    const b2 = new Blackjack(rnd());
    stack(b2, ["10♠", "A♥", "8♣", "6♦"]); // dealer A-6 = soft 17, player 18; no insurance taken
    b2.deal(10); b2.takeInsurance(false);
    b2.stand();
    expect(b2.dealer.length).toBe(2); // stood on soft 17
    expect(b2.hands[0].result).toBe("win"); expect(b2.settledBack).toBe(20);
  });
  it("insurance pays 2:1 against a dealer blackjack", () => {
    const bj = new Blackjack(rnd());
    stack(bj, ["10♠", "A♥", "9♣", "K♦"]);
    bj.deal(20);
    expect(bj.phase).toBe("insurance");
    const cost = bj.takeInsurance(true);
    expect(cost).toBe(10);
    expect(bj.phase).toBe("settled"); expect(bj.hands[0].result).toBe("lose"); expect(bj.settledBack).toBe(30);
  });
  it("doubles, splits (aces get one card), and surrenders correctly", () => {
    const d = new Blackjack(rnd());
    stack(d, ["6♠", "5♥", "5♣", "10♦", "10♥", "2♠"]); // player 11 vs 5; double gets 10 = 21; dealer 15 draws 2 = 17
    d.deal(10);
    expect(d.canDouble()).toBe(true);
    expect(d.double()).toBe(10);
    expect(d.hands[0].cards.length).toBe(3); expect(d.hands[0].result).toBe("win"); expect(d.settledBack).toBe(40);
    const s = new Blackjack(rnd());
    stack(s, ["A♠", "9♥", "A♣", "7♦", "5♥", "K♠"]);
    s.deal(10);
    expect(s.canSplit()).toBe(true);
    s.split();
    expect(s.hands.length).toBe(2);
    expect(s.hands.every((h) => h.cards.length === 2 && h.done)).toBe(true); // split aces: one card each
    expect(s.hands[1].result).toBe("win"); // A-K after a split is 21 but not a natural: pays 1:1
    expect(s.hands[1].payout).toBe(20);
    const r = new Blackjack(rnd());
    stack(r, ["10♠", "9♥", "6♣", "10♦"]);
    r.deal(10); r.surrender();
    expect(r.hands[0].result).toBe("surrender"); expect(r.settledBack).toBe(5);
  });
  it("enforces table limits and reshuffles at the cut card", () => {
    const bj = new Blackjack(rnd());
    expect(() => bj.deal(1)).toThrow(); expect(() => bj.deal(1000)).toThrow();
    const shoe = new Shoe(6, rnd());
    expect(shoe.cards.length).toBe(312);
    for (let i = 0; i < 234; i++) shoe.draw();
    expect(shoe.needsShuffle).toBe(true);
  });
  it("basic strategy says split aces, stand on 17, double 11", () => {
    const bj = new Blackjack(rnd());
    stack(bj, ["A♠", "6♥", "A♣", "9♦"]); bj.deal(10);
    expect(bj.hint()).toBe("split");
    const b2 = new Blackjack(rnd()); stack(b2, ["6♠", "9♥", "5♣", "7♦"]); b2.deal(10);
    expect(b2.hint()).toBe("double");
  });
  it("house edge is small and real over many rounds of basic strategy", () => {
    const bj = new Blackjack(rnd());
    let net = 0, staked = 0;
    for (let i = 0; i < 20000; i++) {
      net -= bj.deal(10); staked += 10;
      if (bj.phase === "insurance") bj.takeInsurance(false);
      let guard = 0;
      while (bj.phase === "player" && guard++ < 20) {
        const h = bj.hint();
        if (h === "split") net -= bj.split(); else if (h === "double") net -= bj.double(); else if (h === "surrender") bj.surrender(); else if (h === "hit") bj.hit(); else bj.stand();
      }
      net += bj.settledBack;
    }
    const edge = -net / staked;
    expect(edge).toBeGreaterThan(-0.03); expect(edge).toBeLessThan(0.03); // ~0.5% with sampling noise
  });
});

describe("roulette", () => {
  it("has the real single-zero wheel and colours", () => {
    expect(WHEEL_ORDER.length).toBe(37); expect(new Set(WHEEL_ORDER).size).toBe(37);
    expect(colorOf(0)).toBe("green"); expect(colorOf(1)).toBe("red"); expect(colorOf(2)).toBe("black");
    expect(OUTSIDE.red.numbers.length).toBe(18);
  });
  it("pays the standard table: 35, 17, 11, 8, 5, 2, 1 to 1", () => {
    expect(payoutFor(insideBet("straight", 17)!)).toBe(35);
    expect(payoutFor(insideBet("split", 17, 20)!)).toBe(17);
    expect(insideBet("split", 3, 4)).toBeNull(); // not adjacent on the layout
    expect(payoutFor(insideBet("street", 14)!)).toBe(11);
    expect(payoutFor(insideBet("corner", 1)!)).toBe(8);
    expect(payoutFor(insideBet("line", 4)!)).toBe(5);
    expect(payoutFor(OUTSIDE.d2.numbers)).toBe(2);
    expect(payoutFor(OUTSIDE.even.numbers)).toBe(1);
  });
  it("settles bets and has a 2.70% edge on every bet", () => {
    const bets = [{ id: "a", label: "17", numbers: [17], amount: 10 }, { id: "b", label: "Red", numbers: OUTSIDE.red.numbers, amount: 10 }];
    expect(settle(bets, 17)).toBe(10 * 36 + 0); // 17 is black: red loses
    expect(settle(bets, 0)).toBe(0);
    for (const nums of [[17], OUTSIDE.red.numbers, OUTSIDE.d1.numbers, insideBet("corner", 5)!]) {
      let back = 0; for (let n = 0; n <= 36; n++) back += nums.includes(n) ? payoutFor(nums) + 1 : 0;
      expect(1 - back / 37).toBeCloseTo(1 / 37, 6);
    }
  });
});

describe("video poker (Jacks or Better 9/6)", () => {
  const H = (s: string) => s.split(" ").map(C);
  it("ranks every hand correctly", () => {
    expect(evaluate(H("10♠ J♠ Q♠ K♠ A♠"))).toBe("Royal Flush");
    expect(evaluate(H("5♥ 6♥ 7♥ 8♥ 9♥"))).toBe("Straight Flush");
    expect(evaluate(H("9♠ 9♥ 9♦ 9♣ 2♠"))).toBe("Four of a Kind");
    expect(evaluate(H("3♠ 3♥ 3♦ K♣ K♠"))).toBe("Full House");
    expect(evaluate(H("2♦ 8♦ 9♦ J♦ A♦"))).toBe("Flush");
    expect(evaluate(H("A♠ 2♥ 3♦ 4♣ 5♠"))).toBe("Straight");
    expect(evaluate(H("10♠ J♥ Q♦ K♣ A♠"))).toBe("Straight");
    expect(evaluate(H("7♠ 7♥ 7♦ K♣ 2♠"))).toBe("Three of a Kind");
    expect(evaluate(H("4♠ 4♥ J♦ J♣ 2♠"))).toBe("Two Pair");
    expect(evaluate(H("Q♠ Q♥ 3♦ 8♣ 2♠"))).toBe("Jacks or Better");
    expect(evaluate(H("10♠ 10♥ 3♦ 8♣ 2♠"))).toBe("Nothing");
    expect(PAYTABLE["Royal Flush"][4]).toBe(4000); expect(PAYTABLE["Full House"][0]).toBe(9); expect(PAYTABLE.Flush[0]).toBe(6);
  });
  it("holds cards through the draw", () => {
    const vp = new VideoPoker(rnd());
    vp.deal(5, 1);
    const keep = vp.hand[2];
    vp.toggle(2); vp.draw();
    expect(vp.hand[2]).toEqual(keep); expect(vp.phase).toBe("done");
  });
});

describe("pokies", () => {
  it("returns a realistic 92.5% (exact enumeration)", () => {
    expect(REEL.length).toBe(32);
    expect(rtp()).toBeCloseTo(0.92542, 4);
    expect(payFor(["💎", "💎", "💎"]).mult).toBe(1000);
    expect(payFor(["🍒", "🍋", "7"]).mult).toBe(1);
  });
});
