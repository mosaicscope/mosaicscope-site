import { UPGRADES, UPGRADE_GROUPS, hasUpgrade, upgradeCost, type UpgradeGroup } from "../content/upgrades";
import { action } from "../sim/Chronicles";
import type { Simulation } from "../sim/Simulation";
import { h } from "./dom";

const icons: Record<UpgradeGroup, string> = { Skills: "◎", Crew: "♟", Home: "⌂", Money: "$", City: "▦", Style: "✧", Mosaics: "◆" };
const activities: Record<UpgradeGroup, [string, string, string?][]> = {
  Skills: [["Street performance", "busk"], ["Photo commission", "photo"], ["Dance session", "dance"], ["Park chess · $5 entry", "chess"], ["Pick nearby lock", "lockpick"], ["Paint a nearby wall · $5", "graffiti"], ["Clean nearby graffiti", "cleanup"]],
  Crew: [["Rest at hideout", "restcrew"], ["Call for backup", "backup"], ["Getaway · $25", "getaway"], ["Store carried toys", "store"], ["Retrieve toys", "retrieve"], ["Secret handshake", "handshake"]],
  Home: [["Breakfast", "breakfast"], ["Check doorbell", "visitor"]],
  Money: [["Delivery side hustle", "sidehustle"], ["Invest $50 for the day", "stocks"], ["Borrow up to $100", "borrow"], ["Repay up to $100", "repay"]],
  City: [["Visit VIP lounge", "vip"]],
  Style: [["Warm string lights", "lights", "warm"], ["Festival string lights", "lights", "festival"], ["Neon string lights", "lights", "neon"], ["Retro streetlights", "streetlight", "retro"], ["Neon streetlights", "streetlight", "neon"], ["Change outfit", "outfit"]],
  Mosaics: [["Tiles’s dance", "tiles"], ["Crew portrait", "crewphoto"], ["Change crew outfits", "outfit"], ["Ride / park Ruby’s bike", "bike"], ["Night out with Flash", "nightout"], ["Call your companion", "pet"], ["Harvest healing plants", "heal"]],
};
let music: AudioContext | null = null;
export function stopAlbumTrack(): void { void music?.close(); music = null; }
/** An original short synthesised loop; no external media or autoplay. */
function albumTrack(): void {
  stopAlbumTrack(); music = new AudioContext();
  const ctx = music, notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 261.63];
  for (let i = 0; i < 64; i++) {
    const osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + i * 0.23;
    osc.type = "triangle"; osc.frequency.value = notes[i % notes.length];
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.08, start + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.21);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + 0.23);
  }
}

export class Progression {
  group: UpgradeGroup = "Skills";
  private search = "";
  constructor(private sim: () => Simulation, private refresh: () => void, private message: (s: string) => void) {}
  private run(key: string, arg = "") { this.message(action(this.sim(), key, arg)); this.refresh(); }
  private button(text: string, key: string, arg = "") { return h("button.btn", { text, onclick: () => this.run(key, arg) }); }
  view(): HTMLElement[] {
    const sim = this.sim(), u = sim.life.upgrades;
    const cards = h("div.up-catalogue");
    const populate = () => cards.replaceChildren(...UPGRADES.filter(i => i.group === this.group && `${i.name} ${i.effect}`.toLowerCase().includes(this.search)).map(item => {
      const owned = hasUpgrade(u, item.id) && (item.id !== "film" || u.film > 0), cost = upgradeCost(u, item.cost);
      return h("article.up-item" + (owned ? ".owned" : ""), null, [
        h("span.up-icon", { text: icons[item.group], "aria-hidden": "true" }),
        h("div", null, [h("small", { text: `${item.group} / ${String(item.number).padStart(2, "0")}` }), h("h3", { text: item.name }), h("p", { text: item.effect })]),
        h("button.btn.up-buy", { text: owned ? "✓ Owned" : `$${cost} · Unlock`, disabled: owned || sim.player.cash < cost, "aria-label": `${owned ? "Owned" : `Buy for $${cost}`}: ${item.name}`, onclick: () => this.run("upgrade", item.id) }),
      ]);
    }));
    populate();
    const input = h("input.up-search", { type: "search", placeholder: "Find an upgrade…", value: this.search, "aria-label": "Search upgrades in this category", oninput: (e: Event) => { this.search = (e.target as HTMLInputElement).value.toLowerCase(); populate(); } });
    const nav = h("nav.up-categories", { "aria-label": "Upgrade categories" }, UPGRADE_GROUPS.map(g => h("button" + (g === this.group ? ".active" : ""), {
      text: `${icons[g]}  ${g}  ${UPGRADES.filter(i => i.group === g && hasUpgrade(u, i.id)).length}/11`, "aria-pressed": String(g === this.group), onclick: () => { this.group = g; this.search = ""; this.refresh(); },
    })));
    const status = this.group === "Money" ? `Debt $${u.debt.toFixed(2)} · Market signal ${u.market > 0.1 ? "rising" : u.market < -0.1 ? "falling" : "mixed"}. Research is uncertain.`
      : this.group === "Crew" ? `${u.crew.length}/8 recruited · ${u.stash.length} toys in safe storage · ${u.titles.join(" · ") || "No earned titles yet"}`
      : this.group === "Mosaics" ? `Crew album ${u.album}/3 milestones · ${u.bike ? "Riding Ruby’s bike" : "On foot"}`
      : this.group === "Skills" ? `${u.film} commissioned shots remaining. Activities use the game clock for cooldowns.` : "Your upgrades persist in saved games.";
    const extra: HTMLElement[] = [];
    if (this.group === "Crew") {
      const nearby = sim.chars.filter(c => c.id !== sim.playerId && c.tier !== "background" && !u.crew.includes(c.id) && Math.hypot(c.x - sim.player.x, c.y - sim.player.y) <= 8);
      extra.push(h("div.up-roster", null, [h("h3", { text: "Your people" }), ...u.crew.map(id => {
        const c = sim.chars[id];
        return h("div.up-member", null, [h("span.up-avatar", { text: c.name[0], style: { background: c.look.color, color: "#102227" } }), h("span", { text: `${c.name} · trust ${Math.round(sim.relate(c, sim.playerId).trust * 100)}%${hasUpgrade(u, "nova") ? ` · ${c.x.toFixed(0)}, ${c.y.toFixed(0)}` : ""}` }), this.button("Dismiss", "u:dismiss", String(id))]);
      }), ...nearby.slice(0, 8).map(c => this.button(`Invite ${c.name}`, "u:recruit", String(c.id))), !nearby.length ? h("p", { text: "Meet people in town to invite them into your crew." }) : null]));
      if (hasUpgrade(u, "van")) {
        const destination = h("select", { "aria-label": "Crew van destination" }, sim.world.buildings.map(b => h("option", { value: b.id, text: b.name }))) as HTMLSelectElement;
        extra.push(h("div.up-trip", null, [destination, h("button.btn", { text: "Take the crew", onclick: () => this.run("u:trip", destination.value) })]));
      }
    }
    if (this.group === "Money" && hasUpgrade(u, "tracker")) extra.push(h("section.up-ledger", null, [h("h3", { text: "Spending & income" }), ...u.ledger.slice(-12).reverse().map(row => h("div", null, [h("span", { text: row.label }), h("b", { text: `${row.amount >= 0 ? "+" : "−"}$${Math.abs(row.amount).toFixed(2)}`, class: row.amount >= 0 ? "positive" : "negative" })]))]));
    if (this.group === "Mosaics" && hasUpgrade(u, "album")) extra.push(h("div.up-album", null, [h("h3", { text: "After Hours / Crew sessions" }), h("p", { text: "Complete three crew dances, portraits or nights out to unlock your original track." }), h("button.btn", { text: "▶ Play unlocked track", disabled: u.album < 3, onclick: () => albumTrack() }), h("button.btn", { text: "■ Stop music", onclick: () => stopAlbumTrack() })]));
    return [h("div.up-summary", null, [h("small", { text: "MAKE THIS CITY YOURS" }), h("h2", { text: "A little more possibility." }), h("p", { text: `${u.owned.length}/${UPGRADES.length} upgrades unlocked · $${Math.round(sim.player.cash).toLocaleString("en-NZ")} available` })]),
      h("div.up-layout", null, [nav, h("div.up-main", null, [input, h("p.up-status", { text: status }), h("div.up-activities", null, activities[this.group].map(([label, key, arg]) => this.button(label, "u:" + key, arg))), ...extra, cards])])];
  }
}
