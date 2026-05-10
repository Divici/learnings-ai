import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { query: { cards: { findFirst: vi.fn() }, settings: { findFirst: vi.fn(async () => ({ modelHaiku: "anthropic/claude-haiku-4-5" })) } } },
}));
vi.mock("@/lib/grading/freeform", () => ({ gradeFreeform: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: "sk-x" } }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { POST } from "@/app/api/review/freeform-grade/route";
import { db } from "@/lib/db";
import { gradeFreeform } from "@/lib/grading/freeform";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/review/freeform-grade", () => {
  it("400 when body invalid", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("404 when card not found", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce(undefined as never);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", userAnswer: "x" }) }),
    );
    expect(res.status).toBe(404);
  });

  it("returns grader output for freeform cards", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      cardType: "freeform",
      prompt: "x", canonicalAnswer: "y", rubric: [{ criterion: "x", weight: 1 }],
    } as never);
    vi.mocked(gradeFreeform).mockResolvedValueOnce({
      grade: 3, overallScore: 0.78, perCriterion: [], summaryFeedback: "ok", whatToRevisit: null,
    });
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", userAnswer: "answer" }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grade).toBe(3);
  });

  it("400 if card is not freeform type", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000", cardType: "mc",
    } as never);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", userAnswer: "x" }) }),
    );
    expect(res.status).toBe(400);
  });
});
