import { db } from "@/lib/db";
import { dueQueue, unseenCandidates, fillNewCardsWithMastery } from "@/lib/srs/queue";
import { masteryByConcept } from "@/lib/srs/mastery";
import { SessionClient, type SessionCard } from "@/app/learning/SessionClient";
import { QueueHero } from "@/components/learning/QueueHero";
import { EmptyQueue } from "@/components/learning/EmptyQueue";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { SessionTelemetry } from "@/components/learning/SessionTelemetry";
import { SourceMaterialList } from "@/components/learning/SourceMaterialList";

const DAILY_TARGET = 20;

async function loadSessionCards(target: number): Promise<SessionCard[]> {
  const queueRefs = await dueQueue({ db, target });
  const candidates = queueRefs.length < target ? await unseenCandidates({ db, limit: target * 2 }) : [];
  const mastery = await masteryByConcept(db);
  const fillRefs = fillNewCardsWithMastery(queueRefs, candidates, target, mastery);
  const ids = [...queueRefs, ...fillRefs].map((q) => q.id);
  if (ids.length === 0) return [];
  const cardsWithConcepts = await db.query.cards.findMany({
    where: (c, { inArray }) => inArray(c.id, ids),
  });
  const orderMap = new Map(ids.map((id, i) => [id, i]));
  cardsWithConcepts.sort((a, b) => (orderMap.get(a.id)! - orderMap.get(b.id)!));
  const reviewStates = await db.query.reviewState.findMany({
    where: (rs, { inArray }) => inArray(rs.cardId, cardsWithConcepts.map((c) => c.id)),
  });
  const rsMap = new Map(reviewStates.map((rs) => [rs.cardId, rs]));
  const conceptIds = [...new Set(cardsWithConcepts.map((c) => c.conceptId))];
  const concepts = await db.query.concepts.findMany({
    where: (c, { inArray }) => inArray(c.id, conceptIds),
    columns: { id: true, name: true },
  });
  const conceptMap = new Map(concepts.map((c) => [c.id, c.name]));
  return cardsWithConcepts.map((c) => {
    const rs = rsMap.get(c.id);
    return {
      id: c.id,
      conceptName: conceptMap.get(c.conceptId) ?? "?",
      cardType: c.cardType,
      prompt: c.prompt,
      canonicalAnswer: c.canonicalAnswer,
      explanation: c.explanation,
      difficulty: c.difficulty as 1 | 2 | 3,
      mcOptions: (c.mcOptions as { options: string[]; correctIndex: number } | null) ?? null,
      clozeAnswers: (c.clozeAnswers as string[] | null) ?? null,
      rubric: (c.rubric as Array<{ criterion: string; weight: number }> | null) ?? null,
      reviewState: {
        ease: rs?.ease ?? 2.5,
        intervalDays: rs?.intervalDays ?? 0,
        repetitions: rs?.repetitions ?? 0,
        lapses: rs?.lapses ?? 0,
      },
    };
  });
}

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const inSession = !!params.session;

  const cards = await loadSessionCards(DAILY_TARGET);

  if (!inSession) {
    if (cards.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <EmptyQueue tomorrowCount={0} />
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center">
        <QueueHero
          dueCount={cards.length}
          topicBreakdown={[]}
        />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyQueue tomorrowCount={0} />
      </div>
    );
  }

  return (
    <div className="h-full flex gap-6">
      <GlassPanel className="rounded-2xl flex-1 flex flex-col relative overflow-hidden">
        <SessionClient cards={cards} conceptName={cards[0]?.conceptName ?? "Session"} />
      </GlassPanel>
      <aside className="w-80 flex flex-col gap-6">
        <SessionTelemetry retentionPct={0} timePerCardSec={0} memoryStrengthPct={0} />
        <SourceMaterialList chunks={[]} />
      </aside>
    </div>
  );
}
