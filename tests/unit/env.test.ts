import { describe, it, expect, vi } from "vitest";

describe("env", () => {
  it("throws when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "x".repeat(32));
    await expect(import("@/lib/env?missing-db")).rejects.toThrow(
      /DATABASE_URL/
    );
  });

  it("throws when LEARNINGS_AI_TOKEN is too short", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "short");
    await expect(import("@/lib/env?short-token")).rejects.toThrow(
      /LEARNINGS_AI_TOKEN/
    );
  });

  it("returns parsed env when all required vars are valid", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "x".repeat(32));
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env?valid");
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.LEARNINGS_AI_TOKEN).toHaveLength(32);
  });
});
