/* dj-midi.js: plays mosaicDJ from a real Pioneer DDJ-SB3 over Web MIDI (Chrome / Edge, on https or localhost).
 *
 * The message map comes from Mixxx's open-source DDJ-SB3 mapping (res/controllers/Pioneer-DDJ-SB3.midi.xml and
 * Pioneer-DDJ-SB3-scripts.js):
 *   0x90-0x93  deck 1-4 buttons        0xB0-0xB3  deck CCs (jog, tempo, channel fader, trim, EQ)
 *   0x94/0x95  FX unit 1/2 buttons     0xB4/0xB5  FX unit knobs
 *   0x96       load, browse push, master cue      0xB6  filters, crossfader, master, phones, browse turn
 *   0x97-0x9A  performance pads for deck 1-4 (note = mode group 0x00..0x70 + pad 0-7, +8 when SHIFT is held)
 * Faders and knobs are 14-bit (MSB on CC n, LSB on CC n+0x20). Jogs are relative around 0x40, 720 ticks a turn.
 * LEDs answer on the same note numbers; channel meters are CC 0x02 on 0xB0+deck (0-117, 119 = clip).
 * Pressing a button only ever calls the same functions as the on-screen controller (window.MDJ).
 */
(() => {
'use strict';
const M = () => window.MDJ;
let access = null, inp = null, out = null, sysex = false, deck34 = false, lastLed = 0, bpmT = 0;
const v14 = {}, sent = new Map(), lastBpm = [0, 0], vuSent = [-1, -1], padGroup = [null, null];
const hex = (a) => [...a].map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
const isSB3 = (p) => /DDJ[-_ ]?SB3/i.test(p.name || '') || /DDJ[-_ ]?SB/i.test(p.name || '');
const AB = (i) => 'AB'[i];
function send(bytes) { if (!out) return; try { out.send(bytes); } catch (e) { /* unplugged mid-send */ } }
function led(st, n, on) { const k = st * 256 + n, v = on ? 0x7F : 0; if (sent.get(k) === v) return; sent.set(k, v); send([st, n, v]); }

/* ---------- connecting ---------- */
async function connect(fromUser) {
  if (!navigator.requestMIDIAccess) { M().status('🎛 Web MIDI not supported here', 'warn'); if (fromUser) toast('This browser has no Web MIDI. Open mosaicBeats in Chrome or Edge to use the DDJ-SB3.', 8000); return; }
  if (!access) {
    try { access = await navigator.requestMIDIAccess({ sysex: true }); sysex = true; }
    catch (e) {
      try { access = await navigator.requestMIDIAccess(); sysex = false; }
      catch (e2) { M().status('🎛 MIDI access refused', 'warn'); if (fromUser) toast('MIDI access was refused. Allow MIDI for this site (the icon in the address bar), then press Connect again.', 8000); return; }
    }
    access.onstatechange = () => attach(false);
  }
  attach(fromUser);
}
function attach(fromUser) {
  const ins = [...access.inputs.values()], outs = [...access.outputs.values()], i = ins.find(isSB3) || null, o = outs.find(isSB3) || null;
  if (i && i === inp) { out = o; return; }
  if (inp) inp.onmidimessage = null;
  inp = i; out = o; sent.clear(); for (const k in v14) delete v14[k]; padGroup[0] = padGroup[1] = null; vuSent[0] = vuSent[1] = -1;
  if (!inp) {
    M().status('🎛 No controller', '');
    if (fromUser) toast(ins.length ? 'No DDJ-SB3 among your MIDI devices (' + ins.map((p) => p.name).join(', ') + ').' : 'No MIDI controller found. Plug the DDJ-SB3 in over USB, close Serato DJ or rekordbox (only one program can use it), then press Connect again.', 9000);
    return;
  }
  M().ensure(); M().ensureAudio();
  inp.onmidimessage = onMsg;
  M().status('🎛 ' + inp.name + (out ? '' : ' (no lights)'), 'ok');
  toast('DDJ-SB3 connected: every jog, fader, knob, pad and button now plays mosaicDJ.' + (sysex ? '' : ' (SysEx not allowed, so the BPM display on the unit stays off.)'), 6000);
  if (typeof curView !== 'undefined' && curView !== 'dj' && typeof showView === 'function') showView('dj');
  hello();
  M().useSB3Output().then((ok) => { if (ok) toast('Sound now plays through the DDJ-SB3: master out, and headphone cue on its phones socket.', 6500); });
}
function hello() {
  if (sysex) send([0xF0, 0x00, 0x20, 0x7F, 0x03, 0x01, 0xF7]);   // the init message Mixxx sends
  send([0x9B, 0x09, 0x7F]);                                        // "tell me where every knob and fader is", so the screen matches the hardware
  sent.clear(); lastBpm[0] = lastBpm[1] = 0; vuSent[0] = vuSent[1] = -1; padGroup[0] = padGroup[1] = null;
}
async function autoConnect() {
  if (!navigator.requestMIDIAccess || !navigator.permissions) return;
  for (const q of [{ name: 'midi', sysex: true }, { name: 'midi' }]) {
    try { const p = await navigator.permissions.query(q); if (p.state === 'granted') { connect(false); return; } p.onchange = () => { if (p.state === 'granted') connect(false); }; return; } catch (e) { /* this browser does not know that permission name */ }
  }
}

/* ---------- reading the controller ---------- */
function onMsg(e) {
  const d = e.data; if (!d || d.length < 2 || d[0] === 0xF0) return;
  const st = d[0], t = st & 0xF0, ch = st & 0x0F, n = d[1], v = d.length > 2 ? d[2] : 0;
  let what = null;
  try { what = t === 0x90 || t === 0x80 ? note(ch, n, t === 0x90 && v > 0) : t === 0xB0 ? cc(ch, n, v) : null; } catch (err) { what = 'error: ' + err.message; }
  M().monitor(hex(d) + '   ' + (what || 'not used by mosaicDJ'));
}
function deckOf(ch) {
  if (ch >= 2 && !deck34) { deck34 = true; toast('The controller is on DECK 3/4. mosaicDJ has two decks, so those controls play deck ' + AB(ch & 1) + '. Press DECK 3/4 again to go back.', 7000); }
  if (ch < 2) deck34 = false;
  return ch & 1;
}
const DECK_BTN = { 0x0B: 'play', 0x47: 'brake', 0x0C: 'cue', 0x48: 'start', 0x58: 'sync', 0x5C: 'quant', 0x17: 'vinyl', 0x40: 'slip', 0x1A: 'keylock', 0x60: 'range', 0x14: 'auto', 0x50: 'reloop', 0x54: 'pfl', 0x68: 'pfl', 0x12: 'half', 0x61: 'loopin', 0x13: 'double', 0x62: 'loopout', 0x3F: 'shift' };
const MODE_NOTE = { 0x1B: 'hot', 0x69: 'jump', 0x1E: 'fade', 0x6B: 'roll', 0x20: 'scratch', 0x6D: 'slicer', 0x22: 'sampler', 0x6E: 'trans' };
const PAD_GROUP = { 0x00: 'hot', 0x10: 'fade', 0x20: 'scratch', 0x30: 'sampler', 0x40: 'jump', 0x50: 'roll', 0x60: 'slicer', 0x70: 'trans' };
const GROUP_OF = { hot: 0x00, fade: 0x10, scratch: 0x20, sampler: 0x30, jump: 0x40, roll: 0x50, slicer: 0x60, trans: 0x70 };
function note(ch, n, on) {
  const m = M();
  if (ch <= 3) {
    const i = deckOf(ch);
    if (n === 0x36 || n === 0x35 || n === 0x67) { m.touch(i, on); return 'jog touch ' + AB(i) + (on ? ' on' : ' off'); }
    if (MODE_NOTE[n]) { if (on) m.btn(i, 'mode:' + MODE_NOTE[n], true); return 'pad mode ' + MODE_NOTE[n] + ' ' + AB(i); }
    if (n === 0x72) { return 'DECK 3/4 toggle'; }
    if (DECK_BTN[n]) { m.btn(i, DECK_BTN[n], on); return DECK_BTN[n] + ' ' + AB(i) + (on ? ' down' : ' up'); }
    return null;
  }
  if (ch === 4 || ch === 5) {
    const i = ch - 4, s = { 0x47: 0, 0x48: 1, 0x49: 2 }[n], ss = { 0x63: 0, 0x64: 1, 0x65: 2 }[n];
    if (s !== undefined) { m.btn(i, 'fx' + s, on); return 'FX ' + (s + 1) + ' ' + AB(i); }
    if (ss !== undefined) { m.btn(i, 'fx' + ss + 's', on); return 'FX ' + (ss + 1) + ' change effect ' + AB(i); }
    return null;
  }
  if (ch === 6) {
    if (n >= 0x46 && n <= 0x49) { m.btn((n - 0x46) & 1, 'load', on); return 'LOAD ' + AB((n - 0x46) & 1); }
    if (n === 0x41 || n === 0x42) { if (on) m.browsePush(); return 'browse push'; }
    if (n === 0x5B || n === 0x78) { if (on) m.masterCue(); return 'master cue'; }
    return null;
  }
  if (ch >= 7 && ch <= 10) {
    const i = (ch - 7) & 1, mode = PAD_GROUP[n & 0x70], idx = n & 7, sh = !!(n & 8);
    m.pad(i, mode, idx, sh, on); return 'pad ' + (idx + 1) + ' ' + mode + (sh ? ' (shift)' : '') + ' ' + AB(i) + (on ? ' down' : ' up');
  }
  return null;
}
function hiRes(ch, base, n, v) { const k = ch * 128 + base, e = v14[k] || (v14[k] = { h: 0, l: 0 }); if (n === base) e.h = v; else e.l = v; return ((e.h << 7) | e.l) / 16383; }
const DECK_CC = { 0x00: 'tempo', 0x05: 'tempo', 0x13: 'fader', 0x04: 'trim', 0x07: 'hi', 0x0B: 'mid', 0x0F: 'low' };
const MIX_CC = { 0x17: 'filt0', 0x18: 'filt1', 0x19: 'filt0', 0x1A: 'filt1', 0x1F: 'xf', 0x08: 'master', 0x0D: 'phones' };
function cc(ch, n, v) {
  const m = M(), rel = v - 0x40;
  if (ch <= 3) {
    const i = deckOf(ch);
    if (n === 0x22) { m.jog(i, 'top', rel); return 'jog top ' + AB(i) + ' ' + rel; }
    if (n === 0x23 || n === 0x21) { m.jog(i, 'ring', rel); return 'jog ring ' + AB(i) + ' ' + rel; }
    if (n === 0x1F || n === 0x26) { m.jog(i, 'search', rel); return 'jog search ' + AB(i) + ' ' + rel; }
    const base = n >= 0x20 ? n - 0x20 : n, id = DECK_CC[base]; if (!id) return null;
    m.setC(id + i, hiRes(ch, base, n, v), 'hw'); return id + ' ' + AB(i);
  }
  if (ch === 4 || ch === 5) {
    const i = ch - 4, base = n >= 0x20 ? n - 0x20 : n;
    if (base === 0x06) { m.setC('fxlvl' + i, hiRes(ch, base, n, v), 'hw'); return 'FX level ' + AB(i); }
    if (base === 0x12) { m.setC('fxbeat' + i, hiRes(ch, base, n, v), 'hw'); return 'FX beats ' + AB(i); }
    return null;
  }
  if (ch === 6) {
    if (n === 0x40 || n === 0x64) { const s = v < 0x40 ? v : v - 0x80; m.browse(s * (n === 0x64 ? 5 : 1)); return 'browse ' + s; }
    const base = n >= 0x20 ? n - 0x20 : n, id = MIX_CC[base]; if (!id) return null;
    m.setC(id, hiRes(ch, base, n, v), 'hw'); return id;
  }
  return null;
}

/* ---------- lighting the controller ---------- */
function lights() {
  if (!out) return; const t = performance.now(); if (t - lastLed < 30) return; lastLed = t;
  const m = M(), L = m.lightState();
  for (const i of [0, 1]) {
    const st = 0x90 + i, d = m.decks[i];
    led(st, 0x0B, L['play' + i]); led(st, 0x0C, L['cue' + i]); led(st, 0x58, L['sync' + i]); led(st, 0x1A, L['kl' + i]);
    led(st, 0x17, L['vinyl' + i]); led(st, 0x40, L['slip' + i]); led(st, 0x14, L['auto' + i]); led(st, 0x54, L['pfl' + i]);
    for (const n in MODE_NOTE) led(st, +n, d.mode === MODE_NOTE[n]);
    const pst = 0x97 + i, g = GROUP_OF[d.mode];
    if (padGroup[i] !== g) { if (padGroup[i] != null) for (let p = 0; p < 8; p++) led(pst, padGroup[i] + p, false); padGroup[i] = g; }
    for (let p = 0; p < 8; p++) led(pst, g + p, L['pad' + i + p] > 0.5);
    led(0x94 + i, 0x47, L['fx' + i + '0']); led(0x94 + i, 0x48, L['fx' + i + '1']); led(0x94 + i, 0x49, L['fx' + i + '2']);
    led(0x96, 0x46 + i, L['load' + i]);
    const info = m.beatInfo(i), lv = info.level >= 0.99 ? 119 : Math.min(117, Math.floor(info.level * 117));
    if (lv !== vuSent[i]) { vuSent[i] = lv; send([0xB0 + i, 0x02, lv]); }
    if (sysex && info.bpm) { const b = Math.round(info.bpm * 100) & 0xFFFF; if (b !== lastBpm[i] && t - bpmT > 250) { lastBpm[i] = b; bpmT = t; send([0xF0, 0x00, 0x20, 0x7F, 0x11 + i, 0x00, 0x00, (b >> 12) & 15, (b >> 8) & 15, (b >> 4) & 15, b & 15, 0xF7]); } }
  }
}
function lightsOff() { for (const [k, v] of sent) if (v) send([k >> 8, k & 255, 0]); for (const i of [0, 1]) send([0xB0 + i, 0x02, 0]); sent.clear(); }

/* ---------- hooks ---------- */
const hook = () => { if (!window.MDJ) return setTimeout(hook, 50); M().onFrame = lights; autoConnect(); };
hook();
document.addEventListener('click', (e) => { const id = e.target && e.target.id; if (id === 'djconn') connect(true); if (id === 'djinit') { if (out) { hello(); toast('Setup sent to the controller'); } else toast('No controller connected'); } });
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'djmonon') { const mon = document.getElementById('djmon'); mon.hidden = !e.target.checked; if (e.target.checked) mon.textContent = inp ? 'Move something on the DDJ-SB3…' : 'Connect the controller first.'; } });
addEventListener('pagehide', lightsOff);
})();
