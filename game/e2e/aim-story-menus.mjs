import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
page.on('pageerror', e => errors.push(e.message));
fs.mkdirSync('e2e/screenshots', { recursive: true });
const url = process.argv[2] || 'http://127.0.0.1:4173/world/';
const menu = async name => { await page.getByRole('button', { name: 'Menu', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
try {
  await page.route('**/api/**', r => r.fulfill({ json: { weather: 'clear', isDay: true, temp: 14, wind: 10, hour: 12 } }));
  await page.goto(url);
  await page.getByRole('button', { name: 'Start new game', exact: true }).click();
  await page.getByRole('button', { name: 'Start my story', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.evaluate(() => {
    const g = window.__mosaics, s = g.sim, p = s.player;
    g.setSpeed(0); const area = s.world.areas.find(a => a.kind === 'plaza');
    p.x = p.px = area.x0 + 3; p.y = p.py = area.y0 + 3; p.inCar = p.inside = -1;
    p.phys = 0; p.vx = p.vy = 0; p.path = null; p.wounds = []; p.stunUntil = 0;
    for (const c of s.chars) if (c !== p) { c.x = c.px = 3; c.y = c.py = 3; c.nextThink = 1e12; c.vx = c.vy = 0; }
    g.renderer.cam.follow = p.id; g.renderer.cam.lookAt(p.x, p.y, true); g.renderer.cam.zoom = g.renderer.cam.targetZoom = 2;
    const npc = s.chars.find(c => c.name === 'Tiles'); npc.x = npc.px = p.x + 2; npc.y = npc.py = p.y; npc.inside = npc.inCar = -1;
    s.rebuildHash();
  });
  await page.waitForTimeout(150);
  const npcPoint = await page.evaluate(() => { const g = window.__mosaics, t = g.sim.chars.find(c => c.name === 'Tiles'); return g.renderer.cam.toScreen(t.x, t.y, 1.05, { x: 0, y: 0 }); });
  await page.mouse.click(npcPoint.x, npcPoint.y);
  if (!await page.evaluate(() => { const g = window.__mosaics; return g.renderer.cam.follow === g.sim.playerId && g.renderer.cam.targetZoom === 2; })) throw Error('Inspecting an NPC stole camera focus or zoom');
  // A detached camera can be reclaimed even while the simulation is paused.
  await page.evaluate(() => { const g = window.__mosaics; g.renderer.cam.follow = -1; g.renderer.cam.lookAt(3, 3, true); });
  await page.getByRole('button', { name: 'Return to player · C', exact: true }).click();
  if (!await page.evaluate(() => { const g = window.__mosaics; return g.renderer.cam.follow === g.sim.playerId && Math.hypot(g.renderer.cam.x - g.sim.player.x, g.renderer.cam.y - g.sim.player.y) < .1; })) throw Error('Return to player failed while paused');
  await page.evaluate(() => {
    const s = window.__mosaics.sim;
    const root = s.emit({ type: 'weather', x: 3, y: 3, summary: 'Camera recovery test' });
    s.emit({ type: 'weather', x: 8, y: 8, cause: root, summary: 'Camera recovery follow-up' });
    s.events.process(s.tick);
  });
  await menu('Event replay');
  await page.locator('.replay-entry').filter({ hasText: 'Camera recovery test' }).click();
  await page.getByRole('button', { name: 'Return to player · C', exact: true }).click();
  await page.waitForTimeout(2700);
  if (!await page.evaluate(() => window.__mosaics.renderer.cam.follow === window.__mosaics.sim.playerId) || await page.locator('.replay-caption').count()) throw Error('Replay timer stole camera control back after returning to player');
  await page.evaluate(() => {
    const g = window.__mosaics, s = g.sim, p = s.player;
    if (p.hand >= 0) s.dropHeld(p); const gun = s.spawnToy('pistol', p.x, p.y); s.pickupToy(p, gun);
    p.combat = { style: 'jab', xp: 0, ammo: { pistol: 100 }, vest: 0, helmet: 0 };
    // A selected NPC away from the crosshair must never redirect the shot.
    g.select(s.chars.find(c => c.name === 'Tiles').id);
  });
  const aim = await page.evaluate(() => { const g = window.__mosaics, p = g.sim.player; return g.renderer.cam.toScreen(p.x - 1, p.y + 2, 1.05, { x: 0, y: 0 }); });
  const position = await page.evaluate(() => ({ x: window.__mosaics.sim.player.x, y: window.__mosaics.sim.player.y }));
  await page.mouse.click(aim.x, aim.y);
  await page.locator('.world-crosshair:not(.hidden)').waitFor();
  if (await page.evaluate(() => window.__mosaics.sim.player.combat.ammo.pistol) !== 100) throw Error('Tap to aim fired prematurely');
  if (!await page.evaluate(pos => { const p = window.__mosaics.sim.player; return p.x === pos.x && p.y === pos.y; }, position)) throw Error('Tap to aim moved the player');
  await page.keyboard.press('f'); await page.evaluate(() => window.__mosaics.setSpeed(0));
  const shot = await page.evaluate(() => {
    const g = window.__mosaics, p = g.sim.player, b = [...g.sim.toys].reverse().find(t => t.weaponOrigin === 'pistol' && t.thrower === p.id);
    return { ammo: p.combat.ammo.pistol, angle: b?.angle, intent: b ? g.sim.throwIntent.get(b.id) : null };
  });
  if (shot.ammo !== 99 || Math.abs(shot.angle - Math.atan2(2, -1)) > .15 || shot.intent >= 0) throw Error('Crosshair shot was redirected to the selected NPC: ' + JSON.stringify(shot));
  await page.screenshot({ path: 'e2e/screenshots/crosshair-aim-fire.png' });
  await menu('Developer console');
  await menu('Settings');
  if (await page.getByRole('region', { name: 'Developer panel', exact: true }).isVisible()) throw Error('Developer panel stayed over Settings');
  await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
  const close = page.getByRole('button', { name: 'Close', exact: true }); await close.focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  if (!await page.evaluate(() => !!document.activeElement?.closest('.modal'))) throw Error('Settings keyboard focus escaped');
  await page.keyboard.press('Escape');
  await menu('SALT story');
  const story = page.locator('.salt-dialogue[role=dialog]'); await story.waitFor();
  if (await page.getByLabel('Story chapter', { exact: true }).locator('option').count() !== 11) throw Error('Story chapter missing');
  const first = await page.locator('.salt-line').innerText();
  await page.getByRole('button', { name: 'Next line', exact: true }).click();
  if (await page.locator('.salt-line').innerText() === first) throw Error('Story line did not advance');
  await page.locator('.salt-library > summary').click();
  await page.getByLabel('Story chapter', { exact: true }).selectOption('10');
  await page.locator('.salt-library > summary').click();
  if (!await page.locator('.salt-dialogue .modal-header h2').innerText().then(t => t.includes('The Party'))) throw Error('Final chapter inaccessible');
  await page.getByText('Read the full scene dialogue', { exact: true }).click();
  if (!await page.locator('.salt-transcript').innerText().then(t => t.includes('Glitter:'))) throw Error('Full authored dialogue missing');
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.locator('.modal').evaluate(el => el.scrollWidth > el.clientWidth + 2)) throw Error('Mobile story panel overflows');
  await page.screenshot({ path: 'e2e/screenshots/salt-chapters-mobile.png' });
  await page.getByRole('button', { name: 'Street encounters', exact: true }).click();
  if (!await page.locator('.modal').innerText().then(t => t.includes('Street discoveries'))) throw Error('Existing street encounters missing');
  await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1366, height: 1000 });
  await page.evaluate(() => {
    const g = window.__mosaics, p = g.sim.player, c = g.sim.chars.find(c => c.name === 'Tiles');
    // The earlier live shot can legitimately frighten witnesses. Stage a calm conversation.
    g.setSpeed(0); g.modal.close(); g.dialogue.close();
    c.mode = 'idle'; c.goal = null; c.phys = 0; c.talkWith = -1; c.emo.fear = 0;
    c.x = c.px = p.x + .8; c.y = c.py = p.y; c.vx = c.vy = 0;
    g.dialogue.start(c.id);
  });
  await page.getByRole('button', { name: 'SALT stories · 11 authored chapters', exact: true }).waitFor();
  if (await page.locator('.dialogue .opts button').count() > 6) throw Error('Story displaced the dialogue choice budget');
  await page.getByRole('button', { name: 'SALT stories · 11 authored chapters', exact: true }).click(); await story.waitFor();
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  await page.locator('.dialogue:not(.hidden)').waitFor();
  const lighting = await page.evaluate(() => {
    const g = window.__mosaics, s = g.sim, r = g.renderer;
    g.dialogue.close(); g.unfocus(); g.select(-1); g.setSpeed(0);
    s.env.startHour = 0; s.tick = 0; s.env.power = true; s.env.raining = false;
    const b = s.world.buildings.find(b => b.height >= 5 && b.x1 - b.x0 >= 3);
    if (!b) throw Error('No tall building for occlusion test');
    s.player.x = s.player.px = 3; s.player.y = s.player.py = 3;
    const v = s.vehicles[0]; s.vehicles = [v];
    Object.assign(v, { id: 0, cls: 'hatch', plate: 'TEST123', damage: 0, dmgF: 0, dmgR: 0, glassDamage: 0, burning: false, burnt: false, speed: 0, driver: -1, brake: false, siren: false, heading: Math.PI / 2 });
    const options = { selected: -1, hovered: -1, debug: g.debug, reduceMotion: true, quality: 1, showNames: false, quietInterface: true };
    const pictures = [];
    const measure = (x, y, zoom) => {
      v.x = v.px = x; v.y = v.py = y; r.cam.follow = -1; r.cam.lookAt(x, y, true); r.cam.zoom = r.cam.targetZoom = zoom;
      const center = r.cam.toScreen(x, y + 1, .35, { x: 0, y: 0 }), scale = r.dpr;
      const patch = () => r.g.getImageData(Math.round((center.x - 24) * scale), Math.round((center.y - 24) * scale), Math.round(48 * scale), Math.round(48 * scale)).data;
      v.state = 'parked'; r.render(1, 0, options); const before = [...patch()]; pictures.push(r.canvas.toDataURL());
      v.state = 'drive'; r.render(1, 0, options); const after = patch(); pictures.push(r.canvas.toDataURL());
      return before.reduce((n, c, i) => n + Math.abs(c - after[i]), 0);
    };
    const hidden = measure((b.x0 + b.x1 + 1) / 2, b.y0 - 1.2, 2);
    const area = s.world.areas.find(a => a.kind === 'plaza');
    const visible = measure(area.x0 + 3, area.y0 + 3, 2);
    return { hidden, visible, pictures, building: { name: b.name, x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1, height:b.height } };
  });
  lighting.pictures.forEach((data,i)=>fs.writeFileSync('e2e/screenshots/vehicle-light-comparison-'+i+'.png',Buffer.from(data.split(',')[1],'base64'))); delete lighting.pictures;
  if (lighting.hidden !== 0 || lighting.visible <= 0) throw Error('Vehicle lighting occlusion regression: ' + JSON.stringify(lighting));
  await page.screenshot({ path: 'e2e/screenshots/vehicle-lighting-visible.png' });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.route('**/api/**', r => r.fulfill({ json: { weather: 'clear', isDay: true, temp: 14, wind: 10, hour: 12 } }));
  await mobile.goto(url);
  await mobile.getByRole('button', { name: 'Start new game', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Start my story', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Skip', exact: true }).tap();
  const tapAim = await mobile.evaluate(() => {
    const g = window.__mosaics, s = g.sim, p = s.player; g.setSpeed(0);
    if (p.hand >= 0) s.dropHeld(p); const gun = s.spawnToy('pistol', p.x, p.y); s.pickupToy(p, gun);
    p.phys = 0; p.stunUntil = 0; p.wounds = []; p.combat = { style: 'jab', xp: 0, ammo: { pistol: 10 }, vest: 0, helmet: 0 };
    g.renderer.cam.zoom = g.renderer.cam.targetZoom = 1;
    return g.renderer.cam.toScreen(p.x - 1, p.y + 2, 1.05, { x: 0, y: 0 });
  });
  await mobile.touchscreen.tap(tapAim.x, tapAim.y);
  await mobile.locator('.world-crosshair:not(.hidden)').waitFor();
  await mobile.getByRole('button', { name: 'Fire · F / Space', exact: true }).tap();
  if (await mobile.evaluate(() => window.__mosaics.sim.player.combat.ammo.pistol) !== 9) throw Error('Mobile tap aim / fire failed');
  const boxes = await mobile.evaluate(() => {
    const a = document.querySelector('.aim-tools').getBoundingClientRect(), b = document.querySelector('.hud').getBoundingClientRect();
    return { overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  if (boxes.overlap || boxes.overflow) throw Error('Mobile aiming controls overlap HUD or overflow');
  await mobile.screenshot({ path: 'e2e/screenshots/crosshair-mobile-touch.png' });
  await mobile.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS: tap aim / separate fire / no selected-target redirection, paused camera return, exclusive menus, keyboard focus, all 11 chapters, full dialogue, old encounters, NPC conversation bridge, mobile overflow, vehicle-light occlusion ' + JSON.stringify(lighting));
} finally { await browser.close(); }
