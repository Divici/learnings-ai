import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({
  structuredChat: vi.fn(),
}));

import { tagChunks, ALLOWED_TAGS } from "@/lib/ingest/topicTagger";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagChunks", () => {
  it("calls the LLM in batches of 10", async () => {
    vi.mocked(structuredChat).mockImplementation(async ({ userPrompt }) => {
      const count = (userPrompt.match(/^- /gm) ?? []).length;
      return {
        value: { tags: Array.from({ length: count }, () => ["rag"]) },
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
      };
    });
    const chunks = Array.from({ length: 25 }, (_, i) => `chunk ${i} content`);
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: chunks,
    });
    expect(result.tags).toHaveLength(25);
    expect(vi.mocked(structuredChat)).toHaveBeenCalledTimes(3); // 10 + 10 + 5
  });

  it("filters out tags not in the allowed list", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { tags: [["rag", "made_up_tag", "agents"]] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: ["one chunk"],
    });
    expect(result.tags[0]).toEqual(["rag", "agents"]);
  });

  it("caps tags per chunk at 3", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { tags: [["rag", "agents", "embeddings", "evals", "fusion"]] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: ["one chunk"],
    });
    expect(result.tags[0]).toHaveLength(3);
  });

  it("returns empty array for empty input", async () => {
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: [],
    });
    expect(result.tags).toEqual([]);
    expect(vi.mocked(structuredChat)).not.toHaveBeenCalled();
  });
});

it("ALLOWED_TAGS exports the closed list of 15 tags", () => {
  expect(ALLOWED_TAGS).toContain("rag");
  expect(ALLOWED_TAGS.length).toBe(15);
});
