import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import { addDealer, addWorker, dryOut, seedHabit, setPimp } from "./Underworld";
import { supportNpc } from "./Health";
import { addTopics } from "../dialogue/playerTalk";
import { remember } from "../social/Social";

/**
 * The people who make a street feel lived in, and the rough end of it. Near the start of the world a few corners get a regular
 * cast who stay at their post: beggars at shop doors, people hooked on something hunting for their next hit around a corner
 * dealer, and a small circle of street workers with the pimp who watches over them and takes his cut (Underworld.ts runs the
 * deals, the pay, the cut and the protection; Health.ts runs the withdrawal and the crashes). They talk to you as you pass,
 * you can give a beggar change or point someone to help, and everyone reacts to a fight. Runtime-only: nothing is saved.
 */
type Role = "beggar" | "addict" | "dealer" | "worker" | "pimp";
interface Post { id: number; kind: Role; x: number; y: number; face: number; next: number }
interface State { posts: Post[]; ready: boolean; tries: number }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { posts: [], ready: false, tries: 0 }); return s; };
const LINES: Record<Role, string[]> = {
  beggar: ["Spare change? Anything helps.", "Anything at all, mate?", "God bless. A couple of dollars?"],
  addict: ["Hey. Hey you. Got anything?", "Just a few bucks, I'll pay you back.", "Do you know where Tane is? Please."],
  dealer: ["Psst. You looking?", "Keep walking unless you're buying.", "Quiet night. Best kind."],
  worker: ["Looking for company?", "Evening. Cold out here.", "You new around here?"],
  pimp: ["Keep it moving unless you're buying.", "Everyone out here works for someone.", "I'm watching, that's all."],
};
const free = (c: Character | undefined): c is Character => !!c && c.tier !== "player" && c.phys === Phys.OK && c.inside < 0 && c.inCar < 0 && c.jailUntil <= 0 && c.arrestedBy < 0;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Walkable pavement spot next to an anchor, off the carriageway and clear of doors. */
function spotNear(sim: Simulation, x: number, y: number, dx: number, dy: number): { x: number; y: number } | null {
  const q = sim.world.nearestFoot(x + dx, y + dy, 5);
  if (!sim.world.walkable(q.x, q.y) || sim.world.carriageway(q.x, q.y) || sim.world.buildingAt(Math.floor(q.x), Math.floor(q.y))) return null;
  return q;
}

function setup(sim: Simulation, st: State): void {
  st.ready = true; const p = sim.player, taken = new Set<number>();
  const anchors = (kinds: string[]) => sim.world.pois.filter((q) => kinds.includes(q.kind) && dist(q, p) > 6 && dist(q, p) < 90).sort((a, b) => dist(a, p) - dist(b, p));
  const cast = (x: number, y: number): Character | null => {
    let best: Character | null = null, bd = 40;
    for (const c of sim.chars) if (c.tier === "background" && free(c) && !c.crew && c.partner < 0 && !taken.has(c.id)) { const d = dist(c, { x, y }); if (d < bd) { bd = d; best = c; } }
    if (best) taken.add(best.id); return best;
  };
  const station = (kind: Role, at: { x: number; y: number } | null, hat?: string, accent?: string): Character | null => {
    if (!at) return null; const c = cast(at.x, at.y); if (!c) return null;
    c.x = c.px = at.x; c.y = c.py = at.y; c.vx = c.vy = 0; c.goal = null; if (hat) c.look.hat = hat as Character["look"]["hat"]; if (accent) c.look.accent = accent;
    st.posts.push({ id: c.id, kind, x: at.x, y: at.y, face: Math.atan2(p.y - at.y, p.x - at.x), next: 0 }); return c;
  };
  // beggars sit by shop doors and cash machines
  const doors = anchors(["door", "atm"]);
  for (let i = 0; i < Math.min(3, doors.length); i++) { const d = doors[i * 2 % doors.length]; station("beggar", spotNear(sim, d.x, d.y, i % 2 ? 1.2 : -1.2, 1), "beanie"); }
  // a corner: a dealer, a few people hooked and hunting, and (nearby) the workers and their pimp
  const lamps = anchors(["lamp", "bench", "busstop"]), corner = lamps[Math.min(2, lamps.length - 1)];
  if (corner) {
    const dealer = station("dealer", spotNear(sim, corner.x, corner.y, 0, 1), "hood"); if (dealer) addDealer(sim, dealer, "stimulant");
    for (let i = 0; i < 3; i++) { const a = station("addict", spotNear(sim, corner.x, corner.y, -1.6 + i * 1.3, 2.2 + (i % 2) * 0.8), "hood"); if (a) seedHabit(sim, a, 0.55 + i * 0.1, i % 2 ? "sedative" : "stimulant"); }
  }
  const spot = lamps[Math.min(6, lamps.length - 1)] ?? corner;
  if (spot) {
    const pimp = station("pimp", spotNear(sim, spot.x, spot.y, 0, -1.5), "cowboy", "#f6b62c");
    for (let i = 0; i < 3; i++) { const w = station("worker", spotNear(sim, spot.x, spot.y, -2 + i * 2, 1.4), undefined, "#c0392b"); if (w) { addWorker(sim, w, 40); if (pimp) setPimp(sim, w.id, pimp.id); } }
  }
  if (!st.posts.length) st.ready = false;   // the world was not ready yet: try again shortly
}

export function updateStreet(sim: Simulation): void {
  const st = state(sim);
  if (!st.ready) { if (sim.tick % 120 !== 40 || sim.chars.length < 50 || st.tries++ > 5) return; setup(sim, st); if (!st.ready) return; }
  if (sim.tick % 3 !== 0) return;
  const p = sim.player;
  for (const post of st.posts) {
    const c = sim.chars[post.id]; if (!c || c.phys !== Phys.OK || c.talkWith >= 0 || c.emo.fear > 0.6 || c.inside >= 0 || c.arrestedBy >= 0) continue;
    // they hold their corner: eased back if jostled, never wandering off
    const d = dist(c, post);
    if (d > 6) { c.x = c.px = post.x; c.y = c.py = post.y; } else if (d > 0.3 && c.goal?.id !== "fight") { c.x += (post.x - c.x) * 0.2; c.y += (post.y - c.y) * 0.2; }
    if (c.goal?.id !== "fight") { c.vx = c.vy = 0; if (c.goal && c.goal.id !== "pursue") c.goal = null; }
    if (post.kind === "beggar" && c.anim.pose === "auto") { c.anim.pose = "sit"; c.anim.poseT = 0; }
    // call out to people passing by
    if (sim.tick >= post.next && dist(c, p) < 7 && p.inside < 0 && !(c.bubble && c.bubble.until > sim.tick)) {
      post.next = sim.tick + 60 * (22 + (c.id % 15)); c.facing = Math.atan2(p.y - c.y, p.x - c.x);
      const lines = LINES[post.kind]; sim.say(c, lines[(c.id + Math.floor(sim.tick / 600)) % lines.length], "say", 3);
    }
  }
}
const roleOf = (sim: Simulation, id: number): Role | undefined => state(sim).posts.find((q) => q.id === id)?.kind;

addTopics([
  { id: "t_spare", labels: () => ["Here, take a couple of bucks.", "Need some change?"],
    score: (t) => { const r = roleOf(t.sim, t.npc.id); return (r === "beggar" || r === "addict") && t.p.cash >= 2 && t.hostile < 0.5 ? 0.9 : 0; },
    reply: () => ["Bless you. Seriously, thank you.", "Cheers, mate. You don't know what that means.", "Thanks. People walk right past."],
    effect: (t) => { t.p.cash -= 2; t.npc.cash += 2; t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.12); remember(t.npc, { t: t.sim.tick, kind: "helped_by", subj: t.p.id, obj: -1, toy: null, area: -1, val: 0.3, ev: -1, cred: 1, src: "saw" }); } },
  { id: "t_street_help", labels: () => ["You okay? There's a clinic nearby that helps, no questions.", "Do you want help getting clean?"],
    score: (t) => (roleOf(t.sim, t.npc.id) === "addict" ? 0.8 : 0),
    reply: (t) => (t.npc.pers.kindness > 0.2 ? ["...Maybe. Maybe I should. Thanks for asking.", "Nobody asks. I'll think about it."] : ["Not today."]),
    effect: (t) => { supportNpc(t.sim, t.npc, true); dryOut(t.sim, t.npc); } },
  { id: "t_corner", labels: () => ["Whose corner is this?", "What are you all doing out here?"],
    score: (t) => { const r = roleOf(t.sim, t.npc.id); return r === "pimp" || r === "dealer" || r === "worker" ? 0.7 : 0; },
    reply: (t) => { const r = roleOf(t.sim, t.npc.id); return r === "pimp" ? ["Mine. Everyone out here looks after each other. Don't cause trouble.", "I keep an eye on my people. That's all you need to know."] : r === "dealer" ? ["Nothing to see. Move along or make it worth my while.", "Quiet night. Keep it that way."] : ["Just working. Keep it respectful and we're fine.", "It's a living. Don't ask too many questions."]; } },
]);
