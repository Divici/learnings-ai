import { describe, it, expect } from "vitest";
import { computeMastery, type ConceptStats } from "@/lib/srs/mastery";

describe("computeMastery", () => {
  it("0 mastery for empty concept (no cards reviewed)", () => {
    const stats: ConceptStats = { cardCount: 0, avgEase: 0, totalLapses: 0 };
    expect(computeMastery(stats)).toBe(0);
  });

  it("returns ~0.5 mid-range with no lapses (ease 2.15)", () => {
    const stats: ConceptStats = { cardCount: 5, avgEase: 2.15, totalLapses: 0 };
    expect(computeMastery(stats)).toBeCloseTo(0.5, 2);
  });

  it("returns 1.0 at perfect ease 3.0 with no lapses", () => {
    const stats: ConceptStats = { cardCount: 5, avgEase: 3.0, totalLapses: 0 };
    expect(computeMastery(stats)).toBeCloseTo(1.0, 2);
  });

  it("returns 0 at floor ease 1.3 regardless of lapses", () => {
    const stats: ConceptStats = { cardCount: 5, avgEase: 1.3, totalLapses: 0 };
    expect(computeMastery(stats)).toBe(0);
  });

  it("lapses_factor caps at 0.5 (halves mastery max)", () => {
    const stats: ConceptStats = { cardCount: 5, avgEase: 3.0, totalLapses: 100 };
    expect(computeMastery(stats)).toBeCloseTo(0.5, 2);
  });

  it("partial lapses scale linearly within cap", () => {
    const stats: ConceptStats = { cardCount: 10, avgEase: 3.0, totalLapses: 2 };
    expect(computeMastery(stats)).toBeCloseTo(0.8, 2);
  });
});
