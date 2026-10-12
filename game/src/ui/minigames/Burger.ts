import { h } from "../dom";
import "./minigames.css";

/**
 * "Flip Shift" at the Lyttelton Diner. A 75 second burger-flipping shift.
 * Grill patties (raw -> perfect window -> burnt per side), flip, plate, then build orders
 * from tickets by clicking ingredients in order. Boss Gaz has opinions.
 */
export interface ShiftResult { orders: number; perfect: number; burnt: number; tips: number; pay: number }

type Ing = "bun" | "patty" | "cheese" | "lettuce" | "tomato" | "pickles" | "onion" | "sauce";
type Grade = "raw" | "ok" | "perfect" | "burnt";
type Phase = "intro" | "play" | "done";
interface IngDef { id: Ing; label: string; key: string; color: string }

const INGS: IngDef[] = [
  { id: "bun", label: "Bun", key: "b", color: "#f6b62c" },
  { id: "patty", label: "Patty", key: "p", color: "#e08a4f" },
  { id: "cheese", label: "Cheese", key: "c", color: "#ffe14a" },
  { id: "lettuce", label: "Lettuce", key: "l", color: "#c6ff3d" },
  { id: "tomato", label: "Tomato", key: "t", color: "#ff4b3e" },
  { id: "pickles", label: "Pickles", key: "k", color: "#5fd36a" },
  { id: "onion", label: "Onion", key: "o", color: "#ff7ad9" },
  { id: "sauce", label: "Sauce", key: "s", color: "#ff8a3d" },
];
const ING_BY = Object.fromEntries(INGS.map((i) => [i.id, i])) as Record<Ing, IngDef>;

const SHIFT = 75;
const SLOTS = 4;
const W = 720, H = 300;
const SLOT_Y = 205, PATTY_R = 42;
const slotX = (i: number) => 105 + i * 170;
// seconds of cooking per side (scaled by heat)
const T_OK = 3.2, T_PERF_A = 4.5, T_PERF_B = 6.8, T_BURN = 9.5;
const NAMES = ["Shazza", "Bazza", "Aroha", "Tama", "Kev", "Mere", "Hemi", "Trish", "Dunc", "Wiremu", "Gemma", "Nige", "Ana", "Stu", "Bex", "Rangi", "Tash", "Mitch", "Kiri", "Daz"];
const NEON = ["#3dd6ff", "#ff7ad9", "#c6ff3d", "#f6b62c", "#a98bff", "#ff8a3d"];

const GAZ = {
  start: [
    "Right, chef. Grill's hot, punters are hungry. Don't muck it up.",
    "Seventy-five seconds of glory. Flip 'em like you mean it.",
    "Ferry's just come in. Look lively, they're starving.",
  ],
  perfect: [
    "Chur! That's a mean feed.",
    "Sweet as, chef. Textbook.",
    "Now THAT is a burger. Frame it.",
    "Tu meke! They're grinning like a Labrador at a barbie.",
    "Mean as. Keep that up and I'll name one after ya.",
    "Perfect. My nan would've cried. Happy tears, for once.",
    "Beautiful. That's going on the Insta. Well, my niece's Insta.",
  ],
  ok: [
    "She'll do. Not your finest, but she'll do.",
    "Good enough for Lyttelton. Barely.",
    "Yeah nah, bit off on the cook, but they're eating it.",
    "Edible. I'll write that on your gravestone.",
  ],
  wrong: [
    "Mate, that's not what anyone ordered. Read the ticket!",
    "Wrong build, chef. That's a bold interpretation of a burger.",
    "Did you just make that up? This isn't jazz, follow the ticket.",
    "That's not on any ticket. Are you freelancing?",
  ],
  raw: [
    "That patty's still mooing, mate!",
    "Raw?! You trying to get us shut down?",
    "The health inspector would have kittens. Kittens, chef.",
  ],
  burnt: [
    "That one's blacker than an All Blacks jersey. Bin it.",
    "Smells like a scrub fire on the Port Hills. Bin it!",
    "Charcoal's for the barbie, not the bun.",
    "Something's cremated on grill {n}. Pay attention!",
  ],
  expired: [
    "Customer walked. Took their patience and my profits.",
    "They've gone to the chippy over the road. Cheers for that.",
    "Lost one. They'll be telling the whole ferry about us.",
  ],
  noPatty: ["No patties on the pass, chief. Cook some first.", "You can't serve a bun hug. Get a patty on!"],
  noBun: ["Bun first, chef. It's a burger, not a salad bar."],
  binned: ["Into the bin. That's my margin, that is.", "Binned. The seagulls will be stoked."],
  rush: ["Rush is on! Hands like a Formula One pit crew, eh!", "Here comes the dinner rush. Hold onto your apron."],
  endGood: ["Legend shift. You can come back tomorrow. Bring that energy.", "Best shift I've seen since the Crusaders went undefeated."],
  endOk: ["Not bad. Not great. Very Lyttelton. See you tomorrow.", "You survived. The grill survived. Mostly."],
  endBad: ["Well. The bins are full and so's the complaints book.", "I've seen better shifts from a seagull. Go home, chef."],
};

interface Patty { side: 1 | 2; t: number; t1: number; burnt: boolean; flip: number }
interface Ticket { id: number; name: string; label: string; build: Ing[]; age: number; patience: number; color: string; urgent: boolean; el?: HTMLElement; bar?: HTMLElement }
interface Customer { id: number; x: number; tx: number; color: string; leaving: 0 | 1 | -1; bob: number; p: number; name: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; text?: string }

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const money = (n: number) => "$" + n.toFixed(2);

function gradeOf(t: number): Grade {
  if (t < T_OK) return "raw";
  if (t < T_PERF_A) return "ok";
  if (t <= T_PERF_B) return "perfect";
  if (t < T_BURN) return "ok";
  return "burnt";
}
const RANK: Record<Grade, number> = { perfect: 0, ok: 1, raw: 2, burnt: 3 };
const worst = (a: Grade, b: Grade): Grade => (RANK[a] >= RANK[b] ? a : b);

function mix(c1: number[], c2: number[], t: number): string {
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(lerp(c1[0], c2[0], k))},${Math.round(lerp(c1[1], c2[1], k))},${Math.round(lerp(c1[2], c2[2], k))})`;
}
/** Colour of a cooked face after t seconds. Raw pink -> golden brown -> dark -> charcoal. */
function doneColor(t: number): string {
  const RAW = [255, 120, 150], GOLD = [196, 112, 52], DARK = [110, 56, 26], CHAR = [30, 20, 18];
  if (t < T_PERF_A) return mix(RAW, GOLD, t / T_PERF_A);
  if (t < T_PERF_B) return mix(GOLD, DARK, (t - T_PERF_A) / (T_PERF_B - T_PERF_A) * 0.5);
  if (t < T_BURN) return mix(GOLD, DARK, 0.5 + (t - T_PERF_B) / (T_BURN - T_PERF_B) * 0.5);
  return mix(DARK, CHAR, (t - T_BURN) / 1.5);
}

function makeBuild(d: number): { build: Ing[]; label: string } {
  const double = Math.random() < 0.1 + d * 0.5;
  const cheese = Math.random() < 0.55;
  const opt = { sauce: true, lettuce: true, tomato: true, pickles: true, onion: false };
  const mods: string[] = [];
  const pool: [string, () => void][] = [
    ["no pickles", () => (opt.pickles = false)], ["no tomato", () => (opt.tomato = false)],
    ["no lettuce", () => (opt.lettuce = false)], ["no sauce", () => (opt.sauce = false)], ["add onion", () => (opt.onion = true)],
  ];
  const n = Math.floor(rand(0, 1.99 + d * 2));
  for (let i = 0; i < n && pool.length; i++) {
    const [m, apply] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    apply(); mods.push(m);
  }
  const b: Ing[] = ["bun"];
  if (opt.sauce) b.push("sauce");
  if (opt.lettuce) b.push("lettuce");
  if (opt.tomato) b.push("tomato");
  b.push("patty"); if (cheese) b.push("cheese");
  if (double) { b.push("patty"); if (cheese) b.push("cheese"); }
  if (opt.pickles) b.push("pickles");
  if (opt.onion) b.push("onion");
  b.push("bun");
  const label = [(double ? "Double" : "Single") + (cheese ? " cheese" : ""), ...mods].join(", ");
  return { build: b, label };
}

function stick(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, o: { armL?: number; armR?: number; leg?: number; lean?: number; tilt?: number } = {}): void {
  const lean = (o.lean ?? 0) * s;
  const hy = y - 60 * s, ny = y - 50 * s, hip = y - 24 * s, sh = y - 45 * s;
  c.save();
  c.strokeStyle = color; c.lineWidth = 3 * s; c.lineCap = "round"; c.lineJoin = "round";
  c.shadowColor = color; c.shadowBlur = 8;
  c.beginPath(); c.arc(x + lean, hy + (o.tilt ?? 0) * s, 8 * s, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x + lean, ny); c.lineTo(x, hip);
  const lg = (o.leg ?? 0) * s, L = 20 * s;
  c.moveTo(x, hip); c.lineTo(x - 8 * s - lg, y);
  c.moveTo(x, hip); c.lineTo(x + 8 * s + lg, y);
  const aL = o.armL ?? 0.35, aR = o.armR ?? 0.35, sx = x + lean * 0.6;
  c.moveTo(sx, sh); c.lineTo(sx - Math.sin(aL) * L, sh + Math.cos(aL) * L);
  c.moveTo(sx, sh); c.lineTo(sx + Math.sin(aR) * L, sh + Math.cos(aR) * L);
  c.stroke();
  c.restore();
}

export class BurgerShift {
  el: HTMLElement;
  open = false;

  private phase: Phase = "intro";
  private body: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hud: HTMLElement;
  private ticketsEl: HTMLElement;
  private gazEl: HTMLElement;
  private stackEl: HTMLElement;
  private slotBtns: HTMLButtonElement[] = [];
  private reduced = false;
  private raf = 0;
  private last = 0;
  private hudTick = 0;

  private time = 0;
  private grill: (Patty | null)[] = [];
  private pass: Grade[] = [];
  private stack: Ing[] = [];
  private stackGrades: Grade[] = [];
  private tickets: Ticket[] = [];
  private customers: Customer[] = [];
  private particles: Particle[] = [];
  private selected = -1;
  private nextTicket = 0;
  private ticketSeq = 1;
  private rushSaid = false;
  private gazAt = -99;
  private gazLast = "";
  private shake = 0;
  private stats = { orders: 0, perfect: 0, burnt: 0, tips: 0, failed: 0, binned: 0 };
  private result: ShiftResult | null = null;

  constructor(private onDone: (r: ShiftResult) => void) {
    this.el = h("div.mg.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "Flip Shift at the Lyttelton Diner" });
    this.canvas = h("canvas.mg-canvas", { width: W, height: H, role: "img", "aria-label": "The grill. Four slots, numbered 1 to 4." }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.canvas.addEventListener("pointerdown", (e) => this.onCanvas(e));
    this.hud = h("div.mg-hud", { "aria-live": "off" });
    this.ticketsEl = h("div.fs-tickets", { role: "list", "aria-label": "Order tickets" });
    this.gazEl = h("div.say", { role: "status", "aria-live": "polite" });
    this.stackEl = h("div.fs-stack", { "aria-live": "polite" });
    this.body = h("div.mg-body");
  }

  start(): void {
    this.reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reset();
    this.phase = "intro";
    this.open = true;
    this.el.classList.remove("hidden");
    document.addEventListener("keydown", this.onKey, true);
    this.render();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  close(): void {
    this.open = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("keydown", this.onKey, true);
    this.el.classList.add("hidden");
    this.el.replaceChildren();
  }

  private reset(): void {
    this.time = 0; this.grill = Array.from({ length: SLOTS }, () => null); this.pass = []; this.stack = []; this.stackGrades = [];
    this.tickets = []; this.customers = []; this.particles = []; this.selected = -1; this.nextTicket = 1; this.ticketSeq = 1;
    this.rushSaid = false; this.gazAt = -99; this.shake = 0; this.result = null;
    this.stats = { orders: 0, perfect: 0, burnt: 0, tips: 0, failed: 0, binned: 0 };
  }

  private get diff(): number { return Math.min(1, this.time / SHIFT); }
  private get heat(): number { return 1 + 0.35 * this.diff; }

  // ------------------------------------------------------------------ layout
  private render(): void {
    const head = h("header.mg-head", null, [
      h("h2", null, ["Flip Shift", h("small", { text: "Lyttelton Diner · boss: Gaz" })]),
      this.hud,
      h("button.x", { "aria-label": this.phase === "play" ? "End shift early" : "Close", onclick: () => this.escape(), text: "×" }),
    ]);
    this.updateHud(true);
    let view: HTMLElement[];
    if (this.phase === "intro") view = [this.canvas, this.introCard()];
    else if (this.phase === "done") view = [this.resultsCard()];
    else view = this.playView();
    this.body.replaceChildren(...view);
    this.el.replaceChildren(h("div.mg-frame", null, [head, this.body]));
    const focus = this.el.querySelector<HTMLElement>("[data-autofocus]");
    focus?.focus();
  }

  private introCard(): HTMLElement {
    return h("div.mg-card", null, [
      h("h3", { text: "Clock in, chef" }),
      h("p", { text: "75 seconds on the grill. Drop a patty, flip it in the green window, cook the other side, then plate it. Build each ticket in order, bottom bun first, then serve." }),
      h("ul", null, [
        "1-4: drop / flip / plate the patty on that grill slot (or click it)",
        "B bun · P patty · C cheese · L lettuce · T tomato · K pickles · O onion · S sauce",
        "Enter: serve · Backspace: undo · X: bin the build · Esc: end shift",
        "Pay: $18 base + $2.50 per perfect order + tips. Perfect = both sides in the window.",
      ].map((t) => h("li", { text: t }))),
      h("button.mg-btn.go", { "data-autofocus": true, onclick: () => this.begin(), text: "Start shift" }),
    ]);
  }

  private playView(): HTMLElement[] {
    this.slotBtns = Array.from({ length: SLOTS }, (_, i) => h("button.mg-btn", { onclick: () => this.useSlot(i) }) as HTMLButtonElement);
    this.updateSlotBtns();
    const ings = h("div.fs-ings", { role: "group", "aria-label": "Ingredients" }, INGS.map((g) =>
      h("button.mg-btn", { onclick: () => this.add(g.id), "aria-label": `Add ${g.label} (${g.key.toUpperCase()})` }, [h("kbd", { text: g.key.toUpperCase() }), g.label])));
    ings.querySelectorAll<HTMLElement>("button").forEach((b, i) => b.style.setProperty("--ic", INGS[i].color));
    const actions = h("div.fs-actions", null, [
      h("button.mg-btn", { onclick: () => this.undo(), "aria-label": "Undo last ingredient (Backspace)" }, [h("kbd", { text: "⌫" }), "Undo"]),
      h("button.mg-btn", { onclick: () => this.binStack(), "aria-label": "Bin the build (X)" }, [h("kbd", { text: "X" }), "Bin"]),
      h("button.mg-btn.serve", { onclick: () => this.serve(), "aria-label": "Serve (Enter)" }, ["Serve ↵"]),
    ]);
    this.renderTickets();
    this.renderStack();
    return [
      h("div.fs-top", null, [this.ticketsEl, h("div.fs-gaz", null, [h("div.face", { "aria-hidden": "true", text: "GAZ" }), this.gazEl])]),
      this.canvas,
      h("div.fs-slots", { role: "group", "aria-label": "Grill slots" }, this.slotBtns),
      h("div.fs-build", null, [this.stackEl, actions]),
      ings,
      h("p.fs-help", { text: "Keys: 1-4 grill · B P C L T K O S ingredients · Enter serve · Backspace undo · X bin · Esc end shift" }),
    ];
  }

  private resultsCard(): HTMLElement {
    const r = this.result!;
    const s = this.stats;
    const verdict = r.pay >= 40 ? GAZ.endGood : s.orders >= 3 ? GAZ.endOk : GAZ.endBad;
    return h("div.mg-card", null, [
      h("h3", { class: r.pay >= 40 ? "win" : s.orders === 0 ? "lose" : "", text: "Shift's over" }),
      h("p", null, [h("b", { text: "Gaz: " }), `"${pick(verdict)}"`]),
      h("div.mg-stats", null, [
        h("div.acid", null, [h("span", { text: "Orders" }), h("b", { text: String(r.orders) })]),
        h("div.gold", null, [h("span", { text: "Perfect" }), h("b", { text: String(r.perfect) })]),
        h("div.red", null, [h("span", { text: "Burnt" }), h("b", { text: String(r.burnt) })]),
        h("div", null, [h("span", { text: "Walk-outs / bad" }), h("b", { text: String(s.failed) })]),
      ]),
      h("div.mg-pay", { text: money(r.pay) }),
      h("p.dim.mg-breakdown", { text: `$18.00 base + ${r.perfect} × $2.50 perfect (${money(r.perfect * 2.5)}) + ${money(r.tips)} tips` }),
      h("button.mg-btn.go", { "data-autofocus": true, onclick: () => this.collect(), text: `Collect ${money(r.pay)}` }),
    ]);
  }

  private updateHud(force = false): void {
    if (!force && this.hudTick > 0) return;
    this.hudTick = 0.1;
    const left = Math.max(0, SHIFT - this.time);
    const cell = (l: string, v: string, hot = false) => h("div", null, [h("span", { text: l }), h("b" + (hot ? ".hot" : ""), { text: v })]);
    this.hud.replaceChildren(
      cell("Time", `${Math.floor(Math.ceil(left) / 60)}:${String(Math.ceil(left) % 60).padStart(2, "0")}`, this.phase === "play" && left < 10),
      cell("Orders", String(this.stats.orders)),
      cell("Perfect", String(this.stats.perfect)),
      cell("Tips", money(this.stats.tips)),
    );
  }

  private updateSlotBtns(): void {
    this.grill.forEach((p, i) => {
      const b = this.slotBtns[i]; if (!b) return;
      let txt: string, cls = "";
      if (!p) txt = "drop patty";
      else {
        const g = gradeOf(p.t);
        const verb = p.side === 1 ? "flip" : "plate";
        txt = g === "burnt" ? "burnt! bin" : g === "perfect" ? `${verb} now!` : g === "raw" ? `raw, side ${p.side}` : `${verb} (${p.t < T_PERF_A ? "under" : "over"})`;
        cls = g === "perfect" ? "perfect" : g === "burnt" ? "burnt" : "";
      }
      const label = `${i + 1}: ${txt}`;
      if (b.textContent !== label) { b.textContent = label; b.setAttribute("aria-label", `Grill slot ${label}`); }
      b.classList.toggle("perfect", cls === "perfect"); b.classList.toggle("burnt", cls === "burnt");
    });
  }

  private target(): Ticket | undefined {
    const sel = this.tickets.find((t) => t.id === this.selected);
    if (sel) return sel;
    // best prefix match, else oldest
    return this.tickets.find((t) => this.stack.length > 0 && this.stack.every((s, i) => t.build[i] === s)) ?? this.tickets[0];
  }

  private renderTickets(): void {
    if (!this.tickets.length) { this.ticketsEl.replaceChildren(h("p.fs-empty", { text: "No tickets yet. Get some patties on." })); return; }
    const tgt = this.target();
    this.ticketsEl.replaceChildren(...this.tickets.map((t) => {
      const isTgt = t === tgt;
      const items = t.build.map((g, i) => {
        const st = isTgt && i < this.stack.length ? (this.stack[i] === g ? ".done" : ".bad") : "";
        return h("li" + st, { text: `${i + 1}. ${ING_BY[g].label}` });
      });
      t.bar = h("i");
      t.el = h("button.fs-ticket" + (t.id === this.selected ? ".sel" : "") + (t.urgent ? ".urgent" : ""), {
        role: "listitem", "aria-pressed": String(t.id === this.selected),
        "aria-label": `Ticket ${t.id} for ${t.name}: ${t.label}. Build: ${t.build.map((g) => ING_BY[g].label).join(", ")}`,
        onclick: () => { this.selected = this.selected === t.id ? -1 : t.id; this.renderTickets(); },
      }, [h("div.who", null, [h("span", { text: t.name }), h("span", { text: "#" + t.id })]), h("div.what", { text: t.label }), h("ol", null, items), h("div.pat", null, [t.bar])]);
      t.el.style.setProperty("--tc", t.color);
      this.updateTicketBar(t);
      return t.el;
    }));
  }

  private updateTicketBar(t: Ticket): void {
    if (!t.bar) return;
    const p = Math.max(0, 1 - t.age / t.patience);
    t.bar.style.width = (p * 100).toFixed(1) + "%";
    t.bar.className = p < 0.25 ? "bad" : p < 0.5 ? "warn" : "";
    const urgent = p < 0.2 && !this.reduced;
    if (urgent !== t.urgent) { t.urgent = urgent; t.el?.classList.toggle("urgent", urgent); }
  }

  private renderStack(): void {
    const kids: (HTMLElement | string)[] = [h("span.lbl", { text: "Build:" })];
    if (!this.stack.length) kids.push(h("span.lbl", { text: "(empty, start with a bun)" }));
    this.stack.forEach((g, i) => {
      const chip = h("i", { text: ING_BY[g].label + (g === "patty" ? ` (${this.stackGrades[this.stack.slice(0, i + 1).filter((x) => x === "patty").length - 1]})` : "") });
      chip.style.color = ING_BY[g].color;
      kids.push(chip);
    });
    const pc = this.pass.length;
    kids.push(h("span.fs-pass", null, [" · Pass: ", h("b", { text: String(pc) }), pc ? ` (${this.pass.join(", ")})` : " patties"]));
    this.stackEl.replaceChildren(...kids);
  }

  // ------------------------------------------------------------------ actions
  private begin(): void {
    this.phase = "play";
    this.say(pick(GAZ.start), "");
    this.render();
  }

  private escape(): void {
    if (this.phase === "play") this.finish();
    else if (this.phase === "done") this.collect();
    else this.close();
  }

  private collect(): void {
    const r = this.result;
    this.close();
    if (r) this.onDone(r);
  }

  private finish(): void {
    if (this.phase !== "play") return;
    this.phase = "done";
    const tips = Math.round(this.stats.tips * 100) / 100;
    const pay = Math.round((18 + 2.5 * this.stats.perfect + tips) * 100) / 100;
    this.result = { orders: this.stats.orders, perfect: this.stats.perfect, burnt: this.stats.burnt, tips, pay };
    this.render();
  }

  private useSlot(i: number): void {
    if (this.phase !== "play") return;
    const p = this.grill[i];
    const x = slotX(i);
    if (!p) {
      this.grill[i] = { side: 1, t: 0, t1: 0, burnt: false, flip: 0 };
      this.burst(x, SLOT_Y, 14, "#ffb36b");
    } else {
      const g = gradeOf(p.t);
      if (g === "burnt") {
        this.grill[i] = null; this.stats.binned++;
        this.say(pick(GAZ.binned), "bad");
        this.burst(x, SLOT_Y, 10, "#666");
      } else if (p.side === 1) {
        p.t1 = p.t; p.t = 0; p.side = 2; p.flip = this.reduced ? 0 : 1;
        this.burst(x, SLOT_Y, g === "perfect" ? 18 : 8, g === "perfect" ? "#c6ff3d" : "#ffb36b");
        if (g === "perfect") this.floatText(x, SLOT_Y - 60, "NICE FLIP", "#c6ff3d");
      } else {
        const fg = worst(gradeOf(p.t1), g);
        this.pass.push(fg);
        this.grill[i] = null;
        this.floatText(x, SLOT_Y - 60, fg.toUpperCase(), fg === "perfect" ? "#c6ff3d" : fg === "raw" ? "#ff7896" : "#f6b62c");
        if (fg === "raw") this.say(pick(GAZ.raw), "bad");
        this.renderStack();
      }
    }
    this.updateSlotBtns();
  }

  private add(g: Ing): void {
    if (this.phase !== "play") return;
    if (this.stack.length === 0 && g !== "bun") { this.say(pick(GAZ.noBun), "bad"); return; }
    if (this.stack.length >= 14) return;
    if (g === "patty") {
      const pg = this.pass.shift();
      if (!pg) { this.say(pick(GAZ.noPatty), "bad"); return; }
      this.stackGrades.push(pg);
    }
    this.stack.push(g);
    this.renderStack(); this.renderTickets();
  }

  private undo(): void {
    if (this.phase !== "play") return;
    const g = this.stack.pop();
    if (g === "patty") { const pg = this.stackGrades.pop(); if (pg) this.pass.unshift(pg); }
    this.renderStack(); this.renderTickets();
  }

  private binStack(): void {
    if (this.phase !== "play" || !this.stack.length) return;
    if (this.stackGrades.length) this.say(pick(GAZ.binned), "bad");
    this.stack = []; this.stackGrades = [];
    this.renderStack(); this.renderTickets();
  }

  private serve(): void {
    if (this.phase !== "play" || !this.stack.length) return;
    const same = (t: Ticket) => t.build.length === this.stack.length && t.build.every((g, i) => g === this.stack[i]);
    const sel = this.tickets.find((t) => t.id === this.selected);
    const t = sel && same(sel) ? sel : this.tickets.find(same);
    const grades = this.stackGrades.slice();
    this.stack = []; this.stackGrades = [];
    if (!t) {
      this.stats.failed++;
      this.say(pick(GAZ.wrong), "bad");
      this.shakeIt();
    } else {
      const g = grades.reduce<Grade>((a, b) => worst(a, b), "perfect");
      const left = Math.max(0, 1 - t.age / t.patience);
      this.removeTicket(t, g !== "raw");
      if (g === "raw") {
        this.stats.failed++;
        this.say(pick(GAZ.raw), "bad");
        this.shakeIt();
      } else {
        this.stats.orders++;
        let tip: number;
        if (g === "perfect") { this.stats.perfect++; tip = 1 + left * 3; this.say(pick(GAZ.perfect), "good"); }
        else { tip = left * 1.5; this.say(pick(GAZ.ok), ""); }
        tip = Math.round(tip * 2) / 2;
        this.stats.tips += tip;
        const c = this.customers.find((c) => c.id === t.id);
        const cx = c ? c.x : W / 2;
        this.floatText(cx, 30, tip > 0 ? `+${money(tip)} tip` : "no tip", g === "perfect" ? "#c6ff3d" : "#f6b62c");
        this.burst(cx, 60, g === "perfect" ? 26 : 10, g === "perfect" ? "#c6ff3d" : "#f6b62c");
      }
    }
    if (this.selected !== -1 && !this.tickets.some((x) => x.id === this.selected)) this.selected = -1;
    this.renderStack(); this.renderTickets(); this.updateHud(true);
  }

  private removeTicket(t: Ticket, happy: boolean): void {
    this.tickets = this.tickets.filter((x) => x !== t);
    const c = this.customers.find((c) => c.id === t.id);
    if (c) c.leaving = happy ? 1 : -1;
    this.layoutCustomers();
  }

  private layoutCustomers(): void {
    this.tickets.forEach((t, i) => { const c = this.customers.find((c) => c.id === t.id); if (c) c.tx = 70 + i * 140; });
  }

  private spawnTicket(): void {
    const d = this.diff;
    const { build, label } = makeBuild(d);
    const used = new Set(this.tickets.map((t) => t.color));
    const color = NEON.find((c) => !used.has(c)) ?? pick(NEON);
    const t: Ticket = { id: this.ticketSeq++, name: pick(NAMES), label, build, age: 0, patience: lerp(48, 30, d) + build.length * 1.2, color, urgent: false };
    this.tickets.push(t);
    this.customers.push({ id: t.id, x: W + 40, tx: W + 40, color, leaving: 0, bob: Math.random() * 6, p: 1, name: t.name });
    this.layoutCustomers();
    this.renderTickets();
  }

  private say(text: string, tone: "" | "good" | "bad"): void {
    if (text === this.gazLast && this.time - this.gazAt < 6) return;
    this.gazLast = text; this.gazAt = this.time;
    this.gazEl.className = "say" + (tone ? " " + tone : "");
    this.gazEl.replaceChildren(h("b", { text: "Gaz" }), text);
    if (!this.reduced) { void this.gazEl.offsetWidth; this.gazEl.classList.add("pop"); }
  }

  private shakeIt(): void { if (!this.reduced) this.shake = 0.35; }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.open) return;
    const k = e.key.toLowerCase();
    const onButton = (e.target as HTMLElement | null)?.tagName === "BUTTON";
    let handled = true;
    if (k === "escape") this.escape();
    else if (this.phase !== "play") {
      if ((k === "enter" || k === " ") && !onButton) { if (this.phase === "intro") this.begin(); else this.collect(); }
      else handled = false;
    } else if (k >= "1" && k <= "4") this.useSlot(+k - 1);
    else if (k === "enter") { if (onButton) handled = false; else this.serve(); }
    else if (k === "backspace") this.undo();
    else if (k === "x") this.binStack();
    else {
      const g = INGS.find((i) => i.key === k);
      if (g && !e.ctrlKey && !e.metaKey && !e.altKey) this.add(g.id);
      else handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };

  private onCanvas(e: PointerEvent): void {
    if (this.phase !== "play") return;
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    for (let i = 0; i < SLOTS; i++) if (Math.hypot(x - slotX(i), y - SLOT_Y) < PATTY_R + 22) { this.useSlot(i); return; }
    // clicking a customer selects their ticket
    for (const c of this.customers) if (!c.leaving && Math.abs(x - c.x) < 30 && y < 120) { this.selected = this.selected === c.id ? -1 : c.id; this.renderTickets(); return; }
  }

  // ------------------------------------------------------------------ simulation
  private loop = (now: number): void => {
    if (!this.open) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.phase === "play") this.update(dt);
    this.stepParticles(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.time += dt;
    this.hudTick -= dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.time >= SHIFT) { this.updateHud(true); this.finish(); return; }
    const d = this.diff;
    if (!this.rushSaid && this.time > SHIFT * 0.55) { this.rushSaid = true; this.say(pick(GAZ.rush), ""); }

    // tickets
    this.nextTicket -= dt;
    const maxT = Math.min(5, 3 + Math.floor(d * 2.6));
    if (this.nextTicket <= 0 && this.tickets.length < maxT) { this.spawnTicket(); this.nextTicket = lerp(10, 4.8, d) + rand(-1, 1); }
    else if (this.nextTicket <= 0) this.nextTicket = 1;
    for (const t of [...this.tickets]) {
      t.age += dt;
      this.updateTicketBar(t);
      if (t.age >= t.patience) {
        this.stats.failed++;
        this.removeTicket(t, false);
        if (this.selected === t.id) this.selected = -1;
        this.say(pick(GAZ.expired), "bad");
        this.renderTickets();
      }
    }

    // grill
    const heat = this.heat;
    const pr = this.reduced ? 0.15 : 1;
    this.grill.forEach((p, i) => {
      if (!p) return;
      p.flip = Math.max(0, p.flip - dt * 3.5);
      p.t += dt * heat;
      const x = slotX(i);
      const g = gradeOf(p.t);
      if (g === "burnt" && !p.burnt) {
        p.burnt = true; this.stats.burnt++;
        this.say(pick(GAZ.burnt).replace("{n}", String(i + 1)), "bad");
      }
      const rate = (g === "burnt" ? 14 : g === "perfect" ? 26 : 16) * pr;
      if (Math.random() < rate * dt) {
        const a = Math.random() * Math.PI * 2;
        const smoke = g === "burnt" || p.t > T_PERF_B;
        this.particles.push({
          x: x + Math.cos(a) * PATTY_R * 0.9, y: SLOT_Y + Math.sin(a) * PATTY_R * 0.5,
          vx: rand(-15, 15), vy: smoke ? rand(-50, -30) : rand(-90, -40), life: 0, max: smoke ? 1.4 : 0.5,
          color: smoke ? "rgba(140,130,140,0.6)" : g === "perfect" ? "#c6ff3d" : "#ffd27a", r: smoke ? rand(5, 9) : rand(1, 2.4),
        });
      }
    });

    // customers
    for (const c of this.customers) {
      c.x += (c.tx - c.x) * Math.min(1, dt * (this.reduced ? 20 : 4));
      if (c.leaving) c.tx = c.leaving > 0 ? -60 : W + 80;
      const t = this.tickets.find((t) => t.id === c.id);
      c.p = t ? Math.max(0, 1 - t.age / t.patience) : c.p;
    }
    this.customers = this.customers.filter((c) => !(c.leaving && (c.x < -40 || c.x > W + 60)));

    this.updateSlotBtns();
    this.updateHud();
  }

  private stepParticles(dt: number): void {
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 30 * dt; }
    this.particles = this.particles.filter((p) => p.life < p.max);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private burst(x: number, y: number, n: number, color: string): void {
    const k = this.reduced ? Math.ceil(n / 4) : n;
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(40, 140) * (this.reduced ? 0.3 : 1);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: rand(0.35, 0.7), color, r: rand(1.5, 3) });
    }
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    this.particles.push({ x, y, vx: 0, vy: this.reduced ? 0 : -32, life: 0, max: 1.1, color, r: 0, text });
  }

  // ------------------------------------------------------------------ drawing
  private draw(): void {
    const c = this.ctx, cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.shake > 0) c.translate(rand(-4, 4) * this.shake * 3, rand(-3, 3) * this.shake * 3);
    const now = performance.now() / 1000;

    // diner wall + window
    const wall = c.createLinearGradient(0, 0, 0, 120);
    wall.addColorStop(0, "#160c22"); wall.addColorStop(1, "#0b0712");
    c.fillStyle = wall; c.fillRect(-10, -10, W + 20, 130);
    // neon sign
    c.save();
    c.font = "900 22px 'Big Shoulders Display', Impact, sans-serif"; c.textAlign = "right";
    c.shadowColor = "#ff7ad9"; c.shadowBlur = 14; c.fillStyle = "#ff7ad9";
    const flick = this.reduced ? 1 : (Math.sin(now * 13) > 0.97 ? 0.4 : 1);
    c.globalAlpha = flick; c.fillText("LYTTELTON DINER", W - 14, 26);
    c.globalAlpha = 1; c.font = "600 10px 'IBM Plex Mono', monospace"; c.fillStyle = "#3dd6ff"; c.shadowColor = "#3dd6ff";
    c.fillText("EST. WHENEVER · NO SEAGULLS", W - 14, 40);
    c.restore();
    // counter
    c.fillStyle = "#24132e"; c.fillRect(0, 104, W, 16);
    c.strokeStyle = "#ff7ad9"; c.lineWidth = 2; c.shadowColor = "#ff7ad9"; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(0, 104); c.lineTo(W, 104); c.stroke(); c.shadowBlur = 0;

    // customers
    for (const cu of this.customers) {
      const walking = Math.abs(cu.tx - cu.x) > 2;
      const step = walking && !this.reduced ? Math.sin(now * 12 + cu.bob) * 5 : 0;
      let armL = 0.35, armR = 0.35, lean = 0;
      if (cu.leaving === 1) { armL = armR = 2.6; }
      else if (cu.leaving === -1) { armL = armR = 0.1; lean = -2; }
      else if (cu.p < 0.25) { armL = 1.2; armR = this.reduced ? 2.2 : 1.8 + Math.sin(now * 8) * 0.6; lean = 2; }
      else if (cu.p < 0.5) { armL = armR = 2.3; }
      const color = cu.leaving === -1 ? "#ec2a1c" : cu.color;
      const bob = this.reduced ? 0 : Math.sin(now * 2 + cu.bob) * 1.2;
      stick(c, cu.x, 102 + bob, 1, color, { armL, armR, leg: step, lean });
      if (!cu.leaving) {
        c.save(); c.font = "700 10px 'IBM Plex Mono', monospace"; c.textAlign = "center";
        c.fillStyle = color; c.fillText(`${cu.name} #${cu.id}`, cu.x, 24);
        if (cu.id === this.selected) { c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(cu.x - 34, 14, 68, 92); }
        if (cu.p < 0.25) { c.fillStyle = "#ec2a1c"; c.font = "900 16px 'Big Shoulders Display', Impact"; c.fillText("!!", cu.x + 18, 40); }
        c.restore();
      }
    }

    // grill
    const steel = c.createLinearGradient(0, 120, 0, H);
    steel.addColorStop(0, "#1c1a1f"); steel.addColorStop(1, "#0d0c10");
    c.fillStyle = steel; c.fillRect(-10, 120, W + 20, H - 110);
    // heat glow
    c.save();
    const glow = c.createRadialGradient(W / 2, H + 40, 20, W / 2, H + 40, 420);
    glow.addColorStop(0, `rgba(236,42,28,${0.25 + 0.15 * this.diff})`); glow.addColorStop(1, "rgba(236,42,28,0)");
    c.fillStyle = glow; c.fillRect(0, 120, W, H - 120);
    c.strokeStyle = "rgba(255,255,255,0.05)"; c.lineWidth = 3;
    for (let x = 20; x < W; x += 22) { c.beginPath(); c.moveTo(x, 132); c.lineTo(x - 10, H - 8); c.stroke(); }
    c.restore();

    for (let i = 0; i < SLOTS; i++) {
      const x = slotX(i), p = this.grill[i];
      c.save();
      c.strokeStyle = "rgba(61,214,255,0.35)"; c.setLineDash([5, 6]); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x, SLOT_Y, PATTY_R + 12, (PATTY_R + 12) * 0.62, 0, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      c.font = "900 18px 'Big Shoulders Display', Impact"; c.fillStyle = "#3dd6ff"; c.textAlign = "center";
      c.fillText(String(i + 1), x - PATTY_R - 8, SLOT_Y - PATTY_R + 4);
      c.restore();
      if (!p) {
        c.save(); c.fillStyle = "rgba(238,228,211,0.25)"; c.font = "600 11px 'IBM Plex Mono', monospace"; c.textAlign = "center";
        c.fillText(this.phase === "play" ? "empty" : "", x, SLOT_Y + 4); c.restore();
        continue;
      }
      this.drawPatty(x, p);
      this.drawBar(x, SLOT_Y + 52, p.t);
    }

    // plated patties on the pass
    c.save(); c.font = "600 10px 'IBM Plex Mono', monospace"; c.fillStyle = "rgba(238,228,211,0.6)"; c.textAlign = "left";
    c.fillText("PASS", 10, 138);
    this.pass.slice(0, 8).forEach((g, i) => {
      c.beginPath(); c.ellipse(52 + i * 22, 135, 9, 5, 0, 0, Math.PI * 2);
      c.fillStyle = g === "perfect" ? "#9c5a2c" : g === "raw" ? "#ff7896" : "#6b3a1c"; c.fill();
      if (g === "perfect") { c.strokeStyle = "#c6ff3d"; c.lineWidth = 1.5; c.stroke(); }
    });
    c.restore();

    // particles
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.max(0, a);
      if (p.text) {
        c.font = "900 18px 'Big Shoulders Display', Impact"; c.textAlign = "center"; c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 10;
        c.fillText(p.text, p.x, p.y);
      } else {
        c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r * (p.color.startsWith("rgba") ? 1 + p.life : 1), 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawPatty(x: number, p: Patty): void {
    const c = this.ctx;
    const g = gradeOf(p.t);
    const f = p.flip;
    const lift = Math.sin(f * Math.PI) * 34;
    const sy = Math.max(0.08, Math.abs(Math.cos(f * Math.PI)));
    c.save();
    c.translate(x, SLOT_Y - lift);
    c.scale(1, sy);
    // underside rim (the cooking side) shows at the edge
    c.beginPath(); c.ellipse(0, 6, PATTY_R, PATTY_R * 0.62, 0, 0, Math.PI * 2);
    c.fillStyle = doneColor(p.t);
    if (g === "perfect") { c.shadowColor = "#c6ff3d"; c.shadowBlur = 16; }
    else if (g === "burnt") { c.shadowColor = "#ec2a1c"; c.shadowBlur = 12; }
    c.fill(); c.shadowBlur = 0;
    // top face: raw on side 1, the first cooked side on side 2
    c.beginPath(); c.ellipse(0, 0, PATTY_R - 3, (PATTY_R - 3) * 0.6, 0, 0, Math.PI * 2);
    c.fillStyle = p.side === 1 ? (f > 0.5 ? doneColor(p.t1) : "rgb(240,110,140)") : doneColor(p.t1);
    c.fill();
    // texture
    c.fillStyle = "rgba(0,0,0,0.15)";
    for (let k = 0; k < 7; k++) { const a = k * 2.1, r = 8 + (k * 7) % 22; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.55, 2.2, 0, Math.PI * 2); c.fill(); }
    if (p.side === 2) {
      c.strokeStyle = "rgba(20,10,5,0.55)"; c.lineWidth = 4;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 13 - 10, -16); c.lineTo(k * 13 + 10, 16); c.stroke(); }
    }
    c.restore();
    // side label
    c.save(); c.font = "700 10px 'IBM Plex Mono', monospace"; c.textAlign = "center";
    c.fillStyle = g === "perfect" ? "#c6ff3d" : g === "burnt" ? "#ec2a1c" : "rgba(238,228,211,0.75)";
    const lbl = g === "burnt" ? "BURNT" : g === "perfect" ? (p.side === 1 ? "FLIP!" : "PLATE!") : `side ${p.side}`;
    c.fillText(lbl, x, SLOT_Y - PATTY_R + 2 - lift);
    c.restore();
  }

  private drawBar(x: number, y: number, t: number): void {
    const c = this.ctx, w = 110, x0 = x - w / 2, max = T_BURN + 1;
    const px = (v: number) => x0 + (Math.min(v, max) / max) * w;
    c.save();
    c.fillStyle = "rgba(255,120,150,0.35)"; c.fillRect(x0, y, px(T_OK) - x0, 6);
    c.fillStyle = "rgba(246,182,44,0.35)"; c.fillRect(px(T_OK), y, px(T_PERF_A) - px(T_OK), 6);
    c.fillStyle = "#c6ff3d"; c.shadowColor = "#c6ff3d"; c.shadowBlur = 6; c.fillRect(px(T_PERF_A), y, px(T_PERF_B) - px(T_PERF_A), 6); c.shadowBlur = 0;
    c.fillStyle = "rgba(246,182,44,0.35)"; c.fillRect(px(T_PERF_B), y, px(T_BURN) - px(T_PERF_B), 6);
    c.fillStyle = "rgba(236,42,28,0.6)"; c.fillRect(px(T_BURN), y, x0 + w - px(T_BURN), 6);
    c.fillStyle = "#fff"; c.fillRect(px(t) - 1.5, y - 3, 3, 12);
    c.restore();
  }
}
