import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";

const McOptions = z.object({
  options: z.array(z.string()).min(2).max(6),
  correct_index: z.number().int().min(0),
});

const RubricItem = z.object({
  criterion: z.string().min(1),
  weight: z.number().min(0).max(1),
});

const Difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const Card = z.discriminatedUnion("card_type", [
  z.object({
    card_type: z.literal("mc"),
    prompt: z.string().min(1),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    mc_options: McOptions,
  }),
  z.object({
    card_type: z.literal("cloze"),
    prompt: z.string().regex(/\{\{c\d+::[^}]+\}\}/),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    cloze_answers: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    card_type: z.literal("freeform"),
    prompt: z.string().min(1),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    rubric: z.array(RubricItem).min(1),
  }),
]);

export const CardGenSchema = z.object({ cards: z.array(Card) });

export type GeneratedCard = {
  cardType: "mc" | "cloze" | "freeform";
  prompt: string;
  canonicalAnswer: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
  sourceChunkIds: string[];
  mcOptions: { options: string[]; correctIndex: number } | null;
  clozeAnswers: string[] | null;
  rubric: { criterion: string; weight: number }[] | null;
};

export type GenerateCardsOptions = {
  apiKey: string;
  model: string;
  concept: {
    name: string;
    canonicalSummary: string;
    parentTopic: string;
    sourceChunks: Array<{ id: string; content: string }>;
  };
  neighbors: string[];
  fetchImpl?: typeof fetch;
};

export type GenerateCardsResult = { cards: GeneratedCard[] };

const SYSTEM_PROMPT = `You generate spaced-repetition cards for AI-engineering
concepts. Each call must produce exactly 8 cards: 3 multiple-choice, 3 cloze, 2 freeform.

CRITICAL: the "card_type" field MUST be exactly one of these three lowercase strings — no other value:
  "mc"        for multiple-choice cards
  "cloze"     for fill-in-the-blank cards
  "freeform"  for open-ended cards

Rules:
- All cards reference at least one source_chunk_id from the provided chunks.
- difficulty is an integer: 1 = fact recall, 2 = apply concept, 3 = compare/synthesize.
- "mc" cards: include "mc_options": { "options": [4 strings], "correct_index": int 0-3 }.
- "cloze" cards: prompt MUST contain {{c1::answer}} syntax (one or more blanks); include "cloze_answers": [string per blank].
- "freeform" cards: include "rubric": [{ "criterion": string, "weight": number 0-1 }] with 2-4 criteria, weights summing to ~1.0.

If a "Compare with:" neighbor is supplied in the user prompt, ONE of the freeform cards must be a
compare/contrast or "when to use which" question against that neighbor.

Return ONLY JSON of this shape (no prose, no markdown fences):
{ "cards": [
  { "card_type": "mc", "prompt": "...", "canonical_answer": "...", "explanation": "...",
    "difficulty": 2, "source_chunk_ids": ["uuid"], "mc_options": { "options": ["a","b","c","d"], "correct_index": 1 } },
  { "card_type": "cloze", "prompt": "The {{c1::answer}} is here.", "canonical_answer": "answer", "explanation": "...",
    "difficulty": 1, "source_chunk_ids": ["uuid"], "cloze_answers": ["answer"] },
  { "card_type": "freeform", "prompt": "...", "canonical_answer": "...", "explanation": "...",
    "difficulty": 3, "source_chunk_ids": ["uuid"],
    "rubric": [{ "criterion": "names key tradeoff", "weight": 0.5 }, { "criterion": "gives concrete example", "weight": 0.5 }] }
] }`;

function buildUserPrompt(opts: GenerateCardsOptions): string {
  const compareLine = opts.neighbors.length
    ? `\nCompare with: ${opts.neighbors.join(", ")} (force ONE freeform card to compare/contrast).`
    : "";
  const chunks = opts.concept.sourceChunks
    .map((c) => `[${c.id}] ${c.content.slice(0, 1200)}`)
    .join("\n\n");
  return [
    `Concept: ${opts.concept.name}`,
    `Parent topic: ${opts.concept.parentTopic}`,
    `Summary: ${opts.concept.canonicalSummary}`,
    compareLine,
    `\nSource chunks:\n${chunks}`,
  ].join("\n");
}

export async function generateCards(
  opts: GenerateCardsOptions,
): Promise<GenerateCardsResult> {
  const { value } = await structuredChat({
    apiKey: opts.apiKey,
    model: opts.model,
    module: "ingest.cardGen",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(opts),
    schema: CardGenSchema,
    maxTokens: 8192,
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });

  const cards: GeneratedCard[] = value.cards.map((c) => {
    if (c.card_type === "mc") {
      return {
        cardType: "mc",
        prompt: c.prompt,
        canonicalAnswer: c.canonical_answer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.source_chunk_ids,
        mcOptions: { options: c.mc_options.options, correctIndex: c.mc_options.correct_index },
        clozeAnswers: null,
        rubric: null,
      };
    }
    if (c.card_type === "cloze") {
      return {
        cardType: "cloze",
        prompt: c.prompt,
        canonicalAnswer: c.canonical_answer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.source_chunk_ids,
        mcOptions: null,
        clozeAnswers: c.cloze_answers,
        rubric: null,
      };
    }
    return {
      cardType: "freeform",
      prompt: c.prompt,
      canonicalAnswer: c.canonical_answer,
      explanation: c.explanation,
      difficulty: c.difficulty,
      sourceChunkIds: c.source_chunk_ids,
      mcOptions: null,
      clozeAnswers: null,
      rubric: c.rubric,
    };
  });

  return { cards };
}
