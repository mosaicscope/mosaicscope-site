import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import { impairment, useSubstance, type SubstanceKind } from "./Substances";
import { forceGoal } from "../ai/brain";
import { arrest, enterBuilding } from "./Society";
import { startTurfWar, turfWarActive } from "./Turf";
import { peek } from "../social/Social";
import { bustHeat, onSale, restock, updateLabs } from "./Labs";
import { updateHealth } from "./Health";
import { raiseCue } from "./Pursuit";

/**
 * The street economy, adapted from npc-conditions / npc-industry and layered on the game's own substances, crews,
 * police and romance (nothing is duplicated, nothing here is saved):
 *  - dependence: repeated use builds a habit; after a while without it, craving shows up as edginess and the person
 *    goes looking for a dealer (the use itself, its animation, crises and paramedics all stay in Substances.ts)
 *  - dealers: crew members and "dealer" roles carry a little stock; deals use the "deal" pose, are witnessed, can get
 *    the dealer arrested, and heat up the crews' rivalry (which can start the existing turf war)
 *  - adult services: a couple of adult locals offer paid company. Consent comes first: the worker always decides, an
 *    impaired client or someone they dislike is refused, and "no" is final. Nothing is shown; they go indoors and time passes.
 * Everyone in this world is an adult (see Romance.ts).
 */
const RATE: Record<SubstanceKind, number> = { alcohol: 0.04, cannabis: 0.03, stimulant: 0.09, sedative: 0.08 };
const DRUGS: SubstanceKind[] = ["stimulant", "sedative", "cannabis"];
const ASK = ["Got anything for me?", "I'm looking to buy."], SELL = ["Sure. Keep it quiet.", "Here you go."];
interface Habit { dep: number; seen: number; lastUse: number; nextSeek: number }
interface State { pimps: Map<number, number>; habits: Map<number, Habit>; stock: Map<number, { units: number; kind: SubstanceKind; price: number }>; workers: Map<number, { price: number; refused: Map<number, number> }>;
  pending: Map<number, { worker: number; until: number }>; busy: Map<number, number>; poses: { ids: number[]; at: number }[]; tension: number; nextWar: number; nextRestock: number; ready: boolean }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { pimps: new Map(), habits: new Map(), stock: new Map(), workers: new Map(), pending: new Map(), busy: new Map(), poses: [], tension: 0, nextWar: 0, nextRestock: 0, ready: false }); return s; };
const dist = (a: Character, b: Character) => Math.hypot(a.x - b.x, a.y - b.y);
const free = (_sim: Simulation, c: Character) => c.tier !== "player" && c.phys === Phys.OK && c.inside < 0 && c.inCar < 0 && c.jailUntil <= 0 && c.arrestedBy < 0;
const face = (a: Character, b: Character) => { a.facing = Math.atan2(b.y - a.y, b.x - a.x); b.facing = Math.atan2(a.y - b.y, a.x - b.x); };

export function updateUnderworld(sim: Simulation): void {
  if (sim.tick % 30 !== 11) return;
  const st = state(sim);
  if (!st.ready) { if (sim.chars.length < 50) return; setup(sim, st); }
  for (const r of st.poses.splice(0)) { if (sim.tick < r.at) { st.poses.push(r); continue; } for (const id of r.ids) { const c = sim.chars[id]; if (c?.anim.pose === "deal") c.anim.pose = "auto"; } }
  if (sim.tick >= st.nextRestock) {   // crew dealers restock from their crew's lab stash; independents from their own supplier
    st.nextRestock = sim.tick + 60 * 300;
    for (const [id, s] of st.stock) if (s.units < 3) { const d = sim.chars[id]; const n = d ? restock(sim, d, s.kind) : 4; s.units += n ?? 4; }
  }
  updateLabs(sim); updateHealth(sim); pimpWatch(sim);
  habits(sim, st);
  services(sim, st);
  st.tension = Math.max(0, st.tension - 0.002);
  const h = sim.hour;
  if (st.tension > 0.7 && sim.tick >= st.nextWar && (h >= 19 || h < 3) && !turfWarActive(sim)) { st.nextWar = sim.tick + 60 * 600; if (startTurfWar(sim)) st.tension = 0.2; }
}

function setup(sim: Simulation, st: State): void {
  st.ready = true;
  let i = 0;
  for (const c of sim.chars) if (c.tier !== "player" && (c.role === "dealer" || c.role === "mobster")) st.stock.set(c.id, { units: 6, kind: DRUGS[i++ % DRUGS.length], price: 20 });
  // two adult locals near the start, single, with an ordinary role, offer paid company; who they are is arbitrary and they can refuse anyone
  const p = sim.player, pool = sim.chars.filter((c) => c.tier !== "player" && c.partner < 0 && !c.crew && ["local", "student", "vendor", "busker", "musician"].includes(c.role)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 12);
  for (let n = 0; n < Math.min(2, pool.length); n++) { const c = pool.splice(sim.rng.int(0, pool.length - 1), 1)[0]; st.workers.set(c.id, { price: 40, refused: new Map() }); }
}

function habits(sim: Simulation, st: State): void {
  for (const c of sim.chars) {
    const s = c.substances;
    if (s) {
      let h = st.habits.get(c.id);
      if (!h) st.habits.set(c.id, h = { dep: 0, seen: s.usedAt, lastUse: s.usedAt, nextSeek: 0 });
      if (s.usedAt !== h.seen) { h.seen = h.lastUse = s.usedAt; h.dep = Math.min(1, h.dep + RATE[s.last] * (1 + (1 - c.emo.composure))); }
    }
  }
  for (const [id, h] of st.habits) {
    const c = sim.chars[id]; if (!c) { st.habits.delete(id); continue; }
    const since = sim.tick - h.lastUse;
    if (since > 60 * 600) h.dep = Math.max(0, h.dep - 0.002);
    if (h.dep < 0.02 && !c.substances) { st.habits.delete(id); continue; }
    const craving = h.dep > 0.15 ? h.dep * Math.min(1, since / (60 * 180)) : 0;
    if (craving <= 0.1) continue;
    c.emo.frustration = Math.min(0.75, c.emo.frustration + craving * 0.01);   // withdrawal: edgy, shaky, tired
    c.emo.composure = Math.max(0.3, c.emo.composure - craving * 0.006);
    c.needs.energy = Math.max(0.05, c.needs.energy - craving * 0.0006);
    if (craving < 0.45 || !free(sim, c) || impairment(c) > 0.2) continue;
    let best: Character | undefined, bd = 30;
    for (const [did, stock] of st.stock) { const d = sim.chars[did]; if (!d || d === c || stock.units <= 0 || c.cash < stock.price || !free(sim, d)) continue; const k = dist(c, d); if (k < bd) { bd = k; best = d; } }
    if (!best) continue;
    if (bd < 3) { deal(sim, st, c, best); h.nextSeek = sim.tick + 60 * 45; }
    else if (sim.tick >= h.nextSeek) { h.nextSeek = sim.tick + 60 * 30; forceGoal(c, sim, "follow", { u: 2, target: best.id }); }
  }
}

function deal(sim: Simulation, st: State, buyer: Character, dealer: Character): void {
  const stock = st.stock.get(dealer.id); if (!stock) return;
  face(buyer, dealer); buyer.goal = null;
  if (!useSubstance(sim, buyer, stock.kind)) return;
  stock.units--; buyer.cash -= stock.price; dealer.cash += stock.price; onSale(sim, dealer, buyer, stock.price, stock.kind);
  for (const c of [buyer, dealer]) { c.anim.pose = "deal"; c.anim.poseT = 0; }
  st.poses.push({ ids: [buyer.id, dealer.id], at: sim.tick + 120 });
  sim.say(buyer, ASK[sim.rng.int(0, ASK.length - 1)], "say", 2); sim.say(dealer, SELL[sim.rng.int(0, SELL.length - 1)], "say", 2);
  sim.emit({ type: "substance_use", x: dealer.x, y: dealer.y, actors: [buyer.id, dealer.id], summary: `${buyer.name} bought something from ${dealer.name}` });
  st.tension = Math.min(1, st.tension + 0.06);
  // a cop who sees it may move in on the dealer (not mid turf war, when crews are armed and everyone is on edge)
  const cop = sim.chars.find((k) => k.role === "cop" && free(sim, k) && k.pursuing < 0 && dist(k, dealer) < 12 && sim.world.lineOfSight(k.x, k.y, dealer.x, dealer.y));
  if (!cop) return;
  if (buyer.tier === "player") { sim.say(cop, "Police! Stop right there!", "shout", 2); buyer.wanted = Math.max(buyer.wanted, 1); sim.lastSeenByCops = sim.tick; raiseCue(sim, "wanted", "Caught buying", "An officer saw the deal"); }
  if (turfWarActive(sim) || sim.rng.next() > 0.3) return;
  sim.say(cop, "Police! Hands where I can see them!", "shout", 2); arrest(sim, cop, dealer); st.tension = Math.max(0, st.tension - 0.1); bustHeat(sim, dealer.crew, 0.1);
}

/** Player menu hooks (see UnderworldTalk.ts). */
export const dealerInfo = (sim: Simulation, id: number) => { const s = state(sim).stock.get(id); return s && s.units > 0 ? { price: s.price } : undefined; };
export const workerInfo = (sim: Simulation, id: number) => { const w = state(sim).workers.get(id); return w ? { price: w.price } : undefined; };
export function playerBuy(sim: Simulation, dealer: Character): boolean { const before = sim.player.cash; deal(sim, state(sim), sim.player, dealer); return sim.player.cash < before; }
/** Paid company for the player: the worker decides, the scene is never shown (they go indoors, the player's mood lifts). */
export function hireDecision(sim: Simulation, worker: Character): boolean {
  const w = state(sim).workers.get(worker.id), p = sim.player; if (!w || !free(sim, worker) || impairment(worker) > 0.3 || p.cash < w.price) return false;
  if ((peek(worker, p.id)?.aff ?? 0) < -0.3 || impairment(p) >= 0.4) return false;
  return sim.rng.next() < 0.55 + 0.3 * (1 - Math.min(1, worker.cash / 100));
}
export function playerHire(sim: Simulation, worker: Character): void {
  const w = state(sim).workers.get(worker.id)!, p = sim.player;
  const place = sim.world.buildings.filter((b) => b.kind === "hotel" || b.kind === "velvet" || b.kind === "apartments").sort((a, b) => Math.hypot(a.door.x - worker.x, a.door.y - worker.y) - Math.hypot(b.door.x - worker.x, b.door.y - worker.y))[0];
  p.cash -= w.price; worker.cash += w.price; pimpCut(sim, state(sim), worker, w.price); p.emo.mood = Math.min(0.6, p.emo.mood + 0.15);
  if (place) enterBuilding(sim, worker, place, 25);
  state(sim).busy.set(worker.id, sim.tick + 60 * 90);
}

/** Paid company between consenting adults. The worker decides; the scene itself is never shown. */
function services(sim: Simulation, st: State): void {
  const h = sim.hour; if (!(h >= 20 || h < 4)) return;
  for (const [wid, w] of st.workers) {
    const worker = sim.chars[wid]; if (!worker || !free(sim, worker) || sim.tick < (st.busy.get(wid) ?? 0) || impairment(worker) > 0.3) continue;
    // a client who is on their way
    for (const [cid, p] of st.pending) {
      if (p.worker !== wid) continue;
      const client = sim.chars[cid];
      if (!client || !free(sim, client) || sim.tick > p.until) { st.pending.delete(cid); continue; }
      if (dist(client, worker) > 3) continue;
      st.pending.delete(cid); face(client, worker); client.goal = null;
      sim.say(client, "Are you available for hire?", "say", 2);
      const dislike = (peek(worker, client.id)?.aff ?? 0) < -0.3;
      const willing = !dislike && impairment(client) < 0.4 && client.cash >= w.price && sim.rng.next() < 0.55 + 0.3 * (1 - Math.min(1, worker.cash / 100));
      const place = sim.world.buildings.filter((b) => b.kind === "hotel" || b.kind === "velvet" || b.kind === "apartments").sort((a, b) => Math.hypot(a.door.x - worker.x, a.door.y - worker.y) - Math.hypot(b.door.x - worker.x, b.door.y - worker.y))[0];
      if (willing && place && Math.hypot(place.door.x - worker.x, place.door.y - worker.y) < 40) {
        sim.say(worker, "All right. Somewhere private, then.", "say", 2);
        client.cash -= w.price; worker.cash += w.price; pimpCut(sim, st, worker, w.price); client.emo.mood = Math.min(0.6, client.emo.mood + 0.15);
        enterBuilding(sim, worker, place, 25); enterBuilding(sim, client, place, 25);   // fade to black: they go indoors and time passes
        st.busy.set(wid, sim.tick + 60 * 90); st.busy.set(cid, sim.tick + 60 * 90);
      } else {
        sim.say(worker, "No. That's my answer.", "say", 2);           // a no is final; the same client is not retried for a while
        w.refused.set(cid, sim.tick); client.emo.mood = Math.max(-0.6, client.emo.mood - 0.05);
      }
      break;
    }
    // look for a new one
    if (sim.rng.next() > 0.15) continue;
    for (const c of sim.chars) {
      if (c === worker || !free(sim, c) || c.partner >= 0 || st.pending.has(c.id) || st.workers.has(c.id) || c.cash < w.price || dist(c, worker) > 14 || sim.tick < (st.busy.get(c.id) ?? 0) || sim.tick - (w.refused.get(c.id) ?? -1e9) < 60 * 600 || !c.attractedTo.includes(worker.look.kind) || c.role === "cop") continue;
      st.pending.set(c.id, { worker: wid, until: sim.tick + 60 * 20 }); forceGoal(c, sim, "follow", { u: 2, target: wid }); break;
    }
  }
}

/** Developer helpers (debug box commands): where things are, and a deal on demand. */
export function debugFind(sim: Simulation, what: "dealer" | "worker"): Character | undefined {
  const st = state(sim); const ids = what === "dealer" ? [...st.stock.keys()] : [...st.workers.keys()];
  return ids.map((i) => sim.chars[i]).filter(Boolean).sort((a, b) => dist(a, sim.player) - dist(b, sim.player))[0];
}
export function debugDeal(sim: Simulation): string {
  const d = debugFind(sim, "dealer"); if (!d) return "No dealer yet";
  const buyer = sim.chars.filter((c) => free(sim, c) && c !== d).sort((a, b) => dist(a, d) - dist(b, d))[0]; if (!buyer) return "No buyer free";
  buyer.x = d.x + 1; buyer.y = d.y; const stock = state(sim).stock.get(d.id)!; stock.units = Math.max(stock.units, 1); buyer.cash = Math.max(buyer.cash, 40);
  deal(sim, state(sim), buyer, d); return `${buyer.name} bought from ${d.name}`;
}

// ------------------------------------------------------------------ street cast (see Street.ts)
/** The pimp takes a cut of what his people earn. */
function pimpCut(sim: Simulation, st: State, worker: Character, price: number): void {
  const pid = st.pimps.get(worker.id), pimp = pid === undefined ? undefined : sim.chars[pid]; if (!pimp) return;
  const take = Math.round(price * 0.4); worker.cash -= take; pimp.cash += take; sim.say(pimp, "Good. Keep it moving.", "say", 2);
}
export function addWorker(sim: Simulation, c: Character, price = 40): void { state(sim).workers.set(c.id, { price, refused: new Map() }); }
export function addDealer(sim: Simulation, c: Character, kind: SubstanceKind = "stimulant"): void { state(sim).stock.set(c.id, { units: 8, kind, price: 20 }); }
export function setPimp(sim: Simulation, workerId: number, pimpId: number): void { state(sim).pimps.set(workerId, pimpId); }
/** Someone already deep in a habit: they will be hunting a dealer almost at once. */
export function seedHabit(sim: Simulation, c: Character, dep: number, kind: SubstanceKind = "stimulant"): void {
  const h = state(sim).habits.get(c.id) ?? { dep: 0, seen: 0, lastUse: sim.tick - 60 * 400, nextSeek: 0 };
  h.dep = Math.max(h.dep, dep); h.lastUse = Math.min(h.lastUse, sim.tick - 60 * 400); state(sim).habits.set(c.id, h);
  if (!c.substances) c.substances = { levels: { alcohol: 0, stimulant: 0, cannabis: 0, sedative: 0 }, last: kind, usedAt: 0, actionUntil: 0, updatedAt: sim.tick, crashUntil: 0, crisis: false };
}
export function dryOut(sim: Simulation, c: Character): void { const h = state(sim).habits.get(c.id); if (h) h.dep = Math.max(0, h.dep - 0.25); }
/** The pimp watches his people: if someone lays hands on one, he steps in. */
export function pimpWatch(sim: Simulation): void {
  const st = state(sim);
  for (const [wid, pid] of st.pimps) {
    const w = sim.chars[wid], pimp = sim.chars[pid]; if (!w || !pimp || !free(sim, pimp)) continue;
    if (w.lastHitBy >= 0 && w.lastHitBy !== pid && sim.tick - w.lastHitTick < 600) { const a = sim.chars[w.lastHitBy]; if (a && a.phys === Phys.OK) { sim.say(pimp, "Hey! Back off, they are with me!", "shout", 2); forceGoal(pimp, sim, "fight", { u: 2, target: a.id }); w.lastHitBy = -1; } }
  }
}
