/**
 * Thirty burlesque dance moves for the Pink Pukeko's dancers. Each is a few oscillators laid over a relaxed stance:
 * [joint, amplitude, speed, phase], with the joints in the order the stage figures use
 * (0/1 left shoulder and elbow, 2/3 right shoulder and elbow, 4/5 left hip and knee, 6/7 right hip and knee, 8 lean, 9 hop).
 * Teasing and theatrical, all clothed; nothing explicit.
 */
export interface Move { name: string; o: [number, number, number, number][] }
const P = Math.PI;
export const MOVES: Move[] = [
  { name: "Hip roll", o: [[8, 0.35, 3, 0], [4, 0.3, 3, 0], [6, 0.3, 3, P]] },
  { name: "Shimmy", o: [[0, 0.5, 12, 0], [2, 0.5, 12, P], [8, 0.1, 12, 0]] },
  { name: "Hair flip", o: [[0, 2.2, 2, 0], [1, 0.8, 2, 0.5], [8, 0.2, 2, 1]] },
  { name: "Slow grind", o: [[8, 0.45, 2, 0], [9, 3, 2, 0]] },
  { name: "Strut", o: [[4, 0.5, 4, 0], [6, 0.5, 4, P], [9, 2, 8, 0]] },
  { name: "Boa drag", o: [[0, 1.6, 1.2, 0], [2, -1.6, 1.2, 0.4], [8, 0.15, 1.2, 0]] },
  { name: "High kick", o: [[4, 1.3, 2.5, 0], [8, -0.2, 2.5, 0], [9, 2, 5, 0]] },
  { name: "Twirl", o: [[8, 0.5, 6, 0], [0, 2, 3, 0], [2, 2, 3, P]] },
  { name: "Bend and snap", o: [[8, 0.9, 2, 0], [9, 2, 4, 0], [0, 1, 2, 0]] },
  { name: "Lean back", o: [[8, -0.7, 1.5, 0], [0, 1.2, 1.5, 0], [2, 1.2, 1.5, 0]] },
  { name: "Pout and pose", o: [[0, 1.4, 0.8, 0], [2, 0.6, 0.8, 0], [8, 0.12, 0.8, 0]] },
  { name: "Blow a kiss", o: [[2, 1.9, 1.6, 0], [3, 1.2, 1.6, 0.6], [8, 0.1, 1.6, 0]] },
  { name: "Wink and sway", o: [[8, 0.25, 2, 0], [0, 0.8, 2, P / 2], [2, 0.8, 2, -P / 2]] },
  { name: "Shoulder roll", o: [[0, 1, 2.5, 0], [2, 1, 2.5, P], [8, 0.15, 2.5, 0]] },
  { name: "Pop and lock", o: [[9, 3, 6, 0], [8, 0.2, 6, 0], [0, 0.6, 6, 0], [2, 0.6, 6, P]] },
  { name: "Figure eight", o: [[8, 0.4, 3, 0], [4, 0.35, 6, 0], [6, 0.35, 6, P], [9, 1.5, 6, 0]] },
  { name: "Cat crawl", o: [[8, 0.95, 1.2, 0], [0, 0.7, 2.4, 0], [2, 0.7, 2.4, P], [4, 0.4, 2.4, P], [6, 0.4, 2.4, 0]] },
  { name: "Floor roll", o: [[8, 1.5, 1, 0], [9, -2, 1, 0], [4, 0.8, 2, 0], [6, 0.8, 2, P]] },
  { name: "Back arch", o: [[8, -0.55, 1.8, 0], [0, 1.8, 1.8, 0], [2, 1.8, 1.8, 0.3]] },
  { name: "Knee drop", o: [[5, 1.1, 1.4, 0], [7, 1.1, 1.4, 0], [9, -3, 1.4, 0], [8, 0.2, 1.4, 0]] },
  { name: "Thigh slide", o: [[4, 0.6, 2.2, 0], [5, 0.5, 2.2, 0], [0, 0.8, 2.2, 0]] },
  { name: "Come hither", o: [[2, 1.5, 2.2, 0], [3, 1.4, 2.2, 0.7], [8, 0.12, 2.2, 0]] },
  { name: "Over the shoulder", o: [[8, 0.3, 1.1, 0], [0, 1.1, 1.1, 0], [2, 0.3, 1.1, 0]] },
  { name: "Cross walk", o: [[4, 0.55, 3.2, 0], [6, 0.55, 3.2, P], [8, 0.2, 3.2, 0], [9, 1.5, 6.4, 0]] },
  { name: "Dip", o: [[9, -3, 1.6, 0], [4, 0.5, 1.6, 0], [6, 0.5, 1.6, 0], [8, 0.4, 1.6, 0]] },
  { name: "Hip bump", o: [[8, 0.3, 4, 0], [4, 0.2, 4, 0], [9, 1.5, 8, 0]] },
  { name: "Fan tease", o: [[0, 1.6, 2.6, 0], [2, 1.6, 2.6, P], [1, 0.6, 2.6, 0], [3, 0.6, 2.6, P]] },
  { name: "Slow spin", o: [[8, 0.35, 1.6, 0], [0, 1.3, 1.6, 0], [2, 1.3, 1.6, P / 2], [9, 1, 3.2, 0]] },
  { name: "Sultry sway", o: [[8, 0.3, 1.3, 0], [4, 0.25, 1.3, 0], [6, 0.25, 1.3, P], [0, 0.5, 1.3, 0]] },
  { name: "Bounce", o: [[9, 3.5, 5, 0], [0, 0.8, 5, 0], [2, 0.8, 5, P], [8, 0.08, 5, 0]] },
];
export function evalMove(m: Move, t: number, base: readonly number[]): number[] {
  const p = base.slice();
  for (const [j, amp, freq, ph] of m.o) p[j] += amp * Math.sin(t * freq + ph);
  return p;
}
