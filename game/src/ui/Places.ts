import type { Simulation } from "../sim/Simulation";
import { h } from "./dom";
import { BUILDINGS, isOpen } from "../content/buildings";
import { TOYS } from "../content/toys";
import { VEHICLES, FOR_SALE } from "../content/vehicles";
import { MOSAIC, captionLine } from "../content/mosaicscope";
import { buy, pawnPrice, fmtCash, evaluateTrade, executeTrade, book } from "../sim/Society";
import { carried, detach } from "../inventory/Inventory";
import { makeVehicle } from "../sim/Traffic";
import type { Building } from "../world/World";
import type { Character } from "../entities/types";

/** Panels for walking into places: shops, food, dealership, MosaicScope studio & gallery, pawn, police. */
export class Places {
  constructor(private sim: () => Simulation, private show: (title: string, body: (HTMLElement | null)[], cls?: string) => void, private close: () => void, private toast: (t: string, k?: string) => void) {}

  enter(b: Building | null, studio = false): void {
    const sim = this.sim();
    if (studio) return this.studio();
    if (!b) return;
    const def = BUILDINGS[b.kind];
    if (!isOpen(def, sim.hour)) { this.toast(`${b.name} is closed. Open ${def.open[0]}:00–${def.open[1] % 24}:00.`); return; }
    if (b.kind === "dealership") return this.dealership(b);
    if (b.kind === "gallery") return this.gallery();
    if (b.kind === "police") return this.police(b);
    if (def.menu) return this.shop(b);
    this.toast(`${b.name}: nothing for you inside.`);
  }

  private wallet(): HTMLElement { const p = this.sim().player; return h("p.wallet", { text: `Cash ${fmtCash(p.cash)}` }); }

  shop(b: Building): void {
    const sim = this.sim(), p = sim.player, def = BUILDINGS[b.kind];
    const staff = sim.chars.filter((c) => c.workplace === b.id && c.inside === b.id);
    const render = () => {
      const rows = (def.menu ?? []).map((id) => {
        const d = TOYS[id];
        const stats = d.weapon ? ` · dmg ${d.weapon.damage} · reach ${d.weapon.reach} · ${d.weapon.rate}s/attack${d.weapon.blood ? ` · blood ${Math.round(d.weapon.blood * 100)}%` : ""}` : d.food ? ` · fills ${Math.round(d.food.hunger * 100)}%${d.food.energy ? `, energy +${Math.round(d.food.energy * 100)}%` : ""}` : "";
        return h("li.item", null, [h("div", null, [h("b", { text: d.name }), h("small", { text: (d.blurb ? d.blurb + " " : "") + stats })]), h("span.price", { text: fmtCash(d.value) }), h("button.btn", { disabled: p.cash < d.value, onclick: () => { const r = buy(sim, p, id, { building: b.id }); this.toast(r.ok ? `Bought ${d.name}` : r.reason!); render(); }, text: "Buy" })]);
      });
      const sell = b.kind === "pawn" ? [h("h3", { text: "Sell to the pawn shop" }), h("ul.items", null, carried(p).map((id) => sim.toys[id]).filter((t) => t && pawnPrice(t.def) > 0).map((t) => h("li.item", null, [h("b", { text: TOYS[t.def].name }), h("span.price", { text: fmtCash(pawnPrice(t.def)) }), h("button.btn", { onclick: () => { detach(p, t.id); t.state = "broken"; t.x = -100; t.holder = -1; p.cash += pawnPrice(t.def); this.toast(`Sold for ${fmtCash(pawnPrice(t.def))}`); render(); }, text: "Sell" })])))] : [];
      this.show(b.name, [h("p", { style: { color: "var(--dim)" }, text: staff.length ? `${staff.map((s) => s.name.split(" ")[0]).join(" and ")} ${staff.length > 1 ? "are" : "is"} working today.` : "Self-service today." }), this.wallet(), h("ul.items", null, rows), ...sell], "shop");
    };
    render();
  }

  dealership(b: Building): void {
    const sim = this.sim(), p = sim.player;
    const owned = sim.vehicles.filter((v) => v.owner === p.id);
    const cards = FOR_SALE.map((cls) => {
      const d = VEHICLES[cls];
      const bar = (label: string, v: number, max: number) => h("div.meter", null, [h("span", { text: label }), h("div.track", null, [h("div.fill", { style: { width: Math.round((v / max) * 100) + "%" } })]), h("span.num", { text: String(Math.round(v * 10) / 10) })]);
      return h("li.car", null, [
        h("div", null, [h("b", { text: d.name }), h("small", { text: ` · ${d.tier}` }), h("p", { text: d.blurb })]),
        bar("top speed", d.topSpeed, 17), bar("accel", d.accel, 7.5), bar("grip", d.grip, 3.8),
        h("div.row", null, [h("span.price", { text: fmtCash(d.price) }), h("button.btn", { disabled: p.cash < d.price, onclick: () => {
          if (p.cash < d.price) return;
          const lot = sim.world.areas.find((a) => a.kind === "dealership")!;
          const spot = sim.world.nearestWalkable(lot.x0 + 3 + owned.length, lot.y0 + 8);
          const v = makeVehicle(sim, cls, spot.x, spot.y, 0, "parked");
          v.owner = p.id; p.cash -= d.price;
          sim.emit({ type: "purchase", x: v.x, y: v.y, actors: [p.id], summary: `You bought a ${d.name} (${v.plate}) for ${fmtCash(d.price)}` });
          this.toast(`Your ${d.name} is in the lot. Walk up and press E.`, "acid"); this.close();
        }, text: "Buy" })]),
      ]);
    });
    this.show(b.name, [this.wallet(), h("p", { style: { color: "var(--dim)" }, text: "Cars in the lot are display models. Buy one and the keys are yours; it waits in the lot with your name on it." }), h("ul.cars", null, cards)], "shop");
  }

  /** MosaicScope Studio: real rates, real booking link, plus an in-game shoot with Chris. */
  studio(): void {
    const sim = this.sim(), p = sim.player;
    const rates = MOSAIC.rates.map((r) => h("li.item", null, [h("div", null, [h("b", { text: r.title }), h("small", { text: r.detail })]), h("span.price", { text: `${r.unit === "from" ? "from " : ""}${r.price}${r.unit === "per hour" ? "/hr" : ""}` })]));
    this.show("MosaicScope Studio", [
      h("p", { text: `${MOSAIC.owner}'s studio. Photography and film around ${MOSAIC.location}: ${MOSAIC.services.slice(0, 5).join(", ").toLowerCase()}.` }),
      h("ul.items", null, rates),
      h("div.row", null, [
        h("a.btn.red", { href: MOSAIC.booking, target: "_top", text: "Book a real shoot ↗" }),
        h("a.btn", { href: MOSAIC.instagram, target: "_blank", rel: "noopener", text: `${MOSAIC.handle} on Instagram ↗` }),
        h("a.btn", { href: MOSAIC.igDm, target: "_blank", rel: "noopener", text: "DM on Instagram ↗" }),
      ]),
      h("h3", { text: "In the game" }),
      h("p", { style: { color: "var(--dim)" }, text: "Get your stick figure shot by Chris for $40 of in-game cash. He'll meet you at the studio." }),
      h("button.btn", { disabled: p.cash < 40, onclick: () => {
        const prevRole = p.role; p.role = "local";
        const bk = book(sim, p);
        p.role = prevRole;
        if (bk) { this.toast(`Booked! ${sim.chars[bk.photographer]?.name} will shoot you here soon. Stay in the studio.`, "acid"); this.close(); }
        else this.toast("The diary's full right now. Try later.");
      }, text: "Book an in-game shoot ($40)" }),
    ], "shop");
  }

  /** The gallery wall shows the real @mosaicscope feed (when it loaded). */
  gallery(): void {
    const posts = MOSAIC.posts.slice(0, 12);
    const grid = posts.length
      ? h("div.ig-grid", null, posts.map((p) => h("a.ig", { href: p.link, target: "_blank", rel: "noopener" }, [h("img", { src: p.img, alt: captionLine(p.caption) || "Instagram post", loading: "lazy" }), h("span", { text: captionLine(p.caption) })])))
      : h("p", { style: { color: "var(--dim)" }, text: `The wall is waiting for the Instagram feed. Everything's on ${MOSAIC.handle}.` });
    this.show("MosaicScope Gallery", [
      h("p", { text: "On the walls tonight: the latest from @mosaicscope." }), grid,
      h("div.row", null, [h("a.btn.red", { href: MOSAIC.instagram, target: "_blank", rel: "noopener", text: `Follow ${MOSAIC.handle} ↗` }), h("a.btn", { href: MOSAIC.booking, target: "_top", text: "Book a shoot ↗" })]),
    ], "shop");
  }

  police(b: Building): void {
    const sim = this.sim(), p = sim.player;
    const fine = p.wanted * 120;
    const recent = sim.crimes.filter((c) => sim.tick - c.tick < 60 * 3600).slice(-6).reverse();
    this.show(b.name, [
      this.wallet(),
      p.wanted ? h("div", null, [h("p", { text: `You're wanted (${"★".repeat(p.wanted)}). Hand yourself in and pay ${fmtCash(fine)} to clear it.` }), h("button.btn.red", { disabled: p.cash < fine, onclick: () => { p.cash -= fine; p.wanted = 0; for (const c of sim.chars) if (c.pursuing === p.id) { c.pursuing = -1; c.goal = null; } this.toast("Record cleared. Behave."); this.close(); }, text: `Pay ${fmtCash(fine)}` })]) : h("p", { text: "Clean record. The desk sergeant nods at you." }),
      h("h3", { text: "Incident board" }),
      h("ul.items", null, recent.length ? recent.map((c) => h("li.item", null, [h("b", { text: `${c.type.replace("_", " ")}` }), h("small", { text: `${sim.chars[c.perp]?.name ?? "unknown"}${c.solved ? " · arrested" : c.reported ? " · wanted" : ""}` })])) : [h("li", { text: "Nothing reported." })]),
      h("p", { style: { color: "var(--dim)" }, text: `In the cells: ${sim.chars.filter((c) => c.jailUntil > 0).map((c) => c.name).join(", ") || "nobody"}` }),
    ], "shop");
  }

  /** Barter with an NPC: pick what you give and what you want, they accept, refuse or counter. */
  trade(npc: Character): void {
    const sim = this.sim(), p = sim.player;
    const give = new Set<number>(), want = new Set<number>();
    let cashGive = 0, cashWant = 0;
    const list = (who: Character, sel: Set<number>) => h("ul.items", null, carried(who).map((id) => sim.toys[id]).filter(Boolean).map((t) => h("li.item", null, [
      h("label", null, [h("input", { type: "checkbox", checked: sel.has(t.id), onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? sel.add(t.id) : sel.delete(t.id); } }), ` ${TOYS[t.def].name}`]), h("span.price", { text: fmtCash(TOYS[t.def].value) }),
    ])));
    const out = h("p", { "aria-live": "polite" });
    const num = (set: (v: number) => void) => h("input", { type: "number", min: 0, step: 1, value: 0, style: { width: "90px" }, oninput: (e: Event) => set(Math.max(0, +(e.target as HTMLInputElement).value || 0)) });
    this.show(`Trade with ${npc.name}`, [
      h("p", { style: { color: "var(--dim)" }, text: `${npc.name.split(" ")[0]} values things they like more, gives friends a better deal and won't be lowballed.` }),
      h("div.trade", null, [
        h("div", null, [h("h3", { text: `You give (cash ${fmtCash(p.cash)})` }), list(p, give), h("label", null, ["Cash ", num((v) => { cashGive = v; })])]),
        h("div", null, [h("h3", { text: `You get (they have ${fmtCash(npc.cash)})` }), list(npc, want), h("label", null, ["Cash ", num((v) => { cashWant = v; })])]),
      ]),
      h("button.btn.red", { onclick: () => {
        const offer = { items: [...give], cash: cashGive }, ask = { items: [...want], cash: cashWant };
        if (!offer.items.length && !offer.cash || !ask.items.length && !ask.cash) { out.textContent = "Pick something on both sides."; return; }
        const v = evaluateTrade(sim, npc, p, offer, ask);
        if (v.accept && executeTrade(sim, p, npc, offer, ask)) { this.toast(`${npc.name.split(" ")[0]}: "Deal."`, "acid"); this.close(); }
        else out.textContent = `${npc.name.split(" ")[0]}: "${v.reason}"`;
      }, text: "Offer" }), out,
    ], "shop");
  }
}

/** Radio: the MosaicScope SoundCloud playlist through SoundCloud's own widget (where embedding is allowed). */
export class Radio {
  el: HTMLElement;
  private frame: HTMLIFrameElement | null = null;
  private widget: any = null;
  private title: HTMLElement;
  playing = false;
  constructor(private url: string) {
    this.title = h("span.radio-title", { text: "MosaicScope FM" });
    this.el = h("div.radio", { role: "group", "aria-label": "Radio" }, [
      h("button.radio-btn", { "aria-label": "Play or pause the radio", onclick: () => this.toggle(), text: "▶" }),
      h("button.radio-btn", { "aria-label": "Next track", onclick: () => this.widget?.next(), text: "⏭" }),
      this.title,
    ]);
  }
  private ensure(): void {
    if (this.frame || !this.url) return;
    this.frame = h("iframe", { title: "SoundCloud player", allow: "autoplay", style: { position: "absolute", width: "1px", height: "1px", opacity: "0", pointerEvents: "none", border: "0" }, src: "https://w.soundcloud.com/player/?url=" + encodeURIComponent(this.url) + "&auto_play=false&visual=false&buying=false&sharing=false" }) as HTMLIFrameElement;
    document.body.append(this.frame);
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.onload = () => {
      const SC = (window as any).SC;
      if (!SC?.Widget || !this.frame) return;
      this.widget = SC.Widget(this.frame);
      const E = SC.Widget.Events;
      this.widget.bind(E.READY, () => { if (this.playing) this.widget.play(); });
      this.widget.bind(E.PLAY, () => { this.widget.getCurrentSound((snd: any) => { if (snd) this.title.textContent = `♪ ${snd.title}`; }); this.setBtn(true); });
      this.widget.bind(E.PAUSE, () => this.setBtn(false));
      this.widget.bind(E.FINISH, () => this.widget.next());
    };
    s.onerror = () => { this.title.textContent = "Radio unavailable here"; };
    document.head.append(s);
  }
  private setBtn(on: boolean): void { this.playing = on; (this.el.firstElementChild as HTMLElement).textContent = on ? "❚❚" : "▶"; }
  play(): void { this.ensure(); this.playing = true; this.widget?.play(); }
  pause(): void { this.playing = false; this.widget?.pause(); }
  toggle(): void { this.playing ? this.pause() : this.play(); }
  setVolume(v: number): void { this.widget?.setVolume(Math.round(v * 100)); }
}
