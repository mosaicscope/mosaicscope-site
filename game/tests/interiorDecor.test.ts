import { describe, it, expect } from "vitest";
import { INTERIORS, PROP_INFO, type InteriorDef } from "../src/content/interiors";
import { wallSconces, wallPictures } from "../src/render/interiorDecor";

const defs = Object.entries(INTERIORS) as [string, InteriorDef][];

describe("interior wall decor", () => {
  it("has interiors to decorate", () => { expect(defs.length).toBeGreaterThan(5); });
  it("is deterministic", () => {
    for (const [, d] of defs) { expect(wallSconces(d)).toEqual(wallSconces(d)); expect(wallPictures(d)).toEqual(wallPictures(d)); }
  });
  it("stays on the wall and never covers a wall prop or the doorway", () => {
    for (const [k, d] of defs) {
      const spots = [...wallSconces(d), ...wallPictures(d)];
      for (const s of spots) {
        const wallLen = s.side === "n" ? d.size.w : d.size.h;
        expect(s.at, k).toBeGreaterThan(0); expect(s.at + s.len, k).toBeLessThan(wallLen);
        for (const p of d.props) {
          if (!PROP_INFO[p.type].wall) continue;
          const onWall = s.side === "n" ? p.y === 0 : p.x === 0; if (!onWall) continue;
          const a = s.side === "n" ? p.x : p.y, b = a + (s.side === "n" ? p.w : p.h);
          expect(s.at + s.len <= a || s.at >= b, `${k} ${s.side} ${s.at}`).toBe(true);
        }
        if (s.side === "w") expect(s.at + s.len <= d.door.y - 1 || s.at >= d.door.y + 1, `${k} door`).toBe(true);
      }
    }
  });
  it("never puts a lamp and a picture in the same place", () => {
    for (const [, d] of defs) for (const l of wallSconces(d)) for (const p of wallPictures(d)) if (l.side === p.side) expect(l.at + l.len <= p.at || p.at + p.len <= l.at).toBe(true);
  });
});
