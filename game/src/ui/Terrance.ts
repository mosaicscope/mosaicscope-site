import feed from "../content/terrance-feed.json";
import type { Simulation } from "../sim/Simulation";
import { h } from "./dom";

type Page = "hello" | "changes" | "drama" | "review";

/** The slice of the player that Terrance reads. */
export interface Reviewee { cash: number; wanted: number; hunger: number; blood: number; scrap?: { can: number; bottle: number }; stats: { hits: number; falls: number; helps: number; gifts: number } }

/** Terrance code-reviews the player: up to three verdicts, each one true of their actual run, worst first. */
export function reviewOf(p: Reviewee, hour: number): string[] {
  const sack = (p.scrap?.can ?? 0) + (p.scrap?.bottle ?? 0), hh = String(Math.floor(hour)).padStart(2, "0") + ":00";
  const out: string[] = [];
  if (p.wanted > 0) out.push(`${p.wanted} star${p.wanted > 1 ? "s" : ""}. That is a merge conflict with the whole police force.`);
  if (p.blood < 0.7) out.push("You are bleeding. Not in the diff, I hope. Request changes.");
  if (p.stats.hits >= 5) out.push(`${p.stats.hits} people hit. Request changes.`);
  if (p.hunger < 0.25) out.push("You are starving. Nothing good ships hungry.");
  if (hour < 5) out.push(`It is ${hh}. Nothing good merges at ${hh}.`);
  if (p.stats.falls >= 3) out.push(`Fell over ${p.stats.falls} times. Flaky.`);
  if (sack >= 10) out.push(`${sack} cans and bottles in the sack. Cash them in before they go stale.`);
  if (p.cash < 20) out.push(`$${Math.floor(p.cash)}. Under budget. I respect it.`);
  if (p.cash >= 500) out.push(`$${Math.floor(p.cash)} in your pocket and nothing shipped. Spend it.`);
  if (p.stats.helps + p.stats.gifts >= 3) out.push(`Helped or gave ${p.stats.helps + p.stats.gifts} times. Approved. I am surprised.`);
  return (out.length ? out : ["Clean diff. No comments. That is the suspicious part."]).slice(0, 3);
}

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
      : page === "review" ? list(reviewOf(this.sim().player, this.sim().hour))
      : h("p.line", { text: "“BOBONUT. I've read it one more time. Ask.”" });
    const opts = [
      h("button", { onclick: () => this.show("changes"), title: "Key 1", text: "What changed?" }),
      h("button", { onclick: () => this.show("drama"), title: "Key 2", text: "Any drama?" }),
      h("button", { onclick: () => this.show("review"), title: "Key 3", text: "Review me" }),
      h("button", { onclick: () => this.close(), title: "Key 4", text: "Bye" }),
    ];
    this.el.replaceChildren(
      h("button.x", { "aria-label": "End conversation", onclick: () => this.close(), text: "×" }),
      h("div.who", { text: `Terrance · updated ${feed.updated}` }), body, h("div.opts", null, opts));
    (opts[0] as HTMLElement).focus({ preventScroll: true });
    this.onSpeak?.(page === "hello" ? "BOBONUT. I've read it one more time. Ask." : page === "review" ? "I reviewed you. Twice." : page === "changes" ? "Here is what changed. Read it twice." : feed.drama.length ? "There is drama. Do not look at me." : "No drama. I do not trust it.");
  }
}
