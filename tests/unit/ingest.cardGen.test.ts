import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));

import { generateCards, CardGenSchema } from "@/lib/ingest/cardGen";
import { structuredChat } from "@/lib/llm/structured";

const concept = {
  name: "RAG",
  canonicalSummary: "RAG augments LLMs with retrieved context.",
  parentTopic: "retrieval",
  sourceChunks: [
    { id: "11111111-1111-1111-1111-111111111111", content: "RAG = retrieve + generate." },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateCards", () => {
  it("requests 3 MC + 3 cloze + 2 freeform from the schema", async () => {
    const validResponse = {
      cards: [
        ...Array.from({ length: 3 }, (_, i) => ({
          card_type: "mc",
          prompt: `mc q ${i}`,
          canonical_answer: `correct ${i}`,
          explanation: "because",
          difficulty: 2,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          mc_options: { options: ["a", "correct " + i, "c", "d"], correct_index: 1 },
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          card_type: "cloze",
          prompt: `the {{c1::answer${i}}} is here`,
          canonical_answer: `answer${i}`,
          explanation: "because",
          difficulty: 2,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          cloze_answers: [`answer${i}`],
        })),
        {
          card_type: "freeform",
          prompt: "explain RAG",
          canonical_answer: "rag combines retrieval with generation",
          explanation: "rag explains itself",
          difficulty: 3,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          rubric: [{ criterion: "mentions retrieval", weight: 0.5 }, { criterion: "mentions generation", weight: 0.5 }],
        },
        {
          card_type: "freeform",
          prompt: "compare RAG vs Fusion",
          canonical_answer: "fusion adds reranking; rag is single-pass.",
          explanation: "compare/contrast",
          difficulty: 3,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          rubric: [{ criterion: "names key difference", weight: 1.0 }],
        },
      ],
    };
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: validResponse,
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const out = await generateCards({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      concept,
      neighbors: ["Fusion"],
    });
    expect(out.cards).toHaveLength(8);
    expect(out.cards.filter((c) => c.cardType === "mc")).toHaveLength(3);
    expect(out.cards.filter((c) => c.cardType === "cloze")).toHaveLength(3);
    expect(out.cards.filter((c) => c.cardType === "freeform")).toHaveLength(2);
  });

  it("includes neighbor names in the user prompt when present", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { cards: [] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await generateCards({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      concept,
      neighbors: ["Fusion"],
    }).catch(() => undefined);
    const call = vi.mocked(structuredChat).mock.calls[0]![0];
    expect(call.userPrompt).toContain("Fusion");
  });

  it("CardGenSchema rejects unknown card_type", () => {
    expect(() =>
      CardGenSchema.parse({
        cards: [{ card_type: "essay", prompt: "x", canonical_answer: "y", explanation: "z", difficulty: 1, source_chunk_ids: [] }],
      }),
    ).toThrow();
  });
});
