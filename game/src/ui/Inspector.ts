import type { Simulation } from "../sim/Simulation";
import { LOD_NAMES, Phys } from "../entities/types";
import { TOYS } from "../content/toys";
import { friendship, hostility } from "../social/Social";
import { moodWord } from "../ai/needs";
import { GOAL_TEXT } from "../dialogue/DialogueEngine";
import { h, meter } from "./dom";
import { ROLE_LABEL } from "../content/names";

/**
 * Character card: who they are, what they're up to, how they feel about you and one fun fact. The
 * nerdy detail (needs, feelings, personality, plan, inventory, relationships, memories) sits behind
 * "More" so the card stays light.
 */
const MOOD_EMOJI = (m: number, fear: number, angry: number) => (fear > 0.5 ? "😨" : angry > 0.55 ? "😤" : m > 0.5 ? "😄" : m > 0.15 ? "🙂" : m > -0.2 ? "😐" : m > -0.5 ? "😕" : "😢");
export class Inspector {
  el: HTMLElement;
  id = -1;
  private body: HTMLElement;
  private more = false;
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
    const me = sim.player, toMe = c.id !== me.id ? c.rel.get(me.id) : undefined;
    const fMe = friendship(toMe), hMe = hostility(toMe);
    const withYou = c.id === me.id ? "" : c.partner === me.id ? "Your person ❤" : hMe > 0.35 ? "Not a fan of you 😒" : fMe > 0.5 ? "Ride or die 🤝" : fMe > 0.25 ? "Likes you" : toMe && toMe.fam > 0.1 ? "Knows you" : "Never met you";
    const best = [...c.rel.entries()].filter(([id]) => sim.chars[id] && id !== me.id).sort((a, b) => friendship(b[1]) - friendship(a[1]))[0];
    const rival = [...c.rel.entries()].filter(([id]) => sim.chars[id] && id !== me.id).sort((a, b) => hostility(b[1]) - hostility(a[1]))[0];
    const partner = c.partner >= 0 ? sim.chars[c.partner] : null;
    const role = c.tier === "principal" ? "One of the Mosaics" : c.tier === "player" ? "You" : ROLE_LABEL[c.role] ? ROLE_LABEL[c.role][0].toUpperCase() + ROLE_LABEL[c.role].slice(1) : tierLabel;
    const facts: string[] = [];
    if (partner) facts.push(`With ${partner.name.split(" ")[0]}${c.affair >= 0 ? " (…mostly)" : ""}`);
    if (best && friendship(best[1]) > 0.3) facts.push(`Bestie: ${sim.chars[best[0]].name.split(" ")[0]}`);
    if (rival && hostility(rival[1]) > 0.3) facts.push(`Beef with ${sim.chars[rival[0]].name.split(" ")[0]}`);
    if (c.wanted > 0) facts.push("Wanted " + "★".repeat(c.wanted));
    if (c.cash > 100000) facts.push("Absolutely loaded"); else if (c.cash < 15) facts.push("Skint");
    const kids: (HTMLElement | null)[] = [
      h("div.insp-head", null, [h("span.swatch", { style: { background: c.look.color, boxShadow: `0 0 0 3px ${c.look.accent}` } }), h("h2", { text: c.name }), h("span.tag", { text: c.nickname ? `"${c.nickname}"` : tierLabel })]),
      h("p.card-role", { text: role }),
      h("p.card-now", null, [h("span.emo", { text: MOOD_EMOJI(c.emo.mood, c.emo.fear, c.emo.frustration) }), h("span", null, [h("b", { text: moodWord(c) }), " · " + status])]),
      withYou ? h("p.card-you", { text: withYou }) : null,
      facts.length ? h("div.inv", null, facts.map((f) => h("span.chip", { text: f }))) : null,
      c.bio ? h("p.bio", { text: c.bio }) : null,
    ];
    const detail: (HTMLElement | null)[] = [];
    const push0 = kids.push.bind(kids);
    if (c.tier !== "background" || c.promoted) {
      kids.push = (...xs: (HTMLElement | null)[]) => detail.push(...xs);
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
      kids.push(h("h3", { text: "Record" }), h("p", { style: { margin: 0, color: "var(--dim)" }, text: `hits ${s.hits} · taken ${s.hitsTaken} · throws ${s.throws} · falls ${s.falls} · helped ${s.helps} · gifts ${s.gifts} · chats ${s.talks} · rep ${c.reputation.toFixed(2)} · sim ${LOD_NAMES[c.lod]}` }));
      kids.push = push0;
      const more = h("details.card-more", { ontoggle: (e: Event) => { this.more = (e.target as HTMLDetailsElement).open; } }, [h("summary", { text: "More" }), ...detail.filter(Boolean) as HTMLElement[]]) as HTMLDetailsElement;
      more.open = this.more;
      kids.push(more);
    }
    if (c.tier !== "player") kids.push(h("div.row", null, [
      h("button.btn", { onclick: () => this.actions.talk(c.id), text: "Talk (T)" }),
      h("button.btn", { onclick: () => this.actions.follow(c.id), text: "Follow with camera" }),
    ]));
    this.body.replaceChildren(...kids.filter(Boolean) as HTMLElement[]);
  }
}
