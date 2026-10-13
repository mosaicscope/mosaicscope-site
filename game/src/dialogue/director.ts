import type { Simulation } from "../sim/Simulation";
import type { Character } from "../entities/types";
import type { Exchange } from "./exchanges";
import { CITY } from "./packs/city";
import { HEARTS } from "./packs/hearts";
import { STREET } from "./packs/street";
import { SCENE } from "./packs/scene";
import { CARETAKER } from "./packs/caretaker";
import { SATIRE } from "./packs/satire";
import { UPGRADES } from "./packs/upgrades";
import { LORE } from "./packs/lore";
import { peek, friendship, hostility } from "../social/Social";
import { loveOf } from "../sim/Romance";
import { MOSAIC, captionLine } from "../content/mosaicscope";
import { TOYS } from "../content/toys";
import { profile } from "../mind/Town";
import { cultureWeight, regionalise, toneOfExchange, Tone } from "../mind/Culture";

/**
 * Picks which authored exchange two people have, from ~3,000 lines of call-and-response dialogue.
 * Every tag on an exchange must be true for this pair right now; more specific exchanges (more tags)
 * win more often; nobody repeats an exchange they've already had with the same person, and the town
 * as a whole avoids recently heard ones. Placeholders are filled from the real situation.
 */
/**
 * The core exchanges load with the game. The large Life pack (~690 KB of source) is split into its own chunk and
 * appended when it arrives, so first paint is not blocked by it. Director.pick() reads this array at call time with
 * no index, so the town simply has quieter conversation for the first moments. Anything that needs the complete
 * set (tests, the merge script) must await `exchangesReady`.
 */
export const EXCHANGES: Exchange[] = [...CITY, ...HEARTS, ...STREET, ...SCENE, ...CARETAKER, ...SATIRE, ...UPGRADES, ...LORE];
export const exchangesReady: Promise<void> = import("./packs/life")
  .then((m) => { EXCHANGES.push(...m.LIFE); })
  .catch((err) => { console.warn("Life dialogue pack failed to load; the town keeps the core exchanges.", err); });

/** Recent world events that make an "after:*" tag true (within this many ticks and tiles). */
const AFTER: Record<string, string[]> = {
  crime: ["crime"], arrest: ["arrest", "busted"], crash: ["car_crash", "car_hit"], fight: ["toy_fight", "knockdown", "melee_hit"],
  graffiti: ["graffiti", "mural"], kiss: ["kiss", "caught_cheating"], shoot: ["photoshoot"], collapse: ["collapse", "hospital"],
  casino_win: ["casino"], party: ["party"],
};
const RECENT_TICKS = 60 * 90; // events from the last ~90 real seconds are still the talk of the street
const RECENT_TILES = 16;

/** Tone of each exchange, read once from its wording (see mind/Culture.ts). */
const TONES = new Map<string, Tone>();
const toneOf = (e: Exchange): Tone => { let t = TONES.get(e.id); if (!t) { t = toneOfExchange(e.lines, e.tags); TONES.set(e.id, t); } return t; };

export interface PairCtx { tags: Set<string>; who: string }

function first(name: string): string { return name.split(" ")[0]; }

export class Director {
  private byPair = new Map<string, string[]>();
  private recentGlobal: string[] = [];
  constructor(private sim: Simulation) {}

  /** All tags that hold for A talking to B. */
  context(a: Character, b: Character): PairCtx {
    const sim = this.sim, t = new Set<string>();
    const h = sim.hour;
    t.add(h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "day" : h >= 17 && h < 21 ? "evening" : h >= 21 ? "night" : "late");
    t.add(sim.env.storm ? "storm" : sim.env.raining ? "rain" : "clear");
    const area = sim.world.areaAt(a.x, a.y);
    if (area) t.add("@" + area.kind);
    if (sim.env.party) t.add("party");
    if (b.tier === "player") t.add("b:player");
    const rel = peek(a, b.id);
    if (a.partner === b.id || a.affair === b.id) t.add("couple");
    else if (loveOf(a, b.id) > 0.3) t.add("crush");
    if (friendship(rel) > 0.35) t.add("friends");
    if (!rel || rel.fam < 0.05) t.add("strangers");
    if (hostility(rel) > 0.3) t.add("rivals");
    for (const [who, c] of [["a", a], ["b", b]] as const) {
      t.add(`${who}:${c.role}`);
      if (c.tier === "principal") t.add(`${who}:mosaic`);
      if (c.emo.mood > 0.4) t.add(`${who}:happy`);
      if (c.emo.mood < -0.25) t.add(`${who}:sad`);
      if (c.emo.frustration > 0.5) t.add(`${who}:angry`);
      if (c.emo.fear > 0.5) t.add(`${who}:scared`);
      if (c.needs.energy < 0.3) t.add(`${who}:tired`);
      if (c.hunger < 0.3) t.add(`${who}:hungry`);
      if (c.needs.fun < 0.3) t.add(`${who}:bored`);
      if (c.cash < 15) t.add(`${who}:broke`);
      if (c.cash > 800) t.add(`${who}:rich`);
      if (c.wounds.length || c.emo.composure < 0.4) t.add(`${who}:hurt`);
    }
    // recent nearby events
    let who = "";
    const hist = sim.events.history;
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i];
      if (sim.tick - e.tick > RECENT_TICKS) break;
      if (Math.hypot(e.x - a.x, e.y - a.y) > RECENT_TILES) continue;
      for (const [k, types] of Object.entries(AFTER)) {
        if (!types.includes(e.type) || t.has("after:" + k)) continue;
        if (k === "casino_win" && !(+e.data.amount > 0)) continue;
        t.add("after:" + k);
        const actor = e.actors.find((id) => id !== a.id && id !== b.id);
        if (!who && actor !== undefined && actor >= 0 && sim.chars[actor]) who = first(sim.chars[actor].tier === "player" ? "that stranger" : sim.chars[actor].name);
      }
    }
    const p = sim.player;
    if (p.wanted >= 1 && Math.hypot(p.x - a.x, p.y - a.y) < 20) { t.add("wanted"); if (!who) who = "that one"; }
    if (MOSAIC.posts.some((x) => captionLine(x.caption))) t.add("post");
    return { tags: t, who };
  }

  /** Choose an exchange for A (opener) and B, or null if nothing fits. Returns filled lines. */
  pick(a: Character, b: Character, prefer?: (e: Exchange) => boolean): string[] | null {
    const sim = this.sim;
    const ctx = this.context(a, b);
    const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
    const had = this.byPair.get(key) ?? [];
    const cands: Exchange[] = [], weights: number[] = [];
    // culture decides the register: who they are (restraint, slang, formality, warmth, cohort) biases which exchange they open with
    const pa = profile(sim, a), older = profile(sim, b).cohort === "older";
    for (const e of EXCHANGES) {
      if (had.includes(e.id)) continue;
      if (!e.tags.every((tg) => ctx.tags.has(tg))) continue;
      if (e.tags.some((tg) => tg.startsWith("after:") || tg === "wanted") && !ctx.who && e.lines.some((l) => l.includes("{who}"))) continue;
      let wgt = (e.w ?? 1) * (1 + e.tags.length * 1.6);
      if (this.recentGlobal.includes(e.id)) wgt *= 0.05;
      if (prefer && prefer(e)) wgt *= 4;
      wgt *= cultureWeight(pa, toneOf(e), older);
      cands.push(e); weights.push(wgt);
    }
    if (!cands.length) return null;
    const e = cands[Math.max(0, sim.rng.weighted(weights))];
    had.push(e.id); if (had.length > 60) had.shift(); this.byPair.set(key, had);
    this.recentGlobal.push(e.id); if (this.recentGlobal.length > 160) this.recentGlobal.shift();
    const pb = profile(sim, b);
    return e.lines.map((l, i) => regionalise(this.fill(l, a, b, ctx), i % 2 === 0 ? pa : pb, sim.rng.next()));
  }

  private fill(text: string, a: Character, b: Character, ctx: PairCtx): string {
    const sim = this.sim;
    const area = sim.world.areaAt(a.x, a.y);
    const held = a.hand >= 0 ? sim.toys[a.hand] : null;
    const posts = MOSAIC.posts.filter((x) => captionLine(x.caption));
    const post = posts.length ? captionLine(posts[sim.rng.int(0, Math.min(posts.length, 6) - 1)].caption) : "";
    const nm = (c: Character) => (c.tier === "player" ? "mate" : first(c.name));
    return text
      .replace(/\{a\}/g, nm(a)).replace(/\{b\}/g, nm(b))
      .replace(/\{place\}/g, area && area.kind !== "street" ? area.name : sim.world.streetName(a.x, a.y) || "here")
      .replace(/\{item\}/g, held ? TOYS[held.def].name : "this")
      .replace(/\{who\}/g, ctx.who || "someone")
      .replace(/\{handle\}/g, MOSAIC.handle).replace(/\{rate\}/g, MOSAIC.rates[0]?.price ?? "$40")
      .replace(/\{post\}/g, post.length > 46 ? post.slice(0, 44).trim() + "…" : post);
  }
}

/** Reading time for a line, in seconds: a beat plus ~17 characters a second, clamped. */
export const readSecs = (text: string) => Math.min(6, Math.max(1.8, 1.1 + text.length / 17));
