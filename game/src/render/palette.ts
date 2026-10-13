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
  0: ["#1f3d1c", "#24481f"],   // grass
  1: ["#2b2521", "#2d2723"],   // pave
  2: ["#5a3d24", "#614428"],   // path
  3: ["#33252c", "#36272f"],   // studio floor
  4: ["#1b3a5c", "#1f4670"],   // court
  5: ["#0a3d5c", "#0d4d72"],   // water
  10: ["#5c1638", "#6e1b43"],  // stage
  13: ["#141110", "#161312"],  // street
  14: ["#8a6a3a", "#937244"],  // sand
  16: ["#1b1918", "#1c1a19"],  // road
  17: ["#4a4238", "#524a40"],  // sidewalk
  18: ["#1b1918", "#1c1a19"],  // crosswalk (stripes drawn on top)
  20: ["#222020", "#232121"],  // parking
};
