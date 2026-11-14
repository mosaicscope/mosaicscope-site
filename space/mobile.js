/* mosaicSpace touch layer. Plain DOM only: it clicks the editor's own buttons and sliders, so every touch action is the same code path as the mouse one. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s), bin = $('#bin'), insp = $('#insp'); if (!bin || !insp) return;
  const bar = document.createElement('nav'); bar.id = 'msbar'; bar.setAttribute('aria-label', 'Editor tools');
  bar.innerHTML = [['media', '▤', 'Media'], ['edit', '☰', 'Edit'], ['add', '＋', 'Add'], ['split', '✂', 'Split'], ['del', '⌫', 'Delete'], ['undo', '↶', 'Undo'], ['rec', '●', 'Rec'], ['play', '▶', 'Play']].map(([k, i, l]) => '<button type="button" data-k="' + k + '" aria-label="' + l + '"><b>' + i + '</b>' + l + '</button>').join('');
  document.body.append(bar);
  const sheet = (el, btn) => { const open = !el.classList.contains('is-open'); bin.classList.remove('is-open'); insp.classList.remove('is-open'); bar.querySelectorAll('[data-k=media],[data-k=edit]').forEach((b) => b.classList.remove('on')); if (open) { el.classList.add('is-open'); btn.classList.add('on'); } };
  const press = (sel) => { const e = $(sel); if (e) e.click(); };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
    if (k === 'media') sheet(bin, b); else if (k === 'edit') sheet(insp, b);
    else if (k === 'add') { bin.classList.remove('is-open'); insp.classList.remove('is-open'); press('#addmedia'); }
    else if (k === 'split') press('#split'); else if (k === 'del') press('#del'); else if (k === 'undo') press('#undo'); else if (k === 'play') press('#play'); else if (k === 'rec') press('#rec');
  });
  /* selecting a clip opens its settings sheet on tap-and-hold (400 ms), so a normal tap or drag still just selects / moves */
  let hold = 0; const lanes = $('#lanes');
  lanes.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || !e.target.closest('.clip')) return; clearTimeout(hold); hold = setTimeout(() => { sheet(insp, bar.querySelector('[data-k=edit]')); if (navigator.vibrate) try { navigator.vibrate(20); } catch (er) { /* needs a tap */ } }, 420); });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((t) => lanes.addEventListener(t, (e) => { if (t === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return; clearTimeout(hold); }));
  /* pinch to zoom the timeline: two fingers on the lanes drive the zoom slider */
  const sc = $('#scroll'), zoom = $('#zoom'), ptr = new Map(); let d0 = 0, z0 = 0;
  const dist = () => { const [a, b] = [...ptr.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  sc.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 2) { d0 = dist(); z0 = +zoom.value; } });
  sc.addEventListener('pointermove', (e) => { if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 2) { const z = Math.max(10, Math.min(400, z0 * dist() / d0)); zoom.value = z; zoom.dispatchEvent(new Event('input', { bubbles: true })); } });
  ['pointerup', 'pointercancel'].forEach((t) => sc.addEventListener(t, (e) => ptr.delete(e.pointerId)));
  /* the play button label follows the transport so the bar always shows the right action */
  const pb = $('#play'), tb = bar.querySelector('[data-k=play]'); if (pb) new MutationObserver(() => { tb.innerHTML = '<b>' + pb.textContent + '</b>' + (pb.textContent.includes('▶') ? 'Play' : 'Pause'); }).observe(pb, { childList: true, characterData: true, subtree: true });
})();
