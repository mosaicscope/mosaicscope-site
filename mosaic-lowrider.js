/* Lowriders on the strip. Old-school drop-tops drawn as line art in the Mosaics' style, with a real suspension simulation:
   a rigid body (heave + pitch) on two spring-damper hydraulic corners, gravity, a bump stop, a hydraulic pump with a speed
   limit, and wheels that only push when they're compressed. Hops, nose and tail dances and slams all come from the physics,
   nothing is keyframed. When the music's on they pump to the beat, the crew cheers, and a car-meet crowd shows up around them.
   Cartoon stick figures only. Reduced motion: no cars. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.getElementById('stage');
  if (!stage) return;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FORCE = /[?&]lowrider/.test(location.search);        // ?lowrider: see the cars pump without music
  const partying = () => FORCE || stage.classList.contains('is-party');

  /* ---------------- physics constants (px, seconds) ---------------- */
  const G = 1800, WB = 132, HL = WB / 2, WR = 14;             // gravity, wheelbase, wheel radius
  const MASS = 1, INERTIA = 1500;
  const K = 70, C = 3.2;                                      // per-corner spring and damper
  const S_BASE = 34, S_MIN = 4, KB = 420;                     // rest strut length, bump stop
  const V_UP = 540, V_DOWN = 400;                             // hydraulic pump speeds (px/s)
  const EXT_MIN = -14, EXT_MAX = 34;
  const BEAT = 0.42;

  const COLORS = ['#ff7ad9', '#c6ff3d', '#3dd6ff', '#ff9a3d', '#b48cff'];

  /* ---------------- the car: SVG line art ---------------- */
  function carSVG(color) {
    const spokes = (cx) => { let s = ''; for (let i = 0; i < 12; i++) { const a = i * 0.5236; s += '<path d="M' + cx + ' 0 L' + (cx + Math.cos(a) * 11).toFixed(1) + ' ' + (Math.sin(a) * 11).toFixed(1) + '"/>'; } return s; };
    void spokes;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 100'); svg.setAttribute('class', 'ms-car__svg');
    svg.innerHTML =
      '<g class="ms-car__fx" fill="none" stroke="#9a8d80" stroke-width="2" stroke-linecap="round"><path class="ms-car__pf" d="M0 0 L0 0"/><path class="ms-car__pr" d="M0 0 L0 0"/></g>' +
      '<g class="ms-car__wf"><g class="ms-car__spin" fill="none" stroke-linecap="round"><circle r="14" stroke="#eee4d3" stroke-width="3"/><circle r="9.5" stroke="#9a8d80" stroke-width="1.4"/>' +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path stroke="#c9ccd1" stroke-width="1" d="M0 0 L' + (Math.cos(i * 0.785) * 9.5).toFixed(1) + ' ' + (Math.sin(i * 0.785) * 9.5).toFixed(1) + '"/>').join('') + '</g></g>' +
      '<g class="ms-car__wr"><g class="ms-car__spin" fill="none" stroke-linecap="round"><circle r="14" stroke="#eee4d3" stroke-width="3"/><circle r="9.5" stroke="#9a8d80" stroke-width="1.4"/>' +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path stroke="#c9ccd1" stroke-width="1" d="M0 0 L' + (Math.cos(i * 0.785) * 9.5).toFixed(1) + ' ' + (Math.sin(i * 0.785) * 9.5).toFixed(1) + '"/>').join('') + '</g></g>' +
      '<g class="ms-car__body" fill="none" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
        // hull: long low '64 drop-top with fins and a flat deck
        '<path d="M-98 12 L-100 -2 Q-98 -9 -88 -10 L-66 -11 L-36 -12 L-27 -23 L-14 -23 L-10 -12 L40 -12 L66 -10 Q94 -9 98 0 L98 12 Z"/>' +
        '<path d="M-100 -2 L-110 -16 L-92 -10" stroke-width="2.6"/>' +                                                     // tail fin
        '<path d="M-27 -23 L-22 -14" stroke="#eee4d3" stroke-width="2.4"/>' +                                               // windshield
        '<path d="M-12 -12 Q-8 -20 -2 -14 Q0 -12 -2 -12 M-24 -12 Q-20 -18 -16 -12" stroke-width="2"/>' +                  // seats
        '<path d="M-70 4 H78" stroke="#eee4d3" stroke-width="1.8"/>' +                                                      // chrome trim
        '<path d="M-80 12 Q-66 -4 -52 12 M52 12 Q66 -4 80 12" stroke-width="2.4"/>' +                                       // wheel arches
        '<circle cx="90" cy="-1" r="3" stroke="#f6b62c" stroke-width="2"/><path d="M-96 2 h3" stroke="#ec2a1c" stroke-width="3"/>' +
        '<path d="M-72 -12 L-84 -44" stroke="#c9ccd1" stroke-width="1.2"/><circle cx="-84" cy="-45" r="1.6" fill="#ec2a1c" stroke="none"/>' +   // antenna
        '<path d="M-8 -24 L-6 -18" stroke="#ff7ad9" stroke-width="2" /><circle cx="-6" cy="-17" r="2" fill="#ff7ad9" stroke="none"/>' +          // fuzzy dice
        // the driver, in the Mosaics' own style
        '<g class="ms-car__driver" stroke="#eee4d3" stroke-width="2.4"><circle cx="-14" cy="-35" r="6.5"/><path d="M-14 -28.5 L-14 -14 M-14 -23 L-24 -20 L-27 -26"/><path d="M-19 -36 H-9" stroke="#0e0b0a" stroke-width="3"/></g>' +
      '</g>';
    return svg;
  }

  /* ---------------- one lowrider ---------------- */
  class Car {
    constructor(color, x, dir) {
      this.el = document.createElement('div'); this.el.className = 'ms-car';
      this.svg = carSVG(color); this.el.append(this.svg);
      stage.append(this.el);
      this.q = (s) => this.svg.querySelector(s);
      this.body = this.q('.ms-car__body'); this.wf = this.q('.ms-car__wf'); this.wr = this.q('.ms-car__wr');
      this.pf = this.q('.ms-car__pf'); this.pr = this.q('.ms-car__pr'); this.spinF = this.wf.firstChild; this.spinR = this.wr.firstChild;
      this.color = color;
      // state
      this.x = x; this.vx = 0; this.targetX = x; this.maxV = 70; this.dir = dir || 1;
      this.yc = WR + S_BASE - 13; this.vy = 0; this.th = 0; this.om = 0;        // body height, vertical velocity, pitch, pitch rate
      this.extF = EXT_MIN * 0.5; this.extR = EXT_MIN * 0.5; this.tgtF = this.extF; this.tgtR = this.extR;
      this.roll = 0; this.mode = 'enter'; this.t = 0; this.beatAt = 0; this.beatN = Math.floor(Math.random() * 4) * 4; this.leave = false; this.landed = 0; this.wheelRot = 0;
    }
    get width() { return 220; }

    /* one fixed physics step */
    step(dt) {
      // hydraulic actuators chase their targets at a limited speed
      const mv = (cur, tgt) => (tgt > cur ? Math.min(tgt, cur + V_UP * dt) : Math.max(tgt, cur - V_DOWN * dt));
      this.extF = mv(this.extF, this.tgtF); this.extR = mv(this.extR, this.tgtR);
      const s = Math.sin(this.th), c = Math.cos(this.th);
      const yAf = this.yc + HL * s, yAr = this.yc - HL * s;
      const sF = yAf - WR, sR = yAr - WR;                               // strut lengths (wheel centre to body attach)
      const vF = this.vy + HL * c * this.om, vR = this.vy - HL * c * this.om;
      let FF = K * (S_BASE + this.extF - sF) - C * vF, FR = K * (S_BASE + this.extR - sR) - C * vR;
      if (sF < S_MIN) FF += KB * (S_MIN - sF);                           // bump stops
      if (sR < S_MIN) FR += KB * (S_MIN - sR);
      FF = Math.max(0, FF); FR = Math.max(0, FR);                        // wheels push, they never pull: airborne = free flight
      const onGround = FF > 0 || FR > 0;
      const ay = (FF + FR) / MASS - G;
      const torque = (FF - FR) * HL * c - this.om * 6;                   // a little air/structural damping
      const prevVy = this.vy;
      this.vy += ay * dt; this.yc += this.vy * dt;
      this.om += (torque / INERTIA) * dt; this.th = clamp(this.th + this.om * dt, -0.5, 0.5);
      if (this.yc < WR + S_MIN - 2) { this.yc = WR + S_MIN - 2; if (this.vy < 0) this.vy = 0; }                  // belly on the road
      if (onGround && prevVy < -260) this.landed = Math.min(1, -prevVy / 900);                                    // landing thump (for dust and reactions)
      this.airborne = !onGround;
    }

    /* the pump controller: patterns driven by the beat, never by animation */
    pump(beat) {
      const n = this.beatN++ % 16;
      const UP = 30, HI = EXT_MAX, DOWN = EXT_MIN * 0.5;
      const set = (f, r) => { this.tgtF = f; this.tgtR = r; };
      if (n < 4) set(n % 2 === 0 ? UP : DOWN, DOWN);                      // nose dance
      else if (n < 8) set(DOWN, n % 2 === 0 ? UP : DOWN);                 // tail dance
      else if (n < 12) set(n % 2 === 0 ? UP : DOWN, n % 2 === 0 ? DOWN : UP);   // rocking
      else if (n === 12) set(26, 26);                                     // lift and hold
      else if (n === 13) set(EXT_MIN, EXT_MIN);                           // slam
      else if (n === 14) set(HI, HI);                                     // the big hop
      else set(DOWN, DOWN);                                               // land and settle
      this.lastBeat = beat;
      return n;
    }

    place() {
      // world <-> svg: ground at y=96, car centre at x=110
      const th = this.th, c = Math.cos(th), s = Math.sin(th);
      const X = (bx, byUp) => 110 + bx * c - byUp * s, Y = (bx, byUp) => 96 - (this.yc + bx * s + byUp * c);
      this.body.setAttribute('transform', 'translate(110 ' + (96 - this.yc).toFixed(2) + ') rotate(' + (-th * 57.2958).toFixed(2) + ')');
      this.wf.setAttribute('transform', 'translate(' + (110 + HL) + ' ' + (96 - WR) + ')');
      this.wr.setAttribute('transform', 'translate(' + (110 - HL) + ' ' + (96 - WR) + ')');
      this.spinF.setAttribute('transform', 'rotate(' + (this.wheelRot * 57.2958).toFixed(1) + ')'); this.spinR.setAttribute('transform', 'rotate(' + (this.wheelRot * 57.2958).toFixed(1) + ')');
      // hydraulic rams: from the body's underside to each axle (they visibly extend and compress)
      const fx = X(HL, -6), fy = Y(HL, -6), rx = X(-HL, -6), ry = Y(-HL, -6);
      this.pf.setAttribute('d', 'M' + (110 + HL).toFixed(1) + ' ' + (96 - WR).toFixed(1) + ' L' + fx.toFixed(1) + ' ' + fy.toFixed(1));
      this.pr.setAttribute('d', 'M' + (110 - HL).toFixed(1) + ' ' + (96 - WR).toFixed(1) + ' L' + rx.toFixed(1) + ' ' + ry.toFixed(1));
      this.el.style.transform = 'translate3d(' + Math.round(this.x) + 'px,0,0)' + (this.dir < 0 ? ' scaleX(-1)' : '');
    }
  }

  /* ---------------- the scene: cars, the crew's reactions, the car-meet crowd ---------------- */
  let cars = [], npcs = [], raf = 0, last = 0, acc = 0, beatClock = 0, partyWas = false, nextCruise = performance.now() + rand(25000, 60000), spawnAt = 0;
  const sw = () => stage.clientWidth;

  function spawn(parkX) {
    const fromLeft = Math.random() < 0.5, color = COLORS[cars.length % COLORS.length];
    const car = new Car(color, fromLeft ? -240 : sw() + 30, fromLeft ? 1 : -1);
    car.targetX = parkX; car.mode = 'enter'; car.maxV = 120;
    cars.push(car);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    return car;
  }
  function slotX(i) { const n = Math.max(1, Math.min(3, Math.floor(sw() / 330))); const gap = sw() / (n + 1); return gap * (1 + (i % n)) - 110; }

  /* car-meet crowd: clones of the crew, standing around the cars, being what people at a car meet are */
  const ROLES = {
    og: ['meanmug', 'chainflex', 'loiterlean', 'cashflash', 'wannafight', 'sunglassflex', 'dapup'],
    bro: ['hypeman', 'fingerguns', 'mirrorcheck', 'phonerage', 'shrughuh', 'pistolair', 'lightercheck'],
    model: ['hairwhip', 'duckselfie', 'shakeit', 'polespin', 'mirrorcheck', 'lowriderlean']
  };
  function makeNpc(role, x) {
    const src = pick([...stage.querySelectorAll('.raver')].filter((e) => !e.classList.contains('ms-npc')));
    if (!src) return null;
    const el = src.cloneNode(true);
    el.classList.add('ms-npc'); el.removeAttribute('aria-label'); el.setAttribute('tabindex', '-1'); el.setAttribute('aria-hidden', 'true'); el.dataset.name = '';
    el.querySelectorAll('.ms-say, .ms-flash').forEach((n) => n.remove()); el.__ms = false; el.__watch = false;
    el.style.setProperty('--x', Math.round(x) + 'px'); el.style.transitionDuration = '0s';
    el.style.filter = 'hue-rotate(' + Math.floor(rand(0, 360)) + 'deg)';
    stage.append(el);
    const npc = { el, role, x, t: 0, next: rand(0.2, 2) };
    return npc;
  }
  function setNpcMove(n) {
    const m = pick(ROLES[n.role]);
    const dance = ['hairwhip', 'shakeit', 'polespin', 'lowriderlean', 'sunglassflex'].includes(m);
    n.el.className = 'raver ms-npc ' + (n.el.className.match(/st-\w+/) || [''])[0] + ' ' + (dance ? 'is-rave d-' : 'is-') + m;
    n.next = rand(3, 6.5);
  }
  function addMeet() {
    if (npcs.length) return;
    const lead = cars[0]; if (!lead) return;
    const spots = [lead.x - 40, lead.x + 235, lead.x + 262, lead.x - 70, lead.x + 205, lead.x + 150];
    ['og', 'model', 'bro', 'og', 'model', 'bro'].forEach((role, i) => { const n = makeNpc(role, clamp(spots[i], 0, sw() - 60)); if (n) { npcs.push(n); setNpcMove(n); n.el.classList.add('is-arriving'); } });
  }
  function clearMeet() { npcs.forEach((n) => n.el.remove()); npcs = []; }

  function cheer(car) {
    const cx = car.x + 110, say = window.MOSAIC_MOVES && window.MOSAIC_MOVES.say;
    stage.querySelectorAll('.raver').forEach((el) => {
      if (el.classList.contains('ms-npc')) return;
      const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), mid = r.left - sr.left + r.width / 2;
      if (Math.abs(mid - cx) < 230) {
        el.classList.remove('ms-hype'); void el.offsetWidth; el.classList.add('ms-hype');
        if (say && Math.random() < 0.5) say(el, pick(['AYYYY', 'HIT IT', 'GO GO', 'YOOO', 'ride!', 'WHAT']), 900);
      }
    });
    npcs.forEach((n) => { if (Math.abs(n.x + 40 - cx) < 260 && Math.random() < 0.5) { n.el.classList.remove('ms-hype'); void n.el.offsetWidth; n.el.classList.add('ms-hype'); } });
  }
  function dust(car, strong) {
    for (const wx of [car.x + 110 - HL, car.x + 110 + HL]) {
      const d = document.createElement('i'); d.className = 'ms-dust'; d.style.left = wx + 'px'; d.style.setProperty('--k', strong ? 1.6 : 1);
      d.addEventListener('animationend', () => d.remove()); stage.append(d);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const frameDt = Math.min(0.05, (now - last) / 1000); last = now;
    const party = partying();
    // scene control
    if (party && !partyWas) { spawnAt = now + 800; }
    if (!party && partyWas) { cars.forEach((c) => { c.leave = true; c.targetX = c.dir > 0 ? sw() + 260 : -260; c.maxV = 150; c.mode = 'leave'; c.tgtF = c.tgtR = EXT_MIN * 0.5; }); clearMeet(); }
    partyWas = party;
    if (party && !document.hidden) {
      if (cars.filter((c) => !c.leave).length < 3 && now > spawnAt) { spawn(slotX(cars.length)); spawnAt = now + rand(6000, 9000); }
      if (cars.length && !npcs.length && cars[0].mode === 'show') addMeet();
    } else if (!party && !cars.length && now > nextCruise && !document.hidden) {
      const c = spawn(sw() + 300); c.targetX = c.dir > 0 ? sw() + 300 : -300; c.mode = 'cruise'; c.maxV = 46; nextCruise = now + rand(60000, 120000);
    }

    // fixed-step physics + control for each car
    acc += frameDt; beatClock += frameDt;
    const H = 1 / 240;
    while (acc >= H) {
      for (const c of cars) c.step(H);
      acc -= H;
    }
    for (const c of cars) {
      c.t += frameDt;
      // driving: simple speed controller towards the target, with a gap to the car ahead
      let tx = c.targetX;
      const dx = tx - c.x; const want = clamp(dx * 1.4, -c.maxV, c.maxV);
      c.vx += clamp(want - c.vx, -260 * frameDt, 260 * frameDt);
      for (const o of cars) if (o !== c && Math.abs(o.x - c.x) < 250 && Math.sign(o.x - c.x) === Math.sign(c.vx || 1) && Math.abs(o.x - c.x) < Math.abs(c.vx) * 0.9 + 236) c.vx *= 0.6;   // don't drive through each other
      c.x += c.vx * frameDt; c.wheelRot += (c.vx * frameDt / WR) * (c.dir > 0 ? 1 : -1);
      if (c.mode === 'enter' && Math.abs(dx) < 4 && Math.abs(c.vx) < 6) { c.mode = 'show'; c.beatN = Math.floor(Math.random() * 4) * 4; }
      if (c.mode === 'leave' && (c.x > sw() + 240 || c.x < -240)) c.gone = true;
      if (c.mode === 'cruise' && (c.x > sw() + 280 || c.x < -280)) c.gone = true;
      if (c.mode === 'cruise' && c.t > 5 && c.t < 5.1) { c.tgtF = 22; c.tgtR = 22; setTimeout(() => { c.tgtF = c.tgtR = EXT_MIN * 0.5; }, 280); }       // a little show-off bump while cruising by
      // pump to the beat when parked and the music is on
      if (c.mode === 'show' && party && beatClock - (c.beatAt || 0) >= BEAT) { c.beatAt = beatClock; const n = c.pump(beatClock); if (n === 14 || n === 12) cheer(c); }
      if (c.landed > 0.25) { dust(c, c.landed > 0.6); if (c.landed > 0.5) cheer(c); c.landed = 0; }
      c.place();
    }
    cars = cars.filter((c) => { if (c.gone) { c.el.remove(); return false; } return true; });
    if (!cars.length) { clearMeet(); if (!party) { cancelAnimationFrame(raf); raf = 0; } }

    // crowd
    for (const n of npcs) { n.t += frameDt; if (n.t > n.next) { n.t = 0; setNpcMove(n); } }
  }

  // pause the crowd and cars while the tab is hidden; start the loop when the music starts
  setInterval(() => { if (!raf && partying() && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } else if (!raf && !document.hidden && performance.now() > nextCruise && !cars.length) { last = performance.now(); raf = requestAnimationFrame(loop); } }, 1000);
  // add ?lowrider to the URL to see one right away
  if (/[?&]lowrider\b/.test(location.search)) { nextCruise = 0; setTimeout(() => { const c = spawn(slotX(0)); c.mode = 'enter'; setTimeout(() => { if (c.mode === 'show') return; }, 1); }, 1500); }
})();
