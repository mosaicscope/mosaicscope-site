/* A tiny Blender-rendered Nikon D750 left on the corner of the Polaroid board. No label, no hint.
   It is a toy: drag it and it turns like a real 3D object (body, prism and lens sit at different depths), fling it and it
   swings on a spring, the lens glint follows the cursor. A plain click opens the phone lock; 7500 opens mosaicSpace. */
(() => {
  'use strict';
  const sec = document.getElementById('instagram'), board = document.getElementById('ig-board'); if (!sec || !board) return;
  const BASE = '/assets/d750/';
  const a = document.createElement('button');
  a.type = 'button'; a.className = 'd750'; a.setAttribute('aria-label', 'Camera');
  a.innerHTML = '<span class="d750__3d">' +
    '<img class="dl" style="--z:0px" alt="" draggable="false" src="' + BASE + 'body.webp">' +
    '<img class="dl" style="--z:9px" alt="" draggable="false" src="' + BASE + 'top.webp">' +
    '<img class="dl" style="--z:20px" alt="" draggable="false" src="' + BASE + 'lens.webp">' +
    '<span class="d750__glass"><i></i></span></span>';
  sec.append(a);
  const rig = a.querySelector('.d750__3d');
  /* sit on the bottom-right corner of the board, small enough to miss */
  function place() { const s = sec.getBoundingClientRect(), b = board.getBoundingClientRect(), w = a.offsetWidth; a.style.left = Math.max(0, b.right - s.left - w * 0.9) + 'px'; a.style.top = Math.max(0, b.bottom - s.top - a.offsetHeight * 0.8) + 'px'; }
  new ResizeObserver(place).observe(board); addEventListener('resize', place); setTimeout(place, 600); setTimeout(place, 2500);

  /* ---- toy physics: a trackball with inertia, a spring back to rest and soft stops ---- */
  let rx = 0, ry = 0, vx = 0, vy = 0, px = 0, py = 0, aimX = 0, aimY = 0, dragging = false, moved = 0, lx = 0, ly = 0, raf = 0;
  const LIM = 78;
  function frame() {
    if (!dragging) {
      vx += -rx * 0.035; vy += -ry * 0.035;                                   // spring toward rest
      vx *= 0.93; vy *= 0.93; rx += vx; ry += vy;
      if (Math.abs(ry) > LIM) { ry = Math.sign(ry) * LIM; vy *= -0.55; }
      if (Math.abs(rx) > LIM) { rx = Math.sign(rx) * LIM; vx *= -0.55; }
    }
    const tiltX = rx + (dragging ? 0 : -aimY * 6), tiltY = ry + (dragging ? 0 : aimX * 8);
    rig.style.transform = 'translate(' + (px * 0.2).toFixed(2) + 'px,' + (py * 0.2).toFixed(2) + 'px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';
    a.style.setProperty('--mx', (aimX + ry / 40).toFixed(3)); a.style.setProperty('--my', (aimY - rx / 40).toFixed(3));
    const live = dragging || Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(rx) + Math.abs(ry) > 0.05;
    raf = live ? requestAnimationFrame(frame) : 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  a.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; vx = vy = 0; try { a.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } wake(); });
  a.addEventListener('pointermove', (e) => {
    if (!dragging) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    ry += dx * 1.1; rx -= dy * 1.1; vy = dx * 1.1; vx = -dy * 1.1; px += dx; py += dy; px *= 0.9; py *= 0.9;
    ry = Math.max(-LIM * 1.15, Math.min(LIM * 1.15, ry)); rx = Math.max(-LIM * 1.15, Math.min(LIM * 1.15, rx));
  });
  const up = () => { if (!dragging) return; dragging = false; px = py = 0; wake(); };
  a.addEventListener('pointerup', up); a.addEventListener('pointercancel', up);
  a.addEventListener('click', () => { if (moved < 6 && window.MS_OPEN_LOCK) window.MS_OPEN_LOCK(); });
  /* the lens notices the cursor from anywhere on the page */
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || dragging) return; const r = a.getBoundingClientRect(); aimX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 420)); aimY = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 420)); wake(); }, { passive: true });
})();
