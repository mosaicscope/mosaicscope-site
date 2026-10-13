// Screenshot the world at night to eyeball the STELLAR pass: node e2e/stellar-shot.mjs
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route("**/api/vibe", (r) => r.fulfill({ json: { weather: "clear", isDay: false, temp: 14, wind: 10, hour: 23, source: "open-meteo" } }));
await page.goto("http://127.0.0.1:4173/world/");
await page.waitForTimeout(1500);
await page.evaluate(() => { void 0; });
await page.keyboard.press("Escape");
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /skip/i.test(x.textContent || "")); b?.click(); });
await page.waitForTimeout(1000);
await page.evaluate(() => { const s = window.__mosaics.sim; s.env.startHour = 23 - s.tick / 3600; });
await page.waitForTimeout(300);

await page.waitForTimeout(2500);
const info = await page.evaluate(() => { const s = window.__mosaics.sim; return { tick: s.tick, daylight: s.daylight, hour: s.hour }; });
console.log(JSON.stringify(info));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /decline/i.test(x.textContent || "")); b?.click(); });
await page.waitForTimeout(800);
await page.screenshot({ path: "e2e/screenshots/stellar-night.png" });
console.log("saved e2e/screenshots/stellar-night.png");
await browser.close();
