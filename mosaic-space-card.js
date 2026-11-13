/* A Blender-rendered Nikon D750 sitting in the bottom-right corner of the Polaroid board.
   Idle: the lens is reactive (leans toward the cursor, a soft-box glint slides across the glass).
   Hover / tap once: it comes apart into an exploded diagram that stays inside its own box (no spill onto the page):
   top plate, body and lens stacked on the left, the internals in a labelled grid on the right.
   Click / tap again opens mosaicSpace. */
(() => {
  'use strict';
  const sec = document.getElementById('instagram'), board = document.getElementById('ig-board'); if (!sec || !board) return;
  const BASE = '/assets/d750/', EXT = 'webp';
  /* name, natural centre (% of box), target centre (% of box), scale when exploded, label */
  const PARTS = [
    ['top', 51, 20, 12, 14, 0.3, 'TOP PLATE'],
    ['body', 50, 55, 34, 14, 0.3, 'BODY'],
    ['lens', 49, 61.5, 14, 39, 0.3, 'NIKKOR LENS'],
    ['battery', 28.3, 65.3, 40, 39, 0.5, 'EN-EL15'],
    ['prism', 51, 17, 58, 14, 0.55, 'PENTAPRISM'],
    ['mirror', 48.6, 48, 74, 14, 0.55, 'REFLEX MIRROR'],
    ['board', 46.6, 56.4, 90, 14, 0.55, 'EXPEED 4'],
    ['lcd', 48.6, 61.5, 58, 38, 0.55, 'TILTING LCD'],
    ['shutter', 48.6, 60.2, 74, 38, 0.55, 'SHUTTER'],
    ['sensor', 48.6, 60.2, 90, 38, 0.55, 'FX SENSOR']
  ];
  const INNER = new Set(['prism', 'mirror', 'board', 'lcd', 'shutter', 'sensor', 'battery']);
  const a = document.createElement('a');
  a.className = 'd750'; a.href = '/space/'; a.setAttribute('aria-label', 'Nikon D750. Hover to see inside. Click to open mosaicSpace, the video and audio editor');
  let h = '';
  const order = ['prism', 'mirror', 'board', 'lcd', 'shutter', 'sensor', 'battery', 'body', 'top', 'lens'];
  for (const n of order) {
    const [, cx, cy, tx, ty, s] = PARTS.find((p) => p[0] === n);
    const dx = tx - 50 - (cx - 50) * s, dy = ty - 50 - (cy - 50) * s;       // translate so the part's centre lands on its target after scaling about the box centre
    h += '<img class="dpart ' + (INNER.has(n) ? 'in' : 'sh') + '" data-p="' + n + '" alt="" decoding="async" src="' + BASE + n + '.' + EXT + '" style="--dx:' + dx.toFixed(2) + '%;--dy:' + dy.toFixed(2) + '%;--s:' + s + '">';
  }
  h += '<span class="d750__glass"><i></i></span>';
  for (const [n, , , tx, ty, , l] of PARTS) h += '<span class="dlab mono" style="left:' + tx + '%;top:' + (ty + (INNER.has(n) ? 10 : 12)) + '%">' + l + '</span>';
  h += '<span class="d750__tag mono">mosaicSpace ↗</span>';
  a.innerHTML = h; sec.append(a);
  /* sit in the board's bottom-right corner, like it was put down on the table with the prints */
  function place() { const s = sec.getBoundingClientRect(), b = board.getBoundingClientRect(), w = a.offsetWidth; a.style.left = Math.max(0, b.right - s.left - w * 0.97) + 'px'; a.style.top = Math.max(0, b.top - s.top - a.offsetHeight * 0.1) + 'px'; }
  new ResizeObserver(place).observe(board); addEventListener('resize', place); setTimeout(place, 600); setTimeout(place, 2500);
  /* reactive lens: the lens leans toward the pointer and a soft-box glint slides across the glass */
  const glass = a.querySelector('.d750__glass');
  let raf = 0, tx = 0, ty = 0, mx = 0, my = 0;
  const loop = () => { mx += (tx - mx) * 0.14; my += (ty - my) * 0.14; a.style.setProperty('--mx', mx.toFixed(3)); a.style.setProperty('--my', my.toFixed(3)); raf = Math.abs(tx - mx) + Math.abs(ty - my) > 0.002 ? requestAnimationFrame(loop) : 0; };
  const aim = (x, y) => { const r = glass.getBoundingClientRect(); tx = Math.max(-1.6, Math.min(1.6, (x - (r.left + r.width / 2)) / (r.width * 0.9))); ty = Math.max(-1.6, Math.min(1.6, (y - (r.top + r.height / 2)) / (r.height * 0.9))); if (!raf) raf = requestAnimationFrame(loop); };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY); }, { passive: true });
  addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; tx = Math.max(-1, Math.min(1, e.gamma / 30)); ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
  let armed = false;
  const open = (on) => a.classList.toggle('is-open', on);
  a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(true); }); a.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') open(false); });
  a.addEventListener('focus', () => open(true)); a.addEventListener('blur', () => open(false));
  a.addEventListener('click', (e) => { if (matchMedia('(hover: none)').matches && !armed) { e.preventDefault(); armed = true; open(true); setTimeout(() => { armed = false; open(false); }, 6000); } });
})();
