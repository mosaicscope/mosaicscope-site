/* Lowriders on the strip: realistic drop-top line drawings (opaque, so nothing shows through them) with a real suspension
   simulation: a rigid body (heave + pitch) on two spring-damper hydraulic corners, gravity, bump stops and a speed-limited pump.
   Every hop, nose dance, tail dance and slam comes from the physics. 54 pump patterns, low and smooth: swagger, not bouncing off the roof.
   Cars sit on a back lane BEHIND the Mosaics, never overlap each other, and park in the gaps. Reduced motion: no cars. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.getElementById('stage');
  if (!stage) return;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FORCE = /[?&]lowrider/.test(location.search);
  const partying = () => FORCE || stage.classList.contains('is-party');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* physics (px, seconds): shorter wheelbase, low ride, gentle hydraulics */
  const G = 1800, WB = 100, HL = WB / 2, WR = 13, MASS = 1, INERTIA = 1100;
  const K = 70, C = 3.6, S_BASE = 30, S_MIN = 4, KB = 420;
  const V_UP = 300, V_DOWN = 260, EXT_MIN = -12, EXT_MAX = 24, BEAT = 0.42, CAR_W = 196;
  const COLORS = ['#ff7ad9', '#c6ff3d', '#3dd6ff', '#ff9a3d', '#b48cff', '#ec2a1c', '#f6b62c'];
  const INK = '#0e0b0a';

  /* 54 pump patterns, each a set of 8 half-beat steps of [front, rear] extension in px (generated, all different) */
  const PATS = (() => {
    const out = [], amps = [10, 14, 18, 22], f = (x) => clamp(x, EXT_MIN, EXT_MAX);
    const shapes = [
      (i, a, p) => [i % 2 ? a : 0, 0], (i, a, p) => [0, i % 2 ? a : 0], (i, a, p) => [i % 2 ? a : 0, i % 2 ? 0 : a],
      (i, a, p) => [a * Math.max(0, Math.sin((i + p) * 0.8)), a * Math.max(0, Math.sin((i + p) * 0.8 + 3))],
      (i, a, p) => [(i % 4 < 2) ? a : 0, ((i + p) % 4 < 2) ? 0 : a], (i, a, p) => [a * ((i * 3 + p) % 8) / 8, a * ((i * 5 + p) % 8) / 8],
      (i, a, p) => [i < 4 ? a : EXT_MIN, i < 4 ? a : EXT_MIN], (i, a, p) => [(i % 3 === 0) ? a : 0, (i % 3 === 1) ? a : 0],
      (i, a, p) => [(i === p % 8) ? a : EXT_MIN * 0.5, (i === (p + 4) % 8) ? a : EXT_MIN * 0.5]
    ];
    for (let k = 0; k < 54; k++) { const s = shapes[k % 9], a = amps[(k / 9 | 0) % 4], p = (k * 5) % 8; out.push(Array.from({ length: 8 }, (_, i) => s(i, a, p).map(f))); }
    return out;
  })();

  /* a real-life style '64 drop-top lowrider, drawn the way the Mosaics are drawn: single-weight neon line, solid ink fill */
  function carSVG(color) {
    const wheel = (cls) => '<g class="' + cls + '"><g class="ms-car__spin" stroke-linecap="round"><circle r="13" fill="' + INK + '" stroke="#eee4d3" stroke-width="3.4"/><circle r="8.5" fill="' + INK + '" stroke="#9a8d80" stroke-width="1.2"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => '<path stroke="#c9ccd1" stroke-width="0.8" d="M0 0 L' + (Math.cos(i * 0.5236) * 8.5).toFixed(1) + ' ' + (Math.sin(i * 0.5236) * 8.5).toFixed(1) + '"/>').join('') + '<circle r="2" fill="' + color + '" stroke="none"/></g></g>';
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 220 100'); s.setAttribute('class', 'ms-car__svg');
    s.innerHTML =
      '<g fill="none" stroke="#9a8d80" stroke-width="2.2" stroke-linecap="round"><path class="ms-car__pf" d="M0 0 L0 0"/><path class="ms-car__pr" d="M0 0 L0 0"/></g>' + wheel('ms-car__wr') + wheel('ms-car__wf') +
      '<g class="ms-car__body" fill="' + INK + '" stroke="' + color + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M-88 14 L-90 1 Q-88 -7 -79 -9 L-58 -10 L-30 -11 L-23 -21 L-12 -21 L-8 -11 L24 -11 L50 -10 Q78 -9 86 0 L88 14 Z"/>' +        // hull
        '<path d="M-90 1 L-97 -12 L-80 -9" fill="' + INK + '"/>' +                                                                              // tail fin
        '<path d="M-66 14 Q-50 -7 -34 14 L-66 14 Z M34 14 Q50 -7 66 14 L34 14 Z" fill="' + INK + '" stroke-width="2.2"/>' +                       // fender skirt + arch
        '<path d="M-23 -21 L-18 -11" stroke="#eee4d3" stroke-width="2"/><path d="M-60 -10 Q-52 -17 -40 -11" stroke-width="2"/>' +                // windshield, folded top
        '<path d="M-14 -11 Q-12 -19 -4 -13 M-30 -11 Q-27 -17 -22 -11" stroke-width="1.8"/>' +                                                   // seats
        '<path d="M-82 3 H80" stroke="#eee4d3" stroke-width="1.6"/><path d="M-80 7 H78" stroke-width="1" opacity=".7"/>' +                          // chrome belt line, pinstripe
        '<path d="M-27 -10 L-28 12 M13 -10 L14 12" stroke-width="1.4" opacity=".8"/>' +                                                           // doors
        '<path d="M83 -3 V9 M80 -3 V9" stroke="#c9ccd1" stroke-width="1.2"/><circle cx="85" cy="-4" r="2.4" stroke="#f6b62c" stroke-width="1.6"/>' +  // grille, headlight
        '<path d="M82 14 H92" stroke="#eee4d3" stroke-width="3.4"/><path d="M-89 -1 h3" stroke="#ec2a1c" stroke-width="3"/><path d="M-88 12 h-6" stroke="#9a8d80" stroke-width="2"/>' + // bumper, taillight, exhaust
        '<path d="M-62 -10 L-72 -34" stroke="#c9ccd1" stroke-width="1"/><circle cx="-72" cy="-35" r="1.4" fill="#ec2a1c" stroke="none"/>' +          // antenna
        '<path d="M-20 -21 l-4 -4" stroke="#c9ccd1" stroke-width="1.4"/>' +                                                                       // mirror
        '<g stroke="#eee4d3" stroke-width="2.2"><circle cx="-10" cy="-31" r="5.5" fill="' + INK + '"/><path d="M-10 -25.5 L-10 -13 M-10 -21 L-19 -18 L-22 -23"/><path d="M-14 -32 H-6" stroke="' + color + '" stroke-width="2.6"/></g>' +   // driver
      '</g>';
    return s;
  }

  class Car {
    constructor(color, x, dir) {
      this.el = document.createElement('div'); this.el.className = 'ms-car';
      this.svg = carSVG(color); this.el.append(this.svg); stage.append(this.el);
      const q = (s) => this.svg.querySelector(s);
      this.body = q('.ms-car__body'); this.wf = q('.ms-car__wf'); this.wr = q('.ms-car__wr'); this.pf = q('.ms-car__pf'); this.pr = q('.ms-car__pr');
      this.spinF = this.wf.firstChild; this.spinR = this.wr.firstChild;
      this.x = x; this.vx = 0; this.targetX = x; this.maxV = 70; this.dir = dir || 1;
      this.yc = WR + S_BASE - 12; this.vy = 0; this.th = 0; this.om = 0;
      this.extF = this.extR = EXT_MIN * 0.5; this.tgtF = this.tgtR = EXT_MIN * 0.5;
      this.mode = 'enter'; this.t = 0; this.stepAt = 0; this.stepN = 0; this.pat = pick(PATS); this.patIdx = PATS.indexOf(this.pat); this.wheelRot = 0; this.landed = 0;
    }
    step(dt) {
      const mv = (cur, tgt) => (tgt > cur ? Math.min(tgt, cur + V_UP * dt) : Math.max(tgt, cur - V_DOWN * dt));
      this.extF = mv(this.extF, this.tgtF); this.extR = mv(this.extR, this.tgtR);
      const s = Math.sin(this.th), c = Math.cos(this.th);
      const sF = this.yc + HL * s - WR, sR = this.yc - HL * s - WR;
      const vF = this.vy + HL * c * this.om, vR = this.vy - HL * c * this.om;
      let FF = K * (S_BASE + this.extF - sF) - C * vF, FR = K * (S_BASE + this.extR - sR) - C * vR;
      if (sF < S_MIN) FF += KB * (S_MIN - sF); if (sR < S_MIN) FR += KB * (S_MIN - sR);
      FF = Math.max(0, FF); FR = Math.max(0, FR);
      const onGround = FF > 0 || FR > 0, prevVy = this.vy;
      this.vy += ((FF + FR) / MASS - G) * dt; this.yc += this.vy * dt;
      this.om += (((FF - FR) * HL * c - this.om * 6) / INERTIA) * dt; this.th = clamp(this.th + this.om * dt, -0.32, 0.32);
      if (this.yc < WR + S_MIN - 2) { this.yc = WR + S_MIN - 2; if (this.vy < 0) this.vy = 0; }
      if (onGround && prevVy < -200) this.landed = Math.min(1, -prevVy / 700);
    }
    /* a half-beat tick: follow the current pattern, never repeat the same pattern twice in a row */
    tick() {
      const [f, r] = this.pat[this.stepN % 8]; this.tgtF = f; this.tgtR = r;
      if (++this.stepN % 8 === 0 && Math.random() < 0.6) { let i; do { i = (Math.random() * PATS.length) | 0; } while (i === this.patIdx); this.patIdx = i; this.pat = PATS[i]; }
    }
    place() {
      const th = this.th, c = Math.cos(th), s = Math.sin(th);
      const X = (bx, by) => 110 + bx * c - by * s, Y = (bx, by) => 96 - (this.yc + bx * s + by * c);
      this.body.setAttribute('transform', 'translate(110 ' + (96 - this.yc).toFixed(2) + ') rotate(' + (-th * 57.2958).toFixed(2) + ')');
      this.wf.setAttribute('transform', 'translate(' + (110 + HL) + ' ' + (96 - WR) + ')'); this.wr.setAttribute('transform', 'translate(' + (110 - HL) + ' ' + (96 - WR) + ')');
      const rot = 'rotate(' + (this.wheelRot * 57.2958).toFixed(1) + ')'; this.spinF.setAttribute('transform', rot); this.spinR.setAttribute('transform', rot);
      this.pf.setAttribute('d', 'M' + (110 + HL) + ' ' + (96 - WR) + ' L' + X(HL, -6).toFixed(1) + ' ' + Y(HL, -6).toFixed(1));
      this.pr.setAttribute('d', 'M' + (110 - HL) + ' ' + (96 - WR) + ' L' + X(-HL, -6).toFixed(1) + ' ' + Y(-HL, -6).toFixed(1));
      this.el.style.transform = 'translate3d(' + Math.round(this.x) + 'px,0,0)' + (this.dir < 0 ? ' scaleX(-1)' : '');
    }
  }

  let cars = [], raf = 0, last = 0, acc = 0, clock = 0, partyWas = false, nextCruise = performance.now() + rand(25000, 60000), spawnAt = 0;
  const sw = () => stage.clientWidth;
  const free = (x) => cars.every((c) => Math.abs(c.targetX - x) > CAR_W + 24);       // parking spots never overlap
  function spawn(parkX) {
    const fromLeft = Math.random() < 0.5, car = new Car(COLORS[cars.length % COLORS.length], fromLeft ? -240 : sw() + 30, fromLeft ? 1 : -1);
    car.targetX = parkX; car.maxV = 110; cars.push(car);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    return car;
  }
  function spot() { for (let i = 0; i < 12; i++) { const x = rand(20, Math.max(40, sw() - CAR_W - 20)); if (free(x)) return x; } return null; }
  function dust(car, strong) { for (const wx of [car.x + 110 - HL, car.x + 110 + HL]) { const d = document.createElement('i'); d.className = 'ms-dust'; d.style.left = wx + 'px'; d.style.setProperty('--k', strong ? 1.5 : 1); d.addEventListener('animationend', () => d.remove()); stage.append(d); } }
  function cheer(car) {
    const cx = car.x + 110, say = window.MOSAIC_MOVES && window.MOSAIC_MOVES.say, sr = stage.getBoundingClientRect();
    stage.querySelectorAll('.raver').forEach((el) => { const r = el.getBoundingClientRect(); if (Math.abs(r.left - sr.left + r.width / 2 - cx) < 230) { if (say) say(el, pick(['ayy', 'hit it', 'go go', 'yooo', 'ride', 'sheesh'])); } });
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dtf = Math.min(0.05, (now - last) / 1000); last = now;
    const party = partying();
    if (party && !partyWas) spawnAt = now + 800;
    if (!party && partyWas) cars.forEach((c) => { c.mode = 'leave'; c.targetX = c.dir > 0 ? sw() + 260 : -260; c.maxV = 140; c.tgtF = c.tgtR = EXT_MIN * 0.5; });
    partyWas = party;
    if (party && !document.hidden && cars.filter((c) => c.mode !== 'leave').length < 3 && now > spawnAt) { const x = spot(); if (x !== null) spawn(x); spawnAt = now + rand(6000, 9000); }
    else if (!party && !cars.length && now > nextCruise && !document.hidden) { const c = spawn(0); c.targetX = c.dir > 0 ? sw() + 300 : -300; c.mode = 'cruise'; c.maxV = 42; nextCruise = now + rand(60000, 120000); }

    acc += dtf; clock += dtf;
    while (acc >= 1 / 240) { for (const c of cars) c.step(1 / 240); acc -= 1 / 240; }
    for (const c of cars) {
      c.t += dtf;
      const dx = c.targetX - c.x, want = clamp(dx * 1.4, -c.maxV, c.maxV);
      c.vx += clamp(want - c.vx, -240 * dtf, 240 * dtf);
      for (const o of cars) if (o !== c && Math.sign(o.x - c.x) === Math.sign(c.vx || 1) && Math.abs(o.x - c.x) < CAR_W + 10 + Math.abs(c.vx) * 0.5) c.vx *= 0.5;       // solid: never drive through another car
      c.x += c.vx * dtf; c.wheelRot += (c.vx * dtf / WR) * (c.dir > 0 ? 1 : -1);
      if (c.mode === 'enter' && Math.abs(dx) < 4 && Math.abs(c.vx) < 6) c.mode = 'show';
      if ((c.mode === 'leave' || c.mode === 'cruise') && (c.x > sw() + 260 || c.x < -260)) c.gone = true;
      if (c.mode === 'cruise' && c.t > 6 && c.t < 6.06) { c.tgtF = c.tgtR = 16; setTimeout(() => { c.tgtF = c.tgtR = EXT_MIN * 0.5; }, 300); }
      if (c.mode === 'show' && party && clock - (c.stepAt || 0) >= BEAT / 2) { c.stepAt = clock; c.tick(); }
      if (c.landed > 0.25) { dust(c, c.landed > 0.6); if (c.landed > 0.5) cheer(c); c.landed = 0; }
      c.place();
    }
    cars = cars.filter((c) => { if (c.gone) { c.el.remove(); return false; } return true; });
    if (!cars.length && !party) { cancelAnimationFrame(raf); raf = 0; }
  }
  setInterval(() => { if (!raf && !document.hidden && (partying() || performance.now() > nextCruise)) { last = performance.now(); raf = requestAnimationFrame(loop); } }, 1000);
})();
