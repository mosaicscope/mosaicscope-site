import { LITTER, LitterKind } from "../content/litter";

/** Flat street clutter, drawn at a ground point (sx, sy) in screen space. `z` is the camera zoom. */
export function drawLitter(g: CanvasRenderingContext2D, kind: LitterKind, tone: number, rot: number, sx: number, sy: number, z: number): void {
  z *= 1.6; // small things, but they have to read on a busy street
  const col = LITTER[kind].tones[tone % LITTER[kind].tones.length];
  const dx = Math.cos(rot), dy = Math.sin(rot) * 0.5; // iso squash: things lie along the ground plane
  g.lineCap = "round";
  // soft contact shadow
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(sx, sy + z, 5.5 * z, 2.4 * z, 0, 0, 6.283); g.fill();
  switch (kind) {
    case "can": {
      const l = 4.6 * z, r = 2.1 * z, ax = dx * l, ay = dy * l;
      g.strokeStyle = col; g.lineWidth = r * 2; g.beginPath(); g.moveTo(sx - ax, sy - ay - r * 0.4); g.lineTo(sx + ax, sy + ay - r * 0.4); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = r * 0.5; g.beginPath(); g.moveTo(sx - ax * 0.85, sy - ay * 0.85 - r * 0.9); g.lineTo(sx + ax * 0.85, sy + ay * 0.85 - r * 0.9); g.stroke();
      g.strokeStyle = "#cfd3d8"; g.lineWidth = r * 1.7; g.beginPath(); g.moveTo(sx + ax * 0.95, sy + ay * 0.95 - r * 0.4); g.lineTo(sx + ax, sy + ay - r * 0.4); g.stroke();
      break;
    }
    case "bottle": {
      const l = 6.2 * z, r = 1.9 * z, ax = dx * l, ay = dy * l;
      g.strokeStyle = col; g.lineWidth = r * 2; g.beginPath(); g.moveTo(sx - ax * 0.7, sy - ay * 0.7 - r * 0.4); g.lineTo(sx + ax * 0.15, sy + ay * 0.15 - r * 0.4); g.stroke();
      g.lineWidth = r * 0.9; g.beginPath(); g.moveTo(sx + ax * 0.15, sy + ay * 0.15 - r * 0.4); g.lineTo(sx + ax, sy + ay - r * 0.4); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = r * 0.4; g.beginPath(); g.moveTo(sx - ax * 0.6, sy - ay * 0.6 - r * 0.95); g.lineTo(sx, sy - r * 0.95); g.stroke();
      break;
    }
    case "wrapper": {
      g.fillStyle = col; g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 0.8 * z;
      g.beginPath(); g.moveTo(sx - 3.4 * z, sy); g.lineTo(sx - 1 * z, sy - 2.4 * z); g.lineTo(sx + 2.2 * z, sy - 1.6 * z); g.lineTo(sx + 3.4 * z, sy + 0.6 * z); g.lineTo(sx + 0.4 * z, sy + 1.8 * z); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case "cup": {
      g.fillStyle = col; g.beginPath(); g.moveTo(sx - 2.6 * z, sy - 4.4 * z); g.lineTo(sx + 2.6 * z, sy - 4.4 * z); g.lineTo(sx + 1.8 * z, sy); g.lineTo(sx - 1.8 * z, sy); g.closePath(); g.fill();
      g.fillStyle = "#ec2a1c"; g.fillRect(sx - 2.3 * z, sy - 3.2 * z, 4.6 * z, 1.2 * z);
      g.fillStyle = "#eee4d3"; g.beginPath(); g.ellipse(sx, sy - 4.4 * z, 2.7 * z, 1 * z, 0, 0, 6.283); g.fill();
      break;
    }
  }
}

/** A street bin: green wheelie bin with a lid and a recycling-triangle stripe. */
export function drawBin(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, full: boolean): void {
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sx, sy + z, 9 * z, 3.6 * z, 0, 0, 6.283); g.fill();
  g.fillStyle = "#245a22"; g.beginPath(); g.moveTo(sx - 7 * z, sy - 17 * z); g.lineTo(sx + 7 * z, sy - 17 * z); g.lineTo(sx + 5.5 * z, sy); g.lineTo(sx - 5.5 * z, sy); g.closePath(); g.fill();
  g.fillStyle = "#2f7d2c"; g.fillRect(sx - 8 * z, sy - 20 * z, 16 * z, 4 * z);
  g.strokeStyle = "#6fe3b0"; g.lineWidth = 1.4 * z; g.beginPath(); g.moveTo(sx, sy - 14 * z); g.lineTo(sx + 3 * z, sy - 8 * z); g.lineTo(sx - 3 * z, sy - 8 * z); g.closePath(); g.stroke();
  g.fillStyle = "#14140f"; g.beginPath(); g.arc(sx - 4.5 * z, sy, 1.6 * z, 0, 6.283); g.arc(sx + 4.5 * z, sy, 1.6 * z, 0, 6.283); g.fill();
  if (full) { g.fillStyle = "#d8b24a"; g.beginPath(); g.arc(sx - 3 * z, sy - 21.5 * z, 1.7 * z, 0, 6.283); g.fill(); g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(sx + 2 * z, sy - 21.8 * z, 1.4 * z, 0, 6.283); g.fill(); }
}

/** A community compost bin: a slatted timber box with a lid, a leaf on the front and a few peelings spilling out. */
export function drawCompost(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, bloom: number): void {
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sx, sy + z, 11 * z, 4 * z, 0, 0, 6.283); g.fill();
  g.fillStyle = "#5a3a1c"; g.fillRect(sx - 9 * z, sy - 15 * z, 18 * z, 15 * z);
  g.strokeStyle = "#3a2410"; g.lineWidth = Math.max(1, z); g.beginPath();
  for (const dy of [5, 10]) { g.moveTo(sx - 9 * z, sy - dy * z); g.lineTo(sx + 9 * z, sy - dy * z); }
  g.stroke();
  g.fillStyle = "#7a5a2c"; g.fillRect(sx - 10 * z, sy - 18 * z, 20 * z, 3.5 * z);
  g.fillStyle = "#7bd36b"; g.beginPath(); g.ellipse(sx, sy - 8 * z, 3.4 * z, 2 * z, -0.7, 0, 6.283); g.fill();
  g.strokeStyle = "#245a22"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(sx - 2.6 * z, sy - 6.4 * z); g.lineTo(sx + 2.6 * z, sy - 9.6 * z); g.stroke();
  g.fillStyle = "#c08040"; g.beginPath(); g.arc(sx - 4 * z, sy - 18.8 * z, 1.5 * z, 0, 6.283); g.fill();
  g.fillStyle = "#c6ff3d"; g.beginPath(); g.arc(sx + 3 * z, sy - 19 * z, 1.2 * z, 0, 6.283); g.fill();
  if (bloom > 0.15) { g.fillStyle = "#ff7ad9"; g.beginPath(); g.arc(sx + 11 * z, sy - 1.5 * z, 1.8 * z, 0, 6.283); g.fill(); g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(sx + 11 * z, sy - 1.5 * z, 0.8 * z, 0, 6.283); g.fill(); }
}
