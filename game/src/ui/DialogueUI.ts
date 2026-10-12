import type { Simulation } from "../sim/Simulation";
import type { PlayerReply } from "../dialogue/DialogueEngine";
import { h } from "./dom";

/** Player conversation panel: speaker, line, numbered response choices (keys 1-9). */
export class DialogueUI {
  el: HTMLElement;
  npc = -1;
  onTrade: (npcId: number) => void = () => {};
  constructor(private sim: () => Simulation) {
    this.el = h("section.panel.dialogue.hidden", { role: "dialog", "aria-label": "Conversation", "aria-live": "polite" });
  }
  get open(): boolean { return this.npc >= 0; }

  start(id: number): void {
    const sim = this.sim(), c = sim.chars[id];
    if (!c) return;
    this.render(id, sim.dialogue.playerOpen(c));
  }

  choose(optId: string): void {
    const sim = this.sim(), c = sim.chars[this.npc];
    if (!c) { this.close(); return; }
    this.render(this.npc, sim.dialogue.playerChoose(c, optId));
  }

  close(): void {
    if (this.npc >= 0) this.sim().dialogue.playerClose();
    this.npc = -1; this.el.classList.add("hidden");
  }

  /** Close when the NPC wanders off, falls or gets busy. */
  check(): void {
    if (this.npc < 0) return;
    const sim = this.sim(), c = sim.chars[this.npc], p = sim.player;
    if (!c || c.talkWith !== p.id || Math.hypot(c.x - p.x, c.y - p.y) > 4) this.close();
  }

  private render(id: number, r: PlayerReply): void {
    const id0 = id;
    this.npc = r.ended && !r.options.length ? -1 : id;
    this.el.classList.remove("hidden");
    const opts = r.options.map((o, i) => h("button", { onclick: () => this.choose(o.id) }, [h("kbd", { text: String(i + 1) }), o.label]));
    const parts: HTMLElement[] = [
      h("button.x", { "aria-label": "End conversation", onclick: () => this.close(), text: "×" }),
      h("div.who", { text: r.speaker }), h("p.line", { text: `“${r.text}”` }),
    ];
    if (r.img) parts.push(h("div.post", null, [h("img", { src: r.img, alt: "Instagram post" }), h("span", { text: "From @mosaicscope" })]));
    if (r.links?.length) parts.push(h("div.links", null, r.links.map((l) => h("a.btn" + (l.label.startsWith("Book") ? ".red" : ""), { href: l.href, target: l.href.startsWith("/") ? "_top" : "_blank", rel: "noopener", text: l.label }))));
    parts.push(r.options.length ? h("div.opts", null, opts) : h("button.btn", { onclick: () => this.close(), text: "Close" }));
    this.el.replaceChildren(...parts);
    if (r.action === "trade") { this.close(); this.onTrade(id0); return; }
    if (r.ended) { this.npc = -1; setTimeout(() => { if (this.npc < 0) this.el.classList.add("hidden"); }, 2400); }
    (opts[0] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }

  key(n: number): boolean {
    if (this.npc < 0) return false;
    const b = this.el.querySelectorAll<HTMLButtonElement>(".opts button")[n - 1];
    if (b) { b.click(); return true; }
    return false;
  }
}
