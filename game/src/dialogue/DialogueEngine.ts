import type { Simulation } from "../sim/Simulation";
import { Character, Memory, Phys } from "../entities/types";
import { TOYS } from "../content/toys";
import { applyInteraction, friendship, hostility, memoryVerb, peek, remember, shareGossip } from "../social/Social";
import { LINES, LineCtx, LineTemplate } from "./lines";
import { forceGoal } from "../ai/brain";
import { transfer } from "../inventory/Inventory";

/**
 * Structured, deterministic dialogue. Lines are chosen from templates whose conditions match the
 * speaker's real state, relationships and knowledge (memories with provenance). Conversations are
 * short exchanges with consequences: relationships, gossip transfer, toy disputes, reconciliation.
 * No language model is used; an optional one could later rewrite `text` without changing outcomes.
 */
export interface Conversation { id: number; a: number; b: number; topic: string; turn: number; maxTurns: number; nextAt: number; log: { who: number; text: string }[]; outcome: string }

export interface PlayerOption { id: string; label: string }
export interface PlayerReply { speaker: string; text: string; options: PlayerOption[]; ended: boolean }

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
  constructor(private sim: Simulation) {}

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
    return this.fill(pick.l, c);
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
      const text = this.exchange(conv, speaker, listener);
      if (text) { sim.say(speaker, text, conv.topic === "argue" ? "shout" : "say", 2.2); conv.log.push({ who: speaker.id, text }); }
      conv.turn++;
      conv.nextAt = sim.tick + 60 * 2.2;
      if (conv.turn >= conv.maxTurns || conv.outcome === "end") this.close(conv);
    }
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
      if (conv.turn % 2 === 1) return this.line(c.hostile > 0.3 ? "reply" : "reply", c);
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
    if (t === "gossip") {
      if (conv.turn % 2 === 0) {
        const m = shareGossip(s, l, tick);
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
  playerOptions(npc: Character): PlayerOption[] {
    const sim = this.sim, p = sim.player;
    const o: PlayerOption[] = [
      { id: "news", label: "What's been happening?" },
      { id: "about", label: "Tell me about yourself." },
    ];
    let other = -1, os = 0;
    for (const [id, r] of npc.rel) if (id !== p.id && sim.chars[id]?.tier === "principal" && Math.abs(friendship(r)) + hostility(r) > os) { os = Math.abs(friendship(r)) + hostility(r); other = id; }
    if (other >= 0) o.push({ id: "opinion:" + other, label: `What do you think of ${sim.chars[other].name}?` });
    let grudge = -1;
    for (const [id, r] of npc.rel) if (id !== p.id && r.grudge > 0.2 && sim.chars[id]) { grudge = id; break; }
    if (grudge >= 0) o.push({ id: "peace:" + grudge, label: `Make up with ${sim.chars[grudge].name}.` });
    if (p.hand >= 0) o.push({ id: "give", label: `Here, have my ${TOYS[sim.toys[p.hand].def].name}.` });
    if (npc.hand >= 0) o.push({ id: "ask", label: `Can I have your ${TOYS[sim.toys[npc.hand].def].name}?` });
    if (p.hand >= 0 && TOYS[sim.toys[p.hand].def].uses.some((u) => u === "melee" || u === "throw")) o.push({ id: "duel", label: "Toy fight. You and me." });
    o.push({ id: "compliment", label: "Love the fit." }, { id: "tease", label: "Nice hat. Did your nan knit it?" }, { id: "bye", label: "Later." });
    return o;
  }

  playerOpen(npc: Character): PlayerReply {
    const sim = this.sim, p = sim.player;
    const busyNow = npc.phys !== Phys.OK || npc.mode === "panic" || (npc.goal?.id === "fight") || npc.talkWith >= 0 && npc.talkWith !== p.id;
    if (busyNow) { const text = this.bark(npc, "p_busy", p); sim.say(npc, text, "say", 2); return { speaker: npc.name, text, options: [], ended: true }; }
    if (npc.talkWith >= 0) this.end(npc);
    npc.talkWith = p.id; p.talkWith = npc.id; this.playerTarget = npc.id;
    npc.stats.talks++;
    applyInteraction(npc, p, "talk", true, sim.tick);
    const text = this.bark(npc, "greet", p);
    sim.say(npc, text, "say", 3);
    sim.playerAct("talked", npc);
    return { speaker: npc.name, text, options: this.playerOptions(npc), ended: false };
  }

  playerChoose(npc: Character, optId: string): PlayerReply {
    const sim = this.sim, p = sim.player, tick = sim.tick;
    let text = "...", ended = false;
    const [id, arg] = optId.split(":");
    const c = (extra: Partial<LineCtx> = {}) => this.ctx(npc, p, extra);
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
        text = this.line("p_about", c()) + goal;
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
};
