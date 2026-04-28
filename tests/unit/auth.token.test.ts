import { describe, it, expect } from "vitest";
import { isValidToken } from "@/lib/auth/token";

describe("isValidToken", () => {
  it("rejects empty strings", () => {
    expect(isValidToken("", "x".repeat(32))).toBe(false);
  });

  it("rejects mismatched tokens", () => {
    expect(isValidToken("a".repeat(32), "b".repeat(32))).toBe(false);
  });

  it("accepts exact match using constant-time compare", () => {
    expect(isValidToken("a".repeat(32), "a".repeat(32))).toBe(true);
  });

  it("rejects tokens of different length even if prefix matches", () => {
    expect(isValidToken("a".repeat(32), "a".repeat(40))).toBe(false);
  });
});
