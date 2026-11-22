/**
 * Roulette ball physics. The casino has already decided the winning number; this plans a ball that gets there honestly.
 *
 * The ball is simulated (fixed 240 Hz steps) in three stages, then the plan is searched across random launches until one
 * of them happens to come to rest in the decided pocket, so every tumble on screen is real physics, never a scripted wobble:
 *  1. Track: a ball on the sloped bank (a cone) pinned to the rim by centripetal force. Drag slows it, the pinning force
 *     fails, and it spirals down the bank. Eight diamond deflectors on the way knock it sideways, slow it and make it hop.
 *  2. Drop: it leaves the bank at the pocket ring with whatever speed it has left.
 *  3. Pockets: in the spinning rotor's frame the ball hops over the frets (restitution bounces, speed-dependent), loses
 *     energy on every strike, rattles, and finally settles in a pocket.
 * Units match the 3D wheel (ball radius .13); gravity is scaled down a little so the bounces stay readable on screen.
 */
export interface BallEvent { t: number; kind: 'deflector' | 'fret' | 'wall'; power: number }
export interface BallPlan {
  dt: number; n: number;
  /** Per-sample world angle (unwrapped), radius and centre height of the ball. */
  th: Float32Array; r: Float32Array; y: Float32Array;
  events: BallEvent[];
  /** When the ball leaves the bank and drops towards the pockets. */
  dropAt: number;
  /** Pocket the ball ends in, and how fast it is still moving relative to the rotor (0 = at rest). */
  pocket: number; restSpeed: number;
}
export interface BallInput {
  target: number; dur: number; N: number; STEP: number;
  /** Rotor angle and angular speed as functions of time (the wheel's own motion). */
  W: (t: number) => number; Wd: (t: number) => number;
  seed?: number; attempts?: number;
}

const TAU = Math.PI * 2;
export const BALL_R = .13;
const DT = 1 / 240, G = 80, SLOPE = .5, WALL = 4.62, BANK_END = 3.3, POCKET_R = 2.75, DEFLECTOR_R = 3.95, FRET_H = .11, FRET_W = .22, FLOOR_Y = .05 + BALL_R;
const bankY = (r: number) => .035 + SLOPE * (r - BANK_END) + BALL_R;
const wrapPi = (a: number) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Fret profile along the pocket ring (arc length s). Boundaries sit half way between pocket centres. */
function fret(s: number, pitch: number): { h: number; slope: number } {
  const k = s / pitch, f = k - Math.floor(k), d = Math.abs(f - .5) * pitch;
  if (d >= FRET_W) return { h: 0, slope: 0 };
  const a = Math.PI * d / FRET_W;
  return { h: FRET_H * .5 * (1 + Math.cos(a)), slope: -FRET_H * .5 * (Math.PI / FRET_W) * Math.sin(a) * Math.sign(f - .5) };
}

/** One complete ball trajectory for a given random seed. */
export function simulateBall(p: BallInput, seed: number): BallPlan {
  const rand = rng(seed), n = Math.ceil(p.dur / DT) + 1, th = new Float32Array(n), r = new Float32Array(n), y = new Float32Array(n), events: BallEvent[] = [];
  const pitch = POCKET_R * p.STEP, tFall = p.dur * .55, ang0 = rand() * TAU;
  // Launched against the rotor's spin, fast enough to be pinned to the rim; drag is tuned so the pinning fails near tFall.
  const w0 = -(14 + rand() * 6), L0 = WALL * WALL * -w0, Lb = Math.sqrt(Math.pow(BANK_END + .02, 3) * G * SLOPE), drag = Math.log(L0 / Lb) / tFall;
  let a = ang0, ra = WALL, vr = 0, w = w0, hy = 0, hv = 0, stage = 0, s = 0, vs = 0, rb = POCKET_R, vrb = 0, yb = FLOOR_Y, vyb = 0, dropAt = p.dur;
  const cool = new Array(8).fill(-1);
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    if (stage === 0) {
      const c = t > p.dur * .62 ? drag * 3 : drag;
      vr += ((ra * w * w - G * SLOPE) / (1 + SLOPE * SLOPE) - 3 * vr) * DT; ra += vr * DT;
      if (ra > WALL) { ra = WALL; if (vr > 1.5) events.push({ t, kind: 'wall', power: vr }); if (vr > 0) vr *= -.2; }
      w += (-2 * vr * w / ra - c * w) * DT; a += w * DT;
      hy += hv * DT; hv -= G * DT; if (hy < 0) { hy = 0; hv = -hv > 1.5 ? -hv * .35 : 0; }
      for (let d = 0; d < 8; d++) {
        const da = wrapPi(a - (d * TAU / 8 + TAU / 16));
        if (t > cool[d] && Math.abs(da) * ra < .31 && Math.abs(ra - DEFLECTOR_R) < .24) {
          cool[d] = t + .2; const speed = ra * Math.abs(w), side = ra - DEFLECTOR_R + (rand() - .5) * .2;
          vr += (side >= 0 ? 1 : -1) * speed * (.1 + .28 * rand()); w *= .55 + .3 * rand(); hv += 3 + rand() * 4;
          events.push({ t, kind: 'deflector', power: speed });
        }
      }
      th[i] = a; r[i] = ra; y[i] = bankY(ra) + hy;
      if (ra <= BANK_END + .02 || t > p.dur * .75) {
        stage = 1; dropAt = t; s = POCKET_R * (a - p.W(t)); vs = POCKET_R * (w - p.Wd(t)); rb = Math.max(ra, POCKET_R); vrb = Math.min(vr, 0) - 1; yb = bankY(Math.min(ra, BANK_END)) + hy; vyb = hv - 1;
      }
    } else {
      vyb -= G * DT; yb += vyb * DT; s += vs * DT;
      const { h, slope } = fret(s, pitch), ground = FLOOR_Y + h;
      let contact = false;
      if (yb <= ground) {
        const nl = Math.hypot(slope, 1), nx = -slope / nl, ny = 1 / nl, vn = vs * nx + vyb * ny;
        if (vn < 0) {
          const e = -vn > 6 ? .55 : -vn > 2 ? .4 : 0;
          vs -= (1 + e) * vn * nx; vyb -= (1 + e) * vn * ny;
          if (-vn > 2.5) events.push({ t, kind: 'fret', power: -vn });
        }
        yb = ground; contact = true;
      }
      if (contact || yb < ground + .004) vs *= Math.exp(-(.45 + 7 * smooth((t - p.dur * .86) / (p.dur * .1))) * DT);
      vrb += (-(rb - POCKET_R) * 45 - vrb * 7) * DT; rb += vrb * DT;
      th[i] = p.W(t) + s / POCKET_R; r[i] = rb; y[i] = yb;
    }
  }
  const k = Math.round(s / pitch), pocket = ((k % p.N) + p.N) % p.N;
  return { dt: DT, n, th, r, y, events, dropAt, pocket: stage ? pocket : -1, restSpeed: Math.abs(vs) };
}

/** Search random launches until the physics itself ends in the decided pocket. */
export function planBall(p: BallInput): BallPlan {
  let seed = (p.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0, best: BallPlan | null = null;
  for (let i = 0; i < (p.attempts ?? 1500); i++, seed = (seed + 0x9e3779b1) >>> 0) {
    const plan = simulateBall(p, seed);
    if (plan.pocket === p.target && plan.restSpeed < .4) return plan;
    if (plan.pocket === p.target && (!best || plan.restSpeed < best.restSpeed)) best = plan;
  }
  return best ?? simulateBall(p, seed);
}
