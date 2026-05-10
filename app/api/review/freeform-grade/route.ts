import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { gradeFreeform } from "@/lib/grading/freeform";

const BodySchema = z.object({
  cardId: z.string().uuid(),
  userAnswer: z.string().min(1),
});

export async function POST(req: Request) {
  if (!env.OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY not set" }, { status: 503 });
  }
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const card = await db.query.cards.findFirst({
    where: (c, { eq }) => eq(c.id, body.cardId),
  });
  if (!card) return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  if (card.cardType !== "freeform") {
    return NextResponse.json({ ok: false, error: "card is not freeform" }, { status: 400 });
  }

  const settings = await db.query.settings.findFirst();
  if (!settings) return NextResponse.json({ ok: false, error: "settings missing" }, { status: 500 });

  const result = await gradeFreeform({
    apiKey: env.OPENROUTER_API_KEY,
    model: settings.modelHaiku,
    card: {
      prompt: card.prompt,
      canonicalAnswer: card.canonicalAnswer,
      rubric: (card.rubric as Array<{ criterion: string; weight: number }> | null) ?? null,
    },
    userAnswer: body.userAnswer,
  });

  return NextResponse.json({
    ok: true,
    grade: result.grade,
    overallScore: result.overallScore,
    perCriterion: result.perCriterion,
    summaryFeedback: result.summaryFeedback,
    whatToRevisit: result.whatToRevisit,
  });
}
