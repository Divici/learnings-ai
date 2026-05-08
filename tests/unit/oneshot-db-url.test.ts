import { describe, it, expect } from "vitest";
import { resolveOneShotDatabaseUrl } from "@/lib/db/oneshot-url";

describe("resolveOneShotDatabaseUrl", () => {
  it("prefers DATABASE_URL_UNPOOLED when both are set", () => {
    const url = resolveOneShotDatabaseUrl({
      DATABASE_URL_UNPOOLED: "postgres://proxy.example:5432/db",
      DATABASE_URL: "postgres://internal.example:5432/db",
    });
    expect(url).toBe("postgres://proxy.example:5432/db");
  });

  it("falls back to DATABASE_URL when UNPOOLED is missing", () => {
    const url = resolveOneShotDatabaseUrl({
      DATABASE_URL: "postgres://internal.example:5432/db",
    });
    expect(url).toBe("postgres://internal.example:5432/db");
  });

  it("falls back to DATABASE_URL when UNPOOLED is empty string", () => {
    const url = resolveOneShotDatabaseUrl({
      DATABASE_URL_UNPOOLED: "",
      DATABASE_URL: "postgres://internal.example:5432/db",
    });
    expect(url).toBe("postgres://internal.example:5432/db");
  });

  it("throws when neither is set", () => {
    expect(() => resolveOneShotDatabaseUrl({})).toThrow(
      /DATABASE_URL/,
    );
  });
});
