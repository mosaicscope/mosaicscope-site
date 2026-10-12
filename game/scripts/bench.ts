/**
 * Headless simulation benchmark. Measures ms per fixed tick (AI + movement + physics + events) at
 * increasing populations. Rendering is benchmarked separately in the browser (e2e/bench-render.mjs).
 * Usage: npm run bench [-- --ticks 1800]
 */
import { Simulation } from "../src/sim/Simulation";
import os from "node:os";
import fs from "node:fs";

const ticksArg = process.argv.indexOf("--ticks");
const TICKS = ticksArg > 0 ? +process.argv[ticksArg + 1] : 1800;
const sizes = [500, 1000, 2000, 5000, 10000];
const rows: string[] = [];
const hw = `${os.cpus()[0]?.model ?? "unknown CPU"} x${os.cpus().length}, Node ${process.version}, ${os.platform()}`;
console.log(`Hardware: ${hw}\nTicks per run: ${TICKS} (= ${(TICKS / 60).toFixed(0)} s of game time at 1x)\n`);
console.log("entities | build ms | mean ms/tick | p95 ms/tick | max ms/tick | ai | move | physics | events | ticks/s possible");
for (const total of sizes) {
  const bg = total - 91; // 1 player + 10 principals + 80 mid
  const t0 = performance.now();
  const sim = new Simulation({ seed: 4242, backgroundCount: bg, maxToys: 160 });
  const build = performance.now() - t0;
  // warm up (JIT), then measure
  for (let i = 0; i < 120; i++) sim.step();
  const times: number[] = []; let ai = 0, mv = 0, ph = 0, ev = 0;
  for (let i = 0; i < TICKS; i++) {
    const a = performance.now(); sim.step(); times.push(performance.now() - a);
    ai += sim.metrics.aiMs; mv += sim.metrics.moveMs; ph += sim.metrics.physicsMs; ev += sim.metrics.eventsMs;
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length, p95 = times[Math.floor(times.length * 0.95)], max = times[times.length - 1];
  const row = `${String(sim.chars.length).padStart(8)} | ${build.toFixed(0).padStart(8)} | ${mean.toFixed(3).padStart(12)} | ${p95.toFixed(3).padStart(11)} | ${max.toFixed(2).padStart(11)} | ${(ai / TICKS).toFixed(3)} | ${(mv / TICKS).toFixed(3)} | ${(ph / TICKS).toFixed(3)} | ${(ev / TICKS).toFixed(3)} | ${Math.floor(1000 / mean)}`;
  console.log(row); rows.push(row);
}
fs.mkdirSync("bench-results", { recursive: true });
fs.writeFileSync("bench-results/sim-latest.txt", `Hardware: ${hw}\nDate: ${new Date().toISOString()}\nTicks: ${TICKS}\n\n` + rows.join("\n") + "\n");
