/* aim.ts: realistic aim / fire / ballistics for web games (iso + 3D, mouse + touch).
 * Engine-agnostic: plug it into your renderer/physics through WorldAdapter + Hooks.
 * Units: metres, seconds, radians, kilograms. +Y is up.
 *
 * v2 adds: wind, breath hold + hand sway, ADS (aim down sights), bouncing/thrown grenades,
 * reserve ammo, weapon swap time, empty-click feedback, kill events, momentum-based impulse,
 * a HUD helper, and fixes for a double-explosion bug and degenerate look-up/down aiming. */

// ---------- math ----------
export interface Vec3 { x: number; y: number; z: number }
export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, s: number) => v3(a.x * s, a.y * s, a.z * s);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3) => { const l = len(a) || 1; return mul(a, 1 / l); };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const GRAVITY = v3(0, -9.81, 0);
const UP = v3(0, 1, 0);

/** Right-hand vector for a direction. Falls back safely when looking straight up or down. */
const rightOf = (dir: Vec3): Vec3 => { const r = cross(dir, UP); return len(r) < 1e-4 ? v3(1, 0, 0) : norm(r); };

/** One semi-implicit step of ballistic motion with quadratic drag against moving air (wind). */
const airStep = (vel: Vec3, drag: number, gScale: number, wind: Vec3, h: number): Vec3 => {
  const v = add(vel, mul(GRAVITY, gScale * h));
  const rel = sub(v, wind);
  return sub(v, mul(rel, drag * len(rel) * h));
};

// ---------- world integration (you implement this) ----------
export type HitZone = 'head' | 'torso' | 'limb' | 'body';
export interface Target {
  id: string;
  kind: 'person' | 'vehicle' | 'prop' | 'building';
  position(): Vec3;            // aim point (chest height for people)
  velocity(): Vec3;
  isAlive(): boolean;
  hitZone?(worldPoint: Vec3): HitZone;
}
export interface RayHit { point: Vec3; normal: Vec3; distance: number; surface: string; target?: Target }
export interface WorldAdapter {
  raycast(from: Vec3, to: Vec3): RayHit | null;                    // first hit on segment
  targets(): Target[];
  screenRay(sx: number, sy: number): { origin: Vec3; dir: Vec3 };  // camera ray through screen px
  worldToScreen(p: Vec3): { x: number; y: number } | null;
  viewSize(): { w: number; h: number };
}
export interface HitEvent {
  target?: Target; zone: HitZone; point: Vec3; normal: Vec3; surface: string;
  damage: number; weaponId: string; owner: string; penetrated: boolean; dir: Vec3;
  impulse: number;             // kg*m/s (mass * speed at impact), for physics pushes
}
export interface Hooks {
  onFire?(weapon: WeaponProfile, muzzle: Vec3, dir: Vec3): void;      // sound, flash, camera kick
  onHit?(e: HitEvent): void;                                          // blood / decals / physics push
  onDamage?(target: Target, damage: number, e: HitEvent | { explosion: true; point: Vec3; dir: Vec3 }): void;
  onKill?(target: Target, e: HitEvent): void;                         // fires once, when onDamage leaves target dead
  onExplosion?(pos: Vec3, radius: number, weapon: WeaponProfile): void;
  onLock?(target: Target | null, progress: number): void;
  onReload?(weapon: WeaponProfile): void;
  onEmpty?(weapon: WeaponProfile): void;                              // trigger pulled on an empty mag
  onSwap?(weapon: WeaponProfile): void;
}

// ---------- weapon data ----------
export type ReticleKind = 'dot' | 'bloom' | 'shotgun' | 'sniper' | 'lock' | 'arc';
export interface WeaponProfile {
  id: string; reticle: ReticleKind; mode: 'semi' | 'auto';
  damage: number; pellets: number; rpm: number; magSize: number; reloadTime: number; swapTime: number;
  muzzleSpeed: number; mass: number;              // kg; impulse = mass * speed
  muzzleVelJitter: number;                        // fraction per shot, e.g. 0.008 = +/-0.8%
  drag: number; gravityScale: number; maxRange: number; falloffStart: number; falloffEnd: number;
  baseSpread: number; moveSpread: number; bloomPerShot: number; bloomMax: number; bloomRecovery: number; // rad
  recoilPitch: number; recoilYaw: number; recoilRecovery: number;
  penetration: number;                            // vs surface hardness
  explosive?: {
    radius: number; damage: number;
    fuse?: number;                                // seconds; detonates in flight when it runs out
    contact?: boolean;                            // default true: explode on first hit. false: bounce (grenades)
    restitution?: number;                         // bounce energy kept, default 0.4
  };
  lock?: { cone: number; range: number; time: number; turnRate: number; accel: number; fuse: number };
  aimAssist: number;                              // 0..1 (touch only)
}
const W = (p: Partial<WeaponProfile> & { id: string }): WeaponProfile => ({
  reticle: 'bloom', mode: 'semi', damage: 25, pellets: 1, rpm: 400, magSize: 12, reloadTime: 1.8, swapTime: 0.5,
  muzzleSpeed: 400, mass: 0.008, muzzleVelJitter: 0.008,
  drag: 0.0006, gravityScale: 1, maxRange: 300, falloffStart: 30, falloffEnd: 150,
  baseSpread: 0.006, moveSpread: 0.03, bloomPerShot: 0.004, bloomMax: 0.04, bloomRecovery: 0.08,
  recoilPitch: 0.01, recoilYaw: 0.004, recoilRecovery: 6, penetration: 0.5, aimAssist: 0.25, ...p,
});
export const WEAPONS: Record<string, WeaponProfile> = {
  pistol: W({ id: 'pistol', damage: 28, rpm: 360, muzzleSpeed: 380, penetration: 0.4 }),
  smg: W({ id: 'smg', mode: 'auto', damage: 17, rpm: 850, magSize: 30, muzzleSpeed: 360, mass: 0.006, baseSpread: 0.01, bloomPerShot: 0.0035, bloomMax: 0.06, falloffStart: 20, falloffEnd: 80, penetration: 0.3 }),
  rifle: W({ id: 'rifle', mode: 'auto', damage: 32, rpm: 650, magSize: 30, muzzleSpeed: 880, drag: 0.0003, recoilPitch: 0.014, recoilYaw: 0.006, bloomPerShot: 0.003, falloffStart: 60, falloffEnd: 300, maxRange: 600, penetration: 1.0 }),
  shotgun: W({ id: 'shotgun', reticle: 'shotgun', damage: 11, pellets: 9, rpm: 75, magSize: 6, reloadTime: 2.6, swapTime: 0.8, muzzleSpeed: 380, mass: 0.0045, drag: 0.002, baseSpread: 0.04, bloomPerShot: 0, bloomMax: 0.04, falloffStart: 8, falloffEnd: 35, recoilPitch: 0.04, penetration: 0.2, aimAssist: 0.35 }),
  sniper: W({ id: 'sniper', reticle: 'sniper', damage: 140, rpm: 45, magSize: 5, reloadTime: 3.2, swapTime: 0.9, muzzleSpeed: 1000, mass: 0.0118, muzzleVelJitter: 0.002, drag: 0.0002, baseSpread: 0.0004, moveSpread: 0.05, bloomPerShot: 0.01, bloomMax: 0.02, falloffStart: 500, falloffEnd: 1500, maxRange: 1500, recoilPitch: 0.035, penetration: 2.5, aimAssist: 0.1 }),
  grenadeLauncher: W({ id: 'grenadeLauncher', reticle: 'arc', damage: 20, rpm: 60, magSize: 4, muzzleSpeed: 40, mass: 0.2, drag: 0.02, penetration: 0, explosive: { radius: 6, damage: 160 }, aimAssist: 0.1 }),
  grenade: W({ id: 'grenade', reticle: 'arc', damage: 0, rpm: 30, magSize: 1, reloadTime: 0.8, swapTime: 0.4, muzzleSpeed: 14, mass: 0.4, drag: 0.03, maxRange: 60, penetration: 0, explosive: { radius: 5.5, damage: 180, contact: false, fuse: 2.5, restitution: 0.45 }, aimAssist: 0.1 }),
  missile: W({ id: 'missile', reticle: 'lock', damage: 20, rpm: 40, magSize: 2, reloadTime: 4, swapTime: 1, muzzleSpeed: 30, mass: 20, drag: 0, gravityScale: 0, maxRange: 800, penetration: 0, explosive: { radius: 9, damage: 300 }, lock: { cone: 0.18, range: 400, time: 1.4, turnRate: 2.2, accel: 90, fuse: 8 }, aimAssist: 0 }),
};
const HARDNESS: Record<string, number> = { flesh: 0.3, glass: 0.2, wood: 0.5, drywall: 0.4, plastic: 0.3, metal: 1.5, concrete: 2.0, stone: 2.5 };
const RICOCHET = new Set(['metal', 'stone', 'concrete']);
const ZONE_MULT: Record<HitZone, number> = { head: 2.5, torso: 1, limb: 0.7, body: 1 };

// ---------- projectiles ----------
interface Projectile {
  pos: Vec3; vel: Vec3; traveled: number; age: number; weapon: WeaponProfile; owner: string;
  penLeft: number; dmgScale: number; target?: Target; dead?: boolean;
}

/** Aim solution: where to point so a projectile with gravity meets a moving target. */
export function solveLead(from: Vec3, speed: number, tp: Vec3, tv: Vec3, gravityScale = 1): Vec3 {
  let aim = tp;
  for (let i = 0; i < 5; i++) {
    const t = len(sub(aim, from)) / Math.max(speed, 1);
    aim = add(add(tp, mul(tv, t)), v3(0, 0.5 * 9.81 * gravityScale * t * t, 0)); // lead + drop comp
  }
  return aim;
}

// ---------- the controller ----------
export type ViewMode = 'iso' | '3d';
export interface Reticle {
  kind: ReticleKind; x: number; y: number; radiusPx: number; lockProgress: number;
  locked: boolean; targetX?: number; targetY?: number; impactX?: number; impactY?: number;
  reloading: boolean; swapping: boolean; ammo: number; reserve: number;
  breath: number;                 // 0..1 breath stamina, for a HUD meter
}

export class AimSystem {
  view: ViewMode = 'iso';
  weapon: WeaponProfile = WEAPONS.pistol;
  owner = 'player';
  ammo = WEAPONS.pistol.magSize;
  reserve = Infinity;                  // spare rounds; reloads draw from this
  projectiles: Projectile[] = [];
  lockTarget: Target | null = null;
  lockProgress = 0;
  wind: Vec3 = v3();                   // m/s: the air moves at this velocity

  private blend = 0;                   // 0 = iso, 1 = 3d (smooth view switch)
  private ads = false;
  private adsBlend = 0;                // 0 = hip, 1 = fully aimed down sights
  private breathHeld = false;
  private breathing = false;
  private breathStamina = 1;
  private swayT = 0;
  private sway = { yaw: 0, pitch: 0 };
  private bloom = 0;
  private recoil = { pitch: 0, yaw: 0 };
  private recoilStep = 0;
  private cooldown = 0;
  private reloadLeft = 0;
  private swapLeft = 0;
  private mags: Record<string, number> = {};   // remembers each weapon's loaded mag across swaps
  private trigger = false;
  private released = true;
  private cursor = { x: 0, y: 0 };
  private touch = false;
  private speed = 0;
  private crouched = false;
  private muzzleFn: () => Vec3 = () => v3();

  constructor(private world: WorldAdapter, private hooks: Hooks = {}) {}

  // ----- setup / state from your game -----
  setMuzzle(fn: () => Vec3) { this.muzzleFn = fn; }
  setMotion(speed: number, crouched = false) { this.speed = speed; this.crouched = crouched; }
  setWind(v: Vec3) { this.wind = v; }
  setReserve(n: number) { this.reserve = n; }
  setView(v: ViewMode) { this.view = v; }
  setFiring(on: boolean) { if (on && !this.trigger) this.released = true; this.trigger = on; }
  setAds(on: boolean) { this.ads = on; }
  /** Hold to steady your breath (less sway and spread). Drains stamina; release to recover. */
  setBreath(on: boolean) { this.breathHeld = on; }

  setWeapon(id: string) {
    const next = WEAPONS[id];
    if (!next || next === this.weapon) return;
    this.mags[this.weapon.id] = this.ammo;
    this.weapon = next;
    this.ammo = this.mags[next.id] ?? next.magSize;
    this.bloom = 0; this.lockTarget = null; this.lockProgress = 0;
    this.reloadLeft = 0; this.swapLeft = next.swapTime;
    this.hooks.onSwap?.(next);
  }

  reload() {
    if (this.reloadLeft > 0 || this.swapLeft > 0 || this.ammo >= this.weapon.magSize || this.reserve <= 0) return;
    this.reloadLeft = this.weapon.reloadTime;
    this.hooks.onReload?.(this.weapon);
  }

  /** Mouse + touch input. Mouse: left fires, right-hold aims down sights. Touch: finger aims (offset above fingertip in iso), holding fires, tap selects lock target. */
  bind(el: HTMLElement, opts = { autoFireOnTouch: true, touchOffsetPx: 70 }) {
    let downAt = 0;
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.touch = e.pointerType === 'touch';
      const off = this.touch && this.view === 'iso' ? opts.touchOffsetPx : 0;
      this.cursor = { x: e.clientX - r.left, y: e.clientY - r.top - off };
    };
    el.style.touchAction = 'none';
    el.addEventListener('pointermove', pos);
    el.addEventListener('pointerdown', e => {
      pos(e); el.setPointerCapture(e.pointerId);
      if (e.pointerType === 'mouse' && e.button === 2) { this.setAds(true); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      downAt = performance.now();
      if (e.pointerType !== 'touch' || opts.autoFireOnTouch) this.setFiring(true);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 2) { this.setAds(false); return; }
      this.setFiring(false);
      if (e.pointerType === 'touch' && performance.now() - downAt < 180 && this.weapon.lock) this.pickLockAt(this.cursor.x, this.cursor.y);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { this.setAds(false); this.setFiring(false); });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ----- aim direction -----
  private rawAim(muzzle: Vec3): { dir: Vec3; point: Vec3; dist: number } {
    const { w, h } = this.world.viewSize();
    const isoDir = (() => {
      const ray = this.world.screenRay(this.cursor.x, this.cursor.y);
      const hit = this.world.raycast(ray.origin, add(ray.origin, mul(ray.dir, 1000)));
      let p: Vec3;
      if (hit?.target) p = hit.point;                                  // aiming at something: use its height
      else if (Math.abs(ray.dir.y) > 1e-4) { const t = (muzzle.y - ray.origin.y) / ray.dir.y; p = add(ray.origin, mul(ray.dir, t)); } // level plane at muzzle height
      else p = hit ? hit.point : add(ray.origin, mul(ray.dir, 100));
      if (!hit?.target) p = v3(p.x, muzzle.y, p.z);
      return { dir: norm(sub(p, muzzle)), point: p };
    })();
    const camDir = (() => {
      const ray = this.world.screenRay(w / 2, h / 2);
      const hit = this.world.raycast(ray.origin, add(ray.origin, mul(ray.dir, 1000)));
      const p = hit ? hit.point : add(ray.origin, mul(ray.dir, 500));  // converge muzzle on camera crosshair
      return { dir: norm(sub(p, muzzle)), point: p };
    })();
    let dir = norm(add(mul(isoDir.dir, 1 - this.blend), mul(camDir.dir, this.blend)));
    let point = add(mul(isoDir.point, 1 - this.blend), mul(camDir.point, this.blend));
    let dist = len(sub(point, muzzle));
    if (this.blend > 0) {                                              // 3D only: hand sway moves the aim
      dir = this.offsetDir(dir, this.sway.yaw * this.blend, this.sway.pitch * this.blend);
      point = add(muzzle, mul(dir, dist));                             // reticle follows the sway too
      dist = len(sub(point, muzzle));
    }
    return { dir, point, dist };
  }

  private applyAssist(muzzle: Vec3, dir: Vec3): Vec3 {
    const k = this.touch ? this.weapon.aimAssist : 0;
    if (k <= 0) return dir;
    let best: Target | null = null, bestAng = 0.12;
    for (const t of this.world.targets()) {
      if (!t.isAlive() || t.kind === 'prop') continue;
      const ang = Math.acos(clamp(dot(dir, norm(sub(t.position(), muzzle))), -1, 1));
      if (ang < bestAng) { bestAng = ang; best = t; }
    }
    if (!best) return dir;
    const lead = solveLead(muzzle, this.weapon.muzzleSpeed, best.position(), best.velocity(), this.weapon.gravityScale);
    return norm(add(mul(dir, 1 - k), mul(norm(sub(lead, muzzle)), k)));
  }

  private currentSpread(): number {
    const w = this.weapon;
    const move = clamp(this.speed / 6, 0, 1) * w.moveSpread;
    const ads = 1 - 0.5 * this.adsBlend;
    const breath = this.breathing ? 0.6 : 1;
    return (w.baseSpread + this.bloom + move) * (this.crouched ? 0.7 : 1) * ads * breath;
  }

  private offsetDir(dir: Vec3, yawOff: number, pitchOff: number): Vec3 {
    const right = rightOf(dir), up = cross(right, dir);
    return norm(add(add(dir, mul(right, Math.tan(yawOff))), mul(up, Math.tan(pitchOff))));
  }

  // ----- firing -----
  private fire() {
    const w = this.weapon, muzzle = this.muzzleFn();
    let base = this.applyAssist(muzzle, this.rawAim(muzzle).dir);
    const rk = 1 - 0.3 * this.adsBlend;                                // ADS tames recoil
    // recoil: pitch only in 3D (iso has no vertical aim), yaw always
    base = this.offsetDir(base, this.recoil.yaw * rk, this.recoil.pitch * this.blend * rk);
    const spread = this.currentSpread();
    for (let i = 0; i < w.pellets; i++) {
      const d = this.offsetDir(base, gauss() * spread * 0.5, gauss() * spread * 0.5 * (0.4 + 0.6 * this.blend));
      const speed = w.muzzleSpeed * (1 + w.muzzleVelJitter * gauss());
      this.projectiles.push({
        pos: muzzle, vel: mul(d, speed), traveled: 0, age: 0, weapon: w, owner: this.owner,
        penLeft: w.penetration, dmgScale: 1, target: w.lock && this.lockProgress >= 1 ? this.lockTarget ?? undefined : undefined,
      });
    }
    this.ammo--; this.cooldown = 60 / w.rpm;
    this.bloom = Math.min(w.bloomMax, this.bloom + w.bloomPerShot);
    // deterministic-ish recoil climb with random wobble; resets after a pause
    this.recoilStep++;
    this.recoil.pitch += w.recoilPitch * rk * (1 + 0.05 * Math.min(this.recoilStep, 10));
    this.recoil.yaw += w.recoilYaw * rk * (Math.random() - 0.5) * 2;
    this.hooks.onFire?.(w, muzzle, base);
    if (w.lock) { this.lockProgress = 0; this.lockTarget = null; }
    if (this.ammo <= 0) this.reload();
  }

  // ----- lock on -----
  pickLockAt(sx: number, sy: number) {
    const ray = this.world.screenRay(sx, sy);
    const hit = this.world.raycast(ray.origin, add(ray.origin, mul(ray.dir, 1500)));
    if (hit?.target?.isAlive()) { this.lockTarget = hit.target; this.lockProgress = 0; }
  }

  private updateLock(dt: number, muzzle: Vec3, aimDir: Vec3) {
    const l = this.weapon.lock; if (!l) return;
    if (this.lockTarget && !this.lockTarget.isAlive()) this.lockTarget = null;
    // candidate = best target inside the cone with clear line of sight
    let best: Target | null = null, bestAng = l.cone;
    for (const t of this.world.targets()) {
      if (!t.isAlive() || t.kind === 'prop') continue;
      const to = sub(t.position(), muzzle), d = len(to);
      if (d > l.range) continue;
      const ang = Math.acos(clamp(dot(aimDir, norm(to)), -1, 1));
      if (ang >= bestAng) continue;
      const los = this.world.raycast(muzzle, t.position());
      if (los && los.target !== t) continue;
      best = t; bestAng = ang;
    }
    if (best && (!this.lockTarget || best === this.lockTarget)) { this.lockTarget = best; this.lockProgress = Math.min(1, this.lockProgress + dt / l.time); }
    else if (best && this.lockTarget !== best) { this.lockProgress = Math.max(0, this.lockProgress - dt * 2); if (this.lockProgress === 0) this.lockTarget = best; }
    else { this.lockProgress = Math.max(0, this.lockProgress - dt / l.time); if (this.lockProgress === 0) this.lockTarget = null; }
    this.hooks.onLock?.(this.lockTarget, this.lockProgress);
  }

  // ----- per-frame update -----
  update(dt: number) {
    const w = this.weapon;
    this.blend = clamp(this.blend + (this.view === '3d' ? 1 : -1) * dt * 4, 0, 1);    // ~0.25s view transition
    this.adsBlend = clamp(this.adsBlend + (this.ads ? 1 : -1) * dt * 6, 0, 1);

    // breath: holding steadies the aim but drains stamina; releasing recovers it
    const holding = this.breathHeld && this.breathStamina > 0;
    this.breathing = holding;
    this.breathStamina = clamp(this.breathStamina + (holding ? -0.5 : 0.25) * dt, 0, 1);

    // sway: incommensurate sines, larger when moving, smaller when aimed or breathing
    this.swayT += dt;
    const k = (0.5 + clamp(this.speed / 6, 0, 1) * 1.5) * (1 - 0.5 * this.adsBlend) * (holding ? 0.35 : 1);
    this.sway.yaw = 0.006 * k * (Math.sin(this.swayT * 0.9) + 0.5 * Math.sin(this.swayT * 2.3 + 1));
    this.sway.pitch = 0.005 * k * (Math.sin(this.swayT * 1.3 + 2) + 0.5 * Math.sin(this.swayT * 3.1));

    this.cooldown -= dt;
    this.swapLeft = Math.max(0, this.swapLeft - dt);
    this.bloom = Math.max(0, this.bloom - w.bloomRecovery * dt);
    const rec = Math.exp(-w.recoilRecovery * dt);
    this.recoil.pitch *= rec; this.recoil.yaw *= rec;
    if (this.cooldown < -0.25) this.recoilStep = 0;
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        const take = Math.min(w.magSize - this.ammo, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }

    const muzzle = this.muzzleFn();
    this.updateLock(dt, muzzle, this.rawAim(muzzle).dir);

    const ready = this.cooldown <= 0 && this.reloadLeft <= 0 && this.swapLeft <= 0
      && (w.mode === 'auto' || this.released) && !(w.lock && this.lockProgress < 1);
    if (this.trigger && ready) {
      if (this.ammo > 0) { this.fire(); if (w.mode === 'semi') this.released = false; }
      else { this.released = false; this.cooldown = 0.3; this.hooks.onEmpty?.(w); this.reload(); }
    }
    if (!this.trigger) this.released = true;

    for (const p of this.projectiles) this.stepProjectile(p, dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  private stepProjectile(p: Projectile, dt: number) {
    const w = p.weapon;
    const fuse = w.explosive?.fuse ?? w.lock?.fuse ?? 30;
    const n = Math.max(1, Math.ceil((len(p.vel) * dt) / 20));    // substep so fast rounds can't skip thin walls
    const h = dt / n;
    for (let i = 0; i < n && !p.dead; i++) {
      p.age += h;
      if (w.lock) this.guide(p, h);
      else p.vel = airStep(p.vel, w.drag, w.gravityScale, this.wind, h);
      const next = add(p.pos, mul(p.vel, h));
      const hit = this.world.raycast(p.pos, next);
      if (hit) { this.resolveHit(p, hit); continue; }            // resolveHit sets p.dead when the round stops
      p.traveled += len(sub(next, p.pos));
      p.pos = next;
      if (p.traveled > w.maxRange || p.age > fuse) {
        if (w.explosive) this.explode(p.pos, p);
        p.dead = true;
      }
    }
  }

  private guide(p: Projectile, h: number) {
    const l = p.weapon.lock!;
    const speed = Math.min(len(p.vel) + l.accel * h, 260);
    let dir = norm(p.vel);
    if (p.target?.isAlive()) {
      const lead = solveLead(p.pos, speed, p.target.position(), p.target.velocity(), 0);
      const want = norm(sub(lead, p.pos));
      const ang = Math.acos(clamp(dot(dir, want), -1, 1)), max = l.turnRate * h;
      const f = Math.min(1, max / (ang || 1));
      dir = norm(add(mul(dir, 1 - f), mul(want, f)));
    }
    p.vel = mul(dir, speed);
  }

  private resolveHit(p: Projectile, hit: RayHit) {
    const w = p.weapon, dir = norm(p.vel), ex = w.explosive;
    if (ex && ex.contact !== false) { this.explode(hit.point, p); p.dead = true; return; }
    if (ex) {                                                        // bouncing grenade: keeps rolling until its fuse runs out
      const rest = ex.restitution ?? 0.4;
      const bounce = sub(dir, mul(hit.normal, 2 * dot(dir, hit.normal)));
      p.vel = mul(bounce, len(p.vel) * rest);
      p.pos = add(hit.point, mul(hit.normal, 0.02));
      this.emit(p, hit, 'body', hit.surface, 0, false, dir);
      return;
    }

    const dist = p.traveled + hit.distance;
    const fall = dist <= w.falloffStart ? 1 : clamp(1 - (dist - w.falloffStart) / (w.falloffEnd - w.falloffStart), 0.25, 1);
    const zone: HitZone = hit.target?.hitZone?.(hit.point) ?? 'body';
    const surface = hit.target?.kind === 'person' ? 'flesh' : hit.surface;
    const dmg = w.damage * p.dmgScale * fall * (hit.target?.kind === 'person' ? ZONE_MULT[zone] : 1);
    const hard = HARDNESS[surface] ?? 1;

    // ricochet off hard surfaces at grazing angles
    if (RICOCHET.has(surface) && dot(dir, hit.normal) > -0.25 && p.dmgScale > 0.3) {
      const r = sub(dir, mul(hit.normal, 2 * dot(dir, hit.normal)));
      p.vel = mul(r, len(p.vel) * 0.5); p.pos = add(hit.point, mul(hit.normal, 0.02)); p.dmgScale *= 0.4;
      this.emit(p, hit, zone, surface, 0, false, dir); return;
    }

    const penetrated = p.penLeft >= hard;
    const e = this.emit(p, hit, zone, surface, dmg, penetrated, dir);
    if (hit.target) {
      const wasAlive = hit.target.isAlive();
      this.hooks.onDamage?.(hit.target, dmg, e);
      if (wasAlive && !hit.target.isAlive()) this.hooks.onKill?.(hit.target, e);
    }
    if (penetrated) { p.penLeft -= hard; p.dmgScale *= 0.6; p.vel = mul(p.vel, 0.7); p.pos = add(hit.point, mul(dir, 0.05)); p.traveled = dist; }
    else p.dead = true;
  }

  private emit(p: Projectile, hit: RayHit, zone: HitZone, surface: string, damage: number, penetrated: boolean, dir: Vec3): HitEvent {
    const e: HitEvent = {
      target: hit.target, zone, point: hit.point, normal: hit.normal, surface, damage,
      weaponId: p.weapon.id, owner: p.owner, penetrated, dir, impulse: p.weapon.mass * len(p.vel),
    };
    this.hooks.onHit?.(e); return e;
  }

  private explode(pos: Vec3, p: Projectile) {
    const ex = p.weapon.explosive!;
    this.hooks.onExplosion?.(pos, ex.radius, p.weapon);
    for (const t of this.world.targets()) {
      if (!t.isAlive()) continue;
      const to = sub(t.position(), pos), d = len(to);
      if (d > ex.radius) continue;
      const los = this.world.raycast(add(pos, v3(0, 0.3, 0)), t.position());
      const cover = los && los.target !== t ? 0.35 : 1;                    // cover cuts blast damage
      const dmg = ex.damage * Math.pow(1 - d / ex.radius, 1.5) * cover;
      if (dmg > 1) this.hooks.onDamage?.(t, dmg, { explosion: true, point: pos, dir: norm(to) });
    }
  }

  // ----- reticle -----
  /** Pass to drawReticle() / drawHud() or your own renderer. Radius reflects the *real* current spread cone at the aim distance. */
  reticle(): Reticle {
    const muzzle = this.muzzleFn(), a = this.rawAim(muzzle), w = this.weapon;
    const here = this.world.worldToScreen(a.point);
    const right = rightOf(a.dir);
    const off = this.world.worldToScreen(add(a.point, mul(right, Math.tan(this.currentSpread() * 0.5) * a.dist)));
    const radius = here && off ? Math.max(6, Math.hypot(off.x - here.x, off.y - here.y)) : 12;
    const r: Reticle = {
      kind: w.reticle, x: here?.x ?? this.cursor.x, y: here?.y ?? this.cursor.y, radiusPx: radius,
      lockProgress: this.lockProgress, locked: this.lockProgress >= 1,
      reloading: this.reloadLeft > 0, swapping: this.swapLeft > 0,
      ammo: this.ammo, reserve: this.reserve, breath: this.breathStamina,
    };
    if (this.lockTarget) { const s = this.world.worldToScreen(this.lockTarget.position()); if (s) { r.targetX = s.x; r.targetY = s.y; } }
    if (w.reticle === 'arc' || (w.gravityScale > 0 && w.muzzleSpeed < 120)) { // predicted impact for slow/lobbed rounds
      const imp = this.predictImpact(muzzle, this.applyAssist(muzzle, a.dir));
      const s = imp && this.world.worldToScreen(imp); if (s) { r.impactX = s.x; r.impactY = s.y; }
    }
    return r;
  }

  /** Simulates the real trajectory (gravity, drag, wind) to find where a lobbed round will land. */
  predictImpact(muzzle: Vec3, dir: Vec3): Vec3 | null {
    const w = this.weapon, h = 0.02;
    let pos = muzzle, vel = mul(dir, w.muzzleSpeed);
    for (let i = 0; i < 300; i++) {
      vel = airStep(vel, w.drag, w.gravityScale, this.wind, h);
      const next = add(pos, mul(vel, h)), hit = this.world.raycast(pos, next);
      if (hit) return hit.point;
      pos = next;
    }
    return null;
  }
}

/** Canvas 2D reticles, one look per weapon class. Draw on a UI canvas above your game. */
export function drawReticle(ctx: CanvasRenderingContext2D, r: Reticle) {
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = r.reloading || r.swapping ? 'rgba(255,255,255,.35)' : '#fff'; ctx.fillStyle = ctx.strokeStyle;
  const { x, y, radiusPx: R } = r;
  const gap = (g: number) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * R, y + dy * R); ctx.lineTo(x + dx * (R + g), y + dy * (R + g)); ctx.stroke(); } };
  switch (r.kind) {
    case 'dot': ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); gap(6); break;
    case 'bloom': ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill(); gap(8); break;                         // 4 ticks that spread with bloom
    case 'shotgun': ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill(); break;
    case 'sniper': ctx.beginPath(); ctx.arc(x, y, Math.max(R, 10), 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.lineTo(x + 40, y); ctx.moveTo(x, y - 40); ctx.lineTo(x, y + 40); ctx.stroke(); break;
    case 'arc': ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.stroke(); if (r.impactX !== undefined) { ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(r.impactX, r.impactY!); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(r.impactX, r.impactY!, 10, 0, 7); ctx.strokeStyle = '#ffb020'; ctx.stroke(); } break;
    case 'lock': {                                                                                              // diamond + closing brackets on target
      ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.stroke();
      if (r.targetX !== undefined) {
        const s = 46 - 30 * r.lockProgress, tx = r.targetX, ty = r.targetY!; ctx.strokeStyle = r.locked ? '#ff3b30' : '#ffd60a'; ctx.lineWidth = 3;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(tx + sx * s, ty + sy * (s - 12)); ctx.lineTo(tx + sx * s, ty + sy * s); ctx.lineTo(tx + sx * (s - 12), ty + sy * s); ctx.stroke(); }
      } break; }
  }
  ctx.restore();
}

/** Minimal HUD: ammo / reserve and a breath meter. Anchor (x, y) to the baseline of the ammo text. */
export function drawHud(ctx: CanvasRenderingContext2D, r: Reticle, x: number, y: number) {
  ctx.save();
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = r.ammo === 0 ? '#ff3b30' : r.swapping ? 'rgba(255,255,255,.4)' : '#fff';
  ctx.fillText(String(r.ammo), x, y);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText(`/ ${r.reserve === Infinity ? '∞' : r.reserve}`, x + 40, y);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, y + 10, 120, 6);
  ctx.fillStyle = r.breath > 0.25 ? '#7fd7ff' : '#ff9f0a'; ctx.fillRect(x, y + 10, 120 * r.breath, 6);
  ctx.restore();
}
