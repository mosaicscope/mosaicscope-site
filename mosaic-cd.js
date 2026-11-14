/* A tiny early-2000s portable CD player resting in the corner of the black sign band. It clicks like the real thing (button, lid, spin-up) and a tap opens the iPhone passcode. */
(() => {
  'use strict';
  const band = document.getElementById('studio'); if (!band) return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cdp'; b.setAttribute('aria-label', 'CD player');
  b.innerHTML = '<svg viewBox="0 0 100 96" aria-hidden="true"><defs>' +
    '<linearGradient id="cdBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f3f6"/><stop offset=".5" stop-color="#b7bcc5"/><stop offset="1" stop-color="#868c97"/></linearGradient>' +
    '<linearGradient id="cdDisc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffdd9a"/><stop offset=".25" stop-color="#9be7ff"/><stop offset=".5" stop-color="#e7a2ff"/><stop offset=".75" stop-color="#b7ffc4"/><stop offset="1" stop-color="#ffd0a0"/></linearGradient>' +
    '<radialGradient id="cdGlass" cx=".35" cy=".28" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset=".4" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".25"/></radialGradient></defs>' +
    '<ellipse cx="50" cy="91" rx="40" ry="4" fill="#000" opacity=".35"/>' +
    '<rect x="4" y="4" width="92" height="84" rx="16" fill="url(#cdBody)" stroke="#5b616b" stroke-width="1.4"/>' +
    '<rect x="9" y="9" width="82" height="74" rx="12" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>' +
    '<circle cx="50" cy="44" r="33" fill="#2a2d33" stroke="#4a4f58" stroke-width="2"/>' +
    '<g class="cdp__disc"><circle cx="50" cy="44" r="29" fill="url(#cdDisc)"/><circle cx="50" cy="44" r="29" fill="none" stroke="#fff" stroke-opacity=".35"/><circle cx="50" cy="44" r="21" fill="none" stroke="#000" stroke-opacity=".12"/><circle cx="50" cy="44" r="10" fill="#d7dae0"/><circle cx="50" cy="44" r="4" fill="#2a2d33"/><path d="M50 15 A29 29 0 0 1 79 44" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/></g>' +
    '<circle cx="50" cy="44" r="33" fill="url(#cdGlass)"/>' +
    '<rect x="12" y="72" width="22" height="9" rx="2.5" fill="#1b2b1f"/><text x="23" y="79.4" text-anchor="middle" font-family="monospace" font-size="6.4" fill="#78f0a0">01 ▶</text>' +
    '<g class="cdp__btns" fill="#4c525c"><rect x="42" y="72" width="9" height="9" rx="2.5"/><rect x="54" y="72" width="9" height="9" rx="2.5"/><rect x="66" y="72" width="9" height="9" rx="2.5"/><rect x="78" y="72" width="9" height="9" rx="2.5"/></g>' +
    '<g fill="#d7dae0" font-size="5" font-family="sans-serif" text-anchor="middle"><path d="M45 74.5 l4 2.5 -4 2.5z"/><rect x="57.4" y="75" width="3.2" height="4"/><rect x="69.4" y="75" width="4.2" height="4"/><path d="M81 75 l3 2 -3 2z M84 75 l3 2 -3 2z"/></g>' +
    '<circle cx="86" cy="14" r="2.6" fill="#6d737e"/><rect x="12" y="11" width="18" height="4" rx="2" fill="#8b919b"/></svg>';
  band.append(b);
  /* ---- sound: all synthesised, no files ---- */
  let ac = null; const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
  const burst = (t, dur, f, q, gain) => { const c = ctx(), n = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = n; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t); };
  const thump = (t, f, dur, gain) => { const c = ctx(), o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02); };
  const clickDown = () => { try { const c = ctx(), t = c.currentTime + 0.002; if (c.state === 'suspended') c.resume(); burst(t, 0.012, 2600, 2.2, 0.5); thump(t, 130, 0.03, 0.25); } catch (e) { /* no audio */ } };
  const clickUp = () => { try { const c = ctx(), t = c.currentTime + 0.002; burst(t, 0.008, 3600, 2.6, 0.32); thump(t, 95, 0.02, 0.12); } catch (e) { /* no audio */ } };
  const spinUp = () => { try { const c = ctx(), t = c.currentTime + 0.06, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(210, t + 0.45); f.type = 'lowpass'; f.frequency.value = 520; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(f); f.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.6); burst(t + 0.5, 0.01, 1800, 1.5, 0.3); } catch (e) { /* no audio */ } };
  let fast = 0;
  b.addEventListener('pointerdown', () => { b.classList.add('is-down'); clickDown(); });
  const up = () => { if (b.classList.contains('is-down')) { b.classList.remove('is-down'); clickUp(); } };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  b.addEventListener('click', () => { spinUp(); b.classList.add('is-spin'); clearTimeout(fast); fast = setTimeout(() => b.classList.remove('is-spin'), REDUCED ? 300 : 1500); setTimeout(() => { if (window.MS_OPEN_LOCK) window.MS_OPEN_LOCK('beats'); }, REDUCED ? 100 : 420); });
})();
