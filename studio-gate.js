/* mosaicStudioS entry: physics dot sign that opens an iPhone 17 Pro Max lock when clicked.
   2372 opens the studio, 0000 the follow-me easter egg. The codes are a playful gate, not security. */
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
  section.className = 'studio-band';
  section.id = 'studio';
  section.innerHTML = '<canvas id="studio-canvas" class="studio-band__canvas" tabindex="0" role="button" aria-label="mosaicStudioS. Tap to enter."></canvas>';
  foot.before(section);

  /* ------------------------------------------------------------- iPhone 17 Pro Max */
  // Two passcodes: 2372 opens mosaicStudioS, 0000 turns the phone into the follow-me easter egg.
  const CODES = {
    'eb3d9dac46073924cffbc322aeac56e17b3c33c8005b591d3209e26e14af625b': 'studio',
    '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0': 'egg'
  };
  const PLAIN = { '2372': 'studio', '0000': 'egg' };     // only used where crypto.subtle is unavailable
  const IG = 'https://www.instagram.com/mosaicscope/';
  const YT = 'https://www.youtube.com/@mosaicscope';
  const TH = 'https://www.threads.net/@mosaicscope';
  const SC = 'https://soundcloud.com/orqrackcity/sets/mosaicscope';
  const MAIL = 'mailto:mosiacscope@gmail.com?subject=' + encodeURIComponent('Shoot enquiry') + '&body=' + encodeURIComponent('Hi Chris,\n\n');

  const dlg = document.createElement('dialog');
  dlg.className = 'ip2g';
  dlg.setAttribute('aria-label', 'mosaicStudioS passcode');
  const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']];
  const STATUS = '<div class="ip__status"><span class="ip__clock" data-clock>9:41</span>' +
    '<span class="ip__sys"><svg class="ip__sig" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="0.8"/><rect x="5" y="5.5" width="3" height="6.5" rx="0.8"/><rect x="10" y="3" width="3" height="9" rx="0.8"/><rect x="15" y="0" width="3" height="12" rx="0.8"/></svg>' +
    '<svg class="ip__wifi" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.2 5.9 9a3 3 0 0 1 4.2 0zM3.6 6.6a6.3 6.3 0 0 1 8.8 0l-1.3 1.4a4.4 4.4 0 0 0-6.2 0zM1 3.9a10 10 0 0 1 14 0l-1.3 1.4a8.2 8.2 0 0 0-11.4 0z"/></svg>' +
    '<span class="ip__bat"><i></i></span></span></div>';
  dlg.innerHTML =
    '<div class="ip" id="ip">' +
      '<span class="ip__btn ip__btn--a"></span><span class="ip__btn ip__btn--v1"></span><span class="ip__btn ip__btn--v2"></span><span class="ip__btn ip__btn--p"></span>' +
      '<div class="ip__bezel"><div class="ip__screen">' +
        '<div class="ip__wall"></div>' + STATUS + '<span class="ip__island"><i></i></span>' +
        '<div class="ip__view ip__lockv" id="ip-lock">' +
          '<div class="ip__date" id="ip-date"></div><div class="ip__time" id="ip-time">9:41</div>' +
          '<div class="ip__shortcuts"><span class="ip__sc"><svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM11 14h2v7h-2z"/></svg></span><span class="ip__sc"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17.2a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z"/></svg></span></div>' +
          '<button class="ip__swipe" id="ip-swipe" type="button" aria-label="Swipe up to unlock"><span>Swipe up to unlock</span><i></i></button>' +
        '</div>' +
        '<div class="ip__view ip__pass" id="ip-pass" hidden>' +
          '<div class="ip__ptitle">Enter Passcode</div>' +
          '<div class="ip__pdots" id="ip-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
          '<div class="ip__keys" id="ip-keys"></div>' +
          '<div class="ip__msg" id="ip-msg" role="status" aria-live="polite"></div>' +
        '</div>' +
        '<div class="ip__view ip__egg" id="ip-egg" hidden>' +
          '<div class="ip__arena" id="ip-arena"></div>' +
          '<div class="ip__handle">@mosaicscope</div>' +
          '<div class="ip__score" id="ip-score">♥ 0</div>' +
          '<button class="ip__follow" id="ip-follow" type="button">Follow</button>' +
          '<div class="ip__dock" id="ip-dock"></div>' +
        '</div>' +
        '<div class="ip__ok"></div>' +
                '<div class="ip__gloss"></div>' +
      '</div></div>' +
      '<button class="ip__bar" id="ip-bar" type="button" aria-label="Close"></button>' +
      '<p class="ip__cap" id="ip-cap">iPhone 17 Pro Max</p>' +
    '</div>';
  document.body.append(dlg);

  const $ = (id) => dlg.querySelector('#' + id);
  const ip = $('ip'), lockV = $('ip-lock'), passV = $('ip-pass'), eggV = $('ip-egg');
  const dotsEl = $('ip-dots'), msg = $('ip-msg'), keysEl = $('ip-keys');
  let code = '', busy = false;

  // iOS passcode pad: round translucent keys, number + letters, Cancel/Delete bottom right
  KEYS.forEach(([n, l]) => addKey(n, l));
  const blank = document.createElement('span'); blank.className = 'ip__key ip__key--blank'; keysEl.append(blank);
  addKey('0', '');
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'ip__key ip__key--text'; del.id = 'ip-del'; del.textContent = 'Cancel';
  del.addEventListener('click', () => press(code.length ? '⌫' : 'Cancel'));
  keysEl.append(del);
  function addKey(label, letters) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ip__key';
    b.innerHTML = '<b>' + label + '</b><small>' + letters + '</small>';
    b.addEventListener('click', () => press(label));
    keysEl.append(b);
  }

  function tick() {
    const d = new Date();
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');
    $('ip-time').textContent = t;
    dlg.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = t; });
    $('ip-date').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function paintDots() {
    [...dotsEl.children].forEach((el, i) => el.classList.toggle('is-on', i < code.length));
    del.textContent = code.length ? 'Delete' : 'Cancel';
  }
  async function sha(text) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function check() {
    busy = true;
    const h = await sha(code);
    const result = h ? CODES[h] : PLAIN[code];
    if (result === 'studio') {
      ip.classList.add('is-ok');
      setTimeout(() => location.assign(TARGET), REDUCED ? 100 : 650);
      return;
    }
    if (result === 'egg') {
      ip.classList.add('is-ok');
      setTimeout(() => { startEgg(); ip.classList.remove('is-ok'); busy = false; }, REDUCED ? 100 : 500);
      return;
    }
    msg.textContent = 'Try Again';
    dotsEl.classList.remove('is-bad'); void dotsEl.offsetWidth; dotsEl.classList.add('is-bad');
    if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { /* needs a tap first */ }
    setTimeout(() => { code = ''; paintDots(); busy = false; }, 500);
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

  /* ---- 0000: the follow-me easter egg ---- */
  const eggApps = [
    { l: 'Instagram', bg: 'linear-gradient(135deg,#feda75,#fa7e1e 30%,#d62976 60%,#4f5bd5)', url: IG, svg: '<rect x="6" y="6" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="16" cy="16" r="4.6" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="22" cy="10" r="1.5" fill="#fff"/>' },
    { l: 'Threads', bg: '#111', url: TH, svg: '<text x="16" y="23" text-anchor="middle" font-size="21" font-weight="700" fill="#fff" font-family="Helvetica,Arial,sans-serif">@</text>' },
    { l: 'YouTube', bg: '#fff', url: YT, svg: '<rect x="3" y="8" width="26" height="16" rx="5" fill="#f00"/><path d="M13.5 12.2v7.6L20.5 16z" fill="#fff"/>' },
    { l: 'SoundCloud', bg: 'linear-gradient(#ff8a00,#ff4d00)', url: SC, svg: '<path d="M6 21v-4M10 22V14M14 22V11M18 22V9c5 0 8 2 8 6 0 4-2 7-6 7z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { l: 'Mail', bg: 'linear-gradient(#5fb3ff,#1a62d8)', url: MAIL, svg: '<rect x="4" y="8" width="24" height="16" rx="3" fill="#fff"/><path d="M5 10l11 8 11-8" fill="none" stroke="#1a62d8" stroke-width="2"/>' }
  ];
  const dockEl = $('ip-dock'), arena = $('ip-arena'), scoreEl = $('ip-score'), followBtn = $('ip-follow');
  eggApps.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ip__app'; b.setAttribute('aria-label', a.l);
    b.innerHTML = '<span class="ip__icon" style="background:' + a.bg + '"><svg viewBox="0 0 32 32" aria-hidden="true">' + a.svg + '</svg></span>';
    b.addEventListener('click', () => { b.classList.add('is-launch'); setTimeout(() => { b.classList.remove('is-launch'); if (a.url.startsWith('mailto')) location.href = a.url; else window.open(a.url, '_blank', 'noopener'); }, REDUCED ? 0 : 240); });
    dockEl.append(b);
  });
  followBtn.addEventListener('click', () => window.open(IG, '_blank', 'noopener'));

  let eggTimer = 0, pops = 0;
  function startEgg() {
    passV.hidden = true; lockV.hidden = true; eggV.hidden = false;
    arena.textContent = ''; pops = 0; scoreEl.textContent = '♥ 0'; followBtn.classList.remove('is-hot');
    clearInterval(eggTimer);
    spawn(); spawn();
    eggTimer = setInterval(() => { if (dlg.open && !eggV.hidden && arena.children.length < 9) spawn(); }, 900);
  }
  function spawn() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ip__bub'; b.setAttribute('aria-label', 'Pop');
    const s = 2.2 + Math.random() * 1.6;
    b.style.cssText = 'left:' + (4 + Math.random() * 72) + '%;width:' + s + 'em;height:' + s + 'em;animation-duration:' + (5 + Math.random() * 4) + 's';
    b.innerHTML = '<span>' + (Math.random() < 0.5 ? '@' : '♥') + '</span>';
    b.addEventListener('animationend', () => b.remove());
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = b.getBoundingClientRect(), ar = arena.getBoundingClientRect();
      burst(r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2);
      b.remove(); pops++; scoreEl.textContent = '♥ ' + pops;
      if (pops >= 5) followBtn.classList.add('is-hot');
      if (navigator.vibrate) try { navigator.vibrate(10); } catch (err) { /* ignore */ }
    });
    arena.append(b);
  }
  function burst(x, y) {
    for (let i = 0; i < 9; i++) {
      const p = document.createElement('i'); p.className = 'ip__pop';
      const a = (i / 9) * 6.283, d = 1.6 + Math.random() * 1.6;
      p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(a) * d + 'em;--dy:' + Math.sin(a) * d + 'em;--h:' + Math.floor(Math.random() * 360);
      p.addEventListener('animationend', () => p.remove());
      arena.append(p);
    }
  }

  /* ---- unlocking: swipe up on the lock screen ---- */
  function showPass() {
    if (!passV.hidden) return;
    lockV.classList.add('ip__view--out');
    setTimeout(() => { lockV.hidden = true; passV.hidden = false; }, 220);
  }
  let sy = null;
  lockV.addEventListener('pointerdown', (e) => { sy = e.clientY; });
  lockV.addEventListener('pointermove', (e) => { if (sy !== null && sy - e.clientY > 40) { sy = null; showPass(); } });
  lockV.addEventListener('pointerup', () => { sy = null; });
  $('ip-swipe').addEventListener('click', showPass);

  $('ip-bar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (passV.hidden) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('⌫');
  });
  let opener = null;
  function openLock() {
    opener = document.activeElement;
    document.documentElement.classList.remove('has-lens');
    code = ''; busy = false; paintDots(); msg.textContent = '';
    ip.classList.remove('is-ok');
    clearInterval(eggTimer); eggV.hidden = true; arena.textContent = '';
    lockV.hidden = false; lockV.classList.remove('ip__view--out');
    passV.hidden = true;
    tick();
    if (!dlg.open) dlg.showModal();
    $('ip-swipe').focus({ preventScroll: true });
  }
  dlg.addEventListener('close', () => { clearInterval(eggTimer); if (opener && opener.focus) opener.focus({ preventScroll: true }); });
  setInterval(() => { if (dlg.open) tick(); }, 15000);

  /* ===================================================================
     Full-width stage: the mosaicStudioS wordmark rebuilds itself into the logo,
     and the Mosaics climb up to mess with it. Everything is physics: springs, gravity, collisions.
     =================================================================== */
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, visible = true;
  const P = [];                                   // letter particles
  let shapes = {}, seq = ['A'], si = 0, cur = 'A', modeAt = 0, HOLD = 3800;
  const pokes = [];
  let pointer = null, pvx = 0, pvy = 0, held = false, hold0 = 0, moved = false, downAt = 0;

  /* ---------- shape sampling ---------- */
  function sample(draw, step) {
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    draw(o);
    const img = o.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (img[((y | 0) * W + (x | 0)) * 4 + 3] > 128) pts.push([x + (Math.random() - 0.5) * step * 0.4, y + (Math.random() - 0.5) * step * 0.4]);
    }
    return pts;
  }
  const fitLine = (o, text, font, maxW) => { o.font = font(100); return 100 * (maxW / o.measureText(text).width); };
  function makeSeq() { return ['B', 'A']; }   // wordmark -> logo -> wordmark, forever
  function build() {
    const step = Math.max(2.4, Math.sqrt((W * H) * 0.3 / 4200));
    const bold = (s) => '900 ' + s + 'px "Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
    const serif = (s) => 'italic 400 ' + s + 'px "Instrument Serif", Georgia, serif';
    const raw = {};
    raw.A = sample((o) => {
      o.fillStyle = '#fff'; o.strokeStyle = '#fff'; o.textAlign = 'left'; o.textBaseline = 'alphabetic';
      if (W / H > 2.6) {                         // wide stage: one line, fills the black space
        const gap = 0.16, w1 = fitLine(o, 'mosaic', bold, 100), w2 = fitLine(o, 'StudioS', serif, 100);
        // size so that both words plus a gap span 94% of the width and at most 78% of the height
        o.font = bold(100); const m1 = o.measureText('mosaic').width; o.font = serif(100); const m2 = o.measureText('StudioS').width;
        void w1; void w2;
        let size = 100 * (W * 0.94) / (m1 + m2 * 0.95 + 100 * gap); size = Math.min(size, H * 0.9);
        const total = (m1 + m2 * 0.95 + 100 * gap) * size / 100, x0 = (W - total) / 2, base = H * 0.5 + size * 0.34;
        o.font = bold(size); o.fillText('mosaic', x0, base);
        const x2 = x0 + (m1 + 100 * gap) * size / 100;
        o.font = serif(size * 0.95); o.fillText('StudioS', x2, base);
        o.lineWidth = size * 0.03; o.strokeText('StudioS', x2, base);
      } else {                                   // narrow screens: two stacked lines
        o.textAlign = 'center';
        const maxW = W * 0.9, cap = H * 0.44;
        const s1 = Math.min(fitLine(o, 'mosaic', bold, maxW), cap), s2 = Math.min(fitLine(o, 'StudioS', serif, maxW), cap * 0.95);
        o.font = bold(s1); o.fillText('mosaic', W / 2, H * 0.5);
        o.font = serif(s2); o.fillText('StudioS', W / 2, H * 0.5 + s2 * 0.82);
        o.lineWidth = s2 * 0.03; o.strokeText('StudioS', W / 2, H * 0.5 + s2 * 0.82);
      }
    }, step);
    raw.B = sample((o) => {
      const s = Math.min(W, H) * 0.8 / 32;
      o.translate((W - 32 * s) / 2, (H - 32 * s) / 2); o.scale(s, s);
      o.lineCap = 'square'; o.strokeStyle = '#fff'; o.fillStyle = '#fff';
      o.lineWidth = 2.6; o.stroke(new Path2D('M2 9V2h7M23 2h7v7M30 23v7h-7M9 30H2v-7'));
      o.lineWidth = 2.9; o.stroke(new Path2D('M10.5 23V15.5M10.5 18.2c0-4.4 6-4.4 6 0V23M16.5 18.2c0-4.4 6-4.4 6 0V23'));
      o.fillRect(23.6, 8, 3.6, 3.6);
    }, step);
    if (Object.values(raw).some((a) => !a.length)) return;
    const N = Math.min(4500, Math.max(...Object.values(raw).map((a) => a.length)));
    const fill = (a) => { const out = a.slice(); while (out.length < N) out.push(a[(Math.random() * a.length) | 0]); out.length = N; return out.sort((p, q) => p[0] - q[0] || p[1] - q[1]); };
    shapes = {}; Object.keys(raw).forEach((k) => { shapes[k] = fill(raw[k]); });
    P.length = 0;
    for (let i = 0; i < N; i++) {
      const t = shapes.A[i];
      P.push({ x: W / 2 + (Math.random() - 0.5) * W, y: H / 2 + (Math.random() - 0.5) * H, vx: 0, vy: 0, tx: t[0], ty: t[1], m: 0.8 + Math.random() * 0.7, hue: (t[0] / W) * 300 + 20, r: step * 0.36, sw: 0, ph: Math.random() * 6.28 });
    }
    cur = 'A'; seq = ['A']; si = 0; modeAt = performance.now(); HOLD = 4200;
    buildSignCols();
  }
  function resize() {
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(8, Math.round(r.width * DPR)); H = Math.max(8, Math.round(r.height * DPR));
    canvas.width = W; canvas.height = H;
    build();
  }

  /* ---------- crisp lit dots (no blur, no additive glow) ----------
     Each dot is a hard-edged sphere sprite (one per hue), lit by a moving light:
     a sharp contact shadow thrown away from the light and a sharp specular glint toward it. */
  const BUCKETS = 72, BODY = [];
  const mk = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; };
  for (let b = 0; b < BUCKETS; b++) {
    BODY.push(mk(64, (g, s) => {
      const h = (b / BUCKETS) * 360;
      const grad = g.createRadialGradient(s * 0.36, s * 0.34, s * 0.04, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'hsl(' + h + ',95%,76%)'); grad.addColorStop(0.55, 'hsl(' + h + ',92%,56%)'); grad.addColorStop(1, 'hsl(' + h + ',90%,34%)');
      g.fillStyle = grad; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0.2, 1.5); g.stroke();   // fresnel rim catch-light
    }));
  }
  const SHADOW = mk(64, (g, s) => { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 6.2832); g.fill(); });
  const GLINT = mk(32, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 6.2832); g.fill(); });
  const bucket = (h) => (((Math.round(h / (360 / BUCKETS))) % BUCKETS) + BUCKETS) % BUCKETS;

  /* ---------- the Mosaics reach the sign: climbers fire 'mosaic-sign' with a screen position ---------- */
  document.addEventListener('mosaic-sign', (e) => {
    if (!W || !P.length) return;
    const d = e.detail || {}, r = canvas.getBoundingClientRect();
    if (d.clientY < r.top - 40 || d.clientY > r.bottom + 40) return;
    const cx = (d.clientX - r.left) * (W / r.width), cy = (d.clientY - r.top) * (H / r.height), rad = (d.radius || 46) * DPR, now = performance.now();
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dx = q.x - cx, dy = q.y - cy, dist = Math.hypot(dx, dy);
      if (dist < rad) {                                  // knocked loose: falls, bounces, then the sign pulls itself back together
        q.loose = now + rand(2400, 4600);
        const w = 1 - dist / rad;
        q.vx += (dx / (dist || 1)) * w * 5 * DPR + rand(-1.5, 1.5) * DPR; q.vy += (dy / (dist || 1)) * w * 5 * DPR - rand(0, 3) * DPR;
      }
    }
  });
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- main loop ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || !W || !P.length) return;
    const dt = Math.min(48, now - last) / 16.67; last = now;
    const t = now / 1000;

    if (!REDUCED && !holdWord && now - modeAt > HOLD) {                // screensaver: wordmark <-> logo, rebuilt as a staggered wave
      si++; if (si >= seq.length) { seq = makeSeq(); si = 0; }
      cur = seq[si]; modeAt = now; HOLD = 4200;
      const tgt = shapes[cur];
      for (let i = 0; i < P.length; i++) { P[i].sw = now + (i / P.length) * 900 + Math.random() * 300; P[i].nt = tgt[i]; }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (let i = pokes.length - 1; i >= 0; i--) { pokes[i].age += dt * 0.025; if (pokes[i].age > 1) pokes.splice(i, 1); }

    const R = Math.min(W, H) * 0.42, damp = Math.pow(0.85, dt);
    const px0 = pointer ? pointer.x : -1e9, py0 = pointer ? pointer.y : -1e9;
    const lx = pointer ? pointer.x : W * (0.5 + Math.cos(t * 0.4) * 0.45), ly = pointer ? pointer.y : H * (0.5 + Math.sin(t * 0.55) * 0.4);
    const G = 0.42 * DPR;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      if (q.nt && now >= q.sw) {
        q.tx = q.nt[0]; q.ty = q.nt[1]; q.nt = null;
        const a = Math.random() * 6.283, k = (2 + Math.random() * 6) * DPR;
        q.vx += Math.cos(a) * k; q.vy += Math.sin(a) * k;
      }
      const loose = q.loose && now < q.loose;
      if (loose) {                                        // rubble: gravity, floor and wall collisions, friction
        q.vy += G * dt;
      } else {
        const k = 0.075 / q.m;
        q.vx += (q.tx - q.x) * k * dt; q.vy += (q.ty - q.y) * k * dt;
        q.vx += Math.cos(t * 1.7 + q.ph) * 0.02 * DPR * dt; q.vy += Math.sin(t * 1.3 + q.ph) * 0.02 * DPR * dt;
      }
      if (pointer) {                                      // cursor: repel with quadratic falloff, flick, slight swirl
        const dx = q.x - px0, dy = q.y - py0, d = Math.hypot(dx, dy);
        if (d < R) {
          const w = 1 - d / R, f = w * w * 3.4 * DPR * dt / q.m;
          q.vx += (dx / (d || 1)) * f + pvx * w * 0.06; q.vy += (dy / (d || 1)) * f + pvy * w * 0.06;
          q.vx += (-dy / (d || 1)) * w * 0.5 * dt; q.vy += (dx / (d || 1)) * w * 0.5 * dt;
        }
      }
      for (let r = 0; r < pokes.length; r++) {
        const pk = pokes[r], dx = q.x - pk.x, dy = q.y - pk.y, d = Math.hypot(dx, dy) || 1, front = pk.age * Math.max(W, H) * 0.7;
        const w = Math.exp(-Math.pow((d - front) / (R * 0.4), 2)) * (1 - pk.age) * 2.2 * DPR * dt;
        q.vx += (dx / d) * w; q.vy += (dy / d) * w;
      }
      q.vx *= loose ? Math.pow(0.995, dt) : damp; q.vy *= loose ? Math.pow(0.995, dt) : damp;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < q.r) { q.x = q.r; q.vx *= -0.5; } else if (q.x > W - q.r) { q.x = W - q.r; q.vx *= -0.5; }
      if (q.y > H - q.r) { q.y = H - q.r; q.vy *= -0.45; if (loose) q.vx *= 0.86; } else if (q.y < q.r) { q.y = q.r; q.vy *= -0.5; }
    }

    // pass 1: sharp contact shadows (thrown away from the light)
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dx = q.x - lx, dy = q.y - ly, d = Math.hypot(dx, dy) || 1, dia = Math.max(3, Math.round(q.r * 2));
      ctx.drawImage(SHADOW, Math.round(q.x + dx / d * q.r * 0.55 - dia / 2), Math.round(q.y + dy / d * q.r * 0.55 - dia / 2), dia, dia);
    }
    // pass 2: the spheres
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dia = Math.max(3, Math.round(q.r * 2));
      ctx.drawImage(BODY[bucket(q.hue + t * 18)], Math.round(q.x - dia / 2), Math.round(q.y - dia / 2), dia, dia);
    }
    // pass 3: specular glints that track the light
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dx = lx - q.x, dy = ly - q.y, d = Math.hypot(dx, dy) || 1, g = Math.max(2, Math.round(q.r * 0.55));
      ctx.drawImage(GLINT, Math.round(q.x + dx / d * q.r * 0.38 - g / 2), Math.round(q.y + dy / d * q.r * 0.38 - g / 2), g, g);
    }
    pvx *= 0.8; pvy *= 0.8;
  }

  /* ---------- sign outline for the climbing Mosaics (real collision against the letters) ---------- */
  let holdWord = false, signCols = [];
  function buildSignCols() {
    if (!shapes.A) return;
    const bin = Math.max(3, Math.round(W / 220)), cols = new Map();
    for (const [x, y] of shapes.A) { const b = Math.floor(x / bin), t = cols.get(b); if (t === undefined || y < t) cols.set(b, y); }
    const keys = [...cols.keys()].sort((a, b) => a - b), blocks = [];
    let run = null;
    for (const k of keys) {
      const top = cols.get(k);
      if (run && k === run.k1 + 1 && Math.abs(top - run.top) < bin * 1.5) { run.k1 = k; run.top = Math.min(run.top, top); }
      else { run = { k0: k, k1: k, top }; blocks.push(run); }
    }
    signCols = blocks.map((b) => ({ x0: b.k0 * bin, x1: (b.k1 + 1) * bin, top: b.top }));
  }
  window.MosaicSign = {
    solids() {
      if (!signCols.length || !W) return [];
      const r = canvas.getBoundingClientRect(), sy = window.pageYOffset || 0, sx = r.width / W, sh = r.height / H;
      return signCols.map((b) => ({ l: r.left + b.x0 * sx, r: r.left + b.x1 * sx, top: r.top + sy + b.top * sh, bottom: r.bottom + sy, sign: true }));
    },
    band() { const r = canvas.getBoundingClientRect(), sy = window.pageYOffset || 0; return { l: r.left, r: r.right, top: r.top + sy, bottom: r.bottom + sy }; },
    hold(on) {
      holdWord = on;
      if (on && shapes.A && cur !== 'A') {
        cur = 'A'; seq = ['A']; si = 0; modeAt = performance.now(); HOLD = 4200;
        const now = performance.now();
        for (let i = 0; i < P.length; i++) { P[i].sw = now + Math.random() * 400; P[i].nt = shapes.A[i]; }
      }
    }
  };

  /* ---------- long jumps (like the Studio link at the very bottom) shouldn't take ages: one quick glide ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1), target = id && document.getElementById(id);
    if (!target) return;
    const from = window.pageYOffset, to = Math.max(0, target.getBoundingClientRect().top + from - 70);
    if (Math.abs(to - from) < window.innerHeight * 2.2) return;           // short hops keep the site's own smooth scroll
    e.preventDefault();
    if (REDUCED) { window.scrollTo(0, to); return; }
    const t0 = performance.now(), dur = 700, root = document.documentElement, prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, from + (to - from) * eased);
      if (k < 1) requestAnimationFrame(step); else { root.style.scrollBehavior = prev; history.replaceState(null, '', '#' + id); }
    };
    requestAnimationFrame(step);
  }, true);

  /* ---------- pointer: hover scatters, tap opens the iPhone ---------- */
  const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    if (pointer) { pvx = p.x - pointer.x; pvy = p.y - pointer.y; }
    pointer = p;
    if (held && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) moved = true;
  });
  canvas.addEventListener('pointerleave', () => { pointer = null; pvx = pvy = 0; });
  canvas.addEventListener('pointerdown', (e) => {
    pointer = toCanvas(e); held = true; moved = false; hold0 = performance.now(); downAt = { x: e.clientX, y: e.clientY };
    pokes.push({ x: pointer.x, y: pointer.y, age: 0 });
    canvas.setPointerCapture(e.pointerId);
  });
  const release = (e) => {
    if (!held) return;
    const quick = performance.now() - hold0 < 260;
    held = false;
    if (e.type === 'pointerup' && quick && !moved) openLock();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { held = false; });
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLock(); } });

  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
  let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(resize, 150); }).observe(canvas);
  (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 64px "Big Shoulders Display"'), document.fonts.load('italic 64px "Instrument Serif"')]).catch(() => {}) : Promise.resolve())
    .then(() => { resize(); requestAnimationFrame(frame); });
})();
