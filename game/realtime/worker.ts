// Mosaics World realtime server (Cloudflare Worker + Durable Objects).
//
// One PIN = one shared world. The map is split into square cells; every cell is its own Durable Object, so thousands of people
// can share one PIN as long as they are not all standing in the same spot: a client connects only to the cell it is in (and the
// neighbours it is close to) and is sent only the ~48 nearest people. Nothing is stored: this is a relay for positions and chat.
//
// URL:  wss://<worker>/ws/<pin>/<cellX>/<cellY>
//
// Deploy:  cd game/realtime && npx wrangler login && npx wrangler deploy

const CELL_TILES = 192;        // size of a cell, in game tiles
const INTEREST = 70;           // tiles: you see people this close
const MAX_SEEN = 48;           // nearest people sent to each client
const TICK_MS = 200;           // snapshot rate (5 per second)
const GONE_MS = 6000;          // no update for this long = left
const MAX_SOCKETS = 1800;      // per cell
const MAX_MSG_PER_SEC = 14;
const MAX_CHAT = 120;

interface Env { WORLD: any }
interface Player { id: string; name: string; look: any; x: number; y: number; z: number; h: number; p: string; sp: number; c: string; at: number; ver: number }
interface Conn { ws: any; id: string; x: number; y: number; known: Set<string>; rate: number; rateAt: number; ver: number }

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const str = (v: unknown, n: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").slice(0, n) : "");

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url), parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "health") return new Response("ok", { headers: { "access-control-allow-origin": "*" } });
    if (parts[0] !== "ws" || parts.length < 3 || req.headers.get("Upgrade") !== "websocket") return new Response("Mosaics World realtime", { status: 426 });
    const pin = parts[1].replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "public";
    if (parts[2] === "lobby") return env.WORLD.get(env.WORLD.idFromName(`${pin}:lobby`)).fetch(req);   // the PIN-wide directory: who is here and where
    if (parts.length < 4) return new Response("bad path", { status: 400 });
    const cx = parseInt(parts[2], 10) | 0, cy = parseInt(parts[3], 10) | 0;
    if (Math.abs(cx) > 500 || Math.abs(cy) > 500) return new Response("bad cell", { status: 400 });
    const id = env.WORLD.idFromName(`${pin}:${cx}:${cy}`);
    return env.WORLD.get(id).fetch(req);
  },
};

export class Cell {
  players = new Map<string, Player>();
  conns = new Set<Conn>();
  timer: any = null;
  lobby = false;
  constructor(_state: any, _env: Env) {}

  async fetch(req: Request): Promise<Response> {
    this.lobby = new URL(req.url).pathname.split("/").filter(Boolean)[2] === "lobby";
    if (this.conns.size >= MAX_SOCKETS) return new Response("cell full", { status: 503 });
    const pair = new (globalThis as any).WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    const conn: Conn = { ws: server, id: "", x: 0, y: 0, known: new Set(), rate: 0, rateAt: 0, ver: 0 };
    this.conns.add(conn);
    server.addEventListener("message", (e: any) => this.onMessage(conn, e.data));
    const bye = () => { this.conns.delete(conn); if (conn.id) { /* the player record expires on its own, so a cell hop does not flicker */ } if (!this.conns.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
    server.addEventListener("close", bye); server.addEventListener("error", bye);
    if (!this.timer) this.timer = setInterval(() => (this.lobby ? this.tickLobby() : this.tick()), this.lobby ? 2000 : TICK_MS);
    return new Response(null, { status: 101, webSocket: client } as any);
  }

  onMessage(conn: Conn, raw: unknown): void {
    const now = Date.now();
    if (now - conn.rateAt > 1000) { conn.rateAt = now; conn.rate = 0; }
    if (++conn.rate > MAX_MSG_PER_SEC || typeof raw !== "string" || raw.length > 1200) return;
    let m: any; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "j") {   // join: who I am
      const id = str(m.id, 24); if (!id) return;
      conn.id = id; conn.ver = num(m.v, 0, 99, 1);
      const old = this.players.get(id);
      this.players.set(id, { id, name: str(m.n, 24) || "Mosaic", look: sanitizeLook(m.l), x: num(m.x, -1e5, 1e5), y: num(m.y, -1e5, 1e5), z: 0, h: 0, p: "auto", sp: 0, c: "", at: now, ver: old?.ver ?? 0 });
      conn.x = num(m.x, -1e5, 1e5); conn.y = num(m.y, -1e5, 1e5);
    } else if (m.t === "s" && conn.id) {   // state
      const p = this.players.get(conn.id); if (!p) return;
      p.x = conn.x = num(m.x, -1e5, 1e5, p.x); p.y = conn.y = num(m.y, -1e5, 1e5, p.y); p.z = num(m.z, -10, 200, 0); p.h = num(m.h, -7, 7, 0);
      p.sp = num(m.sp, 0, 60, 0); p.p = str(m.p, 16) || "auto"; p.c = str(m.c, 20); p.at = now; p.ver++;
      if (m.n) p.name = str(m.n, 24) || p.name;
    } else if (m.t === "c" && conn.id) {   // chat: heard by people within earshot
      const p = this.players.get(conn.id), text = str(m.m, MAX_CHAT); if (!p || !text) return;
      const msg = JSON.stringify({ t: "c", id: p.id, n: p.name, m: text });
      for (const c of this.conns) { if (!c.id) continue; const dx = c.x - p.x, dy = c.y - p.y; if (dx * dx + dy * dy < INTEREST * INTEREST) { try { c.ws.send(msg); } catch { /* closed */ } } }
    }
  }

  tickLobby!: () => void;

  tick(): void {
    const now = Date.now(), gone: string[] = [];
    for (const [id, p] of this.players) if (now - p.at > GONE_MS) { this.players.delete(id); gone.push(id); }
    const all = [...this.players.values()];
    for (const c of this.conns) {
      if (!c.id) continue;
      const near: { p: Player; d: number }[] = [];
      for (const p of all) { if (p.id === c.id) continue; const dx = p.x - c.x, dy = p.y - c.y, d = dx * dx + dy * dy; if (d < INTEREST * INTEREST) near.push({ p, d }); }
      near.sort((a, b) => a.d - b.d);
      const out: any[] = [], seen = new Set<string>();
      for (const { p } of near.slice(0, MAX_SEEN)) {
        seen.add(p.id);
        const row: any[] = [p.id, round(p.x), round(p.y), round(p.z), round(p.h, 2), p.p, round(p.sp, 1), p.c];
        if (!c.known.has(p.id)) { row.push(p.name, p.look); c.known.add(p.id); }   // name and look once per viewer
        out.push(row);
      }
      const left = [...c.known].filter((id) => !seen.has(id)); for (const id of left) c.known.delete(id);
      try { c.ws.send(JSON.stringify({ t: "w", now, p: out, g: left.concat(gone.filter((g) => !left.includes(g))) })); } catch { /* closed */ }
    }
  }
}

const round = (v: number, d = 1): number => { const k = 10 ** d; return Math.round(v * k) / k; };
/** Only plain look fields pass through (colours, enums, small numbers). */
function sanitizeLook(l: any): any {
  if (!l || typeof l !== "object") return {};
  const out: any = {};
  for (const k of ["kind", "color", "accent", "hat", "hair", "skin", "hairColor", "top", "bottom", "shoes", "shoeColor"]) if (typeof l[k] === "string") out[k] = str(l[k], 24);
  out.scale = num(l.scale, 0.7, 1.4, 1);
  return out;
}

/** Lobby mode (one per PIN): a directory of everyone in the world, so friends can find and teleport to each other. */
export interface LobbyNote { why: string }
(Cell.prototype as any).tickLobby = function (this: Cell): void {
  const now = Date.now(), all: Player[] = [];
  for (const [id, p] of this.players) { if (now - p.at > 10000) this.players.delete(id); else all.push(p); }
  // everyone gets the same short list (O(people), not O(people squared)); each client drops itself and picks who to meet
  const start = Math.floor(now / 2000) % Math.max(1, all.length), sample: any[] = [];
  for (let i = 0; i < Math.min(40, all.length); i++) { const p = all[(start + i) % all.length]; sample.push([p.id, p.name, round(p.x), round(p.y)]); }
  const msg = JSON.stringify({ t: "L", n: all.length, p: sample });
  for (const c of this.conns) { try { c.ws.send(msg); } catch { /* closed */ } }
};
