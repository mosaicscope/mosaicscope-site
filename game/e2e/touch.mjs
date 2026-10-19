// Touch smoke test: node e2e/touch.mjs [url]   (serve first: npm run build && npm run preview)
// Emulates a phone: the joystick must move the player, the page must not zoom or select text.
import { chromium } from "playwright-core";
const url = process.argv[2] || "http://127.0.0.1:4173/world/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let failed = 0;
const check = async (name, fn) => { try { await fn(); console.log("  ✓", name); } catch (e) { failed++; console.log("  ✗", name, "-", e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
await page.goto(url);
await page.getByRole("button",{name:"Start new game",exact:true}).click();await page.getByRole("button",{name:"Start my story",exact:true}).click(); await page.waitForTimeout(1500);
const skip = page.getByRole("button", { name: "Skip" });
if (await skip.isVisible().catch(() => false)) await skip.tap();
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
await check("joystick zone keeps touch-action none and no text selection", async () => {
  const s = await page.evaluate(() => { const z = document.querySelector(".tc-zone"); const c = getComputedStyle(z); return { ta: c.touchAction, us: c.userSelect || c.webkitUserSelect, on: document.querySelector(".tc").classList.contains("on") }; });
  assert(s.on, "touch controls not on"); assert(s.ta === "none", "touch-action " + s.ta); assert(s.us === "none", "user-select " + s.us);
});
await check("dragging the joystick moves the player", async () => {
  const box = await page.evaluate(() => { const r = document.querySelector(".tc-zone").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const a = await page.evaluate(() => ({ x: window.__mosaics.sim.player.x, y: window.__mosaics.sim.player.y }));
  await touch("touchStart", cx, cy);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", cx + i * 8, cy - i * 4); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  await touch("touchEnd", 0, 0);
  const b = await page.evaluate(() => ({ x: window.__mosaics.sim.player.x, y: window.__mosaics.sim.player.y }));
  assert(Math.hypot(b.x - a.x, b.y - a.y) > 0.4, "player did not move");
});
await check("double-tap does not zoom the page", async () => {
  await touch("touchStart", 200, 300); await touch("touchEnd", 0, 0); await page.waitForTimeout(80);
  await touch("touchStart", 200, 300); await touch("touchEnd", 0, 0); await page.waitForTimeout(300);
  const sc = await page.evaluate(() => window.visualViewport.scale);
  assert(Math.abs(sc - 1) < 0.01, "page scale " + sc);
});
await check("long-press leaves no text selection", async () => {
  await touch("touchStart", 200, 120); await page.waitForTimeout(800); await touch("touchEnd", 0, 0);
  const sel = await page.evaluate(() => String(getSelection()));
  assert(sel === "", "selected: " + sel);
});
await check("no runtime errors", async () => assert(errors.length === 0, errors.join("; ")));
await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
