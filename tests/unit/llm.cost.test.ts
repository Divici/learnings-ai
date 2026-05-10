import { describe, it, expect } from "vitest";
import { computeCost, MODEL_PRICING } from "@/lib/llm/cost";

describe("computeCost", () => {
  it("computes Haiku 4.5 cost from input + output tokens", () => {
    const cost = computeCost("anthropic/claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(cost).toBe(MODEL_PRICING["anthropic/claude-haiku-4-5"]!.inputPerMTok
      + MODEL_PRICING["anthropic/claude-haiku-4-5"]!.outputPerMTok);
  });

  it("scales linearly with token counts", () => {
    const a = computeCost("anthropic/claude-sonnet-4-6", 100_000, 50_000);
    const b = computeCost("anthropic/claude-sonnet-4-6", 200_000, 100_000);
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it("returns 0 for unknown model rather than throwing", () => {
    expect(computeCost("unknown/model", 100, 100)).toBe(0);
  });

  it("treats embedding model output tokens as 0 (priced per input only)", () => {
    const cost = computeCost("voyageai/voyage-3", 1_000_000, 0);
    expect(cost).toBe(MODEL_PRICING["voyageai/voyage-3"]!.inputPerMTok);
  });
});
