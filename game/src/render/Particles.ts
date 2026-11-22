import type { Camera } from "./Camera";
import type { FxKind } from "../sim/Simulation";

/**
 * Pooled world-space particles (purely visual; the simulation never reads them). A fixed pool means
 * no allocation in the frame loop; spawning past the limit recycles the oldest particle.
 */
interface P { rot: number; vr: number; on: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; kind: number; size: number; text: string; g: number }

/** Slapstick bits that fly off stick figures on big hits (26 kinds). */
const GIBS = ["💫", "⭐", "🩹", "😵", "🌀", "💥", "🧦", "🧢", "👟", "💨", "🔩", "🪥", "✦", "✧", "!", "!!", "OOF", "OW", "OUCH", "POW", "ZAP", "★", "☆", "〰", "☁", "✶"];
const K_DOT = 0, K_SPARK = 1, K_SQ = 2, K_TEXT = 3, K_RING = 4, K_STAR = 5, K_SMOKE = 6, K_CASING = 7;

export class Particles {
  private pool: P[] = [];
  private next = 0;
  active = 0;
  scale = 1; // quality multiplier on spawn counts
  private pt = { x: 0, y: 0 };

  constructor(public capacity = 700) {
    for (let i = 0; i < capacity; i++) this.pool.push({ rot: 0, vr: 0, on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, color: "#fff", kind: 0, size: 2, text: "", g: 9 });
  }

  private take(): P {
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.next + i) % this.capacity;
      if (!this.pool[idx].on) { this.next = idx + 1; return this.pool[idx]; }
    }
    const p = this.pool[this.next % this.capacity]; this.next++; return p; // recycle oldest-ish
  }

  spawn(kind: FxKind, x: number, y: number, z: number, n = 6, color = "#eee4d3", text = "", rand: () => number = Math.random, dir?: number): void {
    const count = Math.max(1, Math.round(n * this.scale));
    for (let i = 0; i < count; i++) {
      const p = this.take();
      p.rot = 0; p.vr = 0; p.on = true; p.x = x; p.y = y; p.z = z; p.life = 0; p.color = color; p.text = text; p.g = 9;
      const a = rand() * 6.283, s = rand();
      switch (kind) {
        // spent brass: thrown out to the right of the barrel, tumbling, bouncing on the ground and lying there a while
        case "casing": { const d = (dir ?? 0) + Math.PI / 2 + (rand() - 0.5) * 0.7, v = 2.6 + rand() * 2; p.kind = K_CASING; p.color = i % 2 ? "#e0b04a" : "#caa13a"; p.vx = Math.cos(d) * v; p.vy = Math.sin(d) * v; p.vz = 3 + rand() * 2.2; p.max = 3.2; p.size = 2.4; p.g = 22; p.rot = rand() * 6.283; p.vr = (rand() - 0.5) * 38; break; }
        // a directional burst of burning gas out of the muzzle
        case "muzzle": { const d = (dir ?? 0) + (rand() - 0.5) * 0.5, v = 7 + rand() * 7; p.kind = K_SPARK; p.color = rand() < 0.5 ? "#ffe2a0" : "#ff9a3d"; p.vx = Math.cos(d) * v; p.vy = Math.sin(d) * v; p.vz = (rand() - 0.3) * 1.2; p.max = 0.13 + rand() * 0.08; p.size = 2.4; p.g = 0; break; }
        case "gun_smoke": { const d = (dir ?? 0) + (rand() - 0.5) * 0.9; p.kind = K_SMOKE; p.color = "rgba(190,190,196,.8)"; p.vx = Math.cos(d) * (0.5 + s * 1.4); p.vy = Math.sin(d) * (0.5 + s * 1.4); p.vz = 0.3 + s * 0.4; p.max = 0.9 + s * 0.8; p.size = 1.8 + s * 2; p.g = -0.2; break; }
        // a hit on a body: a fan of blood thrown along the bullet's line, and a bright shock ring on the first particle
        case "hit_flesh": { const d = (dir ?? a) + (rand() - 0.5) * 1.1, v = 2.5 + s * 5.5; if (i === 0) { p.kind = K_RING; p.color = "#ffd0c8"; p.vx = p.vy = p.vz = 0; p.max = 0.28; p.size = 5; p.g = 0; break; } p.kind = rand() < 0.2 ? K_SQ : K_DOT; p.color = ["#b3121b", "#7a0d12", "#c4434d", "#922733"][Math.floor(rand() * 4)]; p.vx = Math.cos(d) * v; p.vy = Math.sin(d) * v; p.vz = 0.8 + s * 3.2; p.max = 0.7 + s * 0.5; p.size = 1.2 + s * 1.6; p.g = 16; break; }
        // a hit on a wall or the ground: chips and dust thrown back out of the surface, with a couple of sparks
        case "hit_chip": { const d = (dir ?? a) + Math.PI + (rand() - 0.5) * 1.3, v = 1.5 + s * 4; if (i % 4 === 0) { p.kind = K_SPARK; p.color = "#fff0b0"; p.vx = Math.cos(d) * v * 1.6; p.vy = Math.sin(d) * v * 1.6; p.vz = 1 + s * 2.5; p.max = 0.3; p.size = 1.6; break; } if (i % 4 === 1) { p.kind = K_DOT; p.color = "rgba(176,168,156,.7)"; p.vx = Math.cos(d) * v * .5; p.vy = Math.sin(d) * v * .5; p.vz = 0.4 + s; p.max = 0.7; p.size = 2.4 + s * 2; p.g = 0.5; break; } p.kind = K_SQ; p.color = i % 2 ? "#8a8176" : "#5f5850"; p.vx = Math.cos(d) * v; p.vy = Math.sin(d) * v; p.vz = 1.2 + s * 3; p.max = 0.8; p.size = 1.4 + s; p.g = 15; break; }
        case "tyre_smoke": p.kind=K_SMOKE; p.vx=Math.cos(a)*0.35; p.vy=Math.sin(a)*0.35; p.vz=0.25+s*0.35; p.max=1.6+s*0.9; p.size=3+s*3; p.g=-0.12; break;
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
        case "blood": p.kind = rand()<.15?K_SQ:K_DOT; p.color = ["#b3121b","#7a0d12","#c4434d","#922733"][Math.floor(rand()*4)]; p.vx = Math.cos(a) * (0.5 + s * 2.2); p.vy = Math.sin(a) * (0.5 + s * 2.2); p.vz = 1 + s * 3.5; p.max = 0.7; p.size = 1 + s * 1.6; p.g = 12; break;
        // cartoon gore for stick figures: a bone, a tooth, a wiggly bit of noodle, a few dizzy stars
        case "gib": p.kind = K_TEXT; p.text = GIBS[Math.floor(rand() * GIBS.length)]; p.color = "#eee4d3"; p.vx = Math.cos(a) * (1 + s * 2.5); p.vy = Math.sin(a) * (1 + s * 2.5); p.vz = 2 + s * 3; p.max = 1.3; p.size = 1; p.g = 9; break;
        case "spray": p.kind = K_DOT; p.color = color; p.vx = Math.cos(a) * 0.3; p.vy = Math.sin(a) * 0.3; p.vz = 0.2; p.max = 0.6; p.size = 1.5 + s * 2; p.g = 0; break;
        case "flash": p.kind = K_RING; p.color = "#fff6c8"; p.vx = 0; p.vy = 0; p.vz = 0; p.max = 0.25; p.size = 3; p.g = 0; break;
        case "paint": p.kind = K_SQ; p.color = color; p.vx = Math.cos(a) * 1.5 * s; p.vy = Math.sin(a) * 1.5 * s; p.vz = 1 + s * 2; p.max = 0.6; p.size = 2.5; p.g = 10; break;
        case "water": p.kind = K_DOT; p.color = "rgba(61,214,255,.8)"; p.vx = Math.cos(a) * 1.2 * s; p.vy = Math.sin(a) * 1.2 * s; p.vz = 1 + s * 2; p.max = 0.5; p.size = 1.2; p.g = 10; break;
        case "cash": p.kind = K_SQ; p.color = "#7bd36b"; p.vx = (rand() - 0.5) * 0.6; p.vy = (rand() - 0.5) * 0.6; p.vz = 1.5; p.max = 1.2; p.size = 3; p.g = 2; break;
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
      if (p.kind === K_CASING) p.rot += p.vr * dt;
      if (p.z < 0) { p.z = 0; if (p.kind === K_CASING) { p.vz *= -0.38; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5; if (Math.abs(p.vz) < 0.8) { p.vz = 0; p.vx *= 0.3; p.vy *= 0.3; p.vr = 0; } } else { p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
      n++;
    }
    this.active = n;
  }

  draw(g: CanvasRenderingContext2D, cam: Camera, perspectiveScale?: (x:number,y:number)=>number): void {
    const pt = this.pt;
    for (const p of this.pool) {
      if (!p.on) continue;
      const z=perspectiveScale ? perspectiveScale(p.x,p.y) : cam.zoom; if(z<=0)continue;
      cam.toScreen(p.x, p.y, p.z, pt);
      if (pt.x < -20 || pt.y < -20 || pt.x > cam.viewW + 20 || pt.y > cam.viewH + 20) continue;
      const t = p.life / p.max;
      g.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      g.fillStyle = g.strokeStyle = p.color;
      switch (p.kind) {
        case K_SMOKE: {
          const radius=p.size*z*(0.6+t*3.5);
          g.globalAlpha=Math.sin(Math.PI*t)*(1-t)*0.7;
          const cloud=g.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,radius);
          cloud.addColorStop(0,p.color); cloud.addColorStop(1,"rgba(210,214,216,0)");
          g.fillStyle=cloud;g.beginPath();g.arc(pt.x,pt.y,radius,0,6.283);g.fill();break;
        }
        case K_DOT: g.beginPath(); g.arc(pt.x, pt.y, p.size * z * (1 + t), 0, 6.283); g.fill(); break;
        case K_SPARK: g.lineWidth = p.size * z; g.beginPath(); g.moveTo(pt.x, pt.y); g.lineTo(pt.x - (p.vx - p.vy) * 4 * z, pt.y - ((p.vx + p.vy) * 2 - p.vz * 3) * z); g.stroke(); break;
        case K_SQ: g.fillRect(pt.x - p.size * z / 2, pt.y - p.size * z / 2, p.size * z, p.size * z * 0.6); break;
        case K_TEXT: g.font = `${Math.round(p.size * Math.max(0.7, z))}px "IBM Plex Mono", ui-monospace, monospace`; g.fillText(p.text, pt.x, pt.y); break;
        case K_RING: g.lineWidth = 1.2; g.beginPath(); g.ellipse(pt.x, pt.y, (p.size + t * 14) * z, (p.size + t * 14) * z * 0.5, 0, 0, 6.283); g.stroke(); break;
        case K_CASING: { g.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1; g.save(); g.translate(pt.x, pt.y); g.rotate(p.rot); const w = p.size * 1.7 * z, hh = p.size * 0.8 * z; g.fillStyle = p.color; g.fillRect(-w / 2, -hh / 2, w, hh); g.fillStyle = "rgba(255,244,200,.7)"; g.fillRect(-w / 2, -hh / 2, w, hh * 0.35); g.fillStyle = "#8a6a1c"; g.fillRect(w / 2 - w * 0.22, -hh / 2, w * 0.22, hh); g.restore(); break; }
        case K_STAR: g.beginPath(); g.arc(pt.x, pt.y, p.size * z, 0, 6.283); g.fill(); break;
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void { for (const p of this.pool) p.on = false; }
}
