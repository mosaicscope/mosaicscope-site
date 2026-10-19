import type { Simulation } from "./Simulation";
import { onPlayerCrime } from "./Rep";
import { Character, Phys, Toy } from "../entities/types";
import { TOYS, valueOf } from "../content/toys";
import { BUILDINGS, isOpen } from "../content/buildings";
import { applyInteraction, friendship, peek, remember } from "../social/Social";
import { carried, detach, transfer, pickUp } from "../inventory/Inventory";
import { SHOOTS, MOSAIC } from "../content/mosaicscope";
import { Building, Graffiti, T } from "../world/World";
import { forceGoal } from "../ai/brain";
import { isCareBuilding, noteEnter, careOutcome } from "../mind/Psychopathology";
import { chooseFood, onConsume, learnPlace, welcomeReward, noteGamble, chaseProbability, stakeFactor } from "../mind/Mind";
import { ARREARS_CAP, collect } from "./Arrears";

/** Traffic fines use the same cash and arrears path as the rest of the city's justice system. */
export function applyLifeFine(sim: Simulation, amount: number, reason = "Traffic fine"): string {
  const fine = Math.max(0, Math.round(amount));
  const paid = Math.min(sim.player.cash, fine);
  sim.player.cash -= paid;
  const unpaid = fine - paid;
  const councilFine = reason.startsWith("Council");
  if (unpaid) {
    if (councilFine) sim.life.systems.council.fines += unpaid;
    else {
      const debt = collect(0, sim.life.systems.budget.arrears + unpaid);
      sim.life.systems.budget.arrears = Math.min(ARREARS_CAP, debt.left);
    }
    sim.life.appointments.push({ id: sim.life.serial++, title: councilFine ? "Council fine review" : "Council traffic fine review", due: sim.tick + 24 * 3600, kind: councilFine ? "councilFine" : "citation", done: false });
  }
  return `${reason} $${fine}: $${paid} paid, $${unpaid} added to arrears.`;
}

/* =============================== economy =============================== */

export const fmtCash = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);

/** Buy an item from a shop or food truck. Price is the item's value; the till keeps the money. */
export function buy(sim: Simulation, c: Character, def: string, seller: { building?: number; poi?: number }): { ok: boolean; reason?: string; toy?: Toy } {
  const d = TOYS[def];
  if (!d) return { ok: false, reason: "That isn't for sale." };
  if (seller.building !== undefined && seller.building >= 0) {
    const b = sim.world.buildings[seller.building];
    if (b && !isOpen(BUILDINGS[b.kind], sim.hour)) return { ok: false, reason: `${b.name} is closed right now.` };
  }
  if (c.cash < d.value) return { ok: false, reason: `Not enough cash (${fmtCash(d.value)}).` };
  const t = sim.spawnToy(def, c.x, c.y);
  if (!t) return { ok: false, reason: "Out of stock." };
  const r = pickUp(c, t, sim.tick, 99);
  if (r !== "hand" && r !== "bag") { t.state = "broken"; t.x = -100; return { ok: false, reason: "Your hands and bag are full." }; }
  c.cash -= d.value;
  t.owner = c.id;
  if (seller.building !== undefined && seller.building >= 0) sim.tills[seller.building] = (sim.tills[seller.building] ?? 0) + d.value;
  sim.bus.emit("sound", { kind: "till", x: c.x, y: c.y, vol: 0.4 });
  return { ok: true, toy: t };
}

/** Eat or drink an item: restores hunger/energy, then it's gone. */
export function consume(sim: Simulation, c: Character, t: Toy): boolean {
  const f = TOYS[t.def].food;
  if (!f || t.holder !== c.id) return false;
  detach(c, t.id);
  t.state = "broken"; t.brokenAt = sim.tick; t.holder = -1; t.x = -100; t.y = -100;
  // the mind learns from the outcome (and a too-hot drink burns: Garcia one-trial aversion)
  const scalded = onConsume(sim, c, t.def, c.hunger);
  if (scalded) { sim.say(c, sim.rng.pick(["OW! Hot hot hot!", "Ahh, my tongue!", "Who made that, the sun?!"]), "shout", 1.6); }
  c.hunger = Math.min(1, c.hunger + f.hunger);
  c.needs.energy = Math.min(1, c.needs.energy + f.energy);
  c.emo.mood = Math.min(1, c.emo.mood + 0.08);
  c.anim.pose = "eat"; c.anim.poseT = 0;
  return true;
}

/** What the pawn shop pays (and how much a careful trader values something). */
export const pawnPrice = (def: string) => Math.round(valueOf(def) * 0.45);

export interface TradeOffer { items: number[]; cash: number }
export interface TradeVerdict { accept: boolean; reason: string; counterCash: number; give: number; take: number }

/**
 * Barter: an NPC weighs what they get against what they give. Things they like are worth more to
 * them, friends get a better deal, kind people are less greedy. Returns a counter-offer in cash.
 */
export function evaluateTrade(sim: Simulation, npc: Character, other: Character, offer: TradeOffer, ask: TradeOffer): TradeVerdict {
  const worth = (ids: number[], mine: boolean) => ids.reduce((s, id) => {
    const t = sim.toys[id]; if (!t) return s;
    const liked = npc.likes.includes(t.def) || (npc.prefs[t.def] ?? 0) > 0.3;
    const wear = 0.5 + 0.5 * (t.durability / t.maxDurability);
    return s + valueOf(t.def) * wear * (liked ? (mine ? 1.5 : 1.35) : 1) * (mine ? 1.1 : 1);
  }, 0);
  const take = worth(offer.items, false) + offer.cash;
  const give = worth(ask.items, true) + ask.cash;
  const f = friendship(peek(npc, other.id));
  const greed = 1.12 - npc.pers.kindness * 0.18 + (npc.role === "shopkeeper" ? 0.1 : 0);
  const need = give * greed / (1 + Math.max(-0.3, f) * 0.3);
  if (ask.cash > npc.cash) return { accept: false, reason: "I don't have that much cash on me.", counterCash: 0, give, take };
  if (offer.cash > other.cash) return { accept: false, reason: "You don't have that much cash.", counterCash: 0, give, take };
  if (take + 0.01 >= need) return { accept: true, reason: "Deal.", counterCash: 0, give, take };
  const short = Math.ceil(need - take);
  return { accept: false, reason: short > 0 ? `Add ${fmtCash(short)} and it's a deal.` : "Nah.", counterCash: short, give, take };
}

export function executeTrade(sim: Simulation, a: Character, b: Character, aGives: TradeOffer, bGives: TradeOffer): boolean {
  for (const id of aGives.items) if (sim.toys[id]?.holder !== a.id) return false;
  for (const id of bGives.items) if (sim.toys[id]?.holder !== b.id) return false;
  if (a.cash < aGives.cash || b.cash < bGives.cash) return false;
  for (const id of aGives.items) { detach(a, id); const t = sim.toys[id]; t.holder = -1; t.state = "rest"; b.bag.push(id); t.holder = b.id; t.state = "held"; t.owner = b.id; }
  for (const id of bGives.items) { detach(b, id); const t = sim.toys[id]; t.holder = -1; t.state = "rest"; a.bag.push(id); t.holder = a.id; t.state = "held"; t.owner = a.id; }
  a.cash += bGives.cash - aGives.cash; b.cash += aGives.cash - bGives.cash;
  applyInteraction(a, b, "gift", true, sim.tick, 0.4); applyInteraction(b, a, "gift", true, sim.tick, 0.4);
  const names = (ids: number[]) => ids.map((id) => TOYS[sim.toys[id].def].name).join(", ");
  sim.emit({ type: "trade", x: a.x, y: a.y, actors: [a.id, b.id], summary: `${a.name} traded ${names(aGives.items) || fmtCash(aGives.cash)} for ${b.name}'s ${names(bGives.items) || fmtCash(bGives.cash)}` });
  return true;
}

/* =============================== buildings =============================== */

/** Walk into a building: hidden from the street until `until`. */
export function enterBuilding(sim: Simulation, c: Character, b: Building, minutes: number): void {
  const gid = c.goal?.id;
  c.inside = b.id; c.insideUntil = sim.tick + Math.round(minutes * 60);
  if (isCareBuilding(b.kind)) noteEnter(sim, c, b.kind, gid);
  c.vx = c.vy = 0; c.path = null; c.goal = null;
  if (c.talkWith >= 0) sim.endConversation(c);
}

export function exitBuilding(sim: Simulation, c: Character): void {
  const b = sim.world.buildings[c.inside];
  c.inside = -1; c.insideUntil = 0;
  if (b) { const p = sim.world.nearestWalkable(b.door.x + 0.5, b.door.y + 0.5); c.x = c.px = p.x; c.y = c.py = p.y; }
  c.nextThink = sim.tick + 1;
}

/** What happens while someone is inside (resolved when they come out). */
export function insideOutcome(sim: Simulation, c: Character, b: Building): void {
  const def = BUILDINGS[b.kind];
  if (isCareBuilding(b.kind)) careOutcome(sim, c, b);
  if (def.menu && c.hunger < 0.6) {
    const food = def.menu.filter((m) => TOYS[m].category === "food" && TOYS[m].value <= c.cash);
    if (food.length) {
      // choose by learned taste, current aversions and curiosity (mind/Learning.ts), not at random
      const r = buy(sim, c, chooseFood(sim, c, food), { building: b.id });
      if (r.ok && r.toy) {
        const burns = c.mind.scalds;
        const before = c.mind.v["item:" + r.toy.def] ?? 0;
        consume(sim, c, r.toy);
        const outcome = (c.mind.v["item:" + r.toy.def] ?? 0) - before;
        learnPlace(sim, c, b.kind, b.id, b.name, outcome * 2.5 + welcomeReward(sim, c, b.id) - (c.mind.scalds > burns ? 0.3 : 0));
      }
    }
  }
  if (b.kind === "casino") gambleOffscreen(sim, c);
  if (b.kind === "pawn") fenceGoods(sim, c);
  if (c.workplace === b.id) c.cash += sim.wagePerHour(c) * Math.max(0.25, (c.insideUntil - sim.tick + 1) / 3600 + 1);
  if (b.kind === "house" || b.kind === "apartments") { c.needs.energy = 1; c.hunger = Math.max(c.hunger, 0.7); }
}

/** NPC casino visits use the real game odds: blackjack ~0.5% edge, roulette 2.7%, pokies ~6%. */
function gambleOffscreen(sim: Simulation, c: Character): void {
  const start = c.cash;
  let stake = Math.min(c.cash, Math.max(5, Math.round(c.cash * sim.rng.range(0.1, 0.5) * stakeFactor(c))));
  if (stake <= 0) return;
  const stake0 = stake;
  const game = sim.rng.pick(["blackjack", "roulette", "pokies"]);
  const edge = game === "blackjack" ? 0.005 : game === "roulette" ? 0.027 : 0.06;
  const swing = game === "pokies" ? 1.6 : 1;
  // up to four rounds: after each result prospect theory + personality decide whether to chase or walk away
  let net = 0;
  for (let round = 0; round < 4 && stake > 0; round++) {
    const result = Math.round(stake * (sim.rng.gauss() * 0.6 * swing - edge * 6));
    c.cash = Math.max(0, c.cash + result);
    net += result;
    c.emo.mood = Math.max(-1, Math.min(1, c.emo.mood + Math.sign(result) * 0.25));
    if (result < 0) c.emo.frustration = Math.min(1, c.emo.frustration + Math.min(0.4, -result / 200));
    if (c.cash < 5 || !sim.rng.chance(chaseProbability(c, net, stake0))) break;
    // chasing: bet bigger to get back to even; the cautious keep it flat
    stake = Math.min(c.cash, Math.round(stake * (net < 0 ? 1.3 : 1)));
  }
  noteGamble(sim, c, c.cash - start, stake0);
  if (Math.abs(net) > 60) sim.emit({ type: "casino", x: c.x, y: c.y, actors: [c.id], data: { amount: net, game }, summary: net > 0 ? `${c.name} won ${fmtCash(net)} at ${game}` : `${c.name} lost ${fmtCash(-net)} at ${game}` });
}

/** Sell stolen or unwanted valuables at the pawn shop. */
function fenceGoods(sim: Simulation, c: Character): void {
  for (const id of carried(c)) {
    const t = sim.toys[id];
    if (!t || TOYS[t.def].category !== "valuable" || t.owner === c.id && c.role !== "thief") continue;
    detach(c, id); t.state = "broken"; t.x = -100; t.holder = -1;
    c.cash += pawnPrice(t.def);
  }
}

/* =============================== crime & police =============================== */

export type CrimeType = "pickpocket" | "snatch" | "shoplift" | "assault" | "vandalism" | "car_theft" | "hit_and_run" | "armed_robbery" | "stabbing" | "gunfire";
export const CRIME_STARS: Record<CrimeType, number> = { pickpocket: 1, snatch: 1, shoplift: 1, assault: 1, vandalism: 1, car_theft: 2, hit_and_run: 2, armed_robbery: 3, stabbing: 3, gunfire: 3 };
export const CRIME_LABEL: Record<CrimeType, string> = { pickpocket: "pickpocketing", snatch: "a snatch-and-run", shoplift: "shoplifting", assault: "assault", vandalism: "tagging", car_theft: "car theft", hit_and_run: "a hit and run", armed_robbery: "an armed robbery", stabbing: "a stabbing", gunfire: "shots fired" };

export interface Crime { id: number; type: CrimeType; perp: number; victim: number; x: number; y: number; tick: number; reported: boolean; solved: boolean; witnesses: number[]; item: string | null }

const tmp: number[] = [];

/** Record a crime; anyone who can see it may shout and call it in. Returns whether it was noticed. */
export function commitCrime(sim: Simulation, perp: Character, type: CrimeType, victim: Character | null, item: string | null = null): boolean {
  const crime: Crime = { id: sim.crimes.length + 1, type, perp: perp.id, victim: victim?.id ?? -1, x: perp.x, y: perp.y, tick: sim.tick, reported: false, solved: false, witnesses: [], item };
  sim.crimes.push(crime);
  if (sim.crimes.length > 200) sim.crimes.splice(0, sim.crimes.length - 200);
  const n = sim.charHash.query(perp.x, perp.y, 9, tmp);
  for (let i = 0; i < n; i++) {
    const w = sim.chars[tmp[i]];
    if (w === perp || w.inside >= 0 || w.inCar >= 0 || w.tier === "player" && w.id !== crime.victim) continue;
    const d = Math.hypot(w.x - perp.x, w.y - perp.y);
    const isVictim = w.id === crime.victim;
    // victims of quiet crimes don't always notice; watchful people notice more
    const p = isVictim ? (type === "pickpocket" ? 0.35 + w.pers.curiosity * 0.35 : 0.95) : (w.tier === "background" ? 0.25 : 0.55 + w.pers.curiosity * 0.3) * (1 - d / 10);
    if (!sim.world.lineOfSight(w.x, w.y, perp.x, perp.y) || !sim.rng.chance(p)) continue;
    crime.witnesses.push(w.id);
    remember(w, { t: sim.tick, kind: "saw_crime", subj: perp.id, obj: crime.victim, toy: item, area: sim.world.areaAt(perp.x, perp.y)?.id ?? 0, val: -0.6, ev: -1, src: isVictim ? "did" : "saw" });
    const r = sim.relate(w, perp.id); r.trust = Math.max(-1, r.trust - 0.3); r.grudge = Math.min(1, r.grudge + (isVictim ? 0.5 : 0.1));
  }
  const noticed = crime.witnesses.length > 0;
  if (perp.tier === "player") onPlayerCrime(sim, perp, type, victim, noticed);
  const label = CRIME_LABEL[type];
  const ev = sim.emit({ type: "crime", x: perp.x, y: perp.y, actors: victim ? [perp.id, victim.id] : [perp.id], toy: item, priority: noticed ? 7 : 2, severity: noticed ? 3 : 1, data: { crime: crime.id, kind: type, noticed: noticed ? 1 : 0 },
    summary: noticed ? `${perp.name} was seen ${type === "vandalism" ? "tagging a wall" : type === "gunfire" ? "firing a gun" : "committing " + label}${victim ? ` (victim: ${victim.name})` : ""}` : `Unseen ${label}${victim ? ` on ${victim.name}` : ""}` });
  if (noticed) {
    const shouter = sim.chars[crime.witnesses[0]];
    if (shouter && shouter.tier !== "player") sim.say(shouter, sim.dialogue.bark(shouter, type === "vandalism" ? "vandal_shout" : "thief_shout", perp), "shout", 2);
    reportCrime(sim, crime, ev?.id ?? -1);
    if (perp.tier === "player") { perp.wanted = Math.min(5, perp.wanted + CRIME_STARS[type]); sim.lastSeenByCops = sim.tick; }
    else if (perp.role === "thief" || perp.role === "graffiti") { perp.emo.fear = Math.min(1, perp.emo.fear + 0.3); sim.afterConversation(() => forceGoal(perp, sim, "escape", { u: 1, target: -1 })); }
  }
  return noticed;
}

/** Send the nearest free officer after the suspect. */
export function reportCrime(sim: Simulation, crime: Crime, ev: number): void {
  if (crime.reported) return;
  crime.reported = true;
  const perp = sim.chars[crime.perp];
  let best: Character | null = null, bd = Infinity;
  for (const c of sim.chars) {
    if (c.role !== "cop" || c.pursuing >= 0 || c.jailUntil > 0 || c.phys !== Phys.OK) continue;
    const d = Math.hypot(c.x - perp.x, c.y - perp.y) + (c.inside >= 0 ? 20 : 0);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  best.pursuing = perp.id;
  if (best.inside >= 0) exitBuilding(sim, best);
  if (best.inCar >= 0) { const v = sim.vehicles[best.inCar]; if (v) v.siren = true; }
  else sim.afterConversation(() => forceGoal(best!, sim, "pursue", { u: 1, target: perp.id }));
  sim.emit({ type: "police", x: perp.x, y: perp.y, actors: [best.id, perp.id], data: { crime: crime.id, ev }, summary: `Officer ${best.name.split(" ")[0]} is responding to ${CRIME_LABEL[crime.type]}` });
}

/** Cuff someone: they're escorted to the station and held for a while. */
export function arrest(sim: Simulation, cop: Character, s: Character): void {
  cop.pursuing = -1;
  s.arrestedBy = cop.id; s.goal = null; s.vx = s.vy = 0;
  if (s.talkWith >= 0) sim.endConversation(s);
  s.emo.fear = 0.5;
  // stolen property goes back to its owners
  let returned = 0;
  for (const id of carried(s)) {
    const t = sim.toys[id];
    if (t && t.owner >= 0 && t.owner !== s.id && sim.chars[t.owner]) { const o = sim.chars[t.owner]; if (transfer(s, o, t, false)) returned++; }
  }
  for (const cr of sim.crimes) if (cr.perp === s.id && !cr.solved) cr.solved = true;
  sim.say(cop, sim.dialogue.bark(cop, "arrest", s), "shout", 2);
  sim.emit({ type: "arrest", x: s.x, y: s.y, actors: [cop.id, s.id], summary: `${cop.name} arrested ${s.name}${s.nickname ? ` ("${s.nickname}")` : ""}${returned ? `; ${returned} stolen item${returned > 1 ? "s" : ""} returned` : ""}` });
  if (s.tier === "player") sim.busted(cop);
}

/** Escort + custody bookkeeping, called each AI tick for affected people. */
export function updateCustody(sim: Simulation, s: Character): boolean {
  if (s.jailUntil > 0) {
    if (sim.tick >= s.jailUntil && s.inside < 0) { s.jailUntil = 0; return false; }
    return true;
  }
  if (s.arrestedBy < 0) return false;
  const cop = sim.chars[s.arrestedBy];
  const station = sim.world.buildings.find((b) => b.kind === "police");
  if (!cop || !station) { s.arrestedBy = -1; return false; }
  // walk behind the officer
  const dx = cop.x - s.x, dy = cop.y - s.y, d = Math.hypot(dx, dy);
  if (d > 0.9) { s.vx = (dx / d) * cop.speed * 1.1; s.vy = (dy / d) * cop.speed * 1.1; } else { s.vx = s.vy = 0; }
  s.anim.pose = "cuffed";
  if (Math.hypot(station.door.x + 0.5 - s.x, station.door.y + 0.5 - s.y) < 1.4) {
    s.arrestedBy = -1;
    s.jailUntil = sim.tick + 60 * 60 * 2; // two game hours in the cells
    s.cash = Math.max(0, s.cash - 50);
    s.wanted = 0;
    enterBuilding(sim, s, station, 120);
    s.jailUntil = s.insideUntil;
    cop.goal = null;
  }
  return true;
}

/* =============================== graffiti =============================== */

const TAGS = ["MOSAIC", "CHCH", "KIA KAHA", "ŌTAUTAHI", "SMOKEY", "ZAP", "OKE", "NO SLEEP", "ART IS LIFE", "SKRRT", "FLASH WAS HERE", "MSCOPE", "AFTER HOURS", "DUB", "KAPOW"];

/** Find a wall face next to a walkable tile, near (x, y), visible from the camera side. */
export function findWall(sim: Simulation, x: number, y: number, r = 10, legalOnly = false): { tx: number; ty: number; face: "s" | "e"; sx: number; sy: number; legal: boolean } | null {
  const w = sim.world;
  let best = null, bd = Infinity;
  for (let ty = Math.max(1, Math.floor(y - r)); ty < Math.min(w.size - 1, y + r); ty++) for (let tx = Math.max(1, Math.floor(x - r)); tx < Math.min(w.size - 1, x + r); tx++) {
    const t = w.tile(tx, ty);
    if (t !== T.BUILDING && t !== T.WALL) continue;
    const legal = t === T.WALL && w.areaAt(tx + 0.5, ty + 0.5)?.kind === "alley";
    if (legalOnly && !legal) continue;
    const b = w.buildingAt(tx, ty);
    if (b && (b.kind === "police" || b.kind === "studio")) continue;
    for (const face of ["s", "e"] as const) {
      const nx = face === "e" ? tx + 1 : tx, ny = face === "s" ? ty + 1 : ty;
      if (!w.walkableTile(nx, ny)) continue;
      if (w.graffiti.some((g) => g.tx === tx && g.ty === ty && g.face === face)) continue;
      const d = Math.hypot(nx - x, ny - y) + sim.rng.next() * 3;
      if (d < bd) { bd = d; best = { tx, ty, face, sx: nx + 0.5, sy: ny + 0.5, legal }; }
    }
  }
  return best;
}

export function paint(sim: Simulation, c: Character, spot: { tx: number; ty: number; face: "s" | "e"; legal: boolean }): Graffiti {
  const g: Graffiti = { id: (sim.world.graffiti[sim.world.graffiti.length - 1]?.id ?? 0) + 1, tx: spot.tx, ty: spot.ty, face: spot.face, text: c.nickname ? c.nickname.toUpperCase() : sim.rng.pick(TAGS), color: c.look.color, artist: c.id, tick: sim.tick, legal: spot.legal, style: sim.rng.int(0, 3) };
  sim.world.graffiti.push(g);
  if (sim.world.graffiti.length > 120) sim.world.graffiti.shift();
  sim.emit({ type: spot.legal ? "mural" : "graffiti", x: c.x, y: c.y, actors: [c.id], summary: spot.legal ? `${c.name} painted a mural ("${g.text}") on the wall of fame` : `"${g.text}" got tagged on ${sim.world.buildingAt(spot.tx, spot.ty)?.name ?? "a wall"}` });
  return g;
}

/* =============================== MosaicScope business =============================== */

export interface Booking { id: number; client: number; shoot: string; label: string; price: number; place: string; at: number; photographer: number; done: boolean; shotAt: number }

/** An NPC books a shoot with MosaicScope (real price list). */
export function book(sim: Simulation, c: Character): Booking | null {
  const opts = SHOOTS.filter((s) => s.who.includes(c.role) && s.price <= c.cash);
  if (!opts.length || sim.bookings.some((b) => !b.done && b.client === c.id)) return null;
  if (sim.bookings.filter((b) => !b.done).length >= 4) return null; // diary's full this evening
  const s = sim.rng.pick(opts);
  const chris = sim.chars.find((x) => x.name === "Chris"), kodak = sim.chars.find((x) => x.name === "Kodak");
  const photographer = sim.rng.chance(0.7) && chris ? chris : kodak ?? chris;
  if (!photographer) return null;
  c.cash -= s.price; photographer.cash += s.price;
  // the photographer's diary: one shoot at a time, at least 20 game minutes apart
  const last = sim.bookings.filter((x) => x.photographer === photographer.id && !x.done).reduce((m, x) => Math.max(m, x.at), 0);
  const at = Math.max(sim.tick + 60 * 20, last + 60 * 25);
  const b: Booking = { id: sim.bookings.length + 1, client: c.id, shoot: s.id, label: s.label, price: s.price, place: s.place, at, photographer: photographer.id, done: false, shotAt: 0 };
  sim.bookings.push(b);
  if (sim.bookings.length > 60) sim.bookings.splice(0, sim.bookings.length - 60);
  sim.emit({ type: "booking", x: c.x, y: c.y, actors: [c.id, photographer.id], data: { price: s.price }, summary: `${c.name} booked ${s.label} with MosaicScope (${fmtCash(s.price)})` });
  applyInteraction(c, photographer, "talk", true, sim.tick, 2);
  return b;
}

export const shootArea = (sim: Simulation, place: string) => sim.world.areas.find((a) => a.kind === place) ?? sim.world.areas.find((a) => a.kind === "studio")!;

export { MOSAIC };
