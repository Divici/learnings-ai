import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { attempts, cards, reviewState } from "@/lib/db/schema";
import { computeDueAt, nextReview, type Grade, type ReviewState } from "@/lib/srs/sm2";
import { log } from "@/lib/log";

const BodySchema = z.object({
  cardId: z.string().uuid(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().int().nonnegative(),
  userAnswer: z.string().optional(),
  selectedIndex: z.number().int().nonnegative().optional(),
  clozeInputs: z.array(z.string()).optional(),
  feedback: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
});

const DEFAULT_STATE: ReviewState = { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const card = await db.query.cards.findFirst({
    where: (c, { eq }) => eq(c.id, body.cardId),
  });
  if (!card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  // Variant cards share their parent's SRS row.
  const srsCardId = card.parentCardId ?? card.id;

  const existing = await db.query.reviewState.findFirst({
    where: (rs, { eq }) => eq(rs.cardId, srsCardId),
  });
  const prior: ReviewState = existing
    ? {
        ease: existing.ease,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        lapses: existing.lapses,
      }
    : DEFAULT_STATE;

  const grade = body.grade as Grade;
  const next = nextReview(prior, grade);
  const dueAt = computeDueAt(next.intervalDays);

  if (existing) {
    await db.update(reviewState).set({
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt,
      lastGrade: grade,
      lastReviewedAt: new Date(),
    }).where(eq(reviewState.cardId, srsCardId));
  } else {
    await db.insert(reviewState).values({
      cardId: srsCardId,
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt,
      lastGrade: grade,
      lastReviewedAt: new Date(),
    });
  }

  await db.insert(attempts).values({
    cardId: body.cardId,
    userAnswer: body.userAnswer ?? body.clozeInputs?.join(" | ") ?? (body.selectedIndex !== undefined ? String(body.selectedIndex) : null),
    score: body.score ?? (grade === 4 ? 1 : grade === 3 ? 0.75 : grade === 2 ? 0.5 : 0),
    grade,
    feedback: body.feedback ?? null,
    durationMs: body.durationMs,
  });

  log.info({ cardId: body.cardId, grade, srsCardId }, "review.grade");

  return NextResponse.json({
    ok: true,
    nextDueAt: dueAt.toISOString(),
    newState: next,
  });
}
