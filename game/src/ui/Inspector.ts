import type { Simulation } from "../sim/Simulation";
import { LOD_NAMES, Phys } from "../entities/types";
import { TOYS } from "../content/toys";
import { friendship, hostility } from "../social/Social";
import { moodWord } from "../ai/needs";
import { GOAL_TEXT } from "../dialogue/DialogueEngine";
import { h, meter } from "./dom";

/** Character inspector: needs, emotions, personality, plan, inventory, relationships, memories. */
export class Inspector {
  el: HTMLElement;
  id = -1;
  private body: HTMLElement;
  constructor(private sim: () => Simulation, private actions: { talk: (id: number) => void; follow: (id: number) => void; select: (id: number) => void }) {
    this.body = h("div");
    this.el = h("section.panel.inspector.hidden", { "aria-label": "Character inspector", role: "region" }, [
      h("button.x", { "aria-label": "Close inspector", onclick: () => this.show(-1), text: "×" }), this.body,
    ]);
  }

  show(id: number): void { this.id = id; this.el.classList.toggle("hidden", id < 0); this.update(); }

  update(): void {
    if (this.id < 0) return;
    const sim = this.sim(), c = sim.chars[this.id];
    if (!c) { this.show(-1); return; }
    const status = c.phys === Phys.DOWN ? "knocked down" : c.phys === Phys.STUMBLE ? "stumbling" : c.phys === Phys.RECOVER ? "getting up" : c.talkWith >= 0 ? "talking to " + (sim.chars[c.talkWith]?.name ?? "?") : c.mode === "panic" ? "panicking" : c.goal ? GOAL_TEXT[c.goal.id] ?? c.goal.id : "idle";
    const tierLabel = c.tier === "background" ? (c.promoted ? "crowd (promoted)" : "crowd") : c.tier === "mid" ? "regular" : c.tier === "principal" ? "Mosaic" : "you";
    const kids: (HTMLElement | null)[] = [
      h("div.insp-head", null, [h("span.swatch", { style: { background: c.look.color, boxShadow: `0 0 0 3px ${c.look.accent}` } }), h("h2", { text: c.name }), h("span.tag", { text: tierLabel })]),
      c.bio ? h("p.bio", { text: c.bio }) : null,
      h("p", { style: { margin: "8px 0 0" } }, [h("b", { text: moodWord(c) }), " · " + status + " · sim: " + LOD_NAMES[c.lod]]),
    ];
    if (c.tier !== "background" || c.promoted) {
      kids.push(h("h3", { text: "Needs" }), meter("energy", c.needs.energy), meter("social", c.needs.social), meter("fun", c.needs.fun), meter("curiosity", c.needs.curiosity));
      kids.push(h("h3", { text: "Feelings" }), meter("mood", (c.emo.mood + 1) / 2), meter("fear", c.emo.fear, true), meter("frustration", c.emo.frustration, true), meter("confidence", c.emo.confidence), meter("composure", c.emo.composure));
      const p = c.pers;
      kids.push(h("h3", { text: "Personality" }), h("div.inv", null, (Object.entries(p) as [string, number][]).map(([k, v]) => h("span.chip", { text: `${k} ${Math.round(v * 100)}` }))));
      if (c.goal) kids.push(h("h3", { text: "Plan" }), h("ol.plan", null, c.goal.plan.map((s, i) => h("li" + (i === c.goal!.stepIdx ? ".cur" : ""), { text: s.kind + (s.target !== undefined && sim.chars[s.target] ? " → " + sim.chars[s.target].name : s.toy !== undefined && sim.toys[s.toy] ? " → " + TOYS[sim.toys[s.toy].def].name : "") }))));
      const items = [c.hand, ...c.bag].filter((x) => x >= 0).map((x) => sim.toys[x]).filter(Boolean);
      kids.push(h("h3", { text: "Carrying" }), items.length ? h("div.inv", null, items.map((t, i) => h("span.chip", { text: (i === 0 && c.hand >= 0 ? "✋ " : "") + TOYS[t.def].name + (t.owner === c.id ? "" : t.owner >= 0 ? ` (${sim.chars[t.owner]?.name}'s)` : "") + ` ${Math.round((t.durability / t.maxDurability) * 100)}%` }))) : h("p", { style: { margin: 0, color: "var(--dim)" }, text: "Nothing" }));
      const rels = [...c.rel.entries()].filter(([id]) => sim.chars[id]).sort((a, b) => Math.abs(friendship(b[1])) + hostility(b[1]) - Math.abs(friendship(a[1])) - hostility(a[1])).slice(0, 7);
      if (rels.length) {
        kids.push(h("h3", { text: "Relationships" }));
        for (const [id, r] of rels) {
          const f = friendship(r), ho = hostility(r);
          const bar = h("div.bidir", { title: `friendship ${f.toFixed(2)}, hostility ${ho.toFixed(2)}, trust ${r.trust.toFixed(2)}, fear ${r.fear.toFixed(2)}` }, [
            h("i", { style: f >= 0 ? { left: "50%", width: f * 50 + "%", background: "var(--acid)" } : { right: "50%", width: -f * 50 + "%", background: "var(--gold)" } }),
            ho > 0.05 ? h("i", { style: { right: "50%", width: ho * 50 + "%", background: "var(--red)", opacity: ".7" } }) : null,
          ]);
          kids.push(h("div.rel", null, [h("button", { onclick: () => this.actions.select(id), text: sim.chars[id].name + (r.grudge > 0.3 ? " (grudge)" : r.fear > 0.3 ? " (scared of)" : f > 0.4 ? " (friend)" : "") }), bar]));
        }
      }
      const mems = c.memories.slice(-6).reverse();
      if (mems.length) {
        kids.push(h("h3", { text: "Remembers" }));
        kids.push(h("ul.mem", null, mems.map((m) => h("li", null, [
          h("span.src", { text: (m.src === "told" || m.src === "heard" ? `${m.src}${m.from >= 0 ? " from " + (sim.chars[m.from]?.name ?? "?") : ""} · ${Math.round(m.cred * 100)}% sure` : m.src) + ` · ${Math.round((sim.tick - m.t) / 60)}s ago` }),
          h("div", { text: sim.dialogue.describe(m, c) }),
        ]))));
      }
      const s = c.stats;
      kids.push(h("h3", { text: "Record" }), h("p", { style: { margin: 0, color: "var(--dim)" }, text: `hits ${s.hits} · taken ${s.hitsTaken} · throws ${s.throws} · falls ${s.falls} · helped ${s.helps} · gifts ${s.gifts} · chats ${s.talks} · rep ${c.reputation.toFixed(2)}` }));
    }
    if (c.tier !== "player") kids.push(h("div.row", null, [
      h("button.btn", { onclick: () => this.actions.talk(c.id), text: "Talk (T)" }),
      h("button.btn", { onclick: () => this.actions.follow(c.id), text: "Follow with camera" }),
    ]));
    this.body.replaceChildren(...kids.filter(Boolean) as HTMLElement[]);
  }
}
