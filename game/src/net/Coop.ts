import type { Character, Vehicle, WoundKind, WoundPart } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { makeVehicle } from "../sim/Traffic";
import { wound } from "../sim/Life";
import { VEHICLES } from "../content/vehicles";

/**
 * Things to do together once someone shares your PIN.
 *  - Their car is real: a driver's car is drawn on your screen, and you can climb in as a passenger and ride along (the driver sees who is aboard).
 *  - Fight mode: when BOTH of you switch it on, punches, weapons and bullets that land on the other player's figure wound the other
 *    player for real (nothing happens if either of you has it off, and the police do not care about a duel).
 *  - Emotes (high five, hug, dance, cheers) and handing over cash.
 * Everything rides on the relay's tiny "e" event; the state packet carries the car, the fight flag and the riders.
 */
export interface Aux { cls: string; color: string; pvp: boolean; riders: string[]; host: string }
export interface Peer { id: string; name: string; x: number; y: number; c: string }
export interface CoopHost { myId: string; send(o: object): void; peer(id: string): { peer: Peer; ghost: Character; slot: number } | undefined; peers(): { peer: Peer; ghost: Character; slot: number }[]; note(t: string): void }

export const parseAux = (c: string): Aux => { const [cls = "", color = "", pv = "", rs = ""] = c.split("|"); return cls === "ride" ? { cls: "ride", color: "", pvp: pv === "1", riders: [], host: color } : { cls, color, pvp: pv === "1", riders: rs ? rs.split(",") : [], host: "" }; };
const EMOTE: Record<string, { pose: string; say: string }> = { hi5: { pose: "pose", say: "High five!" }, hug: { pose: "comfort", say: "Come here, mate." }, dance: { pose: "dance", say: "Dance with me!" }, cheers: { pose: "pose", say: "Cheers!" } };

export class Coop {
  pvp = false; riding = ""; riders = new Map<string, { name: string; at: number }>();
  private cars = new Map<number, Vehicle>(); private emote: { pose: string; until: number } | null = null;
  private beat = 0; private lastHit = 0; private warned = new Map<string, number>();
  constructor(private host: CoopHost) {}

  /** The state packet's car field: my car (or my ride), my fight flag and who is riding with me. */
  aux(sim: Simulation): string {
    const p = sim.player, pv = this.pvp ? "1" : "0";
    if (this.riding) return `ride|${this.riding}|${pv}|`;
    const v = p.inCar >= 0 ? sim.vehicles[p.inCar] : undefined;
    const alive = [...this.riders.keys()].slice(0, 3).join(",");
    return v ? `${v.cls}|${v.color}|${pv}|${alive}` : `|${"" }|${pv}|`;
  }

  isGhostCar(v: Vehicle | undefined): boolean { return !!v && [...this.cars.values()].includes(v); }
  /** Who is driving this drawn car (so you can ride along), if anyone. */
  driverOf(v: Vehicle): string | undefined { for (const [slot, car] of this.cars) if (car === v) { const p = this.host.peers().find((q) => q.slot === slot); return p?.peer.id; } return undefined; }
  nameOf(id: string): string { return this.host.peer(id)?.peer.name ?? "a friend"; }

  /** Draw or park the remote player's car under their figure. */
  applyGhost(sim: Simulation, slot: number, ghost: Character, p: Peer, a: Aux): void {
    let v = this.cars.get(slot);
    const want = a.cls && a.cls !== "ride" && VEHICLES[a.cls as keyof typeof VEHICLES] ? a.cls : "";
    if (!want) { if (v && v.x > -300) this.parkCar(sim, v, ghost); ghost.inCar = -1; return; }
    if (!v) { v = makeVehicle(sim, want as Vehicle["cls"], p.x, p.y, 0, "parked"); v.owner = -4; v.plate = "MP" + (100 + slot); this.cars.set(slot, v); }
    if (v.cls !== want) { v.cls = want as Vehicle["cls"]; v.damage = 0; }
    if (a.color) v.color = a.color;
    const dx = ghost.x - v.x, dy = ghost.y - v.y, jump = Math.hypot(dx, dy) > 6;
    v.x = v.px = ghost.x; v.y = v.py = ghost.y; void jump;
    let dh = ghost.facing - v.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); v.heading = jump ? ghost.facing : v.heading + dh * 0.4;
    v.speed = Math.hypot(ghost.vx, ghost.vy); v.state = "parked"; v.driver = ghost.id; v.parkingBrake = false; v.crashedUntil = 0; v.forSale = false;
    ghost.inCar = v.id;
  }
  private parkCar(sim: Simulation, v: Vehicle, ghost: Character): void { void sim; v.x = v.px = -400; v.y = v.py = -400; v.speed = 0; if (v.driver === ghost.id) v.driver = -1; ghost.inCar = -1; }
  /** The slot lost its player. */
  release(sim: Simulation, slot: number): void { const v = this.cars.get(slot); if (!v) return; v.x = v.px = -400; v.y = v.py = -400; v.speed = 0; if (v.driver >= 0 && sim.chars[v.driver]) sim.chars[v.driver].inCar = -1; v.driver = -1; }

  ride(sim: Simulation, v: Vehicle): string {
    const id = this.driverOf(v); if (!id) return "";
    const p = sim.player; if (p.inCar >= 0) return "";
    this.riding = id; this.host.send({ t: "e", k: "ride", to: id }); this.beat = 0;
    this.host.note(`Riding with ${this.nameOf(id)}. Press E to get out.`);
    return id;
  }
  leaveRide(sim: Simulation): void {
    if (!this.riding) return; const p = sim.player, v = p.inCar >= 0 ? sim.vehicles[p.inCar] : undefined;
    this.host.send({ t: "e", k: "unride", to: this.riding }); this.riding = "";
    p.inCar = -1;
    if (v) { const q = sim.world.nearestFoot(v.x + Math.cos(v.heading + Math.PI / 2) * 1.6, v.y + Math.sin(v.heading + Math.PI / 2) * 1.6, 8); if (q) { p.x = p.px = q.x; p.y = p.py = q.y; } }
  }
  /** A drawn car close to you that has a driver, for the Ride button. */
  rideTarget(sim: Simulation): { name: string } | null {
    const p = sim.player; if (p.inCar >= 0 || this.riding) return null;
    for (const [slot, v] of this.cars) { if (v.x < -300 || v.driver < 0) continue; if (Math.hypot(v.x - p.x, v.y - p.y) < 3) { const q = this.host.peers().find((s) => s.slot === slot); if (q) return { name: q.peer.name.split(" ")[0] }; } }
    return null;
  }

  emoteTo(sim: Simulation, key: string, to: string): void {
    const e = EMOTE[key]; if (!e) return;
    this.emote = { pose: e.pose, until: performance.now() + 3500 };
    sim.say(sim.player, e.say, "say", 3); this.host.send({ t: "e", k: "emo", to, s: key });
  }
  give(sim: Simulation, to: string, amount: number): string {
    const p = sim.player; amount = Math.max(1, Math.min(2000, Math.floor(amount)));
    if (p.cash < amount) return "You do not have that much.";
    p.cash -= amount; this.host.send({ t: "e", k: "cash", to, d: amount }); return `You handed ${this.nameOf(to)} $${amount}.`;
  }
  setPvp(on: boolean): void { this.pvp = on; this.host.note(on ? "Fight mode ON. Only players who also have it on can hurt you." : "Fight mode off."); }

  /** Every frame: hold an emote, follow the car I am riding, pass on hits that landed on others, keep the rider list fresh. */
  step(sim: Simulation): void {
    const p = sim.player, now = performance.now();
    if (this.emote) { if (now > this.emote.until) this.emote = null; else p.anim.pose = this.emote.pose; }
    if (this.riding) {
      const q = this.host.peer(this.riding), v = this.cars.get(q?.slot ?? -1);
      if (!q || !v || v.x < -300 || parseAux(q.peer.c).cls === "" || p.inside >= 0) { this.host.note("Your ride has stopped."); this.leaveRide(sim); }
      else { p.x = p.px = v.x; p.y = p.py = v.y; p.vx = p.vy = 0; p.inCar = v.id; if (now - this.beat > 1500) { this.beat = now; this.host.send({ t: "e", k: "ride", to: this.riding }); } }
    }
    for (const [id, r] of this.riders) if (now - r.at > 5000) { this.riders.delete(id); this.host.note(`${r.name} got out.`); }
    // the other players' figures are inert: any wound they take is theirs to feel, so hand it over and keep the figure whole
    for (const q of this.host.peers()) {
      const g = q.ghost; if (!g.wounds.length && g.blood >= 1) continue;
      const w = g.wounds[g.wounds.length - 1]; g.wounds.length = 0; g.bleed = 0; g.blood = 1; g.phys = 0; g.physTimer = 0;
      if (!w) continue;
      const a = parseAux(q.peer.c);
      if (this.pvp && a.pvp) { if (now - this.lastHit > 120) { this.lastHit = now; this.host.send({ t: "e", k: "hit", to: q.peer.id, s: `${w.part}|${w.severity}|${w.kind}|${w.weapon ?? ""}` }); } }
      else if (now - (this.warned.get(q.peer.id) ?? 0) > 8000) { this.warned.set(q.peer.id, now); this.host.note(!this.pvp ? "Turn on Fight mode (World PIN menu) to fight other players." : `${q.peer.name} has Fight mode off.`); }
    }
  }

  onEvent(sim: Simulation, m: { id?: string; n?: string; k?: string; to?: string; s?: string; d?: number }): void {
    if (!m.id || !m.k || (m.to && m.to !== this.host.myId)) return;
    const from = this.host.peer(m.id), p = sim.player;
    if (m.k === "ride") { const fresh = !this.riders.has(m.id); this.riders.set(m.id, { name: m.n ?? "A friend", at: performance.now() }); if (fresh) this.host.note(`${m.n ?? "A friend"} hopped in your car.`); }
    else if (m.k === "unride") this.riders.delete(m.id);
    else if (m.k === "hit" && this.pvp && from && parseAux(from.peer.c).pvp && Math.hypot(from.ghost.x - p.x, from.ghost.y - p.y) < 14 && m.s) {
      const [part, sev, kind, weapon] = m.s.split("|");
      if (!["head", "torso", "arm", "leg"].includes(part) || !["bruise", "graze", "cut", "gash", "stab", "fracture"].includes(kind)) return;
      const s = Math.max(1, Math.min(3, parseInt(sev, 10) || 1)) as 1 | 2 | 3;
      wound(sim, p, part as WoundPart, s, kind as WoundKind, from.ghost.id, from.ghost.x, from.ghost.y, weapon || undefined);
      p.lastHitBy = from.ghost.id; p.lastHitTick = sim.tick; sim.bus.emit("sound", { kind: "thud", x: p.x, y: p.y, vol: 0.7 } as never);
      this.host.note(`${m.n ?? "Someone"} hit you.`);
    } else if (m.k === "emo" && m.s && EMOTE[m.s] && from && Math.hypot(from.ghost.x - p.x, from.ghost.y - p.y) < 9) {
      this.emote = { pose: EMOTE[m.s].pose, until: performance.now() + 3500 }; sim.say(p, EMOTE[m.s].say === "Dance with me!" ? "Yeah!" : EMOTE[m.s].say, "say", 3);
    } else if (m.k === "cash" && typeof m.d === "number" && from && Math.hypot(from.ghost.x - p.x, from.ghost.y - p.y) < 14) {
      const d = Math.max(0, Math.min(2000, Math.floor(m.d))); p.cash += d; this.host.note(`${m.n ?? "A friend"} gave you $${d}.`);
    }
  }
}
