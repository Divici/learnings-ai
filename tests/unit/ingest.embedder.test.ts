import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/client", () => ({
  embed: vi.fn(),
}));

import { embedChunks } from "@/lib/ingest/embedder";
import { embed } from "@/lib/llm/client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("embedChunks", () => {
  it("batches inputs in groups of 32", async () => {
    vi.mocked(embed).mockImplementation(async ({ input }) => ({
      vectors: input.map(() => new Array(1024).fill(0.01)),
      inputTokens: input.length * 10,
      latencyMs: 50,
    }));
    const chunks = Array.from({ length: 70 }, (_, i) => `chunk ${i}`);
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts: chunks,
    });
    expect(result.vectors).toHaveLength(70);
    expect(vi.mocked(embed)).toHaveBeenCalledTimes(3); // 32 + 32 + 6
  });

  it("returns empty array for empty input without calling the api", async () => {
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts: [],
    });
    expect(result.vectors).toEqual([]);
    expect(vi.mocked(embed)).not.toHaveBeenCalled();
  });

  it("preserves vector ordering across batches", async () => {
    vi.mocked(embed).mockImplementation(async ({ input }) => ({
      vectors: input.map((t) => new Array(1024).fill(parseFloat(t))),
      inputTokens: 1,
      latencyMs: 1,
    }));
    const texts = ["1", "2", "3", "4"];
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts,
    });
    expect(result.vectors[0]![0]).toBeCloseTo(1.0);
    expect(result.vectors[3]![0]).toBeCloseTo(4.0);
  });
});
