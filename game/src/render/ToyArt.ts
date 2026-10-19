import {REST_GUN,type GunMotion} from './WeaponMotion';
/** Toy drawings in screen space. `k` = pixels per figure unit (same scale as stick figures). */
export function drawToy(g: CanvasRenderingContext2D, def: string, x: number, y: number, k: number, angle: number, color: string, alpha = 1, dir = 1, motion:GunMotion=REST_GUN): void {
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
    case "mace": case "baton":{const tx=x+Math.cos(angle)*2*u*dir,ty=y+Math.sin(angle)*2*u;g.strokeStyle='#6b5948';g.lineWidth=.23*u;g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty);g.stroke();if(def==='mace'){g.fillStyle='#969b9b';g.strokeStyle='#354045';g.lineWidth=.08*u;g.beginPath();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=(i%2?.45:.68)*u;i?g.lineTo(tx+Math.cos(a)*r,ty+Math.sin(a)*r):g.moveTo(tx+Math.cos(a)*r,ty+Math.sin(a)*r);}g.closePath();g.fill();g.stroke();}break;}
    case "rifle":drawGun(g,'rifle',x,y,u,dir,motion);break;
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
    case "pistol": case "revolver": case "smg": case "shotgun": case "golden_pistol": drawGun(g, def, x, y, u, dir,motion); break;
    case "bullet": {
      // a hot tracer streak along the flight direction
      const lx = Math.cos(angle) * 0.7 * u, ly = Math.sin(angle) * 0.35 * u;
      g.strokeStyle = "rgba(255,170,60,.55)"; g.lineWidth = 0.2 * u; g.beginPath(); g.moveTo(x - lx * 1.6, y - ly * 1.6); g.lineTo(x, y); g.stroke();
      g.strokeStyle = color; g.lineWidth = 0.1 * u; g.beginPath(); g.moveTo(x - lx, y - ly); g.lineTo(x + lx * 0.3, y + ly * 0.3); g.stroke();
      break;
    }
    case "buckshot": g.fillStyle = color; g.beginPath(); g.arc(x, y, 0.12 * u, 0, 6.283); g.fill(); break;
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

/**
 * Cartoon firearms, drawn side-on at the hand (x, y) pointing along `dir` (+1 right, -1 left).
 * Chunky neon-outlined shapes with a bright orange muzzle cap, so they read as toys-from-a-film props.
 */
function drawGun(g: CanvasRenderingContext2D, def: string, x: number, y: number, u: number, dir: number, motion:GunMotion): void {
  const slide=.3*motion.cycle,mag=.8*motion.magazine;
  const X = (dx: number) => x + dx * u * dir, Y = (dy: number) => y + dy * u;
  const poly = (pts: [number, number][], fill: string, stroke?: string, lw = 0.07) => {
    g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Y(pts[i][1]));
    g.closePath(); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * u; g.stroke(); }
  };
  const guard = (cx: number, cy: number, r: number, col: string) => { g.strokeStyle = col; g.lineWidth = 0.07 * u; g.beginPath(); g.arc(X(cx), Y(cy), r * u, 0, Math.PI); g.stroke(); };
  switch (def) {
    case "pistol": case "golden_pistol": {
      const gold = def === "golden_pistol";
      const body = gold ? "#f6b62c" : "#3a3430", edge = gold ? "#fff1a8" : "#9a8d80";
      poly([[-0.25, 0.05], [0.05, 0.05], [-0.05, 0.75], [-0.42, 0.75]], gold ? "#c98a12" : "#1a1614", edge); // grip
      guard(0.2, 0.08, 0.17, edge);
      poly([[.3,-.27],[1.22,-.27],[1.22,-.09],[.3,-.09]],'#717675',edge);
      poly([[-0.3-slide, -0.38], [1.15-slide, -0.38], [1.15-slide, 0.05], [-0.3-slide, 0.05]], body, edge);
      poly([[-.32,.62+mag],[-.08,.62+mag],[-.08,.8+mag],[-.36,.8+mag]],'#454b49',edge);
      poly([[.15-slide,-.3],[.45-slide,-.3],[.45-slide,-.12],[.15-slide,-.12]],'#161c1b'); // slide
      g.strokeStyle = edge; g.lineWidth = 0.05 * u; g.beginPath(); g.moveTo(X(0.1-slide), Y(-0.22)); g.lineTo(X(0.9-slide), Y(-0.22)); g.stroke(); // slide serrations line
      g.fillStyle = gold ? "#d0b77b" : "#697673"; g.fillRect(Math.min(X(1.1), X(1.25)), Y(-0.36), 0.15 * u, 0.38 * u); // muzzle cap
      if (gold) { // bling sparkle
        g.strokeStyle = "#fff6c8"; g.lineWidth = 0.06 * u; const sx = X(0.45), sy = Y(-0.7);
        g.beginPath(); g.moveTo(sx - 0.22 * u, sy); g.lineTo(sx + 0.22 * u, sy); g.moveTo(sx, sy - 0.22 * u); g.lineTo(sx, sy + 0.22 * u); g.stroke();
      }
      break;
    }
    case "revolver": {
      poly([[-0.3, 0.0], [0.05, 0.0], [-0.12, 0.78], [-0.5, 0.7]], "#8a4a1c", "#c08040"); // wooden grip
      guard(0.15, 0.05, 0.17, "#9a8d80");
      g.fillStyle = "#6f6660"; g.beginPath(); g.ellipse(X(0.2), Y(-0.15+motion.cylinder*.4), 0.32 * u, 0.24 * u, 0, 0, 6.283); g.fill(); // cylinder
      g.strokeStyle = "#eee4d3"; g.lineWidth = 0.05 * u; g.stroke();
      for(let i=0;i<6;i++){const a=i*Math.PI/3+(motion.rotation??motion.cycle*Math.PI/3);g.fillStyle='#252a29';g.beginPath();g.ellipse(X(.2+Math.cos(a)*.2),Y(-.15+motion.cylinder*.4+Math.sin(a)*.12),.045*u,.035*u,0,0,7);g.fill();}
      poly([[-.27,-.35],[-.35-motion.hammer*.18,-.6],[-.18,-.52]],'#8f968c');
      poly([[0.4, -0.32], [1.5, -0.32], [1.5, -0.08], [0.4, -0.08]], "#9a8d80", "#eee4d3"); // long barrel
      poly([[-0.3, -0.36], [0.0, -0.36], [0.0, 0.02], [-0.3, 0.02]], "#6f6660");
      g.fillStyle = "#697673"; g.fillRect(Math.min(X(1.45), X(1.6)), Y(-0.32), 0.15 * u, 0.24 * u);
      break;
    }
    case "smg": {
      poly([[-0.9, -0.3], [-0.3, -0.25], [-0.3, 0.0], [-0.9, 0.15]], "#3a3430", "#9a8d80"); // folding stock
      poly([[-0.3, -0.42], [1.0, -0.42], [1.0, 0.08], [-0.3, 0.08]], "#0e0b0a", "#8d9c96"); // receiver (neon edge)
      poly([[0.45, 0.08+mag], [0.7, 0.08+mag], [0.62, 0.95+mag], [0.4, 0.95+mag]], "#1a1614", "#8d9c96"); // long magazine
      poly([[-0.15, 0.08], [0.12, 0.08], [0.02, 0.6], [-0.25, 0.6]], "#1a1614", "#9a8d80"); // grip
      poly([[1.0, -0.3], [1.45, -0.3], [1.45, -0.12], [1.0, -0.12]], "#3a3430"); // barrel
      g.fillStyle = "#697673"; g.fillRect(Math.min(X(1.4), X(1.55)), Y(-0.3), 0.15 * u, 0.18 * u);
      break;
    }
    case "rifle": {
      poly([[-1.2,-.3],[-.25,-.3],[-.25,.05],[-1.2,.28]],"#465344","#9a9b82");
      poly([[-.25,-.4],[1.4,-.4],[1.4,.02],[-.25,.02]],"#303b38","#96a193");
      poly([[.15,mag],[.45,mag],[.52,.6+mag],[.22,.66+mag]],"#252d2b","#7b8274");
      poly([[-.2,0],[.05,0],[-.05,.6],[-.3,.6]],"#374137");
      poly([[1.4,-.3],[2.2,-.3],[2.2,-.14],[1.4,-.14]],"#606b62","#a3aa9c");
      guard(.2,.05,.18,"#9a9b82");break;
    }
    case "shotgun": {
      poly([[-1.3, -0.25], [-0.2, -0.3], [-0.2, 0.05], [-1.3, 0.35]], "#8a4a1c", "#c08040"); // wooden stock
      poly([[-0.2, -0.36], [0.5, -0.36], [0.5, 0.05], [-0.2, 0.05]], "#3a3430", "#9a8d80"); // receiver
      poly([[0.5, -0.34], [2.3, -0.34], [2.3, -0.16], [0.5, -0.16]], "#6f6660", "#eee4d3", 0.05); // barrel
      poly([[0.5, -0.14], [2.0, -0.14], [2.0, 0.0], [0.5, 0.0]], "#3a3430"); // tube
      poly([[0.9-motion.pump*.5, -0.2], [1.55-motion.pump*.5, -0.2], [1.55-motion.pump*.5, 0.12], [0.9-motion.pump*.5, 0.12]], "#b0641c", "#f6b62c", 0.05); // pump
      guard(0.1, 0.05, 0.16, "#9a8d80");
      g.fillStyle = "#697673"; g.fillRect(Math.min(X(2.25), X(2.4)), Y(-0.36), 0.15 * u, 0.22 * u);
      break;
    }
  }
  if(def==='shotgun'&&motion.reload>.1&&motion.reload<.9){const shell=(motion.reload*6)%1;poly([[.15+(1-shell)*.3,.1+(1-shell)*.55],[.43+(1-shell)*.3,.1+(1-shell)*.55],[.43+(1-shell)*.3,.24+(1-shell)*.55],[.15+(1-shell)*.3,.24+(1-shell)*.55]],'#9d4d3f','#c8b27c');}
  if(['rifle','smg','shotgun'].includes(def)){
    poly([[.05,-.34],[.5,-.34],[.5,-.12],[.05,-.12]],'#111817');
    const bolt=slide+(motion.reload>.8?.18*Math.sin((motion.reload-.8)/.2*Math.PI):0);poly([[.3-bolt,-.3],[.52-bolt,-.3],[.52-bolt,-.15],[.3-bolt,-.15]],'#a6ada2');
  }
  poly([[.13,.06],[.18-motion.trigger*.09,.21],[.23,.22],[.24,.07]],'#9a9e92');
  if(def!=='revolver')for(let i=0;i<4;i++){g.strokeStyle='#939b9066';g.lineWidth=.025*u;g.beginPath();g.moveTo(X(-.24+i*.07-slide),Y(-.34));g.lineTo(X(-.24+i*.07-slide),Y(-.08));g.stroke();}

}
