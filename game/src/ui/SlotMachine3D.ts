/**
 * The Tessera's 3D "Kiwi Gold" pokie. One persistent WebGL view that the casino re-attaches on every render
 * (same pattern as RouletteWheel3D).
 *
 * The machine is only the body and the show. The game keeps every decision: `spinReels()` picks the three
 * symbols, `payFor()` pays, chips are taken and credited in Casino.ts. This view just spins three real
 * cylindrical reels, lands each on the symbol the game already chose, and celebrates the win it is told about.
 *
 * Extras: six cabinet / carpet themes, a detachable rear service panel with live gears, pistons, flywheel and
 * escapement, an X-ray cutaway, three camera views, and a pull lever. Everything is painted procedurally.
 * There are no other machines on the floor: just this one, on carpet, behind a velvet rope.
 */
import * as THREE from 'three';
import type { Sym } from '../casino/slots';

const TAU = Math.PI * 2;
const PI = Math.PI;
const REEL_N = 12, STEP = TAU / REEL_N;
const REEL_R = 1.02, REEL_W = 1.3, REEL_GAP = 1.36, REEL_Y = 0.75, REEL_Z = 0.18;
const FLOOR_Y = -3.35;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 12 visual stops per cylinder. The game's weighted 32-stop strip decides the result; this only has to show every symbol. */
const STRIP: Sym[] = ['🍒', '🔔', '🥝', '7', '🍋', 'BAR', '🍒', '🔔', '🥝', '💎', '🍋', '7'];
const STYLE: Record<Sym, { bg: string; glow: string; rim: string }> = {
  '🍒': { bg: '#29121f', glow: '#f43f5e', rim: '#38bdf8' },
  '🍋': { bg: '#27240f', glow: '#facc15', rim: '#a3e635' },
  '🔔': { bg: '#241c12', glow: '#fbbf24', rim: '#fcd34d' },
  '🥝': { bg: '#0f261e', glow: '#34d399', rim: '#a3e635' },
  'BAR': { bg: '#1b1a29', glow: '#a78bfa', rim: '#f5c451' },
  '7': { bg: '#2b121c', glow: '#fb7185', rim: '#f5c451' },
  '💎': { bg: '#0f222e', glow: '#38bdf8', rim: '#2dd4bf' },
};

interface Theme { name: string; body: number; trim: number; a: number; b: number; c: number; gold: number; chrome: number; key: number; rim: number; intA: number; intB: number; bg: number; carpet: number }
const THEMES: Theme[] = [
  { name: 'Midnight Arcade', body: 0x172033, trim: 0xd4a44a, a: 0x38d9f5, b: 0xf472b6, c: 0x34d399, gold: 0xdba948, chrome: 0xb8c4d9, key: 0xdbeafe, rim: 0x38d9f5, intA: 0x38d9f5, intB: 0xf5c451, bg: 0x0a0d14, carpet: 0x4a3a8f },
  { name: 'Velvet Synth', body: 0x24172b, trim: 0xd99b82, a: 0x2dd4bf, b: 0xe879f9, c: 0xf472b6, gold: 0xe0a289, chrome: 0xd9c6d4, key: 0xfce7f3, rim: 0xe879f9, intA: 0xe879f9, intB: 0x2dd4bf, bg: 0x0d0914, carpet: 0x7a2a7a },
  { name: 'Emerald Lounge', body: 0x11241f, trim: 0xcfb068, a: 0x34d399, b: 0xfbbf24, c: 0x2dd4bf, gold: 0xd4b263, chrome: 0xc2d6ce, key: 0xd1fae5, rim: 0x34d399, intA: 0x34d399, intB: 0xfbbf24, bg: 0x08100e, carpet: 0x167a5a },
  { name: 'Ruby & Gold', body: 0x261519, trim: 0xe0ae48, a: 0xfb7185, b: 0xf59e0b, c: 0xf43f5e, gold: 0xe6b44c, chrome: 0xd6c7c2, key: 0xffedd5, rim: 0xfb7185, intA: 0xf59e0b, intB: 0xfb7185, bg: 0x11090c, carpet: 0x9a2438 },
  { name: 'Royal Flush', body: 0x1e1535, trim: 0xe8c15a, a: 0xa78bfa, b: 0xfacc15, c: 0x60a5fa, gold: 0xe8c15a, chrome: 0xcfc8e6, key: 0xede9fe, rim: 0xa78bfa, intA: 0xa78bfa, intB: 0xfacc15, bg: 0x0b0816, carpet: 0x5a3fb0 },
  { name: 'Sunset Strip', body: 0x2a1420, trim: 0xf0a05a, a: 0xfb923c, b: 0x22d3ee, c: 0xf472b6, gold: 0xf2a65a, chrome: 0xe6d0c4, key: 0xffedd5, rim: 0xf97316, intA: 0xfb923c, intB: 0x22d3ee, bg: 0x14090d, carpet: 0xa5481f },
];

const VIEWS = {
  front: { theta: 0, phi: 1.46, look: [0, 0.8, 0] as const, fit: true },
  back: { theta: PI, phi: 1.44, look: [0, 0.12, -0.25] as const, fit: false, r: 7.4 },
  mech: { theta: 0.5, phi: 1.38, look: [0.1, 0.58, 0.1] as const, fit: false, r: 6.2 },
};
export type SlotView = keyof typeof VIEWS;

export interface SlotOptions {
  sound?: () => boolean;
  /** Player pulled the lever or hit the 3D SPIN button. The casino starts the spin (and takes the bet). */
  onSpin?: () => void;
  /** Player pressed the 3D BET button. */
  onBet?: () => void;
}

/* ---------------------------------------------------------------- procedural textures */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const displayFont = () => (typeof getComputedStyle === 'function' && getComputedStyle(document.documentElement).getPropertyValue('--display').trim()) || 'Georgia, serif';

function marqueeTex(): THREE.CanvasTexture {
  const font = displayFont();
  return canvasTex(1024, 256, g => {
    const bg = g.createLinearGradient(0, 0, 1024, 256); bg.addColorStop(0, '#0f172a'); bg.addColorStop(.5, '#1e293b'); bg.addColorStop(1, '#0f172a');
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = '#d4a44a'; g.lineWidth = 10; g.strokeRect(16, 16, 992, 224);
    g.strokeStyle = '#38d9f5'; g.lineWidth = 4; g.strokeRect(32, 32, 960, 192);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (txt: string, px: number, weight: string, family: string, max: number) => { do { g.font = `${weight} ${px}px ${family}`; px -= 3; } while (g.measureText(txt).width > max && px > 14); };
    g.shadowColor = '#38d9f5'; g.shadowBlur = 18; g.fillStyle = '#f8fafc'; fit('KIWI GOLD', 104, '800', font, 860); g.fillText('KIWI GOLD', 512, 108);
    g.shadowColor = '#f5c451'; g.shadowBlur = 8; g.fillStyle = '#f5c451'; fit('★ THE TESSERA · 1000× DIAMOND JACKPOT ★', 26, '700', 'ui-monospace, Menlo, Consolas, monospace', 860);
    g.fillText('★ THE TESSERA · 1000× DIAMOND JACKPOT ★', 512, 192);
  });
}

function labelTex(text: string, bg: string, border: string, fg: string): THREE.CanvasTexture {
  return canvasTex(256, 128, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 128); g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(8, 8, 240, 112);
    g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, 128, 66);
  });
}

/** The reel skin: 12 cells wrapped round the cylinder, each an upright neon-ringed symbol. */
function reelTex(): THREE.CanvasTexture {
  const cellW = 170, H = 384, W = cellW * REEL_N;
  return canvasTex(W, H, g => {
    STRIP.forEach((s, i) => {
      const st = STYLE[s], x0 = i * cellW, cx = x0 + cellW / 2, cy = H / 2;
      const bg = g.createRadialGradient(cx, cy, 8, cx, cy, cellW * .8); bg.addColorStop(0, st.bg); bg.addColorStop(.65, '#0e1320'); bg.addColorStop(1, '#090c14');
      g.fillStyle = bg; g.fillRect(x0, 0, cellW, H);
      g.fillStyle = '#94a3b8'; g.fillRect(x0, 0, 4, H); g.fillRect(x0 + cellW - 4, 0, 4, H);
      g.fillStyle = '#1e293b'; g.fillRect(x0 + 4, 0, 3, H);
      g.save(); g.translate(cx, cy); g.rotate(-PI / 2);
      g.shadowColor = st.glow; g.shadowBlur = 14; g.strokeStyle = st.glow; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 72, 0, TAU); g.stroke();
      g.shadowBlur = 4; g.strokeStyle = st.rim; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = st.glow; g.shadowBlur = 14;
      if (s === 'BAR') { g.fillStyle = '#f8fafc'; g.font = '900 40px system-ui, sans-serif'; g.fillText('BAR', 0, 3); }
      else if (s === '7') { g.fillStyle = '#fb7185'; g.font = '900 96px Georgia, serif'; g.fillText('7', 0, 6); }
      else { g.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillStyle = '#fff'; g.fillText(s, 0, 5); }
      g.restore();
    });
  });
}

function carpetTex(): THREE.CanvasTexture {
  const s = 512;
  const t = canvasTex(s, s, g => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.10)'; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    const dia = (inset: number, lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(s / 2, inset); g.lineTo(s - inset, s / 2); g.lineTo(s / 2, s - inset); g.lineTo(inset, s / 2); g.closePath(); g.stroke(); };
    dia(0, 10, 'rgba(255,255,255,.3)'); dia(34, 3, 'rgba(255,255,255,.22)'); dia(70, 2, 'rgba(0,0,0,.3)');
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3;
    for (let p = 0; p < 8; p++) { g.save(); g.translate(s / 2, s / 2); g.rotate((p / 8) * TAU); g.beginPath(); g.ellipse(0, -36, 14, 34, 0, 0, TAU); g.stroke(); g.restore(); }
    for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) { g.beginPath(); g.arc(x, y, 46, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); return t;
}

function glowTex(): THREE.CanvasTexture {
  return canvasTex(64, 64, g => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.32, 'rgba(255,255,255,.6)'); r.addColorStop(.68, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }, false);
}

function gearGeo(outer: number, inner: number, teeth: number, depth: number, hole = .08): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = [0, .22, .48, .7].map(k => ((i + k) / teeth) * TAU), r = [inner, outer, outer, inner];
    a.forEach((ang, k) => { const x = Math.cos(ang) * r[k], y = Math.sin(ang) * r[k]; if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  }
  shape.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); shape.holes.push(h);
  if (inner > .34) for (let s = 0; s < 5; s++) { const sa = (s / 5) * TAU, p = new THREE.Path(); p.absarc(Math.cos(sa) * inner * .54, Math.sin(sa) * inner * .54, inner * .19, 0, TAU, true); shape.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .015, bevelSize: .012, bevelSegments: 1, curveSegments: 10 });
  geo.center(); return geo;
}

interface Reel { group: THREE.Group; mat: THREE.MeshStandardMaterial; pawl: THREE.Group; angle: number; state: 'idle' | 'spin' | 'stop'; v: number; from: number; to: number; t: number; dur: number; idx: number }

export class SlotMachine3D {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, .1, 140);
  private machine = new THREE.Group();
  private reels: Reel[] = [];
  private hud: { msg: HTMLElement; tools: HTMLElement; theme: HTMLElement; viewBtns: Record<string, HTMLButtonElement>; back: HTMLButtonElement; xray: HTMLButtonElement };

  // materials (shared so a theme change recolours everything at once)
  private body!: THREE.MeshStandardMaterial; private trim!: THREE.MeshStandardMaterial; private accA!: THREE.MeshStandardMaterial;
  private accB!: THREE.MeshStandardMaterial; private accC!: THREE.MeshStandardMaterial; private gold!: THREE.MeshStandardMaterial;
  private chrome!: THREE.MeshStandardMaterial; private glass!: THREE.MeshPhysicalMaterial; private orb!: THREE.MeshStandardMaterial;
  private carpet!: THREE.MeshStandardMaterial; private pool!: THREE.MeshBasicMaterial; private topArch!: THREE.MeshStandardMaterial;
  private key!: THREE.DirectionalLight; private rimL!: THREE.SpotLight; private inA!: THREE.PointLight; private inB!: THREE.PointLight; private flash!: THREE.PointLight;
  private target = { bg: new THREE.Color(), body: new THREE.Color(), trim: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color(), c: new THREE.Color(), gold: new THREE.Color(), chrome: new THREE.Color(), key: new THREE.Color(), rim: new THREE.Color(), intA: new THREE.Color(), intB: new THREE.Color(), carpet: new THREE.Color() };
  private themeIdx = 0;

  // parts that move
  private bulbs: THREE.Mesh[] = []; private gears: { m: THREE.Object3D; ratio: number }[] = []; private pistons: { head: THREE.Mesh; rod: THREE.Mesh; phase: number }[] = [];
  private crank = new THREE.Group(); private flywheel = new THREE.Group(); private escape = new THREE.Group(); private liquids: THREE.Mesh[] = [];
  private backPanel = new THREE.Group(); private latches: THREE.Mesh[] = []; private backHits: THREE.Object3D[] = [];
  private leverPivot = new THREE.Group(); private leverHits: THREE.Object3D[] = []; private topper = new THREE.Group();
  private deckBtns: THREE.Mesh[] = []; private eq: THREE.Mesh[] = []; private shock: { mesh: THREE.Mesh; life: number }[] = [];
  private coins: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; spin: number; life: number }[] = [];
  private bokeh: { spr: THREE.Sprite; base: number; ph: number; sp: number }[] = [];

  // state
  private raf = 0; private prev = 0; private idleSince = 0; private time = 0;
  private busy = false; private pull = 0; private dragLever: { y: number; fired: boolean } | null = null; private drag: { x: number; y: number } | null = null;
  private backOpen = false; private backP = 0; private xray = false; private shellOp = 1; private energy = 0; private winGlow = 0;
  private cam = { theta: 0, phi: 1.46, r: 14, look: new THREE.Vector3(0, .8, 0), tTheta: 0, tPhi: 1.46, tR: 14, tLook: new THREE.Vector3(0, .8, 0), view: 'front' as SlotView, zoom: 1, shake: 0 };
  private pendingReveal: (() => void) | null = null; private audio?: AudioContext; private raycaster = new THREE.Raycaster();

  static create(opts: SlotOptions = {}): SlotMachine3D | null {
    try { return new SlotMachine3D(opts); } catch { return null; }
  }

  private constructor(private opts: SlotOptions) {
    const canvas = document.createElement('canvas');
    canvas.className = 'rw3d-canvas'; canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Kiwi Gold pokie machine in 3D. Drag to orbit, pull the lever or press SPIN to play.');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;

    const msg = document.createElement('div'); msg.className = 'rw3d-msg'; msg.setAttribute('role', 'status'); msg.textContent = 'Pull the lever or press spin';
    const banner = document.createElement('div'); banner.className = 'rw3d-banner'; banner.append(msg);
    const tools = document.createElement('div'); tools.className = 'sm3d-tools'; tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', 'Machine view and style');
    const mk = (label: string, fn: () => void, title: string) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.addEventListener('click', e => { e.stopPropagation(); fn(); }); tools.append(b); return b; };
    const viewBtns: Record<string, HTMLButtonElement> = {
      front: mk('Front', () => this.setView('front'), 'Front view'),
      back: mk('Rear', () => this.setView('back'), 'Rear view (opens the service panel)'),
      mech: mk('Gears', () => this.setView('mech'), 'Gear close-up (X-ray)'),
    };
    const back = mk('Panel', () => this.toggleBack(), 'Detach / reattach the rear service panel');
    const xray = mk('X-ray', () => this.toggleXray(), 'See through the front shell');
    const theme = mk('', () => this.nextTheme(), 'Next cabinet and carpet theme'); theme.className = 'sm3d-theme';
    this.hud = { msg, tools, theme, viewBtns, back, xray };
    this.el = document.createElement('div'); this.el.className = 'rw3d sm3d'; this.el.append(canvas, tools, banner);

    this.buildScene();
    this.applyTheme(0, true);
    this.bindPointer(canvas);
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.syncButtons(); this.wake();
  }

  /* -------------------------------------------------------------- scene */
  private mat(color: number, rough: number, metal: number): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
  private emissive(color: number, intensity = .65, rough = .22, metal = .35): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: rough, metalness: metal });
  }
  private add<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.machine): T { o.position.set(x, y, z); parent.add(o); return o; }
  private box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh { return this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, parent); }
  private cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 16): THREE.Mesh { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }

  private buildScene(): void {
    const t0 = THEMES[0], L = PI; // r155+ lights are physical: ×π keeps the look of the original design
    this.scene.background = new THREE.Color(t0.bg); this.scene.fog = new THREE.FogExp2(t0.bg, .016);
    this.scene.add(new THREE.AmbientLight(0x3b4863, .78 * L));
    this.key = new THREE.DirectionalLight(t0.key, 1.35 * L); this.key.position.set(5, 8.5, 8); this.scene.add(this.key);
    const fill = new THREE.PointLight(0x64748b, .85 * L, 22, 1); fill.position.set(-6.5, 3, 5.5); this.scene.add(fill);
    this.rimL = new THREE.SpotLight(t0.rim, 1.5 * L, 24, PI * .38, .55, 1); this.rimL.position.set(-4.5, 6.8, -5.5); this.scene.add(this.rimL);
    const bay = new THREE.PointLight(0xfff1d6, 1.15 * L, 14, 1); bay.position.set(0, .7, -3.9); this.scene.add(bay);
    this.flash = new THREE.PointLight(0xfff0c0, 0, 22, 1); this.flash.position.set(0, 2.4, 4.5); this.scene.add(this.flash);

    this.body = new THREE.MeshStandardMaterial({ color: t0.body, roughness: .34, metalness: .72, transparent: true });
    this.trim = this.mat(t0.trim, .28, .88); this.accA = this.emissive(t0.a); this.accB = this.emissive(t0.b); this.accC = this.emissive(t0.c, .62);
    this.gold = this.mat(t0.gold, .24, .9); this.chrome = this.mat(t0.chrome, .18, .92);
    this.orb = this.emissive(t0.b, .75, .14, .2);
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: .1, metalness: .08, transparent: true, opacity: .14 });
    this.topArch = this.emissive(t0.a, .65, .2, .6);

    this.buildFloor();
    this.scene.add(this.machine);
    this.buildCabinet(); this.buildBackPanel(); this.buildReels(); this.buildInterior(); this.buildDeck(); this.buildLever(); this.buildTopper(); this.buildCoins();
  }

  private buildFloor(): void {
    const tex = carpetTex(); tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.carpet = new THREE.MeshStandardMaterial({ map: tex, color: THEMES[0].carpet, roughness: .94, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), this.carpet); floor.rotation.x = -PI / 2; floor.position.y = FLOOR_Y; this.scene.add(floor);
    const glow = glowTex();
    this.pool = new THREE.MeshBasicMaterial({ map: glow, color: THEMES[0].a, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), this.pool); pool.rotation.x = -PI / 2; pool.position.y = FLOOR_Y + .012; this.scene.add(pool);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ map: glow, color: 0x000000, transparent: true, opacity: .75, depthWrite: false }));
    blob.rotation.x = -PI / 2; blob.position.set(0, FLOOR_Y + .02, .15); this.scene.add(blob);

    // brass stanchions + red velvet rope each side
    const brass = this.mat(0xd4a44a, .25, .9), velvet = this.mat(0x9b1c2e, .75, .05);
    for (const side of [-1, 1]) {
      const x = side * 6.5;
      for (const z of [3.0, -.2]) {
        this.add(this.cyl(.34, .38, .08, brass, 20), x, FLOOR_Y + .04, z, this.scene);
        this.add(this.cyl(.05, .05, 1.5, brass, 12), x, FLOOR_Y + .82, z, this.scene);
        this.add(new THREE.Mesh(new THREE.SphereGeometry(.11, 14, 14), brass), x, FLOOR_Y + 1.62, z, this.scene);
      }
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, FLOOR_Y + 1.45, 3), new THREE.Vector3(x, FLOOR_Y + 1.12, 1.4), new THREE.Vector3(x, FLOOR_Y + 1.45, -.2)]);
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .04, 8, false), velvet));
    }
    // twinkling chandelier bokeh in the haze
    const cols = [0x38d9f5, 0xf472b6, 0x34d399, 0xf5c451, 0xfb923c, 0xa78bfa];
    for (let i = 0; i < 30; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: cols[i % cols.length], transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false }));
      const s = 1.2 + Math.random() * 2.2; spr.scale.set(s, s, 1); spr.position.set((Math.random() - .5) * 46, 3 + Math.random() * 9, -3 - Math.random() * 24); this.scene.add(spr);
      this.bokeh.push({ spr, base: .18 + Math.random() * .3, ph: Math.random() * 6.28, sp: .5 + Math.random() * 1.4 });
    }
  }

  private buildCabinet(): void {
    const { body, trim, chrome } = this;
    this.box(5.15, .45, 3.25, body, 0, -3.1, .15);
    this.box(5.22, .08, 3.32, this.accA, 0, -3.28, .15);
    this.box(.28, 5.4, 2.7, body, -2.36, -.2, 0); this.box(.28, 5.4, 2.7, body, 2.36, -.2, 0);
    this.box(4.8, .16, .18, trim, 0, 2.42, -1.26); this.box(4.8, .16, .18, trim, 0, -2.82, -1.26);
    this.box(.14, 5.3, .18, trim, -2.34, -.2, -1.26); this.box(.14, 5.3, .18, trim, 2.34, -.2, -1.26);
    this.box(4.48, 1.55, .22, body, 0, -2.15, 1.15);
    for (let i = -5; i <= 5; i++) this.box(.075, .7, .075, i % 2 === 0 ? trim : this.accA, i * .28, -1.78, 1.28);
    this.box(3.5, .12, .95, chrome, 0, -2.85, 1.52); this.box(3.64, .28, .12, trim, 0, -2.74, 1.98);
    this.box(.12, .28, .92, trim, -1.76, -2.74, 1.52); this.box(.12, .28, .92, trim, 1.76, -2.74, 1.52);
    this.box(.8, .24, .14, this.mat(0x090c14, .7, 0), 0, -2.42, 1.25);
    // reel window bezel + neon tubing
    this.box(4.68, .24, .34, trim, 0, 2.02, 1.26); this.box(4.68, .22, .34, trim, 0, -.52, 1.26);
    this.box(.28, 2.75, .34, trim, -2.18, .75, 1.26); this.box(.28, 2.75, .34, trim, 2.18, .75, 1.26);
    const tube = (m: THREE.Material, y: number) => { const t = this.cyl(.036, .036, 4.46, m, 10); t.rotation.z = PI / 2; this.add(t, 0, y, 1.44); };
    tube(this.accA, 2.02); tube(this.accB, -.52);
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(4.12, 2.34), this.glass), 0, .75, 1.33);
    // arched marquee + sign plate + chase bulbs
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.38, 2.38, 2.4, 28, 1, false, 0, PI), body);
    arch.rotation.z = PI / 2; arch.rotation.y = PI / 2; arch.scale.set(1, .56, 1); this.add(arch, 0, 2.32, .02);
    const sign = marqueeTex();
    this.box(3.75, .92, .14, new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: new THREE.Color(0xffffff), emissiveIntensity: .55, roughness: .3, metalness: .4 }), 0, 2.75, 1.22);
    const bg = new THREE.SphereGeometry(.075, 10, 10);
    for (let i = 0; i < 15; i++) {
      const ang = PI * (.12 + (i / 14) * .76), c = new THREE.Color(i % 2 ? THEMES[0].gold : THEMES[0].a);
      const b = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: c, emissive: c.clone(), emissiveIntensity: .85, roughness: .2 }));
      this.add(b, Math.cos(ang) * 2.15, 2.32 + Math.sin(ang) * 1.24, 1.32); this.bulbs.push(b);
    }
    this.inA = new THREE.PointLight(THEMES[0].intA, 1.35 * PI, 8.5, 1); this.add(this.inA, -1, .85, -.35);
    this.inB = new THREE.PointLight(THEMES[0].intB, 1.35 * PI, 8.5, 1); this.add(this.inB, 1, -.85, -.35);
  }

  private buildBackPanel(): void {
    this.add(this.backPanel, 0, -.2, -1.33);
    const hit = (m: THREE.Object3D) => { this.backHits.push(m); return m; };
    hit(this.box(4.56, 5.12, .16, this.body, 0, 0, 0, this.backPanel));
    this.box(4.42, .09, .2, this.trim, 0, 2.42, 0, this.backPanel); this.box(4.42, .09, .2, this.trim, 0, -2.42, 0, this.backPanel);
    for (let i = 0; i < 6; i++) hit(this.box(2.6, .11, .2, i % 2 ? this.accA : this.trim, 0, 1.48 - i * .4, -.02, this.backPanel));
    const lt = labelTex('SERVICE PANEL', '#111827', '#d4a44a', '#e2e8f0');
    const badge = this.box(2.35, .68, .06, new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: new THREE.Color(0xffffff), emissiveIntensity: .35, roughness: .35 }), 0, -1.62, -.1, this.backPanel);
    badge.rotation.y = PI; hit(badge);
    for (const hx of [-1.78, 1.78]) hit(this.add(this.cyl(.055, .055, 1.15, this.gold, 12), hx, 0, -.17, this.backPanel));
    for (const y of [1.45, -1.45]) this.latches.push(this.box(.36, .15, .22, this.accC, 2.12, y, -.04, this.backPanel));
  }

  private buildReels(): void {
    const tex = reelTex();
    const axle = this.cyl(.11, .11, 4.75, this.chrome, 18); axle.rotation.z = PI / 2; this.add(axle, 0, REEL_Y, REEL_Z);
    const star = gearGeo(.56, .44, 12, .09, .12), pawlGeo = new THREE.BoxGeometry(.14, .13, .58);
    for (let c = 0; c < 3; c++) {
      const rx = (c - 1) * REEL_GAP;
      const group = new THREE.Group(); this.add(group, rx, REEL_Y, REEL_Z);
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: .62, roughness: .32, metalness: .22 });
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(REEL_R, REEL_R, REEL_W, 48, 1, true), mat); cyl.rotation.z = -PI / 2; group.add(cyl);
      for (const s of [-1, 1]) { const f = this.cyl(REEL_R + .015, REEL_R + .015, .038, c % 2 ? this.chrome : this.gold, 32); f.rotation.z = PI / 2; this.add(f, s * REEL_W / 2, 0, 0, group); }
      const sw = new THREE.Mesh(star, this.gold); sw.rotation.y = PI / 2; this.add(sw, REEL_W * .52, 0, 0, group);
      const pawl = new THREE.Group(); this.add(pawl, rx + REEL_W * .52, REEL_Y + .72, REEL_Z - .55);
      this.add(new THREE.Mesh(pawlGeo, this.accB), 0, -.05, .25, pawl);
      const pin = this.cyl(.052, .052, .24, this.chrome, 10); pin.rotation.z = PI / 2; pawl.add(pin);
      const idx = Math.floor(Math.random() * REEL_N), angle = -((idx + .5) * STEP);
      group.rotation.x = angle;
      this.reels.push({ group, mat, pawl, angle, state: 'idle', v: 0, from: angle, to: angle, t: 0, dur: .5, idx });
    }
  }

  private buildInterior(): void {
    const specs: [number, number, number, number, number, number, number, THREE.Material][] = [
      [-1.76, 1.62, -.78, .55, .44, 16, 1, this.gold], [-.92, 1.78, -.78, .36, .28, 11, -1.45, this.chrome], [0, 1.82, -.78, .45, .36, 14, 1.14, this.accA],
      [.94, 1.72, -.78, .41, .33, 12, -1.33, this.gold], [1.72, 1.56, -.78, .46, .37, 14, 1.15, this.chrome],
      [-1.58, -1.24, -.68, .6, .49, 18, .85, this.gold], [-.68, -1.46, -.68, .41, .32, 12, -1.28, this.accB], [.22, -1.26, -.72, .51, .41, 15, 1.02, this.chrome], [1.18, -1.4, -.68, .55, .45, 16, -.94, this.gold],
    ];
    for (const [x, y, z, o, i, teeth, ratio, m] of specs) {
      const g = new THREE.Mesh(gearGeo(o, i, teeth, .16, .09), m); this.add(g, x, y, z); this.gears.push({ m: g, ratio });
      const sh = this.cyl(.06, .06, .52, this.chrome, 10); sh.rotation.x = PI / 2; this.add(sh, x, y, z + .12);
    }
    this.add(this.crank, 0, -2.54, -.94);
    const rod = this.cyl(.065, .065, 3.1, this.chrome, 14); rod.rotation.z = PI / 2; this.crank.add(rod);
    const pm = [this.accA, this.accB, this.accC];
    [-1.05, 0, 1.05].forEach((px, k) => {
      const phase = k * TAU / 3;
      const ch = this.box(.18, .34, .12, this.gold, px, Math.sin(phase) * .12, Math.cos(phase) * .12, this.crank); ch.rotation.x = -phase;
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .72, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: .28, roughness: .15, metalness: .4, side: THREE.DoubleSide })), px, -1.78, -.94);
      for (const y of [-1.42, -2.14]) { const cap = new THREE.Mesh(new THREE.TorusGeometry(.24, .035, 8, 18), this.gold); cap.rotation.x = PI / 2; this.add(cap, px, y, -.94); }
      const head = this.add(this.cyl(.19, .19, .22, pm[k], 16), px, -1.78, -.94), r2 = this.add(this.cyl(.048, .048, .78, this.chrome, 10), px, -2.16, -.94);
      this.pistons.push({ head, rod: r2, phase });
    });
    this.add(this.flywheel, -1.35, -1.65, .25);
    this.flywheel.add(new THREE.Mesh(new THREE.TorusGeometry(.68, .095, 12, 32), this.gold), new THREE.Mesh(new THREE.TorusGeometry(.58, .028, 8, 32), this.accA));
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.28, .075, .075), this.chrome); sp.rotation.z = (i / 6) * PI; this.flywheel.add(sp); }
    const hub = this.cyl(.16, .16, .24, this.trim, 14); hub.rotation.x = PI / 2; this.flywheel.add(hub);
    this.add(this.escape, 0, -.56, -.95);
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(.34, .042, 8, 16, PI * .75), this.gold); anchor.rotation.z = PI * .12; this.escape.add(anchor);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(.055, .65, .055), this.chrome), 0, -.32, 0, this.escape);
    this.add(new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 12), this.accC), 0, -.66, 0, this.escape);
    // lever coil spring + link rod
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 96; i++) { const t = i / 96, a = t * 7 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * .22, (t - .5) * 1.35, Math.sin(a) * .22)); }
    this.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, .044, 7, false), this.chrome), 1.88, -.85, .05);
    this.add(this.cyl(.058, .058, 1.25, this.gold, 10), 1.88, .25, .05);
    // plasma tubes in the rear cavity
    [-2.02, 2.02].forEach((tx, k) => {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 4.2, 16), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: .22, roughness: .08, metalness: .2 })), tx, -.2, -1.02);
      this.add(this.cyl(.17, .17, .16, this.gold, 16), tx, 1.94, -1.02); this.add(this.cyl(.17, .17, .16, this.gold, 16), tx, -2.34, -1.02);
      const g = new THREE.CylinderGeometry(.085, .085, 4, 12); g.translate(0, 2, 0);
      const liq = new THREE.Mesh(g, k ? this.accB : this.accA); this.add(liq, tx, -2.22, -1.02); liq.scale.y = .45; this.liquids.push(liq);
    });
  }

  private buildDeck(): void {
    const deck = new THREE.Group(); this.add(deck, 0, -.92, 1.56); deck.rotation.x = .42;
    this.box(4.64, .28, 1.05, this.body, 0, 0, 0, deck); this.box(4.74, .08, 1.14, this.trim, 0, -.12, 0, deck);
    const defs: { id: string; label: string; x: number; w: number; bg: string; bd: string; fg: string }[] = [
      { id: 'bet', label: 'BET', x: -1.2, w: .8, bg: '#162033', bd: '#38d9f5', fg: '#e2e8f0' },
      { id: 'spin', label: 'SPIN', x: 1.2, w: 1.1, bg: '#701a34', bd: '#fb7185', fg: '#ffffff' },
    ];
    for (const d of defs) {
      this.box(d.w + .07, .08, .54, this.chrome, d.x, .16, .06, deck);
      const lt = labelTex(d.label, d.bg, d.bd, d.fg), side = this.mat(new THREE.Color(d.bd).getHex(), .35, .3);
      const top = new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: new THREE.Color(0xffffff), emissiveIntensity: .38, roughness: .28 });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(d.w, .16, .44), [side, side, top, side, side, side]);
      cap.userData = { id: d.id, base: .22, press: 0 }; this.add(cap, d.x, .22, .06, deck); this.deckBtns.push(cap);
    }
  }

  private buildLever(): void {
    this.box(.42, 1.35, .65, this.trim, 2.65, -.15, .15); this.box(.12, 1.05, .18, this.mat(0x0b0f19, .7, 0), 2.84, -.15, .15);
    this.add(this.leverPivot, 2.75, -.15, .15);
    const stub = this.cyl(.11, .11, .42, this.chrome, 14); stub.rotation.z = PI / 2; this.add(stub, .2, 0, 0, this.leverPivot);
    this.add(new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 12), this.trim), .4, 0, 0, this.leverPivot);
    const shaft = this.add(this.cyl(.075, .1, 2.15, this.chrome, 16), .42, 1.05, 0, this.leverPivot);
    const knob = this.add(new THREE.Mesh(new THREE.SphereGeometry(.33, 24, 24), this.orb), .42, 2.26, 0, this.leverPivot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .025, 8, 24), this.gold); ring.rotation.x = PI / 2; knob.add(ring);
    this.leverHits.push(shaft, knob);
  }

  private buildTopper(): void {
    this.add(this.cyl(.42, .56, .22, this.trim, 18), 0, 3.68, .15);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.05, .055, 12, 36, PI), this.topArch); this.add(halo, 0, 3.68, .15);
    this.add(this.topper, 0, 4.28, .15);
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(.46, 0), this.accA); d.scale.set(1, 1.28, 1); this.topper.add(d);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.58, .036, 10, 28), this.gold); band.rotation.x = PI / 2.6; this.topper.add(band);
    const bg = new THREE.BoxGeometry(.12, .26, .36);
    for (let i = 0; i < 10; i++) {
      const col = new THREE.Color().setHSL(.54 - i * .048, .78, .54);
      for (const s of [-1, 1]) { const m = new THREE.MeshStandardMaterial({ color: col, emissive: col.clone(), emissiveIntensity: .65, roughness: .25 }); const b = this.add(new THREE.Mesh(bg, m), s * 2.56, -2.18 + i * .44, .55); this.eq.push(b); }
    }
  }

  private buildCoins(): void {
    const g = new THREE.CylinderGeometry(.11, .11, .03, 14), m = this.mat(0xf5c451, .25, .9);
    for (let i = 0; i < 44; i++) { const mesh = new THREE.Mesh(g, m); mesh.visible = false; this.scene.add(mesh); this.coins.push({ mesh, vx: 0, vy: 0, vz: 0, spin: 0, life: 0 }); }
  }

  /* -------------------------------------------------------------- theme / camera / pointer */
  private applyTheme(i: number, silent = false): void {
    this.themeIdx = ((i % THEMES.length) + THEMES.length) % THEMES.length;
    const t = THEMES[this.themeIdx], k = this.target;
    k.bg.setHex(t.bg); k.body.setHex(t.body); k.trim.setHex(t.trim); k.a.setHex(t.a); k.b.setHex(t.b); k.c.setHex(t.c); k.gold.setHex(t.gold); k.chrome.setHex(t.chrome);
    k.key.setHex(t.key); k.rim.setHex(t.rim); k.intA.setHex(t.intA); k.intB.setHex(t.intB); k.carpet.setHex(t.carpet);
    this.bulbs.forEach((b, n) => { const m = b.material as THREE.MeshStandardMaterial; const c = n % 2 ? t.gold : t.a; m.color.setHex(c); m.emissive.setHex(c); });
    this.hud.theme.textContent = '🎨 ' + t.name;
    if (!silent) { this.message(t.name, ''); this.tone(520, .12, 'triangle', .05, 780); this.wake(); }
  }
  nextTheme(): void { this.applyTheme(this.themeIdx + 1); }

  setView(v: SlotView): void {
    this.cam.view = v; this.cam.zoom = 1;
    const p = VIEWS[v]; this.cam.tTheta = p.theta; this.cam.tPhi = p.phi; this.cam.tLook.set(p.look[0], p.look[1], p.look[2]);
    this.cam.tR = p.fit ? this.fitRadius() : (p as { r: number }).r;
    if (v === 'back' && !this.backOpen) this.toggleBack(true);
    if (v === 'mech' && !this.xray) this.toggleXray(true);
    if (v === 'front') { if (this.backOpen) this.toggleBack(true); if (this.xray) this.toggleXray(true); }
    this.syncButtons(); this.wake();
  }
  toggleBack(quiet = false): void { this.backOpen = !this.backOpen; if (!quiet) this.tone(180, .25, 'sawtooth', .05, 90); this.syncButtons(); this.wake(); }
  toggleXray(quiet = false): void { this.xray = !this.xray; if (!quiet) this.tone(340, .1, 'sine', .05, 620); this.syncButtons(); this.wake(); }
  private syncButtons(): void {
    for (const [k, b] of Object.entries(this.hud.viewBtns)) b.setAttribute('aria-pressed', String(this.cam.view === k));
    this.hud.back.setAttribute('aria-pressed', String(this.backOpen)); this.hud.xray.setAttribute('aria-pressed', String(this.xray));
  }

  private fitRadius(): number {
    const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500, th = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const needH = 10.6, needW = 8.4, ppu = Math.min(h / needH, w / needW);
    return Math.min(34, Math.max(9, (h / ppu) / (2 * th)));
  }
  private lastW = 0; private lastH = 0;
  private resize(): void {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h || (w === this.lastW && h === this.lastH)) return;
    this.lastW = w; this.lastH = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (VIEWS[this.cam.view].fit) { this.cam.tR = this.fitRadius() * this.cam.zoom; if (!this.prev) this.cam.r = this.cam.tR; }
    this.wake();
  }

  private ndc(e: PointerEvent, c: HTMLElement): THREE.Vector2 { const r = c.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  private bindPointer(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); this.raycaster.setFromCamera(this.ndc(e, canvas), this.camera);
      if (!this.busy && this.raycaster.intersectObjects(this.leverHits, false).length) { this.dragLever = { y: e.clientY, fired: false }; return; }
      const hit = this.raycaster.intersectObjects(this.deckBtns, false)[0];
      if (hit) { const id = (hit.object.userData as { id: string }).id; (hit.object.userData as { press: number }).press = 1; if (id === 'spin' && !this.busy) this.opts.onSpin?.(); else if (id === 'bet' && !this.busy) this.opts.onBet?.(); this.tone(300, .06, 'triangle', .06, 120); this.wake(); return; }
      if (this.raycaster.intersectObjects(this.backHits, false).length) { this.toggleBack(); return; }
      this.drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', e => {
      if (this.dragLever) {
        this.pull = Math.min(1, Math.max(0, (e.clientY - this.dragLever.y) / 150));
        if (this.pull >= .7 && !this.dragLever.fired) { this.dragLever.fired = true; this.tone(140, .2, 'sawtooth', .06, 400); this.opts.onSpin?.(); }
        this.wake(); return;
      }
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag = { x: e.clientX, y: e.clientY };
        this.cam.tTheta -= dx * .007; this.cam.tPhi = Math.max(.9, Math.min(1.9, this.cam.tPhi - dy * .005)); this.wake();
      }
    });
    const up = () => {
      if (this.dragLever) { const quick = this.pull < .14 && !this.dragLever.fired; this.dragLever = null; if (quick && !this.busy) { this.pull = 1; this.opts.onSpin?.(); } }
      this.drag = null;
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.cam.zoom = Math.max(.55, Math.min(1.6, this.cam.zoom * (1 + e.deltaY * .001))); if (VIEWS[this.cam.view].fit) this.cam.tR = this.fitRadius() * this.cam.zoom; this.wake(); }, { passive: false });
  }

  /* -------------------------------------------------------------- audio (tiny, optional) */
  private tone(f: number, dur: number, type: OscillatorType, vol: number, to?: number): void {
    if (this.opts.sound && !this.opts.sound()) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      this.audio ??= new AC(); const a = this.audio, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
    } catch { /* audio is a nicety */ }
  }

  /* -------------------------------------------------------------- public API used by Casino.ts */
  /** Restart the render loop after the casino re-renders and re-attaches the element. */
  wake(): void { if (!this.raf) { this.prev = 0; this.raf = requestAnimationFrame(t => this.frame(t)); } this.idleSince = 0; this.resize(); }
  get spinning(): boolean { return this.reels.some(r => r.state !== 'idle'); }
  setBusy(b: boolean): void { this.busy = b; }
  message(text: string, cls = ''): void { this.hud.msg.textContent = text; this.hud.msg.className = 'rw3d-msg' + (cls ? ' ' + cls : ''); }

  /** All three reels start to whirl. The casino has already taken the bet. */
  spinStart(): void {
    this.pendingReveal = null; this.busy = true; this.energy = 1; this.winGlow = 0;
    this.reels.forEach((r, i) => { r.state = 'spin'; r.v = 12 + i * .8; });
    this.message('Good luck…'); this.tone(240, .3, 'sawtooth', .05, 520); this.wake();
  }
  /** Land reel i on the symbol the game chose. */
  stopReel(i: number, sym: Sym): void {
    const r = this.reels[i], spots = STRIP.map((s, n) => (s === sym ? n : -1)).filter(n => n >= 0);
    r.idx = spots[Math.floor(Math.random() * spots.length)] ?? 0;
    const base = -((r.idx + .5) * STEP);
    r.from = r.angle; r.to = base + TAU * Math.ceil((r.angle + 1.2 * TAU - base) / TAU); r.t = 0; r.dur = reduced() ? .01 : .55; r.state = 'stop'; this.wake();
  }
  /** Show the result once the last reel has settled. `win` is chips won, `bet` the stake. */
  reveal(win: number, bet: number, label: string): void {
    const go = () => {
      this.busy = false; this.pendingReveal = null;
      if (win > 0) {
        const big = win >= bet * 50, mid = win >= bet * 12;
        this.message(`${label}  +$${win.toLocaleString('en-NZ')}`, big ? 'big' : 'win');
        this.winGlow = big ? 3 : mid ? 2 : 1; this.energy = 1.6; this.coinShower(big ? 44 : mid ? 26 : 12); this.shockwave(); this.cam.shake = big ? .12 : .05;
        [660, 880, 1320, 1760].slice(0, big ? 4 : 3).forEach((f, k) => setTimeout(() => this.tone(f, .2, 'triangle', .07), k * 120));
      } else { this.message('No win this time'); this.tone(200, .3, 'sine', .05, 110); }
      this.wake();
    };
    if (this.spinning) this.pendingReveal = go; else go();
  }

  private coinShower(n: number): void {
    let k = 0; for (const c of this.coins) { if (k >= n) break; if (c.life > 0) continue; k++;
      c.life = 1.6 + Math.random() * .8; c.mesh.visible = true; c.mesh.position.set((Math.random() - .5) * 1.4, -2.5, 1.9);
      c.vx = (Math.random() - .5) * 3.2; c.vy = 4 + Math.random() * 4; c.vz = 1 + Math.random() * 2.4; c.spin = 6 + Math.random() * 10; }
  }
  private shockwave(): void {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.25, .065, 10, 48), new THREE.MeshBasicMaterial({ color: THEMES[this.themeIdx].a, transparent: true, opacity: .65 }));
    m.rotation.x = PI / 2; m.position.set(0, FLOOR_Y + .1, .15); this.scene.add(m); this.shock.push({ mesh: m, life: 1 });
  }

  /* -------------------------------------------------------------- per frame */
  private frame(now: number): void {
    const t = now / 1000, dt = this.prev ? Math.min(t - this.prev, .05) : .016; this.prev = t; this.time += dt;
    const settled = !this.spinning && !this.busy && this.energy < .02 && this.winGlow < .02 && !this.dragLever && !this.coins.some(c => c.life > 0) && !this.shock.length;
    if (!this.el.isConnected && settled) { if (!this.idleSince) this.idleSince = t; if (t - this.idleSince > 1.5) { this.raf = 0; return; } } else this.idleSince = 0;
    this.raf = requestAnimationFrame(n => this.frame(n));
    const k = Math.min(1, dt * 4.5), tg = this.target;

    // theme blend
    (this.scene.background as THREE.Color).lerp(tg.bg, k); (this.scene.fog as THREE.FogExp2).color.lerp(tg.bg, k);
    this.body.color.lerp(tg.body, k); this.trim.color.lerp(tg.trim, k); this.gold.color.lerp(tg.gold, k); this.chrome.color.lerp(tg.chrome, k);
    for (const [m, c] of [[this.accA, tg.a], [this.accB, tg.b], [this.accC, tg.c], [this.topArch, tg.a]] as const) { m.color.lerp(c, k); m.emissive.lerp(c, k); }
    this.orb.color.lerp(tg.b, k); this.orb.emissive.lerp(tg.b, k);
    this.key.color.lerp(tg.key, k); this.rimL.color.lerp(tg.rim, k); this.inA.color.lerp(tg.intA, k); this.inB.color.lerp(tg.intB, k);
    this.carpet.color.lerp(tg.carpet, k); this.pool.color.lerp(tg.a, k);
    for (const b of this.bokeh) b.spr.material.opacity = b.base * (.55 + .45 * Math.sin(this.time * b.sp + b.ph));

    // reels
    let whirl = 0, justStopped = false;
    this.reels.forEach((r, i) => {
      if (r.state === 'spin') { r.angle += r.v * dt; whirl += r.v; }
      else if (r.state === 'stop') {
        r.t += dt; const u = Math.min(1, r.t / r.dur), c1 = 1.1, c3 = c1 + 1, e = 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
        r.angle = r.from + (r.to - r.from) * e; whirl += (1 - u) * 10;
        if (u >= 1) { r.state = 'idle'; r.angle = r.to; justStopped = true; this.tone(150 + i * 14, .12, 'sine', .12, 50); this.cam.shake = Math.max(this.cam.shake, .012); }
      }
      r.group.rotation.x = r.angle; r.pawl.rotation.x = r.state === 'idle' ? 0 : Math.sin(this.time * 38 + i) * .28;
    });
    if (justStopped && !this.spinning && this.pendingReveal) this.pendingReveal();
    this.energy = Math.max(0, this.energy - dt * .25); this.winGlow = Math.max(0, this.winGlow - dt * .55);
    const drive = whirl / 3 + this.energy * 2;

    // mechanics
    this.gears.forEach((g, i) => { g.m.rotation.z += (drive * dt * g.ratio * .35) + dt * g.ratio * .12 * (i % 2 ? -1 : 1); });
    this.crank.rotation.x += (drive * .22 + .25) * dt;
    this.pistons.forEach(p => { const a = this.crank.rotation.x + p.phase, y = -1.78 + Math.sin(a) * .22; p.head.position.y = y; p.rod.position.y = y - .38; });
    this.flywheel.rotation.z -= (drive * .18 + .2) * dt; this.escape.rotation.z = Math.sin(this.time * (3 + drive * .6)) * .28;
    this.liquids.forEach((l, i) => { l.scale.y = .45 + .14 * Math.sin(this.time * 1.6 + i * 2) + Math.min(.4, drive * .03); });
    this.topper.rotation.y += dt * (.7 + this.winGlow); this.topper.position.y = 4.28 + Math.sin(this.time * 2.4) * .07 + this.winGlow * .08;

    // marquee chase bulbs + equaliser
    const chase = this.winGlow > 0 ? 10 : this.spinning || this.busy ? 7 : 3.2;
    this.bulbs.forEach((b, i) => { (b.material as THREE.MeshStandardMaterial).emissiveIntensity = .28 + (Math.sin(this.time * chase - i * .7) * .5 + .5) * .92; });
    const eqE = .25 + Math.min(1, this.energy * .7 + this.winGlow * .3);
    this.eq.forEach((b, i) => { const idx = i >> 1, wave = (Math.sin(this.time * 4.8 - idx * .5) * .5 + .5) * eqE; b.scale.y = .5 + wave * 1.6; (b.material as THREE.MeshStandardMaterial).emissiveIntensity = .3 + wave * .9 + (idx / 10 < wave ? .2 : 0); });
    this.flash.intensity = this.winGlow * 1.1 * PI * (.6 + .4 * Math.sin(this.time * 9));
    this.orb.emissiveIntensity = .75 + this.winGlow * .4;

    // back panel slide, X-ray, lever, buttons
    this.backP += ((this.backOpen ? 1 : 0) - this.backP) * Math.min(1, dt * 6);
    const p = this.backP, side = Math.max(0, (p - .25) / .75);
    this.latches.forEach(l => { l.position.x = 2.12 - Math.min(1, p * 3) * .3; });
    this.backPanel.position.set(-side * 5.25, -.2, -1.33 - Math.min(1, p * 2) * .65); this.backPanel.rotation.y = side * .42;
    this.shellOp += ((this.xray ? .16 : 1) - this.shellOp) * Math.min(1, dt * 7); this.body.opacity = this.shellOp; this.body.depthWrite = this.shellOp > .7;
    if (!this.dragLever && this.pull > .001) { this.pull *= Math.pow(.78, dt * 60); if (this.pull < .003) this.pull = 0; }
    this.leverPivot.rotation.x = this.pull * 1.48;
    for (const b of this.deckBtns) { const u = b.userData as { base: number; press: number }; if (u.press > 0) { u.press = Math.max(0, u.press - dt * 6.5); b.position.y = u.base - Math.sin(u.press * PI) * .095; } }

    // coins + shockwaves
    for (const c of this.coins) if (c.life > 0) {
      c.life -= dt; c.vy -= 11 * dt; c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.position.z += c.vz * dt; c.mesh.rotation.x += c.spin * dt;
      if (c.mesh.position.y < FLOOR_Y + .1) { c.mesh.position.y = FLOOR_Y + .1; c.vy *= -.35; c.vx *= .7; c.vz *= .7; }
      if (c.life <= 0) c.mesh.visible = false;
    }
    for (let i = this.shock.length - 1; i >= 0; i--) {
      const s = this.shock[i]; s.life -= dt * 1.05; const sc = 1 + (1 - s.life) * 6.2; s.mesh.scale.set(sc, sc, 1); (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life) * .65;
      if (s.life <= 0) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); this.shock.splice(i, 1); }
    }

    // camera
    const c = this.cam, d = Math.min(1, dt * 7);
    c.theta += (c.tTheta - c.theta) * d; c.phi += (c.tPhi - c.phi) * d; c.r += (c.tR - c.r) * d; c.look.lerp(c.tLook, d);
    let sx = 0, sy = 0; if (c.shake > .002) { sx = (Math.random() - .5) * c.shake; sy = (Math.random() - .5) * c.shake; c.shake *= Math.pow(.86, dt * 60); } else c.shake = 0;
    this.camera.position.set(c.look.x + c.r * Math.sin(c.phi) * Math.sin(c.theta) + sx, c.look.y + c.r * Math.cos(c.phi) + sy, c.look.z + c.r * Math.sin(c.phi) * Math.cos(c.theta));
    this.camera.lookAt(c.look);
    this.renderer.render(this.scene, this.camera);
  }
}
