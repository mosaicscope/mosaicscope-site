import { describe, it, expect } from "vitest";
import { Album, ALBUM_MAX, FILTER_IDS, FRAME_IDS, MOMENTS, MomentGate, applyFilter, standing, tiltFor, wallFrameFor, type FilterId } from "../src/content/photos";
import { MemoryStorageProvider } from "../src/persistence/storage";
import { INTERIORS } from "../src/content/interiors";

const shot = (score: number, extra = {}) => ({ kind: "moment" as const, frame: "cream" as const, filter: "none" as const, caption: "x", score, deed: "kiss", img: "data:image/jpeg;base64,AA==", ...extra });

describe("filters", () => {
  const px = () => new Uint8ClampedArray([200, 120, 40, 255, 10, 10, 10, 255]);
  it("none leaves pixels alone, every other filter changes them and keeps alpha", () => {
    const a = px(); applyFilter(a, "none"); expect([...a]).toEqual([...px()]);
    for (const f of FILTER_IDS.filter((f) => f !== "none")) { const d = px(); applyFilter(d, f as FilterId); expect([...d], f).not.toEqual([...px()]); expect(d[3]).toBe(255); expect(d[7]).toBe(255); }
  });
  it("noir is grey", () => { const d = px(); applyFilter(d, "noir"); expect(d[0]).toBe(d[1]); expect(d[1]).toBe(d[2]); });
  it("has five frames", () => expect(FRAME_IDS).toHaveLength(5));
});

describe("album", () => {
  it("round-trips through storage and keeps ids unique", () => {
    const s = new MemoryStorageProvider(), a = new Album(s);
    a.add(shot(5)); a.add(shot(7));
    const b = new Album(s);
    expect(b.shots.map((x) => x.score)).toEqual([5, 7]);
    expect(b.add(shot(1)).id).toBe(3);
  });
  it("ignores a corrupt or hostile save", () => {
    const s = new MemoryStorageProvider(); s.set("mosaics-world:album", "{not json");
    expect(new Album(s).shots).toEqual([]);
    s.set("mosaics-world:album", JSON.stringify([{ id: 1, t: 1, img: "x", caption: "c", score: 1, kind: "photo", frame: "nope", filter: "none", deed: "" }]));
    expect(new Album(s).shots).toEqual([]);
  });
  it("stays within its cap, dropping the weakest oldest first", () => {
    const a = new Album(null);
    for (let i = 0; i < ALBUM_MAX; i++) a.add(shot(i === 3 ? 1 : 5));
    a.add(shot(9));
    expect(a.shots).toHaveLength(ALBUM_MAX);
    expect(a.shots.some((s) => s.score === 1)).toBe(false);
    expect(a.shots[a.shots.length - 1].score).toBe(9);
  });
  it("latest is newest first and best is highest first", () => {
    const a = new Album(null);
    a.add(shot(2, { t: 1 })); a.add(shot(9, { t: 2 })); a.add(shot(9, { t: 3 })); a.add(shot(4, { t: 4 }));
    expect(a.latest(2).map((s) => s.t)).toEqual([4, 3]);
    expect(a.best(3).map((s) => s.t)).toEqual([3, 2, 4]);
  });
  it("clamps scores and caption length", () => {
    const s = new Album(null).add(shot(99, { caption: "y".repeat(100) }));
    expect(s.score).toBe(10); expect(s.caption).toHaveLength(40);
  });
  it("survives a full storage by trimming", () => {
    let writes = 0;
    const full = { get: () => null, set: () => (++writes > 2), remove() {}, keys: () => [] };
    const a = new Album(full); a.add(shot(1)); a.add(shot(2)); a.add(shot(3));
    expect(a.shots.length).toBeGreaterThan(0);
  });
});

describe("moments, standing and walls", () => {
  it("gate spaces moments out and stops repeats of one deed", () => {
    const g = new MomentGate();
    expect(g.allow("kiss", 0)).toBe(true); expect(g.allow("date", 5000)).toBe(false);
    expect(g.allow("date", 20000)).toBe(true); expect(g.allow("kiss", 40000)).toBe(false); expect(g.allow("kiss", 70000)).toBe(true);
  });
  it("every moment scores 1..10 and has a caption", () => {
    for (const [k, m] of Object.entries(MOMENTS)) { expect(m.score, k).toBeGreaterThanOrEqual(1); expect(m.score, k).toBeLessThanOrEqual(10); expect(typeof m.caption("Colombo Street", "Sam"), k).toBe("string"); }
  });
  it("standing climbs with the album", () => {
    const a = new Album(null); expect(standing(a, 0).title).toBe("New in town");
    for (let i = 0; i < 12; i++) a.add(shot(8));
    expect(standing(a, 0).title).toBe("Local legend");
  });
  it("best frame goes to rank 0 and tilt is stable and small", () => {
    expect(wallFrameFor(0)).toBe("gold"); expect(wallFrameFor(7)).toBe("white");
    expect(tiltFor(5)).toBe(tiltFor(5)); expect(Math.abs(tiltFor(77))).toBeLessThanOrEqual(3);
  });
  it("the flat has the reputation wall and the gallery has the spot and the best-moments wall", () => {
    expect(INTERIORS.house!.interactables.some((i) => i.launch === "repwall")).toBe(true);
    const g = INTERIORS.gallery!.interactables.map((i) => i.launch);
    expect(g).toContain("photospot"); expect(g).toContain("gallerywall");
  });
});
