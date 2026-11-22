import * as THREE from "three";

/**
 * Carry the money gun. You become a Mosaic on the club floor with the gun in your hands: walk (WASD / arrows), aim with the
 * pointer, hold to fire. Aim is exact: the shot leaves the muzzle on the line to the aim point (it only wanders while you move
 * or keep firing, and the reticle widens to show it), and a dancer under the cursor is locked onto. Each pull ejects a spent
 * brass shell that tumbles, bounces and lies on the floor; a hit bursts into cash, flashes the dancer and knocks her back.
 */
export interface CarryTarget { name: string; base: THREE.Vector3; chest: THREE.Vector3; radius: number; height: number }
export interface CarryCtx {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; floorY(x: number, z: number): number; blocked(x: number, z: number): boolean;
  targets(): CarryTarget[]; /** a slug struck a dancer */ hit(name: string, point: THREE.Vector3, dir: THREE.Vector3, v: number): void; /** a slug landed on the floor */ miss(point: THREE.Vector3, v: number): void;
  burst(point: THREE.Vector3, n: number): void; setFigure(on: boolean, pos: THREE.Vector3, moving: boolean, t: number): void; accent: string;
}
export interface CarryHooks { /** Take one note from the magazine; returns its value, or 0 when the gun is empty. */ take(): number; news(spec: string): void; rate(): number; /** A dancer was hit by a note worth v. */ tipped(name: string, v: number): void }

const SLUG_SPEED = 32, MAX_SLUGS = 48, MAX_SHELLS = 70;
const tex = (draw: (g: CanvasRenderingContext2D) => void, s = 64) => { const c = document.createElement("canvas"); c.width = c.height = s; draw(c.getContext("2d")!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createCarryGun(ctx: CarryCtx) {
  const { scene, camera } = ctx;
  let hooks: CarryHooks | null = null, active = false;
  const pos = new THREE.Vector3(0, 0, 5.4), aimPt = new THREE.Vector3(0, 1.9, -1), aimNdc = new THREE.Vector2(0, 0), keys = new Set<string>(), muzzle = new THREE.Object3D(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let firing = false, cooldown = 0, spread = 0, recoil = 0, flash = 0, lock: CarryTarget | null = null, moving = false, yaw = Math.PI, shake = 0, empty = 0;

  // ---- the gun: a pink cannon of a thing with a glass hopper of notes
  const gun = new THREE.Group(); scene.add(gun); gun.visible = false;
  const pink = new THREE.MeshStandardMaterial({ color: 0xff4fa0, metalness: 0.6, roughness: 0.3 }), steel = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.95, roughness: 0.15 }), dark = new THREE.MeshStandardMaterial({ color: 0x1b1420, metalness: 0.5, roughness: 0.4 });
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); gun.add(o); return o; };
  part(new THREE.BoxGeometry(0.15, 0.17, 0.52), pink, 0, 0, 0.1); part(new THREE.CylinderGeometry(0.045, 0.06, 0.5, 14), steel, 0, 0.02, 0.58).rotation.x = Math.PI / 2; part(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), steel, 0, 0.02, 0.84).rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.07, 0.2, 0.09), dark, 0, -0.17, 0.02).rotation.x = 0.25; part(new THREE.BoxGeometry(0.03, 0.06, 0.05), steel, 0, -0.07, 0.2);
  const hopper = part(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 16), new THREE.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 0.2, 0.08);
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.045), new THREE.MeshStandardMaterial({ color: 0x7dcf94, roughness: 0.6 })); b.position.set((Math.random() - 0.5) * 0.04, -0.1 + i * 0.03, (Math.random() - 0.5) * 0.03); b.rotation.y = Math.random() * 3; hopper.add(b); }
  muzzle.position.set(0, 0.02, 0.9); gun.add(muzzle);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex((g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "#fff"); r.addColorStop(0.3, "#ffd27a"); r.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flare.scale.setScalar(0); muzzle.add(flare);
  const muzzleLight = new THREE.PointLight(0xffb866, 0, 6); muzzle.add(muzzleLight);

  // ---- aim helpers: a laser line and a reticle ring that widens with spread
  const laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: 0xff7ab8, transparent: true, opacity: 0.55 })); laser.frustumCulled = false; laser.visible = false; scene.add(laser);
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex((g) => { g.strokeStyle = "#fff"; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, 6.283); g.stroke(); g.lineWidth = 3; for (const [x1, y1, x2, y2] of [[32, 2, 32, 14], [32, 50, 32, 62], [2, 32, 14, 32], [50, 32, 62, 32]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } }, 64), color: 0xff9ad0, transparent: true, depthTest: false, depthWrite: false })); ring.visible = false; ring.renderOrder = 10; scene.add(ring);

  // ---- slugs (rolled notes that fly dead straight) and spent shells (instanced, with real bounces)
  interface Slug { on: boolean; p: THREE.Vector3; v: THREE.Vector3; val: number; age: number; mesh: THREE.Mesh }
  const slugGeo = new THREE.BoxGeometry(0.22, 0.03, 0.08), slugs: Slug[] = Array.from({ length: MAX_SLUGS }, () => { const m = new THREE.Mesh(slugGeo, new THREE.MeshStandardMaterial({ color: 0xe5c566, emissive: 0xffa040, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 })); m.visible = false; scene.add(m); return { on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), val: 0, age: 0, mesh: m }; });
  interface Shell { on: boolean; p: THREE.Vector3; v: THREE.Vector3; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number; age: number; rest: boolean }
  const shellMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.055, 10), new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.95, roughness: 0.25 }), MAX_SHELLS); shellMesh.count = 0; shellMesh.frustumCulled = false; scene.add(shellMesh);
  const shells: Shell[] = []; let shellNext = 0; const dummy = new THREE.Object3D();

  const base = (): THREE.Vector3 => tmp2.set(pos.x, pos.y + 1.28, pos.z);
  function setAimFromNdc(): void {
    // lock onto the dancer nearest the pointer, otherwise aim at chest height on the stage
    lock = null; let best = 0.1; const targets = ctx.targets();
    for (const t of targets) { tmp.copy(t.chest).project(camera); const d = Math.hypot(tmp.x - aimNdc.x, (tmp.y - aimNdc.y) * 0.8); if (d < best && tmp.z < 1) { best = d; lock = t; } }
    if (lock) { aimPt.copy(lock.chest); return; }
    const rc = new THREE.Raycaster(); rc.setFromCamera(aimNdc, camera); const y = 1.95, t = Math.abs(rc.ray.direction.y) < 1e-4 ? 10 : (y - rc.ray.origin.y) / rc.ray.direction.y;
    aimPt.copy(rc.ray.origin).addScaledVector(rc.ray.direction, Math.max(2, Math.min(40, t)));
  }
  function fire(): void {
    if (!hooks) return; const val = hooks.take(); if (val <= 0) { firing = false; if (empty <= 0) { hooks.news("DJ|Your money gun's empty! Load it up, legend!"); empty = 4; } return; }
    const s = slugs.find((x) => !x.on); if (!s) return; const from = muzzle.getWorldPosition(new THREE.Vector3());
    // exact line to the aim point; spread only while moving or after a run of shots
    const dir = tmp.copy(aimPt).sub(from).normalize(); const w = spread; dir.x += (Math.random() - 0.5) * w; dir.y += (Math.random() - 0.5) * w; dir.z += (Math.random() - 0.5) * w; dir.normalize();
    s.on = true; s.p.copy(from); s.v.copy(dir).multiplyScalar(SLUG_SPEED); s.val = val; s.age = 0; s.mesh.visible = true; s.mesh.position.copy(from); s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dir.x, 0, dir.z).normalize());
    // the empty brass: out of the port on the right, up and back, tumbling
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1), port = gun.localToWorld(new THREE.Vector3(0.09, 0.06, 0.1));
    const sh: Shell = { on: true, p: port, v: right.multiplyScalar(2.2 + Math.random() * 1.6).add(new THREE.Vector3(-dir.x * 0.6, 2.6 + Math.random() * 1.8, -dir.z * 0.6)), rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, sx: (Math.random() - 0.5) * 30, sy: (Math.random() - 0.5) * 30, sz: (Math.random() - 0.5) * 30, age: 0, rest: false };
    shells[shellNext % MAX_SHELLS] = sh; shellNext++; shellMesh.count = Math.min(MAX_SHELLS, shellNext);
    spread = Math.min(0.06, spread + 0.011); recoil = 1; flash = 1; shake = 0.35; ctx.burst(from, 1);
  }

  const kd = (e: KeyboardEvent): void => { if (!active) return; const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) { keys.add(k); if (k === " ") firing = true; e.preventDefault(); } };
  const ku = (e: KeyboardEvent): void => { const k = e.key.toLowerCase(); keys.delete(k); if (k === " ") firing = false; };

  return {
    get active(): boolean { return active; },
    get aimingAt(): string { return lock?.name ?? ""; },
    start(h: CarryHooks): void { hooks = h; active = true; pos.set(0, 0, 5.4); yaw = Math.PI; gun.visible = ring.visible = laser.visible = true; window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); },
    stop(): void { active = false; firing = false; keys.clear(); gun.visible = ring.visible = laser.visible = false; ctx.setFigure(false, pos, false, 0); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); },
    aim(nx: number, ny: number): void { aimNdc.set(nx * 2 - 1, -(ny * 2 - 1)); },
    trigger(on: boolean): void { firing = on; },
    update(dt: number, t: number): void {
      if (!active) return;
      // walk: relative to the camera, which always looks at the stage
      const ax = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0), az = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      moving = ax !== 0 || az !== 0; if (moving) { const l = Math.hypot(ax, az), nx = pos.x + ax / l * 3.3 * dt, nz = pos.z + az / l * 3.3 * dt; if (!ctx.blocked(nx, pos.z) && Math.abs(nx) < 9.8) pos.x = nx; if (!ctx.blocked(pos.x, nz) && nz > 1.6 && nz < 9.4) pos.z = nz; }
      pos.y = ctx.floorY(pos.x, pos.z); recoil = Math.max(0, recoil - dt * 7); flash = Math.max(0, flash - dt * 14); shake = Math.max(0, shake - dt * 3); empty = Math.max(0, empty - dt);
      spread = Math.max(moving ? 0.02 : 0, spread - dt * (moving ? 0.01 : 0.05)); if (moving) spread = Math.max(spread, 0.02);
      setAimFromNdc();
      // the gun swings onto the aim point; the body turns with it
      const from = base(); gun.position.copy(from); const d = tmp.copy(aimPt).sub(from); yaw = Math.atan2(d.x, d.z); const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      gun.rotation.set(-pitch - recoil * 0.12, yaw, 0, "YXZ"); gun.position.addScaledVector(d.normalize(), 0.32 - recoil * 0.14); gun.updateMatrixWorld(true);
      ctx.setFigure(true, pos, moving, t);
      // fire
      cooldown -= dt; if (firing && cooldown <= 0) { cooldown = 1 / Math.max(2, hooks?.rate() ?? 10); fire(); }
      // aim line and reticle
      const m = muzzle.getWorldPosition(new THREE.Vector3()), arr = laser.geometry.attributes.position as THREE.BufferAttribute; arr.setXYZ(0, m.x, m.y, m.z); arr.setXYZ(1, aimPt.x, aimPt.y, aimPt.z); arr.needsUpdate = true; (laser.material as THREE.LineBasicMaterial).opacity = lock ? 0.8 : 0.4;
      ring.position.copy(aimPt); const dist = camera.position.distanceTo(aimPt), wide = (lock ? 0.35 : 0.22) + spread * 9; ring.scale.setScalar(wide * Math.max(1, dist * 0.18)); (ring.material as THREE.SpriteMaterial).color.set(lock ? 0xff4a4a : 0xff9ad0);
      flare.scale.setScalar(flash * 0.9); muzzleLight.intensity = flash * 9;
      // slugs
      const targets = ctx.targets();
      for (const s of slugs) {
        if (!s.on) continue; s.age += dt; const step = s.v.clone().multiplyScalar(dt), steps = 6; let done = false; s.v.y -= 0.5 * dt;
        for (let i = 1; i <= steps && !done; i++) {
          const q = s.p.clone().addScaledVector(step, i / steps);
          for (const tg of targets) { const dx = q.x - tg.base.x, dz = q.z - tg.base.z; if (Math.hypot(dx, dz) < tg.radius && q.y > tg.base.y && q.y < tg.base.y + tg.height) { ctx.hit(tg.name, q, s.v.clone().normalize(), s.val); done = true; break; } }
          if (!done && q.y <= ctx.floorY(q.x, q.z) + 0.02) { ctx.miss(q, s.val); done = true; }
        }
        s.p.add(step); s.mesh.position.copy(s.p); if (done || s.age > 2.5 || Math.abs(s.p.x) > 14 || Math.abs(s.p.z) > 14 || s.p.y > 9) { s.on = false; s.mesh.visible = false; }
      }
      // shells: gravity, spin, bounce, and a bit of skid before they lie still
      for (let i = 0; i < shellMesh.count; i++) {
        const sh = shells[i]; if (!sh) continue; sh.age += dt;
        if (!sh.rest) { sh.v.y -= 15 * dt; sh.p.addScaledVector(sh.v, dt); sh.rx += sh.sx * dt; sh.ry += sh.sy * dt; sh.rz += sh.sz * dt; const fy = ctx.floorY(sh.p.x, sh.p.z) + 0.014; if (sh.p.y <= fy) { sh.p.y = fy; if (Math.abs(sh.v.y) > 0.9) { sh.v.y *= -0.38; sh.v.x *= 0.6; sh.v.z *= 0.6; sh.sx *= 0.5; sh.sy *= 0.5; sh.sz *= 0.5; } else { sh.rest = true; sh.rx = Math.PI / 2; sh.rz = 0; } } }
        dummy.position.copy(sh.p); dummy.rotation.set(sh.rx, sh.ry, sh.rz); dummy.scale.setScalar(sh.age > 14 ? Math.max(0, 1 - (sh.age - 14) / 2) : 1); dummy.updateMatrix(); shellMesh.setMatrixAt(i, dummy.matrix);
      }
      shellMesh.instanceMatrix.needsUpdate = true;
      // third-person camera behind you, looking at the stage, with a kick on every shot
      const want = tmp.set(pos.x * 0.8, 2.5, pos.z + 4.2), look = tmp2.set(pos.x * 0.55 + aimPt.x * 0.25, 1.5, pos.z - 6);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt)); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.08, (Math.random() - 0.5) * shake * 0.08, shake * 0.05)); camera.lookAt(look);
    },
  };
}
