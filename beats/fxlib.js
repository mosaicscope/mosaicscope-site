/* mosaicBeats effect library: real-world presets. Each preset is a chain of up to 4 inserts, written in natural units (Hz, ms, dB, seconds). */
(function () {
  const L = [], ln = Math.log, cl = (x) => Math.max(0, Math.min(100, Math.round(x * 10) / 10));
  const P = (c, n, ...fx) => L.push({ c, n, fx });
  const rv = (hz, pre, mix, s) => ['reverb', cl(ln(hz / 900) / ln(20) * 100), cl(pre / 1.2), mix, cl(Math.sqrt(Math.max(0, s - 0.25) / 8.5) * 100)];
  const dl = (ms, fb, mix, hz) => ['delay', cl((ms - 40) / 7), fb, mix, cl(ln(hz / 800) / ln(20) * 100)];
  const ds = (dr, hz, mix, sh) => ['dist', dr, cl(ln(hz / 800) / ln(20) * 100), mix, { soft: 0, hard: 50, fold: 100 }[sh || 'soft']];
  const fl = (hz, res, md) => ['filter', cl(ln(hz / 80) / ln(200) * 100), res, 50, { lp: 0, bp: 30, hp: 60, nt: 90 }[md || 'lp']];
  const eq = (lo, hi, mid, hz) => ['eq', cl(50 + lo / 0.24), cl(50 + hi / 0.24), cl(50 + (mid || 0) / 0.24), cl(ln((hz || 1200) / 300) / ln(16) * 100)];
  const ch = (hz, dp, mix) => ['chorus', cl((hz - 0.2) / 4 * 100), dp, mix];
  const fg = (hz, fb, mix) => ['flanger', cl((hz - 0.05) / 2 * 100), fb, mix];
  const ph = (hz, dp, mix) => ['phaser', cl((hz - 0.1) / 3 * 100), dp, mix];
  const cp = (thr, ratio, mk) => ['comp', cl(-thr * 2), cl((ratio - 1) / 15 * 100), cl((mk - 1) / 2 * 100)];
  const cr = (bits, mix) => ['crush', cl((12 - bits) / 9 * 100), 50, mix];
  const gt = (idx, dp) => ['gate', idx * 25 + 5, dp];
  const tr = (hz, dp, sh) => ['tremolo', cl((hz - 0.5) / 14 * 100), dp, 50, { sine: 0, tri: 50, sq: 100 }[sh || 'sine']];
  const ap = (hz, dp, sh) => ['autopan', cl((hz - 0.5) / 14 * 100), dp, 50, { sine: 0, tri: 50, sq: 100 }[sh || 'sine']];
  const wh = (hz, res, mix, ct) => ['wah', cl((hz - 0.3) / 8 * 100), res, mix, cl((ct - 300) / 1500 * 100)];
  const rg = (f, mix) => ['ring', cl(ln(f / 20) / ln(100) * 100), 50, mix];
  const tp = (wow, sat, age) => ['tape', wow, sat, 100, age];
  const vn = (dust, warp, wear) => ['vinyl', dust, warp, wear];
  const bd = (lo, hi, mix, res) => ['band', cl(ln(lo / 20) / ln(100) * 100), cl(ln(hi / 800) / ln(25) * 100), mix, res];
  const wd = (w) => ['widen', w];
  const cab = bd(90, 5500, 100, 15);

  /* ---------- Spaces ---------- */
  [['Bathroom tile', 9000, 2, 30, 0.6], ['Shower stall', 8000, 0, 35, 0.45], ['Stairwell', 5000, 12, 35, 2.4], ['Kitchen', 7000, 3, 25, 0.5], ['Carpeted living room', 3000, 4, 18, 0.35], ['Bedroom closet', 2000, 0, 15, 0.25], ['Vocal booth', 2500, 0, 10, 0.25], ['Garage', 6000, 8, 30, 0.9], ['Parking structure', 6500, 18, 35, 2.4], ['Subway tunnel', 4500, 20, 40, 3.4], ['Concrete bunker', 5500, 10, 40, 1.8], ['Warehouse', 5000, 25, 35, 2.8], ['Aircraft hangar', 4500, 45, 40, 4.5], ['School gymnasium', 5500, 22, 35, 2.0], ['Indoor swimming pool', 8500, 12, 40, 2.6], ['Village church', 3500, 25, 38, 2.8], ['Small chapel', 3500, 12, 32, 1.6], ['Gothic cathedral', 2800, 45, 45, 7.0], ['Mosque courtyard', 4000, 30, 40, 3.8], ['Taj Mahal dome', 3200, 35, 45, 8.0], ['Limestone cave', 3000, 30, 45, 5.5], ['Ice cave', 9000, 30, 40, 4.0], ['Grand Canyon', 2500, 110, 35, 5.0], ['Pine forest', 2200, 15, 20, 1.3], ['Open field', 1800, 40, 10, 0.8], ['Vienna Musikverein', 3800, 22, 32, 2.0], ['Carnegie Hall', 4200, 20, 30, 1.8], ['Sydney Opera House', 4500, 25, 32, 2.2], ['Royal Albert Hall', 3600, 40, 38, 3.0], ['Boston Symphony Hall', 4000, 20, 32, 1.9], ['Live room (studio A)', 5500, 8, 22, 0.9], ['EMI Studio Two', 4200, 10, 24, 1.1], ['Sun Studio slap room', 3500, 3, 15, 0.4], ['Capitol echo chamber', 4000, 10, 35, 2.2], ['Hitsville snake pit', 4500, 5, 30, 1.0], ['Muscle Shoals tracking room', 5000, 8, 22, 0.8], ['Church basement', 2800, 10, 30, 1.6], ['Public library', 2200, 6, 18, 1.0], ['Elevator shaft', 7000, 10, 40, 1.5], ['Train station', 5000, 35, 40, 3.8], ['Airport terminal', 4500, 40, 38, 3.5], ['Football stadium', 3500, 110, 38, 4.5], ['Basketball arena', 4500, 60, 35, 3.0], ['Greek amphitheatre', 5000, 50, 25, 1.8], ['Barn', 3500, 15, 28, 1.4], ['Attic', 3000, 5, 28, 0.9], ['Wine cellar', 3000, 8, 35, 1.2], ['Lighthouse stairwell', 6000, 25, 40, 3.0], ['Dry well', 5000, 40, 50, 2.2], ['Sewer pipe', 4000, 30, 50, 2.5], ['Oil tank', 6000, 60, 50, 5.0], ['Water tower', 5500, 45, 50, 4.0], ['Grain silo', 5000, 55, 48, 4.5], ['Pyramid burial chamber', 2500, 40, 45, 6.0], ['Cargo hold', 4500, 20, 38, 2.0], ['Sauna', 2200, 2, 28, 0.4]]
    .forEach(([n, hz, pre, mix, s]) => P('Spaces', n, rv(hz, pre, mix, s)));
  [0.4, 0.8, 1.4, 2.2, 3.5].forEach((s) => [['Dark', 3500], ['Warm', 6500], ['Bright', 12000]].forEach(([t, hz]) => P('Plates, springs, halls', 'EMT plate · ' + s + ' s · ' + t, rv(hz, 0, 30, s))));
  [0.5, 0.9, 1.4, 1.9].forEach((s) => [['Surf', 9000], ['Vintage', 4500]].forEach(([t, hz]) => P('Plates, springs, halls', 'Spring tank · ' + s + ' s · ' + t, rv(hz, 0, 28, s), eq(-2, 2, 0))));
  [1.4, 2.0, 2.8, 4.0, 6.0].forEach((s) => [['Warm', 3500], ['Bright', 9000]].forEach(([t, hz]) => P('Plates, springs, halls', 'Digital hall · ' + s + ' s · ' + t, rv(hz, s * 8, 30, s))));

  /* ---------- Echoes ---------- */
  [['Space Echo', 4500, 45, 32], ['Echoplex', 3800, 40, 30], ['Binson Echorec', 5000, 50, 32], ['Copicat', 4000, 45, 30], ['Memory Man', 3000, 55, 34], ['DM-2 analog', 2500, 50, 32], ['DD-3 digital', 12000, 35, 28], ['PCM 42', 9000, 40, 30]]
    .forEach(([g, hz, fb, mix]) => [80, 150, 250, 375, 500].forEach((ms) => P('Echoes', g + ' · ' + ms + ' ms', dl(ms, fb, mix, hz))));
  P('Echoes', 'Rockabilly slapback', dl(110, 5, 35, 4000)); P('Echoes', 'Nashville slap', dl(80, 0, 30, 5000)); P('Echoes', 'Dub echo', dl(375, 70, 40, 2500), eq(-3, -2, 0));
  P('Echoes', 'Canyon shout', dl(600, 35, 30, 3500)); P('Echoes', 'Mountain yodel', dl(700, 25, 25, 3000), rv(3000, 40, 20, 2.5)); P('Echoes', 'Infinite tape loop', dl(250, 88, 45, 3000));
  P('Echoes', 'Vocal throw', dl(375, 30, 30, 5000), rv(5000, 20, 22, 2)); P('Echoes', 'Dotted-eighth edge', dl(380, 40, 35, 6000)); P('Echoes', 'Shoegaze wash', dl(440, 60, 40, 4000), rv(4000, 30, 40, 5), ch(0.4, 60, 40));
  P('Echoes', 'Drum-room echo', dl(60, 20, 25, 5000)); P('Echoes', 'Spring slap', dl(90, 8, 30, 4500), rv(7000, 0, 25, 1.2)); P('Echoes', 'Haunted hallway', dl(520, 55, 40, 2500), rv(2500, 30, 35, 4));

  /* ---------- Amps & pedals ---------- */
  P('Amps & pedals', 'Tube Screamer', ds(55, 3500, 100), eq(-2, -1, 5, 720)); P('Amps & pedals', 'Klon-style transparent boost', ds(30, 6000, 70), eq(0, 2, 2, 1500));
  P('Amps & pedals', 'Rangemaster treble boost', ds(40, 7000, 100), eq(-9, 4, 2, 2500)); P('Amps & pedals', 'Fuzz Face (germanium)', ds(85, 3000, 100), eq(-3, -2, 2, 900));
  P('Amps & pedals', 'Fuzz Face (silicon)', ds(90, 6000, 100, 'hard')); P('Amps & pedals', 'Tone Bender', ds(95, 4500, 100, 'hard'), eq(-4, 0, 3, 1500));
  P('Amps & pedals', 'Big Muff sustain', ds(100, 4000, 100), eq(2, -3, -6, 1000)); P('Amps & pedals', 'RAT distortion', ds(80, 5000, 100, 'hard'));
  P('Amps & pedals', 'Boss DS-1', ds(75, 7000, 100, 'hard')); P('Amps & pedals', 'Boss SD-1 overdrive', ds(45, 5000, 100)); P('Amps & pedals', 'Chainsaw HM-2', ds(100, 6500, 100, 'hard'), eq(5, 3, -2, 800), cab);
  P('Amps & pedals', 'Plexi crunch', ds(60, 5000, 100), cab); P('Amps & pedals', 'JCM800 lead', ds(80, 5500, 100, 'hard'), cab); P('Amps & pedals', 'Twin Reverb clean push', ds(25, 7000, 100), eq(-1, 2, 0));
  P('Amps & pedals', 'Tweed Deluxe breakup', ds(45, 4500, 100), cab); P('Amps & pedals', 'AC30 chime', ds(40, 8000, 100), eq(-2, 4, 2, 2500)); P('Amps & pedals', 'Orange crunch', ds(65, 4500, 100), cab);
  P('Amps & pedals', 'Rectifier high gain', ds(90, 6000, 100, 'hard'), eq(4, 2, -5, 700), cab); P('Amps & pedals', 'Dumble-style smooth lead', ds(55, 5000, 100), eq(0, 0, 3, 1000));
  P('Amps & pedals', 'SVT bass stack', ds(35, 3500, 100), eq(5, -2, -2, 500)); P('Amps & pedals', 'Hiwatt clean', ds(15, 8000, 100)); P('Amps & pedals', 'Champ cranked', ds(70, 4000, 100), cab);
  P('Amps & pedals', 'Octave fuzz', ds(90, 5000, 100, 'fold')); P('Amps & pedals', 'Cranked radio', ds(85, 2500, 100, 'hard'), bd(300, 3500, 100, 10)); P('Amps & pedals', 'Telephone saturation', ds(60, 3000, 100, 'hard'), bd(350, 3400, 100, 20));
  P('Amps & pedals', 'Cab · 4x12 closed', bd(75, 5200, 100, 20)); P('Amps & pedals', 'Cab · 1x12 open back', bd(110, 6000, 100, 10)); P('Amps & pedals', 'Cab · 8x10 bass', bd(40, 4500, 100, 15));
  P('Amps & pedals', 'Tube preamp warmth', ds(15, 9000, 40), eq(2, -1, 0)); P('Amps & pedals', 'Transformer saturation', ds(25, 8000, 35)); P('Amps & pedals', 'Tape saturation', ds(30, 7000, 50), eq(0, -3, 0));
  P('Amps & pedals', 'Console overload', ds(35, 10000, 45)); P('Amps & pedals', 'Diode clipper', ds(70, 6000, 100, 'hard')); P('Amps & pedals', 'West Coast wavefolder', ds(60, 12000, 100, 'fold'));
  P('Amps & pedals', 'Serge-style fold', ds(85, 9000, 100, 'fold')); P('Amps & pedals', 'Buchla-style fold', ds(40, 14000, 60, 'fold'));
  P('Amps & pedals', 'NES 4-bit', cr(4, 100)); P('Amps & pedals', 'Game Boy', cr(5, 100), bd(80, 6000, 100, 8)); P('Amps & pedals', 'Atari 2600', cr(3, 100), ds(40, 8000, 40, 'hard'));
  P('Amps & pedals', 'Amiga 8-bit', cr(8, 100)); P('Amps & pedals', 'SP-1200 grit', cr(8, 100), bd(40, 7500, 100, 5)); P('Amps & pedals', 'MPC60 punch', cr(10, 100), ds(15, 9000, 40));
  P('Amps & pedals', 'S950 12-bit', cr(9, 100), fl(9000, 10)); P('Amps & pedals', 'Speak & Spell', cr(5, 100), bd(250, 4000, 100, 15)); P('Amps & pedals', 'Talking toy', cr(4, 100), bd(400, 3500, 100, 20));

  /* ---------- Modulation ---------- */
  P('Modulation', 'CE-1 chorus', ch(0.8, 35, 50)); P('Modulation', 'Juno-60 chorus I', ch(0.5, 30, 50)); P('Modulation', 'Juno-60 chorus II', ch(0.8, 35, 50)); P('Modulation', 'Juno-60 chorus I+II', ch(1.0, 55, 55));
  P('Modulation', 'Small Clone shimmer', ch(0.5, 70, 50)); P('Modulation', 'Dimension-style widener', ch(0.35, 20, 40), wd(40)); P('Modulation', 'String ensemble', ch(0.6, 50, 60), ch(5.5, 10, 30));
  P('Modulation', 'Vibrato box', ch(5, 60, 100)); P('Modulation', 'Rotary · slow chorale', tr(1.2, 25), ch(0.8, 30, 50)); P('Modulation', 'Rotary · fast tremolo', tr(6.5, 35), ch(6.5, 45, 50));
  P('Modulation', 'Doubler', ch(0.3, 5, 50)); P('Modulation', 'Double-tracking', ch(0.4, 15, 60)); P('Modulation', 'Electric Mistress flange', fg(0.3, 60, 50)); P('Modulation', 'A/DA flange', fg(0.5, 75, 55));
  P('Modulation', 'MXR flange', fg(0.4, 50, 50)); P('Modulation', 'Jet plane', fg(0.12, 80, 60)); P('Modulation', 'Tape flanging', fg(0.08, 70, 55), tp(30, 20, 20));
  P('Modulation', 'Phase 90', ph(0.5, 50, 50)); P('Modulation', 'Phase 45', ph(0.4, 35, 45)); P('Modulation', 'Phase 100', ph(0.9, 80, 60)); P('Modulation', 'Small Stone', ph(0.25, 65, 50));
  P('Modulation', 'Uni-Vibe throb', ph(1.8, 70, 60), tr(1.8, 25)); P('Modulation', 'Slow swirl', ph(0.12, 90, 60));
  P('Modulation', 'Vibrolux tremolo', tr(5, 60)); P('Modulation', 'Opto tremolo', tr(4, 55)); P('Modulation', 'Bias tremolo', tr(6, 45, 'tri')); P('Modulation', 'Wurlitzer vibrato', tr(6.5, 35));
  P('Modulation', 'Rhodes stereo vibrato', ap(4.5, 50)); P('Modulation', 'Surf auto-pan', ap(3, 100)); P('Modulation', 'Stereo tremolo', ap(5, 70, 'tri')); P('Modulation', 'Rotary pan', ap(0.8, 80)); P('Modulation', 'Square chop', tr(8, 100, 'sq'));
  P('Modulation', 'Cry Baby sweep', wh(1.5, 70, 100, 900)); P('Modulation', 'Vox wah', wh(2, 60, 100, 1100)); P('Modulation', 'Mu-Tron III funk', wh(0.6, 80, 100, 700)); P('Modulation', 'Auto-wah funk', wh(3, 65, 100, 800), cp(-18, 4, 1.3));
  P('Modulation', 'Talking wah', wh(2.5, 90, 100, 1400)); P('Modulation', 'Slow wah wash', wh(0.3, 60, 70, 600)); P('Modulation', 'Clavinet wah', wh(4, 55, 100, 1000));
  P('Modulation', 'Dalek', rg(30, 100)); P('Modulation', 'Moog ring mod', rg(220, 60)); P('Modulation', 'Bell tones', rg(800, 50)); P('Modulation', 'Radio alien', rg(1500, 70), bd(300, 5000, 100, 15));
  P('Modulation', 'Metallic clang', rg(440, 100)); P('Modulation', '50 Hz mains hum tremolo', rg(50, 80));
  [2, 4, 6, 8].forEach((r) => [['Sine', 'sine'], ['Triangle', 'tri'], ['Square', 'sq']].forEach(([n, sh]) => P('Modulation', 'Tremolo ' + r + ' Hz · ' + n, tr(r, 65, sh))));
  [0.2, 0.5, 1.0].forEach((r) => [30, 60, 90].forEach((d) => P('Modulation', 'Phaser ' + r + ' Hz · ' + d + '% deep', ph(r, d, 55))));
  [0.3, 0.8, 2].forEach((r) => [20, 50, 80].forEach((d) => P('Modulation', 'Chorus ' + r + ' Hz · ' + d + '% deep', ch(r, d, 50))));
  [0.1, 0.3, 0.8].forEach((r) => [30, 60, 85].forEach((f) => P('Modulation', 'Flanger ' + r + ' Hz · ' + f + '% feedback', fg(r, f, 55))));

  /* ---------- Tape & vinyl ---------- */
  P('Tape & vinyl', 'Cassette type I', tp(40, 35, 60), eq(1, -2, 0)); P('Tape & vinyl', 'Cassette type II chrome', tp(30, 30, 35)); P('Tape & vinyl', 'Metal tape type IV', tp(20, 40, 20));
  P('Tape & vinyl', 'Walkman mushy', tp(60, 40, 75), bd(100, 8000, 100, 5)); P('Tape & vinyl', 'Boombox', tp(50, 50, 65), eq(5, -2, 0)); P('Tape & vinyl', 'Worn cassette', tp(80, 50, 85));
  P('Tape & vinyl', 'Chewed tape', tp(100, 60, 90), ch(0.3, 60, 40)); P('Tape & vinyl', 'Dictaphone', tp(70, 50, 70), bd(300, 3500, 100, 15)); P('Tape & vinyl', 'VHS audio', tp(60, 30, 70), ch(0.3, 15, 30));
  P('Tape & vinyl', 'Wire recorder 1940s', tp(80, 70, 90), bd(250, 4000, 100, 20)); P('Tape & vinyl', 'Edison cylinder', vn(70, 60, 95), bd(200, 3000, 100, 25), ds(20, 3000, 30));
  P('Tape & vinyl', 'Lacquer acetate', vn(50, 30, 85), tp(40, 30, 80)); P('Tape & vinyl', 'Jukebox 45', vn(35, 20, 50), bd(80, 9000, 100, 8), ds(15, 8000, 25)); P('Tape & vinyl', 'Gramophone horn', vn(60, 45, 90), bd(250, 3500, 100, 30), rv(2500, 0, 20, 0.4));
  P('Tape & vinyl', 'Thrift-store LP', vn(60, 25, 55), tp(20, 25, 50)); P('Tape & vinyl', 'Dusty crate sample', vn(45, 15, 45), cr(10, 40), eq(3, -3, 0)); P('Tape & vinyl', 'Radio-drama reel', tp(55, 40, 75), bd(200, 6000, 100, 12), rv(3000, 0, 12, 0.5));
  [['Studer A80', 10, 30], ['Ampex 351', 20, 45], ['Revox B77', 15, 30], ['Portastudio 4-track', 50, 45], ['Nagra field recorder', 25, 35], ['Cassette deck', 55, 40]]
    .forEach(([m, w, s]) => [['fresh', 15], ['aged', 50], ['worn', 85]].forEach(([a, age]) => P('Tape & vinyl', m + ' · ' + a, tp(w, s, age))));
  [['33⅓ LP', 1, []], ['45 single', 1.3, []], ['78 shellac', 2, [bd(150, 5000, 100, 15)]]].forEach(([f, k, x]) => [['mint', 10, 8, 10], ['played', 30, 18, 30], ['worn', 60, 30, 60], ['trashed', 90, 40, 90]]
    .forEach(([c, du, wa, we]) => P('Tape & vinyl', f + ' · ' + c, vn(Math.min(100, du * k), wa, we), ...x)));

  /* ---------- Everyday sounds ---------- */
  P('Everyday sounds', 'Landline telephone', bd(300, 3400, 100, 15)); P('Everyday sounds', 'Cell phone call', bd(350, 3200, 100, 10), cr(8, 100)); P('Everyday sounds', 'VoIP glitch', bd(300, 3600, 100, 8), cr(6, 60));
  P('Everyday sounds', 'Payphone', bd(400, 2800, 100, 20), ds(30, 3000, 60, 'hard')); P('Everyday sounds', 'Intercom buzzer', bd(500, 3000, 100, 25), ds(50, 2500, 70, 'hard')); P('Everyday sounds', 'Megaphone', bd(500, 4000, 100, 25), ds(55, 3500, 70, 'hard'));
  P('Everyday sounds', 'Walkie-talkie', bd(400, 3000, 100, 20), cr(7, 70), ds(40, 3000, 60, 'hard')); P('Everyday sounds', 'CB radio', bd(350, 2800, 100, 25), ds(50, 3000, 60, 'hard')); P('Everyday sounds', 'AM radio', bd(120, 4500, 100, 8));
  P('Everyday sounds', 'FM radio', bd(60, 12000, 100, 0), cp(-18, 4, 1.3)); P('Everyday sounds', 'Shortwave', bd(300, 3000, 100, 15), ph(0.15, 80, 40)); P('Everyday sounds', 'Police scanner', bd(400, 3000, 100, 18), cr(8, 60));
  P('Everyday sounds', 'Drive-thru speaker', bd(450, 2800, 100, 20), ds(50, 2800, 70, 'hard')); P('Everyday sounds', 'Airport PA', bd(300, 5000, 100, 10), rv(4500, 30, 40, 3.2)); P('Everyday sounds', 'Stadium PA', bd(250, 6000, 100, 8), dl(250, 30, 30, 3500), rv(3500, 90, 30, 4));
  P('Everyday sounds', 'School hallway PA', bd(300, 5500, 100, 10), rv(5000, 20, 35, 2)); P('Everyday sounds', 'Elevator speaker', bd(350, 4500, 100, 8), rv(6000, 5, 35, 0.8)); P('Everyday sounds', 'Car stereo from outside', fl(260, 40), eq(8, -6, 0));
  P('Everyday sounds', 'Inside a car', eq(6, -3, 0), rv(3000, 2, 15, 0.3)); P('Everyday sounds', 'Headphone leak', bd(1500, 9000, 100, 5)); P('Everyday sounds', 'Cheap earbuds', bd(200, 9000, 100, 15), eq(-4, 3, 2, 2500));
  P('Everyday sounds', 'Laptop speaker', bd(350, 8000, 100, 12)); P('Everyday sounds', 'Phone speaker', bd(500, 7000, 100, 15)); P('Everyday sounds', 'Smart speaker', bd(80, 10000, 100, 5), eq(3, 0, 0));
  P('Everyday sounds', 'Old TV speaker', bd(200, 5000, 100, 10), ds(20, 5000, 40)); P('Everyday sounds', 'Transistor radio', bd(250, 4000, 100, 15), ds(35, 4000, 50)); P('Everyday sounds', 'Next-door neighbours', fl(220, 30), rv(1500, 0, 20, 0.4));
  P('Everyday sounds', 'Club from the bathroom', fl(500, 20), rv(5000, 10, 35, 1.0)); P('Everyday sounds', 'Under a blanket', fl(350, 10)); P('Everyday sounds', 'Underwater', fl(450, 40), ch(0.3, 60, 50), rv(2000, 10, 35, 1.5));
  P('Everyday sounds', 'Head under the pool', fl(600, 30), ch(0.5, 50, 40)); P('Everyday sounds', 'Tin can', bd(600, 3000, 100, 30)); P('Everyday sounds', 'Cardboard tube', bd(300, 2500, 100, 20)); P('Everyday sounds', 'Paper cup phone', bd(500, 2500, 100, 25));
  P('Everyday sounds', 'Inside a bucket', bd(250, 2500, 100, 30), rv(4000, 0, 40, 0.3)); P('Everyday sounds', 'Metal trash can', bd(300, 4500, 100, 35), rv(6000, 0, 45, 0.5)); P('Everyday sounds', 'Under a piano lid', rv(3000, 0, 40, 0.7), bd(60, 6000, 100, 10));
  P('Everyday sounds', 'Behind a door', fl(900, 20)); P('Everyday sounds', 'Through a keyhole', bd(600, 3000, 100, 40)); P('Everyday sounds', 'Through the wall', fl(180, 50)); P('Everyday sounds', 'Concert from the car park', fl(300, 25), rv(3000, 60, 40, 3));
  P('Everyday sounds', 'Shop ceiling speaker', bd(200, 6000, 100, 8), rv(5000, 10, 25, 1)); P('Everyday sounds', 'Tannoy station', bd(350, 4000, 100, 15), rv(5000, 40, 40, 3));

  /* ---------- Studio gear ---------- */
  P('Studio gear', '1073 console warmth', eq(4, 3, 1.5, 3000), ds(10, 10000, 30)); P('Studio gear', 'SSL 4000 E punch', eq(2, 3, 2, 4000), cp(-14, 4, 1.4)); P('Studio gear', 'API 550 presence', eq(3, 2, 3, 3500));
  P('Studio gear', 'Pultec low trick', eq(6, 4, -2, 300)); P('Studio gear', 'Pultec air', eq(0, 8, 0)); P('Studio gear', 'Fairchild 670', cp(-18, 3, 1.3), ds(8, 9000, 30)); P('Studio gear', 'LA-2A leveler', cp(-20, 3, 1.4));
  P('Studio gear', '1176 fast', cp(-22, 4, 1.3)); P('Studio gear', '1176 all buttons', cp(-34, 15, 1.7)); P('Studio gear', 'dbx 160', cp(-18, 4, 1.3)); P('Studio gear', 'Distressor', cp(-20, 6, 1.3), ds(10, 12000, 25));
  P('Studio gear', 'SSL bus glue', cp(-12, 2, 1.15)); P('Studio gear', 'Vari-Mu mastering', cp(-14, 2, 1.2), ds(6, 12000, 20)); P('Studio gear', '1178 stereo squash', cp(-26, 8, 1.5)); P('Studio gear', 'Opto vocal leveler', cp(-24, 3, 1.4));
  P('Studio gear', 'New York parallel', cp(-35, 12, 1.8)); P('Studio gear', 'Brickwall limiter', cp(-8, 16, 1.3)); P('Studio gear', 'Tape glue', tp(15, 25, 25), cp(-12, 2, 1.1));
  P('Studio gear', 'De-mud 300 Hz', eq(0, 0, -5, 300)); P('Studio gear', 'Boxy cut 500 Hz', eq(0, 0, -4, 500)); P('Studio gear', 'Honk cut 800 Hz', eq(0, 0, -4, 800)); P('Studio gear', 'Nasal cut 1 kHz', eq(0, 0, -4, 1000));
  P('Studio gear', 'Presence 3 kHz', eq(0, 0, 4, 3000)); P('Studio gear', 'Presence 4.5 kHz', eq(0, 0, 4, 4500)); P('Studio gear', 'Air +3 dB', eq(0, 3, 0)); P('Studio gear', 'Air +6 dB', eq(0, 6, 0)); P('Studio gear', 'Silk top', eq(0, 4, 1, 4000));
  P('Studio gear', 'Warmth +3 dB', eq(3, 0, 0)); P('Studio gear', 'Bass boost +6 dB', eq(6, 0, 0)); P('Studio gear', 'Rumble filter', bd(80, 20000, 100, 0)); P('Studio gear', 'Dark top (high cut)', bd(20, 6000, 100, 0));
  P('Studio gear', 'Smile curve', eq(5, 5, -3, 800)); P('Studio gear', 'Loudness contour', eq(6, 6, -2, 1000)); P('Studio gear', 'Mid scoop', eq(1, 1, -6, 700)); P('Studio gear', 'Vocal forward', eq(-2, 3, 4, 3000));
  [2, 4, 8].forEach((r) => [-12, -20, -30].forEach((t) => P('Studio gear', 'Compressor ' + r + ':1 @ ' + t + ' dB', cp(t, r, 1 + (-t) / 40))));
  [500, 800, 1200, 2000, 3000, 4500].forEach((f) => [['cut', -4], ['boost', 4]].forEach(([n, g]) => P('Studio gear', 'Mid ' + n + ' ' + (f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'), eq(0, 0, g, f))));

  /* ---------- Vocals & mics ---------- */
  P('Vocals', 'Radio DJ', eq(4, 2, 2, 2500), cp(-24, 5, 1.5)); P('Vocals', 'Podcast host', eq(3, 2, 1, 3000), cp(-22, 4, 1.4), bd(70, 20000, 100, 0)); P('Vocals', 'Whisper ASMR', eq(0, 6, 0), cp(-35, 6, 1.9));
  P('Vocals', 'Ribbon mic velvet', eq(3, -5, 0), ds(8, 8000, 25)); P('Vocals', 'Condenser sheen', eq(-1, 6, 2, 4000)); P('Vocals', 'Dynamic mic broadcast', eq(4, 0, 2, 3500), cp(-20, 4, 1.3));
  P('Vocals', 'Pop vocal polish', eq(-2, 4, 2, 3000), cp(-22, 3, 1.3), rv(6000, 25, 14, 1.4)); P('Vocals', 'Dry rap vocal', eq(-2, 3, 3, 3500), cp(-24, 5, 1.4)); P('Vocals', 'R&B vocal wet', cp(-22, 3, 1.3), rv(5000, 30, 32, 2.4), dl(375, 25, 22, 5000));
  P('Vocals', 'Choir stack', ch(0.4, 50, 50), rv(3500, 30, 40, 4)); P('Vocals', 'Backing vocal wash', ch(0.3, 60, 50), rv(4000, 20, 45, 3), eq(-4, 0, 0));
  P('Vocals', 'Trap vocal', eq(-2, 5, 2, 4000), ds(10, 12000, 20), dl(250, 30, 25, 6000), rv(8000, 20, 15, 1.2)); P('Vocals', 'Auto-tune sheen', ch(1.5, 10, 25), eq(0, 5, 0)); P('Vocals', 'Telephone voice', bd(400, 3200, 100, 15));
  P('Vocals', 'Old-time radio crooner', bd(150, 5000, 100, 15), tp(40, 30, 60), rv(3000, 5, 15, 0.8)); P('Vocals', 'Megaphone rant', bd(500, 4000, 100, 25), ds(55, 3500, 70, 'hard')); P('Vocals', 'Robot', rg(60, 100), ch(5, 20, 30));
  P('Vocals', 'Helium-ish chipmunk shimmer', eq(-6, 6, 2, 4500), ch(6, 15, 30)); P('Vocals', 'Demon', eq(8, -6, 0), ds(40, 2500, 60, 'hard'), rv(2500, 20, 40, 3)); P('Vocals', 'Ghost', fl(2500, 20), ch(0.3, 60, 60), rv(4000, 40, 55, 6));
  P('Vocals', 'Whisper in a cathedral', eq(0, 5, 0), rv(3000, 45, 50, 7)); P('Vocals', 'Lo-fi bedroom mic', bd(120, 7000, 100, 10), cr(10, 40), tp(40, 30, 55)); P('Vocals', 'Shower singer', rv(9000, 2, 40, 0.6), eq(1, 2, 0));
  P('Vocals', 'Stadium announcer', bd(250, 6000, 100, 8), rv(3500, 90, 32, 4), dl(300, 25, 22, 3500)); P('Vocals', 'Gospel choir hall', ch(0.4, 40, 45), rv(3800, 30, 38, 3.4)); P('Vocals', 'Vintage jazz crooner', eq(3, -3, 0), tp(25, 25, 45), rv(3500, 10, 20, 1.2));
  P('Vocals', 'Shoegaze vocal haze', ch(0.4, 70, 50), rv(3500, 30, 50, 6), dl(440, 50, 35, 3000)); P('Vocals', 'Dub vocal', dl(375, 65, 40, 2500), rv(3500, 20, 25, 2.5)); P('Vocals', 'Vocal doubler', ch(0.3, 8, 60), wd(35));

  /* ---------- Instruments ---------- */
  P('Instruments', 'Kick punch', eq(5, 2, -3, 400), cp(-18, 4, 1.3)); P('Instruments', 'Kick sub weight', eq(8, -4, 0), ds(15, 2000, 30)); P('Instruments', '808 saturation', ds(30, 2500, 60), eq(3, -4, 0));
  P('Instruments', 'Snare crack', eq(0, 4, 4, 2500), cp(-20, 5, 1.3)); P('Instruments', 'Snare room', rv(5500, 5, 25, 0.7)); P('Instruments', 'Gated-style snare', rv(6000, 0, 45, 0.9), cp(-25, 12, 1.6)); P('Instruments', 'Hi-hat sizzle', eq(-6, 5, 0), ds(15, 12000, 25));
  P('Instruments', 'Drum bus glue', cp(-14, 3, 1.2), ds(8, 10000, 25)); P('Instruments', 'Drum crush parallel', cp(-40, 16, 2), ds(40, 8000, 60)); P('Instruments', 'Drum room mics', rv(5000, 6, 30, 0.8), cp(-28, 8, 1.6));
  P('Instruments', 'Bass DI', eq(3, -2, -2, 500), cp(-18, 4, 1.3)); P('Instruments', 'Slap bass pop', eq(3, 4, 3, 2500), cp(-20, 5, 1.3)); P('Instruments', 'Upright bass wood', eq(4, -4, 2, 600), rv(3000, 3, 12, 0.5));
  P('Instruments', 'Acoustic guitar sparkle', eq(-2, 4, 1, 3500), ch(0.4, 15, 25)); P('Instruments', 'Nylon guitar room', rv(3500, 5, 20, 1.0), eq(1, -2, 0)); P('Instruments', 'Rhodes suitcase', ap(4.5, 55), ch(0.6, 20, 30), ds(10, 8000, 20));
  P('Instruments', 'Clavinet funk', wh(3, 50, 70, 1000), eq(-2, 3, 2, 3000)); P('Instruments', 'Honky-tonk piano', ch(0.9, 35, 70), bd(100, 8000, 100, 12)); P('Instruments', 'Grand piano in a hall', rv(4000, 20, 25, 2.4));
  P('Instruments', 'Shimmer pad', ch(0.3, 60, 55), rv(8000, 30, 45, 5), wd(70)); P('Instruments', 'Synth lead delay', ds(15, 8000, 30), dl(375, 35, 30, 5000)); P('Instruments', 'String section', ch(0.5, 45, 50), rv(4500, 20, 30, 2.6));
  P('Instruments', 'Brass stab', ds(12, 9000, 30), rv(5000, 8, 18, 1.2), eq(-2, 2, 2, 2000)); P('Instruments', 'Hammond rotary', tr(6.5, 35), ch(6.5, 40, 50), ds(20, 6000, 35)); P('Instruments', 'Harp shimmer', rv(7000, 15, 35, 3), ch(0.4, 30, 30));
  P('Instruments', 'Bell sparkle', rg(800, 40), rv(8000, 10, 30, 3)); P('Instruments', 'Marimba wood', eq(2, -2, 2, 1500), rv(3500, 5, 20, 1.2)); P('Instruments', 'Flute breath', eq(-3, 4, 0), rv(5000, 15, 28, 2));
  P('Instruments', 'Kalimba music box', rv(8000, 10, 30, 2), eq(-4, 5, 0), ch(0.3, 15, 25)); P('Instruments', 'Steel drum', ch(5, 15, 30), rv(6000, 5, 22, 1.4)); P('Instruments', 'Sitar drone', ph(0.2, 40, 30), rv(4000, 10, 30, 3), eq(0, 3, 2, 3000));
  P('Instruments', 'Banjo twang', eq(-4, 4, 3, 3500), bd(150, 7000, 100, 15)); P('Instruments', 'Accordion bellows', tr(5.5, 25), ch(0.8, 45, 55), bd(150, 6000, 100, 8)); P('Instruments', 'Church organ', rv(2800, 40, 45, 6), eq(3, -2, 0));

  /* ---------- Sci-fi & nature ---------- */
  P('Sci-fi & nature', 'Spaceship corridor', rv(5000, 10, 40, 2.4), fg(0.15, 55, 35)); P('Sci-fi & nature', 'Alien transmission', rg(1500, 60), ph(0.3, 80, 50), rv(4000, 20, 30, 3)); P('Sci-fi & nature', 'Cyborg', rg(80, 80), ch(5, 20, 30), bd(200, 6000, 100, 15));
  P('Sci-fi & nature', 'Black hole', fl(200, 60), rv(1500, 40, 60, 8), ch(0.2, 80, 50)); P('Sci-fi & nature', 'Warp drive', fg(0.1, 85, 70), fl(3000, 50)); P('Sci-fi & nature', 'Hologram', ch(1.5, 30, 50), dl(150, 40, 30, 8000), wd(80));
  P('Sci-fi & nature', 'Deep space', rv(2500, 60, 60, 8.5), fl(1800, 30)); P('Sci-fi & nature', 'Haunted attic', rv(3000, 5, 40, 2), ph(0.1, 80, 30), fl(2500, 20)); P('Sci-fi & nature', 'Possessed', ds(40, 3000, 50, 'hard'), ph(0.3, 90, 50), rv(3000, 20, 35, 3));
  P('Sci-fi & nature', 'Dungeon', rv(2500, 30, 45, 3.5), fl(3000, 15), dl(400, 30, 20, 2500)); P('Sci-fi & nature', 'Rainforest', rv(3500, 15, 28, 1.8), ch(0.4, 30, 25)); P('Sci-fi & nature', 'Thunderstorm', fl(500, 20), rv(2500, 40, 50, 5));
  P('Sci-fi & nature', 'Wind tunnel', ph(0.4, 90, 70), fl(2500, 40)); P('Sci-fi & nature', 'Ocean cave', rv(3000, 25, 45, 4), fl(1800, 30), ch(0.2, 50, 30)); P('Sci-fi & nature', 'Under the ice', fl(700, 35), rv(6000, 10, 45, 3), ch(0.3, 40, 40));
  P('Sci-fi & nature', 'Volcano', fl(250, 40), ds(50, 2000, 50, 'hard'), rv(2000, 10, 35, 2)); P('Sci-fi & nature', 'Desert wind', bd(300, 5000, 100, 10), ph(0.15, 70, 40)); P('Sci-fi & nature', 'Aurora', ch(0.25, 80, 55), rv(9000, 30, 50, 6), wd(100));
  P('Sci-fi & nature', 'Radio telescope', bd(500, 5000, 100, 20), rg(60, 30), rv(4000, 30, 30, 3)); P('Sci-fi & nature', 'Reactor hum', rg(50, 90), fl(400, 30), rv(3000, 5, 30, 1.5)); P('Sci-fi & nature', 'Time stretch', dl(700, 70, 50, 2500), ch(0.2, 90, 50), rv(4000, 30, 40, 5));
  P('Sci-fi & nature', 'Dream sequence', ch(0.3, 70, 55), rv(6000, 30, 50, 5), dl(500, 45, 35, 3500)); P('Sci-fi & nature', 'Memory flashback', fl(2000, 20), rv(5000, 20, 40, 3), tp(60, 30, 70)); P('Sci-fi & nature', 'Nightmare', ds(35, 2500, 40, 'fold'), rv(2500, 50, 55, 6), ph(0.12, 90, 50));
  P('Sci-fi & nature', 'Cathedral of glass', rv(11000, 40, 45, 6), ch(0.3, 40, 30)); P('Sci-fi & nature', 'Moon base radio', bd(300, 3500, 100, 20), cr(8, 50), rv(5000, 10, 25, 1.4)); P('Sci-fi & nature', 'Jungle night', rv(3000, 20, 30, 2.4), ph(0.2, 40, 30));

  /* ---------- Genres ---------- */
  P('Genres', 'Lo-fi hip hop', tp(40, 35, 60), vn(30, 15, 30), cr(10, 40), eq(2, -3, 0)); P('Genres', 'Boom bap', cr(9, 100), ds(15, 7000, 35), cp(-18, 4, 1.3)); P('Genres', 'Dark trap', ds(20, 3000, 40), rv(3500, 30, 35, 3), dl(250, 35, 25, 3000));
  P('Genres', 'Drill slide', ds(30, 4000, 50), eq(6, 0, -2, 500), rv(5000, 10, 18, 1)); P('Genres', 'Phonk cowbell', ds(55, 4000, 70, 'hard'), rv(4000, 8, 30, 1.2), cr(9, 40)); P('Genres', 'Vaporwave', tp(60, 30, 70), ch(0.3, 60, 55), rv(4000, 25, 45, 4));
  P('Genres', 'Shoegaze wall', ds(55, 5000, 80), ch(0.4, 70, 55), rv(4000, 30, 50, 6), dl(440, 45, 30, 3500)); P('Genres', 'Dub reggae', dl(375, 65, 40, 2500), rv(3500, 15, 25, 2.2), eq(4, -3, 0)); P('Genres', 'Synthwave', ch(0.5, 55, 55), rv(8000, 20, 30, 2.4), dl(375, 30, 25, 6000));
  P('Genres', 'Chillwave haze', tp(50, 30, 65), ch(0.3, 60, 55), rv(5000, 30, 40, 4)); P('Genres', 'Hyperpop crunch', ds(80, 12000, 80, 'fold'), cr(8, 40), eq(0, 8, 0), cp(-20, 8, 1.5)); P('Genres', 'Surf rock', rv(8000, 0, 35, 1.8), tr(5, 60), ds(25, 7000, 80));
  P('Genres', 'Psychedelic rock', ph(0.3, 80, 55), rv(4000, 20, 30, 2.6), ds(40, 5000, 70)); P('Genres', 'Motown', tp(15, 30, 35), rv(4500, 5, 28, 1.0), cp(-18, 3, 1.3)); P('Genres', 'Disco', ph(0.6, 40, 40), cp(-20, 4, 1.3), eq(1, 4, 0));
  P('Genres', 'Reggae skank', tr(5, 55, 'tri'), rv(4000, 5, 22, 1.4)); P('Genres', 'Bossa nova', rv(4000, 8, 18, 1.0), eq(1, -2, 0)); P('Genres', 'Jazz club', rv(3500, 6, 20, 1.4), tp(20, 25, 40), eq(2, -2, 0));
  P('Genres', 'Garage rock', ds(60, 5000, 90), tp(30, 40, 55)); P('Genres', 'Grunge', ds(85, 4500, 100), eq(4, 1, -4, 800)); P('Genres', 'Emo chorus', ch(0.6, 35, 50), ds(40, 6000, 60), rv(4500, 15, 22, 1.8));
  P('Genres', 'EDM pump', gt(1, 70), rv(7000, 20, 25, 2), cp(-24, 8, 1.4)); P('Genres', 'Drum and bass', ds(20, 9000, 40), cp(-22, 6, 1.4), rv(6000, 10, 18, 1.2)); P('Genres', 'House filter sweep', fl(900, 55), ph(0.15, 50, 35));
  P('Genres', 'Techno rumble', ds(35, 3000, 60), rv(2500, 15, 50, 2.5), fl(300, 30)); P('Genres', 'Trance gate', gt(2, 80), rv(8000, 15, 30, 3), dl(375, 40, 25, 6000)); P('Genres', 'Dream pop', ch(0.4, 55, 50), rv(6000, 25, 40, 4.5));
  P('Genres', 'Ambient drone', ch(0.15, 80, 55), rv(5000, 40, 60, 8), fl(3500, 20)); P('Genres', 'Cinematic trailer', rv(4500, 50, 40, 5), ds(20, 6000, 30), cp(-26, 6, 1.5)); P('Genres', 'Gregorian chant', rv(2800, 45, 50, 7.5), eq(1, -2, 0));
  P('Genres', 'Country twang', eq(-3, 4, 3, 3000), dl(110, 8, 25, 5000), rv(5000, 5, 15, 1)); P('Genres', 'Bluegrass cabin', rv(3500, 4, 18, 0.7), eq(-2, 3, 2, 2500)); P('Genres', 'Afrobeat guitar', ch(1.2, 25, 40), tr(6, 30), eq(-2, 4, 1, 3500));
  P('Genres', 'City pop gloss', ch(0.6, 35, 50), rv(7000, 15, 28, 2), eq(1, 4, 0)); P('Genres', 'Italo disco', ch(0.5, 40, 50), dl(300, 35, 25, 7000), rv(8000, 10, 22, 1.6)); P('Genres', 'Krautrock motorik', fg(0.15, 50, 40), dl(250, 40, 25, 4000));
  P('Genres', 'Industrial clang', ds(70, 4500, 80, 'fold'), rg(180, 40), rv(4500, 5, 35, 2)); P('Genres', 'Bedroom pop', tp(30, 25, 50), ch(0.5, 30, 40), rv(5000, 15, 22, 1.6)); P('Genres', 'Hardstyle kick', ds(70, 3500, 90, 'hard'), cp(-22, 8, 1.4), rv(3000, 5, 15, 0.7));
  P('Genres', 'Gospel organ swell', tr(6, 30), ch(6, 40, 45), rv(3500, 25, 35, 3)); P('Genres', 'Ska upstroke', rv(4500, 3, 15, 0.7), eq(0, 3, 2, 2500)); P('Genres', 'K-pop gloss', cp(-20, 4, 1.3), eq(-1, 5, 2, 4000), ch(0.5, 20, 25), rv(7000, 20, 18, 1.6));

  window.FXLIB = L;
})();
