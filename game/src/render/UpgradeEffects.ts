import { drawAnimalAtlas } from "../ui/AnimalAtlas";
import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { hasUpgrade } from "../content/upgrades";

/** Cosmetic upgrades read saved state and leave the simulation RNG untouched. */
export function drawUpgradeEffects(g: CanvasRenderingContext2D, sim: Simulation, cam: Camera, time: number, reduced: boolean, quality: number): void {
  const u = sim.life.upgrades, own = (id: string) => hasUpgrade(u, id), t = reduced ? 0 : time;
  const pt = { x: 0, y: 0 }, z = cam.zoom, W = cam.viewW, H = cam.viewH;
  g.save();
  if (own("clouds") && sim.daylight > 0.4 && quality > 0) {
    for (let i = 0; i < 4; i++) {
      const x = ((t * 5 + i * W / 3) % (W + 400)) - 200;
      const shadow = g.createRadialGradient(x, H * (0.2 + i * 0.18), 10, x, H * (0.2 + i * 0.18), 240);
      shadow.addColorStop(0, "#0a27301c"); shadow.addColorStop(1, "#0a273000");
      g.fillStyle = shadow; g.fillRect(0, 0, W, H);
    }
  }
  if (own("sunset") && sim.hour > 17 && sim.hour < 20) {
    const grade = g.createLinearGradient(0, 0, W, H); grade.addColorStop(0, "#ffae4418"); grade.addColorStop(1, "#db568412"); g.fillStyle = grade; g.fillRect(0, 0, W, H);
  }
  if (own("puddles") && sim.env.raining && quality > 0) {
    const baseX = Math.floor(cam.x / 4) * 4, baseY = Math.floor(cam.y / 4) * 4;
    for (let i = 0; i < 15; i++) {
      const x = baseX + i % 5 * 4 - 8, y = baseY + Math.floor(i / 5) * 6 - 8;
      if (!sim.world.walkable(x, y)) continue;
      cam.toScreen(x, y, 0, pt); g.save(); g.translate(pt.x, pt.y);
      g.fillStyle = i % 2 ? "#8ac9df35" : "#e4bf9c30"; g.beginPath(); g.ellipse(0, 0, 19 * z, 7 * z, -0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#f0d6ad55"; g.lineWidth = z; g.beginPath(); g.moveTo(-9 * z, Math.sin(t + i) * z); g.lineTo(8 * z, 2 * z); g.stroke(); g.restore();
    }
  }
  if (own("streetlights") && sim.daylight < 0.5) {
    for (const poi of sim.world.pois) {
      if (poi.kind !== "lamp") continue;
      cam.toScreen(poi.x, poi.y, 2, pt);
      if (pt.x < -30 || pt.x > W + 30 || pt.y < -30 || pt.y > H + 30) continue;
      g.fillStyle = u.streetlight === "neon" ? "#ac86ff66" : "#ffd28666";
      g.beginPath(); g.ellipse(pt.x, pt.y, 15 * z, 6 * z, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const plaza = sim.world.areas.find(a => a.kind === "plaza");
  if (own("fountain") && plaza) {
    cam.toScreen(plaza.cx, plaza.cy, 0, pt);
    if (pt.x > -100 && pt.x < W + 100 && pt.y > -100 && pt.y < H + 100) {
      g.save(); g.translate(pt.x, pt.y); g.scale(z, z);
      g.fillStyle = "#6a9294"; g.beginPath(); g.ellipse(0, 0, 31, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#83dce0"; g.beginPath(); g.ellipse(0, -3, 26, 10, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#cffaffaa"; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 8; g.beginPath(); g.moveTo(x, -4); g.quadraticCurveTo(x * 0.5, -35 - Math.sin(t * 2 + i) * 3, 0, -35); g.stroke(); }
      g.restore();
    }
  }
  const stage = sim.world.areas.find(a => a.kind === "stage");
  if (stage && own("stringlights")) {
    const colours = u.lights === "warm" ? ["#ffe3a2"] : u.lights === "neon" ? ["#ff80d0", "#88bbff"] : ["#ffba8a", "#8ae7b6", "#c5a3ff"];
    let previous: { x: number; y: number } | null = null;
    for (let i = 0; i < 12; i++) {
      cam.toScreen(stage.cx - 5 + i, stage.cy, 2 + Math.cos(i / 11 * Math.PI * 2) * 0.15, pt);
      if (previous) { g.strokeStyle = "#1a262b"; g.lineWidth = z; g.beginPath(); g.moveTo(previous.x, previous.y); g.lineTo(pt.x, pt.y); g.stroke(); }
      g.fillStyle = colours[i % colours.length]; g.beginPath(); g.arc(pt.x, pt.y, 2.5 * z, 0, Math.PI * 2); g.fill(); previous = { ...pt };
    }
  }
  if (sim.env.party && (own("discoball") || own("lux"))) {
    cam.toScreen(sim.player.x, sim.player.y, 0, pt);
    g.save(); g.translate(pt.x, pt.y);
    if (own("discoball")) {
      g.fillStyle = "#dbe5ea"; g.beginPath(); g.arc(0, -100 * z, 9 * z, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 18; i++) { const a = i * 2.4 + t * 0.2; g.fillStyle = ["#e6b0ff66", "#a1e7ff66", "#fbdfab66"][i % 3]; g.fillRect(Math.cos(a) * i * 5 * z, Math.sin(a) * i * 2 * z, 3 * z, 2 * z); }
    }
    if (own("lux") && quality > 0) for (let i = 0; i < 3; i++) {
      g.fillStyle = ["#ff93c51c", "#86c6ff1c", "#a1ffbe1c"][i]; const x = Math.sin(t * 0.7 + i * 2) * 80 * z;
      g.beginPath(); g.moveTo((i - 1) * 55 * z, -100 * z); g.lineTo(x - 55 * z, 20 * z); g.lineTo(x + 55 * z, 20 * z); g.closePath(); g.fill();
    }
    g.restore();
  }
  if (own("bando")) {
    cam.toScreen(u.pet.x, u.pet.y, 0, pt); g.save(); g.translate(pt.x, pt.y); g.scale(z, z);
    const moving=Math.hypot(u.pet.x-sim.player.x,u.pet.y-sim.player.y)>1.4;
    if(u.pet.x>sim.player.x)g.scale(-1,1);
    drawAnimalAtlas(g,0,0,'Working dogs',moving?t:0,.58,'walk');g.restore();
  }
  g.restore();
}
