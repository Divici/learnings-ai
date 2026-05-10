import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cards } from "@/lib/db/schema";
import { structuredChat } from "@/lib/llm/structured";

const BodySchema = z.object({
  cardId: z.string().uuid(),
  persist: z.boolean().default(false),
});

const VariantSchema = z.object({
  prompt: z.string(),
  canonical_answer: z.string(),
  explanation: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mc_options: z.object({ options: z.array(z.string()), correct_index: z.number() }).nullable(),
  cloze_answers: z.array(z.string()).nullable(),
  rubric: z.array(z.object({ criterion: z.string(), weight: z.number() })).nullable(),
});

const SYSTEM_PROMPT = `Rephrase the given spaced-repetition card to test the same concept differently —
change wording, scenario, and (for MC) distractors. Keep card_type and difficulty the same.
Return JSON with exactly the same keys as the original (prompt, canonical_answer, explanation, difficulty,
mc_options, cloze_answers, rubric). Set fields irrelevant to the type to null.`;

export async function POST(req: Request) {
  if (!env.OPENROUTER_API_KEY) return NextResponse.json({ ok: false, error: "no api key" }, { status: 503 });
  let body: z.infer<typeof BodySchema>;
  try { body = BodySchema.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 }); }

  const original = await db.query.cards.findFirst({ where: (c, { eq }) => eq(c.id, body.cardId) });
  if (!original) return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });

  const settings = await db.query.settings.findFirst();
  if (!settings) return NextResponse.json({ ok: false, error: "settings missing" }, { status: 500 });

  const userPrompt = [
    `Original card_type: ${original.cardType}`,
    `Original difficulty: ${original.difficulty}`,
    `Original prompt: ${original.prompt}`,
    `Original canonical_answer: ${original.canonicalAnswer}`,
    `Original explanation: ${original.explanation}`,
    original.mcOptions ? `Original mc_options: ${JSON.stringify(original.mcOptions)}` : "",
    original.clozeAnswers ? `Original cloze_answers: ${JSON.stringify(original.clozeAnswers)}` : "",
    original.rubric ? `Original rubric: ${JSON.stringify(original.rubric)}` : "",
  ].filter(Boolean).join("\n");

  const { value } = await structuredChat({
    apiKey: env.OPENROUTER_API_KEY,
    model: settings.modelHaiku,
    module: "cards.regenerateVariant",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: VariantSchema,
    maxTokens: 2048,
  });

  const variant = {
    cardType: original.cardType,
    prompt: value.prompt,
    canonicalAnswer: value.canonical_answer,
    explanation: value.explanation,
    difficulty: value.difficulty,
    sourceChunkIds: original.sourceChunkIds,
    mcOptions: value.mc_options ? { options: value.mc_options.options, correctIndex: value.mc_options.correct_index } : null,
    clozeAnswers: value.cloze_answers ?? null,
    rubric: value.rubric ?? null,
  };

  if (!body.persist) {
    return NextResponse.json({ ok: true, persisted: false, card: variant });
  }

  const inserted = await db.insert(cards).values({
    conceptId: original.conceptId,
    cardType: variant.cardType,
    prompt: variant.prompt,
    canonicalAnswer: variant.canonicalAnswer,
    explanation: variant.explanation,
    difficulty: variant.difficulty,
    sourceChunkIds: variant.sourceChunkIds,
    mcOptions: variant.mcOptions,
    clozeAnswers: variant.clozeAnswers,
    rubric: variant.rubric,
    parentCardId: original.id,
    isLiveGenerated: true,
  }).returning();

  return NextResponse.json({ ok: true, persisted: true, card: { ...variant, id: inserted[0]?.id } });
}
