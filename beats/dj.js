/* mosaicDJ: a two-deck DJ controller for mosaicBeats, laid out like a Pioneer DDJ-SB3.
 *
 * What is in here
 *  - Audio engine: one AudioWorklet per deck reads the track at any speed, forwards or backwards, so the platter
 *    can scratch, spin back and brake. It also does loops, slip mode (the track keeps time underneath a roll or
 *    scratch) and key lock (a small pitch shifter that undoes the tempo fader's pitch change).
 *  - Physics: each jog wheel is a spinning platter with a motor. The record speed IS the audio speed, so a flick
 *    keeps spinning, a pause winds down, and a held platter stops the sound.
 *  - The controller: an SVG drawn to the DDJ-SB3's 482 x 272 mm top panel, every knob, fader, button and pad live.
 *  - The "laptop": waveforms, beat grids, library, and a crowd that reacts to how well you mix (see GAME below).
 *  - window.MDJ: the same controls exposed for dj-midi.js, which drives them from a real DDJ-SB3.
 *
 * It shares AudioContext AC, toast(), $ and showView/curView with index.html (classic scripts share globals).
 */
(() => {
'use strict';
const TAU = Math.PI * 2, W0 = TAU * (100 / 3) / 60;      // platter speed at 33 1/3 rpm, which plays the track at normal speed
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), wall = () => performance.now() / 1000;
const LS = (k, d) => { try { const v = localStorage.getItem('mdj.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const LSset = (k, v) => { try { localStorage.setItem('mdj.' + k, JSON.stringify(v)); } catch (e) { /* private window: settings just won't persist */ } };
const OPT = Object.assign({ cf: 'blend', quant: true, hp: 'auto', tempoInv: false, jogSens: 1, startT: 0.06, stopT: 0.05 }, LS('opt', {}));
const saveOpt = () => LSset('opt', OPT);
const HOTC = ['#e8352e', '#f07a1a', '#f2c81d', '#3fcf4b', '#1fc7c7', '#2f6ff2', '#9a4af2', '#ef3fa8'];   // hot cue colours, Serato order
const MODES = ['hot', 'fade', 'scratch', 'sampler'], ALT = { hot: 'jump', fade: 'roll', scratch: 'slicer', sampler: 'trans' };
const BASE = { hot: 'hot', jump: 'hot', fade: 'fade', roll: 'fade', scratch: 'scratch', slicer: 'scratch', sampler: 'sampler', trans: 'sampler' };
const MODE_NAME = { hot: 'HOT CUE', jump: 'BEAT JUMP', fade: 'FX FADE', roll: 'ROLL', scratch: 'PAD SCRATCH', slicer: 'SLICER', sampler: 'SAMPLER', trans: 'TRANS' };
const JUMPS = [-1, 1, -2, 2, -4, 4, -8, 8], JUMPS_SH = [-16, 16, -32, 32, -64, 64, 'start', 'end'];
const ROLLS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8], ROLL_LAB = ['1/16', '1/8', '1/4', '1/2', '1', '2', '4', '8'];
const TRANS = [1 / 8, 1 / 4, 1 / 2, 1, 1 / 3, 2 / 3, 2, 4], TRANS_LAB = ['1/32', '1/16', '1/8', '1/4', '1/12', '1/6', '1/2', '1'];
const FADES = [['HPF', 4, 'hpf'], ['LPF', 4, 'lpf'], ['ECHO OUT', 4, 'echo'], ['BRAKE', 2, 'brake'], ['HPF', 8, 'hpf'], ['LPF', 8, 'lpf'], ['WASH OUT', 8, 'wash'], ['BACKSPIN', 1, 'spin']];
const FXT = ['ECHO', 'FLANGER', 'REVERB', 'CRUSH'];
const FXB = [1 / 8, 1 / 4, 1 / 2, 3 / 4, 1, 2, 4], FXB_LAB = ['1/8', '1/4', '1/2', '3/4', '1', '2', '4'];
// Pad Scratch patterns: [length in beats, record speed (1 = normal play, minus = backwards), crossfader open 1 / closed 0]
const SCR = [
  ['BABY', [[.25, 2, 1], [.25, -2, 1], [.25, 2, 1], [.25, -2, 1]]],
  ['CHIRP', [[.25, 2.2, 1], [.25, -2.2, 0], [.25, 2.2, 1], [.25, -2.2, 0]]],
  ['TRANSFORM', [[.125, 1, 1], [.125, 1, 0], [.125, 1, 1], [.125, 1, 0], [.125, -1, 1], [.125, -1, 0], [.125, -1, 1], [.125, -1, 0]]],
  ['FLARE', [[.125, 2.4, 1], [.0625, 2.4, 0], [.0625, 2.4, 1], [.25, -2.4, 0], [.125, 2.4, 1], [.0625, 2.4, 0], [.0625, 2.4, 1], [.25, -2.4, 0]]],
  ['SCRIBBLE', Array.from({ length: 16 }, (_, i) => [.0625, i % 2 ? -3 : 3, 1])],
  ['TEAR', [[.125, 2.6, 1], [.0625, 0, 1], [.125, 2.6, 1], [.1875, -1.7, 1], [.125, 2.6, 1], [.0625, 0, 1], [.125, 2.6, 1], [.1875, -1.7, 1]]],
  ['STAB', [[.125, 3.5, 1], [.375, -1.2, 0], [.125, 3.5, 1], [.375, -1.2, 0]]],
  ['ORBIT', [[.1875, 2.6, 1], [.0625, 2.6, 0], [.1875, -2.6, 1], [.0625, -2.6, 0], [.1875, 2.6, 1], [.0625, 2.6, 0], [.1875, -2.6, 1], [.0625, -2.6, 0]]],
];
const SAMP_LAB = ['AIR HORN', 'SIREN', 'LASER', 'REWIND', 'SUB DROP', 'CLAP', 'CRASH', 'HEY!'];

/* ============================== deck worklet (runs on the audio thread) ============================== */
const WK = `
function herm(a,i,f){const xm=a[i-1],x0=a[i],x1=a[i+1],x2=a[i+2];const c=(x1-xm)*.5,v=x0-x1,w=c+v,q=w+v+(x2-x0)*.5,b=w+q;return((q*f-b)*f+c)*f+x0;}
class MDJDeck extends AudioWorkletProcessor{
  constructor(){super();this.L=null;this.R=null;this.n=0;this.pos=0;this.rate=0;this.tgt=0;this.la=-1;this.lb=-1;this.slip=false;this.ghost=0;this.motor=0;
    this.kl=false;this.F=1;this.ph=0;this.pw=0;this.bl=new Float32Array(8192);this.br=new Float32Array(8192);this.blk=0;this.ended=false;
    this.port.onmessage=(e)=>{const d=e.data;
      if(d.buf){this.L=d.buf[0];this.R=d.buf[1];this.n=this.L.length;this.pos=0;this.ghost=0;this.la=-1;this.lb=-1;this.rate=0;this.tgt=0;this.ended=false;this.slip=false;}
      if(d.rate!==undefined)this.tgt=d.rate; if(d.hard!==undefined){this.rate=d.hard;this.tgt=d.hard;} if(d.motor!==undefined)this.motor=d.motor; if(d.kl!==undefined)this.kl=d.kl;
      if(d.seek!==undefined){this.pos=Math.max(0,Math.min(this.n-1,d.seek));this.ended=false;if(!this.slip)this.ghost=this.pos;}
      if(d.nudge!==undefined){this.pos=Math.max(0,Math.min(this.n-1,this.pos+d.nudge));this.ghost=Math.max(0,Math.min(this.n-1,this.ghost+d.nudge));this.ended=false;}
      if(d.loop!==undefined){if(d.loop){this.la=d.loop[0];this.lb=d.loop[1];}else{this.la=-1;this.lb=-1;}}
      if(d.slip!==undefined){if(d.slip&&!this.slip)this.ghost=this.pos;else if(!d.slip&&this.slip){this.pos=Math.max(0,Math.min(this.n-1,this.ghost));this.ended=false;}this.slip=d.slip;}
    };}
  process(_,outs){const o=outs[0],oL=o[0],oR=o[1]||o[0],N=oL.length;
    if(!this.L){oL.fill(0);if(oR!==oL)oR.fill(0);return true;}
    const L=this.L,R=this.R,n=this.n,M=8191,W=2048;
    for(let i=0;i<N;i++){
      this.rate+=(this.tgt-this.rate)*.006;                    // ~4 ms glide so speed changes never click
      const p=this.pos,r=this.rate;let l=0,rr=0;
      if(p>=1&&p<n-3){const i0=p|0,f=p-i0;l=herm(L,i0,f);rr=herm(R,i0,f);}else if(p>=0&&p<n){const i0=p|0;l=L[i0];rr=R[i0];}
      let q=p+r;
      if(this.la>=0){const len=this.lb-this.la;if(len>0){if(q>=this.lb)q-=len;else if(r<0&&q<this.la&&p>=this.la)q+=len;}}
      if(q<0)q=0;if(q>n-1){q=n-1;if(!this.ended&&r>0){this.ended=true;this.port.postMessage({end:1});}}
      this.pos=q; if(this.slip){this.ghost+=this.motor;if(this.ghost>n-1)this.ghost=n-1;}
      if(this.kl||Math.abs(this.F-1)>1e-3){                     // key lock: two crossfaded moving taps undo the tempo's pitch change
        const tF=(this.kl&&this.motor>.2&&Math.abs(r-this.motor)<.03*this.motor)?1/this.motor:1;this.F+=(tF-this.F)*.0005;
        this.bl[this.pw]=l;this.br[this.pw]=rr;this.ph+=1-this.F;if(this.ph>=W)this.ph-=W;else if(this.ph<0)this.ph+=W;
        const s=Math.sin(Math.PI*this.ph/W),w1=s*s,w2=1-w1,d1=this.ph+3,d2=(this.ph+W/2)%W+3;
        const x1=this.pw-d1,x2=this.pw-d2,a1=Math.floor(x1),a2=Math.floor(x2),f1=x1-a1,f2=x2-a2,i1=a1&M,j1=(a1+1)&M,i2=a2&M,j2=(a2+1)&M;
        l=(this.bl[i1]+(this.bl[j1]-this.bl[i1])*f1)*w1+(this.bl[i2]+(this.bl[j2]-this.bl[i2])*f2)*w2;
        rr=(this.br[i1]+(this.br[j1]-this.br[i1])*f1)*w1+(this.br[i2]+(this.br[j2]-this.br[i2])*f2)*w2;this.pw=(this.pw+1)&M;}
      oL[i]=l;oR[i]=rr;}
    if(++this.blk%4===0)this.port.postMessage({pos:this.pos,g:this.ghost,rate:this.rate});
    return true;}}
registerProcessor('mdj-deck',MDJDeck);`;

/* ============================== state ============================== */
let inited = false, audioP = null, A = null;   // A = audio graph
const LIB = [], decks = [0, 1].map(mkDeck), C = {};
let libSel = 0, libTop = 0, masterCue = false, browseAng = 0, shiftKey = false;
const SAMPLES = [], sampPlaying = new Map();
function mkDeck(i) {
  return { i, trk: null, node: null, pos: 0, ghost: 0, wrate: 0, posT: 0, playing: false, cue: 0, cuePrev: false, cuePlayHit: false,
    pitch: 0, range: 0.08, keyLock: false, vinyl: true, slip: false, sync: false, takeover: false,
    loop: null, loopBeats: 4, lastLoop: null, roll: null, slicer: null, trans: null, pat: null, fade: null,
    th: 0, om: 0, tau: 0.08, free: false, touch: false, touchSrc: '', handOm: 0, handAcc: 0, bend: 0, syncBend: 0, brake: 0,
    pfl: false, mode: 'hot', shift: false, fx: [false, false, false], fxType: [0, 1, 2], fxBeat: 2, level: 0, post: 0, playedAt: 0, ended: false, sent: { rate: null, motor: null } };
}
const sr = () => AC.sampleRate;
const trkBpm = (d) => (d.trk ? d.trk.bpm : 120);
const motorRate = (d) => (d.playing ? (1 + d.pitch) : 0);
const bpmEff = (d) => trkBpm(d) * (1 + d.pitch);
const spbEff = (d) => 60 / bpmEff(d);
const beatLen = (d) => (60 / trkBpm(d)) * sr();                                // one beat in track samples
const estPos = (d) => (d.trk ? clamp(d.pos + d.wrate * sr() * Math.min(0.05, wall() - d.posT), 0, d.trk.n - 1) : 0);
const beatAt = (d, p = estPos(d)) => (d.trk ? (p / sr() - d.trk.grid) * d.trk.bpm / 60 : 0);
const posOfBeat = (d, b) => (d.trk.grid + b * 60 / d.trk.bpm) * sr();
const frac = (x) => x - Math.floor(x), wrapH = (x) => x - Math.round(x);
const post = (d, m) => { if (d.node) d.node.port.postMessage(m); };
function snapPos(d, p) { if (!OPT.quant || !d.trk) return p; return Math.max(0, posOfBeat(d, Math.round(beatAt(d, p)))); }

/* ============================== controls registry ============================== */
// Every continuous control lives here. The SVG, the keyboard and the DDJ-SB3 all call setC, so they always agree.
function ctl(id, def, onset) { C[id] = { v: def, def, onset, views: [] }; }
function setC(id, v, src) {
  const c = C[id]; if (!c) return; v = clamp(v, 0, 1);
  if (src === 'hw' && id.startsWith('tempo')) { const d = decks[+id.slice(5)]; if (d.takeover) { if (Math.abs(v - c.v) > 0.012) { c.hw = v; return; } d.takeover = false; } }
  c.v = v; if (c.onset) c.onset(v, src); for (const f of c.views) f(v);
}
const dB = (x) => Math.pow(10, x / 20);
const eqDb = (v) => (v <= 0.01 ? -40 : v < 0.5 ? -26 * (1 - v / 0.5) : 6 * (v - 0.5) / 0.5);
const trimDb = (v) => (v <= 0.01 ? -60 : v < 0.5 ? -24 * (1 - v / 0.5) : 9 * (v - 0.5) / 0.5);
function sm(param, v, t = 0.012) { if (A) param.setTargetAtTime(v, AC.currentTime, t); }
function defineControls() {
  for (const i of [0, 1]) {
    const d = decks[i];
    ctl('trim' + i, 0.5, (v) => A && sm(A.d[i].trim.gain, dB(trimDb(v))));
    ctl('hi' + i, 0.5, (v) => A && sm(A.d[i].hi.gain, eqDb(v)));
    ctl('mid' + i, 0.5, (v) => A && sm(A.d[i].mid.gain, eqDb(v)));
    ctl('low' + i, 0.5, (v) => A && sm(A.d[i].lo.gain, eqDb(v)));
    ctl('filt' + i, 0.5, (v) => applyFilter(i, v));
    ctl('fader' + i, 0.8, (v) => A && sm(A.d[i].ch.gain, v < 0.004 ? 0 : Math.pow(v, 1.6), 0.005));
    ctl('tempo' + i, 0.5, (v, src) => { const t = OPT.tempoInv ? 1 - v : v; d.pitch = (t - 0.5) * 2 * d.range; if (Math.abs(t - 0.5) < 0.006) d.pitch = 0; if (src !== 'sync') d.sync = false; });
    ctl('fxlvl' + i, 0.5, () => applyFx(i));
    ctl('fxbeat' + i, 2 / 6, (v) => { d.fxBeat = Math.round(v * (FXB.length - 1)); applyFx(i); });
  }
  ctl('xf', 0.5, () => applyXf());
  ctl('master', 0.75, (v) => A && sm(A.master.gain, Math.pow(v / 0.75, 1.5)));
  ctl('phones', 0.75, (v) => A && sm(A.phones.gain, Math.pow(v / 0.75, 1.5)));
}
function applyXf() {
  if (!A) return; const x = C.xf.v; let a, b;
  if (OPT.cf === 'cut') { a = x < 0.97 ? 1 : (1 - x) / 0.03; b = x > 0.03 ? 1 : x / 0.03; } else { a = Math.cos(x * Math.PI / 2); b = Math.sin(x * Math.PI / 2); }
  sm(A.d[0].xf.gain, a, 0.003); sm(A.d[1].xf.gain, b, 0.003);
}
function applyFilter(i, v) {
  if (!A) return; const f = A.d[i].filt, t = AC.currentTime;
  if (Math.abs(v - 0.5) < 0.02) { f.type = 'lowpass'; f.frequency.setTargetAtTime(22000, t, 0.02); f.Q.value = 0.7; return; }
  if (v < 0.5) { f.type = 'lowpass'; f.frequency.setTargetAtTime(20000 * Math.pow(120 / 20000, (0.48 - v) / 0.48), t, 0.015); }
  else { f.type = 'highpass'; f.frequency.setTargetAtTime(20 * Math.pow(6000 / 20, (v - 0.52) / 0.48), t, 0.015); }
  f.Q.value = 1.4;
}

/* ============================== audio graph ============================== */
function impulse(ctx, secs, decay) { const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = b.getChannelData(c); for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
function crushCurve() { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * 6) / 6; } return c; }
function ensureAudio() {
  if (audioP) return audioP;
  audioP = (async () => {
    await AC.audioWorklet.addModule(URL.createObjectURL(new Blob([WK], { type: 'text/javascript' })));
    const G = (v = 1) => { const g = AC.createGain(); g.gain.value = v; return g; };
    const masterIn = G(), master = G(), lim = AC.createDynamicsCompressor(), masterOut = G(), cueBus = G(), phones = G(), samplerG = G(0.8);
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    masterIn.connect(master); master.connect(lim); lim.connect(masterOut); samplerG.connect(masterIn); cueBus.connect(phones);
    const mAn = AC.createAnalyser(); mAn.fftSize = 512; masterOut.connect(mAn);
    const rvIR = impulse(AC, 2.6, 3), curve = crushCurve();
    const dd = decks.map((d) => {
      const node = new AudioWorkletNode(AC, 'mdj-deck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = (e) => { const m = e.data; if (m.end) { d.playing = false; d.om = 0; d.ended = true; post(d, { hard: 0 }); return; } d.pos = m.pos; d.ghost = m.g; d.wrate = m.rate; d.posT = wall(); };
      d.node = node;
      const trim = G(), lo = AC.createBiquadFilter(), mid = AC.createBiquadFilter(), hi = AC.createBiquadFilter(), filt = AC.createBiquadFilter(), ffilt = AC.createBiquadFilter();
      lo.type = 'lowshelf'; lo.frequency.value = 220; mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.7; hi.type = 'highshelf'; hi.frequency.value = 3500;
      filt.type = 'lowpass'; filt.frequency.value = 22000; ffilt.type = 'lowpass'; ffilt.frequency.value = 22000; ffilt.Q.value = 0.9;
      const pre = G(), dry = G(), mix = G(), fadeG = G(), gate = G(), cut = G(), ch = G(0.7), xf = G(0.7);
      node.connect(trim); trim.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(filt); filt.connect(ffilt); ffilt.connect(pre); pre.connect(dry); dry.connect(mix);
      // echo
      const eS = G(0), eD = AC.createDelay(4), eF = G(0.45), eW = G(1); eD.delayTime.value = 0.24; pre.connect(eS); eS.connect(eD); eD.connect(eF); eF.connect(eD); eD.connect(eW); eW.connect(mix);
      // flanger
      const fS = G(0), fD = AC.createDelay(0.05), fF = G(0.55), fW = G(1), lfo = AC.createOscillator(), lfoG = G(0.0022); fD.delayTime.value = 0.004; lfo.frequency.value = 0.25; lfo.connect(lfoG); lfoG.connect(fD.delayTime); lfo.start();
      pre.connect(fS); fS.connect(fD); fD.connect(fF); fF.connect(fD); fD.connect(fW); fW.connect(mix);
      // reverb
      const rS = G(0), rv = AC.createConvolver(), rW = G(1); rv.buffer = rvIR; pre.connect(rS); rS.connect(rv); rv.connect(rW); rW.connect(mix);
      // crush
      const cS = G(0), sh = AC.createWaveShaper(), cHp = AC.createBiquadFilter(); sh.curve = curve; sh.oversample = 'none'; cHp.type = 'highpass'; cHp.frequency.value = 120; pre.connect(cS); cS.connect(sh); sh.connect(cHp); cHp.connect(mix);
      mix.connect(fadeG); fadeG.connect(gate); gate.connect(cut);
      const vu = AC.createAnalyser(); vu.fftSize = 256; cut.connect(vu);
      const pfl = G(0); cut.connect(pfl); pfl.connect(cueBus);
      cut.connect(ch); ch.connect(xf); xf.connect(masterIn);
      const out = AC.createAnalyser(); out.fftSize = 256; xf.connect(out);
      return { node, trim, lo, mid, hi, filt, ffilt, pre, dry, mix, fadeG, gate, cut, ch, xf, vu, out, pfl, eS, eD, eF, fS, fD, fF, lfo, lfoG, rS, cS, buf: new Float32Array(256) };
    });
    A = { d: dd, masterIn, master, lim, masterOut, cueBus, phones, samplerG, mAn, mBuf: new Float32Array(512), route: null };
    for (const id in C) if (C[id].onset) C[id].onset(C[id].v, 'init');
    applyXf(); route(); decks.forEach((d, i) => { applyFx(i); if (d.trk) sendTrack(d); });
    buildSamples();
  })();
  audioP.catch((e) => { audioP = null; toast('The DJ engine could not start: ' + e.message, 7000); });
  return audioP;
}
/* Where the sound goes: master to the speakers, and the headphone cue to the DDJ-SB3's phones channels 3/4 when the
 * output device has 4 channels (its built-in sound card), or to the right ear in split-cue mode. */
function route() {
  if (!A) return; const dst = AC.destination;
  try { A.masterOut.disconnect(); A.phones.disconnect(); } catch (e) { /* first run */ }
  A.masterOut.connect(A.mAn);
  const four = dst.maxChannelCount >= 4 && OPT.hp !== 'off' && OPT.hp !== 'split';
  if (four) {
    dst.channelCount = 4; dst.channelCountMode = 'explicit'; dst.channelInterpretation = 'discrete';
    const m = AC.createChannelMerger(4), s1 = AC.createChannelSplitter(2), s2 = AC.createChannelSplitter(2);
    A.masterOut.connect(s1); s1.connect(m, 0, 0); s1.connect(m, 1, 1); A.phones.connect(s2); s2.connect(m, 0, 2); s2.connect(m, 1, 3); m.connect(dst); A.route = '4ch';
  } else {
    try { dst.channelCount = 2; dst.channelInterpretation = 'speakers'; } catch (e) { /* fixed */ }
    if (OPT.hp === 'split') {
      const m = AC.createChannelMerger(2), mono1 = AC.createGain(), mono2 = AC.createGain(); mono1.channelCount = 1; mono1.channelCountMode = 'explicit'; mono2.channelCount = 1; mono2.channelCountMode = 'explicit';
      A.masterOut.connect(mono1); A.phones.connect(mono2); mono1.connect(m, 0, 0); mono2.connect(m, 0, 1); m.connect(dst); A.route = 'split';
    } else { A.masterOut.connect(dst); A.route = 'stereo'; }
  }
}
function applyFx(i) {
  if (!A) return; const d = decks[i], a = A.d[i], v = C['fxlvl' + i].v, t = AC.currentTime, on = (k) => d.fx.some((x, s) => x && d.fxType[s] === k);
  if (d.fade) return;                                               // an FX FADE is driving these right now
  const beat = FXB[d.fxBeat] * spbEff(d);
  a.eD.delayTime.setTargetAtTime(clamp(beat, 0.02, 3.9), t, 0.05); a.eS.gain.setTargetAtTime(on(0) ? v : 0, t, 0.02); a.eF.gain.setTargetAtTime(0.3 + v * 0.45, t, 0.05);
  a.fS.gain.setTargetAtTime(on(1) ? 0.4 + v * 0.6 : 0, t, 0.03); a.lfo.frequency.setTargetAtTime(1 / clamp(beat * 4, 0.25, 16), t, 0.05); a.fF.gain.setTargetAtTime(0.3 + v * 0.5, t, 0.05);
  a.rS.gain.setTargetAtTime(on(2) ? v * 0.9 : 0, t, 0.03);
  a.cS.gain.setTargetAtTime(on(3) ? v : 0, t, 0.02); a.dry.gain.setTargetAtTime(on(3) ? 1 - v * 0.75 : 1, t, 0.02);
}
function sendTrack(d) { const t = d.trk; if (!t || !d.node) return; const L = t.buf.getChannelData(0).slice(), R = (t.buf.numberOfChannels > 1 ? t.buf.getChannelData(1) : t.buf.getChannelData(0)).slice(); d.node.port.postMessage({ buf: [L, R], kl: d.keyLock }, [L.buffer, R.buffer]); post(d, { seek: d.cue }); d.pos = d.cue; }

/* ============================== tracks: demo pressing, files, analysis ============================== */
async function toCtxRate(b) {
  if (b.sampleRate === AC.sampleRate) return b;
  const off = new OfflineAudioContext(2, Math.ceil(b.duration * AC.sampleRate), AC.sampleRate), s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start(); return off.startRendering();
}
function analyse(buf) {                                               // 150 columns per second: peak + low/mid/high energy, for coloured waveforms
  const rate = buf.sampleRate, hop = Math.max(1, Math.round(rate / 150)), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = Math.floor(L.length / hop);
  const amp = new Float32Array(n), lo = new Float32Array(n), mi = new Float32Array(n), hi = new Float32Array(n), aL = 1 - Math.exp(-TAU * 200 / rate), aH = 1 - Math.exp(-TAU * 2500 / rate);
  let s1 = 0, s2 = 0, mA = 1e-6, mL = 1e-6, mM = 1e-6, mH = 1e-6;
  for (let k = 0; k < n; k++) {
    let pk = 0, el = 0, em = 0, eh = 0;
    for (let j = k * hop, e = j + hop; j < e; j++) { const x = (L[j] + R[j]) * 0.5; s1 += (x - s1) * aL; s2 += (x - s2) * aH; const h = x - s2, m = s2 - s1, ax = x < 0 ? -x : x; if (ax > pk) pk = ax; el += s1 * s1; em += m * m; eh += h * h; }
    amp[k] = pk; lo[k] = Math.sqrt(el / hop); mi[k] = Math.sqrt(em / hop); hi[k] = Math.sqrt(eh / hop);
    if (pk > mA) mA = pk; if (lo[k] > mL) mL = lo[k]; if (mi[k] > mM) mM = mi[k]; if (hi[k] > mH) mH = hi[k];
  }
  const col = new Array(n);
  for (let k = 0; k < n; k++) { amp[k] /= mA; const l = lo[k] / mL, m = mi[k] / mM, h = hi[k] / mH, s = Math.max(l, m, h, 1e-6); col[k] = 'rgb(' + Math.round(60 + 195 * l / s) + ',' + Math.round(40 + 190 * m / s) + ',' + Math.round(60 + 195 * h / s) + ')'; }
  const OV = 600, ov = new Float32Array(OV), ovc = new Array(OV);
  for (let i = 0; i < OV; i++) { const a = Math.floor(i * n / OV), b = Math.max(a + 1, Math.floor((i + 1) * n / OV)); let p = 0, pk = a; for (let k = a; k < b && k < n; k++) if (amp[k] > p) { p = amp[k]; pk = k; } ov[i] = p; ovc[i] = col[pk] || '#888'; }
  return { fps: rate / hop, n, amp, lo, mi, hi, col, ov, ovc };
}
function detectBpm(w) {                                               // onset autocorrelation, then a phase-histogram comb to refine tempo and find the grid
  const n = w.n, fps = w.fps, e = new Float32Array(n);
  for (let k = 1; k < n; k++) { const a = w.lo[k] * 1.6 + w.mi[k], b = w.lo[k - 1] * 1.6 + w.mi[k - 1]; e[k] = Math.max(0, a - b); }
  const s0 = Math.floor(n * 0.08), s1 = Math.min(n, s0 + Math.floor(fps * 100)), lmin = Math.floor(fps * 60 / 180), lmax = Math.ceil(fps * 60 / 70);
  let best = 0, bl = 0;
  for (let lag = lmin; lag <= lmax; lag++) { let s = 0; for (let k = s0; k < s1 - lag; k++) s += e[k] * e[k + lag]; s /= Math.max(1, s1 - s0 - lag); if (s > best) { best = s; bl = lag; } }
  if (!bl) return { bpm: 120, grid: 0 };
  let bpm = 60 * fps / bl; while (bpm < 86) bpm *= 2; while (bpm > 172) bpm /= 2;
  let bb = bpm, bs = -1, bph = 0;
  for (let c = bpm - 1.5; c <= bpm + 1.5; c += 0.02) {
    const P = 60 * fps / c, H = new Float32Array(48);
    for (let k = s0; k < n; k++) H[Math.floor(((k % P) / P) * 48)] += e[k];
    let mx = 0, mi = 0; for (let i = 0; i < 48; i++) if (H[i] > mx) { mx = H[i]; mi = i; }
    if (mx > bs) { bs = mx; bb = c; bph = (mi + 0.5) / 48 * P; }
  }
  if (Math.abs(bb - Math.round(bb)) < 0.06) bb = Math.round(bb);
  return { bpm: Math.round(bb * 100) / 100, grid: bph / fps };
}
function addTrack(o) {
  const t = Object.assign({ id: Math.random().toString(36).slice(2, 8), hot: Array(8).fill(null), cue: null }, o);
  if (t.buf) { t.n = t.buf.length; t.dur = t.buf.duration; if (!t.wave) t.wave = analyse(t.buf); }
  LIB.push(t); return t;
}
async function addFiles(files) {
  await ensureAudio(); let ok = 0;
  for (const f of files) {
    if (!/^audio|^video/.test(f.type) && !/\.(mp3|wav|flac|ogg|m4a|aac|aif|aiff|opus|webm|mp4)$/i.test(f.name)) continue;
    const ph = addTrack({ title: f.name.replace(/\.[^.]+$/, ''), artist: 'Analysing…', pressing: true });
    try {
      const buf = await toCtxRate(await AC.decodeAudioData(await f.arrayBuffer()));
      const w = analyse(buf), g = detectBpm(w);
      Object.assign(ph, { buf, wave: w, n: buf.length, dur: buf.duration, bpm: g.bpm, grid: g.grid, artist: 'Your file · ' + g.bpm.toFixed(1) + ' BPM (detected)', pressing: false }); ok++;
    } catch (e) { LIB.splice(LIB.indexOf(ph), 1); toast('Could not read ' + f.name + ': ' + e.message, 6000); }
  }
  if (ok) { toast(ok + ' track' + (ok > 1 ? 's' : '') + ' added. Tempo is detected automatically; nudge with the jog if a grid looks off.'); libSel = LIB.length - 1; }
}
async function addMyBeat() {
  if (typeof exportWav !== 'function' || typeof S === 'undefined') return toast('The studio is not ready yet');
  await ensureAudio(); toast('Rendering your mosaicBeats song as a record…', 8000);
  try {
    const r = await exportWav({ analyze: true }); if (!r || !r.end) return toast('Your song is empty: make a beat first, then press My beat');
    const b = new AudioBuffer({ numberOfChannels: 2, length: r.end, sampleRate: SR }); b.copyToChannel(r.L.subarray(0, r.end), 0); b.copyToChannel(r.R.subarray(0, r.end), 1);
    const buf = await toCtxRate(b); addTrack({ title: 'My beat (' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')', artist: 'mosaicBeats · ' + S.bpm + ' BPM', bpm: S.bpm, grid: 0, buf });
    libSel = LIB.length - 1; toast('Your song is in the library. Press LOAD on a deck.');
  } catch (e) { toast('Could not render your song: ' + e.message, 6000); }
}

/* ---- demo records, pressed on the spot by a little offline synth so the decks work with no files ---- */
const DEMOS = [
  { title: 'Pukeko Strut', artist: 'mosaicDJ demo · deep house', bpm: 124, style: 'house', chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 67]], bass: [33, 29, 36, 31] },
  { title: 'Kumara Rolling', artist: 'mosaicDJ demo · techno', bpm: 128, style: 'techno', chords: [[53, 56, 60, 63], [53, 56, 60, 63], [49, 53, 56, 60], [51, 55, 58, 63]], bass: [29, 29, 25, 27] },
  { title: 'Toffee Disco', artist: 'mosaicDJ demo · nu-disco', bpm: 122, style: 'disco', chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]], bass: [38, 31, 36, 33] },
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const yieldUI = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
/* A direct sample-by-sample synth: every voice only costs CPU while it sounds, so a 2-minute record presses in about a second. */
async function pressDemo(sp) {
  const R = AC.sampleRate, spb = 60 / sp.bpm, BARS = 64, len = Math.ceil((BARS * 4 * spb + 2.5) * R);
  const L = new Float32Array(len), Rr = new Float32Array(len), sL = new Float32Array(len), sR = new Float32Array(len);
  let seed = 0x9e3779b9 ^ sp.bpm; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const T = (bar, beat) => (bar * 4 + beat) * spb + 0.02;
  const put = (i, x, pan, send) => { const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4); L[i] += x * gl; Rr[i] += x * gr; if (send) { sL[i] += x * gl * send; sR[i] += x * gr * send; } };
  const biq = (type, f, q) => {                                       // RBJ biquad
    const w = 2 * Math.PI * Math.min(f, R * 0.45) / R, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), a0 = 1 + al; let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = -2 * c / a0, A2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  };
  const kick = (t, a) => { const i0 = Math.floor(t * R), n = Math.floor(0.45 * R); let ph = 0; for (let k = 0; k < n && i0 + k < len; k++) { const tt = k / R, f = 47 + 115 * Math.exp(-tt / 0.028); ph += f / R; let x = Math.sin(2 * Math.PI * ph) * Math.exp(-tt / 0.15) * (1 - Math.exp(-tt / 0.0015)) * a; if (tt < 0.004) x += rnd() * 0.22 * a * (1 - tt / 0.004); put(i0 + k, Math.tanh(x * 1.5) * 0.72, 0, 0); } };
  const noise = (t, dur, type, f, q, a, pan, send, decay) => { const i0 = Math.floor(t * R), n = Math.floor(dur * R), flt = biq(type, f, q); for (let k = 0; k < n && i0 + k < len; k++) { const tt = k / R; put(i0 + k, flt(rnd()) * a * Math.exp(-tt / decay) * (1 - Math.exp(-tt / 0.0008)), pan, send); } };
  const hat = (t, a, open, pan) => noise(t, open ? 0.32 : 0.07, 'hp', open ? 7000 : 9000, 0.7, a, pan, 0.04, open ? 0.08 : 0.016);
  const clap = (t, a) => { noise(t, 0.03, 'bp', 1400, 0.9, a * 1.4, 0, 0.3, 0.007); noise(t + 0.011, 0.03, 'bp', 1400, 0.9, a * 1.4, 0, 0.3, 0.007); noise(t + 0.023, 0.3, 'bp', 1250, 0.9, a * 1.4, 0, 0.45, 0.065); };
  const voice = (t, dur, m, a, cut, wave, det, pan, send, att = 0.004, cutEnd = 0.25, q = 2) => {   // oscillators -> resonant lowpass (TPT state-variable) -> envelope
    const i0 = Math.floor(t * R), n = Math.floor((dur + 0.03) * R), f0 = mtof(m), ph = det.map(() => Math.random()), inc = det.map((c) => f0 * Math.pow(2, c / 1200) / R), rel = dur * 0.4 + 0.03;
    let ic1 = 0, ic2 = 0, A1 = 0, A2 = 0, A3 = 0;
    for (let k = 0; k < n && i0 + k < len; k++) {
      const tt = k / R; let x = 0;
      for (let j = 0; j < ph.length; j++) { ph[j] += inc[j]; if (ph[j] >= 1) ph[j] -= 1; const p = ph[j]; x += wave === 'saw' ? 2 * p - 1 : wave === 'sq' ? (p < 0.5 ? 0.8 : -0.8) : Math.sin(2 * Math.PI * p); }
      x /= ph.length;
      if ((k & 15) === 0) { const fc = Math.max(60, cut * Math.pow(cutEnd, Math.min(1, tt / dur))), g = Math.tan(Math.PI * Math.min(fc, R * 0.45) / R), kk = 1 / q; A1 = 1 / (1 + g * (g + kk)); A2 = g * A1; A3 = g * A2; }
      const v3 = x - ic2, v1 = A1 * ic1 + A2 * v3, v2 = ic2 + A2 * ic1 + A3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
      const env = tt < att ? tt / att : tt < dur * 0.6 ? 1 : Math.max(0, 1 - (tt - dur * 0.6) / rel);
      put(i0 + k, v2 * a * env, pan, send);
    }
  };
  const tech = sp.style === 'techno', disco = sp.style === 'disco';
  for (let bar = 0; bar < BARS; bar++) {
    if (bar % 4 === 0) await yieldUI();
    const sec = bar < 8 ? 'intro' : bar < 16 ? 'build' : bar < 32 ? 'main' : bar < 40 ? 'break' : bar < 56 ? 'drop' : 'outro';
    const ci = Math.floor(bar / 2) % 4, chord = sp.chords[ci], root = sp.bass[ci], full = sec === 'main' || sec === 'drop';
    for (let b = 0; b < 4; b++) {
      if (sec !== 'break') kick(T(bar, b), 0.95);
      if (sec !== 'intro' && sec !== 'break' && !(sec === 'outro' && bar > 59) && (b === 1 || b === 3)) clap(T(bar, b), tech ? 0.18 : 0.26);
      if (sec !== 'break') {
        if (tech) for (let s = 0; s < 4; s++) hat(T(bar, b + s / 4), s === 2 ? 0.2 : 0.08, false, s % 2 ? 0.3 : -0.2);
        else { hat(T(bar, b + 0.5), 0.16, disco || (full && b % 2 === 1), 0.25); if (sec !== 'intro') hat(T(bar, b + 0.75), 0.06, false, -0.3); }
      }
      if (sec === 'build' || full || (sec === 'outro' && bar < 60)) {
        if (sp.style === 'house') voice(T(bar, b + 0.5), spb * 0.42, root + 12 * (b % 2), 0.42, 950, 'saw', [0, 7], 0, 0);
        else if (tech) for (const s of [0.25, 0.5, 0.75]) voice(T(bar, b + s), spb * 0.2, root + 12, 0.4, 480 + 520 * ((bar % 8) / 8), 'saw', [0], 0, 0, 0.003, 0.3);
        else for (const s of [0, 0.5]) voice(T(bar, b + s), spb * 0.42, root + (s ? 12 : 0) + 12, 0.4, 1400, 'saw', [0, -6], 0, 0);
      }
      if (full || sec === 'break') {
        if (sp.style === 'house' && (b === 1 || b === 3)) chord.forEach((m, k) => voice(T(bar, b + (b === 1 ? 0.5 : 0.75)), spb * 0.45, m, 0.12, sec === 'break' ? 1200 : 2800, 'saw', [-8, 8], k % 2 ? 0.25 : -0.25, 0.35));
        if (tech && b % 2 === 0) chord.forEach((m, k) => voice(T(bar, b + 0.75), spb * 0.3, m, 0.1, 1500 + 1000 * Math.sin(bar), 'saw', [-6, 6], k % 2 ? 0.3 : -0.3, 0.7));
        if (disco) { if (b === 0) chord.forEach((m, k) => voice(T(bar, 0), spb * 3.9, m, 0.07, 2400, 'saw', [-10, 10], k % 2 ? 0.35 : -0.35, 0.35, 0.25, 0.7, 1)); if (full) for (let s = 0; s < 4; s++) voice(T(bar, b + s / 4), spb * 0.2, chord[(b * 4 + s) % 4] + 12, 0.07, 3200, 'sq', [0], s % 2 ? 0.4 : -0.4, 0.25, 0.003, 0.4); }
      }
    }
    if (bar === 39) { for (let s = 0; s < 16; s++) noise(T(bar, s / 4), 0.09, 'bp', 1800, 1, 0.14 + s * 0.025, 0, 0.2, 0.03); }
    if (bar >= 32 && bar < 40) { const i0 = Math.floor(T(bar, 0) * R), n = Math.floor(4 * spb * R); for (let blk = 0; blk < n; blk += 512) { const u = ((bar - 32) * 4 * spb * R + blk) / (8 * 4 * spb * R), f = biq('bp', 300 * Math.pow(30, u), 2); for (let k = blk; k < Math.min(n, blk + 512) && i0 + k < len; k++) put(i0 + k, f(rnd()) * 0.3 * u * u, 0, 0.2); } }
    if (bar === 16 || bar === 40) noise(T(bar, 0), 2.4, 'hp', 5000, 0.5, 0.24, 0, 0.35, 0.7);
  }
  await yieldUI();
  if (tech) { const dl = Math.round(spb * 0.75 * R); for (let n = dl; n < len; n++) { sL[n] += sL[n - dl] * 0.42; sR[n] += sR[n - dl] * 0.42; } }
  // Freeverb-style room on the send bus
  for (const [inp, outp, sp2] of [[sL, L, 0], [sR, Rr, 23]]) {
    const cb = [1557, 1617, 1491, 1422].map((d) => ({ b: new Float32Array(Math.round(d * R / 44100) + sp2), i: 0, f: 0 })), ap = [225, 556].map((d) => ({ b: new Float32Array(Math.round(d * R / 44100) + sp2), i: 0 }));
    for (let n = 0; n < len; n++) { const x = inp[n] * 0.12; let y = 0; for (const c of cb) { const o = c.b[c.i]; c.f = o * 0.75 + c.f * 0.25; c.b[c.i] = x + c.f * 0.8; if (++c.i >= c.b.length) c.i = 0; y += o; } for (const a of ap) { const o = a.b[a.i]; a.b[a.i] = y + o * 0.5; if (++a.i >= a.b.length) a.i = 0; y = o - y; } outp[n] += y * 0.9 + inp[n] * (tech ? 0.25 : 0); }
    await yieldUI();
  }
  let pk = 1e-6; for (let n = 0; n < len; n++) { const a = Math.abs(L[n]), b = Math.abs(Rr[n]); if (a > pk) pk = a; if (b > pk) pk = b; }
  const g = 1.25 / pk; for (let n = 0; n < len; n++) { L[n] = Math.tanh(L[n] * g) * 0.89; Rr[n] = Math.tanh(Rr[n] * g) * 0.89; }
  const buf = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: R }); buf.copyToChannel(L, 0); buf.copyToChannel(Rr, 1); return buf;
}
async function pressDemos() {
  for (const sp of DEMOS) {
    const ph = addTrack({ title: sp.title, artist: 'Pressing the record…', pressing: true, bpm: sp.bpm, grid: 0.02 });
    try { const buf = await pressDemo(sp); Object.assign(ph, { buf, n: buf.length, dur: buf.duration, wave: analyse(buf), artist: sp.artist, pressing: false }); }
    catch (e) { ph.artist = 'Could not press: ' + e.message; }
  }
}
/* ---- the sampler bank: eight one-shots synthesised at start ---- */
async function buildSamples() {
  const R = AC.sampleRate, mk = async (secs, fn) => { const o = new OfflineAudioContext(2, Math.ceil(secs * R), R); const nb = o.createBuffer(1, R, R), nd = nb.getChannelData(0); for (let i = 0; i < R; i++) nd[i] = Math.random() * 2 - 1; fn(o, nb); return o.startRendering(); };
  const osc = (o, type, f, t0, t1, dst) => { const s = o.createOscillator(); s.type = type; s.frequency.value = f; s.connect(dst); s.start(t0); s.stop(t1); return s; };
  const G = (o, dst) => { const g = o.createGain(); g.connect(dst); return g; };
  const defs = [
    [1.4, (o) => { const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(o.destination); [[0, 0.13], [0.2, 0.13], [0.4, 0.8]].forEach(([t, d]) => { const g = G(o, lp); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.015); g.gain.setValueAtTime(0.32, t + d - 0.03); g.gain.linearRampToValueAtTime(0, t + d); for (const f of [415, 419, 830, 623]) { const s = osc(o, 'sawtooth', f, t, t + d, g); s.frequency.setValueAtTime(f * 0.94, t); s.frequency.linearRampToValueAtTime(f, t + 0.04); } }); }],
    [2.0, (o) => { const g = G(o, o.destination); g.gain.value = 0.22; g.gain.setValueAtTime(0.22, 1.7); g.gain.linearRampToValueAtTime(0, 2); const s = osc(o, 'square', 600, 0, 2, g); s.frequency.setValueAtTime(500, 0); s.frequency.exponentialRampToValueAtTime(1300, 0.9); s.frequency.exponentialRampToValueAtTime(500, 1.8); }],
    [0.5, (o) => { const g = G(o, o.destination); g.gain.setValueAtTime(0.4, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.45); const s = osc(o, 'sawtooth', 3000, 0, 0.5, g); s.frequency.setValueAtTime(3200, 0); s.frequency.exponentialRampToValueAtTime(90, 0.4); }],
    [1.3, (o, nb) => { const g = G(o, o.destination); g.gain.setValueAtTime(0.3, 0); g.gain.linearRampToValueAtTime(0, 1.3); const s = osc(o, 'sawtooth', 200, 0, 1.3, g); const lf = o.createOscillator(); lf.frequency.setValueAtTime(6, 0); lf.frequency.linearRampToValueAtTime(18, 1.2); const lg = o.createGain(); lg.gain.value = 140; lf.connect(lg); lg.connect(s.frequency); lf.start(); s.frequency.setValueAtTime(900, 0); s.frequency.exponentialRampToValueAtTime(70, 1.25); const n = o.createBufferSource(); n.buffer = nb; const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(4000, 0); bp.frequency.exponentialRampToValueAtTime(300, 1.2); n.connect(bp); bp.connect(g); n.start(); }],
    [1.8, (o) => { const g = G(o, o.destination); g.gain.setValueAtTime(0.9, 0); g.gain.exponentialRampToValueAtTime(0.001, 1.75); const s = osc(o, 'sine', 120, 0, 1.8, g); s.frequency.setValueAtTime(130, 0); s.frequency.exponentialRampToValueAtTime(28, 1.6); }],
    [0.6, (o, nb) => { for (const k of [0, 0.012, 0.025]) { const n = o.createBufferSource(); n.buffer = nb; const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; const g = G(o, o.destination); g.gain.setValueAtTime(0.6, k); g.gain.exponentialRampToValueAtTime(0.001, k + (k ? 0.03 : 0.4)); n.connect(bp); bp.connect(g); n.start(k, Math.random() * 0.5); } }],
    [2.6, (o, nb) => { const n = o.createBufferSource(); n.buffer = nb; n.loop = true; const hp = o.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500; const g = G(o, o.destination); g.gain.setValueAtTime(0.4, 0); g.gain.exponentialRampToValueAtTime(0.001, 2.5); n.connect(hp); hp.connect(g); n.start(); }],
    [0.45, (o, nb) => { const f1 = o.createBiquadFilter(), f2 = o.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 720; f2.frequency.value = 1250; f1.Q.value = f2.Q.value = 6; const g = G(o, o.destination); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.9, 0.04); g.gain.exponentialRampToValueAtTime(0.001, 0.42); f1.connect(g); f2.connect(g); const s = osc(o, 'sawtooth', 165, 0, 0.45, f1); s.connect(f2); s.frequency.setValueAtTime(190, 0); s.frequency.linearRampToValueAtTime(150, 0.4); const n = o.createBufferSource(); n.buffer = nb; const hg = G(o, f2); hg.gain.setValueAtTime(0.6, 0); hg.gain.exponentialRampToValueAtTime(0.01, 0.05); n.connect(hg); n.start(); }],
  ];
  for (let i = 0; i < defs.length; i++) { try { SAMPLES[i] = await mk(defs[i][0], defs[i][1]); } catch (e) { /* leave that pad silent */ } }
}
function playSample(i) {
  if (!A || !SAMPLES[i]) return; stopSample(i);
  const s = AC.createBufferSource(); s.buffer = SAMPLES[i]; s.connect(A.samplerG); s.start(); sampPlaying.set(i, s); s.onended = () => { if (sampPlaying.get(i) === s) sampPlaying.delete(i); };
  GAME.sample(i);
}
function stopSample(i) { const s = sampPlaying.get(i); if (s) { try { s.stop(); } catch (e) { /* already stopped */ } sampPlaying.delete(i); } }

/* ============================== deck actions ============================== */
function needTrack(d) { if (d.trk) return true; toast('Deck ' + 'AB'[d.i] + ' is empty. Pick a record in the library and press LOAD.'); return false; }
function load(i) {
  const t = LIB[libSel], d = decks[i]; if (!t) return toast('The library is empty');
  if (t.pressing) return toast(t.title + ' is still being prepared');
  if (d.playing && d.post > 0.05) toast('Deck ' + 'AB'[i] + ' was live! The crowd heard that.', 3000), GAME.ouch('Loaded over a live deck!', 18);
  endPads(d); d.trk = t; d.playing = false; d.om = 0; d.loop = null; d.lastLoop = null; d.sync = false; d.ended = false; d.cuePrev = false;
  d.cue = t.cue != null ? t.cue : Math.max(0, Math.round(t.grid * sr())); d.pos = d.cue; d.ghost = d.cue; d.wrate = 0;
  ensureAudio().then(() => { sendTrack(d); post(d, { hard: 0, loop: null, slip: false }); });
  d.playedAt = 0; if (window.MDJ.onLoad) window.MDJ.onLoad(i);
}
function playBtn(d) {
  if (!needTrack(d)) return; AC.resume();
  if (d.cuePrev) { d.cuePlayHit = true; return; }
  if (d.ended && !d.playing) { d.ended = false; post(d, { seek: d.cue }); }
  d.playing = !d.playing; d.tau = d.playing ? OPT.startT : OPT.stopT; d.brake = 0; d.free = false;
  if (d.playing && !d.playedAt) d.playedAt = wall();
}
function cueDown(d) {
  if (!needTrack(d)) return; AC.resume();
  const p = estPos(d);
  if (d.playing) { d.playing = false; d.om = 0; post(d, { hard: 0, seek: d.cue }); d.pos = d.cue; return; }
  if (Math.abs(p - d.cue) > sr() * 0.03) { d.cue = snapPos(d, p); d.trk.cue = d.cue; post(d, { seek: d.cue }); d.pos = d.cue; }
  d.cuePrev = true; d.cuePlayHit = false; d.playing = true; d.tau = 0.02;
}
function cueUp(d) {
  if (!d.cuePrev) return; d.cuePrev = false;
  if (d.cuePlayHit) { d.cuePlayHit = false; if (!d.playedAt) d.playedAt = wall(); return; }
  d.playing = false; d.om = 0; post(d, { hard: 0, seek: d.cue }); d.pos = d.cue;
}
function syncBtn(d) {
  if (!needTrack(d)) return; const o = decks[1 - d.i]; if (!o.trk) return toast('Load the other deck first: SYNC matches this deck to it');
  if (d.sync) { d.sync = false; return; }
  let target = bpmEff(o), base = trkBpm(d); if (target / base > 1.5) target /= 2; else if (base / target > 1.5) target *= 2;
  let p = target / base - 1; while (Math.abs(p) > d.range && d.range < 0.5) d.range = d.range === 0.08 ? 0.16 : 0.5;
  p = clamp(p, -d.range, d.range); const t = 0.5 + p / (2 * d.range); setC('tempo' + d.i, OPT.tempoInv ? 1 - t : t, 'sync');
  d.pitch = p; d.sync = true; d.takeover = true;
  if (o.playing && d.playing) post(d, { nudge: wrapH(frac(beatAt(o)) - frac(beatAt(d))) * beatLen(d) });
  else if (o.trk && !d.playing) post(d, { nudge: wrapH(frac(beatAt(o)) - frac(beatAt(d))) * beatLen(d) });
}
function jumpBeats(d, n) {
  if (!needTrack(d)) return;
  if (n === 'start') return post(d, { seek: Math.max(0, Math.round(d.trk.grid * sr())) });
  if (n === 'end') return post(d, { seek: d.trk.n - beatLen(d) * 32 });
  post(d, { nudge: n * beatLen(d) }); if (d.loop) setLoop(d, null);
}
function setLoop(d, lp) { d.loop = lp; if (lp) d.lastLoop = lp.slice(); post(d, { loop: lp }); }
function autoLoop(d) {
  if (!needTrack(d)) return; if (d.loop) return setLoop(d, null);
  const unit = Math.min(1, d.loopBeats), a = OPT.quant ? posOfBeat(d, Math.floor(beatAt(d) / unit) * unit) : estPos(d);
  setLoop(d, [a, a + d.loopBeats * beatLen(d)]);
}
function loopSize(d, f) {
  d.loopBeats = clamp(d.loopBeats * f, 1 / 32, 32);
  if (d.loop) setLoop(d, [d.loop[0], d.loop[0] + d.loopBeats * beatLen(d)]);
  flash('LOOP ' + fmtBeats(d.loopBeats), d.i);
}
function loopIn(d) { if (!needTrack(d)) return; d.loopInAt = snapPos(d, estPos(d)); flash('LOOP IN', d.i); }
function loopOut(d) { if (!needTrack(d)) return; const a = d.loopInAt != null ? d.loopInAt : estPos(d) - 4 * beatLen(d), b = snapPos(d, estPos(d)); if (b - a > 64) { setLoop(d, [a, b]); d.loopBeats = (b - a) / beatLen(d); } }
function reloop(d) { if (!d.lastLoop) return; setLoop(d, d.lastLoop.slice()); post(d, { seek: d.loop[0] }); }
const fmtBeats = (b) => (b >= 1 ? String(Math.round(b * 100) / 100) : '1/' + Math.round(1 / b));
function keyLock(d) { d.keyLock = !d.keyLock; post(d, { kl: d.keyLock }); flash(d.keyLock ? 'KEY LOCK ON' : 'KEY LOCK OFF', d.i); }
function cycleRange(d) { d.range = d.range === 0.08 ? 0.16 : d.range === 0.16 ? 0.5 : 0.08; setC('tempo' + d.i, C['tempo' + d.i].v, 'range'); flash('TEMPO ±' + Math.round(d.range * 100) + '%', d.i); }
function brakeStop(d) { if (!d.trk || !d.playing) return; d.playing = false; d.tau = 1.1; d.brake = 1; }
function setMode(d, m) { endPads(d); d.mode = m; flash(MODE_NAME[m], d.i); }
function modeBtn(d, k) { const base = MODES[k]; setMode(d, d.shift ? ALT[base] : base); }
function fxBtn(d, s, shift) {
  if (shift || d.shift) { let t = d.fxType[s]; for (let k = 0; k < FXT.length; k++) { t = (t + 1) % FXT.length; if (!d.fxType.some((x, j) => j !== s && x === t)) break; } d.fxType[s] = t; flash('FX' + (s + 1) + ': ' + FXT[t], d.i); }
  else { d.fx[s] = !d.fx[s]; if (d.fx[s]) GAME.fxOn(d); }
  applyFx(d.i);
}
function endPads(d) {
  if (d.roll) { setLoop(d, d.roll.prev); post(d, { slip: false }); d.roll = null; }
  if (d.slicer) { setLoop(d, d.slicer.prev); post(d, { slip: false }); d.slicer = null; }
  if (d.trans) { if (A) { A.d[d.i].gate.gain.cancelScheduledValues(0); A.d[d.i].gate.gain.setTargetAtTime(1, AC.currentTime, 0.003); } d.trans = null; }
  if (d.pat) endPattern(d);
}
function padPress(d, i, down, shift, mode = d.mode) {
  if (down) AC.resume();
  const sh = shift || d.shift;
  if (mode === 'sampler') { if (down) (sh ? stopSample(i) : playSample(i)); return; }
  if (!d.trk) { if (down) needTrack(d); return; }
  if (mode === 'hot') {
    if (!down) return; const h = d.trk.hot;
    if (sh) { if (h[i] != null) { h[i] = null; flash('HOT CUE ' + (i + 1) + ' DELETED', d.i); } return; }
    if (h[i] == null) { h[i] = snapPos(d, estPos(d)); flash('HOT CUE ' + (i + 1) + ' SET', d.i); return; }
    let to = h[i]; if (d.playing && OPT.quant) to += frac(beatAt(d) - beatAt(d, h[i])) * beatLen(d);
    post(d, { seek: to }); d.pos = to; if (d.loop && (to < d.loop[0] || to > d.loop[1])) setLoop(d, null);
    if (!d.playing) { d.playing = true; d.tau = OPT.startT; if (!d.playedAt) d.playedAt = wall(); }
    GAME.trick(d, 2); return;
  }
  if (mode === 'jump') { if (down) jumpBeats(d, (sh ? JUMPS_SH : JUMPS)[i]); return; }
  if (mode === 'roll') {
    if (down) { if (d.roll) setLoop(d, d.roll.prev); const len = ROLLS[i] * beatLen(d), b = beatAt(d), a = posOfBeat(d, Math.floor(b / ROLLS[i]) * ROLLS[i]); if (!d.roll) post(d, { slip: true }); d.roll = { i, prev: d.roll ? d.roll.prev : d.loop }; post(d, { loop: [a, a + len] }); GAME.trick(d, 3); }
    else if (d.roll && d.roll.i === i) { const prev = d.roll.prev; d.roll = null; post(d, { loop: prev }); d.loop = prev; post(d, { slip: false }); }
    return;
  }
  if (mode === 'slicer') {
    if (down) { const b = beatAt(d), dom = Math.floor(b / 8) * 8, s = posOfBeat(d, dom + i), off = frac(b) * beatLen(d); if (!d.slicer) post(d, { slip: true }); d.slicer = { i, prev: d.slicer ? d.slicer.prev : d.loop }; post(d, { loop: [s, s + beatLen(d)], seek: s + off }); GAME.trick(d, 3); }
    else if (d.slicer && d.slicer.i === i) { const prev = d.slicer.prev; d.slicer = null; post(d, { loop: prev }); d.loop = prev; post(d, { slip: false }); }
    return;
  }
  if (mode === 'trans') {
    if (down) { d.trans = { i, r: TRANS[i], j: null }; GAME.trick(d, 2); }
    else if (d.trans && d.trans.i === i) { d.trans = null; if (A) { const g = A.d[d.i].gate.gain; g.cancelScheduledValues(0); g.setTargetAtTime(1, AC.currentTime, 0.003); } }
    return;
  }
  if (mode === 'scratch') {
    if (down) startPattern(d, i); else if (d.pat && d.pat.i === i) d.pat.held = false;
    return;
  }
  if (mode === 'fade') { if (down) startFade(d, i, sh); }
}
/* ---- Pad Scratch: a virtual hand plays the pattern on the platter, with slip so the beat carries on underneath ---- */
function startPattern(d, i) {
  if (d.pat) endPattern(d);
  const segs = SCR[i][1], total = segs.reduce((s, x) => s + x[0], 0), wait = (1 - frac(beatAt(d) * 4)) / 4 * spbEff(d);   // start on the next 16th
  d.pat = { i, segs, total, t0: wall() + (d.playing ? wait : 0), held: true, cutPrev: 1 };
  post(d, { slip: true }); GAME.trick(d, 6);
}
function endPattern(d) {
  if (!d.pat) return; d.pat = null; if (d.touchSrc === 'pat') { d.touch = false; d.touchSrc = ''; d.tau = 0.06; }
  post(d, { slip: false }); if (A) A.d[d.i].cut.gain.setTargetAtTime(1, AC.currentTime, 0.002);
}
/* ---- FX FADE: fade the deck out over N beats with an effect, then stop it (hold SHIFT to fade in instead) ---- */
function startFade(d, i, fadeIn) {
  if (!A || d.fade) return; const [name, beats, kind] = FADES[i], a = A.d[d.i], spb = spbEff(d), t0 = AC.currentTime + (d.playing ? (1 - frac(beatAt(d))) * spb : 0.02), dur = beats * spb, t1 = t0 + dur;
  if (fadeIn && !d.playing) { d.playing = true; d.tau = kind === 'brake' ? dur / 2.5 : OPT.startT; if (!d.playedAt) d.playedAt = wall(); if (kind === 'brake' || kind === 'spin') { flash('SPIN UP', d.i); return; } }
  if (!d.playing && !fadeIn) return toast('FX FADE needs the deck playing');
  d.fade = { kind, t1, fadeIn, name };
  const f = a.ffilt.frequency, g = a.fadeG.gain;
  [f, g, a.eS.gain, a.dry.gain, a.rS.gain].forEach((p) => p.cancelScheduledValues(0));
  if (kind === 'hpf' || kind === 'lpf') {
    a.ffilt.type = kind === 'hpf' ? 'highpass' : 'lowpass'; const open = kind === 'hpf' ? 20 : 22000, shut = kind === 'hpf' ? 2500 : 160;
    f.setValueAtTime(fadeIn ? shut : open, t0); f.exponentialRampToValueAtTime(fadeIn ? open : shut, t1);
    g.setValueAtTime(fadeIn ? 0.0001 : 1, t0); g.setTargetAtTime(fadeIn ? 1 : 0, t0 + dur * (fadeIn ? 0 : 0.5), dur * 0.18);
  } else if (kind === 'echo' || kind === 'wash') {
    const send = kind === 'echo' ? a.eS.gain : a.rS.gain; a.eD.delayTime.setValueAtTime(clamp(spb * 0.75, 0.05, 3.9), t0); a.eF.gain.setValueAtTime(0.62, t0);
    if (fadeIn) { a.dry.gain.setValueAtTime(0.0001, t0); a.dry.gain.setTargetAtTime(1, t0, dur * 0.3); send.setValueAtTime(1, t0); send.setTargetAtTime(0, t0 + dur * 0.6, dur * 0.2); }
    else { send.setValueAtTime(0, t0 - 0.01); send.linearRampToValueAtTime(1, t0); a.dry.gain.setValueAtTime(1, t0 + spb); a.dry.gain.setTargetAtTime(0, t0 + spb, spb * 0.25); send.setValueAtTime(1, t0 + spb * 1.5); send.setTargetAtTime(0, t0 + spb * 1.5, dur * 0.3); }
  } else if (kind === 'brake') { setTimeout(() => { d.playing = false; d.tau = dur / 2.5; d.brake = 1; }, Math.max(0, (t0 - AC.currentTime) * 1000)); }
  else if (kind === 'spin') { setTimeout(() => { d.om = -9 * W0; d.free = true; d.freeStop = true; d.tau = 0.55; }, Math.max(0, (t0 - AC.currentTime) * 1000)); }
  GAME.trick(d, fadeIn ? 4 : 6); flash((fadeIn ? 'FADE IN · ' : 'FX FADE · ') + name + ' ' + beats, d.i);
}
function fadeDone(d) {
  const a = A.d[d.i], t = AC.currentTime, f = d.fade; d.fade = null;
  if (!f.fadeIn && (f.kind === 'hpf' || f.kind === 'lpf' || f.kind === 'echo' || f.kind === 'wash')) { d.playing = false; d.om = 0; post(d, { hard: 0 }); }
  a.ffilt.frequency.cancelScheduledValues(0); a.ffilt.type = 'lowpass'; a.ffilt.frequency.setTargetAtTime(22000, t, 0.05); a.fadeG.gain.cancelScheduledValues(0); a.fadeG.gain.setTargetAtTime(1, t + (f.kind === 'echo' || f.kind === 'wash' ? 2.5 : 0.05), 0.05);
  setTimeout(() => applyFx(d.i), f.kind === 'echo' || f.kind === 'wash' ? 3000 : 60);
}

/* ============================== physics + per-frame engine ============================== */
let last = wall(), msgs = [];
function flash(s, i) { msgs.push({ s, i, t: wall() }); if (msgs.length > 6) msgs.shift(); }
function frame() {
  const t = wall(), dt = clamp(t - last, 0.001, 0.05); last = t;
  for (const d of decks) step(d, dt, t);
  if (A) { meters(); GAME.tick(dt); }
  if (inited && curView === 'dj') { drawRig(); drawScreen(); }
  if (window.MDJ.onFrame) window.MDJ.onFrame();
  requestAnimationFrame(frame);
}
function step(d, dt, t) {
  if (!d.trk) { d.om = 0; return; }
  // scripted hand for Pad Scratch
  if (d.pat) {
    const p = d.pat, eb = (t - p.t0) / spbEff(d);
    if (eb >= 0) {
      if (eb >= p.total && !p.held) endPattern(d);
      else {
        const x = eb % p.total; let acc = 0, seg = p.segs[0]; for (const s of p.segs) { if (x < acc + s[0]) { seg = s; break; } acc += s[0]; }
        d.touch = true; d.touchSrc = 'pat'; d.handOm = seg[1] * W0 * (1 + d.pitch); d.handAcc = 0;
        if (A && seg[2] !== p.cutPrev) { A.d[d.i].cut.gain.setTargetAtTime(seg[2] ? 1 : 0, AC.currentTime, 0.002); p.cutPrev = seg[2]; }
      }
    }
  }
  if (d.touch && d.touchSrc !== 'pat') { const inst = d.handAcc / dt; d.handAcc = 0; d.handOm = d.handOm * 0.45 + inst * 0.55; }
  d.bend *= Math.exp(-dt / 0.12);
  // sync: keep tempo matched and gently pull the phase in
  const o = decks[1 - d.i]; d.syncBend = 0;
  if (d.sync && o.trk) {
    let target = bpmEff(o), base = trkBpm(d); if (target / base > 1.5) target /= 2; else if (base / target > 1.5) target *= 2;
    const p = clamp(target / base - 1, -d.range, d.range); if (Math.abs(p - d.pitch) > 1e-5) { d.pitch = p; const tt = 0.5 + p / (2 * d.range); C['tempo' + d.i].v = OPT.tempoInv ? 1 - tt : tt; C['tempo' + d.i].views.forEach((f) => f(C['tempo' + d.i].v)); }
    if (d.playing && o.playing && !d.touch) d.syncBend = clamp(wrapH(frac(beatAt(o)) - frac(beatAt(d))) * 0.25, -0.02, 0.02);
  }
  const motor = motorRate(d);
  if (d.touch && (d.vinyl || d.touchSrc === 'pat')) d.om = d.handOm;           // the hand holds the record
  else {
    const target = d.free ? (d.freeStop ? 0 : motor * W0) : (motor + d.bend + d.syncBend) * W0;
    d.om += (target - d.om) * (1 - Math.exp(-dt / d.tau));
    if (d.free && Math.abs(d.om - target) < 0.04 * W0) { d.free = false; if (d.freeStop) { d.freeStop = false; d.playing = false; d.om = 0; } d.tau = 0.08; }
    if (!d.free && d.tau > 0.08 && Math.abs(d.om - target) < 0.01 * W0) { d.tau = 0.08; d.brake = 0; }
  }
  d.th += d.om * dt;
  const rate = d.om / W0;
  if (d.sent.rate === null || Math.abs(rate - d.sent.rate) > 1e-4) { post(d, { rate }); d.sent.rate = rate; }
  if (d.sent.motor === null || Math.abs(motor - d.sent.motor) > 1e-4) { post(d, { motor }); d.sent.motor = motor; }
  if (d.cuePrev && !d.playing) d.cuePrev = false;
  // trans gate scheduling, locked to the beat grid
  if (d.trans && A) {
    const g = A.d[d.i].gate.gain, r = d.trans.r, x = beatAt(d) / r, spbR = r * spbEff(d), now = AC.currentTime;
    let j = d.trans.j == null ? Math.ceil(x * 2) : d.trans.j;
    while (true) { const when = now + (j / 2 - x) * spbR; if (when > now + 0.15) break; if (when >= now - 0.005) g.setTargetAtTime(j % 2 ? 0 : 1, Math.max(now, when), 0.002); j++; }
    d.trans.j = j;
  }
  if (d.fade && AC.currentTime >= d.fade.t1) fadeDone(d);
  if (d.fxSyncT == null || t - d.fxSyncT > 0.5) { d.fxSyncT = t; if (d.fx.some(Boolean)) applyFx(d.i); }
}
function meters() {
  for (const d of decks) {
    const a = A.d[d.i]; let pk = 0; a.vu.getFloatTimeDomainData(a.buf); for (const x of a.buf) { const v = x < 0 ? -x : x; if (v > pk) pk = v; }
    d.level = Math.max(pk, d.level * 0.9);
    let pp = 0; a.out.getFloatTimeDomainData(a.buf); for (const x of a.buf) pp += x * x; d.post = Math.sqrt(pp / a.buf.length);
  }
  let m = 0; A.mAn.getFloatTimeDomainData(A.mBuf); for (const x of A.mBuf) m += x * x; GAME.mrms = Math.sqrt(m / A.mBuf.length);
}

/* ============================== GAME: the crowd ============================== */
// The floor reacts to the mix. Beatmatched blends, bass swaps and tidy tricks lift it; dead air, trainwrecks,
// muddy doubled bass and air-horn spam drain it. Score builds while the music is good.
const GAME = {
  energy: 40, score: 0, best: 0, streak: 0, wrecks: 0, mrms: 0, started: false, dead: 0, overlap: 0, lockT: 0, wreckT: 0, swap: false, dom: -1, domSince: 0, horns: [], fxT: [0, 0], trickT: 0, set0: 0, feed: [],
  say(s, c) { this.feed.push({ s, c, t: wall() }); if (this.feed.length > 4) this.feed.shift(); },
  bump(e, s, c) { this.energy = clamp(this.energy + e, 0, 100); if (s) this.say(s, c); },
  ouch(s, e) { this.bump(-e, s, '#ff6b5b'); this.streak = 0; },
  trick(d, e) { const t = wall(); if (d.post < 0.02 || t - this.trickT < 0.6) return; this.trickT = t; this.bump(e * (this.energy > 85 ? 0.3 : 1)); this.score += 15 * e; },
  fxOn(d) { this.fxT[d.i] = 0; if (d.post > 0.02) this.bump(2); },
  sample(i) { const t = wall(); this.horns = this.horns.filter((x) => t - x < 8); this.horns.push(t); if (this.horns.length > 3) this.ouch(SAMP_LAB[i] === 'AIR HORN' ? 'Too many air horns!' : 'Easy on the sampler!', 8); else this.bump(3); },
  tick(dt) {
    const a = decks[0], b = decks[1], la = a.post > 0.035 && a.playing, lb = b.post > 0.035 && b.playing, t = wall();
    if (!this.started) { if (la || lb) { this.started = true; this.set0 = t; this.say('The doors are open. Keep them dancing!', '#ffc25e'); } else return; }
    if (this.mrms < 0.01) { this.dead += dt; if (this.dead > 1.2) { this.energy = Math.max(0, this.energy - 22 * dt); if (this.dead < 1.25) this.ouch('Dead air! The floor is emptying.', 6); } } else this.dead = 0;
    if (la && lb) {
      this.overlap += dt;
      const ratio = bpmEff(a) / bpmEff(b), same = Math.abs(ratio - 1) < 0.004 || Math.abs(ratio - 2) < 0.008 || Math.abs(ratio - 0.5) < 0.002;
      const err = Math.abs(wrapH(frac(beatAt(a)) - frac(beatAt(b)))), locked = same && err < 0.07;
      if (locked) { this.lockT += dt; this.wreckT = 0; this.energy = Math.min(100, this.energy + 4 * dt); }
      else { this.wreckT += dt; if (this.wreckT > 1.2 && this.wreckT - dt <= 1.2) { this.wrecks++; this.ouch('Trainwreck! The beats are clashing.', 12); } if (this.wreckT > 1.2) this.energy = Math.max(0, this.energy - 9 * dt); }
      const lowA = C.low0.v, lowB = C.low1.v; if (locked && !this.swap && this.overlap > 1 && (lowA < 0.2 || lowB < 0.2) && Math.max(lowA, lowB) > 0.4) { this.swap = true; this.bump(5, 'Bass swap! Clean low end.', '#46d37a'); this.score += 150; }
      if (lowA > 0.45 && lowB > 0.45 && a.post > 0.08 && b.post > 0.08) this.energy = Math.max(0, this.energy - 2.5 * dt);
    }
    const dom = la && !lb ? 0 : lb && !la ? 1 : -1;
    if (dom >= 0 && dom !== this.dom) {
      if (this.dom >= 0 && this.overlap > 2) { if (this.lockT > this.overlap * 0.7) { this.streak++; const pts = Math.round(400 * (1 + this.streak * 0.25) * (this.swap ? 1.3 : 1)); this.score += pts; this.best = Math.max(this.best, pts); this.bump(14, 'Clean transition! +' + pts + (this.streak > 1 ? '  (streak ' + this.streak + ')' : ''), '#46d37a'); } else this.say('Rough transition. Match the tempo and sync the beats first.', '#ffc25e'); }
      this.dom = dom; this.domSince = t; this.overlap = 0; this.lockT = 0; this.swap = false; this.wreckT = 0;
    } else if (dom >= 0 && this.overlap > 0) { this.overlap = 0; this.lockT = 0; this.swap = false; this.wreckT = 0; }   // the other deck came back down: no transition happened
    if (dom >= 0 && t - this.domSince > 150) { this.energy = Math.max(0, this.energy - 1.2 * dt); if (Math.floor(t - this.domSince) === 150 && Math.floor(t - this.domSince - dt) === 149) this.say('Same track for a while… the crowd wants something new.', '#ffc25e'); }
    if (dom >= 0 && this.energy < 50) this.energy += 1.5 * dt;
    for (const d of decks) if (d.fx.some(Boolean) && d.post > 0.02) { this.fxT[d.i] += dt / spbEff(d); if (this.fxT[d.i] > 32) this.energy = Math.max(0, this.energy - 1.5 * dt); if (this.fxT[d.i] > 32 && this.fxT[d.i] - dt / spbEff(d) <= 32) this.say('That effect has been on a long time…', '#ffc25e'); }
    if (this.mrms > 0.01) this.score += this.energy / 100 * 12 * dt;
  },
};

/* ============================== the controller (SVG) ============================== */
const NS = 'http://www.w3.org/2000/svg';
let svg, scr, sctx, rig = {}, BTN = {};
function el(tag, at, parent) { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; }
function txt(p, x, y, s, size = 3.2, anchor = 'middle', fill = '#d7d7d7', w = 600) { const t = el('text', { x, y, 'font-size': size, 'text-anchor': anchor, fill, 'font-weight': w, 'letter-spacing': 0.12, 'pointer-events': 'none' }, p); t.textContent = s; return t; }
const pt = () => svg.createSVGPoint();
function svgXY(e) { const p = pt(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function defs() {
  const df = el('defs', {}, svg);
  const lg = (id, stops, x2 = 0, y2 = 1) => { const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, df); stops.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g)); };
  const rg = (id, stops, fx = 0.35, fy = 0.3) => { const g = el('radialGradient', { id, fx, fy, r: 0.75 }, df); stops.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g)); };
  lg('mBody', [[0, '#26272a'], [0.5, '#17181a'], [1, '#0d0d0e']]);
  lg('mPlate', [[0, '#1d1e21'], [1, '#141517']]);
  lg('mMix', [[0, '#222327'], [1, '#18191c']]);
  rg('kCap', [[0, '#5a5c60'], [0.55, '#2c2d30'], [1, '#121214']]);
  rg('kTop', [[0, '#3d3f43'], [1, '#1d1e21']], 0.4, 0.35);
  rg('kSkirt', [[0, '#0a0a0b'], [1, '#232427']], 0.5, 0.5);
  rg('jTop', [[0, '#5b5e63'], [0.35, '#34363a'], [0.8, '#1c1d20'], [1, '#101012']], 0.38, 0.32);
  rg('jRing', [[0.8, '#111214'], [0.92, '#2a2b2e'], [1, '#0b0b0c']], 0.5, 0.5);
  lg('fCap', [[0, '#5d5f63'], [0.5, '#2a2b2e'], [1, '#18191b']], 1, 0);
  lg('btnB', [[0, '#3a3b3f'], [1, '#1e1f22']]);
  lg('padG', [[0, '#2e2f33'], [1, '#1b1c1f']]);
  const f = el('filter', { id: 'sh', x: '-30%', y: '-30%', width: '160%', height: '160%' }, df); el('feDropShadow', { dx: 0.5, dy: 0.9, stdDeviation: 0.7, 'flood-color': '#000', 'flood-opacity': 0.75 }, f);
  const gl = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, df); el('feGaussianBlur', { stdDeviation: 1.1, result: 'b' }, gl); const mg = el('feMerge', {}, gl); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
}
function dragNum(target, onDelta, onDbl) {
  target.addEventListener('pointerdown', (e) => { e.preventDefault(); AC.resume(); target.setPointerCapture(e.pointerId); let y = e.clientY; const mv = (ev) => { onDelta((y - ev.clientY) / (ev.altKey ? 900 : 160)); y = ev.clientY; }; const up = () => { target.removeEventListener('pointermove', mv); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); }; target.addEventListener('pointermove', mv); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up); });
  target.addEventListener('wheel', (e) => { e.preventDefault(); onDelta(-Math.sign(e.deltaY) * 0.025); }, { passive: false });
  if (onDbl) target.addEventListener('dblclick', onDbl);
}
function knob(id, x, y, r, lab, opt = {}) {
  const g = el('g', { transform: `translate(${x},${y})`, class: 'mk', tabindex: 0, role: 'slider', 'aria-label': lab }, svg);
  for (let i = 0; i <= 10; i++) { const a = (-135 + 27 * i) * Math.PI / 180, r1 = r + 1.6, r2 = r + (i === 0 || i === 5 || i === 10 ? 3 : 2.4); el('line', { x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2, stroke: '#77797d', 'stroke-width': 0.32 }, g); }
  el('circle', { r: r + 0.9, fill: 'url(#kSkirt)', filter: 'url(#sh)' }, g);
  const rot = el('g', {}, g); el('circle', { r, fill: 'url(#kCap)', stroke: '#050505', 'stroke-width': 0.3 }, rot);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; el('line', { x1: Math.sin(a) * r * 0.82, y1: -Math.cos(a) * r * 0.82, x2: Math.sin(a) * r * 0.98, y2: -Math.cos(a) * r * 0.98, stroke: '#0c0c0d', 'stroke-width': 0.25 }, rot); }
  el('circle', { r: r * 0.74, fill: 'url(#kTop)' }, rot);
  el('line', { x1: 0, y1: -r * 0.25, x2: 0, y2: -r * 0.97, stroke: opt.col || '#f2f2f2', 'stroke-width': Math.max(0.55, r * 0.13), 'stroke-linecap': 'round' }, rot);
  if (lab && opt.labY !== null) txt(svg, x + (opt.labX || 0), y + (opt.labY != null ? opt.labY : r + 5.2), lab, opt.ls || 2.6, opt.la || 'middle', '#bdbdbd');
  if (opt.endless) { rig[id] = rot; let acc = 0; dragNum(g, (dv) => { acc += dv; while (acc > 0.024) { opt.onDelta(1); acc -= 0.06; } while (acc < -0.024) { opt.onDelta(-1); acc += 0.06; } }); if (opt.onPush) g.addEventListener('dblclick', opt.onPush); return; }
  const c = C[id]; c.views.push((v) => rot.setAttribute('transform', `rotate(${-135 + 270 * v})`)); rot.setAttribute('transform', `rotate(${-135 + 270 * c.v})`);
  dragNum(g, (dv) => { let v = c.v + dv; if (opt.detent && Math.abs(v - 0.5) < 0.015 && Math.abs(c.v - 0.5) >= 0.015) v = 0.5; setC(id, v, 'ui'); }, () => setC(id, c.def, 'ui'));
  g.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setC(id, c.v + 0.02, 'ui'); e.preventDefault(); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setC(id, c.v - 0.02, 'ui'); e.preventDefault(); } });
}
function fader(id, x1, y1, x2, y2, cw, ch, lab, opt = {}) {
  const g = el('g', { class: 'mf', tabindex: 0, role: 'slider', 'aria-label': lab }, svg), horiz = y1 === y2;
  const sx = Math.min(x1, x2), sy = Math.min(y1, y2), L = Math.hypot(x2 - x1, y2 - y1);
  if (opt.ticks) for (let i = 0; i <= opt.ticks; i++) { const t = i / opt.ticks, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t, big = i === 0 || i === opt.ticks || i * 2 === opt.ticks; if (horiz) el('line', { x1: px, y1: py - ch / 2 - 1.2, x2: px, y2: py - ch / 2 - (big ? 3 : 2.2), stroke: '#77797d', 'stroke-width': 0.3 }, g); else { el('line', { x1: px - cw / 2 - 1.2, y1: py, x2: px - cw / 2 - (big ? 3.2 : 2.2), y2: py, stroke: '#77797d', 'stroke-width': 0.3 }, g); el('line', { x1: px + cw / 2 + 1.2, y1: py, x2: px + cw / 2 + (big ? 3.2 : 2.2), y2: py, stroke: '#77797d', 'stroke-width': 0.3 }, g); } }
  el('rect', horiz ? { x: sx - 2, y: sy - 1.1, width: L + 4, height: 2.2, rx: 1.1, fill: '#050505', stroke: '#2b2c2f', 'stroke-width': 0.3 } : { x: sx - 1.1, y: sy - 2, width: 2.2, height: L + 4, rx: 1.1, fill: '#050505', stroke: '#2b2c2f', 'stroke-width': 0.3 }, g);
  const cap = el('g', { filter: 'url(#sh)' }, g);
  el('rect', { x: -cw / 2, y: -ch / 2, width: cw, height: ch, rx: 0.9, fill: 'url(#fCap)', stroke: '#050505', 'stroke-width': 0.3 }, cap);
  for (const k of [-0.28, 0, 0.28]) el('line', horiz ? { x1: k * cw, y1: -ch / 2 + 0.8, x2: k * cw, y2: ch / 2 - 0.8, stroke: k ? '#0d0d0e' : '#eaeaea', 'stroke-width': k ? 0.35 : 0.5 } : { x1: -cw / 2 + 0.8, y1: k * ch, x2: cw / 2 - 0.8, y2: k * ch, stroke: k ? '#0d0d0e' : '#eaeaea', 'stroke-width': k ? 0.35 : 0.5 }, cap);
  if (lab) txt(svg, opt.lx != null ? opt.lx : (x1 + x2) / 2, opt.ly != null ? opt.ly : Math.max(y1, y2) + 6, lab, 2.6, 'middle', '#bdbdbd');
  const c = C[id], place = (v) => cap.setAttribute('transform', `translate(${x1 + (x2 - x1) * v},${y1 + (y2 - y1) * v})`); c.views.push(place); place(c.v);
  const proj = (p) => clamp(((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / (L * L), 0, 1);
  g.addEventListener('pointerdown', (e) => { e.preventDefault(); AC.resume(); g.setPointerCapture(e.pointerId); const p0 = proj(svgXY(e)), onCap = Math.abs(p0 - c.v) < (horiz ? cw : ch) / L; const off = onCap ? c.v - p0 : 0; if (!onCap) setC(id, p0, 'ui'); const mv = (ev) => setC(id, proj(svgXY(ev)) + off, 'ui'); const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); }; g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up); });
  g.addEventListener('dblclick', () => setC(id, c.def, 'ui'));
  g.addEventListener('keydown', (e) => { const k = e.key; if (k.startsWith('Arrow')) { e.preventDefault(); setC(id, c.v + ((k === 'ArrowDown' || k === 'ArrowRight') === (y2 > y1 || x2 > x1) ? 0.02 : -0.02), 'ui'); } });
}
function button(id, shape, x, y, w, h, lab, opt = {}) {
  const g = el('g', { class: 'mb', tabindex: 0, role: 'button', 'aria-label': opt.aria || lab }, svg);
  let body, led;
  if (shape === 'round') { el('circle', { cx: x, cy: y, r: w + 0.9, fill: '#070708' }, g); body = el('circle', { cx: x, cy: y, r: w, fill: 'url(#btnB)', stroke: '#000', 'stroke-width': 0.3, filter: 'url(#sh)' }, g); led = el('circle', { cx: x, cy: y, r: w - 0.5, fill: 'none', stroke: opt.col || '#f2a31b', 'stroke-width': 0.9, opacity: 0.12 }, g); }
  else if (shape === 'pad') { body = el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 1.6, fill: 'url(#padG)', stroke: '#050505', 'stroke-width': 0.4, filter: 'url(#sh)' }, g); led = el('rect', { x: x - w / 2 + 0.6, y: y - h / 2 + 0.6, width: w - 1.2, height: h - 1.2, rx: 1.2, fill: '#fff', opacity: 0 }, g); }
  else { body = el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 1, fill: 'url(#btnB)', stroke: '#000', 'stroke-width': 0.3, filter: 'url(#sh)' }, g); led = el('rect', { x: x - w / 2 + 0.7, y: y - h / 2 + 0.7, width: w - 1.4, height: h - 1.4, rx: 0.6, fill: opt.col || '#f2a31b', opacity: 0.06 }, g); }
  let t = null; if (lab) t = shape === 'round' ? txt(g, x, y + 1.1, lab, opt.ts || 3, 'middle', '#e9e9e9', 700) : shape === 'pad' ? txt(g, x, y + 1, lab, opt.ts || 2.4, 'middle', '#9a9a9a', 700) : txt(g, x, y + (opt.below ? h / 2 + 3.4 : 0.95), lab, opt.ts || 2.3, 'middle', opt.below ? '#bdbdbd' : '#e6e6e6', 700);
  if (opt.sub) txt(svg, x, y + (shape === 'round' ? w + 4 : h / 2 + 3), opt.sub, 1.9, 'middle', '#8d8f93', 600);
  const press = (on) => { body.setAttribute('transform', on ? `translate(0,0.35)` : ''); if (opt.on) opt.on(on); };
  g.addEventListener('pointerdown', (e) => { e.preventDefault(); AC.resume(); g.setPointerCapture(e.pointerId); press(true); const up = () => { press(false); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); }; g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up); });
  g.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); press(true); } });
  g.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') press(false); });
  BTN[id] = { led, t, shape, cur: null, setLab: (s) => { if (t && t.textContent !== s) t.textContent = s; } };
}
function jog(i, cx, cy, R) {
  const g = el('g', { class: 'mj', role: 'application', 'aria-label': 'Jog wheel ' + 'AB'[i] + '. Drag the top to scratch, the outer ring to nudge, shift-drag to search.' }, svg);
  el('circle', { cx, cy: cy + 1.4, r: R + 2, fill: '#000', opacity: 0.6 }, g);
  el('circle', { cx, cy, r: R + 1.4, fill: '#0a0a0b', stroke: '#2a2b2e', 'stroke-width': 0.5 }, g);
  const spin = el('g', { transform: `translate(${cx},${cy})` }, g);
  el('circle', { r: R, fill: 'url(#jRing)' }, spin);
  for (let k = 0; k < 120; k++) { const a = k / 120 * TAU; el('line', { x1: Math.sin(a) * (R - 6.5), y1: -Math.cos(a) * (R - 6.5), x2: Math.sin(a) * (R - 0.6), y2: -Math.cos(a) * (R - 0.6), stroke: k % 2 ? '#1b1c1f' : '#2d2e32', 'stroke-width': 0.55 }, spin); }
  el('circle', { r: R - 7.5, fill: '#08080a' }, spin);
  el('circle', { r: R - 8.3, fill: 'url(#jTop)' }, spin);
  for (let k = 1; k < 14; k++) el('circle', { r: (R - 9) * k / 14, fill: 'none', stroke: '#000', 'stroke-opacity': 0.18, 'stroke-width': 0.25 }, spin);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; el('circle', { cx: Math.sin(a) * (R - 13), cy: -Math.cos(a) * (R - 13), r: 1.1, fill: '#0d0d0f' }, spin); }
  el('line', { x1: 0, y1: -(R - 10), x2: 0, y2: -(R - 22), stroke: '#f2f2f2', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, spin);
  el('circle', { r: 11, fill: '#0f0f11', stroke: '#3a3b3f', 'stroke-width': 0.4 }, spin);
  txt(spin, 0, 1.6, 'AB'[i], 5.2, 'middle', '#cfd2d6', 800);
  const glow = el('circle', { cx, cy, r: R - 8.5, fill: 'none', stroke: '#ffb347', 'stroke-width': 0.9, opacity: 0, filter: 'url(#glow)', 'pointer-events': 'none' }, g);
  rig['jog' + i] = { spin, glow, cx, cy };
  const d = decks[i];
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault(); AC.resume(); g.setPointerCapture(e.pointerId);
    const p = svgXY(e), r = Math.hypot(p.x - cx, p.y - cy), ring = r > R - 7.5, search = e.shiftKey || d.shift;
    let ang = Math.atan2(p.x - cx, -(p.y - cy));
    if (!ring && !search && d.trk) { if (d.pat) endPattern(d); d.touch = true; d.touchSrc = 'mouse'; d.handOm = d.om; d.handAcc = 0; if (d.slipMode && d.vinyl) post(d, { slip: true }); }
    const mv = (ev) => {
      const q = svgXY(ev), a = Math.atan2(q.x - cx, -(q.y - cy)); let da = a - ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; ang = a;
      if (!d.trk) return;
      if (search) post(d, { nudge: da / TAU * 8 * beatLen(d) });
      else if (ring || !d.vinyl) { if (d.playing) d.bend = clamp(d.bend + da * 0.35, -0.5, 0.5); else post(d, { nudge: da / TAU * beatLen(d) }); }
      else d.handAcc += da;
    };
    const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); if (d.touchSrc === 'mouse') release(d); };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });
}
function release(d) {
  if (d.slipMode && d.vinyl) post(d, { slip: false });
  d.touch = false; d.touchSrc = ''; const target = motorRate(d) * W0;
  if (Math.abs(d.om - target) > 2.5 * W0) { d.free = true; d.freeStop = false; d.tau = 0.45; GAME.trick(d, 4); } else d.tau = d.playing ? 0.09 : OPT.stopT;
}
function buildRig() {
  svg.innerHTML = ''; BTN = {}; rig = {}; defs();
  // chassis
  el('rect', { x: 1, y: 3, width: 480, height: 268, rx: 11, fill: '#000', opacity: 0.55 }, svg);
  el('rect', { x: 0, y: 0, width: 482, height: 270, rx: 11, fill: 'url(#mBody)', stroke: '#2f3034', 'stroke-width': 0.6 }, svg);
  el('rect', { x: 3.5, y: 3.5, width: 475, height: 263, rx: 8.5, fill: 'url(#mPlate)', stroke: '#0a0a0b', 'stroke-width': 0.5 }, svg);
  el('rect', { x: 172, y: 5, width: 138, height: 260, rx: 4, fill: 'url(#mMix)', stroke: '#0b0b0c', 'stroke-width': 0.4 }, svg);
  for (const [x, y] of [[8, 8], [474, 8], [8, 262], [474, 262], [176, 9], [306, 9], [176, 261], [306, 261]]) { el('circle', { cx: x, cy: y, r: 1.3, fill: '#111', stroke: '#3a3b3f', 'stroke-width': 0.3 }, svg); el('line', { x1: x - 0.8, y1: y, x2: x + 0.8, y2: y, stroke: '#3a3b3f', 'stroke-width': 0.3 }, svg); }
  txt(svg, 12, 11.6, 'mosaicDJ', 3.6, 'start', '#e4e4e4', 800); txt(svg, 470, 11.6, 'SB3-STYLE · 2-CHANNEL DJ CONTROLLER', 2.3, 'end', '#9a9a9a', 600);
  for (const i of [0, 1]) {
    const d = decks[i], ox = i ? 292 : 0, tx = i ? 471 : 11, X = (x) => ox + x;
    txt(svg, X(96), 41.5, 'DECK ' + (i + 1), 2.8, 'middle', '#9fa2a6', 800);
    // loop section
    button('half' + i, 'rect', X(30), 19, 15, 7.5, '1/2X', { sub: 'LOOP IN', on: (on) => on && (d.shift ? loopIn(d) : loopSize(d, 0.5)) });
    button('auto' + i, 'rect', X(50), 19, 19, 7.5, 'AUTO LOOP', { ts: 2, sub: 'RELOOP', on: (on) => on && (d.shift ? reloop(d) : autoLoop(d)) });
    button('dbl' + i, 'rect', X(70), 19, 15, 7.5, '2X', { sub: 'LOOP OUT', on: (on) => on && (d.shift ? loopOut(d) : loopSize(d, 2)) });
    // FX unit
    for (let s = 0; s < 3; s++) button('fx' + i + s, 'rect', X(102 + s * 17), 19, 14, 7.5, 'FX ' + (s + 1), { col: '#ff4d6d', sub: '', on: (on) => on && fxBtn(d, s) });
    rig['fxlab' + i] = [0, 1, 2].map((s) => txt(svg, X(102 + s * 17), 26.6, FXT[d.fxType[s]], 1.9, 'middle', '#8d8f93', 600));
    knob('fxlvl' + i, X(156), 21, 5.6, 'LEVEL/DEPTH', { labY: 10, ls: 1.9 });
    txt(svg, X(127), 31.2, '— FX —', 1.8, 'middle', '#6e7074', 700);
    button('vinyl' + i, 'rect', X(30), 34, 15, 6.5, 'VINYL', { ts: 2, sub: '', on: (on) => on && (d.shift ? toggleSlip(d) : (d.vinyl = !d.vinyl, flash(d.vinyl ? 'VINYL (SCRATCH) ON' : 'VINYL OFF: TOP NUDGES', i))) });
    txt(svg, X(30), 40.6, 'SLIP', 1.9, 'middle', '#8d8f93', 600);
    jog(i, X(96), 98, 51);
    // tempo
    txt(svg, tx, 45, 'TEMPO', 2.2, 'middle', '#bdbdbd', 700); txt(svg, tx + (i ? -5.5 : 5.5), 52, '−', 2.6, 'middle', '#9a9a9a'); txt(svg, tx + (i ? -5.5 : 5.5), 150, '+', 2.6, 'middle', '#9a9a9a');
    fader('tempo' + i, tx, 52, tx, 148, 9, 5.4, '', { ticks: 16 });
    rig['tlab' + i] = txt(svg, tx, 155.4, '±8%', 2, 'middle', '#8d8f93', 700);
    button('kl' + i, 'rect', tx, 161, 13, 6.5, 'KEY LOCK', { ts: 1.7, col: '#4dc3ff', on: (on) => on && (d.shift ? cycleRange(d) : keyLock(d)) });
    txt(svg, tx, 167.8, 'RANGE', 1.7, 'middle', '#8d8f93', 600);
    // transport
    button('shift' + i, 'rect', X(i ? 26 : 30), 178, 15, 7, 'SHIFT', { ts: 2.1, col: '#ffffff', on: (on) => { d.shift = on; } });
    button('sync' + i, 'rect', X(i ? 46 : 50), 178, 15, 7, 'SYNC', { ts: 2.1, col: '#4dc3ff', sub: 'QUANTIZE', on: (on) => on && (d.shift ? (OPT.quant = !OPT.quant, saveOpt(), flash(OPT.quant ? 'QUANTIZE ON' : 'QUANTIZE OFF', i)) : syncBtn(d)) });
    button('cue' + i, 'round', X(i ? 32 : 36), 207, 10, 0, 'CUE', { col: '#ff9a1f', on: (on) => (on ? (d.shift ? (post(d, { seek: Math.round(d.trk ? d.trk.grid * sr() : 0) }), 0) : cueDown(d)) : cueUp(d)) });
    button('play' + i, 'round', X(i ? 32 : 36), 237, 10, 0, '▶/❚❚', { ts: 2.8, col: '#43e07a', on: (on) => on && (d.shift ? brakeStop(d) : playBtn(d)) });
    txt(svg, X(i ? 32 : 36), 251.2, 'STUTTER · BRAKE', 1.7, 'middle', '#8d8f93', 600);
    // pad modes + pads
    MODES.forEach((m, k) => { const bx = X(78 + k * 22); txt(svg, bx, 157.5, MODE_NAME[ALT[m]], 1.75, 'middle', '#8d8f93', 600); button('mode' + i + k, 'rect', bx, 163, 19, 6, MODE_NAME[m], { ts: 1.75, col: '#ffffff', on: (on) => on && modeBtn(d, k) }); });
    for (let p = 0; p < 8; p++) { const bx = X(78 + (p % 4) * 22), by = p < 4 ? 184 : 212; button('pad' + i + p, 'pad', bx, by, 19.5, 24, String(p + 1), { ts: 2.2, on: (on) => padPress(d, p, on) }); }
  }
  // mixer
  const MX = 241, S = [206, 276];
  button('load0', 'rect', S[0], 18, 17, 7, 'LOAD', { col: '#ffffff', sub: '◀ A', on: (on) => on && load(0) });
  button('load1', 'rect', S[1], 18, 17, 7, 'LOAD', { col: '#ffffff', sub: 'B ▶', on: (on) => on && load(1) });
  knob('browse', MX, 20, 7.5, 'BROWSE · PUSH', { endless: true, labY: 11, ls: 1.9, onDelta: (s) => browse(-s), onPush: () => browsePush() });
  knob('master', 222, 44, 5.4, 'MASTER', { labY: 9, ls: 1.9 }); knob('phones', 260, 44, 5.4, 'PHONES', { labY: 9, ls: 1.9 });
  button('mcue', 'rect', MX, 44, 10, 6, 'CUE', { ts: 1.8, col: '#ff9a1f', sub: 'MASTER', on: (on) => on && (masterCue = !masterCue) });
  for (const [r, y, lab] of [['trim', 66, 'TRIM'], ['hi', 88, 'HI'], ['mid', 109, 'MID'], ['low', 130, 'LOW'], ['filt', 156, 'FILTER']]) {
    txt(svg, MX, y + 1, lab, 2.4, 'middle', '#c8c8c8', 800); if (r !== 'trim' && r !== 'filt') { txt(svg, MX - 14, y + 7, '−∞', 1.7, 'middle', '#77797d'); txt(svg, MX + 14, y + 7, '−∞', 1.7, 'middle', '#77797d'); }
    for (const i of [0, 1]) knob(r + i, S[i], y, r === 'filt' ? 8 : r === 'trim' ? 5.8 : 7, '', { detent: r !== 'trim', labY: null, col: r === 'filt' ? '#ffcf6b' : undefined });
  }
  txt(svg, MX, 165.5, 'LPF ◀ ▶ HPF', 1.8, 'middle', '#8d8f93', 600);
  for (const i of [0, 1]) {
    button('pfl' + i, 'rect', S[i], 178, 15, 7, 'CUE', { col: '#ff9a1f', sub: '🎧', on: (on) => on && (decks[i].pfl = !decks[i].pfl) });
    fader('fader' + i, S[i], 237, S[i], 193, 11, 6, 'CH ' + (i + 1), { ticks: 10, ly: 244 });
    rig['vu' + i] = Array.from({ length: 9 }, (_, k) => el('rect', { x: S[i] + (i ? -15.5 : 12.5), y: 234 - k * 5, width: 3, height: 3.6, rx: 0.5, fill: k >= 8 ? '#ff3b3b' : k >= 6 ? '#ffb020' : '#3fe06a', opacity: 0.12 }, svg));
  }
  txt(svg, MX, 188, 'LEVEL', 1.7, 'middle', '#77797d', 600);
  fader('xf', 216, 256, 266, 256, 6.5, 11, '', { ticks: 10 });
  txt(svg, 210, 257, 'A', 2.6, 'middle', '#9a9a9a', 800); txt(svg, 272, 257, 'B', 2.6, 'middle', '#9a9a9a', 800); txt(svg, MX, 265, 'CROSSFADER', 1.8, 'middle', '#8d8f93', 700);
}
function toggleSlip(d) { d.slipMode = !d.slipMode; flash(d.slipMode ? 'SLIP ON: scratches keep time' : 'SLIP OFF', d.i); }
function browse(n) { if (!LIB.length) return; libSel = clamp(libSel + n, 0, LIB.length - 1); browseAng += n * 15; }
function browsePush() { const d = decks[0].playing && !decks[1].playing ? 1 : decks[1].playing && !decks[0].playing ? 0 : (decks[0].trk ? 1 : 0); load(d); }

/* ---- lights: one place decides every LED, used by the SVG and the hardware ---- */
function lightState() {
  const t = wall(), blink = Math.floor(t * 2) % 2 === 0, L = {};
  for (const d of decks) {
    const i = d.i, atCue = d.trk && Math.abs(estPos(d) - d.cue) < sr() * 0.03;
    L['play' + i] = d.playing && !d.cuePrev ? 1 : d.trk && blink ? 1 : 0;
    L['cue' + i] = d.cuePrev || (!d.playing && d.trk && (atCue || blink)) ? 1 : 0;
    L['sync' + i] = d.sync ? 1 : 0; L['kl' + i] = d.keyLock ? 1 : 0; L['vinyl' + i] = d.vinyl ? 1 : 0; L['slip' + i] = d.slipMode ? 1 : 0;
    L['auto' + i] = d.loop ? 1 : 0; L['pfl' + i] = d.pfl ? 1 : 0; L['shift' + i] = d.shift ? 1 : 0; L['load' + i] = d.trk ? 1 : 0;
    L['half' + i] = 0; L['dbl' + i] = 0;
    for (let s = 0; s < 3; s++) L['fx' + i + s] = d.fx[s] ? 1 : 0;
    const base = BASE[d.mode]; MODES.forEach((m, k) => { L['mode' + i + k] = m === base ? (d.mode === m ? 1 : (blink ? 1 : 0.35)) : 0; });
    for (let p = 0; p < 8; p++) {
      let v = 0, col = '#ffffff';
      if (d.mode === 'hot') { if (d.trk && d.trk.hot[p] != null) { v = 1; col = HOTC[p]; } }
      else if (d.mode === 'jump') { v = 0.55; col = '#4dc3ff'; }
      else if (d.mode === 'roll') { v = d.roll && d.roll.i === p ? 1 : 0.25; col = '#6bff95'; }
      else if (d.mode === 'slicer') { const b = d.trk ? Math.floor(beatAt(d)) % 8 : -1; v = (d.slicer && d.slicer.i === p) || ((b + 8) % 8 === p && d.playing) ? 1 : 0.2; col = '#ffd23d'; }
      else if (d.mode === 'fade') { v = d.fade ? (blink ? 1 : 0.3) : 0.3; col = '#ff4d6d'; }
      else if (d.mode === 'scratch') { v = d.pat && d.pat.i === p ? 1 : 0.3; col = '#b07bff'; }
      else if (d.mode === 'sampler') { v = sampPlaying.has(p) ? (blink ? 1 : 0.5) : SAMPLES[p] ? 0.35 : 0; col = '#ff9a1f'; }
      else if (d.mode === 'trans') { v = d.trans && d.trans.i === p ? 1 : 0.25; col = '#4dc3ff'; }
      L['pad' + i + p] = v; L['padc' + i + p] = col;
    }
  }
  L.mcue = masterCue ? 1 : 0;
  return L;
}
function padLabel(d, p) {
  switch (d.mode) {
    case 'hot': return d.trk && d.trk.hot[p] != null ? fmtT(d.trk.hot[p] / sr()) : String(p + 1);
    case 'jump': { const j = (d.shift ? JUMPS_SH : JUMPS)[p]; return typeof j === 'string' ? (j === 'start' ? '⏮ START' : 'END ⏭') : (j < 0 ? '◀ ' : '▶ ') + Math.abs(j); }
    case 'fade': return FADES[p][0] + ' ' + FADES[p][1];
    case 'roll': return ROLL_LAB[p];
    case 'scratch': return SCR[p][0];
    case 'slicer': return 'SLICE ' + (p + 1);
    case 'sampler': return SAMP_LAB[p];
    case 'trans': return TRANS_LAB[p];
  }
  return '';
}
function drawRig() {
  const L = lightState();
  for (const id in BTN) {
    const b = BTN[id], v = L[id] || 0, key = v + (L['padc' + id.slice(3)] || '');
    if (b.cur === key) continue; b.cur = key;
    if (b.shape === 'pad') { const c = L['padc' + id.slice(3)] || '#fff'; b.led.setAttribute('fill', c); b.led.setAttribute('opacity', v ? 0.18 + 0.62 * v : 0); b.t.setAttribute('fill', v > 0.5 ? '#111' : '#a9a9a9'); }
    else if (b.shape === 'round') { b.led.setAttribute('opacity', v ? 1 : 0.12); b.led.setAttribute('filter', v ? 'url(#glow)' : ''); }
    else b.led.setAttribute('opacity', v ? 0.25 + 0.65 * v : 0.06);
  }
  for (const d of decks) {
    for (let p = 0; p < 8; p++) BTN['pad' + d.i + p].setLab(padLabel(d, p));
    const j = rig['jog' + d.i]; j.spin.setAttribute('transform', `translate(${j.cx},${j.cy}) rotate(${(d.th * 180 / Math.PI) % 360})`); j.glow.setAttribute('opacity', d.touch ? 0.9 : 0);
    rig['vu' + d.i].forEach((r, k) => r.setAttribute('opacity', d.level * 1.15 > (k + 1) / 9.5 ? 1 : 0.12));
    rig['tlab' + d.i].textContent = '±' + Math.round(d.range * 100) + '%';
    rig['fxlab' + d.i].forEach((t, s) => { t.textContent = FXT[d.fxType[s]]; });
  }
  rig.browse && rig.browse.setAttribute('transform', `rotate(${browseAng})`);
}

/* ============================== the laptop screen ============================== */
const fmtT = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };
let scrW = 0, scrH = 0, zoom = 1, scrDrag = null;
function sizeScreen() { const r = scr.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); scrW = Math.max(300, r.width); scrH = r.height; scr.width = scrW * dpr; scr.height = scrH * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function libArea() { const lw = Math.max(200, Math.min(340, scrW * 0.3)); return { x: scrW - lw, y: 0, w: lw, h: scrH }; }
function drawScreen() {
  if (!scrW) sizeScreen(); const g = sctx, W = scrW, H = scrH, la = libArea(), ww = la.x - 6;
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, W, H);
  const rowH = Math.floor((H - 60) / 2);
  decks.forEach((d, i) => {
    const y0 = 2 + i * (rowH + 24);
    // info strip
    g.font = '700 12px Inter,Segoe UI,sans-serif'; g.textBaseline = 'middle'; g.fillStyle = i ? '#7fd1ff' : '#ffb35c'; g.fillText('AB'[i], 6, y0 + 9);
    const t = d.trk; g.fillStyle = '#e8e6e1'; g.font = '600 12px Inter,Segoe UI,sans-serif';
    const title = t ? t.title : 'Empty deck: pick a record and press LOAD'; g.fillText(title.length > 40 ? title.slice(0, 39) + '…' : title, 22, y0 + 9);
    if (t && !t.pressing) {
      const p = estPos(d) / sr(), info = [bpmEff(d).toFixed(2) + ' BPM', (d.pitch >= 0 ? '+' : '') + (d.pitch * 100).toFixed(1) + '%', '-' + fmtT(t.dur - p), d.keyLock ? 'KEY LOCK' : '', d.sync ? 'SYNC' : '', d.loop ? 'LOOP ' + fmtBeats((d.loop[1] - d.loop[0]) / beatLen(d)) : '', d.slipMode ? 'SLIP' : '', MODE_NAME[d.mode]].filter(Boolean).join('   ');
      g.textAlign = 'right'; g.fillStyle = '#9aa0aa'; g.fillText(info, ww - 4, y0 + 9); g.textAlign = 'left';
    }
    // zoomed waveform
    const wy = y0 + 18, wh = rowH - 12, cx = ww / 2; g.fillStyle = '#111316'; g.fillRect(0, wy, ww, wh);
    if (t && t.wave) {
      const w = t.wave, span = 6 / zoom, p = estPos(d) / sr(), mid = wy + wh / 2, k0f = (p - span / 2) * w.fps, kpp = span * w.fps / ww;
      if (d.loop) { const a = cx + (d.loop[0] / sr() - p) / span * ww, b = cx + (d.loop[1] / sr() - p) / span * ww; g.fillStyle = 'rgba(70,211,122,.16)'; g.fillRect(a, wy, b - a, wh); }
      for (let x = 0; x < ww; x++) {
        const ka = Math.floor(k0f + x * kpp), kb = Math.max(ka + 1, Math.floor(k0f + (x + 1) * kpp)); if (kb <= 0 || ka >= w.n) continue;
        let a = 0, kk = ka; for (let k = Math.max(0, ka); k < kb && k < w.n; k++) if (w.amp[k] > a) { a = w.amp[k]; kk = k; }
        const h = a * (wh / 2 - 2); g.fillStyle = w.col[kk]; g.fillRect(x, mid - h, 1, h * 2);
      }
      const spb = 60 / t.bpm, bStart = Math.ceil((p - span / 2 - t.grid) / spb), bEnd = Math.floor((p + span / 2 - t.grid) / spb);
      for (let b = bStart; b <= bEnd; b++) { const x = cx + (t.grid + b * spb - p) / span * ww; g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.16)'; g.fillRect(x, wy, 1, b % 4 === 0 ? wh : 6); }
      const mark = (pos, col, lab) => { const x = cx + (pos / sr() - p) / span * ww; if (x < -10 || x > ww + 10) return; g.fillStyle = col; g.fillRect(x, wy, 2, wh); g.beginPath(); g.moveTo(x, wy); g.lineTo(x + 7, wy); g.lineTo(x, wy + 7); g.fill(); if (lab) { g.font = '700 9px Inter,sans-serif'; g.fillStyle = '#000'; g.fillText(lab, x + 1, wy + 4); } };
      mark(d.cue, '#ff9a1f'); t.hot.forEach((h, k) => h != null && mark(h, HOTC[k], String(k + 1)));
      if (d.slipMode || d.roll || d.slicer || d.pat) { const gx = cx + (d.ghost / sr() - p) / span * ww; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(gx, wy, 1, wh); }
    } else if (t && t.pressing) { g.fillStyle = '#9aa0aa'; g.textAlign = 'center'; g.fillText(t.artist, ww / 2, wy + wh / 2); g.textAlign = 'left'; }
    g.fillStyle = '#ff3b30'; g.fillRect(cx - 1, wy, 2, wh);
    // overview
    const oy = wy + wh + 2; g.fillStyle = '#0e1012'; g.fillRect(0, oy, ww, 14);
    if (t && t.wave) { const w = t.wave; for (let x = 0; x < ww; x++) { const k = Math.floor(x / ww * w.ov.length), a = w.ov[k]; g.fillStyle = w.ovc[k]; g.fillRect(x, oy + 7 - a * 6, 1, a * 12); } const px = estPos(d) / t.n * ww; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, oy, px, 14); g.fillStyle = '#fff'; g.fillRect(px, oy, 1.5, 14); t.hot.forEach((h, k) => { if (h != null) { g.fillStyle = HOTC[k]; g.fillRect(h / t.n * ww, oy, 2, 4); } }); }
  });
  // library
  g.fillStyle = '#121418'; g.fillRect(la.x, 0, la.w, la.h); g.fillStyle = '#9aa0aa'; g.font = '700 10px Inter,sans-serif'; g.fillText('LIBRARY · turn BROWSE, press LOAD', la.x + 8, 12);
  const rh = 30, rows = Math.max(1, Math.floor((la.h * 0.52 - 22) / rh)); if (libSel < libTop) libTop = libSel; if (libSel >= libTop + rows) libTop = libSel - rows + 1;
  for (let r = 0; r < rows; r++) {
    const k = libTop + r, t = LIB[k]; if (!t) break; const y = 22 + r * rh;
    if (k === libSel) { g.fillStyle = '#2a2e34'; g.fillRect(la.x + 4, y, la.w - 8, rh - 3); g.fillStyle = '#ff8a1f'; g.fillRect(la.x + 4, y, 3, rh - 3); }
    g.fillStyle = '#e8e6e1'; g.font = '600 12px Inter,sans-serif'; g.fillText(t.title.length > 30 ? t.title.slice(0, 29) + '…' : t.title, la.x + 12, y + 9);
    g.fillStyle = '#8d939c'; g.font = '500 10px Inter,sans-serif'; g.fillText((t.bpm ? t.bpm.toFixed(1) + ' BPM · ' : '') + (t.dur ? fmtT(t.dur) + ' · ' : '') + t.artist, la.x + 12, y + 21);
    decks.forEach((d) => { if (d.trk === t) { g.fillStyle = d.i ? '#7fd1ff' : '#ffb35c'; g.font = '800 11px Inter,sans-serif'; g.fillText('AB'[d.i], la.x + la.w - 18, y + 9); } });
  }
  // crowd + score
  const cy = la.h * 0.52 + 4, ch = la.h - cy - 4; g.fillStyle = '#0d0f12'; g.fillRect(la.x + 4, cy, la.w - 8, ch);
  const E = GAME.energy, dom = decks.find((d) => d.playing && d.post > 0.03), beat = dom ? beatAt(dom) : wall() * 2, bounce = Math.pow(1 - frac(beat), 3);
  const n = 18, hue = E > 70 ? 30 : E > 40 ? 200 : 260;
  g.fillStyle = `hsla(${hue},90%,55%,${0.05 + 0.25 * E / 100 * bounce})`; g.fillRect(la.x + 4, cy, la.w - 8, ch);
  for (let k = 0; k < n; k++) {
    const here = k / n < 0.25 + E / 100 * 0.8; if (!here) continue;
    const x = la.x + 14 + (k + 0.5) * (la.w - 28) / n + Math.sin(k * 7.3) * 3, base = cy + ch - 6 - (k % 3) * 4, jump = GAME.started ? bounce * (2 + E / 100 * 9) * (0.6 + 0.4 * Math.sin(k * 2.1 + 1)) : 0;
    g.fillStyle = `hsl(${(k * 47) % 360},25%,${18 + (k % 3) * 6}%)`; g.beginPath(); g.ellipse(x, base - 14 - jump, 4.2, 9, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x, base - 26 - jump, 3.6, 0, TAU); g.fill();
    if (E > 75) { g.strokeStyle = g.fillStyle; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 3, base - 20 - jump); g.lineTo(x - 6, base - 34 - jump - bounce * 3); g.moveTo(x + 3, base - 20 - jump); g.lineTo(x + 6, base - 34 - jump - bounce * 3); g.stroke(); }
  }
  g.fillStyle = '#1d2026'; g.fillRect(la.x + 12, cy + 8, la.w - 24, 7); const eg = g.createLinearGradient(la.x + 12, 0, la.x + la.w - 12, 0); eg.addColorStop(0, '#ef4444'); eg.addColorStop(0.5, '#ffc25e'); eg.addColorStop(1, '#46d37a'); g.fillStyle = eg; g.fillRect(la.x + 12, cy + 8, (la.w - 24) * E / 100, 7);
  g.fillStyle = '#e8e6e1'; g.font = '700 11px Inter,sans-serif'; g.fillText('CROWD ' + Math.round(E) + '%', la.x + 12, cy + 26); g.textAlign = 'right'; g.fillText('SCORE ' + Math.round(GAME.score).toLocaleString(), la.x + la.w - 12, cy + 26); g.textAlign = 'left';
  g.font = '500 10px Inter,sans-serif'; g.fillStyle = '#9aa0aa'; g.fillText('Streak ' + GAME.streak + ' · Best mix +' + GAME.best + ' · Trainwrecks ' + GAME.wrecks, la.x + 12, cy + 40);
  const tt = wall(); GAME.feed.forEach((m, k) => { const age = tt - m.t; if (age > 6) return; g.globalAlpha = Math.max(0, 1 - age / 6); g.fillStyle = m.c || '#e8e6e1'; g.font = '700 11px Inter,sans-serif'; g.fillText(m.s, la.x + 12, cy + 56 + k * 14); g.globalAlpha = 1; });
  // deck message popups
  msgs.forEach((m) => { const age = tt - m.t; if (age > 1.6) return; g.globalAlpha = Math.max(0, 1 - age / 1.6); g.fillStyle = 'rgba(0,0,0,.7)'; g.font = '800 13px Inter,sans-serif'; const w = g.measureText(m.s).width + 16, x = ww / 2 - w / 2, y = 2 + m.i * (rowH + 24) + 18 + rowH / 2 - 26; g.fillRect(x, y, w, 22); g.fillStyle = '#ffc25e'; g.fillText(m.s, x + 8, y + 11); g.globalAlpha = 1; });
}
function screenPointer(e, type) {
  const r = scr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, la = libArea(), rowH = Math.floor((scrH - 60) / 2), ww = la.x - 6;
  if (x >= la.x) { if (y > 22 && y < la.h * 0.52) { const k = libTop + Math.floor((y - 22) / 30); if (LIB[k]) { libSel = k; if (type === 'dbl') browsePush(); } } return; }
  for (const i of [0, 1]) {
    const y0 = 2 + i * (rowH + 24), wy = y0 + 18, wh = rowH - 12, oy = wy + wh + 2, d = decks[i]; if (!d.trk) continue;
    if (y >= oy && y <= oy + 14 && type === 'down') { post(d, { seek: clamp(x / ww, 0, 1) * d.trk.n }); GAME.trick(d, 0); return; }
    if (y >= wy && y <= wy + wh) { if (type === 'down') scrDrag = { i, x }; return; }
  }
}

/* ============================== page wiring ============================== */
function css() {
  const s = document.createElement('style'); s.textContent = `
  #v-dj.show{display:flex;flex-direction:column;gap:8px;padding:8px;overflow:hidden}
  #v-dj .djbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap} #v-dj .djbar .sp{flex:1}
  #djscr{width:100%;height:clamp(170px,30vh,270px);display:block;border-radius:10px;background:#0b0c0e;cursor:default}
  #djrig{flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start}
  #djsvg{width:100%;height:100%;max-width:1500px;touch-action:none;user-select:none;font-family:Inter,"Segoe UI",Arial,sans-serif}
  #djsvg .mb,#djsvg .mk,#djsvg .mf,#djsvg .mj{cursor:pointer;outline:none} #djsvg .mj{cursor:grab} #djsvg .mk:focus-visible circle,#djsvg .mb:focus-visible rect{stroke:#ff8a1f;stroke-width:.6}
  .djpill{padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:#0d0f11;font-weight:600;white-space:nowrap} .djpill.ok{border-color:#46d37a;color:#46d37a} .djpill.warn{border-color:#ffc25e;color:#ffc25e}
  #djsetd .cg{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px} #djsetd label{display:flex;gap:8px;align-items:center} #djmon{font:11px ui-monospace,Consolas,monospace;background:#0d0f11;border:1px solid var(--line);border-radius:8px;padding:6px;height:150px;overflow:auto;white-space:pre}
  #djhelpd ul{margin:6px 0;padding-left:18px} #djhelpd li{margin:3px 0}
  @media (max-width:800px){#djscr{height:150px}}`;
  document.head.appendChild(s);
}
function buildView() {
  const v = document.getElementById('v-dj');
  v.innerHTML = `<div class="djbar"><button id="djadd" title="Add MP3, WAV, FLAC and other audio files to the library">＋ Add tracks…</button><button id="djmine" title="Render the song you made in mosaicBeats and add it as a record">♪ My beat</button><button id="djla" title="Load the selected record onto deck A">Load → A</button><button id="djlb" title="Load the selected record onto deck B">Load → B</button><span class="sp"></span><span id="djmidi" class="djpill" title="Plug in a Pioneer DDJ-SB3 over USB">🎛 No controller</span><button id="djconn">Connect DDJ-SB3</button><button id="djset" title="Settings">⚙ Settings</button><button id="djhelp">How to play</button><input id="djfile" type="file" accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aif,.aiff,.opus" multiple hidden></div>
  <canvas id="djscr" aria-label="DJ software screen: waveforms, library and crowd"></canvas>
  <div id="djrig"><svg id="djsvg" viewBox="-2 -2 486 276" preserveAspectRatio="xMidYMin meet" aria-label="DJ controller"></svg></div>`;
  const dlg = document.createElement('div'); dlg.innerHTML = `
  <dialog id="djsetd" style="width:min(640px,94vw)"><h3 style="margin:0 0 10px">DJ settings</h3><div class="cg">
   <label>Crossfader curve <select id="djcf"><option value="blend">Smooth blend</option><option value="cut">Scratch cut</option></select></label>
   <label><input type="checkbox" id="djq"> Quantize (snap cues and loops to the beat)</label>
   <label>Headphone cue <select id="djhp"><option value="auto">Auto (DDJ-SB3 phones when its sound card is the output)</option><option value="split">Split cue: master left ear, cue right ear</option><option value="off">Off</option></select></label>
   <label><input type="checkbox" id="djtinv"> Reverse tempo fader direction</label>
   <label>Jog sensitivity <input type="range" id="djjs" min="0.4" max="2" step="0.05"></label>
   <label>Motor start <input type="range" id="djst" min="0.01" max="0.6" step="0.01"></label>
   <label>Motor stop <input type="range" id="djsp" min="0.01" max="1.5" step="0.01"></label>
   <label>Output <select id="djout"><option value="">System default</option></select></label></div>
   <h4>Controller</h4><p class="note" id="djmstat">Not connected.</p>
   <div class="row"><button id="djinit">Re-send setup to controller</button><label><input type="checkbox" id="djmonon"> Show MIDI monitor</label></div>
   <div id="djmon" hidden></div>
   <p style="margin:12px 0 0;text-align:right"><button id="djsetclose" class="on">Done</button></p></dialog>
  <dialog id="djhelpd" style="width:min(680px,94vw)"><h3 style="margin:0 0 6px">How to play mosaicDJ</h3>
   <ul><li><b>Load:</b> pick a record in the library (scroll, or turn BROWSE), press <b>LOAD</b> on a deck. Three demo records are pressed for you; add your own with <b>Add tracks</b> or drag files onto this tab.</li>
   <li><b>Play/CUE:</b> ▶ starts and stops. CUE while stopped sets the cue point; hold it to preview, keep holding and press ▶ to carry on. CUE while playing jumps back and stops.</li>
   <li><b>Jog:</b> drag the top to scratch: the record moves exactly as fast as your hand. Let go with a flick to spin it. Drag the outer ring to nudge the beat. Hold SHIFT (or the Shift key) and drag to search.</li>
   <li><b>Beatmatch:</b> match BPM with the TEMPO fader (or press SYNC), line up the kicks with the jog ring, bring the other channel in with its fader or the crossfader. Swap the LOW knobs over so the bass never doubles up.</li>
   <li><b>Pads:</b> HOT CUE, FX FADE, PAD SCRATCH and SAMPLER. Hold SHIFT and press a mode for BEAT JUMP, ROLL, SLICER and TRANS. In HOT CUE, SHIFT+pad deletes.</li>
   <li><b>FX:</b> FX 1–3 switch effects on; LEVEL/DEPTH sets how much. SHIFT+FX changes which effect a button holds.</li>
   <li><b>The crowd:</b> clean beatmatched transitions, bass swaps and well-timed tricks raise the energy. Dead air, trainwrecks, two basslines at once and air-horn spam drain it.</li>
   <li><b>Keys:</b> Deck A pads 1 2 3 4 / Q W E R, CUE A, PLAY S, SYNC D. Deck B pads 7 8 9 0 / U I O P, CUE J, PLAY K, SYNC L. Crossfader ← →. Shift = SHIFT.</li>
   <li><b>DDJ-SB3:</b> plug it in over USB and press <b>Connect DDJ-SB3</b> (Chrome or Edge). Close Serato or rekordbox first: only one program can use the controller. Every knob, fader, jog, pad and button works, its lights and meters follow along, and if its sound card is your output the headphone cue goes to its phones socket.</li></ul>
   <p style="text-align:right;margin:10px 0 0"><button id="djhelpclose" class="on">Close</button></p></dialog>`;
  document.body.append(...dlg.children);
  svg = document.getElementById('djsvg'); scr = document.getElementById('djscr'); sctx = scr.getContext('2d');
  buildRig();
  const $i = (id) => document.getElementById(id);
  $i('djadd').onclick = () => $i('djfile').click(); $i('djfile').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  $i('djmine').onclick = addMyBeat; $i('djla').onclick = () => load(0); $i('djlb').onclick = () => load(1);
  $i('djhelp').onclick = () => $i('djhelpd').showModal(); $i('djhelpclose').onclick = () => $i('djhelpd').close();
  $i('djset').onclick = () => { $i('djcf').value = OPT.cf; $i('djq').checked = OPT.quant; $i('djhp').value = OPT.hp; $i('djtinv').checked = OPT.tempoInv; $i('djjs').value = OPT.jogSens; $i('djst').value = OPT.startT; $i('djsp').value = OPT.stopT; fillOutputs(); $i('djsetd').showModal(); };
  $i('djsetclose').onclick = () => $i('djsetd').close();
  $i('djcf').onchange = (e) => { OPT.cf = e.target.value; saveOpt(); applyXf(); };
  $i('djq').onchange = (e) => { OPT.quant = e.target.checked; saveOpt(); };
  $i('djhp').onchange = (e) => { OPT.hp = e.target.value; saveOpt(); route(); toast(A && A.route === '4ch' ? 'Headphone cue → output channels 3/4 (DDJ-SB3 phones)' : A && A.route === 'split' ? 'Split cue: master in the left ear, cue in the right' : 'Headphone cue off: only the master is heard'); };
  $i('djtinv').onchange = (e) => { OPT.tempoInv = e.target.checked; saveOpt(); decks.forEach((d) => setC('tempo' + d.i, C['tempo' + d.i].v, 'ui')); };
  $i('djjs').oninput = (e) => { OPT.jogSens = +e.target.value; saveOpt(); };
  $i('djst').oninput = (e) => { OPT.startT = +e.target.value; saveOpt(); };
  $i('djsp').oninput = (e) => { OPT.stopT = +e.target.value; saveOpt(); };
  $i('djout').onchange = async (e) => { if (!AC.setSinkId) return toast('This browser cannot choose an output device; use Chrome or Edge'); try { await AC.setSinkId(e.target.value); route(); toast('Output: ' + (e.target.selectedOptions[0].textContent) + (A && A.route === '4ch' ? ' · headphone cue on channels 3/4' : '')); } catch (err) { toast('Could not switch output: ' + err.message, 6000); } };
  scr.addEventListener('pointerdown', (e) => { AC.resume(); screenPointer(e, 'down'); if (scrDrag) scr.setPointerCapture(e.pointerId); });
  scr.addEventListener('pointermove', (e) => { if (!scrDrag) return; const d = decks[scrDrag.i], dx = e.clientX - scrDrag.x; scrDrag.x = e.clientX; if (!d.playing) post(d, { nudge: -dx / (libArea().x - 6) * (6 / zoom) * sr() }); });
  scr.addEventListener('pointerup', () => { scrDrag = null; });
  scr.addEventListener('dblclick', (e) => screenPointer(e, 'dbl'));
  scr.addEventListener('wheel', (e) => { const r = scr.getBoundingClientRect(); if (e.clientX - r.left >= libArea().x) { e.preventDefault(); browse(Math.sign(e.deltaY)); } else if (e.ctrlKey || e.altKey) { e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.3, 6); } }, { passive: false });
  addEventListener('resize', () => { scrW = 0; });
  new ResizeObserver(() => { scrW = 0; }).observe(scr);
}
async function fillOutputs() {
  const sel = document.getElementById('djout'); if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
    sel.innerHTML = '<option value="">System default</option>' + devs.filter((d) => d.deviceId !== 'default').map((d, k) => '<option value="' + esc(d.deviceId) + '">' + esc(d.label || ('Output ' + (k + 1))) + '</option>').join('');
    if (AC.sinkId) sel.value = AC.sinkId;
  } catch (e) { /* no device list */ }
}
/* the DDJ-SB3's own sound card: pick it as output if we can see it */
async function useSB3Output() {
  if (!AC.setSinkId || !navigator.mediaDevices) return false;
  try { const dev = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === 'audiooutput' && /DDJ-SB3|DDJ.?SB/i.test(d.label)); if (!dev) return false; await AC.setSinkId(dev.deviceId); route(); return true; } catch (e) { return false; }
}
function keys() {
  const PADA = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR'], PADB = ['Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
  const act = (e, down) => {
    if (curView !== 'dj' || (e.target.closest && e.target.closest('input,select,textarea,dialog'))) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code;
    if (c === 'ShiftLeft' || c === 'ShiftRight') { decks.forEach((d) => (d.shift = down)); return stop(e); }
    if (e.repeat && !c.startsWith('Arrow')) return stop(e);
    let k = PADA.indexOf(c); if (k >= 0) { padPress(decks[0], k, down, e.shiftKey); return stop(e); }
    k = PADB.indexOf(c); if (k >= 0) { padPress(decks[1], k, down, e.shiftKey); return stop(e); }
    const M = { KeyA: [0, 'cue'], KeyS: [0, 'play'], KeyD: [0, 'sync'], KeyJ: [1, 'cue'], KeyK: [1, 'play'], KeyL: [1, 'sync'] }[c];
    if (M) { const d = decks[M[0]]; if (M[1] === 'cue') down ? cueDown(d) : cueUp(d); else if (down) M[1] === 'play' ? (e.shiftKey ? brakeStop(d) : playBtn(d)) : syncBtn(d); return stop(e); }
    if (c === 'ArrowLeft' && down) { setC('xf', C.xf.v - (e.shiftKey ? 1 : 0.06), 'ui'); return stop(e); }
    if (c === 'ArrowRight' && down) { setC('xf', C.xf.v + (e.shiftKey ? 1 : 0.06), 'ui'); return stop(e); }
    if (c === 'Space' || c === 'KeyZ' || c === 'KeyX' || c === 'KeyR') return stop(e);   // keep the studio's own shortcuts quiet on this tab
  };
  const stop = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  addEventListener('keydown', (e) => act(e, true), true); addEventListener('keyup', (e) => act(e, false), true);
  // dropping audio on this tab adds records instead of sample channels
  const dj = (e) => curView === 'dj' && e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  addEventListener('dragover', (e) => { if (dj(e)) { e.preventDefault(); e.stopImmediatePropagation(); e.dataTransfer.dropEffect = 'copy'; } }, true);
  addEventListener('drop', (e) => { if (dj(e)) { e.preventDefault(); e.stopImmediatePropagation(); const dr = document.getElementById('drop'); if (dr) dr.style.display = 'none'; addFiles([...e.dataTransfer.files]); } }, true);
}
function ensure() {
  if (inited) return; inited = true; css(); defineControls(); buildView(); keys();
  ensureAudio().then(() => pressDemos());
  requestAnimationFrame(frame);
}

/* ============================== public API (used by dj-midi.js and index.html) ============================== */
window.MDJ = {
  ensure, decks, C, OPT, LIB, lightState, useSB3Output, route,
  show() { ensure(); scrW = 0; AC.resume(); },
  setC, ensureAudio,
  btn(i, name, down) {
    const d = decks[i]; if (!d) return;
    switch (name) {
      case 'play': if (down) playBtn(d); break;
      case 'brake': if (down) brakeStop(d); break;
      case 'cue': down ? cueDown(d) : cueUp(d); break;
      case 'start': if (down && d.trk) post(d, { seek: Math.round(d.trk.grid * sr()) }); break;
      case 'sync': if (down) syncBtn(d); break;
      case 'quant': if (down) { OPT.quant = !OPT.quant; saveOpt(); flash(OPT.quant ? 'QUANTIZE ON' : 'QUANTIZE OFF', i); } break;
      case 'shift': d.shift = down; break;
      case 'vinyl': if (down) { d.vinyl = !d.vinyl; flash(d.vinyl ? 'VINYL (SCRATCH) ON' : 'VINYL OFF: TOP NUDGES', i); } break;
      case 'slip': if (down) toggleSlip(d); break;
      case 'keylock': if (down) keyLock(d); break;
      case 'range': if (down) cycleRange(d); break;
      case 'auto': if (down) autoLoop(d); break;
      case 'reloop': if (down) reloop(d); break;
      case 'half': if (down) loopSize(d, 0.5); break;
      case 'double': if (down) loopSize(d, 2); break;
      case 'loopin': if (down) loopIn(d); break;
      case 'loopout': if (down) loopOut(d); break;
      case 'pfl': if (down) d.pfl = !d.pfl; break;
      case 'load': if (down) load(i); break;
      default:
        if (name.startsWith('mode:')) { if (down) setMode(d, name.slice(5)); }
        else if (name.startsWith('fx')) { if (down) fxBtn(d, +name[2], name[3] === 's'); }
    }
  },
  pad(i, mode, idx, shift, down) { const d = decks[i]; if (!d) return; if (down && d.mode !== mode) { endPads(d); d.mode = mode; } padPress(d, idx, down, shift, mode); },
  touch(i, on) { const d = decks[i]; if (!d || !d.trk) return; if (on) { if (d.pat) endPattern(d); if (d.vinyl) { d.touch = true; d.touchSrc = 'hw'; d.handOm = d.om; d.handAcc = 0; if (d.slipMode) post(d, { slip: true }); } } else if (d.touchSrc === 'hw') { release(d); if (d.slipMode) post(d, { slip: false }); } },
  jog(i, kind, ticks) {
    const d = decks[i]; if (!d || !d.trk) return; const da = ticks * TAU / 720 * OPT.jogSens;
    if (kind === 'search') return post(d, { nudge: da / TAU * 8 * beatLen(d) });
    if (kind === 'top' && d.touch && d.touchSrc === 'hw') { d.handAcc += da; return; }
    if (d.playing) d.bend = clamp(d.bend + da * 0.35, -0.5, 0.5); else post(d, { nudge: da / TAU * beatLen(d) });
  },
  browse, browsePush, masterCue() { masterCue = !masterCue; },
  flash, toast: (s, ms) => toast(s, ms),
  status(s, cls) { const p = document.getElementById('djmidi'); if (p) { p.textContent = s; p.className = 'djpill ' + (cls || ''); } const m = document.getElementById('djmstat'); if (m) m.textContent = s; },
  monitor(line) { const m = document.getElementById('djmon'); if (!m || m.hidden) return; m.textContent = (line + '\n' + m.textContent).slice(0, 4000); },
  beatInfo(i) { const d = decks[i]; return d && d.trk ? { bpm: bpmEff(d), level: d.level } : { bpm: 0, level: d ? d.level : 0 }; },
  onFrame: null, onLoad: null,
};
// pick up a controller that was already allowed on an earlier visit, and keep the cue routing right when the output changes
if (AC.addEventListener) AC.addEventListener('sinkchange', () => route());
})();
