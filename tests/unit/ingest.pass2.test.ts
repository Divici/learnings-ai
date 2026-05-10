import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/concepts", () => ({ extractConcepts: vi.fn() }));
vi.mock("@/lib/ingest/cardGen", () => ({ generateCards: vi.fn() }));

import { runPass2 } from "@/lib/ingest/pass2";
import { extractConcepts } from "@/lib/ingest/concepts";
import { generateCards } from "@/lib/ingest/cardGen";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeDb(opts: {
  signature: string | null;
  chunks: Array<{ id: string; content: string }>;
}) {
  const updateChain: any = { set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) };
  const insertChain: any = {
    values: vi.fn(() => insertChain),
    onConflictDoUpdate: vi.fn(() => insertChain),
    onConflictDoNothing: vi.fn(() => insertChain),
    returning: vi.fn(async () => [{ id: "concept-1", name: "RAG" }]),
  };
  return {
    update: vi.fn(() => updateChain),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    query: {
      settings: { findFirst: vi.fn(async () => ({ id: 1, corpusSignature: opts.signature })) },
      sourceChunks: { findMany: vi.fn(async () => opts.chunks) },
      concepts: { findMany: vi.fn(async () => []) },
      cards: { findMany: vi.fn(async () => []) },
    },
    execute: vi.fn(async () => undefined),
  } as never;
}

describe("runPass2", () => {
  it("skips when signature matches", async () => {
    const db = makeDb({
      signature: "abc",
      chunks: [{ id: "11111111-1111-1111-1111-111111111111", content: "x" }],
    });
    const out = await runPass2({
      apiKey: "sk-x",
      sonnetModel: "anthropic/claude-sonnet-4-6",
      haikuModel: "anthropic/claude-haiku-4-5",
      db,
      forceSignature: "abc",
    });
    expect(out.skipped).toBe(true);
    expect(extractConcepts).not.toHaveBeenCalled();
  });

  it("runs full pipeline when signature differs", async () => {
    const db = makeDb({
      signature: null,
      chunks: [{ id: "11111111-1111-1111-1111-111111111111", content: "x" }],
    });
    vi.mocked(extractConcepts).mockResolvedValueOnce({
      concepts: [
        {
          name: "RAG",
          parent_topic: "retrieval",
          canonical_summary: "two sentences. yes.",
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
        },
      ],
    });
    vi.mocked(generateCards).mockResolvedValueOnce({
      cards: [
        {
          cardType: "mc",
          prompt: "p",
          canonicalAnswer: "a",
          explanation: "e",
          difficulty: 2,
          sourceChunkIds: ["11111111-1111-1111-1111-111111111111"],
          mcOptions: { options: ["a", "b", "c", "d"], correctIndex: 0 },
          clozeAnswers: null,
          rubric: null,
        },
      ],
    });
    const out = await runPass2({
      apiKey: "sk-x",
      sonnetModel: "anthropic/claude-sonnet-4-6",
      haikuModel: "anthropic/claude-haiku-4-5",
      db,
    });
    expect(out.skipped).toBe(false);
    if (!out.skipped) {
      expect(out.conceptCount).toBe(1);
      expect(out.cardCount).toBe(1);
    }
  });
});
