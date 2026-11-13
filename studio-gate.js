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
  const section = document.createElement('section');
  section.className = 'studio';
  section.id = 'studio';
  section.setAttribute('aria-labelledby', 'studio-h');
  section.innerHTML =
    '<div class="sechead"><h2 id="studio-h"><span class="mono sechead__no">S</span>mosaicStudios <em>grade your own photos</em></h2></div>' +
    '<div class="studio__stage">' +
      '<div class="studio__cardwrap">' +
        '<div class="mcard" id="mcard" tabindex="0" role="button" aria-label="Collectible mosaicStudios card. Tap to scan the next edition.">' +
          '<div class="mcard__in">' +
            '<div class="mcard__face">' +
              '<div class="mcard__metal"></div>' +
              '<div class="mcard__top"><span class="mcard__stage">BASIC</span><b class="mcard__name">mosaicStudios</b><span class="mcard__hp"><small>HP</small>140</span></div>' +
              '<div class="mcard__art"><div class="mcard__artbg"></div><div class="mcard__logo"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 9V2h7M23 2h7v7M30 23v7h-7M9 30H2v-7" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M10.5 23V15.5M10.5 18.2c0-4.4 6-4.4 6 0V23M16.5 18.2c0-4.4 6-4.4 6 0V23" fill="none" stroke="#ec2a1c" stroke-width="2.8" stroke-linecap="square"/><rect x="23.6" y="8" width="3.6" height="3.6" fill="#f6b62c"/></svg></div><div class="mcard__holo"></div><div class="mcard__glitter"></div></div>' +
              '<div class="mcard__strip"><span id="mc-ed">CHROME</span><span>6K GRADING WORKSTATION · 140 FILTERS</span></div>' +
              '<div class="mcard__moves">' +
                '<p><i>●</i><b>Grade</b><span>Filters, LUTs, masks &amp; curves</span><em>140</em></p>' +
                '<p><i>●●</i><b>Export 6K</b><span>Zero-loss, in your browser</span><em>6K</em></p>' +
              '</div>' +
              '<div class="mcard__foot"><span>No. <b id="mc-no">0007</b> / 2372</span><span>mosaicScope ©</span></div>' +
              '<div class="mcard__glare"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="studio__chips" role="group" aria-label="Choose edition"></div>' +
      '</div>' +
      '<canvas class="studio__canvas" id="studio-canvas" role="img" aria-label="The mosaicStudios wordmark made of chromatic dots. Poke it."></canvas>' +
      '<p class="mono studio__hint">Move over the card · tap it to scan the next edition · poke the letters</p>' +
    '</div>' +
    '<div class="studio__row">' +
      '<p class="studio__blurb">A 6K, GPU-powered photo and editorial grading workstation that runs right in your browser. 140 filters, LUTs, masks, curves. Passcode required.</p>' +
      '<button class="studio__btn" id="studio-open" type="button">' + MARK + '<span>Enter mosaicStudios</span></button>' +
      '<button class="studio__btn studio__btn--ghost" id="studio-scan" type="button"><span>Tap to scan · next edition</span></button>' +
    '</div>';
  foot.before(section);

  /* ------------------------------------------------------------- iPhone 2G */
  const dlg = document.createElement('dialog');
  dlg.className = 'ip2g';
  dlg.setAttribute('aria-label', 'mosaicStudios passcode');
  const keyDefs = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']];
  dlg.innerHTML =
    '<div class="ip" id="ip">' +
      '<span class="ip__cam"></span><span class="ip__speaker"></span>' +
      '<div class="ip__screen">' +
        '<div class="ip__wall"></div>' +
        '<div class="ip__status"><span>MosaicScope</span><span id="ip-clock">9:41 AM</span><span class="ip__bat"></span></div>' +
        '<div class="ip__view" id="ip-lock">' +
          '<div class="ip__time" id="ip-time">9:41</div><div class="ip__date" id="ip-date"></div><div class="ip__tag">mosaicStudios</div>' +
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
  document.getElementById('studio-open').addEventListener('click', openLock);

  /* ---------------------------------------------- collectible holo card */
  const card = document.getElementById('mcard');
  const cardIn = card.querySelector('.mcard__in');
  const VARIANTS = [
    { name: 'Chrome',   c1: '#f4f6fa', c2: '#8b93a3', c3: '#2a2e38', holo: 0.55, pat: 'dots',  hue: 0 },
    { name: 'Prism',    c1: '#2b2142', c2: '#0e0b1a', c3: '#4b2f7a', holo: 1,    pat: 'grid',  hue: 40 },
    { name: 'Gold',     c1: '#fff1b8', c2: '#d99a1e', c3: '#6b4208', holo: 0.5,  pat: 'lines', hue: 20 },
    { name: 'Obsidian', c1: '#3a3330', c2: '#0e0b0a', c3: '#ec2a1c', holo: 0.7,  pat: 'dots',  hue: 330 },
    { name: 'Acid',     c1: '#f3ffd0', c2: '#c6ff3d', c3: '#17210a', holo: 0.6,  pat: 'grid',  hue: 90 },
    { name: 'Pearl',    c1: '#fff5f8', c2: '#e7b8d4', c3: '#6c5b9a', holo: 0.8,  pat: 'lines', hue: 280 }
  ];
  const chipsEl = section.querySelector('.studio__chips');
  let vIdx = 0, serial = 7;
  VARIANTS.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'studio__chip'; b.setAttribute('aria-label', v.name + ' edition');
    b.style.setProperty('--a', v.c1); b.style.setProperty('--b', v.c2);
    b.addEventListener('click', () => setVariant(i, true));
    chipsEl.append(b);
  });
  function setVariant(i, scan) {
    vIdx = (i + VARIANTS.length) % VARIANTS.length;
    const v = VARIANTS[vIdx];
    serial = 1 + Math.floor(Math.random() * 2371);
    card.style.setProperty('--c1', v.c1); card.style.setProperty('--c2', v.c2); card.style.setProperty('--c3', v.c3);
    card.style.setProperty('--holo', v.holo); card.style.setProperty('--hue', v.hue + 'deg');
    card.dataset.pat = v.pat;
    card.dataset.tone = vIdx === 1 || vIdx === 3 ? 'dark' : 'light';
    document.getElementById('mc-ed').textContent = v.name.toUpperCase();
    document.getElementById('mc-no').textContent = String(serial).padStart(4, '0');
    [...chipsEl.children].forEach((c, k) => c.classList.toggle('is-on', k === vIdx));
    if (scan) {
      card.classList.remove('is-scan'); void card.offsetWidth; card.classList.add('is-scan');
      if (navigator.vibrate) navigator.vibrate(18);
    }
  }
  setVariant(0, false);

  // Pointer-driven tilt, with a slow idle drift so it always glints
  let tx = 0, ty = 0, cx = 0, cy = 0, hovering = false, cardDown = null;
  const setLight = (px, py) => { card.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--my', (py * 100).toFixed(1) + '%'); };
  function onMove(e) {
    const r = card.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    tx = (px - 0.5) * 20; ty = -(py - 0.5) * 20; setLight(px, py); hovering = true;
    if (cardDown && Math.hypot(e.clientX - cardDown.x, e.clientY - cardDown.y) > 6) cardDown.moved = true;
  }
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerenter', (e) => { hovering = true; onMove(e); });
  card.addEventListener('pointerleave', () => { hovering = false; cardDown = null; });
  card.addEventListener('pointerdown', (e) => { cardDown = { x: e.clientX, y: e.clientY, moved: false }; onMove(e); });
  card.addEventListener('pointerup', () => { if (cardDown && !cardDown.moved) setVariant(vIdx + 1, true); cardDown = null; });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVariant(vIdx + 1, true); }
    else if (e.key === 'ArrowRight') setVariant(vIdx + 1, true);
    else if (e.key === 'ArrowLeft') setVariant(vIdx - 1, true);
  });
  document.getElementById('studio-scan').addEventListener('click', () => setVariant(vIdx + 1, true));

  let cardVisible = true;
  function cardLoop(now) {
    requestAnimationFrame(cardLoop);
    if (!cardVisible || document.hidden) return;
    if (!hovering && !REDUCED) {
      const t = now / 1000;
      tx = Math.sin(t * 0.8) * 6; ty = Math.cos(t * 0.6) * 4;
      setLight(0.5 + Math.sin(t * 0.8) * 0.35, 0.5 + Math.cos(t * 0.6) * 0.35);
    }
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    cardIn.style.transform = 'rotateY(' + cx.toFixed(2) + 'deg) rotateX(' + cy.toFixed(2) + 'deg)';
  }
  requestAnimationFrame(cardLoop);
  new IntersectionObserver((en) => { cardVisible = en[0].isIntersecting; }, { rootMargin: '80px' }).observe(card);

  /* ------------------------------------- chromatic dot-matrix wordmark */
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, visible = true, pointer = null;
  const textDots = [];
  const ripples = [];

  function buildText() {
    textDots.length = 0;
    const off = document.createElement('canvas');
    off.width = Math.round(W); off.height = Math.round(H);
    const o = off.getContext('2d', { willReadFrequently: true });
    const size = Math.min(W * 0.2, H * 0.62);
    const bold = '900 ' + size + 'px "Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
    const serif = 'italic 400 ' + size * 0.95 + 'px "Instrument Serif", Georgia, serif';
    o.font = bold; const w1 = o.measureText('mosaic').width;
    o.font = serif; const w2 = o.measureText('Studios').width;
    const total = w1 + size * 0.18 + w2;
    const scale = Math.min(1, (W * 0.92) / total);
    const x0 = (W - total * scale) / 2, base = H * 0.78;
    o.save(); o.translate(x0, 0); o.scale(scale, scale);
    o.fillStyle = '#fff'; o.strokeStyle = '#fff';
    o.font = bold; o.fillText('mosaic', 0, base / scale);
    o.font = serif; o.fillText('Studios', w1 + size * 0.18, base / scale);
    o.lineWidth = size * 0.03; o.strokeText('Studios', w1 + size * 0.18, base / scale);
    o.restore();
    const step = Math.max(3.2, Math.round(W / 190));
    const img = o.getImageData(0, 0, off.width, off.height).data;
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) {
      if (img[((y | 0) * off.width + (x | 0)) * 4 + 3] > 128) {
        textDots.push({ hx: x, hy: y, x: x + (Math.random() - 0.5) * W * 0.3, y: y + (Math.random() - 0.5) * H * 0.5, vx: 0, vy: 0, hue: (x / off.width) * 300 + 10, r: step * 0.34 });
      }
    }
  }
  function resize() {
    DPR = Math.min(3, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * DPR)); H = Math.max(1, Math.round(r.height * DPR));
    canvas.width = W; canvas.height = H;
    buildText();
  }

  // pre-built channel sprites per hue bucket (cheap drawImage instead of thousands of path fills)
  const BUCKETS = 90, CH = [[], [], []], SPR = [[], [], []];
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  for (let b = 0; b < BUCKETS; b++) {
    const [r, g, bl] = hsl((b / BUCKETS) * 360, 0.95, 0.6);
    CH[0].push('rgb(' + r + ',0,0)'); CH[1].push('rgb(0,' + g + ',0)'); CH[2].push('rgb(0,0,' + bl + ')');
  }
  for (let c = 0; c < 3; c++) for (let b = 0; b < BUCKETS; b++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16), col = CH[c][b];
    grad.addColorStop(0, col); grad.addColorStop(0.55, col); grad.addColorStop(1, col.replace('rgb(', 'rgba(').replace(')', ',0)'));
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); SPR[c].push(cv);
  }
  const bucket = (h) => (((Math.round(h / (360 / BUCKETS))) % BUCKETS) + BUCKETS) % BUCKETS;
  const spr = (c, b, x, y, r) => { const d = r * 2.4; ctx.drawImage(SPR[c][b], x - d / 2, y - d / 2, d, d); };

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || !W) return;
    const dt = Math.min(48, now - last) / 16.67; last = now;
    const t = now / 1000;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt * 0.022; if (ripples[i].age > 1) ripples.splice(i, 1); }
    const R = Math.min(W, H) * 0.34;
    const px0 = pointer ? pointer.x : -1e9, py0 = pointer ? pointer.y : -1e9;
    ctx.globalAlpha = 0.95;
    for (let i = 0; i < textDots.length; i++) {
      const q = textDots[i];
      q.vx += (q.hx - q.x) * 0.045 * dt; q.vy += (q.hy - q.y) * 0.045 * dt;
      if (pointer) {
        const dx = q.x - px0, dy = q.y - py0, dist = Math.hypot(dx, dy);
        if (dist < R) { const f = (1 - dist / R) * 2.4 * dt; q.vx += (dx / (dist || 1)) * f; q.vy += (dy / (dist || 1)) * f; }
      }
      for (let r = 0; r < ripples.length; r++) {
        const rp = ripples[r], dx = q.x - rp.x, dy = q.y - rp.y, dist = Math.hypot(dx, dy) || 1, front = rp.age * Math.max(W, H) * 0.9;
        const w = Math.exp(-Math.pow((dist - front) / (R * 0.5), 2)) * (1 - rp.age);
        q.vx += (dx / dist) * w * 1.6 * dt; q.vy += (dy / dist) * w * 1.6 * dt;
      }
      q.vx *= 0.86; q.vy *= 0.86; q.x += q.vx * dt; q.y += q.vy * dt;
      const away = Math.hypot(q.x - q.hx, q.y - q.hy);
      const disp = (0.9 + Math.min(10, away * 0.18)) * DPR;
      const bi = bucket(q.hue + t * 18), rad = q.r * (1 + Math.min(1, away / (R * 0.8)) * 0.5);
      spr(0, bi, q.x - disp, q.y, rad); spr(1, bi, q.x, q.y, rad); spr(2, bi, q.x + disp, q.y, rad);
    }
    ctx.globalAlpha = 1;
  }
  const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  canvas.addEventListener('pointermove', (e) => { pointer = toCanvas(e); });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  canvas.addEventListener('pointerdown', (e) => { pointer = toCanvas(e); ripples.push({ x: pointer.x, y: pointer.y, age: 0 }); });

  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
  let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(resize, 120); }).observe(canvas);
  (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 64px "Big Shoulders Display"'), document.fonts.load('italic 64px "Instrument Serif"')]).catch(() => {}) : Promise.resolve())
    .then(() => { resize(); requestAnimationFrame(frame); });
})();
