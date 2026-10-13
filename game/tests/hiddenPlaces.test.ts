import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import {
  placeHidden, hiddenSpots, stationAreas, STATIONS, glitchOpen, glitchVisit, GLITCH_COUNT, mossCover, panelCount, MAX_PANELS, pickGardenBuilding, nearestSpot, spotLive, dayOf,
} from "../src/content/hiddenPlaces";

const sim = small(5);
const w = sim.world;

describe("hidden places", () => {
  it("places every secret on walkable ground, deterministically", () => {
    const a = placeHidden(w), b = placeHidden(w);
    expect(b).toEqual(a);
    for (const s of a) expect(w.walkable(s.x, s.y), `${s.id} ${s.station ?? ""}`).toBe(true);
    for (const id of ["ladder", "subway", "glitch", "neon"]) expect(a.filter((s) => s.id === id)).toHaveLength(1);
    expect(a.filter((s) => s.id === "station")).toHaveLength(STATIONS.length);
  });
  it("gives each station its own area and the spots don't overlap", () => {
    const areas = stationAreas(w);
    expect(new Set(areas.map((x) => x.id)).size).toBe(STATIONS.length);
    const spots = hiddenSpots(w);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y), `${spots[i].id}/${spots[j].id}`).toBeGreaterThan(1);
  });
  it("keeps secrets out of the way of the spawn point and the shop doors", () => {
    const p = sim.player;
    for (const s of hiddenSpots(w)) expect(Math.hypot(s.x - p.x, s.y - p.y), s.id).toBeGreaterThan(4);
  });
  it("puts the ladder on the south wall of a tall flat-roofed building", () => {
    const b = pickGardenBuilding(w)!, l = hiddenSpots(w).find((s) => s.id === "ladder")!;
    expect(["apartments", "office", "hotel", "bank"]).toContain(b.kind);
    expect(l.building).toBe(b.id);
    expect(Math.abs(l.y - (b.y1 + 1.5))).toBeLessThan(3);
  });
  it("opens the glitch alley at 3:33 and not before", () => {
    expect(glitchOpen(3.5)).toBe(false);
    expect(glitchOpen(3 + 33 / 60)).toBe(true);
    expect(glitchOpen(4)).toBe(true);
    expect(glitchOpen(4.2)).toBe(false);
    expect(glitchOpen(15)).toBe(false);
    const g = hiddenSpots(w).find((s) => s.id === "glitch")!;
    expect(spotLive(g, 12)).toBe(false);
    expect(spotLive(g, 3.7)).toBe(true);
    expect(nearestSpot(w, g.x, g.y, 12)).toBeNull();
    expect(nearestSpot(w, g.x, g.y, 3.7)?.id).toBe("glitch");
  });
  it("shows something different on every consecutive glitch visit", () => {
    for (let day = 0; day < 6; day++) for (let n = 0; n < GLITCH_COUNT * 2; n++) expect(glitchVisit(day, n).title).not.toBe(glitchVisit(day, n + 1).title);
  });
  it("lets the moss and graffiti grow with the days, then stop", () => {
    expect(mossCover(0)).toBe(0);
    for (let d = 0; d < 30; d++) { expect(mossCover(d + 1)).toBeGreaterThanOrEqual(mossCover(d)); expect(panelCount(d + 1)).toBeGreaterThanOrEqual(panelCount(d)); }
    expect(mossCover(99)).toBe(1);
    expect(panelCount(99, 5)).toBe(MAX_PANELS);
    expect(panelCount(0)).toBe(1);
    expect(panelCount(4, 2)).toBe(5);
  });
  it("counts game days from the start hour", () => {
    expect(dayOf(8, 0, 3600)).toBe(0);
    expect(dayOf(8, 16 * 3600, 3600)).toBe(1);
  });
});
