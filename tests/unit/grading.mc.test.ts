import { describe, it, expect } from "vitest";
import { gradeMc } from "@/lib/grading/mc";

const card = { mcOptions: { options: ["a", "b", "c", "d"], correctIndex: 2 } };

describe("gradeMc", () => {
  it("correct selection → grade 3 (Good), correct=true", () => {
    expect(gradeMc(card, 2)).toEqual({ grade: 3, correct: true });
  });

  it("incorrect selection → grade 1 (Again), correct=false", () => {
    expect(gradeMc(card, 0)).toEqual({ grade: 1, correct: false });
  });

  it("throws if mcOptions missing", () => {
    expect(() => gradeMc({ mcOptions: null as never }, 0)).toThrow(/mc_options/i);
  });

  it("throws if selectedIndex out of bounds", () => {
    expect(() => gradeMc(card, 99)).toThrow(/range/i);
  });
});
