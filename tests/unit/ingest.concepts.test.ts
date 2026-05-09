import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));

import { extractConcepts, ConceptSchema } from "@/lib/ingest/concepts";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => {
  vi.clearAllMocks();
});

const fakeChunks = [
  { id: "11111111-1111-1111-1111-111111111111", content: "RAG basics", headingPath: ["L1", "Page 1"] },
  { id: "22222222-2222-2222-2222-222222222222", content: "Vector search", headingPath: ["L1", "Page 2"] },
];

describe("extractConcepts", () => {
  it("calls Sonnet once with all chunks and returns parsed concepts", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: {
        concepts: [
          {
            name: "RAG",
            parent_topic: "retrieval",
            canonical_summary: "two-sentence summary here. another sentence.",
            source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          },
        ],
      },
      inputTokens: 1000,
      outputTokens: 200,
      latencyMs: 800,
    });
    const out = await extractConcepts({
      apiKey: "sk-x",
      model: "anthropic/claude-sonnet-4-6",
      chunks: fakeChunks,
    });
    expect(out.concepts).toHaveLength(1);
    expect(out.concepts[0]!.name).toBe("RAG");
    expect(vi.mocked(structuredChat)).toHaveBeenCalledTimes(1);
  });

  it("rejects parent_topic outside the closed set via the Zod schema", () => {
    expect(() =>
      ConceptSchema.parse({
        concepts: [
          {
            name: "X",
            parent_topic: "made-up-topic",
            canonical_summary: "two sentences. yes.",
            source_chunk_ids: [],
          },
        ],
      }),
    ).toThrow();
  });
});
