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
  const SC = 'https://soundcloud.com/orqc';
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
        '<div class="ip__view ip__sh" id="ip-sh" hidden>' +
          '<div class="ip__shgrid">' +
            '<button class="ip__app" id="ip-app-studio" type="button" aria-label="mosaicStudioS"><span class="ip__icon" style="background:linear-gradient(#5a5f6b,#14161b)"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M10.5 22v-7M10.5 17.5c0-4 5.5-4 5.5 0V22M16 17.5c0-4 5.5-4 5.5 0V22M22 8.5h3.4v3.4H22z" fill="none" stroke="#ec2a1c" stroke-width="2.4"/></svg></span><span class="ip__lbl">Studio</span></button>' +
            '<button class="ip__app" id="ip-app-set" type="button" aria-label="Settings"><span class="ip__icon" style="background:linear-gradient(#9aa0ab,#4b505b)"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></span><span class="ip__lbl">Settings</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="ip__view ip__set" id="ip-set" hidden>' +
          '<button class="ip__back" id="ip-back" type="button">‹ Home</button><div class="ip__stitle">Settings</div>' +
          '<div class="ip__grp"><label class="ip__row"><span>Crude words</span><span class="ip__sw"><input type="checkbox" id="ip-crude" /><i></i></span></label>' +
          '<p class="ip__note">The Mosaics occasionally say crude things. Off by default.</p></div>' +
          '<div class="ip__grp"><div class="ip__row ip__row--col"><span>SoundCloud (@orqc only)</span><input id="ip-sc" class="ip__in" type="url" inputmode="url" placeholder="https://soundcloud.com/orqc/…" autocomplete="off" spellcheck="false" />' +
          '<div class="ip__btns"><button type="button" id="ip-sc-save">Save</button><button type="button" id="ip-sc-reset">Reset</button></div><p class="ip__note" id="ip-sc-msg" role="status"></p></div></div>' +
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
      setTimeout(() => { showStudioHome(); ip.classList.remove('is-ok'); busy = false; }, REDUCED ? 100 : 600);
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

  /* ---- 2372: the Studio home screen + Settings ---- */
  const shV = $('ip-sh'), setV = $('ip-set'), crude = $('ip-crude'), scIn = $('ip-sc'), scMsg = $('ip-sc-msg');
  const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const fetchv = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  function showStudioHome() { passV.hidden = true; lockV.hidden = true; eggV.hidden = true; setV.hidden = true; shV.hidden = false; }
  $('ip-app-studio').addEventListener('click', () => { location.assign(TARGET); });
  $('ip-app-set').addEventListener('click', () => { shV.hidden = true; setV.hidden = false; crude.checked = fetchv('ms-crude') === '1'; scIn.value = fetchv('ms-sc') || ''; scMsg.textContent = ''; });
  $('ip-back').addEventListener('click', () => { setV.hidden = true; shV.hidden = false; });
  crude.addEventListener('change', () => store('ms-crude', crude.checked ? '1' : '0'));
  const okSC = (u) => /^https:\/\/(www\.)?soundcloud\.com\/orqc(\/|$|\?)/i.test(u);
  $('ip-sc-save').addEventListener('click', () => {
    const u = scIn.value.trim();
    if (!okSC(u)) { scMsg.textContent = 'Only @orqc SoundCloud links work (soundcloud.com/orqc/…).'; return; }
    store('ms-sc', u); scMsg.textContent = 'Saved. Reloading the player…'; setTimeout(() => location.reload(), 700);
  });
  $('ip-sc-reset').addEventListener('click', () => { store('ms-sc', null); scIn.value = ''; scMsg.textContent = 'Back to the default (soundcloud.com/orqc). Reloading…'; setTimeout(() => location.reload(), 700); });

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
    clearInterval(eggTimer); eggV.hidden = true; shV.hidden = true; setV.hidden = true; arena.textContent = '';
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
     Everything is physics: springs, gravity, collisions.
     =================================================================== */
  const canvas = document.getElementById('studio-canvas');
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
  }
  function resize() {
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(8, Math.round(r.width * DPR)); H = Math.max(8, Math.round(r.height * DPR));
    canvas.width = W; canvas.height = H;
    build();
  }

  /* ---------- WebGL2 renderer: lit metallic spheres with 20 ray-traced-look material effects ----------
     Physics runs on the CPU in typed arrays; the GPU draws every dot (shadow pass + sphere pass) so it holds 120fps. */
  const rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
  const VS = `#version 300 es
in vec2 a_pos; in float a_size; in float a_seed; in float a_speed;
uniform vec2 u_res; uniform vec2 u_light; uniform float u_pass;
out float v_seed; out float v_speed; out vec2 v_c; out float v_size;
void main() {
  vec2 p = a_pos;
  if (u_pass > 0.5) { vec2 d = a_pos - u_light; p += d / (length(d) + 1.0) * a_size * 0.6; }
  gl_Position = vec4(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0, 0.0, 1.0);
  gl_PointSize = a_size * 2.0 + 2.0; v_seed = a_seed; v_speed = a_speed; v_c = a_pos; v_size = a_size;
}`;
  const FS = `#version 300 es
precision highp float;
in float v_seed; in float v_speed; in vec2 v_c; in float v_size;
uniform vec2 u_light; uniform float u_pass; uniform float u_time; uniform float u_hue; uniform float u_spread; uniform int u_mode;
out vec4 o;
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0., 4., 2.), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
vec3 env(vec3 r) {
  float t = r.y * 0.5 + 0.5; vec3 c = mix(vec3(0.015, 0.02, 0.05), vec3(0.8, 0.88, 1.0), smoothstep(0.12, 0.95, t));
  c += vec3(1.0, 0.95, 0.88) * smoothstep(0.9, 0.985, sin(r.x * 3.0 + 1.0) * 0.5 + 0.5) * smoothstep(0.25, 0.85, t) * 1.2;      // softbox strips
  c += vec3(0.35, 0.5, 1.0) * smoothstep(0.82, 1.0, -r.y) * 0.4;                                                               // floor bounce
  return c;
}
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0; float r2 = dot(uv, uv);
  float aa = 1.6 / max(v_size, 1.0), edge = 1.0 - smoothstep(1.0 - aa, 1.0, sqrt(r2));
  if (edge <= 0.0) discard;
  if (u_pass > 0.5) { o = vec4(0.0, 0.0, 0.0, 0.5 * edge); return; }
  vec3 n = vec3(uv.x, -uv.y, sqrt(max(0.0, 1.0 - r2))), V = vec3(0.0, 0.0, 1.0);
  vec2 dl = u_light - v_c; vec3 L = normalize(vec3(dl.x, -dl.y, 140.0 + length(dl) * 0.2));
  float diff = max(dot(n, L), 0.0), fres = pow(1.0 - n.z, 3.0), t = u_time;
  vec3 R = reflect(-V, n), H = normalize(L + V); float spec = pow(max(dot(n, H), 0.0), 90.0);
  float h = fract(u_hue + v_seed * u_spread + v_speed * 0.02); vec3 tint = hsv(h, 0.85, 1.0), col;
  if (u_mode == 0) col = env(R) * (0.55 + 0.45 * tint);
  else if (u_mode == 1) col = pow(env(R), vec3(1.4)) * 1.2 * vec3(0.85, 0.9, 1.0) + tint * fres * 0.4;
  else if (u_mode == 2) col = env(R) * vec3(1.0, 0.78, 0.35) * 1.1;
  else if (u_mode == 3) col = env(R) * vec3(1.0, 0.62, 0.56) * 1.05;
  else if (u_mode == 4) col = vec3(0.55) * (0.5 + 0.5 * env(R)) + vec3(0.9) * pow(max(dot(normalize(vec3(n.x * 0.2, n.y, n.z)), H), 0.0), 40.0) * 0.5 + tint * 0.12;
  else if (u_mode == 5) col = hsv(fract(h + dot(n, V) * 1.3 + t * 0.05), 0.85, 0.2 + env(R).r * 0.9);
  else if (u_mode == 6) col = hsv(fract(atan(n.y, n.x) / 6.2832 + t * 0.12 + h), 0.65, 0.85) * (0.5 + env(R) * 0.6) + spec;
  else if (u_mode == 7) col = mix(vec3(0.95, 0.93, 0.96), tint, fres * 1.6 + 0.12) * (0.6 + 0.4 * diff) + env(R) * 0.3;
  else if (u_mode == 8) col = tint * (0.3 + diff * 0.7) + tint * fres * 2.2;
  else if (u_mode == 9) col = vec3(env(refract(-V, n, 0.72)).r, env(refract(-V, n, 0.69)).g, env(refract(-V, n, 0.66)).b) * 0.95 + tint * 0.08;
  else if (u_mode == 10) col = vec3(0.03) + env(R) * 0.28 + tint * fres * 1.2;
  else if (u_mode == 11) col = mix(vec3(0.85, 0.45, 0.25), vec3(0.2, 0.75, 0.6), hash(floor(v_seed * 90.0))) * (0.4 + env(R) * 0.7);
  else if (u_mode == 12) { float ck = step(0.5, fract(uv.x * 2.0 + uv.y * 2.0)) * 0.5 + 0.5; col = tint * 0.35 * ck + env(R) * 0.35 + vec3(1.0) * step(0.985, hash(v_seed * 300.0 + floor(t * 9.0))); }
  else if (u_mode == 13) col = pow(tint, vec3(1.6)) * (0.35 + diff * 0.6) + env(R) * 0.45 * fres + vec3(1.0) * spec;
  else if (u_mode == 14) col = vec3(env(R + vec3(0.06, 0.0, 0.0)).r, env(R).g, env(R - vec3(0.06, 0.0, 0.0)).b) * (0.6 + 0.4 * tint) + spec * vec3(1.0, 0.7, 0.9);
  else if (u_mode == 15) col = tint * (0.55 + 0.9 * (1.0 - sqrt(r2))) + step(0.5, 1.0 - sqrt(r2)) * 0.1;
  else if (u_mode == 16) col = hsv(h + sin(length(uv) * 8.0 - t * 3.0) * 0.15, 1.0, 0.55 + 0.45 * sin(length(uv) * 10.0 + t * 4.0)) + tint * fres;
  else if (u_mode == 17) col = tint * (0.65 + 0.5 * diff) + vec3(1.0) * pow(max(dot(n, H), 0.0), 140.0);
  else if (u_mode == 18) col = vec3(0.04, 0.0, 0.1) + tint * (fres * 2.0 + step(0.9, hash(v_seed * 77.0 + floor(t * 4.0))) * 1.5 * (1.0 - sqrt(r2)));
  else col = vec3(0.04, 0.05, 0.09) + tint * 0.18 * diff + vec3(1.0) * pow(max(0.0, 1.0 - abs(uv.x * uv.y) * 14.0), 8.0) * step(0.55, hash(v_seed * 91.0 + floor(t * 6.0)));
  col *= mix(0.5, 1.0, n.z); col += vec3(1.0) * spec * (u_mode == 10 ? 0.6 : 0.35);
  o = vec4(col * edge, edge);
}`;
  const MODES = 20;
  let gl = null, prog = null, buf = null, data = null, loc = {};
  function initGL() {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['u_res', 'u_light', 'u_pass', 'u_time', 'u_hue', 'u_spread', 'u_mode'].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [['a_pos', 2, 0], ['a_size', 1, 8], ['a_seed', 1, 12], ['a_speed', 1, 16]].forEach(([n, c, off]) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, c, gl.FLOAT, false, 20, off); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  try { if (!initGL()) throw new Error('no webgl2'); } catch (e) { gl = null; }
  const ctx = gl ? null : canvas.getContext('2d');

  /* palette + material state: changes every 20s and at every transition; hue/spread glide, the material switches while the dots are mid-scatter */
  const look = { mode: (Math.random() * MODES) | 0, hue: Math.random(), spread: 1, ty: 'x', tHue: 0, tSpread: 1 };
  look.tHue = look.hue; look.tSpread = look.spread;
  const PALS = ['x', 'diag', 'radial', 'random', 'twotone', 'accent', 'y', 'rings'];
  function newLook(withMode) {
    look.tHue = Math.random(); look.tSpread = pick([0.15, 0.3, 0.6, 1, 1.4, 2]); look.ty = pick(PALS);
    if (withMode) look.mode = (Math.random() * MODES) | 0;
  }
  setInterval(() => newLook(false), 20000);
  function seedFor(q) {
    const nx = q.tx / W, ny = q.ty / H;
    switch (look.ty) {
      case 'diag': return (nx + ny) * 0.5; case 'radial': return Math.hypot(nx - 0.5, (ny - 0.5) * 2) * 0.8; case 'random': return q.ph / 6.283;
      case 'twotone': return nx < 0.5 ? 0 : 0.5; case 'accent': return q.ph > 5.6 ? 0.5 : 0; case 'y': return ny; case 'rings': return (Math.sin(Math.hypot(nx - 0.5, ny - 0.5) * 18) + 1) * 0.25;
      default: return nx;
    }
  }

  /* 12 ways a shape rebuilds itself: wave, spiral, explosion, vortex, rain, magnet, columns, shatter, ripple from the cursor... */
  const PATTERNS = [
    (q, i, N) => ({ d: (i / N) * 900, kx: 0, ky: 0 }),                                                                                       // sweep
    (q) => ({ d: (q.ty / H) * 900, kx: 0, ky: 0 }),                                                                                          // top-down
    (q) => ({ d: Math.hypot(q.tx - W / 2, q.ty - H / 2) / W * 1100, kx: 0, ky: 0 }),                                                          // from the middle
    (q) => ({ d: pointer ? Math.hypot(q.tx - pointer.x, q.ty - pointer.y) / W * 1100 : Math.random() * 900, kx: 0, ky: 0 }),                  // ripple from the cursor
    (q) => ({ d: Math.random() * 900, kx: 0, ky: 0 }),                                                                                        // scatter
    (q) => ({ d: (Math.atan2(q.ty - H / 2, q.tx - W / 2) + Math.PI) / 6.283 * 900, kx: 0, ky: 0 }),                                           // spiral
    (q) => { const a = Math.atan2(q.ty - H / 2, q.tx - W / 2); return { d: Math.random() * 200, kx: Math.cos(a) * 14 * DPR, ky: Math.sin(a) * 14 * DPR }; },   // explode & reform
    (q) => { const a = Math.atan2(q.ty - H / 2, q.tx - W / 2) + 1.57; return { d: Math.random() * 300, kx: Math.cos(a) * 11 * DPR, ky: Math.sin(a) * 11 * DPR }; },  // vortex
    (q) => ({ d: Math.random() * 250, kx: 0, ky: 16 * DPR }),                                                                                  // everything drops
    (q) => ({ d: Math.random() * 250, kx: (W / 2 - q.x) * 0.05, ky: (H / 2 - q.y) * 0.05 }),                                                  // magnet to the middle, then out
    (q) => ({ d: Math.floor(q.tx / (W / 14)) * 90, kx: 0, ky: (Math.floor(q.tx / (W / 14)) % 2 ? -1 : 1) * 12 * DPR }),                         // alternating columns
    (q) => ({ d: Math.floor(q.tx / (W / 9)) * 70 + Math.floor(q.ty / (H / 5)) * 130, kx: rand(-4, 4) * DPR, ky: rand(-4, 4) * DPR })          // shatter into chunks
  ];

  /* ---------- main loop ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || !W || !P.length) return;
    const dt = Math.min(3, (now - last) / 16.667); last = now;
    const t = now / 1000, N = P.length;

    if (!REDUCED && now - modeAt > HOLD) {
      si++; if (si >= seq.length) { seq = makeSeq(); si = 0; }
      cur = seq[si]; modeAt = now; HOLD = 4200;
      const tgt = shapes[cur], pat = PATTERNS[(Math.random() * PATTERNS.length) | 0];
      for (let i = 0; i < N; i++) { const q = P[i], r = pat(q, i, N); q.sw = now + r.d + Math.random() * 120; q.nt = tgt[i]; q.kx = r.kx; q.ky = r.ky; }
      newLook(true);                                                // a new material and palette every time the sign rebuilds
    }
    look.hue += (look.tHue - look.hue) * Math.min(1, 0.04 * dt); look.spread += (look.tSpread - look.spread) * Math.min(1, 0.04 * dt);

    const R = Math.min(W, H) * 0.42, damp = Math.pow(0.85, dt);
    const px0 = pointer ? pointer.x : -1e9, py0 = pointer ? pointer.y : -1e9;
    const lx = pointer ? pointer.x : W * (0.5 + Math.cos(t * 0.4) * 0.45), ly = pointer ? pointer.y : H * (0.5 + Math.sin(t * 0.55) * 0.4);
    for (let i = pokes.length - 1; i >= 0; i--) { pokes[i].age += dt * 0.025; if (pokes[i].age > 1) pokes.splice(i, 1); }

    if (gl && (!data || data.length < N * 5)) data = new Float32Array(N * 5);
    for (let i = 0; i < N; i++) {
      const q = P[i];
      if (q.nt && now >= q.sw) {
        q.tx = q.nt[0]; q.ty = q.nt[1]; q.nt = null;
        const a = Math.random() * 6.283, k = (1 + Math.random() * 4) * DPR;
        q.vx += Math.cos(a) * k + (q.kx || 0); q.vy += Math.sin(a) * k + (q.ky || 0); q.kx = q.ky = 0;
      }
      const k = 0.075 / q.m;
      q.vx += (q.tx - q.x) * k * dt; q.vy += (q.ty - q.y) * k * dt;
      q.vx += Math.cos(t * 1.7 + q.ph) * 0.02 * DPR * dt; q.vy += Math.sin(t * 1.3 + q.ph) * 0.02 * DPR * dt;
      if (pointer) {
        const dx = q.x - px0, dy = q.y - py0, d = Math.hypot(dx, dy);
        if (d < R) { const w = 1 - d / R, f = w * w * 3.4 * DPR * dt / q.m; q.vx += (dx / (d || 1)) * f + pvx * w * 0.06; q.vy += (dy / (d || 1)) * f + pvy * w * 0.06; q.vx += (-dy / (d || 1)) * w * 0.5 * dt; q.vy += (dx / (d || 1)) * w * 0.5 * dt; }
      }
      for (let r = 0; r < pokes.length; r++) {
        const pk = pokes[r], dx = q.x - pk.x, dy = q.y - pk.y, d = Math.hypot(dx, dy) || 1, front = pk.age * Math.max(W, H) * 0.7;
        const w = Math.exp(-Math.pow((d - front) / (R * 0.4), 2)) * (1 - pk.age) * 2.2 * DPR * dt; q.vx += (dx / d) * w; q.vy += (dy / d) * w;
      }
      q.vx *= damp; q.vy *= damp; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < q.r) { q.x = q.r; q.vx *= -0.5; } else if (q.x > W - q.r) { q.x = W - q.r; q.vx *= -0.5; }
      if (q.y < q.r) { q.y = q.r; q.vy *= -0.5; } else if (q.y > H - q.r) { q.y = H - q.r; q.vy *= -0.5; }
      if (gl) { const o = i * 5; data[o] = q.x; data[o + 1] = q.y; data[o + 2] = q.r; data[o + 3] = seedFor(q); data[o + 4] = Math.min(8, Math.abs(q.vx) + Math.abs(q.vy)); }
    }

    if (gl) {
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.uniform2f(loc.u_res, W, H); gl.uniform2f(loc.u_light, lx, ly); gl.uniform1f(loc.u_time, t); gl.uniform1f(loc.u_hue, look.hue); gl.uniform1f(loc.u_spread, look.spread); gl.uniform1i(loc.u_mode, look.mode);
      gl.uniform1f(loc.u_pass, 1); gl.drawArrays(gl.POINTS, 0, N);      // contact shadows
      gl.uniform1f(loc.u_pass, 0); gl.drawArrays(gl.POINTS, 0, N);      // lit spheres
    } else {                                                           // very old devices: plain flat dots
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) { const q = P[i]; ctx.fillStyle = 'hsl(' + (((look.hue + seedFor(q) * look.spread) * 360) | 0) + ',90%,60%)'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill(); }
    }
    pvx *= 0.8; pvy *= 0.8;
  }

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
