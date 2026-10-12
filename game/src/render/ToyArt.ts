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
    case "bat": case "hockey_stick": {
      const len = 2.4 * u;
      const ex = x + Math.cos(angle) * len * dir, ey = y + Math.sin(angle) * len;
      g.strokeStyle = def === "bat" ? "#c08040" : "#9a8d80"; g.lineCap = "round";
      g.lineWidth = 0.22 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (ex - x) * 0.5, y + (ey - y) * 0.5); g.stroke();
      g.lineWidth = (def === "bat" ? 0.42 : 0.22) * u; g.beginPath(); g.moveTo(x + (ex - x) * 0.5, y + (ey - y) * 0.5); g.lineTo(ex, ey); g.stroke();
      if (def === "hockey_stick") { g.lineWidth = 0.3 * u; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 0.6 * u * dir, ey + 0.2 * u); g.stroke(); }
      g.strokeStyle = "#0e0b0a"; g.lineWidth = 0.26 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (ex - x) * 0.15, y + (ey - y) * 0.15); g.stroke();
      break;
    }
    case "frying_pan": {
      const hx = x + Math.cos(angle) * 1.0 * u * dir, hy = y + Math.sin(angle) * 1.0 * u;
      g.strokeStyle = "#0e0b0a"; g.lineWidth = 0.25 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = "#3a3430"; g.strokeStyle = "#9a8d80"; g.lineWidth = 0.1 * u; g.beginPath(); g.ellipse(hx + Math.cos(angle) * 0.7 * u * dir, hy + Math.sin(angle) * 0.7 * u, 0.75 * u, 0.6 * u, 0, 0, 6.283); g.fill(); g.stroke();
      break;
    }
    case "boxing_gloves": g.fillStyle = color; g.beginPath(); g.ellipse(x, y, 0.55 * u, 0.45 * u, 0, 0, 6.283); g.fill(); g.fillStyle = "#eee4d3"; g.fillRect(x - 0.4 * u, y + 0.25 * u, 0.8 * u, 0.2 * u); break;
    case "pillow": g.fillStyle = color; g.strokeStyle = "#9a8d80"; g.lineWidth = 0.08 * u; g.beginPath(); g.ellipse(x, y, 0.8 * u, 0.5 * u, angle * 0.3, 0, 6.283); g.fill(); g.stroke(); break;
    case "nunchucks": g.strokeStyle = color; g.lineWidth = 0.22 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.9 * u * dir, y - 0.5 * u); g.stroke(); g.strokeStyle = "#9a8d80"; g.lineWidth = 0.05 * u; g.beginPath(); g.moveTo(x + 0.9 * u * dir, y - 0.5 * u); g.quadraticCurveTo(x + 1.3 * u * dir, y, x + 1.0 * u * dir, y + 0.4 * u); g.stroke(); g.strokeStyle = color; g.lineWidth = 0.22 * u; g.beginPath(); g.moveTo(x + 1.0 * u * dir, y + 0.4 * u); g.lineTo(x + 1.9 * u * dir, y + 0.6 * u); g.stroke(); break;
    case "nerf": case "paintball": case "water_pistol": case "taser": {
      const body = def === "paintball" ? "#3a3430" : def === "taser" ? "#f6b62c" : color;
      g.fillStyle = body;
      g.fillRect(x - 0.2 * u * dir, y - 0.35 * u, 1.3 * u * dir, 0.4 * u);
      g.fillRect(x - 0.1 * u * dir, y, 0.25 * u * dir, 0.5 * u);
      if (def === "paintball") { g.fillStyle = "#ff7ad9"; g.beginPath(); g.arc(x + 0.3 * u * dir, y - 0.6 * u, 0.3 * u, 0, 6.283); g.fill(); }
      if (def === "nerf") { g.fillStyle = "#f6b62c"; g.fillRect(x + 0.2 * u * dir, y - 0.55 * u, 0.6 * u * dir, 0.2 * u); }
      if (def === "water_pistol") { g.fillStyle = "rgba(61,214,255,.6)"; g.beginPath(); g.arc(x + 0.2 * u * dir, y - 0.55 * u, 0.25 * u, 0, 6.283); g.fill(); }
      break;
    }
    case "slingshot": g.strokeStyle = color; g.lineWidth = 0.18 * u; g.beginPath(); g.moveTo(x, y + 0.4 * u); g.lineTo(x, y - 0.1 * u); g.lineTo(x - 0.35 * u, y - 0.6 * u); g.moveTo(x, y - 0.1 * u); g.lineTo(x + 0.35 * u, y - 0.6 * u); g.stroke(); break;
    case "pellet": g.fillStyle = color; g.beginPath(); g.arc(x, y, 0.22 * u, 0, 6.283); g.fill(); break;
    case "droplet": g.fillStyle = "rgba(61,214,255,.8)"; g.beginPath(); g.arc(x, y, 0.16 * u, 0, 6.283); g.fill(); break;
    case "pebble": g.fillStyle = "#9a8d80"; g.beginPath(); g.arc(x, y, 0.2 * u, 0, 6.283); g.fill(); break;
    case "probe": g.strokeStyle = "#f6b62c"; g.lineWidth = 0.08 * u; g.beginPath(); g.moveTo(x - 0.4 * u, y); g.lineTo(x + 0.4 * u, y); g.stroke(); break;
    case "water_balloon": g.fillStyle = color; g.beginPath(); g.ellipse(x, y, 0.45 * u, 0.55 * u, 0, 0, 6.283); g.fill(); g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(x - 0.15 * u, y - 0.2 * u, 0.12 * u, 0, 6.283); g.fill(); break;
    case "skateboard": g.fillStyle = color; g.beginPath(); g.ellipse(x, y, 1.2 * u, 0.3 * u, angle * 0.2, 0, 6.283); g.fill(); g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(x - 0.8 * u, y + 0.3 * u, 0.15 * u, 0, 6.283); g.arc(x + 0.8 * u, y + 0.3 * u, 0.15 * u, 0, 6.283); g.fill(); break;
    case "bin": break;
    case "phone": g.fillStyle = "#0e0b0a"; g.strokeStyle = "#eee4d3"; g.lineWidth = 0.06 * u; g.fillRect(x - 0.22 * u, y - 0.4 * u, 0.44 * u, 0.75 * u); g.strokeRect(x - 0.22 * u, y - 0.4 * u, 0.44 * u, 0.75 * u); break;
    case "camera": g.fillStyle = "#1a1614"; g.fillRect(x - 0.55 * u, y - 0.35 * u, 1.1 * u, 0.7 * u); g.strokeStyle = "#eee4d3"; g.lineWidth = 0.08 * u; g.beginPath(); g.arc(x, y, 0.25 * u, 0, 6.283); g.stroke(); g.fillStyle = "#ec2a1c"; g.fillRect(x + 0.25 * u, y - 0.32 * u, 0.15 * u, 0.12 * u); break;
    case "watch": case "chain": g.strokeStyle = "#f6b62c"; g.lineWidth = 0.12 * u; g.beginPath(); g.arc(x, y, 0.3 * u, 0, 6.283); g.stroke(); break;
    case "headphones": g.strokeStyle = color; g.lineWidth = 0.12 * u; g.beginPath(); g.arc(x, y, 0.4 * u, Math.PI, 0); g.stroke(); g.fillStyle = color; g.fillRect(x - 0.5 * u, y - 0.1 * u, 0.2 * u, 0.35 * u); g.fillRect(x + 0.3 * u, y - 0.1 * u, 0.2 * u, 0.35 * u); break;
    case "spray_can": g.fillStyle = color; g.fillRect(x - 0.15 * u, y - 0.5 * u, 0.3 * u, 0.8 * u); g.fillStyle = "#eee4d3"; g.fillRect(x - 0.08 * u, y - 0.65 * u, 0.16 * u, 0.15 * u); break;
    case "vinyl": g.fillStyle = "#0e0b0a"; g.strokeStyle = "#9a8d80"; g.lineWidth = 0.05 * u; g.beginPath(); g.arc(x, y, 0.5 * u, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = "#ec2a1c"; g.beginPath(); g.arc(x, y, 0.15 * u, 0, 6.283); g.fill(); break;
    case "pie": g.fillStyle = "#b0641c"; g.beginPath(); g.ellipse(x, y, 0.5 * u, 0.35 * u, 0, 0, 6.283); g.fill(); g.strokeStyle = "#f6b62c"; g.lineWidth = 0.06 * u; g.stroke(); break;
    case "fish_chips": g.fillStyle = "#eee4d3"; g.fillRect(x - 0.45 * u, y - 0.3 * u, 0.9 * u, 0.6 * u); g.fillStyle = "#f6b62c"; g.fillRect(x - 0.3 * u, y - 0.45 * u, 0.15 * u, 0.3 * u); g.fillRect(x, y - 0.5 * u, 0.15 * u, 0.3 * u); break;
    case "burger": g.fillStyle = "#c08040"; g.beginPath(); g.arc(x, y - 0.05 * u, 0.4 * u, Math.PI, 0); g.fill(); g.fillStyle = "#6b3a12"; g.fillRect(x - 0.4 * u, y, 0.8 * u, 0.15 * u); g.fillStyle = "#2d6b24"; g.fillRect(x - 0.42 * u, y - 0.05 * u, 0.84 * u, 0.06 * u); g.fillStyle = "#c08040"; g.fillRect(x - 0.4 * u, y + 0.15 * u, 0.8 * u, 0.12 * u); break;
    case "kebab": case "bao": case "sushi": case "pizza": case "donut": case "hokey_pokey": {
      g.fillStyle = color;
      if (def === "pizza") { g.beginPath(); g.moveTo(x - 0.4 * u, y - 0.3 * u); g.lineTo(x + 0.4 * u, y - 0.3 * u); g.lineTo(x, y + 0.45 * u); g.closePath(); g.fill(); g.fillStyle = "#ec2a1c"; g.beginPath(); g.arc(x, y - 0.05 * u, 0.08 * u, 0, 6.283); g.fill(); }
      else if (def === "donut") { g.beginPath(); g.arc(x, y, 0.38 * u, 0, 6.283); g.fill(); g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(x, y, 0.12 * u, 0, 6.283); g.fill(); }
      else if (def === "hokey_pokey") { g.fillStyle = "#c08040"; g.beginPath(); g.moveTo(x - 0.22 * u, y - 0.1 * u); g.lineTo(x + 0.22 * u, y - 0.1 * u); g.lineTo(x, y + 0.5 * u); g.closePath(); g.fill(); g.fillStyle = "#f6e0a0"; g.beginPath(); g.arc(x, y - 0.22 * u, 0.26 * u, 0, 6.283); g.fill(); }
      else { g.beginPath(); g.ellipse(x, y, 0.42 * u, 0.28 * u, 0, 0, 6.283); g.fill(); }
      break;
    }
    case "flat_white": case "lp": case "energy_drink": g.fillStyle = color; g.fillRect(x - 0.18 * u, y - 0.35 * u, 0.36 * u, 0.65 * u); if (def === "flat_white") { g.fillStyle = "#eee4d3"; g.fillRect(x - 0.2 * u, y - 0.42 * u, 0.4 * u, 0.1 * u); } break;
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
