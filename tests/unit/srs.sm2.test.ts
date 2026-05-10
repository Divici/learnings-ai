import { describe, it, expect } from "vitest";
import { nextReview, type ReviewState } from "@/lib/srs/sm2";

const initial: ReviewState = { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };

describe("nextReview", () => {
  it("Again (1) resets interval, increments lapses, drops ease 0.20", () => {
    const out = nextReview({ ease: 2.5, intervalDays: 6, repetitions: 3, lapses: 1 }, 1);
    expect(out.intervalDays).toBe(0);
    expect(out.repetitions).toBe(0);
    expect(out.lapses).toBe(2);
    expect(out.ease).toBeCloseTo(2.30, 2);
  });

  it("Hard (2) multiplies interval by 1.2, drops ease 0.15", () => {
    const out = nextReview({ ease: 2.5, intervalDays: 10, repetitions: 2, lapses: 0 }, 2);
    expect(out.intervalDays).toBeCloseTo(12, 2);
    expect(out.repetitions).toBe(3);
    expect(out.ease).toBeCloseTo(2.35, 2);
  });

  it("Good (3) on first repetition → 1 day", () => {
    const out = nextReview(initial, 3);
    expect(out.intervalDays).toBe(1);
    expect(out.repetitions).toBe(1);
    expect(out.ease).toBeCloseTo(2.5, 2);
  });

  it("Good (3) on second repetition → 6 days", () => {
    const out = nextReview({ ease: 2.5, intervalDays: 1, repetitions: 1, lapses: 0 }, 3);
    expect(out.intervalDays).toBe(6);
  });

  it("Good (3) after second repetition → interval * ease", () => {
    const out = nextReview({ ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 }, 3);
    expect(out.intervalDays).toBeCloseTo(15, 2);
  });

  it("Easy (4) bumps ease 0.15 and multiplies by ease*1.3", () => {
    const out = nextReview({ ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 }, 4);
    expect(out.ease).toBeCloseTo(2.65, 2);
    expect(out.intervalDays).toBeCloseTo(6 * 2.65 * 1.3, 1);
  });

  it("ease floors at 1.30", () => {
    const out = nextReview({ ease: 1.4, intervalDays: 5, repetitions: 4, lapses: 0 }, 1);
    expect(out.ease).toBe(1.3);
  });

  it("interval caps at 365 days", () => {
    const out = nextReview({ ease: 3.0, intervalDays: 200, repetitions: 5, lapses: 0 }, 4);
    expect(out.intervalDays).toBeLessThanOrEqual(365);
  });
});

describe("computeDueAt", () => {
  it("returns now + intervalDays * 1 day with ±10% jitter", async () => {
    const { computeDueAt } = await import("@/lib/srs/sm2");
    const base = new Date("2026-05-01T00:00:00Z").getTime();
    const due = computeDueAt(10, base, () => 0.5);  // 0.5 → middle of jitter range
    const expected = base + 10 * 86400 * 1000;
    expect(due.getTime()).toBe(expected); // mid-jitter = no shift
  });

  it("jitter at edges scales by ±10%", async () => {
    const { computeDueAt } = await import("@/lib/srs/sm2");
    const base = new Date("2026-05-01T00:00:00Z").getTime();
    const dueLow = computeDueAt(10, base, () => 0).getTime();
    const dueHigh = computeDueAt(10, base, () => 1).getTime();
    const ten = 10 * 86400 * 1000;
    expect(dueLow).toBeCloseTo(base + ten * 0.9, -3);
    expect(dueHigh).toBeCloseTo(base + ten * 1.1, -3);
  });
});
