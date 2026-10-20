import { h } from "./dom";
import { ANIMALS, AnimalKind, drawAnimal } from "../render/Animals";
import "./luxury.css";

/**
 * Velvet & Co. Luxury: a glossy-magazine catalogue overlay for spending obscene amounts of money.
 * Markup uses the `lux-` prefix; styles live in ./luxury.css.
 */
export interface LuxuryHost { getCash(): number; setCash(v: number): void; toast(t: string): void }
export interface Empire { items: string[]; animals: { kind: AnimalKind; name: string }[] }

type Cat = "property" | "rides" | "animals" | "absurd" | "empire";
interface Item { id: string; cat: Exclude<Cat, "animals" | "empire">; name: string; price: number; blurb: string; glyph: string; quip: string }

const ITEMS: Item[] = [
  { id: "merivale-mansion", cat: "property", name: "Merivale Mansion", price: 8_750_000, glyph: "⌂", blurb: "Seven bedrooms, a wine cellar and a hedge trimmed by a man named Julian. Walking distance to brunch.", quip: "Welcome to Merivale. The neighbours have already judged your letterbox." },
  { id: "sumner-beach-house", cat: "property", name: "Sumner Beach House", price: 4_200_000, glyph: "≈", blurb: "Floor-to-ceiling glass, sea views, and a nor'wester that rearranges the furniture for free.", quip: "Beach house secured. Sand will now be found in every pocket you own, forever." },
  { id: "cashel-penthouse", cat: "property", name: "Cashel St Penthouse", price: 6_400_000, glyph: "▲", blurb: "Top floor, rooftop spa, and a lift that only goes to your floor. Peasants take the stairs.", quip: "Penthouse acquired. You may now look down on the whole of Cashel Street. Literally." },
  { id: "yacht", cat: "rides", name: "Superyacht 'Liquidity'", price: 28_000_000, glyph: "⛵", blurb: "62 metres, helipad, a crew of 14 and a hot tub that is technically a second ocean.", quip: "The yacht is yours. It is moored at Lyttelton and already costs $40k a week to exist." },
  { id: "private-jet", cat: "rides", name: "Private Jet", price: 45_000_000, glyph: "✈", blurb: "Christchurch to Queenstown in the time it takes to say 'is this carbon neutral?' (It isn't.)", quip: "Jet purchased. Your new hobby is saying 'wheels up' to people who didn't ask." },
  { id: "helicopter", cat: "rides", name: "Helicopter", price: 3_100_000, glyph: "✱", blurb: "Skip the Brougham St traffic forever. Lands on lawns, scares sheep, impresses nobody you want.", quip: "Chopper's yours. Every lawn in Fendalton is now a potential parking spot." },
  { id: "gold-hovercraft", cat: "rides", name: "Gold-Plated Hovercraft", price: 12_500_000, glyph: "◆", blurb: "Glides over the Avon, the estuary and your critics. 24-carat skirt, heated seats, zero dignity.", quip: "Hovercraft acquired. The ducks on the Avon have filed a formal complaint." },
  { id: "diamond-toaster", cat: "absurd", name: "Diamond-Encrusted Toaster", price: 95_000, glyph: "◇", blurb: "4,000 conflict-free diamonds. Still burns one side of the bread. Some things money can't fix.", quip: "Toaster delivered. Breakfast has never been this expensive or this slightly burnt." },
  { id: "road-cone-naming", cat: "absurd", name: "Road Cone Naming Rights", price: 7_500, glyph: "△", blurb: "Christchurch's most iconic resident. Name one cone, forever. (Cone may be moved without notice.)", quip: "Congratulations: a road cone on Colombo St now bears your name. It has already been moved." },
  { id: "cathedral-statue", cat: "absurd", name: "Statue of Yourself, Cathedral Square", price: 2_250_000, glyph: "♜", blurb: "Bronze, 4 metres tall, heroic pose. Pigeons included at no extra cost.", quip: "Your statue now stands in Cathedral Square. A gull has already claimed your head." },
];

/** Funny names, handed out in order per species ("Kevin" is the first giraffe). */
const NAMES: Record<AnimalKind, string[]> = {
  giraffe: ["Kevin", "Necky McNeckface", "Sharon", "Tall Paul", "Big Trev"],
  elephant: ["Dumbo Baggins", "Nana", "Trunk Shot", "Gary", "Ellie Mental"],
  zebra: ["Barcode", "Stripey Kev", "Marty", "Pyjama Pete", "Crosswalk"],
  lion: ["Mufasa Jr.", "Gazza", "Lionel", "Sir Naps-a-Lot", "Mane Event"],
  tiger: ["Frosties", "Tony", "Stripes Jagger", "Cheryl", "Purrcy"],
  penguin: ["Pingu", "Waddles", "Tux", "Captain Fish", "Lil' Tim"],
  flamingo: ["Flamin' Galah", "Pinky", "Kylie", "Stilts", "Prawnhub"],
  peacock: ["Influencer Steve", "Fanboy", "Brad", "Showoff", "Kevin (Peacock)"],
  parrot: ["Polly Wanna Lambo", "Swearbird", "Captain Squawk", "Echo", "Maccas"],
  kea: ["Wiper Thief", "Cheeky Chris", "Kea Reeves", "Mischief", "Gremlin"],
  kiwi: ["Sweet As", "Chur", "Bro", "Jandal", "Hokey Pokey"],
  toucan: ["Beaky Blinders", "Toucan Play", "Froot Loop", "Big Nose Bev", "Tango"],
  owl: ["More Pork", "Hootie", "Who-dini", "Professor", "Night Shift"],
  whale: ["Blubbington", "Moby Nick", "Big Wendy", "Krill Bill", "Whaley Cyrus"],
  dolphin: ["Flipper", "Echo Bazza", "Sir Splash", "Smarty Pants", "Porpoise in Life"],
  monkey: ["Sunnies Thief", "Bananas", "Cheeky Dave", "Monkey Business", "Kong Jr."],
  kangaroo: ["Skippy", "Bounce", "Jack Hop", "Boxer Barry", "Ditch Hopper"],
  panda: ["Dim Sum", "Bamboozle", "Bao", "Chubbs", "Sir Naps"],
};

const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
/** [height, width] in animal units, used to fit the preview canvas. */
const FIT: Record<AnimalKind, [number, number]> = {
  giraffe: [3.4, 2.2], elephant: [2.6, 3.2], zebra: [1.7, 1.8], lion: [1.3, 1.8], tiger: [1.3, 1.8], penguin: [0.8, 0.6],
  flamingo: [1.7, 0.9], peacock: [1.5, 2.0], parrot: [0.7, 0.8], kea: [0.7, 0.8], kiwi: [0.5, 0.8], toucan: [0.7, 0.9],
  owl: [0.8, 0.7], whale: [2.6, 4.2], dolphin: [1.6, 2.0], monkey: [1.2, 1.0], kangaroo: [1.7, 1.4], panda: [1.3, 1.8],
};
const PV_W = 200, PV_H = 140;

const money = (n: number) => "NZ$" + Math.round(n).toLocaleString("en-NZ");
const short = (n: number) => n >= 1e6 ? "$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n;
const KINDS = Object.keys(ANIMALS) as AnimalKind[];

export class Luxury {
  beforeOpen: () => boolean = () => true;
  el: HTMLElement;
  open = false;
  empire: Empire = { items: [], animals: [] };
  private tab: Cat = "property";
  private raf = 0;
  private previews: { g: CanvasRenderingContext2D; kind: AnimalKind; ph: number }[] = [];
  private onKey = (e: KeyboardEvent) => { if (this.open && e.key === "Escape") { e.preventDefault(); this.close(); } };

  constructor(private host: LuxuryHost) {
    this.el = h("div.lux.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "Velvet & Co. Luxury catalogue" });
    this.el.addEventListener("click", (e) => { if (e.target === this.el) this.close(); });
  }

  show(): void {
    if (this.open || !this.beforeOpen()) return;
    this.open = true; this.el.classList.remove("hidden");
    window.addEventListener("keydown", this.onKey);
    this.render();
  }

  close(): void {
    if (!this.open) return;
    this.open = false; this.el.classList.add("hidden");
    window.removeEventListener("keydown", this.onKey);
    this.stopPreviews();
  }

  load(e: Empire): void {
    this.empire = {
      items: Array.isArray(e?.items) ? e.items.filter((i) => typeof i === "string") : [],
      animals: Array.isArray(e?.animals) ? e.animals.filter((a) => a && a.kind in ANIMALS).map((a) => ({ kind: a.kind, name: String(a.name ?? ANIMALS[a.kind].name) })) : [],
    };
    if (this.open) this.render();
  }

  // ---------------------------------------------------------------- rendering
  private render(): void {
    this.stopPreviews();
    const cash = this.host.getCash();
    const tabs: [Cat, string][] = [["property", "Property"], ["rides", "Rides"], ["animals", "Private Zoo"], ["absurd", "Absurd"], ["empire", "Your Empire"]];
    const head = h("header.lux-mast", null, [
      h("div.lux-issue", { text: "Issue No. 1 · Christchurch · Spring Collection" }),
      h("h2.lux-title", null, ["Velvet ", h("i", { text: "&" }), " Co."]),
      h("div.lux-tag", { text: "LUXURY · For people who have already bought everything else" }),
      h("div.lux-cash", null, [h("span", { text: "Available funds" }), h("b", { text: money(cash) })]),
      h("button.lux-x", { "aria-label": "Close catalogue", onclick: () => this.close(), text: "×" }),
    ]);
    const nav = h("nav.lux-tabs", { role: "tablist" }, tabs.map(([id, label]) =>
      h("button" + (this.tab === id ? ".on" : ""), { role: "tab", "aria-selected": String(this.tab === id), onclick: () => { this.tab = id; this.render(); }, text: label })));
    let body: HTMLElement;
    if (this.tab === "empire") body = this.empireView();
    else if (this.tab === "animals") body = this.animalsView(cash);
    else body = this.itemsView(this.tab, cash);
    this.el.replaceChildren(h("div.lux-frame", null, [head, nav, h("div.lux-body", null, [body]),
      h("footer.lux-foot", { text: "All prices in New Zealand dollars, GST inclusive, dignity sold separately. No refunds. No regrets." })]));
    if (this.previews.length) this.startPreviews();
  }

  private itemsView(cat: Item["cat"], cash: number): HTMLElement {
    const lede: Record<Item["cat"], [string, string]> = {
      property: ["Real Estate", "Addresses that make the bank manager sit up straighter."],
      rides: ["Rides", "Because the bus is for people who still check prices."],
      absurd: ["The Absurd", "Things nobody needs, priced for people who need nothing."],
    };
    const [title, sub] = lede[cat];
    return h("section.lux-sec", null, [
      h("div.lux-lede", null, [h("h3", { text: title }), h("p", { text: sub })]),
      h("div.lux-grid", null, ITEMS.filter((i) => i.cat === cat).map((it) => {
        const owned = this.empire.items.includes(it.id);
        return h("article.lux-card" + (owned ? ".owned" : ""), null, [
          h("div.lux-plate.c-" + cat, { "aria-hidden": "true" }, [h("span", { text: it.glyph })]),
          h("div.lux-copy", null, [
            h("h4", { text: it.name }),
            h("p", { text: it.blurb }),
            h("div.lux-buy", null, [
              h("span.lux-price", { text: money(it.price) }),
              owned ? h("span.lux-owned", { text: "In your collection" })
                : h("button.lux-btn", { disabled: cash < it.price, onclick: () => this.buyItem(it), text: cash < it.price ? "Insufficient funds" : "Acquire" }),
            ]),
          ]),
        ]);
      })),
    ]);
  }

  private animalsView(cash: number): HTMLElement {
    return h("section.lux-sec", null, [
      h("div.lux-lede", null, [h("h3", { text: "The Private Zoo" }), h("p", { text: "Ethically questionable. Aesthetically unquestionable. Each arrives pre-named by our in-house naming consultant." })]),
      h("div.lux-grid.zoo", null, KINDS.map((k, i) => {
        const a = ANIMALS[k], have = this.empire.animals.filter((x) => x.kind === k).length;
        const d = Math.min(3, window.devicePixelRatio || 1);
        const cv = h("canvas.lux-pv", { width: Math.round(PV_W * d), height: Math.round(PV_H * d), role: "img", "aria-label": `${a.name}, live preview` }) as HTMLCanvasElement;
        const g = cv.getContext("2d");
        if (g) { g.setTransform(d, 0, 0, d, 0, 0); this.previews.push({ g, kind: k, ph: i * 1.37 }); }
        return h("article.lux-card.animal", null, [
          h("div.lux-pvwrap.h-" + a.habitat, null, [cv, have ? h("span.lux-count", { text: "×" + have }) : null]),
          h("div.lux-copy", null, [
            h("h4", { text: a.name }),
            h("p", { text: a.blurb }),
            h("div.lux-buy", null, [
              h("span.lux-price", { text: money(a.price) }),
              h("button.lux-btn", { disabled: cash < a.price, onclick: () => this.buyAnimal(k), text: cash < a.price ? "Insufficient funds" : have ? "Another!" : "Adopt" }),
            ]),
          ]),
        ]);
      })),
    ]);
  }

  private empireView(): HTMLElement {
    const items = ITEMS.filter((i) => this.empire.items.includes(i.id));
    const animals = this.empire.animals;
    const assets = items.reduce((s, i) => s + i.price, 0) + animals.reduce((s, a) => s + ANIMALS[a.kind].price, 0);
    const cash = this.host.getCash(), worth = cash + assets;
    const counts = new Map<AnimalKind, number>();
    for (const a of animals) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
    const rank = worth >= 50e6 ? "Tycoon of the South Island" : worth >= 10e6 ? "Merivale Royalty" : worth >= 1e6 ? "Comfortably Smug" : worth >= 1e5 ? "Aspiring Mogul" : "Window Shopper";
    return h("section.lux-sec", null, [
      h("div.lux-lede", null, [h("h3", { text: "Your Empire" }), h("p", { text: `Status: ${rank}.` })]),
      h("div.lux-stats", null, [
        stat("Net worth", money(worth)), stat("Cash", money(cash)), stat("Assets", money(assets)),
        stat("Head count", `${animals.length} animal${animals.length === 1 ? "" : "s"}`),
      ]),
      h("div.lux-cols", null, [
        h("div.lux-list", null, [h("h4", { text: "The Collection" }),
          items.length ? h("ul", null, items.map((i) => h("li", null, [h("span", { text: i.glyph + "  " + i.name }), h("b", { text: short(i.price) })])))
            : h("p.lux-empty", { text: "Nothing yet. The catalogue is right there. Go on." })]),
        h("div.lux-list", null, [h("h4", { text: "The Menagerie" }),
          animals.length ? h("ul", null, animals.map((a) => h("li", null, [h("span", { text: `${a.name} the ${ANIMALS[a.kind].name}` }), h("b", { text: short(ANIMALS[a.kind].price) })])))
            : h("p.lux-empty", { text: "Your zoo is a lonely field. Adopt someone." }),
          counts.size ? h("p.lux-census", { text: [...counts].map(([k, n]) => `${n} ${ANIMALS[k].name}${n > 1 ? "s" : ""}`).join(" · ") }) : null]),
      ]),
    ]);
    function stat(label: string, v: string): HTMLElement { return h("div.lux-stat", null, [h("span", { text: label }), h("b", { text: v })]); }
  }

  // ---------------------------------------------------------------- purchases
  private pay(price: number): boolean {
    const cash = this.host.getCash();
    if (cash < price) { this.host.toast(`Declined. Velvet & Co. does not do lay-by. You're ${money(price - cash)} short.`); return false; }
    this.host.setCash(cash - price);
    return true;
  }

  private buyItem(it: Item): void {
    if (this.empire.items.includes(it.id) || !this.pay(it.price)) return;
    this.empire.items.push(it.id);
    this.host.toast(it.quip);
    this.render();
  }

  private buyAnimal(kind: AnimalKind): void {
    const a = ANIMALS[kind];
    if (!this.pay(a.price)) return;
    const name = this.nameFor(kind);
    this.empire.animals.push({ kind, name });
    const lines = [
      `Meet ${name} the ${a.name}. ${name} has already eaten the welcome card.`,
      `${name} the ${a.name} has arrived. Please sign here, here and on ${name}.`,
      `It's a ${a.name}! We've named it ${name}. No, you can't change it.`,
      `${name} the ${a.name} is settling in. The neighbours have questions.`,
    ];
    this.host.toast(lines[this.empire.animals.length % lines.length]);
    this.render();
  }

  private nameFor(kind: AnimalKind): string {
    const list = NAMES[kind], n = this.empire.animals.filter((x) => x.kind === kind).length;
    const taken = new Set(this.empire.animals.map((x) => x.name));
    for (let i = n; i < n + list.length * ROMAN.length; i++) {
      const base = list[i % list.length], gen = Math.floor(i / list.length);
      const cand = base + (gen < ROMAN.length ? ROMAN[gen] : " #" + (gen + 1));
      if (!taken.has(cand)) return cand;
    }
    return `${list[0]} #${n + 1}`;
  }

  // ---------------------------------------------------------------- live previews
  private startPreviews(): void {
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const draw = (ms: number) => {
      const t = ms / 1000;
      for (const p of this.previews) this.drawPreview(p.g, p.kind, reduce ? p.ph : t, p.ph);
      if (!reduce && this.open) this.raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
  }

  private stopPreviews(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.previews = [];
  }

  private drawPreview(g: CanvasRenderingContext2D, kind: AnimalKind, t: number, ph: number): void {
    const [ht, wd] = FIT[kind], hab = ANIMALS[kind].habitat;
    const z = Math.min(2.2, (PV_H - 26) / (ht * 26), (PV_W - 20) / (wd * 26));
    g.clearRect(0, 0, PV_W, PV_H);
    const gy = hab === "water" ? PV_H * 0.72 : PV_H - 14;
    if (hab === "water") {
      g.fillStyle = "rgba(30,140,200,.28)"; g.fillRect(0, gy, PV_W, PV_H - gy);
      g.strokeStyle = "rgba(61,214,255,.7)"; g.lineWidth = 1.2; g.beginPath();
      for (let x = 0; x <= PV_W; x += 8) { const y = gy + Math.sin(x * 0.08 + t * 2) * 1.5; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    } else {
      g.strokeStyle = "rgba(246,182,44,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(14, gy); g.lineTo(PV_W - 14, gy); g.stroke();
    }
    // stroll: walk a few seconds, pause, turn around
    const cyc = (t * 0.25 + ph) % 2, moving = hab === "water" ? 0.4 : (cyc % 1) < 0.5 ? 1 : 0, dir = cyc < 1 ? 1 : -1;
    drawAnimal(g, kind, PV_W / 2, gy, z, dir, t, ph, moving);
  }
}
