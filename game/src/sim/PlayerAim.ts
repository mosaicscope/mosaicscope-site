import type { Character } from "../entities/types";
import type { Simulation } from "./Simulation";
import { TOYS } from "../content/toys";
import { AimSystem, WEAPONS, type Vec3, type WorldAdapter } from "../engines/aim";

/**
 * The aim engine (engines/aim.ts) as the player's gun hand. The game keeps its own bullets, wounds and ammo; the aim engine
 * decides WHERE the shot goes: hand sway, spread that grows with movement and fire, recoil climb, aiming down sights,
 * a held breath, and a little crosswind drift. Hold the right mouse button to aim down sights, hold Ctrl to steady your breath.
 * A reticle that shows the real spread, plus an ammo and breath readout, is drawn over the game while a gun is in hand.
 * The aim engine's own projectiles are never allowed to hit anything (the adapter has no targets), so nothing is damaged twice.
 */
const M = 2;
interface Rt { aim: AimSystem; aimX: number; aimZ: number; muzzle: Vec3; fired: Vec3 | null; mx: number; my: number; ads: boolean; breath: boolean; cv: HTMLCanvasElement | null; ctx: CanvasRenderingContext2D | null; wired: boolean; sim: Simulation }
const rts = new WeakMap<Simulation, Rt>();

function runtime(sim: Simulation): Rt {
  let rt = rts.get(sim);
  if (rt) return rt;
  const made: Rt = { aim: null as unknown as AimSystem, aimX: 0, aimZ: 0, muzzle: { x: 0, y: 1.4, z: 0 }, fired: null, mx: 0, my: 0, ads: false, breath: false, cv: null, ctx: null, wired: false, sim };
  const scale = () => Math.max(8, (typeof window !== "undefined" ? window.innerHeight : 800) / 40);   // rough pixels per metre for the reticle size
  const adapter: WorldAdapter = {
    raycast: () => null, targets: () => [],
    screenRay: () => ({ origin: { x: made.aimX, y: 20, z: made.aimZ }, dir: { x: 0, y: -1, z: 0 } }),
    worldToScreen: (p) => ({ x: made.mx + (p.x - made.aimX) * scale(), y: made.my + (p.z - made.aimZ) * scale() }),
    viewSize: () => ({ w: typeof window !== "undefined" ? window.innerWidth : 800, h: typeof window !== "undefined" ? window.innerHeight : 600 }),
  };
  made.aim = new AimSystem(adapter, { onFire: (_w, _m, dir) => { made.fired = dir; } });
  made.aim.setMuzzle(() => made.muzzle);
  rts.set(sim, made);
  return made;
}

const heldGun = (sim: Simulation, c: Character): string | null => { if (c.hand < 0) return null; const def = sim.toys[c.hand]?.def; return def && TOYS[def]?.weapon?.gun ? def : null; };

/** The direction the player's shot actually takes, as a game-space angle; undefined means "fire straight at the point". */
export function playerShot(_sim: Simulation, _c: Character, _def: string, _tx: number, _ty: number): number | undefined {
  return undefined;   // shots go exactly where the crosshair is: no sway, spread or drift
}

export function updatePlayerAim(sim: Simulation): void {
  const rt = runtime(sim), p = sim.player;
  if (typeof window !== "undefined" && !rt.wired) wire(rt);
  const def = heldGun(sim, p);
  rt.aim.setMotion(Math.hypot(p.vx, p.vy) * M, false);
  rt.aim.update(1 / 60);   // sway keeps drifting and bloom settles while you hold the gun
  if (rt.cv) draw(rt, def);
}

function wire(rt: Rt): void {
  rt.wired = true;
  const cv = document.createElement("canvas");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:40";
  document.body.appendChild(cv); rt.cv = cv; rt.ctx = cv.getContext("2d");
  const gun = () => heldGun(rt.sim, rt.sim.player) !== null;
  window.addEventListener("pointermove", (e) => { rt.mx = e.clientX; rt.my = e.clientY; });
  window.addEventListener("pointerdown", (e) => { if (e.button === 2 && gun()) rt.ads = true; });
  window.addEventListener("pointerup", (e) => { if (e.button === 2) rt.ads = false; });
  window.addEventListener("contextmenu", (e) => { if (gun()) e.preventDefault(); });
  window.addEventListener("keydown", (e) => { if (e.key === "Control") rt.breath = true; });
  window.addEventListener("keyup", (e) => { if (e.key === "Control") rt.breath = false; });
  window.addEventListener("blur", () => { rt.ads = false; rt.breath = false; });
}

function draw(rt: Rt, def: string | null): void {
  const cv = rt.cv!, g = rt.ctx; if (!g) return;
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const world = document.getElementById("world");
  // only while aiming at the world itself: any menu, panel or dialog under the pointer hides it, and it never shows on touch screens
  const over = !!def && rt.sim.player.inside < 0 && !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) && document.elementFromPoint(rt.mx, rt.my) === world;
  if (world) world.style.cursor = over ? "none" : "";
  if (!over) return;
  const x = rt.mx, y = rt.my, r = rt.ads ? 7 : 10;
  g.lineCap = "round";
  for (const [w2, col] of [[4, "rgba(0,0,0,.55)"], [2, "#fff"]] as [number, string][]) {
    g.lineWidth = w2; g.strokeStyle = col; g.beginPath();
    g.moveTo(x - r - 6, y); g.lineTo(x - 4, y); g.moveTo(x + 4, y); g.lineTo(x + r + 6, y); g.moveTo(x, y - r - 6); g.lineTo(x, y - 4); g.moveTo(x, y + 4); g.lineTo(x, y + r + 6); g.stroke();
  }
  g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fill();
  const ammo = rt.sim.player.combat?.ammo?.[def === "golden_pistol" ? "pistol" : def!];
  if (ammo !== undefined) { g.font = "600 11px system-ui"; g.fillStyle = "rgba(255,255,255,.85)"; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 3; g.strokeText(String(ammo), x + r + 10, y + r + 14); g.fillText(String(ammo), x + r + 10, y + r + 14); }
}

export { WEAPONS };
