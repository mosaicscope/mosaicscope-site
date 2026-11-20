import {missionTarget} from '../sim/CityMissions';
import { hasUpgrade } from "../content/upgrades";
import type { Simulation } from "../sim/Simulation";
import { T } from "../world/World";
import { h } from "./dom";
import {worldIndex} from '../world/WorldIndex';

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
    g.fillStyle = "#eee4d3"; g.font = "700 10px 'IBM Plex Mono', monospace"; g.textAlign = "center";
    const nx = R + Math.cos(-Math.PI / 4 - Math.PI / 2) * (R - 10), ny = R + Math.sin(-Math.PI / 4 - Math.PI / 2) * (R - 10);
    g.fillText("N", nx, ny + 3);
    if (this.bigOpen) this.drawBig();
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
    const g = cv.getContext("2d")!, W = cv.width;
    g.fillStyle = "#0e0b0a"; g.fillRect(0, 0, W, W);
    const foot = this.big.querySelector(".bigmap-foot") as HTMLElement;
    if(w.mapped){
      const radius=300,scale=W/(radius*2),P=(x:number,y:number):[number,number]=>[(x-p.x+radius)*scale,(y-p.y+radius)*scale];
      this.drawSurvey(g,P,p.x-radius,p.y-radius,p.x+radius,p.y+radius,scale);
      g.fillStyle='#ec5148';g.beginPath();g.arc(W/2,W/2,7,0,Math.PI*2);g.fill();
      g.font='12px system-ui';for(const pin of [...sim.life.markers,...(missionTarget(sim)?[missionTarget(sim)!]:[])]){const q=P(pin.x,pin.y);g.fillStyle='#86e8bb';g.beginPath();g.arc(...q,4,0,Math.PI*2);g.fill();g.fillText(pin.name,q[0],q[1]-8);}
      foot.textContent='Christchurch · map follows you · 1.2 km across · © OpenStreetMap contributors, ODbL 1.0 · new districts load as you explore.';
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
      g.fillStyle = "#ec2a1c"; g.beginPath(); g.arc(p.x * k, p.y * k, 7, 0, 6.283); g.fill(); g.strokeStyle = "#eee4d3"; g.lineWidth = 2; g.stroke();
      for (const marker of sim.life.markers) { g.fillStyle = "#86e8bb"; g.beginPath(); g.arc(marker.x * k, marker.y * k, 5, 0, Math.PI * 2); g.fill(); g.fillText(marker.name, marker.x * k, marker.y * k - 10); }
      foot.textContent = w.mapped?"The same playable Christchurch world · surveyed OpenStreetMap roads and building footprints · © OpenStreetMap contributors, ODbL 1.0 · missing facade details are estimates.":"Street layout after OpenStreetMap (© OpenStreetMap contributors, ODbL), simplified to the city grid.";
    }
  }
  private drawSurvey(g:CanvasRenderingContext2D,P:(x:number,y:number)=>[number,number],x0:number,y0:number,x1:number,y1:number,scale:number){
    const w=this.sim().world,m=w.mapped!,index=worldIndex(w);
    for(const i of index.roads.query(x0,y0,x1,y1)){const s=m.streetSegments[i];g.strokeStyle='#88867b';g.lineWidth=(s.half*2+1)*scale;g.beginPath();g.moveTo(...P(s.x,s.y));g.lineTo(...P(s.x+s.dx*s.length,s.y+s.dy*s.length));g.stroke();g.strokeStyle='#333c3a';g.lineWidth=s.half*2*scale;g.stroke();}
    g.fillStyle='#77776a';for(const id of index.buildings.query(x0,y0,x1,y1)){const b=m.byBuilding.get(id);if(!b)continue;g.beginPath();b.points.forEach((p,i)=>{const q=P(p[0]/2+m.offsetX,p[1]/2+m.offsetY);if(i)g.lineTo(...q);else g.moveTo(...q);});g.closePath();g.fill();}
  }
}
