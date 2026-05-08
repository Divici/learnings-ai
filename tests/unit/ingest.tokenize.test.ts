import { describe, it, expect } from "vitest";
import { countTokens } from "@/lib/ingest/tokenize";

describe("countTokens", () => {
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("returns positive integer for non-empty english text", () => {
    const n = countTokens("hello world from a unit test");
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("scales roughly linearly with content size", () => {
    const small = countTokens("the cat sat on the mat");
    const big = countTokens("the cat sat on the mat ".repeat(20));
    expect(big).toBeGreaterThan(small * 15);
  });
});
