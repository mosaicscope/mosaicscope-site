// Screenshot helper: node e2e/shot.mjs <url> <out.png> [waitMs] [js-to-eval]
import { chromium } from "playwright-core";
const [url = "http://127.0.0.1:5173/world/", out = "e2e/screenshots/shot.png", wait = "4000", extra] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.addInitScript(() => localStorage.setItem("mosaics-world:settings", JSON.stringify({ tutorialDone: true, quality: "high" })));
await page.goto(url);
await page.waitForTimeout(+wait);
if (extra) { await page.evaluate(extra); await page.waitForTimeout(1500); }
await page.screenshot({ path: out, ...(out.endsWith(".jpg") ? { type: "jpeg", quality: 82 } : {}) });
console.log(errs.join("\n") || "no console errors");
await browser.close();
