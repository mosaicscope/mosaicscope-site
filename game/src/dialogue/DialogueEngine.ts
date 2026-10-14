import { livedLines } from "../ai/llm/context";
import { buzz, buzzOpener, buzzFeel, BUZZ_REPLIES } from "../content/buzz";
import type { Simulation } from "../sim/Simulation";
import { Character, Memory, Phys } from "../entities/types";
import { TOYS } from "../content/toys";
import { applyInteraction, friendship, hostility, memoryVerb, peek, remember, shareGossip } from "../social/Social";
import { LINES, LineCtx, LineTemplate } from "./lines";
import { forceGoal } from "../ai/brain";
import { transfer } from "../inventory/Inventory";
import { MOSAIC, PLUG_LINES, captionLine } from "../content/mosaicscope";
import { receptive, addLove, loveOf, getTogether, onGossip, attracted, kiss } from "../sim/Romance";
import { ROLE_LABEL } from "../content/names";
import { Director, readSecs } from "./director";
import { TalkState, TOPIC_BY_ID, answerTopic, rankTopics, talkCtx } from "./playerTalk";
import { LORE } from "../content/lore";
import { swear } from "./swear";
import { repLine } from "../sim/Rep";

/**
 * Structured, deterministic dialogue. Lines are chosen from templates whose conditions match the
 * speaker's real state, relationships and knowledge (memories with provenance). Conversations are
 * short exchanges with consequences: relationships, gossip transfer, toy disputes, reconciliation.
 * No language model is used; an optional one could later rewrite `text` without changing outcomes.
 */
export interface Conversation { id: number; a: number; b: number; topic: string; turn: number; maxTurns: number; nextAt: number; log: { who: number; text: string }[]; outcome: string; script?: string[]; buzz?: boolean; wantBuzz?: boolean; buzzTitle?: string }

export interface PlayerOption { id: string; label: string }
export interface PlayerLink { label: string; href: string }
export interface PlayerReply { speaker: string; text: string; options: PlayerOption[]; ended: boolean; opener?: string[]; links?: PlayerLink[]; img?: string; action?: "trade" }

const byTopic = new Map<string, LineTemplate[]>();
for (const l of LINES) { const a = byTopic.get(l.topic) ?? []; a.push(l); byTopic.set(l.topic, a); }

export class DialogueEngine {
  convs = new Map<number, Conversation>();
  private nextId = 1;
  /** recent line ids per speaker (repetition prevention) */
  private recent = new Map<number, string[]>();
  /** global template cooldown */
  private lastUse = new Map<string, number>();
  playerTarget = -1;
  /** where the current player conversation has got to: what was just asked, what's already been covered */
  talk: TalkState = { last: null, used: new Set(), turn: 0 };
  readonly director: Director;
  constructor(private sim: Simulation) { this.director = new Director(sim); }

  // ---------------- context ----------------
  ctx(s: Character, l: Character | null, extra: Partial<LineCtx> = {}): LineCtx {
    const sim = this.sim;
    const rel = l ? peek(s, l.id) : undefined;
    const toyId = s.hand >= 0 ? s.hand : s.bag[0] ?? -1;
    return {
      s, l, rel, lrel: l ? peek(l, s.id) : undefined,
      friend: friendship(rel), hostile: hostility(rel), mood: s.emo.mood,
      place: sim.world.areaAt(s.x, s.y)?.name ?? "here", weather: sim.env.storm ? "storm" : sim.env.raining ? "rain" : "clear",
      hour: sim.hour, toy: toyId >= 0 ? TOYS[sim.toys[toyId].def].name : "", mem: null, memText: "", about: "",
      party: sim.env.party, dark: sim.isDark, busy: s.goal !== null && s.goal.id === "fight", scared: s.emo.fear > 0.5,
      angry: s.emo.frustration > 0.5, hurt: s.phys !== Phys.OK || s.emo.composure < 0.4, isPlayer: s.tier === "player",
      ...extra,
    };
  }

  /** Describe a memory truthfully from the speaker's perspective. */
  describe(m: Memory, speaker: Character): string {
    const sim = this.sim;
    const nm = (id: number) => (id === speaker.id ? "I" : id < 0 ? "someone" : sim.chars[id]?.name ?? "someone");
    const subj = nm(m.subj), obj = m.obj >= 0 ? (m.obj === speaker.id ? "me" : sim.chars[m.obj]?.name ?? "someone") : "";
    const toy = m.toy ? ` with a ${TOYS[m.toy]?.name ?? m.toy}` : "";
    const place = sim.world.areas[m.area]?.name ?? "";
    switch (m.kind) {
      case "hit": case "hit_by": return m.kind === "hit_by" ? `${obj === "me" ? "I" : obj} got hit by ${subj === "I" ? "me" : subj}${toy}` : `${subj} hit ${obj}${toy}`;
      case "saw_fight": return `${subj} and ${obj || "someone"} had a toy fight at ${place}`;
      case "saw_break": return `${subj} broke a ${m.toy ? TOYS[m.toy]?.name : "toy"}`;
      case "helped": case "helped_by": return `${subj} helped ${obj} up`;
      case "gift_from": case "gift_to": return `${subj} gave ${obj} a ${m.toy ? TOYS[m.toy]?.name : "present"}`;
      case "argued": return `${subj} and ${obj} had a massive argument`;
      case "made_up": return `${subj} and ${obj} made up`;
      case "lost_item": return `${subj === "I" ? "I" : subj} lost a ${m.toy ? TOYS[m.toy]?.name : "toy"}`;
      case "party": return `there was a party at ${place}`;
      case "insulted_by": return `${subj} roasted ${obj}`;
      default: return `${subj} ${memoryVerb[m.kind]} ${obj}`.trim();
    }
  }

  private fill(text: string, c: LineCtx): string {
    return text
      .replace(/\{name\}/g, c.s.name).replace(/\{other\}/g, c.l ? (c.l.tier === "player" ? "stranger" : c.l.name) : "you")
      .replace(/\{toy\}/g, c.toy || "toy").replace(/\{place\}/g, c.place).replace(/\{weather\}/g, c.weather)
      .replace(/\{mem\}/g, c.memText).replace(/\{about\}/g, c.about).replace(/\{catch\}/g, c.s.catchphrase || "...")
      .replace(/\{bio\}/g, c.s.bio || `I'm ${c.s.name}. I hang around ${c.place}.`);
  }

  /** Pick a line for a topic, honouring conditions, weights, per-speaker repetition and template cooldowns. */
  line(topic: string, c: LineCtx): string {
    const pool = byTopic.get(topic);
    if (!pool) return "...";
    const sim = this.sim;
    const recent = this.recent.get(c.s.id) ?? [];
    const ok = pool.filter((t) => !t.when || t.when(c));
    if (!ok.length) return "...";
    // conditional templates are more specific: prefer them
    const weights = ok.map((t) => (t.weight ?? 1) * (t.when ? 2 : 1) * ((this.lastUse.get(t.id) ?? -1e9) > sim.tick - 120 ? 0.3 : 1));
    const t = ok[Math.max(0, sim.rng.weighted(weights))];
    const options = t.lines.map((l, i) => ({ l, k: t.id + i })).filter((x) => !recent.includes(x.k));
    const pick = options.length ? sim.rng.pick(options) : { l: sim.rng.pick(t.lines), k: t.id };
    recent.push(pick.k); if (recent.length > 8) recent.shift();
    this.recent.set(c.s.id, recent);
    this.lastUse.set(t.id, sim.tick);
    return this.foul(this.fill(pick.l, c), c.s);
  }

  /** Every spoken line goes through the town's mouth: some people swear a lot (see swear.ts). The player's own lines are left alone. */
  private foul(text: string, speaker: Character): string {
    return speaker.tier === "player" ? text : swear(text, speaker, () => this.swearRoll());
  }
  /** Swearing only changes words, so it has its own random stream and never shifts what the sim does next. */
  private swearSeed = 0x9e3779b9;
  private swearRoll(): number {
    let t = (this.swearSeed = (this.swearSeed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A line about MosaicScope using real posts and prices. Returns the post it mentions (if any). */
  plug(c: Character): { text: string; post: (typeof MOSAIC.posts)[number] | null } {
    const sim = this.sim;
    const posts = MOSAIC.posts.filter((p) => captionLine(p.caption));
    const post = posts.length ? posts[sim.rng.int(0, Math.min(posts.length, 6) - 1)] : null;
    const pool = PLUG_LINES.filter((l) => post || !l.includes("{post}"));
    const recent = this.recent.get(c.id) ?? [];
    const opts = pool.filter((l) => !recent.includes("plug:" + l));
    const line = sim.rng.pick(opts.length ? opts : pool);
    recent.push("plug:" + line); if (recent.length > 8) recent.shift(); this.recent.set(c.id, recent);
    const text = line.replace("{post}", post ? captionLine(post.caption) : "").replace("{rate}", MOSAIC.rates[0]?.price ?? "$40");
    return { text, post: line.includes("{post}") ? post : null };
  }

  bark(c: Character, topic: string, other: Character | null = null, extra: Partial<LineCtx> = {}): string {
    return this.line(topic, this.ctx(c, other, extra));
  }

  // ---------------- NPC <-> NPC conversations ----------------
  start(a: Character, b: Character, topic: string): boolean {
    if (a.talkWith >= 0 || b.talkWith >= 0 || b.phys !== Phys.OK || b.mode === "panic" || b.tier === "player") return false;
    if (b.goal && (b.goal.id === "fight" || b.goal.id === "help" || b.goal.id === "flee")) return false;
    // willingness: hostile or busy people may refuse
    const r = peek(b, a.id);
    if (hostility(r) > 0.55 && topic !== "dispute" && topic !== "apology") { this.sim.say(b, this.bark(b, "greet", a), "say", 1.5); return false; }
    const conv: Conversation = { id: this.nextId++, a: a.id, b: b.id, topic, turn: 0, maxTurns: topic === "chat" ? 3 + this.sim.rng.int(0, 3) : 3, nextAt: this.sim.tick + 10, log: [], outcome: "" };
    // small talk and plugs run as an authored exchange: every reply answers the line before it
    // now and then a chat is someone passing on what the real town is talking about (see content/buzz.ts)
    if (topic === "chat" && buzz.length && this.sim.rng.chance(0.12)) conv.wantBuzz = true;
    else if (topic === "chat" || topic === "plug") {
      const script = this.director.pick(a, b, topic === "plug" ? (e) => e.id.startsWith("scene_") : undefined);
      if (script) { conv.script = script; conv.maxTurns = script.length; }
    }
    this.convs.set(conv.id, conv);
    a.talkWith = b.id; b.talkWith = a.id;
    a.stats.talks++; b.stats.talks++;
    return true;
  }

  end(c: Character): void {
    for (const conv of this.convs.values()) if (conv.a === c.id || conv.b === c.id) this.close(conv);
  }

  private close(conv: Conversation): void {
    const a = this.sim.chars[conv.a], b = this.sim.chars[conv.b];
    if (a && a.talkWith === b?.id) a.talkWith = -1;
    if (b && b.talkWith === a?.id) b.talkWith = -1;
    if (a && b && conv.turn > 0) {
      remember(a, { t: this.sim.tick, kind: "talked", subj: b.id, obj: -1, toy: null, area: this.sim.world.areaAt(a.x, a.y)?.id ?? 0, val: 0.05, ev: -1, src: "did" });
      remember(b, { t: this.sim.tick, kind: "talked", subj: a.id, obj: -1, toy: null, area: this.sim.world.areaAt(b.x, b.y)?.id ?? 0, val: 0.05, ev: -1, src: "did" });
    }
    this.convs.delete(conv.id);
  }

  /** Advance all conversations (called every tick; each exchange waits for its line to be read). */
  update(): void {
    const sim = this.sim;
    for (const conv of this.convs.values()) {
      const a = sim.chars[conv.a], b = sim.chars[conv.b];
      if (!a || !b || a.talkWith !== b.id || b.talkWith !== a.id || a.phys !== Phys.OK || b.phys !== Phys.OK || Math.hypot(a.x - b.x, a.y - b.y) > 3) { this.close(conv); continue; }
      if (sim.tick < conv.nextAt) continue;
      const speaker = conv.turn % 2 === 0 ? a : b, listener = speaker === a ? b : a;
      const text = conv.script ? this.scripted(conv, speaker, listener) : this.exchange(conv, speaker, listener);
      // each line stays up as long as it takes to read, then a short beat before the reply
      const secs = text ? readSecs(text) : 1;
      if (text) { sim.say(speaker, text, conv.topic === "argue" ? "shout" : "say", secs); conv.log.push({ who: speaker.id, text }); }
      conv.turn++;
      conv.nextAt = sim.tick + Math.round(60 * (secs + 0.45));
      if (conv.turn >= conv.maxTurns || conv.outcome === "end") this.close(conv);
    }
  }

  /** A line from the conversation's authored exchange, with the same social effects as small talk. */
  private scripted(conv: Conversation, s: Character, l: Character): string {
    const sim = this.sim, tick = sim.tick;
    if (conv.turn === 0) {
      applyInteraction(s, l, "talk", false, tick); applyInteraction(l, s, "talk", true, tick);
      if (conv.topic === "plug") {
        l.needs.curiosity = Math.min(1, l.needs.curiosity + 0.1);
        sim.emit({ type: "plug", x: s.x, y: s.y, actors: [s.id, l.id], summary: `${s.name} put ${l.name} onto ${MOSAIC.handle}` });
      }
    }
    s.needs.social = Math.min(1, s.needs.social + 0.1); l.needs.social = Math.min(1, l.needs.social + 0.07);
    if (conv.turn === (conv.script?.length ?? 0) - 1 && s.pers.playfulness > 0.5) { applyInteraction(l, s, "joke", true, tick); }
    return this.foul(conv.script?.[conv.turn] ?? "", s);
  }

  /** One utterance with its consequences. Returns the text said. */
  private exchange(conv: Conversation, s: Character, l: Character): string {
    const sim = this.sim, tick = sim.tick, t = conv.topic;
    if (conv.turn === 0 && t !== "dispute" && t !== "apology" && t !== "argue") {
      applyInteraction(s, l, "talk", false, tick); applyInteraction(l, s, "talk", true, tick);
      return this.bark(s, "greet", l);
    }
    s.needs.social = Math.min(1, s.needs.social + 0.12); l.needs.social = Math.min(1, l.needs.social + 0.08);
    if (t === "chat") {
      const c = this.ctx(s, l);
      // the reply to a bit of hearsay reacts to it, in character
      if (conv.turn % 2 === 1 && conv.buzz) {
        conv.buzz = false;
        // news lands on the listener: good news lifts them, grating news drags; either way it's something to chew on
        const f = buzzFeel(conv.buzzTitle ?? "");
        s.emo.mood = Math.max(-1, Math.min(1, s.emo.mood + f * 0.04)); s.needs.curiosity = Math.min(1, s.needs.curiosity + 0.08);
        const pool = l && (c.hostile > 0.3 || s.pers.kindness < 0.3) ? BUZZ_REPLIES.cold : BUZZ_REPLIES.warm; return pool[sim.rng.int(0, pool.length - 1)];
      }
      if (conv.turn % 2 === 1) return this.line(c.hostile > 0.3 ? "reply" : "reply", c);
      if (conv.wantBuzz && buzz.length) { conv.wantBuzz = false; conv.buzz = true; const b = buzz[sim.rng.int(0, buzz.length - 1)]; conv.buzzTitle = b.title; return buzzOpener(b.title, (n) => sim.rng.int(0, n - 1)); }
      // playful people joke, hostile people tease; teasing can tip into an argument
      if (c.hostile > 0.35 && s.pers.kindness < 0.6 && sim.rng.chance(0.6)) {
        applyInteraction(l, s, "insult", true, tick);
        remember(l, { t: tick, kind: "insulted_by", subj: s.id, obj: l.id, toy: null, area: sim.world.areaAt(l.x, l.y)?.id ?? 0, val: -0.4, ev: -1, src: "did" });
        if (l.pers.temper > 0.5 || hostility(peek(l, s.id)) > 0.4) { conv.topic = "argue"; sim.emitArgument(s, l, null); }
        return this.line("tease", c);
      }
      if (s.pers.playfulness > 0.6 && sim.rng.chance(0.35)) { applyInteraction(l, s, "joke", true, tick); applyInteraction(s, l, "joke", false, tick); return this.line("joke", c); }
      return this.line("chat", c);
    }
    if (t === "flirt") {
      if (conv.turn % 2 === 0) return this.bark(s, conv.turn === 0 ? "flirt" : "flirt_more", l);
      const yes = receptive(sim, s, l);
      addLove(sim, l, s, yes ? 0.09 : 0.02); if (yes) addLove(sim, s, l, 0.07);
      if (!yes) { conv.outcome = "end"; l.emo.mood = Math.max(-1, l.emo.mood - 0.05); return this.bark(s, "flirt_no", l); }
      if (conv.turn >= 3 && loveOf(s, l.id) > 0.5 && loveOf(l, s.id) > 0.5 && s.partner !== l.id && s.affair !== l.id) { conv.outcome = "end"; getTogether(sim, s, l); return this.bark(s, "together", l); }
      return this.bark(s, "flirt_yes", l);
    }
    if (t === "plug") {
      if (conv.turn % 2 === 0) {
        const p = this.plug(s);
        l.needs.curiosity = Math.min(1, l.needs.curiosity + 0.1);
        if (p.post) sim.emit({ type: "plug", x: s.x, y: s.y, actors: [s.id, l.id], summary: `${s.name} told ${l.name} about the @mosaicscope post "${captionLine(p.post.caption)}"` });
        return p.text;
      }
      return this.line("gossip_react", this.ctx(s, l));
    }
    if (t === "gossip") {
      if (conv.turn % 2 === 0) {
        const m = shareGossip(s, l, tick);
        if (m) onGossip(sim, l, m.kind, m.subj, m.obj, m.cred);
        const c = this.ctx(s, l);
        if (m) {
          c.mem = m; c.memText = this.describe(m, s);
          const orig = s.memories.find((x) => x.ev === m.ev && x.kind === m.kind && x.subj === m.subj);
          c.mem = orig ?? m; c.about = orig && orig.from >= 0 ? sim.chars[orig.from]?.name ?? "someone" : "";
          if (orig && orig.src !== "saw" && orig.src !== "did" && orig.from < 0) c.mem = { ...orig, src: "heard" };
          sim.emit({ type: "rumour", x: s.x, y: s.y, actors: [s.id, l.id], data: { about: m.subj, cred: Math.round(m.cred * 100) }, summary: `${s.name} told ${l.name}: "${c.memText}"` });
          applyInteraction(l, s, "talk", true, tick, 1.5);
        } else conv.outcome = "end";
        return this.line("gossip", c);
      }
      return this.line("gossip_react", this.ctx(s, l));
    }
    if (t === "dispute") {
      // a = claimant, b = holder of the claimant's toy
      const claimant = sim.chars[conv.a], holder = sim.chars[conv.b];
      const toy = sim.toys.find((x) => x.owner === claimant.id && x.holder === holder.id);
      if (!toy) { conv.outcome = "end"; return this.bark(s, "reply", l); }
      if (conv.turn === 0) return this.bark(claimant, "dispute", holder, { toy: TOYS[toy.def].name });
      const r = peek(holder, claimant.id);
      const yields = friendship(r) > 0.15 || holder.pers.honesty > 0.65 || (r?.fear ?? 0) > 0.3 || holder.pers.boldness < 0.35;
      conv.outcome = "end";
      if (yields && transfer(holder, claimant, toy, false)) {
        applyInteraction(claimant, holder, "helped", true, tick, 0.5);
        sim.emit({ type: "toy_found", x: claimant.x, y: claimant.y, actors: [claimant.id, holder.id], toy: toy.def, summary: `${holder.name} gave ${claimant.name} back the ${TOYS[toy.def].name}` });
        return this.bark(holder, "dispute_yield", claimant);
      }
      applyInteraction(claimant, holder, "steal", true, tick);
      claimant.emo.frustration = Math.min(1, claimant.emo.frustration + 0.35);
      sim.emit({ type: "toy_dispute", x: claimant.x, y: claimant.y, actors: [claimant.id, holder.id], toy: toy.def, data: { toyId: toy.id }, summary: `${holder.name} won't give ${claimant.name} their ${TOYS[toy.def].name} back` });
      return this.bark(holder, "dispute_refuse", claimant);
    }
    if (t === "apology") {
      if (conv.turn === 0) return this.bark(s, "apology", l);
      const apologiser = sim.chars[conv.a], other = sim.chars[conv.b];
      applyInteraction(other, apologiser, "apologise", true, tick);
      applyInteraction(apologiser, other, "apologise", true, tick);
      conv.outcome = "end";
      const r = peek(other, apologiser.id);
      if (r && r.grudge < 0.2) {
        sim.emit({ type: "reconcile", x: other.x, y: other.y, actors: [apologiser.id, other.id], summary: `${apologiser.name} and ${other.name} made up` });
        return this.bark(other, "apology_accept", apologiser);
      }
      return this.bark(other, "apology_reject", apologiser);
    }
    if (t === "argue") {
      applyInteraction(l, s, "argue", true, tick);
      l.emo.frustration = Math.min(1, l.emo.frustration + 0.12 * (0.5 + l.pers.temper));
      if (conv.turn >= 3 && hostility(peek(s, l.id)) > 0.45 && s.pers.boldness > 0.5) {
        conv.outcome = "end";
        // escalation: the argument turns into a toy fight if a weapon is around
        sim.afterConversation(() => forceGoal(s, sim, "fight", { u: 1, target: l.id }));
      }
      return this.bark(s, "argue", l);
    }
    return this.bark(s, "reply", l);
  }

  // ---------------- Player <-> NPC ----------------
  /**
   * What you can say right now: the special moves (gifts, trades, flirting, peace-making) and the conversation
   * topics from playerTalk, all scored against who this person is, who you are to them and what's going on.
   * The best few are offered, plus a way out; follow-ups of what was just said float to the top.
   */
  playerOptions(npc: Character): PlayerOption[] {
    const sim = this.sim, p = sim.player, st = this.talk;
    const t = talkCtx(sim, npc, st);
    const cand: (PlayerOption & { score: number })[] = [];
    const add = (id: string, label: string, score: number) => { if (score > 0 && !st.used.has(id.split(":")[0])) cand.push({ id, label, score: score + sim.rng.next() * 0.2 }); };
    const vary = (...a: string[]) => a[(npc.id + st.turn) % a.length];
    add("news", vary("What's been happening?", "Heard any goss?", "What's the word on the street?"), npc.memories.some((m) => m.kind !== "talked" && Math.abs(m.val) > 0.1) ? 0.6 : 0.3);
    add("about", t.stranger ? vary("Who are you, then?", "Tell me about yourself.") : vary("Tell me about yourself.", "What's your story?"), t.stranger ? 0.7 : 0.35);
    let other = -1, os = 0;
    for (const [id, r] of npc.rel) if (id !== p.id && sim.chars[id]?.tier === "principal" && Math.abs(friendship(r)) + hostility(r) > os) { os = Math.abs(friendship(r)) + hostility(r); other = id; }
    if (other >= 0) add("opinion:" + other, vary(`What do you think of ${sim.chars[other].name}?`, `What's the deal with ${sim.chars[other].name}?`), 0.25 + os * 0.4);
    let grudge = -1;
    for (const [id, r] of npc.rel) if (id !== p.id && r.grudge > 0.2 && sim.chars[id]) { grudge = id; break; }
    if (grudge >= 0) add("peace:" + grudge, vary(`Make up with ${sim.chars[grudge].name}.`, `Just talk to ${sim.chars[grudge].name}, eh?`), 0.65);
    if (p.hand >= 0) add("give", `Here, have my ${TOYS[sim.toys[p.hand].def].name}.`, t.sad || t.friend > 0.3 ? 0.55 : 0.3);
    if (npc.hand >= 0) add("ask", `Can I have your ${TOYS[sim.toys[npc.hand].def].name}?`, 0.35);
    if (p.hand >= 0 && TOYS[sim.toys[p.hand].def].uses.some((u) => u === "melee" || u === "throw")) add("duel", t.hostile > 0.3 ? "Want to settle this? Toy fight." : "Toy fight. You and me.", 0.2 + t.hostile * 0.6 + npc.pers.playfulness * 0.2);
    add("mosaic", "What's MosaicScope?", npc.tier === "principal" || npc.role === "photographer" || npc.role === "model" ? 0.7 : 0.3);
    if (npc.attractedTo.includes(p.look.kind) && npc.tier !== "background") {
      if (npc.partner === p.id) { add("kiss", "Kiss", 0.7); add("dateme", vary("Let's go on a date.", "Come walk with me."), 0.6); }
      else add("flirt", vary("You've got a great smile.", "Has anyone told you you're stunning?", "Come here often?"), t.hostile > 0.3 || t.scared ? 0.1 : 0.5);
      if (npc.partner !== p.id && loveOf(npc, p.id) > 0.45) add("askout", "Want to go out sometime?", 0.8);
    }
    if (npc.tier !== "background" || npc.promoted) add("trade", "Want to trade?", ["shopkeeper", "vendor", "smuggler", "thief"].includes(npc.role) ? 0.6 : 0.25);
    if (npc.role === "cop") add("crime", "Any trouble around here?", 0.7);
    add("compliment", vary("Love the fit.", "You've got good taste.", "Nice shoes."), t.sad ? 0.45 : 0.25);
    add("tease", vary("Nice hat. Did your nan knit it?", "Did you get dressed in the dark?", "Bold choice, that outfit."), t.friend > 0.4 ? 0.3 : t.hostile > 0.3 ? 0.25 : 0.12);
    for (const r of rankTopics(t)) cand.push(r);
    cand.sort((a, b) => b.score - a.score);
    // never more than five things to say, plus a way out
    const o = cand.slice(0, 5).map(({ id, label }) => ({ id, label }));
    o.push({ id: "bye", label: st.turn >= 3 ? vary("Anyway, I'll let you go.", "Good talk. Later.", "Catch you round.") : vary("Later.", "See ya.", "Gotta run.") });
    return o;
  }

  /**
   * Everything a language model needs to play this person in a typed conversation: who they are, how they
   * feel, what they're doing, what they know and what they think of you. Facts only from the sim's state.
   */
  persona(npc: Character): string {
    const sim = this.sim, p = sim.player, t = talkCtx(sim, npc, this.talk);
    const pr = npc.pers;
    const traits = [pr.kindness > 0.65 ? "kind" : pr.kindness < 0.35 ? "a bit mean" : "", pr.temper > 0.65 ? "hot-headed" : pr.temper < 0.3 ? "chill" : "", pr.playfulness > 0.6 ? "jokey" : "", pr.boldness > 0.65 ? "bold" : pr.boldness < 0.3 ? "timid" : "", pr.sociability > 0.65 ? "chatty" : pr.sociability < 0.3 ? "a loner" : "", pr.honesty > 0.7 ? "honest" : pr.honesty < 0.3 ? "a bit shifty" : ""].filter(Boolean);
    const mood = t.scared ? "scared" : t.angry ? "angry" : t.hurt ? "hurt and sore" : t.happy ? "in a good mood" : t.sad ? "a bit down" : "fine";
    const you = t.partner ? "your partner, you love them" : t.stranger ? "a stranger you've never met" : t.hostile > 0.5 ? "someone you can't stand" : t.hostile > 0.25 ? "someone you're annoyed with" : t.friend > 0.5 ? "a close friend" : t.friend > 0.2 ? "someone you like" : "someone you know a little";
    const job = npc.role === "local" ? "a local" : `a ${ROLE_LABEL[npc.role]}`;
    const mems = npc.memories.filter((m) => m.kind !== "talked" && Math.abs(m.val) > 0.1).sort((a, b) => b.t - a.t).slice(0, 3).map((m) => this.describe(m, npc));
    const time = t.hour < 5 ? "the middle of the night" : t.hour < 12 ? "morning" : t.hour < 17 ? "afternoon" : t.hour < 21 ? "evening" : "late at night";
    const them: string[] = [];
    if (p.wanted > 0) them.push("the police are after them");
    if (p.blood < 0.7) them.push("they look beaten up");
    if (p.hand >= 0) them.push(`they're holding a ${TOYS[sim.toys[p.hand].def].name}`);
    return [
      `You are ${npc.name}, ${job} in a cartoon stick-figure version of Christchurch, New Zealand. Stay in character as ${npc.name} at all times.`,
      npc.bio ? `About you: ${npc.bio}` : "",
      repLine(npc, sim),
      traits.length ? `Personality: ${traits.join(", ")}.` : "",
      npc.catchphrase ? `Your catchphrase (use rarely): "${npc.catchphrase}"` : "",
      `Right now: it's ${time}${t.rain ? ", raining" : ""}${t.party ? ", there's a party on" : ""}. You're at ${t.place}, ${GOAL_TEXT[t.goal] ?? "hanging around"}. You feel ${mood}.`,
      mems.length ? `Things you know about: ${mems.join("; ")}.` : "",
      ...livedLines(npc, sim),
      `You're talking to the player, who is ${you}.${them.length ? " About them: " + them.join(", ") + "." : ""}`,
      "The story so far (stay consistent with it, but only bring it up if it fits):\n" + LORE,
      "Reply with ONE short spoken line (1 or 2 sentences, under 30 words). Casual Kiwi slang is fine. No narration, no actions in asterisks, no quotes, don't start with your own name. Swearing is fine when it suits your character; write swear words in full, never bleeped or starred out. No slurs, nothing sexual. Never mention being an AI or a game.",
    ].filter(Boolean).join("\n");
  }

  /** The player typed something. Social consequences use simple cues; the words themselves come from the model. */
  playerTyped(npc: Character, text: string): void {
    const sim = this.sim, p = sim.player, tick = sim.tick, s = text.toLowerCase();
    npc.needs.social = Math.min(1, npc.needs.social + 0.05);
    if (/\b(idiot|stupid|ugly|loser|shut up|dumb|hate you|moron)\b/.test(s)) {
      applyInteraction(npc, p, "insult", true, tick);
      remember(npc, { t: tick, kind: "insulted_by", subj: p.id, obj: npc.id, toy: null, area: sim.world.areaAt(npc.x, npc.y)?.id ?? 0, val: -0.35, ev: -1, src: "did" });
      sim.playerAct("teased", npc);
    } else if (/\b(love|awesome|amazing|beautiful|cool|great|legend|thanks|thank you|nice|sorry)\b/.test(s)) {
      applyInteraction(npc, p, "compliment", true, tick);
      npc.emo.mood = Math.min(1, npc.emo.mood + 0.05);
    } else applyInteraction(npc, p, "talk", true, tick);
    this.talk.turn++;
  }

  /** A built-in answer when the model is slow or unreachable, so typing never leaves you hanging. */
  typedFallback(npc: Character): string { return this.line("reply", this.ctx(npc, this.sim.player)); }

  playerOpen(npc: Character): PlayerReply {
    const sim = this.sim, p = sim.player;
    const busyNow = npc.phys !== Phys.OK || npc.mode === "panic" || (npc.goal?.id === "fight") || npc.talkWith >= 0 && npc.talkWith !== p.id;
    if (busyNow) { const text = this.bark(npc, "p_busy", p); sim.say(npc, text, "say", 2); return { speaker: npc.name, text, options: [], ended: true }; }
    if (npc.talkWith >= 0) this.end(npc);
    npc.talkWith = p.id; p.talkWith = npc.id; this.playerTarget = npc.id;
    this.talk = { last: null, used: new Set(), turn: 0 };
    npc.stats.talks++;
    applyInteraction(npc, p, "talk", true, sim.tick);
    // a short authored back-and-forth (them, then you) before your options appear
    const script = this.director.pick(npc, p);
    const opener = script ? script.slice(0, 2) : [this.bark(npc, "greet", p)];
    const text = opener[0];
    sim.say(npc, text, "say", 3);
    sim.playerAct("talked", npc);
    return { speaker: npc.name, text, options: this.playerOptions(npc), ended: false, opener };
  }

  playerChoose(npc: Character, optId: string): PlayerReply {
    const sim = this.sim, p = sim.player, tick = sim.tick;
    let text = "...", ended = false;
    const [id, arg] = optId.split(":");
    const c = (extra: Partial<LineCtx> = {}) => this.ctx(npc, p, extra);
    if (TOPIC_BY_ID.has(id)) {
      text = this.foul(answerTopic(talkCtx(sim, npc, this.talk), id), npc);
      applyInteraction(npc, p, "talk", true, tick);
      npc.needs.social = Math.min(1, npc.needs.social + 0.04);
      sim.say(npc, text, "say", readSecs(text));
      return { speaker: npc.name, text, options: this.playerOptions(npc), ended: false };
    }
    // the special moves count as covered too, so the next options move the conversation on
    if (id !== "bye" && id !== "trade" && id !== "mosaic") { this.talk.used.add(id); this.talk.last = id; this.talk.turn++; }
    switch (id) {
      case "news": {
        // only things the NPC actually knows, phrased by provenance
        const ms = npc.memories.filter((m) => m.kind !== "talked" && Math.abs(m.val) > 0.1).sort((a, b) => b.t - a.t).slice(0, 2);
        if (!ms.length) text = this.line("gossip", c());
        else text = ms.map((m) => {
          const cx = c({ mem: m, memText: this.describe(m, npc), about: m.from >= 0 ? sim.chars[m.from]?.name ?? "someone" : "" });
          return this.line("gossip", cx);
        }).join(" ");
        break;
      }
      case "about": {
        const goal = npc.goal ? ` Right now I'm ${GOAL_TEXT[npc.goal.id] ?? "busy"}.` : "";
        const job = npc.tier !== "principal" && npc.role !== "local" ? ` I'm a ${ROLE_LABEL[npc.role]}.` : "";
        text = this.line("p_about", c()) + job + goal;
        break;
      }
      case "opinion": text = this.line("p_opinion", { ...c(), about: sim.chars[+arg].name, friend: friendship(peek(npc, +arg)), hostile: hostility(peek(npc, +arg)) }); break;
      case "peace": {
        const tid = +arg, r = peek(npc, tid), trust = peek(npc, p.id)?.trust ?? 0;
        const ok = r && (trust + npc.pers.kindness * 0.6 > 0.45 || r.grudge < 0.35);
        if (ok && r) { r.grudge = Math.max(0, r.grudge - 0.2); npc.goalCooldowns["reconcile"] = 0; sim.afterConversation(() => forceGoal(npc, sim, "reconcile", { u: 1, target: tid, topic: "apology" })); }
        text = this.line(ok ? "p_peace_yes" : "p_peace_no", c({ about: sim.chars[tid].name }));
        sim.playerAct(ok ? "peacemaker" : "meddled", npc);
        break;
      }
      case "give": {
        const t = sim.toys[p.hand];
        if (t && transfer(p, npc, t, true)) {
          applyInteraction(npc, p, "gift", true, tick);
          npc.stats.gifts++;
          remember(npc, { t: tick, kind: "gift_from", subj: p.id, obj: npc.id, toy: t.def, area: sim.world.areaAt(npc.x, npc.y)?.id ?? 0, val: 0.5, ev: -1, src: "did" });
          sim.emit({ type: "gift", x: npc.x, y: npc.y, actors: [p.id, npc.id], toy: t.def, summary: `The stranger gave ${npc.name} a ${TOYS[t.def].name}` });
          text = this.line("p_gift_yes", c({ toy: TOYS[t.def].name }));
        } else text = this.line("p_gift_no", c());
        break;
      }
      case "ask": {
        const t = sim.toys[npc.hand], r = peek(npc, p.id);
        const yes = (r ? friendship(r) + r.favours * 0.1 : 0) + npc.pers.kindness * 0.3 > 0.35;
        if (yes && t && transfer(npc, p, t, true)) { applyInteraction(npc, p, "helped", false, tick); text = this.line("p_ask_yes", c()); }
        else text = this.line("p_ask_no", c());
        break;
      }
      case "duel": {
        const yes = npc.pers.boldness * 0.6 + npc.pers.playfulness * 0.5 + hostility(peek(npc, p.id)) * 0.5 > 0.6;
        text = this.line(yes ? "p_duel_yes" : "p_duel_no", c());
        if (yes) { ended = true; sim.afterConversation(() => forceGoal(npc, sim, "fight", { u: 1, target: p.id })); sim.playerAct("challenged", npc); }
        break;
      }
      case "mosaic": {
        const pl = this.plug(npc);
        const intro = npc.name === "Chris" ? `That's me. Photography and film around ${MOSAIC.location.split(" ·")[0]}: ${MOSAIC.services.slice(0, 4).join(", ").toLowerCase()}. Photos from ${MOSAIC.rates[0]?.price ?? "$40"}. ` : "";
        text = intro + pl.text;
        const links: PlayerLink[] = [];
        if (pl.post) links.push({ label: "See the post on Instagram ↗", href: pl.post.link });
        links.push({ label: `Follow ${MOSAIC.handle} ↗`, href: MOSAIC.instagram }, { label: "Book a shoot ↗", href: MOSAIC.booking });
        sim.say(npc, text, "say", 3);
        return { speaker: npc.name, text, options: this.playerOptions(npc), ended: false, links, img: pl.post?.img };
      }
      case "flirt": {
        const yes = attracted(npc, p) && (npc.partner < 0 || npc.pers.honesty < 0.35) && receptive(sim, npc, p);
        addLove(sim, npc, p, yes ? 0.12 : 0.02);
        text = this.line(yes ? "flirt_yes" : "flirt_no", c());
        break;
      }
      case "askout": {
        const yes = loveOf(npc, p.id) > 0.45 && (npc.partner < 0 || npc.pers.honesty < 0.35);
        if (yes) { if (npc.partner >= 0) { npc.affair = p.id; } else { npc.partner = p.id; p.partner = npc.id; } sim.emit({ type: "together", x: p.x, y: p.y, actors: [p.id, npc.id], summary: npc.partner === p.id ? `You and ${npc.name} are together now` : `You and ${npc.name} are secretly seeing each other` }); sim.bus.emit("fx", { kind: "heart", x: npc.x, y: npc.y, z: 1.8, n: 6 }); }
        text = this.line(yes ? "together" : "flirt_no", c());
        break;
      }
      case "kiss": { kiss(sim, npc, p); npc.anim.pose = "kiss"; text = this.line("flirt_yes", c()); break; }
      case "dateme": {
        text = "Lead the way.";
        sim.afterConversation(() => { npc.goal = null; this.sim.forceFollow(npc, p); });
        ended = true;
        break;
      }
      case "trade": {
        text = npc.pers.sociability > 0.3 ? "Show me what you've got." : "Make it quick.";
        sim.say(npc, text, "say", 2);
        return { speaker: npc.name, text, options: this.playerOptions(npc), ended: false, action: "trade" };
      }
      case "crime": {
        const recent = sim.crimes.filter((c) => sim.tick - c.tick < 60 * 600).slice(-3);
        text = recent.length ? recent.map((c) => `${sim.chars[c.perp]?.name ?? "Someone"}: ${c.type.replace("_", " ")}${c.solved ? " (sorted)" : " (still out there)"}.`).join(" ") : "Quiet shift so far. Keep it that way.";
        break;
      }
      case "compliment": applyInteraction(npc, p, "compliment", true, tick); npc.emo.mood = Math.min(1, npc.emo.mood + 0.1); text = this.line("p_comp", c()); break;
      case "tease": {
        applyInteraction(npc, p, "insult", true, tick);
        remember(npc, { t: tick, kind: "insulted_by", subj: p.id, obj: npc.id, toy: null, area: sim.world.areaAt(npc.x, npc.y)?.id ?? 0, val: -0.35, ev: -1, src: "did" });
        text = this.line("p_tease", c());
        sim.playerAct("teased", npc);
        break;
      }
      case "bye": default: text = this.line("p_bye", c()); ended = true;
    }
    sim.say(npc, text, "say", 3);
    if (ended) this.playerClose();
    return { speaker: npc.name, text, options: ended ? [] : this.playerOptions(npc), ended };
  }

  playerClose(): void {
    const sim = this.sim, p = sim.player;
    if (this.playerTarget >= 0) { const n = sim.chars[this.playerTarget]; if (n && n.talkWith === p.id) n.talkWith = -1; }
    p.talkWith = -1; this.playerTarget = -1;
  }

  serialize() { return { nextId: this.nextId }; }
}

export const GOAL_TEXT: Record<string, string> = {
  wander: "just wandering", routine: "doing my rounds", home: "heading home", socialize: "looking for someone to talk to", gossip: "spilling tea",
  play: "playing", collect: "grabbing a toy", fight: "settling a score", help: "helping someone out", rest: "taking a breather", watch: "seeing what's going on",
  party: "dancing", music: "sorting the music", shelter: "getting out of the rain", search: "looking for something I lost", reclaim: "getting my stuff back",
  gift: "giving something away", reconcile: "trying to make up with someone", craft: "building something", prank: "up to no good", ballgame: "in a ball game", flee: "getting away",
  eat: "getting a feed", work: "heading to work", gohome: "heading home", shop: "doing some shopping", gamble: "off to the casino", steal: "minding my own business", escape: "in a hurry",
  tag: "looking for a good wall", clean: "cleaning up tags", patrol: "on patrol", pursue: "chasing a suspect", book: "booking a MosaicScope shoot", attend: "getting ready for my shoot",
  photograph: "on a shoot", carmeet: "at the car meet", skate: "skating", busk: "busking", vend: "running the food truck", barter: "looking to trade", commute: "commuting",
};
