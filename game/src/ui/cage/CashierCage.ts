// @ts-nocheck
/**
 * The Tessera's Cashier's Cage: a 3D counter where chips are bought, cashed out, marked and exchanged.
 * Ported from the standalone cage prototype. The scene, the PBR textures and the chip physics are kept exactly as
 * authored; the money layer and the controls are rewritten to use the casino's own wallet and credit (see CageHost),
 * so every chip on the felt is a chip in the player's balance. This file is deliberately untyped (like the prototype).
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** What the cage needs from the casino. All money moves through these, nothing is kept in the scene. */
export interface CageHost {
  cash(): number; setCash(n: number): void;
  chips(): number; setChips(n: number): void;
  /** Running totals for the "walked out up / down" line. */
  bought(n: number): void; cashedOut(n: number): void;
  /** The casino's single marker (bank credit): amount owed incl. interest, issue, settle. */
  debt(): number; borrow(n: number): number; settle(): void;
  changed(): void;
}
export interface CageView { el: HTMLElement; failed: boolean }

const MARKUP = `
<div class="cage-bar">
  <div class="cage-brand"><i class="cage-dot"></i><b>MOSAIC CASINO</b><span>//</span><em>CAGE</em></div>
  <div class="cage-read" aria-live="polite">
    <span><small>Cash</small><b data-hud="cash" class="c-cash">$0</b></span>
    <span><small>Chips</small><b data-hud="chips" class="c-chips">$0</b></span>
    <span><small>Debt</small><b data-hud="debt" class="c-debt">$0</b></span>
  </div>
  <div class="cage-cams" role="group" aria-label="Camera angle">
    <button type="button" data-cam="counter" class="on">Counter</button>
    <button type="button" data-cam="felt">Felt</button>
    <button type="button" data-cam="vault">Vault</button>
    <button type="button" data-act="mute" aria-label="Toggle sound" title="Toggle sound">
      <svg class="icon-sound-on" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
      <svg class="icon-sound-off hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
    </button>
  </div>
</div>
<div class="cage-stage"><div class="cage-toasts" aria-live="polite"></div></div>
<div class="cage-dock">
  <div class="cage-toys" role="group" aria-label="Chip toys">
    <button type="button" data-act="stack">Stack</button>
    <button type="button" data-act="riffle">Riffle</button>
    <button type="button" data-act="scatter">Scatter</button>
    <button type="button" data-act="tower">Tower</button>
    <button type="button" data-act="vault">Vault wheel</button>
  </div>
  <div class="cage-tabs" role="tablist" aria-label="Cashier service">
    <button type="button" role="tab" data-mode="buy" class="on">Buy</button>
    <button type="button" role="tab" data-mode="sell">Cash out</button>
    <button type="button" role="tab" data-mode="marker">Marker</button>
    <button type="button" role="tab" data-mode="exchange">Exchange</button>
  </div>
  <div class="cage-strip"></div>
</div>`;

export function createCage(host: CageHost): CageView {
  const root = document.createElement("section");
  root.className = "cage";
  root.setAttribute("aria-label", "Cashier's cage: buy chips, cash out, take a marker or exchange chips");
  root.innerHTML = MARKUP;
  const stageEl = root.querySelector(".cage-stage");
  const view: CageView = { el: root, failed: false };
  try {
    build();
  } catch (e) {
    view.failed = true;
    console.warn("Cashier's cage needs WebGL", e);
  }
  return view;

  function build() {
    // =========================================================================
    // 1. JEWEL-TONE "BRIGHT-BUT-DARK" CHIP & PLAQUE SPECIFICATIONS
    // =========================================================================
    const CHIP_SPECS = [
      {
        value: 10,
        label: '$10',
        name: 'Obsidian & Electric Cyan',
        type: 'chip',
        baseDark: '#090d16',
        baseMid: '#101828',
        vividPrimary: '#06b6d4',   // Electric Cyan
        vividSecondary: '#3b82f6', // Cobalt
        foilColor: '#bae6fd',
        pattern: 'filigree',
        iridescence: 0.55,
        metalness: 0.52,
        roughness: 0.36,
        radius: 0.215,
        height: 0.044
      },
      {
        value: 25,
        label: '$25',
        name: 'Velvet Forest & Luminous Emerald',
        type: 'chip',
        baseDark: '#051b14',
        baseMid: '#0a2e22',
        vividPrimary: '#10b981',   // Luminous Emerald
        vividSecondary: '#d4af37', // Antique Gold
        foilColor: '#fef08a',
        pattern: 'mandala',
        iridescence: 0.45,
        metalness: 0.48,
        roughness: 0.38,
        radius: 0.218,
        height: 0.045
      },
      {
        value: 100,
        label: '$100',
        name: 'Pitch Charcoal & Molten Ruby',
        type: 'chip',
        baseDark: '#12080c',
        baseMid: '#1f0d14',
        vividPrimary: '#f43f5e',   // Molten Ruby Crimson
        vividSecondary: '#fb7185', // Rose Gold
        foilColor: '#fecdd3',
        pattern: 'mosaic',
        iridescence: 0.58,
        metalness: 0.56,
        roughness: 0.32,
        radius: 0.222,
        height: 0.046
      },
      {
        value: 500,
        label: '$500',
        name: 'Imperial Plum & Vivid Amethyst',
        type: 'chip',
        baseDark: '#140724',
        baseMid: '#240b42',
        vividPrimary: '#c084fc',   // Vivid Amethyst
        vividSecondary: '#e879f9', // Iridescent Violet
        foilColor: '#f5d0fe',
        pattern: 'rosette',
        iridescence: 0.92,
        metalness: 0.68,
        roughness: 0.25,
        radius: 0.228,
        height: 0.048
      },
      {
        value: 1000,
        label: '$1K',
        name: 'Smoked Espresso & Molten Amber',
        type: 'chip',
        baseDark: '#140c05',
        baseMid: '#241608',
        vividPrimary: '#f59e0b',   // Molten Amber
        vividSecondary: '#fde047', // Burnished Gold
        foilColor: '#fef3c7',
        pattern: 'sunburst',
        iridescence: 0.8,
        metalness: 0.76,
        roughness: 0.22,
        radius: 0.242,
        height: 0.052
      },
      {
        value: 5000,
        label: '$5K',
        name: 'Smoked Titanium Chromatic Plaque',
        type: 'plaque',
        baseDark: '#0a0e17',
        baseMid: '#161e2e',
        vividPrimary: '#10b981',
        vividSecondary: '#e879f9',
        foilColor: '#f8fafc',
        pattern: 'plaque',
        iridescence: 1.0,
        metalness: 0.92,
        roughness: 0.16,
        width: 0.64,
        depth: 0.40,
        height: 0.054
      }
    ];

    // =========================================================================
    // 2. PROCEDURAL WEB AUDIO ENGINE (CLAY CLACKS, METALLIC CLINKS, GEARS)
    // =========================================================================
    class SoundEngine {
      constructor() {
        this.ctx = null;
        this.muted = false;
        this.lastClink = 0;
      }

      init() {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        root.querySelectorAll('.icon-sound-on').forEach(el => el.classList.toggle('hidden', this.muted));
        root.querySelectorAll('.icon-sound-off').forEach(el => el.classList.toggle('hidden', !this.muted));
        return this.muted;
      }

      playChipClack(intensity = 0.5, isPlaque = false) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        if (now - this.lastClink < 0.018) return;
        this.lastClink = now;

        const vol = Math.min(0.28, Math.max(0.018, intensity * 0.17));
        const baseFreq = isPlaque
          ? 2150 + Math.random() * 520
          : 3300 + Math.random() * 950;

        // Crisp clay-composite click transient
        const osc1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        osc1.type = isPlaque ? 'triangle' : 'sine';
        osc1.frequency.setValueAtTime(baseFreq, now);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.68, now + 0.048);
        g1.gain.setValueAtTime(vol, now);
        g1.gain.exponentialRampToValueAtTime(0.0008, now + 0.058);

        // Resonant overtone
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 1.58, now);
        g2.gain.setValueAtTime(vol * 0.42, now);
        g2.gain.exponentialRampToValueAtTime(0.0008, now + 0.028);

        osc1.connect(g1).connect(this.ctx.destination);
        osc2.connect(g2).connect(this.ctx.destination);
        osc1.start(now); osc1.stop(now + 0.062);
        osc2.start(now); osc2.stop(now + 0.032);
      }

      playTraySlide() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const dur = 0.26;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.48));

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1900, now);
        bp.frequency.exponentialRampToValueAtTime(3400, now + dur);
        bp.Q.value = 3.8;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.13, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(bp).connect(g).connect(this.ctx.destination);
        src.start(now);
      }

      playCashRustle() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          const t = now + i * 0.05;
          const dur = 0.042;
          const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.sin((j / d.length) * Math.PI);
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const hp = this.ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 1350 + i * 240;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.11, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur);
          src.connect(hp).connect(g).connect(this.ctx.destination);
          src.start(t);
        }
      }

      playStampThud() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const sub = this.ctx.createOscillator();
        const sg = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(36, now + 0.24);
        sg.gain.setValueAtTime(0.45, now);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        const slap = this.ctx.createOscillator();
        const slg = this.ctx.createGain();
        slap.type = 'triangle';
        slap.frequency.setValueAtTime(680, now);
        slap.frequency.exponentialRampToValueAtTime(160, now + 0.075);
        slg.gain.setValueAtTime(0.24, now);
        slg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

        sub.connect(sg).connect(this.ctx.destination);
        slap.connect(slg).connect(this.ctx.destination);
        sub.start(now); sub.stop(now + 0.3);
        slap.start(now); slap.stop(now + 0.09);
      }

      playVaultGears() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Low heavy steel rumble + rhythmic gear clicks
        const rumble = this.ctx.createOscillator();
        const rg = this.ctx.createGain();
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        rumble.type = 'sawtooth';
        rumble.frequency.setValueAtTime(68, now);
        rumble.frequency.linearRampToValueAtTime(52, now + 0.9);
        rg.gain.setValueAtTime(0.16, now);
        rg.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        rumble.connect(lp).connect(rg).connect(this.ctx.destination);
        rumble.start(now); rumble.stop(now + 0.98);

        for (let k = 0; k < 6; k++) {
          const t = now + k * 0.11;
          const cl = this.ctx.createOscillator();
          const cg = this.ctx.createGain();
          cl.type = 'triangle';
          cl.frequency.setValueAtTime(420 + k * 45, t);
          cl.frequency.exponentialRampToValueAtTime(140, t + 0.06);
          cg.gain.setValueAtTime(0.12, t);
          cg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          cl.connect(cg).connect(this.ctx.destination);
          cl.start(t); cl.stop(t + 0.08);
        }
      }
    }

    const sound = new SoundEngine();

    // =========================================================================
    // 3. PROFOUND PROCEDURAL PBR TEXTURE GENERATORS (COLOR + BUMP + ROUGHNESS)
    // =========================================================================
    function createWalnutPBR() {
      const S = 512;
      const cCol = document.createElement('canvas'); cCol.width = cCol.height = S;
      const cBmp = document.createElement('canvas'); cBmp.width = cBmp.height = S;
      const cRgh = document.createElement('canvas'); cRgh.width = cRgh.height = S;
      const ctx = cCol.getContext('2d');
      const bctx = cBmp.getContext('2d');
      const rctx = cRgh.getContext('2d');

      ctx.fillStyle = '#1b0f0a'; ctx.fillRect(0, 0, S, S);
      bctx.fillStyle = '#808080'; bctx.fillRect(0, 0, S, S);
      rctx.fillStyle = '#5a5a5a'; rctx.fillRect(0, 0, S, S);

      // Figured walnut grain bands
      for (let i = 0; i < 320; i++) {
        const y = Math.random() * S;
        const w = 0.8 + Math.random() * 4.5;
        const dark = Math.random() > 0.36;
        const a = 0.08 + Math.random() * 0.2;
        const cp1 = y + (Math.random() - 0.5) * 28;
        const cp2 = y + (Math.random() - 0.5) * 28;

        ctx.strokeStyle = dark ? `rgba(8, 4, 2, ${a})` : `rgba(68, 38, 20, ${a})`;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(S * 0.33, cp1, S * 0.66, cp2, S, y); ctx.stroke();

        bctx.strokeStyle = dark ? `rgba(38,38,38,${a})` : `rgba(185,185,185,${a})`;
        bctx.lineWidth = w;
        bctx.beginPath(); bctx.moveTo(0, y); bctx.bezierCurveTo(S * 0.33, cp1, S * 0.66, cp2, S, y); bctx.stroke();

        rctx.strokeStyle = dark ? `rgba(120,120,120,${a})` : `rgba(70,70,70,${a})`;
        rctx.lineWidth = w;
        rctx.beginPath(); rctx.moveTo(0, y); rctx.bezierCurveTo(S * 0.33, cp1, S * 0.66, cp2, S, y); rctx.stroke();
      }

      // Organic knots
      for (let k = 0; k < 4; k++) {
        const kx = 60 + Math.random() * (S - 120);
        const ky = 60 + Math.random() * (S - 120);
        const kr = 14 + Math.random() * 24;
        const g = ctx.createRadialGradient(kx, ky, 2, kx, ky, kr);
        g.addColorStop(0, 'rgba(5, 2, 1, 0.85)');
        g.addColorStop(0.55, 'rgba(42, 22, 11, 0.45)');
        g.addColorStop(1, 'rgba(27, 15, 10, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(kx, ky, kr * 1.6, kr * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Fine wood pores
      for (let p = 0; p < 1800; p++) {
        const px = Math.random() * S, py = Math.random() * S;
        const pl = 3 + Math.random() * 9;
        ctx.fillStyle = 'rgba(6, 3, 1, 0.42)';
        ctx.fillRect(px, py, pl, 1);
        bctx.fillStyle = 'rgba(20, 20, 20, 0.55)';
        bctx.fillRect(px, py, pl, 1);
        rctx.fillStyle = 'rgba(180, 180, 180, 0.5)';
        rctx.fillRect(px, py, pl, 1);
      }

      const wrap = (t, isSRGB) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 2);
        if (isSRGB) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      return {
        map: wrap(new THREE.CanvasTexture(cCol), true),
        bumpMap: wrap(new THREE.CanvasTexture(cBmp), false),
        roughnessMap: wrap(new THREE.CanvasTexture(cRgh), false)
      };
    }

    function createHammeredMetalPBR() {
      const S = 512;
      const cBmp = document.createElement('canvas'); cBmp.width = cBmp.height = S;
      const cRgh = document.createElement('canvas'); cRgh.width = cRgh.height = S;
      const bctx = cBmp.getContext('2d');
      const rctx = cRgh.getContext('2d');

      bctx.fillStyle = '#808080'; bctx.fillRect(0, 0, S, S);
      rctx.fillStyle = '#6c6c6c'; rctx.fillRect(0, 0, S, S);

      // Deep hammered cast-iron dimples
      for (let i = 0; i < 650; i++) {
        const x = Math.random() * S, y = Math.random() * S;
        const r = 6 + Math.random() * 16;
        const bg = bctx.createRadialGradient(x, y, 0, x, y, r);
        bg.addColorStop(0, 'rgba(18,18,18,0.6)');
        bg.addColorStop(0.68, 'rgba(165,165,165,0.28)');
        bg.addColorStop(1, 'rgba(128,128,128,0)');
        bctx.fillStyle = bg;
        bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2); bctx.fill();

        const rg = rctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(55,55,55,0.55)');
        rg.addColorStop(0.75, 'rgba(160,160,160,0.35)');
        rg.addColorStop(1, 'rgba(108,108,108,0)');
        rctx.fillStyle = rg;
        rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill();
      }

      // Anisotropic fine brushed scratches
      for (let s = 0; s < 500; s++) {
        const y = Math.random() * S;
        rctx.strokeStyle = Math.random() > 0.5 ? 'rgba(40,40,40,0.18)' : 'rgba(200,200,200,0.14)';
        rctx.lineWidth = 1;
        rctx.beginPath(); rctx.moveTo(0, y); rctx.lineTo(S, y + (Math.random() - 0.5) * 3); rctx.stroke();
      }

      const bmp = new THREE.CanvasTexture(cBmp);
      const rgh = new THREE.CanvasTexture(cRgh);
      bmp.wrapS = bmp.wrapT = rgh.wrapS = rgh.wrapT = THREE.RepeatWrapping;
      bmp.repeat.set(2.5, 2.5);
      rgh.repeat.set(2.5, 2.5);
      return { bumpMap: bmp, roughnessMap: rgh };
    }

    function createEmeraldFeltPBR() {
      const S = 512;
      const cCol = document.createElement('canvas'); cCol.width = cCol.height = S;
      const cBmp = document.createElement('canvas'); cBmp.width = cBmp.height = S;
      const ctx = cCol.getContext('2d');
      const bctx = cBmp.getContext('2d');

      // Deep dark emerald baize radial vignette
      const grad = ctx.createRadialGradient(S / 2, S / 2, 24, S / 2, S / 2, S * 0.72);
      grad.addColorStop(0, '#09382a');
      grad.addColorStop(0.7, '#06261c');
      grad.addColorStop(1, '#031610');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);

      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, S, S);

      // Diagonal baize twill weave micro-texture
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      bctx.strokeStyle = 'rgba(215, 215, 215, 0.25)';
      ctx.lineWidth = 1;
      bctx.lineWidth = 1;
      for (let i = -S; i < S * 2; i += 4) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
        bctx.beginPath(); bctx.moveTo(i, 0); bctx.lineTo(i + S, S); bctx.stroke();
      }
      bctx.strokeStyle = 'rgba(40, 40, 40, 0.2)';
      for (let i = -S; i < S * 2; i += 4) {
        bctx.beginPath(); bctx.moveTo(i, S); bctx.lineTo(i + S, 0); bctx.stroke();
      }

      // Subtle felt fiber noise
      const img = ctx.getImageData(0, 0, S, S);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 12;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);

      // Stitched Gold-Thread Border
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.62)';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, S - 36, S - 36);

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(27, 27, S - 54, S - 54);
      ctx.setLineDash([]);

      // Inlaid Metallic MOSAIC CASINO Emblem
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -76); ctx.lineTo(118, 0); ctx.lineTo(0, 76); ctx.lineTo(-118, 0);
      ctx.closePath(); ctx.stroke();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -64); ctx.lineTo(100, 0); ctx.lineTo(0, 64); ctx.lineTo(-100, 0);
      ctx.closePath(); ctx.stroke();

      ctx.fillStyle = 'rgba(229, 193, 88, 0.28)';
      ctx.font = '800 24px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOSAIC', 0, -9);

      ctx.fillStyle = 'rgba(229, 193, 88, 0.22)';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText('CASINO  •  CASHIER CAGE', 0, 15);
      ctx.restore();

      const map = new THREE.CanvasTexture(cCol);
      map.colorSpace = THREE.SRGBColorSpace;
      const bumpMap = new THREE.CanvasTexture(cBmp);
      return { map, bumpMap };
    }

    function createEtchedGlassTexture() {
      const S = 512;
      const c = document.createElement('canvas'); c.width = c.height = S;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0d141c';
      ctx.fillRect(0, 0, S, S);

      // Subtle vertical architectural etched pinstripes
      ctx.strokeStyle = 'rgba(200, 225, 255, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 16; x < S; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      }
      // Subtle lower bevel frosted edge
      const g = ctx.createLinearGradient(0, S * 0.86, 0, S);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(210,235,255,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(0, S * 0.86, S, S * 0.14);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    function createHeaderPlaqueTexture() {
      const W = 1024, H = 192;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#0a0b0e');
      grad.addColorStop(0.5, '#171512');
      grad.addColorStop(1, '#090a0d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Hairline engraved brass double border
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, W - 20, H - 20);
      ctx.strokeStyle = 'rgba(245, 210, 120, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, 20, W - 40, H - 40);

      // Warm backlit amber-gold engraved title
      ctx.shadowColor = 'rgba(245, 185, 65, 0.9)';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#fae09b';
      ctx.font = '800 50px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOSAIC CASINO  •  CASHIER', W / 2, H / 2 + 2);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // --- INTRICATE JEWEL-TONE CHIP PBR GENERATOR (DIFFUSE + BUMP + ROUGHNESS) ---
    function createIntricateChipPBR(spec) {
      const S = 512;
      const cx = S / 2, cy = S / 2;

      const cCol = document.createElement('canvas'); cCol.width = cCol.height = S;
      const cBmp = document.createElement('canvas'); cBmp.width = cBmp.height = S;
      const cRgh = document.createElement('canvas'); cRgh.width = cRgh.height = S;
      const ctx = cCol.getContext('2d');
      const bctx = cBmp.getContext('2d');
      const rctx = cRgh.getContext('2d');

      // 1. Deep Dark Saturated Clay Base
      const baseGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 256);
      baseGrad.addColorStop(0, spec.baseMid);
      baseGrad.addColorStop(0.72, spec.baseDark);
      baseGrad.addColorStop(1, '#040507');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, S, S);

      // Matte clay base bump & roughness
      bctx.fillStyle = '#707070'; bctx.fillRect(0, 0, S, S);
      rctx.fillStyle = '#c8c8c8'; rctx.fillRect(0, 0, S, S);

      // 2. Art-Deco Outer Edge Spots (12 or 8 depending on denom)
      const spotCount = spec.value === 10 ? 6 : spec.value === 1000 ? 12 : 8;
      for (let i = 0; i < spotCount; i++) {
        const ang = (i / spotCount) * Math.PI * 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
        bctx.save(); bctx.translate(cx, cy); bctx.rotate(ang);
        rctx.save(); rctx.translate(cx, cy); rctx.rotate(ang);

        if (spec.pattern === 'filigree') {
          // Triple electric cyan edge spots
          ctx.fillStyle = spec.vividPrimary;
          ctx.fillRect(-20, -256, 10, 44);
          ctx.fillRect(10, -256, 10, 44);
          ctx.fillStyle = spec.vividSecondary;
          ctx.fillRect(-6, -256, 12, 52);
        } else if (spec.pattern === 'mandala') {
          // Notched emerald-gold stripes
          ctx.fillStyle = spec.vividPrimary;
          ctx.fillRect(-22, -256, 44, 42);
          ctx.fillStyle = spec.vividSecondary;
          ctx.fillRect(-7, -256, 14, 52);
        } else if (spec.pattern === 'mosaic') {
          // Bold crimson edge blocks with rose-gold core
          ctx.fillStyle = spec.vividPrimary;
          ctx.fillRect(-26, -256, 52, 46);
          ctx.fillStyle = spec.foilColor;
          ctx.fillRect(-6, -256, 12, 46);
        } else if (spec.pattern === 'rosette') {
          // Layered violet-silver edge bars
          ctx.fillStyle = spec.vividSecondary;
          ctx.fillRect(-22, -256, 44, 44);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-12, -256, 6, 52);
          ctx.fillRect(6, -256, 6, 52);
        } else {
          // Intricate golden edge crown ($1,000)
          ctx.fillStyle = spec.vividPrimary;
          ctx.beginPath();
          ctx.moveTo(-18, -256); ctx.lineTo(18, -256); ctx.lineTo(10, -206); ctx.lineTo(-10, -206);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = spec.vividSecondary;
          ctx.fillRect(-4, -256, 8, 54);
        }

        // Raised specular edge-spot bump & glossy roughness
        bctx.fillStyle = '#d8d8d8';
        bctx.fillRect(-22, -256, 44, 48);
        rctx.fillStyle = '#2a2a2a';
        rctx.fillRect(-22, -256, 44, 48);

        ctx.restore(); bctx.restore(); rctx.restore();
      }

      // 3. Recessed Outer Mold Ring
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, 204, 0, Math.PI * 2); ctx.stroke();

      bctx.strokeStyle = '#202020';
      bctx.lineWidth = 8;
      bctx.beginPath(); bctx.arc(cx, cy, 204, 0, Math.PI * 2); bctx.stroke();

      // 4. Intricate Guilloché / Mandala / Mosaic Filigree Ring (r = 135..198)
      const drawIntricateRing = (targetCtx, color1, color2, lwScale = 1) => {
        targetCtx.save();
        targetCtx.translate(cx, cy);

        // Guilloché spirograph wave
        targetCtx.strokeStyle = color1;
        targetCtx.lineWidth = 2.4 * lwScale;
        targetCtx.beginPath();
        const petals = spec.value === 1000 ? 24 : spec.value === 500 ? 18 : 16;
        for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.02) {
          const r = 168 + Math.sin(a * petals) * 20;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (a === 0) targetCtx.moveTo(x, y); else targetCtx.lineTo(x, y);
        }
        targetCtx.stroke();

        // Counter-phase filigree wave
        targetCtx.strokeStyle = color2;
        targetCtx.lineWidth = 1.8 * lwScale;
        targetCtx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.02) {
          const r = 168 - Math.sin(a * petals) * 18;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (a === 0) targetCtx.moveTo(x, y); else targetCtx.lineTo(x, y);
        }
        targetCtx.stroke();

        // Micro-dot crown around perimeter
        targetCtx.fillStyle = color2;
        const dots = 36;
        for (let d = 0; d < dots; d++) {
          const a = (d / dots) * Math.PI * 2;
          targetCtx.beginPath();
          targetCtx.arc(Math.cos(a) * 192, Math.sin(a) * 192, 3.2 * lwScale, 0, Math.PI * 2);
          targetCtx.fill();
        }

        // Geometric diamond / mosaic ring
        targetCtx.strokeStyle = color1;
        targetCtx.lineWidth = 2 * lwScale;
        const facets = 16;
        for (let f = 0; f < facets; f++) {
          const a = (f / facets) * Math.PI * 2;
          targetCtx.save();
          targetCtx.rotate(a);
          targetCtx.beginPath();
          targetCtx.moveTo(0, -142);
          targetCtx.lineTo(9, -158);
          targetCtx.lineTo(0, -174);
          targetCtx.lineTo(-9, -158);
          targetCtx.closePath();
          targetCtx.stroke();
          targetCtx.restore();
        }
        targetCtx.restore();
      };

      drawIntricateRing(ctx, spec.vividPrimary, spec.vividSecondary, 1.0);
      drawIntricateRing(bctx, '#f0f0f0', '#dcdcdc', 1.25);
      drawIntricateRing(rctx, '#181818', '#252525', 1.25); // Shiny metallic inlays!

      // 5. Deep Center Medallion with Foil Ring
      ctx.fillStyle = '#06070a';
      ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.fill();

      // Inner jewel sunburst rays inside medallion
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = spec.vividPrimary + '44';
      ctx.lineWidth = 2;
      for (let r = 0; r < 24; r++) {
        const a = (r / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 86, Math.sin(a) * 86);
        ctx.lineTo(Math.cos(a) * 122, Math.sin(a) * 122);
        ctx.stroke();
      }
      ctx.restore();

      // Metallic double medallion ring
      ctx.strokeStyle = spec.vividSecondary;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = spec.vividPrimary;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 114, 0, Math.PI * 2); ctx.stroke();

      bctx.strokeStyle = '#ffffff';
      bctx.lineWidth = 7;
      bctx.beginPath(); bctx.arc(cx, cy, 126, 0, Math.PI * 2); bctx.stroke();
      rctx.strokeStyle = '#141414';
      rctx.lineWidth = 8;
      rctx.beginPath(); rctx.arc(cx, cy, 126, 0, Math.PI * 2); rctx.stroke();

      // Luminous Denomination Typography
      ctx.shadowColor = spec.vividPrimary;
      ctx.shadowBlur = 16;
      ctx.fillStyle = spec.foilColor;
      ctx.font = '800 76px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.label, cx, cy - 8);
      ctx.shadowBlur = 0;

      ctx.fillStyle = spec.vividSecondary;
      ctx.font = '700 20px Cinzel, serif';
      ctx.fillText('MOSAIC', cx, cy + 56);

      // Emboss text on bump & make it mirror-glossy on roughness
      bctx.fillStyle = '#ffffff';
      bctx.font = '800 76px JetBrains Mono, monospace';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.fillText(spec.label, cx, cy - 8);

      rctx.fillStyle = '#121212';
      rctx.font = '800 76px JetBrains Mono, monospace';
      rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
      rctx.fillText(spec.label, cx, cy - 8);

      // Edge Texture + Edge Bump
      const eCol = document.createElement('canvas'); eCol.width = 512; eCol.height = 64;
      const eBmp = document.createElement('canvas'); eBmp.width = 512; eBmp.height = 64;
      const ectx = eCol.getContext('2d');
      const ebctx = eBmp.getContext('2d');

      ectx.fillStyle = spec.baseDark; ectx.fillRect(0, 0, 512, 64);
      ebctx.fillStyle = '#707070'; ebctx.fillRect(0, 0, 512, 64);

      const step = 512 / spotCount;
      for (let i = 0; i < spotCount; i++) {
        const sx = i * step;
        ectx.fillStyle = spec.vividPrimary;
        ectx.fillRect(sx + step * 0.28, 0, step * 0.44, 64);
        ectx.fillStyle = spec.vividSecondary;
        ectx.fillRect(sx + step * 0.44, 0, step * 0.12, 64);

        ebctx.fillStyle = '#dcdcdc';
        ebctx.fillRect(sx + step * 0.28, 0, step * 0.44, 64);
      }

      const faceMap = new THREE.CanvasTexture(cCol); faceMap.colorSpace = THREE.SRGBColorSpace;
      const faceBump = new THREE.CanvasTexture(cBmp);
      const faceRough = new THREE.CanvasTexture(cRgh);
      const edgeMap = new THREE.CanvasTexture(eCol); edgeMap.colorSpace = THREE.SRGBColorSpace; edgeMap.wrapS = THREE.RepeatWrapping;
      const edgeBump = new THREE.CanvasTexture(eBmp); edgeBump.wrapS = THREE.RepeatWrapping;

      return { faceMap, faceBump, faceRough, edgeMap, edgeBump };
    }

    // --- HIGH-ROLLER $5,000 SMOKED TITANIUM CHROMATIC PLAQUE PBR ---
    function createPlaquePBR() {
      const W = 512, H = 320;
      const cCol = document.createElement('canvas'); cCol.width = W; cCol.height = H;
      const cBmp = document.createElement('canvas'); cBmp.width = W; cBmp.height = H;
      const cRgh = document.createElement('canvas'); cRgh.width = W; cRgh.height = H;
      const ctx = cCol.getContext('2d');
      const bctx = cBmp.getContext('2d');
      const rctx = cRgh.getContext('2d');

      // Oil-slick smoked titanium obsidian gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#070a10');
      bg.addColorStop(0.35, '#111827');
      bg.addColorStop(0.68, '#1a1026');
      bg.addColorStop(1, '#060c10');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      bctx.fillStyle = '#757575'; bctx.fillRect(0, 0, W, H);
      rctx.fillStyle = '#484848'; rctx.fillRect(0, 0, W, H);

      // Glowing Holographic Geometric Lattice (Emerald / Magenta / Gold)
      const latGrad = ctx.createLinearGradient(0, 0, W, H);
      latGrad.addColorStop(0, 'rgba(16, 185, 129, 0.42)');
      latGrad.addColorStop(0.5, 'rgba(232, 121, 249, 0.38)');
      latGrad.addColorStop(1, 'rgba(212, 175, 55, 0.45)');
      ctx.strokeStyle = latGrad;
      ctx.lineWidth = 1.5;
      bctx.strokeStyle = '#c0c0c0'; bctx.lineWidth = 1.5;
      rctx.strokeStyle = '#141414'; rctx.lineWidth = 2;

      for (let x = -H; x < W + H; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke();
        bctx.beginPath(); bctx.moveTo(x, 0); bctx.lineTo(x + H, H); bctx.stroke();
        rctx.beginPath(); rctx.moveTo(x, 0); rctx.lineTo(x + H, H); rctx.stroke();
      }

      // Deep dark center inlay window
      ctx.fillStyle = 'rgba(7, 9, 14, 0.88)';
      ctx.fillRect(58, 52, W - 116, H - 104);

      // Beveled Prismatic Metallic Frame
      const rimGrad = ctx.createLinearGradient(0, 0, W, H);
      rimGrad.addColorStop(0, '#34d399');
      rimGrad.addColorStop(0.35, '#38bdf8');
      rimGrad.addColorStop(0.7, '#e879f9');
      rimGrad.addColorStop(1, '#fbbf24');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 10;
      ctx.strokeRect(14, 14, W - 28, H - 28);

      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(58, 52, W - 116, H - 104);

      bctx.strokeStyle = '#ffffff'; bctx.lineWidth = 14;
      bctx.strokeRect(14, 14, W - 28, H - 28);
      rctx.strokeStyle = '#101010'; rctx.lineWidth = 14;
      rctx.strokeRect(14, 14, W - 28, H - 28);

      // Luminous Denomination
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 80px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$5,000', W / 2, H / 2 - 12);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#e5c158';
      ctx.font = '700 18px Cinzel, serif';
      ctx.fillText('MOSAIC CASINO  •  HIGH ROLLER', W / 2, H / 2 + 48);

      // Engraved Serial Number
      ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
      ctx.font = '600 13px JetBrains Mono, monospace';
      ctx.fillText('SER. NO. MC-009482-TI', W / 2, H - 30);

      bctx.fillStyle = '#ffffff';
      bctx.font = '800 80px JetBrains Mono, monospace';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.fillText('$5,000', W / 2, H / 2 - 12);

      const map = new THREE.CanvasTexture(cCol); map.colorSpace = THREE.SRGBColorSpace;
      const bumpMap = new THREE.CanvasTexture(cBmp);
      const roughnessMap = new THREE.CanvasTexture(cRgh);
      return { map, bumpMap, roughnessMap };
    }

    function createCashBillTexture() {
      const W = 256, H = 128;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#122b1e'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.fillStyle = '#c9a23b'; ctx.fillRect(W * 0.37, 0, W * 0.26, H);
      ctx.fillStyle = '#0b0e12'; ctx.font = '800 22px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$100', W / 2, H / 2);
      ctx.fillStyle = '#6ee7b7'; ctx.font = '700 16px JetBrains Mono, monospace';
      ctx.fillText('100', 32, 28); ctx.fillText('100', W - 32, H - 28);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    function createMarkerContractTexture(amount = 2500, stamped = false) {
      const W = 512, H = 340;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');

      // Dark obsidian parchment
      const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.65);
      g.addColorStop(0, '#18161a');
      g.addColorStop(1, '#0d0c0f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Gold foil ornate double frame
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 7; ctx.strokeRect(12, 12, W - 24, H - 24);
      ctx.strokeStyle = 'rgba(212,175,55,0.38)'; ctx.lineWidth = 1.5; ctx.strokeRect(24, 24, W - 48, H - 48);

      ctx.fillStyle = '#f3d27a';
      ctx.font = '700 26px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('MOSAIC CASINO MARKER CONTRACT', W / 2, 64);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText('HIGH-LIMIT CREDIT INSTRUMENT  •  CAGE AUTHORIZED', W / 2, 94);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 54px JetBrains Mono, monospace';
      ctx.fillText(`$${amount.toLocaleString()}`, W / 2, 172);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText('5% HOUSE VIGORISH  •  PAYABLE ON DEMAND', W / 2, 228);

      ctx.strokeStyle = 'rgba(212,175,55,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(95, 282); ctx.lineTo(W - 95, 282); ctx.stroke();

      if (stamped) {
        ctx.save();
        ctx.translate(W / 2 + 28, 182);
        ctx.rotate(-0.2);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 7;
        ctx.strokeRect(-132, -38, 264, 76);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
        ctx.fillRect(-132, -38, 264, 76);
        ctx.fillStyle = '#fb7185';
        ctx.font = '800 40px JetBrains Mono, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('APPROVED', 0, 2);
        ctx.restore();
      }

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // =========================================================================
    // 4. MULTI-COLORED STUDIO + NEON CHROMATIC PMREM ENVIRONMENT MAP
    // =========================================================================
    function createChromaticEnvMap(renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color('#06080c');

      const addPanel = (w, h, color, pos, rot) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
        );
        m.position.set(...pos);
        m.rotation.set(...rot);
        envScene.add(m);
      };

      // Warm overhead studio softbox
      addPanel(14, 6, new THREE.Color(2.5, 1.95, 1.1), [0, 7.2, 2], [Math.PI / 2, 0, 0]);
      // Luminous emerald left neon strip
      addPanel(2.6, 11, new THREE.Color(0.15, 2.5, 1.6), [-8, 2.2, 1.2], [0, Math.PI / 2, 0]);
      // Vivid magenta/ruby right neon strip
      addPanel(2.6, 11, new THREE.Color(2.6, 0.25, 0.95), [8, 2.2, 1.2], [0, -Math.PI / 2, 0]);
      // Electric cyan rear chromatic highlight
      addPanel(12, 2.4, new THREE.Color(0.3, 1.85, 2.8), [0, 4.6, -7.2], [0, 0, 0]);
      // Subtle amber lower fill for chip rims
      addPanel(10, 2.0, new THREE.Color(1.8, 1.1, 0.3), [0, -1.5, 6.5], [0, Math.PI, 0]);

      const rt = pmrem.fromScene(envScene, 0.035);
      pmrem.dispose();
      return rt.texture;
    }

    // =========================================================================
    // 5. THREE.JS SCENE, LIGHTING & CASHIER'S CAGE ARCHITECTURE
    // =========================================================================
    const container = stageEl;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050608');
    scene.fog = new THREE.FogExp2('#050608', 0.044);

    const camera = new THREE.PerspectiveCamera(43, 1.6, 0.1, 55);
    camera.position.set(0, 2.52, 4.18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(960, 540, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    container.appendChild(renderer.domElement);

    scene.environment = createChromaticEnvMap(renderer);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.48, 0.3);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 1.55;
    controls.maxDistance = 7.6;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minAzimuthAngle = -Math.PI * 0.42;
    controls.maxAzimuthAngle = Math.PI * 0.42;
    controls.update();

    const CAM_PRESETS = {
      counter: { pos: new THREE.Vector3(0, 2.52, 4.18),   target: new THREE.Vector3(0, 0.48, 0.30) },
      felt:    { pos: new THREE.Vector3(0.12, 1.38, 2.15), target: new THREE.Vector3(0, 0.08, 0.78) },
      vault:   { pos: new THREE.Vector3(-0.55, 1.92, 2.65), target: new THREE.Vector3(0, 1.48, -3.4) }
    };
    let camLerpActive = false;
    const camGoalPos = new THREE.Vector3();
    const camGoalTarget = new THREE.Vector3();
    let camShakeTime = 0, camShakeStrength = 0;

    function goToCamera(key) {
      const p = CAM_PRESETS[key];
      if (!p) return;
      camGoalPos.copy(p.pos);
      camGoalTarget.copy(p.target);
      camLerpActive = true;
      root.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === key));
    }
    controls.addEventListener('start', () => { camLerpActive = false; });

    // --- LIGHTING ---
    scene.add(new THREE.AmbientLight('#151a24', 0.6));

    const mainSpot = new THREE.SpotLight('#ffe2b0', 42, 18, Math.PI * 0.33, 0.52, 1.45);
    mainSpot.position.set(0.25, 5.8, 2.45);
    mainSpot.target.position.set(0, 0, 0.5);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.set(1024, 1024);
    mainSpot.shadow.bias = -0.0004;
    scene.add(mainSpot, mainSpot.target);

    const emeraldRim = new THREE.PointLight('#10b981', 13, 10, 1.6);
    emeraldRim.position.set(-3.4, 2.0, 1.6);
    scene.add(emeraldRim);

    const magentaRim = new THREE.PointLight('#e11d48', 12, 10, 1.6);
    magentaRim.position.set(3.4, 2.0, 1.4);
    scene.add(magentaRim);

    const cyanRim = new THREE.PointLight('#38bdf8', 10, 10, 1.6);
    cyanRim.position.set(0, 3.1, -1.6);
    scene.add(cyanRim);

    const bankerLight = new THREE.PointLight('#ff9e36', 18, 8, 1.45);
    bankerLight.position.set(-1.55, 1.05, -1.35);
    scene.add(bankerLight);

    const vaultLight = new THREE.PointLight('#f59e0b', 3.0, 9, 1.4);
    vaultLight.position.set(0, 1.55, -4.35);
    scene.add(vaultLight);

    // --- PBR MATERIALS ---
    const walnutPBR = createWalnutPBR();
    const hammeredPBR = createHammeredMetalPBR();
    const feltPBR = createEmeraldFeltPBR();
    const etchedGlassTex = createEtchedGlassTexture();
    const cashTex = createCashBillTexture();

    const matWalnut = new THREE.MeshPhysicalMaterial({
      map: walnutPBR.map,
      bumpMap: walnutPBR.bumpMap,
      bumpScale: 0.018,
      roughnessMap: walnutPBR.roughnessMap,
      roughness: 0.42,
      metalness: 0.06,
      clearcoat: 0.72,
      clearcoatRoughness: 0.2
    });

    const matGunmetal = new THREE.MeshPhysicalMaterial({
      color: '#191e26',
      bumpMap: hammeredPBR.bumpMap,
      bumpScale: 0.028,
      roughnessMap: hammeredPBR.roughnessMap,
      metalness: 0.88,
      roughness: 0.48,
      clearcoat: 0.18
    });

    const matIridescentTray = new THREE.MeshPhysicalMaterial({
      color: '#cbd5e1',
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 1.0,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [180, 560]
    });

    const matSmokedBrass = new THREE.MeshPhysicalMaterial({
      color: '#c79f44',
      bumpMap: hammeredPBR.bumpMap,
      bumpScale: 0.008,
      metalness: 0.93,
      roughness: 0.24,
      clearcoat: 0.45,
      iridescence: 0.3,
      iridescenceIOR: 1.35
    });

    const matFelt = new THREE.MeshStandardMaterial({
      map: feltPBR.map,
      bumpMap: feltPBR.bumpMap,
      bumpScale: 0.014,
      roughness: 0.94,
      metalness: 0.02
    });

    const matBeveledGlass = new THREE.MeshPhysicalMaterial({
      map: etchedGlassTex,
      color: '#101b24',
      transparent: true,
      opacity: 0.28,
      roughness: 0.07,
      metalness: 0.12,
      reflectivity: 0.92,
      clearcoat: 1.0,
      side: THREE.DoubleSide
    });

    // --- BUILD ENVIRONMENT ---
    const cageGroup = new THREE.Group();
    scene.add(cageGroup);
    const CAGE_Z = -0.52;

    // 1. Dark Figured Walnut Counter
    const counterSlab = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.24, 3.7), matWalnut);
    counterSlab.position.set(0, -0.12, 0.35);
    counterSlab.receiveShadow = true;
    cageGroup.add(counterSlab);

    const counterBevelTrim = new THREE.Mesh(new THREE.BoxGeometry(7.86, 0.055, 0.07), matSmokedBrass);
    counterBevelTrim.position.set(0, -0.02, 2.2);
    cageGroup.add(counterBevelTrim);

    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(7.3, 2.3, 3.2), matWalnut);
    counterBase.position.set(0, -1.35, 0.2);
    cageGroup.add(counterBase);

    // 2. Woven Emerald Baize Felt Pad
    const feltPad = new THREE.Mesh(new THREE.BoxGeometry(4.46, 0.014, 1.72), matFelt);
    feltPad.position.set(0, 0.007, 1.06);
    feltPad.receiveShadow = true;
    cageGroup.add(feltPad);

    const fTrimF = new THREE.Mesh(new THREE.BoxGeometry(4.52, 0.022, 0.032), matSmokedBrass);
    fTrimF.position.set(0, 0.011, 1.93);
    const fTrimB = fTrimF.clone(); fTrimB.position.z = 0.19;
    const fTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 1.76), matSmokedBrass);
    fTrimL.position.set(-2.24, 0.011, 1.06);
    const fTrimR = fTrimL.clone(); fTrimR.position.x = 2.24;
    cageGroup.add(fTrimF, fTrimB, fTrimL, fTrimR);

    // 3. Curved Chromatic Iridescent Pass-Through Deal Tray
    const trayGroup = new THREE.Group();
    trayGroup.position.set(0, 0.004, -0.42);
    cageGroup.add(trayGroup);

    const scoopGeo = new THREE.CylinderGeometry(0.68, 0.68, 1.5, 32, 1, true, Math.PI * 0.82, Math.PI * 0.36);
    scoopGeo.rotateZ(Math.PI / 2);
    const scoopMesh = new THREE.Mesh(scoopGeo, matIridescentTray);
    scoopMesh.position.set(0, 0.56, 0);
    scoopMesh.receiveShadow = true;
    trayGroup.add(scoopMesh);

    const railGeo = new THREE.BoxGeometry(0.085, 0.044, 0.88);
    const railL = new THREE.Mesh(railGeo, matIridescentTray);
    railL.position.set(-0.77, 0.022, 0);
    const railR = railL.clone(); railR.position.x = 0.77;
    trayGroup.add(railL, railR);

    // 4. Hammered Cast-Iron & Smoked Gunmetal Cage with Bolted Corner Pilasters
    const pilasterGeo = new THREE.BoxGeometry(0.36, 3.35, 0.38);
    const pilasterL = new THREE.Mesh(pilasterGeo, matGunmetal);
    pilasterL.position.set(-2.58, 1.67, CAGE_Z);
    pilasterL.castShadow = true;
    const pilasterR = pilasterL.clone(); pilasterR.position.x = 2.58;
    cageGroup.add(pilasterL, pilasterR);

    // Decorative bolted rivets on pilasters
    [-2.58, 2.58].forEach(px => {
      [0.35, 1.15, 1.95, 2.75].forEach(py => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 10), matSmokedBrass);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(px, py, CAGE_Z + 0.2);
        cageGroup.add(bolt);
      });
    });

    const wingGeo = new THREE.BoxGeometry(2.6, 3.6, 0.28);
    const wingL = new THREE.Mesh(wingGeo, matWalnut); wingL.position.set(-3.95, 1.7, CAGE_Z - 0.05);
    const wingR = wingL.clone(); wingR.position.x = 3.95;
    cageGroup.add(wingL, wingR);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.46, 0.42), matGunmetal);
    lintel.position.set(0, 3.1, CAGE_Z);
    cageGroup.add(lintel);

    const lowerBarL = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 0.12), matSmokedBrass);
    lowerBarL.position.set(-1.64, 0.06, CAGE_Z);
    const lowerBarR = lowerBarL.clone(); lowerBarR.position.x = 1.64;
    const archBar = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.085, 0.15), matIridescentTray);
    archBar.position.set(0, 0.43, CAGE_Z);
    cageGroup.add(lowerBarL, lowerBarR, archBar);

    // Teller Bars + Recessed Cross-Grille Work
    const barXs = [-2.22, -1.86, -1.5, -1.14, -0.8, -0.48, -0.16, 0.16, 0.48, 0.8, 1.14, 1.5, 1.86, 2.22];
    barXs.forEach((bx, idx) => {
      const isCenter = Math.abs(bx) < 0.78;
      const bot = isCenter ? 0.45 : 0.08;
      const h = 2.9 - bot;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, h, 16),
        idx % 2 === 0 ? matIridescentTray : matSmokedBrass
      );
      bar.position.set(bx, bot + h / 2, CAGE_Z);
      bar.castShadow = true;
      cageGroup.add(bar);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.01, 10, 18), matSmokedBrass);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(bx, 1.72, CAGE_Z);
      cageGroup.add(collar);
    });

    // Horizontal recessed transom bar
    const transom = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.045, 0.06), matGunmetal);
    transom.position.set(0, 2.38, CAGE_Z);
    cageGroup.add(transom);

    // Beveled Smoked Security Glass Partition
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(4.85, 2.45), matBeveledGlass);
    glassPane.position.set(0, 1.67, CAGE_Z - 0.09);
    cageGroup.add(glassPane);

    // Illuminated Header Plaque
    const plaqueTex = createHeaderPlaqueTexture();
    const headerPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.68, 0.12),
      new THREE.MeshPhysicalMaterial({
        map: plaqueTex,
        emissiveMap: plaqueTex,
        emissive: new THREE.Color('#ffbe55'),
        emissiveIntensity: 0.9,
        metalness: 0.68,
        roughness: 0.24
      })
    );
    headerPlaque.position.set(0, 3.1, CAGE_Z + 0.23);
    cageGroup.add(headerPlaque);

    // 5. BACKGROUND VAULT & TELLER BOOTH DEPTH
    const vaultBackWall = new THREE.Mesh(new THREE.BoxGeometry(9.8, 5.4, 0.3), matGunmetal);
    vaultBackWall.position.set(0, 1.85, -4.45);
    cageGroup.add(vaultBackWall);

    const vaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 5.2), matWalnut);
    vaultFloor.rotation.x = -Math.PI / 2;
    vaultFloor.position.set(0, -0.02, -2.55);
    cageGroup.add(vaultFloor);

    // Vintage Emerald-Glass Banker's Desk Lamp (left inside cage)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-1.62, 0, -1.42);
    cageGroup.add(lampGroup);
    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 20), matSmokedBrass);
    lBase.position.y = 0.03;
    const lStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.65, 12), matSmokedBrass);
    lStem.position.y = 0.36;
    const lShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.24, 0.24, 18, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: '#065f46', emissive: '#10b981', emissiveIntensity: 0.65,
        roughness: 0.16, clearcoat: 1.0, side: THREE.DoubleSide
      })
    );
    lShade.rotation.z = Math.PI / 2;
    lShade.position.set(0.06, 0.68, 0.04);
    const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffd47a' }));
    lBulb.position.set(0.06, 0.64, 0.04);
    lampGroup.add(lBase, lStem, lShade, lBulb);

    // Brass Pneumatic Cash Tube (far left inside teller booth)
    const pTube = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 3.6, 18), matSmokedBrass);
    pTube.position.set(-2.35, 1.8, -2.15);
    cageGroup.add(pTube);
    const pGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.75, 18),
      new THREE.MeshPhysicalMaterial({ color: '#a7f3d0', transparent: true, opacity: 0.26, roughness: 0.08, clearcoat: 1 })
    );
    pGlass.position.set(-2.35, 1.25, -2.15);
    cageGroup.add(pGlass);

    // Dark-Wood Chip Racks filled with Jewel-Toned Stacks (right inside booth)
    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.68), matWalnut);
    rackBase.position.set(1.58, 0.06, -1.55);
    cageGroup.add(rackBase);
    for (let r = 0; r < 5; r++) {
      const sp = CHIP_SPECS[r];
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.44, 16),
        new THREE.MeshPhysicalMaterial({
          color: sp.vividPrimary, metalness: 0.55, roughness: 0.25, iridescence: sp.iridescence
        })
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.set(1.06 + r * 0.25, 0.17, -1.55);
      cageGroup.add(tube);
    }

    // Banded Currency Bricks inside booth
    const cashMat = new THREE.MeshStandardMaterial({ map: cashTex, roughness: 0.72 });
    for (let i = 0; i < 8; i++) {
      const brick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.078, 0.16), cashMat);
      brick.position.set(1.25 + (i % 2) * 0.39, 0.04 + Math.floor(i / 2) * 0.08, -2.42);
      brick.rotation.y = (Math.random() - 0.5) * 0.14;
      cageGroup.add(brick);
    }

    // 6. HEAVY CIRCULAR ANIMATED VAULT DOOR WITH SPINNING CHROME WHEEL
    const vaultDoorPivot = new THREE.Group();
    vaultDoorPivot.position.set(-1.18, 1.56, -4.22);
    cageGroup.add(vaultDoorPivot);

    const vaultFrame = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.15, 18, 42), matGunmetal);
    vaultFrame.position.set(0, 1.56, -4.26);
    cageGroup.add(vaultFrame);

    const vaultDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.24, 38), matIridescentTray);
    vaultDisc.rotation.x = Math.PI / 2;
    vaultDisc.position.set(1.18, 0, 0);
    vaultDoorPivot.add(vaultDisc);

    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), matSmokedBrass);
      bolt.rotation.z = a + Math.PI / 2;
      bolt.position.set(1.18 + Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0);
      vaultDoorPivot.add(bolt);
    }

    const vaultWheelGroup = new THREE.Group();
    vaultWheelGroup.position.set(1.18, 0, 0.23);
    vaultDoorPivot.add(vaultWheelGroup);

    vaultWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.044, 14, 32), matSmokedBrass));
    const vHub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 18), matIridescentTray);
    vHub.rotation.x = Math.PI / 2;
    vaultWheelGroup.add(vHub);
    for (let s = 0; s < 5; s++) {
      const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 10), matSmokedBrass);
      spk.rotation.z = (s / 5) * Math.PI;
      vaultWheelGroup.add(spk);
    }

    // Subtle Hover Glow Ring for Dragged Chip
    const grabGlowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.30, 32),
      new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    grabGlowRing.rotation.x = -Math.PI / 2;
    grabGlowRing.visible = false;
    scene.add(grabGlowRing);

    // =========================================================================
    // 6. SHARED PBR CHIP & PLAQUE ASSETS
    // =========================================================================
    const chipAssets = {};
    CHIP_SPECS.forEach(spec => {
      if (spec.type === 'chip') {
        const geo = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.height, 32);
        const pbr = createIntricateChipPBR(spec);
        const faceMat = new THREE.MeshPhysicalMaterial({
          map: pbr.faceMap,
          bumpMap: pbr.faceBump,
          bumpScale: 0.014,
          roughnessMap: pbr.faceRough,
          roughness: spec.roughness,
          metalness: spec.metalness,
          clearcoat: 0.78,
          clearcoatRoughness: 0.14,
          iridescence: spec.iridescence,
          iridescenceIOR: 1.45
        });
        const edgeMat = new THREE.MeshPhysicalMaterial({
          map: pbr.edgeMap,
          bumpMap: pbr.edgeBump,
          bumpScale: 0.012,
          metalness: spec.metalness * 0.9,
          roughness: spec.roughness + 0.08,
          iridescence: spec.iridescence * 0.85
        });
        chipAssets[spec.value] = { geo, mats: [edgeMat, faceMat, faceMat], spec };
      } else {
        const geo = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
        const pbr = createPlaquePBR();
        const topMat = new THREE.MeshPhysicalMaterial({
          map: pbr.map,
          bumpMap: pbr.bumpMap,
          bumpScale: 0.016,
          roughnessMap: pbr.roughnessMap,
          metalness: spec.metalness,
          roughness: spec.roughness,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          iridescence: 1.0,
          iridescenceIOR: 1.75,
          iridescenceThicknessRange: [200, 620]
        });
        chipAssets[spec.value] = {
          geo,
          mats: [matIridescentTray, matIridescentTray, topMat, topMat, matIridescentTray, matIridescentTray],
          spec
        };
      }
    });

    // =========================================================================
    // 7. ENHANCED 3D RIGID-BODY CHIP PHYSICS ENGINE (WOBBLE, STACKING, THROW)
    // =========================================================================
    const physicsChips = [];
    const MAX_CHIPS = 145;
    const GRAVITY = -16.2;

    function getSurfaceHeight(x, z) {
      if (Math.abs(x) < 0.73 && z < -0.02 && z > -0.86) {
        const dz = z - (-0.42);
        const dip = Math.max(0, 0.11 - (dz * dz) * 0.65);
        return -dip;
      }
      if (Math.abs(x) < 2.23 && z > 0.19 && z < 1.93) {
        return 0.014;
      }
      return 0.0;
    }

    function spawnPhysicsChip(value, pos, vel = new THREE.Vector3(), angVel = null) {
      const asset = chipAssets[value];
      if (!asset) return null;

      const mesh = new THREE.Mesh(asset.geo, asset.mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(pos);
      scene.add(mesh);

      const spec = asset.spec;
      const body = {
        value,
        spec,
        mesh,
        pos: pos.clone(),
        vel: vel.clone(),
        rot: new THREE.Euler(
          (Math.random() - 0.5) * 0.35,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.35
        ),
        angVel: angVel || new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 7
        ),
        radius: spec.type === 'chip' ? spec.radius : spec.width * 0.45,
        halfH: spec.height * 0.5,
        sleepFrames: 0,
        kinematic: false,
        targetPos: null,
        removeOnArrive: false,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 0
      };
      mesh.rotation.copy(body.rot);
      physicsChips.push(body);
      return body;
    }

    function removePhysicsChip(body) {
      const idx = physicsChips.indexOf(body);
      if (idx !== -1) physicsChips.splice(idx, 1);
      scene.remove(body.mesh);
    }

    let grabbedChip = null;

    function stepPhysics(dt) {
      const substeps = 2;
      const h = dt / substeps;

      for (let s = 0; s < substeps; s++) {
        for (let i = physicsChips.length - 1; i >= 0; i--) {
          const b = physicsChips[i];
          if (b === grabbedChip) continue;

          if (b.kinematic && b.targetPos) {
            b.pos.lerp(b.targetPos, Math.min(1, h * 10.5));
            b.rot.x *= 0.84;
            b.rot.z *= 0.84;
            b.mesh.position.copy(b.pos);
            b.mesh.rotation.copy(b.rot);
            if (b.pos.distanceTo(b.targetPos) < 0.025) {
              if (b.removeOnArrive) {
                removePhysicsChip(b);
                continue;
              } else {
                b.pos.copy(b.targetPos);
                b.vel.set(0, 0, 0);
                b.angVel.set(0, 0, 0);
                b.rot.x = 0; b.rot.z = 0;
                b.wobbleAmp = 0;
                b.kinematic = false;
                b.targetPos = null;
                b.sleepFrames = 32;
                sound.playChipClack(0.45, b.spec.type === 'plaque');
              }
            }
            continue;
          }

          if (b.sleepFrames > 28) continue;

          // Gravity & damping
          b.vel.y += GRAVITY * h;
          b.vel.multiplyScalar(0.993);
          b.angVel.multiplyScalar(0.97);

          b.pos.addScaledVector(b.vel, h);
          b.rot.x += b.angVel.x * h;
          b.rot.y += b.angVel.y * h;
          b.rot.z += b.angVel.z * h;

          // Coin-like Nutation / Precession Settling Wobble
          const surfY = getSurfaceHeight(b.pos.x, b.pos.z);
          const tilt = Math.hypot(b.rot.x, b.rot.z);
          const effectiveHalfH = b.halfH + Math.sin(Math.min(1.1, tilt)) * b.radius * 0.48;

          if (b.pos.y - effectiveHalfH < surfY) {
            const impact = Math.abs(b.vel.y);
            b.pos.y = surfY + effectiveHalfH;

            if (impact > 0.65) {
              b.vel.y = -b.vel.y * 0.36;
              // Induce realistic edge-bounce wobble if tilted
              b.wobbleAmp = Math.min(0.42, b.wobbleAmp + impact * 0.075);
              b.angVel.y += (Math.random() - 0.5) * impact * 1.4;
              sound.playChipClack(impact * 0.28, b.spec.type === 'plaque');
            } else {
              b.vel.y = 0;
            }

            // Apply damped coin wobble precession before laying flat
            if (b.wobbleAmp > 0.012) {
              b.wobblePhase += h * (16 + (0.45 - b.wobbleAmp) * 28);
              b.wobbleAmp *= Math.pow(0.08, h);
              b.rot.x = Math.cos(b.wobblePhase) * b.wobbleAmp;
              b.rot.z = Math.sin(b.wobblePhase) * b.wobbleAmp;
              b.angVel.x *= 0.6;
              b.angVel.z *= 0.6;
            } else {
              b.wobbleAmp = 0;
              b.rot.x *= 0.72;
              b.rot.z *= 0.72;
              b.angVel.x *= 0.68;
              b.angVel.z *= 0.68;
            }

            // Clay-composite felt friction
            b.vel.x *= 0.85;
            b.vel.z *= 0.85;
            b.angVel.y *= 0.89;
          }

          // Counter bounds
          if (b.pos.x < -3.3) { b.pos.x = -3.3; b.vel.x = Math.abs(b.vel.x) * 0.45; }
          if (b.pos.x >  3.3) { b.pos.x =  3.3; b.vel.x = -Math.abs(b.vel.x) * 0.45; }
          if (b.pos.z >  1.96) { b.pos.z =  1.96; b.vel.z = -Math.abs(b.vel.z) * 0.45; }

          // Curved Deal Tray Side Rails & Cage Glass / Bar Collisions
          const inPassThrough = Math.abs(b.pos.x) < 0.68 && b.pos.y < 0.37;
          if (!inPassThrough && b.pos.z < CAGE_Z + 0.16 && b.pos.z > CAGE_Z - 0.35) {
            b.pos.z = CAGE_Z + 0.16;
            if (b.vel.z < 0) {
              const imp = Math.abs(b.vel.z);
              b.vel.z = imp * 0.48;
              if (imp > 0.5) sound.playChipClack(imp * 0.32, true);
            }
          }
          if (b.pos.z < -1.12) {
            b.pos.z = -1.12;
            b.vel.z = Math.abs(b.vel.z) * 0.5;
          }

          // Sleep check
          if (b.wobbleAmp === 0 && b.vel.lengthSq() < 0.0016 && b.angVel.lengthSq() < 0.01 && Math.abs(b.pos.y - (surfY + b.halfH)) < 0.015) {
            b.sleepFrames++;
          } else {
            b.sleepFrames = 0;
          }
        }

        // Chip-to-Chip Collisions, Stable Stacking & Domino Toppling
        const n = physicsChips.length;
        for (let i = 0; i < n; i++) {
          const a = physicsChips[i];
          if (a.kinematic) continue;
          for (let j = i + 1; j < n; j++) {
            const b = physicsChips[j];
            if (b.kinematic) continue;
            if (a.sleepFrames > 28 && b.sleepFrames > 28) continue;

            const dx = b.pos.x - a.pos.x;
            const dz = b.pos.z - a.pos.z;
            const distSqXZ = dx * dx + dz * dz;
            const minR = a.radius + b.radius;

            if (distSqXZ < minR * minR) {
              const dy = b.pos.y - a.pos.y;
              const minY = a.halfH + b.halfH;
              if (Math.abs(dy) < minY) {
                const distXZ = Math.sqrt(distSqXZ) || 0.0001;
                const overlapXZ = minR - distXZ;
                const overlapY = minY - Math.abs(dy);

                if (overlapY < overlapXZ * 0.74 && distXZ < minR * 0.78) {
                  // Vertical stacking
                  const top = dy >= 0 ? b : a;
                  const bot = dy >= 0 ? a : b;
                  if (top !== grabbedChip) {
                    top.pos.y = bot.pos.y + minY;
                    const relVy = top.vel.y - bot.vel.y;
                    if (relVy < 0) {
                      if (Math.abs(relVy) > 0.65) {
                        sound.playChipClack(Math.abs(relVy) * 0.25, top.spec.type === 'plaque');
                      }
                      top.vel.y = bot.vel.y + Math.abs(relVy) * 0.1;
                    }
                    top.vel.x = THREE.MathUtils.lerp(top.vel.x, bot.vel.x, 0.38);
                    top.vel.z = THREE.MathUtils.lerp(top.vel.z, bot.vel.z, 0.38);
                    top.rot.x *= 0.65;
                    top.rot.z *= 0.65;

                    // Topple if center of mass overhangs too far
                    if (distXZ > minR * 0.56) {
                      const push = (distXZ - minR * 0.56) * 6.5;
                      top.vel.x += (dx / distXZ) * (dy >= 0 ? push : -push) * h;
                      top.vel.z += (dz / distXZ) * (dy >= 0 ? push : -push) * h;
                      top.sleepFrames = 0;
                    }
                  }
                } else {
                  // Horizontal collision impulse (also works when dragging a chip through stacks!)
                  const nx = dx / distXZ;
                  const nz = dz / distXZ;
                  const sep = overlapXZ * 0.52;

                  if (a !== grabbedChip) { a.pos.x -= nx * sep; a.pos.z -= nz * sep; }
                  if (b !== grabbedChip) { b.pos.x += nx * sep; b.pos.z += nz * sep; }

                  const rvx = b.vel.x - a.vel.x;
                  const rvz = b.vel.z - a.vel.z;
                  const vn = rvx * nx + rvz * nz;

                  if (vn < 0) {
                    const jImp = -0.74 * vn;
                    if (a !== grabbedChip) { a.vel.x -= jImp * nx; a.vel.z -= jImp * nz; a.sleepFrames = 0; }
                    if (b !== grabbedChip) { b.vel.x += jImp * nx; b.vel.z += jImp * nz; b.sleepFrames = 0; }
                    if (Math.abs(vn) > 0.75) sound.playChipClack(Math.abs(vn) * 0.22, false);
                  }
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < physicsChips.length; i++) {
        const b = physicsChips[i];
        b.mesh.position.copy(b.pos);
        b.mesh.rotation.copy(b.rot);
      }
    }

    function wakeAllChips() {
      physicsChips.forEach(b => { b.sleepFrames = 0; });
    }

    // =========================================================================
    // 8. ANIMATED 3D PROPS (CASH SLIDE, MARKER STAMP, VAULT WHEEL VIP DROP)
    // =========================================================================
    const activeProps = [];

    function animateCashSlide(dir = 'in', stacksCount = 3, onDone = null) {
      sound.playCashRustle();
      sound.playTraySlide();
      const group = new THREE.Group();
      const count = Math.min(6, Math.max(1, stacksCount));
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.064, 0.175), cashMat);
        m.position.set((i % 2 - 0.5) * 0.38, 0.034 + Math.floor(i / 2) * 0.066, 0);
        m.rotation.y = (Math.random() - 0.5) * 0.1;
        m.castShadow = true;
        group.add(m);
      }
      const startZ = dir === 'in' ? 1.48 : -1.38;
      const endZ = dir === 'in' ? -1.42 : 1.24;
      group.position.set(0, 0.02, startZ);
      scene.add(group);

      activeProps.push({
        type: 'slide', mesh: group, t: 0, dur: 0.64,
        startZ, endZ, removeAfter: dir === 'in' ? 0.05 : 0.95, onDone
      });
    }

    function animateMarkerApproval(amount, onStamped) {
      sound.playTraySlide();
      const cardMat = new THREE.MeshPhysicalMaterial({
        map: createMarkerContractTexture(amount, false),
        roughness: 0.36, metalness: 0.28, clearcoat: 0.4
      });
      const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.018, 0.78), cardMat);
      cardMesh.position.set(0, 0.03, -1.35);
      cardMesh.castShadow = true;
      scene.add(cardMesh);

      const stampGroup = new THREE.Group();
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.22), matSmokedBrass);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.26, 16), matIridescentTray);
      neck.position.y = 0.18;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 16), matWalnut);
      knob.position.y = 0.34;
      stampGroup.add(head, neck, knob);
      stampGroup.position.set(0.12, 1.9, 0.68);
      stampGroup.rotation.y = 0.2;
      scene.add(stampGroup);

      activeProps.push({
        type: 'marker', cardMesh, cardMat, stampGroup, amount, t: 0, stamped: false, onStamped
      });
    }

    const vaultAnim = { active: false, t: 0, cooldown: 0 };

    function triggerVaultVIPDrop() {
      if (vaultAnim.active) return;
      if (vaultAnim.cooldown > 0) {
        showToast('Vault locking mechanism resetting…', 'brass');
        return;
      }
      vaultAnim.active = true;
      vaultAnim.t = 0;
      vaultAnim.cooldown = 5.5;
      sound.playVaultGears();
      showToast('Vault wheel unlocked: display plaque (not part of your chips)', 'brass');

      // A showpiece plaque only: it is not part of the player's balance and clears itself.
      setTimeout(() => {
        const plaque = spawnPhysicsChip(5000, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, -0.7), new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8, 3.2));
        if (plaque) { plaque.decor = true; setTimeout(() => removePhysicsChip(plaque), 9000); }
      }, 950);
    }

    function updateProps(dt) {
      if (vaultAnim.cooldown > 0) vaultAnim.cooldown = Math.max(0, vaultAnim.cooldown - dt);
      if (vaultAnim.active) {
        vaultAnim.t += dt;
        const t = vaultAnim.t;
        if (t < 1.0) {
          vaultWheelGroup.rotation.z = t * Math.PI * 3.8;
        } else if (t < 2.35) {
          const ease = Math.sin(((t - 1.0) / 1.35) * Math.PI * 0.5);
          vaultDoorPivot.rotation.y = ease * 0.54;
          vaultLight.intensity = 3.0 + ease * 32;
        } else if (t < 3.85) {
          const ease = 1 - Math.sin(((t - 2.35) / 1.5) * Math.PI * 0.5);
          vaultDoorPivot.rotation.y = ease * 0.54;
          vaultLight.intensity = 3.0 + ease * 32;
        } else {
          vaultDoorPivot.rotation.y = 0;
          vaultLight.intensity = 3.0;
          vaultAnim.active = false;
        }
      }

      for (let i = activeProps.length - 1; i >= 0; i--) {
        const p = activeProps[i];
        p.t += dt;
        if (p.type === 'slide') {
          const u = Math.min(1, p.t / p.dur);
          const ease = 1 - Math.pow(1 - u, 3);
          p.mesh.position.z = THREE.MathUtils.lerp(p.startZ, p.endZ, ease);
          p.mesh.position.y = getSurfaceHeight(0, p.mesh.position.z) + 0.025;
          if (p.t >= p.dur && p.onDone) { const cb = p.onDone; p.onDone = null; cb(); }
          if (p.t >= p.dur + p.removeAfter) { scene.remove(p.mesh); activeProps.splice(i, 1); }
        } else if (p.type === 'marker') {
          const t = p.t;
          if (t < 0.62) {
            const ease = 1 - Math.pow(1 - t / 0.62, 3);
            p.cardMesh.position.z = THREE.MathUtils.lerp(-1.35, 0.74, ease);
            p.cardMesh.position.y = getSurfaceHeight(0, p.cardMesh.position.z) + 0.02;
          } else if (t < 0.88) {
            const u = (t - 0.62) / 0.26;
            p.stampGroup.position.y = THREE.MathUtils.lerp(1.9, 0.09, u * u * u);
          } else if (!p.stamped) {
            p.stamped = true;
            p.stampGroup.position.y = 0.09;
            sound.playStampThud();
            camShakeTime = 0.28;
            camShakeStrength = 0.09;
            p.cardMat.map = createMarkerContractTexture(p.amount, true);
            p.cardMat.needsUpdate = true;
            if (p.onStamped) p.onStamped();
          } else if (t > 1.2 && t < 1.8) {
            const u = (t - 1.2) / 0.6;
            p.stampGroup.position.y = THREE.MathUtils.lerp(0.09, 2.6, u * u);
          } else if (t > 2.3 && t < 2.9) {
            const u = (t - 2.3) / 0.6;
            p.cardMesh.position.z = THREE.MathUtils.lerp(0.74, -1.5, u * u);
          } else if (t >= 2.9) {
            scene.remove(p.cardMesh);
            scene.remove(p.stampGroup);
            activeProps.splice(i, 1);
          }
        }
      }
    }


    // =========================================================================
    // 9. CASINO ECONOMY: every chip on the felt is a chip in the player's balance (host.chips())
    // =========================================================================
    const state = { mode: 'buy', buyAmount: 1000, sellAmount: 'ALL', markerAmount: 1000 };
    const money = (n) => '$' + Math.floor(n).toLocaleString('en-NZ');
    // Chips under $10 (and anything past the felt's chip cap) are held in the cage tray, not drawn.
    let dust = 0, busyUntil = 0;
    const FELT_CAP = 90;
    const liveChips = () => physicsChips.filter(b => !b.removeOnArrive && !b.decor);
    const walletChips = () => Math.max(0, Math.floor(host.chips()));

    function getTotalChipValue() {
      return liveChips().reduce((s, b) => s + b.value, 0);
    }

    const LEGACY = {
      100: [25, 25, 10, 10, 10, 10, 10],
      500: [100, 100, 100, 100, 25, 25, 25, 25],
      1000: [500, 100, 100, 100, 100, 25, 25, 25, 25],
      2500: [1000, 500, 500, 100, 100, 100, 100, 100]
    };
    // $10 and $25 chips can make any multiple of 5 from $25 up, and any multiple of 10.
    const representable = (x) => x === 0 || x % 10 === 0 || (x >= 25 && x % 5 === 0);

    function breakdownAmount(amount, preferHigh = false) {
      amount = Math.floor(amount);
      if (!preferHigh && LEGACY[amount]) return LEGACY[amount].slice();
      let target = amount;
      while (target > 0 && !representable(target)) target--;
      const out = [];
      let rem = target;
      for (const d of [5000, 1000, 500, 100, 25, 10]) {
        while (rem >= d && representable(rem - d)) { out.push(d); rem -= d; }
      }
      return out;
    }

    function pourChipsFromTray(values) {
      values = values.slice(0, FELT_CAP);
      sound.playTraySlide();
      busyUntil = performance.now() + values.length * 52 + 600;
      if (physicsChips.length + values.length > MAX_CHIPS) {
        silentConsolidate();
      }
      values.forEach((val, idx) => {
        setTimeout(() => {
          const pos = new THREE.Vector3(
            (Math.random() - 0.5) * 0.54,
            0.16 + (idx % 3) * 0.052,
            -0.62 - Math.random() * 0.22
          );
          const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 1.45,
            0.48 + Math.random() * 0.85,
            3.0 + Math.random() * 1.45
          );
          spawnPhysicsChip(val, pos, vel);
          updateHUD();
        }, idx * 52);
      });
    }

    /** Make the felt match the player's balance (first visit, or after winning/losing at a table). */
    function syncFelt() {
      if (performance.now() < busyUntil) { updateHUD(); return; }
      const want = walletChips();
      const parts = breakdownAmount(want, true).slice(0, FELT_CAP);
      const sum = parts.reduce((a, b) => a + b, 0);
      dust = want - sum;
      const pending = physicsChips.some(b => b.removeOnArrive);
      if (getTotalChipValue() === sum && !pending) { updateHUD(); return; }
      while (physicsChips.length) removePhysicsChip(physicsChips[0]);
      pourChipsFromTray(parts);
      updateHUD();
    }

    function executeBuy() {
      const cash = Math.floor(host.cash());
      const amt = state.buyAmount === 'MAX' ? Math.floor(cash / 10) * 10 : state.buyAmount;
      if (amt < 10 || cash < amt) {
        showToast('Not enough cash. Try a smaller amount or take a marker.', 'crimson');
        return;
      }
      host.setCash(host.cash() - amt);
      host.setChips(host.chips() + amt);
      host.bought(amt);
      updateHUD();
      const chips = breakdownAmount(amt, amt >= 5000);
      animateCashSlide('in', Math.ceil(amt / 1500), () => pourChipsFromTray(chips));
      showToast(`Bought ${money(amt)} in Mosaic chips`, 'emerald');
      host.changed();
    }

    function executeCashOut() {
      const active = liveChips();
      if (walletChips() <= 0) {
        showToast('No chips to cash out.', 'brass');
        return;
      }

      let targets = [];
      let totalVal = 0;

      if (state.sellAmount === 'ALL') {
        targets = active;
        totalVal = walletChips();
      } else {
        const goal = state.sellAmount;
        const sorted = [...active].sort((a, b) => b.value - a.value);
        let rem = goal;
        for (const c of sorted) {
          if (c.value <= rem) {
            targets.push(c);
            rem -= c.value;
            totalVal += c.value;
          }
        }
        // If no exact subset matched, cash out the single smallest chip >= goal or highest available
        if (targets.length === 0 && sorted.length) {
          const smallestOver = [...active].sort((a, b) => a.value - b.value).find(c => c.value >= goal) || sorted[0];
          targets = [smallestOver];
          totalVal = smallestOver.value;
        }
      }
      if (totalVal <= 0) { showToast('No chips on the felt to cash out.', 'brass'); return; }

      sound.playTraySlide();
      targets.forEach((b, idx) => {
        b.kinematic = true;
        b.removeOnArrive = true;
        b.targetPos = new THREE.Vector3((Math.random() - 0.5) * 0.48, 0.08 + (idx % 4) * 0.03, -1.38);
      });
      host.setChips(host.chips() - totalVal);
      host.setCash(host.cash() + totalVal);
      host.cashedOut(totalVal);
      if (state.sellAmount === 'ALL') dust = 0;
      updateHUD();
      setTimeout(() => {
        animateCashSlide('out', Math.ceil(totalVal / 1500));
        showToast(`Cashed out ${money(totalVal)} to cash`, 'emerald');
      }, 400);
      host.changed();
    }

    function executeRequestMarker() {
      if (host.debt() > 0) {
        showToast(`Settle your ${money(host.debt())} marker first.`, 'crimson');
        return;
      }
      const amt = state.markerAmount;
      const got = host.borrow(amt);
      if (!got) {
        showToast(`The cage won't mark ${money(amt)}. Your limit is lower.`, 'crimson');
        return;
      }
      host.setChips(host.chips() + got);
      updateHUD();
      const chips = breakdownAmount(got, true);
      animateMarkerApproval(got, () => {
        pourChipsFromTray(chips);
        showToast(`Marker approved: +${money(got)}. You owe ${money(host.debt())}`, 'brass');
      });
      host.changed();
    }

    function executeRepayMarker() {
      const totalDebt = Math.floor(host.debt());
      if (totalDebt <= 0) {
        showToast('No active marker.', 'brass');
        return;
      }
      const cash = Math.floor(host.cash());
      if (walletChips() + cash < totalDebt) {
        showToast(`Need ${money(totalDebt)} in chips and cash to settle.`, 'crimson');
        return;
      }
      // Chips first (largest that fit), then cash for what is left, then change a chip if cash can't cover it.
      let rem = totalDebt;
      const sorted = liveChips().sort((a, b) => b.value - a.value);
      const swept = [];
      for (const c of sorted) {
        if (rem >= c.value) { rem -= c.value; swept.push(c); }
      }
      let taken = swept.reduce((s, c) => s + c.value, 0), change = 0;
      if (rem > 0) {
        if (cash >= rem) {
          host.setCash(host.cash() - rem);
          animateCashSlide('in', Math.ceil(rem / 1500));
        } else {
          const extra = sorted.find(c => !swept.includes(c) && c.value >= rem);
          if (extra) {
            swept.push(extra);
            taken += extra.value;
            change = extra.value - rem;
          } else {
            // Only tray dust is left to cover it: take it from the balance directly.
            taken += rem;
          }
        }
      }
      swept.forEach(b => {
        b.kinematic = true; b.removeOnArrive = true;
        b.targetPos = new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.09, -1.38);
      });
      host.setChips(host.chips() - taken + change);
      host.settle();
      if (change >= 10) setTimeout(() => pourChipsFromTray(breakdownAmount(change)), 480);
      sound.playStampThud();
      updateHUD();
      showToast(`Marker settled in full (${money(totalDebt)})`, 'emerald');
      host.changed();
    }

    function executeColorUp() {
      const total = getTotalChipValue();
      if (total < 25) { showToast('Need at least $25 in chips to colour up.', 'brass'); return; }
      const optimal = breakdownAmount(total, true);
      if (optimal.length >= liveChips().length) {
        showToast('Chips are already at maximum denominations.', 'brass');
        return;
      }
      sound.playTraySlide();
      liveChips().forEach(b => {
        b.kinematic = true; b.removeOnArrive = true;
        b.targetPos = new THREE.Vector3((Math.random() - 0.5) * 0.48, 0.08, -1.35);
      });
      setTimeout(() => {
        pourChipsFromTray(optimal);
        showToast(`Coloured up ${money(total)} into ${optimal.length} chips`, 'brass');
      }, 390);
    }

    function executeBreakDown() {
      const active = liveChips().filter(b => b.value > 10);
      if (active.length === 0) { showToast('No chip above $10 to break down.', 'brass'); return; }
      active.sort((a, b) => b.value - a.value);
      const target = active[0];
      const v = target.value;

      let pieces = [];
      if (v === 5000) pieces = [1000, 1000, 1000, 1000, 500, 500];
      else if (v === 1000) pieces = [500, 100, 100, 100, 100, 100];
      else if (v === 500) pieces = [100, 100, 100, 100, 25, 25, 25, 25];
      else if (v === 100) pieces = [25, 25, 25, 25];
      else if (v === 25) pieces = [10, 10];

      target.kinematic = true; target.removeOnArrive = true;
      target.targetPos = new THREE.Vector3(0, 0.1, -1.35);
      sound.playTraySlide();
      if (v === 25) { host.setChips(host.chips() - 5); host.setCash(host.cash() + 5); } // the $5 left over is paid in cash

      setTimeout(() => {
        pourChipsFromTray(pieces);
        updateHUD();
        showToast(`Broke ${money(v)} into ${pieces.length} lower chips`, 'emerald');
      }, 350);
      host.changed();
    }

    function silentConsolidate() {
      const total = getTotalChipValue();
      while (physicsChips.length > 0) removePhysicsChip(physicsChips[0]);
      breakdownAmount(total, true).forEach((v, i) => {
        spawnPhysicsChip(v, new THREE.Vector3(-1.4 + (i % 6) * 0.54, 0.06 + Math.floor(i / 6) * 0.055, 0.98));
      });
    }


    // =========================================================================
    // 10. PHYSICS TOY CONTROLS: AUTO-STACK, RIFFLE SHUFFLE, SCATTER, TOWER DROP
    // =========================================================================
    function actionAutoStack() {
      const active = physicsChips.filter(b => !b.removeOnArrive);
      if (active.length === 0) return;

      const byDenom = {};
      CHIP_SPECS.forEach(s => { byDenom[s.value] = []; });
      active.forEach(b => { if (byDenom[b.value]) byDenom[b.value].push(b); });

      const order = [10, 25, 100, 500, 1000, 5000];
      let delayIdx = 0;
      order.forEach((val, col) => {
        const list = byDenom[val];
        const baseX = -1.62 + col * 0.64;
        list.forEach((b, idx) => {
          const stackCol = Math.floor(idx / 12);
          const row = idx % 12;
          const x = baseX + (stackCol % 2 === 0 ? 0 : 0.14);
          const z = 1.08 - stackCol * 0.44;
          const y = getSurfaceHeight(x, z) + b.halfH + row * (b.spec.height + 0.002);

          setTimeout(() => {
            if (!physicsChips.includes(b) || b.removeOnArrive) return;
            b.kinematic = true;
            b.targetPos = new THREE.Vector3(x, y, z);
          }, delayIdx * 18);
          delayIdx++;
        });
      });
      showToast('Auto-stacked into denomination towers', 'brass');
    }

    function actionRiffleShuffle() {
      const chipsOnly = physicsChips.filter(b => !b.removeOnArrive && b.spec.type === 'chip');
      if (chipsOnly.length < 4) {
        showToast('Need at least 4 chips on the felt to riffle-shuffle.', 'brass');
        return;
      }

      // Split into two neat halves on left & right of felt center
      const half = Math.floor(chipsOnly.length / 2);
      const left = chipsOnly.slice(0, half);
      const right = chipsOnly.slice(half);

      left.forEach((b, i) => {
        b.kinematic = true;
        b.targetPos = new THREE.Vector3(-0.34, 0.04 + i * 0.048, 0.98);
      });
      right.forEach((b, i) => {
        b.kinematic = true;
        b.targetPos = new THREE.Vector3(0.34, 0.04 + i * 0.048, 0.98);
      });

      // After lining up, interleave & drop them together mid-air with rhythmic clay clatter!
      setTimeout(() => {
        const maxLen = Math.max(left.length, right.length);
        let mergedRow = 0;
        for (let i = 0; i < maxLen; i++) {
          [left[i], right[i]].forEach((b, side) => {
            if (!b || !physicsChips.includes(b) || b.removeOnArrive) return;
            const rowIndex = mergedRow++;
            setTimeout(() => {
              b.kinematic = false;
              b.targetPos = null;
              b.sleepFrames = 0;
              b.pos.set(side === 0 ? -0.14 : 0.14, 0.35 + rowIndex * 0.062, 0.98);
              b.vel.set(side === 0 ? 0.85 : -0.85, -1.6, (Math.random() - 0.5) * 0.25);
              b.angVel.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3);
              sound.playChipClack(0.75, false);
            }, rowIndex * 34);
          });
        }
      }, 360);
      showToast('Riffle-shuffling chip stacks', 'emerald');
    }

    function actionScatter() {
      const active = physicsChips.filter(b => !b.removeOnArrive);
      if (active.length === 0) return;
      wakeAllChips();
      sound.playChipClack(1.3, true);
      active.forEach(b => {
        b.kinematic = false; b.targetPos = null;
        const dx = b.pos.x + (Math.random() - 0.5) * 0.4;
        const dz = (b.pos.z - 0.95) + (Math.random() - 0.5) * 0.4;
        const len = Math.hypot(dx, dz) || 1;
        const spd = 2.6 + Math.random() * 3.2;
        b.vel.set((dx / len) * spd, 1.5 + Math.random() * 2.4, (dz / len) * spd);
        b.angVel.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      });
    }

    function actionTowerDrop() {
      const active = physicsChips.filter(b => !b.removeOnArrive);
      if (active.length === 0) return;
      wakeAllChips();
      active.forEach((b, i) => {
        b.kinematic = false; b.targetPos = null;
        b.pos.set((Math.random() - 0.5) * 0.38, 1.35 + i * 0.085, 0.96 + (Math.random() - 0.5) * 0.38);
        b.vel.set((Math.random() - 0.5) * 0.7, -0.8, (Math.random() - 0.5) * 0.7);
        b.angVel.set((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 11);
      });
      showToast('Tower Drop unleashed', 'brass');
    }

    // =========================================================================
    // 11. RICH DIRECT POINTER PHYSICS (DRAG & THROW, SWIPE SCATTER, CLICK-FLICK)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const feltPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);

    let interactionMode = null; // 'grab' | 'sweep' | null
    let grabDownTime = 0;
    let grabDownScreen = { x: 0, y: 0 };
    let dragHistory = [];
    let lastSweepWorld = new THREE.Vector3();

    function getPointerCoords(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
      return { cx, cy };
    }

    renderer.domElement.addEventListener('pointerdown', (e) => {
      sound.init();
      const { cx, cy } = getPointerCoords(e);
      raycaster.setFromCamera(pointer, camera);

      // 1. Check Vault Wheel Click
      if (raycaster.intersectObject(vaultWheelGroup, true).length > 0) {
        triggerVaultVIPDrop();
        return;
      }

      // 2. Check Direct Chip Grab / Click-Flick
      const hits = raycaster.intersectObjects(physicsChips.map(b => b.mesh), false);
      if (hits.length > 0) {
        const body = physicsChips.find(b => b.mesh === hits[0].object);
        if (body && !body.removeOnArrive) {
          grabbedChip = body;
          grabbedChip.kinematic = false;
          grabbedChip.targetPos = null;
          grabbedChip.sleepFrames = 0;
          grabbedChip.wobbleAmp = 0;
          interactionMode = 'grab';
          controls.enabled = false;
          grabDownTime = performance.now();
          grabDownScreen = { x: cx, y: cy };
          dragHistory = [];

          const hitPt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(feltPlane, hitPt)) {
            dragHistory.push({ pt: hitPt.clone(), t: grabDownTime });
          }
          grabGlowRing.visible = true;
          grabGlowRing.position.set(body.pos.x, getSurfaceHeight(body.pos.x, body.pos.z) + 0.008, body.pos.z);
          sound.playChipClack(0.55, body.spec.type === 'plaque');
          return;
        }
      }

      // 3. Check Swipe / Scatter on Felt near Chips
      const feltHit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(feltPlane, feltHit)) {
        const nearAny = physicsChips.some(b => !b.kinematic && Math.hypot(b.pos.x - feltHit.x, b.pos.z - feltHit.z) < 0.72);
        if (nearAny && Math.abs(feltHit.x) < 2.3 && feltHit.z > 0.15 && feltHit.z < 2.0) {
          interactionMode = 'sweep';
          controls.enabled = false;
          lastSweepWorld.copy(feltHit);
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!interactionMode) return;
      getPointerCoords(e);
      raycaster.setFromCamera(pointer, camera);

      const curr = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(feltPlane, curr)) return;

      if (interactionMode === 'grab' && grabbedChip) {
        const clampedX = THREE.MathUtils.clamp(curr.x, -3.1, 3.1);
        const clampedZ = THREE.MathUtils.clamp(curr.z, -0.35, 1.9);
        const surfY = getSurfaceHeight(clampedX, clampedZ);

        // Smooth lift & tilt toward drag direction
        const dx = clampedX - grabbedChip.pos.x;
        const dz = clampedZ - grabbedChip.pos.z;
        grabbedChip.pos.set(clampedX, surfY + 0.28, clampedZ);
        grabbedChip.vel.set(dx * 22, 0, dz * 22);
        grabbedChip.rot.x = THREE.MathUtils.clamp(dz * 1.4, -0.45, 0.45);
        grabbedChip.rot.z = THREE.MathUtils.clamp(-dx * 1.4, -0.45, 0.45);

        grabGlowRing.position.set(clampedX, surfY + 0.008, clampedZ);

        const now = performance.now();
        dragHistory.push({ pt: new THREE.Vector3(clampedX, 0, clampedZ), t: now });
        if (dragHistory.length > 6) dragHistory.shift();
      } else if (interactionMode === 'sweep') {
        const delta = curr.clone().sub(lastSweepWorld);
        if (delta.lengthSq() > 0.0003) {
          physicsChips.forEach(b => {
            if (b.kinematic) return;
            const d = Math.hypot(b.pos.x - curr.x, b.pos.z - curr.z);
            if (d < 0.78) {
              const f = (1 - d / 0.78) * 16.0;
              b.sleepFrames = 0;
              b.vel.x += delta.x * f;
              b.vel.z += delta.z * f;
              b.vel.y += Math.min(1.5, delta.length() * 3.8);
              b.angVel.y += (Math.random() - 0.5) * 10;
            }
          });
          lastSweepWorld.copy(curr);
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!interactionMode) return;

      if (interactionMode === 'grab' && grabbedChip) {
        const elapsed = performance.now() - grabDownTime;
        const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const movedPx = Math.hypot(cx - grabDownScreen.x, cy - grabDownScreen.y);

        if (elapsed < 190 && movedPx < 8) {
          // Crisp Click-Flick upward spin-flip!
          grabbedChip.vel.set((Math.random() - 0.5) * 1.4, 3.2, (Math.random() - 0.5) * 1.4);
          grabbedChip.angVel.set(14 + Math.random() * 6, 10, (Math.random() - 0.5) * 10);
          sound.playChipClack(0.95, grabbedChip.spec.type === 'plaque');
        } else if (dragHistory.length >= 2) {
          // Real Throw Momentum & Spin from drag history!
          const first = dragHistory[0];
          const last = dragHistory[dragHistory.length - 1];
          const dtSec = Math.max(0.016, (last.t - first.t) / 1000);
          const vx = THREE.MathUtils.clamp((last.pt.x - first.pt.x) / dtSec, -10, 10);
          const vz = THREE.MathUtils.clamp((last.pt.z - first.pt.z) / dtSec, -10, 10);
          const spd = Math.hypot(vx, vz);
          grabbedChip.vel.set(vx * 0.92, Math.min(2.6, 0.35 + spd * 0.25), vz * 0.92);
          grabbedChip.angVel.set(vz * 1.8, (Math.random() - 0.5) * 14, -vx * 1.8);
        }

        grabbedChip.sleepFrames = 0;
        grabbedChip = null;
        grabGlowRing.visible = false;
      }

      interactionMode = null;
      controls.enabled = true;
    });

    // =========================================================================
    // 12. CONTROLS (inside the casino frame: bar above, dock below, nothing floats over the scene's text)
    // =========================================================================
    const hud = {
      cash: root.querySelector('[data-hud="cash"]'),
      chips: root.querySelector('[data-hud="chips"]'),
      debt: root.querySelector('[data-hud="debt"]')
    };
    const elActionStrip = root.querySelector('.cage-strip');
    const toastFeed = root.querySelector('.cage-toasts');
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

    function showToast(msg, tone = 'brass') {
      const div = el('div', `cage-toast t-${tone}`, msg);
      while (toastFeed.children.length > 2) toastFeed.firstChild.remove();
      toastFeed.appendChild(div);
      setTimeout(() => div.remove(), 2900);
    }

    const short = (v) => v === 'MAX' || v === 'ALL' ? v : `$${v >= 1000 ? v / 1000 + 'K' : v}`;

    function renderDockActionStrip() {
      elActionStrip.replaceChildren();
      const pills = (values, key, tone) => {
        const wrap = el('div', 'cage-pills');
        values.forEach(val => {
          const b = el('button', 'cage-pill' + (state[key] === val ? ' on t-' + tone : ''), short(val));
          b.type = 'button';
          b.setAttribute('aria-pressed', String(state[key] === val));
          b.addEventListener('click', () => { state[key] = val; renderDockActionStrip(); });
          wrap.appendChild(b);
        });
        return wrap;
      };
      const cta = (text, tone, fn) => { const b = el('button', 'cage-cta t-' + tone, text); b.type = 'button'; b.addEventListener('click', fn); return b; };

      if (state.mode === 'buy') {
        elActionStrip.append(pills([100, 500, 1000, 5000, 'MAX'], 'buyAmount', 'emerald'),
          cta(state.buyAmount === 'MAX' ? 'Buy max' : `Buy $${state.buyAmount.toLocaleString()}`, 'emerald', executeBuy));
      } else if (state.mode === 'sell') {
        elActionStrip.append(pills([100, 500, 1000, 5000, 'ALL'], 'sellAmount', 'brass'),
          cta(state.sellAmount === 'ALL' ? 'Cash out all' : `Cash out $${state.sellAmount.toLocaleString()}`, 'brass', executeCashOut));
      } else if (state.mode === 'marker') {
        const acts = el('div', 'cage-acts');
        if (host.debt() > 0) acts.appendChild(cta(`Repay ${money(host.debt())}`, 'brass', executeRepayMarker));
        acts.appendChild(cta(`Issue $${state.markerAmount.toLocaleString()}`, 'crimson', executeRequestMarker));
        elActionStrip.append(pills([1000, 2500, 5000], 'markerAmount', 'crimson'), acts);
      } else {
        const acts = el('div', 'cage-acts');
        const brk = el('button', 'cage-cta t-plain', 'Break highest'); brk.type = 'button'; brk.addEventListener('click', executeBreakDown);
        acts.append(brk, cta('Colour up all', 'brass', executeColorUp));
        elActionStrip.append(el('span', 'cage-note', 'Consolidate stacks or break a plaque'), acts);
      }
    }

    function updateHUD() {
      hud.cash.textContent = money(host.cash());
      hud.chips.textContent = money(walletChips());
      const debt = Math.floor(host.debt());
      hud.debt.textContent = money(debt);
      hud.debt.classList.toggle('debt-active', debt > 0);
      if (state.mode === 'marker') renderDockActionStrip();
    }

    root.querySelectorAll('.cage-tabs [data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        root.querySelectorAll('.cage-tabs [data-mode]').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
        renderDockActionStrip();
      });
    });
    root.querySelectorAll('[data-cam]').forEach(btn => btn.addEventListener('click', () => goToCamera(btn.dataset.cam)));
    const acts = { stack: actionAutoStack, riffle: actionRiffleShuffle, scatter: actionScatter, tower: actionTowerDrop, vault: triggerVaultVIPDrop,
      mute: () => { const muted = sound.toggleMute(); showToast(muted ? 'Sound off' : 'Sound on', 'brass'); } };
    root.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => acts[btn.dataset.act]()));

    // The scene follows the size of its box (the casino frame resizes and the cashier tab is re-attached on every render).
    const resize = () => {
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stageEl);
    window.addEventListener('resize', resize);

    // =========================================================================
    // 13. MAIN LOOP: runs only while the cashier tab is on screen
    // =========================================================================
    const clock = new THREE.Clock();
    let attached = false;

    function animate() {
      requestAnimationFrame(animate);
      if (!root.isConnected || document.hidden || root.closest('.hidden')) { attached = false; clock.getDelta(); return; }
      if (!attached) { attached = true; resize(); syncFelt(); renderDockActionStrip(); }
      const dt = Math.min(clock.getDelta(), 0.045);

      stepPhysics(dt);
      updateProps(dt);

      if (camLerpActive) {
        camera.position.lerp(camGoalPos, 1 - Math.exp(-5.8 * dt));
        controls.target.lerp(camGoalTarget, 1 - Math.exp(-5.8 * dt));
        if (camera.position.distanceTo(camGoalPos) < 0.02) camLerpActive = false;
      }

      if (camShakeTime > 0) {
        camShakeTime -= dt;
        const m = camShakeStrength * (camShakeTime / 0.28);
        camera.position.x += (Math.random() - 0.5) * m;
        camera.position.y += (Math.random() - 0.5) * m;
      }

      // Subtle breathing pulse on banker's lamp & grab glow ring
      bankerLight.intensity = 17.5 + Math.sin(clock.elapsedTime * 2.1) * 0.9;
      if (grabGlowRing.visible) {
        const s = 1 + Math.sin(clock.elapsedTime * 10) * 0.06;
        grabGlowRing.scale.set(s, s, 1);
      }

      controls.update();
      renderer.render(scene, camera);
    }

    renderDockActionStrip();
    updateHUD();
    resize();
    animate();
  }
}
