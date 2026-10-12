/**
 * The people you see inside an interior. Real characters (c.inside === building id) are drawn at
 * plausible spots for what they are (staff at work spots, the jailed in cells, everyone else
 * queueing, sitting or loitering). Quiet "ambient" visitors fill the room to its usual busyness so
 * it never looks abandoned. Presentation only: this reads sim state and never writes it, never
 * calls Math.random (every choice comes from hashed seeds) and only does work every ~0.6 s.
 */
import type { Simulation } from "../sim/Simulation";
import type { Building } from "../world/World";
import type { Character, Look, HairStyle } from "../entities/types";
import type { InteriorDef, Spot, SpotDoing } from "../content/interiors";
import { findPath, type Pt } from "../content/interiorNav";
import type { ViewActor } from "../render/InteriorView";

const POSE: Record<SpotDoing, string> = { queue: "idle", sit: "sit", stand: "idle", work: "idle", browse: "watch", lie: "down", phone: "phone", talk: "talk" };
const HAIR: HairStyle[] = ["big", "bun", "pony", "buzz", "long", "braids", "curly", "sidepart", "bob", "pigtails", "topknot", "spiky", "none"];
const COLORS = ["#ff7ad9", "#3dd6ff", "#c6ff3d", "#f6b62c", "#b48cff", "#ec2a1c", "#6fe3b0", "#eee4d3", "#ff9a4d"];
const FACE_DIR = { n: 1, e: 1, s: -1, w: -1 } as const;

function hash(a: number, b = 0, c = 0): number { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
const unit = (n: number): number => (n % 100003) / 100003;

interface Person extends ViewActor {
  key: string;
  charId: number;
  spot: number;
  path: Pt[];
  until: number;
  leaving: boolean;
  doing: SpotDoing;
  group: "staff" | "jail" | "visit";
  slot: number;
}

export class InteriorCrowd {
  private people = new Map<string, Person>();
  private taken = new Map<number, string>();
  private lastSync = -9;
  private seq = 1;

  constructor(private def: InteriorDef, private sim: Simulation, private b: Building) {}

  get actors(): ViewActor[] { return [...this.people.values()]; }
  count(): number { return this.people.size; }
  real(): number { let n = 0; for (const p of this.people.values()) if (p.charId >= 0) n++; return n; }

  private mood(): number { const h = this.sim.hour; return h >= 7 && h < 21 ? 1 : 0.55; }

  private freeSpots(pred: (s: Spot, i: number) => boolean): number[] {
    const out: number[] = [];
    this.def.spots.forEach((s, i) => { if (!this.taken.has(i) && pred(s, i)) out.push(i); });
    return out;
  }

  private pick(list: number[], seed: number): number { return list.length ? list[seed % list.length] : -1; }

  private spawn(key: string, look: Look, name: string | undefined, charId: number, group: Person["group"], slot: number, style: string, t: number): Person {
    const d = this.def.door;
    const p: Person = { id: key, key, look, name, charId, group, slot, x: d.x, y: d.y, dir: 1, pose: "idle", phase: unit(hash(slot, charId)) * 6, poseT: 0, speed: 0, seed: unit(hash(charId, slot, 7)) * 9, style, spot: -1, path: [], until: t + 30, leaving: false, doing: "stand" };
    this.people.set(key, p);
    return p;
  }

  private assign(p: Person, idx: number, t: number, instant: boolean): void {
    if (p.spot >= 0) this.taken.delete(p.spot);
    p.spot = idx;
    if (idx < 0) { p.leaving = true; this.route(p, this.def.door); return; }
    this.taken.set(idx, p.key);
    const s = this.def.spots[idx];
    p.doing = s.doing;
    if (instant) { p.x = s.x; p.y = s.y; p.path = []; this.settle(p); }
    else this.route(p, s);
    p.until = t + 28 + unit(hash(p.slot, Math.floor(t / 30), p.charId)) * 55;
  }

  private route(p: Person, to: Pt): void {
    const path = findPath(this.def, { x: p.x, y: p.y }, to);
    if (path) p.path = path; else { p.x = to.x; p.y = to.y; p.path = []; if (p.spot >= 0) this.settle(p); }
  }

  private settle(p: Person): void {
    const s = this.def.spots[p.spot]; if (!s) return;
    p.pose = POSE[s.doing]; p.dir = FACE_DIR[s.face]; p.speed = 0; p.lying = s.doing === "lie";
  }

  private lookFor(seed: number, staff: boolean): Look {
    const guy = unit(hash(seed, 1)) < 0.5;
    return { kind: guy ? "guy" : "girl", color: staff ? this.def.staff.color : COLORS[hash(seed, 2) % COLORS.length], accent: COLORS[hash(seed, 3) % COLORS.length], hat: (staff && this.def.staff.hat ? this.def.staff.hat : "none") as Look["hat"], hair: HAIR[hash(seed, 4) % HAIR.length], scale: 0.94 + unit(hash(seed, 5)) * 0.12, build: 0.9 + unit(hash(seed, 6)) * 0.3 };
  }

  /** Reconcile with the sim (call every frame; it only works every ~0.6 s). */
  sync(t: number): void {
    if (t - this.lastSync < 0.6) return;
    this.lastSync = t;
    const sim = this.sim, bid = this.b.id;
    const here = new Set<number>();
    let n = 0;
    for (const c of sim.chars) {
      if (c.inside !== bid) continue;
      if (c.tier === "player") continue;
      if (++n > 26) break;
      here.add(c.id);
      const key = "c" + c.id;
      if (!this.people.has(key)) this.admit(c, key, t);
    }
    for (const p of this.people.values()) {
      if (p.charId >= 0 && !here.has(p.charId) && !p.leaving) this.assign(p, -1, t, false);
    }
    // ambient visitors and staff up to the building's usual busyness
    const def = this.def, workSpots = def.spots.filter((s) => s.doing === "work").length, visitSpots = def.spots.length - workSpots;
    const wantVisitors = Math.max(0, Math.round(visitSpots * def.busy * this.mood() * 0.9) - this.real());
    const wantStaff = workSpots ? Math.max(1, Math.round(workSpots * (0.4 + 0.5 * def.busy))) : 0;
    let visitors = 0, staffNow = 0;
    for (const p of this.people.values()) { if (p.leaving) continue; if (p.group === "staff") staffNow++; else if (p.charId < 0 && p.group === "visit") visitors++; }
    for (let i = 0; i < wantStaff - staffNow && i < 12; i++) this.arrive(this.seq++, t, true);
    for (let i = 0; i < wantVisitors - visitors && i < 3; i++) this.arrive(this.seq++, t, false);
    // quieter than before (night fell)? let one ambient visitor head home per sync
    if (visitors > wantVisitors + 1) for (const p of this.people.values()) if (p.charId < 0 && p.group === "visit" && !p.leaving) { this.assign(p, -1, t, false); break; }
  }

  private admit(c: Character, key: string, t: number): void {
    const staff = c.workplace === this.b.id, jailed = c.jailUntil > 0 && (this.def.kind === "police");
    const group: Person["group"] = jailed ? "jail" : staff ? "staff" : "visit";
    let idx = -1;
    if (jailed) idx = this.pick(this.freeSpots((s) => s.group === "cell"), c.id);
    else if (staff) idx = this.pick(this.freeSpots((s) => s.doing === "work"), c.id);
    if (idx < 0) idx = this.pick(this.freeSpots((s) => s.doing !== "work" && s.group !== "cell" && s.doing !== "lie"), hash(c.id, 9));
    if (idx < 0) idx = this.pick(this.freeSpots((s) => s.group !== "cell" && s.doing !== "lie"), c.id);
    const p = this.spawn(key, c.look, c.name, c.id, group, c.id, c.style || "normal", t);
    this.assign(p, idx, t, t < 1.2);
  }

  private arrive(seed: number, t: number, staff: boolean): void {
    const h = hash(this.b.id, seed);
    const idx = staff ? this.pick(this.freeSpots((sp) => sp.doing === "work"), h) : this.pick(this.freeSpots((sp) => sp.doing !== "work" && sp.group !== "cell" && (sp.doing !== "lie" || unit(h) < 0.5)), h);
    if (idx < 0) return;
    const p = this.spawn((staff ? "as" : "av") + seed, this.lookFor(h, staff), undefined, -1, staff ? "staff" : "visit", seed, "normal", t);
    this.assign(p, idx, t, t < 1.2);
    if (staff) p.until = t + 1e9;
  }

  update(dt: number, t: number): void {
    for (const p of this.people.values()) {
      if (p.path.length) {
        const w = p.path[0], dx = w.x - p.x, dy = w.y - p.y, dist = Math.hypot(dx, dy), step = 1.35 * dt;
        if (dist <= step) { p.x = w.x; p.y = w.y; p.path.shift(); } else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
        p.speed = 1.35; p.pose = "walk"; p.lying = false; p.phase += 1.35 * dt * 5.5;
        const sdx = dx - dy; if (Math.abs(sdx) > 0.02) p.dir = sdx >= 0 ? 1 : -1;
        if (!p.path.length) { if (p.leaving) { this.release(p); continue; } this.settle(p); p.poseT = 0; }
      } else if (p.leaving) { this.release(p); continue; }
      else {
        p.speed = 0; p.poseT += dt;
        if (t > p.until && p.group !== "jail" && !(p.group === "staff")) {
          if (p.charId < 0) this.assign(p, -1, t, false);
          else { const idx = this.pick(this.freeSpots((s) => s.doing !== "work" && s.group !== "cell" && s.doing !== "lie"), hash(p.charId, Math.floor(t))); if (idx >= 0) this.assign(p, idx, t, false); else p.until = t + 20; }
        }
      }
    }
  }

  private release(p: Person): void { if (p.spot >= 0) this.taken.delete(p.spot); this.people.delete(p.key); }
}
