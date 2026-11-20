// Third-person driving frame-rate probe: node e2e/driving-fps.mjs [label]
// Seats the player in a car on a central mapped arterial, switches to the 3D chase camera and samples four
// headings. Reports uncapped rAF fps and the mean/p95 cost of DrivingView.draw (the 3D frame's render work).
import { chromium } from "playwright-core";
import { createServer } from "vite";
const label = process.argv[2] || "run";
const server = await createServer({ server: { host: "127.0.0.1", port: 5186, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
  args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("mosaics-world:settings", JSON.stringify({ tutorialDone: true, quality: "high" })));
  await page.route("**/api/**", r => r.fulfill({ json: { weather: "clear", isDay: true, temp: 14, wind: 10, hour: 12, posts: [] } }));
  await page.goto("http://127.0.0.1:5186/world/");
  await page.getByRole("button", { name: "Start new game", exact: true }).click();
  await page.getByRole("button", { name: "Start my story", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click().catch(() => {});
  await page.waitForFunction(() => window.__mosaics?.sim?.tick > 2, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const where = await page.evaluate(async () => {
    const { makeVehicle, seat } = await import("/world/src/sim/Traffic.ts");
    const g = window.__mosaics, s = g.sim, m = s.world.mapped, p = s.player;
    // Longest primary/secondary segment near the player: a busy, deterministic spot in the CBD.
    const pick = m.streetSegments.filter(r => ["primary", "secondary", "tertiary"].includes(r.kind) && r.length > 20)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const x = pick.x + pick.dx * pick.length / 2, y = pick.y + pick.dy * pick.length / 2;
    p.x = p.px = x; p.y = p.py = y;
    const v = makeVehicle(s, "sedan", x, y, 0, "parked"); v.heading = Math.atan2(pick.dy, pick.dx); seat(s, p, v); v.state = "free";
    g.renderer.drivingViewEnabled = true;
    const dv = g.renderer.drivingView, draw = dv.draw.bind(dv);
    window.__drawMs = []; globalThis.__sec = {}; window.__totalDraws = 0;
    dv.draw = (...a) => { const t = performance.now(); draw(...a); window.__drawMs.push(performance.now() - t); window.__totalDraws = (window.__totalDraws || 0) + 1; };
    return { name: pick.name, kind: pick.kind, half: pick.half, lanes: pick.lanes?.length };
  });
  const cdp = process.env.PROFILE ? await page.context().newCDPSession(page) : null;
  if (cdp) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
  const samples = [];
  for (let turn = 0; turn < 4; turn++) {
    await page.evaluate(t => { const s = window.__mosaics.sim, v = s.vehicles[s.player.inCar]; v.heading += t ? Math.PI / 2 : 0; v.speed = 0; window.__drawMs.length = 0; window.__frames = 0; const f = () => { window.__frames++; if (window.__frames < 1e6) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__t0 = performance.now(); }, turn);
    await page.waitForTimeout(2500);
    samples.push(await page.evaluate(() => { const d = [...window.__drawMs].sort((a, b) => a - b), s = (performance.now() - window.__t0) / 1000; window.__frames = 1e6; return { fps: window.__frames && d.length / s, draws: d.length, mean: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * .95)] }; }));
  }
  if (cdp) { const { profile } = await cdp.send("Profiler.stop"), self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame, k = (f.functionName || "(anon)") + " " + f.url.split("/").pop().split("?")[0] + ":" + (f.lineNumber + 1); self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
    const total = [...self.values()].reduce((a, b) => a + b, 0); console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => (100 * v / total).toFixed(1) + "% " + k).join(String.fromCharCode(10))); }
  const mean = samples.reduce((a, b) => a + b.mean, 0) / samples.length, p95 = Math.max(...samples.map(s => s.p95)), fps = samples.reduce((a, b) => a + b.fps, 0) / samples.length;
  const sec = await page.evaluate(() => { const r = {}, n = window.__drawMs.length; for (const [k, v] of Object.entries(globalThis.__sec || {})) r[k] = +(v / Math.max(1, window.__totalDraws || 1)).toFixed(2); return r; });
  console.log(JSON.stringify({ sec, label, where, fps: +fps.toFixed(1), drawMeanMs: +mean.toFixed(2), drawP95Ms: +p95.toFixed(2), drawBoundFps: +(1000 / mean).toFixed(1), samples }, null, 1));
  await page.screenshot({ path: `e2e/screenshots/driving-fps-${label}.png` });
  if (errors.length) console.error("page errors:", errors.slice(0, 5).join("\n"));
} finally { await browser.close(); await server.close(); }
