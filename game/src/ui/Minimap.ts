import {missionTarget} from '../sim/CityMissions';
import { hasUpgrade } from "../content/upgrades";
import type { Simulation } from "../sim/Simulation";
import { T } from "../world/World";
import { h } from "./dom";
import {worldIndex} from '../world/WorldIndex';
import {mapMetres} from '../world/MappedWorld';

/**
 * GTA-style radar in the corner (rotated 45 degrees so "up" matches the iso view) and a full-screen
 * map (M). The full map draws the real OpenStreetMap streets of central Christchurch when the site's
 * /api/chch-map function is reachable (production), and the game's own street grid otherwise, with
 * your position mapped onto the real coordinates of the Four Avenues.
 */
const COL: Record<number, string> = { [T.GRASS]: "#24341f", [T.WATER]: "#1d4a63", [T.TREE]: "#1d2a18", [T.PARKING]: "#2a2826", [T.BUILDING]: "#4a4440", [T.ROAD]: "#14110f", [T.CROSSWALK]: "#14110f", [T.SIDEWALK]: "#6a625a", [T.PATH]: "#3a3428", [T.SAND]: "#4a4030", [T.COURT]: "#2a3a4a" };

/** Real longitudes / latitudes of the game's street lines (west->east, north->south). */
const LON = [172.6155, 172.6262, 172.6305, 172.6337, 172.6372, 172.6407, 172.6440, 172.6478, 172.6520];
const LAT = [-43.5225, -43.5250, -43.5275, -43.5296, -43.5310, -43.5325, -43.5338, -43.5360, -43.5410];
function lerpLine(arr: number[], c: number): number {
  const i = Math.max(0, Math.min(arr.length - 2, Math.floor(c / 20)));
  return arr[i] + (arr[i + 1] - arr[i]) * ((c - i * 20) / 20);
}
export const toLatLon = (x: number, y: number) => ({ lat: lerpLine(LAT, y), lon: lerpLine(LON, x) });
const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** Compass bearing in degrees (0 = north, clockwise) for a world heading. World +x is east and +y is south. */
export const bearingOf = (heading: number): number => ((Math.atan2(Math.cos(heading), -Math.sin(heading)) * 180 / Math.PI) + 360) % 360;
export const bearingName = (deg: number): string => BEARINGS[Math.round(deg / 45) % 8];
/** Real latitude and longitude of a world point: the surveyed map where there is one, the street grid otherwise. */
function geoOf(sim: Simulation, x: number, y: number): { lat: number; lon: number } {
  const m = sim.world.mapped; if (!m) return toLatLon(x, y);
  const at = mapMetres(m, x, y); return { lat: m.origin.lat - at.y / 111320, lon: m.origin.lon + at.x / (111320 * Math.cos(m.origin.lat * Math.PI / 180)) };
}
const fmtGeo = (g: { lat: number; lon: number }) => Math.abs(g.lat).toFixed(4) + "°" + (g.lat < 0 ? "S" : "N") + "  " + Math.abs(g.lon).toFixed(4) + "°" + (g.lon < 0 ? "W" : "E");

interface OsmData { ways: { k: string; p: [number, number][] }[]; attribution: string }

export class Minimap {
  el: HTMLCanvasElement;
  big: HTMLElement;
  bigOpen = false;
  private base: HTMLCanvasElement | null = null;
  private last = 0;
  private osm: OsmData | null = null;
  private osmTried = false;
  /** current story objective (gold blip) */
  target: { x: number; y: number } | null = null;
  /** story contacts with a job for you (purple blips) */
  contacts: { x: number; y: number }[] = [];
  /** The big map is a real map: drag to pan, wheel to zoom, click to inspect a spot. It follows you until you move it. */
  private zoom = 1; private view: { x: number; y: number } | null = null; private picked: { x: number; y: number } | null = null; private hover: { x: number; y: number } | null = null; private inv: ((px: number, py: number) => [number, number]) | null = null; private bound = false; private lastHover = 0;
  constructor(private sim: () => Simulation,private findAddress?:()=>void) {
    this.el = h("canvas.minimap", { width: 168, height: 168, "aria-label": "Minimap" }) as HTMLCanvasElement;
    this.el.addEventListener("click", () => this.toggle());
    this.big = h("div.bigmap.hidden", { role: "dialog", "aria-label": "Map of central Christchurch" });
  }

  /** Static tile layer (rebuilt when the world changes). */
  private buildBase(): HTMLCanvasElement {
    const w = this.sim().world, S = w.size, cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d")!, img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const col = COL[w.tiles[i]] ?? "#2a2622", n = parseInt(col.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  reset(): void { this.base = null; }

  update(now: number): void {
    if (now - this.last < 100) return;
    this.last = now;
    const sim = this.sim(), w = sim.world, p = sim.player;
    if (!this.base&&!w.mapped) this.base = this.buildBase();
    const g = this.el.getContext("2d")!, W = this.el.width, R = W / 2;
    const px = p.inCar >= 0 ? sim.vehicles[p.inCar].x : p.x, py = p.inCar >= 0 ? sim.vehicles[p.inCar].y : p.y;
    const scale = 2.6; // px per tile
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R - 2, 0, 6.283); g.clip();
    g.fillStyle = "#0e0b0a"; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(Math.PI / 4); g.scale(scale, scale); g.translate(-px, -py);
    g.imageSmoothingEnabled = false;
    if(w.mapped)this.drawSurvey(g,(x,y)=>[x,y],px-50,py-50,px+50,py+50,1);else g.drawImage(this.base!, 0, 0);
    // blips
    const dot = (x: number, y: number, r: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
    for (const b of w.buildings) {
      const col = b.kind === "casino" ? "#f6b62c" : b.kind === "studio" || b.kind === "gallery" ? "#ff7ad9" : b.kind === "police" ? "#3dd6ff" : b.kind === "hospital" ? "#ec2a1c" : b.kind === "mentalhealth" ? "#6fe3b0" : b.kind === "airport" ? "#eee4d3" : b.kind === "dealership" ? "#c6ff3d" : "";
      if (col) dot(b.door.x + 0.5, b.door.y + 0.5, 1.6, col);
    }
    if (p.wanted > 0) for (const c of sim.chars) if (c.role === "cop" && c.inside < 0) dot(c.x, c.y, 1.1, Math.floor(now / 250) % 2 ? "#ec2a1c" : "#3d7bff");
    for (const v of sim.vehicles) if (v.owner === p.id) dot(v.x, v.y, 1.3, "#c6ff3d");
    for (const marker of sim.life.markers) dot(marker.x, marker.y, 1.8, "#86e8bb");
    const mission=missionTarget(sim);if(mission)dot(mission.x,mission.y,3,"#f6b62c");
    if (hasUpgrade(sim.life.upgrades, "nova")) for (const id of sim.life.upgrades.crew) { const c = sim.chars[id]; if (c) dot(c.x, c.y, 1.8, "#bca5ff"); }
    for (const c of this.contacts) dot(c.x, c.y, 2.2, "#b48cff");
    if (this.target) { dot(this.target.x, this.target.y, 2.6, Math.floor(now / 300) % 2 ? "#f6b62c" : "#fff0c0"); }
    g.restore();
    // you: an arrow in the middle (facing), plus north marker and ring
    g.save(); g.translate(R, R); g.rotate(Math.PI / 4 + (p.inCar >= 0 ? sim.vehicles[p.inCar].heading : p.facing) + Math.PI / 2);
    g.fillStyle = "#eee4d3"; g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.restore();
    g.strokeStyle = "rgba(238,228,211,.6)"; g.lineWidth = 2; g.beginPath(); g.arc(R, R, R - 2, 0, 6.283); g.stroke();
    this.radarOverlay(g, W, sim, px, py, scale, now);
    if (this.bigOpen) this.drawBig();
  }

  /** Everything the radar needs to say where you are and which way: all four cardinals (the radar is turned 45 degrees), a view wedge, arrows for off-radar targets and the street you are on. */
  private radarOverlay(g: CanvasRenderingContext2D, W: number, sim: Simulation, px: number, py: number, scale: number, now: number): void {
    const R = W / 2, p = sim.player, heading = p.inCar >= 0 ? sim.vehicles[p.inCar].heading : p.facing, rot = Math.PI / 4;
    const screenOf = (dx: number, dy: number): [number, number] => [(dx * Math.cos(rot) - dy * Math.sin(rot)), (dx * Math.sin(rot) + dy * Math.cos(rot))];
    // the way you are facing
    g.save(); g.translate(R, R); g.rotate(rot + heading + Math.PI / 2); g.fillStyle = "rgba(238,228,211,.14)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 6, -Math.PI / 2 - .45, -Math.PI / 2 + .45); g.closePath(); g.fill(); g.restore();
    // cardinals, each at the true direction
    g.font = "700 10px 'IBM Plex Mono', monospace"; g.textAlign = "center";
    for (const [name, dx, dy, col] of [["N", 0, -1, "#ec5148"], ["E", 1, 0, "#eee4d3"], ["S", 0, 1, "#eee4d3"], ["W", -1, 0, "#eee4d3"]] as const) {
      const [sx, sy] = screenOf(dx, dy), a = Math.atan2(sy, sx); g.fillStyle = "rgba(14,11,10,.8)"; g.beginPath(); g.arc(R + Math.cos(a) * (R - 11), R + Math.sin(a) * (R - 11), 8, 0, 6.283); g.fill();
      g.fillStyle = col; g.fillText(name, R + Math.cos(a) * (R - 11), R + Math.sin(a) * (R - 11) + 3.5);
    }
    // off-radar targets get an arrow on the rim pointing at them
    const targets: { x: number; y: number; c: string }[] = [];
    const mission = missionTarget(sim); if (mission) targets.push({ x: mission.x, y: mission.y, c: "#f6b62c" });
    if (this.target) targets.push({ x: this.target.x, y: this.target.y, c: "#f6b62c" });
    for (const c of this.contacts) targets.push({ x: c.x, y: c.y, c: "#b48cff" });
    for (const m of sim.life.markers.slice(-6)) targets.push({ x: m.x, y: m.y, c: "#86e8bb" });
    for (const t of targets) {
      const [sx, sy] = screenOf(t.x - px, t.y - py), d = Math.hypot(sx, sy) * scale; if (d < R - 16) continue;
      const a = Math.atan2(sy, sx), pulse = 1 + (Math.floor(now / 350) % 2) * .15; g.save(); g.translate(R + Math.cos(a) * (R - 24), R + Math.sin(a) * (R - 24)); g.rotate(a); g.scale(pulse, pulse); g.fillStyle = t.c; g.strokeStyle = "#0e0b0a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, 5); g.lineTo(-4, -5); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // where you are: street and heading, in a small pill at the foot of the radar
    const street = sim.world.streetName(px, py) || "", label = (street ? street.slice(0, 18) + "  " : "") + bearingName(bearingOf(heading));
    g.font = "700 9px 'IBM Plex Mono', monospace"; const tw = g.measureText(label).width + 12; g.fillStyle = "rgba(14,11,10,.82)"; g.beginPath(); g.roundRect(R - tw / 2, W - 24, tw, 14, 7); g.fill(); g.fillStyle = "#eee4d3"; g.fillText(label, R, W - 14);
  }

  /** The big map's own overlay: your arrow and view wedge, a north compass, arrows to anything off the map with its distance, a scale bar and a read-out of where you stand. */
  private decorate(g: CanvasRenderingContext2D, W: number, P: (x: number, y: number) => [number, number], tilePx: number | null): void {
    const sim = this.sim(), p = sim.player, w = sim.world, car = p.inCar >= 0 ? sim.vehicles[p.inCar] : null, x = car ? car.x : p.x, y = car ? car.y : p.y, heading = car ? car.heading : p.facing, [px, py] = P(x, y), mpt = w.mapped?.metresPerTile ?? 0;
    g.save(); g.translate(px, py); g.rotate(heading + Math.PI / 2); g.fillStyle = "rgba(236,81,72,.2)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 80, -Math.PI / 2 - .5, -Math.PI / 2 + .5); g.closePath(); g.fill();
    g.fillStyle = "#ec5148"; g.strokeStyle = "#fff6e6"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    // north compass (every map here is north-up)
    const cx = W - 58, cy = 58; g.save(); g.fillStyle = "rgba(14,11,10,.8)"; g.strokeStyle = "rgba(238,228,211,.6)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 40, 0, 6.283); g.fill(); g.stroke();
    g.font = "700 13px 'IBM Plex Mono', monospace"; g.textAlign = "center"; for (const [n, dx, dy, c] of [["N", 0, -1, "#ec5148"], ["E", 1, 0, "#eee4d3"], ["S", 0, 1, "#eee4d3"], ["W", -1, 0, "#eee4d3"]] as const) { g.fillStyle = c; g.fillText(n, cx + dx * 27, cy + dy * 27 + 4.5); }
    g.fillStyle = "#ec5148"; g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx + 5, cy); g.lineTo(cx - 5, cy); g.closePath(); g.fill(); g.fillStyle = "#eee4d3"; g.beginPath(); g.moveTo(cx, cy + 18); g.lineTo(cx + 5, cy); g.lineTo(cx - 5, cy); g.closePath(); g.fill(); g.restore();
    // arrows to anything that is off the map
    const list: { x: number; y: number; name: string; c: string }[] = [];
    const mission = missionTarget(sim); if (mission) list.push({ x: mission.x, y: mission.y, name: mission.name ?? "Mission", c: "#f6b62c" });
    for (const m of sim.life.markers) list.push({ x: m.x, y: m.y, name: m.name, c: "#86e8bb" });
    g.font = "600 11px system-ui,sans-serif";
    for (const t of list) {
      const q = P(t.x, t.y); if (q[0] > 20 && q[0] < W - 20 && q[1] > 20 && q[1] < W - 20) continue;
      const a = Math.atan2(q[1] - py, q[0] - px), ex = Math.max(26, Math.min(W - 26, q[0])), ey = Math.max(26, Math.min(W - 26, q[1])), m = Math.hypot(t.x - x, t.y - y) * (mpt || 1), dist = mpt ? (m >= 1000 ? (m / 1000).toFixed(1) + " km" : Math.round(m) + " m") : Math.round(m) + " tiles";
      g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = t.c; g.strokeStyle = "#0e0b0a"; g.lineWidth = 2; g.beginPath(); g.moveTo(12, 0); g.lineTo(-7, 8); g.lineTo(-7, -8); g.closePath(); g.fill(); g.stroke(); g.restore();
      const txt = t.name.slice(0, 22) + " · " + dist, tw = g.measureText(txt).width + 10, lx = Math.max(4, Math.min(W - tw - 4, ex - tw / 2)), ly = ey < W / 2 ? ey + 16 : ey - 32; g.fillStyle = "rgba(14,11,10,.85)"; g.fillRect(lx, ly, tw, 17); g.fillStyle = t.c; g.textAlign = "left"; g.fillText(txt, lx + 5, ly + 12.5);
    }
    // scale bar
    if (tilePx && mpt) { const metres = 100, len = metres / mpt * tilePx; g.fillStyle = "#eee4d3"; g.fillRect(24, W - 34, len, 4); g.fillRect(24, W - 40, 2, 16); g.fillRect(24 + len - 2, W - 40, 2, 16); g.font = "700 11px 'IBM Plex Mono', monospace"; g.textAlign = "left"; g.fillText(metres + " m", 24, W - 46); }
    // where you stand
    const street = w.streetName(x, y) || "off the street grid", bear = bearingOf(heading), geo = geoOf(sim, x, y), line = "You: " + street + "  ·  facing " + bearingName(bear) + " " + Math.round(bear) + "°  ·  " + fmtGeo(geo);
    g.font = "700 13px 'IBM Plex Mono', monospace"; g.textAlign = "left"; const tw = g.measureText(line).width + 20; g.fillStyle = "rgba(14,11,10,.88)"; g.beginPath(); g.roundRect(W / 2 - tw / 2, W - 40, tw, 28, 14); g.fill(); g.fillStyle = "#eee4d3"; g.fillText(line, W / 2 - tw / 2 + 10, W - 21);
  }

  private bindMap(cv: HTMLCanvasElement): void {
    const head = this.big.querySelector(".bigmap-head") as HTMLElement, btn = (t: string, label: string, fn: () => void) => h("button.btn", { text: t, "aria-label": label, onclick: () => { fn(); this.drawBig(); } });
    const ctl = h("div.bigmap-ctl", { style: "display:flex;gap:6px;align-items:center" }, [btn("＋", "Zoom in", () => { this.zoom = Math.min(8, this.zoom * 1.5); }), btn("－", "Zoom out", () => { this.zoom = Math.max(.4, this.zoom / 1.5); }), btn("Recentre", "Recentre on me and follow", () => { this.view = null; this.zoom = 1; this.picked = null; }),
      btn("Pin selected", "Pin the selected spot", () => { const sim = this.sim(); if (this.picked && sim.life.markers.filter(m => m.icon === "●").length < 20) { sim.life.markers.push({ x: this.picked.x, y: this.picked.y, name: sim.world.streetName(this.picked.x, this.picked.y) || "My pin", icon: "●" }); this.picked = null; } })]);
    head.insertBefore(ctl, head.querySelector(".x"));
    const at = (e: PointerEvent | WheelEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    let drag: { x: number; y: number; vx: number; vy: number; moved: number } | null = null; cv.style.cursor = "grab"; cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", (e) => { const sim = this.sim(), p = sim.player, [x, y] = at(e); drag = { x, y, vx: this.view?.x ?? p.x, vy: this.view?.y ?? p.y, moved: 0 }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", (e) => {
      const [x, y] = at(e);
      if (drag) { const k = cv.width / (600 / this.zoom * 2); drag.moved = Math.max(drag.moved, Math.hypot(x - drag.x, y - drag.y)); if (drag.moved > 5) { this.view = { x: drag.vx - (x - drag.x) / k, y: drag.vy - (y - drag.y) / k }; this.drawBig(); } return; }
      if (this.inv && performance.now() - this.lastHover > 60) { this.lastHover = performance.now(); const [wx, wy] = this.inv(x, y); this.hover = { x: wx, y: wy }; this.drawBig(); }
    });
    cv.addEventListener("pointerup", (e) => { cv.style.cursor = "grab"; if (drag && drag.moved <= 5 && this.inv) { const [x, y] = at(e), [wx, wy] = this.inv(x, y); this.picked = { x: wx, y: wy }; this.drawBig(); } drag = null; });
    cv.addEventListener("pointerleave", () => { this.hover = null; });
    cv.addEventListener("dblclick", () => { this.view = null; this.zoom = 1; this.drawBig(); });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault(); if (!this.inv) return; const [x, y] = at(e), [wx, wy] = this.inv(x, y), old = this.zoom; this.zoom = Math.max(.4, Math.min(8, this.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      // keep the spot under the cursor where it is, so zooming feels anchored
      const sim = this.sim(), p = sim.player, cx = this.view?.x ?? p.x, cy = this.view?.y ?? p.y, r = this.zoom / old; this.view = { x: wx - (wx - cx) / r, y: wy - (wy - cy) / r }; this.drawBig();
    }, { passive: false });
  }

  /** Street names along the roads, only where there is room to read them. */
  private drawStreetNames(g: CanvasRenderingContext2D, P: (x: number, y: number) => [number, number], x0: number, y0: number, x1: number, y1: number, scale: number): void {
    const w = this.sim().world, m = w.mapped!, index = worldIndex(w), placed: [string, number, number][] = []; let n = 0;
    g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    for (const i of index.roads.query(x0, y0, x1, y1)) {
      const s = m.streetSegments[i]; if (!s.name || s.length * scale < 80 || n > 70) continue;
      const a = P(s.x + s.dx * s.length * .5, s.y + s.dy * s.length * .5); if (a[0] < 30 || a[0] > 870 || a[1] < 30 || a[1] > 870) continue;
      if (placed.some(([nm, px, py]) => nm === s.name && Math.hypot(px - a[0], py - a[1]) < 260)) continue; placed.push([s.name, a[0], a[1]]); n++;
      let ang = Math.atan2(s.dy, s.dx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      g.save(); g.translate(a[0], a[1]); g.rotate(ang); g.lineWidth = 4; g.strokeStyle = "rgba(14,11,10,.9)"; g.strokeText(s.name, 0, 0); g.fillStyle = "#f1ead9"; g.fillText(s.name, 0, 0); g.restore();
    }
    g.textBaseline = "alphabetic";
  }

  /** The spot you clicked (or are hovering): where it is, how far and which way. */
  private drawPicked(g: CanvasRenderingContext2D, W: number, P: (x: number, y: number) => [number, number]): void {
    const sim = this.sim(), p = sim.player, mpt = sim.world.mapped?.metresPerTile || 1, tag = (pt: { x: number; y: number }, solid: boolean) => {
      const dx = pt.x - p.x, dy = pt.y - p.y, metres = Math.hypot(dx, dy) * mpt, dir = bearingName(bearingOf(Math.atan2(dy, dx))), street = sim.world.streetName(pt.x, pt.y) || "no street", txt = street + "  ·  " + (metres >= 1000 ? (metres / 1000).toFixed(1) + " km " : Math.round(metres) + " m ") + dir;
      const [qx, qy] = P(pt.x, pt.y); if (solid) { g.strokeStyle = "#f6b62c"; g.lineWidth = 3; g.beginPath(); g.arc(qx, qy, 12, 0, 6.283); g.moveTo(qx - 18, qy); g.lineTo(qx + 18, qy); g.moveTo(qx, qy - 18); g.lineTo(qx, qy + 18); g.stroke(); }
      g.font = "700 12px 'IBM Plex Mono', monospace"; g.textAlign = "left"; const tw = g.measureText(txt).width + 14, lx = Math.max(6, Math.min(W - tw - 6, qx + 16)), ly = Math.max(6, Math.min(W - 90, qy - 34)); g.fillStyle = "rgba(14,11,10,.9)"; g.beginPath(); g.roundRect(lx, ly, tw, 22, 6); g.fill(); g.strokeStyle = solid ? "#f6b62c" : "rgba(238,228,211,.4)"; g.lineWidth = 1.5; g.stroke(); g.fillStyle = solid ? "#f6b62c" : "#eee4d3"; g.fillText(txt, lx + 7, ly + 15);
    };
    if (this.hover && !this.picked) tag(this.hover, false); if (this.picked) tag(this.picked, true);
  }

  toggle(force?: boolean): void {
    this.bigOpen = force ?? !this.bigOpen;
    this.big.classList.toggle("hidden", !this.bigOpen);
    if (this.bigOpen) { this.loadOsm(); this.drawBig(); }
  }

  /** Real street data via the site's Cloudflare function (cached at the edge); silent fallback. */
  private loadOsm(): void {
    if(this.sim().world.mapped)return;
    if (this.osmTried) return;
    this.osmTried = true;
    fetch("/api/chch-map").then((r) => (r.ok ? r.json() : null)).then((d: OsmData | null) => { if (d && Array.isArray(d.ways) && d.ways.length) { this.osm = d; if (this.bigOpen) this.drawBig(); } }).catch(() => {});
  }

  private drawBig(): void {
    const sim = this.sim(), w = sim.world, p = sim.player;
    let cv = this.big.querySelector("canvas") as HTMLCanvasElement | null;
    if (!cv) {
      cv = h("canvas", { width: 900, height: 900 }) as HTMLCanvasElement;
      this.big.append(h("div.bigmap-head", null, [h("b", { text: "Central Christchurch" }),
        h("button.btn",{text:"Address / teleport",onclick:()=>this.findAddress?.()}),
        h("button.btn", { text: "Pin my location", onclick: () => { if (sim.life.markers.filter(m => m.icon === "●").length >= 20) return; sim.life.markers.push({ x: p.x, y: p.y, name: sim.world.streetName(p.x, p.y) || "My pin", icon: "●" }); this.drawBig(); } }),
        h("button.btn", { text: "Clear my pins", onclick: () => { sim.life.markers = sim.life.markers.filter(m => m.icon !== "●"); this.drawBig(); } }), h("button.x", { "aria-label": "Close map", onclick: () => this.toggle(false), text: "×" })]), cv, h("p.bigmap-foot"));
    }
    if (!this.bound) { this.bound = true; this.bindMap(cv); }
    const g = cv.getContext("2d")!, W = cv.width;
    g.fillStyle = "#0e0b0a"; g.fillRect(0, 0, W, W);
    const foot = this.big.querySelector(".bigmap-foot") as HTMLElement;
    if(w.mapped){
      const radius=300/this.zoom,cx=this.view?this.view.x:p.x,cy=this.view?this.view.y:p.y,scale=W/(radius*2),P=(x:number,y:number):[number,number]=>[(x-cx+radius)*scale,(y-cy+radius)*scale];
      this.inv=(px:number,py:number):[number,number]=>[px/scale+cx-radius,py/scale+cy-radius];
      this.drawSurvey(g,P,cx-radius,cy-radius,cx+radius,cy+radius,scale);this.drawStreetNames(g,P,cx-radius,cy-radius,cx+radius,cy+radius,scale);
      g.font='12px system-ui';for(const pin of [...sim.life.markers,...(missionTarget(sim)?[missionTarget(sim)!]:[])]){const q=P(pin.x,pin.y);g.fillStyle='#86e8bb';g.beginPath();g.arc(...q,4,0,Math.PI*2);g.fill();g.fillText(pin.name,q[0],q[1]-8);}
      this.decorate(g,W,P,scale);this.drawPicked(g,W,P);
      foot.textContent=(this.view?'Panned · press Recentre to follow you · ':'Map follows you · ')+'Christchurch · '+Math.round(radius*2*(w.mapped.metresPerTile||1))+' m across · drag to pan, wheel to zoom, click a spot to inspect it · © OpenStreetMap contributors, ODbL 1.0 · new districts load as you explore.';
    }else if (this.osm) {
      // project the real lat/lon box of the Four Avenues onto the canvas
      const lon0 = LON[0] - 0.002, lon1 = LON[LON.length - 1] + 0.003, lat0 = LAT[0] + 0.002, lat1 = LAT[LAT.length - 1] - 0.002;
      const kx = W / (lon1 - lon0), ky = W / (lat1 - lat0) * 0.72;
      const P = (lat: number, lon: number) => [(lon - lon0) * kx, (lat - lat0) * ky + W * 0.12];
      for (const way of this.osm.ways) {
        g.strokeStyle = way.k === "water" ? "#1d6a8a" : way.k === "park" ? "#2d4a24" : way.k === "building" ? "#3a3430" : way.k === "major" ? "#eee4d3" : "#8a8580";
        g.fillStyle = way.k === "park" ? "#1d2a18" : way.k === "building" ? "#2a2622" : "transparent";
        g.lineWidth = way.k === "major" ? 3 : way.k === "water" ? 4 : 1.2;
        g.beginPath(); way.p.forEach(([la, lo], i) => { const q = P(la, lo); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
        if (way.k === "park" || way.k === "building") g.fill(); else g.stroke();
      }
      const me = toLatLon(p.x, p.y), q = P(me.lat, me.lon);
      g.fillStyle = "#ec2a1c"; g.beginPath(); g.arc(q[0], q[1], 8, 0, 6.283); g.fill();
      g.strokeStyle = "#eee4d3"; g.lineWidth = 2; g.stroke();
      for (const marker of [...sim.life.markers,...(missionTarget(sim)?[missionTarget(sim)!]:[])]) {
        const location = toLatLon(marker.x, marker.y), xy = P(location.lat, location.lon);
        g.fillStyle = "#86e8bb"; g.beginPath(); g.arc(xy[0], xy[1], 5, 0, Math.PI * 2); g.fill(); g.font = "11px monospace"; g.fillText(marker.name, xy[0], xy[1] - 10);
      }
      this.decorate(g, W, (x, y) => { const l = toLatLon(x, y), q = P(l.lat, l.lon); return [q[0], q[1]]; }, null);
      foot.textContent = this.osm.attribution;
    } else {
      // offline: the game's own map of the same streets
      const k = W / w.size;
      g.imageSmoothingEnabled = false;
      if (!this.base) this.base = this.buildBase();
      g.drawImage(this.base!, 0, 0, W, W);
      g.fillStyle = "#eee4d3"; g.font = "700 13px 'IBM Plex Mono', monospace"; g.textAlign = "center";
      w.streetsX.forEach((n, i) => { g.save(); g.translate(i * w.period * k + 2 * k, W / 2); g.rotate(-Math.PI / 2); g.fillText(n, 0, -4); g.restore(); });
      w.streetsY.forEach((n, i) => g.fillText(n, W / 2, i * w.period * k + 2 * k - 4));
      g.font = "600 11px 'IBM Plex Mono', monospace"; g.fillStyle = "rgba(198,255,61,.9)";
      for (const a of w.areas) if (a.kind !== "street") g.fillText(a.name, a.cx * k, a.cy * k);
      for (const marker of sim.life.markers) { g.fillStyle = "#86e8bb"; g.beginPath(); g.arc(marker.x * k, marker.y * k, 5, 0, Math.PI * 2); g.fill(); g.fillText(marker.name, marker.x * k, marker.y * k - 10); }
      this.decorate(g, W, (x, y) => [x * k, y * k], null);
      foot.textContent = w.mapped?"The same playable Christchurch world · surveyed OpenStreetMap roads and building footprints · © OpenStreetMap contributors, ODbL 1.0 · missing facade details are estimates.":"Street layout after OpenStreetMap (© OpenStreetMap contributors, ODbL), simplified to the city grid.";
    }
  }
  private drawSurvey(g:CanvasRenderingContext2D,P:(x:number,y:number)=>[number,number],x0:number,y0:number,x1:number,y1:number,scale:number){
    const w=this.sim().world,m=w.mapped!,index=worldIndex(w);
    for(const i of index.roads.query(x0,y0,x1,y1)){const s=m.streetSegments[i];g.strokeStyle='#88867b';g.lineWidth=(s.half*2+1)*scale;g.beginPath();g.moveTo(...P(s.x,s.y));g.lineTo(...P(s.x+s.dx*s.length,s.y+s.dy*s.length));g.stroke();g.strokeStyle='#333c3a';g.lineWidth=s.half*2*scale;g.stroke();}
    g.fillStyle='#77776a';for(const id of index.buildings.query(x0,y0,x1,y1)){const b=m.byBuilding.get(id);if(!b)continue;g.beginPath();b.points.forEach((p,i)=>{const q=P(p[0]/2+m.offsetX,p[1]/2+m.offsetY);if(i)g.lineTo(...q);else g.moveTo(...q);});g.closePath();g.fill();}
  }
}
