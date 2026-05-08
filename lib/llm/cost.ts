/** Per-million-token USD prices. Values from OpenRouter pricing pages — keep
 *  these reviewed; if they drift wildly the `llm_calls.cost_usd` column will
 *  be wrong by the same factor (no functional break, just bad accounting). */
export const MODEL_PRICING: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  "anthropic/claude-haiku-4-5":  { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  "anthropic/claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "voyageai/voyage-3":           { inputPerMTok: 0.06, outputPerMTok: 0 },
};

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.inputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok
  );
}
