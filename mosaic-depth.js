/* The strip at the bottom has depth: the Mosaics slowly drift closer to and further from the camera. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.getElementById('stage');
  if (!stage) return;
  const rand = (a, b) => a + Math.random() * (b - a);
  const done = new WeakSet();
  function addDepth(el) {
    if (done.has(el)) return; done.add(el);
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
})();
