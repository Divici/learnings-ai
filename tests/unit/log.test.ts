import { describe, it, expect, beforeEach, vi } from "vitest";

describe("log", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "x".repeat(32));
    vi.stubEnv("NODE_ENV", "test");
  });

  it("redacts authorization headers", async () => {
    const { redactionPaths } = await import("@/lib/log");
    expect(redactionPaths).toContain("req.headers.authorization");
    expect(redactionPaths).toContain("req.headers.cookie");
    expect(redactionPaths).toContain("*.LEARNINGS_AI_TOKEN");
    expect(redactionPaths).toContain("*.OPENROUTER_API_KEY");
  });

  it("exposes a child logger factory", async () => {
    const { log } = await import("@/lib/log");
    const child = log.child({ module: "test" });
    expect(typeof child.info).toBe("function");
    expect(typeof child.warn).toBe("function");
    expect(typeof child.error).toBe("function");
  });
});
