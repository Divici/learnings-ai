import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";
import type { Grade } from "@/lib/srs/sm2";

export const FreeformGradeSchema = z.object({
  criteria_scores: z.array(
    z.object({
      criterion: z.string(),
      met: z.enum(["yes", "partial", "no"]),
      evidence: z.string(),
    }),
  ),
  overall_score: z.number().min(0).max(1),
  summary_feedback: z.string(),
  what_to_revisit: z.string().nullable(),
});

export type FreeformGradeRaw = z.infer<typeof FreeformGradeSchema>;

export type FreeformCardInfo = {
  prompt: string;
  canonicalAnswer: string;
  rubric: Array<{ criterion: string; weight: number }> | null;
};

export type FreeformGradeOptions = {
  apiKey: string;
  model: string;
  card: FreeformCardInfo;
  userAnswer: string;
  fetchImpl?: typeof fetch;
};

export type FreeformGradeResult = {
  grade: Grade;
  overallScore: number;
  perCriterion: FreeformGradeRaw["criteria_scores"];
  summaryFeedback: string;
  whatToRevisit: string | null;
};

export function scoreToGrade(score: number): Grade {
  if (score >= 0.85) return 4;
  if (score >= 0.70) return 3;
  if (score >= 0.50) return 2;
  return 1;
}

const SYSTEM_PROMPT = `You grade short-answer responses against a reference and a rubric.
Be lenient on style and exact wording; reward correct ideas. Respond ONLY in JSON.

Schema:
{
  "criteria_scores": [{"criterion": "<from rubric>", "met": "yes"|"partial"|"no", "evidence": "<one short sentence>"}],
  "overall_score": <number 0..1, weighted by rubric weights>,
  "summary_feedback": "<2-3 sentences, encouraging tone>",
  "what_to_revisit": "<single concept name or null>"
}`;

export async function gradeFreeform(opts: FreeformGradeOptions): Promise<FreeformGradeResult> {
  if (!opts.card.rubric || opts.card.rubric.length === 0) {
    throw new Error("gradeFreeform: rubric is required for freeform cards");
  }
  const userPrompt = [
    `Question: ${opts.card.prompt}`,
    `Reference answer: ${opts.card.canonicalAnswer}`,
    `Rubric: ${JSON.stringify(opts.card.rubric)}`,
    `User answer: ${opts.userAnswer}`,
  ].join("\n");

  const { value } = await structuredChat({
    apiKey: opts.apiKey,
    model: opts.model,
    module: "grading.freeform",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: FreeformGradeSchema,
    maxTokens: 2048,
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });

  return {
    grade: scoreToGrade(value.overall_score),
    overallScore: value.overall_score,
    perCriterion: value.criteria_scores,
    summaryFeedback: value.summary_feedback,
    whatToRevisit: value.what_to_revisit,
  };
}
