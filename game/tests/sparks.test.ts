import { describe, it, expect } from "vitest";
import { crossedGolden, goldenEnvelope, goldenTimeScale, GOLDEN, GOLDEN_LEN, nextStreak, streakGlow, isStreakGiftDay, streakLine, dayKey } from "../src/app/sparks";

describe("golden minute", () => {
  it("fires once as the clock crosses 18:00, never across midnight", () => {
    expect(crossedGolden(17.99, 18.01)).toBe(true);
    expect(crossedGolden(18.01, 18.02)).toBe(false);
    expect(crossedGolden(23.9, 0.1)).toBe(false);
    expect(crossedGolden(17, 19)).toBe(false);
  });
  it("eases to the floor and back with no jumps", () => {
    expect(goldenTimeScale(0)).toBe(1);
    expect(goldenTimeScale(GOLDEN.easeIn + 1)).toBeCloseTo(GOLDEN.floor);
    expect(goldenTimeScale(GOLDEN_LEN)).toBe(1);
    let prev = 1;
    for (let t = 0; t <= GOLDEN_LEN; t += 0.02) { const s = goldenTimeScale(t); expect(Math.abs(s - prev)).toBeLessThan(0.03); expect(s).toBeGreaterThanOrEqual(GOLDEN.floor - 1e-9); prev = s; }
    expect(goldenEnvelope(-1)).toBe(0);
  });
});

describe("play streak", () => {
  it("starts at 1, holds within a day, grows on consecutive days, resets on a gap", () => {
    let r = nextStreak(null, "2026-10-13");
    expect(r.streak).toEqual({ last: "2026-10-13", count: 1, best: 1 });
    r = nextStreak(r.streak, "2026-10-13"); expect(r.changed).toBe(false);
    r = nextStreak(r.streak, "2026-10-14"); expect(r.streak.count).toBe(2);
    r = nextStreak(r.streak, "2026-10-15"); expect(r.streak.count).toBe(3);
    r = nextStreak(r.streak, "2026-10-18"); expect(r.streak.count).toBe(1); expect(r.streak.best).toBe(3);
  });
  it("counts across month and year ends and survives junk saves", () => {
    expect(nextStreak({ last: "2026-12-31", count: 4, best: 4 }, "2027-01-01").streak.count).toBe(5);
    expect(nextStreak({ last: "garbage", count: 9, best: 9 }, "2026-10-13").streak.count).toBe(1);
    expect(nextStreak({ last: "2026-10-13", count: NaN, best: 0 }, "2026-10-14").streak.count).toBe(1);
  });
  it("glows from nothing at day 1 to full at day 7, gifts on 7 and 14", () => {
    expect([1, 4, 7, 20].map(streakGlow)).toEqual([0, 0.5, 1, 1]);
    expect([6, 7, 8, 14].map(isStreakGiftDay)).toEqual([false, true, false, true]);
    expect(streakLine(1)).toBe("");
    expect(streakLine(7)).toContain("$77");
    expect(dayKey(new Date(2026, 9, 3))).toBe("2026-10-03");
  });
});
