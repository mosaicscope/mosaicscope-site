/** Toy drawings in screen space. `k` = pixels per figure unit (same scale as stick figures). */
export function drawToy(g: CanvasRenderingContext2D, def: string, x: number, y: number, k: number, angle: number, color: string, alpha = 1, dir = 1): void {
  g.globalAlpha = alpha;
  g.lineCap = "round"; g.lineJoin = "round";
  const u = k * 10; // ~ one "toy unit"
  switch (def) {
    case "ball": {
      g.fillStyle = color; g.beginPath(); g.arc(x, y, 0.55 * u, 0, 6.283); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(x - 0.18 * u, y - 0.2 * u, 0.16 * u, 0, 6.283); g.fill();
      break;
    }
    case "frisbee": g.fillStyle = color; g.strokeStyle = "#eee4d3"; g.lineWidth = 0.08 * u; g.beginPath(); g.ellipse(x, y, 0.7 * u, 0.32 * u, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "foam_sword": case "noodle": {
      const len = def === "noodle" ? 2.6 * u : 2.2 * u, w = def === "noodle" ? 0.42 * u : 0.3 * u;
      g.strokeStyle = color; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(angle) * len * dir, y + Math.sin(angle) * len); g.stroke();
      if (def === "foam_sword") { g.strokeStyle = "#0e0b0a"; g.lineWidth = w * 1.4; g.beginPath(); g.moveTo(x - Math.sin(angle) * 0.4 * u, y + Math.cos(angle) * 0.4 * u); g.lineTo(x + Math.sin(angle) * 0.4 * u, y - Math.cos(angle) * 0.4 * u); g.stroke(); g.strokeStyle = "#f6b62c"; g.lineWidth = w * 0.8; g.stroke(); }
      break;
    }
    case "plush": case "flail": {
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, 0.5 * u, 0, 6.283); g.arc(x - 0.35 * u, y - 0.42 * u, 0.2 * u, 0, 6.283); g.arc(x + 0.35 * u, y - 0.42 * u, 0.2 * u, 0, 6.283); g.fill();
      g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(x - 0.15 * u, y - 0.05 * u, 0.07 * u, 0, 6.283); g.arc(x + 0.15 * u, y - 0.05 * u, 0.07 * u, 0, 6.283); g.fill();
      if (def === "flail") { g.strokeStyle = "#ff7ad9"; g.lineWidth = 0.25 * u; g.beginPath(); g.moveTo(x, y + 0.4 * u); g.lineTo(x - 1.2 * u * dir, y + 1.2 * u); g.stroke(); }
      break;
    }
    case "shield": {
      g.fillStyle = "#3a2c22"; g.strokeStyle = color; g.lineWidth = 0.14 * u;
      g.beginPath(); g.ellipse(x, y, 0.55 * u, 0.85 * u, 0, 0, 6.283); g.fill(); g.stroke();
      g.strokeStyle = "#ec2a1c"; g.beginPath(); g.moveTo(x, y - 0.5 * u); g.lineTo(x, y + 0.5 * u); g.stroke();
      break;
    }
    case "foam_bow": {
      g.strokeStyle = color; g.lineWidth = 0.18 * u;
      g.beginPath(); g.arc(x - 0.4 * u * dir, y, 1.1 * u, -1.1, 1.1); g.stroke();
      g.strokeStyle = "#eee4d3"; g.lineWidth = 0.05 * u; g.beginPath(); g.moveTo(x - 0.4 * u * dir + Math.cos(-1.1) * 1.1 * u, y + Math.sin(-1.1) * 1.1 * u); g.lineTo(x - 0.4 * u * dir + Math.cos(1.1) * 1.1 * u, y + Math.sin(1.1) * 1.1 * u); g.stroke();
      break;
    }
    case "dart": {
      g.strokeStyle = color; g.lineWidth = 0.18 * u;
      g.beginPath(); g.moveTo(x - Math.cos(angle) * 0.5 * u, y - Math.sin(angle) * 0.25 * u); g.lineTo(x + Math.cos(angle) * 0.5 * u, y + Math.sin(angle) * 0.25 * u); g.stroke();
      break;
    }
    case "yoyo": g.fillStyle = color; g.beginPath(); g.arc(x, y, 0.35 * u, 0, 6.283); g.fill(); g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(x, y, 0.1 * u, 0, 6.283); g.fill(); break;
    case "spring": {
      g.fillStyle = "#ec2a1c"; g.fillRect(x - 0.45 * u, y - 0.45 * u, 0.9 * u, 0.9 * u);
      g.strokeStyle = color; g.lineWidth = 0.1 * u; g.strokeRect(x - 0.45 * u, y - 0.45 * u, 0.9 * u, 0.9 * u);
      g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(x, y - 0.7 * u, 0.2 * u, 0, 6.283); g.fill();
      break;
    }
    default: {
      g.fillStyle = color; g.beginPath(); g.arc(x, y, 0.4 * u, 0, 6.283); g.fill();
    }
  }
  g.globalAlpha = 1;
}

/** Isometric box (boxes, crates) centred at screen (x, y) bottom, half-size in px. */
export function drawIsoBox(g: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, h: number, top: string, left: string, right: string): void {
  g.fillStyle = left;
  g.beginPath(); g.moveTo(x - hw, y - hh); g.lineTo(x, y); g.lineTo(x, y - h); g.lineTo(x - hw, y - hh - h); g.closePath(); g.fill();
  g.fillStyle = right;
  g.beginPath(); g.moveTo(x + hw, y - hh); g.lineTo(x, y); g.lineTo(x, y - h); g.lineTo(x + hw, y - hh - h); g.closePath(); g.fill();
  g.fillStyle = top;
  g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - hw, y - hh - h); g.lineTo(x, y - hh * 2 - h); g.lineTo(x + hw, y - hh - h); g.closePath(); g.fill();
}
