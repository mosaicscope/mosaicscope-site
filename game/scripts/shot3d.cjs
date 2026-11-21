// Screenshot the 3D view headlessly: node scripts/shot3d.cjs [out.png] [hour] [w] [h]  (serve first: npx vite preview --port 4173)
const { chromium } = require("playwright-core");
(async () => {
  const out = process.argv[2] || "shot3d.png", hour = Number(process.argv[3] || 15), w = Number(process.argv[4] || 1366), h = Number(process.argv[5] || 720);
  const browser = await chromium.launch({ channel: "msedge", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 240)));
  await page.goto("http://127.0.0.1:4173/world/");
  await page.getByRole("button", { name: "Start new game", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Start my story", exact: true }).click().catch(() => {});
  await page.waitForTimeout(5000);
  const skip = page.getByRole("button", { name: "Skip" }); if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.evaluate((hr) => { const s = window.__mosaics.sim; s.env.startHour = hr - s.tick / 3600; }, hour);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Camera:/.test(b.textContent))?.click());
  await page.waitForTimeout(3500);
  // render a few frames synchronously so the governor settles and the picture is current
  await page.evaluate(() => { const g = window.__mosaics, r = g.renderer, o = { selected: -1, hovered: -1, debug: false, reduceMotion: false, quality: g.quality, showNames: true, quietInterface: false }; for (let i = 0; i < 6; i++) r.render(1, 1 / 60, o); });
  await page.screenshot({ path: out });
  const info = await page.evaluate(() => { const r = window.__mosaics.renderer; return { persp: r.perspectiveActive, lod: r.drivingView.lod }; });
  console.log(JSON.stringify({ info, errs: errs.slice(0, 3) }));
  await browser.close();
})();
