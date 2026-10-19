import { newUpgrades, hasUpgrade, upgradeCost, type UpgradeState } from "../content/upgrades";
import { purchaseUpgrade, upgradeActivity, tickUpgrades, ledger } from "./Upgrades";
import { BODY_UPGRADES, newBody, hasBody, gymMultiplier, type BodyState } from "./life/body";
import type { Simulation } from "./Simulation";
import { DAY, HOUR, ANIMALS, farmCapacity, settleRace } from "./Expansion";
import { repairVehicle } from "./VehicleDamage";
import { ENCOUNTERS } from "../content/encounters";
import { newLifeSystems, type LifeSystemsState } from "./life/state";
import { birthdays, cooking, council, diet, friendships, gym, jobSearch, licence, payslip, renting, sleep, school, vehicleCompliance, voting, stepLifeSystems } from "./life/index";
import { COOKING } from "../content/life/cooking";
import { GYM } from "../content/life/gym";
import { VEHICLE_COMPLIANCE } from "../content/life/vehicleCompliance";
import { FRIENDSHIPS } from "../content/life/friendships";
import { BIRTHDAYS } from "../content/life/birthdays";
import { applyLifeFine } from "./Society";

export interface Field {
  stage: "grass" | "ploughed" | "sown" | "ready";
  crop: string;
  planted: number;
  moisture: number;
  soil: number;
  weeds: number;
}
export interface Stock {
  id: number;
  name: string;
  species: string;
  age: number;
  health: number;
  temperament: number;
  trained: number;
  parent: number;
  breedAt: number;
  fame: number;
}
export interface Appointment {
  id: number;
  title: string;
  due: number;
  kind: string;
  done: boolean;
}
export interface Chronicle {
  at: number;
  text: string;
  kind: string;
  x: number;
  y: number;
}
export interface LifeState {
  upgrades: UpgradeState;
  body: BodyState;
  systems: LifeSystemsState;
  lastHour: number;
  lastDay: number;
  serial: number;
  savings: number;
  journal: Chronicle[];
  appointments: Appointment[];
  followups: {
    id: string;
    due: number;
    done: boolean;
    reward: number;
    contact: number;
  }[];
  scene: null | { id: string; x: number; y: number; resolved: boolean };
  markers: { x: number; y: number; name: string; icon: string }[];
  farm: {
    x: number;
    y: number;
    ride: boolean;
    tool: string;
    fields: Field[];
    stock: Stock[];
    staff: number;
    lastContract: number;
  };
  campus: {
    x: number;
    y: number;
    club: string;
    study: number;
    lastStudy: number;
  };
  career: { role: string; rank: number; xp: number; lastShift: number };
  season: {
    year: number;
    points: number;
    meets: number;
    next: number;
    trophies: number;
    training: number;
    rivals: { name: string; points: number; trust: number }[];
  };
  politics: {
    support: number;
    mayor: boolean;
    policy: string;
    lastCampaign: number;
    term: number;
  };
  nemesis: { id: number; heat: number; last: number };
  rumours: { text: string; strength: number; until: number }[];
  movement: {
    name: string;
    followers: number;
    doctrine: string;
    schism: number;
  };
  tv: { signed: boolean; fame: number; episodes: number; last: number };
  council: { heat: number; stage: number; permit: boolean };
  businesses: {
    id: number;
    name: string;
    kind: string;
    level: number;
    last: number;
  }[];
  scooter: { power: number; wins: number; last: number };
  dynasty: {
    generation: number;
    heirs: { name: string; age: number }[];
    trust: number;
  };
  festival: {
    stage: number;
    toilets: number;
    acts: number;
    tickets: number;
    due: number;
  };
  factions: Record<string, number>;
  lastFaction: number;
  court: null | {
    defendant: string;
    claim: string;
    evidence: number;
    due: number;
  };
  precedent: boolean;
  tunnels: { links: number[]; pump: boolean; flood: number };
  ghosts: {
    building: number;
    name: string;
    trust: number;
    grievance: string;
  }[];
  chain: { step: number; due: number; active: boolean };
  horseUni: { enrolled: boolean; credits: number; graduated: boolean };
  mods: Record<number, string[]>;
  insurance: { active: boolean; lastClaim: number };
  renames: Record<number, string>;
  npcs: Record<
    number,
    { job: string; ambition: string; chapters: number; last: number }
  >;
  lastAction: Record<string, number>;
}
export const newLife = (): LifeState => ({
  upgrades: newUpgrades(),
  body: newBody(),
  systems: newLifeSystems(),
  lastHour: -1,
  lastDay: -1,
  serial: 1,
  savings: 0,
  journal: [],
  appointments: [],
  followups: [],
  scene: null,
  markers: [],
  farm: {
    x: 0,
    y: 0,
    ride: false,
    tool: "Plough",
    fields: Array.from({ length: 16 }, () => ({
      stage: "grass",
      crop: "wheat",
      planted: 0,
      moisture: 70,
      soil: 70,
      weeds: 0,
    })),
    stock: [],
    staff: 0,
    lastContract: -DAY,
  },
  campus: { x: 0, y: 0, club: "", study: 0, lastStudy: -HOUR },
  career: { role: "", rank: 0, xp: 0, lastShift: -HOUR * 3 },
  season: {
    year: 1,
    points: 0,
    meets: 0,
    next: HOUR * 3,
    trophies: 0,
    training: 0,
    rivals: [
      { name: "Maree McCone", points: 0, trust: 0 },
      { name: "Baz Hayward", points: 0, trust: 0 },
      { name: "Aroha Swift", points: 0, trust: 0 },
    ],
  },
  politics: {
    support: 0,
    mayor: false,
    policy: "none",
    lastCampaign: -HOUR,
    term: 0,
  },
  nemesis: { id: -1, heat: 0, last: 0 },
  rumours: [],
  movement: {
    name: "The Sacred Pie Society",
    followers: 0,
    doctrine: "Share the pies",
    schism: 0,
  },
  tv: { signed: false, fame: 0, episodes: 0, last: -HOUR * 3 },
  council: { heat: 0, stage: 0, permit: false },
  businesses: [],
  scooter: { power: 0, wins: 0, last: -HOUR * 3 },
  dynasty: { generation: 1, heirs: [], trust: 0 },
  festival: { stage: 0, toilets: 0, acts: 0, tickets: 0, due: 0 },
  factions: {
    Tradies: 0,
    Students: 0,
    "Racing club": 0,
    "Retirement village": 0,
  },
  lastFaction: -HOUR * 3,
  court: null,
  precedent: false,
  tunnels: { links: [], pump: false, flood: 0 },
  ghosts: [],
  chain: { step: 0, due: 0, active: false },
  horseUni: { enrolled: false, credits: 0, graduated: false },
  mods: {},
  insurance: { active: false, lastClaim: -DAY },
  renames: {},
  npcs: {},
  lastAction: {},
});
export const QUALIFIED: Record<string, string> = {
  Arts: "Journalist",
  Commerce: "Business analyst",
  Science: "Research assistant",
  Engineering: "Engineer",
  Education: "Teacher",
  Law: "Solicitor",
  "Fine Arts": "Gallery curator",
  "Computer Science": "Developer",
};
export const OWNABLE = new Set([
  "diner",
  "pizza",
  "sushi",
  "bakery",
  "cafe",
  "fishchips",
  "dairy",
  "toyshop",
  "sports",
  "pawn",
  "nightclub",
  "apartments",
  "house",
  "office",
  "records",
  "barber",
  "gym",
  "hotel",
]);
export const MODS = [
  ["Limousine chassis", 1200],
  ["Tractor engine", 1800],
  ["Double deck", 1500],
  ["Racing tyres", 700],
  ["Hearse body", 900],
  ["Neon kit", 250],
] as const;
export function note(sim: Simulation, text: string, kind = "life"): string {
  const s = sim.life;
  s.journal.push({
    at: sim.tick,
    text,
    kind,
    x: sim.player.x,
    y: sim.player.y,
  });
  if (s.journal.length > 100) s.journal.shift();
  sim.toasts.push({ text, tick: sim.tick, kind: "" });
  if (sim.toasts.length > 40) sim.toasts.shift();
  return text;
}
function pay(sim: Simulation, n: number): boolean {
  if (!Number.isFinite(n) || n < 0 || sim.player.cash < n) return false;
  sim.player.cash = Math.round((sim.player.cash - n) * 100) / 100;
  if (n) ledger(sim, "Life activity purchase", -n);
  return true;
}
function reward(sim: Simulation, n: number) {
  sim.player.cash = Math.round((sim.player.cash + n) * 100) / 100;
  if (n) ledger(sim, "Life activity income", n);
}
function every(sim: Simulation, key: string, period: number): boolean {
  const last = sim.life.lastAction[key];
  if (last !== undefined && sim.tick - last < period) return false;
  sim.life.lastAction[key] = sim.tick;
  return true;
}
function schedule(sim: Simulation, title: string, due: number, kind: string) {
  if (sim.life.appointments.some((a) => !a.done && a.kind === kind)) return;
  sim.life.appointments.push({
    id: sim.life.serial++,
    title,
    due,
    kind,
    done: false,
  });
  if (sim.life.appointments.length > 40)
    sim.life.appointments = sim.life.appointments
      .filter((a) => !a.done)
      .slice(-40);
}
export function resolveScene(
  sim: Simulation,
  id: string,
  reputation: number,
): void {
  const s = sim.life;
  if (s.followups.some((f) => f.id === id)) return;
  const contact =
    sim.chars.find(
      (c) =>
        c.id !== sim.playerId &&
        Math.hypot(c.x - sim.player.x, c.y - sim.player.y) < 15,
    )?.id ?? 1;
  s.followups.push({
    id,
    due: sim.tick + HOUR * 3,
    done: false,
    reward: reputation > 1 ? 25 : reputation > 0 ? 10 : 0,
    contact,
  });
  if (s.scene) s.scene.resolved = true;
  note(
    sim,
    `${ENCOUNTERS.find((e) => e.id === id)?.title ?? id}: your choice became part of the neighbourhood's story.`,
    "memory",
  );
}
export function syncStock(sim: Simulation): void {
  const s = sim.life;
  for (const [species] of ANIMALS) {
    const wanted = sim.expansion.animals[species] ?? 0;
    let group = s.farm.stock.filter((a) => a.species === species);
    while (group.length < wanted) {
      const id = s.serial++;
      const a: Stock = {
        id,
        name: `${species.split(" ")[0]} ${id}`,
        species,
        age: 0,
        health: 90,
        temperament: 30 + ((id * 13) % 65),
        trained: 0,
        parent: -1,
        breedAt: -DAY * 3,
        fame: 0,
      };
      s.farm.stock.push(a);
      group.push(a);
    }
    if (group.length > wanted) {
      const removed = new Set(group.slice(wanted).map((a) => a.id));
      s.farm.stock = s.farm.stock.filter((a) => !removed.has(a.id));
    }
  }
}
export function tickLife(sim: Simulation): void {
  const s = sim.life,
    hour = Math.floor(sim.tick / HOUR),
    day = Math.floor(sim.tick / DAY);
  const payout = settleRace(sim.expansion, sim.tick);
  if (payout) {
    reward(sim, payout);
    note(
      sim,
      `Your race bet returned $${payout}. Open Betting for the result.`,
      "betting",
    );
  }
  if (s.nemesis.id < 0) {
    const rival =
      sim.chars.find((c) => c.id !== sim.playerId && c.tier === "principal") ??
      sim.chars[1];
    if (rival) s.nemesis.id = rival.id;
  }
  if (sim.expansion.pending && !s.scene) {
    s.scene = {
      id: sim.expansion.pending,
      x: sim.player.x + 1.2,
      y: sim.player.y + 1.2,
      resolved: false,
    };
  }
  if (
    s.scene &&
    s.scene.id !== sim.expansion.pending &&
    !sim.expansion.pending &&
    s.scene.resolved
  )
    s.scene = null;
  if (s.lastHour === hour) return;
  s.lastHour = hour;
  tickUpgrades(sim);
  if (hasBody(s.body, "vitamins")) sim.player.needs.energy = Math.min(1, sim.player.needs.energy + 0.03);
  const party = sim.world.areaAt(sim.player.x, sim.player.y)?.kind === "stage" || sim.player.anim.pose === "dance";
  s.body.hearing = party && !hasBody(s.body, "earplugs") ? Math.max(0.25, s.body.hearing - 0.01) : Math.min(1, s.body.hearing + 0.005);
  if (hasBody(s.body, "stick")) for (const c of sim.chars)
    if (c.id !== sim.playerId && c.tier !== "background" && Math.hypot(c.x - sim.player.x, c.y - sim.player.y) < 3)
      c.emo.fear = Math.min(1, c.emo.fear + 0.04);
  const lifeFlags = s.dynasty.heirs.length ? sim.lifeFlags : { ...sim.lifeFlags, childhood: false };
  const vehicle = sim.player.inCar >= 0 ? sim.vehicles[sim.player.inCar] : null;
  const driving = !!vehicle && Math.abs(vehicle.speed) > 0.5;
  const lifeStep = stepLifeSystems(s.systems, sim.tick, sim.rng, sim.player.cash, s.savings, lifeFlags, driving, hasBody(s.body, "ice"), hasUpgrade(s.upgrades, "beanbag") ? 1.25 : 1);
  s.systems = lifeStep.state;
  if (sim.lifeFlags.dietHunger) sim.player.hunger = s.systems.diet.hunger;
  if (sim.lifeFlags.sleepFatigue) {
    const fatigue = s.systems.sleep.fatigue;
    sim.player.emo.mood = Math.max(-1, sim.player.emo.mood - fatigue * 0.015);
    sim.player.needs.energy = Math.max(0, sim.player.needs.energy - fatigue * 0.02);
  }
  for (const event of lifeStep.events) {
    if (event.type === "life_bin_collection")
      for (const id of sim.litter.stock.keys()) sim.litter.stock.set(id, 0);
    if (event.fineAmount) event.summary = applyLifeFine(sim, event.fineAmount, event.type === "life_council_fine" ? "Council fine" : "Traffic fine");
    if (event.cashDelta) sim.player.cash = Math.max(0, Math.round((sim.player.cash + event.cashDelta) * 100) / 100);
    if (event.savingsDelta) s.savings = Math.round((s.savings + event.savingsDelta) * 100) / 100;
    sim.emit({ type: event.type, x: sim.player.x, y: sim.player.y, actors: [sim.playerId], summary: event.summary });
    note(sim, event.summary, "life");
  }
  syncStock(sim);
  for (const field of s.farm.fields) {
    if (field.stage === "sown") {
      field.weeds = Math.min(100, field.weeds + 6);
      field.moisture = Math.min(
        100,
        Math.max(0, field.moisture - (sim.env.raining ? -20 : 7)),
      );
      if (
        sim.tick - field.planted >=
          HOUR *
            (field.crop === "corn" ? 4 : field.crop === "potatoes" ? 5 : 3) &&
        field.moisture > 15
      )
        field.stage = "ready";
    }
  }
  for (const follow of s.followups) {
    if (!follow.done && sim.tick >= follow.due) {
      follow.done = true;
      reward(sim, follow.reward);
      const c = sim.chars[follow.contact];
      if (c) {
        const rel = sim.relate(c, sim.playerId);
        rel.trust = Math.min(1, rel.trust + (follow.reward ? 0.08 : 0.01));
        rel.fam = Math.min(1, rel.fam + 0.1);
      }
      note(
        sim,
        `${c?.name ?? "Your neighbour"} followed up about ${follow.id}: ${follow.reward ? "a thank-you and $" + follow.reward : "they remember your choice"}.`,
        "callback",
      );
    }
  }
  if (sim.expansion.degree)
    schedule(
      sim,
      "UC assignment: visit the library",
      sim.tick + DAY * 2,
      "assignment",
    );
  if (sim.expansion.horse)
    schedule(
      sim,
      "Horncastle qualifying meet",
      Math.max(sim.tick, s.season.next),
      "race",
    );
  for (const a of s.appointments)
    if (!a.done && sim.tick >= a.due) {
      a.done = true;
      if (a.kind === "assignment") {
        s.campus.study = Math.max(0, s.campus.study - 1);
        note(
          sim,
          "Your UC assignment deadline passed. Visit the library to get back on track.",
          "calendar",
        );
      } else
        note(
          sim,
          `${a.title} is due now. Open the phone to take part.`,
          "calendar",
        );
    }
  s.rumours = s.rumours.filter((r) => r.until > sim.tick);
  if (s.nemesis.heat > 20 && sim.tick - s.nemesis.last >= HOUR * 6) {
    s.nemesis.last = sim.tick;
    const loss = Math.min(sim.player.cash, 10 + Math.floor(s.nemesis.heat / 4));
    sim.player.cash -= loss;
    note(
      sim,
      `${sim.chars[s.nemesis.id]?.name ?? "Your rival"} undercut your latest deal. Lost $${loss}. Bring evidence to court or call a truce.`,
      "nemesis",
    );
  }
  if (s.chain.active && sim.tick >= s.chain.due) {
    const scenes = [
      "Your escaped bull blocks a bus. Commuters start arguing.",
      "The delayed bus strands a wedding party. Your TV producer smells an episode.",
      "The wedding spills into a campaign launch. Your nemesis takes the microphone.",
      "Your improvised rescue becomes a city legend. A tourist trail opens.",
    ];
    note(sim, scenes[s.chain.step], "cascade");
    s.chain.step++;
    s.chain.due = sim.tick + HOUR;
    s.tv.fame += 3;
    s.nemesis.heat += 4;
    if (s.chain.step >= 4) {
      s.chain.active = false;
      s.politics.support += 8;
      s.markers.push({
        x: sim.player.x,
        y: sim.player.y,
        name: "The Great Bull Detour",
        icon: "🐂",
      });
    }
  }
  if (s.festival.stage === 1 && sim.tick >= s.festival.due) {
    s.festival.stage = 2;
    const success = s.festival.toilets >= 2 && s.festival.acts >= 2;
    const income = success ? 400 + s.festival.tickets * 8 : 50;
    reward(sim, income);
    sim.player.reputation += success ? 8 : -5;
    s.tv.fame += success ? 8 : 15;
    s.council.heat += success ? 0 : 25;
    note(
      sim,
      success
        ? `Your festival was a hit. Ticket return $${income}.`
        : "Your festival ran out of toilets. The footage is famous for the wrong reason.",
      "festival",
    );
  }
  if (s.lastDay === day) return;
  s.lastDay = day;
  for (const a of s.farm.stock) {
    a.age++;
    a.health = Math.max(
      10,
      Math.min(100, a.health + (sim.expansion.feed > 0 ? 2 : -7)),
    );
    if (a.fame > 0) reward(sim, Math.floor(a.fame / 3));
  }
  if (s.farm.staff) {
    const bill = s.farm.staff * 35;
    reward(sim, -Math.min(sim.player.cash, bill));
    sim.expansion.farmCare = day;
    sim.expansion.feed += s.farm.staff * 10;
  }
  for (const b of s.businesses) {
    const income = Math.round(
      (b.kind === "pigeon hotel" ? 40 : 65) *
        b.level * (hasUpgrade(s.upgrades, "renovation") ? 1.25 : 1) *
        (s.politics.policy === "Free pies" ? 0.8 : 1) *
        (1 - Math.min(0.4, s.nemesis.heat / 300)),
    );
    reward(sim, income);
    b.last = sim.tick;
  }
  for (const ghost of s.ghosts) {
    if (ghost.trust < 40) {
      reward(sim, -Math.min(sim.player.cash, 20));
      note(
        sim,
        `${ghost.name} rearranged a tenant's furniture. $20 refund.`,
        "ghost",
      );
    } else reward(sim, 45);
  }
  if (s.insurance.active && !pay(sim, 10)) {
    s.insurance.active = false;
    note(
      sim,
      "Your vehicle insurance lapsed: $10 daily premium unpaid.",
      "insurance",
    );
  }
  if (s.tunnels.links.length && sim.env.raining && !s.tunnels.pump)
    s.tunnels.flood = Math.min(100, s.tunnels.flood + 20);
  if (s.council.heat > 20 && !s.council.permit) {
    s.council.stage = Math.min(3, s.council.stage + 1);
    schedule(
      sim,
      "Council hearing: your suspicious chicken palace",
      sim.tick + DAY,
      "council",
    );
  }
  for (const heir of s.dynasty.heirs) heir.age++;
  for (const c of sim.chars
    .filter((c) => c.id !== sim.playerId && c.tier !== "background")
    .slice(0, 24)) {
    const p = s.npcs[c.id] ?? {
      job: c.role,
      ambition: [
        "open a shop",
        "study at UC",
        "train a racehorse",
        "run for council",
      ][c.id % 4],
      chapters: 0,
      last: sim.tick,
    };
    p.chapters++;
    p.last = sim.tick;
    s.npcs[c.id] = p;
    if (p.chapters % 3 === 0) {
      const rel = sim.relate(c, sim.playerId);
      rel.fam = Math.min(1, rel.fam + 0.02);
      note(
        sim,
        `${c.name} is still working towards ${p.ambition}. They remember ${rel.trust > 0.2 ? "your help" : "seeing you around"}.`,
        "people",
      );
    }
  }
}
export function action(sim: Simulation, key: string, arg = ""): string {
  const s = sim.life,
    e = sim.expansion,
    p = sim.player;
  const fail = (text: string) => text;
  const done = (text: string, kind = key) => note(sim, text, kind);
  const lifeEvent = (type: string, text: string) => {
    sim.emit({ type, x: p.x, y: p.y, actors: [p.id], summary: text });
    return done(text, "life");
  };
  if (key === "upgrade") return done(purchaseUpgrade(sim, arg), "upgrades");
  if (key.startsWith("u:")) return done(upgradeActivity(sim, key.slice(2), arg), "upgrades");
  if (key === "bodyUpgrade") {
    const item = BODY_UPGRADES.find((u) => u.id === arg);
    if (!item) return fail("Unknown body upgrade.");
    if (hasBody(s.body, item.id)) return fail("Already owned.");
    if (!pay(sim, item.cost)) return fail(`You need $${item.cost}.`);
    s.body.owned.push(item.id);
    return done(`${item.name} purchased. ${item.effect}`, "body");
  }
  if (key === "sleep") {
    if (!sim.lifeFlags.sleepFatigue) return fail("Sleep and fatigue are switched off.");
    s.systems.sleep = sleep.beginSleep(s.systems.sleep, sim.tick);
    return lifeEvent("life_sleep_started", "You settled in for eight game hours of sleep.");
  }
  if (key === "childSchool" || key === "childSport" || key === "childFriend" || key === "childBedtime") {
    if (!sim.lifeFlags.childhood || !s.dynasty.heirs.length) return fail("Add a child to your household first.");
    const child = s.systems.childhood;
    if (key === "childSchool") child.schoolDays++;
    if (key === "childSport") { child.sportSessions++; s.systems.gym.fitness = Math.min(1, s.systems.gym.fitness + 0.03); }
    if (key === "childFriend") child.friendVisits++;
    if (key === "childBedtime") child.bedtimeUntil = sim.tick + HOUR * 8;
    const activity = key === "childSchool" ? "school" : key === "childSport" ? "sport" : key === "childFriend" ? "friend time" : "bedtime";
    return lifeEvent("life_child_activity", `Family time: ${activity}.`);
  }
  if (key === "cook") {
    if (!sim.lifeFlags.cooking || !sim.lifeFlags.dietHunger) return fail("Cooking or diet is switched off.");
    const meal = cooking.cook(s.systems.cooking, sim.tick);
    if (!meal) return fail("Give cooking an hour between meals.");
    if (!pay(sim, upgradeCost(s.upgrades, COOKING.cost))) return fail(`Groceries cost $${COOKING.cost}.`);
    if (hasUpgrade(s.upgrades, "cooking")) { meal.quality = Math.min(1, meal.quality + 0.2); p.emo.mood = Math.min(1, p.emo.mood + 0.12); }
    s.systems.cooking = meal;
    s.systems.diet = diet.eat(s.systems.diet, meal.quality);
    p.hunger = s.systems.diet.hunger;
    p.needs.energy = Math.min(1, p.needs.energy + COOKING.energyGain);
    return lifeEvent("life_cooked", "You cooked a decent meal. Hunger and energy improved.");
  }
  if (key === "workout") {
    if (!sim.lifeFlags.gymFitness) return fail("Gym and fitness are switched off.");
    const trained = gym.workout(s.systems.gym, sim.tick);
    if (!trained) return fail("Give your muscles a day to recover between sessions.");
    if (!hasUpgrade(s.upgrades, "homegym") && !pay(sim, GYM.cost)) return fail(`A gym session costs $${GYM.cost}.`);
    trained.fitness = Math.min(1, s.systems.gym.fitness + (trained.fitness - s.systems.gym.fitness) * gymMultiplier(s.body));
    s.systems.gym = trained;
    p.needs.energy = Math.max(0, p.needs.energy - 0.15);
    return lifeEvent("life_workout", "Workout done. Fitness improved; energy dipped a little.");
  }
  if (key === "jobApply") {
    if (!sim.lifeFlags.jobSearch) return fail("Job search is switched off.");
    const next = jobSearch.apply(s.systems.jobSearch, sim.tick);
    if (next === s.systems.jobSearch) return fail("You have an application in progress or have reached the application limit.");
    s.systems.jobSearch = next;
    return lifeEvent("life_job_applied", next.message);
  }
  if (key === "jobAccept") {
    if (!sim.lifeFlags.jobSearch || !s.systems.jobSearch.message.startsWith("Reply: interview offer")) return fail("There is no job offer to accept yet.");
    s.career.role = "Cafe assistant";
    s.career.rank = Math.max(1, s.career.rank);
    s.systems.jobSearch.message = "You accepted a Cafe assistant job.";
    return lifeEvent("life_job_accepted", s.systems.jobSearch.message);
  }
  if (key === "rentBond") {
    if (!sim.lifeFlags.renting) return fail("Renting is switched off.");
    const result = renting.moveIn(s.systems.renting, p.cash);
    if (!result) return fail("You already have a place, or need four weeks of rent for the bond.");
    p.cash += result.cashDelta;
    s.systems.renting = result.state;
    return lifeEvent("life_rent_bond", "Bond paid. Your rental is secured.");
  }
  if (key === "rentPay") {
    if (!sim.lifeFlags.renting || !s.systems.renting.bondPaid) return fail("Secure a rental first.");
    const amount = Math.min(s.systems.renting.weeklyRent, s.systems.budget.arrears);
    if (!amount) return fail("No rent arrears are due.");
    if (!pay(sim, amount)) return fail(`Weekly rent is $${amount}.`);
    s.systems.budget.arrears -= amount;
    return lifeEvent("life_rent_paid", `You paid $${amount} towards rent arrears.`);
  }
  if (key === "rentInspect") {
    if (!sim.lifeFlags.renting || !s.systems.renting.bondPaid) return fail("Secure a rental first.");
    const next = renting.inspect(s.systems.renting, sim.tick);
    if (!next) return fail("The property manager won't inspect again yet.");
    s.systems.renting = next;
    return lifeEvent("life_rent_inspection", "Rental inspection complete. The place passed.");
  }
  if (key === "licencePractice") {
    if (!sim.lifeFlags.driverLicence) return fail("Driver licensing is switched off.");
    const next = licence.practice(s.systems.licence, sim.tick);
    if (!next) return fail("Driving practice takes one game hour between sessions.");
    s.systems.licence = next;
    return lifeEvent("life_licence_practice", `Driving practice logged: ${s.systems.licence.practiceHours} hour(s).`);
  }
  if (key === "licenceTest") {
    if (!sim.lifeFlags.driverLicence) return fail("Driver licensing is switched off.");
    const result = licence.test(s.systems.licence, sim.rng);
    if (result.state === s.systems.licence) return fail("You need more practice before the next test.");
    s.systems.licence = result.state;
    return lifeEvent("life_licence_test", result.passed ? `Passed. You now have a ${result.state.stage} licence.` : "Not quite. Practise a little more and try again.");
  }
  if (key === "wof" || key === "rego") {
    if (!sim.lifeFlags.vehicleCompliance) return fail("Vehicle paperwork is switched off.");
    const amount = key === "wof" ? VEHICLE_COMPLIANCE.wofCost : VEHICLE_COMPLIANCE.regoCost;
    if (!pay(sim, amount)) return fail(`${key.toUpperCase()} renewal costs $${amount}.`);
    s.systems.wof = vehicleCompliance.renew(s.systems.wof, sim.tick, key);
    return lifeEvent(key === "wof" ? "life_wof_renewed" : "life_rego_renewed", `${key.toUpperCase()} renewed for six game months.`);
  }
  if (key === "schoolStudy") {
    if (!sim.lifeFlags.schoolExams) return fail("School and exams are switched off.");
    const next = school.study(s.systems.school, sim.tick);
    if (!next) return fail("You can study once per game hour.");
    s.systems.school = next;
    return lifeEvent("life_school_study", `Study session complete. ${next.credits} credit(s) ready for an exam.`);
  }
  if (key === "schoolExam") {
    if (!sim.lifeFlags.schoolExams) return fail("School and exams are switched off.");
    const result = school.sitExam(s.systems.school, sim.rng);
    if (!s.systems.school.credits) return fail("Study first, then sit an exam.");
    s.systems.school = result.state;
    return lifeEvent("life_school_exam", result.passed ? `Exam passed. Grade progress: ${result.state.grade}.` : "Exam not passed this time. Your study credits are still yours.");
  }
  if (key === "friendGift") {
    if (!sim.lifeFlags.friendships) return fail("Friendship gifts are switched off.");
    const target = sim.chars[Number(arg)];
    if (!target || target.id === p.id) return fail("Choose a friend to give a gift to.");
    if (Math.hypot(target.x - p.x, target.y - p.y) > 12) return fail("Meet up with them before sending a gift.");
    const rel = sim.relate(target, p.id);
    const result = friendships.gift(s.systems.friendships, sim.tick, rel.trust);
    if (!result) return fail("Give it a day between gifts.");
    if (!pay(sim, FRIENDSHIPS.giftCost)) return fail(`A gift costs $${FRIENDSHIPS.giftCost}.`);
    rel.trust = result.trust;
    rel.aff = Math.min(1, rel.aff + 0.05);
    s.systems.friendships = result.state;
    return lifeEvent("life_friend_gift", `You sent ${target.name} a small gift. Trust grew.`);
  }
  if (key === "birthdayGift") {
    if (!sim.lifeFlags.birthdaysGifts) return fail("Birthday gifts are switched off.");
    if (!pay(sim, BIRTHDAYS.giftReward)) return fail(`A birthday gift costs $${BIRTHDAYS.giftReward}.`);
    s.systems.birthdays = birthdays.giveGift(s.systems.birthdays);
    return lifeEvent("life_birthday_gift", "You gave a birthday gift. It was appreciated.");
  }
  if (key === "payRates") {
    if (!sim.lifeFlags.councilRatesBins || (!s.systems.council.ratesDue && !s.systems.council.fines)) return fail("No council rates or fines are due.");
    const due = s.systems.council.ratesDue + s.systems.council.fines;
    if (!pay(sim, due)) return fail(`Council rates due: $${due}.`);
    s.systems.council = council.payRates(s.systems.council);
    return lifeEvent("life_rates_paid", `Council rates paid: $${due}.`);
  }
  if (key === "vote") {
    if (!sim.lifeFlags.voting) return fail("Voting is switched off.");
    const next = voting.vote(s.systems.voting, sim.tick);
    if (!next) return fail("You already voted in this election.");
    s.systems.voting = next;
    return lifeEvent("life_vote", "You voted in the local election.");
  }
  if (key === "taxCode") {
    if (!sim.lifeFlags.payslips || (arg !== "M" && arg !== "S")) return fail("Choose a valid tax code.");
    s.systems.payslip = payslip.setTaxCode(s.systems.payslip, arg);
    return lifeEvent("life_tax_code", `Tax code set to ${arg}.`);
  }
  if (key === "sickDay") {
    if (!sim.lifeFlags.payslips || !s.career.role || s.systems.payslip.sickLeave <= 0) return fail("You need a job and available sick leave.");
    const remaining = s.systems.payslip.sickLeave - 1;
    const slip = payslip.pay(s.systems.payslip, 50);
    s.systems.payslip = { ...slip.state, sickLeave: remaining };
    reward(sim, slip.net);
    s.upgrades.taxClaimed += slip.tax;
    return lifeEvent("life_payslip", `Sick day paid $${slip.net} after $${slip.tax} tax. ${remaining} day(s) remain.`);
  }
  if (key === "bank") {
    const n = Number(arg);
    if (!Number.isFinite(n) || n === 0) return fail("Choose a valid amount.");
    if (n > 0) {
      if (!pay(sim, n)) return fail("Not enough cash.");
      s.savings += n;
    } else {
      if (s.savings < -n) return fail("Not enough savings.");
      s.savings += n;
      reward(sim, -n);
    }
    return done(`Savings balance $${s.savings}.`);
  }
  if (key === "campaign") {
    if (sim.tick - s.politics.lastCampaign < HOUR)
      return fail("Next campaign stop in one game hour.");
    if (!pay(sim, 20)) return fail("A campaign stop costs $20.");
    s.politics.lastCampaign = sim.tick;
    s.politics.support += 8 + (s.movement.followers ? 2 : 0);
    s.nemesis.heat += 3;
    schedule(sim, "Mayoral election", sim.tick + HOUR * 6, "election");
    return done(
      "You promised free pies. Support rose; your nemesis has questions.",
    );
  }
  if (key === "elect") {
    if (s.politics.mayor) return fail("You are already mayor.");
    const election = [...s.appointments]
      .reverse()
      .find((a) => a.kind === "election");
    if (!election || sim.tick < election.due)
      return fail("The scheduled election has not opened yet.");
    if (s.lastAction.election === election.id)
      return fail("This election is complete. Campaign for the next one.");
    s.lastAction.election = election.id;
    if (s.politics.support + p.reputation < 35)
      return done(
        "You lost the election. Build support and contest the next one.",
      );
    s.politics.mayor = true;
    s.politics.term++;
    s.markers.push({
      x: p.x,
      y: p.y,
      name: `Mayor ${p.name.split(" ")[0]}'s victory`,
      icon: "🏛️",
    });
    return done("You are mayor. Choose a policy and live with the bill.");
  }
  if (key === "policy") {
    if (!s.politics.mayor) return fail("Win the election first.");
    if (!["Free pies", "Green streets", "Nightlife grants"].includes(arg))
      return fail("Choose a council policy.");
    if (!pay(sim, 100)) return fail("The policy fund needs $100.");
    s.politics.policy = arg;
    sim.env.party = arg === "Nightlife grants";
    if (arg === "Free pies") p.hunger = 1;
    p.reputation += 5;
    return done(`${arg} enacted. Local people and businesses notice.`);
  }
  if (key === "buyBusiness") {
    const id = Number(arg),
      b = sim.world.buildings[id];
    if (!b || !OWNABLE.has(b.kind) || s.businesses.some((x) => x.id === id))
      return fail("Choose an unowned property.");
    if (!pay(sim, 1200)) return fail("Property purchase costs $1,200.");
    s.businesses.push({
      id,
      name: b.name,
      kind: b.kind,
      level: 1,
      last: sim.tick,
    });
    s.renames[id] = `${p.name.split(" ")[0]}'s ${b.name}`;
    b.name = s.renames[id];
    s.nemesis.heat += 5;
    return done(
      `${b.name} now pays daily business income. You also inherit complaints.`,
    );
  }
  if (key === "weirdBusiness") {
    if (
      ![
        "pigeon hotel",
        "drive-through weddings",
        "support tractor hire",
        "breakup photography",
      ].includes(arg)
    )
      return fail("Choose a business.");
    if (s.businesses.some((b) => b.kind === arg))
      return fail("You already own this business.");
    if (!pay(sim, 600)) return fail("Startup costs $600.");
    s.businesses.push({
      id: -s.serial++,
      name: arg,
      kind: arg,
      level: 1,
      last: sim.tick,
    });
    s.tv.fame += 5;
    return done(
      `${arg} is open. Daily takings will arrive on the farm/calendar tick.`,
    );
  }
  if (key === "rumour") {
    if (!every(sim, key, HOUR * 3))
      return fail("Let the rumour spread for three game hours.");
    const text = e.horse
      ? "Big Hay is laundering money through your horse."
      : s.businesses.length
        ? "Your pigeon hotel is a front for the council."
        : "You are secretly paid by the road-cone manufacturers.";
    s.rumours.push({ text, strength: 30, until: sim.tick + DAY * 2 });
    s.nemesis.heat += 5;
    p.reputation -= 2;
    for (const c of sim.chars.slice(1, 15)) {
      const r = sim.relate(c, p.id);
      r.trust = Math.max(-1, r.trust - 0.03);
      c.bubble = {
        kind: "say",
        text: "Heard the Big Hay story?",
        until: sim.tick + 300,
      };
    }
    return done(text, "rumour");
  }
  if (key === "truce") {
    if (!pay(sim, 30)) return fail("Bring $30 for a peace offering.");
    s.nemesis.heat = Math.max(0, s.nemesis.heat - 30);
    const c = sim.chars[s.nemesis.id];
    if (c) sim.relate(c, p.id).trust += 0.1;
    return done("Your nemesis accepted the pie basket. The feud cooled down.");
  }
  if (key === "taunt") {
    if (!every(sim, key, HOUR)) return fail("Give them an hour to recover.");
    s.nemesis.heat += 12;
    s.tv.fame += 4;
    return done("Your nemesis screenshotted that. Television loved it.");
  }
  if (key === "movement") {
    if (sim.player.cash < 15 || !every(sim, key, HOUR) || !pay(sim, 15))
      return fail("A meeting costs $15 and takes an hour to organise.");
    s.movement.followers += Math.max(1, 3 + Math.floor(p.reputation / 20));
    s.movement.schism += s.movement.followers > 15 ? 1 : 0;
    s.politics.support += 2;
    return done(
      `${s.movement.name} gained followers. Doctrine: ${s.movement.doctrine}. ${s.movement.schism ? "A faction argues whether the pie must be warm." : ""}`,
    );
  }
  if (key === "tv") {
    if (!s.tv.signed) {
      s.tv.signed = true;
      s.tv.fame = 5;
      return done(
        "Signed to Flat Out Christchurch. Producers will pay for episodes, not endless repeat clicks.",
      );
    }
    if (sim.tick - s.tv.last < HOUR * 3)
      return fail("The next episode needs three game hours.");
    s.tv.last = sim.tick;
    s.tv.episodes++;
    const income = 50 + s.tv.fame * 2;
    reward(sim, income);
    s.tv.fame += s.nemesis.heat > 20 ? 8 : 3;
    return done(
      `Episode ${s.tv.episodes}: $${income} appearance fee. Your family objects to the edit.`,
    );
  }
  if (key === "permit") {
    if (!e.farm) return fail("Buy a farm first.");
    if (!pay(sim, 100)) return fail("The permit costs $100.");
    s.council.permit = true;
    s.council.heat = 0;
    s.council.stage = 0;
    return done(
      "Your chicken palace is permitted. The inspector looked emotionally defeated.",
    );
  }
  if (key === "shed") {
    if (!e.farm || !pay(sim, 50)) return fail("Buy a farm and budget $50.");
    s.council.heat += 15;
    e.feed += 30;
    return done(
      "An unapproved chicken palace went up. Extra feed storage; extra council attention.",
    );
  }
  if (key === "celebrity") {
    const a = s.farm.stock.find((a) => a.id === Number(arg));
    if (!a) return fail("Choose one of your animals.");
    if (!every(sim, `animal:${a.id}`, HOUR * 3))
      return fail("Your animal needs a break from publicity.");
    a.fame += 10;
    s.tv.fame += 5;
    reward(sim, 15);
    return done(
      `${a.name} went viral. $15 appearance fee; daily celebrity income unlocked.`,
    );
  }
  if (key === "scooterBuild") {
    if (!pay(sim, 120)) return fail("Scooter parts cost $120.");
    s.scooter.power = Math.min(100, s.scooter.power + 20);
    return done(
      "Your mobility scooter now looks like it has an unresolved court case.",
    );
  }
  if (key === "scooterRace") {
    if (sim.tick - s.scooter.last < HOUR * 3 || s.scooter.power < 20)
      return fail("Build a scooter and wait three game hours between meets.");
    if (!pay(sim, 20)) return fail("Entry costs $20.");
    s.scooter.last = sim.tick;
    const won = sim.rng.next() < 0.25 + s.scooter.power / 160;
    if (won) {
      reward(sim, 100);
      s.scooter.wins++;
      s.factions["Retirement village"] += 5;
    }
    return done(
      won
        ? "You won the Cathedral Square scooter derby. Nana demands a rematch."
        : "Nana overtook you while unwrapping a mint. Improve your scooter.",
    );
  }
  if (key === "mod") {
    const v = sim.vehicles.find((v) => v.owner === p.id || v.id === p.inCar),
      part = MODS.find((x) => x[0] === arg);
    if (!v || !part) return fail("Own or drive a car, then choose a part.");
    const mods = (s.mods[v.id] ??= []);
    if (mods.includes(arg) || mods.length >= 4)
      return fail("Part fitted already, or four-part chassis limit reached.");
    if (!pay(sim, part[1])) return fail(`That part costs $${part[1]}.`);
    mods.push(arg);
    v.lifeMods = [...mods];
    return done(
      `${part[0]} fitted. Mass, grip and power now reflect the build.`,
    );
  }
  if (key === "heir") {
    if (s.dynasty.heirs.length >= 4 || !pay(sim, 100))
      return fail(
        "Family capacity is four heirs; preparing a room costs $100.",
      );
    if (!s.dynasty.heirs.length) s.systems.childhood = { ageDays: 0, stage: "child", schoolDays: 0, sportSessions: 0, friendVisits: 0, bedtimeUntil: 0, lastTick: sim.tick };
    s.dynasty.heirs.push({
      name: arg.trim().slice(0, 24) || `Heir ${s.dynasty.heirs.length + 1}`,
      age: 0,
    });
    return done(
      "A new heir joined your household. They will inherit the businesses and the grudges.",
    );
  }
  if (key === "trust") {
    if (!pay(sim, 50)) return fail("A trust deposit is $50.");
    s.dynasty.trust += 50;
    return done(`Family trust: $${s.dynasty.trust}.`);
  }
  if (key === "generation") {
    if (!s.dynasty.heirs.some((a) => a.age >= 7))
      return fail("An heir needs seven game days of family story progression.");
    const heir = s.dynasty.heirs.splice(
      s.dynasty.heirs.findIndex((a) => a.age >= 7),
      1,
    )[0];
    s.dynasty.generation++;
    p.name = heir.name;
    reward(sim, s.dynasty.trust);
    s.dynasty.trust = 0;
    s.nemesis.heat = Math.floor(s.nemesis.heat * 0.7);
    return done(
      `Generation ${s.dynasty.generation}: ${heir.name} inherits the empire and the remaining feud.`,
    );
  }
  if (key === "festival") {
    if (s.festival.stage === 1)
      return fail("Your festival is already scheduled.");
    if (!pay(sim, 150)) return fail("Festival booking costs $150.");
    s.festival = {
      stage: 1,
      toilets: 0,
      acts: 0,
      tickets: 20,
      due: sim.tick + HOUR * 6,
    };
    schedule(sim, "Your chaotic festival", s.festival.due, "festival");
    return done(
      "Festival booked for six game hours from now. Arrange at least two toilets and two acts.",
    );
  }
  if (key === "toilet" || key === "act") {
    if (s.festival.stage !== 1 || !pay(sim, 30))
      return fail("Book a festival first; each hire costs $30.");
    if (key === "toilet") s.festival.toilets++;
    else {
      s.festival.acts++;
      s.festival.tickets += 15;
    }
    return done(
      key === "toilet"
        ? "Portable toilet hired. This decision may save your reputation."
        : "Another act booked. Ticket sales increased.",
    );
  }
  if (key === "faction") {
    if (!(arg in s.factions) || sim.tick - s.lastFaction < HOUR * 3)
      return fail("Choose a faction; competitions run every three game hours.");
    s.lastFaction = sim.tick;
    const score =
      1 + Math.floor(sim.rng.next() * 6) + Math.floor(p.reputation / 25);
    s.factions[arg] += score;
    reward(sim, score * 8);
    s.politics.support += 1;
    return done(
      `${arg}: won ${score} influence and $${score * 8}. Rival factions are watching.`,
    );
  }
  if (key === "case") {
    if (s.court) return fail("Resolve your current case first.");
    if (!pay(sim, 40)) return fail("Filing costs $40.");
    s.court = {
      defendant: sim.chars[s.nemesis.id]?.name ?? "The council",
      claim: arg || "The sausage-roll precedent",
      evidence: 0,
      due: sim.tick + HOUR * 3,
    };
    schedule(sim, "Court hearing: sausage-roll dispute", s.court.due, "court");
    return done("Case filed. Gather evidence before the hearing.");
  }
  if (key === "citationCase") {
    if (!sim.lifeFlags.vehicleCompliance || !s.systems.wof.citations)
      return fail("There are no traffic citations to review.");
    if (s.court) return fail("Resolve your current case first.");
    s.court = { defendant: "Council traffic office", claim: "Traffic citation", evidence: 0, due: sim.tick + HOUR };
    schedule(sim, "Court review: traffic citation", s.court.due, "citation");
    return done("Traffic citation review filed. Bring evidence and return for the hearing.");
  }
  if (key === "evidence") {
    if (!s.court || !every(sim, key, HOUR))
      return fail(
        "An active case and one game hour between evidence searches are required.",
      );
    s.court.evidence += 1 + (hasUpgrade(s.upgrades, "lawyer") ? 1 : 0) + s.upgrades.evidence;
    s.upgrades.evidence = 0;
    return done("A receipt and a witness statement were added to your case.");
  }
  if (key === "hearing") {
    if (!s.court || sim.tick < s.court.due)
      return fail("Wait for the scheduled hearing.");
    const trafficCase = s.court.claim === "Traffic citation";
    const won = trafficCase
      ? s.court.evidence >= 1 && vehicleCompliance.isRoadLegal(s.systems.wof, sim.tick)
      : s.court.evidence + (s.career.role === "Solicitor" ? 2 : 0) >= 2;
    s.court = null;
    if (trafficCase) {
      if (won) {
        s.systems.wof.citations = Math.max(0, s.systems.wof.citations - 1);
        s.systems.budget.arrears = Math.max(0, s.systems.budget.arrears - VEHICLE_COMPLIANCE.expiredFine);
        return done("Court upheld your appeal. The citation and its unpaid balance were cleared.");
      }
      return done("Court upheld the citation. The fine remains due.");
    }
    if (won) {
      reward(sim, 180);
      s.precedent = true;
      s.nemesis.heat = Math.max(0, s.nemesis.heat - 20);
      return done(
        "You won $180. The sausage-roll precedent is now part of town history.",
      );
    }
    return done(
      "Case dismissed for lack of evidence. The sausage roll remains legally ambiguous.",
    );
  }
  if (key === "tunnel") {
    const id = Number(arg);
    if (
      !s.businesses.some((b) => b.id === id && id >= 0) ||
      s.tunnels.links.includes(id)
    )
      return fail("Choose an owned town property that is not connected.");
    if (!pay(sim, 300)) return fail("A tunnel connection costs $300.");
    s.tunnels.links.push(id);
    s.council.heat += 10;
    return done(
      "Tunnel opened. Connect another property to travel underground. Rain can flood it.",
    );
  }
  if (key === "pump") {
    if (!pay(sim, 100)) return fail("Pump installation costs $100.");
    s.tunnels.pump = true;
    s.tunnels.flood = 0;
    return done("The tunnel pump is running. Floodwater is draining.");
  }
  if (key === "haunt") {
    const b = s.businesses.find(
      (b) => b.id >= 0 && !s.ghosts.some((g) => g.building === b.id),
    );
    if (!b || !pay(sim, 80))
      return fail(
        "Own a town property and budget $80 for a paranormal inspection.",
      );
    s.ghosts.push({
      building: b.id,
      name: ["Aunty Static", "The Phantom Tenant", "Sir Damp"][
        s.ghosts.length % 3
      ],
      trust: 10,
      grievance: "The previous owner painted over my favourite wallpaper.",
    });
    return done(
      `${b.name} has a ghost. Resolve its renovation grievance or pay tenant refunds.`,
    );
  }
  if (key === "ghostPeace") {
    const g = s.ghosts.find((g) => g.building === Number(arg));
    if (!g || !pay(sim, 25))
      return fail("Choose a ghost and budget $25 for restoration.");
    g.trust = Math.min(100, g.trust + 20);
    return done(
      `${g.name} approves of the wallpaper. Friendly haunting income rises at 40 trust.`,
    );
  }
  if (key === "cascade") {
    if (s.chain.active || !every(sim, key, DAY))
      return fail("One disaster chain per game day.");
    s.chain = { step: 0, due: sim.tick + HOUR, active: true };
    return done(
      "A bull escaped. The first consequence will unfold in one game hour.",
    );
  }
  if (key === "rename") {
    const id = Number(arg),
      b = sim.world.buildings[id];
    if (!b || !s.politics.mayor)
      return fail("Become mayor and select a town building.");
    const name = `${p.name.split(" ")[0]}'s Monument to Questionable Decisions`;
    s.renames[id] = name;
    b.name = name;
    s.markers.push({ x: b.door.x, y: b.door.y, name, icon: "🗿" });
    return done("The map now carries your permanent monument.");
  }
  if (key === "horseEnrol") {
    if (!e.horse || s.horseUni.enrolled || !pay(sim, 80))
      return fail("Own a horse and budget $80; enrolment happens once.");
    s.horseUni.enrolled = true;
    return done(
      `${e.horse.name} is enrolled in Commerce due to an administrative error. Your nemesis has lodged an objection.`,
    );
  }
  if (key === "horseCourse") {
    if (
      !s.horseUni.enrolled ||
      s.horseUni.graduated ||
      arg !== "carrot" ||
      !every(sim, key, HOUR)
    )
      return fail("Study a course each game hour. Correct answer: carrot.");
    s.horseUni.credits++;
    if (s.horseUni.credits >= 3) {
      s.horseUni.graduated = true;
      s.politics.support += 10;
      s.nemesis.heat += 15;
      return done(
        `${e.horse?.name} graduated in Commerce. Horse appearance and championship bonuses unlocked.`,
      );
    }
    return done(
      `Horse Commerce credit ${s.horseUni.credits}/3: correct, a carrot is an asset.`,
    );
  }
  if (key === "interview") {
    const subject = Object.keys(QUALIFIED).find((q) => QUALIFIED[q] === arg);
    if (!subject || !e.graduated.some((q) => q.endsWith(`of ${subject}`)))
      return fail("Complete the matching university qualification first.");
    if (s.career.role === arg)
      return fail("You already hold this job. Work shifts to earn promotion.");
    s.career = { role: arg, rank: 1, xp: 0, lastShift: s.career.lastShift };
    return done(
      `Interview passed. Your ${subject} qualification unlocked ${arg}.`,
    );
  }
  if (key === "shift") {
    if (!s.career.role || sim.tick - s.career.lastShift < HOUR * 3)
      return fail("Get a qualified job; shifts have a three-hour cooldown.");
    const fatigue = sim.lifeFlags.sleepFatigue ? s.systems.sleep.fatigue : 0;
    if (fatigue >= 0.95) return fail("You are too exhausted for a safe shift. Get some sleep first.");
    s.career.lastShift = sim.tick;
    s.career.xp += hasUpgrade(s.upgrades, "cards") ? 2 : 1;
    if (s.career.xp % 3 === 0) s.career.rank++;
    const gross = Math.round((70 + s.career.rank * 20) * (1 + e.level * 0.2) * (fatigue >= 0.65 ? 0.8 : 1) * (hasUpgrade(s.upgrades, "coffee") ? 1.1 : 1));
    const slip = sim.lifeFlags.payslips ? payslip.pay(s.systems.payslip, gross) : { state: s.systems.payslip, net: gross, tax: 0 };
    s.systems.payslip = slip.state;
    reward(sim, slip.net);
    s.upgrades.taxClaimed += slip.tax;
    p.hunger = Math.max(0, p.hunger - 0.1);
    const text = `${s.career.role} shift: $${gross} gross, $${slip.tax} tax, $${slip.net} take-home. Rank ${s.career.rank}; ${s.career.xp} shifts completed.`;
    if (sim.lifeFlags.payslips) sim.emit({ type: "life_payslip", x: p.x, y: p.y, actors: [p.id], summary: text });
    return done(text);
  }
  if (key === "insurance") {
    if (s.insurance.active) return fail("Insurance is already active.");
    if (!pay(sim, 40))
      return fail("Joining insurance costs $40, then $10 each game day.");
    s.insurance.active = true;
    return done(
      "Vehicle insurance active. Claims need a damaged owned car and a $50 excess.",
    );
  }
  if (key === "tow" || key === "repair" || key === "claim") {
    const v = sim.vehicles.find((v) => v.owner === p.id || v.id === p.inCar);
    if (!v) return fail("Own or drive a car first.");
    if (
      key === "claim" &&
      (!s.insurance.active ||
        sim.tick - s.insurance.lastClaim < DAY ||
        v.damage < 0.2)
    )
      return fail(
        "Claims require active insurance, damage over 20%, and one day between claims.",
      );
    const cost =
      key === "tow"
        ? 40
        : key === "claim"
          ? (hasUpgrade(s.upgrades, "excess") ? 25 : 50)
          : Math.round((hasUpgrade(s.upgrades, "mechanic") ? 0.75 : 1) * Math.max(
              20,
              Math.round(v.damage * 250 + (v.engineDamage ?? 0) * 100),
            ));
    if (!pay(sim, cost)) return fail(`This service costs $${cost}.`);
    if (key === "tow") {
      const b = sim.world.buildings.find((b) => b.kind === "garage");
      if (b) {
        const w = sim.world.nearestWalkable(b.door.x, b.door.y);
        v.x = w.x;
        v.y = w.y;
        v.speed = 0;
        if (v.driver === p.id) {
          p.x = v.x;
          p.y = v.y;
        }
      }
      return done("Tow truck delivered your car to the garage.");
    }
    repairVehicle(v);
    if (key === "claim") s.insurance.lastClaim = sim.tick;
    return done(`All damaged components repaired for $${cost}.`);
  }
  if (key === "hire") {
    if (!e.farm || s.farm.staff >= 3 || !pay(sim, 80))
      return fail("Own a farm; staff limit three; hiring costs $80.");
    s.farm.staff++;
    return done(
      "Farm worker hired: $35 daily, automatic stock care and 10 feed per day.",
    );
  }
  if (key === "contract") {
    if (
      !e.farm ||
      sim.tick - s.farm.lastContract < HOUR * 3 ||
      !e.machines.includes("Tractor")
    )
      return fail(
        "Farm contracts need a tractor and three game hours between jobs.",
      );
    s.farm.lastContract = sim.tick;
    reward(sim, 90 + s.farm.staff * 20);
    return done(
      "Neighbouring farm contract complete. Tractor work paid, staff boosted the contract.",
    );
  }
  if (key === "breed") {
    const a = s.farm.stock.find((a) => a.id === Number(arg));
    if (
      !a ||
      s.farm.stock.length >= farmCapacity(e) ||
      sim.tick - a.breedAt < DAY * 3 ||
      a.health < 70 ||
      !pay(sim, 35)
    )
      return fail(
        "Breeding needs healthy stock, spare capacity, $35 and a three-day cooldown.",
      );
    a.breedAt = sim.tick;
    const id = s.serial++;
    s.farm.stock.push({
      ...a,
      id,
      name: `${a.name} Jr`,
      age: 0,
      parent: a.id,
      fame: 0,
      breedAt: sim.tick,
    });
    e.animals[a.species] = (e.animals[a.species] ?? 0) + 1;
    return done(
      `${a.name} has a youngster. Its family and individual condition are saved.`,
    );
  }
  if (key === "animalCare") {
    const a = s.farm.stock.find((a) => a.id === Number(arg));
    if (!a || !pay(sim, 5)) return fail("Animal care costs $5.");
    a.health = Math.min(100, a.health + 15);
    a.trained = Math.min(100, a.trained + 5);
    return done(
      `${a.name} was groomed and handled. Health and training improved.`,
    );
  }
  return fail("Choose an available activity.");
}
export function workField(sim: Simulation, index: number): string {
  const s = sim.life,
    f = s.farm.fields[index];
  if (!f || !sim.expansion.farm) return "Buy a farm first.";
  if (!s.farm.ride || !sim.expansion.machines.includes("Tractor"))
    return "Enter your tractor before working a field.";
  if (s.farm.x !== index % 4 || s.farm.y !== Math.floor(index / 4))
    return "Drive onto this field first.";
  const tool = s.farm.tool;
  if (!sim.expansion.machines.includes(tool)) return `Buy the ${tool} first.`;
  if (tool === "Plough" && f.stage === "grass") {
    f.stage = "ploughed";
    f.weeds = 0;
    return note(sim, "Field ploughed. Attach the seed drill.");
  }
  if (tool === "Seed drill" && f.stage === "ploughed") {
    if (!pay(sim, 10)) return "Seed costs $10.";
    f.stage = "sown";
    f.planted = sim.tick;
    return note(
      sim,
      `${f.crop} sown. Keep moisture above 15; growth takes ${f.crop === "corn" ? 4 : f.crop === "potatoes" ? 5 : 3} game hours.`,
    );
  }
  if (tool === "Sprayer") {
    if (!pay(sim, 3)) return "Spray costs $3.";
    f.weeds = 0;
    return note(sim, "Weeds controlled. Harvest quality restored.");
  }
  if (tool === "Irrigator") {
    f.moisture = 100;
    return note(sim, "Field irrigated.");
  }
  if (tool === "Fertiliser spreader" && pay(sim, 5)) {
    f.soil = Math.min(100, f.soil + 20);
    return note(sim, "Soil fertility restored.");
  }
  if (tool === "Combine harvester" && f.stage === "ready") {
    const n = Math.round(
      (f.crop === "corn" ? 75 : f.crop === "potatoes" ? 100 : 50) *
        (f.soil / 100) *
        (f.moisture / 100) *
        (1 - f.weeds / 200),
    );
    reward(sim, n);
    f.stage = "grass";
    f.soil = Math.max(20, f.soil - 15);
    return note(sim, `${f.crop} harvest sold for $${n}.`);
  }
  if (
    tool === "Mower" &&
    f.stage === "grass" &&
    every(sim, `mow:${index}`, DAY)
  ) {
    sim.expansion.feed += 10;
    return note(sim, "Mowed the paddock: 10 feed stored.");
  }
  return "This attachment does not match the field stage, or today’s cut is already done.";
}
export function horseMeet(sim: Simulation): string {
  const s = sim.life,
    e = sim.expansion,
    h = e.horse;
  if (!h || sim.tick < s.season.next || h.fitness < 30)
    return "A fit horse and the next scheduled meet are required.";
  if (!pay(sim, 40)) return "Entry costs $40.";
  s.season.next = sim.tick + HOUR * 3;
  s.season.meets++;
  h.fitness -= 15;
  const score =
    h.skill + h.fitness * 0.3 + s.season.training * 2 + sim.rng.next() * 40;
  const scores = s.season.rivals.map((r) => ({
    name: r.name,
    score: 40 + s.season.meets * 3 + sim.rng.next() * 80,
  }));
  const position = 1 + scores.filter((r) => r.score > score).length;
  s.season.points += 5 - position;
  for (const r of s.season.rivals)
    r.points += 1 + Math.floor(sim.rng.next() * 4);
  let result = `${h.name} placed ${position}/4. Season points ${s.season.points}.`;
  if (position === 1) {
    h.wins++;
    reward(sim, s.horseUni.graduated ? 230 : 200);
  }
  if (s.season.meets >= 4) {
    const won =
      s.season.points >= Math.max(...s.season.rivals.map((r) => r.points));
    if (won) {
      s.season.trophies++;
      reward(sim, 500);
      result += " Horncastle champion! Trophy and $500.";
    } else result += " Season finished. Rivals edged you out.";
    s.season.year++;
    s.season.meets = 0;
    s.season.points = 0;
    for (const r of s.season.rivals) r.points = 0;
  }
  schedule(sim, "Next Horncastle meet", s.season.next, "race");
  return note(sim, result, "racing");
}
