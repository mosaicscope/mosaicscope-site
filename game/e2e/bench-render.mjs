// Browser render+sim benchmark: node e2e/bench-render.mjs [url]
// Measures real frames per second and renderer cost with the whole game running, at several crowd sizes.
import { chromium } from "playwright-core";
import fs from "node:fs";
const url = process.argv[2] || "http://127.0.0.1:4173/world/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => localStorage.setItem("mosaics-world:settings", JSON.stringify({ tutorialDone: true, quality: "high" })));
await page.goto(url);
await page.waitForTimeout(2000);
const results = [];
for (const total of [500, 1000, 2000, 5000]) {
  const r = await page.evaluate(async (total) => {
    const g = window.__mosaics;
    g.settings.density = total - 91; g.reset();
    g.renderer.cam.setZoom(1.0); g.renderer.cam.zoom = 1.0;
    await new Promise((res) => setTimeout(res, 1500));
    let frames = 0, rms = 0; const t0 = performance.now();
    await new Promise((res) => { const f = () => { frames++; rms += g.renderer.stats.frameMs; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const secs = (performance.now() - t0) / 1000;
    return { entities: g.sim.chars.length, fps: frames / secs, renderMs: rms / frames, simMs: g.sim.metrics.stepMs, drawn: g.renderer.stats.figures + g.renderer.stats.silhouettes, batches: g.renderer.stats.batches };
  }, total);
  console.log(JSON.stringify(r));
  results.push(r);
}
const ua = await page.evaluate(() => navigator.userAgent);
fs.mkdirSync("bench-results", { recursive: true });
fs.writeFileSync("bench-results/render-latest.json", JSON.stringify({ date: new Date().toISOString(), userAgent: ua, viewport: "1280x800", quality: "high", note: "Headless Chromium, software rendering (no GPU) in a 4-vCPU cloud container", results }, null, 2));
await browser.close();
