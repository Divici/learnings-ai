import { describe, it, expect } from "vitest";
import { gradeCloze, levenshtein } from "@/lib/grading/cloze";

const card = { clozeAnswers: ["embedding", "vector"] };

describe("levenshtein", () => {
  it("0 for identical", () => expect(levenshtein("abc", "abc")).toBe(0));
  it("1 for single substitution", () => expect(levenshtein("abc", "abd")).toBe(1));
  it("counts insertions and deletions", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("gradeCloze", () => {
  it("exact match all blanks → grade 3", () => {
    expect(gradeCloze(card, ["embedding", "vector"])).toEqual({
      grade: 3,
      correct: true,
      perBlank: [
        { user: "embedding", canonical: "embedding", correct: true, distance: 0 },
        { user: "vector", canonical: "vector", correct: true, distance: 0 },
      ],
    });
  });

  it("case-insensitive + whitespace-trimmed matches", () => {
    const out = gradeCloze(card, ["  EMBEDDING  ", "Vector"]);
    expect(out.grade).toBe(3);
    expect(out.correct).toBe(true);
  });

  it("typo within Levenshtein ≤ 2 counts as correct", () => {
    const out = gradeCloze(card, ["embeding", "vector"]);
    expect(out.grade).toBe(3);
    expect(out.perBlank[0]!.correct).toBe(true);
    expect(out.perBlank[0]!.distance).toBe(1);
  });

  it("typo > Levenshtein 2 counts as wrong", () => {
    const out = gradeCloze(card, ["xyzqr", "vector"]);
    expect(out.grade).toBe(1);
    expect(out.correct).toBe(false);
  });

  it("any wrong → grade 1", () => {
    const out = gradeCloze(card, ["embedding", "wrong"]);
    expect(out.grade).toBe(1);
    expect(out.correct).toBe(false);
  });

  it("input length mismatch throws", () => {
    expect(() => gradeCloze(card, ["one"])).toThrow(/blank count/i);
  });
});
