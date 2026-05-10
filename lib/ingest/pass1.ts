import type { Database } from "@/lib/db";
import { sourceChunks, sourceFiles } from "@/lib/db/schema";
import { chunkMarkdown } from "@/lib/ingest/chunker";
import { embedChunks } from "@/lib/ingest/embedder";
import { tagChunks } from "@/lib/ingest/topicTagger";
import {
  computeFileHash,
  shouldReingest,
  tearDownExistingChunks,
} from "@/lib/ingest/sourceFiles";

export type Pass1Options = {
  filename: string;
  content: string;
  title?: string;
  apiKey: string;
  embedModel: string;
  tagModel: string;
  db: Database;
  fetchImpl?: typeof fetch;
};

export type Pass1Result =
  | { skipped: true; reason: "hash-match"; filename: string }
  | {
      skipped: false;
      filename: string;
      chunkCount: number;
      totalEmbedTokens: number;
    };

export async function runPass1(opts: Pass1Options): Promise<Pass1Result> {
  const contentHash = computeFileHash(opts.content);
  const decision = await shouldReingest({
    filename: opts.filename,
    contentHash,
    db: opts.db,
  });

  if (decision.action === "skip") {
    return { skipped: true, reason: "hash-match", filename: opts.filename };
  }

  if (decision.action === "reingest") {
    await tearDownExistingChunks({ fileId: decision.existingFileId, db: opts.db });
  }

  const chunks = chunkMarkdown(opts.content);
  if (chunks.length === 0) {
    return { skipped: false, filename: opts.filename, chunkCount: 0, totalEmbedTokens: 0 };
  }
  const texts = chunks.map((c) => c.content);

  const [embedded, tagged] = await Promise.all([
    embedChunks({
      apiKey: opts.apiKey,
      model: opts.embedModel,
      module: "ingest.embed",
      texts,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
    }),
    tagChunks({
      apiKey: opts.apiKey,
      model: opts.tagModel,
      module: "ingest.tag",
      texts,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
    }),
  ]);

  // Upsert source_files row.
  await opts.db
    .insert(sourceFiles)
    .values({
      filename: opts.filename,
      title: opts.title ?? opts.filename.replace(/\.md$/, "").replace(/[_-]/g, " "),
      contentHash,
      ingestedAt: new Date(),
      chunkCount: chunks.length,
    })
    .onConflictDoUpdate({
      target: sourceFiles.filename,
      set: {
        contentHash,
        ingestedAt: new Date(),
        chunkCount: chunks.length,
        updatedAt: new Date(),
      },
    });

  // Get the file id for the FK on chunks.
  const fileRow = await opts.db.query.sourceFiles.findFirst({
    where: (f, { eq }) => eq(f.filename, opts.filename),
  });
  if (!fileRow) throw new Error(`source_files row missing after upsert: ${opts.filename}`);

  const rows = chunks.map((c, i) => {
    const vec = embedded.vectors[i];
    if (!vec) {
      throw new Error(
        `embedder returned no vector for chunk ${i} of ${opts.filename}`,
      );
    }
    return {
      fileId: fileRow.id,
      position: c.position,
      content: c.content,
      headingPath: c.headingPath,
      embedding: vec,
      tokenCount: c.tokenCount,
      topicTags: tagged.tags[i] ?? [],
    };
  });
  await opts.db.insert(sourceChunks).values(rows);

  return {
    skipped: false,
    filename: opts.filename,
    chunkCount: chunks.length,
    totalEmbedTokens: embedded.totalInputTokens,
  };
}
