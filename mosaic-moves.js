/* 60 more things the Mosaics do. Every move is its own little piece of choreography (no two share the same keyframes):
   street-corner behaviour, zoned-out stumbles, hype-man antics, and dances from all over (dabke, khaleeji, halay, zeybek, ardah...).
   This file runs BEFORE main.js and hands main.js the move names; the CSS for each move is generated below.
   Cartoon stick figures only. Nothing here is a real instruction for anything. */
(() => {
  'use strict';
  /* Each move: [name, kind('i' idle = .is-name | 'd' dance = .d-name), seconds, spec, says[], prop?, girlsOnly?]
     spec arrays are frames spread evenly over the loop (first frame is appended to the end so it loops):
       aL/aR arms, lL/lR legs, tp torso, hd head (all deg, CSS rotate)   y/x body px   r body deg   s body scaleY   sx body scaleX */
  const M = [];
  const mv = (name, kind, dur, spec, says, extra) => M.push(Object.assign({ name, kind, dur, spec, says: says || [] }, extra || {}));

  /* ---------------- street-corner / low-class behaviour (idle) ---------------- */
  mv('pistolair', 'i', 1.9, { aR: [-172, -150, -178, -170, -170], aL: [18, 18, 28, 18, 18], tp: [0, -7, 0, 0, 0], hd: [0, -6, 0, 0, 0], y: [0, 2, 0, 0, 0] }, ['BANG!', 'POW', 'BANG BANG', 'WOO'], { prop: 'pistol', fx: 'bang' });
  mv('spitting', 'i', 2.6, { hd: [0, 4, 20, 0, -4, 0], tp: [0, 4, 11, 0, -2, 0], aL: [14, 14, 14, 14, 14, 14] }, ['ptooey', 'phtt']);
  mv('pantshike', 'i', 2.2, { aL: [30, 55, 30, 30], aR: [-30, -55, -30, -30], y: [0, -3, 0, 0], r: [0, -3, 0, 3] }, ['hold up', 'my pants']);
  mv('burp', 'i', 3.0, { s: [1, 1, 1.1, 0.95, 1, 1], hd: [0, 0, -14, 4, 0, 0], tp: [0, 0, -5, 2, 0, 0] }, ['', '', 'BRRRP', 'excuse me']);
  mv('bicepkiss', 'i', 2.8, { aR: [-30, -150, -168, -168, -30], aL: [20, 20, 20, 20, 20], hd: [0, 0, 22, 22, 0], tp: [0, 0, 6, 6, 0] }, ['mwah', 'gun show', 'yeah boy']);
  mv('chainflex', 'i', 1.6, { aL: [40, 120, 150, 120, 40], aR: [-40, -120, -150, -120, -40], y: [0, -3, -5, -3, 0], hd: [0, -5, 0, 5, 0] }, ['ice', 'bling', 'cost me']);
  mv('swigstumble', 'i', 4.4, { aR: [-40, -150, -150, -150, -40, -30], hd: [0, -12, -24, -24, 0, 6], r: [0, 2, -3, -7, 8, 0], x: [0, 0, 2, -4, 6, 0] }, ['', '*glug*', '', 'ayyy', '…whoa']);
  mv('meanmug', 'i', 3.4, { aL: [80, 80, 80, 80], aR: [-80, -80, -80, -80], hd: [-3, 4, -3, 4], tp: [0, -2, 0, -2], y: [0, 0, 0, 0] }, ['wat u lookin at', '…', 'yeah you']);
  mv('phonerage', 'i', 2.0, { aR: [-165, -150, -170, -150, -165], aL: [60, 20, 70, 10, 60], x: [-9, 0, 9, 0, -9], hd: [-10, 10, -10, 10, -10], tp: [-6, 6, -6, 6, -6] }, ['NAH BRO', 'I SAID', 'LISTEN', 'who is this']);
  mv('duckselfie', 'i', 2.4, { aL: [155, 165, 155, 155], hd: [8, 16, -10, 8], tp: [4, 8, -4, 4], y: [0, -2, 0, 0] }, ['mwah', 'slay', 'this angle']);
  mv('saggingwaddle', 'i', 1.5, { lL: [8, -10, 8, -10, 8], lR: [-10, 8, -10, 8, -10], x: [-5, 5, -5, 5, -5], r: [-5, 5, -5, 5, -5], aL: [28, 28, 28, 28, 28], aR: [-28, -28, -28, -28, -28] }, []);
  mv('shrughuh', 'i', 2.8, { aL: [50, 98, 98, 50], aR: [-50, -98, -98, -50], hd: [0, 12, 12, 0], tp: [0, -3, -3, 0] }, ['', 'who me?', 'huh?', '']);
  mv('dapup', 'i', 2.6, { aR: [-20, -95, -95, -60, -20], tp: [0, 7, 7, 3, 0], x: [0, 5, 5, 2, 0], hd: [0, -4, -4, 0, 0] }, ['ayy', 'my guy', 'whats good']);
  mv('nodoff', 'i', 4.8, { hd: [0, 18, 26, 4, 28, 0], tp: [0, 5, 8, 1, 9, 0], y: [0, 2, 4, 0, 5, 0], aL: [10, 10, 14, 10, 18, 10], aR: [-10, -10, -14, -10, -18, -10] }, ['', '', '…', '', 'huh?']);
  mv('handstare', 'i', 2.6, { aL: [135, 150, 138, 152, 135], aR: [-135, -150, -138, -152, -135], hd: [10, 12, 10, 14, 10], y: [0, 0, 0, 0, 0] }, ['whoa', 'my hands', 'bro look', 'colours']);
  mv('jawgrind', 'i', 0.5, { hd: [0, 3, -3, 3, -3, 0], tp: [0, 1, -1, 1, -1, 0], s: [1, 1.01, 0.99, 1.01, 1, 1], aL: [24, 24, 24, 24, 24, 24], aR: [-24, -24, -24, -24, -24, -24] }, ['mmmm', '*chew*', 'yeah yeah']);
  mv('swatbugs', 'i', 1.7, { aR: [-120, -40, -145, -30, -120], aL: [110, 30, 130, 20, 110], x: [-3, 3, -3, 3, -3], hd: [-8, 8, -8, 8, -8], lL: [0, 10, 0, 10, 0] }, ['get off', 'AHH', 'theyre on me']);
  mv('twitchy', 'i', 0.9, { tp: [0, 6, -5, 3, -2, 0], hd: [0, -8, 10, -4, 6, 0], aL: [10, 40, -10, 30, 5, 10], aR: [-10, -30, 5, -40, -8, -10], y: [0, -2, 0, -1, 0, 0] }, ['', 'ok ok ok', '']);
  mv('dizzyspin', 'i', 2.4, { sx: [1, 0.1, -1, 0.1, 1, 0.1, -1, 0.1, 1], r: [0, 4, 0, -4, 0, 5, 0, -5, 0], aL: [60, 60, 60, 60, 60, 60, 60, 60, 60], aR: [-60, -60, -60, -60, -60, -60, -60, -60, -60] }, ['whoaaa', 'room spinnin']);
  mv('timber', 'i', 5.0, { r: [0, 0, 2, 14, 46, 46, 8, 0, 0], y: [0, 0, 0, 2, 20, 20, 3, 0, 0], aL: [20, 20, 40, 90, 130, 130, 60, 20, 20], aR: [-20, -20, -40, -90, -130, -130, -60, -20, -20] }, ['', '', '', 'whoa', 'TIMBER', '', '…im good', '', '']);
  mv('preacher', 'i', 3.0, { aR: [-170, -140, -175, -150, -170], aL: [22, 22, 22, 22, 22], hd: [0, -8, 0, -8, 0], tp: [0, -4, 0, -4, 0] }, ['REPENT', 'THE END IS NEAR', 'BELIEVE', 'LISTEN TO ME']);
  mv('mirrorcheck', 'i', 3.4, { aR: [-40, -160, -145, -165, -40], hd: [0, 12, -12, 6, 0], tp: [0, 3, -3, 1, 0] }, ['clean', 'teeth good', 'fresh']);
  mv('airdrums', 'i', 0.5, { aL: [110, 40, 110, 55, 110], aR: [-40, -110, -55, -110, -40], hd: [0, 6, 0, 6, 0], y: [0, 2, 0, 2, 0] }, ['', 'brrrdd', '', 'tss']);
  mv('fingerguns', 'i', 1.4, { aL: [105, 90, 105, 95], aR: [-60, -105, -60, -100], r: [0, -3, 0, 3], hd: [0, 6, 0, -6] }, ['pow pow', 'brrap', 'got em']);
  mv('shoelace', 'i', 3.6, { tp: [0, 46, 52, 46, 52, 0], hd: [0, -10, -12, -10, -12, 0], s: [1, 0.92, 0.9, 0.92, 0.9, 1], aL: [20, 130, 135, 130, 135, 20], aR: [-20, -130, -135, -130, -135, -20] }, ['', 'hold up', '', '', '…']);
  mv('sneakyglance', 'i', 3.2, { x: [0, 0, -12, -12, 0], hd: [0, 0, -28, -28, 0], tp: [0, 0, -4, -4, 0], aL: [20, 20, 20, 20, 20] }, ['', '', 'psst', '…']);
  mv('wannafight', 'i', 1.3, { x: [0, 5, 0, 5, 0], aL: [75, 110, 75, 110, 75], aR: [-75, -110, -75, -110, -75], hd: [-6, 4, -6, 4, -6], tp: [-4, 6, -4, 6, -4] }, ['WANNA GO?', 'say it again', 'come on']);
  mv('lightercheck', 'i', 2.6, { aR: [-30, -118, -100, -118, -30], aL: [30, 30, 30, 30, 30], hd: [0, 8, 8, 6, 0] }, ['yo got a light?', 'anyone?']);
  mv('cashflash', 'i', 2.2, { aL: [40, 108, 128, 108, 40], aR: [-40, -108, -128, -108, -40], y: [0, -4, -2, -4, 0], hd: [0, -4, 0, 4, 0] }, ['$$$', 'racks', 'watch this']);
  mv('hypeman', 'i', 1.1, { aR: [-120, -95, -125, -95, -120], aL: [120, 95, 125, 95, 120], y: [0, -4, 0, -4, 0], hd: [-6, 6, -6, 6, -6] }, ['AYYYY', 'LETS GOOO', 'WHAT']);
  mv('loiterlean', 'i', 5.2, { r: [-12, -13, -12, -11, -12], x: [0, 0, 0, 0, 0], aL: [60, 66, 60, 54, 60], aR: [-40, -40, -40, -40, -40], lR: [-14, -14, -14, -14, -14], hd: [4, 6, 4, 2, 4] }, ['', '…', '']);

  /* ---------------- dances from everywhere + stranger moves ---------------- */
  mv('dabke', 'd', 1.2, { lL: [0, 38, 0, 0, 0], lR: [0, 0, 0, 38, 0], aL: [62, 70, 62, 62, 62], aR: [-62, -70, -62, -62, -62], y: [0, -6, 0, -6, 0], x: [0, 2, 0, -2, 0] }, ['yalla', 'hey!', 'yalla yalla']);
  mv('khaleeji', 'd', 2.0, { tp: [0, 7, 0, -7, 0], aL: [30, 85, 30, 60, 30], aR: [-30, -60, -30, -85, -30], hd: [0, -14, 0, 14, 0], y: [0, -2, 0, -2, 0] }, ['ya habibi', 'mashallah']);
  mv('halay', 'd', 1.6, { aR: [-150, -128, -150, -135, -150], aL: [90, 105, 90, 100, 90], lL: [0, 20, 0, 0, 0], lR: [0, 0, 0, -20, 0], x: [0, -4, 0, 4, 0], tp: [0, 4, 0, -4, 0] }, ['hey!', 'opa', 'hay hay']);
  mv('zeybek', 'd', 3.4, { aL: [100, 112, 100, 90, 100], aR: [-100, -90, -100, -112, -100], r: [0, -7, 0, 7, 0], y: [0, 3, 0, 3, 0], s: [1, 0.94, 1, 0.94, 1], hd: [0, 6, 0, -6, 0] }, []);
  mv('raqs', 'd', 2.2, { tp: [0, 9, 0, -9, 0], r: [0, -4, 0, 4, 0], aL: [120, 150, 120, 95, 120], aR: [-120, -95, -120, -150, -120], y: [0, 1.5, 0, 1.5, 0], hd: [0, -6, 0, 6, 0] }, []);
  mv('ardah', 'd', 2.4, { aR: [-135, -175, -135, -175, -135], aL: [55, 55, 55, 55, 55], x: [0, 4, 0, -4, 0], lL: [0, 12, 0, 0, 0], lR: [0, 0, 0, -12, 0], y: [0, -3, 0, -3, 0] }, ['', 'hey', '']);
  mv('stanky', 'd', 1.0, { lL: [0, 36, 0, 0, 0], lR: [0, 0, 0, -36, 0], tp: [0, 8, 0, -8, 0], aL: [60, 90, 60, 30, 60], aR: [-30, -60, -90, -60, -30], hd: [0, 5, 0, -5, 0] }, ['stank leg']);
  mv('harlem', 'd', 0.6, { aL: [170, 60, 170, 80, 170], aR: [-70, -170, -60, -170, -70], r: [-8, 8, -8, 8, -8], y: [0, -6, 0, -6, 0], lL: [10, -10, 10, -10, 10], lR: [-10, 10, -10, 10, -10] }, ['', '', 'HARLEM']);
  mv('chickenwing', 'd', 0.5, { aL: [105, 62, 105, 62, 105], aR: [-62, -105, -62, -105, -62], tp: [0, 5, 0, -5, 0], y: [0, -3, 0, -3, 0], lL: [0, 15, 0, 0, 0], lR: [0, 0, 0, -15, 0] }, ['bawk']);
  mv('cupid', 'd', 2.4, { x: [0, -9, 0, 9, 0], lL: [0, 16, 0, 0, 0], lR: [0, 0, 0, -16, 0], aL: [70, 80, 70, 40, 70], aR: [-70, -40, -70, -80, -70], tp: [0, -4, 0, 4, 0] }, ['to the right', 'to the left', 'now kick']);
  mv('cabbage', 'd', 1.8, { aL: [90, 170, 90, 10, 90], aR: [-10, -90, -170, -90, -10], tp: [0, 4, 0, -4, 0], y: [0, 1, 0, 1, 0] }, ['wipe', 'wipe it']);
  mv('wobble', 'd', 1.3, { s: [1, 0.84, 1, 0.84, 1], tp: [0, 11, 0, -11, 0], aL: [40, 40, 40, 40, 40], aR: [-40, -40, -40, -40, -40], lL: [0, 12, 0, 0, 0], lR: [0, 0, 0, -12, 0] }, ['wobble']);
  mv('crankup', 'd', 1.5, { aL: [170, 120, 170, 80, 170], aR: [-170, -80, -170, -120, -170], y: [0, -12, 0, -4, 0], r: [0, -5, 0, 5, 0], lL: [0, 30, 0, 0, 0], lR: [0, 0, 0, -30, 0] }, ['SUPERMAN', 'soulja']);
  mv('crisscross', 'd', 1.2, { lL: [0, -32, 0, 28, 0], lR: [0, 32, 0, -28, 0], x: [0, -6, 0, 6, 0], aL: [75, 75, 75, 75, 75], aR: [-75, -75, -75, -75, -75], hd: [0, 4, 0, -4, 0] }, ['criss cross', 'slide']);
  mv('macarena', 'd', 4.0, { aR: [-95, -95, -30, -30, -168, -168, -95, -95], aL: [20, 95, 95, 30, 30, 168, 168, 20], tp: [0, 0, 0, 5, -5, 0, 5, 0], y: [0, 0, 0, -2, 0, -2, 0, 0] }, ['ayyy', '', '', '', 'macarena']);
  mv('jookglide', 'd', 2.2, { x: [0, 6, 14, 6, 0], lL: [0, 30, 0, 30, 0], lR: [0, -30, 0, -30, 0], tp: [0, 6, 0, 6, 0], aL: [40, 40, 40, 40, 40] }, ['', 'glide']);
  mv('noodlearms', 'd', 2.6, { aL: [20, 150, 80, 172, 40, 20], aR: [-150, -30, -172, -60, -120, -150], hd: [-14, 14, -20, 10, -6, -14], tp: [0, 6, -6, 8, -4, 0] }, ['noodle']);
  mv('zombielean', 'd', 3.8, { r: [-22, -26, -21, -27, -22], tp: [0, -4, 0, -4, 0], hd: [18, 8, 22, 6, 18], aL: [30, 36, 30, 40, 30], aR: [-30, -38, -30, -34, -30], x: [0, 3, 0, -3, 0] }, ['…', 'mmm']);
  mv('melt', 'd', 4.2, { s: [1, 0.78, 0.58, 0.78, 1], aL: [30, 10, 0, 10, 30], aR: [-30, -10, 0, -10, -30], hd: [0, 12, 24, 12, 0], y: [0, 2, 4, 2, 0] }, ['', 'melting', '']);
  mv('spaz', 'd', 0.4, { aL: [160, 20, 100, 5, 160], aR: [-20, -150, -5, -110, -20], r: [-9, 6, -3, 9, -9], hd: [-10, 12, -6, 8, -10], y: [0, -4, 0, -3, 0], lL: [10, -14, 6, -8, 10], lR: [-8, 12, -12, 6, -8] }, ['', 'AAHH']);
  mv('slowmoonwalk', 'd', 3.6, { x: [0, -8, -16, -24, -32], lL: [-20, 14, -20, 14, -20], lR: [14, -20, 14, -20, 14], tp: [-6, -6, -6, -6, -6], aL: [40, 70, 40, 70, 40], aR: [-30, -50, -30, -50, -30] }, ['smooth']);
  mv('facebob', 'd', 1.8, { hd: [0, 22, 0, -22, 0], tp: [0, 10, 0, -10, 0], y: [0, 3, 0, 3, 0], aL: [30, 30, 30, 30, 30] }, ['mmm', 'yeaaah']);
  mv('polespin', 'd', 2.8, { aR: [-170, -170, -170, -170, -170], aL: [150, 150, 150, 150, 150], sx: [1, 0.4, -0.2, -0.9, 0.2, 1], y: [0, -3, -5, -3, -1, 0], r: [0, 4, 0, -4, 0, 0], lL: [0, 20, 0, 0, 0, 0] }, [], { prop: 'pole', girls: true });
  mv('hairwhip', 'd', 1.4, { hd: [0, -42, 0, 42, 0], tp: [0, -8, 0, 8, 0], aL: [100, 130, 100, 70, 100], aR: [-100, -70, -100, -130, -100], y: [0, -2, 0, -2, 0] }, ['', 'whip'], { girls: true });
  mv('shakeit', 'd', 0.35, { tp: [0, 5, 0, -5, 0], r: [0, 3, 0, -3, 0], y: [0, 2, 0, 2, 0], aL: [40, 50, 40, 30, 40], aR: [-40, -30, -40, -50, -40] }, ['', 'shake'], { girls: true });
  mv('hypedrop', 'd', 1.6, { s: [1, 0.62, 0.62, 1.12, 1], y: [0, 6, 6, -14, 0], aL: [60, 140, 150, 170, 60], aR: [-60, -140, -150, -170, -60] }, ['', '', 'DROP IT', 'AYY']);
  mv('lowriderlean', 'd', 3.0, { r: [-14, -17, -14, -11, -14], aR: [-110, -112, -110, -108, -110], aL: [24, 24, 24, 24, 24], x: [0, 2, 0, -2, 0], lR: [-12, -12, -12, -12, -12], hd: [-6, -4, -6, -8, -6] }, ['cruisin', 'nice ride'], { girls: false });
  mv('steeringwheel', 'd', 1.6, { aL: [62, 78, 62, 46, 62], aR: [-62, -46, -62, -78, -62], r: [0, -5, 0, 5, 0], tp: [0, 4, 0, -4, 0], hd: [0, -4, 0, 4, 0] }, ['skrrt', 'on the road']);
  mv('hydropump', 'd', 0.8, { aL: [165, 60, 165, 60, 165], aR: [-60, -165, -60, -165, -60], y: [0, -4, 0, -4, 0], hd: [0, 6, 0, -6, 0] }, ['UP', 'DOWN', 'HIT IT']);
  mv('sunglassflex', 'd', 2.4, { aR: [-40, -160, -150, -160, -40], hd: [0, -6, 2, -6, 0], tp: [0, -3, 0, -3, 0], y: [0, 0, -2, 0, 0] }, ['cool', 'deal with it', '']);
  mv('rollingcall', 'd', 1.0, { aL: [100, 60, 100, 60, 100], aR: [-100, -60, -100, -60, -100], tp: [0, 7, 0, -7, 0], hd: [0, -6, 0, 6, 0], y: [0, -2, 0, -2, 0] }, ['', 'roll call']);
  mv('goosestep', 'd', 1.4, { lL: [0, 70, 0, 0, 0], lR: [0, 0, 0, -70, 0], aL: [30, -30, 30, 60, 30], aR: [-30, -60, -30, 30, -30], tp: [0, -3, 0, 3, 0] }, ['hup', 'hup hup']);
  mv('rollerhand', 'd', 1.1, { aL: [150, 100, 60, 100, 150], aR: [-60, -100, -150, -100, -60], tp: [0, 6, 0, -6, 0], y: [0, 1, 0, 1, 0] }, ['roll it', 'turn it up']);
  mv('flopfall', 'd', 3.2, { r: [0, 0, 10, 60, 60, 8, 0], y: [0, 0, 1, 24, 24, 4, 0], aL: [20, 20, 60, 140, 140, 60, 20], aR: [-20, -20, -60, -140, -140, -60, -20] }, ['', '', 'oh no', 'THUD', '', 'im ok', '']);
  mv('cheerleader', 'd', 1.2, { aL: [170, 120, 170, 130, 170], aR: [-170, -130, -170, -120, -170], y: [0, -10, 0, -10, 0], lL: [0, 14, 0, 0, 0], lR: [0, 0, 0, -14, 0] }, ['GO GO GO', 'HIT IT', 'AYYYY']);

  const IDLE = M.filter((m) => m.kind === 'i').map((m) => m.name);
  const DANCE = M.filter((m) => m.kind === 'd' && !m.girls).map((m) => m.name);
  const GIRL = M.filter((m) => m.girls).map((m) => m.name);

  /* ---------------- CSS: one set of keyframes per move ---------------- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let css = '';
  const pct = (i, n) => (n <= 1 ? 0 : Math.round((i / (n - 1)) * 100));
  const frames = (arr, fmt) => arr.concat(arr[0]).map((v, i, a) => pct(i, a.length) + '% {' + fmt(v, i) + '}').join(' ');
  M.forEach((m) => {
    const pre = m.kind === 'i' ? '.raver.is-' + m.name : '.raver.d-' + m.name;
    const k = 'ms-' + m.name, d = m.dur + 's', S = m.spec;
    const limb = { aL: '.rv__armL', aR: '.rv__armR', lL: '.rv__legL', lR: '.rv__legR', tp: '.rv__top', hd: '.rv__head' };
    for (const key of Object.keys(limb)) {
      if (!S[key]) continue;
      css += '@keyframes ' + k + '-' + key + ' { ' + frames(S[key], (v) => 'transform: rotate(' + v + 'deg)') + ' }\n';
      css += pre + ' ' + limb[key] + ' { animation: ' + k + '-' + key + ' ' + d + ' ease-in-out infinite; }\n';
    }
    const n = Math.max(...['x', 'y', 'r', 's', 'sx'].map((q) => (S[q] ? S[q].length : 0)));
    if (n) {
      const at = (arr, i, def) => (arr ? arr[Math.min(arr.length - 1, Math.round((i / Math.max(1, n - 1)) * (arr.length - 1)))] : def);
      let steps = [];
      for (let i = 0; i < n; i++) steps.push(pct(i, n + 1) + '% { transform: translate(' + at(S.x, i, 0) + 'px,' + at(S.y, i, 0) + 'px) rotate(' + at(S.r, i, 0) + 'deg) scale(' + at(S.sx, i, 1) + ',' + at(S.s, i, 1) + '); }');
      steps.push('100% { transform: translate(' + at(S.x, 0, 0) + 'px,' + at(S.y, 0, 0) + 'px) rotate(' + at(S.r, 0, 0) + 'deg) scale(' + at(S.sx, 0, 1) + ',' + at(S.s, 0, 1) + '); }');
      css += '@keyframes ' + k + '-body { ' + steps.join(' ') + ' }\n';
      css += pre + ' .rv { animation: ' + k + '-body ' + d + ' ease-in-out infinite; }\n';
    }
  });
  css += `
/* speech, props and the always-on bling */
.raver .ms-say { position: absolute; left: 50%; bottom: 100%; margin-bottom: -6px; transform: translateX(-50%); white-space: nowrap; pointer-events: none; opacity: 0; z-index: 5;
  font: 700 10px/1 var(--f-mono, monospace); letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 6px; border-radius: 8px 8px 8px 2px; background: #eee4d3; color: #0e0b0a; transition: opacity 0.15s; }
.raver .ms-say.is-on { opacity: 1; }
.raver .ms-flash { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(#fff, #ffd24a 60%, transparent 70%); opacity: 0; pointer-events: none; }
.raver .ms-flash.is-on { animation: ms-flashpop 0.2s ease-out; }
@keyframes ms-flashpop { 0% { opacity: 1; transform: scale(0.4); } 100% { opacity: 0; transform: scale(2); } }
.raver .ms-chain { pointer-events: none; }
.raver .ms-pole { opacity: 0; }
.raver.d-polespin .ms-pole { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .raver [class*="rv"] { animation: none !important; } }
`;
  const style = document.createElement('style');
  style.id = 'mosaic-moves-css';
  style.textContent = css;
  document.head.append(style);

  /* ---------------- hand the names to main.js ---------------- */
  window.MOSAIC_MOVES = { idle: IDLE, dance: DANCE, girls: GIRL, all: M, reduce, say: (el, t, ms) => say(el, t, ms) };

  /* ---------------- runtime: speech bubbles, the pistol, chains, the pole ---------------- */
  const BY = {}; M.forEach((m) => { BY[(m.kind === 'i' ? 'is-' : 'd-') + m.name] = m; });
  const SVGNS = 'http://www.w3.org/2000/svg';
  const PISTOL = '<g class="ms-pistol" transform="translate(66 72) rotate(180)"><path d="M0 0 h11 v4 h-7 l-1 6 h-4 Z" fill="#2a2420" stroke="#9a8d80" stroke-width="1"/></g>';
  function decorate(el) {
    if (el.__ms) return; el.__ms = true;
    const say = document.createElement('span'); say.className = 'ms-say'; el.append(say);
    const flash = document.createElement('i'); flash.className = 'ms-flash'; el.append(flash);
    el.__say = say; el.__flash = flash; el.__n = 0;
    const svg = el.querySelector('.raver__fig');
    const top = el.querySelector('.rv__top');
    const name = el.dataset.name;
    if (svg && top && !top.querySelector('.ms-chain') && ['Tiles', 'Kodak', 'Bando', 'Grain', 'Flash', 'Static'].includes(name)) {   // big gold chains
      const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'ms-chain');
      g.innerHTML = '<path d="M41 44 Q50 76 59 44" fill="none" stroke="#f6b62c" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="1.6 2.2"/><path d="M43 46 Q50 66 57 46" fill="none" stroke="#fff3b0" stroke-width="1.4" stroke-dasharray="1 3"/><rect x="45.5" y="66" width="9" height="9" rx="1.5" fill="#f6b62c" stroke="#9a5a1c" stroke-width="1"/><text x="50" y="73.6" text-anchor="middle" font-size="7" font-weight="700" fill="#0e0b0a" stroke="none" font-family="Arial">M</text>';
      top.append(g);
    }
    if (svg && ['Glitter', 'Ruby', 'Nova', 'Lux'].includes(name)) {                                 // hoops
      const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'ms-chain');
      g.innerHTML = '<circle cx="39.5" cy="36.5" r="3.4" fill="none" stroke="#f6b62c" stroke-width="1.6"/><circle cx="60.5" cy="36.5" r="3.4" fill="none" stroke="#f6b62c" stroke-width="1.6"/>';
      el.querySelector('.rv__head') && el.querySelector('.rv__head').append(g);
    }
    if (svg && !svg.querySelector('.ms-pole')) {                                                      // pole for the pole move
      const p = document.createElementNS(SVGNS, 'g'); p.setAttribute('class', 'ms-pole');
      p.innerHTML = '<path d="M78 8 V128" stroke="#c9ccd1" stroke-width="3" stroke-linecap="round"/><path d="M72 128 H84" stroke="#c9ccd1" stroke-width="3"/>';
      svg.insertBefore(p, svg.firstChild);
    }
  }
  function say(el, text, ms) {
    if (!text || !el.__say) return;
    el.__say.textContent = text; el.__say.classList.add('is-on');
    clearTimeout(el.__sayT); el.__sayT = setTimeout(() => el.__say.classList.remove('is-on'), ms || 1300);
  }
  function onClass(el) {
    decorate(el);
    const hit = [...el.classList].map((c) => BY[c]).find(Boolean);
    const item = el.querySelector('.rv__item');
    if (hit !== el.__move) {
      if (el.__move && el.__move.prop === 'pistol' && item) item.innerHTML = '';
      el.__move = hit; el.__n = 0;
      if (hit) {
        if (hit.prop === 'pistol' && item) item.innerHTML = PISTOL;
        say(el, hit.says[0], 1200);
      } else if (el.__say) el.__say.classList.remove('is-on');
    }
  }
  function watch(el) {
    decorate(el); onClass(el);
    new MutationObserver(() => onClass(el)).observe(el, { attributes: true, attributeFilter: ['class'] });
    el.addEventListener('animationiteration', (e) => {
      const m = el.__move;
      if (!m || !e.animationName.startsWith('ms-' + m.name + '-')) return;
      if (e.animationName.endsWith('-aR') || e.animationName.endsWith('-body') || e.animationName.endsWith('-hd') || e.animationName.endsWith('-aL') || e.animationName.endsWith('-tp')) {
        if (el.__last === e.animationName && el.__lastAt && performance.now() - el.__lastAt < 60) return;
        el.__last = e.animationName; el.__lastAt = performance.now();
        el.__n = (el.__n || 0) + 1;
        const t = m.says.length ? m.says[el.__n % m.says.length] : '';
        if (t && Math.random() < 0.8) say(el, t, 1100);
        if (m.fx === 'bang' && el.__flash) { const f = el.__flash; f.style.left = '74%'; f.style.top = '4%'; f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on'); }
      }
    }, true);
  }
  function scan(root) { root.querySelectorAll('.raver').forEach((el) => { if (!el.__watch) { el.__watch = true; watch(el); } }); }
  const boot = () => {
    const stage = document.getElementById('stage');
    if (!stage) return;
    scan(stage);
    new MutationObserver(() => scan(stage)).observe(stage, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
