import type { Vehicle } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { handlingProfile } from "../sim/VehicleHandling";
import { installed, tuningEffects } from "../sim/VehicleTuning";
import { VEHICLES } from "../content/vehicles";
import { vehicleCondition } from "../sim/VehicleCondition";

/**
 * The damage readout, drawn as the actual kind of vehicle you are in: a top-down outline (front at the top) with the right
 * overall proportions for a sedan, hatch, coupe, SUV, ute, van, bus or bike, and the front, rear, left and right panels and
 * the four wheels coloured by how damaged they are.
 */
type Kind = "sedan" | "hatch" | "suv" | "pickup" | "van" | "bus" | "coupe" | "bike";
/** [distance from the nose 0..1, half-width as a fraction of the full body width] */
const PROFILE: Record<Kind, [number, number][]> = {
  sedan: [[0, .62], [.05, .8], [.15, .9], [.3, .96], [.5, 1], [.72, .98], [.86, .94], [.95, .84], [1, .66]],
  hatch: [[0, .64], [.07, .82], [.2, .92], [.4, 1], [.7, 1], [.9, .96], [1, .8]],
  suv: [[0, .74], [.05, .9], [.12, .96], [.5, 1], [.92, .99], [1, .88]],
  pickup: [[0, .7], [.06, .88], [.2, .96], [.5, .98], [.97, .98], [1, .92]],
  van: [[0, .72], [.05, .9], [.12, .98], [.5, 1], [1, .96]],
  bus: [[0, .82], [.03, .96], [.5, 1], [1, .98]],
  coupe: [[0, .5], [.1, .76], [.25, .92], [.45, 1], [.7, .98], [.88, .9], [1, .66]],
  bike: [[0, .5], [.2, 1], [.8, 1], [1, .5]],
};
/** Glass (windscreen and windows) as [from, to] along the body, per kind. */
const GLASS: Record<Kind, [number, number] | null> = { sedan: [.3, .62], hatch: [.3, .8], suv: [.26, .76], pickup: [.2, .42], van: [.08, .3], bus: [.03, .1], coupe: [.34, .62], bike: null };

function kindOf(v: Vehicle): Kind {
  const d = VEHICLES[v.cls], base = String(d?.design?.base ?? v.cls).toLowerCase();
  if (/bike|cruiser|motor|scooter|moped/.test(base) || /bike|cruiser|motor|moped/.test(String(v.cls))) return "bike";
  if (/bus|coach|truck|flatdeck|lorry|tractor/.test(base)) return /flatdeck|ute/.test(base) ? "pickup" : "bus";
  if (/van|stepvan|panel/.test(base)) return "van";
  if (/pickup|tradie|ute/.test(base)) return "pickup";
  if (/suv|fourby|crossover|wagon|4x4/.test(base)) return "suv";
  if (/coupe|roadster|super|sport|fastback|racer/.test(base)) return "coupe";
  if (/hatch|micro|ev|compact(?!_sedan)/.test(base)) return "hatch";
  return "sedan";
}

const col = (n: number) => (n >= 0.7 ? "#df7065" : n >= 0.25 ? "#d7ad5c" : "#7db995");
const NS = "http://www.w3.org/2000/svg";
const el = (name: string, attrs: Record<string, string | number>, parent?: Element): SVGElement => { const e = document.createElementNS(NS, name); for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val)); parent?.appendChild(e); return e as SVGElement; };

export function carDiagram(v: Vehicle, sim?: Simulation): HTMLElement {
  const c = vehicleCondition(v), kind = kindOf(v), d = VEHICLES[v.cls];
  // real proportions, fitted into a 46 x (up to 86) box
  const ratio = Math.max(1.4, Math.min(kind === "bike" ? 3.4 : 2.9, (d?.length ?? 2.2) / Math.max(0.2, d?.width ?? 1)));
  const W = kind === "bike" ? 14 : 34, H = Math.round(Math.min(84, Math.max(46, W * ratio * (kind === "bike" ? 1 : 0.92)))), pad = 6, vw = W + pad * 2;
  const svg = el("svg", { viewBox: `0 0 ${vw + 28} ${H + 4}`, width: vw + 28, height: H + 4, class: "car-diagram" + (c.worst >= 0.7 ? " critical" : ""), role: "img", "aria-label": `Vehicle condition: ${c.worst >= 0.7 ? "critical" : c.worst >= 0.25 ? "damaged" : "healthy"}` });
  const dyn = v.dynamics, wd = (i: number) => dyn?.wheels[i];
  const drive = (sim ? tuningEffects(sim, v).drive : "") || handlingProfile(v.cls).drive, driven = (i: number) => drive === "awd" || (drive === "fwd" ? i < 2 : i >= 2);
  const left = (f: number) => vw / 2 - (W / 2) * f, right = (f: number) => vw / 2 + (W / 2) * f;
  const prof = PROFILE[kind], pts = [...prof.map(([y, w]) => [left(w), 2 + y * H]), ...[...prof].reverse().map(([y, w]) => [right(w), 2 + y * H])];
  const body = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ") + "Z";
  const defs = el("defs", {}, svg), clip = el("clipPath", { id: "cd-" + kind }, defs); el("path", { d: body }, clip);
  // wheels first, so the body sits over their inner edge
  const wy = [2 + H * 0.2, 2 + H * 0.78], wx = [left(prof[Math.floor(prof.length / 2)][1]) - 1.4, right(prof[Math.floor(prof.length / 2)][1]) + 1.4];
  const wheelH = Math.max(7, H * 0.17), wheelW = kind === "bike" ? 4 : 3.2;
  if (kind === "bike") { el("rect", { x: vw / 2 - 2, y: 2, width: 4, height: wheelH, rx: 1.6, fill: col(c.wheels[0]) }, svg); el("rect", { x: vw / 2 - 2, y: H + 2 - wheelH, width: 4, height: wheelH, rx: 1.6, fill: col(c.wheels[2]) }, svg); }
  else [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([sx, sy], i) => {
    const w = wd(i), x = wx[sx] - (sx ? 0 : wheelW), y = wy[sy] - wheelH / 2, hot = (w?.temperature ?? 0) > 0.75, soft = (w?.pressure ?? 1) < 0.7, brk = (w?.brakeHeat ?? 0) > 0.7;
    const r = el("rect", { x, y, width: wheelW, height: wheelH, rx: 1.2, fill: col(c.wheels[i]), stroke: brk ? "#ff5a3c" : soft ? "#7aa7ff" : hot ? "#ffb347" : driven(i) ? "#e9e6e1" : "none", "stroke-width": brk || soft || hot ? 1.1 : 0.6 }, svg);
    el("title", {}, r).textContent = `${["Front left", "Front right", "Rear left", "Rear right"][i]} tyre: ${Math.round(c.wheels[i] * 100)}% damaged, pressure ${Math.round((w?.pressure ?? 1) * 100)}%, wear ${Math.round((w?.wear ?? 0) * 100)}%, temperature ${Math.round((w?.temperature ?? 0.4) * 100)}%${driven(i) ? ", driven wheel" : ""}`;
    el("rect", { x: x + wheelW * 0.2, y: y + wheelH * (1 - Math.min(1, w?.wear ?? 0)), width: wheelW * 0.6, height: wheelH * Math.min(1, w?.wear ?? 0), fill: "#000", opacity: 0.45 }, svg);   // tread worn away
    if ((v.wheelspin ?? 0) > 0.4 && driven(i)) el("rect", { x: x - 1, y: y - 1, width: wheelW + 2, height: wheelH + 2, rx: 1.6, fill: "none", stroke: "#ff3b3b", "stroke-width": 0.8, class: "cd-spin" }, svg);   // spinning up
  });
  el("path", { d: body, fill: "#2a2626", stroke: "#8f8782", "stroke-width": 1.1, "stroke-linejoin": "round" }, svg);
  const zones = el("g", { "clip-path": `url(#cd-${kind})` }, svg), top = 2, bottom = 2 + H;
  const zone = (x: number, y: number, w: number, h: number, n: number) => el("rect", { x, y, width: w, height: h, fill: col(n), opacity: 0.92 }, zones);
  if (kind === "bike") { zone(0, top, vw, H * 0.5, Math.max(c.zones[0], c.zones[1], c.zones[2])); zone(0, top + H * 0.5, vw, H * 0.5, c.zones[3]); }
  else {
    zone(0, top, vw, H * 0.26, c.zones[0]);                              // front
    zone(0, bottom - H * 0.24, vw, H * 0.24, c.zones[3]);                // rear
    zone(0, top + H * 0.26, vw * 0.5 - W * 0.22, H * 0.5, c.zones[1]);   // left
    zone(vw * 0.5 + W * 0.22, top + H * 0.26, vw, H * 0.5, c.zones[2]);  // right
  }
  const g = GLASS[kind];
  if (g) el("rect", { x: left(0.72), y: top + g[0] * H, width: W * 0.72, height: (g[1] - g[0]) * H, rx: 2.2, fill: "#1b2a33", opacity: 0.85, stroke: "#0d1418", "stroke-width": 0.6 }, svg);
  if (kind === "pickup") el("rect", { x: left(0.78), y: top + H * 0.46, width: W * 0.78, height: H * 0.5, rx: 1, fill: "none", stroke: "#0d1418", "stroke-width": 1, opacity: 0.8 }, svg);   // the open tray
  // side gauges: engine temperature, oil, coolant, brake fade
  const gx = vw + 4, gauges: [string, number, string, boolean][] = [["T", c.temperature, "Engine temperature", true], ["O", c.oil, "Oil level", false], ["C", c.coolant, "Coolant level", false], ["B", 1 - Math.min(1, dyn?.brakeFade ?? 0), "Brake condition (fade)", false]];
  gauges.forEach(([lab, val, title, hotBad], i) => {
    const gy = 4 + i * ((H - 8) / 4), gh = (H - 8) / 4 - 3, bad = hotBad ? val > 0.75 : val < 0.3, mid = hotBad ? val > 0.5 : val < 0.55;
    const g = el("g", {}, svg); el("title", {}, g).textContent = `${title}: ${Math.round(val * 100)}%`;
    el("rect", { x: gx, y: gy, width: 8, height: gh, rx: 1.5, fill: "#1b1818", stroke: "#4a4040", "stroke-width": 0.5 }, g);
    el("rect", { x: gx, y: gy + gh * (1 - Math.min(1, Math.max(0, val))), width: 8, height: gh * Math.min(1, Math.max(0, val)), rx: 1.5, fill: bad ? "#df7065" : mid ? "#d7ad5c" : "#7db995" }, g);
    const t = el("text", { x: gx + 12, y: gy + gh * 0.75, "font-size": 6, fill: "#a89f98" }, g); t.textContent = lab;
  });
  // engine, gearbox and fire
  const ey = 2 + H * 0.12, eng = el("rect", { x: vw / 2 - W * 0.2, y: ey, width: W * 0.4, height: H * 0.11, rx: 2, fill: col(c.engine), stroke: "#0d0d0d", "stroke-width": 0.5 }, svg); el("title", {}, eng).textContent = `Engine ${Math.round(c.engine * 100)}% damaged`;
  if (c.gearbox > 0.05) { const gb = el("rect", { x: vw / 2 - 3, y: 2 + H * 0.5, width: 6, height: 7, rx: 1, fill: col(c.gearbox), stroke: "#0d0d0d", "stroke-width": 0.4 }, svg); el("title", {}, gb).textContent = `Gearbox ${Math.round(c.gearbox * 100)}% damaged`; }
  if (v.burning || v.burnt) { const fl = el("path", { d: `M${vw / 2} ${ey - 1} q-4 -6 0 -10 q1 4 4 3 q1 4 -4 7z`, fill: v.burnt ? "#444" : "#ff7a2b", class: "cd-fire" }, svg); el("title", {}, fl).textContent = v.burnt ? "Burnt out" : "On fire"; }
  // weight transfer: a ball that slides with cornering and braking load
  const lx = Math.max(-1, Math.min(1, (dyn?.lateralLoad ?? 0))), ly = Math.max(-1, Math.min(1, (dyn?.longitudinalLoad ?? 0)));
  const gb2 = el("circle", { cx: vw / 2 + lx * W * 0.28, cy: 2 + H * 0.5 + ly * H * 0.12, r: 2, fill: "#f6f4f3", opacity: 0.85 }, svg); el("title", {}, gb2).textContent = "Weight transfer";
  // drivetrain and fitted upgrades
  const badge = el("text", { x: vw / 2, y: H + 3, "text-anchor": "middle", "font-size": 6.5, fill: "#cfc8c1", "font-weight": 700 }, svg);
  badge.textContent = drive.toUpperCase() + (sim && installed(sim, v).length ? ` ★${installed(sim, v).length}` : "");
  const wrap = document.createElement("span"); wrap.className = "car-diagram-wrap"; wrap.setAttribute("title", c.forecast + (c.issues.length ? "  Damaged: " + c.issues.slice(0, 4).map((i) => i.name).join(", ") : "")); wrap.appendChild(svg);
  return wrap;
}
