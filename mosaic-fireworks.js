/* 200 fireworks: 25 burst shapes x 8 styles, each its own look (peony, willow, heart, saturn, crossette, vortex, glitch-chromatic...).
   main.js calls window.MS_FIREWORK(x, y, top) for every firework. Full-screen canvas, additive, crisp particles. Reduced motion: off. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const TAU = Math.PI * 2, rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:44';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  let DPR = 1, W = 0, H = 0, parts = [], rockets = [], raf = 0, last = 0;
  const resize = () => { DPR = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; };
  addEventListener('resize', resize); resize();

  const PAL = [['#ffd24a', '#ff9a3d'], ['#ff2d95', '#b02dff'], ['#3dd6ff', '#2d7dff'], ['#c6ff3d', '#2dffd2'], ['#ec2a1c', '#f6b62c'], ['#ffffff', '#c9d6ff'], ['#ff7ad9', '#ffd1f0'], ['#b48cff', '#3dd6ff']];
  const hue = (h) => 'hsl(' + (((h % 360) + 360) % 360) + ',100%,62%)';

  /* 25 shapes: each returns launch vectors [angle-ish vx,vy,extra] for a burst of a given size */
  const SHAPES = [
    (n) => Array.from({ length: n }, () => { const a = rand(0, TAU), s = Math.sqrt(Math.random()); return [Math.cos(a) * s, Math.sin(a) * s]; }),                       // peony
    (n) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU), Math.sin(i / n * TAU)]),                                                                         // ring
    (n) => Array.from({ length: n }, (_, i) => { const r = i % 2 ? 1 : 0.55, a = i / n * TAU; return [Math.cos(a) * r, Math.sin(a) * r]; }),                            // double ring
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU; return [16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; }),   // heart
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU, r = (i % 2 ? 1 : 0.45); return [Math.sin(t * 5 / 2) * 0 + Math.cos(t) * r, Math.sin(t) * r]; }),  // star-ish
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * 6 * Math.PI, r = i / n; return [Math.cos(t) * r, Math.sin(t) * r]; }),                                // spiral
    (n) => Array.from({ length: n }, () => { const a = rand(0, TAU); return [Math.cos(a), Math.sin(a)]; }),                                                              // sphere shell
    (n) => Array.from({ length: n }, (_, i) => { const arm = i % 7, a = arm / 7 * TAU + rand(-0.06, 0.06); return [Math.cos(a) * rand(0.2, 1), Math.sin(a) * rand(0.2, 1)]; }), // palm
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [Math.cos(a) * 0.5 + Math.cos(a * 3) * 0.5, Math.sin(a) * 0.5 + Math.sin(a * 3) * 0.5]; }),   // flower
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = Math.abs(Math.cos(2 * a)) + 0.2; return [Math.cos(a) * r, Math.sin(a) * r * 0.8]; }),               // clover
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * 4 - 2; return [t / 2, (Math.abs(t) > 1 ? 0 : 0.4) + rand(-0.04, 0.04)]; }),                            // bar
    (n) => Array.from({ length: n }, (_, i) => { const s = i % 4, u = rand(-1, 1); return [[u, -1], [1, u], [u, 1], [-1, u]][s]; }),                                       // square
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU; return [Math.cos(t) * 0.3 + (i % 2 ? 0.7 : -0.7) * Math.cos(t * 0.5), Math.sin(t) * 0.3 + Math.sin(t * 2) * 0.6]; }),  // butterfly
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return i % 5 === 0 ? [Math.cos(a), Math.sin(a)] : [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; }),            // saturn-ish core + ring
    (n) => Array.from({ length: n }, () => [rand(-0.35, 0.35), rand(-1.1, -0.2)]),                                                                                         // fountain
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = 1 + Math.sin(a * 8) * 0.18; return [Math.cos(a) * r, Math.sin(a) * r]; }),                       // gear
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, d = i % 2 ? 1 : 0.6; return [Math.cos(a) * d, Math.sin(a) * d * 0.5]; }),                          // saturn ellipse
    (n) => Array.from({ length: n }, () => { const a = rand(-0.5, 0.5) - Math.PI / 2; return [Math.cos(a) * rand(0.4, 1), Math.sin(a) * rand(0.4, 1)]; }),                 // palm fan
    (n) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU; return [Math.sin(t), Math.sin(t * 2) * 0.6]; }),                                                    // infinity
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, s = i % 3; return [Math.cos(a) * (0.35 + s * 0.3), Math.sin(a) * (0.35 + s * 0.3)]; }),                // triple ring
    (n) => Array.from({ length: n }, (_, i) => { const t = (i / n) * 12 * Math.PI, r = Math.sqrt(i / n); return [Math.cos(t) * r, Math.sin(t) * r]; }),                       // galaxy
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [Math.cos(a) * (0.6 + 0.4 * ((i % 2))), Math.sin(a) * (0.6 + 0.4 * (i % 2))]; }),               // crown
    (n) => Array.from({ length: n }, (_, i) => { const x = (i % 12) / 11 * 2 - 1, y = ((i / 12) | 0) / (n / 12) * 2 - 1; return [x * 0.9, y * 0.9]; }),                        // grid
    (n) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [Math.cos(a) * 0.9, Math.sin(a) * 0.9 + (i % 2 ? 0.25 : -0.25)]; }),                           // split rings
    (n) => Array.from({ length: n }, () => { const a = rand(0, TAU), r = rand(0.1, 1) ** 2; return [Math.cos(a) * r, Math.sin(a) * r]; })                                    // pistil (dense core)
  ];
  /* 8 styles: colour logic, trails, secondary bursts, strobing, chromatic split, gravity... */
  const STYLES = [
    { name: 'gold', col: () => '#ffd24a', g: 0.05, life: 70, trail: 0.2 },
    { name: 'rainbow', col: (i, n) => hue(i / n * 360), g: 0.05, life: 66, trail: 0.15 },
    { name: 'twotone', col: (i) => pick(pick(PAL)) && (i % 2 ? pick(PAL)[0] : pick(PAL)[1]), g: 0.05, life: 70, trail: 0.18 },
    { name: 'chromatic', col: (i) => ['#ff2d55', '#2dff88', '#2d7dff'][i % 3], g: 0.04, life: 62, trail: 0.12, split: 1.6 },
    { name: 'strobe', col: () => '#ffffff', g: 0.03, life: 90, trail: 0.05, strobe: true },
    { name: 'willow', col: () => '#ffbf3d', g: 0.075, life: 120, trail: 0.4, drag: 0.985 },
    { name: 'crackle', col: (i, n) => hue(rand(0, 360)), g: 0.05, life: 56, trail: 0.2, crack: true },
    { name: 'glitter', col: (i) => pick(pick(PAL)), g: 0.05, life: 80, trail: 0.1, glit: true }
  ];
  const COUNT = SHAPES.length * STYLES.length;                      // 200

  function addP(p) { parts.push(p); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function burst(x, y, idx, scale) {
    const sh = SHAPES[idx % SHAPES.length], st = STYLES[(idx / SHAPES.length | 0) % STYLES.length];
    const n = st.name === 'willow' ? 70 : st.crack ? 60 : 90, sp = (3.2 + Math.random() * 1.4) * scale * DPR, rot = rand(0, TAU), cs = Math.cos(rot), sn = Math.sin(rot);
    const vecs = sh(n), flat = idx % 3 !== 1;                        // some shapes are tilted in space, some face the viewer
    vecs.forEach((v, i) => {
      const vx = flat ? v[0] : v[0] * cs - v[1] * sn, vy = flat ? v[1] : v[0] * sn + v[1] * cs, c = st.col(i, n);
      addP({ x, y, vx: vx * sp, vy: vy * sp, g: st.g * DPR, drag: st.drag || 0.975, life: st.life + rand(-8, 14), age: 0, c, trail: st.trail, split: st.split, strobe: st.strobe, crack: st.crack, glit: st.glit, r: rand(1.2, 2.2) * DPR });
    });
  }
  function launch(x, y, top, idx) {
    const tx = x + rand(-60, 60), ty = top + rand(0, 40);
    rockets.push({ x: x * DPR, y: y * DPR, tx: tx * DPR, ty: ty * DPR, vy: -(9 + Math.random() * 3) * DPR, idx });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function tick(now) {
    const dt = Math.min(2.2, (now - last) / 16.67); last = now;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.y += r.vy * dt; r.x += (r.tx - r.x) * 0.02 * dt; r.vy *= 0.985;
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(r.x - DPR, r.y, 2 * DPR, 6 * DPR);
      if (r.y <= r.ty || r.vy > -2.5 * DPR) { burst(r.x, r.y, r.idx, 1 + (r.idx % 5) * 0.08); rockets.splice(i, 1); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      p.vx *= Math.pow(p.drag, dt); p.vy = p.vy * Math.pow(p.drag, dt) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.age / p.life;
      if (k <= 0) { parts.splice(i, 1); continue; }
      if (p.crack && !p.did && k < 0.35) { p.did = true; for (let j = 0; j < 5; j++) { const a = rand(0, TAU); parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * 1.8 * DPR, vy: Math.sin(a) * 1.8 * DPR, g: p.g, drag: 0.96, life: 24, age: 0, c: '#fff6c8', trail: 0, r: DPR * 1.2 }); } }
      if (p.strobe && ((p.age | 0) % 6 < 3)) continue;
      const a = Math.min(1, k * 1.6) * (p.glit && Math.random() < 0.3 ? 0.3 : 1);
      ctx.globalAlpha = a; ctx.fillStyle = p.c;
      if (p.split) { const o = p.split * DPR; ctx.fillStyle = '#ff2d55'; ctx.fillRect(p.x - o, p.y, p.r, p.r); ctx.fillStyle = '#2d7dff'; ctx.fillRect(p.x + o, p.y, p.r, p.r); ctx.fillStyle = '#2dff88'; }
      ctx.fillRect(p.x, p.y, p.r, p.r);
      if (p.trail) { ctx.globalAlpha = a * p.trail; ctx.fillRect(p.x - p.vx * 1.5, p.y - p.vy * 1.5, p.r * 0.8, p.r * 0.8); }
    }
    ctx.globalAlpha = 1;
    if (!parts.length && !rockets.length) { ctx.clearRect(0, 0, W, H); cancelAnimationFrame(raf); raf = 0; return; }
    raf = requestAnimationFrame(tick);
  }
  /* the hook main.js calls (x, y = launch point, top = where it should burst) */
  window.MS_FIREWORK = (x, y, top) => { launch(x, y, top, (Math.random() * COUNT) | 0); return 'ms'; };
  window.MS_FIREWORK.count = COUNT;
})();
