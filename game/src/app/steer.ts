/**
 * Walking controls, kept pure so they can be tested.
 * The screen is isometric: screen x = (x - y), screen y = (x + y) / 2, so "up" on the
 * stick or keys (negative screen y) has to mean world (-1, -1): away from the camera.
 */
export interface Vec2 { x: number; y: number }

/** Stick / key direction on the screen (right = +x, down = +y) -> unit-or-shorter world direction. */
export function screenToWorldDir(ix: number, iy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const mag = Math.min(1, Math.hypot(ix, iy));
  const wx = ix + iy, wy = iy - ix, l = Math.hypot(wx, wy);
  if (!l || !mag) { out.x = 0; out.y = 0; return out; }
  out.x = (wx / l) * mag; out.y = (wy / l) * mag;
  return out;
}

const ACCEL = 14;  // 1/s: reach cruising speed in ~150ms instead of snapping
const BRAKE = 24;  // 1/s: stop quicker than you start, so it never feels slippery
const TURN = 20;   // 1/s: reversing direction is a touch snappier than speeding up

/** Ease the current velocity toward the wanted one. dt in seconds. */
export function easeVelocity(v: Vec2, wantX: number, wantY: number, dt: number): void {
  const wantLen = Math.hypot(wantX, wantY), len = Math.hypot(v.x, v.y);
  const dot = len > 1e-6 && wantLen > 1e-6 ? (v.x * wantX + v.y * wantY) / (len * wantLen) : 1;
  const rate = wantLen < 1e-6 ? BRAKE : dot < 0.2 ? TURN : ACCEL;
  const k = 1 - Math.exp(-dt * rate);
  v.x += (wantX - v.x) * k; v.y += (wantY - v.y) * k;
  if (wantLen < 1e-6 && Math.hypot(v.x, v.y) < 0.02) { v.x = 0; v.y = 0; }
}
