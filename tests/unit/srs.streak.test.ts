import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/srs/streak";

const day = (offsetDays: number, base: Date = new Date("2026-05-10T12:00:00Z")) =>
  new Date(base.getTime() - offsetDays * 86_400_000);

describe("computeStreak", () => {
  it("returns 0 when there are no attempts", () => {
    expect(computeStreak([], new Date("2026-05-10T12:00:00Z"))).toBe(0);
  });

  it("returns 1 when only today has an attempt", () => {
    expect(computeStreak([day(0)], new Date("2026-05-10T12:00:00Z"))).toBe(1);
  });

  it("returns N for N consecutive days ending today", () => {
    const dates = [day(0), day(1), day(2), day(3)];
    expect(computeStreak(dates, new Date("2026-05-10T12:00:00Z"))).toBe(4);
  });

  it("breaks at the first gap going back from today", () => {
    const dates = [day(0), day(1), day(3)]; // gap on day 2
    expect(computeStreak(dates, new Date("2026-05-10T12:00:00Z"))).toBe(2);
  });

  it("returns 0 if the most-recent attempt was 2+ days ago", () => {
    const dates = [day(2), day(3)];
    expect(computeStreak(dates, new Date("2026-05-10T12:00:00Z"))).toBe(0);
  });

  it("counts multiple attempts on the same day as one", () => {
    const dates = [day(0), day(0), day(0), day(1)];
    expect(computeStreak(dates, new Date("2026-05-10T12:00:00Z"))).toBe(2);
  });
});
