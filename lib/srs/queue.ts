import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { cards, reviewState } from "@/lib/db/schema";

export type Bucket = "today" | "yesterday" | "older";
export type QueueCard = {
  id: string;
  conceptId: string;
  cardType: "mc" | "cloze" | "freeform";
  bucket: Bucket;
};

/** Group-and-rotate within each bucket so consecutive cards have different concept_ids
 *  when possible. Buckets retain their order (today → yesterday → older). */
export function interleave(input: QueueCard[]): QueueCard[] {
  const byBucket = new Map<Bucket, QueueCard[]>();
  for (const c of input) {
    if (!byBucket.has(c.bucket)) byBucket.set(c.bucket, []);
    byBucket.get(c.bucket)!.push(c);
  }
  const out: QueueCard[] = [];
  for (const bucket of ["today", "yesterday", "older"] as const) {
    const items = byBucket.get(bucket);
    if (!items?.length) continue;
    out.push(...rotate(items));
  }
  return out;
}

function rotate(items: QueueCard[]): QueueCard[] {
  const groups = new Map<string, QueueCard[]>();
  for (const c of items) {
    if (!groups.has(c.conceptId)) groups.set(c.conceptId, []);
    groups.get(c.conceptId)!.push(c);
  }
  const queues = [...groups.values()];
  const out: QueueCard[] = [];
  while (queues.some((q) => q.length > 0)) {
    let placed = false;
    for (const q of queues) {
      if (q.length === 0) continue;
      const last = out[out.length - 1];
      if (
        last &&
        last.conceptId === q[0]!.conceptId &&
        queues.some((other) => other !== q && other.length > 0)
      ) {
        continue;
      }
      out.push(q.shift()!);
      placed = true;
      break;
    }
    if (!placed) {
      // Only one concept group remains — append it
      for (const q of queues) while (q.length) out.push(q.shift()!);
    }
  }
  return out;
}

export function fillNewCards(
  queue: QueueCard[],
  candidates: QueueCard[],
  target: number,
): QueueCard[] {
  const need = target - queue.length;
  if (need <= 0) return [];
  return candidates.slice(0, need);
}

export function fillNewCardsWithMastery(
  queue: QueueCard[],
  candidates: QueueCard[],
  target: number,
  masteryByConcept: Map<string, number>,
): QueueCard[] {
  const need = target - queue.length;
  if (need <= 0) return [];
  const sorted = [...candidates].sort((a, b) => {
    const ma = masteryByConcept.get(a.conceptId) ?? 0;
    const mb = masteryByConcept.get(b.conceptId) ?? 0;
    return ma - mb;
  });
  return sorted.slice(0, need);
}

function classifyBucket(dueAt: Date | null, now: Date): Bucket {
  if (!dueAt) return "today";
  const diffMs = now.getTime() - dueAt.getTime();
  const oneDay = 86_400_000;
  if (diffMs < oneDay) return "today";
  if (diffMs < 2 * oneDay) return "yesterday";
  return "older";
}

export async function dueQueue(opts: {
  db: Database;
  target: number;
  now?: Date;
}): Promise<QueueCard[]> {
  const now = opts.now ?? new Date();

  const due = await opts.db
    .select({
      id: cards.id,
      conceptId: cards.conceptId,
      cardType: cards.cardType,
      dueAt: reviewState.dueAt,
    })
    .from(cards)
    .innerJoin(reviewState, eq(reviewState.cardId, cards.id))
    .where(
      and(
        eq(cards.isDisabled, false),
        lte(reviewState.dueAt, now),
      ),
    )
    .orderBy(asc(reviewState.dueAt))
    .limit(opts.target);

  return interleave(
    due.map((d) => ({
      id: d.id,
      conceptId: d.conceptId,
      cardType: d.cardType,
      bucket: classifyBucket(d.dueAt, now),
    })),
  );
}

export async function unseenCandidates(opts: {
  db: Database;
  limit: number;
}): Promise<QueueCard[]> {
  const rows = await opts.db.execute<{
    id: string;
    concept_id: string;
    card_type: "mc" | "cloze" | "freeform";
  }>(
    sql`SELECT c.id::text AS id, c.concept_id::text AS concept_id, c.card_type
        FROM cards c
        LEFT JOIN review_state rs ON rs.card_id = c.id
        WHERE c.is_disabled = false AND rs.card_id IS NULL
        LIMIT ${opts.limit}`,
  );
  const arr = rows as unknown as Array<{
    id: string;
    concept_id: string;
    card_type: "mc" | "cloze" | "freeform";
  }>;
  return arr.map((r) => ({
    id: r.id,
    conceptId: r.concept_id,
    cardType: r.card_type,
    bucket: "today" as const,
  }));
}
