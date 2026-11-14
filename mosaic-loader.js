/* While the page loads: a forged, polished-chrome MosaicScope logo you can play with. Move to tilt it (smooth spring, no snapping),
   the reflections slide across the metal, chromatic fringes split at the edges, and a click strikes it: sparks and a heat flash that
   cools back to chrome. It fades away once the page is ready. Reduced motion: a still logo. */
(() => {
  'use strict';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.createElement('div');
  root.id = 'ms-loader'; root.setAttribute('role', 'status'); root.setAttribute('aria-label', 'Loading MosaicScope');
  const css = document.createElement('style');
  css.textContent = '#ms-loader{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#1b1614,#070605 70%);touch-action:none;cursor:crosshair;transition:opacity .7s ease,visibility .7s}' +
    '#ms-loader.is-out{opacity:0;visibility:hidden;pointer-events:none}#ms-loader svg{width:min(62vmin,360px);height:auto;overflow:visible;filter:drop-shadow(0 18px 24px rgba(0,0,0,.7))}' +
    '#ms-loader canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}';
  document.head.append(css);

  const FRAME = 'M2 9V2h7M23 2h7v7M30 23v7h-7M9 30H2v-7', M = 'M10.5 23V15.5M10.5 18.2c0-4.4 6-4.4 6 0V23M16.5 18.2c0-4.4 6-4.4 6 0V23', CHIP = 'M23.6 8h3.6v3.6h-3.6z';
  const DEPTH = 14;
  const shape = (stroke, extra) => '<g fill="none" stroke="' + stroke + '" stroke-linecap="square" stroke-linejoin="miter" ' + (extra || '') + '><path d="' + FRAME + '" stroke-width="3.4"/><path d="' + M + '" stroke-width="3.8"/><path d="' + CHIP + '" fill="' + stroke + '" stroke-width="0.6"/></g>';
  let layers = '';
  for (let i = DEPTH; i >= 1; i--) layers += '<g class="ms-l" data-i="' + i + '">' + shape('hsl(' + (28 - i * 1.2) + ',' + (18 + i) + '%,' + (14 + (DEPTH - i) * 1.6) + '%)') + '</g>';
  root.innerHTML =
    '<svg viewBox="-6 -6 44 44" aria-hidden="true"><defs>' +
      '<linearGradient id="msChrome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="32" y2="32"><stop offset="0" stop-color="#fff"/><stop offset=".18" stop-color="#9aa3b5"/><stop offset=".34" stop-color="#1a1d25"/><stop offset=".5" stop-color="#e9eefc"/><stop offset=".66" stop-color="#58607a"/><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#6b7388"/></linearGradient>' +
      '<linearGradient id="msHot" gradientUnits="userSpaceOnUse" x1="0" y1="32" x2="32" y2="0"><stop offset="0" stop-color="#ff3d1f"/><stop offset=".5" stop-color="#ffb02d"/><stop offset="1" stop-color="#fff2b8"/></linearGradient>' +
      '<linearGradient id="msSweep" gradientUnits="userSpaceOnUse" x1="-20" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="msMask" maskUnits="userSpaceOnUse" x="-6" y="-6" width="44" height="44">' + shape('#fff') + '</mask></defs>' +
      '<g id="ms-ext">' + layers + '</g>' +
      '<g id="ms-fr" style="mix-blend-mode:screen" opacity=".55"><g id="ms-r">' + shape('#ff2d55') + '</g><g id="ms-b">' + shape('#2d7dff') + '</g></g>' +
      '<g id="ms-top">' + shape('url(#msChrome)') + '</g>' +
      '<g id="ms-hot" opacity="0">' + shape('url(#msHot)') + '</g>' +
      '<g mask="url(#msMask)"><rect id="ms-sweep" x="-6" y="-6" width="40" height="44" fill="url(#msSweep)" transform="skewX(-20)"/></g>' +
    '</svg><canvas></canvas>';
  document.body.prepend(root);

  const $ = (s) => root.querySelector(s);
  const ext = [...root.querySelectorAll('.ms-l')], top = $('#ms-top'), hot = $('#ms-hot'), sweep = $('#ms-sweep'), rr = $('#ms-r'), bb = $('#ms-b'), chrome = root.querySelector('#msChrome');
  const cv = root.querySelector('canvas'), cx = cv.getContext('2d');
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, heat = 0, sparks = [], t0 = performance.now(), ready = false, raf = 0, down = false;
  const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; };
  addEventListener('resize', fit); fit();
  const aim = (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; };
  root.addEventListener('pointermove', aim);
  root.addEventListener('pointerdown', (e) => { aim(e); down = true; strike(e); });
  root.addEventListener('pointerup', () => { down = false; });
  function strike(e) {
    heat = 1;
    const d = Math.min(2, devicePixelRatio || 1);
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 9; sparks.push({ x: e.clientX * d, y: e.clientY * d, vx: Math.cos(a) * s * d, vy: (Math.sin(a) * s - 2) * d, life: 1, w: Math.random() * 2 + 1 }); }
  }
  if (!REDUCED) setTimeout(() => strike({ clientX: innerWidth / 2, clientY: innerHeight / 2 }), 350);       // the first hammer blow

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, k = REDUCED ? 0 : 1;
    if (!pointerSeen) { tx = Math.sin(t * 0.7) * 0.5; ty = Math.cos(t * 0.5) * 0.4; }            // idle: it turns on its own until you touch it
    // critically-damped spring: smooth, no jitter, no overshoot
    const ks = 70, c = 2 * Math.sqrt(ks), dt = 1 / 60;
    vx += (ks * (tx - x) - c * vx) * dt; vy += (ks * (ty - y) - c * vy) * dt; x += vx * dt; y += vy * dt;
    const dx = x * 1.4 * k, dy = y * 1.4 * k;
    ext.forEach((g) => { const i = +g.dataset.i; g.setAttribute('transform', 'translate(' + (-dx * i * 0.32).toFixed(3) + ' ' + (-dy * i * 0.32).toFixed(3) + ')'); });
    top.setAttribute('transform', 'translate(' + (dx * 0.4).toFixed(3) + ' ' + (dy * 0.4).toFixed(3) + ')');
    hot.setAttribute('transform', 'translate(' + (dx * 0.4).toFixed(3) + ' ' + (dy * 0.4).toFixed(3) + ')');
    rr.setAttribute('transform', 'translate(' + (dx * 0.4 - 0.5 - Math.abs(dx) * 0.4).toFixed(3) + ' ' + (dy * 0.4).toFixed(3) + ')');
    bb.setAttribute('transform', 'translate(' + (dx * 0.4 + 0.5 + Math.abs(dx) * 0.4).toFixed(3) + ' ' + (dy * 0.4).toFixed(3) + ')');
    chrome.setAttribute('gradientTransform', 'rotate(' + (x * 40 + y * 25 + Math.sin(t * 0.8) * 8).toFixed(2) + ' 16 16)');
    sweep.setAttribute('transform', 'skewX(-20) translate(' + (((t * 22) % 90) - 20).toFixed(2) + ' 0)');
    heat = Math.max(0, heat - (down ? 0.004 : 0.012)); hot.setAttribute('opacity', (heat > 0 ? heat * heat : 0).toFixed(3));
    root.querySelector('svg').style.transform = 'perspective(900px) rotateY(' + (x * 22 * k).toFixed(2) + 'deg) rotateX(' + (-y * 18 * k).toFixed(2) + 'deg)';
    cx.clearRect(0, 0, cv.width, cv.height); cx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.vy += 0.35; s.x += s.vx; s.y += s.vy; s.vx *= 0.985; s.life -= 0.018;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      cx.fillStyle = 'rgba(255,' + ((140 + s.life * 110) | 0) + ',' + ((40 + s.life * 80) | 0) + ',' + s.life + ')'; cx.fillRect(s.x, s.y, s.w * 2, s.w * 2);
    }
    if (ready && now - t0 > 1500 && !sparks.length) done();
  }
  let pointerSeen = false;
  root.addEventListener('pointermove', () => { pointerSeen = true; }, { once: true });
  function done() { cancelAnimationFrame(raf); root.classList.add('is-out'); setTimeout(() => { root.remove(); css.remove(); }, 800); }
  const go = () => { ready = true; };
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
  setTimeout(go, 9000); setTimeout(() => { if (document.getElementById('ms-loader')) done(); }, 12000);                                            // never trap anyone on a slow connection
  raf = requestAnimationFrame(frame);
  if (REDUCED) setTimeout(() => { if (ready) done(); }, 900);
})();
