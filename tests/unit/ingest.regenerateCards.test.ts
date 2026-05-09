import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/concepts", () => ({ extractConcepts: vi.fn() }));
vi.mock("@/lib/ingest/cardGen", () => ({ generateCards: vi.fn() }));

import { regenerateCards } from "@/lib/ingest/pass2";
import { generateCards } from "@/lib/ingest/cardGen";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("regenerateCards", () => {
  it("disables existing cards then inserts new ones for the concept", async () => {
    const updateChain: any = { set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) };
    const insertChain: any = { values: vi.fn(async () => undefined) };
    const updateSpy = vi.fn(() => updateChain);
    const insertSpy = vi.fn(() => insertChain);
    const dbMock = {
      query: {
        concepts: {
          findFirst: vi.fn(async () => ({
            id: "c-1",
            name: "RAG",
            canonicalSummary: "two sentences. yes.",
            parentTopic: "retrieval",
            sourceChunkIds: ["11111111-1111-1111-1111-111111111111"],
          })),
        },
        sourceChunks: {
          findMany: vi.fn(async () => [
            { id: "11111111-1111-1111-1111-111111111111", content: "rag is rag" },
          ]),
        },
      },
      update: updateSpy,
      insert: insertSpy,
    } as never;
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

    const out = await regenerateCards({
      apiKey: "sk-x",
      haikuModel: "anthropic/claude-haiku-4-5",
      conceptName: "RAG",
      db: dbMock,
    });
    expect(out.disabled).toBeGreaterThanOrEqual(0);
    expect(out.created).toBe(1);
    expect(updateSpy).toHaveBeenCalledTimes(1); // disabled
    expect(insertSpy).toHaveBeenCalledTimes(1); // new cards
  });

  it("throws when concept name is unknown", async () => {
    const dbMock = {
      query: { concepts: { findFirst: vi.fn(async () => undefined) } },
    } as never;
    await expect(
      regenerateCards({
        apiKey: "sk-x",
        haikuModel: "anthropic/claude-haiku-4-5",
        conceptName: "Nonexistent",
        db: dbMock,
      }),
    ).rejects.toThrow(/Nonexistent/);
  });
});
