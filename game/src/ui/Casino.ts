import { h } from "./dom";
import { Blackjack, handValue } from "../casino/blackjack";
import { Card, rankLabel, isRed } from "../casino/cards";
import { OUTSIDE, WHEEL_ORDER, colorOf, insideBet, payoutFor, settle, spin as spinWheel, RouletteBet } from "../casino/roulette";
import { VideoPoker, PAYTABLE, PokerHand } from "../casino/poker";
import { PAYS, spinReels, Sym, rtp } from "../casino/slots";

/**
 * The Tessera Casino. Real rules (see src/casino/*), real payouts, chips bought at the cashier.
 * Live play uses Math.random (not the seeded world RNG) like a real shuffle machine.
 */
export interface CasinoWallet { getCash(): number; setCash(v: number): void; onEvent(text: string, big: boolean): void; patrons(): number }

const CHIPS = [{ v: 1, c: "#eee4d3", t: "#0e0b0a" }, { v: 5, c: "#ec2a1c", t: "#eee4d3" }, { v: 25, c: "#2d6b24", t: "#eee4d3" }, { v: 100, c: "#0e0b0a", t: "#eee4d3" }, { v: 500, c: "#7a2bd6", t: "#eee4d3" }];
const rnd = () => Math.random();
const money = (n: number) => "$" + n.toLocaleString("en-NZ", { maximumFractionDigits: 2 });

function cardEl(c: Card | null, hidden = false): HTMLElement {
  if (!c || hidden) return h("div.pcard.back", { "aria-label": "face-down card" });
  return h("div.pcard" + (isRed(c) ? ".red" : ""), { "aria-label": rankLabel(c.rank) + " of " + c.suit }, [h("b", { text: rankLabel(c.rank) }), h("i", { text: c.suit }), h("b.flip", { text: rankLabel(c.rank) })]);
}

export class Casino {
  el: HTMLElement;
  chips = 0;
  private bought = 0; private cashedOut = 0;
  private tab = "cashier";
  private body: HTMLElement;
  private chipSel = 5;
  private bj = new Blackjack(rnd);
  private bjBet = 0;
  private bjHint = false;
  private rBets: RouletteBet[] = [];
  private rMode: "straight" | "split" | "street" | "corner" | "line" = "straight";
  private rPending = -1;
  private rHistory: number[] = [];
  private rSpinning = false;
  private rLast = -1;
  private vp = new VideoPoker(rnd);
  private vpCoins = 5; private vpValue = 1;
  private slotBet = 1; private reels: Sym[] = ["7", "7", "7"]; private slotMsg = ""; private slotSpinning = false;
  private msg = "";
  open = false;

  constructor(private w: CasinoWallet, private onClose: () => void) {
    this.body = h("div.cas-body");
    this.el = h("div.casino.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "The Tessera Casino" }, []);
  }

  show(): void { this.open = true; this.el.classList.remove("hidden"); this.render(); }
  close(): void {
    if (this.bj.phase === "player" || this.bj.phase === "insurance") { this.msg = "Finish the hand first."; this.render(); return; }
    if (this.rSpinning || this.slotSpinning) return;
    // the cashier cashes your chips out on the way out
    for (const b of this.rBets) this.chips += b.amount;
    this.rBets = [];
    if (this.chips > 0) { this.w.setCash(this.w.getCash() + this.chips); this.cashedOut += this.chips; this.chips = 0; }
    const net = this.cashedOut - this.bought;
    if (this.bought > 0) this.w.onEvent(net >= 0 ? `You walked out of the Tessera ${money(net)} up` : `You left the Tessera ${money(-net)} down`, Math.abs(net) >= 200);
    this.bought = 0; this.cashedOut = 0;
    this.open = false; this.el.classList.add("hidden"); this.onClose();
  }

  private take(n: number): boolean { if (n > this.chips + 1e-9) { this.msg = "Not enough chips. Visit the cashier."; return false; } this.chips -= n; return true; }

  private render(): void {
    const tabs = [["cashier", "Cashier"], ["blackjack", "Blackjack"], ["roulette", "Roulette"], ["pokies", "Pokies"], ["poker", "Video Poker"]];
    const nav = h("nav.cas-tabs", { role: "tablist" }, tabs.map(([id, l]) => h("button" + (this.tab === id ? ".on" : ""), { role: "tab", "aria-selected": String(this.tab === id), onclick: () => { this.tab = id; this.msg = ""; this.render(); } }, [l])));
    const head = h("header.cas-head", null, [
      h("div", null, [h("h2", { text: "The Tessera" }), h("p.cas-sub", { text: `${this.w.patrons()} people inside tonight · 18+ · play for fun, it's in-game money` })]),
      h("div.cas-bank", null, [h("span", { text: "Chips" }), h("b", { text: money(this.chips) }), h("span", { text: "Cash" }), h("b", { text: money(this.w.getCash()) })]),
      h("button.x", { "aria-label": "Leave the casino", onclick: () => this.close(), text: "×" }),
    ]);
    let view: HTMLElement;
    switch (this.tab) {
      case "blackjack": view = this.blackjackView(); break;
      case "roulette": view = this.rouletteView(); break;
      case "pokies": view = this.pokiesView(); break;
      case "poker": view = this.pokerView(); break;
      default: view = this.cashierView();
    }
    this.body.replaceChildren(view, this.msg ? h("p.cas-msg", { role: "status", text: this.msg }) : h("span"));
    this.el.replaceChildren(h("div.cas-frame", null, [head, nav, this.body, h("footer.cas-foot", { text: "Gamble responsibly. In real life, set a limit and stick to it. NZ Gambling Helpline: 0800 654 655." })]));
  }

  private chipRow(): HTMLElement {
    return h("div.chiprow", { role: "radiogroup", "aria-label": "Chip value" }, CHIPS.map((c) => h("button.chip" + (this.chipSel === c.v ? ".sel" : ""), { role: "radio", "aria-checked": String(this.chipSel === c.v), style: { background: c.c, color: c.t }, onclick: () => { this.chipSel = c.v; this.render(); } }, [String(c.v)])));
  }

  // ------------------------------------------------------------------ cashier
  private cashierView(): HTMLElement {
    const buy = (n: number) => { const cash = this.w.getCash(); const amt = Math.min(n, Math.floor(cash)); if (amt <= 0) { this.msg = "You're out of cash."; this.render(); return; } this.w.setCash(cash - amt); this.chips += amt; this.bought += amt; this.msg = `Bought ${money(amt)} in chips.`; this.render(); };
    return h("section.cas-cashier", null, [
      h("p", { text: "Swap cash for chips here. Whatever chips you have left are cashed out when you leave." }),
      h("div.row", null, [20, 50, 100, 250, 500].map((n) => h("button.btn", { onclick: () => buy(n), text: `Buy ${money(n)}` }))),
      h("div.row", null, [h("button.btn", { onclick: () => { if (this.chips > 0) { this.w.setCash(this.w.getCash() + this.chips); this.cashedOut += this.chips; this.msg = `Cashed out ${money(this.chips)}.`; this.chips = 0; this.render(); } }, text: "Cash out chips" })]),
      h("h3", { text: "House rules" }),
      h("ul.cas-rules", null, [
        "Blackjack: 6 decks, dealer stands on soft 17, blackjack pays 3:2, insurance 2:1, double any two cards, split to 4 hands, late surrender. Limits $5–$500. House edge ≈ 0.5% with basic strategy.",
        "Roulette: European single zero. Straight 35:1, split 17:1, street 11:1, corner 8:1, six line 5:1, dozens/columns 2:1, even money 1:1. House edge 2.70%.",
        `Pokies "Kiwi Gold": 3 reels, one line. Return to player ${(rtp() * 100).toFixed(1)}%.`,
        "Video poker: Jacks or Better, 9/6 full pay (99.5% with perfect play). 5 coins for the 4,000-coin royal.",
      ].map((t) => h("li", { text: t }))),
    ]);
  }

  // ------------------------------------------------------------------ blackjack
  private blackjackView(): HTMLElement {
    const bj = this.bj;
    const inRound = bj.phase === "player" || bj.phase === "insurance";
    const dealerCards = bj.dealer.map((c, i) => cardEl(c, i === 1 && !bj.holeRevealed));
    const dv = bj.dealer.length ? (bj.holeRevealed ? String(handValue(bj.dealer).total) : String(handValue([bj.dealer[0]]).total)) : "";
    const hands = bj.hands.map((hd, i) => {
      const v = handValue(hd.cards);
      return h("div.bj-hand" + (i === bj.active && bj.phase === "player" ? ".active" : ""), null, [
        h("div.cards", null, hd.cards.map((c) => cardEl(c))),
        h("p", { text: `${v.soft && v.total < 21 ? "soft " : ""}${v.total}${v.total > 21 ? " bust" : ""} · bet ${money(hd.bet)}${hd.result ? ` · ${hd.result.toUpperCase()}${hd.payout ? " +" + money(hd.payout) : ""}` : ""}` }),
      ]);
    });
    const act = (fn: () => number | void) => () => { this.msg = ""; const extra = fn(); if (typeof extra === "number" && extra > 0) { if (!this.take(extra)) { this.render(); return; } } this.finishBJ(); this.render(); };
    const controls: HTMLElement[] = [];
    if (!inRound) {
      controls.push(this.chipRow(), h("div.row", null, [
        h("button.btn", { onclick: () => { this.bjBet += this.chipSel; this.render(); }, text: `Add ${money(this.chipSel)}` }),
        h("button.btn", { onclick: () => { this.bjBet = 0; this.render(); }, text: "Clear" }),
        h("button.btn.red", { onclick: () => this.dealBJ(), text: `Deal ${money(this.bjBet || 0)}` }),
        h("label.hintbox", null, [h("input", { type: "checkbox", checked: this.bjHint, onchange: (e: Event) => { this.bjHint = (e.target as HTMLInputElement).checked; this.render(); } }), " Strategy card"]),
      ]));
    } else if (bj.phase === "insurance") {
      controls.push(h("p", { text: "Dealer shows an ace. Insurance?" }), h("div.row", null, [
        h("button.btn", { onclick: () => { if (this.take(bj.hands[0].bet / 2)) bj.takeInsurance(true); this.finishBJ(); this.render(); }, text: `Insure (${money(bj.hands[0].bet / 2)})` }),
        h("button.btn", { onclick: () => { bj.takeInsurance(false); this.finishBJ(); this.render(); }, text: "No insurance" }),
      ]));
    } else {
      controls.push(h("div.row", null, [
        h("button.btn", { disabled: !bj.canHit(), onclick: act(() => bj.hit()), text: "Hit" }),
        h("button.btn", { onclick: act(() => bj.stand()), text: "Stand" }),
        h("button.btn", { disabled: !bj.canDouble() || this.chips < bj.hand.bet, onclick: act(() => (this.chips >= bj.hand.bet ? bj.double() : 0)), text: "Double" }),
        h("button.btn", { disabled: !bj.canSplit() || this.chips < bj.hand.bet, onclick: act(() => (this.chips >= bj.hand.bet ? bj.split() : 0)), text: "Split" }),
        h("button.btn", { disabled: !bj.canSurrender(), onclick: act(() => bj.surrender()), text: "Surrender" }),
      ]));
      if (this.bjHint) controls.push(h("p.hint", { text: `Basic strategy says: ${bj.hint().toUpperCase()}` }));
    }
    return h("section.felt", null, [
      h("div.bj-dealer", null, [h("p.lbl", { text: `Dealer ${dv}` }), h("div.cards", null, dealerCards)]),
      h("p.felt-print", { text: "BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17s · INSURANCE PAYS 2 TO 1" }),
      h("div.bj-hands", null, hands),
      h("p.lbl", { text: `Shoe: ${bj.shoe.remaining} cards left${bj.shoe.needsShuffle ? " · shuffle due" : ""}` }),
      ...controls,
    ]);
  }

  private dealBJ(): void {
    const bet = this.bjBet || this.chipSel;
    if (bet < 5 || bet > 500) { this.msg = "Table limits are $5–$500."; this.render(); return; }
    if (!this.take(bet)) { this.render(); return; }
    this.bj.deal(bet);
    this.finishBJ();
    this.render();
  }

  private finishBJ(): void {
    if (this.bj.phase !== "settled") return;
    const back = this.bj.settledBack;
    this.chips += back;
    const staked = this.bj.hands.reduce((s, x) => s + x.bet, 0) + this.bj.insurance;
    const net = back - staked;
    this.msg = net > 0 ? `You win ${money(net)}.` : net < 0 ? `Dealer takes ${money(-net)}.` : "Push.";
    if (this.bj.hands.some((x) => x.result === "blackjack")) this.msg = `Blackjack! ${this.msg}`;
    if (net >= 250) this.w.onEvent(`Big blackjack win at the Tessera: ${money(net)}`, true);
    this.bj.settledBack = 0; this.bj.insurance = 0;
  }

  // ------------------------------------------------------------------ roulette
  private rouletteView(): HTMLElement {
    const wheel = h("canvas.wheel", { width: 220, height: 220, "aria-label": this.rLast >= 0 ? `Last result ${this.rLast} ${colorOf(this.rLast)}` : "Roulette wheel" }) as HTMLCanvasElement;
    this.drawWheel(wheel, this.rLastAngle, this.rBallAngle);
    const place = (nums: number[] | null, label: string) => {
      if (this.rSpinning) return;
      if (!nums) { this.msg = "That isn't a valid bet on the layout."; this.render(); return; }
      if (!this.take(this.chipSel)) { this.render(); return; }
      const id = nums.join("-");
      const ex = this.rBets.find((b) => b.id === id);
      if (ex) ex.amount += this.chipSel; else this.rBets.push({ id, label, numbers: nums, amount: this.chipSel });
      this.msg = `${label} (${payoutFor(nums)}:1)`; this.render();
    };
    const clickNumber = (n: number) => {
      if (this.rMode === "straight") return place(insideBet("straight", n), `Straight ${n}`);
      if (this.rMode === "split") { if (this.rPending < 0) { this.rPending = n; this.msg = `Split: now pick a number next to ${n}`; this.render(); return; } const a = this.rPending; this.rPending = -1; return place(insideBet("split", a, n), `Split ${a}/${n}`); }
      if (this.rMode === "street") { const s = insideBet("street", n); return place(s, `Street ${s?.join("-")}`); }
      if (this.rMode === "corner") { const s = insideBet("corner", n); return place(s, `Corner ${s?.join("-")}`); }
      const s = insideBet("line", n); return place(s, `Six line ${s ? s[0] + "–" + s[5] : ""}`);
    };
    const betOn = (nums: number[]) => this.rBets.filter((b) => b.numbers.length === nums.length && nums.every((x) => b.numbers.includes(x))).reduce((s, b) => s + b.amount, 0);
    const cell = (n: number) => h("button.rc." + colorOf(n), { onclick: () => clickNumber(n), "aria-label": `${n} ${colorOf(n)}` }, [String(n), betOn([n]) ? h("span.stake", { text: String(betOn([n])) }) : null]);
    const grid: HTMLElement[] = [];
    for (let row = 3; row >= 1; row--) for (let c = 0; c < 12; c++) grid.push(cell(c * 3 + row));
    const outside = (key: string) => { const o = OUTSIDE[key]; return h("button.ro" + (key === "red" ? ".red" : key === "black" ? ".black" : ""), { onclick: () => place(o.numbers, o.label) }, [o.label, betOn(o.numbers) ? h("span.stake", { text: String(betOn(o.numbers)) }) : null]); };
    const total = this.rBets.reduce((s, b) => s + b.amount, 0);
    return h("section.felt.roul", null, [
      h("div.roul-top", null, [wheel, h("div", null, [
        h("p.lbl", { text: "Last results" }),
        h("div.hist", null, this.rHistory.slice(0, 14).map((n) => h("span." + colorOf(n), { text: String(n) }))),
        h("p.lbl", { text: "Bet type" }),
        h("div.row", null, (["straight", "split", "street", "corner", "line"] as const).map((m) => h("button.btn" + (this.rMode === m ? ".on" : ""), { onclick: () => { this.rMode = m; this.rPending = -1; this.render(); }, text: m === "line" ? "six line" : m }))),
        this.chipRow(),
      ])]),
      h("div.rboard", null, [h("button.rc.green.zero", { onclick: () => place([0], "Straight 0") }, ["0", betOn([0]) ? h("span.stake", { text: String(betOn([0])) }) : null]), h("div.rgrid", null, grid), h("div.rcols", null, ["c3", "c2", "c1"].map((k) => h("button.ro", { onclick: () => place(OUTSIDE[k].numbers, OUTSIDE[k].label) }, ["2:1", betOn(OUTSIDE[k].numbers) ? h("span.stake", { text: String(betOn(OUTSIDE[k].numbers)) }) : null])))]),
      h("div.routs", null, ["d1", "d2", "d3"].map(outside)),
      h("div.routs", null, ["low", "even", "red", "black", "odd", "high"].map(outside)),
      h("div.row", null, [
        h("button.btn.red", { disabled: !this.rBets.length || this.rSpinning, onclick: () => this.spinRoulette(), text: this.rSpinning ? "No more bets..." : `Spin (${money(total)} on the table)` }),
        h("button.btn", { disabled: !this.rBets.length || this.rSpinning, onclick: () => { for (const b of this.rBets) this.chips += b.amount; this.rBets = []; this.render(); }, text: "Clear bets" }),
      ]),
      h("ul.rbets", null, this.rBets.map((b) => h("li", { text: `${b.label} · ${money(b.amount)} · pays ${payoutFor(b.numbers)}:1` }))),
    ]);
  }

  private rLastAngle = 0; private rBallAngle = 0;
  private drawWheel(cv: HTMLCanvasElement, rot: number, ball: number): void {
    const g = cv.getContext("2d"); if (!g) return;
    const R = 105, cx = 110, cy = 110, n = WHEEL_ORDER.length, step = (Math.PI * 2) / n;
    g.clearRect(0, 0, 220, 220);
    g.fillStyle = "#6b3a12"; g.beginPath(); g.arc(cx, cy, R + 4, 0, 6.283); g.fill();
    for (let i = 0; i < n; i++) {
      const num = WHEEL_ORDER[i], a0 = rot + i * step - Math.PI / 2;
      g.fillStyle = num === 0 ? "#2d6b24" : colorOf(num) === "red" ? "#b3121b" : "#0e0b0a";
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + step); g.closePath(); g.fill();
      g.save(); g.translate(cx, cy); g.rotate(a0 + step / 2); g.fillStyle = "#eee4d3"; g.font = "700 9px IBM Plex Mono, monospace"; g.textAlign = "center"; g.fillText(String(num), R - 11, 3); g.restore();
    }
    g.fillStyle = "#3a2c22"; g.beginPath(); g.arc(cx, cy, R * 0.55, 0, 6.283); g.fill();
    g.strokeStyle = "#f6b62c"; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5); g.stroke(); }
    g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(cx + Math.cos(ball) * R * 0.78, cy + Math.sin(ball) * R * 0.78, 5, 0, 6.283); g.fill();
  }

  private spinRoulette(): void {
    if (this.rSpinning || !this.rBets.length) return;
    this.rSpinning = true; this.msg = "No more bets.";
    const result = spinWheel(rnd);
    const idx = WHEEL_ORDER.indexOf(result), step = (Math.PI * 2) / 37;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 300 : 4200, t0 = performance.now(), startRot = this.rLastAngle;
    const endRot = startRot + Math.PI * 2 * 3 + 0.37;
    const ballEnd = endRot + idx * step + step / 2 - Math.PI / 2;
    const ballStart = ballEnd + Math.PI * 2 * 5;
    this.render();
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      this.rLastAngle = startRot + (endRot - startRot) * e; this.rBallAngle = ballStart + (ballEnd - ballStart) * e;
      const cv = this.el.querySelector("canvas.wheel") as HTMLCanvasElement | null;
      if (cv) this.drawWheel(cv, this.rLastAngle, this.rBallAngle);
      if (t < 1) { requestAnimationFrame(anim); return; }
      const staked = this.rBets.reduce((s, b) => s + b.amount, 0), back = settle(this.rBets, result);
      this.chips += back; this.rBets = []; this.rSpinning = false; this.rLast = result;
      this.rHistory.unshift(result);
      const net = back - staked;
      this.msg = `${result} ${colorOf(result).toUpperCase()}. ${net > 0 ? `You win ${money(net)}.` : net < 0 ? `House takes ${money(-net)}.` : "Even."}`;
      if (net >= 300) this.w.onEvent(`You hit ${result} at roulette and won ${money(net)}`, true);
      this.render();
    };
    requestAnimationFrame(anim);
  }

  // ------------------------------------------------------------------ pokies
  private pokiesView(): HTMLElement {
    return h("section.felt.pokie", null, [
      h("p.pokie-title", { text: "KIWI GOLD" }),
      h("div.reels" + (this.slotSpinning ? ".spinning" : ""), { "aria-live": "polite" }, this.reels.map((s) => h("div.reel", { text: s }))),
      h("p.lbl", { text: this.slotMsg || `Bet ${money(this.slotBet)} per spin` }),
      h("div.row", null, [1, 2, 5, 10].map((b) => h("button.btn" + (this.slotBet === b ? ".on" : ""), { onclick: () => { this.slotBet = b; this.render(); }, text: money(b) })).concat([h("button.btn.red", { disabled: this.slotSpinning, onclick: () => this.spinSlots(), text: "SPIN" })])),
      h("table.paytable", null, [h("tbody", null, PAYS.map((p) => h("tr", null, [h("td", { text: p.label }), h("td", { text: `${p.mult}×` })])))]),
      h("p.lbl", { text: `Return to player ${(rtp() * 100).toFixed(1)}% (computed from the reel strips)` }),
    ]);
  }

  private spinSlots(): void {
    if (this.slotSpinning || !this.take(this.slotBet)) { this.render(); return; }
    this.slotSpinning = true; this.slotMsg = "";
    const final = spinReels(rnd);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let ticks = reduce ? 1 : 14;
    const all: Sym[] = ["🍒", "🍋", "🔔", "🥝", "BAR", "7", "💎"];
    const tick = () => {
      ticks--;
      this.reels = ticks > 0 ? [0, 1, 2].map((i) => (ticks < 5 && i === 0 || ticks < 3 && i === 1 ? final[i] : all[Math.floor(Math.random() * all.length)])) as Sym[] : final;
      if (ticks > 0) { this.render(); setTimeout(tick, 70); return; }
      const p = PAYS.find((x) => x.match(final));
      const win = p ? p.mult * this.slotBet : 0;
      this.chips += win; this.slotSpinning = false;
      this.slotMsg = win ? `${p!.label}: WIN ${money(win)}` : "No win.";
      if (win >= 100) this.w.onEvent(`Kiwi Gold paid ${money(win)}!`, true);
      this.render();
    };
    tick();
  }

  // ------------------------------------------------------------------ video poker
  private pokerView(): HTMLElement {
    const vp = this.vp;
    const rows = (Object.keys(PAYTABLE) as PokerHand[]).filter((k) => k !== "Nothing").map((k) => h("tr" + (vp.phase !== "bet" && vp.result === k ? ".hit" : ""), null, [h("td", { text: k }), ...PAYTABLE[k].map((p, i) => h("td" + (i + 1 === this.vpCoins ? ".col" : ""), { text: String(p) }))]));
    return h("section.felt.vp", null, [
      h("table.paytable.vpt", null, [h("tbody", null, rows)]),
      h("div.cards.vp-cards", null, vp.hand.length ? vp.hand.map((c, i) => h("button.vp-slot" + (vp.held[i] ? ".held" : ""), { disabled: vp.phase !== "draw", onclick: () => { vp.toggle(i); this.render(); }, "aria-pressed": String(vp.held[i]) }, [cardEl(c), h("span", { text: vp.held[i] ? "HELD" : "hold" })])) : [0, 1, 2, 3, 4].map(() => cardEl(null))),
      h("p.lbl", { text: vp.phase === "bet" ? "Choose coins and deal." : vp.phase === "draw" ? `${vp.result === "Nothing" ? "" : vp.result + " so far. "}Pick cards to hold, then draw.` : `${vp.result}.` }),
      h("div.row", null, [
        ...[1, 2, 3, 4, 5].map((c) => h("button.btn" + (this.vpCoins === c ? ".on" : ""), { disabled: vp.phase === "draw", onclick: () => { this.vpCoins = c; this.render(); }, text: `${c} coin${c > 1 ? "s" : ""}` })),
        ...[1, 5].map((v) => h("button.btn" + (this.vpValue === v ? ".on" : ""), { disabled: vp.phase === "draw", onclick: () => { this.vpValue = v; this.render(); }, text: `${money(v)} coins` })),
        vp.phase === "draw"
          ? h("button.btn.red", { onclick: () => { const win = vp.draw(); this.chips += win; this.msg = win ? `${vp.result}: ${money(win)}` : "No win."; if (vp.result === "Royal Flush") this.w.onEvent("ROYAL FLUSH at the Tessera!", true); this.render(); }, text: "Draw" })
          : h("button.btn.red", { onclick: () => { if (!this.take(this.vpCoins * this.vpValue)) { this.render(); return; } vp.deal(this.vpCoins, this.vpValue); this.msg = ""; this.render(); }, text: `Deal (${money(this.vpCoins * this.vpValue)})` }),
      ]),
    ]);
  }
}
