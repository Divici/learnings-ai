import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/llm/client", () => ({
  chatCompletion: vi.fn(),
}));

import { structuredChat } from "@/lib/llm/structured";
import { chatCompletion } from "@/lib/llm/client";

const Schema = z.object({ tags: z.array(z.string()).max(3) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("structuredChat", () => {
  it("validates the parsed JSON against the Zod schema", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '{"tags": ["a", "b"]}',
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
    });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["a", "b"] });
  });

  it("retries once on parse failure with a corrective system message", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({
        content: "not even json",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
      })
      .mockResolvedValueOnce({
        content: '{"tags": ["a"]}',
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
      });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["a"] });
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(chatCompletion).mock.calls;
    const secondCall = calls[1]?.[0];
    expect(secondCall).toBeDefined();
    const secondMessages = secondCall!.messages;
    const lastMessage = secondMessages.at(-1);
    expect(lastMessage?.role).toBe("user");
    expect(lastMessage?.content).toMatch(/could not be parsed/);
    expect(lastMessage?.content).toMatch(/Reply with ONLY the corrected JSON/);
  });

  it("strips markdown fence delimiters even when the closing fence is missing", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '```json\n{"tags": ["a", "b"]}',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["a", "b"] });
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(1);
  });

  it("strips markdown fence delimiters when both ends are fenced", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '```json\n{"tags": ["c"]}\n```',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["c"] });
  });

  it("throws after one failed retry", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "still not json",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await expect(
      structuredChat({
        apiKey: "sk-x",
        model: "anthropic/claude-haiku-4-5",
        module: "test",
        systemPrompt: "you return json",
        userPrompt: "go",
        schema: Schema,
      }),
    ).rejects.toThrow(/structured-output failed after retry \(module=test\): attempt1=.+; attempt2=.+/);
  });
});
