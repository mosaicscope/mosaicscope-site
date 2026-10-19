import type { Simulation } from "./Simulation";
import { UPGRADES, hasUpgrade, upgradeCost } from "../content/upgrades";
import { carried, detach } from "../inventory/Inventory";
import { bandage } from "./Life";
import { commitCrime, findWall, paint } from "./Society";
import { Phys } from "../entities/types";

const HOUR = 3600, DAY = HOUR * 24;
const cap = (n: number) => Math.max(0, Math.min(1, n));
export function ledger(sim: Simulation, label: string, amount: number): void {
  const u = sim.life.upgrades;
  u.ledger.push({ tick: sim.tick, label, amount: Math.round(amount * 100) / 100 });
  if (u.ledger.length > 100) u.ledger.shift();
}
function money(sim: Simulation, label: string, amount: number): void {
  sim.player.cash = Math.round((sim.player.cash + amount) * 100) / 100;
  ledger(sim, label, amount);
}
export function purchaseUpgrade(sim: Simulation, id: string): string {
  const u = sim.life.upgrades, item = UPGRADES.find(i => i.id === id);
  if (!item) return "Choose an available upgrade.";
  if (hasUpgrade(u, id) && (id !== "film" || u.film > 0)) return "Already owned.";
  const cost = upgradeCost(u, item.cost);
  if (!Number.isFinite(sim.player.cash) || sim.player.cash < cost) return `You need $${cost}.`;
  if (id === "renovation" && !sim.life.businesses.length) return "Own a town business before renovating.";
  // Commissioning requires a free legal wall; never charge for an unavailable world change.
  const wall = id === "streetart" ? findWall(sim, sim.player.x, sim.player.y, sim.world.size, true) : null;
  if (id === "streetart" && !wall) return "No free commissioned wall is available yet.";
  money(sim, item.name, -cost);
  if (!hasUpgrade(u, id)) u.owned.push(id);
  if (id === "film") u.film += 10;
  if (id === "bando") u.pet = { x: sim.player.x, y: sim.player.y };
  if (wall) { const art = paint(sim, sim.player, wall); art.text = "THE MOSAICS"; art.legal = true; }
  if (["community", "fountain", "rooftop"].includes(id)) {
    const a = sim.world.areas.find(a => a.kind === (id === "community" ? "park" : "plaza"));
    if (a) sim.life.markers.push({ x: a.cx, y: a.cy, name: item.name, icon: id === "community" ? "✿" : id === "fountain" ? "≈" : "▲" });
  }
  return `${item.name} unlocked. ${item.effect}`;
}

/** Called once per simulated hour; all world randomness uses the saved seeded RNG. */
export function tickUpgrades(sim: Simulation): void {
  const u = sim.life.upgrades, p = sim.player, day = Math.floor(sim.tick / DAY);
  const own = (id: string) => hasUpgrade(u, id);
  if (!u.owned.length && !u.crew.length) { u.lastDay = day; return; }
  u.crew = u.crew.filter(id => id !== p.id && !!sim.chars[id]);
  const crew = u.crew.map(id => sim.chars[id]);
  for (const c of crew) {
    if (own("medic")) { bandage(sim, p, c); c.blood = cap(c.blood + 0.08); }
    if (own("streetwear")) { c.look.color = p.look.color; c.dirty = true; }
    if (own("hideout") && c.inside === p.home) {
      c.needs.energy = cap(c.needs.energy + 0.15); c.hunger = cap(c.hunger + 0.15); c.needs.fun = cap(c.needs.fun + 0.2);
    }
  }
  if (own("titles")) {
    const earned = [p.stats.throws >= 20 ? "The Firestarter" : "", p.reputation >= 10 ? "Community Legend" : "", crew.length >= 3 ? "Crew Captain" : ""];
    for (const title of earned) if (title && !u.titles.includes(title)) {
      u.titles.push(title); sim.toasts.push({ tick: sim.tick, kind: "acid", text: `Title earned: ${title}` });
    }
  }
  if (own("lookout") && p.wanted && sim.chars.some(c => c.role === "cop" && c.inside < 0 && Math.hypot(c.x - p.x, c.y - p.y) < 15))
    sim.toasts.push({ tick: sim.tick, kind: "red", text: "Lookout: police nearby. Find cover!" });
  if (own("streetwear")) for (const c of sim.chars) {
    if (c.id !== p.id && c.crew && c.crew !== p.crew && Math.hypot(c.x - p.x, c.y - p.y) < 4) c.emo.fear = cap(c.emo.fear + 0.08);
  }
  if (sim.env.party && (own("stereo") || own("discoball") || own("lux"))) p.emo.mood = Math.min(1, p.emo.mood + 0.06);
  if (u.lastDay === day) return;
  u.lastDay = day;
  if (own("stocks")) u.market = sim.rng.next() - 0.5;
  const previousDays = day > 0;
  if (!previousDays) return;
  if (own("foodtruck")) money(sim, "Food truck sales", 45 + (own("cooking") ? 20 : 0) + (own("stall") ? 15 : 0));
  if (own("stall")) money(sim, "Licensed street stall", 18);
  if (own("rooftop")) money(sim, "Rooftop bar sales", 65);
  if (own("bonds") && sim.life.savings > 0) {
    const interest = Math.round(sim.life.savings * 0.001 * 100) / 100;
    sim.life.savings += interest; ledger(sim, "Bond interest (savings)", interest);
  }
  if (own("accounting")) {
    const refund = Math.max(0, Math.round(u.taxClaimed * 0.1 * 100) / 100);
    u.taxClaimed = 0;
    if (refund) money(sim, "Tax reconciliation", refund);
  }
  if (u.debt > 0) { u.debt = Math.round(u.debt * 1.01 * 100) / 100; ledger(sim, "Credit interest added to debt", -Math.round(u.debt / 101 * 100) / 100); }
  if (crew.length) {
    const income = crew.reduce((sum, c) => sum + 5 * (own("loyalty") ? 1 + Math.max(0, sim.relate(c, p.id).trust) : 1), 0);
    money(sim, "Crew work", Math.round(income));
  }
  if (own("community")) p.reputation += 0.2;
  if (own("fountain")) p.emo.mood = Math.min(1, p.emo.mood + 0.03);
  const home = sim.world.buildings[p.home];
  if (home && u.owned.some(id => UPGRADES.find(item => item.id === id)?.group === "Home")) {
    if (own("balcony")) p.emo.mood = Math.min(1, p.emo.mood + 0.1);
    if (Math.floor(day / 7) % 4 === 3 && !own("heater")) p.needs.energy = cap(p.needs.energy - 0.04);
    if (sim.env.raining && !own("dehumidifier") && sim.rng.chance(0.15)) {
      p.emo.mood = Math.max(-1, p.emo.mood - 0.15);
      sim.toasts.push({ tick: sim.tick, kind: "", text: "Damp weather brought mould home. A dehumidifier prevents it." });
    }
    if (sim.rng.chance(0.08 * (own("deadbolt") ? 0.25 : 1) * (own("watch") ? 0.4 : 1))) {
      const loss = Math.min(p.cash, 25);
      money(sim, "Home burglary", -loss);
      if (own("camera")) u.evidence++;
      sim.toasts.push({ tick: sim.tick, kind: "red", text: `Break-in: lost $${loss}.${own("camera") ? " Your camera recorded evidence." : " Deadbolts reduce the risk."}` });
    }
  }
  if (!own("parking") && sim.vehicles.some(v => v.owner === p.id && v.state === "parked") && sim.rng.chance(0.12))
    money(sim, "Parking fine", -Math.min(p.cash, 15));
}

export function upgradeActivity(sim: Simulation, key: string, arg = ""): string {
  const u = sim.life.upgrades, p = sim.player, own = (id: string) => hasUpgrade(u, id);
  const require = (id: string) => own(id) ? "" : `Unlock ${UPGRADES.find(i => i.id === id)?.name ?? id} first.`;
  const cooldown = (id: string, period = HOUR) => {
    if (sim.tick - (u.last[id] ?? -period) < period) return false;
    u.last[id] = sim.tick; return true;
  };
  const members = () => u.crew.map(id => sim.chars[id]).filter(Boolean);
  if (p.arrestedBy >= 0 || p.jailUntil > sim.tick) return "Finish your time in custody before doing crew activities.";
  if (key === "recruit") {
    const c = sim.chars[Number(arg)];
    if (!c || c.id === p.id || c.tier === "background" || u.crew.includes(c.id) || u.crew.length >= 8) return "Choose a new member; crew limit eight.";
    if (Math.hypot(c.x - p.x, c.y - p.y) > 8) return "Meet this person in town before recruiting them.";
    const r = sim.relate(c, p.id);
    if (r.trust < 0) return "Make peace with this person first.";
    u.crew.push(c.id); r.trust = Math.min(1, r.trust + 0.15); return `${c.name} joined your crew.`;
  }
  if (key === "dismiss") { u.crew = u.crew.filter(id => id !== Number(arg)); return "Crew roster updated."; }
  if (key === "restcrew") {
    if (require("hideout")) return require("hideout");
    const home = sim.world.buildings[p.home];
    if (!home || !u.crew.length) return "Rent a home and recruit a crew first.";
    if (!cooldown(key)) return "The crew can rest again in an hour.";
    for (const c of members()) {
      if (c.inCar >= 0 || c.arrestedBy >= 0 || c.jailUntil > sim.tick) continue;
      c.inside = home.id; c.insideUntil = sim.tick + HOUR; c.goal = null;
      c.needs.energy = cap(c.needs.energy + 0.2); c.hunger = cap(c.hunger + 0.2); c.needs.fun = cap(c.needs.fun + 0.25);
    }
    return "The crew settled into the hideout: food, darts and a proper rest.";
  }
  if (key === "backup") {
    if (require("radio")) return require("radio");
    if (!u.crew.length || !cooldown(key)) return "Recruit someone first; radio cooldown is one hour.";
    for (const c of members()) {
      if (c.inCar >= 0 || c.arrestedBy >= 0 || c.inside >= 0) continue;
      c.goal = { id: "follow", target: p.id, plan: [{ kind: "follow", target: p.id, time: 60 }], stepIdx: 0, stepTimer: 0, started: sim.tick, replans: 0 };
    }
    return "Available crew members are heading your way.";
  }
  if (key === "trip" || key === "getaway") {
    const id = key === "trip" ? "van" : "driver";
    if (require(id)) return require(id);
    if (p.inCar >= 0 || p.arrestedBy >= 0 || p.jailUntil > sim.tick || p.phys !== Phys.OK) return "Leave your vehicle or custody before arranging a trip.";
    const b = sim.world.buildings[key === "trip" ? Number(arg) : p.home];
    if (!b) return "Choose a valid destination or rent a home first.";
    if (key === "getaway" && p.cash < 25) return "Driver fare is $25.";
    if (!cooldown(key)) return "Your next trip is available in one game hour.";
    if (key === "getaway") money(sim, "Getaway fare", -25);
    const pt = sim.world.nearestWalkable(b.door.x, b.door.y);
    for (const c of [p, ...(key === "trip" ? members() : [])]) {
      if (c.inCar >= 0 || c.arrestedBy >= 0 || c.jailUntil > sim.tick) continue;
      c.x = c.px = pt.x; c.y = c.py = pt.y; c.vx = c.vy = 0; c.inside = -1; c.goal = null;
    }
    sim.rebuildHash(); return `Arrived at ${b.name}. Wanted level remains ${p.wanted}.`;
  }
  if (key === "store" || key === "retrieve") {
    if (require("stash")) return require("stash");
    if (key === "store") {
      const ids = carried(p);
      if (!ids.length) return "You have no toys to store.";
      for (const id of ids) { const t = sim.toys[id]; if (!t) continue; detach(p, id); t.state = "held"; t.holder = -1; t.x = t.y = -100; u.stash.push(id); }
      return `${ids.length} toy(s) stored safely.`;
    }
    let count = 0;
    for (const id of [...u.stash]) {
      const t = sim.toys[id]; if (!t) { u.stash = u.stash.filter(i => i !== id); continue; }
      if (p.hand >= 0 && p.bag.length >= p.bagMax) break;
      t.holder = p.id; t.state = "held"; t.x = p.x; t.y = p.y;
      if (p.hand < 0) p.hand = id; else p.bag.push(id);
      u.stash = u.stash.filter(i => i !== id); count++;
    }
    return count ? `Retrieved ${count} toy(s).` : "Your bag is full or the stash is empty.";
  }
  if (key === "handshake") {
    if (require(key)) return require(key);
    if (!u.crew.length || !cooldown(key)) return "Recruit a member; try again after one game hour.";
    for (const c of members()) { const r = sim.relate(c, p.id); r.trust = Math.min(1, r.trust + 0.1); }
    return "Two taps, a feather, then a nod. ‘The Pukeko flies at midnight. Meet us behind the record shop.’";
  }
  if (key === "visitor") {
    if (require("doorbell")) return require("doorbell");
    const b = sim.world.buildings[p.home]; if (!b) return "Rent a home first.";
    const c = sim.chars.find(c => c.id !== p.id && c.inside < 0 && Math.hypot(c.x - b.door.x, c.y - b.door.y) < 5);
    return c ? `Doorbell live: ${c.name} is outside.` : "Doorbell live: nobody at the door.";
  }
  if (key === "breakfast") {
    if (require("toaster")) return require("toaster");
    if (!cooldown(key, DAY)) return "Breakfast is available once each day.";
    p.hunger = cap(p.hunger + 0.3); sim.life.systems.diet.hunger = p.hunger; p.needs.energy = cap(p.needs.energy + 0.15); return "Toast ready. Hunger and energy restored.";
  }
  if (key === "borrow" || key === "repay") {
    if (require("credit")) return require("credit");
    const amount = key === "borrow" ? Math.min(100, Math.max(0, 300 - u.debt)) : Math.min(100, u.debt, p.cash);
    if (!amount) return "Credit limit reached, or no affordable repayment is due.";
    u.debt = Math.round((u.debt + (key === "borrow" ? amount : -amount)) * 100) / 100;
    money(sim, key === "borrow" ? "Pawn credit drawn" : "Pawn credit repaid", key === "borrow" ? amount : -amount);
    return `Credit balance $${u.debt.toFixed(2)}. Interest is 1% per day.`;
  }
  if (key === "bike") { if (require("ruby")) return require("ruby"); u.bike = !u.bike; return u.bike ? "Ruby’s bike ready. Faster travel on foot." : "Bike parked."; }
  if (key === "lights") { if (require("stringlights")) return require("stringlights"); if (["warm", "festival", "neon"].includes(arg)) u.lights = arg as typeof u.lights; return `String lights: ${u.lights}.`; }
  if (key === "streetlight") { if (require("streetlights")) return require("streetlights"); if (arg === "retro" || arg === "neon") u.streetlight = arg; return `Streetlights: ${u.streetlight}.`; }
  if (key === "outfit") {
    if (!own("cosmetics") && !own("glitter")) return "Visit Glitter’s boutique or unlock cosmetics first.";
    const colours = ["#71dfb1", "#ff7aaa", "#79bfff", "#f4c86a"];
    p.look.color = colours[(colours.indexOf(p.look.color) + 1) % colours.length];
    const hats = ["cap", "beanie", "bucket", "none"] as const;
    p.look.hat = hats[(hats.indexOf(p.look.hat as typeof hats[number]) + 1) % hats.length];
    if (own("glitter")) for (const c of members()) { c.look.color = p.look.color; c.dirty = true; }
    return "New outfit equipped.";
  }
  if (key === "heal") {
    if (require("honey")) return require("honey");
    if (!cooldown(key, DAY)) return "Healing plants grow back tomorrow.";
    bandage(sim, p, p); p.blood = cap(p.blood + 0.15); sim.life.systems.injury.sprain = Math.max(0, sim.life.systems.injury.sprain - 0.15); return "Honey’s healing plants soothed your injuries.";
  }
  if (key === "pet") { if (require("bando")) return require("bando"); u.pet = { x: p.x, y: p.y }; p.emo.mood = Math.min(1, p.emo.mood + 0.05); return "Bando’s dog comes running."; }
  if (key === "graffiti" || key === "cleanup") {
    const wall = key === "graffiti" ? findWall(sim, p.x, p.y, 5) : null;
    const tag = key === "cleanup" ? sim.world.graffiti.find(g => Math.hypot(g.tx - p.x, g.ty - p.y) < 5) : null;
    if (key === "graffiti" && !wall || key === "cleanup" && !tag) return "Find an available wall or tag nearby.";
    const cost = key === "graffiti" ? 5 : own("stencil") ? 5 : 10;
    if (p.cash < cost) return `Supplies cost $${cost}.`;
    if (!cooldown(key)) return "Give the paint an hour to dry.";
    money(sim, key === "graffiti" ? "Paint supplies" : "Graffiti cleanup", -cost);
    if (wall) { paint(sim, p, wall); if (!wall.legal) commitCrime(sim, p, "vandalism", null); }
    if (tag) sim.world.graffiti = sim.world.graffiti.filter(g => g.id !== tag.id);
    return key === "graffiti" ? "Your mark is on the city. Uncommissioned tags can be reported." : "The wall is clean again.";
  }
  if (key === "lockpick") {
    if (require("lockpicks")) return require("lockpicks");
    const car = sim.vehicles.find(v => v.driver < 0 && Math.hypot(v.x - p.x, v.y - p.y) < 3);
    const door = sim.world.buildings.find(b => b.kind !== "police" && Math.hypot(b.door.x - p.x, b.door.y - p.y) < 3);
    if (!car && !door) return "Stand beside an empty car or a door.";
    if (!cooldown(key)) return "Try another lock in one game hour.";
    commitCrime(sim, p, car ? "car_theft" : "shoplift", null);
    if (car) { money(sim, "Car boot find", 12 + sim.rng.int(0, 20)); return "Boot opened: found loose change. Witnesses can report the theft."; }
    p.inside = door!.id; p.insideUntil = sim.tick + 60 * 15; return `Picked the door to ${door!.name}. You will emerge shortly.`;
  }
  const activity: Record<string, { id?: string; pay: number; period?: number }> = {
    busk: { pay: own("busker") ? 18 : 10 }, photo: { pay: own("photography") ? 35 : 20 },
    dance: { pay: 0 }, chess: { pay: 0 }, sidehustle: { id: "secondphone", pay: 45, period: HOUR * 3 },
    vip: { id: "vip", pay: 0 }, nightout: { id: "flash", pay: 0 }, tiles: { id: "tiles", pay: 0 },
    crewphoto: { id: "kodak", pay: 0 }, stocks: { id: "stocks", pay: 0, period: DAY },
  };
  const a = activity[key];
  if (!a) return "Choose an available activity.";
  if (a.id && require(a.id)) return require(a.id);
  if (key === "photo" && !u.film) return "Buy a Polaroid film pack for photo commissions.";
  if ((key === "crewphoto" || key === "tiles") && !u.crew.length) return "Recruit a crew member first.";
  if (key === "stocks" && p.cash < 50 || key === "chess" && p.cash < 5) return "You need the entry stake first.";
  if (!cooldown(key, a.period)) return "This activity is cooling down. Try again later.";
  if (key === "stocks") {
    const gain = Math.round(50 * (u.market + (sim.rng.next() - 0.5) * 0.3));
    money(sim, "Stock position settled", gain); return `Your $50 position returned $${50 + gain}. Research signals are uncertain.`;
  }
  if (key === "chess") {
    const win = sim.rng.chance(own("chess") ? 0.7 : 0.4); money(sim, "Park chess tournament", win ? 15 : -5);
    return win ? "Your opening paid off. Tournament prize: $20 including your $5 entry." : "Outplayed this time. Entry cost $5.";
  }
  if (a.pay) money(sim, key, a.pay);
  if (key === "photo") u.film--;
  if (key === "crewphoto") {
    for (const [index, c] of members().entries()) {
      if (c.inCar >= 0 || c.arrestedBy >= 0 || c.jailUntil > sim.tick) continue;
      const pt = sim.world.nearestWalkable(p.x + (index % 4) * 0.9 - 1.5, p.y + 1 + Math.floor(index / 4));
      c.x = c.px = pt.x; c.y = c.py = pt.y; c.inside = -1; c.anim.pose = "pose"; c.goal = null; c.nextThink = sim.tick + 60 * 15;
    }
    sim.rebuildHash();
  }
  if (["tiles", "dance", "nightout", "vip"].includes(key)) {
    p.anim.pose = "dance"; p.anim.poseT = 0;
    if (key === "tiles") p.style = "tiles";
    if (key !== "dance") { sim.env.party = true; sim.env.partyUntil = sim.tick + HOUR; }
    p.reputation += own("dance") ? 2 : 1;
    for (const c of members()) { c.anim.pose = "dance"; c.anim.poseT = 0; }
  }
  if (["tiles", "crewphoto", "nightout"].includes(key)) u.album++;
  p.emo.mood = Math.min(1, p.emo.mood + 0.08);
  return `${key === "crewphoto" ? "Crew portrait arranged. Open Photo to capture the group" : key === "tiles" ? "Tiles’s signature dance: stomp, shuffle, feather turn" : key + " complete"}.${a.pay ? ` Earned $${a.pay}.` : ""}${own("album") && u.album >= 3 ? " Crew album track unlocked in the dashboard." : ""}`;
}
