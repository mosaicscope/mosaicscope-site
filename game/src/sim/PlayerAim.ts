import type { Character } from "../entities/types";
import type { Simulation } from "./Simulation";
import { TOYS } from "../content/toys";
import { AimSystem, WEAPONS, drawHud, drawReticle, type Vec3, type WorldAdapter } from "../engines/aim";
import { worldContext } from "./Ambient";

/**
 * The aim engine (engines/aim.ts) as the player's gun hand. The game keeps its own bullets, wounds and ammo; the aim engine
 * decides WHERE the shot goes: hand sway, spread that grows with movement and fire, recoil climb, aiming down sights,
 * a held breath, and a little crosswind drift. Hold the right mouse button to aim down sights, hold Ctrl to steady your breath.
 * A reticle that shows the real spread, plus an ammo and breath readout, is drawn over the game while a gun is in hand.
 * The aim engine's own projectiles are never allowed to hit anything (the adapter has no targets), so nothing is damaged twice.
 */
const M = 2;
const MAP: Record<string, string> = { pistol: "pistol", revolver: "pistol", golden_pistol: "pistol", smg: "smg", rifle: "rifle", shotgun: "shotgun" };
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
export function playerShot(sim: Simulation, c: Character, def: string, tx: number, ty: number): number | undefined {
  if (c.tier !== "player") return undefined;
  const rt = runtime(sim), aim = rt.aim, speed = Math.hypot(c.vx, c.vy) * M;
  aim.setWeapon(MAP[def] ?? "pistol");
  rt.aimX = tx * M; rt.aimZ = ty * M; rt.muzzle = { x: c.x * M, y: 1.4, z: c.y * M };
  aim.setMotion(speed, false); aim.setAds(rt.ads); aim.setBreath(rt.breath);
  aim.ammo = aim.weapon.magSize; aim.reserve = Infinity;   // the game owns ammo
  rt.fired = null; aim.setFiring(true); aim.update(60 / aim.weapon.rpm + 0.001); aim.setFiring(false); aim.projectiles.length = 0;
  const d = rt.fired as Vec3 | null; if (!d) return undefined;
  let angle = Math.atan2(d.z, d.x);
  // crosswind drift over the flight time
  const w = worldContext(sim).weather, dist = Math.hypot(tx - c.x, ty - c.y) * M, t = dist / aim.weapon.muzzleSpeed;
  const cross = (w.windDir.x * -Math.sin(angle) + w.windDir.z * Math.cos(angle)) * w.windSpeed;
  if (dist > 1) angle += Math.atan2(cross * t, dist);
  return angle;
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
  if (!def || rt.sim.player.inside >= 0) return;
  rt.aim.setWeapon(MAP[def] ?? "pistol");
  rt.aimX = 0; rt.aimZ = 0;
  const r = rt.aim.reticle(); r.x = rt.mx; r.y = rt.my;
  r.ammo = rt.sim.player.combat?.ammo?.[def === "golden_pistol" ? "pistol" : def] ?? r.ammo;
  drawReticle(g, r); drawHud(g, r, 24, h - 90);
}

export { WEAPONS };
