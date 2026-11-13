/* mosaicStudios entry. A chromatic dot-matrix cube + wordmark you can drag, poke and tap,
   which opens an iPhone 2G style passcode lock. The code is a playful gate, not security. */
(() => {
  'use strict';
  const TARGET = '/studio/';
  const PIN_HASH = 'eb3d9dac46073924cffbc322aeac56e17b3c33c8005b591d3209e26e14af625b';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="11" height="11" rx="2.5" fill="currentColor"/><rect x="18" y="3" width="11" height="11" rx="2.5" fill="currentColor" opacity=".7"/><rect x="3" y="18" width="11" height="11" rx="2.5" fill="currentColor" opacity=".7"/><rect x="18" y="18" width="11" height="11" rx="2.5" fill="currentColor" opacity=".45"/></svg>';

  /* ------------------------------------------------------------------ markup */
  const foot = document.querySelector('footer.foot');
  if (!foot) return;
  const section = document.createElement('div');
  section.className = 'studio-dock';
  section.id = 'studio';
  section.innerHTML =
    '<div class="mcard" id="mcard" tabindex="0" role="button" aria-label="mosaicStudioS collectible card. Tap to enter.">' +
      '<div class="mcard__in"><div class="mcard__face">' +
        '<div class="mcard__chrome"></div><div class="mcard__neon"></div>' +
        '<div class="mcard__top"><b class="mcard__name">mosaicStudioS</b><span class="mcard__lv">LV 99</span></div>' +
        '<div class="mcard__art"><canvas id="studio-canvas" aria-hidden="true"></canvas><div class="mcard__refl"></div></div>' +
        '<div class="mcard__gear"><span>D750 · FX</span><span>GH5</span><span>17 PRO MAX</span></div>' +
        '<div class="mcard__sweep"></div><div class="mcard__glare"></div>' +
      '</div></div>' +
    '</div>';
  foot.before(section);

  /* ------------------------------------------------------------- iPhone 2G */
  const dlg = document.createElement('dialog');
  dlg.className = 'ip2g';
  dlg.setAttribute('aria-label', 'mosaicStudioS passcode');
  const keyDefs = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']];
  dlg.innerHTML =
    '<div class="ip" id="ip">' +
      '<span class="ip__cam"></span><span class="ip__speaker"></span>' +
      '<div class="ip__screen">' +
        '<div class="ip__wall"></div>' +
        '<div class="ip__status"><span>MosaicScope</span><span id="ip-clock">9:41 AM</span><span class="ip__bat"></span></div>' +
        '<div class="ip__view" id="ip-lock">' +
          '<div class="ip__time" id="ip-time">9:41</div><div class="ip__date" id="ip-date"></div><div class="ip__tag">mosaicStudioS</div>' +
          '<div class="ip__slide" id="ip-slide"><div class="ip__slidetxt">slide to unlock</div><button class="ip__knob" id="ip-knob" type="button" aria-label="Slide to unlock"></button></div>' +
        '</div>' +
        '<div class="ip__view ip__pass" id="ip-pass" hidden>' +
          '<div class="ip__ptitle">Enter Passcode</div>' +
          '<div class="ip__pdots" id="ip-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
          '<div class="ip__msg" id="ip-msg" role="status" aria-live="polite"></div>' +
          '<div class="ip__keys" id="ip-keys"></div>' +
        '</div>' +
        '<div class="ip__view ip__homev" id="ip-homev" hidden><div class="ip__grid" id="ip-grid"></div><div class="ip__dock" id="ip-dock"></div></div>' +
        '<div class="ip__ok"><span>Unlocked</span></div>' +
        '<div class="ip__gloss"></div>' +
      '</div>' +
      '<button class="ip__home" id="ip-home" type="button" aria-label="Home (close)"></button>' +
    '</div>';
  document.body.append(dlg);

  const $ = (id) => dlg.querySelector('#' + id);
  const ip = $('ip'), lockV = $('ip-lock'), passV = $('ip-pass'), knob = $('ip-knob'), slide = $('ip-slide');
  const dotsEl = $('ip-dots'), msg = $('ip-msg'), keysEl = $('ip-keys');
  let code = '', busy = false;

  keyDefs.forEach(([n, l]) => addKey(n, l));
  addKey('Cancel', null, true);
  addKey('0', '');
  addKey('⌫', null, true);
  function addKey(label, letters, ghost) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ip__key' + (ghost ? ' ip__key--ghost' : '');
    b.innerHTML = letters == null ? label : label + '<small>' + letters + '</small>';
    if (label === '⌫') b.setAttribute('aria-label', 'Delete');
    b.addEventListener('click', () => press(label));
    keysEl.append(b);
  }

  function tick() {
    const d = new Date();
    $('ip-time').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');
    $('ip-clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('ip-date').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function paintDots() { [...dotsEl.children].forEach((el, i) => el.classList.toggle('is-on', i < code.length)); }

  async function sha(text) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function check() {
    busy = true;
    const h = await sha(code);
    const ok = h ? h === PIN_HASH : code === '2372';
    if (ok) {
      ip.classList.add('is-ok');
      setTimeout(() => { passV.hidden = true; homeV.hidden = false; ip.classList.remove('is-ok'); busy = false; }, REDUCED ? 100 : 700);
      return;
    }
    msg.textContent = 'Wrong passcode. Try again.';
    dotsEl.classList.remove('is-bad'); void dotsEl.offsetWidth; dotsEl.classList.add('is-bad');
    if (navigator.vibrate) navigator.vibrate(120);
    setTimeout(() => { code = ''; paintDots(); busy = false; }, 450);
  }
  function press(k) {
    if (busy) return;
    if (k === 'Cancel') { dlg.close(); return; }
    msg.textContent = '';
    if (k === '⌫') code = code.slice(0, -1);
    else if (/^\d$/.test(k) && code.length < 4) code += k;
    paintDots();
    if (code.length === 4) check();
  }

  /* ---- springboard: real apps that open the real accounts ---- */
  const IG = 'https://www.instagram.com/mosaicscope/';
  const YT = 'https://www.youtube.com/@mosaicscope';
  const MAIL = 'mailto:mosiacscope@gmail.com?subject=' + encodeURIComponent('Shoot enquiry') + '&body=' + encodeURIComponent('Hi Chris,\n\n');
  const goto = (hash) => () => { dlg.close(); const el = document.querySelector(hash); if (el) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); };
  const G = (inner) => '<svg viewBox="0 0 32 32" aria-hidden="true">' + inner + '</svg>';
  const APPS = {
    studios:   { label: 'Studios',   bg: 'linear-gradient(#5a5f6b,#14161b)', svg: G('<path d="M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M10.5 22v-7M10.5 17.5c0-4 5.5-4 5.5 0V22M16 17.5c0-4 5.5-4 5.5 0V22" fill="none" stroke="#ec2a1c" stroke-width="2.6" stroke-linecap="square"/><rect x="22" y="8.5" width="3.4" height="3.4" fill="#f6b62c"/>'), go: () => location.assign(TARGET) },
    instagram: { label: 'Instagram', bg: 'linear-gradient(135deg,#f9ce34,#ee2a7b 55%,#6228d7)', svg: G('<rect x="6" y="6" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="16" cy="16" r="4.6" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="22" cy="10" r="1.5" fill="#fff"/>'), go: () => window.open(IG, '_blank', 'noopener') },
    youtube:   { label: 'YouTube',   bg: 'linear-gradient(#fff,#e4e4e4)', svg: G('<rect x="3" y="8" width="26" height="16" rx="5" fill="#f00"/><path d="M13.5 12.2v7.6L20.5 16z" fill="#fff"/>'), go: () => window.open(YT, '_blank', 'noopener') },
    mail:      { label: 'Mail',      bg: 'linear-gradient(#5fb3ff,#1a62d8)', svg: G('<rect x="4" y="8" width="24" height="16" rx="2.5" fill="#fff"/><path d="M5 10l11 8 11-8" fill="none" stroke="#1a62d8" stroke-width="2"/>'), go: () => { location.href = MAIL; } },
    work:      { label: 'Work',      bg: 'linear-gradient(#8f96a3,#4a505c)', svg: G('<rect x="5" y="7" width="22" height="18" rx="2" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="14" r="2.2" fill="#fff"/><path d="M6 23l7-6 5 4 4-3 5 5" fill="none" stroke="#fff" stroke-width="2"/>'), go: goto('#work') },
    rates:     { label: 'Rates',     bg: 'linear-gradient(#7be07a,#27a02a)', svg: G('<text x="16" y="23" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="Helvetica,Arial,sans-serif">$</text>'), go: goto('#rates') },
    book:      { label: 'Book',      bg: 'linear-gradient(#fff,#ececec)', svg: G('<rect x="3" y="3" width="26" height="8" fill="#ec2a1c"/><text x="16" y="26" text-anchor="middle" font-size="16" font-weight="300" fill="#111" font-family="Helvetica,Arial,sans-serif">' + new Date().getDate() + '</text>'), go: goto('#contact') },
    faq:       { label: 'FAQ',       bg: 'linear-gradient(#ffe36a,#f2a900)', svg: G('<text x="16" y="24" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="Helvetica,Arial,sans-serif">?</text>'), go: goto('#faq') }
  };
  const gridEl = $('ip-grid'), dockEl = $('ip-dock'), homeV = $('ip-homev');
  function addApp(host, key) {
    const a = APPS[key];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ip__app';
    b.innerHTML = '<span class="ip__icon" style="background:' + a.bg + '">' + a.svg + '</span>' + (host === gridEl ? '<span class="ip__lbl">' + a.label + '</span>' : '');
    b.setAttribute('aria-label', a.label);
    b.addEventListener('click', () => {
      b.classList.add('is-launch');
      setTimeout(() => { b.classList.remove('is-launch'); a.go(); }, REDUCED ? 0 : 260);
    });
    host.append(b);
  }
  ['studios', 'work', 'rates', 'book', 'faq'].forEach((k) => addApp(gridEl, k));
  ['mail', 'instagram', 'youtube', 'studios'].forEach((k) => addApp(dockEl, k));

  /* slide to unlock (pointer drag, plus click / Enter for keyboard users) */
  function showPass() {
    lockV.classList.add('ip__view--out');
    setTimeout(() => { lockV.hidden = true; passV.hidden = false; }, 260);
  }
  let sx = 0, dragging = false;
  const maxX = () => slide.clientWidth - knob.offsetWidth - knob.offsetLeft * 2;
  knob.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - (parseFloat(knob.style.transform.replace(/[^\d.-]/g, '')) || 0); knob.setPointerCapture(e.pointerId); knob.style.transition = 'none'; });
  knob.addEventListener('pointermove', (e) => { if (!dragging) return; knob.style.transform = 'translateX(' + Math.max(0, Math.min(maxX(), e.clientX - sx)) + 'px)'; });
  const release = () => {
    if (!dragging) return; dragging = false;
    const x = parseFloat(knob.style.transform.replace(/[^\d.-]/g, '')) || 0;
    knob.style.transition = 'transform .3s';
    if (x > maxX() * 0.8) { knob.style.transform = 'translateX(' + maxX() + 'px)'; showPass(); }
    else knob.style.transform = 'translateX(0)';
  };
  knob.addEventListener('pointerup', release);
  knob.addEventListener('pointercancel', release);
  knob.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPass(); } });
  slide.addEventListener('click', (e) => { if (e.target !== knob && !dragging) showPass(); });

  $('ip-home').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (passV.hidden) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('⌫');
  });
  let opener = null;
  function openLock() {
    opener = document.activeElement;
    code = ''; busy = false; paintDots(); msg.textContent = '';
    ip.classList.remove('is-ok');
    lockV.hidden = false; lockV.classList.remove('ip__view--out'); passV.hidden = true; homeV.hidden = true;
    knob.style.transition = 'none'; knob.style.transform = 'translateX(0)';
    tick();
    if (!dlg.open) dlg.showModal();
    knob.focus({ preventScroll: true });
  }
  dlg.addEventListener('close', () => { if (opener && opener.focus) opener.focus({ preventScroll: true }); });
  setInterval(() => { if (dlg.open) tick(); }, 15000);
  $('ip-time').textContent = '';

  /* ----------------------------------------------- mirror-chrome card */
  const card = document.getElementById('mcard');
  const cardIn = card.querySelector('.mcard__in');
  const HUES = [0, 62, 140, 205, 275, 325];
  let edition = 0;
  function setEdition(i) {
    edition = (i + HUES.length) % HUES.length;
    card.style.setProperty('--hue', HUES[edition] + 'deg');
  }
  setEdition(0);
  if (!REDUCED) setInterval(() => { if (!hovering) setEdition(edition + 1); }, 6500);

  // Pointer-driven tilt (kept small so the card still reads as flat) with a slow idle drift
  let tx = 0, ty = 0, cx = 0, cy = 0, hovering = false, cardDown = null, lastClick = 0;
  const setLight = (px, py) => { card.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--my', (py * 100).toFixed(1) + '%'); };
  let pointer = null, pvx = 0, pvy = 0;
  function onMove(e) {
    const r = card.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    tx = (px - 0.5) * 16; ty = -(py - 0.5) * 16; setLight(px, py); hovering = true;
    const cr = canvas.getBoundingClientRect();
    const nx = (e.clientX - cr.left) * (canvas.width / cr.width), ny = (e.clientY - cr.top) * (canvas.height / cr.height);
    if (pointer) { pvx = nx - pointer.x; pvy = ny - pointer.y; }
    pointer = { x: nx, y: ny };
    if (cardDown && Math.hypot(e.clientX - cardDown.x, e.clientY - cardDown.y) > 8) cardDown.moved = true;
  }
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerenter', (e) => { pointer = null; onMove(e); });
  card.addEventListener('pointerleave', () => { hovering = false; pointer = null; pvx = pvy = 0; cardDown = null; });
  card.addEventListener('pointerdown', (e) => { cardDown = { x: e.clientX, y: e.clientY, moved: false, t: performance.now() }; onMove(e); poke(); });
  card.addEventListener('pointerup', () => {
    if (cardDown && !cardDown.moved && performance.now() - cardDown.t < 600) {
      const now = performance.now();
      if (now - lastClick < 320) { setEdition(edition + 1); lastClick = 0; }   // double tap: next edition
      else { lastClick = now; setTimeout(() => { if (lastClick === now) { lastClick = 0; openLock(); } }, 330); }
    }
    cardDown = null;
  });
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLock(); } });

  let cardVisible = true;
  function cardLoop(now) {
    requestAnimationFrame(cardLoop);
    if (!cardVisible || document.hidden) return;
    if (!hovering && !REDUCED) {
      const t = now / 1000;
      tx = Math.sin(t * 0.8) * 5; ty = Math.cos(t * 0.6) * 3.5;
      setLight(0.5 + Math.sin(t * 0.8) * 0.4, 0.5 + Math.cos(t * 0.6) * 0.4);
    }
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    cardIn.style.transform = 'rotateY(' + cx.toFixed(2) + 'deg) rotateX(' + cy.toFixed(2) + 'deg)';
  }
  requestAnimationFrame(cardLoop);
  new IntersectionObserver((en) => { cardVisible = en[0].isIntersecting; }, { rootMargin: '80px' }).observe(card);

  /* ---------- self-rebuilding particle wordmark <-> logo (screensaver) ---------- */
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, visible = true;
  const P = [];                     // particles
  let shapeA = [], shapeB = [];     // target point lists: wordmark / logo
  let mode = 0, modeAt = 0, HOLD = 3600;
  const pokes = [];

  function sample(draw, step) {
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    draw(o);
    const img = o.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (img[((y | 0) * W + (x | 0)) * 4 + 3] > 128) pts.push([x + (Math.random() - 0.5) * step * 0.5, y + (Math.random() - 0.5) * step * 0.5]);
    }
    return pts;
  }
  function fitLine(o, text, font, maxW) {
    o.font = font(100); const w = o.measureText(text).width; return 100 * (maxW / w);
  }
  function build() {
    const step = Math.max(2.2, W / 105);
    const bold = (s) => '900 ' + s + 'px "Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
    const serif = (s) => 'italic 400 ' + s + 'px "Instrument Serif", Georgia, serif';
    shapeA = sample((o) => {
      const maxW = W * 0.9;
      let s1 = fitLine(o, 'mosaic', bold, maxW), s2 = fitLine(o, 'StudioS', serif, maxW);
      const cap = H * 0.44; s1 = Math.min(s1, cap); s2 = Math.min(s2, cap * 0.95);
      o.fillStyle = '#fff'; o.strokeStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'alphabetic';
      o.font = bold(s1); o.fillText('mosaic', W / 2, H * 0.5);
      o.font = serif(s2); o.fillText('StudioS', W / 2, H * 0.5 + s2 * 0.82);
      o.lineWidth = s2 * 0.03; o.strokeText('StudioS', W / 2, H * 0.5 + s2 * 0.82);
    }, step);
    shapeB = sample((o) => {
      const s = Math.min(W, H) * 0.78 / 32;
      o.translate((W - 32 * s) / 2, (H - 32 * s) / 2); o.scale(s, s);
      o.lineCap = 'square'; o.strokeStyle = '#fff'; o.fillStyle = '#fff';
      o.lineWidth = 2.6; o.stroke(new Path2D('M2 9V2h7M23 2h7v7M30 23v7h-7M9 30H2v-7'));
      o.lineWidth = 2.9; o.stroke(new Path2D('M10.5 23V15.5M10.5 18.2c0-4.4 6-4.4 6 0V23M16.5 18.2c0-4.4 6-4.4 6 0V23'));
      o.fillRect(23.6, 8, 3.6, 3.6);
    }, step);
    const N = Math.min(1700, Math.max(shapeA.length, shapeB.length));
    const fill = (a) => { const out = a.slice(); while (out.length < N) out.push(a[(Math.random() * a.length) | 0]); out.length = N; return out; };
    shapeA = fill(shapeA).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    shapeB = fill(shapeB).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    P.length = 0;
    for (let i = 0; i < N; i++) {
      const t = shapeA[i];
      P.push({ x: W / 2 + (Math.random() - 0.5) * W, y: H / 2 + (Math.random() - 0.5) * H, vx: 0, vy: 0, tx: t[0], ty: t[1], m: 0.8 + Math.random() * 0.7, hue: (t[0] / W) * 300 + 20, r: step * 0.36, sw: 0, ph: Math.random() * 6.28 });
    }
    mode = 0; modeAt = performance.now();
  }
  function resize() {
    DPR = Math.min(3, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(8, Math.round(r.width * DPR)); H = Math.max(8, Math.round(r.height * DPR));
    canvas.width = W; canvas.height = H;
    build();
  }
  function poke() { if (pointer) pokes.push({ x: pointer.x, y: pointer.y, age: 0 }); }

  // colour channel sprites (cheap drawImage, chromatic aberration by offsetting R / G / B)
  const BUCKETS = 90, CH = [[], [], []], SPR = [[], [], []];
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  for (let b = 0; b < BUCKETS; b++) {
    const [r, g, bl] = hsl((b / BUCKETS) * 360, 1, 0.58);
    CH[0].push('rgb(' + r + ',0,0)'); CH[1].push('rgb(0,' + g + ',0)'); CH[2].push('rgb(0,0,' + bl + ')');
  }
  for (let c = 0; c < 3; c++) for (let b = 0; b < BUCKETS; b++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16), col = CH[c][b];
    grad.addColorStop(0, col); grad.addColorStop(0.5, col); grad.addColorStop(1, col.replace('rgb(', 'rgba(').replace(')', ',0)'));
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); SPR[c].push(cv);
  }
  const bucket = (h) => (((Math.round(h / (360 / BUCKETS))) % BUCKETS) + BUCKETS) % BUCKETS;
  const spr = (c, b, x, y, r) => { const d = r * 2.4; ctx.drawImage(SPR[c][b], x - d / 2, y - d / 2, d, d); };

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || !W || !P.length) return;
    const dt = Math.min(48, now - last) / 16.67; last = now;
    const t = now / 1000;

    // screensaver: every HOLD ms, rebuild into the other shape as a staggered wave
    if (!REDUCED && now - modeAt > HOLD) {
      mode = 1 - mode; modeAt = now;
      const tgt = mode ? shapeB : shapeA;
      for (let i = 0; i < P.length; i++) { P[i].sw = now + (i / P.length) * 700 + Math.random() * 260; P[i].nt = tgt[i]; }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.96;
    for (let i = pokes.length - 1; i >= 0; i--) { pokes[i].age += dt * 0.03; if (pokes[i].age > 1) pokes.splice(i, 1); }

    const R = Math.min(W, H) * 0.34, damp = Math.pow(0.84, dt);
    const px0 = pointer ? pointer.x : -1e9, py0 = pointer ? pointer.y : -1e9;
    const sp = Math.hypot(pvx, pvy);
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      if (q.nt && now >= q.sw) {              // this particle's turn to rebuild: kick it, then re-aim
        q.tx = q.nt[0]; q.ty = q.nt[1]; q.nt = null;
        const a = Math.random() * 6.283, k = (2 + Math.random() * 5) * DPR;
        q.vx += Math.cos(a) * k; q.vy += Math.sin(a) * k;
      }
      // spring toward target with per-particle mass (underdamped => overshoot & settle)
      const k = 0.075 / q.m;
      q.vx += (q.tx - q.x) * k * dt; q.vy += (q.ty - q.y) * k * dt;
      // gentle idle shimmer so a settled shape still breathes
      q.vx += Math.cos(t * 1.7 + q.ph) * 0.02 * DPR * dt; q.vy += Math.sin(t * 1.3 + q.ph) * 0.02 * DPR * dt;
      if (pointer) {                          // repel with quadratic falloff, plus flick from pointer velocity
        const dx = q.x - px0, dy = q.y - py0, d = Math.hypot(dx, dy);
        if (d < R) {
          const w = 1 - d / R, f = w * w * 3.6 * DPR * dt / q.m;
          q.vx += (dx / (d || 1)) * f + pvx * w * 0.06; q.vy += (dy / (d || 1)) * f + pvy * w * 0.06;
          q.vx += (-dy / (d || 1)) * w * 0.5 * dt; q.vy += (dx / (d || 1)) * w * 0.5 * dt;   // slight swirl
        }
      }
      for (let r = 0; r < pokes.length; r++) {  // shockwave from a tap
        const pk = pokes[r], dx = q.x - pk.x, dy = q.y - pk.y, d = Math.hypot(dx, dy) || 1, front = pk.age * Math.max(W, H) * 0.9;
        const w = Math.exp(-Math.pow((d - front) / (R * 0.45), 2)) * (1 - pk.age) * 2.2 * DPR * dt;
        q.vx += (dx / d) * w; q.vy += (dy / d) * w;
      }
      q.vx *= damp; q.vy *= damp;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < 0) { q.x = 0; q.vx *= -0.5; } else if (q.x > W) { q.x = W; q.vx *= -0.5; }
      if (q.y < 0) { q.y = 0; q.vy *= -0.5; } else if (q.y > H) { q.y = H; q.vy *= -0.5; }
      const away = Math.hypot(q.x - q.tx, q.y - q.ty), speed = Math.abs(q.vx) + Math.abs(q.vy);
      const disp = (0.7 + Math.min(7, away * 0.1 + speed * 0.5)) * DPR;
      const bi = bucket(q.hue + t * 22 + HUES[edition] * 0.4);
      const rad = q.r * (1 + Math.min(0.9, speed * 0.05));
      spr(0, bi, q.x - disp, q.y, rad); spr(1, bi, q.x, q.y, rad); spr(2, bi, q.x + disp, q.y, rad);
    }
    ctx.globalAlpha = 1;
    pvx *= 0.8; pvy *= 0.8;
    void sp;
  }

  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
  let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(resize, 120); }).observe(canvas);
  (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 64px "Big Shoulders Display"'), document.fonts.load('italic 64px "Instrument Serif"')]).catch(() => {}) : Promise.resolve())
    .then(() => { resize(); requestAnimationFrame(frame); });
})();
