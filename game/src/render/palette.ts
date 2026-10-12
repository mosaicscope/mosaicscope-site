/** The MosaicScope palette (same tokens as the main site) plus world materials. */
export const INK = "#0e0b0a";
export const PAPER = "#eee4d3";
export const RED = "#ec2a1c";
export const ACID = "#c6ff3d";
export const DIM = "#9a8d80";
export const GOLD = "#f6b62c";
export const PINK = "#ff7ad9";
export const CYAN = "#3dd6ff";

export const GROUND: Record<number, [string, string]> = {
  0: ["#19281b", "#1b2b1d"],   // grass
  1: ["#2b2521", "#2d2723"],   // pave
  2: ["#3a2c22", "#3d2f25"],   // path
  3: ["#33252c", "#36272f"],   // studio floor
  4: ["#1d2a38", "#1f2d3c"],   // court
  5: ["#0f2633", "#123044"],   // water
  10: ["#3a1c2a", "#3d1e2d"],  // stage
  13: ["#141110", "#161312"],  // street
  14: ["#45392b", "#483b2d"],  // sand
  16: ["#1b1918", "#1c1a19"],  // road
  17: ["#34302c", "#36322e"],  // sidewalk
  18: ["#1b1918", "#1c1a19"],  // crosswalk (stripes drawn on top)
  20: ["#222020", "#232121"],  // parking
};
