/* The strip becomes a grimy after-hours club-house photography party: two poles at either end, an AFTER HOURS sign,
   and a crowd that walks on and off: club girls (60+ moves), suits who take their ties off and dance, bros with chains,
   and animals with moving parts. Everyone is generated from a variation generator (hats, hair, gear, size, colour), so
   the crowd is practically endless. 2D only. Crowd size scales with the screen (phones get fewer, smaller people). */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.getElementById('stage');
  if (!stage) return;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
  const sw = () => stage.clientWidth, mobile = () => innerWidth < 600;
  const MM = () => window.MOSAIC_MOVES || { idle: [], dance: [], girls: [] };
  const party = () => stage.classList.contains('is-party') || stage.classList.contains('is-after');

  /* ---------- club dressing: poles, neon sign, grime ---------- */
  const club = document.createElement('div'); club.className = 'ms-club'; club.setAttribute('aria-hidden', 'true');
  const poleSVG = '<svg viewBox="0 0 24 120" width="24" height="112"><path d="M12 6 V108" stroke="#c9ccd1" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M12 6 V108" stroke="#fff" stroke-width="1" opacity=".7" fill="none" transform="translate(-1 0)"/><path d="M3 108 Q12 114 21 108 L21 112 H3 Z" fill="#0e0b0a" stroke="#c9ccd1" stroke-width="2"/><circle cx="12" cy="5" r="3.4" fill="#0e0b0a" stroke="#c9ccd1" stroke-width="2"/></svg>';
  club.innerHTML = '<div class="ms-cpole ms-cpole--l">' + poleSVG + '</div><div class="ms-cpole ms-cpole--r">' + poleSVG + '</div>' +
    '<div class="ms-neon"><svg viewBox="0 0 260 44" width="190" height="32"><text x="130" y="31" text-anchor="middle" fill="none" stroke="#ff2d95" stroke-width="2.4" stroke-linejoin="round" font-family="Big Shoulders Display, Impact, sans-serif" font-weight="900" font-size="34" letter-spacing="3">AFTER HOURS</text></svg><i></i></div>';
  stage.append(club);
  const clubOn = () => stage.classList.toggle('ms-clubon', party());
  setInterval(clubOn, 1200); clubOn();

  /* ---------- variation generator: hats, hair, gear, scale, colour. thousands of combinations ---------- */
  const HATS = ['<path d="M39.5 22 Q50 8 60.5 22 Z" stroke-width="2"/>', '<path d="M41 17 H59 M44 17 V5 H56 V17" stroke-width="2.4"/>', '<path d="M38 20 Q50 12 62 20 H38 Z M62 20 h8" stroke-width="2"/>',
    '<path d="M39 21 H61 M42 21 Q50 9 58 21" stroke-width="2.2"/><path d="M39 21 q-6 2 -8 -2" stroke-width="2"/>', '<path d="M37 19 H63 M43 19 Q50 5 57 19" stroke-width="2.2"/><path d="M37 19 q-4 -4 -2 -7 M63 19 q4 -4 2 -7" stroke-width="2"/>',
    '<path d="M40 19 L43 8 L47 15 L50 6 L53 15 L57 8 L60 19 Z" stroke-width="2"/>', '<path d="M38 22 H62" stroke-width="3"/><path d="M50 22 V16" stroke-width="2"/>', '', '', ''];
  const FACE = ['<path d="M45 33 Q50 40 55 33" stroke-width="2"/>', '<circle cx="45" cy="28" r="4.5" stroke-width="1.6"/>', '<path d="M42 38 Q50 44 58 38" stroke-width="2.2"/>', '', '', ''];
  const GEAR = ['', '', '', '<path d="M68 70 h8 v10 h-8 Z" stroke-width="2"/>', '<path d="M30 54 l-6 14" stroke-width="2.4"/>', '<path d="M42 46 Q50 52 58 46" stroke-width="3"/>'];
  const SUIT = '<path d="M40 50 L50 64 L60 50 L62 82 H38 Z" fill="#0e0b0a" stroke-width="2.4"/><path d="M50 64 V80 M45 82 V66 M55 82 V66" stroke-width="1.2"/><path class="ms-tie" d="M50 52 l-3 7 3 16 3 -16 Z" fill="#ec2a1c" stroke="#ec2a1c" stroke-width="1.4"/><rect x="64" y="72" width="14" height="10" rx="1.5" fill="#0e0b0a" stroke-width="2"/>';
  const CHAIN = '<path d="M41 44 Q50 76 59 44" fill="none" stroke="#f6b62c" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="1.6 2.2"/><rect x="45.5" y="66" width="9" height="9" rx="1.5" fill="#f6b62c" stroke="#9a5a1c" stroke-width="1"/>';
  const g = (inner) => { const e = document.createElementNS(SVGNS, 'g'); e.setAttribute('class', 'ms-acc'); e.innerHTML = inner; return e; };
  function dress(el, role) {
    const top = el.querySelector('.rv__top'), head = el.querySelector('.rv__head'); if (!top || !head) return;
    el.querySelectorAll('.ms-acc, .ms-chain').forEach((n) => n.remove());
    const hat = pick(HATS); if (hat && role !== 'suit') head.append(g(hat));
    if (role === 'suit') { head.append(g('<path d="M40 22 Q50 14 60 22 L58 20 Q50 15 42 20 Z" stroke-width="1.6"/>')); top.append(g(SUIT)); }
    else { const f = pick(FACE); if (f) head.append(g(f)); if (role === 'og' || Math.random() < 0.35) top.append(g(CHAIN)); const x = pick(GEAR); if (x) top.append(g(x)); }
    el.style.setProperty('--vs', (rand(0.86, 1.1)).toFixed(2));
    el.style.filter = 'hue-rotate(' + ((Math.random() * 360) | 0) + 'deg) saturate(' + rand(0.9, 1.4).toFixed(2) + ')';
  }

  /* ---------- people ---------- */
  const people = [];
  const GIRLS = ['Glitter', 'Nova', 'Ruby', 'Lux'], GUYS = ['Tiles', 'Kodak', 'Grain', 'Flash', 'Bando', 'Static'];
  function source(girl) {
    const names = girl ? GIRLS : GUYS, all = [...stage.querySelectorAll('.raver:not(.ms-npc)')];
    return all.find((e) => names.includes(e.dataset.name) && Math.random() < 0.5) || all.find((e) => names.includes(e.dataset.name)) || pick(all);
  }
  const style = (el) => (el.className.match(/st-\w+/) || [''])[0];
  const setPose = (p, cls) => { p.el.className = 'raver ms-npc ' + style(p.el) + (p.left ? ' is-left' : '') + ' ' + cls; };
  function freeX(self) {
    const others = [...stage.querySelectorAll('.raver')].filter((e) => e !== self.el).map((e) => { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); return r.left - s.left + r.width / 2; });
    for (let i = 0; i < 14; i++) { const x = rand(10, sw() - 70); if (others.every((o) => Math.abs(o - (x + 35)) > (mobile() ? 38 : 56))) return x; }
    return null;
  }
  function walk(p, to, cb) {
    const dist = Math.abs(to - p.x), sp = rand(40, 62);
    p.left = to < p.x; setPose(p, 'is-walk');
    p.el.style.transitionDuration = (dist / sp).toFixed(2) + 's'; p.x = to; p.el.style.setProperty('--x', Math.round(to) + 'px');
    p.timer = setTimeout(cb, (dist / sp) * 1000 + 50);
  }
  function spawnPerson(role) {
    const src = source(role === 'girl'); if (!src) return;
    const el = src.cloneNode(true);
    el.removeAttribute('aria-label'); el.setAttribute('tabindex', '-1'); el.setAttribute('aria-hidden', 'true'); el.dataset.name = '';
    el.querySelectorAll('.ms-say, .ms-flash, .ms-puff').forEach((n) => n.remove()); el.__ms = false; el.__watch = false; el.__say = null;
    const fromLeft = Math.random() < 0.5;
    const p = { el, role, x: fromLeft ? -80 : sw() + 20, left: false, born: performance.now(), life: rand(25000, 70000), timer: 0 };
    el.style.setProperty('--x', Math.round(p.x) + 'px'); el.style.transitionDuration = '0s';
    dress(el, role); stage.append(el); people.push(p);
    requestAnimationFrame(() => next(p, true));
  }
  function leave(p) {
    const to = p.x < sw() / 2 ? -90 : sw() + 30; p.leaving = true;
    walk(p, to, () => { clearTimeout(p.timer); p.el.remove(); const i = people.indexOf(p); if (i >= 0) people.splice(i, 1); });
  }
  function next(p, first) {
    if (!p.el.isConnected || p.leaving) return;
    if (performance.now() - p.born > p.life || !party() && !first && Math.random() < 0.5) { leave(p); return; }
    const m = MM(), dance = (list) => 'is-rave d-' + pick(list);
    const hold = (cls, ms) => { setPose(p, cls); p.timer = setTimeout(() => next(p), ms); };
    const roam = Math.random() < 0.5 || first;
    const go = (to, after) => { if (to === null || Math.abs(to - p.x) < 20) { after(); return; } walk(p, to, after); };
    if (p.role === 'girl') {
      const pole = Math.random() < 0.5 ? (Math.random() < 0.5 ? 14 : sw() - 46) : null;       // half of them head for a pole
      go(roam ? (pole !== null ? pole : freeX(p)) : null, () => hold(dance(Math.random() < 0.85 ? m.girls : m.dance), rand(4000, 9000)));
    } else if (p.role === 'suit') {
      go(roam ? freeX(p) : null, () => {
        if (!p.tieOff) { p.tieOff = true; setPose(p, 'is-chill is-tieoff'); p.timer = setTimeout(() => { const t = p.el.querySelector('.ms-tie'); if (t) t.style.display = 'none'; flyTie(p); hold(dance(m.dance), rand(5000, 9000)); }, 1600); }
        else hold(Math.random() < 0.75 ? dance(m.dance) : 'is-' + pick(m.idle), rand(4000, 9000));
      });
    } else {
      go(roam ? freeX(p) : null, () => hold(Math.random() < 0.5 ? 'is-' + pick(m.idle) : dance(m.dance), rand(3500, 8000)));
    }
  }
  function flyTie(p) {
    const t = document.createElement('i'); t.className = 'ms-tiefly'; const r = p.el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    t.style.left = (r.left - s.left + r.width / 2) + 'px'; t.addEventListener('animationend', () => t.remove()); stage.append(t);
  }

  /* ---------- animals: same single-line drawing, moving parts ---------- */
  const A = (cls, body) => '<svg viewBox="0 0 64 44" width="62" height="42" class="ms-animal__svg"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + body + '</g></svg>';
  const legs = (xs, y0, y1, c) => xs.map((x, i) => '<g class="a-leg a-leg' + (i % 2) + '"><path d="M' + x + ' ' + y0 + ' V' + y1 + '"/></g>').join('');
  const ANIMALS = {
    dog: A('', '<path d="M14 18 Q14 11 22 11 H38 Q45 11 45 18 V22 H14 Z"/><circle cx="51" cy="12" r="5"/><path d="M55 13 h5"/><g class="a-ear"><path d="M48 8 l-3 -5 l6 3"/></g><g class="a-tail"><path d="M14 14 Q6 9 4 4"/></g>' + legs([18, 24, 36, 42], 22, 36)),
    cat: A('', '<path d="M12 22 Q12 14 22 14 H40 Q46 14 46 20 V24 H12 Z"/><circle cx="51" cy="15" r="4.6"/><path d="M48 11 l1 -5 l3 3 l3 -3 l1 5"/><g class="a-tail"><path d="M12 18 Q2 18 4 8 Q6 4 3 2"/></g>' + legs([17, 23, 36, 42], 24, 36)),
    pigeon: A('', '<path d="M18 22 Q18 12 30 12 Q42 12 42 22 Q42 28 30 28 Q18 28 18 22 Z"/><g class="a-head"><circle cx="46" cy="12" r="4"/><path d="M50 12 l5 1"/></g><g class="a-wing"><path d="M24 18 Q30 14 36 20"/></g><path d="M18 20 L8 26"/>' + legs([27, 33], 28, 38)),
    rat: A('', '<path d="M12 28 Q14 20 24 20 H38 Q46 22 50 26 Q46 30 38 30 H14 Z"/><circle cx="51" cy="26" r="2"/><path d="M48 21 l1 -4 l3 3"/><g class="a-tail"><path d="M12 28 Q4 26 2 32 Q0 38 6 38"/></g>' + legs([20, 28, 36, 42], 30, 36)),
    frog: A('', '<path d="M16 26 Q16 16 30 16 Q44 16 44 26 Q44 32 30 32 Q16 32 16 26 Z"/><circle cx="40" cy="14" r="3"/><circle cx="46" cy="15" r="3"/><g class="a-leg a-leg0"><path d="M20 30 L12 38 L8 36"/></g><g class="a-leg a-leg1"><path d="M40 30 L48 38 L52 36"/></g>'),
    crab: A('', '<path d="M18 26 Q18 18 32 18 Q46 18 46 26 Q46 32 32 32 Q18 32 18 26 Z"/><g class="a-claw a-claw0"><path d="M18 22 L8 14 Q4 10 8 8 M8 14 Q12 10 10 8"/></g><g class="a-claw a-claw1"><path d="M46 22 L56 14 Q60 10 56 8 M56 14 Q52 10 54 8"/></g>' + legs([22, 28, 36, 42], 32, 38)),
    fox: A('', '<path d="M12 22 Q12 14 22 14 H38 Q44 14 44 20 V24 H12 Z"/><path d="M44 16 L54 14 L58 18 L50 22 Z"/><path d="M44 14 l2 -6 l4 4"/><g class="a-tail"><path d="M12 18 Q2 12 4 4 Q10 6 12 12" fill="currentColor" fill-opacity=".25"/></g>' + legs([17, 23, 34, 40], 24, 37)),
    duck: A('', '<path d="M14 24 Q14 14 28 14 Q40 14 40 24 Q40 30 26 30 Q14 30 14 24 Z"/><g class="a-head"><circle cx="42" cy="10" r="4"/><path d="M46 10 l6 2 l-6 2"/></g><g class="a-wing"><path d="M20 20 Q27 16 32 22"/></g>' + legs([22, 30], 30, 38))
  };
  const colors = ['#c6ff3d', '#ff7ad9', '#3dd6ff', '#f6b62c', '#eee4d3', '#b48cff', '#ff9a3d'];
  function spawnAnimal() {
    const kind = pick(Object.keys(ANIMALS)), el = document.createElement('div');
    el.className = 'ms-animal ms-animal--' + kind; el.innerHTML = ANIMALS[kind]; el.style.color = pick(colors);
    const fromLeft = Math.random() < 0.5, W = sw(), x0 = fromLeft ? -70 : W + 10, x1 = fromLeft ? W + 10 : -70;
    if (!fromLeft) el.classList.add('is-flip');
    el.style.setProperty('--ax', x0 + 'px'); stage.append(el);
    const dur = rand(7, 16);
    requestAnimationFrame(() => { el.style.transitionDuration = dur + 's'; el.style.setProperty('--ax', x1 + 'px'); });
    setTimeout(() => el.remove(), dur * 1000 + 300);
  }

  /* ---------- the scheduler ---------- */
  setInterval(() => {
    if (document.hidden) return;
    const target = party() ? (mobile() ? 5 : Math.min(15, Math.floor(sw() / 95))) : (mobile() ? 0 : 2);
    if (people.length < target && Math.random() < 0.7) {
      const r = Math.random();
      spawnPerson(r < 0.5 ? 'girl' : r < 0.72 ? 'suit' : r < 0.88 ? 'bro' : 'og');
    }
    if (!party() && people.length > target) leave(people[(Math.random() * people.length) | 0]);
  }, 1400);
  setInterval(() => { if (!document.hidden && Math.random() < 0.55) spawnAnimal(); }, 9000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { people.forEach((p) => { clearTimeout(p.timer); p.el.remove(); }); people.length = 0; } });
})();
