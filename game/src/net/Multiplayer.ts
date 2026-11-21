import type { Character } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { TICKS_PER_HOUR } from "../sim/Environment";

/**
 * Mosaics World, together. Type the same PIN as someone else and you share one world: you see each other's characters walk
 * around, hear each other's chat as speech bubbles, and share the time of day. The server (realtime/worker.ts) is only a relay
 * split into map cells, so thousands can share a PIN; each client only hears about the ~48 nearest people.
 * Everyone plays their own copy of the city simulation, so the NPCs are not shared: the people you meet are the other players.
 */
const CELL = 192, INTEREST = 70, POOL = 40, SEND_MS = 200, TTL_MS = 4000;
export const DEFAULT_URL = "wss://mosaics-realtime.mosiacscope.workers.dev";
const LOOK_KEYS = ["kind", "color", "accent", "hat", "hair", "skin", "hairColor", "top", "bottom", "shoes", "shoeColor"] as const;
interface Remote { id: string; name: string; look: Record<string, unknown>; x: number; y: number; z: number; h: number; p: string; sp: number; c: string; at: number }
type Status = "off" | "connecting" | "live" | "error";

export class Multiplayer {
  status: Status = "off"; pin = ""; url = DEFAULT_URL; nearby = 0; message = ""; total = 0; others: { id: string; name: string; x: number; y: number }[] = []; autoMeet = true;
  private lob: WebSocket | null = null; private lobAt = 0; private lobSend = 0; private nameKey = "mosaics-world:mp-name";
  private myId = Math.random().toString(36).slice(2, 12);
  private socks = new Map<string, WebSocket>(); private remotes = new Map<string, Remote>(); private pool: Character[] = []; private slot = new Map<string, number>();
  private sendAt = 0; private raf = 0; private retryAt = new Map<string, number>(); private syncedAt = 0; private listeners: (() => void)[] = [];
  constructor(private sim: () => Simulation | undefined) {}
  onChange(fn: () => void): void { this.listeners.push(fn); }
  private changed(): void { for (const f of this.listeners) f(); }

  join(pin: string, url?: string): void {
    this.leave(); this.pin = pin.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32); if (!this.pin) return;
    if (url) this.url = url.replace(/\/+$/, "");
    this.autoMeet = true; this.total = 0; this.others = [];
    this.status = "connecting"; this.message = "Connecting..."; this.changed();
    const loop = () => { this.tick(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop);
  }
  leave(): void {
    cancelAnimationFrame(this.raf); try { this.lob?.close(); } catch { /* closed */ } this.lob = null; for (const s of this.socks.values()) { try { s.close(); } catch { /* closed */ } }
    this.socks.clear(); this.remotes.clear(); this.slot.clear(); for (const c of this.pool) this.park(c);
    this.status = "off"; this.nearby = 0; this.message = ""; this.changed();
  }
  chat(text: string): void {
    const t = text.trim().slice(0, 120); if (!t) return;
    for (const s of this.socks.values()) if (s.readyState === 1) s.send(JSON.stringify({ t: "c", m: t }));
    const sim = this.sim(); if (sim) sim.say(sim.player, t, "say", 5);
  }


  /** The name other players see: what you typed in the panel, or your character's own name. */
  myName(): string {
    let n = ""; try { n = localStorage.getItem(this.nameKey) ?? ""; } catch { /* private mode */ }
    if (n.trim()) return n.trim().slice(0, 24);
    const p = this.sim()?.player; return p && p.name && p.name !== "You" ? p.name : "Mosaic" + (parseInt(this.myId.slice(0, 3), 36) % 900 + 100);
  }
  setName(n: string): void { try { localStorage.setItem(this.nameKey, n.trim().slice(0, 24)); } catch { /* private mode */ } }

  /** Teleport next to a spot (a friend): on foot, or with your car if you are driving it. */
  goTo(x: number, y: number): void {
    const sim = this.sim(); if (!sim) return; const p = sim.player; if (p.inside >= 0) { this.message = "Step outside first"; this.changed(); return; }
    const q = sim.world.nearestFoot(x + 1.2, y, 8) ?? { x: x + 1.2, y };
    p.x = p.px = q.x; p.y = p.py = q.y;
    if (p.inCar >= 0) { const v = sim.vehicles[p.inCar]; if (v) { v.x = v.px = q.x; v.y = v.py = q.y; v.speed = 0; } }
  }
  meetNearest(): boolean {
    const sim = this.sim(); if (!sim || !this.others.length) return false; const p = sim.player;
    const o = [...this.others].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    this.goTo(o.x, o.y); this.message = "Teleported to " + o.name; this.changed(); return true;
  }
  private connectLobby(): void {
    const now = performance.now(); if (now < this.lobAt) return; this.lobAt = now + 4000;
    let ws: WebSocket; try { ws = new WebSocket(`${this.url}/ws/${this.pin}/lobby`); } catch { return; }
    this.lob = ws;
    ws.onopen = () => { const sim = this.sim(); if (!sim) return; ws.send(JSON.stringify({ t: "j", id: this.myId, n: this.myName(), l: {}, x: sim.player.x, y: sim.player.y })); };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return; let m: { t: string; n?: number; p?: unknown[][] }; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t !== "L" || !m.p) return;
      this.total = m.n ?? 0; this.others = m.p.filter((r) => String(r[0]) !== this.myId).map((r) => ({ id: String(r[0]), name: String(r[1]), x: +(r[2] as number), y: +(r[3] as number) }));
      const sim = this.sim();
      if (this.autoMeet && sim && this.others.length) {   // typing the same PIN as a friend should put you next to them
        this.autoMeet = false; const p = sim.player;
        if (this.others.some((o) => Math.hypot(o.x - p.x, o.y - p.y) > 25)) this.meetNearest();
      }
      this.changed();
    };
    ws.onclose = () => { if (this.lob === ws) this.lob = null; };
  }
  /** Cells to be connected to: the one I am in, plus neighbours I am close enough to the edge of. */
  private wanted(x: number, y: number): string[] {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), out = new Set<string>([cx + "/" + cy]);
    const lx = x - cx * CELL, ly = y - cy * CELL, dx = lx < INTEREST ? -1 : lx > CELL - INTEREST ? 1 : 0, dy = ly < INTEREST ? -1 : ly > CELL - INTEREST ? 1 : 0;
    if (dx) out.add(cx + dx + "/" + cy);
    if (dy) out.add(cx + "/" + (cy + dy));
    if (dx && dy) out.add(cx + dx + "/" + (cy + dy));
    return [...out];
  }

  private connect(cell: string): void {
    const now = performance.now(); if (now < (this.retryAt.get(cell) ?? 0)) return;
    this.retryAt.set(cell, now + 4000);
    let ws: WebSocket;
    try { ws = new WebSocket(`${this.url}/ws/${this.pin}/${cell}`); } catch { this.status = "error"; this.message = "Bad server address"; this.changed(); return; }
    this.socks.set(cell, ws);
    ws.onopen = () => {
      const sim = this.sim(); if (!sim) return;
      const p = sim.player, src = p.look as unknown as Record<string, unknown>, look: Record<string, unknown> = {};
      for (const k of LOOK_KEYS) if (typeof src[k] === "string") look[k] = src[k];
      look.scale = p.look.scale;
      ws.send(JSON.stringify({ t: "j", id: this.myId, n: this.myName(), l: look, x: p.x, y: p.y, v: 1 }));
      this.status = "live"; this.message = ""; this.changed();
    };
    ws.onmessage = (e) => this.onMsg(e.data);
    ws.onclose = () => { if (this.socks.get(cell) === ws) this.socks.delete(cell); if (this.status !== "off" && !this.socks.size) { this.status = "connecting"; this.message = "Reconnecting..."; this.changed(); } };
    ws.onerror = () => { if (this.status !== "off" && this.status !== "live") { this.status = "error"; this.message = "Could not reach the world server"; this.changed(); } };
  }

  private onMsg(raw: unknown): void {
    if (typeof raw !== "string") return;
    let m: { t: string; p?: unknown[][]; now?: number; id?: string; n?: string; m?: string };
    try { m = JSON.parse(raw); } catch { return; }
    const sim = this.sim(); if (!sim) return;
    if (m.t === "w" && m.p) {
      for (const r of m.p) {
        const id = String(r[0]); if (id === this.myId) continue;
        const old = this.remotes.get(id);
        this.remotes.set(id, { id, x: +(r[1] as number), y: +(r[2] as number), z: +(r[3] as number), h: +(r[4] as number), p: String(r[5]), sp: +(r[6] as number), c: String(r[7] ?? ""),
          name: r.length > 8 ? String(r[8]) : old?.name ?? "Mosaic", look: r.length > 9 ? (r[9] as Record<string, unknown>) : old?.look ?? {}, at: performance.now() });
      }
      if (m.now && performance.now() - this.syncedAt > 300000) { this.syncedAt = performance.now(); this.syncClock(sim, m.now); }
    } else if (m.t === "c" && m.id && m.m) {
      const i = this.slot.get(m.id), c = i === undefined ? undefined : this.pool[i];
      if (c) sim.say(c, m.m, "say", 6);
    }
  }
  /** Everyone sees the same time of day: the hour comes from the server's clock. */
  private syncClock(sim: Simulation, serverMs: number): void {
    const secPerHour = TICKS_PER_HOUR / 60, desired = ((serverMs / 1000) / secPerHour) % 24;
    sim.env.startHour = (((desired - sim.tick / TICKS_PER_HOUR) % 24) + 24) % 24;
  }

  private ensurePool(sim: Simulation): void {
    if (this.pool.length) return;
    const before = sim.chars.length; sim.spawnNpcAt(sim.player.x, sim.player.y, POOL);
    this.pool = sim.chars.slice(before);
    for (const c of this.pool) { c.tier = "player"; c.role = "local"; c.goal = null; this.park(c); }   // inert: the game's AI leaves player-tier characters alone
  }
  private park(c: Character): void { c.x = c.px = -400; c.y = c.py = -400; c.vx = c.vy = 0; }

  private tick(): void {
    const sim = this.sim(); if (!sim) return;
    const p = sim.player, now = performance.now();
    this.ensurePool(sim);
    if (!this.lob || this.lob.readyState > 1) this.connectLobby();
    if (this.lob && this.lob.readyState === 1 && now - this.lobSend > 1000 && p.inside < 0) { this.lobSend = now; this.lob.send(JSON.stringify({ t: "s", x: +p.x.toFixed(1), y: +p.y.toFixed(1) })); }
    const want = this.wanted(p.x, p.y);
    for (const [cell, ws] of [...this.socks]) if (!want.includes(cell)) { try { ws.close(); } catch { /* closed */ } this.socks.delete(cell); }
    for (const cell of want) if (!this.socks.has(cell)) this.connect(cell);
    if (now - this.sendAt > SEND_MS && p.inside < 0) {
      this.sendAt = now;
      const car = p.inCar >= 0 ? String(sim.vehicles[p.inCar]?.cls ?? "") : "";
      const msg = JSON.stringify({ t: "s", x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: +p.facing.toFixed(2), sp: +Math.hypot(p.vx, p.vy).toFixed(1), p: p.anim.pose, c: car });
      for (const s of this.socks.values()) if (s.readyState === 1) s.send(msg);
    }
    // drop the long-gone, pick the nearest few to draw
    for (const [id, r] of this.remotes) if (now - r.at > TTL_MS) this.remotes.delete(id);
    const near = [...this.remotes.values()].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, this.pool.length);
    const keep = new Set(near.map((r) => r.id));
    for (const [id, i] of [...this.slot]) if (!keep.has(id)) { this.park(this.pool[i]); this.slot.delete(id); }
    const used = new Set(this.slot.values());
    for (const r of near) {
      let i = this.slot.get(r.id);
      if (i === undefined) {
        i = this.pool.findIndex((_, k) => !used.has(k)); if (i < 0) continue;
        used.add(i); this.slot.set(r.id, i);
        const c = this.pool[i]; c.name = r.name; Object.assign(c.look, r.look); c.x = c.px = r.x; c.y = c.py = r.y;
      }
      const c = this.pool[i], dx = r.x - c.x, dy = r.y - c.y, far = Math.hypot(dx, dy) > 12;
      c.x = c.px = far ? r.x : c.x + dx * 0.25; c.y = c.py = far ? r.y : c.y + dy * 0.25; c.z = r.z; c.facing = r.h;
      c.vx = Math.cos(r.h) * r.sp; c.vy = Math.sin(r.h) * r.sp; c.anim.pose = r.p; c.inCar = -1; c.inside = -1;
    }
    this.nearby = this.slot.size;
    if (Math.floor(now / 1000) !== Math.floor((now - 17) / 1000)) this.changed();
  }
}
