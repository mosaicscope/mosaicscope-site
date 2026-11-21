/**
 * The Pink Pukeko's live effects: a particle engine, stage lighting and fifty actions you can set off while the scene keeps
 * running (cash cannons, lasers, fireworks, flame jets, confetti, a raccoon on the loose...). Everything draws onto the same
 * canvas as the stage, so the scene is always visible. Pure visuals plus the shouting; money only moves where an action says so.
 */
export type FxKind = "bill" | "coin" | "confetti" | "streamer" | "balloon" | "bubble" | "glitter" | "spark" | "flame" | "smoke" | "snow" | "petal" | "heart" | "feather" | "rocket" | "foam" | "star";
interface P { k: FxKind; x: number; y: number; vx: number; vy: number; ay: number; r: number; vr: number; age: number; life: number; col: string; sz: number; w: number }
interface Creature { k: "raccoon" | "flamingo" | "chicken" | "pigeon" | "ghost"; x: number; y: number; vx: number; age: number; until: number }
export interface Target { k: "piggy" | "atm" | "pukeko" | "chest" | "bauble"; x: number; y: number; vx: number; hp: number; max: number; r: number; pay: number; flash: number }
export type CrowdMode = "wave" | "chant" | "mosh" | "conga" | "drunk" | "cheer" | "";
export interface FxApi {
  W: number; H: number;
  dancers(): { name: string; x: number; y: number }[];
  say(spec: string): void; toast(t: string): void; hype(n: number): void; pay(n: number, what: string): boolean;
  dancer(name: string, what: "spin" | "jump" | "kiss" | "bow" | "strut" | "pole"): void; revue(): void; costume(): void; scene(name?: string): void; mood(d: number): void; give(n: number): void;
}
export interface ClubAction { id: string; label: string; icon: string; cost: number; cd: number; group: string; run(fx: ClubFx, api: FxApi): void }

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const PARTY = ["#c74d57", "#f6b62c", "#7b2cff", "#1fd1b8", "#f6f4f3", "#3d8bff", "#ff7a3d", "#7dcf94"];

export class ClubFx {
  parts: P[] = []; creatures: Creature[] = []; targets: Target[] = [];
  strobe = 0; blackout = 0; wash = 0; washCol = "#c74d57"; lasers = 0; disco = 0; spot = 0; spotX = 480; uv = 0; kaleido = 0; fog = 0; bolt = 0; boltX = 0; shake = 0; slowmo = 0;
  crowd: CrowdMode = ""; crowdUntil = 0; flash = 0; banner = ""; bannerUntil = 0; flames = 0; cooldown = new Map<string, number>(); fired = 0;

  /** Is this expression/pose cue active for the crowd right now? */
  crowdMode(t: number): CrowdMode { return t < this.crowdUntil ? this.crowd : ""; }
  setCrowd(m: CrowdMode, until: number): void { this.crowd = m; this.crowdUntil = until; }

  emit(k: FxKind, x: number, y: number, n: number, o: { sx?: number; sy?: number; vx?: number; vy?: number; ay?: number; life?: number; cols?: readonly string[]; sz?: number } = {}): void {
    for (let i = 0; i < n && this.parts.length < 1400; i++) {
      const col = pick(o.cols ?? PARTY), sz = (o.sz ?? 1) * rnd(0.8, 1.25);
      let vx = (o.vx ?? 0) + rnd(-1, 1) * (o.sx ?? 40), vy = (o.vy ?? 0) + rnd(-1, 1) * (o.sy ?? 40), ay = o.ay ?? 220, life = o.life ?? rnd(2, 4);
      if (k === "balloon") { ay = -rnd(14, 28); life = rnd(5, 9); } else if (k === "bubble") { ay = -rnd(10, 26); life = rnd(3, 6); } else if (k === "flame") { ay = -140; life = rnd(0.5, 0.9); } else if (k === "smoke") { ay = -22; life = rnd(2, 3.5); } else if (k === "spark") life = rnd(0.35, 0.8);
      this.parts.push({ k, x, y, vx, vy, ay, r: rnd(0, 6.28), vr: rnd(-6, 6), age: 0, life, col, sz, w: rnd(0, 6.28) });
    }
  }
  burst(k: FxKind, x: number, y: number, n: number, speed: number, o: Parameters<ClubFx["emit"]>[4] = {}): void {
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(0.3, 1) * speed; this.emit(k, x, y, 1, { ...o, vx: Math.cos(a) * s, vy: Math.sin(a) * s, sx: 0, sy: 0 }); }
  }
  say(t: string, secs = 3): void { this.banner = t; this.bannerUntil = performance.now() / 1000 + secs; }
  creature(k: Creature["k"], t: number, secs = 14): void { const dir = Math.random() < 0.5 ? 1 : -1; this.creatures.push({ k, x: dir > 0 ? -30 : 990, y: k === "flamingo" ? 300 : k === "pigeon" ? 120 : k === "ghost" ? 200 : 468, vx: dir * (k === "raccoon" ? 150 : 55), age: 0, until: t + secs }); }
  spawnTarget(k: Target["k"]): void {
    const dir = Math.random() < 0.5 ? 1 : -1, def: Record<Target["k"], { r: number; hp: number; pay: number; y: number; sp: number }> = { piggy: { r: 26, hp: 3, pay: 6, y: 170, sp: 70 }, atm: { r: 28, hp: 5, pay: 12, y: 215, sp: 40 }, pukeko: { r: 22, hp: 4, pay: 25, y: 140, sp: 110 }, chest: { r: 26, hp: 6, pay: 40, y: 240, sp: 30 }, bauble: { r: 18, hp: 1, pay: 3, y: 120, sp: 90 } };
    const d = def[k]; this.targets.push({ k, x: dir > 0 ? -30 : 990, y: d.y + rnd(-20, 40), vx: dir * d.sp, hp: d.hp, max: d.hp, r: d.r, pay: d.pay, flash: 0 });
  }
  /** A banknote or round lands at (x, y) worth v: damage any target there and return what it paid out. */
  hit(x: number, y: number, v: number): number {
    let pay = 0;
    for (const tg of this.targets) {
      if (tg.hp <= 0 || Math.hypot(tg.x - x, tg.y - y) > tg.r + 12) continue;
      tg.hp--; tg.flash = 0.2; this.burst("spark", tg.x, tg.y, 8, 120, { cols: ["#f6b62c", "#f6f4f3"] });
      if (tg.hp <= 0) { pay += tg.pay * v; this.burst("coin", tg.x, tg.y, 26, 220, { ay: 380, sz: 1.1 }); this.burst("bill", tg.x, tg.y, 14, 160, { ay: 260, cols: ["#7dcf94", "#c74d57"] }); this.shake = 0.35; this.say(`${tg.k === "pukeko" ? "GOLDEN PUKEKO DOWN" : tg.k === "chest" ? "TREASURE CHEST" : tg.k === "atm" ? "ATM CRACKED" : tg.k === "piggy" ? "PIGGY BANK SMASHED" : "BAUBLE POPPED"}! +$${tg.pay * v}`, 2.4); }
    }
    return pay;
  }

  update(dt: number, t: number): void {
    const d = this.slowmo > 0 ? 0.4 : 1, step = dt * d;
    for (const p of this.parts) {
      p.age += step; p.vy += p.ay * step; p.x += p.vx * step; p.y += p.vy * step; p.r += p.vr * step; p.w += step * 3;
      if (p.k === "confetti" || p.k === "petal" || p.k === "feather" || p.k === "snow" || p.k === "streamer") { p.x += Math.sin(p.w + p.r) * 24 * step; p.vy = Math.min(p.vy, 90); }
      if (p.k === "bubble" || p.k === "balloon") p.x += Math.sin(p.w) * 16 * step;
      if (p.k === "rocket" && p.vy > -20 && p.age > 0.2) { this.burst("spark", p.x, p.y, 36, 190, { cols: [p.col, "#f6f4f3", pick(PARTY)], ay: 120, life: 1.1 }); p.age = p.life; this.flash = Math.max(this.flash, 0.25); }
      if (p.k === "foam" && p.y > 470) p.vy = 0;
    }
    this.parts = this.parts.filter((p) => p.age < p.life && p.y < 560 && p.y > -80);
    for (const c of this.creatures) { c.age += dt; c.x += c.vx * dt; if (c.k === "raccoon" && Math.random() < dt * 3) this.emit("spark", c.x, c.y - 8, 1, { cols: ["#f6b62c"], sz: 0.7 }); }
    this.creatures = this.creatures.filter((c) => t < c.until && c.x > -80 && c.x < 1040);
    for (const g of this.targets) { g.x += g.vx * dt; g.flash = Math.max(0, g.flash - dt); }
    this.targets = this.targets.filter((g) => g.hp > 0 && g.x > -60 && g.x < 1020);
    for (const k of ["strobe", "blackout", "wash", "lasers", "disco", "spot", "uv", "kaleido", "fog", "bolt", "shake", "slowmo", "flash", "flames"] as const) this[k] = Math.max(0, this[k] - dt);
    if (this.flames > 0) for (const x of [190, 330, 630, 770]) this.emit("flame", x + rnd(-8, 8), 335, 2, { vy: -60, sx: 20, sy: 30, sz: 1.3 });
    if (this.fog > 0 && Math.random() < dt * 25) this.emit("smoke", rnd(250, 710), 330, 1, { sx: 30, sy: 5, sz: 2.2 });
  }

  /** Lights and screen-wide effects, drawn over the stage. */
  drawOver(g: CanvasRenderingContext2D, t: number, W: number, H: number): void {
    if (this.uv > 0) { g.fillStyle = "rgba(40,0,90,.5)"; g.fillRect(0, 0, W, H); }
    if (this.wash > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(0.5, this.wash * 0.4); g.fillStyle = `hsl(${(t * 90) % 360},90%,50%)`; g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    if (this.kaleido > 0) { g.globalAlpha = 0.18; for (let k = 0; k < 10; k++) { const a = t * 0.6 + k * 0.63; g.fillStyle = `hsl(${(k * 36 + t * 60) % 360},90%,55%)`; g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + Math.cos(a) * 700, H / 2 + Math.sin(a) * 700); g.lineTo(W / 2 + Math.cos(a + 0.3) * 700, H / 2 + Math.sin(a + 0.3) * 700); g.fill(); } g.globalAlpha = 1; }
    if (this.lasers > 0) { g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.strokeStyle = k % 2 ? "rgba(80,255,160,.85)" : "rgba(255,60,120,.85)"; g.shadowColor = g.strokeStyle as string; g.shadowBlur = 8; const a = Math.sin(t * 1.7 + k) * 0.9 + (k - 4) * 0.22; g.beginPath(); g.moveTo(480 + (k - 4) * 60, 0); g.lineTo(480 + (k - 4) * 60 + Math.sin(a) * 900, 520); g.stroke(); } g.shadowBlur = 0; }
    if (this.disco > 0) {
      const k = Math.min(1, (this.disco) / 1.2), y = 62 * Math.min(1, (6 - this.disco + 0.1) / 1) ;
      void k; g.fillStyle = "#cfd6dc"; g.beginPath(); g.arc(480, Math.min(80, y + 30), 26, 0, 6.283); g.fill(); g.strokeStyle = "#667"; g.beginPath(); g.moveTo(480, 0); g.lineTo(480, Math.min(80, y + 30) - 26); g.stroke();
      for (let i = 0; i < 26; i++) { const a = t * 0.9 + i * 0.52, rr = 80 + (i % 5) * 70; g.fillStyle = `hsla(${(i * 47) % 360},90%,70%,.55)`; g.beginPath(); g.arc(480 + Math.cos(a) * rr * 1.3, 250 + Math.sin(a * 1.3) * rr * 0.55, 6, 0, 6.283); g.fill(); }
    }
    if (this.spot > 0) { const gr = g.createRadialGradient(this.spotX, 290, 10, this.spotX, 290, 120); gr.addColorStop(0, "rgba(255,244,200,.5)"); gr.addColorStop(1, "rgba(255,244,200,0)"); g.fillStyle = gr; g.fillRect(this.spotX - 140, 120, 280, 260); }
    if (this.blackout > 0) { const on = this.strobe > 0 || (Math.floor(t * 9) % 5 === 0); g.fillStyle = `rgba(0,0,0,${on ? 0.6 : 0.93})`; g.fillRect(0, 0, W, H); }
    if (this.strobe > 0 && Math.floor(t * 14) % 2 === 0) { g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(0, 0, W, H); }
    if (this.bolt > 0) { g.strokeStyle = "#f6f4ff"; g.lineWidth = 4; g.shadowColor = "#bcd"; g.shadowBlur = 16; g.beginPath(); let x = this.boltX, y = 0; g.moveTo(x, y); while (y < 330) { x += rnd(-26, 26); y += rnd(22, 40); g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; g.fillStyle = `rgba(230,235,255,${Math.min(0.55, this.bolt * 1.4)})`; g.fillRect(0, 0, W, H); }
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash * 1.4)})`; g.fillRect(0, 0, W, H); }
    const nowS = performance.now() / 1000;
    if (nowS < this.bannerUntil && this.banner) { g.font = "900 34px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = "#c74d57"; g.shadowBlur = 16; g.globalAlpha = Math.min(1, (this.bannerUntil - nowS) * 2); g.fillText(this.banner, W / 2, 150); g.globalAlpha = 1; g.shadowBlur = 0; }
  }

  /** Particles, creatures and targets. */
  drawParts(g: CanvasRenderingContext2D, t: number): void {
    for (const k of this.targets) this.drawTarget(g, k, t);
    for (const c of this.creatures) this.drawCreature(g, c);
    for (const p of this.parts) {
      const f = 1 - p.age / p.life; g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      switch (p.k) {
        case "bill": g.fillStyle = p.col; g.fillRect(-8, -4, 16, 8); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-5, -2, 10, 4); break;
        case "coin": g.scale(Math.abs(Math.cos(p.w * 2)) + 0.15, 1); g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(0, 0, 5 * p.sz, 0, 6.283); g.fill(); g.strokeStyle = "#a87510"; g.lineWidth = 1; g.stroke(); break;
        case "confetti": g.fillStyle = p.col; g.fillRect(-3, -2, 6, 4); break;
        case "streamer": g.strokeStyle = p.col; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(8, 0, 0, 14); g.stroke(); break;
        case "balloon": g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, 11 * p.sz, 14 * p.sz, 0, 0, 6.283); g.fill(); g.strokeStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.moveTo(0, 14 * p.sz); g.lineTo(0, 30 * p.sz); g.stroke(); break;
        case "bubble": g.strokeStyle = "rgba(220,240,255,.8)"; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 8 * p.sz, 0, 6.283); g.stroke(); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-3, -4, 2, 2); break;
        case "glitter": case "star": g.globalAlpha = (Math.sin(p.w * 3) * 0.5 + 0.5) * f; g.fillStyle = p.col; g.fillRect(-1.5, -1.5, 3 * p.sz, 3 * p.sz); if (p.k === "star") { g.fillRect(-5, -0.5, 10, 1); g.fillRect(-0.5, -5, 1, 10); } break;
        case "spark": g.globalAlpha = f; g.fillStyle = p.col; g.fillRect(-1.5, -1.5, 3, 3); break;
        case "flame": { g.globalAlpha = f * 0.8; const gr = g.createRadialGradient(0, 0, 0, 0, 0, 12 * p.sz); gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.4, "#ff9a3d"); gr.addColorStop(1, "rgba(200,40,20,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 12 * p.sz, 0, 6.283); g.fill(); break; }
        case "smoke": { g.globalAlpha = f * 0.3; const rr = 14 + p.age * 22 * p.sz, gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, "rgba(235,232,230,.7)"); gr.addColorStop(1, "rgba(235,232,230,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, 6.283); g.fill(); break; }
        case "snow": g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, 2.2 * p.sz, 0, 6.283); g.fill(); break;
        case "petal": g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, 6.283); g.fill(); break;
        case "heart": g.globalAlpha = Math.min(1, f * 1.6); g.fillStyle = p.col; g.scale(p.sz, p.sz); g.beginPath(); g.moveTo(0, 4); g.bezierCurveTo(-9, -3, -5, -10, 0, -5); g.bezierCurveTo(5, -10, 9, -3, 0, 4); g.fill(); break;
        case "feather": g.strokeStyle = p.col; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -5, 8, 0); g.stroke(); break;
        case "rocket": g.fillStyle = "#f6f4f3"; g.fillRect(-1.5, -6, 3, 12); g.fillStyle = "#ff9a3d"; g.fillRect(-1.5, 6, 3, 4 + Math.random() * 6); break;
        case "foam": g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(0, 0, 6 * p.sz, 0, 6.283); g.fill(); break;
      }
      g.restore(); g.globalAlpha = 1;
    }
  }

  private drawTarget(g: CanvasRenderingContext2D, k: Target, t: number): void {
    g.save(); g.translate(k.x, k.y + Math.sin(t * 3 + k.x * 0.02) * 4); if (k.flash > 0) g.globalAlpha = 0.6;
    const hpBar = (): void => { g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(-18, -k.r - 12, 36, 5); g.fillStyle = "#7dcf94"; g.fillRect(-18, -k.r - 12, 36 * (k.hp / k.max), 5); };
    switch (k.k) {
      case "piggy": g.fillStyle = "#f2a0b4"; g.beginPath(); g.ellipse(0, 0, 26, 19, 0, 0, 6.283); g.fill(); g.beginPath(); g.moveTo(-14, -14); g.lineTo(-8, -26); g.lineTo(-2, -16); g.fill(); g.fillStyle = "#e57f98"; g.beginPath(); g.ellipse(24, 2, 8, 6, 0, 0, 6.283); g.fill(); g.fillStyle = "#222"; g.fillRect(-6, -19, 12, 3); g.fillRect(14, -6, 3, 3); g.fillRect(-18, 15, 6, 8); g.fillRect(8, 15, 6, 8); break;
      case "atm": g.fillStyle = "#5c6168"; g.fillRect(-20, -26, 40, 52); g.fillStyle = "#1ec8a0"; g.fillRect(-14, -20, 28, 16); g.fillStyle = "#222"; g.fillRect(-12, 6, 24, 5); g.fillStyle = "#c74d57"; g.font = "700 9px monospace"; g.textAlign = "center"; g.fillText("ATM", 0, 22); break;
      case "pukeko": g.fillStyle = "#f6b62c"; g.shadowColor = "#f6b62c"; g.shadowBlur = 14; g.beginPath(); g.ellipse(0, 0, 20, 14, -0.3, 0, 6.283); g.fill(); g.beginPath(); g.arc(16, -14, 7, 0, 6.283); g.fill(); g.fillStyle = "#c74d57"; g.beginPath(); g.moveTo(22, -15); g.lineTo(32, -11); g.lineTo(22, -9); g.fill(); g.fillRect(-3, 12, 3, 12); g.fillRect(5, 12, 3, 12); g.shadowBlur = 0; break;
      case "chest": g.fillStyle = "#7a4a22"; g.fillRect(-24, -8, 48, 28); g.fillStyle = "#946030"; g.beginPath(); g.ellipse(0, -8, 24, 12, 0, Math.PI, 0); g.fill(); g.fillStyle = "#f6b62c"; g.fillRect(-4, -4, 8, 10); g.strokeStyle = "#f6b62c"; g.lineWidth = 2; g.strokeRect(-24, -8, 48, 28); break;
      case "bauble": g.fillStyle = "#c74d57"; g.beginPath(); g.arc(0, 0, 16, 0, 6.283); g.fill(); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-8, -9, 6, 6); g.fillStyle = "#f6b62c"; g.fillRect(-3, -20, 6, 6); break;
    }
    if (k.max > 1) hpBar(); g.restore(); g.globalAlpha = 1;
  }

  private drawCreature(g: CanvasRenderingContext2D, c: Creature): void {
    g.save(); g.translate(c.x, c.y); if (c.vx < 0) g.scale(-1, 1); const b = Math.sin(c.age * 14);
    if (c.k === "raccoon") { g.fillStyle = "#6a6f78"; g.beginPath(); g.ellipse(0, -10, 16, 9, 0, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(-20, -12 + b, 12, 4, -0.4, 0, 6.283); g.fill(); g.fillStyle = "#2b2d33"; g.fillRect(-26, -14 + b, 4, 3); g.fillStyle = "#6a6f78"; g.beginPath(); g.arc(14, -14, 8, 0, 6.283); g.fill(); g.fillStyle = "#15171b"; g.fillRect(9, -17, 12, 5); g.fillStyle = "#fff"; g.fillRect(12, -16, 2, 2); g.fillRect(17, -16, 2, 2); g.fillStyle = "#c74d57"; g.fillRect(8, -5, 14, 3); g.fillRect(-8, 0, 3, 6 + b); g.fillRect(6, 0, 3, 6 - b); }
    else if (c.k === "flamingo") { g.fillStyle = "#ff6fa5"; g.beginPath(); g.ellipse(0, -60, 24, 30, 0, 0, 6.283); g.fill(); g.lineWidth = 7; g.strokeStyle = "#ff6fa5"; g.beginPath(); g.moveTo(14, -80); g.quadraticCurveTo(46, -120, 22, -150); g.stroke(); g.fillStyle = "#ff6fa5"; g.beginPath(); g.arc(22, -152, 9, 0, 6.283); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.moveTo(28, -152); g.lineTo(44, -146); g.lineTo(28, -144); g.fill(); g.fillRect(-4, -30 + b, 3, 30); g.fillRect(8, -30 - b, 3, 30); }
    else if (c.k === "chicken") { g.fillStyle = "#f4efe2"; g.beginPath(); g.ellipse(0, -16, 15, 12, 0, 0, 6.283); g.fill(); g.beginPath(); g.arc(13, -28 + b, 8, 0, 6.283); g.fill(); g.fillStyle = "#c74d57"; g.fillRect(10, -38 + b, 8, 5); g.fillStyle = "#f6b62c"; g.beginPath(); g.moveTo(20, -28 + b); g.lineTo(29, -26 + b); g.lineTo(20, -24 + b); g.fill(); g.fillRect(-4, -5, 2, 6 + b); g.fillRect(4, -5, 2, 6 - b); g.strokeStyle = "#f4efe2"; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, -18); g.lineTo(-18, -26 + b * 2); g.stroke(); }
    else if (c.k === "pigeon") { g.fillStyle = "#8b93a3"; g.beginPath(); g.ellipse(0, 0, 11, 7, 0, 0, 6.283); g.fill(); g.beginPath(); g.arc(10, -4, 4, 0, 6.283); g.fill(); g.strokeStyle = "#8b93a3"; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-10, -10 - b * 6); g.moveTo(2, 0); g.lineTo(-2, -12 + b * 6); g.stroke(); }
    else { g.globalAlpha = 0.65; g.fillStyle = "#e8eef8"; g.beginPath(); g.arc(0, -30, 16, Math.PI, 0); g.lineTo(16, 0); for (let i = 0; i < 4; i++) g.lineTo(16 - (i + 1) * 8, i % 2 ? 0 : -6); g.fill(); g.fillStyle = "#222"; g.fillRect(-7, -32, 4, 5); g.fillRect(3, -32, 4, 5); g.globalAlpha = 1; }
    g.restore();
  }
}

/** The fifty actions. Each one changes the scene right now. */
const A = (id: string, label: string, icon: string, cost: number, cd: number, group: string, run: ClubAction["run"]): ClubAction => ({ id, label, icon, cost, cd, group, run });
const stage = (api: FxApi): { name: string; x: number; y: number }[] => { const d = api.dancers(); return d.length ? d : [{ name: "", x: 480, y: 300 }]; };
const rain = (fx: ClubFx, k: FxKind, n: number, o: Parameters<ClubFx["emit"]>[4] = {}): void => { for (let i = 0; i < n; i++) fx.emit(k, rnd(40, 920), rnd(-40, 20), 1, { vy: rnd(10, 80), sx: 20, sy: 10, ...o }); };
export const ACTIONS: ClubAction[] = [
  // ---- cash
  A("rain", "Make it rain", "💸", 50, 4, "Cash", (fx, api) => { rain(fx, "bill", 70, { cols: ["#7dcf94", "#c74d57", "#d8c27a"] }); api.hype(0.25); api.give(50); api.say("DJ|IT'S RAINING MONEY! Nobody tell the ATM!"); }),
  A("cannon", "Cash cannon", "💥", 200, 6, "Cash", (fx, api) => { for (let i = 0; i < Math.max(1, stage(api).length); i++) fx.burst("bill", 480, 490, 22, 360, { ay: 300, cols: ["#7dcf94", "#d8c27a"] }); fx.shake = 0.4; api.hype(0.35); api.give(200); api.say("MC|The cash cannon! Brace! Duck! Don't duck, that's where the money is!"); }),
  A("coins", "Gold coin shower", "🪙", 100, 5, "Cash", (fx, api) => { rain(fx, "coin", 90, { ay: 260 }); api.give(100); api.say("DJ|Chocolate coins? No. REAL gold-coloured coins. Bonk."); }),
  A("tornado", "Money tornado", "🌪️", 300, 8, "Cash", (fx, api) => { for (let i = 0; i < 70; i++) { const a = i * 0.45; fx.emit("bill", 480 + Math.cos(a) * i * 3, 330 - i * 2.4, 1, { vx: Math.cos(a + 1.6) * 160, vy: Math.sin(a + 1.6) * 90 - 120, ay: 40, life: 3, cols: ["#7dcf94", "#d8c27a"] }); } api.hype(0.4); api.give(300); api.say("PATRON|A MONEY TORNADO! Get the cows! There are no cows!"); }),
  A("atm", "Piñata ATM", "🏧", 150, 12, "Cash", (fx, api) => { fx.spawnTarget("atm"); api.say("DJ|An ATM piñata! Shoot it with the money gun for a jackpot!"); }),
  A("piggy", "Piggy bank parade", "🐷", 80, 10, "Cash", (fx, api) => { fx.spawnTarget("piggy"); fx.spawnTarget("piggy"); api.say("MC|Piggy banks on parade! Break them for the savings!"); }),
  A("pukeko", "Golden pukeko flyby", "🐦", 400, 20, "Cash", (fx, api) => { fx.spawnTarget("pukeko"); api.say("MC|The GOLDEN PUKEKO! Worth ten times your stake. Hit it four times!"); }),
  A("chest", "Treasure chest", "🧰", 250, 15, "Cash", (fx, api) => { fx.spawnTarget("chest"); api.say("DJ|A treasure chest! It is very, very well defended by gravity."); }),
  A("baubles", "Bauble barrage", "🎄", 60, 8, "Cash", (fx, api) => { for (let i = 0; i < 5; i++) setTimeout(() => fx.spawnTarget("bauble"), i * 400); api.say("MC|Shiny things! Pop them for pocket change!"); }),
  A("round", "Buy the house a round", "🍻", 300, 25, "Cash", (fx, api) => { fx.setCrowd("cheer", performance.now() / 1000 + 8); fx.emit("bubble", 480, 480, 14, { sx: 300, sy: 20 }); api.hype(0.3); api.mood(0.1); api.say("PATRON|THE HERO OF PUKEKO STREET! Free drinks!||BARTENDER|Somebody's paying. Don't make eye contact with the till."); }),
  // ---- lights
  A("strobe", "Strobe", "⚡", 20, 8, "Lights", (fx) => { fx.strobe = 4; }),
  A("lasers", "Laser show", "🔦", 60, 10, "Lights", (fx, api) => { fx.lasers = 9; api.say("DJ|LASERS. Please do not look directly at the vibes."); }),
  A("disco", "Disco ball drop", "🪩", 80, 12, "Lights", (fx, api) => { fx.disco = 10; api.hype(0.15); api.say("DJ|The mirror ball descends. 1977 called, it wants its ball back."); }),
  A("chase", "Spotlight chase", "🎯", 30, 6, "Lights", (fx, api) => { const d = stage(api); fx.spot = 6; fx.spotX = pick(d).x; api.say("MC|And the spotlight finds... you know who you are."); }),
  A("wash", "Rainbow wash", "🌈", 40, 8, "Lights", (fx) => { fx.wash = 8; }),
  A("blackout", "Blackout and flash", "🌑", 40, 10, "Lights", (fx, api) => { fx.blackout = 4; fx.strobe = 0; api.say("PATRON|Who turned off the lights?||BARTENDER|The bill did."); }),
  A("uv", "Blacklight", "🟣", 30, 12, "Lights", (fx, api) => { fx.uv = 10; api.say("DJ|Blacklight on! Everyone's teeth look amazing. Everyone's shirt looks like a crime scene."); }),
  A("kaleido", "Kaleidoscope", "🔮", 70, 12, "Lights", (fx) => { fx.kaleido = 9; }),
  // ---- effects
  A("confetti", "Confetti cannon", "🎉", 30, 4, "Effects", (fx, api) => { fx.burst("confetti", 480, 330, 120, 330, { ay: 140, life: 4 }); api.hype(0.12); }),
  A("streamers", "Streamers", "🎊", 25, 5, "Effects", (fx) => { for (const x of [60, 300, 660, 900]) fx.burst("streamer", x, 40, 14, 160, { ay: 120, life: 3.5 }); }),
  A("balloons", "Balloon drop", "🎈", 40, 8, "Effects", (fx, api) => { rain(fx, "balloon", 40, { ay: -20, vy: 20 }); api.say("MC|A balloon drop! Please don't pop them with your knee."); }),
  A("bubbles", "Bubble machine", "🫧", 25, 6, "Effects", (fx) => { for (const x of [60, 480, 900]) fx.emit("bubble", x, 470, 20, { sx: 120, sy: 20 }); }),
  A("glitter", "Glitter bomb", "✨", 45, 6, "Effects", (fx, api) => { fx.burst("glitter", 480, 280, 200, 260, { ay: 50, life: 3.5, cols: ["#f6f4f3", "#f6b62c", "#c74d57"] }); api.say("PATRON|I will be finding glitter in my life until 2041."); }),
  A("fireworks", "Indoor fireworks", "🎆", 150, 8, "Effects", (fx, api) => { for (let i = 0; i < 5; i++) setTimeout(() => fx.emit("rocket", rnd(220, 740), 480, 1, { vy: -rnd(300, 380), vx: rnd(-30, 30), ay: 200, life: 2, cols: PARTY }), i * 260); api.say("MC|Fireworks. Indoors. The fire warden has been informed. He is thrilled."); }),
  A("flames", "Flame jets", "🔥", 120, 10, "Effects", (fx, api) => { fx.flames = 3.5; fx.shake = 0.3; api.hype(0.2); api.say("DJ|FLAME JETS! Eyebrows are optional!"); }),
  A("sparks", "Cold spark fountains", "🎇", 70, 8, "Effects", (fx) => { for (const x of [250, 710]) fx.burst("spark", x, 330, 90, 260, { ay: 420, life: 1.6, cols: ["#f6f4f3", "#f6b62c"] }); }),
  A("smoke", "Smoke burst", "💨", 20, 6, "Effects", (fx) => { fx.fog = 5; }),
  A("snow", "Snow machine", "❄️", 40, 10, "Effects", (fx, api) => { rain(fx, "snow", 160, { ay: 18, vy: 30, life: 8 }); api.say("MC|It's snowing in the Pukeko. Mum said never to snow indoors."); }),
  A("petals", "Rose petals", "🌹", 50, 8, "Effects", (fx, api) => { rain(fx, "petal", 120, { cols: ["#c74d57", "#a0323b", "#d8c27a"], ay: 30, vy: 20, life: 7 }); api.say("PEARL|Petals. Classy. Someone get a broom later."); }),
  A("hearts", "Love hearts", "💗", 30, 5, "Effects", (fx, api) => { for (const d of stage(api)) fx.emit("heart", d.x, d.y - 60, 8, { cols: ["#ff6fa5", "#c74d57"], vy: -50, ay: -20, sx: 50, sy: 20, life: 2.6, sz: 1.4 }); }),
  A("feathers", "Feather storm", "🪶", 35, 6, "Effects", (fx) => { rain(fx, "feather", 110, { cols: ["#f6f4f3", "#ff9fc2", "#d2ccc7"], ay: 25, vy: 25, life: 7 }); }),
  A("lightning", "Lightning strike", "🌩️", 90, 9, "Effects", (fx, api) => { fx.bolt = 0.4; fx.boltX = rnd(260, 700); fx.shake = 0.5; api.say("PATRON|THE ROOF! Is it supposed to do that?||MC|Part of the show. Mostly."); }),
  // ---- dancers
  A("encore", "Encore! Burlesque revue", "🎭", 200, 40, "Dancers", (_fx, api) => { api.revue(); api.say("MC|The crowd demands an ENCORE! Cue the revue!"); }),
  A("pole", "Pole trick", "🌀", 60, 10, "Dancers", (fx, api) => { api.dancer("Velocity", "pole"); fx.spot = 5; fx.spotX = 480; api.say("VELOCITY|Watch the pole. Not the hands. The POLE."); }),
  A("costume", "Costume change", "👗", 80, 12, "Dancers", (fx, api) => { api.costume(); fx.flash = 0.25; fx.burst("glitter", 480, 280, 80, 220, { life: 2.2 }); api.say("MC|Quick change! Four seconds! Don't look at the wings!"); }),
  A("kick", "Kick line", "🦵", 70, 25, "Dancers", (fx, api) => { api.revue(); fx.say("KICK LINE!"); }),
  A("spin", "Spin! Spin! Spin!", "🌪", 40, 6, "Dancers", (fx, api) => { for (const d of stage(api)) api.dancer(d.name, "spin"); fx.burst("star", 480, 260, 24, 150, { life: 1.8 }); }),
  A("strut", "Catwalk strut", "👠", 50, 10, "Dancers", (_fx, api) => { api.dancer("Crystal", "strut"); api.say("CRYSTAL|Out of my way, I've got a catwalk to own."); }),
  A("kiss", "Blow a kiss", "😘", 30, 5, "Dancers", (fx, api) => { for (const d of stage(api)) { api.dancer(d.name, "kiss"); fx.emit("heart", d.x + 20, d.y - 70, 4, { cols: ["#ff6fa5"], vy: -60, ay: -10, life: 2, sz: 1.2 }); } api.mood(0.08); }),
  A("tango", "Dip and tango", "💃", 120, 20, "Dancers", (fx, api) => { api.dancer("Shazza", "bow"); api.dancer("Destiny", "bow"); fx.spot = 6; fx.spotX = 470; fx.emit("petal", 470, 200, 40, { cols: ["#c74d57"], sx: 80, sy: 30, ay: 40, life: 5 }); api.say("MC|A tango! Eyes locked, hips lethal, somebody's glasses fogging up."); }),
  // ---- crowd and bar
  A("wave", "Crowd wave", "🌊", 20, 12, "Crowd", (fx, api) => { fx.setCrowd("wave", performance.now() / 1000 + 8); api.say("PATRON|Start the wave! You start it! No, YOU start it!"); }),
  A("chant", "Chant", "📣", 20, 12, "Crowd", (fx, api) => { fx.setCrowd("chant", performance.now() / 1000 + 8); api.say("PATRON|PU-KE-KO! PU-KE-KO!||MC|That's not even a chant. Keep going."); }),
  A("mosh", "Mosh pit", "🤘", 30, 14, "Crowd", (fx, api) => { fx.setCrowd("mosh", performance.now() / 1000 + 8); fx.shake = 0.2; api.say("BOUNCER|Oi. This is a burlesque house, not a rugby scrum.||PATRON|Wrong. It's both."); }),
  A("conga", "Conga line", "🐍", 25, 14, "Crowd", (fx, api) => { fx.setCrowd("conga", performance.now() / 1000 + 10); api.say("DJ|CONGA! Hands on hips, everyone's a hip!"); }),
  A("shots", "Round of shots", "🥃", 120, 20, "Crowd", (fx, api) => { fx.setCrowd("drunk", performance.now() / 1000 + 14); fx.emit("bubble", 135, 400, 10, { sx: 40 }); api.say("BARTENDER|Jager, tequila, regret. Down in one.||PATRON|Why is the floor moving?"); }),
  A("champagne", "Champagne spray", "🍾", 180, 15, "Crowd", (fx, api) => { fx.burst("foam", 480, 400, 80, 280, { ay: 360, life: 1.8 }); fx.burst("bubble", 480, 400, 20, 120, { life: 3 }); api.hype(0.2); api.say("MC|Pop! Champagne all over the front row. They've paid for the dry-cleaning. In spirit."); }),
  A("karaoke", "Karaoke mic", "🎤", 40, 18, "Crowd", (fx, api) => { fx.setCrowd("cheer", performance.now() / 1000 + 8); api.say("PATRON|♪ I'm so excited... ♪||DJ|That's a different song, mate. That's ALL of the different songs."); }),
  // ---- mischief
  A("raccoon", "Release the raccoon", "🦝", 20, 15, "Mischief", (fx, api) => { fx.creature("raccoon", performance.now() / 1000, 9); api.say("BARTENDER|Who let the raccoon in?||BOUNCER|He had a nice jacket. I assumed he was on the list."); }),
  A("flamingo", "Inflatable flamingo", "🦩", 30, 15, "Mischief", (fx, api) => { fx.creature("flamingo", performance.now() / 1000, 16); api.say("MC|The inflatable flamingo has joined the show. He demands the same rate as the dancers."); }),
  A("chicken", "Dancing chicken", "🐔", 25, 15, "Mischief", (fx, api) => { fx.creature("chicken", performance.now() / 1000, 14); api.say("PATRON|There is a chicken on the stage.||MC|Her name is Doris. She goes on at eleven."); }),
];
export const ACTION_GROUPS = ["Cash", "Lights", "Effects", "Dancers", "Crowd", "Mischief"] as const;
export const AMMO = [
  { id: "notes", label: "Notes", mult: 1 }, { id: "coins", label: "Gold coins", mult: 1.2 }, { id: "bars", label: "Gold bars", mult: 3 }, { id: "confetti", label: "Confetti rounds", mult: 0.6 },
  { id: "hearts", label: "Heart rounds", mult: 0.8 }, { id: "glitter", label: "Glitter rounds", mult: 0.8 }, { id: "rockets", label: "Rockets", mult: 2 }, { id: "champagne", label: "Cork rounds", mult: 1.5 },
] as const;
export type AmmoId = (typeof AMMO)[number]["id"];
