/* The Mosaics get ambitious. After you've been on the page 4+ minutes (and the music is off), a few of them escape the
   strip at the bottom and climb the website itself. Everything on the page is solid: they have real collision against the
   edges of the sections, photos, buttons and headings, they walk along tops, get blocked by walls, crouch, leap, stretch
   their arms up to grab a ledge, haul themselves over the lip, and hand-over-hand up the sides of tall things.
   Along the way they
   - stop and wave to get your attention when you can see them (click one: confetti; ignore them: they slump and fall),
   - shove each other off (the loser falls, bounces down the page and walks off ledges until they hit the bottom),
   - slip, fall and have to try again,
   - and if they reach the mosaicStudioS sign they hang off it and knock its dots loose.
   Music playing = they're partying: no climbing, no fighting. Reduced motion: off. Add ?climb to the URL to skip the wait. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.getElementById('stage');
  if (!stage) return;

  const NEED_MS = 4 * 60 * 1000;
  const G = 2000, BW = 11, BH = 84;                        // gravity px/s², body half-width, body height (for collision)
  let onPage = 0, cooldownUntil = 0, climbers = [], raf = 0, last = 0, life = 0;
  const partying = () => stage.classList.contains('is-party');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const scrollY = () => window.pageYOffset || document.documentElement.scrollTop || 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t * t * (3 - 2 * t);

  const layer = document.createElement('div');
  layer.className = 'mclimb';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  setInterval(() => { if (!document.hidden) onPage += 1000; }, 1000);
  setInterval(() => {
    if (document.hidden || partying() || climbers.length || Date.now() < cooldownUntil || onPage < NEED_MS) return;
    if (Math.random() < 0.55) start();
  }, 4000);
  if (/[?&]climb\b/.test(location.search)) { onPage = NEED_MS; const kick = setInterval(() => { if (climbers.length) clearInterval(kick); else start(); }, 2000); }

  /* ---------- depth on the strip: everyone wanders towards and away from the camera ---------- */
  const depthed = new WeakSet();
  function addDepth(el) {
    if (depthed.has(el)) return; depthed.add(el);
    const fig = el.querySelector('.raver__fig') || el;
    const near = Math.random() < 0.5, k = rand(0.78, 0.9);
    fig.style.setProperty('--s0', near ? 1.08 : k); fig.style.setProperty('--s1', near ? k : 1.08);
    fig.style.setProperty('--y0', near ? '3px' : '-15px'); fig.style.setProperty('--y1', near ? '-15px' : '3px');
    fig.style.setProperty('--b0', near ? 1 : 0.78); fig.style.setProperty('--b1', near ? 0.78 : 1);
    fig.style.setProperty('--dd', rand(11, 22).toFixed(1) + 's'); fig.style.setProperty('--dl', (-rand(0, 20)).toFixed(1) + 's');
    fig.classList.add('has-depth');
  }
  stage.querySelectorAll('.raver').forEach(addDepth);
  new MutationObserver(() => stage.querySelectorAll('.raver').forEach(addDepth)).observe(stage, { childList: true });

  /* ---------- the website as a solid world ---------- */
  const SELECTORS = '.tile, .filter, .field, input, textarea, select, button.send, summary, .rates__row, .rates li, .quote > *, .contact__grid > *, .services__grid > *, .faq__list > *, .foot__mark, .foot__meta, .copy, .marquee, .hero__bar, .board';
  const LETTER_EL = '#wordmark, .sechead h2, .contact__h, .foot__mark, .lightbox h2';
  // every visible character of a heading becomes its own little block: you can't stroll over text, you climb its letters
  function letterSolids(sy, nearY) {
    const out = [];
    document.querySelectorAll(LETTER_EL).forEach((el) => {
      if (el.closest('.mclimb, #stage, dialog')) return;
      const er = el.getBoundingClientRect(), top = er.top + sy;
      if (!nearY.some((y) => Math.abs(y - top) < 1400) || er.width < 40) return;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let n, count = 0;
      while ((n = tw.nextNode()) && count < 260) {
        const txt = n.nodeValue;
        for (let i = 0; i < txt.length && count < 260; i++) {
          if (/\s/.test(txt[i])) continue;
          range.setStart(n, i); range.setEnd(n, i + 1);
          const r = range.getBoundingClientRect();
          if (r.width < 4 || r.height < 10) continue;
          // glyph body: skip the empty strip above the cap height and below the baseline
          const gt = r.top + r.height * 0.2, gb = r.bottom - r.height * 0.12;
          out.push({ l: r.left + 1, r: r.right - 1, top: gt + sy, bottom: gb + sy, letter: true });
          count++;
        }
      }
    });
    return out;
  }
  let solids = [], solidsAt = 0, ground = 0;
  function world() {
    if (performance.now() - solidsAt < 900 && solids.length) return solids;
    const sy = scrollY(), raw = [], vw = document.documentElement.clientWidth;
    document.querySelectorAll(SELECTORS).forEach((el) => {
      if (el.closest('.mclimb, #stage, dialog, .viewer, .scp, .bar')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 16 || r.width > vw * 0.98) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
      raw.push({ l: r.left, r: r.right, top: r.top + sy, bottom: r.bottom + sy });
    });
    raw.push(...letterSolids(sy, climbers.length ? climbers.map((c) => c.fy) : [sy + 400]));
    if (window.MosaicSign) raw.push(...window.MosaicSign.solids());          // the dot sign: the true outline of mosaicStudioS
    // drop anything swallowed by something bigger (keeps the world clean for collision)
    const out = raw.filter((a, i) => !raw.some((b, j) => j !== i && !b.sign && !b.letter && !a.letter && !a.sign && b.l <= a.l + 2 && b.r >= a.r - 2 && b.top <= a.top + 2 && b.bottom >= a.bottom - 2 && (b.r - b.l) * (b.bottom - b.top) > (a.r - a.l) * (a.bottom - a.top)));
    ground = stage.getBoundingClientRect().bottom + sy - 4;
    out.push({ l: -1e5, r: 1e5, top: ground, bottom: ground + 4000, floor: true });                                   // the strip
    out.push({ l: -1e5, r: 0, top: 0, bottom: ground + 4000, edge: true }, { l: vw, r: 1e5, top: 0, bottom: ground + 4000, edge: true }); // the page edges
    solids = out; solidsAt = performance.now();
    return out;
  }

  /* ---------- the climber ---------- */
  const sz = (c) => ({ w: c.el.offsetWidth || 80, h: c.el.offsetHeight || 112 });
  const set = (c, state, pose) => { c.state = state; c.t = 0; c.pose = pose || 'is-chill'; c.el.className = 'raver is-rig ' + (c.base || '') + (c.left ? ' is-left' : '') + ' ' + c.pose; };

  function start() {
    const originals = [...stage.querySelectorAll('.raver')].filter((e) => !e.classList.contains('is-sleep'));
    if (originals.length < 2) return;
    world();
    const n = Math.min(originals.length, window.innerWidth < 600 ? 2 : (Math.random() < 0.5 ? 3 : 2));
    originals.sort(() => Math.random() - 0.5).slice(0, n).forEach((orig, i) => {
      const el = orig.cloneNode(true);
      el.removeAttribute('aria-label'); el.setAttribute('tabindex', '-1');
      layer.append(el);
      const r = orig.getBoundingClientRect(), sy = scrollY();
      const c = { el, orig, base: [...orig.classList].filter((k) => k.startsWith('st-')).join(' '), left: false, fx: r.left + r.width / 2, fy: ground, vx: 0, vy: 0, grounded: true, state: 'wait', t: 0, delay: i * rand(0.7, 1.5),
        effort: rand(0.9, 1.3), askDone: false, bubble: null, target: null, fightT: rand(4, 8), slipT: rand(5, 9), signDone: false, ladder: i === 0 && Math.random() < 0.75, ladderEl: null, side: 0, sy: 1, lean: 0, hand: null };
      void sy;
      orig.style.visibility = 'hidden';
      el.addEventListener('click', () => onClick(c));
      set(c, 'wait', 'is-chill');
      climbers.push(c);
    });
    life = 0; last = performance.now();
    if (window.MosaicSign) window.MosaicSign.hold(true);
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function say(c, text, ms) {
    if (!c.bubble) { c.bubble = document.createElement('div'); c.bubble.className = 'mclimb__say mono'; layer.append(c.bubble); }
    c.bubble.textContent = text; c.bubble.hidden = false; c.sayUntil = performance.now() + (ms || 1800);
  }
  function confetti(c) {
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i'); p.className = 'mclimb__conf';
      p.style.cssText = 'left:' + c.fx + 'px;top:' + (c.fy - 80) + 'px;--dx:' + rand(-90, 90) + 'px;--dy:' + rand(-130, 40) + 'px;background:' + pick(['#ec2a1c', '#c6ff3d', '#f6b62c', '#3dd6ff', '#ff7ad9']);
      p.addEventListener('animationend', () => p.remove());
      layer.append(p);
    }
  }
  function onClick(c) { if (c.state !== 'ask') return; confetti(c); say(c, 'LETS GO!', 1600); set(c, 'cheer', 'is-cheer'); }
  const LAD = 168;
  function ladderEl(color) {
    const d = document.createElement('div'); d.className = 'mclimb__ladder';
    let rungs = '';
    for (let y = 14; y < LAD - 6; y += 22) rungs += '<path d="M3 ' + y + ' H15"/>';
    d.innerHTML = '<svg viewBox="0 0 18 ' + LAD + '" width="18" height="' + LAD + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round"><path d="M3 2 V' + (LAD - 2) + ' M15 2 V' + (LAD - 2) + '"/>' + rungs + '</svg>';
    layer.append(d); return d;
  }
  function placeLadder(c, wallEdge, side) {
    if (!c.ladderEl) c.ladderEl = ladderEl(pick(['#f6b62c', '#c6ff3d', '#3dd6ff', '#ff7ad9']));
    const lean = side * -9;                                // leans against the wall
    c.ladderEl.style.transformOrigin = '50% 100%';
    c.ladderEl.style.transform = 'translate3d(' + Math.round(wallEdge - side * 22 - 9) + 'px,' + Math.round(c.fy - LAD) + 'px,0) rotate(' + lean + 'deg)';
    c.ladderY = c.fy;
  }
  function dropLadder(c) { if (c.ladderEl) { c.ladderEl.remove(); c.ladderEl = null; } }
  function release() {
    climbers.forEach((c) => { dropLadder(c); c.orig.style.visibility = ''; c.el.remove(); if (c.bubble) c.bubble.remove(); });
    climbers = []; cancelAnimationFrame(raf); raf = 0;
    if (window.MosaicSign) window.MosaicSign.hold(false);
    cooldownUntil = Date.now() + rand(35000, 70000);          // a breather, then they try again
  }
  const onScreen = (c) => { const y = c.fy - scrollY(); return y > 70 && y < window.innerHeight + 30 && c.fx > 0 && c.fx < document.documentElement.clientWidth; };

  /* ---------- real collision: move-and-slide against the page's solids ---------- */
  function physics(c, dt) {
    const S = world(), steps = Math.max(1, Math.ceil((Math.abs(c.vx) + Math.abs(c.vy)) * dt / 8)), h = dt / steps;
    c.grounded = false; c.wall = 0; c.ledgeUnder = null;
    for (let k = 0; k < steps; k++) {
      c.vy = Math.min(2100, c.vy + G * h);
      // horizontal
      c.fx += c.vx * h;
      for (const s of S) {
        if (c.fy - 3 > s.top && c.fy - BH + 3 < s.bottom && c.fx + BW > s.l && c.fx - BW < s.r) {
          if (s.floor) continue;
          const fromLeft = c.fx < (s.l + s.r) / 2;
          if (c.fy - 3 > s.top) { c.fx = fromLeft ? s.l - BW : s.r + BW; if (c.vx) c.wall = fromLeft ? 1 : -1; c.wallSolid = s; c.vx = 0; }
        }
      }
      // vertical
      const prev = c.fy; c.fy += c.vy * h;
      for (const s of S) {
        if (c.fx + BW <= s.l || c.fx - BW >= s.r) continue;
        if (c.vy >= 0 && prev <= s.top + 6 && c.fy >= s.top) { c.fy = s.top; c.vy = 0; c.grounded = true; c.ledgeUnder = s; }
        else if (c.vy < 0 && prev - BH >= s.bottom - 6 && c.fy - BH <= s.bottom && !s.floor && !s.edge) { c.fy = s.bottom + BH; c.vy = 0; }
      }
    }
  }

  /* ---------- picking the next thing to climb ---------- */
  function chooseWall(c, reachOnly) {
    const S = world(); let best = null, bestScore = 1e9;
    for (const s of S) {
      if (s.floor) continue;
      const rise = c.fy - s.top;
      if (rise < 24) continue;
      if (s.edge && !reachOnly) continue;
      if (!s.edge && ((s.bottom < c.fy - 8 && rise > 150) || rise > 900)) continue;   // climb walls that reach us, or leap at anything within a jump
      const sideX = c.fx < (s.l + s.r) / 2 ? s.l - BW - 1 : s.r + BW + 1, dx = Math.abs(sideX - c.fx);
      if (dx > 700) continue;
      const score = s.top + dx * 0.3 + Math.random() * 140 + (s.sign && !c.signDone ? -120 : 0);
      if (score < bestScore) { bestScore = score; best = { s, sideX }; }
    }
    return best;
  }

  function launch(c, lipX, lipTop, side) {
    const rise = Math.max(30, c.fy - lipTop), vyAbs = Math.sqrt(2 * G * (rise + 30));
    const tFlight = (vyAbs + Math.sqrt(Math.max(0, vyAbs * vyAbs - 2 * G * rise))) / G;
    c.vy = -vyAbs; c.vx = clamp((lipX - side * BW - c.fx) / tFlight, -260, 260);
  }

  /* ---------- body language: reach, stretch, flex (all procedural, set per frame) ---------- */
  const part = (c, k) => c.parts[k] || (c.parts[k] = c.el.querySelector('.rv__' + k));
  function pose(c, o) {
    c.parts = c.parts || {};
    const rv = c.rv || (c.rv = c.el.querySelector('.rv'));
    const any = o.sy !== undefined || o.rot !== undefined || o.sx !== undefined;
    if (rv) { rv.style.transform = any ? 'rotate(' + (o.rot || 0) + 'deg) scale(' + (o.sx || 1) + ',' + (o.sy || 1) + ')' : ''; rv.style.animation = any ? 'none' : ''; }
    for (const k of ['armL', 'armR', 'legL', 'legR']) { const p = part(c, k); if (p) { p.style.transform = o[k] === undefined ? '' : 'rotate(' + o[k] + 'deg)'; p.style.animation = o[k] === undefined ? '' : 'none'; } }
  }
  // angle for an arm to point from the shoulder to a world point (feet-based coords), accounting for the mirrored figure
  function reachAngle(c, tx, ty) {
    const { w, h } = sz(c), sx = w / 100, sy = h / 130;
    const shoulderX = c.fx, shoulderY = c.fy - h + 47 * sy;      // approx: shoulders sit at (50,47) in a 100x130 box
    let vx = tx - shoulderX, vy = ty - shoulderY;
    if (c.left) vx = -vx;
    void sx;
    return Math.atan2(-vx, vy) * 180 / Math.PI;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; life += dt;
    const party = partying();
    world();

    for (const c of climbers) {
      const { w, h } = sz(c);
      c.t += dt;
      if (party && !['descend', 'fall', 'splat', 'home', 'drop'].includes(c.state)) { say(c, '♪ ♪', 1500); c.descending = true; set(c, 'drop', 'is-walk'); }
      let free = true;                                      // run the physics step unless a state pins the body to a wall

      switch (c.state) {
        case 'wait': if (c.t > c.delay) { set(c, 'plan', 'is-walk'); } break;

        case 'plan': {                                        // choose a wall to scale from where we stand
          let pick1 = chooseWall(c, false);
          if (!pick1) pick1 = chooseWall(c, true);
          if (!pick1) { set(c, 'top', 'is-cheer'); say(c, 'MADE IT', 1500); break; }
          c.target = pick1; set(c, 'approach', 'is-walk');
          break;
        }
        case 'approach': {                                    // walk along whatever we're standing on, towards the wall
          const T = c.target; if (!T) { set(c, 'plan'); break; }
          const dx = T.sideX - c.fx;
          c.left = dx < 0; c.el.classList.toggle('is-left', c.left);
          c.vx = Math.sign(dx) * Math.min(140, Math.abs(dx) * 6 + 20);
          // end of the platform before the wall? hop the gap if it is small, otherwise replan
          if (c.grounded && c.ledgeUnder && !c.ledgeUnder.floor) {
            const edge = dx > 0 ? c.ledgeUnder.r : c.ledgeUnder.l;
            if (Math.abs(edge - c.fx) < 6 && Math.abs(dx) > 14) { c.vy = -620; c.vx = Math.sign(dx) * 150; set(c, 'airborne', 'is-walk'); }
          }
          if (Math.abs(dx) < 4 || (c.wall && Math.sign(dx) === c.wall)) { c.vx = 0; c.side = T.sideX < (T.s.l + T.s.r) / 2 ? 1 : -1; c.left = c.side === 1 ? false : true; set(c, 'brace', 'is-walk'); }
          if (c.t > 8) set(c, 'plan', 'is-walk');
          break;
        }
        case 'airborne': if (c.grounded && c.t > 0.15) set(c, 'plan', 'is-walk'); break;

        case 'brace': {                                       // crouch, loading the jump
          c.vx = 0; c.el.classList.toggle('is-left', c.left);
          const k = Math.min(1, c.t / 0.28);
          pose(c, { sy: 1 - 0.2 * ease(k), rot: (c.side === 1 ? 4 : -4) * k, armL: 18, armR: -18, legL: -22 * k, legR: 22 * k });
          if (c.t > 0.3) {
            const T = c.target, rise = c.fy - T.s.top;
            if (rise <= 150) { launch(c, c.side === 1 ? T.s.l : T.s.r, T.s.top, c.side); set(c, 'leap', 'is-walk'); }   // close enough to jump for the edge
            else if (c.ladder && rise <= LAD + 120 && !T.s.edge) { const wallEdge = c.side === 1 ? T.s.l : T.s.r; placeLadder(c, wallEdge, c.side); say(c, 'ladder time', 1200); set(c, 'ladderclimb', 'is-climb'); }
            else { c.edgeT = 0; set(c, 'wallclimb', 'is-walk'); }
          }
          break;
        }
        case 'leap': {                                        // stretch: arms and body reach up at the lip
          const T = c.target, lipX = c.side === 1 ? T.s.l : T.s.r;
          pose(c, { sy: 1.1, rot: c.side * 6, armL: reachAngle(c, lipX, T.s.top), armR: reachAngle(c, lipX + c.side * -3, T.s.top - 4), legL: -10, legR: 18 });
          if (c.vy > 0 && c.t > 0.12 && c.fy - 78 <= T.s.top + 28 && Math.abs(c.fx - (lipX - c.side * BW)) < 20) { c.fx = lipX - c.side * BW; c.vx = 0; c.vy = 0; set(c, 'hang', 'is-climb'); break; }   // caught the edge
          if (c.grounded && c.t > 0.2) { set(c, 'plan', 'is-walk'); }                                                                                     // missed, try again
          break;
        }
        case 'hang': {                                        // dangling by the fingertips, then the pull-up
          free = false; const T = c.target;
          const lipX = c.side === 1 ? T.s.l : T.s.r;
          const k = Math.min(1, c.t / 0.5);
          c.fx = lipX - c.side * BW; c.fy = T.s.top + 80 - 0 * k;
          pose(c, { sy: 1.12, rot: 0, armL: reachAngle(c, lipX, T.s.top), armR: reachAngle(c, lipX, T.s.top), legL: 12 + Math.sin(c.t * 9) * 10, legR: -8 + Math.cos(c.t * 9) * 10 });
          if (c.t > 0.55) set(c, 'pull', 'is-climb');
          break;
        }
        case 'pull': {                                        // flex: bend arms, haul the body up and over
          free = false; const T = c.target, lipX = c.side === 1 ? T.s.l : T.s.r, k = ease(Math.min(1, c.t / 0.75));
          c.fy = (T.s.top + 80) + ((T.s.top) - (T.s.top + 80)) * k;
          c.fx = lipX - c.side * BW + c.side * (BW * 2.2) * Math.max(0, (k - 0.55) / 0.45);
          pose(c, { sy: 1.1 - 0.22 * k, rot: -c.side * 14 * Math.sin(k * 3.14), armL: 120 - 90 * k, armR: 100 - 80 * k, legL: -40 * (1 - k), legR: 30 * (1 - k) });
          if (k >= 1) { c.fy = T.s.top; c.vy = 0; c.vx = 0; pose(c, {}); set(c, 'ledge', 'is-chill'); }
          break;
        }
        case 'wallclimb': {                                   // hand over hand up a tall wall
          free = false; const T = c.target, wallEdge = c.side === 1 ? T.s.l : T.s.r;
          c.fx = wallEdge - c.side * BW; c.fy -= 30 * c.effort * dt * (T.s.edge ? 1.5 : 1);
          c.edgeT += dt;
          const ph = Math.sin(c.t * 7), up = c.fy - BH - 36;
          pose(c, { sy: 1.04 + 0.05 * ph, rot: c.side * 5 * ph, armL: reachAngle(c, c.fx + c.side * 16, c.fy - BH - 22 - (ph > 0 ? 18 : 0)), armR: reachAngle(c, c.fx + c.side * 16, c.fy - BH - 22 - (ph > 0 ? 0 : 18)), legL: 20 - 38 * (ph > 0 ? 1 : 0), legR: 20 - 38 * (ph > 0 ? 0 : 1) });
          void up;
          c.slipT -= dt; c.fightT -= dt;
          if (T.s.edge) { c.scanT = (c.scanT || 0) - dt; if (c.scanT <= 0) { c.scanT = 1.2; const alt = chooseWall(c, false); if (alt && alt.s.top > c.fy - 175 && Math.abs(alt.sideX - c.fx) < 300) { c.target = alt; c.side = alt.sideX < (alt.s.l + alt.s.r) / 2 ? 1 : -1; c.left = c.side !== 1; pose(c, {}); launch(c, c.side === 1 ? alt.s.l : alt.s.r, alt.s.top, c.side); free = true; set(c, 'leap', 'is-walk'); break; } } }
          if (!c.askDone && onScreen(c) && Math.random() < dt * 0.1) { c.askDone = true; c.ask = rand(4.5, 6.5); pose(c, {}); set(c, 'ask', 'is-wave'); say(c, pick(['psst!', 'click me', 'hey!', 'over here']), 1500); break; }
          if (c.slipT <= 0) { c.slipT = rand(6, 11); if (Math.random() < 0.45) { pose(c, {}); set(c, 'slip', 'is-climb is-slip'); c.vy = 0; say(c, 'whoa', 900); break; } }
          if (c.fy - T.s.top <= 150) { launch(c, c.side === 1 ? T.s.l : T.s.r, T.s.top, c.side); free = true; set(c, 'leap', 'is-walk'); }
          break;
        }
        case 'ladderclimb': {                                 // up the stick-figure ladder, rung by rung
          free = false; const T = c.target, wallEdge = c.side === 1 ? T.s.l : T.s.r;
          c.fx = wallEdge - c.side * 20; c.fy -= 52 * dt;
          const ph = Math.sin(c.t * 6);
          pose(c, { sy: 1.03, rot: c.side * 3 * ph, armL: reachAngle(c, c.fx + c.side * 8, c.fy - BH - 20 - (ph > 0 ? 14 : 0)), armR: reachAngle(c, c.fx + c.side * 8, c.fy - BH - 20 - (ph > 0 ? 0 : 14)), legL: 18 - 34 * (ph > 0 ? 1 : 0), legR: 18 - 34 * (ph > 0 ? 0 : 1) });
          if (c.fy - T.s.top <= 140 || c.ladderY - c.fy >= LAD - 30) { launch(c, c.side === 1 ? T.s.l : T.s.r, T.s.top, c.side); free = true; set(c, 'leap', 'is-walk'); }
          break;
        }
        case 'ledge': {                                       // up on top: catch a breath, then plan again
          pose(c, {}); c.vx = 0; if (c.ladderEl && c.t > 0.3) { dropLadder(c); say(c, 'got it', 700); }
          if (c.target && c.target.s.sign && !c.signDone && Math.random() < 0.9) { c.signDone = true; c.sg = c.target.s; c.signT = rand(3.4, 5.2); c.sg = c.target.s; c.signTarget = rand(c.sg.l - 40, c.sg.r + 40); set(c, 'sign', 'is-climb'); say(c, 'my sign now', 1600); break; }
          if (c.t > rand(0.4, 0.9)) set(c, 'plan', 'is-walk');
          break;
        }
        case 'sign': {                                        // hang off the sign and yank dots out of it
          free = false; const g = window.MosaicSign ? window.MosaicSign.band() : c.sg, dx = c.signTarget - c.fx; c.fx += Math.sign(dx) * Math.min(Math.abs(dx), 150 * dt); c.left = dx < 0; c.el.classList.toggle('is-left', c.left);
          c.fy = g.top + (g.bottom - g.top) * (0.55 + Math.sin(c.t * 2.4) * 0.15);
          pose(c, { sy: 1.08, armL: reachAngle(c, c.fx, c.fy - BH - 24), armR: reachAngle(c, c.fx + 6, c.fy - BH - 24), legL: 14 * Math.sin(c.t * 6), legR: -14 * Math.sin(c.t * 6) });
          c.signT -= dt;
          if (Math.floor(c.t * 5) !== Math.floor((c.t - dt) * 5)) document.dispatchEvent(new CustomEvent('mosaic-sign', { detail: { clientX: c.fx, clientY: c.fy - h * 0.55 - scrollY(), radius: 40 + Math.random() * 34 } }));
          if (c.signT <= 0) { say(c, 'oops', 900); pose(c, {}); c.fy = g.top - 2; c.vy = 0; set(c, 'ledge', 'is-chill'); }
          break;
        }
        case 'ask': c.vx = 0; c.ask -= dt; if (c.ask <= 0) { set(c, 'slump', 'is-chill'); say(c, 'nobody? ok…', 1500); } free = false; break;
        case 'slump': free = false; if (c.t > 1.3) { c.vy = -60; c.descending = true; c.askDone = false; set(c, 'fall', 'is-fall'); } break;
        case 'cheer': free = false; if (c.t > 1.5) { c.vy = 0; set(c, 'plan', 'is-walk'); } break;
        case 'top': c.vx = 0; if (c.t > 2.6) { c.descending = true; set(c, 'slip', 'is-climb is-slip'); say(c, 'oh no', 900); c.fell = true; } break;
        case 'slip': free = false; c.vy += 900 * dt; c.fy += c.vy * dt * 0.5; if (c.t > 0.55) { pose(c, {}); c.fx -= c.side * 2; if (c.fell) { c.fell = false; set(c, 'fall', 'is-fall'); } else { set(c, 'wallclimb', 'is-climb'); c.vy = 0; } } break;
        case 'fall': {                                        // real tumble: bounces down the page ledge by ledge
          if (c.grounded && c.t > 0.2) {
            if (c.ledgeUnder && c.ledgeUnder.floor) { set(c, 'splat', 'is-chill is-splat'); say(c, 'ow', 1200); }
            else { set(c, 'stumble', 'is-walk'); }
          }
          break;
        }
        case 'stumble': {                                     // landed on some ledge on the way down: shuffle to the edge and drop off
          const L = c.ledgeUnder; if (!L) { set(c, 'fall', 'is-fall'); break; }
          const toLeft = Math.abs(c.fx - L.l) < Math.abs(c.fx - L.r); c.left = toLeft; c.el.classList.toggle('is-left', c.left);
          c.vx = (toLeft ? -1 : 1) * 110;
          if (!c.grounded) set(c, 'fall', 'is-fall');
          if (c.t > 6) set(c, 'plan', 'is-walk');
          break;
        }
        case 'drop': c.descending = true; { const L = c.ledgeUnder; if (L && !L.floor) { const toLeft = Math.abs(c.fx - L.l) < Math.abs(c.fx - L.r); c.left = toLeft; c.el.classList.toggle('is-left', c.left); c.vx = (toLeft ? -1 : 1) * 120; } else if (c.grounded && L && L.floor) set(c, 'home', 'is-walk'); } break;
        case 'splat': c.vx = 0; if (c.t > 1.5) set(c, 'home', 'is-walk'); break;
        case 'home': {
          const r = c.orig.getBoundingClientRect(), dx = r.left + r.width / 2 - c.fx;
          c.left = dx < 0; c.el.classList.toggle('is-left', c.left); c.vx = Math.sign(dx) * Math.min(130, Math.abs(dx) * 5);
          if (Math.abs(dx) < 4 && c.grounded) c.done = true;
          break;
        }
        default: break;
      }

      if (free) physics(c, dt);
      if (c.state === 'fall' && c.vy < 0 && c.t < 0.1) { /* launched */ }

      // the shove: two climbers near each other can fight; the loser takes the long fall
      if (!party && ['wallclimb', 'ledge', 'approach'].includes(c.state) && c.fightT <= 0) {
        c.fightT = rand(5, 10);
        const foe = climbers.find((o) => o !== c && ['wallclimb', 'ledge', 'approach'].includes(o.state) && Math.abs(o.fy - c.fy) < 120 && Math.abs(o.fx - c.fx) < 150);
        if (foe && Math.random() < 0.55) { const loser = Math.random() < 0.5 ? c : foe; pose(c, {}); pose(foe, {}); set(c, 'fight', 'is-box'); set(foe, 'fight', 'is-box'); c.win = loser !== c; foe.win = loser !== foe; say(c, '!!', 1000); say(foe, '!!', 1000); }
      }
      c.fightT -= dt;
      if (c.state === 'fight') {
        c.vx = 0;
        if (c.t > 1.3) { if (c.win) { set(c, 'plan', 'is-walk'); say(c, 'get off', 1000); } else { c.descending = true; c.vy = -240; c.vx = -c.side * 90 || 70; set(c, 'fall', 'is-fall'); say(c, 'AAAAH', 1500); } }
      }

      if (c.done && !c.gone) { c.gone = true; c.orig.style.visibility = ''; c.el.hidden = true; if (c.bubble) c.bubble.hidden = true; }
      if (c.bubble) { if (performance.now() > c.sayUntil) c.bubble.hidden = true; else c.bubble.style.transform = 'translate(' + Math.round(c.fx - 12) + 'px,' + Math.round(c.fy - h - 10) + 'px)'; }
      c.el.style.transform = 'translate3d(' + Math.round(c.fx - w / 2) + 'px,' + Math.round(c.fy - h) + 'px,0)';
    }
    if (climbers.length && (climbers.every((c) => c.done) || life > 300)) release();
  }
})();
