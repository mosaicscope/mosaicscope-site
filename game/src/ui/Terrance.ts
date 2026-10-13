import feed from "../content/terrance-feed.json";
import type { Simulation } from "../sim/Simulation";
import { h } from "./dom";

type Page = "hello" | "changes" | "drama";

/** Terrance's panel: the latest changes and any team drama, from the shipped feed (no network). */
export class TerranceUI {
  el: HTMLElement;
  npc = -1;
  /** Terrance mutters each page in his red-guy voice (audio hook) */
  onSpeak?: (text: string) => void;
  constructor(private sim: () => Simulation) {
    this.el = h("section.panel.dialogue.hidden", { role: "dialog", "aria-label": "Terrance", "aria-live": "polite" });
  }
  get open(): boolean { return this.npc >= 0; }

  start(id: number): void { this.npc = id; this.el.classList.remove("hidden"); this.show("hello"); }
  close(): void { this.npc = -1; this.el.classList.add("hidden"); }

  /** Close when the player walks away. */
  check(): void {
    if (this.npc < 0) return;
    const sim = this.sim(), c = sim.chars[this.npc], p = sim.player;
    if (!c || Math.hypot(c.x - p.x, c.y - p.y) > 4) this.close();
  }

  key(n: number): boolean {
    const b = this.el.querySelectorAll<HTMLButtonElement>(".opts button")[n - 1];
    if (this.npc >= 0 && b) { b.click(); return true; }
    return false;
  }

  private show(page: Page): void {
    const list = (items: string[]) => h("ul.line", { style: { fontStyle: "normal", paddingLeft: "20px" } }, items.map((t) => h("li", { text: t })));
    const body = page === "changes" ? list(feed.changes)
      : page === "drama" ? (feed.drama.length ? list(feed.drama) : h("p.line", { text: "“No drama. I don't trust it.”" }))
      : h("p.line", { text: "“BOBONUT. I've read it one more time. Ask.”" });
    const opts = [
      h("button", { onclick: () => this.show("changes"), title: "Key 1", text: "What changed?" }),
      h("button", { onclick: () => this.show("drama"), title: "Key 2", text: "Any drama?" }),
      h("button", { onclick: () => this.close(), title: "Key 3", text: "Bye" }),
    ];
    this.el.replaceChildren(
      h("button.x", { "aria-label": "End conversation", onclick: () => this.close(), text: "×" }),
      h("div.who", { text: `Terrance · updated ${feed.updated}` }), body, h("div.opts", null, opts));
    (opts[0] as HTMLElement).focus({ preventScroll: true });
    this.onSpeak?.(page === "hello" ? "BOBONUT. I've read it one more time. Ask." : page === "changes" ? "Here is what changed. Read it twice." : feed.drama.length ? "There is drama. Do not look at me." : "No drama. I do not trust it.");
  }
}
