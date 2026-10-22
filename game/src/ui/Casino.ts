import {canvasStage} from './CanvasStage';
import {CasinoFloor} from './CasinoFloor';
import {drawRouletteTable,rouletteCells,cellQuad,rouletteSurroundingGuests,ROULETTE_W,ROULETTE_H} from './RouletteTableArt';
import {CasinoExtras} from './CasinoExtras';
import {newCityPlay,type CasinoSocial} from '../sim/CityPlay';
import {hospitality,type HospitalityHost} from './VenueHospitality';
import type { Character } from "../entities/types";
import { casinoVenue } from "./VenueArt";
import { h } from "./dom";
import { Blackjack, handValue, isBlackjack } from "../casino/blackjack";
import { Card, Suit, rankLabel, isRed } from "../casino/cards";
import { OUTSIDE, WHEEL_ORDER, colorOf, insideBet, payoutFor, settle, spin as spinWheel, RouletteBet } from "../casino/roulette";
import { VideoPoker, PAYTABLE, PokerHand } from "../casino/poker";
import { PAYS, SYMBOLS, payFor, spinReels, Sym, rtp } from "../casino/slots";

/**
 * The Tessera Casino. Real rules (see src/casino/*), real payouts, chips bought at the cashier.
 * Live play uses Math.random (not the seeded world RNG) like a real shuffle machine.
 * Styles live in ./casino.css (all new markup uses the `cx-` prefix).
 */
export interface CasinoWallet extends HospitalityHost { socialState?():CasinoSocial;tick?():number;guestDrink?(id:number):string; people?(): readonly Character[]; strategy?(): boolean; getCash(): number; setCash(v: number): void; onEvent(text: string, big: boolean): void; patrons(): number }

interface Chip { v: number; c: string; t: string; e: string }
const CHIPS: Chip[] = [
  { v: 1, c: "#efe6d4", t: "#14213d", e: "#2b5fb3" },
  { v: 5, c: "#c8231a", t: "#fff7ea", e: "#fff7ea" },
  { v: 25, c: "#1f7a3a", t: "#fff7ea", e: "#fff7ea" },
  { v: 100, c: "#16110f", t: "#fff7ea", e: "#e9e2d2" },
  { v: 1_000, c: "#b49b68", t: "#111", e: "#eee4d3" },
  { v: 5_000, c: "#854d59", t: "#fff", e: "#d1b986" },
  { v: 25_000, c: "#425968", t: "#fff", e: "#c8b27d" },
  { v: 100_000, c: "#d6c6a6", t: "#151515", e: "#715b35" },
  { v: 500_000, c: "#2e3939", t: "#eee4d3", e: "#c7ae7b" },
  { v: 1_000_000, c: "#8d7760", t: "#fff", e: "#eee4d3" },
  { v: 500, c: "#6b2bc4", t: "#fff7ea", e: "#f6c94c" },
].sort((a,b)=>a.v-b.v);
const rnd = () => Math.random();
const money = (n: number) => "$" + n.toLocaleString("en-NZ", { maximumFractionDigits: 2 });
const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dprOf = () => Math.min(3, window.devicePixelRatio || 1);
const chipVars = (c: Chip) => `--c:${c.c};--t:${c.t};--e:${c.e}`;
const chipLabel = (v: number) => (v >= 1_000_000 ? v / 1_000_000 + "M" : v >= 1000 ? v / 1000 + "K" : String(v));
const SUIT_NAME: Record<Suit, string> = { "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs" };
const RANK_NAME: Record<string, string> = { J: "jack", Q: "queen", K: "king", A: "ace" };

// ------------------------------------------------------------------ shared pieces
/** A canvas whose backing store is scaled by devicePixelRatio; draw in CSS pixels. */
function hdCanvas(w: number, hgt: number, cls: string, label: string): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const d = dprOf();
  const cv = h("canvas." + cls, { width: Math.round(w * d), height: Math.round(hgt * d), role: "img", "aria-label": label, style: `width:${w}px` }) as HTMLCanvasElement;
  const g = cv.getContext("2d")!;
  g.setTransform(d, 0, 0, d, 0, 0);
  return { cv, g };
}

const NS = "http://www.w3.org/2000/svg";
function svg(tag: string, attrs: Record<string, string | number> = {}, kids: (Node | string)[] = []): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) el.append(k);
  return el;
}

/** Pip positions (% of the card) for 2–10, laid out like a standard Anglo-American deck. */
const side = (ys: number[]): [number, number][] => ys.flatMap((y) => [[30, y], [70, y]] as [number, number][]);
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 18], [50, 82]], 3: [[50, 18], [50, 50], [50, 82]], 4: side([18, 82]), 5: [...side([18, 82]), [50, 50]],
  6: side([18, 50, 82]), 7: [...side([18, 50, 82]), [50, 34]], 8: [...side([18, 50, 82]), [50, 34], [50, 66]],
  9: [...side([18, 39, 61, 82]), [50, 50]], 10: [...side([18, 39, 61, 82]), [50, 29], [50, 71]],
};

/** A playing card: corner indices, real pip layout, court frame, or a patterned back. `anim` is ".deal", ".flip" or "". */
function cardEl(c: Card | null, hidden = false, anim = "", delay = 0): HTMLElement {
  const style = delay ? `animation-delay:${delay}ms` : undefined;
  if (!c || hidden) return h("div.cx-card.back" + anim, { role: "img", "aria-label": "face-down card", style });
  const rk = rankLabel(c.rank), su = c.suit + "︎";
  const ix = (cls: string) => h("span.cx-ix" + cls, { "aria-hidden": "true" }, [h("b", { text: rk }), h("i", { text: su })]);
  const mid = c.rank === 14 ? h("span.cx-ace", { text: su })
    : c.rank > 10 ? h("span.cx-court", null, [h("b", { text: rk }), h("i", { text: su }), h("i.dn", { text: su })])
    : h("span.cx-pips", null, PIPS[c.rank].map(([x, y]) => h("i" + (y > 50 ? ".dn" : ""), { style: `left:${x}%;top:${y}%`, text: su })));
  mid.setAttribute("aria-hidden", "true");
  return h("div.cx-card" + (isRed(c) ? ".red" : "") + anim, { role: "img", "aria-label": `${RANK_NAME[rk] ?? rk} of ${SUIT_NAME[c.suit]}`, style }, [ix(""), mid, ix(".br")]);
}

/** Greedy chip breakdown (largest first). Fractions below $1 are shown only in the label. */
function breakdown(amount: number): Chip[] {
  const out: Chip[] = [];
  let r = Math.round(amount * 100) / 100;
  for (const c of [...CHIPS].reverse()) while (r >= c.v - 1e-9 && out.length < 60) { out.push(c); r -= c.v; }
  return out;
}

/** Side-on chip stacks, one column per denomination like a dealer would cut them. */
function stackEl(amount: number, size = "", label = true): HTMLElement {
  const cols: Chip[][] = [];
  for (const c of breakdown(amount)) { const last = cols[cols.length - 1]; if (last && last[0] === c) last.push(c); else cols.push([c]); }
  return h("div.cx-stacks" + size, { role: "img", "aria-label": `${money(amount)} in chips` }, [
    ...cols.slice(0, 3).map((col) => {
      const n = Math.min(col.length, 12);
      return h("div.cx-stack", { style: `--n:${n}` }, col.slice(0, n).map((c, i) => h("i.cx-sc", { style: `${chipVars(c)};--i:${i}`, "data-v": i === n - 1 ? chipLabel(c.v) : null })));
    }),
    label && amount > 0 ? h("b.cx-amt", { text: money(amount) }) : null,
  ]);
}

/** Seven-segment LED meter drawn on an HD canvas. */
const SEG: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g" };
function ledEl(label: string, value: number, color = "#ff4a2e", cells = 8): HTMLElement {
  const cw = 17, chh = 28, pad = 7, W = cells * cw + pad * 2, H = chh + pad * 2;
  const { cv, g } = hdCanvas(W, H, "cx-led", `${label} ${money(value)}`);
  const glyphs: { c: string; dot: boolean }[] = [];
  for (const ch of value.toFixed(2)) { if (ch === "." && glyphs.length) glyphs[glyphs.length - 1].dot = true; else glyphs.push({ c: ch, dot: false }); }
  while (glyphs.length < cells) glyphs.unshift({ c: " ", dot: false });
  g.fillStyle = "#0b0302"; g.fillRect(0, 0, W, H);
  g.lineCap = "round"; g.lineWidth = 3;
  glyphs.slice(-cells).forEach((gl, i) => {
    const x = pad + i * cw + 4, y = pad + 1, w = cw - 9, hh = chh - 3, m = y + hh / 2;
    const sk = (px: number, py: number): [number, number] => [px + (m - py) * 0.12, py];
    const segs: Record<string, number[]> = { a: [x + 2, y, x + w - 2, y], b: [x + w, y + 2, x + w, m - 2], c: [x + w, m + 2, x + w, y + hh - 2], d: [x + 2, y + hh, x + w - 2, y + hh], e: [x, m + 2, x, y + hh - 2], f: [x, y + 2, x, m - 2], g: [x + 2, m, x + w - 2, m] };
    for (const [k, [x1, y1, x2, y2]] of Object.entries(segs)) {
      const on = (SEG[gl.c] ?? "").includes(k);
      g.strokeStyle = on ? color : "rgba(255,80,50,.09)"; g.shadowColor = color; g.shadowBlur = on ? 7 : 0;
      g.beginPath(); g.moveTo(...sk(x1, y1)); g.lineTo(...sk(x2, y2)); g.stroke();
    }
    g.shadowBlur = gl.dot ? 6 : 0; g.fillStyle = gl.dot ? color : "rgba(255,80,50,.09)";
    g.beginPath(); g.arc(x + w + 3.2, y + hh, 1.6, 0, 6.283); g.fill();
  });
  return h("div.cx-meter", null, [h("span", { text: label }), cv]);
}

function symEl(s: string): HTMLElement {
  if (s === "7") return h("span.cx-sym.s7", { text: "7" });
  if (s === "BAR") return h("span.cx-sym.sbar", { text: "BAR" });
  if (s === "any") return h("span.cx-sym.sany", { text: "ANY" });
  return h("span.cx-sym", { text: s });
}
const reelWindow = (s: Sym): Sym[] => { const others = SYMBOLS.filter((x) => x !== s); const pick = () => others[Math.floor(Math.random() * others.length)]; return [pick(), s, pick()]; };

// The wheel: a cached bowl and rotor (drawn once per size/DPR) composited each frame with the ball.
const WHEEL_PX = 300, TRACK_R = 129, POCKET_R = 86;
let wheelCache: { key: number; bowl: HTMLCanvasElement; rotor: HTMLCanvasElement } | null = null;
function wheelLayers(): { bowl: HTMLCanvasElement; rotor: HTMLCanvasElement } {
  const d = dprOf();
  if (wheelCache && wheelCache.key === d) return wheelCache;
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = Math.round(WHEEL_PX * d); const g = c.getContext("2d")!; g.setTransform(d, 0, 0, d, 0, 0); g.translate(WHEEL_PX / 2, WHEEL_PX / 2); return { c, g }; };
  const ring = (g: CanvasRenderingContext2D, r: number, fill: string | CanvasGradient) => { g.fillStyle = fill; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); };
  const B = mk(), b = B.g;
  const wood = b.createRadialGradient(0, 0, 120, 0, 0, 150); wood.addColorStop(0, "#3a1d0c"); wood.addColorStop(0.55, "#7a4019"); wood.addColorStop(0.8, "#a8612a"); wood.addColorStop(1, "#4a240e");
  ring(b, 150, wood);
  const track = b.createRadialGradient(0, -30, 90, 0, 0, 142); track.addColorStop(0, "#1a0e07"); track.addColorStop(0.85, "#4b2a15"); track.addColorStop(1, "#2a160a");
  ring(b, 141, track);
  b.strokeStyle = "rgba(255,226,160,.5)"; b.lineWidth = 1; b.beginPath(); b.arc(0, 0, 141, 0, 6.2832); b.stroke();
  b.strokeStyle = "rgba(255,236,190,.12)"; b.lineWidth = 6; b.beginPath(); b.arc(0, 0, 133, 3.6, 5.4); b.stroke(); // polish highlight
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832; b.fillStyle = "#d9b35a"; b.beginPath(); b.ellipse(Math.cos(a) * 122, Math.sin(a) * 122, 3, 6, a, 0, 6.2832); b.fill(); } // deflectors
  const R = mk(), g = R.g, n = WHEEL_ORDER.length, step = (Math.PI * 2) / n;
  ring(g, 118, "#c99b3f");
  for (let i = 0; i < n; i++) {
    const num = WHEEL_ORDER[i], a0 = i * step - Math.PI / 2, col = colorOf(num);
    const base = col === "green" ? "#1d7a37" : col === "red" ? "#b5141c" : "#141012";
    for (const [r0, r1, f] of [[96, 116, base], [76, 96, col === "green" ? "#145a28" : col === "red" ? "#8e0f15" : "#0b090a"]] as [number, number, string][]) {
      g.fillStyle = f; g.beginPath(); g.arc(0, 0, r1, a0, a0 + step); g.arc(0, 0, r0, a0 + step, a0, true); g.closePath(); g.fill();
    }
    g.save(); g.rotate(a0 + step / 2); g.translate(106, 0); g.rotate(Math.PI / 2);
    g.fillStyle = "#fff7ea"; g.font = "700 10.5px 'IBM Plex Mono', ui-monospace, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(num), 0, 0.5); g.restore();
    g.strokeStyle = "#e7c46a"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(Math.cos(a0) * 76, Math.sin(a0) * 76); g.lineTo(Math.cos(a0) * 116, Math.sin(a0) * 116); g.stroke();
  }
  g.strokeStyle = "#e7c46a"; g.lineWidth = 1.5; for (const r of [76, 96, 116]) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); }
  const cone = g.createRadialGradient(-18, -22, 4, 0, 0, 76); cone.addColorStop(0, "#c98a4a"); cone.addColorStop(0.5, "#7a4019"); cone.addColorStop(1, "#3a1d0c");
  ring(g, 75, cone);
  g.strokeStyle = "rgba(255,226,160,.35)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 52, 0, 6.2832); g.stroke();
  const gold = g.createLinearGradient(-40, -40, 40, 40); gold.addColorStop(0, "#fff0b8"); gold.addColorStop(0.5, "#d4a640"); gold.addColorStop(1, "#7a5a18");
  g.strokeStyle = gold; g.lineWidth = 5; g.lineCap = "round";
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); g.stroke(); g.fillStyle = gold; g.beginPath(); g.arc(Math.cos(a) * 46, Math.sin(a) * 46, 5, 0, 6.2832); g.fill(); }
  ring(g, 11, gold);
  wheelCache = { key: d, bowl: B.c, rotor: R.c };
  return wheelCache;
}

type RMode = "straight" | "split" | "street" | "corner" | "line";

export class Casino {
  beforeOpen: () => boolean = () => true;
  el: HTMLElement;
  private localChips=0;private socialFallback=newCityPlay().casino;private extra:CasinoExtras;
  private get social():CasinoSocial{return this.w.socialState?.()??this.socialFallback;}
  get chips():number{return this.w.socialState?this.social.chips:this.localChips;}
  set chips(n:number){const value=Math.round(Math.max(0,n)*100)/100;if(this.w.socialState)this.social.chips=value;else this.localChips=value;}
  private highLimit = false;
  private get tableLimit():number { return this.highLimit ? 5_000_000 : 500; }
  private get activeChips():Chip[] { return CHIPS.filter(c => this.highLimit || c.v <= 500); }
  private get bought():number{return this.social.bought??0;}private set bought(n:number){this.social.bought=n;}
  private get cashedOut():number{return this.social.cashedOut??0;}private set cashedOut(n:number){this.social.cashedOut=n;}
  private tab = "floor";
  private venueOutside = false;private floor=new CasinoFloor();
  private body: HTMLElement;
  private chipSel = 5;
  private bj = new Blackjack(rnd);
  private bjBet = 0;
  private bjHint = false;
  private bjSeen = new WeakSet<Card>();
  private bjHoleShown = false;
  private rBets: RouletteBet[] = [];private rUndo:{id:string;amount:number}[]=[];
  private rMode: RMode = "straight";
  private rPending = -1;
  private rHistory: number[] = [];
  private rSpinning = false;
  private rLast = -1;private rHovered='';private rNumber=7;private rOutside='red';private rServicesOpen=false;private rBetView=false;private rPage=0;
  private rRot = 0; private rBall = -Math.PI / 2; private rBallR = TRACK_R;
  private vp = new VideoPoker(rnd);
  private vpCoins = 5; private vpValue = 1; private vpWin = 0; private vpFresh = [false, false, false, false, false];
  private slotBet = 1; private reels: Sym[] = ["7", "7", "7"]; private reelWin: Sym[][] = [reelWindow("7"), reelWindow("7"), reelWindow("7")];
  private reelStopped = [true, true, true]; private slotMsg = ""; private slotSpinning = false; private slotWin = 0; private slotHit = -1;
  private results: { game: string; net: number }[] = [];
  private msg = "";
  open = false;
  onMoreGames?: () => void;

  constructor(private w: CasinoWallet, private onClose: () => void) {
    this.extra=new CasinoExtras({state:()=>this.social,people:()=>this.w.people?.()??[],tick:()=>this.w.tick?.()??0,cash:()=>this.w.getCash(),setCash:n=>this.w.setCash(n),chips:()=>this.chips,setChips:n=>{this.chips=n;},render:()=>this.render(),buyChips:n=>{if(this.w.getCash()<n)return false;this.w.setCash(this.w.getCash()-n);this.chips+=n;this.bought+=n;return true;},guestDrink:id=>this.w.guestDrink?.(id)??'They decline for now.'});
    this.body = h("div.cas-body");
    this.el = h("div.casino.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "The Tessera Casino" }, []);
  }

  show(): void { if (!this.beforeOpen()) return; this.bjHint = this.w.strategy?.() ?? this.bjHint; this.open = true; this.tab = "floor"; this.el.classList.remove("hidden"); this.render(); }
  close(): void {
    if(this.extra.locked()){this.msg="Finish your hand or flight first. Tournament entries can be forfeited at the poker table between hands.";this.render();return;}
    this.extra.leave();if(this.social.sideBet){this.chips+=this.social.sideBet.stake;this.social.sideBet=undefined;}
    if (this.bj.phase === "player" || this.bj.phase === "insurance") { this.msg = "Finish the hand first."; this.render(); return; }
    if (this.vp.phase === "draw") { this.msg = "Draw your replacement cards before leaving."; this.render(); return; }
    if (this.rSpinning || this.slotSpinning) return;
    // the cashier cashes your chips out on the way out
    for (const b of this.rBets) this.chips += b.amount;
    this.rBets = [];this.rUndo=[];
    if (this.chips > 0) { this.w.setCash(this.w.getCash() + this.chips); this.cashedOut += this.chips; this.chips = 0; }
    const net = this.cashedOut - this.bought;
    if (this.bought > 0) this.w.onEvent(net >= 0 ? `You walked out of the Tessera ${money(net)} up` : `You left the Tessera ${money(-net)} down`, Math.abs(net) >= 200);
    this.bought = 0; this.cashedOut = 0;
    this.open = false; this.el.classList.add("hidden"); this.onClose();
  }

  private take(n: number): boolean { if (!Number.isFinite(n) || n <= 0) return false; if (n > this.chips + 1e-9) { this.msg = "Not enough chips. Visit the cashier."; return false; } this.chips -= n; return true; }
  private go(tab: string): void {
    if (this.extra.locked() || this.rSpinning || this.slotSpinning || this.bj.phase === "player" || this.bj.phase === "insurance" || this.vp.phase === "draw") {
      this.msg = "Finish your current round before changing tables."; this.render(); return;
    }
    this.tab = tab; this.msg = "";this.rServicesOpen=false;this.render();
  }
  private record(game: string, net: number): void {
    this.extra.round(game,net,game==="Roulette"?this.rLast:undefined);
    this.results.unshift({ game, net }); this.results.length = Math.min(8, this.results.length);
  }

  private render(): void {
    const tabs = [["floor", "Lobby", "◈"], ["blackjack", "Blackjack", "♠"], ["roulette", "Roulette", "◎"], ["pokies", "Kiwi Gold", "7"], ["poker", "Video poker", "♦"], ["holdem", "Poker tables", "♣"], ["flight", "Crash flight", "✈"], ["cashier", "Cashier", "$"]];
    const nav = h("nav.cas-tabs", { role: "tablist", "aria-label": "Casino areas" }, tabs.map(([id, l, icon]) => h("button" + (this.tab === id ? ".on" : ""), { role: "tab", "aria-selected": String(this.tab === id), onclick: () => this.go(id) }, [h("span", { text: icon, "aria-hidden": "true" }), l])));
    if (this.onMoreGames) nav.append(h("button", { text: "More games & racing", onclick: () => { this.close(); if (!this.open) this.onMoreGames?.(); } }));
    const head = h("header.cas-head", null, [
      h("div", null, [h("h2", { text: "The Tessera" }), h("p.cas-sub", { text: "ŌTAUTAHI / AFTER HOURS · GAME CURRENCY" }), this.btn(this.highLimit ? "Private salon · up to $5M" : "Standard tables · up to $500", () => { if(this.extra.locked() || this.rBets.length || this.bj.phase === "player" || this.bj.phase === "insurance" || this.rSpinning || this.slotSpinning || this.vp.phase === "draw"){this.msg="Finish or clear the round before changing limits.";}else{this.highLimit=!this.highLimit;this.chipSel=this.highLimit?100_000:5;this.bjBet=0;this.slotBet=1;this.vpValue=1;}this.render(); }, {aria:"Change table limits"})]),
      h("div.cas-bank", null, [h("span", { text: "Chips" }), h("b", { text: money(this.chips) }), h("span", { text: "Cash" }), h("b", { text: money(this.w.getCash()) })]),
      h("button.x", { "aria-label": "Leave the casino", onclick: () => this.close(), text: "×" }),
    ]);
    let view: HTMLElement;
    switch (this.tab) {
      case "blackjack": view = this.blackjackView(); break;
      case "roulette": view = this.rouletteView(); break;
      case "pokies": view = this.pokiesView(); break;
      case "poker": view = this.pokerView(); break;
      case "holdem": view=this.extra.holdem();break;
      case "flight": view=this.extra.flight();view.append(this.tableServices("Flight",this.extra.locked()));break;
      case "floor": view = this.lobbyView(); break;
      default: view = this.cashierView();
    }
    const pending = this.rBets.reduce((sum, b) => sum + b.amount, 0);
    const round = this.bj.phase === "player" || this.bj.phase === "insurance";
    const pokerStack=this.social.poker&&!this.social.poker.claimed?this.social.poker.seats[0].stack+(this.social.poker.phase==='betting'?this.social.poker.seats[0].paid:0):0,flightStake=this.social.flight&&!this.social.flight.paid?this.social.flight.stake:0,sideStake=this.social.sideBet?.stake??0;
    const atRisk = pokerStack+flightStake+sideStake+pending + (round ? this.bj.hands.reduce((sum, hand) => sum + hand.bet, 0) + this.bj.insurance : 0) + (this.vp.phase === "draw" ? this.vpCoins * this.vpValue : 0) + (this.slotSpinning ? this.slotBet : 0);
    const net = this.chips + atRisk + this.cashedOut - this.bought;
    const session = h("aside.cas-session", null, [h("small", { text: "YOUR SESSION" }),
      h("div", null, [h("span", { text: "Chips available" }), h("strong", { text: money(this.chips) })]),
      h("div", null, [h("span", { text: "On the table" }), h("b", { text: money(atRisk) })]),
      h("div", null, [h("span", { text: "Session result" }), h("b", { text: `${net >= 0 ? "+" : "−"}${money(Math.abs(net))}`, class: net >= 0 ? "positive" : "negative" })]),
      this.btn("Visit cashier →", () => this.go("cashier"), { disabled: round || this.rSpinning || this.slotSpinning || this.vp.phase === "draw" }),
      h("h3", { text: "Recent rounds" }),
      ...this.results.map(result => h("div.cas-round", null, [h("span", { text: result.game }), h("b", { text: `${result.net >= 0 ? "+" : "−"}${money(Math.abs(result.net))}`, class: result.net >= 0 ? "positive" : "negative" })])),
      !this.results.length ? h("p", { text: "Your first round is still ahead of you." }) : null,
      h("p.cas-fiction", { text: "Game dollars only. Your wallet follows you back into the city." }),
    ]);
    if(window.innerWidth<=640)requestAnimationFrame(()=>nav.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'}));
    this.body.id = "casino-table"; this.body.setAttribute("role", "tabpanel"); this.body.setAttribute("aria-label", tabs.find(t => t[0] === this.tab)?.[1] ?? "Cashier");
    if(["blackjack","pokies","poker"].includes(this.tab))view=h("div.casino-live-table",null,[this.extra.crowd(this.tab,this.rSpinning||this.slotSpinning),view]);
    if(this.tab==="cashier")view.append(this.extra.social(this.rSpinning));
    this.body.replaceChildren(h("div.cas-view-title", null, [h("small", { text: this.tab === "floor" ? "WELCOME BACK" : "THE TESSERA / TABLE GAMES" }), h("h2", { text: tabs.find(t => t[0] === this.tab)?.[1] ?? "Cashier" })]), this.msg ? h("p.cas-msg", { role: "status", text: this.msg }) : h("span"), view);
    this.el.replaceChildren(h("div.cas-frame.cx"+(["floor","flight","holdem","roulette"].includes(this.tab)?".cas-table-frame":""), null, [head, h("div.cas-layout", null, [h("aside.cas-sidebar", null, [nav, session]), this.body]), h("footer.cas-foot", { text: "THE TESSERA · Fictional casino · No real money · Finish your round, then leave to cash out automatically." })]));
  }

  // ------------------------------------------------------------------ the floor
  /** Clickable cutaway floor and exterior use the same figures and materials as the street. */
  private lobbyView(): HTMLElement {
    if(this.venueOutside)return h('section.iso-game.iso-casino-floor',null,[casinoVenue(()=>{this.venueOutside=false;this.render();},true,this.w.patrons(),this.w.people?.()??[]),h('div.iso-table-console',null,[this.btn('Casino interior',()=>{this.venueOutside=false;this.render();})])]);
    const view=this.floor.view(this.w.people?.()??[],id=>this.go(id),id=>{if(id!==undefined)this.extra.selectGuest(id);this.rServicesOpen=true;this.render();});
    view.append(this.tableServices('Casino floor',false));view.querySelector('.venue-service-actions')?.append(this.btn('Casino exterior',()=>{this.venueOutside=true;this.render();}));return view;
  }
  private tableServices(game:string,locked:boolean,barLocked=locked):HTMLElement{return h('details.iso-table-popover',{open:this.rServicesOpen,ontoggle:(e:Event)=>{this.rServicesOpen=(e.target as HTMLDetailsElement).open;}},[h('summary',{text:'Players, bar & credit'}),this.extra.crowd(game,locked,false),hospitality(this.w,barLocked,false),this.extra.social(locked)]);}

  private chipRow(): HTMLElement {
    return h("div.cx-chiprow", { role: "group", "aria-label": "Chip value" }, this.activeChips.map((c) => h("button.cx-chip" + (this.chipSel === c.v ? ".sel" : ""), {
      style: chipVars(c), "aria-pressed": String(this.chipSel === c.v), "aria-label": `${money(c.v)} chip`, onclick: () => { this.chipSel = c.v; this.render(); },
    }, [h("span", { text: chipLabel(c.v) })])));
  }

  private btn(label: string, onclick: () => void, opts: { cls?: string; disabled?: boolean; aria?: string;pressed?:boolean } = {}): HTMLElement {
    return h("button.cx-btn" + (opts.cls ?? ""), { onclick, disabled: !!opts.disabled, "aria-label": opts.aria ?? label,"aria-pressed":opts.pressed===undefined?undefined:String(opts.pressed), text: label });
  }

  // ------------------------------------------------------------------ cashier
  private cashierView(): HTMLElement {
    const buy = (n: number) => { const cash = this.w.getCash(); const amt = Math.min(n, Math.floor(cash)); if (amt <= 0) { this.msg = "You're out of cash."; this.render(); return; } this.w.setCash(cash - amt); this.chips += amt; this.bought += amt; this.msg = `Bought ${money(amt)} in chips.`; this.render(); };
    const held = breakdown(this.chips);
    const tray = h("div.cx-tray-cage", { role: "group", "aria-label": "Chip tray: your chips by denomination. Pick one to bet with." }, [...CHIPS].reverse().map((c) => {
      const n = held.filter((x) => x === c).length;
      return h("button.cx-groove" + (this.chipSel === c.v ? ".sel" : ""), { "aria-label": `${n} × ${money(c.v)} chips. Bet with ${money(c.v)}`, "aria-pressed": String(this.chipSel === c.v), onclick: () => { this.chipSel = c.v; this.render(); } }, [
        n ? h("div.cx-stacks", { "aria-hidden": "true" }, [h("div.cx-stack", { style: `--n:${Math.min(n, 12)}` }, Array.from({ length: Math.min(n, 12) }, (_, i) => h("i.cx-sc", { style: `${chipVars(c)};--i:${i}`, "data-v": i === Math.min(n, 12) - 1 ? chipLabel(c.v) : null })))])
          : h("i.cx-ghost", { style: chipVars(c), "aria-hidden": "true" }),
        h("span", { text: `${money(c.v)} × ${n}` }),
      ]);
    }));
    return h("section.cx-cage", null, [
      h("div.cx-window", null, [
        h("div.cx-cage-sign", { text: "CASHIER · CAGE" }),
        h("p", { text: "Swap cash for chips here. Whatever chips you have left are cashed out when you leave." }),
        tray,
        h("div.cx-row", null, (this.highLimit ? [10_000,100_000,1_000_000,5_000_000,10_000_000] : [20,50,100,250,500]).map((n) => this.btn(`Buy ${money(n)}`, () => buy(n), { cls: ".gold", aria: `Buy ${money(n)} in chips` }))),
        h("div.cx-row", null, [this.btn("Cash out chips", () => { if (this.chips > 0) { this.w.setCash(this.w.getCash() + this.chips); this.cashedOut += this.chips; this.msg = `Cashed out ${money(this.chips)}.`; this.chips = 0; this.render(); } }, { disabled: this.chips <= 0 })]),
      ]),
      h("h3", { text: "House rules" }),
      h("ul.cas-rules", null, [
        "Blackjack: 6 decks, dealer stands on soft 17, blackjack pays 3:2, insurance 2:1, double any two cards, split to 4 hands, late surrender. Limits $5–$5,000,000 in the private salon; standard maximum $500. House edge ≈ 0.5% with basic strategy.",
        "Roulette: European single zero. Straight 35:1, split 17:1, street 11:1, corner 8:1, six line 5:1, dozens/columns 2:1, even money 1:1. House edge 2.70%.",
        `Pokies "Kiwi Gold": 3 reels, one line. Return to player ${(rtp() * 100).toFixed(1)}%.`,
        "Video poker: Jacks or Better, 9/6 full pay (99.5% with perfect play). 5 coins for the 4,000-coin royal.",
      ].map((t) => h("li", { text: t }))),
    ]);
  }

  // ------------------------------------------------------------------ blackjack
  private blackjackView(): HTMLElement {
    const bj = this.bj, inRound = bj.phase === "player" || bj.phase === "insurance";
    // Animate only cards this view hasn't shown yet: deal order P, D, P, D on a fresh round; the hole card flips over before the dealer draws.
    const isNew = (c: Card) => !this.bjSeen.has(c);
    const pNew = bj.hands.flatMap((hd) => hd.cards.filter(isNew)), dNew = bj.dealer.filter(isNew);
    const order = pNew.length === 2 && dNew.length === 2 ? [pNew[0], dNew[0], pNew[1], dNew[1]] : [...pNew, ...dNew];
    const flipHole = bj.holeRevealed && !this.bjHoleShown && bj.dealer.length > 1 && !isNew(bj.dealer[1]);
    const delay = new Map(order.map((c, i) => [c, (flipHole ? 500 : 0) + i * 240]));
    for (const c of order) this.bjSeen.add(c);
    this.bjHoleShown = bj.holeRevealed;
    const mk = (c: Card, hidden = false) => { const d = delay.get(c); return cardEl(c, hidden, d !== undefined ? ".deal" : flipHole && c === bj.dealer[1] ? ".flip" : "", d ?? 0); };
    const total = (cards: Card[], natural: boolean) => { const v = handValue(cards); return natural && isBlackjack(cards) ? "Blackjack" : v.total > 21 ? `Bust · ${v.total}` : (v.soft && v.total < 21 ? "soft " : "") + v.total; };
    const up = bj.dealer[0];
    const dTotal = !up ? "" : bj.holeRevealed ? total(bj.dealer, true) : `showing ${up.rank === 14 ? "A" : handValue([up]).total}`;

    const shoePct = Math.min(1, bj.shoe.dealt / (bj.shoe.cards.length * 0.75));
    const top = h("div.cx-bj-top", null, [
      h("div.cx-discard", { role: "img", "aria-label": `Discard tray, ${bj.shoe.dealt} cards played` }, [h("i", { style: `height:${Math.round(shoePct * 100)}%` })]),
      h("div.cx-rack", { role: "img", "aria-label": "Dealer's chip rack" }, [500, 100, 100, 25, 25, 25, 5, 5, 5, 1, 1].map((v) => h("i", { style: chipVars(CHIPS.find((c) => c.v === v)!) }))),
      h("div.cx-shoe", { role: "img", "aria-label": `Card shoe, ${bj.shoe.remaining} cards left${bj.shoe.needsShuffle ? ", shuffle due" : ""}` }, [h("i"), h("span", { text: `${bj.shoe.remaining}${bj.shoe.needsShuffle ? " · cut" : ""}` })]),
    ]);
    const dealer = h("div.cx-dealer", null, [
      h("div.cx-cards", null, bj.dealer.map((c, i) => mk(c, i === 1 && !bj.holeRevealed))),
      dTotal ? h("span.cx-total", { text: `Dealer ${dTotal}` }) : null,
    ]);
    const arc = (id: string, d: string) => svg("path", { id, d, fill: "none" });
    const tp = (href: string, text: string, cls: string) => svg("text", { class: cls }, [svg("textPath", { href: "#" + href, startOffset: "50%", "text-anchor": "middle" }, [text])]);
    const print = svg("svg", { class: "cx-print", viewBox: "0 0 1000 250", role: "img", "aria-label": "Blackjack pays 3 to 2. Dealer must stand on soft 17. Insurance pays 2 to 1." }, [
      arc("cx-a1", "M 70 34 Q 500 150 930 34"), arc("cx-a2", "M 150 88 Q 500 200 850 88"), arc("cx-a3", "M 230 160 Q 500 262 770 160"),
      svg("path", { class: "cx-ins", d: "M 200 126 Q 500 240 800 126" }), svg("path", { class: "cx-ins", d: "M 220 178 Q 500 296 780 178" }),
      tp("cx-a1", "BLACKJACK PAYS 3 TO 2", "t1"), tp("cx-a2", "DEALER MUST STAND ON SOFT 17", "t2"), tp("cx-a3", "INSURANCE PAYS 2 TO 1", "t3"),
    ]);
    const addChip = () => { if (this.bjBet + this.chipSel > this.tableLimit) { this.msg = `Table limit is ${money(this.tableLimit)}.`; } else this.bjBet += this.chipSel; this.render(); };
    const spots = (bj.hands.length ? bj.hands : [null]).map((hd, i) => {
      const settled = bj.phase === "settled" && hd?.result;
      const stake = inRound ? hd?.bet ?? 0 : i === 0 ? this.bjBet : 0;
      const circle = inRound
        ? h("div.cx-circle", { role: "img", "aria-label": `Bet ${money(stake)}` }, [stackEl(stake)])
        : h("button.cx-circle.open", { "aria-label": `Betting circle, ${money(stake)}. Add a ${money(this.chipSel)} chip`, onclick: addChip }, [stake ? stackEl(stake) : h("span", { text: "BET" })]);
      return h("div.cx-spot" + (inRound && i === bj.active && bj.phase === "player" ? ".active" : ""), null, [
        hd ? h("div.cx-cards.fan", null, hd.cards.map((c) => mk(c))) : null,
        hd && hd.cards.length ? h("span.cx-total", { text: total(hd.cards, !hd.fromSplit) + (hd.doubled ? " · doubled" : "") }) : null,
        settled && hd ? h("span.cx-result." + hd.result, { text: `${hd.result!.toUpperCase()}${hd.payout! - hd.bet ? ` ${hd.payout! - hd.bet > 0 ? "+" : "−"}${money(Math.abs(hd.payout! - hd.bet))}` : ""}` }) : null,
        circle,
      ]);
    });
    const insurance = bj.insurance > 0 && inRound ? h("div.cx-insure", null, [stackEl(bj.insurance, ".sm"), h("span", { text: "insured" })]) : null;
    const table = h("section.cx-bj", { "aria-label": "Blackjack table" }, [h("div.cx-felt", null, [top, dealer, print, insurance, h("div.cx-spots", null, spots)])]);

    const act = (fn: () => number | void) => () => { this.msg = ""; const extra = fn(); if (typeof extra === "number" && extra > 0) { if (!this.take(extra)) { this.render(); return; } } this.finishBJ(); this.render(); };
    const hint = bj.phase === "player" && this.bjHint ? bj.hint() : "";
    const rec = (k: string) => (hint === k ? ".rec" : "");
    let controls: (HTMLElement | null)[];
    if (bj.phase === "insurance") {
      const cost = bj.hands[0].bet / 2;
      controls = [h("p.cx-say", { text: "Dealer shows an ace. Insurance?" }), h("div.cx-row", null, [
        this.btn(`Insurance ${money(cost)}`, () => { if (this.take(cost)) bj.takeInsurance(true); this.finishBJ(); this.render(); }, { cls: ".gold", disabled: this.chips < cost, aria: `Take insurance for ${money(cost)}` }),
        this.btn("No insurance", () => { bj.takeInsurance(false); this.finishBJ(); this.render(); }),
      ])];
    } else if (inRound) {
      controls = [h("div.cx-row", null, [
        this.btn("Hit", act(() => bj.hit()), { cls: rec("hit"), disabled: !bj.canHit() }),
        this.btn("Stand", act(() => bj.stand()), { cls: rec("stand") }),
        this.btn("Double", act(() => (this.chips >= bj.hand.bet ? bj.double() : 0)), { cls: rec("double"), disabled: !bj.canDouble() || this.chips < bj.hand.bet, aria: `Double down for ${money(bj.hand.bet)}` }),
        this.btn("Split", act(() => (this.chips >= bj.hand.bet ? bj.split() : 0)), { cls: rec("split"), disabled: !bj.canSplit() || this.chips < bj.hand.bet, aria: `Split for ${money(bj.hand.bet)}` }),
        this.btn("Surrender", act(() => bj.surrender()), { cls: rec("surrender"), disabled: !bj.canSurrender(), aria: "Surrender half your bet" }),
      ]), hint ? h("p.cx-strat", { role: "status", text: `Strategy card: ${hint.toUpperCase()}` }) : null];
    } else {
      controls = [this.chipRow(), h("div.cx-row", null, [
        this.btn(`+ ${money(this.chipSel)}`, addChip, { aria: `Add a ${money(this.chipSel)} chip to your bet` }),
        this.btn("Clear", () => { this.bjBet = 0; this.render(); }, { disabled: !this.bjBet, aria: "Clear your bet" }),
        this.btn(`Deal ${money(this.bjBet || this.chipSel)}`, () => this.dealBJ(), { cls: ".red.big", aria: `Deal a hand for ${money(this.bjBet || this.chipSel)}` }),
      ])];
    }
    const hintBox = h("label.cx-hintbox", null, [h("input", { type: "checkbox", checked: this.bjHint, disabled: !this.w.strategy?.(), onchange: (e: Event) => { this.bjHint = (e.target as HTMLInputElement).checked; this.render(); } }), this.w.strategy?.() ? " Basic-strategy card" : " Strategy card: unlock in Life & upgrades → Skills"]);
    return h("div.cx-wrap", null, [table, h("div.cx-controls", null, [...controls, hintBox])]);
  }

  private dealBJ(): void {
    const bet = this.bjBet || this.chipSel;
    if (bet < 5 || bet > this.tableLimit) { this.msg = `Table limits are $5–${money(this.tableLimit)}.`; this.render(); return; }
    if (!this.take(bet)) { this.render(); return; }
    this.bjBet = bet;
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
    this.record("Blackjack", net);
    this.msg = net > 0 ? `You win ${money(net)}.` : net < 0 ? `Dealer takes ${money(-net)}.` : "Push.";
    if (this.bj.hands.some((x) => x.result === "blackjack")) this.msg = `Blackjack! ${this.msg}`;
    if (net >= 250) this.w.onEvent(`Big blackjack win at the Tessera: ${money(net)}`, true);
    this.bj.settledBack = 0; this.bj.insurance = 0;
  }

  // ------------------------------------------------------------------ roulette
  private rouletteView(): HTMLElement {
    const { cv: wheel } = hdCanvas(WHEEL_PX, WHEEL_PX, "cx-wheel", this.rLast >= 0 ? `Roulette wheel. Last result ${this.rLast} ${colorOf(this.rLast)}` : "European roulette wheel");
    this.drawWheel(wheel);
    const place = (nums: number[] | null, label: string) => {
      if (this.rSpinning) return;
      if (!nums) { this.msg = "That isn't a valid bet on the layout."; this.render(); return; }
      if (this.rBets.reduce((n,b)=>n+b.amount,0)+this.chipSel>this.tableLimit*2) {this.msg=`Table exposure limit ${money(this.tableLimit*2)}.`;this.render();return;}
      if (!this.take(this.chipSel)) { this.render(); return; }
      const id = nums.join("-");
      const ex = this.rBets.find((b) => b.id === id);
      if (ex) ex.amount += this.chipSel; else this.rBets.push({ id, label, numbers: nums, amount: this.chipSel });
      this.rUndo.push({id,amount:this.chipSel});this.msg = `${label} (${payoutFor(nums)}:1)`; this.render();
    };
    const clickNumber = (n: number) => {
      if (this.rMode === "straight") return place(insideBet("straight", n), `Straight ${n}`);
      if (this.rMode === "split") { if (this.rPending < 0) { this.rPending = n; this.msg = `Split: now pick a number next to ${n}`; this.render(); return; } const a = this.rPending; this.rPending = -1; return place(insideBet("split", a, n), `Split ${a}/${n}`); }
      if (this.rMode === "street") { const s = insideBet("street", n); return place(s, `Street ${s?.join("-")}`); }
      if (this.rMode === "corner") { const s = insideBet("corner", n); return place(s, `Corner ${s?.join("-")}`); }
      const s = insideBet("line", n); return place(s, `Six line ${s ? s[0] + "–" + s[5] : ""}`);
    };
    const totalBet=this.rBets.reduce((sum,b)=>sum+b.amount,0),overlay=h('div.iso-table-hitplane',{'aria-label':'Roulette layout',role:'group',style:`width:${ROULETTE_W}px;height:${ROULETTE_H}px`});
    for(const c of rouletteCells){const q=cellQuad(c),xs=q.map(p=>p[0]),ys=q.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y,clip=q.map(p=>`${(p[0]-x)/width*100}% ${(p[1]-y)/height*100}%`).join(',');
      overlay.append(h('button.iso-wager-hit',{style:`left:${x}px;top:${y}px;width:${width}px;height:${height}px;clip-path:polygon(${clip})`,title:c.n!==undefined?c.n+' '+colorOf(c.n):OUTSIDE[c.key].label,'aria-label':c.n!==undefined?c.n+' '+colorOf(c.n):OUTSIDE[c.key].label,disabled:this.rSpinning,onpointerenter:()=>{this.rHovered=c.key;},onpointerleave:()=>{this.rHovered='';},onblur:()=>{this.rHovered='';},onfocus:()=>{this.rHovered=c.key;},onclick:()=>c.n!==undefined?clickNumber(c.n):place(OUTSIDE[c.key].numbers,OUTSIDE[c.key].label)}));
    }
    const betOn=(numbers:number[])=>this.rBets.filter(b=>b.numbers.length===numbers.length&&numbers.every(n=>b.numbers.includes(n))).reduce((sum,b)=>sum+b.amount,0);
    const precise=h('div.precision-roulette',{'aria-label':'Flat roulette betting layout'},[
      h('div.precision-head',null,[h('strong',{text:'Place your chips'}),h('select',{'aria-label':'Roulette number range',onchange:(e:Event)=>{this.rPage=+(e.target as HTMLSelectElement).value;this.render();}},['1–12','13–24','25–36'].map((text,i)=>h('option',{value:i,selected:this.rPage===i,text}))),h('span',{text:'Single zero · select a chip, then a number'})]),
      h('div.precision-numbers',null,Array.from({length:37},(_,n)=>{const amount=betOn([n]);return h('button.precision-number.'+colorOf(n)+(n===0?'.zero':'')+(n>0&&Math.floor((n-1)/12)===this.rPage?'.range-on':'')+(this.rPending===n?'.pending':'')+(!this.rSpinning&&this.rLast===n?'.win':''),{style:n?`--col:${2+Math.floor((n-1)/3)};--row:${3-(n-1)%3};--mcol:${2+(n-1)%3};--mrow:${1+Math.floor((n-1)%12/3)}`:undefined,'aria-label':n+' '+colorOf(n),disabled:this.rSpinning,onclick:()=>clickNumber(n)},[h('b',{text:String(n)}),amount?h('span.precision-stack',{text:chipLabel(amount),title:money(amount)}):null]);})),
      h('div.precision-outside',null,Object.entries(OUTSIDE).map(([key,o])=>{const amount=betOn(o.numbers);return h('button.precision-outside-bet.'+key,{'aria-label':o.label,disabled:this.rSpinning,onclick:()=>place(o.numbers,o.label)},[o.label,amount?h('span.precision-stack',{text:chipLabel(amount)}):null]);}))
    ]);
    const scene=canvasStage((g,time,reduced)=>{this.drawWheel(wheel);const state=this.social;drawRouletteTable(g,{wheel,bets:this.rBets,last:this.rLast,spinning:this.rSpinning,hover:this.rHovered||String(this.rPending),people:this.w.people?.()??[],guests:this.extra.guests(),player:this.w.people?.().find(c=>c.tier==='player'),dealer:this.w.dealer?.(),recent:Date.now()-state.lastAt<6000,net:state.lastNet},time,reduced);},{width:ROULETTE_W,height:ROULETTE_H,overlay,label:'Isometric roulette casino room with wheel, betting cloth, bar, lounge, slots, Mosaic women and men, chips and croupier',pointer:p=>{if(p.type!=='up')return;const members=rouletteSurroundingGuests(this.w.people?.()??[],[...this.extra.guests().slice(0,3).map(a=>a.id),this.w.dealer?.()?.id??-1]);for(const a of members){const x=ROULETTE_W/2+(a.x-a.y)*52,y=390+(a.x+a.y)*26-(a.seated?1.1:1.5)*64;if(Math.hypot(p.x-x,p.y-y)<35){this.extra.selectGuest(a.c.id);this.rServicesOpen=true;this.render();return;}}}});
    const mode=h('select',{'aria-label':'Bet type',disabled:this.rSpinning,onchange:(e:Event)=>{this.rMode=(e.target as HTMLSelectElement).value as RMode;this.rPending=-1;this.render();}},(['straight','split','street','corner','line'] as const).map(m=>h('option',{value:m,selected:this.rMode===m,text:m==='line'?'Six line':m[0].toUpperCase()+m.slice(1)})));
    const number=h('select',{'aria-label':'Roulette number',disabled:this.rSpinning,onchange:(e:Event)=>{this.rNumber=+(e.target as HTMLSelectElement).value;}},Array.from({length:37},(_,n)=>h('option',{value:n,selected:this.rNumber===n,text:n+' '+colorOf(n)})));
    const outside=h('select',{'aria-label':'Outside bet',disabled:this.rSpinning,onchange:(e:Event)=>{this.rOutside=(e.target as HTMLSelectElement).value;}},Object.entries(OUTSIDE).map(([key,o])=>h('option',{value:key,selected:this.rOutside===key,text:o.label})));
    const controls=h('div.iso-table-console',null,[h('div.roulette-view-controls',{role:'group','aria-label':'Roulette view'},[this.btn('Casino room',()=>{this.rBetView=false;this.render();},{cls:this.rBetView?'':'.gold',pressed:!this.rBetView}),this.btn('Betting layout',()=>{this.rBetView=true;this.render();},{cls:this.rBetView?'.gold':'',pressed:this.rBetView})]),h('div.iso-bet-controls',null,[mode,...(this.rBetView?[]:[number,this.btn(this.rPending>=0?'Add adjacent number':'Place number bet',()=>clickNumber(this.rNumber),{disabled:this.rSpinning}),outside,this.btn('Place outside bet',()=>place(OUTSIDE[this.rOutside].numbers,OUTSIDE[this.rOutside].label),{disabled:this.rSpinning})])]),
      h('div.iso-chip-actions',null,[this.chipRow(),h('div.cx-row',null,[this.btn(this.rSpinning?'No more bets…':'Spin · '+money(totalBet),()=>this.spinRoulette(),{cls:'.gold',disabled:!totalBet||this.rSpinning,aria:'Spin the wheel with '+money(totalBet)+' on the table'}),this.btn('Clear bets',()=>{for(const b of this.rBets)this.chips+=b.amount;this.rBets=[];this.rUndo=[];this.rPending=-1;this.render();},{disabled:(!totalBet&&this.rPending<0)||this.rSpinning}),this.btn(this.rPending>=0?'Cancel split':'Undo last chip',()=>{if(this.rPending>=0)this.rPending=-1;else{const move=this.rUndo.pop(),bet=move&&this.rBets.find(b=>b.id===move.id);if(move&&bet){const amount=Math.min(bet.amount,move.amount);bet.amount-=amount;this.chips+=amount;this.rBets=this.rBets.filter(b=>b.amount>0);}}this.render();},{disabled:this.rSpinning||!this.rUndo.length&&this.rPending<0}),this.btn('Buy $100 chips',()=>{if(this.w.getCash()<100){this.msg='Not enough cash for $100 in chips.';}else{this.w.setCash(this.w.getCash()-100);this.chips+=100;this.bought+=100;this.msg='Bought $100 in chips.';}this.render();},{disabled:this.rSpinning})])]),
      h('p.iso-round-status',{role:'status',text:this.msg||'Choose a chip, then tap the cloth or use the number selector. Zero loses outside bets.'}),h('p.iso-last-results',{'aria-label':'Last results',text:'Last results: '+(this.rHistory.slice(0,12).join(' · ')||'—')})]);
    if(this.rBets.length)controls.append(h('details.iso-bet-slip',null,[h('summary',{text:'Your wagers · '+money(totalBet)}),h('ul',null,this.rBets.map(b=>h('li',{text:b.label+' · '+money(b.amount)+' · pays '+payoutFor(b.numbers)+':1'})))]));
    const services=this.tableServices('Roulette',this.rSpinning,this.rSpinning||totalBet>0);
    return h('section.iso-game.iso-roulette',null,[this.rBetView?precise:scene,controls,services]);
  }

  private drawWheel(cv: HTMLCanvasElement): void {
    const g = cv.getContext("2d"); if (!g) return;
    const { bowl, rotor } = wheelLayers(), d = dprOf(), S = WHEEL_PX, c = S / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(bowl, 0, 0);
    g.setTransform(d, 0, 0, d, 0, 0); g.translate(c, c);
    g.save(); g.rotate(this.rRot); g.drawImage(rotor, -c, -c, S, S); g.restore();
    if(this.rSpinning&&!reducedMotion()){for(let i=1;i<9;i++){const a=this.rBall+i*.06;g.fillStyle=`rgba(240,225,184,${(1-i/9)*.24})`;g.beginPath();g.arc(Math.cos(a)*this.rBallR,Math.sin(a)*this.rBallR,Math.max(1,5-i*.4),0,7);g.fill();}g.strokeStyle='#e4c47d66';g.lineWidth=2;g.beginPath();g.arc(0,0,c-8,this.rRot,this.rRot+Math.PI*1.1);g.stroke();}
    const bx = Math.cos(this.rBall) * this.rBallR, by = Math.sin(this.rBall) * this.rBallR;
    g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.arc(bx + 1.5, by + 2, 5.5, 0, 6.2832); g.fill();
    const ball = g.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 6); ball.addColorStop(0, "#fff"); ball.addColorStop(0.6, "#e8e4dc"); ball.addColorStop(1, "#8d877c");
    g.fillStyle = ball; g.beginPath(); g.arc(bx, by, 5.5, 0, 6.2832); g.fill();
  }

  private spinRoulette(): void {
    if (this.rSpinning || !this.rBets.length) return;
    this.rSpinning = true;this.rBetView=false; this.rPending = -1;this.rUndo=[]; this.msg = "No more bets.";
    const result = spinWheel(rnd);
    const idx = WHEEL_ORDER.indexOf(result), step = (Math.PI * 2) / 37;
    const dur = reducedMotion() ? 300 : 5200, t0 = performance.now(), startRot = this.rRot % (Math.PI * 2);
    const endRot = startRot + Math.PI * 2 * 2 + rnd() * Math.PI * 2;
    const ballEnd = endRot + idx * step + step / 2 - Math.PI / 2, ballStart = ballEnd + Math.PI * 2 * 6; // ball runs against the wheel
    this.render();
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      this.rRot = startRot + (endRot - startRot) * (1 - Math.pow(1 - t, 3));
      const lock=Math.max(0,(t-.85)/.15);
      const free=ballStart+(ballEnd-ballStart)*(1-Math.pow(1-t,3));
      this.rBall=free*(1-lock)+(this.rRot+idx*step+step/2-Math.PI/2)*lock;
      const f = Math.min(1, Math.max(0, (t - 0.6) / 0.3)); // ball leaves the track, rattles over the deflectors, drops into the pocket
      this.rBallR = TRACK_R - (TRACK_R - POCKET_R) * f * f * (3 - 2 * f) + (f > 0 && f < 1 ? Math.sin(f * Math.PI * 4) * 5 * (1 - f) : 0);
      const cv = this.el.querySelector("canvas.cx-wheel") as HTMLCanvasElement | null;
      if (cv) this.drawWheel(cv);
      if (t < 1) { requestAnimationFrame(anim); return; }
      const staked = this.rBets.reduce((s, b) => s + b.amount, 0), back = settle(this.rBets, result);
      this.chips += back; this.rBets = []; this.rSpinning = false; this.rLast = result;
      this.rHistory.unshift(result); this.rHistory.length = Math.min(this.rHistory.length, 40);
      const net = back - staked;
      this.record("Roulette", net);
      this.msg = `${result} ${colorOf(result).toUpperCase()}. ${net > 0 ? `You win ${money(net)}.` : net < 0 ? `House takes ${money(-net)}.` : "Even."}`;
      if (net >= 300) this.w.onEvent(`You hit ${result} at roulette and won ${money(net)}`, true);
      this.render();
    };
    requestAnimationFrame(anim);
  }

  // ------------------------------------------------------------------ pokies
  private reelEl(i: number, landed = false): HTMLElement {
    const spinning = this.slotSpinning && !this.reelStopped[i];
    const strip = spinning ? [...SYMBOLS, ...SYMBOLS] : this.reelWin[i];
    return h("div.cx-reel" + (spinning ? ".spin" : landed ? ".land" : ""), { "data-i": i, role: "img", "aria-label": spinning ? `Reel ${i + 1} spinning` : `Reel ${i + 1}: ${this.reels[i]}` }, [
      h("div.cx-strip", { style: spinning ? `animation-delay:-${i * 0.09}s` : undefined }, strip.map((s) => h("div.cx-cell", null, [symEl(s)]))),
    ]);
  }

  private pokiesView(): HTMLElement {
    const blur = svg("svg", { class: "cx-defs", width: 0, height: 0, "aria-hidden": "true" }, [svg("filter", { id: "cx-vblur", x: "0", y: "-20%", width: "100%", height: "140%" }, [svg("feGaussianBlur", { stdDeviation: "0 7" })])]);
    return h("section.cx-cab", { "aria-label": "Kiwi Gold pokie machine" }, [
      blur,
      h("div.cx-topper", null, [h("div.cx-bulbs", { "aria-hidden": "true" }), h("h3", { text: "KIWI GOLD" }), h("p", { text: "★ 1000× DIAMOND JACKPOT ★" })]),
      h("div.cx-glass", { role: "table", "aria-label": "Paytable" }, PAYS.map((p, i) => h("div.cx-pay" + (i === this.slotHit && !this.slotSpinning ? ".hit" : ""), { role: "row" }, [
        h("span.cx-paysyms", { role: "cell" }, p.label.split(" ").map(symEl)), h("b", { role: "cell", text: `${p.mult}×` }), h("span.cx-paycr", { role: "cell", text: money(p.mult * this.slotBet) }),
      ]))),
      h("div.cx-reelbox" + (this.slotHit >= 0 && !this.slotSpinning ? ".won" : ""), { "aria-live": "polite" }, [this.reelEl(0), this.reelEl(1), this.reelEl(2), h("i.cx-payline", { "aria-hidden": "true" })]),
      h("div.cx-meters", null, [ledEl("Credit", this.chips), ledEl("Bet", this.slotBet, "#ffb52e", 6), ledEl("Win", this.slotWin, "#3dff7a")]),
      h("p.cx-slotmsg", { role: "status", text: this.slotSpinning ? "Good luck…" : this.slotMsg || "Pick a bet and spin." }),
      h("div.cx-deck", null, [
        h("div.cx-row", { role: "group", "aria-label": "Bet per spin" }, (this.highLimit ? [1000,10_000,100_000,1_000_000] : [1,2,5,10]).map((b) => h("button.cx-btn" + (this.slotBet === b ? ".on" : ""), { "aria-pressed": String(this.slotBet === b), disabled: this.slotSpinning, "aria-label": `Bet ${money(b)} per spin`, onclick: () => { this.slotBet = b; this.render(); }, text: `BET ${money(b)}` }))),
        h("button.cx-spin", { disabled: this.slotSpinning, "aria-label": `Spin for ${money(this.slotBet)}`, onclick: () => this.spinSlots(), text: "SPIN" }),
      ]),
      h("p.cx-lbl.c", { text: `Return to player ${(rtp() * 100).toFixed(1)}% (computed from the reel strips)` }),
    ]);
  }

  private spinSlots(): void {
    if (this.slotSpinning) return;
    if (!this.take(this.slotBet)) { this.render(); return; }
    const final = spinReels(rnd), reduce = reducedMotion();
    this.slotSpinning = true; this.slotMsg = ""; this.slotWin = 0; this.slotHit = -1; this.reelStopped = [false, false, false];
    this.render();
    final.forEach((s, i) => setTimeout(() => {
      this.reels[i] = s; this.reelWin[i] = reelWindow(s); this.reelStopped[i] = true;
      this.el.querySelector(`.cx-reel[data-i="${i}"]`)?.replaceWith(this.reelEl(i, true));
      if (i < 2) return;
      const p = payFor(final), bet = this.slotBet;
      this.slotWin = p.mult * bet; this.chips += this.slotWin; this.slotSpinning = false;
      this.record("Kiwi Gold", this.slotWin - bet);
      this.slotHit = PAYS.findIndex((x) => x.label === p.label);
      this.slotMsg = this.slotWin ? `${p.label}: WIN ${money(this.slotWin)}` : "No win.";
      if (this.slotWin >= 100) this.w.onEvent(`Kiwi Gold paid ${money(this.slotWin)}!`, true);
      setTimeout(() => this.render(), reduce ? 0 : 380);
    }, reduce ? 30 : 800 + i * 450));
  }

  // ------------------------------------------------------------------ video poker
  private pokerView(): HTMLElement {
    const vp = this.vp, live = vp.phase === "draw";
    const hands = (Object.keys(PAYTABLE) as PokerHand[]).filter((k) => k !== "Nothing");
    const hitRow = vp.phase !== "bet" && vp.result !== "Nothing" ? vp.result : "";
    const table = h("div.cx-vpt", { role: "table", "aria-label": "Jacks or Better 9/6 paytable" }, hands.map((k) => h("div.cx-vpr" + (hitRow === k ? ".hit" : ""), { role: "row" }, [
      h("span", { role: "rowheader", text: k.toUpperCase() }),
      ...PAYTABLE[k].map((p, i) => h("span" + (i + 1 === this.vpCoins ? ".col" : ""), { role: "cell", "aria-label": `${i + 1} coin${i ? "s" : ""}: ${p}`, text: String(p) })),
    ])));
    const fresh = this.vpFresh; this.vpFresh = [false, false, false, false, false];
    const cards = vp.hand.length
      ? vp.hand.map((c, i) => h("button.cx-vslot" + (vp.held[i] ? ".held" : ""), { disabled: !live, "aria-pressed": String(vp.held[i]), "aria-label": `Hold card ${i + 1}`, onclick: () => { vp.toggle(i); this.render(); } }, [
        h("span.cx-heldtag", { text: "HELD" }), cardEl(c, false, fresh[i] ? ".deal" : "", fresh[i] ? 60 + i * 110 : 0),
      ]))
      : [0, 1, 2, 3, 4].map(() => h("div.cx-vslot", null, [h("span.cx-heldtag"), cardEl(null)]));
    const deal = () => { if (!this.take(this.vpCoins * this.vpValue)) { this.render(); return; } vp.deal(this.vpCoins, this.vpValue); this.vpFresh = [true, true, true, true, true]; this.vpWin = 0; this.msg = ""; this.render(); };
    const draw = () => { this.vpFresh = vp.held.map((x) => !x); const win = vp.draw(); this.record("Video poker", win - this.vpCoins * this.vpValue); this.chips += win; this.vpWin = win; this.msg = win ? `${vp.result}: ${money(win)}` : "No win."; if (vp.result === "Royal Flush") this.w.onEvent("ROYAL FLUSH at the Tessera!", true); this.render(); };
    const status = vp.phase === "bet" ? "Bet one or bet max, then deal." : live ? `${vp.result === "Nothing" ? "" : vp.result + " so far. "}Tap cards to hold, then draw.` : vp.result === "Nothing" ? "Game over. Deal again." : `${vp.result}!`;
    return h("section.cx-vp", { "aria-label": "Jacks or Better video poker" }, [
      h("div.cx-vp-title", null, [h("b", { text: "JACKS OR BETTER" }), h("span", { text: "9/6 FULL PAY" })]),
      table,
      h("div.cx-vp-cards", null, cards),
      h("p.cx-vp-status", { role: "status", text: status }),
      h("div.cx-meters", null, [ledEl("Win", this.vpWin, "#3dff7a"), ledEl("Bet", this.vpCoins * this.vpValue, "#ffb52e", 6), ledEl("Credit", this.chips)]),
      h("div.cx-vp-deck", null, [
        this.btn(`Bet one · ${this.vpCoins}`, () => { this.vpCoins = (this.vpCoins % 5) + 1; this.render(); }, { disabled: live, aria: `Bet one coin, now ${this.vpCoins}` }),
        this.btn(`Coin ${money(this.vpValue)}`, () => { const values=this.highLimit?[1000,10_000,100_000,1_000_000]:[1,5]; this.vpValue=values[(values.indexOf(this.vpValue)+1)%values.length]; this.render(); }, { disabled: live, aria: `Coin value ${money(this.vpValue)}, change` }),
        this.btn("Bet max", () => { this.vpCoins = 5; deal(); }, { cls: ".gold", disabled: live, aria: `Bet max, 5 coins, and deal` }),
        live ? this.btn("DRAW", draw, { cls: ".red.big", aria: "Draw replacement cards" }) : this.btn("DEAL", deal, { cls: ".red.big", aria: `Deal for ${money(this.vpCoins * this.vpValue)}` }),
      ]),
    ]);
  }
}
