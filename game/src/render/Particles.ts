import type { Camera } from "./Camera";
import type { FxKind } from "../sim/Simulation";

/**
 * Pooled world-space particles (purely visual; the simulation never reads them). A fixed pool means
 * no allocation in the frame loop; spawning past the limit recycles the oldest particle.
 */
interface P { on: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; kind: number; size: number; text: string; g: number }

const K_DOT = 0, K_SPARK = 1, K_SQ = 2, K_TEXT = 3, K_RING = 4, K_STAR = 5;

export class Particles {
  private pool: P[] = [];
  private next = 0;
  active = 0;
  scale = 1; // quality multiplier on spawn counts
  private pt = { x: 0, y: 0 };

  constructor(public capacity = 700) {
    for (let i = 0; i < capacity; i++) this.pool.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, color: "#fff", kind: 0, size: 2, text: "", g: 9 });
  }

  private take(): P {
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.next + i) % this.capacity;
      if (!this.pool[idx].on) { this.next = idx + 1; return this.pool[idx]; }
    }
    const p = this.pool[this.next % this.capacity]; this.next++; return p; // recycle oldest-ish
  }

  spawn(kind: FxKind, x: number, y: number, z: number, n = 6, color = "#eee4d3", text = "", rand: () => number = Math.random): void {
    const count = Math.max(1, Math.round(n * this.scale));
    for (let i = 0; i < count; i++) {
      const p = this.take();
      p.on = true; p.x = x; p.y = y; p.z = z; p.life = 0; p.color = color; p.text = text; p.g = 9;
      const a = rand() * 6.283, s = rand();
      switch (kind) {
        case "impact": p.kind = K_SPARK; p.vx = Math.cos(a) * (1 + s * 2); p.vy = Math.sin(a) * (1 + s * 2); p.vz = 1 + s * 3; p.max = 0.35; p.size = 2; break;
        case "spark": p.kind = K_SPARK; p.vx = Math.cos(a) * 2 * s; p.vy = Math.sin(a) * 2 * s; p.vz = 2 + s * 3; p.max = 0.5; p.size = 1.5; break;
        case "dust": p.kind = K_DOT; p.color = "rgba(154,141,128,.6)"; p.vx = Math.cos(a) * 0.5; p.vy = Math.sin(a) * 0.5; p.vz = 0.5 + s; p.max = 0.6; p.size = 2.5 + s * 2; p.g = 1; break;
        case "break": p.kind = K_SQ; p.vx = Math.cos(a) * (1 + s * 3); p.vy = Math.sin(a) * (1 + s * 3); p.vz = 2 + s * 4; p.max = 1.1; p.size = 2 + s * 3; break;
        case "confetti": p.kind = K_SQ; p.color = ["#c6ff3d", "#ff7ad9", "#f6b62c", "#3dd6ff", "#ec2a1c"][i % 5]; p.vx = Math.cos(a) * 3 * s; p.vy = Math.sin(a) * 3 * s; p.vz = 4 + s * 5; p.max = 2.2; p.size = 2.5; p.g = 4; break;
        case "heart": p.kind = K_TEXT; p.text = "♥"; p.color = rand() < 0.5 ? "#ff7ad9" : "#ec2a1c"; p.vx = (rand() - 0.5) * 0.4; p.vy = (rand() - 0.5) * 0.4; p.vz = 0.8; p.max = 1.4; p.size = 12; p.g = 0; break;
        case "star": p.kind = K_STAR; p.color = "#f6b62c"; p.vx = Math.cos(a) * 0.8; p.vy = Math.sin(a) * 0.8; p.vz = 1.5; p.max = 0.8; p.size = 3; p.g = 2; break;
        case "spring": p.kind = K_RING; p.color = "#c6ff3d"; p.vx = 0; p.vy = 0; p.vz = 0; p.max = 0.5; p.size = 4 + i * 4; p.g = 0; break;
        case "music": p.kind = K_TEXT; p.text = rand() < 0.5 ? "♪" : "♫"; p.color = color; p.vx = (rand() - 0.5) * 0.6; p.vy = (rand() - 0.5) * 0.6; p.vz = 0.9; p.max = 1.6; p.size = 13; p.g = 0; break;
        case "text": p.kind = K_TEXT; p.vx = 0; p.vy = 0; p.vz = 0.7; p.max = 1.2; p.size = 11; p.g = 0; break;
        case "zzz": p.kind = K_TEXT; p.text = "z"; p.vx = 0.2; p.vy = -0.2; p.vz = 0.5; p.max = 1.5; p.size = 10; p.g = 0; break;
        case "rain_splash": p.kind = K_RING; p.color = "rgba(160,190,230,.5)"; p.vx = 0; p.vy = 0; p.vz = 0; p.max = 0.3; p.size = 2; p.g = 0; break;
      }
    }
  }

  update(dt: number): void {
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) { p.on = false; continue; }
      p.vz -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      n++;
    }
    this.active = n;
  }

  draw(g: CanvasRenderingContext2D, cam: Camera): void {
    const pt = this.pt, z = cam.zoom;
    for (const p of this.pool) {
      if (!p.on) continue;
      cam.toScreen(p.x, p.y, p.z, pt);
      if (pt.x < -20 || pt.y < -20 || pt.x > cam.viewW + 20 || pt.y > cam.viewH + 20) continue;
      const t = p.life / p.max;
      g.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      g.fillStyle = g.strokeStyle = p.color;
      switch (p.kind) {
        case K_DOT: g.beginPath(); g.arc(pt.x, pt.y, p.size * z * (1 + t), 0, 6.283); g.fill(); break;
        case K_SPARK: g.lineWidth = p.size * z; g.beginPath(); g.moveTo(pt.x, pt.y); g.lineTo(pt.x - (p.vx - p.vy) * 4 * z, pt.y - ((p.vx + p.vy) * 2 - p.vz * 3) * z); g.stroke(); break;
        case K_SQ: g.fillRect(pt.x - p.size * z / 2, pt.y - p.size * z / 2, p.size * z, p.size * z * 0.6); break;
        case K_TEXT: g.font = `${Math.round(p.size * Math.max(0.7, z))}px "IBM Plex Mono", ui-monospace, monospace`; g.fillText(p.text, pt.x, pt.y); break;
        case K_RING: g.lineWidth = 1.2; g.beginPath(); g.ellipse(pt.x, pt.y, (p.size + t * 14) * z, (p.size + t * 14) * z * 0.5, 0, 0, 6.283); g.stroke(); break;
        case K_STAR: g.beginPath(); g.arc(pt.x, pt.y, p.size * z, 0, 6.283); g.fill(); break;
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void { for (const p of this.pool) p.on = false; }
}
