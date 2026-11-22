import * as THREE from "three";
import { arp, PALETTE, tone, type ArcadeGame, type GameCtx } from "./ArcadeRoom";
import { felt, paint, wood } from "../lobby/LobbyTextures";

/**
 * Dice and Coin flip, played by the cannon-es rigid-body engine. The tray, restitution and friction, the roll and flip impulses and the
 * "read the face off the settled body's orientation" rule follow the original Aurelia suite. The result is whatever the physics did:
 * nothing is rolled in advance. Models use the casino's mahogany, brass, wine felt and ivory.
 */
type Cannon = typeof import("cannon-es");
let CANNON: Promise<Cannon> | null = null;
const loadCannon = () => (CANNON ??= import("cannon-es"));
const R = Math.random;
const brassMat = () => new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: .9, roughness: .25 });
const woodMat = () => new THREE.MeshStandardMaterial({ map: wood([1, 1]), roughness: .4, metalness: .1 });

function pipTexture(pips: number, bg: string, pip: string) {
  return paint(`die${pips}${bg}${pip}`, 128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const P: Record<number, number[][]> = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]], 6: [[.28, .25], [.72, .25], [.28, .5], [.72, .5], [.28, .75], [.72, .75]] };
    for (const [x, y] of P[pips]) { const gr = g.createRadialGradient(x * w - 3, y * h - 3, 1, x * w, y * h, 13); gr.addColorStop(0, "#000"); gr.addColorStop(1, pip); g.fillStyle = gr; g.beginPath(); g.arc(x * w, y * h, 12, 0, 7); g.fill(); }
  });
}
const coinFace = (heads: boolean) => paint("coin" + heads, 256, 256, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, "#f7dc7a"); gr.addColorStop(1, "#c2962a"); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  g.strokeStyle = "#8a6414"; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 14, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 34, 0, 7); g.stroke();
  g.fillStyle = "#7a5410"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "700 108px Georgia,serif"; g.fillText(heads ? "H" : "T", w / 2, w / 2 + 6); g.font = "700 20px Georgia,serif"; g.fillText(heads ? "THE TESSERA" : "· FORTUNA ·", w / 2, w - 54);
});

abstract class CannonGame implements ArcadeGame {
  abstract id: string; abstract name: string; abstract blurb: string;
  protected ctx!: GameCtx; protected C!: Cannon; protected world!: InstanceType<Cannon["World"]>; protected alive = false; protected settleT = 0; protected rolling = false; protected wager = 0;
  abstract build(): void; abstract launch(): void; abstract check(): void; abstract camera(t: number, aspect: number): void;
  async mount(ctx: GameCtx) { this.ctx = ctx; this.C = await loadCannon(); this.world = new this.C.World(); this.world.broadphase = new this.C.SAPBroadphase(this.world); (this.world.solver as unknown as { iterations: number }).iterations = 14; this.world.allowSleep = false; this.alive = true; this.build(); }
  primary() { if (this.rolling) return; const bet = this.ctx.stake(); if (!this.ctx.spend(bet)) return; this.wager = bet; this.rolling = true; this.settleT = 0; this.ctx.busyChanged(); this.ctx.primary("Rolling…", true); this.launch(); }
  busy() { return this.rolling; }
  protected finish(label: string, win: number, msg: string) {
    this.rolling = false; this.ctx.settle(label, this.wager, win); this.ctx.say(msg); this.ctx.primary(this.id === "dice" ? "Roll" : "Flip"); this.ctx.busyChanged();
    if (win > 0) { arp(4); this.ctx.fx.flash(PALETTE.gold, 3, 0, 1, 0); this.ctx.fx.emit(0, 1, 0, 80, 7, new THREE.Color(PALETTE.gold), 1.1, -7, 5); this.ctx.fx.punch = .6; this.ctx.big(win >= this.wager * 3 ? "BIG WIN" : "WIN", "n"); if (win >= this.wager * 5) this.ctx.fx.burstWin(6, 0, 0, 0); } else tone(150, .3, .05, "sawtooth");
  }
  update(dt: number, _real: number) { if (!this.alive) return; this.world.step(1 / 120, dt, 8); this.sync(); if (this.rolling) { this.settleT = this.stillFor(dt); if (this.settleT > .7) this.check(); } }
  abstract sync(): void; abstract stillFor(dt: number): number;
  unmount() { this.alive = false; }
}

class Dice extends CannonGame {
  id = "dice"; name = "Dice"; blurb = "Two real dice in a mahogany tray. Over or under, read straight off the tumble.";
  private dice: { mesh: THREE.Mesh; body: InstanceType<Cannon["Body"]> }[] = []; private mode: "over" | "under" = "over"; private target = 7; private readout!: HTMLElement; private still = 0;
  private static WAYS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  private prob() { let w = 0; for (let s = 2; s <= 12; s++) if ((this.mode === "over" && s > this.target) || (this.mode === "under" && s < this.target)) w += Dice.WAYS[s]; return w / 36; }
  private mult() { const p = this.prob(); return p > 0 ? Math.floor(.97 / p * 100) / 100 : 0; }
  private refresh() { const p = this.prob(); this.readout.textContent = p > 0 ? `${this.mode === "over" ? "Over" : "Under"} ${this.target}  ·  ×${this.mult().toFixed(2)}  ·  ${Math.round(p * 100)}%` : "No chance. Pick another number."; this.ctx.primary("Roll", p <= 0 || this.rolling); }
  build() {
    const C = this.C, w = this.world, g = this.ctx.group; w.gravity.set(0, -24, 0);
    const feltP = new C.Material("felt"), dieP = new C.Material("die"); w.addContactMaterial(new C.ContactMaterial(feltP, dieP, { restitution: .45, friction: .35 })); w.addContactMaterial(new C.ContactMaterial(dieP, dieP, { restitution: .55, friction: .25 }));
    const R0 = 5.4, floor = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 + .3, .5, 8), new THREE.MeshStandardMaterial({ map: felt("blank", "#4a1220"), roughness: .9 })); floor.position.y = -.25; floor.receiveShadow = true; g.add(floor);
    const fb = new C.Body({ mass: 0, material: feltP }); fb.addShape(new C.Plane()); fb.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(fb);
    const apo = R0 * Math.cos(Math.PI / 8) - .15, side = 2 * R0 * Math.sin(Math.PI / 8) + .3;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * apo, z = Math.sin(a) * apo, wall = new THREE.Mesh(new THREE.BoxGeometry(side, 1.5, .55), woodMat()); wall.position.set(x, .65, z); wall.rotation.y = -a + Math.PI / 2; wall.castShadow = true; g.add(wall);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(side, .16, .62), brassMat()); rail.position.set(x, 1.44, z); rail.rotation.y = -a + Math.PI / 2; g.add(rail);
      const wb = new C.Body({ mass: 0, material: feltP }); wb.addShape(new C.Box(new C.Vec3(side / 2, 2.2, .35))); wb.position.set(x, 1.2, z); wb.quaternion.setFromEuler(0, -a + Math.PI / 2, 0); w.addBody(wb);
    }
    for (const [bg, pip, x] of [["#f4ecd8", "#14141a", -1.1], ["#8a1428", "#f4d777", 1.1]] as const) {
      const mats = [3, 4, 1, 6, 2, 5].map(p => new THREE.MeshStandardMaterial({ map: pipTexture(p, bg, pip), roughness: .3, metalness: .05 })), mesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), mats); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
      const body = new C.Body({ mass: 1.4, material: dieP, linearDamping: .08, angularDamping: .12 }); body.addShape(new C.Box(new C.Vec3(.575, .575, .575))); body.position.set(x, .6, 0);
      body.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal(): number } }) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (this.rolling && v > 1.2) tone(380 + R() * 260, .06, Math.min(.06, v * .006), "square"); });
      w.addBody(body); this.dice.push({ mesh, body });
    }
    // controls: over / under and the target number
    const o = this.ctx.opts, mk = (t: string, fn: () => void, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = "ar-seg " + cls; b.textContent = t; b.addEventListener("click", () => { if (!this.rolling) { fn(); this.refresh(); sync(); } }); return b; };
    const over = mk("Over", () => { this.mode = "over"; this.target = Math.min(this.target, 11); }), under = mk("Under", () => { this.mode = "under"; this.target = Math.max(this.target, 3); });
    const minus = mk("−", () => { this.target = Math.max(this.mode === "under" ? 3 : 2, this.target - 1); }), plus = mk("+", () => { this.target = Math.min(this.mode === "over" ? 11 : 12, this.target + 1); });
    this.readout = document.createElement("div"); this.readout.className = "ar-readout";
    const sync = () => { over.classList.toggle("on", this.mode === "over"); under.classList.toggle("on", this.mode === "under"); };
    const row = document.createElement("div"); row.className = "ar-segrow"; row.append(over, under, minus, plus); o.append(row, this.readout); sync(); this.refresh(); this.ctx.say("Choose over or under, then roll.");
  }
  launch() { this.ctx.say("Rolling…"); this.dice.forEach((d, i) => { d.body.wakeUp(); d.body.position.set(-2.4 + i * 1.4, 4.2 + i * .8, -1.6 + i * 1.2); d.body.quaternion.setFromEuler(R() * 6, R() * 6, R() * 6); d.body.velocity.set(4.5 + R() * 4.5, -2, 2.5 + (R() - .5) * 6); d.body.angularVelocity.set((R() - .5) * 22, (R() - .5) * 22, (R() - .5) * 22); }); tone(220, .2, .05, "sawtooth"); }
  sync() { for (const d of this.dice) { d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z); d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w); } }
  stillFor(dt: number) { const calm = this.dice.every(d => d.body.velocity.length() < .15 && d.body.angularVelocity.length() < .15); this.still = calm ? this.still + dt : 0; return this.still; }
  private face(body: InstanceType<Cannon["Body"]>) {
    const N: [THREE.Vector3, number][] = [[new THREE.Vector3(1, 0, 0), 3], [new THREE.Vector3(-1, 0, 0), 4], [new THREE.Vector3(0, 1, 0), 1], [new THREE.Vector3(0, -1, 0), 6], [new THREE.Vector3(0, 0, 1), 2], [new THREE.Vector3(0, 0, -1), 5]], q = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    let best = -2, val = 1; for (const [v, n] of N) { const y = v.clone().applyQuaternion(q).y; if (y > best) { best = y; val = n; } } return { val, flat: best };
  }
  check() {
    const f = this.dice.map(d => this.face(d.body)); if (f.some(x => x.flat < .93)) { this.dice.forEach(d => d.body.applyImpulse(new this.C.Vec3((R() - .5) * 3, 3, (R() - .5) * 3))); this.still = 0; return; } // cocked against the rail: nudge it
    const sum = f[0].val + f[1].val, won = this.mode === "over" ? sum > this.target : sum < this.target, win = won ? this.wager * this.mult() : 0;
    this.finish("Dice", win, `${f[0].val} + ${f[1].val} = ${sum}.  ${won ? "You win $" + Math.round(win).toLocaleString("en-NZ") : "Not this time"}`);
  }
  camera(t: number) { const c = this.ctx.camera, s = this.ctx.fx.shake; c.position.set(Math.sin(t * .2) * 2 + (R() - .5) * s, 13 + (R() - .5) * s, 9.5); c.lookAt(0, 0, 0); }
}

class Coin extends CannonGame {
  id = "coin"; name = "Coin flip"; blurb = "A heavy gold coin, a real toss. Call it in the air."; private mesh!: THREE.Mesh; private body!: InstanceType<Cannon["Body"]>; private pick: "heads" | "tails" = "heads"; private still = 0;
  build() {
    const C = this.C, w = this.world, g = this.ctx.group; w.gravity.set(0, -22, 0);
    const tp = new C.Material("table"), cp = new C.Material("coin"); w.addContactMaterial(new C.ContactMaterial(tp, cp, { restitution: .48, friction: .45 }));
    const table = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, .7, 48), new THREE.MeshStandardMaterial({ map: felt("blank", "#4a1220"), roughness: .9 })); table.position.y = -.35; table.receiveShadow = true; g.add(table);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, .07, 12, 48), brassMat()); ring.rotation.x = Math.PI / 2; ring.position.y = .02; g.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.4, .22, 12, 64), woodMat()); rim.rotation.x = Math.PI / 2; rim.position.y = .02; g.add(rim);
    const fb = new C.Body({ mass: 0, material: tp }); fb.addShape(new C.Plane()); fb.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(fb);
    const r = 1.45, h = .2, edge = brassMat(); this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), [edge, new THREE.MeshStandardMaterial({ map: coinFace(true), metalness: .8, roughness: .3 }), new THREE.MeshStandardMaterial({ map: coinFace(false), metalness: .8, roughness: .3 })]); this.mesh.castShadow = this.mesh.receiveShadow = true; g.add(this.mesh);
    this.body = new C.Body({ mass: 1.2, material: cp, linearDamping: .06, angularDamping: .14 }); this.body.addShape(new C.Cylinder(r, r, h, 20)); this.body.position.set(0, h / 2 + .02, 0);
    this.body.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal(): number } }) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (this.rolling && v > 1) tone(1100 + R() * 300, .12, Math.min(.12, v * .012), "triangle"); }); w.addBody(this.body);
    const o = this.ctx.opts, row = document.createElement("div"); row.className = "ar-segrow"; const mk = (t: string, k: "heads" | "tails") => { const b = document.createElement("button"); b.type = "button"; b.className = "ar-seg"; b.textContent = t; b.addEventListener("click", () => { if (!this.rolling) { this.pick = k; sync(); } }); return b; };
    const hb = mk("Heads", "heads"), tb = mk("Tails", "tails"), sync = () => { hb.classList.toggle("on", this.pick === "heads"); tb.classList.toggle("on", this.pick === "tails"); }; row.append(hb, tb); const note = document.createElement("div"); note.className = "ar-readout"; note.textContent = "Pays ×1.94"; o.append(row, note); sync(); this.ctx.primary("Flip"); this.ctx.say("Call it, then flip.");
  }
  launch() { const b = this.body; b.wakeUp(); b.position.set(0, 1, 0); b.velocity.set((R() - .5) * 1.4, 14.5 + R() * 2.5, (R() - .5) * 1.4); b.angularVelocity.set(16 + R() * 10, (R() - .5) * 4, (R() - .5) * 5); tone(900, .15, .05); }
  sync() { this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z); this.mesh.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w); }
  stillFor(dt: number) { const calm = this.body.velocity.length() < .12 && this.body.angularVelocity.length() < .12; this.still = calm ? this.still + dt : 0; return this.still; }
  check() {
    const up = this.body.quaternion.vmult(new this.C.Vec3(0, 1, 0)).y; if (Math.abs(up) < .8) { this.body.applyImpulse(new this.C.Vec3((R() - .5) * 2, 4, (R() - .5) * 2), new this.C.Vec3(.5, 0, 0)); this.still = 0; return; } // balanced on its edge: nudge it over
    const side = up > 0 ? "heads" : "tails", won = side === this.pick;
    this.finish("Coin flip", won ? this.wager * 1.94 : 0, `${side === "heads" ? "Heads" : "Tails"}.  ${won ? "You win $" + Math.round(this.wager * 1.94).toLocaleString("en-NZ") : "Not this time"}`);
  }
  camera(t: number) { const c = this.ctx.camera, s = this.ctx.fx.shake; const follow = Math.min(5, Math.max(0, this.body ? this.body.position.y * .25 : 0)); c.position.set(Math.sin(t * .2) * 1.5 + (R() - .5) * s, 9.5 + follow, 9.5); c.lookAt(0, 1 + follow * .4, 0); }
}

export const diceGame = (): ArcadeGame => new Dice();
export const coinGame = (): ArcadeGame => new Coin();
