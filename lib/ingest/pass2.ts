import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { cards, concepts, settings } from "@/lib/db/schema";
import { extractConcepts } from "@/lib/ingest/concepts";
import { generateCards } from "@/lib/ingest/cardGen";
import { findNeighbors } from "@/lib/ingest/conceptPairs";

const CONCEPT_CONCURRENCY = 4;

export type Pass2Options = {
  apiKey: string;
  sonnetModel: string;
  haikuModel: string;
  db: Database;
  fetchImpl?: typeof fetch;
  /** Test escape hatch: precompute the signature deterministically. */
  forceSignature?: string;
};

export type Pass2Result =
  | { skipped: true; reason: "signature-match" }
  | {
      skipped: false;
      conceptCount: number;
      cardCount: number;
      disabledCount: number;
    };

function computeCorpusSignature(
  chunks: Array<{ id: string; content: string }>,
): string {
  const concat = [...chunks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => `${c.id}|${c.content}`)
    .join("\n");
  return createHash("sha256").update(concat).digest("hex");
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runPass2(opts: Pass2Options): Promise<Pass2Result> {
  const allChunks = await opts.db.query.sourceChunks.findMany({
    columns: { id: true, content: true },
  });
  if (allChunks.length === 0) {
    return { skipped: false, conceptCount: 0, cardCount: 0, disabledCount: 0 };
  }

  const signature = opts.forceSignature ?? computeCorpusSignature(allChunks);
  const settingsRow = await opts.db.query.settings.findFirst();
  if (settingsRow?.corpusSignature === signature) {
    return { skipped: true, reason: "signature-match" };
  }

  const chunkContextById = new Map(allChunks.map((c) => [c.id, c.content]));
  const chunksForExtraction = await opts.db.query.sourceChunks.findMany({
    columns: { id: true, content: true, headingPath: true },
  });

  const extracted = await extractConcepts({
    apiKey: opts.apiKey,
    model: opts.sonnetModel,
    chunks: chunksForExtraction,
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });

  // Upsert concepts by name; collect their ids.
  const conceptRows: Array<{
    id: string;
    name: string;
    parentTopic: string;
    canonicalSummary: string;
    sourceChunkIds: string[];
  }> = [];
  for (const c of extracted.concepts) {
    const inserted = await opts.db
      .insert(concepts)
      .values({
        name: c.name,
        canonicalSummary: c.canonical_summary,
        parentTopic: c.parent_topic,
        sourceChunkIds: c.source_chunk_ids,
      })
      .onConflictDoUpdate({
        target: concepts.name,
        set: {
          canonicalSummary: c.canonical_summary,
          parentTopic: c.parent_topic,
          sourceChunkIds: c.source_chunk_ids,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (inserted[0]) {
      conceptRows.push({
        id: inserted[0].id,
        name: inserted[0].name,
        parentTopic: c.parent_topic,
        canonicalSummary: c.canonical_summary,
        sourceChunkIds: c.source_chunk_ids,
      });
    }
  }

  // Generate cards per concept (concurrency-limited).
  const generated = await runWithConcurrency(
    conceptRows,
    CONCEPT_CONCURRENCY,
    async (concept) => {
      const sourceChunksForConcept = concept.sourceChunkIds
        .map((id) => ({ id, content: chunkContextById.get(id) ?? "" }))
        .filter((c) => c.content.length > 0);
      return generateCards({
        apiKey: opts.apiKey,
        model: opts.haikuModel,
        concept: {
          name: concept.name,
          canonicalSummary: concept.canonicalSummary,
          parentTopic: concept.parentTopic,
          sourceChunks: sourceChunksForConcept,
        },
        neighbors: findNeighbors(concept.name),
        ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
      });
    },
  );

  let cardCount = 0;
  for (let i = 0; i < conceptRows.length; i++) {
    const conceptId = conceptRows[i]!.id;
    const cardsForConcept = generated[i]!.cards;
    if (cardsForConcept.length === 0) continue;
    await opts.db.insert(cards).values(
      cardsForConcept.map((c) => ({
        conceptId,
        cardType: c.cardType,
        prompt: c.prompt,
        canonicalAnswer: c.canonicalAnswer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.sourceChunkIds,
        mcOptions: c.mcOptions ?? null,
        clozeAnswers: c.clozeAnswers ?? null,
        rubric: c.rubric ?? null,
      })),
    );
    cardCount += cardsForConcept.length;
  }

  // Refresh strategy: disable cards whose source chunks no longer exist.
  const validChunkIds = new Set(allChunks.map((c) => c.id));
  const allCards = await opts.db.query.cards.findMany({
    columns: { id: true, sourceChunkIds: true, isDisabled: true },
  });
  let disabledCount = 0;
  for (const card of allCards) {
    if (card.isDisabled) continue;
    const stillCovered = card.sourceChunkIds.some((id) => validChunkIds.has(id));
    if (!stillCovered) {
      await opts.db.update(cards).set({ isDisabled: true }).where(eq(cards.id, card.id));
      disabledCount++;
    }
  }

  // Update corpus signature.
  await opts.db
    .update(settings)
    .set({ corpusSignature: signature, updatedAt: new Date() })
    .where(eq(settings.id, 1));

  return {
    skipped: false,
    conceptCount: conceptRows.length,
    cardCount,
    disabledCount,
  };
}
