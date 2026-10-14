import type { Simulation } from "../sim/Simulation";
import type { PlayerReply } from "../dialogue/DialogueEngine";
import { getLlm, llmPoolSize } from "../ai/llm";
import { h } from "./dom";

/** How long a typed reply may take before the person answers with a built-in line instead. */
const CHAT_TIMEOUT_MS = 15000;

/**
 * Player conversation panel: speaker, line, numbered response choices (keys 1-9). When an AI brain is
 * connected (Settings → Brains) there's also a box to type anything you like, on a phone or a computer;
 * the person answers in character from what the sim knows about them. Without a brain, choices only.
 */
export class DialogueUI {
  el: HTMLElement;
  npc = -1;
  onTrade: (npcId: number) => void = () => {};
  /** the typed back-and-forth with the current person (both sides), for the model and the on-screen log */
  private log: { who: "you" | "them"; text: string }[] = [];
  private chatEl: HTMLElement;
  private logEl: HTMLElement;
  private input: HTMLInputElement;
  private send: HTMLButtonElement;
  private waiting = false;

  constructor(private sim: () => Simulation) {
    this.el = h("section.panel.dialogue.hidden", { role: "dialog", "aria-label": "Conversation", "aria-live": "polite" });
    this.logEl = h("div.chatlog", { "aria-live": "polite" });
    this.input = h("input", { type: "text", placeholder: "Say anything…", maxlength: 200, autocomplete: "off", enterkeyhint: "send", "aria-label": "Type what you say" }) as HTMLInputElement;
    this.send = h("button.btn", { type: "submit", text: "Say" }) as HTMLButtonElement;
    const form = h("form.chat", { onsubmit: (e: Event) => { e.preventDefault(); this.typed(); } }, [this.input, this.send]);
    this.chatEl = h("div.chatbox", null, [this.logEl, form]);
  }
  get open(): boolean { return this.npc >= 0; }

  /** Typing is there only while a brain is connected. */
  private get canType(): boolean { return llmPoolSize() > 0; }

  start(id: number): void {
    const sim = this.sim(), c = sim.chars[id];
    if (!c) return;
    this.log = []; this.waiting = false;
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
    this.log = []; this.waiting = false;
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
    const opts = r.options.map((o, i) => h("button", { onclick: () => this.choose(o.id), title: `Key ${i + 1}`, "aria-keyshortcuts": String(i + 1) }, [o.label]));
    const parts: HTMLElement[] = [
      h("button.x", { "aria-label": "End conversation", onclick: () => this.close(), text: "×" }),
      h("div.who", { text: r.speaker }), h("p.line", { text: `“${r.text}”` }),
    ];
    if (r.img) parts.push(h("div.post", null, [h("img", { src: r.img, alt: "Instagram post" }), h("span", { text: "From @mosaicscope" })]));
    if (r.links?.length) parts.push(h("div.links", null, r.links.map((l) => h("a.btn" + (l.label.startsWith("Book") ? ".red" : ""), { href: l.href, target: l.href.startsWith("/") ? "_top" : "_blank", rel: "noopener", text: l.label }))));
    parts.push(r.options.length ? h("div.opts", null, opts) : h("button.btn", { onclick: () => this.close(), text: "Close" }));
    if (this.canType && this.npc >= 0) { this.drawLog(); parts.push(this.chatEl); }
    this.el.replaceChildren(...parts);
    if (r.action === "trade") { this.close(); this.onTrade(id0); return; }
    if (r.ended) { this.npc = -1; setTimeout(() => { if (this.npc < 0) this.el.classList.add("hidden"); }, 2400); }
    // keep the cursor in the box if you were typing; otherwise the first choice gets focus for keys and pads
    if (document.activeElement !== this.input) (opts[0] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }

  private drawLog(): void {
    const name = this.sim().chars[this.npc]?.name ?? "Them";
    const rows = this.log.slice(-6).map((m) => h("p" + (m.who === "you" ? ".you" : ""), null, [h("b", { text: m.who === "you" ? "You: " : `${name}: ` }), m.text]));
    if (this.waiting) rows.push(h("p.typing", { text: `${name} is thinking…` }));
    this.logEl.replaceChildren(...rows);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    this.input.disabled = this.waiting; this.send.disabled = this.waiting;
  }

  /** You typed a line: the sim takes the social hit or boost now, the words come back from the brain. */
  private typed(): void {
    const text = this.input.value.trim().slice(0, 200);
    const sim = this.sim(), id = this.npc, c = sim.chars[id];
    if (!text || !c || this.waiting) return;
    const brain = getLlm(id);
    this.input.value = "";
    this.log.push({ who: "you", text });
    sim.say(sim.player, text, "say", 3);
    sim.dialogue.playerTyped(c, text);
    if (!brain) { this.answer(id, sim.dialogue.typedFallback(c)); return; }
    this.waiting = true; this.drawLog();
    const transcript = [
      "The conversation so far:",
      ...this.log.slice(-10).map((m) => `${m.who === "you" ? "Player" : c.name}: ${m.text}`),
      `Reply as ${c.name} to the player's last line.`,
    ].join("\n");
    const timeout = new Promise<null>((res) => setTimeout(() => res(null), CHAT_TIMEOUT_MS));
    Promise.race([brain.chat(sim.dialogue.persona(c), transcript, c.name), timeout]).then((line) => {
      if (this.npc !== id) return; // they walked off or you closed the chat while it was thinking
      this.answer(id, line ?? sim.dialogue.typedFallback(c));
    });
  }

  private answer(id: number, line: string): void {
    const sim = this.sim(), c = sim.chars[id];
    this.waiting = false;
    if (!c || this.npc !== id) return;
    this.log.push({ who: "them", text: line });
    sim.say(c, line, "say", Math.min(6, 1.5 + line.length / 18));
    const q = this.el.querySelector(".line");
    if (q) q.textContent = `“${line}”`;
    this.drawLog();
    this.input.focus({ preventScroll: true });
  }

  key(n: number): boolean {
    if (this.npc < 0) return false;
    const b = this.el.querySelectorAll<HTMLButtonElement>(".opts button")[n - 1];
    if (b) { b.click(); return true; }
    return false;
  }
}
