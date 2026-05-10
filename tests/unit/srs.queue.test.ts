import { describe, it, expect } from "vitest";
import { interleave, fillNewCards, type QueueCard } from "@/lib/srs/queue";

const card = (id: string, conceptId: string, overdueDays: number): QueueCard => ({
  id,
  conceptId,
  cardType: "mc",
  bucket: overdueDays === 0 ? "today" : overdueDays === 1 ? "yesterday" : "older",
});

describe("interleave", () => {
  it("never places two same-concept cards back-to-back when avoidable", () => {
    const input = [
      card("a1", "concept-A", 0), card("a2", "concept-A", 0), card("a3", "concept-A", 0),
      card("b1", "concept-B", 0), card("b2", "concept-B", 0),
    ];
    const out = interleave(input);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.conceptId).not.toBe(out[i - 1]!.conceptId);
    }
  });

  it("preserves bucket order: today before yesterday before older", () => {
    const input = [
      card("today1", "A", 0),
      card("older1", "B", 5),
      card("yest1", "C", 1),
    ];
    const buckets = interleave(input).map((c) => c.bucket);
    const todayIndex = buckets.indexOf("today");
    const olderIndex = buckets.indexOf("older");
    const yestIndex = buckets.indexOf("yesterday");
    expect(todayIndex).toBeLessThan(yestIndex);
    expect(yestIndex).toBeLessThan(olderIndex);
  });

  it("falls through to back-to-back when only one concept remains", () => {
    const input = [
      card("a1", "A", 0), card("a2", "A", 0), card("a3", "A", 0),
    ];
    const out = interleave(input);
    expect(out).toHaveLength(3);
  });
});

describe("fillNewCards", () => {
  it("returns empty when queue is already at target", () => {
    const queue = Array.from({ length: 10 }, (_, i) => card(`c${i}`, "A", 0));
    const candidates = [card("new1", "A", 0)];
    expect(fillNewCards(queue, candidates, 10)).toEqual([]);
  });

  it("returns enough candidates to reach target", () => {
    const queue = [card("c1", "A", 0), card("c2", "A", 0)];
    const candidates = Array.from({ length: 5 }, (_, i) => card(`n${i}`, "A", 0));
    expect(fillNewCards(queue, candidates, 5)).toHaveLength(3);
  });

  it("prioritizes candidates from concepts with lowest mastery (passed as mastery map)", async () => {
    const { fillNewCardsWithMastery } = await import("@/lib/srs/queue");
    const queue: QueueCard[] = [];
    const candidates = [card("n1", "A", 0), card("n2", "B", 0), card("n3", "C", 0)];
    const mastery = new Map([["A", 0.9], ["B", 0.2], ["C", 0.5]]);
    const out = fillNewCardsWithMastery(queue, candidates, 2, mastery);
    expect(out.map((c) => c.conceptId)).toEqual(["B", "C"]);
  });
});
