import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { query: { cards: { findFirst: vi.fn() }, settings: { findFirst: vi.fn(async () => ({ modelHaiku: "anthropic/claude-haiku-4-5" })) } }, insert: vi.fn() },
}));
vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: "sk-x" } }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { POST } from "@/app/api/cards/regenerate-variant/route";
import { db } from "@/lib/db";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/cards/regenerate-variant", () => {
  it("404 when card not found", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce(undefined as never);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000" }) }),
    );
    expect(res.status).toBe(404);
  });

  it("returns variant in-memory when persist=false", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      cardType: "mc", prompt: "old", canonicalAnswer: "x", explanation: "e",
      difficulty: 2, sourceChunkIds: ["src-1"], conceptId: "concept-1",
      mcOptions: { options: ["a","b","c","d"], correctIndex: 1 },
      clozeAnswers: null, rubric: null,
    } as never);
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: {
        prompt: "rephrased", canonical_answer: "x", explanation: "e", difficulty: 2,
        mc_options: { options: ["w","x","y","z"], correct_index: 1 }, cloze_answers: null, rubric: null,
      },
      inputTokens: 100, outputTokens: 50, latencyMs: 300,
    });
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", persist: false }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(false);
    expect(body.card.prompt).toBe("rephrased");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("persists variant when persist=true with parent_card_id set", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      cardType: "freeform", prompt: "old", canonicalAnswer: "x", explanation: "e",
      difficulty: 3, sourceChunkIds: ["src-1"], conceptId: "concept-1",
      mcOptions: null, clozeAnswers: null,
      rubric: [{ criterion: "x", weight: 1 }],
    } as never);
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: {
        prompt: "rephrased", canonical_answer: "x", explanation: "e", difficulty: 3,
        mc_options: null, cloze_answers: null, rubric: [{ criterion: "x", weight: 1 }],
      },
      inputTokens: 100, outputTokens: 50, latencyMs: 300,
    });
    const insertChain: any = { values: vi.fn(() => insertChain), returning: vi.fn(async () => [{ id: "variant-uuid" }]) };
    vi.mocked(db.insert).mockReturnValue(insertChain);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", persist: true }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(true);
    expect(db.insert).toHaveBeenCalled();
  });
});
