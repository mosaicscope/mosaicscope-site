// Browser smoke test: node e2e/smoke.mjs [url]   (serve first: npm run build && npm run preview)
// Opens the game, checks it renders without runtime errors, and exercises the essential controls.
import { chromium } from "playwright-core";
import fs from "node:fs";
const url = process.argv[2] || "http://127.0.0.1:4173/world/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
// Network-level failures (no internet in a sandbox: Instagram feed, SoundCloud) are not game bugs;
// HTTP errors such as a 404 still count.
page.on("console", (m) => { if (m.type() === "error" && !/net::ERR_/.test(m.text())) errors.push("console: " + m.text()); });
fs.mkdirSync("e2e/screenshots", { recursive: true });
let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "-", e.message); await page.screenshot({ path: `e2e/screenshots/fail-${passed + failed}.png` }); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
const G = (fn, arg) => page.evaluate(fn, arg);

// The Pages Functions (/api/*) do not exist under `vite preview`; answer the score's weather call like the real one would.
await page.route("**/api/vibe", (r) => r.fulfill({ json: { weather: "clear", isDay: true, temp: 14, wind: 10, hour: 12, source: "open-meteo" } }));

console.log("Smoke test:", url);
await page.goto(url);
await page.waitForTimeout(1500);

await check("first-run tutorial appears and can be skipped", async () => {
  await page.getByRole("dialog", { name: "Tutorial" }).waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Skip" }).click();
  assert(!(await page.getByRole("dialog", { name: "Tutorial" }).isVisible()), "tutorial still visible");
});
await check("game booted with 400+ simulated people", async () => {
  const n = await G(() => window.__mosaics.sim.chars.length);
  assert(n >= 400, "only " + n);
});
await check("canvas renders a varied image (not blank)", async () => {
  const colours = await G(() => {
    const c = document.getElementById("world"); const g = c.getContext("2d"); const set = new Set();
    for (let i = 0; i < 400; i++) { const d = g.getImageData(Math.floor(Math.random() * c.width), Math.floor(Math.random() * c.height), 1, 1).data; set.add(d[0] + "," + d[1] + "," + d[2]); }
    return set.size;
  });
  assert(colours > 30, "only " + colours + " distinct colours");
});
await check("simulation time advances", async () => {
  const a = await G(() => window.__mosaics.sim.tick); await page.waitForTimeout(500); const b = await G(() => window.__mosaics.sim.tick);
  assert(b > a + 10, `${a} -> ${b}`);
});
await check("keyboard moves the player", async () => {
  const a = await G(() => ({ x: window.__mosaics.sim.player.x, y: window.__mosaics.sim.player.y }));
  await page.keyboard.down("d"); await page.waitForTimeout(700); await page.keyboard.up("d");
  const b = await G(() => ({ x: window.__mosaics.sim.player.x, y: window.__mosaics.sim.player.y }));
  assert(Math.hypot(b.x - a.x, b.y - a.y) > 0.5, "moved " + Math.hypot(b.x - a.x, b.y - a.y));
});
await check("E picks up a toy, F throws it (physics takes over)", async () => {
  await G(() => { const g = window.__mosaics, p = g.sim.player; for (const id of [p.hand, ...p.bag]) if (id >= 0) g.sim.dropHeld(p); const t = g.sim.spawnToy("ball", p.x + 0.4, p.y); window.__ball = t.id; });
  await page.keyboard.press("e");
  const held = await G(() => window.__mosaics.sim.toys[window.__ball].holder === window.__mosaics.sim.playerId);
  assert(held, "ball not picked up");
  await page.mouse.move(900, 300);
  await page.keyboard.press("f");
  await page.waitForTimeout(100);
  const st = await G(() => window.__mosaics.sim.toys[window.__ball].state);
  assert(st === "flying" || st === "rest", "state " + st);
  assert(await G(() => window.__mosaics.sim.player.hand === -1 || window.__mosaics.sim.player.hand !== window.__ball), "still holding");
});
await check("T opens a conversation with choices; a choice gets a reply; Esc closes", async () => {
  await G(() => { const g = window.__mosaics, p = g.sim.player, n = g.sim.chars.find((c) => c.name === "Kodak"); n.x = p.x + 0.8; n.y = p.y; n.goal = null; n.talkWith = -1; n.phys = 0; n.emo.fear = 0; n.mode = "idle"; g.select(-1); });
  await page.keyboard.press("t");
  const dlg = page.getByRole("dialog", { name: "Conversation" });
  await dlg.waitFor({ timeout: 2000 });
  await dlg.locator(".opts button").first().waitFor({ timeout: 9000 }); // after the opener lines
  const before = await dlg.locator(".line").textContent();
  await page.keyboard.press("2"); // "Tell me about yourself"
  await page.waitForTimeout(200);
  const after = await dlg.locator(".line").textContent();
  assert(after && after !== before, "no reply");
  await page.keyboard.press("Escape");
  assert(!(await dlg.isVisible()), "dialogue still open");
});
await check("clicking a character opens the inspector with needs and memories", async () => {
  await page.keyboard.press("i");
  const insp = page.getByRole("region", { name: "Character inspector" });
  await insp.waitFor({ timeout: 2000 });
  const txt = await insp.textContent();
  assert(/Needs/.test(txt) && /Feelings/.test(txt), "missing sections");
  // real click on someone on screen
  const pt = await G(() => { const g = window.__mosaics, c = g.sim.chars.find((x) => x.tier === "principal" && x.lod === 0) ?? g.sim.chars[1]; g.renderer.cam.follow = c.id; return c.id; });
  await page.waitForTimeout(800);
  const s = await G((id) => { const g = window.__mosaics, c = g.sim.chars[id], o = { x: 0, y: 0 }; g.renderer.cam.toScreen(c.x, c.y, 0, o); return o; }, pt);
  await page.mouse.click(s.x, s.y - 20);
  await page.waitForTimeout(300);
  const name = await insp.locator("h2").textContent();
  assert(name && name.length > 0, "no name");
});
await check("event log opens, lists events, and is searchable", async () => {
  await page.keyboard.press("l");
  const log = page.getByRole("region", { name: "Event log" });
  await log.waitFor({ timeout: 2000 });
  await page.waitForTimeout(400);
  const n = await log.locator("li").count();
  assert(n > 0, "no events");
  await log.getByRole("searchbox").fill("zzzz-no-match");
  assert((await log.locator("li").count()) === 0, "search did not filter");
  await log.getByRole("searchbox").fill("");
  await page.keyboard.press("Escape");
});
await check("pause and 4x speed control the clock", async () => {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const a = await G(() => window.__mosaics.sim.tick); await page.waitForTimeout(400); const b = await G(() => window.__mosaics.sim.tick);
  assert(a === b, "ticked while paused");
  await page.getByRole("button", { name: "Speed 4x" }).click();
  await page.waitForTimeout(1000);
  const rate = await G(() => window.__mosaics.dev ? window.__mosaics.sim.tick : 0);
  assert(rate > b + 100, "not running fast");
  await page.getByRole("button", { name: "Speed 1x" }).click();
});
await check("save to slot 1 and load it back", async () => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Save & load" });
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Save" }).first().click();
  await page.waitForTimeout(200);
  assert(/Saved to slot 1/.test(await dlg.textContent()), "no save message");
  const tickAtSave = await G(() => JSON.parse(localStorage.getItem("mosaics-world:save:1")).tick);
  await page.waitForTimeout(300);
  await G(() => window.__mosaics.setSpeed(0)); // pause so the loaded tick can be compared exactly
  await dlg.getByRole("button", { name: "Load" }).first().click();
  await page.waitForTimeout(200);
  const t = await G(() => window.__mosaics.sim.tick);
  assert(t === tickAtSave, `loaded tick ${t} vs saved ${tickAtSave}`);
  await G(() => window.__mosaics.setSpeed(1));
});
await check("settings open and quality can be changed", async () => {
  await page.getByRole("button", { name: "Settings" }).click();
  const dlg = page.getByRole("dialog", { name: "Settings" });
  await dlg.waitFor();
  await dlg.locator("select").first().selectOption("low");
  await page.keyboard.press("Escape");
  const q = await G(() => JSON.parse(localStorage.getItem("mosaics-world:settings")).quality);
  assert(q === "low", "quality " + q);
});
await check("developer panel shows real metrics and toggles overlays", async () => {
  await page.keyboard.press("`");
  const dev = page.getByRole("region", { name: "Developer panel" });
  await dev.waitFor();
  await page.waitForTimeout(600);
  const txt = await dev.textContent();
  assert(/Entities/.test(txt) && /Spatial queries/.test(txt), "metrics missing");
  await dev.getByLabel("Collision shapes").check();
  assert(await G(() => window.__mosaics.debug.collision), "toggle not applied");
  await page.screenshot({ path: "e2e/screenshots/smoke-dev.png" });
  await dev.getByLabel("Collision shapes").uncheck();
  await page.keyboard.press("`");
});
await check("HUD shows cash, wanted stars and health", async () => {
  const txt = await page.locator(".hud").textContent();
  assert(/\$/.test(txt) && /☆|★/.test(txt), "hud: " + txt);
});
const toDoor = (kind) => G((k) => {
  const g = window.__mosaics, s = g.sim, p = s.player;
  const want = k === "studio" ? -2 : s.world.buildings.find((b) => b.kind === k).id;
  const d = s.world.pois.find((q) => q.kind === "door" && q.building === want);
  p.x = p.px = d.x; p.y = p.py = d.y; p.vx = p.vy = 0; p.phys = 0; p.inCar = -1;
  for (const id of [p.hand, ...p.bag]) if (id >= 0) s.dropHeld(p);
  g.renderer.cam.follow = p.id;
}, kind);
await check("E at the casino door opens the casino; buying chips and leaving cashes out", async () => {
  await toDoor("casino");
  await page.keyboard.press("e");
  const cas = page.getByRole("dialog", { name: "The Tessera Casino" });
  await cas.waitFor({ timeout: 2000 });
  await page.screenshot({ path: "e2e/screenshots/smoke-casino.png" });
  const cash0 = await G(() => window.__mosaics.sim.player.cash);
  await cas.getByRole("button", { name: /\$?20\b/ }).first().click().catch(() => {});
  await page.keyboard.press("Escape");
  assert(!(await cas.isVisible()), "casino still open");
  const cash1 = await G(() => window.__mosaics.sim.player.cash);
  assert(cash1 === cash0, `cash changed without playing: ${cash0} -> ${cash1}`);
});
await check("the studio door shows the real price list and booking links", async () => {
  await toDoor("studio");
  await page.keyboard.press("e");
  const dlg = page.locator(".modal[role=dialog]");
  await dlg.waitFor({ timeout: 2000 });
  const txt = await dlg.textContent();
  assert(/\$40/.test(txt) && /Instagram/.test(txt), "studio panel: " + txt.slice(0, 120));
  await page.keyboard.press("Escape");
});
await check("the police station (open 24/7) opens its panel", async () => {
  await toDoor("police");
  await page.keyboard.press("e");
  const dlg = page.locator(".modal[role=dialog], .iv:not(.hidden)").first();
  await dlg.waitFor({ timeout: 2000 });
  await page.keyboard.press("Escape");
});
await check("get into a parked car, drive it, get out", async () => {
  const id = await G(() => {
    const g = window.__mosaics, s = g.sim, p = s.player;
    const v = s.vehicles.find((x) => x.state === "parked" && x.driver < 0 && !x.forSale);
    v.owner = p.id; // your own car: no theft, no cops
    p.x = p.px = v.x + 1; p.y = p.py = v.y; p.wanted = 0; for (const c of s.chars) if (c.pursuing === p.id) c.pursuing = -1;
    return v.id;
  });
  await page.keyboard.press("e");
  assert(await G((id) => window.__mosaics.sim.player.inCar === id, id), "not in the car");
  const a = await G((id) => ({ x: window.__mosaics.sim.vehicles[id].x, y: window.__mosaics.sim.vehicles[id].y }), id);
  await page.keyboard.down("w"); await page.waitForTimeout(900); await page.keyboard.up("w");
  const b = await G((id) => ({ x: window.__mosaics.sim.vehicles[id].x, y: window.__mosaics.sim.vehicles[id].y }), id);
  assert(Math.hypot(b.x - a.x, b.y - a.y) > 0.5, "car didn't move");
  assert(/km\/h/.test(await page.locator(".hud").textContent()), "no speedo");
  await page.keyboard.down(" "); await page.waitForTimeout(1500); await page.keyboard.up(" ");
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  assert(await G(() => window.__mosaics.sim.player.inCar === -1), "still in the car");
  await G(() => { const p = window.__mosaics.sim.player; p.wanted = 0; });
});
await check("a bleeding player can bandage up with B", async () => {
  await G(() => { const g = window.__mosaics, s = g.sim, p = s.player; p.wounds.push({ part: "arm", severity: 1, kind: "cut", bandaged: false, tick: s.tick }); p.bleed = 0.1; const t = s.spawnToy("bandage", p.x, p.y); s.pickupToy(p, t); });
  await page.keyboard.press("b");
  await page.waitForTimeout(100);
  assert(await G(() => window.__mosaics.sim.player.bleed === 0), "still bleeding");
});
await check("no runtime errors during the run", async () => { assert(errors.length === 0, errors.join(" | ")); });
await page.screenshot({ path: "e2e/screenshots/smoke-final.png" });
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
