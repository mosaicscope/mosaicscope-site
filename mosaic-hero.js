/* Pointer tilt for the hero wordmark, and pause everything while the hero is off screen. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero'), wm = document.querySelector('.hero .wm'); if (!hero || !wm) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  wm.querySelectorAll('.wm__slice').forEach((s, i) => s.style.setProperty('--i', i));
  requestAnimationFrame(() => wm.classList.add('is-live'));
  let tx = 0, ty = 0, raf = 0, on = true;
  const apply = () => { wm.style.setProperty('--wx', tx.toFixed(2) + 'deg'); wm.style.setProperty('--wy', ty.toFixed(2) + 'deg'); raf = 0; };
  hero.addEventListener('pointermove', (e) => { if (!on || e.pointerType !== 'mouse') return; const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 9; ty = -((e.clientY - r.top) / r.height - 0.5) * 7; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
  hero.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
  new IntersectionObserver(([e]) => { on = e.isIntersecting; hero.classList.toggle('is-off', !on); }, { threshold: 0.05 }).observe(hero);
})();
