/**
 * The Tessera's 3D roulette wheel. One persistent WebGL view that the casino re-attaches on every render.
 *
 * Look: lacquered ebony bowl, polished nickel hardware, oxblood felt, an ivory ball. All textures are
 * painted procedurally at start-up (no downloads). The shimmer is not loose sparkle: a glint band is
 * baked into the metal shader and travels round the rings, frets and turret, and an orbiting light
 * rakes the same metal while the ball is live. A win surges both.
 *
 * Motion mirrors a real wheel: the rotor spins one way, the ball the other along the track, then it
 * drops, rattles the frets and settles in the pocket the game already chose.
 */
import { planBall, BALL_R, type BallPlan } from './RouletteBallPhysics';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WHEEL_ORDER, colorOf } from '../casino/roulette';

const TAU = Math.PI * 2, N = WHEEL_ORDER.length, STEP = TAU / N;
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- procedural textures */
function paint(w: number, h: number, fn: (g: CanvasRenderingContext2D) => void, srgb = true, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Ebony with dark red figure, wrapping round the lathe. */
const woodTex = () => paint(1024, 256, g => {
  const r = rand(7); g.fillStyle = '#1b1110'; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 160; i++) {
    const y = r() * 256, a = .05 + r() * .12, w = .6 + r() * 2.4;
    g.strokeStyle = r() > .5 ? `rgba(92,38,32,${a})` : `rgba(8,4,4,${a * 1.6})`; g.lineWidth = w; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * .011 + i) * 4 + Math.sin(x * .043 + i * 3) * 1.5);
    g.stroke();
  }
});
/** Fine fibre noise used as the roughness map for lacquer and the ball, so highlights break up. */
const scuffTex = (base: number, spread: number) => paint(256, 256, g => {
  const r = rand(base), img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = base + (r() - .5) * spread; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${.05 + r() * .1})`; g.lineWidth = .5; g.beginPath(); const x = r() * 256, y = r() * 256; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 60, y + (r() - .5) * 60); g.stroke(); }
}, false, [3, 3]);
/** Brushed metal: long streaks in the roughness so the env reflection smears like nickel. */
const brushedTex = () => paint(512, 64, g => {
  const r = rand(3); g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 400; i++) { const y = r() * 64, v = 40 + r() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, 512, .6 + r()); }
}, false, [6, 1]);
/** Oxblood baize with fibre. */
const feltTex = () => paint(512, 512, g => {
  const r = rand(11), img = g.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) { const n = (r() - .5) * 18; img.data[i] = 70 + n; img.data[i + 1] = 18 + n * .4; img.data[i + 2] = 22 + n * .4; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 2200; i++) { g.strokeStyle = `rgba(${r() > .5 ? '255,200,200' : '0,0,0'},${.03 + r() * .05})`; g.lineWidth = .6; g.beginPath(); const x = r() * 512, y = r() * 512, a = r() * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
}, true, [8, 8]);
/** Pocket floor: lacquered colour with a soft vignette so each pocket reads as a cup. */
const pocketTex = (hex: string) => paint(128, 128, g => {
  g.fillStyle = hex; g.fillRect(0, 0, 128, 128);
  const v = g.createRadialGradient(64, 64, 10, 64, 64, 90); v.addColorStop(0, 'rgba(255,255,255,.08)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, 128, 128);
});
const labelCache = new Map<string, THREE.CanvasTexture>();
const labelTex = (s: string) => labelCache.get(s) ?? (labelCache.set(s, paint(128, 128, g => {
  g.font = `600 ${s.length > 1 ? 66 : 84}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(s, 64, 68); g.fillStyle = '#f4f1ec'; g.fillText(s, 64, 68);
})), labelCache.get(s)!);
const softDot = (inner: string) => paint(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, inner); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

/* ------------------------------------------------------------------ the component */
export interface WheelOptions { sound?: () => boolean }

export class RouletteWheel3D {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  private rotor = new THREE.Group();
  private pockets: THREE.MeshPhysicalMaterial[] = [];
  private ball: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private sweep = new THREE.PointLight(0xfff2ea, 0, 14, 1.4);
  private metalUniforms = { uTime: { value: 0 }, uEnergy: { value: .15 } };
  private confetti: { pts: THREE.Points; pos: Float32Array; col: Float32Array; vel: { l: number; x: number; y: number; z: number; vx: number; vy: number; vz: number }[]; next: number };
  private hud: { hist: HTMLElement; res: HTMLElement; msg: HTMLElement };
  // motion state
  private W = 0; private B = 0; private last = 0; private idle = .3; private energy = 0; private focus = 0; private shake = 0;
  private spinState: null | { t: number; dur: number; W0: number; wTot: number; plan: BallPlan; ev: number; dropped: boolean; target: number } = null;
  private lastBall = new THREE.Vector3(); private rollAxis = new THREE.Vector3();
  private highlight: { i: number; t: number } | null = null;
  private az = .35; private el0 = .95; private dist = 11.5; private drag: { x: number; y: number } | null = null;
  private raf = 0; private prev = 0; private idleSince = 0; private audio?: AudioContext;

  /** Returns null when WebGL is unavailable, so the casino can keep its 2D room instead. */
  static create(opts: WheelOptions = {}): RouletteWheel3D | null {
    try { return new RouletteWheel3D(opts); } catch { return null; }
  }

  private constructor(private opts: WheelOptions) {
    const canvas = document.createElement('canvas');
    canvas.className = 'rw3d-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'European roulette wheel in 3D. Drag to orbit, scroll to zoom.');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .9;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
    this.scene.environmentIntensity = .45;

    const hist = document.createElement('div'); hist.className = 'rw3d-hist'; hist.setAttribute('aria-label', 'Recent results');
    const res = document.createElement('div'); res.className = 'rw3d-res'; res.setAttribute('aria-hidden', 'true');
    const msg = document.createElement('div'); msg.className = 'rw3d-msg'; msg.setAttribute('role', 'status'); msg.textContent = 'Place your bets';
    const banner = document.createElement('div'); banner.className = 'rw3d-banner'; banner.append(res, msg);
    this.el = document.createElement('div'); this.el.className = 'rw3d'; this.el.append(canvas, hist, banner);
    this.hud = { hist, res, msg };

    this.build();
    this.ball = this.makeBall(); this.ballShadow = this.makeBallShadow();
    this.confetti = this.makeConfetti();
    this.bindCamera(canvas);
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.wake();
  }

  /* -------------------------------------------------------------- build the wheel */
  private metal(color = 0xd9d5cf, rough = .2): THREE.MeshPhysicalMaterial {
    const m = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, roughnessMap: brushedTex(), clearcoat: .4, clearcoatRoughness: .1 });
    // Glint band: a bright streak that travels round the wheel's axis across metal only.
    m.onBeforeCompile = shader => {
      shader.uniforms.uTime = this.metalUniforms.uTime; shader.uniforms.uEnergy = this.metalUniforms.uEnergy;
      shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'uniform float uTime;\nuniform float uEnergy;\nvarying vec3 vWPos;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float ang = atan(vWPos.z, vWPos.x);
        float band = pow(max(0.0, cos(ang - uTime * (0.6 + uEnergy * 2.2))), 60.0) + 0.6 * pow(max(0.0, cos(ang + 2.6 - uTime * 0.37)), 120.0);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
        totalEmissiveRadiance += vec3(1.0, 0.93, 0.9) * band * (0.25 + uEnergy * 1.6) * (0.4 + rim);`);
    };
    return m;
  }

  private build(): void {
    const S = this.scene;
    S.add(new THREE.HemisphereLight(0xf3ece6, 0x1a0c0c, .55));
    const key = new THREE.SpotLight(0xfff4ec, 90, 40, Math.PI / 5, .55, 1.6); key.position.set(2, 14, 4); key.target.position.set(0, 0, 0); S.add(key, key.target);
    const rimL = new THREE.DirectionalLight(0xcf4a52, .7); rimL.position.set(-8, 3, -6); S.add(rimL);
    S.add(this.sweep);

    // Table: oxblood felt with a nickel-trimmed rail
    const felt = new THREE.Mesh(new THREE.CircleGeometry(13, 96), new THREE.MeshStandardMaterial({ map: feltTex(), color: 0x6a5f5f, roughness: .95, metalness: 0 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = -.71; S.add(felt);

    const V = (a: number[][]) => a.map(p => new THREE.Vector2(p[0], p[1]));
    const wood = new THREE.MeshPhysicalMaterial({ map: woodTex(), roughness: .42, roughnessMap: scuffTex(140, 60), clearcoat: 1, clearcoatRoughness: .12, side: THREE.DoubleSide });
    S.add(new THREE.Mesh(new THREE.LatheGeometry(V([[.01, -.7], [5.6, -.7], [5.6, .45], [5.35, .78], [4.9, .82], [4.68, .7], [3.3, .02], [3.3, -.3], [.01, -.3]]), 128), wood));
    // The ball track: black lacquer the ball visibly runs on
    const track = new THREE.MeshPhysicalMaterial({ color: 0x0d0b0b, roughness: .28, roughnessMap: scuffTex(110, 80), metalness: .1, clearcoat: 1, clearcoatRoughness: .08, side: THREE.DoubleSide });
    S.add(new THREE.Mesh(new THREE.LatheGeometry(V([[3.3, .035], [4.66, .715]]), 128), track));

    const nickel = this.metal(), darkNickel = this.metal(0x8f8a85, .3);
    const ring = (r: number, y: number, t: number, m = nickel) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 160), m); o.rotation.x = Math.PI / 2; o.position.y = y; S.add(o); };
    ring(4.8, .8, .07); ring(3.3, .06, .05); ring(5.6, .45, .05, darkNickel);
    // Diamond deflectors on the track: classic, and they make the ball rattle believable
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + TAU / 16, d = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), nickel);
      d.scale.set(1, .45, 2.2); d.position.set(3.95 * Math.cos(a), .4, 3.95 * Math.sin(a)); d.rotation.y = -a; S.add(d);
    }

    // Rotor: cone, turret, cross handles, pocket ring
    this.scene.add(this.rotor);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.45, 2.1, .7, 96), new THREE.MeshPhysicalMaterial({ map: woodTex(), roughness: .35, clearcoat: 1, clearcoatRoughness: .1 }));
    cone.position.y = .4; this.rotor.add(cone);
    const coneTrim = new THREE.Mesh(new THREE.TorusGeometry(2.1, .04, 12, 128), nickel); coneTrim.rotation.x = Math.PI / 2; coneTrim.position.y = .06; this.rotor.add(coneTrim);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .7, 32), nickel); turret.position.y = 1; this.rotor.add(turret);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.2, 32, 20), nickel); knob.position.y = 1.4; this.rotor.add(knob);
    for (const a of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.4, 16), nickel); bar.rotation.z = Math.PI / 2; bar.rotation.y = a; bar.position.y = 1.05; this.rotor.add(bar);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), nickel); tip.position.set(Math.cos(a) * .7 * s, 1.05, -Math.sin(a) * .7 * s); this.rotor.add(tip); }
    }
    const w = STEP * 2.7 * .96, floor = new THREE.BoxGeometry(w, .05, 1.2), lab = new THREE.PlaneGeometry(.34, .34), fret = new THREE.BoxGeometry(.035, .17, 1.2);
    const tex = { red: pocketTex('#8a1d25'), black: pocketTex('#121010'), green: pocketTex('#3b3735') };
    WHEEL_ORDER.forEach((n, i) => {
      const a = i * STEP, g = new THREE.Group(); g.position.set(2.7 * Math.cos(a), 0, 2.7 * Math.sin(a)); g.rotation.y = Math.PI / 2 - a;
      const m = new THREE.MeshPhysicalMaterial({ map: tex[colorOf(n)], roughness: .3, clearcoat: 1, clearcoatRoughness: .15, emissive: new THREE.Color(0xff5560), emissiveIntensity: 0 });
      const f = new THREE.Mesh(floor, m); f.position.y = .025; g.add(f);
      const l = new THREE.Mesh(lab, new THREE.MeshBasicMaterial({ map: labelTex(String(n)), transparent: true, toneMapped: false })); l.rotation.x = -Math.PI / 2; l.position.set(0, .056, .4); g.add(l);
      const fr = new THREE.Mesh(fret, nickel); fr.position.set(w / 2, .085, 0); g.add(fr);
      this.rotor.add(g); this.pockets.push(m);
    });
  }

  private makeBall(): THREE.Mesh {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.13, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xf3eee4, roughness: .22, roughnessMap: scuffTex(90, 70), clearcoat: 1, clearcoatRoughness: .05, sheen: .3 }));
    this.scene.add(ball); return ball;
  }
  private makeBallShadow(): THREE.Mesh {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ map: softDot('rgba(0,0,0,.75)'), transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; this.scene.add(s); return s;
  }
  private makeConfetti() {
    const n = 320, pos = new Float32Array(n * 3).fill(-50), col = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .2, map: softDot('#fff'), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; this.scene.add(pts);
    return { pts, pos, col, vel: Array.from({ length: n }, () => ({ l: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })), next: 0 };
  }

  private bindCamera(c: HTMLCanvasElement): void {
    c.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (!this.drag) return; this.az -= (e.clientX - this.drag.x) * .006; this.el0 = Math.max(.35, Math.min(1.45, this.el0 + (e.clientY - this.drag.y) * .005)); this.drag = { x: e.clientX, y: e.clientY }; });
    for (const t of ['pointerup', 'pointercancel']) c.addEventListener(t, () => { this.drag = null; });
    c.addEventListener('wheel', e => { e.preventDefault(); this.dist = Math.max(7, Math.min(18, this.dist + e.deltaY * .01)); }, { passive: false });
  }
  private resize(): void {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < .9 ? 52 : 36; this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- public API */
  /** Restart the render loop after the casino re-renders and re-attaches the element. */
  wake(): void { if (!this.raf) { this.prev = 0; this.raf = requestAnimationFrame(t => this.frame(t)); } this.idleSince = 0; }

  /** Animate a spin that ends on `target` after `ms`. The game has already decided the result. */
  spin(target: number, ms: number): void {
    const tgt = WHEEL_ORDER.indexOf(target), wTot = TAU * (2 + Math.random() * 1.5), dur = Math.max(.3, ms / 1000), W0 = this.W;
    // The rotor's own motion. The ball is a physics simulation in that moving frame, searched so it comes to rest in the decided pocket.
    const Wf = (t: number) => W0 + wTot * (1 - Math.pow(1 - Math.min(t / dur, 1), 2.2));
    const Wd = (t: number) => { const u = Math.min(t / dur, 1); return u >= 1 ? 0 : wTot * 2.2 * Math.pow(1 - u, 1.2) / dur; };
    const plan = planBall({ target: tgt, dur, N, STEP, W: Wf, Wd });
    this.spinState = { t: 0, dur, W0, wTot, plan, ev: 0, dropped: false, target: tgt };
    this.lastBall.copy(this.ball.position);
    this.highlight = null; this.hud.res.style.display = 'none'; this.message('No more bets'); this.tone(520, .25, 'triangle', .07, 880); this.wake();
  }

  /** Result reveal: pocket glow, banner, confetti and a metal shimmer surge on a win. */
  reveal(result: number, net: number, staked: number): void {
    const i = WHEEL_ORDER.indexOf(result); this.last = i; this.highlight = { i, t: performance.now() / 1000 };
    const r = this.hud.res; r.textContent = String(result); r.className = 'rw3d-res ' + colorOf(result); r.style.display = 'grid';
    if (net > 0) {
      const big = net >= Math.max(1000, staked * 10);
      this.message((big ? 'Big win  +' : 'You win  +') + '$' + net.toLocaleString('en-NZ'), big ? 'big' : 'win');
      this.burst(big ? 300 : 130); this.energy = big ? 2.4 : 1.6;
      [660, 880, 1320].forEach((f, k) => setTimeout(() => this.tone(f, .18, 'triangle', .07), k * 130));
      if (big) for (let k = 1; k < 5; k++) setTimeout(() => this.burst(60), 350 + k * 220);
    } else this.message(`${result} ${colorOf(result)} · ${net < 0 ? 'no win this time' : 'stake back'}`), this.tone(220, .35, 'sine', .06, 120);
    this.shake = .25; this.wake();
  }

  setHistory(results: readonly number[]): void {
    this.hud.hist.replaceChildren(...results.slice(0, 14).map(n => { const d = document.createElement('span'); d.className = 'rw3d-dot ' + colorOf(n); d.textContent = String(n); return d; }));
  }
  message(text: string, cls = ''): void { this.hud.msg.textContent = text; this.hud.msg.className = 'rw3d-msg' + (cls ? ' ' + cls : ''); }
  get spinning(): boolean { return !!this.spinState; }

  /* ---------------------------------------------------------------- per frame */
  private place(r: number, y: number, b: number, roll = false): void {
    this.ball.position.set(r * Math.cos(b), y, r * Math.sin(b));
    if (roll) { const dx = this.ball.position.x - this.lastBall.x, dz = this.ball.position.z - this.lastBall.z, d = Math.hypot(dx, dz); if (d > 1e-5 && d < 1.5) this.ball.rotateOnWorldAxis(this.rollAxis.set(dz, 0, -dx).normalize(), d / BALL_R); }
    this.lastBall.copy(this.ball.position);
    this.ballShadow.position.set(r * Math.cos(b) * 1.01, y - .12, r * Math.sin(b) * 1.01);
  }
  private frame(now: number): void {
    const t = now / 1000, dt = this.prev ? Math.min(t - this.prev, .05) : .016; this.prev = t;
    if (!this.el.isConnected && !this.spinState) { if (!this.idleSince) this.idleSince = t; if (t - this.idleSince > 1.5) { this.raf = 0; return; } }
    else this.idleSince = 0;
    this.raf = requestAnimationFrame(n => this.frame(n));
    const s = this.spinState;
    if (s) {
      s.t += dt; const u = Math.min(s.t / s.dur, 1), pl = s.plan;
      this.W = s.W0 + s.wTot * (1 - Math.pow(1 - u, 2.2));
      // Play back the simulated ball: smooth interpolation between 240 Hz samples.
      const f = Math.min(s.t / pl.dt, pl.n - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, pl.n - 1), k = f - i0;
      let b = pl.th[i0] + (pl.th[i1] - pl.th[i0]) * k, r = pl.r[i0] + (pl.r[i1] - pl.r[i0]) * k, y = pl.y[i0] + (pl.y[i1] - pl.y[i0]) * k;
      if (!s.dropped && s.t >= pl.dropAt - .35) { s.dropped = true; this.message('Ball’s dropping…'); }
      while (s.ev < pl.events.length && pl.events[s.ev].t <= s.t) {
        const e = pl.events[s.ev++], p = Math.min(1, e.power / 12);
        if (e.kind === 'fret') { this.tone(650 + Math.random() * 600, .05, 'triangle', .03 + .07 * p, 250); if (p > .5) this.shake = Math.max(this.shake, .06 * p); }
        else if (e.kind === 'deflector') { this.tone(1900 + Math.random() * 500, .04, 'square', .03 + .03 * p, 900); this.shake = Math.max(this.shake, .05); }
        else this.tone(300, .05, 'sine', .02 + .03 * p, 200);
      }
      if (u >= 1) { this.spinState = null; this.idle = 0; this.last = s.target; b = this.W + s.target * STEP; r = 2.75; y = .18; }
      this.B = b; this.place(r, y, b, true); this.focus += (smooth((u - .5) / .3) - this.focus) * Math.min(1, dt * 3);
    } else {
      this.idle += (.3 - this.idle) * Math.min(1, dt * .8); this.W += dt * this.idle * (reduced() ? .2 : 1);
      this.B = this.W + this.last * STEP; this.place(2.75, .18, this.B);
      this.focus += (0 - this.focus) * Math.min(1, dt * 1.5); if (!this.drag && !reduced()) this.az += dt * .03;
    }
    this.rotor.rotation.y = -this.W;

    // Metal shimmer: always a slow glint, faster and brighter while the ball is live or after a win.
    const target = s ? .9 : .15; this.energy += (target - this.energy) * Math.min(1, dt * (this.energy > target ? .6 : 2));
    this.metalUniforms.uTime.value = t; this.metalUniforms.uEnergy.value = this.energy;
    this.sweep.position.set(5.4 * Math.cos(t * 1.3), 2.6, 5.4 * Math.sin(t * 1.3)); this.sweep.intensity = 6 + this.energy * 22;

    for (let i = 0; i < N; i++) {
      let e = 0; if (s && i === Math.floor((((this.B - this.W) % TAU) + TAU) % TAU / STEP)) e = .25;
      if (this.highlight && this.highlight.i === i) { const k = t - this.highlight.t; e = k < 5 ? .55 + .45 * Math.sin(k * 8) : .3; }
      this.pockets[i].emissiveIntensity = e;
    }
    const c = this.confetti;
    for (let i = 0; i < c.vel.length; i++) { const p = c.vel[i]; if (p.l > 0) { p.l -= dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; c.pos.set([p.x, p.y, p.z], i * 3); } else c.pos[i * 3 + 1] = -50; }
    (c.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    this.shake *= Math.exp(-dt * 7); const d = this.dist * (1 - .2 * this.focus), j = () => (Math.random() - .5) * this.shake;
    this.camera.position.set(d * Math.cos(this.el0) * Math.sin(this.az) + j(), .3 + d * Math.sin(this.el0) + j(), d * Math.cos(this.el0) * Math.cos(this.az));
    this.camera.lookAt(0, .3, 0);
    if (this.el.isConnected) this.renderer.render(this.scene, this.camera);
  }

  private burst(n: number): void {
    const c = this.confetti, p0 = this.ball.position, pal = [[.81, .29, .32], [1, 1, 1], [.85, .83, .8], [.55, .1, .14]];
    for (let k = 0; k < n; k++) {
      const q = c.vel[c.next = (c.next + 1) % c.vel.length], a = Math.random() * TAU, sp = 2 + Math.random() * 4;
      Object.assign(q, { l: 2.5 + Math.random(), x: p0.x, y: p0.y + .3, z: p0.z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 5, vz: Math.sin(a) * sp });
      c.col.set(pal[k % pal.length], c.next * 3);
    }
    (c.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
  private tone(f: number, d = .1, type: OscillatorType = 'sine', v = .06, f2?: number): void {
    if (this.opts.sound && !this.opts.sound()) return;
    try {
      this.audio ??= new AudioContext(); const a = this.audio, n = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, n); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d);
      g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.0001, n + d); o.connect(g).connect(a.destination); o.start(); o.stop(n + d);
    } catch { /* audio is optional */ }
  }
}
