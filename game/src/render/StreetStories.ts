import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { ENCOUNTERS } from "../content/encounters";
const ICONS: Record<string, string> = {
  dog: "🐕",
  wedding: "📸",
  water: "💦",
  magpie: "🐦",
  quake: "⚠",
  wallet: "👛",
  bus: "🚌",
  wind: "👕",
  bike: "🚲",
  market: "⛺",
  keys: "🔑",
  busker: "🎸",
  cake: "🎂",
  duck: "🦆",
  interview: "💼",
  power: "💡",
  ring: "💍",
};
/** World-space props and witnesses keep street stories attached to a physical place. */
export function drawStreetStories(
  g: CanvasRenderingContext2D,
  sim: Simulation,
  cam: Camera,
  time: number,
  reduceMotion: boolean,
): void {
  const scene = sim.life.scene,
    z = cam.zoom,
    p = { x: 0, y: 0 };
  g.save();
  g.textAlign = "center";
  for (const marker of sim.life.markers.slice(-16)) {
    cam.toScreen(marker.x, marker.y, 0, p);
    g.fillStyle = "#f6b62c";
    g.font = `${16 * z}px sans-serif`;
    g.fillText(marker.icon, p.x, p.y);
    if (Math.hypot(marker.x - sim.player.x, marker.y - sim.player.y) < 10) {
      g.font = `${10 * z}px sans-serif`;
      g.fillText(marker.name, p.x, p.y - 20 * z);
    }
  }
  if (scene && !scene.resolved) {
    cam.toScreen(scene.x, scene.y, 0, p);
    g.translate(p.x, p.y);
    g.scale(z, z);
    const pulse = reduceMotion ? 0 : Math.sin(time * 3) * 3;
    g.strokeStyle = "#f6b62c";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2);
    g.stroke();
    if (scene.id === "water") {
      g.fillStyle = "#3dd6ff88";
      g.beginPath();
      g.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3dd6ff";
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(8, -40, 18, -8);
      g.stroke();
    }
    // Two gathered witnesses flank the encounter prop.
    for (const x of [-27, 27]) {
      g.strokeStyle = x < 0 ? "#eee4d3" : "#ff7ad9";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, -25, 4, 0, Math.PI * 2);
      g.moveTo(x, -21);
      g.lineTo(x, -9);
      g.moveTo(x - 6, -16);
      g.lineTo(x + 6, -16);
      g.moveTo(x, -9);
      g.lineTo(x - 5, 0);
      g.moveTo(x, -9);
      g.lineTo(x + 5, 0);
      g.stroke();
    }
    g.font = "26px sans-serif";
    g.fillText(ICONS[scene.id] ?? "📦", 0, -8 + pulse);
    g.font = "bold 11px sans-serif";
    const title =
      ENCOUNTERS.find((e) => e.id === scene.id)?.title ?? "Street story";
    const width = g.measureText(title).width + 16;
    g.fillStyle = "#171512ee";
    g.fillRect(-width / 2, -62, width, 21);
    g.fillStyle = "#f6b62c";
    g.fillText(title, 0, -47);
    g.font = "10px sans-serif";
    g.fillText("Explore to help", 0, 20);
  }
  g.restore();
}
