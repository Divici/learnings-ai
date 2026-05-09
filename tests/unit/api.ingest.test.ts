import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/pass1", () => ({ runPass1: vi.fn() }));
vi.mock("@/lib/ingest/pass2", () => ({ runPass2: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: { settings: { findFirst: vi.fn(async () => ({
    modelHaiku: "anthropic/claude-haiku-4-5",
    modelSonnet: "anthropic/claude-sonnet-4-6",
    embeddingModel: "voyageai/voyage-3",
  })) } } },
}));
vi.mock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: "sk-x" } }));
vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/ingest/route";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";
import { env } from "@/lib/env";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ingest", () => {
  it("returns 503 if OPENROUTER_API_KEY missing", async () => {
    const original = env.OPENROUTER_API_KEY;
    (env as any).OPENROUTER_API_KEY = undefined;
    try {
      const res = await POST(new Request("http://x/api/ingest", { method: "POST", body: "{}" }));
      expect(res.status).toBe(503);
    } finally {
      env.OPENROUTER_API_KEY = original;
    }
  });

  it("invokes runPass2 only when pass2Only=true", async () => {
    vi.mocked(runPass2).mockResolvedValueOnce({
      skipped: false,
      conceptCount: 1,
      cardCount: 8,
      disabledCount: 0,
    });
    const res = await POST(
      new Request("http://x/api/ingest", { method: "POST", body: JSON.stringify({ pass2Only: true }) }),
    );
    expect(res.status).toBe(200);
    expect(runPass1).not.toHaveBeenCalled();
    expect(runPass2).toHaveBeenCalled();
  });
});
