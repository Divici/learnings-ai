import { describe, it, expect, vi, beforeEach } from "vitest";

const valuesSpy = vi.fn(() => Promise.resolve());
vi.mock("@/lib/db", () => ({
  db: { insert: vi.fn(() => ({ values: valuesSpy })) },
}));

vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { chatCompletion, embed } from "@/lib/llm/client";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  valuesSpy.mockClear();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("chatCompletion", () => {
  it("returns content and logs an llm_calls row on success", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "the answer" } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    );
    const out = await chatCompletion({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      module: "test.unit",
      fetchImpl,
    });
    expect(out.content).toBe("the answer");
    expect(out.inputTokens).toBe(100);
    expect(out.outputTokens).toBe(20);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", error: null }),
    );
  });

  it("retries 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      );
    const out = await chatCompletion({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      module: "test.retry",
      fetchImpl,
      backoffMs: 1, // shrink delays for tests
    });
    expect(out.content).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "retry" }),
    );
  });

  it("throws after 3 failures and logs status=failed", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(
      chatCompletion({
        apiKey: "sk-x",
        model: "anthropic/claude-haiku-4-5",
        messages: [{ role: "user", content: "hi" }],
        module: "test.fail",
        fetchImpl,
        backoffMs: 1,
      }),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(db.insert).toHaveBeenCalledTimes(1); // failure row written once
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    const firstCall = valuesSpy.mock.calls.at(0);
    const calledWith = firstCall?.at(0) as { error: string } | undefined;
    expect(typeof calledWith?.error).toBe("string");
    expect(calledWith?.error?.length).toBeGreaterThan(0);
  });

  it("does not retry on 401 unauthorized", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad key" }, 401));
    await expect(
      chatCompletion({
        apiKey: "sk-x",
        model: "anthropic/claude-haiku-4-5",
        messages: [{ role: "user", content: "hi" }],
        module: "test.401",
        fetchImpl,
        backoffMs: 1,
      }),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("retries when fetch throws (network error)", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      );
    const out = await chatCompletion({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      module: "test.netfail",
      fetchImpl,
      backoffMs: 1,
    });
    expect(out.content).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("embed", () => {
  it("returns embeddings and logs the row", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { embedding: new Array(1024).fill(0.01) },
          { embedding: new Array(1024).fill(0.02) },
        ],
        usage: { prompt_tokens: 50, total_tokens: 50 },
      }),
    );
    const out = await embed({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      input: ["hello", "world"],
      module: "test.embed",
      fetchImpl,
    });
    expect(out.vectors).toHaveLength(2);
    expect(out.vectors[0]).toHaveLength(1024);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
