import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));

import { gradeFreeform, scoreToGrade, FreeformGradeSchema } from "@/lib/grading/freeform";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => vi.clearAllMocks());

describe("scoreToGrade", () => {
  it.each([
    [1.0, 4], [0.85, 4], [0.84, 3], [0.70, 3], [0.69, 2], [0.50, 2], [0.49, 1], [0.0, 1],
  ])("score %f → grade %i", (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

describe("gradeFreeform", () => {
  it("calls Haiku with prompt + canonical + rubric + answer and returns mapped grade", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: {
        criteria_scores: [
          { criterion: "names retrieval", met: "yes", evidence: "user said 'retrieve'" },
          { criterion: "names generation", met: "partial", evidence: "implied but not stated" },
        ],
        overall_score: 0.78,
        summary_feedback: "Solid grasp of retrieval; generation was implicit.",
        what_to_revisit: null,
      },
      inputTokens: 200, outputTokens: 50, latencyMs: 600,
    });
    const out = await gradeFreeform({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      card: {
        prompt: "Explain RAG",
        canonicalAnswer: "Retrieval-augmented generation: retrieve relevant docs, condition the LLM on them.",
        rubric: [
          { criterion: "names retrieval", weight: 0.5 },
          { criterion: "names generation", weight: 0.5 },
        ],
      },
      userAnswer: "RAG retrieves docs to answer questions.",
    });
    expect(out.grade).toBe(3);
    expect(out.overallScore).toBeCloseTo(0.78, 2);
    expect(out.perCriterion).toHaveLength(2);
    expect(out.summaryFeedback).toMatch(/Solid grasp/);
  });

  it("FreeformGradeSchema rejects met value outside yes|partial|no", () => {
    expect(() =>
      FreeformGradeSchema.parse({
        criteria_scores: [{ criterion: "x", met: "maybe", evidence: "..." }],
        overall_score: 0.5,
        summary_feedback: "ok",
        what_to_revisit: null,
      }),
    ).toThrow();
  });

  it("FreeformGradeSchema rejects overall_score outside 0..1", () => {
    expect(() =>
      FreeformGradeSchema.parse({
        criteria_scores: [],
        overall_score: 1.5,
        summary_feedback: "ok",
        what_to_revisit: null,
      }),
    ).toThrow();
  });

  it("throws when rubric is empty", async () => {
    await expect(
      gradeFreeform({
        apiKey: "sk-x", model: "anthropic/claude-haiku-4-5",
        card: { prompt: "x", canonicalAnswer: "y", rubric: [] },
        userAnswer: "answer",
      }),
    ).rejects.toThrow(/rubric/i);
  });
});
