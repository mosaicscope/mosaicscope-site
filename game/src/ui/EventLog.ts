import type { Simulation } from "../sim/Simulation";
import { h } from "./dom";
import { WorldEvent } from "../events/WorldEvents";
import { fmtHour } from "./dom";
import { TICKS_PER_HOUR } from "../sim/Environment";

/** Searchable world event history; clicking an entry shows its causal chain and moves the camera there. */
export class EventLog {
  el: HTMLElement;
  private list: HTMLElement;
  private q: HTMLInputElement;
  private open = -1;
  private lastLen = -1;
  constructor(private sim: () => Simulation, private goTo: (x: number, y: number) => void) {
    this.list = h("ol", { "aria-live": "polite" });
    this.q = h("input", { type: "search", placeholder: "Search events, names, toys…", "aria-label": "Search events", oninput: () => this.update(true) }) as HTMLInputElement;
    this.el = h("section.panel.log.hidden", { "aria-label": "Event log", role: "region" }, [
      h("button.x", { "aria-label": "Close log", onclick: () => this.toggle(false), text: "×" }),
      h("h2", { text: "What happened" }), this.q, this.list,
    ]);
  }
  toggle(on?: boolean): void { const show = on ?? this.el.classList.contains("hidden"); this.el.classList.toggle("hidden", !show); if (show) this.update(true); }
  get visible(): boolean { return !this.el.classList.contains("hidden"); }

  update(force = false): void {
    if (!this.visible) return;
    const sim = this.sim();
    const hist = sim.events.history;
    if (!force && hist.length === this.lastLen && (hist[hist.length - 1]?.id ?? 0) === this.lastLen) return;
    this.lastLen = hist.length;
    const q = this.q.value.trim().toLowerCase();
    const items = hist.filter((e) => e.type !== "spring" && (!q || e.summary.toLowerCase().includes(q) || e.type.includes(q))).slice(-120).reverse();
    this.list.replaceChildren(...items.map((e) => this.row(e, sim)));
  }

  private row(e: WorldEvent, sim: Simulation): HTMLElement {
    const time = fmtHour((sim.env.startHour + e.tick / TICKS_PER_HOUR) % 24);
    const li = h("li.sev" + e.severity, { tabindex: "0", onclick: () => { this.open = this.open === e.id ? -1 : e.id; this.goTo(e.x, e.y); this.update(true); }, onkeydown: (ev: KeyboardEvent) => { if (ev.key === "Enter") (ev.currentTarget as HTMLElement).click(); } }, [
      h("div", { text: e.summary }), h("div.t", { text: `${time} · ${e.type}${e.cause >= 0 ? " · caused by #" + e.cause : ""}` }),
    ]);
    if (this.open === e.id) {
      const chain = sim.events.chain(e).slice(1);
      li.append(h("div.chain", { text: chain.length ? "because: " + chain.map((c) => c.summary).join(" ← ") : "no recorded cause (it started here)" }));
    }
    return li;
  }
}
