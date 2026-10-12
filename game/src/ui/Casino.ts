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
  private tab = "floor";
  private floorRaf = 0;
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

  show(): void { this.open = true; this.tab = "floor"; this.el.classList.remove("hidden"); this.render(); }
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
    const tabs = [["floor", "Casino floor"], ["cashier", "Cashier"], ["blackjack", "Blackjack"], ["roulette", "Roulette"], ["pokies", "Pokies"], ["poker", "Video Poker"]];
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
      case "floor": view = this.floorView(); break;
      default: view = this.cashierView();
    }
    if (this.tab !== "floor") cancelAnimationFrame(this.floorRaf);
    this.body.replaceChildren(view, this.msg ? h("p.cas-msg", { role: "status", text: this.msg }) : h("span"));
    this.el.replaceChildren(h("div.cas-frame", null, [head, nav, this.body, h("footer.cas-foot", { text: "Gamble responsibly. In real life, set a limit and stick to it. NZ Gambling Helpline: 0800 654 655." })]));
  }

  // ------------------------------------------------------------------ the floor
  /**
   * The inside of the Tessera: carpet, chandeliers, a neon sign, the blackjack and roulette tables,
   * a bank of pokies, the video poker bar and the cashier cage, with gamblers milling about. Click a
   * station (or use the buttons under it) to sit down and play.
   */
  private floorView(): HTMLElement {
    const W = 960, H = 460;
    const cv = h("canvas.cas-floor", { width: W, height: H, "aria-label": "The casino floor. Choose a table below." }) as HTMLCanvasElement;
    const spots: { id: string; label: string; x: number; y: number; w: number; h: number }[] = [
      { id: "blackjack", label: "Blackjack", x: 70, y: 250, w: 240, h: 150 },
      { id: "roulette", label: "Roulette", x: 360, y: 250, w: 250, h: 150 },
      { id: "pokies", label: "Kiwi Gold pokies", x: 650, y: 120, w: 280, h: 140 },
      { id: "poker", label: "Video poker bar", x: 660, y: 300, w: 260, h: 110 },
      { id: "cashier", label: "Cashier", x: 40, y: 90, w: 190, h: 110 },
    ];
    let hover = "";
    const pos = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    const hit = (x: number, y: number) => spots.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    cv.addEventListener("mousemove", (e) => { const p = pos(e); hover = hit(p.x, p.y)?.id ?? ""; cv.style.cursor = hover ? "pointer" : ""; });
    cv.addEventListener("click", (e) => { const p = pos(e); const s = hit(p.x, p.y); if (s) { this.tab = s.id; this.msg = ""; this.render(); } });
    const g = cv.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const people = Array.from({ length: 16 }, (_, i) => ({ x: 80 + ((i * 137) % 800), y: 210 + ((i * 59) % 230), c: ["#ff7ad9", "#3dd6ff", "#c6ff3d", "#f6b62c", "#b48cff", "#eee4d3"][i % 6], ph: i * 1.3, sp: 8 + (i % 5) * 4 }));
    const fig = (x: number, y: number, col: string, t: number, sit = false) => {
      g.strokeStyle = col; g.lineWidth = 3; g.lineCap = "round";
      const sw = sit ? 0 : Math.sin(t * 6) * 6;
      g.beginPath(); g.arc(x, y - 44, 7, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(x, y - 37); g.lineTo(x, y - 16); g.moveTo(x, y - 30); g.lineTo(x - 9, y - 22 + sw * 0.3); g.moveTo(x, y - 30); g.lineTo(x + 9, y - 22 - sw * 0.3);
      if (sit) { g.moveTo(x, y - 16); g.lineTo(x + 10, y - 14); g.lineTo(x + 10, y); } else { g.moveTo(x, y - 16); g.lineTo(x - 6 + sw, y); g.moveTo(x, y - 16); g.lineTo(x + 6 - sw, y); }
      g.stroke();
    };
    const draw = (t: number) => {
      // carpet: deep plum with a gold diamond pattern, vignette
      g.fillStyle = "#1c0f1e"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(246,182,44,.07)"; g.lineWidth = 1;
      for (let x = -H; x < W; x += 28) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x + H, H + 70); g.moveTo(x + H, 70); g.lineTo(x, H + 70); g.stroke(); }
      g.fillStyle = "#120a14"; g.fillRect(0, 0, W, 70); // back wall
      // neon sign
      g.font = "900 34px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center";
      g.shadowColor = "#f6b62c"; g.shadowBlur = reduce ? 6 : 10 + Math.sin(t * 2) * 4; g.fillStyle = "#f6b62c"; g.fillText("THE TESSERA", W / 2, 48); g.shadowBlur = 0;
      // chandeliers
      for (const cx of [220, 480, 740]) {
        g.strokeStyle = "rgba(238,228,211,.25)"; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 26); g.stroke();
        for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.283 + t * 0.2, px = cx + Math.cos(a) * 26, py = 34 + Math.sin(a) * 7; g.fillStyle = `rgba(255,236,170,${0.55 + 0.45 * Math.sin(t * 3 + k)})`; g.beginPath(); g.arc(px, py, 2.6, 0, 6.283); g.fill(); }
        const grd = g.createRadialGradient(cx, 40, 0, cx, 40, 160); grd.addColorStop(0, "rgba(255,230,160,.12)"); grd.addColorStop(1, "rgba(255,230,160,0)"); g.fillStyle = grd; g.fillRect(cx - 160, 0, 320, 220);
      }
      // cashier cage
      g.fillStyle = "#2a1630"; g.fillRect(40, 90, 190, 110); g.strokeStyle = "#f6b62c"; g.lineWidth = 2; g.strokeRect(40, 90, 190, 110);
      g.strokeStyle = "rgba(246,182,44,.5)"; for (let x = 52; x < 230; x += 12) { g.beginPath(); g.moveTo(x, 100); g.lineTo(x, 150); g.stroke(); }
      fig(135, 160, "#eee4d3", t, false);
      g.fillStyle = "#eee4d3"; g.font = "700 13px 'IBM Plex Mono', monospace"; g.fillText("CASHIER · CHIPS", 135, 190);
      // blackjack: green felt half-moon, dealer, players on stools, cards
      g.fillStyle = "#14532d"; g.beginPath(); g.ellipse(190, 300, 115, 62, 0, 0, Math.PI); g.fill(); g.fillRect(75, 286, 230, 14);
      g.strokeStyle = "#6b3a12"; g.lineWidth = 6; g.beginPath(); g.ellipse(190, 300, 115, 62, 0, 0, Math.PI); g.stroke();
      fig(190, 286, "#eee4d3", t, false);
      for (let k = 0; k < 4; k++) { const a = 0.35 + k * 0.8, px = 190 + Math.cos(a) * 125, py = 300 + Math.sin(a) * 72; fig(px, py + 30, ["#ff7ad9", "#3dd6ff", "#c6ff3d", "#b48cff"][k], t + k, true); g.fillStyle = "#eee4d3"; g.fillRect(190 + Math.cos(a) * 80 - 6, 300 + Math.sin(a) * 40 - 8, 12, 16); }
      // roulette: table with a spinning wheel
      g.fillStyle = "#14532d"; g.fillRect(380, 270, 210, 90); g.strokeStyle = "#6b3a12"; g.lineWidth = 6; g.strokeRect(380, 270, 210, 90);
      for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? "#ec2a1c" : "#0e0b0a"; g.fillRect(440 + (k % 6) * 22, 285 + Math.floor(k / 6) * 28, 20, 26); }
      const wa = reduce ? 0 : t * 2.2; g.save(); g.translate(410, 315);
      for (let k = 0; k < 18; k++) { g.fillStyle = k === 0 ? "#2d6b24" : k % 2 ? "#ec2a1c" : "#0e0b0a"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 24, wa + (k / 18) * 6.283, wa + ((k + 1) / 18) * 6.283); g.fill(); }
      g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(Math.cos(-wa * 1.6) * 18, Math.sin(-wa * 1.6) * 18, 2.5, 0, 6.283); g.fill(); g.restore();
      fig(485, 268, "#eee4d3", t, false);
      // pokies bank with blinking toppers
      for (let k = 0; k < 6; k++) {
        const x = 660 + k * 45, y = 130;
        g.fillStyle = "#2a1630"; g.fillRect(x, y, 38, 110); g.fillStyle = "#0e0b0a"; g.fillRect(x + 5, y + 30, 28, 30);
        g.fillStyle = Math.floor(t * 4 + k) % 3 === 0 ? "#f6b62c" : k % 2 ? "#ff7ad9" : "#3dd6ff"; g.fillRect(x + 4, y + 6, 30, 14);
        g.fillStyle = "#eee4d3"; g.font = "700 11px monospace"; g.fillText(["7", "💎", "🥝"][(Math.floor(t * 2) + k) % 3], x + 19, y + 50);
      }
      fig(700, 262, "#c6ff3d", t, true); fig(790, 262, "#ff7ad9", t + 2, true);
      // video poker bar
      g.fillStyle = "#3a1f12"; g.fillRect(660, 340, 260, 34); g.fillStyle = "#6b3a12"; g.fillRect(660, 334, 260, 8);
      for (let k = 0; k < 5; k++) { g.fillStyle = "#1d2a38"; g.fillRect(672 + k * 50, 310, 34, 24); g.fillStyle = "#3dd6ff"; g.fillRect(676 + k * 50, 314, 26, 10); }
      // wandering gamblers
      for (const p of people) {
        const x = p.x + (reduce ? 0 : Math.sin(t * 0.3 + p.ph) * p.sp * 3), y = p.y;
        if (y < 230 || (x > 60 && x < 330 && y > 240 && y < 400) || (x > 360 && x < 620 && y > 250 && y < 380) || (x > 640 && y < 420 && y > 110)) continue;
        fig(x, y, p.c, t + p.ph);
      }
      // hotspots
      for (const s of spots) {
        const on = s.id === hover;
        g.strokeStyle = on ? "#c6ff3d" : "rgba(238,228,211,.18)"; g.lineWidth = on ? 3 : 1; g.setLineDash(on ? [] : [6, 6]); g.strokeRect(s.x, s.y, s.w, s.h); g.setLineDash([]);
        g.fillStyle = on ? "#c6ff3d" : "rgba(238,228,211,.8)"; g.font = "800 15px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center";
        g.fillText(s.label.toUpperCase() + (on ? "  ▶ PLAY" : ""), s.x + s.w / 2, s.y + s.h + 16);
      }
      // the way out
      g.fillStyle = "rgba(238,228,211,.5)"; g.font = "600 12px monospace"; g.fillText("EXIT ↓  (Esc)", W / 2, H - 8);
    };
    const loop = (ms: number) => { if (!this.open || this.tab !== "floor") return; draw(ms / 1000); this.floorRaf = requestAnimationFrame(loop); };
    cancelAnimationFrame(this.floorRaf);
    this.floorRaf = requestAnimationFrame(loop);
    draw(0);
    return h("div.cas-floorwrap", null, [cv, h("div.row", null, spots.map((s) => h("button.btn", { onclick: () => { this.tab = s.id; this.msg = ""; this.render(); }, text: s.label })))]);
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
